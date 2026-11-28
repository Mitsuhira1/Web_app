// 将棋のルール動画(7 本)。使い方:
//   python3 -m http.server -d web 8400 &   (リポジトリの一番上で)
//   node tools/rule_video/shogi-plan.mjs          (手順を変えた時だけ。shogi-steps.json を作り直す)
//   node tools/rule_video/shogi.cjs [出力フォルダ] [ステップ番号...]
// 出力: sh-v2-step1.mp4 〜 sh-v2-step7.mp4(既定は web/pc-firebase/assets/rule-steps/)
// 局面は CPU 上級(先手)と CPU 初級(後手)の一局(shogi-game.json、47 手で詰み)から取り出す。CPU の手は台本どおり。
const path = require('path');
const { launch, openGame, replay, record } = require('./engine.cjs');
const PLAN = require('./shogi-steps.json');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../web/pc-firebase/assets/rule-steps'));
const ONLY = process.argv.slice(3).map(Number);
const K = 0.8;
const FILE = {}; // 録り直した物は新しい名前にする(端末のキャッシュで古い版が見え続けるため)

// ページの中で使う、将棋用の小道具(T は overlay.js)
const HELP = () => {
  const S = (window.SG = {});
  S.cell = (i) => document.querySelector(`#boardwrap .scell[data-i="${i}"]`);
  S.hand = (k) => document.querySelector(`#boardwrap .komadai.bottom [data-hand="${k}"]`);
  const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  S.tap = async (el, ms = 900) => { T.cursorOn(); await T.cursorTo({ page: mid(el) }, ms); await T.sleep(250); await T.press(el); };
  // 駒を選ぶ(行けるマスに点が出る)
  S.pick = async (h) => { await S.tap(h.from >= 81 ? S.hand(h.from - 81) : S.cell(h.from)); await T.sleep(400); };
  // 行き先を押す。成るかを聞かれたら、そのまま止める(呼んだ側で「成る」を押す)
  S.to = async (h) => { const n = view.moves; await S.tap(S.cell(h.to), 1000); await T.until(() => view.moves > n || document.querySelector('#sheet')); };
  S.press = async (sel) => { const n = view.moves; await S.tap(document.querySelector(sel), 900); await T.until(() => view.moves > n); };
  S.myTurn = () => T.until(() => view && view.human && !busy && !document.querySelector('#cutlayer .cutin') && performance.now() > animUntil);
  S.cpu = async () => { const n = view.moves; window.__hold = false; await T.until(() => view.moves > n); window.__hold = true; await T.until(() => performance.now() > animUntil); };
  S.calm = () => T.until(() => !document.querySelector('#cutlayer .cutin') && performance.now() > animUntil);
  // 盤のマスの囲み(マスと同じ大きさ)・いくつかの段をまとめた囲み
  S.cellRing = (id, i, o) => T.ring(id, { el: S.cell(i), pad: 1, rr: 6 }, o);
  S.rows = (r0, r1) => ({ els: [S.cell(r0 * 9), S.cell(r1 * 9 + 8)], pad: 3, rr: 10 });
  S.setup = () => {
    // 説明の文は右の側板の空いた欄(「手数」の下)。盤の上は駒で埋まっているため
    const note = document.querySelector('#sidenote'), side = note.closest('.side').getBoundingClientRect(), nr = note.getBoundingClientRect();
    const last = [...note.children].reduce((b, e) => Math.max(b, e.getBoundingClientRect().bottom), nr.top);
    S.sideBox = { left: nr.left + 2, top: last + 18, width: nr.width - 4, maxH: side.bottom - last - 30 };
    T.capBox = S.sideBox;
    T.avoid(['#boardwrap .koma', '#boardwrap .komadai .hk', '#boardwrap .komadai .none', '#strip .pl', '#status', '.stagehead', '.side .ops button', '#sheet', '#listbody .ptabs button', '#listbody .pgrid', '#listbody .pguide p', '.mhd']);
  };
  // 盤の右上・左下の空いた所(名札を置く)
  S.free = (where) => { const b = document.querySelector('#boardwrap .sboard').getBoundingClientRect(), w = document.querySelector('#boardwrap').getBoundingClientRect();
    return where === 'rightTop' ? [(b.right + w.right) / 2, b.top + 40] : [(w.left + b.left) / 2, b.bottom - 40]; };
};

