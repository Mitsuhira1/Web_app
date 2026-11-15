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
const ONLINE_FNS = new Set(['viewJson', 'matchRecord']);
const call = async (fn, ...args) => (online && ONLINE_FNS.has(fn) ? mainCore[fn](...args) : callW(fn, ...args));
const sfx = (() => { try { return createSfx(call); } catch (e) { return { init: async () => {}, play() {}, enabled: true }; } })();

// ---------------------------------------------------------------- ゲームの一覧
const ORDER = ['shogi', 'gogo', 'reversi', 'connect4', 'gomoku', 'hex', 'mancala', 'morris', 'checkers', 'chess', 'dots', 'hitblow', 'hare', 'chinese', 'ludo', 'backgammon', 'go', 'yacht', 'mahjong', 'life',
  'hanafuda', 'sevens', 'memory', 'speed', 'poker', 'holdem', 'blackjack', 'daifugo', 'uno', 'solitaire'];
const ART_ID = { gogo: 'minishogi' };
const BREAK = { morris: 'ナインメンズ<wbr>モリス', chinese: 'チャイニーズ<wbr>チェッカー', dots: 'ドット＆<wbr>ボックス', holdem: 'テキサス<wbr>ポーカー', yacht: 'ヨット', blackjack: 'ブラック<wbr>ジャック', backgammon: 'バック<wbr>ギャモン', hitblow: 'ヒット＆<wbr>ブロー', life: '人生<wbr>すごろく', solitaire: 'ソリティア<wbr>(クロンダイク)' };
let CAT = [];
const gInfo = (id) => CAT.find((g) => g.id === id);
const artOf = (id) => art(ART_ID[id] || id) || '';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dispName = (g) => BREAK[g.id] || esc(g.name);
const range = (p) => { const m = String(p).match(/\d+/g).map(Number); return [m[0], m[m.length - 1]]; };
const PLAYABLE = new Set(ORDER);
const playable = (id) => PLAYABLE.has(id) && (window.RENDER[id] || window.RENDER[KIND_OF[id] || id] || window.RENDER.cards);
const KIND_OF = { gogo: 'shogi', connect4: 'c4', chinese: 'chinese' };
const LV = ['初級', '中級', '上級'];
const lvIndex = (t) => Math.max(0, LV.indexOf(t));

const app = $('#app');
const meName = () => S.set.name || 'あなた';

// ---------------------------------------------------------------- 共通の部品
const seg = (key, opts, val, cls = '') => `<div class="seg ${cls}" data-seg="${key}">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button data-v="${esc(v)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`; }).join('')}</div>`;
const sw = (key, on) => `<button class="switch" role="switch" aria-checked="${!!on}" data-sw="${key}" aria-label="${esc(key)}"></button>`;
const QUIT_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>';
function rail(cur) {
  const t = [['menu', 'games', 'ゲーム'], ['room', 'room', 'みんなで遊ぶ'], ['records', 'rec', '成績'], ['settings', 'set', '設定']];
  return `<nav class="rail">
    <div class="brand"><strong>日本アソビ大辞典 <i>30</i></strong></div>
    <div class="tabs">${t.map(([s, i, n]) => `<button data-go="${s}" ${cur === s ? 'aria-current="page"' : ''}>${ic(i)}${n}</button>`).join('')}</div>
    ${cur === 'menu' ? `<div><h4>人数</h4>${seg('filter', ['すべて', '1人', '2人', '3人以上'], S.filter, 'col')}</div>` : ''}
    <button class="quitbtn" data-quitapp>${QUIT_IC}終了する</button>
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
  S.screen = screen; S.stOpen = false; S.modal = null; ddOpen = null;
  bgCtx(); render();
}
function bgmGenreFor() {
  if (S.screen === 'play' && cur) return gameGenre(ART_ID[cur.id] || cur.id);
  return { first: 'mn', menu: 'mn', setup: 'mn', settings: 'mn', room: 'mn', records: 'mn' }[S.screen];
}

