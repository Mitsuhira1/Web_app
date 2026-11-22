import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';
import {
  LIARSDICE_MOVE_DOUBT,
  LIARSDICE_MOVE_EXACT,
  encodeLiarsBid,
  decodeLiarsBid,
  isHigherLiarsBid,
  countMatchingDice,
} from '../../web/pc-firebase/core/games/liarsdice.mjs';

console.log('1. Checking catalog & bid encoding / comparison rules...');
{
  const catalog = JSON.parse(core.catalogJson());
  const entry = catalog.find((g) => g.id === 'liarsdice');
  assert.ok(entry, 'liarsdice must be registered');
  assert.equal(entry.no, 46);
  assert.equal(entry.name, 'ライアーズダイス');

  assert.equal(encodeLiarsBid(3, 4), 134);
  assert.deepEqual(decodeLiarsBid(134), { qty: 3, face: 4 });

  // wildOnes=true: 4が4個 の次に 1が2個 はOK、1が1個はNG
  assert.equal(isHigherLiarsBid({ qty: 4, face: 4 }, { qty: 2, face: 1 }, true), true);
  assert.equal(isHigherLiarsBid({ qty: 4, face: 4 }, { qty: 1, face: 1 }, true), false);
  // wildOnes=true: 4が3個 の次に 1が2個 はOK (ceil(3/2)=2)
  assert.equal(isHigherLiarsBid({ qty: 3, face: 4 }, { qty: 2, face: 1 }, true), true);
  // wildOnes=true: 1が2個 の次に 2が5個 はOK (2*2+1=5)、6が4個 はNG
  assert.equal(isHigherLiarsBid({ qty: 2, face: 1 }, { qty: 5, face: 2 }, true), true);
  assert.equal(isHigherLiarsBid({ qty: 2, face: 1 }, { qty: 4, face: 6 }, true), false);

  // wildOnes=false: 1は通常出目 (1 < 2 < ... < 6)
  assert.equal(isHigherLiarsBid({ qty: 4, face: 4 }, { qty: 2, face: 1 }, false), false);
  assert.equal(isHigherLiarsBid({ qty: 4, face: 1 }, { qty: 4, face: 2 }, false), true);

  // countMatchingDice
  const sample = [[1, 1, 4, 5, 6], [1, 4, 4, 2, 3]];
  assert.equal(countMatchingDice(sample, 4, true), 6); // 4が3個 + 1が3個
  assert.equal(countMatchingDice(sample, 4, false), 3); // 4のみ3個
  assert.equal(countMatchingDice(sample, 1, true), 3); // 1は3個
  console.log('   OK: catalog, bid ordering (wild/non-wild), and dice counting verified.');
}

