/* みんなで遊ぶ(招待コード方式)。部屋・招待コード・手の受け渡しは Android 版と同じ Kotlin のコード(core の OnlineRoom)。
 * 通信の手順は 2(Android 版・WEB 版と同じ)。スタンプは 0〜15 だけを送る(16 以降は三者がそろってから)。 */
'use strict';
let ost = null, lastBeginSeq = 0, onlineBusy = false, onlinePending = false, lastFlash = '0|', askShown = -1, chatSeen = 0, netReady = false;
const drafts = { join: '', replies: {} };
let netApi = null, multi = null, multiJoin = null;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
// ---------------------------------------------------------------- 複数人で使える招待コード(PC 版・Edge 版どうし)
// ホスト: 「AS2M-鍵」を配り、届いた頼みごとに 1 人ずつ、ふつうの招待コードを作って返す(つなぐ所はふつうの招待コードと同じ)
async function startMulti() {
  await ensureNet();
  if (!ost || ost.role === 'none') { mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineHost(meName()); lastBeginSeq = 0; }
  if (multi) return onlineChanged();
  const key = mainCore.relayNewKeyHex();
  multi = { key, code: 'AS2M-' + key, queue: [], seen: new Set(), busy: false, sub: null };
  multi.sub = netApi.relay.subscribe(mainCore.relayTopicHex(key), () => {}, (msg) => {
    const p = mainCore.relayOpenHex(key, msg) || '';
    if (!p.startsWith('REQ|') || !multi) return;
    const g = p.slice(4); if (multi.seen.has(g)) return;
    multi.seen.add(g); multi.queue.push(g); serveMulti();
  });
  onlineChanged();
}
async function serveMulti() {
  if (!multi || multi.busy || !multi.queue.length) return;
  multi.busy = true;
  const g = multi.queue.shift();
  try {
    const before = new Set((JSON.parse(mainCore.onlineState()).invites || []).map((v) => v.code));
    mainCore.onlineInviteCreate(); onlineChanged();
    let code = null;
    for (let i = 0; i < 80 && !code; i++) { await sleepMs(250); const st = JSON.parse(mainCore.onlineState()); const v = (st.invites || []).find((x) => x.code && !before.has(x.code) && x.state === 'WAITING_REPLY'); if (v) code = v.code; }
    netApi.relay.publish(mainCore.relayTopicHex(g), mainCore.relaySealHex(g, code ? 'CODE|' + code : 'FULL|'), () => {});
  } catch (e) {} finally { if (multi) { multi.busy = false; serveMulti(); } }
}
function stopMulti() { if (multi && multi.sub) try { multi.sub.close(); } catch (e) {} multi = null; }
// 参加者: 複数人用のコードで入る(自分の鍵を置いて、自分用の招待コードを受け取る)
async function joinMulti(code) {
  await ensureNet();
  const k = code.slice(5).trim(), g = mainCore.relayNewKeyHex();
  if (!mainCore.relayTopicHex(k)) { toast({ w: 'お知らせ', t: '招待コードの形が違います' }); return; }
  const mj = multiJoin = { g, sub: null, t: null };
  const fail = (t) => { if (multiJoin !== mj) return; try { mj.sub && mj.sub.close(); } catch (e) {} multiJoin = null; clearTimeout(mj.t); toast({ w: 'お知らせ', t }); render(); };
  mj.sub = netApi.relay.subscribe(mainCore.relayTopicHex(g), () => {}, (msg) => {
    const p = mainCore.relayOpenHex(g, msg) || '';
    if (multiJoin !== mj) return;
    if (p.startsWith('CODE|')) { try { mj.sub.close(); } catch (e) {} clearTimeout(mj.t); multiJoin = null; mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineJoin(meName(), p.slice(5)); lastBeginSeq = 0; onlineChanged(); }
    else if (p.startsWith('FULL|')) fail('部屋が満員か、いまは招待コードを作れませんでした');
  });
  netApi.relay.publish(mainCore.relayTopicHex(k), mainCore.relaySealHex(k, 'REQ|' + g), (err) => { if (err) fail(err); });
  mj.t = setTimeout(() => fail('ホストから返事がありませんでした。ホストが部屋を開いているか確かめてください'), 60000);
  render();
}
const isHostRoom = () => ost && ost.role === 'host';
const ONLINE_STAMPS = 16;
const SEAT_COLORS = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'];

