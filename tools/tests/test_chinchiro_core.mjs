import assert from 'node:assert/strict';
import {
  CHINCHIRO_SPEC,
  CHINCHIRO_MOVE_ROLL,
  evaluateChinchiro,
  settleChinchiro,
} from '../../web/pc-firebase/core/games/chinchiro.mjs';

function makeOpts(cfg = {}) {
  return {
    it: (k, d) => (cfg[k] !== undefined ? cfg[k] : d),
    jt: (k, d) => (cfg[k] !== undefined ? String(cfg[k]) : d),
  };
}
function makeRules(cfg = {}) {
  return CHINCHIRO_SPEC.makeRules(makeOpts(cfg));
}
// initial(rng) は rngFloat を1回だけ使うので、種は「0〜1の定数を返す関数」で決める
function newState(rules, seedVal) {
  return rules.initial(() => seedVal);
}
function viewOf(s, me = 0) {
  return JSON.parse(s.__extraView(null, me, s));
}
function playAll(rules, s, maxSteps = 10000) {
  let steps = 0;
  while (!rules.outcome(s)) {
    const m = CHINCHIRO_SPEC.brain.choose(rules, s, rules.toMove(s), 1, () => 0.5);
    assert.equal(m, CHINCHIRO_MOVE_ROLL);
    s = rules.play(s, m);
    steps++;
    assert.ok(steps < maxSteps, 'must finish within steps');
  }
  return s;
}

console.log('1. Checking evaluateChinchiro (all hands & ordering)...');
{
  const pin = evaluateChinchiro([1, 1, 1]);
  assert.equal(pin.kind, 'pinzoro');
  assert.equal(pin.mult, 5);
  const ara5 = evaluateChinchiro([5, 5, 5]);
  assert.equal(ara5.kind, 'arashi');
  assert.equal(ara5.mult, 3);
  assert.equal(ara5.point, 5);
  const ara2 = evaluateChinchiro([2, 2, 2]);
  const shi = evaluateChinchiro([6, 4, 5]);
  assert.equal(shi.kind, 'shigoro');
  assert.equal(shi.mult, 2);
  const n6 = evaluateChinchiro([3, 3, 6]);
  assert.equal(n6.kind, 'normal');
  assert.equal(n6.point, 6);
  const n1 = evaluateChinchiro([1, 4, 4]);
  assert.equal(n1.kind, 'normal');
  assert.equal(n1.point, 1);
  const menashi = evaluateChinchiro([2, 3, 6]);
  assert.equal(menashi.kind, 'menashi');
  const hifumi = evaluateChinchiro([3, 1, 2]);
  assert.equal(hifumi.kind, 'hifumi');
  assert.equal(hifumi.mult, 2);
  // 強弱順序: ピンゾロ > アラシ(6) > アラシ(2) > シゴロ > 通常6 > 通常1 > 目なし > ヒフミ
  assert.ok(pin.rank > evaluateChinchiro([6, 6, 6]).rank);
  assert.ok(evaluateChinchiro([6, 6, 6]).rank > ara2.rank);
  assert.ok(ara2.rank > shi.rank);
  assert.ok(shi.rank > n6.rank);
  assert.ok(n6.rank > n1.rank);
  assert.ok(n1.rank > menashi.rank);
  assert.ok(menashi.rank > hifumi.rank);
  console.log('   OK: all hands and rank ordering verified.');
}

