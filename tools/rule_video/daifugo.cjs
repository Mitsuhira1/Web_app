// 大富豪のルール動画(8 本)。使い方:
//   python3 -m http.server -d web 8400 &   (リポジトリの一番上で)
//   node tools/rule_video/daifugo-plan.mjs          (手順を変えた時だけ。daifugo-steps.json を作り直す)
//   node tools/rule_video/daifugo.cjs [出力フォルダ] [ステップ番号...]
// 出力: df-v2-step1.mp4 〜 df-v2-step8.mp4(既定は web/pc-firebase/assets/rule-steps/)
// 配り方は seed 5095(4 人・既定のルール)。CPU の手は台本どおり(規則はアプリのまま)。
const path = require('path');
const { launch, openGame, replay, record } = require('./engine.cjs');
const PLAN = require('./daifugo-steps.json');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../web/pc-firebase/assets/rule-steps'));
const ONLY = process.argv.slice(3).map(Number);
const K = 0.8;

// ページの中で使う、大富豪用の小道具(T は overlay.js)
const HELP = () => {
  const D = (window.D = {});
  const card = (id) => document.querySelector(`#boardwrap .hand2 [data-card="${id}"]`);
  const btn = (label) => [...document.querySelectorAll('#acts button')].find((b) => b.textContent.trim().startsWith(label));
  // 重なった手札は、見えている左側を指す
  const cardPt = (id) => { const r = card(id).getBoundingClientRect(); return [r.left + 26, r.top + 46]; };
  D.card = card; D.cards = (ids) => ids.map(card);
  D.seat = (s) => document.querySelector(`#boardwrap .tseat[data-seat="${s}"]`);
  D.pick = async (ids) => {
    for (const id of ids) {
      T.cursorOn(); await T.cursorTo({ page: cardPt(id) }, 800); await T.sleep(250);
      await T.press(card(id)); await T.sleep(650);
    }
  };
  D.press = async (label) => {
    const b = btn(label); if (!b) throw new Error('ボタンなし ' + label);
    const r = b.getBoundingClientRect(); T.cursorOn(); await T.cursorTo({ page: [r.left + r.width / 2, r.top + r.height / 2] }, 900); await T.sleep(250);
    const n = view.moves; await T.press(btn(label)); await T.until(() => view.moves > n);
  };
  // 自分の番になり、「あなたの番です」が出終わるまで待つ
  D.myTurn = () => T.until(() => view && view.human && !busy && !document.querySelector('#cutlayer .cutin') && performance.now() > turnPending && performance.now() > animUntil);
  // CPU を 1 手だけ進める
  D.cpu = async () => { const n = view.moves; window.__hold = false; await T.until(() => view.moves > n); window.__hold = true; await T.until(() => performance.now() > animUntil); };
  D.calm = () => T.until(() => !document.querySelector('#cutlayer .cutin') && performance.now() > animUntil);
  // 名札の場所: 部品の上・下
  D.above = (el, dy = 20) => { const r = el.getBoundingClientRect(); return { page: [r.left + r.width / 2, r.top - dy] }; };
  D.below = (el, dy = 20) => { const r = el.getBoundingClientRect(); return { page: [r.left + r.width / 2, r.bottom + dy] }; };
  D.setup = () => {
    // 説明の文は右の側板の空いた欄(「手数」の下)に出す。卓の上は手札・場・席で埋まっているため
    const note = document.querySelector('#sidenote'), side = note.closest('.side').getBoundingClientRect(), nr = note.getBoundingClientRect();
    const last = [...note.children].reduce((b, e) => Math.max(b, e.getBoundingClientRect().bottom), nr.top);
    T.capBox = { left: nr.left + 2, top: last + 18, width: nr.width - 4, maxH: side.bottom - last - 30 };
    T.avoid(['#boardwrap .pc', '#boardwrap .tseat', '#boardwrap .pinfo', '#boardwrap .pile2 .none', '#acts button', '#strip .pl', '#status', '.stagehead', '.side .ops button']);
  };
};

