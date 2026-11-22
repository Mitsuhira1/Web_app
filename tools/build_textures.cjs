// 卓・マスのフェルトのざらつき(もとは CSS の --noise)を、前もって画像(WebP・劣化なし)にする。
// もとは CSS の中の SVG(feTurbulence = 雑音の計算)を 160px ごとに敷き詰めていて、卓を描き直すたびに雑音を計算し直していた。
// 画像にすると、見た目は同じまま(1 画素の差が 255 段階で 1 まで)、描き直しが軽くなる(メニューのアイコンを画像にしたのと同じ考え)。
// 木目(--grain)は SVG のまま: 盤いっぱいに 1 枚だけ引き伸ばすので、ブラウザがその大きさで覚えて使い回す。画像にしても軽くならなかった。
// 使い方(リポジトリのルートで):
//   node tools/build_textures.cjs
// 出力: web/pc-firebase/assets/tex/<名前>.webp(等倍)・@2x(高解像度の画面用)・@3x
//   拡大して見せる盤(twelve-scene: ガイスター・ラミィキューブ。transform で 1.1 倍など)は、@2x/@3x を縮めて使う。
//   粒の細かい画像を半端な倍率で拡大すると、格子のような模様(モアレ)が出るため。
// マンカラの盤の木枠(js/art.js の wood() の影と木目)も画像にする: mancala-shadow.webp(盤の外に 4 広い 808×388)・mancala-grain.webp(木目の四角の所だけ。盤の 26,26 から 748×328)
//   盤(SVG)は玉が動くたびに描き直すが、そのたびに大きな影のぼかしと木目の雑音を計算していた(描き直しの CPU が約 2.5 倍)。
//   木の色(グラデーション)とふちの線は SVG のまま(js/boards/fix.js の mancalaFrame)。木枠の形・木目・影を変えたら動かし直す。
//   アプリの画面(art.js の xGr フィルター)を使うので、先に python3 -m http.server -d web 8400 を動かしておく。
// 地模様を変える時は、下の SRC を直してからもう一度動かす(css/app.css・twelve.css の noise.webp を使う所)。sw.js の FILES とキャッシュ名も直す。
const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OUT = path.join(__dirname, '..', 'web', 'pc-firebase', 'assets', 'tex');
// もとの SVG(2026-11-21 まで css/app.css の --noise に書いていたもの。数字は変えていない)
const SRC = {
  noise: {w: 160, h: 160, svg: `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0 0 0 -.16'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>`},
};

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tex-'));
  const b = await chromium.launch();
  for (const scale of [1, 2, 3]) {
    const p = await b.newPage({viewport: {width: 800, height: 600}, deviceScaleFactor: scale});
    for (const [name, s] of Object.entries(SRC)) {
      // CSS の背景と同じく「SVG を画像として」描く(ブラウザが画面に出す時と同じ計算)
      await p.setContent(`<style>html,body{margin:0;background:transparent}</style><div id="t" style="width:${s.w}px;height:${s.h}px;background:url(&quot;data:image/svg+xml,${s.svg.replace(/</g, '%3C').replace(/>/g, '%3E')}&quot;)"></div>`);
      await p.waitForTimeout(200);
      const png = path.join(tmp, `${name}-${scale}.png`);
      await (await p.$('#t')).screenshot({path: png, omitBackground: true});
      const out = path.join(OUT, name + (scale > 1 ? `@${scale}x` : '') + '.webp');
      execFileSync('python3', ['-I', '-c',
        'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGBA").save(sys.argv[2],"WEBP",lossless=True,quality=100,method=6)',
        png, out]);
      console.log(path.relative(process.cwd(), out), fs.statSync(out).size, 'bytes');
    }
    await p.close();
  }
  // マンカラの木枠(盤の SVG の viewBox 800×380 全体を、3 倍の細かさで)
  const MW = 800, MH = 380, MS = 3, M = 4, BASE = process.env.BASE || 'http://localhost:8400/pc-firebase/';
  const p = await b.newPage({viewport: {width: (MW + 8) * MS + 50, height: (MH + 8) * MS + 50}, deviceScaleFactor: 1});
  await p.goto(BASE + '?tex-build');
  await p.waitForFunction(() => document.getElementById('xGr'));
  const xGr = await p.evaluate(() => document.getElementById('xGr').outerHTML); // 木目の雑音(art.js)。アプリの画面からそのまま借りる
  for (const part of ['shadow', 'grain']) {
    // wood(6, 6, 788, 368, 60, 'xWal') と同じ形。影だけ・木目だけを、透明な何もない頁に描く(重ねる順と濃さは mancalaFrame で、もとと同じにする)
    const [x, y, w, h, r] = [6, 6, MW - 12, MH - 12, 60];
    const body = part === 'shadow'
      // feDropShadow(xShL)の影の部分だけ(もとの形は重ねない。上に木の色の四角を SVG で描く)
      ? `<defs><filter id="texSh" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur in="SourceAlpha" stdDeviation="8"/><feOffset dx="0" dy="8"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer></filter></defs>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#000" filter="url(#texSh)"/>`
      : `<defs>${xGr}</defs><rect x="${x + r / 3}" y="${y + r / 3}" width="${w - r * 2 / 3}" height="${h - r * 2 / 3}" filter="url(#xGr)"/>`;
    // 影は盤の外(viewBox の外)まで 4 だけ広く描く。盤の端で切れるのは、もとと同じく画面の SVG の枠に任せる(画像の端だと 1 画素欠ける)
    // 木目は木目の四角(26,26 から 748×328)の所だけを画像にする(描く広さを減らす)
    const [vx, vy, vw, vh] = part === 'shadow' ? [-M, -M, MW + 2 * M, MH + 2 * M] : [x + r / 3, y + r / 3, w - r * 2 / 3, h - r * 2 / 3];
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style><svg id="texBox" xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw * MS}" height="${vh * MS}" style="display:block">${body}</svg>`);
    await p.waitForTimeout(300);
    const png = path.join(tmp, `mancala-${part}.png`), out = path.join(OUT, `mancala-${part}.webp`);
    await (await p.$('#texBox')).screenshot({path: png, omitBackground: true});
    // 木目の色は一色(濃さだけが違う)。透明度から色を戻す時の 1 段の揺れをならして一色にすると、劣化なしのまま小さくなる
    execFileSync('python3', ['-I', '-c', `import sys,collections
from PIL import Image
im=Image.open(sys.argv[1]).convert("RGBA")
if sys.argv[3]=="grain":
    r,g,b,a=im.split(); c=collections.Counter(zip(*(ch.get_flattened_data() for ch in (r,g,b,a))))
    col=max(((k[:3],n) for k,n in c.items() if k[3]>=200),key=lambda t:t[1])[0]
    im=Image.merge("RGBA",[Image.new("L",im.size,col[0]),Image.new("L",im.size,col[1]),Image.new("L",im.size,col[2]),a])
    # 濃さ(透明度)は少しだけ圧縮する(平均 3.5/255 の差。盤では 0.4 の濃さで木とほぼ同じ色に重ねるので、画面では 0.2 段ほど = 見えない)。劣化なしだと 0.5MB ある
    im.save(sys.argv[2],"WEBP",quality=100,alpha_quality=60,method=6)
else:
    im.save(sys.argv[2],"WEBP",lossless=True,quality=100,method=6)`, png, out, part]);
    console.log(path.relative(process.cwd(), out), fs.statSync(out).size, 'bytes');
  }
  await b.close();
})();
