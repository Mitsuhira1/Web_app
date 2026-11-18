import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';

const NEW_IDS = [
  'war',
  'takoyaki',
  'butanoshippo',
  'oldmaid',
  'hearts',
  'ginrummy',
  'vulture',
  'goita',
  'quarto',
  'geister',
  'rummikub',
  'pegsolitaire',
];

function playout(id, optStr = '', maxSteps = 1200) {
  const catalog = JSON.parse(core.catalogJson());
  const entry = catalog.find((g) => g.id === id);
  const pOpt = entry.options.find((o) => o.key === 'players');
  const seats = pOpt
    ? Number((optStr.match(/players=(\d+)/) || [])[1] || pOpt.default)
    : (id === 'pegsolitaire' ? 1 : 2);
  const h = core.newMatch(id, optStr, '12345', '', 'normal');
  assert.ok(h > 0, `${id} newMatch failed`);

  let st = JSON.parse(core.viewJson(h, 0));
  let steps = 0;
  while (st.outcome == null && steps < maxSteps) {
    const mv = core.cpuChoose(h, 50);
    const ok = core.playMove(h, mv);
    assert.ok(ok, `${id} playMove(${mv}) failed at step ${steps}`);
    st = JSON.parse(core.viewJson(h, 0));
    steps++;
  }
  assert.ok(st.outcome != null, `${id} (${optStr}) did not finish within ${maxSteps} steps (last toMove=${st.toMove}, legal=${st.legal.length})`);

  // Verify viewJson
  assert.equal(st.board.kind, id, `${id} board.kind mismatch`);
  if (seats >= 2) {
    const v1 = JSON.parse(core.viewJson(h, 1));
    assert.equal(v1.board.kind, id);
  }
  return { steps, outcome: st.outcome, scores: st.scores, handle: h };
}

console.log('1. Checking catalogJson()...');
const catalog = JSON.parse(core.catalogJson());
assert.equal(catalog.length, 42, `Expected 42 games, got ${catalog.length}`);
for (const id of NEW_IDS) {
  const entry = catalog.find((g) => g.id === id);
  assert.ok(entry, `Missing ${id} in catalog`);
  const rj = JSON.parse(core.rulesJson(id));
  const secs = Array.isArray(rj) ? rj : rj.sections;
  assert.ok(Array.isArray(secs) && secs.length >= 2, `${id} missing sections`);
}
console.log('   OK: 42 games registered, all 12 new games have rulesJson & options.');

console.log('2. Running CPU playouts for all 12 games & local rules...');
const cases = [
  ['war', ''],
  ['war', 'aRule=weak;twoBeatsAce=on;joker=on;winCond=rounds26'],
  ['takoyaki', ''],
  ['takoyaki', 'players=4;wild=jqk_wild;joker=bomb;roundDown=countdown'],
  ['butanoshippo', ''],
  ['butanoshippo', 'players=4;matchRule=suit_only;joker=take_all;handPlay=on'],
  ['oldmaid', ''],
  ['oldmaid', 'players=4;variant=jiji;drawDir=right;shuffleHand=off'],
  ['hearts', ''],
  ['hearts', 'target=100;passRule=none;jd=minus10;shootMoon=sub26'],
  ['ginrummy', ''],
  ['ginrummy', 'target=50;knockRule=oklahoma;aceHigh=both'],
  ['ginrummy', 'target=50;knockRule=straight_gin'],
  ['vulture', ''],
  ['vulture', 'players=5;tieCarry=carry'],
  ['goita', ''],
  ['goita', 'target=100;kingDouble=off;fiveShi=ignore'],
  ['quarto', ''],
  ['quarto', 'square2x2=on'],
  ['geister', ''],
  ['geister', 'setup=random'],
  ['rummikub', ''],
  ['rummikub', 'players=3;initialMeld=off;jokerPenalty=50'],
  ['pegsolitaire', ''],
  ['pegsolitaire', 'board=european'],
  ['pegsolitaire', 'board=triangle'],
];

for (const [id, opts] of cases) {
  const res = playout(id, opts, 2000);
  console.log(`   PASS ${id} [${opts || 'default'}]: ${res.steps} steps -> winner=${res.outcome.winner} (${res.outcome.reason})`);
}

console.log('3. Checking hidden-information masking...');
{
  const hGeister = core.newMatch('geister', 'setup=random', '99', '0,1', 'normal');
  const g0 = JSON.parse(core.viewJson(hGeister, 0)).board;
  const g1 = JSON.parse(core.viewJson(hGeister, 1)).board;
  // Seat 0 sees 3 for seat 1's pieces
  assert.ok(g0.board.some((v, i) => g0.owners[i] === 1 && v === 3), 'Geister seat 0 should see opponent as 3');
  assert.ok(g0.board.some((v, i) => g0.owners[i] === 0 && (v === 1 || v === 2)), 'Geister seat 0 should see own colors');
  assert.ok(g1.board.some((v, i) => g1.owners[i] === 0 && v === 3), 'Geister seat 1 should see opponent as 3');

  const hHearts = core.newMatch('hearts', 'passRule=none', '77', '0,1,2,3', 'normal');
  const ht0 = JSON.parse(core.viewJson(hHearts, 0)).board;
  assert.equal(ht0.myHand.length, 13);
  assert.equal(ht0.handCounts[1], 13);
  assert.equal(ht0.hands, undefined, 'Hearts should only expose myHand');

  const hRummi = core.newMatch('rummikub', '', '55', '0,1', 'normal');
  const rm0 = JSON.parse(core.viewJson(hRummi, 0)).board;
  assert.equal(rm0.racks[0].length, 14);
  assert.equal(rm0.racks[1].length, 0, 'Rummikub seat 0 should not see seat 1 rack');
}
console.log('   OK: Hidden information properly masked per seat.');

console.log('4. Checking undoMove & restoreMatch...');
{
  const hQ = core.newMatch('quarto', '', '11', '0,1', 'normal');
  let st = JSON.parse(core.viewJson(hQ, 0));
  const m0 = st.legal[0];
  core.playMove(hQ, m0);
  st = JSON.parse(core.viewJson(hQ, 0));
  assert.equal(st.board.phase, 'place');
  core.undoMove(hQ);
  st = JSON.parse(core.viewJson(hQ, 0));
  assert.equal(st.board.phase, 'pick');

  // Play 2 moves and test restoreMatch
  const a0 = st.legal[0];
  core.playMove(hQ, a0);
  st = JSON.parse(core.viewJson(hQ, 0));
  const a1 = st.legal[0];
  core.playMove(hQ, a1);
  const rec = core.matchRecord(hQ);
  const hQ2 = core.restoreMatch(rec);
  assert.ok(hQ2 > 0, 'restoreMatch failed');
  assert.equal(core.viewJson(hQ, 0), core.viewJson(hQ2, 0), 'restoreMatch viewJson mismatch');
}
console.log('   OK: undoMove & restoreMatch verified.');
console.log('ALL TESTS PASSED!');
