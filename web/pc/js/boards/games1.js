/* 盤の描画(WEB 版の HTML 版から移した。規則は持たない) */
window.RENDER = window.RENDER || {};
(() => {
// 盤ごとの描画と操作。app.js から、状態(b)と部品(A)を渡して呼ぶ。
// A: { mySeat, view, name(seat), strip(items), board(svg, onTap), play(move), redraw(), sheet(html), closeSheet(), get sel, set sel }
// 手の番号は規則(Kotlin の core)が決めたもの。ここでは番号を作る・読むだけで、規則は持たない。

const NS = "";
const stone = (cx, cy, r, v, ids) =>
  `<circle cx="${cx + r * 0.1}" cy="${cy + r * 0.18}" r="${r}" fill="#000" opacity=".28"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${ids[v]})"/>`;
const defsStones = `<radialGradient id="gB" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6b6b72"/><stop offset=".35" stop-color="#2a2a30"/><stop offset="1" stop-color="#0c0c10"/></radialGradient>
<radialGradient id="gW" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#ece7d9"/><stop offset="1" stop-color="#bdb59f"/></radialGradient>
<radialGradient id="gR" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#F59A86"/><stop offset=".45" stop-color="#D8452E"/><stop offset="1" stop-color="#8E2415"/></radialGradient>
<radialGradient id="gY" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".45" stop-color="#E6B21F"/><stop offset="1" stop-color="#9A7208"/></radialGradient>
<radialGradient id="gU" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9CC1F0"/><stop offset=".45" stop-color="#3F78C4"/><stop offset="1" stop-color="#1F4577"/></radialGradient>`;
const BW = { 1: "gB", 2: "gW" };
const RY = { 1: "gR", 2: "gY" };
const GOLD = "#E0AD4A";

function pair(A, aLabel, aColor, bLabel, bColor, nums) {
  // 元のアプリの名札: 駒の色の玉・名前・ひとこと(番・強さ・先攻後攻)・大きな数字。番の人は金の枠
  const mk = (seat, label, color, n) =>
    `<div class="pl${A.view.toMove === seat && !A.view.outcome ? " turn" : ""}"><span class="dot" style="background:${color}"></span><span class="who"><span class="nm">${A.name(seat)}</span><span class="nt">${(A.note && A.note(seat)) || label}</span></span>${n == null ? "" : `<span class="num">${n}</span>`}</div>`;
  A.strip(mk(0, aLabel, aColor, nums && nums[0]) + mk(1, bLabel, bColor, nums && nums[1]));
}

// ------------------------------------------------------------ 四つ並べ(コネクトフォー)
function c4(b, A) {
  pair(A, "赤", "#D8452E", "黄", "#E6B21F");
  const legal = new Set(A.view.human ? A.view.legal : []);
  const win = new Set(b.win);
  let s = `<svg viewBox="0 0 72 68" role="img" aria-label="四つ並べの盤"><defs>${defsStones}</defs><rect x="0" y="0" width="72" height="68" rx="3" fill="#2B4A6B"/>`;
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++) {
      const v = b.cells[r * 7 + c];
      const x = 5 + c * 10, y = 5 + (5 - r) * 10 + 1;
      s += `<circle cx="${x}" cy="${y}" r="4.4" fill="#16293F"/>`;
      if (v) s += stone(x, y, 4.1, v, RY);
      if (win.has(r * 7 + c)) s += `<circle cx="${x}" cy="${y}" r="4.9" fill="none" stroke="#FFFDF5" stroke-width=".9"/>`;
      if (b.last === r * 7 + c) s += `<circle cx="${x}" cy="${y}" r="1.2" fill="#FFFDF5" opacity=".85"/>`;
    }
  for (let c = 0; c < 7; c++) s += `<rect x="${c * 10}" y="0" width="10" height="68" fill="transparent" data-col="${c}"/>`;
  s += "</svg>";
  A.board(s, (d) => { if (d.col != null && legal.has(+d.col)) A.play(+d.col); });
}

// ------------------------------------------------------------ 五目ならべ
function gomoku(b, A) {
  pair(A, "黒", "#15151A", "白", "#F6F2E8;border:1px solid #B9AC8C");
  const legal = new Set(A.view.human ? A.view.legal : []);
  const win = new Set(b.win);
  const N = 15, G = 5.6, M = 6;
  const size = M * 2 + G * (N - 1);
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="五目ならべの盤"><defs>${defsStones}</defs><rect width="${size}" height="${size}" rx="2" fill="#E3C48A"/>`;
  for (let i = 0; i < N; i++) s += `<path d="M${M + i * G} ${M}V${M + (N - 1) * G}M${M} ${M + i * G}H${M + (N - 1) * G}" stroke="#7a5a2a" stroke-width=".25"/>`;
  for (const r of [3, 7, 11]) for (const c of [3, 7, 11]) s += `<circle cx="${M + c * G}" cy="${M + r * G}" r=".7" fill="#7a5a2a"/>`;
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N, x = M + c * G, y = M + r * G;
    const v = b.cells[i];
    if (v) s += stone(x, y, 2.5, v, BW);
    if (win.has(i)) s += `<circle cx="${x}" cy="${y}" r="2.9" fill="none" stroke="${GOLD}" stroke-width=".6"/>`;
    if (b.last === i) s += `<circle cx="${x}" cy="${y}" r="1" fill="${v === 1 ? "#FFFDF5" : "#2A2118"}" opacity=".9"/>`;
    s += `<rect x="${x - G / 2}" y="${y - G / 2}" width="${G}" height="${G}" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => { if (d.i != null && legal.has(+d.i)) A.play(+d.i); });
}

// ------------------------------------------------------------ ヘックス
function hex(b, A) {
  pair(A, "赤(上下)", "#C8463C", "青(左右)", "#3F78C4");
  const legal = new Set(A.view.human ? A.view.legal : []);
  const win = new Set(b.win);
  const n = b.n, R = 5, W = Math.sqrt(3) * R, H = 1.5 * R;
  const X = (r, c) => 6 + W / 2 + c * W + r * W / 2, Y = (r) => 6 + R + r * H;
  const width = X(n - 1, n - 1) + W / 2 + 6, height = Y(n - 1) + R + 6;
  const hexPts = (cx, cy, k) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${(cx + k * Math.cos(a)).toFixed(2)},${(cy + k * Math.sin(a)).toFixed(2)}`; }).join(" ");
  let s = `<svg viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" role="img" aria-label="ヘックスの盤"><defs>${defsStones}</defs><rect width="${width}" height="${height}" rx="3" fill="#98693A"/>`;
  // 辺の色(赤=上下、青=左右)
  s += `<polyline points="${X(0, 0) - W / 2},${Y(0) - R + 1} ${X(0, n - 1) + W / 2},${Y(0) - R + 1}" stroke="#C8463C" stroke-width="2.4" fill="none"/>`;
  s += `<polyline points="${X(n - 1, 0) - W / 2},${Y(n - 1) + R - 1} ${X(n - 1, n - 1) + W / 2},${Y(n - 1) + R - 1}" stroke="#C8463C" stroke-width="2.4" fill="none"/>`;
  s += `<polyline points="${X(0, 0) - W / 2 - 1},${Y(0) - R + 1} ${X(n - 1, 0) - W / 2 - 1},${Y(n - 1) + R - 1}" stroke="#3F78C4" stroke-width="2.4" fill="none"/>`;
  s += `<polyline points="${X(0, n - 1) + W / 2 + 1},${Y(0) - R + 1} ${X(n - 1, n - 1) + W / 2 + 1},${Y(n - 1) + R - 1}" stroke="#3F78C4" stroke-width="2.4" fill="none"/>`;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const i = r * n + c, cx = X(r, c), cy = Y(r), v = b.cells[i];
      s += `<polygon points="${hexPts(cx, cy + 0.6, R - 0.35)}" fill="#B08A4C"/><polygon points="${hexPts(cx, cy, R - 0.35)}" fill="#E8CF9F" stroke="#C9AB74" stroke-width=".25" data-i="${i}"/>`;
      if (v) s += stone(cx, cy, R * 0.62, v, { 1: "gR", 2: "gU" });
      if (win.has(i)) s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.72}" fill="none" stroke="#FFFDF5" stroke-width=".7"/>`;
      if (b.last === i) s += `<circle cx="${cx}" cy="${cy}" r="1" fill="#FFFDF5"/>`;
    }
  s += "</svg>";
  A.board(s, (d) => { if (d.i != null && legal.has(+d.i)) A.play(+d.i); });
}

