// インカの黄金 — 盤面の見本(スマホ版)。実際の対局画面(共通部品はそのまま)に盤だけを差し込む。
// 場面は PC 版と同じ: ラウンド 2 の探検中。カードは 宝石11 → 宝石7 → 障害(クモ) → 宝石14 → 遺物 の 5 枚がめくれ、
// 残っている探検者は あなた と CPU 1 の 2 人だけ(CPU 2・CPU 3 は帰還済み)。「進むか帰るか」を選ぶ場面。
// スマホ版の工夫: 縦画面を活かして石畳の道を縦に蛇行させ、1 画面(スクロールなし)に収める。
// 下部が入口とキャンプ、上部が神殿の入口。保持中の宝石(9 個)は #sidenote が見えない前提で盤の中の札にも出す。
// コア(core/games/incangold.mjs)の view が返す情報だけを描く前提。
(() => {
  const css = `
  .play-screen .boardwrap.k-incangold-m{display:block}
  .igm-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:16px;overflow:hidden;background:#14231a}
  .igm-wrap svg{display:block;width:100%;height:100%}
  .igm-acts{display:flex;gap:14px;justify-content:center;align-items:center;padding:4px 0 2px}
  .igm-btn{display:inline-flex;align-items:center;gap:9px;font-size:18.5px;font-weight:800;letter-spacing:.12em;
    padding:11px 36px;border-radius:999px;cursor:pointer;border:2px solid}
  .igm-btn.go{background:linear-gradient(180deg,#ffb62e,#e07f13);border-color:#8a4d08;color:#fff8ea;
    box-shadow:0 3px 0 #8a4d08,0 6px 14px rgba(0,0,0,.28);text-shadow:0 1px 2px rgba(90,40,0,.45)}
  .igm-btn.back{background:linear-gradient(180deg,#3c7048,#26492e);border-color:#12291a;color:#eaf5e6;
    box-shadow:0 3px 0 #12291a,0 6px 14px rgba(0,0,0,.28);text-shadow:0 1px 2px rgba(0,20,5,.5)}
  .igm-btn svg{display:block}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // ---- 小物描画ヘルパ(PC 版の絵を流用) ----
  const gem = (cx, cy, r, seed = 0) => {
    const pts = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + seed * 0.7 + (i % 2) * 0.18;
      const rr = r * (i % 2 ? 0.82 : 1);
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.86).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="url(#gemGrad)" stroke="#0b5a51" stroke-width="1.4"/>` +
      `<polygon points="${pts[0]} ${pts[1]} ${(cx).toFixed(1)},${(cy).toFixed(1)}" fill="#b8fff4" opacity=".55"/>`;
  };
  const gemPile = (cx, cy, count, s = 1) => {
    const offs = [[0, 0, 8], [-11, 3, 6.5], [11, 3, 6.5], [-5, -6, 6], [6, -5, 5.5], [0, 6, 6], [-14, -3, 5], [15, -2, 5]];
    let out = '';
    for (let i = 0; i < Math.min(count, offs.length); i++) {
      const [dx, dy, r] = offs[i];
      out += gem(cx + dx * s, cy + dy * s, r * s, i * 1.3 + cx * 0.01);
    }
    return out;
  };
  const token = (cx, cy, color, dark) => `
    <ellipse cx="${cx}" cy="${cy + 15}" rx="15" ry="4" fill="#000" opacity=".28"/>
    <circle cx="${cx}" cy="${cy}" r="15" fill="${color}" stroke="#fff6e3" stroke-width="2.8"/>
    <circle cx="${cx}" cy="${cy}" r="11.8" fill="none" stroke="${dark}" stroke-width="1.4" opacity=".65"/>
    <circle cx="${cx}" cy="${cy - 4}" r="4" fill="#fff6e3"/>
    <path d="M ${cx - 6.6} ${cy + 8.4} Q ${cx} ${cy + 0.4} ${cx + 6.6} ${cy + 8.4} L ${cx + 6.6} ${cy + 9.7} L ${cx - 6.6} ${cy + 9.7} Z" fill="#fff6e3"/>`;

  // ---- タイル(PC 版より一回り小さく 96 角) ----
  const tileBase = (cx, cy, rot, fill) => `
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <rect x="-50" y="-46" width="96" height="96" rx="14" fill="#20261f"/>
      <rect x="-48" y="-48" width="96" height="96" rx="14" fill="${fill}" stroke="#333a31" stroke-width="2.5"/>
      <rect x="-41" y="-41" width="82" height="82" rx="10" fill="none" stroke="#e8e2cc" stroke-width="1.3" opacity=".16"/>
      <ellipse cx="-27" cy="-30" rx="15" ry="7" fill="#4d7c43" opacity=".4"/>
      <ellipse cx="32" cy="34" rx="12" ry="5.5" fill="#3c6334" opacity=".35"/>
    </g>`;
  const gemTile = (cx, cy, rot, value, rem) => `
    ${tileBase(cx, cy, rot, 'url(#stoneGrad)')}
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      ${gem(-14, -16, 13.5, 1)}${gem(12, -21, 10.5, 2)}${gem(2, -3, 10, 3)}
      <text x="0" y="38" text-anchor="middle" font-size="31" font-weight="800" fill="#ffedb5" stroke="rgba(50,32,4,.5)" stroke-width="1.1">${value}</text>
      ${rem ? gemPile(30, 36, rem, 0.55) : ''}
    </g>`;
  const spiderTile = (cx, cy, rot) => {
    let legs = '';
    for (const s of [-1, 1]) {
      legs += `<path d="M ${s * 7} -12 Q ${s * 27} -27 ${s * 38} -36" /><path d="M ${s * 11} -4 Q ${s * 30} -11 ${s * 41} -13" />` +
        `<path d="M ${s * 11} 5 Q ${s * 30} 7 ${s * 40} 16" /><path d="M ${s * 7} 13 Q ${s * 23} 25 ${s * 30} 36" />`;
    }
    return `
    ${tileBase(cx, cy, rot, 'url(#hazGrad)')}
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <g stroke="#221612" stroke-width="5" fill="none" stroke-linecap="round">${legs}</g>
      <ellipse cx="0" cy="-5" rx="14" ry="16" fill="#2a1c16"/>
      <path d="M 0 -18 L 4.5 -5 L 0 2 L -4.5 -5 Z" fill="#c8352a"/>
      <circle cx="0" cy="12" r="8" fill="#20140f"/>
      <circle cx="-3" cy="10" r="1.7" fill="#ff5347"/><circle cx="3" cy="10" r="1.7" fill="#ff5347"/>
    </g>`;
  };
  const idol = `
    <g>
      <circle cx="0" cy="-7" r="33" fill="url(#glowGrad)"/>
      <rect x="-17" y="14" width="34" height="10" rx="2.2" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.5"/>
      <rect x="-12.5" y="6" width="25" height="9" rx="1.8" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.5"/>
      <path d="M -9 7 L -6.7 -11 Q 0 -15 6.7 -11 L 9 7 Z" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.5"/>
      <rect x="-14" y="-8" width="5" height="12.5" rx="2.3" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.2"/>
      <rect x="9" y="-8" width="5" height="12.5" rx="2.3" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.2"/>
      <circle cx="0" cy="-19" r="6.8" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.5"/>
      <rect x="-9" y="-28.5" width="18" height="5.4" rx="2.7" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.3"/>
      <circle cx="-2.5" cy="-19" r="1.2" fill="#5d3c08"/><circle cx="2.5" cy="-19" r="1.2" fill="#5d3c08"/>
    </g>`;
  const artifactTile = (cx, cy, rot) => `
    ${tileBase(cx, cy, rot, 'url(#stoneGrad)')}
    <g transform="translate(${cx} ${cy + 2}) rotate(${rot})">${idol}</g>`;

  const leaf = (x, y, s, rot, op) => `
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${op}">
      <path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/>
      <path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/>
    </g>`;

  // 道は入口(下)→神殿(上)へ縦に蛇行。タイル中心: (126,492) (264,408) (138,318) (260,232) (164,158)
  const pathD = 'M 96 628 C 118 572 116 540 126 496 C 138 444 244 452 262 412 C 280 372 158 362 140 322 C 124 286 238 276 258 236 C 274 204 188 196 166 162 C 150 136 252 122 316 92';
  const svg = `
  <svg viewBox="0 0 400 660" preserveAspectRatio="xMidYMid meet" role="img" aria-label="インカの黄金の盤面">
    <defs>
      <radialGradient id="groundGrad" cx="45%" cy="22%" r="95%">
        <stop offset="0%" stop-color="#33513a"/><stop offset="55%" stop-color="#22392a"/><stop offset="100%" stop-color="#14231a"/>
      </radialGradient>
      <linearGradient id="stoneGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#9aa08f"/><stop offset="55%" stop-color="#7c8272"/><stop offset="100%" stop-color="#5f6455"/>
      </linearGradient>
      <linearGradient id="hazGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#96604f"/><stop offset="100%" stop-color="#6d3a30"/>
      </linearGradient>
      <linearGradient id="gemGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5fe8d4"/><stop offset="55%" stop-color="#23b8a4"/><stop offset="100%" stop-color="#0e7d70"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffe98a"/><stop offset="55%" stop-color="#f2b63c"/><stop offset="100%" stop-color="#c07f16"/>
      </linearGradient>
      <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd968" stop-opacity=".55"/><stop offset="100%" stop-color="#ffd968" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="darkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05080a"/><stop offset="100%" stop-color="#0d130d"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="400" height="660" fill="url(#groundGrad)"/>
    <ellipse cx="70" cy="90" rx="110" ry="46" fill="#0c2013" opacity=".35"/>
    <ellipse cx="350" cy="560" rx="120" ry="52" fill="#0c2013" opacity=".3"/>
    <ellipse cx="200" cy="650" rx="170" ry="34" fill="#0a1c10" opacity=".3"/>

    <!-- 神殿の入口(上部・闇) -->
    <g>
      <path d="M 306 128 L 306 46 Q 348 8 400 34 L 400 128 Z" fill="url(#darkGrad)"/>
      <rect x="298" y="32" width="12" height="98" rx="4" fill="#585d4f"/>
      <path d="M 304 38 Q 348 4 402 28 L 402 44 Q 348 20 304 52 Z" fill="#6a6f5e"/>
      <rect x="318" y="66" width="52" height="6" rx="3" fill="#000" opacity=".5"/>
      <rect x="318" y="92" width="52" height="6" rx="3" fill="#000" opacity=".4"/>
    </g>

    <!-- 道(石畳) -->
    <path d="${pathD}" fill="none" stroke="#565a4d" stroke-width="90" stroke-linecap="round"/>
    <path d="${pathD}" fill="none" stroke="#757a68" stroke-width="73" stroke-linecap="round"/>
    <ellipse cx="196" cy="446" rx="19" ry="12" fill="#83887a" transform="rotate(-38 196 446)"/>
    <ellipse cx="192" cy="356" rx="17" ry="11" fill="#83887a" transform="rotate(28 192 356)"/>
    <ellipse cx="216" cy="268" rx="17" ry="11" fill="#83887a" transform="rotate(-32 216 268)"/>
    <ellipse cx="238" cy="180" rx="16" ry="10" fill="#83887a" transform="rotate(38 238 180)"/>
    <!-- 次のタイル(裏向き・神殿の入口の前) -->
    <g transform="translate(322 96) rotate(7)">
      <rect x="-35" y="-35" width="70" height="70" rx="11" fill="#4c5044" stroke="#2c3028" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="15" fill="none" stroke="#c9c2a4" stroke-width="2.2" opacity=".5"/>
      <circle cx="0" cy="0" r="5.2" fill="#c9c2a4" opacity=".5"/>
    </g>

    <!-- めくられたカード -->
    ${gemTile(126, 492, -3, 11, 3)}
    ${gemTile(264, 408, 2, 7, 2)}
    ${spiderTile(138, 318, -2)}
    ${gemTile(260, 232, 3, 14, 3)}
    ${artifactTile(164, 158, -2)}

    <!-- 探検者(最新の遺物タイルの脇) -->
    ${token(60, 186, '#e8a91c', '#8a5f06')}
    ${gemPile(42, 206, 5, 0.75)}
    ${token(274, 170, '#2f6fd0', '#173f7d')}
    ${gemPile(298, 188, 4, 0.75)}
    <!-- 保持中の宝石(あなたの分。sidenote が見えない前提で盤にも出す) -->
    <g>
      <rect x="8" y="218" width="118" height="27" rx="13.5" fill="#0d1a10" opacity=".78"/>
      <rect x="8" y="218" width="118" height="27" rx="13.5" fill="none" stroke="#c9b96a" stroke-width="1.2" opacity=".7"/>
      ${gem(24, 231.5, 6.5, 2)}
      <text x="72" y="237" text-anchor="middle" font-size="14.5" font-weight="700" fill="#ffedb5">保持中 9 個</text>
    </g>

    <!-- キャンプ(入口・下部) -->
    <g>
      <ellipse cx="88" cy="646" rx="82" ry="11" fill="#000" opacity=".22"/>
      <path d="M 30 636 L 88 564 L 146 636 Z" fill="#b4552d"/>
      <path d="M 88 564 L 146 636 L 88 636 Z" fill="#96431f"/>
      <path d="M 88 592 L 112 636 L 64 636 Z" fill="#5d3418"/>
      <path d="M 88 592 L 112 636 L 88 636 Z" fill="#472708"/>
      <!-- 宝石袋 -->
      <path d="M 158 646 C 144 624 148 608 160 602 C 156 595 162 589 168 591 C 174 589 180 595 176 602 C 188 608 192 624 178 646 Z" fill="#8a6a38" stroke="#5f451f" stroke-width="2"/>
      <ellipse cx="168" cy="603" rx="9" ry="3.6" fill="#5f451f"/>
      ${gem(154, 620, 6, 2)}${gem(168, 629, 7, 4)}${gem(181, 619, 5.5, 1)}${gem(176, 639, 5.5, 3)}
    </g>
    ${token(222, 612, '#3d9e63', '#1d5c36')}
    ${gemPile(248, 630, 4, 0.7)}
    ${token(316, 606, '#d0602f', '#7d3410')}
    ${gemPile(342, 624, 4, 0.7)}

    <!-- 葉の影 -->
    ${leaf(10, 18, 1.0, 18, .5)}${leaf(52, 4, 0.8, -12, .45)}${leaf(352, 380, 0.9, 150, .38)}
    ${leaf(16, 380, 0.72, 95, .3)}${leaf(300, 470, 0.8, 205, .32)}
    <circle cx="330" cy="180" r="3" fill="#aeb49e" opacity=".5"/><circle cx="60" cy="330" r="3.2" fill="#aeb49e" opacity=".45"/>
    <circle cx="356" cy="330" r="2.6" fill="#aeb49e" opacity=".4"/><circle cx="120" cy="70" r="2.6" fill="#aeb49e" opacity=".4"/>
  </svg>`;

  // ---- 画面に差し込む(共通部品はそのまま。ほかのゲームと同じ欄だけ) ----
  document.querySelector('.stagehead h2').textContent = 'インカの黄金';
  document.querySelector('#hround').innerHTML = `<span class="hchip">ラウンド 2</span>`;
  const mt = document.querySelector('#myturn'); if (mt) mt.hidden = false;
  const av = [
    '<span class="avatar ">あ</span>',
    '<span class="dot face" style="background:#2f6fd0;color:#fff">C</span>',
    '<span class="dot face" style="background:#3d9e63;color:#fff">C</span>',
    '<span class="dot face" style="background:#d0602f;color:#fff">C</span>',
  ];
  const rows = [
    { n: 'あなた', nt: 'テントの宝石 18', turn: true },
    { n: 'CPU 1', nt: 'テントの宝石 12', turn: false },
    { n: 'CPU 2', nt: 'テントの宝石 21（帰還）', turn: false, dim: true },
    { n: 'CPU 3', nt: 'テントの宝石 9（帰還）', turn: false, dim: true },
  ];
  document.querySelector('#strip').innerHTML = rows.map((r, i) =>
    `<div class="pl ${r.turn ? 'turn' : ''}"${r.dim ? ' style="opacity:.55"' : ''}>${av[i]}<span class="who"><span class="nm">${r.n}</span><span class="nt">${r.nt}</span></span></div>`).join('');
  document.querySelector('#status').textContent = '進むか帰るか選んでください';
  // スマホでは #sidenote の欄が案内文の帯と重なって表示されるため空にし、
  // 保持中の宝石は盤の中の札に、ラウンドは #hround の札に出す(テントの宝石は #strip)。
  document.querySelector('#sidenote').innerHTML = '';
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-incangold-m'; wrap.innerHTML = `<div class="igm-wrap">${svg}</div>`;
  document.querySelector('#acts').innerHTML = `<div class="igm-acts">
    <button class="igm-btn go"><svg width="19" height="24" viewBox="0 0 21 26"><path d="M10.5 0 C13 6 17.5 8.5 17.5 14.5 A7 7 0 1 1 3.5 14.5 C3.5 8.5 8 6 10.5 0 Z" fill="#ffd23f" stroke="#b35c05" stroke-width="1.6"/><rect x="8.6" y="19" width="3.8" height="6.5" rx="1.6" fill="#7a4a16"/></svg>進む</button>
    <button class="igm-btn back"><svg width="24" height="22" viewBox="0 0 26 24"><path d="M2 21 L13 3 L24 21 Z" fill="#c96f3a" stroke="#7c3c14" stroke-width="1.6"/><path d="M13 3 L24 21 L13 21 Z" fill="#a85627"/><path d="M13 12 L18 21 L8 21 Z" fill="#4a2c10"/></svg>帰る</button>
  </div>`;
})();
