/* 駒を置く・動かすゲームの盤(2026-11-14 (2)): 置く時は上から置き、動かす時は滑らせ、着地で音。
 * 五目ならべ・碁・ナインメンズモリス・チェッカー・チェス・チャイニーズチェッカー・バックギャモン・ルドー。規則は持たない。 */
(() => {
  const { pair } = window.BOARDKIT;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GOLD = '#E0AD4A', LINE = '#22180c';
  // 最新の手の印(石の色によらず見える赤)
  const lastMark = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E2553A" stroke="#fff" stroke-width="${r * .35}"/>`;
  // カーソルを合わせたマスに、薄く石を出す
  const tapG = (x, y, G, i, can, ghost) => can ? `<g class="tapg"><g class="gh">${ghost}</g><rect x="${x - G / 2}" y="${y - G / 2}" width="${G}" height="${G}" fill="transparent" data-i="${i}" class="tapc"/></g>` : `<rect x="${x - G / 2}" y="${y - G / 2}" width="${G}" height="${G}" fill="transparent" data-i="${i}"/>`;
  const DEFS = `<radialGradient id="kB" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6b6b72"/><stop offset=".35" stop-color="#2a2a30"/><stop offset="1" stop-color="#0c0c10"/></radialGradient>
<radialGradient id="kW" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#ece7d9"/><stop offset="1" stop-color="#bdb59f"/></radialGradient>
<radialGradient id="kR" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#FFC2B4"/><stop offset=".3" stop-color="#E25A42"/><stop offset=".85" stop-color="#9A2414"/><stop offset="1" stop-color="#6E180C"/></radialGradient>
<radialGradient id="kU" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#CFE2FF"/><stop offset=".3" stop-color="#4F86D6"/><stop offset=".85" stop-color="#1E4789"/><stop offset="1" stop-color="#132F5E"/></radialGradient>
<radialGradient id="kG" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#C9F0D2"/><stop offset=".3" stop-color="#43A86B"/><stop offset=".85" stop-color="#1B5E37"/><stop offset="1" stop-color="#103C23"/></radialGradient>
<radialGradient id="kY" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#FFF6C8"/><stop offset=".3" stop-color="#EDBE2E"/><stop offset=".85" stop-color="#A47A06"/><stop offset="1" stop-color="#6E5203"/></radialGradient>
<radialGradient id="kP" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#E8D9FF"/><stop offset=".3" stop-color="#8E63D6"/><stop offset=".85" stop-color="#4B2C8A"/><stop offset="1" stop-color="#2F1A5A"/></radialGradient>
<radialGradient id="kK" cx=".33" cy=".28" r=".85"><stop offset="0" stop-color="#A9A9B2"/><stop offset=".3" stop-color="#4A4A52"/><stop offset=".85" stop-color="#1C1C22"/><stop offset="1" stop-color="#0A0A0E"/></radialGradient>
<radialGradient id="kHole" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#3a2414"/><stop offset=".75" stop-color="#5a3a20"/><stop offset="1" stop-color="#8a6034"/></radialGradient>
<linearGradient id="kWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C79A5E"/><stop offset=".5" stop-color="#B4844A"/><stop offset="1" stop-color="#9C6E3A"/></linearGradient>`;
  const stoneG = (x, y, r, g, extra = '') => `<circle cx="${x + r * .1}" cy="${y + r * .2}" r="${r}" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"${extra}/>`;
  const prev = {};
  const tr = (el) => el.style.transformBox = 'fill-box';

  // 前の局面と比べて、動いた駒・置いた駒・取られた駒を出す
  function diff(A, key, cells, same = (a, b) => a === b) {
    const o = prev[key] && prev[key].h === A.handle ? prev[key].cells : null;
    prev[key] = { h: A.handle, cells: cells.slice() };
    if (!o || o.length !== cells.length) return { moves: [], adds: [], gone: [] };
    const added = [], removed = [];
    cells.forEach((v, i) => { if (v && o[i] !== v) added.push(i); if (o[i] && o[i] !== v) removed.push(i); });
    const used = new Set(), moves = [], adds = [];
    for (const i of added) { const j = removed.find((j) => !used.has(j) && !cells[j] && same(o[j], cells[i])); if (j != null) { used.add(j); moves.push([j, i]); } else adds.push(i); }
    const gone = removed.filter((j) => !used.has(j)).map((j) => [j, o[j]]);
    return { moves, adds, gone };
  }
  // 置く(上から)・滑らせる・消える
  function animPlace(el, ms, delay = 0) { if (!el) return; el.style.transformOrigin = 'center'; tr(el); el.animate([{ transform: 'translateY(-40%) scale(1.35)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: .75 }, { transform: 'none', opacity: 1 }], { duration: ms, delay, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'backwards' }); }
  function animSlide(el, pts, ms, lift = 0) {
    if (!el || pts.length < 2) return; const [ex, ey] = pts[pts.length - 1];
    const fr = []; const n = pts.length - 1;
    pts.forEach(([x, y], k) => { fr.push({ transform: `translate(${x - ex}px,${y - ey}px) scale(${k > 0 && k < n ? 1 + lift : k === 0 ? 1 + lift * .6 : 1})`, offset: k / n }); if (k < n && lift) { const [x2, y2] = pts[k + 1]; fr.push({ transform: `translate(${(x + x2) / 2 - ex}px,${(y + y2) / 2 - ey}px) scale(${1 + lift * 1.6})`, offset: (k + .5) / n }); } });
    fr.sort((a, b) => a.offset - b.offset); el.style.transformOrigin = 'center'; tr(el);
    el.animate(fr, { duration: ms, easing: 'cubic-bezier(.45,.05,.3,1)' });
  }
  function animHop(el, pts, ms, h) {
    if (!el || pts.length < 2) return; const [ex, ey] = pts[pts.length - 1], n = pts.length - 1, fr = [];
    pts.forEach(([x, y], k) => { fr.push({ transform: `translate(${x - ex}px,${y - ey}px)`, offset: k / n, easing: 'ease-out' }); if (k < n) { const [x2, y2] = pts[k + 1]; fr.push({ transform: `translate(${(x + x2) / 2 - ex}px,${(y + y2) / 2 - ey - h}px)`, offset: (k + .5) / n, easing: 'ease-in' }); } });
    el.style.transformOrigin = 'center'; tr(el); el.animate(fr, { duration: ms });
  }
  function animKnock(el, dx, dy, delay, A) {
    if (!el) return; const L = Math.hypot(dx, dy) || 1; el.style.transformOrigin = 'center'; el.style.transformBox = 'fill-box';
    el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx / L * 3}px,${dy / L * 3 - 2}px) rotate(${dx >= 0 ? 25 : -25}deg) scale(1.1)`, opacity: 1, offset: .35 }, { transform: `translate(${dx / L * 9}px,${dy / L * 9 + 4}px) rotate(${dx >= 0 ? 80 : -80}deg) scale(.55)`, opacity: 0 }], { duration: 420 * A.speed, delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
  }
  function animGone(el, ms, delay) { if (!el) return; el.style.transformOrigin = 'center'; tr(el); el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: ms, delay, easing: 'ease-in', fill: 'forwards' }); }
  const q = (sel) => document.querySelector('#boardwrap ' + sel);

  // ---------------------------------------------------------------- 五目ならべ
  const lineSeen = {};
  // そろった列の見せ方(Android 版と同じ: 脈打つ光の輪・白い縁・端から端への白い線)。pts = 中心の座標、u = 1 マスの大きさ
  function winFx(pts, u, fresh, delay = 0, col = '#F5B83D') {
    const glow = pts.map(([x, y]) => `<circle class="wglow" cx="${x}" cy="${y}" r="${u * .62}" fill="url(#wglowG)"/>`).join('');
    const ring = pts.map(([x, y]) => `<circle class="wring" cx="${x}" cy="${y}" r="${u * .42}" fill="none" stroke="${col}" stroke-width="${u * .08}"/>`).join('');
    const [a, z] = [pts[0], pts[pts.length - 1]];
    return `<defs><radialGradient id="wglowG"><stop offset="0" stop-color="#FFF3B0" stop-opacity=".55"/><stop offset=".6" stop-color="#FFE27A" stop-opacity=".45"/><stop offset="1" stop-color="#FFE27A" stop-opacity="0"/></radialGradient></defs>`
      + `<g class="wfx ${fresh ? 'go' : ''}" style="--wd:${delay}ms" pointer-events="none">${glow}${ring}<path class="wline2" pathLength="1" d="M${a[0]} ${a[1]}L${z[0]} ${z[1]}" stroke="${col}" stroke-width="${u * .2}" stroke-linecap="round" fill="none"/></g>`;
  }
  function gomoku(b, A) {
    pair(A, '黒', '#15151A', '白', '#F6F2E8;border:1px solid #B9AC8C');
    const legal = new Set(A.view.human ? A.view.legal : []), win = new Set(b.win);
    const N = 15, G = 5.6, M = 6, size = M * 2 + G * (N - 1);
    const d = diff(A, 'gomoku', b.cells);
    let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="五目ならべの盤"><defs>${DEFS}</defs><rect width="${size}" height="${size}" rx="2" fill="#E3C48A"/>`;
    for (let i = 0; i < N; i++) s += `<path d="M${M + i * G} ${M}V${M + (N - 1) * G}M${M} ${M + i * G}H${M + (N - 1) * G}" stroke="${LINE}" stroke-width=".3"/>`;
    for (const r of [3, 7, 11]) for (const c of [3, 7, 11]) s += `<circle cx="${M + c * G}" cy="${M + r * G}" r=".75" fill="${LINE}"/>`;
    let st = '', taps = '';
    for (let i = 0; i < N * N; i++) {
      const x = M + (i % N) * G, y = M + Math.floor(i / N) * G, v = b.cells[i];
      if (v) st += `<g data-pc="${i}">${stoneG(x, y, 2.5, v === 1 ? 'kB' : 'kW')}${b.last === i ? lastMark(x, y, .85) : ''}</g>`;
      taps += tapG(x, y, G, i, legal.has(i), stoneG(x, y, 2.5, A.view.toMove === 0 ? 'kB' : 'kW'));
    }
    // そろった 5 つ: 脈打つ光の輪 + 白い縁 + 結ぶ線(Android 版と同じ。盤の状態から描くので、描き直しても消えない)
    let wl = '';
    if (b.win && b.win.length >= 2) {
      const P = (i) => [M + (i % N) * G, M + Math.floor(i / N) * G], pts = b.win.map(P).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const k = A.handle + ':' + b.win.join(','), fresh = lineSeen.gomoku !== k; lineSeen.gomoku = k;
      wl = winFx(pts, G, fresh, 260 * A.speed);
      if (fresh) A.anim(260 * A.speed + 700);
    }
    A.board(s + st + wl + taps + '</svg>', (e) => { if (e.i != null && legal.has(+e.i)) A.play(+e.i); });
    d.adds.forEach((i) => animPlace(q(`[data-pc="${i}"]`), 230 * A.speed));
    if (d.adds.length) { A.land(200); A.anim(260); }
  }

  // ---------------------------------------------------------------- 碁
  function go(b, A) {
    pair(A, '黒', '#15151A', '白', '#F6F2E8;border:1px solid #B9AC8C', b.captures);
    const legal = new Set(A.view.human ? A.view.legal : []);
    const n = b.n, G = n === 19 ? 4.3 : n === 13 ? 6 : 8.6, M = 6, size = M * 2 + G * (n - 1);
    const d = diff(A, 'go' + n, b.board);
    const P = (i) => [M + (i % n) * G, M + Math.floor(i / n) * G];
    let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="碁盤"><defs>${DEFS}</defs><rect width="${size}" height="${size}" rx="2" fill="#E3C48A"/>`;
    for (let i = 0; i < n; i++) s += `<path d="M${M + i * G} ${M}V${M + (n - 1) * G}M${M} ${M + i * G}H${M + (n - 1) * G}" stroke="${LINE}" stroke-width=".3"/>`;
    const stars = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : [2, 4, 6];
    for (const r of stars) for (const c of stars) s += `<circle cx="${M + c * G}" cy="${M + r * G}" r=".75" fill="${LINE}"/>`;
    let st = '', taps = '';
    for (let i = 0; i < n * n; i++) {
      const [x, y] = P(i), v = b.board[i], dead = b.dead && b.dead[i];
      if (v) st += `<g data-pc="${i}"${dead ? ' opacity=".4"' : ''}>${stoneG(x, y, G * .47, v === 1 ? 'kB' : 'kW')}${b.last === i ? lastMark(x, y, G * .15) : ''}</g>`;
      if (b.owner && b.owner[i] > 0 && (!v || dead)) st += `<rect x="${x - G * .17}" y="${y - G * .17}" width="${G * .34}" height="${G * .34}" fill="${b.owner[i] === 1 ? '#15151A' : '#FFFDF5'}" stroke="#7a5a2a" stroke-width=".2"/>`;
      taps += tapG(x, y, G, i, legal.has(i) && !v, stoneG(x, y, G * .47, A.view.toMove === 0 ? 'kB' : 'kW'));
    }
    // 取られた石は、少しの間うすく残して消す
    const ghosts = d.gone.map(([j, v]) => { const [x, y] = P(j); return `<g data-gh="${j}">${stoneG(x, y, G * .47, v === 1 ? 'kB' : 'kW')}</g>`; }).join('');
    A.board(s + st + ghosts + taps + '</svg>', (e) => { if (e.i != null && legal.has(+e.i)) A.play(+e.i); });
    A.acts([{ label: 'パス', move: n * n, enabled: legal.has(n * n) }, { label: '降参', move: n * n + 1, enabled: legal.has(n * n + 1) }]);
    d.adds.forEach((i) => animPlace(q(`[data-pc="${i}"]`), 230 * A.speed));
    d.gone.forEach(([j]) => animGone(q(`[data-gh="${j}"]`), 260 * A.speed, 240 * A.speed));
    if (d.adds.length) { A.land(200); A.anim(d.gone.length ? 520 : 260); }
  }

  // ---------------------------------------------------------------- ナインメンズモリス
  const MP = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
  const ML = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23], [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
  function morris(b, A) {
    pair(A, '白', '#F6F2E8;border:1px solid #B9AC8C', '黒', '#15151A', [b.inHand[0] + b.board.filter((v) => v === 1).length, b.inHand[1] + b.board.filter((v) => v === 2).length]);
    const legal = new Set(A.view.human ? A.view.legal : []);
    const K = 14, M = 7, X = (i) => M + MP[i][0] * K, Y = (i) => M + MP[i][1] * K, size = M * 2 + 6 * K;
    const d = diff(A, 'morris', b.board);
    let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="ナインメンズモリスの盤"><defs>${DEFS}</defs><rect width="${size}" height="${size}" rx="3" fill="#E3C48A"/>`;
    for (const [a, , c] of ML) s += `<path d="M${X(a)} ${Y(a)}L${X(c)} ${Y(c)}" stroke="#6b4e25" stroke-width=".7"/>`;
    const selFrom = A.sel != null ? A.sel : -1, targets = new Set();
    if (selFrom >= 0) for (let t = 0; t < 24; t++) if (legal.has(100 + selFrom * 24 + t)) targets.add(t);
    let st = '', taps = '';
    for (let i = 0; i < 24; i++) {
      s += `<circle cx="${X(i)}" cy="${Y(i)}" r="1.3" fill="#6b4e25"/>`;
      const v = b.board[i];
      if (v) st += `<g data-pc="${i}">${stoneG(X(i), Y(i), 4.6, v === 1 ? 'kW' : 'kB')}</g>`;
      if (b.last >= 0 && (b.last === i || (b.last >= 100 && b.last < 1000 && (b.last - 100) % 24 === i))) st += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.3" fill="none" stroke="${GOLD}" stroke-width=".7"/>`;
      if (selFrom === i) st += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.4" fill="none" stroke="#B98318" stroke-width="1.1"/>`;
      if (targets.has(i) || (legal.has(i) && !v)) st += `<circle cx="${X(i)}" cy="${Y(i)}" r="1.9" fill="#B98318"/>`;
      if (legal.has(1000 + i)) st += `<circle cx="${X(i)}" cy="${Y(i)}" r="5.4" fill="none" stroke="#C8463C" stroke-width="1.1" stroke-dasharray="1.6 1.2"/>`;
      taps += `<circle cx="${X(i)}" cy="${Y(i)}" r="6" fill="transparent" data-i="${i}"/>`;
    }
    const ghosts = d.gone.map(([j, v]) => `<g data-gh="${j}">${stoneG(X(j), Y(j), 4.6, v === 1 ? 'kW' : 'kB')}</g>`).join('');
    // 3 つそろった(ミル): 最後に置いた・動かした駒を含む列を、光と線で見せる(盤の状態から描くので、通信対戦の描き直しでも消えない)
    let ml = '';
    const dest = b.last >= 0 && b.last < 24 ? b.last : b.last >= 100 && b.last < 1000 ? (b.last - 100) % 24 : -1;
    let shown = false;
    if (dest >= 0 && b.board[dest]) for (const tri of ML) if (tri.includes(dest) && tri.every((j) => b.board[j] === b.board[dest])) {
      const k = A.handle + ':' + tri.join(',') + ':' + b.last, fresh = lineSeen.morris !== k; lineSeen.morris = k;
      lineSeen.morrisTri = { h: A.handle, tri, v: b.board[dest] }; shown = true;
      ml += winFx(tri.map((j) => [X(j), Y(j)]), K * .75, fresh, 280 * A.speed);
      if (fresh) A.anim(280 * A.speed + 700);
    }
    // 駒を取った直後も、取るきっかけになった 3 つの列を出したままにする(次の手まで)
    const mt = lineSeen.morrisTri;
    if (!shown && b.last >= 1000 && mt && mt.h === A.handle && mt.tri.every((j) => b.board[j] === mt.v)) ml += winFx(mt.tri.map((j) => [X(j), Y(j)]), K * .75, false);
    else if (!shown) lineSeen.morrisTri = null;
    A.board(s + st + ml + ghosts + taps + '</svg>', (e) => {
      if (e.i == null) return; const i = +e.i;
      if (legal.has(1000 + i)) return A.play(1000 + i);
      if (legal.has(i)) return A.play(i);
      if (selFrom >= 0 && legal.has(100 + selFrom * 24 + i)) { A.sel = null; return A.play(100 + selFrom * 24 + i); }
      const has = [...legal].some((m) => m >= 100 && m < 1000 && Math.floor((m - 100) / 24) === i);
      A.sel = b.board[i] === A.mySeat + 1 && has && selFrom !== i ? i : null; A.redraw();
    });
    d.moves.forEach(([f, t]) => animSlide(q(`[data-pc="${t}"]`), [[X(f), Y(f)], [X(t), Y(t)]], 340 * A.speed, .1));
    d.adds.forEach((i) => animPlace(q(`[data-pc="${i}"]`), 240 * A.speed));
    d.gone.forEach(([j]) => animGone(q(`[data-gh="${j}"]`), 260 * A.speed, 0));
    if (d.moves.length) { A.land(330); A.anim(380); } else if (d.adds.length) { A.land(210); A.anim(260); } else if (d.gone.length) { A.land(0); A.anim(260); }
  }

  // ---------------------------------------------------------------- チェッカー(跳んだ道筋どおりに動かす)
  function checkers(b, A) {
    pair(A, '黒', '#15151A', '白', '#F6F2E8;border:1px solid #B9AC8C');
    const flip = A.mySeat === 1;
    const D = (i) => { const r = Math.floor(i / 8), c = i % 8; return flip ? [7 - r, 7 - c] : [r, c]; };
    const C = (i) => { const [r, c] = D(i); return [2 + c * 10 + 5, 2 + r * 10 + 5]; };
    const prefix = A.sel || null, paths = A.view.human ? b.paths : [];
    const cand = prefix ? paths.map((p, k) => [p, k]).filter(([p]) => prefix.every((v, j) => p[j] === v)) : [];
    const next = new Set(cand.filter(([p]) => p.length > prefix.length).map(([p]) => p[prefix.length]));
    const starts = new Set(paths.map((p) => p[0]));
    const d = diff(A, 'checkers', b.cells, (a, c) => (a >= 3) === (c >= 3));
    let s = `<svg viewBox="0 0 84 84" role="img" aria-label="チェッカーの盤"><defs>${DEFS}</defs><rect width="84" height="84" rx="3" fill="#2F2A24"/>`;
    const lastSet = new Set(b.lastPath);
    for (let i = 0; i < 64; i++) { const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1; s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${dark ? '#769656' : '#EEEED2'}"/>`; if (lastSet.has(i)) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${GOLD}" opacity=".35"/>`; }
    let st = '', taps = '';
    for (let i = 0; i < 64; i++) {
      const [x, y] = C(i), v = b.cells[i];
      if (v) {
        const white = v >= 3, king = v === 2 || v === 4;
        st += `<g data-pc="${i}">${stoneG(x, y, 3.9, white ? 'kW' : 'kB')}<circle cx="${x}" cy="${y}" r="2.6" fill="none" stroke="${white ? '#B9AC8C' : '#55555c'}" stroke-width=".35"/>${king ? crown(x, y + .3, 4.6) : ''}</g>`;
        if ((prefix && prefix[0] === i) || (!prefix && starts.has(i))) st += `<circle cx="${x}" cy="${y}" r="4.6" fill="none" stroke="${prefix ? '#B98318' : GOLD}" stroke-width="${prefix ? 1 : .5}" ${prefix ? '' : 'opacity=".55"'}/>`;
      }
      if (next.has(i)) st += `<circle cx="${x}" cy="${y}" r="1.7" fill="#B98318"/>`;
      taps += `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="transparent" data-i="${i}"/>`;
    }
    const ghosts = d.gone.map(([j, v]) => { const [x, y] = C(j); return `<g data-gh="${j}">${stoneG(x, y, 3.9, v >= 3 ? 'kW' : 'kB')}</g>`; }).join('');
    A.board(s + st + ghosts + taps + '</svg>', (e) => {
      if (e.i == null || !A.view.human) return; const i = +e.i;
      if (prefix && next.has(i)) {
        const np = prefix.concat(i), done = paths.findIndex((p) => p.length === np.length && p.every((v, j) => v === np[j])), longer = paths.some((p) => p.length > np.length && np.every((v, j) => p[j] === v));
        if (done >= 0 && !longer) { A.sel = null; return A.play(done); }
        A.sel = np; return A.redraw();
      }
      A.sel = starts.has(i) && !(prefix && prefix[0] === i && prefix.length === 1) ? [i] : null; A.redraw();
    });
    const lp = b.lastPath || [];
    if (d.moves.length && lp.length >= 2) {
      const to = lp[lp.length - 1], hops = lp.length - 1, ms = (300 + (hops - 1) * 230) * A.speed;
      animSlide(q(`[data-pc="${to}"]`), lp.map(C), ms, hops > 1 || Math.abs(lp[1] - lp[0]) > 9 ? .18 : .08);
      d.gone.forEach(([j], k) => { const [gx, gy] = C(j), [px0, py0] = C(lp[Math.min(k, lp.length - 1)]); animKnock(q(`[data-gh="${j}"]`), gx - px0, gy - py0, ms * (k + .55) / hops, A); A.sfx('WOOD', (ms * (k + .55) / hops) / A.speed + 60, { volume: .7, rate: 1.15 }); });
      A.land(ms / A.speed - 20); A.anim(ms / A.speed + 60);
    }
  }

  // ---------------------------------------------------------------- チェス
  const CHK = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' }, CH_NAME = { 5: 'クイーン', 4: 'ルーク', 3: 'ビショップ', 2: 'ナイト' };
  const cFrom = (m) => m & 63, cTo = (m) => (m >> 6) & 63, cPro = (m) => (m >> 12) & 15;
  function chess(b, A) {
    pair(A, '白', '#F6F2E8;border:1px solid #B9AC8C', '黒', '#15151A');
    const flip = A.mySeat === 1;
    const D = (i) => { const r = Math.floor(i / 8), c = i % 8; return flip ? [7 - r, 7 - c] : [r, c]; };
    const sel = A.sel, targets = new Map();
    if (sel != null && A.view.human) for (const m of A.view.legal) if (cFrom(m) === sel) { const t = cTo(m); (targets.get(t) || targets.set(t, []).get(t)).push(m); }
    const movable = new Set(A.view.human ? A.view.legal.map(cFrom) : []);
    const d = diff(A, 'chess', b.board, (a, c) => (a > 0) === (c > 0) && (Math.abs(a) === Math.abs(c) || Math.abs(a) === 1));
    let s = `<svg viewBox="0 0 84 84" role="img" aria-label="チェスの盤"><rect width="84" height="84" rx="3" fill="#2F2A24"/>`;
    const lastF = b.last >= 0 ? cFrom(b.last) : -1, lastT = b.last >= 0 ? cTo(b.last) : -1;
    for (let i = 0; i < 64; i++) {
      const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
      s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${dark ? '#769656' : '#EEEED2'}"/>`;
      if (i === lastF || i === lastT) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="${GOLD}" opacity=".4"/>`;
      if (b.board[i] === 6 * (b.turn === 0 ? 1 : -1) && b.check) s += `<rect x="${x}" y="${y}" width="10" height="10" fill="#C8463C" opacity=".5"/>`;
    }
    const piece = (v, x, y) => { const white = v > 0, p = window.CHESS_PATHS[CHK[Math.abs(v)]]; return `<ellipse cx="${x + 5.3}" cy="${y + 9}" rx="3.4" ry="1" fill="#000" opacity=".3"/><g transform="translate(${x + 5},${y + 5.3}) scale(.235)" filter="url(#xSh)"><path d="${p}" fill-rule="evenodd" fill="url(#${white ? 'xPw' : 'xPb'})" stroke="${white ? '#8d7c58' : '#0c0806'}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-11.5 13.5H11.5" stroke="${white ? '#6b5a3c' : '#000'}" stroke-opacity=".45" stroke-width="1.2"/><path d="${p}" fill-rule="evenodd" fill="url(#xPh)" opacity="${white ? .55 : .3}"/>${window.CHESS_SLIT[CHK[Math.abs(v)]] ? `<path d="${window.CHESS_SLIT[CHK[Math.abs(v)]]}" fill="none" stroke="${white ? '#8d7c58' : '#6a5a48'}" stroke-width="1.5" stroke-linecap="round"/>` : ''}</g>`; };
    let st = '', taps = '';
    for (let i = 0; i < 64; i++) {
      const [r, c] = D(i), x = 2 + c * 10, y = 2 + r * 10, v = b.board[i];
      if (v) st += `<g data-pc="${i}">${piece(v, x, y)}</g>`;
      if (v && sel === i) st += `<rect x="${x + .4}" y="${y + .4}" width="9.2" height="9.2" fill="none" stroke="#B98318" stroke-width=".9"/>`;
      if (targets.has(i)) st += v && (v > 0) !== (A.mySeat === 0) && A.caps ? `<rect x="${x + .6}" y="${y + .6}" width="8.8" height="8.8" rx="1" fill="none" stroke="#E2553A" stroke-width=".9"/>` : `<circle cx="${x + 5}" cy="${y + 5}" r="1.7" fill="#B98318" opacity=".85"/>`;
      taps += `<rect x="${x}" y="${y}" width="10" height="10" fill="transparent" data-i="${i}"/>`;
    }
    const XY = (i) => { const [r, c] = D(i); return [2 + c * 10, 2 + r * 10]; };
    const ghosts = d.gone.map(([j, v]) => `<g data-gh="${j}">${piece(v, ...XY(j))}</g>`).join('');
    A.board(s + ghosts + st + taps + '</svg>', (e) => {
      if (e.i == null || !A.view.human) return; const i = +e.i;
      const ms = sel != null ? A.view.legal.filter((m) => cFrom(m) === sel && cTo(m) === i) : [];
      if (ms.length === 1) { A.sel = null; return A.play(ms[0]); }
      if (ms.length > 1) { A.sheet(`<h2>何に変えますか</h2><div class="btns">${ms.map((m) => `<button class="btn" data-m="${m}">${CH_NAME[cPro(m)] || '成らない'}</button>`).join('')}</div>`, (el) => el.querySelectorAll('button[data-m]').forEach((x) => (x.onclick = () => { A.closeSheet(); A.sel = null; A.play(+x.dataset.m); }))); return; }
      A.sel = movable.has(i) && sel !== i ? i : null; A.redraw();
    });
    // 取った駒は、動いた駒が着く時に消える
    const ms = 360 * A.speed;
    d.moves.forEach(([f, t]) => animSlide(q(`[data-pc="${t}"]`), [XY(f), XY(t)], ms, Math.abs(b.board[t]) === 2 ? .12 : .04));
    d.gone.forEach(([j]) => { const mvd = d.moves.find(([, t]) => t === j); const [fx, fy] = mvd ? XY(mvd[0]) : XY(j), [tx, ty] = XY(j);
      animKnock(q(`[data-gh="${j}"]`), tx - fx, ty - fy, ms * .82, A); A.sfx('WOOD', 340 + 120, { volume: .7, rate: 1.15 }); });
    if (d.moves.length) { A.land(340); A.anim(d.gone.length ? 760 : 400); }
  }

  // ---------------------------------------------------------------- チャイニーズチェッカー(木の盤・くぼみ・ガラス玉)
  const CC_G = ['kR', 'kU', 'kG', 'kY', 'kP', 'kK'], CC_COL = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AD4A', '#7A5AC0', '#2A2A30'];
  function chinese(b, A) {
    const me = A.mySeat, players = b.camps.length;
    A.strip(Array.from({ length: players }, (_, k) => `<div class="pl${A.view.toMove === k ? ' turn' : ''}"><span class="dot" style="background:${CC_COL[k]}"></span><span class="who"><span class="nm">${esc(A.name(k))}</span><span class="nt">${A.note(k) || ''}</span></span></div>`).join(''));
    const legal = A.view.human ? A.view.legal : [], sel = A.sel;
    const tg = new Set(sel != null ? legal.filter((m) => Math.floor(m / 128) === sel).map((m) => m % 128) : []);
    const movable = new Set(legal.map((m) => Math.floor(m / 128)));
    const Dd = 5.2, X0 = 52, Y0 = 50;
    const P = (i) => { const [qq, r] = b.pts[i]; return [X0 + (qq + r / 2) * Dd, Y0 + r * Dd * 0.866]; };
    const d = diff(A, 'cc', b.board);
    let s = `<svg viewBox="0 0 104 100" role="img" aria-label="チャイニーズチェッカーの盤"><defs>${DEFS}</defs><circle cx="52.4" cy="51" r="49" fill="#000" opacity=".3"/><circle cx="52" cy="50" r="49" fill="url(#kWood)"/><circle cx="52" cy="50" r="46.6" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".6"/><circle cx="52" cy="50" r="45" fill="none" stroke="rgba(0,0,0,.18)" stroke-width=".5"/>`;
    // 陣地の色(うすく)
    const triOf = (i) => { const [qq, r] = b.pts[i], ss = -qq - r; return r < -4 ? 'a' : r > 4 ? 'b' : qq > 4 ? 'c' : qq < -4 ? 'd' : ss > 4 ? 'e' : ss < -4 ? 'f' : ''; };
    if (!prev.ccTri || prev.ccTri.h !== A.handle) { const m = {}; b.board.forEach((v, i) => { const t = triOf(i); if (v && t) m[t] = v - 1; }); prev.ccTri = { h: A.handle, m }; }
    for (let i = 0; i < b.pts.length; i++) { const t = triOf(i), k = prev.ccTri.m[t]; if (t && k != null) { const [x, y] = P(i); s += `<circle cx="${x}" cy="${y}" r="2.55" fill="${CC_COL[k]}" opacity=".22"/>`; } }
    let st = '', taps = '';
    for (let i = 0; i < b.pts.length; i++) {
      const [x, y] = P(i), v = b.board[i];
      s += `<circle cx="${x}" cy="${y}" r="1.3" fill="url(#kHole)"/><circle cx="${x}" cy="${y + .25}" r="1.3" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".18"/>`;
      if (v) st += `<g data-pc="${i}"><circle cx="${x + .25}" cy="${y + .55}" r="1.95" fill="#000" opacity=".32"/><circle cx="${x}" cy="${y}" r="1.95" fill="url(#${CC_G[v - 1]})"/><ellipse cx="${x - .6}" cy="${y - .75}" rx=".7" ry=".42" fill="#fff" opacity=".75" transform="rotate(-30 ${x - .6} ${y - .75})"/></g>`;
      if (sel === i) st += `<circle cx="${x}" cy="${y}" r="2.6" fill="none" stroke="#FFF6D8" stroke-width=".55"/>`;
      else if (!sel && A.view.human && movable.has(i) && A.hints) st += `<circle cx="${x}" cy="${y}" r="2.45" fill="none" stroke="rgba(255,246,216,.55)" stroke-width=".3"/>`;
      if (tg.has(i)) st += `<circle cx="${x}" cy="${y}" r=".85" fill="#FFF6D8"/>`;
      if (b.last >= 0 && b.last % 128 === i) st += `<circle cx="${x}" cy="${y}" r="2.6" fill="none" stroke="${GOLD}" stroke-width=".45"/>`;
      taps += `<circle cx="${x}" cy="${y}" r="2.6" fill="transparent" data-i="${i}"/>`;
    }
    A.board(s + st + taps + '</svg>', (e) => {
      if (e.i == null || !A.view.human) return; const i = +e.i;
      if (sel != null && legal.includes(sel * 128 + i)) { A.sel = null; return A.play(sel * 128 + i); }
      A.sel = movable.has(i) && sel !== i ? i : null; A.redraw();
    });
    if (d.moves.length) { const [f, t] = d.moves[0], dist = Math.hypot(P(f)[0] - P(t)[0], P(f)[1] - P(t)[1]), ms = Math.min(700, 260 + dist * 14) * A.speed; animSlide(q(`[data-pc="${t}"]`), [P(f), P(t)], ms, dist > 6 ? .25 : .08); A.land(ms / A.speed - 10); A.anim(ms / A.speed + 50); }
  }

  // ---------------------------------------------------------------- サイコロ(SVG。振ると「ふるふる」)
  const PIP = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const pips = (v, s, gray) => (PIP[v] || PIP[5]).map(([a, c]) => `<circle cx="${a * s * .27}" cy="${c * s * .27}" r="${s * (v === 1 ? .13 : .085)}" fill="${gray ? '#C9C2B0' : v === 1 ? '#C8362E' : '#15151A'}"/>`).join('');
  const dieSvg = (x, y, s, v, o = {}) => `<g class="sdie ${o.cls || ''}" data-dv="${v}" data-ds="${s}" transform="translate(${x},${y})" ${o.attr || ''} opacity="${o.dim ? .45 : 1}"><rect x="${-s / 2 + s * .04}" y="${-s / 2 + s * .1}" width="${s}" height="${s}" rx="${s * .2}" fill="#000" opacity=".3"/><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * .2}" fill="#FFFDF5" stroke="#B9AC8C" stroke-width="${s * .03}"/><g class="pp">${pips(v || 5, s, !v)}</g></g>`;
  function shakeDice(A, sel) {
    document.querySelectorAll(sel).forEach((g, i) => {
      const s = +g.dataset.ds, v = +g.dataset.dv, pp = g.querySelector('.pp'), inner = g;
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.parentNode.insertBefore(wrap, g); wrap.appendChild(g); wrap.setAttribute('transform', g.getAttribute('transform')); g.removeAttribute('transform');
      g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
      g.animate([{ transform: 'rotate(-16deg)' }, { transform: 'rotate(16deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(5deg)' }, { transform: 'scale(1.2)' }, { transform: 'none' }], { duration: 700 * A.speed, delay: i * 70 * A.speed });
      const iv = setInterval(() => (pp.innerHTML = pips(1 + Math.floor(Math.random() * 6), s)), 70);
      setTimeout(() => { clearInterval(iv); pp.innerHTML = pips(v, s); }, (520 + i * 70) * A.speed); void inner;
    });
    A.anim(900);
  }

  // ---------------------------------------------------------------- バックギャモン(実物に近い盤。文字は使わない)
  function backgammon(b, A) {
    const me = A.mySeat;
    pair(A, '白(先手)', '#F6F2E8;border:1px solid #B9AC8C', '黒(後手)', '#15151A', [b.off[0], b.off[1]]);
    const legal = A.view.human ? A.view.legal : [], mv = legal.filter((m) => m >= 1000), sel = A.sel, turnSeat = A.view.toMove;
    const white = (turnSeat >= 0 ? turnSeat : me) === 0;
    const dest = (from, die) => { if (white) { const t = from === 24 ? 24 - die : from - die; return t < 0 ? -1 : t; } const t = from === 24 ? die - 1 : from + die; return t > 23 ? -1 : t; };
    const moves = mv.map((m) => ({ m, from: Math.floor((m - 1000) / 10), die: (m - 1000) % 10 }));
    const tg = new Map(); if (sel != null) for (const x of moves) if (x.from === sel) tg.set(dest(x.from, x.die), x.m);
    const fromSet = new Set(moves.map((x) => x.from));
    const W = 200, H = 140, F = 6, TW = 13, BAR = 12, OFFW = 16, R = 5.6;
    const left0 = F, right0 = F + 6 * TW + BAR, field = F + 12 * TW + BAR;
    const X = (i) => { const col = i >= 12 ? i - 12 : 11 - i; return (col < 6 ? left0 + col * TW : right0 + (col - 6) * TW) + TW / 2; };
    const top = (i) => i >= 12, SY = (i, k, n) => { const step = n > 5 ? Math.min(2 * R, (H / 2 - F - R - 6) / (n - 1)) : 2 * R; return top(i) ? F + R + k * step : H - F - R - k * step; };
    const BX = F + 6 * TW + BAR / 2, OX = field + OFFW / 2 + 2;
    // 動いた駒を見つける(前のポイントの数と比べる)
    const key = 'bg', o = prev[key] && prev[key].h === A.handle ? prev[key] : null;
    const cnt = (pts, bar, off) => [...pts.map((v) => v), bar[0], -bar[1], off[0], -off[1]];
    const now = cnt(b.points, b.bar, b.off);
    prev[key] = { h: A.handle, c: now, dice: b.dice.join(','), shown: b.shown.join(',') };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="バックギャモンの盤"><defs>${DEFS}<radialGradient id="bgGlowB"><stop offset=".5" stop-color="#2E86FF" stop-opacity="0"/><stop offset=".74" stop-color="#4C9BFF" stop-opacity=".95"/><stop offset="1" stop-color="#4C9BFF" stop-opacity="0"/></radialGradient><radialGradient id="bgGlowR"><stop offset=".5" stop-color="#FF3B30" stop-opacity="0"/><stop offset=".74" stop-color="#FF4A3D" stop-opacity=".95"/><stop offset="1" stop-color="#FF4A3D" stop-opacity="0"/></radialGradient><linearGradient id="bgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBDDBE"/><stop offset="1" stop-color="#DCCBA4"/></linearGradient></defs>
      <rect width="${W}" height="${H}" rx="6" fill="#5A3A22"/><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="5" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1"/>
      <rect x="${left0}" y="${F}" width="${6 * TW}" height="${H - 2 * F}" fill="url(#bgF)"/><rect x="${right0}" y="${F}" width="${6 * TW}" height="${H - 2 * F}" fill="url(#bgF)"/>
      <rect x="${F + 6 * TW}" y="${F - 2}" width="${BAR}" height="${H - 2 * F + 4}" fill="#4A2F1B"/><rect x="${field + 2}" y="${F}" width="${OFFW}" height="${H - 2 * F}" rx="2" fill="#3E2716"/><rect x="${field + 2}" y="${H / 2 - .6}" width="${OFFW}" height="1.2" fill="#5A3A22"/>`;
    for (let i = 0; i < 24; i++) {
      const x = X(i), t = top(i), dark = (i % 2 === 0) === t;
      s += `<polygon points="${x - TW / 2 + .5},${t ? F : H - F} ${x + TW / 2 - .5},${t ? F : H - F} ${x},${t ? F + 52 : H - F - 52}" fill="${dark ? '#9E2B25' : '#2C4A3E'}"/>`;
      if (tg.has(i)) s += `<polygon points="${x - TW / 2 + .5},${t ? F : H - F} ${x + TW / 2 - .5},${t ? F : H - F} ${x},${t ? F + 52 : H - F - 52}" fill="#FFC65C" opacity=".35"/>`;
    }
    let st = '';
    const chk = (x, y, side, attr = '') => `<g ${attr}>${stoneG(x, y, R, side === 0 ? 'kW' : 'kK')}<circle cx="${x}" cy="${y}" r="${R * .62}" fill="none" stroke="${side === 0 ? '#C9BFA6' : '#55555c'}" stroke-width=".5"/></g>`;
    for (let i = 0; i < 24; i++) {
      const n = Math.abs(b.points[i]), side = b.points[i] > 0 ? 0 : 1, x = X(i);
      for (let k = 0; k < n; k++) st += chk(x, SY(i, k, n), side, k === n - 1 ? `data-top="${i}"` : '');
      if (sel === i && n) { const t = top(i); st = `<polygon points="${x - TW / 2 + .5},${t ? F : H - F} ${x + TW / 2 - .5},${t ? F : H - F} ${x},${t ? F + 58 : H - F - 58}" fill="#E5322B" opacity=".25"/>` + st; st += `<circle cx="${x}" cy="${SY(i, n - 1, n)}" r="${R + 4.2}" fill="url(#bgGlowR)" class="bgpulse"/>`; }
      else if (sel == null && A.view.human && fromSet.has(i) && n && A.hints) st += `<circle cx="${x}" cy="${SY(i, n - 1, n)}" r="${R + 4}" fill="url(#bgGlowB)" class="bgpulse"/>`;
    }
    for (const side of [0, 1]) for (let k = 0; k < b.bar[side]; k++) st += chk(BX, side === 0 ? H / 2 + 14 + k * 2 * R * .8 : H / 2 - 14 - k * 2 * R * .8, side, k === b.bar[side] - 1 ? `data-top="bar${side}"` : '');
    if (sel === 24) st += `<rect x="${F + 6 * TW}" y="${F}" width="${BAR}" height="${H - 2 * F}" fill="none" stroke="#FFC65C" stroke-width="1.2"/>`;
    // 上がった駒(横から見た薄い板)
    for (const side of [0, 1]) for (let k = 0; k < b.off[side]; k++) { const y = side === 0 ? H - F - 3 - k * 3.6 : F + 3 + k * 3.6; st += `<rect x="${field + 3.5}" y="${y - 1.5}" width="${OFFW - 3}" height="3" rx="1.2" fill="${side === 0 ? '#F3EEE0' : '#2A2A30'}" stroke="${side === 0 ? '#B9AC8C' : '#000'}" stroke-width=".4"/>`; }
    // サイコロ(自分の側の盤の真ん中)
    const dv = b.dice.length ? b.dice : b.shown, rolledNow = o && b.dice.length && (o.dice !== b.dice.join(',') || o.shown !== b.shown.join(',')) && b.dice.length >= 2 && (o.dice === '' || b.dice.length >= (o.dice.split(',').length));
    const canRoll = legal.includes(0);
    const dxc = (turnSeat === me ? right0 + 3 * TW : left0 + 3 * TW), dyc = H / 2;
    let dice = '';
    if (canRoll) dice = `<g data-roll="1" class="bgroll">${dieSvg(dxc - 9, dyc, 14, 0)}${dieSvg(dxc + 9, dyc, 14, 0)}<rect x="${dxc - 22}" y="${dyc - 12}" width="44" height="24" fill="transparent"/></g>`;
    else if (dv.length) dice = dv.slice(0, 4).map((v, k, l) => dieSvg(dxc + (k - (l.length - 1) / 2) * 17, dyc, 14, v, { cls: 'bgd', dim: !b.dice.length })).join('');
    const mySide = white ? 0 : 1;
    const ghostAt = (i) => { const n = b.points[i] === 0 || (b.points[i] > 0) === (mySide === 0) ? Math.abs(b.points[i]) : 0; return chk(X(i), SY(i, n, n + 1), mySide); };
    const taps = Array.from({ length: 24 }, (_, i) => { const r = `<rect x="${X(i) - TW / 2}" y="${top(i) ? F : H / 2}" width="${TW}" height="${H / 2 - F}" fill="transparent" data-p="${i}"/>`; return tg.has(i) ? `<g class="tapg"><g class="gh">${ghostAt(i)}</g>${r}</g>` : r; }).join('')
      + `<rect x="${F + 6 * TW}" y="${F}" width="${BAR}" height="${H - 2 * F}" fill="transparent" data-p="24"/>`
      + (tg.has(-1) ? `<g class="tapg"><rect x="${field + 2}" y="${F}" width="${OFFW}" height="${H - 2 * F}" fill="rgba(255,217,79,.25)"/><g class="gh"><rect x="${field + 3.5}" y="${mySide === 0 ? H - F - 3 - b.off[0] * 3.6 - 1.5 : F + 3 + b.off[1] * 3.6 - 1.5}" width="${OFFW - 3}" height="3" rx="1.2" fill="${mySide === 0 ? '#F3EEE0' : '#2A2A30'}"/></g><rect x="${field + 2}" y="${F}" width="${OFFW}" height="${H - 2 * F}" fill="transparent" data-off="1"/></g>` : `<rect x="${field + 2}" y="${F}" width="${OFFW}" height="${H - 2 * F}" fill="transparent" data-off="1"/>`);
    A.board(s + st + taps + dice + '</svg>', (e) => {
      if (!A.view.human) return;
      if (e.roll != null && canRoll) return A.play(0);
      let to = null; if (e.off != null) to = -1; else if (e.p != null) to = +e.p;
      if (to != null && sel != null && tg.has(to)) { A.sel = null; return A.play(tg.get(to)); }
      if (e.p != null) { const i = +e.p; A.sel = moves.some((x) => x.from === i) && sel !== i ? i : null; A.redraw(); }
    });
    A.acts([{ label: 'サイコロを振る', move: 0, enabled: canRoll }]);
    if (rolledNow) { shakeDice(A, '#boardwrap .sdie.bgd'); A.land(0); }
    // 動いた駒: 減ったポイントから増えたポイントへ滑らせる
    if (o) {
      const pos = (idx, side) => idx < 24 ? [X(idx), SY(idx, Math.max(0, Math.abs(b.points[idx]) - 1), Math.abs(b.points[idx]))] : idx < 26 ? [BX, H / 2] : [OX, side === 0 ? H - F - 6 : F + 6];
      const from = [], to = [];
      for (const side of [0, 1]) {
        const sg = side === 0 ? 1 : -1, cnt2 = (arr, k) => k < 24 ? Math.max(0, sg * arr[k]) : k === 24 + side ? Math.abs(arr[k]) : k === 26 + side ? Math.abs(arr[k]) : 0;
        for (let k = 0; k < 28; k++) { const dd = cnt2(now, k) - cnt2(o.c, k); if (dd < 0) from.push([k, side]); if (dd > 0) to.push([k, side]); }
      }
      to.forEach(([k, side]) => { const f = from.find(([fk, fs]) => fs === side); if (!f) return; from.splice(from.indexOf(f), 1);
        const el = k < 24 ? q(`[data-top="${k}"]`) : k < 26 ? q(`[data-top="bar${side}"]`) : null; if (!el) return;
        animSlide(el, [pos(f[0], side), pos(k, side)], 380 * A.speed, .1); A.land(360); A.anim(420); });
    }
  }

  // ---------------------------------------------------------------- ルドー(実物に近い盤。駒は人形の形)
  const RING = (() => { const r = []; for (let c = 1; c <= 5; c++) r.push([c, 6]); for (let y = 5; y >= 0; y--) r.push([6, y]); r.push([7, 0], [8, 0]); for (let y = 1; y <= 5; y++) r.push([8, y]); for (let c = 9; c <= 14; c++) r.push([c, 6]); r.push([14, 7], [14, 8]); for (let c = 13; c >= 9; c--) r.push([c, 8]); for (let y = 9; y <= 14; y++) r.push([8, y]); r.push([7, 14], [6, 14]); for (let y = 13; y >= 9; y--) r.push([6, y]); for (let c = 5; c >= 0; c--) r.push([c, 8]); r.push([0, 7], [0, 6]); return r; })();
  const LC = ['#D8443A', '#3E9B63', '#E8B52C', '#3F78C4'], LG = ['kR', 'kG', 'kY', 'kU'], LL = ['#F6C9C3', '#C6E6D1', '#F8E5AE', '#C7D8F0'];
  const HOMEC = [(i) => [1 + i, 7], (i) => [7, 1 + i], (i) => [13 - i, 7], (i) => [7, 13 - i]];
  const YARD = [[0, 0], [9, 0], [9, 9], [0, 9]];
  const BASEP = (slot, t) => { const [bx, by] = YARD[slot]; return [bx + 1.75 + (t % 2) * 2.5, by + 1.75 + Math.floor(t / 2) * 2.5]; };
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const xyOf = (p, slot, t) => p < 0 ? BASEP(slot, t) : p <= 50 ? RING[(slot * 13 + p) % 52] : p <= 55 ? HOMEC[slot](p - 51) : [6.2 + (t % 2) * 1.6 + (slot === 1 || slot === 2 ? 0 : 0), 6.2 + Math.floor(t / 2) * 1.6];
  const disc = (x, y, U, col, g) => `<circle cx="${x + U * .05}" cy="${y + U * .1}" r="${U * .38}" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="${U * .38}" fill="url(#${g})" stroke="#FFFDF7" stroke-width="${U * .07}"/><circle cx="${x}" cy="${y}" r="${U * .2}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="${U * .04}"/>`;
  const pawn = (x, y, U, col, g) => `<ellipse cx="${x}" cy="${y + U * .34}" rx="${U * .34}" ry="${U * .12}" fill="#000" opacity=".3"/><path d="M${x - U * .3} ${y + U * .3}Q${x - U * .28} ${y - U * .02} ${x - U * .11} ${y - U * .1}A${U * .2} ${U * .2} 0 1 1 ${x + U * .11} ${y - U * .1}Q${x + U * .28} ${y - U * .02} ${x + U * .3} ${y + U * .3}Z" fill="url(#${g})" stroke="${col}" stroke-width="${U * .04}" stroke-linejoin="round"/><ellipse cx="${x - U * .07}" cy="${y - U * .3}" rx="${U * .06}" ry="${U * .04}" fill="#fff" opacity=".7"/>`;
  function ludo(b, A) {
    const me = A.mySeat, U = 10, Wd = 15 * U;
    A.strip(Array.from({ length: b.n }, (_, k) => `<div class="pl${A.view.toMove === k ? ' turn' : ''}"><span class="dot" style="background:${LC[b.slots[k]]}"></span><span class="who"><span class="nm">${esc(A.name(k))}</span></span><span class="lbadge" title="家の駒"><i class="hm" style="--c:${LC[b.slots[k]]}"></i>${b.pos[k].filter((p) => p < 0).length}</span><span class="lbadge" title="ゴールした駒"><i class="gl"></i>${b.pos[k].filter((p) => p === 56).length}</span></div>`).join(''));
    const legal = new Set(A.view.human ? A.view.legal : []), C = ([x, y]) => [x * U + U / 2, y * U + U / 2];
    const used = new Set(b.slots);
    let s = `<svg viewBox="-4 -4 ${Wd + 8} ${Wd + 8}" role="img" aria-label="ルドーの盤"><defs>${DEFS}</defs><rect x="-4" y="-4" width="${Wd + 8}" height="${Wd + 8}" rx="8" fill="#6a4429"/><rect x="0" y="0" width="${Wd}" height="${Wd}" rx="2" fill="#FFFDF7"/>`;
    for (let k = 0; k < 4; k++) {
      const [bx, by] = YARD[k], on = used.has(k);
      s += `<rect x="${bx * U}" y="${by * U}" width="${6 * U}" height="${6 * U}" fill="${on ? LC[k] : LL[k]}"/><rect x="${bx * U + U}" y="${by * U + U}" width="${4 * U}" height="${4 * U}" rx="${U * .6}" fill="#FFFDF7"/>`;
      for (let t = 0; t < 4; t++) { const [x, y] = C(BASEP(k, t).map((v) => v - .5)); s += `<circle cx="${x}" cy="${y}" r="${U * .58}" fill="#EFE9DA" stroke="${on ? LC[k] : LL[k]}" stroke-width="${U * .12}"/><circle cx="${x}" cy="${y}" r="${U * .44}" fill="rgba(0,0,0,.07)"/>`; }
    }
    RING.forEach(([x, y], i) => { const start = [0, 13, 26, 39].indexOf(i); s += `<rect x="${x * U}" y="${y * U}" width="${U}" height="${U}" fill="${start >= 0 ? LC[start] : '#FFFDF7'}" stroke="#9A9184" stroke-width=".5"/>`; if (SAFE.has(i)) s += `<path d="${starPath(x * U + U / 2, y * U + U / 2, U * .34)}" fill="${start >= 0 ? '#FFFDF7' : '#C9C2B0'}"/>`; });
    for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) { const [x, y] = HOMEC[k](i); s += `<rect x="${x * U}" y="${y * U}" width="${U}" height="${U}" fill="${LC[k]}" stroke="#9A9184" stroke-width=".5"/>`; }
    const c0 = 6 * U, c1 = 9 * U, cm = 7.5 * U;
    s += `<polygon points="${c0},${c0} ${c1},${c0} ${cm},${cm}" fill="${LC[1]}"/><polygon points="${c1},${c0} ${c1},${c1} ${cm},${cm}" fill="${LC[2]}"/><polygon points="${c1},${c1} ${c0},${c1} ${cm},${cm}" fill="${LC[3]}"/><polygon points="${c0},${c1} ${c0},${c0} ${cm},${cm}" fill="${LC[0]}"/>`;
    // 駒(重なる時は少しずらす)
    const key = 'ludo', o = prev[key] && prev[key].h === A.handle ? prev[key] : null;
    prev[key] = { h: A.handle, pos: b.pos.map((p) => p.slice()), die: b.die, last: b.last };
    // 同じマスの駒: 同じ人なら 1 つにまとめて数を出す。ちがう人なら少しずらす
    const spots = new Map(); let pcs = '', badges = '';
    for (let k = 0; k < b.n; k++) for (let t = 0; t < 4; t++) { const p = b.pos[k][t]; if (p < 0 || p > 55) continue; const id = xyOf(p, b.slots[k], t).join(','); if (!spots.has(id)) spots.set(id, []); spots.get(id).push([k, t]); }
    for (let k = 0; k < b.n; k++) for (let t = 0; t < 4; t++) {
      const p = b.pos[k][t], slot = b.slots[k], xy = xyOf(p, slot, t), id = xy.join(',');
      let [x, y] = C(p < 0 ? xy.map((v) => v - .5) : xy);
      const here = spots.get(id) || [], owners = [...new Set(here.map(([kk]) => kk))], oi = owners.indexOf(k), mineHere = here.filter(([kk]) => kk === k);
      if (owners.length > 1) { x += (oi - (owners.length - 1) / 2) * U * .42; y += (oi - (owners.length - 1) / 2) * U * .2; }
      const can = k === A.view.toMove && legal.has(t + 1), first = mineHere.length && mineHere[0][1] === t;
      if (p >= 0 && p <= 55 && mineHere.length > 1 && !first && !can) continue;
      pcs += `<g data-tok="${k}-${t}" class="${can ? 'tokcan' : ''}">${disc(x, y, U, LC[slot], LG[slot])}${can ? `<circle cx="${x}" cy="${y}" r="${U * .55}" fill="transparent" data-t="${t + 1}"/>` : ''}</g>`;
      if (mineHere.length > 1 && first) badges += `<g pointer-events="none"><circle cx="${x + U * .36}" cy="${y - U * .34}" r="${U * .24}" fill="#15151A" stroke="#fff" stroke-width="${U * .05}"/><text x="${x + U * .36}" y="${y - U * .25}" font-size="${U * .3}" font-weight="900" text-anchor="middle" fill="#fff">${mineHere.length}</text></g>`;
    }
    pcs += badges;
    // サイコロ(真ん中)。振れる時はクリックで振る
    const canRoll = legal.has(0), rolledNow = o && b.die > 0 && (o.die !== b.die || o.last !== b.last) && b.last === 0;
    const die = `<g data-roll="1" class="${canRoll ? 'bgroll' : ''}"><rect x="${cm - 15}" y="${cm - 15}" width="30" height="30" rx="7" fill="rgba(255,253,247,.85)"/>${dieSvg(cm, cm, 20, b.die, { cls: 'ldie' })}</g>`;
    A.board(s + pcs + die + '</svg>', (e) => { if (e.roll != null && canRoll) return A.play(0); if (e.t != null && legal.has(+e.t)) A.play(+e.t); });
    A.acts([{ label: 'サイコロを振る', move: 0, enabled: canRoll }]);
    if (rolledNow) { shakeDice(A, '#boardwrap .ldie'); }
    // 動いた駒: 1 マスずつ跳ねて進む。取られた駒は家に戻る
    if (o) for (let k = 0; k < b.n; k++) for (let t = 0; t < 4; t++) {
      const a = o.pos[k][t], z = b.pos[k][t]; if (a === z) continue;
      const slot = b.slots[k], el = q(`[data-tok="${k}-${t}"]`); if (!el) continue;
      const P0 = (p) => C(p < 0 ? xyOf(p, slot, t).map((v) => v - .5) : xyOf(p, slot, t));
      let pts;
      if (z > a) { pts = []; for (let p = Math.max(a, -1); p <= z; p++) { if (p === -1 && a >= 0) continue; pts.push(P0(p)); } } else pts = [P0(a), P0(z)];
      const ms = Math.min(2400, 230 * (pts.length - 1) + 60) * A.speed;
      if (z > a) { animHop(el, pts, ms, U * .9); for (let k2 = 1; k2 < pts.length - 1; k2++) A.sfx('WOOD', (ms * k2 / (pts.length - 1)) / A.speed, { volume: .45, rate: 1.2 }); } else animSlide(el, pts, ms, .05);
      A.land(ms / A.speed - 20); A.anim(ms / A.speed + 80);
    }
  }
  function starPath(x, y, r) { let d = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q2 = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * q2).toFixed(1) + ' ' + (y + Math.sin(a) * q2).toFixed(1); } return d + 'Z'; }

  Object.assign(window.RENDER, { gomoku, go, morris, checkers, chess, chinese, backgammon, ludo });
  window.SVGDIE = { dieSvg, shakeDice };
})();
