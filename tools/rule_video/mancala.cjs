// マンカラのルール動画(6 本)。使い方:
//   python3 -m http.server -d web 8400 &   (リポジトリの一番上で)
//   node tools/rule_video/mancala.cjs [出力フォルダ] [ステップ番号...]
// 出力: mc-v2-step1.mp4 〜 mc-v2-step6.mp4(既定は web/pc-firebase/assets/rule-steps/)
// 手順は tools/rule_video/ の sim(下の PREFIX)で探した。CPU の手も台本どおり(規則はアプリのまま)。
const path = require('path');
const { launch, openGame, replay, record } = require('./engine.cjs');
const sim = require('./mancala-sim.cjs');
// 手順の k 手目が人(先手=下の列)の手か
const whoOf = (moves) => { let s = sim.init(); return moves.map((m) => { const h = s.turn === 0; s = sim.play(s, m); return h; }); };
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../web/pc-firebase/assets/rule-steps'));
const ONLY = process.argv.slice(3).map(Number);
const K = 0.8; // 動画では、アプリの「ゆっくり」をさらに 1.25 倍ゆっくりに見せる

// ページの中で使う、マンカラ用の小道具(T は overlay.js)
const HELP = () => {
  const M = (window.M = {});
  const pitEl = (i) => document.querySelector(`#boardwrap [data-pit="${i}"]`);
  // 次の盤の描き直し(石が落ち始める)を待ち、落ちた順に番号を出す。番号の id は pre+n
  M.click = async (i, o = {}) => {
    const before = document.querySelector('#boardwrap svg');
    T.cursorOn();
    await T.cursorTo(T.pos(i), o.move || 1000);
    await T.sleep(250);
    await T.press(pitEl(i));
    await T.until(() => document.querySelector('#boardwrap svg') !== before);
  };
  M.badges = async (pre, o = {}) => {
    const ds = T.drops();
    let last = 0;
    ds.forEach((d, n) => {
      const pit = d.land ? o.land : d.pit;
      const at = n + 1 === ds.length && o.lastAt ? o.lastAt : T.badgeAt(pit);
      setTimeout(() => T.badge(pre + n, n + 1, at), d.delay + 170);
      last = Math.max(last, d.delay + 170);
    });
    await T.sleep(last / T.K + 300);
    return ds.length;
  };
  M.release = () => { window.__hold = false; };
  M.waitHuman = async () => { await T.until(() => view && view.human && !busy && !document.querySelector('#cutlayer .cutin')); window.__hold = true; };
  M.animDone = () => T.until(() => performance.now() > animUntil);
};

