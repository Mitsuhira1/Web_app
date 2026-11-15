/* リバーシと将棋(見本 docs/ui-sample-pc.html の盤・駒・動きをそのまま使う) */
(() => {
  // ---------------------------------------------------------------- リバーシ
  let prevRev = null;
  function reversi(b, A) {
    const { pair } = window.BOARDKIT;
    pair(A, '黒', 'radial-gradient(circle at 34% 26%,#7d7d7d,#262626 36%,#060606 78%)', '白', 'radial-gradient(circle at 34% 26%,#fff,#f3efe3 48%,#bdb5a0)', [b.black, b.white]);
    const hints = new Set(A.view.human && A.hints ? A.view.legal : []);
    const can = new Set(A.view.human ? A.view.legal : []);
    const old = prevRev && prevRev.h === A.handle ? prevRev.cells : null;
    let order = 0;
    const lr = b.last >= 0 ? [b.last % 8, b.last >> 3] : null;
    const cells = b.cells.map((v, i) => {
      let cls = '';
      if (old && v && old[i] === 0 && i === b.last) cls = 'drop';
      else if (old && v && old[i] && old[i] !== v) {
        const d = lr ? Math.max(Math.abs(i % 8 - lr[0]), Math.abs((i >> 3) - lr[1])) : order++;
        cls = `flip" style="--d:${((0.1 + (d - 1) * 0.05) * A.speed).toFixed(2)}s`;
      }
      const stone = v ? `<span class="stone ${v === 1 ? 'b' : 'w'} ${cls}"></span>` : '';
      return `<button class="cell ${hints.has(i) ? 'can' : ''} ${i === b.last ? 'last' : ''}" data-i="${i}" ${can.has(i) ? '' : 'disabled'} aria-label="${'abcdefgh'[i % 8]}${(i >> 3) + 1}">${stone}</button>`;
    }).join('');
    if (old && old.some((v, i) => v !== b.cells[i])) { A.anim(700); A.land(170); }
    prevRev = { h: A.handle, cells: b.cells.slice() };
    A.board(`<div class="board" style="--ghost:${A.view.toMove === 0 ? '#111' : '#f3efe3'}"><div class="cells">${cells}</div></div>`, (d) => {
      if (d.i != null && can.has(+d.i)) A.play(+d.i);
    });
  }

  // ---------------------------------------------------------------- 将棋・5五将棋
  const KN = { 1: '歩兵', 2: '香車', 3: '桂馬', 4: '銀将', 5: '金将', 6: '角行', 7: '飛車', 8: '王将', 9: 'と', 10: '成香', 11: '成桂', 12: '成銀', 13: '竜馬', 14: '竜王' };
  const HAND_ORDER = [7, 6, 5, 4, 3, 2, 1];
  const mFrom = (m) => (m >> 1) >> 7, mTo = (m) => (m >> 1) & 127, mPromo = (m) => m & 1;
  const KP = 'M0 -21L12 -15L16 19H-16L-12 -15Z';
  const komaSvg = (kind, owner) => {
    const n = kind === 8 && owner === 1 ? '玉将' : KN[kind];
    const red = kind >= 9 ? '#B3261C' : '#1c140c';
    const txt = n.length === 1 ? `<text x="0" y="7" font-family="Yuji Boku,serif" font-size="22" text-anchor="middle" fill="${red}">${n}</text>`
      : `<text x="0" y="-3" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="${red}">${n[0]}</text><text x="0" y="12" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="${red}">${n[1]}</text>`;
    return `<svg viewBox="-19 -24 38 48" aria-hidden="true"><path d="${KP}" fill="#b98f4c"/><path d="${KP}" transform="translate(0,-1.6)" fill="url(#xKm)" stroke="#8a6a35" stroke-width=".8"/>${txt}</svg>`;
  };
  let prevSh = null;
  function shogi(b, A) {
    const W = b.w, N = W * W, pct = 100 / W;
    const me = A.mySeat, flip = me === 1;
    const disp = (i) => { const r = Math.floor(i / W), c = i % W; return flip ? [W - 1 - r, W - 1 - c] : [r, c]; };
    const tag = (seat) => `<div class="pl${A.view.toMove === seat && !A.view.outcome ? ' turn' : ''}"><span class="dot koma-dot"></span><span class="who"><span class="nm">${A.name(seat)}</span><span class="nt">${seat === 0 ? '先手' : '後手'}${A.note(seat) && !/先手|後手/.test(A.note(seat)) ? '・' + A.note(seat) : ''}</span></span></div>`;
    A.strip(tag(me) + tag(1 - me));
    const sel = A.sel;
    const targets = new Map();
    if (sel && A.view.human) for (const m of A.view.legal) if (mFrom(m) === sel.from) { const t = mTo(m); (targets.get(t) || targets.set(t, []).get(t)).push(m); }
    const movable = new Set(A.view.human ? A.view.legal.map(mFrom) : []);
    const lastTo = b.last >= 0 ? mTo(b.last) : -1, lastFrom = b.last >= 0 ? mFrom(b.last) : -1;
    // 盤の線(彫った線)と星
    const lines = [['translate(.25,.25)', '#fff', '.3'], ['', '#1c130a', '.95']].map(([t, c, o]) => `<path transform="${t}" d="${Array.from({ length: W + 1 }, (_, i) => `M${i * 10} 0V${W * 10}M0 ${i * 10}H${W * 10}`).join('')}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`).join('');
    const stars = W === 9 ? [[30, 30], [60, 30], [30, 60], [60, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#1c130a"/>`).join('') : '';
    let cells = '';
    for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) {
      const i = flip ? (W - 1 - r) * W + (W - 1 - c) : r * W + c;
      const v = b.cells[i];
      const ok = targets.has(i);
      const cap = ok && v && (v > 0 ? 0 : 1) !== me && A.caps;
      const own = v && (v > 0 ? 0 : 1) === me;
      const tap = ok || (own && movable.has(i));
      cells += `<button class="scell ${ok ? 'can' : ''} ${cap ? 'cap' : ''} ${sel && sel.from === i ? 'from' : ''} ${i === lastTo ? 'lastto' : ''}" data-i="${i}" ${tap && A.view.human ? '' : 'disabled'} aria-label="${W - (i % W)}${'一二三四五六七八九'[Math.floor(i / W)]}"></button>`;
    }
    let pieces = '';
    const old = prevSh && prevSh.h === A.handle ? prevSh : null;
    for (let i = 0; i < N; i++) {
      const v = b.cells[i]; if (!v) continue;
      const kind = Math.abs(v), owner = v > 0 ? 0 : 1;
      const [r, c] = disp(i);
      let from = '';
      if (old && i === lastTo && b.last !== old.last) {
        if (lastFrom < N) { const [r0, c0] = disp(lastFrom); from = ` data-fx="${(c0 - c) * 100}" data-fy="${(r0 - r) * 100}"`; }
        else from = ' data-drop="1"';
      }
      pieces += `<span class="koma ${owner !== me ? 'op' : ''} ${sel && sel.from === i ? 'sel' : ''}"${from} style="left:${c * pct}%;top:${r * pct}%;width:${pct}%;height:${pct}%"><span class="kb">${komaSvg(kind, owner)}</span></span>`;
    }
    const hand = (side) => {
      let out = '';
      for (const k of HAND_ORDER) {
        const n = b.hands[side * 8 + k]; if (!n) continue;
        const mine = side === me, isSel = sel && sel.from === N + k && mine;
        const can = mine && A.view.human && movable.has(N + k);
        out += `<button class="hk ${side !== me ? 'op' : ''} ${isSel ? 'sel' : ''}" data-hand="${k}" ${can ? '' : 'disabled'} aria-label="${KN[k]} ${n}枚">${komaSvg(k, side)}${n > 1 ? `<b>${n}</b>` : ''}</button>`;
      }
      return `<div class="komadai ${side !== me ? 'top' : 'bottom'}">${out || '<span class="none">持ち駒なし</span>'}</div>`;
    };
    let capFly = null;
    if (old && b.last !== old.last && lastFrom < N && old.cells && old.cells[lastTo]) {
      for (const side of [0, 1]) for (const k of HAND_ORDER) if ((b.hands[side * 8 + k] || 0) > (old.hands[side * 8 + k] || 0)) capFly = { side, k, v: old.cells[lastTo] };
    }
    if (old && b.last !== old.last) { A.anim(capFly ? 900 : 420); A.land(lastFrom < N ? 340 : 280); if (capFly) A.sfx('KOMA', 760, { volume: .55, rate: .9 }); }
    prevSh = { h: A.handle, last: b.last, cells: b.cells.slice(), hands: b.hands.slice() };
    A.board(`<div class="shwrap ${W === 5 ? 'small' : ''}">${hand(1 - me)}<div class="sboard"><div class="sgrid" style="grid-template-columns:repeat(${W},1fr);grid-template-rows:repeat(${W},1fr)"><svg class="slines" viewBox="0 0 ${W * 10} ${W * 10}" preserveAspectRatio="none" aria-hidden="true">${lines}${stars}</svg>${cells}${pieces}</div></div>${hand(me)}</div>`, (d) => {
      if (!A.view.human) return;
      if (d.hand != null) {
        const k = +d.hand;
        A.sel = sel && sel.from === N + k ? null : movable.has(N + k) ? { from: N + k } : null;
        return A.redraw();
      }
      if (d.i == null) return;
      const i = +d.i;
      const ms = sel ? A.view.legal.filter((m) => mFrom(m) === sel.from && mTo(m) === i) : [];
      if (ms.length === 1) { A.sel = null; return A.play(ms[0]); }
      if (ms.length === 2) {
        const pro = ms.find((m) => mPromo(m)), no = ms.find((m) => !mPromo(m));
        A.sheet('<h2>成りますか</h2><div class="btns"><button class="btn gold" data-y>成る</button><button class="btn" data-n>成らない</button></div>', (box) => {
          box.querySelector('[data-y]').onclick = () => { A.closeSheet(); A.sel = null; A.play(pro); };
          box.querySelector('[data-n]').onclick = () => { A.closeSheet(); A.sel = null; A.play(no); };
        });
        return;
      }
      const v = b.cells[i];
      const own = v !== 0 && (v > 0 ? 0 : 1) === me;
      A.sel = own && movable.has(i) && !(sel && sel.from === i) ? { from: i } : null;
      A.redraw();
    });
    // 動いた駒: 元の場所から滑らせる(FLIP)。打った駒は上から置く
    requestAnimationFrame(() => {
      document.querySelectorAll('.koma[data-fx]').forEach((e) => {
        const fx = +e.dataset.fx, fy = +e.dataset.fy;
        e.classList.add('mv');
        e.animate([{ transform: `translate(${fx}%,${fy}%)` }, { transform: 'none' }], { duration: 360 * A.speed, easing: 'cubic-bezier(.22,.9,.3,1)' }).onfinish = () => e.classList.remove('mv');
      });
      document.querySelectorAll('.koma[data-drop]').forEach((e) => e.animate([{ transform: 'translateY(-30%) scale(1.25)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300 * A.speed, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
      if (capFly) {
        const cell = document.querySelector(`.scell[data-i="${lastTo}"]`), hk = document.querySelector(`.komadai.${capFly.side === me ? 'bottom' : 'top'} [data-hand="${capFly.k}"]`);
        if (cell && hk) {
          const a = cell.getBoundingClientRect(), z = hk.getBoundingClientRect(), owner = capFly.v > 0 ? 0 : 1;
          const g = document.createElement('div'); g.className = 'kfly'; g.innerHTML = komaSvg(Math.abs(capFly.v), owner);
          Object.assign(g.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' }); if (owner !== me) g.classList.add('op');
          document.body.appendChild(g);
          hk.animate([{ opacity: 0 }, { opacity: 0, offset: .99 }, { opacity: 1 }], { duration: 760 * A.speed });
          const dx = z.left + z.width / 2 - (a.left + a.width / 2), dy = z.top + z.height / 2 - (a.top + a.height / 2), sc = z.height / a.height;
          g.animate([{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 1, offset: .42 }, { transform: `translate(${dx * .5}px,${dy * .5 - 40}px) rotate(180deg) scale(1.15)`, opacity: 1, offset: .7 }, { transform: `translate(${dx}px,${dy}px) rotate(180deg) scale(${sc})`, opacity: 1 }], { duration: 780 * A.speed, easing: 'cubic-bezier(.4,0,.3,1)' }).onfinish = () => { g.remove(); hk.animate([{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: 180 }); };
        }
      }
    });
  }


  // ---------------------------------------------------------------- コネクトフォー(見本: 木の板と台、仮置き → 決定で落ちる)
  let prevC4 = null, c4pre = null;
  function c4(b, A) {
    const { pair } = window.BOARDKIT;
    pair(A, '赤', '#C8362E', '青', '#2F5FAE');
    const legal = new Set(A.view.human ? A.view.legal : []);
    const col = (v) => (v === 1 ? 'r' : 'u');
    const lowest = (c) => { for (let r = 0; r < 6; r++) if (!b.cells[r * 7 + c]) return r; return -1; };
    if (c4pre != null && !legal.has(c4pre)) c4pre = null;
    const turnCol = col(b.turn + 1);
    const land = c4pre != null ? lowest(c4pre) * 7 + c4pre : -1;
    const old = prevC4 && prevC4.h === A.handle ? prevC4.cells : null;
    const win = new Set(b.win || []);
    let discs = '';
    b.cells.forEach((v, i) => {
      if (!v) return;
      const r = Math.floor(i / 7), c = i % 7, dr = 5 - r;
      const fresh = old && !old[i] && i === b.last;
      discs += `<span class="c4d ${col(v)} ${fresh ? 'fresh' : ''} ${win.has(i) ? 'win' : ''}" data-r="${dr}" style="left:${c * 100 / 7}%;top:${dr * 100 / 6}%"></span>`;
    });
    const top = Array.from({ length: 7 }, (_, c) => `<div class="c4slot" data-col="${c}">${legal.has(c) ? `<span class="c4d ${turnCol} hov"></span>` : ''}</div>`).join('');
    const front = Array.from({ length: 42 }, (_, k) => { const dr = Math.floor(k / 7), c = k % 7, i = (5 - dr) * 7 + c; return `<button class="c4cell ${i === b.last ? 'lastc' : ''}" data-col="${c}" ${legal.has(c) && lowest(c) * 7 + c === i ? `data-land="${c}"` : ''} ${legal.has(c) ? '' : 'disabled'} aria-label="${c + 1}列"></button>`; }).join('');
    const ghostDiscs = Array.from({ length: 7 }, (_, c) => { if (!legal.has(c)) return ''; const r = lowest(c); return `<span class="c4d ${turnCol} c4gh" data-gc="${c}" style="left:${c * 100 / 7}%;top:${(5 - r) * 100 / 6}%"></span>`; }).join('');
    if (old && old.some((v, i) => v !== b.cells[i])) { A.anim(900); const fr = b.last >= 0 ? 5 - Math.floor(b.last / 7) : 3; A.land((430 + fr * 70) * 0.5); }
    prevC4 = { h: A.handle, cells: b.cells.slice() };
    A.board(`<div class="c4"><div class="c4top">${top}</div><div class="c4board"><div class="c4discs">${discs}${ghostDiscs}</div><div class="c4wood"></div><div class="c4front">${front}</div></div><div class="c4base"></div><div class="c4floor"></div></div>`, (d) => {
      if (d.col == null || !A.view.human) return;
      const c = +d.col; if (!legal.has(c)) return;
      c4pre = null; A.play(c);
    });
    const root = document.querySelector('#boardwrap .c4');
    if (root && A.view.human) {
      const hov = (c) => { root.querySelectorAll('.c4slot.h,.c4cell.land,.c4gh.on').forEach((e) => e.classList.remove('h', 'land', 'on')); if (c == null || !legal.has(c)) return;
        const sl = root.querySelector(`.c4slot[data-col="${c}"]`), ld = root.querySelector(`[data-land="${c}"]`), gh = root.querySelector(`[data-gc="${c}"]`); if (sl) sl.classList.add('h'); if (ld) ld.classList.add('land'); if (gh) gh.classList.add('on'); };
      root.onmouseover = (e) => { const t = e.target.closest('[data-col]'); hov(t ? +t.dataset.col : null); };
      root.onmouseleave = () => hov(null);
    }
    requestAnimationFrame(() => {
      const d = document.querySelector('.c4d.fresh'); if (!d) return;
      const dr = +d.dataset.r, h = d.offsetHeight / 0.8, dist = (dr + 1.15) * h, K = (o, y, e) => ({ offset: o, transform: `translateY(${-y}px)`, easing: e });
      d.animate([K(0, dist, 'cubic-bezier(.5,0,1,.7)'), K(.5, 0, 'cubic-bezier(0,.5,.5,1)'), K(.66, h * .42, 'cubic-bezier(.5,0,1,.5)'), K(.8, 0, 'cubic-bezier(0,.5,.5,1)'), K(.88, h * .14, 'cubic-bezier(.5,0,1,.5)'), K(.95, 0, 'ease-out'), K(.975, h * .035, 'ease-in'), K(1, 0)], { duration: (430 + dr * 70) * A.speed });
    });
  }

  Object.assign(window.RENDER, { reversi, shogi, c4 });
})();
