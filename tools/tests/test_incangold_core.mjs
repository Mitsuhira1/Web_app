import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';
import {
  INCANGOLD_MOVE_RETURN,
  INCANGOLD_MOVE_CONTINUE,
  INCANGOLD_TOTAL_ROUNDS,
} from '../../web/pc-firebase/core/games/incangold.mjs';

console.log('1. Checking catalog & initial deal...');
{
  const catalog = JSON.parse(core.catalogJson());
  const entry = catalog.find((g) => g.id === 'incangold');
  assert.ok(entry, 'incangold must be registered');
  assert.equal(entry.no, 47);
  assert.equal(entry.name, 'インカの黄金');

  const h = core.newMatch('incangold', 'players=4;artifacts=on', '12345', '0,1,2,3', 'normal');
  const v0 = JSON.parse(core.viewJson(h, 0));
  assert.equal(v0.board.kind, 'incangold');
  assert.equal(v0.board.roundNo, 1);
  assert.equal(v0.board.pathCards.length, 1, '1st card should be revealed automatically at round start');
  assert.equal(v0.board.deckCount, 30, '15 gems + 15 hazards + 1 artifact - 1 drawn = 30');
  assert.equal(v0.board.deck, undefined, 'deck must not be exposed');
  console.log('   OK: catalog and initial round deal verified.');
}

console.log('2. Checking simultaneous choice masking, return split, and all-return round advance...');
{
  const h = core.newMatch('incangold', 'players=3;artifacts=off', '777', '0,1,2', 'normal');
  let v0 = JSON.parse(core.viewJson(h, 0));
  assert.equal(v0.board.deckCount, 29, 'artifacts=off: 30 cards - 1 drawn = 29');

  // 席0が「帰る」を選ぶ → 席1視点では席0が decided=true だが myChoice は -1、席0の選択中身は露出しない
  assert.ok(core.playMove(h, INCANGOLD_MOVE_RETURN));
  const v1 = JSON.parse(core.viewJson(h, 1));
  const v0After = JSON.parse(core.viewJson(h, 0));
  assert.equal(v1.board.decided[0], true);
  assert.equal(v1.board.decided[1], false);
  assert.equal(v1.board.myChoice, -1);
  assert.equal(v0After.board.myChoice, INCANGOLD_MOVE_RETURN);
  assert.equal(v1.board.choices, undefined, 'Raw choices array must not be exposed');

  // 席1・席2も全員「帰る」 → ラウンド1終了してラウンド2へ
  assert.ok(core.playMove(h, INCANGOLD_MOVE_RETURN));
  assert.ok(core.playMove(h, INCANGOLD_MOVE_RETURN));
  const vNext = JSON.parse(core.viewJson(h, 0));
  assert.equal(vNext.board.roundNo, 2);
  assert.equal(vNext.board.lastRound.busted, false);
  assert.deepEqual(vNext.board.inCave, [true, true, true]);
  console.log('   OK: choice masking and all-return round transition verified.');
}

console.log('3. Checking bust (duplicate hazard) & permanent hazard removal...');
{
  // 全員「進む」を押し続ければ必ずバーストする
  const h = core.newMatch('incangold', 'players=3;artifacts=on', '9999', '0,1,2', 'normal');
  let st = JSON.parse(core.viewJson(h, 0));
  let guard = 0;
  while (st.board.roundNo === 1 && guard < 100) {
    assert.ok(core.playMove(h, INCANGOLD_MOVE_CONTINUE));
    st = JSON.parse(core.viewJson(h, 0));
    guard++;
  }
  assert.equal(st.board.roundNo, 2);
  assert.equal(st.board.lastRound.busted, true);
  assert.ok(st.board.lastRound.bustHazard, 'bustHazard must be recorded');
  assert.equal(st.board.removedHazards[st.board.lastRound.bustHazard], 1, '1 copy of bust hazard permanently removed');
  assert.deepEqual(st.board.tentGems, [0, 0, 0], 'Everyone who busted lost all round gems');
  console.log(`   OK: bust (${st.board.lastRound.bustHazard}) & permanent hazard removal verified.`);
}

console.log('4. Checking restoreMatch determinism...');
{
  const opts = 'players=4;artifacts=on';
  const hA = core.newMatch('incangold', opts, '20261122', '', 'hard');
  let stA = JSON.parse(core.viewJson(hA, 0));
  let steps = 0;
  while (stA.outcome == null && steps < 600) {
    const mv = core.cpuChoose(hA, 50);
    assert.ok(core.playMove(hA, mv), `Illegal CPU move ${mv}`);
    stA = JSON.parse(core.viewJson(hA, 0));
    steps++;
  }
  assert.ok(stA.outcome != null);
  assert.equal(stA.board.roundNo, INCANGOLD_TOTAL_ROUNDS);
  const rec = core.matchRecord(hA);
  const hB = core.restoreMatch(rec);
  assert.ok(hB > 0);
  assert.equal(core.viewJson(hA, 0), core.viewJson(hB, 0), 'restoreMatch must match byte-for-byte');
  console.log(`   OK: restoreMatch identical after ${steps} steps.`);
}

console.log('5. Running CPU playouts across 3..6 players, options & difficulties...');
{
  const cases = [
    ['players=3;artifacts=on', 'easy'],
    ['players=3;artifacts=off', 'normal'],
    ['players=4;artifacts=on', 'hard'],
    ['players=5;artifacts=on', 'normal'],
    ['players=6;artifacts=off', 'hard'],
    ['players=6;artifacts=on', 'hard'],
  ];
  for (let i = 0; i < cases.length; i++) {
    const [optStr, diff] = cases[i];
    const h = core.newMatch('incangold', optStr, String(4000 + i * 29), '', diff);
    let st = JSON.parse(core.viewJson(h, 0));
    let steps = 0;
    while (st.outcome == null && steps < 800) {
      const mv = core.cpuChoose(h, 50);
      assert.ok(core.playMove(h, mv), `Illegal CPU move ${mv}`);
      st = JSON.parse(core.viewJson(h, 0));
      steps++;
    }
    assert.ok(st.outcome != null, `Did not finish: ${optStr} (${diff})`);
    console.log(`   PASS [${optStr}] (${diff}): ${steps} steps -> winner=${st.outcome.winner} scores=[${st.scores.join(',')}] (${st.outcome.reason})`);
  }
}

console.log('ALL INCAN GOLD CORE TESTS PASSED!');
