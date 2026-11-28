/* 日本アソビ大辞典30 PC版 の画面と対局の進め方。
 * 画面の形は見本(docs/ui-sample-pc.html)のまま。規則・CPU・通信は Android 版と同じ Kotlin のコード(core/*.mjs)を使う。 */
'use strict';

// ---------------------------------------------------------------- 規則と CPU(別スレッド)
// 別スレッドが使えない所(見本のページなど)では、画面と同じスレッドで動かす
let worker = null, noWorker = false;
let wseq = 1; const wpend = new Map(); let wReady; const wReadyP = new Promise((r) => (wReady = r));
const workerFail = () => { if (noWorker) return; noWorker = true; wReady(); for (const [id, p] of wpend) { wpend.delete(id); coreReady.then(() => { const t0 = performance.now(); try { p.resolve({ r: mainCore[p.fn](...p.args), ms: performance.now() - t0 }); } catch (e) { p.reject(e); } }); } };
try {
  worker = new Worker('worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    if (e.data.ready) return wReady();
    const p = wpend.get(e.data.id); if (!p) return; wpend.delete(e.data.id);
    e.data.error ? p.reject(new Error(e.data.error)) : p.resolve({ r: e.data.r, ms: e.data.ms });
  };
  worker.onerror = workerFail;
  let wOk = false; wReadyP.then(() => (wOk = true)); setTimeout(() => { if (!wOk) workerFail(); }, 6000);
} catch (e) { setTimeout(workerFail, 0); }
const callT = async (fn, ...args) => {
  await wReadyP;
  if (noWorker) { await coreReady; const t0 = performance.now(); return { r: mainCore[fn](...args), ms: performance.now() - t0 }; }
  return new Promise((resolve, reject) => { const id = wseq++; wpend.set(id, { resolve, reject, fn, args }); worker.postMessage({ id, fn, args }); });
};
const callW = async (fn, ...args) => (await callT(fn, ...args)).r;
let mainCore = null; // 通信対戦の部屋は画面と同じスレッドで動かす
const coreReady = import('../core/asobi-pc-core.mjs').then((m) => (mainCore = m));
let online = false;
const ONLINE_FNS = new Set(['viewJson', 'matchRecord', 'isConcurrent', 'cpuSeats', 'cpuChooseSeat']);
const call = async (fn, ...args) => (online && ONLINE_FNS.has(fn) ? mainCore[fn](...args) : callW(fn, ...args));
const sfx = (() => { try { return createSfx(call); } catch (e) { return { init: async () => {}, play() {}, enabled: true }; } })();

// ---------------------------------------------------------------- ゲームの一覧
const ORDER = ['shogi', 'gogo', 'reversi', 'connect4', 'gomoku', 'hex', 'mancala', 'morris', 'checkers', 'chess', 'dots', 'hitblow', 'hare', 'chinese', 'ludo', 'backgammon', 'go', 'yacht', 'mahjong', 'life',
  'hanafuda', 'sevens', 'memory', 'speed', 'poker', 'holdem', 'blackjack', 'daifugo', 'uno', 'solitaire', 'slide', 'bunyo', 'pakuris', 'mine', 'bozu', 'wolf', 'roulette',
  'war', 'takoyaki', 'butanoshippo', 'oldmaid', 'hearts', 'ginrummy', 'vulture',
  'goita', 'quarto', 'geister', 'rummikub', 'pegsolitaire', 'munage',
  'coyote', 'skull', 'liarsdice', 'incangold', 'take6', 'blokus', 'quoridor', 'battleship', 'chinchiro'];
const APP_NAME = `あそび箱${ORDER.length}`;
const ART_ID = { gogo: 'minishogi' };
const BREAK = { morris: 'ナインメンズ<wbr>モリス', chinese: 'チャイニーズ<wbr>チェッカー', dots: 'ドット＆<wbr>ボックス', holdem: 'テキサス<wbr>ポーカー', yacht: 'ヨット', blackjack: 'ブラック<wbr>ジャック', backgammon: 'バック<wbr>ギャモン', hitblow: 'ヒット＆<wbr>ブロー', life: '人生<wbr>すごろく' };
let CAT = [];
const gInfo = (id) => CAT.find((g) => g.id === id);
const artOf = (id) => art(ART_ID[id] || id) || '';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dispName = (g) => BREAK[g.id] || esc(g.name);
const range = (p) => { const m = String(p).match(/\d+/g).map(Number); return [m[0], m[m.length - 1]]; };
const PLAYABLE = new Set(ORDER);
const newGameSetup = {
  slide:on=>slideGame.setup(on), bunyo:on=>bunyoGame.setup(on), pakuris:on=>pakurisGame.setup(on),
  mine:on=>minesGame.setup(on), wolf:on=>wolfGame.setup(on),
  bozu:on=>poetCards.setup('bozu',on), munage:on=>munageGame.setup('munage',on)
};
const playable = (id) => Object.hasOwn(newGameSetup,id) || (PLAYABLE.has(id) && (window.RENDER[id] || window.RENDER[KIND_OF[id] || id] || (gInfo(id)?.category !== 'BOARD' && window.RENDER.cards)));
const KIND_OF = { gogo: 'shogi', connect4: 'c4', chinese: 'chinese' };
const LV = ['初級', '中級', '上級'];
const lvIndex = (t) => Math.max(0, LV.indexOf(t));

const app = $('#app');
const meName = () => S.set.name || 'あなた';
const isMob = () => window.innerWidth <= 680 || (window.innerWidth <= 960 && window.innerHeight <= 540);
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPad|Android|Tablet|PlayBook|Silk/i.test(ua)) return true;
  if (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
};

// ---------------------------------------------------------------- 共通の部品
const seg = (key, opts, val, cls = '') => `<div class="seg ${cls}" data-seg="${key}">${opts.map((o) => { const [v, l, disabled] = Array.isArray(o) ? o : [o, o]; return `<button data-v="${esc(v)}" aria-pressed="${String(v) === String(val)}" ${disabled ? 'disabled' : ''}>${esc(l)}</button>`; }).join('')}</div>`;
const sw = (key, on) => `<button class="switch" role="switch" aria-checked="${!!on}" data-sw="${key}" aria-label="${esc(key)}"></button>`;
const QUIT_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>';
function rail(cur) {
  const t = [['menu', 'games', 'ゲーム'], ['room', 'room', 'みんなで遊ぶ'], ['records', 'rec', '成績'], ['settings', 'set', '設定']];
  const onMenu = cur === 'menu';
  const showQuit = !isMob() && !isTouchDevice();
  return `<nav class="rail">
    <div class="brand"><strong>あそび箱 <i>${ORDER.length}</i></strong></div>
    <div class="tabs">${t.map(([s, i, n]) => `<button data-go="${s}" ${cur === s ? 'aria-current="page"' : ''}>${ic(i)}${n}</button>`).join('')}</div>
    <div class="rail-filter${onMenu ? '' : ' is-hidden'}"${onMenu ? '' : ' aria-hidden="true" inert'}><h4>人数</h4>${seg('filter', ['すべて', '1人', '2人', '3人以上'], S.filter, 'col')}</div>
    ${roomSummary()}
    ${showQuit ? `<button class="quitbtn" data-quitapp>${QUIT_IC}終了する</button>` : ''}
    <button class="me" data-goprof aria-label="プロフィールの設定">${meAv()}<b>${esc(meName())}</b></button>
  </nav>`;
}
function fits(p) {
  if (S.filter === 'すべて') return true;
  const [lo, hi] = range(p);
  return S.filter === '1人' ? lo === 1 : S.filter === '2人' ? lo <= 2 && hi >= 2 : hi >= 3;
}
function go(screen) {
  const m = $('.main'); if (m) (S.scrollMem = S.scrollMem || {})[S.screen] = m.scrollTop;
  if (S.screen === 'play' && screen !== 'play') leavePlay();
  if (S.screen === 'slidePlay' && screen !== 'slidePlay') slideGame.stop();
  if (S.screen === 'minePlay' && screen !== 'minePlay') minesGame.stop();
  if (S.screen === 'extraPlay' && screen !== 'extraPlay') { if (!boardMatch.active()) boardMatch.reset(); }
  if (S.screen === 'wolfPlay' && screen !== 'wolfPlay') wolfGame.stop();
  if ((S.screen === 'bunyoPlay' || S.screen === 'pakurisPlay') && screen !== S.screen) fallingMatch.leave();
  S.screen = screen; S.stOpen = false; S.modal = null; S.mobDetail = false; S.chatOpen = false; S.chatUnread = 0; ddOpen = null;
  bgCtx(); render();
}
function bgmGenreFor() {
  if (['slidePlay','bunyoPlay','pakurisPlay','minePlay','wolfPlay','extraPlay'].includes(S.screen)) return 'yo';
  if (S.screen === 'play' && cur) return gameGenre(ART_ID[cur.id] || cur.id);
  return { first: 'mn', menu: 'mn', setup: 'mn', settings: 'mn', room: 'mn', records: 'mn' }[S.screen];
}

