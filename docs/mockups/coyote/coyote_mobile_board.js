// コヨーテ — 盤面の見本(スマホ版)。PC 版と同じ場面を、縦画面 390×844 に最適化したもの。
// 実際の対局画面(上部の戻る・ゲーム名・歯車、プレイヤー表示、最下部の操作ボタン行は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人・特殊カードあり・ライフ 3。ラウンド 3、宣言が 8 → 12 → 15 と進み、あなたの番。
// 工夫: 横長の楕円卓を縦に圧縮し、相手 3 人は上部に横一列。スクロールなしで 1 画面に収める。
(() => {
  const css = `
  .play-screen .boardwrap.k-coyote-m{display:block}
  .cym-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:16px;position:relative;overflow:hidden;
    background:radial-gradient(420px 480px at 50% 26%,#7a4326,#5b2d18 62%,#42200f)}
  .cym-table{position:absolute;left:1.5%;top:1.6%;width:97%;height:96.8%;border-radius:50%;
    background:radial-gradient(ellipse at 50% 40%,#eebd7d,#dd9c52 55%,#b96f31 82%,#9c5622);
    box-shadow:0 0 0 7px #6e3a1c,0 0 0 9.5px #59300f, inset 0 5px 22px rgba(255,235,190,.45), inset 0 -14px 34px rgba(90,40,8,.45), 0 16px 28px rgba(20,8,2,.5)}
  .cym-cactus{position:absolute;opacity:.75;pointer-events:none;z-index:1}
  .cym-opps{position:absolute;left:0;top:4.5%;width:100%;z-index:3;display:flex;justify-content:space-between;padding:0 6.5%;box-sizing:border-box}
  .cym-seat{display:flex;flex-direction:column;align-items:center;width:31%}
  .cym-ava{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13.5px;
    border:2px solid rgba(255,248,230,.9);box-shadow:0 3px 7px rgba(60,25,5,.4);z-index:2;margin-bottom:-8px}
  .cym-card{position:relative;border-radius:8px;display:grid;place-items:center;z-index:1;
    box-shadow:0 8px 13px rgba(60,25,5,.45), inset 0 1px 0 rgba(255,255,255,.5)}
  .cym-card.face{background:linear-gradient(165deg,#fffdf6,#f7edd3 70%,#efdfba);border:1.5px solid #d9c69c;color:#4a2c12}
  .cym-card .cym-num{font-weight:900;line-height:1;text-shadow:0 1px 0 #fff}
  .cym-card.gold{background:linear-gradient(160deg,#ffe98a,#f5c33c 55%,#dfa017);border:1.5px solid #a8740c;color:#5e3a05;
    box-shadow:0 8px 13px rgba(60,25,5,.45), inset 0 1px 0 rgba(255,255,255,.75), 0 0 14px rgba(255,205,60,.55)}
  .cym-card.back{background:linear-gradient(160deg,#a52338,#7e1626 60%,#5f0f1d);border:1.5px solid #4d0a14;color:#fff}
  .cym-card.back .cym-frame{position:absolute;inset:4.5px;border:1.5px solid rgba(255,235,220,.4);border-radius:5px;display:grid;place-items:center}
  .cym-name{margin-top:5px;background:rgba(46,20,6,.78);color:#ffe9c4;font-size:11px;font-weight:700;letter-spacing:.03em;
    padding:2px 8px;border-radius:999px;box-shadow:0 2px 4px rgba(60,25,5,.35);white-space:nowrap}
  .cym-name .cym-life{color:#ff8f9c;letter-spacing:.1em;font-size:10px;margin-left:4px}
  .cym-plate{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);z-index:4;text-align:center;
    background:linear-gradient(180deg,#7c4b24,#5e3413 70%,#4e2a0e);border:2px solid #3c1f08;border-radius:12px;
    padding:8px 27px 9px;box-shadow:0 10px 20px rgba(40,16,2,.5), inset 0 1.5px 0 rgba(255,220,160,.4), inset 0 -3px 0 rgba(0,0,0,.3)}
  .cym-plate .cym-bid{color:#ffedb8;font-size:41px;font-weight:900;line-height:1;text-shadow:0 2.5px 0 rgba(0,0,0,.35);letter-spacing:.02em}
  .cym-hist{position:absolute;left:50%;top:calc(43% + 52px);transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:5px}
  .cym-hchip{background:linear-gradient(180deg,#8a5a2e,#6f421d);color:#ffe9c4;font-weight:800;font-size:13.5px;
    min-width:31px;text-align:center;padding:2.5px 6px;border-radius:7px;border:1.5px solid #4e2a0e;
    box-shadow:0 3px 6px rgba(50,20,4,.4), inset 0 1px 0 rgba(255,220,160,.35)}
  .cym-hchip.now{background:linear-gradient(180deg,#a52338,#7e1626);border-color:#4d0a14;color:#ffe9c4}
  .cym-harr{color:rgba(70,32,8,.75);font-weight:900;font-size:11px}
  .cym-deck{position:absolute;left:76%;top:38.5%;z-index:3;width:38px;height:54px}
  .cym-deck .cym-card{position:absolute;width:38px;height:54px}
  .cym-you{position:absolute;left:50%;bottom:2.6%;transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;align-items:center}
  .cym-you .cym-card.back{box-shadow:0 0 0 3.5px #ffd23f, 0 12px 20px rgba(50,18,2,.55), inset 0 1px 0 rgba(255,255,255,.35)}
  .cym-ground{width:84%;height:9px;margin-top:4px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(50,20,4,.42),rgba(50,20,4,0) 68%)}
  #acts .cym-acts{display:flex;align-items:center;justify-content:center;gap:7px;width:100%}
  .cym-stepper{display:flex;align-items:center;background:#fff;border:1.5px solid #d9c69c;border-radius:11px;overflow:hidden;box-shadow:0 2px 5px rgba(90,50,10,.18)}
  .cym-stepper button{width:37px;height:44px;border:0;background:#f7edd3;font-size:19px;font-weight:900;color:#7a4a15;cursor:pointer;padding:0}
  .cym-stepper .cym-next{min-width:40px;text-align:center;font-size:20px;font-weight:900;color:#4a2c12}
  .cym-btn{height:44px;border-radius:11px;border:0;padding:0 13px;font-size:14.5px;font-weight:900;cursor:pointer;letter-spacing:.03em;white-space:nowrap}
  .cym-btn.bid{background:linear-gradient(180deg,#f5c33c,#dfa017);color:#4e2f04;box-shadow:0 3px 7px rgba(120,70,5,.35), inset 0 1.5px 0 rgba(255,255,255,.6);border:1.5px solid #a8740c}
  .cym-btn.coyote{background:linear-gradient(180deg,#c62f45,#9c1c2e);color:#ffe9c4;box-shadow:0 3px 7px rgba(110,10,25,.4), inset 0 1.5px 0 rgba(255,255,255,.35);border:1.5px solid #5f0f1d}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const paw = (size, color, opacity) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" opacity="${opacity}">
    <g fill="${color}">
      <ellipse cx="50" cy="64" rx="17" ry="13"/>
      <ellipse cx="24" cy="42" rx="7.5" ry="10" transform="rotate(-18 24 42)"/>
      <ellipse cx="41" cy="31" rx="7.5" ry="10.5" transform="rotate(-6 41 31)"/>
      <ellipse cx="59" cy="31" rx="7.5" ry="10.5" transform="rotate(6 59 31)"/>
      <ellipse cx="76" cy="42" rx="7.5" ry="10" transform="rotate(18 76 42)"/>
    </g></svg>`;
  const cactus = (h, flip) => `<svg width="${h * 0.62}" height="${h}" viewBox="0 0 62 100" style="transform:scaleX(${flip ? -1 : 1})">
    <g fill="#4a3a20"><rect x="26" y="8" width="11" height="88" rx="5.5"/>
    <path d="M26 38 h-8 a7 7 0 0 1 -7 -7 v-9 a6 6 0 0 1 12 0 v7 h3 z"/>
    <path d="M37 52 h8 a7 7 0 0 0 7 -7 v-12 a6 6 0 0 0 -12 0 v10 h-3 z"/></g></svg>`;

  const seat = (avaBg, cardHtml, name, life) => `
    <div class="cym-seat">
      <div class="cym-ava" style="background:${avaBg}">C</div>
      ${cardHtml}
      <div class="cym-name">${name}<span class="cym-life">${life}</span></div>
    </div>`;
  const faceCard = (label, fs, gold, rot) => `
    <div class="cym-card ${gold ? 'gold' : 'face'}" style="width:50px;height:69px;transform:rotate(${rot}deg)">
      <span class="cym-num" style="font-size:${fs}px">${label}</span>
    </div>`;
  const backCard = (w, h, pawSize) => `
    <div class="cym-card back" style="width:${w}px;height:${h}px"><div class="cym-frame">${paw(pawSize, '#ffe9e4', 0.92)}</div></div>`;

  const html = `<div class="cym-wrap">
    <div class="cym-table"></div>
    <div class="cym-cactus" style="left:2.6%;bottom:4.5%">${cactus(46, false)}</div>
    <div class="cym-cactus" style="right:2.8%;bottom:16%">${cactus(38, true)}</div>
    <div class="cym-opps">
      ${seat('linear-gradient(180deg,#57a05a,#35703a)', faceCard('12', 27, false, -3), 'CPU 1', '♥♥♥')}
      ${seat('linear-gradient(180deg,#3f7fbf,#2b5d94)', faceCard('×2', 23, true, 0), 'CPU 2', '♥♥')}
      ${seat('linear-gradient(180deg,#8a63b8,#674291)', faceCard('5', 27, false, 3), 'CPU 3', '♥♥♥')}
    </div>
    <div class="cym-plate"><div class="cym-bid">15</div></div>
    <div class="cym-hist">
      <span class="cym-hchip">8</span><span class="cym-harr">→</span>
      <span class="cym-hchip">12</span><span class="cym-harr">→</span>
      <span class="cym-hchip now">15</span>
    </div>
    <div class="cym-deck">
      <div class="cym-card back" style="left:4px;top:3px;transform:rotate(3deg)"><div class="cym-frame"></div></div>
      <div class="cym-card back" style="left:2px;top:1.5px;transform:rotate(-2deg)"><div class="cym-frame"></div></div>
      <div class="cym-card back" style="left:0;top:0"><div class="cym-frame">${paw(21, '#ffe9e4', 0.92)}</div></div>
    </div>
    <div class="cym-you">
      ${backCard(90, 124, 52)}
      <div class="cym-ground" style="width:90px"></div>
      <div class="cym-name" style="margin-top:1px">あなた<span class="cym-life">♥♥♥</span></div>
    </div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。PC 版と同じ欄だけに入れる) ----
  document.querySelector('.stagehead h2').textContent = 'コヨーテ';
  document.querySelector('#hround').innerHTML = `<span class="hchip">ラウンド 3</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = [
    '<span class="avatar ">あ</span>',
    '<span class="dot face">C</span>',
    '<span class="dot face" style="background:#2f5fd0;color:#fff">C</span>',
    '<span class="dot face" style="background:#674291;color:#fff">C</span>',
  ];
  const rows = [
    ['あなた', '♥♥♥', true],
    ['CPU 1', '♥♥♥', false],
    ['CPU 2', '♥♥', false],
    ['CPU 3', '♥♥♥', false],
  ];
  document.querySelector('#strip').innerHTML = rows.map(([n, life, turn], i) =>
    `<div class="pl ${turn ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt" style="color:#d94f5c;letter-spacing:.14em">${life}</span></span></div>`).join('');
  document.querySelector('#status').textContent = '宣言するか「コヨーテ」か選んでください';
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>ラウンド</span><b class="num">3</b></div>` +
    `<div class="kv"><span>山札</span><b class="num">残り 21 枚</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-coyote-m'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = `<div class="cym-acts">
    <div class="cym-stepper"><button type="button">−</button><span class="cym-next">16</span><button type="button">＋</button></div>
    <button type="button" class="cym-btn bid">宣言する</button>
    <button type="button" class="cym-btn coyote">コヨーテ！</button>
  </div>`;
})();
