// あそび箱30 Web 版の起動(画面は元のアプリの Compose のコードを Wasm にしたもの: asobi.js)。
// ここでは、画面の外の部品をつないでから画面を読み込む:
//  ・CPU の思考と効果音の計算: worker.js(規則・CPU・音は同じ Kotlin のコードを JS にしたもの)
//  ・効果音の再生: audio.js(Web Audio)
//  ・通信: net.js(WebRTC・中継)
//  ・お知らせの表示、Android の戻るボタン、オフラインのための保存
import { createSfx } from "./audio.js";
import { createNet } from "./net.js";

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
globalThis.asobiReady = () => { const s = document.getElementById("splash"); if (s) s.remove(); };

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
document.body.appendChild(s);