// ---------------------------------------------------------------- メニュー
const savedList = () => store.get('saved', []).filter((s) => s.moves > 0 && gInfo(s.id)).slice(0, 3);
function menuMainHtml() {
  const tiles = (c) => ORDER.map((id) => gInfo(id)).filter((g) => g && (g.category === 'BOARD') === (c === 'b') && fits(g.players))
    .map((g) => `<button class="tile ${playable(g.id) ? '' : 'soon'}" data-tile="${g.id}" aria-pressed="${S.sel === g.id}"><span class="art">${artOf(g.id)}</span>${gameWishes(g.id)}<span class="cap"><b>${dispName(g)}</b><small>${esc(g.players)}${playable(g.id) ? '' : '・準備中'}</small></span></button>`).join('');
  const nb = ORDER.filter((id) => gInfo(id) && gInfo(id).category === 'BOARD' && fits(gInfo(id).players)).length;
  const nc = ORDER.filter((id) => gInfo(id) && gInfo(id).category !== 'BOARD' && fits(gInfo(id).players)).length;
  const sv = roomActive() ? [] : savedList();
  const cont = sv.length ? `<div class="conts"><h3>続きから</h3>${sv.map((s, k) => `<button class="resume" data-resume="${k}"><span class="th">${artOf(s.id)}</span><b>${esc(gInfo(s.id).name)}</b><span class="mv">${s.moves}手目</span><span class="go">${ic('play')}</span></button>`).join('')}</div>` : '';
  const roomBar = roomActive() ? `<div class="mob-roombar"><button type="button" class="btn gold" data-detailopen>${S.sel && gInfo(S.sel) ? `${esc(gInfo(S.sel).name)}・` : ''}ルーム詳細・チャットを開く</button></div>` : '';
  return `${roomBar}${cont}
    ${nb ? `<h3 class="shelfhead">ボードゲーム <i>${nb}</i></h3><div class="shelf">${tiles('b')}</div>` : ''}
    ${nc ? `<h3 class="shelfhead">カードゲーム <i>${nc}</i></h3><div class="shelf">${tiles('c')}</div>` : ''}`;
}
function menu() {
  const backdrop = S.mobDetail ? `<button type="button" class="detail-backdrop" data-detailclose aria-label="詳細を閉じる"></button>` : '';
  return `<div class="screen">${rail('menu')}
   <div class="main">${menuMainHtml()}</div>${backdrop}${detail()}</div>`;
}
function switchPlayerFilter(v) {
  if (S.filter === v) return;
  S.filter = v;
  const main = $('.main');
  if (S.screen !== 'menu' || !main || S.set.reduce || typeof main.animate !== 'function') {
    S.filterChanged = true;
    return render();
  }
  S.filterChanged = false;
  document.querySelectorAll('.rail-filter [data-seg="filter"] button').forEach((btn) => {
    const active = btn.dataset.v === v;
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.remove('filter-pop');
    if (active) { void btn.offsetWidth; btn.classList.add('filter-pop'); }
  });
  main.querySelectorAll('.tile-ghost-out').forEach((g) => g.remove());
  const before = new Map();
  main.querySelectorAll('[data-tile]').forEach((el) => {
    before.set(el.dataset.tile, { rect: el.getBoundingClientRect(), clone: el.cloneNode(true) });
  });
  main.classList.remove('filter-enter', 'filter-anim');
  main.innerHTML = menuMainHtml();
  main.scrollTop = 0;
  void main.offsetWidth;
  main.classList.add('filter-enter', 'filter-anim');

  const afterIds = new Set([...main.querySelectorAll('[data-tile]')].map((el) => el.dataset.tile));
  const afterMainRect = main.getBoundingClientRect();
  const sTop = main.scrollTop, sLeft = main.scrollLeft;

  for (const [id, info] of before) {
    if (afterIds.has(id)) continue;
    const g = info.clone;
    g.classList.add('tile-ghost-out');
    g.removeAttribute('data-tile');
    g.tabIndex = -1;
    g.disabled = true;
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, {
      left: `${info.rect.left - afterMainRect.left + sLeft}px`,
      top: `${info.rect.top - afterMainRect.top + sTop}px`,
      width: `${info.rect.width}px`,
      height: `${info.rect.height}px`,
    });
    main.appendChild(g);
    const anim = g.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(.78) translateY(8px)' }
    ], { duration: 190, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    const clean = () => { if (g.isConnected) g.remove(); };
    anim.onfinish = clean;
    setTimeout(clean, 240);
  }

  let enterIdx = 0;
  main.querySelectorAll('[data-tile]').forEach((el) => {
    const prev = before.get(el.dataset.tile);
    if (prev) {
      const r = el.getBoundingClientRect();
      const dx = prev.rect.left - r.left, dy = prev.rect.top - r.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.animate([
          { transform: `translate(${dx}px,${dy}px)` },
          { transform: 'none' }
        ], { duration: 320, easing: 'cubic-bezier(.22,.85,.32,1)' });
      }
    } else {
      const delay = Math.min(enterIdx++, 18) * 16;
      el.animate([
        { opacity: 0, transform: 'translateY(14px) scale(.88)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 280, delay, easing: 'cubic-bezier(.22,.85,.32,1)', fill: 'backwards' });
    }
  });

  main.querySelectorAll('.shelfhead, .conts').forEach((hd, i) => {
    hd.animate([
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 240, delay: i * 35, easing: 'cubic-bezier(.22,.85,.32,1)', fill: 'backwards' });
  });
}
function detail() {
  if (roomActive()) return onlineMenuDetail();
  const g = S.sel && gInfo(S.sel==='mineVersus'?'mine':S.sel);
  const mobHd = `<div class="detail-mobhd"><span class="detail-handle" aria-hidden="true"></span><button type="button" class="btn" data-detailclose aria-label="閉じる">✕ 閉じる</button></div>`;
  const openCls = S.mobDetail ? ' open' : '';
  if (!g) return `<aside class="detail${openCls}">${mobHd}<div class="empty">ゲームを選んでください</div></aside>`;
  if (Object.hasOwn(newGameSetup,g.id)) return `<aside class="detail${openCls}">${mobHd}<div class="scroll"><div class="hero"><span class="art">${artOf(g.id)}</span><div><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p><span class="tag">${esc(g.players)}</span></div></div></div>
    <div class="foot">${ruleButton(g.id)}${padButton(g.id)}<button class="btn primary" data-next>進む</button></div></aside>`;
  const c = cfg(g.id);
  const ok = playable(g.id);
  return `<aside class="detail${openCls}">${mobHd}<div class="scroll">
    <div class="hero"><span class="art">${artOf(g.id)}</span><div><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p><span class="tag">${esc(g.players)}</span><span class="tag">${g.category === 'BOARD' ? 'ボード' : 'カード'}</span></div></div>
    <div class="panel"><h3>前回の設定</h3>
      <div class="row"><span>遊び方</span><b>${c.mode === 'pass' ? '手番ごとに交代' : 'CPUと対戦'}</b></div>
      <div class="row"><span>CPUの強さ</span><b>${LV[c.level]}</b></div>
      <div class="row"><span>1手の制限時間</span><b>${c.limit ? c.limit + '秒' : 'なし'}</b></div></div>
    ${ok ? '' : '<div class="panel"><div class="row"><span>このゲームは準備中です</span></div></div>'}
   </div><div class="foot"><button class="btn" data-rule="${g.id}">${ic('book')}ルール</button>${padButton(g.id)}<button class="btn primary" data-next ${ok ? '' : 'disabled'}>進む</button></div></aside>`;
}

// ---------------------------------------------------------------- ゲームごとの設定(記憶する)
function cfg(id) {
  const all = store.get('cfg', {});
  const g = gInfo(id);
  const c = Object.assign({ mode: 'cpu', level: lvIndex(S.set.cpuLv), seat: 0, limit: 0, tout: 'random', humans: 2, names: ['', '', '', '', '', ''], rotate: false, opts: {} }, all[id] || {});
  if (g) for (const o of g.options) if (c.opts[o.key] == null || !o.values.some(([v]) => v === c.opts[o.key])) c.opts[o.key] = o.default;
  return c;
}
function saveCfg(id, c) { const all = store.get('cfg', {}); all[id] = c; store.set('cfg', all); }
const engineOpts = (g, c, withOnline) => g.options.filter((o) => withOnline || o.group !== 'online').map((o) => `${o.key}=${c.opts[o.key] ?? o.default}`).sort().join(';');
const isBool = (o) => o.values.length === 2 && o.values.every(([v]) => v === 'true' || v === 'false');
const ruleButton = id => `<button class="btn" data-rule="${id}">${ic('book')}ルール</button>`;
const PAD_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 5 5.2c0 2.9-2.3 4.8-4.7 4.3-1.5-.3-2.6-1.3-3.6-2.5H10.3c-1 1.2-2.1 2.2-3.6 2.5C4.3 18 2 16.1 2 13.2A5 5 0 0 1 7 8Z"/><path d="M7.5 11v4M5.5 13h4"/><circle cx="16.4" cy="11.6" r=".4" fill="currentColor"/><circle cx="18.2" cy="13.8" r=".4" fill="currentColor"/></svg>';
const padButton = id => `<button class="btn padentry" data-padsetup="${id}" aria-label="キーコンフィグ（ゲームパッド）" title="キーコンフィグ（ゲームパッド）">${PAD_ICON}</button>`;
const setupRow = (label, control, hint = '') => `<div class="row"><span>${esc(label)}${hint ? `<small class="sub">${esc(hint)}</small>` : ''}</span>${control}</div>`;
const setupPanel = (title, body) => `<section class="panel"><h3>${esc(title)}</h3>${body}</section>`;
function setupLayout(id, label, back, left, right, action) {
  const g = gInfo(id);
  return `<div class="screen col">
    <div class="setuphead"><button class="btn" data-go="${back}" aria-label="戻る">${ic('back')}</button><span class="art">${artOf(id)}</span>
    <div class="txt"><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p></div><span class="tagl">${esc(g.players)}</span><span class="tagl">${esc(label)}</span></div>
    <div class="setupbody"><div class="cols2"><div class="stack">${left}</div><div class="stack">${right}</div></div></div>
    <div class="setupfoot">${ruleButton(id)}${padButton(id)}${action}</div></div>`;
}
function canStartExtraMatch() {
  return isHostRoom() && roomChoosing() && activeMembers().length >= 2;
}
function extraSetupLayout(id, on, left, right, start, options = {}) {
  const label = options.modeLabel ?? (on ? 'みんなで遊ぶ' : roomActive() ? '1人プレイ(待機中)' : 'ひとりで遊ぶ');
  const enabled = options.enabled ?? (!on || canStartExtraMatch());
  const action = `<button class="btn primary" ${start} ${enabled ? '' : 'disabled'}>${esc(options.label ?? 'スタート')}</button>`;
  return setupLayout(id, label, roomActive() ? 'room' : 'menu', left, right, action);
}
function extraParticipants(on) {
  if (!on) return setupPanel('人数と相手', setupRow('対局','<b>1人</b>'));
  const members = activeMembers();
  return setupPanel('人数と相手', setupRow('対局', `<b>${members.length}人</b>`, members.map(p => p.name).join('・')) +
    (members.length < 2 ? '<p class="dimtxt">開始するには対局者が2人以上必要です。</p>' : ''));
}
let seatsCache = {};
function setup() {
  const g = gInfo(S.setup.id), id = g.id, c = cfg(id), on = S.setup.online, soloOn = on && isSoloInRoom();
  const key = id + '|' + engineOpts(g, c);
  const total = seatsCache[key] || range(g.players)[0];
  if (!seatsCache[key]) callW('seatCount', id, engineOpts(g, c)).then((n) => { seatsCache[key] = n; if (S.screen === 'setup') render(); });
  const solo = total === 1;
  const canPass = range(g.players)[1] >= 2 && !['speed', 'solitaire'].includes(id) && !rouletteSolo(id, c);
  const pass = c.mode === 'pass' && canPass;
  const ps = g.options.find((o) => o.key === 'players');
  const rowOpt = (o) => {
    const v = c.opts[o.key] ?? o.default;
    const hint = EXTRA_SETUP_HINTS[id]?.[o.key] || o.hint;
    if (isBool(o)) return setupRow(o.label, sw('o:' + o.key, v === 'true'), hint);
    const short = o.values.length <= 4 && o.values.map((x) => x[1]).join('').length <= 14;
    return short ? setupRow(o.label, seg('o:' + o.key, o.values, v), hint)
      : setupRow(o.label, '', hint) + `<div class="row below">${seg('o:' + o.key, o.values, v, 'wide')}</div>`;
  };
  const time = g.options.filter(o => o.key==='moveSeconds' || o.group==='online');
  // 種類で使わない設定は出さない(ソリティア: クロンダイクはめくる枚数・周回、スパイダーはマークの数)
  const spiderOn = id === 'solitaire' && (c.opts.variant ?? 'klondike') === 'spider';
  const optShown = (o) => id !== 'solitaire' || (['draw', 'passes'].includes(o.key) ? !spiderOn : o.key === 'suits' ? spiderOn : true);
  const rule = g.options.filter((o) => o.key !== 'players' && o.group === 'rule' && optShown(o));
  const local = g.options.filter((o) => o.group === 'local');
  const seatNames = g.seatNames && g.seatNames.length >= 2 ? g.seatNames : ['先手', '後手'];
  let pidx = 0; if (ps) pidx = Math.max(0, ps.values.findIndex(([v]) => v === c.opts.players));
  const actCount = on && !soloOn ? activeMembers().length : 1;
  const specCount = on && !soloOn && ost ? Math.max(0, ost.members.length - actCount) : 0;
  const cpus = Math.max(0, total - (pass && !on ? c.humans : actCount));
  const subParts = [];
  if (on && !soloOn) {
    subParts.push(`対局 ${actCount}人`);
    if (specCount) subParts.push(`観戦 ${specCount}人`);
    if (cpus) subParts.push(`CPU ${cpus}人`);
  } else if (cpus) {
    subParts.push(`CPU ${cpus}人`);
  }
  const left = `
     ${soloOn ? `<div class="panel"><h3>参加者待ちの1人プレイ</h3><p class="dimtxt" style="margin:4px 0">他の人が入室するまで、シングルプレイと同じ設定で遊べます。参加者が来たらゲームを続けるか選べます。</p></div>` : ''}
     ${on || !canPass ? '' : `<div class="panel"><h3>遊び方</h3><div class="row">${seg('c:mode', [['cpu', 'CPUと対戦'], ['pass', '手番ごとに交代']], pass ? 'pass' : 'cpu', 'wide')}</div></div>`}
     <div class="panel"><h3>人数と相手</h3>
      <div class="row"><span>合計の人数${subParts.length ? `<small class="sub">${esc(subParts.join('・'))}</small>` : ''}</span>${ps ? `<span class="stepper"><button data-pstep="-1" aria-label="減らす" ${pidx > 0 ? '' : 'disabled'}>−</button><b class="num">${esc(ps.values[pidx][1])}</b><button data-pstep="1" aria-label="増やす" ${pidx < ps.values.length - 1 ? '' : 'disabled'}>＋</button></span>` : `<b>${total}人</b>`}</div>
      ${(on && !soloOn) || cpus===0 ? '' :
        setupRow('CPUの強さ',seg('c:level',LV.map((l,i)=>[i,l]),c.level)) +
        (usesExtraCpuPace(id)?setupRow('CPUの手番の長さ',seg('c:cpuLen',CPU_PACE_CHOICES,c.cpuLen||'inherit')):'')}
      ${(!on || soloOn) && !pass && total===2 ? setupRow('手番',seg('c:seat',[[0,seatNames[0]],[1,seatNames[1]],[-1,'ランダム']],c.seat)) : ''}</div>
     ${on || !pass ? '' : `<div class="panel"><h3>手番ごとに交代</h3>
      <div class="row"><span>交代する人</span><span class="stepper"><button data-hstep="-1" aria-label="減らす" ${c.humans > 2 ? '' : 'disabled'}>−</button><b class="num">${c.humans}人</b><button data-hstep="1" aria-label="増やす" ${c.humans < total ? '' : 'disabled'}>＋</button></span></div>
      <div class="row"><span>1人目</span><b>${esc(meName())}</b></div>
      ${Array.from({ length: Math.max(1, c.humans - 1) }, (_, k) => `<div class="row"><span>${k + 2}人目</span><span class="field"><input data-pname="${k + 1}" value="${esc(c.names[k + 1] || '')}" placeholder="プレイヤー${k + 2}" maxlength="12" aria-label="${k + 2}人目の名前"></span></div>`).join('')}
      <div class="row"><span>上下反対に表示</span>${sw('c:rotate', c.rotate)}</div></div>`}`;
  const right = `
     ${rule.length ? `<div class="panel"><h3>ルール</h3>${rule.map(rowOpt).join('')}</div>` : ''}
     ${local.length ? `<div class="panel"><h3>ローカルルール</h3>${local.map(rowOpt).join('')}</div>` : ''}
     ${id === 'dots' ? `<div class="panel"><h3>表示</h3><div class="row"><span>紙の色</span>${seg('c:paper', [['light', 'ライト'], ['auto', '設定に合わせる'], ['dark', 'ダーク']], c.paper || 'light')}</div></div>` : ''}
     ${on && !soloOn ? setupPanel(time.some(o=>o.key==='onlineUndo')?'時間と待った':'時間',time.map(rowOpt).join('') +
       '<p class="dimtxt">時間切れになると、代わりに一手進みます。</p>')
     : `<div class="panel"><h3>時間</h3>
      <div class="row"><span>1手の制限時間</span>${seg('c:limit', [[0, 'なし'], [15, '15秒'], [30, '30秒'], [60, '60秒']], c.limit)}</div>
      ${soloOn ? '<p class="dimtxt" style="margin:6px 0 0">待機中の1人プレイは「待った」が自由に使えます。</p>' : `<div class="row ${c.limit ? '' : 'dim'}"><span>時間切れ</span>${seg('c:tout', [['random', 'ランダムな一手'], ['lose', '負け']], c.tout)}</div>`}</div>`}`;
  const label = soloOn ? '1人プレイ(待機中)' : on ? 'みんなで遊ぶ' : g.category === 'BOARD' ? 'ボードゲーム' : 'カードゲーム';
  return setupLayout(id, label, on ? 'room' : 'menu', left, right, '<button class="btn primary" data-start>スタート</button>');
}

// ---------------------------------------------------------------- 対局
let concurrent = false, concTimer = null;
let cur = null, h = -1, token = 0, view = null, mySeat = 0, sel = null, busy = false, clock = null, lastSeat = 0, mode = 'cpu', pcfg = null, lastRecord = '', prevView = null;
const THINK = [300, 800, 1500];
const PACE = { 短い: 250, ふつう: 450, 長い: 800 };
// ルーレットは1人につき最大4操作＋確定。待ち時間は手番全体に分配する。
const ROULETTE_CPU_BEAT = { 短い:340, ふつう:500, 長い:650 };
const EXTRA_CPU_PACE = { 短い: 1000, ふつう: 2700, 長い: 3700 };
const CPU_PACE_CHOICES = [['inherit','共通設定'],...Object.keys(PACE).map(label=>[label,label])];
const cpuPaceSetting = choice => Object.hasOwn(PACE,choice) ? choice : S.set.cpuLen;
const extraCpuDelay = choice => EXTRA_CPU_PACE[cpuPaceSetting(choice)] ?? EXTRA_CPU_PACE['ふつう'];
// クアルト: 自分が駒を決めてから CPU が置き始めるまで 1 秒、CPU が置いてから駒を選び始めるまで 0.5 秒(ふつう。短い・長いはその比率)。
// 置いた駒が落ちる動き(約 0.4 秒)の終わりを待ってから数え始めるので、pick 側の待ちはその分を引いた短い値にしている
const QUARTO_CPU_PACE = { place: { 短い: 600, ふつう: 1000, 長い: 1500 }, pick: { 短い: 60, ふつう: 130, 長い: 330 } };
const quartoCpuDelay = (choice, phase) => (QUARTO_CPU_PACE[phase === 'pick' ? 'pick' : 'place'][cpuPaceSetting(choice)]) ?? 1000;
const usesExtraCpuPace = id => id === 'roulette' || window.TWELVE_HAS(id);
const rouletteSolo = (id, c) => id === 'roulette' && c?.opts.players === '1';
const cpuPaceChoice = () => cpuPaceSetting(!online || isSoloIdleMatch() ? pcfg?.cpuLen : null);
const SPEED = () => ({ ゆっくり: 1.5, ふつう: 1, 速い: 0.6 }[S.set.speed] || 1) * (S.set.reduce ? 0.01 : 1);
const PASS_MOVES = { reversi: 64, ludo: 99, backgammon: 999 };
async function startMatch(forceSeat) {
  online = false; token++; sel = null; prevView = null; view = null; drawnView = null; resultShown = -1; stopClock();
  { const p = $('#result'); if (p) p.hidden = true; }
  const g = cur = gInfo(S.setup.id); const c = pcfg = cfg(g.id);
  const single = rouletteSolo(g.id, c);
  mode = !single && c.mode === 'pass' && range(g.players)[1] >= 2 ? 'pass' : 'cpu';
  let seat = forceSeat != null ? forceSeat : c.seat === -1 ? (Math.random() < 0.5 ? 0 : 1) : c.seat;
  if (single || (range(g.players)[0] === 1 && range(g.players)[1] === 1)) seat = 0;
  const seed = String(Math.floor(Math.random() * 2 ** 40) + 1);
  if (mode === 'pass') {
    const n = c.humans; const names = [meName(), ...c.names.slice(1, n).map((x, i) => x || `プレイヤー${i + 2}`)];
    h = await callW('newMatchNamed', g.id, engineOpts(g, c), seed, Array.from({ length: n }, (_, i) => i).join(','), c.level, names.join(','));
    seat = 0;
  } else h = await callW('newMatchNamed', g.id, engineOpts(g, c), seed, String(seat), c.level, meName());
  mySeat = lastSeat = seat;
  enterPlay();
}
async function resume(s) {
  cur = gInfo(s.id); if (!cur) return;
  S.setup = { id: s.id, online: false }; pcfg = Object.assign(cfg(s.id), s.cfg || {});
  online = false; token++; sel = null; prevView = null; view = null; drawnView = null; resultShown = -1; mode = s.mode || 'cpu';
  h = await callW('restoreMatch', s.rec);
  if (h < 0) return toast({ w: 'お知らせ', t: '続きを読み込めませんでした' });
  const v0 = JSON.parse(await call('viewJson', h, 0));
  mySeat = lastSeat = v0.mine >= 0 ? v0.mine : 0;
  enterPlay(true);
}
// resumed: 途中から再開した時は、配る・対局開始などの「盤を組み立てる演出」を出さず、すぐ途中の盤を見せる
async function enterPlay(resumed = false) {
  busy = false; yachtCutJust = false; stopConcurrent();
  S.chatOpen = false; S.chatUnread = 0;
  // 同時進行のゲームは通信対戦では止める。ただしルーレットは、みんなで同時に賭ける
  concurrent = (online && !isSoloIdleMatch() && cur.id !== 'roulette') ? false : await call('isConcurrent', h); S.screen = 'play'; S.modal = null;
  // リロードした時に、この対局へ戻れるように覚えておく(通信対戦は部屋に入り直して戻る)
  try { if (!online) sessionStorage.setItem('asobi-play', cur.id); else sessionStorage.removeItem('asobi-play'); } catch (e) {}
  bgCtx(); render();
  const fresh = !resumed && (!view || !view.moves);
  dealPending = SHUFFLE_GAMES.has(cur.id) && fresh && (!online || isSoloIdleMatch()) ? 1 : 0;
  if (SHUFFLE_GAMES.has(cur.id) && fresh) transientAudio.later(sfxShuffle, 250);
  if (fresh) setTimeout(() => cut({ text: '対局開始', tone: 'gold', ms: 1200 }), 150);
  refresh();
}
function leavePlay() { try { sessionStorage.removeItem('asobi-play'); } catch (e) {} token++; busy = false; cpuTurnKey = ''; S.chatOpen = false; S.chatUnread = 0; stopClock(); stopConcurrent(); closeSheet(); if (online) leaveOnlinePlay(); h = -1; view = null; }
const subText = () => online ? (view && view.mine < 0 ? 'みんなで遊ぶ・観戦中' : isSoloIdleMatch() ? '1人プレイ(待機中)' : 'みんなで遊ぶ') : mode === 'pass' ? '手番ごとに交代' : rouletteSolo(cur?.id, pcfg) ? 'ひとりで遊ぶ' : 'CPU ' + LV[pcfg ? pcfg.level : 1];
function playChatPopHtml() {
  return `<button type="button" class="chatpop-back" data-chatclose aria-label="チャットを閉じる"></button>
    <div class="chatpop" id="chatpop" role="dialog" aria-label="チャット">
      <div class="chatpop-hd"><b>チャット</b><button type="button" class="btn chatpop-close" data-chatclose aria-label="閉じる">✕</button></div>
      ${chatBox()}
    </div>`;
}
function syncChatFab() {
  const fab = document.querySelector('[data-chatfab]');
  if (!fab) return;
  const chatOn = online && typeof isChatEnabled === 'function' ? isChatEnabled() : true;
  if (!chatOn || S.chatOpen) S.chatUnread = 0;
  const cnt = chatOn ? (S.chatUnread || 0) : 0;
  fab.setAttribute('aria-expanded', String(!!S.chatOpen));
  fab.setAttribute('aria-label', S.chatOpen ? 'チャットを閉じる' : 'チャットを開く');
  fab.classList.toggle('is-open', !!S.chatOpen);
  fab.classList.toggle('is-off', !chatOn);
  fab.classList.toggle('has-unread', cnt > 0);
  let badge = fab.querySelector('.chatfab-badge');
  if (cnt > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'chatfab-badge'; fab.appendChild(badge); }
    badge.textContent = cnt > 99 ? '99+' : String(cnt);
  } else if (badge) {
    badge.remove();
  }
}
function togglePlayChat(open) {
  if (S.screen !== 'play' || !online) return;
  const next = open != null ? !!open : !S.chatOpen;
  S.chatOpen = next;
  if (!next) {
    S.stOpen = false;
    document.querySelectorAll('.chatpop-back, #chatpop').forEach((el) => el.remove());
  } else {
    S.chatUnread = 0;
    document.querySelectorAll('.chatpop-back, #chatpop').forEach((el) => el.remove());
    const scr = $('.play-screen');
    if (scr) {
      scr.insertAdjacentHTML('beforeend', playChatPopHtml());
      const log = $('#log'); if (log) log.scrollTop = log.scrollHeight;
      if (typeof keepStampScroll === 'function') keepStampScroll();
    }
  }
  syncChatFab();
  syncAppHistory();
}
const matchTitle = (g,b) => g.id==='oldmaid' && b?.variant==='jiji' ? 'ジジ抜き' : g.name;
const playHeader = (title, label, back, extra = '', tail = '') => `<div class="stagehead"><button class="btn" ${back} aria-label="戻る">${ic('back')}</button><h2>${esc(title)}</h2><span>${esc(label)}${extra}</span>${tail}</div>`;
const playGear = () => `<button class="btn play-settings" data-playsettings aria-label="設定">${ic('set')}</button>`;
const playMembers = () => `<button class="btn" data-oomembers>メンバー (${ost?.members?.length || 0})</button>`;
const playMode = on => on ? 'みんなで遊ぶ' : 'ひとりで遊ぶ';
const playSide = ({seats = '', status, actions, on = false, content = '', extraClass = 'extra-side',
    onlineActions = '', showChat = on}) => `<aside class="side ${extraClass}">
  ${seats}${status}<div class="ops">${actions}</div>
  ${on ? `<div class="online-ops">${onlineActions}${playMembers()}</div>` : ''}${content}${showChat ? chatBox() : ''}</aside>`;
