/* 状態と保存。設定・途中の対局・成績・アイコンは、この端末のアプリのデータとして保存する(WebView2 の保存場所。インストールし直しても残る) */
'use strict';
const STORE_KEY = 'asobi30pc';
const store = (() => {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { data = {}; }
  const flush = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} };
  return {
    get(k, d) { return k in data ? data[k] : d; },
    set(k, v) { data[k] = v; flush(); },
    del(k) { delete data[k]; flush(); },
    all() { return data; },
    reset(keep) { const k = {}; (keep || []).forEach((x) => { if (x in data) k[x] = data[x]; }); data = k; flush(); },
  };
})();

const DEFAULT_SET = {
  // 対局
  hints: true, caps: true, pre: true, cpuLv: '中級', cpuLen: 'ふつう', cursor: '全員', cutin: true, speed: 'ふつう',
  // 表示
  win: 'ウィンドウ', res: '1366×768', scale: '100%', look: '標準', reduce: false, notify: true,
  // サウンド
  master: 100, sound: true, sfxVol: 80, hover: true, chatSnd: true, bgm: false, bgSound: true,
  // 操作
  drag: '両方',
  // プロフィール
  name: '', av: null, photo: null,
};
const S = {
  screen: 'menu', theme: store.get('theme', 'auto'), filter: 'すべて', sel: null,
  setup: { id: null, online: false }, stOpen: false, scat: 'game', modal: null,
  vol: store.get('vol', 0.6), mute: false, off: store.get('bgmOff', []),
  set: Object.assign({}, DEFAULT_SET, store.get('set', {})),
  chat: [], keys: Object.assign({ back: 'Escape', full: 'F11', undo: 'Ctrl+Z', chat: 'Enter', bgm: 'Ctrl+M', mute: 'Ctrl+Shift+M' }, store.get('keys', {})),
};
// 2026-11-22: 「バックグラウンドでも音を鳴らす」を初期設定でオンにした。前の初期設定(オフ)のまま保存されている人も、1 回だけオンにする(その後は本人の選んだ通り)
if (!store.get('bgSoundOn1', false)) { S.set.bgSound = true; store.set('bgSoundOn1', true); try { const saved = store.get('set', null); if (saved) store.set('set', Object.assign(saved, { bgSound: true })); } catch (e) {} }
const saveSet = () => { store.set('set', S.set); store.set('theme', S.theme); store.set('vol', S.vol); store.set('bgmOff', S.off); store.set('keys', S.keys); };
