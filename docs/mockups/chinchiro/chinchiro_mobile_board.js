// チンチロリン — 盤面の見本(スマホ版)。PC 版と同じ場面を、縦長・1画面(スクロールなし)に収まるよう組み直したもの。
// 場面: 2 局目・賭け金 10 枚。親の CPU 1 は「3・3・5 = 目 5」で確定済み。子であるあなたが「4・5・6 = シゴロ」で親に勝ち、
// 20 枚(2 倍)を受け取るところ。CPU 2・CPU 3 はこれから振る。チップは あなた 130 / 親 80 / CPU 2 95 / CPU 3 95(合計 400 で保存)。
// スマホでは #sidenote が状態文の帯と重なることがあるため、賭け金は盤の中の木札に置き、大事な情報は #strip・#status・盤に寄せている。
(() => {
  const css = `
  .play-screen .boardwrap.k-chinchiro-m{display:block}
  .ccm-wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:16px;overflow:hidden;
    background:
      radial-gradient(420px 380px at 50% 44%,rgba(255,190,90,.17),rgba(0,0,0,0) 62%),
      repeating-linear-gradient(0deg,rgba(0,0,0,.035) 0 2px,rgba(0,0,0,0) 2px 7px),
      repeating-linear-gradient(90deg,#513216 0 74px,#482b12 74px 77px),
      linear-gradient(180deg,#553619,#3a2310)}
  /* ---- ダイス(目は CSS の点で描く。1 の目だけ赤く大きく) ---- */
  .ccm-die{position:relative;flex:none;box-sizing:border-box;border-radius:19%;
    background:linear-gradient(145deg,#ffffff,#e8e4da);
    box-shadow:inset 0 0 0 1px #cfc9ba,inset -3px -4px 6px rgba(0,0,0,.10),3px 5px 8px rgba(0,0,0,.38)}
  .ccm-pip{position:absolute;width:20%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);
    background:radial-gradient(circle at 38% 35%,#4c4c50,#141519 72%);box-shadow:inset 0 1px 2px rgba(0,0,0,.65)}
  .ccm-pip.ccm-red{width:36%;background:radial-gradient(circle at 38% 35%,#f0563f,#c92415 72%)}
  /* ---- 丼(白磁に青い二重線)。主役として大きく、画面の中央に ---- */
  .ccm-bowl{position:absolute;left:50%;top:49%;width:244px;height:244px;transform:translate(-50%,-50%);border-radius:50%;
    background:radial-gradient(circle at 50% 36%,#fdfcf8,#f0ebdf 55%,#ddd4bf 79%,#c6b898);
    box-shadow:0 16px 26px rgba(0,0,0,.48),inset 0 -12px 20px rgba(120,90,40,.20),inset 0 8px 15px rgba(255,255,255,.75)}
  .ccm-bowl::before{content:'';position:absolute;inset:10px;border:3px solid #2456a6;border-radius:50%}
  .ccm-bowl::after{content:'';position:absolute;inset:18px;border:1.5px solid #2456a6;border-radius:50%}
  .ccm-well{position:absolute;inset:38px;border-radius:50%;
    background:radial-gradient(circle at 50% 34%,#eae1cd,#d7cbb1 68%,#c0af8d);
    box-shadow:inset 0 10px 20px rgba(90,60,20,.38),inset 0 -7px 12px rgba(255,255,255,.35)}
  .ccm-bowl .ccm-die{position:absolute;z-index:2}
  /* ---- 木札 ---- */
  .ccm-tag{position:absolute;z-index:3;writing-mode:vertical-rl;font-weight:800;letter-spacing:.22em;color:#5a3a14;
    background:linear-gradient(180deg,#ecca95,#dbb877);border:1.5px solid #a97e3f;border-radius:5px;
    padding:10px 5px;font-size:15px;box-shadow:0 4px 8px rgba(0,0,0,.35);transform:rotate(5deg)}
  .ccm-oya{display:inline-grid;place-items:center;width:21px;height:21px;border-radius:4px;font-size:12px;font-weight:800;color:#5a3a14;
    background:linear-gradient(180deg,#ecca95,#dbb877);border:1.5px solid #a97e3f;box-shadow:0 2px 4px rgba(0,0,0,.3);flex:none}
  .ccm-bet{position:absolute;z-index:2;left:10px;bottom:10px;font-size:11.5px;font-weight:800;color:#f3dfae;letter-spacing:.04em;
    background:linear-gradient(180deg,#6b4423,#4c2c12);border:1px solid rgba(0,0,0,.45);border-radius:6px;
    padding:5px 9px;box-shadow:0 3px 6px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,220,160,.3)}
  .ccm-bet b{color:#ffd23f;font-size:13px}
  /* ---- チップの積み重ね ---- */
  .ccm-stacks{display:flex;gap:6px;align-items:flex-end}
  .ccm-stack{display:flex;flex-direction:column;width:29px}
  .ccm-disc{position:relative;width:29px;height:11.5px;border-radius:50%;margin-top:-5.5px;flex:none;
    box-shadow:inset 0 -3px 4px rgba(0,0,0,.28),inset 0 2px 2px rgba(255,255,255,.35)}
  .ccm-disc:first-child{margin-top:0}
  .ccm-disc::after{content:'';position:absolute;inset:2px 3.5px;border:1.5px dashed rgba(255,255,255,.55);border-radius:50%}
  .ccm-disc.ccm-gold{background:radial-gradient(ellipse at 50% 32%,#f5d384,#d9a441 62%,#a97621)}
  .ccm-disc.ccm-blue{background:radial-gradient(ellipse at 50% 32%,#7ea2ec,#2f5fd0 62%,#1d439c)}
  .ccm-disc.ccm-white{background:radial-gradient(ellipse at 50% 32%,#fdfaf0,#ddd6c4 62%,#b3aa93)}
  .ccm-disc.ccm-big{width:42px;height:16.5px;margin-top:-7.5px}
  .ccm-disc.ccm-big::after{inset:3px 5px}
  /* ---- 席 ---- */
  .ccm-seat{position:absolute;z-index:2;display:flex;align-items:center;gap:7px}
  .ccm-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:14px;flex:none;
    box-shadow:inset -3px -4px 6px rgba(0,0,0,.22),0 3px 6px rgba(0,0,0,.35)}
  .ccm-scol{display:flex;flex-direction:column;gap:2px}
  .ccm-snm{font-size:11.5px;font-weight:700;color:#f3e3c2;text-shadow:0 1px 3px rgba(0,0,0,.6);display:flex;align-items:center;gap:5px;line-height:1.15;white-space:nowrap}
  .ccm-seat.ccm-you .ccm-av{width:38px;height:38px;font-size:15px;box-shadow:0 0 0 2.5px #ffd23f,inset -3px -4px 6px rgba(0,0,0,.22),0 3px 6px rgba(0,0,0,.35)}
  .ccm-seat.ccm-you .ccm-snm{color:#ffd97a;font-size:12.5px}
  .ccm-seat.ccm-top{top:10px;left:50%;transform:translateX(-50%)}
  .ccm-seat.ccm-bottom{bottom:10px;left:50%;transform:translateX(-50%)}
  /* 左右の席は縦積みにして、丼の脇の細い余白に収める。チップは色を混ぜた 1 本の山にする */
  .ccm-seat.ccm-side{flex-direction:column;gap:4px;top:47%;transform:translateY(-50%)}
  .ccm-seat.ccm-side .ccm-scol{align-items:center;gap:3px}
  .ccm-seat.ccm-left{left:9px}
  .ccm-seat.ccm-right{right:9px}
  /* ---- 親のダイスを置く小盆 ---- */
  .ccm-tray{position:absolute;z-index:2;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:5px;
    background:linear-gradient(180deg,#5f3f21,#472c13);border:1px solid rgba(0,0,0,.4);border-radius:9px;
    padding:5px 7px;box-shadow:0 5px 10px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,220,160,.25)}
  /* ---- 精算のチップ(丼と親の間) ---- */
  .ccm-transfer{position:absolute;z-index:2;top:112px;left:calc(50% + 34px);padding:10px 13px;border-radius:50%;
    background:radial-gradient(ellipse at 50% 50%,rgba(255,205,80,.30),rgba(255,205,80,0) 70%)}
  .ccm-transfer .ccm-stack{width:42px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // ダイス: 目の位置は 3x3 の [列, 行](0/1/2)。中心 % は 25/50/75。
  const PIPS = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };
  const die = (v, size, styleAttr = '') =>
    `<div class="ccm-die" style="width:${size}px;height:${size}px;${styleAttr}">` +
    PIPS[v].map(([c, r]) => `<span class="ccm-pip${v === 1 ? ' ccm-red' : ''}" style="left:${25 + c * 25}%;top:${25 + r * 25}%"></span>`).join('') + `</div>`;

  // チップ: 金 = 50 / 青 = 10 / 白 = 5 として積む。
  const stack = (color, n, big = false) =>
    `<div class="ccm-stack">${Array.from({ length: n }, () => `<div class="ccm-disc ccm-${color}${big ? ' ccm-big' : ''}"></div>`).join('')}</div>`;
  const stacks = (list) => `<div class="ccm-stacks">${list.map(([c, n]) => stack(c, n)).join('')}</div>`;
  // 左右の席用: 色を混ぜて 1 本に積んだ山(幅を取らない)。
  const mixStack = (list) =>
    `<div class="ccm-stack">${list.map(([c, n]) => Array.from({ length: n }, () => `<div class="ccm-disc ccm-${c}"></div>`).join('')).join('')}</div>`;

  const AV = {
    you: `<span class="ccm-av" style="background:#FFC65C;color:#3A2616">あ</span>`,
    c1: `<span class="ccm-av" style="background:#b9bec9;color:#2c2f36">C</span>`,
    c2: `<span class="ccm-av" style="background:#2f5fd0;color:#fff">C</span>`,
    c3: `<span class="ccm-av" style="background:#2e8b6e;color:#fff">C</span>`,
  };
  const seat = (cls, av, name, chipsHtml, extra = '') =>
    `<div class="ccm-seat ${cls}">${av}<div class="ccm-scol"><div class="ccm-snm">${name}${extra}</div>${chipsHtml}</div></div>`;

  const html = `<div class="ccm-wrap">
    ${seat('ccm-top', AV.c1, 'CPU 1', stacks([['gold', 1], ['blue', 3]]), '<span class="ccm-oya">親</span>')}
    <div class="ccm-tray">${die(3, 26)}${die(3, 26)}${die(5, 26)}</div>
    <div class="ccm-transfer">${stack('blue', 2, true)}</div>
    ${seat('ccm-side ccm-left', AV.c2, 'CPU 2', mixStack([['gold', 1], ['blue', 4], ['white', 1]]))}
    ${seat('ccm-side ccm-right', AV.c3, 'CPU 3', mixStack([['gold', 1], ['blue', 4], ['white', 1]]))}
    <div class="ccm-bowl"><div class="ccm-well"></div>
      ${die(4, 54, 'left:62px;top:90px;transform:rotate(-11deg)')}
      ${die(5, 54, 'left:126px;top:68px;transform:rotate(8deg)')}
      ${die(6, 54, 'left:102px;top:126px;transform:rotate(17deg)')}
    </div>
    <div class="ccm-tag" style="left:calc(50% + 90px);top:60%">シゴロ</div>
    <div class="ccm-bet">賭け金 <b>10</b> 枚</div>
    ${seat('ccm-bottom ccm-you', AV.you, 'あなた', stacks([['gold', 2], ['blue', 3]]))}
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ほかのゲームと同じ欄だけを使う) ----
  document.querySelector('.stagehead h2').textContent = 'チンチロリン';
  document.querySelector('#hround').innerHTML = `<span class="hchip">2 局目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = true;
  const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>',
    '<span class="dot face" style="background:#2f5fd0;color:#fff">C</span>',
    '<span class="dot face" style="background:#2e8b6e;color:#fff">C</span>'];
  const rows = [
    ['あなた', 'チップ 130 枚', true],
    ['CPU 1', '親 ・ チップ 80 枚', false],
    ['CPU 2', 'チップ 95 枚', false],
    ['CPU 3', 'チップ 95 枚', false],
  ];
  document.querySelector('#strip').innerHTML = rows.map(([n, nt, turn], i) =>
    `<div class="pl ${turn ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${nt}</span></span></div>`).join('');
  document.querySelector('#status').textContent = 'シゴロ！ 親から 20 枚獲得';
  // スマホでは #sidenote は状態文の帯と重なりやすいので空にし、賭け金は盤の中の木札に置いている。
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-chinchiro-m'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
