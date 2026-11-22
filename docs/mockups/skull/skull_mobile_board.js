// スカル — 盤面の見本(スマホ版)。PC 版(board.png)と同じ場面を、縦画面(390×844)に最適化したもの。
// 実際の対局画面(戻る・ゲーム名・設定・プレイヤー表示・操作ボタン行は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人対戦、チャレンジのめくり中。あなたが「3 枚」と宣言した宣言者で、獲得済み 1 ポイント。
// 自分の場の 2 枚のうち 1 枚(花)はめくり済みで、あと 2 枚めくれば成功の場面。
// スマホ版の工夫: PC 版の丸マット配置(上・左・右)を、相手 3 人は上部に小さなマットで横一列、
// 中央に宣言プレート、下部に自分の場を大きく、という縦の 3 段構成に再編。スクロールなしで 1 画面に収める。
// コア(core/games/skull.mjs)の view が返す情報だけを描く前提: 他人の伏せカードの中身は描かない。
(() => {
  const css = `
  .play-screen .boardwrap.k-skullm{display:block}
  .skm-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:16px;position:relative;overflow:hidden;
    display:flex;flex-direction:column;justify-content:space-between;
    padding:12px 10px 10px;
    background:radial-gradient(560px 420px at 50% -6%,#1e2c47,#101623 56%,#080a10);
    box-shadow:inset 0 0 0 2px rgba(212,175,55,.55),inset 0 0 0 5px #0a0c12,inset 0 0 0 7px rgba(212,175,55,.28)}
  .skm-emblem{position:absolute;left:50%;top:46%;width:250px;height:250px;transform:translate(-50%,-50%);opacity:.05;pointer-events:none}
  /* 相手 3 人: 上部に横一列 */
  .skm-foes{display:flex;justify-content:space-between;align-items:flex-start;padding:0 2px}
  .skm-foe{display:flex;flex-direction:column;align-items:center;gap:5px;width:104px}
  .skm-mat{position:relative;border-radius:50%;flex:none;
    background:radial-gradient(circle at 38% 30%,#4b3a2a,#251a10 64%,#150e07);
    box-shadow:0 7px 16px rgba(0,0,0,.55),inset 0 0 0 2.5px #0c0805,inset 0 0 0 4px rgba(212,175,55,.5)}
  .skm-mat::after{content:'';position:absolute;inset:7px;border-radius:50%;border:1.2px dashed rgba(212,175,55,.38)}
  .skm-cards{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px}
  .skm-stack{position:relative}
  .skm-name{white-space:nowrap;color:#e9d9a8;font-size:11px;font-weight:700;letter-spacing:.06em;
    background:rgba(8,9,14,.72);border:1px solid rgba(212,175,55,.45);border-radius:999px;padding:2px 9px}
  .skm-card{box-sizing:border-box;border-radius:10px;display:grid;place-items:center;position:relative;
    box-shadow:0 4px 9px rgba(0,0,0,.5)}
  .skm-card.back{background:linear-gradient(150deg,#26262f,#0b0b0f 72%);border:1.5px solid #d4af37;
    box-shadow:0 4px 9px rgba(0,0,0,.5),inset 0 0 0 2.5px #0b0b0f,inset 0 0 0 4px rgba(212,175,55,.45)}
  .skm-card.back svg{width:66%;height:66%}
  .skm-card.face{background:radial-gradient(circle at 50% 36%,#33151a,#180a0d 78%);border:1.5px solid #d4af37;
    box-shadow:0 4px 9px rgba(0,0,0,.5),inset 0 0 0 2.5px #180a0d,inset 0 0 0 4px rgba(212,175,55,.4)}
  .skm-card.face svg{width:80%;height:80%}
  .skm-card.next{box-shadow:0 4px 9px rgba(0,0,0,.5),inset 0 0 0 2.5px #0b0b0f,inset 0 0 0 4px rgba(212,175,55,.45),0 0 0 3px #ffd23f,0 0 16px rgba(255,210,63,.55)}
  /* 中央: 宣言プレート */
  .skm-plate{align-self:center;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2;
    background:linear-gradient(160deg,#1c1c24,#0c0c11);border:1.5px solid rgba(212,175,55,.75);border-radius:13px;
    padding:9px 30px 10px;box-shadow:0 8px 20px rgba(0,0,0,.6),inset 0 0 0 3px #0c0c11,inset 0 0 0 4.5px rgba(212,175,55,.3)}
  .skm-bidnum{color:#f3d67b;font-weight:800;font-size:31px;line-height:1;font-family:Georgia,'Times New Roman',serif}
  .skm-bidnum span{font-size:14px;margin-left:3px;letter-spacing:.06em}
  .skm-prog{display:flex;gap:6px}
  .skm-pip{width:24px;height:24px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;
    border:1.5px solid rgba(212,175,55,.4);background:rgba(212,175,55,.05)}
  .skm-pip.on{border-color:#d4af37;background:radial-gradient(circle at 50% 38%,#3a171c,#1c0b0e);box-shadow:0 0 9px rgba(212,63,77,.35)}
  .skm-pip svg{width:82%;height:82%}
  /* 自分の場: 下部に大きく */
  .skm-mine{display:flex;flex-direction:column;align-items:center;gap:6px}
  .skm-mymat{position:relative;width:216px;height:150px;border-radius:50%;
    background:radial-gradient(circle at 38% 30%,#4b3a2a,#251a10 64%,#150e07);
    box-shadow:0 9px 20px rgba(0,0,0,.55),inset 0 0 0 3px #0c0805,inset 0 0 0 5px rgba(212,175,55,.5),0 0 0 3px rgba(255,210,63,.85),0 0 22px rgba(255,210,63,.32)}
  .skm-mymat::after{content:'';position:absolute;inset:9px;border-radius:50%;border:1.5px dashed rgba(212,175,55,.38)}
  .skm-token{position:absolute;right:6px;top:-4px;width:38px;height:38px;border-radius:50%;z-index:3;display:grid;place-items:center;
    background:radial-gradient(circle at 36% 30%,#ffe9a3,#d4af37 55%,#9a7a1e);
    border:1.5px solid #6e5510;box-shadow:0 4px 9px rgba(0,0,0,.55),inset 0 0 0 3px rgba(110,85,16,.5)}
  .skm-token svg{width:74%;height:74%}
  /* 手札の扇: 自分のマットの左下に小さく重ねる */
  .skm-fan{position:absolute;left:-24px;bottom:-4px;display:flex;z-index:2}
  .skm-mini{width:40px;height:40px;margin-left:-13px;transform-origin:50% 92%;
    box-sizing:border-box;border-radius:8px;display:grid;place-items:center;
    background:linear-gradient(150deg,#26262f,#0b0b0f 72%);border:1.5px solid #d4af37;
    box-shadow:0 4px 9px rgba(0,0,0,.5),inset 0 0 0 2.5px #0b0b0f,inset 0 0 0 4px rgba(212,175,55,.45)}
  .skm-mini:first-child{margin-left:0}
  .skm-mini svg{width:64%;height:64%}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // バラの紋章: 'line' = 金の線画(カード裏・透かし)、'red' = 深紅の花(花カード・進み表示)。PC 版と同じ絵。
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
    `<div class="skm-card back ${cls}" style="width:${size}px;height:${size}px;${styleAttr}">${roseSVG('line')}</div>`;
  const stack = (n, size) =>
    `<div class="skm-stack" style="width:${size + (n - 1) * 3}px;height:${size + (n - 1) * 3}px">${Array.from({ length: n }, (_, i) =>
      backCard(size, '', `position:absolute;left:${i * 3}px;top:${(n - 1 - i) * 3}px;`)).join('')}</div>`;
  const foe = (name, n, card, mat) => `
    <div class="skm-foe">
      <div class="skm-mat" style="width:${mat}px;height:${mat}px">
        <div class="skm-cards">${stack(n, card)}</div>
      </div>
      <div class="skm-name">${name}</div>
    </div>`;

  const html = `<div class="skm-wrap">
    <div class="skm-emblem">${roseSVG('line')}</div>

    <div class="skm-foes">
      ${foe('CPU 2', 1, 46, 96)}
      ${foe('CPU 1', 2, 46, 104)}
      ${foe('CPU 3', 2, 41, 96)}
    </div>

    <div class="skm-plate">
      <div class="skm-bidnum">3<span>枚</span></div>
      <div class="skm-prog">
        <span class="skm-pip on">${roseSVG('red')}</span><span class="skm-pip"></span><span class="skm-pip"></span>
      </div>
    </div>

    <div class="skm-mine">
      <div class="skm-mymat">
        <div class="skm-token">${roseSVG('line')}</div>
        <div class="skm-cards" style="gap:12px">
          <div class="skm-card face" style="width:86px;height:86px">${roseSVG('red')}</div>
          ${backCard(86, 'next')}
        </div>
        <div class="skm-fan">
          <div class="skm-mini" style="transform:rotate(-15deg)">${roseSVG('line')}</div>
          <div class="skm-mini" style="transform:rotate(0deg)">${roseSVG('line')}</div>
          <div class="skm-mini" style="transform:rotate(15deg)">${roseSVG('line')}</div>
        </div>
      </div>
      <div class="skm-name">あなた</div>
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
  // スマホでは sidenote が状態文の流れに割り込んで読みにくくなるため空にする。
  // 宣言数・めくった数・ポイントは盤の中(宣言プレートと進み表示・金のバラトークン)で見える。
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-skullm'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
