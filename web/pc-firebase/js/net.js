// Firebase Realtime Database 通信モジュール(ES Modules・ビルドツール不要)
// Webブラウザ版(GitHub Pages等)・Androidアプリ版・Windows(.exe)版の3環境で共通の JSON 構造で同期する。

// 【Firebase 接続情報】
export const firebaseConfig = (typeof globalThis !== "undefined" && globalThis.FIREBASE_CONFIG) || {
  apiKey: "AIzaSyDbZ5C62b7j7DAUEDsQsKY9yeS33J3OwsI",
  authDomain: "asobi-box.firebaseapp.com",
  databaseURL: "https://asobi-box-default-rtdb.firebaseio.com",
  projectId: "asobi-box",
  storageBucket: "asobi-box.firebasestorage.app",
  messagingSenderId: "877962981660",
  appId: "1:877962981660:web:2ea06de9e197eb179f0ad9"
};

const CDN = "https://www.gstatic.com/firebasejs/11.0.1";
const ROOM_TTL_MS = 3 * 60 * 60 * 1000; // 3時間

export function isConfigPlaceholder(cfg = firebaseConfig) {
  return !cfg || !cfg.apiKey || cfg.apiKey === "YOUR_API_KEY" || String(cfg.apiKey).startsWith("YOUR_");
}

