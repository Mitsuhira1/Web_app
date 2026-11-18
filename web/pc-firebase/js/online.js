/* みんなで遊ぶ(Firebase Realtime Database・4桁のルームコードマッチング)。
 * 部屋・対局状態・手・時計・待った・チャット・ポインター位置を Realtime Database で同期する。
 * 規則・局面計算は Android 版と同じ Kotlin のコード(core の OnlineRoom / Session)をそのまま使う。 */
'use strict';
let ost = null, lastBeginSeq = 0, onlineBusy = false, onlinePending = false, lastFlash = '0|', askShown = -1, chatSeen = 0, netReady = false;
const drafts = { join: '' };
let netApi = null;
const DEFAULT_ROOM_SETTINGS = {
  isPublic: false,
  chatEnabled: true,
  maxPlayers: 6,
  locked: false,
  vibe: 'ボチボチ',
};
let publicRoomsUnsub = null;
let fbState = {
  roomId: null,
  hostUid: null,
  creating: false,
  joining: false,
  error: null,
  authError: null,
  players: {},   // uid -> { uid, name, slot, role, proto, rules, spectating, autoCpu, joinedAt }
  cursors: {},   // uid -> { uid, x, y, active, slot, name, updatedAt }
  roomState: null,
  roomSettings: Object.assign({}, DEFAULT_ROOM_SETTINGS),
  draftSettings: Object.assign({}, DEFAULT_ROOM_SETTINGS),
  publicRooms: [],
  publicRoomsLoading: false,
  publicRoomsLoaded: false,
  soloIdle: false,
  takingOver: false,
  knownPlayerUids: new Set(),
  kickedUids: new Set(),
  promptedJoinUids: new Set(),
};

// ホスト側で Firebase の players から OnlineRoom への仮想リンクを管理
const uidToPeerId = new Map();
const peerIdToUid = new Map();
let peerSeq = 1;
// ホストがOnlineRoomの送出メッセージをキャプチャして rooms/{roomId}/state に反映するためのフック
let hostSentLog = [];

const isHostRoom = () => !!(ost && ost.role === 'host');
const ONLINE_STAMPS = 16;
const SEAT_COLORS = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'];
const currentRoomSettings = () => (fbState.roomId ? fbState.roomSettings : fbState.draftSettings) || DEFAULT_ROOM_SETTINGS;
const isChatEnabled = () => !fbState.roomId || (fbState.roomSettings && fbState.roomSettings.chatEnabled !== false);

function playerByUid(uid) {
  return (uid && fbState.players && fbState.players[uid]) || null;
}
function playerBySlot(slot) {
  if (typeof slot !== 'number' || slot < 0) return null;
  for (const p of Object.values(fbState.players || {})) {
    if (p && p.slot === slot) return p;
  }
  return null;
}
function playerUidBySlot(slot) {
  const p = playerBySlot(slot);
  return p ? p.uid : null;
}
function hostSlotOfRoom() {
  const hp = playerByUid(fbState.hostUid);
  if (hp && typeof hp.slot === 'number') return hp.slot;
  if (fbState.roomState && typeof fbState.roomState.hostSlot === 'number') return fbState.roomState.hostSlot;
  if (ost && ost.role === 'host') return ost.mySlot;
  return 0;
}
function isSlotSpectating(slot) {
  if (typeof slot !== 'number' || slot < 0) return false;
  const p = playerBySlot(slot);
  if (p) return !!p.spectating;
  const rs = fbState.roomState;
  return !!(rs && Array.isArray(rs.spectatorSlots) && rs.spectatorSlots.includes(slot));
}
function isSlotAutoCpu(slot) {
  if (typeof slot !== 'number' || slot < 0) return false;
  const p = playerBySlot(slot);
  if (p) return !!p.autoCpu;
  const rs = fbState.roomState;
  return !!(rs && Array.isArray(rs.autoCpuSlots) && rs.autoCpuSlots.includes(slot));
}
function mySpectatingOn() {
  if (!netApi || !netApi.uid) return false;
  const p = playerByUid(netApi.uid);
  return !!(p && p.spectating);
}
function myAutoCpuOn() {
  if (!netApi || !netApi.uid) return false;
  const p = playerByUid(netApi.uid);
  return !!(p && p.autoCpu);
}
function seatToSlot(seat) {
  if (typeof seat !== 'number' || seat < 0) return -1;
  const slots = fbState.roomState && Array.isArray(fbState.roomState.seatSlots) ? fbState.roomState.seatSlots : hostRoundInfo.seatSlots;
  if (Array.isArray(slots) && seat < slots.length) {
    const sl = slots[seat];
    return typeof sl === 'number' ? sl : -1;
  }
  return -1;
}
function isSeatAutoCpu(seat) {
  const sl = seatToSlot(seat);
  return sl >= 0 && isSlotAutoCpu(sl);
}
function isMySeatAutoCpu() {
  return !!(online && view && view.mine >= 0 && myAutoCpuOn());
}
function isAutoCpuTurn() {
  return !!(online && view && !view.outcome && view.toMove >= 0 && isSeatAutoCpu(view.toMove));
}
function activeMembers() {
  const list = (ost && Array.isArray(ost.members)) ? ost.members : [];
  return list.filter((m) => m && !isSlotSpectating(m.slot));
}
function spectatorSlots() {
  const list = (ost && Array.isArray(ost.members)) ? ost.members : [];
  return list.filter((m) => m && isSlotSpectating(m.slot)).map((m) => m.slot);
}
function isSoloInRoom() {
  return !!(fbState.roomId && ost && ost.role === 'host' && (ost.members || []).length === 1);
}
function isSoloIdleMatch() {
  if (!fbState.roomId || !ost || ost.phase !== 'PLAYING') return false;
  if (ost.role === 'host') return !!fbState.soloIdle;
  return !!(fbState.roomState && fbState.roomState.soloIdle);
}

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
        fbState.soloIdle = false;
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

  const allPlayers = Object.values(fbState.players || {});
  const specSlots = allPlayers.filter((p) => p && p.spectating && typeof p.slot === 'number').map((p) => p.slot);
  const autoSlots = allPlayers.filter((p) => p && p.autoCpu && typeof p.slot === 'number').map((p) => p.slot);
  if (st.phase === 'LOBBY') fbState.soloIdle = false;

  if (st.seed && st.seed !== '0') hostRoundInfo.seed = String(st.seed);
  if (Array.isArray(st.seatSlots) && st.seatSlots.length) hostRoundInfo.seatSlots = st.seatSlots.slice();

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
    hostSlot: st.mySlot >= 0 ? st.mySlot : 0,
    soloIdle: st.phase === 'PLAYING' && !!fbState.soloIdle,
    spectatorSlots: specSlots,
    autoCpuSlots: autoSlots,
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
  const bySlot = new Map();
  if (Array.isArray(s.members)) {
    for (const m of s.members) {
      if (m && typeof m.slot === 'number') bySlot.set(m.slot, { slot: m.slot, name: m.name || 'プレイヤー' });
    }
  }
  for (const p of Object.values(fbState.players || {})) {
    if (p && typeof p.slot === 'number' && !bySlot.has(p.slot)) {
      bySlot.set(p.slot, { slot: p.slot, name: p.name || 'プレイヤー' });
    }
  }
  const membersList = [...bySlot.values()].sort((a, b) => (a.slot || 0) - (b.slot || 0));
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
      const slots = Array.isArray(s.seatSlots) && s.seatSlots.length ? s.seatSlots.join(',') : '0,1';
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

  // 待ったの依頼・結果 (対局に参加している席のみに依頼カードを出す)
  const isSeated = Array.isArray(s.seatSlots) && s.seatSlots.includes(myEntry.slot);
  if (s.undoAsk && s.undoAsk.round === round && isSeated) {
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

  // チャット (ゲスト側の現在のラウンド値に合わせて配送し、新規参加直後や複数局後もすべて受け取る)
  const chats = Array.isArray(s.chat) ? s.chat : [];
  for (const c of chats) {
    if (c && c.seq > guestApplied.chatSeq) {
      guestApplied.chatSeq = c.seq;
      mainCore.netText('host', `CHAT|${guestApplied.round}|${c.seq}|${c.slot}|${c.kind}|${c.body}`);
    }
  }
}

// 1人待ちプレイ中に誰かが参加したときの確認シート
function openSoloJoinPrompt(namesList) {
  const joinedLabel = namesList.length ? namesList.map((n) => esc(n)).join('・') : 'プレイヤー';
  setTimeout(focusPrimary, 0);
  openSheet(`<h2>${joinedLabel}が参加しました</h2><p>現在のゲームを終了しますか？</p><div class="btns"><button class="btn" id="soloKeep">続ける</button><button class="btn primary" id="soloEnd">終了する</button></div>`);
  $('#soloKeep').onclick = () => {
    closeSheet();
    scheduleHostSync();
  };
  $('#soloEnd').onclick = () => {
    fbState.soloIdle = false;
    closeSheet();
    mainCore.onlineBackToLobby();
    scheduleHostSync();
  };
}

