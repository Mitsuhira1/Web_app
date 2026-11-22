import assert from 'node:assert/strict';
import {
  BATTLESHIP_SPEC,
  BATTLESHIP_FLEET,
  shipCells,
  encodePlaceMove,
} from '../../web/pc-firebase/core/games/battleship.mjs';

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mockOpts = (o = {}) => ({
  it: (k, d) => (o[k] !== undefined ? parseInt(o[k], 10) : d),
  jt: (k, d) => (o[k] !== undefined ? String(o[k]) : d),
});
const rulesFor = (o) => BATTLESHIP_SPEC.makeRules(mockOpts(o));
const view = (s, me) => JSON.parse(s.__extraView(null, me, s));

// 固定配置: 席0は横向きに行0〜4、席1は縦向きに列5〜9
const LAYOUT0 = [[0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2], [3, 0, 0, 3], [4, 0, 0, 4]]; // [idx,dir,x,y]
const LAYOUT1 = [[0, 1, 5, 0], [1, 1, 6, 0], [2, 1, 7, 0], [3, 1, 8, 0], [4, 1, 9, 0]];
const CELLS1 = LAYOUT1.flatMap(([i, d, x, y]) => shipCells(i, d, x, y));

function placeLayout(rules, s, layout) {
  for (const [i, d, x, y] of layout) {
    const m = encodePlaceMove(i, d, x, y);
    assert.ok(rules.isLegal(s, m), `place ${m} should be legal`);
    s = rules.play(s, m);
  }
  return s;
}
function placedGame(opts) {
  const rules = rulesFor(opts);
  let s = rules.initial(makeRng(42));
  s = placeLayout(rules, s, LAYOUT0);
  assert.equal(s.turn, 1);
  s = placeLayout(rules, s, LAYOUT1);
  assert.equal(s.phase, 'battle');
  assert.equal(s.turn, 0);
  return { rules, s };
}
function shoot(rules, s, cell) {
  assert.ok(rules.isLegal(s, cell), `shot ${cell} by seat ${s.turn} should be legal`);
  return rules.play(s, cell);
}

console.log('1. Checking SPEC, shipCells, placement legality (overlap / out-of-board / noAdjacent)...');
{
  assert.equal(BATTLESHIP_SPEC.id, 'battleship');
  assert.equal(BATTLESHIP_SPEC.no, 51);
  assert.equal(BATTLESHIP_SPEC.name, 'バトルシップ');
  assert.equal(BATTLESHIP_SPEC.category, 'BOARD');
  assert.deepEqual(BATTLESHIP_FLEET, [5, 4, 3, 3, 2]);
  assert.equal(BATTLESHIP_SPEC.seatsFor(mockOpts()), 2);

  assert.deepEqual(shipCells(0, 0, 0, 0), [0, 1, 2, 3, 4]);
  assert.deepEqual(shipCells(0, 1, 0, 0), [0, 10, 20, 30, 40]);
  assert.deepEqual(shipCells(4, 0, 8, 9), [98, 99]);
  assert.deepEqual(shipCells(0, 0, 6, 0), [], 'out of board (horizontal)');
  assert.deepEqual(shipCells(0, 1, 0, 6), [], 'out of board (vertical)');
  assert.deepEqual(shipCells(9, 0, 0, 0), [], 'invalid ship index');

  const rules = rulesFor();
  let s = rules.initial(makeRng(1));
  assert.equal(s.phase, 'place');
  assert.equal(rules.toMove(s), 0);
  assert.ok(rules.isLegal(s, encodePlaceMove(0, 0, 0, 0)));
  assert.ok(!rules.isLegal(s, encodePlaceMove(0, 0, 6, 0)), 'out-of-board move must be illegal');
  s = rules.play(s, encodePlaceMove(0, 0, 0, 0));
  assert.ok(!rules.isLegal(s, encodePlaceMove(1, 0, 0, 0)), 'overlap must be illegal');
  assert.ok(!rules.isLegal(s, encodePlaceMove(0, 0, 5, 5)), 'already-placed ship must be illegal');
  assert.ok(rules.isLegal(s, encodePlaceMove(1, 0, 0, 1)), 'adjacent is allowed when noAdjacent=off');

  // noAdjacent=ortho: 上下左右の隣接は禁止、離れていれば可
  const rOrtho = rulesFor({ noAdjacent: 'ortho' });
  let so = rOrtho.initial(makeRng(1));
  so = rOrtho.play(so, encodePlaceMove(0, 0, 0, 0));
  assert.ok(!rOrtho.isLegal(so, encodePlaceMove(1, 0, 0, 1)), 'ortho-adjacent must be illegal');
  assert.ok(rOrtho.isLegal(so, encodePlaceMove(1, 0, 0, 2)), 'one row gap is legal');

  // noAdjacent=all: 斜めも禁止。ortho では合法な斜め隣接配置が all では非合法
  const diagMove = encodePlaceMove(4, 0, 5, 1); // (5,1) は (4,0) の斜め
  assert.ok(rOrtho.isLegal(so, diagMove), 'diagonal is legal under ortho');
  const rAll = rulesFor({ noAdjacent: 'all' });
  let sa = rAll.initial(makeRng(1));
  sa = rAll.play(sa, encodePlaceMove(0, 0, 0, 0));
  assert.ok(!rAll.isLegal(sa, diagMove), 'diagonal must be illegal under all');
  console.log('   OK: placement rules verified.');
}