// 独自に描くゲーム(マインスイーパー・スライド・ぶにょぶにょ・パクリス・坊主めくりなど)の結果の画面。ほかのゲームと同じ形(#result の .rbox)。
// o: {title, sub, rank(HTML), exit(戻るボタンの属性), again(もう一度の属性。無ければ出さない), undo(待ったの属性), wait(待つ人への文), online}
const extraResultBox = (o) => `<div class="rbox"><h3>${esc(o.title)}</h3>${o.sub ? `<p>${esc(o.sub)}</p>` : ''}${o.rank || ''}${o.wait ? `<p class="dimtxt">${esc(o.wait)}</p>` : ''}<div class="rbtns">${o.undo ? `<button class="btn" ${o.undo}>${ic('undo')}待った</button>` : ''}<button class="btn" ${o.exit}>${o.online ? '部屋に戻る' : 'メニュー'}</button>${o.again ? `<button class="btn primary" ${o.again}>もう一度</button>` : ''}</div></div>`;
// 描いた画面に入れる(o が無い時は隠したまま)
const extraResultLayer = (o) => `<div class="resultlayer" id="result" ${o ? '' : 'hidden'}>${o ? extraResultBox(o) : ''}</div>`;
// 今の画面の結果の欄を出す/隠す。delay ミリ秒の後に出す(カットインの後など)
function setExtraResult(o, delay = 0) {
  clearTimeout(setExtraResult.t);
  const p = $('#result');
  if (!o) { if (p) { p.hidden = true; p.innerHTML = ''; } return; }
  const scr = S.screen;
  // 待つ間に描き直されても出せるよう、出す時に探し直す
  const show = () => { const q = $('#result'); if (!q || S.screen !== scr) return; q.innerHTML = extraResultBox(o); q.hidden = false; };
  if (delay > 0) setExtraResult.t = setTimeout(show, delay); else show();
}
function play() {
  const g = cur;
  const soloMatch = online && isSoloIdleMatch();
  const autoMe = online && isMySeatAutoCpu();
  const canUndo = view && (online ? !!(ost && ost.undoOk) && !busy && !autoMe && view.moves > 0 && !(ost && ost.undoAsk) : view.undoAllowed !== false && !busy && view.moves > 0 && (view.board?.kind==='pegsolitaire' || view.seats.some((s) => !s.human) || !!view.outcome));
  const listLabel = /shogi|gogo|chess/.test(g.id) ? '駒の一覧' : '役の一覧';
  const mob = isMob();
  if (!mob && S.chatOpen) S.chatOpen = false;
  const chatOn = online && typeof isChatEnabled === 'function' ? isChatEnabled() : true;
  const chatCnt = chatOn ? (S.chatUnread || 0) : 0;
  const chatBtn = online && mob ? `<button type="button" class="btn chatfab${chatOn ? '' : ' is-off'}${S.chatOpen ? ' is-open' : ''}${chatCnt ? ' has-unread' : ''}" data-chatfab aria-label="${S.chatOpen ? 'チャットを閉じる' : 'チャットを開く'}" aria-expanded="${!!S.chatOpen}" title="チャット">${ic('chat')}${chatCnt ? `<span class="chatfab-badge">${chatCnt > 99 ? '99+' : chatCnt}</span>` : ''}</button>` : '';
  const chatPop = online && mob && S.chatOpen ? playChatPopHtml() : '';
  const actions = `<button class="btn" data-undo ${canUndo ? '' : 'disabled'}>${ic('undo')}待った</button>${ruleButton(g.id)}
    <button class="btn ${hasList(g.id) ? 'listbtn' : ''}" data-list ${hasList(g.id) ? '' : 'disabled'}>${ic('list')}${listLabel}</button><button class="btn" data-resign ${view && (view.canResign && view.human || solQuitMove() != null) && !view.outcome && !busy && !autoMe ? '' : 'disabled'}>${ic('flag')}降参</button>`;
  const cpuButton = online && !soloMatch && view?.mine >= 0 ? `<button class="btn ${myAutoCpuOn() ? 'gold' : ''}" data-autocpu ${view.outcome ? 'disabled' : ''}>${myAutoCpuOn() ? 'CPU操作を解除' : 'CPUに操作を任せる'}</button>` : '';
  const side = playSide({seats:'<div class="seats" id="strip"></div>', status:'<div class="status" id="status"></div>',
    actions,on:online,extraClass:'',onlineActions:cpuButton,showChat:online&&!mob,
    content:online?'':'<div class="sidenote" id="sidenote"></div>'});
  return `<div class="screen play-screen${online ? ' is-online' : ''}"><div class="stage">
    ${playHeader(matchTitle(g,view?.board), subText(), online ? 'data-go="room"' : 'data-go="menu"', '<b id="hround"></b>', '<em class="myturn" id="myturn" hidden>あなたの番</em>')}
    <div class="boardwrap" id="boardwrap"></div>
    <div class="acts" id="acts"></div>
    <div class="countbar" id="countbar"></div><div class="countline"><i id="cline" style="width:0"></i></div>
    ${playGear()}
    <div class="cutlayer" id="cutlayer"></div>
    <div class="resultlayer" id="result" hidden></div>
   </div>${side}${chatBtn}${chatPop}</div>`;
}
const hasList = (id) => /shogi|gogo|chess|poker|holdem|hanafuda|yacht|daifugo|mahjong/.test(id);
let refreshRevision = 0, cpuTurnKey = '';
async function refresh() {
  const revision = ++refreshRevision;
  if (h < 0) return;
  const my = token;
  const v = JSON.parse(await call('viewJson', h, mySeat));
  if (my !== token || revision !== refreshRevision) return;
  const previous = prevView;
  if (online) prevView = v;
  view = v;
  if (!online) {
    const record = await call('matchRecord', h);
    if (my !== token || revision !== refreshRevision) return;
    lastRecord = record;
  }
  if (mode === 'pass' && view.human && view.toMove >= 0 && view.toMove !== mySeat) {
    const nextSeat = view.toMove;
    const nextView = JSON.parse(await call('viewJson', h, nextSeat));
    if (my !== token || revision !== refreshRevision) return;
    mySeat = nextSeat;
    view = nextView;
  }
  // 通信対戦: ほかの人の手(サイコロ・札など)も、自分の手と同じように音を鳴らす
  if (online && previous && view.moves > previous.moves && pendSnd == null) {
    let ms = [];
    try { ms = mainCore.onlineMovesFrom(h, previous.moves).split(',').filter((x) => x !== '').map(Number); if (ms.length) { pendSnd = ms[ms.length - 1]; lastPlayed = pendSnd; } } catch (e) {}
    // 相手(通信の人)の手も、CPU と同じカーソルの動きで見せる(前の盤の上で動かしてから、新しい盤を描く)
    // (PC 版どうしで、相手のカーソルがいつも見えている時は、この動きは出さない)
    if (cur.id === 'roulette' && concurrent && !isHostRoom()) {
      for (const m of ms) { const seat = Math.floor(m / 1000000), sv = view.seats[seat]; if (sv && !sv.human && seatToSlot(seat) < 0) { /* 部屋の人がいない席 = ホストが動かす CPU */ rouletteSeatCursor(seat, m, my, false); if (m % 1000000 === 2004) seatCursorHide(seat, 900); } }
    }
    const rouletteCpu = cur.id === 'roulette' && !concurrent && previous.toMove >= 0 &&
      ((!previous.human && !previous.remote) || isSeatAutoCpu(previous.toMove));
    const replayCursor = rouletteCpu
      ? !isHostRoom() && S.set.cursor !== '表示しない'
      : !previous.human && cursorOn() && !liveCursorOf(previous.toMove);
    if (replayCursor && ms.length === 1 && previous.toMove >= 0 && !NO_CURSOR.has(cur.id) && S.screen === 'play') {
      const nv = view; view = previous;
      try { await runCursor(ms[0], my); } catch (e) {}
      if (my !== token || revision !== refreshRevision) return;
      hideCursor();
      view = nv;
    }
  }
  if (!view.outcome) { const rp = $('#result'); if (rp && !rp.hidden) { rp.hidden = true; resultShown = -1; } }
  detectEvents(previous, view);
  turnCut(previous, view);
  prevView = view;
  if (S.screen !== 'play') return;
  drawPlay();
  saveProgress();
  if (view.outcome) { stopClock(); stopConcurrent(); return showResult(); }
  if (concurrent) { busy = false; runConcurrent(my); drawPlay(); return; }
  const curTurnKey = `${my}:${view.moves}:${view.toMove}`;
  if (view.human) {
    if (online && isMySeatAutoCpu()) {
      stopClock();
      if (isHostRoom() && isSeatAutoCpu(view.toMove)) {
        if (busy && cpuTurnKey === curTurnKey) return;
        cpuTurnKey = curTurnKey;
        return cpuTurn(my, { autoCpu: true, forSeat: view.toMove });
      }
      busy = false; drawPlay(); startClock(my); return;
    }
    const pm = PASS_MOVES[cur.id];
    if (pm != null && view.legal.length === 1 && view.legal[0] === pm) {
      setStatus('動かせないので、パスします');
      await new Promise((r) => setTimeout(r, 1100));
      if (my !== token || revision !== refreshRevision) return;
      while (modalPause() && my === token) await new Promise((r) => setTimeout(r, 200));
      if (my !== token || revision !== refreshRevision) return;
      if (online) mainCore.onlinePlay(h, pm); else await call('playMove', h, pm);
      if (!online) pendSnd = pm;
      return refresh();
    }
    startClock(my); return;
  }
  stopClock();
  if (online && view.remote) {
    if (isHostRoom() && isSeatAutoCpu(view.toMove)) {
      if (busy && cpuTurnKey === curTurnKey) return;
      cpuTurnKey = curTurnKey;
      return cpuTurn(my, { autoCpu: true, forSeat: view.toMove });
    }
    busy = false; drawPlay(); startClock(my); return;
  }
  if (busy && cpuTurnKey === curTurnKey) return;
  cpuTurnKey = curTurnKey;
  cpuTurn(my);
}
async function cpuTurn(my, opts = {}) {
  const auto = !!(opts && opts.autoCpu);
  const forSeat = opts && opts.forSeat != null ? opts.forSeat : (view ? view.toMove : -1);
  if (auto && (!online || !view || view.outcome || view.toMove !== forSeat || !isSeatAutoCpu(forSeat))) {
    busy = false; cpuTurnKey = ''; drawPlay(); return;
  }
  busy = true; drawPlay();
  for (let k = 0; k < 200; k++) { const lag = Math.max(animUntil, cutBusy) - performance.now(); if (lag <= 0 && !cutQ.length) break; await new Promise((r) => setTimeout(r, Math.min(Math.max(lag, 60), 200))); if (my !== token) return; }
  if (my !== token) return;
  if (auto && (!online || !view || view.outcome || view.toMove !== forSeat || !isSeatAutoCpu(forSeat))) {
    busy = false; cpuTurnKey = ''; drawPlay(); return refresh();
  }
  const t0 = performance.now();
  const lvl = auto ? 1 : (view.seats[view.toMove] ? view.seats[view.toMove].level : 1);
  let mv;
  try {
    if (online) { const hw = await callW('restoreMatch', mainCore.matchRecord(h)); mv = await callW('cpuChoose', hw, THINK[lvl], auto ? 1 : null); await callW('dropMatch', hw); }
    else mv = await callW('cpuChoose', h, THINK[lvl]);
  } catch (e) {
    busy = false; cpuTurnKey = ''; drawPlay(); return;
  }
  if (my !== token) return;
  const choice = cpuPaceChoice();
  const bsPlacing = cur.id === 'battleship' && view.board && view.board.phase === 'place';
  const delay = bsPlacing ? 0 : cur.id === 'roulette' ? 90 : cur.id === 'quarto' ? quartoCpuDelay(choice, view.board && view.board.phase) : usesExtraCpuPace(cur.id) ? extraCpuDelay(choice) : (PACE[choice] || 450) * Math.max(0.3, SPEED());
  const wait = delay - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (my !== token) return;
  /* 設定・確認を開いている間は、CPU は手を出さずに待つ(シングルプレイのみ。modalPause が判定) */
  while (modalPause() && my === token) await new Promise((r) => setTimeout(r, 200));
  if (my !== token) return;
  if (auto && (!online || !view || view.outcome || view.toMove !== forSeat || !isSeatAutoCpu(forSeat))) {
    busy = false; cpuTurnKey = ''; hideCursor(); drawPlay(); return refresh();
  }
  await runCursor(mv, my);
  if (my !== token) return;
  if (auto && (!online || !view || view.outcome || view.toMove !== forSeat || !isSeatAutoCpu(forSeat))) {
    busy = false; cpuTurnKey = ''; hideCursor(); drawPlay(); return refresh();
  }
  busy = false;
  cpuTurnKey = '';
  const quiet = view.board && view.board.kind === 'hitblow' && view.board.setting;
  if (online) mainCore.onlineCpuPlay(h, mv); else await call('playMove', h, mv);
  if (my !== token) return;
  if (!online) pendSnd = quiet ? null : mv; lastPlayed = mv; hideCursor();
  await refresh();
}
let turnPending = 0; // 「あなたの番です」が出終わるまでは操作しない(出る前の待ち時間も含む)
const cutOn = () => !!document.querySelector('#cutlayer .cutin:not(.out)') || performance.now() < turnPending;
async function humanMove(m) {
  if (cutOn()) return;
  if (online && isMySeatAutoCpu()) return;
  if (!view || (!view.human && !concurrent) || busy || m == null || m < 0) return;
  sel = null; stopClock();
  const my = token;
  const ok = online ? mainCore.onlinePlay(h, m) : await call('playMove', h, m);
  if (ok) { if (!online) pendSnd = m; lastPlayed = m; }
  if (my === token) await refresh();
}
function playMoveSound(m) {
  // ソリティアは各自の盤を同時に進めるので、見えていない盤(CPU・ほかの人)の手では鳴らさない
  if (cur.id === 'solitaire' && Math.floor(m / 1000000) !== (view && view.board ? view.board.me : mySeat)) return;
  const r = moveSound(cur.id === 'solitaire' && view?.board?.variant === 'spider' ? 'spider' : cur.id, m); if (r) sfx.play(r[0], r[1] || {});
}
const setStatus = (t) => { const e = $('#status'); if (e) e.textContent = t || ''; };
function statusText() {
  const b = view.board;
  if (b?.kind === 'roulette' && $('.rq-layout.is-spinning')) return 'スピン中…';
  if (view.outcome) return '終了';
  // ルーレットはみんなで同時に賭けるので「〇〇の番」は出さない
  if (b?.kind === 'roulette') { const me = b.me; if (me < 0) return '観戦中'; if (b.confirmed[me]) return 'ほかの人の確定を待っています'; return b.canRebuy ? 'チップを補充できます' : 'チップを選んで、賭け枠に置いてください'; }
  if (online && view.toMove >= 0 && isSeatAutoCpu(view.toMove)) return isMySeatAutoCpu() && view.toMove === view.mine ? 'CPUが操作中…（解除ボタンで戻れます）' : 'CPUが操作中…';
  if (online && view.remote) return `${view.seats[view.toMove].name} の番です`;
  if (!view.human) return busy && !(b && b.kind === 'hitblow' && b.setting) ? `${seatName(view.toMove)} が考えています` : '';
  if (!b) return '';
  const extraStatus = window.TWELVE_STATUS?.(b);
  if (extraStatus) return extraStatus;
  switch (b.kind) {
    case 'roulette': return b.canRebuy ? 'チップを補充できます' : 'チップを選んで、賭け枠に置いてください';
    case 'mancala': return b.extra ? '倉に入りました。もう1回まけます' : turnText();
    case 'morris': return b.removing ? '取る相手のコマを選んでください' : b.inHand[b.turn] > 0 ? `空いている点に置いてください(あと${b.inHand[b.turn]}個)` : '動かすコマを選び、行き先を選んでください';
    case 'hex': return b.turn === 0 ? '赤の番: 上と下をつなぎます' : '青の番: 左と右をつなぎます';
    case 'backgammon': return b.dice.length ? '動かす駒を選び、行き先を選んでください' : 'サイコロを振ってください';
    case 'ludo': return b.die ? `${b.die}が出ました。動かす駒を選んでください` : 'サイコロを振ってください';
    case 'shogi': return b.check ? '王手です' : turnText();
    case 'chess': return b.check ? 'チェックされています' : turnText();
    default: return turnText();
  }
}
const turnText = () => mode === 'pass' ? `${view.seats[view.toMove].name} の番です` : 'あなたの番です';
const seatName = (seat) => seat === mySeat && mode !== 'pass' && (!online || (view && view.mine === seat)) ? meName() : view.seats[seat] && (view.seats[seat].human || view.seats[seat].remote) ? (online && typeof liveSlotName === 'function' ? liveSlotName(seatToSlot(seat), view.seats[seat].name) : view.seats[seat].name) : (view.seats.filter((s) => !s.human && !s.remote).length > 1 ? 'CPU ' + (seat + 1) : 'CPU');
function flipCard(node, duration, cardClass) {
  const faces = document.createElement('span');
  faces.className = 'card-turn';
  faces.setAttribute('aria-hidden', 'true');
  const front = node.cloneNode(true);
  for (const attribute of [...front.attributes]) {
    if (attribute.name.startsWith('data-')) front.removeAttribute(attribute.name);
  }
  front.classList.remove('tap', 'on');
  // 浮かせて動かしている札(position:fixed など)を返す時も、表と裏は札の中に重ねる
  for (const k of ['position', 'left', 'top', 'right', 'bottom', 'zIndex', 'transform', 'margin', 'visibility']) front.style[k] = '';
  const back = document.createElement('span');
  back.className = cardClass + ' back';
  faces.append(front, back);
  node.append(faces);
  node.classList.add('turning-card');
  const turn = faces.animate([{transform:'rotateY(-180deg)'}, {transform:'rotateY(0deg)'}],
    {duration, easing:'ease-in-out'});
  const finish = () => {
    faces.remove();
    node.classList.remove('turning-card');
  };
  turn.addEventListener('finish', finish, {once:true});
  turn.addEventListener('cancel', finish, {once:true});
}
function api() {
  return {
    mySeat, view, handle: h, speed: SPEED(), game: cur ? cur.id : '',
    name: (seat) => seatName(seat),
    note: (seat) => { const s = view.seats[seat]; if (!s) return ''; if (online && isSeatAutoCpu(seat)) return 'CPUが操作中…'; if (seat === view.toMove && busy) return '考えています'; if (!s.human && !s.remote) return LV[s.level] || ''; return (cur.seatNames && cur.seatNames[seat]) || ''; },
    strip: (html) => { const e = $('#strip'); if (e) e.innerHTML = html; },
    board: (html, onTap) => {
      const wrap = $('#boardwrap'); if (!wrap) return;
      if (dragHold) { const f = dragHold; dragHold = null; f(); }
      wrap.className = 'boardwrap k-' + (view.board ? view.board.kind : '');
      wrap.onpointerdown = wrap.oncontextmenu = wrap.ondblclick = null;
      wrap.innerHTML = html.startsWith('<svg') ? `<div class="plate">${html}</div>` : html;
      // 表になった札(.flipin)は、裏から表へ本当にめくる(前は表の札を裏返しのまま回していたので、字・マークが左右反対に見えた)
      wrap.querySelectorAll('.pc.flipin').forEach((e) => { e.classList.remove('flipin'); if (!S.set.reduce) flipCard(e, 420 * SPEED(), 'pc'); });
      wrap.onclick = (e) => { if (busy || cutOn() || dragJust || (online && isMySeatAutoCpu())) return; const t = e.target.closest('[data-sq],[data-roll],[data-spin],[data-off],[data-tok],[data-i],[data-col],[data-hand],[data-m],[data-z],[data-k],[data-e],[data-p],[data-pt],[data-d],[data-c],[data-a],[data-s],[data-t],[data-tgt],[data-card],[data-src],[data-dest],[data-draw],[data-lm],[data-guess],[data-bet],[data-pass],[data-pit],[data-die],[data-cat],[data-seat],[data-bscell],[data-bsship],[data-bkpiece],[data-qdhit],[data-qpawn],[data-ldface]') || e.target; onTap(t.dataset || {}, t); };
    },
    acts: (list) => {
      const box = $('#acts'); if (!box) return;
      const autoMe = online && isMySeatAutoCpu();
      const waitT = online && ((!view.human && view.remote) || autoMe), dimT = (!view.human && !concurrent && !waitT) || busy || autoMe;
      box.innerHTML = list.map((a, i) => `<button class="btn ${a.cls != null ? a.cls : i === list.length - 1 ? 'gold' : ''} ${waitT ? 'waiting' : ''}" data-act="${i}" ${waitT ? 'tabindex="-1"' : !a.enabled || dimT ? 'disabled' : ''}>${esc(a.label)}</button>`).join('');
      box.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || b.classList.contains('waiting') || cutOn() || (online && isMySeatAutoCpu())) return; const a = list[+b.dataset.act]; if (a.fn) a.fn(); else humanMove(a.move); };
    },
    play: humanMove, redraw: () => drawPlay(true), anim: (ms) => { animUntil = Math.max(animUntil, performance.now() + ms * SPEED()); },
    land: (ms) => { landMs = ms; }, sfx: (name, ms = 0, o) => transientAudio.later(() => sfx.play(name, o || {}), ms * SPEED()),
    key: (fn) => { boardKey = fn; }, round: (t) => { const e = $('#hround'); if (e) e.innerHTML = t ? String(t).split('・').map((x) => `<span class="hchip">${esc(x)}</span>`).join('') : ''; },
    side: (html, onTap) => { const n = $('#sidenote'); if (!n) return; sideCustom = true; n.classList.add('custom'); n.innerHTML = html; n.onclick = (e) => { const t = e.target.closest('[data-lm],[data-spin],[data-repay],[data-act]'); if (!t || t.disabled || t.classList.contains('waiting') || cutOn()) return; onTap(t.dataset, t); }; },
    get isOnline() { return online; },
    get remoteTurn() { return online && view && ((!view.human && view.remote) || isMySeatAutoCpu()); }, cut: (c) => cut(Object.assign({ _tok: token }, c)), animClear: () => { animUntil = performance.now(); },
    drag: (o) => setupDrag(o),
    takeDrop: () => { const d = dragDrop; dragDrop = null; return d && performance.now() - d.at < 1500 ? d : null; },
    get cfg() { return pcfg || {}; }, get lastMove() { return lastPlayed; }, get reduce() { return !!S.set.reduce; },
    sheet: (html, init) => { openSheet(html); if (init) init($('#sheet')); }, closeSheet,
    get sel() { return sel; }, set sel(v) { sel = v; },
    get hints() { return S.set.hints; }, get caps() { return S.set.caps; }, get pre() { return S.set.pre; },
    flipCard: (node, ms, cardClass) => { if (!S.set.reduce) flipCard(node, ms * SPEED(), cardClass); },
    face: () => (online && view && view.mine < 0 ? `<span class="dot face">${esc((seatName(mySeat) || '?')[0])}</span>` : meAv()),
    call: (fn, ...a) => call(fn, ...a), sheetOpen: () => !!$('#sheetwrap'),
  };
}
let sideCustom = false, lastPlayed = -1, drawnView = null, animUntil = 0, pendSnd = null, landMs = 0, boardKey = null, dealPending = 0;
function drawPlay(force) {
  if (S.screen !== 'play' || !view) return;
  if (!$('#boardwrap')) render();
  if (typeof kickCursorLoop === 'function') kickCursorLoop();
  const keep = !force && drawnView === view && $('#boardwrap').firstChild;
  const b = view.board;
  const title = b?.kind==='oldmaid' && $('.stagehead h2');
  if (title && title.textContent!==matchTitle(cur,b)) title.textContent=matchTitle(cur,b);
  // 通信対戦: 自分の番かどうか(ほかの人の番は、操作のボタンを灰色に)
  const autoMe = online && isMySeatAutoCpu();
  { const mine = !!(view.human && !view.outcome && !autoMe), st = $('.stage'), mt = $('#myturn');
    if (st) st.classList.toggle('notmine', online && !mine);
    if (mt) mt.hidden = !(online && mine); }
  const ops = $('.side .ops');
  if (ops) {
    const canUndo = online ? !!(ost && ost.undoOk) && !busy && !autoMe && view.moves > 0 && !(ost && ost.undoAsk) : view.undoAllowed !== false && !busy && view.moves > 0 && (view.board?.kind==='pegsolitaire' || view.seats.some((s) => !s.human) || !!view.outcome);
    ops.querySelector('[data-undo]').disabled = !canUndo;
    ops.querySelector('[data-resign]').disabled = !((view.canResign && view.human || solQuitMove() != null) && !view.outcome && !busy && !autoMe);
  }
  const acBtn = $('.side [data-autocpu]');
  if (acBtn) {
    const on = myAutoCpuOn();
    acBtn.classList.toggle('gold', on);
    acBtn.disabled = !!view.outcome;
    acBtn.textContent = on ? 'CPU操作を解除' : 'CPUに操作を任せる';
  }
  const omBtn = $('.side [data-oomembers]');
  if (omBtn && ost && ost.members) omBtn.textContent = `メンバー (${ost.members.length})`;
  const manualReady = $('#boardwrap .twelve-scene, #boardwrap .rq-layout')?.dataset.ready;
  if (keep && (manualReady == null || manualReady === String(view.human && !view.outcome && !busy && !autoMe))) { setStatus(statusText()); drawClock(); return; }
  drawnView = view;
  $('#acts').innerHTML = ''; $('#strip').innerHTML = '';
  landMs = 0; boardKey = null; sideCustom = false; { const n = $('#sidenote'); if (n) { n.classList.remove('custom'); n.onclick = null; } }
  if (b) {
    const r = window.RENDER[b.kind] || (b.kind === 'cards' ? window.RENDER.cards : null);
    if (r) r(b, api());
    else $('#boardwrap').innerHTML = '<div class="empty">この盤はまだ描けません</div>';
  }
  if (pendSnd != null) { const m = pendSnd; pendSnd = null; if (landMs >= 0) { if (landMs > 0) transientAudio.later(() => playMoveSound(m), landMs * SPEED()); else playMoveSound(m); } }
  if (dealPending) { dealPending = 0; dealIntro(); }
  setStatus(statusText());
  drawClock();
  const n = $('#sidenote'); if (n && !sideCustom) n.innerHTML = `<div class="kv"><span>手数</span><b class="num">${view.moves}</b></div>`;
}

