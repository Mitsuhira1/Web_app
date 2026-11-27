'use strict';
/* ゲームパッドのキーコンフィグ
   - 割り当ての定義・保存(localStorage の store、キー 'padcfg')・設定画面・割り当て待ち受け・ベンダー判別を担う
   - 対局中の実効は js/gamepad.js が PADCFG を参照して行う(共通/ゲーム別とも)
   - キーボード割り当ての実効は、このファイルの keydown リスナが gamepad.js の PADACT 経由で行う
   - パッド割り当てとキーボード割り当ては併せて保持する(assign[scope][key] と kb[scope][key]) */

/* ---------- ボタンの定義(内部ID → 形式ごとの見た目・名前) ---------- */
const PAD_BTNS = {
  south: { xb: { t: 'A', c: '#3DBE4B' }, ps: { t: '×', c: '#4f7ddf' } },
  east: { xb: { t: 'B', c: '#E5484D' }, ps: { t: '○', c: '#e5484d' } },
  west: { xb: { t: 'X', c: '#1B9BD8' }, ps: { t: '□', c: '#e57fb1' } },
  north: { xb: { t: 'Y', c: '#F2C200' }, ps: { t: '△', c: '#3fa34d' } },
  lb: { xb: { t: 'LB' }, ps: { t: 'L1' } }, rb: { xb: { t: 'RB' }, ps: { t: 'R1' } },
  lt: { xb: { t: 'LT' }, ps: { t: 'L2' } }, rt: { xb: { t: 'RT' }, ps: { t: 'R2' } },
  view: { xb: { t: '⧉', small: 1 }, ps: { t: 'Create', small: 1 } },
  menu: { xb: { t: '≡' }, ps: { t: 'Options', small: 1 } },
  dup: { xb: { t: '↑' }, ps: { t: '↑' } }, ddown: { xb: { t: '↓' }, ps: { t: '↓' } },
  dleft: { xb: { t: '←' }, ps: { t: '←' } }, dright: { xb: { t: '→' }, ps: { t: '→' } },
  lstick: { xb: { t: 'LS' }, ps: { t: 'L' } },
  rstick: { xb: { t: 'RS' }, ps: { t: 'R' } },
};
const PAD_FACE = ['south', 'east', 'west', 'north'];
const PAD_DIRS = ['dup', 'ddown', 'dleft', 'dright'];
/* 標準マッピングのボタン番号 → 内部ID */
const PAD_ID_BY_INDEX = ['south', 'east', 'west', 'north', 'lb', 'rb', 'lt', 'rt', 'view', 'menu', 'lstick', 'rstick', 'dup', 'ddown', 'dleft', 'dright'];
const PAD_INDEX = {}; PAD_ID_BY_INDEX.forEach((id, i) => { PAD_INDEX[id] = i; });

function padBtnName(id, fmt) {
  if (PAD_DIRS.includes(id)) return '十字キー（' + { dup: '上', ddown: '下', dleft: '左', dright: '右' }[id] + '）';
  if (id === 'lstick') return fmt === 'ps' ? '左スティック' : '左スティック（LS）';
  if (id === 'rstick') return fmt === 'ps' ? '右スティック' : '右スティック（RS）';
  if (id === 'view') return fmt === 'ps' ? 'Createボタン' : 'Viewボタン';
  if (id === 'menu') return fmt === 'ps' ? 'Optionsボタン' : 'Menuボタン';
  return PAD_BTNS[id][fmt === 'xbox' ? 'xb' : 'ps'].t;
}
function padDpadIconSVG(id, fmt, s) {
  const rot = { dup: 0, dright: 90, ddown: 180, dleft: 270 }[id];
  if (fmt === 'xbox') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1e1e23" stroke="rgba(0,0,0,.5)" stroke-width="1.6"/><path d="M15 7h10v8h8v10h-8v8H15v-8H7V15h8z" fill="#494954"/><g transform="rotate(${rot} 20 20)"><path d="M15 7h10v8H15z" fill="#E0AD4A"/></g><rect x="15" y="15" width="10" height="10" fill="#565662"/></svg>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><g transform="rotate(${rot} 20 20)"><path d="M11 9C11 4 15 2 20 2C25 2 29 4 29 9L24 27C22.5 31.5 21.5 33 20 33C18.5 33 17.5 31.5 16 27Z" fill="#26262b" stroke="rgba(0,0,0,.55)" stroke-width="1.6"/><path d="M20 9l5 8H15z" fill="#cfd6dd"/></g></svg>`;
}
function padIconSVG(id, fmt, s) {
  s = s || 40;
  const b = PAD_BTNS[id][fmt === 'xbox' ? 'xb' : 'ps'];
  if (PAD_FACE.includes(id)) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#17181a" stroke="rgba(0,0,0,.5)" stroke-width="2"/><text x="20" y="27" text-anchor="middle" font-size="17" font-weight="900" fill="${b.c}">${b.t}</text></svg>`;
  }
  if (PAD_DIRS.includes(id)) return padDpadIconSVG(id, fmt, s);
  if (id === 'lstick' || id === 'rstick') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#17181a" stroke="rgba(0,0,0,.5)" stroke-width="2"/><circle cx="20" cy="20" r="10.5" fill="#33343a"/><text x="20" y="24" text-anchor="middle" font-size="9.5" font-weight="900" fill="#dfe5ea">${b.t}</text></svg>`;
  }
  if (id === 'menu' || id === 'view') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#26262b" stroke="rgba(0,0,0,.5)" stroke-width="2"/><text x="20" y="${b.small ? 23.5 : 27}" text-anchor="middle" font-size="${b.small ? 8 : 16}" font-weight="900" fill="#dfe5ea">${b.t}</text></svg>`;
  }
  return `<svg width="${s + 14}" height="${s * 0.62}" viewBox="0 0 54 25"><rect x="2" y="2" width="50" height="21" rx="10" fill="#33343a" stroke="rgba(0,0,0,.5)" stroke-width="1.6"/><text x="27" y="17.5" text-anchor="middle" font-size="12" font-weight="900" fill="#eef2f5">${b.t}</text></svg>`;
}

