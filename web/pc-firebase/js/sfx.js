const transientAudio = (() => {
  let epoch = 0, quietUntil = 0;
  const sources = new Set();
  const allowed = () => (!document.hidden || S.set.bgSound) && performance.now() >= quietUntil;
  const track = source => { sources.add(source); source.addEventListener('ended', () => sources.delete(source), {once:true}); return source; };
  const clear = () => { epoch++; for (const source of sources) { try { source.stop(); source.disconnect(); } catch {} } sources.clear(); };
  document.addEventListener('visibilitychange', () => {
    if (!S.set.bgSound) { clear(); quietUntil = document.hidden ? Infinity : performance.now() + 350; }
  });
  window.addEventListener('pagehide', clear);
  const later = (fn, delay = 0) => {
    if (!allowed()) return;
    const ownEpoch = epoch, due = performance.now() + delay;
    return setTimeout(() => { if (ownEpoch === epoch && allowed() && performance.now() - due < 250) fn(); }, delay);
  };
  const guard = fn => { const ownEpoch = epoch; return (...args) => { if (ownEpoch === epoch && allowed()) return fn(...args); }; };
  return {allowed, track, later, guard};
})();
// 効果音。元のアプリと同じ「計算で作る音」(Kotlin の Synth)と、本物の録音(碁石=KaTrain、将棋の駒=ShogiHome。どちらも MIT License)を鳴らす。
const SAMPLES = {
  GO: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  STONE: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  FLIP: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  KOMA: ["koma_piece"],
};
const GAIN = { FLIP: 0.7 }; // 裏返すだけ 0.7 倍(元のアプリと同じ)

// Render the rolling contact and its short impact responses on one audio clock.
// A single tracked source can be cancelled even after the browser suspends a tab.
function rouletteAudioBuffer(ctx, {duration, impacts, panAt}) {
  const rate = 24000;
  const seconds = duration / 1000;
  const buffer = ctx.createBuffer(2, Math.ceil((seconds + .16) * rate), rate);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  let seed = 1 + Math.round(duration * 41);
  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }

  // Microscopic contacts excite a low wooden resonance and a brighter race
  // surface. Their spacing and treble both fall with the speed of the ball.
  const drop = impacts.find(hit => hit.kind === 'deflector');
  const raceEnd = drop ? drop.at / duration : .55;
  const finish = Math.floor(seconds * .92 * rate);
  let grain = 0, low = 0, surface = 0, pulse = 0, resonance = 0, previous = 0;
  let pan = 0, panStep = 0, untilGrain = 0;
  for (let i = 0; i < finish; i++) {
    const t = i / (seconds * rate);
    const speed = 1 - .76 * Math.min(1, t / raceEnd);
    if (i % 192 === 0) {
      const target = .38 * panAt(Math.min(1, (i + 192) / (seconds * rate)));
      panStep = (target - pan) / 192;
    }
    pan += panStep;
    const grit = noise();
    low += .076 * (grit - low);
    surface += (.19 + .39 * speed) * (grit - surface);
    grain += .009 * (Math.abs(grit) - grain);
    if (--untilGrain <= 0) {
      pulse += (.25 + .55 * Math.abs(grit)) * speed;
      untilGrain = (rate / (215 * speed + 30)) * (.70 + .57 * Math.abs(noise()));
    }
    pulse *= .74;
    const ring = 1.945 * resonance - .956 * previous + .014 * pulse;
    previous = resonance;
    resonance = ring;
    const release = Math.min(1, i / (rate * .055));
    const trail = Math.exp(-11 * Math.max(0, t - raceEnd)) * Math.min(1, (finish - i) / (rate * .05));
    const sample = release * trail * (.4 + .6 * speed) *
      (.48 * low + .23 * (surface - low) * (.5 + grain) + .62 * resonance);
    left[i] = sample * (.8 - .32 * pan);
    right[i] = sample * (.8 + .32 * pan);
  }

  const materials = {
    deflector: [[720, .032, .36], [2130, .026, .34], [4670, .017, .20]],
    fret:      [[880, .019, .38], [2820, .016, .30], [3920, .009, .17]],
    settle:    [[410, .016, .48], [1180, .010, .25], [2140, .006, .12]],
  };
  for (const hit of impacts) {
    const start = Math.round(rate * hit.at / 1000);
    const stop = Math.min(left.length - start, Math.ceil(rate * .135));
    const detune = 1 + noise() * .055;
    const pan = (hit.pan || 0) * .46;
    const modes = materials[hit.kind];
    for (let j = 0; j < stop; j++) {
      const time = j / rate;
      let sample = noise() * Math.exp(-time / .0016) * .42;
      for (const [frequency, decay, weight] of modes) {
        sample += weight * Math.sin(2 * Math.PI * detune * frequency * time) * Math.exp(-time / decay);
      }
      sample *= Math.min(1, j / 9) * (.68 * hit.strength);
      left[start + j] += sample * (.82 - .32 * pan);
      right[start + j] += sample * (.82 + .32 * pan);
    }
  }
  return buffer;
}

