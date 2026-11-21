/* ルールの説明: Android 版と同じ文に、動く図(40 種)・札の絵・駒の動きの図を付ける。 */
'use strict';
const EXTRA_GAME_RULES = {
  slide: [
    ['動かし方','空いているマスの隣のピースをクリックすると、そのマスに移動します。矢印キーでも動かせます。'],
    ['完成と競争','風景を1枚の絵に戻すか、数字を左上から順に並べます。対戦では全員が同じシャッフルから始まり、完成時間を競います。']
  ],
  bunyo: [
    ['ピースを消す','左右移動と回転で落とす位置を決めます。同じ色が上下左右に4個以上つながると消え、落ちてきたピースが続けて消えると連鎖になります。'],
    ['操作','← → で動かし、↑ か X で右に、Z で左に回します。↓ で速く落とし、スペースですぐ落とします。スマホは盤を指でなぞると動き、下へはらうと落ち、軽くたたくと回ります。'],
    ['対戦','連鎖などで相手にお邪魔を送れます。ピースを置けなくなると終了し、最後まで残った人がその回の勝ちです。CPU と対戦・みんなで遊ぶでは、決めた本数を先に取った人の勝ちです(2〜4人)。']
  ],
  pakuris: [
    ['ブロックを消す','ブロックを移動・回転して横一列を埋めると、その列が消えます。← → で動かし、↑ か X で右に、Z か Ctrl で左に回します。↓ で1段下げ、スペースで一気に落とします。着地してから少しの間は、まだ動かせます。'],
    ['回転とTスピン','壁や床に当たる時は、決まった順に位置をずらして回ります。Tのブロックを回してすき間にねじ込み、Tの中心の斜め4マスのうち3マス以上が埋まっていると「Tスピン」です(正面側の2マスが埋まっていない時は「ミニ」)。'],
    ['点数と送るお邪魔','1〜4列で 100・300・500・800点、お邪魔は 0・1・2・3列。Tスピンは 1〜3列で 800・1200・1600点、お邪魔 2・4・6列。4列消しやTスピンを、間に普通の消し方を挟まずに続けると「BACK to BACK」で点数1.5倍・お邪魔+1。続けて消すと REN になり、点数が倍になっていき、お邪魔も増えます。'],
    ['対戦','列を消して相手にお邪魔を送れます。ブロックを置けなくなると終了し、最後まで残った人がその回の勝ちです。CPU と対戦・みんなで遊ぶでは、決めた本数を先に取った人の勝ちです(2〜4人)。']
  ],
  mine: [
    ['基本操作','左クリックでマスを開き、右クリックか旗モードで旗を立てます。準備画面で左右クリックを入れ替えられます。数字は隣接する地雷の数です。'],
    ['協力','同じ盤面を開き、地雷以外のマスを全部開けばクリアです。地雷を踏んだら「待った」で直前に戻せます。'],
    ['対戦','同じ地雷配置の盤面を各自で解きます。設定で妨害を有効にすると、ポイントを使って霧や凍結などを発動できます。']
  ],
  bozu: [
    ['札の引き方','順番に好きな山から1枚引きます。殿は引いた札を受け取り、姫は引いた札と場の札を受け取ります。'],
    ['坊主と勝敗','坊主を引いたら手持ちの札を場に出します。蝉丸も坊主として扱います。山札が尽きたとき、札を一番多く持っている人が勝ちです。'],
    ['ローカルルール','設定で選べます。「姫で場札が無い時: もう1枚引く」では、姫を引いた時に場に札が1枚も無ければ、もう1枚引けます(続けて姫でも同じ)。「蝉丸: 全員の札を場へ」では、蝉丸を引くと全員の持ち札が場に出ます。']
  ],
  roulette: [
    ['チップを賭ける', '手元のチップから額面を選び、盤面の枠を押します。「撤去」を選んで枠を押すか、枠を右クリックすると、自分がその枠に置いたチップを回収できます。全員が確定するとホイールが回ります。'],
    ['数字の賭け枠', '数字1つは36倍、数字間の境界は2数字に18倍、4つの数字が接する交点は9倍です。数字列の脇の四角は3数字に12倍、隣の列との間にある横長の印は6数字に6倍です。'],
    ['外側の賭け枠', '列（2:1）と1〜12・13〜24・25〜36は3倍、赤黒・偶奇・1〜18と19〜36は2倍です。倍率には賭けたチップも含まれます。'],
    ['出目と勝敗', 'ヨーロピアンは0、アメリカンは0と00があります。ラ・パルタージュを有効にすると、0または00のとき、2倍枠の賭け額の半分（端数切り捨て）を受け取ります。最後にチップの総額が最も多い人が勝ちです。エンドレスでは、残りが0枚になったら補充できます。']
  ],
  wolf: [
    ['昼と投票','昼は村で話し合い、投票で一人を追放します。生存者が3人以上なら1人を除く全員、2人なら全員が「投票へ進む」を押すと投票が始まります。'],
    ['夜と勝敗','夜は役職ごとに行動します。人狼を全員追放すると村人陣営の勝ち、人狼が生存者の半数以上になると人狼陣営の勝ちです。']
  ]
};
const EXTRA_SETUP_HINTS = {
  war: {warCards:'同じ強さの札が出たときに伏せる枚数です。',winCond:'総取りか、26戦後の枚数で勝敗を決めます。'},
  takoyaki: {wild:'どの絵札を好きな位置に置けるか選びます。',roundDown:'勝つたびに、次に表にする目標枚数を減らします。'},
  butanoshippo: {matchRule:'直前の札と一致したとき、場の札を引き取ります。',handPlay:'引き取った手札からも出せるようにします。'},
  oldmaid: {variant:'ジョーカー、抜いた1枚、♠Qから最後に残る札を選びます。',shuffleHand:'自分の手番に手札の並びを混ぜられます。'},
  hearts: {target:'誰かがこの点数以上になると、最少点の人が勝ちます。',queenBreaks:'♠Qが出た後もハートを先に出せるようにします。'},
  ginrummy: {knockRule:'役に使わない札の合計がいくつまでなら宣言できるかを決めます。'},
  vulture: {tieCarry:'バッティングで取り手がいない得点札を、次の勝負に持ち越せます。'},
  goita: {fiveShi:'「し」が偏ったときに配り直しや即上がりを適用します。'},
  quarto: {square2x2:'縦・横・斜めに加え、2×2の四角でも同じ特徴をそろえると勝ちです。'},
  geister: {setup:'自陣に青と赤を配置する時間を設けるか選びます。'},
  rummikub: {initialMeld:'最初に手牌を場へ出すときの合計点数を選びます。'},
  pegsolitaire: {board:'十字形の33穴、ヨーロッパ式の37穴、三角形の15穴から選びます。'}
};
(() => {
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const COL = { b: ['#6b6b72', '#111'], w: ['#fff', '#cfc8b4'], r: ['#F59A86', '#B3261C'], u: ['#9CC1F0', '#1F4577'], y: ['#FFF0A8', '#B8860B'], g: ['#A9E0B6', '#1D5A37'], p: ['#D9C2F5', '#4B2F86'], n: ['#C9995C', '#5A3A22'] };
  // 図を描く部品(c: canvas の 2D、W×H: 図の大きさ)
  function kit(c, W, H) {
    const K = {
      W, H,
      rr(x, y, w, h, r, fill, stroke, lw = 2) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } },
      line(x1, y1, x2, y2, col, lw = 2, dash) { c.beginPath(); c.setLineDash(dash || []); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke(); c.setLineDash([]); },
      circ(x, y, r, fill, stroke, lw = 2) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, 7); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } },
      T(t, x, y, size = 14, col = '#fff', align = 'center', font = '') { c.font = `900 ${size}px ${font || '"Zen Maru Gothic",sans-serif'}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(t, x, y); },
      stone(x, y, r, k, a = 1) { if (a <= 0) return; c.globalAlpha = a; K.circ(x + r * .08, y + r * .16, r, 'rgba(0,0,0,.3)'); const g = c.createRadialGradient(x - r * .3, y - r * .4, r * .1, x, y, r); g.addColorStop(0, COL[k][0]); g.addColorStop(1, COL[k][1]); K.circ(x, y, r, g); c.globalAlpha = 1; },
      felt() { const g = c.createRadialGradient(W / 2, H * .4, 10, W / 2, H / 2, W * .7); g.addColorStop(0, '#34805b'); g.addColorStop(1, '#184530'); c.fillStyle = g; c.fillRect(0, 0, W, H); },
      wood() { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#E8C98E'); g.addColorStop(1, '#D2AE6C'); c.fillStyle = g; c.fillRect(0, 0, W, H); },
      paper() { c.fillStyle = '#FDFCF8'; c.fillRect(0, 0, W, H); },
      ink: () => '#2B3440',
      // マス目(緑の盤・木の盤・チェス盤)。戻り値: [マスの大きさ, 左, 上]
      grid(cols, rows, kind = 'green', frac = .86) { const s = Math.min(W * .9 / cols, H * frac / rows), x0 = (W - s * cols) / 2, y0 = (H - s * rows) / 2;
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { c.fillStyle = kind === 'green' ? '#2F7A56' : kind === 'chess' ? ((r + q) % 2 ? '#7FA65A' : '#EEF0D2') : '#E9CB92'; c.fillRect(x0 + q * s, y0 + r * s, s, s); if (kind !== 'chess') { c.strokeStyle = kind === 'green' ? '#134a31' : '#6b4a24'; c.lineWidth = 1.5; c.strokeRect(x0 + q * s, y0 + r * s, s, s); } }
        return [s, x0, y0]; },
      // 交点に置く盤(碁・五目)
      cross(n, m) { K.wood(); const s = Math.min(W * .9 / n, H * .9 / m), x0 = (W - s * (n - 1)) / 2, y0 = (H - s * (m - 1)) / 2; for (let i = 0; i < n; i++) K.line(x0 + i * s, y0, x0 + i * s, y0 + (m - 1) * s, '#6b4a24', 1.4); for (let j = 0; j < m; j++) K.line(x0, y0 + j * s, x0 + (n - 1) * s, y0 + j * s, '#6b4a24', 1.4); return [s, x0, y0]; },
      card(x, y, w, label, o = {}) { const h = w * 1.4; if ((o.a ?? 1) <= 0) return; c.save(); c.globalAlpha = o.a ?? 1; c.translate(x + w / 2, y + h / 2); if (o.sx != null) c.scale(o.sx, 1); if (o.rot) c.rotate(o.rot); c.translate(-w / 2, -h / 2);
        K.rr(1.5, 3, w, h, w * .12, 'rgba(0,0,0,.3)');
        if (o.back) { K.rr(0, 0, w, h, w * .12, '#F4EAD0'); K.rr(w * .08, w * .08, w * .84, h - w * .16, w * .08, o.backCol || '#B4332B'); }
        else { K.rr(0, 0, w, h, w * .12, o.fill || '#FFFDF5', o.hl ? '#FFC65C' : '#B9AC8C', o.hl ? 4 : 1.2); const red = /[♥♦]/.test(label) || o.red; const m = String(label).match(/^([♠♥♦♣]?)(.*)$/); K.T(m[2], w / 2, h * .36, w * (m[2].length > 1 ? .4 : .5), o.col || (red ? '#C8362E' : '#15151A')); if (m[1]) K.T(m[1], w / 2, h * .72, w * .42, red ? '#C8362E' : '#15151A'); }
        c.restore(); },
      die(x, y, s, v, hl) { K.rr(x + 1.5, y + 3, s, s, s * .18, 'rgba(0,0,0,.3)'); K.rr(x, y, s, s, s * .18, '#FFFDF5', hl ? '#FFC65C' : '#B9AC8C', hl ? 4 : 1.2); const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v] || []; for (const [a, b] of P) K.circ(x + s / 2 + a * s * .26, y + s / 2 + b * s * .26, s * (v === 1 ? .14 : .09), v === 1 ? '#C8362E' : '#15151A'); },
      koma(x, y, s, txt, o = {}) { c.save(); c.translate(x, y); if (o.flip) c.rotate(Math.PI); if (o.sx != null) c.scale(o.sx, 1); c.beginPath(); c.moveTo(0, -s * .5); c.lineTo(s * .3, -s * .34); c.lineTo(s * .4, s * .46); c.lineTo(-s * .4, s * .46); c.lineTo(-s * .3, -s * .34); c.closePath(); c.fillStyle = '#E7C580'; c.fill(); c.strokeStyle = '#8a6a35'; c.lineWidth = 1.5; c.stroke(); K.T(txt, 0, s * .06, s * .46, o.red ? '#B3261C' : '#1c140c', 'center', '"Yuji Boku",serif'); c.restore(); },
      chess(x, y, s, g, white) { c.font = `${s}px "Segoe UI Symbol","Noto Sans Symbols 2",serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = white ? '#3a2616' : '#eee'; c.strokeText(g, x, y); c.fillStyle = white ? '#FFFDF5' : '#2a1c10'; c.fillText(g, x, y); },
      tag(t, x, y, bg = 'rgba(0,0,0,.55)', col = '#fff', size = 14, a = 1) { if (a <= 0) return; c.globalAlpha = a; c.font = `900 ${size}px "Zen Maru Gothic",sans-serif`; const w = c.measureText(t).width + size * 1.4; K.rr(x - w / 2, y - size, w, size * 2, size, bg); K.T(t, x, y + 1, size, col); c.globalAlpha = 1; },
      mtile(x, y, w, txt, col = '#15151A') { K.rr(x, y + w * .12, w, w * 1.34, w * .12, '#E2A23A'); K.rr(x, y, w, w * 1.34, w * .12, '#FFFDF5', '#B9AC8C', 1); K.T(txt, x + w / 2, y + w * .68, w * .62, col, 'center', '"Yuji Boku",serif'); },
      alpha(a, f) { c.globalAlpha = a; f(); c.globalAlpha = 1; }, c,
    };
    return K;
  }
  // 石をまく図(マンカラ)。pits: 6 つの穴と右の倉
  function sow(K, t, pits, start, note, top) {
    K.wood(); const n = 6, s = Math.min(K.W / 8.4, 62), x0 = (K.W - s * 7.4) / 2 + s / 2, y = top ? K.H * .68 : K.H / 2;
    const cnt = pits.slice(), k = pits[start], prog = seg(t, .15, .75) * k, done = Math.floor(prog); cnt[start] = 0;
    for (let i = 1; i <= done; i++) cnt[start + i]++;
    const px = (i) => (i < 6 ? x0 + i * s : x0 + 6 * s + s * .15);
    if (top) for (let i = 0; i < 6; i++) { K.circ(px(i), y - s * 1.15, s * .42, '#4d301b', '#2a180c'); K.T(String(top[i] - (t > .82 && i === start + k ? top[i] : 0)), px(i), y - s * 1.15, 18, '#FFE9B0'); }
    for (let i = 0; i < 7; i++) { if (i < 6) K.circ(px(i), y, s * .42, '#4d301b', i === start && t < .15 ? '#FFC65C' : '#2a180c', i === start && t < .15 ? 4 : 2); else K.rr(px(i) - s * .36, y - s * (top ? 1.6 : .62), s * .72, s * (top ? 2.05 : 1.24), s * .36, '#4d301b', '#2a180c'); K.T(String(cnt[i] + (top && i === 6 && t > .82 ? top[start + k] + 1 - 1 : 0)), px(i), y, 20, '#FFE9B0'); }
    if (done < k && t > .15) { const f = prog - done, a = px(start + done), b = px(start + done + 1); K.stone(lerp(a, b, f), y - Math.sin(f * Math.PI) * s * .5 - s * .1, s * .15, 'ruygp'[done % 5]); }
    if (note) K.tag(note, K.W / 2, top ? K.H * .1 : K.H * .14, '#FFC65C', '#3A2616', 14, seg(t, .78, .86));
  }
  const D = {
    reversi_flip: [3200, 120, '黒を置くと、黒ではさまれた白がすべて黒に裏返ります。', (K, t) => { K.felt(); const [s, x0, y0] = K.grid(5, 1, 'green', .7); for (let i = 0; i < 5; i++) { const cx = x0 + i * s + s / 2, cy = y0 + s / 2; if (i === 0) K.stone(cx, cy, s * .38, 'b'); else if (i < 4) { const f = seg(t, .3 + i * .1, .42 + i * .1); K.c.save(); K.c.translate(cx, cy); K.c.scale(Math.abs(1 - 2 * f) || .02, 1); K.stone(0, 0, s * .38, f > .5 ? 'b' : 'w'); K.c.restore(); } else { const f = seg(t, .12, .24); if (f > 0) K.stone(cx, cy - (1 - f) * s * .5, s * .38, 'b', f); else K.circ(cx, cy, s * .1, '#FFC65C'); } } }],
    reversi_legal: [2000, 170, '置けるのは、相手の石をはさめるマス(点の所)だけです。', (K, t) => { K.felt(); const [s, x0, y0] = K.grid(4, 4); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2]; [[1, 1, 'w'], [2, 2, 'w'], [2, 1, 'b'], [1, 2, 'b']].forEach(([q, r, k]) => K.stone(...P(q, r), s * .38, k)); [[1, 0], [0, 1], [3, 2], [2, 3]].forEach(([q, r]) => K.circ(...P(q, r), s * (.1 + .05 * Math.sin(t * 6.283)), '#FFC65C')); }],
    c4_drop: [2400, 170, '列を選ぶと、コマはいちばん下の空いた所まで落ちます。', (K, t) => c4(K, t, { 21: 'r', 22: 'u', 23: 'r', 16: 'u' }, [3, 2, 'r'], null)],
    c4_line: [3000, 170, '縦・横・斜めのどれかで4つ並べたら勝ちです。', (K, t) => c4(K, t, { 21: 'r', 22: 'u', 23: 'u', 24: 'u', 15: 'u', 16: 'r', 17: 'u', 9: 'u', 10: 'r', 20: 'r' }, [4, 0, 'r'], [[0, 3], [1, 2], [2, 1], [3, 0]].map(([r0, q]) => [q + 1, 3 - r0]))],
    mancala_sow: [3600, 120, '穴の石を全部取り、右(反時計回り)へ1個ずつまきます。', (K, t) => sow(K, t, [4, 4, 4, 4, 4, 4, 0], 1)],
    mancala_extra: [3400, 120, '最後の1個が自分の倉に入ったら、もう1回まけます。', (K, t) => sow(K, t, [4, 4, 4, 3, 4, 4, 0], 3, 'もう1回!')],
    mancala_capture: [4000, 170, '空だった自分の穴で止まると、向かいの石ごと倉に入れられます。', (K, t) => sow(K, t, [2, 4, 0, 4, 4, 4, 1], 0, '向かいの石も取る!', [4, 4, 5, 4, 4, 4])],
    dots_close: [3400, 150, '4辺目を引いて箱を閉じたら自分の箱。続けてもう1本引けます。', (K, t) => dotsDemo(K, t, false)],
    dots_danger: [2600, 150, '3辺目を引くと、相手に4辺目を引かれて箱を取られます。', (K, t) => dotsDemo(K, t, true)],
    hitblow_judge: [4400, 150, '位置も数字も合えばヒット(赤)、数字だけ合えばブロー(黄)。この例は1ヒット2ブローです。', (K, t) => { K.wood(); const s = Math.min(46, K.W / 9), x0 = K.W / 2 - s * 2.3; const sec = [5, 2, 7, 1], gs = [5, 7, 2, 9], ring = ['#C8463C', '#E6B21F', '#E6B21F', null];
      K.T('正解', x0 - s * .9, K.H * .27, 14, '#5A3A22'); K.T('答え', x0 - s * .9, K.H * .68, 14, '#5A3A22');
      for (let i = 0; i < 4; i++) { const x = x0 + i * s * 1.15; const open = t > .75; K.rr(x, K.H * .27 - s * .6, s, s * 1.2, 6, open ? '#FFFDF5' : '#8a6a35', '#5A3A22'); K.T(open ? String(sec[i]) : '?', x + s / 2, K.H * .27, s * .6, open ? '#15151A' : '#FFE9B0'); const f = seg(t, .08 + i * .08, .14 + i * .08); if (f > 0) { K.rr(x, K.H * .68 - s * .6, s, s * 1.2, 6, '#FFFDF5', seg(t, .5 + i * .06, .56 + i * .06) > 0 && ring[i] ? ring[i] : '#B9AC8C', seg(t, .5 + i * .06, .56 + i * .06) > 0 && ring[i] ? 5 : 1.2); K.T(String(gs[i]), x + s / 2, K.H * .68, s * .6, '#15151A'); } }
      K.tag('1ヒット', x0 + s * 5.4, K.H * .56, '#C8463C', '#fff', 14, seg(t, .78, .84)); K.tag('2ブロー', x0 + s * 5.4, K.H * .8, '#E6B21F', '#2A2118', 14, seg(t, .82, .88)); }],
    gomoku_five: [3000, 150, '縦・横・斜めのどれかで5つ並べたら勝ちです。', (K, t) => { const [s, x0, y0] = K.cross(9, 5); const P = (q, r) => [x0 + q * s, y0 + r * s]; [[2, 2], [3, 2], [4, 2], [5, 2]].forEach((p) => K.stone(...P(...p), s * .44, 'b')); [[3, 1], [4, 3], [5, 1], [1, 2]].forEach((p) => K.stone(...P(...p), s * .44, 'w')); const f = seg(t, .25, .4); if (f > 0) K.stone(...P(6, 2), s * .44 * (2 - f), 'b', f); if (t > .5) K.line(...P(2, 2), lerp(P(2, 2)[0], P(6, 2)[0], seg(t, .5, .7)), P(2, 2)[1], '#FFC65C', 5); }],
    hex_connect: [3800, 170, '赤は上と下の赤い辺を、自分のコマのつながりで結べば勝ちです。', (K, t) => { K.wood(); const n = 4, R = Math.min(K.H / 7.2, 24), Wd = Math.sqrt(3) * R, x0 = K.W / 2 - Wd * 2.6, y0 = K.H / 2 - R * 2.2; const P = (r, q) => [x0 + q * Wd + r * Wd / 2, y0 + r * R * 1.5];
      K.line(P(0, 0)[0] - Wd / 2, y0 - R - 3, P(0, 3)[0] + Wd / 2, y0 - R - 3, '#C8463C', 6); K.line(P(3, 0)[0] - Wd / 2, P(3, 0)[1] + R + 3, P(3, 3)[0] + Wd / 2, P(3, 0)[1] + R + 3, '#C8463C', 6);
      for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) { const [x, y] = P(r, q); K.c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); K.c.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)); } K.c.closePath(); K.c.fillStyle = '#EBD3A0'; K.c.fill(); K.c.strokeStyle = '#6E4E24'; K.c.lineWidth = 1.5; K.c.stroke(); }
      const red = [[0, 2], [1, 1], [2, 1], [3, 0]], blue = [[1, 2], [2, 2], [0, 0]]; blue.forEach((p) => K.stone(...P(...p), R * .6, 'u')); red.forEach((p, i) => { const f = seg(t, .1 + i * .15, .2 + i * .15); if (f > 0) K.stone(...P(...p), R * .6, 'r', f); });
      if (t > .72) for (let i = 0; i < 3; i++) K.line(...P(...red[i]), ...P(...red[i + 1]), '#FFFDF5', 3); }],
    morris_mill: [4200, 170, '3つ並べる(ミル)と、相手のコマを1つ選んで取れます。', (K, t) => { K.wood(); const s = K.H * .34, cx = K.W / 2, cy = K.H / 2; K.c.strokeStyle = '#6b4a24'; K.c.lineWidth = 3; K.c.strokeRect(cx - s, cy - s, s * 2, s * 2); K.line(cx, cy - s, cx, cy + s, '#6b4a24', 3); K.line(cx - s, cy, cx + s, cy, '#6b4a24', 3);
      const f = ease(seg(t, .15, .4)); K.stone(cx - s, cy - s, 13, 'w'); K.stone(cx, cy - s, 13, 'w'); K.stone(lerp(cx + s, cx + s, f), lerp(cy, cy - s, f), 13, 'w'); K.stone(cx - s, cy + s, 13, 'b'); K.stone(cx, cy, 13, 'b', 1 - seg(t, .7, .82));
      if (t > .45) K.line(cx - s, cy - s, lerp(cx - s, cx + s, seg(t, .45, .55)), cy - s, '#FFC65C', 6); if (t > .6 && t < .82) K.circ(cx, cy, 19, null, '#E2553A', 3); K.tag('ミル!', cx + s * 1.8, cy - s, '#FFC65C', '#3A2616', 14, seg(t, .5, .56)); }],
    hare_trap: [3200, 150, 'ウサギの行き先を全部ふさげば、猟犬の勝ちです。', (K, t) => { K.wood(); const sx = K.W / 6, cy = K.H / 2, dy = K.H * .3; const N = { a: [sx * 3, cy - dy], b: [sx * 3, cy], c2: [sx * 3, cy + dy], d: [sx * 4, cy - dy], e: [sx * 4, cy], f: [sx * 4, cy + dy], g: [sx * 5, cy] };
      [['a', 'b'], ['b', 'c2'], ['a', 'd'], ['b', 'e'], ['c2', 'f'], ['d', 'e'], ['e', 'f'], ['d', 'g'], ['e', 'g'], ['f', 'g'], ['b', 'd'], ['b', 'f']].forEach(([p, q]) => K.line(...N[p], ...N[q], '#7a5a2a', 3)); Object.values(N).forEach((p) => K.circ(...p, 9, '#D2B078', '#7a5a2a'));
      const f = ease(seg(t, .2, .45)); K.stone(...N.d, 15, 'n'); K.stone(...N.f, 15, 'n'); K.stone(lerp(N.b[0], N.e[0], f), cy, 15, 'n'); K.stone(...N.g, 15, 'w'); K.T('兎', N.g[0], cy, 15, '#2A2118'); K.tag('ウサギは動けない', K.W * .3, cy, '#FFC65C', '#3A2616', 14, seg(t, .55, .62)); }],
    checkers_jump: [3200, 170, '斜め前の相手のコマの向こうが空いていたら、跳び越えて取ります。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(4, 4, 'chess'); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2]; const f = ease(seg(t, .25, .55)); K.stone(...P(2, 1), s * .36, 'w', 1 - seg(t, .5, .65)); const a = P(1, 2), b = P(3, 0); K.stone(lerp(a[0], b[0], f), lerp(a[1], b[1], f) - Math.sin(f * Math.PI) * s * .5, s * .36, 'b'); K.stone(...P(0, 3), s * .36, 'b'); }],
    yacht_roll: [3600, 130, '残したいサイコロ(黄の枠)以外を振り直して、役をそろえます。', (K, t) => { K.felt(); const s = Math.min(54, K.W / 8), x0 = K.W / 2 - s * 3.1; const a = [3, 3, 3, 5, 2], b = [3, 3, 3, 6, 6]; for (let i = 0; i < 5; i++) { const roll = i >= 3 && t > .35 && t < .6; K.c.save(); K.c.translate(x0 + i * s * 1.25 + s / 2, K.H * .42); if (roll) K.c.rotate(Math.sin(t * 60 + i) * .25); K.die(-s / 2, -s / 2, s, roll ? 1 + Math.floor((t * 40 + i * 3) % 6) : t < .35 ? a[i] : b[i], i < 3 && t > .15); K.c.restore(); } K.tag('フルハウス', K.W / 2, K.H * .86, '#FFC65C', '#3A2616', 14, seg(t, .66, .72)); }],
    chess_castle: [3400, 110, 'キングをルークの方へ2つ動かし、ルークがキングを跳び越えて隣に来ます。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(8, 1, 'chess', .62); const X = (q) => x0 + q * s + s / 2, y = y0 + s / 2; K.chess(lerp(X(4), X(6), ease(seg(t, .2, .45))), y, s * .8, '♚', true); const f = ease(seg(t, .5, .75)); K.chess(lerp(X(7), X(5), f), y - Math.sin(f * Math.PI) * s * .5, s * .8, '♜', true); K.chess(X(0), y, s * .8, '♜', true); }],
    chess_enpassant: [3800, 170, '相手のポーンが2つ進んで真横に来た直後だけ、斜め前へ進んで取れます。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(3, 4, 'chess'); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2]; const f = ease(seg(t, .12, .35)), g = ease(seg(t, .5, .72)); const bp = [P(1, 0)[0], lerp(P(1, 0)[1], P(1, 2)[1], f)]; K.c.globalAlpha = 1 - seg(t, .7, .8); K.chess(...bp, s * .78, '♟', false); K.c.globalAlpha = 1; const a = P(0, 2), b = P(1, 1); K.chess(lerp(a[0], b[0], g), lerp(a[1], b[1], g), s * .78, '♟', true); if (t > .36 && t < .5) K.circ(...P(1, 1), s * .14, '#FFC65C'); }],
    chess_mate: [3400, 150, 'キングがどこへ逃げても取られる形がチェックメイトです(奥の段への詰み)。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(5, 3, 'chess'); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2]; K.chess(...P(3, 0), s * .78, '♚', false); [2, 3, 4].forEach((q) => K.chess(...P(q, 1), s * .78, '♟', false)); const f = ease(seg(t, .2, .5)); const a = P(0, 2), b = P(0, 0); K.chess(a[0], lerp(a[1], b[1], f), s * .78, '♜', true); if (t > .55) K.line(P(0, 0)[0] + s * .4, P(0, 0)[1], lerp(P(0, 0)[0] + s * .4, P(3, 0)[0] - s * .4, seg(t, .55, .7)), P(0, 0)[1], '#E2553A', 4); K.tag('Checkmate', K.W / 2, K.H * .9, '#15151A', '#fff', 14, seg(t, .72, .78)); }],
    shogi_promote: [3400, 170, '敵陣(相手側の奥の段。色の付いた所)に入った駒は、裏返して成れます。歩は「と」になり、金と同じ動きになります。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(3, 4, 'wood'); K.c.fillStyle = 'rgba(200,54,46,.22)'; K.c.fillRect(x0, y0, s * 3, s * 3 * (3 / 3) * 0 + s * 2); const f = ease(seg(t, .2, .45)), g = seg(t, .55, .8); K.koma(x0 + s * 1.5, lerp(y0 + s * 2.5, y0 + s * 1.5, f), s * .9, g > .5 ? 'と' : '歩', { sx: Math.abs(1 - 2 * g) || .02, red: g > .5 }); K.T('敵陣', x0 - 26, y0 + s, 14, '#B3261C'); }],
    shogi_drop: [4200, 170, '取った駒は持ち駒になり、空いているマスに打てます。', (K, t) => { K.wood(); const [s, x0, y0] = K.grid(3, 3, 'wood', .8); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2]; const dai = [x0 + s * 3.9, y0 + s * 2.4]; K.rr(dai[0] - s * .6, dai[1] - s * .6, s * 1.2, s * 1.2, 6, '#C9A066', '#8a6a35'); K.T('持ち駒', dai[0], dai[1] - s * .85, 13, '#5A3A22');
      const f = ease(seg(t, .1, .28)), g = ease(seg(t, .3, .5)), h = ease(seg(t, .62, .85)); const a = P(1, 2), b = P(1, 1), d = P(2, 0);
      K.koma(a[0], lerp(a[1], b[1], f), s * .85, '銀'); let px = lerp(b[0], dai[0], g), py = lerp(b[1], dai[1], g); if (h > 0) { px = lerp(dai[0], d[0], h); py = lerp(dai[1], d[1], h) - Math.sin(h * Math.PI) * s * .4; } if (f < 1 || g > 0) K.koma(px, py, s * .85, '歩', { flip: g < .5 }); }],
    bg_move: [3800, 150, '出た目の数だけ、1つずつ駒を進めます(5と3なら、5つと3つ)。', (K, t) => bg(K, t, false)],
    bg_hit: [3600, 150, '相手の駒が1つだけのポイントに止まると、その駒を真ん中のバーへ送れます。', (K, t) => bg(K, t, true)],
    ludo_start: [3600, 150, '6が出た時だけ、家の駒を出発のマスに出せます。', (K, t) => { K.wood(); const s = K.H * .22, y = K.H * .62; K.rr(K.W * .1, K.H * .2, s * 2.4, s * 2.4, 10, '#F1B8B0', '#B3261C'); for (let i = 0; i < 6; i++) K.rr(K.W * .1 + s * 2.9 + i * s * 1.05, y, s, s, 4, i === 0 ? '#F1B8B0' : '#FFFDF5', '#8a6a35'); const hx = K.W * .1 + s * .7, hy = K.H * .2 + s * .7, f = ease(seg(t, .5, .8)); K.stone(hx + s, hy, s * .32, 'r'); K.stone(hx, hy + s, s * .32, 'r'); K.stone(hx + s, hy + s, s * .32, 'r'); K.stone(lerp(hx, K.W * .1 + s * 3.4, f), lerp(hy, y + s / 2, f) - Math.sin(f * Math.PI) * s * .5, s * .32, 'r'); const roll = t < .3; K.die(K.W * .78, K.H * .16, s * 1.1, roll ? 1 + Math.floor(t * 40 % 6) : 6, !roll); }],
    ludo_capture: [3600, 130, '相手の駒にぴったり止まると、その駒は家に戻ります(星のマスでは取られません)。', (K, t) => { K.wood(); const s = Math.min(K.W / 9, 52), x0 = (K.W - s * 7) / 2, y = K.H * .5; for (let i = 0; i < 7; i++) { K.rr(x0 + i * s, y - s / 2, s * .94, s * .94, 4, '#FFFDF5', '#8a6a35'); if (i === 6) K.T('★', x0 + i * s + s * .47, y, s * .5, '#E6B21F'); } const f = seg(t, .15, .5) * 3, k = Math.min(3, Math.floor(f)), fr = f - k; const X = (i) => x0 + i * s + s * .47; const g = ease(seg(t, .55, .85)); K.stone(lerp(X(4), X(4) + s * .2, g), lerp(y, -s, g), s * .3, 'u', 1 - g * .6); K.stone(k >= 3 ? X(4) : lerp(X(1 + k), X(2 + k), fr), y - (k >= 3 ? 0 : Math.sin(fr * Math.PI) * s * .35), s * .3, 'r'); K.tag('家に戻る', X(4), y - s * 1.05, '#3F78C4', '#fff', 13, seg(t, .6, .66)); }],
    cc_jump: [3800, 170, '隣のコマを跳び越えて、続けて何回でも跳べます。', (K, t) => { K.wood(); const s = Math.min(K.W / 9, 50), y = K.H / 2, x0 = (K.W - s * 6) / 2; const X = (i) => x0 + i * s; for (let i = 0; i < 7; i++) K.circ(X(i), y, s * .2, '#8A5E33'); [1, 3, 5].forEach((i) => K.stone(X(i), y, s * .34, 'u')); const f = seg(t, .15, .8) * 3, k = Math.min(3, Math.floor(f)), fr = ease(f - k); K.stone(k >= 3 ? X(6) : lerp(X(k * 2), X(k * 2 + 2), fr), y - (k >= 3 ? 0 : Math.sin(fr * Math.PI) * s * .9), s * .34, 'r'); }],
    go_capture: [3400, 170, '相手の石の周りの空き(呼吸点)を全部ふさぐと、その石を取れます。', (K, t) => { const [s, x0, y0] = K.cross(5, 5); const P = (q, r) => [x0 + q * s, y0 + r * s]; K.stone(...P(2, 2), s * .45, 'w', 1 - seg(t, .55, .7)); [[2, 1], [1, 2], [2, 3]].forEach((p) => K.stone(...P(...p), s * .45, 'b')); const f = seg(t, .25, .4); if (f > 0) K.stone(...P(3, 2), s * .45 * (2 - f), 'b', f); else K.circ(...P(3, 2), s * .12, '#FFC65C'); }],
    poker_draw: [3800, 150, '要らない札を選んで、山の札と1回だけ交換できます。', (K, t) => { K.felt(); const w = Math.min(K.W / 8, 58), x0 = K.W / 2 - w * 3.1, y = K.H * .3; const a = ['♠K', '♥K', '♦K', '♣4', '♥9'], b = ['♠K', '♥K', '♦K', '♣9', '♠9']; K.card(K.W - w * 1.5, K.H * .08, w * .8, '', { back: 1 }); for (let i = 0; i < 5; i++) { const pick = i >= 3, up = pick ? seg(t, .12, .2) - seg(t, .7, .8) : 0, out = pick ? seg(t, .3, .45) : 0, inn = pick ? seg(t, .5, .68) : 1; if (!pick || out < 1) K.card(x0 + i * w * 1.25, y - up * w * .3 - out * K.H, w, a[i], { hl: pick && t > .12 && t < .3 }); if (pick && inn > 0) K.card(lerp(K.W - w * 1.5, x0 + i * w * 1.25, ease(inn)), lerp(K.H * .08, y - up * w * .3, ease(inn)), w, b[i], {}); } K.tag('フルハウス', K.W / 2, K.H * .9, '#FFC65C', '#3A2616', 14, seg(t, .8, .86)); }],
    memory_pair: [4200, 150, '2枚めくって同じ数なら取れます。違えば裏に戻します。', (K, t) => { K.felt(); const w = Math.min(K.W / 7, 62), x0 = K.W / 2 - w * 2.5, y = K.H / 2 - w * .7; const lab = ['♠7', '♥Q', '♦7', '♣3']; const fl = (a, b) => { const f = seg(t, a, a + .08) - seg(t, b, b + .08); return f; }; const st = [fl(.05, 2), fl(.52, .86), fl(.13, 2), fl(.6, .86)]; for (let i = 0; i < 4; i++) { const f = st[i], gone = (i === 0 || i === 2) ? seg(t, .3, .42) : 0; K.card(x0 + i * w * 1.3, y - gone * K.H * .9, w, lab[i], { back: f < .5, sx: Math.abs(1 - 2 * f) || .02, a: 1 }); } K.tag('そろった!', K.W / 2, K.H * .12, '#FFC65C', '#3A2616', 14, seg(t, .22, .28) - seg(t, .42, .46)); K.tag('ちがう', K.W / 2, K.H * .12, '#2a2118', '#fff', 14, seg(t, .7, .74) - seg(t, .88, .92)); }],
    bj_hit: [3800, 150, 'ヒットで1枚引きます。K と 7 と 4 で21。A は11にも1にも数えます。', (K, t) => { K.felt(); const w = Math.min(K.W / 8, 60), x0 = K.W / 2 - w * 1.6, y = K.H * .22; K.card(x0, y, w, '♠K'); K.card(x0 + w * .7, y, w, '♥7'); const f = ease(seg(t, .35, .55)); if (f > 0) K.card(lerp(K.W, x0 + w * 1.4, f), lerp(-w, y, f), w, '♣4', { rot: (1 - f) * .8 }); K.tag(t < .5 ? '17' : '21', x0 + w * 3.2, y + w * .7, t < .5 ? 'rgba(0,0,0,.55)' : '#FFC65C', t < .5 ? '#fff' : '#3A2616', 18); K.tag('ヒット', x0 - w * 1.1, y + w * .7, '#C8362E', '#fff', 13, seg(t, .22, .28) - seg(t, .5, .56)); }],
    sevens_next: [3400, 140, '列の両端の隣(この例では ♥5 と ♥9)だけを出せます。', (K, t) => { K.felt(); const w = Math.min(K.W / 9.5, 52), x0 = K.W / 2 - w * 3.9, y = K.H / 2 - w * .7; ['4', '5', '6', '7', '8', '9', '10'].forEach((n, i) => { const on = i >= 2 && i <= 4, edge = i === 1 || i === 5; if (on) K.card(x0 + i * w * 1.12, y, w, '♥' + n); else { K.rr(x0 + i * w * 1.12, y, w, w * 1.4, w * .12, edge ? `rgba(255,198,92,${.25 + .2 * Math.sin(t * 12.6)})` : 'rgba(0,0,0,.15)', edge ? '#FFC65C' : 'rgba(255,255,255,.3)', edge ? 3 : 1); K.T(n, x0 + i * w * 1.12 + w / 2, y + w * .7, w * .4, edge ? '#FFE9B0' : 'rgba(255,255,255,.4)'); } }); }],
    daifugo_beat: [3600, 150, '前と同じ枚数で、より強い札を出します(5のペアには、6以上のペア)。', (K, t) => { K.felt(); const w = Math.min(K.W / 8, 58), cx = K.W / 2, y = K.H * .12; K.card(cx - w * 1.05, y, w, '♠5'); K.card(cx - w * .05, y, w, '♦5'); const f = ease(seg(t, .3, .55)); K.card(lerp(cx - w * 1.6, cx - w * .8, f), lerp(K.H, y + w * .25, f), w, '♥9', { rot: -.06 }); K.card(lerp(cx - w * .5, cx + .2 * w, f), lerp(K.H, y + w * .25, f), w, '♣9', { rot: .06 }); K.tag('同じ 2 枚で、もっと強い', cx, K.H * .9, 'rgba(0,0,0,.55)', '#fff', 13, seg(t, .6, .66)); }],
    daifugo_rev: [3600, 150, '同じ数を4枚出すと革命。強さが逆になり、3が一番強くなります。', (K, t) => { K.felt(); const w = Math.min(K.W / 9, 54), cx = K.W / 2, y = K.H * .12; ['♠', '♥', '♦', '♣'].forEach((s, i) => { const f = ease(seg(t, .1 + i * .05, .3 + i * .05)); K.card(cx - w * 2.2 + i * w * 1.1, lerp(K.H, y, f), w, s + '8'); }); if (t > .45) { K.c.save(); K.c.translate(cx, K.H * .5); K.c.rotate(-.1); K.rr(-K.W, -18, K.W * 2, 36, 0, `rgba(200,54,46,${seg(t, .45, .52)})`); K.T('革命', 0, 1, 26, `rgba(255,255,255,${seg(t, .45, .52)})`, 'center', '"Dela Gothic One",sans-serif'); K.c.restore(); } K.tag(t < .6 ? '強い順: 2 A K … 4 3' : '強い順: 3 4 5 … A 2', cx, K.H * .88, t < .6 ? 'rgba(0,0,0,.55)' : '#FFC65C', t < .6 ? '#fff' : '#3A2616', 13); }],
    life_move: [4200, 150, '給料日(赤)は通り過ぎても給料。ストップは数が余っても止まります。', (K, t) => { K.c.fillStyle = '#BFE3A1'; K.c.fillRect(0, 0, K.W, K.H); const s = Math.min(K.W / 7.6, 74), x0 = (K.W - s * 6.3) / 2, y = K.H * .5; const kind = ['', '', 'pay', '', 'stop', '']; for (let i = 0; i < 6; i++) { K.rr(x0 + i * s * 1.06, y - s * .4, s, s * .8, 8, kind[i] === 'pay' ? '#E23B2E' : '#FFF6E2', kind[i] === 'stop' ? '#C9281C' : '#4A3220', kind[i] === 'stop' ? 4 : 2); if (kind[i]) K.T(kind[i] === 'pay' ? '給料日' : 'ストップ!', x0 + i * s * 1.06 + s / 2, y, s * .2, kind[i] === 'pay' ? '#fff' : '#C9281C'); } const f = seg(t, .25, .7) * 4, k = Math.min(4, Math.floor(f)), fr = f - k; const X = (i) => x0 + i * s * 1.06 + s / 2; K.stone(k >= 4 ? X(4) : lerp(X(k), X(k + 1), fr), y - s * .55 - (k >= 4 ? 0 : Math.sin(fr * Math.PI) * s * .3), s * .2, 'r'); K.tag('ルーレット 7', K.W * .16, K.H * .14, '#2a2118', '#fff', 13, seg(t, .05, .1)); K.tag('+給料', X(2), y + s * .75, '#E23B2E', '#fff', 13, seg(t, .46, .5) - seg(t, .68, .72)); K.tag('ここで止まる', X(4), y + s * .75, '#C9281C', '#fff', 13, seg(t, .72, .78)); }],
    mahjong_discard: [3500, 150, '手牌を選び、打牌ボタンで河へ置きます。', (K, t) => { K.felt(); const w = Math.min(K.W / 11, 44), x0 = K.W / 2 - w * 3.9, y = K.H * .52; const tl = [['一', 0], ['二', 0], ['三', 0], ['東', 0], ['東', 0], ['中', 1], ['北', 0]]; tl.forEach(([n, r], i) => { const pick = i === 6, up = pick ? seg(t, .15, .25) : 0, go = pick ? ease(seg(t, .45, .7)) : 0; K.mtile(lerp(x0 + i * w * 1.08 + (pick ? w * .3 : 0), K.W / 2 - w / 2, go), lerp(y - up * w * .35, K.H * .08, go), w * (1 - go * .25), n, r ? '#C8362E' : '#15151A'); }); K.tag('打牌', K.W * .86, K.H * .8, '#FFC65C', '#3A2616', 14, seg(t, .28, .32) - seg(t, .45, .5)); }],
    hanafuda_play: [3500, 160, '同じ月の手札と場札を合わせて取ります。', (K, t) => { K.felt(); const w = Math.min(K.W / 9, 50), cx = K.W / 2; const hc = (x, y, m, col, o = {}) => { K.c.save(); K.c.globalAlpha = o.a ?? 1; K.rr(x + 1.5, y + 3, w, w * 1.6, 5, 'rgba(0,0,0,.3)'); K.rr(x, y, w, w * 1.6, 5, '#F4EAD0', o.hl ? '#FFC65C' : '#15151A', o.hl ? 4 : 2); K.circ(x + w / 2, y + w * .6, w * .28, col); K.T(m, x + w / 2, y + w * 1.25, w * .26, '#2a2118'); K.c.restore(); };
      const f = ease(seg(t, .25, .5)), g = ease(seg(t, .6, .85)); hc(cx - w * 2.2, K.H * .08, '菊', '#E6B21F'); hc(cx + w * 1.2, K.H * .08, '松', '#1F5D3A'); const fx = lerp(cx - w * .5, K.W - w * 1.6, g), fy = lerp(K.H * .08, K.H * .55, g); hc(fx, fy, '桜', '#F29BB5', { hl: t > .1 && t < .6 }); hc(lerp(lerp(cx - w * .5, cx - w * .2, f), K.W - w * 1.3, g), lerp(lerp(K.H * .98 - w * 1.6, K.H * .08 + w * .2, f), K.H * .55 + w * .15, g), '桜', '#F29BB5', { hl: t > .1 && t < .6 }); K.tag('取り札', K.W - w * 1.1, K.H * .45, 'rgba(0,0,0,.5)', '#fff', 12, seg(t, .8, .86)); }],
    speed_play: [3500, 160, '台札と1つ違う数字を、相手の手を待たずに出せます。', (K, t) => { K.felt(); const w = Math.min(K.W / 9, 52), cx = K.W / 2, y = K.H / 2 - w * .7; K.card(cx - w * 1.2, y, w, '♠7'); K.card(cx + w * .2, y, w, '♥J'); const f = ease(seg(t, .2, .42)), g = ease(seg(t, .3, .55)); K.card(lerp(cx - w * 2.6, cx - w * 1.2, f), lerp(K.H - w * .6, y, f), w, '♦8'); K.card(lerp(cx + w * 1.6, cx + w * .2, g), lerp(-w * .9, y, g), w, '♣Q'); K.tag('同時に出せる', cx, K.H * .9, 'rgba(0,0,0,.55)', '#fff', 13, seg(t, .6, .66)); }],
    holdem_play: [3500, 160, '手札2枚と共通の5枚から、最も強い5枚を作ります。', (K, t) => { K.felt(); const w = Math.min(K.W / 10, 48), cx = K.W / 2; const com = ['♠A', '♦A', '♣9', '♥4', '♠K'], hl = [1, 1, 0, 0, 1], on = t > .5; com.forEach((l, i) => { const f = seg(t, .05 + i * .06, .12 + i * .06); if (f > 0) K.card(cx - w * 2.9 + i * w * 1.18, K.H * .08, w, l, { hl: on && hl[i], a: f }); }); K.card(cx - w * 1.1, K.H * .56, w, '♥A', { hl: on }); K.card(cx + w * .1, K.H * .56, w, '♥K', { hl: on }); K.tag('フルハウス', cx + w * 3.2, K.H * .76, '#FFC65C', '#3A2616', 13, seg(t, .55, .62)); }],
    uno_play: [3500, 160, '同じ色か数字の札を出し、手札をなくします。', (K, t) => { K.felt(); const w = Math.min(K.W / 9, 52), cx = K.W / 2; const oc = (x, y, n, col, o = {}) => K.card(x, y, w, n, Object.assign({ fill: col, col: '#fff' }, o)); oc(cx - w / 2, K.H * .08, '5', '#2F6FD0'); const f = ease(seg(t, .3, .55)); oc(cx - w * 2, K.H * .56, '3', '#E0453A'); oc(cx + w * 1, K.H * .56, '9', '#2E9E5B'); oc(lerp(cx - w / 2, cx - w / 2 + 4, f), lerp(K.H * .56, K.H * .08 + 4, f), '8', '#2F6FD0', { hl: t > .1 && t < .3 }); K.tag('同じ色', cx + w * 2.2, K.H * .28, '#2F6FD0', '#fff', 13, seg(t, .12, .18)); }],
    solitaire_play: [3500, 160, '赤黒交互・1つ小さい札を重ねます。', (K, t) => { K.felt(); const w = Math.min(K.W / 9, 52), cx = K.W / 2; K.card(cx - w * 1.8, K.H * .1, w, '♠8'); K.card(cx + w * .8, K.H * .1, w, '', { back: 1 }); const f = ease(seg(t, .25, .55)); K.card(lerp(cx + w * .8, cx - w * 1.8, f), lerp(K.H * .1 + w * .35, K.H * .1 + w * .4, f) - Math.sin(f * Math.PI) * w * .3, w, '♥7', { hl: t > .1 && t < .25 }); K.tag('黒 8 の上に 赤 7', cx, K.H * .9, 'rgba(0,0,0,.55)', '#fff', 13, seg(t, .6, .66)); }],
  };
  function c4(K, t, discs, fall, win) {
    K.wood(); const cols = 7, rows = 4, s = Math.min(K.W * .8 / cols, K.H * .88 / rows), x0 = (K.W - s * cols) / 2, y0 = (K.H - s * rows) / 2;
    K.rr(x0 - 6, y0 - 6, s * cols + 12, s * rows + 12, 10, '#E3C48A', '#8a6a35'); const P = (q, r) => [x0 + q * s + s / 2, y0 + r * s + s / 2];
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { K.circ(...P(q, r), s * .4, '#3a2414'); const k = discs[r * 7 + q]; if (k) K.stone(...P(q, r), s * .38, k); }
    const f = seg(t, .15, .45), b = f < 1 ? f * f : 1; const [fq, fr, fk] = fall; if (t > .1) K.stone(P(fq, 0)[0], lerp(y0 - s * .6, P(fq, fr)[1], b), s * .38, fk);
    if (win && t > .55) { const a = P(...win[0]), z = P(...win[3]); K.line(a[0], a[1], lerp(a[0], z[0], seg(t, .55, .75)), lerp(a[1], z[1], seg(t, .55, .75)), '#FFFDF5', 6); }
  }
  function dotsDemo(K, t, danger) {
    K.paper(); const s = Math.min(K.H * .62, 96), x0 = K.W / 2 - s, y0 = K.H / 2 - s / 2, ink = K.ink(), R = '#D8452E', U = '#2F6FD0';
    const L = (x1, y1, x2, y2, col, f) => { if (f > 0) K.line(x1, y1, lerp(x1, x2, f), lerp(y1, y2, f), col, 6); };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) if (!(i < 2 && j < 1)) { } 
    K.line(x0, y0, x0 + s * 2, y0, 'rgba(128,128,128,.3)', 2, [2, 8]); K.line(x0, y0 + s, x0 + s * 2, y0 + s, 'rgba(128,128,128,.3)', 2, [2, 8]); for (let i = 0; i < 3; i++) K.line(x0 + i * s, y0, x0 + i * s, y0 + s, 'rgba(128,128,128,.3)', 2, [2, 8]);
    L(x0, y0, x0 + s, y0, U, 1); L(x0, y0, x0, y0 + s, R, 1);
    if (!danger) { L(x0, y0 + s, x0 + s, y0 + s, U, 1); L(x0 + s, y0, x0 + s, y0 + s, R, seg(t, .15, .35)); if (t > .38) { K.c.fillStyle = 'rgba(216,69,46,.22)'; K.c.fillRect(x0 + 5, y0 + 5, s - 10, s - 10); K.T('あ', x0 + s / 2, y0 + s / 2, s * .4, R); } L(x0 + s, y0, x0 + s * 2, y0, R, seg(t, .6, .8)); K.tag('もう1本!', x0 + s * 1.5, y0 + s * 1.25, '#FFC65C', '#3A2616', 13, seg(t, .45, .5)); }
    else { L(x0, y0 + s, x0 + s, y0 + s, R, seg(t, .12, .3)); L(x0 + s, y0, x0 + s, y0 + s, U, seg(t, .45, .62)); if (t > .65) { K.c.fillStyle = 'rgba(47,111,208,.22)'; K.c.fillRect(x0 + 5, y0 + 5, s - 10, s - 10); K.T('C', x0 + s / 2, y0 + s / 2, s * .4, U); } K.tag('3辺目は危ない', x0 + s * 1.55, y0 + s * 1.25, '#2a2118', '#fff', 13, seg(t, .32, .38)); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) K.circ(x0 + i * s, y0 + j * s, 7, ink);
  }
  function bg(K, t, hit) {
    K.c.fillStyle = '#1F6B4B'; K.c.fillRect(0, 0, K.W, K.H); const n = 9, w = Math.min(K.W / 11, 50), x0 = (K.W - w * n) / 2, h = K.H * .62, r = w * .4;
    for (let i = 0; i < n; i++) { K.c.beginPath(); K.c.moveTo(x0 + i * w, K.H); K.c.lineTo(x0 + i * w + w, K.H); K.c.lineTo(x0 + i * w + w / 2, K.H - h); K.c.closePath(); K.c.fillStyle = i % 2 ? '#8E2415' : '#EAD9A8'; K.c.fill(); }
    const X = (i) => x0 + i * w + w / 2, Y = (k) => K.H - r - k * r * 2;
    K.die(K.W * .08, K.H * .08, w * .8, 5); K.die(K.W * .08 + w, K.H * .08, w * .8, 3);
    if (!hit) { const f = ease(seg(t, .15, .42)), g = ease(seg(t, .5, .75)); K.stone(X(8), Y(0), r, 'w'); K.stone(lerp(X(8), X(3), f), lerp(Y(1), Y(0), f) - Math.sin(f * Math.PI) * w * .6, r, 'w'); K.stone(lerp(X(6), X(3), g), lerp(Y(0), Y(1), g) - Math.sin(g * Math.PI) * w * .6, r, 'w'); K.tag('5', X(5.5), K.H * .2, '#FFC65C', '#3A2616', 14, seg(t, .15, .2) - seg(t, .42, .46)); K.tag('3', X(4.5), K.H * .2, '#FFC65C', '#3A2616', 14, seg(t, .5, .54) - seg(t, .75, .8)); }
    else { const f = ease(seg(t, .15, .45)), g = ease(seg(t, .5, .8)); K.stone(lerp(X(3), K.W * .9, g), lerp(Y(0), K.H * .2, g), r, 'b'); K.stone(lerp(X(8), X(3), f), Y(0) - Math.sin(f * Math.PI) * w * .6, r, 'w'); K.stone(X(8), Y(0) * 1 + 0, r, 'w', f < .02 ? 0 : 0); K.rr(K.W * .9 - r * 1.4, K.H * .2 - r * 1.4, r * 2.8, r * 2.8, 6, 'rgba(0,0,0,.3)'); K.T('バー', K.W * .9, K.H * .2 + r * 2.2, 12, '#fff'); if (g > 0) K.stone(lerp(X(3), K.W * .9, g), lerp(Y(0), K.H * .2, g), r, 'b'); }
  }

  // ---------------------------------------------------------------- 図を動かす(見えている図だけ)
  let raf = 0; const live = new Set();
  function tick(now) {
    raf = 0;
    for (const cv of [...live]) { if (!cv.isConnected) { live.delete(cv); continue; }
      const d = D[cv.dataset.demo]; if (!d) continue; const W = cv.clientWidth, H = cv.clientHeight; if (!W) continue; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const reduce = document.documentElement.classList.contains('reduce');
      try { d[3](kit(c, W, H), reduce ? .92 : (now % d[0]) / d[0]); } catch (e) { live.delete(cv); console.error('demo', cv.dataset.demo, e); } }
    if (live.size) raf = requestAnimationFrame(tick);
  }
  function startDemos(root) {
    const reduce = document.documentElement.classList.contains('reduce');
    root.querySelectorAll('video.rule-vid').forEach((v) => {
      if (reduce) { try { v.pause(); v.currentTime = 1.6; } catch (e) {} }
      else { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    });
    root.querySelectorAll('canvas[data-demo]').forEach((cv) => live.add(cv));
    if (!raf && live.size) raf = requestAnimationFrame(tick);
  }
  // 盤面全体を映し、矢印と吹き出しで説明する短いループ動画(assets/rules/<id>.mp4)
  const demoHtml = (id) => D[id] ? `<figure class="demo"><video class="rule-vid" data-demo="${id}" src="assets/rules/${id}.mp4" autoplay loop muted playsinline preload="metadata"></video><figcaption>${esc(D[id][2])}</figcaption></figure>` : '';

  // ---------------------------------------------------------------- 絵つきの説明(Oh, No! の札・役・駒の動き)
  const unoSpecial = () => `<div class="rcards">${[['skip', 0, 'スキップ', '次の人の番を飛ばす'], ['rev', 1, 'リバース', '回る向きが逆になる(2人ではスキップと同じ)'], ['+2', 2, '+2', '次の人が2枚引き、番も飛ばされる'], ['wild', -1, 'ワイルド', '好きな色を選んで出す。場では選んだ色に変わる'], ['+4', -1, '+4', '好きな色を選び、次の人が4枚引いて番も飛ばされる。いまの色を持っていない時だけ出せる']].map(([k, ci, n, b]) => `<div class="rcard">${ohCard(k, ci)}<b>${n}</b><span>${b}</span></div>`).join('')}</div>`;
  const pcs = (ids) => `<span class="rhand">${ids.map((id) => { const s = Math.floor(id / 13), r = id % 13 + 2, red = s === 1 || s === 2; return `<span class="pc ${red ? 'r' : ''}"><i class="ix">${r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : r === 14 ? 'A' : r}<br>${'♠♥♦♣'[s]}</i><b>${'♠♥♦♣'[s]}</b></span>`; }).join('')}</span>`;
  const C = (s, r) => s * 13 + (r === 1 ? 12 : r - 2);
  const POKER = [['ロイヤルフラッシュ', '同じマークの 10・J・Q・K・A', [C(0, 10), C(0, 11), C(0, 12), C(0, 13), C(0, 1)]], ['ストレートフラッシュ', '同じマークで 5 枚続き', [C(1, 5), C(1, 6), C(1, 7), C(1, 8), C(1, 9)]], ['フォーカード', '同じ数字 4 枚', [C(0, 9), C(1, 9), C(2, 9), C(3, 9), C(0, 4)]], ['フルハウス', '同じ数字 3 枚 + 2 枚', [C(0, 13), C(1, 13), C(2, 13), C(3, 6), C(0, 6)]], ['フラッシュ', '同じマーク 5 枚', [C(2, 2), C(2, 6), C(2, 9), C(2, 11), C(2, 13)]], ['ストレート', '数字が 5 枚続き', [C(0, 4), C(1, 5), C(2, 6), C(3, 7), C(0, 8)]], ['スリーカード', '同じ数字 3 枚', [C(0, 7), C(1, 7), C(2, 7), C(3, 12), C(0, 2)]], ['ツーペア', 'ペアが 2 組', [C(0, 11), C(1, 11), C(2, 4), C(3, 4), C(0, 1)]], ['ワンペア', '同じ数字 2 枚', [C(0, 10), C(1, 10), C(2, 3), C(3, 8), C(0, 13)]], ['ハイカード', '役なし。いちばん強い札で比べる', [C(0, 1), C(1, 9), C(2, 7), C(3, 4), C(0, 2)]]];
  const pokerList = () => `<div class="rlist">${POKER.map(([n, d, ids], i) => `<div class="rrow"><span class="rk">${i + 1}</span><span class="rn"><b>${n}</b><small>${d}</small></span>${pcs(ids)}</div>`).join('')}</div><p class="rnote">上ほど強い役です。同じ役どうしは、札の数字の強さ(A が最強)で比べます。</p>`;
  const DIE = (v) => `<span class="rdie d2">${dface(v)}</span>`;
  const YACHT = [['1〜6の目', 'その目のサイコロの合計(例: 4 が 3 個で 12 点)', [4, 4, 4, 2, 6]], ['チョイス', '5 個の合計', [6, 5, 5, 3, 2]], ['フォーダイス', '同じ目 4 個で、5 個の合計', [5, 5, 5, 5, 2]], ['フルハウス', '同じ目 3 個 + 2 個で、5 個の合計', [3, 3, 3, 6, 6]], ['Sストレート', '4 つ続きで 15 点', [1, 2, 3, 4, 6]], ['Bストレート', '5 つ続きで 30 点', [2, 3, 4, 5, 6]], ['ヨット', '同じ目 5 個で 50 点', [6, 6, 6, 6, 6]]];
  const yachtList = () => `<div class="rlist">${YACHT.map(([n, d, v]) => `<div class="rrow"><span class="rn"><b>${n}</b><small>${d}</small></span><span class="rhand">${v.map(DIE).join('')}</span></div>`).join('')}</div><p class="rnote">1〜6 の目の合計が 63 点以上なら、ボーナス 35 点が付きます。</p>`;
  // 駒の動き(駒を選ぶと、動ける所が出る)
  const PIECES = { shogi: [['歩', '歩兵', (x, y) => x === 0 && y === -1], ['香', '香車', (x, y) => x === 0 && y < 0, 1], ['桂', '桂馬', (x, y) => Math.abs(x) === 1 && y === -2], ['銀', '銀将', (x, y) => (y === -1 && Math.abs(x) <= 1) || (y === 1 && Math.abs(x) === 1)], ['金', '金将', (x, y) => (y === -1 && Math.abs(x) <= 1) || (y === 0 && Math.abs(x) === 1) || (x === 0 && y === 1)], ['角', '角行', (x, y) => Math.abs(x) === Math.abs(y), 1], ['飛', '飛車', (x, y) => x === 0 || y === 0, 1], ['玉', '王将・玉将', (x, y) => Math.abs(x) <= 1 && Math.abs(y) <= 1], ['と', 'と金・成香・成桂・成銀(金と同じ)', (x, y) => (y === -1 && Math.abs(x) <= 1) || (y === 0 && Math.abs(x) === 1) || (x === 0 && y === 1), 0, 1], ['馬', '竜馬(成った角)', (x, y) => Math.abs(x) === Math.abs(y) || Math.abs(x) + Math.abs(y) === 1, 1, 1], ['龍', '竜王(成った飛車)', (x, y) => x === 0 || y === 0 || (Math.abs(x) === 1 && Math.abs(y) === 1), 1, 1]],
    chess: [['♟', 'ポーン(前へ 1 つ。最初だけ 2 つ。取る時は斜め前)', (x, y) => x === 0 && y === -1], ['♞', 'ナイト(ほかの駒を跳び越える)', (x, y) => Math.abs(x) * Math.abs(y) === 2], ['♝', 'ビショップ', (x, y) => Math.abs(x) === Math.abs(y), 1], ['♜', 'ルーク', (x, y) => x === 0 || y === 0, 1], ['♛', 'クイーン', (x, y) => x === 0 || y === 0 || Math.abs(x) === Math.abs(y), 1], ['♚', 'キング', (x, y) => Math.abs(x) <= 1 && Math.abs(y) <= 1]] };
  let pieceSel = 0;
  function pieceGuide(game) {
    const list = PIECES[game === 'chess' ? 'chess' : 'shogi'], chess = game === 'chess'; const [g, name, can, ray, red] = list[Math.min(pieceSel, list.length - 1)];
    const GL = { '♟': 'P', '♞': 'N', '♝': 'B', '♜': 'R', '♛': 'Q', '♚': 'K' };
    const pc = (gg) => `<svg viewBox="-14.5 -23.5 29 42" aria-hidden="true"><path d="${window.CHESS_PATHS[GL[gg]]}" fill-rule="evenodd" fill="#FFFDF5" stroke="#3a2a14" stroke-width="1.3" stroke-linejoin="round"/>${window.CHESS_SLIT[GL[gg]] ? `<path d="${window.CHESS_SLIT[GL[gg]]}" fill="none" stroke="#3a2a14" stroke-width="1.4" stroke-linecap="round"/>` : ''}</svg>`;
    let cells = ''; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const me = x === 0 && y === 0, ok = !me && can(x, y) && true; cells += `<span class="${chess ? ((x + y) & 1 ? 'dk' : 'lt') : ''} ${ok ? 'ok' : ''}">${me ? (chess ? `<b class="chs">${pc(g)}</b>` : `<b class="km ${red ? 'red' : ''}">${g}</b>`) : ok ? '<i></i>' : ''}</span>`; }
    return `<div class="pguide"><div class="ptabs">${list.map(([gg], i) => `<button class="${chess ? 'chs' : ''}" data-piece="${i}" aria-pressed="${i === pieceSel}">${chess ? pc(gg) : gg}</button>`).join('')}</div><div class="pgrid ${chess ? 'chess' : 'shogi'}">${cells}</div><p><b>${name}</b>${ray ? '　線の方向へ、ほかの駒にぶつかるまで何マスでも進めます。' : ''}</p></div>`;
  }

  // 人生すごろく: 席の一覧の見方
  const lifeLegend = () => `<section><h4>席の一覧の見方</h4><div class="llegend">
    <div><span class="lc"><i class="ic-t"></i>券<b>1</b></span><p>ゆめチケットの枚数。ゆめの谷やチャンスゲートで使います。</p></div>
    <div><span class="lc"><i class="ic-c"></i>子<b>2</b></span><p>子どもの人数。ふもとの精算所で、1 人につき $50,000 もらえます。</p></div>
    <div><span class="lc warn"><i class="ic-l"></i>手形<b>1</b></span><p>約束手形(借金)の枚数。1 枚 $25,000 で返します。赤い枠は、返していない手形がある印です。</p></div>
    <div><span class="lmoney ex">$12,000<small>給料 $16,000</small></span><p>右は持っているお金と、給料日にもらえる給料です。</p></div></div></section>`;

  // ---------------------------------------------------------------- 画面に入れる
  const hasYaku = (id) => /poker|holdem|yacht/.test(id);
  function sectionHtml(id, [title, body, demos]) {
    let extra = '';
    if (id === 'uno' && title === '特殊な札') return `<section><h4>${esc(title)}</h4>${unoSpecial()}</section>`;
    if (/^役/.test(title) && /poker|holdem/.test(id)) extra = pokerList();
    if (/駒の動き/.test(title) && /shogi|gogo|chess/.test(id)) extra = pieceGuide(id);
    if (id === 'yacht' && /役|欄|得点/.test(title)) extra = yachtList();
    if (id === 'checkers' && /キング/.test(title)) extra = `<div class="rkings">${[['#2a2a30', '#0c0c10', '黒のキング'], ['#ffffff', '#bdb59f', '白のキング']].map(([c1, c2, n]) => `<figure><svg viewBox="-12 -12 24 24"><defs><radialGradient id="rk${n.length}${c1.length}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${c1 === '#ffffff' ? '#fff' : '#6b6b72'}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs><circle cx=".8" cy="1.6" r="10" fill="#000" opacity=".3"/><circle r="10" fill="url(#rk${n.length}${c1.length})"/><circle r="6.6" fill="none" stroke="${c1 === '#ffffff' ? '#B9AC8C' : '#55555c'}" stroke-width=".9"/>${crown(0, .8, 11.5)}</svg><figcaption>${n}</figcaption></figure>`).join('')}</div>`;
    return `<section class="${/コツ/.test(title) ? 'tip' : ''}"><h4>${esc(title)}</h4>${(demos || []).map(demoHtml).join('')}<p>${esc(body)}</p>${extra}</section>`;
  }
  window.RULES = {
    html: (id, secs) => `<div class="rcols">${secs.map((s) => sectionHtml(id, s)).join('')}${id === 'life' ? lifeLegend() : ''}</div>`,
    list: (id, secs) => {
      if (/shogi|gogo|chess/.test(id)) return pieceGuide(id) + secs.filter(([t]) => /駒/.test(t)).map((s) => `<section><h4>${esc(s[0])}</h4><p>${esc(s[1])}</p></section>`).join('');
      if (/poker|holdem/.test(id)) return pokerList();
      if (id === 'yacht') return yachtList();
      const hit = secs.filter(([t]) => /役|強さ|得点|点数/.test(t)); return (hit.length ? hit : secs).map((s) => sectionHtml(id, s)).join('');
    },
    start: startDemos, setPiece: (i) => { pieceSel = i; }, demos: D,
  };
})();