/* ---------- 操作の定義と初期割り当て ----------
   パクリスはテトリス(ガイドライン準拠タイトルの標準配置)、ぶにょぶにょはぷよぷよの
   標準コントローラー配置をベースにした。採用値は引き継ぎメモに一覧で明記してある。 */
const PAD_COMMON = [
  ['ok', '決定', 'south'], ['cancel', 'キャンセル・戻る', 'east'],
  ['up', 'カーソル移動（上）', 'dup'], ['down', 'カーソル移動（下）', 'ddown'],
  ['left', 'カーソル移動（左）', 'dleft'], ['right', 'カーソル移動（右）', 'dright'],
  ['tabPrev', 'タブ切替（前）', 'lb'], ['tabNext', 'タブ切替（次）', 'rb'],
  ['settings', '設定を開く', 'menu'], ['chat', 'チャットを開く', 'view'],
];
const PAD_GAMES = {
  pakuris: { name: 'パクリス', rows: [
    ['left', '左へ移動', 'dleft'], ['right', '右へ移動', 'dright'],
    ['down', '下へ移動', 'ddown'], ['drop', 'ハードドロップ', 'dup'],
    ['rotR', '右回転', 'south'], ['rotL', '左回転', 'west'],
    ['hold', 'ホールド', 'lb'], ['ok', '決定', 'rb'], ['cancel', 'キャンセル', 'east']] },
  bunyo: { name: 'ぶにょぶにょ', rows: [
    ['left', '左へ移動', 'dleft'], ['right', '右へ移動', 'dright'],
    ['down', '下へ移動', 'ddown'], ['drop', 'ハードドロップ', 'dup'],
    ['rotR', '右回転', 'east'], ['rotL', '左回転', 'south'],
    ['ok', '決定', 'lb'], ['cancel', 'キャンセル', 'rb']] },
  battleship: { name: 'バトルシップ', rows: [
    ['cursor', 'カーソル移動', 'lstick'], ['place', '配置する', 'south'],
    ['rotate', '向きを変える', 'north'], ['fire', '発射する', 'rb'],
    ['ok', '決定', 'lb'], ['cancel', 'キャンセル', 'east']] },
  quoridor: { name: 'コリドール', rows: [
    ['cursor', 'カーソル移動', 'lstick'], ['move', '駒を動かす', 'south'],
    ['wallmode', '壁モードに切替', 'north'], ['placewall', '壁を置く', 'west'],
    ['rotatewall', '壁を回す', 'rb'], ['ok', '決定', 'lb'], ['cancel', 'キャンセル', 'east']] },
  blokus: { name: 'ブロクス', rows: [
    ['cursor', 'カーソル移動', 'lstick'], ['place', '置く', 'south'],
    ['rotate', '回転', 'north'], ['flip', '反転', 'west'],
    ['pass', 'パス', 'rb'], ['ok', '決定', 'lb'], ['cancel', 'キャンセル', 'east']] },
  mine: { name: 'マインスイーパー（対戦版も同じ設定）', rows: [
    ['cursor', 'カーソル移動', 'lstick'], ['open', '開く', 'south'],
    ['flag', '旗を立てる／外す', 'north'], ['chord', '周りを開く', 'west'],
    ['ok', '決定', 'rb'], ['cancel', 'キャンセル', 'east']] },
};
/* ゲーム選択ピッカー(アプリのゲームIDと名前)。PAD_GAMES に無いゲームは未対応で選択不可 */
const PAD_PICKER = [
  ['battleship', 'バトルシップ'], ['quoridor', 'コリドール'], ['daifugo', '大富豪'], ['shogi', '将棋'],
  ['reversi', 'リバーシ'], ['chess', 'チェス'], ['hanafuda', '花札'], ['mahjong', '麻雀'],
  ['take6', '6ニムト'], ['blokus', 'ブロクス'], ['pakuris', 'パクリス'], ['bunyo', 'ぶにょぶにょ'],
  ['chinchiro', 'チンチロリン'], ['life', '人生すごろく'], ['hitblow', 'ヒット＆ブロー'],
  ['mine', 'マインスイーパー'], ['wolf', '人狼'],
];
/* キーボードの初期割り当て(アプリ既存のキーボード操作に合わせたものだけを初期値にする) */
const PAD_KB_DEFAULTS = {
  common: { ok: 'Enter', cancel: 'Escape', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  pakuris: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', drop: ' ', rotR: 'X', rotL: 'Z', hold: 'C' },
  bunyo: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', drop: ' ', rotR: 'X', rotL: 'Z' },
};
function padDefaults() {
  const pad = { common: {} }, kb = { common: {} };
  for (const [k, , b] of PAD_COMMON) pad.common[k] = b;
  for (const gid in PAD_GAMES) { pad[gid] = {}; for (const [k, , b] of PAD_GAMES[gid].rows) pad[gid][k] = b; }
  for (const s of Object.keys(pad)) { kb[s] = {}; for (const k of Object.keys(pad[s])) kb[s][k] = (PAD_KB_DEFAULTS[s] && PAD_KB_DEFAULTS[s][k]) || null; }
  return { pad, kb };
}
function loadPadCfg() {
  const d = padDefaults();
  let saved = null;
  try { saved = store.get('padcfg', null); } catch (e) {}
  if (saved && typeof saved === 'object') {
    if (saved.pad) for (const s of Object.keys(d.pad)) if (saved.pad[s]) for (const k of Object.keys(d.pad[s])) if (typeof saved.pad[s][k] === 'string' && PAD_BTNS[saved.pad[s][k]]) d.pad[s][k] = saved.pad[s][k];
    if (saved.kb) for (const s of Object.keys(d.kb)) if (saved.kb[s]) for (const k of Object.keys(d.kb[s])) { const v = saved.kb[s][k]; d.kb[s][k] = (typeof v === 'string' && v) ? v : null; }
  }
  return d;
}
const kbLabel = (k) => k === ' ' ? 'スペース' : String(k).replace('Escape', 'Esc').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→');

/* ---------- パッド図(Xbox ワイヤレス コントローラー/ DualSense、承認済みサンプルから流用) ---------- */
function pcStickSVG(id, cx, cy) {
  return `<g class="pbtn" data-btn="${id}">
   <circle class="shape" cx="${cx}" cy="${cy}" r="39" fill="#101113" stroke="#050506" stroke-width="2"/>
   <g class="sticktop">
     <circle cx="${cx}" cy="${cy}" r="28" fill="url(#pcStickG)"/>
     <circle cx="${cx}" cy="${cy}" r="28" fill="none" stroke="#000" stroke-width="1.5"/>
     <circle cx="${cx}" cy="${cy}" r="17" fill="#0b0b0d"/>
     <circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="#2e2e33" stroke-width="1"/>
   </g></g>`;
}
function pcXboxPad() {
  return `<svg viewBox="-4 -18 668 504" role="img" aria-label="Xbox ワイヤレス コントローラー">
 <defs>
  <linearGradient id="pcXbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8d8de"/></linearGradient>
  <radialGradient id="pcStickG" cx="0.42" cy="0.38" r="0.85"><stop offset="0" stop-color="#45464c"/><stop offset="0.7" stop-color="#232428"/><stop offset="1" stop-color="#131315"/></radialGradient>
  <radialGradient id="pcDishG" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2a2a2f"/><stop offset="0.8" stop-color="#1b1b1f"/><stop offset="1" stop-color="#101012"/></radialGradient>
 </defs>
 <g class="pbtn" data-btn="lt"><rect class="shape" x="98" y="0" width="102" height="56" rx="13" fill="#c4c4cc" stroke="#8b8b94" stroke-width="2"/><text x="149" y="22" text-anchor="middle" font-size="12" font-weight="900" fill="#55565c">LT</text></g>
 <g class="pbtn" data-btn="rt"><rect class="shape" x="460" y="0" width="102" height="56" rx="13" fill="#c4c4cc" stroke="#8b8b94" stroke-width="2"/><text x="511" y="22" text-anchor="middle" font-size="12" font-weight="900" fill="#55565c">RT</text></g>
 <path d="M112 46 C190 32 470 32 548 46 C592 54 610 88 617 132 C622 168 620 205 627 246 C634 292 626 352 600 398 C584 428 560 438 540 428 C518 417 502 390 486 360 C458 354 414 344 330 344 C246 344 202 354 174 360 C158 390 142 417 120 428 C100 438 76 428 60 398 C34 352 26 292 33 246 C40 205 38 168 43 132 C50 88 68 54 112 46 Z" fill="url(#pcXbBody)" stroke="#9a9aa2" stroke-width="2.5"/>
 <g class="pbtn" data-btn="lb"><rect class="shape" x="84" y="28" width="130" height="34" rx="15" fill="#e9e9ee" stroke="#8b8b94" stroke-width="2"/><text x="149" y="50" text-anchor="middle" font-size="13" font-weight="900" fill="#55565c">LB</text></g>
 <g class="pbtn" data-btn="rb"><rect class="shape" x="446" y="28" width="130" height="34" rx="15" fill="#e9e9ee" stroke="#8b8b94" stroke-width="2"/><text x="511" y="50" text-anchor="middle" font-size="13" font-weight="900" fill="#55565c">RB</text></g>
 <circle cx="330" cy="78" r="20" fill="#f4f4f6" stroke="#b4b4bc" stroke-width="2"/><circle cx="330" cy="78" r="14.5" fill="none" stroke="#d8d8de" stroke-width="1.5"/>
 <g class="pbtn" data-btn="view"><circle class="shape" cx="259" cy="143" r="11.5" fill="#f4f4f6" stroke="#a4a4ac" stroke-width="1.6"/><g stroke="#55565c" stroke-width="1.3" fill="none"><rect x="253.5" y="137.5" width="7" height="7"/><rect x="257.5" y="141.5" width="7" height="7" fill="#f4f4f6"/></g></g>
 <g class="pbtn" data-btn="menu"><circle class="shape" cx="323" cy="143" r="11.5" fill="#f4f4f6" stroke="#a4a4ac" stroke-width="1.6"/><g stroke="#55565c" stroke-width="1.7"><path d="M317.5 139h11M317.5 143h11M317.5 147h11"/></g></g>
 <g><rect x="277" y="165" width="30" height="18" rx="9" fill="#f4f4f6" stroke="#a4a4ac" stroke-width="1.6"/><g stroke="#55565c" stroke-width="1.4" fill="none"><path d="M292 178.5v-7M288.3 174.8L292 171l3.7 3.8M286.5 179.5h11"/></g></g>
 ${pcStickSVG('lstick', 180, 141)}
 <g>
   <circle cx="250" cy="231" r="43" fill="url(#pcDishG)" stroke="#060607" stroke-width="2"/>
   <polygon points="281.4,244 263,262.4 237,262.4 218.6,244 218.6,218 237,199.6 263,199.6 281.4,218" fill="#222227"/>
   <path d="M239 201h22v19h19v22h-19v19h-22v-19h-19v-22h19z" fill="#33333a" stroke="#0e0e10" stroke-width="1"/>
   <g stroke="#131316" stroke-width="1.2"><path d="M241 222 L229 210"/><path d="M259 222 L271 210"/><path d="M259 240 L271 252"/><path d="M241 240 L229 252"/></g>
   <rect x="239" y="220" width="22" height="22" fill="#3d3d44"/>
 </g>
 <g class="pbtn" data-btn="dup"><path class="segfill" d="M239 201h22v19h-22z"/></g>
 <g class="pbtn" data-btn="dright"><path class="segfill" d="M261 220h19v22h-19z"/></g>
 <g class="pbtn" data-btn="ddown"><path class="segfill" d="M239 242h22v19h-22z"/></g>
 <g class="pbtn" data-btn="dleft"><path class="segfill" d="M220 220h19v22h-19z"/></g>
 ${pcStickSVG('rstick', 393, 222)}
 <g class="pbtn" data-btn="north"><circle class="shape" cx="461" cy="104" r="19" fill="#17181a" stroke="#050506" stroke-width="1.6"/><text x="461" y="111" text-anchor="middle" font-size="16" font-weight="900" fill="#F2C200">Y</text></g>
 <g class="pbtn" data-btn="west"><circle class="shape" cx="424" cy="141" r="19" fill="#17181a" stroke="#050506" stroke-width="1.6"/><text x="424" y="148" text-anchor="middle" font-size="16" font-weight="900" fill="#1B9BD8">X</text></g>
 <g class="pbtn" data-btn="east"><circle class="shape" cx="498" cy="141" r="19" fill="#17181a" stroke="#050506" stroke-width="1.6"/><text x="498" y="148" text-anchor="middle" font-size="16" font-weight="900" fill="#E5484D">B</text></g>
 <g class="pbtn" data-btn="south"><circle class="shape" cx="461" cy="178" r="19" fill="#17181a" stroke="#050506" stroke-width="1.6"/><text x="461" y="185" text-anchor="middle" font-size="16" font-weight="900" fill="#3DBE4B">A</text></g>
</svg>`;
}
function pcPsWedge(rot) {
  return `<g transform="rotate(${rot})"><path class="shape" d="M-16 -13 C-16 -20 -8 -22 0 -22 C8 -22 16 -20 16 -13 L8 11 C5 19 2 21 0 21 C-2 21 -5 19 -8 11 Z" fill="#26262b" stroke="#0c0c0e" stroke-width="1.6"/><path d="M0 -9 L5 0 L-5 0 Z" fill="#9a9aa4"/></g>`;
}
function pcPsSymbol(kind, cx, cy) {
  if (kind === 'north') return `<path d="M${cx} ${cy - 8} L${cx + 7} ${cy + 5} L${cx - 7} ${cy + 5} Z" stroke="#6d6d76" stroke-width="2" fill="none"/>`;
  if (kind === 'east') return `<circle cx="${cx}" cy="${cy}" r="7" stroke="#6d6d76" stroke-width="2" fill="none"/>`;
  if (kind === 'west') return `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" stroke="#6d6d76" stroke-width="2" fill="none"/>`;
  return `<path d="M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}" stroke="#6d6d76" stroke-width="2" fill="none"/>`;
}
function pcPsStick(id, cx, cy) {
  return `<g class="pbtn" data-btn="${id}">
   <circle class="shape" cx="${cx}" cy="${cy}" r="34" fill="#101013" stroke="#000" stroke-width="2"/>
   <g class="sticktop">
     <circle cx="${cx}" cy="${cy}" r="25" fill="url(#pcStickG)"/>
     <circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="#3a3a41" stroke-width="1.2"/>
     <circle cx="${cx}" cy="${cy}" r="14.5" fill="#0b0b0d"/>
   </g></g>`;
}
function pcPsPad() {
  const PS_BODY = "M128 40 C200 26 460 26 532 40 C578 48 600 84 610 140 C618 190 616 240 622 300 C626 352 610 404 578 428 C560 441 540 436 524 414 C508 392 498 362 486 338 C460 318 410 306 330 306 C250 306 200 318 174 338 C162 362 152 392 136 414 C120 436 100 441 82 428 C50 404 34 352 38 300 C44 240 42 190 50 140 C60 84 82 48 128 40 Z";
  return `<svg viewBox="-4 -18 668 504" role="img" aria-label="DualSense ワイヤレス コントローラー">
 <defs>
  <linearGradient id="pcPsBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfd"/><stop offset="1" stop-color="#d6d6dd"/></linearGradient>
  <radialGradient id="pcStickG" cx="0.42" cy="0.38" r="0.85"><stop offset="0" stop-color="#45464c"/><stop offset="0.7" stop-color="#232428"/><stop offset="1" stop-color="#131315"/></radialGradient>
  <clipPath id="pcPsClip"><path d="${PS_BODY}"/></clipPath>
 </defs>
 <g class="pbtn" data-btn="lt"><rect class="shape" x="150" y="-2" width="112" height="52" rx="12" fill="#0e0e11" stroke="#000" stroke-width="2"/><text x="206" y="17" text-anchor="middle" font-size="11.5" font-weight="900" fill="#9a9aa4">L2</text></g>
 <g class="pbtn" data-btn="rt"><rect class="shape" x="398" y="-2" width="112" height="52" rx="12" fill="#0e0e11" stroke="#000" stroke-width="2"/><text x="454" y="17" text-anchor="middle" font-size="11.5" font-weight="900" fill="#9a9aa4">R2</text></g>
 <path d="${PS_BODY}" fill="url(#pcPsBody)" stroke="#a2a2ab" stroke-width="2.5"/>
 <g clip-path="url(#pcPsClip)"><path d="M252 158 C242 192 218 204 210 234 C204 258 212 280 230 290 C220 302 200 310 178 316 C162 322 152 330 146 342 C138 356 132 372 126 390 C120 404 112 418 100 430 C110 436 122 434 132 424 C142 410 148 394 152 376 C156 358 162 342 172 328 C180 318 196 312 214 310 C226 310 240 310 252 311 C276 318 300 322 330 322 C360 322 384 318 408 311 C420 310 434 310 446 310 C464 312 480 318 488 328 C498 342 504 358 508 376 C512 394 518 410 528 424 C538 434 550 436 560 430 C548 418 540 404 534 390 C528 372 522 356 514 342 C508 330 498 322 482 316 C460 310 440 302 430 290 C448 280 456 258 450 234 C442 204 418 192 408 158 C376 170 284 170 252 158 Z" fill="#17171b"/></g>
 <g class="pbtn" data-btn="lb"><rect class="shape" x="140" y="22" width="132" height="33" rx="12" fill="#26262b" stroke="#0c0c0e" stroke-width="2"/><text x="206" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="#eef2f5">L1</text></g>
 <g class="pbtn" data-btn="rb"><rect class="shape" x="388" y="22" width="132" height="33" rx="12" fill="#26262b" stroke="#0c0c0e" stroke-width="2"/><text x="454" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="#eef2f5">R1</text></g>
 <path d="M232 42 L428 42 C436 42 441 48 442 56 L446 156 C446 166 440 172 430 172 L230 172 C220 172 214 166 214 156 L218 56 C219 48 224 42 232 42 Z" fill="#f7f7f9" stroke="#b4b4bc" stroke-width="2"/>
 <path d="M223 52 L217.5 158" stroke="#4d8dff" stroke-width="3" opacity="0.75" fill="none"/>
 <path d="M437 52 L442.5 158" stroke="#4d8dff" stroke-width="3" opacity="0.75" fill="none"/>
 <g class="pbtn" data-btn="view"><rect class="shape" x="198" y="54" width="14" height="30" rx="7" fill="#26262b" stroke="#0c0c0e" stroke-width="1.4"/></g>
 <g class="pbtn" data-btn="menu"><rect class="shape" x="448" y="54" width="14" height="30" rx="7" fill="#26262b" stroke="#0c0c0e" stroke-width="1.4"/></g>
 <g class="pbtn" data-btn="dup"><g transform="translate(155 112)">${pcPsWedge(0)}</g></g>
 <g class="pbtn" data-btn="dright"><g transform="translate(187 139)">${pcPsWedge(90)}</g></g>
 <g class="pbtn" data-btn="ddown"><g transform="translate(155 166)">${pcPsWedge(180)}</g></g>
 <g class="pbtn" data-btn="dleft"><g transform="translate(123 139)">${pcPsWedge(270)}</g></g>
 <g class="pbtn" data-btn="north"><circle class="shape" cx="498" cy="96" r="16" fill="#f7f7f9" stroke="#8f8f99" stroke-width="1.6"/>${pcPsSymbol('north', 498, 96)}</g>
 <g class="pbtn" data-btn="west"><circle class="shape" cx="461" cy="139" r="16" fill="#f7f7f9" stroke="#8f8f99" stroke-width="1.6"/>${pcPsSymbol('west', 461, 139)}</g>
 <g class="pbtn" data-btn="east"><circle class="shape" cx="535" cy="139" r="16" fill="#f7f7f9" stroke="#8f8f99" stroke-width="1.6"/>${pcPsSymbol('east', 535, 139)}</g>
 <g class="pbtn" data-btn="south"><circle class="shape" cx="498" cy="182" r="16" fill="#f7f7f9" stroke="#8f8f99" stroke-width="1.6"/>${pcPsSymbol('south', 498, 182)}</g>
 ${pcPsStick('lstick', 249, 221)}
 ${pcPsStick('rstick', 411, 221)}
 <g fill="#3d3d44">${[306, 314, 322, 330, 338, 346, 354].map(x => `<circle cx="${x}" cy="198" r="1.7"/>`).join('')}</g>
 <circle cx="330" cy="243" r="11" fill="#17171b" stroke="#000" stroke-width="1.5"/>
 <rect x="319" y="262" width="22" height="7" rx="3.5" fill="#17171b"/>
</svg>`;
}

/* ---------- 本体 ---------- */
const PADCFG = {
  cfg: loadPadCfg(),
  fmt: 'xbox',          // 表示形式(ベンダーIDから自動判別。手動切替は無い)
  padName: '',          // 接続中パッドの表示名(判別バー用)
  tab: 'common',        // 'common' | 'game'
  game: null,           // ゲーム別タブで選択中のゲーム(コンフィグID)
  sel: null,            // 選択中の行 'scope:key'
  waiting: null,        // 割り当て待ち {scope, key}
  _raf: 0, _prev: [],

  save() { try { store.set('padcfg', this.cfg); } catch (e) {} },
  scopeId() { return this.tab === 'common' ? 'common' : this.game; },
  bind(scope, key) { const a = this.cfg.pad[scope]; return a ? a[key] : undefined; },
  kbBind(scope, key) { const a = this.cfg.kb[scope]; return a ? a[key] : undefined; },
  actionFor(scope, btn) { const a = this.cfg.pad[scope]; if (!a) return null; for (const k in a) if (a[k] === btn) return k; return null; },
  kbActionFor(scope, keyStr) { const a = this.cfg.kb[scope]; if (!a) return null; for (const k in a) if (a[k] && a[k] === keyStr) return k; return null; },
  /* アプリのゲームID → コンフィグID(項目のある6ゲームのみ。それ以外は null) */
  mapGame(id) { if (!id) return null; if (id === 'mineVersus') return 'mine'; return PAD_GAMES[id] ? id : null; },
  /* いま開いている文脈のゲーム(アプリID)。設定パネルの入口の初期選択に使う */
  currentGame() {
    if (typeof S === 'undefined') return null;
    if (S.screen === 'play') return (typeof cur !== 'undefined' && cur) ? cur.id : null;
    if (S.screen === 'extraPlay') return (typeof boardMatch !== 'undefined' && boardMatch.state) ? boardMatch.state.game : null;
    if (S.screen === 'bunyoPlay' || S.screen === 'bunyoSetup') return 'bunyo';
    if (S.screen === 'pakurisPlay' || S.screen === 'pakurisSetup') return 'pakuris';
    if (S.screen === 'minePlay' || S.screen === 'mineSetup') return 'mine';
    if (S.screen === 'setup' && S.setup) return S.setup.id;
    return null;
  },
  isOpen() { return typeof S !== 'undefined' && S.modal === 'padcfg'; },
  isCapturing() { return !!this.waiting; },

  open(id) {
    const mapped = this.mapGame(id);
    if (mapped) { this.tab = 'game'; this.game = mapped; }
    else if (id) { this.tab = 'game'; this.game = null; }
    else { this.tab = 'common'; this.game = this.game && PAD_GAMES[this.game] ? this.game : null; }
    this.sel = null; this.waiting = null;
    S.modal = 'padcfg';
    render();
    this.paintPad();
    this.startLoop();
  },
  close() {
    this.waiting = null;
    this.stopLoop();
    if (typeof S !== 'undefined' && S.modal === 'padcfg') { S.modal = null; render(); }
  },

  /* ----- 描画 ----- */
  modalHtml() {
    return `<div class="modal"><button class="mback" data-mback aria-label="閉じる"></button><div class="mbox wide pcfg-box" id="pcfgBox" role="dialog" aria-label="キーコンフィグ（ゲームパッド）">${this.innerHtml()}</div></div>`;
  },
  detectText() {
    if (this.padName) return `接続中：${esc(this.padName)}（${this.fmt === 'ps' ? 'PlayStation' : 'Xbox'}形式で表示）`;
    return 'ゲームパッド未接続（Xbox形式で表示）';
  },
  innerHtml() {
    const sid = this.scopeId();
    return `<div class="mhd"><h3>キーコンフィグ（ゲームパッド）</h3><span class="pcfg-detect" id="pcfgDetect">${this.detectText()}</span><button class="btn gold" data-mclose style="height:38px;width:110px;flex:none">完了</button></div>
    <div class="pcfg-tabs">
      <button class="pcfg-tab" data-pc-tab="common" aria-pressed="${this.tab === 'common'}">共通</button>
      <button class="pcfg-tab" data-pc-tab="game" aria-pressed="${this.tab === 'game'}">ゲーム別</button>
      ${this.tab === 'game' ? `<span class="pcfg-games">${PAD_PICKER.map(([id, name]) => {
        const ok = !!PAD_GAMES[id];
        return `<button class="pcfg-gbtn${this.game === id ? ' on' : ''}" data-pc-game="${id}" ${ok ? '' : 'disabled'} title="${esc(name)}" aria-label="${esc(name)}"><span class="pcfg-gart">${(typeof artOf === 'function' ? artOf(id) : '') || esc(name[0])}</span></button>`;
      }).join('')}</span>` : ''}
    </div>
    ${this.waiting ? `<div class="pcfg-waitbar">「${esc(this.rowName(this.waiting.scope, this.waiting.key))}」の割り当て待ちです。<b>パッドのボタンかキーボードのキーを押してください…</b>（Escで中止）</div>` : ''}
    <div class="pcfg-main">
      <div class="pcfg-rows">${this.rowsHtml()}</div>
      <div class="pcfg-padpanel${this.waiting ? ' waiting' : ''}" id="pcfgPad">${this.fmt === 'ps' ? pcPsPad() : pcXboxPad()}</div>
    </div>
    <div class="pcfg-foot">
      <button class="btn" data-pc-reset="all">すべて初期設定に戻す</button>
      <button class="btn" data-pc-reset="game" ${sid && sid !== 'common' && PAD_GAMES[sid] ? '' : 'disabled'}>このゲームだけ初期設定に戻す</button>
      <span class="pcfg-note">変更はすぐに反映され、自動で保存されます</span>
    </div>`;
  },
  rowName(scope, key) {
    const rows = scope === 'common' ? PAD_COMMON : (PAD_GAMES[scope] ? PAD_GAMES[scope].rows : []);
    const r = rows.find(([k]) => k === key);
    return r ? r[1] : key;
  },
  scopeRows() {
    if (this.tab === 'common') return PAD_COMMON.map(([k, n]) => ({ key: k, name: n }));
    const g = PAD_GAMES[this.game];
    return g ? g.rows.map(([k, n]) => ({ key: k, name: n })) : [];
  },
  duplicates(scope) {
    const dup = new Set();
    const pa = this.cfg.pad[scope] || {}, seen = {};
    for (const k in pa) { if (seen[pa[k]]) { dup.add(k); dup.add(seen[pa[k]]); } else seen[pa[k]] = k; }
    const ka = this.cfg.kb[scope] || {}, seenK = {};
    for (const k in ka) { const v = ka[k]; if (!v) continue; if (seenK[v]) { dup.add(k); dup.add(seenK[v]); } else seenK[v] = k; }
    return dup;
  },
  rowsHtml() {
    const sid = this.scopeId();
    if (this.tab === 'game' && !PAD_GAMES[this.game]) {
      return `<div class="pcfg-nogame">上の丸いアイコンからゲームを選んでください。<br>対応しているのは パクリス／ぶにょぶにょ／バトルシップ／コリドール／ブロクス／マインスイーパー の6ゲームです。</div>`;
    }
    const dup = this.duplicates(sid);
    const note = this.tab === 'common' ? `<div class="pcfg-sticknote"><b>スティックカーソル（全ゲーム共通）</b>：左スティックで盤上の専用カーソルを動かし、決定ボタンでその位置をクリックします。マウスで操作する時は通常のカーソルを使い、専用カーソルはスティックで操作している間だけ表示されます。十字キーは選択枠を要素の間で動かします（「カーソル移動」の割り当て）。行を選ぶと、パッドのボタンだけでなくキーボードのキーも割り当てられます。</div>` : '';
    return note + this.scopeRows().map((r) => {
      const b = this.cfg.pad[sid][r.key];
      const kb = this.cfg.kb[sid][r.key];
      const waiting = this.waiting && this.waiting.scope === sid && this.waiting.key === r.key;
      return `<div class="pcfg-row${this.sel === sid + ':' + r.key ? ' sel' : ''}${waiting ? ' waiting' : ''}${dup.has(r.key) ? ' dup' : ''}" data-pc-row="${r.key}" role="button" tabindex="0">
        <span class="pcfg-nm">${esc(r.name)}<span class="pcfg-warn">⚠ 他の項目と重複しています</span></span>
        <span class="pcfg-as">${waiting ? '<b>ボタンを押してください…</b>' : `<span class="pcfg-bicon">${padIconSVG(b, this.fmt, 40)}</span>${kb ? `<kbd class="pcfg-kbd">${esc(kbLabel(kb))}</kbd>` : ''}`}<button class="btn pcfg-chg">${waiting ? '中止' : '変える'}</button></span>
      </div>`;
    }).join('');
  },
  refresh() {
    const box = document.getElementById('pcfgBox');
    if (box) box.innerHTML = this.innerHtml();
    this.paintPad();
  },
  /* パッド図の色付け(現在のスコープで使われているボタン/選択中の行と連動するボタン) */
  paintPad() {
    const wrap = document.getElementById('pcfgPad');
    if (!wrap) return;
    const sid = this.scopeId();
    wrap.querySelectorAll('.pbtn').forEach((g) => {
      const btn = g.dataset.btn;
      const usedHere = sid ? this.actionFor(sid, btn) : null;
      const usedAny = Object.keys(this.cfg.pad).some((s) => this.actionFor(s, btn));
      g.classList.toggle('assigned', !!usedHere || usedAny);
      g.classList.toggle('unassigned', !usedHere && !usedAny);
      let linked = false;
      if (this.sel && sid && this.sel.startsWith(sid + ':')) linked = this.cfg.pad[sid][this.sel.slice(sid.length + 1)] === btn;
      if (this.waiting && sid) linked = false;
      g.classList.toggle('linked', linked);
    });
  },
  flash(btn) {
    const g = document.querySelector(`#pcfgPad .pbtn[data-btn="${btn}"]`);
    if (g) { g.classList.add('pressed'); setTimeout(() => g.classList.remove('pressed'), 180); }
  },

  /* ----- 割り当て ----- */
  startAssign(key) {
    const sid = this.scopeId();
    if (!sid || !PAD_GAMES[sid] && sid !== 'common') return;
    if (this.waiting && this.waiting.scope === sid && this.waiting.key === key) { this.cancelAssign(); return; }
    this.waiting = { scope: sid, key };
    this.sel = sid + ':' + key;
    this.refresh();
  },
  cancelAssign() { this.waiting = null; this.refresh(); },
  assignPad(btn) {
    if (!this.waiting) return;
    this.cfg.pad[this.waiting.scope][this.waiting.key] = btn;
    this.waiting = null;
    this.save(); this.refresh(); this.flash(btn);
    if (typeof toast === 'function') toast({ w: 'キーコンフィグ', t: '割り当てを変更しました' });
  },
  assignKey(keyStr) {
    if (!this.waiting) return;
    this.cfg.kb[this.waiting.scope][this.waiting.key] = keyStr;
    this.waiting = null;
    this.save(); this.refresh();
    if (typeof toast === 'function') toast({ w: 'キーコンフィグ', t: '割り当てを変更しました' });
  },
  padClick(btn) {
    if (this.waiting) { this.assignPad(btn); return; }
    this.flash(btn);
    const sid = this.scopeId();
    const k = sid ? this.actionFor(sid, btn) : null;
    if (k) { this.sel = sid + ':' + k; this.refresh(); }
  },
  reset(scope) {
    const d = padDefaults();
    if (scope === 'all') { this.cfg = d; }
    else if (d.pad[scope]) { this.cfg.pad[scope] = d.pad[scope]; this.cfg.kb[scope] = d.kb[scope]; }
    this.waiting = null;
    this.save(); this.refresh();
    if (typeof toast === 'function') toast({ w: 'キーコンフィグ', t: '初期設定に戻しました' });
  },

  /* ----- パッド判別と、開いている間の見た目・割り当て待ち受け ----- */
  notePad(gp) {
    if (!gp) return;
    const id = gp.id || '';
    const fmt = (/054c/i.test(id) || /sony|playstation|dualsense|dualshock/i.test(id)) ? 'ps' : 'xbox';
    const name = id.replace(/\s*\(.*?\)\s*/g, '').slice(0, 40);
    const changed = fmt !== this.fmt;
    this.fmt = fmt;
    this.padName = name;
    if (!this.isOpen()) return;
    const det = document.getElementById('pcfgDetect');
    if (det) det.textContent = this.detectText();
    if (changed) this.refresh();
  },
  startLoop() {
    if (this._raf) return;
    const stepFn = () => {
      this._raf = requestAnimationFrame(stepFn);
      if (!this.isOpen()) { this.stopLoop(); return; }
      this.pollPad();
    };
    this._raf = requestAnimationFrame(stepFn);
  },
  stopLoop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; this._prev = []; },
  pollPad() {
    const gps = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
    let gp = null;
    for (const g of gps) if (g && g.connected) { gp = g; break; }
    if (!gp) { this._prev = []; return; }
    this.notePad(gp);
    const pressed = (gp.buttons || []).map((b) => !!(b && (b.pressed || b.value > 0.5)));
    if (this.waiting) {
      const idx = pressed.findIndex((p, i) => p && !this._prev[i]);
      if (idx >= 0 && PAD_ID_BY_INDEX[idx]) this.assignPad(PAD_ID_BY_INDEX[idx]);
    } else {
      pressed.forEach((p, i) => { if (p && !this._prev[i] && PAD_ID_BY_INDEX[i]) this.flash(PAD_ID_BY_INDEX[i]); });
    }
    this._prev = pressed;
    const wrap = document.getElementById('pcfgPad');
    if (wrap) {
      const ax = gp.axes || [];
      const setTop = (id, x, y) => {
        const g = wrap.querySelector(`.pbtn[data-btn="${id}"] .sticktop`);
        if (g) g.style.transform = (Math.abs(x) > 0.12 || Math.abs(y) > 0.12) ? `translate(${x * 5}px, ${y * 5}px)` : '';
      };
      setTop('lstick', ax[0] || 0, ax[1] || 0);
      setTop('rstick', ax[2] || 0, ax[3] || 0);
    }
  },
};

