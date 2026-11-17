/* みんなで遊ぶ(Firebase Realtime Database・4桁のルームコードマッチング)。
 * 部屋・対局状態・手・時計・待った・チャット・ポインター位置を Realtime Database で同期する。
 * 規則・局面計算は Android 版と同じ Kotlin のコード(core の OnlineRoom / Session)をそのまま使う。 */
'use strict';
let ost = null, lastBeginSeq = 0, onlineBusy = false, onlinePending = false, lastFlash = '0|', askShown = -1, chatSeen = 0, netReady = false;
const drafts = { join: '' };
let netApi = null;
let fbState = {
  roomId: null,
  creating: false,
  joining: false,
  error: null,
  authError: null,
  players: {},   // uid -> { uid, name, slot, role, proto, rules, joinedAt }
  cursors: {},   // uid -> { uid, x, y, active, slot, name, updatedAt }
  roomState: null,
};

// ホスト側で Firebase の players から OnlineRoom への仮想リンクを管理
const uidToPeerId = new Map();
const peerIdToUid = new Map();
let peerSeq = 1;
// ホストがOnlineRoomの送出メッセージをキャプチャして rooms/{roomId}/state に反映するためのフック
let hostSentLog = [];

const isHostRoom = () => ost && ost.role === 'host';
const ONLINE_STAMPS = 16;
const SEAT_COLORS = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'];

// OnlineRoom(Kotlin) の Transport インターフェースを Firebase Realtime Database の state / actions に橋渡しするアダプタ
function createCoreBridge() {
  const backend = {
    createInvite(cb) { cb(null, null, null); },
    acceptReply(id, code, cb) { cb(null); },
    acceptInvite(code, cb) { cb(null, null, null); },
    sendTo(id, text) {
      if (!ost && !mainCore) return;
      if (netApi && netApi.role === 'host') {
        hostSentLog.push({ to: id, text });
        scheduleHostSync();
      } else if (netApi && netApi.role === 'guest' && id === 'host') {
        // ゲストからホストへの要求 (REQ, UNDO_REQ, UNDO_VOTE, CHAT_REQ, RESIGN_REQ, AGAIN, LOBBY_REQUEST 等)
        if (text.startsWith('HELLO|') || text.startsWith('CUR_REQ|')) return;
        netApi.sendAction({ type: 'WIRE', text }).catch(() => {});
      }
    },
    disconnect(id) {},
    closeAll() {
      uidToPeerId.clear();
      peerIdToUid.clear();
    },
    linkState(id) {
      if (id === 'host') return netApi && netApi.roomId ? 'OPEN' : 'GONE';
      return peerIdToUid.has(id) ? 'OPEN' : 'GONE';
    },
  };
  const relay = {
    publish(topic, msg, cb) { cb && cb(null); },
    subscribe() { return { close() {} }; },
  };
  return { backend, relay };
}

let hostSyncScheduled = false;
function scheduleHostSync() {
  if (hostSyncScheduled) return;
  hostSyncScheduled = true;
  queueMicrotask(flushHostStateToFirebase);
}

let hostRoundInfo = {
  round: 0,
  gameId: 'reversi',
  options: '',
  seed: '0',
  seatSlots: [],
  names: [],
  clockIndex: -1,
  clockSeconds: -1,
  undoAsk: null,     // { id, round, slot, target, name }
  undoResult: null,  // { id, round, ok, slot, moves, by, seq }
  undoResultSeq: 0,
};

