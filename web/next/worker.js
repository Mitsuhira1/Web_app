// 規則と CPU(Kotlin から作った JS)を、画面とは別のスレッドで動かす。CPU が考えている間も画面が止まらない。
import * as core from "./core/asobibako-web-core.mjs";

self.onmessage = (e) => {
  const { id, fn, args } = e.data;
  try {
    const t = performance.now();
    const r = core[fn](...args);
    self.postMessage({ id, r, ms: performance.now() - t });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack ? err.stack : err) });
  }
};
self.postMessage({ id: 0, ready: true });
