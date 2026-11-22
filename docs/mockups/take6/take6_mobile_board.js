// 6ニムト — 盤面の見本(スマホ版)。PC 版と同じ場面(4 人対戦の 4 ターン目、全員が同時に出すカードを選ぶところ。
// あなたは「42」を選択中)を、390px 幅・スクロールなしの 1 画面に収まるよう組み直したもの。
// 場のカードは幅 62px(5 枚+空き枠で 1 列約 342px)、手札はピッチ 32px の扇形で 10 枚を収める。
// 牛の頭の数(失点)は、コアの bullHeads と同じ規則: 55→7、11 の倍数→5、10 の倍数→3、5 で終わる→2、他→1。
(() => {
  const css = `
  .play-screen .boardwrap.k-take6m{display:block}
  .t6m-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:16px;padding:10px 8px;overflow:hidden;
    display:flex;flex-direction:column;gap:8px;
    background:
      radial-gradient(420px 300px at 50% -8%,rgba(255,222,160,.38),rgba(255,222,160,0) 60%),
      repeating-linear-gradient(90deg,rgba(62,36,10,.055) 0 2px,rgba(62,36,10,0) 2px 96px),
      linear-gradient(168deg,#bb8552,#a06a38 55%,#8a5527);
    box-shadow:inset 0 0 70px rgba(43,22,4,.38)}
  .t6m-picks{display:flex;justify-content:flex-end;align-items:flex-start;gap:7px;padding:0 2px}
  .t6m-back{width:28px;height:40px;flex:none;border-radius:5px;box-sizing:border-box;position:relative;
    background:linear-gradient(158deg,#83332a,#5d2019);border:1px solid #47150f;
    box-shadow:0 2px 4px rgba(50,28,8,.4),inset 0 0 0 2.5px #5d2019,inset 0 0 0 3.5px rgba(232,185,60,.45);
    display:grid;place-items:center}
  .t6m-back .dotp{position:absolute;top:2.5px;right:2.5px;width:6.5px;height:6.5px;border-radius:50%;border:1.2px solid rgba(255,244,214,.85)}
  .t6m-deck{position:relative;width:32px;height:44px;flex:none;margin-left:3px}
  .t6m-deck .t6m-back{position:absolute;left:0;top:4px}
  .t6m-rows{display:flex;flex-direction:column;gap:7px}
  .t6m-lane{display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:11px;
    background:rgba(66,38,12,.20);box-shadow:inset 0 1px 4px rgba(43,22,4,.35),inset 0 -1px 0 rgba(255,226,170,.14)}
  .t6m-lane.danger{background:rgba(122,40,22,.26)}
  .t6m-card{width:62px;height:88px;flex:none;border-radius:8px;box-sizing:border-box;padding:4px 3px 3px;
    background:linear-gradient(172deg,#fffdf6,#f6ecd7);border:1px solid #d9c9a8;
    box-shadow:0 2px 5px rgba(50,28,8,.35),inset 0 1px 0 #fff;
    display:flex;flex-direction:column;align-items:center}
  .t6m-card.tail{box-shadow:0 2px 5px rgba(50,28,8,.35),0 0 13px rgba(255,238,185,.65),inset 0 1px 0 #fff}
  .t6m-card.hot{background:linear-gradient(172deg,#fff8f1,#ffe7da);border-color:#d9906f;
    box-shadow:0 2px 5px rgba(50,28,8,.35),0 0 11px rgba(255,120,80,.40),inset 0 1px 0 #fff}
  .t6m-heads{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:1px;width:54px;min-height:24px}
  .t6m-numwrap{flex:1;display:grid;place-items:center;width:100%}
  .t6m-num{font-size:26px;font-weight:800;color:#37312a;line-height:1;letter-spacing:-.01em}
  .t6m-slot{width:62px;height:88px;flex:none;border-radius:8px;box-sizing:border-box;
    border:1.5px dashed rgba(74,45,16,.38);background:rgba(255,246,224,.13)}
  .t6m-slot.next{border-color:rgba(255,196,64,.85);background:rgba(255,205,80,.13);box-shadow:0 0 10px rgba(255,190,60,.35)}
  .t6m-hand{display:flex;justify-content:center;align-items:flex-end;height:106px;margin-top:auto}
  .t6m-card.hand{width:60px;height:86px;margin-left:-31px;transform-origin:50% 92%;align-items:flex-start;padding-left:5px}
  .t6m-card.hand:first-child{margin-left:0}
  .t6m-card.hand .t6m-num{font-size:22px}
  .t6m-card.hand .t6m-heads{width:52px;min-height:22px;justify-content:flex-start}
  .t6m-card.hand .t6m-numwrap{place-items:center start}
  .t6m-card.sel{border:2.5px solid #e8b93c;z-index:5;
    box-shadow:0 0 0 3px rgba(232,185,60,.35),0 10px 16px rgba(50,28,8,.45),inset 0 1px 0 #fff}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // 牛の顔(角・耳・顔・鼻)。PC 版と同じ絵。
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
    `<div class="t6m-card ${cls}"><div class="t6m-heads">${heads(n, headSize)}</div><div class="t6m-numwrap"><div class="t6m-num">${n}</div></div></div>`;

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
      `<div class="t6m-slot${r.cards.length === 4 && i === 0 ? ' next' : ''}"></div>`).join('');
    return `<div class="t6m-lane${r.danger ? ' danger' : ''}">${cs}${slots}</div>`;
  }).join('');

  // 相手 3 人の伏せたカード(色の点はプレイヤー表示のアバターと対応)と、山札の束。スマホでは小さく右上に添えるだけにする。
  const back = (rot, dotBg) =>
    `<div class="t6m-back" style="transform:rotate(${rot}deg)">${bull(15)}${dotBg ? `<span class="dotp" style="background:${dotBg}"></span>` : ''}</div>`;
  const picks = `<div class="t6m-picks">
      ${back(-4, '#c9c9c9')}${back(0, '#2f5fd0')}${back(4, '#2e9e5b')}
      <div class="t6m-deck">
        <div class="t6m-back" style="transform:translate(4px,-4px);background:linear-gradient(158deg,#662720,#471812)"></div>
        <div class="t6m-back" style="transform:translate(2px,-2px);background:linear-gradient(158deg,#732b21,#521c14)"></div>
        <div class="t6m-back">${bull(15)}</div>
      </div>
    </div>`;

  // あなたの手札。42 を選んで持ち上げた状態。
  const handNums = [5, 17, 28, 42, 58, 63, 71, 84, 96, 100];
  const selIdx = handNums.indexOf(42);
  const hand = handNums.map((n, i) => {
    const d = i - 4.5;
    const sel = n === 42;
    const t = sel ? 'rotate(0deg) translateY(-14px)' : `rotate(${(d * 1.4).toFixed(1)}deg) translateY(${(Math.abs(d) * 1.3).toFixed(1)}px)`;
    // 持ち上がった選択中カードに右隣の数字が隠れないよう、その 1 枚だけ間隔を広げる。
    const extra = i === selIdx + 1 ? 'margin-left:-4px;' : '';
    return card(n, `hand${sel ? ' sel' : ''}`, 10).replace('<div class="t6m-card', `<div style="transform:${t};${extra}" class="t6m-card`);
  }).join('');

  const html = `<div class="t6m-wrap">
    ${picks}
    <div class="t6m-rows">${lanes}</div>
    <div class="t6m-hand">${hand}</div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ほかのゲームと同じ欄だけを使う) ----
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
  // スマホでは sidenote が状態の帯と重なって見えることがあるため、情報は strip と盤の中に集約し、ここは空にする。
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-take6m'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = '';
})();
