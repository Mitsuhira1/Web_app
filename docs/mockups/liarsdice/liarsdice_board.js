// ライアーズダイス — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: 4 人対戦・ラウンド 5。CPU 2 の宣言が「4 が 3 個」で、今があなたの番(宣言を上げるか「ダウト」か)。
// コア(core/games/liarsdice.mjs)の view が返す情報だけを描く前提: 自分のダイス [4,4,2,1,6] だけが見え、相手のダイスはカップの中。
(() => {
  const css = `
  .play-screen .boardwrap.k-liarsdice{display:block}
  .ld-wrap{width:100%;height:100%;box-sizing:border-box;padding:12px 14px}
  .ld-table{position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:50%;
    background:radial-gradient(ellipse at 50% 38%,#35875c,#1e5c39 58%,#12402a);
    box-shadow:0 0 0 12px #7a4a28,0 0 0 16px #4e2e15,0 14px 24px rgba(0,0,0,.30),inset 0 0 70px rgba(0,0,0,.48)}
  .ld-seat{position:absolute;display:flex;flex-direction:column;align-items:center;gap:7px;z-index:2}
  .ld-cupbox{position:relative}
  .ld-cup{width:94px;height:106px;position:relative;border-radius:15px 15px 22px 22px/11px 11px 28px 28px;
    background:linear-gradient(100deg,rgba(255,255,255,.22),rgba(255,255,255,0) 32%,rgba(0,0,0,.20) 80%),var(--cup);
    box-shadow:inset 0 -16px 20px rgba(0,0,0,.38),inset 0 9px 11px rgba(255,255,255,.13),0 12px 15px rgba(0,0,0,.38)}
  .ld-cup::before{content:'';position:absolute;top:-7px;left:7px;right:7px;height:19px;border-radius:50%;
    background:linear-gradient(180deg,rgba(255,255,255,.20),rgba(0,0,0,.12)),var(--cup)}
  .ld-cup::after{content:'';position:absolute;bottom:-6px;left:-4px;right:-4px;height:17px;border-radius:50%;
    background:rgba(0,0,0,.30);z-index:-1}
  .ld-cup .band{position:absolute;left:0;right:0;top:17px;height:3px;background:rgba(216,178,90,.55)}
  .ld-cup.decl{box-shadow:inset 0 -16px 20px rgba(0,0,0,.38),inset 0 9px 11px rgba(255,255,255,.13),0 12px 15px rgba(0,0,0,.38),0 0 0 3px #e9bc45,0 0 18px rgba(233,188,69,.45)}
  .ld-name{background:rgba(6,18,12,.74);color:#e9f4ea;padding:2.5px 11px;border-radius:999px;font-size:12.5px;font-weight:700;letter-spacing:.07em}
  .ld-decltag{background:linear-gradient(180deg,#ffd968,#dfa92c);color:#3a2703;padding:2.5px 11px;border-radius:999px;font-size:12.5px;font-weight:800;letter-spacing:.07em;box-shadow:0 2px 5px rgba(0,0,0,.35)}
  .ld-chip{position:absolute;right:-19px;bottom:-7px;width:35px;height:35px;border-radius:50%;z-index:3;
    background:radial-gradient(circle,#fffef8 0 58%,#ddd6c4 59% 100%);border:4px dashed #39548f;
    color:#1d2733;font-size:16px;font-weight:800;display:grid;place-items:center;box-shadow:0 3px 6px rgba(0,0,0,.35);box-sizing:border-box}
  .ld-die{position:relative;box-sizing:border-box;background:linear-gradient(145deg,#ffffff,#e7e2d6);border-radius:19%;
    box-shadow:inset 0 0 0 1px #c8c1ae,0 3px 5px rgba(0,0,0,.35)}
  .ld-die .pips{position:absolute;inset:13.5%;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr)}
  .ld-die i{border-radius:50%}
  .ld-die i.on{background:radial-gradient(circle at 38% 35%,#4c4c4c,#101010)}
  .ld-die i.one{background:radial-gradient(circle at 38% 35%,#ff8a7d,#c81e12)}
  .ld-tray{display:flex;align-items:center;gap:11px;padding:13px 16px;border-radius:16px;
    background:linear-gradient(180deg,#5d3d24,#46301c);box-shadow:inset 0 0 0 3px rgba(0,0,0,.25),inset 0 0 26px rgba(0,0,0,.35),0 10px 16px rgba(0,0,0,.35)}
  .ld-mycup{width:74px;height:84px;position:relative;border-radius:11px 11px 17px 17px/9px 9px 22px 22px;flex:none;
    background:linear-gradient(100deg,rgba(255,255,255,.18),rgba(255,255,255,0) 32%,rgba(0,0,0,.22) 80%),#274435;
    box-shadow:inset 0 12px 14px rgba(0,0,0,.30),0 9px 12px rgba(0,0,0,.35)}
  .ld-mycup::before{content:'';position:absolute;top:-6px;left:6px;right:6px;height:17px;border-radius:50%;
    background:radial-gradient(ellipse at 50% 45%,#0a140e 0 52%,#3d5c49 78%,#22392c);box-shadow:inset 0 3px 6px rgba(0,0,0,.8)}
  .ld-mycup .band{position:absolute;left:0;right:0;top:14px;height:3px;background:rgba(216,178,90,.5)}
  .ld-plate{position:absolute;left:50%;top:44.5%;transform:translate(-50%,-50%);z-index:2;
    display:flex;align-items:center;gap:13px;padding:11px 22px 12px;border-radius:15px;
    background:linear-gradient(180deg,#2c2c31,#16161a);border:2px solid #c9a227;
    box-shadow:0 9px 19px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.16);color:#f6efdb}
  .ld-plate .qty{font-size:35px;font-weight:800;letter-spacing:.03em;line-height:1}
  .ld-plate .by{position:absolute;top:-13px;right:14px;background:linear-gradient(180deg,#ffd968,#dfa92c);color:#3a2703;
    font-size:12px;font-weight:800;letter-spacing:.05em;padding:2.5px 10px;border-radius:999px;box-shadow:0 2px 5px rgba(0,0,0,.4)}
  .ld-acts{display:flex;align-items:center;justify-content:center;gap:14px}
  .ld-step{display:flex;align-items:center;gap:9px;background:#fffdf6;border:1.5px solid #d9d2bf;border-radius:13px;padding:5px 9px;box-shadow:0 2px 5px rgba(60,45,20,.12)}
  .ld-sbtn{width:31px;height:31px;border-radius:9px;background:#efe8d8;border:1px solid #d5cdb6;font-size:18px;font-weight:800;color:#4c4230;line-height:1}
  .ld-step .face{display:flex;align-items:center;gap:7px;font-size:16.5px;font-weight:700;color:#33302a}
  .ld-step .face b{font-size:19px}
  .ld-bidbtn{background:linear-gradient(180deg,#ffd968,#e3ac2d);border:1.5px solid #b9862a;color:#3a2703;
    font-size:16.5px;font-weight:800;letter-spacing:.05em;padding:9px 24px;border-radius:13px;box-shadow:0 3px 7px rgba(60,45,20,.25)}
  .ld-doubtbtn{background:linear-gradient(180deg,#e0503c,#bc2a1a);border:1.5px solid #8f1d10;color:#fff;
    font-size:17.5px;font-weight:800;letter-spacing:.09em;padding:9px 28px;border-radius:13px;box-shadow:0 3px 8px rgba(120,30,15,.35)}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const DP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const die = (n, size, rot = 0) =>
    `<div class="ld-die" style="width:${size}px;height:${size}px;transform:rotate(${rot}deg)"><span class="pips">${Array.from({ length: 9 }, (_, i) =>
      `<i class="${DP[n].includes(i) ? (n === 1 ? 'one' : 'on') : ''}"></i>`).join('')}</span></div>`;

  const cupSeat = ({ color, name, count, decl }) => `
    <div class="ld-cupbox">
      <div class="ld-cup${decl ? ' decl' : ''}" style="--cup:${color}"><span class="band"></span></div>
      <div class="ld-chip">${count}</div>
    </div>
    ${decl ? `<div class="ld-decltag">宣言</div>` : `<div class="ld-name">${name}</div>`}`;

  const html = `<div class="ld-wrap"><div class="ld-table">
    <div class="ld-seat" style="left:50%;top:3.2%;transform:translateX(-50%)">
      ${cupSeat({ color: '#7a4a28', name: 'CPU 2', count: 5, decl: true })}
    </div>
    <div class="ld-seat" style="left:5.2%;top:31%">
      ${cupSeat({ color: '#2c3e70', name: 'CPU 1', count: 5, decl: false })}
    </div>
    <div class="ld-seat" style="right:5.2%;top:31%">
      ${cupSeat({ color: '#7d2a3a', name: 'CPU 3', count: 4, decl: false })}
    </div>
    <div class="ld-plate">
      <span class="by">CPU 2</span>
      ${die(4, 46)}
      <span class="qty">× 3 個</span>
    </div>
    <div class="ld-seat" style="left:50%;bottom:3%;transform:translateX(-50%);flex-direction:row;align-items:flex-end;gap:16px">
      <div class="ld-mycup"><span class="band"></span></div>
      <div class="ld-tray">
        ${die(4, 56, -4)}${die(4, 56, 3)}${die(2, 56, -2)}${die(1, 56, 2)}${die(6, 56, -3)}
      </div>
      <div class="ld-chip" style="right:-13px;bottom:-3px">5</div>
    </div>
  </div></div>`;

  const acts = `<div class="ld-acts">
    <div class="ld-step">
      <button class="ld-sbtn" type="button">−</button>
      <span class="face">${die(4, 30)} が <b>4 個</b></span>
      <button class="ld-sbtn" type="button">＋</button>
    </div>
    <button class="ld-bidbtn" type="button">宣言する</button>
    <button class="ld-doubtbtn" type="button">ダウト</button>
  </div>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
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
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>場のダイス</span><b class="num">19 個</b></div>` +
    `<div class="kv"><span>ラウンド</span><b class="num">5</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-liarsdice'; wrap.innerHTML = html;
  document.querySelector('#acts').innerHTML = acts;
})();
