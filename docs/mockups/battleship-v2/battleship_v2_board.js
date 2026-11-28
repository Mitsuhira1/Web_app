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
  if (st === 'hit' && burning) s += flatFlame(cx, cy, c);
  s += `<circle cx="${cx + 1}" cy="${cy + 1.5}" r="${c * 0.15}" fill="#1a0705" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="${c * 0.15}" fill="url(#rpeg${id})"/>`;
  return s;
}
const flame = (x, y, r) => `<ellipse cx="${x + r * .5}" cy="${y - r * 1.5}" rx="${r * .75}" ry="${r * .5}" fill="#3a3a3a" opacity=".45"/><ellipse cx="${x + r * .95}" cy="${y - r * 2.05}" rx="${r * .5}" ry="${r * .34}" fill="#3a3a3a" opacity=".28"/>` +
  `<path d="M${x - r * .7} ${y + r * .45} C${x - r * .95} ${y - r * .1} ${x - r * .6} ${y - r * .55} ${x - r * .45} ${y - r * .85} C${x - r * .3} ${y - r * .45} ${x - r * .2} ${y - r * .4} ${x - r * .1} ${y - r * .6} C${x - r * .05} ${y - r * 1.05} ${x + r * .15} ${y - r * 1.3} ${x + r * .1} ${y - r * 1.55} C${x + r * .55} ${y - r * 1.1} ${x + r * .55} ${y - r * .7} ${x + r * .45} ${y - r * .45} C${x + r * .65} ${y - r * .6} ${x + r * .75} ${y - r * .75} ${x + r * .72} ${y - r * .95} C${x + r * 1.05} ${y - r * .45} ${x + r * .95} ${y + r * .2} ${x + r * .6} ${y + r * .45}Z" fill="#f2581e"/>` +
  `<path d="M${x - r * .42} ${y + r * .45} C${x - r * .6} ${y} ${x - r * .3} ${y - r * .35} ${x - r * .15} ${y - r * .5} C${x - r * .05} ${y - r * .25} ${x + r * .05} ${y - r * .3} ${x + r * .1} ${y - r * .85} C${x + r * .45} ${y - r * .45} ${x + r * .6} ${y} ${x + r * .38} ${y + r * .45}Z" fill="#ffb13b"/>` +
  `<path d="M${x - r * .2} ${y + r * .45} C${x - r * .3} ${y + r * .1} ${x - r * .05} ${y - r * .1} ${x + r * .05} ${y - r * .3} C${x + r * .25} ${y} ${x + r * .3} ${y + r * .25} ${x + r * .18} ${y + r * .45}Z" fill="#ffeaa0"/>`;