console.log('2. Checking view masking (placement & battle, player & spectator)...');
{
  const rules = rulesFor();
  let s = rules.initial(makeRng(7));
  s = placeLayout(rules, s, LAYOUT0);

  // 配置中: 席1の view に席0の艦位置が無いこと
  const v1 = view(s, 1);
  assert.equal(v1.phase, 'place');
  assert.ok(v1.enemyShips.every((sh) => sh.cells === null && sh.length === null), 'enemy ship cells/length must be masked during placement');
  assert.ok(v1.enemyBoard.every((c) => c === 'unknown'));
  assert.equal(v1.lastAction.cells, undefined, 'opponent placement coordinates must not leak via lastAction');
  assert.equal(v1.lastAction.x, undefined);
  const vSpecPlace = view(s, -1);
  assert.equal(vSpecPlace.ownBoard, null);
  assert.ok(vSpecPlace.publicShips.flat().every((sh) => sh.cells === null), 'spectator must not see fleet positions during placement');

  assert.equal(view(s, 0).placedCounts[0], 5);
  console.log('   OK: placement masking verified (battle masking in block 2b).');
}

console.log('2b. Checking battle view masking in detail...');
{
  let { rules, s } = placedGame();
  // 席0: ヒット (5) → 手番は席1へ。席1: ミス (99 は席0の水) → 席0へ。席0: ミス (0)
  s = shoot(rules, s, 5);
  assert.equal(s.lastAction.hit, true);
  s = shoot(rules, s, 99);
  assert.equal(s.lastAction.hit, false);
  s = shoot(rules, s, 0);
  assert.equal(s.lastAction.hit, false);

  const v0 = view(s, 0);
  assert.equal(v0.enemyBoard[5], 'hit');
  assert.equal(v0.enemyBoard[0], 'miss');
  assert.equal(v0.enemyBoard.filter((c) => c === 'ship').length, 0, 'no sunk ship yet: enemyBoard must contain no ship cells');
  assert.equal(v0.enemyBoard.filter((c) => c === 'unknown').length, 98);
  assert.ok(v0.enemyShips.every((sh) => sh.cells === null && sh.length === null && !sh.sunk));
  assert.equal(v0.ownBoard[0], 'ship', 'own ship cell not yet shot');
  assert.equal(v0.ownBoard[99], 'miss', 'own board shows foe miss');

  const v1 = view(s, 1);
  assert.equal(v1.ownBoard[5], 'hit', 'defender sees the hit on own board');
  assert.ok(v1.enemyShips.every((sh) => sh.cells === null), 'defender must not see attacker fleet positions');
  assert.equal(v1.enemyBoard[99], 'miss');
  assert.equal(v1.enemyBoard.filter((c) => c === 'ship' || c === 'hit').length, 0);

  const vSpec = view(s, -1);
  assert.equal(vSpec.ownBoard, null);
  assert.equal(vSpec.enemyBoard, null);
  assert.ok(vSpec.publicShips.flat().every((sh) => sh.cells === null && sh.length === null), 'spectator sees no fleet positions before any sinking');
  console.log('   OK: battle masking verified.');
}

