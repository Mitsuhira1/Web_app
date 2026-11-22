// コリドール — 盤面の見本(スマホ版)。PC 版と同じ場面を、390×844 の 1 画面にスクロールなしで収める。
// 場面: 中盤、あなたの番(18 手目)。あなた(赤)は下から上へ、CPU(青)は上から下へ。中央で赤(4,4)と青(4,3)が向き合う。
// 壁は置いてある 7 枚(横 4・縦 3)に、CPU の進路の前方へ置こうとしている 1 枚のゴースト。残りの壁は盤の上下の置き場に本数で示す(上: CPU 6 本、下: あなた 7 本)。
// スマホ向けの工夫: 盤は幅いっぱい(マス約 34px、盤全体で約 370px)に広げ、置き場は盤の上下に細い帯として一体化。縦は全体で約 430px に収める。
(() => {
  const CELL = 34, GROOVE = 6.5, PITCH = CELL + GROOVE, SIZE = 9 * CELL + 8 * GROOVE;
  const css = `
  .play-screen .boardwrap.k-quoridor-m{display:block}
  .qdm-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:14px;padding:4px 2px;
    background:radial-gradient(600px 500px at 50% -10%,#4a3520,#2e2011 62%,#211708);
    display:flex;flex-direction:column;gap:5px;justify-content:center;align-items:center;overflow:hidden}
  .qdm-tray{display:flex;align-items:center;gap:4px;height:15px}
  .qdm-dot{width:11px;height:11px;border-radius:50%;margin-right:3px;box-shadow:inset 0 -2px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.4)}
  .qdm-dot.red{background:radial-gradient(circle at 35% 30%,#ff9a8a,#d43a2a 60%,#a82318)}
  .qdm-dot.blue{background:radial-gradient(circle at 35% 30%,#9ac2ff,#2f5fd0 60%,#1d3f8f)}
  .qdm-stick{width:42px;height:9px;border-radius:5px;box-sizing:border-box;
    background:linear-gradient(180deg,#e3b96e,#c99a4a);border:1px solid #7d5226;
    box-shadow:0 1px 2px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,240,200,.55)}
  .qdm-frame{box-sizing:border-box;border-radius:12px;padding:5px;
    background:linear-gradient(160deg,#96682f,#74491d 70%,#654017);
    box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,230,170,.35)}
  .qdm-band{height:6px;border-radius:3px}
  .qdm-band.red{background:linear-gradient(180deg,#e05545,#b03024);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
  .qdm-band.blue{background:linear-gradient(180deg,#5b84e0,#2f5fd0);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
  .qdm-board{position:relative;margin:5px 0;background:#9c6b32;border-radius:5px;
    box-shadow:inset 0 2px 6px rgba(50,28,4,.55)}
  .qdm-cell{position:absolute;box-sizing:border-box;border-radius:3px;
    box-shadow:inset 0 1px 2px rgba(120,72,20,.35),inset 0 -1px 0 rgba(255,244,210,.35)}
  .qdm-cell.a{background:linear-gradient(135deg,#eccf97,#e3c184)}
  .qdm-cell.b{background:linear-gradient(135deg,#e6c384,#dbb26f)}
  .qdm-wall{position:absolute;z-index:2;box-sizing:border-box;border-radius:4px;
    background:linear-gradient(180deg,#eec87e,#cf9f4e);border:1px solid #7d5226;
    box-shadow:0 1px 3px rgba(50,28,4,.5),inset 0 1px 0 rgba(255,244,205,.65)}
  .qdm-wall.v{background:linear-gradient(90deg,#eec87e,#cf9f4e)}
  .qdm-wall.ghost{opacity:.58;box-shadow:none;outline:1.5px dashed rgba(96,58,14,.85);outline-offset:-1px}
  .qdm-pawn{position:absolute;z-index:3;border-radius:50%;box-sizing:border-box;
    border:2px solid rgba(60,20,5,.28);
    box-shadow:0 3px 5px rgba(40,20,2,.45),inset 0 -4px 6px rgba(0,0,0,.22),inset 0 3px 4px rgba(255,255,255,.35)}
  .qdm-pawn.red{background:radial-gradient(circle at 36% 30%,#ffb0a0,#e0492f 52%,#b02a1a 82%,#93200f)}
  .qdm-pawn.blue{background:radial-gradient(circle at 36% 30%,#b9d4ff,#3f6fe0 52%,#274fa8 82%,#1b3a80)}
  .qdm-cand{position:absolute;z-index:1;border-radius:50%;background:rgba(96,58,14,.34);
    box-shadow:0 0 0 2px rgba(255,246,220,.28)}
  .qdm-cand.jump{background:transparent;border:3px solid rgba(96,58,14,.42);box-sizing:border-box;box-shadow:none}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // マス
  let cells = '';
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    cells += `<div class="qdm-cell ${(x + y) % 2 ? 'b' : 'a'}" style="left:${x * PITCH}px;top:${y * PITCH}px;width:${CELL}px;height:${CELL}px"></div>`;
  }
  // 壁(PC 版と同配置): h は行 y と y+1 の境界に列 x・x+1、v は列 x と x+1 の境界に行 y・y+1(コアの hWalls / vWalls と同じ)
  const wall = (dir, x, y, ghost) => dir === 'h'
    ? `<div class="qdm-wall h${ghost ? ' ghost' : ''}" style="left:${x * PITCH}px;top:${y * PITCH + CELL}px;width:${2 * CELL + GROOVE}px;height:${GROOVE}px"></div>`
    : `<div class="qdm-wall v${ghost ? ' ghost' : ''}" style="left:${x * PITCH + CELL}px;top:${y * PITCH}px;width:${GROOVE}px;height:${2 * CELL + GROOVE}px"></div>`;
  const walls = [
    wall('h', 1, 5), wall('h', 5, 1), wall('h', 5, 6), wall('h', 4, 7),
    wall('v', 1, 3), wall('v', 6, 4), wall('v', 2, 6),
    wall('h', 4, 5, true),
  ].join('');
  // 移動候補: 左・右・下は淡い丸、相手を飛び越える先(4,2)は輪
  const cand = (x, y, jump) => {
    const sz = jump ? 19 : 12;
    return `<div class="qdm-cand${jump ? ' jump' : ''}" style="left:${x * PITCH + (CELL - sz) / 2}px;top:${y * PITCH + (CELL - sz) / 2}px;width:${sz}px;height:${sz}px"></div>`;
  };
  const cands = cand(4, 2, true) + cand(3, 4) + cand(5, 4) + cand(4, 5);
  // コマ: あなた(赤) (4,4)、CPU(青) (4,3)
  const pawn = (x, y, color) => {
    const sz = 27;
    return `<div class="qdm-pawn ${color}" style="left:${x * PITCH + (CELL - sz) / 2}px;top:${y * PITCH + (CELL - sz) / 2}px;width:${sz}px;height:${sz}px"></div>`;
  };
  const pawns = pawn(4, 3, 'blue') + pawn(4, 4, 'red');
  // 壁の置き場: 棒そのものの本数で示す(側板のメモ欄に頼らない)
  const tray = (n, color) => `<div class="qdm-tray"><span class="qdm-dot ${color}"></span>${'<span class="qdm-stick"></span>'.repeat(n)}</div>`;

  const html = `<div class="qdm-wrap">
    ${tray(6, 'blue')}
    <div class="qdm-frame">
      <div class="qdm-band red"></div>
      <div class="qdm-board" style="width:${SIZE}px;height:${SIZE}px">${cells}${walls}${cands}${pawns}</div>
      <div class="qdm-band blue"></div>
    </div>
    ${tray(7, 'red')}
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ほかのゲームと同じ欄だけに入れる) ----
  document.querySelector('.stagehead h2').textContent = 'コリドール';
  document.querySelector('#hround').innerHTML = `<span class="hchip">18 手目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>'];
  const names = ['あなた', 'CPU 1'];
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${i === 0 ? '' : 'CPU 中級'}</span></span></div>`).join('');
  document.querySelector('#status').textContent = 'コマを進めるか、壁を置いてください';
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-quoridor-m'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