async function ensureNet() {
  if (netReady) return; await coreReady;
  const { createNet } = await import('./net.js');
  netApi = createNet(mainCore, { changed: () => queueMicrotask(onlineChanged) });
  netReady = true;
}
const cpuLvForRoom = () => lvIndex(S.set.cpuLv);

// スタンプ: 0〜15 番はスタンプとして送る(アプリ版・WEB版にも絵がある)。16 番からは「《名前》」の文字で送り、PC 版はそれを絵で出す
// (アプリ版・WEB版では文字のまま読める。通信の決まりは変えない)
function stampIdx(m) {
  if (m.kind === 1) { const i = +m.body; return i >= 0 && i < STAMPS.length ? i : -1; }
  const k = /^《(.+)》$/.exec(m.body || ''); if (!k) return -1;
  const i = STAMPS.findIndex((x) => x[0] === k[1]); return i >= ONLINE_STAMPS ? i : -1;
}
function chatBox() {
  const list = online || (ost && ost.role !== 'none') ? (ost ? ost.chat : []) : [];
  return `<div class="chat"><div class="log" id="log">${list.length ? list.map((m) => { const mine = ost && m.slot === ost.mySlot; return `<div class="msg ${mine ? 'mine' : ''} ${stampIdx(m) >= 0 ? 'st' : ''}">${mine ? '' : `<small>${esc(m.name)}</small>`}${stampIdx(m) >= 0 ? stamp(stampIdx(m)) : esc(m.body)}</div>`; }).join('') : '<div class="dimtxt">チャットはまだありません</div>'}</div>
   ${S.stOpen ? `<div class="stpanel">${STAMPS.map((s, i) => `<button type="button" data-stamp="${i}" title="${s[0]}" aria-label="${s[0]}">${stamp(i)}</button>`).join('')}</div>` : ''}
   <form id="chatf"><button type="button" class="stbtn" data-stopen aria-expanded="${S.stOpen}" aria-label="スタンプ" ${ost && ost.chatOk ? '' : 'disabled'}>${ic('smile')}</button><input id="chatin" placeholder="メッセージ" maxlength="40" autocomplete="off" aria-label="メッセージ" ${ost && ost.chatOk ? '' : 'disabled'}><button ${ost && ost.chatOk ? '' : 'disabled'}>送る</button></form></div>`;
}
function sendChat(t, st) {
  if (!mainCore || !ost) return;
  const ok = st != null ? (st < ONLINE_STAMPS ? mainCore.onlineSendChat(1, String(st)) : mainCore.onlineSendChat(0, `《${STAMPS[st][0]}》`)) : mainCore.onlineSendChat(0, t);
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
     <button class="btn" style="width:100%;margin-top:8px" data-mkmulti ${guest ? 'disabled' : ''}>${multi ? '複数人用の招待コード(作成済み)' : '複数人用の招待コードを作る'}</button>
     ${multi ? `<div class="invite"><p>このコードは何人でも使えます(部屋がある間ずっと)。PC 版・Edge 版の人だけが使えます。アプリ版・WEB 版の人には、上の「招待コードを作る」で 1 人ずつ作ってください。</p><div class="code">${esc(multi.code)}</div><button class="btn gold copybig" data-copy="${esc(multi.code)}">${ic('copy')}複数人用の招待コードをコピー</button></div>` : ''}
     ${(st.invites || []).map((v) => inviteBox(v)).join('')}
     ${st.bookError ? `<p class="err">${esc(st.bookError)}</p>` : ''}</div>`;
  // 部屋に入る
  if (!host) {
    let inner = '';
    if (j.reply) {
      const sent = j.auto === 'SENT', sending = j.auto === 'SENDING';
      inner = `<p>${sent ? '返信をホストに届けました。つながるのを待っています…' : sending ? '返信をホストに届けています…' : 'この返信コードをホストに送ってください'}</p>${sent || sending ? '' : `<div class="code" id="replyCode">${esc(j.reply)}</div><button class="btn gold copybig" data-copy="${esc(j.reply)}">${ic('copy')}返信コードをコピー</button>`}<button class="btn" data-joinreset style="height:38px;margin-left:8px">やり直す</button>`;
    } else if (multiJoin) inner = '<p>ホストから、あなた用の招待コードを受け取っています…</p>';
    else if (j.busy) inner = '<p>返信コードを作っています…</p>';
    else inner = `${j.error ? `<p class="err">${esc(j.error)}</p>` : ''}<div class="codebox"><input id="joinIn" placeholder="AS2O-…" value="${esc(drafts.join)}" aria-label="招待コード" spellcheck="false"><button class="btn" style="height:38px" data-join>入る</button></div>`;
    left += `<div class="panel" style="padding-bottom:10px"><h3>部屋に入る</h3>${guest && st.phase !== 'JOINING' ? '<p>部屋に入りました</p>' : inner}</div>`;
  }
  // 参加者
  if (!none) left += `<div class="panel" style="padding-bottom:10px"><h3>参加者 ${st.members.length}/6</h3><div class="seats" style="padding-top:6px">${st.members.map((m, i) => `<div class="seat">${m.slot === st.mySlot ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}<span class="nm">${esc(m.name)}${m.slot === st.mySlot ? '(あなた)' : ''}<small>${m.slot === 0 ? 'ホスト' : '参加者'}</small></span></div>`).join('')}</div>
    ${st.legacy && st.legacy.length ? `<p class="dimtxt">${st.legacy.map(esc).join('・')}のアプリが古い版です。「待った」・チャット・時間切れの「負け」は使えません。</p>` : ''}
    ${st.transportError ? `<p class="err">${esc(st.transportError)}</p>` : ''}
    <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn" data-leave style="height:38px">${host ? '部屋を解散する' : '部屋を出る'}</button></div></div>`;
  if (!none) left += `<div style="height:260px;display:flex">${chatBox().replace('class="chat"', 'class="chat" style="flex:1"')}</div>`;
  // 遊ぶゲーム
  let right = '';
  if (host) {
    const blocked = new Set();
    for (const id of ORDER) { try { if (JSON.parse(mainCore.onlineMismatch(id)).length) blocked.add(id); } catch (e) {} }
    right = `<div class="panel"><h3>遊ぶゲーム</h3><div class="glist">${ORDER.map((id) => gInfo(id)).filter((x) => x && playable(x.id) && range(x.players)[1] >= st.members.length).map((x) => `<button data-pick="${x.id}" class="${S.roomPre === x.id ? 'pre' : ''} ${st.gameId === x.id && S.roomDecided === x.id ? 'set' : ''}" ${blocked.has(x.id) ? 'disabled title="版が違う人がいるので選べません"' : ''}><span class="mini">${artOf(x.id)}</span><span class="gn">${dispName(x)}</span><em>${st.gameId === x.id && S.roomDecided === x.id ? '決定' : ''}</em></button>`).join('')}</div>
      ${blocked.size ? `<p class="dimtxt">版が違う人がいるので、選べないゲームがあります。</p>` : ''}</div>
      <div style="display:flex;justify-content:flex-end"><button class="btn primary" style="flex:none;width:280px" data-roomnext ${S.roomPre || S.roomDecided ? '' : 'disabled'}>進む</button></div>`;
  }
  if (!none && st.phase === 'PLAYING') {
    const inMatch = st.match >= 0;
    right = `<div class="panel"><h3>対局中</h3><div class="hero" style="margin:8px 0">${g ? `<span class="art">${artOf(g.id)}</span>` : ''}<div><h2>${g ? esc(g.name) : ''}</h2><p>${inMatch ? '対局の画面から部屋に戻っています' : '次の対局から加わります。いまの対局が終わるまで待ってください'}</p></div></div>${inMatch ? '<div style="display:flex;justify-content:flex-end"><button class="btn primary" style="flex:none;width:280px" data-oreturn>対局に戻る</button></div>' : ''}</div>`;
  } else if (host) { /* 上で作った */ } else if (guest && g) {
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
  return `<div class="invite"><p>${msg}</p>${waiting ? `<div class="code">${esc(v.code)}</div><button class="btn gold copybig" data-copy="${esc(v.code)}">${ic('copy')}招待コードをコピー</button>
    <div class="codebox"><input data-reply="${v.i}" placeholder="返信コード(AS2A-…)" value="${esc(drafts.replies[v.i] || '')}" aria-label="返信コード" spellcheck="false"><button class="btn" style="height:38px" data-sendreply="${v.i}">つなぐ</button></div>` : ''}
    ${v.state !== 'OPEN' && v.state !== 'DONE' ? `<div style="text-align:right"><button class="btn" data-cancelinv="${v.i}" style="height:34px">取り消す</button></div>` : ''}</div>`;
}
function afterRoom() {
  const ji = $('#joinIn'); if (ji) ji.oninput = () => (drafts.join = ji.value);
  document.querySelectorAll('[data-reply]').forEach((x) => (x.oninput = () => (drafts.replies[x.dataset.reply] = x.value)));
}
function onlineClick(d) {
  if (d.mkcode != null) { (async () => { await ensureNet(); if (!ost || ost.role === 'none') { mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineHost(meName()); lastBeginSeq = 0; } mainCore.onlineInviteCreate(); onlineChanged(); })(); return true; }
  if (d.mkmulti != null) { startMulti(); return true; }
  if (d.join != null && /^AS2M-/i.test((($('#joinIn') || {}).value || '').trim())) { joinMulti((($('#joinIn') || {}).value || '').trim()); return true; }
  if (d.join != null) { const v = ($('#joinIn') || {}).value || ''; if (!v.trim()) return true; (async () => { await ensureNet(); mainCore.onlineSetLevel(cpuLvForRoom()); mainCore.onlineJoin(meName(), v.trim()); lastBeginSeq = 0; onlineChanged(); })(); return true; }
  if (d.joinreset != null) { mainCore.onlineJoinReset(); onlineChanged(); return true; }
  if (d.copy) {
    const b = document.querySelector(`[data-copy="${CSS.escape(d.copy)}"]`);
    navigator.clipboard.writeText(d.copy).then(() => { toast({ w: 'お知らせ', t: 'コピーしました' }); if (b) { const old = b.innerHTML; b.classList.add('done'); b.innerHTML = '✓ コピーしました'; setTimeout(() => { if (b.isConnected) { b.classList.remove('done'); b.innerHTML = old; } }, 2000); } }, () => toast({ w: 'お知らせ', t: 'コピーできませんでした。選んでコピーしてください' }));
    return true;
  }
  if (d.sendreply != null) { const i = +d.sendreply, t = (drafts.replies[i] || '').trim(); if (t) { mainCore.onlineInviteReply(i, t); drafts.replies[i] = ''; } return true; }
  if (d.cancelinv != null) { mainCore.onlineInviteCancel(+d.cancelinv); return true; }
  if (d.leave != null) {
    const host = isHostRoom();
    setTimeout(focusPrimary, 0);
    openSheet(`<h2>${host ? '部屋を解散しますか' : '部屋を出ますか'}</h2><p>${host ? '参加している全員が部屋から出ます。' : 'もう一度入るには、新しい招待コードが要ります。'}</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="lvYes">${host ? '解散する' : '出る'}</button></div>`);
    $('#lvYes').onclick = () => { closeSheet(); sfx.play('BACK'); leaveOnline(); render(); };
    return true;
  }
  if (d.oreturn != null) { if (ost && ost.match >= 0 && ost.phase === 'PLAYING') { lastBeginSeq = ost.beginSeq; startOnlinePlay(ost.match); } return true; }
  if (d.pick) {
    if (ost && ost.gameId === d.pick && S.roomDecided === d.pick) { S.roomPre = null; return render(), true; }
    if (S.roomPre === d.pick) { S.roomPre = null; S.roomDecided = d.pick; if (!ost || ost.gameId !== d.pick) mainCore.onlineChoose(d.pick, ''); sfx.play('TAP'); render(); return true; }
    S.roomPre = d.pick; render(); return true;
  }
  if (d.roomnext != null) { const id = S.roomPre || S.roomDecided || ost.gameId; S.roomDecided = id; chooseOnline(id); return true; }
  if (d.oagain != null) { mainCore.onlineAgain(); if (isHostRoom()) { const names = () => ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => esc(m.name)).join('・'); openSheet(`<h2>もう一度</h2><p id="readyNames">準備ができた人: ${names()}</p><div class="btns"><button class="btn" data-sheetback>待つ</button><button class="btn gold" id="rgo">この人たちで始める</button></div>`); $('#rgo').onclick = () => { closeSheet(); mainCore.onlineStartReady(String(Math.floor(Math.random() * 2 ** 40) + 1)); }; } return true; }
  if (d.olobby != null) { mainCore.onlineBackToLobby(); return true; }
  return false;
}
function chooseOnline(id) {
  if (!id) return;
  S.roomPre = null;
  if (!ost || ost.gameId !== id) mainCore.onlineChoose(id, '');
  // 人数を選べるゲームは、部屋の人数を初めの人数にする(CPU を入れない)
  try {
    const g = gInfo(id), ps = g && g.options.find((o) => o.key === 'players'), n = ost ? ost.members.length : 0;
    if (ps && n) { const v = ps.values.find(([x]) => +x === n) || ps.values.find(([x]) => +x >= n); if (v) { const c = cfg(id); c.opts.players = v[0]; saveCfg(id, c); } }
  } catch (e) {}
  S.setup = { id, online: true };
  syncOnlineOptions();
  go('setup');
}
// 部屋の設定画面で変えたルールを部屋に伝える(ホストだけ)
function syncOnlineOptions() {
  if (!S.setup.online || !isHostRoom()) return;
  const g = gInfo(S.setup.id), c = cfg(g.id);
  mainCore.onlineChoose(g.id, engineOpts(g, c, true));
}
function onlineChooseAndStart() {
  if (!isHostRoom()) return toast({ w: 'お知らせ', t: 'ホストが始めるのを待っています' });
  syncOnlineOptions();
  const ok = mainCore.onlineStart(String(Math.floor(Math.random() * 2 ** 40) + 1));
  if (!ok) toast({ w: 'お知らせ', t: '人数がこのゲームの席より多いか、このゲームを遊べない人がいます' });
}
// 対局の画面を離れる(部屋からは抜けない)。ホストは全員で部屋へ戻し、参加者は対局中なら降参する
function leaveOnlinePlay() {
  try {
    if (ost && ost.phase === 'PLAYING') {
      if (isHostRoom()) mainCore.onlineBackToLobby();
      else if (view && !view.outcome && ost.canResign) mainCore.onlineResign();
    }
  } catch (e) {}
  online = false;
}
function leaveOnline() {
  stopMulti();
  if (mainCore) mainCore.onlineLeave();
  online = false; token++; ost = null; S.roomPre = null; S.roomDecided = null; lastBeginSeq = 0; chatSeen = 0; closeSheet();
}
async function startOnlinePlay(handle) {
  online = true; token++; sel = null; prevView = null; view = null; drawnView = null; mode = 'online'; h = handle;
  { const p = $('#result'); if (p) p.hidden = true; }
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
  if (nChat > chatSeen) { const m = ost.chat[nChat - 1]; if (m.slot !== ost.mySlot) { sfxPop(false); { const si = stampIdx(m); toast({ w: m.name, t: si < 0 ? m.body : null, s: si >= 0 ? si : null, chat: true }); } } chatSeen = nChat; }
  // 待ったの依頼
  const ask = ost.undoAsk;
  if (ask && !ask.mine && askShown !== ask.id) { askShown = ask.id; showAsk(ask); }
  else if (!ask && askShown >= 0) { askShown = -1; const a = $('#askcard'); if (a) a.remove(); }
  // 対局の開始・終了
  if (ost.beginSeq !== lastBeginSeq) { lastBeginSeq = ost.beginSeq; if (ost.match >= 0) return startOnlinePlay(ost.match); }
  if (S.screen === 'play' && online && ost.phase === 'LOBBY') { token++; online = false; h = -1; view = null; S.screen = 'room'; render(); return; }
  if (S.screen === 'play' && online) {
    if (view && view.outcome && $('#result') && !$('#result').hidden) { showResult(); return refreshChat(); }
    if (onlineBusy) { onlinePending = true; return refreshChat(); }
    onlineBusy = true;
    (async () => { try { do { onlinePending = false; await refresh(); } while (onlinePending && online && S.screen === 'play'); } finally { onlineBusy = false; } })();
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
  keepStampScroll();
}
// スタンプの一覧: 描き直しても、見ていた位置のまま
let stScroll = 0;
document.addEventListener('scroll', (e) => { if (e.target && e.target.classList && e.target.classList.contains('stpanel')) stScroll = e.target.scrollTop; }, true);
function keepStampScroll() { const p = document.querySelector('.stpanel'); if (p) p.scrollTop = stScroll; }
// スタンプの一覧は、一覧の外を押すと閉じる
document.addEventListener('pointerdown', (e) => {
  if (!S.stOpen || e.target.closest('.stpanel, [data-stopen]')) return;
  S.stOpen = false; const p = document.querySelector('.stpanel'); if (p) p.remove();
  const b = document.querySelector('[data-stopen]'); if (b) b.setAttribute('aria-expanded', 'false');
}, true);
function showAsk(ask) {
  const host = $('.stage') || app;
  const old = $('#askcard'); if (old) old.remove();
  host.insertAdjacentHTML('beforeend', `<div class="askcard" id="askcard"><div class="askhd"><span class="avatar">${esc(ask.name[0])}</span><b>${esc(ask.name)} が「待った」を押しました</b></div>
    <div class="askbar"><i></i></div><div class="askops"><button class="btn" id="askNo">了承しない</button><button class="btn gold" id="askYes">了承する</button></div></div>`);
  $('#askNo').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(false); };
  $('#askYes').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(true); };
}

