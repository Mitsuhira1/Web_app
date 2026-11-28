(() => {
'use strict';
// 新規9ゲーム(コヨーテ〜チンチロリン)の盤面。ルールと合法手はコア(core/games/*.mjs)が担当し、
// ここは view の描画と操作だけを行う。画面は場面(シーン)方式: PC は 900×560、スマホは 560×880 の
// 座標で描き、#boardwrap に収まるよう一様に縮める(盤だけが縮み、操作部は共通部品のまま)。
const at = (x, y, html) => `<div class="anchor" style="left:${x}px;top:${y}px">${html}</div>`;
const lab = (s) => `<span class="board-label">${s}</span>`;
const note = (s) => `<span class="board-note">${s}</span>`;
const SEAT_COLORS = ['#c96a1e', '#3a6bc5', '#7a4cc2', '#b03a5b', '#2e8b6e', '#8a6d1f'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// プレイヤーのアイコン: 自分は A.face()、オンラインの相手は部屋のアイコン、それ以外は色つき頭文字。
function avFor(A, b, i) {
  if (i < 0) return '';
  if (i === b.me) return A.face();
  if (A.isOnline && typeof slotAvHtml === 'function' && typeof seatToSlot === 'function') {
    const s = seatToSlot(i);
    if (s >= 0) return slotAvHtml(s, A.name(i), i);
  }
  return `<span class="dot face" style="background:${SEAT_COLORS[i % 6]};color:#fff">${esc(A.name(i)[0] || '?')}</span>`;
}
// 側板のプレイヤー一覧(アイコン+名前+詳細)。detail は席ごとの短い文字列を返す関数。
function strip(A, b, detail) {
  A.strip(A.view.seats.map((s, i) =>
    `<div class="pl${A.view.toMove === i && !A.view.outcome ? ' turn' : ''}">${avFor(A, b, i)}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${esc(detail(i)).replace(/\d[\d,]*/g, '<span class="snum">$&</span>')}</span></span></div>`
  ).join(''));
}
// 盤の中の名前札(アイコンつき)
const seatChip = (A, b, i, extra = '') =>
  `<div class="seat-name" data-public-seat="${i}">${avFor(A, b, i)}${esc(A.name(i))}${extra}</div>`;

// ---------------------------------------------------------------- 場面の縮小と FLIP アニメーション
let nineObserved = null, ninePrev = null, nineScale = null, nineSizeOverride = null, nineFitKey = null;
function fitNine(wrap) {
  const s = wrap && wrap.querySelector('.nine-scene');
  if (!s || !wrap.clientWidth || !wrap.clientHeight) return;
  const r = Math.max(.1, Math.min((wrap.clientWidth - 10) / (+s.dataset.w || 900), (wrap.clientHeight - 10) / (+s.dataset.h || 560)));
  // 操作ボタン欄の出入りで高さだけが増えた場合は盤の大きさを変えない(ボタン欄が出ると高さが減る=縮小方向だけ合わせる)。
  // 幅や場面サイズやゲームが変わった時は合わせ直す。
  const key = `${wrap.clientWidth}|${s.dataset.w}|${s.dataset.h}|${s.dataset.game}`;
  if (nineScale && nineFitKey === key && r > nineScale) return;
  nineScale = r; nineFitKey = key;
  s.style.setProperty('--ns', r);
}
const nineObserver = new ResizeObserver((es) => { for (const e of es) fitNine(e.target); });
function readBoxes(wrap) {
  const m = new Map();
  wrap.querySelectorAll('[data-piece]').forEach((n) => m.set(n.dataset.piece, n.getBoundingClientRect()));
  return m;
}
function animateFrom(node, from, A, flip = false) {
  const to = node.getBoundingClientRect();
  const scene = node.closest('.nine-scene');
  if (!scene || !to.width || !to.height) return;
  const scale = scene.getBoundingClientRect().width / (+scene.dataset.w || 900);
  if (!scale) return;
  const dx = (from.left + from.width / 2 - to.left - to.width / 2) / scale;
  const dy = (from.top + from.height / 2 - to.top - to.height / 2) / scale;
  if (!flip && Math.abs(dx) + Math.abs(dy) < 3) return;
  if (flip) A.flipCard(node, 380, node.dataset.flipcls || 'pc');
  node.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
    { duration: 380 * A.speed, easing: 'cubic-bezier(.2,.9,.3,1)' });
  A.land(150);
  A.anim(400);
}
// 描画前に呼ぶ: 操作可否と合法手の集合を用意する(stage でも同じことをするが、盤の組み立て中にも使うため)
function prep(A) {
  A.canPlay = A.view.human && !A.view.outcome && !busy && !isMySeatAutoCpu();
  A.legal = new Set(A.canPlay ? A.view.legal : []);
}
// 描画の共通処理。inner は場面の中身、onTap は A.board のクリック処理、anim は (wrap, prev) => {} の追加演出。
function stage(A, b, inner, onTap, anim) {
  prep(A);
  const mob = isMob();
  const W = nineSizeOverride ? nineSizeOverride.w : (mob ? 560 : 900), H = nineSizeOverride ? nineSizeOverride.h : (mob ? 880 : 560);
  // 前回の拡縮率を引き継ぎ、確定は次のフレーム(レイアウトが落ち着いてから)に行う。
  // 再描画の最中に測ると一瞬だけ大きい値が固定され、タップのたびに盤が拡大して見えるため。
  A.board(`<div class="nine-scene${mob ? ' mob' : ''}" data-game="${b.kind}" data-ready="${A.canPlay}" data-w="${W}" data-h="${H}" style="width:${W}px;height:${H}px${nineScale ? `;--ns:${nineScale}` : ''}">${inner}</div>`, onTap);
  const wrap = document.getElementById('boardwrap');
  if (nineObserved !== wrap) {
    if (nineObserved) nineObserver.unobserve(nineObserved);
    if (wrap) nineObserver.observe(wrap);
    nineObserved = wrap;
  }
  requestAnimationFrame(() => fitNine(wrap));
  const prev = ninePrev;
  if (prev && prev.handle === A.handle && prev.moves + 1 === A.view.moves && !A.reduce) {
    // 前の画面と同じ data-piece が新しい場所にあれば、そこから滑らかに動かす
    wrap.querySelectorAll('[data-piece]').forEach((node) => {
      const from = prev.boxes.get(node.dataset.piece);
      if (from) animateFrom(node, from, A, node.dataset.flip === '1');
    });
    if (anim) anim(wrap, prev);
  }
  ninePrev = { handle: A.handle, moves: A.view.moves, boxes: readBoxes(wrap), board: b };
  return { mob, W, H };
}
// スマホ/PC の切り替わりで描き直す
let lastMob = null;
window.addEventListener('resize', () => {
  const m = isMob();
  if (lastMob !== null && m !== lastMob && document.querySelector('.nine-scene') && typeof drawPlay === 'function') drawPlay(true);
  lastMob = m;
});
// 操作できる時だけ押せる盤内ボタン(twelve.js の control と同じ考え方)
const control = (html, attr, label, enabled, cls = '') => enabled
  ? `<button type="button" class="nine-control ${cls}" ${attr} aria-label="${esc(label)}">${html}</button>`
  : `<span class="nine-static ${cls}" ${attr}>${html}</span>`;
const moveBtn = (A, m, html, label, cls = '') => control(html, `data-m="${m}"`, label, A.canPlay && A.legal.has(m), cls);
// カードや駒を押した時の共通処理(data-m の手を実行、data-src はゲーム側で処理)
const tapMove = (A) => (d) => { if (d.m != null && A.legal.has(Number(d.m))) A.play(Number(d.m)); };

// ================================================================ コヨーテ
const PAW = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#fff"><ellipse cx="50" cy="62" rx="17" ry="13"/><ellipse cx="24" cy="42" rx="8" ry="11" transform="rotate(-18 24 42)"/><ellipse cx="41" cy="32" rx="8.5" ry="12"/><ellipse cx="59" cy="32" rx="8.5" ry="12"/><ellipse cx="76" cy="42" rx="8" ry="11" transform="rotate(18 76 42)"/></g></svg>`;
const cyCard = (c, w, cls = '', key = '') => {
  const st = `style="--cw:${w}px"`, kp = key ? ` data-piece="${key}"` : '';
  if (!c) return `<span class="cy-card slot" ${st}></span>`;
  if (c.hidden) return `<span class="cy-card back ${cls}" ${st}${kp}>${PAW}</span>`;
  const k = c.kind === 'num' ? (c.value < 0 ? 'neg' : 'num') : 'sp ' + c.kind;
  return `<span class="cy-card ${k} ${cls}" ${st}${kp}><b>${esc(c.short)}</b></span>`;
};
const hearts = (b, i) => {
  let s = '';
  for (let k = 0; k < b.maxLives; k++) s += `<i class="${k < b.lives[i] ? 'on' : ''}">♥</i>`;
  return `<em class="cy-hearts">${s}</em>`;
};
// ---- コヨーテ(緑の楕円卓と見本のレイアウトで描く。中央は数字だけ) ----
function renderCoyote(b, A) {
  const mob = isMob();
  const me = Math.max(0, b.me);
  const selOk = A.sel && A.sel.kind === 'coyote' && A.sel.moves === A.view.moves;
  const bid = clamp(selOk ? A.sel.bid : b.minBid, b.minBid, b.maxBid);
  strip(A, b, (i) => b.alive[i] ? `ライフ ${b.lives[i]}` : '脱落');
  A.round(`ラウンド ${b.roundNo}`);
  A.side(`<div class="kv"><span>山札</span><b class="num">${b.deckCount} 枚</b></div><div class="kv"><span>ラウンド</span><b class="num">${b.roundNo}</b></div>`);
  const slots = mob ? {
    1: [[280, 120]],
    2: [[140, 128], [420, 128]],
    3: [[95, 128], [280, 112], [465, 128]],
    4: [[88, 120], [204, 106], [356, 106], [472, 120]],
    5: [[95, 112], [280, 100], [465, 112], [150, 268], [410, 268]],
  } : {
    1: [[450, 108]],
    2: [[215, 120], [685, 120]],
    3: [[140, 262], [450, 108], [760, 262]],
    4: [[132, 318], [228, 116], [672, 116], [768, 318]],
    5: [[128, 330], [176, 120], [450, 104], [724, 120], [772, 330]],
  };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  const seatHtml = (seat, x, y, cardW, withAva) => {
    const dead = !b.alive[seat];
    const c = dead ? null : b.cards[seat];
    return at(x, y, `<div class="cy2-seat${dead ? ' dead' : ''}">${withAva ? `<span class="cy2-ava" style="background:${SEAT_COLORS[seat % 6]}">${esc(A.name(seat).slice(0, 1))}</span>` : ''}<div class="cy2-cardwrap">${cyCard(c, cardW, seat === b.turn && !b.done ? 'turn' : '', 'cy-card-' + seat)}<div class="cy2-ground"></div></div><div class="cy2-namerow"><span class="cy2-name">${esc(A.name(seat))}</span>${hearts(b, seat)}</div></div>`);
  };
  const many = opps.length >= 5;
  const plateY = mob ? (many ? 478 : 448) : 248;
  let html = `<div class="cy2-table"></div>`;
  opps.forEach((seat, idx) => { const [x, y] = slotList[idx]; html += seatHtml(seat, x, y, mob ? 72 : 78, true); });
  if (b.currentBid > 0) {
    html += at(mob ? 280 : 450, plateY, `<div class="cy2-plate"><span class="by">${esc(A.name(b.lastBidder))}</span><div class="cy2-bid">${b.currentBid}</div></div>`);
    const hist = b.bidHistory.slice(-5);
    if (hist.length) {
      html += at(mob ? 280 : 450, plateY + 67, `<div class="cy2-hists">${hist.map((h, i) => `${i ? '<span class="cy2-harr">→</span>' : ''}<span class="cy2-hchip${i === hist.length - 1 ? ' now' : ''}">${h.bid}</span>`).join('')}</div>`);
    }
  }
  html += at(mob ? 452 : 584, mob ? plateY - 28 : 216, `<div class="cy2-deck">${cyCard({ hidden: true }, 50, 'd3')}${cyCard({ hidden: true }, 50, 'd2')}${cyCard({ hidden: true }, 50, 'd1')}</div>`);
  html += seatHtml(b.me, mob ? 280 : 450, mob ? 700 : 431, mob ? 100 : 106, false);
  if (b.me < 0) html += at(mob ? 280 : 450, mob ? 560 : 348, note('観戦中(全員のカードは見えません)'));
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const cards = lr.cards.map((c, i) => c ? `<div class="cy-rev-cell">${cyCard(c, 54, i === lr.loser ? 'loser' : '')}<span>${esc(A.name(i))}</span></div>` : '').join('');
    const calc = [];
    if (lr.mysteryCard) calc.push(`「?」で ${esc(lr.mysteryCard.short)} を追加`);
    if (lr.maxZeroedId != null) calc.push(`最大の ${lr.maxZeroedValue} を 0 に`);
    calc.push(`合計 ${lr.baseSum}`);
    if (lr.doubled) calc.push('×2');
    html += `<div class="cy-reveal"><div class="cy-rev-cards">${cards}</div>` +
      `<div class="cy-rev-calc">${calc.join(' → ')} = <b>${lr.finalTotal}</b></div>` +
      `<div class="cy-rev-result">宣言 ${lr.bid} は${lr.over ? 'オーバー' : '以内'}。<b>${esc(A.name(lr.loser))}</b> の負け${lr.eliminated ? '(脱落)' : ''}</div></div>`;
    A.anim(1750);
    A.sfx('CARD_FLIP', 60);
    if (lr.reshuffled) A.sfx('SHUFFLE', 500);
  }
  const { mob: _m } = stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lr = lr ? lr.roundNo : ninePrev.lr;
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  const setBid = (v) => { A.sel = { kind: 'coyote', moves: A.view.moves, bid: clamp(v, b.minBid, b.maxBid) }; A.redraw(); };
  A.acts([
    { label: '−', cls: 'step', fn: () => setBid(bid - 1), enabled: A.canPlay && bid > b.minBid },
    { label: `${bid} と宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) },
    { label: '＋', cls: 'step', fn: () => setBid(bid + 1), enabled: A.canPlay && bid < b.maxBid },
    { label: 'コヨーテ!', move: 0, cls: 'danger', enabled: !!(b.canCoyote && A.legal.has(0)) },
  ]);
}
function cyLegacyRender(b, A) {
  const me = Math.max(0, b.me);
  const selOk = A.sel && A.sel.kind === 'coyote' && A.sel.moves === A.view.moves;
  const bid = clamp(selOk ? A.sel.bid : b.minBid, b.minBid, b.maxBid);
  strip(A, b, (i) => b.alive[i] ? `ライフ ${b.lives[i]}` : '脱落');
  A.round(`ラウンド ${b.roundNo}`);
  A.side(`<div class="kv"><span>山札</span><b class="num">${b.deckCount} 枚</b></div><div class="kv"><span>ラウンド</span><b class="num">${b.roundNo}</b></div>`);
  const mob = isMob();
  const slots = mob
    ? { 1: [[280, 128]], 2: [[105, 138], [455, 138]], 3: [[92, 158], [280, 118], [468, 158]], 4: [[80, 310], [115, 128], [445, 128], [480, 310]], 5: [[76, 340], [100, 130], [280, 102], [460, 130], [484, 340]] }
    : { 1: [[450, 112]], 2: [[215, 118], [685, 118]], 3: [[148, 228], [450, 106], [752, 228]], 4: [[138, 302], [232, 112], [668, 112], [762, 302]], 5: [[132, 322], [178, 122], [450, 96], [722, 122], [768, 322]] };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  let html = `<div class="nine-table cy-table"></div>`;
  opps.forEach((seat, idx) => {
    const [x, y] = slotList[idx];
    const c = b.cards[seat];
    const dead = !b.alive[seat];
    html += at(x, y - 8, `<div class="cy-seat${dead ? ' dead' : ''}">${cyCard(dead ? null : c, mob ? 62 : 68, seat === b.turn && !b.done ? 'turn' : '', 'cy-card-' + seat)}</div>`);
    html += at(x, y + (mob ? 52 : 56), seatChip(A, b, seat, hearts(b, seat)));
  });
  // 中央: 現在の宣言と履歴、山札
  const cx = mob ? 280 : 450, cy = mob ? 400 : 268;
  const hist = b.bidHistory.slice(-5).map((h) =>
    `<span class="cy-hist"><i style="background:${SEAT_COLORS[h.seat % 6]}"></i>${h.bid}</span>`).join('');
  html += at(cx, cy - 30, `<div class="cy-plate">${b.currentBid > 0 ? `<b>${b.currentBid}</b><span>${esc(A.name(b.lastBidder))} の宣言</span>` : `<span class="cy-none">まだ宣言なし</span>`}</div>`);
  if (hist) html += at(cx, cy + 32, `<div class="cy-hists">${hist}</div>`);
  html += at(mob ? 472 : 782, mob ? 548 : 430, `<div class="cy-deck">${cyCard({ hidden: true }, mob ? 44 : 50)}<span>山札 ${b.deckCount}</span></div>`);
  // 自分: 裏向きのカードを大きく
  const myY = mob ? 668 : 442;
  html += at(cx, myY - 16, `<div class="cy-seat mine">${cyCard(b.me >= 0 && b.alive[b.me] ? b.cards[b.me] : null, mob ? 104 : 96, b.turn === b.me && !b.done ? 'turn' : '', 'cy-card-' + b.me)}</div>`);
  html += at(cx, myY + (mob ? 82 : 76), seatChip(A, b, me, hearts(b, me)));
  if (b.me < 0) html += at(cx, mob ? 520 : 356, note('観戦中(全員のカードは見えません)'));
  // 直前のラウンドの公開演出
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const cards = lr.cards.map((c, i) => c ? `<div class="cy-rev-cell">${cyCard(c, mob ? 46 : 54, i === lr.loser ? 'loser' : '')}<span>${esc(A.name(i))}</span></div>` : '').join('');
    const calc = [];
    if (lr.mysteryCard) calc.push(`「?」で ${esc(lr.mysteryCard.short)} を追加`);
    if (lr.maxZeroedId != null) calc.push(`最大の ${lr.maxZeroedValue} を 0 に`);
    calc.push(`合計 ${lr.baseSum}`);
    if (lr.doubled) calc.push('×2');
    html += `<div class="cy-reveal"><div class="cy-rev-cards">${cards}</div>` +
      `<div class="cy-rev-calc">${calc.join(' → ')} = <b>${lr.finalTotal}</b></div>` +
      `<div class="cy-rev-result">宣言 ${lr.bid} は${lr.over ? 'オーバー' : '以内'}。<b>${esc(A.name(lr.loser))}</b> の負け${lr.eliminated ? '(脱落)' : ''}</div></div>`;
    A.anim(1750);
    A.sfx('CARD_FLIP', 60);
    if (lr.reshuffled) A.sfx('SHUFFLE', 500);
  }
  const { mob: _m } = stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lr = lr ? lr.roundNo : ninePrev.lr;
  // 操作: ステッパー+宣言+コヨーテ
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  const setBid = (v) => { A.sel = { kind: 'coyote', moves: A.view.moves, bid: clamp(v, b.minBid, b.maxBid) }; A.redraw(); };
  A.acts([
    { label: '−', cls: 'step', fn: () => setBid(bid - 1), enabled: A.canPlay && bid > b.minBid },
    { label: `${bid} と宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) },
    { label: '＋', cls: 'step', fn: () => setBid(bid + 1), enabled: A.canPlay && bid < b.maxBid },
    { label: 'コヨーテ!', move: 0, cls: 'danger', enabled: !!(b.canCoyote && A.legal.has(0)) },
  ]);
}
window.RENDER = window.RENDER || {};
window.RENDER.coyote = renderCoyote;

