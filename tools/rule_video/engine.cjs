// ルール動画を、実際のアプリ(web/pc-firebase)を動かして録る道具。
// - ページの時計(setTimeout・requestAnimationFrame・performance.now と CSS の動き)を R 倍の速さで流し、
//   重い描画でもコマ落ちしないようにしてから、動画では K 倍に直す(動画の時間 = ページの時間 ÷ K)。
// - CPU の手は台本どおりにする(worker に送る cpuChoose を横取りして返す)。規則・盤の描き方はアプリのまま。
// - 注釈は overlay.js(録画の時だけページに入れる)。
// 使い方の例: tools/rule_video/mancala.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const R = 0.25; // ページの時計の速さ(実時間に対して)
const URL = process.env.RV_URL || 'http://localhost:8400/pc-firebase/';

const TIMEWARP = (R) => `(() => {
  const R = ${R};
  const rN = performance.now.bind(performance), rD = Date.now, b0 = rN(), d0 = rD();
  const now = () => (rN() - b0) * R + b0;
  performance.now = now;
  Date.now = () => d0 + (rD() - d0) * R;
  const sT = window.setTimeout, sI = window.setInterval, rAF = window.requestAnimationFrame;
  window.setTimeout = (f, ms, ...a) => sT(f, (+ms || 0) / R, ...a);
  window.setInterval = (f, ms, ...a) => sI(f, (+ms || 0) / R, ...a);
  window.requestAnimationFrame = (cb) => rAF(() => cb(now()));
})();`;

async function launch() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(TIMEWARP(R));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await page.goto(URL);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: R });
  const wait = (ms) => page.waitForTimeout(ms / R); // ページの時間で待つ
  await page.waitForFunction(() => typeof S !== 'undefined' && document.querySelector('#app').children.length > 0);
  return { browser, ctx, page, cdp, wait };
}

// メニュー → ゲームの設定 → スタート。録画用の設定(アニメーションはゆっくり・カットインあり)
async function openGame(env, id, setupFn) {
  const { page, wait } = env;
  if (await page.getByText('スキップ').count()) await page.getByText('スキップ').click();
  await wait(400);
  await page.evaluate(() => { Object.assign(S.set, { speed: 'ゆっくり', cutin: true, reduce: false, cursor: '手番のみ', cpuLen: 'ふつう', sound: false, bgm: false }); });
  await page.click(`[data-tile="${id}"]`);
  await page.getByText('進む', { exact: true }).click();
  await wait(400);
  if (setupFn) await setupFn(page);
  await page.click('[data-start]');
  await wait(300);
  // 録画用のつなぎ: CPU の手を台本から返す・CPU を止めておく・結果の画面を止めておく
  await page.evaluate(() => {
    window.__cpuQ = []; window.__hold = false; window.__holdResult = false; window.__resultPending = null;
    if (worker) {
      const pm = worker.postMessage.bind(worker);
      worker.postMessage = (msg) => {
        if (msg && msg.fn === 'cpuChoose' && window.__cpuQ.length) { const r = window.__cpuQ.shift(); setTimeout(() => worker.onmessage({ data: { id: msg.id, r, ms: 1 } }), 0); return; }
        pm(msg);
      };
    } else throw new Error('worker なし');
    const mp = modalPause; window.modalPause = () => window.__hold || mp();
    const sr = showResult; window.showResult = function () { if (window.__holdResult) { window.__resultPending = () => sr(); return; } return sr(); };
  });
}

// 見せない手(録画の前に進めておく局面)。アニメーションとカットインを止めて速く進める
// who[k] は k 手目が人の手か(CPU の手は、CPU が考え始める前に台本へまとめて入れておく)
async function replay(env, moves, who) {
  const { page, wait } = env;
  await page.evaluate((q) => { window.__cpuQ.push(...q); S.set.reduce = true; render(); }, moves.filter((_, k) => !who[k]));
  await page.waitForFunction(() => !document.querySelector('#cutlayer .cutin'));
  for (let k = 0; k < moves.length; k++) {
    if (!who[k]) continue;
    await page.waitForFunction((k) => view && view.moves === k && view.human && !busy, k, { timeout: 60000 });
    await page.evaluate((m) => humanMove(m), moves[k]);
  }
  await page.waitForFunction((n) => view && view.moves === n && !busy, moves.length, { timeout: 60000 });
  if (await page.evaluate(() => window.__cpuQ.length)) throw new Error('台本の CPU の手が残った');
  await page.evaluate(() => { window.__hold = true; S.set.reduce = false; render(); });
  await wait(600);
}

// 1 本録る。scenario はページの中で動く async 関数(overlay.js の T を使う)
async function record(env, out, scenario, args, K) {
  const { page, cdp } = env;
  const overlay = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
  await page.evaluate(({ src, K }) => { window.__TUT_K = K; document.querySelector('#tut')?.remove(); (0, eval)(src); }, { src: overlay, K });
  await page.evaluate(() => document.fonts.ready);
  const frames = [];
  const onFrame = (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  const t0 = Date.now() / 1000;
  await page.evaluate(`(${scenario})(${JSON.stringify(args || {})})`);
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  return encode(frames, t0, t1, out, K);
}

function encode(frames, t0, t1, out, K) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rv-'));
  // 録画の始まり(t0)より前の最後のコマから使う
  let s = 0; for (let i = 0; i < frames.length; i++) if (frames[i].t <= t0) s = i;
  const use = frames.slice(s);
  const toV = (t) => Math.max(0, (t - t0) * R / K); // 動画の上の秒
  let list = '';
  use.forEach((f, i) => {
    const fn = path.join(dir, `${String(i).padStart(6, '0')}.png`); fs.writeFileSync(fn, Buffer.from(f.d, 'base64'));
    const next = i + 1 < use.length ? toV(use[i + 1].t) : toV(t1);
    const dur = Math.max(0, next - toV(f.t));
    list += `file '${fn}'\nduration ${dur.toFixed(5)}\n`;
  });
  list += `file '${path.join(dir, String(use.length - 1).padStart(6, '0') + '.png')}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-tune', 'animation', '-movflags', '+faststart', '-an', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  const dur = toV(t1);
  console.log(path.basename(out), dur.toFixed(1) + 's', Math.round(fs.statSync(out).size / 1024) + 'KB', use.length + ' frames');
  return dur;
}

module.exports = { launch, openGame, replay, record, R };