// 札をドラッグで出す(設定「駒の動かし方」がクリックの時は使わない)
// o.getStack(src): まとめてドラッグする要素配列を返す。
// 当たり判定はドラッグ中のカード矩形と移動先候補の重なり面積で判定し、カードの上端・下端のどこを掴んでも同じ感覚で置けるようにする。
let dragJust = false, dragDrop = null, dragHold = null;
function setupDrag(o) {
  const wrap = $('#boardwrap'); if (!wrap || S.set.drag === 'クリック') return;
  wrap.classList.add('drag-enabled');
  wrap.onpointerdown = (e) => {
    if (e.button !== 0 || busy || cutOn() || (online && isMySeatAutoCpu()) || (!view.human && !concurrent)) return;
    const src = e.target.closest(o.src); if (!src || !wrap.contains(src)) return;
    const sx = e.clientX, sy = e.clientY, r = src.getBoundingClientRect();
    const rawStack = typeof o.getStack === 'function' ? o.getStack(src) : null;
    const stackEls = Array.isArray(rawStack) && rawStack.length ? rawStack : [src];
    const stackRects = stackEls.map((el) => el.getBoundingClientRect());
    let sL = r.left, sT = r.top, sR = r.right, sB = r.bottom;
    for (const sr of stackRects) {
      if (sr.left < sL) sL = sr.left;
      if (sr.top < sT) sT = sr.top;
      if (sr.right > sR) sR = sr.right;
      if (sr.bottom > sB) sB = sr.bottom;
    }
    let ghost = null, over = null, lastDx = 0, lastDy = 0;
    const findBestTarget = (dx, dy) => {
      // 先頭カードおよびスタック全体の現在位置矩形（掴んだ位置に依存しない）
      const gL = r.left + dx, gT = r.top + dy, gR = r.right + dx, gB = r.bottom + dy;
      const gCx = (gL + gR) * 0.5, gCy = (gT + gB) * 0.5;
      const cands = wrap.querySelectorAll(o.dst);
      let best = null, bestArea = 0, bestDist = Infinity;
      for (const cand of cands) {
        if (cand === src || stackEls.includes(cand)) continue;
        if (src.parentElement && cand === src.parentElement && cand.hasAttribute('data-dest')) continue;
        if (typeof o.canDrop === 'function' && !o.canDrop(src, cand)) continue;
        const cr = cand.getBoundingClientRect();
        if (cr.width <= 0 || cr.height <= 0) continue;
        let cTop = cr.top, cBottom = cr.bottom, cLeft = cr.left, cRight = cr.right;
        if (cand.matches && cand.matches('.spile[data-dest]')) {
          const cards = cand.querySelectorAll('.pcard');
          const last = cards.length ? cards[cards.length - 1] : null;
          if (last) {
            const lr = last.getBoundingClientRect();
            cBottom = Math.max(cBottom, lr.bottom + 18);
          }
          cLeft -= 6; cRight += 6; cTop -= 6;
        }
        const iw = Math.max(0, Math.min(gR, cRight) - Math.max(gL, cLeft));
        const ih = Math.max(0, Math.min(gB, cBottom) - Math.max(gT, cTop));
        const area = iw * ih;
        if (area <= 0) continue;
        const cx = (cLeft + cRight) * 0.5, cy = (cTop + cBottom) * 0.5;
        const dist = (gCx - cx) * (gCx - cx) + (gCy - cy) * (gCy - cy);
        if (area > bestArea + 1 || (Math.abs(area - bestArea) <= 1 && dist < bestDist)) {
          bestArea = area;
          bestDist = dist;
          best = cand;
        }
      }
      return best;
    };
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      const z = (document.body.style && parseFloat(document.body.style.zoom)) || 1;
      if (!ghost) {
        if (Math.hypot(dx, dy) < 6) return;
        sfx.play('CARD_FLIP', { volume: .5 });
        if (stackEls.length > 1) {
          ghost = document.createElement('div');
          ghost.className = 'dragghost dragstack';
          Object.assign(ghost.style, {
            position: 'fixed',
            left: (r.left / z) + 'px',
            top: (r.top / z) + 'px',
            width: ((sR - r.left) / z) + 'px',
            height: ((sB - r.top) / z) + 'px',
            pointerEvents: 'none',
          });
          stackEls.forEach((el, idx) => {
            const cr = stackRects[idx];
            const cl = el.cloneNode(true);
            cl.classList.remove('on', 'tap');
            cl.classList.add('dragstack-item');
            const fs = getComputedStyle(el).fontSize;
            Object.assign(cl.style, {
              position: 'absolute',
              left: ((cr.left - r.left) / z) + 'px',
              top: ((cr.top - r.top) / z) + 'px',
              width: (cr.width / z) + 'px',
              height: (cr.height / z) + 'px',
              margin: '0',
              fontSize: fs,
              zIndex: String(idx + 1),
            });
            cl.style.setProperty('--cw', (cr.width / z) + 'px');
            cl.style.setProperty('--w', (cr.width / z) + 'px');
            ghost.appendChild(cl);
          });
        } else {
          ghost = src.cloneNode(true);
          ghost.classList.add('dragghost');
          Object.assign(ghost.style, {
            width: (r.width / z) + 'px',
            height: (r.height / z) + 'px',
            left: (r.left / z) + 'px',
            top: (r.top / z) + 'px',
          });
          ghost.style.setProperty('--cw', (r.width / z) + 'px');
          ghost.style.setProperty('--w', (r.width / z) + 'px');
          ghost.style.fontSize = getComputedStyle(src).fontSize;
        }
        document.body.appendChild(ghost);
        stackEls.forEach((el) => el.classList.add('dragsrc'));
      }
      lastDx = dx; lastDy = dy;
      ghost.style.transform = `translate(${dx / z}px,${dy / z}px) rotate(3.5deg)`;
      const d = findBestTarget(dx, dy);
      if (over !== d) {
        if (over) over.classList.remove('dropover');
        over = d && wrap.contains(d) ? d : null;
        if (over) over.classList.add('dropover');
      }
    };
    const up = (ev) => {
      if (ev.type !== 'blur' && ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
      if (!ghost) return;
      if (over) over.classList.remove('dropover');
      dragJust = true; setTimeout(() => (dragJust = false), 0);
      const restore = () => { ghost.remove(); stackEls.forEach((el) => el.classList.remove('dragsrc')); };
      if (ev.type === 'pointerup' && over) {
        // 置いた札は、離した所から行き先へ動かす(元の場所に一度戻さない)。
        // 見本(ゴースト)は次に盤を描くまで残し、盤の描き方は takeDrop() で離した位置を受け取る。
        dragDrop = { at: performance.now(), rot: 3.5, items: stackEls.map((el, i) => ({ el, cid: el.dataset.cid, rect: { left: stackRects[i].left + lastDx, top: stackRects[i].top + lastDy, width: stackRects[i].width, height: stackRects[i].height } })) };
        dragHold = restore;
        setTimeout(() => { if (dragHold === restore) { dragHold = null; restore(); } }, 800);
        o.drop(src, over);
      } else { restore(); sfx.play('CARD', { volume: .35, rate: .9 }); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
  };
}

// 同時に指せるゲーム(スピード・ソリティア): CPU は人の操作を待たずに、少し間をあけて指す
function stopConcurrent() { if (concTimer) { clearTimeout(concTimer); concTimer = null; } stopRouletteCpus(); }
let concSeat = 0;
// ---- ルーレット: CPU は席ごとに自分のペースで賭ける(みんなで同時に)。カーソルも席ごと ----
const rlCpu = { timers: new Map(), busy: new Set() };
function stopRouletteCpus() {
  for (const t of rlCpu.timers.values()) clearTimeout(t);
  rlCpu.timers.clear(); rlCpu.busy.clear();
  document.querySelectorAll('.rcur.seatcur').forEach((e) => e.remove());
}
async function runRouletteCpus(my) {
  if (h < 0 || (online && !isHostRoom())) return; // 通信対戦の CPU はホストが動かす
  const seats = JSON.parse(await call('cpuSeats', h)); if (my !== token) return;
  for (const seat of seats) if (!rlCpu.busy.has(seat)) rouletteCpuLoop(seat, my);
}
function rouletteCpuLoop(seat, my) {
  rlCpu.busy.add(seat);
  const beat = ROULETTE_CPU_BEAT[cpuPaceChoice()] || 500;
  const next = (ms) => rlCpu.timers.set(seat, setTimeout(step, ms));
  const end = () => { rlCpu.timers.delete(seat); rlCpu.busy.delete(seat); };
  async function step() {
    if (my !== token || !view || view.outcome || S.screen !== 'play') return end();
    if (modalPause()) return next(300); // 設定・確認を開いている間は打たない
    // 回転盤の表示・カットインの間は打たない
    const lag = Math.max(animUntil, cutBusy) - performance.now();
    if (lag > 0) return next(lag + 80);
    const m = await call('cpuChooseSeat', h, seat, 80);
    if (my !== token) return end();
    if (m < 0) { seatCursorHide(seat, 600); return end(); } // 確定した(この回はもう打たない)
    await rouletteSeatCursor(seat, m, my, true);
    if (my !== token || !view || view.outcome) return end();
    const ok = online ? mainCore.onlineCpuPlay(h, m) : await call('playMove', h, m);
    if (ok) { pendSnd = m; refresh(); }
    if (m % 1000000 === 2004) { seatCursorHide(seat, 700); return end(); }
    next(beat * (0.7 + Math.random() * 0.9));
  }
  next(beat * (0.8 + Math.random() * 1.2));
}
// 席ごとのカーソル: 目当ての枠へ動かす。hesitate の時は、先にほかの枠へ寄って迷う
function rouletteSeatTargets(m) {
  const mv = m % 1000000, W = $('#boardwrap'), q = (sel) => W?.querySelector(sel) || $(sel);
  if (mv < 1000) return [q(`[data-roulette-spot="${mv % 200}"]`)];
  if (mv < 2000) return [q(`[data-roulette-spot="${mv - 1000}"]`)];
  return [q(`[data-roulette-action="${mv}"]`)];
}
async function rouletteSeatCursor(seat, m, my, hesitate) {
  const [target] = rouletteSeatTargets(m);
  if (!target || S.set.cursor === '表示しない') return new Promise((r) => setTimeout(r, 200));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const spots = [...document.querySelectorAll('#boardwrap [data-roulette-spot]')];
  const path = hesitate && Math.random() < 0.55 && spots.length ? [spots[Math.floor(Math.random() * spots.length)], target] : [target];
  for (let k = 0; k < path.length; k++) {
    if (my !== token) return;
    const el = path[k];
    if (cursorOn()) seatCursorTo(seat, el);
    if (k === path.length - 1) el.classList.add('rq-cpu-target');
    await wait(k === path.length - 1 ? 520 : 380 + Math.random() * 260);
    el.classList.remove('rq-cpu-target');
  }
  const c = document.getElementById('seatCur' + seat);
  if (c) { c.classList.remove('click'); void c.offsetWidth; c.classList.add('click'); }
}
function seatCursorTo(seat, el) {
  const stage = $('.stage'); if (!stage || !el?.isConnected) return;
  const r0 = stage.getBoundingClientRect(), zoom = r0.width / stage.offsetWidth || 1, r = el.getBoundingClientRect();
  let c = document.getElementById('seatCur' + seat);
  if (!c) {
    stage.insertAdjacentHTML('beforeend', rcurHtml('seatCur' + seat, seatName(seat), SEAT_COLORS[seat % SEAT_COLORS.length], true));
    c = document.getElementById('seatCur' + seat); c.classList.add('seatcur');
    c.style.transform = `translate(${r0.width / 2 / zoom}px,${(r0.height + 20) / zoom}px)`; c.getBoundingClientRect();
  }
  clearTimeout(c._hide); c.style.opacity = '';
  c.style.transitionDuration = '380ms';
  c.style.transform = `translate(${(r.left - r0.left + r.width * 0.5) / zoom}px,${(r.top - r0.top + r.height * 0.5) / zoom}px)`;
}
function seatCursorHide(seat, ms) {
  const c = document.getElementById('seatCur' + seat); if (!c) return;
  clearTimeout(c._hide); c._hide = setTimeout(() => c.remove(), ms);
}

async function runConcurrent(my) {
  if (cur.id === 'roulette') return runRouletteCpus(my);
  if (concTimer || h < 0) return;
  const seats = JSON.parse(await call('cpuSeats', h)); if (!seats.length || my !== token) return;
  const seat = seats[concSeat++ % seats.length];
  const lvl = view.seats[seat] ? view.seats[seat].level : 1;
  const wait = (cur.id === 'speed' ? [1700, 1200, 800][lvl] : 600) / Math.max(0.5, 1 / SPEED()) + Math.max(0, Math.max(animUntil, cutBusy) - performance.now());
  concTimer = setTimeout(async () => {
    concTimer = null; if (my !== token || !view || view.outcome) return;
    if (modalPause()) return runConcurrent(my); // 設定・確認を開いている間は進めない
    const m = await call('cpuChooseSeat', h, seat, 80);
    if (my !== token) return;
    if (m >= 0) {
      if (online && isSoloIdleMatch()) {
        if (mainCore.onlineCpuPlay(h, m)) { pendSnd = m; return refresh(); }
      } else if (await call('playMove', h, m)) {
        pendSnd = m; return refresh();
      }
    }
    runConcurrent(my);
  }, wait);
}

// 制限時間(残り 5 秒から赤。0 で「ランダムな一手」か「負け」)
function startOnlineClock(my) {
  const total = mainCore ? mainCore.onlineMoveSeconds() : 0;
  if (!total || !view || view.outcome) { stopClock(); return; }
  const index = view.moves;
  // 同じ手の時計がもう動いていれば、そのまま(描き直しのたびに数え直さない)
  if (clock && clock.online && clock.index === index) return drawClock();
  stopClock();
  clock = { left: total, total, t: null, online: true, index };
  drawClock();
  const host = isHostRoom(), deadline = performance.now() + total * 1000;
  let last = total;
  clock.t = setInterval(() => {
    if (!online || !clock || !view || view.moves !== index || view.outcome) return stopClock();
    // ホストは自分で数えて配る。参加者はホストから届いた残り秒を出す(Android 版と同じ)
    const left = host ? Math.max(0, Math.ceil((deadline - performance.now()) / 1000)) : mainCore.onlineClockLeft();
    if (left < 0 || left === last) return;
    last = left; clock.left = left;
    if (host) try { mainCore.onlineShareClock(index, left); } catch (e) {}
    if (view.human && left > 0 && left <= 5) sfx.play(left <= 3 ? 'COUNT_LAST' : 'COUNT');
    drawClock();
    if (left <= 0) {
      if (view.human) { sfx.play('TIMEUP'); toast({ w: 'お知らせ', t: '時間切れなので、かわりに一手進めます' }); }
      if (host) { stopClock(); if (mainCore.onlineTimeoutPlay(h, index)) refresh(); }
    }
  }, 250);
}
function stopClock() { if (clock) { clearInterval(clock.t); clock = null; } drawClock(); }
function startClock(my) {
  if (online) return startOnlineClock(my);
  stopClock();
  const total = +(pcfg && pcfg.limit) || 0;
  if (!total) return drawClock();
  clock = { left: total, total, t: null };
  drawClock();
  clock.t = setInterval(async () => {
    if (my !== token || !clock) return stopClock();
    if (modalPause()) return; // 設定・確認を開いている間は持ち時間を数えない
    clock.left--;
    if (clock.left > 0 && clock.left <= 5) sfx.play(clock.left <= 3 ? 'COUNT_LAST' : 'COUNT');
    drawClock();
    if (clock.left <= 0) {
      stopClock(); sfx.play('TIMEUP');
      const lose = pcfg.tout === 'lose' && view.seats.length === 2;
      toast({ w: 'お知らせ', t: lose ? '時間切れです' : '時間切れなので、かわりに一手進めます' });
      await call('timeoutPlay', h, lose);
      if (my === token) refresh();
    }
  }, 1000);
}
function drawClock() {
  const bar = $('#countbar'), line = $('#cline'), track = line && line.parentElement; if (!bar) return;
  bar.classList.toggle('no-limit', !clock);
  if (track) track.classList.toggle('no-limit', !clock);
  if (!clock) { bar.innerHTML = '<span class="dimtxt">制限時間なし</span>'; line.style.width = '0'; return; }
  const hot = clock.left <= 5;
  bar.innerHTML = `残り <b class="num ${hot ? 'hot' : ''}">${clock.left}</b> 秒`;
  line.style.width = (clock.left / clock.total * 100) + '%'; line.classList.toggle('hot', hot);
}

// 途中の対局(5 つまで)と成績
function saveProgress() {
  if (online || !cur || h < 0 || !view || !lastRecord) return;
  const list = store.get('saved', []).filter((s) => s.id !== cur.id);
  if (!view.outcome && view.moves > 0) list.unshift({ id: cur.id, rec: lastRecord, moves: view.moves, mode, cfg: pcfg });
  store.set('saved', list.slice(0, 3));
}
function recordStat(won, lost) {
  if (online || mode !== 'cpu' || !view) return;
  const st = store.get('stats', {});
  const solo = view.seats.length === 1;
  const k = (solo ? 'solo_' : 'vs_') + cur.id;
  const a = st[k] || [0, 0, 0];
  if (solo) a[0]++; else if (won) a[0]++; else if (lost) a[1]++; else a[2]++;
  st[k] = a; store.set('stats', st);
}

// 結果
let resultShown = -1, yachtCutJust = false;
function showResult() {
  const o = view.outcome;
  const pass = mode === 'pass' && view.seats.filter((s) => s.human).length >= 2;
  const solo = view.seats.length === 1;
  const win = o.winner === mySeat || (solo && o.winner === 0);
  const key = `${online ? 'o' : 'l'}${h}:${view.moves}:${o.winner}`; // 対局ごとに 1 回だけ(次の対局が始まった後に、前の勝利を出し直さない)
  if (resultShown !== key) {
    resultShown = key;
    // 勝ち負けの音は、カットインが実際に出た時に鳴らす(ルーレットの回転など、盤の動きが終わるのを待ってから出るため)。カットインを出さない設定の時はすぐ鳴らす
    const endSound = () => sfx.play(pass ? (o.winner < 0 ? 'DRAW' : 'WIN') : win ? 'WIN' : o.winner < 0 ? 'DRAW' : 'LOSE');
    if (!S.set.cutin || S.set.reduce) endSound();
    recordStat(win, !win && o.winner >= 0);
    const winnerName = o.winner >= 0 ? (solo ? meName() : seatName(o.winner)) : '';
    const mate = /詰み|チェックメイト|checkmate/i.test(o.reason || '');
    if (cur.id === 'chess' && mate) cut({ text: 'Checkmate', tone: 'noir', font: 'yo', ms: 1600, afterAnim: true });
    const delayWinCut = (cur.id === 'chess' && mate) || (cur.id === 'yacht' && yachtCutJust);
    yachtCutJust = false;
    // ブロックスは、最後のピースが置かれた余韻を見せてから 0.5 秒空けてカットインを出す
    const winCutDelay = delayWinCut ? 1700 : cur.id === 'blokus' ? 500 : 0;
    setTimeout(() => {
      if (key !== resultShown || !view || !view.outcome) return;
      const onShow = S.set.cutin && !S.set.reduce ? endSound : undefined;
      if (o.winner < 0) cut({ text: '引き分け', tone: 'dark', ms: 1800, _tok: token, afterAnim: true, onShow });
      else cut({ who: null, text: `${winnerName} の勝利`, tone: o.winner === mySeat || pass ? 'gold' : 'dark', ms: 2000, _tok: token, afterAnim: true, onShow });
    }, winCutDelay);
  }
  const title = o.winner < 0 ? '引き分け' : solo ? (o.winner === 0 ? '成功' : '終了') : `${seatName(o.winner)} の勝利`;
  // コリドールの scores は点数ではなくゴールまでの最短手数(0=到着)なので、その意味が伝わる表記にする
  const artCnt = (i) => cur.id === 'incangold' && view.board && Array.isArray(view.board.artifactsBySeat) ? (view.board.artifactsBySeat[i] || 0) : 0;
  const scText = (i) => cur.id === 'quoridor' ? (view.scores[i] >= 99 ? '到達不能' : view.scores[i] === 0 ? 'ゴール' : `あと${view.scores[i]}手`) : cur.id === 'incangold' && view.board && view.board.useArtifacts ? `${view.scores[i]}（遺物${artCnt(i)}枚）` : view.scores[i];
  const sc = cur.id !== 'uno' && view.scores && view.scores.length >= 2 ? `<div class="rscore num">${view.scores.map((s, i) => `<span>${esc(seatName(i))} <b>${scText(i)}</b></span>`).join('')}</div>` : '';
  // 3 人以上: 順位で出す(勝った人が 1 位。あとは点の多い順。大富豪は上がった順)。同点は同順位にし、引き分けの時は上がり順で差を付けない
  let rankHtml = '';
  if (view.seats.length >= 3 && view.scores) {
    const tb = view.board && view.board.tbl, place = tb && Array.isArray(tb.place) ? tb.place : null;
    // インカの黄金は公式ルールどおり、同点なら遺物カードの枚数で順位を分ける(枚数も同じなら同順位)
    const key = (i) => cur.id === 'incangold'
      ? (i === o.winner ? -1e9 : 0) - (+view.scores[i] || 0) * 100 - artCnt(i)
      : (i === o.winner ? -1e9 : 0) + (o.winner >= 0 && place && place[i] >= 0 ? place[i] * 1000 - 1e6 : 0) + (cur.id === 'quoridor' ? 1 : -1) * (+view.scores[i] || 0);
    const order = view.seats.map((_, i) => i).sort((x, y) => key(x) - key(y));
    let prevKey = null, prevRank = 0;
    rankHtml = `<ol class="rrank">${order.map((i, k) => { const r = prevKey !== null && key(i) === prevKey ? prevRank : k + 1; prevKey = key(i); prevRank = r; return `<li class="${i === mySeat && (!online || (view && view.mine === i)) ? 'me' : ''}"><b><span class="rnum">${r}</span>位</b><span>${esc(seatName(i))}</span>${cur.id !== 'uno' && cur.id !== 'daifugo' ? `<em class="num">${scText(i)}</em>` : ''}</li>`; }).join('')}</ol>`;
  }
  const two = view.seats.length === 2 && !pass && !online;
  const p = $('#result'); if (!p) return;
  if (online) {
    const ready = ost ? ost.ready.length : 0, total = ost ? ost.members.length : 0;
    const mineReady = ost && ost.ready.includes(ost.mySlot);
    const isSpec = view && view.mine < 0;
    p.innerHTML = `<div class="rbox"><h3>${esc(title)}</h3>${o.reason ? `<p>${esc(o.reason)}</p>` : ''}${rankHtml || sc}<p class="dimtxt">再戦の準備 ${ready}/${total}人</p><div class="rbtns">${ost && ost.undoOk && !isSpec ? `<button class="btn" data-undo>${ic('undo')}待った</button>` : ''}${isSpec ? `<button class="btn" data-go="room">部屋に戻る</button>` : `<button class="btn" data-olobby>同じ部屋でほかのゲーム</button>`}<button class="btn primary" data-oagain ${!isHostRoom() && mineReady ? 'disabled' : ''}>${isHostRoom() ? 'もう一度' : mineReady ? '準備できました' : isSpec ? '次の対局に参加する' : 'もう一度'}</button></div></div>`;
  } else {
    p.innerHTML = `<div class="rbox"><h3>${esc(title)}</h3>${o.reason ? `<p>${esc(o.reason)}</p>` : ''}${rankHtml || sc}<div class="rbtns">${view.undoAllowed !== false && view.moves > 0 ? `<button class="btn" data-undo>${ic('undo')}待った</button>` : ''}<button class="btn" data-go="menu">メニュー</button>${two ? `<button class="btn" data-again="${1 - lastSeat}">${mySeat === 0 ? '後手' : '先手'}でもう一度</button>` : ''}<button class="btn primary" data-again="${lastSeat}">もう一度</button></div></div>`;
  }
  { const waitMs = Math.max(0, animUntil - performance.now(), cutBusy - performance.now()); setTimeout(() => { if ($('#result') && view && view.outcome) $('#result').hidden = false; }, (S.set.cutin && !S.set.reduce ? 2300 : 200) + waitMs); }
}

// 盤の上の出来事(カットイン)
function detectEvents(a, b) {
  if (!a || !b || !b.board || !a.board) return;
  const k = b.board.kind;
  if ((k === 'shogi') && b.board.check && !a.board.check && !b.outcome) cut({ text: '王手', tone: 'red', font: 'wa', ms: 1200 });
  if (k === 'chess' && b.board.check && !a.board.check && !b.outcome) cut({ text: 'Check', tone: 'noir', font: 'yo', ms: 1200 });
  const info = (x) => (x.board && (x.board.info || '')) + '';
  // 革命: 卓の「革命中」の札と同じ印(tbl.rev)を見る。core は「革命」の字を info ではなく場の名前に入れるので、info では出なかった(2026-11-28 修正)
  if (cur.id === 'daifugo' && b.board.tbl && a.board.tbl && b.board.tbl.rev && !a.board.tbl.rev) cut({ text: '革命', tone: 'red', font: 'dela', ms: 1600 });
  if (cur.id === 'hanafuda' && /こいこい/.test(info(b)) && !/こいこい/.test(info(a))) cut({ text: 'こいこい', tone: 'felt', font: 'wa', ms: 1400 });
  if (k === 'yacht' && Array.isArray(b.board.sheets) && Array.isArray(a.board.sheets)) {
    for (let p = 0; p < b.board.sheets.length; p++) {
      const prevY = a.board.sheets[p] ? a.board.sheets[p][11] : -1;
      const nextY = b.board.sheets[p] ? b.board.sheets[p][11] : -1;
      if (prevY < 0 && nextY === 50) {
        yachtCutJust = true;
        cut({ text: `${seatName(p)} ヨット`, tone: 'gold', font: 'yo', ms: 1600, afterAnim: true, _tok: token });
      }
      // 数の目(1〜6)の合計が 63 に届いた時のボーナス(+35)
      const upper = (s) => Array.isArray(s) ? s.slice(0, 6).reduce((x, c) => x + Math.max(c, 0), 0) : 0;
      if (upper(a.board.sheets[p]) < 63 && upper(b.board.sheets[p]) >= 63) {
        yachtCutJust = true;
        cut({ text: `${seatName(p)} ボーナス +35`, tone: 'gold', font: 'yo', ms: 1600, afterAnim: true, _tok: token });
      }
    }
  }
  if (k === 'mahjong') {
    const nameOf = (p) => ({ name: seatName(p), av: p === mySeat ? meAv() : '' });
    for (let p = 0; p < 4; p++) if (b.board.riichi[p] != null && a.board.riichi[p] == null) cut({ who: nameOf(p), text: 'リーチ', tone: 'china', font: 'china', ms: 1300 });
    if (b.board.result && !a.board.result) { const r = b.board.result; const w = r.winners[0]; if (/ロン/.test(r.label)) cut({ who: nameOf(w), text: 'ロン', tone: 'china', font: 'china', ms: 1500 }); else if (/ツモ/.test(r.label)) cut({ who: nameOf(w), text: 'ツモ', tone: 'china', font: 'china', ms: 1500 }); }
  }
  if (cur.id === 'uno' && b.board.tbl && a.board.tbl) {
    const topId = (x) => { const z = x.board.zones && x.board.zones[0]; return z && z.cards[0] ? z.cards[0].id : -1; };
    const ta = topId(a), tb = topId(b);
    const mb = b.moves !== a.moves ? /^(\d+)枚出し/.exec(b.board.tbl.last || '') : null;
    const bundleCnt = mb ? +mb[1] : 1;
    if (tb >= 0 && (mb || (tb !== ta && Math.floor(tb / 10) !== Math.floor(ta / 10)))) {
      const card = Math.floor(tb / 10), k = card % 25, v = card >= 100 ? (card < 104 ? 13 : 14) : k === 0 ? 0 : (k + 1) >> 1;
      const COL = ['赤', '黄', '緑', '青'], chosen = tb % 10;
      const lm = b.board.tbl.lastMover, who = lm >= 0 ? { name: seatName(lm), av: lm === mySeat ? meAv() : '' } : null;
      const txt = { 10: 'スキップ', 11: 'リバース', 12: '+2', 13: 'ワイルド', 14: '+4' }[v];
      const tone = 'uno' + (v >= 13 && chosen < 4 ? chosen : Math.floor(card / 25));
      if (txt) {
        const label = bundleCnt > 1 ? `${txt} ×${bundleCnt}` : txt;
        cut({ afterAnim: true, _tok: token, who, text: label, sub: v >= 13 && chosen < 4 ? COL[chosen] : (bundleCnt > 1 ? `${bundleCnt}枚まとめ出し` : ''), tone, font: 'mo', ms: 1300 });
      } else if (bundleCnt > 1) {
        cut({ afterAnim: true, _tok: token, who, text: `${bundleCnt}枚まとめ出し`, tone, font: 'mo', ms: 1150 });
      }
      // +2・+4: 引くのは「次の人」(出した人の次)。重ね出しが無い時は、引いた人は 1 回休み
      if ((v === 12 || v === 14) && lm >= 0) {
        const tb2 = b.board.tbl, total = tb2.n.length, victim = (lm + tb2.dir + total) % total, n = (v === 12 ? 2 : 4) * bundleCnt;
        if (tb2.pending > 0) cut({ afterAnim: true, _tok: token, who: { name: seatName(victim), av: victim === mySeat ? meAv() : '' }, text: `${tb2.pending}枚引くか重ねる`, tone: 'red', font: 'mo', ms: 1300 });
        else cut({ afterAnim: true, _tok: token, who: { name: seatName(victim), av: victim === mySeat ? meAv() : '' }, text: `${n}枚引いて1回休み`, tone: 'red', font: 'mo', ms: 1400 });
      }
    }
  }
  // 最後の 1 枚が記号の札(ワイルドなど)で上がれない時は、引く理由を出す
  if (cur.id === 'uno' && b.human && b.board.zones && b.board.zones[1]) {
    const hand = b.board.zones[1].cards, c = hand[0];
    const isAct = (id) => { const card = Math.floor(id / 10), k = card % 25; return card >= 100 || (k !== 0 && ((k + 1) >> 1) >= 10); };
    if (hand.length === 1 && c && isAct(c.id) && c.m == null && !(c.opts && c.opts.length) && !(a.human && a.board.zones && a.board.zones[1] && a.board.zones[1].cards.length === 1))
      cut({ afterAnim: true, _tok: token, text: '記号の札では上がれません', sub: '山札から引いてください', tone: 'red', font: 'mo', ms: 2200 });
  }
  if (cur.id === 'uno' && b.board.tbl && a.board.tbl) {
    const ta = a.board.tbl, tb = b.board.tbl;
    // だれかが Oh, No! と言った
    if (tb.decl >= 0 && tb.decl !== ta.decl) cut({ afterAnim: true, _tok: token, who: { name: seatName(tb.decl), av: tb.decl === mySeat ? meAv() : '' }, text: 'Oh, No!', tone: 'red', font: 'mo', ms: 1300 });
    // 言い忘れ(通信対戦でも、札の情報から出す)
    if (tb.forgot >= 0 && (tb.forgot !== ta.forgot || b.moves !== a.moves)) cut({ afterAnim: true, _tok: token, who: { name: seatName(tb.forgot), av: tb.forgot === mySeat ? meAv() : '' }, text: 'Oh, No! って言ってない', sub: 'ペナルティ', tone: 'red', font: 'mo', ms: 3000 });
  }
}
const FONT_OF = (id) => (['shogi', 'gogo', 'go', 'gomoku', 'hanafuda'].includes(id) ? 'wa' : id === 'mahjong' ? 'china' : ['uno', 'sevens', 'memory', 'speed', 'daifugo', 'solitaire'].includes(id) ? 'mo' : 'yo');
let cutBusy = 0; const cutQ = [];
function cut(c) {
  if (c.onShow && !c._soundGuarded) { c.onShow = transientAudio.guard(c.onShow); c._soundGuarded = true; }
  if (!S.set.cutin || S.set.reduce) { if (c.onEnd) c.onEnd(); return; }
  const o = $('#cutlayer'); if (!o) return;
  // 前のカットインや、駒・札の動きが終わってから出す
  const wait = Math.max(cutBusy - performance.now(), c.afterAnim ? animUntil - performance.now() + 60 : 0);
  if (wait > 0 || (cutQ.length && cutQ[0] !== c)) { if (!cutQ.includes(c)) cutQ.push(c); setTimeout(() => { if (cutQ.includes(c)) cut(c); }, Math.max(40, Math.min(wait, 120))); return; }
  { const i = cutQ.indexOf(c); if (i >= 0) cutQ.splice(i, 1); }
  if (c._tok != null && c._tok !== token) { if (c.onEnd) c.onEnd(); return; }
  cutBusy = performance.now() + c.ms * SPEED() + 300;
  if (c.onShow) try { c.onShow(); } catch (e) {}
  document.documentElement.classList.add('cutting'); clearTimeout(cut._t); cut._t = setTimeout(() => document.documentElement.classList.remove('cutting'), c.ms * SPEED() + 200);
  const font = c.font || (cur ? FONT_OF(cur.id) : 'mo');
  const len = [...c.text].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 0.58 : 1), 0);
  const who = c.who;
  o.innerHTML = `<button class="cutin ${c.tone} f-${font} ${who && c.sub ? 'tall' : ''} ${c.soft ? 'soft' : ''}" aria-label="閉じる" tabindex="-1"><span class="veil"></span><span class="band"></span><span class="txt">${who ? `<span class="who">${who.av || ''}${esc(who.name)}</span>` : ''}<span class="mainl" style="font-size:min(${who || c.sub ? 12 : 17}cqh,${(82 / len).toFixed(1)}cqw)">${esc(c.text)}</span>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span></button>`;
  const el = o.firstChild; let done = false;
  const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 280); if (c.onEnd) try { c.onEnd(); } catch (e) {} };
  setTimeout(end, c.ms * SPEED());
}

