// チンチロリンのスマホ版の見本を、実際の対局画面(たこ焼きの画面を借りる)に差し込んで撮る。
// 先に: python3 -m http.server -d web 8400
// 実行: NODE_PATH=/tmp/pw/node_modules node docs/mockups/chinchiro/shoot_mobile.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = (process.argv[2] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/chinchiro_mobile_board.js', 'utf8');
const VIEW = { width: 390, height: 844 };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VIEW, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(600);
  await p.getByRole('button', { name: '進む' }).click(); await p.waitForTimeout(600);
  await p.click('button[data-start]'); await p.waitForTimeout(1800);
  await p.evaluate(code);
  await p.waitForTimeout(600);
  const sh = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('scrollHeight', sh);
  await p.screenshot({ path: OUT + 'mobile.png' });
  console.log('saved', OUT + 'mobile.png');
  await b.close();
})();
