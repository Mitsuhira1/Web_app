import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';
import {
  ROULETTE_SPOTS,
  ROULETTE_CHIPS,
  EURO_WHEEL,
  AMER_WHEEL,
  RED_NUMS,
  pocketColor,
  MOVE_UNDO,
  MOVE_CLEAR,
  MOVE_REBET,
  MOVE_DOUBLE,
  MOVE_CONFIRM,
  MOVE_REBUY,
  ROULETTE_SPEC,
} from '../../web/pc-firebase/core/games/roulette.mjs';

function makeOpts(map = {}) {
  return {
    it: (k, d) => (map[k] != null ? Number(map[k]) : d),
    jt: (k, d) => (map[k] != null ? String(map[k]) : d),
  };
}

function getView(h, me = 0) {
  return JSON.parse(core.viewJson(h, me));
}

console.log('1. Checking SPOTS & wheel structure...');
assert.equal(ROULETTE_SPOTS.length, 152, 'Expected 152 spots (0..151)');
assert.equal(EURO_WHEEL.length, 37);
assert.equal(AMER_WHEEL.length, 38);
assert.equal(new Set(EURO_WHEEL.map(String)).size, 37);
assert.equal(new Set(AMER_WHEEL.map(String)).size, 38);
assert.equal(RED_NUMS.size, 18);
assert.equal(pocketColor(0), 'green');
assert.equal(pocketColor('00'), 'green');
assert.equal(pocketColor(1), 'red');
assert.equal(pocketColor(2), 'black');

const spotById = new Map(ROULETTE_SPOTS.map((s) => [s.id, s]));
assert.equal(spotById.get('s:0').mult, 36);
assert.equal(spotById.get('s:00').mult, 36);
assert.equal(spotById.get('s:00').amerOnly, true);
assert.equal(spotById.get('sp:1-4').mult, 18);
assert.equal(spotById.get('sp:1-2').mult, 18);
assert.equal(spotById.get('st:1').mult, 12);
assert.equal(spotById.get('cn:1-2-4-5').mult, 9);
assert.equal(spotById.get('ln:1').mult, 6);
assert.equal(spotById.get('col:1').mult, 3);
assert.equal(spotById.get('doz:2').mult, 3);
assert.equal(spotById.get('out:red').mult, 2);
assert.equal(spotById.get('out:red').evenMoney, true);
console.log('   OK: 152 spots and wheel orders verified.');

console.log('2. Checking Euro vs Amer 00 spot legality & turn editing actions...');
{
  const hEuro = core.newMatch('roulette', 'players=2;wheel=euro;startChips=1000', '42', '', 'normal');
  let st = getView(hEuro, 0);
  assert.equal(st.board.wheelType, 'euro');
  assert.equal(st.board.wheelOrder.length, 37);
  // Spot 37 is 's:00', amerOnly -> illegal in euro
  const spot00Idx = spotById.get('s:00').idx;
  assert.equal(spot00Idx, 37);
  assert.ok(!st.legal.includes(spot00Idx), 's:00 should be illegal on European wheel');

  const hAmer = core.newMatch('roulette', 'players=2;wheel=amer;startChips=1000', '42', '', 'normal');
  let stA = getView(hAmer, 0);
  assert.equal(stA.board.wheelType, 'amer');
  assert.equal(stA.board.wheelOrder.length, 38);
  assert.ok(stA.legal.includes(spot00Idx), 's:00 should be legal on American wheel');

  // Test place chip -> undo -> place -> double -> remove -> clear
  const redIdx = spotById.get('out:red').idx;
  const s17Idx = spotById.get('s:17').idx;
  assert.ok(core.playMove(hEuro, 2 * 200 + redIdx)); // 25 on red
  st = getView(hEuro, 0);
  assert.equal(st.board.chips[0], 975);
  assert.equal(st.board.tableTotals[0], 25);
  assert.equal(st.scores[0], 1000);
  assert.equal(st.board.canUndo, true);
  assert.equal(st.board.canDouble, true);
  assert.equal(st.board.canClear, true);

  // Undo restores chips
  assert.ok(core.playMove(hEuro, MOVE_UNDO));
  st = getView(hEuro, 0);
  assert.equal(st.board.chips[0], 1000);
  assert.equal(st.board.tableTotals[0], 0);
  assert.equal(st.board.canUndo, false);

  // Place 100 on red, double -> 200, plus 5 on s:17 -> 205
  assert.ok(core.playMove(hEuro, 3 * 200 + redIdx)); // +100
  assert.ok(core.playMove(hEuro, MOVE_DOUBLE)); // 200 on red
  st = getView(hEuro, 0);
  assert.equal(st.board.bets[0]['out:red'], 200);
  assert.equal(st.board.chips[0], 800);

  assert.ok(core.playMove(hEuro, 1 * 200 + s17Idx)); // +5 on s:17
  st = getView(hEuro, 0);
  assert.equal(st.board.bets[0]['s:17'], 5);
  assert.equal(st.board.chips[0], 795);

  // Remove only s:17
  assert.ok(core.playMove(hEuro, 1000 + s17Idx));
  st = getView(hEuro, 0);
  assert.equal(st.board.bets[0]['s:17'], undefined);
  assert.equal(st.board.bets[0]['out:red'], 200);
  assert.equal(st.board.chips[0], 800);

  // Clear removes all
  assert.ok(core.playMove(hEuro, MOVE_CLEAR));
  st = getView(hEuro, 0);
  assert.equal(st.board.tableTotals[0], 0);
  assert.equal(st.board.chips[0], 1000);
}
console.log('   OK: Bet editing, spot legality, undo, clear, remove, double verified.');

