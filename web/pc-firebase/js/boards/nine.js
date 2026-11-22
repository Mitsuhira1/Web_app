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
    `<div class="pl${A.view.toMove === i && !A.view.outcome ? ' turn' : ''}">${avFor(A, b, i)}<span class="who"><span class="nm">${esc(A.name(i))}</span><span class="nt">${esc(detail(i))}</span></span></div>`
  ).join(''));
}
// 盤の中の名前札(アイコンつき)
const seatChip = (A, b, i, extra = '') =>
  `<div class="seat-name" data-public-seat="${i}">${avFor(A, b, i)}${esc(A.name(i))}${extra}</div>`;

// ---------------------------------------------------------------- 場面の縮小と FLIP アニメーション
let nineObserved = null, ninePrev = null;
function fitNine(wrap) {
  const s = wrap && wrap.querySelector('.nine-scene');
  if (!s) return;
  const r = Math.max(.1, Math.min((wrap.clientWidth - 10) / (+s.dataset.w || 900), (wrap.clientHeight - 10) / (+s.dataset.h || 560)));
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
  const W = mob ? 560 : 900, H = mob ? 880 : 560;
  A.board(`<div class="nine-scene${mob ? ' mob' : ''}" data-game="${b.kind}" data-ready="${A.canPlay}" data-w="${W}" data-h="${H}" style="width:${W}px;height:${H}px">${inner}</div>`, onTap);
  const wrap = document.getElementById('boardwrap');
  if (nineObserved !== wrap) {
    if (nineObserved) nineObserver.unobserve(nineObserved);
    if (wrap) nineObserver.observe(wrap);
    nineObserved = wrap;
  }
  fitNine(wrap);
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
function renderCoyote(b, A) {
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
  if (A.canPlay) {
    const setBid = (v) => { A.sel = { kind: 'coyote', moves: A.view.moves, bid: clamp(v, b.minBid, b.maxBid) }; A.redraw(); };
    const acts = [
      { label: '−', fn: () => setBid(bid - 1), enabled: bid > b.minBid },
      { label: `${bid} と宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) },
      { label: '＋', fn: () => setBid(bid + 1), enabled: bid < b.maxBid },
    ];
    if (b.canCoyote) acts.push({ label: 'コヨーテ!', move: 0, cls: 'danger', enabled: A.legal.has(0) });
    A.acts(acts);
  } else A.acts([]);
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
function renderSkull(b, A) {
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
    html += at(x, y + (mob ? 56 : 60), seatChip(A, b, seat, `<em>${'●'.repeat(b.points[seat]) || ''} ${b.passed[seat] && b.phase === 'bidding' ? 'パス' : ''}</em>`));
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
  html += at(cx, myY + (mob ? 66 : 68), seatChip(A, b, me, `<em>${'●'.repeat(b.points[b.me])}</em>`));
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
  const acts = [];
  if (A.canPlay) {
    if ((b.phase === 'play_or_bid' || b.phase === 'bidding') && b.totalPlaced > 0) {
      const setBid = (v) => { A.sel = { kind: 'skull', moves: A.view.moves, bid: clamp(v, minBid, b.totalPlaced) }; A.redraw(); };
      acts.push({ label: '−', fn: () => setBid(bid - 1), enabled: bid > minBid });
      acts.push({ label: `${bid} 枚で宣言`, move: bid, cls: 'gold', enabled: A.legal.has(bid) });
      acts.push({ label: '＋', fn: () => setBid(bid + 1), enabled: bid < b.totalPlaced });
      if (b.phase === 'bidding') acts.push({ label: 'パス', move: 0, enabled: A.legal.has(0) });
    }
    if (b.phase === 'discard_own') {
      acts.push({ label: '花を捨てる', move: 300, cls: 'gold', enabled: A.legal.has(300) });
      acts.push({ label: 'ドクロを捨てる', move: 301, cls: 'danger', enabled: A.legal.has(301) });
    }
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
const CUP_COLORS = ['#2E4A7D', '#7A4A21', '#8C2F39', '#2E6E6A', '#5B4A8A', '#7D6A1E'];
const cupSvg = (seat, w) => `<svg viewBox="0 0 100 84" width="${w}" aria-hidden="true"><ellipse cx="50" cy="14" rx="44" ry="12" fill="#00000030"/><path d="M8 14 L22 78 Q24 84 32 84 L68 84 Q76 84 78 78 L92 14 Q50 26 8 14Z" fill="${CUP_COLORS[seat % 6]}"/><path d="M8 14 Q50 26 92 14 Q50 4 8 14Z" fill="#00000038"/><ellipse cx="50" cy="13" rx="42" ry="10" fill="#14100C"/></svg>`;
function renderLiarsdice(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  // 宣言の初期値: 合法手の中で最小のコード(最小の個数→最小の目)
  const legalBids = [...A.legal].filter((m) => m >= 100);
  const minBidMove = legalBids.length ? Math.min(...legalBids) : 0;
  const selOk = A.sel && A.sel.kind === 'liarsdice' && A.sel.moves === A.view.moves;
  let qty = selOk ? A.sel.qty : Math.floor((minBidMove - 100) / 10);
  let face = selOk ? A.sel.face : (minBidMove - 100) % 10;
  if (!A.legal.has(100 + qty * 10 + face) && legalBids.length) {
    // 選んでいる目が合法でなくなったら、その目で合法な最小の個数へ寄せる
    const sameFace = legalBids.filter((m) => (m - 100) % 10 === face);
    if (sameFace.length) qty = Math.floor((Math.min(...sameFace) - 100) / 10);
    else { qty = Math.floor((minBidMove - 100) / 10); face = (minBidMove - 100) % 10; }
  }
  strip(A, b, (i) => !b.alive[i] ? '脱落' : `ダイス ${b.diceCounts[i]} 個`);
  A.round(`ラウンド ${b.roundNo}`);
  A.side(`<div class="kv"><span>場のダイス</span><b class="num">${b.totalDice} 個</b></div><div class="kv"><span>1 の扱い</span><b>${b.wildOnes ? 'ワイルド' : '通常'}</b></div>`);
  const mob = isMob();
  const slots = mob
    ? { 1: [[280, 130]], 2: [[105, 140], [455, 140]], 3: [[92, 168], [280, 128], [468, 168]], 4: [[80, 320], [115, 138], [445, 138], [480, 320]], 5: [[76, 350], [100, 140], [280, 112], [460, 140], [484, 350]] }
    : { 1: [[450, 122]], 2: [[215, 128], [685, 128]], 3: [[148, 238], [450, 116], [752, 238]], 4: [[138, 312], [232, 122], [668, 122], [762, 312]], 5: [[132, 332], [178, 132], [450, 106], [722, 132], [768, 332]] };
  const opps = [];
  for (let k = 1; k < b.n; k++) opps.push((me + k) % b.n);
  const slotList = slots[opps.length] || slots[3];
  let html = `<div class="nine-table ntable"><div class="feltin"></div></div>`;
  opps.forEach((seat, idx) => {
    const [x, y] = slotList[idx];
    html += at(x, y, `<div class="ld-cup${b.alive[seat] ? '' : ' dead'}${seat === b.lastBidder && b.currentBid ? ' bidder' : ''}">${cupSvg(seat, mob ? 74 : 84)}<span class="ld-count">${b.diceCounts[seat]}</span></div>`);
    html += at(x, y + (mob ? 62 : 68), seatChip(A, b, seat));
  });
  // 中央: 現在の宣言
  const cx = mob ? 280 : 450, cy = mob ? 408 : 268;
  if (b.currentBid) {
    html += at(cx, cy, `<div class="ld-plate"><span class="ld-plate-lab">${esc(A.name(b.lastBidder))} の宣言</span><span class="ld-plate-main">${dieFace(b.currentBid.face, mob ? 54 : 62)}<b>× ${b.currentBid.qty} 個</b></span></div>`);
  } else {
    html += at(cx, cy, `<div class="ld-plate"><span class="ld-plate-lab">まだ宣言なし</span><span class="ld-plate-main"><b>場のダイス ${b.totalDice} 個</b></span></div>`);
  }
  // 自分: 開いたカップとトレイ
  const myY = mob ? 622 : 420;
  const newRound = ninePrev && ninePrev.handle === A.handle && ninePrev.round !== b.roundNo;
  html += at(cx - (mob ? 118 : 150), myY, `<div class="ld-cup mine${newRound && !A.reduce ? ' shake' : ''}">${cupSvg(b.me, mob ? 86 : 96)}</div>`);
  if (b.myDice) {
    html += at(cx + (mob ? 52 : 66), myY + 2, `<div class="ld-tray${newRound && !A.reduce ? ' roll' : ''}">${b.myDice.map((v, i) => dieFace(v, mob ? 46 : 52)).join('')}</div>`);
  }
  html += at(mob ? cx : cx - 292, mob ? myY + 74 : myY + 30, seatChip(A, b, me));
  if (newRound && !A.reduce) A.sfx('DICE', 30);
  // 宣言パネル(目を選ぶ)
  if (A.canPlay && legalBids.length) {
    const faces = [1, 2, 3, 4, 5, 6].map((f) => {
      const ok = legalBids.some((m) => (m - 100) % 10 === f);
      return control(dieFace(f, mob ? 38 : 42), `data-ldface="${f}"`, `${f} の目を選ぶ`, ok, `ld-face-btn${f === face ? ' sel' : ''}`);
    }).join('');
    html += at(cx, mob ? 762 : 512, `<div class="ld-faces">${faces}</div>`);
  }
  // 直前ラウンドの公開演出
  const lr = b.lastRound;
  if (lr && ninePrev && ninePrev.handle === A.handle && ninePrev.lr !== lr.roundNo && !A.reduce) {
    const rows = lr.allDice.map((ds, i) => ds ? `<div class="ld-rev-row"><span class="ld-rev-name">${esc(A.name(i))}</span>${ds.map((v) =>
      `<span class="${v === lr.bid.face || (b.wildOnes && v === 1) ? 'ld-hit' : ''}">${dieFace(v, mob ? 30 : 34)}</span>`).join('')}</div>` : '').join('');
    html += `<div class="cy-reveal ld-reveal"><div class="ld-rev-rows">${rows}</div>` +
      `<div class="cy-rev-calc">「${lr.bid.face}」は場に <b>${lr.actualCount} 個</b>(宣言 ${lr.bid.qty} 個)</div>` +
      `<div class="cy-rev-result">${lr.action === 'exact' ? 'ジャスト' : 'ダウト'}! ${lr.callerSuccess ? `<b>${esc(A.name(lr.caller))}</b> の読みが当たりました` : `<b>${esc(A.name(lr.caller))}</b> の読みは外れました`}${lr.losers.length ? `(${lr.losers.map((s) => esc(A.name(s))).join('・')} がダイスを失います)` : ''}</div></div>`;
    A.anim(2400);
    A.sfx('CARD_FLIP', 60);
  }
  stage(A, b, html, (d) => {
    if (d.ldface != null && A.canPlay) {
      const f = Number(d.ldface);
      const sameFace = legalBids.filter((m) => (m - 100) % 10 === f);
      if (sameFace.length) {
        const keepQty = sameFace.some((m) => Math.floor((m - 100) / 10) === qty);
        A.sel = { kind: 'liarsdice', moves: A.view.moves, face: f, qty: keepQty ? qty : Math.floor((Math.min(...sameFace) - 100) / 10) };
        A.redraw();
      }
      return;
    }
    tapMove(A)(d);
  });
  if (ninePrev) { ninePrev.lr = lr ? lr.roundNo : ninePrev.lr; ninePrev.round = b.roundNo; }
  // 操作ボタン: 個数ステッパー+宣言+ダウト/ジャスト
  const acts = [];
  if (A.canPlay) {
    if (b.canDoubt) acts.push({ label: 'ダウト!', move: 0, cls: 'danger', enabled: A.legal.has(0) });
    if (b.canExact) acts.push({ label: 'ジャスト!', move: 1, enabled: A.legal.has(1) });
    if (legalBids.length) {
      const qtys = legalBids.filter((m) => (m - 100) % 10 === face).map((m) => Math.floor((m - 100) / 10));
      const setQty = (v) => { A.sel = { kind: 'liarsdice', moves: A.view.moves, face, qty: v }; A.redraw(); };
      acts.push({ label: '−', fn: () => setQty(Math.max(Math.min(...qtys), qty - 1)), enabled: qty > Math.min(...qtys) });
      acts.push({ label: `${face} が ${qty} 個と宣言`, move: 100 + qty * 10 + face, cls: 'gold', enabled: A.legal.has(100 + qty * 10 + face) });
      acts.push({ label: '＋', fn: () => setQty(Math.min(Math.max(...qtys), qty + 1)), enabled: qty < Math.max(...qtys) });
    }
  }
  A.acts(acts);
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
function renderIncangold(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `テント ${b.tentGems[i]} 個 ・ ${b.inCave[i] ? `保持 ${b.roundGems[i]} 個` : '帰還済み'}`);
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
      html += at(268 + k * 128, 500, `<div class="seat-name">${avFor(A, b, seat)}<em>${b.inCave[seat] ? `保持 ${b.roundGems[seat]}` : `テント ${b.tentGems[seat]}`}${b.decided[seat] ? ' ✓' : ''}</em></div>`);
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
  const acts = [];
  if (A.canPlay && b.inCave[b.me]) {
    acts.push({ label: '進む', move: 1, cls: 'gold', enabled: A.legal.has(1) });
    acts.push({ label: '帰る', move: 0, enabled: A.legal.has(0) });
  }
  A.acts(acts);
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
function renderTake6(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  strip(A, b, (i) => `失点 ${b.totalScores[i]}(今回 ${b.roundScores[i]})`);
  A.round(b.endMode === 'to66' ? `ラウンド ${b.roundNo} ・ ${b.turnNo} ターン目` : `${b.turnNo} ターン目`);
  A.side(`<div class="kv"><span>失点</span><b class="num">${b.me >= 0 ? b.totalScores[b.me] : 0}</b></div>`);
  const mob = isMob();
  const cw = mob ? 56 : 62, ch = cw * 1.42;
  const rowY = (r) => mob ? 116 + r * 112 : 62 + r * 112;
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
    if (b.handCounts[seat] > 0 || b.decided[seat]) backs.push(`<div class="t6-opp">${t6card(null, mob ? 36 : 46, '', 't6-back-' + seat)}<span>${esc(A.name(seat))}</span>${b.decided[seat] ? '<em>選択済み</em>' : ''}</div>`);
  }
  if (backs.length) html += at(mob ? 280 : 806, mob ? 40 : 148, `<div class="t6-opps${mob ? ' row' : ''}">${backs.join('')}</div>`);
  // 手札(扇形)
  const hand = b.myHand || [];
  const handCardW = mob ? 58 : 74;
  const pitch = mob ? Math.min(48, 480 / Math.max(1, hand.length)) : Math.min(66, 720 / Math.max(1, hand.length));
  const handW = hand.length ? (hand.length - 1) * pitch + handCardW : 0;
  const handHtml = hand.map((n, i) => {
    const chosen = b.myChoice === n;
    const x = -handW / 2 + handCardW / 2 + i * pitch;
    const inner = t6card(n, handCardW, chosen ? 'chosen' : '', 't6-card-' + n);
    const btn = b.phase === 'choose' ? moveBtn(A, n, inner, `${n} を出す`, 't6-hand-btn') : inner;
    return `<span class="t6-hand-card${chosen ? ' chosen' : ''}" style="left:${x}px">${btn}</span>`;
  }).join('');
  html += at(mob ? 280 : 450, mob ? 800 : 512, `<div class="t6-hand">${handHtml}</div>`);
  if (b.phase === 'rowPick' && A.view.toMove === b.me) html += at(mob ? 280 : 450, mob ? 596 : 452, `<div class="board-label">どの列も置けません。引き取る列を選んでください</div>`);
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
  const boardPx = mob ? 500 : 452;
  const cell = boardPx / size;
  const bx = mob ? 30 : 26, by = mob ? 58 : 52;
  // 盤面 SVG
  let cellsSvg = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = b.board[y * size + x];
    if (v >= 0) cellsSvg += `<rect x="${(x * cell + 1).toFixed(1)}" y="${(y * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="${BK_COLORS[v]}"/>`;
  }
  // 開始角マーカー
  const corners = [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]];
  let cornerSvg = '';
  corners.forEach(([x, y], c) => { if (c < b.colorCount) cornerSvg += `<rect x="${(x * cell + cell * .22).toFixed(1)}" y="${(y * cell + cell * .22).toFixed(1)}" width="${(cell * .56).toFixed(1)}" height="${(cell * .56).toFixed(1)}" fill="none" stroke="${BK_COLORS[c]}" stroke-width="2" opacity=".65"/>`; });
  // 直前に置かれたピースの光
  let lastSvg = '';
  if (b.lastAction && b.lastAction.type === 'place') {
    lastSvg = b.lastAction.cells.map((idx) => { const x = idx % size, y = Math.floor(idx / size); return `<rect x="${(x * cell + 1).toFixed(1)}" y="${(y * cell + 1).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(cell - 2).toFixed(1)}" rx="${Math.max(2, cell * .18)}" fill="none" stroke="#FFF" stroke-width="2.4" class="bk-last"/>`; }).join('');
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
  const gridLines = `<path d="${Array.from({ length: size + 1 }, (_, i) => `M${(i * cell).toFixed(1)} 0V${boardPx}M0 ${(i * cell).toFixed(1)}H${boardPx}`).join('')}" stroke="#D5C8A6" stroke-width="1"/>`;
  const gridSvg = `<svg class="bk-svg" viewBox="0 0 ${boardPx} ${boardPx}" width="${boardPx}" height="${boardPx}"><rect width="${boardPx}" height="${boardPx}" fill="#EFE7D2"/>${gridLines}${cellsSvg}${cornerSvg}${lastSvg}${ghostSvg}</svg>`;
  let html = `<div class="nine-table bk-table"></div>`;
  html += at(bx + boardPx / 2, by + boardPx / 2, `<div class="bk-board" style="transform:translate(${bkZoom.x}px,${bkZoom.y}px) scale(${bkZoom.z})">${gridSvg}</div>`);
  if (mob) html += at(530, 30, `<div class="bk-zoombtns"><button type="button" class="bk-zbtn" data-bkzoom="in" aria-label="盤を拡大">＋</button><button type="button" class="bk-zbtn" data-bkzoom="out" aria-label="盤を縮小">−</button></div>`);
  // トレイ
  if (NC && b.me >= 0 && !b.finished) {
    const shownColor = myTurn ? myColor : trayColor;
    const oris0 = (p) => NC.orientationsFor(p)[0];
    const pieceIcon = (p, cs) => {
      const shape = oris0(p);
      const w = Math.max(...shape.map((c) => c[0])) + 1, h = Math.max(...shape.map((c) => c[1])) + 1;
      return `<svg viewBox="0 0 ${w * cs} ${h * cs}" width="${w * cs}" height="${h * cs}">${shape.map(([x, y]) => `<rect x="${x * cs + .5}" y="${y * cs + .5}" width="${cs - 1}" height="${cs - 1}" rx="2" fill="${BK_COLORS[shownColor]}"/>`).join('')}</svg>`;
    };
    const tray = remaining.map((p) => {
      const can = byPiece.has(p);
      const inner = pieceIcon(p, mob ? 6 : 8);
      return myTurn ? control(inner, `data-bkpiece="${p}"`, `ピース ${p + 1}${can ? '' : '(置けません)'}`, true, `bk-piece${p === selPiece ? ' sel' : ''}${can ? '' : ' cannot'}`)
        : `<span class="bk-piece">${inner}</span>`;
    }).join('');
    if (mob) html += at(280, 716, `<div class="bk-tray mob"><div class="bk-tray-head">${BK_NAMES[shownColor]}のピース 残り ${remaining.length} / 21</div><div class="bk-pieces">${tray}</div></div>`);
    else html += at(692, 306, `<div class="bk-tray"><div class="bk-tray-head">${BK_NAMES[shownColor]}のピース 残り ${remaining.length} / 21</div><div class="bk-pieces">${tray}</div></div>`);
  }
  if (b.lastAction && b.lastAction.type === 'pass') html += at(mob ? 280 : 450, mob ? 36 : 26, note(`${A.name(b.lastAction.seat)} は置ける場所がなくパス`));
  if (!NC) setTimeout(() => { if (document.querySelector('.nine-scene[data-game="blokus"]')) drawPlay(true); }, 350);
  stage(A, b, html, (d, el) => {
    if (Date.now() - bkDraggedAt < 300) return;
    if (d.bkzoom) {
      bkZoom.z = clamp(bkZoom.z + (d.bkzoom === 'in' ? .35 : -.35), 1, 2.1);
      if (bkZoom.z === 1) { bkZoom.x = 0; bkZoom.y = 0; }
      A.redraw();
      return;
    }
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
  // 拡大時のドラッグ移動(タップと区別するため、動いた場合はクリックを無効化)
  if (mob && bkZoom.z > 1) {
    const boardEl = document.querySelector('.bk-board');
    if (boardEl) {
      let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      boardEl.style.touchAction = 'none';
      boardEl.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; ox = bkZoom.x; oy = bkZoom.y; moved = false; });
      boardEl.addEventListener('pointermove', (e) => {
        if (sx === 0) return;
        const dx = (e.clientX - sx) / bkZoom.z, dy = (e.clientY - sy) / bkZoom.z;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 7) moved = true;
        if (moved) boardEl.style.transform = `translate(${ox + dx}px,${oy + dy}px) scale(${bkZoom.z})`;
        boardEl._dx = ox + dx; boardEl._dy = oy + dy;
      });
      boardEl.addEventListener('pointerup', () => { if (moved) { bkZoom.x = boardEl._dx || 0; bkZoom.y = boardEl._dy || 0; bkDraggedAt = Date.now(); } sx = 0; });
    }
  }
  const acts = [];
  if (NC && myTurn && selPiece != null && byPiece.get(selPiece) && byPiece.get(selPiece).size > 1) {
    acts.push({ label: '向きを変える', fn: () => {
      const oris = [...byPiece.get(selPiece).keys()].sort((a, z) => a - z);
      A.sel = { kind: 'blokus', moves: A.view.moves, piece: selPiece, ori: oris[(oris.indexOf(selOri) + 1) % oris.length] };
      A.redraw();
    }, enabled: true });
  }
  if (NC && A.canPlay && A.legal.has(NC.BLOKUS_MOVE_PASS)) acts.push({ label: 'パス', move: NC.BLOKUS_MOVE_PASS, cls: 'gold', enabled: true });
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
  const cell = mob ? 46 : 44, groove = mob ? 11 : 11;
  const step = cell + groove;
  const boardPx = 9 * cell + 8 * groove;
  const bx = mob ? 280 - boardPx / 2 : 450 - boardPx / 2, by = mob ? 420 - boardPx / 2 : 282 - boardPx / 2;
  const px = (dx) => bx + dx * step, py = (dy) => by + dy * step;
  let svg = '';
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
    svg += `<rect x="${px(dx)}" y="${py(dy)}" width="${cell}" height="${cell}" rx="7" fill="#E9C98F"/>`;
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
  // 壁の置き場(当たり判定): 溝の交点を押すとゴーストが出る
  let hitSvg = '';
  if (A.canPlay && b.turn === b.me && b.wallsLeft[b.me] > 0) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const [dx, dy] = tf(x, y);
      hitSvg += `<rect x="${px(dx) + cell - 4}" y="${py(dy) + cell - 4}" width="${groove + 8}" height="${groove + 8}" fill="transparent" data-qdhit="${x},${y}" class="qd-hit"/>`;
    }
  }
  // ゴースト壁
  const selOk = A.sel && A.sel.kind === 'quoridor' && A.sel.moves === A.view.moves;
  const ghost = selOk ? A.sel.wall : null;
  let ghostSvg = '';
  if (ghost) {
    const mv = 100 + (ghost.y * 8 + ghost.x) * 2 + (ghost.vertical ? 1 : 0);
    ghostSvg = wallRect(ghost.x, ghost.y, ghost.vertical, `qd-ghost${A.legal.has(mv) ? '' : ' ng'}`);
  }
  // 移動候補
  let destSvg = '';
  if (A.canPlay && b.turn === b.me) {
    for (const m of A.legal) {
      if (m >= 100) continue;
      const [dx, dy] = tf(m % 9, Math.floor(m / 9));
      const isJump = Math.abs(dx - tf(b.pawns[b.me].x, b.pawns[b.me].y)[0]) + Math.abs(dy - tf(b.pawns[b.me].x, b.pawns[b.me].y)[1]) > 1;
      destSvg += isJump
        ? `<circle cx="${px(dx) + cell / 2}" cy="${py(dy) + cell / 2}" r="${cell * .30}" fill="none" stroke="#7A4A12" stroke-width="3.4" data-m="${m}" class="qd-dest"/>`
        : `<circle cx="${px(dx) + cell / 2}" cy="${py(dy) + cell / 2}" r="${cell * .17}" fill="#7A4A12" fill-opacity=".55" data-m="${m}" class="qd-dest"/>`;
    }
  }
  // コマ(HTML で重ねて FLIP アニメーションを使う)
  let pawnsHtml = '';
  b.pawns.forEach((p, s) => {
    const [dx, dy] = tf(p.x, p.y);
    pawnsHtml += at(px(dx) + cell / 2, py(dy) + cell / 2, `<span class="qd-pawn" data-piece="qd-pawn-${s}" style="--pc:${QD_COLORS[s]};--ps:${cell * .78}px"></span>`);
  });
  // 壁の残数帯(上=相手、下=自分)
  const stock = (seat, horizontal) => {
    const bars = Array.from({ length: b.wallsLeft[seat] }, () => `<span class="qd-stock-bar${horizontal ? '' : ' v'}"></span>`).join('');
    return `<div class="qd-stock"><span class="qd-stock-dot" style="background:${QD_COLORS[seat]}"></span>${bars}</div>`;
  };
  let html = `<div class="nine-table qd-table"></div>`;
  const SW = mob ? 560 : 900, SH = mob ? 880 : 560;
  html += at(SW / 2, SH / 2, `<svg class="qd-svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}">${svg}${hitSvg}${ghostSvg}${destSvg}</svg>`);
  html += pawnsHtml;
  html += at(mob ? 280 : 450, (mob ? 420 : 282) - boardPx / 2 - 24, stock((me + 1) % b.n, true));
  html += at(mob ? 280 : 450, (mob ? 420 : 282) + boardPx / 2 + 24, stock(me, true));
  if (b.n >= 3) html += at((mob ? 280 : 450) - boardPx / 2 - 30, mob ? 420 : 282, `<div class="qd-stock side">${stock((me + 2) % b.n, false)}</div>`);
  if (b.n >= 4) html += at((mob ? 280 : 450) + boardPx / 2 + 30, mob ? 420 : 282, `<div class="qd-stock side">${stock((me + 3) % b.n, false)}</div>`);
  stage(A, b, html, (d) => {
    if (d.qdhit && A.canPlay) {
      const [x, y] = d.qdhit.split(',').map(Number);
      const cur = selOk && A.sel.wall;
      const vertical = cur && cur.x === x && cur.y === y ? cur.vertical : false;
      A.sel = { kind: 'quoridor', moves: A.view.moves, wall: { x, y, vertical } };
      A.sfx('TILE', 0, { volume: .4 });
      A.redraw();
      return;
    }
    tapMove(A)(d);
  });
  const acts = [];
  if (ghost && A.canPlay) {
    const mv = 100 + (ghost.y * 8 + ghost.x) * 2 + (ghost.vertical ? 1 : 0);
    acts.push({ label: '向きを変える', fn: () => { A.sel = { kind: 'quoridor', moves: A.view.moves, wall: { x: ghost.x, y: ghost.y, vertical: !ghost.vertical } }; A.redraw(); }, enabled: true });
    acts.push({ label: '壁を置く', move: mv, cls: 'gold', enabled: A.legal.has(mv) });
  }
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
function bsBoardSvg(o) {
  const cell = o.cell, pad = o.labels ? Math.round(cell * 0.62) : 0;
  const W = pad + cell * 10 + 4;
  const X = (c) => pad + (c % 10) * cell, Y = (c) => pad + Math.floor(c / 10) * cell;
  let s = `<svg class="bs-svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">`;
  s += `<defs><linearGradient id="bsSea${o.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D5F8A"/><stop offset="1" stop-color="#0C3556"/></linearGradient>` +
    `<linearGradient id="bsHull${o.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9BFD2"/><stop offset=".5" stop-color="#5F7A90"/><stop offset="1" stop-color="#3D5A72"/></linearGradient></defs>`;
  s += `<rect x="${pad}" y="${pad}" width="${cell * 10}" height="${cell * 10}" fill="url(#bsSea${o.id})" rx="4"/>`;
  if (o.labels) {
    for (let i = 0; i < 10; i++) {
      s += `<text x="${pad + i * cell + cell / 2}" y="${pad * 0.72}" class="bs-lab">${'ABCDEFGHIJ'[i]}</text>`;
      s += `<text x="${pad * 0.52}" y="${pad + i * cell + cell * 0.66}" class="bs-lab">${i + 1}</text>`;
    }
  }
  let gl = '';
  for (let i = 1; i < 10; i++) gl += `<line x1="${pad + i * cell}" y1="${pad}" x2="${pad + i * cell}" y2="${pad + cell * 10}"/><line x1="${pad}" y1="${pad + i * cell}" x2="${pad + cell * 10}" y2="${pad + i * cell}"/>`;
  s += `<g stroke="#FFFFFF" stroke-opacity=".13">${gl}</g>`;
  for (const sh of o.ships || []) {
    if (!sh.cells || !sh.cells.length) continue;
    const xs = sh.cells.map(c => c % 10), ys = sh.cells.map(c => Math.floor(c / 10));
    const horiz = ys[0] === ys[ys.length - 1];
    const x0 = pad + Math.min(...xs) * cell, y0 = pad + Math.min(...ys) * cell;
    const w = horiz ? sh.cells.length * cell : cell, h = horiz ? cell : sh.cells.length * cell;
    s += `<rect x="${x0 + 1.5}" y="${y0 + 1.5}" width="${w - 3}" height="${h - 3}" rx="${cell * 0.34}" fill="url(#bsHull${o.id})" stroke="${sh.sunk ? '#8F1D1D' : '#22384C'}" stroke-width="${sh.sunk ? 2.6 : 1.4}"/>`;
    for (const c of sh.cells) s += `<circle cx="${X(c) + cell / 2}" cy="${Y(c) + cell / 2}" r="${Math.max(1.6, cell * 0.09)}" fill="#22384C" opacity=".4"/>`;
  }
  for (let c = 0; c < 100; c++) {
    const st = o.board ? o.board[c] : 'unknown';
    const cx = X(c) + cell / 2, cy = Y(c) + cell / 2;
    if (st === 'miss') s += `<g><circle cx="${cx}" cy="${cy}" r="${cell * 0.15}" fill="#EAF6FF"/><circle cx="${cx}" cy="${cy}" r="${cell * 0.30}" fill="none" stroke="#EAF6FF" stroke-opacity=".45" stroke-width="1.6"/></g>`;
    else if (st === 'hit') s += `<g><circle cx="${cx}" cy="${cy}" r="${cell * 0.29}" fill="#FF7A29"/><circle cx="${cx}" cy="${cy}" r="${cell * 0.16}" fill="#FFD23E"/><path d="M ${cx - cell * 0.26} ${cy - cell * 0.26} L ${cx + cell * 0.26} ${cy + cell * 0.26} M ${cx + cell * 0.26} ${cy - cell * 0.26} L ${cx - cell * 0.26} ${cy + cell * 0.26}" stroke="#8F1D1D" stroke-width="${Math.max(1.6, cell * 0.085)}" stroke-linecap="round"/></g>`;
  }
  if (o.ghost) {
    const fill = o.ghost.ok ? '#3DDC74' : '#E5484D';
    for (const c of o.ghost.cells) s += `<rect x="${X(c) + 1}" y="${Y(c) + 1}" width="${cell - 2}" height="${cell - 2}" rx="5" fill="${fill}" fill-opacity=".5" stroke="${fill}" stroke-width="1.6"/>`;
  }
  if (o.lastCell != null && o.lastCell >= 0) {
    s += `<circle cx="${X(o.lastCell) + cell / 2}" cy="${Y(o.lastCell) + cell / 2}" r="${cell * 0.46}" fill="none" stroke="#FFD23E" stroke-width="2.6" class="${o.boom ? 'bs-boom' : ''}"/>`;
  }
  if (o.target != null && o.target >= 0) {
    const cx = X(o.target) + cell / 2, cy = Y(o.target) + cell / 2, r = cell * 0.44;
    s += `<g class="bs-reticle" stroke="#FF4757" stroke-width="2.6" fill="none"><circle cx="${cx}" cy="${cy}" r="${r}"/><line x1="${cx - r - 4}" y1="${cy}" x2="${cx - r + 6}" y2="${cy}"/><line x1="${cx + r - 6}" y1="${cy}" x2="${cx + r + 4}" y2="${cy}"/><line x1="${cx}" y1="${cy - r - 4}" x2="${cx}" y2="${cy - r + 6}"/><line x1="${cx}" y1="${cy + r - 6}" x2="${cx}" y2="${cy + r + 4}"/></g>`;
  }
  if (o.tap) {
    for (let c = 0; c < 100; c++) {
      if (o.tap === 'unknown' && o.board && o.board[c] !== 'unknown') continue;
      s += `<rect x="${X(c)}" y="${Y(c)}" width="${cell}" height="${cell}" fill="transparent" data-bscell="${c}" class="bs-cell"/>`;
    }
  }
  return s + '</svg>';
}
function renderBattleship(b, A) {
  prep(A);
  const me = b.me, foe = me >= 0 ? 1 - me : -1;
  const mob = isMob();
  const sunkOf = (ships) => ships ? ships.filter(s => s.sunk).length : 0;
  strip(A, b, (i) => {
    if (me >= 0) return i === me ? `自艦 撃沈 ${sunkOf(b.myShips)} / 5` : `撃沈 ${sunkOf(b.enemyShips)} / 5`;
    return `撃沈 ${sunkOf(b.publicShips && b.publicShips[i])} / 5`;
  });
  A.round(b.phase === 'place' ? '配置フェーズ' : b.phase === 'done' ? '対戦終了' : '攻撃フェーズ');
  let sideHtml = `<div class="kv"><span>手番</span><b>${b.turn >= 0 ? esc(A.name(b.turn)) : '―'}</b></div>`;
  if (b.phase === 'battle' && b.shotsLeft > 1) sideHtml += `<div class="kv"><span>この手番</span><b>あと ${b.shotsLeft} 発</b></div>`;
  if (b.phase === 'place' && me >= 0) sideHtml += `<div class="kv"><span>配置</span><b>あなた ${b.placedCounts[me]} / 5 ・ 相手 ${b.placedCounts[foe]} / 5</b></div>`;
  A.side(sideHtml);
  // 直前の射撃の結果音(再描画では鳴らさない)
  const la = b.lastAction;
  const shotKey = la && la.type === 'shot' ? `${la.seat}:${la.cell}:${b.phase}` : '';
  if (shotKey && ninePrev.bsKey !== shotKey) {
    if (la.sunk) { A.sfx('TAKE', 0, { volume: .9 }); A.sfx('TAKE', 260, { volume: .7, rate: .8 }); }
    else if (la.hit) A.sfx('TAKE', 0, { volume: .8 });
    else A.sfx('MARBLE', 0, { volume: .55, rate: .55 });
  }
  const selOk = A.sel && A.sel.kind === 'battleship' && A.sel.moves === A.view.moves;
  let html = `<div class="nine-table bs-table"></div>`;
  const acts = [];
  const fleetRows = (ships, mine) => ships.map((sh, i) => {
    const len = BS_FLEET[i];
    const blocks = Array.from({ length: len }, () => '<span class="bs-blk"></span>').join('');
    let st, cls = '';
    if (mine) {
      if (!sh.placed) { st = '未配置'; cls = 'wait'; }
      else if (sh.sunk) { st = '撃沈'; cls = 'sunk'; }
      else if (sh.cells.some(c => b.ownBoard && b.ownBoard[c] === 'hit')) { st = '損傷'; cls = 'dmg'; }
      else st = '健在';
    } else {
      st = sh.sunk ? '撃沈' : '未発見';
      cls = sh.sunk ? 'sunk' : 'wait';
    }
    return `<div class="bs-fleet ${cls}"><span class="bs-fname">${BS_NAMES[i]}</span><span class="bs-blocks">${blocks}</span><span class="bs-fst">${st}</span></div>`;
  }).join('');

  if (b.phase === 'place' && me >= 0 && b.turn === me && A.canPlay) {
    // ===== 自分の配置ターン =====
    const unplaced = b.myShips.filter(s => !s.placed);
    let sel = selOk ? A.sel : null;
    if (!sel || !unplaced.some(s => s.index === sel.ship)) sel = { kind: 'battleship', moves: A.view.moves, ship: unplaced[0].index, dir: 0, cell: null };
    let ghost = null, ghostMove = -1;
    if (sel.cell != null) {
      const gx = sel.cell % 10, gy = Math.floor(sel.cell / 10);
      const cells = bsCellsLocal(sel.ship, sel.dir, gx, gy);
      ghostMove = sel.ship * 1000 + sel.dir * 100 + sel.cell;
      ghost = { cells, ok: cells.length > 0 && A.legal.has(ghostMove) };
    }
    const cell = mob ? 42 : 36;
    html += at(mob ? 280 : 300, mob ? 282 : 282, bsBoardSvg({ id: 'p', cell, labels: true, board: b.ownBoard, ships: b.myShips, tap: 'all', ghost }));
    const rows = b.myShips.map((sh) => {
      const blocks = Array.from({ length: BS_FLEET[sh.index] }, () => '<span class="bs-blk big"></span>').join('');
      const cls = sh.placed ? 'placed' : sel.ship === sh.index ? 'sel' : '';
      return `<div class="bs-shiprow ${cls}" data-bsship="${sh.index}"><span class="bs-fname">${BS_NAMES[sh.index]}</span><span class="bs-blocks">${blocks}</span><span class="bs-fst">${sh.placed ? '配置済み ✓' : sel.ship === sh.index ? '選択中' : ''}</span></div>`;
    }).join('');
    html += at(mob ? 280 : 712, mob ? 690 : 282, `<div class="bs-tray"><div class="bs-tray-t">艦を選んで、海域をタップ<br><span>向き： ${sel.dir === 0 ? '横' : '縦'}</span></div>${rows}</div>`);
    stage(A, b, html, (d) => {
      if (d.bscell != null && A.canPlay) {
        A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: sel.dir, cell: Number(d.bscell) };
        A.sfx('TILE', 0, { volume: .35 });
        A.redraw();
        return;
      }
      if (d.bsship != null && A.canPlay) {
        const idx = Number(d.bsship);
        if (!b.myShips[idx].placed) {
          A.sel = { kind: 'battleship', moves: A.view.moves, ship: idx, dir: idx === sel.ship ? 1 - sel.dir : sel.dir, cell: null };
          A.redraw();
        }
        return;
      }
      tapMove(A)(d);
    });
    acts.push({ label: '向きを変える', fn: () => { A.sel = { kind: 'battleship', moves: A.view.moves, ship: sel.ship, dir: 1 - sel.dir, cell: sel.cell }; A.redraw(); }, enabled: true });
    acts.push({ label: 'ここに置く', cls: 'gold', enabled: !!(ghost && ghost.ok), fn: () => { A.sfx('TILE', 0, { volume: .8 }); A.play(ghostMove); } });
  } else if (b.phase === 'place') {
    // ===== 相手の配置待ち / 観戦 =====
    const cell = mob ? 36 : 30;
    if (me >= 0) {
      html += at(mob ? 280 : 450, mob ? 330 : 270, bsBoardSvg({ id: 'p', cell, labels: true, board: b.ownBoard, ships: b.myShips }));
      html += at(mob ? 280 : 450, mob ? 640 : 500, `<div class="nine-note">相手が艦を配置しています…</div>`);
    } else {
      html += at(mob ? 280 : 450, mob ? 400 : 282, `<div class="nine-note">配置フェーズ（観戦中）</div>`);
    }
    stage(A, b, html, tapMove(A));
  } else {
    // ===== 攻撃 / 終了 =====
    const myTurn = me >= 0 && b.turn === me && A.canPlay && b.phase === 'battle';
    const target = selOk && A.sel.target != null ? A.sel.target : -1;
    const lastOnEnemy = la && la.type === 'shot' && la.seat === me ? la.cell : -1;
    const lastOnOwn = la && la.type === 'shot' && la.seat !== me ? la.cell : -1;
    const boom = !!shotKey && ninePrev.bsKey !== shotKey;
    if (me >= 0) {
      const eCell = mob ? 42 : 30, oCell = mob ? 19 : 13;
      html += at(mob ? 280 : 340, mob ? 300 : 208, bsBoardSvg({ id: 'e', cell: eCell, labels: true, board: b.enemyBoard, ships: b.enemyShips, tap: myTurn ? 'unknown' : null, target: myTurn ? target : -1, lastCell: lastOnEnemy, boom }));
      html += at(mob ? 280 : 340, mob ? 48 : 28, `<div class="bs-cap">敵の海域</div>`);
      html += at(mob ? 155 : 340, mob ? 668 : 470, bsBoardSvg({ id: 'o', cell: oCell, labels: false, board: b.ownBoard, ships: b.myShips, lastCell: lastOnOwn, boom }));
      if (!mob) html += at(340, 386, `<div class="bs-cap">自分の海域</div>`);
      const res = la && la.type === 'shot'
        ? (la.seat === me
          ? (la.sunk ? `命中！ ${BS_NAMES[la.shipIdx]}（全長${la.sunkLength}）を撃沈！` : la.hit ? '命中！' : 'ハズレ…')
          : (la.sunk ? `被弾… ${BS_NAMES[la.shipIdx]}が撃沈` : la.hit ? '被弾！' : '相手の攻撃はハズレ'))
        : '';
      html += at(mob ? 405 : 716, mob ? 612 : 130, `<div class="bs-panel${mob ? ' compact' : ''}"><div class="bs-panel-t">敵艦隊</div>${fleetRows(b.enemyShips, false)}</div>`);
      html += at(mob ? 405 : 716, mob ? 765 : 330, `<div class="bs-panel${mob ? ' compact' : ''}"><div class="bs-panel-t">自艦隊</div>${fleetRows(b.myShips, true)}</div>`);
      if (res) html += at(mob ? 155 : 716, mob ? 548 : 478, `<div class="bs-result ${la.hit ? 'hit' : ''}">${res}</div>`);
      stage(A, b, html, (d) => {
        if (d.bscell != null && myTurn) {
          A.sel = { kind: 'battleship', moves: A.view.moves, target: Number(d.bscell) };
          A.sfx('TILE', 0, { volume: .35 });
          A.redraw();
          return;
        }
        tapMove(A)(d);
      });
      if (myTurn) acts.push(target >= 0 ? { label: '発射！', move: target, cls: 'gold', enabled: true } : { label: '発射！', cls: 'gold', enabled: false });
    } else {
      // 観戦: 両海域に撃沈艦のみ表示
      const cell = mob ? 24 : 22;
      html += at(mob ? 140 : 250, mob ? 300 : 282, bsBoardSvg({ id: 's0', cell, labels: false, board: null, ships: b.publicShips ? b.publicShips[0] : [] }));
      html += at(mob ? 420 : 650, mob ? 300 : 282, bsBoardSvg({ id: 's1', cell, labels: false, board: null, ships: b.publicShips ? b.publicShips[1] : [] }));
      html += at(mob ? 280 : 450, mob ? 620 : 500, `<div class="nine-note">観戦中（撃沈した艦だけが見えます）</div>`);
      stage(A, b, html, tapMove(A));
    }
  }
  A.acts(acts);
  ninePrev.bsKey = shotKey;
}
window.RENDER.battleship = renderBattleship;

