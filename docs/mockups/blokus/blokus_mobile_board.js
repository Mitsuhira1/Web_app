// ブロックス — 盤面の見本(スマホ版)。PC 版と同じ場面を、縦画面 1 画面(スクロールなし)に収める配置にしたもの。
// 場面: 4 人戦の中盤。各色 7 ピースずつ置いた後、青(あなた)の番。T 字型(5 マス)のゴーストが、青の領地と角で接する合法位置に出ている。
// 配置データは PC 版と同一(同色どうしは角でのみ接し、辺では接しない。初手は自分の角を含む。検証済み)。
// スマホでの工夫: 盤は幅いっぱい(1 マス約 17px)、トレイは盤の下に横長の帯(残りピース 14 種を 2 段で並べる)。
// 細かい盤面なので、実装時は「盤だけ」のピンチズームを補助として許可する想定(操作ボタンはズーム範囲に入れない)。
(() => {
  const css = `
  .play-screen .boardwrap.k-blokus-m{display:block}
  .bkm-wrap{width:100%;box-sizing:border-box;padding:4px 2px 2px;display:flex;flex-direction:column;gap:9px;align-items:center}
  .bkm-frame{position:relative;background:#dfe1e5;border-radius:12px;padding:7px;width:100%;max-width:374px;box-sizing:border-box;
    box-shadow:0 2px 8px rgba(60,50,20,.18),inset 0 1px 0 #fff}
  .bkm-corner{position:absolute;width:9px;height:9px;border-radius:2.5px;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.25);z-index:2}
  .bkm-board{display:grid;grid-template-columns:repeat(20,1fr);gap:1px;background:#c6c9cf;padding:1px;border-radius:5px}
  .bkm-cell{aspect-ratio:1/1;background:#f8f8f6;border-radius:2px;box-sizing:border-box}
  .bkm-cell.p{border-radius:3px;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1.5px 0 rgba(0,0,0,.14)}
  .bkm-cell.c0{background:linear-gradient(145deg,#6ea8ff,#2f6df6 60%,#2560dd)}
  .bkm-cell.c1{background:linear-gradient(145deg,#ffd968,#f5b921 60%,#dd9a0d)}
  .bkm-cell.c2{background:linear-gradient(145deg,#ff8a7a,#ef4444 60%,#d92f2f)}
  .bkm-cell.c3{background:linear-gradient(145deg,#5fd68f,#22b573 60%,#159a5e)}
  .bkm-cell.ghost{background:rgba(47,109,246,.30);border-radius:3px;box-shadow:inset 0 0 0 2px #2f6df6}
  .bkm-tray{width:100%;max-width:374px;background:linear-gradient(160deg,#ffffff,#edf0f4);border:1px solid #d4d8de;border-radius:12px;
    box-shadow:0 2px 8px rgba(60,50,20,.14),inset 0 1px 0 #fff;padding:7px 10px 9px;box-sizing:border-box}
  .bkm-tray-head{display:flex;align-items:baseline;justify-content:space-between;padding:0 2px}
  .bkm-tray-head .t{font-size:12.5px;font-weight:700;color:#4a463c;letter-spacing:.02em}
  .bkm-tray-head .n{font-size:12.5px;color:#6b675c}
  .bkm-tray-head .n b{font-size:14px;color:#33302a}
  .bkm-slots{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:6px}
  .bkm-slot{background:rgba(30,40,60,.045);border-radius:8px;min-height:37px;display:grid;place-items:center;
    box-shadow:inset 0 1px 3px rgba(30,40,60,.08)}
  .bkm-slot.sel{background:#fff6da;box-shadow:inset 0 0 0 2px #f0a500,0 1px 3px rgba(240,165,0,.35)}
  .bkm-mini{display:grid;gap:1px}
  .bkm-mini i{width:5px;height:5px;border-radius:1px;background:linear-gradient(145deg,#6ea8ff,#2f6df6 60%,#2560dd);
    box-shadow:inset 0 .5px 0 rgba(255,255,255,.5)}
  .bkm-mini i.o{background:transparent;box-shadow:none}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const K = (x, y) => x + ',' + y;
  // 色 0=青(左上) 1=黄(右上) 2=赤(右下) 3=緑(左下)。PC 版と同一の配置。
  const PIECES = [
    [
      [[0,0],[0,1],[0,2],[1,2],[2,2]],
      [[3,3],[4,3],[5,3],[6,3],[4,2]],
      [[2,4],[2,5],[2,6],[2,7],[3,7]],
      [[7,4],[8,4],[8,5],[8,6],[9,6]],
      [[4,8],[4,9],[5,9],[6,9],[6,8]],
      [[10,7],[10,8],[10,9],[11,9]],
      [[1,8],[1,9]],
    ],
    [
      [[19,0],[19,1],[19,2],[18,2],[17,2]],
      [[14,3],[15,3],[16,3],[15,4],[15,5]],
      [[14,1],[15,1],[16,1]],
      [[13,4],[12,4],[12,5],[13,5],[12,6]],
      [[16,6],[16,7],[17,7],[17,8],[18,8]],
      [[11,0],[11,1],[11,2],[11,3]],
      [[11,7],[11,8]],
    ],
    [
      [[19,19],[19,18],[19,17],[18,17],[17,17]],
      [[14,16],[15,16],[16,16],[15,15],[15,14]],
      [[14,18],[15,18],[16,18]],
      [[13,15],[12,15],[12,14],[13,14],[12,13]],
      [[16,13],[16,12],[17,12],[17,11],[18,11]],
      [[11,16],[11,17],[11,18],[11,19]],
      [[11,12],[11,11],[10,11]],
    ],
    [
      [[0,19],[0,18],[0,17],[1,17],[2,17]],
      [[3,16],[4,16],[5,16],[4,15],[4,14]],
      [[3,18],[4,18],[5,18],[6,18]],
      [[6,15],[7,15],[7,14],[7,13],[8,13]],
      [[3,13],[3,12],[4,12],[5,12],[5,13]],
      [[2,15],[2,14],[1,14]],
      [[9,12],[10,12]],
    ],
  ];
  const GHOST = [[7,10],[7,11],[7,12],[8,11],[9,11]]; // T 字型(5 マス)。青と角で接する合法位置

  const cellColor = new Map();
  PIECES.forEach((pieces, c) => pieces.forEach(p => p.forEach(([x, y]) => cellColor.set(K(x, y), c))));
  const ghostSet = new Set(GHOST.map(([x, y]) => K(x, y)));
  let cells = '';
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const k = K(x, y);
    if (ghostSet.has(k)) cells += `<div class="bkm-cell ghost"></div>`;
    else if (cellColor.has(k)) cells += `<div class="bkm-cell p c${cellColor.get(k)}"></div>`;
    else cells += `<div class="bkm-cell"></div>`;
  }
  const corner = (bg, stylePos) => `<span class="bkm-corner" style="background:${bg};${stylePos}"></span>`;
  const board = `<div class="bkm-frame">
    ${corner('#2f6df6', 'left:3px;top:3px')}${corner('#f5b921', 'right:3px;top:3px')}
    ${corner('#ef4444', 'right:3px;bottom:3px')}${corner('#22b573', 'left:3px;bottom:3px')}
    <div class="bkm-board">${cells}</div></div>`;

  // あなたの残りピース 14 種(PC 版と同じ並び)。T 字型が選択中。
  const TRAY = [
    { cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
    { cells: [[1,0],[0,1],[1,1],[2,1],[1,2]] },
    { cells: [[0,0],[0,1],[1,1],[1,2],[2,2]] },
    { cells: [[1,0],[2,0],[0,1],[1,1],[1,2]] },
    { cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] },
    { cells: [[1,0],[0,1],[1,1],[0,2],[0,3]] },
    { cells: [[0,0],[1,0],[2,0],[1,1],[1,2]], sel: true },
    { cells: [[0,0],[1,0],[2,0],[3,0]] },
    { cells: [[0,0],[1,0],[0,1],[1,1]] },
    { cells: [[0,0],[1,0],[2,0],[1,1]] },
    { cells: [[1,0],[2,0],[0,1],[1,1]] },
    { cells: [[0,0],[1,0],[2,0]] },
    { cells: [[0,0],[0,1],[1,1]] },
    { cells: [[0,0]] },
  ];
  const mini = (t) => {
    const w = Math.max(...t.cells.map(c => c[0])) + 1, h = Math.max(...t.cells.map(c => c[1])) + 1;
    const set = new Set(t.cells.map(([x, y]) => K(x, y)));
    let g = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g += set.has(K(x, y)) ? `<i></i>` : `<i class="o"></i>`;
    return `<div class="bkm-slot${t.sel ? ' sel' : ''}"><div class="bkm-mini" style="grid-template-columns:repeat(${w},5px)">${g}</div></div>`;
  };
  const tray = `<div class="bkm-tray">
    <div class="bkm-tray-head"><span class="t">あなたのピース</span><span class="n">残り <b>14</b> / 21</span></div>
    <div class="bkm-slots">${TRAY.map(mini).join('')}</div></div>`;

  // ---- 画面に差し込む(共通部品はそのまま。スマホでは #sidenote が状態の帯と重なるため、大事な情報は盤の中と側板欄に置く) ----
  document.querySelector('.stagehead h2').textContent = 'ブロックス';
  document.querySelector('#hround').innerHTML = `<span class="hchip">13 手目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = [
    '<span class="avatar ">あ</span>',
    '<span class="dot face" style="background:#f5b921;color:#4a3200">C</span>',
    '<span class="dot face" style="background:#ef4444;color:#fff">C</span>',
    '<span class="dot face" style="background:#22b573;color:#fff">C</span>',
  ];
  const names = ['あなた', 'CPU 1', 'CPU 2', 'CPU 3'];
  const left = [58, 60, 59, 60];
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">残り ${left[i]} マス</span></span></div>`).join('');
  document.querySelector('#status').textContent = '置くピースと場所を選んでください';
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-blokus-m'; wrap.innerHTML = `<div class="bkm-wrap">${board}${tray}</div>`;
  document.querySelector('#acts').innerHTML = '';
})();