// ================================================================ スカル
const ROSE = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 78c-8 2-14-2-16-8 6-4 14-4 19 1 6-3 10-1 13 2-4 5-10 7-16 5Z" fill="#2E7D46"/><path d="M78 78c8 2 14-2 16-8-6-4-14-4-19 1-6-3-10-1-13 2 4 5 10 7 16 5Z" fill="#2E7D46"/><path d="M50 14c17 0 29 12 29 27S67 68 50 68 21 56 21 41s12-27 29-27Z" fill="#B3242F"/><path d="M50 14c6 8 5 15-1 20 8 1 13 6 15 13 7-3 10-9 10-16" fill="none" stroke="#8E1B26" stroke-width="3" stroke-linecap="round"/><path d="M50 24c11 0 19 7 19 16s-8 16-19 16-19-7-19-16 8-16 19-16Z" fill="#D93A4B"/><path d="M50 32c7 0 12 4 12 9s-5 9-12 9-12-4-12-9 5-9 12-9Z" fill="#EE7080"/><path d="M50 38c3.4 0 6 2 6 4.4S53.4 47 50 47s-6-2-6-4.6S46.6 38 50 38Z" fill="#F7A8B5"/></svg>`;
const ROSE_GOLD = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 14c17 0 29 12 29 27S67 68 50 68 21 56 21 41s12-27 29-27Z" fill="none" stroke="#C9A227" stroke-width="4"/><path d="M50 28c9 0 15 6 15 13s-6 13-15 13-15-6-15-13 6-13 15-13Z" fill="none" stroke="#C9A227" stroke-width="4"/><circle cx="50" cy="41" r="4.5" fill="#C9A227"/></svg>`;
const SKULLF = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8c21 0 34 15 34 35 0 12-5 19-12 24v13c0 4-3 6-6 6H34c-3 0-6-2-6-6V67C21 62 16 55 16 43 16 23 29 8 50 8Z" fill="#F2EDE2" stroke="#B9B0A0" stroke-width="2"/><ellipse cx="36" cy="46" rx="8" ry="10" fill="#241E18"/><ellipse cx="64" cy="46" rx="8" ry="10" fill="#241E18"/><path d="M50 56l5 10H45Z" fill="#241E18"/><path d="M38 78v10M50 80v10M62 78v10" stroke="#B9B0A0" stroke-width="3"/></svg>`;
const skCard = (card, d, cls = '', key = '') => {
  // card: 0=花 1=ドクロ null=裏向き
  const inner = card === 0 ? ROSE : card === 1 ? SKULLF : `<span class="sk-back-art">${ROSE_GOLD}</span>`;
  return `<span class="sk-card ${card === null ? 'back' : card === 1 ? 'skull' : 'flower'} ${cls}" style="--cd:${d}px"${key ? ` data-piece="${key}"` : ''}>${inner}</span>`;
};
// ---- スカル(見本の暗い盤面と円形マットで描く) ----
const skRoseArt = (mode) => {
  const pa = mode === 'red'
    ? (inner) => `fill="${inner ? '#d43d4d' : '#a31621'}" stroke="#e8b64c" stroke-width="${inner ? 1.1 : 1.6}" stroke-linejoin="round"`
    : (inner) => `fill="none" stroke="#d4af37" stroke-width="${inner ? 2.1 : 2.6}" stroke-linejoin="round"`;
  const outer = [0, 72, 144, 216, 288].map((r) => `<path d="M50 6 C64 20 65 35 50 46 C35 35 36 20 50 6 Z" transform="rotate(${r} 50 50)" ${pa(false)}/>`).join('');
  const inner = [36, 108, 180, 252, 324].map((r) => `<path d="M50 25 C58.5 33 59 42 50 48 C41 42 41.5 33 50 25 Z" transform="rotate(${r} 50 50)" ${pa(true)}/>`).join('');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47.5" fill="none" stroke="${mode === 'red' ? '#e8b64c' : '#d4af37'}" stroke-width="1.5" opacity=".85"/>${outer}${inner}<circle cx="50" cy="49.5" r="4.6" fill="${mode === 'red' ? '#e8b64c' : '#d4af37'}"/></svg>`;
};
const sk2Card = (face, d, cls = '', key = '') => {
  const inner = face === 0 ? skRoseArt('red') : face === 1 ? SKULLF : face === null ? skRoseArt('line') : '';
  const kind = face === null ? 'back' : face === 1 ? 'skull' : face === 0 ? 'flower' : 'empty';
  return `<span class="sk2-card ${kind} ${cls}" style="width:${d}px;height:${d}px"${key ? ` data-piece="${key}"` : ''}>${inner}</span>`;
};
function renderSkull(b, A) {
  if (isMob()) return skMobileRender(b, A);
  prep(A);
  const me = Math.max(0, b.me);
  const placing = b.phase === 'initial_place' || b.phase === 'play_or_bid';
  const minBid = b.phase === 'bidding' ? b.currentBid + 1 : 1;
  const selOk = A.sel && A.sel.kind === 'skull' && A.sel.moves === A.view.moves;
  const bid = clamp(selOk ? A.sel.bid : minBid, minBid, Math.max(minBid, b.totalPlaced));
  strip(A, b, (i) => !b.alive[i] ? '脱落' : `${b.points[i]} 点 ・ 持ち札 ${b.totalCards[i]} 枚`);
  A.round(`ラウンド ${b.roundNo}`);
  let side = `<div class="kv"><span>場の札</span><b class="num">${b.totalPlaced} 枚</b></div>`;
  if (b.currentBid > 0) side += `<div class="kv"><span>宣言</span><b class="num">${b.currentBid} 枚</b></div>`;
  if (b.phase === 'reveal' || b.phase === 'discard_own') side += `<div class="kv"><span>めくった数</span><b class="num">${b.revealedCount} 枚</b></div>`;
  side += `<div class="kv"><span>目標</span><b class="num">${b.targetPoints} 点</b></div>`;
  A.side(side);
  const slots = {
    2: [[222, 140], [678, 140]],
    3: [[124, 258], [450, 96], [776, 258]],
    4: [[140, 318], [238, 118], [662, 118], [760, 318]],
    5: [[136, 330], [182, 124], [450, 100], [718, 124], [764, 330]],
  };
  const matD = { 2: 176, 3: 168, 4: 158, 5: 148 };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  const stackHtml = (seat, mine, interactive) => {
    const st = b.stacks[seat] || [];
    if (!st.length) return `<span class="sk2-stack">${sk2Card(undefined, mine ? 64 : 60, 'empty')}</span>`;
    const len = st.length;
    const d = mine ? (len === 1 ? 92 : len === 2 ? 84 : len === 3 ? 68 : 58) : (len === 1 ? 72 : len === 2 ? 64 : len === 3 ? 56 : 50);
    const step = mine ? (len === 2 ? 56 : len === 3 ? 44 : len >= 4 ? 38 : 0) : (len === 2 ? 40 : len === 3 ? 30 : len >= 4 ? 24 : 0);
    const cards = st.map((c, j) => {
      const face = c.revealed ? c.card : (c.hidden ? null : c.card);
      const known = seat === b.me && !c.revealed && !c.hidden;
      const cls = `${j === len - 1 && interactive ? 'next' : ''}${known ? ' known' : ''}`;
      return `<span class="sk2-stackcard" style="left:${j * step}px;z-index:${j}">${sk2Card(face, d, cls, `sk-${seat}-${j}`)}</span>`;
    }).join('');
    const inner = `<span class="sk2-stack" style="width:${d + step * (len - 1)}px;height:${d}px">${cards}</span>`;
    return interactive ? moveBtn(A, 200 + seat, inner, `${A.name(seat)} の山をめくる`, 'sk2-stack-btn') : inner;
  };
  const seatHtml = (seat, x, y, D, mine) => {
    const canReveal = b.phase === 'reveal' && A.legal.has(200 + seat);
    const coins = b.points[seat] > 0 ? `<span class="sk2-coins">${Array.from({ length: b.points[seat] }, () => `<span class="sk2-coin">${skRoseArt('line')}</span>`).join('')}</span>` : '';
    const pass = b.passed[seat] && b.phase === 'bidding' ? '<span class="sk2-pass">パス</span>' : '';
    const mat = `<div class="sk2-mat${b.alive[seat] ? '' : ' dead'}${b.challenger === seat && b.currentBid > 0 ? ' turn' : ''}" style="width:${D}px;height:${D}px">${pass}${coins}<div class="sk2-cards">${stackHtml(seat, mine, canReveal)}</div></div>`;
    return at(x, y, mat) + at(x, y + D / 2 + 16, `<span class="sk2-name">${esc(A.name(seat))}</span>`);
  };
  let html = `<div class="sk2-bg"></div>` + at(450, 254, `<div class="sk2-emblem">${skRoseArt('line')}</div>`);
  opps.forEach((seat, idx) => { const [x, y] = slotList[idx]; html += seatHtml(seat, x, y, matD[opps.length] || 168, false); });
  if (b.currentBid > 0) {
    let pips = '';
    if (b.phase === 'reveal' || b.phase === 'discard_own') {
      pips = `<div class="sk2-prog">${Array.from({ length: b.currentBid }, (_, i) => `<span class="sk2-pip${i < b.revealedCount ? ' on' : ''}">${i < b.revealedCount ? skRoseArt('red') : ''}</span>`).join('')}</div>`;
    }
    html += at(450, 254, `<div class="sk2-plate"><div class="sk2-bidnum">${b.currentBid}<span>枚</span></div>${pips}</div>`);
  }
  html += seatHtml(b.me, 450, 418, 224, true);
  if (b.me >= 0 && b.myHand) {
    const hand = [];
    for (let i = 0; i < b.myHand.flowers; i++) hand.push(0);
    for (let i = 0; i < b.myHand.skulls; i++) hand.push(1);
    if (hand.length) {
      const w = 57 + (hand.length - 1) * 40;
      const minis = hand.map((c, hi) => {
        const rot = hand.length === 1 ? 0 : (hi / (hand.length - 1) - .5) * 28;
        const mini = `<span class="sk2-mini ${c === 0 ? 'flower' : 'skull'}" style="transform:rotate(${rot.toFixed(0)}deg)">${c === 0 ? skRoseArt('red') : SKULLF}</span>`;
        return placing && A.view.toMove === b.me ? moveBtn(A, c === 0 ? 100 : 101, mini, c === 0 ? '花を置く' : 'ドクロを置く', 'sk2-fan-btn') : mini;
      }).join('');
      html += at(30 + w / 2, 514, `<div class="sk2-fan">${minis}</div>`);
    }
  }
  if (b.mustRevealOwn && b.phase === 'reveal' && A.view.toMove === b.me) html += at(450, 268, note('まず自分の山からめくります'));
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const seq = (lr.revealedSeq || []).map((r) => sk2Card(r.card, 42)).join('');
    const lost = lr.lostCard == null ? '' : `、${esc(A.name(lr.challenger))} は${lr.lostCard === 1 ? 'ドクロ' : '花'}を1枚失いました${lr.eliminated ? '(脱落)' : ''}`;
    html += `<div class="cy-reveal"><div class="cy-rev-cards">${seq}</div>` +
      `<div class="cy-rev-result">${lr.success
        ? `<b>${esc(A.name(lr.challenger))}</b> チャレンジ成功! +1点`
        : `<b>${esc(A.name(lr.skullOwner))}</b> のドクロ! 宣言 ${lr.bid} 枚は失敗${lost}`}</div></div>`;
    A.anim(1750);
    A.sfx(lr.success ? 'TAKE' : 'CARD_FLIP', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lr = lr ? lr.roundNo : ninePrev.lr;
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  const acts = [];
  if ((b.phase === 'play_or_bid' || b.phase === 'bidding') && b.totalPlaced > 0) {
    const setBid = (v) => { A.sel = { kind: 'skull', moves: A.view.moves, bid: clamp(v, minBid, b.totalPlaced) }; A.redraw(); };
    acts.push({ label: '−', fn: () => setBid(bid - 1), enabled: A.canPlay && bid > minBid });
    acts.push({ label: `${bid} 枚で宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) });
    acts.push({ label: '＋', fn: () => setBid(bid + 1), enabled: A.canPlay && bid < b.totalPlaced });
    acts.push({ label: 'パス', move: 0, enabled: b.phase === 'bidding' && A.legal.has(0) });
  }
  if (b.phase === 'discard_own') {
    acts.push({ label: '花を捨てる', move: 300, cls: 'gold', enabled: A.legal.has(300) });
    acts.push({ label: 'ドクロを捨てる', move: 301, cls: 'danger', enabled: A.legal.has(301) });
  }
  A.acts(acts);
}
function skMobileRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  const placing = b.phase === 'initial_place' || b.phase === 'play_or_bid';
  const minBid = b.phase === 'bidding' ? b.currentBid + 1 : 1;
  const selOk = A.sel && A.sel.kind === 'skull' && A.sel.moves === A.view.moves;
  const bid = clamp(selOk ? A.sel.bid : minBid, minBid, Math.max(minBid, b.totalPlaced));
  strip(A, b, (i) => !b.alive[i] ? '脱落' : `${b.points[i]} 点 ・ 持ち札 ${b.totalCards[i]} 枚`);
  A.round(`ラウンド ${b.roundNo}`);
  let side = `<div class="kv"><span>場の札</span><b class="num">${b.totalPlaced} 枚</b></div>`;
  if (b.currentBid > 0) side += `<div class="kv"><span>宣言</span><b class="num">${b.currentBid} 枚</b></div>`;
  if (b.phase === 'reveal' || b.phase === 'discard_own') side += `<div class="kv"><span>めくった数</span><b class="num">${b.revealedCount} 枚</b></div>`;
  side += `<div class="kv"><span>目標</span><b class="num">${b.targetPoints} 点</b></div>`;
  A.side(side);
  const slots = {
    1: [[280, 140]],
    2: [[138, 140], [422, 140]],
    3: [[96, 142], [280, 122], [464, 142]],
    4: [[78, 128], [202, 114], [358, 114], [482, 128]],
    5: [[96, 112], [280, 100], [464, 112], [150, 272], [410, 272]],
  };
  const matD = { 1: 176, 2: 164, 3: 148, 4: 132, 5: 130 };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  const stackHtml = (seat, mine, interactive) => {
    const st = b.stacks[seat] || [];
    if (!st.length) return `<span class="sk2-stack">${sk2Card(undefined, mine ? 64 : 60, 'empty')}</span>`;
    const len = st.length;
    const d = mine ? (len === 1 ? 92 : len === 2 ? 84 : len === 3 ? 68 : 58) : (len === 1 ? 72 : len === 2 ? 64 : len === 3 ? 56 : 50);
    const step = mine ? (len === 2 ? 56 : len === 3 ? 44 : len >= 4 ? 38 : 0) : (len === 2 ? 40 : len === 3 ? 30 : len >= 4 ? 24 : 0);
    const cards = st.map((c, j) => {
      const face = c.revealed ? c.card : (c.hidden ? null : c.card);
      const known = seat === b.me && !c.revealed && !c.hidden;
      const cls = `${j === len - 1 && interactive ? 'next' : ''}${known ? ' known' : ''}`;
      return `<span class="sk2-stackcard" style="left:${j * step}px;z-index:${j}">${sk2Card(face, d, cls, `sk-${seat}-${j}`)}</span>`;
    }).join('');
    const inner = `<span class="sk2-stack" style="width:${d + step * (len - 1)}px;height:${d}px">${cards}</span>`;
    return interactive ? moveBtn(A, 200 + seat, inner, `${A.name(seat)} の山をめくる`, 'sk2-stack-btn') : inner;
  };
  const seatHtml = (seat, x, y, D, mine) => {
    const canReveal = b.phase === 'reveal' && A.legal.has(200 + seat);
    const coins = b.points[seat] > 0 ? `<span class="sk2-coins">${Array.from({ length: b.points[seat] }, () => `<span class="sk2-coin">${skRoseArt('line')}</span>`).join('')}</span>` : '';
    const pass = b.passed[seat] && b.phase === 'bidding' ? '<span class="sk2-pass">パス</span>' : '';
    const mat = `<div class="sk2-mat${b.alive[seat] ? '' : ' dead'}${b.challenger === seat && b.currentBid > 0 ? ' turn' : ''}" style="width:${D}px;height:${D}px">${pass}${coins}<div class="sk2-cards">${stackHtml(seat, mine, canReveal)}</div></div>`;
    return at(x, y, mat) + at(x, y + D / 2 + 16, `<span class="sk2-name">${esc(A.name(seat))}</span>`);
  };
  const many = opps.length >= 5;
  const plateY = many ? 478 : 448, myY = many ? 692 : 668, myD = many ? 216 : 238;
  let html = `<div class="sk2-bg"></div>` + at(280, plateY, `<div class="sk2-emblem">${skRoseArt('line')}</div>`);
  opps.forEach((seat, idx) => { const [x, y] = slotList[idx]; html += seatHtml(seat, x, y, matD[opps.length] || 148, false); });
  if (b.currentBid > 0) {
    let pips = '';
    if (b.phase === 'reveal' || b.phase === 'discard_own') {
      pips = `<div class="sk2-prog">${Array.from({ length: b.currentBid }, (_, i) => `<span class="sk2-pip${i < b.revealedCount ? ' on' : ''}">${i < b.revealedCount ? skRoseArt('red') : ''}</span>`).join('')}</div>`;
    }
    html += at(280, plateY, `<div class="sk2-plate"><div class="sk2-bidnum">${b.currentBid}<span>枚</span></div>${pips}</div>`);
  }
  html += seatHtml(b.me, 280, myY, myD, true);
  if (b.me >= 0 && b.myHand) {
    const hand = [];
    for (let i = 0; i < b.myHand.flowers; i++) hand.push(0);
    for (let i = 0; i < b.myHand.skulls; i++) hand.push(1);
    if (hand.length) {
      const minis = hand.map((c, hi) => {
        const rot = hand.length === 1 ? 0 : (hi / (hand.length - 1) - .5) * 28;
        const mini = `<span class="sk2-mini ${c === 0 ? 'flower' : 'skull'}" style="transform:rotate(${rot.toFixed(0)}deg)">${c === 0 ? skRoseArt('red') : SKULLF}</span>`;
        return placing && A.view.toMove === b.me ? moveBtn(A, c === 0 ? 100 : 101, mini, c === 0 ? '花を置く' : 'ドクロを置く', 'sk2-fan-btn') : mini;
      }).join('');
      html += at(280, 842, `<div class="sk2-fan">${minis}</div>`);
    }
  }
  if (b.mustRevealOwn && b.phase === 'reveal' && A.view.toMove === b.me) html += at(280, plateY + 14, note('まず自分の山からめくります'));
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const seq = (lr.revealedSeq || []).map((r) => sk2Card(r.card, 42)).join('');
    const lost = lr.lostCard == null ? '' : `、${esc(A.name(lr.challenger))} は${lr.lostCard === 1 ? 'ドクロ' : '花'}を1枚失いました${lr.eliminated ? '(脱落)' : ''}`;
    html += `<div class="cy-reveal"><div class="cy-rev-cards">${seq}</div>` +
      `<div class="cy-rev-result">${lr.success
        ? `<b>${esc(A.name(lr.challenger))}</b> チャレンジ成功! +1点`
        : `<b>${esc(A.name(lr.skullOwner))}</b> のドクロ! 宣言 ${lr.bid} 枚は失敗${lost}`}</div></div>`;
    A.anim(1750);
    A.sfx(lr.success ? 'TAKE' : 'CARD_FLIP', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lr = lr ? lr.roundNo : ninePrev.lr;
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  const acts = [];
  if ((b.phase === 'play_or_bid' || b.phase === 'bidding') && b.totalPlaced > 0) {
    const setBid = (v) => { A.sel = { kind: 'skull', moves: A.view.moves, bid: clamp(v, minBid, b.totalPlaced) }; A.redraw(); };
    acts.push({ label: '−', fn: () => setBid(bid - 1), enabled: A.canPlay && bid > minBid });
    acts.push({ label: `${bid} 枚で宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) });
    acts.push({ label: '＋', fn: () => setBid(bid + 1), enabled: A.canPlay && bid < b.totalPlaced });
    acts.push({ label: 'パス', move: 0, enabled: b.phase === 'bidding' && A.legal.has(0) });
  }
  if (b.phase === 'discard_own') {
    acts.push({ label: '花を捨てる', move: 300, cls: 'gold', enabled: A.legal.has(300) });
    acts.push({ label: 'ドクロを捨てる', move: 301, cls: 'danger', enabled: A.legal.has(301) });
  }
  A.acts(acts);
}
function skLegacyRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  const placing = b.phase === 'initial_place' || b.phase === 'play_or_bid';
  const minBid = b.phase === 'bidding' ? b.currentBid + 1 : 1;
  const selOk = A.sel && A.sel.kind === 'skull' && A.sel.moves === A.view.moves;
  const bid = clamp(selOk ? A.sel.bid : minBid, minBid, Math.max(minBid, b.totalPlaced));
  strip(A, b, (i) => !b.alive[i] ? '脱落' : `${b.points[i]} 点 ・ 持ち札 ${b.totalCards[i]} 枚`);
  A.round(`ラウンド ${b.roundNo}`);
  A.side(`<div class="kv"><span>場の札</span><b class="num">${b.totalPlaced} 枚</b></div><div class="kv"><span>目標</span><b class="num">${b.targetPoints} 点</b></div>`);
  const mob = isMob();
  const slots = mob
    ? { 2: [[105, 150], [455, 150]], 3: [[92, 168], [280, 128], [468, 168]], 4: [[80, 320], [115, 138], [445, 138], [480, 320]], 5: [[76, 350], [100, 140], [280, 112], [460, 140], [484, 350]] }
    : { 2: [[215, 128], [685, 128]], 3: [[148, 238], [450, 116], [752, 238]], 4: [[138, 312], [232, 122], [668, 122], [762, 312]], 5: [[132, 332], [178, 132], [450, 106], [722, 132], [768, 332]] };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  const stackHtml = (seat, d, interactive) => {
    const st = b.stacks[seat] || [];
    const cards = st.map((c, j) => {
      const top = j === st.length - 1;
      const face = c.revealed ? c.card : (c.hidden ? null : c.card);
      const cls = `${top ? 'top' : 'under'}${c.revealed ? ' rev' : ''}${seat === b.me && !c.revealed && !c.hidden ? ' mine-known' : ''}`;
      return `<span class="sk-stack-card" style="--j:${j}">${skCard(face, d, cls, `sk-${seat}-${j}`)}</span>`;
    }).join('');
    const empty = `<span class="sk-stack-card" style="--j:0">${skCard(null, d, 'empty')}</span>`;
    const inner = `<span class="sk-stack">${st.length ? cards : empty}</span>`;
    const mv = 200 + seat;
    return interactive ? moveBtn(A, mv, inner, `${A.name(seat)} の山をめくる`, 'sk-stack-btn') : inner;
  };
  let html = `<div class="nine-table sk-table"></div>`;
  opps.forEach((seat, idx) => {
    const [x, y] = slotList[idx];
    const canReveal = b.phase === 'reveal' && A.legal.has(200 + seat);
    html += at(x, y, `<div class="sk-mat${b.alive[seat] ? '' : ' dead'}${b.challenger === seat ? ' challenger' : ''}">${stackHtml(seat, mob ? 54 : 58, canReveal)}</div>`);
    html += at(x, y + (mob ? 56 : 60), seatChip(A, b, seat, `<em class="sk-pts"><span class="sk-dots">${'●'.repeat(b.points[seat])}</span><span class="sk-pass">${b.passed[seat] && b.phase === 'bidding' ? 'パス' : ''}</span></em>`));
  });
  // 中央: 宣言プレートと進行
  const cx = mob ? 280 : 450, cy = mob ? 415 : 272;
  let plate = '';
  if (b.phase === 'reveal' || b.phase === 'discard_own') {
    const flowers = Array.from({ length: b.currentBid }, (_, i) => `<span class="sk-prog ${i < b.revealedCount ? 'lit' : ''}">${ROSE}</span>`).join('');
    plate = `<div class="cy-plate sk-plate"><b>${b.currentBid} 枚</b><span>${esc(A.name(b.challenger))} がめくっています</span><span class="sk-progs">${flowers}</span></div>`;
  } else if (b.currentBid > 0) {
    plate = `<div class="cy-plate sk-plate"><b>${b.currentBid} 枚</b><span>${esc(A.name(b.challenger))} の宣言</span></div>`;
  } else {
    plate = `<div class="sk-emblem">${ROSE}</div>`;
  }
  html += at(cx, cy, plate);
  // 自分: 大きなマット+手札
  const myY = mob ? 640 : 428;
  const myCanReveal = b.phase === 'reveal' && A.legal.has(200 + b.me);
  html += at(cx, myY - 8, `<div class="sk-mat mine${b.challenger === b.me ? ' challenger' : ''}">${stackHtml(b.me, mob ? 84 : 88, myCanReveal)}</div>`);
  html += at(cx, myY + (mob ? 66 : 68), seatChip(A, b, me, `<em class="sk-pts"><span class="sk-dots">${'●'.repeat(b.points[b.me])}</span><span class="sk-pass"></span></em>`));
  if (b.me >= 0 && b.myHand) {
    const hand = [];
    for (let i = 0; i < b.myHand.flowers; i++) hand.push(0);
    for (let i = 0; i < b.myHand.skulls; i++) hand.push(1);
    const hx = mob ? 128 : 172, hy = mob ? 792 : 492;
    html += at(hx, hy, `<div class="sk-hand">${hand.map((c) => placing && A.view.toMove === b.me
      ? moveBtn(A, c === 0 ? 100 : 101, skCard(c, mob ? 52 : 56), c === 0 ? '花を置く' : 'ドクロを置く', 'sk-hand-btn')
      : skCard(c, mob ? 52 : 56)).join('')}</div>`);
    html += at(hx, hy - (mob ? 52 : 56), note('あなたの手札'));
  }
  if (b.mustRevealOwn && b.phase === 'reveal' && A.view.toMove === b.me) html += at(cx, myY - (mob ? 92 : 96), note('まず自分の山からめくります'));
  // 直前ラウンドの結果演出
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const seq = (lr.revealedSeq || []).map((r) => skCard(r.card, mob ? 36 : 42)).join('');
    const lost = lr.lostCard == null ? '' : `、${esc(A.name(lr.challenger))} は${lr.lostCard === 1 ? 'ドクロ' : '花'}を1枚失いました${lr.eliminated ? '(脱落)' : ''}`;
    html += `<div class="cy-reveal"><div class="cy-rev-cards">${seq}</div>` +
      `<div class="cy-rev-result">${lr.success
        ? `<b>${esc(A.name(lr.challenger))}</b> チャレンジ成功! +1点`
        : `<b>${esc(A.name(lr.skullOwner))}</b> のドクロ! 宣言 ${lr.bid} 枚は失敗${lost}`}</div></div>`;
    A.anim(1750);
    A.sfx(lr.success ? 'TAKE' : 'CARD_FLIP', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lr = lr ? lr.roundNo : ninePrev.lr;
  // 操作ボタン
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  const acts = [];
  if ((b.phase === 'play_or_bid' || b.phase === 'bidding') && b.totalPlaced > 0) {
    const setBid = (v) => { A.sel = { kind: 'skull', moves: A.view.moves, bid: clamp(v, minBid, b.totalPlaced) }; A.redraw(); };
    acts.push({ label: '−', fn: () => setBid(bid - 1), enabled: A.canPlay && bid > minBid });
    acts.push({ label: `${bid} 枚で宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) });
    acts.push({ label: '＋', fn: () => setBid(bid + 1), enabled: A.canPlay && bid < b.totalPlaced });
    acts.push({ label: 'パス', move: 0, enabled: b.phase === 'bidding' && A.legal.has(0) });
  }
  if (b.phase === 'discard_own') {
    acts.push({ label: '花を捨てる', move: 300, cls: 'gold', enabled: A.legal.has(300) });
    acts.push({ label: 'ドクロを捨てる', move: 301, cls: 'danger', enabled: A.legal.has(301) });
  }
  A.acts(acts);
}
window.RENDER.skull = renderSkull;

// ================================================================ ライアーズダイス
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const dieFace = (v, size, cls = '') => {
  const pips = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('');
  return `<span class="die ${v === 1 ? 'one' : ''} ${cls}" style="--ds:${size}px" data-die="${v}">${pips}</span>`;
};
// ---- ライアーズダイス(木のテーブル。上に相手、真ん中に自分のダイス、下に次の宣言。見本: docs/mockups/liarsdice-v2/)
const LD_PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
// サイコロ(真上から。象牙色・1 の目は赤)。o: { rot, ring(金の枠), dim(暗く), shadow }
const ldDie = (v, s, o = {}) => {
  const r = s * 0.16;
  const pips = LD_PIPS[v].map(([x, y]) => `<circle cx="${(x * s).toFixed(1)}" cy="${(y * s).toFixed(1)}" r="${(v === 1 ? s * .12 : s * .085).toFixed(1)}" fill="${v === 1 ? '#c22a22' : '#2b2119'}"/>`).join('');
  return `<svg class="ld3-die" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="overflow:visible;transform:rotate(${o.rot || 0}deg)${o.dim ? ';opacity:.42' : ''}" data-die="${v}">` +
    (o.shadow === false ? '' : `<rect x="${s * .06}" y="${s * .1}" width="${s}" height="${s}" rx="${r}" fill="#000" opacity=".35"/>`) +
    `<rect width="${s}" height="${s}" rx="${r}" fill="#fbf5e6"/><rect width="${s}" height="${s}" rx="${r}" fill="none" stroke="#c9b893" stroke-width="${Math.max(1, s * .035).toFixed(1)}"/>` +
    `<rect x="${s * .08}" y="${s * .06}" width="${s * .84}" height="${s * .4}" rx="${r * .6}" fill="#fff" opacity=".45"/>${pips}` +
    (o.ring ? `<rect x="${-s * .1}" y="${-s * .1}" width="${s * 1.2}" height="${s * 1.2}" rx="${r * 1.4}" fill="none" stroke="#f3c95a" stroke-width="${(s * .07).toFixed(1)}"/>` : '') + `</svg>`;
};
// 伏せた革のカップ(少し斜め上から)
const LD_CUPS = ['#6b4123', '#3f4d5e', '#6a2d2a', '#4d5a33', '#5a3f63', '#6b5a2a'];
const ldCup = (w, tone) => `<svg width="${w}" height="${(w * 1.05).toFixed(1)}" viewBox="0 0 100 105" style="overflow:visible" aria-hidden="true">
  <ellipse cx="50" cy="98" rx="42" ry="7" fill="#000" opacity=".45"/>
  <path d="M14 92 L22 18 Q24 8 36 7 L64 7 Q76 8 78 18 L86 92 Q86 99 76 99 L24 99 Q14 99 14 92Z" fill="${tone}"/>
  <path d="M14 92 L22 18 Q24 8 36 7 L48 7 L44 99 L24 99 Q14 99 14 92Z" fill="#fff" opacity=".07"/>
  <path d="M66 7 Q76 8 78 18 L86 92 Q86 99 76 99 L64 99Z" fill="#000" opacity=".22"/>
  <path d="M15.5 80 L84.5 80" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
  <path d="M17 84 L83 84" stroke="#e7c98d" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 3"/>
  <path d="M22.5 22 L77.5 22" stroke="#e7c98d" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 3"/>
  <ellipse cx="50" cy="9" rx="20" ry="3" fill="#fff" opacity=".12"/></svg>`;
const ldSlots = (n, cls = 'ld3-slots') => `<span class="${cls}">${Array.from({ length: 5 }, (_, k) => `<i class="${k < n ? '' : 'lost'}"></i>`).join('')}</span>`;
let ldRevealTimer = 0;
function renderLiarsdice(b, A) {
  prep(A);
  const mob = isMob();
  const me = Math.max(0, b.me);
  const legalBids = [...new Set(A.view.legal || [])].filter((m) => m >= 100);
  const minBidMove = legalBids.length ? Math.min(...legalBids) : 0;
  const selOk = A.sel && A.sel.kind === 'liarsdice' && A.sel.moves === A.view.moves;
  let qty, face;
  if (legalBids.length) {
    qty = selOk ? A.sel.qty : Math.floor((minBidMove - 100) / 10);
    face = selOk ? A.sel.face : (minBidMove - 100) % 10;
    if (!A.legal.has(100 + qty * 10 + face)) {
      const sameFace = legalBids.filter((m) => (m - 100) % 10 === face);
      if (sameFace.length) qty = Math.floor((Math.min(...sameFace) - 100) / 10);
      else { qty = Math.floor((minBidMove - 100) / 10); face = (minBidMove - 100) % 10; }
    }
  } else {
    // 自分の番でない時も欄の形を変えないよう、今の宣言の「次」を薄く出しておく
    face = b.currentBid ? b.currentBid.face : 2;
    qty = b.currentBid ? b.currentBid.qty + 1 : 1;
  }
  // 側板: 全員同じ形(「ダイス」+残りの数の四角 5 つ)
  A.strip(A.view.seats.map((s, i) => `<div class="pl${A.view.toMove === i && !A.view.outcome ? ' turn' : ''}">${avFor(A, b, i)}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${b.alive[i] ? `ダイス${ldSlots(b.diceCounts[i], 'ld3-sslots')}` : '脱落'}</span></span></div>`).join(''));
  A.round(`ラウンド ${b.roundNo}`);
  const sd = (v) => `<span class="ld3-sdie">${ldDie(v, 18, { shadow: false })}</span>`;
  const hist = (b.bidHistory || []).slice(-6).map((h, i, arr) => `<div class="${i === arr.length - 1 ? 'now' : ''}"><span>${esc(A.name(h.seat))}</span>${sd(h.face)}<b>× ${h.qty}</b></div>`).join('');
  A.side(`<div class="ld3-side"><div class="kv"><span>場のダイス</span><b class="num">${b.totalDice} 個</b></div><div class="kv"><span>1 の目</span><b>${b.wildOnes ? 'ワイルド' : '通常'}</b></div>${hist && !mob ? `<h4>このラウンドの宣言</h4><div class="hist">${hist}</div>` : ''}</div>`);
  // 直前のラウンドの公開(ダウト/ジャストの直後だけ、約 4 秒)
  const lr = b.lastRound;
  const revealing = !!(lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce);
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  // 相手の席(上に横一列。スマホで 4 人以上は 2 段)
  const pos = (i, k) => {
    if (!mob) { const sp = Math.min(280, 820 / k); return [450 + (i - (k - 1) / 2) * sp, 22]; }
    if (k <= 3) { const sp = Math.min(180, 520 / k); return [280 + (i - (k - 1) / 2) * sp, 16]; }
    const top = Math.ceil(k / 2), row = i < top ? 0 : 1, j = row ? i - top : i, n2 = row ? k - top : top;
    return [280 + (j - (n2 - 1) / 2) * 170, row ? 150 : 12];
  };
  const match = (v, bid) => bid && (v === bid.face || (b.wildOnes && v === 1 && bid.face !== 1));
  let html = `<div class="ld3-wood${mob ? ' mob' : ''}"></div>`;
  const cupW = mob ? (opps.length >= 4 ? 64 : 96) : 92;
  opps.forEach((seat, i) => {
    const [x, y] = pos(i, opps.length);
    let body;
    if (revealing && lr.allDice[seat] && lr.allDice[seat].length) {
      const ds = mob ? (opps.length >= 3 ? 27 : 32) : 34;
      body = `<div class="ld3-shown" style="height:${(cupW * 1.05).toFixed(0)}px${mob ? ';gap:3px' : ''}">${lr.allDice[seat].map((v, j) => ldDie(v, ds, { rot: [-6, 4, -3, 7, -2][j % 5], ring: match(v, lr.bid), dim: !match(v, lr.bid) })).join('')}</div>`;
    } else body = `<div class="ld3-cup">${ldCup(cupW, LD_CUPS[seat % LD_CUPS.length])}</div>`;
    const turn = !revealing && seat === b.turn && !b.done;
    html += `<div class="ld2-seat${b.alive[seat] ? '' : ' out'}${turn ? ' turn' : ''}" style="left:${x.toFixed(0)}px;top:${y}px" data-public-seat="${seat}">${body}${ldSlots(b.diceCounts[seat])}<div class="ld3-nm">${esc(A.name(seat))}</div></div>`;
    // 今の宣言は、言った人のカップの横に吹き出しで
    if (!revealing && b.currentBid && b.lastBidder === seat) {
      const right = x > (mob ? 380 : 640);
      html += `<div class="ld3-bubble ${right ? 'r' : 'l'}" style="${right ? `right:${((mob ? 560 : 900) - x + cupW / 2 + 12).toFixed(0)}px` : `left:${(x + cupW / 2 + 12).toFixed(0)}px`};top:${y + cupW * .28}px">${ldDie(b.currentBid.face, mob ? 30 : 34, { shadow: false })}<span class="x">×</span><span class="q">${b.currentBid.qty}</span><span class="u">個</span></div>`;
    }
  });
  // 自分: 革の受け皿に 5 個。開けたカップは左に倒しておく
  const T = mob ? { x: 280, y: opps.length >= 4 ? 370 : 330, w: 480, d: 70 } : { x: 450, y: 322, w: 440, d: 62 };
  const myDice = revealing ? (lr.allDice[me] || []) : (b.myDice || []);
  const bidNow = revealing ? lr.bid : b.currentBid;
  html += `<div class="ld3-tray" style="left:${T.x - T.w / 2}px;top:${T.y - 56}px;width:${T.w}px"></div>`;
  if (!mob) html += `<div class="ld3-mycup" style="left:${T.x - T.w / 2 - 96}px;top:${T.y - 36}px">${ldCup(66, LD_CUPS[me % LD_CUPS.length])}</div>`;
  const newRound = !revealing && ninePrev && ninePrev.handle === A.handle && ninePrev.round !== b.roundNo && !A.reduce;
  html += `<div class="ld2-myseat${newRound ? ' roll' : ''}" style="left:${T.x}px;top:${T.y}px">${myDice.map((v, k) => ldDie(v, T.d, { rot: [-5, 3, -2, 4, -3][k % 5], ring: !revealing && match(v, bidNow), dim: revealing && !match(v, bidNow) })).join('')}</div>`;
  if (!revealing && b.currentBid && b.lastBidder === me) html += `<div class="ld3-bubble b" style="left:${T.x - T.w / 2 + 10}px;top:${T.y - (mob ? 126 : 128)}px">${ldDie(b.currentBid.face, mob ? 30 : 34, { shadow: false })}<span class="x">×</span><span class="q">${b.currentBid.qty}</span><span class="u">個</span></div>`;
  if (newRound) A.sfx('DICE', 30);
  if (revealing) {
    const who = esc(A.name(lr.caller)), act = lr.action === 'exact' ? 'ジャスト' : 'ダウト';
    html += `<div class="ld3-count${mob ? ' mob' : ''}" style="left:${T.x}px;top:${mob ? T.y - 100 : 212}px"><span class="ld3-verdict">${who} の${act}</span><div class="big">${ldDie(lr.bid.face, 40, { shadow: false })}<span class="x">×</span>${lr.actualCount}</div><span class="small">宣言は ${lr.bid.qty} 個</span></div>`;
    A.cut({ who: { name: A.name(lr.caller) }, text: `${act}!`, tone: 'red', font: 'mo', ms: 1700 });
    A.anim(4200);
    A.sfx('CARD_FLIP', 60);
    const mv = A.view.moves, hd = A.handle;
    clearTimeout(ldRevealTimer);
    ldRevealTimer = setTimeout(() => { if (A.view && A.view.moves === mv && A.handle === hd && document.querySelector('.ld3-count')) A.redraw(); }, 4300);
  }
  // 次の宣言(目と個数を 1 本の欄に)。自分の番でない時も消さずに薄く
  const qtys = legalBids.filter((m) => (m - 100) % 10 === face).map((m) => Math.floor((m - 100) / 10));
  const canPick = A.canPlay && legalBids.length > 0 && !revealing;
  const faces = [1, 2, 3, 4, 5, 6].map((f) => {
    const ok = canPick && legalBids.some((m) => (m - 100) % 10 === f);
    return control(ldDie(f, mob ? 34 : 32, { shadow: false }), `data-ldface="${f}"`, `${f} の目を選ぶ`, ok, `ld3-face${f === face ? ' sel' : ''}${ok ? '' : ' no'}`);
  }).join('');
  const minus = control('−', 'data-a="ldq-"', '個数を減らす', canPick && qty > Math.min(...qtys), 'ld3-step');
  const plus = control('＋', 'data-a="ldq+"', '個数を増やす', canPick && qty < Math.max(...qtys), 'ld3-step');
  const P = mob ? { x: 280, y: T.y + 196 } : { x: 450, y: 470 };
  html += `<div class="ld3-pick${mob ? ' mob' : ''}${canPick ? '' : ' off'}" style="left:${P.x}px;top:${P.y}px"><span class="lb">次の宣言</span><div class="faces">${faces}</div><span class="sep"></span><div class="qty">${minus}<b>${qty}</b><span class="u">個</span>${plus}</div></div>`;
  if (mob) nineSizeOverride = { w: 560, h: T.y + 290 };
  stage(A, b, html, (d) => {
    if (!canPick) return;
    if (d.ldface != null) {
      const f = Number(d.ldface), sameFace = legalBids.filter((m) => (m - 100) % 10 === f);
      if (sameFace.length) {
        const keepQty = sameFace.some((m) => Math.floor((m - 100) / 10) === qty);
        A.sel = { kind: 'liarsdice', moves: A.view.moves, face: f, qty: keepQty ? qty : Math.floor((Math.min(...sameFace) - 100) / 10) };
        A.sfx('TILE', 0, { volume: .3 });
        A.redraw();
      }
      return;
    }
    if (d.a === 'ldq-' || d.a === 'ldq+') {
      const v = d.a === 'ldq+' ? Math.min(Math.max(...qtys), qty + 1) : Math.max(Math.min(...qtys), qty - 1);
      A.sel = { kind: 'liarsdice', moves: A.view.moves, face, qty: v };
      A.redraw();
      return;
    }
    tapMove(A)(d);
  });
  nineSizeOverride = null;
  if (ninePrev) { ninePrev.lr = lr ? lr.roundNo : ninePrev.lr; ninePrev.round = b.roundNo; }
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  A.acts([
    { label: 'ダウト!', move: 0, cls: 'danger', enabled: !revealing && !!(b.canDoubt && A.legal.has(0)) },
    { label: 'ジャスト!', move: 1, enabled: !revealing && !!(b.canExact && A.legal.has(1)) },
    { label: `${face} が ${qty} 個と宣言`, move: 100 + qty * 10 + face, cls: 'gold', enabled: canPick && A.legal.has(100 + qty * 10 + face) },
  ]);
}
window.RENDER.liarsdice = renderLiarsdice;

// ================================================================ インカの黄金
const HAZARDS = {
  snake: { name: '毒蛇', color: '#3F9E4D', icon: '<path d="M14 70 Q30 30 50 52 Q70 74 86 30" fill="none" stroke="#3F9E4D" stroke-width="9" stroke-linecap="round"/><circle cx="86" cy="28" r="8" fill="#3F9E4D"/><circle cx="89" cy="26" r="2" fill="#fff"/>' },
  spider: { name: '毒蜘蛛', color: '#5B4A8A', icon: '<g stroke="#3A2E5E" stroke-width="5" stroke-linecap="round" fill="none"><path d="M30 38 L12 26M32 56 L12 58M34 72 L18 86M70 38 L88 26M68 56 L88 58M66 72 L82 86"/></g><ellipse cx="50" cy="52" rx="17" ry="21" fill="#5B4A8A"/><circle cx="44" cy="46" r="3" fill="#FF5A4E"/><circle cx="56" cy="46" r="3" fill="#FF5A4E"/>' },
  mummy: { name: 'ミイラ', color: '#8A6D1F', icon: '<path d="M36 88 V34 Q36 14 50 14 Q64 14 64 34 V88Z" fill="#B8A678"/><path d="M36 30 H64 M36 46 H64 M36 62 H64 M36 78 H64" stroke="#7A6535" stroke-width="4"/><circle cx="43" cy="24" r="3" fill="#33302A"/><circle cx="57" cy="24" r="3" fill="#33302A"/>' },
  fire: { name: '炎', color: '#E8641E', icon: '<path d="M50 6 Q66 26 62 44 Q58 60 50 66 Q42 60 38 44 Q34 26 50 6Z" fill="#E8641E"/><path d="M50 30 Q60 42 57 54 Q54 64 50 67 Q46 64 43 54 Q40 42 50 30Z" fill="#F5A623"/><path d="M50 48 Q55 54 53 60 Q51 64 50 65 Q49 64 47 60 Q45 54 50 48Z" fill="#F8E08A"/>' },
  rock: { name: '落石', color: '#8A8D91', icon: '<path d="M18 66 L30 30 L58 16 L84 34 L80 70 L52 86 L26 80Z" fill="#8A8D91"/><path d="M30 30 L52 48 L80 70 M52 48 L58 16 M52 48 L26 80" stroke="#5F6265" stroke-width="4" fill="none"/>' },
};
const GEM_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M28 18 H72 L88 40 L50 86 L12 40Z" fill="#2BB3A3"/><path d="M12 40 H88 M28 18 L38 40 L50 86 L62 40 L72 18 M38 40 H62" stroke="#157A6E" stroke-width="3" fill="none"/><path d="M28 18 L38 40 H62 L72 18Z" fill="#5ED0C2"/></svg>`;
const MASK_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M26 12 H74 V52 Q74 78 50 90 Q26 78 26 52Z" fill="#D9A41C"/><path d="M26 12 H74 V26 H26Z" fill="#B3242F"/><ellipse cx="39" cy="44" rx="6" ry="8" fill="#4A2F05"/><ellipse cx="61" cy="44" rx="6" ry="8" fill="#4A2F05"/><path d="M38 68 Q50 60 62 68" stroke="#4A2F05" stroke-width="4" fill="none"/></svg>`;
const igTile = (c, size, cls = '', key = '') => {
  let inner = '';
  if (c.kind === 'gem') inner = `<span class="ig-gem">${GEM_SVG}</span><b>${c.value}</b>`;
  else if (c.kind === 'hazard') { const h = HAZARDS[c.hazard]; inner = `<svg viewBox="0 0 100 100" aria-hidden="true">${h ? h.icon : ''}</svg><span class="ig-hname" style="color:${h ? h.color : '#333'}">${esc(c.label || '')}</span>`; }
  else if (c.kind === 'artifact') inner = `<span class="ig-gem">${MASK_SVG}</span><span class="ig-hname">遺物</span>`;
  return `<span class="ig-tile ${c.kind} ${cls}" style="--ts:${size}px"${key ? ` data-piece="${key}"` : ''}>${inner}</span>`;
};
// ---- インカの黄金(見本の石畳の道を実データで描く) ----
const IG_PATH_ANCHORS = [[150, 505], [265, 462], [378, 388], [458, 338], [582, 248], [708, 198], [792, 124]];
const IG_PATH_PTS = (() => {
  const P = IG_PATH_ANCHORS, ext = [P[0], ...P, P[P.length - 1]], pts = [];
  for (let i = 0; i < ext.length - 3; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    for (let j = 0; j < 20; j++) {
      const t = j / 20, t2 = t * t, t3 = t2 * t;
      pts.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  pts.push(P[P.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
})();
function igPathAt(f) {
  const { pts, cum, total } = IG_PATH_PTS, d = Math.max(0, Math.min(1, f)) * total;
  let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = (cum[i] - cum[i - 1]) || 1, t = (d - cum[i - 1]) / seg;
  return {
    x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
    y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
    ang: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI,
  };
}
const igGemStone = (cx, cy, r, seed = 0) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 2 * i / 6 + seed * .7 + (i % 2) * .18, rr = r * (i % 2 ? .82 : 1);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * .86).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="url(#igGemGrad)" stroke="#0b5a51" stroke-width="1.4"/><polygon points="${pts[0]} ${pts[1]} ${cx.toFixed(1)},${cy.toFixed(1)}" fill="#b8fff4" opacity=".55"/>`;
};
const igGemPile = (cx, cy, count, s = 1) => {
  const offs = [[0, 0, 8], [-11, 3, 6.5], [11, 3, 6.5], [-5, -6, 6], [6, -5, 5.5], [0, 6, 6], [-14, -3, 5], [15, -2, 5]];
  let out = '';
  for (let i = 0; i < Math.min(count, offs.length); i++) { const [dx, dy, r] = offs[i]; out += igGemStone(cx + dx * s, cy + dy * s, r * s, i * 1.3 + cx * .01); }
  return out;
};
function igToken(x, y, seat, gems, decided, choice) {
  const col = SEAT_COLORS[seat % SEAT_COLORS.length];
  const stones = gems > 0 ? Math.max(2, Math.min(8, Math.round(gems / 2.5))) : 0;
  let badge = '';
  if (decided) {
    const bg = choice === 1 ? '#E07F13' : '#2F9E44';
    const mark = choice === 1 ? '↑' : choice === 0 ? '↩' : '✓';
    badge = `<circle cx="${x + 13}" cy="${y - 13}" r="9" fill="${bg}" stroke="#fff6e3" stroke-width="2"/><text x="${x + 13}" y="${y - 9.2}" text-anchor="middle" font-size="11" font-weight="900" fill="#fff">${mark}</text>`;
  }
  return `<g data-piece="ig-token-${seat}">${stones ? igGemPile(x + 27, y + 13, stones, .58) : ''}<ellipse cx="${x}" cy="${y + 17}" rx="17" ry="4.5" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r="17" fill="${col}" stroke="#fff6e3" stroke-width="3.2"/><circle cx="${x}" cy="${y}" r="13.5" fill="none" stroke="#00000055" stroke-width="1.6"/><circle cx="${x}" cy="${y - 4.5}" r="4.6" fill="#fff6e3"/><path d="M ${x - 7.5} ${y + 9.5} Q ${x} ${y + .5} ${x + 7.5} ${y + 9.5} L ${x + 7.5} ${y + 11} L ${x - 7.5} ${y + 11} Z" fill="#fff6e3"/>${badge}</g>`;
}
const IG_IDOL = `<g><circle cx="0" cy="-8" r="37" fill="url(#igGlow)"/><rect x="-19" y="16" width="38" height="11" rx="2.5" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.6"/><rect x="-14" y="7" width="28" height="10" rx="2" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.6"/><path d="M -10 8 L -7.5 -12 Q 0 -17 7.5 -12 L 10 8 Z" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.6"/><rect x="-15.5" y="-9" width="5.5" height="14" rx="2.6" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.3"/><rect x="10" y="-9" width="5.5" height="14" rx="2.6" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.3"/><circle cx="0" cy="-21" r="7.6" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.6"/><rect x="-10" y="-32" width="20" height="6" rx="3" fill="url(#igGold)" stroke="#7a5210" stroke-width="1.4"/><circle cx="-2.8" cy="-21" r="1.3" fill="#5d3c08"/><circle cx="2.8" cy="-21" r="1.3" fill="#5d3c08"/></g>`;
const IG_SPIDER = (() => {
  let legs = '';
  for (const s of [-1, 1]) legs += `<path d="M ${s * 8} -14 Q ${s * 30} -30 ${s * 42} -40"/><path d="M ${s * 12} -4 Q ${s * 34} -12 ${s * 46} -14"/><path d="M ${s * 12} 6 Q ${s * 34} 8 ${s * 45} 18"/><path d="M ${s * 8} 15 Q ${s * 26} 28 ${s * 34} 40"/>`;
  return `<g stroke="#221612" stroke-width="5.5" fill="none" stroke-linecap="round">${legs}</g><ellipse cx="0" cy="-6" rx="15.5" ry="18" fill="#2a1c16"/><path d="M 0 -20 L 5 -6 L 0 2 L -5 -6 Z" fill="#c8352a"/><circle cx="0" cy="13" r="9" fill="#20140f"/><circle cx="-3.4" cy="11" r="1.9" fill="#ff5347"/><circle cx="3.4" cy="11" r="1.9" fill="#ff5347"/>`;
})();
const igTileBase = (fill) => `<rect x="-55" y="-51" width="106" height="106" rx="15" fill="#20261f"/><rect x="-53" y="-53" width="106" height="106" rx="15" fill="${fill}" stroke="#333a31" stroke-width="2.5"/><rect x="-46" y="-46" width="92" height="92" rx="11" fill="none" stroke="#e8e2cc" stroke-width="1.4" opacity=".16"/><ellipse cx="-30" cy="-34" rx="17" ry="8" fill="#4d7c43" opacity=".4"/><ellipse cx="36" cy="38" rx="13" ry="6" fill="#3c6334" opacity=".35"/>`;
function igTileSvg(c, x, y, rot, s, isNew) {
  let inner = '';
  if (c.kind === 'gem') inner = `${igTileBase('url(#igStone)')}${igGemStone(-16, -18, 15, 1)}${igGemStone(13, -24, 12, 2)}${igGemStone(2, -4, 11, 3)}<text x="0" y="42" text-anchor="middle" font-size="34" font-weight="800" fill="#ffedb5" stroke="rgba(50,32,4,.5)" stroke-width="1.2">${c.value}</text>`;
  else if (c.kind === 'artifact') inner = `${igTileBase('url(#igStone)')}<g transform="translate(0 2)">${IG_IDOL}</g>`;
  else { const h = HAZARDS[c.hazard]; inner = `${igTileBase('url(#igHaz)')}${c.hazard === 'spider' ? IG_SPIDER : `<g transform="translate(-33 -34) scale(.66)">${h ? h.icon : ''}</g>`}`; }
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(2)})"><g${isNew ? ' class="ig-new"' : ''}>${inner}</g></g>`;
}
const IG_PATH_D = 'M' + IG_PATH_PTS.pts.filter((p, i) => i % 3 === 0 && IG_PATH_PTS.cum[i] <= IG_PATH_PTS.total * .94).map((p) => `${p[0].toFixed(0)} ${p[1].toFixed(0)}`).join(' L ');
const IG_SPECKLES = [.3, .45, .6, .75].map((f) => { const p = igPathAt(f); return `<ellipse cx="${(p.x + 6).toFixed(0)}" cy="${(p.y + 10).toFixed(0)}" rx="19" ry="12" fill="#83887a" transform="rotate(${p.ang.toFixed(0)} ${(p.x + 6).toFixed(0)} ${(p.y + 10).toFixed(0)})"/>`; }).join('');
const IG_DEFS = `<defs><radialGradient id="igGround" cx="42%" cy="30%" r="90%"><stop offset="0%" stop-color="#33513a"/><stop offset="55%" stop-color="#22392a"/><stop offset="100%" stop-color="#14231a"/></radialGradient><linearGradient id="igStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9aa08f"/><stop offset="55%" stop-color="#7c8272"/><stop offset="100%" stop-color="#5f6455"/></linearGradient><linearGradient id="igHaz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#96604f"/><stop offset="100%" stop-color="#6d3a30"/></linearGradient><linearGradient id="igGemGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5fe8d4"/><stop offset="55%" stop-color="#23b8a4"/><stop offset="100%" stop-color="#0e7d70"/></linearGradient><linearGradient id="igGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe98a"/><stop offset="55%" stop-color="#f2b63c"/><stop offset="100%" stop-color="#c07f16"/></linearGradient><radialGradient id="igGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffd968" stop-opacity=".55"/><stop offset="100%" stop-color="#ffd968" stop-opacity="0"/></radialGradient><linearGradient id="igDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#05080a"/><stop offset="100%" stop-color="#0d130d"/></linearGradient></defs>`;
const IG_TEMPLE = `<g><path d="M 790 170 L 790 72 Q 836 30 890 64 L 890 170 Z" fill="url(#igDark)"/><rect x="782" y="58" width="13" height="114" rx="4" fill="#585d4f"/><path d="M 788 64 Q 836 26 892 56 L 892 72 Q 836 42 788 78 Z" fill="#6a6f5e"/><rect x="802" y="96" width="58" height="7" rx="3" fill="#000" opacity=".5"/><rect x="802" y="122" width="58" height="7" rx="3" fill="#000" opacity=".4"/></g>`;
const IG_BG = `<rect x="0" y="0" width="900" height="560" fill="url(#igGround)"/><ellipse cx="160" cy="90" rx="180" ry="60" fill="#0c2013" opacity=".35"/><ellipse cx="770" cy="500" rx="220" ry="70" fill="#0c2013" opacity=".3"/><ellipse cx="440" cy="540" rx="200" ry="46" fill="#0a1c10" opacity=".3"/>${IG_TEMPLE}<path d="${IG_PATH_D}" fill="none" stroke="#565a4d" stroke-width="98" stroke-linecap="round" stroke-linejoin="round"/><path d="${IG_PATH_D}" fill="none" stroke="#757a68" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>${IG_SPECKLES}`;
const IG_CAMP = `<g><ellipse cx="118" cy="525" rx="122" ry="18" fill="#57432a" opacity=".5"/><ellipse cx="112" cy="524" rx="90" ry="9" fill="#000" opacity=".35"/><path d="M 48 522 L 110 448 L 172 522 Z" fill="#b4552d"/><path d="M 110 448 L 172 522 L 110 522 Z" fill="#96431f"/><path d="M 110 478 L 136 522 L 84 522 Z" fill="#5d3418"/><path d="M 110 478 L 136 522 L 110 522 Z" fill="#472708"/><rect x="107.5" y="428" width="5" height="24" fill="#6d4a26"/><path d="M 112 430 L 136 436 L 112 443 Z" fill="#d8b13a"/><ellipse cx="188" cy="539" rx="25" ry="5" fill="#000" opacity=".32"/><path d="M 178 540 C 162 516 166 498 180 492 C 176 484 182 478 188 480 C 194 478 200 484 196 492 C 210 498 214 516 198 540 Z" fill="#8a6a38" stroke="#5f451f" stroke-width="2"/><ellipse cx="188" cy="493" rx="10" ry="4" fill="#5f451f"/>${igGemStone(173, 512, 6.5, 2)}${igGemStone(188, 522, 7.5, 4)}${igGemStone(202, 511, 6, 1)}${igGemStone(196, 533, 6, 3)}</g>`;
const IG_LEAVES = `<g transform="translate(28 26) rotate(18) scale(1.15)" opacity=".5"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(80 8) rotate(-12) scale(.9)" opacity=".45"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(856 300) rotate(155) scale(1.05)" opacity=".4"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(816 540) rotate(190) scale(1.2)" opacity=".45"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(40 300) rotate(95) scale(.8)" opacity=".32"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(570 18) rotate(30) scale(.85)" opacity=".3"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><circle cx="340" cy="90" r="3.2" fill="#aeb49e" opacity=".5"/><circle cx="530" cy="470" r="3.6" fill="#aeb49e" opacity=".45"/><circle cx="100" cy="180" r="2.8" fill="#aeb49e" opacity=".4"/><circle cx="710" cy="420" r="3" fill="#aeb49e" opacity=".4"/>`;
function renderIncangold(b, A) {
  if (isMob()) return igMobileRender(b, A);
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `テント ${b.tentGems[i]} 個 ・ ${b.inCave[i] ? `保持 ${b.roundGems[i]} 個` : '帰還済み'}${b.useArtifacts ? ` ・ 遺物 ${(b.artifactsBySeat || [])[i] || 0} 枚` : ''}`);
  A.round(`ラウンド ${b.roundNo} / ${b.totalRounds}`);
  let side = `<div class="kv"><span>山札</span><b class="num">${b.deckCount} 枚</b></div><div class="kv"><span>道の宝石</span><b class="num">${b.pathGems} 個</b></div>`;
  if (b.pathArtifactsCount > 0) side += `<div class="kv"><span>道の遺物</span><b class="num">${b.pathArtifactsCount} 個</b></div><div class="kv"><span>遺物の点数</span><b class="num">1人帰還で ${b.nextArtifactValue} 点</b></div>`;
  for (const [k, cnt] of Object.entries(b.hazardCounts || {})) {
    if (!cnt) continue;
    const h = HAZARDS[k];
    side += `<div class="kv"><span style="color:${h ? h.color : '#fff'}">● ${h ? h.name : k}${(b.removedHazards || {})[k] ? '（除去済み）' : ''}</span><b class="num">× ${cnt}</b></div>`;
  }
  A.side(side);
  const newTile = ninePrev && ninePrev.handle === A.handle && ninePrev.pathLen != null && b.pathCards.length > ninePrev.pathLen;
  const n = b.pathCards.length;
  const tScale = n <= 6 ? 1 : Math.max(.6, 6.5 / n);
  const stepF = n > 1 ? Math.min(.135, .72 / (n - 1)) : 0;
  const fOf = (i) => .2 + i * stepF;
  let tiles = '';
  b.pathCards.forEach((c, i) => {
    const p = igPathAt(fOf(i));
    const rot = Math.max(-10, Math.min(10, p.ang * .18)) + (i % 2 ? 1.6 : -1.6);
    tiles += igTileSvg(c, p.x, p.y, rot, tScale, i === n - 1 && !!newTile && !A.reduce);
  });
  let nextTile = '';
  if (!b.done) {
    const spacing = n > 1 ? stepF : .135;
    const fp = igPathAt(Math.min(.95, (n ? fOf(n - 1) : .2) + spacing));
    nextTile = `<g transform="translate(${fp.x.toFixed(1)} ${fp.y.toFixed(1)}) rotate(7) scale(${tScale.toFixed(2)})"><rect x="-40" y="-40" width="80" height="80" rx="12" fill="#4c5044" stroke="#2c3028" stroke-width="2.5"/><circle cx="0" cy="0" r="17" fill="none" stroke="#c9c2a4" stroke-width="2.4" opacity=".5"/><circle cx="0" cy="0" r="6" fill="#c9c2a4" opacity=".5"/></g>`;
  }
  const lastP = n ? igPathAt(fOf(n - 1)) : igPathAt(.12);
  const pathPile = b.pathGems > 0 && n ? igGemPile(lastP.x - 58 * tScale, lastP.y + 52 * tScale, Math.min(8, Math.max(2, Math.round(b.pathGems / 2))), .72) : '';
  const inCave = b.inCave.map((v, i) => v ? i : -1).filter((i) => i >= 0);
  let tokens = '';
  if (inCave.length) {
    const cols = Math.min(4, inCave.length), rows = Math.ceil(inCave.length / cols);
    const bx = Math.min(lastP.x + 64, 872 - (cols - 1) * 44), by = Math.min(lastP.y + 66, 536 - (rows - 1) * 44);
    inCave.forEach((seat, j) => { tokens += igToken(bx + (j % cols) * 44, by + Math.floor(j / cols) * 44, seat, b.roundGems[seat], b.decided[seat], seat === b.me ? b.myChoice : -1); });
  }
  b.inCave.map((v, i) => !v ? i : -1).filter((i) => i >= 0).forEach((seat, j) => { tokens += igToken(54 + j * 54, 520, seat, b.tentGems[seat], false, -1); });
  let html = `<svg class="ig-svg" viewBox="0 0 900 560" width="900" height="560" role="img" aria-label="インカの黄金の盤面">${IG_DEFS}${IG_BG}${tiles}${nextTile}${pathPile}${IG_CAMP}${tokens}${IG_LEAVES}</svg>`;
  const stepKey = b.lastStep ? JSON.stringify(b.lastStep) : '';
  if (b.lastStep && ninePrev && ninePrev.handle === A.handle && ninePrev.stepKey !== undefined && ninePrev.stepKey !== stepKey && !A.reduce) {
    const s = b.lastStep;
    const parts = [];
    if (s.busted) parts.push(`<b class="ig-bust">${HAZARDS[s.bustHazard] ? HAZARDS[s.bustHazard].name : '障害'}が2枚目! バースト</b>`);
    if (s.drawnCard) parts.push(`新しいタイル: ${s.drawnCard.kind === 'gem' ? `宝石 ${s.drawnCard.value}` : s.drawnCard.kind === 'artifact' ? '遺物' : esc(s.drawnCard.label || '')}`);
    if (s.returners && s.returners.length) parts.push(`帰還: ${s.returners.map((seat) => `${esc(A.name(seat))} +${(s.bankedBySeat || {})[seat] ?? ''}`).join('、')}`);
    if (s.claimedArtifactPts) parts.push(`遺物 ${s.claimedArtifactPts} 点を獲得`);
    if (parts.length) {
      html += `<div class="cy-reveal ig-banner">${parts.map((t) => `<div>${t}</div>`).join('')}</div>`;
      A.anim(1750);
      if (s.busted) A.sfx('TAKE', 60); else if (s.drawnCard) A.sfx('CARD_FLIP', 60);
    }
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) { ninePrev.pathLen = b.pathCards.length; ninePrev.stepKey = stepKey; }
  // ボタンは消さずに常時表示し、使えない時はグレーアウトする
  A.acts([
    { label: '進む', move: 1, cls: 'gold', enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(1) },
    { label: '帰る', move: 0, enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(0) },
  ]);
}
const igSpline = (anchors) => {
  const ext = [anchors[0], ...anchors, anchors[anchors.length - 1]], pts = [];
  for (let i = 0; i < ext.length - 3; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    for (let j = 0; j < 20; j++) {
      const t = j / 20, t2 = t * t, t3 = t2 * t;
      pts.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  pts.push(anchors[anchors.length - 1].slice());
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
};
const igSplineAt = (sp, f) => {
  const { pts, cum, total } = sp, d = Math.max(0, Math.min(1, f)) * total;
  let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = (cum[i] - cum[i - 1]) || 1, t = (d - cum[i - 1]) / seg;
  return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, ang: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI };
};
const IG_MOB_PATH = igSpline([[218, 778], [332, 692], [186, 568], [356, 452], [202, 330], [398, 226], [458, 132]]);
const IG_MOB_PATH_D = IG_MOB_PATH.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
function igMobileRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `テント ${b.tentGems[i]} 個 ・ ${b.inCave[i] ? `保持 ${b.roundGems[i]} 個` : '帰還済み'}${b.useArtifacts ? ` ・ 遺物 ${(b.artifactsBySeat || [])[i] || 0} 枚` : ''}`);
  A.round(`ラウンド ${b.roundNo} / ${b.totalRounds}`);
  let side = `<div class="kv"><span>山札</span><b class="num">${b.deckCount} 枚</b></div><div class="kv"><span>道の宝石</span><b class="num">${b.pathGems} 個</b></div>`;
  if (b.pathArtifactsCount > 0) side += `<div class="kv"><span>道の遺物</span><b class="num">${b.pathArtifactsCount} 個</b></div>`;
  for (const [k, cnt] of Object.entries(b.hazardCounts || {})) {
    if (!cnt) continue;
    const h = HAZARDS[k];
    side += `<div class="kv"><span style="color:${h ? h.color : '#fff'}">● ${h ? h.name : k}${(b.removedHazards || {})[k] ? '（除去済み）' : ''}</span><b class="num">× ${cnt}</b></div>`;
  }
  A.side(side);
  const newTile = ninePrev && ninePrev.handle === A.handle && ninePrev.pathLen != null && b.pathCards.length > ninePrev.pathLen;
  const n = b.pathCards.length;
  const tScale = n <= 6 ? 1.02 : Math.max(.6, 6.6 / n);
  const stepF = n > 1 ? Math.min(.105, .66 / (n - 1)) : 0;
  const fOf = (i) => .14 + i * stepF;
  let tiles = '';
  b.pathCards.forEach((c, i) => {
    const p = igSplineAt(IG_MOB_PATH, fOf(i));
    const rot = Math.max(-10, Math.min(10, p.ang * .18)) + (i % 2 ? 1.6 : -1.6);
    tiles += igTileSvg(c, p.x, p.y, rot, tScale, i === n - 1 && !!newTile && !A.reduce);
  });
  let nextTile = '';
  if (!b.done) {
    const spacing = n > 1 ? stepF : .105;
    const fp = igSplineAt(IG_MOB_PATH, Math.min(.96, (n ? fOf(n - 1) : .14) + spacing));
    nextTile = `<g transform="translate(${fp.x.toFixed(1)} ${fp.y.toFixed(1)}) rotate(7) scale(${tScale.toFixed(2)})\"><rect x="-40" y="-40" width="80" height="80" rx="12" fill="#4c5044" stroke="#2c3028" stroke-width="2.5"/><circle cx="0" cy="0" r="17" fill="none" stroke="#c9c2a4" stroke-width="2.4" opacity=".5"/><circle cx="0" cy="0" r="6" fill="#c9c2a4" opacity=".5"/></g>`;
  }
  const lastP = n ? igSplineAt(IG_MOB_PATH, fOf(n - 1)) : igSplineAt(IG_MOB_PATH, .08);
  const pathPile = b.pathGems > 0 && n ? igGemPile(lastP.x - 58 * tScale, lastP.y + 52 * tScale, Math.min(8, Math.max(2, Math.round(b.pathGems / 2))), .72) : '';
  const inCave = b.inCave.map((v, i) => v ? i : -1).filter((i) => i >= 0);
  let tokens = '';
  if (inCave.length) {
    const cols = Math.min(4, inCave.length), rows = Math.ceil(inCave.length / cols);
    const bx = lastP.x > 280 ? lastP.x - 64 - (cols - 1) * 44 : lastP.x + 64;
    const by = Math.min(lastP.y + 62, 830 - (rows - 1) * 44);
    inCave.forEach((seat, j) => { tokens += igToken(bx + (j % cols) * 44, by + Math.floor(j / cols) * 44, seat, b.roundGems[seat], b.decided[seat], seat === b.me ? b.myChoice : -1); });
  }
  b.inCave.map((v, i) => !v ? i : -1).filter((i) => i >= 0).forEach((seat, j) => { tokens += igToken(282 + j * 54, 838, seat, b.tentGems[seat], false, -1); });
  const bg = `<rect x="0" y="0" width="560" height="880" fill="url(#igGround)"/><ellipse cx="110" cy="120" rx="150" ry="70" fill="#0c2013" opacity=".35"/><ellipse cx="480" cy="640" rx="150" ry="90" fill="#0c2013" opacity=".3"/><ellipse cx="280" cy="866" rx="240" ry="40" fill="#0a1c10" opacity=".3"/><g transform="translate(-200.8 14) scale(.8)">${IG_TEMPLE}</g><path d="${IG_MOB_PATH_D}" fill="none" stroke="#565a4d" stroke-width="98" stroke-linecap="round" stroke-linejoin="round"/><path d="${IG_MOB_PATH_D}" fill="none" stroke="#757a68" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>`;
  const camp = `<g transform="translate(4.5 289.9) scale(1.05)">${IG_CAMP}</g>`;
  const leaves = `<g transform="translate(16 20) rotate(18) scale(1.05)" opacity=".45"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(500 420) rotate(155) scale(.95)" opacity=".35"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g><g transform="translate(24 470) rotate(95) scale(.75)" opacity=".3"><path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/><path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/></g>`;
  let html = `<svg class="ig-svg" viewBox="0 0 560 880" width="560" height="880" role="img" aria-label="インカの黄金の盤面">${IG_DEFS}${bg}${tiles}${nextTile}${pathPile}${camp}${tokens}${leaves}</svg>`;
  const stepKey = b.lastStep ? JSON.stringify(b.lastStep) : '';
  if (b.lastStep && ninePrev && ninePrev.handle === A.handle && ninePrev.stepKey !== undefined && ninePrev.stepKey !== stepKey && !A.reduce) {
    const s = b.lastStep;
    const parts = [];
    if (s.busted) parts.push(`<b class="ig-bust">${HAZARDS[s.bustHazard] ? HAZARDS[s.bustHazard].name : '障害'}が2枚目! バースト</b>`);
    if (s.drawnCard) parts.push(`新しいタイル: ${s.drawnCard.kind === 'gem' ? `宝石 ${s.drawnCard.value}` : s.drawnCard.kind === 'artifact' ? '遺物' : esc(s.drawnCard.label || '')}`);
    if (s.returners && s.returners.length) parts.push(`帰還: ${s.returners.map((seat) => `${esc(A.name(seat))} +${(s.bankedBySeat || {})[seat] ?? ''}`).join('、')}`);
    if (s.claimedArtifactPts) parts.push(`遺物 ${s.claimedArtifactPts} 点を獲得`);
    if (parts.length) {
      html += `<div class="cy-reveal ig-banner">${parts.map((t) => `<div>${t}</div>`).join('')}</div>`;
      A.anim(1750);
      if (s.busted) A.sfx('TAKE', 60); else if (s.drawnCard) A.sfx('CARD_FLIP', 60);
    }
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) { ninePrev.pathLen = b.pathCards.length; ninePrev.stepKey = stepKey; }
  // ボタンは消さずに常時表示し、使えない時はグレーアウトする
  A.acts([
    { label: '進む', move: 1, cls: 'gold', enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(1) },
    { label: '帰る', move: 0, enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(0) },
  ]);
}
function igLegacyRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `テント ${b.tentGems[i]} 個 ・ ${b.inCave[i] ? `保持 ${b.roundGems[i]} 個` : '帰還済み'}${b.useArtifacts ? ` ・ 遺物 ${(b.artifactsBySeat || [])[i] || 0} 枚` : ''}`);
  A.round(`ラウンド ${b.roundNo} / ${b.totalRounds}`);
  A.side(`<div class="kv"><span>山札</span><b class="num">${b.deckCount} 枚</b></div><div class="kv"><span>道の宝石</span><b class="num">${b.pathGems} 個</b></div>`);
  const mob = isMob();
  const tileSize = mob ? 92 : 86;
  const pathPos = (i) => {
    const cols = mob ? 4 : 8, tw = mob ? 118 : 102, th = mob ? 112 : 118;
    const row = Math.floor(i / cols), cr = i % cols;
    const col = row % 2 ? cols - 1 - cr : cr;
    return [mob ? 66 + col * tw : 78 + col * tw, mob ? 716 - row * th : 116 + row * th];
  };
  let html = `<div class="nine-table ig-table"></div>`;
  const [campX, campY] = mob ? [462, 800] : [78, 442];
  // 道のタイル
  const newTile = ninePrev && ninePrev.handle === A.handle && ninePrev.pathLen != null && b.pathCards.length > ninePrev.pathLen;
  b.pathCards.forEach((c, i) => {
    const [x, y] = pathPos(i);
    html += at(x, y, igTile(c, tileSize, i === b.pathCards.length - 1 && newTile && !A.reduce ? 'ig-new' : '', 'ig-tile-' + i));
  });
  // 次のタイル(裏向き)と山札
  if (!b.done && b.pathCards.length) {
    const [nx, ny] = pathPos(b.pathCards.length);
    html += at(nx, ny, `<span class="ig-tile back" style="--ts:${tileSize}px">${MASK_SVG}</span>`);
  }
  // 探検者トークン: 探検中は最後のタイル、帰還者はキャンプ
  const token = (seat) => `<span class="ig-token" data-piece="ig-token-${seat}" style="background:${SEAT_COLORS[seat % 6]}">${esc(A.name(seat)[0] || '?')}</span>`;
  const inCave = b.pathCards.length ? b.inCave.map((v, i) => v ? i : -1).filter((i) => i >= 0) : [];
  if (inCave.length) {
    const [lx, ly] = pathPos(b.pathCards.length - 1);
    html += at(lx, ly + tileSize / 2 + 16, `<div class="ig-tokens">${inCave.map(token).join('')}</div>`);
  }
  const returned = b.inCave.map((v, i) => !v ? i : -1).filter((i) => i >= 0);
  html += at(campX, campY, `<div class="ig-campbox"><span class="ig-camp-lab">キャンプ</span><div class="ig-tokens">${returned.map(token).join('') || '<span class="ig-none">―</span>'}</div></div>`);
  // 道の宝石・遺物タグ
  const tags = [];
  if (b.pathGems > 0) tags.push(`<span class="ig-tag gem">道の宝石 ${b.pathGems}</span>`);
  if (b.pathArtifactsCount > 0) tags.push(`<span class="ig-tag art">道の遺物 ${b.pathArtifactsCount}(1人帰還で ${b.nextArtifactValue} 点)</span>`);
  if (tags.length) html += at(mob ? 280 : 450, mob ? 84 : 44, `<div class="ig-tags">${tags.join('')}</div>`);
  // 出た障害の記録
  const hz = Object.entries(b.hazardCounts || {}).filter(([, n]) => n > 0);
  if (hz.length) {
    html += at(mob ? 470 : 806, mob ? 84 : 44, `<div class="ig-hazards">${hz.map(([k, n]) => {
      const h = HAZARDS[k];
      const removed = (b.removedHazards || {})[k];
      return `<span class="ig-hz${removed ? ' removed' : ''}" title="${h ? h.name : k}"><svg viewBox="0 0 100 100">${h ? h.icon : ''}</svg>×${n}</span>`;
    }).join('')}</div>`);
  }
  // プレイヤーチップ(下部・PC のみ。スマホは上のプレイヤー表示で足りるので盤を空ける)
  if (!mob) {
    for (let k = 0; k < b.n; k++) {
      const seat = (me + k) % b.n;
      html += at(268 + k * 128, 500, `<div class="seat-name ig-pchip">${avFor(A, b, seat)}<em>${b.inCave[seat] ? `保持 ${b.roundGems[seat]}` : `テント ${b.tentGems[seat]}`}</em><span class="ig-dec">${b.decided[seat] ? '✓' : ''}</span></div>`);
    }
  }
  if (b.me >= 0 && b.myChoice >= 0) html += at(mob ? 280 : 450, mob ? 620 : 452, note(b.myChoice === 1 ? 'あなたは「進む」を選びました' : 'あなたは「帰る」を選びました'));
  // 直前の解決バナー
  const stepKey = b.lastStep ? JSON.stringify(b.lastStep) : '';
  if (b.lastStep && ninePrev && ninePrev.handle === A.handle && ninePrev.stepKey !== undefined && ninePrev.stepKey !== stepKey && !A.reduce) {
    const s = b.lastStep;
    const parts = [];
    if (s.busted) parts.push(`<b class="ig-bust">${HAZARDS[s.bustHazard] ? HAZARDS[s.bustHazard].name : '障害'}が2枚目! バースト</b>`);
    if (s.drawnCard) parts.push(`新しいタイル: ${s.drawnCard.kind === 'gem' ? `宝石 ${s.drawnCard.value}` : s.drawnCard.kind === 'artifact' ? '遺物' : esc(s.drawnCard.label || '')}`);
    if (s.returners && s.returners.length) parts.push(`帰還: ${s.returners.map((seat) => `${esc(A.name(seat))} +${(s.bankedBySeat || {})[seat] ?? ''}`).join('、')}`);
    if (s.claimedArtifactPts) parts.push(`遺物 ${s.claimedArtifactPts} 点を獲得`);
    if (parts.length) {
      html += `<div class="cy-reveal ig-banner">${parts.map((t) => `<div>${t}</div>`).join('')}</div>`;
      A.anim(1750);
      if (s.busted) A.sfx('TAKE', 60); else if (s.drawnCard) A.sfx('CARD_FLIP', 60);
    }
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) { ninePrev.pathLen = b.pathCards.length; ninePrev.stepKey = stepKey; }
  // ボタンは消さずに常時表示し、使えない時はグレーアウトする
  A.acts([
    { label: '進む', move: 1, cls: 'gold', enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(1) },
    { label: '帰る', move: 0, enabled: A.canPlay && !!b.inCave[b.me] && A.legal.has(0) },
  ]);
}
window.RENDER.incangold = renderIncangold;

// ================================================================ 6ニムト
const bullHeads = (n) => n === 55 ? 7 : n % 11 === 0 ? 5 : n % 10 === 0 ? 3 : n % 10 === 5 ? 2 : 1;
const BULL = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 22 Q26 6 40 16 M88 22 Q74 6 60 16" stroke="#7A4A21" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M28 30 Q28 14 50 14 Q72 14 72 30 L76 58 Q76 84 50 86 Q24 84 24 58Z" fill="#A9743F"/><circle cx="40" cy="44" r="4.5" fill="#2A1A0C"/><circle cx="60" cy="44" r="4.5" fill="#2A1A0C"/><ellipse cx="50" cy="68" rx="11" ry="8" fill="#C99A63"/><circle cx="45" cy="68" r="2.2" fill="#2A1A0C"/><circle cx="55" cy="68" r="2.2" fill="#2A1A0C"/></svg>`;
const t6card = (n, w, cls = '', key = '') => {
  if (n == null) return `<span class="t6-card back" style="--cw:${w}px"${key ? ` data-piece="${key}"` : ''}><span class="t6-back-bull">${BULL}</span></span>`;
  const bulls = Array.from({ length: bullHeads(n) }, () => `<span class="t6-bull">${BULL}</span>`).join('');
  return `<span class="t6-card ${cls}" style="--cw:${w}px"${key ? ` data-piece="${key}"` : ''}><span class="t6-bulls">${bulls}</span><b>${n}</b></span>`;
};
// ---- 6ニムト(見本の茶色い盤面・レーン・扇形の手札で描く) ----
const t62bull = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 8.5C3.8 7 3.2 4.4 4.4 2.8c1.6.4 2.8 1.8 3.2 3.6z" fill="#eadfc6"/><path d="M17.8 8.5c2.4-1.5 3-4.1 1.8-5.7-1.6.4-2.8 1.8-3.2 3.6z" fill="#eadfc6"/><ellipse cx="4.6" cy="11" rx="2.2" ry="1.5" fill="#9c6636" transform="rotate(24 4.6 11)"/><ellipse cx="19.4" cy="11" rx="2.2" ry="1.5" fill="#9c6636" transform="rotate(-24 19.4 11)"/><ellipse cx="12" cy="13.2" rx="7.4" ry="8" fill="#b57e46"/><ellipse cx="12" cy="18.2" rx="4.4" ry="3" fill="#e8c491"/><circle cx="10.3" cy="18.2" r=".95" fill="#7a4a22"/><circle cx="13.7" cy="18.2" r=".95" fill="#7a4a22"/><circle cx="8.9" cy="11.6" r="1.15" fill="#2e1c10"/><circle cx="15.1" cy="11.6" r="1.15" fill="#2e1c10"/></svg>`;
const t62card = (n, w, cls = '', key = '') => {
  const heads = Array.from({ length: bullHeads(n) }, () => t62bull(Math.round(w * .18))).join('');
  return `<span class="t62-card ${cls}" style="width:${w}px;height:${Math.round(w * 1.41)}px"${key ? ` data-piece="${key}"` : ''}><span class="t62-heads">${heads}</span><span class="t62-numwrap"><b class="t62-num" style="font-size:${Math.round(w * .44)}px">${n}</b></span></span>`;
};
function renderTake6(b, A) {
  if (isMob()) return t6MobileRender(b, A);
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `失点 ${b.totalScores[i]}(今回 ${b.roundScores[i]})`);
  A.round(b.endMode === 'to66' ? `ラウンド ${b.roundNo} ・ ${b.turnNo} ターン目` : `${b.turnNo} ターン目`);
  A.side(`<div class="kv"><span>失点</span><b class="num">${b.me >= 0 ? b.totalScores[b.me] : 0}</b></div>`);
  let html = `<div class="t62-bg"></div>`;
  b.rows.forEach((row, r) => {
    const danger = row.length >= 5 || row.includes(55);
    let cells = '';
    for (let i = 0; i < 5; i++) {
      cells += i < row.length
        ? t62card(row[i], 68, `${i === row.length - 1 ? 'tail' : ''}${row[i] === 55 ? ' hot' : ''}`, 't6-card-' + row[i])
        : `<span class="t62-slot${row.length === 4 && i === 4 ? ' next' : ''}"></span>`;
    }
    const inner = `<div class="t62-lane${danger ? ' danger' : ''}">${cells}</div>`;
    html += at(328, 61 + r * 113, b.phase === 'rowPick' && A.legal.has(r)
      ? moveBtn(A, r, inner, `${r + 1} 列目を引き取る`, 't6-row-btn') : inner);
  });
  // 右上: 相手の伏せ札(色の点が側板のアバターと対応)と山札の束
  const backs = [];
  for (let k = 1; k < b.n; k++) {
    const seat = (me + k) % b.n;
    if (b.handCounts[seat] > 0 || b.decided[seat]) {
      backs.push(`<span class="t62-back" data-piece="t6-back-${seat}">${t62bull(25)}<span class="t62-dotp" style="background:${SEAT_COLORS[seat % SEAT_COLORS.length]}"></span>${b.decided[seat] ? '<span class="t62-dec">✓</span>' : ''}</span>`);
    }
  }
  if (backs.length) {
    const deck = `<span class="t62-deck"><span class="t62-back d3"></span><span class="t62-back d2"></span><span class="t62-back d1">${t62bull(25)}</span></span>`;
    html += at(652, 84, `<div class="t62-picks${backs.length > 4 ? ' many' : ''}">${backs.join('')}${deck}</div>`);
  }
  // 手札(扇形)
  const hand = b.myHand || [];
  if (hand.length) {
    const items = hand.map((n, i) => {
      const chosen = b.myChoice === n;
      const d = i - (hand.length - 1) / 2;
      const t = chosen ? 'rotate(0deg) translateY(-16px)' : `rotate(${(d * 1.9).toFixed(1)}deg) translateY(${(Math.abs(d) * 1.7).toFixed(1)}px)`;
      const card = `<span class="t62-card hand${chosen ? ' sel' : ''}" style="width:68px;height:96px;transform:${t}" data-piece="t6-card-${n}"><span class="t62-heads">${Array.from({ length: bullHeads(n) }, () => t62bull(12)).join('')}</span><span class="t62-numwrap"><b class="t62-num" style="font-size:31px">${n}</b></span></span>`;
      return b.phase === 'choose' ? moveBtn(A, n, card, `${n} を出す`, 't62-hand-btn') : card;
    }).join('');
    html += at(450, 506, `<div class="t62-hand">${items}</div>`);
  }
  if (b.phase === 'rowPick' && A.view.toMove === b.me) html += at(450, 24, `<div class="board-label">どの列も置けません。引き取る列を選んでください</div>`);
  const lr = b.lastReveal;
  const lrKey = lr ? `${lr.roundNo}-${lr.turnNo}` : '';
  if (lr && lr.placements && ninePrev && ninePrev.handle === A.handle && ninePrev.lrKey !== undefined && ninePrev.lrKey !== lrKey && !A.reduce) {
    const cards = lr.cards.slice().sort((a, z) => a.card - z.card).map(({ seat, card }) => {
      const pl = lr.placements.find((p) => p.seat === seat);
      return `<div class="t6-rev-cell">${t62card(card, 50)}<span>${esc(A.name(seat))}</span><em>${pl && pl.tookBulls ? `+${pl.tookBulls} 失点` : ''}</em></div>`;
    }).join('');
    html += `<div class="cy-reveal t6-reveal"><div class="cy-rev-cards">${cards}</div></div>`;
    A.anim(1500);
    A.sfx('CARD', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lrKey = lrKey;
  A.acts([]);
}
function t6LegacyRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `失点 ${b.totalScores[i]}(今回 ${b.roundScores[i]})`);
  A.round(b.endMode === 'to66' ? `ラウンド ${b.roundNo} ・ ${b.turnNo} ターン目` : `${b.turnNo} ターン目`);
  A.side(`<div class="kv"><span>失点</span><b class="num">${b.me >= 0 ? b.totalScores[b.me] : 0}</b></div>`);
  const mob = isMob();
  const cw = mob ? 56 : 58, ch = cw * 1.42;
  const rowY = (r) => mob ? 116 + r * 112 : 48 + r * 98;
  const rowX = mob ? 26 : 42;
  let html = `<div class="nine-table ntable rect"><div class="feltin"></div></div>`;
  // 4つの列
  b.rows.forEach((row, r) => {
    const y = rowY(r);
    const danger = row.length >= 5;
    let cells = '';
    for (let i = 0; i < 5; i++) {
      cells += i < row.length ? t6card(row[i], cw, '', 't6-card-' + row[i]) : `<span class="t6-card slot" style="--cw:${cw}px"></span>`;
    }
    cells += `<span class="t6-card next" style="--cw:${cw}px"></span>`;
    const inner = `<div class="t6-row${danger ? ' danger' : ''}">${cells}<span class="t6-rowbull">${BULL}<b>${b.rowBulls[r]}</b></span></div>`;
    html += at(rowX + (mob ? 248 : 318), y + ch / 2, b.phase === 'rowPick' && A.legal.has(r)
      ? moveBtn(A, r, inner, `${r + 1} 列目を引き取る`, 't6-row-btn') : inner);
  });
  // 右側: 相手の伏せ札(PC は右の列、スマホは上部に横並び)
  const backs = [];
  for (let k = 1; k < b.n; k++) {
    const seat = (me + k) % b.n;
    if (b.handCounts[seat] > 0 || b.decided[seat]) backs.push(`<div class="t6-opp">${t6card(null, mob ? 36 : 46, '', 't6-back-' + seat)}<span>${esc(A.name(seat))}</span><em class="t6-dec${b.decided[seat] ? '' : ' wait'}">選択済み</em></div>`);
  }
  if (backs.length) html += at(mob ? 280 : 806, mob ? 40 : 148, `<div class="t6-opps${mob ? ' row' : ''}">${backs.join('')}</div>`);
  // 手札(扇形)
  const hand = b.myHand || [];
  const handCardW = mob ? 58 : 70;
  const pitch = mob ? Math.min(48, 480 / Math.max(1, hand.length)) : Math.min(66, 720 / Math.max(1, hand.length));
  const handW = hand.length ? (hand.length - 1) * pitch + handCardW : 0;
  const handHtml = hand.map((n, i) => {
    const chosen = b.myChoice === n;
    const x = -handW / 2 + handCardW / 2 + i * pitch;
    const inner = t6card(n, handCardW, chosen ? 'chosen' : '', 't6-card-' + n);
    const btn = b.phase === 'choose' ? moveBtn(A, n, inner, `${n} を出す`, 't6-hand-btn') : inner;
    return `<span class="t6-hand-card${chosen ? ' chosen' : ''}" style="left:${x}px">${btn}</span>`;
  }).join('');
  html += at(mob ? 280 : 450, mob ? 800 : 550, `<div class="t6-hand">${handHtml}</div>`);
  if (b.phase === 'rowPick' && A.view.toMove === b.me) html += at(mob ? 280 : 450, mob ? 596 : 24, `<div class="board-label">どの列も置けません。引き取る列を選んでください</div>`);
  // 直前の公開フラッシュ
  const lr = b.lastReveal;
  const lrKey = lr ? `${lr.roundNo}-${lr.turnNo}` : '';
  if (lr && lr.placements && ninePrev && ninePrev.handle === A.handle && ninePrev.lrKey !== undefined && ninePrev.lrKey !== lrKey && !A.reduce) {
    const cards = lr.cards.slice().sort((a, z) => a.card - z.card).map(({ seat, card }) => {
      const pl = lr.placements.find((p) => p.seat === seat);
      return `<div class="t6-rev-cell">${t6card(card, mob ? 44 : 50)}<span>${esc(A.name(seat))}</span>${pl && pl.tookBulls ? `<em>+${pl.tookBulls} 失点</em>` : ''}</div>`;
    }).join('');
    html += `<div class="cy-reveal t6-reveal"><div class="cy-rev-cards">${cards}</div></div>`;
    A.anim(1500);
    A.sfx('CARD', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lrKey = lrKey;
  A.acts([]);
}
function t6MobileRender(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `失点 ${b.totalScores[i]}(今回 ${b.roundScores[i]})`);
  A.round(b.endMode === 'to66' ? `ラウンド ${b.roundNo} ・ ${b.turnNo} ターン目` : `${b.turnNo} ターン目`);
  A.side(`<div class="kv"><span>失点</span><b class="num">${b.me >= 0 ? b.totalScores[b.me] : 0}</b></div>`);
  let html = `<div class="t62-bg"></div>`;
  b.rows.forEach((row, r) => {
    const danger = row.length >= 5 || row.includes(55);
    let cells = '';
    for (let i = 0; i < 5; i++) {
      cells += i < row.length
        ? t62card(row[i], 68, `${i === row.length - 1 ? 'tail' : ''}${row[i] === 55 ? ' hot' : ''}`, 't6-card-' + row[i])
        : `<span class="t62-slot${row.length === 4 && i === 4 ? ' next' : ''}"></span>`;
    }
    const inner = `<div class="t62-lane${danger ? ' danger' : ''}">${cells}</div>`;
    html += at(280, 196 + r * 116, b.phase === 'rowPick' && A.legal.has(r)
      ? moveBtn(A, r, inner, `${r + 1} 列目を引き取る`, 't6-row-btn') : inner);
  });
  const backs = [];
  for (let k = 1; k < b.n; k++) {
    const seat = (me + k) % b.n;
    if (b.handCounts[seat] > 0 || b.decided[seat]) {
      backs.push(`<span class="t62-back" data-piece="t6-back-${seat}">${t62bull(25)}<span class="t62-dotp" style="background:${SEAT_COLORS[seat % SEAT_COLORS.length]}"></span>${b.decided[seat] ? '<span class="t62-dec">✓</span>' : ''}</span>`);
    }
  }
  if (backs.length) {
    const deck = `<span class="t62-deck"><span class="t62-back d3"></span><span class="t62-back d2"></span><span class="t62-back d1">${t62bull(25)}</span></span>`;
    html += at(446, 62, `<div class="t62-picks${backs.length > 4 ? ' many' : ''}">${backs.join('')}${deck}</div>`);
  }
  const hand = b.myHand || [];
  if (hand.length) {
    const items = hand.map((n, i) => {
      const chosen = b.myChoice === n;
      const d = i - (hand.length - 1) / 2;
      const t = chosen ? 'rotate(0deg) translateY(-16px)' : `rotate(${(d * 1.9).toFixed(1)}deg) translateY(${(Math.abs(d) * 1.7).toFixed(1)}px)`;
      const card = `<span class="t62-card hand${chosen ? ' sel' : ''}" style="width:68px;height:96px;transform:${t}" data-piece="t6-card-${n}"><span class="t62-heads">${Array.from({ length: bullHeads(n) }, () => t62bull(12)).join('')}</span><span class="t62-numwrap"><b class="t62-num" style="font-size:31px">${n}</b></span></span>`;
      return b.phase === 'choose' ? moveBtn(A, n, card, `${n} を出す`, 't62-hand-btn') : card;
    }).join('');
    html += at(280, 778, `<div class="t62-hand mob">${items}</div>`);
  }
  if (b.phase === 'rowPick' && A.view.toMove === b.me) html += at(280, 116, `<div class="board-label">どの列も置けません。引き取る列を選んでください</div>`);
  const lr = b.lastReveal;
  const lrKey = lr ? `${lr.roundNo}-${lr.turnNo}` : '';
  if (lr && lr.placements && ninePrev && ninePrev.handle === A.handle && ninePrev.lrKey !== undefined && ninePrev.lrKey !== lrKey && !A.reduce) {
    const cards = lr.cards.slice().sort((a, z) => a.card - z.card).map(({ seat, card }) => {
      const pl = lr.placements.find((p) => p.seat === seat);
      return `<div class="t6-rev-cell">${t62card(card, 50)}<span>${esc(A.name(seat))}</span><em>${pl && pl.tookBulls ? `+${pl.tookBulls} 失点` : ''}</em></div>`;
    }).join('');
    html += `<div class="cy-reveal t6-reveal"><div class="cy-rev-cards">${cards}</div></div>`;
    A.anim(1500);
    A.sfx('CARD', 60);
  }
  stage(A, b, html, tapMove(A));
  if (ninePrev) ninePrev.lrKey = lrKey;
  A.acts([]);
}
window.RENDER.take6 = renderTake6;

// ================================================================ ブロックス
const BK_COLORS = ['#2E6BD8', '#F2B705', '#D8402E', '#2FA84F'];
const BK_NAMES = ['青', '黄', '赤', '緑'];
let bkZoom = { z: 1, x: 0, y: 0, handle: null }, bkDraggedAt = 0;
function renderBlokus(b, A) {
  prep(A);
  const NC = window.__nineCore && window.__nineCore.blokus;
  const me = Math.max(0, b.me);
  const myTurn = !b.finished && b.currentSeat === b.me && A.view.human;
  strip(A, b, (i) => {
    const cols = b.seatOfColor.map((s, c) => s === i ? c : -1).filter((c) => c >= 0);
    return cols.map((c) => `${BK_NAMES[c]} 残り ${b.remainingCells[c]} マス`).join(' ・ ');
  });
  A.round('');
  A.side(`<div class="kv"><span>手番</span><b>${b.finished ? '終了' : `${BK_NAMES[b.currentColor]}(${esc(A.name(b.currentSeat))})`}</b></div>`);
  const mob = isMob();
  const size = b.boardSize;
  if (bkZoom.handle !== A.handle) bkZoom = { z: 1, x: 0, y: 0, handle: A.handle };
  // 合法手をピース・向きごとに整理
  const byPiece = new Map();
  if (NC && A.canPlay) {
    for (const m of A.legal) {
      if (m === NC.BLOKUS_MOVE_PASS) continue;
      const d = NC.decodeBlokusMove(m, size);
      if (!byPiece.has(d.pieceIdx)) byPiece.set(d.pieceIdx, new Map());
      const byOri = byPiece.get(d.pieceIdx);
      if (!byOri.has(d.oriIdx)) byOri.set(d.oriIdx, []);
      byOri.get(d.oriIdx).push({ move: m, x: d.x, y: d.y });
    }
  }
  const myColor = b.currentColor;
  // トレイは「自分の色」のピースを見せる(自分の番なら現在の色、それ以外は自分の最初の色)
  const trayColor = b.me >= 0 ? (b.seatOfColor[myColor] === b.me ? myColor : b.seatOfColor.indexOf(b.me)) : myColor;
  const remaining = b.me >= 0 ? (b.remaining[myTurn ? myColor : trayColor] || []) : [];
  const selOk = A.sel && A.sel.kind === 'blokus' && A.sel.moves === A.view.moves;
  let selPiece = selOk ? A.sel.piece : remaining.find((p) => byPiece.has(p));
  if (selPiece == null) selPiece = remaining[0];
  let selOri = selOk && A.sel.piece === selPiece ? A.sel.ori : (byPiece.get(selPiece) ? Math.min(...byPiece.get(selPiece).keys()) : 0);
  if (byPiece.get(selPiece) && !byPiece.get(selPiece).has(selOri)) selOri = Math.min(...byPiece.get(selPiece).keys());
  const boardPx = mob ? 524 : 452;
  const cell = boardPx / size;
  const bx = mob ? 18 : 26, by = mob ? 40 : 52;
  // 盤面 SVG
  let cellsSvg = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = b.board[y * size + x];
    if (v >= 0) cellsSvg += `<rect x="${(x * cell + 1).toFixed(1)}" y="${(y * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="${BK_COLORS[v]}"/>`;
  }
  // 開始角マーカー
  const corners = [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]];
  let cornerSvg = '';
  corners.forEach(([x, y], c) => { if (c < b.colorCount) cornerSvg += `<rect class="bk-corner" x="${(x * cell + cell * .22).toFixed(1)}" y="${(y * cell + cell * .22).toFixed(1)}" width="${(cell * .56).toFixed(1)}" height="${(cell * .56).toFixed(1)}" fill="none" stroke="${BK_COLORS[c]}" stroke-width="2" opacity=".65"/>`; });
  // 直前に置かれたピースの光(他のプレイヤーが置いた時は、集中線も添えて目立たせる)
  let lastSvg = '';
  if (b.lastAction && b.lastAction.type === 'place') {
    lastSvg = b.lastAction.cells.map((idx) => { const x = idx % size, y = Math.floor(idx / size); return `<rect x="${(x * cell + 1).toFixed(1)}" y="${(y * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="none" stroke="#F5B921" stroke-width="6" opacity=".28"/><rect x="${(x * cell + 1).toFixed(1)}" y="${(y * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="none" stroke="#E8A90C" stroke-width="2.2" class="bk-last"/>`; }).join('');
    if (b.lastAction.seat !== b.me && b.lastAction.cells.length) {
      const xs = b.lastAction.cells.map((idx) => idx % size), ys = b.lastAction.cells.map((idx) => Math.floor(idx / size));
      const x0 = Math.min(...xs) * cell, y0 = Math.min(...ys) * cell, x1 = (Math.max(...xs) + 1) * cell, y1 = (Math.max(...ys) + 1) * cell;
      const g = cell * 0.16, L = cell * 0.5, dg = L * 0.7, mx = (x0 + x1) / 2, my2 = (y0 + y1) / 2;
      const ln = (a, b2, c, d2) => `<line x1="${a.toFixed(1)}" y1="${b2.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d2.toFixed(1)}"/>`;
      lastSvg += `<g class="bk-focus" stroke="#C07F13" stroke-width="${Math.max(2, cell * 0.09)}" stroke-linecap="round">` +
        ln(x0 - g, y0 - g, x0 - g - dg, y0 - g - dg) + ln(x1 + g, y0 - g, x1 + g + dg, y0 - g - dg) +
        ln(x1 + g, y1 + g, x1 + g + dg, y1 + g + dg) + ln(x0 - g, y1 + g, x0 - g - dg, y1 + g + dg) +
        ln(mx, y0 - g, mx, y0 - g - L) + ln(mx, y1 + g, mx, y1 + g + L) +
        ln(x0 - g, my2, x0 - g - L, my2) + ln(x1 + g, my2, x1 + g + L, my2) + '</g>';
    }
  }
  // ゴースト(選択中ピースの置ける場所)
  let ghostSvg = '';
  if (NC && myTurn && selPiece != null && byPiece.get(selPiece) && byPiece.get(selPiece).get(selOri)) {
    const oris = NC.orientationsFor(selPiece);
    const shape = oris[selOri] || oris[0];
    for (const pl of byPiece.get(selPiece).get(selOri)) {
      ghostSvg += `<g data-m="${pl.move}" class="bk-ghost" tabindex="-1">${shape.map(([dx, dy]) =>
        `<rect x="${((pl.x + dx) * cell + 1).toFixed(1)}" y="${((pl.y + dy) * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="${BK_COLORS[myColor]}" fill-opacity=".38" stroke="${BK_COLORS[myColor]}" stroke-width="1.6"/>`).join('')}</g>`;
    }
  }
  const gridLines = `<path class="bk-gridlines" d="${Array.from({ length: size + 1 }, (_, i) => `M${(i * cell).toFixed(1)} 0V${boardPx}M0 ${(i * cell).toFixed(1)}H${boardPx}`).join('')}" stroke="#D5C8A6" stroke-width="1"/>`;
  // 相手の手番: CPUカーソルが「置く先」だけを指せるよう、合法手の置き場所に透明な目印を置く(ピース選びは見せない)
  let aimSvg = '';
  if (NC && !myTurn && !b.finished && A.view.legal) {
    for (const m of A.view.legal) {
      if (m === NC.BLOKUS_MOVE_PASS) continue;
      const d = NC.decodeBlokusMove(m, size);
      const oris = NC.orientationsFor(d.pieceIdx);
      const shape = oris[d.oriIdx] || oris[0];
      aimSvg += `<g data-m="${m}" class="bk-aim">${shape.map(([dx, dy]) => `<rect x="${((d.x + dx) * cell + 1).toFixed(1)}" y="${((d.y + dy) * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}"/>`).join('')}</g>`;
    }
  }
  const gridSvg = `<svg class="bk-svg" viewBox="0 0 ${boardPx} ${boardPx}" width="${boardPx}" height="${boardPx}"><rect class="bk-bgrect" width="${boardPx}" height="${boardPx}" fill="#EFE7D2"/>${gridLines}${cellsSvg}${cornerSvg}${lastSvg}${ghostSvg}${aimSvg}</svg>`;
  let html = `<div class="nine-table bk-table pc"></div>`;
  html += `<div class="bk-clip">${at(bx + boardPx / 2, by + boardPx / 2, `<div class="bk-board" style="transform:translate(${bkZoom.x}px,${bkZoom.y}px) scale(${bkZoom.z})">${gridSvg}</div>`)}</div>`;
  // トレイ
  if (NC && b.me >= 0 && !b.finished) {
    const shownColor = myTurn ? myColor : trayColor;
    const oris0 = (p) => NC.orientationsFor(p)[0];
    const pieceIcon = (p, cs) => {
      const shape = oris0(p);
      const w = Math.max(...shape.map((c) => c[0])) + 1, h = Math.max(...shape.map((c) => c[1])) + 1;
      const ox = (5 - w) / 2 * cs, oy = (5 - h) / 2 * cs;
      return `<svg viewBox="0 0 ${5 * cs} ${5 * cs}" width="${5 * cs}" height="${5 * cs}">${shape.map(([x, y]) => `<rect x="${ox + x * cs + .5}" y="${oy + y * cs + .5}" width="${cs - 1}" height="${cs - 1}" rx="2" fill="${BK_COLORS[shownColor]}"/>`).join('')}</svg>`;
    };
    const tray = remaining.map((p) => {
      const can = byPiece.has(p);
      const inner = pieceIcon(p, mob ? 6 : 8);
      return myTurn ? control(inner, `data-bkpiece="${p}"`, `ピース ${p + 1}${can ? '' : '(置けません)'}`, true, `bk-piece${p === selPiece ? ' sel' : ''}${can ? '' : ' cannot'}`)
        : `<span class="bk-piece">${inner}</span>`;
    }).join('');
    if (mob) html += at(280, 664, `<div class="bk-tray mob"><div class="bk-tray-head">${BK_NAMES[shownColor]}のピース 残り ${remaining.length} / 21</div><div class="bk-pieces">${tray}</div></div>`);
    else html += at(692, 306, `<div class="bk-tray"><div class="bk-tray-head">${BK_NAMES[shownColor]}のピース 残り ${remaining.length} / 21</div><div class="bk-pieces">${tray}</div></div>`);
  }
  // 右の空きスペースに、全員の残りマス数を大きな数字で出す(少ない方が有利。リードしている色が分かるようにする)
  if (!mob && b.remainingCells && b.seatOfColor) {
    const minRem = Math.min(...b.remainingCells.slice(0, b.colorCount));
    const standCells = Array.from({ length: b.colorCount }, (_, c) => {
      const lead = b.remainingCells[c] === minRem;
      return `<div class="bk-stand-cell${lead ? ' lead' : ''}"><span class="bk-stand-chip" style="background:${BK_COLORS[c]}"></span><span class="bk-stand-who">${esc(A.name(b.seatOfColor[c]))}（${BK_NAMES[c]}）</span><b class="bk-stand-num">${b.remainingCells[c]}<small>マス</small></b>${lead ? '<span class="bk-stand-tag">リード</span>' : ''}</div>`;
    }).join('');
    html += at(692, 499, `<div class="bk-stand"><div class="bk-stand-head">残りマス（少ない方が有利）</div><div class="bk-stand-grid">${standCells}</div></div>`);
  }
  if (b.lastAction && b.lastAction.type === 'pass') html += at(mob ? 280 : 450, mob ? 20 : 26, note(`${A.name(b.lastAction.seat)} は置ける場所がなくパス`));
  if (!NC) setTimeout(() => { if (document.querySelector('.nine-scene[data-game="blokus"]')) drawPlay(true); }, 350);
  // スマホでは内容に合わせて場面を低くし、その分だけ盤を大きく見せる
  if (mob) nineSizeOverride = { w: 560, h: 760 };
  stage(A, b, html, (d, el) => {
    if (Date.now() - bkDraggedAt < 300) return;
    if (d.bkpiece != null && myTurn) {
      const p = Number(d.bkpiece);
      if (p === selPiece && byPiece.get(p)) {
        const oris = [...byPiece.get(p).keys()].sort((a, z) => a - z);
        const next = oris[(oris.indexOf(selOri) + 1) % oris.length];
        A.sel = { kind: 'blokus', moves: A.view.moves, piece: p, ori: next };
      } else A.sel = { kind: 'blokus', moves: A.view.moves, piece: p, ori: byPiece.get(p) ? Math.min(...byPiece.get(p).keys()) : 0 };
      A.redraw();
      return;
    }
    tapMove(A)(d);
  });
  nineSizeOverride = null;
  // スマホ: 盤の中身だけをピンチで拡縮し、拡大中はドラッグで移動する(タップと区別するため、動いた場合はクリックを無効化)
  if (mob) {
    const boardEl = document.querySelector('.bk-board');
    const sceneEl = document.querySelector('.nine-scene');
    if (boardEl && sceneEl) {
      boardEl.style.touchAction = 'none';
      const SW2 = +sceneEl.dataset.w || 560, SH2 = +sceneEl.dataset.h || 880;
      const O = { x: bx + boardPx / 2, y: by + boardPx / 2 }; // 盤の中心(場面座標)
      const toScene = (cx, cy) => {
        const r = sceneEl.getBoundingClientRect();
        return { x: (cx - r.left) / r.width * SW2, y: (cy - r.top) / r.height * SH2 };
      };
      const apply = (z, tx, ty) => { boardEl.style.transform = `translate(${tx}px,${ty}px) scale(${z})`; };
      const clampT = (z, tx, ty) => {
        const lim = boardPx * (z - 1) / 2 + 60;
        return [clamp(tx, -lim, lim), clamp(ty, -lim, lim)];
      };
      const ptrs = new Map();
      let pan = null, pinch = null;
      boardEl.addEventListener('pointerdown', (e) => {
        try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* 対応環境のみ */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) {
          pan = { sx: e.clientX, sy: e.clientY, ox: bkZoom.x, oy: bkZoom.y, moved: false };
          pinch = null;
        } else if (ptrs.size === 2) {
          const [p1, p2] = [...ptrs.values()];
          const mid = toScene((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
          const z0 = bkZoom.z;
          const lp = { x: boardPx / 2 + (mid.x - O.x - bkZoom.x) / z0, y: boardPx / 2 + (mid.y - O.y - bkZoom.y) / z0 };
          pinch = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, z0, lp };
          pan = null;
          bkDraggedAt = Date.now();
        }
      });
      boardEl.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && ptrs.size === 2) {
          const [p1, p2] = [...ptrs.values()];
          const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const z = clamp(pinch.z0 * d / pinch.d0, 1, 2.6);
          const mid = toScene((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
          let tx = mid.x - O.x - z * (pinch.lp.x - boardPx / 2);
          let ty = mid.y - O.y - z * (pinch.lp.y - boardPx / 2);
          if (z <= 1.001) { tx = 0; ty = 0; }
          [tx, ty] = clampT(z, tx, ty);
          bkZoom = { z, x: tx, y: ty, handle: A.handle };
          apply(z, tx, ty);
          bkDraggedAt = Date.now();
        } else if (pan && bkZoom.z > 1) {
          const r = sceneEl.getBoundingClientRect();
          const dx = (e.clientX - pan.sx) / r.width * SW2;
          const dy = (e.clientY - pan.sy) / r.height * SH2;
          if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 7) pan.moved = true;
          if (pan.moved) {
            let tx = pan.ox + dx, ty = pan.oy + dy;
            [tx, ty] = clampT(bkZoom.z, tx, ty);
            bkZoom = { z: bkZoom.z, x: tx, y: ty, handle: A.handle };
            apply(bkZoom.z, tx, ty);
          }
        }
      });
      const endPtr = (e) => {
        const wasPinch = !!pinch;
        ptrs.delete(e.pointerId);
        if (pan && pan.moved) bkDraggedAt = Date.now();
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 1) {
          const [p1] = [...ptrs.values()];
          pan = { sx: p1.x, sy: p1.y, ox: bkZoom.x, oy: bkZoom.y, moved: wasPinch };
        }
        if (ptrs.size === 0) pan = null;
      };
      boardEl.addEventListener('pointerup', endPtr);
      boardEl.addEventListener('pointercancel', endPtr);
    }
  }
  // 自分の置けるブロックがなくなったら、対局に1回だけカットインで知らせる
  if (NC && myTurn && A.canPlay && remaining.length > 0 && byPiece.size === 0 && !b.finished) {
    if (ninePrev && ninePrev.bkStuckCut !== A.handle) {
      ninePrev.bkStuckCut = A.handle;
      A.cut({ text: '置けるブロックがありません', sub: 'この手番はパスしてください', tone: 'red', font: 'mo', ms: 1900 });
    }
  }
  const acts = [];
  if (NC) {
    // ボタンは消さずに常時表示し、使えない時はグレーアウトする
    const canRotate = selPiece != null && byPiece.get(selPiece) && byPiece.get(selPiece).size > 1;
    acts.push({ label: '向きを変える', fn: () => {
      if (!canRotate) return;
      const oris = [...byPiece.get(selPiece).keys()].sort((a, z) => a - z);
      A.sel = { kind: 'blokus', moves: A.view.moves, piece: selPiece, ori: oris[(oris.indexOf(selOri) + 1) % oris.length] };
      A.redraw();
    }, enabled: A.canPlay && myTurn && !!canRotate });
    acts.push({ label: 'パス', move: NC.BLOKUS_MOVE_PASS, cls: 'gold', enabled: A.canPlay && myTurn && A.legal.has(NC.BLOKUS_MOVE_PASS) });
  }
  // ゲームパッドのキーコンフィグ用: 選択中ピースの「反転」(左右鏡像の向きへ切り替える)
  if (NC && myTurn && selPiece != null && byPiece.get(selPiece)) {
    window.__bkPadFlip = () => {
      const oris = NC.orientationsFor(selPiece);
      const curShape = oris[selOri];
      if (!curShape) return;
      const norm = (sh) => { const mx = Math.min(...sh.map((c) => c[0])), my = Math.min(...sh.map((c) => c[1])); return sh.map(([x, y]) => (x - mx) + ',' + (y - my)).sort().join('|'); };
      const mir = norm(curShape.map(([x, y]) => [-x, y]));
      const target = [...byPiece.get(selPiece).keys()].find((o) => norm(oris[o]) === mir);
      if (target != null && target !== selOri) { A.sel = { kind: 'blokus', moves: A.view.moves, piece: selPiece, ori: target }; A.redraw(); }
    };
  } else window.__bkPadFlip = null;
  A.acts(acts);
}
window.RENDER.blokus = renderBlokus;

