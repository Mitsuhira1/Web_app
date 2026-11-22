// スカル — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人対戦、チャレンジのめくり中。あなたが「3 枚」と宣言した宣言者で、獲得済み 1 ポイント。
// 自分の場の 2 枚のうち 1 枚(花)はめくり済みで、もう 1 枚をめくれば残り 2 枚のうちの 1 枚が進む場面。
// コア(core/games/skull.mjs)の view が返す情報だけを描く前提: 他人の伏せカードの中身は描かない。
(() => {
  const css = `
  .play-screen .boardwrap.k-skull{display:block}
  .sk-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;position:relative;overflow:hidden;
    background:radial-gradient(1050px 640px at 50% -8%,#1e2c47,#101623 56%,#080a10);
    box-shadow:inset 0 0 0 2px rgba(212,175,55,.55),inset 0 0 0 5px #0a0c12,inset 0 0 0 7px rgba(212,175,55,.28)}
  .sk-emblem{position:absolute;left:50%;top:43%;width:360px;height:360px;transform:translate(-50%,-50%);opacity:.055;pointer-events:none}
  .sk-seat{position:absolute;transform:translate(-50%,-50%)}
  .sk-mat{position:absolute;inset:0;border-radius:50%;
    background:radial-gradient(circle at 38% 30%,#4b3a2a,#251a10 64%,#150e07);
    box-shadow:0 12px 26px rgba(0,0,0,.55),inset 0 0 0 3px #0c0805,inset 0 0 0 5px rgba(212,175,55,.5)}
  .sk-mat::after{content:'';position:absolute;inset:10px;border-radius:50%;border:1.5px dashed rgba(212,175,55,.38)}
  .sk-seat.turn .sk-mat{box-shadow:0 12px 26px rgba(0,0,0,.55),inset 0 0 0 3px #0c0805,inset 0 0 0 5px rgba(212,175,55,.5),0 0 0 3px rgba(255,210,63,.85),0 0 26px rgba(255,210,63,.35)}
  .sk-cards{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px}
  .sk-stack{position:relative}
  .sk-name{position:absolute;left:50%;transform:translateX(-50%);top:calc(100% + 5px);white-space:nowrap;
    color:#e9d9a8;font-size:12.5px;font-weight:700;letter-spacing:.08em;
    background:rgba(8,9,14,.72);border:1px solid rgba(212,175,55,.45);border-radius:999px;padding:2.5px 11px}
  .sk-card{box-sizing:border-box;border-radius:13px;display:grid;place-items:center;position:relative;
    box-shadow:0 5px 12px rgba(0,0,0,.5)}
  .sk-card.back{background:linear-gradient(150deg,#26262f,#0b0b0f 72%);border:1.5px solid #d4af37;
    box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 0 0 3px #0b0b0f,inset 0 0 0 4.5px rgba(212,175,55,.45)}
  .sk-card.back svg{width:66%;height:66%}
  .sk-card.face{background:radial-gradient(circle at 50% 36%,#33151a,#180a0d 78%);border:1.5px solid #d4af37;
    box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 0 0 3px #180a0d,inset 0 0 0 4.5px rgba(212,175,55,.4)}
  .sk-card.face svg{width:80%;height:80%}
  .sk-card.next{box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 0 0 3px #0b0b0f,inset 0 0 0 4.5px rgba(212,175,55,.45),0 0 0 3px #ffd23f,0 0 20px rgba(255,210,63,.55)}
  .sk-token{position:absolute;right:0;top:2px;width:42px;height:42px;border-radius:50%;z-index:3;display:grid;place-items:center;
    background:radial-gradient(circle at 36% 30%,#ffe9a3,#d4af37 55%,#9a7a1e);
    border:1.5px solid #6e5510;box-shadow:0 4px 9px rgba(0,0,0,.55),inset 0 0 0 3px rgba(110,85,16,.5)}
  .sk-token svg{width:74%;height:74%}
  .sk-plate{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);z-index:2;
    display:flex;flex-direction:column;align-items:center;gap:7px;
    background:linear-gradient(160deg,#1c1c24,#0c0c11);border:1.5px solid rgba(212,175,55,.75);border-radius:14px;
    padding:12px 26px 13px;box-shadow:0 10px 24px rgba(0,0,0,.6),inset 0 0 0 3px #0c0c11,inset 0 0 0 4.5px rgba(212,175,55,.3)}
  .sk-bidnum{color:#f3d67b;font-weight:800;font-size:37px;line-height:1;font-family:Georgia,'Times New Roman',serif}
  .sk-bidnum span{font-size:16px;margin-left:3px;letter-spacing:.06em}
  .sk-prog{display:flex;gap:7px}
  .sk-pip{width:27px;height:27px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;
    border:1.5px solid rgba(212,175,55,.4);background:rgba(212,175,55,.05)}
  .sk-pip.on{border-color:#d4af37;background:radial-gradient(circle at 50% 38%,#3a171c,#1c0b0e);box-shadow:0 0 10px rgba(212,63,77,.35)}
  .sk-pip svg{width:82%;height:82%}
  .sk-fan{position:absolute;left:34px;bottom:18px;display:flex;z-index:2}
  .sk-mini{width:57px;height:57px;margin-left:-17px;transform-origin:50% 92%;
    box-sizing:border-box;border-radius:10px;display:grid;place-items:center;
    background:linear-gradient(150deg,#26262f,#0b0b0f 72%);border:1.5px solid #d4af37;
    box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 0 0 3px #0b0b0f,inset 0 0 0 4.5px rgba(212,175,55,.45)}
  .sk-mini:first-child{margin-left:0}
  .sk-mini svg{width:64%;height:64%}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // バラの紋章: 'line' = 金の線画(カード裏・透かし)、'red' = 深紅の花(花カード・進み表示)
  const roseSVG = (mode) => {
    const petalAttrs = mode === 'red'
      ? (inner) => `fill="${inner ? '#d43d4d' : '#a31621'}" stroke="#e8b64c" stroke-width="${inner ? 1.1 : 1.6}" stroke-linejoin="round"`
      : (inner) => `fill="none" stroke="#d4af37" stroke-width="${inner ? 2.1 : 2.6}" stroke-linejoin="round"`;
    const outer = [0, 72, 144, 216, 288].map(r =>
      `<path d="M50 6 C64 20 65 35 50 46 C35 35 36 20 50 6 Z" transform="rotate(${r} 50 50)" ${petalAttrs(false)}/>`).join('');
    const inner = [36, 108, 180, 252, 324].map(r =>
      `<path d="M50 25 C58.5 33 59 42 50 48 C41 42 41.5 33 50 25 Z" transform="rotate(${r} 50 50)" ${petalAttrs(true)}/>`).join('');
    const ring = `<circle cx="50" cy="50" r="47.5" fill="none" stroke="${mode === 'red' ? '#e8b64c' : '#d4af37'}" stroke-width="1.5" opacity=".85"/>`;
    return `<svg viewBox="0 0 100 100">${ring}${outer}${inner}<circle cx="50" cy="49.5" r="4.6" fill="${mode === 'red' ? '#e8b64c' : '#d4af37'}"/></svg>`;
  };

  const backCard = (size, cls = '', styleAttr = '') =>
    `<div class="sk-card back ${cls}" style="width:${size}px;height:${size}px;${styleAttr}">${roseSVG('line')}</div>`;
  const stack = (n, size) =>
    `<div class="sk-stack" style="width:${size + (n - 1) * 4}px;height:${size + (n - 1) * 4}px">${Array.from({ length: n }, (_, i) =>
      backCard(size, '', `position:absolute;left:${i * 4}px;top:${(n - 1 - i) * 4}px;`)).join('')}</div>`;

  const html = `<div class="sk-wrap">
    <div class="sk-emblem">${roseSVG('line')}</div>

    <div class="sk-seat" style="left:50%;top:15.5%;width:178px;height:178px">
      <div class="sk-mat"></div>
      <div class="sk-cards">${stack(2, 82)}</div>
      <div class="sk-name">CPU 1</div>
    </div>

    <div class="sk-seat" style="left:13.5%;top:45%;width:168px;height:168px">
      <div class="sk-mat"></div>
      <div class="sk-cards">${stack(1, 82)}</div>
      <div class="sk-name">CPU 2</div>
    </div>

    <div class="sk-seat" style="left:86.5%;top:45%;width:160px;height:160px">
      <div class="sk-mat"></div>
      <div class="sk-cards">${stack(2, 73)}</div>
      <div class="sk-name">CPU 3</div>
    </div>

    <div class="sk-plate">
      <div class="sk-bidnum">3<span>枚</span></div>
      <div class="sk-prog">
        <span class="sk-pip on">${roseSVG('red')}</span><span class="sk-pip"></span><span class="sk-pip"></span>
      </div>
    </div>

    <div class="sk-seat turn" style="left:50%;top:73%;width:238px;height:238px">
      <div class="sk-mat"></div>
      <div class="sk-token">${roseSVG('line')}</div>
      <div class="sk-cards">
        <div class="sk-card face" style="width:104px;height:104px">${roseSVG('red')}</div>
        ${backCard(104, 'next')}
      </div>
      <div class="sk-name">あなた</div>
    </div>

    <div class="sk-fan">
      <div class="sk-mini" style="transform:rotate(-15deg)">${roseSVG('line')}</div>
      <div class="sk-mini" style="transform:rotate(0deg)">${roseSVG('line')}</div>
      <div class="sk-mini" style="transform:rotate(15deg)">${roseSVG('line')}</div>
    </div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
  document.querySelector('.stagehead h2').textContent = 'スカル';
  document.querySelector('#hround').innerHTML = `<span class="hchip">チャレンジ中</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>',
    '<span class="dot face" style="background:#2f5fd0;color:#fff">C</span>',
    '<span class="dot face" style="background:#8a5a2b;color:#fff">C</span>'];
  const names = ['あなた', 'CPU 1', 'CPU 2', 'CPU 3'];
  const nts = ['手札 4 枚', '手札 4 枚', '手札 4 枚', '手札 3 枚'];
  document.querySelector('#strip').innerHTML = names.map((n, i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${nts[i]}</span></span></div>`).join('');
  document.querySelector('#status').textContent = 'あと 2 枚、ドクロを引かずにめくってください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>宣言</span><b class="num">3 枚</b></div>` +
    `<div class="kv"><span>めくった数</span><b class="num">1 枚</b></div>` +
    `<div class="kv"><span>あなたのポイント</span><b class="num">1</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-skull'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
