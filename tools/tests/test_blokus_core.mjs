import assert from 'node:assert/strict';
import {
  BLOKUS_SPEC,
  BLOKUS_PIECES,
  BLOKUS_MOVE_PASS,
  orientationsFor,
  decodeBlokusMove,
} from '../../web/pc-firebase/core/games/blokus.mjs';

function makeOpts(map = {}) {
  return {
    it: (k, d) => (map[k] != null ? Number(map[k]) : d),
    jt: (k, d) => (map[k] != null ? String(map[k]) : d),
  };
}

// 決定論的 rng (mulberry32)。rng() で 0..1 を返す関数形式。
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function encode(pieceIdx, oriIdx, x, y, size) {
  return (((pieceIdx * 8) + oriIdx) * size + y) * size + x;
}

function viewOf(rules, s, me = 0) {
  return JSON.parse(s.__extraView(rules, me, s));
}

function cellsOf(move, size) {
  const d = decodeBlokusMove(move, size);
  const cells = orientationsFor(d.pieceIdx)[d.oriIdx];
  return { d, abs: cells.map(([dx, dy]) => [d.x + dx, d.y + dy]) };
}

console.log('1. Checking piece definitions & orientations...');
{
  assert.equal(BLOKUS_SPEC.id, 'blokus');
  assert.equal(BLOKUS_SPEC.no, 49);
  assert.equal(BLOKUS_PIECES.length, 21, 'ピースは21種');
  const total = BLOKUS_PIECES.reduce((sum, p) => sum + p.length, 0);
  assert.equal(total, 89, '全ピースのマス数合計は89');
  const bySize = new Map();
  for (const p of BLOKUS_PIECES) bySize.set(p.length, (bySize.get(p.length) || 0) + 1);
  assert.deepEqual([...bySize.entries()].sort((a, b) => a[0] - b[0]), [[1, 1], [2, 1], [3, 2], [4, 5], [5, 12]]);

  // 向き生成: セル数が元のピースと一致し、正規化され、重複がないこと
  for (let i = 0; i < BLOKUS_PIECES.length; i++) {
    const oris = orientationsFor(i);
    assert.ok(oris.length >= 1 && oris.length <= 8);
    const keys = new Set(oris.map((o) => JSON.stringify(o)));
    assert.equal(keys.size, oris.length, `piece ${i}: 向きに重複がある`);
    for (const o of oris) {
      assert.equal(o.length, BLOKUS_PIECES[i].length);
      assert.equal(Math.min(...o.map((c) => c[0])), 0);
      assert.equal(Math.min(...o.map((c) => c[1])), 0);
    }
  }
  assert.equal(orientationsFor(0).length, 1, '1マスは1向き');
  assert.equal(orientationsFor(1).length, 2, 'ドミノは2向き');
  assert.equal(orientationsFor(5).length, 1, '四角は1向き');
  assert.equal(orientationsFor(18).length, 1, '十字は1向き');
  assert.equal(orientationsFor(10).length, 2, '5直線は2向き');

  // 符号化・デコードの往復
  const mv = encode(20, 3, 7, 9, 20);
  assert.deepEqual(decodeBlokusMove(mv, 20), { pass: false, pieceIdx: 20, oriIdx: 3, x: 7, y: 9 });
  assert.deepEqual(decodeBlokusMove(BLOKUS_MOVE_PASS, 20), { pass: true });
  console.log('   OK: 21 pieces / 89 cells / orientations / move encoding verified.');
}

