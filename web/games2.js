// 盤ゲームの続き(ドット＆ボックス・ヒット＆ブロー・ウサギと猟犬・チャイニーズチェッカー・ルドー・バックギャモン・碁・ヨット系)
import { pair, stone, defsStones, BW, GOLD } from "./games.js";

const SEAT_COL = ["#C8463C", "#3F78C4", "#3E9B63", "#E0AD4A", "#7A5AC0", "#2A2A30"];

// ------------------------------------------------------------ ドット＆ボックス
function dots(b, A) {
  pair(A, "赤", "#C8463C", "青", "#3F78C4", b.score);
  const legal = new Set(A.view.human ? A.view.legal : []);
  const n = b.n, K = 14, M = 9, size = M * 2 + n * K;
  const col = (e) => (b.edgeBy[e] === 0 ? "#C8463C" : "#3F78C4");
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="ドット＆ボックスの盤"><rect width="${size}" height="${size}" rx="3" fill="#E3C48A"/>`;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const o = b.owner[r * n + c]; if (o >= 0) s += `<rect x="${M + c * K + 1}" y="${M + r * K + 1}" width="${K - 2}" height="${K - 2}" fill="${o === 0 ? "#C8463C" : "#3F78C4"}" opacity=".35"/>`; }
  const hEdge = (r, c) => r * n + c, vEdge = (r, c) => n * (n + 1) + r * (n + 1) + c;
  const line = (e, x1, y1, x2, y2) => {
    const d = b.edgeBy[e] >= 0;
    let t = `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${d ? col(e) : "#B89862"}" stroke-width="${d ? 1.8 : 0.5}" stroke-linecap="round"${d ? "" : ' stroke-dasharray="1 1.4"'}/>`;
    if (b.last === e) t += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${GOLD}" stroke-width=".7" opacity=".9"/>`;
    if (legal.has(e)) t += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="transparent" stroke-width="7" data-e="${e}"/>`;
    return t;
  };
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) s += line(hEdge(r, c), M + c * K, M + r * K, M + (c + 1) * K, M + r * K);
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) s += line(vEdge(r, c), M + c * K, M + r * K, M + c * K, M + (r + 1) * K);
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) s += `<circle cx="${M + c * K}" cy="${M + r * K}" r="1.4" fill="#5A3A22"/>`;
  s += "</svg>";
  A.board(s, (d) => { if (d.e != null && legal.has(+d.e)) A.play(+d.e); });
}

// ------------------------------------------------------------ ヒット＆ブロー
function hitblow(b, A) {
  const me = A.mySeat;
  const mkList = (seat, title) => {
    const g = b.guesses[seat] || [];
    const rows = g.map(([code, h, bl], i) => `<div class="hbrow"><span class="hbn">${i + 1}</span><span class="hbc">${String(code).padStart(b.digits, "0")}</span><span class="hbr"><i class="hit">${h}</i><i class="blow">${bl}</i></span></div>`).join("");
    return `<div class="hbcol"><div class="hbt">${title}</div>${rows || '<div class="hbe">まだありません</div>'}</div>`;
  };
  const turnSeat = A.view.toMove;
  A.strip(b.solo ? `<div class="pl turn"><span class="nm">ひとりで挑戦</span><span class="num">${(b.guesses[0] || []).length}回</span></div>`
    : `<div class="pl${turnSeat === me ? " turn" : ""}"><span class="nm">あなた</span></div><div class="pl${turnSeat !== me && turnSeat >= 0 ? " turn" : ""}"><span class="nm">CPU</span></div>`);
  const entered = A.sel || "";
  const human = A.view.human;
  const used = new Set(entered.split(""));
  let pad = `<div class="hbentry">${Array.from({ length: b.digits }, (_, i) => `<span class="hbd">${entered[i] ?? ""}</span>`).join("")}</div><div class="hbpad">`;
  for (let d = 0; d <= 9; d++) pad += `<button data-d="${d}" ${!human || used.has(String(d)) || entered.length >= b.digits ? "disabled" : ""}>${d}</button>`;
  pad += `<button data-d="del" ${!human || !entered ? "disabled" : ""}>消す</button></div>`;
  const label = b.setting ? "あなたの秘密の数を決めてください" : b.solo ? "CPUが決めた数を当てます" : "相手の数を当ててください";
  const secret = !b.solo && b.secrets[me] >= 0 ? `<div class="hbs">あなたの数: ${String(b.secrets[me]).padStart(b.digits, "0")}</div>` : "";
  const html = `<div class="hb"><div class="hbl">${label}</div>${secret}<div class="hblists">${b.solo ? mkList(0, "あなたの答え") : mkList(me, "あなたの答え") + mkList(1 - me, "相手の答え")}</div>${pad}</div>`;
  A.board(html, (d, el) => {
    const t = el.closest("button[data-d]");
    if (!t || t.disabled) return;
    const v = t.dataset.d;
    A.sel = v === "del" ? entered.slice(0, -1) : entered + v;
    A.redraw();
  });
  const full = entered.length === b.digits;
  A.acts([{ label: "決定", move: full ? parseInt(entered, 10) : -999, enabled: full && human }]);
}

// ------------------------------------------------------------ ウサギと猟犬
function hare(b, A) {
  pair(A, "猟犬", "#5A3A22", "ウサギ", "#F6F2E8;border:1px solid #B9AC8C");
  const legal = A.view.human ? A.view.legal : [];
  const Y = [1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1];
  const px = (i) => 12 + b.x[i] * 19, py = (i) => 10 + Y[i] * 16;
  const sel = A.sel;
  const tg = new Set(sel != null ? legal.filter((m) => Math.floor(m / 11) === sel).map((m) => m % 11) : []);
  let s = `<svg viewBox="0 0 100 52" role="img" aria-label="ウサギと猟犬の盤"><defs>${defsStones}</defs><rect width="100" height="52" rx="3" fill="#E3C48A"/>`;
  b.adj.forEach((l, a) => l.forEach((c) => { if (c > a) s += `<path d="M${px(a)} ${py(a)}L${px(c)} ${py(c)}" stroke="#7a5a2a" stroke-width=".7"/>`; }));
  for (let i = 0; i < 11; i++) {
    const v = b.board[i], x = px(i), y = py(i);
    s += `<circle cx="${x}" cy="${y}" r="3" fill="#C9AB74"/>`;
    if (v === 1) s += `<circle cx="${x + .4}" cy="${y + .8}" r="5" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r="5" fill="#6b4a2a" stroke="#3D2616" stroke-width=".5"/><text x="${x}" y="${y + 2.2}" font-size="6" text-anchor="middle" fill="#FFFDF5" font-weight="700">犬</text>`;
    if (v === 2) s += `<circle cx="${x + .4}" cy="${y + .8}" r="5" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r="5" fill="url(#gW)"/><text x="${x}" y="${y + 2.2}" font-size="6" text-anchor="middle" fill="#2A2118" font-weight="700">兎</text>`;
    if (sel === i) s += `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#B98318" stroke-width="1"/>`;
    if (tg.has(i)) s += `<circle cx="${x}" cy="${y}" r="1.8" fill="#B98318"/>`;
    if (b.last >= 0 && b.last % 11 === i) s += `<circle cx="${x}" cy="${y}" r="6.2" fill="none" stroke="${GOLD}" stroke-width=".6"/>`;
    s += `<circle cx="${x}" cy="${y}" r="7" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => {
    if (d.i == null || !A.view.human) return;
    const i = +d.i;
    if (sel != null && legal.includes(sel * 11 + i)) return A.play(sel * 11 + i);
    A.sel = legal.some((m) => Math.floor(m / 11) === i) && sel !== i ? i : null;
    A.redraw();
  });
}

// ------------------------------------------------------------ チャイニーズチェッカー
function chinese(b, A) {
  const me = A.mySeat, n = Math.max(...b.board);
  const players = b.camps.length;
  A.strip(Array.from({ length: players }, (_, k) => `<div class="pl${A.view.toMove === k ? " turn" : ""}"><span class="dot" style="background:${SEAT_COL[k]}"></span><span class="nm">${k === me ? "あなた" : "CPU"}</span></div>`).join(""));
  void n;
  const legal = A.view.human ? A.view.legal : [];
  const sel = A.sel;
  const tg = new Set(sel != null ? legal.filter((m) => Math.floor(m / 128) === sel).map((m) => m % 128) : []);
  const D = 5.2, X0 = 52, Y0 = 50;
  const P = (i) => { const [q, r] = b.pts[i]; return [X0 + (q + r / 2) * D, Y0 + r * D * 0.866]; };
  let s = `<svg viewBox="0 0 104 100" role="img" aria-label="チャイニーズチェッカーの盤"><defs>${defsStones}</defs><circle cx="52" cy="50" r="49" fill="#B98952"/><circle cx="52" cy="50" r="46" fill="#98693A"/>`;
  for (let i = 0; i < b.pts.length; i++) {
    const [x, y] = P(i), v = b.board[i];
    s += `<circle cx="${x}" cy="${y}" r="2.1" fill="#5A3A22"/>`;
    if (v) s += `<circle cx="${x + .3}" cy="${y + .5}" r="2.4" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="2.4" fill="${SEAT_COL[v - 1]}" stroke="rgba(255,255,255,.55)" stroke-width=".25"/>`;
    if (sel === i) s += `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="#FFFDF5" stroke-width=".7"/>`;
    if (tg.has(i)) s += `<circle cx="${x}" cy="${y}" r=".9" fill="#FFFDF5"/>`;
    if (b.last >= 0 && (b.last % 128 === i)) s += `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${GOLD}" stroke-width=".5"/>`;
    s += `<circle cx="${x}" cy="${y}" r="2.7" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => {
    if (d.i == null || !A.view.human) return;
    const i = +d.i;
    if (sel != null && legal.includes(sel * 128 + i)) return A.play(sel * 128 + i);
    A.sel = legal.some((m) => Math.floor(m / 128) === i) && sel !== i ? i : null;
    A.redraw();
  });
}

// ------------------------------------------------------------ ルドー
const LUDO_RING = (() => {
  const r = [];
  for (let c = 1; c <= 5; c++) r.push([c, 6]);
  for (let y = 5; y >= 0; y--) r.push([6, y]);
  r.push([7, 0], [8, 0]);
  for (let y = 1; y <= 5; y++) r.push([8, y]);
  for (let c = 9; c <= 14; c++) r.push([c, 6]);
  r.push([14, 7], [14, 8]);
  for (let c = 13; c >= 9; c--) r.push([c, 8]);
  for (let y = 9; y <= 14; y++) r.push([8, y]);
  r.push([7, 14], [6, 14]);
  for (let y = 13; y >= 9; y--) r.push([6, y]);
  for (let c = 5; c >= 0; c--) r.push([c, 8]);
  r.push([0, 7], [0, 6]);
  return r;
})();
const LUDO_COL = ["#C8463C", "#3E9B63", "#E0AE36", "#3F78C4"];
const HOME_COL = [(i) => [1 + i, 7], (i) => [7, 1 + i], (i) => [13 - i, 7], (i) => [7, 13 - i]];
const BASE = [[[1.7, 1.7], [3.3, 1.7], [1.7, 3.3], [3.3, 3.3]], [[10.7, 1.7], [12.3, 1.7], [10.7, 3.3], [12.3, 3.3]], [[10.7, 10.7], [12.3, 10.7], [10.7, 12.3], [12.3, 12.3]], [[1.7, 10.7], [3.3, 10.7], [1.7, 12.3], [3.3, 12.3]]];
function ludo(b, A) {
  const me = A.mySeat;
  A.strip(Array.from({ length: b.n }, (_, k) => `<div class="pl${A.view.toMove === k ? " turn" : ""}"><span class="dot" style="background:${LUDO_COL[b.slots[k]]}"></span><span class="nm">${k === me ? "あなた" : "CPU"}</span><span class="num">${b.pos[k].filter((p) => p === 56).length}</span></div>`).join(""));
  const legal = new Set(A.view.human ? A.view.legal : []);
  const U = 5.6;
  const cell = ([x, y]) => [x * U + U / 2, y * U + U / 2];
  let s = `<svg viewBox="0 0 84 84" role="img" aria-label="ルドーの盤"><defs>${defsStones}</defs><rect width="84" height="84" rx="3" fill="#B98952"/><rect x="1.5" y="1.5" width="81" height="81" fill="#F3EBD6"/>`;
  for (let k = 0; k < 4; k++) {
    const [bx, by] = [[0, 0], [9, 0], [9, 9], [0, 9]][k];
    s += `<rect x="${bx * U + 1.5}" y="${by * U + 1.5}" width="${6 * U - 3}" height="${6 * U - 3}" fill="${LUDO_COL[k]}" opacity="${b.slots.includes(k) ? 0.28 : 0.1}"/>`;
  }
  LUDO_RING.forEach(([x, y], i) => {
    const start = [0, 13, 26, 39].indexOf(i);
    s += `<rect x="${x * U + .4}" y="${y * U + .4}" width="${U - .8}" height="${U - .8}" fill="${start >= 0 ? LUDO_COL[start] : "#FFFDF5"}" stroke="#B9AC8C" stroke-width=".3" opacity="${start >= 0 ? 0.75 : 1}"/>`;
  });
  for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) { const [x, y] = HOME_COL[k](i); s += `<rect x="${x * U + .4}" y="${y * U + .4}" width="${U - .8}" height="${U - .8}" fill="${LUDO_COL[k]}" opacity=".55"/>`; }
  s += `<polygon points="${6 * U},${6 * U} ${9 * U},${6 * U} ${7.5 * U},${7.5 * U}" fill="${LUDO_COL[1]}" opacity=".6"/><polygon points="${9 * U},${6 * U} ${9 * U},${9 * U} ${7.5 * U},${7.5 * U}" fill="${LUDO_COL[2]}" opacity=".6"/><polygon points="${9 * U},${9 * U} ${6 * U},${9 * U} ${7.5 * U},${7.5 * U}" fill="${LUDO_COL[3]}" opacity=".6"/><polygon points="${6 * U},${9 * U} ${6 * U},${6 * U} ${7.5 * U},${7.5 * U}" fill="${LUDO_COL[0]}" opacity=".6"/>`;
  // 駒の位置
  const tokens = [];
  for (let k = 0; k < b.n; k++) for (let t = 0; t < 4; t++) {
    const p = b.pos[k][t], slot = b.slots[k];
    let xy;
    if (p < 0) xy = BASE[slot][t];
    else if (p <= 50) xy = LUDO_RING[(slot * 13 + p) % 52];
    else if (p <= 55) xy = HOME_COL[slot](p - 51);
    else xy = [6.6 + t * 0.6, 6.6 + (slot % 2) * 0.8 + 0.4];
    tokens.push({ k, t, xy, slot });
  }
  tokens.forEach(({ k, t, xy, slot }) => {
    const [x, y] = cell(xy);
    const can = k === A.view.toMove && legal.has(t + 1);
    s += `<circle cx="${x + .3}" cy="${y + .7}" r="2.5" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="2.5" fill="${LUDO_COL[slot]}" stroke="#FFFDF5" stroke-width=".5"/><circle cx="${x - .7}" cy="${y - .8}" r=".7" fill="#fff" opacity=".6"/>`;
    if (can) s += `<circle cx="${x}" cy="${y}" r="3.2" fill="none" stroke="#1b140d" stroke-width=".7"/><circle cx="${x}" cy="${y}" r="3.4" fill="transparent" data-t="${t + 1}"/>`;
  });
  if (b.die > 0) s += `<rect x="${7.5 * U - 4}" y="${7.5 * U - 4}" width="8" height="8" rx="1.4" fill="#FFFDF5" stroke="#B9AC8C" stroke-width=".4"/><text x="${7.5 * U}" y="${7.5 * U + 2.8}" font-size="8" text-anchor="middle" fill="#2A2118" font-weight="700">${b.die}</text>`;
  s += "</svg>";
  A.board(s, (d) => { if (d.t != null && legal.has(+d.t)) A.play(+d.t); });
  A.acts([{ label: "サイコロを振る", move: 0, enabled: legal.has(0) }]);
}