// ================================================================ コリドール
const QD_COLORS = ['#D8402E', '#2E6BD8', '#2FA84F', '#E8A90C'];
function renderQuoridor(b, A) {
  prep(A);
  const me = b.me >= 0 ? b.me : 0;
  // 自分の開始辺が下に来るよう盤を回す(セル座標の変換)
  const rot = me;
  const tf = (x, y) => rot === 1 ? [8 - x, 8 - y] : rot === 2 ? [y, 8 - x] : rot === 3 ? [8 - y, x] : [x, y];
  const tfC = (x, y) => rot === 1 ? [9 - x, 9 - y] : rot === 2 ? [y, 9 - x] : rot === 3 ? [9 - y, x] : [x, y];
  strip(A, b, (i) => `壁 あと ${b.wallsLeft[i]} 枚`);
  A.round('');
  A.side(`<div class="kv"><span>手番</span><b>${esc(A.name(b.turn))}</b></div>`);
  const mob = isMob();
  const cell = mob ? 46 : 42, groove = mob ? 11 : 10;
  const step = cell + groove;
  const boardPx = 9 * cell + 8 * groove;
  const bx = mob ? 280 - boardPx / 2 : 450 - boardPx / 2, by = mob ? 420 - boardPx / 2 : 282 - boardPx / 2;
  const px = (dx) => bx + dx * step, py = (dy) => by + dy * step;
  let svg = `<defs><linearGradient id="qdframe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#96682F"/><stop offset=".7" stop-color="#74491D"/><stop offset="1" stop-color="#654017"/></linearGradient></defs><rect x="${bx - 13}" y="${by - 13}" width="${boardPx + 26}" height="${boardPx + 26}" rx="16" fill="url(#qdframe)"/><rect x="${bx - 3}" y="${by - 3}" width="${boardPx + 6}" height="${boardPx + 6}" rx="6" fill="#9C6B32"/>`;
  // ゴール辺(角座標→ピクセル変換つき)
  const cPx = (c) => c * step - (c === 9 ? groove : 0);
  const goalEdges = [[[0, 0], [9, 0]], [[0, 9], [9, 9]], [[9, 0], [9, 9]], [[0, 0], [0, 9]]];
  goalEdges.forEach(([c1, c2], s) => {
    if (s >= b.n) return;
    const [ax, ay] = tfC(c1[0], c1[1]), [cx2, cy2] = tfC(c2[0], c2[1]);
    const horiz = ay === cy2;
    const off = horiz ? [0, ay === 0 ? -5 : 5] : [ax === 0 ? -5 : 5, 0];
    svg += `<line x1="${bx + cPx(ax) + off[0]}" y1="${by + cPx(ay) + off[1]}" x2="${bx + cPx(cx2) + off[0]}" y2="${by + cPx(cy2) + off[1]}" stroke="${QD_COLORS[s]}" stroke-width="7" stroke-linecap="round"/>`;
  });
  // マス
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const [dx, dy] = tf(x, y);
    svg += `<rect x="${px(dx)}" y="${py(dy)}" width="${cell}" height="${cell}" rx="7" fill="${(dx + dy) % 2 ? '#E0BA74' : '#ECCF97'}"/>`;
  }
  // 壁
  const wallRect = (x, y, vertical, cls, extra = '') => {
    // 壁は角座標の線分として変換する
    const c1 = vertical ? [x + 1, y] : [x, y + 1];
    const c2 = vertical ? [x + 1, y + 2] : [x + 2, y + 1];
    const [ax, ay] = tfC(c1[0], c1[1]), [bx2, by2] = tfC(c2[0], c2[1]);
    const horiz = ay === by2;
    const len = 2 * cell + groove;
    return `<rect x="${horiz ? bx + Math.min(ax, bx2) * step : bx + ax * step - groove / 2 - 1}" y="${horiz ? by + ay * step - groove / 2 - 1 : by + Math.min(ay, by2) * step}" width="${horiz ? len : groove + 2}" height="${horiz ? groove + 2 : len}" rx="5" class="${cls}" ${extra}/>`;
  };
  for (const w of b.hWalls) svg += wallRect(w.x, w.y, false, 'qd-wall');
  for (const w of b.vWalls) svg += wallRect(w.x, w.y, true, 'qd-wall');
  if (b.lastAction && b.lastAction.type === 'wall') {
    svg += wallRect(b.lastAction.x, b.lastAction.y, b.lastAction.vertical, 'qd-wall last');
  }
  // 壁の置き場(当たり判定): 溝の交点に目印を出し、広めの判定で押せるようにする
  let hitSvg = '';
  if (A.canPlay && b.turn === b.me && b.wallsLeft[b.me] > 0) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const [dx, dy] = tf(x, y);
      hitSvg += `<circle cx="${px(dx) + cell + groove / 2}" cy="${py(dy) + cell + groove / 2}" r="3" class="qd-hitdot"/>`;
      hitSvg += `<rect x="${px(dx) + cell - 9}" y="${py(dy) + cell - 9}" width="${groove + 18}" height="${groove + 18}" fill="transparent" data-qdhit="${x},${y}" class="qd-hit"/>`;
    }
  }
  // ゴースト壁
  const selOk = A.sel && A.sel.kind === 'quoridor' && A.sel.moves === A.view.moves;
  const ghost = selOk ? A.sel.wall : null;
  const pawnSel = selOk && !!A.sel.pawn;
  let ghostSvg = '';
  if (ghost) {
    const mv = 100 + (ghost.y * 8 + ghost.x) * 2 + (ghost.vertical ? 1 : 0);
    ghostSvg = wallRect(ghost.x, ghost.y, ghost.vertical, `qd-ghost${A.legal.has(mv) ? '' : ' ng'}`, `data-qdhit="${ghost.x},${ghost.y}"`);
  }
  // 移動候補(自分のコマを選んだ時だけ出す。当たり判定はマス全体)
  let destSvg = '';
  if (A.canPlay && b.turn === b.me && pawnSel) {
    for (const m of A.legal) {
      if (m >= 100) continue;
      const [dx, dy] = tf(m % 9, Math.floor(m / 9));
      const isJump = Math.abs(dx - tf(b.pawns[b.me].x, b.pawns[b.me].y)[0]) + Math.abs(dy - tf(b.pawns[b.me].x, b.pawns[b.me].y)[1]) > 1;
      destSvg += `<rect x="${px(dx)}" y="${py(dy)}" width="${cell}" height="${cell}" fill="transparent" data-m="${m}" class="qd-desthit"/>`;
      destSvg += isJump
        ? `<circle cx="${px(dx) + cell / 2}" cy="${py(dy) + cell / 2}" r="${cell * .30}" fill="none" stroke="#7A4A12" stroke-width="3.4" class="qd-dest"/>`
        : `<circle cx="${px(dx) + cell / 2}" cy="${py(dy) + cell / 2}" r="${cell * .17}" fill="#7A4A12" fill-opacity=".55" class="qd-dest"/>`;
    }
  }
  // 相手の手番: CPUカーソルが「コマ→行き先」を指せるよう、合法手の行き先に透明な目印を置く
  let aimSvg = '';
  if (!A.view.outcome && b.turn !== b.me && A.view.legal) {
    for (const m of A.view.legal) {
      if (m < 100) {
        const [dx, dy] = tf(m % 9, Math.floor(m / 9));
        aimSvg += `<circle cx="${px(dx) + cell / 2}" cy="${py(dy) + cell / 2}" r="${cell * .3}" class="qd-aim" data-m="${m}"/>`;
      } else {
        const wv = m - 100, vi = wv % 2, wi = (wv - vi) / 2;
        aimSvg += wallRect(wi % 8, Math.floor(wi / 8), vi === 1, 'qd-aim', `data-m="${m}"`);
      }
    }
  }
  // コマ(移動アニメーションは前回の盤面状態から計算する)
  let pawnsHtml = '';
  b.pawns.forEach((p, s) => {
    const [dx, dy] = tf(p.x, p.y);
    const mine = s === b.me && A.canPlay && b.turn === b.me;
    pawnsHtml += at(px(dx) + cell / 2, py(dy) + cell / 2, `<span class="qd-pawn${mine ? ' me' : ''}${pawnSel && s === b.me ? ' sel' : ''}" data-qpawn="${s}" style="--pc:${QD_COLORS[s]};--ps:${cell * .78}px"></span>`);
  });
  // 壁の残数帯(上=相手、下=自分)
  const stock = (seat, horizontal) => {
    const bars = Array.from({ length: b.wallsLeft[seat] }, () => `<span class="qd-stock-bar${horizontal ? '' : ' v'}"></span>`).join('');
    return `<div class="qd-stock"><span class="qd-stock-dot" style="background:${QD_COLORS[seat]}"></span>${bars}</div>`;
  };
  let html = `<div class="nine-table qd-table"></div>`;
  const SW = mob ? 560 : 900, SH = mob ? 880 : 560;
  html += at(SW / 2, SH / 2, `<svg class="qd-svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}">${svg}${hitSvg}${ghostSvg}${destSvg}${aimSvg}</svg>`);
  html += pawnsHtml;
  html += at(mob ? 280 : 450, (mob ? 420 : 282) - boardPx / 2 - 24, stock((me + 1) % b.n, true));
  html += at(mob ? 280 : 450, (mob ? 420 : 282) + boardPx / 2 + 24, stock(me, true));
  if (b.n >= 3) html += at((mob ? 280 : 450) - boardPx / 2 - 30, mob ? 420 : 282, `<div class="qd-stock side">${stock((me + 2) % b.n, false)}</div>`);
  if (b.n >= 4) html += at((mob ? 280 : 450) + boardPx / 2 + 30, mob ? 420 : 282, `<div class="qd-stock side">${stock((me + 3) % b.n, false)}</div>`);
  stage(A, b, html, (d) => {
    // 自分のコマをタップ: 黄色い枠で選んでから、行き先をタップして動かす
    if (d.qpawn != null && +d.qpawn === b.me && A.canPlay && b.turn === b.me) {
      A.sel = pawnSel ? null : { kind: 'quoridor', moves: A.view.moves, pawn: true };
      A.sfx('TILE', 0, { volume: .35 });
      A.redraw();
      return;
    }
    if (d.qdhit && A.canPlay) {
      const [x, y] = d.qdhit.split(',').map(Number);
      const cur = selOk && A.sel.wall;
      // 同じ交点をもう一度タップしたら向きを変える
      const vertical = cur && cur.x === x && cur.y === y ? !cur.vertical : false;
      A.sel = { kind: 'quoridor', moves: A.view.moves, wall: { x, y, vertical } };
      A.sfx('TILE', 0, { volume: .4 });
      A.redraw();
      return;
    }
    // コマ選択中に何もない所をタップしたら選択を外す
    if (d.m == null && pawnSel) { A.sel = null; A.redraw(); return; }
    tapMove(A)(d);
  }, (wrap, prev) => {
    // コマの移動は、前回の盤面での位置から滑らかに動かす(自分の手もCPUの手も同じ)
    if (!prev.board || !prev.board.pawns) return;
    b.pawns.forEach((p, s) => {
      const q0 = prev.board.pawns[s];
      if (!q0 || (q0.x === p.x && q0.y === p.y)) return;
      const el = wrap.querySelector(`[data-qpawn="${s}"]`);
      if (!el) return;
      const [ax, ay] = tf(q0.x, q0.y), [cx3, cy3] = tf(p.x, p.y);
      const dx = (ax - cx3) * step, dy = (ay - cy3) * step;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 380 * (A.speed || 1), easing: 'cubic-bezier(.2,.9,.3,1)' });
      A.land(150); A.anim(400);
    });
  });
  // ボタンは消さずに常時表示し、使えない時はグレーアウトする
  const acts = [];
  const qMyTurn = A.canPlay && b.turn === b.me;
  const mv = ghost ? 100 + (ghost.y * 8 + ghost.x) * 2 + (ghost.vertical ? 1 : 0) : -1;
  acts.push({ label: '向きを変える', fn: () => { if (!ghost) return; A.sel = { kind: 'quoridor', moves: A.view.moves, wall: { x: ghost.x, y: ghost.y, vertical: !ghost.vertical } }; A.redraw(); }, enabled: qMyTurn && !!ghost });
  acts.push({ label: '壁を置く', move: mv, cls: 'gold', enabled: qMyTurn && !!ghost && A.legal.has(mv) });
  A.acts(acts);
}
window.RENDER.quoridor = renderQuoridor;

