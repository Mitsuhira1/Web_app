// インカの黄金 — 盤面の見本(第 1 版・PC 版)。実際の対局画面(左上の戻る・右の側板・左下の設定は全ゲーム共通)に盤だけを差し込む。
// 場面: ラウンド 2 の探検中。カードは 宝石11 → 宝石7 → 障害(クモ) → 宝石14 → 遺物 の 5 枚がめくれ、
// 残っている探検者は あなた と CPU 1 の 2 人だけ(CPU 2・CPU 3 は帰還済み)。今まさに「進むか帰るか」を選ぶ場面。
// コア(core/games/incangold.mjs)の view が返す情報だけを描く前提。
(() => {
  const css = `
  .play-screen .boardwrap.k-incangold{display:block}
  .ig-wrap{width:100%;height:100%;box-sizing:border-box;border-radius:18px;overflow:hidden;background:#14231a}
  .ig-wrap svg{display:block;width:100%;height:100%}
  .ig-acts{display:flex;gap:16px;justify-content:center;align-items:center;padding:6px 0 2px}
  .ig-btn{display:inline-flex;align-items:center;gap:10px;font-size:20px;font-weight:800;letter-spacing:.12em;
    padding:12px 46px;border-radius:999px;cursor:pointer;border:2px solid}
  .ig-btn.go{background:linear-gradient(180deg,#ffb62e,#e07f13);border-color:#8a4d08;color:#fff8ea;
    box-shadow:0 3px 0 #8a4d08,0 6px 14px rgba(0,0,0,.28);text-shadow:0 1px 2px rgba(90,40,0,.45)}
  .ig-btn.back{background:linear-gradient(180deg,#3c7048,#26492e);border-color:#12291a;color:#eaf5e6;
    box-shadow:0 3px 0 #12291a,0 6px 14px rgba(0,0,0,.28);text-shadow:0 1px 2px rgba(0,20,5,.5)}
  .ig-btn svg{display:block}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  // ---- 小物描画ヘルパ ----
  // ターコイズの小石(多角形)。seed で形を少しずらす
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
  // 探検者トークン(色付きの丸コマ + 人型)
  const token = (cx, cy, color, dark) => `
    <ellipse cx="${cx}" cy="${cy + 17}" rx="17" ry="4.5" fill="#000" opacity=".28"/>
    <circle cx="${cx}" cy="${cy}" r="17" fill="${color}" stroke="#fff6e3" stroke-width="3.2"/>
    <circle cx="${cx}" cy="${cy}" r="13.5" fill="none" stroke="${dark}" stroke-width="1.6" opacity=".65"/>
    <circle cx="${cx}" cy="${cy - 4.5}" r="4.6" fill="#fff6e3"/>
    <path d="M ${cx - 7.5} ${cy + 9.5} Q ${cx} ${cy + 0.5} ${cx + 7.5} ${cy + 9.5} L ${cx + 7.5} ${cy + 11} L ${cx - 7.5} ${cy + 11} Z" fill="#fff6e3"/>`;

  // ---- タイル ----
  const tileBase = (cx, cy, rot, fill) => `
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <rect x="-55" y="-51" width="106" height="106" rx="15" fill="#20261f"/>
      <rect x="-53" y="-53" width="106" height="106" rx="15" fill="${fill}" stroke="#333a31" stroke-width="2.5"/>
      <rect x="-46" y="-46" width="92" height="92" rx="11" fill="none" stroke="#e8e2cc" stroke-width="1.4" opacity=".16"/>
      <ellipse cx="-30" cy="-34" rx="17" ry="8" fill="#4d7c43" opacity=".4"/>
      <ellipse cx="36" cy="38" rx="13" ry="6" fill="#3c6334" opacity=".35"/>
    </g>`;
  const gemTile = (cx, cy, rot, value, rem) => `
    ${tileBase(cx, cy, rot, 'url(#stoneGrad)')}
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      ${gem(-16, -18, 15, 1)}${gem(13, -24, 12, 2)}${gem(2, -4, 11, 3)}
      <text x="0" y="42" text-anchor="middle" font-size="35" font-weight="800" fill="#ffedb5" stroke="rgba(50,32,4,.5)" stroke-width="1.2">${value}</text>
      ${rem ? gemPile(34, 40, rem, 0.62) : ''}
    </g>`;
  const spiderTile = (cx, cy, rot) => {
    let legs = '';
    for (const s of [-1, 1]) {
      legs += `<path d="M ${s * 8} -14 Q ${s * 30} -30 ${s * 42} -40" /><path d="M ${s * 12} -4 Q ${s * 34} -12 ${s * 46} -14" />` +
        `<path d="M ${s * 12} 6 Q ${s * 34} 8 ${s * 45} 18" /><path d="M ${s * 8} 15 Q ${s * 26} 28 ${s * 34} 40" />`;
    }
    return `
    ${tileBase(cx, cy, rot, 'url(#hazGrad)')}
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <g stroke="#221612" stroke-width="5.5" fill="none" stroke-linecap="round">${legs}</g>
      <ellipse cx="0" cy="-6" rx="15.5" ry="18" fill="#2a1c16"/>
      <path d="M 0 -20 L 5 -6 L 0 2 L -5 -6 Z" fill="#c8352a"/>
      <circle cx="0" cy="13" r="9" fill="#20140f"/>
      <circle cx="-3.4" cy="11" r="1.9" fill="#ff5347"/><circle cx="3.4" cy="11" r="1.9" fill="#ff5347"/>
    </g>`;
  };
  const idol = `
    <g>
      <circle cx="0" cy="-8" r="37" fill="url(#glowGrad)"/>
      <rect x="-19" y="16" width="38" height="11" rx="2.5" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.6"/>
      <rect x="-14" y="7" width="28" height="10" rx="2" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.6"/>
      <path d="M -10 8 L -7.5 -12 Q 0 -17 7.5 -12 L 10 8 Z" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.6"/>
      <rect x="-15.5" y="-9" width="5.5" height="14" rx="2.6" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.3"/>
      <rect x="10" y="-9" width="5.5" height="14" rx="2.6" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.3"/>
      <circle cx="0" cy="-21" r="7.6" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.6"/>
      <rect x="-10" y="-32" width="20" height="6" rx="3" fill="url(#goldGrad)" stroke="#7a5210" stroke-width="1.4"/>
      <circle cx="-2.8" cy="-21" r="1.3" fill="#5d3c08"/><circle cx="2.8" cy="-21" r="1.3" fill="#5d3c08"/>
    </g>`;
  const artifactTile = (cx, cy, rot) => `
    ${tileBase(cx, cy, rot, 'url(#stoneGrad)')}
    <g transform="translate(${cx} ${cy + 2}) rotate(${rot})">${idol}</g>`;

  // ---- 葉の影 ----
  const leaf = (x, y, s, rot, op) => `
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${op}">
      <path d="M 0 0 Q 26 -20 58 -16 Q 30 8 0 0 Z" fill="#081a0e"/>
      <path d="M 2 -1 L 54 -14" stroke="#0e2c17" stroke-width="2.4" fill="none"/>
    </g>`;

  const svg = `
  <svg viewBox="0 0 880 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="インカの黄金の盤面">
    <defs>
      <radialGradient id="groundGrad" cx="42%" cy="30%" r="90%">
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

    <rect x="0" y="0" width="880" height="560" fill="url(#groundGrad)"/>
    <ellipse cx="150" cy="90" rx="180" ry="60" fill="#0c2013" opacity=".35"/>
    <ellipse cx="760" cy="500" rx="220" ry="70" fill="#0c2013" opacity=".3"/>
    <ellipse cx="430" cy="540" rx="200" ry="46" fill="#0a1c10" opacity=".3"/>

    <!-- 神殿の入口(右上・闇) -->
    <g>
      <path d="M 780 170 L 780 72 Q 826 30 880 64 L 880 170 Z" fill="url(#darkGrad)"/>
      <rect x="772" y="58" width="13" height="114" rx="4" fill="#585d4f"/>
      <path d="M 778 64 Q 826 26 882 56 L 882 72 Q 826 42 778 78 Z" fill="#6a6f5e"/>
      <rect x="792" y="96" width="58" height="7" rx="3" fill="#000" opacity=".5"/>
      <rect x="792" y="122" width="58" height="7" rx="3" fill="#000" opacity=".4"/>
    </g>

    <!-- 道(石畳) -->
    <path d="M 138 508 C 195 492 215 478 255 462 C 305 442 330 412 368 388 C 400 368 420 352 448 338 C 490 316 530 278 572 248 C 610 222 655 208 698 198 C 735 189 766 158 798 130"
      fill="none" stroke="#565a4d" stroke-width="98" stroke-linecap="round"/>
    <path d="M 138 508 C 195 492 215 478 255 462 C 305 442 330 412 368 388 C 400 368 420 352 448 338 C 490 316 530 278 572 248 C 610 222 655 208 698 198 C 735 189 766 158 798 130"
      fill="none" stroke="#757a68" stroke-width="80" stroke-linecap="round"/>
    <ellipse cx="312" cy="428" rx="21" ry="13" fill="#83887a" transform="rotate(-35 312 428)"/>
    <ellipse cx="408" cy="362" rx="19" ry="12" fill="#83887a" transform="rotate(-20 408 362)"/>
    <ellipse cx="512" cy="292" rx="19" ry="12" fill="#83887a" transform="rotate(-40 512 292)"/>
    <ellipse cx="636" cy="224" rx="18" ry="11" fill="#83887a" transform="rotate(-25 636 224)"/>
    <!-- 次のタイル(裏向き) -->
    <g transform="translate(764 134) rotate(7)">
      <rect x="-40" y="-40" width="80" height="80" rx="12" fill="#4c5044" stroke="#2c3028" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="17" fill="none" stroke="#c9c2a4" stroke-width="2.4" opacity=".5"/>
      <circle cx="0" cy="0" r="6" fill="#c9c2a4" opacity=".5"/>
    </g>

    <!-- めくられたカード -->
    ${gemTile(255, 462, -3, 11, 3)}
    ${gemTile(368, 388, 2, 7, 2)}
    ${spiderTile(448, 338, -2)}
    ${gemTile(572, 248, 3, 14, 3)}
    ${artifactTile(698, 198, -2)}

    <!-- 探検者(最新のカードの脇) -->
    ${token(652, 296, '#e8a91c', '#8a5f06')}
    ${gemPile(622, 310, 5, 0.8)}
    ${token(758, 292, '#2f6fd0', '#173f7d')}
    ${gemPile(788, 306, 4, 0.8)}

    <!-- キャンプ(入口・左下) -->
    <g>
      <ellipse cx="105" cy="540" rx="95" ry="13" fill="#000" opacity=".22"/>
      <path d="M 38 522 L 100 448 L 162 522 Z" fill="#b4552d"/>
      <path d="M 100 448 L 162 522 L 100 522 Z" fill="#96431f"/>
      <path d="M 100 478 L 126 522 L 74 522 Z" fill="#5d3418"/>
      <path d="M 100 478 L 126 522 L 100 522 Z" fill="#472708"/>
      <rect x="97.5" y="428" width="5" height="24" fill="#6d4a26"/>
      <path d="M 102 430 L 126 436 L 102 443 Z" fill="#d8b13a"/>
      <!-- 宝石袋 -->
      <path d="M 168 540 C 152 516 156 498 170 492 C 166 484 172 478 178 480 C 184 478 190 484 186 492 C 200 498 204 516 188 540 Z" fill="#8a6a38" stroke="#5f451f" stroke-width="2"/>
      <ellipse cx="178" cy="493" rx="10" ry="4" fill="#5f451f"/>
      ${gem(163, 512, 6.5, 2)}${gem(178, 522, 7.5, 4)}${gem(192, 511, 6, 1)}${gem(186, 533, 6, 3)}
    </g>
    ${token(52, 470, '#3d9e63', '#1d5c36')}
    ${token(184, 478, '#d0602f', '#7d3410')}
    ${gemPile(76, 492, 4, 0.75)}
    ${gemPile(224, 530, 4, 0.75)}

    <!-- 葉の影 -->
    ${leaf(18, 26, 1.15, 18, .5)}${leaf(70, 8, 0.9, -12, .45)}${leaf(846, 300, 1.05, 155, .4)}
    ${leaf(806, 540, 1.2, 190, .45)}${leaf(30, 300, 0.8, 95, .32)}${leaf(560, 18, 0.85, 30, .3)}
    <circle cx="330" cy="90" r="3.2" fill="#aeb49e" opacity=".5"/><circle cx="520" cy="470" r="3.6" fill="#aeb49e" opacity=".45"/>
    <circle cx="90" cy="180" r="2.8" fill="#aeb49e" opacity=".4"/><circle cx="700" cy="420" r="3" fill="#aeb49e" opacity=".4"/>
  </svg>`;

  // ---- 画面に差し込む(共通部品はそのまま。ゲーム名・ラウンド札・側板の中身だけ、ほかのゲームと同じ欄に入れる) ----
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
  document.querySelector('#sidenote').innerHTML =
    `<div class="kv"><span>この探検で保持中（あなた）</span><b class="num">9 個</b></div>` +
    `<div class="kv"><span>ラウンド</span><b class="num">2 / 5</b></div>`;
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-incangold'; wrap.innerHTML = `<div class="ig-wrap">${svg}</div>`;
  document.querySelector('#acts').innerHTML = `<div class="ig-acts">
    <button class="ig-btn go"><svg width="21" height="26" viewBox="0 0 21 26"><path d="M10.5 0 C13 6 17.5 8.5 17.5 14.5 A7 7 0 1 1 3.5 14.5 C3.5 8.5 8 6 10.5 0 Z" fill="#ffd23f" stroke="#b35c05" stroke-width="1.6"/><rect x="8.6" y="19" width="3.8" height="6.5" rx="1.6" fill="#7a4a16"/></svg>進む</button>
    <button class="ig-btn back"><svg width="26" height="24" viewBox="0 0 26 24"><path d="M2 21 L13 3 L24 21 Z" fill="#c96f3a" stroke="#7c3c14" stroke-width="1.6"/><path d="M13 3 L24 21 L13 21 Z" fill="#a85627"/><path d="M13 12 L18 21 L8 21 Z" fill="#4a2c10"/></svg>帰る</button>
  </div>`;
})();