// ------------------------------------------------------------ マンカラ
function mancala(b, A) {
  pair(A, "下の列", "#7B5233", "上の列", "#B98F4C", [b.pits[6], b.pits[13]]);
  const legal = new Set(A.view.human ? A.view.legal : []);
  const flip = A.mySeat === 1;
  const Wd = 100, Ht = 46;
  // 座標(反時計回り): 席0の穴 0..5 は下の左→右、倉6は右、席1の穴 7..12 は上の右→左、倉13は左
  const pos = (i) => {
    let x, y;
    if (i <= 5) { x = 18 + i * 12.8; y = 31; }
    else if (i === 6) { x = 90; y = 23; }
    else if (i <= 12) { x = 18 + (5 - (i - 7)) * 12.8; y = 15; }
    else { x = 10; y = 23; }
    return flip ? [Wd - x, Ht - y] : [x, y];
  };
  let s = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="マンカラの盤"><rect width="${Wd}" height="${Ht}" rx="4" fill="#5A3A22"/><rect x="2" y="2" width="${Wd - 4}" height="${Ht - 4}" rx="3" fill="#7B5233"/>`;
  for (let i = 0; i < 14; i++) {
    const [x, y] = pos(i), store = i === 6 || i === 13;
    const n = b.pits[i];
    s += store ? `<rect x="${x - 6}" y="${y - 15}" width="12" height="30" rx="6" fill="#3D2616"/>` : `<circle cx="${x}" cy="${y}" r="5.6" fill="#3D2616"/>`;
    if (!store && legal.has(i)) s += `<circle cx="${x}" cy="${y}" r="6.3" fill="none" stroke="${GOLD}" stroke-width=".8"/>`;
    if (b.last === i) s += `<circle cx="${x}" cy="${y}" r="${store ? 7 : 6.8}" fill="none" stroke="#FFFDF5" stroke-width=".4" opacity=".7"/>`;
    s += `<text x="${x}" y="${y + 1.6}" font-size="${store ? 7 : 5.5}" font-weight="700" text-anchor="middle" fill="#FFFDF5">${n}</text>`;
    if (!store) s += `<circle cx="${x}" cy="${y}" r="6.3" fill="transparent" data-pit="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => { if (d.pit != null && legal.has(+d.pit)) A.play(+d.pit); });
}

