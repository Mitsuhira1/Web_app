#!/usr/bin/env python3
"""PC 版(日本アソビ大辞典30)を web/pc/ に写す。Edge などで「アプリとしてインストール」して使う版。

元: ../Windows-Projects/app/(exe・動く見本と同じ中身)。手で web/pc/ を直さず、元を直してからこれを回す。
足すもの(web/pc/ だけ):
  - manifest.webmanifest … アプリとして入れる時の名前とアイコン
  - sw.js                 … ネットが切れても開けるように保存する(いつもはネットから新しい版を取る)
  - pwa.js                … 保存係の登録と、ウィンドウの大きさ(アプリとして開いた時)
使い方: python3 tools/sync_pc.py [Windows-Projects の app/ の場所]
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "Windows-Projects" / "app"
DST = ROOT / "web" / "pc"
ICON512 = SRC.parent / "src-tauri" / "icons" / "icon.png"  # 角の丸いアイコン(512)

if not (SRC / "index.html").exists():
    sys.exit(f"元が見つかりません: {SRC}")
if DST.exists():
    shutil.rmtree(DST)
shutil.copytree(SRC, DST)
shutil.copyfile(ICON512, DST / "icons" / "icon-round-512.png")

manifest = {
    "name": "日本アソビ大辞典30",
    "short_name": "日本アソビ大辞典30",
    "lang": "ja",
    "start_url": "./",
    "scope": "./",
    "id": "./",
    "display": "standalone",
    "background_color": "#1C1712",
    "theme_color": "#1C1712",
    "icons": [
        {"src": "icons/icon-round-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-round-512.png", "sizes": "512x512", "type": "image/png"},
    ],
}
(DST / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

(DST / "pwa.js").write_text("""// Web 版(アプリとしてインストール)だけで使う。exe・動く見本には入らない(tools/sync_pc.py が足す)
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
""", encoding="utf-8")

# 保存するファイルの一覧(sw.js 自身は除く)
files = sorted(str(p.relative_to(DST)).replace("\\", "/") for p in DST.rglob("*") if p.is_file() and p.name != "sw.js")
h = hashlib.sha256()
for f in files:
    h.update(f.encode()); h.update((DST / f).read_bytes())
version = h.hexdigest()[:12]
(DST / "sw.js").write_text(f"""// PC 版(Web): ネットにつながる時はいつもネットから新しいファイルを取り、切れている時だけ保存したものを使う(tools/sync_pc.py が作る)
const CACHE = "asobipc-{version}";
const FILES = {json.dumps(["./"] + ["./" + f for f in files], ensure_ascii=False, indent=0)};
self.addEventListener("install", (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, {{ cache: "reload" }})))).then(() => self.skipWaiting()));
}});
self.addEventListener("activate", (e) => {{
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("asobipc-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener("fetch", (e) => {{
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, {{ cache: "no-cache" }}).then((res) => {{
    if (res.ok) {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }}
    return res;
  }}).catch(() => caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
}});
""", encoding="utf-8")

# index.html: アプリとして入れる情報と、pwa.js(app.js の後に読む。setWinSize を Web 用に置き換える)
p = DST / "index.html"
s = p.read_text(encoding="utf-8")
a = '<link rel="stylesheet" href="css/app.css">'
assert s.count(a) == 1
s = s.replace(a, '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#1C1712">\n<link rel="apple-touch-icon" href="icons/icon-round-192.png">\n' + a)
a = '<script src="js/app.js"></script>'
assert s.count(a) == 1
s = s.replace(a, a + '\n<script src="pwa.js"></script>')
p.write_text(s, encoding="utf-8")
print(f"web/pc/ に写しました({len(files)} ファイル、版 {version})")
