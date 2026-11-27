/* PC向けゲームパッド(PAD)操作対応
   - 十字キー(共通の「カーソル移動」割り当て): 選択枠(.gp-focus)を要素間で動かす
   - 左スティック: 専用カーソル(自分の席色+名前タグ)を動かし、決定でその位置をクリックする
   - ボタンの割り当ては js/padconfig.js の PADCFG を参照する(共通/ゲーム別)
   - キーボード割り当ての実効のために PADACT を公開する(padconfig.js から使う) */
'use strict';
(() => {
  const INTERACT_SEL = [
    'button:not([disabled]):not([tabindex="-1"]):not(.mback):not(.cutin):not(.toast)',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[role="switch"]:not([disabled])',
    '[data-pc-row]',
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
    '#boardwrap [data-qpawn]',
    '#boardwrap [data-qdhit]',
    '[data-wolf-target]',
    '[data-wolf-stamp]',
  ].join(',');

  const connectedPads = new Map();
  const prevBtn = new Map();
  const repeatState = { dir: '', nextAt: 0 };
  const fallRep = new Map();
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
    // まず「その方向の帯の中(直交軸で重なる要素)」だけから一番近いものを探し、
    // 無い時だけ方向のコーン(横ずれが縦距離の1.5倍+24px以内)にあるものを探す。
    // (app.js の navMove と同じ方式。グリッドの上移動で横のサイドバーへ飛ばないように)
    const horiz = vec[0] !== 0;
    let band = null, bandMain = Infinity, bandSide = Infinity, cone = null, coneScore = Infinity;
    for (const cand of all) {
      if (cand === curFocus) continue;
      const r = anchorRect(cand);
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      const main = dx * vec[0] + dy * vec[1];
      if (main <= 4) continue;
      const side = Math.abs(dx * vec[1] + dy * vec[0]);
      const overlap = horiz ? (Math.max(a.top, r.top) <= Math.min(a.bottom, r.bottom) + 6) : (Math.max(a.left, r.left) <= Math.min(a.right, r.right) + 6);
      if (overlap) {
        if (main < bandMain || (main === bandMain && side < bandSide)) { band = cand; bandMain = main; bandSide = side; }
      } else if (side <= main * 1.5 + 24) {
        const sc = main + side * 2.1;
        if (sc < coneScore) { coneScore = sc; cone = cand; }
      }
    }
    const best = band || cone;
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

  function handleBumper(delta) {
    const scope = getScope();
    const cats = [...scope.querySelectorAll('.setcats button:not([disabled])')];
    if (cats.length > 1) {
      const idx = Math.max(0, cats.findIndex((b) => b.getAttribute('aria-current') === 'true'));
      triggerClick(cats[(idx + delta + cats.length) % cats.length]);
      return;
    }
    const tabs = [...scope.querySelectorAll('.rail .tabs button:not([disabled])')];
    if (tabs.length > 1) {
      const idx = Math.max(0, tabs.findIndex((b) => b.getAttribute('aria-current') === 'page'));
      triggerClick(tabs[(idx + delta + tabs.length) % tabs.length]);
      return;
    }
    const areas = [scope.querySelector('#boardwrap [data-src], #boardwrap [data-i], #boardwrap [data-sq], #boardwrap [data-card], #boardwrap [data-k], #boardwrap [data-die], #boardwrap [data-pit], #boardwrap [data-col]'),
      scope.querySelector('#acts button:not([disabled]):not(.waiting)'),
      scope.querySelector('.side .ops button:not([disabled])')].filter((x) => x && !dead(x));
    if (areas.length) {
      const curArea = curFocus && curFocus.closest('#boardwrap') ? 0 : curFocus && curFocus.closest('#acts') ? 1 : 2;
      setFocus(areas[(curArea + delta + areas.length) % areas.length]);
    }
  }

  function handleCancel() {
    if (typeof ddOpen !== 'undefined' && ddOpen && typeof ddClose === 'function') return ddClose(true);
    if (typeof sel !== 'undefined' && sel != null && S.screen === 'play' && !$('#sheetwrap') && !$('.modal')) {
      sel = null;
      if (typeof drawPlay === 'function') drawPlay(true);
      return;
    }
    if (typeof goBack === 'function') goBack();
  }

  /* ---------- スティックカーソル(自分の席色+「あなた」タグ。スティック操作中だけ表示) ---------- */
  const cur = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2), shown: false, lastMove: 0, lastNow: 0, el: null, sig: '' };
  function cursorIdentity() {
    let color = '#C8463C', name = 'あなた';
    try {
      if (typeof meName === 'function') name = meName() || 'あなた';
      if (typeof boardMatch !== 'undefined' && boardMatch.state && typeof boardMatch.myId === 'function') {
        const idx = boardMatch.state.seats.findIndex((s) => s.id === boardMatch.myId());
        if (idx >= 0 && typeof SEAT_COLORS !== 'undefined') color = SEAT_COLORS[idx % SEAT_COLORS.length];
      } else if (typeof S !== 'undefined' && S.screen === 'play' && typeof view !== 'undefined' && view && view.mine >= 0 && typeof SEAT_COLORS !== 'undefined') {
        color = SEAT_COLORS[view.mine % SEAT_COLORS.length];
      }
    } catch (e) {}
    return { color, name };
  }
  function ensureCursorEl() {
    if (cur.el && cur.el.isConnected) return cur.el;
    const el = document.createElement('div');
    el.id = 'padcursor';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    cur.el = el;
    return el;
  }
  function showCursor() {
    const el = ensureCursorEl();
    const { color, name } = cursorIdentity();
    const sig = color + '|' + name;
    if (sig !== cur.sig) {
      cur.sig = sig;
      el.className = 'rcur turn';
      el.style.setProperty('--cc', color);
      el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 3l15 8.500-6.500 1.800L9.500 20z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="tag"><i>${esc(name[0] || 'あ')}</i>${esc(name)}</span>`;
    }
    el.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
    el.classList.add('on');
    cur.shown = true;
  }
  function hideCursor() {
    if (cur.el) cur.el.classList.remove('on');
    cur.shown = false;
  }
  function cursorStick(gp, cfgGame) {
    let stick = 'lstick';
    if (cfgGame && typeof PADCFG !== 'undefined' && PADCFG.cfg.pad[cfgGame] && PADCFG.cfg.pad[cfgGame].cursor) stick = PADCFG.cfg.pad[cfgGame].cursor;
    const base = stick === 'rstick' ? 2 : 0;
    const ax = gp.axes && gp.axes.length > base ? gp.axes[base] : 0;
    const ay = gp.axes && gp.axes.length > base + 1 ? gp.axes[base + 1] : 0;
    return [ax || 0, ay || 0];
  }
  function updateStickCursor(gp, now, cfgGame, modalOpen) {
    if (modalOpen) { if (cur.shown) hideCursor(); cur.lastNow = now; return; }
    const [sx, sy] = cursorStick(gp, cfgGame);
    const mag = Math.hypot(sx, sy);
    const dt = Math.min(64, Math.max(1, now - (cur.lastNow || now)));
    cur.lastNow = now;
    if (mag > 0.22) {
      const v = 980 * Math.min(1, mag);
      cur.x = Math.max(0, Math.min(window.innerWidth - 1, cur.x + sx * v * dt / 1000));
      cur.y = Math.max(0, Math.min(window.innerHeight - 1, cur.y + sy * v * dt / 1000));
      cur.lastMove = now;
      showCursor();
    } else if (cur.shown && now - cur.lastMove > 2200) {
      hideCursor();
    }
  }
  function clickAtCursor() {
    if (!cur.shown) return false;
    const el = document.elementFromPoint(cur.x, cur.y);
    if (cur.el) { cur.el.classList.remove('click'); void cur.el.offsetWidth; cur.el.classList.add('click'); }
    if (el && el !== cur.el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cur.x, clientY: cur.y }));
    }
    return true;
  }

  /* ---------- アクションの実効(パッド/キーボード共通) ---------- */
  const PLAY_SCREENS = ['play', 'extraPlay', 'bunyoPlay', 'pakurisPlay', 'minePlay', 'slidePlay', 'wolfPlay'];
  function currentCfgGame() {
    return (typeof PADCFG !== 'undefined') ? PADCFG.mapGame(PADCFG.currentGame()) : null;
  }
  function fallingGame() {
    if (S.screen === 'pakurisPlay' || (S.screen === 'extraPlay' && typeof boardMatch !== 'undefined' && boardMatch.state?.game === 'pakuris')) return 'pakuris';
    if (S.screen === 'bunyoPlay' || (S.screen === 'extraPlay' && typeof boardMatch !== 'undefined' && boardMatch.state?.game === 'bunyo')) return 'bunyo';
    return null;
  }
  function clickActButton(label) {
    const b = [...document.querySelectorAll('#acts button')].find((x) => !x.disabled && !x.classList.contains('waiting') && x.textContent.includes(label));
    if (b) { b.click(); return true; }
    return false;
  }
  function mySeatIdx() {
    try {
      if (typeof boardMatch !== 'undefined' && boardMatch.state && typeof boardMatch.myId === 'function') {
        return boardMatch.state.seats.findIndex((s) => s.id === boardMatch.myId());
      }
    } catch (e) {}
    return -1;
  }
  function mineCellTarget() {
    if (cur.shown) {
      const el = document.elementFromPoint(cur.x, cur.y);
      const c = el && el.closest ? el.closest('[data-mine-cell], [data-extra-mine]') : null;
      if (c) return c;
    }
    const f = curFocus || document.activeElement;
    return f && f.closest ? f.closest('[data-mine-cell], [data-extra-mine]') : null;
  }
  function dispatchOn(el, type) {
    if (el) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }

  function commonAction(a) {
    if (a === 'ok') { if (!clickAtCursor()) triggerClick(ensureFocus()); return; }
    if (a === 'cancel') { handleCancel(); return; }
    if (a === 'up') return moveFocus('ArrowUp');
    if (a === 'down') return moveFocus('ArrowDown');
    if (a === 'left') return moveFocus('ArrowLeft');
    if (a === 'right') return moveFocus('ArrowRight');
    if (a === 'tabPrev') return handleBumper(-1);
    if (a === 'tabNext') return handleBumper(1);
    if (a === 'settings') {
      if ($('#sheetwrap')) { closeSheet(); return; }
      const scope = getScope();
      const playSet = scope.querySelector('[data-playsettings], [data-slide-settings], [data-bunyo-settings], [data-pakuris-settings], [data-mine-settings]');
      if (playSet && !$('.modal')) { triggerClick(playSet); return; }
      if (S.screen === 'settings') { go('menu'); return; }
      go('settings');
      return;
    }
    if (a === 'chat') {
      const fab = document.querySelector('[data-chatfab]');
      if (fab) { triggerClick(fab); return; }
      const inp = document.querySelector('#chatin');
      if (inp) { inp.focus(); return; }
      if (typeof togglePlayChat === 'function') togglePlayChat();
    }
  }

  function gameAction(g, a) {
    if (a === 'ok') return commonAction('ok');
    if (a === 'cancel') return commonAction('cancel');
    if (a === 'cursor') return;
    if (g === 'pakuris' || g === 'bunyo') {
      const game = g === 'pakuris' ? (typeof pakurisGame !== 'undefined' ? pakurisGame : null) : (typeof bunyoGame !== 'undefined' ? bunyoGame : null);
      if (!game) return;
      const m = { left: 'left', right: 'right', down: 'down', drop: 'drop', rotR: 'rotate', rotL: 'rotateL', hold: 'hold' }[a];
      if (m) game.action(m);
      return;
    }
    if (g === 'battleship') {
      if (a === 'place') clickActButton('ここに置く');
      else if (a === 'rotate') clickActButton('向きを変える');
      else if (a === 'fire') clickActButton('発射');
      return;
    }
    if (g === 'quoridor') {
      const idx = mySeatIdx();
      const pawn = idx >= 0 ? document.querySelector(`#boardwrap [data-qpawn="${idx}"]`) : null;
      if (a === 'move') { dispatchOn(pawn, 'click'); return; }
      if (a === 'wallmode') {
        const canWall = [...document.querySelectorAll('#acts button')].some((x) => !x.disabled && x.textContent.includes('壁を置く'));
        if (canWall) dispatchOn(pawn, 'click');
        else dispatchOn(document.querySelector('#boardwrap [data-qdhit]'), 'click');
        return;
      }
      if (a === 'placewall') clickActButton('壁を置く');
      else if (a === 'rotatewall') clickActButton('向きを変える');
      return;
    }
    if (g === 'blokus') {
      if (a === 'place') commonAction('ok');
      else if (a === 'rotate') clickActButton('向きを変える');
      else if (a === 'flip') { if (typeof window.__bkPadFlip === 'function') window.__bkPadFlip(); }
      else if (a === 'pass') clickActButton('パス');
      return;
    }
    if (g === 'mine') {
      const cell = mineCellTarget();
      if (!cell) return;
      if (a === 'open' || a === 'chord') dispatchOn(cell, 'click');
      else if (a === 'flag') dispatchOn(cell, 'contextmenu');
    }
  }

  window.PADACT = { commonAction, gameAction };

  function dispatchButton(btn) {
    const cfgGame = currentCfgGame();
    if (cfgGame && PLAY_SCREENS.includes(S.screen)) {
      const act = PADCFG.actionFor(cfgGame, btn);
      if (act && act !== 'cursor') { gameAction(cfgGame, act); return; }
    }
    const act = (typeof PADCFG !== 'undefined') ? PADCFG.actionFor('common', btn) : null;
    // 方向(選択枠移動)は focusRepeat が担当するので、エッジ側では二重に動かさない
    if (act && act !== 'up' && act !== 'down' && act !== 'left' && act !== 'right') commonAction(act);
  }

  /* キーコンフィグ画面を開いている時のボタン(タブ切替・決定・キャンセルだけを受け付ける) */
  function modalButton(btn) {
    const act = PADCFG.actionFor('common', btn);
    if (!act) return;
    if (act === 'ok') triggerClick(ensureFocus());
    else if (act === 'cancel') PADCFG.close();
    else if (act === 'tabPrev') { PADCFG.tab = 'common'; PADCFG.waiting = null; PADCFG.refresh(); }
    else if (act === 'tabNext') { PADCFG.tab = 'game'; PADCFG.waiting = null; PADCFG.refresh(); }
    else if (act === 'settings') PADCFG.close();
  }

  /* 方向の連続入力(選択枠移動)。now は rAF の時刻 */
  function focusRepeat(dirKey, now) {
    if (!dirKey) { repeatState.dir = ''; repeatState.nextAt = 0; return; }
    if (repeatState.dir !== dirKey || now >= repeatState.nextAt) {
      const initial = repeatState.dir !== dirKey;
      repeatState.dir = dirKey;
      repeatState.nextAt = now + (initial ? 310 : 110);
      if (S.screen === 'slidePlay' && typeof slideGame !== 'undefined' && slideGame.key(dirKey)) return;
      moveFocus(dirKey);
    }
  }

  /* 落ちもの系(パクリス/ぶにょぶにょ): 割り当てられたボタンを押しっぱなしでも動くようにする
     十字キーはエッジ処理から外してあるので初回分もここで出し、それ以外のボタンは
     エッジ処理が初回分を出すので、ここでは長押しリピート分だけを足す */
  const FALL_REPEAT = { left: 1, right: 1, down: 1 };
  function fallingHeld(gp, pressed, now, cfgGame) {
    const game = cfgGame === 'pakuris' ? pakurisGame : bunyoGame;
    for (let i = 0; i < 16; i++) {
      const btn = PAD_ID_BY_INDEX[i];
      const st = fallRep.get(btn);
      if (!pressed[i]) { if (st) fallRep.delete(btn); continue; }
      const act = PADCFG.actionFor(cfgGame, btn);
      const m = act ? { left: 'left', right: 'right', down: 'down', drop: 'drop', rotR: 'rotate', rotL: 'rotateL', hold: 'hold' }[act] : null;
      if (!m) { fallRep.delete(btn); continue; }
      const isDpad = i >= 12 && i <= 15;
      if (!st) {
        fallRep.set(btn, { nextAt: now + 300 });
        if (isDpad) game.action(m);
      } else if (FALL_REPEAT[act] && now >= st.nextAt) {
        st.nextAt = now + 105;
        game.action(m);
      }
    }
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
      if (typeof PADCFG !== 'undefined') PADCFG.notePad(gp);
    }
    for (const key of [...connectedPads.keys()]) {
      if (!aliveIds.has(key)) {
        connectedPads.delete(key);
        prevBtn.delete(key);
        if (!connectedPads.size) {
          clearFocus();
          hideCursor();
          if (typeof toast === 'function') toast({ w: 'コントローラー切断', t: 'コントローラーが切断されました' });
        }
      }
    }
  }

  function pollOne(gp, now) {
    const key = `${gp.index}:${gp.id || 'pad'}`;
    const prev = prevBtn.get(key) || [];
    const btns = gp.buttons || [];
    const pressedArr = btns.map((b) => !!(b && (b.pressed || b.value > 0.5)));
    const pressed = (i) => !!pressedArr[i];
    const justPressed = (i) => pressedArr[i] && !prev[i];

    const modalOpen = (typeof PADCFG !== 'undefined') && PADCFG.isOpen();
    const capturing = modalOpen && PADCFG.isCapturing();
    const cfgGame = currentCfgGame();
    const fg = (!modalOpen && PLAY_SCREENS.includes(S.screen)) ? fallingGame() : null;

    updateStickCursor(gp, now, cfgGame, modalOpen);

    // 方向入力
    if (capturing) {
      repeatState.dir = ''; repeatState.nextAt = 0;
    } else if (fg) {
      fallingHeld(gp, pressedArr, now, fg);
    } else if (modalOpen) {
      let dir = '';
      if (pressed(12)) dir = 'ArrowUp';
      else if (pressed(13)) dir = 'ArrowDown';
      else if (pressed(14)) dir = 'ArrowLeft';
      else if (pressed(15)) dir = 'ArrowRight';
      focusRepeat(dir, now);
    } else {
      let dir = '';
      if (typeof PADCFG !== 'undefined') {
        for (const [act, dk] of [['up', 'ArrowUp'], ['down', 'ArrowDown'], ['left', 'ArrowLeft'], ['right', 'ArrowRight']]) {
          const b = PADCFG.bind('common', act);
          if (b && pressed(PAD_INDEX[b])) { dir = dk; break; }
        }
      }
      focusRepeat(dir, now);
    }

    // 右スティックでスクロール
    const rx = gp.axes && gp.axes.length > 2 ? gp.axes[2] : 0;
    const ry = gp.axes && gp.axes.length > 3 ? gp.axes[3] : 0;
    if (Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25) {
      const box = (curFocus && curFocus.closest('.main, .setupbody, .mbody, .lifemap, #boardwrap, .log')) ||
        document.querySelector('.mbody, .setupbody, .main, .lifemap');
      if (box) box.scrollBy(Math.abs(rx) > 0.25 ? rx * 14 : 0, Math.abs(ry) > 0.25 ? ry * 14 : 0);
    }

    // ボタンエッジ
    for (let i = 0; i < 16; i++) {
      if (!justPressed(i)) continue;
      if (capturing) continue;                    // 割り当て待ちは padconfig 側が受け取る
      const btn = PAD_ID_BY_INDEX[i];
      if (modalOpen) { modalButton(btn); continue; }
      if (fg && i >= 12 && i <= 15) continue;      // 落ちもの中は十字キーを fallingHeld が処理する
      dispatchButton(btn);
    }

    prevBtn.set(key, pressedArr);
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
  document.addEventListener('pointerdown', () => { clearFocus(true); hideCursor(); }, { capture: true, passive: true });

  setInterval(() => {
    const raw = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null;
    if (!raw) return;
    const any = [...raw].some((p) => p && p.connected);
    if (any || connectedPads.size) startLoop();
  }, 250);
})();