// 盤に残る火(演出の火と同じ、平らな 3 色。1 コマ目の形)
function flatFlame(x, y, c) {
  const k = c / 38;
  const fl = (w, h, col, dx) => { const t = -h * k, l = -w * k / 2, rr = w * k / 2; return `<path d="M${x + l + dx} ${y + 2 * k} Q${x + l - 2 * k + dx} ${y + t * .45} ${x + dx} ${y + t} Q${x + rr * .3 + dx} ${y + t * .55} ${x + rr * .55 + dx} ${y + t * .6} Q${x + rr + 2 * k + dx} ${y + t * .3} ${x + rr + dx} ${y + 2 * k}Z" fill="${col}"/>`; };
  return `<ellipse cx="${x}" cy="${y + 3 * k}" rx="${11 * k}" ry="${5 * k}" fill="#1a0f0a" opacity=".55"/>` + fl(18, 24, '#d9431a', 0) + fl(13, 17, '#ff8a1e', .6 * k) + fl(7, 10, '#ffd23f', -.4 * k) +
    `<ellipse cx="${x + 5 * k}" cy="${y - 28 * k}" rx="${6 * k}" ry="${4.5 * k}" fill="#4a4440" opacity=".8"/>`;
}
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
const el = (style, html = '') => { const d = document.createElement('div'); d.style.cssText = 'opacity:0;' + style; d.innerHTML = html; fxLayer().appendChild(d); return d; };
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
    r.animate([{ transform: 'scale(.15)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 900, delay: i * 180, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.then(() => r.remove());
  }
}
// 命中: 閃光 → 火の玉 → 火の粉 → 煙
function explosion(x, y, big = 1, dl = 0) {
  const fl = el(`left:${x}px;top:${y}px;width:${90 * big}px;height:${90 * big}px;margin:${-45 * big}px;border-radius:50%;background:radial-gradient(#fffbe8 0%,#ffe9a8 25%,#ffb34733 60%,#0000 70%)`);
  fl.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 380, delay: dl, easing: 'ease-out', fill: 'forwards' }).finished.then(() => fl.remove());
  const ring = el(`left:${x}px;top:${y}px;width:${110 * big}px;height:${110 * big}px;margin:${-55 * big}px;border-radius:50%;border:3px solid #fff4d6`);
  ring.animate([{ transform: 'scale(.1)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, delay: dl, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' }).finished.then(() => ring.remove());
  for (let i = 0; i < 5; i++) {
    const s = R(26, 42) * big, ox = R(-12, 12) * big, oy = R(-12, 8) * big;
    const b = el(`left:${x + ox}px;top:${y + oy}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:radial-gradient(#fff3b0 0%,#ffb13b 35%,#f0581c 65%,#a3200f00 72%)`);
    b.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 1, offset: .45 }, { transform: 'scale(1.5) translateY(-6px)', opacity: 0 }], { duration: 700 + i * 60, delay: dl + 40 + i * 40, easing: 'ease-out', fill: 'forwards' }).finished.then(() => b.remove());
  }
  for (let i = 0; i < 14; i++) {
    const a = R(0, Math.PI * 2), sp = R(30, 70) * big;
    const sk = el(`left:${x}px;top:${y}px;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:#ffd27a;box-shadow:0 0 4px #ff9b3a`);
    sk.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * sp}px,${Math.sin(a) * sp + 18}px)`, opacity: 0 }], { duration: R(500, 800), delay: dl + 60, easing: 'cubic-bezier(.1,.7,.4,1)', fill: 'forwards' }).finished.then(() => sk.remove());
  }
  for (let i = 0; i < 4; i++) {
    const s = R(30, 44) * big;
    const sm = el(`left:${x + R(-8, 8)}px;top:${y}px;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:radial-gradient(#4a4a4acc,#2a2a2a66 55%,#0000 72%)`);
    sm.animate([{ transform: 'translate(0,0) scale(.3)', opacity: 0 }, { transform: 'translate(0,-10px) scale(.8)', opacity: .9, offset: .3 }, { transform: `translate(${R(-14, 14)}px,-46px) scale(1.6)`, opacity: 0 }], { duration: 1500, delay: dl + 260 + i * 120, easing: 'ease-out', fill: 'forwards' }).finished.then(() => sm.remove());
  }
}
// 命中の後に残る火(ゆらぐ)
function persistentFire(k) {
  const [x, y] = cellC(k);
  const f = el(`left:${x - 19}px;top:${y - 19}px;width:38px;height:38px`, `<svg width="38" height="38" viewBox="0 0 38 38"><defs>${DEFS('pf' + k)}</defs>${mark('hit', 19, 19, 38, 'pf' + k, true)}</svg>`);
  f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
  const fl = f.querySelector('path');
  return f;
}
// ---- 共通: 放物線(重力)で動くキーフレーム
function para(vx, vy, g, T, n = 12) {
  const ks = [];
  for (let i = 0; i <= n; i++) { const t = (T / 1000) * i / n; ks.push({ x: vx * t, y: vy * t + g * t * t / 2, o: i / n }); }
  return ks;
}
const fly = (d, path, opts, fade = [1, 1, 0]) => d.animate(path.map((p, i) => ({ transform: `translate(${p.x}px,${p.y}px)`, opacity: i === path.length - 1 ? fade[2] : i === 0 ? fade[0] : fade[1], offset: p.o })), Object.assign({ fill: 'forwards', easing: 'linear' }, opts));
const gone = (a, d) => a.finished.then(() => d.remove());