function flushHostStateToFirebase() {
  hostSyncScheduled = false;
  if (!netApi || netApi.role !== 'host' || !netApi.roomId || !mainCore) return;
  const st = JSON.parse(mainCore.onlineState());
  const batch = hostSentLog.splice(0, hostSentLog.length);

  for (const item of batch) {
    const f = String(item.text || '').split('|');
    switch (f[0]) {
      case 'BEGIN':
        hostRoundInfo.round = +f[1] || 0;
        hostRoundInfo.gameId = f[2] || st.gameId || 'reversi';
        hostRoundInfo.options = (f[3] || '').replace(/\^/g, ';').replace(/~/g, '=');
        hostRoundInfo.seed = f[4] || '1';
        hostRoundInfo.seatSlots = f[5] ? f[5].split(',').map(Number) : [];
        hostRoundInfo.undoAsk = null;
        hostRoundInfo.clockIndex = -1;
        hostRoundInfo.clockSeconds = -1;
        break;
      case 'LOBBY':
        hostRoundInfo.undoAsk = null;
        hostRoundInfo.clockIndex = -1;
        hostRoundInfo.clockSeconds = -1;
        break;
      case 'CLOCK':
        hostRoundInfo.clockIndex = +f[2];
        hostRoundInfo.clockSeconds = +f[3];
        break;
      case 'UNDO_ASK':
        hostRoundInfo.undoAsk = { round: +f[1], id: +f[2], slot: +f[3], target: +f[4] };
        break;
      case 'UNDO_DONE':
        hostRoundInfo.undoAsk = null;
        hostRoundInfo.undoResult = {
          seq: ++hostRoundInfo.undoResultSeq,
          round: +f[1],
          id: +f[2],
          ok: f[3] === '1',
          slot: +f[4],
          moves: f[3] === '1' ? (f[5] ? f[5].split(',').map(Number) : []) : [],
          by: f[3] === '1' ? -1 : +f[5],
        };
        break;
    }
  }

  let moves = [];
  if (st.match >= 0) {
    try {
      const mStr = mainCore.onlineMovesFrom(st.match, 0);
      moves = mStr ? mStr.split(',').filter((x) => x !== '').map(Number) : [];
    } catch (e) {}
  }

  const payload = {
    phase: st.phase || 'LOBBY',
    gameId: st.gameId || 'reversi',
    options: st.options || '',
    round: st.round || hostRoundInfo.round || 0,
    seed: hostRoundInfo.seed || '0',
    seatSlots: hostRoundInfo.seatSlots || [],
    names: st.names || [],
    moves,
    ready: st.ready || [],
    members: st.members || [],
    chat: st.chat || [],
    clock: hostRoundInfo.clockIndex >= 0 ? { round: st.round || hostRoundInfo.round, index: hostRoundInfo.clockIndex, seconds: hostRoundInfo.clockSeconds } : null,
    undoAsk: hostRoundInfo.undoAsk,
    undoResult: hostRoundInfo.undoResult,
  };
  netApi.writeState(payload).catch((e) => console.warn('[Firebase] writeState error:', e));
}

// ゲスト側で rooms/{roomId}/state の変更を受け取り OnlineRoom に反映する
let guestApplied = {
  welcomed: false,
  rosterSig: '',
  round: 0,
  phase: 'LOBBY',
  movesSig: '',
  readySig: '',
  chatSeq: 0,
  clockSig: '',
  undoAskId: -1,
  undoResSeq: 0,
};

function resetGuestApplied() {
  guestApplied = {
    welcomed: false,
    rosterSig: '',
    round: 0,
    phase: 'LOBBY',
    movesSig: '',
    readySig: '',
    chatSeq: 0,
    clockSig: '',
    undoAskId: -1,
    undoResSeq: 0,
  };
}

function applyRemoteStateOnGuest(s) {
  if (!s || !mainCore || !netApi || netApi.role !== 'guest') return;
  const myUid = netApi.uid;
  const myPlayer = (fbState.players && myUid && fbState.players[myUid]) || null;
  const membersList = Array.isArray(s.members) && s.members.length
    ? s.members
    : Object.values(fbState.players || {}).sort((a, b) => (a.slot || 0) - (b.slot || 0)).map((p) => ({ slot: p.slot, name: p.name }));
  const myEntry = membersList.find((m) => myPlayer && m.slot === myPlayer.slot) || myPlayer;
  if (!myEntry || typeof myEntry.slot !== 'number') return;

  if (!guestApplied.welcomed) {
    guestApplied.welcomed = true;
    mainCore.netText('host', `WELCOME|${myEntry.slot}|2`);
  }

  const encOpts = String(s.options || '').split(';').filter(Boolean).map((kv) => kv.replace('=', '~')).join('^');
  const rosterStr = membersList.map((m) => `${m.slot}:${m.name}`).join(',');
  const compatStr = membersList.map((m) => `${m.slot}:2`).join(',');
  const rSig = `${s.gameId}|${encOpts}|${rosterStr}`;
  if (rSig !== guestApplied.rosterSig) {
    guestApplied.rosterSig = rSig;
    mainCore.netText('host', `ROSTER|${s.gameId || 'reversi'}|${encOpts}|${rosterStr}`);
    mainCore.netText('host', `COMPAT|${compatStr}`);
  }

  const round = +s.round || 0;
  if (s.phase === 'PLAYING' && round > 0) {
    if (guestApplied.round !== round || guestApplied.phase !== 'PLAYING') {
      guestApplied.round = round;
      guestApplied.phase = 'PLAYING';
      guestApplied.movesSig = '';
      guestApplied.undoAskId = -1;
      const slots = Array.isArray(s.seatSlots) ? s.seatSlots.join(',') : '0,1';
      mainCore.netText('host', `BEGIN|${round}|${s.gameId || 'reversi'}|${encOpts}|${s.seed || '1'}|${slots}`);
    }
    const moves = Array.isArray(s.moves) ? s.moves : [];
    const mSig = `${round}:${moves.join(',')}`;
    if (mSig !== guestApplied.movesSig) {
      const prevMoves = guestApplied.movesSig.startsWith(round + ':')
        ? guestApplied.movesSig.slice((round + ':').length).split(',').filter(Boolean).map(Number)
        : [];
      guestApplied.movesSig = mSig;
      if (moves.length === prevMoves.length + 1 && prevMoves.every((v, i) => v === moves[i])) {
        mainCore.netText('host', `MOVE|${round}|${moves.length - 1}|${moves[moves.length - 1]}`);
      } else {
        mainCore.netText('host', `SYNC|${round}|${moves.join(',')}`);
      }
    }
  } else if (s.phase === 'LOBBY' && guestApplied.phase === 'PLAYING') {
    guestApplied.phase = 'LOBBY';
    mainCore.netText('host', `LOBBY|${guestApplied.round}`);
  }

  // 再戦準備
  const readyArr = Array.isArray(s.ready) ? s.ready : [];
  const readySig = `${round}:${readyArr.join(',')}`;
  if (readySig !== guestApplied.readySig && guestApplied.phase === 'PLAYING') {
    guestApplied.readySig = readySig;
    mainCore.netText('host', `READY|${round}|${readyArr.join(',')}`);
  }

  // 時計
  if (s.clock && s.clock.round === round && guestApplied.phase === 'PLAYING') {
    const cSig = `${round}:${s.clock.index}:${s.clock.seconds}`;
    if (cSig !== guestApplied.clockSig) {
      guestApplied.clockSig = cSig;
      mainCore.netText('host', `CLOCK|${round}|${s.clock.index}|${s.clock.seconds}`);
    }
  }

  // 待ったの依頼・結果
  if (s.undoAsk && s.undoAsk.round === round) {
    if (guestApplied.undoAskId !== s.undoAsk.id) {
      guestApplied.undoAskId = s.undoAsk.id;
      mainCore.netText('host', `UNDO_ASK|${round}|${s.undoAsk.id}|${s.undoAsk.slot}|${s.undoAsk.target}`);
    }
  }
  if (s.undoResult && s.undoResult.seq > guestApplied.undoResSeq && s.undoResult.round === round) {
    guestApplied.undoResSeq = s.undoResult.seq;
    const r = s.undoResult;
    if (r.ok) {
      const mStr = Array.isArray(r.moves) ? r.moves.join(',') : '';
      guestApplied.movesSig = `${round}:${mStr}`;
      mainCore.netText('host', `UNDO_DONE|${round}|${r.id}|1|${r.slot}|${mStr}`);
    } else {
      mainCore.netText('host', `UNDO_DONE|${round}|${r.id}|0|${r.slot}|${r.by}`);
    }
  }

  // チャット
  const chats = Array.isArray(s.chat) ? s.chat : [];
  for (const c of chats) {
    if (c && c.seq > guestApplied.chatSeq) {
      guestApplied.chatSeq = c.seq;
      mainCore.netText('host', `CHAT|${round}|${c.seq}|${c.slot}|${c.kind}|${c.body}`);
    }
  }
}