// CPU のカーソル(打つ場所へ動かしてから打つ)
const cursorOn = () => S.set.cursor !== '表示しない' && !S.set.reduce && !isMob() && !isTouchDevice();
// 「あなたの番です」: 3 人以上の対局・手番ごとに交代・通信対戦で出す
// 「あなたの番です」の音: 自分の番になった時だけ鳴らし、他の人の手番開始時は鳴らさない
function sfxYourTurn() {
  if (!S.set.sound) return;
  const ax = uiCtx(); if (!ax) return;
  const v = Math.max(0, Math.min(1, (S.set.master / 100) * (S.set.sfxVol / 100)));
  [[784, 0], [1175, 0.13], [1568, 0.26]].forEach(([f, d]) => {
    const t = ax.currentTime + 0.02 + d, o = transientAudio.track(ax.createOscillator()), g = ax.createGain();
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(ax.destination); o.start(t); o.stop(t + 0.35);
  });
}
function turnCut(a, b) {
  if (!b || b.outcome || concurrent || !b.human || b.toMove < 0) return;
  if (online && isSeatAutoCpu(b.toMove)) return;
  // 同じ人の番が続いて見える時も、通信対戦で間に相手の手が入っていれば(手数が 2 以上進んだ)出す
  if (a && a.toMove === b.toMove && !(online && b.moves - a.moves >= 2)) return;
  const multi = online || mode === 'pass' || b.seats.length >= 3;
  if (!multi) return;
  const isSelfTurn = online
    ? (b.mine >= 0 && b.toMove === b.mine && !b.remote && !isSeatAutoCpu(b.toMove))
    : (mode === 'pass' ? b.toMove === 0 : (!!b.human && b.toMove === mySeat));
  if (!S.set.cutin || S.set.reduce) {
    if (isSelfTurn) transientAudio.later(() => { if (view && view.toMove === b.toMove && view.human && !view.outcome) sfxYourTurn(); }, a ? 800 : 1450);
    return;
  }
  const text = mode === 'pass' ? `${b.seats[b.toMove].name} の番です` : 'あなたの番です';
  turnPending = performance.now() + 6000;
  transientAudio.later(() => {
    if (view && view.toMove === b.toMove && view.human && !view.outcome) {
      cut({ text, tone: 'gold', ms: 900, soft: true, afterAnim: true, _tok: token, onShow: isSelfTurn ? sfxYourTurn : undefined, onEnd: () => { turnPending = 0; } });
    } else turnPending = 0;
  }, a ? 800 : 1450);
}
// カードを切る音のあとに、札を配る(卓の真ん中から順に)
function dealIntro() {
  const wrap = $('#boardwrap'); if (!wrap || S.set.reduce) return;
  const list = [...wrap.querySelectorAll('.pc, .pcard, .cd, .mjt')].filter((e) => !e.closest('.pinfo') && !e.matches('.slot, .empty'));
  if (!list.length) return;
  const r0 = wrap.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height * 0.42;
  // 神経衰弱は札が多いので、配る間を少し空け、音は横 1 列で 1 回・小さめに
  const mem = cur.id === 'memory', start = 950, step = mem ? 22.5 : Math.max(18, Math.min(55, 1600 / list.length));
  let rowTop = null;
  list.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    const scene = e.closest('.twelve-scene');
    const scale = scene ? scene.getBoundingClientRect().width / 900 : 1;
    const dx = (cx - (r.left + r.width / 2)) / scale, dy = (cy - (r.top + r.height / 2)) / scale;
    e.animate([{ transform: `translate(${dx}px,${dy}px) rotate(${(i % 2 ? 1 : -1) * 25}deg) scale(.7)`, opacity: 0 }, { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 1, offset: 0.05 }, { transform: 'none', opacity: 1 }],
      { duration: 300, delay: start + i * step, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    // 神経衰弱は横 1 列で 1 回だけ鳴らす
    const newRow = mem && (rowTop == null || Math.abs(r.top - rowTop) > r.height / 2); if (newRow) rowTop = r.top;
    const firstInPile = cur.id === 'solitaire' ? e.parentElement && e.parentElement.firstElementChild === e : mem ? newRow : i % 3 === 0;
    if (firstInPile) transientAudio.later(() => sfx.play('DEAL', { volume: mem ? 0.4 : 0.55 }), start + i * step);
  });
  animUntil = Math.max(animUntil, performance.now() + start + list.length * step + 300);
}
// CPU の手を、人と同じ操作に見せる(動かす駒をクリック → 行き先をクリック)。見せようのないゲームでは出さない
const NO_CURSOR = new Set(['uno', 'daifugo', 'sevens', 'poker', 'holdem', 'blackjack', 'hanafuda', 'mahjong', 'speed', 'solitaire', 'hitblow']);
function aimSteps(mv) {
  const b = view && view.board; if (!b || NO_CURSOR.has(cur.id)) return [];
  const W = $('#boardwrap'), q = (sel) => (sel ? W?.querySelector(sel) || $(sel) : null), seat = view.toMove;
  const btn = (re) => [...document.querySelectorAll('#acts button, #boardwrap [data-roll]')].find((x) => re.test(x.textContent) || (x.dataset.roll != null && re.test('roll')));
  if (window.TWELVE_HAS(b.kind)) return window.TWELVE_AIM(b,mv,seat,q,btn);
  switch (b.kind) {
    case 'shogi': { const N = b.w * b.w, f = (mv >> 1) >> 7, t = (mv >> 1) & 127; return [f >= N ? q(`.komadai.top [data-hand="${f - N}"]`) : q(`[data-i="${f}"]`), q(`[data-i="${t}"]`)]; }
    case 'c4': return [q(`.c4slot[data-col="${mv}"]`)];
    case 'reversi': case 'gomoku': case 'hex': return [q(`[data-i="${mv}"]`)];
    case 'go': return mv >= b.n * b.n ? [btn(mv === b.n * b.n ? /パス/ : /降参/)] : [q(`[data-i="${mv}"]`)];
    case 'mancala': return [q(`[data-pit="${mv}"]`)];
    case 'morris': return mv >= 1000 ? [q(`[data-i="${mv - 1000}"]`)] : mv >= 100 ? [q(`[data-i="${Math.floor((mv - 100) / 24)}"]`), q(`[data-i="${(mv - 100) % 24}"]`)] : [q(`[data-i="${mv}"]`)];
    case 'checkers': return (b.paths[mv] || []).map((i) => q(`[data-i="${i}"]`));
    case 'chess': return [q(`[data-i="${mv & 63}"]`), q(`[data-i="${(mv >> 6) & 63}"]`)];
    case 'dots': return [q(`[data-edge="${mv}"]`)];
    case 'hare': return [q(`[data-i="${Math.floor(mv / 11)}"]`), q(`[data-i="${mv % 11}"]`)];
    case 'chinese': return [q(`[data-i="${Math.floor(mv / 128)}"]`), q(`[data-i="${mv % 128}"]`)];
    case 'ludo': return mv === 0 ? [q('[data-roll]')] : [q(`[data-tok="${seat}-${mv - 1}"]`)];
    case 'backgammon': {
      if (mv === 0) return [q('[data-roll]')];
      if (mv < 1000) return [];
      const from = Math.floor((mv - 1000) / 10), die = (mv - 1000) % 10, white = seat === 0;
      const t = white ? (from === 24 ? 24 - die : from - die) : (from === 24 ? die - 1 : from + die);
      return [q(`[data-p="${from}"]`), t < 0 || t > 23 ? q('[data-off]') : q(`[data-p="${t}"]`)];
    }
    case 'yacht': if (mv >= 100) { const c = q(`[data-ycell="${seat}-${mv - 100}"]`); return [c, c]; }
      { const held = new Set([...W.querySelectorAll('.yd.held')].map((e) => +e.dataset.die)); return [...[0, 1, 2, 3, 4].filter((i) => b.rollsLeft < 3 && !!((mv >> i) & 1) !== held.has(i)).map((i) => q(`[data-die="${i}"]`)), q('[data-roll]')]; }
    case 'cards': return b.tbl && b.tbl.g === 'memory' ? [q(`[data-pos="${mv}"]`)] : [];
    case 'roulette': {
      if (mv < 1000) return [q(`[data-roulette-spot="${mv % 200}"]`)];
      if (mv < 2000) return [q(`[data-roulette-spot="${mv - 1000}"]`)];
      return [q(`[data-roulette-action="${mv}"]`)];
    }
    case 'life': return mv === 0 || (mv > 200 && mv < 211) ? [q('[data-spin]')] : [q(`[data-lm="${mv}"]`)];
    default: return [];
  }
}
async function runCursor(mv, my) {
  if (!view) return;
  if (view.board?.kind === 'roulette') {
    const beat = ROULETTE_CPU_BEAT[cpuPaceChoice()] || 500;
    const [target] = aimSteps(mv);
    const chip = mv < 1000 ? $(`[data-roulette-chip="${Math.floor(mv/200)}"]`) : null;
    const show = S.set.cursor !== '表示しない' && target;
    if (show) {
      target.classList.add('rq-cpu-target');
      chip?.classList.add('rq-cpu-denom');
      const area = target.closest('.k-roulette');
      if (area) {
        const a = area.getBoundingClientRect(), t = target.getBoundingClientRect();
        if (t.top < a.top || t.bottom > a.bottom) area.scrollTop += (t.top+t.bottom-a.top-a.bottom)/2;
      }
    }
    try {
      if (show && cursorOn()) await moveCpuCursor(seatName(view.toMove),[target],()=>my===token,beat/630,chip);
      else await new Promise(resolve=>setTimeout(resolve,beat));
    } finally {
      target?.classList.remove('rq-cpu-target');
      chip?.classList.remove('rq-cpu-denom');
    }
    return;
  }
  if (!cursorOn()) return;
  const choice = cpuPaceChoice();
  const f = usesExtraCpuPace(cur.id)
    ? ({短い:.75,ふつう:1,長い:1.25}[choice] || 1)
    : (PACE[choice] || 450) / 450 * Math.max(0.4, SPEED());
  await moveCpuCursor(seatName(view.toMove),aimSteps(mv),()=>my===token,f);
}
async function moveCpuCursor(name, targets, current, f = 1, origin = null) {
  if (!cursorOn() || !current()) return;
  const steps = targets.filter(Boolean).filter((e, i, l) => i === 0 || e !== l[i - 1]); if (!steps.length) return;
  const stage = $('.stage'); if (!stage) return;
  const r0 = stage.getBoundingClientRect();
  let c = $('#cpuCur');
  const zoom = r0.width / stage.offsetWidth || 1;
  if (!c) {
    stage.insertAdjacentHTML('beforeend', rcurHtml('cpuCur', name, '#C8463C', true));
    c = $('#cpuCur');
    const start = origin?.getBoundingClientRect();
    const x = start ? start.left + start.width/2 - r0.left : r0.width/2;
    const y = start ? start.top + start.height/2 - r0.top : r0.height+20;
    c.style.transform = `translate(${x/zoom}px,${y/zoom}px)`;
    c.getBoundingClientRect();
  }
  c.style.transitionDuration = Math.round(420 * f) + 'ms';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let k = 0; k < steps.length; k++) {
    const el = steps[k]; if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const quick = el.matches('.yd') ? 0.4 : 1; c.style.transitionDuration = Math.round(420 * f * quick) + 'ms';
    c.style.transform = `translate(${(r.left - r0.left + r.width * 0.5)/zoom}px,${(r.top - r0.top + r.height * 0.5)/zoom}px)`;
    await wait(470 * f * quick); if (!current() || !c.isConnected) return;
    c.classList.remove('click'); void c.offsetWidth; c.classList.add('click');
    sfxClick();
    // 動かす駒を選んだ印
    if (el.matches('.yd')) el.classList.toggle('held');
    else if (k < steps.length - 1 && steps[k + 1] !== el) { const ring = document.createElement('div'); ring.className = 'aimring'; Object.assign(ring.style, { left: r.left - r0.left + 'px', top: r.top - r0.top + 'px', width: r.width + 'px', height: r.height + 'px' }); stage.appendChild(ring); }
    await wait((k === steps.length - 1 ? 160 : el.matches('.yd') ? 90 : 230) * f); if (!current() || !c.isConnected) return;
  }
}
function sfxClick() { if (!S.set.sound || !S.set.hover || !AX || !transientAudio.allowed()) return; try { const t = AX.currentTime, o = transientAudio.track(AX.createOscillator()), g = AX.createGain(); o.type = 'square'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.012); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.04); } catch (e) {} }
const hideCursor = () => { const c = $('#cpuCur'); if (c) c.remove(); document.querySelectorAll('.aimring').forEach((e) => e.remove()); };
const rcurHtml = (id, name, color, turn) => `<div class="rcur ${turn ? 'turn' : ''}" id="${id}" style="--cc:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l15 8.500-6.500 1.800L9.500 20z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="tag"><i>${esc(name[0])}</i>${esc(name)}</span></div>`;

// ---------------------------------------------------------------- 成績
function records() {
  const stats = store.get('stats', {});
  const games = ORDER.map(id => ({g:gInfo(id), vs:stats['vs_'+id] || [0,0,0], solo:stats['solo_'+id] || [0]})).filter(row=>row.g);
  const played = row => row.vs.reduce((a,b)=>a+b,0) + row.solo[0] > 0;
  const rows = list => list.map(({g,vs,solo})=>{
    const total=vs[0]+vs[1]+vs[2], count=total+solo[0];
    return `<tr data-record-game="${g.id}"><th scope="row"><div class="record-game"><span class="record-art" aria-hidden="true">${artOf(g.id)}</span><span>${esc(g.name)}${solo[0]?`<small>ひとりで ${solo[0]}回</small>`:''}</span></div></th>${count?`<td class="num">${vs[0]}</td><td class="num">${vs[1]}</td><td class="num">${vs[2]}</td><td class="num">${total?Math.round(vs[0]/total*100)+'%':'—'}</td>`:'<td colspan="4" class="unplayed-label">未プレイ</td>'}</tr>`;
  }).join('');
  const done=games.filter(played),fresh=games.filter(row=>!played(row));
  return `<div class="screen">${rail('records')}<div class="main"><h2 class="pagehead">成績</h2><div class="panel tablescroll record-list"><table class="rec"><thead><tr><th>ゲーム</th><th>勝ち</th><th>負け</th><th>引き分け</th><th>勝率</th></tr></thead>${done.length?`<tbody>${rows(done)}</tbody>`:''}${fresh.length?`<tbody class="unplayed-games"><tr class="record-group"><th colspan="5" scope="colgroup">未プレイ (${fresh.length})</th></tr>${rows(fresh)}</tbody>`:''}</table></div></div></div>`;
}