// ================================================================ 手描き風の演出(コマ送り)
// 参考にした考え方(手描きエフェクトの定石):
//  ・水や炎は、柔らかいぼかしではなく、単純な形+平らな 2〜3 色で描く(白・水色・影の青)
//  ・1 秒 12 コマのコマ送りにする(なめらかに伸び縮みさせると、機械的に見える)
//  ・水は真上でなく「上と外へ」弧を描き、頂上で外へ折れ返る。粒は本体と同じ勢いで飛ぶ
//  ・消える時は薄くするのではなく、小さな塊に割れて小さくなって消える。落ちた所に小さなしぶき
//  ・着水した所には、平らな泡の輪がしばらく残る
const FPS = 12, FR = 1000 / FPS;
const W1 = '#ffffff', W2 = '#d6effc', W3 = '#86c3e6', WL = '#1d5f8a'; // 水: 白・水色・影・ふち
// 決まった乱数(同じ形を何度でも描ける)
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// でこぼこの丸(手描きの泡・煙の形)
function blobPath(cx, cy, rx, ry, jag, n, rnd) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 - jag / 2 + rnd() * jag;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M${m[0].toFixed(1)} ${m[1].toFixed(1)}` : '';
    const r = pts[(i + 1) % n], s2 = pts[(i + 2) % n];
    d += ` Q${r[0].toFixed(1)} ${r[1].toFixed(1)} ${((r[0] + s2[0]) / 2).toFixed(1)} ${((r[1] + s2[1]) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}
// しずく(進む向きに尖る)
function drop(x, y, r, ang, fill = W1, edge = WL) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const tip = [x + c * r * 1.6, y + s * r * 1.6];
  const l = [x - s * r, y + c * r], rr = [x + s * r, y - c * r], back = [x - c * r, y - s * r];
  return `<path d="M${tip[0].toFixed(1)} ${tip[1].toFixed(1)} Q${rr[0].toFixed(1)} ${rr[1].toFixed(1)} ${back[0].toFixed(1)} ${back[1].toFixed(1)} Q${l[0].toFixed(1)} ${l[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Z" fill="${fill}" stroke="${edge}" stroke-width=".9" stroke-opacity=".55"/>`;
}
// コマ送り: frames(SVG の中身)を、delay から 1 コマずつ出す
function flip(x, y, w, h, frames, delay = 0, hold = 1) {
  const n = frames.length, D = n * hold * FR;
  const box = el(`opacity:1;left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px`);
  frames.forEach((f, i) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;opacity:0';
    d.innerHTML = `<svg width="${w}" height="${h}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" style="overflow:visible;display:block">${f}</svg>`;
    box.appendChild(d);
    const a = i / n, b = (i + 1) / n;
    const ks = [{ opacity: 0, offset: 0, easing: 'step-end' }];
    if (a > 0) ks.push({ opacity: 1, offset: a, easing: 'step-end' }); else ks[0].opacity = 1;
    ks.push({ opacity: 0, offset: b, easing: 'step-end' });
    if (b < 1) ks.push({ opacity: 0, offset: 1 });
    d.animate(ks, { duration: D, delay, fill: 'forwards' });
  });
  return D;
}
// 動き(位置)もコマ送り: pts は [{x,y}] を 1 コマごとに
function stepMove(d, pts, delay) {
  const n = pts.length;
  d.animate(pts.map((p, i) => ({ transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)${p.r != null ? ` rotate(${p.r}deg)` : ''}`, opacity: p.o == null ? 1 : p.o, offset: i / (n - 1), easing: 'step-end' })), { duration: (n - 1) * FR, delay, fill: 'forwards' });
}

// ---------------------------------------------------------------- 水柱(外れ)
// 1 コマごとに描いた絵(12 コマ ≒ 1 秒)。原点は着水点。上が -y。
// 水柱は「ひとかたまりの白い水」: 根元が細く、上へ広がり、てっぺんはもこもこ(大小のこぶ)。
// 中に水色の影と、上と外へ流れるすじを少し入れる。頂上のこぶは外へちぎれ、崩れる時は両肩が外へ垂れる。
function columnFrames(seed) {
  const fr = [];
  let clipN = 0;
  const r = rng(seed);
  const LUMPS = Array.from({ length: 7 }, (_, i) => ({ h: .55 + r() * .6 + (i === 3 ? .5 : i === 2 || i === 4 ? .25 : 0), w: .8 + r() * .5 }));
  // 外形: H 高さ、Wb 根元の幅、Wt 頂上の幅、lump こぶの高さ、droop 両肩の垂れ
  const outline = (H, Wb, Wt, lump, droop) => {
    const tw = Wt / 2, bw = Wb / 2;
    const shL = [-tw - droop * 10, -H * .78 + droop * 22], shR = [tw + droop * 10, -H * .78 + droop * 22];
    let d = `M${-bw} 3 C${-bw - 2} ${-H * .3} ${-tw * .7} ${-H * .55} ${shL[0].toFixed(1)} ${shL[1].toFixed(1)}`;
    // 左肩から右肩へ、こぶを 7 つ
    const sum = LUMPS.reduce((s, l) => s + l.w, 0);
    let x = shL[0], y = shL[1];
    LUMPS.forEach((l, i) => {
      const w = (shR[0] - shL[0]) * l.w / sum;
      const t = (i + 1) / LUMPS.length;
      const nx = x + w, ny = shL[1] + (shR[1] - shL[1]) * t - Math.sin(t * Math.PI) * H * .22;
      const hh = w * .55 * l.h * lump + 2;
      d += ` C${(x - w * .05).toFixed(1)} ${(y - hh).toFixed(1)} ${(nx + w * .05).toFixed(1)} ${(ny - hh).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      x = nx; y = ny;
    });
    d += ` C${(tw * .7).toFixed(1)} ${(-H * .55).toFixed(1)} ${(bw + 2).toFixed(1)} ${(-H * .3).toFixed(1)} ${bw} 3Z`;
    return d;
  };
  const mass = (H, Wb, Wt, lump, droop) => {
    const d = outline(H, Wb, Wt, lump, droop);
    // 影(水色)は全体、光(白)は左上に寄せた一回り小さい形、すじは上と外へ
    const hi = outline(H * .9, Wb * .6, Wt * .78, lump * .9, droop);
    let s = `<path d="${d}" fill="${W2}" stroke="${WL}" stroke-width="1.2" stroke-linejoin="round"/>`;
    s += `<g transform="translate(${-Wt * .07} ${-H * .06})"><path d="${hi}" fill="${W1}"/></g>`;
    // すじ: 本数は少なく、長さも位置もばらばらに。外形の中だけに描く
    const cid = `wc${seed}_${(clipN++)}`;
    s += `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">`;
    for (let i = 0; i < 3; i++) {
      const side = i === 1 ? .2 : i === 0 ? -1 : 1;
      const sx = side * Wb * (.1 + r() * .18), sy = -H * (.08 + r() * .25);
      const ex = side * Wt * (.2 + r() * .2), ey = -H * (.55 + r() * .25);
      s += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${(sx + (ex - sx) * .2).toFixed(1)} ${((sy + ey) / 2).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${W3}" stroke-width="${(1.4 + r() * 1.2).toFixed(1)}" stroke-linecap="round" opacity=".7"/>`;
    }
    s += `</g>`;
    return s;
  };
  // 頂上からちぎれて外へ飛ぶ丸いかたまり
  const chunks = (H, Wt, spread, fall, n = 6) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const x = side * (Wt * .3 + k * spread * .45 + r() * 6), y = -H - 4 + k * 8 + fall * (.5 + k * .4);
      const rr = 5.5 - k * 1.2 + r();
      s += `<path d="${blobPath(x, y, rr, rr * .9, .3, 8, r)}" fill="${W1}" stroke="${WL}" stroke-width=".9" stroke-opacity=".6"/>`;
    }
    return s;
  };
  const foam = (rx, ry, jag, k = 1) => `<path d="${blobPath(0, 0, rx, ry, jag, 14, r)}" fill="${W1}" stroke="${WL}" stroke-width="1" stroke-opacity=".45" opacity="${k}"/><path d="${blobPath(0, 1, rx * .55, ry * .5, jag, 10, r)}" fill="${W2}"/>`;
  const ring = (rad, w, o) => `<ellipse cx="0" cy="0" rx="${rad}" ry="${rad * .92}" fill="none" stroke="${W1}" stroke-width="${w}" opacity="${o}"/>`;
  const bits = (n, R, size) => { let s = ''; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = R * (.5 + r() * .5); s += `<path d="${blobPath(Math.cos(a) * d, Math.sin(a) * d * .8, size * (.6 + r() * .6), size * (.5 + r() * .5), .5, 7, r)}" fill="${W1}" stroke="${WL}" stroke-width=".8" stroke-opacity=".4"/>`; } return s; };
  // 0: 着水(くぼみと、まわりへ跳ねる小さな粒)
  fr.push(`<ellipse cx="0" cy="0" rx="15" ry="11" fill="#0a2b45" opacity=".5"/>` + (() => { let s = ''; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * .3; s += `<circle cx="${(Math.cos(a) * 9).toFixed(1)}" cy="${(Math.sin(a) * 7).toFixed(1)}" r="${(2 + r() * 1.5).toFixed(1)}" fill="${W1}" stroke="${WL}" stroke-width=".8"/>`; } return s; })());
  // 1〜4: 下が細く、上へ広がりながら伸びる(上へ行くほど遅い)
  fr.push(foam(19, 9, .4) + mass(34, 22, 30, .8, 0));
  fr.push(foam(22, 10, .4) + mass(74, 24, 46, 1, 0));
  fr.push(foam(25, 11, .4) + mass(100, 26, 58, 1.1, 0));
  fr.push(foam(27, 12, .4) + mass(110, 28, 64, 1.1, .1) + chunks(110, 64, 18, 0, 4));
  // 5〜7: 頂上がちぎれて外へ、両肩が外へ垂れ、重さで低く広がる
  fr.push(foam(30, 13, .4) + mass(94, 32, 66, .9, .5) + chunks(98, 66, 24, 10));
  fr.push(foam(33, 14, .45) + mass(64, 38, 64, .8, .9) + chunks(70, 62, 30, 24));
  fr.push(foam(36, 15, .5) + mass(32, 46, 56, .6, 1) + chunks(40, 54, 34, 30, 4));
  // 8〜11: 泡の山 → 平らな泡 → 割れて小さくなる。波紋が外へ
  fr.push(foam(35, 15, .55) + `<path d="${blobPath(0, -5, 20, 9, .5, 10, r)}" fill="${W1}" stroke="${WL}" stroke-width="1" stroke-opacity=".5"/>` + ring(30, 2.2, .8));
  fr.push(foam(30, 14, .6, .95) + bits(5, 32, 5) + ring(36, 2, .7));
  fr.push(bits(9, 28, 5.5) + `<path d="${blobPath(0, 0, 14, 8, .7, 9, r)}" fill="${W1}" opacity=".9"/>` + ring(42, 1.6, .55));
  fr.push(bits(7, 31, 3.5) + ring(47, 1.2, .4));
  fr.push(bits(4, 34, 2.5) + ring(51, 1, .25));
  return fr;
}
function waterColumn(k) {
  const [x, y] = cellC(k);
  const frames = columnFrames(k * 97 + 13);
  const T = flip(x, y + 6, 200, 300, frames, 0, 1);
  // 頂上から外へ飛ぶ粒(本体と同じ勢いで、上と外へ → 弧を描いて落ちる)。落ちた所に小さなしぶき
  const r = rng(k * 31 + 7);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const vx = side * (40 + r() * 60), vy = -(10 + r() * 45), g = 950, t0 = 5 + Math.floor(r() * 2);
    const sx = side * (6 + r() * 26), sy = -60 - r() * 40, sz = 1.6 + r() * 2;
    const n = 5 + Math.floor(r() * 2), pts = [];
    let landX = 0, landY = 0;
    for (let f = 0; f <= n; f++) {
      const t = f / FPS, px = sx + vx * t, py = sy + vy * t + g * t * t / 2;
      pts.push({ x: px, y: Math.min(py, 6 + r() * 4), o: f === n ? 0 : 1 });
      landX = px; landY = py;
    }
    const d = el(`left:${x}px;top:${y + 6}px;width:0;height:0`, `<svg width="1" height="1" style="overflow:visible;position:absolute">${drop(0, 0, sz, Math.atan2(vy, vx) + Math.PI)}</svg>`);
    stepMove(d, pts, t0 * FR);
    d.animate([{ opacity: 0, easing: 'step-end' }, { opacity: 1, offset: .001, easing: 'step-end' }, { opacity: 1, offset: .999 }, { opacity: 0 }], { duration: n * FR, delay: t0 * FR, fill: 'forwards' });
  }
  // 最後に白いピン(盤の「外れ」の印)
  const peg = el(`left:${x - 19}px;top:${y - 19}px;width:38px;height:38px`, `<svg width="38" height="38" viewBox="0 0 38 38"><defs>${DEFS('pg' + k)}</defs>${mark('miss', 19, 19, 38, 'pg' + k, true)}</svg>`);
  peg.animate([{ opacity: 0, easing: 'step-end' }, { opacity: 1 }], { duration: 10, delay: T - 3 * FR, fill: 'forwards' });
  return T;
}