// ホスト側で Firebase の players 一覧の変化を OnlineRoom のメンバーと同期する
function syncHostPlayers(playersMap) {
  if (!netApi || netApi.role !== 'host' || !mainCore) return;
  const myUid = netApi.uid;
  const currentUids = new Set();

  const entries = Object.values(playersMap || {}).filter((p) => p && p.uid && p.uid !== myUid);
  entries.sort((a, b) => (a.slot || 99) - (b.slot || 99));

  for (const p of entries) {
    currentUids.add(p.uid);
    if (!uidToPeerId.has(p.uid)) {
      const peerId = 'fb_' + (peerSeq++);
      uidToPeerId.set(p.uid, peerId);
      peerIdToUid.set(peerId, p.uid);
      mainCore.netLinked(peerId);
      mainCore.netText(peerId, `HELLO|${p.name || 'プレイヤー'}|${p.proto || 2}|${p.rules || ''}`);
      scheduleHostSync();
    }
  }

  for (const [uid, peerId] of [...uidToPeerId.entries()]) {
    if (!currentUids.has(uid)) {
      uidToPeerId.delete(uid);
      peerIdToUid.delete(peerId);
      mainCore.netUnlinked(peerId);
      scheduleHostSync();
    }
  }
}

function handleGuestActionOnHost(act) {
  if (!act || !act.uid || !netApi || netApi.role !== 'host' || !mainCore) return;
  const peerId = uidToPeerId.get(act.uid);
  if (!peerId) return;
  if (act.type === 'WIRE' && typeof act.text === 'string') {
    mainCore.netText(peerId, act.text);
    scheduleHostSync();
  }
}

async function ensureNet() {
  if (netReady) return;
  await coreReady;
  const bridge = createCoreBridge();
  mainCore.netInit(bridge.backend, bridge.relay, {
    changed: () => {
      if (netApi && netApi.role === 'host') scheduleHostSync();
      queueMicrotask(onlineChanged);
    }
  });
  const { createNet } = await import('./net.js');
  netApi = await createNet(mainCore, {
    changed: () => queueMicrotask(onlineChanged),
    onError: (msg) => {
      fbState.authError = msg;
      fbState.error = msg;
      if (S.screen === 'room') render();
    }
  });
  netReady = true;
}
const cpuLvForRoom = () => lvIndex(S.set.cpuLv);