// ---------------------------------------------------------------- メニュー
const savedList = () => store.get('saved', []).filter((s) => s.moves > 0 && gInfo(s.id)).slice(0, 3);
function menu() {
  const tiles = (c) => ORDER.map((id) => gInfo(id)).filter((g) => g && (g.category === 'BOARD') === (c === 'b') && fits(g.players))
    .map((g) => `<button class="tile ${playable(g.id) ? '' : 'soon'}" data-tile="${g.id}" aria-pressed="${S.sel === g.id}"><span class="art">${artOf(g.id)}</span><span class="cap"><b>${dispName(g)}</b><small>${esc(g.players)}${playable(g.id) ? '' : '・準備中'}</small></span></button>`).join('');
  const nb = ORDER.filter((id) => gInfo(id) && gInfo(id).category === 'BOARD' && fits(gInfo(id).players)).length;
  const nc = ORDER.filter((id) => gInfo(id) && gInfo(id).category !== 'BOARD' && fits(gInfo(id).players)).length;
  const sv = savedList();
  const cont = sv.length ? `<div class="conts"><h3>続きから</h3>${sv.map((s, k) => `<button class="resume" data-resume="${k}"><span class="th">${artOf(s.id)}</span><b>${esc(gInfo(s.id).name)}</b><span class="mv">${s.moves}手目</span><span class="go">${ic('play')}</span></button>`).join('')}</div>` : '';
  return `<div class="screen">${rail('menu')}
   <div class="main">${cont}
    ${nb ? `<h3 class="shelfhead">ボードゲーム <i>${nb}</i></h3><div class="shelf">${tiles('b')}</div>` : ''}
    ${nc ? `<h3 class="shelfhead">カードゲーム <i>${nc}</i></h3><div class="shelf">${tiles('c')}</div>` : ''}
   </div>${detail()}</div>`;
}
function detail() {
  const g = S.sel && gInfo(S.sel);
  if (!g) return '<aside class="detail"><div class="empty">ゲームを選んでください</div></aside>';
  const c = cfg(g.id);
  const ok = playable(g.id);
  return `<aside class="detail"><div class="scroll">
    <div class="hero"><span class="art">${artOf(g.id)}</span><div><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p><span class="tag">${esc(g.players)}</span><span class="tag">${g.category === 'BOARD' ? 'ボード' : 'カード'}</span></div></div>
    <div class="panel"><h3>前回の設定</h3>
      <div class="row"><span>遊び方</span><b>${c.mode === 'pass' ? '手番ごとに交代' : 'CPUと対戦'}</b></div>
      <div class="row"><span>CPUの強さ</span><b>${LV[c.level]}</b></div>
      <div class="row"><span>1手の制限時間</span><b>${c.limit ? c.limit + '秒' : 'なし'}</b></div></div>
    ${ok ? '' : '<div class="panel"><div class="row"><span>このゲームは準備中です</span></div></div>'}
   </div><div class="foot"><button class="btn" data-rule="${g.id}">${ic('book')}ルール</button><button class="btn primary" data-next ${ok ? '' : 'disabled'}>進む</button></div></aside>`;
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
const engineOpts = (g, c) => g.options.filter((o) => o.group !== 'online').map((o) => `${o.key}=${c.opts[o.key] ?? o.default}`).sort().join(';');
const isBool = (o) => o.values.length === 2 && o.values.every(([v]) => v === 'true' || v === 'false');
let seatsCache = {};
function setup() {
  const g = gInfo(S.setup.id), id = g.id, c = cfg(id), on = S.setup.online;
  const key = id + '|' + engineOpts(g, c);
  const total = seatsCache[key] || range(g.players)[0];
  if (!seatsCache[key]) callW('seatCount', id, engineOpts(g, c)).then((n) => { seatsCache[key] = n; if (S.screen === 'setup') render(); });
  const solo = total === 1;
  const canPass = range(g.players)[1] >= 2 && !['speed', 'solitaire'].includes(id);
  const pass = c.mode === 'pass' && canPass;
  const ps = g.options.find((o) => o.key === 'players');
  const rowOpt = (o) => {
    const v = c.opts[o.key] ?? o.default;
    if (isBool(o)) return `<div class="row"><span>${esc(o.label)}</span>${sw('o:' + o.key, v === 'true')}</div>`;
    const short = o.values.length <= 4 && o.values.map((x) => x[1]).join('').length <= 14;
    return short ? `<div class="row"><span>${esc(o.label)}</span>${seg('o:' + o.key, o.values, v)}</div>`
      : `<div class="row"><span>${esc(o.label)}</span></div><div class="row below">${seg('o:' + o.key, o.values, v, 'wide')}</div>`;
  };
  const rule = g.options.filter((o) => o.key !== 'players' && o.group === 'rule');
  const local = g.options.filter((o) => o.group === 'local');
  const seatNames = g.seatNames && g.seatNames.length >= 2 ? g.seatNames : ['先手', '後手'];
  let pidx = 0; if (ps) pidx = Math.max(0, ps.values.findIndex(([v]) => v === c.opts.players));
  const cpus = Math.max(0, total - (pass ? c.humans : 1));
  return `<div class="screen col">
   <div class="setuphead"><button class="btn" data-go="${on ? 'room' : 'menu'}" aria-label="戻る">${ic('back')}</button><span class="art">${artOf(id)}</span>
     <div class="txt"><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p></div><span class="tagl">${esc(g.players)}</span><span class="tagl">${on ? 'みんなで遊ぶ' : g.category === 'BOARD' ? 'ボードゲーム' : 'カードゲーム'}</span></div>
   <div class="setupbody"><div class="cols2">
    <div class="stack">
     <div class="panel ${on || !canPass ? 'off' : ''}"><h3>遊び方</h3><div class="row">${seg('c:mode', [['cpu', 'CPUと対戦'], ['pass', '手番ごとに交代']], pass ? 'pass' : 'cpu', 'wide')}</div></div>
     <div class="panel"><h3>人数と相手</h3>
      <div class="row"><span>合計の人数${cpus && !on ? `<small class="sub">CPU ${cpus}人</small>` : ''}</span>${ps ? `<span class="stepper"><button data-pstep="-1" aria-label="減らす" ${pidx > 0 ? '' : 'disabled'}>−</button><b class="num">${esc(ps.values[pidx][1])}</b><button data-pstep="1" aria-label="増やす" ${pidx < ps.values.length - 1 ? '' : 'disabled'}>＋</button></span>` : `<b>${total}人</b>`}</div>
      <div class="row ${solo || on ? 'dim' : ''}"><span>CPUの強さ</span>${seg('c:level', LV.map((l, i) => [i, l]), c.level)}</div>
      <div class="row ${solo || on || total !== 2 ? 'dim' : ''}"><span>手番</span>${seg('c:seat', [[0, seatNames[0]], [1, seatNames[1]], [-1, 'ランダム']], c.seat)}</div></div>
     <div class="panel ${!pass || on ? 'off' : ''}"><h3>手番ごとに交代</h3>
      <div class="row"><span>交代する人</span><span class="stepper"><button data-hstep="-1" aria-label="減らす" ${c.humans > 2 ? '' : 'disabled'}>−</button><b class="num">${c.humans}人</b><button data-hstep="1" aria-label="増やす" ${c.humans < total ? '' : 'disabled'}>＋</button></span></div>
      <div class="row"><span>1人目</span><b>${esc(meName())}</b></div>
      ${Array.from({ length: Math.max(1, c.humans - 1) }, (_, k) => `<div class="row"><span>${k + 2}人目</span><span class="field"><input data-pname="${k + 1}" value="${esc(c.names[k + 1] || '')}" placeholder="プレイヤー${k + 2}" maxlength="12" aria-label="${k + 2}人目の名前"></span></div>`).join('')}
      <div class="row"><span>上下反対に表示</span>${sw('c:rotate', c.rotate)}</div></div>
    </div>
    <div class="stack">
     ${rule.length ? `<div class="panel"><h3>ルール</h3>${rule.map(rowOpt).join('')}</div>` : ''}
     ${local.length ? `<div class="panel"><h3>ローカルルール</h3>${local.map(rowOpt).join('')}</div>` : ''}
     ${id === 'dots' ? `<div class="panel"><h3>表示</h3><div class="row"><span>紙の色</span>${seg('c:paper', [['light', 'ライト'], ['auto', '設定に合わせる'], ['dark', 'ダーク']], c.paper || 'light')}</div></div>` : ''}
     <div class="panel ${on ? 'off' : ''}"><h3>時間</h3>
      <div class="row"><span>1手の制限時間</span>${seg('c:limit', [[0, 'なし'], [15, '15秒'], [30, '30秒'], [60, '60秒']], c.limit)}</div>
      <div class="row ${c.limit ? '' : 'dim'}"><span>時間切れ</span>${seg('c:tout', [['random', 'ランダムな一手'], ['lose', '負け']], c.tout)}</div></div>
    </div></div></div>
   <div class="setupfoot"><button class="btn" data-rule="${id}">${ic('book')}ルール</button><button class="btn primary" data-start>スタート</button></div></div>`;
}

// ---------------------------------------------------------------- 対局
let concurrent = false, concTimer = null;
let cur = null, h = -1, token = 0, view = null, mySeat = 0, sel = null, busy = false, clock = null, lastSeat = 0, mode = 'cpu', pcfg = null, lastRecord = '', prevView = null;
const THINK = [300, 800, 1500];
const PACE = { 短い: 250, ふつう: 450, 長い: 800 };
const SPEED = () => ({ ゆっくり: 1.5, ふつう: 1, 速い: 0.6 }[S.set.speed] || 1) * (S.set.reduce ? 0.01 : 1);
const PASS_MOVES = { reversi: 64, ludo: 99, backgammon: 999 };
async function startMatch(forceSeat) {
  online = false; token++; sel = null; prevView = null; view = null; drawnView = null; resultShown = -1; stopClock();
  { const p = $('#result'); if (p) p.hidden = true; }
  const g = cur = gInfo(S.setup.id); const c = pcfg = cfg(g.id);
  mode = c.mode === 'pass' && range(g.players)[1] >= 2 ? 'pass' : 'cpu';
  let seat = forceSeat != null ? forceSeat : c.seat === -1 ? (Math.random() < 0.5 ? 0 : 1) : c.seat;
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
  enterPlay();
}
async function enterPlay() {
  busy = false; stopConcurrent();
  concurrent = online ? false : await callW('isConcurrent', h); S.screen = 'play'; S.modal = null;
  bgCtx(); render();
  dealPending = SHUFFLE_GAMES.has(cur.id) && (!view || !view.moves) && !online ? 1 : 0;
  if (SHUFFLE_GAMES.has(cur.id) && (!view || !view.moves)) setTimeout(sfxShuffle, 250);
  if (!view || !view.moves) setTimeout(() => cut({ text: '対局開始', tone: 'gold', ms: 1200 }), 150);
  refresh();
}
function leavePlay() { token++; stopClock(); stopConcurrent(); closeSheet(); if (online) leaveOnline(); h = -1; view = null; }
const subText = () => online ? 'みんなで遊ぶ' : mode === 'pass' ? '手番ごとに交代' : 'CPU ' + LV[pcfg ? pcfg.level : 1];
function play() {
  const g = cur;
  const canUndo = view && (online ? !!(ost && ost.undoOk) && !busy && view.moves > 0 && !(ost && ost.undoAsk) : view.undoAllowed !== false && !busy && view.moves > 0 && view.seats.some((s) => !s.human) && !view.outcome);
  const listLabel = /shogi|gogo|chess/.test(g.id) ? '駒の一覧' : '役の一覧';
  return `<div class="screen"><div class="stage">
    <div class="stagehead"><button class="btn" data-go="${online ? 'room' : 'menu'}" aria-label="戻る">${ic('back')}</button><h2>${esc(g.name)}</h2><span>${esc(subText())}<b id="hround"></b></span></div>
    <div class="boardwrap" id="boardwrap"></div>
    <div class="acts" id="acts"></div>
    <div class="countbar" id="countbar"></div><div class="countline"><i id="cline" style="width:0"></i></div>
    <div class="cutlayer" id="cutlayer"></div>
    <div class="resultlayer" id="result" hidden></div>
   </div>
   <aside class="side">
    <div class="seats" id="strip"></div>
    <div class="status" id="status"></div>
    <div class="ops"><button class="btn" data-undo ${canUndo ? '' : 'disabled'}>${ic('undo')}待った</button><button class="btn" data-rule="${g.id}">${ic('book')}ルール</button>
     <button class="btn ${hasList(g.id) ? 'listbtn' : ''}" data-list ${hasList(g.id) ? '' : 'disabled'}>${ic('list')}${listLabel}</button><button class="btn" data-resign ${view && view.canResign && view.human && !view.outcome && !busy ? '' : 'disabled'}>${ic('flag')}降参</button></div>
    ${online ? chatBox() : `<div class="sidenote" id="sidenote"></div>`}
   </aside></div>`;
}
const hasList = (id) => /shogi|gogo|chess|poker|holdem|hanafuda|yacht|daifugo|mahjong/.test(id);
async function refresh() {
  if (h < 0) return;
  const my = token;
  const v = JSON.parse(await call('viewJson', h, mySeat));
  if (my !== token) return;
  view = v;
  if (!online) lastRecord = await call('matchRecord', h);
  if (mode === 'pass' && view.human && view.toMove >= 0 && view.toMove !== mySeat) { mySeat = view.toMove; view = JSON.parse(await call('viewJson', h, mySeat)); }
  detectEvents(prevView, view);
  turnCut(prevView, view);
  prevView = view;
  if (S.screen !== 'play') return;
  drawPlay();
  saveProgress();
  if (view.outcome) { stopClock(); stopConcurrent(); return showResult(); }
  if (concurrent) { busy = false; runConcurrent(my); drawPlay(); return; }
  if (view.human) {
    const pm = PASS_MOVES[cur.id];
    if (pm != null && view.legal.length === 1 && view.legal[0] === pm) {
      setStatus('動かせないので、パスします');
      await new Promise((r) => setTimeout(r, 1100));
      if (my !== token) return;
      if (online) mainCore.onlinePlay(h, pm); else await call('playMove', h, pm);
      pendSnd = pm; return refresh();
    }
    startClock(my); return;
  }
  stopClock();
  if (online && view.remote) { busy = false; drawPlay(); return; }
  cpuTurn(my);
}
async function cpuTurn(my) {
  busy = true; drawPlay();
  for (let k = 0; k < 200; k++) { const lag = Math.max(animUntil, cutBusy) - performance.now(); if (lag <= 0 && !cutQ.length) break; await new Promise((r) => setTimeout(r, Math.min(Math.max(lag, 60), 200))); if (my !== token) return; }
  if (my !== token) return;
  const t0 = performance.now();
  const lvl = view.seats[view.toMove] ? view.seats[view.toMove].level : 1;
  let mv;
  if (online) { const hw = await callW('restoreMatch', mainCore.matchRecord(h)); mv = await callW('cpuChoose', hw, THINK[lvl]); await callW('dropMatch', hw); }
  else mv = await callW('cpuChoose', h, THINK[lvl]);
  if (my !== token) return;
  const wait = (PACE[S.set.cpuLen] || 450) * Math.max(0.3, SPEED()) - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (my !== token) return;
  await runCursor(mv, my);
  if (my !== token) return;
  busy = false;
  const quiet = view.board && view.board.kind === 'hitblow' && view.board.setting;
  if (online) mainCore.onlineCpuPlay(h, mv); else await call('playMove', h, mv);
  pendSnd = quiet ? null : mv; lastPlayed = mv; hideCursor();
  await refresh();
}
const cutOn = () => !!document.querySelector('#cutlayer .cutin:not(.out)');
async function humanMove(m) {
  if (cutOn()) return;
  if (!view || (!view.human && !concurrent) || busy || m == null || m < 0) return;
  sel = null; stopClock();
  const my = token;
  const ok = online ? mainCore.onlinePlay(h, m) : await call('playMove', h, m);
  if (ok) { pendSnd = m; lastPlayed = m; }
  if (my === token) await refresh();
}
function playMoveSound(m) { const r = moveSound(cur.id, m); if (r) sfx.play(r[0], r[1] || {}); }
const setStatus = (t) => { const e = $('#status'); if (e) e.textContent = t || ''; };
function statusText() {
  const b = view.board;
  if (view.outcome) return '終了';
  if (online && view.remote) return `${view.seats[view.toMove].name} の番です`;
  if (!view.human) return busy && !(b && b.kind === 'hitblow' && b.setting) ? `${seatName(view.toMove)} が考えています` : '';
  if (!b) return '';
  switch (b.kind) {
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
const seatName = (seat) => seat === mySeat && mode !== 'pass' ? meName() : view.seats[seat] && (view.seats[seat].human || view.seats[seat].remote) ? view.seats[seat].name : (view.seats.filter((s) => !s.human && !s.remote).length > 1 ? 'CPU ' + (seat + 1) : 'CPU');
function api() {
  return {
    mySeat, view, handle: h, speed: SPEED(), game: cur ? cur.id : '',
    name: (seat) => seatName(seat),
    note: (seat) => { const s = view.seats[seat]; if (!s) return ''; if (seat === view.toMove && busy) return '考えています'; if (!s.human && !s.remote) return LV[s.level] || ''; return (cur.seatNames && cur.seatNames[seat]) || ''; },
    strip: (html) => { const e = $('#strip'); if (e) e.innerHTML = html; },
    board: (html, onTap) => {
      const wrap = $('#boardwrap'); if (!wrap) return;
      wrap.className = 'boardwrap k-' + (view.board ? view.board.kind : '');
      wrap.onpointerdown = null;
      wrap.innerHTML = html.startsWith('<svg') ? `<div class="plate">${html}</div>` : html;
      wrap.onclick = (e) => { if (busy || cutOn() || dragJust) return; const t = e.target.closest('[data-sq],[data-roll],[data-spin],[data-off],[data-tok],[data-i],[data-col],[data-hand],[data-m],[data-z],[data-k],[data-e],[data-p],[data-pt],[data-d],[data-c],[data-a],[data-s],[data-t],[data-tgt],[data-card],[data-src],[data-dest],[data-draw],[data-lm],[data-guess],[data-bet],[data-pass],[data-pit],[data-die],[data-cat],[data-seat]') || e.target; onTap(t.dataset || {}, t); };
    },
    acts: (list) => {
      const box = $('#acts'); if (!box) return;
      const waitT = online && !view.human && view.remote, dimT = (!view.human && !concurrent && !waitT) || busy;
      box.innerHTML = list.map((a, i) => `<button class="btn ${a.cls != null ? a.cls : i === list.length - 1 ? 'gold' : ''} ${waitT ? 'waiting' : ''}" data-act="${i}" ${waitT ? 'tabindex="-1"' : !a.enabled || dimT ? 'disabled' : ''}>${esc(a.label)}</button>`).join('');
      box.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || b.classList.contains('waiting') || cutOn()) return; const a = list[+b.dataset.act]; if (a.fn) a.fn(); else humanMove(a.move); };
    },
    play: humanMove, redraw: () => drawPlay(true), anim: (ms) => { animUntil = Math.max(animUntil, performance.now() + ms * SPEED()); },
    land: (ms) => { landMs = ms; }, sfx: (name, ms = 0, o) => setTimeout(() => sfx.play(name, o || {}), ms * SPEED()),
    key: (fn) => { boardKey = fn; }, round: (t) => { const e = $('#hround'); if (e) e.innerHTML = t ? String(t).split('・').map((x) => `<span class="hchip">${esc(x)}</span>`).join('') : ''; },
    side: (html, onTap) => { const n = $('#sidenote'); if (!n) return; sideCustom = true; n.classList.add('custom'); n.innerHTML = html; n.onclick = (e) => { const t = e.target.closest('[data-lm],[data-spin],[data-repay],[data-act]'); if (!t || t.disabled || t.classList.contains('waiting') || cutOn()) return; onTap(t.dataset, t); }; },
    get isOnline() { return online; },
    get remoteTurn() { return online && view && !view.human && view.remote; }, cut: (c) => cut(Object.assign({ _tok: token }, c)), animClear: () => { animUntil = performance.now(); },
    drag: (o) => setupDrag(o),
    get cfg() { return pcfg || {}; }, get lastMove() { return lastPlayed; }, get reduce() { return !!S.set.reduce; },
    sheet: (html, init) => { openSheet(html); if (init) init($('#sheet')); }, closeSheet,
    get sel() { return sel; }, set sel(v) { sel = v; },
    get hints() { return S.set.hints; }, get caps() { return S.set.caps; }, get pre() { return S.set.pre; },
    face: () => meAv(),
    call: (fn, ...a) => call(fn, ...a), sheetOpen: () => !!$('#sheetwrap'),
  };
}
let sideCustom = false, lastPlayed = -1, drawnView = null, animUntil = 0, pendSnd = null, landMs = 0, boardKey = null, dealPending = 0;
function drawPlay(force) {
  if (S.screen !== 'play' || !view) return;
  if (!$('#boardwrap')) render();
  const keep = !force && drawnView === view && $('#boardwrap').firstChild;
  const b = view.board;
  const ops = $('.side .ops');
  if (ops) {
    const canUndo = online ? !!(ost && ost.undoOk) && !busy && view.moves > 0 && !(ost && ost.undoAsk) && !view.outcome : !busy && view.moves > 0 && view.seats.some((s) => !s.human) && !view.outcome;
    ops.querySelector('[data-undo]').disabled = !canUndo;
    ops.querySelector('[data-resign]').disabled = !(view.canResign && view.human && !view.outcome && !busy);
  }
  if (keep) { setStatus(statusText()); drawClock(); return; }
  drawnView = view;
  $('#acts').innerHTML = ''; $('#strip').innerHTML = '';
  landMs = 0; boardKey = null; sideCustom = false; { const n = $('#sidenote'); if (n) { n.classList.remove('custom'); n.onclick = null; } }
  if (b) {
    const r = window.RENDER[b.kind] || (b.kind === 'cards' ? window.RENDER.cards : null);
    if (r) r(b, api());
    else $('#boardwrap').innerHTML = '<div class="empty">この盤はまだ描けません</div>';
  }
  if (pendSnd != null) { const m = pendSnd; pendSnd = null; if (landMs >= 0) { if (landMs > 0) setTimeout(() => playMoveSound(m), landMs * SPEED()); else playMoveSound(m); } }
  if (dealPending) { dealPending = 0; dealIntro(); }
  setStatus(statusText());
  drawClock();
  const n = $('#sidenote'); if (n && !sideCustom) n.innerHTML = `<div class="kv"><span>手数</span><b class="num">${view.moves}</b></div>`;
}

// 札をドラッグで出す(設定「駒の動かし方」がクリックの時は使わない)
let dragJust = false;
function setupDrag(o) {
  const wrap = $('#boardwrap'); if (!wrap || S.set.drag === 'クリック') return;
  wrap.onpointerdown = (e) => {
    if (e.button !== 0 || busy || cutOn() || (!view.human && !concurrent)) return;
    const src = e.target.closest(o.src); if (!src || !wrap.contains(src)) return;
    const sx = e.clientX, sy = e.clientY, r = src.getBoundingClientRect(); let ghost = null, over = null;
    const move = (ev) => {
      if (!ghost) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; sfx.play('CARD_FLIP', { volume: .5 }); ghost = src.cloneNode(true); ghost.classList.add('dragghost'); Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' }); ghost.style.setProperty('--cw', r.width + 'px'); ghost.style.setProperty('--w', r.width + 'px'); const fs = getComputedStyle(src).fontSize; ghost.style.fontSize = fs; document.body.appendChild(ghost); src.classList.add('dragsrc'); }
      ghost.style.transform = `translate(${ev.clientX - sx}px,${ev.clientY - sy}px) rotate(4deg)`;
      const under = document.elementFromPoint(ev.clientX, ev.clientY), d = under && under.closest(o.dst);
      if (over !== d) { if (over) over.classList.remove('dropover'); over = d && wrap.contains(d) ? d : null; if (over) over.classList.add('dropover'); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!ghost) return;
      ghost.remove(); src.classList.remove('dragsrc'); if (over) over.classList.remove('dropover');
      dragJust = true; setTimeout(() => (dragJust = false), 0);
      if (over) { o.drop(src, over); } else sfx.play('CARD', { volume: .35, rate: .9 });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
}

// 同時に指せるゲーム(スピード・ソリティア): CPU は人の操作を待たずに、少し間をあけて指す
function stopConcurrent() { if (concTimer) { clearTimeout(concTimer); concTimer = null; } }
let concSeat = 0;
async function runConcurrent(my) {
  if (concTimer || h < 0) return;
  const seats = JSON.parse(await callW('cpuSeats', h)); if (!seats.length || my !== token) return;
  const seat = seats[concSeat++ % seats.length];
  const lvl = view.seats[seat] ? view.seats[seat].level : 1;
  const wait = (cur.id === 'speed' ? [1700, 1200, 800][lvl] : 600) / Math.max(0.5, 1 / SPEED()) + Math.max(0, Math.max(animUntil, cutBusy) - performance.now());
  concTimer = setTimeout(async () => {
    concTimer = null; if (my !== token || !view || view.outcome) return;
    const m = await callW('cpuChooseSeat', h, seat, 80);
    if (my !== token) return;
    if (m >= 0 && await call('playMove', h, m)) { pendSnd = m; return refresh(); }
    runConcurrent(my);
  }, wait);
}

// 制限時間(残り 5 秒から赤。0 で「ランダムな一手」か「負け」)
function stopClock() { if (clock) { clearInterval(clock.t); clock = null; } drawClock(); }
function startClock(my) {
  stopClock();
  const total = online ? 0 : +(pcfg && pcfg.limit) || 0;
  if (!total) return drawClock();
  clock = { left: total, total, t: null };
  drawClock();
  clock.t = setInterval(async () => {
    if (my !== token || !clock) return stopClock();
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
  const bar = $('#countbar'), line = $('#cline'); if (!bar) return;
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
let resultShown = -1;
function showResult() {
  const o = view.outcome;
  const pass = mode === 'pass' && view.seats.filter((s) => s.human).length >= 2;
  const solo = view.seats.length === 1;
  const win = o.winner === mySeat || (solo && o.winner === 0);
  const key = token * 10000 + view.moves;
  if (resultShown !== key) {
    resultShown = key;
    sfx.play(pass ? (o.winner < 0 ? 'DRAW' : 'WIN') : win ? 'WIN' : o.winner < 0 ? 'DRAW' : 'LOSE');
    recordStat(win, !win && o.winner >= 0);
    const winnerName = o.winner >= 0 ? (solo ? meName() : seatName(o.winner)) : '';
    const mate = /詰み|チェックメイト|checkmate/i.test(o.reason || '');
    if (cur.id === 'chess' && mate) cut({ text: 'Checkmate', tone: 'noir', font: 'yo', ms: 1600 });
    setTimeout(() => {
      if (o.winner < 0) cut({ text: '引き分け', tone: 'dark', ms: 1800 });
      else cut({ who: null, text: `${winnerName} の勝利`, tone: o.winner === mySeat || pass ? 'gold' : 'dark', ms: 2000 });
    }, cur.id === 'chess' && mate ? 1700 : 0);
  }
  const title = o.winner < 0 ? '引き分け' : solo ? (o.winner === 0 ? '成功' : '終了') : `${seatName(o.winner)} の勝利`;
  const sc = cur.id !== 'uno' && view.scores && view.scores.length >= 2 ? `<div class="rscore num">${view.scores.map((s, i) => `<span>${esc(seatName(i))} <b>${s}</b></span>`).join('')}</div>` : '';
  const two = view.seats.length === 2 && !pass && !online;
  const p = $('#result'); if (!p) return;
  if (online) {
    const ready = ost ? ost.ready.length : 0, total = ost ? ost.members.length : 0;
    const mineReady = ost && ost.ready.includes(ost.mySlot);
    p.innerHTML = `<div class="rbox"><h3>${esc(title)}</h3>${o.reason ? `<p>${esc(o.reason)}</p>` : ''}${sc}<p class="dimtxt">再戦の準備 ${ready}/${total}人</p><div class="rbtns"><button class="btn" data-olobby>同じ部屋でほかのゲーム</button><button class="btn primary" data-oagain ${!isHostRoom() && mineReady ? 'disabled' : ''}>${isHostRoom() ? 'もう一度' : mineReady ? '準備できました' : 'もう一度'}</button></div></div>`;
  } else {
    p.innerHTML = `<div class="rbox"><h3>${esc(title)}</h3>${o.reason ? `<p>${esc(o.reason)}</p>` : ''}${sc}<div class="rbtns"><button class="btn" data-go="menu">メニュー</button>${two ? `<button class="btn" data-again="${1 - lastSeat}">${mySeat === 0 ? '後手' : '先手'}でもう一度</button>` : ''}<button class="btn primary" data-again="${lastSeat}">もう一度</button></div></div>`;
  }
  setTimeout(() => { if ($('#result') && view && view.outcome) $('#result').hidden = false; }, S.set.cutin && !S.set.reduce ? 2300 : 200);
}

// 盤の上の出来事(カットイン)
function detectEvents(a, b) {
  if (!a || !b || !b.board || !a.board) return;
  const k = b.board.kind;
  if ((k === 'shogi') && b.board.check && !a.board.check && !b.outcome) cut({ text: '王手', tone: 'red', font: 'wa', ms: 1200 });
  if (k === 'chess' && b.board.check && !a.board.check && !b.outcome) cut({ text: 'Check', tone: 'noir', font: 'yo', ms: 1200 });
  const info = (x) => (x.board && (x.board.info || '')) + '';
  if (cur.id === 'daifugo' && /革命/.test(info(b)) && !/革命/.test(info(a))) cut({ text: '革命', tone: 'red', font: 'dela', ms: 1600 });
  if (cur.id === 'hanafuda' && /こいこい/.test(info(b)) && !/こいこい/.test(info(a))) cut({ text: 'こいこい', tone: 'felt', font: 'wa', ms: 1400 });
  if (k === 'mahjong') {
    const nameOf = (p) => ({ name: seatName(p), av: p === mySeat ? meAv() : '' });
    for (let p = 0; p < 4; p++) if (b.board.riichi[p] != null && a.board.riichi[p] == null) cut({ who: nameOf(p), text: 'リーチ', tone: 'china', font: 'china', ms: 1300 });
    if (b.board.result && !a.board.result) { const r = b.board.result; const w = r.winners[0]; if (/ロン/.test(r.label)) cut({ who: nameOf(w), text: 'ロン', tone: 'china', font: 'china', ms: 1500 }); else if (/ツモ/.test(r.label)) cut({ who: nameOf(w), text: 'ツモ', tone: 'china', font: 'china', ms: 1500 }); }
  }
  if (cur.id === 'uno' && b.board.tbl && a.board.tbl) {
    const topId = (x) => { const z = x.board.zones && x.board.zones[0]; return z && z.cards[0] ? z.cards[0].id : -1; };
    const ta = topId(a), tb = topId(b);
    if (tb >= 0 && tb !== ta && Math.floor(tb / 10) !== Math.floor(ta / 10)) {
      const card = Math.floor(tb / 10), k = card % 25, v = card >= 100 ? (card < 104 ? 13 : 14) : k === 0 ? 0 : (k + 1) >> 1;
      const COL = ['赤', '黄', '緑', '青'], chosen = tb % 10;
      const lm = b.board.tbl.lastMover, who = lm >= 0 ? { name: seatName(lm), av: lm === mySeat ? meAv() : '' } : null;
      const txt = { 10: 'スキップ', 11: 'リバース', 12: '+2', 13: 'ワイルド', 14: '+4' }[v];
      if (txt) cut({ afterAnim: true, _tok: token, who, text: txt, sub: v >= 13 && chosen < 4 ? COL[chosen] : '', tone: 'uno' + (v >= 13 && chosen < 4 ? chosen : Math.floor(card / 25)), font: 'mo', ms: 1300 });
    }
  }
  if (cur.id === 'uno' && /言ってない|言い忘れ/.test(info(b)) && !/言ってない|言い忘れ/.test(info(a))) cut({ text: 'Oh, No! って言ってない', sub: 'ペナルティ', tone: 'red', font: 'mo', ms: 3000 });
}
const FONT_OF = (id) => (['shogi', 'gogo', 'go', 'gomoku', 'hanafuda'].includes(id) ? 'wa' : id === 'mahjong' ? 'china' : ['uno', 'sevens', 'memory', 'speed', 'daifugo', 'solitaire'].includes(id) ? 'mo' : 'yo');
let cutBusy = 0; const cutQ = [];
function cut(c) {
  if (!S.set.cutin || S.set.reduce) return;
  const o = $('#cutlayer'); if (!o) return;
  // 前のカットインや、駒・札の動きが終わってから出す
  const wait = Math.max(cutBusy - performance.now(), c.afterAnim ? animUntil - performance.now() + 60 : 0);
  if (wait > 0 || (cutQ.length && cutQ[0] !== c)) { if (!cutQ.includes(c)) cutQ.push(c); setTimeout(() => { if (cutQ.includes(c)) cut(c); }, Math.max(40, Math.min(wait, 120))); return; }
  { const i = cutQ.indexOf(c); if (i >= 0) cutQ.splice(i, 1); }
  if (c._tok != null && c._tok !== token) return;
  cutBusy = performance.now() + c.ms * SPEED() + 300;
  document.documentElement.classList.add('cutting'); clearTimeout(cut._t); cut._t = setTimeout(() => document.documentElement.classList.remove('cutting'), c.ms * SPEED() + 200);
  const font = c.font || (cur ? FONT_OF(cur.id) : 'mo');
  const len = [...c.text].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 0.58 : 1), 0);
  const who = c.who;
  o.innerHTML = `<button class="cutin ${c.tone} f-${font} ${who && c.sub ? 'tall' : ''} ${c.soft ? 'soft' : ''}" aria-label="閉じる" tabindex="-1"><span class="veil"></span><span class="band"></span><span class="txt">${who ? `<span class="who">${who.av || ''}${esc(who.name)}</span>` : ''}<span class="mainl" style="font-size:min(${who || c.sub ? 12 : 17}cqh,${(82 / len).toFixed(1)}cqw)">${esc(c.text)}</span>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span></button>`;
  const el = o.firstChild; let done = false;
  const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 280); };
  setTimeout(end, c.ms * SPEED());
}

// CPU のカーソル(打つ場所へ動かしてから打つ)
const cursorOn = () => S.set.cursor !== '表示しない' && !S.set.reduce;
// 「あなたの番です」: 3 人以上の対局・手番ごとに交代・通信対戦で出す
function turnCut(a, b) {
  if (!b || b.outcome || concurrent || !b.human || b.toMove < 0) return;
  if (a && a.toMove === b.toMove) return;
  const multi = online || mode === 'pass' || b.seats.length >= 3;
  if (!multi) return;
  const text = mode === 'pass' ? `${b.seats[b.toMove].name} の番です` : 'あなたの番です';
  setTimeout(() => { if (view && view.toMove === b.toMove && view.human && !view.outcome) cut({ text, tone: 'gold', ms: 900, soft: true, afterAnim: true, _tok: token }); }, a ? 120 : 1450);
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
    e.animate([{ transform: `translate(${cx - (r.left + r.width / 2)}px,${cy - (r.top + r.height / 2)}px) rotate(${(i % 2 ? 1 : -1) * 25}deg) scale(.7)`, opacity: 0 }, { transform: `translate(${cx - (r.left + r.width / 2)}px,${cy - (r.top + r.height / 2)}px) scale(.7)`, opacity: 1, offset: 0.05 }, { transform: 'none', opacity: 1 }],
      { duration: 300, delay: start + i * step, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    // 神経衰弱は横 1 列で 1 回だけ鳴らす
    const newRow = mem && (rowTop == null || Math.abs(r.top - rowTop) > r.height / 2); if (newRow) rowTop = r.top;
    const firstInPile = cur.id === 'solitaire' ? e.parentElement && e.parentElement.firstElementChild === e : mem ? newRow : i % 3 === 0;
    if (firstInPile) setTimeout(() => sfx.play('DEAL', { volume: mem ? 0.4 : 0.55 }), start + i * step);
  });
  animUntil = Math.max(animUntil, performance.now() + start + list.length * step + 300);
}
// CPU の手を、人と同じ操作に見せる(動かす駒をクリック → 行き先をクリック)。見せようのないゲームでは出さない
const NO_CURSOR = new Set(['uno', 'daifugo', 'sevens', 'poker', 'holdem', 'blackjack', 'hanafuda', 'mahjong', 'speed', 'solitaire', 'hitblow']);
function aimSteps(mv) {
  const b = view && view.board; if (!b || NO_CURSOR.has(cur.id)) return [];
  const W = $('#boardwrap'), q = (sel) => (sel ? W.querySelector(sel) || $(sel) : null), seat = view.toMove;
  const btn = (re) => [...document.querySelectorAll('#acts button, #boardwrap [data-roll]')].find((x) => re.test(x.textContent) || (x.dataset.roll != null && re.test('roll')));
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
    case 'life': return mv === 0 || (mv > 200 && mv < 211) ? [q('[data-spin]')] : [q(`[data-lm="${mv}"]`)];
    default: return [];
  }
}
async function runCursor(mv, my) {
  if (!cursorOn() || !view) return;
  const steps = aimSteps(mv).filter(Boolean).filter((e, i, l) => i === 0 || e !== l[i - 1]); if (!steps.length) return;
  const stage = $('.stage'); if (!stage) return;
  const f = (PACE[S.set.cpuLen] || 450) / 450 * Math.max(0.4, SPEED());
  const r0 = stage.getBoundingClientRect();
  let c = $('#cpuCur');
  if (!c) { stage.insertAdjacentHTML('beforeend', rcurHtml('cpuCur', seatName(view.toMove), '#C8463C', true)); c = $('#cpuCur'); c.style.transform = `translate(${r0.width * 0.5}px,${r0.height + 20}px)`; c.getBoundingClientRect(); }
  c.style.transitionDuration = Math.round(420 * f) + 'ms';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let k = 0; k < steps.length; k++) {
    const el = steps[k]; if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const quick = el.matches('.yd') ? 0.4 : 1; c.style.transitionDuration = Math.round(420 * f * quick) + 'ms';
    c.style.transform = `translate(${r.left - r0.left + r.width * 0.5}px,${r.top - r0.top + r.height * 0.55}px)`;
    await wait(470 * f * quick); if (my !== token) return;
    c.classList.remove('click'); void c.offsetWidth; c.classList.add('click');
    sfxClick();
    // 動かす駒を選んだ印
    if (el.matches('.yd')) el.classList.toggle('held');
    else if (k < steps.length - 1 && steps[k + 1] !== el) { const ring = document.createElement('div'); ring.className = 'aimring'; Object.assign(ring.style, { left: r.left - r0.left + 'px', top: r.top - r0.top + 'px', width: r.width + 'px', height: r.height + 'px' }); stage.appendChild(ring); }
    await wait((k === steps.length - 1 ? 160 : el.matches('.yd') ? 90 : 230) * f); if (my !== token) return;
  }
}
function sfxClick() { if (!S.set.sound || !S.set.hover || !AX) return; try { const t = AX.currentTime, o = AX.createOscillator(), g = AX.createGain(); o.type = 'square'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.012); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.04); } catch (e) {} }
const hideCursor = () => { const c = $('#cpuCur'); if (c) c.remove(); document.querySelectorAll('.aimring').forEach((e) => e.remove()); };
const rcurHtml = (id, name, color, turn) => `<div class="rcur ${turn ? 'turn' : ''}" id="${id}" style="--cc:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l15 8.500-6.500 1.800L9.500 20z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="tag"><i>${esc(name[0])}</i>${esc(name)}</span></div>`;