export async function createNet(core, hooks) {
  const notify = (extra) => { try { hooks && hooks.changed && hooks.changed(extra); } catch (e) { console.error(e); } };
  const onError = (msg, code) => { try { hooks && hooks.onError && hooks.onError(msg, code); } catch (e) { console.error(e); } };

  // Local mock mode for automated tests or when globalThis.__ASOBI_FIREBASE_MOCK__ is provided
  if (typeof globalThis !== "undefined" && globalThis.__ASOBI_FIREBASE_MOCK__) {
    return globalThis.__ASOBI_FIREBASE_MOCK__(core, hooks);
  }

  if (isConfigPlaceholder(firebaseConfig)) {
    const msg = "Firebase 接続情報 (firebaseConfig) が未設定です。js/net.js の firebaseConfig に Firebase コンソールから取得した設定を貼り付けてください。";
    console.warn("[Firebase]", msg);
    onError(msg, "config/unconfigured");
  }

  let fbApp, fbAuth, fbDb;
  try {
    [fbApp, fbAuth, fbDb] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-database.js`),
    ]);
  } catch (e) {
    const msg = "Firebase SDK (CDN) の読み込みに失敗しました。インターネット接続を確認してください。";
    console.error("[Firebase]", msg, e);
    onError(msg, "sdk/load-failed");
    throw e;
  }

  const { initializeApp, getApps, getApp } = fbApp;
  const { getAuth, initializeAuth, signInAnonymously, setPersistence, inMemoryPersistence, indexedDBLocalPersistence, browserLocalPersistence } = fbAuth;
  const { getDatabase, ref, get, set, update, remove, push, onValue, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, serverTimestamp } = fbDb;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth = null;
  let uid = null;
  let authError = null;

  const isFileProtocol = typeof location !== "undefined" && (location.protocol === "file:" || location.origin === "null");

  async function ensureAuth() {
    if (uid) return uid;
    try {
      if (!auth) {
        if (isFileProtocol) {
          try {
            auth = initializeAuth(app, { persistence: inMemoryPersistence });
          } catch {
            auth = getAuth(app);
            await setPersistence(auth, inMemoryPersistence);
          }
        } else {
          try {
            auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] });
          } catch {
            auth = getAuth(app);
          }
        }
      }
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
        return uid;
      }
      try {
        const cred = await signInAnonymously(auth);
        uid = cred.user.uid;
        authError = null;
        return uid;
      } catch (err) {
        // file:// や WebView 等でのストレージ制限エラー時は inMemoryPersistence にフォールバックして再試行
        const code = (err && err.code) || "";
        if (code !== "auth/unauthorized-domain" && code !== "auth/operation-not-allowed" && code !== "auth/invalid-api-key") {
          try {
            await setPersistence(auth, inMemoryPersistence);
            const cred2 = await signInAnonymously(auth);
            uid = cred2.user.uid;
            authError = null;
            return uid;
          } catch (err2) {
            throw err2;
          }
        }
        throw err;
      }
    } catch (err) {
      const code = (err && err.code) || "";
      const host = (typeof location !== "undefined" && (location.hostname || location.origin)) || "(ローカル)";
      let msg = `Firebase 認証エラー (${code || (err && err.message) || "不明"})`;
      if (code === "auth/unauthorized-domain") {
        msg = `【承認済みドメイン未登録エラー (auth/unauthorized-domain)】\n現在のドメイン「${host}」が Firebase Authentication で許可されていません。\nFirebase コンソール →「Authentication」→「設定 (Settings)」→「承認済みドメイン (Authorized domains)」に「${host}」を追加してください。`;
      } else if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
        msg = `【匿名ログイン無効エラー (${code})】\nFirebase コンソール →「Authentication」→「ログイン方法 (Sign-in method)」で「匿名 (Anonymous)」を有効にしてください。`;
      } else if (code.includes("api-key") || isConfigPlaceholder(firebaseConfig)) {
        msg = "Firebase 接続情報 (firebaseConfig) が正しく設定されていません。js/net.js の firebaseConfig を確認してください。";
      }
      authError = msg;
      console.error("[Firebase Auth]", msg, err);
      onError(msg, code);
      throw err;
    }
  }

  let db = null;
  function getDb() {
    if (!db) db = getDatabase(app);
    return db;
  }

  // 起動時に signInAnonymously で自動ログインを開始
  ensureAuth().then(() => notify({ type: "auth" })).catch(() => {});

  // 3時間以上経過した古い部屋を自動削除 (Cloud Functions 不使用)
  async function cleanupOldRooms() {
    const d = getDb();
    const roomsRef = ref(d, "rooms");
    const snap = await get(roomsRef);
    const all = snap.exists() ? (snap.val() || {}) : {};
    const now = Date.now();
    const activeIds = new Set();
    const removals = [];
    for (const [id, r] of Object.entries(all)) {
      const createdAt = r && typeof r.createdAt === "number" ? r.createdAt : (r && r.state && typeof r.state.createdAt === "number" ? r.state.createdAt : 0);
      if (createdAt > 0 && now - createdAt >= ROOM_TTL_MS) {
        removals.push(remove(ref(d, `rooms/${id}`)).catch(() => {}));
      } else {
        activeIds.add(id);
      }
    }
    if (removals.length) await Promise.all(removals);
    return activeIds;
  }

  let currentRoomId = null;
  let currentRole = "none";
  let unsubs = [];
  let actionUnsub = null;
  let roomCallbacks = null;
  let discHandles = [];

  function stopActionWatch() {
    if (actionUnsub) {
      try { actionUnsub(); } catch {}
      actionUnsub = null;
    }
  }

  function startActionWatch(roomId) {
    stopActionWatch();
    if (!roomId || !roomCallbacks || !roomCallbacks.onAction) return;
    const d = getDb();
    actionUnsub = onChildAdded(ref(d, `rooms/${roomId}/actions`), (snap) => {
      const val = snap.val();
      const key = snap.key;
      remove(ref(d, `rooms/${roomId}/actions/${key}`)).catch(() => {});
      if (val && currentRole === "host") roomCallbacks.onAction(val, key);
    });
  }

  async function clearListeners() {
    stopActionWatch();
    roomCallbacks = null;
    for (const u of unsubs) { try { u(); } catch {} }
    unsubs = [];
    for (const d of discHandles) { try { await d.cancel(); } catch {} }
    discHandles = [];
  }

  async function syncDisconnectPolicy(playerCount = 1) {
    for (const d of discHandles) { try { await d.cancel(); } catch {} }
    discHandles = [];
    if (!currentRoomId || !uid) return;
    const d = getDb();
    try {
      if (currentRole === "host" && playerCount <= 1) {
        const dcRoom = onDisconnect(ref(d, `rooms/${currentRoomId}`));
        await dcRoom.remove();
        discHandles.push(dcRoom);
      } else {
        const dcP = onDisconnect(ref(d, `rooms/${currentRoomId}/players/${uid}`));
        const dcC = onDisconnect(ref(d, `rooms/${currentRoomId}/cursors/${uid}`));
        await Promise.all([dcP.remove(), dcC.remove()]);
        discHandles.push(dcP, dcC);
      }
    } catch (e) {
      console.warn("[Firebase] syncDisconnectPolicy error:", e);
    }
  }

  const DEFAULT_ROOM_SETTINGS = {
    isPublic: false,
    chatEnabled: true,
    maxPlayers: 6,
    locked: false,
    vibe: "ボチボチ",
  };

  function normalizeRoomSettings(raw) {
    const s = raw || {};
    const maxPlayers = Math.max(2, Math.min(6, Number(s.maxPlayers) || 6));
    const vibe = ["ガチ", "ボチボチ", "まったり"].includes(s.vibe) ? s.vibe : "ボチボチ";
    return {
      isPublic: !!s.isPublic,
      chatEnabled: s.chatEnabled !== false,
      maxPlayers,
      locked: !!s.locked,
      vibe,
    };
  }

  function extractPublicRooms(all) {
    const now = Date.now();
    const list = [];
    for (const [id, r] of Object.entries(all || {})) {
      if (!r || typeof r !== "object") continue;
      const createdAt = typeof r.createdAt === "number" ? r.createdAt : 0;
      if (createdAt > 0 && now - createdAt >= ROOM_TTL_MS) continue;
      const settings = normalizeRoomSettings(r.settings);
      if (!settings.isPublic) continue;
      const players = Object.values(r.players || {}).filter((p) => p && p.uid);
      if (!players.length) continue;
      const st = r.state || {};
      const hostP = (r.hostUid && r.players && r.players[r.hostUid]) || players.find((p) => p.role === "host") || players[0];
      list.push({
        roomId: String(r.roomId || id),
        playerCount: players.length,
        maxPlayers: settings.maxPlayers,
        phase: st.phase === "PLAYING" ? "PLAYING" : "LOBBY",
        chatEnabled: settings.chatEnabled,
        vibe: settings.vibe,
        locked: settings.locked,
        gameId: st.gameId || "reversi",
        hostName: (hostP && hostP.name) || "ホスト",
        createdAt,
      });
    }
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }

  function watchRoom(roomId, callbacks) {
    const d = getDb();
    roomCallbacks = callbacks || {};
    const uPlayers = onValue(ref(d, `rooms/${roomId}/players`), (snap) => {
      callbacks.onPlayers && callbacks.onPlayers(snap.val() || {});
    });
    const uState = onValue(ref(d, `rooms/${roomId}/state`), (snap) => {
      callbacks.onState && callbacks.onState(snap.val());
    });
    const uSettings = onValue(ref(d, `rooms/${roomId}/settings`), (snap) => {
      callbacks.onSettings && callbacks.onSettings(normalizeRoomSettings(snap.val()));
    });
    const uCursors = onValue(ref(d, `rooms/${roomId}/cursors`), (snap) => {
      callbacks.onCursors && callbacks.onCursors(snap.val() || {});
    });
    const uRoot = onValue(ref(d, `rooms/${roomId}/hostUid`), (snap) => {
      if (!snap.exists()) callbacks.onRoomRemoved && callbacks.onRoomRemoved();
      else callbacks.onHostUid && callbacks.onHostUid(snap.val());
    });
    unsubs.push(uPlayers, uState, uSettings, uCursors, uRoot);
    if (uid) {
      const uKicked = onValue(ref(d, `rooms/${roomId}/kicked/${uid}`), (snap) => {
        if (snap.exists()) callbacks.onKicked && callbacks.onKicked(snap.val());
      });
      unsubs.push(uKicked);
    }
    if (currentRole === "host" && callbacks.onAction) {
      startActionWatch(roomId);
    }
  }

  return {
    get uid() { return uid; },
    get authError() { return authError; },
    get roomId() { return currentRoomId; },
    get role() { return currentRole; },
    ensureAuth,
    syncDisconnectPolicy,

    // ホストとして4桁の部屋を作成
    async createRoom(playerInfo, initialState, callbacks, initialSettings) {
      await clearListeners();
      const myUid = await ensureAuth();
      const d = getDb();
      const activeIds = await cleanupOldRooms();
      let roomId = null;
      for (let i = 0; i < 60; i++) {
        const cand = String(Math.floor(1000 + Math.random() * 9000));
        if (!activeIds.has(cand)) { roomId = cand; break; }
      }
      if (!roomId) throw new Error("空いているルームコードが見つかりませんでした");

      const settings = normalizeRoomSettings(initialSettings || DEFAULT_ROOM_SETTINGS);
      const roomRef = ref(d, `rooms/${roomId}`);
      const nowTs = serverTimestamp();
      await set(roomRef, {
        roomId,
        hostUid: myUid,
        createdAt: nowTs,
        settings,
        players: {
          [myUid]: {
            uid: myUid,
            name: playerInfo.name || "プレイヤー",
            slot: 0,
            role: "host",
            proto: playerInfo.proto || 2,
            rules: playerInfo.rules || "",
            avatar: Number.isInteger(playerInfo.avatar) ? playerInfo.avatar : null,
            spectating: false,
            autoCpu: false,
            joinedAt: nowTs,
          }
        },
        state: Object.assign({
          phase: "LOBBY",
          gameId: "reversi",
          options: "",
          round: 0,
          updatedAt: nowTs,
        }, initialState || {})
      });

      currentRoomId = roomId;
      currentRole = "host";
      await syncDisconnectPolicy(1);
      watchRoom(roomId, callbacks);
      return { roomId, uid: myUid, slot: 0, settings };
    },

    // 4桁の数字を入力して部屋に参加
    async joinRoom(roomIdInput, playerInfo, callbacks) {
      await clearListeners();
      const roomId = String(roomIdInput || "").trim();
      if (!/^\d{4}$/.test(roomId)) throw new Error("4桁の数字を入力してください");
      const myUid = await ensureAuth();
      const d = getDb();
      const roomRef = ref(d, `rooms/${roomId}`);
      const snap = await get(roomRef);
      if (!snap.exists()) throw new Error(`部屋「${roomId}」が見つかりません`);
      const roomVal = snap.val() || {};
      const createdAt = typeof roomVal.createdAt === "number" ? roomVal.createdAt : 0;
      if (createdAt > 0 && Date.now() - createdAt >= ROOM_TTL_MS) {
        await remove(roomRef).catch(() => {});
        throw new Error(`部屋「${roomId}」は有効期限(3時間)が切れています`);
      }
      const settings = normalizeRoomSettings(roomVal.settings);
      const players = roomVal.players || {};
      const existing = players[myUid];
      const usedSlots = new Set(Object.values(players).map((p) => p && typeof p.slot === "number" ? p.slot : -1));
      if (!existing && settings.locked) throw new Error("この部屋はロックされているため参加できません");
      if (!existing && usedSlots.size >= settings.maxPlayers) throw new Error(`部屋が満員です(最大${settings.maxPlayers}人)`);
      let slot = existing && typeof existing.slot === "number" ? existing.slot : 1;
      if (!existing) {
        for (let s = 0; s < 6; s++) { if (!usedSlots.has(s)) { slot = s; break; } }
      }

      const pRef = ref(d, `rooms/${roomId}/players/${myUid}`);
      await remove(ref(d, `rooms/${roomId}/kicked/${myUid}`)).catch(() => {});
      await set(pRef, {
        uid: myUid,
        name: playerInfo.name || "プレイヤー",
        slot,
        role: "guest",
        proto: playerInfo.proto || 2,
        rules: playerInfo.rules || "",
        avatar: Number.isInteger(playerInfo.avatar) ? playerInfo.avatar : null,
        spectating: false,
        autoCpu: false,
        joinedAt: serverTimestamp(),
      });

      currentRoomId = roomId;
      currentRole = "guest";
      await syncDisconnectPolicy(Object.keys(players).length + (existing ? 0 : 1));
      watchRoom(roomId, callbacks);
      return { roomId, uid: myUid, slot, hostUid: roomVal.hostUid || null, settings };
    },

    // 公開ルーム一覧の取得・監視
    async listPublicRooms() {
      await ensureAuth();
      const d = getDb();
      const snap = await get(ref(d, "rooms"));
      return extractPublicRooms(snap.exists() ? snap.val() : {});
    },

    watchPublicRooms(callback) {
      const d = getDb();
      let stopped = false;
      let unsub = null;
      ensureAuth().then(() => {
        if (stopped) return;
        unsub = onValue(ref(d, "rooms"), (snap) => {
          callback && callback(extractPublicRooms(snap.exists() ? snap.val() : {}));
        }, () => {
          callback && callback([]);
        });
      }).catch(() => {});
      return () => {
        stopped = true;
        if (unsub) { try { unsub(); } catch {} unsub = null; }
      };
    },

    // ホストがルーム設定(公開/チャット/最大人数/ロック/雰囲気)を更新
    async updateRoomSettings(partialSettings) {
      if (!currentRoomId || currentRole !== "host" || !partialSettings) return;
      const d = getDb();
      const next = {};
      if ("isPublic" in partialSettings) next.isPublic = !!partialSettings.isPublic;
      if ("chatEnabled" in partialSettings) next.chatEnabled = partialSettings.chatEnabled !== false;
      if ("maxPlayers" in partialSettings) next.maxPlayers = Math.max(2, Math.min(6, Number(partialSettings.maxPlayers) || 6));
      if ("locked" in partialSettings) next.locked = !!partialSettings.locked;
      if ("vibe" in partialSettings) next.vibe = ["ガチ", "ボチボチ", "まったり"].includes(partialSettings.vibe) ? partialSettings.vibe : "ボチボチ";
      if (!Object.keys(next).length) return;
      await update(ref(d, `rooms/${currentRoomId}/settings`), next);
    },

    // ホストが複数プレイヤーの観戦フラグを一括更新
    async setPlayersSpectating(spectatingByUid) {
      if (!currentRoomId || currentRole !== "host" || !spectatingByUid) return;
      const d = getDb();
      const updates = {};
      for (const [targetUid, val] of Object.entries(spectatingByUid)) {
        if (targetUid) updates[`players/${targetUid}/spectating`] = !!val;
      }
      if (Object.keys(updates).length) await update(ref(d, `rooms/${currentRoomId}`), updates);
    },

    // A preference is advisory; only OnlineRoom's host starts/chooses actual play.
    async chooseGame(gameId, avatar) {
      if (!currentRoomId || !uid) return;
      await update(ref(getDb(), `rooms/${currentRoomId}/players/${uid}`), { choice: gameId, avatar });
    },

    // 自分自身のプレイヤー属性(spectating, autoCpu など)を更新
    async setPlayerFlags(partial) {
      if (!currentRoomId || !uid || !partial) return;
      await update(ref(getDb(), `rooms/${currentRoomId}/players/${uid}`), partial);
    },

    // ホスト権限を他プレイヤーに移譲(ルームコードは維持)
    async transferHost(targetUid) {
      if (!currentRoomId || !uid || currentRole !== "host" || !targetUid || targetUid === uid) return;
      const roomId = currentRoomId;
      stopActionWatch();
      currentRole = "guest";
      const d = getDb();
      await update(ref(d, `rooms/${roomId}`), {
        hostUid: targetUid,
        [`players/${uid}/role`]: "guest",
        [`players/${targetUid}/role`]: "host",
      });
      await syncDisconnectPolicy(2);
    },

    // ゲストがホストを引き継ぐ(明示的な移譲受信またはホスト切断時の自動引き継ぎ)
    async assumeHost(playerCount = 1) {
      if (!currentRoomId || !uid) return;
      const roomId = currentRoomId;
      currentRole = "host";
      const d = getDb();
      await update(ref(d, `rooms/${roomId}`), {
        hostUid: uid,
        [`players/${uid}/role`]: "host",
      });
      startActionWatch(roomId);
      await syncDisconnectPolicy(playerCount);
    },

    // ホストが指定プレイヤーをキックする
    async kickPlayer(targetUid) {
      if (!currentRoomId || !uid || currentRole !== "host" || !targetUid || targetUid === uid) return;
      const d = getDb();
      await update(ref(d, `rooms/${currentRoomId}`), {
        [`kicked/${targetUid}`]: serverTimestamp(),
        [`players/${targetUid}`]: null,
        [`cursors/${targetUid}`]: null,
      });
    },

    // ホストが rooms/{roomId}/state を更新
    async writeState(partialState) {
      if (!currentRoomId || currentRole !== "host") return;
      const d = getDb();
      await update(ref(d, `rooms/${currentRoomId}/state`), Object.assign({}, partialState, { updatedAt: serverTimestamp() }));
    },

    // ゲストからホストへ操作イベントを送信
    async sendAction(action) {
      if (!currentRoomId || !uid) return;
      const d = getDb();
      const aRef = push(ref(d, `rooms/${currentRoomId}/actions`));
      await set(aRef, Object.assign({}, action, { uid, at: serverTimestamp() }));
    },

    // ポインター(マウス・タッチ)位置を rooms/{roomId}/cursors/{uid} に送信
    async writeCursor(cursorData) {
      if (!currentRoomId || !uid) return;
      const d = getDb();
      await set(ref(d, `rooms/${currentRoomId}/cursors/${uid}`), Object.assign({}, cursorData, { uid, updatedAt: serverTimestamp() }));
    },

    // (c) 解散・退出ボタンを押した際も不要になった部屋データを削除
    // mode: 'skip' | 'dissolve' | 'leave' (boolean互換: true -> 'skip', false -> role依存)
    async leaveRoom(mode = "leave") {
      const resolved = mode === true ? "skip" : mode === false ? (currentRole === "host" ? "dissolve" : "leave") : (mode || "leave");
      const roomId = currentRoomId;
      const role = currentRole;
      const myUid = uid;
      currentRoomId = null;
      currentRole = "none";
      await clearListeners();
      if (resolved === "skip" || !roomId || !myUid) return;
      const d = getDb();
      try {
        if (resolved === "dissolve" || (resolved === "auto" && role === "host")) {
          await remove(ref(d, `rooms/${roomId}`));
        } else {
          await Promise.all([
            remove(ref(d, `rooms/${roomId}/players/${myUid}`)).catch(() => {}),
            remove(ref(d, `rooms/${roomId}/cursors/${myUid}`)).catch(() => {}),
          ]);
        }
      } catch (e) {
        console.warn("[Firebase] leaveRoom cleanup error:", e);
      }
    }
  };
}
