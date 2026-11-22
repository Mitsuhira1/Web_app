import assert from 'node:assert/strict';
import {
  QUORIDOR_SPEC,
  QUORIDOR_WALL_BASE,
  decodeQuoridorMove,
  quoridorPathLength,
} from '../../web/pc-firebase/core/games/quoridor.mjs';

// SPEC.makeRules を直接使う (カタログ登録には依存しない)
// opts モック: it=整数、jt=文字列
function optsFor(players) {
  return {
    it: (key, def) => (key === 'players' ? players : def),
    jt: (key, def) => def,
  };
}

// 決定論的 rng ([0,1) を返す関数)
function makeRng(seed = 12345) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

const cell = (x, y) => y * 9 + x;
const wallMove = (x, y, vertical) => QUORIDOR_WALL_BASE + (y * 8 + x) * 2 + (vertical ? 1 : 0);

// 状態を直接組み立てるヘルパー (initial を spread し、必要な部分だけ書き換える)
function craftState(rules, overrides) {
  const base = rules.initial(makeRng(1));
  return { ...base, turn: 0, lastAction: null, winner: -1, reason: '', ...overrides };
}

function emptyWalls() {
  return Array.from({ length: 8 }, () => Array(8).fill(false));
}

console.log('1. Checking SPEC, initial placement & wall counts...');
{
  assert.equal(QUORIDOR_SPEC.id, 'quoridor');
  assert.equal(QUORIDOR_SPEC.no, 50);
  assert.equal(QUORIDOR_SPEC.name, 'コリドール');
  assert.equal(QUORIDOR_SPEC.category, 'BOARD');
  assert.equal(QUORIDOR_SPEC.seatsFor(optsFor(3)), 3);
  assert.ok(QUORIDOR_SPEC.sections.length >= 3);

  // 手の符号化の往復
  assert.deepEqual(decodeQuoridorMove(cell(4, 7)), { type: 'move', x: 4, y: 7 });
  assert.deepEqual(decodeQuoridorMove(wallMove(2, 3, false)), { type: 'wall', x: 2, y: 3, vertical: false, orientation: 'h' });
  assert.deepEqual(decodeQuoridorMove(wallMove(2, 3, true)), { type: 'wall', x: 2, y: 3, vertical: true, orientation: 'v' });
  assert.equal(wallMove(7, 7, true), 227, '壁コードの最大は 100 + 63*2 + 1 = 227');

  const rules2 = QUORIDOR_SPEC.makeRules(optsFor(2));
  assert.equal(rules2.playerCount, 2);
  const s2 = rules2.initial(makeRng());
  assert.deepEqual(Array.from(s2.pawns), [cell(4, 8), cell(4, 0)], '2人: 席0=(4,8), 席1=(4,0)');
  assert.deepEqual(Array.from(s2.wallsLeft), [10, 10], '2人: 壁は各10枚');
  assert.equal(rules2.toMove(s2), 0);
  assert.equal(rules2.outcome(s2), null);
  assert.deepEqual(Array.from(rules2.scores(s2)), [8, 8], '初期の最短経路は互いに8');
  assert.equal(quoridorPathLength(s2, 0), 8);

  const rules4 = QUORIDOR_SPEC.makeRules(optsFor(4));
  const s4 = rules4.initial(makeRng());
  assert.deepEqual(Array.from(s4.pawns), [cell(4, 8), cell(4, 0), cell(0, 4), cell(8, 4)], '4人: 下・上・左・右の中央');
  assert.deepEqual(Array.from(s4.wallsLeft), [5, 5, 5, 5], '4人: 壁は各5枚');

  const rules3 = QUORIDOR_SPEC.makeRules(optsFor(3));
  const s3 = rules3.initial(makeRng());
  assert.deepEqual(Array.from(s3.pawns), [cell(4, 8), cell(4, 0), cell(0, 4)], '3人: 席0,1,2を使う');
  assert.deepEqual(Array.from(s3.wallsLeft), [5, 5, 5], '3人: 壁は各5枚 (本実装の拡張)');

  // view (全公開)
  const view = JSON.parse(s2.__extraView(null, 0, s2));
  assert.equal(view.kind, 'quoridor');
  assert.deepEqual(view.pawns, [{ x: 4, y: 8 }, { x: 4, y: 0 }]);
  assert.deepEqual(view.wallsLeft, [10, 10]);
  assert.deepEqual(view.hWalls, []);
  assert.deepEqual(view.vWalls, []);
  console.log('   OK: SPEC, starts, wall counts (2p=10, 3p/4p=5), view.');
}