// ホスト側で Firebase の players 一覧の変化を OnlineRoom のメンバーと同期する
const peerNames = new Map(); // uid -> name
const peerSlots = new Map(); // uid -> slot
function syncHostPlayers(playersMap) {
  if (!netApi || netApi.role !== 'host' || !mainCore) return;
  const myUid = netApi.uid;
  const currentUids = new Set();

  const entries = Object.values(playersMap || {}).filter((p) => p && p.uid && p.uid !== myUid);
  entries.sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));

  const newlyJoinedNames = [];
  for (const p of entries) {
    currentUids.add(p.uid);
    peerNames.set(p.uid, p.name || 'プレイヤー');
    if (typeof p.slot === 'number') peerSlots.set(p.uid, p.slot);
    if (!uidToPeerId.has(p.uid)) {
      const peerId = 'fb_' + (peerSeq++);
      uidToPeerId.set(p.uid, peerId);
      peerIdToUid.set(peerId, p.uid);
      mainCore.netLinked(peerId);
      const slotArg = typeof p.slot === 'number' ? p.slot : '';
      mainCore.netText(peerId, `HELLO|${p.name || 'プレイヤー'}|${p.proto || 2}|${p.rules || ''}|${slotArg}`);
      if (!fbState.knownPlayerUids.has(p.uid)) {
        fbState.knownPlayerUids.add(p.uid);
        const nm = p.name || 'プレイヤー';
        newlyJoinedNames.push(nm);
        mainCore.onlineSystemChat(`${nm}が参加しました`);
      }
      scheduleHostSync();
    }
  }

  for (const [uid, peerId] of [...uidToPeerId.entries()]) {
    if (!currentUids.has(uid)) {
      const oldName = peerNames.get(uid) || 'プレイヤー';
      const trackedSlot = peerSlots.has(uid) ? peerSlots.get(uid) : -1;
      peerNames.delete(uid);
      peerSlots.delete(uid);
      uidToPeerId.delete(uid);
      peerIdToUid.delete(peerId);
      // 対局中に誰かが抜けた場合は席をCPUへ変換
      const leftSlot = Array.isArray(hostRoundInfo.seatSlots) && hostRoundInfo.seatSlots.includes(trackedSlot)
        ? trackedSlot
        : -1;
      mainCore.netUnlinked(peerId);
      if (leftSlot >= 0) {
        try { mainCore.onlineConvertSeatToCpu(leftSlot); } catch (e) {}
      }
      if (!fbState.kickedUids.has(uid)) {
        mainCore.onlineSystemChat(`${oldName}が退出しました`);
      }
      fbState.kickedUids.delete(uid);
      fbState.knownPlayerUids.delete(uid);
      scheduleHostSync();
    }
  }

  netApi.syncDisconnectPolicy(entries.length + 1).catch(() => {});

  if (newlyJoinedNames.length && fbState.soloIdle && ost && ost.phase === 'PLAYING') {
    const fresh = newlyJoinedNames.filter((_, idx) => {
      const e = entries.find((x) => (x.name || 'プレイヤー') === newlyJoinedNames[idx]);
      if (!e || fbState.promptedJoinUids.has(e.uid)) return false;
      fbState.promptedJoinUids.add(e.uid);
      return true;
    });
    if (fresh.length) openSoloJoinPrompt(fresh);
  }
  scheduleHostSync();
}