// ---------------------------------------------------------------- 成績
function records() {
  const st = store.get('stats', {});
  const rows = ORDER.map((id) => [gInfo(id), st['vs_' + id], st['solo_' + id]]).filter(([g, a, b]) => g && (a || b));
  return `<div class="screen">${rail('records')}<div class="main"><h2 class="pagehead">成績</h2>
   ${rows.length ? `<div class="panel tablescroll" style="max-width:760px"><table class="rec"><tr><th>ゲーム</th><th>勝ち</th><th>負け</th><th>引き分け</th><th>勝率</th></tr>${rows.map(([g, a, b]) => {
     if (b && !a) return `<tr><td><b>${esc(g.name)}</b></td><td colspan="4" class="num">${b[0]}回 遊んだ</td></tr>`;
     const n = a[0] + a[1] + a[2]; return `<tr><td><b>${esc(g.name)}</b></td><td class="num">${a[0]}</td><td class="num">${a[1]}</td><td class="num">${a[2]}</td><td class="num">${n ? Math.round(a[0] / n * 100) : 0}%</td></tr>`; }).join('')}</table></div>`
     : '<div class="panel" style="max-width:760px"><div class="row"><span class="dimtxt">まだ記録がありません(CPUとの対戦の結果を記録します)</span></div></div>'}
  </div></div>`;
}

