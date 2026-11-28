// リバーシのルール動画(6 本)。使い方:
//   python3 -m http.server -d web 8400 &   (リポジトリの一番上で)
//   node tools/rule_video/reversi-sim.mjs            (一局を探す。reversi-game.json を作る。局面を変えた時だけ)
//   node tools/rule_video/reversi.cjs [出力フォルダ] [ステップ番号...]
// 出力: rv-v2-step1.mp4 〜 rv-v2-step6.mp4(既定は web/pc-firebase/assets/rule-steps/)
// 局面は reversi-game.json(seed 1 の一局。黒=あなた、白=CPU。途中で黒は 1 回パスになる)。
// 手順の意味(game の手の番号 = 0 から。pass は自動パス):
//   1 何をするゲーム / 2 置き方(黒 19・白 18) / 3 まとめて裏返る(黒 26 の 3 方向) /
//   4 挟めないマスには置けない(白 18 の後、20 は挟めない) / 5 パス(手 45 で黒が自動パス) / 6 終わりと勝敗
const path = require('path');
const { launch, openGame, record } = require('./engine.cjs');
const GAME = require('./reversi-game.json');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../web/pc-firebase/assets/rule-steps'));
const ONLY = process.argv.slice(3).map(Number);
const K = 0.8;
const FILE = {}; // 録り直した物は新しい名前にする(端末のキャッシュで古い版が見え続けるため)
const E = GAME.moves; // { m, seat, pass }
const PLAN = {
  1: { upto: 0, live: [] },
  2: { upto: 0, live: [0, 1] },
  3: { upto: 26, live: [26, 27] },
  4: { upto: 2, live: [2], illegal: 20 },
  5: { upto: 45, live: [45, 46] },
  6: { upto: 58, live: [58, 59] },
};
const cpuQueue = (n) => { const last = PLAN[n].upto + PLAN[n].live.length; return E.slice(0, last).filter((x) => x.seat === 1 && !x.pass).map((x) => x.m); };

// ページの中で使う、リバーシ用の小道具(T は overlay.js)
const HELP = () => {
  const S = (window.RV = {});
  S.cell = (i) => document.querySelector(`#boardwrap .cell[data-i="${i}"]`);
  S.cells = (pred) => [...document.querySelectorAll('#boardwrap .cell')].filter((c) => pred(+c.dataset.i, c));
  S.stoneCells = (b) => S.cells((i, c) => c.querySelector(`.stone.${b}`));
  const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  S.tap = async (el, ms = 900) => { T.cursorOn(); await T.cursorTo({ page: mid(el) }, ms); await T.sleep(250); await T.press(el); };
  S.myTurn = () => T.until(() => view && view.human && !busy && !document.querySelector('#cutlayer .cutin') && performance.now() > animUntil);
  S.calm = () => T.until(() => !document.querySelector('#cutlayer .cutin') && performance.now() > animUntil);
  // 自分の番で、マスを押して置く
  S.move = async (m) => { await S.myTurn(); const n = view.moves; await S.tap(S.cell(m), 1000); await T.until(() => view.moves > n); T.cursorHide(); await S.calm(); };
  // CPU の番を進める(台本の手)
  S.cpu = async () => { const n = view.moves; window.__hold = false; await T.until(() => view.moves > n); window.__hold = true; await T.until(() => performance.now() > animUntil); };
  S.setup = () => {
    // 説明の文は右の側板の「手数」の下の空いた欄(盤の下は「制限時間」の表示があるため、そこには出さない)
    const note = document.querySelector('#sidenote'), side = note.closest('.side').getBoundingClientRect(), nr = note.getBoundingClientRect();
    const last = [...note.children].reduce((b, e) => Math.max(b, e.getBoundingClientRect().bottom), nr.top);
    T.capBox = { left: nr.left + 2, top: last + 18, width: nr.width - 4, maxH: side.bottom - last - 30 };
    T.avoid(['#boardwrap .stone', '#boardwrap .cell.can', '#strip', '#status', '.side .ops button', '#sheet', '.stagehead']);
  };
};

// 録る前の局面を作る(見せない手を進める)。pass は app が自動で打つ(台本の手には入れない)
async function replay(env, n) {
  const { page, wait } = env;
  await page.evaluate(() => { window.__hold = false; S.set.reduce = true; render(); });
  for (let k = 0; k < n; k++) {
    const e = E[k];
    if (!e.pass && e.seat === 0) {
      await page.waitForFunction((k) => view && view.moves === k && view.human && !busy, k, { timeout: 60000 });
      await page.evaluate((m) => humanMove(m), e.m);
    } else {
      // CPU の手と、自動のパス
      await page.waitForFunction((k) => view && view.moves === k + 1 && !busy, k, { timeout: 60000 });
    }
  }
  await page.waitForFunction((n) => view && view.moves === n && !busy, n, { timeout: 60000 });
  await page.evaluate(() => { window.__hold = true; S.set.reduce = false; render(); });
  await wait(600);
}