console.log('3. Checking hit / sunk / win flow, salvo and chain...');
{
  let { rules, s } = placedGame();
  // 長さ2の艦 (席1, idx4: マス 9,19) を撃沈する。間は席1が水 (90番台) を撃ってターンを返す
  const foeWater = [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 80, 81, 82, 83, 84, 85, 86];
  let wi = 0;
  const foeMiss = (st) => shoot(rules, st, foeWater[wi++]);
  s = shoot(rules, s, 9);
  assert.equal(s.lastAction.hit, true);
  assert.equal(s.lastAction.sunk, false);
  assert.equal(s.turn, 1, 'standard: one shot per turn');
  s = foeMiss(s);
  s = shoot(rules, s, 19);
  assert.equal(s.lastAction.sunk, true);
  assert.equal(s.lastAction.sunkLength, 2);
  assert.deepEqual(Array.from(rules.scores(s)), [1, 0]);

  // 撃沈した艦は相手 view と観戦者 view で公開される。他は引き続き秘匿
  const v0 = view(s, 0);
  assert.equal(v0.enemyBoard[9], 'ship');
  assert.equal(v0.enemyBoard[19], 'ship');
  assert.equal(v0.enemyShips[4].sunk, true);
  assert.equal(v0.enemyShips[4].length, 2);
  assert.deepEqual(v0.enemyShips[4].cells, [9, 19]);
  assert.ok(v0.enemyShips.slice(0, 4).every((sh) => sh.cells === null));
  const vSpec = view(s, -1);
  assert.deepEqual(vSpec.publicShips[1][4].cells, [9, 19]);
  assert.ok(vSpec.publicShips[1].slice(0, 4).every((sh) => sh.cells === null));
  assert.ok(vSpec.publicShips[0].every((sh) => sh.cells === null));

  // 残りの艦をすべて撃ち、勝利まで: 手番を見て、席0なら目標マス、席1なら水マスを撃つ
  const rest = CELLS1.filter((c) => c !== 9 && c !== 19);
  let idx = 0;
  let guard = 0;
  while (!rules.outcome(s) && guard++ < 500) {
    if (s.turn === 0) s = shoot(rules, s, rest[idx++]);
    else s = shoot(rules, s, foeWater[wi++]);
  }
  assert.ok(rules.outcome(s), 'game must finish');
  assert.equal(rules.outcome(s).ys_1, 0);
  assert.equal(s.phase, 'done');
  assert.deepEqual(Array.from(rules.scores(s)), [5, 0]);
  assert.equal(rules.legalMoves(s).length, 0);
  console.log('   OK: hit/sunk/win flow verified.');
}

console.log('3b. Checking salvo and chain turn rules...');
{
  // salvo: 手番開始時に shotsLeft=5、ミスで消費し、尽きたら交代
  let g = placedGame({ salvo: 'on' });
  assert.equal(g.s.shotsLeft, 5);
  let s = g.s;
  for (const c of [0, 1, 2]) { // 席1盤面の水 (艦は列5〜9) ではなく行0列0〜2は水
    s = shoot(g.rules, s, c + 20); // 20,21,22 は水
    assert.equal(s.turn, 0, 'salvo: turn continues while shotsLeft remains');
  }
  assert.equal(s.shotsLeft, 2);
  s = shoot(g.rules, s, 23);
  s = shoot(g.rules, s, 24);
  assert.equal(s.turn, 1, 'salvo: turn passes after all shots used');
  assert.equal(s.shotsLeft, 5, 'next player gets shots equal to own alive ships');

  // chain (salvo off): ヒットで追加発射、ミスで交代
  g = placedGame({ chain: 'on' });
  s = g.s;
  s = shoot(g.rules, s, 5); // ヒット
  assert.equal(s.turn, 0, 'chain: hit grants another shot');
  s = shoot(g.rules, s, 0); // ミス
  assert.equal(s.turn, 1, 'chain: miss passes the turn');

  // salvo+chain: ヒットでは shotsLeft が減らない
  g = placedGame({ salvo: 'on', chain: 'on' });
  s = g.s;
  s = shoot(g.rules, s, 5); // ヒット
  assert.equal(s.turn, 0);
  assert.equal(s.shotsLeft, 5, 'salvo+chain: hit does not consume shotsLeft');
  s = shoot(g.rules, s, 0); // ミス
  assert.equal(s.shotsLeft, 4, 'salvo+chain: miss consumes one shot');
  assert.equal(s.turn, 0);
  console.log('   OK: salvo / chain verified.');
}

console.log('4. Checking brain-vs-brain full games (standard / salvo / chain)...');
{
  for (const [label, opts] of [['standard', {}], ['salvo', { salvo: 'on' }], ['chain', { chain: 'on' }], ['salvo+chain', { salvo: 'on', chain: 'on' }]]) {
    const rules = rulesFor(opts);
    const rng = makeRng(20251122);
    let s = rules.initial(rng);
    let guard = 0;
    while (!rules.outcome(s) && guard++ < 3000) {
      const seat = rules.toMove(s);
      assert.ok(seat === 0 || seat === 1);
      const m = BATTLESHIP_SPEC.brain.choose(rules, s, seat, guard % 2 ? 1 : 2, rng);
      assert.ok(rules.isLegal(s, m), `${label}: brain move ${m} must be legal (phase=${s.phase})`);
      s = rules.play(s, m);
    }
    assert.ok(rules.outcome(s), `${label}: game must reach an outcome`);
    assert.ok(rules.outcome(s).ys_1 === 0 || rules.outcome(s).ys_1 === 1);
    const sc = rules.scores(s);
    assert.equal(sc[rules.outcome(s).ys_1], 5, `${label}: winner sank all 5 ships`);
    console.log(`   OK: ${label} finished in ${guard} moves, winner seat ${rules.outcome(s).ys_1}.`);
  }
}

console.log('PASS: battleship core tests all passed.');