// ---- 1. 何をするゲーム?(盤の見方と、勝ち方)
const step1 = async () => {
  await T.sleep(700);
  await T.cap('マンカラは、石を<em>「倉(くら)」</em>に集めるゲームです');
  await T.sleep(4200);
  T.ring('row0', T.shape.row(0)); T.label('row0l', 'あなたの穴', [400, 184]);
  await T.cap('下の列の 6つの穴が、<em>あなたの穴</em>です');
  await T.sleep(4300);
  T.ring('st6', T.shape.pit(6)); { const [x] = T.pt(730, 0), [, y] = T.pt(0, 0); T.label('st6l', 'あなたの倉', { page: [x - 10, y - 34] }); } // 倉の上側(下の列の名札とかぶらないように)
  await T.cap('右はしの大きな穴が <em>あなたの倉</em>。<br>ここに入った石が、あなたの点になります');
  await T.sleep(5200);
  T.clear('row0', 'row0l', 'st6', 'st6l');
  await T.sleep(300);
  T.ring('row1', T.shape.row(1)); T.ring('st13', T.shape.pit(13));
  { const [x] = T.pt(400, 0), [x2] = T.pt(70, 0), [, y] = T.pt(0, 0); T.label('row1l', '相手の穴', { page: [x, y - 34] }); T.label('st13l', '相手の倉', { page: [x2 + 10, y - 34] }); }
  await T.cap('上の列と、左はしの倉は <em>相手</em>のものです');
  await T.sleep(4600);
  T.clear('row1', 'row1l', 'st13', 'st13l');
  await T.sleep(300);
  T.ring('pts', { el: '#strip', pad: 5, rr: 16 });
  await T.cap('倉に入った石の数が、そのまま<em>点数</em>です');
  await T.sleep(4300);
  T.clear('pts');
  T.ring('st6', T.shape.pit(6)); T.ring('st13', T.shape.pit(13));
  await T.cap('最後に、倉の石が<em>多い方の勝ち</em>です');
  await T.sleep(4600);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 2. 石のまき方(種まき)。自分 1(4 個)→ CPU 8(4 個)
const step2 = async () => {
  await T.sleep(600);
  T.cursorShow([520, 330]);
  await T.cap('自分の番では、自分の穴を<em>1つ</em> えらびます');
  await T.sleep(1200);
  await T.cursorTo(T.pos(1), 1100);
  T.ring('p', T.shape.pit(1)); T.label('pl', '石 4個', [262, 180]);
  await T.sleep(2600);
  await T.cap('その穴の石を<em>全部</em>取って、右どなりの穴から<br><em>1個ずつ</em> 順に入れていきます');
  await T.sleep(4600);
  T.clear('p', 'pl');
  await T.sleep(300);
  await M.click(1, { move: 300 });
  T.cursorHide();
  await M.badges('a');
  await T.sleep(2200);
  await T.cap('まき終わったら、<em>相手の番</em>です');
  await T.sleep(1800);
  T.clearPrefix('a');
  M.release();
  await T.until(() => view.moves === 2);
  await T.until(() => document.querySelector('#boardwrap .mdrop'));
  await M.badges('b');
  await M.waitHuman();
  await T.sleep(2000);
  T.clearPrefix('b');
  await T.cap('石はいつも、この向きに <em>ぐるっと</em> 回ります');
  await T.sleep(300);
  // 石が通る道の上に、下の列 → 右の倉 → 上の列 → 左の倉 の順に引く
  T.arrow('l1', 'M 150 262 L 600 262', { w: 8 });
  await T.sleep(1000);
  T.arrow('l2', 'M 645 262 Q 730 262 730 205 L 730 175 Q 730 118 655 118', { w: 8 });
  await T.sleep(1000);
  T.arrow('l3', 'M 630 118 L 200 118', { w: 8 });
  await T.sleep(1000);
  T.arrow('l4', 'M 155 118 Q 70 118 70 175 L 70 205 Q 70 262 135 262', { w: 8 });
  await T.sleep(4200);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 3. ぴったり倉で止まると、もう1回。自分 2(4 個 → 倉)→ 自分 0
const step3 = async () => {
  await T.sleep(600);
  T.cursorShow([520, 330]);
  await T.cap('まいた<em>最後の1個</em>が、ちょうど 自分の倉に入ると…');
  await T.sleep(800);
  await T.cursorTo(T.pos(2), 1000);
  T.ring('p', T.shape.pit(2)); T.label('pl', '石 4個', [354, 180]);
  await T.sleep(3400);
  T.clear('p', 'pl');
  await T.sleep(300);
  await M.click(2, { move: 300 });
  T.cursorHide();
  await M.badges('a');
  await M.animDone();
  await T.sleep(900);
  T.ring('st', T.shape.pit(6)); T.ring('msg', { el: '#status', pad: 4, rr: 12 });
  await T.cap('<em>もう1回</em>、続けて まけます！');
  await T.sleep(4600);
  T.clear('st', 'msg'); T.clearPrefix('a');
  await T.cap('続けて、<em>もう1回</em> まきます');
  await T.sleep(1600);
  await M.click(0, { move: 1000 });
  T.cursorHide();
  await M.badges('b');
  await M.animDone();
  await T.sleep(800);
  await T.cap('今度は倉で止まらなかったので、<em>相手の番</em>です');
  await T.sleep(4600);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 4. 倉を通りすぎる・相手の倉はとばす。自分 5(8 個 → 倉・相手の列・自分の列)
const step4 = async () => {
  await T.sleep(600);
  T.cursorShow([520, 330]);
  T.ring('p', T.shape.pit(5)); T.label('pl', '石 8個', [630, 180]);
  await T.cap('石が多い時は、自分の倉を通りすぎて<br><em>相手の列</em>にも まいていきます');
  await T.sleep(1000);
  await T.cursorTo(T.pos(5), 1000);
  await T.sleep(3200);
  T.clear('p', 'pl');
  await T.sleep(300);
  await M.click(5, { move: 300 });
  T.cursorHide();
  await M.badges('a');
  await M.animDone();
  await T.sleep(1200);
  T.ring('st6', T.shape.pit(6));
  await T.cap('自分の倉を通る時は、倉にも<em>1個</em> 入れます');
  await T.sleep(4300);
  T.clear('st6');
  T.ring('st13', T.shape.pit(13), { ng: true, dash: true }); T.label('st13l', 'とばす', [70, 190], { ng: true });
  await T.cap('でも<em>相手の倉</em>には 入れません。<br>とばして、自分の列に もどります');
  await T.sleep(5400);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 5. 横取り。自分 1(4 個)→ 空の穴 5 に着いて、向かい(相手 7)の 5 個と合わせて 6 個
const step5 = async () => {
  await T.sleep(600);
  T.cursorShow([520, 330]);
  T.ring('e', T.shape.pit(5)); T.label('el', '空っぽ', [630, 180]);
  await T.cap('まいた<em>最後の1個</em>が、空っぽの自分の穴に入ると…');
  await T.sleep(4400);
  T.clear('el');
  T.ring('o', T.shape.pit(7)); T.label('ol', '向かいの穴', [630, 184]);
  await T.cap('その<em>向かいの穴</em>の石も、もらえます');
  await T.sleep(4400);
  T.clear('e', 'o', 'ol');
  await T.sleep(400);
  await M.click(1, { move: 1000 });
  T.cursorHide();
  await T.cap(null); // 盤の横取りの動き(石が倉へ飛ぶ・「横取り!」)には、番号も文も重ねない
  await M.animDone();
  await T.sleep(1500);
  T.ring('st', T.shape.pit(6));
  await T.cap('<em>向かいの穴</em>の石と 最後の1個が、まとめて<br>自分の倉に入りました。これが<em>「横取り」</em>です');
  await T.sleep(5600);
  await T.cap(null); T.clearAll();
  await T.sleep(500);
};

// ---- 6. 終わり方と勝ち負け。自分 5(最後の 1 個)→ 自分の列が空 → 相手の残り 7 個は相手の倉へ
const step6 = async () => {
  await T.sleep(600);
  T.cursorShow([520, 330]);
  T.ring('p', T.shape.pit(5)); T.label('pl', 'あと1個', [630, 180]);
  await T.cap('あなたの列の石は、あと<em>1個</em> だけです');
  await T.sleep(3800);
  await T.cap('どちらかの列が<em>全部 空っぽ</em>になったら、おしまいです');
  await T.sleep(4300);
  T.clear('p', 'pl');
  T.ring('row1', T.shape.row(1));
  { const [x] = T.pt(400, 0), [, y] = T.pt(0, 0); T.label('row1l', '残っている石', { page: [x, y - 34] }); }
  await T.cap('その時に 残っている石は、<br><em>その列の人の倉</em>に入ります');
  await T.sleep(5000);
  T.clear('row1', 'row1l');
  await T.sleep(300);
  window.__holdResult = true;
  await T.cap(null);
  await M.click(5, { move: 1000 });
  T.cursorHide();
  await M.animDone();
  await T.sleep(1800);
  T.ring('st13', T.shape.pit(13));
  T.ring('st6', T.shape.pit(6));
  await T.cap('倉の石が<em>多い方の勝ち</em>です');
  await T.sleep(3800);
  await T.cap(null); T.clearAll();
  await T.sleep(600);
  window.__holdResult = false; window.__resultPending && window.__resultPending();
  await T.until(() => document.querySelector('#cutlayer .cutin'));
  await T.until(() => !document.querySelector('#result').hidden);
  await T.sleep(3800);
};

const STEPS = [
  { n: 1, run: step1, prefix: [], file: 'mc-v3-step1.mp4' }, // 2026-11-28 名札の位置を直して録り直し(新しい名前にする)
  { n: 2, run: step2, prefix: [], cpu: [8] },
  { n: 3, run: step3, prefix: [] },
  { n: 4, run: step4, prefix: [4, 12, 3, 11, 4, 10, 2, 12] },
  { n: 5, run: step5, prefix: [5, 10] },
  { n: 6, run: step6, prefix: [3, 10, 2, 0, 9, 10, 1, 5, 7, 10, 2, 8, 0, 10, 3, 7] },
];

(async () => {
  for (const st of STEPS) {
    if (ONLY.length && !ONLY.includes(st.n)) continue;
    const env = await launch();
    try {
      await openGame(env, 'mancala');
      await env.page.waitForFunction(() => view && view.human && !document.querySelector('#cutlayer .cutin'), null, { timeout: 30000 });
      await replay(env, st.prefix, whoOf(st.prefix));
      { let s = sim.init(); for (const m of st.prefix) s = sim.play(s, m); const pits = await env.page.evaluate(() => view.board.pits);
        if (pits.join() !== s.p.join()) throw new Error(`step${st.n}: 局面が台本と違う ${pits} / ${s.p}`); }
      await env.page.evaluate(`(${HELP})()`);
      await env.page.evaluate((q) => { window.__cpuQ.push(...q); window.__hold = true; }, st.cpu || []);
      await record(env, path.join(OUT, st.file || `mc-v2-step${st.n}.mp4`), st.run.toString(), {}, K);
    } finally { await env.browser.close(); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
