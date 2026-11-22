import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';
import {
  SKULL_CARD_FLOWER,
  SKULL_CARD_SKULL,
  SKULL_MOVE_PASS,
  SKULL_MOVE_PLACE_FLOWER,
  SKULL_MOVE_PLACE_SKULL,
  SKULL_MOVE_REVEAL_BASE,
  SKULL_MOVE_DISCARD_FLOWER,
  SKULL_MOVE_DISCARD_SKULL,
} from '../../web/pc-firebase/core/games/skull.mjs';

console.log('1. Checking catalog & rulesJson...');
{
  const catalog = JSON.parse(core.catalogJson());
  const entry = catalog.find((g) => g.id === 'skull');
  assert.ok(entry, 'skull must be registered in catalog');
  assert.equal(entry.no, 45);
  assert.equal(entry.name, 'スカル');

  const rj = JSON.parse(core.rulesJson('skull'));
  const secs = Array.isArray(rj) ? rj : rj.sections;
  assert.ok(Array.isArray(secs) && secs.length >= 3);
  console.log('   OK: catalog & rulesJson verified.');
}

console.log('2. Checking initial placement, hidden info masking, bidding & reveal own-first rule...');
{
  const h = core.newMatch('skull', 'players=3;targetPoints=2', '12345', '0,1,2', 'normal');
  let v0 = JSON.parse(core.viewJson(h, 0));
  assert.equal(v0.board.kind, 'skull');
  assert.equal(v0.board.phase, 'initial_place');
  assert.deepEqual(v0.board.myHand, { flowers: 3, skulls: 1 });
  assert.equal(core.playMove(h, 1), false, 'Cannot bid during initial_place');

  // 全員1枚ずつ初期配置: 0=花, 1=花, 2=ドクロ
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_FLOWER));
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_FLOWER));
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_SKULL));

  // 隠匿情報マスキング確認: 席0から席2の伏せカードは hidden、席2本人からは見える
  v0 = JSON.parse(core.viewJson(h, 0));
  const v2 = JSON.parse(core.viewJson(h, 2));
  const vSpec = JSON.parse(core.viewJson(h, -1));
  assert.equal(v0.board.phase, 'play_or_bid');
  assert.equal(v0.board.stacks[0][0].card, SKULL_CARD_FLOWER);
  assert.equal(v0.board.stacks[2][0].hidden, true);
  assert.equal(v0.board.stacks[2][0].card, undefined);
  assert.equal(v2.board.stacks[2][0].card, SKULL_CARD_SKULL);
  assert.equal(vSpec.board.stacks[0][0].hidden, true);
  assert.equal(vSpec.board.myHand, null);

  // 席0が追加で花を1枚置く → totalPlaced=4
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_FLOWER));
  // 席1が 2 を宣言 → bidding へ
  assert.ok(core.playMove(h, 2));
  let st = JSON.parse(core.viewJson(h, 2));
  assert.equal(st.board.phase, 'bidding');
  assert.equal(st.board.currentBid, 2);
  assert.equal(st.toMove, 2);

  // 席2パス、席0が 3 を宣言、席1パス → 席0がチャレンジャーで reveal へ
  assert.ok(core.playMove(h, SKULL_MOVE_PASS));
  assert.ok(core.playMove(h, 3));
  assert.ok(core.playMove(h, SKULL_MOVE_PASS));

  st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.phase, 'reveal');
  assert.equal(st.board.challenger, 0);
  assert.equal(st.board.mustRevealOwn, true);
  // 席0は自分の山に2枚あるので、必ず自分の山 (200+0) しかめくれない
  assert.deepEqual(st.legal, [SKULL_MOVE_REVEAL_BASE + 0]);
  assert.equal(core.playMove(h, SKULL_MOVE_REVEAL_BASE + 1), false);

  assert.ok(core.playMove(h, SKULL_MOVE_REVEAL_BASE + 0));
  st = JSON.parse(core.viewJson(h, 0));
  assert.deepEqual(st.legal, [SKULL_MOVE_REVEAL_BASE + 0]); // 2枚目も自分
  assert.ok(core.playMove(h, SKULL_MOVE_REVEAL_BASE + 0));

  // 自分の山を全部めくり終えたので、他人の山 (1 または 2) から選べる
  st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.mustRevealOwn, false);
  assert.deepEqual(st.legal, [SKULL_MOVE_REVEAL_BASE + 1, SKULL_MOVE_REVEAL_BASE + 2]);

  // 席1(花)をめくって 3枚達成 → 1ポイント獲得！
  assert.ok(core.playMove(h, SKULL_MOVE_REVEAL_BASE + 1));
  st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.points[0], 1);
  assert.equal(st.board.roundNo, 2);
  assert.equal(st.board.lastRound.success, true);
  assert.equal(st.toMove, 0, 'Successful challenger starts next round');
  console.log('   OK: initial_place, masking, bidding, own-first reveal, and point scoring verified.');
}