// ------------------------------------------------------------ ナインメンズモリス
const MP = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
const ML = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23], [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
function morris(b, A) {
  pair(A, "白", "#F6F2E8;border:1px solid #B9AC8C", "黒", "#15151A", [b.inHand[0] + b.board.filter((v) => v === 1).length, b.inHand[1] + b.board.filter((v) => v === 2).length]);
  const legal = new Set(A.view.human ? A.view.legal : []);
  const K = 14, M = 7;
  const X = (i) => M + MP[i][0] * K, Y = (i) => M + MP[i][1] * K;
  const size = M * 2 + 6 * K;
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="ナインメンズモリスの盤"><defs>${defsStones}</defs><rect width="${size}" height="${size}" rx="3" fill="#E3C48A"/>`;
  for (const [a, m, c] of ML) s += `<path d="M${X(a)} ${Y(a)}L${X(c)} ${Y(c)}" stroke="#6b4e25" stroke-width=".7"/>`;
  const selFrom = A.sel != null ? A.sel : -1;
  const targets = new Set();
  if (selFrom >= 0) for (let t = 0; t < 24; t++) if (legal.has(100 + selFrom * 24 + t)) targets.add(t);
  for (let i = 0; i < 24; i++) {
    s += `<circle cx="${X(i)}" cy="${Y(i)}" r="1.3" fill="#6b4e25"/>`;
    const v = b.board[i];
    if (v) s += stone(X(i), Y(i), 4.6, v, BW);
    if (b.last >= 0 && (b.last === i || (b.last >= 100 && b.last < 1000 && (b.last - 100) % 24 === i))) s += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.3" fill="none" stroke="${GOLD}" stroke-width=".7"/>`;
    if (selFrom === i) s += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.4" fill="none" stroke="#B98318" stroke-width="1.1"/>`;
    if (targets.has(i) || (legal.has(i) && !v)) s += `<circle cx="${X(i)}" cy="${Y(i)}" r="1.9" fill="#B98318"/>`;
    if (legal.has(1000 + i)) s += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.4" fill="none" stroke="#C8463C" stroke-width="1.1" stroke-dasharray="1.6 1.2"/>`;
    s += `<circle cx="${X(i)}" cy="${Y(i)}" r="6" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => {
    if (d.i == null) return;
    const i = +d.i;
    if (legal.has(1000 + i)) return A.play(1000 + i);
    if (legal.has(i)) return A.play(i);
    if (selFrom >= 0 && legal.has(100 + selFrom * 24 + i)) return A.play(100 + selFrom * 24 + i);
    const mine = b.board[i] === A.mySeat + 1;
    const has = [...legal].some((m) => m >= 100 && m < 1000 && Math.floor((m - 100) / 24) === i);
    A.sel = mine && has && selFrom !== i ? i : null;
    A.redraw();
  });
}

// ------------------------------------------------------------ チェッカー
function checkers(b, A) {
  pair(A, "黒", "#15151A", "白", "#F6F2E8;border:1px solid #B9AC8C");
  const flip = A.mySeat === 1;
  const D = (i) => { const r = Math.floor(i / 8), c = i % 8; return flip ? [7 - r, 7 - c] : [r, c]; };
  const prefix = A.sel || null; // 選んだ道筋(マスの番号の並び)
  const paths = A.view.human ? b.paths : [];
  const cand = prefix ? paths.map((p, k) => [p, k]).filter(([p]) => prefix.every((v, j) => p[j] === v)) : [];
  const next = new Set(cand.filter(([p]) => p.length > prefix.length).map(([p]) => p[prefix.length]));
  const starts = new Set(paths.map((p) => p[0]));
  let s = `<svg viewBox="0 0 84 84" role="img" aria-label="チェッカーの盤"><defs>${defsStones}</defs><rect width="84" height="84" rx="3" fill="#2F2A24"/>`;
  const lastSet = new Set(b.lastPath);
  for (let i = 0; i < 64; i++) {
    const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
    s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${dark ? "#769656" : "#EEEED2"}"/>`;
    if (lastSet.has(i)) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${GOLD}" opacity=".35"/>`;
  }
  for (let i = 0; i < 64; i++) {
    const [r, c] = D(i), x = 2 + c * 10 + 5, y = 2 + r * 10 + 5, v = b.cells[i];
    if (v) {
      const white = v >= 3, king = v === 2 || v === 4;
      s += stone(x, y, 3.9, white ? 2 : 1, BW);
      if (king) s += `<text x="${x}" y="${y + 1.8}" font-size="5" text-anchor="middle" fill="${white ? "#2A2118" : "#E0AD4A"}" font-weight="700">K</text>`;
      if (prefix && prefix[0] === i || (!prefix && starts.has(i))) s += `<circle cx="${x}" cy="${y}" r="4.6" fill="none" stroke="${prefix ? "#B98318" : GOLD}" stroke-width="${prefix ? 1 : .5}" ${prefix ? "" : 'opacity=".55"'}/>`;
    }
    if (next.has(i)) s += `<circle cx="${x}" cy="${y}" r="1.7" fill="#B98318"/>`;
    s += `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => {
    if (d.i == null || !A.view.human) return;
    const i = +d.i;
    if (prefix && next.has(i)) {
      const np = prefix.concat(i);
      const done = paths.findIndex((p) => p.length === np.length && p.every((v, j) => v === np[j]));
      const longer = paths.some((p) => p.length > np.length && np.every((v, j) => p[j] === v));
      if (done >= 0 && !longer) return A.play(done);
      A.sel = np;
      return A.redraw();
    }
    A.sel = starts.has(i) && !(prefix && prefix[0] === i && prefix.length === 1) ? [i] : null;
    A.redraw();
  });
}

// ------------------------------------------------------------ チェス
const CHK = { 1: "P", 2: "N", 3: "B", 4: "R", 5: "Q", 6: "K" };
const CH_NAME = { 5: "クイーン", 4: "ルーク", 3: "ビショップ", 2: "ナイト" };
const cFrom = (m) => m & 63, cTo = (m) => (m >> 6) & 63, cPro = (m) => (m >> 12) & 15;
function chess(b, A) {
  pair(A, "白", "#F6F2E8;border:1px solid #B9AC8C", "黒", "#15151A");
  const flip = A.mySeat === 1;
  const D = (i) => { const r = Math.floor(i / 8), c = i % 8; return flip ? [7 - r, 7 - c] : [r, c]; };
  const sel = A.sel;
  const targets = new Map();
  if (sel != null && A.view.human) for (const m of A.view.legal) if (cFrom(m) === sel) { const t = cTo(m); (targets.get(t) || targets.set(t, []).get(t)).push(m); }
  const movable = new Set(A.view.human ? A.view.legal.map(cFrom) : []);
  let s = `<svg viewBox="0 0 84 84" role="img" aria-label="チェスの盤"><rect width="84" height="84" rx="3" fill="#2F2A24"/>`;
  const lastF = b.last >= 0 ? cFrom(b.last) : -1, lastT = b.last >= 0 ? cTo(b.last) : -1;
  for (let i = 0; i < 64; i++) {
    const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
    s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${dark ? "#769656" : "#EEEED2"}"/>`;
    if (i === lastF || i === lastT) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${GOLD}" opacity=".4"/>`;
    const v = b.board[i];
    if (v === 6 * (b.turn === 0 ? 1 : -1) && b.check) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="#C8463C" opacity=".5"/>`;
  }
  for (let i = 0; i < 64; i++) {
    const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, v = b.board[i];
    if (v) {
      const white = v > 0;
      const d = window.CHESS_PATHS[CHK[Math.abs(v)]];
      s += `<ellipse cx="${x + 5.3}" cy="${y + 9}" rx="3.4" ry="1" fill="#000" opacity=".3"/><g transform="translate(${x + 5},${y + 5.2}) scale(.27)" filter="url(#xSh)"><path d="${d}" fill="url(#${white ? 'xPw' : 'xPb'})" stroke="${white ? '#8d7c58' : '#0c0806'}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-9 11H9" stroke="${white ? '#6b5a3c' : '#000'}" stroke-opacity=".45" stroke-width="1.2"/><path d="${d}" fill="url(#xPh)" opacity="${white ? .55 : .3}"/></g>`;
      if (sel === i) s += `<rect x="${x + .4}" y="${y + .4}" width="9.2" height="9.2" fill="none" stroke="#B98318" stroke-width=".9"/>`;
    }
    if (targets.has(i)) s += v && (v > 0) !== (A.mySeat === 0) && A.caps ? `<rect x="${x + .6}" y="${y + .6}" width="8.8" height="8.8" rx="1" fill="none" stroke="#E2553A" stroke-width=".9"/>` : `<circle cx="${x + 5}" cy="${y + 5}" r="1.7" fill="#B98318" opacity=".85"/>`;
    s += `<rect x="${x}" y="${y}" width="10" height="10" fill="transparent" data-i="${i}"/>`;
  }
  s += "</svg>";
  A.board(s, (d) => {
    if (d.i == null || !A.view.human) return;
    const i = +d.i;
    const ms = sel != null ? A.view.legal.filter((m) => cFrom(m) === sel && cTo(m) === i) : [];
    if (ms.length === 1) return A.play(ms[0]);
    if (ms.length > 1) {
      const btns = ms.map((m) => `<button data-m="${m}" class="${cPro(m) === 5 ? "main" : ""}">${CH_NAME[cPro(m)] || "成らない"}</button>`).join("");
      A.sheet(`<h2>何に変えますか</h2><div class="btns">${btns}</div>`, (el) => {
        el.querySelectorAll("button[data-m]").forEach((x) => (x.onclick = () => { A.closeSheet(); A.play(+x.dataset.m); }));
      });
      return;
    }
    A.sel = movable.has(i) && sel !== i ? i : null;
    A.redraw();
  });
}

Object.assign(window.RENDER, { c4, gomoku, hex, mancala, morris, checkers, chess });
window.BOARDKIT = { pair, stone, defsStones, BW, RY, GOLD };

})();