// ================================================================ バトルシップ
const BS_NAMES = ['戦艦', '巡洋艦', '駆逐艦', '駆逐艦', '潜水艦'];
const BS_FLEET = [5, 4, 3, 3, 2];
function bsCellsLocal(shipIdx, dir, x, y) {
  const len = BS_FLEET[shipIdx], cells = [];
  for (let i = 0; i < len; i++) {
    const cx = dir === 0 ? x + i : x, cy = dir === 0 ? y : y + i;
    if (cx < 0 || cx > 9 || cy < 0 || cy > 9) return [];
    cells.push(cy * 10 + cx);
  }
  return cells;
}
// ---- 艦の絵(真上から見たシルエット)。ローカル座標: x=0..len*cell(艦尾→艦首), y=0..cell。
// detail=true の時は砲身や艦橋の上段まで描く(マスが大きい盤用)。
function bsShipArt(len, idx, c, sunk, detail, fillRef) {
  const T = len * c, cy = c / 2;
  const slim = idx === 4; // 潜水艦は細い
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
const bsHullPath = (len, idx, c) => bsShipArt(len, idx, c, false, false, 'none').match(/<path d="([^"]*)"/)[1];
const BS_DEFS = (id) => `
<linearGradient id="bsHull${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9BFD2"/><stop offset=".5" stop-color="#5F7A90"/><stop offset="1" stop-color="#3D5A72"/></linearGradient>
<linearGradient id="bsWreck${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d5552"/><stop offset=".5" stop-color="#3e3734"/><stop offset="1" stop-color="#2a2422"/></linearGradient>
<linearGradient id="bsSea${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f5d86"/><stop offset=".55" stop-color="#174a70"/><stop offset="1" stop-color="#0f3555"/></linearGradient>
<radialGradient id="bsSeaL${id}" cx=".3" cy=".15" r=".9"><stop offset="0" stop-color="#7fc4ea" stop-opacity=".22"/><stop offset="1" stop-color="#7fc4ea" stop-opacity="0"/></radialGradient>
<pattern id="bsWave${id}" width="64" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 Q8 8 16 13 T32 13 T48 13 T64 13" fill="none" stroke="#bfe3ff" stroke-opacity=".07" stroke-width="1.2"/><path d="M-16 0 Q-8 -5 0 0 T16 0 T32 0 T48 0 T64 0" fill="none" stroke="#bfe3ff" stroke-opacity=".05" stroke-width="1"/></pattern>
<radialGradient id="bsScorch${id}"><stop offset="0" stop-color="#120a06" stop-opacity=".75"/><stop offset="1" stop-color="#120a06" stop-opacity="0"/></radialGradient>
<radialGradient id="bsPeg${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3eaef"/><stop offset="1" stop-color="#a9b8c3"/></radialGradient>
<radialGradient id="bsRPeg${id}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ff8c7a"/><stop offset=".55" stop-color="#d8342c"/><stop offset="1" stop-color="#8e1914"/></radialGradient>`;
// 盤に残る火(平らな 3 色。演出の火の 1 コマ目と同じ形)
function bsFlame(x, y, c) {
  const k = c / 38;
  const fl = (w, h, col, dx) => { const t = -h * k, l = -w * k / 2, rr = w * k / 2; return `<path d="M${x + l + dx} ${y + 2 * k} Q${x + l - 2 * k + dx} ${y + t * .45} ${x + dx} ${y + t} Q${x + rr * .3 + dx} ${y + t * .55} ${x + rr * .55 + dx} ${y + t * .6} Q${x + rr + 2 * k + dx} ${y + t * .3} ${x + rr + dx} ${y + 2 * k}Z" fill="${col}"/>`; };
  return `<ellipse cx="${x}" cy="${y + 3 * k}" rx="${11 * k}" ry="${5 * k}" fill="#1a0f0a" opacity=".55"/>` + fl(18, 24, '#d9431a', 0) + fl(13, 17, '#ff8a1e', .6 * k) + fl(7, 10, '#ffd23f', -.4 * k) +
    `<ellipse cx="${x + 5 * k}" cy="${y - 28 * k}" rx="${6 * k}" ry="${4.5 * k}" fill="#4a4440" opacity=".8"/>`;
}
// 印: 外れ=白いピン+波紋、命中=焦げ跡+赤いピン+火
function bsMark(st, cx, cy, c, id) {
  if (st === 'miss') return `<circle cx="${cx}" cy="${cy}" r="${c * 0.34}" fill="none" stroke="#e8f6ff" stroke-opacity=".22" stroke-width="1.2"/><circle cx="${cx + 1}" cy="${cy + 1.5}" r="${c * 0.15}" fill="#06223a" opacity=".45"/><circle cx="${cx}" cy="${cy}" r="${c * 0.15}" fill="url(#bsPeg${id})"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${c * 0.48}" fill="url(#bsScorch${id})"/>` + bsFlame(cx, cy, c) +
    `<circle cx="${cx + 1}" cy="${cy + 1.5}" r="${c * 0.15}" fill="#1a0705" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="${c * 0.15}" fill="url(#bsRPeg${id})"/>`;
}
// 沈んだ艦: 黒ずんだ船体が少し傾き、海の色をかぶり、まわりに油が浮く(演出の最後と同じ姿)
function bsWreck(len, idx, c, id, horiz) {
  const w = horiz ? len * c : c, h = horiz ? c : len * c;
  const art = bsShipArt(len, idx, c, true, c >= 26, `url(#bsWreck${id})`);
  const inner = horiz ? art : `<g transform="translate(${c} 0) rotate(90)">${art}</g>`;
  const hull = bsHullPath(len, idx, c);
  const hullT = horiz ? '' : `translate(${c} 0) rotate(90)`;
  return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * .56}" ry="${h * .56}" fill="#08141c" opacity=".38"/>` +
    `<g transform="rotate(${horiz ? 4 : -4} ${w / 2} ${h / 2})">${inner}<g transform="${hullT}"><path d="${hull}" fill="#164466" opacity=".55"/></g></g>`;
}
const bsShipGeom = (cells) => {
  const xs = cells.map((k) => k % 10), ys = cells.map((k) => Math.floor(k / 10));
  return { horiz: ys[0] === ys[ys.length - 1], x0: Math.min(...xs), y0: Math.min(...ys), len: cells.length };
};
// 盤(10×10)。o: { id, x, y, cell, labels, ships:[{index,cells,sunk}], board(状態の配列), target, ghost, tap, hide:Set(描かないマス), hideShip }
function bsBoardSvg(o) {
  const c = o.cell, X = (k) => (k % 10) * c, Y = (k) => Math.floor(k / 10) * c, S = c * 10;
  const lp = o.labels ? Math.round(c * 0.6) : 0;
  let s = `<svg class="bs-svg" style="position:absolute;left:${o.x - lp}px;top:${o.y - lp}px;overflow:visible" width="${S + lp}" height="${S + lp}" viewBox="${-lp} ${-lp} ${S + lp} ${S + lp}"><defs>${BS_DEFS(o.id)}</defs>`;
  s += `<rect x="-5" y="-5" width="${S + 10}" height="${S + 10}" rx="7" fill="#11171c" stroke="#ffffff14"/>`;
  s += `<rect width="${S}" height="${S}" rx="3" fill="url(#bsSea${o.id})"/><rect width="${S}" height="${S}" rx="3" fill="url(#bsWave${o.id})"/><rect width="${S}" height="${S}" rx="3" fill="url(#bsSeaL${o.id})"/>`;
  if (o.labels) {
    const fs = Math.round(c * 0.42);
    for (let i = 0; i < 10; i++) {
      s += `<text class="bs-coord" x="${i * c + c / 2}" y="${-lp * 0.32}" text-anchor="middle" font-size="${fs}">${'ABCDEFGHIJ'[i]}</text>`;
      s += `<text class="bs-coord" x="${-lp * 0.42}" y="${i * c + c * 0.66}" text-anchor="middle" font-size="${fs}">${i + 1}</text>`;
    }
  }
  let gl = '';
  for (let i = 1; i < 10; i++) gl += `M${i * c} 0V${S}M0 ${i * c}H${S}`;
  s += `<path d="${gl}" stroke="#d6efff" stroke-opacity=".11" stroke-width="1"/>`;
  if (o.target != null && o.target >= 0) s += `<rect y="${Y(o.target)}" width="${S}" height="${c}" fill="#ffd37a" opacity=".07"/><rect x="${X(o.target)}" width="${c}" height="${S}" fill="#ffd37a" opacity=".07"/>`;
  const sunkCells = new Set(), hide = new Set(o.hide || []);
  for (const sh of o.ships || []) {
    if (!sh.cells || !sh.cells.length) continue;
    if (sh.index === o.hideShip) { sh.cells.forEach((k) => hide.add(k)); continue; }
    const g = bsShipGeom(sh.cells);
    const idx = (typeof sh.index === 'number') ? sh.index : Math.max(0, BS_FLEET.indexOf(g.len));
    if (sh.sunk) { sh.cells.forEach((k) => sunkCells.add(k)); s += `<g transform="translate(${g.x0 * c} ${g.y0 * c})">${bsWreck(g.len, idx, c, o.id, g.horiz)}</g>`; continue; }
    const art = bsShipArt(g.len, idx, c, false, c >= 26, `url(#bsHull${o.id})`);
    s += `<g transform="${g.horiz ? `translate(${g.x0 * c} ${g.y0 * c})` : `translate(${g.x0 * c + c} ${g.y0 * c}) rotate(90)`}">${art}</g>`;
  }
  for (let k = 0; k < 100; k++) {
    const st = o.board ? o.board[k] : 'unknown';
    if ((st !== 'miss' && st !== 'hit') || hide.has(k) || sunkCells.has(k)) continue;
    s += bsMark(st, X(k) + c / 2, Y(k) + c / 2, c, o.id);
  }
  if (o.ghost) {
    const col = o.ghost.ok ? '#5fe08d' : '#ff6b6b';
    const g = bsShipGeom(o.ghost.cells.length ? o.ghost.cells : [o.ghost.anchor]);
    const len = BS_FLEET[o.ghost.ship], horiz = o.ghost.dir === 0;
    const w = horiz ? len * c : c, h = horiz ? c : len * c;
    s += `<rect x="${g.x0 * c + 1.5}" y="${g.y0 * c + 1.5}" width="${w - 3}" height="${h - 3}" rx="6" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="2" stroke-dasharray="6 4"/>`;
    s += `<g opacity=".72" transform="${horiz ? `translate(${g.x0 * c} ${g.y0 * c})` : `translate(${g.x0 * c + c} ${g.y0 * c}) rotate(90)`}">${bsShipArt(len, o.ghost.ship, c, false, true, `url(#bsHull${o.id})`)}</g>`;
  }
  if (o.target != null && o.target >= 0) {
    const x = X(o.target), y = Y(o.target), k = c * 0.28, p = -2;
    const br = (ax, ay, dx, dy) => `M${ax + dx * k} ${ay}H${ax}V${ay + dy * k}`;
    s += `<path class="bs-aim" d="${br(x - p, y - p, 1, 1)}${br(x + c + p, y - p, -1, 1)}${br(x - p, y + c + p, 1, -1)}${br(x + c + p, y + c + p, -1, -1)}" fill="none" stroke="#ffcf4a" stroke-width="3" stroke-linecap="round"/><circle cx="${x + c / 2}" cy="${y + c / 2}" r="2.6" fill="#ffcf4a"/>`;
  }
  if (o.tap) {
    for (let k = 0; k < 100; k++) {
      if (o.tap === 'unknown' && o.board && o.board[k] !== 'unknown') continue;
      s += `<rect x="${X(k)}" y="${Y(k)}" width="${c}" height="${c}" fill="transparent" data-bscell="${k}" class="bs-cell"/>`;
    }
  }
  return s + '</svg>';
}
// 艦隊の小さな絵(状態を形で見せる): unknown=点線の輪郭 / ok / dmg(被弾マス) / sunk
function bsShipIcon(i, c, state, hits = [], cls = '') {
  const len = BS_FLEET[i], w = len * c, id = `i${i}${state}${c}`;
  let s = `<svg class="bs-shipicon ${cls}" width="${w}" height="${c}" viewBox="0 0 ${w} ${c}" style="overflow:visible"><defs>${BS_DEFS(id)}</defs>`;
  if (state === 'unknown') s += `<path d="${bsHullPath(len, i, c)}" fill="#ffffff08" stroke="#8ea2b2" stroke-width="1.2" stroke-dasharray="3 2.5"/>`;
  else {
    s += bsShipArt(len, i, c, state === 'sunk', c >= 26, `url(#${state === 'sunk' ? 'bsWreck' : 'bsHull'}${id})`);
    for (const h of hits) s += `<circle cx="${h * c + c / 2}" cy="${c / 2}" r="${c * 0.24}" fill="#d8342c" stroke="#ffd9cf" stroke-width="1"/>`;
    if (state === 'sunk') s += `<path d="M${c * 0.2} ${c * 0.85} L${w - c * 0.2} ${c * 0.15}" stroke="#d8342c" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return s + '</svg>';
}
const BS_ICO_SCOPE = `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="none" stroke="#c3cfd8" stroke-width="1.6"/><path d="M9 0.5V5M9 13V17.5M0.5 9H5M13 9H17.5" stroke="#c3cfd8" stroke-width="1.6"/></svg>`;
const BS_ICO_ANCHOR = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c3cfd8" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="3.4" r="1.9"/><path d="M9 5.3V16M5 8.2H13M2.6 11.2C3.4 14.2 6 16 9 16C12 16 14.6 14.2 15.4 11.2"/></svg>`;
const bsMouse = (btn) => `<svg width="16" height="22" viewBox="0 0 16 22"><rect x="1" y="1" width="14" height="20" rx="7" fill="none" stroke="#9fb0bd" stroke-width="1.5"/><path d="M8 1V9" stroke="#9fb0bd" stroke-width="1.5"/>${btn === 'L' ? '<path d="M1.8 8 V7 A6.2 6.2 0 0 1 7.3 1.8 V9 H1.8Z" fill="#ffcf4a"/>' : '<path d="M14.2 8 V7 A6.2 6.2 0 0 0 8.7 1.8 V9 H14.2Z" fill="#ffcf4a"/>'}</svg>`;

// ================================================================ バトルシップの演出(手描き風のコマ送り)
// 手描きエフェクトの定石に合わせる: 単純な形+平らな 2〜3 色、1 秒 12 コマのコマ送り、水は「上と外へ」、
// 消える時は薄くせず小さな塊に割れて消える、着水した所に平らな泡が残る。(見本: docs/mockups/battleship-v2/)
// 演出はすべて「1 マス 38px」で描き、盤のマスの大きさに合わせて入れ物ごと縮める。
const BS_FPS = 12, BS_FR = 1000 / BS_FPS, BSC = 38;
const BW1 = '#ffffff', BW2 = '#d6effc', BW3 = '#86c3e6', BWL = '#1d5f8a';
const BF1 = '#fff6d8', BF2 = '#ffd23f', BF3 = '#ff8a1e', BF4 = '#d9431a', BSM1 = '#4a4440', BSM2 = '#6e6762', BSM3 = '#8f8882';
const bsRng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
function bsBlob(cx, cy, rx, ry, jag, n, rnd) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 - jag / 2 + rnd() * jag; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], r = pts[(i + 1) % n], s2 = pts[(i + 2) % n];
    if (i === 0) d += `M${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
    d += ` Q${r[0].toFixed(1)} ${r[1].toFixed(1)} ${((r[0] + s2[0]) / 2).toFixed(1)} ${((r[1] + s2[1]) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}
function bsDrop(x, y, r, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const tip = [x + c * r * 1.6, y + s * r * 1.6], l = [x - s * r, y + c * r], rr = [x + s * r, y - c * r], back = [x - c * r, y - s * r];
  return `<path d="M${tip[0].toFixed(1)} ${tip[1].toFixed(1)} Q${rr[0].toFixed(1)} ${rr[1].toFixed(1)} ${back[0].toFixed(1)} ${back[1].toFixed(1)} Q${l[0].toFixed(1)} ${l[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Z" fill="${BW1}" stroke="${BWL}" stroke-width=".9" stroke-opacity=".55"/>`;
}
// 演出の入れ物(場面の座標 x,y を原点に、1 マス 38px の大きさで描けるよう縮める)
function bsFxBox(layer, x, y, c) {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:scale(${c / BSC});pointer-events:none`;
  layer.appendChild(d);
  return d;
}
function bsEl(parent, style, html = '') { const d = document.createElement('div'); d.style.cssText = 'position:absolute;opacity:0;' + style; d.innerHTML = html; parent.appendChild(d); return d; }
// コマ送り: frames(SVG の中身)を delay から 1 コマずつ出す(原点 0,0)
function bsFlip(box, frames, delay = 0, hold = 1, size = 300) {
  const n = frames.length, D = n * hold * BS_FR;
  frames.forEach((f, i) => {
    const d = bsEl(box, `left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px`, `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" style="overflow:visible;display:block">${f}</svg>`);
    const a = i / n, b = (i + 1) / n;
    const ks = a > 0 ? [{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: a, easing: 'step-end' }] : [{ opacity: 1, offset: 0, easing: 'step-end' }];
    ks.push({ opacity: 0, offset: b, easing: 'step-end' });
    if (b < 1) ks.push({ opacity: 0, offset: 1 });
    d.animate(ks, { duration: D, delay, fill: 'forwards' });
  });
  return D;
}
function bsStepMove(d, pts, delay) {
  const n = pts.length;
  d.animate(pts.map((p, i) => ({ transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)${p.r != null ? ` rotate(${p.r}deg)` : ''}`, offset: i / (n - 1), easing: 'step-end' })), { duration: (n - 1) * BS_FR, delay, fill: 'forwards' });
  d.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: .001, easing: 'step-end' }, { opacity: 1, offset: .999 }, { opacity: 0, offset: 1 }], { duration: (n - 1) * BS_FR, delay, fill: 'forwards' });
}
// 砲弾が落ちてくる影(3 コマ)
function bsIncoming(box) {
  return bsFlip(box, [26, 17, 10].map((r) => `<ellipse cx="0" cy="0" rx="${r}" ry="${r * .8}" fill="#04131f" opacity="${(.25 + (26 - r) / 40).toFixed(2)}"/>`), 0, 1, 80);
}
// ---- 水柱(外れ): ひとかたまりの白い水が、根元は細く上へ広がりながら伸び、てっぺんがちぎれて外へ、
//      両肩が垂れて崩れ、平らな泡が割れて小さくなり、波紋が外へ。最後に白いピン。
function bsColumnFrames(seed) {
  const fr = [], r = bsRng(seed);
  let clipN = 0;
  const LUMPS = Array.from({ length: 7 }, (_, i) => ({ h: .55 + r() * .6 + (i === 3 ? .5 : i === 2 || i === 4 ? .25 : 0), w: .8 + r() * .5 }));
  const outline = (H, Wb, Wt, lump, droop) => {
    const tw = Wt / 2, bw = Wb / 2;
    const shL = [-tw - droop * 10, -H * .78 + droop * 22], shR = [tw + droop * 10, -H * .78 + droop * 22];
    let d = `M${-bw} 3 C${-bw - 2} ${-H * .3} ${-tw * .7} ${-H * .55} ${shL[0].toFixed(1)} ${shL[1].toFixed(1)}`;
    const sum = LUMPS.reduce((s, l) => s + l.w, 0);
    let x = shL[0], y = shL[1];
    LUMPS.forEach((l, i) => {
      const w = (shR[0] - shL[0]) * l.w / sum, t = (i + 1) / LUMPS.length;
      const nx = x + w, ny = shL[1] + (shR[1] - shL[1]) * t - Math.sin(t * Math.PI) * H * .22, hh = w * .55 * l.h * lump + 2;
      d += ` C${(x - w * .05).toFixed(1)} ${(y - hh).toFixed(1)} ${(nx + w * .05).toFixed(1)} ${(ny - hh).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      x = nx; y = ny;
    });
    return d + ` C${(tw * .7).toFixed(1)} ${(-H * .55).toFixed(1)} ${(bw + 2).toFixed(1)} ${(-H * .3).toFixed(1)} ${bw} 3Z`;
  };
  const mass = (H, Wb, Wt, lump, droop) => {
    const d = outline(H, Wb, Wt, lump, droop), hi = outline(H * .9, Wb * .6, Wt * .78, lump * .9, droop);
    let s = `<path d="${d}" fill="${BW2}" stroke="${BWL}" stroke-width="1.2" stroke-linejoin="round"/><g transform="translate(${-Wt * .07} ${-H * .06})"><path d="${hi}" fill="${BW1}"/></g>`;
    const cid = `bswc${seed}_${clipN++}`;
    s += `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">`;
    for (let i = 0; i < 3; i++) {
      const side = i === 1 ? .2 : i === 0 ? -1 : 1;
      const sx = side * Wb * (.1 + r() * .18), sy = -H * (.08 + r() * .25), ex = side * Wt * (.2 + r() * .2), ey = -H * (.55 + r() * .25);
      s += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${(sx + (ex - sx) * .2).toFixed(1)} ${((sy + ey) / 2).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${BW3}" stroke-width="${(1.4 + r() * 1.2).toFixed(1)}" stroke-linecap="round" opacity=".7"/>`;
    }
    return s + '</g>';
  };
  const chunks = (H, Wt, spread, fall, n = 6) => { let s = ''; for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), x = side * (Wt * .3 + k * spread * .45 + r() * 6), y = -H - 4 + k * 8 + fall * (.5 + k * .4), rr = 5.5 - k * 1.2 + r(); s += `<path d="${bsBlob(x, y, rr, rr * .9, .3, 8, r)}" fill="${BW1}" stroke="${BWL}" stroke-width=".9" stroke-opacity=".6"/>`; } return s; };
  const foam = (rx, ry, jag, k = 1) => `<path d="${bsBlob(0, 0, rx, ry, jag, 14, r)}" fill="${BW1}" stroke="${BWL}" stroke-width="1" stroke-opacity=".45" opacity="${k}"/><path d="${bsBlob(0, 1, rx * .55, ry * .5, jag, 10, r)}" fill="${BW2}"/>`;
  const ring = (rad, w, o) => `<ellipse cx="0" cy="0" rx="${rad}" ry="${rad * .92}" fill="none" stroke="${BW1}" stroke-width="${w}" opacity="${o}"/>`;
  const bits = (n, R, size) => { let s = ''; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = R * (.5 + r() * .5); s += `<path d="${bsBlob(Math.cos(a) * d, Math.sin(a) * d * .8, size * (.6 + r() * .6), size * (.5 + r() * .5), .5, 7, r)}" fill="${BW1}" stroke="${BWL}" stroke-width=".8" stroke-opacity=".4"/>`; } return s; };
  fr.push(`<ellipse cx="0" cy="0" rx="15" ry="11" fill="#0a2b45" opacity=".5"/>` + (() => { let s = ''; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * .3; s += `<circle cx="${(Math.cos(a) * 9).toFixed(1)}" cy="${(Math.sin(a) * 7).toFixed(1)}" r="${(2 + r() * 1.5).toFixed(1)}" fill="${BW1}" stroke="${BWL}" stroke-width=".8"/>`; } return s; })());
  fr.push(foam(19, 9, .4) + mass(34, 22, 30, .8, 0));
  fr.push(foam(22, 10, .4) + mass(74, 24, 46, 1, 0));
  fr.push(foam(25, 11, .4) + mass(100, 26, 58, 1.1, 0));
  fr.push(foam(27, 12, .4) + mass(110, 28, 64, 1.1, .1) + chunks(110, 64, 18, 0, 4));
  fr.push(foam(30, 13, .4) + mass(94, 32, 66, .9, .5) + chunks(98, 66, 24, 10));
  fr.push(foam(33, 14, .45) + mass(64, 38, 64, .8, .9) + chunks(70, 62, 30, 24));
  fr.push(foam(36, 15, .5) + mass(32, 46, 56, .6, 1) + chunks(40, 54, 34, 30, 4));
  fr.push(foam(35, 15, .55) + `<path d="${bsBlob(0, -5, 20, 9, .5, 10, r)}" fill="${BW1}" stroke="${BWL}" stroke-width="1" stroke-opacity=".5"/>` + ring(30, 2.2, .8));
  fr.push(foam(30, 14, .6, .95) + bits(5, 32, 5) + ring(36, 2, .7));
  fr.push(bits(9, 28, 5.5) + `<path d="${bsBlob(0, 0, 14, 8, .7, 9, r)}" fill="${BW1}" opacity=".9"/>` + ring(42, 1.6, .55));
  fr.push(bits(7, 31, 3.5) + ring(47, 1.2, .4));
  fr.push(bits(4, 34, 2.5) + ring(51, 1, .25));
  return fr;
}
function bsWater(box, seed, delay, pegId) {
  const T = bsFlip(box, bsColumnFrames(seed), delay, 1, 320);
  const r = bsRng(seed * 31 + 7);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const vx = side * (40 + r() * 60), vy = -(10 + r() * 45), g = 950, t0 = 5 + Math.floor(r() * 2);
    const sx = side * (6 + r() * 26), sy = -60 - r() * 40, sz = 1.6 + r() * 2;
    const n = 5 + Math.floor(r() * 2), pts = [];
    for (let f = 0; f <= n; f++) { const t = f / BS_FPS; pts.push({ x: sx + vx * t, y: Math.min(sy + vy * t + g * t * t / 2, 6 + r() * 4) }); }
    const d = bsEl(box, 'left:0;top:0;width:0;height:0;opacity:1', `<svg width="1" height="1" style="overflow:visible;position:absolute">${bsDrop(0, 0, sz, Math.atan2(vy, vx) + Math.PI)}</svg>`);
    d.style.opacity = '0';
    bsStepMove(d, pts, delay + t0 * BS_FR);
  }
  const peg = bsEl(box, 'left:-19px;top:-19px;width:38px;height:38px', `<svg width="38" height="38" viewBox="0 0 38 38"><defs>${BS_DEFS(pegId)}</defs>${bsMark('miss', 19, 19, 38, pegId)}</svg>`);
  peg.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: 1 }], { duration: 10, delay: delay + T - 3 * BS_FR, fill: 'forwards' });
  return delay + T;
}
// ---- 爆発(平らな色のコマ送り): 閃光 → 火の玉 → 黒い煙 → 灰色に薄れて割れる。破片が飛ぶ
function bsBoomFrames(seed, s = 1) {
  const r = bsRng(seed), fr = [];
  const ball = (R, cols, jag, dy = 0) => cols.map((c, i) => `<path d="${bsBlob((r() - .5) * 3 * s, dy - i * 1.5 * s, R * (1 - i * .27) * s, R * (1 - i * .27) * .92 * s, jag, 11, r)}" fill="${c}"/>`).join('');
  const spikes = (R, n) => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * .3, L = R * (1.4 + r() * .7); d += `<path d="M${Math.cos(a - .18) * R * .6 * s} ${Math.sin(a - .18) * R * .6 * s} L${Math.cos(a) * L * s} ${Math.sin(a) * L * s} L${Math.cos(a + .18) * R * .6 * s} ${Math.sin(a + .18) * R * .6 * s}Z" fill="${BF2}"/>`; } return d; };
  const smoke = (n, R, cols, dy, spread) => { let d = ''; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rr = spread * (.3 + r() * .7); d += `<path d="${bsBlob(Math.cos(a) * rr * s, (Math.sin(a) * rr * .7 + dy) * s, R * (.6 + r() * .5) * s, R * (.55 + r() * .45) * s, .4, 9, r)}" fill="${cols[i % cols.length]}" stroke="#2a2420" stroke-width="1" stroke-opacity=".35"/>`; } return d; };
  fr.push(spikes(10, 8) + `<circle r="${11 * s}" fill="${BF1}"/>`);
  fr.push(ball(19, [BF4, BF3, BF2, BF1], .35));
  fr.push(ball(24, [BF4, BF3, BF2, BF1], .45, -2));
  fr.push(smoke(4, 11, [BSM1], -6, 14) + ball(22, [BF4, BF3, BF2], .55, -4));
  fr.push(smoke(6, 12, [BSM1, BSM2], -10, 16) + ball(14, [BF3, BF2], .6, -6));
  fr.push(smoke(6, 13, [BSM2, BSM1], -15, 19) + ball(7, [BF3, BF2], .6, -8));
  fr.push(smoke(5, 12, [BSM2, BSM3], -20, 22));
  fr.push(smoke(5, 9, [BSM3, BSM2], -25, 25));
  fr.push(smoke(4, 6, [BSM3], -30, 27));
  fr.push(smoke(3, 3.5, [BSM3], -34, 29));
  return fr;
}
function bsBoom(box, x, y, delay, seed, s = 1) {
  const sub = document.createElement('div');
  sub.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0`;
  box.appendChild(sub);
  const D = bsFlip(sub, bsBoomFrames(seed, s), delay, 1, 200);
  const r = bsRng(seed + 5);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, v = 60 + r() * 60, pts = [];
    for (let f = 0; f <= 5; f++) { const t = f / BS_FPS; pts.push({ x: Math.cos(a) * v * t, y: Math.sin(a) * v * t + 120 * t * t, r: Math.round(a * 57 + f * 40) }); }
    const d = bsEl(sub, 'left:0;top:0;width:0;height:0', `<div style="position:absolute;width:6px;height:2.5px;margin:-1px -3px;background:#2a1d14;border-radius:1px"></div>`);
    bsStepMove(d, pts, delay + BS_FR);
  }
  return delay + D;
}
// 燃え続ける火(3 コマを繰り返す)
function bsFireLoop(box, x, y, from, until, seed) {
  const r = bsRng(seed), frames = [];
  for (let f = 0; f < 3; f++) {
    const fl = (w, h, c, dx) => { const t = -h, l = -w / 2, rr = w / 2; return `<path d="M${l + dx} 2 Q${l - 2 + dx} ${t * .45} ${dx + (r() - .5) * 4} ${t} Q${rr * .3 + dx} ${t * .55} ${rr * .55 + dx} ${t * .6} Q${rr + 2 + dx} ${t * .3} ${rr + dx} 2Z" fill="${c}"/>`; };
    frames.push(`<ellipse cx="0" cy="3" rx="11" ry="5" fill="#1a0f0a" opacity=".55"/>` + fl(18, 22 + r() * 6, BF4, 0) + fl(13, 16 + r() * 5, BF3, (r() - .5) * 2) + fl(7, 9 + r() * 4, BF2, (r() - .5) * 2) + `<path d="${bsBlob(4 + f * 2, -28 - f * 3, 6, 4.5, .4, 8, r)}" fill="${BSM1}" opacity=".85"/>`);
  }
  const sub = document.createElement('div');
  sub.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0`;
  box.appendChild(sub);
  const loops = Math.max(1, Math.ceil((until - from) / (3 * BS_FR)));
  frames.forEach((f, i) => {
    const d = bsEl(sub, 'left:-30px;top:-40px;width:60px;height:60px', `<svg width="60" height="60" viewBox="-30 -40 60 60" style="overflow:visible">${f}</svg>`);
    const ks = [];
    for (let L = 0; L < loops; L++) for (let j = 0; j < 3; j++) ks.push({ opacity: j === i ? 1 : 0, offset: (L * 3 + j) / (loops * 3), easing: 'step-end' });
    ks.push({ opacity: 0, offset: 1 });
    d.animate(ks, { duration: loops * 3 * BS_FR, delay: from, fill: 'forwards' });
  });
}
// 命中: 影 → 爆発 → 残る火(盤の印と同じ)
function bsHitFx(box, seed, delay, id) {
  const t = bsBoom(box, 0, 0, delay, seed, 1);
  const f = bsEl(box, 'left:-19px;top:-19px;width:38px;height:38px', `<svg width="38" height="38" viewBox="0 0 38 38" style="overflow:visible"><defs>${BS_DEFS(id)}</defs>${bsMark('hit', 19, 19, 38, id)}</svg>`);
  f.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: 1 }], { duration: 10, delay: delay + 5 * BS_FR, fill: 'forwards' });
  return t;
}
// ---- 撃沈: 爆発が艦の上を走る → 船体が現れて燃える → 傾き、艦尾から沈む(境目に白い泡の帯)
//      → 火は湯気になって消え、泡のかけらが割れて小さくなり、木片と薄い油 → 盤の「沈んだ艦」の姿
// box は艦の中心。艦の向きの座標: 艦尾 x=0 → 艦首 x=L(L = 長さ×38)、y=0..38。
function bsSinkFx(box, cells, idx, lastK, delay, id) {
  const g = bsShipGeom(cells), horiz = g.horiz, len = g.len, L = len * BSC;
  const ww = horiz ? L : BSC, wh = horiz ? BSC : L;
  const order = cells.slice().sort((a, b) => a - b);
  const at = (i) => horiz ? [-L / 2 + (i + .5) * BSC, 0] : [0, -L / 2 + (i + .5) * BSC];
  const P = (lx, ly) => horiz ? [-L / 2 + lx, -BSC / 2 + ly] : [BSC / 2 - ly, -L / 2 + lx];
  const li = Math.max(0, order.indexOf(lastK));
  order.forEach((k, i) => { const [x, y] = at(i); bsBoom(box, x, y, delay + Math.abs(i - li) * 2 * BS_FR, k * 13 + i, i === li ? 1.15 : .9); });
  const tReveal = delay + 3 * BS_FR, tSink = delay + (len * 2 + 10) * BS_FR, sinkFrames = len * 5 + 6, tUnder = tSink + sinkFrames * BS_FR;
  const hullPath = bsHullPath(len, idx, BSC);
  const art = bsShipArt(len, idx, BSC, false, true, `url(#bsHull${id})`);
  const r = bsRng(idx * 71 + cells[0]);
  const frames = [];
  for (let f = 0; f <= sinkFrames; f++) {
    const p = Math.min(1, f / (sinkFrames - 2)), w = L * Math.pow(p, 1.25) - 6;
    const lift = p > .55 ? Math.min(1, (p - .55) / .35) : 0, beam = f === 0 ? 1 : .8;
    let gg = `<g transform="translate(0 ${BSC / 2}) scale(1 ${beam}) translate(0 ${-BSC / 2})"><path d="${hullPath}" fill="#0d3350" opacity="${(.55 * (1 - p * .4)).toFixed(2)}"/>`;
    gg += `<clipPath id="bscl${id}_${f}"><rect x="${Math.max(0, w).toFixed(1)}" y="-20" width="${L + 40}" height="${BSC + 40}"/></clipPath>`;
    gg += `<g clip-path="url(#bscl${id}_${f})" transform="translate(${L} ${BSC / 2}) scale(${1 + lift * .1}) translate(${-L} ${-BSC / 2})">${art}<path d="${hullPath}" fill="#0b1c28" opacity="${(.18 + p * .3).toFixed(2)}"/></g>`;
    if (f > 0 && w < L - 4) {
      const bx = Math.max(4, w + 2);
      gg += `<path d="${bsBlob(bx, BSC / 2, 8 + r() * 3, BSC * .62, .55, 12, r)}" fill="${BW1}" stroke="${BWL}" stroke-width="1" stroke-opacity=".5"/><path d="${bsBlob(bx - 6, BSC / 2 + (r() - .5) * 8, 5, BSC * .3, .5, 9, r)}" fill="${BW2}"/>`;
      for (let b = 0; b < 4; b++) gg += `<circle cx="${(bx - 8 - r() * 22).toFixed(1)}" cy="${(BSC * (.15 + r() * .7)).toFixed(1)}" r="${(1.8 + r() * 2.6).toFixed(1)}" fill="${BW1}" stroke="${BWL}" stroke-width=".8" stroke-opacity=".5"/>`;
    }
    frames.push(`<g transform="translate(${-ww / 2} ${-wh / 2})${horiz ? '' : ` translate(${BSC} 0) rotate(90)`}">${gg}</g></g>`);
  }
  const defs = bsEl(box, 'left:0;top:0;width:0;height:0', `<svg width="0" height="0"><defs>${BS_DEFS(id)}</defs></svg>`);
  defs.style.opacity = '1';
  const S = Math.max(ww, wh) + 80;
  [frames[0], ...frames].forEach((f, i) => {
    const d = bsEl(box, `left:${-S / 2}px;top:${-S / 2}px;width:${S}px;height:${S}px`, `<svg width="${S}" height="${S}" viewBox="${-S / 2} ${-S / 2} ${S} ${S}" style="overflow:visible">${f}</svg>`);
    const a = i === 0 ? tReveal : tSink + (i - 1) * BS_FR, b = i === 0 ? tSink : tSink + i * BS_FR;
    d.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: a / b, easing: 'step-end' }, { opacity: 0, offset: 1 }], { duration: b, fill: 'forwards' });
  });
  order.forEach((k, i) => {
    const [x, y] = at(i), pos = (i + .5) / len;
    const tOff = tSink + Math.ceil(Math.pow(pos, 1 / 1.25) * (sinkFrames - 2)) * BS_FR;
    bsFireLoop(box, x, y, tReveal + i * BS_FR, tOff, k * 7);
    const rs = bsRng(k * 3 + 1), sub = document.createElement('div');
    sub.style.cssText = `position:absolute;left:${x}px;top:${y - 8}px;width:0;height:0`;
    box.appendChild(sub);
    bsFlip(sub, [0, 1, 2].map((j) => `<path d="${bsBlob(0, -j * 7, 9 + j * 4, 7 + j * 3, .5, 9, rs)}" fill="${BW1}" stroke="${BWL}" stroke-width="1" stroke-opacity=".35" opacity="${1 - j * .25}"/>`), tOff, 1, 80);
  });
  const fr2 = [], rr = bsRng(cells[0] * 5 + 3);
  for (let f = 0; f < 12; f++) {
    let gg = '';
    const k = f / 11, pieces = 5 + Math.floor(k * 9);
    for (let i = 0; i < pieces; i++) {
      const lx = (i + .5) / pieces * L + (rr() - .5) * 12, ly = BSC / 2 + (rr() - .5) * BSC * .55, sz = BSC * .3 * (1 - k * .7) * (.6 + rr() * .6);
      gg += `<path d="${bsBlob(lx, ly, sz * 1.2, sz, .55, 9, rr)}" fill="${BW2}" stroke="${BWL}" stroke-width=".9" stroke-opacity=".4"/><path d="${bsBlob(lx - sz * .2, ly - sz * .2, sz * .5, sz * .4, .5, 7, rr)}" fill="${BW1}"/>`;
    }
    if (f < 6) for (let i = 0; i < 5; i++) gg += `<circle cx="${(rr() * L).toFixed(1)}" cy="${(BSC * (.15 + rr() * .7)).toFixed(1)}" r="${(2 + rr() * 3.5 * (1 - f / 6)).toFixed(1)}" fill="none" stroke="${BW1}" stroke-width="1.4"/>`;
    gg += `<path d="${bsBlob(L / 2, BSC / 2, L / 2 + 8 + f * 3, BSC / 2 + 6 + f * 3, .1, 20, rr)}" fill="none" stroke="${BW1}" stroke-width="${(1.8 - k * 1.2).toFixed(1)}" opacity="${(.7 - k * .6).toFixed(2)}"/>`;
    fr2.push(`<g transform="translate(${-ww / 2} ${-wh / 2})${horiz ? '' : ` translate(${BSC} 0) rotate(90)`}">${gg}</g>`);
  }
  bsFlip(box, fr2, tUnder - BS_FR, 2, S + 80);
  const ro = bsRng(cells[0] * 11 + 1);
  const oil = bsEl(box, `left:${-(ww + 50) / 2}px;top:${-(wh + 50) / 2}px;width:${ww + 50}px;height:${wh + 50}px`, `<svg width="${ww + 50}" height="${wh + 50}" viewBox="${-(ww + 50) / 2} ${-(wh + 50) / 2} ${ww + 50} ${wh + 50}"><path d="${bsBlob(0, 0, ww / 2 + 16, wh / 2 + 16, .25, 16, ro)}" fill="#071722" opacity=".28"/><path d="${bsBlob(ww * .1, -wh * .05, ww / 3, wh / 3, .3, 12, ro)}" fill="#071722" opacity=".18"/></svg>`);
  oil.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: .6, offset: .5, easing: 'step-end' }, { opacity: 1, offset: 1 }], { duration: 6 * BS_FR, delay: tUnder, fill: 'forwards' });
  for (let i = 0; i < 6; i++) {
    const [px, py] = P(ro() * L, BSC * (.2 + ro() * .6)), w = 5 + ro() * 6, rot = ro() * 180, vx = (ro() - .5) * 10, vy = (ro() - .5) * 10, dir = ro() < .5 ? 2 : -2, pts = [];
    for (let f = 0; f <= 18; f++) pts.push({ x: px + vx * f / 18, y: py + vy * f / 18, r: Math.round(rot + f * dir) });
    const d = bsEl(box, 'left:0;top:0;width:0;height:0', `<div style="position:absolute;width:${w}px;height:3px;margin:-1.5px ${-w / 2}px;background:#6b4a2e;box-shadow:inset 0 -1px 0 #3b2716;border-radius:1px"></div>`);
    d.animate(pts.map((p, j) => ({ transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${p.r}deg)`, offset: j / 18, easing: 'step-end' })), { duration: 18 * BS_FR, delay: tUnder + 2 * BS_FR, fill: 'forwards' });
    d.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: 1, offset: 1 }], { duration: 10, delay: tUnder + 2 * BS_FR, fill: 'forwards' });
  }
  const tEnd = tUnder + 22 * BS_FR;
  const wreckEl = bsEl(box, `left:${-ww / 2}px;top:${-wh / 2}px;width:${ww}px;height:${wh}px`, `<svg width="${ww}" height="${wh}" viewBox="0 0 ${ww} ${wh}" style="overflow:visible"><defs>${BS_DEFS(id + 'w')}</defs>${bsWreck(len, idx, BSC, id + 'w', horiz)}</svg>`);
  wreckEl.animate([{ opacity: 0, offset: 0, easing: 'step-end' }, { opacity: .5, offset: .5, easing: 'step-end' }, { opacity: 1, offset: 1 }], { duration: 2 * BS_FR, delay: tEnd - 6 * BS_FR, fill: 'forwards' });
  return tEnd;
}
// 直前の射撃の演出を、盤の上の演出の層で流す。geo: 盤 { x, y, cell }。終わるまでの時間(ms)を返す
function bsPlayShotFx(la, geo, ships, key) {
  const layer = document.querySelector('.bs-fx');
  if (!layer) return 0;
  const k = la.cell, c = geo.cell;
  const cx = geo.x + (k % 10 + .5) * c, cy = geo.y + (Math.floor(k / 10) + .5) * c;
  const box = bsFxBox(layer, cx, cy, c);
  const t0 = bsIncoming(box);
  const id = 'fx' + key.replace(/[^0-9a-z]/gi, '');
  if (!la.hit) return bsWater(box, k * 97 + 13, t0, id);
  if (la.sunk) {
    const sh = (ships || []).find((s) => s.index === la.shipIdx && s.cells);
    if (sh) {
      const g = bsShipGeom(sh.cells);
      const sx = geo.x + (g.x0 + (g.horiz ? g.len / 2 : .5)) * c, sy = geo.y + (g.y0 + (g.horiz ? .5 : g.len / 2)) * c;
      return bsSinkFx(bsFxBox(layer, sx, sy, c), sh.cells, la.shipIdx, k, t0, id);
    }
  }
  return bsHitFx(box, k * 13 + 5, t0, id);
}

// ================================================================ バトルシップの配置(ドックからのドラッグ・右クリックで向き)
let bsDrag = null;
function bsAttachPlaceTools(A, b, sel0, geo) {
  const wrap = document.getElementById('boardwrap');
  if (!wrap || !A.canPlay) return;
  const scene = wrap.querySelector('.nine-scene');
  if (!scene) return;
  const SW = +scene.dataset.w, SH = +scene.dataset.h, c = geo.cell;
  scene.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (bsDrag) { bsDrag.dir = 1 - bsDrag.dir; bsDrag.cell = null; if (bsDrag.paint) bsDrag.paint(); return; }
    const sel = (A.sel && A.sel.kind === 'battleship') ? A.sel : null;
    if (sel) { A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: 1 - sel.dir, cell: sel.cell }; A.sfx('TILE', 0, { volume: .3 }); A.redraw(); }
  });
  const toScene = (e2) => { const sr = scene.getBoundingClientRect(); return [(e2.clientX - sr.left) / sr.width * SW, (e2.clientY - sr.top) / sr.height * SH]; };
  const cellFromEvent = (e2) => {
    const [sx, sy] = toScene(e2);
    const gx = Math.floor((sx - geo.x) / c), gy = Math.floor((sy - geo.y) / c);
    return gx < 0 || gx > 9 || gy < 0 || gy > 9 ? null : { gx, gy };
  };
  wrap.querySelectorAll('.bs-dockrow').forEach((row) => {
    const idx = Number(row.dataset.bsship);
    if (b.myShips[idx].placed) return;
    row.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      const icon = row.querySelector('.bs-shipicon');
      const ir = icon ? icon.getBoundingClientRect() : row.getBoundingClientRect();
      const per = ir.width / BS_FLEET[idx];
      const grab = Math.max(0, Math.min(BS_FLEET[idx] - 1, Math.floor((ev.clientX - ir.left) / per)));
      const d = bsDrag = { ship: idx, dir: (sel0 && sel0.ship === idx) ? sel0.dir : 0, grab, sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY, active: false, cell: null, ok: false, el: null, paint: null };
      const paint = () => {
        if (!d.el) { d.el = document.createElement('div'); d.el.className = 'bs-dragghost'; scene.appendChild(d.el); }
        const len = BS_FLEET[d.ship];
        const w = (d.dir === 0 ? len : 1) * c, h = (d.dir === 0 ? 1 : len) * c;
        const fill = d.cell == null ? 'rgba(126,151,172,.88)' : d.ok ? 'rgba(61,220,116,.55)' : 'rgba(229,72,77,.55)';
        const art = bsShipArt(len, d.ship, c, false, c >= 26, fill);
        d.el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${d.dir === 0 ? art : `<g transform="translate(${c} 0) rotate(90)">${art}</g>`}</svg>`;
        if (d.cell != null) {
          d.el.style.left = (geo.x + (d.cell % 10) * c) + 'px';
          d.el.style.top = (geo.y + Math.floor(d.cell / 10) * c) + 'px';
          d.el.style.transform = 'none';
        } else {
          const [sx, sy] = toScene({ clientX: d.x, clientY: d.y });
          d.el.style.left = sx + 'px'; d.el.style.top = sy + 'px'; d.el.style.transform = 'translate(-50%,-50%)';
        }
      };
      d.paint = paint;
      const onMove = (e2) => {
        if (bsDrag !== d) return;
        d.x = e2.clientX; d.y = e2.clientY;
        if (!d.active && Math.hypot(e2.clientX - d.sx, e2.clientY - d.sy) > 7) d.active = true;
        if (!d.active) return;
        const pos = cellFromEvent(e2);
        if (pos) {
          const len = BS_FLEET[d.ship];
          let ox = d.dir === 0 ? pos.gx - d.grab : pos.gx, oy = d.dir === 0 ? pos.gy : pos.gy - d.grab;
          ox = Math.max(0, Math.min(10 - (d.dir === 0 ? len : 1), ox));
          oy = Math.max(0, Math.min(10 - (d.dir === 0 ? 1 : len), oy));
          d.cell = oy * 10 + ox;
          const cells = bsCellsLocal(d.ship, d.dir, ox, oy);
          d.ok = cells.length > 0 && A.legal.has(d.ship * 1000 + d.dir * 100 + d.cell);
        } else { d.cell = null; d.ok = false; }
        paint();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        if (bsDrag === d) bsDrag = null;
        if (d.el) d.el.remove();
        if (!d.active) return;
        const stop = (ev2) => { ev2.stopPropagation(); ev2.preventDefault(); };
        window.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400);
        if (d.cell != null) {
          if (d.ok) { A.sfx('TILE', 0, { volume: .8 }); A.play(d.ship * 1000 + d.dir * 100 + d.cell); }
          else { A.sel = { kind: 'battleship', moves: A.view.moves, ship: d.ship, dir: d.dir, cell: d.cell }; A.redraw(); }
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });
  });
}

