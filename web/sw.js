// ネットが切れても遊べるように、最初に全部のファイルを端末に保存する(tools/make_sw.py が作る。手で直さない)
const VERSION = "b70795517ff1";
const CACHE = "asobi30-" + VERSION;
const FILES = [
  "./",
  "./app.js",
  "./art.js",
  "./art_sample.js",
  "./audio.js",
  "./audio/go_stone_1.mp3",
  "./audio/go_stone_2.mp3",
  "./audio/go_stone_3.mp3",
  "./audio/go_stone_4.mp3",
  "./audio/go_stone_5.mp3",
  "./audio/koma_piece.mp3",
  "./core/asobibako-web-core.mjs",
  "./core/kotlin-kotlin-stdlib.mjs",
  "./core/kotlin_org_jetbrains_kotlin_kotlin_dom_api_compat.mjs",
  "./fonts/YujiBoku-Koma.woff2",
  "./fonts/ZenMaruGothic-Bold.woff2",
  "./fonts/ZenMaruGothic-Medium.woff2",
  "./games.js",
  "./games2.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./licenses/YujiBoku-OFL.txt",
  "./licenses/ZenMaruGothic-OFL.txt",
  "./licenses/kotlin.txt",
  "./licenses/sounds.txt",
  "./manifest.webmanifest",
  "./net.js",
  "./style.css",
  "./worker.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("asobi30-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 同じサイトのファイルは、保存したものを先に使う(なければネットから取って保存する)。外のサイト(中継など)は触らない
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))),
  );
});
