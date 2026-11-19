/* カードゲームの卓(見本の大富豪の卓の形: 木の枠の卓・まわりの席・中央の場・下に手札)。
 * 卓と手札の大きさは、札の枚数や操作で変わらない。規則は持たない(手の番号は core が決めたもの)。 */
(() => {
  const SU = ['♠', '♥', '♦', '♣'];
  const RK = (c) => { const r = c % 13 + 2; return r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : r === 14 ? 'A' : String(r); };
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OCC = ['#E0453A', '#F2B629', '#2E9E5B', '#2F6FD0'], OCN = ['赤', '黄', '緑', '青'];
  // トランプ 1 枚(id: 0〜51、52 = ジョーカー、-1 = 裏)
  function pc(id, cls = '', attr = '') {
    if (id == null || id < 0) return `<span class="pc back ${cls}" ${attr}></span>`;
    if (id === 52) return `<span class="pc joker ${cls}" ${attr}><i class="ix">JO<br>KER</i><b>★</b></span>`;
    const s = Math.floor(id / 13), red = s === 1 || s === 2;
    return `<span class="pc ${red ? 'r' : ''} ${cls}" ${attr}><i class="ix">${RK(id)}<br>${SU[s]}</i><b>${SU[s]}</b></span>`;
  }
  const face = (game, c, cls = '', attr = '', extra = '') => {
    if (c.back) return game === 'uno' ? `<span class="pc svgc ${cls}" ${attr}>${ohCard('back')}${extra}</span>` : game === 'hanafuda' ? `<span class="pc hback ${cls}" ${attr}>${extra}</span>` : pc(-1, cls, attr);
    if (game === 'uno') return `<span class="pc svgc ${cls}" ${attr}>${window.CARDFACE(game, c).html}${extra}</span>`;
    if (game === 'hanafuda') return `<span class="pc svgc hana ${cls}" ${attr} title="${esc(c.t)}">${window.HANA(c.id)}${extra}</span>`;
    return pc(c.id, cls, attr);
  };
  // 席の場所(自分は下。ほかの人は番の順に左 → 上 → 右)
  const POS = { 1: [[50, 11]], 2: [[17, 24], [83, 24]], 3: [[9, 50], [50, 10], [91, 50]], 4: [[9, 56], [28, 12], [72, 12], [91, 56]], 5: [[8, 60], [19, 19], [50, 9], [81, 19], [92, 60]] };
  const POS_TOP = { 1: [[50, 9]], 2: [[30, 9], [70, 9]], 3: [[20, 9], [50, 9], [80, 9]], 4: [[14, 9], [38, 9], [62, 9], [86, 9]], 5: [[10, 9], [30, 9], [50, 9], [70, 9], [90, 9]] };
  function seatsOf(A, total, me, top) {
    const others = []; for (let k = 1; k < total; k++) others.push((me + k) % total);
    const pos = (top ? POS_TOP : POS)[others.length] || [];
    return others.map((seat, i) => ({ seat, x: pos[i][0], y: pos[i][1] }));
  }
  const seatHtml = (A, s, o = {}) => `<div class="tseat ${A.view.toMove === s.seat && !A.view.outcome ? 'turn' : ''} ${o.dim ? 'dim' : ''}" data-seat="${s.seat}" style="left:${s.x}%;top:${s.y}%">
    <div class="tplate"><span class="face">${esc(A.name(s.seat)[0])}</span><span class="tn">${esc(A.name(s.seat))}</span>${o.count != null ? `<span class="left"><i></i><b class="num">${o.count}</b></span>` : ''}</div>
    ${o.note ? `<small class="tnote ${o.noteCls || ''}">${esc(o.note)}</small>` : ''}${o.extra || ''}</div>`;
  const chip = (n, cls = '') => `<span class="chips ${cls}"><i></i><b class="num">${n}</b></span>`;
  const prev = {};   // 前に描いた時の札(新しく出た札だけ動かす)
  const fresh = (A, key, ids) => { const k = A.handle + ':' + key, old = prev[k]; prev[k] = ids.slice(); return old ? ids.filter((x) => !old.includes(x)) : []; };
  const strip = (b, A) => A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === A.mySeat && A.face ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${esc(s.v)}</span></span></div>`).join(''));
  const zoneOf = (b, re) => b.zones.find((z) => re.test(z.label)) || { cards: [] };
  const handRow = (cards, html, cls = '') => `<div class="hand2 ${cls}" style="--n:${Math.max(1, cards.length)}">${html}</div>`;
  const wrap = (cls, table, hand) => `<div class="tw ${cls} ${hand == null ? 'nohand' : ''}"><div class="table"><div class="feltin">${table}</div></div>${hand == null ? '' : hand}</div>`;
  // 新しく場に出た札を、出した人の席(自分なら手札の方)から飛ばす
  function fly(A, sel, fromSeat, ms = 380) {
    requestAnimationFrame(() => {
      const root = document.querySelector('#boardwrap .tw'); if (!root) return;
      const src = fromSeat === A.mySeat || fromSeat < 0 ? root.querySelector('.hand2') : root.querySelector(`.tseat[data-seat="${fromSeat}"]`);
      root.querySelectorAll(sel).forEach((e, i) => {
        const r = e.getBoundingClientRect(); let dx = 0, dy = -r.height * 1.6;
        if (src) { const q = src.getBoundingClientRect(); dx = q.left + q.width / 2 - (r.left + r.width / 2); dy = q.top + q.height / 2 - (r.top + r.height / 2); }
        e.animate([{ transform: `translate(${dx}px,${dy}px) rotate(${dx > 0 ? 40 : -40}deg) scale(.8)`, opacity: .2 }, { transform: 'none', opacity: 1 }], { duration: ms * A.speed, delay: i * 70 * A.speed, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      });
    });
    A.anim(ms + 150);
  }
  const sheetBtns = (A, title, list) => A.sheet(`<h2>${esc(title)}</h2><div class="btns">${list.map(([l, m, st]) => `<button class="btn" data-m="${m}" ${st ? `style="${st}"` : ''}>${esc(l)}</button>`).join('')}</div>`, (box) => box.querySelectorAll('button[data-m]').forEach((x) => (x.onclick = () => { A.closeSheet(); A.sel = null; A.play(+x.dataset.m); })));

  // ------------------------------------------------------------ 大富豪
  function daifugo(b, A) {
    const t = b.tbl, me = A.mySeat, human = A.view.human, total = t.n.length;
    A.round(`${t.round + 1}回戦`);
    const RANKN = ['大富豪', '富豪', '平民', '貧民', '大貧民'];
    const rankOf = (p) => t.place[p] >= 0 ? `${t.place[p] + 1}位で上がり` : t.prev[p] >= 0 ? (total === 4 ? [RANKN[0], RANKN[1], RANKN[3], RANKN[4]] : RANKN)[t.prev[p]] || '' : '';
    A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === me ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${esc(rankOf(i) || t.pts[i] + '点')}</span></span><span class="num">${t.n[i]}</span></div>`).join(''));
    // 手札は弱い順(3 … A・2・ジョーカー)、同じ強さはマーク順に並べる(選ぶ札は id で持つので、並べ替えても手は変わらない)
    const dfPow = (id) => (id === 52 ? 13 : ((id % 13) + 2 - 3 + 13) % 13) * 4 + (id === 52 ? 0 : Math.floor(id / 13));
    const field = b.zones[0].cards, hand = b.zones[1].cards.slice().sort((x, y) => dfPow(x.id) - dfPow(y.id));
    const picked = new Set(A.sel && A.sel.ids ? A.sel.ids.filter((x) => hand.some((c) => c.id === x)) : []);
    const moves = human ? t.moves.filter(([m, cs]) => cs.length) : [];
    const usable = new Set(); moves.forEach(([, cs]) => cs.forEach((c) => usable.add(c)));
    const same = (cs) => cs.length === picked.size && cs.every((c) => picked.has(c));
    const hit = moves.find(([, cs]) => same(cs));
    // いま選んでいる札と一緒に出せる札だけ明るくする
    const can = new Set(); moves.forEach(([, cs]) => { if ([...picked].every((p) => cs.includes(p))) cs.forEach((c) => can.add(c)); });
    const nf = fresh(A, 'df', field.map((c) => c.id));
    const seats = seatsOf(A, total, me).map((s) => seatHtml(A, s, { count: t.n[s.seat], note: t.place[s.seat] >= 0 ? `${t.place[s.seat] + 1}位` : t.passed[s.seat] ? 'パス' : '', dim: t.place[s.seat] >= 0 })).join('');
    const tags = (t.rev ? '<span class="tag2 red">革命中</span>' : '') + (t.lock ? '<span class="tag2">しばり</span>' : '');
    const center = `<div class="pile2">${field.length ? field.map((c) => pc(c.id, nf.includes(c.id) ? 'new' : '')).join('') : '<span class="none">場は空です</span>'}</div><div class="pinfo">${field.length && t.fieldOwner >= 0 ? `${esc(A.name(t.fieldOwner))} が出した札` : t.phase === 0 ? '札を交換します' : ''} ${tags}</div><div class="tround">${t.round + 1}回戦</div>`;
    const handHtml = handRow(hand, hand.map((c) => pc(c.id, `${picked.has(c.id) ? 'on' : ''} ${human && !can.has(c.id) ? 'no' : ''} ${human && can.has(c.id) ? 'tap' : ''}`, `data-card="${c.id}"`)).join(''));
    // 自分の札の前(卓の下の真ん中)にも、ほかの人と同じ名札と残りの枚数
    const mine = seatHtml(A, { seat: me, x: 50, y: 93 }, { count: t.n[me], note: t.place[me] >= 0 ? `${t.place[me] + 1}位` : t.passed[me] ? 'パス' : '', dim: t.place[me] >= 0 }).replace('class="tseat', 'class="tseat myseat');
    A.board(wrap('oval', seats + mine + center, handHtml), (d) => {
      if (d.card == null || !human) return; const id = +d.card;
      if (picked.has(id)) picked.delete(id); else if (can.has(id)) picked.add(id); else if (usable.has(id)) { picked.clear(); picked.add(id); } else return;
      A.sel = { ids: [...picked] }; A.sfx('TAP'); A.redraw();
    });
    if (nf.length) fly(A, '.pile2 .pc.new', t.fieldOwner);
    A.drag({
      src: '.hand2 [data-card]',
      dst: '.feltin',
      getStack: (sEl) => {
        const id = +sEl.dataset.card;
        if (picked.has(id) && picked.size > 1) {
          const all = [...document.querySelectorAll('#boardwrap .hand2 [data-card]')].filter((el) => picked.has(+el.dataset.card));
          return [sEl, ...all.filter((el) => el !== sEl)];
        }
        return [sEl];
      },
      drop: (sEl) => {
        const id = +sEl.dataset.card, ids = picked.has(id) && picked.size > 1 ? [...picked] : [id];
        const mv = moves.find(([, cs]) => cs.length === ids.length && cs.every((c) => ids.includes(c)));
        if (mv) { A.sel = null; A.play(mv[0]); }
      },
    });
    const lab = (m) => t.phase === 0 || (m >= 10000 && m < 30000) ? '渡す' : m >= 30000 && m < 31000 ? '渡す(7渡し)' : m >= 31000 && m < 32000 ? '捨てる(10捨て)' : '出す';
    const acts = [{ label: 'パス', move: 0, enabled: human && A.view.legal.includes(0), cls: '' }, ...b.buttons.filter((x) => x.m >= 32000).map((x) => ({ label: x.label, move: x.m, enabled: human, cls: '' }))];
    acts.push({ label: '選び直す', enabled: human && picked.size > 0, cls: '', fn: () => { A.sel = null; A.redraw(); } });
    acts.push({ label: hit ? lab(hit[0]) : moves.length ? lab(moves[0][0]) : '出す', enabled: !!hit && human, cls: 'gold', fn: () => { const m = hit[0]; A.sel = null; A.play(m); } });
    A.acts(acts);
  }

  // ------------------------------------------------------------ 7ならべ
  function sevens(b, A) {
    const t = b.tbl, me = A.mySeat, human = A.view.human, total = t.n.length;
    strip(b, A);
    const hand = b.zones[4].cards, playable = new Set(hand.filter((c) => c.m != null).map((c) => c.id));
    const onTable = []; b.zones.slice(0, 4).forEach((z) => z.cards.forEach((c) => { if (!c.empty) onTable.push(c.id); }));
    const nf = fresh(A, 'sv', onTable);
    const grid = b.zones.slice(0, 4).map((z, s) => z.cards.map((c, k) => { const id = s * 13 + k; return c.empty ? `<span class="pc slot ${playable.has(id) && human ? 'can' : ''}" ${playable.has(id) && human ? `data-card="${id}"` : ''}><i class="ix">${RK(id)}<br>${SU[s]}</i></span>` : pc(id, nf.includes(id) ? 'new' : ''); }).join('')).join('');
    const seats = seatsOf(A, total, me, true).map((s) => seatHtml(A, s, { count: t.n[s.seat], note: t.place[s.seat] >= 0 ? `${t.place[s.seat] + 1}位` : t.out[s.seat] ? '失格' : `パス ${t.pass[s.seat]}/${t.max}`, dim: t.place[s.seat] >= 0 || t.out[s.seat] })).join('');
    const handHtml = handRow(hand, hand.map((c) => pc(c.id, `${human && c.m == null ? 'no' : ''} ${human && c.m != null ? 'tap' : ''}`, c.m != null ? `data-card="${c.id}"` : '')).join(''));
    A.board(wrap('rect sev', seats + `<div class="sgrid7">${grid}</div>`, handHtml), (d) => { if (d.card != null && human && playable.has(+d.card)) A.play(+d.card); });
    A.drag({ src: '.hand2 [data-card]', dst: '.feltin', drop: (sEl) => { const id = +sEl.dataset.card; if (playable.has(id)) A.play(id); } });
    if (nf.length && nf.length < 4) fly(A, '.sgrid7 .pc.new', A.view.toMove === me ? -9 : me, 300);
    A.acts(b.buttons.map((x) => ({ label: x.label, move: x.m, enabled: human && x.en !== false, cls: '' })));
  }

  // ------------------------------------------------------------ 神経衰弱
  function memory(b, A) {
    const t = b.tbl, human = A.view.human, z = b.zones[0];
    A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === A.mySeat ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">取った組</span></span><span class="num">${t.n[i]}</span></div>`).join(''));
    const up = z.cards.map((c, i) => (c.back ? -1 : i)).filter((i) => i >= 0);
    const nf = fresh(A, 'mm', up);
    const rows = Math.ceil(z.cards.length / z.cols);
    const cells = z.cards.map((c, i) => c.back ? pc(-1, c.m != null && human ? 'tap' : '', `data-pos="${i}" ${c.m != null ? `data-k="${i}"` : ''}`) : pc(c.id, `${nf.includes(i) ? 'flipin' : ''} ${c.hi ? 'miss' : ''}`, `data-pos="${i}"`)).join('');
    A.board(wrap('rect mem', `<div class="mgrid" style="--cols:${z.cols};--rows:${rows}">${cells}</div>`, null), (d) => { if (d.k != null && human) { const c = z.cards[+d.k]; if (c && c.m != null) A.play(c.m); } });
    if (nf.length) A.anim(420);
    A.acts([]);
  }

  // ------------------------------------------------------------ Oh, No!
  function uno(b, A) {
    const t = b.tbl, me = A.mySeat, human = A.view.human, total = t.n.length;
    const next = A.view.toMove >= 0 ? (A.view.toMove + t.dir + total) % total : -1;
    A.strip(`<div class="seatlist ${t.dir > 0 ? 'down' : 'up'}" aria-label="${t.dir > 0 ? '下へ回る' : '上へ回る'}">${b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === me ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span></span><span class="bslot">${t.decl === i ? '<span class="bdg ohno">Oh, No!</span>' : i === next && !s.turn ? '<span class="bdg next">NEXT</span>' : ''}</span><span class="cnt"><i></i>${t.n[i]}</span></div>`).join('')}</div>`);
    const top = b.zones[0].cards[0], hand = b.zones[1].cards;
    const sel = A.sel && A.sel.k != null && A.sel.k < hand.length ? A.sel.k : -1;
    const ok = (c) => c && (c.m != null || (c.opts && c.opts.length > 0));
    const rawCard = (c) => Math.floor(c.id / 10);
    const colOf = (c) => { const x = rawCard(c); return x < 100 ? Math.floor(x / 25) : 4; };
    const rankOf = (c) => { const x = rawCard(c); if (x >= 100) return x < 104 ? 13 : 14; const k = x % 25; return k === 0 ? 0 : (k + 1) >> 1; };
    const legalSet = new Set(A.view.legal);
    const bundleOn = !!(t.bundle && !t.drawnOnly && !t.swapping);
    const byRank = new Map();
    hand.forEach((c, idx) => {
      const r = rankOf(c);
      if (!byRank.has(r)) byRank.set(r, []);
      if (byRank.get(r).length < 8) byRank.get(r).push(idx);
    });
    const bundleRanks = new Set();
    if (bundleOn) {
      for (const m of A.view.legal) {
        if (m >= 1000000) bundleRanks.add(((m - 1000000) >>> 13) & 0x1f);
      }
    }
    const inBundleGroup = (k) => {
      if (!bundleOn || k < 0 || k >= hand.length) return false;
      const r = rankOf(hand[k]);
      return bundleRanks.has(r) && (byRank.get(r) || []).includes(k);
    };
    const rawBundleSel = bundleOn && A.sel && Array.isArray(A.sel.bundle)
      ? A.sel.bundle.filter((i) => Number.isInteger(i) && i >= 0 && i < hand.length && inBundleGroup(i))
      : [];
    const bundleSel = rawBundleSel.length
      ? rawBundleSel.filter((i, idx, arr) => arr.indexOf(i) === idx && rankOf(hand[i]) === rankOf(hand[rawBundleSel[0]]))
      : [];
    const buildBundleMove = (selIdxs) => {
      if (!bundleOn || selIdxs.length < 2) return null;
      const rk = rankOf(hand[selIdxs[0]]), idxs = byRank.get(rk) || [];
      if (!bundleRanks.has(rk)) return null;
      let mask = 0;
      for (const idx of selIdxs) {
        const sub = idxs.indexOf(idx);
        if (sub < 0) return null;
        mask |= (1 << sub);
      }
      const lastIdx = selIdxs[selIdxs.length - 1], lastSub = idxs.indexOf(lastIdx);
      if (lastSub < 0) return null;
      if (rk >= 13) {
        const opts = [0, 1, 2, 3]
          .map((wcol) => [`${OCN[wcol]}にする`, 1000000 + ((rk << 13) | (wcol << 11) | (lastSub << 8) | mask)])
          .filter(([, m]) => legalSet.has(m));
        return opts.length ? { wild: true, opts } : null;
      }
      const c = colOf(hand[lastIdx]);
      const m = 1000000 + ((rk << 13) | (c << 11) | (lastSub << 8) | mask);
      return legalSet.has(m) ? { wild: false, move: m } : null;
    };
    const bundleMv = buildBundleMove(bundleSel);
    const canTap = (c, k) => ok(c) || inBundleGroup(k);
    const nf = top ? fresh(A, 'un', [top.id]) : [];
    const seats = seatsOf(A, total, me).map((s) => seatHtml(A, s, { count: t.n[s.seat], note: t.decl === s.seat ? 'Oh, No!' : s.seat === next ? 'NEXT' : '', noteCls: t.decl === s.seat ? 'ohno' : 'next' })).join('');
    const drawnOnly = human && t.pass && hand.some((c) => c.hi);
    const col = OCC[t.color] || '#888';
    const center = `<div class="unoc">
      <button class="ustock ${t.draw && human ? 'can' : ''}" data-draw="1" ${t.draw && human ? '' : 'disabled'} aria-label="山札から引く"><span class="pc svgc s3">${ohCard('back')}</span><span class="pc svgc s2">${ohCard('back')}</span><span class="pc svgc">${ohCard('back')}</span><small class="ulabel">山札${t.draw && human ? `<br>${t.pending > 0 ? `クリックして${t.pending}枚引く` : 'クリックして引く'}` : ''}</small></button>
      <div class="udisc" style="--uc:${col}">${top ? face('uno', top, nf.length ? 'new' : '') : ''}<small><i style="background:${col}"></i>いまの色: ${OCN[t.color] || ''}</small></div>
      ${t.pass && !t.draw && human && !hand.some((c, k) => canTap(c, k)) ? '<button class="upass" data-pass="1">PASS</button>' : ''}
     </div><div class="pinfo">${t.lastMover >= 0 && t.last ? `<span class="pill"><b>${esc(A.name(t.lastMover))}</b>${esc(t.last)}</span>` : ''}${t.pending > 0 ? `<span class="pill warn">次の人は${t.pending}枚引きます</span>` : ''}${drawnOnly ? '<span class="pill">引いた札だけ出せます</span>' : ''}</div>`;
    const handHtml = handRow(hand, hand.map((c, k) => {
      const bIdx = bundleSel.indexOf(k);
      const isSel = bIdx >= 0 || k === sel;
      const badge = bIdx >= 0 ? `<b class="ubord">${bIdx + 1}</b>` : '';
      return face('uno', c, `${isSel ? 'on' : ''} ${human && !canTap(c, k) ? 'no' : ''} ${human && canTap(c, k) ? 'tap' : ''} ${c.hi ? 'hi' : ''}`, `data-k="${k}"`, badge);
    }).join(''));
    const playCard = (k) => { const c = hand[k]; if (!c || !ok(c)) return; if (c.opts.length) return pickColor(A, c.opts); A.sel = null; A.play(c.m); };
    const playBundle = () => {
      if (!bundleMv) return;
      if (bundleMv.wild) return pickColor(A, bundleMv.opts);
      A.sel = null;
      A.play(bundleMv.move);
    };
    A.board(wrap('oval uno', seats + center, handHtml), (d) => {
      if (!human) return;
      if (d.draw != null) return t.draw && A.play(t.mDraw);
      if (d.pass != null) { const b2 = document.querySelector('.upass'); if (b2) b2.classList.add('press'); return setTimeout(() => A.play(t.mPass), 170); }
      if (d.k == null) return;
      const k = +d.k, c = hand[k];
      if (!c || !canTap(c, k)) return;
      if (bundleOn && inBundleGroup(k)) {
        if (bundleSel.includes(k)) {
          if (bundleSel.length === 1 && !A.pre && ok(c)) return playCard(k);
          const nextSel = bundleSel.filter((x) => x !== k);
          A.sel = nextSel.length ? { bundle: nextSel, k: nextSel[nextSel.length - 1] } : null;
          A.sfx('TAP');
          return A.redraw();
        }
        if (bundleSel.length > 0 && rankOf(hand[bundleSel[0]]) === rankOf(c)) {
          const nextSel = [...bundleSel, k];
          A.sel = { bundle: nextSel, k };
          A.sfx('TAP');
          return A.redraw();
        }
        A.sel = { bundle: [k], k };
        A.sfx('TAP');
        return A.redraw();
      }
      if (!ok(c)) return;
      if (!A.pre || sel === k) return playCard(k);
      A.sel = { k }; A.sfx('TAP'); A.redraw();
    });
    A.drag({
      src: '.hand2 [data-k]',
      dst: '.feltin',
      getStack: (sEl) => {
        const k = +sEl.dataset.k;
        if (bundleSel.includes(k) && bundleSel.length > 1) {
          const byK = new Map([...document.querySelectorAll('#boardwrap .hand2 [data-k]')].map((el) => [+el.dataset.k, el]));
          const ordered = bundleSel.map((idx) => byK.get(idx)).filter(Boolean);
          return [sEl, ...ordered.filter((el) => el !== sEl)];
        }
        return [sEl];
      },
      drop: (sEl) => {
        const k = +sEl.dataset.k, c = hand[k];
        if (bundleSel.includes(k) && bundleSel.length >= 2 && bundleMv) return playBundle();
        if (c && ok(c)) playCard(k);
      },
    });
    if (nf.length) fly(A, '.udisc .pc.new', t.lastMover);
    if (t.swapping && human && t.swap.length && !A.sheetOpen()) sheetBtns(A, '手札を取りかえる相手を選ぶ', t.swap.map((p) => [`${A.name(p)}(${t.n[p]}枚)`, t.mSwap + p]));
    const acts = [];
    if (bundleOn && bundleSel.length >= 2) {
      acts.push({ label: `まとめ出し(${bundleSel.length}枚)`, enabled: human && !!bundleMv, cls: 'bundle gold', fn: () => playBundle() });
      acts.push({ label: '選び直す', enabled: human, cls: '', fn: () => { A.sel = null; A.redraw(); } });
    } else if (bundleOn && bundleSel.length === 1) {
      acts.push({ label: '1枚で出す', enabled: human && ok(hand[bundleSel[0]]), cls: 'gold', fn: () => playCard(bundleSel[0]) });
    } else if (A.pre) {
      acts.push({ label: '出す', enabled: human && sel >= 0 && ok(hand[sel]), cls: '', fn: () => playCard(sel) });
    }
    acts.push({ label: 'パス', move: t.mPass, enabled: human && t.pass, cls: '' });
    acts.push({ label: 'Oh, No!', move: t.mDeclare, enabled: human && t.declare, cls: 'ohno' });
    A.acts(acts);
  }

  // ワイルドの色を選ぶ(大きな 4 色のボタン)
  function pickColor(A, opts) {
    const colorOfMove = (m) => (m >= 1000000 ? (((m - 1000000) >>> 11) & 3) : (m % 4));
    A.sheet(`<h2>ワイルド: 色を選ぶ</h2><div class="cpick">${opts.map(([, m]) => { const ci = colorOfMove(m); return `<button class="cbtn" data-m="${m}" style="--c:${OCC[ci]}">${OCN[ci]}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-sheetback>キャンセル</button></div>`,
      (box) => box.querySelectorAll('button[data-m]').forEach((x) => (x.onclick = () => { A.closeSheet(); A.sel = null; A.play(+x.dataset.m); })));
  }

  // ------------------------------------------------------------ 花札(こいこい)
  const LIGHTS = new Set([0, 8, 28, 40, 44]), ANIMALS = new Set([4, 12, 16, 20, 24, 32, 36, 41, 29]), RIBBONS = new Set([1, 5, 9, 13, 17, 21, 25, 33, 37, 42]);
  const kindOf = (c) => LIGHTS.has(c) ? 0 : ANIMALS.has(c) ? 1 : RIBBONS.has(c) ? 2 : 3;
  function hana(b, A) {
    const t = b.tbl, me = A.mySeat, opp = 1 - me, human = A.view.human;
    A.round(`${t.round + 1}局目`);
    A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === me ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${t.dealer === i ? '親' : '子'}${t.called.includes(i) ? '・こいこい' : ''}</span></span><span class="num">${t.pts[i]}<small>文</small></span></div>`).join(''));
    const field = zoneOf(b, /^場札/).cards, hand = zoneOf(b, /^あなたの手札/).cards;
    const sel = A.sel && A.sel.k != null && A.sel.k < hand.length ? A.sel.k : -1;
    const movesOf = (c) => (c.m != null ? [c.m] : c.opts.map((o) => o[1]));
    // 選んだ手札と合う場札(同じ月)。山から引いた札が 2 枚と合う時は、取る札を選ぶ
    const tgt = new Map();
    if (human && t.phase === 0 && sel >= 0) for (const m of movesOf(hand[sel])) { const f = (m - t.mPlay) % 64 - 1; if (f >= 0) tgt.set(f, m); }
    if (human && t.phase === 1) for (const m of A.view.legal) { const f = m - t.mTake - 1; if (f >= 0) tgt.set(f, m); }
    const caps = (p, cls) => { const g = [[], [], [], []]; t.cap[p].forEach((c) => g[kindOf(c)].push(c)); return `<div class="hcap ${cls}">${['光', 'タネ', '短冊', 'カス'].map((n, k) => `<div class="hgrp"><small>${n} ${g[k].length}</small><div>${g[k].map((c) => `<span class="pc svgc hana mini">${window.HANA(c)}</span>`).join('')}</div></div>`).join('')}</div>`; };
    const nfF = fresh(A, 'hf', field.map((c) => c.id)), nfC = fresh(A, 'hc' + me, t.cap[me]), nfO = fresh(A, 'ho', t.cap[opp]);
    const table = `<div class="hopp"><span class="face">${esc(A.name(opp)[0])}</span><b>${esc(A.name(opp))}</b><span class="hbacks">${Array.from({ length: t.opp }, () => '<span class="pc hback mini"></span>').join('')}</span></div>
      ${caps(opp, 'top')}
      <div class="hmid"><div class="hstock"><span class="pc hback"></span><small>山札 ${t.stock}</small>${t.drawn >= 0 ? `<span class="pc svgc hana drawn">${window.HANA(t.drawn)}</span>` : ''}</div>
       <div class="hfield">${field.map((c) => face('hanafuda', c, `${tgt.has(c.id) ? 'can tap' : ''} ${nfF.includes(c.id) ? 'new' : ''}`, `data-tgt="${c.id}"`)).join('')}</div></div>
      ${caps(me, 'bottom')}<div class="pinfo hinfo">${esc(b.info || '')}</div>`;
    const handHtml = handRow(hand, hand.map((c, k) => face('hanafuda', c, `${k === sel ? 'on' : ''} ${human && t.phase === 0 && movesOf(c).length ? 'tap' : ''}`, `data-k="${k}"`)).join(''), 'hanah');
    A.board(wrap('rect hanat', table, handHtml), (d) => {
      if (!human) return;
      if (d.tgt != null && tgt.has(+d.tgt)) { const m = tgt.get(+d.tgt); A.sel = null; return A.play(m); }
      if (d.k == null || t.phase !== 0) return; const k = +d.k, ms = movesOf(hand[k]); if (!ms.length) return;
      if (ms.length === 1 && (!A.pre || sel === k)) { A.sel = null; return A.play(ms[0]); }
      A.sel = sel === k ? null : { k }; A.sfx('TAP'); A.redraw();
    });
    A.drag({ src: '.hand2 [data-k]', dst: '[data-tgt], .feltin', drop: (sEl, dEl) => { if (t.phase !== 0) return; const k = +sEl.dataset.k, ms = movesOf(hand[k]);
      const tid = dEl.dataset.tgt != null ? +dEl.dataset.tgt : -1; const hit = ms.find((m) => (m - t.mPlay) % 64 - 1 === tid); const plain = ms.find((m) => (m - t.mPlay) % 64 === 0);
      const m = hit != null ? hit : ms.length === 1 ? ms[0] : plain; if (m != null) { A.sel = null; A.play(m); } } });
    if (nfF.length && nfF.length < 3) fly(A, '.hfield .pc.new', t.phase === 1 || A.view.toMove === me ? -1 : opp, 320);
    if (nfC.length || nfO.length) A.anim(300);
    const acts = b.buttons.filter((x) => t.phase !== 1).map((x) => ({ label: x.label, move: x.m, enabled: human, cls: x.label === 'こいこい' ? 'ohno' : undefined }));
    if (t.phase === 1 && human) acts.push({ label: '光っている場札から、取る札を選んでください', enabled: false, cls: '' });
    if (t.phase === 0 && human && sel >= 0 && hand[sel]) { const ms = movesOf(hand[sel]); const plain = ms.find((m) => (m - t.mPlay) % 64 === 0); if (ms.length === 1) acts.push({ label: tgt.size ? '合わせて取る' : '場に出す', enabled: true, cls: 'gold', fn: () => { A.sel = null; A.play(ms[0]); } }); else if (plain != null) acts.push({ label: '場に出す', enabled: true, cls: '', fn: () => { A.sel = null; A.play(plain); } }); }
    A.acts(acts);
  }

  // ------------------------------------------------------------ ポーカー・テキサスポーカー
  function poker(b, A) {
    const t = b.tbl, me = A.mySeat, human = A.view.human, total = t.chips.length, hold = t.g === 'holdem';
    A.round(hold ? `${t.round + 1}手目` : `${t.hand + 1}ゲーム目・${['1回目の賭け', '札の交換', '2回目の賭け'][t.phase] || ''}`);
    const fold = (p) => hold ? t.fold.includes(p) : t.fold[p];
    A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''} ${fold(i) ? 'dimmed' : ''}">${i === me ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}${t.dealer === i ? ' <i class="dlr">ディーラー</i>' : ''}</span><span class="nt">${fold(i) ? '降りた' : t.bets[i] ? `賭け ${t.bets[i]}` : hold ? '' : esc(t.act[i] || '')}</span></span><span class="num">${t.chips[i]}</span></div>`).join(''));
    const mask = typeof A.sel === 'number' ? A.sel : 0;
    const mine = zoneOf(b, /^あなたの手札/).cards;
    const all = []; t.cards.forEach((cs, p) => cs.forEach((c) => all.push(p * 100 + c))); (t.board || []).forEach((c) => all.push(9000 + c));
    const nf = fresh(A, 'pk', all);
    const seats = seatsOf(A, total, me).map((s) => seatHtml(A, s, { dim: fold(s.seat), note: fold(s.seat) ? '降りた' : hold ? (t.lastMover === s.seat ? t.last : '') : (t.act[s.seat] || ''),
      extra: `<span class="scards">${t.cards[s.seat].map((c) => pc(c, `mini ${nf.includes(s.seat * 100 + c) && c >= 0 ? 'flipin' : ''}`)).join('')}</span>${t.bets[s.seat] ? chip(t.bets[s.seat]) : ''}${t.dealer === s.seat ? '<i class="dlr">ディーラー</i>' : ''}` })).join('');
    const center = hold
      ? `<div class="comm">${Array.from({ length: 5 }, (_, i) => t.board[i] != null ? pc(t.board[i], nf.includes(9000 + t.board[i]) ? 'new' : '') : '<span class="pc slot"></span>').join('')}</div><div class="pot">${chip(t.pot, 'big')}<small>ポット</small></div><div class="pinfo">${esc(t.lastMover >= 0 && t.last ? `${A.name(t.lastMover)}: ${t.last}` : '')}${t.payouts.length ? '　配当 ' + t.payouts.map((v, i) => v ? `${esc(A.name(i))} +${v}` : '').filter(Boolean).join('、') : ''}</div><div class="tround">${t.round + 1}手目</div>`
      : `<div class="pot mid">${chip(t.pot, 'big')}<small>ポット</small></div><div class="pinfo">${t.result ? `<span class="pill">${esc(t.result)}</span>` : ''}</div><div class="tround">${t.hand + 1}ゲーム目</div>`;
    const mybet = `<div class="mybet">${t.bets[me] ? chip(t.bets[me]) : ''}${t.dealer === me ? '<i class="dlr">ディーラー</i>' : ''}</div>`;
    const handHtml = handRow(mine, mine.map((c, k) => pc(c.id, `${c.tog >= 0 && (mask >> c.tog) & 1 ? 'on swap' : ''} ${c.tog >= 0 && human ? 'tap' : ''} ${nf.includes(me * 100 + c.id) ? 'new' : ''}`, `data-k="${k}"`)).join(''), 'few' + (fold(me) ? ' folded' : ''));
    A.board(wrap('oval pk', seats + center + mybet, handHtml), (d) => { if (d.k == null || !human) return; const c = mine[+d.k]; if (c && c.tog >= 0) { A.sel = mask ^ (1 << c.tog); A.sfx('TAP'); A.redraw(); } });
    if (nf.length && nf.length <= 5) { fly(A, '.comm .pc.new, .hand2 .pc.new', 99, 340); }
    A.acts(b.buttons.map((x) => ({ label: x.base && x.en ? (mask ? `${[0, 1, 2, 3, 4].filter((k) => (mask >> k) & 1).length}枚 替える` : '替えない') : x.label, move: x.base ? x.m + mask : x.m, enabled: human && x.en !== false, cls: /コール|チェック|替え|次の手/.test(x.label) || (x.base && x.en) ? 'gold' : '' })));
  }

  // ------------------------------------------------------------ ブラックジャック
  let prevBj = null; const bjCleared = {};
  function bj(b, A) {
    const t0 = b.tbl, me = A.mySeat, human = A.view.human, total = t0.chips.length;
    // 引き上げた後は、札のない卓で賭ける
    const t = t0.delta && bjCleared[A.handle + ':' + t0.round] ? Object.assign({}, t0, { delta: null, dealer: [], dealerTotal: -1, hands: t0.hands.map(() => []) }) : t0;
    if (t !== t0) prevBj = { h: A.handle, r: t.round };
    A.round(`${t.round + 1}回目`);
    A.strip(b.scores.map((s, i) => `<div class="pl${s.turn ? ' turn' : ''}">${i === me ? A.face(24) : `<span class="dot face">${esc(A.name(i)[0])}</span>`}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${t.delta ? (t.delta[i] > 0 ? '+' : '') + t.delta[i] : '持ち点'}</span></span><span class="num">${t.chips[i]}</span></div>`).join(''));
    const all = []; t.dealer.forEach((c, i) => all.push(8000 + i * 60 + c)); t.hands.forEach((hs, p) => hs.forEach((h, k) => h.c.forEach((c, i) => all.push(p * 1000 + k * 300 + i * 53 + c))));
    const nf = fresh(A, 'bj', all);
    const val = (c) => { const r = c % 13 + 2; return r === 14 ? 11 : r > 10 ? 10 : r; };
    const dShown = t.dealer.filter((c) => c >= 0);
    const dTot = t.dealerTotal >= 0 ? t.dealerTotal : dShown.reduce((a, c) => a + val(c), 0);
    const outcome = (h) => { if (!t.delta) return ''; const dt = t.dealerTotal; if (h.bust) return '<b class="res lose">負け</b>'; if (h.nat && !(dt === 21 && t.dealer.length === 2)) return '<b class="res win">ブラックジャック</b>'; if (dt > 21 || h.t > dt) return '<b class="res win">勝ち</b>'; if (h.t < dt) return '<b class="res lose">負け</b>'; return '<b class="res push">引き分け</b>'; };
    const handsHtml = (p, cls) => t.hands[p].map((h, k) => `<div class="bjh ${cls} ${A.view.toMove === p && t.hi === k && t.hands[p].length > 1 ? 'act' : ''}"><div class="bjc">${h.c.map((c, i) => pc(c, nf.includes(p * 1000 + k * 300 + i * 53 + c) ? 'new' : '')).join('')}</div><span class="bjt ${h.bust ? 'bust' : h.t === 21 ? 'bjack' : ''}">${h.bust ? 'バースト' : h.t}</span>${outcome(h) || chip(h.bet)}</div>`).join('');
    const OP = { 1: [[84, 52]], 2: [[16, 52], [84, 52]], 3: [[13, 46], [87, 46], [80, 84]] };
    const others = []; for (let k = 1; k < total; k++) others.push((me + k) % total);
    const seats = others.map((seat, i) => seatHtml(A, { seat, x: OP[others.length][i][0], y: OP[others.length][i][1] }, { extra: `<div class="bjo">${handsHtml(seat, 'small')}</div>` })).join('');
    const table = `<div class="bjd"><small>ディーラー</small><div class="bjc">${t.dealer.length ? t.dealer.map((c, i) => pc(c, nf.includes(8000 + i * 60 + c) ? (c >= 0 ? 'new' : 'new') : '')).join('') : '<span class="pc slot"></span><span class="pc slot"></span>'}</div>${t.dealer.length ? `<span class="bjt ${dTot > 21 ? 'bust' : ''}">${dTot > 21 ? 'バースト' : dTot}</span>` : ''}</div>
      ${seats}<div class="bjme ${A.view.toMove === me && !A.view.outcome ? 'turn' : ''}"><span class="bjwho">${A.face ? A.face(24) : ''}${esc(A.name(me))}</span>${t.hands[me].length ? `<div class="bjrow">${handsHtml(me, '')}</div>` : ''}</div>`;
    A.board(wrap('oval bjt2', table, null), () => {});
    if (nf.length && nf.length < 12) { requestAnimationFrame(() => document.querySelectorAll('#boardwrap .pc.new').forEach((e, i) => e.animate([{ transform: 'translate(30cqw,-40cqh) rotate(40deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340 * A.speed, delay: i * 110 * A.speed, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }))); A.anim(340 + nf.length * 110); }
    // 回の結果: 数が決まったらすぐに自分の勝ち負けをカットインで表示。終わったら札を引き上げて、次に賭ける
    const newRes = t.delta && (!prevBj || prevBj.h !== A.handle || prevBj.r !== t.round);
    if (newRes) {
      if (t.dealer.length === 2 && t.dealerTotal === 21) setTimeout(() => A.cut({ who: { name: 'ディーラー' }, text: 'ブラックジャック', tone: 'dark', font: 'yo', ms: 1300 }), 100);
      const dm = t.delta[me]; setTimeout(() => A.cut({ text: dm > 0 ? '勝ち' : dm < 0 ? '負け' : '引き分け', sub: dm ? `${dm > 0 ? '+' : ''}${dm}` : '', tone: dm > 0 ? 'gold' : 'dark', font: 'yo', ms: 1200 }), 220);
      const r0 = t.round; setTimeout(() => { bjCleared[A.handle + ':' + r0] = true; document.querySelectorAll('#boardwrap .bjc .pc').forEach((e, i) => e.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(0,-40cqh) rotate(-20deg)', opacity: 0 }], { duration: 320, delay: i * 25, fill: 'forwards' })); setTimeout(() => A.redraw(), 400); }, 2100 * A.speed);
      A.anim(2500);
    }
    prevBj = { h: A.handle, r: t.round };
    A.acts(b.buttons.map((x) => ({ label: x.label, move: x.m, enabled: human && x.en !== false, cls: /ヒット|50賭/.test(x.label) ? 'gold' : '' })));
  }

  const BY = { daifugo, sevens, memory, uno, hana, poker, holdem: poker, bj };
  const old = window.RENDER.cards;
  window.RENDER.cards = (b, A) => { const r = b.tbl && BY[b.tbl.g]; return r ? r(b, A) : old(b, A); };
})();
