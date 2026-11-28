// 大富豪の規則を core で動かす小道具(録画の手順を探す・確かめる)
export const core = await import(new URL('../../web/pc-firebase/core/asobi-pc-core.mjs', import.meta.url));
export const OPTS = 'bomber=off;eight=off;five=off;jback=off;lock=off;moveSeconds=0;players=4;revolution=on;rounds=3;seven=off;spade3=off;stairs=on;ten=off;timeoutRule=move';
const SU = ['♠', '♥', '♦', '♣'];
export const name = (id) => id === 52 ? 'JK' : SU[Math.floor(id / 13)] + (['2','3','4','5','6','7','8','9','10','J','Q','K','A'][id % 13]);
export const rank = (id) => id === 52 ? 99 : (id % 13 + 12) % 13; // 3=0 … A=11, 2=12
export function game(seed) { return core.newMatchNamed('daifugo', OPTS, String(seed), '0', 1, 'あなた'); }
export function st(h) { const v = JSON.parse(core.viewJson(h, 0)); const tm = v.toMove; const vv = tm >= 0 ? JSON.parse(core.viewJson(h, tm)) : v; return { v, tm, t: v.board.tbl, moves: tm >= 0 ? vv.board.tbl.moves : [], hand: (s) => JSON.parse(core.viewJson(h, s)).board.zones[1].cards.map((c) => c.id), field: v.board.zones[0].cards.map((c) => c.id), info: v.board.info, buttons: vv.board.buttons, legal: vv.legal }; }
export function clone(h) { return core.restoreMatch(core.matchRecord(h)); }
// 手番の人の、出せる手と札
export function movesCards(h) {
  const s = st(h); const out = [];
  for (const m of s.legal) { const h2 = clone(h); const before = st(h2).hand(s.tm); core.playMove(h2, m); const after = st(h2).hand(s.tm); out.push([m, before.filter((c) => !after.includes(c))]); core.dropMatch(h2); }
  return out;
}