// 起動時に Firebase 匿名ログインを開始しておく
setTimeout(() => { ensureNet().catch(() => {}); }, 0);

// スタンプ: 0〜15 番はスタンプとして送る。16 番からは「《名前》」の文字で送り、絵で出す
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
  if (ok) {
    sfxPop(true);
    if (isHostRoom()) scheduleHostSync();
  } else toast({ w: 'お知らせ', t: '少し待ってから送ってください' });
  if (st != null) render();
}

// ---------------------------------------------------------------- 部屋の画面 (4桁のルームコードマッチング)
function room() {
  const st = ost || { role: 'none', members: [] };
  const host = st.role === 'host', guest = st.role === 'guest', none = st.role === 'none';
  const g = st.gameId && gInfo(st.gameId);
  let left = '';

  if (fbState.authError) {
    left += `<div class="panel" style="border-color:#C8463C;background:rgba(200,70,60,.08)"><h3>通信の設定案内</h3><p class="err" style="white-space:pre-wrap;margin:4px 0">${esc(fbState.authError)}</p></div>`;
  }

  // 1. 部屋を作る (4桁のルームコード自動発行)
  left += `<div class="panel" style="padding-bottom:12px"><h3>部屋を作る</h3>
     ${none ? `<button class="btn primary" style="width:100%;margin-top:6px;letter-spacing:.1em" data-mkroom ${fbState.creating || fbState.joining ? 'disabled' : ''}>${fbState.creating ? '部屋を作っています…' : '部屋を作る'}</button>` : ''}
     ${ fbState.roomId ? `<div class="invite"><p>${host ? 'この4桁のルームコードを相手に伝えてください' : '参加中のルームコード'}</p>
       <div class="code" style="font-size:28px;font-weight:900;letter-spacing:.25em;text-align:center;padding:12px 10px">${esc(fbState.roomId)}</div>
       <button class="btn gold copybig" data-copy="${esc(fbState.roomId)}">${ic('copy')}4桁のルームコードをコピー</button></div>` : '' }
     ${fbState.error && host ? `<p class="err">${esc(fbState.error)}</p>` : ''}</div>`;

  // 2. 4桁のルームコードを入力して参加する
  if (none) {
    left += `<div class="panel" style="padding-bottom:10px"><h3>部屋に入る</h3>
      ${fbState.error ? `<p class="err">${esc(fbState.error)}</p>` : ''}
      <div class="codebox"><input id="joinIn" placeholder="4桁のルームコード (例: 1234)" value="${esc(drafts.join)}" maxlength="4" inputmode="numeric" pattern="[0-9]*" aria-label="4桁のルームコード" spellcheck="false" ${fbState.joining ? 'disabled' : ''}><button class="btn primary" style="height:38px" data-join ${fbState.joining ? 'disabled' : ''}>${fbState.joining ? '入室中…' : '参加する'}</button></div></div>`;
  }

  // 3. 参加者一覧と退出・解散
  if (!none) {
    left += `<div class="panel" style="padding-bottom:10px"><h3>参加メンバー ${st.members.length}/6</h3><div class="seats" style="padding-top:6px">${st.members.map((m, i) => `<div class="seat">${m.slot === st.mySlot ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}<span class="nm">${esc(m.name)}${m.slot === st.mySlot ? '(あなた)' : ''}<small>${m.slot === 0 ? 'ホスト・接続中' : '参加者・接続中'}</small></span></div>`).join('')}</div>
    ${st.transportError ? `<p class="err">${esc(st.transportError)}</p>` : ''}
    <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn" data-leave style="height:38px">${host ? '部屋を解散する' : '部屋を出る'}</button></div></div>`;
    left += `<div style="height:260px;display:flex">${chatBox().replace('class="chat"', 'class="chat" style="flex:1"')}</div>`;
  }

  // 4. 遊ぶゲームの選択・開始
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
    right = `<div class="panel"><h3>遊び方</h3><div class="howto"><p><b>部屋を作る人</b>: 「部屋を作る」を押して、発行された4桁のルームコードを相手に伝えます。</p><p><b>参加する人</b>: 4桁のルームコードを入力して「参加する」を押します。</p><p class="dimtxt">Webブラウザ版・Androidアプリ版・Windows版のどれからでも同じルームコードで対戦できます。</p></div></div>`;
  }
  return `<div class="screen">${rail('room')}<div class="main"><h2 class="pagehead">みんなで遊ぶ</h2><div class="cols"><div class="stack">${left}</div><div class="stack">${right}</div></div></div></div>`;
}

function afterRoom() {
  const ji = $('#joinIn');
  if (ji) {
    ji.oninput = () => {
      ji.value = ji.value.replace(/[^\d]/g, '').slice(0, 4);
      drafts.join = ji.value;
    };
    ji.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const btn = document.querySelector('[data-join]');
        if (btn && !btn.disabled) btn.click();
      }
    };
  }
}

