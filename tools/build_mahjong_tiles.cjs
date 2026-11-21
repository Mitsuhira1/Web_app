// 麻雀の牌を、前もって画像(WebP)にする。牌の絵・下の金色の厚み・影をまとめて 1 枚にする。
// もとは牌ごとに CSS の drop-shadow を 2 重にかけていて、卓を描き直すたびに影を計算していた(麻雀の描き直しの CPU の 3 割ほど)。
// 影は、牌の幅 32px の時のもとの見た目(下に 1px・ぼかし 1.5px)を、牌の大きさに合わせて拡大・縮小する(ユーザーの了承済み: 2026-11-21)。
// 使い方(リポジトリのルートで):
//   python3 -m http.server -d web 8400 &
//   node tools/build_mahjong_tiles.cjs
// 出力: web/pc-firebase/assets/mj/<種類>.webp(0〜33・赤の五 r4/r13/r22・裏 back)
// 牌の絵(js/boards/extra.js の tileFace)や影を変えたら、もう一度動かす。sw.js の FILES とキャッシュ名も直す。
const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web', 'pc-firebase');
const OUT = path.join(ROOT, 'assets', 'mj');
const BASE = process.env.BASE || 'http://localhost:8400/pc-firebase/';
const W = 32;      // 影を決める牌の幅(css px)
const PAD = 4;     // 左右と上の余白 = 牌の幅の 12.5%(css/app.css の .mjt>img と合わせる)
const BOX_H = 54;  // 画像の高さ(上の余白 4 + 牌 42.67 + 金色の厚み 3.2 + 影)
const SCALE = 5;   // 細かさ: 牌の幅が 160 画素(大きい牌 70px を 2 倍の画面で出しても足りる)
// もとの CSS(2026-11-21 まで css/app.css の .mjt・.mjt.back にあった物)
const TILE_CSS = `.mjt{--w:${W}px;width:var(--w);aspect-ratio:3/4;display:block;position:relative;filter:drop-shadow(0 calc(var(--w)*.1) 0 #E2A23A) drop-shadow(0 1px 1.5px rgba(0,0,0,.4))}
.mjt svg{width:100%;height:100%;display:block}
.mjt.back{background:linear-gradient(#E9AE48,#D69530);border-radius:calc(var(--w)*.14);border:1px solid #A8721C}
*{box-sizing:border-box}`;

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mj-'));
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 400, height: 400}, deviceScaleFactor: SCALE});
  await p.goto(BASE + '?mj-build');
  await p.waitForFunction(() => window.__mjTileArt && document.getElementById('xIv'));
  // 牌の絵の SVG と、牌の地のグラデーション(art.js の xIv)をアプリから借りる
  const {tiles, xIv} = await p.evaluate(() => ({
    tiles: window.__mjTileArt.keys.map(([key, id, red]) => [key, window.__mjTileArt.art(id, red)]),
    xIv: document.getElementById('xIv').outerHTML,
  }));
  tiles.push(['back', '']);
  const font = new URL('fonts/YujiBoku-Koma.woff2', BASE).href;
  // 透明な何もない頁に描く(アプリの背景が写らないように)
  await p.setContent(`<style>@font-face{font-family:"Yuji Boku";src:url(${font}) format("woff2");font-display:block}
html,body{margin:0;background:transparent}#box{width:${W + PAD * 2}px;height:${BOX_H}px;padding:${PAD}px ${PAD}px 0;box-sizing:border-box}${TILE_CSS}</style>
<svg width="0" height="0" style="position:absolute"><defs>${xIv}</defs></svg><div id="box"></div>`);
  await p.evaluate(() => document.fonts.load('21px "Yuji Boku"', '東南西北發中一二三四五六七八九萬'));
  for (const [key, svg] of tiles) {
    await p.evaluate(({key, svg}) => {
      document.getElementById('box').innerHTML = key === 'back' ? '<span class="mjt back"></span>' : `<span class="mjt">${svg}</span>`;
    }, {key, svg});
    await p.waitForTimeout(60);
    const png = path.join(tmp, key + '.png'), out = path.join(OUT, key + '.webp');
    await (await p.$('#box')).screenshot({path: png, omitBackground: true});
    execFileSync('python3', ['-I', '-c',
      'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGBA").save(sys.argv[2],"WEBP",quality=92,alpha_quality=95,method=6)', png, out]);
  }
  await b.close();
  const total = tiles.reduce((n, [k]) => n + fs.statSync(path.join(OUT, k + '.webp')).size, 0);
  console.log('牌の画像', tiles.length, '枚・合計', Math.round(total / 1024), 'KB');
})();