// ---- 1. 何をするゲーム?
const step1 = async () => {
  RV.setup();
  await T.sleep(700);
  T.ring('bk', { els: RV.stoneCells('b'), pad: 4, rr: 10 });
  await T.cap('リバーシは、<em>黒と白</em>の石を 交互に置いて 遊ぶゲームです');
  await T.sleep(5000);
  T.clear('bk');
  T.ring('wh', { els: RV.stoneCells('w'), pad: 4, rr: 10 });
  await T.cap('黒があなた、白が相手の石です');
  await T.sleep(4300);
  T.clear('wh');
  await T.cap('石を挟むと、挟まれた相手の石が 自分の色に<em>裏返ります</em>');
  await T.sleep(5200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 2. 置き方。黒 19 を置き、白 18 が返す
const step2 = async () => {
  RV.setup();
  await T.sleep(600);
  await T.cap('置けるマスには、<em>点</em>が出ています');
  await T.sleep(4000);
  T.cursorShow({ page: [560, 640] });
  await T.cap('置きたいマスを 押します');
  await T.sleep(2200);
  await RV.move(19);
  await T.sleep(500);
  await T.cap('相手の石を挟んだ所に置くと、置けます');
  await T.sleep(4300);
  await T.cap(null);
  await RV.cpu();
  await T.sleep(1100);
  await T.cap('こうして、<em>1手ずつ交互</em>に 置いていきます');
  await T.sleep(4300);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 3. まとめて裏返る。黒 13 は 3 方向の白を一度に裏返す
const step3 = async () => {
  RV.setup();
  await T.sleep(600);
  await T.cap('この白の石は、どこから挟むかで 裏返り方が変わります');
  await T.sleep(4600);
  await T.cap(null);
  await T.sleep(300);
  await RV.move(13);
  await T.cap('挟まれた白は、<em>すべて</em>黒に裏返ります');
  await T.sleep(5000);
  await T.cap(null);
  await RV.cpu();
  await T.sleep(900);
  T.clearAll();
  await T.sleep(500);
};

// ---- 4. 挟めないマスには置けない。20 は挟める白が無いので置けない
const step4 = async () => {
  RV.setup();
  await T.sleep(600);
  T.ring('ng', RV.cell(20), { ng: true, dash: true });
  await T.cap('この白い所は、<em>挟めない</em>ので置けません');
  await T.sleep(4600);
  T.clear('ng');
  await T.cap('挟める所は、点で教えてくれます');
  await T.sleep(3600);
  await RV.move(26);
  await T.cap(null);
  await T.sleep(500);
  await RV.cpu();
  await T.sleep(900);
  T.clearAll();
  await T.sleep(500);
};

// ---- 5. パス。黒は置ける所が無いので、自動でパスになる
const step5 = async () => {
  RV.setup();
  await T.sleep(600);
  await T.cap('置ける所が無い時は、<em>自動でパス</em>になり、相手がもう一度置きます');
  await T.sleep(5200);
  await T.cap(null);
  window.__hold = false;
  await T.until(() => view.moves === 46 && !busy);
  await T.sleep(600);
  window.__hold = true;
  await RV.calm();
  await T.sleep(1200);
  await RV.cpu();
  await T.sleep(900);
  T.clearAll();
  await T.sleep(500);
};

// ---- 6. 終わりと勝敗。どちらも置けなくなったら終わり
const step6 = async () => {
  RV.setup();
  await T.sleep(600);
  await T.cap('どちらも置ける所が無くなったら、<em>終わり</em>です');
  await T.sleep(4600);
  await T.cap(null);
  await RV.cpu();
  await T.sleep(900);
  await RV.move(9);
  await T.cap(null);
  await T.until(() => !document.querySelector('#result').hidden);
  await T.sleep(3800);
  T.clearAll();
};

const RUN = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6 };

(async () => {
  for (const n of Object.keys(RUN).map(Number)) {
    if (ONLY.length && !ONLY.includes(n)) continue;
    const P = PLAN[n];
    const env = await launch();
    try {
      await openGame(env, 'reversi', null, { seed: GAME.seed, cpuQ: cpuQueue(n), hold: true });
      await env.page.waitForFunction(() => view && !document.querySelector('#cutlayer .cutin'), null, { timeout: 60000 });
      if (P.upto) await replay(env, P.upto);
      const got = await env.page.evaluate(() => ({ moves: view.moves, q: window.__cpuQ.length }));
      if (got.moves !== P.upto) throw new Error(`step${n}: 局面が台本と違う ${JSON.stringify(got)}`);
      await env.page.evaluate(`(${HELP})()`);
      await record(env, path.join(OUT, FILE[n] || `rv-v2-step${n}.mp4`), RUN[n].toString(), {}, K);
    } catch (e) { console.log(`step${n} 失敗: ${String(e.message).split('\n')[0]}`); process.exitCode = 1; } finally { await env.browser.close(); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