// ---------------------------------------------------------------- 爆発(平らな色のコマ送り)
const F1 = '#fff6d8', F2 = '#ffd23f', F3 = '#ff8a1e', F4 = '#d9431a', SM1 = '#4a4440', SM2 = '#6e6762', SM3 = '#8f8882';
function boomFrames(seed, s = 1) {
  const r = rng(seed), fr = [];
  const ball = (R, cols, jag, dy = 0) => cols.map((c, i) => `<path d="${blobPath((r() - .5) * 3 * s, dy - i * 1.5 * s, R * (1 - i * .27) * s, R * (1 - i * .27) * .92 * s, jag, 11, r)}" fill="${c}"/>`).join('');
  const spikes = (R, n) => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * .3, L = R * (1.4 + r() * .7); d += `<path d="M${Math.cos(a - .18) * R * .6 * s} ${Math.sin(a - .18) * R * .6 * s} L${Math.cos(a) * L * s} ${Math.sin(a) * L * s} L${Math.cos(a + .18) * R * .6 * s} ${Math.sin(a + .18) * R * .6 * s}Z" fill="${F2}"/>`; } return d; };
  const smoke = (n, R, cols, dy, spread) => { let d = ''; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rr = spread * (.3 + r() * .7); d += `<path d="${blobPath(Math.cos(a) * rr * s, (Math.sin(a) * rr * .7 + dy) * s, R * (.6 + r() * .5) * s, R * (.55 + r() * .45) * s, .4, 9, r)}" fill="${cols[i % cols.length]}" stroke="#2a2420" stroke-width="1" stroke-opacity=".35"/>`; } return d; };
  fr.push(spikes(10, 8) + `<circle r="${11 * s}" fill="${F1}"/>`);
  fr.push(ball(19, [F4, F3, F2, F1], .35));
  fr.push(ball(24, [F4, F3, F2, F1], .45, -2));
  fr.push(smoke(4, 11, [SM1], -6, 14) + ball(22, [F4, F3, F2], .55, -4));
  fr.push(smoke(6, 12, [SM1, SM2], -10, 16) + ball(14, [F3, F2], .6, -6));
  fr.push(smoke(6, 13, [SM2, SM1], -15, 19) + ball(7, [F3, F2], .6, -8));
  fr.push(smoke(5, 12, [SM2, SM3], -20, 22));
  fr.push(smoke(5, 9, [SM3, SM2], -25, 25));
  fr.push(smoke(4, 6, [SM3], -30, 27));
  fr.push(smoke(3, 3.5, [SM3], -34, 29));
  return fr;
}
function flatBoom(x, y, delay, seed, s = 1) {
  const D = flip(x, y, 160, 160, boomFrames(seed, s), delay);
  // 破片(短い線)がコマ送りで飛ぶ
  const r = rng(seed + 5);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, v = 60 + r() * 60, pts = [];
    for (let f = 0; f <= 5; f++) { const t = f / FPS; pts.push({ x: Math.cos(a) * v * t, y: Math.sin(a) * v * t + 120 * t * t, r: a * 57 + f * 40, o: f === 5 ? 0 : 1 }); }
    const d = el(`left:${x}px;top:${y}px;width:0;height:0`, `<div style="position:absolute;width:6px;height:2.5px;margin:-1px -3px;background:#2a1d14;border-radius:1px"></div>`);
    stepMove(d, pts, delay + FR);
    d.animate([{ opacity: 0, easing: 'step-end' }, { opacity: 1, offset: .01, easing: 'step-end' }, { opacity: 1, offset: .99 }, { opacity: 0 }], { duration: 5 * FR, delay: delay + FR, fill: 'forwards' });
  }
  return D;
}
// 燃え続ける火(3 コマを繰り返す)
function fireLoop(x, y, from, until, seed) {
  const r = rng(seed), frames = [];
  for (let f = 0; f < 3; f++) {
    const fl = (w, h, c, dx) => { const t = -h, l = -w / 2, rr = w / 2; return `<path d="M${l + dx} 2 Q${l - 2 + dx} ${t * .45} ${dx + (r() - .5) * 4} ${t} Q${rr * .3 + dx} ${t * .55} ${rr * .55 + dx} ${t * .6} Q${rr + 2 + dx} ${t * .3} ${rr + dx} 2Z" fill="${c}"/>`; };
    frames.push(`<ellipse cx="0" cy="3" rx="11" ry="5" fill="#1a0f0a" opacity=".55"/>` + fl(18, 22 + r() * 6, F4, 0) + fl(13, 16 + r() * 5, F3, (r() - .5) * 2) + fl(7, 9 + r() * 4, F2, (r() - .5) * 2) +
      `<path d="${blobPath(4 + f * 2, -28 - f * 3, 6, 4.5, .4, 8, r)}" fill="${SM1}" opacity=".85"/>`);
  }
  const box = el(`opacity:1;left:${x - 30}px;top:${y - 40}px;width:60px;height:60px`);
  const loops = Math.max(1, Math.ceil((until - from) / (3 * FR)));
  frames.forEach((f, i) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;opacity:0';
    d.innerHTML = `<svg width="60" height="60" viewBox="-30 -40 60 60" style="overflow:visible">${f}</svg>`;
    box.appendChild(d);
    const ks = [];
    for (let L = 0; L < loops; L++) for (let j = 0; j < 3; j++) ks.push({ opacity: j === i ? 1 : 0, offset: (L * 3 + j) / (loops * 3), easing: 'step-end' });
    ks.push({ opacity: 0, offset: 1 });
    d.animate(ks, { duration: loops * 3 * FR, delay: from, fill: 'forwards' });
  });
}