// ================================================================ チンチロリン
const CC_BOWL = (D) => `<svg viewBox="0 0 320 320" width="${D}" height="${D}"><defs><radialGradient id="ccIn" cx=".5" cy=".42" r=".68"><stop offset="0" stop-color="#FBF7EC"/><stop offset=".75" stop-color="#EFE6D0"/><stop offset="1" stop-color="#D8C9A6"/></radialGradient><radialGradient id="ccOut" cx=".5" cy=".35" r=".85"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DFE5EB"/></radialGradient></defs><ellipse cx="160" cy="304" rx="104" ry="12" fill="#00000035"/><circle cx="160" cy="158" r="150" fill="url(#ccOut)" stroke="#B9C2CC" stroke-width="1.5"/><circle cx="160" cy="158" r="138" fill="none" stroke="#2B5EA7" stroke-width="6"/><circle cx="160" cy="158" r="126" fill="none" stroke="#2B5EA7" stroke-width="2.6"/><circle cx="160" cy="158" r="117" fill="url(#ccIn)"/><circle cx="160" cy="158" r="117" fill="none" stroke="#C9B98F" stroke-width="1.4"/></svg>`;
function renderChinchiro(b, A) {
  prep(A);
  const me = Math.max(0, b.me);
  const mob = isMob();
  strip(A, b, (i) => `チップ ${b.chips[i]} 枚${i === b.banker ? ' ・ 親' : ''}`);
  A.round(`第 ${b.roundNo} / ${b.totalRounds} ラウンド`);
  A.side(`<div class="kv"><span>親</span><b>${esc(A.name(b.banker))}</b></div><div class="kv"><span>賭け金</span><b>${b.bet} 枚</b></div><div class="kv"><span>手番</span><b>${b.turn >= 0 ? esc(A.name(b.turn)) : '―'}</b></div>`);
  const la = b.lastAction && b.lastAction.type === 'roll' ? b.lastAction : null;
  const lr = b.lastRound;
  const lrJust = !!lr && ninePrev && ninePrev.ccLr !== lr.roundNo;
  const willAnim = !!(ninePrev && ninePrev.handle === A.handle && ninePrev.moves + 1 === A.view.moves && !A.reduce);
  const diceShow = b.dice.length ? b.dice : (lrJust && la ? la.dice : []);
  const D = mob ? 322 : 280, ds = mob ? 60 : 56;
  const bowlCx = mob ? 280 : 450, bowlCy = mob ? 428 : 258;
  const offs = [[-0.34, -0.20], [0.35, -0.17], [0.01, 0.30]];
  const canRoll = A.canPlay && b.turn === b.me && !b.reason;
  let html = `<div class="nine-table cc-table"></div>`;
  html += at(bowlCx, bowlCy, `<div class="cc-bowlwrap" style="width:${D}px;height:${D}px" ${canRoll ? 'data-m="0"' : ''}>${CC_BOWL(D)}${diceShow.map((v, i) => `<span class="cc-die" data-final="${v}" data-size="${ds}" style="left:${D / 2 + offs[i][0] * D}px;top:${D / 2 + offs[i][1] * D}px">${dieFace(v, ds)}</span>`).join('')}</div>`);
  // 直前の振り結果の木札
  let tag = '', tagCls = '';
  if (la) {
    if (la.settled && la.eval) { tag = `${esc(A.name(la.seat))}： ${la.eval.label}`; tagCls = la.eval.kind; }
    else tag = `目なし… ${esc(A.name(la.seat))} あと ${3 - la.attempts} 回`;
  } else if (!b.reason) tag = '親から順に振ります';
  let tagHtml = '';
  if (tag) tagHtml += `<div class="cc-tag ${tagCls}">${tag}</div>`;
  if (b.turn >= 0 && !b.reason) {
    const dots = '●'.repeat(b.attempts) + '○'.repeat(Math.max(0, 3 - b.attempts));
    tagHtml += `<div class="cc-attempts">${esc(A.name(b.turn))} の振り ${dots}</div>`;
  }
  if (tagHtml) html += at(bowlCx, bowlCy + D / 2 + (mob ? 44 : 32), `<div class="cc-tagwrap">${tagHtml}</div>`);
  // 席のパネル(自分以外は周囲、自分は下)
  const POS = mob
    ? { 2: [[280, 96]], 3: [[108, 104], [452, 104]], 4: [[102, 120], [280, 78], [458, 120]], 5: [[94, 132], [188, 72], [372, 72], [466, 132]], 6: [[90, 144], [166, 70], [280, 60], [394, 70], [470, 144]] }
    : { 2: [[450, 84]], 3: [[166, 96], [734, 96]], 4: [[138, 112], [450, 68], [762, 112]], 5: [[128, 122], [298, 64], [602, 64], [772, 122]], 6: [[118, 132], [270, 60], [450, 50], [630, 60], [782, 132]] };
  const seatPanel = (seat) => {
    const res = b.results[seat];
    const resHtml = res
      ? `<div class="cc-seat-res">${res.dice.map((v) => dieFace(v, mob ? 21 : 23)).join('')}<b class="cc-res-lab ${res.kind}">${esc(res.label)}</b></div>`
      : seat === b.turn && !b.reason ? `<div class="cc-seat-res wait">振っています…</div>` : '';
    return `<div class="cc-seat${seat === b.turn && !b.reason ? ' turn' : ''}">${seatChip(A, b, seat, seat === b.banker ? '<em class="cc-banker">親</em>' : '')}<div class="cc-seat-sub">チップ ${b.chips[seat]} 枚</div>${resHtml}</div>`;
  };
  const positions = POS[b.n] || POS[4];
  for (let k = 1; k < b.n; k++) {
    const seat = (me + k) % b.n;
    const [x, y] = positions[k - 1];
    html += at(x, y, seatPanel(seat));
  }
  html += at(bowlCx, mob ? 800 : 496, `<div class="cc-me">${seatPanel(me)}</div>`);
  // ラウンド精算のパネル(最後の振りのアニメーションのあとにふわりと出す)
  if (lrJust && lr) {
    const bk = lr.results[lr.banker];
    const rows = lr.entries.map((e) => {
      const cr = lr.results[e.child];
      const flow = e.result === 'push' ? '<span class="cc-flow">精算なし</span>'
        : `<span class="cc-flow">${esc(A.name(e.from))} → ${esc(A.name(e.to))} <b>${e.amount} 枚</b></span>`;
      return `<div class="cc-entry"><span class="cc-entry-nm">${esc(A.name(e.child))}</span><span class="cc-entry-res ${cr ? cr.kind : ''}">${cr ? esc(cr.label) : '―'}</span>${flow}</div>`;
    }).join('');
    const instant = lr.instant === 'win' ? '<div class="cc-instant">親の即勝ち！</div>' : lr.instant === 'lose' ? '<div class="cc-instant">親の即負け</div>' : '';
    html += at(bowlCx, bowlCy, `<div class="cc-settle${willAnim ? ' delay' : ''}"><div class="cc-settle-t">第 ${lr.roundNo} ラウンド 精算</div>${instant}<div class="cc-entry banker"><span class="cc-entry-nm">親 ${esc(A.name(lr.banker))}</span><span class="cc-entry-res ${bk ? bk.kind : ''}">${bk ? esc(bk.label) : '―'}</span></div>${rows}</div>`);
  }
  stage(A, b, html, tapMove(A), (wrap) => {
    const dice = [...wrap.querySelectorAll('.cc-die')];
    if (!dice.length) return;
    const bowl = wrap.querySelector('.cc-bowlwrap');
    if (bowl) bowl.classList.add('cc-shake');
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      const amp = Math.max(0, 17 - ticks * 1.7);
      dice.forEach((el) => {
        el.innerHTML = dieFace(1 + Math.floor(Math.random() * 6), +el.dataset.size);
        const jx = (Math.random() * 2 - 1) * amp, jy = (Math.random() * 2 - 1) * amp;
        el.style.transform = `translate(calc(-50% + ${jx}px), calc(-50% + ${jy}px)) rotate(${(Math.random() * 2 - 1) * Math.max(0, 55 - ticks * 5)}deg)`;
      });
      if (ticks >= 10) {
        clearInterval(iv);
        dice.forEach((el) => {
          el.innerHTML = dieFace(+el.dataset.final, +el.dataset.size);
          el.style.transition = 'transform .3s cubic-bezier(.2,2.1,.4,1)';
          el.style.transform = '';
        });
        A.sfx('WOOD', 40, { volume: .5, rate: 1.5 });
        if (bowl) setTimeout(() => bowl.classList.remove('cc-shake'), 350);
      }
    }, 68);
  });
  const acts = [];
  if (canRoll) acts.push({ label: b.attempts > 0 ? 'もう一度振る' : 'サイコロを振る', move: 0, cls: 'gold', enabled: true });
  A.acts(acts);
  if (lr) ninePrev.ccLr = lr.roundNo;
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
    if (b.phase === 'battle' && b.me >= 0 && b.turn === b.me) return b.shotsLeft > 1 ? `敵の海域を狙ってください（この手番 あと${b.shotsLeft}発）` : '敵の海域を狙ってください';
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
const NINE_AIM = {
  coyote: (b, mv, seat, q, button) => [button(mv === 0 ? /コヨーテ/ : /と宣言/)],
  liarsdice: (b, mv, seat, q, button) => mv === 0 ? [button(/ダウト/)] : mv === 1 ? [button(/ジャスト/)] : [button(/と宣言/)],
  incangold: (b, mv, seat, q, button) => [button(mv === 1 ? /^進む$/ : /^帰る$/)],
  take6: (b, mv, seat, q, button) => [q(`[data-m="${mv}"]`)],
  blokus: (b, mv, seat, q, button) => mv === 999999 ? [button(/パス/)] : [q(`[data-m="${mv}"]`)],
  quoridor: (b, mv, seat, q, button) => [q(`[data-m="${mv}"]`)],
  skull: (b, mv, seat, q, button) => {
    if (mv === 100 || mv === 101) return [q(`[data-m="${mv}"]`)];
    if (mv >= 200) return [q(`[data-m="${mv}"]`)];
    if (mv === 0) return [button(/パス/)];
    if (mv === 300 || mv === 301) return [button(/を捨てる/)];
    return [button(/枚で宣言/)];
  },
};
const NINE_IDS = new Set(['coyote', 'skull', 'liarsdice', 'incangold', 'take6', 'blokus', 'quoridor', 'battleship', 'chinchiro']);
window.NINE_HAS = (id) => NINE_IDS.has(id);
window.NINE_STATUS = (b) => (NINE_STATUS[b.kind] ? NINE_STATUS[b.kind](b) : '');
window.NINE_AIM = (b, mv, seat, q, button) => (NINE_AIM[b.kind] ? NINE_AIM[b.kind](b, mv, seat, q, button) : []);
})();
