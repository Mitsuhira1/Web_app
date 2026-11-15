/* 描き直した盤(2026-11-14): ヘックス・マンカラ・ドット＆ボックス・ウサギと猟犬・ヒット＆ブロー・ヨット。規則は持たない。 */
(() => {
  const { pair } = window.BOARDKIT;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const prev = {};
  const GRAD = `<radialGradient id="fR" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#F59A86"/><stop offset=".45" stop-color="#D8452E"/><stop offset="1" stop-color="#8E2415"/></radialGradient>
   <radialGradient id="fU" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9CC1F0"/><stop offset=".45" stop-color="#3F78C4"/><stop offset="1" stop-color="#1F4577"/></radialGradient>
   <radialGradient id="fG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#A9E0B6"/><stop offset=".45" stop-color="#3E9B63"/><stop offset="1" stop-color="#1D5A37"/></radialGradient>
   <radialGradient id="fY" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".45" stop-color="#E6B21F"/><stop offset="1" stop-color="#9A7208"/></radialGradient>
   <radialGradient id="fP" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#D9C2F5"/><stop offset=".45" stop-color="#8A5FD0"/><stop offset="1" stop-color="#4B2F86"/></radialGradient>
   <radialGradient id="fPit" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#3a2414"/><stop offset=".7" stop-color="#4d301b"/><stop offset="1" stop-color="#6b4526"/></radialGradient>`;

  // ---------------------------------------------------------------- ヘックス(線をくっきり。影の重ね描きをしない)
  function hex(b, A) {
    pair(A, '赤(上下)', '#C8463C', '青(左右)', '#3F78C4');
    const legal = new Set(A.view.human ? A.view.legal : []);
    const win = new Set(b.win);
    const n = b.n, R = 20, W = Math.sqrt(3) * R, H = 1.5 * R, M = 22;
    const X = (r, c) => M + W / 2 + c * W + r * W / 2, Y = (r) => M + R + r * H;
    const width = X(n - 1, n - 1) + W / 2 + M, height = Y(n - 1) + R + M;
    const pts = (cx, cy, k) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${(cx + k * Math.cos(a)).toFixed(1)},${(cy + k * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const old = prev.hex && prev.hex.h === A.handle ? prev.hex.cells : null;
    // 4 つの辺の帯(赤 = 上と下、青 = 左と右)。盤のひし形を少し広げた形を、対角線で 4 つに分ける
    const P = [[X(0, 0) - W / 2 - 14, Y(0) - R - 9], [X(0, n - 1) + W / 2 + 5, Y(0) - R - 9], [X(n - 1, n - 1) + W / 2 + 14, Y(n - 1) + R + 9], [X(n - 1, 0) - W / 2 - 5, Y(n - 1) + R + 9]];
    const C = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2];
    const tri = (a, b2, col) => `<polygon points="${P[a]} ${P[b2]} ${C}" fill="${col}"/>`;
    let s = `<svg viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-label="ヘックスの盤" shape-rendering="geometricPrecision"><defs>${GRAD}</defs><rect width="${width}" height="${height}" rx="10" fill="#8A5E33"/>`;
    s += tri(0, 1, '#C8463C') + tri(2, 3, '#C8463C') + tri(1, 2, '#3F78C4') + tri(3, 0, '#3F78C4');
    let cells = '', stones = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const i = r * n + c, cx = X(r, c), cy = Y(r), v = b.cells[i];
      cells += `<polygon points="${pts(cx, cy, R)}" fill="${win.has(i) ? '#FFE9A8' : '#EBD3A0'}" stroke="#6E4E24" stroke-width="1.6" stroke-linejoin="round" class="${legal.has(i) ? 'hx can' : 'hx'}" data-i="${i}"/>`;
      if (v) stones += `<g class="${old && !old[i] ? 'hxnew' : ''}" style="transform-origin:${cx}px ${cy}px" pointer-events="none"><circle cx="${cx + 1.5}" cy="${cy + 3}" r="${R * .62}" fill="#000" opacity=".3"/><circle cx="${cx}" cy="${cy}" r="${R * .62}" fill="url(#${v === 1 ? 'fR' : 'fU'})"/><ellipse cx="${cx - 4}" cy="${cy - 6}" rx="4.5" ry="2.4" fill="#fff" opacity=".5" transform="rotate(-28 ${cx - 4} ${cy - 6})"/>${b.last === i ? `<circle cx="${cx}" cy="${cy}" r="3" fill="#FFFDF5"/>` : ''}</g>`;
    }
    prev.hex = { h: A.handle, cells: b.cells.slice() };
    A.board(s + cells + stones + '</svg>', (d) => { if (d.i != null && legal.has(+d.i)) A.play(+d.i); });
    A.anim(260);
  }

  // ---------------------------------------------------------------- マンカラ(見本: 木の盤・くぼみ・色つきの玉・数の札)
  const rng = (seed) => { let s = seed % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  function mancala(b, A) {
    pair(A, '下の列(先手)', '#7B5233', '上の列(後手)', '#B98F4C', [b.pits[6], b.pits[13]]);
    const legal = new Set(A.view.human ? A.view.legal : []);
    const flip = A.mySeat === 1, Wd = 800, Ht = 380;
    const pos = (i) => { let x, y; if (i <= 5) { x = 170 + i * 92; y = 262; } else if (i === 6) { x = 730; y = 190; } else if (i <= 12) { x = 170 + (12 - i) * 92; y = 118; } else { x = 70; y = 190; } return flip ? [Wd - x, Ht - y] : [x, y]; };
    const old = prev.man && prev.man.h === A.handle ? prev.man.pits : null;
    // まいた順(まいた穴の次から反時計回り。相手の倉は飛ばす)
    const order = {}; if (old && b.last >= 0 && b.last < 14) { const side = b.last <= 5 ? 0 : 1; let p = b.last, k = 0; for (let n = 0; n < 60; n++) { p = (p + 1) % 14; if (p === (side === 0 ? 13 : 6)) continue; if (order[p] == null) order[p] = []; order[p].push(k++); if (k >= old[b.last]) break; } }
    let s = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="マンカラの盤"><defs>${GRAD}</defs>${wood(6, 6, Wd - 12, Ht - 12, 60, 'xWal')}`;
    let maxDelay = 0; const drops = [];
    for (let i = 0; i < 14; i++) {
      const [x, y] = pos(i), store = i === 6 || i === 13, n = b.pits[i], rx = store ? 40 : 38, ry = store ? 118 : 38;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#fPit)" stroke="#2a180c" stroke-width="3"/><ellipse cx="${x}" cy="${y + 3}" rx="${rx}" ry="${ry}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="2.5"/>`;
      if (!store && legal.has(i)) s += `<circle cx="${x}" cy="${y}" r="44" fill="none" stroke="#FFC65C" stroke-width="4" class="mcan"/>`;
      if (b.last === i && n === 0) s += `<circle cx="${x}" cy="${y}" r="44" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><circle cx="${x}" cy="${y}" r="44" fill="none" stroke="#E2553A" stroke-width="2.6"/>`;
      // 玉: 穴ごとに決まった並び(数が同じなら同じ場所)
      const r = rng(i * 131 + 17), was = old ? old[i] : n, add = n - was;
      for (let k = 0; k < n; k++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * (store ? 1 : 1) * (n > 12 ? 1 : .9), bx = x + Math.cos(a) * d * (rx - 14), by = y + Math.sin(a) * d * (ry - 14), col = 'RUGYP'[Math.floor(r() * 5)];
        let cls = '', st = '';
        if (old && k >= was && add > 0) { const ord = (order[i] || [])[k - was]; const dl = (ord != null ? ord * 240 : 120) * A.speed; maxDelay = Math.max(maxDelay, dl); cls = 'mdrop'; st = `animation-delay:${dl}ms;`; drops.push(dl); }
        s += `<g class="${cls}" style="${st}transform-origin:${bx}px ${by}px" pointer-events="none"><circle cx="${bx + 1.5}" cy="${by + 3}" r="11" fill="#000" opacity=".35"/><circle cx="${bx}" cy="${by}" r="11" fill="url(#f${col})"/><ellipse cx="${bx - 3.4}" cy="${by - 5}" rx="4" ry="2.2" fill="#fff" opacity=".55" transform="rotate(-28 ${bx - 3.4} ${by - 5})"/></g>`;
      }
      const ty = store ? (y + (flip === (i === 13) ? 0 : 0)) : 0;
      const tag = (tx, tyy) => `<g pointer-events="none"><rect x="${tx - 22}" y="${tyy - 16}" width="44" height="32" rx="8" fill="#FFFDF5" stroke="#B9AC8C" stroke-width="1.5"/><text x="${tx}" y="${tyy + 8}" text-anchor="middle" font-size="22" font-weight="900" fill="#15151A" font-family="inherit">${n}</text></g>`;
      const upper = (i > 6 && i < 13) !== flip;
      s += store ? tag(x, y - 140 + 0) : tag(x, upper ? y - 68 : y + 68);
      if (!store) s += `<circle cx="${x}" cy="${y}" r="46" fill="transparent" data-pit="${i}" class="${legal.has(i) ? 'mtap' : ''}"/>`;
    }
    s += '</svg>';
    prev.man = { h: A.handle, pits: b.pits.slice() };
    A.board(s, (d) => { if (d.pit != null && legal.has(+d.pit)) A.play(+d.pit); });
    if (drops.length) { drops.sort((a, c) => a - c).forEach((dl, k) => { if (k === 0 || dl - drops[k - 1] > 30) A.sfx('MARBLE', dl / A.speed + 120, { rate: 0.95 + Math.random() * 0.1 }); }); A.land(-1); A.anim(maxDelay / A.speed + 400); }
  }

  // ---------------------------------------------------------------- ドット＆ボックス(白い紙。線は片側から伸びる)
  function dots(b, A) {
    pair(A, '赤(先手)', '#D8452E', '青(後手)', '#2F6FD0', b.score);
    const legal = new Set(A.view.human ? A.view.legal : []);
    const n = b.n, K = 100, M = 70, size = M * 2 + n * K;
    const old = prev.dots && prev.dots.h === A.handle ? prev.dots : null;
    const hEdge = (r, c) => r * n + c, vEdge = (r, c) => n * (n + 1) + r * (n + 1) + c;
    let boxes = '', lines = '', taps = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c, o = b.owner[i]; if (o >= 0) boxes += `<g class="${old && old.owner[i] < 0 ? 'dbox new' : 'dbox'}"><rect x="${M + c * K + 7}" y="${M + r * K + 7}" width="${K - 14}" height="${K - 14}" rx="6" class="p${o}"/><text x="${M + c * K + K / 2}" y="${M + r * K + K / 2 + 13}" text-anchor="middle" font-size="38" font-weight="900" class="t${o}">${esc(A.name(o)[0])}</text></g>`; }
    const line = (e, x1, y1, x2, y2) => {
      const by = b.edgeBy[e];
      if (by >= 0) { const fresh = old && old.edgeBy[e] < 0; lines += `<path d="M${x1} ${y1}L${x2} ${y2}" class="dl p${by} ${fresh ? 'draw' : ''} ${b.last === e ? 'dlast' : ''}" pathLength="100"/>`; }
      else { lines += `<path d="M${x1} ${y1}L${x2} ${y2}" class="dg" data-edge="${e}"/>`; if (legal.has(e)) taps += `<g class="dtg"><path d="M${x1} ${y1}L${x2} ${y2}" class="dgh p${A.view.toMove}"/><path d="M${x1} ${y1}L${x2} ${y2}" class="dt" data-e="${e}"/></g>`; }
    };
    for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) line(hEdge(r, c), M + c * K, M + r * K, M + (c + 1) * K, M + r * K);
    for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) line(vEdge(r, c), M + c * K, M + r * K, M + c * K, M + (r + 1) * K);
    let dotsS = ''; for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) dotsS += `<circle cx="${M + c * K}" cy="${M + r * K}" r="9" class="dd"/>`;
    prev.dots = { h: A.handle, edgeBy: b.edgeBy.slice(), owner: b.owner.slice() };
    A.board(`<div class="paper ${['light', 'auto', 'dark'].includes(A.cfg.paper) ? A.cfg.paper : 'light'}"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="ドット＆ボックスの紙">${boxes}${lines}${taps}${dotsS}</svg></div>`, (d) => { if (d.e != null && legal.has(+d.e)) A.play(+d.e); });
    A.anim(380); A.land(0);
  }

  // ---------------------------------------------------------------- ウサギと猟犬(駒は犬とウサギの絵)
  const dog = (x, y, r) => `<g transform="translate(${x},${y}) scale(${r / 20})" pointer-events="none"><ellipse cx="1.5" cy="20" rx="17" ry="4" fill="#000" opacity=".28"/>
    <path d="M-15 -8q-9 4-7 18 6 3 9-6z" fill="#5A3A22"/><path d="M15 -8q9 4 7 18-6 3-9-6z" fill="#5A3A22"/>
    <path d="M0 -17c11 0 16 8 16 17 0 10-7 18-16 18s-16-8-16-18c0-9 5-17 16-17z" fill="#B98048" stroke="#5A3A22" stroke-width="1.6"/>
    <path d="M0 0c6 0 9 4 9 9s-4 9-9 9-9-4-9-9 3-9 9-9z" fill="#F3DDBB"/><ellipse cx="0" cy="5" rx="3.6" ry="2.6" fill="#2A1A10"/><path d="M0 7.500v4M-4 12q4 3 8 0" stroke="#2A1A10" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="-6.500" cy="-4.500" r="2.2" fill="#2A1A10"/><circle cx="6.500" cy="-4.500" r="2.2" fill="#2A1A10"/><circle cx="-5.800" cy="-5.200" r=".7" fill="#fff"/><circle cx="7.200" cy="-5.200" r=".7" fill="#fff"/></g>`;
  const rabbit = (x, y, r) => `<g transform="translate(${x},${y}) scale(${r / 20})" pointer-events="none"><ellipse cx="1.5" cy="20" rx="15" ry="4" fill="#000" opacity=".28"/>
    <path d="M-9 -4c-5-12-4-24 0-26s7 10 6 24z" fill="#FFFDF7" stroke="#8C8272" stroke-width="1.4"/><path d="M9 -4c5-12 4-24 0-26s-7 10-6 24z" fill="#FFFDF7" stroke="#8C8272" stroke-width="1.4"/>
    <path d="M-8 -8c-2-8-2-15 0-18s3 6 3 15z" fill="#F4A6B4"/><path d="M8 -8c2-8 2-15 0-18s-3 6-3 15z" fill="#F4A6B4"/>
    <ellipse cx="0" cy="5" rx="15" ry="13.500" fill="#FFFDF7" stroke="#8C8272" stroke-width="1.5"/>
    <circle cx="-6" cy="2" r="2.2" fill="#2A1A10"/><circle cx="6" cy="2" r="2.2" fill="#2A1A10"/><circle cx="-5.300" cy="1.300" r=".7" fill="#fff"/><circle cx="6.700" cy="1.300" r=".7" fill="#fff"/>
    <path d="M-1.800 7h3.600l-1.800 2z" fill="#E77F93"/><path d="M0 9v2M-3.500 12q3.500 2.500 7 0" stroke="#8C8272" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="-10" cy="8" r="2.4" fill="#F9C9D2" opacity=".8"/><circle cx="10" cy="8" r="2.4" fill="#F9C9D2" opacity=".8"/></g>`;
  // アイコンと同じ駒: 猟犬は黒い石、ウサギは耳と目のある白い石
  const HDEF = (p) => `<defs><radialGradient id="${p}B" cx=".34" cy=".26" r=".8"><stop offset="0" stop-color="#7d7d7d"/><stop offset=".4" stop-color="#262626"/><stop offset="1" stop-color="#060606"/></radialGradient><radialGradient id="${p}W" cx=".34" cy=".26" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f3efe3"/><stop offset="1" stop-color="#bdb5a0"/></radialGradient><filter id="${p}Sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.8" flood-opacity=".5"/></filter></defs>`;
  const hBall = (x, y, r, g, p) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${p}${g})"/><ellipse cx="${x - r * .3}" cy="${y - r * .45}" rx="${r * .36}" ry="${r * .2}" fill="#fff" opacity=".55" transform="rotate(-28 ${x - r * .3} ${y - r * .45})"/>`;
  const hHound = (x, y, r, p = 'hg') => `<g pointer-events="none"><g filter="url(#${p}Sh)">${hBall(x, y, r, 'B', p)}</g></g>`;
  const hHare = (x, y, r, p = 'hg') => { const k = r / 8.4, ear = (dx, a) => `<ellipse cx="${x + dx * k}" cy="${y - 12 * k}" rx="${3 * k}" ry="${8 * k}" fill="#f3efe3" stroke="#bdb5a0" stroke-width="${.8 * k}" transform="rotate(${a} ${x + dx * k} ${y - 12 * k})"/>`;
    return `<g pointer-events="none"><g filter="url(#${p}Sh)">${ear(-4, -14)}${ear(4, 14)}</g><g filter="url(#${p}Sh)">${hBall(x, y, r, 'W', p)}</g><circle cx="${x - 3 * k}" cy="${y - k}" r="${1.1 * k}" fill="#15151A"/><circle cx="${x + 3 * k}" cy="${y - k}" r="${1.1 * k}" fill="#15151A"/></g>`; };
  function hare(b, A) {
    A.strip([0, 1].map((seat) => `<div class="pl${A.view.toMove === seat && !A.view.outcome ? ' turn' : ''}"><span class="dot pic"><svg viewBox="-24 -32 48 56">${HDEF('hs' + seat)}${seat === 0 ? hHound(0, -2, 17, 'hs' + seat) : hHare(0, 4, 15, 'hs' + seat)}</svg></span><span class="who"><span class="nm">${esc(A.name(seat))}</span><span class="nt">${seat === 0 ? '猟犬(先手)' : 'ウサギ(後手)'}</span></span></div>`).join(''));
    const legal = A.view.human ? A.view.legal : [];
    const YY = [1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1];
    const px = (i) => 100 + b.x[i] * 150, py = (i) => 90 + YY[i] * 130;
    const sel = A.sel;
    const tg = new Set(sel != null ? legal.filter((m) => Math.floor(m / 11) === sel).map((m) => m % 11) : []);
    const movable = new Set(legal.map((m) => Math.floor(m / 11)));
    const old = prev.hare && prev.hare.h === A.handle ? prev.hare : null;
    let s = `<svg viewBox="0 0 800 440" role="img" aria-label="ウサギと猟犬の盤">${HDEF('hg')}<rect width="800" height="440" rx="18" fill="#E3C48A"/><rect x="10" y="10" width="780" height="420" rx="12" fill="none" stroke="#C9AB74" stroke-width="2"/>`;
    b.adj.forEach((l, a) => l.forEach((c) => { if (c > a) s += `<path d="M${px(a)} ${py(a)}L${px(c)} ${py(c)}" stroke="#7a5a2a" stroke-width="5" stroke-linecap="round"/>`; }));
    let pieces = '';
    for (let i = 0; i < 11; i++) {
      const v = b.board[i], x = px(i), y = py(i);
      s += `<circle cx="${x}" cy="${y}" r="26" fill="#D2B078" stroke="#7a5a2a" stroke-width="3"/>`;
      // 置ける所: 黒い小さな点と、うすい輪(ユーザーが見本から選んだ B)
      if (tg.has(i)) s += `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="rgba(26,20,14,.35)" stroke-width="3"/><circle cx="${x}" cy="${y}" r="6.5" fill="#1A140E"/>`;
      if (sel === i) s += `<circle cx="${x}" cy="${y}" r="46" fill="rgba(255,198,92,.3)" stroke="#B98318" stroke-width="4"/>`;
      if (v) { const from = old && b.last >= 0 && b.last % 11 === i && b.last !== old.last ? Math.floor(b.last / 11) : -1; pieces += `<g class="hpiece" ${from >= 0 ? `data-dx="${px(from) - x}" data-dy="${py(from) - y}"` : ''}>${v === 1 ? hHound(x, y, 30) : hHare(x, y + 2, 30)}${b.last >= 0 && b.last % 11 === i ? `<circle cx="${x + 23}" cy="${y + (v === 1 ? -23 : -17)}" r="8" fill="#E2553A" stroke="#fff" stroke-width="2.8" pointer-events="none"/>` : ''}</g>`; }
    }
    for (let i = 0; i < 11; i++) s += `<circle cx="${px(i)}" cy="${py(i)}" r="52" fill="transparent" data-i="${i}" class="${movable.has(i) || tg.has(i) ? 'mtap' : ''}"/>`;
    prev.hare = { h: A.handle, last: b.last };
    A.board(s.replace('</svg>', '') + pieces + s.slice(s.length) + '</svg>', (d) => {
      if (d.i == null || !A.view.human) return; const i = +d.i;
      if (sel != null && legal.includes(sel * 11 + i)) { A.sel = null; return A.play(sel * 11 + i); }
      A.sel = movable.has(i) && sel !== i ? i : null; A.redraw();
    });
    requestAnimationFrame(() => document.querySelectorAll('.hpiece[data-dx]').forEach((e) => e.animate([{ transform: `translate(${e.dataset.dx}px,${e.dataset.dy}px)` }, { transform: 'none' }], { duration: 340 * A.speed, easing: 'cubic-bezier(.22,.9,.3,1)' })));
    A.anim(360); if (old && b.last !== old.last) A.land(330);
  }

  // ---------------------------------------------------------------- ヒット＆ブロー(数字の札・履歴・数字のボタン)
  function hitblow(b, A) {
    const me = A.mySeat, human = A.view.human, turn = A.view.toMove;
    const pad0 = (v) => String(v).padStart(b.digits, '0');
    A.strip(b.solo ? `<div class="pl turn">${A.face(24)}<span class="who"><span class="nm">${esc(A.name(0))}</span><span class="nt">ひとりで挑戦</span></span><span class="num">${(b.guesses[0] || []).length}<small>回</small></span></div>`
      : [me, 1 - me].map((p) => `<div class="pl${turn === p ? ' turn' : ''}">${p === me ? A.face(24) : `<span class="dot face">${esc(A.name(p)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(p))}</span><span class="nt">${p === 0 ? '先手' : '後手'}</span></span><span class="num">${(b.guesses[p] || []).length}<small>回</small></span></div>`).join(''));
    const tiles = (t, cls = '') => `<span class="hbt ${cls}">${[...t].map((ch) => `<i>${ch}</i>`).join('')}</span>`;
    const old = prev.hb && prev.hb.h === A.handle ? prev.hb.n : null;
    const list = (seat, title, k) => { const g = b.guesses[seat] || []; const isNew = old && g.length > old[k];
      return `<div class="hbcol"><h4>${title}</h4><div class="hbrows">${g.map(([code, h, bl], i) => `<div class="hbrow ${isNew && i === g.length - 1 ? 'new' : ''}"><span class="hbn">${i + 1}</span>${tiles(pad0(code))}<span class="hbr"><b class="hit">${h}<small>ヒット</small></b><b class="blow">${bl}<small>ブロー</small></b></span></div>`).join('') || '<div class="hbe">まだありません</div>'}</div></div>`; };
    const entered = typeof A.sel === 'string' ? A.sel : '';
    const used = new Set(entered.split(''));
    const label = b.setting && !human && !b.solo && b.secrets[me] >= 0 ? '相手の数を当ててください' : b.setting ? 'あなたの秘密の数を決めてください' : b.solo ? 'CPU が決めた数を当ててください' : human ? '相手の数を当ててください' : `${esc(A.name(turn >= 0 ? turn : 0))} が考えています`;
    const secret = !b.solo && b.secrets[me] >= 0 ? `<div class="hbs"><small>あなたの数</small>${tiles(pad0(b.secrets[me]), 'mine')}</div>` : '';
    const full = entered.length === b.digits;
    const padHtml = `<div class="hbpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button data-d="${d}" ${!human || used.has(String(d)) || entered.length >= b.digits ? 'disabled' : ''}>${d}</button>`).join('')}<button data-d="clr" class="clr" ${!human || !entered ? 'disabled' : ''}>取り消し</button><button data-d="ok" class="ok" ${full && human ? '' : 'disabled'}>決定</button></div>`;
    const decide = () => { if (!(entered.length === b.digits && human)) return; const m = parseInt(entered, 10); A.sel = null; A.play(m); };
    const input = (v) => { if (!human) return false; if (v === 'clr') A.sel = ''; else if (v === 'del') A.sel = entered.slice(0, -1); else if (v === 'ok') { decide(); return true; } else if (entered.length < b.digits && !used.has(v)) A.sel = entered + v; else return true; A.redraw(); return true; };
    // 数字キーで入れる・Backspace で 1 つ消す・Enter で決定
    A.key((e) => { if (/^[0-9]$/.test(e.key)) return input(e.key); if (e.key === 'Backspace') return input('del'); if (e.key === 'Enter' && entered.length === b.digits) return input('ok'); if (e.key === 'Delete') return input('clr'); return false; });
    prev.hb = { h: A.handle, n: b.solo ? [(b.guesses[0] || []).length, 0] : [(b.guesses[me] || []).length, (b.guesses[1 - me] || []).length] };
    A.board(`<div class="hb2"><div class="hbleft">${b.solo ? list(0, 'あなたの答え', 0) : list(me, 'あなたの答え', 0) + list(1 - me, '相手の答え', 1)}</div>
      <div class="hbright">${secret}<div class="hbl">${label}</div><div class="hbentry">${Array.from({ length: b.digits }, (_, i) => `<span class="${entered[i] != null ? 'f' : ''} ${i === entered.length && human ? 'cur' : ''}">${entered[i] ?? ''}</span>`).join('')}</div>${padHtml}</div></div>`, (d) => { if (d.d != null) input(d.d); });
    requestAnimationFrame(() => document.querySelectorAll('.hbrows').forEach((e) => (e.scrollTop = e.scrollHeight)));
  }

  // ---------------------------------------------------------------- ヨット(サイコロは「ふるふる」。得点表は右)
  const YN = ['1の目', '2の目', '3の目', '4の目', '5の目', '6の目', 'チョイス', 'フォーダイス', 'フルハウス', 'Sストレート', 'Bストレート', 'ヨット'];
  const YH = ['1 の目の合計', '2 の目の合計', '3 の目の合計', '4 の目の合計', '5 の目の合計', '6 の目の合計', '5 個の合計', '同じ目 4 個で合計', '3 個 + 2 個で合計', '4 つ続きで 15 点', '5 つ続きで 30 点', '同じ目 5 個で 50 点'];
  function ysc(dice, cat) {
    const cnt = [0, 0, 0, 0, 0, 0, 0]; dice.forEach((v) => cnt[v]++); const sum = dice.reduce((a, c) => a + c, 0);
    if (cat <= 5) return cnt[cat + 1] * (cat + 1); if (cat === 6) return sum; if (cat === 7) return cnt.some((c) => c >= 4) ? sum : 0;
    if (cat === 8) { const v = cnt.slice(1).filter((c) => c); return v.length === 1 || (v.length === 2 && v.includes(3)) ? sum : 0; }
    const has = (a) => a.every((x) => cnt[x] > 0);
    if (cat === 9) return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 15 : 0;
    if (cat === 10) return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 30 : 0;
    return cnt.some((c) => c === 5) ? 50 : 0;
  }
  let yPick = null, yKeep = 0, yRolling = false, yRollUntil = 0, yLastCell = '';
  function yacht(b, A) {
    const me = A.mySeat, legal = new Set(A.view.human ? A.view.legal : []), turn = A.view.toMove;
    const tot = (k) => b.sheets[k].reduce((a, c) => a + Math.max(c, 0), 0) + (b.sheets[k].slice(0, 6).reduce((a, c) => a + Math.max(c, 0), 0) >= 63 ? 35 : 0);
    A.strip(Array.from({ length: b.players }, (_, k) => `<div class="pl${turn === k ? ' turn' : ''}">${k === me ? A.face(24) : `<span class="dot face">${esc(A.name(k)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(k))}</span><span class="nt">合計</span></span><span class="num">${tot(k)}</span></div>`).join(''));
    const old = prev.ya && prev.ya.h === A.handle ? prev.ya : null;
    if (!old || old.turn !== b.turn || !(b.rollsLeft < 3)) yKeep = 0;
    const rolled = b.rollsLeft < 3, mine = A.view.human;
    // キープは、同じ番の間は残す(CPU の番は、CPU が残したサイコロを見せる)
    const cpuMask = !mine && rolled && old && old.turn === b.turn && A.lastMove >= 0 && A.lastMove < 32 ? A.lastMove : 0;
    const mask = mine ? yKeep : cpuMask;
    const rolledNow = old && (old.left !== b.rollsLeft || old.turn !== b.turn) && rolled;
    if (!old || old.turn !== b.turn || old.left !== b.rollsLeft) yPick = null;
    const dice = b.dice.map((v, i) => { const held = (mask >> i) & 1;
      return `<button class="yd ${held ? 'held' : ''} ${rolledNow && (old.turn !== b.turn || !((mask >> i) & 1)) ? 'roll' : ''}" data-die="${i}" data-v="${v}" ${mine && rolled ? '' : 'disabled'} aria-label="サイコロ ${v || ''}"><span class="d2 ${v > 0 ? '' : 'gray'}">${dface(v > 0 ? v : i + 1)}</span></button>`; }).join('');
    // ほかの人が最後に書いた欄(次にだれかが書くまで光らせる)
    if (old && old.sheets) for (let k = 0; k < b.players; k++) for (let c2 = 0; c2 < b.sheets[k].length; c2++) if (old.sheets[k][c2] < 0 && b.sheets[k][c2] >= 0) yLastCell = k !== me ? `${k}-${c2}` : '';
    if (!old) yLastCell = '';
    const cell = (k, cat) => { const v = b.sheets[k][cat], at = `data-ycell="${k}-${cat}"`;
      if (v >= 0) return `<td class="ys ${yLastCell === `${k}-${cat}` ? 'ylast' : ''}" ${at}>${v}</td>`;
      if (k === me && legal.has(100 + cat) && rolled) return `<td class="yp ${yPick === cat ? 'pick' : ''}" data-cat="${cat}" ${at}>${ysc(b.dice, cat)}</td>`;
      if (k === turn && k !== me && rolled && !A.view.human) return `<td class="yp cpu" ${at}>${ysc(b.dice, cat)}</td>`;
      return `<td ${at}></td>`; };
    const rows = YN.map((nm, cat) => `<tr><th>${nm}<small>${YH[cat]}</small></th>${Array.from({ length: b.players }, (_, k) => cell(k, cat)).join('')}</tr>${cat === 5 ? `<tr class="bonus"><th>ボーナス<small>上の 6 つで 63 点以上なら +35</small></th>${Array.from({ length: b.players }, (_, k) => { const t = b.sheets[k].slice(0, 6).reduce((a, c) => a + Math.max(c, 0), 0); return `<td class="ys">${t >= 63 ? '+35' : `${t}/63`}</td>`; }).join('')}</tr>` : ''}`).join('');
    const head = Array.from({ length: b.players }, (_, k) => `<th class="${turn === k ? 'on' : ''}">${esc(A.name(k))}</th>`).join('');
    prev.ya = { h: A.handle, left: b.rollsLeft, turn: b.turn, dice: b.dice.slice(), keepSent: prev.yaSent || 0, sheets: b.sheets.map((r) => r.slice()) }; prev.yaSent = 0;
    if (!old || old.left !== b.rollsLeft || old.turn !== b.turn) yRolling = false;
    // 振っている間(サイコロが止まるまで)は、もう一度押せない
    if (rolledNow) yRollUntil = performance.now() + 1000 * A.speed;
    const shaking = performance.now() < yRollUntil;
    if (shaking) setTimeout(() => { if (document.querySelector('.yroll')) A.redraw(); }, yRollUntil - performance.now() + 20);
    const rollMove = rolled ? mask : 0, canRoll = legal.has(rollMove) && b.rollsLeft > 0 && !yRolling && !shaking;
    const left = Array.from({ length: 3 }, (_, k) => `<i class="${k < b.rollsLeft ? 'on' : ''}"></i>`).join('');
    A.board(`<div class="yacht2"><div class="ytray">
        <div class="yturn">${turn >= 0 ? `${esc(A.name(turn))} の番` : ''}</div>
        <div class="ydice">${dice}</div>
        <button class="yroll ${A.remoteTurn && b.rollsLeft > 0 ? 'waiting' : ''}" data-roll="1" ${canRoll || (A.remoteTurn && b.rollsLeft > 0) ? '' : 'disabled'} ${!mine ? 'tabindex="-1"' : ''}>サイコロを振る</button>
        <div class="yleft"><span>残り回数</span><b class="num">${b.rollsLeft}</b><span class="ydots">${left}</span></div>
</div>
      <div class="ysheet"><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}<tr class="total"><th>合計</th>${Array.from({ length: b.players }, (_, k) => `<td class="ys">${tot(k)}</td>`).join('')}</tr></tbody></table></div></div>`, (d) => {
      if (d.roll != null) { if (canRoll) { yRolling = true; const rb = document.querySelector('.yroll'); if (rb) rb.disabled = true; prev.yaSent = rolled ? mask : 0; A.play(rollMove); } return; }
      // 3 回振り切った後も、キープの印は付け外しできる(押しても反応しないのは不自然なので)
      if (d.die != null && mine && rolled) { yKeep = mask ^ (1 << +d.die); return A.redraw(); }
      if (d.cat != null && legal.has(100 + +d.cat)) { const c = +d.cat; if (yPick === c) { yPick = null; yKeep = 0; return A.play(100 + c); } yPick = c; A.redraw(); }
    });
    if (rolledNow) {
      // ふるふる: 左右に振ってから、目が決まる
      document.querySelectorAll('.yd.roll').forEach((e, i) => { const d2 = e.querySelector('.d2'), v = +e.dataset.v, dl = i * 60;
        e.animate([{ transform: 'rotate(-14deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(6deg)' }, { transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 700 * A.speed, delay: dl });
        const iv = setInterval(() => (d2.innerHTML = dface(1 + Math.floor(Math.random() * 6))), 70); setTimeout(() => { clearInterval(iv); d2.innerHTML = dface(v); }, 520 * A.speed + dl); });
      A.anim(1000); A.land(0);
    }
  }

  Object.assign(window.RENDER, { hex, mancala, dots, hare, hitblow, yacht });
})();
