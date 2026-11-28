// 大富豪のルール動画の台本の手を作る(配り方 seed 5095)。札の名前で書いた手を、規則どおりに出せるか確かめて手の番号にし、daifugo-steps.json に書く。
// 使い方: node tools/rule_video/daifugo-plan.mjs
import { core, game, st, name, rank, movesCards } from './daifugo-sim.mjs';
const SEQ = [102,742,808,872,0,1,0,0,430,0,0,557,749,0,744,0,0,0,232,0,294,0,869,0,165,0,229,0,486,550,614,0,108,166,230,293,358,0,485,0,101,172,236,296,357,0,552,0,364,421,488,620,0,0,684,806,870,0,0,168,805,0,876,300,424,677,0,360,0,678,0,680,0,812];
// 手の書き方: 'パス' か、札の名前を空白で(例 '♥8 ♣8')
const STEPS = {
  1: { prefix: [], plays: [] },
  2: { prefix: [], plays: ['♦3', '♦5', '♣6', '♠9', '♠10'] },
  3: { prefix: [], plays: ['♥3 ♦3', '♥8 ♣8', '♠Q ♥Q', 'パス', 'パス'] },
  4: { prefix: [], plays: ['♦3', '♠2', 'パス', 'パス', 'パス', '♣3'] },
  5: { prefixPlays: ['♦3', '♠2', 'パス', 'パス', 'パス'], plays: ['♥7 ♥8 ♥9', 'パス', 'パス', 'パス'] },
  6: { prefixPlays: ['♦3', '♠2', 'パス', 'パス', 'パス'], plays: ['♠K ♥K ♦K ♣K', 'パス', 'パス', 'パス', '♥J', '♣5'] },
  7: { prefix: SEQ.slice(0, 36), plays: ['♥7'] },
  8: { prefix: SEQ, plays: ['♥3 ♥5', '♠3'] },
};
const key = (cs) => cs.map(name).sort().join(' ');
const out = {};
for (const [n, S] of Object.entries(STEPS)) {
  const h = game(5095); const prefix = (S.prefix || []).slice(); const who = [];
  for (const m of prefix) { who.push(st(h).tm === 0); core.playMove(h, m); }
  const doPlay = (p) => { const s = st(h); const ms = movesCards(h); const want = p === 'パス' ? '' : p.split(' ').sort().join(' ');
    const f = ms.find(([, cs]) => key(cs) === want); if (!f) throw new Error(`step${n}: ${p} が出せない(seat${s.tm}) 候補: ${ms.map(([, cs]) => key(cs) || 'パス').join(', ')}`);
    core.playMove(h, f[0]); return { seat: s.tm, m: f[0], cards: f[1], phase: s.t.phase }; };
  for (const p of S.prefixPlays || []) { const r = doPlay(p); prefix.push(r.m); who.push(r.seat === 0); }
  const s0 = st(h);
  const plays = S.plays.map(doPlay);
  out[n] = { prefix, who, cpu: plays.filter((x) => x.seat !== 0).map((x) => x.m), human: plays.filter((x) => x.seat === 0).map((x) => ({ m: x.m, cards: x.cards })), order: plays.map((x) => x.seat), start: { toMove: s0.tm, field: s0.field.map(name), hand0: s0.hand(0).length } };
  console.log(n, JSON.stringify(out[n].start), 'order', out[n].order.join(''), 'human', out[n].human.map((x) => x.cards.map(name).join('')).join(' / '), 'rev', st(h).t.rev);
  core.dropMatch(h);
}
import fs from 'fs'; fs.writeFileSync(new URL('./daifugo-steps.json', import.meta.url), JSON.stringify(out));