console.log('2. Checking pawn moves & wall-blocked moves...');
{
  const rules = QUORIDOR_SPEC.makeRules(optsFor(2));
  let s = rules.initial(makeRng());
  const legal0 = Array.from(rules.legalMoves(s));
  assert.ok(legal0.includes(cell(4, 7)), '上へ進める');
  assert.ok(legal0.includes(cell(3, 8)) && legal0.includes(cell(5, 8)), '左右へ進める');
  assert.ok(!legal0.includes(cell(4, 8)), 'その場には進めない');

  // 席0が自分の正面 (行7と8の境界、列4・5) に横壁を置く
  const wall = wallMove(4, 7, false);
  assert.ok(rules.isLegal(s, wall), '正面の横壁は置ける (迂回路が残る)');
  s = rules.play(s, wall);
  assert.equal(s.wallsLeft[0], 9);
  assert.equal(s.hWalls[7][4], true);
  // play は非破壊であること
  const sInit = rules.initial(makeRng());
  assert.equal(sInit.hWalls[7][4], false);

  // 席1が適当に下へ進む
  assert.ok(rules.isLegal(s, cell(4, 1)));
  s = rules.play(s, cell(4, 1));
  assert.equal(rules.toMove(s), 0);

  // 席0の上への移動は壁で遮られて非合法になっている
  assert.ok(!rules.isLegal(s, cell(4, 7)), '壁で遮られた移動は非合法');
  assert.ok(!Array.from(rules.legalMoves(s)).includes(cell(4, 7)));
  assert.ok(rules.isLegal(s, cell(3, 8)), '横への移動は影響なし');
  console.log('   OK: pawn moves, wall placement, blocked move rejected.');
}

console.log('3. Checking jump & diagonal moves over an opponent pawn...');
{
  const rules = QUORIDOR_SPEC.makeRules(optsFor(2));

  // 直進ジャンプ: 席0 (4,4) の上に席1 (4,3) → (4,2) へ飛び越える
  const sJump = craftState(rules, { pawns: [cell(4, 4), cell(4, 3)] });
  const legalJump = Array.from(rules.legalMoves(sJump));
  assert.ok(legalJump.includes(cell(4, 2)), '相手コマを飛び越えられる');
  assert.ok(!legalJump.includes(cell(4, 3)), '相手コマのあるマス自体には止まれない');
  const afterJump = rules.play(sJump, cell(4, 2));
  assert.equal(afterJump.pawns[0], cell(4, 2));
  assert.equal(sJump.pawns[0], cell(4, 4), 'play は元の状態を壊さない');

  // 斜め移動: 席1 (4,0) の先は盤外なので、相手の左右 (3,0)/(5,0) へ斜めに進める
  const sDiag = craftState(rules, { pawns: [cell(4, 1), cell(4, 0)] });
  const legalDiag = Array.from(rules.legalMoves(sDiag));
  assert.ok(legalDiag.includes(cell(3, 0)), 'ジャンプ先が盤外なら斜め (左) へ進める');
  assert.ok(legalDiag.includes(cell(5, 0)), 'ジャンプ先が盤外なら斜め (右) へ進める');
  assert.ok(!legalDiag.includes(cell(4, 0)), '相手コマのあるマスには止まれない');

  // 斜め移動も壁で遮られる: (4,0) から (3,0) の境界に縦壁がある局面
  const vWalls = emptyWalls();
  vWalls[0][3] = true; // 列3と4の境界、行0・1 → (4,0)↔(3,0) を遮る
  const sDiagWall = craftState(rules, { pawns: [cell(4, 1), cell(4, 0)], vWalls });
  const legalDiagWall = Array.from(rules.legalMoves(sDiagWall));
  assert.ok(!legalDiagWall.includes(cell(3, 0)), '壁で遮られた斜め移動は非合法');
  assert.ok(legalDiagWall.includes(cell(5, 0)), '反対側の斜め移動は可能');
  console.log('   OK: straight jump, diagonal sidestep, wall-blocked diagonal.');
}