// ------------------------------------------------------------ バックギャモン
function backgammon(b, A) {
  const me = A.mySeat;
  pair(A, "白", "#F6F2E8;border:1px solid #B9AC8C", "黒", "#15151A", [b.off[0], b.off[1]]);
  const legal = A.view.human ? A.view.legal : [];
  const mv = legal.filter((m) => m >= 1000);
  const sel = A.sel;
  const white = me === 0;
  const dest = (from, die) => {
    if (white) { const t = from === 24 ? 24 - die : from - die; return t < 0 ? -1 : t; }
    const t = from === 24 ? die - 1 : from + die; return t > 23 ? -1 : t;
  };
  const moves = mv.map((m) => ({ m, from: Math.floor((m - 1000) / 10), die: (m - 1000) % 10 }));
  const tg = new Map();
  if (sel != null) for (const x of moves) if (x.from === sel) tg.set(dest(x.from, x.die), x.m);
  const W = 100, H = 70, TW = 6.4;
  // 位置: 上段は 13〜24(左→右 = index 12..23)、下段は 12〜1(左→右 = index 11..0)。中央にバー
  const X = (i) => { const col = i >= 12 ? i - 12 : 11 - i; return 5 + col * TW + (col >= 6 ? 6 : 0) + TW / 2; };
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="バックギャモンの盤"><defs>${defsStones}</defs><rect width="${W}" height="${H}" rx="3" fill="#5A3A22"/><rect x="3" y="3" width="94" height="64" fill="#2C6B4D"/>`;
  for (let i = 0; i < 24; i++) {
    const top = i >= 12, x = X(i), dark = (i % 2 === 0) === top;
    s += `<polygon points="${x - TW / 2 + .4},${top ? 3 : 67} ${x + TW / 2 - .4},${top ? 3 : 67} ${x},${top ? 30 : 40}" fill="${dark ? "#8A3B2A" : "#E6D3A8"}"/>`;
    const n = Math.abs(b.points[i]), side = b.points[i] > 0 ? 1 : 2;
    for (let k = 0; k < Math.min(n, 5); k++) { const y = top ? 3 + 3.2 + k * 5.8 : 67 - 3.2 - k * 5.8; s += stone(x, y, 2.9, side, BW); }
    if (n > 5) s += `<text x="${x}" y="${top ? 3 + 3.2 + 4 * 5.8 + 1.2 : 67 - 3.2 - 4 * 5.8 + 1.2}" font-size="3.4" text-anchor="middle" fill="${side === 1 ? "#2A2118" : "#FFFDF5"}" font-weight="700">${n}</text>`;
    if (sel === i) s += `<rect x="${x - TW / 2}" y="${top ? 3 : 38}" width="${TW}" height="29" fill="none" stroke="#FFFDF5" stroke-width=".8"/>`;
    if (tg.has(i)) s += `<circle cx="${x}" cy="${top ? 33 : 37}" r="1.6" fill="#FFFDF5"/>`;
    s += `<rect x="${x - TW / 2}" y="${top ? 3 : 35}" width="${TW}" height="32" fill="transparent" data-p="${i}"/>`;
  }
  s += `<rect x="${5 + 6 * TW}" y="3" width="6" height="64" fill="#3D2616"/>`;
  // バーの駒
  for (const side of [0, 1]) for (let k = 0; k < b.bar[side]; k++) s += stone(5 + 6 * TW + 3, 22 + side * 26 + k * 3.4 * (side ? 1 : -1) + (side ? 0 : 0), 2.5, side + 1, BW);
  if (sel === 24) s += `<rect x="${5 + 6 * TW}" y="3" width="6" height="64" fill="none" stroke="#FFFDF5" stroke-width=".8"/>`;
  s += `<rect x="${5 + 6 * TW}" y="3" width="6" height="64" fill="transparent" data-p="24"/>`;
  // 上がった駒の置き場
  s += `<rect x="90" y="3" width="7" height="64" fill="#3D2616"/><text x="93.5" y="36" font-size="3.4" text-anchor="middle" fill="#FFFDF5">上がり</text>`;
  s += `<rect x="90" y="3" width="7" height="64" fill="${tg.has(-1) ? "#FFFDF5" : "transparent"}" opacity=".18" data-off="1"/>`;
  s += `<text x="93.5" y="10" font-size="3.6" text-anchor="middle" fill="#FFFDF5">白${b.off[0]}</text><text x="93.5" y="63" font-size="3.6" text-anchor="middle" fill="#FFFDF5">黒${b.off[1]}</text>`;
  // サイコロ
  const diceShown = b.dice.length ? b.dice : b.shown;
  diceShown.forEach((d, k) => { s += `<rect x="${50 + k * 9}" y="31" width="7" height="8" rx="1.2" fill="#FFFDF5" stroke="#B9AC8C" stroke-width=".3" opacity="${b.dice.length ? 1 : .55}"/><text x="${53.5 + k * 9}" y="36.8" font-size="5.4" text-anchor="middle" fill="#2A2118" font-weight="700">${d}</text>`; });
  s += "</svg>";
  A.board(s, (d) => {
    if (!A.view.human) return;
    let to = null;
    if (d.off != null) to = -1; else if (d.p != null) to = +d.p;
    if (to != null && sel != null && tg.has(to)) return A.play(tg.get(to));
    if (d.p != null) {
      const i = +d.p;
      A.sel = moves.some((x) => x.from === i) && sel !== i ? i : null;
      A.redraw();
    }
  });
  A.acts([{ label: "サイコロを振る", move: 0, enabled: legal.includes(0) }]);
}

