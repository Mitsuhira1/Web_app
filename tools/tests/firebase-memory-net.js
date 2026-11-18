// Test-only Firebase API substitute. Never loaded by the shipped application.
const DEFAULT_SETTINGS = { isPublic: false, chatEnabled: true, maxPlayers: 6, locked: false, vibe: 'ボチボチ' };
const normalizeSettings = (raw) => {
 const s = raw || {};
 return {
  isPublic: !!s.isPublic,
  chatEnabled: s.chatEnabled !== false,
  maxPlayers: Math.max(2, Math.min(6, Number(s.maxPlayers) || 6)),
  locked: !!s.locked,
  vibe: ['ガチ', 'ボチボチ', 'まったり'].includes(s.vibe) ? s.vibe : 'ボチボチ',
 };
};

export async function createNet() {
 const uid = crypto.randomUUID(), bus = new BroadcastChannel('firebase-regression');
 let roomId = null, role = null, cb = {};
 const pubWatchers = new Set();
 const read = (key) => JSON.parse(localStorage.getItem('test-' + key) || 'null');
 const write = (key, value) => localStorage.setItem('test-' + key, JSON.stringify(value));
 const clearAll = () => {
  for (const k of ['room', 'hostUid', 'players', 'state', 'settings', 'kicked']) localStorage.removeItem('test-' + k);
  for (let i = localStorage.length - 1; i >= 0; i--) {
   const key = localStorage.key(i);
   if (key && key.startsWith('test-cursor-')) localStorage.removeItem(key);
  }
 };
 const buildPublicList = () => {
  const rid = read('room');
  if (!rid) return [];
  const settings = normalizeSettings(read('settings'));
  if (!settings.isPublic) return [];
  const players = Object.values(read('players') || {}).filter((p) => p && p.uid);
  if (!players.length) return [];
  const st = read('state') || {};
  const hUid = read('hostUid');
  const hostP = (hUid && (read('players') || {})[hUid]) || players.find((p) => p.role === 'host') || players[0];
  return [{
   roomId: String(rid),
   playerCount: players.length,
   maxPlayers: settings.maxPlayers,
   phase: st.phase === 'PLAYING' ? 'PLAYING' : 'LOBBY',
   chatEnabled: settings.chatEnabled,
   vibe: settings.vibe,
   locked: settings.locked,
   gameId: st.gameId || 'reversi',
   hostName: (hostP && hostP.name) || 'ホスト',
   createdAt: Date.now(),
  }];
 };
 let playerSig = '', stateSig = '', settingsSig = '', cursorSig = '', hostUidSig = '', pubSig = '';
 const deliver = () => {
  const pubList = buildPublicList();
  const nextPubSig = JSON.stringify(pubList);
  if (nextPubSig !== pubSig) {
   pubSig = nextPubSig;
   for (const fn of pubWatchers) { try { fn(pubList); } catch {} }
  }
  if (!roomId) return;
  if (!read('room')) { roomId = null; role = null; cb.onRoomRemoved?.(); return; }
  const kicked = read('kicked') || {};
  if (kicked[uid]) { const kv = kicked[uid]; roomId = null; role = null; cb.onKicked?.(kv); return; }
  const hUid = read('hostUid');
  if (hUid && hUid !== hostUidSig) { hostUidSig = hUid; cb.onHostUid?.(hUid); }
  const players = read('players') || {}, state = read('state'), settings = normalizeSettings(read('settings')), cursors = {};
  for (let i = 0; i < localStorage.length; i++) {
   const key = localStorage.key(i);
   if (key.startsWith('test-cursor-')) {
    const c = JSON.parse(localStorage.getItem(key));
    if (c) cursors[c.uid] = c;
   }
  }
  const ps = JSON.stringify(players), ss = JSON.stringify(state), sts = JSON.stringify(settings), cs = JSON.stringify(cursors);
  if (ps !== playerSig) { playerSig = ps; cb.onPlayers?.(players); }
  if (ss !== stateSig) { stateSig = ss; cb.onState?.(state); }
  if (sts !== settingsSig) { settingsSig = sts; cb.onSettings?.(settings); }
  if (cs !== cursorSig) { cursorSig = cs; cb.onCursors?.(cursors); }
 };
 setInterval(deliver, 50);
 const notify = () => { bus.postMessage({ type: 'state' }); queueMicrotask(deliver); };
 bus.onmessage = (e) => { if (e.data.type === 'action') { if (role === 'host') cb.onAction?.(e.data.action); } else deliver(); };
 return {
  get uid() { return uid; },
  get role() { return role; },
  get roomId() { return roomId; },
  async syncDisconnectPolicy() {},
  async createRoom(player, state, callbacks, initialSettings) {
   cb = callbacks || {};
   roomId = '4829'; role = 'host';
   playerSig = ''; stateSig = ''; settingsSig = ''; cursorSig = ''; hostUidSig = '';
   clearAll();
   const settings = normalizeSettings(initialSettings || DEFAULT_SETTINGS);
   write('room', roomId); write('hostUid', uid); write('kicked', {});
   write('settings', settings);
   write('players', { [uid]: { ...player, uid, slot: 0, role: 'host', spectating: false, autoCpu: false, joinedAt: Date.now() } });
   write('state', state);
   notify();
   return { roomId, uid, slot: 0, settings };
  },
  async joinRoom(code, player, callbacks) {
   if (!read('room') || String(code) !== String(read('room'))) throw new Error(`部屋「${code}」が見つかりません`);
   const settings = normalizeSettings(read('settings'));
   const players = read('players') || {};
   const existing = players[uid];
   const used = new Set(Object.values(players).map((p) => (p && typeof p.slot === 'number' ? p.slot : -1)));
   if (!existing && settings.locked) throw new Error('この部屋はロックされているため参加できません');
   if (!existing && used.size >= settings.maxPlayers) throw new Error(`部屋が満員です(最大${settings.maxPlayers}人)`);
   cb = callbacks || {};
   roomId = String(code); role = 'guest';
   playerSig = ''; stateSig = ''; settingsSig = ''; cursorSig = ''; hostUidSig = '';
   const kicked = read('kicked') || {}; delete kicked[uid]; write('kicked', kicked);
   let slot = existing && typeof existing.slot === 'number' ? existing.slot : 1;
   if (!existing) { for (let s = 0; s < 6; s++) { if (!used.has(s)) { slot = s; break; } } }
   players[uid] = { ...player, uid, slot, role: 'guest', spectating: false, autoCpu: false, joinedAt: Date.now() };
   write('players', players);
   notify();
   return { roomId, uid, slot, hostUid: read('hostUid'), settings };
  },
  async listPublicRooms() {
   return buildPublicList();
  },
  watchPublicRooms(callback) {
   if (!callback) return () => {};
   pubWatchers.add(callback);
   queueMicrotask(() => { try { callback(buildPublicList()); } catch {} });
   return () => { pubWatchers.delete(callback); };
  },
  async updateRoomSettings(partial) {
   if (role !== 'host' || !partial) return;
   const next = normalizeSettings(Object.assign({}, read('settings') || DEFAULT_SETTINGS, partial));
   write('settings', next);
   notify();
  },
  async setPlayersSpectating(spectatingByUid) {
   if (role !== 'host' || !spectatingByUid) return;
   const players = read('players') || {};
   for (const [tUid, val] of Object.entries(spectatingByUid)) {
    if (players[tUid]) players[tUid] = { ...players[tUid], spectating: !!val };
   }
   write('players', players);
   notify();
  },
  async chooseGame(choice, avatar) { const players = read('players') || {}; if (players[uid]) { players[uid] = { ...players[uid], choice, avatar }; write('players', players); notify(); } },
  async setPlayerFlags(partial) { const players = read('players') || {}; if (players[uid] && partial) { players[uid] = { ...players[uid], ...partial }; write('players', players); notify(); } },
  async transferHost(targetUid) {
   if (role !== 'host' || !targetUid || targetUid === uid) return;
   const players = read('players') || {};
   if (players[uid]) players[uid] = { ...players[uid], role: 'guest' };
   if (players[targetUid]) players[targetUid] = { ...players[targetUid], role: 'host' };
   role = 'guest'; write('players', players); write('hostUid', targetUid); notify();
  },
  async assumeHost() {
   const players = read('players') || {};
   if (players[uid]) players[uid] = { ...players[uid], role: 'host' };
   role = 'host'; write('players', players); write('hostUid', uid); notify();
  },
  async kickPlayer(targetUid) {
   if (role !== 'host' || !targetUid || targetUid === uid) return;
   const players = read('players') || {}; delete players[targetUid];
   const kicked = read('kicked') || {}; kicked[targetUid] = Date.now();
   localStorage.removeItem('test-cursor-' + targetUid);
   write('kicked', kicked); write('players', players); notify();
  },
  async writeState(state) { write('state', Object.assign({}, read('state') || {}, state)); notify(); },
  async writeCursor(c) { write('cursor-' + uid, { ...c, uid }); notify(); },
  async sendAction(a) { bus.postMessage({ type: 'action', action: { ...a, uid } }); },
  async leaveRoom(mode = 'leave') {
   const resolved = mode === true ? 'skip' : mode === false ? (role === 'host' ? 'dissolve' : 'leave') : (mode || 'leave');
   const wasRole = role; roomId = null; role = null;
   if (resolved === 'skip') return;
   if (resolved === 'dissolve' || (resolved === 'auto' && wasRole === 'host')) { clearAll(); }
   else { const players = read('players') || {}; delete players[uid]; write('players', players); localStorage.removeItem('test-cursor-' + uid); }
   notify();
  },
  ensureAuth: async () => uid
 };
}