console.log('2. Checking reroll (max 3 attempts, settle on a hand)...');
{
  // 目なしで始まる種を探す
  let foundMenashi = false;
  let foundHand = false;
  for (let i = 0; i < 500 && !(foundMenashi && foundHand); i++) {
    const rules = makeRules({ players: 3 });
    const s0 = newState(rules, i / 500);
    const v0 = viewOf(s0);
    assert.equal(v0.kind, 'chinchiro');
    assert.equal(v0.turn, 0); // 親から
    assert.equal(v0.banker, 0);
    const s1 = rules.play(s0, CHINCHIRO_MOVE_ROLL);
    const v1 = viewOf(s1);
    if (v1.results[0] === null) {
      // 目なし → 同じ振り手のまま振り直し
      foundMenashi = true;
      assert.equal(v1.turn, 0);
      assert.equal(v1.attempts, 1);
      // 親が確定するまで振り続けても最大3回で確定する
      let s = s1;
      let rolls = 1;
      while (viewOf(s).results[0] === null) {
        s = rules.play(s, CHINCHIRO_MOVE_ROLL);
        rolls++;
        assert.ok(rolls <= 3, 'banker must settle within 3 rolls');
      }
      assert.ok(rolls <= 3);
      const vr = viewOf(s);
      assert.ok(vr.results[0]);
      if (vr.results[0].kind === 'menashi') assert.equal(rolls, 3, 'menashi settles only on 3rd roll');
    } else {
      // 役が出たら1回で確定し、次の席へ
      foundHand = true;
      assert.equal(v1.turn, 1);
      assert.equal(v1.attempts, 0);
    }
    // 元の状態は非破壊
    assert.equal(viewOf(s0).results[0], null);
  }
  assert.ok(foundMenashi, 'a menashi-first seed must exist');
  assert.ok(foundHand, 'a hand-first seed must exist');
  console.log('   OK: reroll up to 3 times, settle on hand / 3rd menashi.');
}

console.log('3. Checking settlement (multipliers, draws)...');
{
  const pin = evaluateChinchiro([1, 1, 1]);
  const ara = evaluateChinchiro([4, 4, 4]);
  const shi = evaluateChinchiro([4, 5, 6]);
  const n6 = evaluateChinchiro([2, 2, 6]);
  const n3 = evaluateChinchiro([5, 5, 3]);
  const menashi = evaluateChinchiro([2, 3, 6]);
  const hifumi = evaluateChinchiro([1, 2, 3]);

  // 子のピンゾロ(5倍): 親は bet*5 = 50 を子へ
  assert.deepEqual(settleChinchiro(n6, pin, 10, 'banker'), { result: 'child_win', amount: 50 });
  // 親のアラシ(3倍): 子は bet*3 = 30 を親へ
  assert.deepEqual(settleChinchiro(ara, n3, 10, 'banker'), { result: 'banker_win', amount: 30 });
  // 親のシゴロ(2倍)・賭け金20: 40
  assert.deepEqual(settleChinchiro(shi, n6, 20, 'banker'), { result: 'banker_win', amount: 40 });
  // 子のヒフミ負け: 2倍払い = 20
  assert.deepEqual(settleChinchiro(n3, hifumi, 10, 'banker'), { result: 'banker_win', amount: 20 });
  // 親のヒフミ負け: 子の通常目でも親が2倍払い = 20
  assert.deepEqual(settleChinchiro(hifumi, n3, 10, 'banker'), { result: 'child_win', amount: 20 });
  // 目なし同士は引き分け: banker は親の勝ち(mult 1)、push は精算なし
  assert.deepEqual(settleChinchiro(menashi, menashi, 10, 'banker'), { result: 'banker_win', amount: 10 });
  assert.deepEqual(settleChinchiro(menashi, menashi, 10, 'push'), { result: 'push', amount: 0 });
  assert.deepEqual(settleChinchiro(n3, n3, 10, 'push'), { result: 'push', amount: 0 });

  // 実プレイのラウンド精算が settleChinchiro と一致し、チップ総和が保存されること
  for (const seedVal of [0.11, 0.37, 0.53, 0.71, 0.93]) {
    const rules = makeRules({ players: 4 });
    let s = newState(rules, seedVal);
    while (viewOf(s).roundNo === 1 && !rules.outcome(s)) {
      s = rules.play(s, CHINCHIRO_SPEC.brain.choose(rules, s, rules.toMove(s), 1, () => 0.5));
    }
    const v = viewOf(s);
    assert.ok(v.lastRound, 'round 1 must be settled');
    const lr = v.lastRound;
    assert.equal(lr.entries.length, 3);
    const delta = [0, 0, 0, 0];
    for (const e of lr.entries) {
      const bankerEv = lr.results[lr.banker];
      const childEv = lr.results[e.child];
      const expect = settleChinchiro(bankerEv, childEv, 10, 'banker');
      assert.equal(e.result, expect.result);
      assert.equal(e.amount, expect.amount);
      if (e.amount > 0) {
        delta[e.from] -= e.amount;
        delta[e.to] += e.amount;
      }
    }
    assert.deepEqual(v.chips, delta.map((d) => 100 + d));
    assert.equal(v.chips.reduce((a, b) => a + b, 0), 400);
  }
  console.log('   OK: settlement amounts, draw rules, and chip conservation in real rounds.');
}