async function createFirebaseRoom() {
  if (fbState.creating || fbState.joining) return;
  fbState.creating = true;
  fbState.error = null;
  render();
  try {
    await ensureNet();
    uidToPeerId.clear();
    peerIdToUid.clear();
    hostSentLog = [];
    hostRoundInfo = { round: 0, gameId: 'reversi', options: '', seed: '0', seatSlots: [], names: [], clockIndex: -1, clockSeconds: -1, undoAsk: null, undoResult: null, undoResultSeq: 0 };
    mainCore.onlineSetLevel(cpuLvForRoom());
    mainCore.onlineHost(meName());
    lastBeginSeq = 0;

    const res = await netApi.createRoom(
      { name: meName(), proto: 2 },
      { phase: 'LOBBY', gameId: 'reversi', options: '', round: 0 },
      {
        onPlayers(players) {
          fbState.players = players || {};
          syncHostPlayers(fbState.players);
          onlineChanged();
        },
        onState(s) {
          fbState.roomState = s;
        },
        onCursors(cursors) {
          fbState.cursors = cursors || {};
          updateRemoteTargets(fbState.cursors);
        },
        onAction(act) {
          handleGuestActionOnHost(act);
        },
        onRoomRemoved() {
          if (fbState.roomId) {
            leaveOnline(true);
            S.screen = 'room';
            render();
          }
        }
      }
    );
    fbState.roomId = res.roomId;
    fbState.creating = false;
    scheduleHostSync();
    onlineChanged();
  } catch (e) {
    fbState.creating = false;
    fbState.error = (e && e.message) || '部屋を作れませんでした';
    mainCore && mainCore.onlineLeave();
    ost = null;
    render();
  }
}

async function joinFirebaseRoom(codeInput) {
  const code = String(codeInput || '').trim();
  if (!/^\d{4}$/.test(code)) {
    fbState.error = '4桁の数字を入力してください';
    render();
    return;
  }
  if (fbState.creating || fbState.joining) return;
  fbState.joining = true;
  fbState.error = null;
  render();
  try {
    await ensureNet();
    resetGuestApplied();
    mainCore.onlineSetLevel(cpuLvForRoom());
    lastBeginSeq = 0;

    // OnlineRoom をゲストとして起動するためのダミー開始
    const res = await netApi.joinRoom(
      code,
      { name: meName(), proto: 2 },
      {
        onPlayers(players) {
          fbState.players = players || {};
          if (fbState.roomState) applyRemoteStateOnGuest(fbState.roomState);
          onlineChanged();
        },
        onState(s) {
          fbState.roomState = s;
          applyRemoteStateOnGuest(s);
          onlineChanged();
        },
        onCursors(cursors) {
          fbState.cursors = cursors || {};
          updateRemoteTargets(fbState.cursors);
        },
        onRoomRemoved() {
          if (fbState.roomId) {
            leaveOnline(true);
            S.screen = 'room';
            render();
            toast({ w: 'お知らせ', t: 'ホストが部屋を解散しました' });
          }
        }
      }
    );

    fbState.roomId = res.roomId;
    fbState.joining = false;
    startGuestOnlineRoom(meName());
    if (fbState.roomState) applyRemoteStateOnGuest(fbState.roomState);
    onlineChanged();
  } catch (e) {
    fbState.joining = false;
    fbState.error = (e && e.message) || '部屋に入れませんでした';
    render();
  }
}

// JoinFlow(WebRTC招待コード)を介さず、OnlineRoom.guest を直接開く
function startGuestOnlineRoom(name) {
  if (!mainCore) return;
  const bridge = createCoreBridge();
  // acceptInvite が即座に peerId='host' を返し、linkState('host') === 'OPEN' により OnlineRoom.guest が立ち上がる
  bridge.backend.acceptInvite = (code, cb) => cb('host', 'FIREBASE', null);
  mainCore.netInit(bridge.backend, bridge.relay, {
    changed: () => queueMicrotask(onlineChanged)
  });
  mainCore.onlineJoin(name, 'FIREBASE');
  mainCore.netInviteEvent();
}