console.log('3. Checking exact payout math & La Partage at raw rules level...');
{
  const rulesOff = ROULETTE_SPEC.makeRules(makeOpts({ players: 1, wheel: 'amer', startChips: 1000, rounds: 5, laPartage: 'off' }));
  const rulesHalf = ROULETTE_SPEC.makeRules(makeOpts({ players: 1, wheel: 'amer', startChips: 1000, rounds: 5, laPartage: 'half' }));

  // Search deterministic rngState values that spin specific pockets:
  // A pocket winning, a '0', and a '00'
  function findStateForPocket(rules, targetPocketStr) {
    for (let seed = 1; seed < 5000; seed++) {
      let s = rules.initial(() => ((seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      s = { ...s, rngState: seed >>> 0 };
      const after = rules.play(s, MOVE_CONFIRM);
      if (after.lastRound.pocketStr === targetPocketStr) return seed >>> 0;
    }
    throw new Error(`Could not find rngState producing pocket ${targetPocketStr}`);
  }

  // Verify every multiplier type on pocket '1' (col:1, doz:1, out:low, out:red, out:odd, s:1, sp:1-4, sp:1-2, st:1, cn:1-2-4-5, ln:1)
  const seed1 = findStateForPocket(rulesOff, '1');
  let s = rulesOff.initial(() => 0.123);
  s = { ...s, rngState: seed1 };
  const testIds = ['s:1', 'sp:1-4', 'sp:1-2', 'st:1', 'cn:1-2-4-5', 'ln:1', 'col:1', 'doz:1', 'out:red'];
  for (const id of testIds) {
    s = rulesOff.play(s, 1 * 200 + spotById.get(id).idx); // 5 chips each -> 45 total
  }
  const settled = rulesOff.play(s, MOVE_CONFIRM);
  assert.equal(settled.lastRound.pocketStr, '1');
  assert.equal(settled.lastRound.wagered[0], 45);
  const expectedPayout = 5 * (36 + 18 + 18 + 12 + 9 + 6 + 3 + 3 + 2); // 5 * 107 = 535
  assert.equal(settled.lastRound.payouts[0], expectedPayout);
  assert.equal(settled.chips[0], 1000 - 45 + expectedPayout);
  assert.equal(settled.lastRound.nets[0], expectedPayout - 45);

  // Check La Partage on '0' and '00'
  const seed00 = findStateForPocket(rulesHalf, '00');
  let sh = rulesHalf.initial(() => 0.123);
  sh = { ...sh, rngState: seed00 };
  sh = rulesHalf.play(sh, 3 * 200 + spotById.get('out:red').idx); // 100 on red (evenMoney)
  sh = rulesHalf.play(sh, 2 * 200 + spotById.get('doz:1').idx);   // 25 on doz:1 (NOT evenMoney)
  const resHalf = rulesHalf.play(sh, MOVE_CONFIRM);
  assert.equal(resHalf.lastRound.pocketStr, '00');
  assert.equal(resHalf.lastRound.laPartageReturns[0], 50);
  assert.equal(resHalf.lastRound.payouts[0], 50);
  assert.equal(resHalf.chips[0], 1000 - 125 + 50);

  // Without La Partage, '00' takes all
  let so = rulesOff.initial(() => 0.123);
  so = { ...so, rngState: seed00 };
  so = rulesOff.play(so, 3 * 200 + spotById.get('out:red').idx);
  so = rulesOff.play(so, 2 * 200 + spotById.get('doz:1').idx);
  const resOff = rulesOff.play(so, MOVE_CONFIRM);
  assert.equal(resOff.lastRound.laPartageReturns[0], 0);
  assert.equal(resOff.lastRound.payouts[0], 0);
  assert.equal(resOff.chips[0], 875);
}
console.log('   OK: Multipliers (36/18/12/9/6/3/2) & La Partage (0/00) exact.');

console.log('4. Checking rebet, endless rebuy, broke-seat skipping & restoreMatch determinism...');
{
  // Rebet across rounds
  const h = core.newMatch('roulette', 'players=2;rounds=5;startChips=500', '777', '', 'normal');
  const redIdx = spotById.get('out:red').idx;
  const blkIdx = spotById.get('out:black').idx;
  core.playMove(h, 2 * 200 + redIdx); // seat 0: 25 red
  core.playMove(h, MOVE_CONFIRM);
  core.playMove(h, 2 * 200 + blkIdx); // seat 1: 25 black
  core.playMove(h, MOVE_CONFIRM); // spins round 1 -> moves to round 2

  let st = getView(h, 0);
  assert.equal(st.board.roundNo, 2);
  assert.equal(st.board.history.length, 1);
  assert.equal(st.board.canRebet, true);
  assert.ok(core.playMove(h, MOVE_REBET));
  st = getView(h, 0);
  assert.equal(st.board.bets[0]['out:red'], 25);

  // restoreMatch exact equality
  const rec = core.matchRecord(h);
  const hCopy = core.restoreMatch(rec);
  assert.ok(hCopy > 0);
  assert.equal(core.viewJson(h, 0), core.viewJson(hCopy, 0), 'restoreMatch must match byte-for-byte');
  assert.equal(core.viewJson(h, 1), core.viewJson(hCopy, 1));

  // Endless mode rebuy when chips reach 0
  const hEnd = core.newMatch('roulette', 'players=1;rounds=0;startChips=500', '888', '', 'normal');
  let bustLoops = 0;
  while (getView(hEnd, 0).board.chips[0] > 0 && bustLoops < 40) {
    // Bet all-in on s:0 (or s:1) using largest chips until bust
    let cur = getView(hEnd, 0);
    while (cur.board.chips[0] >= 500) {
      core.playMove(hEnd, 4 * 200 + 1);
      cur = getView(hEnd, 0);
    }
    while (cur.board.chips[0] >= 100) {
      core.playMove(hEnd, 3 * 200 + 1);
      cur = getView(hEnd, 0);
    }
    while (cur.board.chips[0] >= 25) {
      core.playMove(hEnd, 2 * 200 + 1);
      cur = getView(hEnd, 0);
    }
    while (cur.board.chips[0] >= 5) {
      core.playMove(hEnd, 1 * 200 + 1);
      cur = getView(hEnd, 0);
    }
    while (cur.board.chips[0] >= 1) {
      core.playMove(hEnd, 0 * 200 + 1);
      cur = getView(hEnd, 0);
    }
    core.playMove(hEnd, MOVE_CONFIRM);
    bustLoops++;
  }
  const stBroke = getView(hEnd, 0);
  assert.equal(stBroke.outcome, null, 'Endless mode should not terminate match when busted');
  assert.equal(stBroke.board.chips[0], 0);
  assert.equal(stBroke.board.canRebuy, true);
  assert.ok(core.playMove(hEnd, MOVE_REBUY));
  const stRebought = getView(hEnd, 0);
  assert.equal(stRebought.board.chips[0], 500);
  assert.equal(stRebought.board.rebuyCounts[0], 1);

  // Finite mode ends immediately if all seats bust
  const hFin = core.newMatch('roulette', 'players=1;rounds=10;startChips=500', '888', '', 'normal');
  let safety = 0;
  while (getView(hFin, 0).outcome === null && safety < 50) {
    let cur = getView(hFin, 0);
    while (cur.board.chips[0] >= 500) { core.playMove(hFin, 4 * 200 + 1); cur = getView(hFin, 0); }
    while (cur.board.chips[0] >= 100) { core.playMove(hFin, 3 * 200 + 1); cur = getView(hFin, 0); }
    while (cur.board.chips[0] >= 25) { core.playMove(hFin, 2 * 200 + 1); cur = getView(hFin, 0); }
    while (cur.board.chips[0] >= 5) { core.playMove(hFin, 1 * 200 + 1); cur = getView(hFin, 0); }
    while (cur.board.chips[0] >= 1) { core.playMove(hFin, 0 * 200 + 1); cur = getView(hFin, 0); }
    core.playMove(hFin, MOVE_CONFIRM);
    safety++;
  }
  const stFin = getView(hFin, 0);
  assert.ok(stFin.outcome != null, 'Finite mode should terminate when all players bust');
}
console.log('   OK: Rebet, endless rebuy, all-bust early termination, and restoreMatch verified.');

console.log('4b. Checking: only one seat left with chips ends the match (2 players), 3+ players continue...');
{
  // 0 番の席が全額(100 枚)を数字 1 つに、1 番の席は 1 枚だけ赤に賭ける。0 番が外れたら 0 枚
  const bust = (players, seed) => {
    const h = core.newMatch('roulette', `players=${players};rounds=10;startChips=100`, String(seed), '', 'normal');
    core.playMove(h, 3 * 200 + 1); core.playMove(h, MOVE_CONFIRM);              // 席0: 100 枚を数字に
    for (let k = 1; k < players; k++) { core.playMove(h, 0 * 200 + spotById.get('out:red').idx); core.playMove(h, MOVE_CONFIRM); }
    return h;
  };
  let checked2 = false, checked3 = false;
  for (let seed = 1; seed < 60 && !(checked2 && checked3); seed++) {
    const h2 = bust(2, seed), v2 = getView(h2, 0);
    if (!checked2 && v2.board.chips?.[0] === 0 || (!checked2 && v2.outcome && v2.board.lastRound.bankrollsAfter[0] === 0)) {
      assert.ok(v2.outcome, '2 players: the match ends at once when one seat has no chips');
      assert.equal(v2.outcome.winner, 1);
      assert.match(v2.outcome.reason, /第1ラウンドで決着/);
      checked2 = true;
    }
    const h3 = bust(3, seed), v3 = getView(h3, 0);
    if (!checked3 && v3.board.lastRound?.bankrollsAfter[0] === 0 && v3.board.lastRound.bankrollsAfter.filter(c => c > 0).length >= 2) {
      assert.equal(v3.outcome, null, '3 players: continues while two or more seats have chips');
      assert.equal(v3.board.roundNo, 2);
      assert.notEqual(v3.board.turn, 0, 'the broke seat is skipped');
      checked3 = true;
    }
  }
  assert.ok(checked2 && checked3, 'found seeds for both cases');
}
console.log('   OK: 2 players end immediately when one is broke; 3 players continue.');

console.log('5. Running CPU playouts across all levels & player counts (1..6)...');
for (const players of [1, 2, 3, 6]) {
  for (let li = 0; li < 3; li++) {
    const level = ['easy', 'normal', 'hard'][li];
    const opts = `players=${players};rounds=5;wheel=${players % 2 === 0 ? 'amer' : 'euro'};laPartage=${level === 'hard' ? 'half' : 'off'}`;
    const h = core.newMatch('roulette', opts, String(9000 + players * 10 + li), '', level);
    let st = getView(h, 0);
    let steps = 0;
    while (st.outcome == null && steps < 500) {
      const mv = core.cpuChoose(h, 50);
      assert.ok(core.playMove(h, mv), `Illegal CPU move ${mv}`);
      st = getView(h, 0);
      steps++;
    }
    assert.ok(st.outcome != null, `CPU playout did not finish (${opts}, ${level})`);
  }
}
console.log('   OK: All CPU difficulty levels & 1..6 player counts finished cleanly.');
console.log('ROULETTE CORE TESTS PASSED!');
