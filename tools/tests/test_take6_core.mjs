import assert from 'node:assert/strict';
import { TAKE6_SPEC, bullHeads, rowBullHeads } from '../../web/pc-firebase/core/games/take6.mjs';

// 決定論的 rng (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRules(over = {}) {
  const vals = { players: '2', professional: 'off', endMode: 'single', ...over };
  const opts = {
    it: (k, d) => (k === 'players' ? parseInt(vals.players, 10) : d),
    jt: (k, d) => (vals[k] !== undefined ? vals[k] : d),
  };
  return TAKE6_SPEC.makeRules(opts);
}

// テスト用に局面を組み立てる (2人・手札1枚ずつ)
function craftedState(rules, { hands, rows }) {
  const s = rules.initial(mulberry32(42));
  s.hands = hands.map((h) => h.slice());
  s.rows = rows.map((r) => r.slice());
  s.choices = new Array(s.n).fill(-1);
  s.queue = [];
  s.phase = 'choose';
  s.turn = 0;
  s.turnNo = 1;
  s.roundPenalties = new Array(s.n).fill(0);
  s.penalties = new Array(s.n).fill(0);
  s.lastReveal = null;
  return s;
}

console.log('1. bullHeads...');
{
  assert.equal(bullHeads(55), 7);
  assert.equal(bullHeads(11), 5);
  assert.equal(bullHeads(22), 5);
  assert.equal(bullHeads(99), 5);
  assert.equal(bullHeads(10), 3);
  assert.equal(bullHeads(100), 3);
  assert.equal(bullHeads(40), 3);
  assert.equal(bullHeads(5), 2);
  assert.equal(bullHeads(15), 2);
  assert.equal(bullHeads(95), 2);
  assert.equal(bullHeads(1), 1);
  assert.equal(bullHeads(7), 1);
  assert.equal(bullHeads(104), 1);
  assert.equal(rowBullHeads([1, 2, 3, 4, 5]), 6);
  console.log('   OK');
}

console.log('2. 配置ルール (最も近い列)...');
{
  const rules = makeRules();
  let s = craftedState(rules, { hands: [[15], [100]], rows: [[9], [19], [29], [39]] });
  s = rules.play(s, 15);
  assert.equal(rules.toMove(s), 1);
  s = rules.play(s, 100);
  assert.deepEqual(s.rows[0], [9, 15], '15は末尾9の列へ');
  assert.deepEqual(s.rows[3], [39, 100], '100は末尾39の列へ');
  assert.ok(rules.outcome(s), '手札が尽きたら終了 (single)');
  console.log('   OK');
}

console.log('3. 6枚目の引き取り...');
{
  const rules = makeRules();
  let s = craftedState(rules, { hands: [[6], [100]], rows: [[1, 2, 3, 4, 5], [50], [60], [70]] });
  s = rules.play(s, 6);
  s = rules.play(s, 100);
  assert.deepEqual(s.rows[0], [6], '6枚目の人は列を引き取り、自分のカードが先頭');
  assert.equal(s.penalties[0], 6, '引き取った5枚の牛マーク 1+1+1+1+2=6');
  assert.equal(s.roundPenalties[0], 6);
  console.log('   OK');
}

console.log('4. 小さいカードの列選択フェーズと view マスク...');
{
  const rules = makeRules();
  let s = craftedState(rules, { hands: [[1], [50]], rows: [[10], [20], [30], [40]] });
  s = rules.play(s, 1);
  // 席1視点: 席0は decided だが選択カードは見えない
  const v1 = JSON.parse(s.__extraView(null, 1, s));
  assert.equal(v1.decided[0], true);
  assert.equal(v1.decided[1], false);
  assert.equal(v1.myChoice, -1);
  assert.equal(v1.choices, undefined);
  assert.deepEqual(v1.myHand, [50]);
  s = rules.play(s, 50);
  // 解決がカード1で中断し、席0の列選択フェーズになる
  assert.equal(s.phase, 'rowPick');
  assert.equal(rules.toMove(s), 0);
  assert.deepEqual(Array.from(rules.legalMoves(s)), [0, 1, 2, 3]);
  // 席0が列2 (カード30) を選んで引き取る
  s = rules.play(s, 2);
  assert.deepEqual(s.rows[2], [1]);
  assert.equal(s.penalties[0], bullHeads(30), '列2の牛マークが失点');
  assert.deepEqual(s.rows[3], [40, 50], '残りのカード50は解決が続いて末尾40の列へ');
  assert.ok(rules.outcome(s));
  console.log('   OK');
}

console.log('5. brain 同士の対戦 (最後まで outcome が出る)...');
{
  const configs = [
    { players: '2', professional: 'off', endMode: 'single' },
    { players: '6', professional: 'off', endMode: 'single' },
    { players: '2', professional: 'on', endMode: 'single' },
    { players: '6', professional: 'on', endMode: 'single' },
    { players: '4', professional: 'off', endMode: 'to66' },
    { players: '6', professional: 'on', endMode: 'to66' },
  ];
  for (const cfg of configs) {
    const rules = makeRules(cfg);
    const rng = mulberry32(1234);
    let s = rules.initial(rng);
    assert.equal(s.hands.length, parseInt(cfg.players, 10));
    assert.ok(s.hands.every((h) => h.length === 10));
    assert.equal(s.rows.length, 4);
    if (cfg.professional === 'on') {
      const maxCard = parseInt(cfg.players, 10) * 10 + 4;
      const all = [...s.hands.flat(), ...s.rows.flat()];
      assert.ok(all.every((c) => c >= 1 && c <= maxCard), 'professional: 使用カード制限');
      assert.equal(new Set(all).size, all.length, 'カードに重複なし');
    }
    let steps = 0;
    while (!rules.outcome(s) && steps < 50000) {
      const seat = rules.toMove(s);
      assert.ok(seat >= 0, '手番の席がある');
      const move = TAKE6_SPEC.brain.choose(rules, s, seat, 2, rng);
      assert.ok(rules.isLegal(s, move), `合法手であること (move=${move}, phase=${s.phase})`);
      s = rules.play(s, move);
      steps++;
    }
    const oc = rules.outcome(s);
    assert.ok(oc, `outcome が出ること (${JSON.stringify(cfg)}, steps=${steps})`);
    const scores = Array.from(rules.scores(s));
    const min = Math.min(...scores);
    if (scores.filter((x) => x === min).length === 1) assert.equal(oc.ys_1, scores.indexOf(min));
    else assert.equal(oc.ys_1, -1);
    if (cfg.endMode === 'to66') assert.ok(Math.max(...scores) > 66, 'to66: 誰かが66を超えて終了');
    console.log(`   OK: ${JSON.stringify(cfg)} steps=${steps} scores=${scores} winner=${oc.ys_1}`);
  }
}

console.log('ALL PASS');
