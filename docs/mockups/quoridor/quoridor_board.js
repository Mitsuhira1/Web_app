// コリドール — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 中盤、あなたの番。あなた(赤)は下から上へ、CPU(青)は上から下へ。中央で向き合い、赤(4,4)と青(4,3)が接している(次の手でジャンプできる位置)。
// 壁は置いてある 7 枚(横 4・縦 3)に、CPU の進路の前方へ置こうとしている 1 枚のゴースト。残りの壁は盤の上下の置き場に本数で示す(上: CPU 6 本、下: あなた 7 本)。
(() => {
  const CELL = 45, GROOVE = 9, PITCH = CELL + GROOVE, SIZE = 9 * CELL + 8 * GROOVE;
  const css = `
  .play-screen .boardwrap.k-quoridor{display:block}
  .qd-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;padding:10px;
    background:radial-gradient(1000px 620px at 50% -10%,#4a3520,#2e2011 62%,#211708);
    display:flex;flex-direction:column;gap:7px;justify-content:center;align-items:center;overflow:hidden}
  .qd-tray{display:flex;align-items:center;gap:5px;height:20px}
  .qd-dot{width:13px;height:13px;border-radius:50%;margin-right:5px;box-shadow:inset 0 -2px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.4)}
  .qd-dot.red{background:radial-gradient(circle at 35% 30%,#ff9a8a,#d43a2a 60%,#a82318)}
  .qd-dot.blue{background:radial-gradient(circle at 35% 30%,#9ac2ff,#2f5fd0 60%,#1d3f8f)}
  .qd-stick{width:56px;height:11px;border-radius:6px;box-sizing:border-box;
    background:linear-gradient(180deg,#e3b96e,#c99a4a);border:1px solid #7d5226;
    box-shadow:0 1px 2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,240,200,.55)}
  .qd-frame{box-sizing:border-box;border-radius:16px;padding:11px;
    background:linear-gradient(160deg,#96682f,#74491d 70%,#654017);
    box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,230,170,.35)}
  .qd-band{height:7px;border-radius:4px}
  .qd-band.red{background:linear-gradient(180deg,#e05545,#b03024);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
  .qd-band.blue{background:linear-gradient(180deg,#5b84e0,#2f5fd0);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
  .qd-board{position:relative;margin:6px 0;background:#9c6b32;border-radius:6px;
    box-shadow:inset 0 2px 6px rgba(50,28,4,.55)}
  .qd-cell{position:absolute;box-sizing:border-box;border-radius:3px;
    box-shadow:inset 0 1px 2px rgba(120,72,20,.35),inset 0 -1px 0 rgba(255,244,210,.35)}
  .qd-cell.a{background:linear-gradient(135deg,#eccf97,#e3c184)}
  .qd-cell.b{background:linear-gradient(135deg,#e6c384,#dbb26f)}
  .qd-wall{position:absolute;z-index:2;box-sizing:border-box;border-radius:5px;
    background:linear-gradient(180deg,#eec87e,#cf9f4e);border:1px solid #7d5226;
    box-shadow:0 1px 3px rgba(50,28,4,.5),inset 0 1px 0 rgba(255,244,205,.65)}
  .qd-wall.v{background:linear-gradient(90deg,#eec87e,#cf9f4e)}
  .qd-wall.ghost{opacity:.58;box-shadow:none;outline:1.5px dashed rgba(96,58,14,.85);outline-offset:-1px}
  .qd-pawn{position:absolute;z-index:3;border-radius:50%;box-sizing:border-box;
    border:2px solid rgba(60,20,5,.28);
    box-shadow:0 3px 5px rgba(40,20,2,.45),inset 0 -4px 6px rgba(0,0,0,.22),inset 0 3px 4px rgba(255,255,255,.35)}
  .qd-pawn.red{background:radial-gradient(circle at 36% 30%,#ffb0a0,#e0492f 52%,#b02a1a 82%,#93200f)}
  .qd-pawn.blue{background:radial-gradient(circle at 36% 30%,#b9d4ff,#3f6fe0 52%,#274fa8 82%,#1b3a80)}
  .qd-cand{position:absolute;z-index:1;border-radius:50%;background:rgba(96,58,14,.34);
    box-shadow:0 0 0 2px rgba(255,246,220,.28)}
  .qd-cand.jump{background:transparent;border:3.5px solid rgba(96,58,14,.42);box-sizing:border-box;box-shadow:none}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // マス
  let cells = '';
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    cells += `<div class="qd-cell ${(x + y) % 2 ? 'b' : 'a'}" style="left:${x * PITCH}px;top:${y * PITCH}px;width:${CELL}px;height:${CELL}px"></div>`;
  }
  // 壁: h は行 y と y+1 の境界に列 x・x+1、v は列 x と x+1 の境界に行 y・y+1(コアの hWalls / vWalls と同じ)
  const wall = (dir, x, y, ghost) => dir === 'h'
    ? `<div class="qd-wall h${ghost ? ' ghost' : ''}" style="left:${x * PITCH}px;top:${y * PITCH + CELL}px;width:${2 * CELL + GROOVE}px;height:${GROOVE}px"></div>`
    : `<div class="qd-wall v${ghost ? ' ghost' : ''}" style="left:${x * PITCH + CELL}px;top:${y * PITCH}px;width:${GROOVE}px;height:${2 * CELL + GROOVE}px"></div>`;
  const walls = [
    wall('h', 1, 5), wall('h', 5, 1), wall('h', 5, 6), wall('h', 4, 7),
    wall('v', 1, 3), wall('v', 6, 4), wall('v', 2, 6),
    wall('h', 4, 5, true),
  ].join('');
  // 移動候補: 上下左右(左・右・下は淡い丸、相手を飛び越える先は輪)
  const cand = (x, y, jump) => {
    const sz = jump ? 22 : 15;
    return `<div class="qd-cand${jump ? ' jump' : ''}" style="left:${x * PITCH + (CELL - sz) / 2}px;top:${y * PITCH + (CELL - sz) / 2}px;width:${sz}px;height:${sz}px"></div>`;
  };
  const cands = cand(4, 2, true) + cand(3, 4) + cand(5, 4) + cand(4, 5);
  // コマ: あなた(赤) (4,4)、CPU(青) (4,3)
  const pawn = (x, y, color) => {
    const sz = 34;
    return `<div class="qd-pawn ${color}" style="left:${x * PITCH + (CELL - sz) / 2}px;top:${y * PITCH + (CELL - sz) / 2}px;width:${sz}px;height:${sz}px"></div>`;
  };
  const pawns = pawn(4, 3, 'blue') + pawn(4, 4, 'red');
  // 壁の置き場: 棒そのものの本数で示す
  const tray = (n, color) => `<div class="qd-tray"><span class="qd-dot ${color}"></span>${'<span class="qd-stick"></span>'.repeat(n)}</div>`;

  const html = `<div class="qd-wrap">
    ${tray(6, 'blue')}
    <div class="qd-frame">
      <div class="qd-band red"></div>
      <div class="qd-board" style="width:${SIZE}px;height:${SIZE}px">${cells}${walls}${cands}${pawns}</div>
      <div class="qd-band blue"></div>
    </div>
    ${tray(7, 'red')}
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
  document.querySelector('.stagehead h2').textContent = 'コリドール';
  document.querySelector('#hround').innerHTML = `<span class="hchip">18 手目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>'];
  const names = ['あなた', 'CPU 1'];
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${i === 0 ? '' : 'CPU 中級'}</span></span></div>`).join('');
  document.querySelector('#status').textContent = 'コマを進めるか、壁を置いてください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>あなたの壁</span><b class="num">残り 7</b></div>` +
    `<div class="kv"><span>CPU の壁</span><b class="num">残り 6</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-quoridor'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
