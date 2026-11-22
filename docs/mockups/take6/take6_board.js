// 6ニムト — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人対戦の 4 ターン目、全員が同時に出すカードを選ぶところ。あなたは「42」を選んで少し持ち上げている。
// 牛の頭の数(失点)は、コアの bullHeads と同じ規則で付けている: 55→7、11 の倍数→5、10 の倍数→3、5 で終わる→2、他→1。
(() => {
  const css = `
  .play-screen .boardwrap.k-take6{display:block}
  .t6-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;padding:12px 16px;overflow:hidden;
    display:flex;flex-direction:column;gap:10px;
    background:
      radial-gradient(900px 480px at 50% -8%,rgba(255,222,160,.38),rgba(255,222,160,0) 60%),
      repeating-linear-gradient(90deg,rgba(62,36,10,.055) 0 2px,rgba(62,36,10,0) 2px 148px),
      linear-gradient(168deg,#bb8552,#a06a38 55%,#8a5527);
    box-shadow:inset 0 0 110px rgba(43,22,4,.38)}
  .t6-main{display:flex;gap:34px;justify-content:center;align-items:flex-start}
  .t6-rows{display:flex;flex-direction:column;gap:7px}
  .t6-lane{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:12px;
    background:rgba(66,38,12,.20);box-shadow:inset 0 1px 4px rgba(43,22,4,.35),inset 0 -1px 0 rgba(255,226,170,.14)}
  .t6-lane.danger{background:rgba(122,40,22,.26)}
  .t6-card{width:68px;height:96px;flex:none;border-radius:9px;box-sizing:border-box;padding:5px 4px 4px;
    background:linear-gradient(172deg,#fffdf6,#f6ecd7);border:1px solid #d9c9a8;
    box-shadow:0 2px 5px rgba(50,28,8,.35),inset 0 1px 0 #fff;
    display:flex;flex-direction:column;align-items:center}
  .t6-card.tail{box-shadow:0 2px 5px rgba(50,28,8,.35),0 0 15px rgba(255,238,185,.65),inset 0 1px 0 #fff}
  .t6-card.hot{background:linear-gradient(172deg,#fff8f1,#ffe7da);border-color:#d9906f;
    box-shadow:0 2px 5px rgba(50,28,8,.35),0 0 13px rgba(255,120,80,.40),inset 0 1px 0 #fff}
  .t6-heads{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:1px;width:60px;min-height:25px}
  .t6-numwrap{flex:1;display:grid;place-items:center;width:100%}
  .t6-num{font-size:30px;font-weight:800;color:#37312a;line-height:1;letter-spacing:-.01em}
  .t6-slot{width:68px;height:96px;flex:none;border-radius:9px;box-sizing:border-box;
    border:1.5px dashed rgba(74,45,16,.38);background:rgba(255,246,224,.13)}
  .t6-slot.next{border-color:rgba(255,196,64,.85);background:rgba(255,205,80,.13);box-shadow:0 0 12px rgba(255,190,60,.35)}
  .t6-side{display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:8px}
  .t6-picks{display:flex;align-items:flex-start;gap:10px}
  .t6-back{width:46px;height:66px;flex:none;border-radius:7px;box-sizing:border-box;position:relative;
    background:linear-gradient(158deg,#83332a,#5d2019);border:1px solid #47150f;
    box-shadow:0 2px 5px rgba(50,28,8,.4),inset 0 0 0 3px #5d2019,inset 0 0 0 4.5px rgba(232,185,60,.45);
    display:grid;place-items:center}
  .t6-back .dotp{position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;border:1.5px solid rgba(255,244,214,.85)}
  .t6-deck{position:relative;width:52px;height:72px;flex:none}
  .t6-deck .t6-back{position:absolute;left:0;top:6px}
  .t6-hand{display:flex;justify-content:center;align-items:flex-end;height:118px;margin-top:auto}
  .t6-card.hand{width:68px;height:98px;margin-left:-13px;transform-origin:50% 92%;cursor:pointer}
  .t6-card.hand:first-child{margin-left:0}
  .t6-card.hand .t6-num{font-size:31px}
  .t6-card.hand .t6-heads{width:60px;min-height:25px}
  .t6-card.sel{border:2.5px solid #e8b93c;z-index:5;
    box-shadow:0 0 0 3px rgba(232,185,60,.35),0 12px 20px rgba(50,28,8,.45),inset 0 1px 0 #fff}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // 牛の顔(角・耳・顔・鼻)。小さい時は輪郭で読める形にしている。
  const bull = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24">`
    + `<path d="M6.2 8.5C3.8 7 3.2 4.4 4.4 2.8c1.6.4 2.8 1.8 3.2 3.6z" fill="#eadfc6"/>`
    + `<path d="M17.8 8.5c2.4-1.5 3-4.1 1.8-5.7-1.6.4-2.8 1.8-3.2 3.6z" fill="#eadfc6"/>`
    + `<ellipse cx="4.6" cy="11" rx="2.2" ry="1.5" fill="#9c6636" transform="rotate(24 4.6 11)"/>`
    + `<ellipse cx="19.4" cy="11" rx="2.2" ry="1.5" fill="#9c6636" transform="rotate(-24 19.4 11)"/>`
    + `<ellipse cx="12" cy="13.2" rx="7.4" ry="8" fill="#b57e46"/>`
    + `<ellipse cx="12" cy="18.2" rx="4.4" ry="3" fill="#e8c491"/>`
    + `<circle cx="10.3" cy="18.2" r=".95" fill="#7a4a22"/><circle cx="13.7" cy="18.2" r=".95" fill="#7a4a22"/>`
    + `<circle cx="8.9" cy="11.6" r="1.15" fill="#2e1c10"/><circle cx="15.1" cy="11.6" r="1.15" fill="#2e1c10"/>`
    + `</svg>`;
  const bullHeads = (n) => n === 55 ? 7 : n % 11 === 0 ? 5 : n % 10 === 0 ? 3 : n % 10 === 5 ? 2 : 1;
  const heads = (n, s) => Array.from({ length: bullHeads(n) }, () => bull(s)).join('');
  const card = (n, cls = '', headSize = 12) =>
    `<div class="t6-card ${cls}"><div class="t6-heads">${heads(n, headSize)}</div><div class="t6-numwrap"><div class="t6-num">${n}</div></div></div>`;

  // 場の 4 列。末尾のカードには淡い光、55 の列は僅かに赤み、次の 1 枚で埋まる列 4 の空き枠は金色に。
  const rows = [
    { cards: [23, 41] },
    { cards: [8, 19, 36] },
    { cards: [55], danger: true },
    { cards: [87, 94, 99, 103] },
  ];
  const lanes = rows.map(r => {
    const cs = r.cards.map((n, i) => card(n, [
      i === r.cards.length - 1 ? 'tail' : '',
      n === 55 ? 'hot' : '',
    ].join(' '))).join('');
    const slots = Array.from({ length: 5 - r.cards.length }, (_, i) =>
      `<div class="t6-slot${r.cards.length === 4 && i === 0 ? ' next' : ''}"></div>`).join('');
    return `<div class="t6-lane${r.danger ? ' danger' : ''}">${cs}${slots}</div>`;
  }).join('');

  // 相手 3 人の伏せたカード(色の点は側板のアバターと対応)と、山札の束。
  const back = (rot, dotBg) =>
    `<div class="t6-back" style="transform:rotate(${rot}deg)">${bull(25)}${dotBg ? `<span class="dotp" style="background:${dotBg}"></span>` : ''}</div>`;
  const picks = `<div class="t6-picks">
      ${back(-4, '#c9c9c9')}${back(0, '#2f5fd0')}${back(4, '#2e9e5b')}
      <div class="t6-deck">
        <div class="t6-back" style="transform:translate(6px,-6px);background:linear-gradient(158deg,#662720,#471812)"></div>
        <div class="t6-back" style="transform:translate(3px,-3px);background:linear-gradient(158deg,#732b21,#521c14)"></div>
        <div class="t6-back">${bull(25)}</div>
      </div>
    </div>`;

  // あなたの手札。42 を選んで持ち上げた状態。
  const handNums = [5, 17, 28, 42, 58, 63, 71, 84, 96, 100];
  const hand = handNums.map((n, i) => {
    const d = i - 4.5;
    const sel = n === 42;
    const t = sel ? 'rotate(0deg) translateY(-16px)' : `rotate(${(d * 1.9).toFixed(1)}deg) translateY(${(Math.abs(d) * 1.7).toFixed(1)}px)`;
    return card(n, `hand${sel ? ' sel' : ''}`, 12).replace('<div class="t6-card', `<div style="transform:${t}" class="t6-card`);
  }).join('');

  const html = `<div class="t6-wrap">
    <div class="t6-main">
      <div class="t6-rows">${lanes}</div>
      <div class="t6-side">${picks}</div>
    </div>
    <div class="t6-hand">${hand}</div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
  document.querySelector('.stagehead h2').textContent = '6ニムト';
  document.querySelector('#hround').innerHTML = `<span class="hchip">4 ターン目</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = [
    '<span class="avatar ">あ</span>',
    '<span class="dot face">C</span>',
    '<span class="dot face" style="background:#2f5fd0;color:#fff">C</span>',
    '<span class="dot face" style="background:#2e9e5b;color:#fff">C</span>',
  ];
  const players = [['あなた', 12], ['CPU 1', 18], ['CPU 2', 9], ['CPU 3', 21]];
  document.querySelector('#strip').innerHTML = players.map(([n, s], i) =>
    `<div class="pl ${i === 0 ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">失点 ${s}</span></span></div>`).join('');
  document.querySelector('#status').textContent = '出すカードを 1 枚選んでください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>ターン</span><b class="num">4 / 10</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-take6'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