// ---------------------------------------------------------------- 撃沈
// 最後の 1 発 → 誘爆が艦の上を走る → 隠れていた船体が現れ、燃える → 艦尾から沈む
// (沈む境目に白い泡の帯がまとわりつき、帯の後ろは水の下の暗い影になる。艦首は少し持ち上がる)
// → 沈み切った所に泡が噴き、平らな泡の塊が割れて小さくなり、木片が漂い、油が残る → 盤の「沈んだ艦」の姿。
// 動きはすべて 1 秒 12 コマ。
function sink(cells, idx, lastK) {
  const xs = cells.map((k) => k % 10), ys = cells.map((k) => Math.floor(k / 10));
  const horiz = ys[0] === ys[ys.length - 1], len = cells.length, L = len * EC;
  const cx = EX + (Math.min(...xs) + (horiz ? len / 2 : .5)) * EC, cy = EY + (Math.min(...ys) + (horiz ? .5 : len / 2)) * EC;
  const P = (lx, ly) => horiz ? [cx - L / 2 + lx, cy - EC / 2 + ly] : [cx + EC / 2 - ly, cy - L / 2 + lx];
  const order = cells.slice().sort((a, b) => a - b);
  cells.forEach((k) => { const m = document.querySelector(`.bs2 svg [data-k="${k}"]`); if (m) m.animate([{ opacity: 1, easing: 'step-end' }, { opacity: 0 }], { duration: FR, fill: 'forwards' }); });
  // 1) 爆発: 当たった所 → 両端へ 2 コマずつずれて誘爆
  const li = Math.max(0, order.indexOf(lastK));
  order.forEach((k, i) => { const [x, y] = cellC(k); flatBoom(x, y, Math.abs(i - li) * 2 * FR, k * 13 + i, i === li ? 1.15 : .9); });
  const tReveal = 3 * FR, tSink = (len * 2 + 10) * FR, sinkFrames = len * 5 + 6, tUnder = tSink + sinkFrames * FR;
  // 2) 船体: 現れて、傾き(幅が少し細く)、艦尾から沈む。沈む位置 w(0..L)をコマごとに進める
  const hullPath = shipArt(len, idx, EC, false, true, 'none').match(/<path d="([^"]*)"/)[1];
  const art = shipArt(len, idx, EC, false, true, 'url(#hullsk2)');
  const ww = horiz ? L : EC, wh = horiz ? EC : L;
  const frames = [];
  const r = rng(idx * 71 + cells[0]);
  for (let f = 0; f <= sinkFrames; f++) {
    const p = Math.min(1, f / (sinkFrames - 2));
    const w = L * Math.pow(p, 1.25) - 6;          // ここより艦尾側は水の下
    const lift = p > .55 ? Math.min(1, (p - .55) / .35) : 0;
    const beam = f === 0 ? 1 : .8;                 // 傾いて幅が細く見える
    let g = `<g transform="translate(0 ${EC / 2}) scale(1 ${beam}) translate(0 ${-EC / 2})">`;
    // 水の下の影(暗い船体の形)
    g += `<path d="${hullPath}" fill="#0d3350" opacity="${(.55 * (1 - p * .4)).toFixed(2)}"/>`;
    // 水の上に残っている部分
    g += `<clipPath id="cl${idx}_${f}"><rect x="${Math.max(0, w).toFixed(1)}" y="-20" width="${L + 40}" height="${EC + 40}"/></clipPath>`;
    g += `<g clip-path="url(#cl${idx}_${f})" transform="translate(${L} ${EC / 2}) scale(${1 + lift * .1}) translate(${-L} ${-EC / 2})">${art}<path d="${hullPath}" fill="#0b1c28" opacity="${(.18 + p * .3).toFixed(2)}"/></g>`;
    // 沈む境目にまとわりつく泡の帯(コマごとに形が変わる)
    if (f > 0 && w < L - 4) {
      const bx = Math.max(4, w + 2);
      g += `<path d="${blobPath(bx, EC / 2, 8 + r() * 3, EC * .62, .55, 12, r)}" fill="${W1}" stroke="${WL}" stroke-width="1" stroke-opacity=".5"/>`;
      g += `<path d="${blobPath(bx - 6, EC / 2 + (r() - .5) * 8, 5, EC * .3, .5, 9, r)}" fill="${W2}"/>`;
      for (let b = 0; b < 4; b++) g += `<circle cx="${(bx - 8 - r() * 22).toFixed(1)}" cy="${(EC * (.15 + r() * .7)).toFixed(1)}" r="${(1.8 + r() * 2.6).toFixed(1)}" fill="${W1}" stroke="${WL}" stroke-width=".8" stroke-opacity=".5"/>`;
    }
    frames.push(`<g transform="translate(${-ww / 2} ${-wh / 2})${horiz ? '' : ` translate(${EC} 0) rotate(90)`}">${g}</g></g>`);
  }
  const shipBox = el(`opacity:1;left:${cx - (ww + 60) / 2}px;top:${cy - (wh + 60) / 2}px;width:${ww + 60}px;height:${wh + 60}px`);
  shipBox.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${DEFS('sk2')}</defs></svg>`;
  // 現れてから沈み始めるまでは 1 枚目の絵(燃えている)
  const all = [frames[0], ...frames];
  all.forEach((f, i) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;opacity:0';
    d.innerHTML = `<svg width="${ww + 60}" height="${wh + 60}" viewBox="${-(ww + 60) / 2} ${-(wh + 60) / 2} ${ww + 60} ${wh + 60}" style="overflow:visible">${f}</svg>`;
    shipBox.appendChild(d);
    const a = i === 0 ? tReveal : tSink + (i - 1) * FR, b = i === 0 ? tSink : tSink + i * FR;
    d.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: a / b, easing: 'step-end' }, { opacity: 0, offset: 1 }], { duration: b, fill: 'forwards' });
  });
  // 3) 火: 各マスで燃え、そのマスが沈んだら消える(白い湯気が 3 コマ)
  order.forEach((k, i) => {
    const [x, y] = cellC(k);
    const pos = (i + .5) / len;
    const fUnder = Math.ceil(Math.pow(pos, 1 / 1.25) * (sinkFrames - 2));
    const tOff = tSink + fUnder * FR;
    fireLoop(x, y, tReveal + i * FR, tOff, k * 7);
    const rs = rng(k * 3 + 1);
    flip(x, y - 8, 70, 70, [0, 1, 2].map((j) => `<path d="${blobPath(0, -j * 7, 9 + j * 4, 7 + j * 3, .5, 9, rs)}" fill="${W1}" stroke="${WL}" stroke-width="1" stroke-opacity=".35" opacity="${1 - j * .25}"/>`), tOff, 1);
  });
  // 4) 沈み切った所: 泡が噴き、平らな泡の塊が割れて小さくなる(コマ送り)
  const fr2 = [];
  const rr = rng(cells[0] * 5 + 3);
  for (let f = 0; f < 12; f++) {
    let g = '';
    const k = f / 11;
    // 艦の跡の泡(小さなかけらの集まり。だんだん割れて小さくなる)
    const pieces = 5 + Math.floor(k * 9);
    for (let i = 0; i < pieces; i++) {
      const lx = (i + .5) / pieces * L + (rr() - .5) * 12, ly = EC / 2 + (rr() - .5) * EC * .55;
      const sz = EC * .3 * (1 - k * .7) * (.6 + rr() * .6);
      g += `<path d="${blobPath(lx, ly, sz * 1.2, sz, .55, 9, rr)}" fill="${W2}" stroke="${WL}" stroke-width=".9" stroke-opacity=".4"/><path d="${blobPath(lx - sz * .2, ly - sz * .2, sz * .5, sz * .4, .5, 7, rr)}" fill="${W1}"/>`;
    }
    // 噴き上がる泡(最初の数コマ)
    if (f < 6) for (let i = 0; i < 5; i++) g += `<circle cx="${(rr() * L).toFixed(1)}" cy="${(EC * (.15 + rr() * .7)).toFixed(1)}" r="${(2 + rr() * 3.5 * (1 - f / 6)).toFixed(1)}" fill="none" stroke="${W1}" stroke-width="1.4"/>`;
    // 外へ広がる波紋(少しでこぼこの細長い輪)
    g += `<path d="${blobPath(L / 2, EC / 2, L / 2 + 8 + f * 3, EC / 2 + 6 + f * 3, .1, 20, rr)}" fill="none" stroke="${W1}" stroke-width="${(1.8 - k * 1.2).toFixed(1)}" opacity="${(.7 - k * .6).toFixed(2)}"/>`;
    fr2.push(`<g transform="translate(${-ww / 2} ${-wh / 2})${horiz ? '' : ` translate(${EC} 0) rotate(90)`}">${g}</g>`);
  }
  flip(cx, cy, ww + 120, wh + 120, fr2, tUnder - FR, 2);
  // 5) 木片(漂う)と油(平らな暗い形)。残る物
  const ro = rng(cells[0] * 11 + 1);
  const oil = el(`left:${cx - (ww + 50) / 2}px;top:${cy - (wh + 50) / 2}px;width:${ww + 50}px;height:${wh + 50}px`,
    `<svg width="${ww + 50}" height="${wh + 50}" viewBox="${-(ww + 50) / 2} ${-(wh + 50) / 2} ${ww + 50} ${wh + 50}"><path d="${blobPath(0, 0, ww / 2 + 16, wh / 2 + 16, .25, 16, ro)}" fill="#071722" opacity=".28"/><path d="${blobPath(ww * .1, -wh * .05, ww / 3, wh / 3, .3, 12, ro)}" fill="#071722" opacity=".18"/></svg>`);
  oil.animate([{ opacity: 0, easing: 'step-end' }, { opacity: .6, offset: .5, easing: 'step-end' }, { opacity: 1 }], { duration: 6 * FR, delay: tUnder, fill: 'forwards' });
  for (let i = 0; i < 6; i++) {
    const [px, py] = P(ro() * L, EC * (.2 + ro() * .6));
    const w = 5 + ro() * 6, rot = ro() * 180, pts = [];
    const vx = (ro() - .5) * 10, vy = (ro() - .5) * 10;
    for (let f = 0; f <= 18; f++) pts.push({ x: vx * f / 18, y: vy * f / 18, r: rot + f * (ro() < .5 ? 2 : -2) });
    const d = el(`left:${px}px;top:${py}px;width:0;height:0`, `<div style="position:absolute;width:${w}px;height:3px;margin:-1.5px ${-w / 2}px;background:#6b4a2e;box-shadow:inset 0 -1px 0 #3b2716;border-radius:1px"></div>`);
    d.animate([{ opacity: 0, easing: 'step-end' }, { opacity: 1 }], { duration: 10, delay: tUnder + 2 * FR, fill: 'forwards' });
    stepMove(d.firstChild, pts, tUnder + 2 * FR);
  }
  // 6) 最後: 盤の「沈んだ艦」と同じ姿(2 コマで出す)
  const wreckEl = el(`left:${cx - ww / 2}px;top:${cy - wh / 2}px;width:${ww}px;height:${wh}px`,
    `<svg width="${ww}" height="${wh}" viewBox="0 0 ${ww} ${wh}" style="overflow:visible"><defs>${DEFS('wk')}</defs>${wreck(len, idx, EC, 'wk', horiz)}</svg>`);
  const tEnd = tUnder + 22 * FR;
  wreckEl.animate([{ opacity: 0, easing: 'step-end' }, { opacity: .5, offset: .5, easing: 'step-end' }, { opacity: 1 }], { duration: 2 * FR, delay: tEnd - 6 * FR, fill: 'forwards' });
  return tEnd;
}

window.__bs2fx = { incoming, waterColumn, explosion, persistentFire, sink, cellC, ripples };
})();
