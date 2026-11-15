// Web 版(アプリとしてインストール)だけで使う。exe・動く見本には入らない(tools/sync_pc.py が足す)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).then((r) => r.update()).catch(() => {});
// ウィンドウの大きさ: アプリとして開いた時は、その大きさにする(ブラウザのタブでは変えられない)
async function setWinSize(v) {
  const [w, h] = String(v).split('×').map(Number); if (!w) return;
  const app = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches;
  if (!app) { toast({ w: 'お知らせ', t: 'ブラウザのタブで開いている時は、ウィンドウの大きさは変えられません(アプリとしてインストールすると変わります)' }); return; }
  try {
    const fw = w + (outerWidth - innerWidth), fh = h + (outerHeight - innerHeight);
    resizeTo(fw, fh); moveTo(Math.max(0, (screen.availWidth - fw) / 2), Math.max(0, (screen.availHeight - fh) / 2));
  } catch (e) { toast({ w: 'お知らせ', t: '大きさを変えられませんでした' }); }
}
