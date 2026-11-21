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

// ルーレットの音を 1 本の音にまとめて作る(止める時は 1 つの音源を止めるだけ)。
// 実際の回転盤の音の流れに合わせる:
//  1) 縁(ボールトラック)を速く転がる「シャーッ」。1 周ごとに近づく・遠ざかるうねりがあり、遅くなるほど低く・小さくなる
//  2) 縁を離れて坂を転がり落ちる「ゴロゴロ」(低く、ざらつく)
//  3) ひし形(ディフレクター)に当たる硬い「カッ」
//  4) 回る盤の金属の仕切り(フレット)を跳ねる、不ぞろいな「カチッ・カチカチ」(音の高さは毎回少しずつ違い、打つ間は詰まっていく)
//  5) ポケットの中で小さく「カラカラ…」と鳴って止まり、あとは盤と一緒に回る小さな「ゴー」が消えていく
// 打つ音は、決まった高さの正弦波ではなく、雑音を短く共鳴させて作る(ピーンという電子音にならないように)。
function rouletteAudioBuffer(ctx, {duration, impacts, panAt, poseAt}) {
  const rate = 32000;
  const seconds = duration / 1000;
  const tail = .75;
  const buffer = ctx.createBuffer(2, Math.ceil((seconds + tail) * rate), rate);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  const total = left.length;
  let seed = 1 + Math.round(duration * 41) + impacts.length * 977;
  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }
  const rand = () => (noise() + 1) / 2;
  const put = (i, v, pan) => {
    if (i < 0 || i >= total) return;
    left[i] += v * (.8 - .3 * pan);
    right[i] += v * (.8 + .3 * pan);
  };
  // 共鳴する帯域フィルター(状態変数型)。f: 中心の高さ、q: 小さいほど鋭い
  function svf(f, q) {
    let low = 0, band = 0;
    const k = 2 * Math.sin(Math.PI * Math.min(f, rate / 6) / rate);
    return x => { low += k * band; const high = x - low - q * band; band += k * high; return band; };
  }

  const drop = impacts.find(hit => hit.kind === 'deflector');
  const dropAt = drop ? drop.at / 1000 : 0;
  const settle = impacts.filter(hit => hit.kind === 'settle').pop();
  const settleAt = settle ? settle.at / 1000 : seconds;

  // ---- 転がる音(縁 → 坂 → 盤の上)と、盤が回る音
  if (seconds > 0 && poseAt) {
    const hop = 64;
    let prevOrbit = poseAt(0).orbit, speed = 0, maxSpeed = 0, pan = 0;
    const speeds = [];
    for (let i = 0; i <= total; i += hop) {
      const t = Math.min(1, (i + hop) / (seconds * rate));
      const pose = poseAt(t);
      speeds.push([pose, Math.abs(pose.orbit - prevOrbit) * rate / hop]);
      prevOrbit = pose.orbit;
    }
    for (const [, v] of speeds) maxSpeed = Math.max(maxSpeed, v);
    const rollHi = svf(2600, .9), rollMid = svf(900, 1.1), rumble = svf(170, .7), rotorBand = svf(240, 1.2);
    let lp = 0, grainEnv = 0, untilGrain = 0, smooth = 0, panTarget = 0;
    for (let i = 0; i < total; i++) {
      const time = i / rate;
      const [pose, raw] = speeds[Math.min(speeds.length - 1, Math.floor(i / hop))];
      speed += (raw / maxSpeed - speed) * .002;
      const onRim = time < dropAt;
      if (i % hop === 0) panTarget = .4 * Math.sin(pose.orbit * Math.PI / 180);
      pan += (panTarget - pan) * .004;
      const x = noise();
      // 縁: 速さに合わせて明るさと大きさが変わる。手前(6 時の方向)を通る時に少し大きく聞こえる
      const near = 1 + .28 * Math.cos((pose.orbit - 180) * Math.PI / 180);
      const descent = onRim ? Math.max(0, (179.5 - pose.radius) / 14.5) : 0;
      lp += (.08 + .32 * speed) * (x - lp);
      let roll = 0;
      if (onRim) {
        const bright = rollHi(x) * (.25 + .9 * speed) + rollMid(x) * .7 + lp * .5;
        // 坂を落ちる間は、低いゴロゴロが増える(ボールが斜めの面でぶれる)
        if (--untilGrain <= 0) { grainEnv = .5 + rand(); untilGrain = rate / (35 + 60 * speed) * (.6 + .8 * rand()); }
        grainEnv *= .992;
        const rough = rumble(x) * (1.6 + 2.4 * descent) * (.6 + .5 * grainEnv * descent);
        const fadeIn = Math.min(1, time / .06);
        const intoDrop = Math.min(1, (dropAt - time) / .03);
        roll = fadeIn * intoDrop * near * (.10 + .26 * speed) * (bright * (1 - .45 * descent) + rough);
      } else if (time < settleAt + tail) {
        // 盤の上を転がる・跳ねる間の小さなざらつき。止まった後は盤と一緒に回る低い音だけ
        // ひし形に当たった直後は、坂の続きで少し転がる音が残り、だんだん弱くなる
        const after = Math.max(0, time - settleAt);
        const cone = .9 * Math.exp(-(time - dropAt) * 3.2);
        roll = (.045 + cone * .09) * Math.exp(-after * 4) * (rumble(x) * 2.4 + rollMid(x) * cone * .6 + lp * .3) * Math.min(1, (time - dropAt) / .02 + .35);
      }
      // 盤(ローター)の回る音: とても小さい低い「ゴー」。最後はゆっくり消える
      const rotorFade = Math.min(1, time / .25) * Math.min(1, Math.max(0, (total / rate - time) / tail));
      const rotor = .022 * rotorFade * rotorBand(x) * (1 + .15 * Math.sin(2 * Math.PI * 1.3 * time));
      smooth += (roll + rotor - smooth) * .55;
      put(i, smooth, pan);
    }
  }

  // ---- 打つ音: 雑音を短く共鳴させる。材質ごとに高さの範囲と響く長さを変え、毎回ずらす
  const materials = {
    // 樹脂の球がひし形の金具に当たる: 硬く高い「カッ」+ 台の木の「コッ」
    deflector: {modes: [[3100, 5600, .006, 1], [1500, 2300, .009, .55], [190, 260, .02, .9]], level: 1.05},
    // 金属の仕切りに当たる: 明るく短い「カチッ」
    fret:      {modes: [[3600, 6400, .004, 1], [1900, 2900, .006, .5], [320, 460, .012, .55]], level: .9},
    // ポケットの底に落ちる: こもった「コトッ」
    settle:    {modes: [[1500, 2600, .004, .55], [520, 820, .008, 1], [230, 330, .014, .7]], level: 1.9},
  };
  function strike(at, kind, strength, pan) {
    const m = materials[kind];
    const start = Math.round(at * rate);
    const filters = m.modes.map(([lo, hi, decay, weight]) => [svf(lo + (hi - lo) * rand(), .06 + .05 * rand()), decay, weight]);
    const length = Math.ceil(rate * .06);
    for (let j = 0; j < length; j++) {
      const time = j / rate;
      // 当たった瞬間の鋭い雑音(0.4ms ほど)で共鳴を叩く
      const hitNoise = noise() * Math.exp(-time / .0004);
      let v = hitNoise * .35;
      for (const [f, decay, weight] of filters) v += weight * f(hitNoise) * Math.exp(-time / decay) * 2.4;
      put(start + j, v * m.level * strength * .3, pan);
    }
  }
  for (const hit of impacts) {
    const at = hit.at / 1000, pan = (hit.pan || 0) * .45, s = hit.strength;
    strike(at, hit.kind, s, pan);
    if (hit.kind === 'fret') {
      // 仕切りに当たったすぐ後に、隣の仕切りやポケットの壁に当たる小さな音が 1〜2 回続く(不ぞろいに)
      const n = 1 + (rand() < .55 ? 1 : 0);
      let dt = 0;
      for (let k = 0; k < n; k++) {
        dt += .018 + .05 * rand();
        strike(at + dt, rand() < .5 ? 'fret' : 'settle', s * (.38 - .12 * k) * (.7 + .5 * rand()), pan);
      }
    }
  }
  // ポケットの中で小さく「カラカラ…」と鳴って止まる(間が詰まりながら弱くなる)
  if (settle && seconds > 0) {
    let dt = 0, gap = .055, s = .2;
    for (let k = 0; k < 6; k++) {
      dt += gap * (.85 + .3 * rand());
      strike(settleAt + dt, 'settle', s, (settle.pan || 0) * .45);
      gap *= .74; s *= .66;
    }
  }
  // 全体の大きさをそろえる(割れないように、いちばん大きい所を .6 に)
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak > .6) { const g = .6 / peak; for (let i = 0; i < total; i++) { left[i] *= g; right[i] *= g; } }
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