// ---------------------------------------------------------------- 相手のカーソル(通信対戦・PC 版どうしで、いつも見せる)
// 指している盤の部品(data-i など。両方の画面で同じ)と、その中の位置を送る。盤を逆さに出すゲームは、向きをそろえる
const CUR_ATTRS = ['i', 'pit', 'col', 'pos', 'k', 'sq', 'hand', 'tok', 'edge', 'e', 'die', 'cat', 'roll', 'draw', 'card', 'ycell', 'spin', 'act', 'lm', 'pass', 'src', 'dest', 'seat', 'tile'];
const CUR_SEL = CUR_ATTRS.map((a) => `[data-${a}]`).join(',');
const CUR_FLIP = new Set(['shogi', 'gogo', 'mancala', 'checkers', 'chess']);
const curFlip = (seat) => !!(cur && CUR_FLIP.has(cur.id) && seat === 1);
let curSentAt = 0, curSig = '';
function curSend(key, x, y) {
  const sig = key + ':' + Math.round(x / 8) + ':' + Math.round(y / 8);
  if (sig === curSig) return; curSig = sig; curSentAt = performance.now();
  try { mainCore.onlineSendCursor(key, Math.round(x), Math.round(y)); } catch (e) {}
}
document.addEventListener('pointermove', (e) => {
  if (!online || S.screen !== 'play' || !mainCore || !cur || NO_CURSOR.has(cur.id) || performance.now() - curSentAt < 70) return;
  const bw = $('#boardwrap'); if (!bw) return;
  let key = '-', fx = 0, fy = 0;
  const el = e.target && e.target.closest ? e.target.closest(CUR_SEL) : null;
  if (el && el.closest('.stage')) {
    const a = CUR_ATTRS.find((n) => el.hasAttribute('data-' + n)); const r = el.getBoundingClientRect();
    key = `${a}=${el.getAttribute('data-' + a)}`; fx = (e.clientX - r.left) / Math.max(1, r.width); fy = (e.clientY - r.top) / Math.max(1, r.height);
  } else {
    const r = bw.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { key = 'B'; fx = (e.clientX - r.left) / r.width; fy = (e.clientY - r.top) / r.height; }
  }
  if (key !== '-' && curFlip(mySeat)) { fx = 1 - fx; fy = 1 - fy; }
  curSend(key, Math.max(0, Math.min(1, fx)) * 1000, Math.max(0, Math.min(1, fy)) * 1000);
}, { passive: true });
document.addEventListener('pointerleave', () => { if (online && S.screen === 'play' && mainCore) curSend('-', 0, 0); });
window.addEventListener('blur', () => { if (online && S.screen === 'play' && mainCore) curSend('-', 0, 0); });
let curLive = [];
const liveCursorOf = (seat) => curLive.find((c) => c.seat === seat && c.age < 3000 && c.k !== '-');
setInterval(() => {
  const stage = $('.stage');
  if (!online || S.screen !== 'play' || !mainCore || !stage || !cur || NO_CURSOR.has(cur.id) || !cursorOn()) { curLive = []; document.querySelectorAll('.rcur.live').forEach((e) => e.remove()); return; }
  try { curLive = JSON.parse(mainCore.onlineCursors()); } catch (e) { curLive = []; }
  const sr = stage.getBoundingClientRect(), seen = new Set();
  for (const c of curLive) {
    if (c.k === '-' || c.age > 5000 || (ost && c.s === ost.mySlot)) continue;
    let x = c.x / 1000, y = c.y / 1000; if (curFlip(c.seat)) { x = 1 - x; y = 1 - y; } if (curFlip(mySeat)) { x = 1 - x; y = 1 - y; }
    let r = null;
    if (c.k === 'B') { const bw = $('#boardwrap'); r = bw && bw.getBoundingClientRect(); }
    else { const i = c.k.indexOf('='); const el = stage.querySelector(`[data-${c.k.slice(0, i)}="${CSS.escape(c.k.slice(i + 1))}"]`); r = el && el.getBoundingClientRect(); }
    if (!r) continue;
    const id = 'rc' + c.s; seen.add(id);
    let el = document.getElementById(id);
    if (!el) { const m = ost && ost.members.find((q) => q.slot === c.s); stage.insertAdjacentHTML('beforeend', rcurHtml(id, m ? m.name : 'プレイヤー', SEAT_COLORS[c.s % 6], true)); el = document.getElementById(id); el.classList.add('live'); }
    el.style.transform = `translate(${r.left - sr.left + x * r.width}px,${r.top - sr.top + y * r.height}px)`;
  }
  document.querySelectorAll('.rcur.live').forEach((e) => { if (!seen.has(e.id)) e.remove(); });
}, 90);