console.log('4. Checking full games with brain (2 & 6 players, options)...');
{
  for (const cfg of [
    { players: 2 },
    { players: 6 },
    { players: 4, bet: '20', drawRule: 'push' },
    { players: 3, bankerInstant: 'on' },
    { players: 5, shonben: 'on' },
    { players: 2, bankerInstant: 'on', shonben: 'on' },
    { players: 6, bankerInstant: 'on', shonben: 'on' },
  ]) {
    const rules = makeRules(cfg);
    const n = cfg.players;
    const s = playAll(rules, newState(rules, 0.31415));
    const out = rules.outcome(s);
    assert.ok(out, 'outcome must exist');
    const sc = Array.from(rules.scores(s));
    assert.equal(sc.length, n);
    assert.equal(sc.reduce((a, b) => a + b, 0), n * 100, 'chip total must be conserved');
    const max = Math.max(...sc);
    const winners = sc.filter((c) => c === max).length;
    assert.equal(out.ys_1, winners === 1 ? sc.indexOf(max) : -1);
    assert.equal(rules.legalMoves(s).length, 0);
    assert.equal(rules.toMove(s), -1);
  }

  // bankerInstant: 親の即勝ち/即負けで、子が振る前にラウンドが終わる種が存在すること
  let instantFound = false;
  for (let i = 0; i < 500 && !instantFound; i++) {
    const rules = makeRules({ players: 4, bankerInstant: 'on' });
    let s = newState(rules, i / 500);
    let guard = 0;
    while (!rules.outcome(s) && guard++ < 100) {
      const before = viewOf(s);
      s = rules.play(s, CHINCHIRO_MOVE_ROLL);
      const after = viewOf(s);
      if (after.lastRound && after.lastRound.instant) {
        instantFound = true;
        // 即精算のラウンドでは、確定した子がいてもよいのは親だけ
        const settledChildren = after.lastRound.results
          .map((r, idx) => (idx !== after.lastRound.banker && r ? idx : -1))
          .filter((x) => x >= 0);
        assert.equal(settledChildren.length, 0);
        assert.ok(after.lastRound.entries.every((e) => e.amount === 10 * after.lastRound.results[after.lastRound.banker].mult));
        break;
      }
      void before;
    }
  }
  assert.ok(instantFound, 'bankerInstant must trigger for some seed');

  // shonben: ションベン(即負け確定)が出る種が存在し、完走できること
  let shonbenFound = false;
  for (let i = 0; i < 200 && !shonbenFound; i++) {
    const rules = makeRules({ players: 4, shonben: 'on' });
    let s = newState(rules, i / 200);
    let guard = 0;
    while (!rules.outcome(s) && guard++ < 500) {
      s = rules.play(s, CHINCHIRO_MOVE_ROLL);
      const v = viewOf(s);
      const all = [...v.results, ...(v.lastRound ? v.lastRound.results : [])];
      if (all.some((r) => r && r.kind === 'shonben')) { shonbenFound = true; break; }
    }
    if (shonbenFound) {
      const end = playAll(rules, s);
      assert.equal(Array.from(rules.scores(end)).reduce((a, b) => a + b, 0), 400);
    }
  }
  assert.ok(shonbenFound, 'shonben must occur for some seed');
  console.log('   OK: full games finish, chips conserved, bankerInstant & shonben work.');
}

console.log('PASS test_chinchiro_core');