console.log('3. Checking self-skull discard choice, opponent-skull random loss & 1-point target...');
{
  // 自分のドクロを踏んだ時は discard_own フェーズに入り、花かドクロを選んで捨てられる
  const h = core.newMatch('skull', 'players=3;targetPoints=2', '555', '0,1,2', 'normal');
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_SKULL)); // 0: ドクロ
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_FLOWER)); // 1: 花
  assert.ok(core.playMove(h, SKULL_MOVE_PLACE_FLOWER)); // 2: 花
  // 席0が場の最大枚数(3)を宣言 → 即 reveal へ
  assert.ok(core.playMove(h, 3));
  let st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.phase, 'reveal');
  assert.equal(st.board.challenger, 0);

  // 自分の山をめくる → ドクロ → discard_own へ
  assert.ok(core.playMove(h, SKULL_MOVE_REVEAL_BASE + 0));
  st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.phase, 'discard_own');
  assert.deepEqual(st.legal, [SKULL_MOVE_DISCARD_FLOWER, SKULL_MOVE_DISCARD_SKULL]);

  // 花を捨てる → 席0の持ちカードは花2・ドクロ1に
  assert.ok(core.playMove(h, SKULL_MOVE_DISCARD_FLOWER));
  st = JSON.parse(core.viewJson(h, 0));
  assert.equal(st.board.roundNo, 2);
  assert.deepEqual(st.board.myOwned, { flowers: 2, skulls: 1 });
  assert.equal(st.board.lastRound.selfSkull, true);
  assert.equal(st.board.lastRound.lostCard, SKULL_CARD_FLOWER);

  // 1ポイント先取オプションで1回成功すれば即決着
  const h1 = core.newMatch('skull', 'players=3;targetPoints=1', '999', '0,1,2', 'normal');
  assert.ok(core.playMove(h1, SKULL_MOVE_PLACE_FLOWER));
  assert.ok(core.playMove(h1, SKULL_MOVE_PLACE_FLOWER));
  assert.ok(core.playMove(h1, SKULL_MOVE_PLACE_FLOWER));
  assert.ok(core.playMove(h1, 3)); // 全枚数宣言 → 即 reveal
  assert.ok(core.playMove(h1, SKULL_MOVE_REVEAL_BASE + 0));
  assert.ok(core.playMove(h1, SKULL_MOVE_REVEAL_BASE + 1));
  assert.ok(core.playMove(h1, SKULL_MOVE_REVEAL_BASE + 2));
  const end1 = JSON.parse(core.viewJson(h1, 0));
  assert.ok(end1.outcome != null);
  assert.equal(end1.outcome.winner, 0);
  assert.equal(end1.board.points[0], 1);
  console.log('   OK: self-skull discard_own and 1-point target verified.');
}

console.log('4. Checking restoreMatch determinism...');
{
  const opts = 'players=4;targetPoints=2';
  const seed = '20261122';
  const hA = core.newMatch('skull', opts, seed, '', 'hard');
  let stA = JSON.parse(core.viewJson(hA, 0));
  let steps = 0;
  while (stA.outcome == null && steps < 600) {
    const mv = core.cpuChoose(hA, 50);
    assert.ok(core.playMove(hA, mv), `Illegal CPU move ${mv}`);
    stA = JSON.parse(core.viewJson(hA, 0));
    steps++;
  }
  assert.ok(stA.outcome != null, '4-player skull should finish');
  const rec = core.matchRecord(hA);
  const hB = core.restoreMatch(rec);
  assert.ok(hB > 0);
  assert.equal(core.viewJson(hA, 0), core.viewJson(hB, 0), 'restoreMatch must match byte-for-byte');
  console.log(`   OK: restoreMatch identical after ${steps} steps (round ${stA.board.roundNo}).`);
}

console.log('5. Running CPU playouts across 3..6 players, options & difficulties...');
{
  const cases = [
    ['players=3;targetPoints=2', 'easy'],
    ['players=3;targetPoints=1', 'normal'],
    ['players=4;targetPoints=2', 'normal'],
    ['players=5;targetPoints=2', 'hard'],
    ['players=6;targetPoints=1', 'hard'],
    ['players=6;targetPoints=2', 'hard'],
  ];
  for (let i = 0; i < cases.length; i++) {
    const [optStr, diff] = cases[i];
    const h = core.newMatch('skull', optStr, String(2000 + i * 53), '', diff);
    let st = JSON.parse(core.viewJson(h, 0));
    let steps = 0;
    while (st.outcome == null && steps < 800) {
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

console.log('ALL SKULL CORE TESTS PASSED!');
