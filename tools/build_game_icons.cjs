// メニューのゲームのアイコン(js/art.js の AR にある SVG)を、前もって画像(WebP)にする。
// その場で図形と画像処理(フィルター)を計算するのをやめ、メニューの描画を軽くするため(CLAUDE.md の「不具合の記録」も参照)。
// 使い方(リポジトリのルートで):
//   python3 -m http.server -d web 8400 &
//   node tools/build_game_icons.cjs
// 出力: web/pc-firebase/assets/game-icons/<id>.webp と web/pc-firebase/js/icon-images.js(画像にしたアイコンの一覧)
// アイコンの絵(art.js・falling-fx.js など)を変えたら、もう一度動かす。sw.js の FILES とキャッシュ名も直す。
const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web', 'pc-firebase');
const OUT = path.join(ROOT, 'assets', 'game-icons');
const SIZE = 320; // メニューで一番大きく出るのは約 146px。高解像度の画面でもきれいに見える大きさ
const BASE = process.env.BASE || 'http://localhost:8400/pc-firebase/';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  await p.goto(BASE + '?icons-build');
  await p.waitForFunction(() => typeof CAT !== 'undefined' && CAT.length > 0);
  await p.evaluate(() => document.fonts.ready);
  // 画像にするアイコン(すでに画像のものは除く)。描くのは今の SVG(icon-images.js で置き換える前のもの)
  const keys = await p.evaluate(() => {
    const out = [];
    for (const g of CAT) {
      const key = (typeof ART_ID !== 'undefined' && ART_ID[g.id]) || g.id;
      const svg = (window.__AR_SVG || AR)[key];
      if (svg && !out.includes(key) && !/assets\/game-icons\//.test(svg)) out.push(key);
    }
    return out;
  });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'icons-'));
  for (const key of keys) {
    await p.evaluate(({key, size}) => {
      let box = document.getElementById('iconBuildBox');
      if (!box) {
        box = document.createElement('div'); box.id = 'iconBuildBox';
        box.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:99999;background:transparent`;
        document.body.append(box);
      }
      box.innerHTML = (window.__AR_SVG || AR)[key];
      const s = box.firstElementChild; s.setAttribute('width', size); s.setAttribute('height', size); s.style.display = 'block';
    }, {key, size: SIZE});
    await p.waitForTimeout(150);
    const png = path.join(tmp, key + '.png');
    await (await p.$('#iconBuildBox')).screenshot({path: png, omitBackground: true});
    execFileSync('python3', ['-I', '-c',
      'import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],"WEBP",quality=88,method=6)',
      png, path.join(OUT, key + '.webp')]);
  }
  await b.close();
  const js = `'use strict';
// メニューのアイコンを、前もって作った画像に置き換える(tools/build_game_icons.cjs が作る。手で直さない)。
// その場で SVG の図形とフィルターを計算しないので、メニューの描画とスクロールが軽くなる。
// 元の SVG は window.__AR_SVG に残す(画像を作り直す時に使う)。
(() => {
  const ids = ${JSON.stringify(keys)};
  window.__AR_SVG = window.__AR_SVG || {};
  for (const id of ids) { if (!(id in window.__AR_SVG)) window.__AR_SVG[id] = AR[id]; AR[id] = photoIcon(id); }
})();
`;
  fs.writeFileSync(path.join(ROOT, 'js', 'icon-images.js'), js);
  console.log('画像にしたアイコン', keys.length, '個:', keys.join(','));
})();
