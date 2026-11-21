// ソリティアの「種類: スパイダー」の規則(core/games/spider.mjs)を、コア経由で通しで確かめる
import assert from 'node:assert/strict';
import * as core from '../../web/pc-firebase/core/asobi-pc-core.mjs';

const cat = JSON.parse(core.catalogJson()).find((g) => g.id === 'solitaire');
assert.equal(cat.name, 'ソリティア');
assert.equal(cat.options.find((o) => o.key === 'variant').default, 'klondike');

for (const opt of ['variant=spider;suits=1;players=1', 'variant=spider;suits=2;players=1', 'variant=spider;suits=4;players=2']) {
  for (let seed = 1; seed <= 5; seed++) {
    const h = core.newMatch('solitaire', opt, String(seed), '', 'normal');
    let v = JSON.parse(core.viewJson(h, 0));
    assert.equal(v.board.variant, 'spider');
    assert.equal(v.board.piles.reduce((a, p) => a + p.length, 0) + v.board.stock, 104);
    let steps = 0;
    while (v.outcome == null && steps < 3000) {
      const m = core.cpuChoose(h, 50);
      assert.ok(core.playMove(h, m), `${opt} seed ${seed}: move ${m} rejected`);
      v = JSON.parse(core.viewJson(h, 0)); steps++;
      const b = v.board;
      assert.equal(b.piles.reduce((a, p) => a + p.length, 0) + b.stock + b.done.length * 13, 104, 'card count');
    }
    assert.ok(v.outcome != null, `${opt} seed ${seed} did not finish`);
  }
}
// クロンダイクは従来どおり
const hk = core.newMatch('solitaire', 'variant=klondike', '7', '', 'normal');
assert.equal(JSON.parse(core.viewJson(hk, 0)).board.variant, undefined);
console.log('spider core OK');
