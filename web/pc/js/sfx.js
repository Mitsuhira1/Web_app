// 効果音。元のアプリと同じ「計算で作る音」(Kotlin の Synth)と、本物の録音(碁石=KaTrain、将棋の駒=ShogiHome。どちらも MIT License)を鳴らす。
const SAMPLES = {
  GO: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  STONE: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  FLIP: ["go_stone_1", "go_stone_2", "go_stone_3", "go_stone_4", "go_stone_5"],
  KOMA: ["koma_piece"],
};
const GAIN = { FLIP: 0.7 }; // 裏返すだけ 0.7 倍(元のアプリと同じ)

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
    if (!enabled || !ctx || !name) return;
    const list = bufs[name];
    if (!list || !list.length) return;
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = Math.min(2, Math.max(0.5, rate));
    const g = ctx.createGain();
    g.gain.value = Math.min(1, Math.max(0, volume * (vol[name] ?? 1) * (GAIN[name] ?? 1) * (S.set.master / 100) * (S.set.sfxVol / 100)));
    src.connect(g).connect(ctx.destination);
    src.start();
  }

  return { init, play, set enabled(v) { enabled = v; }, get enabled() { return enabled; } };
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
    case "blackjack": return m >= 100 ? ["CHIP"] : ["CARD"];
    case "sevens": case "daifugo": return ["CARD"];
    default: return null;
  }
}
const SHUFFLE_GAMES = new Set(["hanafuda", "speed", "holdem", "uno", "solitaire", "daifugo", "sevens", "poker", "memory", "blackjack"]);
