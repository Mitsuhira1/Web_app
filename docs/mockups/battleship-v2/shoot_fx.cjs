// バトルシップ見本(第 2 版)の演出: 水柱と撃沈を、時間を止めたコマと動画で撮る。
// 先に: python3 -m http.server -d web 8400(リポジトリの一番上で)
// 実行: node docs/mockups/battleship-v2/shoot_fx.cjs <フォントの woff2 があるフォルダ> [出力先]
// 出力: water-sheet.png / sink-sheet.png(コマの一覧)/ water.mp4 / sink.mp4
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FONT_DIR = process.argv[2];
const OUT = (process.argv[3] || __dirname) + '/';
const code = fs.readFileSync(__dirname + '/battleship_v2_board.js', 'utf8');
const f = (n) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(FONT_DIR, n)).toString('base64');
const FONTS = { 'Barlow Condensed|600': f('barlow600.woff2'), 'Barlow Condensed|700': f('barlow700.woff2'), 'Zen Kaku Gothic New|500': f('zkg500.woff2'), 'Zen Kaku Gothic New|700': f('zkg700.woff2') };
const WATER = 46, SINK = [19, 29, 39, 49];

async function open(b, video) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: video ? 1 : 2, ...(video ? { recordVideo: { dir: OUT + '_vid', size: { width: 1280, height: 800 } } } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => localStorage.setItem('asobi30pc', JSON.stringify({ firstDone: true })));
  await p.goto('http://localhost:8400/pc-firebase/');
  await p.waitForTimeout(1000);
  await p.click('[data-tile="battleship"]'); await p.waitForTimeout(200);
  await p.click('[data-tile="battleship"]'); await p.waitForTimeout(500);
  await p.click('button[data-start]'); await p.waitForTimeout(2600);
  await p.evaluate(({ fonts }) => { window.__BS2 = { mode: 'battle', fonts }; }, { fonts: FONTS });
  await p.evaluate(code);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  return { ctx, p };
}
// 場面の座標 → ページの座標
const toPage = (p, x, y, w, h) => p.evaluate(([x, y, w, h]) => { const r = document.querySelector('.bs2').getBoundingClientRect(), s = r.width / 900; return { x: r.left + x * s, y: r.top + y * s, width: w * s, height: h * s }; }, [x, y, w, h]);

async function frames(b, name, run, times, box) {
  const { ctx, p } = await open(b, false);
  await p.evaluate(run);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const clip = await toPage(p, ...box);
  const files = [];
  for (const t of times) {
    await p.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), t);
    await p.waitForTimeout(60);
    const fn = `${OUT}_${name}-${String(t).padStart(5, '0')}.png`;
    await p.screenshot({ path: fn, clip });
    files.push([fn, t]);
  }
  await ctx.close();
  // コマを 1 枚にまとめる(左上に時間)
  const pg = await (await b.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
  const cols = 5;
  const html = `<body style="margin:0;background:#e9e2d6;font:600 14px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${files.map(([fn, t]) => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(fn).toString('base64')}" style="width:100%;display:block;border-radius:6px"><span style="position:absolute;left:6px;top:4px;background:#000a;color:#fff;padding:1px 6px;border-radius:4px">${(t / 1000).toFixed(2)} 秒</span></div>`).join('')}</div></body>`;
  await pg.setContent(html);
  await pg.waitForTimeout(200);
  const h = await pg.evaluate(() => document.body.scrollHeight);
  await pg.setViewportSize({ width: 1600, height: h });
  await pg.screenshot({ path: `${OUT}${name}-sheet.png` });
  await pg.context().close();
  files.forEach(([fn]) => fs.unlinkSync(fn));
}

async function movie(b, name, run, ms, box) {
  const { ctx, p } = await open(b, true);
  const t0 = Date.now();
  await p.waitForTimeout(300);
  await p.evaluate(run);
  await p.waitForTimeout(ms);
  const clip = await toPage(p, ...box);
  const vid = await p.video().path();
  const pre = (Date.now() - t0 - ms - 300) / 1000;
  await ctx.close();
  const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vid]).toString());
  const start = Math.max(0, total - (ms + 300) / 1000 - .1);
  const c = [clip.width, clip.height, clip.x, clip.y].map((v) => Math.round(v / 2) * 2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', vid, '-vf', `crop=${c[0]}:${c[1]}:${c[2]}:${c[3]}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `${OUT}${name}.mp4`]);
  fs.rmSync(OUT + '_vid', { recursive: true, force: true });
}

(async () => {
  const b = await chromium.launch();
  const water = `window.__bs2fx.waterColumn(${WATER})`;
  const sink = `window.__bs2fx.sink(${JSON.stringify(SINK)}, 1, 49)`;
  // 水柱は G5 のまわり(上に柱が伸びるので上を広めに)
  const wbox = [66 + 6 * 38 - 76, 74 + 4 * 38 - 130, 190, 210];
  const sbox = [66 + 9 * 38 - 120, 74 + 0 * 38 - 20, 200, 230];
  await frames(b, 'water', water, [0, 84, 167, 250, 334, 417, 500, 584, 667, 750, 834, 917, 1000, 1200, 1500], wbox);
  await frames(b, 'sink', sink, [84, 250, 500, 750, 1100, 1500, 1900, 2300, 2700, 3100, 3500, 3900, 4400, 5000, 5800], sbox);
  await movie(b, 'water', water, 1800, [66 + 6 * 38 - 160, 74 + 4 * 38 - 150, 340, 300]);
  await movie(b, 'sink', sink, 6400, [66 + 9 * 38 - 230, 74 - 40, 300, 300]);
  await b.close();
  console.log('saved water-sheet.png sink-sheet.png water.mp4 sink.mp4');
})();