// ---- 1. 何をするゲーム?
const step1 = async () => {
  SG.setup();
  await T.sleep(700);
  SG.cellRing('ok', 4);
  await T.cap('将棋は、相手の<em>「玉」</em>を<br>逃げられなくした方が 勝ちのゲームです');
  await T.sleep(5600);
  T.clear('ok');
  SG.cellRing('mk', 76);
  await T.cap('自分の<em>「王」</em>は、取られないように 守ります');
  await T.sleep(4600);
  T.clear('mk');
  await T.sleep(300);
  T.ring('mine', SG.rows(6, 8)); T.label('minel', 'あなたの駒', { page: SG.free('leftBottom') }, { for: 'mine' });
  T.ring('opp', SG.rows(0, 2)); T.label('oppl', '相手の駒', { page: SG.free('rightTop') }, { for: 'opp' });
  await T.cap('上向きの駒が あなたの駒、逆さまの駒が 相手の駒です');
  await T.sleep(5600);
  T.clear('mine', 'minel', 'opp', 'oppl');
  await T.sleep(300);
  T.ring('dai', { el: '#boardwrap .komadai.bottom', pad: 3, rr: 14 });
  await T.cap('取った相手の駒は、ここ(<em>駒台</em>)に置かれ、<br>自分の駒として 使えます');
  await T.sleep(5600);
  T.clear('dai');
  await T.cap('2人で、<em>1手ずつ交互</em>に 駒を動かします');
  await T.sleep(4300);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 2. 駒の動かし方。▲7六歩 → △3四歩
const step2 = async ({ human }) => {
  SG.setup();
  await T.sleep(600);
  const h = human[0];
  T.cursorShow({ page: [600, 640] });
  await T.cap('動かしたい駒を 押します');
  await T.sleep(1600);
  await SG.pick(h);
  await T.sleep(500);
  SG.cellRing('dot', h.to);
  await T.cap('行けるマスに<em>点</em>が出ます');
  await T.sleep(3800);
  T.clear('dot');
  await T.cap('点のマスを押すと、駒が動きます');
  await T.sleep(1600);
  await SG.to(h);
  T.cursorHide();
  await SG.calm();
  await T.sleep(1200);
  await T.cap('次は 相手の番です');
  await T.sleep(1500);
  await SG.cpu();
  await T.sleep(1200);
  await T.cap('こうして、<em>1手ずつ交互</em>に 指していきます');
  await T.sleep(4300);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 3. 駒の動き(「駒の一覧」の図で見せる)
const step3 = async () => {
  SG.setup();
  await T.sleep(600);
  T.cursorShow({ page: [1000, 600] });
  await T.cap('駒の動きは、<em>「駒の一覧」</em>で見られます');
  await T.sleep(2200);
  const lb = document.querySelector('[data-list]');
  T.ring('lb', { el: lb, pad: 3, rr: 12 });
  await T.sleep(1600);
  T.clear('lb');
  await SG.tap(lb, 900);
  await T.until(() => document.querySelector('#listbody .pgrid'));
  await T.cap(null);
  await T.sleep(700);
  // 一覧の中の空いた所(図の右下)に説明の文を出す
  { const g = document.querySelector('#listbody .pgrid').getBoundingClientRect(), p = document.querySelector('#listbody .pguide p').getBoundingClientRect(), mb = document.querySelector('#listbody').closest('.mbox').getBoundingClientRect();
    T.capBox = { left: p.left, top: p.bottom + 16, width: mb.right - p.left - 22, maxH: g.bottom - p.bottom - 20 }; }
  const tab = (t) => [...document.querySelectorAll('#listbody .ptabs button')].find((b) => b.textContent.trim() === t);
  const show = async (t, ms) => { await SG.tap(tab(t), 700); await T.sleep(ms); };
  await T.cap('赤い点が、行けるマスです');
  await T.sleep(3000);
  await show('玉', 3000);
  await show('金', 3000);
  await show('銀', 3000);
  await show('桂', 600);
  await T.cap('桂は、間の駒を<em>跳び越せます</em>');
  await T.sleep(3600);
  await T.cap(null);
  await show('歩', 2800);
  await show('香', 3400);
  await show('角', 3400);
  await show('飛', 3400);
  T.cursorHide();
  await T.sleep(600);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 4. 駒を取る。▲2四飛(2八)が △2四の歩を取る
const step4 = async ({ human }) => {
  SG.setup();
  await T.sleep(600);
  const h = human[0];
  SG.cellRing('t', h.to);
  await T.cap('相手の駒がいるマスに動くと、<br>その駒を<em>取れます</em>');
  await T.sleep(4600);
  T.clear('t');
  await SG.pick(h);
  await T.sleep(1600);
  await SG.to(h);
  T.cursorHide();
  await T.cap(null); // 取った駒が駒台へ飛ぶ動きには重ねない
  await SG.calm();
  await T.sleep(900);
  T.ring('dai', { el: '#boardwrap .komadai.bottom', pad: 3, rr: 14 });
  await T.cap('取った駒は、自分の<em>「持ち駒」</em>になります');
  await T.sleep(5000);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 5. 持ち駒を打つ。▲2二歩打 → △2八歩打
const step5 = async ({ human }) => {
  SG.setup();
  await T.sleep(600);
  const h = human[0];
  T.ring('hk', { el: SG.hand(h.from - 81), pad: 3, rr: 10 });
  await T.cap('持ち駒は、自分の番に<br>空いているマスへ<em>「打つ」</em>ことができます');
  await T.sleep(4800);
  T.clear('hk');
  await SG.pick(h);
  await T.sleep(800);
  await T.cap('持ち駒を押すと、打てるマスに 点が出ます');
  await T.sleep(3400);
  // 点が 1 列だけなのは「二歩」のため(見ただけでは理由が分からないので説明する)
  await T.cap('歩は、自分の歩が<em>ない縦の列</em>にしか打てません。同じ列に歩を2枚置く<em>「二歩」</em>は反則です');
  await T.sleep(6400);
  await SG.to(h);
  T.cursorHide();
  await SG.calm();
  await T.sleep(900);
  await T.cap('打った駒は、自分の駒として 動かせます');
  await T.sleep(3800);
  await T.cap('相手も、取った駒を 打ってきます');
  await T.sleep(1400);
  await SG.cpu();
  await T.sleep(1000);
  SG.cellRing('op', PLAN_OPDROP);
  await T.sleep(3200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 6. 成る。▲2二飛成(2八)
const step6 = async ({ human }) => {
  SG.setup();
  await T.sleep(600);
  const h = human[0];
  T.ring('camp', SG.rows(0, 2)); T.label('campl', '敵陣', { page: SG.free('rightTop') }, { for: 'camp' });
  await T.cap('相手の側の 3段を<em>「敵陣」</em>と言います');
  await T.sleep(4600);
  await T.cap('敵陣に入った駒は、<em>「成る」</em>ことができます');
  await T.sleep(3800);
  T.clear('camp', 'campl');
  await SG.pick(h);
  await T.sleep(1200);
  await SG.to(h);
  await T.until(() => document.querySelector('#sheet [data-y]'));
  await T.sleep(600);
  await T.cap('「成る」を選びます');
  await T.sleep(2400);
  await SG.press('#sheet [data-y]');
  T.cursorHide();
  await T.cap(null);
  await SG.calm();
  await T.sleep(900);
  SG.cellRing('ry', h.to);
  await T.cap('成ると駒が 裏返って、強くなります。<br>飛車は<em>「龍」</em>になり、斜めにも 1マス動けます');
  await T.sleep(6200);
  T.clear('ry');
  await T.cap('成った駒の動きも、「駒の一覧」で見られます');
  await T.sleep(4300);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 7. 王手と詰み。▲6一角打(王手)→ △7四玉 → ▲7五金打(詰み)
const step7 = async ({ human }) => {
  SG.setup();
  await T.sleep(600);
  const [h1, h2] = human;
  await T.cap('角を打って、相手の玉を ねらいます');
  await T.sleep(2400);
  await SG.pick(h1);
  await T.sleep(900);
  await SG.to(h1);
  T.cursorHide();
  await T.cap(null);
  // 「王手」のカットインには重ねない
  await T.until(() => document.querySelector('#cutlayer .cutin'));
  await SG.calm();
  await T.sleep(700);
  await T.cap('次に玉を取れる状態を<em>「王手」</em>と言います。<br>王手をされたら、必ず防ぎます');
  await T.sleep(5600);
  await SG.cpu();
  await T.sleep(1200);
  window.__holdResult = true;
  await T.cap('玉の頭に、金を打ちます');
  await T.sleep(2200);
  await SG.pick(h2);
  await T.sleep(900);
  await SG.to(h2);
  T.cursorHide();
  await T.cap(null);
  await SG.calm();
  await T.sleep(1000);
  SG.cellRing('ok', PLAN_KING);
  await T.cap('玉が どこへ逃げても 取られます。<br>これを<em>「詰み」</em>と言い、詰ませた方の勝ちです');
  await T.sleep(6400);
  await T.cap(null); T.clearAll();
  await T.sleep(600);
  window.__holdResult = false; window.__resultPending && window.__resultPending();
  await T.until(() => document.querySelector('#cutlayer .cutin'));
  await T.until(() => !document.querySelector('#result').hidden);
  await T.sleep(3800);
};

const RUN = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7 };
// 台本の中で使う、局面から決まる数(相手が打ったマス・詰んだ玉のマス)
const CONST = { 5: { PLAN_OPDROP: ((PLAN[5].cpu[0] >> 1) & 127) }, 7: { PLAN_KING: ((PLAN[7].cpu[0] >> 1) & 127) } };

(async () => {
  for (const n of Object.keys(RUN).map(Number)) {
    if (ONLY.length && !ONLY.includes(n)) continue;
    const P = PLAN[n];
    const env = await launch();
    try {
      const cpuQ = [...P.prefix.filter((_, k) => !P.who[k]), ...P.cpu];
      await openGame(env, 'shogi', null, { cpuQ, hold: true });
      await env.page.waitForFunction(() => view && !document.querySelector('#cutlayer .cutin'), null, { timeout: 60000 });
      if (P.prefix.length) await replay(env, P.prefix, P.who, { queued: true });
      const got = await env.page.evaluate(() => ({ moves: view.moves, q: window.__cpuQ.length }));
      if (got.moves !== P.prefix.length || got.q !== P.cpu.length) throw new Error(`step${n}: 局面が台本と違う ${JSON.stringify(got)}`);
      await env.page.evaluate(`(${HELP})()`);
      const consts = Object.entries(CONST[n] || {}).map(([k, v]) => `const ${k} = ${v};`).join('');
      const src = RUN[n].toString().replace(/^async \(([^)]*)\) => \{/, (m) => m + consts);
      await record(env, path.join(OUT, FILE[n] || `sh-v2-step${n}.mp4`), src, { human: P.human }, K);
    } catch (e) { console.log(`step${n} 失敗: ${String(e.message).split('\n')[0]}`); process.exitCode = 1; } finally { await env.browser.close(); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
