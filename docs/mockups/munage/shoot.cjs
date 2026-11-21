// 実際の対局画面に見本の盤を差し込んで撮る
const { chromium, devices } = require('playwright');
const fs = require('fs');
const D = __dirname + '/'; // 撮った絵もここに出る。先に python3 -m http.server -d web 8400
const code = fs.readFileSync(D + 'munage_board.js', 'utf8');
const video = process.argv.includes('video');
async function open(b, opt) {
  const ctx = await b.newContext({ ...opt, ...(video ? { recordVideo: { dir: D + 'vid', size: opt.viewport } } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(200);
  await p.click('[data-tile="takoyaki"]').catch(() => {}); await p.waitForTimeout(500);
  const det = await p.$('aside.detail.open button.primary'); if (det) { await det.click(); await p.waitForTimeout(400); }
  await p.click('button[data-start]'); await p.waitForTimeout(1800);
  await p.evaluate(() => { window.MN_PRESSED = [2, 5, 9]; });
  await p.evaluate(code);
  await p.waitForTimeout(500);
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  {
    const { ctx, p } = await open(b, { viewport: { width: 1280, height: 800 } });
    await p.screenshot({ path: D + 'mn_pc.png' });
    await p.evaluate(() => window.MN_FIRE());
    const t0 = Date.now();
    for (const t of [700, 1150, 1350, 1700, 2300, 3800, 4900]) {
      await p.waitForTimeout(Math.max(0, t - (Date.now() - t0)));
      await p.screenshot({ path: D + `mn_f${t}.png` });
    }
    await p.waitForTimeout(1500);
    await ctx.close();
  }
  if (false) {
    const { ctx, p } = await open(b, { ...devices['iPhone 13'] });
    await p.screenshot({ path: D + 'mn_sp.png' });
    await ctx.close();
  }
  await b.close();
})();