console.log('4. Checking wall legality (sealing off, overlap, crossing)...');
{
  const rules = QUORIDOR_SPEC.makeRules(optsFor(2));

  // 経路を完全に塞ぐ壁: 席0 (4,4) の上・左・右を既存の壁で塞ぎ、最後に下を塞ぐ壁を置こうとする
  const hWalls = emptyWalls();
  const vWalls = emptyWalls();
  hWalls[3][3] = true; // 上を遮る (列3・4)
  vWalls[3][3] = true; // 左を遮る (行3・4, 列3と4の境界)
  vWalls[3][4] = true; // 右を遮る (行3・4, 列4と5の境界)
  const sTrap = craftState(rules, { pawns: [cell(4, 4), cell(4, 0)], hWalls, vWalls });
  assert.equal(quoridorPathLength(sTrap, 0) >= 0, true, '下が開いている間は経路がある');
  const sealing = wallMove(4, 4, false); // 下 (行4と5の境界、列4・5) を塞ぐ横壁
  assert.ok(!rules.isLegal(sTrap, sealing), '全員の経路を塞ぐ壁は非合法');

  // 重なり・交差
  const h2 = emptyWalls();
  h2[2][2] = true;
  const sWall = craftState(rules, { hWalls: h2 });
  assert.ok(!rules.isLegal(sWall, wallMove(2, 2, false)), '同じ場所への重なりは非合法');
  assert.ok(!rules.isLegal(sWall, wallMove(3, 2, false)), '横に続く重なりは非合法');
  assert.ok(!rules.isLegal(sWall, wallMove(1, 2, false)), '横に続く重なり (逆側) は非合法');
  assert.ok(!rules.isLegal(sWall, wallMove(2, 2, true)), '交差する壁は非合法');
  assert.ok(rules.isLegal(sWall, wallMove(4, 2, false)), '離れた場所の壁は合法');

  // 壁を使い切ったら置けない
  const sNoWalls = craftState(rules, { wallsLeft: [0, 10] });
  assert.ok(!rules.isLegal(sNoWalls, wallMove(0, 0, false)), '残り0枚では壁を置けない');
  assert.ok(Array.from(rules.legalMoves(sNoWalls)).every((m) => m < QUORIDOR_WALL_BASE), '合法手はコマ移動のみ');
  console.log('   OK: sealing wall, overlap, crossing, and no-walls-left rejected.');
}

console.log('5. Running brain-vs-brain playouts (2 & 4 players)...');
{
  for (const [players, level] of [[2, 1], [2, 2], [4, 1], [4, 2]]) {
    const rules = QUORIDOR_SPEC.makeRules(optsFor(players));
    const rng = makeRng(9000 + players * 10 + level);
    let s = rules.initial(rng);
    let steps = 0;
    while (!rules.outcome(s) && steps < 2000) {
      const seat = rules.toMove(s);
      assert.ok(seat >= 0, 'toMove must be a seat while playing');
      const m = QUORIDOR_SPEC.brain.choose(rules, s, seat, level, rng);
      assert.ok(rules.isLegal(s, m), `brain move ${m} must be legal (players=${players}, level=${level}, step=${steps})`);
      s = rules.play(s, m);
      steps++;
    }
    const out = rules.outcome(s);
    assert.ok(out, `playout must finish (players=${players}, level=${level}, steps=${steps})`);
    assert.ok(out.ys_1 >= 0 && out.ys_1 < players, 'winner must be a valid seat');
    const wp = s.pawns[out.ys_1];
    assert.equal(quoridorPathLength(s, out.ys_1), 0, 'winner pawn is on its goal');
    assert.equal(wp, s.pawns[out.ys_1]);
    console.log(`   PASS [players=${players}] (level=${level}): ${steps} steps -> winner=${out.ys_1} (${out.zs_1})`);
  }
}

console.log('ALL QUORIDOR CORE TESTS PASSED!');