/* 画面内のクリック(行・タブ・ゲームアイコン・パッド図・リセット) */
document.addEventListener('click', (e) => {
  if (!PADCFG.isOpen()) return;
  const box = document.getElementById('pcfgBox');
  if (!box || !box.contains(e.target)) return;
  const tab = e.target.closest('[data-pc-tab]');
  if (tab) { PADCFG.tab = tab.dataset.pcTab; PADCFG.waiting = null; PADCFG.refresh(); return; }
  const gb = e.target.closest('[data-pc-game]');
  if (gb && !gb.disabled) { PADCFG.game = gb.dataset.pcGame; PADCFG.waiting = null; PADCFG.sel = null; PADCFG.refresh(); return; }
  const rs = e.target.closest('[data-pc-reset]');
  if (rs && !rs.disabled) { PADCFG.reset(rs.dataset.pcReset === 'all' ? 'all' : PADCFG.scopeId()); return; }
  const pb = e.target.closest('#pcfgPad .pbtn');
  if (pb) { PADCFG.padClick(pb.dataset.btn); return; }
  const row = e.target.closest('[data-pc-row]');
  if (row) { PADCFG.startAssign(row.dataset.pcRow); return; }
});
/* 行にマウスを乗せたら、対応するパッドのボタンを光らせる */
document.addEventListener('mouseover', (e) => {
  if (!PADCFG.isOpen() || PADCFG.waiting) return;
  const row = e.target.closest && e.target.closest('[data-pc-row]');
  if (!row) return;
  const sid = PADCFG.scopeId();
  if (PADCFG.sel !== sid + ':' + row.dataset.pcRow) { PADCFG.sel = sid + ':' + row.dataset.pcRow; PADCFG.paintPad(); }
});

