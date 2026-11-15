/* みんなで遊ぶ(招待コード方式)。部屋・招待コード・手の受け渡しは Android 版と同じ Kotlin のコード(core の OnlineRoom)。
 * 通信の手順は 2(Android 版・WEB 版と同じ)。スタンプは 0〜15 だけを送る(16 以降は三者がそろってから)。 */
'use strict';
let ost = null, lastBeginSeq = 0, onlineBusy = false, lastFlash = '0|', askShown = -1, chatSeen = 0, netReady = false;
const drafts = { join: '', replies: {} };
const isHostRoom = () => ost && ost.role === 'host';
const ONLINE_STAMPS = 16;
const SEAT_COLORS = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'];

async function ensureNet() {
  if (netReady) return; await coreReady;
  const { createNet } = await import('./net.js');
  createNet(mainCore, { changed: () => queueMicrotask(onlineChanged) });
  netReady = true;
}
const cpuLvForRoom = () => lvIndex(S.set.cpuLv);

function chatBox() {
  const list = online || (ost && ost.role !== 'none') ? (ost ? ost.chat : []) : [];
  const n = online ? ONLINE_STAMPS : ONLINE_STAMPS;
  return `<div class="chat"><div class="log" id="log">${list.length ? list.map((m) => { const mine = ost && m.slot === ost.mySlot; return `<div class="msg ${mine ? 'mine' : ''} ${m.kind === 1 ? 'st' : ''}">${mine ? '' : `<small>${esc(m.name)}</small>`}${m.kind === 1 ? stamp(+m.body) : esc(m.body)}</div>`; }).join('') : '<div class="dimtxt">チャットはまだありません</div>'}</div>
   ${S.stOpen ? `<div class="stpanel">${STAMPS.slice(0, n).map((s, i) => `<button type="button" data-stamp="${i}" title="${s[0]}" aria-label="${s[0]}">${stamp(i)}</button>`).join('')}</div>` : ''}
   <form id="chatf"><button type="button" class="stbtn" data-stopen aria-expanded="${S.stOpen}" aria-label="スタンプ" ${ost && ost.chatOk ? '' : 'disabled'}>${ic('smile')}</button><input id="chatin" placeholder="メッセージ" maxlength="40" autocomplete="off" aria-label="メッセージ" ${ost && ost.chatOk ? '' : 'disabled'}><button ${ost && ost.chatOk ? '' : 'disabled'}>送る</button></form></div>`;
}
function sendChat(t, st) {
  if (!mainCore || !ost) return;
  const ok = st != null ? mainCore.onlineSendChat(1, String(st)) : mainCore.onlineSendChat(0, t);
  if (ok) sfxPop(true); else toast({ w: 'お知らせ', t: '少し待ってから送ってください' });
  if (st != null) render();
}

