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
# 起動に要る小さいファイルだけを先に保存して、すぐ新しい版に入れ替える。
# 大きいファイル(画面の Wasm など)と前の画面(lite/)は、読み込んだ時に保存する(2回目からはネットなしで開ける)
BIG = 1_000_000
first = [f for f in files if not f.startswith("lite/") and os.path.getsize(os.path.join(WEB, f)) < BIG]
rest = [f for f in files if not f.startswith("lite/") and f not in first]
lst = ",\n  ".join(f'"./{f}"' for f in first)
rlst = ",\n  ".join(f'"./{f}"' for f in rest)
sw = f'''// ネットが切れても遊べるように、ファイルを端末に保存する(tools/make_sw.py が作る。手で直さない)
// ・ページ(index.html)は、ネットにつながる時はいつもネットから取る(新しい版がすぐ出る)
// ・ほかのファイルは、この版で保存したものを先に使う(なければネットから取って保存する)
const VERSION = "{version}";
const CACHE = "asobi30-" + VERSION;
const FIRST = [
  "./",
  {lst},
];
// 画面が読み込み終わった後に、ページから頼まれて保存する大きいファイル
const REST = [
  {rlst},
];

self.addEventListener("install", (e) => {{
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FIRST.map((u) => new Request(u, {{ cache: "reload" }}))))
    .then(() => self.skipWaiting()));
}});

self.addEventListener("activate", (e) => {{
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("asobi30-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
}});

self.addEventListener("message", (e) => {{
  if (e.data !== "save-rest") return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(REST.map((u) => c.match(u).then((hit) => hit || c.add(new Request(u, {{ cache: "no-cache" }})).catch(() => {{}}))))));
}});

const save = (req, res) => {{ if (res.ok) {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }} return res; }};

self.addEventListener("fetch", (e) => {{
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {{
    e.respondWith(fetch(req, {{ cache: "no-cache" }}).then((res) => {{ if (!res.ok) throw new Error("bad"); return save(req, res); }})
      .catch(() => caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || caches.match("./index.html"))));
    return;
  }}
  e.respondWith(
    caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || fetch(req, {{ cache: "no-cache" }}).then((res) => save(req, res))),
  );
}});
'''
open(os.path.join(WEB, "sw.js"), "w", encoding="utf-8").write(sw)
print(f"web/sw.js: 先に保存 {len(first)} 個 / 全部 {len(files)} 個、版 {version}")
