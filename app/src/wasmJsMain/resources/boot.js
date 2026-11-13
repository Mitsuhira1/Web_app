// あそび箱30 Web 版の起動(画面は元のアプリの Compose のコードを Wasm にしたもの: asobi.js)。
// ここでは、画面の外の部品をつないでから画面を読み込む:
//  ・CPU の思考と効果音の計算: worker.js(規則・CPU・音は同じ Kotlin のコードを JS にしたもの)
//  ・効果音の再生: audio.js(Web Audio)
//  ・通信: net.js(WebRTC・中継)
//  ・お知らせの表示、Android の戻るボタン、オフラインのための保存
import { createSfx } from "./audio.js";
import { createNet } from "./net.js";

// ---------------------------------------------------------------- 描く細かさの上限(軽量化)
// 画面の細かさ(devicePixelRatio)が 2 を超える端末では、2 として描く。描く画素の数が減って動きがなめらかになる
// (字や線はほんの少しやわらかくなる)。画面(Compose)が読み込まれる前に決めておく
const DPR_MAX = 2;
try {
  const real = window.devicePixelRatio || 1;
  if (real > DPR_MAX) Object.defineProperty(window, "devicePixelRatio", { get: () => DPR_MAX, configurable: true });
} catch { /* 変えられない時はそのまま */ }

// ---------------------------------------------------------------- Worker(CPU の思考・効果音の計算)
const worker = new Worker("./worker.js", { type: "module" });
let seq = 1;
const pending = new Map();
let readyResolve;
const workerReady = new Promise((r) => (readyResolve = r));
worker.onmessage = (e) => {
  if (e.data.ready) return readyResolve();
  const p = pending.get(e.data.id);
  if (!p) return;
  pending.delete(e.data.id);
  e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.r);
};
const call = async (fn, ...args) => {
  await workerReady;
  return new Promise((resolve, reject) => {
    const id = seq++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, fn, args });
  });
};
// 局面は「同じ種と手の並び」から Worker の側で作り直して考える(規則は同じコード)
globalThis.asobiCpu = async (record, millis) => {
  const h = await call("restoreMatch", record);
  if (h < 0) return -1;
  try { return await call("cpuChoose", h, millis); } finally { call("dropMatch", h); }
};

// ---------------------------------------------------------------- 効果音
try {
  const sfx = createSfx(call);
  globalThis.asobiSfx = sfx;
  sfx.init().catch(() => {});
} catch { /* 音が使えなくても止めない */ }

// ---------------------------------------------------------------- 通信(net.js を Kotlin 側から使う)
globalThis.asobiCreateNet = createNet;

// ---------------------------------------------------------------- お知らせ(Android の Toast の代わり)
globalThis.asobiToast = (text, ms) => {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(globalThis.asobiToast.t);
  globalThis.asobiToast.t = setTimeout(() => (el.hidden = true), ms || 2000);
};

// ---------------------------------------------------------------- 固まった時の自動復帰
// ブラウザが裏で終了して読み込み直された時などに、画面が出ないまま止まることがある。
// ・一定時間たっても画面が出ない / 画面の部品の読み込みに失敗した / 画面が出る前に戻るを押した → 自動で読み込み直す
// ・読み込み直しが続いても、無限に繰り返さない(1分に2回まで)
let appReady = false;
function recover(why) {
  try {
    const now = Date.now();
    const log = JSON.parse(sessionStorage.getItem("asobi-recover") || "[]").filter((t) => now - t < 60000);
    if (log.length >= 2) return;
    log.push(now);
    sessionStorage.setItem("asobi-recover", JSON.stringify(log));
  } catch { /* 記録できなくても読み込み直す */ }
  location.reload();
}
setTimeout(() => { if (!appReady) recover("timeout"); }, 25000);
// 裏から戻った時に、まだ画面が出ていなければ読み込み直す
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !appReady) setTimeout(() => { if (!appReady) recover("visible"); }, 8000); });
// ページが履歴の保存(bfcache)から戻された時は、いつも読み込み直す(古い状態で固まらないように)
window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

// ---------------------------------------------------------------- Android の戻るボタン
// Chrome は、ページが「操作されていない時」に積んだ履歴の段を、戻るボタンで飛ばす。
// だから段は、指を離した時・クリック・キーの時にだけ積む(戻るを続けて押せるよう3段まで)。
// 戻るが押されたら、画面(Kotlin)の BackHandler に渡す。ホームでは「このアプリを終了しますか?」を画面が出す。
const TRAP_MAX = 3;
let traps = 0;
let leaving = false;
function fillTraps() { try { while (traps < TRAP_MAX) { history.pushState({ asobi: 1 }, ""); traps++; } } catch { /* 何もしない */ } }
for (const ev of ["pointerup", "click", "keydown"]) window.addEventListener(ev, () => { if (!leaving) fillTraps(); }, { capture: true, passive: true });
window.addEventListener("popstate", () => {
  if (leaving) return;
  traps = Math.max(0, traps - 1);
  if (!appReady) { recover("back"); return; }
  try { globalThis.asobiOnBack && globalThis.asobiOnBack(); } catch { /* 何もしない */ }
});
globalThis.asobiExit = () => {
  leaving = true;
  try { window.close(); } catch { /* 閉じられない時は履歴を戻ってページを離れる */ }
  history.go(-(traps + 1));
  traps = 0;
  setTimeout(() => (leaving = false), 1500);
};

// ---------------------------------------------------------------- 読み込み終わり
globalThis.asobiReady = () => {
  appReady = true;
  const s = document.getElementById("splash");
  if (s) s.remove();
  // 画面が出たら、大きいファイル(画面の Wasm など)も端末に保存しておく(次からネットなしで開ける)
  try { navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage("save-rest")).catch(() => {}); } catch { /* 何もしない */ }
};

// ---------------------------------------------------------------- ネットが切れても遊べるように(全部のファイルを端末に保存する)
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let touched = false;
  window.addEventListener("pointerdown", () => (touched = true), { once: true, capture: true });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // 新しい版を保存し終えた時、まだ触っていなければ読み込み直して入れ替える(触った後なら次に開いた時)
    if (hadController && !touched) location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((r) => r.update()).catch(() => {});
}

// ---------------------------------------------------------------- 画面(Compose)を読み込む
const s = document.createElement("script");
s.src = "asobi.js";
s.onerror = () => recover("script");
document.body.appendChild(s);
