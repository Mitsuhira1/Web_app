// ネットが切れても遊べるように、ファイルを端末に保存する(tools/make_sw.py が作る。手で直さない)
// ・ページ(index.html)は、ネットにつながる時はいつもネットから取る(新しい版がすぐ出る)
// ・ほかのファイルは、この版で保存したものを先に使う(なければネットから取って保存する)
const VERSION = "0dddd9c0a3a2";
const CACHE = "asobi30-" + VERSION;
const FIRST = [
  "./",
  "./asobi.js",
  "./audio.js",
  "./audio/go_stone_1.mp3",
  "./audio/go_stone_2.mp3",
  "./audio/go_stone_3.mp3",
  "./audio/go_stone_4.mp3",
  "./audio/go_stone_5.mp3",
  "./audio/koma_piece.mp3",
  "./boot.js",
  "./composeResources/jp.yonekou.asobi26.res/files/koma_yuji_boku.ttf",
  "./core/kotlin-kotlin-stdlib.mjs",
  "./core/kotlin_org_jetbrains_kotlin_kotlin_dom_api_compat.mjs",
  "./fonts/YujiBoku-Koma.woff2",
  "./fonts/ZenMaruGothic-Bold.woff2",
  "./fonts/ZenMaruGothic-Medium.woff2",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./licenses/YujiBoku-OFL.txt",
  "./licenses/ZenMaruGothic-OFL.txt",
  "./licenses/compose.txt",
  "./licenses/kotlin.txt",
  "./licenses/sounds.txt",
  "./manifest.webmanifest",
  "./net.js",
  "./worker.js",
];
// 画面が読み込み終わった後に、ページから頼まれて保存する大きいファイル
const REST = [
  "./asobi.wasm",
  "./composeResources/jp.yonekou.asobi26.res/files/zen_maru_gothic_bold.ttf",
  "./composeResources/jp.yonekou.asobi26.res/files/zen_maru_gothic_medium.ttf",
  "./core/asobibako-web-core.mjs",
  "./dd568dbcd078c0adf7cf.wasm",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FIRST.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("asobi30-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data !== "save-rest") return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(REST.map((u) => c.match(u).then((hit) => hit || c.add(new Request(u, { cache: "no-cache" })).catch(() => {}))))));
});

const save = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req, { cache: "no-cache" }).then((res) => { if (!res.ok) throw new Error("bad"); return save(req, res); })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req, { cache: "no-cache" }).then((res) => save(req, res))),
  );
});
