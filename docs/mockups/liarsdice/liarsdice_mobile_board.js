// ライアーズダイス — 盤面の見本(スマホ版)。PC 版と同じ場面を、縦画面(390×844)に最適化して実際の対局画面に差し込む。
// 場面: 4 人対戦・ラウンド 5・1 のワイルドあり。CPU 2 の宣言が「4 が 3 個」で、今があなたの番(宣言を上げるか「ダウト」か)。
// 工夫: 楕円卓を縦長の卓に圧縮し、相手 3 人のカップは上部に横一列。自分のダイス [4,4,2,1,6] は下部のトレイに大きく置く。
// スクロールなしで 1 画面に収める。場のダイス総数は、スマホでは見えにくい #sidenote ではなく卓の上に置く。
(() => {
  const css = `
  .play-screen .boardwrap.k-liarsdice-m{display:block}
  .ldm-wrap{width:100%;height:100%;box-sizing:border-box;padding:8px 6px}
  .ldm-table{position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:56px;
    background:radial-gradient(ellipse at 50% 36%,#35875c,#1e5c39 58%,#12402a);
    box-shadow:0 0 0 9px #7a4a28,0 0 0 12px #4e2e15,0 12px 20px rgba(0,0,0,.30),inset 0 0 60px rgba(0,0,0,.48)}
  .ldm-seats{position:absolute;top:26px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:flex-start}
  .ldm-seat{display:flex;flex-direction:column;align-items:center;gap:6px;width:96px}
  .ldm-cupbox{position:relative}
  .ldm-cup{width:70px;height:79px;position:relative;border-radius:11px 11px 16px 16px/8px 8px 20px 20px;
    background:linear-gradient(100deg,rgba(255,255,255,.22),rgba(255,255,255,0) 32%,rgba(0,0,0,.20) 80%),var(--cup);
    box-shadow:inset 0 -12px 15px rgba(0,0,0,.38),inset 0 7px 9px rgba(255,255,255,.13),0 9px 12px rgba(0,0,0,.38)}
  .ldm-cup::before{content:'';position:absolute;top:-5px;left:5px;right:5px;height:14px;border-radius:50%;
    background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(0,0,0,.12)),var(--cup)}
  .ldm-cup::after{content:'';position:absolute;bottom:-5px;left:-3px;right:-3px;height:13px;border-radius:50%;
    background:rgba(0,0,0,.30);z-index:-1}
  .ldm-cup .band{position:absolute;left:0;right:0;top:12px;height:2.5px;background:rgba(216,178,90,.55)}
  .ldm-cup.decl{box-shadow:inset 0 -12px 15px rgba(0,0,0,.38),inset 0 7px 9px rgba(255,255,255,.13),0 9px 12px rgba(0,0,0,.38),0 0 0 3px #e9bc45,0 0 16px rgba(233,188,69,.45)}
  .ldm-name{background:rgba(6,18,12,.74);color:#e9f4ea;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:.06em}
  .ldm-decltag{background:linear-gradient(180deg,#ffd968,#dfa92c);color:#3a2703;padding:2px 11px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.06em;box-shadow:0 2px 5px rgba(0,0,0,.35)}
  .ldm-chip{position:absolute;right:-14px;bottom:-5px;width:28px;height:28px;border-radius:50%;z-index:3;
    background:radial-gradient(circle,#fffef8 0 58%,#ddd6c4 59% 100%);border:3px dashed #39548f;
    color:#1d2733;font-size:13.5px;font-weight:800;display:grid;place-items:center;box-shadow:0 3px 5px rgba(0,0,0,.35);box-sizing:border-box}
  .ldm-die{position:relative;box-sizing:border-box;background:linear-gradient(145deg,#ffffff,#e7e2d6);border-radius:19%;
    box-shadow:inset 0 0 0 1px #c8c1ae,0 3px 5px rgba(0,0,0,.35);flex:none}
  .ldm-die .pips{position:absolute;inset:13.5%;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr)}
  .ldm-die i{border-radius:50%}
  .ldm-die i.on{background:radial-gradient(circle at 38% 35%,#4c4c4c,#101010)}
  .ldm-die i.one{background:radial-gradient(circle at 38% 35%,#ff8a7d,#c81e12)}
  .ldm-plate{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);z-index:2;
    display:flex;align-items:center;gap:11px;padding:10px 20px 11px;border-radius:13px;
    background:linear-gradient(180deg,#2c2c31,#16161a);border:2px solid #c9a227;
    box-shadow:0 8px 16px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.16);color:#f6efdb}
  .ldm-plate .qty{font-size:32px;font-weight:800;letter-spacing:.03em;line-height:1;white-space:nowrap}
  .ldm-plate .by{position:absolute;top:-11px;right:12px;background:linear-gradient(180deg,#ffd968,#dfa92c);color:#3a2703;
    font-size:11px;font-weight:800;letter-spacing:.05em;padding:2px 9px;border-radius:999px;box-shadow:0 2px 5px rgba(0,0,0,.4)}
  .ldm-total{position:absolute;left:50%;top:calc(45% + 50px);transform:translateX(-50%);z-index:2;
    background:rgba(6,18,12,.55);color:#dcefe0;font-size:12px;font-weight:700;letter-spacing:.05em;
    padding:3px 12px;border-radius:999px;white-space:nowrap}
  .ldm-total b{color:#ffd968;font-size:13px}
  .ldm-me{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:10px;z-index:2}
  .ldm-mycup{width:50px;height:60px;position:relative;border-radius:8px 8px 12px 12px/7px 7px 16px 16px;flex:none;
    background:linear-gradient(100deg,rgba(255,255,255,.18),rgba(255,255,255,0) 32%,rgba(0,0,0,.22) 80%),#274435;
    box-shadow:inset 0 9px 11px rgba(0,0,0,.30),0 7px 10px rgba(0,0,0,.35)}
  .ldm-mycup::before{content:'';position:absolute;top:-4px;left:4px;right:4px;height:12px;border-radius:50%;
    background:radial-gradient(ellipse at 50% 45%,#0a140e 0 52%,#3d5c49 78%,#22392c);box-shadow:inset 0 2px 5px rgba(0,0,0,.8)}
  .ldm-mycup .band{position:absolute;left:0;right:0;top:10px;height:2.5px;background:rgba(216,178,90,.5)}
  .ldm-traybox{position:relative}
  .ldm-tray{display:flex;align-items:center;gap:6px;padding:11px 12px;border-radius:13px;
    background:linear-gradient(180deg,#5d3d24,#46301c);box-shadow:inset 0 0 0 3px rgba(0,0,0,.25),inset 0 0 22px rgba(0,0,0,.35),0 8px 13px rgba(0,0,0,.35)}
  .ldm-acts{display:flex;align-items:stretch;justify-content:center;gap:8px;width:100%;box-sizing:border-box}
  .ldm-step{display:flex;align-items:center;gap:5px;background:#fffdf6;border:1.5px solid #d9d2bf;border-radius:12px;padding:4px 6px;box-shadow:0 2px 5px rgba(60,45,20,.12)}
  .ldm-sbtn{width:32px;height:32px;border-radius:9px;background:#efe8d8;border:1px solid #d5cdb6;font-size:17px;font-weight:800;color:#4c4230;line-height:1;flex:none}
  .ldm-step .face{display:flex;align-items:center;gap:5px;font-size:14.5px;font-weight:700;color:#33302a;white-space:nowrap}
  .ldm-step .face b{font-size:16.5px}
  .ldm-bidbtn{background:linear-gradient(180deg,#ffd968,#e3ac2d);border:1.5px solid #b9862a;color:#3a2703;
    font-size:15px;font-weight:800;letter-spacing:.04em;padding:0 16px;border-radius:12px;box-shadow:0 3px 7px rgba(60,45,20,.25)}
  .ldm-doubtbtn{background:linear-gradient(180deg,#e0503c,#bc2a1a);border:1.5px solid #8f1d10;color:#fff;
    font-size:16px;font-weight:800;letter-spacing:.08em;padding:0 18px;border-radius:12px;box-shadow:0 3px 8px rgba(120,30,15,.35)}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const DP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const die = (n, size, rot = 0) =>
    `<div class="ldm-die" style="width:${size}px;height:${size}px;transform:rotate(${rot}deg)"><span class="pips">${Array.from({ length: 9 }, (_, i) =>
      `<i class="${DP[n].includes(i) ? (n === 1 ? 'one' : 'on') : ''}"></i>`).join('')}</span></div>`;

  const cupSeat = ({ color, name, count, decl }) => `
    <div class="ldm-seat">
      <div class="ldm-cupbox">
        <div class="ldm-cup${decl ? ' decl' : ''}" style="--cup:${color}"><span class="band"></span></div>
        <div class="ldm-chip">${count}</div>
      </div>
      ${decl ? `<div class="ldm-decltag">宣言</div>` : `<div class="ldm-name">${name}</div>`}
    </div>`;

  const html = `<div class="ldm-wrap"><div class="ldm-table">
    <div class="ldm-seats">
      ${cupSeat({ color: '#2c3e70', name: 'CPU 1', count: 5, decl: false })}
      ${cupSeat({ color: '#7a4a28', name: 'CPU 2', count: 5, decl: true })}
      ${cupSeat({ color: '#7d2a3a', name: 'CPU 3', count: 4, decl: false })}
    </div>
    <div class="ldm-plate">
      <span class="by">CPU 2</span>
      ${die(4, 42)}
      <span class="qty">× 3 個</span>
    </div>
    <div class="ldm-total">場のダイス <b>19 個</b></div>
    <div class="ldm-me">
      <div class="ldm-mycup"><span class="band"></span></div>
      <div class="ldm-traybox">
        <div class="ldm-tray">
          ${die(4, 45, -4)}${die(4, 45, 3)}${die(2, 45, -2)}${die(1, 45, 2)}${die(6, 45, -3)}
        </div>
        <div class="ldm-chip" style="right:-10px;bottom:-6px">5</div>
      </div>
    </div>
  </div></div>`;

  const acts = `<div class="ldm-acts">
    <div class="ldm-step">
      <button class="ldm-sbtn" type="button">−</button>
      <span class="face">${die(4, 23)} が <b>4 個</b></span>
      <button class="ldm-sbtn" type="button">＋</button>
    </div>
    <button class="ldm-bidbtn" type="button">宣言する</button>
    <button class="ldm-doubtbtn" type="button">ダウト</button>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ほかのゲームと同じ欄だけを使う) ----
  document.querySelector('.stagehead h2').textContent = 'ライアーズダイス';
  document.querySelector('#hround').innerHTML = `<span class="hchip">ラウンド 5</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const rows = [
    { av: '<span class="avatar ">あ</span>', nm: 'あなた', nt: 'ダイス 5 個', turn: true },
    { av: '<span class="dot face" style="background:#2c3e70;color:#fff">C</span>', nm: 'CPU 1', nt: 'ダイス 5 個', turn: false },
    { av: '<span class="dot face" style="background:#7a4a28;color:#fff">C</span>', nm: 'CPU 2', nt: 'ダイス 5 個', turn: false },
    { av: '<span class="dot face" style="background:#7d2a3a;color:#fff">C</span>', nm: 'CPU 3', nt: 'ダイス 4 個', turn: false },
  ];
  document.querySelector('#strip').innerHTML = rows.map(r =>
    `<div class="pl ${r.turn ? 'turn' : ''}">${r.av}<span class="who"><span class="nm">${r.nm}</span><span class="nt">${r.nt}</span></span></div>`).join('');
  document.querySelector('#status').textContent = '宣言を上げるか「ダウト」か選んでください';
  // 場のダイス総数は卓の上に置いたので、#sidenote は空にする(重複させない)
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-liarsdice-m'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = acts;
})();
