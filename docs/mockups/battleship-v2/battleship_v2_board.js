// バトルシップ 盤面の見本(第 2 版・PC 版)。実際の対局画面の #boardwrap と側板に差し込む。
// window.__BS2 = { mode: 'battle' | 'place' | 'fx', fonts: { name: dataURL } } を先に入れておく。
(() => {
const MODE = (window.__BS2 && window.__BS2.mode) || 'battle';
const FONTS = (window.__BS2 && window.__BS2.fonts) || {};
const NAMES = ['戦艦', '巡洋艦', '駆逐艦', '駆逐艦', '潜水艦'];
const FLEET = [5, 4, 3, 3, 2];
const COLS = 'ABCDEFGHIJ';

// ---------------------------------------------------------------- 字と色
const css = `
${Object.entries(FONTS).map(([n, u]) => `@font-face{font-family:"${n.split('|')[0]}";font-weight:${n.split('|')[1] || 400};src:url(${u}) format("woff2")}`).join('\n')}
.bs2{position:absolute;inset:0;border-radius:18px;overflow:hidden;
  background:
    radial-gradient(120% 90% at 30% 0%, #3a4650 0%, #262e35 55%, #1b2127 100%);
  box-shadow:inset 0 0 0 1px #ffffff10, inset 0 2px 0 #ffffff14, 0 10px 30px #0006;
  font-family:"Zen Kaku Gothic New","Noto Sans CJK JP",sans-serif;color:#d9e2e8}
.bs2 .bs2-coord{font-family:"Barlow Condensed",sans-serif;font-weight:600;letter-spacing:0}
.bs2 .bs2-plate{position:absolute;display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;color:#c3cfd8;letter-spacing:.02em}
.bs2 .bs2-plate svg{flex:none}
.bs2 .bs2-plate .sub{font-weight:500;font-size:13px;color:#8a99a5;margin-left:2px}
.bs2 .bs2-roster{position:absolute;display:flex;align-items:flex-end;gap:14px}
.bs2 .bs2-rship{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
.bs2 .bs2-rship span{font-size:12px;font-weight:500;color:#8796a2;line-height:1}
.bs2 .bs2-rship.sunk span{color:#c46a5c}
.bs2 .bs2-mylist{position:absolute;display:grid;grid-template-columns:62px auto;row-gap:9px;column-gap:10px;align-items:center}
.bs2 .bs2-mylist span{font-size:13px;font-weight:700;color:#b5c2cc}
.bs2 .bs2-mylist span.sunk{color:#c46a5c}
.bs2 .bs2-fx{position:absolute;inset:0;pointer-events:none}
.bs2 .bs2-fx > *{position:absolute}
/* 側板(共通部品の中身だけ) */
.bs2-pips{display:inline-flex;gap:3px;vertical-align:-1px;margin-left:6px}
.bs2-pips i{display:block;width:13px;height:7px;border-radius:4px 2px 2px 4px;background:#7f93a3}
.bs2-pips i.off{background:none;box-shadow:inset 0 0 0 1.5px #c9b9b0}
.bs2-log{display:flex;flex-direction:column;gap:6px;font-size:14px}
.bs2-log .bs2-row{display:grid;grid-template-columns:54px 34px 1fr;align-items:center;gap:6px;color:var(--ink)}
.bs2-log .bs2-row .bs2-who{color:var(--sub);font-size:13px}
.bs2-log .bs2-row .bs2-cd{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:17px}
.bs2-log .bs2-row .bs2-res{display:flex;align-items:center;gap:6px;font-size:13px}
.bs2-log .bs2-row .bs2-res i{width:10px;height:10px;border-radius:50%;background:#dfe7ec;box-shadow:inset 0 0 0 1.5px #9aabb8}
.bs2-log .bs2-row .bs2-res i.hit{background:#d8342c;box-shadow:none}
.bs2-log .bs2-row .bs2-res i.sunk{background:#4a2a24;box-shadow:inset 0 0 0 2px #d8342c}
.bs2-log h4{margin:0 0 2px;font-size:12px;color:var(--sub);font-weight:700}
`;

// ---------------------------------------------------------------- 艦の絵(今の質感をそのまま使う)
function shipArt(len, idx, c, sunk, detail, fillRef) {
  const T = len * c, cy = c / 2;
  const slim = idx === 4;
  const ht = slim ? c * 0.28 : c * 0.17, hb = c - ht;
  const xs = c * 0.05, xb = T - c * 0.05;
  const hull = `M ${xs} ${ht + c * 0.05} L ${xb - c * 0.60} ${ht} Q ${xb - c * 0.04} ${ht + c * 0.02} ${xb} ${cy} Q ${xb - c * 0.04} ${hb - c * 0.02} ${xb - c * 0.60} ${hb} L ${xs} ${hb - c * 0.05} Q ${xs - c * 0.045} ${cy} ${xs} ${ht + c * 0.05} Z`;
  const ink = sunk ? '#2a1a16' : '#16283A';
  const struct = sunk ? '#3b2924' : '#2E4356';
  let s = `<path d="${hull}" fill="${fillRef}" stroke="${sunk ? '#22140f' : '#22384C'}" stroke-width="1.3"/>`;
  if (!sunk) s += `<path d="${hull}" fill="#D7E3EE" opacity=".26" transform="translate(${T / 2} ${cy}) scale(.88 .60) translate(${-T / 2} ${-cy})"/>`;
  const sw = Math.max(0.8, c * 0.045);
  const turret = (kx, dir) => {
    const x = kx * c, r = Math.max(1.7, c * 0.155);
    let t = '';
    if (detail) { const bl = c * 0.30, off = c * 0.05; t += `<g stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"><line x1="${x}" y1="${cy - off}" x2="${x + dir * bl}" y2="${cy - off}"/><line x1="${x}" y1="${cy + off}" x2="${x + dir * bl}" y2="${cy + off}"/></g>`; }
    return t + `<circle cx="${x}" cy="${cy}" r="${r}" fill="${struct}" stroke="${ink}" stroke-width="${Math.max(0.7, c * 0.028)}"/>`;
  };
  const bridge = (kx, w, h) => { const x = kx * c; let t = `<rect x="${x - w * c / 2}" y="${cy - h * c / 2}" width="${w * c}" height="${h * c}" rx="${c * 0.07}" fill="${struct}" stroke="${ink}" stroke-width="${Math.max(0.7, c * 0.028)}"/>`; if (detail) t += `<rect x="${x - w * c * 0.28}" y="${cy - h * c * 0.30}" width="${w * c * 0.56}" height="${h * c * 0.60}" rx="${c * 0.05}" fill="${struct}" stroke="${ink}" stroke-width="${Math.max(0.6, c * 0.02)}"/>`; return t; };
  const funnel = (kx) => `<ellipse cx="${kx * c}" cy="${cy}" rx="${c * 0.085}" ry="${c * 0.125}" fill="${struct}" stroke="${ink}" stroke-width="${Math.max(0.6, c * 0.022)}"/>`;
  if (detail && !slim) s += `<line x1="${c * 0.35}" y1="${cy}" x2="${xb - c * 0.85}" y2="${cy}" stroke="${ink}" stroke-width="${Math.max(0.6, c * 0.022)}" opacity=".30"/>`;
  if (idx === 0) s += turret(0.85, 1) + turret(1.75, 1) + bridge(3.02, 0.52, 0.40) + funnel(3.55) + turret(4.18, -1);
  else if (idx === 1) s += turret(0.80, 1) + turret(1.58, 1) + bridge(2.52, 0.46, 0.38) + turret(3.38, -1);
  else if (idx === 4) { s += `<rect x="${c * 0.78}" y="${cy - c * 0.17}" width="${c * 0.55}" height="${c * 0.34}" rx="${c * 0.10}" fill="${struct}" stroke="${ink}" stroke-width="${Math.max(0.7, c * 0.028)}"/>`; s += `<circle cx="${c * 0.42}" cy="${cy}" r="${Math.max(1.4, c * 0.075)}" fill="${struct}"/>`; }
  else s += turret(0.75, 1) + bridge(1.68, 0.40, 0.34) + funnel(2.32);
  return s;
}
const DEFS = (id) => `
<linearGradient id="hull${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9BFD2"/><stop offset=".5" stop-color="#5F7A90"/><stop offset="1" stop-color="#3D5A72"/></linearGradient>
<linearGradient id="wreck${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d5552"/><stop offset=".5" stop-color="#3e3734"/><stop offset="1" stop-color="#2a2422"/></linearGradient>
<linearGradient id="sea${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f5d86"/><stop offset=".55" stop-color="#174a70"/><stop offset="1" stop-color="#0f3555"/></linearGradient>
<radialGradient id="seaLight${id}" cx=".3" cy=".15" r=".9"><stop offset="0" stop-color="#7fc4ea" stop-opacity=".22"/><stop offset="1" stop-color="#7fc4ea" stop-opacity="0"/></radialGradient>
<pattern id="wave${id}" width="64" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 Q8 8 16 13 T32 13 T48 13 T64 13" fill="none" stroke="#bfe3ff" stroke-opacity=".07" stroke-width="1.2"/><path d="M-16 0 Q-8 -5 0 0 T16 0 T32 0 T48 0 T64 0" fill="none" stroke="#bfe3ff" stroke-opacity=".05" stroke-width="1"/></pattern>
<radialGradient id="glow${id}"><stop offset="0" stop-color="#ffb347" stop-opacity=".85"/><stop offset=".45" stop-color="#ff6a1f" stop-opacity=".45"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>
<radialGradient id="scorch${id}"><stop offset="0" stop-color="#120a06" stop-opacity=".75"/><stop offset="1" stop-color="#120a06" stop-opacity="0"/></radialGradient>
<radialGradient id="peg${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3eaef"/><stop offset="1" stop-color="#a9b8c3"/></radialGradient>
<radialGradient id="rpeg${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ff8c7a"/><stop offset=".55" stop-color="#d8342c"/><stop offset="1" stop-color="#8e1914"/></radialGradient>
<linearGradient id="sub${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#174a70" stop-opacity=".35"/><stop offset="1" stop-color="#0f3555" stop-opacity=".7"/></linearGradient>`;

// 盤(10×10)。o: { id, x, y, cell, labels, ships:[{idx,cells,sunk,hidden}], marks:{cell:'miss'|'hit'}, target, ghost, burning }
function board(o) {
  const c = o.cell, X = (k) => (k % 10) * c, Y = (k) => Math.floor(k / 10) * c, S = c * 10;
  const lp = o.labels ? Math.round(c * 0.6) : 0;
  let s = `<svg style="position:absolute;left:${o.x - lp}px;top:${o.y - lp}px;overflow:visible" width="${S + lp}" height="${S + lp}" viewBox="${-lp} ${-lp} ${S + lp} ${S + lp}"><defs>${DEFS(o.id)}</defs>`;
  // 縁(盤を「はめ込んだ」ように見せる)
  s += `<rect x="-5" y="-5" width="${S + 10}" height="${S + 10}" rx="7" fill="#11171c" stroke="#ffffff14"/>`;
  s += `<rect x="0" y="0" width="${S}" height="${S}" rx="3" fill="url(#sea${o.id})"/><rect x="0" y="0" width="${S}" height="${S}" rx="3" fill="url(#wave${o.id})"/><rect x="0" y="0" width="${S}" height="${S}" rx="3" fill="url(#seaLight${o.id})"/>`;
  if (o.labels) {
    for (let i = 0; i < 10; i++) {
      s += `<text class="bs2-coord" x="${i * c + c / 2}" y="${-lp * 0.32}" text-anchor="middle" font-size="${Math.round(c * 0.42)}" fill="#8fa2b0">${COLS[i]}</text>`;
      s += `<text class="bs2-coord" x="${-lp * 0.42}" y="${i * c + c * 0.66}" text-anchor="middle" font-size="${Math.round(c * 0.42)}" fill="#8fa2b0">${i + 1}</text>`;
    }
  }
  let gl = '';
  for (let i = 1; i < 10; i++) gl += `M${i * c} 0V${S}M0 ${i * c}H${S}`;
  s += `<path d="${gl}" stroke="#d6efff" stroke-opacity=".11" stroke-width="1"/>`;
  if (o.target != null) {
    const tx = X(o.target), ty = Y(o.target);
    s += `<rect x="0" y="${ty}" width="${S}" height="${c}" fill="#ffd37a" opacity=".07"/><rect x="${tx}" y="0" width="${c}" height="${S}" fill="#ffd37a" opacity=".07"/>`;
  }
  for (const sh of o.ships || []) {
    if (sh.hidden) continue;
    const xs = sh.cells.map((k) => k % 10), ys = sh.cells.map((k) => Math.floor(k / 10));
    const horiz = ys[0] === ys[ys.length - 1];
    const x0 = Math.min(...xs) * c, y0 = Math.min(...ys) * c, len = sh.cells.length;
    if (sh.sunk) { s += `<g transform="translate(${x0} ${y0})">${wreck(len, sh.idx, c, o.id, horiz)}</g>`; continue; }
    const art = shipArt(len, sh.idx, c, false, c >= 26, `url(#hull${o.id})`);
    const tf = horiz ? `translate(${x0} ${y0})` : `translate(${x0 + c} ${y0}) rotate(90)`;
    s += `<g transform="${tf}" data-ship="${sh.idx}">${art}</g>`;
  }
  for (const [k, st] of Object.entries(o.marks || {})) {
    if (st === 'sunk') continue;
    const cx = X(+k) + c / 2, cy = Y(+k) + c / 2;
    s += `<g data-k="${k}">${mark(st, cx, cy, c, o.id, o.burning !== false)}</g>`;
  }
  if (o.ghost) {
    const col = o.ghost.ok ? '#5fe08d' : '#ff6b6b';
    const xs = o.ghost.cells.map((k) => k % 10), ys = o.ghost.cells.map((k) => Math.floor(k / 10));
    const x0 = Math.min(...xs) * c, y0 = Math.min(...ys) * c, horiz = ys[0] === ys[ys.length - 1], len = o.ghost.cells.length;
    const w = horiz ? len * c : c, h = horiz ? c : len * c;
    s += `<rect x="${x0 + 1.5}" y="${y0 + 1.5}" width="${w - 3}" height="${h - 3}" rx="6" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="2" stroke-dasharray="6 4"/>`;
    const art = shipArt(len, o.ghost.idx, c, false, true, `url(#hull${o.id})`);
    s += `<g opacity=".72" transform="${horiz ? `translate(${x0} ${y0})` : `translate(${x0 + c} ${y0}) rotate(90)`}">${art}</g>`;
  }
  if (o.target != null) {
    const x = X(o.target), y = Y(o.target), k = c * 0.28, p = -2;
    const br = (ax, ay, dx, dy) => `M${ax + dx * k} ${ay}H${ax}V${ay + dy * k}`;
    s += `<path d="${br(x - p, y - p, 1, 1)}${br(x + c + p, y - p, -1, 1)}${br(x - p, y + c + p, 1, -1)}${br(x + c + p, y + c + p, -1, -1)}" fill="none" stroke="#ffcf4a" stroke-width="3" stroke-linecap="round"/>`;
    s += `<circle cx="${x + c / 2}" cy="${y + c / 2}" r="2.6" fill="#ffcf4a"/>`;
  }
  return s + '</svg>';
}
// 印: 外れ=白いピン+波紋、命中=焦げ跡+赤いピン+火
function mark(st, cx, cy, c, id, burning) {
  if (st === 'miss') return `<g><circle cx="${cx}" cy="${cy}" r="${c * 0.34}" fill="none" stroke="#e8f6ff" stroke-opacity=".22" stroke-width="1.2"/><circle cx="${cx + 1}" cy="${cy + 1.5}" r="${c * 0.15}" fill="#06223a" opacity=".45"/><circle cx="${cx}" cy="${cy}" r="${c * 0.15}" fill="url(#peg${id})"/></g>`;
  let s = `<circle cx="${cx}" cy="${cy}" r="${c * 0.48}" fill="url(#scorch${id})"/>`;
  if (st === 'hit' && burning) s += `<circle cx="${cx}" cy="${cy}" r="${c * 0.46}" fill="url(#glow${id})"/>` + flame(cx, cy - c * 0.06, c * 0.30);
  s += `<circle cx="${cx + 1}" cy="${cy + 1.5}" r="${c * 0.15}" fill="#1a0705" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="${c * 0.15}" fill="url(#rpeg${id})"/>`;
  return s;
}
const flame = (x, y, r) => `<ellipse cx="${x + r * .5}" cy="${y - r * 1.5}" rx="${r * .75}" ry="${r * .5}" fill="#3a3a3a" opacity=".45"/><ellipse cx="${x + r * .95}" cy="${y - r * 2.05}" rx="${r * .5}" ry="${r * .34}" fill="#3a3a3a" opacity=".28"/>` +
  `<path d="M${x - r * .7} ${y + r * .45} C${x - r * .95} ${y - r * .1} ${x - r * .6} ${y - r * .55} ${x - r * .45} ${y - r * .85} C${x - r * .3} ${y - r * .45} ${x - r * .2} ${y - r * .4} ${x - r * .1} ${y - r * .6} C${x - r * .05} ${y - r * 1.05} ${x + r * .15} ${y - r * 1.3} ${x + r * .1} ${y - r * 1.55} C${x + r * .55} ${y - r * 1.1} ${x + r * .55} ${y - r * .7} ${x + r * .45} ${y - r * .45} C${x + r * .65} ${y - r * .6} ${x + r * .75} ${y - r * .75} ${x + r * .72} ${y - r * .95} C${x + r * 1.05} ${y - r * .45} ${x + r * .95} ${y + r * .2} ${x + r * .6} ${y + r * .45}Z" fill="#f2581e"/>` +
  `<path d="M${x - r * .42} ${y + r * .45} C${x - r * .6} ${y} ${x - r * .3} ${y - r * .35} ${x - r * .15} ${y - r * .5} C${x - r * .05} ${y - r * .25} ${x + r * .05} ${y - r * .3} ${x + r * .1} ${y - r * .85} C${x + r * .45} ${y - r * .45} ${x + r * .6} ${y} ${x + r * .38} ${y + r * .45}Z" fill="#ffb13b"/>` +
  `<path d="M${x - r * .2} ${y + r * .45} C${x - r * .3} ${y + r * .1} ${x - r * .05} ${y - r * .1} ${x + r * .05} ${y - r * .3} C${x + r * .25} ${y} ${x + r * .3} ${y + r * .25} ${x + r * .18} ${y + r * .45}Z" fill="#ffeaa0"/>`;
// 沈んだ艦: 黒ずんだ船体が少し傾き、海の色をかぶり、まわりに油が浮く(演出の最後と同じ姿)
function wreck(len, idx, c, id, horiz) {
  const w = horiz ? len * c : c, h = horiz ? c : len * c;
  const art = shipArt(len, idx, c, true, c >= 26, `url(#wreck${id})`);
  const inner = horiz ? art : `<g transform="translate(${c} 0) rotate(90)">${art}</g>`;
  const hull = (horiz ? art : art).match(/<path d="([^"]*)"/)[1];
  const hullT = horiz ? `` : `translate(${c} 0) rotate(90)`;
  return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * .62}" ry="${h * .62}" fill="#08141c" opacity=".38"/>` +
    `<g transform="rotate(${horiz ? 4 : -4} ${w / 2} ${h / 2})">${inner}<g transform="${hullT}"><path d="${hull}" fill="#164466" opacity=".55"/></g></g>`;
}
// 艦隊の小さな絵(状態を形で見せる): unknown=輪郭だけ / ok / dmg(被弾マス) / sunk
function shipIcon(i, c, state, hits = []) {
  const len = FLEET[i], w = len * c;
  let s = `<svg width="${w}" height="${c}" viewBox="0 0 ${w} ${c}" style="overflow:visible"><defs>${DEFS('i' + i + state)}</defs>`;
  if (state === 'unknown') {
    const hull = shipArt(len, i, c, false, false, 'none').match(/<path d="([^"]*)"/)[1];
    s += `<path d="${hull}" fill="#ffffff08" stroke="#8ea2b2" stroke-width="1.2" stroke-dasharray="3 2.5"/>`;
  } else {
    s += shipArt(len, i, c, state === 'sunk', false, `url(#${state === 'sunk' ? 'wreck' : 'hull'}i${i}${state})`);
    for (const h of hits) s += `<circle cx="${h * c + c / 2}" cy="${c / 2}" r="${c * 0.24}" fill="#d8342c" stroke="#ffd9cf" stroke-width="1"/>`;
    if (state === 'sunk') s += `<path d="M${c * 0.2} ${c * 0.85} L${w - c * 0.2} ${c * 0.15}" stroke="#d8342c" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return s + '</svg>';
}
const icoScope = `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="none" stroke="#c3cfd8" stroke-width="1.6"/><path d="M9 0.5V5M9 13V17.5M0.5 9H5M13 9H17.5" stroke="#c3cfd8" stroke-width="1.6"/></svg>`;
const icoAnchor = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c3cfd8" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="3.4" r="1.9"/><path d="M9 5.3V16M5 8.2H13M2.6 11.2C3.4 14.2 6 16 9 16C12 16 14.6 14.2 15.4 11.2"/></svg>`;

// ---------------------------------------------------------------- 場面
// 敵の海域: 両者 14 発ずつ。駆逐艦(G8-G10)を撃沈、戦艦(B3-F3)に 2 発命中。
const enemyMarks = { 22: 'hit', 23: 'hit', 76: 'sunk', 86: 'sunk', 96: 'sunk', 44: 'miss', 45: 'miss', 55: 'miss', 11: 'miss', 67: 'miss', 88: 'miss', 31: 'miss', 13: 'miss', 58: 'miss', 70: 'miss', 92: 'miss', 19: 'hit', 29: 'hit', 39: 'hit' };
const enemyShips = [{ idx: 2, cells: [76, 86, 96], sunk: true }];
// 自分の艦隊: 戦艦 A1-E1(2 発)、巡洋艦 C3-C6、駆逐艦 H2-H4、駆逐艦 F8-H8(撃沈)、潜水艦 A9-B9
const myShips = [
  { idx: 0, cells: [0, 1, 2, 3, 4] }, { idx: 1, cells: [22, 32, 42, 52] }, { idx: 2, cells: [17, 27, 37] },
  { idx: 3, cells: [75, 76, 77], sunk: true }, { idx: 4, cells: [80, 81] }];
const myMarks = { 1: 'hit', 2: 'hit', 75: 'sunk', 76: 'sunk', 77: 'sunk', 5: 'miss', 14: 'miss', 44: 'miss', 48: 'miss', 59: 'miss', 63: 'miss', 91: 'miss', 98: 'miss', 39: 'miss', 66: 'miss' };

function battleScene() {
  let h = `<div class="bs2">`;
  h += `<div class="bs2-plate" style="left:44px;top:22px">${icoScope}敵の海域</div>`;
  h += board({ id: 'e', x: 66, y: 74, cell: 38, labels: true, ships: enemyShips, marks: enemyMarks, target: 46 });
  // 敵の艦隊(見つかっていない艦は輪郭だけ)
  const eState = ['dmgU', 'unknown', 'sunk', 'unknown', 'unknown'];
  h += `<div class="bs2-roster" style="left:66px;top:478px">${[0, 1, 2, 3, 4].map((i) => `<div class="bs2-rship ${eState[i] === 'sunk' ? 'sunk' : ''}">${shipIcon(i, 15, eState[i] === 'sunk' ? 'sunk' : 'unknown')}<span>${NAMES[i]}</span></div>`).join('')}</div>`;
  h += `<div class="bs2-plate" style="left:560px;top:22px">${icoAnchor}自分の艦隊</div>`;
  h += board({ id: 'o', x: 584, y: 74, cell: 25, labels: true, ships: myShips, marks: myMarks });
  const myState = [['dmg', [1, 2]], ['ok', []], ['ok', []], ['sunk', []], ['ok', []]];
  h += `<div class="bs2-mylist" style="left:584px;top:356px">${myState.map(([st, hits], i) => `<span class="${st === 'sunk' ? 'sunk' : ''}">${NAMES[i]}</span>${shipIcon(i, 22, st, hits)}`).join('')}</div>`;
  h += `<div class="bs2-fx" id="bs2fx"></div></div>`;
  return h;
}
function placeScene() {
  let h = `<div class="bs2">`;
  h += `<div class="bs2-plate" style="left:44px;top:22px">${icoAnchor}自分の海域</div>`;
  const placed = [{ idx: 0, cells: [12, 13, 14, 15, 16] }, { idx: 1, cells: [41, 51, 61, 71] }];
  h += board({ id: 'p', x: 66, y: 74, cell: 38, labels: true, ships: placed, marks: {}, ghost: { idx: 2, cells: [56, 57, 58], ok: true } });
  // ドック: 艦を盤と同じ縮尺で並べる
  h += `<div class="bs2-plate" style="left:520px;top:22px">ドック<span class="sub">残り 3 隻</span></div>`;
  const dockY = [92, 158, 224, 290, 356];
  const st = ['placed', 'placed', 'sel', '', ''];
  h += `<svg style="position:absolute;left:520px;top:74px" width="340" height="340" viewBox="0 0 340 340"><defs>${DEFS('d')}</defs>`;
  h += `<rect x="0" y="0" width="340" height="340" rx="10" fill="#151b20" stroke="#ffffff12"/>`;
  for (let k = 0; k < 6; k++) h += `<line x1="16" y1="${18 + k * 66}" x2="324" y2="${18 + k * 66}" stroke="#ffffff0d"/>`;
  [0, 1, 2, 3, 4].forEach((i) => {
    const y = 26 + i * 64, c = 34;
    const sel = st[i] === 'sel', done = st[i] === 'placed';
    if (sel) h += `<rect x="12" y="${y - 10}" width="316" height="${c + 20}" rx="8" fill="#ffcf4a14" stroke="#ffcf4a" stroke-width="2"/>`;
    h += `<g transform="translate(24 ${y})" opacity="${done ? .28 : 1}">${shipArt(FLEET[i], i, c, false, true, 'url(#hulld)')}</g>`;
    h += `<text x="316" y="${y + c * 0.68}" text-anchor="end" font-size="14" font-weight="700" fill="${done ? '#6f7f8b' : '#c3cfd8'}">${done ? '✓ ' : ''}${NAMES[i]}</text>`;
  });
  h += `</svg>`;
  // 操作の手がかり(絵で示す)
  const mouse = (btn) => `<svg width="16" height="22" viewBox="0 0 16 22"><rect x="1" y="1" width="14" height="20" rx="7" fill="none" stroke="#9fb0bd" stroke-width="1.5"/><path d="M8 1V9" stroke="#9fb0bd" stroke-width="1.5"/>${btn === 'L' ? '<path d="M1.8 8 V7 A6.2 6.2 0 0 1 7.3 1.8 V9 H1.8Z" fill="#ffcf4a"/>' : '<path d="M14.2 8 V7 A6.2 6.2 0 0 0 8.7 1.8 V9 H14.2Z" fill="#ffcf4a"/>'}</svg>`;
  h += `<div style="position:absolute;left:522px;top:432px;display:flex;flex-direction:column;gap:10px;font-size:14px;font-weight:500;color:#aebcc7">
    <div style="display:flex;align-items:center;gap:10px">${mouse('L')}ドラッグして海域に置く</div>
    <div style="display:flex;align-items:center;gap:10px">${mouse('R')}右クリックで縦・横を変える</div></div>`;
  h += `</div>`;
  return h;
}

// ---------------------------------------------------------------- 側板(共通部品の中身)
function sidePanel() {
  const $ = (s) => document.querySelector(s);
  const pips = (alive) => `<span class="bs2-pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < alive ? '' : 'off'}"></i>`).join('')}</span>`;
  const me = document.querySelector('#strip .pl .dot, #strip .pl .avatar');
  const meAv = me ? me.outerHTML : '<span class="dot face">あ</span>';
  const rows = MODE === 'place'
    ? [['あなた', meAv, `配置 <span class="num-f">2</span> / 5`, true], ['CPU', '<span class="dot face" style="background:#3a6bc5;color:#fff">C</span>', '配置 <span class="num-f">0</span> / 5', false]]
    : [['あなた', meAv, `残り 4 隻${pips(4)}`, true], ['CPU', '<span class="dot face" style="background:#3a6bc5;color:#fff">C</span>', `残り 4 隻${pips(4)}`, false]];
  $('#strip').innerHTML = rows.map(([n, av, d, t]) => `<div class="pl${t ? ' turn' : ''}">${av}<span class="who"><span class="nm">${n}</span><span class="nt">${d}</span></span></div>`).join('');
  $('#status').textContent = MODE === 'place' ? '駆逐艦を置く場所を選んでください' : '撃つマスを選んでください';
  const sn = $('#sidenote');
  sn.classList.add('custom');
  sn.innerHTML = MODE === 'place' ? '' : `<div class="bs2-log"><h4>最近の砲撃</h4>
    <div class="bs2-row"><span class="bs2-who">CPU</span><span class="bs2-cd">G9</span><span class="bs2-res"><i></i>外れ</span></div>
    <div class="bs2-row"><span class="bs2-who">あなた</span><span class="bs2-cd">G10</span><span class="bs2-res"><i class="sunk"></i>撃沈 駆逐艦</span></div>
    <div class="bs2-row"><span class="bs2-who">CPU</span><span class="bs2-cd">H8</span><span class="bs2-res"><i class="sunk"></i>撃沈 駆逐艦</span></div>
    <div class="bs2-row"><span class="bs2-who">あなた</span><span class="bs2-cd">G9</span><span class="bs2-res"><i class="hit"></i>命中</span></div></div>`;
  const acts = $('#acts');
  acts.innerHTML = MODE === 'place'
    ? `<button class="btn">向きを変える</button><button class="btn gold">ここに置く</button>`
    : `<button class="btn gold"><span style="font-family:'Barlow Condensed';font-weight:700;font-size:18px;margin-right:4px">G5</span>へ発射</button>`;
  $('#hround').innerHTML = `<span class="hchip">${MODE === 'place' ? '配置' : '攻撃'}</span>`;
}

// ---------------------------------------------------------------- 差し込み
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const wrap = document.getElementById('boardwrap');
const W = 900, H = 560;
const ns = Math.min((wrap.clientWidth - 10) / W, (wrap.clientHeight - 10) / H);
wrap.innerHTML = `<div class="nine-scene" style="width:${W}px;height:${H}px;--ns:${ns}">${MODE === 'place' ? placeScene() : battleScene()}</div>`;
sidePanel();

// ---------------------------------------------------------------- 演出(fx): 水柱・命中・撃沈
// 敵の海域の座標(場面の中の px)
const EC = 38, EX = 66, EY = 74;
const cellC = (k) => [EX + (k % 10) * EC + EC / 2, EY + Math.floor(k / 10) * EC + EC / 2];
const fxLayer = () => document.getElementById('bs2fx');
const el = (style, html = '') => { const d = document.createElement('div'); d.style.cssText = style; d.innerHTML = html; fxLayer().appendChild(d); return d; };
const R = (a, b) => a + Math.random() * (b - a);
// 砲弾が落ちてくる影(だんだん小さく濃く)
function incoming(k, ms = 520) {
  const [x, y] = cellC(k);
  const d = el(`left:${x}px;top:${y}px;width:46px;height:46px;margin:-23px;border-radius:50%;background:radial-gradient(#00000088,#0000 70%)`);
  return d.animate([{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(.35)', opacity: 1 }], { duration: ms, easing: 'ease-in', fill: 'forwards' }).finished.then(() => d.remove());
}
// 波紋
function ripples(x, y, n = 3, size = 60) {
  for (let i = 0; i < n; i++) {
    const r = el(`left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px;border-radius:50%;border:2px solid #e8f6ffcc`);
    r.animate([{ transform: 'scale(.15)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 900, delay: i * 180, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).finished.then(() => r.remove());
  }
}
// 水柱(外れ): 白い柱が立ち上がって崩れ、しぶきが散り、波紋が広がる
function waterColumn(k) {
  const [x, y] = cellC(k);
  const col = el(`left:${x - 20}px;top:${y - 96}px;width:40px;height:100px;transform-origin:50% 100%`,
    `<svg width="40" height="100" viewBox="0 0 26 74" preserveAspectRatio="none"><defs><linearGradient id="wc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".7" stop-color="#d9f1ff" stop-opacity=".9"/><stop offset="1" stop-color="#9fd4f5" stop-opacity=".5"/></linearGradient></defs>
    <path d="M3 74 C5 50 7 28 9 12 C10 5 12 2 13 0 C14 2 16 5 17 12 C19 28 21 50 23 74Z" fill="url(#wc)"/>
    <circle cx="6" cy="16" r="2.6" fill="#fff"/><circle cx="20" cy="10" r="2.2" fill="#fff"/><circle cx="13" cy="4" r="2.4" fill="#fff"/></svg>`);
  col.animate([
    { transform: 'scaleY(.05) scaleX(.6)', opacity: 1 },
    { transform: 'scaleY(1.05) scaleX(1)', opacity: 1, offset: .35 },
    { transform: 'scaleY(.9) scaleX(1.25)', opacity: .9, offset: .6 },
    { transform: 'scaleY(.2) scaleX(1.7)', opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.4,1)', fill: 'both' }).finished.then(() => col.remove());
  for (let i = 0; i < 12; i++) {
    const a = R(-Math.PI * .95, -Math.PI * .05), sp = R(28, 62), s = R(3, 6);
    const dp = el(`left:${x}px;top:${y - 40}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:#f2fbff`);
    dp.animate([{ transform: 'translate(0,0)', opacity: 0 }, { transform: `translate(${Math.cos(a) * sp * .5}px,${Math.sin(a) * sp * .5 - 10}px)`, opacity: 1, offset: .3 },
      { transform: `translate(${Math.cos(a) * sp}px,${Math.sin(a) * sp * .2 + 40}px)`, opacity: 0 }], { duration: 1000, delay: 260, easing: 'ease-out', fill: 'both' }).finished.then(() => dp.remove());
  }
  setTimeout(() => ripples(x, y, 3, 64), 350);
}
// 命中: 閃光 → 火の玉 → 火の粉 → 煙
function explosion(x, y, big = 1) {
  const fl = el(`left:${x}px;top:${y}px;width:${90 * big}px;height:${90 * big}px;margin:${-45 * big}px;border-radius:50%;background:radial-gradient(#fffbe8 0%,#ffe9a8 25%,#ffb34733 60%,#0000 70%)`);
  fl.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'both' }).finished.then(() => fl.remove());
  const ring = el(`left:${x}px;top:${y}px;width:${110 * big}px;height:${110 * big}px;margin:${-55 * big}px;border-radius:50%;border:3px solid #fff4d6`);
  ring.animate([{ transform: 'scale(.1)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'both' }).finished.then(() => ring.remove());
  for (let i = 0; i < 5; i++) {
    const s = R(26, 42) * big, ox = R(-12, 12) * big, oy = R(-12, 8) * big;
    const b = el(`left:${x + ox}px;top:${y + oy}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:radial-gradient(#fff3b0 0%,#ffb13b 35%,#f0581c 65%,#a3200f00 72%)`);
    b.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 1, offset: .45 }, { transform: 'scale(1.5) translateY(-6px)', opacity: 0 }], { duration: 700 + i * 60, delay: 40 + i * 40, easing: 'ease-out', fill: 'both' }).finished.then(() => b.remove());
  }
  for (let i = 0; i < 14; i++) {
    const a = R(0, Math.PI * 2), sp = R(30, 70) * big;
    const sk = el(`left:${x}px;top:${y}px;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:#ffd27a;box-shadow:0 0 4px #ff9b3a`);
    sk.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * sp}px,${Math.sin(a) * sp + 18}px)`, opacity: 0 }], { duration: R(500, 800), delay: 60, easing: 'cubic-bezier(.1,.7,.4,1)', fill: 'both' }).finished.then(() => sk.remove());
  }
  for (let i = 0; i < 4; i++) {
    const s = R(30, 44) * big;
    const sm = el(`left:${x + R(-8, 8)}px;top:${y}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:radial-gradient(#4a4a4acc,#2a2a2a66 55%,#0000 72%)`);
    sm.animate([{ transform: 'translate(0,0) scale(.3)', opacity: 0 }, { transform: 'translate(0,-10px) scale(.8)', opacity: .9, offset: .3 }, { transform: `translate(${R(-14, 14)}px,-46px) scale(1.6)`, opacity: 0 }], { duration: 1500, delay: 260 + i * 120, easing: 'ease-out', fill: 'both' }).finished.then(() => sm.remove());
  }
}
// 命中の後に残る火(ゆらぐ)
function persistentFire(k) {
  const [x, y] = cellC(k);
  const f = el(`left:${x - 19}px;top:${y - 19}px;width:38px;height:38px`, `<svg width="38" height="38" viewBox="0 0 38 38"><defs>${DEFS('pf' + k)}</defs>${mark('hit', 19, 19, 38, 'pf' + k, true)}</svg>`);
  f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
  const fl = f.querySelector('path');
  return f;
}
// 撃沈: 艦の上で連続して爆ぜ、船体が見え、傾いて沈み、泡と油が残る
function sink(cells, idx) {
  const xs = cells.map((k) => k % 10), ys = cells.map((k) => Math.floor(k / 10));
  const horiz = ys[0] === ys[ys.length - 1], len = cells.length;
  const x0 = EX + Math.min(...xs) * EC, y0 = EY + Math.min(...ys) * EC;
  const w = horiz ? len * EC : EC, h = horiz ? EC : len * EC;
  cells.forEach((k, i) => setTimeout(() => { const [x, y] = cellC(k); explosion(x, y, .8); }, i * 220));
  const shipBox = el(`left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;transform-origin:50% 50%;opacity:0`,
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible"><defs>${DEFS('sk')}</defs><g transform="${horiz ? '' : `translate(${EC} 0) rotate(90)`}">${shipArt(len, idx, EC, false, true, 'url(#hullsk)')}</g></svg>`);
  const wreckEl = el(`left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;opacity:0`,
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible"><defs>${DEFS('wk')}</defs>${wreck(len, idx, EC, 'wk', horiz)}</svg>`);
  const t0 = len * 220 + 200;
  cells.forEach((k) => { const m = document.querySelector(`.bs2 svg [data-k="${k}"]`); if (m) m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: t0 + 300, fill: 'forwards' }); });
  shipBox.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, fill: 'forwards' });
  // 傾いて沈む(少し回り、小さくなり、暗くなる)
  shipBox.animate([{ transform: 'rotate(0) scale(1)', opacity: 1 },
    { transform: `rotate(${horiz ? 3 : -3}deg) scale(.97)`, opacity: 1, offset: .35 },
    { transform: `rotate(${horiz ? 7 : -7}deg) scale(.9) translate(2px,3px)`, opacity: 0 }], { duration: 1700, delay: t0 + 300, easing: 'ease-in', fill: 'forwards' });
  wreckEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: t0 + 1300, fill: 'forwards' });
  // 泡
  for (let i = 0; i < 18; i++) {
    const s = R(3, 7), px = x0 + R(4, w - 4), py = y0 + R(4, h - 4);
    const bb = el(`left:${px}px;top:${py}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;border:1.5px solid #e8f6ffcc`);
    bb.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: .4 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: R(500, 900), delay: t0 + 600 + R(0, 1300), fill: 'both' }).finished.then(() => bb.remove());
  }
  // 油の広がり
  const oil = el(`left:${x0 + w / 2}px;top:${y0 + h / 2}px;width:${w + 30}px;height:${h + 30}px;margin:${-(h + 30) / 2}px 0 0 ${-(w + 30) / 2}px;border-radius:50%;background:radial-gradient(#0b1a24aa,#0b1a2400 70%)`);
  oil.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: .8 }], { duration: 1600, delay: t0 + 800, easing: 'ease-out', fill: 'both' });
  setTimeout(() => ripples(x0 + w / 2, y0 + h / 2, 2, Math.max(w, h) + 40), t0 + 1200);
}
window.__bs2fx = { incoming, waterColumn, explosion, persistentFire, sink, cellC, ripples };
})();