// ---------------------------------------------------------------- 設定
const SCAT = [['game', '対局'], ['view', '表示'], ['sound', 'サウンド'], ['ctrl', '操作'], ['prof', 'プロフィール'], ['data', 'データ'], ['about', 'アプリについて']];
const KEYNAME = { back: '戻る', full: '全画面', undo: '待った', chat: 'チャットを送る', bgm: 'BGM 再生/一時停止', mute: '消音' };
const SDEF = {
  game: [['置ける場所の表示', 'sw', 'hints'], ['取れる駒の表示', 'sw', 'caps'], ['仮置きする', 'sw', 'pre'], ['CPUの強さ', 'seg', 'cpuLv', LV], ['CPUの手番の長さ', 'seg', 'cpuLen', ['短い', 'ふつう', '長い']], ['相手のカーソル', 'seg', 'cursor', ['表示しない', '手番のみ', '全員']], ['カットイン', 'sw', 'cutin'], ['アニメーションの速度', 'seg', 'speed', ['ゆっくり', 'ふつう', '速い']]],
  view: [['テーマ', 'theme'], ['画面', 'seg', 'win', ['ウィンドウ', '全画面']], ['ウィンドウの大きさ', 'sel', 'res', ['1280×720', '1366×768', '1600×900', '1920×1080', '2560×1440']], ['文字と部品の大きさ', 'seg', 'scale', ['100%', '125%', '150%']], ['盤の質感', 'seg', 'look', ['軽量', '標準']], ['アニメーションの省略', 'sw', 'reduce'], ['チャットの通知', 'sw', 'notify']],
  sound: [['全体の音量', 'rng', 'master'], ['効果音', 'sw', 'sound'], ['効果音の音量', 'rng', 'sfxVol'], ['カーソル音', 'sw', 'hover'], ['チャットの通知音', 'sw', 'chatSnd'], ['BGM', 'sw', 'bgm'], ['BGMの音量', 'vol'], ['無効のBGM', 'btn', '選ぶ', 'data-modal="bgmoff"'], ['バックグラウンドでも音を鳴らす', 'sw', 'bgSound']],
  ctrl: Object.keys(KEYNAME).map((k) => [KEYNAME[k], 'key', k]).concat([['駒の動かし方', 'seg', 'drag', ['クリック', 'ドラッグ', '両方']]]),
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
  else if (t === 'img') c = `<span class="ctl"><img src="${k}" alt="" width="72" height="72" style="margin:6px auto"></span>`;
  else if (t === 'txt') c = `<span class="ctl"><b class="num" style="flex:1;text-align:center">${k}</b></span>`;
  else if (t === 'name') c = `<span class="field"><input id="nameIn" value="${esc(S.set.name)}" maxlength="12" placeholder="あなた" aria-label="表示名"></span>`;
  else if (t === 'icon') c = `<span class="ctl">${meAv()}<button class="btn" style="height:38px;flex:1" data-modal="avatar">選ぶ</button></span>`;
  const sub = l === '保存の場所' ? `<small class="sub path">${esc(S.dataPath || (window.__TAURI__ ? '' : 'このブラウザの中(localStorage)'))}</small>` : '';
  return `<div class="row"><span>${l}${sub}</span>${c}</div>`;
}
if (window.__TAURI__) window.__TAURI__.core.invoke('data_folder_path').then((p) => { S.dataPath = p; if (S.screen === 'settings') render(); }).catch(() => {});
const keyLabel = (k) => String(k).replace('Escape', 'Esc');
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
  const secs = JSON.parse(await callW('rulesJson', S.rulesId));
  b.innerHTML = secs.length ? RULES.html(S.rulesId, secs) : '<p>ルールの説明はまだありません</p>';
  RULES.start(b);
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
  document.documentElement.classList.toggle('lite', S.set.look === '軽量');
  document.documentElement.classList.toggle('reduce', !!S.set.reduce);
  { const z = S.set.scale === '100%' ? 1 : parseInt(S.set.scale, 10) / 100; document.body.style.zoom = z === 1 ? '' : z;
    // 拡大した時も、画面からはみ出さないように(ウィンドウの大きさを拡大の分だけ割る)
    document.body.style.height = z === 1 ? '' : (100 / z) + 'vh'; document.body.style.width = z === 1 ? '' : (100 / z) + 'vw'; }
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = S.theme;
  const screens = { first, menu, setup, play, settings, records, room };
  if (S.screen === 'setup' && !gInfo(S.setup.id)) S.screen = 'menu';
  const fa = document.activeElement, fKey = fa && fa !== document.body && app.contains(fa) ? Object.entries(fa.dataset).slice(0, 2).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${CSS.escape(v)}"]`).join('') : '';
  const oldMain = $('.main'), keepTop = oldMain && lastScreen === S.screen ? oldMain.scrollTop : null;
  const oldBody = $('.setupbody'), keepBody = oldBody && lastScreen === S.screen ? oldBody.scrollTop : null;
  app.innerHTML = (screens[S.screen] || menu)();
  const newMain = $('.main'); if (newMain) newMain.scrollTop = keepTop != null ? keepTop : ((S.scrollMem || {})[S.screen] || 0);
  const newBody = $('.setupbody'); if (newBody && keepBody != null) newBody.scrollTop = keepBody;
  if (lastScreen !== S.screen && S.screen === 'menu' && S.sel) { const t = $(`[data-tile="${S.sel}"]`); if (t) t.scrollIntoView({ block: 'nearest' }); }
  if (lastScreen !== S.screen && /^(menu|room|records|settings)$/.test(S.screen) && lastScreen && lastScreen !== 'first') { const m = $('.main'); if (m) m.classList.add('enter'); }
  lastScreen = S.screen;
  if (S.focusSel) { const f = $(S.focusSel); S.focusSel = null; if (f) f.focus({ preventScroll: true }); }
  else if (fKey && lastScreenFocus === S.screen) { const f = $(fKey); if (f) f.focus({ preventScroll: true }); }
  lastScreenFocus = S.screen;
  if (S.modal === 'bgmoff') app.insertAdjacentHTML('beforeend', bgmOffModal());
  if (S.modal === 'avatar') app.insertAdjacentHTML('beforeend', avatarModal());
  if (S.modal === 'license') { app.insertAdjacentHTML('beforeend', licenseModal()); fillLicenses(); }
  if (S.modal === 'rules') { app.insertAdjacentHTML('beforeend', rulesModal()); fillRules(); }
  if (S.modal === 'list') { app.insertAdjacentHTML('beforeend', listModal()); fillList(); }
  // 窓を開いた時だけ、ふわっと出す(中身の描き直しでは出し直さない)
  if (S.modal && S.modal !== lastModal) { const m = app.querySelector(':scope > .modal:last-of-type'); if (m) m.classList.add('pop'); }
  lastModal = S.modal;
  if (S.screen === 'play') { if (view) drawPlay(true); if (view && view.outcome) showResult(); }
  if (S.screen === 'room') afterRoom();
  const log = $('#log'); if (log) log.scrollTop = log.scrollHeight;
  bgmSync();
}

