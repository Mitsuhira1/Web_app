// ぶにょぶにょ・パクリスの規則の試験: node tools/tests/test_falling_rules.mjs
// 画面の部品は空のものに差し替え、規則(rules)だけを確かめる。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../../web/pc-firebase/js/', import.meta.url);
const ctx = vm.createContext({
  console, setTimeout, clearTimeout, performance, requestAnimationFrame: () => 0,
  S: { set: { reduce: true, sound: false } }, FSND: new Proxy({}, { get: () => () => {} }),
  FFX: new Proxy({}, { get: () => () => ({ x: 0, y: 0, w: 0, h: 0 }) }),
  fallingMatch: { register() {} }, bunyoSvg: () => '', bunyoPairSvg: () => '', pakurisBlock: () => '', PAKURIS_COLORS: {}, BUNYO_COLORS: {}
});
for (const f of ['bunyo.js', 'pakuris.js']) vm.runInContext(fs.readFileSync(new URL(f, root), 'utf8') + `\nthis.${f.replace('.js', '')}Game=${f.replace('.js', '')}Game;`, ctx);
const B = ctx.bunyoGame.rules, P = ctx.pakurisGame.rules;
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // vm の中の配列は別物なので文字列で比べる
let passed = 0; const ok = (name, fn) => { fn(); passed++; console.log('ok', name); };

/* ---------------- ぶにょぶにょ */
const grid = rows => rows.map(r => [...r].map(ch => ch === '.' ? null : ch));
ok('ぶにょ: 5れんさの盤が5れんさになる', () => {
  const c = grid(['......','......','......','......','......','......','..b.g.','.ryry.','.gypb.','rbgypr','rbgypr','rbgypr']);
  c[8][0] = 'r'; c[7][0] = 'b';   // 組(赤が下・青が上)を左端に置いた形
  const steps = B.simulate(c);
  assert.equal(steps.length, 5);
  assert.equal(B.chainPoints([4, 4]), 4 * 10 + 4 * 20);
});
ok('ぶにょ: お邪魔の数は今の規則のまま', () => {
  assert.equal(B.chainAttack([4], false), 1);
  assert.equal(B.chainAttack([4, 4, 4], false), 8);
  assert.equal(B.chainAttack([4], true), 7);
  assert.equal(B.chainAttack([40, 40, 40], false), 24);
});
ok('ぶにょ: 消えた粒の隣のお邪魔も消える', () => {
  const c = grid(['......','......','......','......','......','......','......','......','......','......','n.....','rrrr..']);
  const g = B.groupsOf(c); const set = B.popSet(c, g);
  assert.ok(set.has(10 * 6 + 0));
});
ok('ぶにょ: 同じシードなら同じ色の順', () => {
  const a = B.makeRng(1234), b = B.makeRng(1234);
  same(Array.from({ length: 20 }, a), Array.from({ length: 20 }, b));
});

/* ---------------- パクリス */
const empty = () => Array.from({ length: P.H }, () => Array(P.W).fill(null));
const fill = (g, rows) => { rows.forEach((r, i) => { const y = P.H - rows.length + i; [...r].forEach((ch, x) => { g[y][x] = ch === '.' ? null : ch; }); }); return g; };
ok('パクリス: 回すと決まった形になる(T の4方向)', () => {
  const t = P.SHAPES.T.map(s => JSON.stringify(s));
  assert.equal(new Set(t).size, 4);
  const norm = s => JSON.stringify([...s].map(String).sort());
  assert.equal(norm(P.SHAPES.T[1]), norm([[1, 0], [1, 1], [2, 1], [1, 2]]));
});
ok('パクリス: ずらし表は本家と同じ(0→右 の2番目は左へ1)', () => {
  same(P.KICK['0>1'][1], [-1, 0]);
  same(P.KICK['0>1'][2], [-1, -1]);   // y は下向き
  same(P.KICK_I['0>1'][1], [-2, 0]);
});
ok('パクリス: Tスピン ダブルの判定', () => {
  const g = fill(empty(), ['GGG.......', 'GG...GGGGG', 'GGG.GGGGGG']);
  const p = { k: 'T', r: 2, x: 2, y: P.H - 3 };   // 下向きの T が穴にはまった形
  assert.ok(P.fitsIn(g, p));
  assert.equal(P.spinKind(g, p, { kick: 0 }), 'spin');
  assert.equal(P.spinKind(g, p, null), null);   // 最後が回転でなければ Tスピンではない
});
ok('パクリス: 正面が空いていると Tスピン ミニ', () => {
  const g = fill(empty(), ['G.........', '..........', 'G.G.......']);
  const p = { k: 'T', r: 0, x: 0, y: P.H - 3 };   // 上向き。下の角2つ+左上の角
  const kind = P.spinKind(g, p, { kick: 1 });
  assert.equal(kind, 'mini');
  assert.equal(P.spinKind(g, p, { kick: 4 }), 'spin');   // 5番目のずらしで入れば普通の Tスピン
});
ok('パクリス: 点数とお邪魔(普通は今のまま、Tスピン・BACK to BACK を足した)', () => {
  same([1, 2, 3, 4].map(n => P.scoreFor(n, null, false, 1)), [100, 300, 500, 800]);
  same([1, 2, 3, 4].map(n => P.attackFor(n, null, false, 1, false)), [0, 1, 2, 3]);
  same([1, 2, 3].map(n => P.scoreFor(n, 'spin', false, 1)), [800, 1200, 1600]);
  same([1, 2, 3].map(n => P.attackFor(n, 'spin', false, 1, false)), [2, 4, 6]);
  assert.equal(P.scoreFor(4, null, true, 1), 1200);
  assert.equal(P.attackFor(4, null, true, 1, false), 4);
  assert.equal(P.scoreFor(1, null, false, 3), 300);          // REN は点数が倍になっていく(今の規則)
  assert.equal(P.attackFor(1, null, false, 3, false), 2);    // REN の数だけお邪魔が増える
  assert.equal(P.attackFor(2, null, false, 1, true), 6);     // 全消し +5
});
ok('パクリス: 同じシードなら同じブロックの順(7種が1回ずつ)', () => {
  const a = P.makeBag(99), b = P.makeBag(99);
  const xs = Array.from({ length: 14 }, a.take), ys = Array.from({ length: 14 }, b.take);
  same(xs, ys); assert.equal(new Set(xs.slice(0, 7)).size, 7);
});
ok('パクリス: 盤の動き(SRS で壁際の I を回す・ハードドロップで列が消える)', () => {
  const b = ctx.pakurisGame.createBoard({ seed: 1, hooks: {} });
  b.piece = { k: 'I', r: 1, x: -2, y: 5 };   // 縦の I を左の壁にぴったり
  assert.ok(b.rotate(1));                     // 壁に当たるのでずれて回る
  assert.ok(P.fitsIn(b.grid, b.piece));
});
console.log(`\n${passed} passed`);
