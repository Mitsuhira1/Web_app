/* PC向けゲームパッド(PAD)操作対応 */
'use strict';
(() => {
  const INTERACT_SEL = [
    'button:not([disabled]):not([tabindex="-1"]):not(.mback):not(.cutin):not(.toast)',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[role="switch"]:not([disabled])',
    '#boardwrap [data-sq]',
    '#boardwrap [data-i]',
    '#boardwrap [data-hand]',
    '#boardwrap [data-pit]',
    '#boardwrap [data-e]',
    '#boardwrap [data-col]',
    '#boardwrap [data-p]',
    '#boardwrap [data-off]',
    '#boardwrap [data-t]',
    '#boardwrap [data-tok]',
    '#boardwrap [data-pos]',
    '#boardwrap [data-card]',
    '#boardwrap [data-k]',
    '#boardwrap [data-src]',
    '#boardwrap [data-dest]',
    '#boardwrap [data-draw]',
    '#boardwrap [data-roll]',
    '#boardwrap [data-spin]',
    '#boardwrap [data-lm]',
    '#boardwrap [data-d]',
    '#boardwrap [data-die]',
    '#boardwrap [data-cat]',
    '#boardwrap [data-ycell]',
    '#boardwrap [data-tgt]',
    '#boardwrap [data-bet]',
    '#boardwrap [data-pass]',
    '#boardwrap [data-slide-tile]',
    '#boardwrap [data-mine-cell]',
    '#boardwrap [data-extra-mine]',
    '#boardwrap [data-extra-mine-attack]',
    '#boardwrap [data-extra-mine-mode]',
    '#boardwrap [data-extra-poet-pick]',
    '[data-wolf-target]',
    '[data-wolf-stamp]',
  ].join(',');

  const connectedPads = new Map();
  const prevBtn = new Map();
  const repeatState = { dir: '', nextAt: 0 };
  let curFocus = null;
  let rafId = null;

  const dead = (el) => {
    if (!el || !el.isConnected) return true;
    if (el.disabled || el.classList.contains('disabled') || el.classList.contains('waiting')) return true;
    if (el.closest('[hidden],[inert],.is-hidden')) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    const r = el.getBoundingClientRect();
    return r.width <= 1 || r.height <= 1;
  };

  function getScope() {
    return $('#sheetwrap') || $('.modal') || app || document.body;
  }

  function isActionable(el) {
    if (dead(el)) return false;
    if (el.matches('input, select, button')) return true;
    if (el.matches('.spile[data-dest], .slot[data-dest]')) {
      return el.matches('.can') || el.children.length === 0 || !!el.querySelector(':scope > .empty');
    }
    return true;
  }

  function getCandidates() {
    const scope = getScope();
    if (!scope) return [];
    const raw = [...scope.querySelectorAll(INTERACT_SEL)].filter(isActionable);
    // 重複(たとえば <button data-src> と親要素など)や親子被りを整理
    const set = new Set(raw);
    return raw.filter((el) => {
      if (el.matches('.spile[data-dest]')) return true;
      for (const other of set) {
        if (other !== el && el.contains(other) && !other.matches('.pcard')) return false;
      }
      return true;
    });
  }

  function anchorRect(el) {
    if (el.matches('.spile[data-dest]')) {
      const target = el.querySelector(':scope > .pcard:last-child') || el.lastElementChild || el;
      return target.getBoundingClientRect();
    }
    return el.getBoundingClientRect();
  }

  function clearFocus(keepRef = false) {
    document.querySelectorAll('.gp-focus').forEach((e) => e.classList.remove('gp-focus'));
    if (!keepRef) curFocus = null;
  }

  function setFocus(el) {
    if (!el || !el.isConnected) return;
    document.querySelectorAll('.gp-focus').forEach((e) => {
      if (e !== el) e.classList.remove('gp-focus');
    });
    curFocus = el;
    el.classList.add('gp-focus');
    try { el.focus({ preventScroll: true }); } catch (e) {}
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    if (el.dataset && el.dataset.tile && S.screen === 'menu' && S.sel !== el.dataset.tile) {
      S.sel = el.dataset.tile;
      document.querySelectorAll('[data-tile]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.tile === S.sel)));
      const dt = $('.detail');
      if (dt && typeof detail === 'function') dt.outerHTML = detail();
      if (typeof sfxHover === 'function') sfxHover();
    }
  }

  function ensureFocus() {
    if (curFocus && curFocus.isConnected && getScope().contains(curFocus) && isActionable(curFocus)) {
      if (!curFocus.classList.contains('gp-focus')) curFocus.classList.add('gp-focus');
      return curFocus;
    }
    const all = getCandidates();
    if (!all.length) { clearFocus(); return null; }
    const scope = getScope();
    const preferred =
      (S.sel && scope.querySelector(`[data-tile="${S.sel}"]`)) ||
      scope.querySelector('#boardwrap .can, #boardwrap .tokcan, #boardwrap .mcan, #boardwrap .tap, #boardwrap [data-roll]:not([disabled]), #boardwrap [data-spin]:not([disabled])') ||
      scope.querySelector('#acts button:not([disabled]):not(.waiting)') ||
      scope.querySelector('[data-start]:not([disabled]), .btn.primary:not([disabled]), .btn.gold:not([disabled])') ||
      all[0];
    setFocus(all.includes(preferred) ? preferred : all[0]);
    return curFocus;
  }

  function moveFocus(dirKey) {
    const all = getCandidates();
    if (!all.length) return;
    if (!curFocus || !all.includes(curFocus)) {
      ensureFocus();
      return;
    }
    // range スライダ操作中
    if (curFocus.matches('input[type="range"]') && (dirKey === 'ArrowLeft' || dirKey === 'ArrowRight')) {
      const step = (+curFocus.step || 5) * (dirKey === 'ArrowRight' ? 1 : -1);
      const min = curFocus.min !== '' ? +curFocus.min : 0;
      const max = curFocus.max !== '' ? +curFocus.max : 100;
      curFocus.value = String(Math.max(min, Math.min(max, (+curFocus.value || 0) + step)));
      curFocus.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const a = anchorRect(curFocus);
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const vec = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[dirKey];
    let best = null;
    let bestScore = Infinity;
    for (const cand of all) {
      if (cand === curFocus) continue;
      const r = anchorRect(cand);
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      const main = dx * vec[0] + dy * vec[1];
      if (main <= 4) continue;
      const side = Math.abs(dx * vec[1] + dy * vec[0]);
      const sc = main + side * 2.1;
      if (sc < bestScore) {
        bestScore = sc;
        best = cand;
      }
    }
    if (best) setFocus(best);
  }

  function triggerClick(el) {
    if (!el || dead(el)) return;
    if (el.matches('select')) {
      el.focus();
      const n = el.options.length;
      if (n > 0) {
        el.selectedIndex = (el.selectedIndex + 1) % n;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if (el.matches('input[type="checkbox"]')) {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el.matches('input[type="text"], input:not([type]), textarea')) {
      el.focus();
      return;
    }
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }

  function triggerSecondary(el) {
    const scope = getScope();
    // マインスイーパー系は X で旗を立てる
    if (el && (el.matches('[data-mine-cell], [data-extra-mine]') || el.closest('[data-mine-cell], [data-extra-mine]'))) {
      const target = el.closest('[data-mine-cell], [data-extra-mine]') || el;
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
      return;
    }
    if (cur && cur.id === 'solitaire' && el && el.matches('[data-src], [data-draw]') && typeof el.dispatchEvent === 'function') {
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
      return;
    }
    const act = scope.querySelector('#acts button:not([disabled]):not(.waiting)') ||
      scope.querySelector('[data-extra-mine-mode]:not([disabled]), [data-seg="mine:tap"] button:not([aria-pressed="true"]), [data-roll]:not([disabled]), [data-rule]:not([disabled])');
    if (act) triggerClick(act);
  }

  function triggerUndoOrThird() {
    const scope = getScope();
    const act = scope.querySelector('#acts button:last-child:not([disabled]):not(.waiting), [data-roll]:not([disabled]), [data-spin]:not([disabled]), [data-undo]:not([disabled])');
    if (act) triggerClick(act);
  }

  function handleBumper(delta) {
    const scope = getScope();
    // 設定タブ / モーダル内なら設定カテゴリを切替
    const cats = [...scope.querySelectorAll('.setcats button:not([disabled])')];
    if (cats.length > 1) {
      const idx = Math.max(0, cats.findIndex((b) => b.getAttribute('aria-current') === 'true'));
      triggerClick(cats[(idx + delta + cats.length) % cats.length]);
      return;
    }
    // 左レールタブがある画面ならタブ移動
    const tabs = [...scope.querySelectorAll('.rail .tabs button:not([disabled])')];
    if (tabs.length > 1) {
      const idx = Math.max(0, tabs.findIndex((b) => b.getAttribute('aria-current') === 'page'));
      triggerClick(tabs[(idx + delta + tabs.length) % tabs.length]);
      return;
    }
    // 対局中は 操作エリア <-> 盤面 のフォーカス切り替え
    const areas = [scope.querySelector('#boardwrap [data-src], #boardwrap [data-i], #boardwrap [data-sq], #boardwrap [data-card], #boardwrap [data-k], #boardwrap [data-die], #boardwrap [data-pit], #boardwrap [data-col]'),
      scope.querySelector('#acts button:not([disabled]):not(.waiting)'),
      scope.querySelector('.side .ops button:not([disabled])')].filter((x) => x && !dead(x));
    if (areas.length) {
      const curArea = curFocus && curFocus.closest('#boardwrap') ? 0 : curFocus && curFocus.closest('#acts') ? 1 : 2;
      setFocus(areas[(curArea + delta + areas.length) % areas.length]);
    }
  }

  function handleStart() {
    const scope = getScope();
    const playSet = scope.querySelector('[data-playsettings], [data-slide-settings], [data-bunyo-settings], [data-pakuris-settings], [data-mine-settings]');
    if (playSet && !$('#sheetwrap') && !$('.modal')) {
      triggerClick(playSet);
      return;
    }
    const startBtn = scope.querySelector('[data-start]:not([disabled]), [data-poet-start]:not([disabled]), [data-slide-start]:not([disabled]), [data-bunyo-start]:not([disabled]), [data-pakuris-start]:not([disabled]), [data-mine-start]:not([disabled]), [data-mine-vs-start]:not([disabled]), [data-wolf-start]:not([disabled]), [data-next]:not([disabled])');
    if (startBtn) triggerClick(startBtn);
  }

  function handleCancel() {
    if (ddOpen && typeof ddClose === 'function') return ddClose(true);
    if (typeof sel !== 'undefined' && sel != null && S.screen === 'play' && !$('#sheetwrap') && !$('.modal')) {
      sel = null;
      if (typeof drawPlay === 'function') drawPlay(true);
      return;
    }
    if (typeof goBack === 'function') goBack();
  }

  function directActionScreen(dirKey, buttonIdx) {
    if ($('#sheetwrap') || $('.modal')) return false;
    if (S.screen === 'slidePlay' && typeof slideGame !== 'undefined') {
      if (dirKey && slideGame.key(dirKey)) return true;
    }
    const isBunyo = (S.screen === 'bunyoPlay' || (S.screen === 'extraPlay' && typeof boardMatch !== 'undefined' && boardMatch.state?.game === 'bunyo'));
    if (isBunyo && typeof bunyoGame !== 'undefined') {
      const mapDir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down' };
      if (dirKey && mapDir[dirKey]) { bunyoGame.action(mapDir[dirKey]); return true; }
      if (buttonIdx === 0) { bunyoGame.action('rotate'); return true; }
      if (buttonIdx === 1 || buttonIdx === 2) { bunyoGame.action('rotateL'); return true; }
      if (buttonIdx === 3) { bunyoGame.action('drop'); return true; }
      if (buttonIdx === 9) { bunyoGame.action('again'); return true; }
    }
    const isPakuris = (S.screen === 'pakurisPlay' || (S.screen === 'extraPlay' && typeof boardMatch !== 'undefined' && boardMatch.state?.game === 'pakuris'));
    if (isPakuris && typeof pakurisGame !== 'undefined') {
      const mapDir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate' };
      if (dirKey && mapDir[dirKey]) { pakurisGame.action(mapDir[dirKey]); return true; }
      if (buttonIdx === 0) { pakurisGame.action('rotate'); return true; }
      if (buttonIdx === 1 || buttonIdx === 2) { pakurisGame.action('rotateL'); return true; }
      if (buttonIdx === 3) { pakurisGame.action('drop'); return true; }
      if (buttonIdx === 9) { pakurisGame.action('again'); return true; }
    }
    return false;
  }

  function syncConnectedPads(pads) {
    const aliveIds = new Set();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const key = `${gp.index}:${gp.id || 'pad'}`;
      aliveIds.add(key);
      if (!connectedPads.has(key)) {
        connectedPads.set(key, gp.id || 'コントローラー');
        const label = gp.id ? gp.id.replace(/\s*\(.*?\)\s*/g, '').slice(0, 26) : 'コントローラー';
        if (typeof toast === 'function') toast({ w: 'コントローラー接続', t: `${label || 'PAD'} が使えます` });
      }
    }
    for (const key of [...connectedPads.keys()]) {
      if (!aliveIds.has(key)) {
        connectedPads.delete(key);
        prevBtn.delete(key);
        if (!connectedPads.size) {
          clearFocus();
          if (typeof toast === 'function') toast({ w: 'コントローラー切断', t: 'コントローラーが切断されました' });
        }
      }
    }
  }

  function pollOne(gp, now) {
    const key = `${gp.index}:${gp.id || 'pad'}`;
    const prev = prevBtn.get(key) || [];
    const btns = gp.buttons || [];
    const pressed = (i) => !!(btns[i] && (btns[i].pressed || btns[i].value > 0.5));
    const justPressed = (i) => pressed(i) && !prev[i];

    // 方向キー / 左スティック
    const ax0 = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
    const ax1 = gp.axes && gp.axes.length > 1 ? gp.axes[1] : 0;
    let dir = '';
    if (pressed(12) || ax1 < -0.45) dir = 'ArrowUp';
    else if (pressed(13) || ax1 > 0.45) dir = 'ArrowDown';
    else if (pressed(14) || ax0 < -0.45) dir = 'ArrowLeft';
    else if (pressed(15) || ax0 > 0.45) dir = 'ArrowRight';

    if (dir) {
      if (repeatState.dir !== dir || now >= repeatState.nextAt) {
        const initial = repeatState.dir !== dir;
        repeatState.dir = dir;
        repeatState.nextAt = now + (initial ? 310 : 110);
        if (!directActionScreen(dir, -1)) moveFocus(dir);
      }
    } else if (repeatState.dir) {
      repeatState.dir = '';
      repeatState.nextAt = 0;
    }

    // 右スティックでスクロール
    const rx = gp.axes && gp.axes.length > 2 ? gp.axes[2] : 0;
    const ry = gp.axes && gp.axes.length > 3 ? gp.axes[3] : 0;
    if (Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25) {
      const box = (curFocus && curFocus.closest('.main, .setupbody, .mbody, .lifemap, #boardwrap, .log')) ||
        document.querySelector('.mbody, .setupbody, .main, .lifemap');
      if (box) box.scrollBy(Math.abs(rx) > 0.25 ? rx * 14 : 0, Math.abs(ry) > 0.25 ? ry * 14 : 0);
    }

    // ボタンエッジ検出
    if (justPressed(0)) {
      if (!directActionScreen('', 0)) triggerClick(ensureFocus());
    }
    if (justPressed(1)) handleCancel();
    if (justPressed(2)) {
      if (!directActionScreen('', 2)) triggerSecondary(ensureFocus());
    }
    if (justPressed(3)) {
      if (!directActionScreen('', 3)) triggerUndoOrThird();
    }
    if (justPressed(4)) handleBumper(-1);
    if (justPressed(5)) handleBumper(1);
    if (justPressed(9)) handleStart();

    prevBtn.set(key, btns.map((b) => !!(b && (b.pressed || b.value > 0.5))));
  }

  function step(now) {
    rafId = null;
    const raw = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pads = raw ? [...raw].filter((p) => p && p.connected) : [];
    syncConnectedPads(pads);
    if (!pads.length) return;
    if (typeof ensureGuardOnGesture === 'function') ensureGuardOnGesture();
    for (const gp of pads) pollOne(gp, now);
    rafId = requestAnimationFrame(step);
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  window.addEventListener('gamepadconnected', () => startLoop());
  window.addEventListener('gamepaddisconnected', () => startLoop());
  document.addEventListener('pointerdown', () => clearFocus(true), { capture: true, passive: true });

  // テスト用モックや初回入力前に接続済みパッドがある場合にも反応できるように監視
  setInterval(() => {
    const raw = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null;
    if (!raw) return;
    const any = [...raw].some((p) => p && p.connected);
    if (any || connectedPads.size) startLoop();
  }, 250);
})();