// ================================================================ バトルシップの盤
// 砲撃の記録(側板の「最近の砲撃」)。view には履歴が無いので、この画面で見た射撃を覚えておく
let bsLog = { handle: null, list: [] };
function renderBattleship(b, A) {
  prep(A);
  const me = b.me, foe = me >= 0 ? 1 - me : -1;
  const mob = isMob();
  const alive = (ships) => ships ? ships.filter((s) => !s.sunk).length : 5;
  // 側板: 両者とも同じ形(「残り 4 隻」+艦の形の印 5 つ)。数が変わっても位置が動かない
  const pips = (n) => `<span class="bs-pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < n ? '' : 'off'}"></i>`).join('')}</span>`;
  A.strip(A.view.seats.map((s, i) => {
    let det;
    if (b.phase === 'place') det = `配置 <span class="snum">${b.placedCounts[i]}</span> / 5`;
    else {
      const n = me >= 0 ? (i === me ? alive(b.myShips) : alive(b.enemyShips)) : alive(b.publicShips && b.publicShips[i]);
      det = `残り <span class="snum">${n}</span> 隻${pips(n)}`;
    }
    return `<div class="pl${A.view.toMove === i && !A.view.outcome ? ' turn' : ''}">${avFor(A, b, i)}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${det}</span></span></div>`;
  }).join(''));
  A.round(b.phase === 'place' ? '配置' : b.phase === 'done' ? '対戦終了' : '攻撃');
  // 直前の射撃
  const la = b.lastAction;
  const shotKey = la && la.type === 'shot' ? `${la.seat}:${la.cell}:${b.phase}` : '';
  const fresh = !!shotKey && ninePrev && ninePrev.handle === A.handle && ninePrev.bsKey !== shotKey;
  if (bsLog.handle !== A.handle) bsLog = { handle: A.handle, list: [] };
  if (shotKey && (!bsLog.list.length || bsLog.list[0].key !== shotKey)) {
    bsLog.list.unshift({ key: shotKey, seat: la.seat, cell: la.cell, hit: la.hit, sunk: la.sunk, ship: la.shipIdx });
    bsLog.list.length = Math.min(bsLog.list.length, 5);
  }
  if (fresh) {
    if (la.sunk) { A.sfx('TAKE', 120, { volume: .9 }); A.sfx('TAKE', 380, { volume: .7, rate: .8 }); }
    else if (la.hit) A.sfx('TAKE', 120, { volume: .8 });
    else A.sfx('MARBLE', 120, { volume: .55, rate: .55 });
  }
  const coord = (k) => `${'ABCDEFGHIJ'[k % 10]}${Math.floor(k / 10) + 1}`;
  if (!mob && (b.phase === 'battle' || b.phase === 'done')) {
    const rows = bsLog.list.slice(0, 4).map((e) => `<div class="bs-logrow"><span class="bs-who">${esc(A.name(e.seat))}</span><span class="bs-cd">${coord(e.cell)}</span><span class="bs-res"><i class="${e.sunk ? 'sunk' : e.hit ? 'hit' : ''}"></i>${e.sunk ? `撃沈 ${BS_NAMES[e.ship]}` : e.hit ? '命中' : '外れ'}</span></div>`).join('');
    A.side(`${b.shotsLeft > 1 ? `<div class="kv"><span>この手番</span><b>あと ${b.shotsLeft} 発</b></div>` : ''}<div class="bs-log">${rows ? `<h4>最近の砲撃</h4>${rows}` : ''}</div>`);
  } else A.side('');
  const selOk = A.sel && A.sel.kind === 'battleship' && A.sel.moves === A.view.moves;
  let html = `<div class="bs-table${mob ? ' mob' : ''}"></div>`;
  const acts = [];
  const plate = (x, y, ico, t, sub = '') => at(x, y, `<div class="bs-plate">${ico}${t}${sub ? `<span class="sub">${sub}</span>` : ''}</div>`).replace('class="anchor"', 'class="anchor bs-left"');
  // 盤の位置(PC 900×560 / スマホ 560×880)
  const G = mob
    ? { big: { x: 52, y: 66, cell: 44 }, small: { x: 40, y: 606, cell: 23 } }
    : { big: { x: 66, y: 74, cell: 38 }, small: { x: 584, y: 74, cell: 25 } };
  if (b.phase === 'place' && me >= 0 && b.turn === me && A.canPlay) {
    // ===== 自分の配置ターン =====
    const unplaced = b.myShips.filter((s) => !s.placed);
    let sel = selOk ? A.sel : null;
    if (!sel || !unplaced.some((s) => s.index === sel.ship)) sel = { kind: 'battleship', moves: A.view.moves, ship: unplaced[0].index, dir: 0, cell: null };
    let ghost = null, ghostMove = -1, ghostCell = null;
    if (sel.cell != null) {
      const len = BS_FLEET[sel.ship];
      let gx = sel.cell % 10, gy = Math.floor(sel.cell / 10);
      if (sel.dir === 0) gx = Math.min(gx, 10 - len); else gy = Math.min(gy, 10 - len);
      ghostCell = gy * 10 + gx;
      const cells = bsCellsLocal(sel.ship, sel.dir, gx, gy);
      ghostMove = sel.ship * 1000 + sel.dir * 100 + ghostCell;
      ghost = { cells, anchor: ghostCell, ship: sel.ship, dir: sel.dir, ok: cells.length > 0 && A.legal.has(ghostMove) };
    }
    const geo = G.big;
    html += plate(mob ? 30 : 44, mob ? 18 : 30, BS_ICO_ANCHOR, '自分の海域');
    html += bsBoardSvg({ id: 'p', x: geo.x, y: geo.y, cell: geo.cell, labels: true, board: b.ownBoard, ships: b.myShips, tap: 'all', ghost });
    // ドック: 艦を盤と同じ縮尺で並べる
    const dc = mob ? 30 : 34;
    const rows = b.myShips.map((sh) => {
      const cls = sh.placed ? 'placed' : sel.ship === sh.index ? 'sel' : '';
      return `<div class="bs-dockrow ${cls}" data-bsship="${sh.index}">${bsShipIcon(sh.index, dc, 'ok', [], 'dock')}<span class="nm">${sh.placed ? '✓ ' : ''}${BS_NAMES[sh.index]}</span></div>`;
    }).join('');
    const left = b.myShips.filter((s) => !s.placed).length;
    if (mob) {
      html += `<div class="bs-dock mob" style="left:40px;top:560px;width:480px">${rows}</div>`;
    } else {
      html += plate(520, 30, '', 'ドック', `残り ${left} 隻`);
      html += `<div class="bs-dock" style="left:520px;top:74px;width:340px">${rows}</div>`;
      html += `<div class="bs-hints" style="left:522px;top:432px"><div>${bsMouse('L')}ドラッグして海域に置く</div><div>${bsMouse('R')}右クリックで縦・横を変える</div></div>`;
    }
    html += `<div class="bs-fx"></div>`;
    stage(A, b, html, (d) => {
      if (d.bscell != null && A.canPlay) {
        const tapped = Number(d.bscell);
        if (sel.cell != null && (tapped === sel.cell || tapped === ghostCell)) A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: 1 - sel.dir, cell: sel.cell };
        else A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: sel.dir, cell: tapped };
        A.sfx('TILE', 0, { volume: .35 });
        A.redraw();
        return;
      }
      if (d.bsship != null && A.canPlay) {
        const idx = Number(d.bsship);
        if (!b.myShips[idx].placed) { A.sel = { kind: 'battleship', moves: A.view.moves, ship: idx, dir: idx === sel.ship ? 1 - sel.dir : sel.dir, cell: null }; A.redraw(); }
        return;
      }
      tapMove(A)(d);
    });
    bsAttachPlaceTools(A, b, sel, geo);
    acts.push({ label: '向きを変える', fn: () => { A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: 1 - sel.dir, cell: sel.cell }; A.redraw(); }, enabled: true });
    acts.push({ label: 'ここに置く', cls: 'gold', enabled: !!(ghost && ghost.ok), fn: () => { A.sfx('TILE', 0, { volume: .8 }); A.play(ghostMove); } });
  } else if (b.phase === 'place') {
    // ===== 相手の配置待ち / 観戦 =====
    if (me >= 0) {
      const geo = G.big;
      html += plate(mob ? 30 : 44, mob ? 18 : 30, BS_ICO_ANCHOR, '自分の海域');
      html += bsBoardSvg({ id: 'p', x: geo.x, y: geo.y, cell: geo.cell, labels: true, board: b.ownBoard, ships: b.myShips });
      html += at(mob ? 280 : 690, mob ? 600 : 270, `<div class="bs-wait">相手が艦を配置しています…</div>`);
    } else html += at(mob ? 280 : 450, mob ? 400 : 282, `<div class="bs-wait">配置フェーズ（観戦中）</div>`);
    html += `<div class="bs-fx"></div>`;
    stage(A, b, html, tapMove(A));
    acts.push({ label: '向きを変える', enabled: false, fn: () => {} });
    acts.push({ label: 'ここに置く', cls: 'gold', enabled: false, fn: () => {} });
  } else if (me >= 0) {
    // ===== 攻撃 / 終了 =====
    const myTurn = b.turn === me && A.canPlay && b.phase === 'battle';
    const target = myTurn && selOk && A.sel.target != null ? A.sel.target : -1;
    // 演出を流す射撃は、盤にはまだ印を描かない(演出の最後で同じ印になる)
    const onEnemy = fresh && la.seat === me, onOwn = fresh && la.seat !== me;
    const fxHide = (on) => on ? new Set([la.cell]) : null;
    const eGeo = G.big, oGeo = G.small;
    html += plate(mob ? 30 : 44, mob ? 18 : 30, BS_ICO_SCOPE, '敵の海域');
    html += bsBoardSvg({ id: 'e', x: eGeo.x, y: eGeo.y, cell: eGeo.cell, labels: true, board: b.enemyBoard, ships: b.enemyShips, tap: myTurn ? 'unknown' : null, target, hide: fxHide(onEnemy), hideShip: onEnemy && la.sunk ? la.shipIdx : undefined });
    // 敵の艦隊(見つかっていない艦は点線の輪郭)
    const ec = mob ? 15 : 15;
    html += `<div class="bs-roster" style="left:${eGeo.x}px;top:${mob ? 528 : 478}px">${b.enemyShips.map((sh, i) => `<div class="bs-rship${sh.sunk ? ' sunk' : ''}">${bsShipIcon(i, ec, sh.sunk ? 'sunk' : 'unknown')}<span>${BS_NAMES[i]}</span></div>`).join('')}</div>`;
    html += mob ? plate(30, 574, BS_ICO_ANCHOR, '自分の艦隊') : plate(560, 30, BS_ICO_ANCHOR, '自分の艦隊');
    html += bsBoardSvg({ id: 'o', x: oGeo.x, y: oGeo.y, cell: oGeo.cell, labels: true, board: b.ownBoard, ships: b.myShips, hide: fxHide(onOwn), hideShip: onOwn && la.sunk ? la.shipIdx : undefined });
    // 自分の艦隊(被弾したマスに赤い点、沈んだ艦は黒ずんだ絵と赤い斜線)
    const mc = mob ? 18 : 22;
    html += `<div class="bs-mylist${mob ? ' mob' : ''}" style="left:${mob ? 316 : 584}px;top:${mob ? 600 : 356}px">${b.myShips.map((sh, i) => {
      const hits = sh.cells ? sh.cells.map((k, j) => (b.ownBoard && b.ownBoard[k] === 'hit' ? j : -1)).filter((j) => j >= 0) : [];
      const st = sh.sunk ? 'sunk' : hits.length ? 'dmg' : 'ok';
      return `<span class="${sh.sunk ? 'sunk' : ''}">${BS_NAMES[i]}</span>${bsShipIcon(i, mc, st, sh.sunk ? [] : hits)}`;
    }).join('')}</div>`;
    html += `<div class="bs-fx"></div>`;
    stage(A, b, html, (d) => {
      if (d.bscell != null && myTurn) {
        A.sel = { kind: 'battleship', moves: A.view.moves, target: Number(d.bscell) };
        A.sfx('TILE', 0, { volume: .35 });
        A.redraw();
        return;
      }
      tapMove(A)(d);
    });
    if (fresh && !A.reduce) {
      const geo = onEnemy ? eGeo : oGeo;
      const ms = bsPlayShotFx(la, geo, onEnemy ? b.enemyShips : b.myShips, `${A.view.moves}`);
      if (ms) A.anim(ms / (A.speed || 1));
    }
    acts.push(target >= 0 ? { label: `${coord(target)} へ発射`, move: target, cls: 'gold', enabled: true } : { label: '発射', cls: 'gold', enabled: false, fn: () => {} });
  } else {
    // 観戦: 両海域に撃沈艦のみ
    const cell = mob ? 24 : 30;
    html += bsBoardSvg({ id: 's0', x: mob ? 40 : 66, y: mob ? 80 : 90, cell, labels: true, board: null, ships: b.publicShips ? b.publicShips[0] : [] });
    html += bsBoardSvg({ id: 's1', x: mob ? 300 : 500, y: mob ? 80 : 90, cell, labels: true, board: null, ships: b.publicShips ? b.publicShips[1] : [] });
    html += at(mob ? 280 : 450, mob ? 420 : 470, `<div class="bs-wait">観戦中（撃沈した艦だけが見えます）</div>`);
    stage(A, b, html, tapMove(A));
  }
  A.acts(acts);
  ninePrev.bsKey = shotKey;
}
window.RENDER.battleship = renderBattleship;

// ================================================================ チンチロリン
function renderChinchiro(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  const mob = isMob();
  strip(A, b, (i) => `チップ ${b.chips[i]} 枚${i === b.banker ? ' ・ 親' : ''}`);
  A.round(`第 ${b.roundNo} / ${b.totalRounds} ラウンド`);
  A.side(`<div class="kv"><span>親</span><b>${esc(A.name(b.banker))}</b></div><div class="kv"><span>賭け金</span><b>${b.bet} 枚</b></div><div class="kv"><span>手番</span><b>${b.turn >= 0 ? esc(A.name(b.turn)) : '―'}</b></div>`);
  const la = b.lastAction && b.lastAction.type === 'roll' ? b.lastAction : null;
  const lr = b.lastRound;
  const lrJust = !!lr && (!b.dice.length || !!b.reason);
  const willAnim = !!(la && ninePrev && ninePrev.handle === A.handle && ninePrev.moves + 1 === A.view.moves && !A.reduce && !document.hidden);
  // The last throw belongs to the completed round even when the core has already
  // cleared b.dice for the next round. A repaint or spectator join retains it.
  const diceShow = b.dice.length ? b.dice : (la ? la.dice : []);
  const rollKey = `${A.handle}:${A.view.moves}:${JSON.stringify(la)}`;
  const session = diceShow.length === 3 ? ChinchiroTable.prepare({
    key: rollKey, values: diceShow, seed: `${A.view.moves}:${JSON.stringify(la)}`,
    escaped: !!(la && la.shonben), animate: willAnim, speed: A.speed || 1, reduce: A.reduce
  }) : null;
  const resultDelay = session ? session.resultDelay : 0;
  const settleDelay = lrJust && session ? session.settleDelay : 0;
  const holdDelay = session ? (lrJust ? session.releaseDelay : resultDelay) : 0;
  const rolling = resultDelay > 0;
  const D = mob ? 420 : 360;
  const bowlCx = mob ? 280 : 450, bowlCy = mob ? 470 : 276;
  const ownTurn = A.canPlay && b.turn === b.me && !b.reason;
  const canRoll = ownTurn && !holdDelay;
  let html = `<div class="nine-table ntable rect cc-table"><div class="feltin"></div></div>`;
  html += at(bowlCx, bowlCy, `<div class="cc-bowlwrap" role="img" aria-label="どんぶり${diceShow.length ? '、サイコロの出目 ' + diceShow.join('・') : ''}" style="width:${D}px;height:${D}px" ${canRoll ? 'data-m="0"' : ''}>${ChinchiroTable.markup()}</div>`);
  // 席のパネル(自分以外は周囲、自分は下)
  const POS = mob
    ? { 2: [[280, 86]], 3: [[110, 100], [450, 100]], 4: [[106, 116], [280, 80], [454, 116]], 5: [[102, 124], [188, 76], [372, 76], [458, 124]], 6: [[100, 132], [174, 72], [280, 64], [386, 72], [460, 132]] }
    : { 2: [[450, 64]], 3: [[150, 110], [750, 110]], 4: [[140, 120], [450, 64], [760, 120]], 5: [[140, 130], [252, 64], [648, 64], [760, 130]], 6: [[136, 140], [228, 64], [450, 64], [672, 64], [764, 140]] };
  const seatPanel = (seat) => {
    const res = b.results[seat];
    const resDelay = rolling && la && seat === la.seat;
    // 結果ラベルはサイコロが完全に止まってから1拍置いて出す(目を見る間を取る)
    const resHtml = `<div class="cc-seat-res${resDelay ? ' delay' : ''}"${resDelay ? ` style="animation-delay:${Math.round(resultDelay)}ms"` : ''}>${res ? `${res.dice.map((v) => dieFace(v, mob ? 21 : 23)).join('')}<b class="cc-res-lab ${res.kind}">${esc(res.label)}</b>` : ''}</div>`;
    const avBg = seat === b.me ? '#FFC65C' : SEAT_COLORS[seat % SEAT_COLORS.length];
    const avFg = seat === b.me ? '#3A2616' : '#fff';
    return `<div class="cc3-seat${mob ? ' mob' : ''}${seat === b.turn && !b.reason ? ' turn' : ''}${b.chips[seat] <= 0 ? ' dead' : ''}"><span class="cc3-av" style="background:${avBg};color:${avFg}">${esc(A.name(seat).slice(0, 1))}</span><div class="cc3-main"><div class="cc3-nm"><span class="cc3-nmt">${esc(A.name(seat))}</span><span class="cc2-oya${seat === b.banker ? '' : ' off'}">親</span></div><div class="cc3-chips">チップ <b>${b.chips[seat]}</b> 枚</div></div><div class="cc3-res">${resHtml}</div></div>`;
  };
  const positions = POS[b.n] || POS[4];
  for (let k = 1; k < b.n; k++) {
    const seat = (me + k) % b.n;
    const [x, y] = positions[k - 1];
    html += at(x, y, seatPanel(seat));
  }
  html += at(bowlCx, mob ? 806 : 490, `<div class="cc-me">${seatPanel(me)}</div>`);
  // ラウンド精算のパネル(最後の振りの目と全員の結果をゆっくり見せてから、間を置いてふわりと出す)
  if (lrJust && lr) {
    const bk = lr.results[lr.banker];
    const rows = lr.entries.map((e) => {
      const cr = lr.results[e.child];
      const flow = e.result === 'push' ? '<span class="cc-flow">精算なし</span>'
        : `<span class="cc-flow">${esc(A.name(e.from))} → ${esc(A.name(e.to))} <b>${e.amount} 枚</b></span>`;
      return `<div class="cc-entry"><span class="cc-entry-nm">${esc(A.name(e.child))}</span><span class="cc-entry-res ${cr ? cr.kind : ''}">${cr ? esc(cr.label) : '―'}</span>${flow}</div>`;
    }).join('');
    const instant = lr.instant === 'win' ? '<div class="cc-instant">親の即勝ち！</div>' : lr.instant === 'lose' ? '<div class="cc-instant">親の即負け</div>' : '';
    html += at(bowlCx, bowlCy, `<div class="cc-settle${settleDelay ? ' delay' : ''}"${settleDelay ? ` style="animation-delay:${Math.round(settleDelay)}ms"` : ''}><div class="cc-settle-t">第 ${lr.roundNo} ラウンド 精算</div>${instant}<div class="cc-entry banker"><span class="cc-entry-nm">親 ${esc(A.name(lr.banker))}</span><span class="cc-entry-res ${bk ? bk.kind : ''}">${bk ? esc(bk.label) : '―'}</span></div>${rows}</div>`);
  }
  if (holdDelay) A.anim(holdDelay / (A.speed || 1));
  stage(A, b, html, (d) => { if (canRoll && d.m === '0') A.play(0); });
  if (session) ChinchiroTable.mount(document.querySelector('.cc-bowlwrap'), session, () => {
    if (document.querySelector('.k-chinchiro')) A.redraw();
  }, lrJust ? 4800 : 700);
  // ボタンは消さずに常時表示し、自分の番でない時はグレーアウトする
  A.acts([{ label: b.attempts > 0 ? 'もう一度振る' : 'サイコロを振る', move: 0, cls: 'gold', enabled: canRoll }]);
}
window.RENDER.chinchiro = renderChinchiro;

// ================================================================ 共通フック(app.js / twelve.js から呼ばれる)
const NINE_STATUS = {
  coyote: (b) => b.done ? '' : b.currentBid > 0 ? '宣言するか「コヨーテ」か選んでください' : '宣言する数字を選んでください',
  liarsdice: (b) => b.done ? '' : b.currentBid ? '宣言を上げるか、ダウトしてください' : '最初の宣言をしてください',
  incangold: (b) => b.done ? '' : b.me >= 0 && !b.inCave[b.me] ? 'あなたは帰還済みです' : b.me >= 0 && b.decided[b.me] ? 'ほかの人の選択を待っています' : '進むか帰るか選んでください',
  take6: (b) => b.done ? '' : b.phase === 'rowPick' ? '引き取る列を選んでください' : b.me >= 0 && b.decided[b.me] ? 'ほかの人の選択を待っています' : '出すカードを1枚選んでください',
  blokus: (b) => b.finished ? '' : b.currentSeat === b.me ? '置くピースと場所を選んでください' : '',
  quoridor: (b) => b.me >= 0 && b.turn === b.me ? 'コマを進めるか、壁を置いてください' : '',
  chinchiro: (b) => b.reason ? '' : b.me >= 0 && b.turn === b.me ? (b.attempts > 0 ? `目なし… あと ${3 - b.attempts} 回振れます` : 'サイコロを振ってください') : '',
  battleship: (b) => {
    if (b.phase === 'place') return b.me >= 0 && b.turn === b.me ? '艦を選んで配置してください' : '相手が艦を配置しています';
    if (b.phase === 'battle' && b.me >= 0 && b.turn === b.me) return '撃つマスを選んでください';
    return '';
  },
  skull: (b) => b.done ? '' : {
    initial_place: '花かドクロを1枚伏せて置いてください',
    play_or_bid: '札を置くか、枚数を宣言してください',
    bidding: '宣言を上げるか、パスしてください',
    reveal: b.mustRevealOwn ? 'まず自分の山からめくってください' : 'めくる山を選んでください',
    discard_own: '失う札を選んでください',
  }[b.phase] || '',
};
const nineAimNth = (sel, i) => document.querySelectorAll(sel)[i] || null;
const NINE_AIM = {
  coyote: (b, mv, seat, q, button) => [button(mv === 0 ? /コヨーテ/ : /と宣言/) || q(`[data-piece="cy-card-${seat}"]`)],
  liarsdice: (b, mv, seat, q, button) => {
    const btn = mv === 0 ? button(/ダウト/) : mv === 1 ? button(/ジャスト/) : button(/と宣言/);
    if (btn) return [btn];
    const k = (seat - b.me + b.n) % b.n;
    return [k > 0 ? nineAimNth('.ld2-seat', k - 1) : q('.ld2-myseat')];
  },
  incangold: (b, mv, seat, q, button) => [button(mv === 1 ? /^進む$/ : /^帰る$/) || q(`[data-piece="ig-token-${seat}"]`)],
  take6: (b, mv, seat, q, button) => [q(`[data-piece="t6-back-${seat}"]`) || q(`[data-m="${mv}"]`)],
  blokus: (b, mv, seat, q, button) => mv === 999999 ? [button(/パス/)] : [q(`[data-m="${mv}"]`)],
  quoridor: (b, mv, seat, q, button) => mv < 100 ? [q(`[data-qpawn="${seat}"]`), q(`[data-m="${mv}"]`)] : [q(`[data-m="${mv}"]`)],
  skull: (b, mv, seat, q, button) => {
    const topOf = (s) => q(`[data-piece="sk-${s}-${Math.max(0, (b.stacks[s] || []).length - 1)}"]`);
    if (mv === 100 || mv === 101) return [q(`[data-m="${mv}"]`) || topOf(seat)];
    if (mv >= 200) return [q(`[data-m="${mv}"]`) || topOf(mv - 200)];
    if (mv === 0) return [button(/パス/) || topOf(seat)];
    if (mv === 300 || mv === 301) return [button(/を捨てる/) || topOf(seat)];
    return [button(/枚で宣言/) || topOf(seat)];
  },
};
const NINE_IDS = new Set(['coyote', 'skull', 'liarsdice', 'incangold', 'take6', 'blokus', 'quoridor', 'battleship', 'chinchiro']);
window.NINE_HAS = (id) => NINE_IDS.has(id);
window.NINE_STATUS = (b) => (NINE_STATUS[b.kind] ? NINE_STATUS[b.kind](b) : '');
window.NINE_AIM = (b, mv, seat, q, button) => (NINE_AIM[b.kind] ? NINE_AIM[b.kind](b, mv, seat, q, button) : []);
})();