// ---------------------------------------------------------------- 設定
const SCAT = [['game', '対局'], ['view', '表示'], ['sound', 'サウンド'], ['ctrl', '操作'], ['prof', 'プロフィール'], ['data', 'データ'], ['about', 'アプリについて']];
const KEYNAME = { back: '戻る', full: '全画面', undo: '待った', chat: 'チャットを送る', bgm: 'BGM 再生/一時停止', mute: '消音' };
const SDEF = {
  game: [['置ける場所の表示', 'sw', 'hints'], ['取れる駒の表示', 'sw', 'caps'], ['仮置きする', 'sw', 'pre'], ['CPUの強さ', 'seg', 'cpuLv', LV], ['CPUの手番の長さ', 'seg', 'cpuLen', ['短い', 'ふつう', '長い']], ['相手のカーソル', 'seg', 'cursor', ['表示しない', '手番のみ', '全員']], ['カットイン', 'sw', 'cutin'], ['アニメーションの速度', 'seg', 'speed', ['ゆっくり', 'ふつう', '速い']]],
  view: [['テーマ', 'theme'], ['画面', 'seg', 'win', ['ウィンドウ', '全画面']], ['ウィンドウの大きさ', 'sel', 'res', ['1280×720', '1366×768', '1600×900', '1920×1080', '2560×1440']], ['文字と部品の大きさ', 'seg', 'scale', ['100%', '125%', '150%']], ['盤の質感', 'seg', 'look', ['軽量', '標準']], ['アニメーションの省略', 'sw', 'reduce'], ['チャットの通知', 'sw', 'notify']],
  sound: [['全体の音量', 'rng', 'master'], ['効果音', 'sw', 'sound'], ['効果音の音量', 'rng', 'sfxVol'], ['カーソル音', 'sw', 'hover'], ['チャットの通知音', 'sw', 'chatSnd'], ['BGM', 'sw', 'bgm'], ['BGMの音量', 'vol'], ['無効のBGM', 'btn', '選ぶ', 'data-modal="bgmoff"'], ['バックグラウンドでも音を鳴らす', 'sw', 'bgSound']],
  ctrl: Object.keys(KEYNAME).map((k) => [KEYNAME[k], 'key', k]).concat([['駒の動かし方', 'seg', 'drag', ['クリック', 'ドラッグ', '両方']], ['キーコンフィグ（ゲームパッド）', 'padcfg']]),
  prof: [['表示名', 'name'], ['アイコン', 'icon']],
  data: [['途中の対局', 'btn', 'すべて消す', 'data-clear="saved"'], ['成績', 'btn', '消す', 'data-clear="stats"'], ['保存の場所', 'btn', 'フォルダを開く', 'data-openfolder'], ['設定', 'btn', '初期設定に戻す', 'data-clear="set"']],
  about: [['版', 'txt', APP_VERSION], ['ライセンス', 'btn', '開く', 'data-modal="license"']],
};
function setRow([l, t, k, x]) {
  const th = { auto: '端末に合わせる', light: 'ライト', dark: 'ダーク' }; let c = '';
  if (t === 'sw') c = sw(k, S.set[k]);
  else if (t === 'seg') c = seg(k, x, S.set[k]);
  else if (t === 'sel') { const op = ddOpen === k, v = String(S.set[k]);
    c = `<span class="ctl dd${op ? ' open' : ''}"><button class="ddbtn" data-dd="${k}" aria-haspopup="listbox" aria-expanded="${op}" aria-label="${l}"><span>${esc(v)}</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>${op ? `<div class="ddlist" role="listbox">${x.map((o) => `<button class="ddopt${o === v ? ' on' : ''}" role="option" aria-selected="${o === v}" data-ddk="${k}" data-ddv="${o}">${o}${o === v ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</button>`).join('')}</div>` : ''}</span>`; }
  else if (t === 'theme') c = seg('theme', Object.entries(th), S.theme);
  else if (t === 'rng') c = `<span class="ctl"><input type="range" data-rng="${k}" min="0" max="100" value="${S.set[k]}" style="flex:1" aria-label="${l}"></span>`;
  else if (t === 'vol') c = `<span class="ctl"><input type="range" id="volIn" min="0" max="100" value="${Math.round(S.vol * 100)}" style="flex:1" ${S.set.bgm ? '' : 'disabled'} aria-label="${l}"></span>`;
  else if (t === 'btn') c = `<span class="ctl"><button class="btn" style="height:38px;flex:1" ${x || ''} ${k === 'フォルダを開く' && !window.__TAURI__ ? 'disabled' : ''}>${k}</button></span>`;
  else if (t === 'key') c = `<span class="ctl"><kbd>${esc(keyLabel(S.keys[k]))}</kbd><button class="btn" style="height:38px;margin-left:auto" data-rekey="${k}">${S.rekey === k ? 'キーを押す…' : '変える'}</button></span>`;
  else if (t === 'padcfg') c = `<span class="ctl"><button class="btn" style="height:38px;flex:1" data-padcfg>開く</button></span>`;
  else if (t === 'img') c = `<span class="ctl"><img src="${k}" alt="" width="72" height="72" style="margin:6px auto"></span>`;
  else if (t === 'txt') c = `<span class="ctl"><b class="num" style="flex:1;text-align:center">${k}</b></span>`;
  else if (t === 'name') c = `<span class="field"><input id="nameIn" value="${esc(S.set.name)}" maxlength="12" placeholder="あなた" aria-label="表示名"></span>`;
  else if (t === 'icon') c = `<span class="ctl">${meAv()}<button class="btn" style="height:38px;flex:1" data-modal="avatar">選ぶ</button></span>`;
  const sub = l === '保存の場所' ? `<small class="sub path">${esc(S.dataPath || (window.__TAURI__ ? '' : 'このブラウザの中(localStorage)'))}</small>` : '';
  return `<div class="row"><span>${l}${sub}</span>${c}</div>`;
}
if (window.__TAURI__) window.__TAURI__.core.invoke('data_folder_path').then((p) => { S.dataPath = p; if (S.screen === 'settings') render(); }).catch(() => {});
const keyLabel = (k) => String(k).replace('Escape', 'Esc');
function playSettingsPanel() {
  return `<h3>${SCAT.find(([key]) => key === S.scat)[1]}</h3>${SDEF[S.scat].map(setRow).join('')}`;
}
function switchPlaySettingsTab(tab) {
  if (S.scat === tab) return;
  S.scat = tab;
  S.rekey = null;
  ddClose();
  const settings = $('#playsettings');
  for (const button of settings.querySelectorAll('[data-scat]')) {
    if (button.dataset.scat === tab) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
  const panel = settings.querySelector('.setpanel');
  panel.innerHTML = playSettingsPanel();
  panel.scrollTop = 0;
}
function openPlaySettings() {
  if (!['play','slidePlay','bunyoPlay','pakurisPlay','minePlay','wolfPlay','extraPlay'].includes(S.screen)) return;
  openSheet(`<div id="playsettings"><div class="mhd"><h3>設定</h3><button class="btn" data-playsettingsclose aria-label="設定を閉じる">閉じる</button></div><div class="setwrap"><div class="setcats">${SCAT.map(([k,n])=>`<button data-scat="${k}" ${S.scat===k?'aria-current="true"':''}>${n}</button>`).join('')}</div><div class="panel setpanel">${playSettingsPanel()}</div></div></div>`);
  $('#sheet').classList.add('play-settings-dialog');
  $('#sheet').setAttribute('aria-label','設定');
}
function settings() {
  return `<div class="screen">${rail('settings')}<div class="main"><div class="pagehead2"><button class="btn" data-go="menu" aria-label="戻る">${ic('back')}</button><h2 class="pagehead">設定</h2></div><div class="setwrap">
   <div class="setcats">${SCAT.map(([k, n]) => `<button data-scat="${k}" ${S.scat === k ? 'aria-current="true"' : ''}>${n}</button>`).join('')}</div>
   <div class="panel setpanel"><h3>${SCAT.find((c) => c[0] === S.scat)[1]}</h3>${SDEF[S.scat].map(setRow).join('')}</div>
  </div></div></div>`;
}
function bgmOffModal() {
  return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox" role="dialog" aria-label="無効のBGM"><div class="mhd"><h3>無効のBGM</h3><button class="btn gold" data-mclose style="height:38px;width:110px">完了</button></div>
  <div class="mbody">${['mn', 'wa', 'yo', 'ch'].map((g) => `<h4>${GEN[g]}</h4><div class="offl">${Object.keys(TR).filter((k) => TR[k].g === g).map((k) => `<div class="offr ${S.off.includes(k) ? 'x' : ''}"><button class="pv ${PV === k ? 'on' : ''}" data-pv="${k}" title="試聴" aria-label="試聴">${ic(PV === k ? 'pause' : 'play')}</button><span>${TR[k].name}</span>${sw('off:' + k, !S.off.includes(k))}</div>`).join('')}</div>`).join('')}</div></div></div>`;
}
function licenseModal() {
  return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox" role="dialog" aria-label="ライセンス"><div class="mhd"><h3>ライセンス</h3><button class="btn gold" data-mclose style="height:38px;width:110px">完了</button></div><div class="mbody lic" id="licbody">読み込んでいます…</div></div></div>`;
}
async function fillLicenses() {
  const b = $('#licbody'); if (!b) return;
  try { const t = await (await fetch('licenses.html')).text(); b.innerHTML = t; } catch (e) { b.textContent = 'ライセンスを読み込めませんでした'; }
}
function rulesModal() {
  return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox wide" role="dialog" aria-label="ルール"><div class="mhd"><h3>${esc(gInfo(S.rulesId).name)}のルール</h3><button class="btn gold" data-mclose style="height:38px;width:110px">完了</button></div><div class="mbody rules" id="rulesbody">読み込んでいます…</div></div></div>`;
}
async function fillRules() {
  const b = $('#rulesbody'); if (!b) return;
  const id = S.rulesId;
  // 1 つのゲームに 2 種類の説明がある物(ソリティア=クロンダイク/スパイダー、マインスイーパー=ふつう/対戦)は、上の切り替えで選ぶ
  const tabs = RULE_VARIANTS[id];
  const vkey = tabs ? ((S.ruleVar || {})[id] || (id === 'solitaire' && S.screen === 'play' && view?.board?.variant === 'spider' ? 'spider' : id === 'mine' && S.sel === 'mineVersus' ? 'mineVersus' : tabs[0][0])) : id;
  const vs = window.RULE_STEPS && window.RULE_STEPS[vkey];
  if (vs) return fillRuleSteps(b, vs, tabs && `<div class="seg rs-tabs">${tabs.map(([k, n]) => `<button type="button" data-rvar="${k}" aria-pressed="${k === vkey}">${n}</button>`).join('')}</div>`, id);
  const secs = EXTRA_GAME_RULES[id] || JSON.parse(await callW('rulesJson', id));
  b.innerHTML = secs.length ? RULES.html(id, secs) : '<p>ルールの説明はまだありません</p>';
  RULES.start(b);
}
// 動画つきのルール(上段: 左にステップ・右に動画。終わったら次のステップへ。下に 補足 → ローカルルール → コツ)。文面は js/rules-steps.js
const RULE_VARIANTS = { solitaire: [['solitaire', 'クロンダイク'], ['spider', 'スパイダー']], mine: [['mine', 'ふつう'], ['mineVersus', '対戦']] };
function fillRuleSteps(b, vs, tabsHtml = '', gid = '') {
  const reduce = document.documentElement.classList.contains('reduce');
  b.innerHTML = `${tabsHtml}<div class="rs-top"><div class="rs-steps">${vs.steps.map((s, i) => `<button type="button" class="rs-step" data-rstep="${i}" aria-pressed="${i === 0}"><b>${esc(s.t)}</b><span>${esc(s.d)}</span></button>`).join('')}</div>
    <div class="rs-stage"><video class="rs-vid" muted playsinline controls preload="auto"></video></div></div>
    ${vs.secs.map((c) => `<section class="rs-sec${c.h === 'コツ' ? ' tip' : ''}"><h4>${esc(c.h)}</h4><div class="rs-body">${c.html}</div></section>`).join('')}`;
  const v = b.querySelector('.rs-vid'), btns = [...b.querySelectorAll('[data-rstep]')];
  const play = (i, auto = true) => {
    btns.forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
    v.dataset.i = i; v.src = 'assets/rule-steps/' + vs.steps[i].src;
    if (auto && !reduce) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  };
  btns.forEach((x, i) => { x.onclick = () => play(i); });
  b.querySelectorAll('[data-rvar]').forEach((x) => { x.onclick = () => { (S.ruleVar = S.ruleVar || {})[gid] = x.dataset.rvar; fillRules(); }; });
  v.addEventListener('ended', () => { const n = +v.dataset.i + 1; if (n < vs.steps.length) play(n); });
  // 動画を読み込めない時(オフラインなど)は、動画の欄を消して、ステップの文だけの説明にする
  v.addEventListener('error', () => { b.querySelector('.rs-top').classList.add('rs-novid'); });
  play(0);
}
function listModal() {
  return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox" role="dialog"><div class="mhd"><h3>${/shogi|gogo|chess/.test(cur.id) ? '駒の一覧' : '役の一覧'}</h3><button class="btn gold" data-mclose style="height:38px;width:110px">完了</button></div><div class="mbody rules" id="listbody">読み込んでいます…</div></div></div>`;
}
async function fillList() {
  const b = $('#listbody'); if (!b) return;
  const secs = JSON.parse(await callW('rulesJson', cur.id));
  b.innerHTML = RULES.list(cur.id, secs); RULES.start(b);
}

// ---------------------------------------------------------------- 画面を描く
let lastScreen = null, lastScreenFocus = null;
try { ['Kaisei Tokumin', 'Shippori Mincho B1', 'Cinzel', 'Zen Antique', 'Dela Gothic One', 'Yuji Boku', 'Zen Maru Gothic'].forEach((f) => document.fonts.load(`900 40px "${f}"`, 'あ王手A')); } catch (e) {}
let lastModal = null;
// 自作のプルダウン(角の丸い選択肢)。開いている項目の名前
let ddOpen = null;
function ddClose(focusBtn) { const k = ddOpen; if (!k) return; ddOpen = null; const w = $(`.dd.open`); if (w) { w.classList.remove('open'); const l = w.querySelector('.ddlist'); if (l) l.remove(); const b = w.querySelector('.ddbtn'); b.setAttribute('aria-expanded', 'false'); if (focusBtn) b.focus({ preventScroll: true }); } }
function render() {
  if (lastScreen === 'play' && S.screen !== 'play' && cur?.id === 'roulette') {
    window.RENDER.roulette?.leave?.();
    animUntil = 0;
  }
  if (!['play','slidePlay','bunyoPlay','pakurisPlay','minePlay','wolfPlay','extraPlay'].includes(S.screen)) document.querySelectorAll('.rcur.live').forEach(e=>e.remove());
  const keepPlaySettings = ['play','slidePlay','bunyoPlay','pakurisPlay','minePlay','wolfPlay','extraPlay'].includes(S.screen) && !!$('#playsettings');
  document.documentElement.classList.toggle('lite', S.set.look === '軽量');
  document.documentElement.classList.toggle('reduce', !!S.set.reduce);
  { const z = S.set.scale === '100%' ? 1 : parseInt(S.set.scale, 10) / 100; document.body.style.zoom = z === 1 ? '' : z;
    // 拡大した時も、画面からはみ出さないように(モバイル幅ではスクロールを妨げない)
    const mob = isMob();
    document.body.style.height = (z === 1 || mob) ? '' : (100 / z) + 'vh'; document.body.style.width = (z === 1 || mob) ? '' : (100 / z) + 'vw'; }
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = S.theme;
  const screens = { first, menu, setup, play, settings, records, room, slideSetup:slideGame.setupHtml, slidePlay:slideGame.playHtml, bunyoSetup:bunyoGame.setupHtml, bunyoPlay:bunyoGame.playHtml, pakurisSetup:pakurisGame.setupHtml, pakurisPlay:pakurisGame.playHtml, mineSetup:minesGame.setupHtml, minePlay:minesGame.playHtml, wolfSetup:wolfGame.setupHtml, wolfPlay:wolfGame.playHtml, poetSetup:poetCards.setupHtml, munageSetup:munageGame.setupHtml, extraPlay:boardMatch.playHtml };
  if (S.screen === 'setup' && !gInfo(S.setup.id)) S.screen = 'menu';
  const fa = document.activeElement, fKey = fa && fa !== document.body && app.contains(fa) ? Object.entries(fa.dataset).slice(0, 2).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${CSS.escape(v)}"]`).join('') : '';
  const oldMain = $('.main'), keepTop = oldMain && lastScreen === S.screen ? oldMain.scrollTop : null;
  const oldBody = $('.setupbody'), keepBody = oldBody && lastScreen === S.screen ? oldBody.scrollTop : null;
  // 出ているカットインは、描き直しで消さない(クリックで飛ばされないように)
  const keepCut = ['play','slidePlay','bunyoPlay','pakurisPlay','minePlay','wolfPlay','extraPlay'].includes(S.screen) && $('#cutlayer') && $('#cutlayer').firstChild ? $('#cutlayer').firstChild : null;
  app.innerHTML = (screens[S.screen] || menu)();
  if (keepCut && $('#cutlayer')) $('#cutlayer').appendChild(keepCut);
  if (typeof keepStampScroll === 'function') keepStampScroll();
  const newMain = $('.main'); if (newMain) newMain.scrollTop = keepTop != null ? keepTop : ((S.scrollMem || {})[S.screen] || 0);
  const newBody = $('.setupbody'); if (newBody && keepBody != null) newBody.scrollTop = keepBody;
  if (lastScreen !== S.screen && isMob()) window.scrollTo(0, 0);
  if (lastScreen !== S.screen && S.screen === 'menu' && S.sel && !isMob()) { const t = $(`[data-tile="${S.sel}"]`); if (t) t.scrollIntoView({ block: 'nearest' }); }
  if (lastScreen !== S.screen) { const sc = app.querySelector('.screen.col'); if (sc) sc.classList.add('enter'); }
  if (lastScreen !== S.screen && /^(menu|room|records|settings)$/.test(S.screen) && lastScreen && lastScreen !== 'first') { const m = $('.main'); if (m) m.classList.add('enter'); }
  if (S.filterChanged && S.screen === 'menu') { S.filterChanged = false; const m = $('.main'); if (m) m.classList.add('filter-enter'); const fb = $('.rail-filter .seg button[aria-pressed="true"]'); if (fb) fb.classList.add('filter-pop'); }
  lastScreen = S.screen;
  if (S.focusSel) { const f = $(S.focusSel); S.focusSel = null; if (f) f.focus({ preventScroll: true }); }
  else if (fKey && lastScreenFocus === S.screen) { const f = $(fKey); if (f) f.focus({ preventScroll: true }); }
  lastScreenFocus = S.screen;
  if (keepPlaySettings) openPlaySettings();
  if (S.modal === 'bgmoff') app.insertAdjacentHTML('beforeend', bgmOffModal());
  if (S.modal === 'avatar') app.insertAdjacentHTML('beforeend', avatarModal());
  if (S.modal === 'license') { app.insertAdjacentHTML('beforeend', licenseModal()); fillLicenses(); }
  if (S.modal === 'rules') { app.insertAdjacentHTML('beforeend', rulesModal()); fillRules(); }
  if (S.modal === 'list') { app.insertAdjacentHTML('beforeend', listModal()); fillList(); }
  if (S.modal === 'padcfg') { app.insertAdjacentHTML('beforeend', PADCFG.modalHtml()); PADCFG.paintPad(); }
  // 窓を開いた時だけ、ふわっと出す(中身の描き直しでは出し直さない)
  if (S.modal && S.modal !== lastModal) { const m = app.querySelector(':scope > .modal:last-of-type'); if (m) m.classList.add('pop'); }
  lastModal = S.modal;
  if (S.screen === 'play') { if (view) drawPlay(true); if (view && view.outcome) showResult(); }
  if (S.screen === 'slidePlay') slideGame.side();
  if (S.screen === 'minePlay') minesGame.mounted();
  if (S.screen === 'wolfPlay') wolfGame.update();
  if (S.screen === 'extraPlay') boardMatch.draw();
  if (S.screen === 'room') afterRoom();
  if (typeof syncPublicRoomsWatch === 'function') syncPublicRoomsWatch();
  const log = $('#log'); if (log) log.scrollTop = log.scrollHeight;
  bgmSync();
  syncAppHistory();
}

// ---------------------------------------------------------------- シート(小さな確認の窓)
// アプリを終了する前の確認(メニューの「終了する」と、ウィンドウ・タスクバーの ×)
function askQuitApp() {
  if ($('#qaYes')) return; // もう出ている
  setTimeout(focusPrimary, 0); openSheet('<h2>アプリを終了しますか</h2><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="qaYes">終了する</button></div>'); $('#qaYes').onclick = () => { closeSheet(); if (window.__TAURI__) window.__TAURI__.core.invoke('quit_app').catch(() => window.close()); else { window.close(); setTimeout(() => toast({ w: 'お知らせ', t: '閉じられませんでした。ウィンドウの × で閉じてください' }), 300); } };
}
function openSheet(html) {
  const prev = $('#sheetwrap'); if (prev) prev.remove();
  app.insertAdjacentHTML('beforeend', `<div class="modal pop" id="sheetwrap"><button class="mback" data-sheetback aria-label="閉じる"></button><div class="mbox sheet" id="sheet" role="dialog">${html}</div></div>`);
  syncAppHistory();
}
function closeSheet() {
  const s = $('#sheetwrap');
  if (s) { s.remove(); syncAppHistory(); }
}
function focusPrimary() { setTimeout(() => { const b = $('#sheet .btns .btn:last-child') || $('#sheet .btn.gold'); if (b) b.focus({ preventScroll: true }); }, 0); }
/* シングルプレイ中だけ、シート(設定・終了確認など)やモーダルを開いている間は対局を一時停止する。
   通信対戦(online)では止めない。各ゲームの進行側(時計・CPU・落下・タイマー)がこれを見て待つ */
function modalPause() { return !online && (!!S.modal || !!$('#sheetwrap')); }

// ---------------------------------------------------------------- 操作
function openLocalSetup(id, clickCount) {
  if (newGameSetup[id]) return newGameSetup[id](false);
  if (clickCount === 0) S.focusSel = '[data-start]';
  S.setup = { id, online: false };
  return go('setup');
}
function startGame() {
  if (S.setup.online) return onlineChooseAndStart();
  startMatch(null);
}
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  clickSound(b, d);
  const mineSwapped = (d.extraMine != null || d.mineCell != null) && minesGame.personal.swapButtons &&
    e.detail > 0 && e.pointerType !== 'touch' && e.pointerType !== 'pen';
  if (mineSwapped && d.extraMine != null) return boardMatch.send('flag',{cell:+d.extraMine});
  if (d.extraExit != null) return boardMatch.exit();
  if (Object.keys(d).some(key=>key.startsWith('extra'))) return boardMatch.button(d);
  if (d.poetStart != null) return poetCards.start();
  if (d.munageStart != null) return munageGame.start();
  if (d.mineVsStart != null) return mineVersus.start();
  if (d.mineVsReset != null) return mineVersus.reset();
  if (d.wolfStart != null) return wolfGame.start();
  if (d.wolfExit != null) return wolfGame.exit();
  if (d.wolfAct != null) return wolfGame.act();
  if (d.wolfTarget != null && S.screen==='wolfPlay') return wolfGame.chooseTarget(d.wolfTarget);
  if (d.wolfHelp && S.screen==='wolfPlay') return wolfGame.help();
  if (d.wolfStamp != null && S.screen==='wolfPlay') return wolfGame.stamp(+d.wolfStamp);
  if (d.slideTile != null) return slideGame.move(d.slideTile);
  if (d.slideExit != null) return slideGame.exit();
  if (d.slideGuide != null) return slideGame.showGuide();
  if (d.slideStart != null) return slideGame.start();
  if (d.slidePicture != null) {slideGame.picture=d.slidePicture;return render();}
  if (d.fallingAgain != null) return fallingMatch.again();
  if (d.bunyoStart != null) return bunyoGame.start();
  if (d.bunyoExit != null) return fallingMatch.exit('bunyo');
  if (d.bunyo != null) return bunyoGame.action(d.bunyo);
  if(d.pakurisStart!=null)return pakurisGame.start();
  if(d.pakurisExit!=null)return fallingMatch.exit('pakuris');
  if(d.pakuris!=null)return pakurisGame.action(d.pakuris);
  if(d.mineStart!=null)return minesGame.start();
  if(d.mineExit!=null)return minesGame.exit();
  if(d.mineUndo!=null)return minesGame.requestUndo();
  if(d.mineAgain!=null)return minesGame.start();
  if(d.mineZoomreset!=null)return minesGame.resetZoom();
  if(d.mineCell!=null)return minesGame.move(+d.mineCell, mineSwapped || minesGame.flagMode);
  if (d.padsetup != null) return PADCFG.open(d.padsetup);
  if (d.padcfg != null) return PADCFG.open(PADCFG.currentGame());
  if (d.playsettings != null) return openPlaySettings();
  if (d.playsettingsclose != null) { closeSheet(); return; }
  if (d.chatfab != null) return togglePlayChat();
  if (d.chatclose != null) return togglePlayChat(false);
  if (d.sheetback != null) return closeSheet();
  if (d.detailopen != null) { S.mobDetail = true; return render(); }
  if (d.detailclose != null) { S.mobDetail = false; return render(); }
  if (d.dd) { if (ddOpen === d.dd) return ddClose(true); ddOpen = d.dd; S.focusSel = `.ddopt.on`; return render(); }
  if (d.ddv != null) { const k = d.ddk; S.set[k] = d.ddv; saveSet(); if (k === 'res') setWinSize(d.ddv); ddOpen = null; S.focusSel = `[data-dd="${k}"]`; return render(); }
  if (d.go && S.screen === 'play' && !b.closest('.rbox')) return goBack();
  if (d.go) { if (d.go === 'room' && S.screen === 'play' && online) { leavePlay(); S.screen = 'room'; S.mobDetail = false; return render(); } return go(d.go); }
  if (d.quitapp != null) return askQuitApp();
  if (d.goprof != null) { S.scat = 'prof'; return go('settings'); }
  if (d.tile && (wolfGame.active() || boardMatch.active())) { S.sel=d.tile; return render(); }
  // スマホ: 1回目のタップは枠のハイライトだけ(希望はほかの人にも見える)。同じゲームをもう1回タップで説明を出す
  if (d.tile && roomChoosing()) { const again = S.sel === d.tile; S.sel = d.tile; chooseWish(d.tile); if (isMob()) S.mobDetail = again; return render(); }
  if (d.tile) {
    const id = d.tile;
    if (isMob()) {
      if (S.sel === id && S.mobDetail && playable(id)) { return openLocalSetup(id, e.detail); }
      S.sel = id; S.mobDetail = true; return render();
    }
    if ((S.sel === id || e.detail === 0) && playable(id)) { return openLocalSetup(id, e.detail); }
    S.sel = id; S.focusSel = `[data-tile="${id}"]`; return render();
  }
  if (d.next != null && roomChoosing()) { if (isHostRoom() && (ost.members.length >= 2 || isSoloInRoom())) chooseOnline(S.sel); return; }
  if (d.next != null) { return openLocalSetup(S.sel, e.detail); }
  if (d.resume != null) return resume(savedList()[+d.resume]);
  if (d.start != null) return startGame();
  if (d.again != null) { const p = $('#result'); if (p) p.hidden = true; return startMatch(+d.again); }
  if (d.piece != null) { RULES.setPiece(+d.piece); if (S.modal === 'rules') fillRules(); else fillList(); return; }
  if (d.rule) { S.rulesId = d.rule; S.modal = 'rules'; return render(); }
  if (d.list != null) { S.modal = 'list'; return render(); }
  if (d.undo != null) return doUndo();
  if (d.resign != null) return askResign();
  if (d.pstep) { const g = gInfo(S.setup.id), c = cfg(g.id), ps = g.options.find((o) => o.key === 'players'); const i = Math.max(0, ps.values.findIndex(([v]) => v === c.opts.players)) + +d.pstep; if (ps.values[i]) { c.opts.players = ps.values[i][0]; saveCfg(g.id, c); syncOnlineOptions(); } return render(); }
  if (d.hstep) { const c = cfg(S.setup.id); c.humans = Math.max(2, c.humans + +d.hstep); saveCfg(S.setup.id, c); return render(); }
  if (d.modal) { S.modal = d.modal; return render(); }
  if (d.mclose != null || d.mback != null) { S.modal = null; if (PV) { PV = null; bgmStop(); if (S.set.bgm) bgmPick(); } return render(); }
  if (d.pv) { if (PV === d.pv) { PV = null; bgmStop(); if (S.set.bgm) bgmPick(); } else { PV = d.pv; bgmPlay(d.pv, 0, true); } return render(); }
  if (d.scat && $('#playsettings')) return switchPlaySettingsTab(d.scat);
  if (d.scat) { const ch = S.scat !== d.scat; S.scat = d.scat; S.rekey = null; render(); if (ch) { const p = $('.setpanel'); if (p) p.classList.add('enter'); } return; }
  if (d.av != null) { S.set.av = d.av === 'photo' ? 'photo' : +d.av < 0 ? null : +d.av; saveSet(); if (typeof pushMyProfile === 'function') pushMyProfile(); return render(); }
  if (d.rekey) { S.rekey = S.rekey === d.rekey ? null : d.rekey; return render(); }
  if (d.clear) return askClear(d.clear);
  if (d.openfolder != null) return openDataFolder();
  if (d.firstdone != null) { S.set.name = ($('#nameIn') && $('#nameIn').value.trim()) || S.set.name; saveSet(); store.set('firstDone', true); return go('menu'); }
  if (d.photo != null) return pickPhoto();
  if (d.stopen != null) { S.stOpen = !S.stOpen; if ($('.side #chatf, #chatpop #chatf')) return refreshChat(); return render(); }
  if (d.stamp != null) { S.stOpen = false; return sendChat(null, +d.stamp); }
  if (d.sw) {
    if (d.sw.startsWith('mine:')) {
      const key = d.sw.slice(5);
      minesGame.setPersonal(key,!minesGame.personal[key]);
      return render();
    }
    if (d.sw.startsWith('mineVs:')) return mineVersus.togglePref(d.sw.slice(7));
    if (d.sw.startsWith('o:')) { const id = S.setup.id, c = cfg(id), k = d.sw.slice(2); c.opts[k] = c.opts[k] === 'true' ? 'false' : 'true'; saveCfg(id, c); syncOnlineOptions(); return render(); }
    if (d.sw === 'c:rotate') { const c = cfg(S.setup.id); c.rotate = !c.rotate; saveCfg(S.setup.id, c); return render(); }
    if (d.sw.startsWith('off:')) { const k = d.sw.slice(4), i = S.off.indexOf(k); if (i < 0) S.off.push(k); else S.off.splice(i, 1); saveSet(); if (i < 0 && BG && PL.id === k && !PV) bgmNext(1); bgmSync(); return render(); }
    if (d.sw in S.set) {
      S.set[d.sw] = !S.set[d.sw]; saveSet();
      if (d.sw === 'bgm') { if (!S.set.bgm) bgmStop(); else { PL.paused = false; bgCtx(true); if (!BG) bgmPick(); } }
      if (d.sw === 'sound') sfx.enabled = S.set.sound;
      return render();
    }
    return;
  }
  if (onlineClick(d, b)) return;
  const sg = b.closest('[data-seg]');
  if (sg) {
    const k = sg.dataset.seg, v = d.v;
    if(k==='mine-versus:level')return mineVersus.setLevel(v);
    if(k.startsWith('wolf:'))return wolfGame.setOption(k.slice(5),v);
    if(k.startsWith('slide:'))return slideGame.setOption(k.slice(6),v);
    if(k.startsWith('bozu:'))return poetCards.setOption(k.slice(5),v);
    if(k.startsWith('munage:'))return munageGame.setOption(k.slice(7),v);
    if(k.startsWith('bunyo:')||k.startsWith('pakuris:'))return fallingMatch.setOption(...k.split(':'),v);
    if(k==='mine:mode')return minesGame.setMode(v);
    if(k==='mine:level'){minesGame.level=v;return render();}
    if(k==='mine:tap'){minesGame.flagMode=v==='flag';return render();}
    if (k === 'filter') return switchPlayerFilter(v);
    else if (k === 'theme') { S.theme = v; saveSet(); }
    else if (k.startsWith('c:')) { const c = cfg(S.setup.id), f = k.slice(2); c[f] = /^(level|seat|limit)$/.test(f) ? +v : v; saveCfg(S.setup.id, c); }
    else if (k.startsWith('o:')) { const c = cfg(S.setup.id); c.opts[k.slice(2)] = v; saveCfg(S.setup.id, c); syncOnlineOptions(); }
    else if (k in S.set || k === 'res') { S.set[k] = v; saveSet(); if (k === 'win') setFullscreen(v === '全画面'); if (k === 'res') setWinSize(v); }
    return render();
  }
});
app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id==='wolfForm') {
    const input = $('#wolfInput');
    if (input.value.trim()) wolfGame.send('chat',{text:input.value.trim()});
    input.value = '';
  } else if (e.target.id==='chatf') {
    const input = $('#chatin');
    if (input.value.trim()) { sendChat(input.value.trim()); input.value = ''; }
  }
});
app.addEventListener('change', e=>{
  if(e.target.dataset.mineVsPref)mineVersus.pref(e.target);
  if(e.target.hasAttribute('data-mine-vs-target'))mineVersus.setTarget(e.target.value);
});
app.addEventListener('contextmenu', e => {
  const duel = e.target.closest('[data-extra-mine]');
  const cell = e.target.closest('[data-mine-cell]');
  if (!duel && !cell) return;
  e.preventDefault();
  const flag = !minesGame.personal.swapButtons;
  if (duel) boardMatch.send(flag?'flag':'open',{cell:+duel.dataset.extraMine});
  else minesGame.move(+cell.dataset.mineCell,flag);
});
app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'nameIn') { S.set.name = t.value.trim().slice(0, 12); saveSet(); if (typeof pushMyProfile === 'function') pushMyProfile(); return; }
  if (t.dataset.pname) { const c = cfg(S.setup.id); c.names[+t.dataset.pname] = t.value; saveCfg(S.setup.id, c); return; }
  if (t.id === 'volIn') return setVol(+t.value);
  if (t.dataset.rng) { S.set[t.dataset.rng] = +t.value; saveSet(); if (t.dataset.rng === 'master' && BG && !PL.paused) BG.g.gain.value = gv(); }
});
app.addEventListener('change', (e) => {
  if (e.target.dataset && e.target.dataset.sel) { const k = e.target.dataset.sel; S.set[k] = e.target.value; saveSet(); if (k === 'res') setWinSize(e.target.value); return; } if (e.target.id === 'nameIn' && S.screen === 'settings') render(); if (e.target.id === 'volIn') saveSet(); });

