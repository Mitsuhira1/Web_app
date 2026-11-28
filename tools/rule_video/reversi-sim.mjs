// リバーシの一局を core で作り、録画の台本で使う手順(reversi-game.json)を探す。
// 使い方: node tools/rule_video/reversi-sim.mjs [seed上限]
// 手は単純な規則で選ぶ(録る局面を決めるための探索)。
import fs from 'fs';
const core = await import(new URL('../../web/pc-firebase/core/asobi-pc-core.mjs', import.meta.url));
const view = (h) => JSON.parse(core.viewJson(h, 0));
function dirsFlipped(cells, idx, color) {
  const opp = 3 - color; let n = 0;
  const r0 = idx >> 3, c0 = idx & 7;
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    let r = r0 + dr, c = c0 + dc, k = 0;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && cells[r * 8 + c] === opp) { r += dr; c += dc; k++; }
    if (k && r >= 0 && r < 8 && c >= 0 && c < 8 && cells[r * 8 + c] === color) n++;
  }
  return n;
}
const W = [100,-25,10,5,5,10,-25,100,-25,-40,-2,-2,-2,-2,-40,-25,10,-2,2,1,1,2,-2,10,5,-2,1,0,0,1,-2,5,5,-2,1,0,0,1,-2,5,10,-2,2,1,1,2,-2,10,-25,-40,-2,-2,-2,-2,-40,-25,100,-25,10,5,5,10,-25,100];
function pick(v, seed) {
  const legal = v.legal;
  if (legal.length === 1) return legal[0];
  const color = v.toMove + 1, cells = v.board.cells;
  let best = null, bs = -1e9;
  for (const m of legal) {
    if (m === 64) continue;
    const s = v.toMove === 0 ? dirsFlipped(cells, m, color) * 3 + W[m] : W[m] - dirsFlipped(cells, m, color) * 2;
    const sc = s + ((seed * 31 + m * 17) % 7) * 0.01;
    if (sc > bs) { bs = sc; best = m; }
  }
  return best ?? legal[0];
}
function play(seed) {
  const h = core.newMatchNamed('reversi', '', String(seed), '0', 1, 'あなた');
  const moves = [];
  for (let guard = 0; guard < 200; guard++) {
    const v = view(h);
    if (v.outcome) break;
    const m = pick(v, seed);
    moves.push({ m, seat: v.toMove, pass: m === 64 });
    core.playMove(h, m);
  }
  return { moves, end: view(h) };
}
const N = +(process.argv[2] || 300);
let best = null;
for (let s = 1; s <= N; s++) {
  const g = play(s);
  const passes = g.moves.filter((x) => x.pass).length;
  const sc = (passes ? 2 : 0) + (g.end.outcome ? 1 : 0);
  if (!best || sc > best.sc) best = { s, sc, passes, moves: g.moves, outcome: g.end.outcome, scores: g.end.scores };
  if (sc === 3) break;
}
console.log(JSON.stringify({ seed: best.s, passes: best.passes, len: best.moves.length, outcome: best.outcome, scores: best.scores, moves: best.moves.map((x) => (x.pass ? 'P' + x.seat : x.m + ':' + x.seat)).join(' ') }));
fs.writeFileSync(new URL('./reversi-game.json', import.meta.url), JSON.stringify({ seed: String(best.s), moves: best.moves }));