// ---------------------------------------------------------------- シート(小さな確認の窓)
// アプリを終了する前の確認(メニューの「終了する」と、ウィンドウ・タスクバーの ×)
function askQuitApp() {
  if ($('#qaYes')) return; // もう出ている
  setTimeout(focusPrimary, 0); openSheet('<h2>アプリを終了しますか</h2><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="qaYes">終了する</button></div>'); $('#qaYes').onclick = () => { closeSheet(); if (window.__TAURI__) window.__TAURI__.core.invoke('quit_app').catch(() => window.close()); else { window.close(); setTimeout(() => toast({ w: 'お知らせ', t: 'ブラウザの見本では、アプリを閉じられません(exe では閉じます)' }), 300); } };
}
function openSheet(html) {
  closeSheet();
  app.insertAdjacentHTML('beforeend', `<div class="modal pop" id="sheetwrap"><button class="mback" data-sheetback aria-label="閉じる"></button><div class="mbox sheet" id="sheet" role="dialog">${html}</div></div>`);
}
function closeSheet() { const s = $('#sheetwrap'); if (s) s.remove(); }
function focusPrimary() { setTimeout(() => { const b = $('#sheet .btns .btn:last-child') || $('#sheet .btn.gold'); if (b) b.focus({ preventScroll: true }); }, 0); }