// ------------------------------------------------------------ 碁
function go(b, A) {
  pair(A, "黒", "#15151A", "白", "#F6F2E8;border:1px solid #B9AC8C", b.captures);
  const legal = new Set(A.view.human ? A.view.legal : []);
  const n = b.n, G = n === 19 ? 4.3 : n === 13 ? 6 : 8.6, M = 6;
  const size = M * 2 + G * (n - 1);
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="碁盤"><defs>${defsStones}</defs><rect width="${size}" height="${size}" rx="2" fill="#E3C48A"/>`;
  for (let i = 0; i < n; i++) s += `<path d="M${M + i * G} ${M}V${M + (n - 1) * G}M${M} ${M + i * G}H${M + (n - 1) * G}" stroke="#7a5a2a" stroke-width=".25"/>`;
  const stars = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : [2, 4, 6];
  for (const r of stars) for (const c of stars) s += `<circle cx="${M + c * G}" cy="${M + r * G}" r=".7" fill="#7a5a2a"/>`;
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, x = M + c * G, y = M + r * G, v = b.board[i];
    const dead = b.dead && b.dead[i];
    if (v) s += `<g${dead ? ' opacity=".4"' : ""}>${stone(x, y, G * 0.47, v, BW)}</g>`;
    if (b.owner && b.owner[i] > 0 && (!v || dead)) s += `<rect x="${x - G * .17}" y="${y - G * .17}" width="${G * .34}" height="${G * .34}" fill="${b.owner[i] === 1 ? "#15151A" : "#FFFDF5"}" stroke="#7a5a2a" stroke-width=".2"/>`;
    if (b.last === i) s += `<circle cx="${x}" cy="${y}" r="${G * .17}" fill="${v === 1 ? "#FFFDF5" : "#2A2118"}" opacity=".9"/>`;
    s += `<rect x="${x - G / 2}" y="${y - G / 2}" width="${G}" height="${G}" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => { if (d.i != null && legal.has(+d.i)) A.play(+d.i); });
  A.acts([{ label: "パス", move: n * n, enabled: legal.has(n * n) }, { label: "降参", move: n * n + 1, enabled: legal.has(n * n + 1) }]);
}

// ------------------------------------------------------------ サイコロ役づくり(ヨット)
const YN = ["1の目", "2の目", "3の目", "4の目", "5の目", "6の目", "チョイス", "フォーダイス", "フルハウス", "Sストレート", "Bストレート", "ヨット"];
function yachtScore(dice, cat) {
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((v) => cnt[v]++);
  const sum = dice.reduce((a, c) => a + c, 0);
  if (cat <= 5) return cnt[cat + 1] * (cat + 1);
  if (cat === 6) return sum;
  if (cat === 7) return cnt.some((c) => c >= 4) ? sum : 0;
  if (cat === 8) { const v = cnt.slice(1).filter((c) => c); return v.length === 1 || (v.length === 2 && v.includes(3)) ? sum : 0; }
  const has = (a) => a.every((x) => cnt[x] > 0);
  if (cat === 9) return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 15 : 0;
  if (cat === 10) return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 30 : 0;
  return cnt.some((c) => c === 5) ? 50 : 0;
}
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function yacht(b, A) {
  const me = A.mySeat, legal = new Set(A.view.human ? A.view.legal : []);
  A.strip(Array.from({ length: b.players }, (_, k) => {
    const tot = b.sheets[k].reduce((a, c) => a + Math.max(c, 0), 0) + (b.sheets[k].slice(0, 6).reduce((a, c) => a + Math.max(c, 0), 0) >= 63 ? 35 : 0);
    return `<div class="pl${A.view.toMove === k ? " turn" : ""}"><span class="nm">${k === me ? "あなた" : "CPU" + (b.players > 2 ? k : "")}</span><span class="num">${tot}</span></div>`;
  }).join(""));
  const mask = A.sel || 0;
  const rolled = b.rollsLeft < 3;
  let s = `<svg viewBox="0 0 90 22" role="img" aria-label="サイコロ">`;
  b.dice.forEach((v, i) => {
    const x = 3 + i * 17.5, held = (mask >> i) & 1;
    s += `<rect x="${x}" y="${held ? 1 : 3}" width="14" height="14" rx="2.4" fill="#FFFDF5" stroke="${held ? "#B98318" : "#B9AC8C"}" stroke-width="${held ? 1.1 : .5}" data-die="${i}"/>`;
    if (v > 0) for (const [px, py] of PIPS[v]) s += `<circle cx="${x + 7 + px * 3.6}" cy="${(held ? 1 : 3) + 7 + py * 3.6}" r="1.3" fill="#2A2118" pointer-events="none"/>`;
    if (held) s += `<text x="${x + 7}" y="21" font-size="3" text-anchor="middle" fill="#B98318" font-weight="700">キープ</text>`;
  });
  s += "</svg>";
  const rows = YN.map((nm, cat) => {
    const cells = Array.from({ length: b.players }, (_, k) => {
      const v = b.sheets[k][cat];
      if (v >= 0) return `<td class="ys">${v}</td>`;
      if (k === me && legal.has(100 + cat) && rolled) return `<td class="yp" data-cat="${cat}">${yachtScore(b.dice, cat)}</td>`;
      return "<td></td>";
    }).join("");
    return `<tr><th>${nm}</th>${cells}</tr>`;
  }).join("");
  const bonus = Array.from({ length: b.players }, (_, k) => { const t = b.sheets[k].slice(0, 6).reduce((a, c) => a + Math.max(c, 0), 0); return `<td class="ys">${t}/63</td>`; }).join("");
  const head = Array.from({ length: b.players }, (_, k) => `<th>${k === me ? "あなた" : "CPU" + (b.players > 2 ? k : "")}</th>`).join("");
  const html = `<div class="yacht">${s}<div class="ytxt">残り ${b.rollsLeft} 回振れます</div><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}<tr><th>ボーナス(63で35点)</th>${bonus}</tr></tbody></table></div>`;
  A.board(html, (d, el) => {
    const die = el.closest("[data-die]");
    if (die && A.view.human && rolled && b.rollsLeft > 0) { A.sel = mask ^ (1 << +die.dataset.die); return A.redraw(); }
    const cell = el.closest("[data-cat]");
    if (cell && legal.has(100 + +cell.dataset.cat)) A.play(100 + +cell.dataset.cat);
  });
  const rollMove = rolled ? mask : 0;
  A.acts([{ label: rolled ? "残りを振り直す" : "サイコロを振る", move: rollMove, enabled: legal.has(rollMove) && b.rollsLeft > 0 }]);
}

