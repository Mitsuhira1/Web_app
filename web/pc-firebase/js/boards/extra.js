/* 麻雀・人生すごろく・スピード・ソリティア(PC 版で描いた盤。規則は持たない) */
(() => {
  const E = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RK = (r) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
  const SU = ['♠', '♥', '♦', '♣'];
  const cardHtml = (c, attrs = '', cls = '') => c ? `<span class="pcard ${c.s === 1 || c.s === 2 ? 'r' : ''} ${cls}" ${attrs}><i>${RK(c.r)}</i><i>${SU[c.s]}</i><b>${SU[c.s]}</b></span>` : `<span class="pcard empty ${cls}" ${attrs}></span>`;
  const backHtml = (attrs = '', cls = '') => `<span class="pcard back ${cls}" ${attrs}></span>`;

  // ---------------------------------------------------------------- スピード
  function speed(b, A) {
    const me = b.me, op = 1 - me, SEAT = 1000000, PLAY = 100;
    const mine = new Map();
    for (const m of A.view.legal) { const code = m % SEAT; if (code >= PLAY) { const card = (code - PLAY) >> 1, tgt = (code - PLAY) & 1; (mine.get(card) || mine.set(card, []).get(card)).push([tgt, m]); } }
    const reset = A.view.legal.find((m) => m % SEAT === 0);
    const sel = A.sel && A.sel.speed != null ? A.sel.speed : null;
    A.strip(['あなた', A.name(op)].map((n, k) => { const s = k ? op : me; return `<div class="pl ${b.lastMover === s ? 'turn' : ''}"><span class="dot" style="background:${k ? '#3F78C4' : '#C8463C'}"></span><span class="who"><span class="nm">${E(k ? n : A.name(me))}</span><span class="nt">山札 ${b.reserves[s]}枚</span></span><span class="num">${b.hands[s].length + b.reserves[s]}</span></div>`; }).join(''));
    const opRow = b.hands[op].map((c) => cardHtml(c, '', 'sm')).join('');
    const tops = b.tops.map((c, i) => { const can = sel != null && (mine.get(sel) || []).some(([t]) => t === i); return cardHtml(c, `data-tgt="${i}"`, `big ${can ? 'can' : ''} ${b.lastCard === c.c ? 'flash' : ''}`); }).join('');
    const myRow = b.hands[me].map((c) => cardHtml(c, `data-card="${c.c}"`, `${mine.has(c.c) ? 'tap' : 'dim'} ${sel === c.c ? 'on' : ''}`)).join('');
    A.board(`<div class="felt-table speed"><div class="srow">${backHtml('', 'sm stack')}<span class="cnt">${b.reserves[op]}</span>${opRow}</div><div class="srow mid">${tops}</div><div class="srow">${backHtml('', 'stack')}<span class="cnt">${b.reserves[me]}</span>${myRow}</div></div>`, (d) => {
      if (d.card != null) {
        const opts = mine.get(+d.card) || []; if (!opts.length) return;
        if (opts.length === 1) { A.sel = null; return A.play(opts[0][1]); }
        A.sel = { speed: +d.card }; return A.redraw();
      }
      if (d.tgt != null && sel != null) { const o = (mine.get(sel) || []).find(([t]) => t === +d.tgt); A.sel = null; if (o) return A.play(o[1]); return A.redraw(); }
    });
    A.drag({ src: '[data-card]', dst: '[data-tgt]', drop: (sEl, dEl) => { const o = (mine.get(+sEl.dataset.card) || []).find(([t]) => t === +dEl.dataset.tgt); if (o) { A.sel = null; A.play(o[1]); } } });
    A.acts([{ label: '台札を替える', move: reset ?? -1, enabled: reset != null }]);
  }

  // ---------------------------------------------------------------- ソリティア(クロンダイク・スパイダー)
  let solRO = null;
  // 前回の札の大きさ。描き直した盤に最初から入れて、描き直しの間も札(と数字)の大きさが変わらないようにする
  const solLastW = {};
  const solWStyle = (cols) => (solLastW[cols] ? ` style="--sol-w:${solLastW[cols]}px"` : '');
  function fitSolitaire() {
    const sol = document.querySelector('#boardwrap .felt-table.sol');
    if (!sol) return;
    const topEl = sol.querySelector('.soltop'), tabEl = sol.querySelector('.soltab');
    const cols = sol.classList.contains('spider') ? 10 : 7;
    // 札が大きすぎると盤が外枠より広がるので、外枠の幅も上限にする
    const solW = Math.min(sol.clientWidth || 640, (sol.parentElement && sol.parentElement.clientWidth) || 9999), solH = sol.clientHeight || 420;
    const cardW = Math.floor(Math.max(cols > 7 ? 24 : 36, Math.min(100, (solW - 60) / (cols + 0.5), solH * 0.165)));
    sol.style.setProperty('--sol-w', cardW + 'px');
    solLastW[cols] = cardW;
    const cardH = cardW * 1.4;
    const topH = topEl ? topEl.offsetHeight : cardH + 6;
    const tabH = Math.max(110, (tabEl && tabEl.clientHeight ? tabEl.clientHeight : solH - topH - 36) - 6);
    const defClose = cardW * 0.16, defOpen = cardW * 0.37;
    sol.querySelectorAll('.spile').forEach((pile) => {
      const cards = [...pile.querySelectorAll('.pcard.pil')];
      if (cards.length <= 1) {
        pile.style.removeProperty('--sol-close');
        pile.style.removeProperty('--sol-open');
        return;
      }
      let cGaps = 0, oGaps = 0;
      for (let i = 1; i < cards.length; i++) {
        if (cards[i - 1].classList.contains('open')) oGaps++;
        else cGaps++;
      }
      const needSpan = cGaps * defClose + oGaps * defOpen;
      const availSpan = Math.max(16, tabH - cardH - 4);
      if (needSpan > availSpan && needSpan > 0) {
        const k = availSpan / needSpan;
        const stepClose = defClose * k, stepOpen = defOpen * k;
        pile.style.setProperty('--sol-close', (stepClose - cardH).toFixed(2) + 'px');
        pile.style.setProperty('--sol-open', (stepOpen - cardH).toFixed(2) + 'px');
      } else {
        pile.style.removeProperty('--sol-close');
        pile.style.removeProperty('--sol-open');
      }
    });
  }
  function watchSolitaire() {
    fitSolitaire();
    const solEl = document.querySelector('#boardwrap .felt-table.sol');
    if (solEl && typeof ResizeObserver !== 'undefined') {
      if (solRO) solRO.disconnect();
      solRO = new ResizeObserver(() => fitSolitaire());
      solRO.observe(solEl);
    }
  }
  // 描き直す前の札の位置(と見た目)を覚えておく
  function solSnap() {
    solLand();
    const all = [...document.querySelectorAll('#boardwrap [data-cid]')];
    const stock = document.querySelector('#boardwrap .slot[data-draw]');
    return {
      cid: new Map(all.filter((e) => !e.hasAttribute('data-wid')).map((e) => [+e.dataset.cid, { r: e.getBoundingClientRect(), html: e.outerHTML }])),
      wid: new Map([...document.querySelectorAll('#boardwrap .waste [data-wid]')].map((e) => [+e.dataset.wid, { r: e.getBoundingClientRect(), html: e.outerHTML }])),
      stock: stock ? stock.getBoundingClientRect() : null,
    };
  }
  // 盤の外に浮かせた札(消える札・組札へ飛ぶ札)
  function solFloat(html, r) {
    const g = document.createElement('div'); g.innerHTML = html;
    const el = g.firstElementChild;
    el.removeAttribute('data-cid'); el.removeAttribute('data-src'); el.removeAttribute('data-wid'); el.classList.remove('tap', 'on', 'dragsrc');
    Object.assign(el.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 30, pointerEvents: 'none' });
    // CSS の変数は Object.assign では入らない(入らないと字・マークが既定の小さい札の大きさになり、着いた時に大きさが飛ぶ)
    el.style.setProperty('--w', r.width + 'px');
    document.body.appendChild(el);
    return el;
  }
  // 動いた札をすべらせる。ドラッグで置いた札は、指を離した所から行き先へ。
  // 列の欄は札がはみ出さないよう切り取っているので、動く間は盤の外に浮かせた複製を飛ばし、本物は着くまで隠す。
  // o.deal: 山札から配った札(スパイダー)、o.reveal: 新しく表になった列の札をめくる
  let solFlying = [];
  function solLand() { const f = solFlying; solFlying = []; f.forEach((x) => x()); }
  function solFly(A, e, from, ms, delay, rot, flip) {
    const r = e.getBoundingClientRect();
    const el = solFloat(e.outerHTML, r);
    el.style.zIndex = 40 + solFlying.length;
    e.style.visibility = 'hidden';
    let done = false;
    const land = () => { if (done) return; done = true; e.style.visibility = ''; el.remove(); };
    solFlying.push(land);
    el.animate([{ transform: `translate(${from.left - r.left}px,${from.top - r.top}px)${rot ? ` rotate(${rot}deg)` : ''}` }, { transform: 'none' }], { duration: ms, delay, easing: rot || ms < 200 * A.speed ? 'cubic-bezier(.22,.9,.3,1)' : 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' }).onfinish = land;
    // 配る札は、山札を離れる時に表へ返す(それまでは山札の裏に隠れている)
    if (flip) { if (delay) { el.style.visibility = 'hidden'; setTimeout(() => { if (!done) { el.style.visibility = ''; A.flipCard(el, 260, 'pcard'); } }, delay); } else A.flipCard(el, 260, 'pcard'); }
  }
  function solSlide(A, snap, o = {}) {
    const drop = A.takeDrop ? A.takeDrop() : null;
    if (A.reduce) return;
    const dropMap = new Map(((drop && drop.items) || []).filter((i) => i.cid != null).map((i) => [+i.cid, i.rect]));
    let longest = 0, k = 0;
    document.querySelectorAll('#boardwrap [data-cid]').forEach((e) => {
      if (e.hasAttribute('data-wid')) return;
      const id = +e.dataset.cid, d = dropMap.get(id), old = snap.cid.get(id), from = d || (old && old.r);
      if (!from) {
        if (o.deal && snap.stock && e.closest('.spile')) {
          const delay = (k++) * 45 * A.speed, ms = 280 * A.speed;
          solFly(A, e, snap.stock, ms, delay, 0, true);
          longest = Math.max(longest, delay + ms);
        } else if (o.reveal && snap.cid.size && e.closest('.spile')) {
          A.flipCard(e, 240, 'pcard');
          longest = Math.max(longest, 240 * A.speed);
        }
        return;
      }
      const r = e.getBoundingClientRect();
      if (!d && Math.hypot(from.left - r.left, from.top - r.top) <= 4) return;
      // ドラッグで置いた札は短く収め、クリック・ダブルクリックで動かした札はスーッと飛ぶ様子が見える長さにする
      const ms = (d ? 170 : 360) * A.speed;
      solFly(A, e, from, ms, 0, d ? drop.rot || 0 : 0, false);
      longest = Math.max(longest, ms);
    });
    if (longest) A.anim(longest / A.speed + 20);
    return drop;
  }

  let solPrevWasteN = 0;
  // 札を選ぶと少し持ち上がるので、ダブルタップの2回目は1枚上の札(同じ列)に当たることがある。
  // 選んでから 0.45 秒以内に同じ列を押したら、別の札を選び直さず、選んだ札のダブルタップとして扱う
  let solSelAt = 0;
  const solQuickAgain = () => performance.now() - solSelAt < 450;
  function solitaire(b, A) {
    if (b.variant === 'spider') return spider(b, A);
    const SEAT = 1000000, seat = b.me;
    const legal = new Set(A.view.legal);
    const enc = (src, n, dest) => seat * SEAT + src * 10000 + n * 100 + dest;
    const sel = A.sel && A.sel.sol ? A.sel : null;
    A.strip(b.others.map(([i, f, g]) => `<div class="pl ${i === seat ? 'turn' : ''}"><span class="dot" style="background:${['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'][i]}"></span><span class="who"><span class="nm">${E(A.name(i))}</span><span class="nt">${g ? 'やめた' : `組札 ${f}/52`}</span></span></div>`).join(''));
    const destsFor = (src, n) => { const out = []; for (let d = 2; d <= 12; d++) if (legal.has(enc(src, n, d))) out.push(d); return out; };
    const hl = new Set(sel ? destsFor(sel.src, sel.n) : []);
    const found = b.found.map((f, i) => `<div class="slot ${hl.has(2 + i) ? 'can' : ''}" data-dest="${2 + i}">${f.length ? cardHtml(f[0], `data-cid="${f[0].c}" data-src="${2 + i}" data-n="1"`) : `<span class="pcard empty"><b>${SU[i]}</b></span>`}</div>`).join('');
    const stock = `<div class="slot" data-draw="1">${b.stock ? backHtml('data-draw="1"', 'tap') : `<span class="pcard empty redo" data-draw="1">${legal.has(seat * SEAT) ? '↻' : ''}</span>`}</div>`;
    // 捨て札は上の 3 枚を左から右へ少しずつずらして重ね、下の 2 枚の数字・マークも見えるようにする
    const snap = solSnap();
    const vis = b.waste.slice(-3), topI = vis.length - 1;
    const waste = `<div class="slot waste">${vis.map((c, i) => cardHtml(c, `data-cid="${c.c}" data-wid="${c.c}" ${i === topI ? 'data-src="1" data-n="1"' : ''}`, `${i === topI ? 'tap' : ''} ${sel && sel.src === 1 && i === topI ? 'on' : ''}`)).join('') || '<span class="pcard empty"></span>'}</div>`;
    const piles = b.piles.map((p, k) => {
      const closed = p.length - b.open[k];
      return `<div class="spile ${hl.has(6 + k) ? 'can' : ''}" data-dest="${6 + k}">${p.length ? p.map((c, i) => i < closed ? backHtml('', 'pil') : cardHtml(c, `data-cid="${c.c}" data-src="${6 + k}" data-n="${p.length - i}"`, `pil open tap ${sel && sel.src === 6 + k && p.length - i <= sel.n ? 'on' : ''}`)).join('') : '<span class="pcard empty">K</span>'}</div>`;
    }).join('');
    const autoMove = (src, n) => {
      const ds = destsFor(src, n), f = ds.find((x) => x < 6) ?? ds[0];
      if (f != null) { A.sel = null; A.play(enc(src, n, f)); return true; }
      return false;
    };
    A.board(`<div class="felt-table sol"${solWStyle(7)}><div class="soltop">${stock}${waste}<span class="grow"></span>${found}</div><div class="soltab">${piles}</div></div>`, (d, el) => {
      if (d.draw != null) { if (legal.has(seat * SEAT)) { A.sel = null; A.play(seat * SEAT); } return; }
      if (d.src != null) {
        const src = +d.src, n = +d.n;
        // もう一度(同じ札、またはダブルタップで同じ列の別の札に当たった時): 組札へ。置けなければ置ける列へ
        if (sel && sel.src === src && (sel.n === n || solQuickAgain())) {
          if (autoMove(sel.src, sel.n)) return;
          A.sel = null; return A.redraw();
        }
        if (sel) { const dest = +(el.closest('[data-dest]') || {}).dataset?.dest; if (dest && legal.has(enc(sel.src, sel.n, dest))) { A.sel = null; return A.play(enc(sel.src, sel.n, dest)); } }
        if (destsFor(src, n).length) { A.sel = { sol: 1, src, n }; solSelAt = performance.now(); return A.redraw(); }
        A.sel = null; return A.redraw();
      }
      // 選んだ札は少し持ち上がるので、2回目のクリックが同じ列の地に当たった時も「もう一度押した」とみなす
      if (d.dest != null && sel && +d.dest === sel.src) { if (autoMove(sel.src, sel.n)) return; A.sel = null; return A.redraw(); }
      if (d.dest != null && sel) { const m = enc(sel.src, sel.n, +d.dest); A.sel = null; if (legal.has(m)) return A.play(m); return A.redraw(); }
    });
    // ダブルクリック: 1回目で札を選び(盤を描き直す)、2回目で上の「同じ札をもう一度」の処理が組札(無ければ置ける列)へ動かす。
    // 描き直しでブラウザの dblclick は届かないので使わない(届いた時に2回動かないよう、消しておく)
    watchSolitaire();
    // 捨て札が流れ、山札から引いた札は表を返しながら手前に重なる。
    if (!A.reduce && (snap.wid.size || vis.length)) {
      const now = new Set(vis.map((c) => c.c));
      document.querySelectorAll('#boardwrap .waste [data-wid]').forEach((e) => { const id = +e.dataset.wid, r = e.getBoundingClientRect(), o = snap.wid.get(id);
        if (o && (o.r.left !== r.left)) e.animate([{ transform: `translate(${o.r.left - r.left}px,${o.r.top - r.top}px)` }, { transform: 'none' }], { duration: 220 * A.speed, easing: 'ease-out' });
        // 山札から引いて捨て札が増えた時だけ山札から飛ばす。捨て札を出して下から見えてきた札は動かさない
        else if (!o && snap.stock && !snap.cid.has(id) && b.wasteN > solPrevWasteN) {
          A.flipCard(e,260,'pcard');
          e.animate([{transform:`translate(${snap.stock.left-r.left}px,${snap.stock.top-r.top}px)`}, {transform:'none'}],
            {duration:260*A.speed,easing:'cubic-bezier(.3,.8,.4,1)'});
        }
      });
      // 見えている 3 枚から押し出された札だけを薄く消す(出した札は行き先へすべるので消さない)
      for (const [id, o] of snap.wid) if (!now.has(id) && !document.querySelector(`#boardwrap [data-cid="${id}"]`)) {
        const el = solFloat(o.html, o.r);
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-o.r.width * .4}px)` }], { duration: 280 * A.speed, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
      }
      if (vis.length && [...snap.wid.keys()].join() !== vis.map((c) => c.c).join()) A.anim(300);
    }
    solPrevWasteN = b.wasteN;
    // 捨て札から出した札も、列・組札へすべらせる
    for (const [id, o] of snap.wid) if (!snap.cid.has(id)) snap.cid.set(id, o);
    // 列・組札へ移動したカードのスライドアニメーション(ダブルクリック・タップ・ドラッグ共通)。開いた札はめくる
    solSlide(A, snap, { reveal: true });
    solDrag(A, legal, enc);
    // 盤の下のボタンは置かない(やめる=右の「降参」、組札へ=ダブルクリック、配る=山札をタップ)
    A.acts([]);
  }
  function solDrag(A, legal, enc) {
    A.drag({
      src: '[data-src]',
      dst: '[data-dest]',
      getStack: (sEl) => {
        const src = +sEl.dataset.src, n = +sEl.dataset.n;
        if (src >= 6 && n > 1 && sEl.parentElement) {
          return [...sEl.parentElement.querySelectorAll('[data-src]')].filter((el) => +el.dataset.n <= n);
        }
        return [sEl];
      },
      canDrop: (sEl, dEl) => legal.has(enc(+sEl.dataset.src, +sEl.dataset.n, +dEl.dataset.dest)),
      drop: (sEl, dEl) => {
        const m = enc(+sEl.dataset.src, +sEl.dataset.n, +dEl.dataset.dest);
        if (legal.has(m)) { A.sel = null; A.play(m); }
      },
    });
  }

  // スパイダー: 10 列。同じマークで K〜A がそろうと自動で組札(左上の 8 か所)へ。山札は全部の列に 1 枚ずつ配る。
  function spider(b, A) {
    const SEAT = 1000000, seat = b.me;
    const legal = new Set(A.view.legal);
    const enc = (src, n, dest) => seat * SEAT + src * 10000 + n * 100 + dest;
    const rk = (c) => (c.r === 14 ? 1 : c.r);
    const sel = A.sel && A.sel.spi ? A.sel : null;
    A.strip(b.others.map(([i, f, g]) => `<div class="pl ${i === seat ? 'turn' : ''}"><span class="dot" style="background:${['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#5A3A22'][i]}"></span><span class="who"><span class="nm">${E(A.name(i))}</span><span class="nt">${g ? 'やめた' : `組 ${f}/8`}</span></span></div>`).join(''));
    const destsFor = (src, n) => { const out = []; for (let d = 6; d <= 15; d++) if (legal.has(enc(src, n, d))) out.push(d); return out; };
    const hl = new Set(sel ? destsFor(sel.src, sel.n) : []);
    const snap = solSnap();
    const canDeal = legal.has(seat * SEAT);
    const stock = `<div class="slot" data-draw="1">${b.stock ? `<span class="pcard back tap ${canDeal ? '' : 'dim'}" data-draw="1"><em class="deals">${b.deals}</em></span>` : '<span class="pcard empty" data-draw="1"></span>'}</div>`;
    const done = Array.from({ length: 8 }, (_, i) => `<div class="slot" data-done="${i}">${b.done[i] != null ? cardHtml({ r: 13, s: b.done[i] }) : '<span class="pcard empty"></span>'}</div>`).join('');
    const runOf = (p, open) => { let n = p.length ? 1 : 0; for (let i = p.length - 1; i > p.length - open; i--) { const a = p[i - 1], c = p[i]; if (a.s === c.s && rk(a) === rk(c) + 1) n++; else break; } return n; };
    const piles = b.piles.map((p, k) => {
      const closed = p.length - b.open[k], run = runOf(p, b.open[k]);
      return `<div class="spile ${hl.has(6 + k) ? 'can' : ''}" data-dest="${6 + k}">${p.length ? p.map((c, i) => i < closed ? backHtml('', 'pil')
        : p.length - i <= run ? cardHtml(c, `data-cid="${c.c}" data-src="${6 + k}" data-n="${p.length - i}"`, `pil open tap ${sel && sel.src === 6 + k && p.length - i <= sel.n ? 'on' : ''}`)
        : cardHtml(c, `data-cid="${c.c}"`, 'pil open')).join('') : '<span class="pcard empty"></span>'}</div>`;
    }).join('');
    // 置き先の候補: 同じマークの上 > ほかの札の上 > 空いた列
    const bestDest = (src, n) => {
      const ds = destsFor(src, n); if (!ds.length) return null;
      const p = b.piles[src - 6], first = p[p.length - n];
      const score = (d) => { const q = b.piles[d - 6]; if (!q.length) return 0; return q[q.length - 1].s === first.s ? 2 : 1; };
      return ds.slice().sort((x, y) => score(y) - score(x))[0];
    };
    const autoMove = (src, n) => { const d = bestDest(src, n); if (d != null) { A.sel = null; A.play(enc(src, n, d)); return true; } return false; };
    A.board(`<div class="felt-table sol spider"${solWStyle(10)}><div class="soltop">${stock}<span class="grow"></span>${done}</div><div class="soltab">${piles}</div></div>`, (d, el) => {
      if (d.draw != null) { if (canDeal) { A.sel = null; A.play(seat * SEAT); } return; }
      if (d.src != null) {
        const src = +d.src, n = +d.n;
        if (sel && sel.src === src && (sel.n === n || solQuickAgain())) { if (autoMove(sel.src, sel.n)) return; A.sel = null; return A.redraw(); }
        if (sel) { const dest = +(el.closest('[data-dest]') || {}).dataset?.dest; if (dest && legal.has(enc(sel.src, sel.n, dest))) { A.sel = null; return A.play(enc(sel.src, sel.n, dest)); } }
        if (destsFor(src, n).length) { A.sel = { spi: 1, src, n }; solSelAt = performance.now(); return A.redraw(); }
        A.sel = null; return A.redraw();
      }
      // 選んだ札は少し持ち上がるので、2回目のクリックが同じ列の地に当たった時も「もう一度押した」とみなす
      if (d.dest != null && sel && +d.dest === sel.src) { if (autoMove(sel.src, sel.n)) return; A.sel = null; return A.redraw(); }
      if (d.dest != null && sel) { const m = enc(sel.src, sel.n, +d.dest); A.sel = null; if (legal.has(m)) return A.play(m); return A.redraw(); }
    });
    watchSolitaire();
    solSlide(A, snap, { deal: b.last === 0, reveal: b.last !== 0 });
    // そろった 13 枚は、列から組札の置き場へ飛ばす
    if (!A.reduce && snap.cid.size) {
      const gone = [...snap.cid].filter(([id]) => !document.querySelector(`#boardwrap [data-cid="${id}"]`));
      const slot = document.querySelector(`#boardwrap [data-done="${b.done.length - 1}"]`);
      if (gone.length >= 13 && slot) {
        const to = slot.getBoundingClientRect();
        gone.sort((x, y) => y[1].r.top - x[1].r.top).forEach(([, o], i) => {
          const el = solFloat(o.html, o.r), delay = i * 30 * A.speed, ms = 320 * A.speed;
          el.animate([{ transform: 'none' }, { transform: `translate(${to.left - o.r.left}px,${to.top - o.r.top}px)` }], { duration: ms, delay, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' }).onfinish = () => el.remove();
        });
        const last = slot.firstElementChild;
        if (last) last.animate([{ opacity: 0 }, { opacity: 0, offset: .99 }, { opacity: 1 }], { duration: (gone.length * 30 + 320) * A.speed });
        A.anim(gone.length * 30 + 340);
      }
    }
    solDrag(A, legal, enc);
    A.acts([]);
  }

  // ---------------------------------------------------------------- 麻雀
  const HON = ['東', '南', '西', '北', '白', '發', '中'];
  const KAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const PIN = { 1: [[15, 20]], 2: [[15, 11], [15, 29]], 3: [[8, 9], [15, 20], [22, 31]], 4: [[9, 11], [21, 11], [9, 29], [21, 29]], 5: [[9, 10], [21, 10], [15, 20], [9, 30], [21, 30]], 6: [[9, 8], [21, 8], [9, 20], [21, 20], [9, 32], [21, 32]], 7: [[7, 7], [15, 11], [23, 15], [9, 24], [21, 24], [9, 33], [21, 33]], 8: [[9, 7], [21, 7], [9, 15.5], [21, 15.5], [9, 24.5], [21, 24.5], [9, 33], [21, 33]], 9: [[7, 8], [15, 8], [23, 8], [7, 20], [15, 20], [23, 20], [7, 32], [15, 32], [23, 32]] };
  const SOU = { 2: [[15, 11], [15, 29]], 3: [[15, 11], [9, 29], [21, 29]], 4: [[9, 11], [21, 11], [9, 29], [21, 29]], 5: [[8, 11], [22, 11], [15, 20], [8, 29], [22, 29]], 6: [[7, 11], [15, 11], [23, 11], [7, 29], [15, 29], [23, 29]], 7: [[15, 7], [7, 20], [15, 20], [23, 20], [7, 33], [15, 33], [23, 33]], 8: [[6, 11], [12, 11], [18, 11], [24, 11], [6, 29], [12, 29], [18, 29], [24, 29]], 9: [[7, 8], [15, 8], [23, 8], [7, 20], [15, 20], [23, 20], [7, 32], [15, 32], [23, 32]] };
  const isRedTile = (id, red) => red && (id === 16 || id === 52 || id === 88);
  function tileFace(id, red) {
    const t = id >> 2, r = isRedTile(id, red);
    if (t >= 27) {
      const h = HON[t - 27];
      if (h === '白') return '';
      return `<text x="15" y="28" font-family="Yuji Boku,serif" font-size="21" text-anchor="middle" fill="${h === '發' ? '#1F7A45' : h === '中' ? '#C8362E' : '#15151A'}">${h}</text>`;
    }
    const n = t % 9 + 1, suit = Math.floor(t / 9);
    if (suit === 0) return `<text x="15" y="18" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="${r ? '#C8362E' : '#15151A'}">${KAN[n - 1]}</text><text x="15" y="35" font-family="Yuji Boku,serif" font-size="14" text-anchor="middle" fill="#C8362E">萬</text>`;
    if (suit === 1) return PIN[n].map(([x, y], i) => { const big = n === 1, rr = big ? 9 : n <= 4 ? 5 : n <= 6 ? 4.2 : 3.6; const col = r ? '#C8362E' : n === 1 ? '#C8362E' : [ '#2F5FD0', '#1F7A45', '#C8362E'][i % 3]; return `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff" stroke="${col}" stroke-width="${big ? 2.4 : 1.6}"/><circle cx="${x}" cy="${y}" r="${rr * 0.4}" fill="${col}"/>`; }).join('');
    if (n === 1) return `<path d="M15 8c5 0 8 4 8 9 0 6-4 9-8 15-4-6-8-9-8-15 0-5 3-9 8-9z" fill="#1F7A45"/><circle cx="12.5" cy="15" r="1.6" fill="#fff"/><path d="M15 16v14M11 30h8" stroke="#C8362E" stroke-width="1.8"/>`;
    return SOU[n].map(([x, y], i) => `<rect x="${x - 1.6}" y="${y - 6.5}" width="3.2" height="13" rx="1.6" fill="${r || (n === 9 && i % 3 === 1) || (n === 7 && i === 0) || (n === 5 && i === 2) ? '#C8362E' : '#1F7A45'}"/><path d="M${x - 1.6} ${y}h3.2" stroke="#fff" stroke-width=".7"/>`).join('');
  }
  // 牌の絵(SVG)。画面には出さず、tools/build_mahjong_tiles.cjs が影ごと画像(assets/mj/<種類>.webp)にする時に使う
  const tileArt = (id, red) => `<svg viewBox="0 0 30 40" aria-hidden="true"><rect x="0" y="0" width="30" height="40" rx="4" fill="url(#xIv)" stroke="#B9AC8C" stroke-width=".8"/>${tileFace(id, red)}</svg>`;
  // 画像の名前: 種類(0〜33)。赤の五は r4・r13・r22。裏は back
  const tileKey = (id, red) => (isRedTile(id, red) ? 'r' : '') + (id >> 2);
  window.__mjTileArt = { art: tileArt, keys: [...Array.from({ length: 34 }, (_, t) => [String(t), t * 4, false]), ['r4', 16, true], ['r13', 52, true], ['r22', 88, true]] };
  // 画面の牌は、前もって作った画像(牌の絵+金色の厚み+影)。その場で CSS の影(drop-shadow)を計算しないので、卓の描き直しが軽い
  let mjPreloaded = false;
  const tileImg = (key) => {
    // 最初の 1 回で全部の牌を読んでおく(配る時に牌が遅れて出ないように)
    if (!mjPreloaded) { mjPreloaded = true; window.__mjTileArt.keys.map(([k]) => k).concat('back').forEach((k) => { const im = new Image(); im.src = `assets/mj/${k}.webp`; (window.__texKeep ||= []).push(im); }); }
    return `<img src="assets/mj/${key}.webp" alt="" draggable="false">`;
  };
  const tileSvg = (id, red, cls = '', attrs = '') => `<span class="mjt ${cls}" ${attrs}>${tileImg(tileKey(id, red))}</span>`;
  const backTile = (cls = '') => `<span class="mjt back ${cls}">${tileImg('back')}</span>`;
  const WIND = ['東', '南', '西', '北'];
  const CHI = 20000, PON = 40000, OPEN_KAN = 60000, ANKAN = 61000, ADDED_KAN = 62000, RIICHI = 1000, TSUMO = 500, RON = 501, PASS = 502, NEXT = 503, KYUSHU = 504;
  function mahjong(b, A) {
    const me = b.me, legal = new Set(A.view.legal), red = b.red;
    const st = A.sel && A.sel.mj ? A.sel : { mj: 1, tile: -1, riichi: false };
    if (st.tile < 0 && b.riichi[me] != null && b.turn === me && b.drawn >= 0) st.tile = b.drawn;
    const myTurn = A.view.human && b.phase === 0 && b.turn === me;
    const wind = (p) => WIND[(p - b.dealer + 4) % 4];
    A.strip([0, 1, 2, 3].map((k) => { const p = (me + k) % 4; return `<div class="pl ${p === b.turn && b.phase < 2 ? 'turn' : ''}"><span class="face" style="background:${['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36'][k]}">${wind(p)}</span><span class="who"><span class="nm">${E(A.name(p))}${b.riichi[p] != null ? ' ・リーチ' : ''}</span><span class="nt">${['自分', '下家', '対面', '上家'][k]}</span></span><span class="num sm">${b.points[p].toLocaleString()}</span></div>`; }).join(''));
    // 卓
    const seatBox = (k) => {
      const p = (me + k) % 4;
      const decl = b.riichi[p];
      const side = decl != null ? b.rivers[p].slice(b.rivers[p].indexOf(decl)).find((t) => !b.claimed.includes(t)) : null;
      const river = b.rivers[p].map((t) => tileSvg(t, red, `${b.claimed.includes(t) ? 'gone' : ''} ${t === side ? 'side' : ''} ${t === b.lastDiscard && b.phase === 1 ? 'hot' : ''}`)).join('');
      const melds = b.melds[p].map((m) => `<span class="meld">${m.tiles.map((t) => tileSvg(t, red, 'sm')).join('')}</span>`).join('');
      const hand = k === 0 ? '' : `<div class="ohand">${Array.from({ length: b.counts[p] }, () => backTile('sm')).join('')}${melds}</div>`;
      return `<div class="mjseat s${k}"><div class="river">${river}</div>${hand}${decl != null ? '<span class="stick"></span>' : ''}</div>`;
    };
    const center = `<div class="mjcenter"><b>${b.round < 4 ? '東' : '南'}${b.round % 4 + 1}局</b><span>${b.honba}本場・供託${b.sticks}</span><span>残り ${b.left}</span><div class="dora"><small>ドラ</small>${[0, 1, 2, 3, 4].map((i) => b.dora[i] != null ? tileSvg(b.dora[i], red, 'xs') : backTile('xs')).join('')}</div></div>`;
    const hand = b.hand.map((t) => {
      const ok = myTurn && legal.has(t + (st.riichi ? RIICHI : 0));
      return tileSvg(t, red, `big ${myTurn && !ok ? 'dim' : ''} ${st.tile === t ? 'pick' : ''} ${t === b.drawn && b.turn === me ? 'drawn' : ''}`, `data-t="${t}"`);
    }).join('');
    const myMelds = b.melds[me].map((m) => `<span class="meld">${m.tiles.map((t) => tileSvg(t, red, 'mid')).join('')}</span>`).join('');
    const info = b.phase === 1 ? `${E(A.name(b.discarder))} の捨て牌に応答` : b.phase === 2 ? '局の結果' : `${E(A.name(b.turn))}: ${E(b.action)}`;
    A.board(`<div class="mjwrap"><div class="mjtable">${[2, 3, 1, 0].map(seatBox).join('')}${center}</div><div class="mjinfo">${info}${b.furiten ? '<em>フリテン</em>' : ''}</div><div class="mjhand">${hand}<span class="grow"></span>${myMelds}</div></div>`, (d) => {
      if (d.t != null && myTurn) {
        const t = +d.t;
        if (st.tile === t && legal.has(t + (st.riichi ? RIICHI : 0))) { A.sel = null; return A.play(t + (st.riichi ? RIICHI : 0)); }
        A.sel = Object.assign({}, st, { tile: t }); return A.redraw();
      }
    });
    const chi = [...legal].filter((m) => m >= CHI && m < PON), pon = [...legal].filter((m) => m >= PON && m < OPEN_KAN);
    const kan = [...legal].filter((m) => (m >= OPEN_KAN && m <= OPEN_KAN + 33) || (m >= ANKAN && m <= ANKAN + 33) || (m >= ADDED_KAN && m <= ADDED_KAN + 135));
    const discard = st.tile >= 0 ? st.tile + (st.riichi ? RIICHI : 0) : -1;
    const canRiichi = [...legal].some((m) => m >= RIICHI && m < RIICHI + 136);
    const choose = (list, label) => {
      if (list.length === 1) return A.play(list[0]);
      A.sheet(`<h2>${label}: 使う牌を選ぶ</h2><div class="mjchoices">${list.map((code) => {
        const tiles = code >= ADDED_KAN ? [code - ADDED_KAN] : code >= ANKAN ? b.hand.filter((x) => x >> 2 === code - ANKAN) : code >= OPEN_KAN ? b.hand.filter((x) => x >> 2 === code - OPEN_KAN).concat([b.lastDiscard]) : (() => { const base = code >= PON ? PON : CHI; return [Math.floor((code - base) / 136), (code - base) % 136, b.lastDiscard].sort((x, y) => x - y); })();
        return `<button class="btn" data-code="${code}">${tiles.map((x) => tileSvg(x, red, 'mid')).join('')}</button>`; }).join('')}</div><div class="btns"><button class="btn" data-sheetback>キャンセル</button></div>`, (box) => {
        box.querySelectorAll('[data-code]').forEach((x) => (x.onclick = () => { A.closeSheet(); A.play(+x.dataset.code); }));
      });
    };
    A.acts([
      { label: st.riichi ? 'リーチ取り消し' : 'リーチ', move: -1, enabled: canRiichi && myTurn, fn: () => { A.sel = Object.assign({}, st, { riichi: !st.riichi, tile: -1 }); A.redraw(); } },
      { label: 'チー', move: -1, enabled: chi.length > 0, fn: () => choose(chi, 'チー') },
      { label: 'ポン', move: -1, enabled: pon.length > 0, fn: () => choose(pon, 'ポン') },
      { label: 'カン', move: -1, enabled: kan.length > 0, fn: () => choose(kan, 'カン') },
      { label: '九種九牌', move: KYUSHU, enabled: legal.has(KYUSHU) },
      { label: 'パス', move: PASS, enabled: legal.has(PASS) },
      { label: 'ロン', move: RON, enabled: legal.has(RON) },
      { label: 'ツモ', move: TSUMO, enabled: legal.has(TSUMO) },
      { label: '打牌', move: discard, enabled: myTurn && discard >= 0 && legal.has(discard) },
    ].filter((x, i, l) => x.enabled || i === l.length - 1));
    if (b.phase === 2 && b.result && A.view.human && !A.sheetOpen()) {
      const r = b.result;
      A.sheet(`<h2>${E(r.label)}</h2><div class="mjres">${[0, 1, 2, 3].map((p) => `<div class="${r.winners.includes(p) ? 'win' : ''}">${E(A.name(p))}<span class="num">${r.deltas[p] > 0 ? '+' : ''}${r.deltas[p]} → ${b.points[p].toLocaleString()}</span></div>`).join('')}
        ${r.tenpai.length ? `<p>テンパイ: ${r.tenpai.map((p) => E(A.name(p))).join('・')}</p>` : ''}
        ${r.scores.map((s) => `<h4>${E(A.name(s.seat))}　${E(s.desc)}</h4><p>${s.yaku.map(([n, h]) => `${E(n)} ${h >= 13 ? '役満' : h + '翻'}`).join('／')}</p><div class="mjhand small">${s.hand.map((t) => tileSvg(t, red, 'mid')).join('')}</div>`).join('')}</div>
        <div class="btns"><button class="btn gold" id="mjNext" ${legal.has(NEXT) ? '' : 'disabled'}>${r.end ? '試合結果へ' : '次の局'}</button></div>`, (box) => { box.querySelector('#mjNext').onclick = () => { A.closeSheet(); A.play(NEXT); }; });
    }
  }

  // ---------------------------------------------------------------- 人生すごろく
  const LT = { payday: ['#E23B2E', '給料日', '#fff'], job: ['#C9EFCF', '就職', '#17663A'], rank: ['#C9EFCF', 'ランクアップ', '#17663A'], ticket: ['#E6D8FF', 'ゆめチケット', '#5A2AA8'], child: ['#FFCFE0', 'ファミリー', '#B5235F'], house: ['#FFE7A3', 'マイホーム', '#8A5A00'],
    treasure: ['#FFE15C', 'お宝', '#7A4A00'], treasureBuy: ['#FFE15C', 'お宝', '#7A4A00'], treasurePick: ['#FFE15C', 'お宝', '#7A4A00'], dokkanReturn: ['#FFE15C', 'お宝', '#7A4A00'], dokkanPass: ['#FFE15C', 'お宝', '#7A4A00'],
    gamble: ['#A9E5D6', '運だめし', '#0D6351'], hap: ['#2F3542', 'ハプニング!', '#FFE15C'], bonus: ['#FF9BD6', 'ぴったりボーナス', '#8A0F5C'], giveAll: ['#FFF6E2', 'ふるまい', '#8A2B12'], giveRight: ['#FFF6E2', 'ふるまい', '#8A2B12'],
    start: ['#2F9E56', 'スタート', '#fff'], stop: ['#fff', 'ストップ!', '#C9281C'], goal: ['#FFE15C', 'ゴール!', '#C9281C'] };
  const PAWN = ['#C8463C', '#3F78C4', '#3E9B63', '#E0AE36', '#7A5AC0', '#E07AB0'];
  let lifeBoard = null, lifeH = -1, lifeGuess = 0, lifeBet = [], lifeZoom = 1, lifeSeen = null, lifeAnim = null, lifeFocusTurn = -1;
  // ルーレット(1〜10)。止まった数が上の針に来る
  const WC = ['#E2574C', '#F2A541', '#F4D35E', '#7CC576', '#3FA7B5', '#4A7FD0', '#7A4CC2', '#C24C9A', '#E07A3A', '#5BB08A'];
  const wheelAngle = (n) => -((n - 1) * 36 + 18);
  function wheelHtml(b) {
    let seg = '';
    for (let k = 0; k < 10; k++) { const a0 = (k * 36 - 90) * Math.PI / 180, a1 = ((k + 1) * 36 - 90) * Math.PI / 180, am = (a0 + a1) / 2;
      seg += `<path d="M0 0L${(46 * Math.cos(a0)).toFixed(2)} ${(46 * Math.sin(a0)).toFixed(2)}A46 46 0 0 1 ${(46 * Math.cos(a1)).toFixed(2)} ${(46 * Math.sin(a1)).toFixed(2)}Z" fill="${WC[k]}" stroke="#fff" stroke-width="1.2"/><text x="${(34 * Math.cos(am)).toFixed(2)}" y="${(34 * Math.sin(am) + 5).toFixed(2)}" font-size="14" font-weight="900" text-anchor="middle" fill="#fff" transform="rotate(${k * 36 + 18} ${(34 * Math.cos(am)).toFixed(2)} ${(34 * Math.sin(am)).toFixed(2)})">${k + 1}</text>`; }
    const can = b.canSpin;
    return `<button class="wheel ${can ? 'can' : ''}" data-spin="1" aria-label="ルーレット"><svg viewBox="-56 -60 112 116"><circle r="53" fill="#4A3220"/><g class="wr" style="transform:rotate(${b.lastSpin > 0 ? wheelAngle(b.lastSpin) : 0}deg)">${seg}</g><circle r="13" fill="#FFFDF5" stroke="#4A3220" stroke-width="3"/><path d="M-8 -58H8L0 -42Z" fill="#C9281C" stroke="#fff" stroke-width="1.5"/></svg>${can ? '<small>クリックで回す</small>' : ''}</button>`;
  }
  function life(b, A) {
    if (lifeH !== A.handle) { lifeH = A.handle; lifeBoard = null; lifeGuess = 0; lifeBet = []; lifeSeen = null; lifeFocusTurn = -1; A.call('lifeBoardJson', A.handle).then((t) => { lifeBoard = JSON.parse(t); A.redraw(); }); }
    const fmt = (v) => '$' + Number(v).toLocaleString();
    const nm = (t) => E(String(t).replace(/\[(\d)]/g, (_, i) => A.name(+i)));
    A.strip(b.players.map((p, i) => `<div class="pl ${i === b.turn && b.phase !== 9 ? 'turn' : ''}"><span class="dot" style="background:${PAWN[i]}"></span><span class="who"><span class="nm">${E(A.name(i))}${p.finish ? ` ・${p.finish}着` : ''}${p.village ? ' ・村' : ''}</span><span class="nt">${E(p.job)} ・券${p.tickets} ・子${p.children}${p.loans ? ` ・手形${p.loans}` : ''}</span></span><span class="num sm">${fmt(p.money)}</span></div>`).join(''));
    let map = '<div class="empty">盤を読み込んでいます…</div>';
    if (lifeBoard) {
      const CW = 172, CH = 126, M = 34, W = M * 2 + lifeBoard.cols * CW, H = M * 2 + lifeBoard.rows * CH;
      const pos = (q) => [M + q.x * CW + CW / 2, M + q.y * CH + CH / 2];
      let lines = '', tiles = '';
      for (const q of lifeBoard.squares) { const [x, y] = pos(q); for (const n of q.next) { const t = lifeBoard.squares[n]; if (t) { const [x2, y2] = pos(t); lines += `<path d="M${x} ${y}L${x2} ${y2}" stroke="#8a6a3a" stroke-width="10" stroke-linecap="round" opacity=".55"/>`; } } }
      for (const q of lifeBoard.squares) {
        const [x, y] = pos(q), lk = LT[q.type] || ['#FFF6E2', '', '#4A3220'];
        const stop = q.type === 'stop' || q.type === 'goal';
        const txt = (q.text || '').replace(/\$/g, '＄');
        tiles += `<g data-sq="${q.id}"><rect x="${x - CW / 2 + 5}" y="${y - CH / 2 + 7}" width="${CW - 10}" height="${CH - 10}" rx="10" fill="#000" opacity=".2"/><rect x="${x - CW / 2 + 5}" y="${y - CH / 2 + 4}" width="${CW - 10}" height="${CH - 10}" rx="10" fill="${lk[0]}" stroke="${stop ? '#C9281C' : '#4A3220'}" stroke-width="${stop ? 4 : 2.5}"/>${lk[1] ? `<text x="${x}" y="${y - 34}" text-anchor="middle" font-size="16" font-weight="900" fill="${lk[2]}">${lk[1]}</text>` : ''}<foreignObject x="${x - CW / 2 + 11}" y="${y - (lk[1] ? 26 : 46)}" width="${CW - 22}" height="${lk[1] ? 74 : 94}"><div xmlns="http://www.w3.org/1999/xhtml" class="lsq" style="color:${q.type === 'payday' || q.type === 'hap' || q.type === 'start' ? '#fff' : '#2a2118'}">${E(txt)}</div></foreignObject></g>`;
      }
      const pawns = b.players.map((p, i) => { const q = lifeBoard.squares[p.pos]; if (!q) return ''; const [x, y] = pos(q); const k = b.players.slice(0, i).filter((o) => o.pos === p.pos).length; return `<g class="pawn" data-pawn="${i}" transform="translate(${x - 54 + k * 22},${y + 38 - (k % 2) * 10}) scale(1.5)"><ellipse cx="0" cy="14" rx="10" ry="4" fill="#000" opacity=".3"/><path d="M-8 13q0-10 8-14-6-2-6-8a6 6 0 0 1 12 0q0 6-6 8 8 4 8 14z" fill="${PAWN[i]}" stroke="#2a2118" stroke-width="1.6" stroke-linejoin="round"/>${i === b.turn ? '<circle cx="0" cy="-12" r="13" fill="none" stroke="#FFC65C" stroke-width="3"/>' : ''}</g>`; }).join('');
      map = `<div class="lifemap" id="lifemap"><svg viewBox="0 0 ${W} ${H}" width="${Math.round(W * lifeZoom)}" height="${Math.round(H * lifeZoom)}" data-w="${W}" data-h="${H}"><rect width="${W}" height="${H}" fill="#BFE3A1"/>${lines}${tiles}${pawns}</svg></div>`;
    }
    const card = b.choices.length || b.title ? `<div class="lifecard"><small>${E(b.title)}</small>${b.text ? `<p>${nm(b.text)}</p>` : ''}<div class="lchoices">${b.choices.map(([m, l, strong, en]) => `<button class="btn ${strong ? 'gold' : ''}" data-lm="${m}" ${en && A.view.human ? '' : 'disabled'}>${nm(l)}</button>`).join('')}</div>
      ${b.bet && A.view.human ? `<div class="lgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="btn ${lifeBet.includes(n) ? 'gold' : ''}" data-bet="${n}">${n}</button>`).join('')}</div>` : ''}</div>` : '';
    const guess = b.guessing && A.view.human ? `<div class="lifecard"><small>夢の山の頂上</small><p>数を1つ決めてルーレットを回します。当たれば $20,000。</p><div class="lgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="btn ${lifeGuess === n ? 'gold' : ''}" data-guess="${n}">${n}</button>`).join('')}</div></div>` : '';
    const log = b.log.length ? `<div class="lifelog">${b.log.slice(-3).map((l) => `<div>${nm(l)}</div>`).join('')}</div>` : '';
    A.board(`<div class="lifewrap">${map}${wheelHtml(b)}${log}${card}${guess}</div>`, (d) => {
      if (d.spin != null) { if (lifeAnim) { lifeAnim.finish(); return; } return spinMove >= 0 && A.view.legal.includes(spinMove) && A.play(spinMove); }
      if (d.lm != null) return A.play(+d.lm);
      if (d.guess != null) { lifeGuess = +d.guess; return A.redraw(); }
      if (d.bet != null) { const n = +d.bet; lifeBet = lifeBet.includes(n) ? lifeBet.filter((x) => x !== n) : lifeBet.concat([n]).slice(-2); return A.redraw(); }
    });
    const mapEl = document.getElementById('lifemap');
    if (mapEl && lifeBoard) {
      // ホイールで拡大・縮小(カーソルの所を中心に)
      mapEl.onwheel = (e) => { e.preventDefault(); const svg = mapEl.querySelector('svg'), r = mapEl.getBoundingClientRect(), z0 = lifeZoom; lifeZoom = Math.min(2.2, Math.max(.3, lifeZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        const mx = e.clientX - r.left, my = e.clientY - r.top, px = (mapEl.scrollLeft + mx) / z0, py = (mapEl.scrollTop + my) / z0;
        svg.setAttribute('width', Math.round(svg.dataset.w * lifeZoom)); svg.setAttribute('height', Math.round(svg.dataset.h * lifeZoom)); mapEl.scrollLeft = px * lifeZoom - mx; mapEl.scrollTop = py * lifeZoom - my; };
      if (lifeFocusTurn !== b.turn) { lifeFocusTurn = b.turn; requestAnimationFrame(() => { const p = b.players[b.turn], q = lifeBoard.squares[p.pos]; if (!q) return; const x = (34 + q.x * 172 + 86) * lifeZoom, y = (34 + q.y * 126 + 63) * lifeZoom; mapEl.scrollTo({ left: x - mapEl.clientWidth / 2, top: y - mapEl.clientHeight / 2, behavior: 'smooth' }); }); }
    }
    // ルーレットが回って、駒が 1 マスずつ進む
    const seen = lifeSeen; lifeSeen = { spins: b.spins, pos: b.players.map((p) => p.pos) };
    if (seen && b.spins !== seen.spins && b.lastSpin > 0) {
      const wheel = document.querySelector('#boardwrap .wheel g.wr'), dur = 1500 * A.speed;
      if (wheel) { const end = wheelAngle(b.lastSpin); wheel.style.transformOrigin = '0 0'; lifeAnim = wheel.animate([{ transform: `rotate(${end - 360 * 4 - 17}deg)` }, { transform: `rotate(${end}deg)` }], { duration: dur, easing: 'cubic-bezier(.15,.6,.25,1)' }); lifeAnim.onfinish = () => { lifeAnim = null; }; A.sfx('SPIN'); }
      const who = b.players.findIndex((p, i) => p.pos !== seen.pos[i]);
      if (who >= 0 && lifeBoard) {
        const el = document.querySelector(`#boardwrap [data-pawn="${who}"]`), path = (b.path && b.path.length ? b.path : [seen.pos[who], b.players[who].pos]);
        const P = (id) => { const q = lifeBoard.squares[id]; return q ? [34 + q.x * 172 + 86, 34 + q.y * 126 + 63] : null; };
        const pts = [seen.pos[who], ...path.filter((id) => id !== seen.pos[who])].map(P).filter(Boolean), end = pts[pts.length - 1];
        if (el && pts.length > 1) { const fr = pts.map(([x, y], k) => ({ transform: `translate(${x - end[0]}px,${y - end[1]}px)`, offset: k / (pts.length - 1) })); const t0 = el.getAttribute('transform'); el.style.transform = ''; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); el.parentNode.insertBefore(g, el); g.appendChild(el);
          g.animate(fr, { duration: Math.min(2400, 260 * (pts.length - 1)) * A.speed, delay: dur, easing: 'linear', fill: 'backwards' }); void t0; }
        A.anim(1500 + Math.min(2400, 260 * Math.max(1, pts.length - 1)) + 100);
      } else A.anim(1600);
    }
    const spinMove = b.guessing ? (lifeGuess ? 200 + lifeGuess : -1) : 0;
    const bet = lifeBet.length === 2 ? 300 + (Math.min(...lifeBet) - 1) * 10 + (Math.max(...lifeBet) - 1) : -1;
    A.acts([
      { label: '手形を返す', move: 3, enabled: b.canRepay },
      ...(b.bet ? [{ label: 'この2つで回す', move: bet, enabled: bet >= 0 && A.view.legal.includes(bet) }] : []),
      { label: 'ルーレットを回す', move: spinMove, enabled: spinMove >= 0 && A.view.legal.includes(spinMove) },
    ]);
  }

  Object.assign(window.RENDER, { speed, solitaire, mahjong, life });
  window.PCARD = { cardHtml, backHtml };
})();