/* キーボード: 開いている間は Esc と割り当て待ちを先に処理する(アプリ側より優先) */
document.addEventListener('keydown', (e) => {
  if (!PADCFG.isOpen()) return;
  if (PADCFG.waiting) {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { PADCFG.cancelAssign(); return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    PADCFG.assignKey(keyOf(e));
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); PADCFG.close(); }
}, true);

/* キーボード割り当ての実効(アプリ側の処理で消費されなかったキーだけを PADACT に流す) */
document.addEventListener('keydown', (e) => {
  if (PADCFG.isOpen() || e.defaultPrevented) return;
  if (typeof S === 'undefined' || S.rekey) return;
  const t = e.target;
  if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable)) return;
  if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;   // 矢印キーはアプリ側(navMove/各ゲーム)が処理する
  const k = keyOf(e);
  if (k === S.keys.back) return;                            // 戻るキーはアプリ側が処理する
  if (!window.PADACT) return;
  const ae = document.activeElement;
  const nativeOk = (k === 'Enter' || k === ' ') && ae && ae.matches && ae.matches('button, input, select, textarea, [role="switch"]');
  const game = PADCFG.mapGame(PADCFG.currentGame());
  const inPlay = ['play', 'extraPlay', 'bunyoPlay', 'pakurisPlay', 'minePlay', 'slidePlay', 'wolfPlay'].includes(S.screen);
  if (game && inPlay) {
    const act = PADCFG.kbActionFor(game, k);
    if (act) {
      if (act === 'ok' && nativeOk) return;
      e.preventDefault();
      window.PADACT.gameAction(game, act);
      return;
    }
  }
  const act = PADCFG.kbActionFor('common', k);
  if (act) {
    if (act === 'ok' && nativeOk) return;
    e.preventDefault();
    if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
      if (typeof navMove === 'function') navMove({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[act]);
      return;
    }
    window.PADACT.commonAction(act);
  }
});