async function doUndo() {
  if (online) { mainCore.onlineRequestUndo(); return; }
  if (busy || !view) return;
  token++; busy = false; stopClock();
  await call('undoMove', h);
  sel = null; prevView = null; resultShown = -1;
  const p = $('#result'); if (p) p.hidden = true;
  await refresh();
}
function quitSound() { if (!cur || (view && view.outcome)) return; (cur.category === 'BOARD' && cur.id !== 'mahjong' ? sfxCrumble : sfxCardsFall)(); }
function askQuit() {
  const isSpec = online && view && view.mine < 0;
  setTimeout(focusPrimary, 0);
  if (online && isHostRoom() && isSoloIdleMatch()) {
    openSheet('<h2>1人プレイを終了しますか</h2><p>部屋に戻ります（部屋は開いたままです）。</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="qtYes">部屋に戻る</button></div>');
    $('#qtYes').onclick = () => { closeSheet(); quitSound(); go('room'); };
    return;
  }
  if (online && isHostRoom() && !(view && view.outcome) && ost && ost.members && ost.members.length >= 2) {
    openSheet('<h2>対局を終了しますか</h2><p>全員で部屋に戻るか、他のプレイヤーにホストを引き継いで自分だけ部屋を抜けるか選べます。</p><div class="btns" style="flex-wrap:wrap"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="qtYes">全員で部屋に戻る</button><button class="btn danger" id="qtHandoff">ホストを引き継いで抜ける</button></div>');
    $('#qtYes').onclick = () => { closeSheet(); quitSound(); go('room'); };
    $('#qtHandoff').onclick = async () => { closeSheet(); quitSound(); await handoffHostAndLeave(); token++; busy = false; cpuTurnKey = ''; stopClock(); stopConcurrent(); h = -1; view = null; go('menu'); };
    return;
  }
  openSheet(`<h2>${isSpec ? '観戦を終了しますか' : '対局を終了しますか'}</h2><p>${!online ? '途中の対局は「続きから」で再開できます。' : view && view.outcome || isSpec ? '部屋に戻ります(部屋からは抜けません)。' : isHostRoom() ? '対局を終えて、全員で部屋に戻ります。' : '降参して、部屋に戻ります(部屋からは抜けません)。'}</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="qtYes">${isSpec ? '部屋に戻る' : '終了する'}</button></div>`);
  $('#qtYes').onclick = () => { closeSheet(); if (!isSpec) quitSound(); go(online ? 'room' : 'menu'); };
}
// ソリティアは同時に進めるので「降参」が使えない。代わりに「この配札をやめる」手(seat*1000000+1)を指す(盤の下の「やめる」ボタンの代わり)
function solQuitMove() {
  if (!cur || cur.id !== 'solitaire' || !view || !view.legal) return null;
  const m = mySeat * 1000000 + 1;
  return view.legal.includes(m) ? m : null;
}
function askResign() {
  const quit = solQuitMove();
  if (quit != null) {
    setTimeout(focusPrimary, 0); openSheet('<h2>この配札をやめますか</h2><p>ここで終了します。</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="rgYes">やめる</button></div>');
    $('#rgYes').onclick = () => { closeSheet(); humanMove(quit); };
    return;
  }
  setTimeout(focusPrimary, 0); openSheet('<h2>降参しますか</h2><p>この対局はあなたの負けになります。</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="rgYes">降参する</button></div>');
  $('#rgYes').onclick = async () => { closeSheet(); stopClock(); if (online) mainCore.onlineResign(); else await call('resignMatch', h, mySeat); refresh(); };
}
function askClear(what) {
  const t = { saved: '途中の対局をすべて消しますか', stats: '成績を消しますか', set: '設定を初期設定に戻しますか' }[what];
  setTimeout(focusPrimary, 0); openSheet(`<h2>${t}</h2><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="clYes">${what === 'set' ? '戻す' : '消す'}</button></div>`);
  $('#clYes').onclick = () => {
    closeSheet();
    if (what === 'set') { const keep = { name: S.set.name, av: S.set.av, photo: S.set.photo }; S.set = Object.assign({}, DEFAULT_SET, keep); S.theme = 'auto'; S.vol = 0.6; S.off = []; S.keys = { back: 'Escape', full: 'F11', undo: 'Ctrl+Z', chat: 'Enter', bgm: 'Ctrl+M', mute: 'Ctrl+Shift+M' }; saveSet(); bgmStop(); }
    else store.set(what, what === 'saved' ? [] : {});
    toast({ w: 'お知らせ', t: what === 'set' ? '初期設定に戻しました' : '消しました' });
    render();
  };
}
async function openDataFolder() { try { await window.__TAURI__.core.invoke('open_data_folder'); } catch (e) { toast({ w: 'お知らせ', t: 'フォルダを開けませんでした' }); } }
function pickPhoto() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) cropPhoto(f); };
  inp.click();
}
function cropPhoto(file) {
  const img = new Image();
  img.onload = () => {
    const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 160;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
    S.set.photo = c.toDataURL('image/jpeg', 0.85); S.set.av = 'photo'; saveSet(); if (typeof pushMyProfile === 'function') pushMyProfile(); render();
  };
  img.src = URL.createObjectURL(file);
}
async function setWinSize(v) {
  const [w, hgt] = String(v).split('×').map(Number); if (!w) return;
  try { if (window.__TAURI__) { const W = window.__TAURI__.window, win = W.getCurrentWindow(); if (S.set.win === '全画面') { S.set.win = 'ウィンドウ'; saveSet(); await win.setFullscreen(false); } await win.setSize(new (window.__TAURI__.dpi ? window.__TAURI__.dpi.LogicalSize : W.LogicalSize)(w, hgt)); await win.center(); } else toast({ w: 'お知らせ', t: 'ブラウザのタブでは、ウィンドウの大きさは変えられません' }); } catch (e) { toast({ w: 'お知らせ', t: '大きさを変えられませんでした' }); }
}
async function setFullscreen(on) {
  try {
    if (window.__TAURI__) { await window.__TAURI__.window.getCurrentWindow().setFullscreen(on); return; }
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {}
}

// キー
// 戻る(Esc・マウスの戻るボタン・ブラウザ/Android の戻るボタン)
let pendingGuardPop = 0;
function canGoBackInApp() {
  if ($('#sheetwrap')) return true;
  if (S.stOpen) return true;
  if (S.screen === 'play' && S.chatOpen) return true;
  if (S.modal) return true;
  if (S.screen === 'menu' && S.mobDetail) return true;
  return !!(S.screen && S.screen !== 'menu' && S.screen !== 'first');
}
function syncAppHistory() {
  if (!window.history || typeof history.pushState !== 'function') return;
  if (pendingGuardPop > 0) return;
  const need = canGoBackInApp();
  const has = !!(history.state && history.state.asobiGuard);
  if (need && !has) {
    try { history.pushState({ asobiGuard: 1 }, ''); } catch (e) {}
  } else if (!need && has) {
    pendingGuardPop++;
    try { history.back(); } catch (e) { pendingGuardPop = Math.max(0, pendingGuardPop - 1); }
  }
}
function goBack() {
  const snd = () => sfx.play('BACK');
  if ($('#sheetwrap')) { snd(); return closeSheet(); }
  if (S.stOpen) { snd(); S.stOpen = false; if ($('.side #chatf, #chatpop #chatf')) return refreshChat(); return render(); }
  if (S.screen === 'play' && S.chatOpen) { snd(); return togglePlayChat(false); }
  if (S.modal) { snd(); S.modal = null; if (PV) { PV = null; bgmStop(); if (S.set.bgm) bgmPick(); } return render(); }
  if (S.screen === 'menu' && S.mobDetail) { snd(); S.mobDetail = false; return render(); }
  if (S.screen !== 'menu' && S.screen !== 'first') snd();
  if (S.screen==='extraPlay') return boardMatch.exit();
  if (S.screen==='minePlay') return minesGame.exit();

  if (S.screen==='wolfPlay') return wolfGame.exit();
  if (S.screen==='slidePlay') return slideGame.exit();
  if (S.screen==='bunyoPlay') return fallingMatch.exit('bunyo');
  if (S.screen==='pakurisPlay') return fallingMatch.exit('pakuris');
  if (['slideSetup','bunyoSetup','pakurisSetup','mineSetup','poetSetup','munageSetup','wolfSetup'].includes(S.screen)) return go(roomActive()?'room':'menu');
  if (S.screen === 'play') {
    if (online && view && view.mine < 0) return go('room');
    // 対局中は確かめてから終わる(まだ 1 手も指していない時は、そのまま戻る。通信対戦はいつも確かめる)
    if (online || (view && view.moves > 0 && !view.outcome)) return askQuit();
    quitSound(); return go(online ? 'room' : 'menu');
  }
  if (S.screen === 'setup') return go(S.setup.online ? 'room' : 'menu');
  if (S.screen === 'settings' || S.screen === 'records' || S.screen === 'room') return go('menu');
}
window.addEventListener('popstate', (e) => {
  if (pendingGuardPop > 0) {
    pendingGuardPop--;
    if (e.state && e.state.asobiGuard && !canGoBackInApp()) {
      pendingGuardPop++;
      try { history.back(); } catch (err) { pendingGuardPop = Math.max(0, pendingGuardPop - 1); }
      return;
    }
    syncAppHistory();
    return;
  }
  if (e.state && e.state.asobiGuard) {
    syncAppHistory();
    return;
  }
  if (canGoBackInApp()) {
    goBack();
    syncAppHistory();
  }
});
const ensureGuardOnGesture = () => {
  if (!pendingGuardPop && canGoBackInApp() && !(history.state && history.state.asobiGuard)) syncAppHistory();
};
document.addEventListener('pointerdown', ensureGuardOnGesture, { capture: true, passive: true });
document.addEventListener('keydown', ensureGuardOnGesture, { capture: true, passive: true });
let lastResizeMob = isMob();
window.addEventListener('resize', () => {
  const z = S.set.scale === '100%' ? 1 : parseInt(S.set.scale, 10) / 100;
  const mob = isMob();
  document.body.style.height = (z === 1 || mob) ? '' : (100 / z) + 'vh';
  document.body.style.width = (z === 1 || mob) ? '' : (100 / z) + 'vw';
  if (mob) { hideCursor(); document.querySelectorAll('.rcur.live').forEach((e) => e.remove()); }
  if (!mob && S.chatOpen) S.chatOpen = false;
  if (!mob && S.mobDetail) { S.mobDetail = false; if (S.screen === 'menu') return render(); }
  if (mob !== lastResizeMob) { lastResizeMob = mob; if (S.screen !== 'play' || online) render(); }
}, { passive: true });
window.addEventListener('mousedown', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); goBack(); } else if (e.button === 4) e.preventDefault(); });
// スワイプ・ピンチでの拡大縮小を無効にする(1 本指の操作・スクロールはそのまま残す)
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
['touchstart', 'touchmove'].forEach((t) => document.addEventListener(t, (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false }));
// 矢印キーで、押せる所を移る(Enter で押す)
function navMove(key) {
  const scope = $('#sheetwrap') || $('.modal') || app;
  const all = [...scope.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type=hidden])')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !x.closest('[hidden],[inert],.is-hidden') && !x.matches('.mback,.cutin,.switch[aria-hidden]'); });
  if (!all.length) return;
  let curEl = document.activeElement;
  if (!curEl || !all.includes(curEl)) { const pick = (S.sel && scope.querySelector(`[data-tile="${S.sel}"]`)) || scope.querySelector('[aria-pressed="true"][data-tile]') || all[0]; return focusNav(pick); }
  const a = curEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
  // まず「その方向の帯の中(直交軸で重なる要素)」だけから一番近いものを探し、
  // 無い時だけ方向のコーン(横ずれが縦距離の1.5倍+24px以内)にあるものを探す。
  // これで、グリッドの上移動の途中で横のサイドバーへ飛ぶような幾何的におかしい移動を防ぐ。
  const horiz = dir[0] !== 0;
  let band = null, bandMain = Infinity, bandSide = Infinity, cone = null, coneScore = Infinity;
  for (const x of all) { if (x === curEl) continue; const r = x.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const main = dx * dir[0] + dy * dir[1]; if (main <= 4) continue; const side = Math.abs(dx * dir[1] + dy * dir[0]);
    const overlap = horiz ? (Math.max(a.top, r.top) <= Math.min(a.bottom, r.bottom) + 6) : (Math.max(a.left, r.left) <= Math.min(a.right, r.right) + 6);
    if (overlap) { if (main < bandMain || (main === bandMain && side < bandSide)) { band = x; bandMain = main; bandSide = side; } }
    else if (side <= main * 1.5 + 24) { const sc = main + side * 2.2; if (sc < coneScore) { coneScore = sc; cone = x; } } }
  const best = band || cone;
  if (best) focusNav(best);
}
function focusNav(el) {
  document.body.classList.add('gpnav');
  /* パッド側の選択枠(.gp-focus)が別の要素に残っていたら消す(枠が2つにならないように) */
  document.querySelectorAll('.gp-focus').forEach((e) => { if (e !== el) e.classList.remove('gp-focus'); });
  if (el.dataset.tile && S.screen === 'menu' && S.sel !== el.dataset.tile) { S.sel = el.dataset.tile; document.querySelectorAll('[data-tile]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.tile === S.sel))); const dt = $('.detail'); if (dt) dt.outerHTML = detail(); sfxHover(); }
  el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
const keyOf = (e) => (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey && e.key.length > 1 ? 'Shift+' : e.shiftKey && e.ctrlKey ? 'Shift+' : '') + (e.key.length === 1 ? e.key.toUpperCase() : e.key);
document.addEventListener('keydown', (e) => {
  if (S.rekey) { if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; e.preventDefault(); S.keys[S.rekey] = keyOf(e); S.rekey = null; saveSet(); return render(); }
  if (ddOpen) {
    if (e.key === 'Escape') { e.preventDefault(); return ddClose(true); }
    if (/^Arrow(Up|Down)$/.test(e.key) || e.key === 'Home' || e.key === 'End') { e.preventDefault(); const o = [...document.querySelectorAll('.ddopt')]; let i = o.indexOf(document.activeElement); i = e.key === 'Home' ? 0 : e.key === 'End' ? o.length - 1 : i < 0 ? o.findIndex((x) => x.classList.contains('on')) : Math.max(0, Math.min(o.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); if (o[i]) o[i].focus({ preventScroll: true }); return; }
    if (e.key === 'Tab') ddClose(false);
  }
  const k = keyOf(e), inInput = /INPUT|TEXTAREA/.test(e.target.tagName);
  if(!inInput&&S.screen==='slidePlay'&&!$('#sheetwrap')&&slideGame.key(e.key)){e.preventDefault();return;}
  if(!inInput&&!$('#sheetwrap')&&bunyoGame.key(e.key)){e.preventDefault();return;}
  if(!inInput&&!$('#sheetwrap')&&pakurisGame.key(e.key)){e.preventDefault();return;}
  if (k === S.keys.back) return goBack();
  if (k === S.keys.full) { e.preventDefault(); S.set.win = S.set.win === '全画面' ? 'ウィンドウ' : '全画面'; saveSet(); setFullscreen(S.set.win === '全画面'); if (S.screen === 'settings') render(); return; }
  if (inInput && !/^Arrow(Up|Down)$/.test(e.key)) return;
  if (S.screen === 'play' && boardKey && !$('#sheetwrap') && !S.modal && !cutOn() && boardKey(e)) { e.preventDefault(); return; }
  if (k === S.keys.undo && S.screen === 'play') { e.preventDefault(); const u = $('[data-undo]'); if (u && !u.disabled) doUndo(); return; }
  if (k === S.keys.bgm) { e.preventDefault(); return bgAct('toggle'); }
  if (k === S.keys.mute) { e.preventDefault(); return bgAct('mute'); }
  if (/^Arrow(Up|Down|Left|Right)$/.test(e.key) && !e.ctrlKey && !e.altKey && !(e.target.type === 'range')) { e.preventDefault(); return navMove(e.key); }
  if (k === S.keys.chat && $('#chatin') && (document.activeElement === document.body || !document.activeElement)) { e.preventDefault(); $('#chatin').focus(); }
});
document.addEventListener('fullscreenchange', () => { S.set.win = document.fullscreenElement ? '全画面' : 'ウィンドウ'; saveSet(); });
document.addEventListener('visibilitychange', () => {
  if (S.set.bgSound) return;
  const hide = document.hidden;
  try { if (AX) hide ? AX.suspend() : AX.resume(); if (window.SFXCTX) hide ? window.SFXCTX.suspend() : window.SFXCTX.resume(); } catch (e) {}
});

// ---------------------------------------------------------------- 音(カーソル音・チャットの音)
let hvT = 0, hvEl = null;
function sfxHover() {
  if (!S.set.sound || !S.set.hover || !AX || !transientAudio.allowed()) return; const now = performance.now(); if (now - hvT < 45) return; hvT = now;
  const t = AX.currentTime, o = transientAudio.track(AX.createOscillator()), g = AX.createGain(), f = AX.createBiquadFilter(); o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.035);
  f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(f); f.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.08);
}
document.addEventListener('pointerdown', (e) => { if (ddOpen && !e.target.closest('.dd')) ddClose(false); });
document.addEventListener('pointerdown', () => { try { AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); } catch (e) {} }, { once: true });
// キーを押した時も、止まっている音を動かす(クリックの代わり)
document.addEventListener('keydown', () => { try { if (AX && AX.state === 'suspended') AX.resume(); if (window.SFXCTX && window.SFXCTX.state === 'suspended') window.SFXCTX.resume(); } catch (e) {} });
document.addEventListener('mouseover', (e) => { const b = e.target.closest && e.target.closest('button'); if (b === hvEl) return; hvEl = b; if (b && !b.disabled && !b.matches('.cell,.scell,.c4cell,.card,.cutin,.toast,.cd,.hk')) sfxHover(); });
// 画面のボタンの音。ゲームを決めて設定へ進む時と、スタートの時だけ特別な音
const uiGain = () => S.set.master / 100 * S.set.sfxVol / 100;
function uiCtx() { if (!S.set.sound || !transientAudio.allowed()) return null; try { AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); return AX; } catch (e) { return null; } }
function note(ax, f, t, dur, vol, type = 'sine', to) {
  const o = transientAudio.track(ax.createOscillator()), g = ax.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * uiGain() + 0.0002, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ax.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(ax, t, dur, vol, freq, q = 1.2) {
  const n = Math.max(1, Math.floor(ax.sampleRate * dur)), b = ax.createBuffer(1, n, ax.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = transientAudio.track(ax.createBufferSource()), f = ax.createBiquadFilter(), g = ax.createGain(); src.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * uiGain() + 0.0002, t + Math.min(0.004, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ax.destination); src.start(t); src.stop(t + dur + 0.01);
}
// 設定へ進む: 木の拍子木のあとに、上がる 2 音
function sfxGo() { const ax = uiCtx(); if (!ax) return; const t = ax.currentTime + 0.01; note(ax, 1400, t, 0.05, 0.18, 'triangle', 700); note(ax, 659, t + 0.03, 0.22, 0.2); note(ax, 988, t + 0.12, 0.34, 0.22); note(ax, 1976, t + 0.12, 0.3, 0.05); }
// スタート: 拍子木「カン」と、明るい和音が上がっていく
function sfxStart() { const ax = uiCtx(); if (!ax) return; const t = ax.currentTime + 0.01; noise(ax, t, 0.05, 0.5, 2400, 3); note(ax, 1175, t, 0.09, 0.22, 'triangle', 880); [523, 659, 784, 1047].forEach((f, i) => { note(ax, f, t + 0.08 + i * 0.075, 0.5 - i * 0.05, 0.17); note(ax, f * 2, t + 0.08 + i * 0.075, 0.3, 0.035); }); }
// カードを切る: 2 つの束をパラパラと噛み合わせて、最後にそろえる
// 駒が崩れる「ガラガラ」
function sfxCrumble() { const ax = uiCtx(); if (!ax) return; let t = ax.currentTime + 0.02; for (let i = 0; i < 9; i++) { noise(ax, t, 0.03, 0.22 + Math.random() * 0.15, 900 + Math.random() * 1600, 4); note(ax, 700 + Math.random() * 900, t, 0.05, 0.05, 'triangle'); t += 0.022 + Math.random() * 0.03; } noise(ax, t, 0.09, 0.1, 500, 0.8); }
// 札が落ちる「パラパラ」
function sfxCardsFall() { const ax = uiCtx(); if (!ax) return; let t = ax.currentTime + 0.02; for (let i = 0; i < 18; i++) { noise(ax, t, 0.02, 0.12 + Math.random() * 0.1, 3000 + Math.random() * 2500, 1.5); t += 0.025 + Math.random() * 0.03; } noise(ax, t, 0.08, 0.1, 1200, 0.8); }
function sfxShuffle() {
  const ax = uiCtx(); if (!ax) return; let t = ax.currentTime + 0.02;
  for (let k = 0; k < 1; k++) { for (let i = 0; i < 26; i++) { noise(ax, t, 0.016, 0.16 + Math.random() * 0.1, 2600 + Math.random() * 2200, 1.5); t += 0.021 - i * 0.0004 + Math.random() * 0.005; } noise(ax, t + 0.03, 0.14, 0.14, 1500, 0.7); t += 0.12; }
  noise(ax, t, 0.05, 0.3, 900, 1.2); noise(ax, t + 0.11, 0.05, 0.26, 800, 1.2);
}
function clickSound(b, d) {
  if (b.closest('#boardwrap') || b.closest('#acts') || b.matches('.cutin') || b.classList.contains('off')) return;
  if (d.start != null) return sfxStart();
  if (d.next != null || (d.tile && S.sel === d.tile && (!isMob() || S.mobDetail))) return sfxGo();
  if (d.again != null || d.resume != null) return sfxStart();
  sfx.play(b.getAttribute('aria-label') === '戻る' || d.mclose != null || d.mback != null || d.sheetback != null ? 'BACK' : 'TAP');
}
function sfxPop(up) {
  if (!S.set.sound || !S.set.chatSnd || !transientAudio.allowed()) return;
  try {
    AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); const t = AX.currentTime + 0.01, o = transientAudio.track(AX.createOscillator()), g = AX.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(up ? 420 : 980, t); o.frequency.exponentialRampToValueAtTime(up ? 1250 : 520, t + 0.075); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.16);
  } catch (e) {}
}