// ---------------------------------------------------------------- 部屋の画面
function room() {
  const st = ost || { role: 'none', members: [], invites: [], join: {} };
  const host = st.role === 'host', guest = st.role === 'guest', none = st.role === 'none';
  const j = st.join || {};
  const g = st.gameId && gInfo(st.gameId);
  let left = '';
  // 部屋を作る(招待コードを作るを一番上に)
  left += `<div class="panel" style="padding-bottom:12px"><h3>部屋を作る</h3>
     <button class="btn primary" style="width:100%;margin-top:6px;letter-spacing:.1em" data-mkcode ${guest || (host && !st.canCreate) ? 'disabled' : ''}>${st.creating ? '作っています…' : '招待コードを作る'}</button>
     ${(st.invites || []).map((v) => inviteBox(v)).join('')}
     ${st.bookError ? `<p class="err">${esc(st.bookError)}</p>` : ''}</div>`;
  // 部屋に入る
  if (!host) {
    let inner = '';
    if (j.reply) {
      const sent = j.auto === 'SENT', sending = j.auto === 'SENDING';
      inner = `<p>${sent ? '返信をホストに届けました。つながるのを待っています…' : sending ? '返信をホストに届けています…' : 'この返信コードをホストに送ってください'}</p>${sent || sending ? '' : `<div class="code" id="replyCode">${esc(j.reply)}</div><button class="btn" data-copy="${esc(j.reply)}" style="height:38px">${ic('copy')}コピー</button>`}<button class="btn" data-joinreset style="height:38px;margin-left:8px">やり直す</button>`;
    } else if (j.busy) inner = '<p>返信コードを作っています…</p>';
    else inner = `${j.error ? `<p class="err">${esc(j.error)}</p>` : ''}<div class="codebox"><input id="joinIn" placeholder="AS2O-…" value="${esc(drafts.join)}" aria-label="招待コード" spellcheck="false"><button class="btn" style="height:38px" data-join>入る</button></div>`;
    left += `<div class="panel" style="padding-bottom:10px"><h3>部屋に入る</h3>${guest && st.phase !== 'JOINING' ? '<p>部屋に入りました</p>' : inner}</div>`;
  }
  // 参加者
  if (!none) left += `<div class="panel" style="padding-bottom:10px"><h3>参加者 ${st.members.length}/6</h3><div class="seats" style="padding-top:6px">${st.members.map((m, i) => `<div class="seat">${m.slot === st.mySlot ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}<span class="nm">${esc(m.name)}${m.slot === st.mySlot ? '(あなた)' : ''}<small>${m.slot === 0 ? 'ホスト' : '参加者'}</small></span></div>`).join('')}</div>
    ${st.legacy && st.legacy.length ? `<p class="dimtxt">${st.legacy.map(esc).join('・')}のアプリが古い版です。「待った」・チャット・時間切れの「負け」は使えません。</p>` : ''}
    ${st.transportError ? `<p class="err">${esc(st.transportError)}</p>` : ''}
    <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn" data-leave style="height:38px">部屋を出る</button></div></div>`;
  if (!none) left += `<div style="height:260px;display:flex">${chatBox().replace('class="chat"', 'class="chat" style="flex:1"')}</div>`;
  // 遊ぶゲーム
  let right = '';
  if (host) {
    const blocked = new Set();
    for (const id of ORDER) { try { if (JSON.parse(mainCore.onlineMismatch(id)).length) blocked.add(id); } catch (e) {} }
    right = `<div class="panel"><h3>遊ぶゲーム</h3><div class="glist">${ORDER.map((id) => gInfo(id)).filter((x) => x && playable(x.id) && range(x.players)[1] >= st.members.length).map((x) => `<button data-pick="${x.id}" class="${S.roomPre === x.id ? 'pre' : ''} ${st.gameId === x.id ? 'set' : ''}" ${blocked.has(x.id) ? 'disabled title="版が違う人がいるので選べません"' : ''}><span class="mini">${artOf(x.id)}</span><span class="gn">${dispName(x)}</span><em>${st.gameId === x.id ? '決定' : ''}</em></button>`).join('')}</div>
      ${blocked.size ? `<p class="dimtxt">版が違う人がいるので、選べないゲームがあります。</p>` : ''}</div>
      <div style="display:flex;justify-content:flex-end"><button class="btn primary" style="flex:none;width:280px" data-roomnext ${S.roomPre || st.gameId ? '' : 'disabled'}>進む</button></div>`;
  } else if (guest && g) {
    right = `<div class="panel"><h3>遊ぶゲーム</h3><div class="hero" style="margin:8px 0"><span class="art">${artOf(g.id)}</span><div><h2>${esc(g.name)}</h2><p>ホストが選んでいます</p></div></div>${st.phase === 'LOBBY' ? '<p class="dimtxt">ホストが始めるのを待っています</p>' : ''}</div>`;
  } else {
    right = `<div class="panel"><h3>遊び方</h3><div class="howto"><p><b>部屋を作る人</b>: 「招待コードを作る」を押して、できたコードを相手に送ります。</p><p><b>入る人</b>: 届いたコードを「部屋に入る」に貼って「入る」を押します。</p><p class="dimtxt">アプリ版・WEB版の人とも同じ部屋で遊べます。</p></div></div>`;
  }
  return `<div class="screen">${rail('room')}<div class="main"><h2 class="pagehead">みんなで遊ぶ</h2><div class="cols"><div class="stack">${left}</div><div class="stack">${right}</div></div>
   <p class="privacy">つなぐ時だけ、公開の中継サーバー(ntfy.sh)と STUN サーバーを使います。あなたと相手の IP アドレスが、これらのサーバーに伝わります。</p></div></div>`;
}
function inviteBox(v) {
  const msg = v.state === 'CONNECTING' ? 'つないでいます…' : v.state === 'FAILED' ? 'つながりませんでした' + (v.error ? `(${esc(v.error)})` : '') : v.state === 'OPEN' || v.state === 'DONE' ? 'つながりました'
    : v.auto === 'LISTENING' ? 'この招待コードを送ってください。相手が貼ると自動でつながります' : v.auto === 'STARTING' ? 'この招待コードを送ってください' : 'この招待コードを送り、相手の返信コードを下に貼ってください';
  const waiting = v.state === 'WAITING_REPLY';
  return `<div class="invite"><p>${msg}</p>${waiting ? `<div class="code">${esc(v.code)}</div><div class="hrow"><button class="btn" data-copy="${esc(v.code)}" style="height:38px">${ic('copy')}コピー</button></div>
    <div class="codebox"><input data-reply="${v.i}" placeholder="返信コード(AS2A-…)" value="${esc(drafts.replies[v.i] || '')}" aria-label="返信コード" spellcheck="false"><button class="btn" style="height:38px" data-sendreply="${v.i}">つなぐ</button></div>` : ''}
    ${v.state !== 'OPEN' && v.state !== 'DONE' ? `<div style="text-align:right"><button class="btn" data-cancelinv="${v.i}" style="height:34px">取り消す</button></div>` : ''}</div>`;
}
function afterRoom() {
  const ji = $('#joinIn'); if (ji) ji.oninput = () => (drafts.join = ji.value);
  document.querySelectorAll('[data-reply]').forEach((x) => (x.oninput = () => (drafts.replies[x.dataset.reply] = x.value)));
}
function onlineClick(d) {
  if (d.mkcode != null) { (async () => { await ensureNet(); if (!ost || ost.role === 'none') { mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineHost(meName()); lastBeginSeq = 0; } mainCore.onlineInviteCreate(); onlineChanged(); })(); return true; }
  if (d.join != null) { const v = ($('#joinIn') || {}).value || ''; if (!v.trim()) return true; (async () => { await ensureNet(); mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineJoin(meName(), v.trim()); lastBeginSeq = 0; onlineChanged(); })(); return true; }
  if (d.joinreset != null) { mainCore.onlineJoinReset(); onlineChanged(); return true; }
  if (d.copy) { navigator.clipboard.writeText(d.copy).then(() => toast({ w: 'お知らせ', t: 'コピーしました' }), () => toast({ w: 'お知らせ', t: 'コピーできませんでした。選んでコピーしてください' })); return true; }
  if (d.sendreply != null) { const i = +d.sendreply, t = (drafts.replies[i] || '').trim(); if (t) { mainCore.onlineInviteReply(i, t); drafts.replies[i] = ''; } return true; }
  if (d.cancelinv != null) { mainCore.onlineInviteCancel(+d.cancelinv); return true; }
  if (d.leave != null) { leaveOnline(); render(); return true; }
  if (d.pick) { if (S.roomPre === d.pick || (ost && ost.gameId === d.pick)) { chooseOnline(d.pick); } else { S.roomPre = d.pick; render(); } return true; }
  if (d.roomnext != null) { chooseOnline(S.roomPre || ost.gameId); return true; }
  if (d.oagain != null) { mainCore.onlineAgain(); if (isHostRoom()) { const names = () => ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => esc(m.name)).join('・'); openSheet(`<h2>もう一度</h2><p id="readyNames">準備ができた人: ${names()}</p><div class="btns"><button class="btn" data-sheetback>待つ</button><button class="btn gold" id="rgo">この人たちで始める</button></div>`); $('#rgo').onclick = () => { closeSheet(); mainCore.onlineStartReady(String(Math.floor(Math.random() * 2 ** 40) + 1)); }; } return true; }
  if (d.olobby != null) { mainCore.onlineBackToLobby(); return true; }
  return false;
}
function chooseOnline(id) {
  if (!id) return;
  S.roomPre = null;
  if (!ost || ost.gameId !== id) mainCore.onlineChoose(id, '');
  S.setup = { id, online: true };
  go('setup');
}
// 部屋の設定画面で変えたルールを部屋に伝える(ホストだけ)
function syncOnlineOptions() {
  if (!S.setup.online || !isHostRoom()) return;
  const g = gInfo(S.setup.id), c = cfg(g.id);
  mainCore.onlineChoose(g.id, engineOpts(g, c));
}
function onlineChooseAndStart() {
  if (!isHostRoom()) return toast({ w: 'お知らせ', t: 'ホストが始めるのを待っています' });
  syncOnlineOptions();
  const ok = mainCore.onlineStart(String(Math.floor(Math.random() * 2 ** 40) + 1));
  if (!ok) toast({ w: 'お知らせ', t: '人数がこのゲームの席より多いか、このゲームを遊べない人がいます' });
}
function leaveOnline() {
  if (mainCore) mainCore.onlineLeave();
  online = false; token++; ost = null; S.roomPre = null; lastBeginSeq = 0; chatSeen = 0; closeSheet();
}
async function startOnlinePlay(handle) {
  online = true; token++; sel = null; prevView = null; mode = 'online'; h = handle;
  cur = gInfo(ost.gameId) || cur; pcfg = cfg(cur.id);
  S.setup = { id: cur.id, online: true };
  const v0 = JSON.parse(mainCore.viewJson(h, 0));
  mySeat = v0.mine >= 0 ? v0.mine : 0;
  enterPlay();
}

