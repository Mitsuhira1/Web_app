// チンチロリン — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 2 局目・賭け金 10 枚。親の CPU 1 は「3・3・5 = 目 5」で確定済み。子であるあなたが「4・5・6 = シゴロ」で親に勝ち、
// 20 枚(2 倍)を受け取るところ。CPU 2・CPU 3 はこれから振る。チップは あなた 130 / 親 80 / CPU 2 95 / CPU 3 95(合計 400 で保存)。
// コア(core/games/chinchiro.mjs)の view が返す情報(全公開)だけを描く前提。
(() => {
  const css = `
  .play-screen .boardwrap.k-chinchiro{display:block}
  .cc-wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:18px;overflow:hidden;
    background:
      radial-gradient(920px 500px at 50% 40%,rgba(255,190,90,.17),rgba(0,0,0,0) 62%),
      repeating-linear-gradient(0deg,rgba(0,0,0,.035) 0 2px,rgba(0,0,0,0) 2px 7px),
      repeating-linear-gradient(90deg,#513216 0 116px,#482b12 116px 119px),
      linear-gradient(180deg,#553619,#3a2310)}
  /* ---- ダイス(目は CSS の点で描く。1 の目だけ赤く大きく) ---- */
  .cc-die{position:relative;flex:none;box-sizing:border-box;border-radius:19%;
    background:linear-gradient(145deg,#ffffff,#e8e4da);
    box-shadow:inset 0 0 0 1px #cfc9ba,inset -3px -4px 6px rgba(0,0,0,.10),3px 5px 8px rgba(0,0,0,.38)}
  .cc-pip{position:absolute;width:20%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);
    background:radial-gradient(circle at 38% 35%,#4c4c50,#141519 72%);box-shadow:inset 0 1px 2px rgba(0,0,0,.65)}
  .cc-pip.red{width:36%;background:radial-gradient(circle at 38% 35%,#f0563f,#c92415 72%)}
  /* ---- 丼(白磁に青い二重線) ---- */
  .cc-bowl{position:absolute;left:50%;top:52%;width:336px;height:336px;transform:translate(-50%,-50%);border-radius:50%;
    background:radial-gradient(circle at 50% 36%,#fdfcf8,#f0ebdf 55%,#ddd4bf 79%,#c6b898);
    box-shadow:0 20px 32px rgba(0,0,0,.48),inset 0 -14px 24px rgba(120,90,40,.20),inset 0 10px 18px rgba(255,255,255,.75)}
  .cc-bowl::before{content:'';position:absolute;inset:13px;border:3px solid #2456a6;border-radius:50%}
  .cc-bowl::after{content:'';position:absolute;inset:23px;border:1.5px solid #2456a6;border-radius:50%}
  .cc-well{position:absolute;inset:50px;border-radius:50%;
    background:radial-gradient(circle at 50% 34%,#eae1cd,#d7cbb1 68%,#c0af8d);
    box-shadow:inset 0 12px 24px rgba(90,60,20,.38),inset 0 -9px 15px rgba(255,255,255,.35)}
  .cc-bowl .cc-die{position:absolute;z-index:2}
  /* ---- 木札 ---- */
  .cc-tag{position:absolute;z-index:3;writing-mode:vertical-rl;font-weight:800;letter-spacing:.22em;color:#5a3a14;
    background:linear-gradient(180deg,#ecca95,#dbb877);border:1.5px solid #a97e3f;border-radius:5px;
    padding:12px 6px;font-size:17px;box-shadow:0 4px 8px rgba(0,0,0,.35);transform:rotate(5deg)}
  .cc-oya{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:4px;font-size:13.5px;font-weight:800;color:#5a3a14;
    background:linear-gradient(180deg,#ecca95,#dbb877);border:1.5px solid #a97e3f;box-shadow:0 2px 4px rgba(0,0,0,.3);flex:none}
  /* ---- チップの積み重ね ---- */
  .cc-stacks{display:flex;gap:9px;align-items:flex-end}
  .cc-stack{display:flex;flex-direction:column;width:34px}
  .cc-disc{position:relative;width:34px;height:13.5px;border-radius:50%;margin-top:-6.5px;flex:none;
    box-shadow:inset 0 -3px 4px rgba(0,0,0,.28),inset 0 2px 2px rgba(255,255,255,.35)}
  .cc-disc:first-child{margin-top:0}
  .cc-disc::after{content:'';position:absolute;inset:2px 4px;border:1.5px dashed rgba(255,255,255,.55);border-radius:50%}
  .cc-disc.gold{background:radial-gradient(ellipse at 50% 32%,#f5d384,#d9a441 62%,#a97621)}
  .cc-disc.blue{background:radial-gradient(ellipse at 50% 32%,#7ea2ec,#2f5fd0 62%,#1d439c)}
  .cc-disc.white{background:radial-gradient(ellipse at 50% 32%,#fdfaf0,#ddd6c4 62%,#b3aa93)}
  .cc-disc.big{width:46px;height:18px;margin-top:-8px}
  .cc-disc.big::after{inset:3px 5px}
  /* ---- 席 ---- */
  .cc-seat{position:absolute;z-index:2;display:flex;align-items:center;gap:9px}
  .cc-av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:16px;flex:none;
    box-shadow:inset -3px -4px 6px rgba(0,0,0,.22),0 3px 6px rgba(0,0,0,.35)}
  .cc-seat .col{display:flex;flex-direction:column;gap:3px}
  .cc-seat .nm{font-size:12.5px;font-weight:700;color:#f3e3c2;text-shadow:0 1px 3px rgba(0,0,0,.6);display:flex;align-items:center;gap:6px;line-height:1.15}
  .cc-seat.you .cc-av{box-shadow:0 0 0 2.5px #ffd23f,inset -3px -4px 6px rgba(0,0,0,.22),0 3px 6px rgba(0,0,0,.35)}
  .cc-seat.you .nm{color:#ffd97a}
  .cc-seat.top{top:12px;left:50%;transform:translateX(-50%)}
  .cc-seat.bottom{bottom:12px;left:50%;transform:translateX(-50%)}
  .cc-seat.left{left:16px;top:50%;transform:translateY(-50%)}
  .cc-seat.right{right:16px;top:50%;transform:translateY(-50%)}
  /* ---- 親のダイスを置く小盆 ---- */
  .cc-tray{position:absolute;z-index:2;top:70px;left:50%;transform:translateX(-50%);display:flex;gap:6px;
    background:linear-gradient(180deg,#5f3f21,#472c13);border:1px solid rgba(0,0,0,.4);border-radius:10px;
    padding:6px 8px;box-shadow:0 5px 10px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,220,160,.25)}
  /* ---- 精算のチップ(丼と親の間) ---- */
  .cc-transfer{position:absolute;z-index:2;top:100px;left:calc(50% + 78px);padding:12px 16px;border-radius:50%;
    background:radial-gradient(ellipse at 50% 50%,rgba(255,205,80,.30),rgba(255,205,80,0) 70%)}
  .cc-transfer .cc-stack{width:46px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // ダイス: 目の位置は 3x3 の [列, 行](0/1/2)。中心 % は 25/50/75。
  const PIPS = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };
  const die = (v, size, styleAttr = '') =>
    `<div class="cc-die" style="width:${size}px;height:${size}px;${styleAttr}">` +
    PIPS[v].map(([c, r]) => `<span class="cc-pip${v === 1 ? ' red' : ''}" style="left:${25 + c * 25}%;top:${25 + r * 25}%"></span>`).join('') + `</div>`;

  // チップ: 金 = 50 / 青 = 10 / 白 = 5 として積む。
  const stack = (color, n, big = false) =>
    `<div class="cc-stack">${Array.from({ length: n }, () => `<div class="cc-disc ${color}${big ? ' big' : ''}"></div>`).join('')}</div>`;
  const stacks = (list) => `<div class="cc-stacks">${list.map(([c, n]) => stack(c, n)).join('')}</div>`;

  const AV = {
    you: `<span class="cc-av" style="background:#FFC65C;color:#3A2616">あ</span>`,
    c1: `<span class="cc-av" style="background:#b9bec9;color:#2c2f36">C</span>`,
    c2: `<span class="cc-av" style="background:#2f5fd0;color:#fff">C</span>`,
    c3: `<span class="cc-av" style="background:#2e8b6e;color:#fff">C</span>`,
  };
  const seat = (cls, av, name, list, extra = '') =>
    `<div class="cc-seat ${cls}">${av}<div class="col"><div class="nm">${name}${extra}</div>${stacks(list)}</div></div>`;

  const html = `<div class="cc-wrap">
    ${seat('top', AV.c1, 'CPU 1', [['gold', 1], ['blue', 3]], '<span class="cc-oya">親</span>')}
    <div class="cc-tray">${die(3, 29)}${die(3, 29)}${die(5, 29)}</div>
    <div class="cc-transfer">${stack('blue', 2, true)}</div>
    ${seat('left', AV.c2, 'CPU 2', [['gold', 1], ['blue', 4], ['white', 1]])}
    ${seat('right', AV.c3, 'CPU 3', [['gold', 1], ['blue', 4], ['white', 1]])}
    <div class="cc-bowl"><div class="cc-well"></div>
      ${die(4, 62, 'left:84px;top:126px;transform:rotate(-11deg)')}
      ${die(5, 62, 'left:172px;top:100px;transform:rotate(8deg)')}
      ${die(6, 62, 'left:140px;top:182px;transform:rotate(17deg)')}
    </div>
    <div class="cc-tag" style="left:calc(50% + 192px);top:45%">シゴロ</div>
    ${seat('bottom you', AV.you, 'あなた', [['gold', 2], ['blue', 3]])}
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
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
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>賭け金</span><b class="num">10 枚</b></div>` +
    `<div class="kv"><span>局</span><b class="num">2 / 4</b></div>` +
    `<div class="kv"><span>親</span><b>CPU 1</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-chinchiro'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
