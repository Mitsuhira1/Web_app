// 胸毛を、盤の上とアニメの大写しで並べて撮る(hair_compare.png)。node compare_hair.cjs [出力先]
const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = (process.argv[2] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/munage_board.js', 'utf8');
(async () => {
  const b = await chromium.launch();
  for (const kind of ['now']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
    await p.goto('http://localhost:8400/pc-firebase/');
    await p.waitForTimeout(1000);
    await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(200);
    await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(500);
    await p.click('button[data-start]'); await p.waitForTimeout(1800);
    await p.evaluate(k => { window.MN_HAIR = k; window.MN_PRESSED = [2, 5, 9, 16, 20]; }, kind);
    await p.evaluate(code);
    await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + `hair_${kind}_board.png`, clip: { x: 360, y: 150, width: 220, height: 160 } });
    await p.evaluate(() => window.MN_FIRE());
    await p.waitForTimeout(1050);
    await p.screenshot({ path: OUT + `hair_${kind}_close.png`, clip: { x: 340, y: 160, width: 600, height: 560 } });
    await ctx.close();
  }
  await b.close();
  execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFont
O='${OUT}'
cols=[]
for k in ['now']:
    a=Image.open(O+'hair_%s_board.png'%k).resize((600,436),Image.LANCZOS)
    c=Image.open(O+'hair_%s_close.png'%k).resize((600,560),Image.LANCZOS)
    col=Image.new('RGB',(600,436+560+70),'#f3efe6'); col.paste(a,(0,70)); col.paste(c,(0,70+436))
    cols.append(col)
a=cols[0].crop((0,70,600,506)); c=cols[0].crop((0,506,600,1066))
W=Image.new('RGB',(1220,560),'#f3efe6'); W.paste(a.resize((600*560//436,560)).crop((0,0,600,560)),(0,0)); W.paste(c,(620,0))
W.save(O+'hair_compare.png')
import os
for k in ['now']:
    os.remove(O+'hair_%s_board.png'%k); os.remove(O+'hair_%s_close.png'%k)`]);
})();
