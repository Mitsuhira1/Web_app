// 胸毛絶体絶命の見本を、実際の対局画面(たこやきの画面を借りる)に差し込んで撮る。
// 先に: python3 -m http.server -d web 8400
// node shoot.cjs [出力先]  → board.png・frames.png・launch.mp4・launch.gif
const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = (process.argv[2] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/munage_board.js', 'utf8');
const VIEW = { width: 1280, height: 800 };

async function open(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(200);
  await p.click('[data-tile="takoyaki"]'); await p.waitForTimeout(500);
  await p.click('button[data-start]'); await p.waitForTimeout(1800);
  await p.evaluate(() => { window.MN_PRESSED = [2, 5, 9, 16, 20]; });
  await p.evaluate(code);
  await p.waitForTimeout(600);
  return p;
}
(async () => {
  const b = await chromium.launch();
  // 静止画
  {
    const ctx = await b.newContext({ viewport: VIEW });
    const p = await open(ctx);
    await p.screenshot({ path: OUT + 'board.png' });
    await p.evaluate(() => window.MN_FIRE());
    const t0 = Date.now(), shots = [300, 800, 1350, 1600, 2050, 2600, 3300, 4300, 5100];
    for (const t of shots) {
      await p.waitForTimeout(Math.max(0, t - (Date.now() - t0)));
      await p.screenshot({ path: OUT + `f${t}.png` });
    }
    await ctx.close();
    execFileSync('python3', ['-c', `
from PIL import Image
ts=${JSON.stringify(shots)}
ims=[Image.open('${OUT}f%d.png'%t) for t in ts]
w,h=ims[0].size; out=Image.new('RGB',(w*3,h*3),'white')
for i,im in enumerate(ims): out.paste(im,((i%3)*w,(i//3)*h))
out.resize((w*3//2,h*3//2)).save('${OUT}frames.png')
import os
for t in ts: os.remove('${OUT}f%d.png'%t)`]);
  }
  // 動画(押す少し前から、カットインが消えるまで)
  {
    const dir = fs.mkdtempSync('/tmp/mnvid-');
    const made = Date.now();
    const ctx = await b.newContext({ viewport: VIEW, recordVideo: { dir, size: VIEW } });
    const p = await open(ctx);
    await p.waitForTimeout(700);
    const start = (Date.now() - made) / 1000 - .6;
    await p.mouse.move(640, 650);
    await p.evaluate(() => window.MN_FIRE());
    await p.waitForTimeout(7300);
    await ctx.close();
    const webm = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(start), '-i', `${dir}/${webm}`, '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT + 'launch.mp4']);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', OUT + 'launch.mp4', '-vf', 'fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', OUT + 'launch.gif']);
  }
  await b.close();
})();