// ---------------------------------------------------------------- 通知(右上。クリックで消える・払うと飛んでいく)
let tt; const toastEl = $('#toast');
function toast(m) {
  if (m.chat && !S.set.notify) return;
  toastEl.style.transition = 'none'; toastEl.style.transform = '';
  toastEl.classList.toggle('chat-toast', !!m.chat);
  toastEl.classList.remove('chat-pop');
  const badge = m.chat ? '<span class="chat-toast-badge">💬 チャット</span>' : '';
  toastEl.innerHTML = `<small>${badge}${esc(m.w)}</small><div class="toast-body">${m.s != null ? stamp(m.s) : esc(m.t)}</div>`;
  toastEl.hidden = false;
  if (m.chat) { void toastEl.offsetWidth; toastEl.classList.add('chat-pop'); }
  clearTimeout(tt); tt = setTimeout(toastHide, m.chat ? 5200 : 3000);
}
let drag = null; const toastHide = () => { toastEl.hidden = true; toastEl.style.transition = 'none'; toastEl.style.transform = ''; };
toastEl.addEventListener('pointerdown', (e) => { toastEl.setPointerCapture(e.pointerId); clearTimeout(tt); toastEl.style.transition = 'none'; drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, vx: 0, vy: 0, t: performance.now(), moved: false }; });
toastEl.addEventListener('pointermove', (e) => {
  if (!drag) return; const now = performance.now(), nx = e.clientX - drag.x, ny = e.clientY - drag.y, dt = Math.max(1, now - drag.t);
  drag.vx = 0.6 * drag.vx + 0.4 * (nx - drag.dx) / dt; drag.vy = 0.6 * drag.vy + 0.4 * (ny - drag.dy) / dt; drag.dx = nx; drag.dy = ny; drag.t = now; if (Math.hypot(nx, ny) > 5) drag.moved = true;
  toastEl.style.transform = `translate(${nx}px,${ny}px) rotate(${nx * 0.05}deg)`;
});
toastEl.addEventListener('pointerup', () => {
  const d = drag; drag = null; if (!d) return; if (!d.moved) return toastHide();
  const sp = Math.hypot(d.vx, d.vy), far = Math.hypot(d.dx, d.dy);
  if (sp < 0.45 && far < 140) { toastEl.style.transition = 'transform .38s cubic-bezier(.3,1.6,.5,1)'; toastEl.style.transform = ''; tt = setTimeout(toastHide, 2000); return; }
  let x = d.dx, y = d.dy, vx = d.vx * 16, vy = d.vy * 16, r = d.dx * 0.05; if (sp < 0.45) { vx = d.dx / far * 14; vy = d.dy / far * 14; } const vr = vx * 0.7;
  const step = () => { vy += 1.1; x += vx; y += vy; r += vr; toastEl.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`; if (Math.abs(x) > innerWidth || y > innerHeight || y < -innerHeight) toastHide(); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
});
toastEl.addEventListener('pointercancel', () => { drag = null; toastHide(); });

// ---------------------------------------------------------------- 起動
(async () => {
  try {
    if (window.history && history.state && history.state.asobiGuard) {
      try { history.replaceState(null, ''); } catch (e) {}
    }
    const [catalog] = await Promise.all([callW('catalogJson'), window.rouletteReady]);
    CAT = JSON.parse(catalog);
    document.title = APP_NAME;
    CAT.push({id:'slide',name:'スライドパズル',intro:'1枚の絵をそろえよう。',players:'1〜6人',category:'BOARD',options:[]});
    CAT.push({id:'bunyo',name:'ぶにょぶにょ',intro:'同じ色を4個つなげて消そう。',players:'1〜4人',category:'BOARD',options:[]});
    CAT.push({id:'pakuris',name:'パクリス',intro:'ブロックをそろえて消そう。',players:'1〜4人',category:'BOARD',options:[]});
    CAT.push({id:'mine',name:'マインスイーパー',intro:'協力して地雷を避けるか、同じ配置でクリアを競おう。',players:'1〜6人',category:'BOARD',options:[]});
    CAT.push({id:'mineVersus',name:'マインスイーパー（対戦）',intro:'同じ配置で競い、ポイントを使って相手を妨害しよう。',players:'2〜6人',category:'BOARD',options:[]});
    CAT.push({id:'bozu',name:'坊主めくり',intro:'4つの山から札を引き、持ち札の数を競おう。',players:'1〜6人',category:'CARD',options:[]});
    CAT.push({id:'munage',name:'胸毛絶体絶命',intro:'大砲の中の胸毛のおっさん。順にボタンを押し、点火スイッチを押した人が飛ばしてしまう。',players:'2〜6人',category:'BOARD',options:[]});
    CAT.push({id:'wolf',name:'人狼',intro:'話し合いと投票で、村に潜む人狼を探そう。',players:'1〜6人',category:'BOARD',options:[]});
    sfx.enabled = S.set.sound;
    S.screen = store.get('firstDone', false) ? 'menu' : 'first';
    render();
    // プレイ中にリロードした時は、元の画面に戻る
    {
      let room = null, playId = null;
      try { room = sessionStorage.getItem('asobi-fb-room'); playId = sessionStorage.getItem('asobi-play'); } catch (e) {}
      if (room && typeof tryRejoinRoom === 'function') tryRejoinRoom();
      else if (playId) { const s = store.get('saved', []).find((x) => x.id === playId); if (s) resume(s); }
    }
    sfx.init();
    // 起動してすぐ BGM を流す(exe はクリックを待たずに鳴る。ブラウザでは最初のクリックで鳴り始める)
    try { bgCtx(true); } catch (e) {}
    // exe: ウィンドウ・タスクバーの × では、確認を出してから終わる(受け取ったことを先に知らせる。知らせが無ければ exe 側で閉じる)
    if (window.__TAURI__ && window.__TAURI__.event) window.__TAURI__.event.listen('asobi-close', () => { window.__TAURI__.core.invoke('close_ack').catch(() => {}); sfx.play('TAP'); askQuitApp(); });
    if (S.set.win === '全画面') setFullscreen(true);
  } catch (e) { app.innerHTML = `<div class="empty">読み込みに失敗しました: ${esc(e.message)}</div>`; }
})();

// ---- スマホの下から出る詳細(ゲーム説明)シート: 中を動かしても後ろのメニューを動かさない／横棒を下へ引くと閉じる
(() => {
  let t0 = null; // { y, drag, sheet, last, lastT, v }
  const openSheet = () => { const d = document.querySelector('.detail.open'); return d && getComputedStyle(d).position === 'fixed' ? d : null; };
  const scrollerOf = (el, sheet) => {
    for (let n = el; n && n !== sheet.parentNode; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
      if (n === sheet) break;
    }
    return null;
  };
  document.addEventListener('touchstart', (e) => {
    const sheet = openSheet(); if (!sheet || e.touches.length !== 1) { t0 = null; return; }
    const tgt = e.target;
    if (!sheet.contains(tgt) && !tgt.closest('.detail-backdrop')) { t0 = null; return; }
    const drag = sheet.contains(tgt) && !!tgt.closest('.detail-mobhd') && !tgt.closest('button');
    t0 = { y: e.touches[0].clientY, drag, sheet, moved: 0, last: e.touches[0].clientY, lastT: performance.now(), v: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!t0) return;
    const y = e.touches[0].clientY, dy = y - t0.y;
    if (t0.drag) {
      e.preventDefault();
      const now = performance.now(); t0.v = (y - t0.last) / Math.max(1, now - t0.lastT); t0.last = y; t0.lastT = now;
      t0.moved = Math.max(0, dy);
      t0.sheet.style.transition = 'none';
      t0.sheet.style.transform = `translateY(${t0.moved}px)`;
      return;
    }
    // シートの中で動かせる所が端まで来た・動かせない所・背景の暗い所 → 後ろへ伝えない
    const sc = t0.sheet.contains(e.target) ? scrollerOf(e.target, t0.sheet) : null;
    const step = y - (t0.prevY == null ? t0.y : t0.prevY); t0.prevY = y;
    if (!sc || (step > 0 && sc.scrollTop <= 0) || (step < 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1)) e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (!t0) return;
    const { sheet, drag, moved, v } = t0; t0 = null;
    if (!drag) return;
    const close = moved > Math.min(120, sheet.offsetHeight * 0.25) || (v > 0.6 && moved > 20);
    sheet.style.transition = 'transform .2s cubic-bezier(.22,.85,.32,1)';
    if (close) {
      sheet.style.transform = 'translateY(105%)';
      const bd = document.querySelector('.detail-backdrop'); if (bd) { bd.style.transition = 'opacity .2s'; bd.style.opacity = '0'; }
      setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = ''; if (S.mobDetail) { S.mobDetail = false; render(); } }, 200);
    } else {
      sheet.style.transform = '';
      setTimeout(() => { sheet.style.transition = ''; }, 220);
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
})();
