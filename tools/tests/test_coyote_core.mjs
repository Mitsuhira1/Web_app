import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';
import {
  COYOTE_CARDS,
  COYOTE_MOVE_COYOTE,
  COYOTE_MAX_BID,
  evaluateCoyoteCards,
} from '../../web/pc-firebase/core/games/coyote.mjs';

console.log('1. Checking catalog & card definitions...');
{
  const catalog = JSON.parse(core.catalogJson());
  const entry = catalog.find((g) => g.id === 'coyote');
  assert.ok(entry, 'coyote must be registered in catalog');
  assert.equal(entry.no, 44);
  assert.equal(entry.name, 'コヨーテ');

  const rj = JSON.parse(core.rulesJson('coyote'));
  const secs = Array.isArray(rj) ? rj : rj.sections;
  assert.ok(Array.isArray(secs) && secs.length >= 3, 'coyote rulesJson should have >=3 sections');

  assert.equal(COYOTE_CARDS.length, 36, 'Total Coyote cards must be 36');
  const normals = COYOTE_CARDS.filter((c) => c.kind === 'num');
  const specials = COYOTE_CARDS.filter((c) => c.kind !== 'num');
  assert.equal(normals.length, 32);
  assert.equal(specials.length, 4);
  console.log('   OK: catalog, rulesJson, and 36-card deck verified.');
}

console.log('2. Checking evaluateCoyoteCards (special cards & order)...');
{
  // id 0 = 20, id 1 = 15, id 2 = 15, id 29 = -5, id 31 = -10
  // id 32 = 0(夜), id 33 = ×2, id 34 = MAX→0, id 35 = ?
  assert.equal(evaluateCoyoteCards([0, 1, 29]).total, 30); // 20 + 15 - 5 = 30
  assert.equal(evaluateCoyoteCards([0, 1, 33]).total, 70); // (20 + 15) * 2 = 70
  assert.equal(evaluateCoyoteCards([29, 31, 33]).total, -30); // (-5 - 10) * 2 = -30

  // MAX→0: 最大の1枚だけ0に
  const rMax1 = evaluateCoyoteCards([0, 1, 34]); // 20, 15, MAX→0 => 15
  assert.equal(rMax1.total, 15);
  assert.equal(rMax1.maxZeroedValue, 20);

  // MAX→0: 同率最大(15, 15)は1枚だけ0にする
  const rMaxTie = evaluateCoyoteCards([1, 2, 34]); // 15, 15, MAX→0 => 15
  assert.equal(rMaxTie.total, 15);
  assert.equal(rMaxTie.maxZeroedValue, 15);

  // MAX→0: 正の数字カードが無いときは変化なし
  const rMaxNeg = evaluateCoyoteCards([26, 29, 31, 34]); // 0, -5, -10, MAX→0 => -15
  assert.equal(rMaxNeg.total, -15);
  assert.equal(rMaxNeg.maxZeroedId, null);

  // MAX→0 + ×2 の順序: 先に MAX→0、次に ×2
  const rBoth = evaluateCoyoteCards([0, 1, 34, 33]); // (15) * 2 = 30
  assert.equal(rBoth.total, 30);
  assert.equal(rBoth.baseSum, 15);
  assert.equal(rBoth.doubled, true);

  // 0(夜) のリシャッフルフラグ
  const rNight = evaluateCoyoteCards([1, 32]);
  assert.equal(rNight.total, 15);
  assert.equal(rNight.hasReshuffle, true);

  console.log('   OK: all evaluation cases passed.');
}