console.log('2. Checking first-move corner rule & corner/edge contact rules...');
{
  const rules = BLOKUS_SPEC.makeRules(makeOpts({ players: 2, board: '20' }));
  assert.equal(rules.playerCount, 2);
  let s = rules.initial(makeRng(1));
  assert.equal(rules.toMove(s), 0);

  // 初手: 色0の合法手はすべて左上の角 (0,0) を含む
  const legal0 = Array.from(rules.legalMoves(s));
  assert.ok(legal0.length > 0 && !legal0.includes(BLOKUS_MOVE_PASS));
  for (const mv of legal0) {
    const { abs } = cellsOf(mv, 20);
    assert.ok(abs.some(([x, y]) => x === 0 && y === 0), `初手は角を含まなければならない: move=${mv}`);
  }
  // 角を含まない配置は違法 (四角ピースを (5,5) に置く)
  assert.equal(rules.isLegal(s, encode(5, 0, 5, 5, 20)), false);

  // 色0: 四角ピース (idx5) を角に置く -> セル (0,0)(1,0)(0,1)(1,1)
  const m0 = encode(5, 0, 0, 0, 20);
  assert.equal(rules.isLegal(s, m0), true);
  s = rules.play(s, m0);
  assert.equal(rules.toMove(s), 1);
  // 使ったピースは二度と置けない (色0の番で確認するため色1にも置かせる)
  const m1 = encode(5, 0, 18, 0, 20); // 色1: 四角を右上の角 (19,0) を含む位置に
  assert.equal(rules.isLegal(s, m1), true);
  s = rules.play(s, m1);
  assert.equal(rules.toMove(s), 0);
  assert.equal(rules.isLegal(s, encode(5, 0, 2, 2, 20)), false, '使用済みピースは置けない');

  const v = viewOf(rules, s, 0);
  assert.equal(v.kind, 'blokus');
  assert.equal(v.board[0], 0);
  assert.equal(v.board[19], 1);
  assert.equal(v.currentColor, 0);
  assert.equal(v.currentSeat, 0);
  assert.equal(v.remainingCells[0], 85);
  assert.equal(v.remaining[0].length, 20);

  // 辺接触は違法: ドミノを (2,0)-(3,0) に置くと色0の (1,0) と辺で接する
  assert.equal(rules.isLegal(s, encode(1, 0, 2, 0, 20)), false, '辺で接する配置は違法');
  // 角接触のみは合法: ドミノを (2,2)-(3,2) に置くと (1,1) と角で接し、辺では接しない
  const mDiag = encode(1, 0, 2, 2, 20);
  assert.equal(rules.isLegal(s, mDiag), true, '角で接する配置は合法');
  s = rules.play(s, mDiag);
  const v2 = viewOf(rules, s, 0);
  assert.equal(v2.board[2 * 20 + 2], 0);
  assert.equal(v2.lastAction.type, 'place');
  console.log('   OK: corner start, edge-contact ban, corner-contact rule, piece reuse ban verified.');
}

console.log('3. Running brain-vs-brain playouts (20x20 2P, duo 2P)...');
function playout(optsMap, seed, label) {
  const rules = BLOKUS_SPEC.makeRules(makeOpts(optsMap));
  const rng = makeRng(seed);
  let s = rules.initial(rng);
  let steps = 0;
  while (!rules.outcome(s) && steps < 300) {
    const seat = rules.toMove(s);
    assert.ok(seat >= 0, `${label}: toMove が不正`);
    const mv = BLOKUS_SPEC.brain.choose(rules, s, seat, steps % 2 === 0 ? 1 : 2, rng);
    assert.ok(rules.isLegal(s, mv), `${label}: brain が違法手 ${mv} を選んだ (step ${steps})`);
    s = rules.play(s, mv);
    steps++;
  }
  const out = rules.outcome(s);
  assert.ok(out, `${label}: 対戦が終了しなかった (${steps} steps)`);
  const sc = Array.from(rules.scores(s));
  assert.equal(sc.length, rules.playerCount);
  if (out.ys_1 >= 0) {
    assert.equal(sc[out.ys_1], Math.min(...sc), `${label}: 勝者は最小スコアでなければならない`);
  }
  const v = viewOf(rules, s, 0);
  assert.equal(v.finished, true);
  console.log(`   PASS [${label}]: ${steps} moves -> winner=${out.ys_1} scores=${sc.join(',')} (${out.zs_1})`);
  return { rules, s, steps };
}

{
  const t0 = Date.now();
  playout({ players: 2, board: '20' }, 42, '20x20 / 2人');
  playout({ players: 4, board: '20' }, 7, '20x20 / 4人 (greedy)');
  const duo = playout({ players: 2, board: 'duo' }, 99, 'duo 14x14 / 2人');
  // duo: 2席で4色、色ごとの残りが view に出ること
  const v = viewOf(duo.rules, duo.s, 0);
  assert.equal(v.boardSize, 14);
  assert.equal(v.colorCount, 4);
  assert.deepEqual(v.seatOfColor, [0, 1, 0, 1]);
  assert.equal(v.remaining.length, 4);
  console.log(`   OK: all playouts finished in ${Date.now() - t0}ms.`);
}

console.log('ALL BLOKUS CORE TESTS PASSED!');