function onlineClick(d) {
  if (d.mkroom != null || d.mkcode != null) { createFirebaseRoom(); return true; }
  if (d.join != null) { const v = ($('#joinIn') || {}).value || drafts.join || ''; joinFirebaseRoom(v); return true; }
  if (d.copy) {
    const b = document.querySelector(`[data-copy="${CSS.escape(d.copy)}"]`);
    navigator.clipboard.writeText(d.copy).then(() => { toast({ w: 'お知らせ', t: 'コピーしました' }); if (b) { const old = b.innerHTML; b.classList.add('done'); b.innerHTML = '✓ コピーしました'; setTimeout(() => { if (b.isConnected) { b.classList.remove('done'); b.innerHTML = old; } }, 2000); } }, () => toast({ w: 'お知らせ', t: 'コピーできませんでした。選んでコピーしてください' }));
    return true;
  }
  if (d.leave != null) {
    const host = isHostRoom();
    setTimeout(focusPrimary, 0);
    openSheet(`<h2>${host ? '部屋を解散しますか' : '部屋を出ますか'}</h2><p>${host ? '参加している全員が部屋から出ます(部屋のデータを削除します)。' : '部屋から退出します。'}</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="lvYes">${host ? '解散する' : '出る'}</button></div>`);
    $('#lvYes').onclick = () => { closeSheet(); sfx.play('BACK'); leaveOnline(); render(); };
    return true;
  }
  if (d.oreturn != null) { if (ost && ost.match >= 0 && ost.phase === 'PLAYING') { lastBeginSeq = ost.beginSeq; startOnlinePlay(ost.match); } return true; }
  if (d.pick) {
    if (ost && ost.gameId === d.pick && S.roomDecided === d.pick) { S.roomPre = null; return render(), true; }
    if (S.roomPre === d.pick) { S.roomPre = null; S.roomDecided = d.pick; if (!ost || ost.gameId !== d.pick) { mainCore.onlineChoose(d.pick, ''); scheduleHostSync(); } sfx.play('TAP'); render(); return true; }
    S.roomPre = d.pick; render(); return true;
  }
  if (d.roomnext != null) { const id = S.roomPre || S.roomDecided || ost.gameId; S.roomDecided = id; chooseOnline(id); return true; }
  if (d.oagain != null) {
    mainCore.onlineAgain();
    if (isHostRoom()) {
      scheduleHostSync();
      const names = () => ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => esc(m.name)).join('・');
      openSheet(`<h2>もう一度</h2><p id="readyNames">準備ができた人: ${names()}</p><div class="btns"><button class="btn" data-sheetback>待つ</button><button class="btn gold" id="rgo">この人たちで始める</button></div>`);
      $('#rgo').onclick = () => { closeSheet(); mainCore.onlineStartReady(String(Math.floor(Math.random() * 2 ** 40) + 1)); scheduleHostSync(); };
    }
    return true;
  }
  if (d.olobby != null) { mainCore.onlineBackToLobby(); if (isHostRoom()) scheduleHostSync(); return true; }
  return false;
}
function chooseOnline(id) {
  if (!id) return;
  S.roomPre = null;
  if (!ost || ost.gameId !== id) { mainCore.onlineChoose(id, ''); scheduleHostSync(); }
  try {
    const g = gInfo(id), ps = g && g.options.find((o) => o.key === 'players'), n = ost ? ost.members.length : 0;
    if (ps && n) { const v = ps.values.find(([x]) => +x === n) || ps.values.find(([x]) => +x >= n); if (v) { const c = cfg(id); c.opts.players = v[0]; saveCfg(id, c); } }
  } catch (e) {}
  S.setup = { id, online: true };
  syncOnlineOptions();
  go('setup');
}
function syncOnlineOptions() {
  if (!S.setup.online || !isHostRoom()) return;
  const g = gInfo(S.setup.id), c = cfg(g.id);
  mainCore.onlineChoose(g.id, engineOpts(g, c, true));
  scheduleHostSync();
}
function onlineChooseAndStart() {
  if (!isHostRoom()) return toast({ w: 'お知らせ', t: 'ホストが始めるのを待っています' });
  syncOnlineOptions();
  const ok = mainCore.onlineStart(String(Math.floor(Math.random() * 2 ** 40) + 1));
  if (!ok) toast({ w: 'お知らせ', t: '人数がこのゲームの席より多いか、このゲームを遊べない人がいます' });
  else scheduleHostSync();
}
function leaveOnlinePlay() {
  try {
    if (ost && ost.phase === 'PLAYING') {
      if (isHostRoom()) { mainCore.onlineBackToLobby(); scheduleHostSync(); }
      else if (view && !view.outcome && ost.canResign) mainCore.onlineResign();
    }
  } catch (e) {}
  online = false;
}
function leaveOnline(skipRemoteDelete = false) {
  if (pointerFlushTimer) { clearTimeout(pointerFlushTimer); pointerFlushTimer = null; }
  pendingPointer = null;
  hostSyncScheduled = false;
  hostSentLog = [];
  const oldRoomId = fbState.roomId;
  fbState.roomId = null;
  fbState.creating = false;
  fbState.joining = false;
  fbState.error = null;
  fbState.players = {};
  fbState.cursors = {};
  fbState.roomState = null;
  clearRemoteCursors();
  uidToPeerId.clear();
  peerIdToUid.clear();
  if (mainCore) mainCore.onlineLeave();
  if (netApi && oldRoomId) netApi.leaveRoom(skipRemoteDelete).catch(() => {});
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
  if (ost.flash !== lastFlash) {
    lastFlash = ost.flash; const t = ost.flash.slice(ost.flash.indexOf('|') + 1);
    if (t) { if (/全員が了承/.test(t)) cut({ text: '待った', tone: 'felt', ms: 1200 }); else toast({ w: 'お知らせ', t }); }
  }
  const nChat = (ost.chat || []).length;
  if (nChat > chatSeen) { const m = ost.chat[nChat - 1]; if (m.slot !== ost.mySlot) { sfxPop(false); { const si = stampIdx(m); toast({ w: m.name, t: si < 0 ? m.body : null, s: si >= 0 ? si : null, chat: true }); } } chatSeen = nChat; }
  const ask = ost.undoAsk;
  if (ask && !ask.mine && askShown !== ask.id) { askShown = ask.id; showAsk(ask); }
  else if (!ask && askShown >= 0) { askShown = -1; const a = $('#askcard'); if (a) a.remove(); }
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
    const rn = $('#readyNames');
    if (rn && ost) rn.textContent = '準備ができた人: ' + ost.members.filter((m) => m.slot === ost.mySlot || ost.ready.includes(m.slot)).map((m) => m.name).join('・');
    keepInputs(render);
  }
}
function keepInputs(fn) {
  const a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
  fn();
  if (!id) return;
  const e = $('#' + id);
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
let stScroll = 0;
document.addEventListener('scroll', (e) => { if (e.target && e.target.classList && e.target.classList.contains('stpanel')) stScroll = e.target.scrollTop; }, true);
function keepStampScroll() { const p = document.querySelector('.stpanel'); if (p) p.scrollTop = stScroll; }
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
  $('#askNo').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(false); if (isHostRoom()) scheduleHostSync(); };
  $('#askYes').onclick = () => { $('#askcard').remove(); mainCore.onlineVoteUndo(true); if (isHostRoom()) scheduleHostSync(); };
}