console.log('2. Checking hidden-information masking, doubt & exact rules...');
{
  const h = core.newMatch('liarsdice', 'players=3;wildOnes=on;exactRule=others_lose', '4242', '0,1,2', 'normal');
  const v0 = JSON.parse(core.viewJson(h, 0));
  const v1 = JSON.parse(core.viewJson(h, 1));
  const vSpec = JSON.parse(core.viewJson(h, -1));

  assert.equal(v0.board.kind, 'liarsdice');
  assert.equal(v0.board.myDice.length, 5);
  assert.equal(v0.board.dice[0].length, 5);
  assert.equal(v0.board.dice[1], null);
  assert.equal(v0.board.dice[2], null);
  assert.equal(v1.board.dice[0], null);
  assert.equal(v1.board.dice[1].length, 5);
  assert.equal(vSpec.board.myDice, null);
  assert.equal(vSpec.board.dice[0], null);

  // 初手はダウト・ジャスト不可
  assert.equal(core.playMove(h, LIARSDICE_MOVE_DOUBT), false);
  assert.equal(core.playMove(h, LIARSDICE_MOVE_EXACT), false);

  // 実際の出目を合算して、意図的にピタリの個数を宣言し、次の人がジャスト(others_lose)を当ててみる
  const v2 = JSON.parse(core.viewJson(h, 2));
  const allDice = [v0.board.myDice, v1.board.myDice, v2.board.myDice];
  const exactCountOf5 = countMatchingDice(allDice, 5, true);
  if (exactCountOf5 >= 1) {
    assert.ok(core.playMove(h, encodeLiarsBid(exactCountOf5, 5)));
    assert.ok(core.playMove(h, LIARSDICE_MOVE_EXACT));
    const afterExact = JSON.parse(core.viewJson(h, 1));
    assert.equal(afterExact.board.lastRound.action, 'exact');
    assert.equal(afterExact.board.lastRound.callerSuccess, true);
    assert.deepEqual(afterExact.board.diceCounts, [4, 5, 4], 'others_lose should reduce everyone except caller(1)');
  }

  // gain_one の検証
  const hGain = core.newMatch('liarsdice', 'players=2;wildOnes=off;exactRule=gain_one', '777', '0,1', 'normal');
  // まず1回席0が絶対嘘(10個)を言ってダウトされ、4個に減らす
  assert.ok(core.playMove(hGain, encodeLiarsBid(10, 6)));
  assert.ok(core.playMove(hGain, LIARSDICE_MOVE_DOUBT));
  let sg0 = JSON.parse(core.viewJson(hGain, 0));
  let sg1 = JSON.parse(core.viewJson(hGain, 1));
  assert.deepEqual(sg0.board.diceCounts, [4, 5]);
  // 席0が何か宣言し、席1がダウトではなくピタリできるか確認（今回は席0の回復を見るため、席1にピタリ宣言させて席0がEXACT）
  const dAll = [sg0.board.myDice, sg1.board.myDice];
  let chosenFace = 2;
  for (let f = 1; f <= 6; f++) {
    if (countMatchingDice(dAll, f, false) >= 2) { chosenFace = f; break; }
  }
  const exactCnt = countMatchingDice(dAll, chosenFace, false);
  assert.ok(core.playMove(hGain, encodeLiarsBid(1, 1))); // 席0が最小宣言
  assert.ok(core.playMove(hGain, encodeLiarsBid(exactCnt, chosenFace))); // 席1がピタリ個数を宣言
  assert.ok(core.playMove(hGain, LIARSDICE_MOVE_EXACT)); // 席0がジャスト的中！
  sg0 = JSON.parse(core.viewJson(hGain, 0));
  assert.equal(sg0.board.lastRound.callerSuccess, true);
  assert.equal(sg0.board.lastRound.gained, 0);
  assert.deepEqual(sg0.board.diceCounts, [5, 5], 'gain_one should restore caller dice from 4 to 5');

  console.log('   OK: masking, doubt, exact(others_lose & gain_one) verified.');
}

console.log('3. Checking restoreMatch determinism...');
{
  const opts = 'players=4;wildOnes=on;exactRule=others_lose';
  const hA = core.newMatch('liarsdice', opts, '20261122', '', 'hard');
  let stA = JSON.parse(core.viewJson(hA, 0));
  let steps = 0;
  while (stA.outcome == null && steps < 600) {
    const mv = core.cpuChoose(hA, 50);
    assert.ok(core.playMove(hA, mv), `Illegal CPU move ${mv}`);
    stA = JSON.parse(core.viewJson(hA, 0));
    steps++;
  }
  assert.ok(stA.outcome != null);
  const rec = core.matchRecord(hA);
  const hB = core.restoreMatch(rec);
  assert.ok(hB > 0);
  assert.equal(core.viewJson(hA, 0), core.viewJson(hB, 0), 'restoreMatch must match byte-for-byte');
  console.log(`   OK: restoreMatch identical after ${steps} steps (round ${stA.board.roundNo}).`);
}

console.log('4. Running CPU playouts across 2..6 players, options & difficulties...');
{
  const cases = [
    ['players=2;wildOnes=on;exactRule=off', 'easy'],
    ['players=3;wildOnes=off;exactRule=off', 'normal'],
    ['players=4;wildOnes=on;exactRule=others_lose', 'hard'],
    ['players=5;wildOnes=on;exactRule=gain_one', 'normal'],
    ['players=6;wildOnes=on;exactRule=off', 'hard'],
  ];
  for (let i = 0; i < cases.length; i++) {
    const [optStr, diff] = cases[i];
    const h = core.newMatch('liarsdice', optStr, String(3000 + i * 41), '', diff);
    let st = JSON.parse(core.viewJson(h, 0));
    let steps = 0;
    while (st.outcome == null && steps < 900) {
      const mv = core.cpuChoose(h, 50);
      assert.ok(core.playMove(h, mv), `Illegal CPU move ${mv}`);
      st = JSON.parse(core.viewJson(h, 0));
      steps++;
    }
    assert.ok(st.outcome != null, `Did not finish: ${optStr} (${diff})`);
    assert.ok(st.outcome.winner >= 0);
    console.log(`   PASS [${optStr}] (${diff}): ${steps} steps, ${st.board.roundNo} rounds -> winner=${st.outcome.winner} (${st.outcome.reason})`);
  }
}

console.log('ALL LIARS DICE CORE TESTS PASSED!');
