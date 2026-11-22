// コヨーテの見本を、実際の対局画面(たこ焼きの画面を借りる)に差し込んで撮る。
// 先に: python3 -m http.server -d web 8400
// 実行: NODE_PATH=/tmp/pw/node_modules node docs/mockups/coyote/shoot.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = (process.argv[2] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/coyote_board.js', 'utf8');
const VIEW = { width: 1280, height: 800 };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(200);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(500);
  await p.click('button[data-start]'); await p.waitForTimeout(1800);
  await p.evaluate(code);
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + 'board.png' });
  console.log('saved', OUT + 'board.png');
  await b.close();
})();
