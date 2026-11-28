// マンカラの規則(core の Mancala と同じ)。録画の手順を探す・誰の手かを調べるのに使う
function init(n = 4) { const p = Array(14).fill(n); p[6] = p[13] = 0; return { p, turn: 0, over: false, extra: false, cap: 0, last: -1 }; }
function legal(s) { if (s.over) return []; const b = s.turn ? 7 : 0; return [0,1,2,3,4,5].map(k => b + k).filter(i => s.p[i] > 0); }
function play(s, m) {
  const p = s.p.slice(), me = s.turn, my = me ? 13 : 6, opp = me ? 6 : 13; let n = p[m]; p[m] = 0; let i = m;
  const path = [];
  while (n > 0) { i = (i + 1) % 14; if (i === opp) continue; p[i]++; n--; path.push(i); }
  let cap = 0; const own = me ? i >= 7 && i <= 12 : i >= 0 && i <= 5;
  if (own && p[i] === 1 && p[12 - i] > 0) { cap = p[12 - i] + 1; p[my] += cap; p[i] = 0; p[12 - i] = 0; }
  const extra = i === my;
  const s0 = [0,1,2,3,4,5].reduce((a, k) => a + p[k], 0), s1 = [7,8,9,10,11,12].reduce((a, k) => a + p[k], 0);
  const over = s0 === 0 || s1 === 0;
  if (over) { for (let k = 0; k <= 5; k++) { p[6] += p[k]; p[k] = 0; } for (let k = 7; k <= 12; k++) { p[13] += p[k]; p[k] = 0; } }
  return { p, turn: extra && !over ? me : 1 - me, over, extra: extra && !over, cap, last: m, path, end: i };
}
module.exports = { init, legal, play };