function createSfx(call) {
  let ctx = null;
  let enabled = true;
  const bufs = {};
  const vol = {};
  const ensure = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); window.SFXCTX = ctx; }
    return ctx;
  };
  const unlock = () => { const c = ensure(); if (c && c.state === "suspended") c.resume().catch(() => {}); };
  window.addEventListener("pointerdown", unlock, { passive: true });

  async function init() {
    const list = JSON.parse(await call("soundList"));
    const rate = await call("soundRate");
    const c = ensure();
    if (!c) return;
    for (const s of list) vol[s.name] = s.volume;
    for (const s of list) {
      bufs[s.name] = [];
      if (SAMPLES[s.name]) {
        for (const f of SAMPLES[s.name]) {
          try {
            const res = await fetch(`audio/${f}.mp3`);
            bufs[s.name].push(await c.decodeAudioData(await res.arrayBuffer()));
          } catch { /* 読めなくても止めない */ }
        }
        continue;
      }
      for (let v = 0; v < s.variants; v++) {
        try {
          const pcm = await call("synthPcm", s.name, v);
          const b = c.createBuffer(1, pcm.length, rate);
          const d = b.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) d[i] = pcm[i] / 32768;
          bufs[s.name].push(b);
        } catch { /* 音が作れなくてもアプリは止めない */ }
      }
    }
  }

  function play(name, { volume = 1, rate = 1 } = {}) {
    if (!enabled || !ctx || ctx.state !== "running" || !name || !transientAudio.allowed()) return;
    const list = bufs[name];
    if (!list || !list.length) return;
    const src = transientAudio.track(ctx.createBufferSource());
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = Math.min(2, Math.max(0.5, rate));
    const g = ctx.createGain();
    g.gain.value = Math.min(1, Math.max(0, volume * (vol[name] ?? 1) * (GAIN[name] ?? 1) * (S.set.master / 100) * (S.set.sfxVol / 100)));
    src.connect(g).connect(ctx.destination);
    src.start();
  }

  let wheelSource = null;
  function rouletteSpin(plan) {
    if (!enabled || !S.set.sound || !ctx || ctx.state !== 'running' || !transientAudio.allowed()) return;
    const volume = S.set.master / 100 * S.set.sfxVol / 100;
    if (volume <= 0) return;
    const clock = performance.now();
    const src = transientAudio.track(ctx.createBufferSource());
    src.buffer = rouletteAudioBuffer(ctx, plan);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    const stop = () => {
      if (wheelSource !== src) return;
      wheelSource = null;
      src.stop();
    };
    src.addEventListener('ended', () => {
      if (wheelSource === src) wheelSource = null;
      src.disconnect();
      gain.disconnect();
    }, {once:true});
    wheelSource?.stop();
    wheelSource = src;
    const offset = plan.duration ? (performance.now() - clock) / 1000 : 0;
    src.start(0, Math.min(offset, src.buffer.duration));
    return stop;
  }
  return {
    init, play, rouletteSpin,
    set enabled(v) { enabled = v; if (!v) wheelSource?.stop(); },
    get enabled() { return enabled; },
  };
}

// ゲームごと・手ごとの音(元のアプリの盤・GameSounds の割り当てに合わせる)
function moveSound(id, m) {
  switch (id) {
    case "reversi": return ["STONE"];
    case "connect4": return ["DISC", { rate: 0.96 + (m % 3) * 0.03 }];
    case "gomoku": return ["GO"];
    case "go": return m >= 0 && m < 361 ? ["GO"] : null;
    case "shogi": case "gogo": return ["KOMA"];
    case "chess": return ["CHESS"];
    case "checkers": case "hex": case "hare": return ["WOOD", { rate: 1 + (m % 4) * 0.03 }];
    case "morris": return m >= 1000 ? ["TAKE"] : ["WOOD"];
    case "chinese": return ["PEG", { rate: 1 + (m % 5) * 0.03 }];
    case "mancala": return ["MARBLE"];
    case "dots": return ["PEN"];
    case "hitblow": return ["TILE"];
    case "yacht": return m < 100 ? ["DICE"] : ["SCRIBBLE"];
    case "ludo": return m === 0 ? ["DICE"] : m >= 99 ? null : ["WOOD"];
    case "backgammon": return m === 0 ? ["DICE"] : m === 999 ? null : ["WOOD"];
    case "memory": return ["CARD_FLIP"];
    case "uno": return m === 0 ? ["DEAL"] : m === 1 || m === 2 ? null : ["CARD"];
    case "hanafuda": return m === 2 ? ["SHUFFLE"] : m <= 1 ? null : ["HANA"];
    case "holdem": return m === 3 ? ["SHUFFLE"] : m === 0 ? ["DEAL"] : ["CHIP"];
    case "poker": return m >= 100 ? ["DEAL"] : ["CHIP"];
    case "roulette": return m === 2004 ? null : ["CHIP", { volume: .65 }];
    case "blackjack": return m >= 100 ? ["CHIP"] : ["CARD"];
    case "war": case "butanoshippo": return ["CARD_FLIP"];
    case "takoyaki": return [m < 10 ? "CARD_FLIP" : "CARD"];
    case "oldmaid": return [m === 100 ? "SHUFFLE" : "CARD"];
    case "hearts": case "ginrummy": case "vulture": return ["CARD"];
    case "goita": return m === 99 ? null : ["KOMA"];
    case "quarto": case "geister": return ["WOOD"];
    case "rummikub": return [m === 0 ? "DEAL" : "TILE"];
    case "pegsolitaire": return ["PEG"];
    // ソリティア: 山札をめくる(スパイダーは配る)・札を置く。やめる(1)は鳴らさない
    case "solitaire": { const c = m % 1000000; return c === 1 ? null : c === 0 ? ["CARD_FLIP"] : ["CARD"]; }
    case "spider": { const c = m % 1000000; return c === 1 ? null : c === 0 ? ["DEAL"] : ["CARD"]; }
    case "sevens": case "daifugo": return ["CARD"];
    default: return null;
  }
}
const SHUFFLE_GAMES = new Set(["hanafuda", "speed", "holdem", "uno", "solitaire", "daifugo", "sevens", "poker", "memory", "blackjack", "war", "takoyaki", "butanoshippo", "oldmaid", "hearts", "ginrummy", "vulture"]);
