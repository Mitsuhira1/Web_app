// 将棋のルール動画の台本の手を作る。CPU 上級(先手)と CPU 初級(後手)を対局させた一局(47 手で詰み)から場面を取り出す。
// 使い方: node tools/rule_video/shogi-plan.mjs   → shogi-steps.json
import fs from 'fs';
const core = await import(new URL('../../web/pc-firebase/core/asobi-pc-core.mjs', import.meta.url));
const OPTS = 'moveSeconds=0;timeoutRule=move';
const KN = { 1: '歩', 2: '香', 3: '桂', 4: '銀', 5: '金', 6: '角', 7: '飛', 8: '玉', 9: 'と', 10: '成香', 11: '成桂', 12: '成銀', 13: '馬', 14: '龍' };
const K = '一二三四五六七八九';
const sq = (i) => `${9 - (i % 9)}${K[Math.floor(i / 9)]}`;
const dec = (m) => ({ from: (m >> 1) >> 7, to: (m >> 1) & 127, pro: m & 1 });
const view = (h) => JSON.parse(core.viewJson(h, 0));
const note = (b, m) => { const { from, to, pro } = dec(m); if (from >= 81) return `${sq(to)}${KN[from - 81]}打`; return `${sq(to)}${KN[Math.abs(b.cells[from])]}${pro ? '成' : ''}(${sq(from)})`; };
// 一局(seed 2・上級 vs 初級・考える時間 300ms で作った手順。毎回同じになるよう、手の番号で持つ)
const GAME = JSON.parse(fs.readFileSync(new URL('./shogi-game.json', import.meta.url)));
// 手を「7六歩(7七)」のような書き方から探す
function find(h, text) { const v = view(h); const f = v.legal.find((m) => note(v.board, m) === text); if (f == null) throw new Error(`${text} が指せない: ${v.legal.map((m) => note(v.board, m)).join(' ')}`); return f; }
function replay(moves) { const h = core.newMatchNamed('shogi', OPTS, '1', '0', 1, 'あなた'); for (const m of moves) { if (!view(h).legal.includes(m)) throw new Error('指せない手 ' + m); core.playMove(h, m); } return h; }
const out = {};
const step = (n, prefix, plays) => {
  const h = replay(prefix); const human = [], cpu = [], order = [];
  for (const p of plays) { const v = view(h); const m = typeof p === 'number' ? p : find(h, p); const d = dec(m); (v.toMove === 0 ? human : cpu).push({ m, ...d, note: note(v.board, m) }); order.push(v.toMove); core.playMove(h, m); }
  out[n] = { prefix, who: prefix.map((_, k) => k % 2 === 0), human, cpu: cpu.map((x) => x.m), order, end: view(h).outcome };
  console.log(n, 'prefix', prefix.length, 'plays', [...human, ...cpu].map((x) => x.note).join(' '), out[n].end ? JSON.stringify(out[n].end) : '');
};
step(1, [], []);
step(2, [], ['7六歩(7七)', '3四歩(3三)']);
step(3, [], []);
step(4, GAME.slice(0, 22), [GAME[22]]);
step(5, GAME.slice(0, 26), [GAME[26], GAME[27]]);
step(6, GAME.slice(0, 34), [GAME[34]]);
step(7, GAME.slice(0, 44), [GAME[44], GAME[45], GAME[46]]);
fs.writeFileSync(new URL('./shogi-steps.json', import.meta.url), JSON.stringify(out));