// ---------------------------------------------------------------- 部屋の変化
function onlineChanged() {
  if (!mainCore) return;
  ost = JSON.parse(mainCore.onlineState());
  if (ost.closed) { const msg = ost.closed; leaveOnline(); S.screen = 'room'; render(); return toast({ w: 'お知らせ', t: msg }); }
  // お知らせ・チャットの通知
  if (ost.flash !== lastFlash) {
    lastFlash = ost.flash; const t = ost.flash.slice(ost.flash.indexOf('|') + 1);
    if (t) { if (/全員が了承/.test(t)) cut({ text: '待った', tone: 'felt', ms: 1200 }); else toast({ w: 'お知らせ', t }); }
  }
  const nChat = (ost.chat || []).length;
  if (nChat > chatSeen) { const m = ost.chat[nChat - 1]; if (m.slot !== ost.mySlot) { sfxPop(false); toast({ w: m.name, t: m.kind === 0 ? m.body : null, s: m.kind === 1 ? +m.body : null, chat: true }); } chatSeen = nChat; }
  // 待ったの依頼
  const ask = ost.undoAsk;
  if (ask && !ask.mine && askShown !== ask.id) { askShown = ask.id; showAsk(ask); }
  else if (!ask && askShown >= 0) { askShown = -1; const a = $('#askcard'); if (a) a.remove(); }
  // 対局の開始・終了
  if (ost.beginSeq !== lastBeginSeq) { lastBeginSeq = ost.beginSeq; if (ost.match >= 0) return startOnlinePlay(ost.match); }
  if (S.screen === 'play' && online && ost.phase === 'LOBBY') { token++; online = false; h = -1; view = null; S.screen = 'room'; render(); return; }
  if (S.screen === 'play' && online) {
    if (view && view.outcome && $('#result') && !$('#result').hidden) { showResult(); return refreshChat(); }
    if (!onlineBusy) { onlineBusy = true; refresh().finally(() => (onlineBusy = false)); }
    return refreshChat();
  }
  if (S.screen === 'room' || (S.screen === 'setup' && S.setup.online)) {
    if (S.screen === 'room' && ost.role === 'guest' && ost.phase === 'LOBBY' && ost.gameId) {}
    keepInputs(render);
  }
}
function keepInputs(fn) {
  const a = document.activeElement, id = a && (a.id || (a.dataset && a.dataset.reply != null ? 'r' + a.dataset.reply : '')), pos = a && a.selectionStart;
  fn();
  if (!id) return;
  const e = id.startsWith('r') && !$('#' + id) ? document.querySelector(`[data-reply="${id.slice(1)}"]`) : $('#' + id);
  if (e) { e.focus(); try { e.setSelectionRange(pos, pos); } catch (x) {} }
}
function refreshChat() {
  const box = document.querySelector('.side .chat'); if (!box) return;
  const inp = $('#chatin'), val = inp ? inp.value : '', focus = document.activeElement === inp;
  box.outerHTML = chatBox();
  const n = $('#chatin'); if (n) { n.value = val; if (focus) n.focus(); }
  const log = $('#log'); if (log) log.scrollTop = log.scrollHeight;
}
function showAsk(ask) {
  const host = $('.stage') || app;
  const old = $('#askcard'); if (old) old.remove();
  host.insertAdjacentHTML('beforeend', `<div class="askcard" id="askcard"><div class="askhd"><span class="avatar">${esc(ask.name[0])}</span><b>${esc(ask.name)} が「待った」を押しました</b></div>
    <div class="askbar"><i></i></div><div class="askops"><button class="btn" id="askNo">了承しない</button><button class="btn gold" id="askYes">了承する</button></div></div>`);
  $('#askNo').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(false); };
  $('#askYes').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(true); };
}