// ---------------------------------------------------------------- ポインター(マウス・タッチ)位置のリアルタイム同期
// 表示領域の左上を (0.0, 0.0)、右下を (1.0, 1.0) とした相対割合で送受信。
// 送信頻度は 100ms に 1 回に制限し、前回の座標・状態から変化があった時だけ送信。
// 受信側は requestAnimationFrame による補間アニメーションで滑らかに動かし、active: false 時は半透明(待機表示)にする。
const CUR_FLIP = new Set(['shogi', 'gogo', 'mancala', 'checkers', 'chess']);
const curFlip = (seat) => !!(cur && CUR_FLIP.has(cur.id) && seat === 1);
const POINTER_INTERVAL_MS = 100;
let lastPointerSentAt = 0;
let lastPointerSentSig = '';
let pendingPointer = null;
let pointerFlushTimer = null;

function getViewportBox() {
  const bw = $('#boardwrap') || $('.stage') || app || document.body;
  return bw.getBoundingClientRect();
}

function computeNormalizedPointer(clientX, clientY, active) {
  const r = getViewportBox();
  if (!r || r.width <= 0 || r.height <= 0) return null;
  let x = (clientX - r.left) / r.width;
  let y = (clientY - r.top) / r.height;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  if (online && S.screen === 'play' && curFlip(mySeat)) {
    x = 1 - x;
    y = 1 - y;
  }
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
    active: !!active,
  };
}

function sendPointerNow(pt) {
  if (!netApi || !fbState.roomId || !pt) return;
  const sig = `${pt.x.toFixed(3)}:${pt.y.toFixed(3)}:${pt.active ? 1 : 0}`;
  if (sig === lastPointerSentSig) return;
  lastPointerSentSig = sig;
  lastPointerSentAt = performance.now();
  const mySlot = ost ? ost.mySlot : 0;
  netApi.writeCursor({
    x: pt.x,
    y: pt.y,
    active: pt.active,
    slot: mySlot,
    seat: online ? mySeat : -1,
    name: meName(),
  }).catch(() => {});
}

function queuePointerSend(clientX, clientY, active) {
  if (!netApi || !fbState.roomId) return;
  if (online && S.screen === 'play' && cur && NO_CURSOR.has(cur.id)) return;
  const pt = computeNormalizedPointer(clientX, clientY, active);
  if (!pt) return;
  pendingPointer = pt;
  const elapsed = performance.now() - lastPointerSentAt;
  if (elapsed >= POINTER_INTERVAL_MS || !pt.active) {
    if (pointerFlushTimer) { clearTimeout(pointerFlushTimer); pointerFlushTimer = null; }
    sendPointerNow(pendingPointer);
    pendingPointer = null;
  } else if (!pointerFlushTimer) {
    pointerFlushTimer = setTimeout(() => {
      pointerFlushTimer = null;
      if (pendingPointer) {
        sendPointerNow(pendingPointer);
        pendingPointer = null;
      }
    }, POINTER_INTERVAL_MS - elapsed);
  }
}

let lastClientPos = { x: 0, y: 0 };
// PCのマウス操作 (mousemove)
document.addEventListener('mousemove', (e) => {
  lastClientPos = { x: e.clientX, y: e.clientY };
  queuePointerSend(e.clientX, e.clientY, true);
}, { passive: true });
document.addEventListener('mouseleave', () => {
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
}, { passive: true });
window.addEventListener('blur', () => {
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
});

