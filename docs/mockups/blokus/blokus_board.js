// ブロックス — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人戦の中盤。各色 7 ピースずつ置いた後、青(あなた)の番。T 字型(5 マス)のゴーストが、青の領地と角で接する合法位置に出ている。
// 配置はすべて規則どおり(同色どうしは角でのみ接し、辺では接しない。初手は自分の角を含む)。検証済み。
(() => {
  const css = `
  .play-screen .boardwrap.k-blokus{display:block}
  .bk-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;padding:16px 18px;
    background:linear-gradient(165deg,#f3efe6,#e9e4d8);
    display:flex;gap:20px;justify-content:center;align-items:stretch;overflow:hidden}
  .bk-frame{position:relative;background:#dfe1e5;border-radius:14px;padding:12px;
    box-shadow:0 2px 10px rgba(60,50,20,.18),inset 0 1px 0 #fff}
  .bk-corner{position:absolute;width:13px;height:13px;border-radius:3.5px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);z-index:2}
  .bk-board{display:grid;grid-template-columns:repeat(20,25px);grid-template-rows:repeat(20,25px);gap:1px;
    background:#c6c9cf;padding:1px;border-radius:6px}
  .bk-cell{width:25px;height:25px;background:#f8f8f6;border-radius:2.5px;box-sizing:border-box}
  .bk-cell.p{border-radius:4px;box-shadow:inset 0 1.5px 0 rgba(255,255,255,.5),inset 0 -2px 0 rgba(0,0,0,.14),0 .5px 1px rgba(0,0,0,.12)}
  .bk-cell.c0{background:linear-gradient(145deg,#6ea8ff,#2f6df6 60%,#2560dd)}
  .bk-cell.c1{background:linear-gradient(145deg,#ffd968,#f5b921 60%,#dd9a0d)}
  .bk-cell.c2{background:linear-gradient(145deg,#ff8a7a,#ef4444 60%,#d92f2f)}
  .bk-cell.c3{background:linear-gradient(145deg,#5fd68f,#22b573 60%,#159a5e)}
  .bk-cell.ghost{background:rgba(47,109,246,.30);border-radius:4px;box-shadow:inset 0 0 0 2.5px #2f6df6}
  .bk-tray{width:308px;background:linear-gradient(160deg,#ffffff,#edf0f4);border:1px solid #d4d8de;border-radius:16px;
    box-shadow:0 2px 10px rgba(60,50,20,.14),inset 0 1px 0 #fff;padding:12px;box-sizing:border-box;
    display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(5,1fr);gap:9px}
  .bk-slot{background:rgba(30,40,60,.045);border-radius:11px;display:grid;place-items:center;
    box-shadow:inset 0 1.5px 4px rgba(30,40,60,.08)}
  .bk-slot.sel{background:#fff6da;box-shadow:inset 0 0 0 2.5px #f0a500,0 1px 4px rgba(240,165,0,.35)}
  .bk-mini{display:grid;gap:1.5px}
  .bk-mini i{width:9px;height:9px;border-radius:2px;background:linear-gradient(145deg,#6ea8ff,#2f6df6 60%,#2560dd);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.14)}
  .bk-mini i.o{background:transparent;box-shadow:none}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const K = (x, y) => x + ',' + y;
  // 色 0=青(左上) 1=黄(右上) 2=赤(右下) 3=緑(左下)。各色、置いた順のピース(マスの配列)。
  const PIECES = [
    [ // 青
      [[0,0],[0,1],[0,2],[1,2],[2,2]],
      [[3,3],[4,3],[5,3],[6,3],[4,2]],
      [[2,4],[2,5],[2,6],[2,7],[3,7]],
      [[7,4],[8,4],[8,5],[8,6],[9,6]],
      [[4,8],[4,9],[5,9],[6,9],[6,8]],
      [[10,7],[10,8],[10,9],[11,9]],
      [[1,8],[1,9]],
    ],
    [ // 黄
      [[19,0],[19,1],[19,2],[18,2],[17,2]],
      [[14,3],[15,3],[16,3],[15,4],[15,5]],
      [[14,1],[15,1],[16,1]],
      [[13,4],[12,4],[12,5],[13,5],[12,6]],
      [[16,6],[16,7],[17,7],[17,8],[18,8]],
      [[11,0],[11,1],[11,2],[11,3]],
      [[11,7],[11,8]],
    ],
    [ // 赤
      [[19,19],[19,18],[19,17],[18,17],[17,17]],
      [[14,16],[15,16],[16,16],[15,15],[15,14]],
      [[14,18],[15,18],[16,18]],
      [[13,15],[12,15],[12,14],[13,14],[12,13]],
      [[16,13],[16,12],[17,12],[17,11],[18,11]],
      [[11,16],[11,17],[11,18],[11,19]],
      [[11,12],[11,11],[10,11]],
    ],
    [ // 緑
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
    if (ghostSet.has(k)) cells += `<div class="bk-cell ghost"></div>`;
    else if (cellColor.has(k)) cells += `<div class="bk-cell p c${cellColor.get(k)}"></div>`;
    else cells += `<div class="bk-cell"></div>`;
  }
  const corner = (bg, stylePos) => `<span class="bk-corner" style="background:${bg};${stylePos}"></span>`;
  const board = `<div class="bk-frame">
    ${corner('#2f6df6', 'left:5px;top:5px')}${corner('#f5b921', 'right:5px;top:5px')}
    ${corner('#ef4444', 'right:5px;bottom:5px')}${corner('#22b573', 'left:5px;bottom:5px')}
    <div class="bk-board">${cells}</div></div>`;

  // あなたの残りピース 14 種(使った V・Y・L・Z・U・L4・2 マスは抜けている)。T 字型が選択中。
  const TRAY = [
    { cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },                    // I5
    { cells: [[1,0],[0,1],[1,1],[2,1],[1,2]] },                    // X5
    { cells: [[0,0],[0,1],[1,1],[1,2],[2,2]] },                    // W5
    { cells: [[1,0],[2,0],[0,1],[1,1],[1,2]] },                    // F5
    { cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] },                    // P5
    { cells: [[1,0],[0,1],[1,1],[0,2],[0,3]] },                    // N5
    { cells: [[0,0],[1,0],[2,0],[1,1],[1,2]], sel: true },         // T5(選択中。盤のゴーストと同じ物)
    { cells: [[0,0],[1,0],[2,0],[3,0]] },                          // I4
    { cells: [[0,0],[1,0],[0,1],[1,1]] },                          // O4
    { cells: [[0,0],[1,0],[2,0],[1,1]] },                          // T4
    { cells: [[1,0],[2,0],[0,1],[1,1]] },                          // S4
    { cells: [[0,0],[1,0],[2,0]] },                               // I3
    { cells: [[0,0],[0,1],[1,1]] },                                // L3
    { cells: [[0,0]] },                                            // 1 マス
    null,
  ];
  const mini = (t) => {
    if (!t) return `<div class="bk-slot"></div>`;
    const w = Math.max(...t.cells.map(c => c[0])) + 1, h = Math.max(...t.cells.map(c => c[1])) + 1;
    const set = new Set(t.cells.map(([x, y]) => K(x, y)));
    let g = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g += set.has(K(x, y)) ? `<i></i>` : `<i class="o"></i>`;
    return `<div class="bk-slot${t.sel ? ' sel' : ''}"><div class="bk-mini" style="grid-template-columns:repeat(${w},9px)">${g}</div></div>`;
  };
  const tray = `<div class="bk-tray">${TRAY.map(mini).join('')}</div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
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
  const left = [58, 60, 59, 60]; // 残りマス数(置いたマス数から計算: 青 31・黄 29・赤 30・緑 29)
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">残り ${left[i]} マス</span></span></div>`).join('');
  document.querySelector('#status').textContent = '置くピースと場所を選んでください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>あなたの残りピース</span><b class="num">14 / 21</b></div>` +
    `<div class="kv"><span>あなたの残りマス</span><b class="num">58</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-blokus'; wrap.innerHTML = `<div class="bk-wrap">${board}${tray}</div>`;
  document.querySelector('#acts').innerHTML = '';
})();
