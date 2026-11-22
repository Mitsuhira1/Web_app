'use strict';
// 胸毛絶体絶命(黒ひげ危機一髪がモチーフ)。サーカスの舞台の大砲に胸毛のおっさん。順にボタンを押し、点火スイッチを押した人がおっさんを飛ばす。
// 坊主めくりと同じく boardMatch の上で動く(ひとりで遊ぶ・みんなで遊ぶ)。点火スイッチの場所はホストの手元だけに置く。
// 盤の絵・アニメの絵は docs/mockups/munage/ の見本(ユーザーが了承した物)と同じ。
const munageGame = (() => {
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const SKIN = 'url(#mnSkin)', LINE = '#6a3c22';

  // ---- 胸毛: 短い毛の線を 2〜4 本ずつ束にして、胸全体に体の丸みに沿って散らす(アニメの描き方) ----
  // 1 本ずつ、両端が細く真ん中が太い形(塗り)で描く。
  function hairStroke(x, y, an, L, w, bend) {
    const ux = Math.cos(an), uy = Math.sin(an), nx = -uy, ny = ux;
    const P = (t, o) => `${(x + ux * L * t + nx * o).toFixed(2)} ${(y + uy * L * t + ny * o).toFixed(2)}`;
    return `M${P(0, 0)}Q${P(.5, bend + w)} ${P(1, 0)}Q${P(.5, bend - w)} ${P(0, 0)}Z`;
  }
  function chestHair() {
    const r = rng(23);
    // 束の場所と向き(右半分。左は左右反転)。an は線の向き(0 = 右、正 = 下へ)
    const tufts = [
      // 胸の上(鎖骨の下)
      [8, -72, .35], [20, -70, .5], [32, -66, .7], [44, -62, .9],
      // 胸板の中ほど
      [6, -60, .9], [17, -58, .45], [29, -55, .55], [41, -51, .75], [52, -46, 1],
      // 胸板の下の縁(丸みに沿う)
      [12, -46, .25], [25, -42, .2], [38, -40, .35], [50, -36, .6],
      // 真ん中〜おなか
      [4, -34, 1.2], [3, -22, 1.35], [8, -12, 1.2], [3, -2, 1.4], [9, 8, 1.25],
      // 肩
      [58, -70, 1.1], [64, -58, 1.3],
    ];
    let d = '';
    for (const [x0, y0, an0] of tufts) {
      for (const side of [1, -1]) {
        const n = 2 + Math.floor(r() * 3), L = 8 + r() * 4.5, an = side > 0 ? an0 : Math.PI - an0;
        for (let k = 0; k < n; k++) {
          // 束の線は少しずつずらして並べる
          const off = (k - (n - 1) / 2) * 3.1, ax = -Math.sin(an) * off, ay = Math.cos(an) * off;
          const x = side * x0 + ax + (r() - .5) * 1.5, y = y0 + ay + (r() - .5) * 1.5 + (r() - .5) * 2;
          d += hairStroke(x - Math.cos(an) * L / 2, y - Math.sin(an) * L / 2, an + (r() - .5) * .18, L * (.8 + r() * .4), 1.05, (r() - .5) * 2.4 * side);
        }
      }
    }
    return `<path d="${d}" fill="#4a2c18" opacity=".9"/>`;
  }

  // ---- 顔: worry(盤)・shock(驚く)・scream(飛ぶ) ----
  function head(mode) {
    const eyes = mode === 'scream'
      ? `<path d="M-28 -130 L-14 -124 L-28 -118 M28 -130 L14 -124 L28 -118" fill="none" stroke="#2b1c14" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
      : mode === 'shock'
        ? `<ellipse cx="-17" cy="-126" rx="12" ry="14" fill="#fff" stroke="#2b1c14" stroke-width="2.2"/><ellipse cx="17" cy="-126" rx="12" ry="14" fill="#fff" stroke="#2b1c14" stroke-width="2.2"/>
           <circle cx="-17" cy="-125" r="2.2" fill="#2b1c14"/><circle cx="17" cy="-125" r="2.2" fill="#2b1c14"/>`
        : `<ellipse cx="-17" cy="-125" rx="10" ry="11.5" fill="#fff" stroke="#2b1c14" stroke-width="2"/><ellipse cx="17" cy="-125" rx="10" ry="11.5" fill="#fff" stroke="#2b1c14" stroke-width="2"/>
           <circle cx="-12" cy="-123" r="3.6" fill="#2b1c14"/><circle cx="22" cy="-123" r="3.6" fill="#2b1c14"/>`;
    const mouth = mode === 'worry'
      ? `<path d="M-10 -88 Q-5 -92 0 -88 T10 -88" fill="none" stroke="#2b1c14" stroke-width="2.6" stroke-linecap="round"/>`
      : `<ellipse cx="0" cy="-83" rx="${mode === 'shock' ? 8 : 13}" ry="${mode === 'shock' ? 9 : 12}" fill="#6d1c17" stroke="#2b1c14" stroke-width="2.2"/>`;
    const brow = mode === 'worry' ? 12 : 20;
    return `<g>
      <ellipse cx="-45" cy="-126" rx="9" ry="12" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
      <ellipse cx="45" cy="-126" rx="9" ry="12" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
      <ellipse cx="0" cy="-128" rx="44" ry="47" fill="${SKIN}" stroke="${LINE}" stroke-width="2.8"/>
      <path d="M-44 -120 C-50 -140 -44 -156 -36 -162 C-38 -146 -36 -134 -32 -124 Z M44 -120 C50 -140 44 -156 36 -162 C38 -146 36 -134 32 -124 Z" fill="#3a2a22"/>
      <ellipse cx="-16" cy="-160" rx="15" ry="7" fill="#fff" opacity=".5" transform="rotate(-18 -16 -160)"/>
      <path d="M-30 -158 C-12 -172 14 -172 32 -156 M-32 -150 C-10 -166 16 -166 34 -148 M-28 -165 C-8 -177 12 -176 26 -164" fill="none" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/>
      <path d="M-30 -100 C-22 -84 22 -84 30 -100 C20 -90 -20 -90 -30 -100 Z" fill="#8ea0b2" opacity=".35"/>
      <path d="M-34 -140 C-26 -150 -14 -150 -6 -145" fill="none" stroke="#2b1c14" stroke-width="7" stroke-linecap="round" transform="rotate(${brow} -20 -146)"/>
      <path d="M34 -140 C26 -150 14 -150 6 -145" fill="none" stroke="#2b1c14" stroke-width="7" stroke-linecap="round" transform="rotate(${-brow} 20 -146)"/>
      ${eyes}
      <ellipse cx="0" cy="-109" rx="10" ry="8.5" fill="#e79d77" stroke="${LINE}" stroke-width="2"/>
      <ellipse cx="-3" cy="-112" rx="3" ry="2" fill="#fff" opacity=".6"/>
      <ellipse cx="-30" cy="-106" rx="8" ry="5" fill="#f2806f" opacity=".45"/><ellipse cx="30" cy="-106" rx="8" ry="5" fill="#f2806f" opacity=".45"/>
      ${mouth}
      <path d="M0 -101 C-10 -106 -24 -104 -34 -96 C-42 -90 -50 -92 -52 -100 C-54 -86 -40 -82 -28 -88 C-18 -93 -8 -94 0 -92 C8 -94 18 -93 28 -88 C40 -82 54 -86 52 -100 C50 -92 42 -90 34 -96 C24 -104 10 -106 0 -101 Z" fill="#2b1c14"/>
      <g class="mn-sweat" fill="#9fdcff" stroke="#3d8ec5" stroke-width="1.4">
        <path d="M50 -150 q7 11 0 15 q-7 -4 0 -15z"/><path d="M-54 -142 q5 8 0 11 q-5 -3 0 -11z"/>
      </g>
    </g>`;
  }
  const torso = () => `<path d="M-72 30 C-80 -20 -78 -62 -58 -78 C-40 -90 40 -90 58 -78 C78 -62 80 -20 72 30 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2.8"/>
      <path d="M-16 -86 h32 v-10 h-32 z" fill="${SKIN}"/>
      <path d="M-44 -46 C-30 -36 -12 -38 -4 -46 M44 -46 C30 -36 12 -38 4 -46" fill="none" stroke="#cf8e66" stroke-width="2" opacity=".75"/>
      <circle cx="-26" cy="-50" r="2.6" fill="#c97a5e"/><circle cx="26" cy="-50" r="2.6" fill="#c97a5e"/>
      ${chestHair()}`;
  const arm = d => `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="27" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${SKIN}" stroke-width="22" stroke-linecap="round"/>`;

  const manInCannon = `${arm('M-62 -66 C-96 -54 -112 -22 -104 6')}${arm('M62 -66 C96 -54 112 -22 104 6')}${torso()}${head('worry')}`;
  const hands = [-1, 1].map(s => `<g transform="translate(${s * 104} 8) scale(${s} 1)">
      <path d="M-14 -6 C-16 6 -10 16 0 16 C10 16 16 8 14 -6 C8 -12 -8 -12 -14 -6 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
      <path d="M-8 4 v8 M-2 5 v9 M4 4 v8" stroke="#b9754f" stroke-width="1.8" stroke-linecap="round"/></g>`).join('');
  const flyerBody = `${arm('M-28 70 C-48 100 -78 112 -96 136')}${arm('M28 70 C44 108 46 132 70 154')}
    ${arm('M-62 -66 C-96 -96 -100 -130 -92 -164')}${arm('M62 -66 C100 -80 116 -110 120 -144')}
    <ellipse cx="-102" cy="142" rx="16" ry="9" transform="rotate(-40 -102 142)" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
    <ellipse cx="78" cy="160" rx="16" ry="9" transform="rotate(30 78 160)" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
    <circle cx="-92" cy="-170" r="13" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/><circle cx="121" cy="-150" r="13" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/>
    ${torso()}
    <path d="M-72 22 C-74 50 -66 76 -54 88 L-6 84 L0 70 L6 84 L54 88 C66 76 74 50 72 22 C40 30 -40 30 -72 22 Z" fill="#f6efe2" stroke="${LINE}" stroke-width="2.6"/>
    <path d="M-60 28 L-56 86 M-36 32 L-34 86 M-12 33 L-8 76 M12 33 L8 76 M36 32 L34 86 M60 28 L56 86" stroke="#c8362e" stroke-width="7"/>
    <path d="M-72 22 C-40 30 40 30 72 22 L72 30 C40 38 -40 38 -72 30 Z" fill="#2f5fd0"/>
    ${head('scream')}`;

  const DEFS = `<defs>
    <linearGradient id="mnSkin" x1="0" x2="1" y1="0" y2=".4"><stop stop-color="#ffd9b8"/><stop offset=".55" stop-color="#f2bc93"/><stop offset="1" stop-color="#d9976e"/></linearGradient>
    <linearGradient id="mnIron" x1="0" x2="1"><stop stop-color="#2a2e33"/><stop offset=".18" stop-color="#6c747e"/><stop offset=".3" stop-color="#9aa3ad"/><stop offset=".48" stop-color="#4b5159"/><stop offset=".85" stop-color="#23262a"/><stop offset="1" stop-color="#15171a"/></linearGradient>
    <linearGradient id="mnGold" x1="0" x2="1"><stop stop-color="#6b4a1c"/><stop offset=".2" stop-color="#e9c77a"/><stop offset=".35" stop-color="#fff0c0"/><stop offset=".55" stop-color="#b78a3f"/><stop offset="1" stop-color="#5d3f15"/></linearGradient>
    <linearGradient id="mnWood" x2="0" y2="1"><stop stop-color="#b98952"/><stop offset="1" stop-color="#7d5430"/></linearGradient>
    <linearGradient id="mnWoodTop" x2="0" y2="1"><stop stop-color="#d4a86f"/><stop offset="1" stop-color="#b98952"/></linearGradient>
    <linearGradient id="mnDrum" x1="0" x2="1"><stop stop-color="#16285a"/><stop offset=".3" stop-color="#3d63b8"/><stop offset=".55" stop-color="#2a4a96"/><stop offset="1" stop-color="#121f45"/></linearGradient>
    <radialGradient id="mnDrumTop" cx=".4" cy=".35"><stop stop-color="#e0574b"/><stop offset="1" stop-color="#a2241d"/></radialGradient>
    <filter id="mnBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="mnBlurL" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>
    <clipPath id="mnMouthBack"><path d="M380 -80 H620 V186 A110 29 0 0 1 390 186 Z"/></clipPath>
  </defs>`;
  const star = (x, y, r) => { let p = ''; for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, k = i % 2 ? r * .45 : r; p += `${(x + Math.cos(a) * k).toFixed(1)},${(y + Math.sin(a) * k).toFixed(1)} `; } return `<polygon points="${p}"/>`; };
  const band = (y, w) => `<path d="M${500 - w} ${y} A${w} ${w * .27} 0 0 0 ${500 + w} ${y} L${500 + w} ${y + 13} A${w} ${w * .27} 0 0 1 ${500 - w} ${y + 13} Z" fill="url(#mnGold)" stroke="#5a3c16" stroke-width="1.6"/>`;

  // 大砲(太鼓の台・砲床・臼砲)。man: 中のおっさんを描くか
  function cannon(man) {
    return `
      <!-- 太鼓の台 -->
      <ellipse cx="500" cy="470" rx="182" ry="42" fill="#0e1838"/>
      <path d="M318 412 V470 A182 42 0 0 0 682 470 V412 Z" fill="url(#mnDrum)"/>
      <g fill="#f3cf6a">${[350, 400, 450, 500, 550, 600, 650].map((x, i) => star(x, 444 + Math.sin((x - 500) / 182 * 1.4) * 14, i % 2 ? 9 : 12)).join('')}</g>
      <path d="M318 416 A182 42 0 0 0 682 416 M318 464 A182 42 0 0 0 682 464" fill="none" stroke="url(#mnGold)" stroke-width="7"/>
      <ellipse cx="500" cy="412" rx="182" ry="42" fill="url(#mnDrumTop)" stroke="url(#mnGold)" stroke-width="6"/>
      <!-- 砲床 -->
      <path d="M372 336 L628 336 L640 400 L360 400 Z" fill="url(#mnWood)" stroke="#5a3a21" stroke-width="2.4"/>
      <path d="M384 318 L616 318 L628 336 L372 336 Z" fill="url(#mnWoodTop)" stroke="#5a3a21" stroke-width="2"/>
      <rect x="402" y="336" width="14" height="64" fill="#3d4248"/><rect x="584" y="336" width="14" height="64" fill="#3d4248"/>
      ${[409, 591].map(x => `<circle cx="${x}" cy="352" r="3.4" fill="#c9cdd2"/><circle cx="${x}" cy="384" r="3.4" fill="#c9cdd2"/>`).join('')}
      <!-- 臼砲 -->
      <path d="M404 340 C376 312 378 270 394 246 C404 230 414 218 418 196 L582 196 C586 218 596 230 606 246 C622 270 624 312 596 340 Z" fill="url(#mnIron)" stroke="#121417" stroke-width="2.6"/>
      ${band(298, 112)}${band(236, 96)}
      <circle cx="388" cy="300" r="15" fill="url(#mnGold)" stroke="#5a3c16" stroke-width="2"/><circle cx="612" cy="300" r="15" fill="url(#mnGold)" stroke="#5a3c16" stroke-width="2"/>
      <path d="M606 262 C640 262 650 236 668 226" fill="none" stroke="#8a6a44" stroke-width="5" stroke-linecap="round"/>
      <circle class="mn-spark" cx="668" cy="226" r="0" fill="#ffd23f"/>
      <ellipse cx="500" cy="186" rx="110" ry="29" fill="url(#mnIron)" stroke="#121417" stroke-width="2.6"/>
      <ellipse class="mn-mouth" cx="500" cy="188" rx="90" ry="21" fill="#0c0a09"/>
      ${man ? `<g clip-path="url(#mnMouthBack)"><g class="mn-man"><g transform="translate(500 192) scale(.8)">${manInCannon}</g></g></g>` : ''}
      <path d="M390 186 A110 29 0 0 0 610 186 L610 200 A110 29 0 0 1 390 200 Z" fill="url(#mnGold)" stroke="#5a3c16" stroke-width="2"/>
      <path d="M410 190 A90 21 0 0 0 590 190" fill="none" stroke="#0c0a09" stroke-width="3"/>
      ${man ? `<g class="mn-man"><g transform="translate(500 192) scale(.8)">${hands}</g></g>` : ''}`;
  }

  // ---- 盤: サーカスの舞台 ----
  const stripes = Array.from({length: 16}, (_, i) => `<rect x="${i * 62.5}" y="0" width="62.5" height="372" fill="${i % 2 ? '#f1e3c4' : '#b9302a'}"/>`).join('');
  // 床板の継ぎ目(奥の一点へ向かう線。床の上だけ)
  const planks = Array.from({length: 23}, (_, i) => { const x = -600 + i * 100, k = (372 + 420) / (690 + 420); return `<line x1="${(500 + (x - 500) * k).toFixed(1)}" y1="372" x2="${x}" y2="690"/>`; }).join('');
  const curtain = side => {
    const m = side < 0 ? '' : 'translate(1000 0) scale(-1 1)';
    return `<g transform="${m}">
      <path d="M0 0 H150 C138 90 120 190 92 262 C80 292 92 330 112 372 L112 690 H0 Z" fill="url(#mnCurtain)"/>
      <path d="M0 0 H150 C138 90 120 190 92 262 C80 292 92 330 112 372 L112 690 H0 Z" fill="none" stroke="#4d0b0e" stroke-width="3"/>
      <path d="M84 262 C98 270 112 270 124 262" fill="none" stroke="url(#mnGold)" stroke-width="9" stroke-linecap="round"/>
      <circle cx="128" cy="270" r="9" fill="url(#mnGold)"/><path d="M124 278 L120 312 H136 L132 278 Z" fill="url(#mnGold)"/>
    </g>`;
  };

  // ---- アニメ映像の各カット(1600×900 の絵。画面に合わせて切り取る) ----
  const focusLines = (cx, cy, n, col, seed) => {
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, w = .004 + r() * .01, r0 = 260 + r() * 260;
      const p = (rad, aa) => `${(cx + Math.cos(aa) * rad).toFixed(0)},${(cy + Math.sin(aa) * rad).toFixed(0)}`;
      s += `<polygon points="${p(r0, a)} ${p(1500, a - w)} ${p(1500, a + w)}"/>`;
    }
    return `<g fill="${col}">${s}</g>`;
  };
  const burst = (cx, cy, n, r1, r2, seed) => {
    const r = rng(seed); let p = '';
    for (let i = 0; i < n * 2; i++) { const a = Math.PI / n * i, k = i % 2 ? r1 * (.5 + r() * .25) : r2 * (.7 + r() * .3); p += `${(cx + Math.cos(a) * k).toFixed(0)},${(cy + Math.sin(a) * k).toFixed(0)} `; }
    return `<polygon points="${p}"/>`;
  };
  const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-120 30 C-150 30 -150 -10 -118 -12 C-118 -50 -60 -60 -40 -30 C-30 -80 50 -80 56 -26 C80 -50 130 -30 120 4 C150 8 146 30 120 30 Z" fill="#fff" stroke="#6d8fc4" stroke-width="5"/>
      <path d="M-120 30 C-90 16 80 16 120 30 Z" fill="#cfe0f6"/></g>`;
  function animeHtml(loser) {
    const S = 'viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"';
    // カット A: 驚く顔の大写し
    const cutA = `<div class="cut a"><svg ${S}>${DEFS}
        <rect width="1600" height="900" fill="#f6b23e"/><circle cx="800" cy="430" r="900" fill="#ef6a2e" opacity=".55"/>
        ${focusLines(800, 430, 150, '#fff6d8', 3)}
        <g class="shake"><ellipse cx="800" cy="850" rx="640" ry="64" fill="#0c0a09"/>
          <g transform="translate(800 860) scale(3)">${torso()}${head('shock')}</g>
          <path d="M120 846 A680 70 0 0 0 1480 846 L1480 930 H120 Z" fill="url(#mnGold)" stroke="#5a3c16" stroke-width="6"/></g>
      </svg><div class="word" style="right:9cqw;top:18cqh;font-size:min(13cqh,20cqw);transform:rotate(8deg)">!?</div>
      <div class="word" style="left:8cqw;top:20cqh;font-size:min(8cqh,12cqw);transform:rotate(-8deg)">ひぃっ</div></div>`;
    // カット B: 導火線を火が走る
    const cutB = `<div class="cut b"><svg ${S}>${DEFS}
        <rect width="1600" height="900" fill="#1b0c08"/>${focusLines(1300, 300, 110, '#5a1d10', 9)}
        <path class="fuse" d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#c9a06a" stroke-width="34" stroke-linecap="round"/>
        <path d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#7a5630" stroke-width="34" stroke-dasharray="10 22"/>
        <path class="burnt" d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#2b1a10" stroke-width="36" stroke-linecap="round" pathLength="1" stroke-dasharray="0 1"/>
        <g class="spark"><g fill="#ffd23f">${burst(0, 0, 9, 22, 70, 5)}</g><circle r="26" fill="#fff8d0"/>
          <g stroke="#ffcc33" stroke-width="5" stroke-linecap="round">${Array.from({length: 10}, (_, i) => { const a = i * .63; return `<line x1="${Math.cos(a) * 40}" y1="${Math.sin(a) * 40}" x2="${Math.cos(a) * 96}" y2="${Math.sin(a) * 96}"/>`; }).join('')}</g></g>
      </svg><div class="word" style="left:7cqw;top:16cqh;font-size:min(9cqh,13cqw);color:#ffe27a">ジジジ…</div></div>`;
    // カット C: ドーン(白黒反転の一瞬の絵)
    const cutC = `<div class="cut c"><svg ${S}>
        <rect width="1600" height="900" fill="#fff"/>${focusLines(800, 520, 140, '#111', 21)}
        <g fill="#111">${burst(800, 560, 22, 160, 430, 8)}</g><g fill="#fff">${burst(800, 560, 16, 70, 210, 12)}</g>
      </svg><div class="word" style="left:50%;top:40%;font-size:min(22cqh,17cqw);transform:translate(-50%,-50%) rotate(-6deg);color:#111;-webkit-text-stroke:min(1.2cqh,1cqw) #fff">ドーン!!</div></div>`;
    // カット D: 打ち上げ(カメラが追って空へ)
    const clouds = [[220, 300, 1.3], [1350, 120, 1.6], [560, -380, 1.1], [1250, -700, 1.4], [300, -1150, 1.7], [1100, -1600, 1.2], [480, -2050, 1.5], [1380, -2450, 1.1]].map(c => cloud(...c)).join('');
    const smoke = [[650, 560, 1.2], [960, 540, 1.1], [800, 500, 1.4]].map(([x, y, s]) => `<g class="puff" transform="translate(${x} ${y}) scale(${s})"><circle r="90" fill="#fff" stroke="#8a8a8a" stroke-width="5"/><circle cx="-60" cy="30" r="64" fill="#fff" stroke="#8a8a8a" stroke-width="5"/><circle cx="66" cy="24" r="70" fill="#fff" stroke="#8a8a8a" stroke-width="5"/><ellipse cx="0" cy="60" rx="110" ry="26" fill="#d9d9d9"/></g>`).join('');
    const cutD = `<div class="cut d"><svg ${S}>${DEFS}
        <defs><linearGradient id="mnSky" gradientUnits="userSpaceOnUse" x1="0" y1="-2700" x2="0" y2="900"><stop stop-color="#0d1d52"/><stop offset=".45" stop-color="#2f6fd0"/><stop offset=".8" stop-color="#6fc0f2"/><stop offset="1" stop-color="#c8ecfb"/></linearGradient></defs>
        <g class="world">
          <rect y="-2700" width="1600" height="3700" fill="url(#mnSky)"/>
          ${clouds}
          <path d="M-100 900 C300 740 1300 740 1700 900 V1100 H-100 Z" fill="#5fae4e" stroke="#2f6a2a" stroke-width="6"/>
          <g transform="translate(800 1010) scale(1.55) translate(-500 -470)">${cannon(false)}</g>
          ${smoke}
        </g>
        <g class="speed">${Array.from({length: 26}, (_, i) => `<line x1="${(i * 131) % 1600}" y1="${-200 - (i * 97) % 600}" x2="${(i * 131) % 1600}" y2="${-200 - (i * 97) % 600 + 260}" stroke-width="${3 + (i % 3) * 2}"/>`).join('')}</g>
        <g class="flyer"><g class="spin"><g transform="scale(1.25)">${flyerBody}</g></g></g>
        <g class="twinkle" transform="translate(800 170)" opacity="0"><g fill="#fffbe0">${star(0, 0, 70)}</g><circle r="16" fill="#fff"/></g>
      </svg><div class="word kira" style="left:50%;top:30%;font-size:min(9cqh,15cqw);transform:translateX(-50%);color:#fff7b0;opacity:0">キラーン</div></div>`;
    return `${cutA}${cutB}${cutC}${cutD}<div class="bar t"></div><div class="bar b"></div><div class="mn-cut"></div>`;
  }


  // ---- 盤(サーカスの舞台)。cols 列 × rows 段のボタン。H は盤の高さ(幅は 1000) ----
  function boardHtml(n, cols) {
    const rows = Math.ceil(n / cols), rowH = cols <= 6 ? 96 : 74, panelH = 20 + rows * rowH, H = 508 + panelH + 14;
    const planks = Array.from({length: 23}, (_, i) => { const x = -600 + i * 100, k = (372 + 420) / (H + 420); return `<line x1="${(500 + (x - 500) * k).toFixed(1)}" y1="372" x2="${x}" y2="${H}"/>`; }).join('');
    const curtain = side => `<g transform="${side < 0 ? '' : 'translate(1000 0) scale(-1 1)'}">
      <path d="M0 0 H150 C138 90 120 190 92 262 C80 292 92 330 112 372 L112 ${H} H0 Z" fill="url(#mnCurtain)" stroke="#4d0b0e" stroke-width="3"/>
      <path d="M84 262 C98 270 112 270 124 262" fill="none" stroke="url(#mnGold)" stroke-width="9" stroke-linecap="round"/>
      <circle cx="128" cy="270" r="9" fill="url(#mnGold)"/><path d="M124 278 L120 312 H136 L132 278 Z" fill="url(#mnGold)"/></g>`;
    const btn = (Math.min(rowH * .84, 780 / cols * .8) / H * 100).toFixed(2);
    return `<div class="mn-board" style="--cols:${cols};--rows:${rows};--ratio:${1000 / H};--btn:${btn}cqh;--top:${(518 / H * 100).toFixed(2)}%;--ph:${((panelH - 20) / H * 100).toFixed(2)}%">
    <svg class="mn-scene" viewBox="0 0 1000 ${H}" aria-hidden="true">
      ${DEFS}
      <defs>
        <linearGradient id="mnCurtain" spreadMethod="repeat" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="38" y2="0">
          <stop stop-color="#6a1014"/><stop offset=".45" stop-color="#b8323a"/><stop offset=".7" stop-color="#8e1b1f"/><stop offset="1" stop-color="#6a1014"/></linearGradient>
        <linearGradient id="mnFloor" x2="0" y2="1"><stop stop-color="#9c6a3b"/><stop offset=".4" stop-color="#c0894f"/><stop offset="1" stop-color="#a56f3d"/></linearGradient>
        <radialGradient id="mnWallShade" cx=".5" cy=".55" r=".65"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#2a0a06" stop-opacity=".18"/><stop offset="1" stop-color="#1a0504" stop-opacity=".6"/></radialGradient>
        <linearGradient id="mnBeam" x2="0" y2="1"><stop stop-color="#fff8dc" stop-opacity=".42"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></linearGradient>
        <linearGradient id="mnPanel" x2="0" y2="1"><stop stop-color="#2a3a66"/><stop offset="1" stop-color="#182346"/></linearGradient>
        <clipPath id="mnStage"><rect width="1000" height="${H}" rx="22"/></clipPath>
      </defs>
      <g clip-path="url(#mnStage)">
        ${stripes}
        <rect width="1000" height="372" fill="url(#mnWallShade)"/>
        <rect y="372" width="1000" height="${H - 372}" fill="url(#mnFloor)"/>
        <g stroke="#6e4422" stroke-width="2" opacity=".45">${planks}</g>
        <rect y="364" width="1000" height="12" fill="url(#mnGold)"/>
        <rect y="376" width="1000" height="16" fill="#000" opacity=".22"/>
        <path d="M430 -10 H570 L760 520 H240 Z" fill="url(#mnBeam)" filter="url(#mnBlur)"/>
        <ellipse cx="500" cy="456" rx="250" ry="56" fill="#fff4cc" opacity=".35" filter="url(#mnBlur)"/>
        <ellipse cx="516" cy="468" rx="170" ry="34" fill="#2a1406" opacity=".45" filter="url(#mnBlur)"/>
        ${curtain(-1)}${curtain(1)}
        <path d="M0 0 H1000 V62 H0 Z" fill="#8e1b1f"/>
        <path d="M0 62 ${Array.from({length: 10}, (_, i) => `Q${50 + i * 100} 100 ${100 + i * 100} 62`).join(' ')}" fill="#8e1b1f" stroke="url(#mnGold)" stroke-width="6"/>
        <g fill="url(#mnGold)">${Array.from({length: 9}, (_, i) => `<circle cx="${100 + i * 100}" cy="64" r="7"/><path d="M${96 + i * 100} 70 L${92 + i * 100} 96 H${108 + i * 100} L${104 + i * 100} 70 Z"/>`).join('')}</g>
        <path d="M0 20 H1000" stroke="url(#mnGold)" stroke-width="4" opacity=".8"/>
        <g transform="translate(500 470) scale(.8) translate(-500 -492)"><g class="mn-cannon">${cannon(true)}</g></g>
        <rect x="92" y="512" width="816" height="${panelH}" rx="22" fill="#000" opacity=".4" filter="url(#mnBlur)" transform="translate(6 8)"/>
        <rect x="92" y="508" width="816" height="${panelH}" rx="22" fill="url(#mnPanel)" stroke="url(#mnGold)" stroke-width="6"/>
        <rect x="106" y="522" width="788" height="${panelH - 28}" rx="14" fill="none" stroke="#f3cf6a" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 8" stroke-linecap="round"/>
      </g>
    </svg>
    <div class="mn-pop" aria-hidden="true"></div>
    <div class="mn-buttons" role="group" aria-label="ボタン">${Array.from({length: n}, (_, i) => `<button type="button" class="mn-btn" data-extra-mn="${i}" aria-label="ボタン ${i + 1}"><i><span>${i + 1}</span></i></button>`).join('')}</div>
  </div>`;
  }

  // ---- 効果音(Web Audio で作る。設定の音量・消音に従う) ----
  const snd = (() => {
    let noiseBuf = null;
    const ctx = () => { if (!S.set.sound || !sfx.enabled || !transientAudio.allowed()) return null; const c = typeof uiCtx === 'function' ? uiCtx() : null; return c && c.state !== 'closed' ? c : null; };
    const level = () => Math.max(0, (S.set.master ?? 100) / 100 * (S.set.sfxVol ?? 100) / 100);
    const out = (c, v = 1) => { const g = c.createGain(); g.gain.value = v * level(); g.connect(c.destination); return g; };
    const noise = c => {
      if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = transientAudio.track(c.createBufferSource()); s.buffer = noiseBuf; s.loop = true; return s;
    };
    const osc = (c, type, f) => { const o = transientAudio.track(c.createOscillator()); o.type = type; o.frequency.value = f; return o; };
    const env = (g, t, a, peak, dec, end = .0001) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + dec); };
    // ボタンを押した「カチッ」+ ばねの「コトン」
    function press() {
      const c = ctx(); if (!c) return; const t = c.currentTime + .005, o = out(c, .5);
      const n = noise(c), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 2400;
      n.connect(hp).connect(g).connect(o); env(g, t, .002, .7, .03); n.start(t); n.stop(t + .05);
      const s = osc(c, 'sine', 210), g2 = c.createGain(); s.frequency.exponentialRampToValueAtTime(85, t + .09);
      s.connect(g2).connect(o); env(g2, t + .01, .004, .8, .12); s.start(t); s.stop(t + .2);
    }
    // セーフ: 木琴の 2 音(上がる)
    function safe() {
      const c = ctx(); if (!c) return; const t = c.currentTime + .02, o = out(c, .5);
      [[659.3, 0], [987.8, .1]].forEach(([f, d]) => {
        for (const [k, v] of [[1, 1], [3.9, .25], [9.2, .08]]) { const s = osc(c, 'sine', f * k), g = c.createGain(); s.connect(g).connect(o); env(g, t + d, .004, v, .32 / k + .05); s.start(t + d); s.stop(t + d + .5); }
      });
    }
    // 心臓の音(残りが少ない時)
    function heart(times = 2) {
      const c = ctx(); if (!c) return; const o = out(c, .9);
      for (let i = 0; i < times; i++) for (const [d, v] of [[0, 1], [.2, .7]]) {
        const t = c.currentTime + .02 + i * .62 + d, s = osc(c, 'sine', 62), g = c.createGain();
        s.frequency.exponentialRampToValueAtTime(42, t + .14); s.connect(g).connect(o); env(g, t, .01, v, .2); s.start(t); s.stop(t + .3);
      }
    }
    // 導火線: 点く「シュボッ」と、パチパチ燃える音
    function fuse(dur) {
      const c = ctx(); if (!c) return; const t = c.currentTime + .01, o = out(c, .85);
      const n = noise(c), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(3800, t + .16);
      n.connect(bp).connect(g).connect(o); env(g, t, .02, .9, .2, .25); g.gain.setValueAtTime(.25, t + .22); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      n.start(t); n.stop(t + dur + .05);
      for (let k = 0; k < dur * 34; k++) {
        const at = t + .12 + Math.random() * (dur - .1), s = noise(c), hp = c.createBiquadFilter(), gg = c.createGain();
        hp.type = 'highpass'; hp.frequency.value = 3000 + Math.random() * 3000; s.connect(hp).connect(gg).connect(o);
        env(gg, at, .001, .25 + Math.random() * .6, .012 + Math.random() * .02); s.start(at); s.stop(at + .05);
      }
    }
    // 驚く顔: アニメの「ジャーン!」(不協和の和音+シンバル)
    function shock() {
      const c = ctx(); if (!c) return; const t = c.currentTime + .01, o = out(c, .5);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + .9); lp.connect(o);
      for (const f of [110, 155.6, 220, 233.1, 329.6]) {
        for (const det of [-6, 6]) { const s = osc(c, 'sawtooth', f), g = c.createGain(); s.detune.value = det; s.frequency.setValueAtTime(f * 1.03, t); s.frequency.exponentialRampToValueAtTime(f, t + .08);
          s.connect(g).connect(lp); env(g, t, .008, .22, .95); s.start(t); s.stop(t + 1.1); }
      }
      const n = noise(c), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 5500;
      n.connect(hp).connect(g).connect(o); env(g, t, .004, .9, 1.1); n.start(t); n.stop(t + 1.2);
    }
    // ドーン: 低い爆発音(落ちる低音+こもった雑音+歪み)
    function boom() {
      const c = ctx(); if (!c) return; const t = c.currentTime + .01, o = out(c, .62);
      const sh = c.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); } sh.curve = curve; sh.connect(o);
      const s = osc(c, 'sine', 120), g = c.createGain(); s.frequency.setValueAtTime(140, t); s.frequency.exponentialRampToValueAtTime(32, t + .9);
      s.connect(g).connect(sh); env(g, t, .006, .95, 1.5); s.start(t); s.stop(t + 1.7);
      const n = noise(c), lp = c.createBiquadFilter(), g2 = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(180, t + 1.2);
      n.connect(lp).connect(g2).connect(sh); env(g2, t, .004, .9, 1.4); n.start(t); n.stop(t + 1.6);
      const n2 = noise(c), hp = c.createBiquadFilter(), g3 = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 1800;
      n2.connect(hp).connect(g3).connect(o); env(g3, t, .002, .5, .18); n2.start(t); n2.stop(t + .25);
    }
    // 打ち上げ: 上がっていく笛(スライドホイッスル)と風
    function whoosh(dur) {
      const c = ctx(); if (!c) return; const t = c.currentTime + .01, o = out(c, .34);
      const s = osc(c, 'sine', 420), g = c.createGain(), vib = osc(c, 'sine', 7), vg = c.createGain(); vg.gain.value = 14;
      vib.connect(vg).connect(s.frequency);
      s.frequency.setValueAtTime(420, t); s.frequency.exponentialRampToValueAtTime(1900, t + dur * .62); s.frequency.exponentialRampToValueAtTime(2600, t + dur);
      s.connect(g).connect(o); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .08); g.gain.setValueAtTime(.55, t + dur * .55); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.start(t); vib.start(t); s.stop(t + dur + .05); vib.stop(t + dur + .05);
      const n = noise(c), bp = c.createBiquadFilter(), g2 = c.createGain(); bp.type = 'bandpass'; bp.Q.value = .8;
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
      n.connect(bp).connect(g2).connect(o); env(g2, t, .15, .8, dur); n.start(t); n.stop(t + dur + .2);
    }
    // キラーン: 鈴の音を上へ
    function twinkle() {
      const c = ctx(); if (!c) return; const t = c.currentTime + .01, o = out(c, .32);
      [2093, 2637, 3136, 4186, 5274].forEach((f, i) => { for (const [k, v] of [[1, 1], [2.76, .3]]) {
        const s = osc(c, 'sine', f * k), g = c.createGain(); s.connect(g).connect(o); env(g, t + i * .055, .003, v, .9); s.start(t + i * .055); s.stop(t + i * .055 + 1); } });
    }
    // ゲームオーバー: しょんぼりトロンボーン「ワッ ワッ ワッ ワ〜〜」/ 勝ちの時はファンファーレ
    function ending(win) {
      const c = ctx(); if (!c) return; const t = c.currentTime + .02, o = out(c, win ? .5 : 1);
      const notes = win ? [[523.3, 0, .14], [659.3, .15, .14], [784, .3, .14], [1046.5, .45, .8]] : [[196, 0, .36], [185, .4, .36], [174.6, .8, .36], [164.8, 1.2, 1.25]];
      notes.forEach(([f, d, len], i) => {
        const s = osc(c, win ? 'square' : 'sawtooth', f), lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.Q.value = 6;
        lp.frequency.setValueAtTime(350, t + d); lp.frequency.exponentialRampToValueAtTime(win ? 3200 : 1500, t + d + .07); lp.frequency.exponentialRampToValueAtTime(win ? 1800 : 420, t + d + len);
        if (!win && i === notes.length - 1) { const v = osc(c, 'sine', 5.5), vg = c.createGain(); vg.gain.value = 7; v.connect(vg).connect(s.frequency); v.start(t + d + .2); v.stop(t + d + len); }
        s.connect(lp).connect(g).connect(o); g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.5, t + d + .03); g.gain.setValueAtTime(.5, t + d + len * .7); g.gain.exponentialRampToValueAtTime(.0001, t + d + len);
        s.start(t + d); s.stop(t + d + len + .05);
      });
    }
    return {press, safe, heart, fuse, shock, boom, whoosh, twinkle, ending};
  })();

  // ---- 規則と進行(坊主めくりと同じく boardMatch の上で動く) ----
  const shuffleIdx = n => { const r = crypto.getRandomValues(new Uint32Array(1))[0]; return r % n; };
  let online = false, timer, secret = null, scoredId = null, anime = null, busyUntil = 0;
  let prefs = {cpu: 2, first: 'player', buttons: 24, rule: 'lose', ...store.get('munageSetup', {})};
  const cpuDelay = {短い: 900, ふつう: 1500, 長い: 2300};
  function setup(id, on = false) { online = on; go('munageSetup'); }
  function setupHtml() {
    const people = online ? extraParticipants(true) : setupPanel('人数と相手',
      setupRow('CPUの人数', seg('munage:cpu', [1, 2, 3, 4, 5].map(n => [n, n + '人']), prefs.cpu)) +
      setupRow('最初の手番', seg('munage:first', [['player', '自分'], ['cpu', 'CPU'], ['random', 'ランダム']], prefs.first)) +
      setupRow('CPUの手番の長さ', seg('munage:pace', CPU_PACE_CHOICES, prefs.pace || 'inherit')));
    const rule = setupPanel('ルール',
      setupRow('ボタンの数', seg('munage:buttons', [[12, '12個'], [24, '24個']], prefs.buttons)) +
      setupRow('おっさんを飛ばした人', seg('munage:rule', [['lose', '負け'], ['win', '勝ち']], prefs.rule)));
    return extraSetupLayout('munage', online, people, rule, 'data-munage-start');
  }
  function setOption(key, value) {
    if (key === 'cpu' && [1, 2, 3, 4, 5].includes(+value)) prefs.cpu = +value;
    if (key === 'first' && ['player', 'cpu', 'random'].includes(value)) prefs.first = value;
    if (key === 'pace' && CPU_PACE_CHOICES.some(([id]) => id === value)) prefs.pace = value;
    if (key === 'buttons' && [12, 24].includes(+value)) prefs.buttons = +value;
    if (key === 'rule' && ['lose', 'win'].includes(value)) prefs.rule = value;
    store.set('munageSetup', prefs);
    render();
  }
  function start(again) {
    const rules = {buttons: prefs.buttons, rule: prefs.rule};
    const on = again ? !!boardMatch.state?.online : online;
    if (again && on) { if (netApi?.role !== 'host') return; boardMatch.reset(); }
    return boardMatch.start('munage', on, on ? rules : {...prefs, ...rules});
  }
  function initial(round) {
    let turn = 0;
    if (!round.online) {
      const count = [1, 2, 3, 4, 5].includes(round.cpu) ? round.cpu : 2;
      for (let i = 0; i < count; i++) round.seats.push({id: i ? 'cpu' + (i + 1) : 'cpu', name: count === 1 ? 'CPU' : 'CPU ' + (i + 1)});
      if (round.first === 'cpu') turn = 1;
      if (round.first === 'random') turn = shuffleIdx(round.seats.length);
    }
    const n = [12, 24].includes(+round.buttons) ? +round.buttons : 24;
    // 点火スイッチの場所は、部屋を作った人(ホスト)の手元だけに置く。ほかの人には送らない。
    secret = {id: round.id, cell: shuffleIdx(n)};
    return {n, pressed: '0'.repeat(n), turn, last: -1, finish: false, bad: -1, loser: -1, rule: round.rule === 'win' ? 'win' : 'lose'};
  }
  function apply(state, action) {
    if (state.finish || action.move !== 'press' || action.turn !== state.version) return false;
    if (state.seats[state.turn]?.id !== action.uid) return false;
    const cell = action.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= state.n || state.pressed[cell] === '1') return false;
    // ホストが代わった時は、まだ押されていないボタンから選び直す
    if (secret?.id !== state.id || state.pressed[secret.cell] === '1') {
      const left = [...state.pressed].map((v, i) => v === '0' ? i : -1).filter(i => i >= 0);
      secret = {id: state.id, cell: left[shuffleIdx(left.length)]};
    }
    state.pressed = state.pressed.slice(0, cell) + '1' + state.pressed.slice(cell + 1);
    state.last = cell;
    if (cell === secret.cell) { state.finish = true; state.bad = cell; state.loser = state.turn; }
    else state.turn = (state.turn + 1) % state.seats.length;
    return true;
  }
  const left = state => [...state.pressed].filter(v => v === '0').length;
  function changed(state) {
    clearTimeout(timer);
    if (state.finish) {
      if (!state.online && scoredId !== state.id) {
        scoredId = state.id;
        const mine = state.seats.findIndex(p => p.id === 'local');
        const won = state.rule === 'win' ? state.loser === mine : state.loser !== mine;
        const stats = store.get('stats', {}), key = 'vs_munage', r = stats[key] || [0, 0, 0];
        r[won ? 0 : 1]++; stats[key] = r; store.set('stats', stats);
      }
      return;
    }
    if (state.online || state.seats[state.turn].id === 'local') return;
    const player = state.seats[state.turn];
    const choices = [...state.pressed].map((v, i) => v === '0' ? i : -1).filter(i => i >= 0);
    const cell = choices[shuffleIdx(choices.length)];
    const {id, version: turn} = state;
    const current = () => S.screen === 'extraPlay' && boardMatch.state?.id === id && boardMatch.state.version === turn;
    timer = setTimeout(async () => {
      if (!current()) return;
      while (performance.now() < busyUntil) { await new Promise(r => setTimeout(r, busyUntil - performance.now() + 30)); if (!current()) return; }
      await moveCpuCursor(player.name, [$(`[data-extra-mn="${cell}"]`)], current);
      if (!current()) return;
      hideCursor();
      boardMatch.actionFromGuest({uid: player.id, id, move: 'press', cell, turn});
    }, cpuDelay[cpuPaceSetting(state.pace)] || 1500);
  }

  // ---- 画面 ----
  const cpuIcons = ['ねこ', 'きつね', 'うさぎ', 'ふくろう', 'だるま'];
  function seatIcon(state, player, index) {
    if (player.id === boardMatch.myId()) return meAv();
    const avatar = state.online ? fbState.players[player.id]?.avatar : AV.findIndex(([name]) => name === cpuIcons[index - 1]);
    if (Number.isInteger(avatar) && AV[avatar]) return `<span class="avatar av">${avSvg(avatar)}</span>`;
    return `<span class="avatar">${esc([...player.name][0] || '？')}</span>`;
  }
  function html(state) {
    const actions = `<button class="btn" disabled>${ic('undo')}待った</button>${ruleButton('munage')}
      <button class="btn" disabled>${ic('list')}役の一覧</button><button class="btn" data-extra-mn-again ${state.finish && (!state.online || netApi?.role === 'host') ? '' : 'disabled'}>もう一度</button>`;
    const side = playSide({seats: '<div class="seats" id="strip"></div>', status: '<div class="status" id="mnStatus"></div>', actions, on: state.online,
      content: '<div class="sidenote" id="mnNote"></div>', extraClass: ''});
    return `<div class="screen play-screen"><div class="stage">
      ${playHeader('胸毛絶体絶命', playMode(state.online), 'data-extra-exit', `<b id="mnRound"></b>`)}
      <div class="boardwrap k-munage mn-wrap" id="mnTable"></div>
      ${playGear()}
      <div class="cutlayer" id="cutlayer"></div>
      <div class="resultlayer" id="result" hidden></div>
    </div>${side}</div>`;
  }
  const narrow = () => isMob();
  function draw(state) {
    const table = $('#mnTable'); if (!table) return;
    const cols = state.n === 24 && narrow() ? 6 : state.n / 2;
    const build = `${state.id}|${state.n}|${cols}`;
    const prev = Number(table.dataset.version ?? -1);
    const consecutive = table.dataset.build === build && prev === state.version - 1;
    const rebuilt = table.dataset.build !== build;
    if (rebuilt) { table.innerHTML = boardHtml(state.n, cols); table.dataset.build = build; }
    if (!rebuilt && prev === state.version) return;
    table.dataset.version = state.version;
    const mine = state.seats.findIndex(p => p.id === boardMatch.myId());
    const myTurn = !state.finish && state.turn === mine;
    const animating = consecutive && state.last >= 0;
    table.querySelectorAll('.mn-btn').forEach((b, i) => {
      const on = state.pressed[i] === '1';
      // 今押されたボタンは、押し込む動きを見せるため 1 コマ遅れて緑にする
      if (!(animating && i === state.last)) b.classList.toggle('on', on);
      b.classList.toggle('bad', i === state.bad);
      b.disabled = !myTurn || on;
    });
    const board = table.querySelector('.mn-board');
    board.classList.toggle('fired', state.finish && !(animating && state.finish));
    board.classList.toggle('my-turn', myTurn);
    // 側板
    const loserName = state.loser >= 0 ? state.seats[state.loser].name : '';
    $('#strip').innerHTML = state.seats.map((p, i) => `<div class="pl ${!state.finish && i === state.turn ? 'turn' : ''}${state.finish && i === state.loser ? ' mn-out' : ''}">${seatIcon(state, p, i)}
      <span class="who"><span class="nm">${esc(p.name)}</span><span class="nt">${state.finish ? (i === state.loser ? (state.rule === 'win' ? '飛ばした!勝ち' : '飛ばした…負け') : '') : i === state.turn ? (i === mine ? 'ボタンを選ぶ' : '選んでいます…') : p.id.startsWith('cpu') ? 'CPU' : ''}</span></span></div>`).join('');
    $('#mnStatus').textContent = state.finish
      ? `${loserName}の${state.rule === 'win' ? '勝ち' : '負け'}`
      : myTurn ? 'ボタンを 1 つ押してください' : `${state.seats[state.turn].name}の番`;
    const rest = left(state);
    $('#mnNote').innerHTML = `<div class="kv"><span>押したボタン</span><b class="num">${state.n - rest} / ${state.n}</b></div>
      <div class="kv mn-more"><span>残り</span><b class="num">${rest}個</b></div>
      <div class="kv mn-more"><span>飛ばした人</span><b>${state.rule === 'win' ? '勝ち' : '負け'}</b></div>`;
    $('#mnRound').innerHTML = `<span class="hchip">ボタン ${state.n} 個</span>`;
    const again = $('[data-extra-mn-again]'); if (again) again.disabled = !(state.finish && (!state.online || netApi?.role === 'host'));
    if (!state.finish) { const r = $('#result'); if (r) r.hidden = true; }
    if (!animating || document.hidden) { if (state.finish) { board.classList.add('fired'); if (!anime) showResult(state); } return; }
    // 押した時の動き・音
    const btn = table.querySelector(`[data-extra-mn="${state.last}"]`);
    snd.press();
    requestAnimationFrame(() => btn.classList.add('on'));
    if (!state.finish) {
      busyUntil = performance.now() + 700;
      transientAudio.later(() => {
        if (!btn.isConnected) return;
        snd.safe();
        if (!S.set.reduce) board.querySelectorAll('.mn-man').forEach(man => man.animate([{transform: 'translateY(0)'}, {transform: 'translateY(-10px)'}, {transform: 'translateY(3px)'}, {transform: 'translateY(0)'}], {duration: 380, easing: 'ease-out'}));
        pop(board, 'セーフ!');
        // 残りが少ないほど、心臓の音を多く
        const r = left(state);
        if (r <= Math.max(3, state.n / 4)) setTimeout(() => snd.heart(r <= 2 ? 3 : 2), 420);
      }, 240);
      return;
    }
    fire(state, board, btn);
  }
  // ---- 結果の画面(ほかのゲームと同じ形: 勝敗・メニュー・もう一度) ----
  function showResult(state) {
    const p = $('#result');
    if (!p || boardMatch.state?.id !== state.id || !state.finish) return;
    const win = state.rule === 'win', mine = state.seats.findIndex(x => x.id === boardMatch.myId());
    const loser = state.seats[state.loser];
    const title = mine < 0 ? `${loser.name}の${win ? '勝ち' : '負け'}` : (state.loser === mine) === win ? 'あなたの勝ち' : 'あなたの負け';
    const host = !state.online || netApi?.role === 'host';
    const list = state.seats.map((x, i) => `<li class="${i === mine ? 'me' : ''}"><b>${i === state.loser ? (win ? '勝ち' : '負け') : (win ? '負け' : 'セーフ')}</b><span>${esc(x.name)}</span></li>`).join('');
    p.innerHTML = `<div class="rbox"><h3>${esc(title)}</h3><p>${esc(loser.name)}がおっさんを飛ばした(点火スイッチは ${state.bad + 1} 番)</p>
      <ol class="rrank">${list}</ol>${host ? '' : '<p class="dimtxt">ホストが次を始めるのを待っています</p>'}
      <div class="rbtns"><button class="btn" data-extra-exit>${state.online ? '部屋に戻る' : 'メニュー'}</button>${host ? '<button class="btn primary" data-extra-mn-again>もう一度</button>' : ''}</div></div>`;
    p.hidden = false;
  }
  function pop(board, text) {
    const el = board.querySelector('.mn-pop'); if (!el) return;
    el.textContent = text; el.getAnimations().forEach(a => a.cancel());
    el.animate([{opacity: 0, transform: 'translate(-50%,10px) scale(.6)'}, {opacity: 1, transform: 'translate(-50%,0) scale(1.08)', offset: .25}, {opacity: 1, transform: 'translate(-50%,-6px) scale(1)', offset: .75}, {opacity: 0, transform: 'translate(-50%,-14px) scale(1)'}], {duration: 900, easing: 'ease-out'});
  }

  // ---- 外れ: 盤で火がつき、アニメ映像へ ----
  function fire(state, board, btn) {
    const loser = state.seats[state.loser].name, win = state.rule === 'win';
    busyUntil = performance.now() + 6000;
    const spark = board.querySelector('.mn-spark');
    spark?.animate([{r: 0}, {r: 10}, {r: 6}, {r: 11}, {r: 7}], {duration: 450, fill: 'forwards'});
    board.querySelector('.mn-cannon')?.animate([{transform: 'translate(0,0)'}, {transform: 'translate(-3px,1px)'}, {transform: 'translate(3px,-1px)'}, {transform: 'translate(0,0)'}], {duration: 90, iterations: 5, delay: 120});
    transientAudio.later(() => snd.fuse(.45), 60);
    if (S.set.reduce) {
      board.classList.add('fired');
      snd.boom();
      cut({text: 'ゲームオーバー', sub: `${loser}の${win ? '勝ち' : '負け'}`, tone: 'red', ms: 1800});
      setTimeout(() => snd.ending(win), 300);
      setTimeout(() => showResult(state), 2200);
      return;
    }
    setTimeout(() => { if (board.isConnected && boardMatch.state?.id === state.id) playAnime(state, board, loser, win); }, 450);
  }
  function stopAnime() {
    if (!anime) return;
    const done = anime.onEnd;
    anime.timers.forEach(clearTimeout);
    anime.el.remove();
    anime = null;
    done?.();
  }
  function playAnime(state, board, loser, win) {
    stopAnime();
    const L = document.createElement('div'); L.className = 'mn-anime'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-label', `${loser}がおっさんを飛ばした`);
    L.innerHTML = animeHtml() + '<div class="mn-skip">タップでとばす</div>';
    document.body.append(L);
    const timers = [];
    anime = {el: L, timers, onEnd: () => showResult(state)};
    const at = (ms, fn) => timers.push(setTimeout(() => { if (L.isConnected) fn(); }, ms));
    const q = s => L.querySelector(s);
    const cut = sel => L.querySelectorAll('.cut').forEach(c => c.classList.toggle('on', c.matches(sel)));
    const finish = () => {
      board.classList.add('fired');
      L.querySelectorAll('.bar').forEach((b, i) => b.animate([{transform: 'none'}, {transform: `translateY(${i ? 100 : -100}%)`}], {duration: 200, fill: 'forwards'}));
      q('.mn-skip')?.remove();
      q('.mn-cut').outerHTML = `<button class="cutin red f-mo tall" tabindex="-1" data-mn-close><span class="veil"></span><span class="band"></span><span class="txt"><span class="mainl" style="font-size:min(12cqh,10.5cqw)">ゲームオーバー</span><small>${esc(loser)}の${win ? '勝ち' : '負け'}</small></span></button>`;
      snd.ending(win);
      timers.forEach(clearTimeout); timers.length = 0;
      at(2300, () => { L.animate([{opacity: 1}, {opacity: 0}], {duration: 300, fill: 'forwards'}).onfinish = stopAnime; });
    };
    L.addEventListener('click', () => { if (q('[data-mn-close]')) stopAnime(); else finish(); });
    board.classList.add('fired');
    q('.bar.t').animate([{transform: 'translateY(-100%)'}, {transform: 'none'}], {duration: 160, easing: 'ease-out'});
    q('.bar.b').animate([{transform: 'translateY(100%)'}, {transform: 'none'}], {duration: 160, easing: 'ease-out'});
    // A: 驚く顔
    cut('.a'); snd.shock();
    q('.a svg').animate([{transform: 'scale(1.18)'}, {transform: 'scale(1)'}], {duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards'});
    q('.a .shake').animate([{transform: 'translate(0,0)'}, {transform: 'translate(8px,-5px)'}, {transform: 'translate(-7px,4px)'}, {transform: 'translate(5px,6px)'}], {duration: 120, iterations: Infinity, delay: 240});
    L.querySelectorAll('.a .word').forEach((w, i) => w.animate([{transform: w.style.transform + ' scale(2.4)', opacity: 0}, {transform: w.style.transform, opacity: 1}],
      {duration: 200, delay: 160 + i * 110, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'both'}));
    // B: 導火線
    at(800, () => {
      cut('.b'); snd.fuse(.65);
      // 縦長の画面では左右が切れて火花がすぐ外へ出るので、導火線全体を収める
      if (innerWidth < innerHeight) q('.b svg').setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const path = q('.b .fuse'), spark = q('.b .spark'), burnt = q('.b .burnt'), len = path.getTotalLength(), t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / 600), e = t * t * (1.6 - .6 * t), pt = path.getPointAtLength(e * len);
        spark.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${now * .9}) scale(${.9 + Math.random() * .35})`);
        burnt.setAttribute('stroke-dasharray', `${e} 1`);
        if (t < 1 && L.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      q('.b .word').animate([{opacity: 0}, {opacity: 1}], {duration: 120, fill: 'both'});
    });
    // C: ドーン
    at(1450, () => {
      cut('.c'); snd.boom();
      q('.c').animate([{transform: 'translate(0,0) scale(1.06)'}, {transform: 'translate(-18px,10px) scale(1.03)'}, {transform: 'translate(14px,-12px)'}, {transform: 'translate(-6px,6px)'}, {transform: 'none'}], {duration: 300});
      q('.c .word').animate([{transform: `translate(-50%,-50%) rotate(-6deg) scale(${innerWidth < innerHeight ? 1.25 : 2.2})`}, {transform: 'translate(-50%,-50%) rotate(-6deg) scale(1)'}], {duration: 160, easing: 'ease-out', fill: 'both'});
    });
    // D: 打ち上げ → キラーン
    at(1750, () => {
      cut('.d'); snd.whoosh(2.3);
      const world = q('.d .world'), fl = q('.d .flyer'), spin = q('.d .spin');
      world.animate([{transform: 'translateY(0)'}, {transform: 'translateY(0)', offset: .14}, {transform: 'translateY(2600px)'}], {duration: 1900, easing: 'cubic-bezier(.55,0,.45,1)', fill: 'forwards'});
      L.querySelectorAll('.d .puff').forEach((p, i) => p.animate([{opacity: 0, transform: p.getAttribute('transform') + ' scale(.3)'}, {opacity: 1, transform: p.getAttribute('transform') + ' scale(1)'}], {duration: 260 + i * 60, easing: 'ease-out', fill: 'both'}));
      fl.animate([{transform: 'translate(800px,700px) scale(.55)'}, {transform: 'translate(800px,420px) scale(1.05)', offset: .12}, {transform: 'translate(790px,400px) scale(1)', offset: .62}, {transform: 'translate(800px,170px) scale(.02)'}], {duration: 2400, easing: 'ease-in-out', fill: 'forwards'});
      spin.animate([{transform: 'rotate(0)'}, {transform: 'rotate(-40deg)', offset: .1}, {transform: 'rotate(-1150deg)'}], {duration: 2400, easing: 'cubic-bezier(.3,.2,.6,1)', fill: 'forwards'});
      L.querySelectorAll('.d .speed line').forEach((ln, i) => ln.animate([{transform: 'translateY(0)'}, {transform: 'translateY(1500px)'}], {duration: 380, delay: 300 + (i * 53) % 380, iterations: 4, easing: 'linear'}));
      q('.d .twinkle').animate([{opacity: 1, transform: 'translate(800px,170px) scale(0) rotate(0)'}, {opacity: 1, transform: 'translate(800px,170px) scale(1.5) rotate(60deg)', offset: .5}, {opacity: 1, transform: 'translate(800px,170px) scale(1) rotate(90deg)'}], {delay: 2350, duration: 450, fill: 'forwards'});
      q('.d .kira').animate([{opacity: 0, transform: 'translateX(-50%) scale(.2)'}, {opacity: 1, transform: 'translateX(-50%) scale(1)'}], {delay: 2450, duration: 300, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'forwards'});
    });
    at(1750 + 2350, () => snd.twinkle());
    at(4650, finish);
  }

  function button(d) {
    const state = boardMatch.state; if (!state) return;
    if (d.extraMnAgain !== undefined) return start(true);
    if (d.extraMn !== undefined) return boardMatch.send('press', {cell: +d.extraMn, turn: state.version});
  }
  const stop = () => { clearTimeout(timer); secret = null; if (anime) anime.onEnd = null; stopAnime(); };
  window.addEventListener('resize', () => { if (S.screen === 'extraPlay' && boardMatch.state?.game === 'munage') { const t = $('#mnTable'); if (t && t.querySelector('.mn-board') && (t.dataset.build.split('|')[2] !== String(boardMatch.state.n === 24 && narrow() ? 6 : boardMatch.state.n / 2))) boardMatch.draw(); } });
  boardMatch.register('munage', {initial, apply, changed, html, draw, button, stop});
  // sound は試験(音を書き出して確かめる)用
  return {setup, setupHtml, setOption, start: () => start(false), sound: snd};
})();