// スマホのタッチ操作 (touchstart / touchmove / touchend)
document.addEventListener('touchstart', (e) => {
  const t = e.touches && e.touches[0];
  if (!t) return;
  lastClientPos = { x: t.clientX, y: t.clientY };
  queuePointerSend(t.clientX, t.clientY, true);
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  const t = e.touches && e.touches[0];
  if (!t) return;
  lastClientPos = { x: t.clientX, y: t.clientY };
  queuePointerSend(t.clientX, t.clientY, true);
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const t = (e.changedTouches && e.changedTouches[0]) || lastClientPos;
  queuePointerSend(t.clientX ?? lastClientPos.x, t.clientY ?? lastClientPos.y, false);
}, { passive: true });
document.addEventListener('touchcancel', () => {
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
}, { passive: true });

// 受信側の補間アニメーション管理
const remoteCursors = new Map(); // uid -> { curX, curY, tx, ty, active, slot, seat, name, updatedAt }
let cursorAnimFrame = null;

function updateRemoteTargets(cursorsObj) {
  const myUid = netApi ? netApi.uid : null;
  const seen = new Set();
  for (const [uid, c] of Object.entries(cursorsObj || {})) {
    if (!c || uid === myUid) continue;
    const x = typeof c.x === 'number' ? Math.max(0, Math.min(1, c.x)) : 0.5;
    const y = typeof c.y === 'number' ? Math.max(0, Math.min(1, c.y)) : 0.5;
    seen.add(uid);
    const existing = remoteCursors.get(uid);
    if (existing) {
      existing.tx = x;
      existing.ty = y;
      existing.active = c.active !== false;
      existing.slot = typeof c.slot === 'number' ? c.slot : existing.slot;
      existing.seat = typeof c.seat === 'number' ? c.seat : existing.seat;
      existing.name = c.name || existing.name;
      existing.updatedAt = performance.now();
    } else {
      remoteCursors.set(uid, {
        uid,
        curX: x,
        curY: y,
        tx: x,
        ty: y,
        active: c.active !== false,
        slot: typeof c.slot === 'number' ? c.slot : 1,
        seat: typeof c.seat === 'number' ? c.seat : -1,
        name: c.name || 'プレイヤー',
        updatedAt: performance.now(),
      });
    }
  }
  for (const uid of [...remoteCursors.keys()]) {
    if (!seen.has(uid)) {
      remoteCursors.delete(uid);
      const el = document.getElementById('rc_' + uid);
      if (el) el.remove();
    }
  }
  startCursorLoop();
}

function clearRemoteCursors() {
  remoteCursors.clear();
  document.querySelectorAll('.rcur.live').forEach((e) => e.remove());
  if (cursorAnimFrame) { cancelAnimationFrame(cursorAnimFrame); cursorAnimFrame = null; }
}

const liveCursorOf = (seat) => {
  for (const c of remoteCursors.values()) {
    if (c.seat === seat && c.active && performance.now() - c.updatedAt < 5000) return c;
  }
  return null;
};

function startCursorLoop() {
  if (cursorAnimFrame) return;
  const step = () => {
    cursorAnimFrame = null;
    if (!fbState.roomId || !remoteCursors.size || (S.screen === 'play' && (!cursorOn() || (cur && NO_CURSOR.has(cur.id))))) {
      document.querySelectorAll('.rcur.live').forEach((e) => e.remove());
      return;
    }
    const hostEl = $('.stage') || app;
    const box = getViewportBox();
    if (!hostEl || !box || box.width <= 0 || box.height <= 0) return;
    const hostRect = hostEl.getBoundingClientRect();
    let moving = false;

    for (const [uid, c] of remoteCursors.entries()) {
      // 線形補間 (Lerp) で滑らかに追従
      const dx = c.tx - c.curX;
      const dy = c.ty - c.curY;
      if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
        c.curX += dx * 0.32;
        c.curY += dy * 0.32;
        moving = true;
      } else {
        c.curX = c.tx;
        c.curY = c.ty;
      }
      let rx = c.curX, ry = c.curY;
      if (online && S.screen === 'play' && curFlip(mySeat)) {
        rx = 1 - rx;
        ry = 1 - ry;
      }
      const id = 'rc_' + uid;
      let el = document.getElementById(id);
      const color = SEAT_COLORS[(c.slot || 0) % 6];
      if (!el) {
        hostEl.insertAdjacentHTML('beforeend', rcurHtml(id, c.name || 'プレイヤー', color, true));
        el = document.getElementById(id);
        if (el) el.classList.add('live');
      }
      if (el) {
        const px = (box.left - hostRect.left) + rx * box.width;
        const py = (box.top - hostRect.top) + ry * box.height;
        el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
        // タッチ操作で指を離した際(active: false)は半透明(待機表示)にする
        el.style.opacity = c.active ? '1' : '0.38';
        el.classList.toggle('idle', !c.active);
      }
    }
    if (moving) cursorAnimFrame = requestAnimationFrame(step);
  };
  cursorAnimFrame = requestAnimationFrame(step);
}
