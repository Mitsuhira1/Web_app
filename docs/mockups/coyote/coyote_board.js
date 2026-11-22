// コヨーテ — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人・特殊カードあり・ライフ 3。ラウンド 3、宣言が 8 → 12 → 15 と進み、あなたの番(宣言するか「コヨーテ」と指摘するか)。
// 他全員のカードは見える(CPU 1 = 12、CPU 2 = ×2 の特殊カード、CPU 3 = 5)。あなたのカードだけ裏向きで、自分にも見えない。
(() => {
  const css = `
  .play-screen .boardwrap.k-coyote{display:block}
  .cy-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;position:relative;overflow:hidden;
    background:radial-gradient(900px 560px at 50% 30%,#7a4326,#5b2d18 62%,#42200f)}
  .cy-table{position:absolute;left:2%;top:3.5%;width:96%;height:93%;border-radius:50%;
    background:radial-gradient(ellipse at 50% 42%,#eebd7d,#dd9c52 55%,#b96f31 82%,#9c5622);
    box-shadow:0 0 0 9px #6e3a1c,0 0 0 12px #59300f, inset 0 6px 30px rgba(255,235,190,.45), inset 0 -18px 44px rgba(90,40,8,.45), 0 24px 40px rgba(20,8,2,.5)}
  .cy-cactus{position:absolute;opacity:.8;pointer-events:none}
  .cy-seat{position:absolute;display:flex;flex-direction:column;align-items:center;z-index:3}
  .cy-ava{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:19px;
    border:2.5px solid rgba(255,248,230,.9);box-shadow:0 4px 10px rgba(60,25,5,.4);z-index:1}
  .cy-name{margin-top:7px;background:rgba(46,20,6,.78);color:#ffe9c4;font-size:12.5px;font-weight:700;letter-spacing:.06em;
    padding:2.5px 10px;border-radius:999px;box-shadow:0 2px 5px rgba(60,25,5,.35)}
  .cy-card{position:relative;border-radius:10px;display:grid;place-items:center;z-index:2;
    box-shadow:0 12px 18px rgba(60,25,5,.45), inset 0 1px 0 rgba(255,255,255,.5)}
  .cy-card.face{background:linear-gradient(165deg,#fffdf6,#f7edd3 70%,#efdfba);border:1.5px solid #d9c69c;color:#4a2c12}
  .cy-card .cy-num{font-weight:900;line-height:1;text-shadow:0 1px 0 #fff}
  .cy-card.gold{background:linear-gradient(160deg,#ffe98a,#f5c33c 55%,#dfa017);border:1.5px solid #a8740c;color:#5e3a05;
    box-shadow:0 12px 18px rgba(60,25,5,.45), inset 0 1px 0 rgba(255,255,255,.75), 0 0 18px rgba(255,205,60,.55)}
  .cy-card.back{background:linear-gradient(160deg,#a52338,#7e1626 60%,#5f0f1d);border:1.5px solid #4d0a14;color:#fff}
  .cy-card.back .cy-frame{position:absolute;inset:6px;border:1.5px solid rgba(255,235,220,.4);border-radius:6px;display:grid;place-items:center}
  .cy-ground{width:84%;height:12px;margin-top:5px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(50,20,4,.42),rgba(50,20,4,0) 68%)}
  .cy-plate{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);z-index:4;text-align:center;
    background:linear-gradient(180deg,#7c4b24,#5e3413 70%,#4e2a0e);border:2px solid #3c1f08;border-radius:14px;
    padding:12px 34px 13px;box-shadow:0 14px 26px rgba(40,16,2,.5), inset 0 1.5px 0 rgba(255,220,160,.4), inset 0 -3px 0 rgba(0,0,0,.3)}
  .cy-plate .cy-bid{color:#ffedb8;font-size:56px;font-weight:900;line-height:1;text-shadow:0 3px 0 rgba(0,0,0,.35);letter-spacing:.02em}
  .cy-hist{position:absolute;left:50%;top:calc(44% + 76px);transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:6px}
  .cy-hchip{background:linear-gradient(180deg,#8a5a2e,#6f421d);color:#ffe9c4;font-weight:800;font-size:15.5px;
    min-width:37px;text-align:center;padding:3.5px 8px;border-radius:8px;border:1.5px solid #4e2a0e;
    box-shadow:0 4px 8px rgba(50,20,4,.4), inset 0 1px 0 rgba(255,220,160,.35)}
  .cy-hchip.now{background:linear-gradient(180deg,#a52338,#7e1626);border-color:#4d0a14;color:#ffe9c4}
  .cy-harr{color:rgba(70,32,8,.75);font-weight:900;font-size:13px}
  .cy-deck{position:absolute;left:64.5%;top:38%;z-index:3;width:56px;height:78px}
  .cy-deck .cy-card{position:absolute;width:56px;height:78px}
  .cy-you{position:absolute;left:50%;bottom:3.2%;transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;align-items:center}
  .cy-you .cy-card.back{box-shadow:0 0 0 3.5px #ffd23f, 0 16px 26px rgba(50,18,2,.55), inset 0 1px 0 rgba(255,255,255,.35)}
  #acts .cy-acts{display:flex;align-items:center;justify-content:center;gap:12px;width:100%}
  .cy-stepper{display:flex;align-items:center;gap:0;background:#fff;border:1.5px solid #d9c69c;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(90,50,10,.18)}
  .cy-stepper button{width:42px;height:42px;border:0;background:#f7edd3;font-size:21px;font-weight:900;color:#7a4a15;cursor:pointer}
  .cy-stepper .cy-next{min-width:58px;text-align:center;font-size:23px;font-weight:900;color:#4a2c12}
  .cy-btn{height:42px;border-radius:12px;border:0;padding:0 22px;font-size:16.5px;font-weight:900;cursor:pointer;letter-spacing:.05em}
  .cy-btn.bid{background:linear-gradient(180deg,#f5c33c,#dfa017);color:#4e2f04;box-shadow:0 3px 8px rgba(120,70,5,.35), inset 0 1.5px 0 rgba(255,255,255,.6);border:1.5px solid #a8740c}
  .cy-btn.coyote{background:linear-gradient(180deg,#c62f45,#9c1c2e);color:#ffe9c4;box-shadow:0 3px 8px rgba(110,10,25,.4), inset 0 1.5px 0 rgba(255,255,255,.35);border:1.5px solid #5f0f1d}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // コヨーテの足跡(肉球): 大きな肉球 1 つ
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

  const seat = (pos, avaBg, avaText, cardHtml, name) => `
    <div class="cy-seat" style="${pos}">
      <div class="cy-ava" style="background:${avaBg}">${avaText}</div>
      <div style="margin-top:-9px;z-index:2;display:flex;flex-direction:column;align-items:center">${cardHtml}<div class="cy-ground"></div></div>
      <div class="cy-name">${name}</div>
    </div>`;
  const faceCard = (label, fs, gold, rot) => `
    <div class="cy-card ${gold ? 'gold' : 'face'}" style="width:78px;height:108px;transform:rotate(${rot}deg)">
      <span class="cy-num" style="font-size:${fs}px">${label}</span>
    </div>`;
  const backCard = (w, h, pawSize) => `
    <div class="cy-card back" style="width:${w}px;height:${h}px"><div class="cy-frame">${paw(pawSize, '#ffe9e4', 0.92)}</div></div>`;

  const html = `<div class="cy-wrap">
    <div class="cy-table"></div>
    <div class="cy-cactus" style="left:3.2%;bottom:5%">${cactus(74, false)}</div>
    <div class="cy-cactus" style="right:3.6%;top:6%">${cactus(58, true)}</div>
    ${seat('left:50%;top:3.2%;transform:translateX(-50%)', 'linear-gradient(180deg,#3f7fbf,#2b5d94)', 'C', faceCard('×2', 37, true, 0), 'CPU 2')}
    ${seat('left:5.5%;top:31%', 'linear-gradient(180deg,#57a05a,#35703a)', 'C', faceCard('12', 42, false, -4), 'CPU 1')}
    ${seat('right:5.5%;top:31%', 'linear-gradient(180deg,#8a63b8,#674291)', 'C', faceCard('5', 42, false, 4), 'CPU 3')}
    <div class="cy-plate"><div class="cy-bid">15</div></div>
    <div class="cy-hist">
      <span class="cy-hchip">8</span><span class="cy-harr">→</span>
      <span class="cy-hchip">12</span><span class="cy-harr">→</span>
      <span class="cy-hchip now">15</span>
    </div>
    <div class="cy-deck">
      <div class="cy-card back" style="left:5px;top:4px;transform:rotate(3deg)"><div class="cy-frame"></div></div>
      <div class="cy-card back" style="left:2px;top:2px;transform:rotate(-2deg)"><div class="cy-frame"></div></div>
      <div class="cy-card back" style="left:0;top:0"><div class="cy-frame">${paw(30, '#ffe9e4', 0.92)}</div></div>
    </div>
    <div class="cy-you">
      ${backCard(106, 148, 62)}
      <div class="cy-ground" style="width:110px"></div>
      <div class="cy-name" style="margin-top:2px">あなた</div>
    </div>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
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
  wrap.onclick = null; wrap.className = 'boardwrap k-coyote'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = `<div class="cy-acts">
    <div class="cy-stepper"><button type="button">−</button><span class="cy-next">16</span><button type="button">＋</button></div>
    <button type="button" class="cy-btn bid">宣言する</button>
    <button type="button" class="cy-btn coyote">コヨーテ！</button>
  </div>`;
})();