// ---------------------------------------------------------------- 操作
function startGame() {
  if (S.setup.online) return onlineChooseAndStart();
  startMatch(null);
}
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  clickSound(b, d);
  if (d.sheetback != null) return closeSheet();
  if (d.dd) { if (ddOpen === d.dd) return ddClose(true); ddOpen = d.dd; S.focusSel = `.ddopt.on`; return render(); }
  if (d.ddv != null) { const k = d.ddk; S.set[k] = d.ddv; saveSet(); if (k === 'res') setWinSize(d.ddv); ddOpen = null; S.focusSel = `[data-dd="${k}"]`; return render(); }
  if (d.go && S.screen === 'play' && !b.closest('.rbox')) return goBack();
  if (d.go) { if (d.go === 'room' && S.screen === 'play' && online) { leavePlay(); S.screen = 'room'; return render(); } return go(d.go); }
  if (d.quitapp != null) return askQuitApp();
  if (d.goprof != null) { S.scat = 'prof'; return go('settings'); }
  if (d.tile) { const id = d.tile; if ((S.sel === id || e.detail === 0) && playable(id)) { if (e.detail === 0) S.focusSel = '[data-start]'; S.setup = { id, online: false }; return go('setup'); } S.sel = id; S.focusSel = `[data-tile="${id}"]`; return render(); }
  if (d.next != null) { S.setup = { id: S.sel, online: false }; return go('setup'); }
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
  if (d.scat) { const ch = S.scat !== d.scat; S.scat = d.scat; S.rekey = null; render(); if (ch) { const p = $('.setpanel'); if (p) p.classList.add('enter'); } return; }
  if (d.av != null) { S.set.av = d.av === 'photo' ? 'photo' : +d.av < 0 ? null : +d.av; saveSet(); return render(); }
  if (d.rekey) { S.rekey = S.rekey === d.rekey ? null : d.rekey; return render(); }
  if (d.clear) return askClear(d.clear);
  if (d.openfolder != null) return openDataFolder();
  if (d.firstdone != null) { S.set.name = ($('#nameIn') && $('#nameIn').value.trim()) || S.set.name; saveSet(); store.set('firstDone', true); return go('menu'); }
  if (d.photo != null) return pickPhoto();
  if (d.stopen != null) { S.stOpen = !S.stOpen; return render(); }
  if (d.stamp != null) { S.stOpen = false; return sendChat(null, +d.stamp); }
  if (d.sw) {
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
    if (k === 'filter') S.filter = v;
    else if (k === 'theme') { S.theme = v; saveSet(); }
    else if (k.startsWith('c:')) { const c = cfg(S.setup.id), f = k.slice(2); c[f] = /^(level|seat|limit)$/.test(f) ? +v : v; saveCfg(S.setup.id, c); }
    else if (k.startsWith('o:')) { const c = cfg(S.setup.id); c.opts[k.slice(2)] = v; saveCfg(S.setup.id, c); syncOnlineOptions(); }
    else if (k in S.set || k === 'res') { S.set[k] = v; saveSet(); if (k === 'win') setFullscreen(v === '全画面'); if (k === 'res') setWinSize(v); }
    return render();
  }
});
app.addEventListener('submit', (e) => { e.preventDefault(); const i = $('#chatin'); if (i && i.value.trim()) { sendChat(i.value.trim()); i.value = ''; } });
app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'nameIn') { S.set.name = t.value.trim().slice(0, 12); saveSet(); return; }
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
  sel = null; prevView = null;
  const p = $('#result'); if (p) p.hidden = true;
  await refresh();
}
function quitSound() { if (!cur || (view && view.outcome)) return; (cur.category === 'BOARD' && cur.id !== 'mahjong' ? sfxCrumble : sfxCardsFall)(); }
function askQuit() {
  setTimeout(focusPrimary, 0); openSheet(`<h2>対局を終了しますか</h2><p>${online ? '部屋に戻ります。' : '途中の対局は「続きから」で再開できます。'}</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn gold" id="qtYes">終了する</button></div>`);
  $('#qtYes').onclick = () => { closeSheet(); quitSound(); go(online ? 'room' : 'menu'); };
}
function askResign() {
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
    S.set.photo = c.toDataURL('image/jpeg', 0.85); S.set.av = 'photo'; saveSet(); render();
  };
  img.src = URL.createObjectURL(file);
}
async function setWinSize(v) {
  const [w, hgt] = String(v).split('×').map(Number); if (!w) return;
  try { if (window.__TAURI__) { const W = window.__TAURI__.window, win = W.getCurrentWindow(); if (S.set.win === '全画面') { S.set.win = 'ウィンドウ'; saveSet(); await win.setFullscreen(false); } await win.setSize(new (window.__TAURI__.dpi ? window.__TAURI__.dpi.LogicalSize : W.LogicalSize)(w, hgt)); await win.center(); } else toast({ w: 'お知らせ', t: 'ブラウザの見本では、ウィンドウの大きさは変えられません(exe では変わります)' }); } catch (e) { toast({ w: 'お知らせ', t: '大きさを変えられませんでした' }); }
}
async function setFullscreen(on) {
  try {
    if (window.__TAURI__) { await window.__TAURI__.window.getCurrentWindow().setFullscreen(on); return; }
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {}
}

// キー
// 戻る(Esc・マウスの戻るボタン)
function goBack() {
  const snd = () => sfx.play('BACK');
  if ($('#sheetwrap')) { snd(); return closeSheet(); }
  if (S.stOpen) { snd(); S.stOpen = false; return render(); }
  if (S.modal) { snd(); S.modal = null; return render(); }
  if (S.screen !== 'menu' && S.screen !== 'first') snd();
  if (S.screen === 'play') {
    // 対局中は確かめてから終わる(まだ 1 手も指していない時は、そのまま戻る。通信対戦はいつも確かめる)
    if (online || (view && view.moves > 0 && !view.outcome)) return askQuit();
    quitSound(); return go(online ? 'room' : 'menu');
  }
  if (S.screen === 'setup') return go(S.setup.online ? 'room' : 'menu');
  if (S.screen === 'settings' || S.screen === 'records' || S.screen === 'room') return go('menu');
}
window.addEventListener('mousedown', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); goBack(); } else if (e.button === 4) e.preventDefault(); });
// 矢印キーで、押せる所を移る(Enter で押す)
function navMove(key) {
  const scope = $('#sheetwrap') || $('.modal') || app;
  const all = [...scope.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type=hidden])')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !x.closest('[hidden]') && !x.matches('.mback,.cutin,.switch[aria-hidden]'); });
  if (!all.length) return;
  let curEl = document.activeElement;
  if (!curEl || !all.includes(curEl)) { const pick = (S.sel && scope.querySelector(`[data-tile="${S.sel}"]`)) || scope.querySelector('[aria-pressed="true"][data-tile]') || all[0]; return focusNav(pick); }
  const a = curEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
  let best = null, bs = Infinity;
  for (const x of all) { if (x === curEl) continue; const r = x.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const main = dx * dir[0] + dy * dir[1]; if (main <= 4) continue; const side = Math.abs(dx * dir[1] + dy * dir[0]); const sc = main + side * 2.2; if (sc < bs) { bs = sc; best = x; } }
  if (best) focusNav(best);
}
function focusNav(el) {
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
  if (!S.set.sound || !S.set.hover || !AX) return; const now = performance.now(); if (now - hvT < 45) return; hvT = now;
  const t = AX.currentTime, o = AX.createOscillator(), g = AX.createGain(), f = AX.createBiquadFilter(); o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.035);
  f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(f); f.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.08);
}
document.addEventListener('pointerdown', (e) => { if (ddOpen && !e.target.closest('.dd')) ddClose(false); });
document.addEventListener('pointerdown', () => { try { AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); } catch (e) {} }, { once: true });
document.addEventListener('mouseover', (e) => { const b = e.target.closest && e.target.closest('button'); if (b === hvEl) return; hvEl = b; if (b && !b.disabled && !b.matches('.cell,.scell,.c4cell,.card,.cutin,.toast,.cd,.hk')) sfxHover(); });
// 画面のボタンの音。ゲームを決めて設定へ進む時と、スタートの時だけ特別な音
const uiGain = () => S.set.master / 100 * S.set.sfxVol / 100;
function uiCtx() { if (!S.set.sound) return null; try { AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); return AX; } catch (e) { return null; } }
function note(ax, f, t, dur, vol, type = 'sine', to) {
  const o = ax.createOscillator(), g = ax.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * uiGain() + 0.0002, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ax.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(ax, t, dur, vol, freq, q = 1.2) {
  const n = Math.max(1, Math.floor(ax.sampleRate * dur)), b = ax.createBuffer(1, n, ax.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ax.createBufferSource(), f = ax.createBiquadFilter(), g = ax.createGain(); src.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
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
  if (d.next != null || (d.tile && S.sel === d.tile)) return sfxGo();
  if (d.again != null || d.resume != null) return sfxStart();
  sfx.play(b.getAttribute('aria-label') === '戻る' || d.mclose != null || d.mback != null || d.sheetback != null ? 'BACK' : 'TAP');
}
function sfxPop(up) {
  if (!S.set.sound || !S.set.chatSnd) return;
  try {
    AX = AX || new (window.AudioContext || window.webkitAudioContext)(); AX.resume(); const t = AX.currentTime + 0.01, o = AX.createOscillator(), g = AX.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(up ? 420 : 980, t); o.frequency.exponentialRampToValueAtTime(up ? 1250 : 520, t + 0.075); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * S.set.master / 100 * S.set.sfxVol / 100 + 0.0002, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(AX.destination); o.start(t); o.stop(t + 0.16);
  } catch (e) {}
}

// ---------------------------------------------------------------- 通知(右上。クリックで消える・払うと飛んでいく)
let tt; const toastEl = $('#toast');
function toast(m) {
  if (m.chat && !S.set.notify) return;
  toastEl.style.transition = 'none'; toastEl.style.transform = '';
  toastEl.innerHTML = `<small>${esc(m.w)}</small>${m.s != null ? stamp(m.s) : esc(m.t)}`; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(toastHide, 3000);
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
    CAT = JSON.parse(await callW('catalogJson'));
    sfx.enabled = S.set.sound;
    S.screen = store.get('firstDone', false) ? 'menu' : 'first';
    render();
    sfx.init();
    // 起動してすぐ BGM を流す(exe はクリックを待たずに鳴る。ブラウザでは最初のクリックで鳴り始める)
    try { bgCtx(true); } catch (e) {}
    // exe: ウィンドウ・タスクバーの × では、確認を出してから終わる(受け取ったことを先に知らせる。知らせが無ければ exe 側で閉じる)
    if (window.__TAURI__ && window.__TAURI__.event) window.__TAURI__.event.listen('asobi-close', () => { window.__TAURI__.core.invoke('close_ack').catch(() => {}); sfx.play('TAP'); askQuitApp(); });
    if (S.set.win === '全画面') setFullscreen(true);
  } catch (e) { app.innerHTML = `<div class="empty">読み込みに失敗しました: ${esc(e.message)}</div>`; }
})();
