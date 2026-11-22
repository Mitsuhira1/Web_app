// バトルシップ — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 対戦の途中(両者 12 発ずつ撃った後、あなたの攻撃の番)。敵の海域で 3 マスの艦を 1 隻撃沈済み、4 マスの艦に 2 発命中中。
// コア(core/games/battleship.mjs)の view が返す情報だけを描く前提: 敵の海域は、自分の射撃結果(命中・外れ・撃沈した艦)だけが見える。
(() => {
  const css = `
  .play-screen .boardwrap.k-battleship{display:block}
  .bs-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;padding:16px 14px;
    background:radial-gradient(1100px 620px at 28% -10%,#14406e,#0a2748 58%,#071c33);
    display:flex;gap:20px;justify-content:center;align-items:stretch;overflow:hidden}
  .bs-col{display:flex;flex-direction:column;gap:10px}
  .bs-col .bs-chips,.bs-col .bs-ownchips{margin-top:auto}
  .bs-cap{color:#d7ebff;font-weight:700;font-size:16px;letter-spacing:.1em;display:flex;align-items:baseline;gap:10px}
  .bs-cap small{color:#8fb8dd;font-size:11.5px;font-weight:600;letter-spacing:.05em}
  .bs-board{position:relative;display:grid}
  .bs-lab{color:#8fb8dd;font-weight:700;display:grid;place-items:center}
  .bs-cell{position:relative;box-sizing:border-box;background:rgba(120,180,230,.05);border:1px solid rgba(140,190,230,.16)}
  .bs-cell.band{background:rgba(255,210,63,.07)}
  .bs-cell.miss::after{content:'';position:absolute;inset:0;margin:auto;width:26%;height:26%;border-radius:50%;
    background:rgba(205,228,248,.55);box-shadow:0 0 0 3px rgba(205,228,248,.10)}
  .bs-cell.target{background:rgba(255,210,63,.13);box-shadow:inset 0 0 0 2.5px #ffd23f}
  .bs-cell.target::before{content:'';position:absolute;inset:21%;border:2.5px solid rgba(255,210,63,.95);border-radius:50%}
  .bs-cell.target::after{content:'';position:absolute;inset:0;margin:auto;width:9%;height:9%;border-radius:50%;background:#ffd23f}
  .bs-ship{position:absolute;z-index:1;box-sizing:border-box;border:1.5px solid #22344a;
    background:linear-gradient(180deg,#aebfd2,#71859c 55%,#55687e);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(0,0,0,.35)}
  .bs-ship.h{background-image:repeating-linear-gradient(90deg,rgba(15,30,48,0) 0,rgba(15,30,48,0) calc(var(--cell) - 1px),rgba(15,30,48,.38) calc(var(--cell) - 1px),rgba(15,30,48,.38) var(--cell)),linear-gradient(180deg,#aebfd2,#71859c 55%,#55687e);border-radius:9px 999px 999px 9px}
  .bs-ship.v{background-image:repeating-linear-gradient(0deg,rgba(15,30,48,0) 0,rgba(15,30,48,0) calc(var(--cell) - 1px),rgba(15,30,48,.38) calc(var(--cell) - 1px),rgba(15,30,48,.38) var(--cell)),linear-gradient(90deg,#aebfd2,#71859c 55%,#55687e);border-radius:999px 999px 9px 9px}
  .bs-ship.sunk{background:linear-gradient(180deg,#7a5a52,#4c3833);border-color:#2a1d1a;opacity:.95}
  .bs-burst{position:absolute;z-index:2;pointer-events:none;
    clip-path:polygon(50% 0%,58% 30%,79% 13%,75% 38%,98% 33%,85% 52%,100% 64%,81% 70%,91% 91%,67% 83%,63% 100%,50% 85%,37% 100%,33% 83%,9% 91%,19% 70%,0% 64%,15% 52%,2% 33%,25% 38%,21% 13%,42% 30%);
    background:radial-gradient(circle at 50% 50%,#fff6d8 0 14%,#ffd23f 32%,#ff7b33 58%,#e83a2a 82%,#c22418 100%)}
  .bs-chips{display:flex;gap:8px;align-items:center}
  .bs-chip{display:flex;gap:2px;padding:4px 5px;border-radius:7px;background:rgba(10,25,45,.45);border:1px solid rgba(140,190,230,.14)}
  .bs-seg{width:15px;height:15px;border-radius:3.5px;background:linear-gradient(180deg,#aebfd2,#71859c);border:1px solid #22344a;box-sizing:border-box}
  .bs-chip.sunk .bs-seg{background:linear-gradient(180deg,#7a5a52,#4c3833);border-color:#2a1d1a}
  .bs-chip.sunk{box-shadow:inset 0 0 0 1.5px rgba(232,58,42,.55)}
  .bs-seg.dmg{background:radial-gradient(circle at 50% 50%,#fff6d8 0 18%,#ffd23f 38%,#ff7b33 62%,#e83a2a 88%),linear-gradient(180deg,#aebfd2,#71859c)}
  .bs-ownchips{display:flex;flex-direction:column;gap:6px}
  .bs-ownchips .bs-chip{align-self:flex-start}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const COLS = 'ABCDEFGHIJ';
  const key = (x, y) => x + ',' + y;

  function board({ cell, labW, labH, labFs, ships, hits, miss, target }) {
    const hitSet = new Set(hits.map(([x, y]) => key(x, y)));
    const missSet = new Set(miss.map(([x, y]) => key(x, y)));
    let cells = `<div class="bs-lab" style="font-size:${labFs}px"></div>` +
      Array.from({ length: 10 }, (_, x) => `<div class="bs-lab" style="font-size:${labFs}px">${COLS[x]}</div>`).join('');
    for (let y = 0; y < 10; y++) {
      cells += `<div class="bs-lab" style="font-size:${labFs}px">${y + 1}</div>`;
      for (let x = 0; x < 10; x++) {
        const cls = ['bs-cell'];
        if (target && (x === target[0] || y === target[1])) cls.push('band');
        if (missSet.has(key(x, y))) cls.push('miss');
        if (target && x === target[0] && y === target[1]) cls.push('target');
        cells += `<div class="${cls.join(' ')}"></div>`;
      }
    }
    const sunkCells = new Set();
    for (const s of ships) if (s.sunk) for (let i = 0; i < s.len; i++) sunkCells.add(key(s.dir === 'h' ? s.x + i : s.x, s.dir === 'h' ? s.y : s.y + i));
    const shipDivs = ships.map(s => {
      const horiz = s.dir === 'h';
      const r = s.sunk ? 0.84 : 0.68;
      const left = labW + s.x * cell + (horiz ? 4 : (cell - cell * r) / 2);
      const top = labH + s.y * cell + (horiz ? (cell - cell * r) / 2 : 4);
      return `<div class="bs-ship ${s.dir}${s.sunk ? ' sunk' : ''}" style="left:${left}px;top:${top}px;width:${horiz ? s.len * cell - 8 : cell * r}px;height:${horiz ? cell * r : s.len * cell - 8}px"></div>`;
    }).join('');
    const bursts = hits.map(([x, y]) => {
      const sz = cell * (sunkCells.has(key(x, y)) ? 0.68 : 0.92);
      return `<div class="bs-burst" style="left:${labW + x * cell + (cell - sz) / 2}px;top:${labH + y * cell + (cell - sz) / 2}px;width:${sz}px;height:${sz}px"></div>`;
    }).join('');
    return `<div class="bs-board" style="--cell:${cell}px;grid-template-columns:${labW}px repeat(10,${cell}px);grid-template-rows:${labH}px repeat(10,${cell}px)">${cells}${shipDivs}${bursts}</div>`;
  }

  const chips = (list) => `<div class="bs-chips">${list.map(c =>
    `<div class="bs-chip${c.sunk ? ' sunk' : ''}">${Array.from({ length: c.len }, (_, i) =>
      `<div class="bs-seg${c.dmg && c.dmg.includes(i) ? ' dmg' : ''}"></div>`).join('')}</div>`).join('')}</div>`;

  // 敵の海域: 撃沈した 3 マスの艦だけ姿が見える。命中 6(撃沈分 3・4 マス艦に 2・単発 1)、外れ 6。
  const enemy = board({
    cell: 44, labW: 26, labH: 24, labFs: 13,
    ships: [{ x: 7, y: 2, len: 3, dir: 'v', sunk: true }],
    hits: [[7, 2], [7, 3], [7, 4], [2, 6], [3, 6], [5, 3]],
    miss: [[4, 1], [9, 2], [0, 4], [8, 7], [5, 8], [3, 9]],
    target: [5, 6],
  });
  // 自分の艦隊: 5 隻とも健在。4 マス艦と 3 マス艦に 1 発ずつ被弾、外れ 10。
  const own = board({
    cell: 32, labW: 20, labH: 18, labFs: 11,
    ships: [
      { x: 0, y: 0, len: 5, dir: 'h' }, { x: 8, y: 1, len: 4, dir: 'v' },
      { x: 2, y: 3, len: 3, dir: 'h' }, { x: 6, y: 6, len: 3, dir: 'v' },
      { x: 1, y: 7, len: 2, dir: 'h' },
    ],
    hits: [[8, 2], [3, 3]],
    miss: [[5, 1], [1, 2], [9, 5], [4, 6], [7, 7], [0, 9], [9, 8], [6, 0], [2, 5], [8, 9]],
    target: null,
  });

  const html = `<div class="bs-wrap">
    <div class="bs-col">
      <div class="bs-cap">敵の海域</div>
      ${enemy}
      ${chips([{ len: 5 }, { len: 4 }, { len: 3, sunk: true }, { len: 3 }, { len: 2 }])}
    </div>
    <div class="bs-col">
      <div class="bs-cap">自分の艦隊</div>
      ${own}
      <div class="bs-ownchips">
        ${chips([{ len: 5 }])}
        ${chips([{ len: 4, dmg: [1] }])}
        ${chips([{ len: 3, dmg: [1] }, { len: 3 }, { len: 2 }])}
      </div>
    </div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
  document.querySelector('.stagehead h2').textContent = 'バトルシップ';
  document.querySelector('#hround').innerHTML = `<span class="hchip">13 手目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>'];
  const names = ['あなた', 'CPU 1'];
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${i === 0 ? '攻撃の番' : 'CPU 中級'}</span></span></div>`).join('');
  document.querySelector('#status').textContent = '攻撃するマスを選んでください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>撃沈した敵艦</span><b class="num">1 / 5</b></div>` +
    `<div class="kv"><span>自分の残り艦</span><b class="num">5 / 5</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-battleship'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
