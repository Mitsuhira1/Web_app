// ライアーズダイス 盤面の見本(第 2 版・PC 版)。実際の対局画面の #boardwrap と側板に差し込む。
// window.__LD2 = { mode: 'bid' | 'reveal', fonts: { 'Family|weight': dataURL } } を先に入れておく。
// 場面: 4 人・ラウンド 3・1 はワイルド。CPU 2「3 が 3 個」→ CPU 3「4 が 4 個」の後、あなたの番。
(() => {
const MODE = (window.__LD2 && window.__LD2.mode) || 'bid';
const FONTS = (window.__LD2 && window.__LD2.fonts) || {};
const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };

const css = `
${Object.entries(FONTS).map(([n, u]) => `@font-face{font-family:"${n.split('|')[0]}";font-weight:${n.split('|')[1] || 400};src:url(${u}) format("woff2")}`).join('\n')}
.ld2v{position:absolute;inset:0;border-radius:18px;overflow:hidden;font-family:"Zen Kaku Gothic New","Noto Sans CJK JP",sans-serif;color:#f3e6cf;
  background:
    radial-gradient(70% 60% at 50% 45%, #0000 0%, #0000 55%, #0000004d 100%),
    repeating-linear-gradient(90deg, #0000 0 148px, #00000038 148px 150px),
    repeating-linear-gradient(90deg, #ffffff06 0 3px, #0000 3px 11px, #00000010 11px 13px, #0000 13px 23px),
    linear-gradient(180deg, #6b4126 0%, #5a3520 50%, #4a2b19 100%);
  box-shadow:inset 0 0 0 2px #2a170c, inset 0 0 60px #0000008a, 0 10px 30px #0006}

.ld2v .ld2-tray{position:absolute;left:450px;top:322px;transform:translate(-50%,-50%);width:440px;height:112px;border-radius:20px;
  background:radial-gradient(80% 90% at 50% 30%, #6a4630 0%, #533421 70%, #452a1a 100%);
  box-shadow:inset 0 0 0 2px #2a170c, inset 0 5px 14px #0008, 0 2px 0 #ffffff12}
.ld2v .ld2-tray::after{content:"";position:absolute;inset:7px;border-radius:15px;border:1.5px dashed #e7c98d55}
.ld2v .ld2-seat{position:absolute;transform:translate(-50%,0);display:flex;flex-direction:column;align-items:center;gap:6px}
.ld2v .ld2-seat .ld2-nm{font-size:15px;font-weight:700;color:#f1e3c6;text-shadow:0 1px 2px #0008}
.ld2v .ld2-seat.out .ld2-nm{color:#a08c72}
.ld2v .ld2-slots{display:flex;gap:4px}
.ld2v .ld2-slots i{display:block;width:13px;height:13px;border-radius:3px;background:linear-gradient(#f6eedd,#d9ccb2);box-shadow:0 1px 1px #0007}
.ld2v .ld2-slots i.lost{background:none;box-shadow:inset 0 0 0 1.5px #f3e6cf40}
.ld2v .ld2-bubble{position:absolute;display:flex;align-items:center;gap:8px;padding:8px 14px 8px 10px;border-radius:12px;background:#fbf5e8;color:#2b1d12;box-shadow:0 4px 12px #0007;font-weight:700;white-space:nowrap}
.ld2v .ld2-bubble .q{font-size:30px;line-height:1;font-weight:700;letter-spacing:0}
.ld2v .ld2-bubble .x{font-size:20px;color:#7a6650;margin:0 -2px}
.ld2v .ld2-bubble .ld2-u{font-size:16px;color:#5a4634}
.ld2v .ld2-bubble.old{background:#e9e0cd;opacity:.75;transform-origin:left center;transform:scale(.72)}
.ld2v .ld2-bubble::before{content:"";position:absolute;width:14px;height:14px;background:inherit;transform:rotate(45deg)}
.ld2v .ld2-bubble.l::before{left:-6px;top:calc(50% - 7px)}
.ld2v .ld2-bubble.b::before{left:calc(50% - 7px);bottom:-6px}
.ld2v .ld2-mine{position:absolute;left:450px;top:322px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:14px}
.ld2v .ld2-pick{position:absolute;left:450px;top:470px;transform:translate(-50%,-50%);padding:12px 18px;border-radius:14px;background:#24160cd9;box-shadow:inset 0 0 0 1px #f3e6cf24;display:flex;align-items:center;gap:20px}
.ld2v .ld2-pick .lb{font-size:14px;color:#cdb991;font-weight:700;white-space:nowrap}.ld2v .ld2-pick .sep{width:1px;align-self:stretch;background:#f3e6cf26}
.ld2v .ld2-pick .faces{display:flex;gap:6px}
.ld2v .ld2-pick .faces span{display:grid;place-items:center;width:46px;height:46px;border-radius:10px}
.ld2v .ld2-pick .faces span.sel{background:#f3c95a33;box-shadow:inset 0 0 0 2px #f3c95a}
.ld2v .ld2-pick .faces span.no{opacity:.35}
.ld2v .ld2-pick .qty{display:flex;align-items:center;justify-content:space-between}
.ld2v .ld2-pick .qty{gap:10px}.ld2v .ld2-pick .qty b{font-size:34px;font-weight:700;min-width:2ch;text-align:center;font-variant-numeric:tabular-nums}
.ld2v .ld2-pick .qty button{all:unset;width:44px;height:34px;border-radius:8px;display:grid;place-items:center;background:#f3e6cf1f;color:#f3e6cf;font-size:22px;font-weight:700}
.ld2v .ld2-pick .qty button.off{opacity:.3}
.ld2v .ld2-pick .qty .ld2-u{font-size:14px;color:#cdb991;margin-left:-6px}
.ld2v .ld2-tag{position:absolute;font-size:13px;font-weight:700;color:#cdb991}
.ld2v .ld2-count{position:absolute;left:450px;top:212px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:16px}
.ld2v .ld2-count .ld2-big{display:flex;align-items:center;gap:10px;font-size:44px;font-weight:700;line-height:1;color:#fff6e0;text-shadow:0 2px 6px #0009}
.ld2v .ld2-count .small{font-size:16px;color:#e8d7b6;font-weight:700}
.ld2v .ld2-verdict{font-size:15px;font-weight:700;color:#2b1d12;background:#f3c95a;padding:4px 12px;border-radius:6px}
.ld2-side{display:flex;flex-direction:column;gap:10px;font-size:14px}
.ld2-side .kv2{display:flex;justify-content:space-between;align-items:baseline}
.ld2-side .kv2 b{font-size:18px;font-variant-numeric:tabular-nums}
.ld2-side h4{margin:4px 0 0;font-size:12px;color:var(--sub);font-weight:700}
.ld2-side .hist{display:flex;flex-direction:column;gap:6px}
.ld2-side .hist div{display:grid;grid-template-columns:64px auto 1fr;align-items:center;gap:8px}
.ld2-side .hist span{color:var(--sub);font-size:13px}
.ld2-side .hist b{font-variant-numeric:tabular-nums}
.ld2-side .hist div.now b{color:var(--ink)}
.ld2-slots{display:inline-flex;gap:3px;vertical-align:-1px;margin-left:6px}
.ld2-slots i{display:block;width:9px;height:9px;border-radius:2px;background:#9b8a74}
.ld2-slots i.lost{background:none;box-shadow:inset 0 0 0 1.4px #cbbca6}
`;

// サイコロ(真上から。象牙色・1 の目は赤)
const die = (v, s, o = {}) => {
  const r = s * 0.1, rot = o.rot || 0;
  let pips = PIPS[v].map(([x, y]) => `<circle cx="${x * s}" cy="${y * s}" r="${v === 1 ? s * .12 : s * .085}" fill="${v === 1 ? '#c22a22' : '#2b2119'}"/>`).join('');
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="overflow:visible;transform:rotate(${rot}deg);${o.dim ? 'opacity:.42;' : ''}">
    ${o.shadow === false ? '' : `<rect x="${s * .06}" y="${s * .1}" width="${s}" height="${s}" rx="${r * 1.6}" fill="#000" opacity=".35"/>`}
    <rect x="0" y="0" width="${s}" height="${s}" rx="${r * 1.6}" fill="#fbf5e6"/>
    <rect x="0" y="0" width="${s}" height="${s}" rx="${r * 1.6}" fill="none" stroke="#c9b893" stroke-width="${Math.max(1, s * .035)}"/>
    <rect x="${s * .08}" y="${s * .06}" width="${s * .84}" height="${s * .4}" rx="${r}" fill="#fff" opacity=".45"/>
    ${pips}${o.ring ? `<rect x="${-s * .1}" y="${-s * .1}" width="${s * 1.2}" height="${s * 1.2}" rx="${r * 2.2}" fill="none" stroke="#f3c95a" stroke-width="${s * .07}"/>` : ''}</svg>`;
};
// 伏せたカップ(革。少し斜め上から)
const cup = (w, tone = '#5b3a22', lifted = false) => {
  const h = w * 1.05;
  return `<svg width="${w}" height="${h}" viewBox="0 0 100 105" style="overflow:visible${lifted ? ';transform:translateY(-10px) rotate(-8deg)' : ''}">
    <ellipse cx="50" cy="${lifted ? 104 : 98}" rx="${lifted ? 30 : 42}" ry="${lifted ? 4 : 7}" fill="#000" opacity="${lifted ? .25 : .45}"/>
    <path d="M14 92 L22 18 Q24 8 36 7 L64 7 Q76 8 78 18 L86 92 Q86 99 76 99 L24 99 Q14 99 14 92Z" fill="${tone}"/>
    <path d="M14 92 L22 18 Q24 8 36 7 L48 7 L44 99 L24 99 Q14 99 14 92Z" fill="#fff" opacity=".07"/>
    <path d="M66 7 Q76 8 78 18 L86 92 Q86 99 76 99 L64 99Z" fill="#000" opacity=".22"/>
    <path d="M15.5 80 L84.5 80" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
    <path d="M17 84 L83 84" stroke="#e7c98d" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 3"/>
    <path d="M22.5 22 L77.5 22" stroke="#e7c98d" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 3"/>
    <ellipse cx="50" cy="9" rx="20" ry="3" fill="#fff" opacity=".12"/></svg>`;
};
const CUPS = ['#6b4123', '#3f4d5e', '#6a2d2a', '#4d5a33'];

// ---------------------------------------------------------------- 場面
const players = [
  { name: 'あなた', dice: 5, mine: [4, 1, 6, 4, 2] },
  { name: 'CPU 2', dice: 4, show: [3, 3, 5, 6] },
  { name: 'CPU 3', dice: 5, show: [4, 6, 2, 2, 5] },
  { name: 'CPU 4', dice: 3, show: [6, 2, 3] },
];
const SEATS = [null, { x: 170, y: 26 }, { x: 450, y: 26 }, { x: 730, y: 26 }];
function seatHtml(i) {
  const p = players[i], s = SEATS[i];
  const slots = Array.from({ length: 5 }, (_, k) => `<i class="${k < p.dice ? '' : 'lost'}"></i>`).join('');
  let body;
  if (MODE === 'reveal') {
    body = `<div style="height:92px;display:flex;align-items:flex-end;gap:6px">${p.show.map((v, k) => die(v, 34, { rot: [-6, 4, -3, 7, -2][k], ring: v === 4 || v === 1, dim: !(v === 4 || v === 1) })).join('')}</div>`;
  } else body = cup(92, CUPS[i]);
  return `<div class="ld2-seat" style="left:${s.x}px;top:${s.y}px">${body}<div class="ld2-slots">${slots}</div><div class="ld2-nm">${p.name}</div></div>`;
}
function scene() {
  let h = `<div class="ld2v">`;
  for (let i = 1; i < 4; i++) h += seatHtml(i);
  if (MODE === 'bid') {
    // 今の宣言は、言った人のそばに吹き出しで出す(これまでの宣言は側板に並べる)
    h += `<div class="ld2-bubble l" style="left:518px;top:46px">${die(4, 34, { shadow: false })}<span class="x">×</span><span class="q">4</span><span class="ld2-u">個</span></div>`;
  } else {
    h += `<div class="ld2-count"><span class="ld2-verdict">CPU 4 のダウト</span><div class="ld2-big">${die(4, 40, { shadow: false })}<span style="font-size:30px;color:#e8d7b6">×</span>4</div><span class="small">宣言は 5 個</span></div>`;
  }
  // 自分: 革の受け皿に 5 個。開けたカップは左に倒しておく
  const my = players[0].mine;
  const match = (v) => v === 4 || v === 1;
  h += `<div class="ld2-tray"></div><div style="position:absolute;left:150px;top:286px;transform:rotate(-80deg)">${cup(66, CUPS[0])}</div>`;
  h += `<div class="ld2-mine">${my.map((v, k) => die(v, 62, { rot: [-5, 3, -2, 4, -3][k], ring: MODE === 'bid' && match(v), dim: MODE === 'reveal' && !match(v) })).join('')}</div>`;
  {
    h += `<div class="ld2-pick"${MODE === 'reveal' ? ' style="opacity:.4"' : ''}><span class="lb">次の宣言</span><div class="faces">${[1, 2, 3, 4, 5, 6].map((f) => `<span class="${f === 4 ? 'sel' : ''}">${die(f, 32, { shadow: false })}</span>`).join('')}</div><span class="sep"></span>
      <div class="qty"><button class="off">−</button><b>5</b><span class="ld2-u">個</span><button>＋</button></div></div>`;
  }
  return h + `</div>`;
}

// ---------------------------------------------------------------- 側板(共通部品の中身)
function sidePanel() {
  const $ = (s) => document.querySelector(s);
  const slots = (n) => `<span class="ld2-slots">${Array.from({ length: 5 }, (_, k) => `<i class="${k < n ? '' : 'lost'}"></i>`).join('')}</span>`;
  const meEl = document.querySelector('#strip .pl .dot, #strip .pl .avatar');
  const avs = [meEl ? meEl.outerHTML : '<span class="dot face">あ</span>',
    '<span class="dot face" style="background:#3a6bc5;color:#fff">C</span>', '<span class="dot face" style="background:#7a4cc2;color:#fff">C</span>', '<span class="dot face" style="background:#b03a5b;color:#fff">C</span>'];
  $('#strip').innerHTML = players.map((p, i) => `<div class="pl${i === 0 ? ' turn' : ''}">${avs[i]}<span class="who"><span class="nm">${p.name}</span><span class="nt">ダイス${slots(p.dice)}</span></span></div>`).join('');
  $('#status').textContent = MODE === 'bid' ? '宣言を上げるか、ダウトしてください' : 'あなたのダイスが 1 個減ります';
  const sn = $('#sidenote'); sn.classList.add('custom');
  const sd = (v) => `<span style="display:inline-block;vertical-align:-4px">${die(v, 18, { shadow: false })}</span>`;
  sn.innerHTML = `<div class="ld2-side"><div class="kv2"><span>場のダイス</span><b>17 個</b></div><div class="kv2"><span>1 の目</span><b>ワイルド</b></div>
    <h4>このラウンドの宣言</h4><div class="hist"><div><span>CPU 4</span>${sd(2)}<b>× 2</b></div><div><span>CPU 2</span>${sd(3)}<b>× 3</b></div><div class="${MODE === 'bid' ? 'now' : ''}"><span>CPU 3</span>${sd(4)}<b>× 4</b></div>${MODE === 'reveal' ? `<div class="now"><span>あなた</span>${sd(4)}<b>× 5</b></div>` : ''}</div></div>`;
  $('#acts').innerHTML = MODE === 'bid'
    ? `<button class="btn danger">ダウト!</button><button class="btn">ジャスト!</button><button class="btn gold">4 が 5 個と宣言</button>`
    : `<button class="btn danger" disabled>ダウト!</button><button class="btn" disabled>ジャスト!</button><button class="btn gold" disabled>4 が 5 個と宣言</button>`;
  $('#hround').innerHTML = `<span class="hchip">ラウンド 3</span>`;
}

const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const wrap = document.getElementById('boardwrap');
const W = 900, H = 560;
const ns = Math.min((wrap.clientWidth - 10) / W, (wrap.clientHeight - 10) / H);
wrap.innerHTML = `<div class="nine-scene" style="width:${W}px;height:${H}px;--ns:${ns}">${scene()}</div>`;
sidePanel();
})();
