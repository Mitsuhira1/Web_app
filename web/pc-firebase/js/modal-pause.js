/* シングルプレイで、確認(終了・降参など)や設定・ルールの画面を開いている間は、盤の進行を止める。
 * 進行そのもの(CPU の手・時計・落下)は app.js の modalPause() が待つ。ここは「見える動き」を止める:
 *  - Web Animations(CSS アニメーション・transition・element.animate)を、画面の上に出ている物(シート・モーダル)以外は一時停止する
 *  - performance.now() を止め(閉じたら止めていた分だけ戻す)、performance.now() で進めている JS のアニメーション(サイコロ・ルーレットなど)を止める
 *    ※ 止めない時計が要る所(効果音の間引きなど)は window.rawNow() を使う。
 * 通信中(部屋に入っている間)と、対局画面以外では何もしない。 */
'use strict';
(() => {
  const real = performance.now.bind(performance);
  window.rawNow = real;
  let paused = false, pausedAt = 0, offset = 0;
  performance.now = () => (paused ? pausedAt : real()) - offset;

  const PLAY = /^(play|slidePlay|bunyoPlay|pakurisPlay|minePlay|wolfPlay|extraPlay)$/;
  const OVERLAY = '#sheetwrap, .modal, #toast, .toast, .padcfg, #padcursor';
  const held = new Set();
  const want = () => {
    try {
      if (typeof S === 'undefined' || !PLAY.test(S.screen)) return false;
      if (typeof online !== 'undefined' && online) return false;
      if (typeof roomActive === 'function' && roomActive()) return false;
      return typeof modalPause === 'function' && modalPause();
    } catch (e) { return false; }
  };
  const inOverlay = (a) => {
    const t = a.effect && a.effect.target;
    return !!(t && t.closest && t.closest(OVERLAY));
  };
  function holdAnimations() {
    let list = [];
    try { list = document.getAnimations(); } catch (e) { return; }
    for (const a of list) {
      if (a.playState !== 'running' || held.has(a) || inOverlay(a)) continue;
      try { a.pause(); held.add(a); } catch (e) {}
    }
  }
  function releaseAnimations() {
    for (const a of held) { try { if (a.playState === 'paused') a.play(); } catch (e) {} }
    held.clear();
  }
  function sync() {
    const w = want();
    if (w && !paused) { pausedAt = real(); paused = true; holdAnimations(); }
    else if (!w && paused) { offset += real() - pausedAt; paused = false; releaseAnimations(); }
    else if (w) holdAnimations(); // 止めている間に新しく始まった動きも止める
  }
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(sync, 120);
  window.__modalPaused = () => paused;
})();