// ---- 1. 何をするゲーム?
const step1 = async () => {
  D.setup();
  await T.sleep(700);
  T.ring('hand', { el: '#boardwrap .hand2', pad: 2, rr: 14 });
  { const r = document.querySelector('#boardwrap .hand2').getBoundingClientRect(); T.label('handl', 'あなたの手札', { page: [r.left + 92, r.top - 12] }, { for: 'hand' }); }
  await T.cap('大富豪は、手札を<em>早く全部 出した人</em>が勝ちのゲームです');
  await T.sleep(5200);
  T.clear('hand', 'handl');
  await T.sleep(300);
  // 順番(自分 → 左 → 上 → 右)
  await T.cap('4人で、矢印の順番に 札を出していきます');
  const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const me = c(document.querySelector('#boardwrap .myseat')), s1 = c(D.seat(1)), s2 = c(D.seat(2)), s3 = c(D.seat(3));
  const P = (a, q, b) => `M ${a[0]} ${a[1]} Q ${q[0]} ${q[1]} ${b[0]} ${b[1]}`;
  T.arrow('a1', P([me[0] - 80, me[1] - 6], [s1[0] + 60, me[1] - 10], [s1[0] + 10, s1[1] + 30]), { page: true, w: 7 }); await T.sleep(900);
  T.arrow('a2', P([s1[0] + 10, s1[1] - 30], [s1[0] + 60, s2[1] + 10], [s2[0] - 80, s2[1] + 6]), { page: true, w: 7 }); await T.sleep(900);
  T.arrow('a3', P([s2[0] + 80, s2[1] + 6], [s3[0] - 60, s2[1] + 10], [s3[0] - 10, s3[1] - 30]), { page: true, w: 7 }); await T.sleep(900);
  T.arrow('a4', P([s3[0] - 10, s3[1] + 30], [s3[0] - 60, me[1] - 10], [me[0] + 80, me[1] - 6]), { page: true, w: 7 });
  await T.sleep(3600);
  T.clear('a1', 'a2', 'a3', 'a4');
  await T.sleep(300);
  { const r = document.querySelector('#boardwrap .pile2').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    T.ring('ba', { page: { x: cx - 130, y: cy - 62, w: 260, h: 124, rr: 18 } }); }
  await T.cap('札は、まん中の<em>「場」</em>に出します');
  await T.sleep(4300);
  T.clear('ba');
  await T.sleep(300);
  const hand = [...document.querySelectorAll('#boardwrap .hand2 [data-card]')];
  const first = hand[0], lastTwo = hand.slice(-2);
  T.label('weak', '弱い', D.above(first, 24)); T.label('strong', '強い', D.above(lastTwo[1], 24));
  await T.cap('手札は、<em>左が弱く 右ほど強い</em>順に 並んでいます');
  await T.sleep(4600);
  T.clear('weak', 'strong');
  T.ring('c3', { el: first, pad: 3, rr: 10 }); T.ring('c2', { els: lastTwo, pad: 3, rr: 10 });
  await T.cap('<em>3</em>がいちばん弱く、<em>2</em>がいちばん強い。<em>ジョーカー</em>は 2より強い札です');
  await T.sleep(6000);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 2. 札の出し方(1 枚)。CPU 4 ♦3 → あなた ♦5 → CPU 2 ♣6 → CPU 3 ♠9 → CPU 4 ♠10
const step2 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await T.cap('前の人が出した札より<em>強い札</em>を、順番に出していきます');
  await T.sleep(2600);
  await D.cpu();
  await T.sleep(800);
  T.ring('f', { els: '#boardwrap .pile2 .pc', pad: 5, rr: 10 }); T.label('fl', '前の人の札', D.above(document.querySelector('#boardwrap .pile2'), 22), { for: 'f' });
  await D.myTurn();
  await T.cap('場の<em>3</em>より強い札を、<em>1枚</em>出します');
  await T.sleep(3800);
  T.clear('f', 'fl');
  await T.cap('出す札を選んで、<em>「出す」</em>を押します');
  await T.sleep(800);
  await D.pick(human[0].cards);
  await T.sleep(500);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(1200);
  await T.cap('次の人も、もっと強い札を出していきます');
  await T.sleep(1200);
  for (let k = 0; k < 3; k++) { await D.cpu(); await T.sleep(900); }
  await D.myTurn(); // 「あなたの番です」が出終わってから
  await T.sleep(400);
  await T.cap('こうして、だんだん強い札に なっていきます');
  await T.sleep(4200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 3. 同じ数をまとめて出す。CPU 4 ♥3♦3 → あなた ♥8♣8 → CPU 2 ♠Q♥Q → CPU 3 パス → CPU 4 パス
const step3 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.cpu();
  await T.sleep(700);
  T.ring('f', { els: '#boardwrap .pile2 .pc', pad: 5, rr: 10 });
  await T.cap('同じ数の札は、<em>2枚・3枚</em> まとめて出せます');
  await D.myTurn();
  await T.sleep(3600);
  T.clear('f');
  T.ring('h', { els: D.cards(human[0].cards), pad: 4, rr: 10 });
  await T.cap('場が2枚なら、こちらも<em>2枚</em>で、もっと強い数を出します');
  await T.sleep(4200);
  T.clear('h');
  await D.pick(human[0].cards);
  await T.sleep(400);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.cap(null);
  await T.sleep(800);
  await D.cpu(); await T.sleep(900);
  await D.cpu(); await T.sleep(600);
  await D.cpu();
  await D.myTurn(); // 「あなたの番です」が出終わってから
  await T.sleep(500);
  T.ring('p2', { el: D.seat(2).querySelector('.tnote') || D.seat(2), pad: 4, rr: 10 }); T.ring('p3', { el: D.seat(3).querySelector('.tnote') || D.seat(3), pad: 4, rr: 10 });
  await T.cap('出せない時や、出したくない時は<br><em>「パス」</em>します');
  await T.sleep(5200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 4. 場が流れる・親。CPU 4 ♦3 → あなた ♠2 → 3 人パス → 流れる → あなたが親で ♣3
const step4 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.cpu();
  await D.myTurn();
  await T.sleep(500);
  T.ring('h', { el: D.card(human[0].cards[0]), pad: 3, rr: 10 });
  await T.cap('強い<em>2</em>を出してみます');
  await T.sleep(2800);
  T.clear('h');
  await D.pick(human[0].cards);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(600);
  await T.cap('ほかの人が<em>全員パス</em>すると…');
  await T.sleep(1000);
  for (let k = 0; k < 3; k++) { await D.cpu(); await T.sleep(800); }
  await T.cap(null);
  await D.myTurn();
  await T.sleep(1200);
  T.ring('me', { el: '#boardwrap .myseat', pad: 4, rr: 20 }); T.label('mel', '親', D.above(document.querySelector('#boardwrap .myseat'), 22), { for: 'me' });
  await T.cap('場の札が片づけられ（<em>「場が流れる」</em>）、<br>最後に出した人が<em>「親」</em>になります');
  await T.sleep(5600);
  T.clear('me', 'mel');
  await T.cap('親は、好きな札を 好きな枚数で出せます');
  await T.sleep(1500);
  await D.pick(human[1].cards);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(3200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 5. 階段。あなたが親で ♥7♥8♥9 → 3 人パス
const step5 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.myTurn();
  T.ring('h', { els: D.cards(human[0].cards), pad: 4, rr: 10 }); T.label('hl', '階段', D.above(D.card(human[0].cards[1]), 26), { for: 'h' });
  await T.cap('同じマークで、<em>3枚以上 続いた数</em>を<br><em>「階段」</em>と言います');
  await T.sleep(5200);
  T.clear('h', 'hl');
  await T.cap('階段も、まとめて出せます');
  await T.sleep(800);
  await D.pick(human[0].cards);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(800);
  await T.cap('階段には、同じ枚数の<em>もっと強い階段</em>しか<br>出せません');
  await T.sleep(1500);
  for (let k = 0; k < 3; k++) { await D.cpu(); await T.sleep(800); }
  await T.cap(null);
  await D.myTurn(); // 「あなたの番です」には重ねない
  await T.sleep(1200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 6. 革命。あなたが親で K を 4 枚 → 3 人パス → 流れる → あなた ♥J → CPU 2 ♣5
const step6 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.myTurn();
  T.ring('h', { els: D.cards(human[0].cards), pad: 4, rr: 10 });
  await T.cap('同じ数の札を<em>4枚</em> まとめて出すと…');
  await T.sleep(4000);
  T.clear('h');
  await T.cap(null);
  await D.pick(human[0].cards);
  await D.press('出す');
  T.cursorHide();
  // 「革命」のカットインが出た時は、それには重ねない(2026-11-28 時点のアプリでは、このカットインは出ない)
  await T.sleep(600);
  await D.calm();
  await T.sleep(800);
  T.ring('tag', { el: '#boardwrap .tag2.red', pad: 4, rr: 10 });
  await T.cap('<em>「革命」</em>です。札の強さが<em>逆</em>になります');
  await T.sleep(4600);
  T.clear('tag');
  await T.cap('3がいちばん強く、2がいちばん弱くなります');
  await T.sleep(3000);
  for (let k = 0; k < 3; k++) { await D.cpu(); await T.sleep(700); }
  await T.cap(null);
  await D.myTurn();
  await T.sleep(600);
  await D.pick(human[1].cards);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(600);
  await D.cpu();
  await T.sleep(900);
  T.ring('f', { els: '#boardwrap .pile2 .pc', pad: 5, rr: 10 });
  await T.cap('革命の間は、<em>小さい数</em>の方が強いので、<br>Jに 5を出せます');
  await T.sleep(5400);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 7. 上がり。あなたの手札は ♥7 だけ。場の ♠6 に出して 1 位
const step7 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.myTurn();
  T.ring('h', { el: D.card(human[0].cards[0]), pad: 3, rr: 10 });
  await T.cap('あなたの手札は、あと<em>1枚</em>です');
  await T.sleep(3800);
  await T.cap('最後の札を出して 手札がなくなったら<br><em>「上がり」</em>です');
  await T.sleep(3200);
  T.clear('h');
  await D.pick(human[0].cards);
  await D.press('出す');
  T.cursorHide();
  await D.calm();
  await T.sleep(1200);
  { const me = document.querySelector('#boardwrap .myseat'); T.ring('me', { els: [me, ...me.querySelectorAll('.tnote')], pad: 4, rr: 16 }); }
  T.ring('row', { el: document.querySelector('#strip .pl'), pad: 3, rr: 12 });
  await T.cap('上がった順に、<em>順位</em>が決まります');
  await T.sleep(4400);
  T.clear('me', 'row');
  await T.cap('残りの人で続けて、全員の順位が決まったら<br>その回は おしまいです');
  await T.sleep(5000);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 8. 身分と札の交換(2 回戦の初め)。あなた(大富豪)が ♥3♥5 を渡す → CPU 3(富豪)が 1 枚渡す
const step8 = async ({ human }) => {
  D.setup();
  await T.sleep(600);
  await D.myTurn();
  T.ring('st', { el: '#strip', pad: 4, rr: 14 });
  await T.cap('前の回の順位で<em>「身分」</em>が決まります');
  await T.sleep(3400);
  await T.cap('1位 <em>大富豪</em>、2位 <em>富豪</em>、<br>3位 <em>貧民</em>、4位 <em>大貧民</em>');
  await T.sleep(4600);
  T.clear('st');
  await T.cap('2回目からは、始める前に<em>札を交換</em>します');
  await T.sleep(4000);
  await T.cap('大貧民の いちばん強い札<em>2枚</em>が、<br>大富豪のあなたに 来ています');
  await T.sleep(5200);
  T.ring('h', { els: D.cards(human[0].cards), pad: 4, rr: 10 });
  await T.cap('かわりに、いらない札を<em>2枚</em>選んで<br>大貧民に渡します');
  await T.sleep(3800);
  T.clear('h');
  await D.pick(human[0].cards);
  await D.press('渡す');
  T.cursorHide();
  await D.calm();
  await T.sleep(800);
  await T.cap('富豪と貧民も、<em>1枚ずつ</em> 交換します');
  await T.sleep(1200);
  await D.cpu();
  await T.sleep(2600);
  T.ring('s3', { el: D.seat(3), pad: 4, rr: 20 });
  await T.cap('交換が終わったら、<em>大貧民</em>から始めます');
  await T.sleep(4600);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

const RUN = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7, 8: step8 };

(async () => {
  for (const n of Object.keys(RUN).map(Number)) {
    if (ONLY.length && !ONLY.includes(n)) continue;
    const P = PLAN[n];
    const env = await launch();
    try {
      // CPU の手は、見せない手の分も見せる手の分も、始める前に全部入れておく(CPU が自分で考えた手を打たないように)
      const cpuQ = [...P.prefix.filter((_, k) => !P.who[k]), ...P.cpu];
      await openGame(env, 'daifugo', null, { seed: '5095', cpuQ, hold: true });
      await env.page.waitForFunction(() => view && !document.querySelector('#cutlayer .cutin'), null, { timeout: 60000 });
      if (P.prefix.length) await replay(env, P.prefix, P.who, { queued: true });
      const got = await env.page.evaluate(() => ({ moves: view.moves, q: window.__cpuQ.length, field: view.board.zones[0].cards.map((c) => c.t) }));
      if (got.moves !== P.prefix.length || got.q !== P.cpu.length || got.field.join() !== P.start.field.join()) throw new Error(`step${n}: 局面が台本と違う ${JSON.stringify(got)}`);
      await env.page.evaluate(`(${HELP})()`);
      await record(env, path.join(OUT, `df-v2-step${n}.mp4`), RUN[n].toString(), { human: P.human }, K);
    } catch (e) { console.log(`step${n} 失敗: ${String(e.message).split('\n')[0]}`); process.exitCode = 1; } finally { await env.browser.close(); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