function handleGuestActionOnHost(act) {
  if (!act || !act.uid || !netApi || netApi.role !== 'host' || !mainCore) return;
  const peerId = uidToPeerId.get(act.uid);
  if (!peerId) return;
  if (act.type === 'WIRE' && typeof act.text === 'string') {
    if (act.text.startsWith('CHAT_REQ|') && !isChatEnabled()) return;
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
  syncPublicRoomsWatch();
}
const cpuLvForRoom = () => lvIndex(S.set.cpuLv);

// 起動時に Firebase 匿名ログインを開始しておく(app.js 読込完了後に実行)
const startNetInit = () => { ensureNet().catch(() => {}); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startNetInit, { once: true });
else setTimeout(startNetInit, 0);

// ---------------------------------------------------------------- ホスト移譲・引き継ぎ・キック・フラグ操作
function nextHostCandidateUid(excludeUid) {
  const candidates = Object.values(fbState.players || {})
    .filter((p) => p && p.uid && p.uid !== excludeUid)
    .sort((a, b) => ((+a.joinedAt || 0) - (+b.joinedAt || 0)) || ((a.slot ?? 99) - (b.slot ?? 99)) || String(a.uid).localeCompare(String(b.uid)));
  return candidates[0] ? candidates[0].uid : null;
}

function maybeElectNewHost() {
  if (!netApi || netApi.role === 'host' || !fbState.roomId || fbState.takingOver) return;
  if (!fbState.hostUid) return;
  const players = fbState.players || {};
  if (!players[netApi.uid]) return;
  if (players[fbState.hostUid]) return;
  const nextUid = nextHostCandidateUid(null);
  if (nextUid && nextUid === netApi.uid) {
    promoteToHostFromState(true);
  }
}

async function promoteToHostFromState(isTakeover = false) {
  if (!netApi || !fbState.roomId || !mainCore || fbState.takingOver) return;
  if (netApi.role === 'host') return;
  fbState.takingOver = true;
  try {
    const players = Object.assign({}, fbState.players || {});
    const myUid = netApi.uid;
    const myPlayer = players[myUid];
    if (!myPlayer) return;
    const mySlot = typeof myPlayer.slot === 'number' ? myPlayer.slot : (ost ? ost.mySlot : 0);
    const rs = fbState.roomState || {};
    const prevHostSlot = typeof rs.hostSlot === 'number' ? rs.hostSlot : 0;
    const prevHostMember = Array.isArray(rs.members) ? rs.members.find((m) => m && m.slot === prevHostSlot) : null;
    const oldHostName = (prevHostMember && prevHostMember.name) || '';

    uidToPeerId.clear();
    peerIdToUid.clear();
    peerNames.clear();
  peerSlots.clear();
    hostSentLog = [];
    fbState.knownPlayerUids = new Set(Object.keys(players));

    const sortedPlayers = Object.values(players).filter((p) => p && p.uid).sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
    const membersSnap = [];
    const presentSlots = new Set();
    for (const p of sortedPlayers) {
      if (typeof p.slot !== 'number') continue;
      presentSlots.add(p.slot);
      let peerId = null;
      if (p.uid !== myUid) {
        peerId = 'fb_' + (peerSeq++);
        uidToPeerId.set(p.uid, peerId);
        peerIdToUid.set(peerId, p.uid);
        peerNames.set(p.uid, p.name || 'プレイヤー');
      }
      membersSnap.push({ slot: p.slot, name: p.name || 'プレイヤー', peerId });
    }

    const wasPlaying = S.screen === 'play' && online;
    const rawSeatSlots = Array.isArray(rs.seatSlots) ? rs.seatSlots : [];
    const fixedSeatSlots = rawSeatSlots.map((sl) => (sl >= 0 && !presentSlots.has(sl) ? -1 : sl));
    const snapshot = {
      name: meName(),
      members: membersSnap,
      gameId: rs.gameId || (ost && ost.gameId) || 'reversi',
      options: rs.options || (ost && ost.options) || '',
      round: +(rs.round || (ost && ost.round) || 0),
      phase: rs.phase || (ost && ost.phase) || 'LOBBY',
      seed: String(rs.seed || '1'),
      seatSlots: fixedSeatSlots,
      names: Array.isArray(rs.names) ? rs.names : [],
      moves: Array.isArray(rs.moves) ? rs.moves : [],
      ready: Array.isArray(rs.ready) ? rs.ready : [],
      chat: Array.isArray(rs.chat) ? rs.chat : (ost && Array.isArray(ost.chat) ? ost.chat : []),
    };

    await netApi.assumeHost(sortedPlayers.length || 1);
    fbState.hostUid = myUid;
    hostRoundInfo = {
      round: snapshot.round,
      gameId: snapshot.gameId,
      options: snapshot.options,
      seed: snapshot.seed,
      seatSlots: fixedSeatSlots,
      names: snapshot.names,
      clockIndex: rs.clock ? +rs.clock.index : -1,
      clockSeconds: rs.clock ? +rs.clock.seconds : -1,
      undoAsk: rs.undoAsk || null,
      undoResult: rs.undoResult || null,
      undoResultSeq: (rs.undoResult && +rs.undoResult.seq) || 0,
    };
    fbState.soloIdle = false;

    chatSeen = snapshot.chat.length;
    const resJson = mainCore.onlineAssumeHost(mySlot, JSON.stringify(snapshot));
    const res = JSON.parse(resJson || '{}');
    ost = JSON.parse(mainCore.onlineState());
    lastBeginSeq = ost.beginSeq;

    if (wasPlaying && ost.phase === 'PLAYING' && res.matchHandle >= 0) {
      h = res.matchHandle;
      prevView = null;
      drawnView = null;
      const v0 = JSON.parse(mainCore.viewJson(h, 0));
      view = v0;
      mySeat = v0.mine >= 0 ? v0.mine : 0;
      refresh();
    }

    if (isTakeover) {
      const msg = oldHostName ? `${oldHostName}が退出したため、${meName()}がホストを引き継ぎました` : `${meName()}がホストを引き継ぎました`;
      mainCore.onlineSystemChat(msg);
    } else {
      mainCore.onlineSystemChat(`${meName()}がホストになりました`);
    }
    flushHostStateToFirebase();
    toast({ w: 'お知らせ', t: 'あなたがホストになりました' });
    onlineChanged();
  } catch (e) {
    console.warn('[Firebase] promoteToHostFromState error:', e);
  } finally {
    fbState.takingOver = false;
  }
}

function demoteHostToGuest() {
  if (!netApi || !fbState.roomId || !mainCore) return;
  if (netApi.role === 'guest' && ost && ost.role === 'guest') return;
  const wasPlaying = S.screen === 'play' && online;
  const prevChatLen = (ost && Array.isArray(ost.chat) ? ost.chat.length : 0);
  hostSyncScheduled = false;
  hostSentLog = [];
  uidToPeerId.clear();
  peerIdToUid.clear();
  peerNames.clear();
  peerSlots.clear();
  fbState.soloIdle = false;
  mainCore.onlineLeave();
  startGuestOnlineRoom(meName());
  if (fbState.roomState) {
    chatSeen = (fbState.roomState.chat || []).length || prevChatLen;
    applyRemoteStateOnGuest(fbState.roomState);
  }
  ost = JSON.parse(mainCore.onlineState());
  if (wasPlaying && ost.phase === 'PLAYING' && ost.match >= 0) {
    lastBeginSeq = ost.beginSeq;
    h = ost.match;
    prevView = null;
    drawnView = null;
    const v0 = JSON.parse(mainCore.viewJson(h, 0));
    view = v0;
    mySeat = v0.mine >= 0 ? v0.mine : 0;
    refresh();
  }
  toast({ w: 'お知らせ', t: 'ホストを変更しました' });
  onlineChanged();
}

async function transferHostToPlayer(targetUid) {
  if (!isHostRoom() || !netApi || !targetUid || targetUid === netApi.uid) return;
  const target = playerByUid(targetUid);
  if (!target) return;
  flushHostStateToFirebase();
  await netApi.transferHost(targetUid);
  fbState.hostUid = targetUid;
  demoteHostToGuest();
}

async function handoffHostAndLeave() {
  if (!netApi || !fbState.roomId) { leaveOnline('dissolve'); return; }
  if (isHostRoom()) {
    const nextUid = nextHostCandidateUid(netApi.uid);
    if (nextUid) {
      if (ost && ost.phase === 'PLAYING' && mainCore) {
        try { mainCore.onlineConvertSeatToCpu(ost.mySlot); } catch (e) {}
      }
      flushHostStateToFirebase();
      await netApi.transferHost(nextUid);
      fbState.hostUid = nextUid;
      leaveOnline('leave');
      return;
    }
  }
  leaveOnline(isHostRoom() ? 'dissolve' : 'leave');
}

async function kickPlayerFromRoom(targetUid) {
  if (!isHostRoom() || !netApi || !targetUid || targetUid === netApi.uid) return;
  const target = playerByUid(targetUid);
  if (!target) return;
  const targetName = target.name || 'プレイヤー';
  const targetSlot = typeof target.slot === 'number' ? target.slot : -1;
  fbState.kickedUids.add(targetUid);
  if (ost && ost.phase === 'PLAYING' && targetSlot >= 0) {
    try { mainCore.onlineConvertSeatToCpu(targetSlot); } catch (e) {}
  }
  const peerId = uidToPeerId.get(targetUid);
  if (peerId) {
    uidToPeerId.delete(targetUid);
    peerIdToUid.delete(peerId);
    peerNames.delete(targetUid);
    mainCore.netUnlinked(peerId);
  }
  await netApi.kickPlayer(targetUid);
  mainCore.onlineSystemChat(`${targetName}がキックされました`);
  scheduleHostSync();
  toast({ w: 'お知らせ', t: `${targetName}をキックしました` });
}

function toggleSpectating() {
  if (!netApi || !fbState.roomId || !netApi.uid) return;
  if (ost && ost.phase === 'PLAYING') return toast({ w: 'お知らせ', t: '対局中は観戦モードを切り替えられません' });
  const p = fbState.players[netApi.uid];
  const next = !(p && p.spectating);
  if (p) p.spectating = next;
  netApi.setPlayerFlags({ spectating: next }).catch(() => {});
  if (isHostRoom()) scheduleHostSync();
  toast({ w: 'お知らせ', t: next ? '観戦モードをONにしました' : '観戦モードをOFFにしました' });
  render();
}

function toggleAutoCpu() {
  if (!netApi || !fbState.roomId || !netApi.uid || !online || !view || view.outcome || view.mine < 0) return;
  const p = fbState.players[netApi.uid];
  const next = !(p && p.autoCpu);
  if (p) p.autoCpu = next;
  netApi.setPlayerFlags({ autoCpu: next }).catch(() => {});
  if (isHostRoom()) {
    scheduleHostSync();
    if (next && !busy && view.toMove === mySeat) refresh();
  }
  toast({ w: 'お知らせ', t: next ? 'CPU(中級)に操作を任せます' : 'CPU操作を解除し、自分で操作します' });
  drawPlay(true);
}

function openPlayerActionSheet(targetUid) {
  if (!isHostRoom() || !netApi || !targetUid || targetUid === netApi.uid) return;
  const p = playerByUid(targetUid);
  if (!p) return;
  const tags = [p.spectating ? '観戦モード中' : '', p.autoCpu ? 'CPUが操作中…' : ''].filter(Boolean).join('・');
  setTimeout(focusPrimary, 0);
  openSheet(`<h2>${esc(p.name || 'プレイヤー')}</h2>
    <p>${tags ? esc(tags) + '<br>' : ''}このプレイヤーへの操作を選んでください。</p>
    <div class="btns" style="flex-wrap:wrap">
      <button class="btn" data-sheetback>キャンセル</button>
      <button class="btn gold" id="pmHost">ホストを変更</button>
      <button class="btn danger" id="pmKick">キック</button>
    </div>`);
  $('#pmHost').onclick = async () => { closeSheet(); await transferHostToPlayer(targetUid); };
  $('#pmKick').onclick = async () => { closeSheet(); await kickPlayerFromRoom(targetUid); };
}

function openMemberSheet() {
  if (!roomActive()) return;
  const hostSlot = hostSlotOfRoom();
  const myUid = netApi ? netApi.uid : null;
  const rows = (ost.members || []).map((m, i) => {
    const uid = playerUidBySlot(m.slot);
    const p = uid ? playerByUid(uid) : null;
    const isMe = m.slot === ost.mySlot;
    const isH = m.slot === hostSlot;
    const spec = isSlotSpectating(m.slot);
    const cpu = isSlotAutoCpu(m.slot);
    const badges = [
      isH ? '<span class="badge host">ホスト</span>' : '',
      spec ? '<span class="badge spec">観戦</span>' : '',
      cpu ? '<span class="badge cpu">CPUが操作中…</span>' : '',
    ].filter(Boolean).join('');
    const canManage = isHostRoom() && uid && uid !== myUid;
    return `<div class="seat" style="justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        ${isMe ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}
        <span class="nm">${esc(m.name)}${isMe ? '(あなた)' : ''}<small>${badges || '参加者・接続中'}</small></span>
      </div>
      ${canManage ? `<div style="display:flex;gap:6px"><button class="btn" data-pm-host="${esc(uid)}">ホストを変更</button><button class="btn danger" data-pm-kick="${esc(uid)}">キック</button></div>` : ''}
    </div>`;
  }).join('');
  const maxP = (fbState.roomSettings && fbState.roomSettings.maxPlayers) || 6;
  openSheet(`<h2>参加メンバー ${(ost.members || []).length}/${maxP}</h2><div class="seats" style="margin:8px 0">${rows}</div><div class="btns"><button class="btn" data-sheetback>閉じる</button></div>`);
  document.querySelectorAll('[data-pm-host]').forEach((b) => {
    b.onclick = async () => { const u = b.dataset.pmHost; closeSheet(); await transferHostToPlayer(u); };
  });
  document.querySelectorAll('[data-pm-kick]').forEach((b) => {
    b.onclick = async () => { const u = b.dataset.pmKick; closeSheet(); await kickPlayerFromRoom(u); };
  });
}

// スタンプ: 0〜15 番はスタンプとして送る。16 番からは「《名前》」の文字で送り、絵で出す
function stampIdx(m) {
  if (m.kind === 1) { const i = +m.body; return i >= 0 && i < STAMPS.length ? i : -1; }
  const k = /^《(.+)》$/.exec(m.body || ''); if (!k) return -1;
  const i = STAMPS.findIndex((x) => x[0] === k[1]); return i >= ONLINE_STAMPS ? i : -1;
}
function chatBox() {
  const chatOn = isChatEnabled();
  const list = online || (ost && ost.role !== 'none') ? (ost ? ost.chat : []) : [];
  if (!chatOn) S.stOpen = false;
  const canSend = chatOn && !!(ost && ost.chatOk);
  const bodyHtml = !chatOn
    ? '<div class="dimtxt">チャットは無効になっています</div>'
    : (list.length ? list.map((m) => {
        if (m.kind === 2) return `<div class="msg sys">${esc(m.body)}</div>`;
        const mine = ost && m.slot === ost.mySlot;
        return `<div class="msg ${mine ? 'mine' : ''} ${stampIdx(m) >= 0 ? 'st' : ''}">${mine ? '' : `<small>${esc(m.name)}</small>`}${stampIdx(m) >= 0 ? stamp(stampIdx(m)) : esc(m.body)}</div>`;
      }).join('') : '<div class="dimtxt">チャットはまだありません</div>');
  return `<div class="chat${chatOn ? '' : ' chat-off'}"><div class="log" id="log">${bodyHtml}</div>
   ${chatOn && S.stOpen ? `<div class="stpanel">${STAMPS.map((s, i) => `<button type="button" data-stamp="${i}" title="${s[0]}" aria-label="${s[0]}">${stamp(i)}</button>`).join('')}</div>` : ''}
   <form id="chatf"><button type="button" class="stbtn" data-stopen aria-expanded="${chatOn ? S.stOpen : false}" aria-label="スタンプ" ${canSend ? '' : 'disabled'}>${ic('smile')}</button><input id="chatin" placeholder="${chatOn ? 'メッセージ' : 'チャット無効'}" maxlength="40" autocomplete="off" aria-label="メッセージ" ${canSend ? '' : 'disabled'}><button ${canSend ? '' : 'disabled'}>送る</button></form></div>`;
}
function sendChat(t, st) {
  if (!mainCore || !ost) return;
  if (!isChatEnabled()) return toast({ w: 'お知らせ', t: 'チャットは無効になっています' });
  const ok = st != null ? (st < ONLINE_STAMPS ? mainCore.onlineSendChat(1, String(st)) : mainCore.onlineSendChat(0, `《${STAMPS[st][0]}》`)) : mainCore.onlineSendChat(0, t);
  if (ok) {
    sfxPop(true);
    if (isHostRoom()) scheduleHostSync();
  } else toast({ w: 'お知らせ', t: '少し待ってから送ってください' });
  if (st != null) {
    if (S.screen === 'play') refreshChat();
    else render();
  }
}

// ---------------------------------------------------------------- ルーム設定・公開ルーム一覧
function applyRoomSettingsUpdate(partial) {
  if (!partial) return;
  if (fbState.roomId) {
    if (!isHostRoom()) return;
    const minPlayers = Math.max(2, (ost && Array.isArray(ost.members) ? ost.members.length : 1));
    const next = Object.assign({}, fbState.roomSettings, partial);
    next.maxPlayers = Math.max(minPlayers, Math.min(6, Number(next.maxPlayers) || 6));
    if (next.chatEnabled === false) S.stOpen = false;
    fbState.roomSettings = next;
    netApi && netApi.updateRoomSettings && netApi.updateRoomSettings(next).catch(() => {});
  } else {
    const next = Object.assign({}, fbState.draftSettings, partial);
    next.maxPlayers = Math.max(2, Math.min(6, Number(next.maxPlayers) || 6));
    fbState.draftSettings = next;
  }
  render();
}

function roomSettingsRows(s, editable, minMax) {
  const rseg = (key, opts, val) => `<div class="seg" data-rseg="${key}">${opts.map(([v, l]) => `<button type="button" data-rv="${esc(v)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join('')}</div>`;
  if (!editable) {
    return `
      <div class="row"><span>公開設定</span><b>${s.isPublic ? '公開' : '非公開'}</b></div>
      <div class="row"><span>チャット</span><b>${s.chatEnabled ? 'ON' : 'OFF'}</b></div>
      <div class="row"><span>最大人数</span><b class="num">${s.maxPlayers}人</b></div>
      <div class="row"><span>部屋のロック</span><b>${s.locked ? 'ロック中' : '開放'}</b></div>
      <div class="row"><span>雰囲気</span><b>${esc(s.vibe)}</b></div>`;
  }
  const minP = Math.max(2, Math.min(6, minMax || 2));
  return `
    <div class="row"><span>公開設定</span>${rseg('isPublic', [['false', '非公開'], ['true', '公開']], String(!!s.isPublic))}</div>
    <div class="row"><span>チャット</span>${rseg('chatEnabled', [['true', 'ON'], ['false', 'OFF']], String(s.chatEnabled !== false))}</div>
    <div class="row"><span>最大人数</span><span class="stepper"><button type="button" data-rmax="-1" aria-label="減らす" ${s.maxPlayers > minP ? '' : 'disabled'}>−</button><b class="num">${s.maxPlayers}人</b><button type="button" data-rmax="1" aria-label="増やす" ${s.maxPlayers < 6 ? '' : 'disabled'}>＋</button></span></div>
    <div class="row"><span>部屋のロック<small class="sub">これ以上入れない</small></span><button type="button" class="switch" role="switch" aria-checked="${!!s.locked}" data-rlock aria-label="部屋のロック"></button></div>
    <div class="row"><span>雰囲気</span>${rseg('vibe', [['ガチ', 'ガチ'], ['ボチボチ', 'ボチボチ'], ['まったり', 'まったり']], s.vibe || 'ボチボチ')}</div>`;
}

function publicRoomsListHtml() {
  const list = fbState.publicRooms || [];
  if (!fbState.publicRoomsLoaded && fbState.publicRoomsLoading) {
    return '<p class="dimtxt">公開ルームを読み込んでいます…</p>';
  }
  if (!list.length) {
    return '<p class="dimtxt">現在公開中のルームはありません</p>';
  }
  return `<div class="pubrooms">${list.map((rm) => {
    const g = gInfo(rm.gameId);
    const full = rm.playerCount >= rm.maxPlayers;
    const statusLabel = rm.phase === 'PLAYING' ? '対局中' : 'ロビー';
    return `<button type="button" class="pubroom-item" data-pubroom="${esc(rm.roomId)}">
      <span class="pubroom-art">${g ? artOf(g.id) : ''}</span>
      <span class="pubroom-main">
        <span class="pubroom-top"><b>${esc(g ? g.name : rm.gameId)}</b><span class="pubroom-code">#${esc(rm.roomId)}</span></span>
        <span class="pubroom-sub">ホスト: ${esc(rm.hostName)}</span>
        <span class="pubroom-badges">
          <span class="badge">${rm.playerCount}/${rm.maxPlayers}人</span>
          <span class="badge ${rm.phase === 'PLAYING' ? 'playing' : 'lobby'}">${statusLabel}</span>
          <span class="badge vibe">${esc(rm.vibe)}</span>
          <span class="badge ${rm.chatEnabled ? '' : 'off'}">チャット ${rm.chatEnabled ? 'ON' : 'OFF'}</span>
          ${rm.locked ? '<span class="badge locked">ロック中</span>' : full ? '<span class="badge locked">満員</span>' : ''}
        </span>
      </span>
    </button>`;
  }).join('')}</div>`;
}

function syncPublicRoomsWatch() {
  const shouldWatch = !!(netReady && netApi && typeof netApi.watchPublicRooms === 'function' && S.screen === 'room' && !fbState.roomId);
  if (shouldWatch && !publicRoomsUnsub) {
    fbState.publicRoomsLoading = true;
    publicRoomsUnsub = netApi.watchPublicRooms((list) => {
      fbState.publicRooms = Array.isArray(list) ? list : [];
      fbState.publicRoomsLoading = false;
      fbState.publicRoomsLoaded = true;
      if (S.screen === 'room' && !fbState.roomId) {
        const box = $('#pubroomsBox');
        const cnt = $('#pubroomsCount');
        if (box) {
          box.innerHTML = publicRoomsListHtml();
          if (cnt) cnt.textContent = String(fbState.publicRooms.length);
        } else if (!$('#sheetwrap')) {
          render();
        }
      }
    });
  } else if (!shouldWatch && publicRoomsUnsub) {
    try { publicRoomsUnsub(); } catch {}
    publicRoomsUnsub = null;
  }
}

let refreshSpinTimer = null;
async function refreshPublicRooms() {
  if (!netApi || typeof netApi.listPublicRooms !== 'function') {
    await ensureNet();
  }
  if (!netApi || typeof netApi.listPublicRooms !== 'function') return;
  fbState.publicRoomsLoading = true;
  const spinUntil = Date.now() + 450;
  if (refreshSpinTimer) { clearTimeout(refreshSpinTimer); refreshSpinTimer = null; }
  const btn = document.querySelector('[data-pubrefresh]');
  if (btn) { btn.disabled = true; btn.classList.add('is-spin'); }
  try {
    fbState.publicRooms = await netApi.listPublicRooms();
    fbState.publicRoomsLoaded = true;
  } catch (e) {
    toast({ w: 'お知らせ', t: '公開ルーム一覧を更新できませんでした' });
  } finally {
    fbState.publicRoomsLoading = false;
    const box = $('#pubroomsBox');
    const cnt = $('#pubroomsCount');
    if (box) {
      box.innerHTML = publicRoomsListHtml();
      if (cnt) cnt.textContent = String(fbState.publicRooms.length);
      if (btn) {
        btn.disabled = false;
        const left = Math.max(0, spinUntil - Date.now());
        refreshSpinTimer = setTimeout(() => {
          refreshSpinTimer = null;
          const b2 = document.querySelector('[data-pubrefresh]');
          if (b2 && !fbState.publicRoomsLoading) b2.classList.remove('is-spin');
        }, left);
      }
    } else {
      render();
    }
  }
}

function openPublicRoomSheet(roomId) {
  const rm = (fbState.publicRooms || []).find((x) => x.roomId === roomId);
  if (!rm) return toast({ w: 'お知らせ', t: 'このルームは見つかりませんでした' });
  const g = gInfo(rm.gameId);
  const full = rm.playerCount >= rm.maxPlayers;
  const blockedReason = rm.locked
    ? 'この部屋はロックされているため参加できません。'
    : full
      ? 'この部屋は満員のため参加できません。'
      : '';
  setTimeout(focusPrimary, 0);
  openSheet(`<div id="pubroomDetail">
    <h2>ルーム ${esc(rm.roomId)}</h2>
    <div class="pubroom-detail-list">
      <div class="row"><span>現在の人数</span><b class="num">${rm.playerCount}/${rm.maxPlayers}人</b></div>
      <div class="row"><span>ステータス</span><b>${rm.phase === 'PLAYING' ? '対局中' : 'ロビー'}</b></div>
      <div class="row"><span>チャット</span><b>${rm.chatEnabled ? 'ON' : 'OFF'}</b></div>
      <div class="row"><span>雰囲気</span><b>${esc(rm.vibe)}</b></div>
      <div class="row"><span>選択中のゲーム</span><span class="pub-detail-game">${g ? `<span class="art">${artOf(g.id)}</span>` : ''}<b>${esc(g ? g.name : rm.gameId)}</b></span></div>
    </div>
    ${blockedReason ? `<p class="err" style="margin:8px 0 0">${esc(blockedReason)}</p>` : ''}
    <div class="btns" style="margin-top:14px">
      <button type="button" class="btn" data-sheetback>キャンセル</button>
      <button type="button" class="btn primary" id="pubJoinGo" ${blockedReason ? 'disabled' : ''}>参加</button>
    </div>
  </div>`);
  $('#pubJoinGo').onclick = () => {
    closeSheet();
    joinFirebaseRoom(rm.roomId);
  };
}

// ---------------------------------------------------------------- 部屋の画面 (4桁のルームコードマッチング)
function room() {
  const st = ost || { role: 'none', members: [] };
  const host = st.role === 'host', none = st.role === 'none';
  const g = st.gameId && gInfo(st.gameId);
  const hostSlot = hostSlotOfRoom();
  const myUid = netApi ? netApi.uid : null;
  const mySpec = mySpectatingOn();
  const rSet = currentRoomSettings();
  const maxP = rSet.maxPlayers || 6;
  let left = '';

  if (fbState.authError) {
    left += `<div class="panel" style="border-color:#C8463C;background:rgba(200,70,60,.08)"><h3>通信の設定案内</h3><p class="err" style="white-space:pre-wrap;margin:4px 0">${esc(fbState.authError)}</p></div>`;
  }

  // 1. 部屋を作る / ルームコード
  left += `<div class="panel" style="padding-bottom:12px"><h3>${none ? '部屋を作る' : 'ルームコード'}</h3>
     ${none ? `${roomSettingsRows(rSet, true, 2)}<button class="btn primary" style="width:100%;margin-top:10px;letter-spacing:.1em" data-mkroom ${fbState.creating || fbState.joining ? 'disabled' : ''}>${fbState.creating ? '部屋を作っています…' : '部屋を作る'}</button>` : ''}
     ${ fbState.roomId ? `<div class="invite"><p>${host ? 'このルームコードを相手に伝えてください' : '参加中のルームコード'}</p>
       <div class="code" style="font-size:28px;font-weight:900;letter-spacing:.25em;text-align:center;padding:12px 10px">${esc(fbState.roomId)}</div>
       <button class="btn gold copybig" data-copy="${esc(fbState.roomId)}">${ic('copy')}ルームコードをコピー</button></div>` : '' }
     ${fbState.error && host ? `<p class="err">${esc(fbState.error)}</p>` : ''}</div>`;

  // 2. ルームコードを入力して参加する (未入室時) / ルーム設定 (入室中)
  if (none) {
    left += `<div class="panel" style="padding-bottom:10px"><h3>部屋に入る</h3>
      ${fbState.error ? `<p class="err">${esc(fbState.error)}</p>` : ''}
      <div class="codebox"><input id="joinIn" placeholder="ルームコード (例: 1234)" value="${esc(drafts.join)}" maxlength="4" inputmode="numeric" pattern="[0-9]*" aria-label="ルームコード" spellcheck="false" ${fbState.joining ? 'disabled' : ''}><button class="btn primary" style="height:38px" data-join ${fbState.joining ? 'disabled' : ''}>${fbState.joining ? '入室中…' : '参加する'}</button></div></div>`;
  } else {
    left += `<div class="panel" style="padding-bottom:8px"><h3>ルーム設定</h3>${roomSettingsRows(rSet, host, Math.max(2, st.members.length))}</div>`;
  }

  // 3. 参加者一覧と退出・解散
  if (!none) {
    const memberRows = st.members.map((m, i) => {
      const uid = playerUidBySlot(m.slot);
      const isMe = m.slot === st.mySlot;
      const isH = m.slot === hostSlot;
      const spec = isSlotSpectating(m.slot);
      const cpu = isSlotAutoCpu(m.slot);
      const canClick = host && uid && uid !== myUid;
      const tags = [isH ? 'ホスト' : '参加者', '接続中', spec ? '観戦モード' : '', cpu ? 'CPUが操作中…' : ''].filter(Boolean).join('・');
      const inner = `${isMe ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}<span class="nm">${esc(m.name)}${isMe ? '(あなた)' : ''}<small>${esc(tags)}</small></span>`;
      return canClick
        ? `<button type="button" class="seat seat-btn" data-pmenu="${esc(uid)}" title="クリックしてホスト変更・キック">${inner}<span class="seat-act">管理 ▾</span></button>`
        : `<div class="seat">${inner}</div>`;
    }).join('');
    left += `<div class="panel" style="padding-bottom:10px"><h3>参加メンバー ${st.members.length}/${maxP}</h3>
    <div class="seats" style="padding-top:6px">${memberRows}</div>
    ${st.transportError ? `<p class="err">${esc(st.transportError)}</p>` : ''}
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap">
      ${st.phase === 'LOBBY' ? `<button class="btn ${mySpec ? 'gold' : ''}" data-toggle-spec style="height:38px">${mySpec ? '観戦モード: ON' : '観戦モード'}</button>` : '<span></span>'}
      <button class="btn" data-leave style="height:38px">${host ? (st.members.length > 1 ? '部屋を出る / 解散' : '部屋を解散する') : '部屋を出る'}</button>
    </div></div>`;
    left += `<div style="height:260px;display:flex">${chatBox().replace('class="chat"', 'class="chat" style="flex:1"')}</div>`;
  }

  // 4. 公開ルーム一覧(未入室時) / 対局中案内(入室時) ＋ 遊び方
  const howtoPanel = `<div class="panel"><h3>遊び方</h3><div class="howto"><p><b>部屋を作る人</b>: 「部屋を作る」を押して、発行された4桁のルームコードを相手に伝えます。公開に設定すると一覧にも表示されます。</p><p><b>参加する人</b>: 4桁のルームコードを入力するか、公開ルーム一覧から選んで参加します。</p><p><b>ホスト機能・観戦</b>: ホストは参加メンバーをクリックして「ホストを変更」「キック」ができます。次の対局を見学したい時は「観戦モード」をONにしてください。</p><p class="dimtxt">Webブラウザ版・Androidアプリ版・Windows版のどれからでも同じルームコードで対戦できます。</p></div></div>`;
  let right = '';
  if (none) {
    right += `<div class="panel"><div class="pubrooms-hd"><h3>公開ルーム一覧 <span class="badge" id="pubroomsCount">${(fbState.publicRooms || []).length}</span></h3><button type="button" class="btn pubrefresh-btn${fbState.publicRoomsLoading ? ' is-spin' : ''}" data-pubrefresh aria-label="公開ルーム一覧を更新" title="更新">${ic('refresh')}</button></div><div id="pubroomsBox">${publicRoomsListHtml()}</div></div>`;
  }
  if (!none && st.phase === 'PLAYING') {
    const inMatch = st.match >= 0;
    const isSpectator = fbState.roomState && Array.isArray(fbState.roomState.seatSlots) && !fbState.roomState.seatSlots.includes(st.mySlot);
    right = `<div class="panel"><h3>対局中</h3><div class="hero" style="margin:8px 0">${g ? `<span class="art">${artOf(g.id)}</span>` : ''}<div><h2>${g ? esc(g.name) : ''}</h2><p>${isSpectator ? '対局を観戦できます（次の対局から参加できます）' : inMatch ? '対局の画面から部屋に戻っています' : '次の対局から加わります。いまの対局が終わるまで待ってください'}</p></div></div>${inMatch ? `<div style="display:flex;justify-content:flex-end"><button class="btn primary" style="flex:none;width:280px" data-oreturn>${isSpectator ? '対局を観戦する' : '対局に戻る'}</button></div>` : ''}</div>`;
  }
  right += howtoPanel;
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
  fbState.soloIdle = false;
  fbState.takingOver = false;
  fbState.knownPlayerUids = new Set();
  fbState.kickedUids = new Set();
  fbState.promptedJoinUids = new Set();
  render();
  try {
    await ensureNet();
    uidToPeerId.clear();
    peerIdToUid.clear();
    peerNames.clear();
    peerSlots.clear();
    hostSentLog = [];
    hostRoundInfo = { round: 0, gameId: 'reversi', options: '', seed: '0', seatSlots: [], names: [], clockIndex: -1, clockSeconds: -1, undoAsk: null, undoResult: null, undoResultSeq: 0 };
    mainCore.onlineSetLevel(cpuLvForRoom());
    mainCore.onlineHost(meName());
    lastBeginSeq = 0;
    chatSeen = 0;
    const initSettings = Object.assign({}, fbState.draftSettings || DEFAULT_ROOM_SETTINGS);

    const res = await netApi.createRoom(
      { name: meName(), proto: 2, avatar: Number.isInteger(S.set.av) ? S.set.av : null },
      { phase: 'LOBBY', gameId: 'reversi', options: '', round: 0, hostSlot: 0, soloIdle: false, spectatorSlots: [], autoCpuSlots: [] },
      {
        onPlayers(players) {
          fbState.players = players || {};
          syncHostPlayers(fbState.players);
          onlineChanged();
        },
        onState(s) {
          fbState.roomState = s;
        },
        onSettings(settings) {
          if (settings) {
            fbState.roomSettings = settings;
            if (settings.chatEnabled === false) S.stOpen = false;
            onlineChanged();
          }
        },
        onCursors(cursors) {
          fbState.cursors = cursors || {};
          updateRemoteTargets(fbState.cursors);
        },
        onAction(act) {
          handleGuestActionOnHost(act);
        },
        onHostUid(uid) {
          fbState.hostUid = uid || null;
          if (!uid) return;
          if (uid === netApi.uid && netApi.role !== 'host') promoteToHostFromState(false);
          else if (uid !== netApi.uid && netApi.role === 'host') demoteHostToGuest();
          onlineChanged();
        },
        onKicked() {
          if (fbState.roomId) {
            leaveOnline('skip');
            S.screen = 'room';
            render();
            toast({ w: 'お知らせ', t: 'ホストによってルームからキックされました' });
          }
        },
        onRoomRemoved() {
          if (fbState.roomId) {
            leaveOnline('skip');
            S.screen = 'room';
            render();
          }
        }
      },
      initSettings
    );
    fbState.roomId = res.roomId;
    fbState.hostUid = res.uid;
    fbState.roomSettings = res.settings || initSettings;
    fbState.knownPlayerUids = new Set([res.uid]);
    fbState.creating = false;
    syncPublicRoomsWatch();
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
  fbState.soloIdle = false;
  fbState.takingOver = false;
  fbState.knownPlayerUids = new Set();
  fbState.kickedUids = new Set();
  fbState.promptedJoinUids = new Set();
  render();
  try {
    await ensureNet();
    resetGuestApplied();
    mainCore.onlineSetLevel(cpuLvForRoom());
    lastBeginSeq = 0;
    chatSeen = 0;

    const res = await netApi.joinRoom(
      code,
      { name: meName(), proto: 2, avatar: Number.isInteger(S.set.av) ? S.set.av : null },
      {
        onPlayers(players) {
          fbState.players = players || {};
          if (netApi && netApi.role === 'host') {
            syncHostPlayers(fbState.players);
          } else {
            if (fbState.roomState) applyRemoteStateOnGuest(fbState.roomState);
            maybeElectNewHost();
          }
          onlineChanged();
        },
        onState(s) {
          fbState.roomState = s;
          if (netApi && netApi.role === 'guest') applyRemoteStateOnGuest(s);
          onlineChanged();
        },
        onSettings(settings) {
          if (settings) {
            fbState.roomSettings = settings;
            if (settings.chatEnabled === false) S.stOpen = false;
            onlineChanged();
          }
        },
        onCursors(cursors) {
          fbState.cursors = cursors || {};
          updateRemoteTargets(fbState.cursors);
        },
        onAction(act) {
          handleGuestActionOnHost(act);
        },
        onHostUid(uid) {
          fbState.hostUid = uid || null;
          if (!uid) return;
          if (uid === netApi.uid && netApi.role !== 'host') promoteToHostFromState(false);
          else if (uid !== netApi.uid && netApi.role === 'host') demoteHostToGuest();
          onlineChanged();
        },
        onKicked() {
          if (fbState.roomId) {
            leaveOnline('skip');
            S.screen = 'room';
            render();
            toast({ w: 'お知らせ', t: 'ホストによってルームからキックされました' });
          }
        },
        onRoomRemoved() {
          if (fbState.roomId) {
            leaveOnline('skip');
            S.screen = 'room';
            render();
            toast({ w: 'お知らせ', t: 'ホストが部屋を解散しました' });
          }
        }
      }
    );

    fbState.roomId = res.roomId;
    fbState.hostUid = res.hostUid || null;
    fbState.roomSettings = res.settings || Object.assign({}, DEFAULT_ROOM_SETTINGS);
    fbState.joining = false;
    syncPublicRoomsWatch();
    S.screen = 'menu';
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
  resetGuestApplied();
  const bridge = createCoreBridge();
  // acceptInvite が即座に peerId='host' を返し、linkState('host') === 'OPEN' により OnlineRoom.guest が立ち上がる
  bridge.backend.acceptInvite = (code, cb) => cb('host', 'FIREBASE', null);
  mainCore.netInit(bridge.backend, bridge.relay, {
    changed: () => queueMicrotask(onlineChanged)
  });
  mainCore.onlineJoin(name, 'FIREBASE');
  mainCore.netInviteEvent();
}

function onlineClick(d, bElem) {
  if (d.mkroom != null || d.mkcode != null) { createFirebaseRoom(); return true; }
  if (d.join != null) { const v = ($('#joinIn') || {}).value || drafts.join || ''; joinFirebaseRoom(v); return true; }
  if (d.pubrefresh != null) { refreshPublicRooms(); return true; }
  if (d.pubroom) { openPublicRoomSheet(d.pubroom); return true; }
  if (d.rlock != null) { applyRoomSettingsUpdate({ locked: !currentRoomSettings().locked }); return true; }
  if (d.rmax != null) { applyRoomSettingsUpdate({ maxPlayers: (currentRoomSettings().maxPlayers || 6) + (+d.rmax || 0) }); return true; }
  if (d.rv != null) {
    const rsg = bElem && bElem.closest('[data-rseg]');
    if (rsg) {
      const k = rsg.dataset.rseg;
      const val = k === 'isPublic' || k === 'chatEnabled' ? (d.rv === 'true') : d.rv;
      applyRoomSettingsUpdate({ [k]: val });
      return true;
    }
  }
  if (d.pmenu) { openPlayerActionSheet(d.pmenu); return true; }
  if (d.oomembers != null) { openMemberSheet(); return true; }
  if (d.toggleSpec != null) { toggleSpectating(); return true; }
  if (d.autocpu != null) { toggleAutoCpu(); return true; }
  if (d.copy) {
    const b = bElem || document.querySelector(`[data-copy="${CSS.escape(d.copy)}"]`);
    navigator.clipboard.writeText(d.copy).then(() => { toast({ w: 'お知らせ', t: 'コピーしました' }); if (b) { const old = b.innerHTML; b.classList.add('done'); b.innerHTML = '✓ コピーしました'; setTimeout(() => { if (b.isConnected) { b.classList.remove('done'); b.innerHTML = old; } }, 2000); } }, () => toast({ w: 'お知らせ', t: 'コピーできませんでした。選んでコピーしてください' }));
    return true;
  }
  if (d.leave != null) {
    const host = isHostRoom();
    const hasOthers = ost && Array.isArray(ost.members) && ost.members.length > 1;
    setTimeout(focusPrimary, 0);
    if (host && hasOthers) {
      openSheet(`<h2>部屋を出ますか</h2><p>他のプレイヤーにホストを引き継いで自分だけ抜けるか、全員で部屋を解散するか選べます。</p><div class="btns" style="flex-wrap:wrap"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="lvDissolve">部屋を解散する</button><button class="btn gold" id="lvHandoff">ホストを引き継いで出る</button></div>`);
      $('#lvDissolve').onclick = () => { closeSheet(); sfx.play('BACK'); leaveOnline('dissolve'); render(); };
      $('#lvHandoff').onclick = async () => { closeSheet(); sfx.play('BACK'); await handoffHostAndLeave(); render(); };
    } else {
      openSheet(`<h2>${host ? '部屋を解散しますか' : '部屋を出ますか'}</h2><p>${host ? 'ルームを閉じ、チャット履歴を削除します。' : '部屋から退出します。'}</p><div class="btns"><button class="btn" data-sheetback>キャンセル</button><button class="btn danger" id="lvYes">${host ? '解散する' : '出る'}</button></div>`);
      $('#lvYes').onclick = () => { closeSheet(); sfx.play('BACK'); leaveOnline(host ? 'dissolve' : 'leave'); render(); };
    }
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
    if (isHostRoom() && isSoloInRoom()) {
      onlineStartSolo();
      return true;
    }
    // 観戦者が「次の対局に参加する」を押したら観戦モードを自動解除する
    if (mySpectatingOn() && netApi && netApi.uid) {
      if (fbState.players[netApi.uid]) fbState.players[netApi.uid].spectating = false;
      netApi.setPlayerFlags({ spectating: false }).catch(() => {});
    }
    mainCore.onlineAgain();
    if (isHostRoom()) {
      scheduleHostSync();
      const exSlots = new Set(spectatorSlots());
      const names = () => ost.members.filter((m) => !exSlots.has(m.slot) && (m.slot === ost.mySlot || ost.ready.includes(m.slot))).map((m) => esc(m.name)).join('・');
      openSheet(`<h2>もう一度</h2><p id="readyNames">準備ができた人: ${names()}</p><div class="btns"><button class="btn" data-sheetback>待つ</button><button class="btn gold" id="rgo">この人たちで始める</button></div>`);
      $('#rgo').onclick = () => {
        closeSheet();
        fbState.soloIdle = false;
        const exCsv = spectatorSlots().join(',');
        mainCore.onlineStartReady(String(Math.floor(Math.random() * 2 ** 40) + 1), exCsv);
        scheduleHostSync();
      };
    }
    return true;
  }
  if (d.olobby != null) { fbState.soloIdle = false; mainCore.onlineBackToLobby(); if (isHostRoom()) scheduleHostSync(); return true; }
  return false;
}
function chooseOnline(id) {
  if (!id || !isHostRoom()) return;
  if (!isSoloInRoom() && activeMembers().length === 0) return toast({ w: 'お知らせ', t: '全員が観戦モードのため開始できません' });
  S.roomPre = null;
  if (!ost || ost.gameId !== id) { mainCore.onlineChoose(id, ''); scheduleHostSync(); }
  try {
    const g = gInfo(id), ps = g && g.options.find((o) => o.key === 'players'), n = isSoloInRoom() ? 0 : activeMembers().length;
    if (ps && n) {
      const v = ps.values.find(([x]) => +x === n) || ps.values.find(([x]) => +x >= n) || ps.values[ps.values.length - 1];
      if (v) { const c = cfg(id); c.opts.players = v[0]; saveCfg(id, c); }
    }
  } catch (e) {}
  S.setup = { id, online: true };
  syncOnlineOptions();
  go('setup');
}
function syncOnlineOptions() {
  if (!S.setup.online || !isHostRoom()) return;
  const g = gInfo(S.setup.id), c = cfg(g.id);
  const opts = isSoloInRoom() ? soloEngineOpts(g, c) : engineOpts(g, c, true);
  mainCore.onlineChoose(g.id, opts);
  scheduleHostSync();
}
function soloEngineOpts(g, c) {
  const base = engineOpts(g, c, false).split(';').filter((x) => x && !x.startsWith('onlineUndo=') && !x.startsWith('moveSeconds='));
  base.push('onlineUndo=-1', `moveSeconds=${+c.limit || 0}`);
  return base.join(';');
}
async function onlineStartSolo() {
  if (!isHostRoom() || !S.setup.id) return;
  const g = gInfo(S.setup.id), c = cfg(g.id);
  if (!g) return;
  const opts = soloEngineOpts(g, c);
  mainCore.onlineSetLevel(c.level);
  mainCore.onlineChoose(g.id, opts);
  const total = await callW('seatCount', g.id, opts);
  const mySlot = ost ? ost.mySlot : 0;
  let seatOrder = [mySlot];
  if (total === 2) {
    const s = c.seat === -1 ? (Math.random() < 0.5 ? 0 : 1) : (c.seat === 1 ? 1 : 0);
    seatOrder = s === 0 ? [mySlot, -1] : [-1, mySlot];
  } else if (total > 2) {
    seatOrder = [mySlot];
    while (seatOrder.length < total) seatOrder.push(-1);
  }
  fbState.soloIdle = true;
  fbState.promptedJoinUids = new Set();
  const ok = mainCore.onlineStartParticipants(String(Math.floor(Math.random() * 2 ** 40) + 1), String(mySlot), seatOrder.join(','));
  if (!ok) {
    fbState.soloIdle = false;
    toast({ w: 'お知らせ', t: 'このゲームは現在の設定では始められません' });
  } else {
    scheduleHostSync();
  }
}

function openSpectatorSelectSheet(g, total) {
  const members = (ost && Array.isArray(ost.members)) ? ost.members.slice() : [];
  if (!members.length) return;
  const hostSlot = hostSlotOfRoom();
  const selectedSpecs = new Set(members.filter((m) => isSlotSpectating(m.slot)).map((m) => m.slot));
  const activeCount = () => members.filter((m) => !selectedSpecs.has(m.slot)).length;

  const renderRows = () => members.map((m, i) => {
    const isMe = m.slot === ost.mySlot;
    const isH = m.slot === hostSlot;
    const isSpec = selectedSpecs.has(m.slot);
    return `<button type="button" class="seat seat-btn spec-row${isSpec ? ' is-spec' : ''}" data-spec-slot="${m.slot}">
      <span class="spec-left">
        ${isMe ? meAv() : `<span class="avatar" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(m.name[0])}</span>`}
        <span class="nm">${esc(m.name)}${isMe ? '(あなた)' : ''}<small>${isH ? '<span class="badge host">ホスト</span>' : ''}${isSlotSpectating(m.slot) ? '<span class="badge spec">元々観戦</span>' : ''}</small></span>
      </span>
      <span class="badge ${isSpec ? 'spec' : 'lobby'}">${isSpec ? '観戦者' : '対局する'}</span>
    </button>`;
  }).join('');

  setTimeout(focusPrimary, 0);
  openSheet(`<div id="specSelectSheet">
    <h2>観戦者を選んでください</h2>
    <p id="specHint"></p>
    <div class="seats spec-list" id="specList">${renderRows()}</div>
    <div class="btns" style="margin-top:12px">
      <button type="button" class="btn" data-sheetback>キャンセル</button>
      <button type="button" class="btn primary" id="specStartGo">スタート</button>
    </div>
  </div>`);

  const syncUi = () => {
    const actN = activeCount();
    const need = Math.max(0, actN - total);
    const hint = $('#specHint');
    if (hint) {
      if (actN === 0) hint.textContent = `「${g.name}」の最大人数は ${total}人 です。対局する人を1人以上残してください。`;
      else if (need > 0) hint.textContent = `「${g.name}」の最大人数（${total}人）より参加者が多いため、あと ${need}人 を観戦者にしてください。（現在 対局 ${actN}人 / 観戦 ${members.length - actN}人）`;
      else hint.textContent = `対局 ${actN}人・観戦 ${members.length - actN}人 で開始できます。`;
    }
    const listEl = $('#specList');
    if (listEl) {
      listEl.innerHTML = renderRows();
      listEl.querySelectorAll('[data-spec-slot]').forEach((b) => {
        b.onclick = () => {
          const sl = +b.dataset.specSlot;
          if (selectedSpecs.has(sl)) selectedSpecs.delete(sl);
          else selectedSpecs.add(sl);
          syncUi();
        };
      });
    }
    const goBtn = $('#specStartGo');
    if (goBtn) goBtn.disabled = !(actN >= 1 && actN <= total);
  };
  syncUi();

  $('#specStartGo').onclick = async () => {
    const actSlots = members.filter((m) => !selectedSpecs.has(m.slot)).map((m) => m.slot);
    if (!actSlots.length || actSlots.length > total) return;
    closeSheet();
    const spectatingByUid = {};
    for (const m of members) {
      const uid = playerUidBySlot(m.slot);
      if (!uid) continue;
      const val = selectedSpecs.has(m.slot);
      spectatingByUid[uid] = val;
      if (fbState.players[uid]) fbState.players[uid].spectating = val;
    }
    if (netApi && typeof netApi.setPlayersSpectating === 'function') {
      try { await netApi.setPlayersSpectating(spectatingByUid); } catch (e) {}
    }
    fbState.soloIdle = false;
    syncOnlineOptions();
    const ok = mainCore.onlineStartParticipants(String(Math.floor(Math.random() * 2 ** 40) + 1), actSlots.join(','), '');
    if (!ok) toast({ w: 'お知らせ', t: '参加人数がこのゲームの席数より多いか、遊べない設定です' });
    else scheduleHostSync();
  };
}

async function onlineChooseAndStart() {
  if (!isHostRoom()) return toast({ w: 'お知らせ', t: 'ホストが始めるのを待っています' });
  if (isSoloInRoom()) return onlineStartSolo();
  const act = activeMembers();
  if (!act.length) return toast({ w: 'お知らせ', t: '参加プレイヤーがいません（観戦モードを解除してください）' });
  const g = gInfo(S.setup.id), c = cfg(g.id);
  const opts = engineOpts(g, c, true);
  syncOnlineOptions();
  const total = await callW('seatCount', g.id, opts);
  if (act.length > total) {
    openSpectatorSelectSheet(g, total);
    return;
  }
  fbState.soloIdle = false;
  const ok = mainCore.onlineStartParticipants(String(Math.floor(Math.random() * 2 ** 40) + 1), act.map((m) => m.slot).join(','), '');
  if (!ok) toast({ w: 'お知らせ', t: '参加人数がこのゲームの席数より多いか、遊べない設定です' });
  else scheduleHostSync();
}
function leaveOnlinePlay() {
  try {
    if (ost && ost.phase === 'PLAYING') {
      const isSpectator = view && view.mine < 0;
      if (isHostRoom()) { fbState.soloIdle = false; mainCore.onlineBackToLobby(); scheduleHostSync(); }
      else if (!isSpectator && view && !view.outcome && ost.canResign) mainCore.onlineResign();
    }
  } catch (e) {}
  online = false;
}
function leaveOnline(mode = 'auto') {
  if (pointerFlushTimer) { clearTimeout(pointerFlushTimer); pointerFlushTimer = null; }
  pendingPointer = null;
  hostSyncScheduled = false;
  hostSentLog = [];
  const oldRoomId = fbState.roomId;
  fbState.roomId = null;
  fbState.hostUid = null;
  fbState.creating = false;
  fbState.joining = false;
  fbState.error = null;
  fbState.players = {};
  fbState.cursors = {};
  fbState.roomState = null;
  fbState.roomSettings = Object.assign({}, DEFAULT_ROOM_SETTINGS);
  fbState.soloIdle = false;
  fbState.takingOver = false;
  fbState.knownPlayerUids = new Set();
  fbState.kickedUids = new Set();
  fbState.promptedJoinUids = new Set();
  clearRemoteCursors();
  uidToPeerId.clear();
  peerIdToUid.clear();
  peerNames.clear();
  peerSlots.clear();
  if (mainCore) mainCore.onlineLeave();
  if (netApi && oldRoomId) netApi.leaveRoom(mode).catch(() => {});
  S.chat = [];
  online = false; token++; ost = null; S.roomPre = null; S.roomDecided = null; lastBeginSeq = 0; chatSeen = 0; lastFlash = '0|'; closeSheet();
  syncPublicRoomsWatch();
}
async function startOnlinePlay(handle) {
  pendSnd = null;
  online = true; token++; sel = null; prevView = null; view = null; drawnView = null; mode = 'online'; h = handle;
  { const p = $('#result'); if (p) p.hidden = true; }
  cur = gInfo(ost.gameId) || cur; pcfg = cfg(cur.id);
  S.setup = { id: cur.id, online: true };
  const v0 = JSON.parse(mainCore.viewJson(h, 0));
  view = v0;
  mySeat = v0.mine >= 0 ? v0.mine : 0;
  enterPlay();
}

// ---------------------------------------------------------------- 部屋の変化
function onlineChanged() {
  if (!mainCore) return;
  const nextOst = JSON.parse(mainCore.onlineState());
  if (!fbState.roomId && (!nextOst || nextOst.role === 'none')) {
    ost = null;
    if (/^(room|menu|records|settings)$/.test(S.screen) && !$('#sheetwrap')) render();
    return;
  }
  ost = nextOst;
  if (ost.closed) { const msg = ost.closed; leaveOnline('skip'); S.screen = 'room'; render(); return toast({ w: 'お知らせ', t: msg }); }
  if (ost.flash !== lastFlash) {
    lastFlash = ost.flash; const t = ost.flash.slice(ost.flash.indexOf('|') + 1);
    if (t) { if (/全員が了承/.test(t)) cut({ text: '待った', tone: 'felt', ms: 1200 }); else toast({ w: 'お知らせ', t }); }
  }
  const nChat = (ost.chat || []).length;
  if (nChat > chatSeen) {
    const startIdx = chatSeen;
    chatSeen = nChat;
    let unreadAdd = 0;
    for (let ci = startIdx; ci < nChat; ci++) {
      const m = ost.chat[ci];
      if (!m) continue;
      if (m.kind === 2) {
        if (ci === nChat - 1) toast({ w: 'お知らせ', t: m.body, chat: true });
      } else if (isChatEnabled()) {
        if (m.slot !== ost.mySlot) {
          unreadAdd++;
          if (ci === nChat - 1) {
            sfxPop(false);
            const si = stampIdx(m);
            toast({ w: m.name, t: si < 0 ? m.body : null, s: si >= 0 ? si : null, chat: true });
          }
        }
      }
    }
    if (unreadAdd > 0 && S.screen === 'play' && typeof isMob === 'function' && isMob() && !S.chatOpen) {
      S.chatUnread = (S.chatUnread || 0) + unreadAdd;
      if (typeof syncChatFab === 'function') syncChatFab();
    }
  }
  const ask = ost.undoAsk;
  if (ask && !ask.mine && askShown !== ask.id) { askShown = ask.id; showAsk(ask); }
  else if (!ask && askShown >= 0) { askShown = -1; const a = $('#askcard'); if (a) a.remove(); }
  if (ost.beginSeq !== lastBeginSeq) { lastBeginSeq = ost.beginSeq; if (ost.match >= 0) return startOnlinePlay(ost.match); }
  if (S.screen === 'play' && online && ost.phase === 'LOBBY') { fbState.soloIdle = false; token++; online = false; h = -1; view = null; S.screen = 'menu'; render(); return; }
  if (S.screen === 'play' && online) {
    if (view && view.outcome && $('#result') && !$('#result').hidden) { showResult(); return refreshChat(); }
    // autoCpu が ON になったタイミングやメンバー状態更新でも手番駆動する
    if (onlineBusy) { onlinePending = true; return refreshChat(); }
    onlineBusy = true;
    (async () => { try { do { onlinePending = false; await refresh(); } while (onlinePending && online && S.screen === 'play'); } finally { onlineBusy = false; } })();
    return refreshChat();
  }
  if (S.screen === 'room' || (roomActive() && /^(menu|records|settings)$/.test(S.screen)) || (S.screen === 'setup' && S.setup.online)) {
    const rn = $('#readyNames');
    if (rn && ost) {
      const exSlots = new Set(spectatorSlots());
      rn.textContent = '準備ができた人: ' + ost.members.filter((m) => !exSlots.has(m.slot) && (m.slot === ost.mySlot || ost.ready.includes(m.slot))).map((m) => m.name).join('・');
    }
    if (!$('#specSelectSheet') && !$('#pubroomDetail')) keepInputs(render);
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
  if (typeof syncChatFab === 'function') syncChatFab();
  const box = document.querySelector('.side .chat, #chatpop .chat'); if (!box) return;
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
const isMobileCursorOff = () => (typeof isMob === 'function' && isMob()) || (typeof isTouchDevice === 'function' && isTouchDevice()) || (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
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
  if (!netApi || !fbState.roomId || !pt || isMobileCursorOff()) return;
  const sig = `${pt.x.toFixed(3)}:${pt.y.toFixed(3)}:${pt.active ? 1 : 0}:${ost ? ost.mySlot : 0}:${online ? mySeat : -1}`;
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
  if (!netApi || !fbState.roomId || isMobileCursorOff()) return;
  if (online && S.screen === 'play' && cur && NO_CURSOR.has(cur.id)) return;
  const pt = computeNormalizedPointer(clientX, clientY, active);
  if (!pt) return;
  pendingPointer = pt;
  const elapsed = performance.now() - lastPointerSentAt;
  if (elapsed >= POINTER_INTERVAL_MS) {
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
  if (isMobileCursorOff()) return;
  lastClientPos = { x: e.clientX, y: e.clientY };
  queuePointerSend(e.clientX, e.clientY, true);
}, { passive: true });
document.addEventListener('mouseleave', () => {
  if (isMobileCursorOff()) return;
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
}, { passive: true });
window.addEventListener('blur', () => {
  if (isMobileCursorOff()) return;
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
});

// タッチ操作 (モバイルプレイヤーはカーソルを送信・表示しない)
document.addEventListener('touchstart', (e) => {
  if (isMobileCursorOff()) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  lastClientPos = { x: t.clientX, y: t.clientY };
  queuePointerSend(t.clientX, t.clientY, true);
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (isMobileCursorOff()) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  lastClientPos = { x: t.clientX, y: t.clientY };
  queuePointerSend(t.clientX, t.clientY, true);
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (isMobileCursorOff()) return;
  const t = (e.changedTouches && e.changedTouches[0]) || lastClientPos;
  queuePointerSend(t.clientX ?? lastClientPos.x, t.clientY ?? lastClientPos.y, false);
}, { passive: true });
document.addEventListener('touchcancel', () => {
  if (isMobileCursorOff()) return;
  queuePointerSend(lastClientPos.x, lastClientPos.y, false);
}, { passive: true });

// 受信側の補間アニメーション管理
const remoteCursors = new Map(); // uid -> { curX, curY, tx, ty, active, slot, seat, name, updatedAt }
let cursorAnimFrame = null;

function updateRemoteTargets(cursorsObj) {
  if (isMobileCursorOff()) { clearRemoteCursors(); return; }
  const myUid = netApi ? netApi.uid : null;
  const seen = new Set();
  for (const [uid, c] of Object.entries(cursorsObj || {})) {
    if (!c || c.mobile || uid === myUid) continue;
    const x = typeof c.x === 'number' ? Math.max(0, Math.min(1, c.x)) : 0.5;
    const y = typeof c.y === 'number' ? Math.max(0, Math.min(1, c.y)) : 0.5;
    seen.add(uid);
    const existing = remoteCursors.get(uid);
    if (existing) {
      if (existing.tx !== x || existing.ty !== y) {
        existing.fromX = existing.curX; existing.fromY = existing.curY;
        existing.startedAt = performance.now();
        existing.tx = x; existing.ty = y;
      }
      existing.active = c.active !== false;
      existing.slot = typeof c.slot === 'number' ? c.slot : existing.slot;
      existing.seat = typeof c.seat === 'number' ? c.seat : existing.seat;
      existing.name = c.name || existing.name;
      existing.updatedAt = performance.now();
    } else {
      remoteCursors.set(uid, {
        uid,
        fromX: x, fromY: y, startedAt: performance.now(),
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
  if (isMobileCursorOff()) return null;
  for (const c of remoteCursors.values()) {
    if (c.seat === seat && c.active && performance.now() - c.updatedAt < 5000) return c;
  }
  return null;
};

function startCursorLoop() {
  if (cursorAnimFrame) return;
  const step = () => {
    cursorAnimFrame = null;
    if (!fbState.roomId || !remoteCursors.size || isMobileCursorOff()) {
      document.querySelectorAll('.rcur.live').forEach((e) => e.remove());
      return;
    }
    if (S.screen !== 'play' || $('#playsettings') || !cursorOn() || (cur && NO_CURSOR.has(cur.id))) {
      document.querySelectorAll('.rcur.live').forEach(e => e.remove());
      cursorAnimFrame = requestAnimationFrame(step); return;
    }
    const hostEl = document.body;
    const box = getViewportBox();
    if (!hostEl || !box || box.width <= 0 || box.height <= 0) return;
    const hostRect = {left:0, top:0};
    for (const [uid, c] of remoteCursors.entries()) {
      // 100ms updates are spread over 120ms; never depend on display refresh rate.
      const progress = Math.min(1, (performance.now() - c.startedAt) / 120);
      c.curX = c.fromX + (c.tx - c.fromX) * progress;
      c.curY = c.fromY + (c.ty - c.fromY) * progress;
      let rx = c.curX, ry = c.curY;
      if (online && S.screen === 'play' && curFlip(mySeat)) {
        rx = 1 - rx;
        ry = 1 - ry;
      }
      const id = 'rc_' + uid;
      let el = document.getElementById(id);
      const member = fbState.players[uid];
      const slot = member && Number.isInteger(member.slot) ? member.slot : c.slot;
      const color = SEAT_COLORS[((slot || 0) % 6 + 6) % 6];
      if (!el) {
        hostEl.insertAdjacentHTML('beforeend', rcurHtml(id, c.name || 'プレイヤー', color, true));
        el = document.getElementById(id);
        if (el) el.classList.add('live');
      }
      if (el) {
        el.style.setProperty('--cc', color);
        el.querySelector('svg path').setAttribute('fill', color);
        const px = (box.left - hostRect.left) + rx * box.width;
        const py = (box.top - hostRect.top) + ry * box.height;
        el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
        // タッチ操作で指を離した際(active: false)は半透明(待機表示)にする
        el.style.opacity = c.active ? '1' : '0.38';
        el.classList.toggle('idle', !c.active);
      }
    }
    cursorAnimFrame = requestAnimationFrame(step);
  };
  cursorAnimFrame = requestAnimationFrame(step);
}

const roomActive = () => !!(fbState.roomId && ost && ost.role !== 'none');
const roomChoosing = () => roomActive() && ost.phase === 'LOBBY';
function playerBadge(p) {
 const color=SEAT_COLORS[((p.slot||0)%6+6)%6];
 const displayName=ost?.members?.find(m=>m.slot===p.slot)?.name||p.name||'プレイヤー';
 return `<span class="wish-player" style="--player-color:${color}"><span class="wish-avatar">${Number.isInteger(p.avatar)&&AV[p.avatar]?avSvg(p.avatar):esc(displayName[0])}</span>${esc(displayName)}</span>`;
}
function gameWishes(id) {
 if (!roomChoosing()) return '';
 const players=Object.values(fbState.players).filter(p=>p.choice===id);
 const others=players.filter(p=>p.uid!==netApi?.uid);
 return players.length?`<span class="game-wishes">${others.map((p,i)=>`<span class="wish-frame" style="--player-color:${SEAT_COLORS[((p.slot||0)%6+6)%6]};--wish-inset:${i*4}px"></span>`).join('')}<span class="wish-labels">${players.map(playerBadge).join('')}</span></span>`:'';
}
function roomSummary() {
 if (!roomActive()) return '';
 const hostSlot = hostSlotOfRoom();
 const myUid = netApi ? netApi.uid : null;
 const host = isHostRoom();
 const membersHtml = ost.members.map((m) => {
  const p = Object.values(fbState.players || {}).find((x) => x && x.slot === m.slot);
  const uid = p ? p.uid : null;
  const isH = m.slot === hostSlot;
  const spec = isSlotSpectating(m.slot);
  const cpu = isSlotAutoCpu(m.slot);
  const badges = (isH ? '<small class="badge host">ホスト</small>' : '') +
   (spec ? '<small class="badge spec">観戦</small>' : '') +
   (cpu ? '<small class="badge cpu">CPU操作中</small>' : '');
  const inner = `${playerBadge({ ...m, avatar: p ? p.avatar : null })}${badges}`;
  if (host && uid && uid !== myUid) {
   return `<button type="button" class="room-member-btn" data-pmenu="${esc(uid)}" title="ホスト変更・キック">${inner}</button>`;
  }
  return `<div>${inner}</div>`;
 }).join('');
 const leaveTxt = host ? (ost.members.length > 1 ? '部屋を出る / 解散' : '部屋を解散する') : '部屋を出る';
 return `<section class="room-summary"><h4>ルームコード</h4><b class="room-code">${esc(fbState.roomId)}</b><button class="btn" data-copy="${esc(fbState.roomId)}">${ic('copy')}コピー</button><div class="room-members">${membersHtml}</div><button class="btn" data-leave>${leaveTxt}</button></section>`;
}
function roomHowto() {
 return `<details class="room-howto" open><summary>遊び方</summary><p>「部屋を作る」で発行された4桁のルームコードを相手に伝えてください。参加する人はルームコードを入力します。</p><p>人が集まるまではホスト1人でもゲームを始められます。参加メンバーをクリックすると「ホストを変更」「キック」が行えます。</p></details>`;
}
function chooseWish(id) {
 if (!roomChoosing() || !gInfo(id)) return;
 const mine=fbState.players[netApi.uid];if(mine)mine.choice=id;
 netApi.chooseGame(id,Number.isInteger(S.set.av)?S.set.av:null).catch(e=>toast({w:'お知らせ',t:'希望ゲームを共有できませんでした'}));
}
function onlineMenuDetail() {
 const g=gInfo(S.sel);
 const soloRoom = isSoloInRoom();
 const act = activeMembers();
 const actCount = act.length;
 const specCount = Math.max(0, ost.members.length - actCount);
 const mySpec = mySpectatingOn();
 const isSpectator = fbState.roomState && Array.isArray(fbState.roomState.seatSlots) && !fbState.roomState.seatSlots.includes(ost.mySlot);
 let hint = '';
 if (isHostRoom()) {
  if (soloRoom) hint = '参加者を待っている間、1人で遊べます（シングルプレイと同じ設定）';
  else if (actCount === 0) hint = '全員が観戦モードのため開始できません';
  else if (g && actCount > range(g.players)[1]) hint = `「${g.name}」の最大人数（${range(g.players)[1]}人）より部屋の人数（${actCount}人）が多いため、スタート時に観戦者を選びます`;
  else hint = specCount > 0 ? `ゲームを選んで開始できます（対局 ${actCount}人・観戦 ${specCount}人）` : 'ゲームを選んで対戦プレイへ進めます';
 } else {
  hint = specCount > 0 ? `遊びたいゲームを選べます（対局 ${actCount}人・観戦 ${specCount}人）。開始はホストが行います` : '遊びたいゲームを選べます。設定と開始はホストが行います';
 }
 const canStart = isHostRoom() && g && playable(g.id) && (soloRoom ? true : actCount >= 1);
 const startLabel = soloRoom ? '1人で遊ぶ' : '対戦プレイ';
 const specToggle = roomChoosing() ? `<div style="margin:6px 0 4px"><button class="btn ${mySpec ? 'gold' : ''}" data-toggle-spec style="width:100%;height:34px;font-size:12px">${mySpec ? '観戦モード: ON（クリックで参加に戻る）' : '観戦モードにする'}</button></div>` : '';
 const mobHd = `<div class="detail-mobhd"><span class="detail-handle" aria-hidden="true"></span><button type="button" class="btn" data-detailclose aria-label="閉じる">✕ 閉じる</button></div>`;
 const openCls = S.mobDetail ? ' open' : '';
 return `<aside class="detail online-detail${openCls}">${mobHd}<div class="scroll">${g?`<div class="hero"><span class="art">${artOf(g.id)}</span><div><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p><span class="tag">${esc(g.players)}</span></div></div>`:'<div class="empty">ゲームを選んでください</div>'}<p>${hint}</p>${specToggle}${roomHowto()}</div>${chatBox()}<div class="foot"><button class="btn" data-rule="${g?g.id:''}" ${g?'':'disabled'}>${ic('book')}ルール</button>${roomChoosing()?`<button class="btn primary" data-next ${canStart?'':'disabled'}>${startLabel}</button>`:`<button class="btn primary" data-oreturn>${isSpectator ? '対局を観戦する' : '対局に戻る'}</button>`}</div></aside>`;
}
