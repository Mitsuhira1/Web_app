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
// 効果音。元のアプリと同じ「計算で作る音」(Kotlin の Synth)と、本物の録音(碁石=KaTrain、将棋の駒=ShogiHome。どちらも MIT License。ルーレットの球が転がる音=Freesound の InspectorJ)を鳴らす。
const SAMPLES = {
  GO: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  STONE: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  FLIP: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  KOMA: ["koma_piece"],
};
const GAIN = { FLIP: 0.7 }; // 裏返すだけ 0.7 倍(元のアプリと同じ)

// Render the rolling contact and its short impact responses on one audio clock.
// A single tracked source can be cancelled even after the browser suspends a tab.
function rouletteAudioBuffer(ctx, {duration, impacts, panAt}, recordedRoll = false) {
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
  // 録音の転がる音を鳴らす時(rouletteSpin の rollBuffer)は、ここでは転がる音を作らず、当たる音だけを作る。
  let grain = 0, low = 0, surface = 0, pulse = 0, resonance = 0, previous = 0;
  let pan = 0, panStep = 0, untilGrain = 0;
  for (let i = 0; i < (recordedRoll ? 0 : finish); i++) {
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

// チンチロリン専用。小さな樹脂のサイコロが釉薬のある器に当たる音を、
// 短い接触ノイズと不調和な共鳴で作る。長い正弦波の「電子音」にしない。
// 4種類の微差をキャッシュし、実際に衝突したフレームにだけ鳴らす。
function chinchiroImpactBuffer(ctx, kind, variant = 0) {
  const rate = 24000;
  const materials = {
    ceramic: { duration: .13, contact: .0022, body: .008, modes: [[923,.022,.15],[1571,.031,.10],[2717,.018,.075],[4259,.011,.036]], tone: .42 },
    dice: { duration: .075, contact: .0015, body: .004, modes: [[1427,.006,.11],[2861,.004,.07],[4387,.003,.025]], tone: .60 },
    wood: { duration: .11, contact: .003, body: .012, modes: [[347,.012,.14],[719,.009,.10],[1381,.006,.065]], tone: .25 },
  };
  const m = materials[kind] || materials.ceramic;
  const buffer = ctx.createBuffer(1, Math.ceil(m.duration * rate), rate);
  const data = buffer.getChannelData(0);
  let seed = (3811 + variant * 7919 + kind.length * 131) >>> 0;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const tune = 1 + (variant - 1.5) * .019;
  const modes = m.modes.map(([hz, decay, weight]) => {
    const r = Math.exp(-1 / (rate * decay));
    const angle = 2 * Math.PI * hz * tune / rate;
    return { a: 2 * r * Math.cos(angle), b: r * r, coupling: Math.min(1, Math.sin(angle) / .28), weight, y: 0, previous: 0 };
  });
  let low = 0, smooth = 0, dc = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const grit = noise();
    // 接触の丸みを残し、耳につく超高域・不自然なバスの強調を避ける。
    low += .12 * (grit - low);
    smooth += m.tone * (grit - smooth);
    const contact = smooth * Math.exp(-t / m.contact);
    const excitation = (grit * .5 + .5) * Math.exp(-t / .00055);
    let sample = .58 * contact + .36 * low * Math.exp(-t / m.body);
    for (const mode of modes) {
      const y = mode.a * mode.y - mode.b * mode.previous + excitation * .19 * mode.coupling;
      mode.previous = mode.y; mode.y = y;
      sample += y * mode.weight;
    }
    dc += .012 * (sample - dc);
    const attack = Math.min(1, i / 5), release = Math.min(1, (data.length - i) / 80);
    data[i] = (sample - dc) * attack * release * .83;
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

  // ルーレットの球が縁を転がる音: 録音「Marble, Rolling on Wood, A.wav」by InspectorJ(www.jshaw.co.uk)Freesound.org
  // (licenses.html に表記)。録音をそのまま(同じ速さ・高さ・ステレオで)鳴らす。読めない時は計算で作る音。
  let rollBuffer = null, rollStart = 0;
  async function loadRoll(c) {
    try {
      const res = await fetch('audio/marble_rolling_wood.mp3');
      const b = await c.decodeAudioData(await res.arrayBuffer());
      // 録音の頭の無音を飛ばす(音が始まる 10ms 前から)
      const d = b.getChannelData(0);
      let first = 0;
      while (first < d.length && Math.abs(d[first]) < .01) first++;
      rollStart = Math.max(0, first / b.sampleRate - .01);
      rollBuffer = b;
    } catch { /* 読めない時は計算で作る音を使う */ }
  }
  async function init() {
    const list = JSON.parse(await call("soundList"));
    const rate = await call("soundRate");
    const c = ensure();
    if (!c) return;
    loadRoll(c);
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

  const chinchiroBuffers = new Map(), chinchiroVoices = new Set();
  let chinchiroVoice = 0, lastChinchiroHit = -Infinity;
  function chinchiroImpact({kind = 'ceramic', strength = .5, pan = 0, rate = 1} = {}) {
    if (!enabled || !S.set.sound || !ctx || ctx.state !== 'running' || !transientAudio.allowed()) return;
    const level = Math.min(1, Math.max(0, Number(strength) || 0));
    const volume = S.set.master / 100 * S.set.sfxVol / 100;
    const now = performance.now();
    // 同時衝突を後でまとめて再生しない。小さな接触を落として強い衝突を優先する。
    if (level < .025 || volume <= 0 || now - lastChinchiroHit < 12 || chinchiroVoices.size >= 8) return;
    lastChinchiroHit = now;
    const material = ['ceramic', 'dice', 'wood'].includes(kind) ? kind : 'ceramic';
    const variant = chinchiroVoice++ % 4, key = `${material}:${variant}`;
    if (!chinchiroBuffers.has(key)) chinchiroBuffers.set(key, chinchiroImpactBuffer(ctx, material, variant));
    const src = transientAudio.track(ctx.createBufferSource());
    src.buffer = chinchiroBuffers.get(key);
    src.playbackRate.value = Math.min(1.18, Math.max(.86, Number(rate) || 1));
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, volume * .78 * Math.pow(level, .72));
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.min(.6, Math.max(-.6, (Number(pan) || 0) * .6));
      src.connect(gain).connect(panner).connect(ctx.destination);
    } else src.connect(gain).connect(ctx.destination);
    chinchiroVoices.add(src);
    src.addEventListener('ended', () => {
      chinchiroVoices.delete(src);
      src.disconnect(); gain.disconnect(); panner?.disconnect();
    }, {once:true});
    src.start();
    return () => { try { src.stop(); } catch {} };
  }

  let wheelSource = null, wheelRoll = null;
  function rouletteSpin(plan) {
    if (!enabled || !S.set.sound || !ctx || ctx.state !== 'running' || !transientAudio.allowed()) return;
    const volume = S.set.master / 100 * S.set.sfxVol / 100;
    if (volume <= 0) return;
    const clock = performance.now();
    const src = transientAudio.track(ctx.createBufferSource());
    const recorded = !!(rollBuffer && plan.duration);
    src.buffer = rouletteAudioBuffer(ctx, plan, recorded);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    // 縁を転がる音(録音)は、同じ時計で別に鳴らし、球がひし形に当たったら計算の音と同じ速さで消していく
    let roll = null, rollGain = null;
    if (recorded) {
      roll = transientAudio.track(ctx.createBufferSource());
      roll.buffer = rollBuffer;
      rollGain = ctx.createGain();
      roll.connect(rollGain).connect(ctx.destination);
    }
    const halt = node => { try { node?.stop(); } catch {} };
    const stop = () => {
      if (wheelSource !== src) return;
      wheelSource = null;
      src.stop();
      halt(roll);
    };
    src.addEventListener('ended', () => {
      if (wheelSource === src) wheelSource = null;
      src.disconnect();
      gain.disconnect();
    }, {once:true});
    halt(wheelRoll);
    wheelSource?.stop();
    wheelSource = src;
    wheelRoll = roll;
    const offset = plan.duration ? (performance.now() - clock) / 1000 : 0;
    src.start(0, Math.min(offset, src.buffer.duration));
    if (roll) {
      const now = ctx.currentTime;
      const drop = plan.impacts.find(hit => hit.kind === 'deflector');
      const dropIn = Math.max(0, (drop ? drop.at : plan.duration * .55) / 1000 - offset);
      const fade = plan.duration / 1000 / 11;
      rollGain.gain.setValueAtTime(volume, now);
      rollGain.gain.setValueAtTime(volume, now + dropIn);
      rollGain.gain.setTargetAtTime(0, now + dropIn, fade);
      roll.addEventListener('ended', () => {
        if (wheelRoll === roll) wheelRoll = null;
        roll.disconnect();
        rollGain.disconnect();
      }, {once:true});
      roll.start(now, Math.min(rollStart + offset, rollBuffer.duration));
      roll.stop(now + dropIn + fade * 7);
    }
    return stop;
  }
  return {
    init, play, rouletteSpin, chinchiroImpact,
    set enabled(v) { enabled = v; if (!v) { wheelSource?.stop(); try { wheelRoll?.stop(); } catch {} for (const src of chinchiroVoices) { try { src.stop(); } catch {} } } },
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
    case "roulette": return m % 1000000 === 2004 ? null : ["CHIP", { volume: .65 }]; // 手は 席 × 1000000 + 手
    case "blackjack": return m >= 100 ? ["CHIP"] : ["CARD"];
    case "war": case "butanoshippo": return ["CARD_FLIP"];
    case "takoyaki": return [m < 10 ? "CARD_FLIP" : "CARD"];
    case "oldmaid": return [m === 100 ? "SHUFFLE" : "CARD"];
    case "hearts": case "ginrummy": case "vulture": return ["CARD"];
    case "goita": return m === 99 ? null : ["KOMA"];
    case "quarto": case "geister": return ["WOOD"];
    case "rummikub": return [m === 0 ? "DEAL" : "TILE"];
    case "pegsolitaire": return ["PEG"];
    case "coyote": return m === 0 ? ["CARD_FLIP"] : ["CARD"];
    case "skull": return m >= 200 && m < 300 ? ["CARD_FLIP"] : m === 0 ? null : ["CARD"];
    case "liarsdice": return m < 100 ? ["CARD_FLIP"] : ["TILE"];
    case "incangold": return m === 1 ? ["MARBLE"] : ["CARD"];
    case "take6": return ["CARD"];
    case "blokus": return m === 999999 ? null : ["TILE"];
    case "quoridor": return m >= 100 ? ["WOOD"] : ["STONE"];
    case "battleship": return null;
    case "chinchiro": return null; // 衝突アニメーションから専用の器・サイコロ音を鳴らす
    // ソリティア: 山札をめくる(スパイダーは配る)・札を置く。やめる(1)は鳴らさない
    case "solitaire": { const c = m % 1000000; return c === 1 ? null : c === 0 ? ["CARD_FLIP"] : ["CARD"]; }
    case "spider": { const c = m % 1000000; return c === 1 ? null : c === 0 ? ["DEAL"] : ["CARD"]; }
    case "sevens": case "daifugo": return ["CARD"];
    default: return null;
  }
}
const SHUFFLE_GAMES = new Set(["hanafuda", "speed", "holdem", "uno", "solitaire", "daifugo", "sevens", "poker", "memory", "blackjack", "war", "takoyaki", "butanoshippo", "oldmaid", "hearts", "ginrummy", "vulture"]);