console.log('3. Checking hidden-information masking & legal moves...');
{
  const h = core.newMatch('coyote', 'players=4;specialCards=on;lives=3', '20261122', '0,1,2,3', 'normal');
  const v0 = JSON.parse(core.viewJson(h, 0));
  const v1 = JSON.parse(core.viewJson(h, 1));
  const vSpec = JSON.parse(core.viewJson(h, -1));

  assert.equal(v0.board.kind, 'coyote');
  assert.equal(v0.board.deck, undefined, 'deck must not be exposed');
  assert.equal(v0.board.deckCount, 32);

  // 自分のカードだけ hidden、他全員のカードは公開
  assert.deepEqual(v0.board.cards[0], { hidden: true });
  assert.ok(v0.board.cards[1] && !v0.board.cards[1].hidden && typeof v0.board.cards[1].id === 'number');
  assert.ok(v0.board.cards[2] && !v0.board.cards[2].hidden);
  assert.ok(v0.board.cards[3] && !v0.board.cards[3].hidden);

  // 席1視点では席1が hidden、席0が見える
  assert.deepEqual(v1.board.cards[1], { hidden: true });
  assert.ok(v1.board.cards[0] && !v1.board.cards[0].hidden);

  // 観戦者視点では全員 hidden
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(vSpec.board.cards[i], { hidden: true });
  }

  // 初手はコヨーテ不可、1..160 が合法
  assert.equal(v0.board.canCoyote, false);
  assert.ok(!v0.legal.includes(COYOTE_MOVE_COYOTE));
  assert.ok(v0.legal.includes(1));
  assert.ok(v0.legal.includes(COYOTE_MAX_BID));
  assert.equal(core.playMove(h, COYOTE_MOVE_COYOTE), false);

  // 席0が 10 を宣言 → 席1は 0(コヨーテ) または 11..160 が合法
  assert.equal(core.playMove(h, 10), true);
  const afterBid = JSON.parse(core.viewJson(h, 1));
  assert.equal(afterBid.toMove, 1);
  assert.equal(afterBid.board.currentBid, 10);
  assert.equal(afterBid.board.lastBidder, 0);
  assert.equal(afterBid.board.canCoyote, true);
  assert.ok(afterBid.legal.includes(COYOTE_MOVE_COYOTE));
  assert.ok(!afterBid.legal.includes(10));
  assert.ok(afterBid.legal.includes(11));

  // 上限 160 を宣言したら次はコヨーテ(0)のみ合法
  assert.equal(core.playMove(h, COYOTE_MAX_BID), true);
  const atCap = JSON.parse(core.viewJson(h, 2));
  assert.deepEqual(atCap.legal, [COYOTE_MOVE_COYOTE]);

  // コヨーテ指摘で必ず宣言者(席1)が負ける (最大理論値でも 160 はほぼ超過か検証)
  assert.equal(core.playMove(h, COYOTE_MOVE_COYOTE), true);
  const afterCall = JSON.parse(core.viewJson(h, 0));
  assert.equal(afterCall.board.roundNo, 2);
  assert.ok(afterCall.board.lastRound != null);
  assert.equal(afterCall.board.lastRound.bid, COYOTE_MAX_BID);
  assert.equal(afterCall.board.lastRound.bidder, 1);
  assert.equal(afterCall.board.lastRound.caller, 2);
  assert.equal(afterCall.board.lastRound.loser, 1);
  assert.equal(afterCall.board.lives[1], 2);
  assert.equal(afterCall.toMove, 1, 'Loser should start next round if still alive');

  console.log('   OK: masking, legal moves, cap bid, and round resolution verified.');
}

