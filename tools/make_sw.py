#!/usr/bin/env python3
"""web/sw.js(ネットが切れても遊べるように、全部のファイルを最初に端末へ保存する Service Worker)を作る。
保存するファイルの一覧と、中身から計算した版(変わると古い保存を入れ替える)を書き込む。
使い方: python3 tools/make_sw.py   (tools/build_web.sh からも呼ぶ)
"""
import hashlib, os
WEB = os.path.join(os.path.dirname(__file__), "..", "web")
SKIP_EXT = {".ogg", ".map"}          # 録音は mp3 を使う(ogg は元の録音の写し)
files = []
for root, _, names in os.walk(WEB):
    for n in sorted(names):
        rel = os.path.relpath(os.path.join(root, n), WEB).replace(os.sep, "/")
        if rel == "sw.js" or os.path.splitext(n)[1] in SKIP_EXT:
            continue
        files.append(rel)
files.sort()
h = hashlib.sha256()
for f in files:
    h.update(f.encode()); h.update(open(os.path.join(WEB, f), "rb").read())
version = h.hexdigest()[:12]
lst = ",\n  ".join(f'"./{f}"' for f in files)
sw = f'''// ネットが切れても遊べるように、最初に全部のファイルを端末に保存する(tools/make_sw.py が作る。手で直さない)
const VERSION = "{version}";
const CACHE = "asobi30-" + VERSION;
const FILES = [
  "./",
  {lst},
];

self.addEventListener("install", (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
}});

self.addEventListener("activate", (e) => {{
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("asobi30-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
}});

// 同じサイトのファイルは、保存したものを先に使う(なければネットから取って保存する)。外のサイト(中継など)は触らない
self.addEventListener("fetch", (e) => {{
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || fetch(req).then((res) => {{
      if (res.ok) {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }}
      return res;
    }}).catch(() => (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))),
  );
}});
'''
open(os.path.join(WEB, "sw.js"), "w", encoding="utf-8").write(sw)
print(f"web/sw.js: {len(files)} 個のファイル、版 {version}")