export const RENDER2 = { dots, hitblow, hare, chinese, ludo, backgammon, go, yacht };

// ------------------------------------------------------------ カードゲーム共通(札・ボタン・点数を Kotlin から受け取って描く)
const CCOL = { 赤: "#C8463C", 黄: "#C79A12", 緑: "#3E9B63", 青: "#3F78C4" };
function cardsRender(b, A) {
  A.strip(b.scores.map((s) => `<div class="pl${s.turn ? " turn" : ""}"><span class="who"><span class="nm">${s.name}</span><span class="nt">${s.v}</span></span></div>`).join(""));
  const mask = A.sel || 0;
  const human = A.view.human;
  const cardHtml = (c, zi, ki) => {
    if (c.empty) return `<div class="cd empty"><span>${c.t}</span></div>`;
    if (c.back) return `<div class="cd back${c.m != null && human ? " tap" : ""}" ${c.m != null && human ? `data-z="${zi}" data-k="${ki}"` : ""}></div>`;
    const clickable = human && (c.m != null || c.opts.length || c.tog >= 0);
    const col = CCOL[c.t[0]];
    const on = c.tog >= 0 && (mask >> c.tog) & 1;
    return `<div class="cd${c.red ? " red" : ""}${clickable ? " tap" : ""}${c.hi ? " hi" : ""}${on ? " on" : ""}" ${col ? `style="border-color:${col};color:${col}"` : ""} ${clickable ? `data-z="${zi}" data-k="${ki}"` : ""}>${c.t}${on ? '<i class="tg">替える</i>' : ""}</div>`;
  };
  const zones = b.zones.map((z, zi) => {
    const style = z.cols ? `style="grid-template-columns:repeat(${z.cols},1fr)"` : "";
    return `<div class="zone">${z.label ? `<div class="zl">${z.label}</div>` : ""}<div class="cds${z.cols ? " grid" : ""}" ${style}>${z.cards.map((c, ki) => cardHtml(c, zi, ki)).join("") || '<span class="zn">なし</span>'}</div></div>`;
  }).join("");
  A.board(`<div class="cardtable">${b.info ? `<div class="cinfo">${b.info}</div>` : ""}${zones}</div>`, (d, el) => {
    const t = el.closest("[data-z]");
    if (!t || !human) return;
    const c = b.zones[+t.dataset.z].cards[+t.dataset.k];
    if (c.tog >= 0) { A.sel = mask ^ (1 << c.tog); return A.redraw(); }
    if (c.opts.length > 1 || (c.opts.length === 1 && c.m == null)) {
      A.sheet(`<h2>どうしますか</h2><div class="btns">${c.opts.map(([l, m]) => `<button data-m="${m}">${l}</button>`).join("")}</div>`, (box) => {
        box.querySelectorAll("button[data-m]").forEach((x) => (x.onclick = () => { A.closeSheet(); A.play(+x.dataset.m); }));
      });
      return;
    }
    if (c.m != null) A.play(c.m);
  });
  A.acts(b.buttons.map((x) => ({ label: x.label, move: x.base ? x.m + mask : x.m, enabled: human })));
}
RENDER2.cards = cardsRender;