console.log('4. Checking options: lives=1 (sudden death) & specialCards=off...');
{
  // lives=1 の 2人戦は1回のコヨーテ判定で即終了
  const h1 = core.newMatch('coyote', 'players=2;lives=1;specialCards=off', '777', '0,1', 'normal');
  const init1 = JSON.parse(core.viewJson(h1, 0));
  assert.equal(init1.board.deckCount, 30, 'specialCards=off has 32 cards total - 2 dealt = 30');
  assert.equal(init1.board.maxLives, 1);
  assert.equal(core.playMove(h1, 150), true);
  assert.equal(core.playMove(h1, COYOTE_MOVE_COYOTE), true);
  const end1 = JSON.parse(core.viewJson(h1, 0));
  assert.ok(end1.outcome != null, '2-player lives=1 should finish in 1 round');
  assert.equal(end1.outcome.winner, 1);
  assert.equal(end1.board.done, true);
  // 終了後は自分のカードも公開
  assert.ok(!end1.board.cards[0].hidden && !end1.board.cards[1].hidden);

  // specialCards=off で多数ラウンド回しても特殊カードが一切出ないこと
  const hNoSp = core.newMatch('coyote', 'players=4;specialCards=off;lives=3', '8888', '', 'hard');
  let st = JSON.parse(core.viewJson(hNoSp, 0));
  let steps = 0;
  while (st.outcome == null && steps < 500) {
    const mv = core.cpuChoose(hNoSp, 50);
    assert.ok(core.playMove(hNoSp, mv));
    st = JSON.parse(core.viewJson(hNoSp, 0));
    if (st.board.lastRound) {
      for (const c of st.board.lastRound.cards) {
        if (c) assert.equal(c.kind, 'num', 'No special cards allowed when specialCards=off');
      }
      assert.equal(st.board.lastRound.mysteryCard, null);
    }
    steps++;
  }
  assert.ok(st.outcome != null, 'specialCards=off game should finish');
  console.log(`   OK: lives=1 sudden death & specialCards=off verified (${steps} steps).`);
}

console.log('5. Checking restoreMatch determinism (across deck reshuffles)...');
{
  const opts = 'players=5;specialCards=on;lives=3';
  const seed = '987654321';
  const hA = core.newMatch('coyote', opts, seed, '', 'hard');
  const moves = [];
  let stA = JSON.parse(core.viewJson(hA, 0));
  while (stA.outcome == null && moves.length < 400) {
    const mv = core.cpuChoose(hA, 50);
    assert.ok(core.playMove(hA, mv));
    moves.push(mv);
    stA = JSON.parse(core.viewJson(hA, 0));
  }
  assert.ok(stA.outcome != null, '5-player match should finish');

  const rec = core.matchRecord(hA);
  const hB = core.restoreMatch(rec);
  assert.ok(hB > 0, 'restoreMatch failed');
  assert.equal(core.viewJson(hA, 0), core.viewJson(hB, 0), 'restoreMatch must match byte-for-byte');
  console.log(`   OK: restoreMatch identical after ${moves.length} moves (round ${stA.board.roundNo}).`);
}

console.log('6. Running CPU playouts across all player counts & difficulties...');
{
  const cases = [
    ['players=2;specialCards=on;lives=3', 'easy'],
    ['players=3;specialCards=on;lives=2', 'normal'],
    ['players=4;specialCards=on;lives=3', 'hard'],
    ['players=5;specialCards=off;lives=3', 'normal'],
    ['players=6;specialCards=on;lives=1', 'hard'],
    ['players=6;specialCards=on;lives=3', 'hard'],
  ];
  for (let i = 0; i < cases.length; i++) {
    const [optStr, diff] = cases[i];
    const h = core.newMatch('coyote', optStr, String(1000 + i * 37), '', diff);
    let st = JSON.parse(core.viewJson(h, 0));
    let steps = 0;
    while (st.outcome == null && steps < 600) {
      const mv = core.cpuChoose(h, 50);
      assert.ok(core.playMove(h, mv), `Illegal CPU move ${mv}`);
      st = JSON.parse(core.viewJson(h, 0));
      steps++;
    }
    assert.ok(st.outcome != null, `Did not finish: ${optStr} (${diff})`);
    assert.ok(st.outcome.winner >= 0, `Winner should be a valid seat: ${optStr}`);
    console.log(`   PASS [${optStr}] (${diff}): ${steps} steps, ${st.board.roundNo} rounds -> winner=${st.outcome.winner} (${st.outcome.reason})`);
  }
}

console.log('ALL COYOTE CORE TESTS PASSED!');
