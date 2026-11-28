// バトルシップ見本(第 2 版)を実際の対局画面に差し込んで撮る。
// 先に: python3 -m http.server -d web 8400(リポジトリの一番上で)
// 実行: node docs/mockups/battleship-v2/shoot.cjs <フォントの woff2 があるフォルダ> [出力先]
// 出力: board.png(攻撃中)/ place.png(配置)。演出は shoot_fx.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FONT_DIR = process.argv[2];
const OUT = (process.argv[3] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/battleship_v2_board.js', 'utf8');
const f = (n) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(FONT_DIR, n)).toString('base64');
const FONTS = { 'Barlow Condensed|600': f('barlow600.woff2'), 'Barlow Condensed|700': f('barlow700.woff2'), 'Zen Kaku Gothic New|500': f('zkg500.woff2'), 'Zen Kaku Gothic New|700': f('zkg700.woff2') };

async function open(b, mode) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="battleship"]'); await p.waitForTimeout(200);
  await p.click('[data-tile="battleship"]'); await p.waitForTimeout(500);
  await p.click('button[data-start]'); await p.waitForTimeout(2200);
  await p.evaluate(({ mode, fonts }) => { window.__BS2 = { mode, fonts }; }, { mode, fonts: FONTS });
  await p.evaluate(code);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  for (const mode of ['battle', 'place']) {
    const { ctx, p } = await open(b, mode);
    await p.screenshot({ path: OUT + (mode === 'battle' ? 'board.png' : 'place.png') });
    await ctx.close();
  }
  await b.close();
  console.log('saved board.png place.png');
})();
