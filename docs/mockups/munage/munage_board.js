// 胸毛絶体絶命 — 盤面の見本。実際の対局画面(左上の戻る・右の側板・左下の設定)に盤だけを差し込む。
(() => {
  const N = 12;
  // ---- 乱数(見た目を毎回同じにする) ----
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---- 胸毛: 小さな丸を重ねたふさふさの塊と、縁の巻き毛 ----
  function chestHair(seed, scale = 1) {
    const r = rng(seed);
    const inside = (x, y) => {
      // 左右の胸(楕円 2 つ)と、へそへ向かう細い帯
      const pec = (cx) => ((x - cx) / 27) ** 2 + ((y + 58) / 19) ** 2 < 1;
      const trail = Math.abs(x) < 9 - (y + 30) * 0.08 && y > -48 && y < 14;
      return pec(-20) || pec(20) || trail;
    };
    let dots = '', curls = '';
    for (let i = 0; i < 260 && dots.length < 9000; i++) {
      const x = (r() - .5) * 100, y = -82 + r() * 98;
      if (!inside(x, y)) continue;
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5 + r() * 3.2).toFixed(1)}"/>`;
    }
    for (let i = 0; i < 400 && curls.split('M').length < 46; i++) {
      const x = (r() - .5) * 104, y = -86 + r() * 104;
      if (!inside(x, y)) continue;
      const s = 3 + r() * 2.6, a = r() * 6.28, c = Math.cos(a), n = Math.sin(a);
      const P = (u, v) => `${(x + u * c - v * n).toFixed(1)} ${(y + u * n + v * c).toFixed(1)}`;
      curls += `M${P(-s, 0)}C${P(-s, -s * 1.4)} ${P(s, -s * 1.4)} ${P(s * .5, 0)}S${P(-s * .3, s * .5)} ${P(0, -s * .2)}`;
    }
    return `<g transform="scale(${scale})"><g fill="#3b2415">${dots}</g>
      <path d="${curls}" fill="none" stroke="#6e4428" stroke-width="1.5" stroke-linecap="round"/></g>`;
  }

  // ---- おっさんの頭(共通) ----
  function head(scream) {
    return `<g class="mn-head">
      <ellipse cx="-45" cy="-126" rx="9" ry="12" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
      <ellipse cx="45" cy="-126" rx="9" ry="12" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
      <ellipse cx="0" cy="-128" rx="44" ry="47" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.8"/>
      <!-- 横の髪 -->
      <path d="M-44 -120 C-50 -140 -44 -156 -36 -162 C-38 -146 -36 -134 -32 -124 Z M44 -120 C50 -140 44 -156 36 -162 C38 -146 36 -134 32 -124 Z" fill="#3a2a22"/>
      <!-- 頭の照り -->
      <ellipse cx="-16" cy="-160" rx="15" ry="7" fill="#fff" opacity=".5" transform="rotate(-18 -16 -160)"/>
      <!-- バーコード(3 本) -->
      <path d="M-30 -158 C-12 -172 14 -172 32 -156 M-32 -150 C-10 -166 16 -166 34 -148 M-28 -165 C-8 -177 12 -176 26 -164" fill="none" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/>
      <!-- あごの青み -->
      <path d="M-30 -100 C-22 -84 22 -84 30 -100 C20 -90 -20 -90 -30 -100 Z" fill="#8ea0b2" opacity=".35"/>
      <!-- 眉(困り) -->
      <path d="M-34 -140 C-26 -150 -14 -150 -6 -145" fill="none" stroke="#2b1c14" stroke-width="7" stroke-linecap="round" transform="rotate(${scream ? 18 : 12} -20 -146)"/>
      <path d="M34 -140 C26 -150 14 -150 6 -145" fill="none" stroke="#2b1c14" stroke-width="7" stroke-linecap="round" transform="rotate(${scream ? -18 : -12} 20 -146)"/>
      ${scream
        ? `<path d="M-28 -130 L-14 -124 L-28 -118 M28 -130 L14 -124 L28 -118" fill="none" stroke="#2b1c14" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<ellipse cx="-17" cy="-125" rx="10" ry="11.5" fill="#fff" stroke="#2b1c14" stroke-width="2"/><ellipse cx="17" cy="-125" rx="10" ry="11.5" fill="#fff" stroke="#2b1c14" stroke-width="2"/>
           <circle cx="-12" cy="-123" r="3.6" fill="#2b1c14"/><circle cx="22" cy="-123" r="3.6" fill="#2b1c14"/>`}
      <ellipse cx="0" cy="-109" rx="10" ry="8.5" fill="#e79d77" stroke="#6a3c22" stroke-width="2"/>
      <ellipse cx="-3" cy="-112" rx="3" ry="2" fill="#fff" opacity=".6"/>
      <ellipse cx="-30" cy="-106" rx="8" ry="5" fill="#f2806f" opacity=".45"/><ellipse cx="30" cy="-106" rx="8" ry="5" fill="#f2806f" opacity=".45"/>
      ${scream
        ? `<ellipse cx="0" cy="-84" rx="13" ry="12" fill="#6d1c17" stroke="#2b1c14" stroke-width="2.2"/><ellipse cx="0" cy="-79" rx="7" ry="4" fill="#e0675c"/>`
        : `<path d="M-10 -88 Q-5 -92 0 -88 T10 -88" fill="none" stroke="#2b1c14" stroke-width="2.6" stroke-linecap="round"/>`}
      <!-- 八の字のひげ -->
      <path d="M0 -101 C-10 -106 -24 -104 -34 -96 C-42 -90 -50 -92 -52 -100 C-54 -86 -40 -82 -28 -88 C-18 -93 -8 -94 0 -92 C8 -94 18 -93 28 -88 C40 -82 54 -86 52 -100 C50 -92 42 -90 34 -96 C24 -104 10 -106 0 -101 Z" fill="#2b1c14"/>
      <path d="M-22 -99 C-14 -101 -8 -100 -3 -98" stroke="#6b5040" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <!-- 汗 -->
      <g class="mn-sweat" fill="#9fdcff" stroke="#3d8ec5" stroke-width="1.4">
        <path d="M50 -150 q7 11 0 15 q-7 -4 0 -15z"/><path d="M-54 -142 q5 8 0 11 q-5 -3 0 -11z"/>
      </g>
    </g>`;
  }
  function torso() {
    return `<path d="M-72 30 C-80 -20 -78 -62 -58 -78 C-40 -90 40 -90 58 -78 C78 -62 80 -20 72 30 Z" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.8"/>
      <path d="M-16 -86 h32 v-10 h-32 z" fill="url(#mnSkin)"/>
      <path d="M-50 -30 C-30 -18 30 -18 50 -30" fill="none" stroke="#cf8e66" stroke-width="2" opacity=".7"/>
      ${chestHair(11)}`;
  }

  // ---- 盤の中のおっさん(腕で口の縁につかまる) ----
  const manInCannon = `
    <g class="mn-arm"><path d="M-62 -66 C-96 -54 -112 -22 -104 6" fill="none" stroke="#6a3c22" stroke-width="27" stroke-linecap="round"/>
      <path d="M-62 -66 C-96 -54 -112 -22 -104 6" fill="none" stroke="url(#mnSkin)" stroke-width="22" stroke-linecap="round"/></g>
    <g class="mn-arm"><path d="M62 -66 C96 -54 112 -22 104 6" fill="none" stroke="#6a3c22" stroke-width="27" stroke-linecap="round"/>
      <path d="M62 -66 C96 -54 112 -22 104 6" fill="none" stroke="url(#mnSkin)" stroke-width="22" stroke-linecap="round"/></g>
    ${torso()}${head(false)}`;
  // 縁をつかむ手(口の縁より手前に描く)
  const hands = [-1, 1].map(s => `<g transform="translate(${s * 104} 8) scale(${s} 1)">
      <path d="M-14 -6 C-16 6 -10 16 0 16 C10 16 16 8 14 -6 C8 -12 -8 -12 -14 -6 Z" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
      <path d="M-8 4 v8 M-2 5 v9 M4 4 v8" stroke="#b9754f" stroke-width="1.8" stroke-linecap="round"/></g>`).join('');

  // ---- 飛ぶおっさん(全身・叫ぶ) ----
  const flyer = `<svg class="mn-flyer" viewBox="-130 -200 260 380" aria-hidden="true">${defs()}
    <g fill="none" stroke-linecap="round">
      <path d="M-28 70 C-48 100 -78 112 -96 136" stroke="#6a3c22" stroke-width="27"/><path d="M-28 70 C-48 100 -78 112 -96 136" stroke="url(#mnSkin)" stroke-width="22"/>
      <path d="M28 70 C44 108 46 132 70 154" stroke="#6a3c22" stroke-width="27"/><path d="M28 70 C44 108 46 132 70 154" stroke="url(#mnSkin)" stroke-width="22"/>
      <path d="M-62 -66 C-96 -96 -100 -130 -92 -164" stroke="#6a3c22" stroke-width="27"/><path d="M-62 -66 C-96 -96 -100 -130 -92 -164" stroke="url(#mnSkin)" stroke-width="22"/>
      <path d="M62 -66 C100 -80 116 -110 120 -144" stroke="#6a3c22" stroke-width="27"/><path d="M62 -66 C100 -80 116 -110 120 -144" stroke="url(#mnSkin)" stroke-width="22"/>
    </g>
    <ellipse cx="-102" cy="142" rx="16" ry="9" transform="rotate(-40 -102 142)" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
    <ellipse cx="78" cy="160" rx="16" ry="9" transform="rotate(30 78 160)" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
    <circle cx="-92" cy="-170" r="13" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/><circle cx="121" cy="-150" r="13" fill="url(#mnSkin)" stroke="#6a3c22" stroke-width="2.4"/>
    ${torso()}
    <!-- しま模様のパンツ -->
    <path d="M-72 22 C-74 50 -66 76 -54 88 L-6 84 L0 70 L6 84 L54 88 C66 76 74 50 72 22 C40 30 -40 30 -72 22 Z" fill="#f6efe2" stroke="#6a3c22" stroke-width="2.6"/>
    <path d="M-60 28 L-56 86 M-36 32 L-34 86 M-12 33 L-8 76 M12 33 L8 76 M36 32 L34 86 M60 28 L56 86" stroke="#c8362e" stroke-width="7"/>
    <path d="M-72 22 C-40 30 40 30 72 22 L72 30 C40 38 -40 38 -72 30 Z" fill="#2f5fd0"/>
    ${head(true)}</svg>`;

  function defs() {
    return `<defs>
      <linearGradient id="mnSkin" x1="0" x2="1" y1="0" y2=".4"><stop stop-color="#ffd9b8"/><stop offset=".55" stop-color="#f2bc93"/><stop offset="1" stop-color="#d9976e"/></linearGradient>
    </defs>`;
  }

  // ---- 盤(フェルトの卓・臼砲・操作盤) ----
  const brassBands = (y, w) => `<path d="M${500 - w} ${y} A${w} ${w * .27} 0 0 0 ${500 + w} ${y} L${500 + w} ${y + 13} A${w} ${w * .27} 0 0 1 ${500 - w} ${y + 13} Z" fill="url(#mnBrassH)" stroke="#5a3c16" stroke-width="1.6"/>`;
  const board = `<div class="mn-board" style="--n:${N}">
    <svg class="mn-scene" viewBox="0 0 1000 690" aria-hidden="true">
      ${defs()}
      <defs>
        <linearGradient id="mnWalnut" x2="0" y2="1"><stop stop-color="#8a5c39"/><stop offset=".5" stop-color="#6b4429"/><stop offset="1" stop-color="#4d2f1b"/></linearGradient>
        <radialGradient id="mnFelt" cx=".45" cy=".35" r=".8"><stop stop-color="#2f7553"/><stop offset=".7" stop-color="#235c41"/><stop offset="1" stop-color="#1a4834"/></radialGradient>
        <linearGradient id="mnIron" x1="0" x2="1"><stop stop-color="#2a2e33"/><stop offset=".18" stop-color="#6c747e"/><stop offset=".3" stop-color="#9aa3ad"/><stop offset=".48" stop-color="#4b5159"/><stop offset=".85" stop-color="#23262a"/><stop offset="1" stop-color="#15171a"/></linearGradient>
        <linearGradient id="mnBrassH" x1="0" x2="1"><stop stop-color="#6b4a1c"/><stop offset=".2" stop-color="#e9c77a"/><stop offset=".35" stop-color="#fff0c0"/><stop offset=".55" stop-color="#b78a3f"/><stop offset="1" stop-color="#5d3f15"/></linearGradient>
        <linearGradient id="mnWood" x2="0" y2="1"><stop stop-color="#b98952"/><stop offset="1" stop-color="#7d5430"/></linearGradient>
        <linearGradient id="mnWoodTop" x2="0" y2="1"><stop stop-color="#d4a86f"/><stop offset="1" stop-color="#b98952"/></linearGradient>
        <filter id="mnBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="mnFeltTex"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <clipPath id="mnMouthBack"><path d="M380 -40 H620 V186 A110 29 0 0 1 390 186 Z"/></clipPath>
      </defs>
      <!-- 卓 -->
      <rect x="4" y="4" width="992" height="682" rx="44" fill="url(#mnWalnut)"/>
      <rect x="4" y="4" width="992" height="682" rx="44" fill="none" stroke="#ffffff26" stroke-width="2"/>
      <rect x="26" y="26" width="948" height="638" rx="28" fill="url(#mnFelt)"/>
      <rect x="26" y="26" width="948" height="638" rx="28" fill="#000" filter="url(#mnFeltTex)"/>
      <rect x="26" y="26" width="948" height="638" rx="28" fill="none" stroke="#0e2a1e" stroke-opacity=".55" stroke-width="6"/>
      <!-- 導火線(操作盤から大砲へ) -->
      <path class="mn-fuse" d="M500 528 C500 488 590 482 626 452 C650 432 640 400 618 372" fill="none" stroke="#3b2a1c" stroke-width="7" stroke-linecap="round" opacity=".55" transform="translate(4 5)"/>
      <path class="mn-fuse" d="M500 528 C500 488 590 482 626 452 C650 432 640 400 618 372" fill="none" stroke="#b08a5a" stroke-width="6" stroke-linecap="round"/>
      <path class="mn-fuse" d="M500 528 C500 488 590 482 626 452 C650 432 640 400 618 372" fill="none" stroke="#7a5a35" stroke-width="6" stroke-dasharray="3 6" stroke-linecap="round"/>
      <path class="mn-burn" d="M500 528 C500 488 590 482 626 452 C650 432 640 400 618 372" fill="none" stroke="#ffcf4a" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="0 1"/>
      <!-- 影(光は左上) -->
      <ellipse cx="528" cy="452" rx="196" ry="44" fill="#000" opacity=".38" filter="url(#mnBlur)"/>
      <g class="mn-cannon">
        <!-- 台(木の丸台) -->
        <ellipse cx="500" cy="438" rx="180" ry="40" fill="#5a3a21"/>
        <rect x="320" y="412" width="360" height="26" fill="url(#mnWood)"/>
        <ellipse cx="500" cy="412" rx="180" ry="40" fill="url(#mnWoodTop)" stroke="#8a6238" stroke-width="2"/>
        <ellipse cx="500" cy="412" rx="150" ry="31" fill="none" stroke="#a87b48" stroke-width="1.5" opacity=".7"/>
        <!-- 砲床 -->
        <path d="M372 336 L628 336 L640 400 L360 400 Z" fill="url(#mnWood)" stroke="#5a3a21" stroke-width="2.4"/>
        <path d="M384 318 L616 318 L628 336 L372 336 Z" fill="url(#mnWoodTop)" stroke="#5a3a21" stroke-width="2"/>
        <rect x="402" y="336" width="14" height="64" fill="#3d4248"/><rect x="584" y="336" width="14" height="64" fill="#3d4248"/>
        ${[409, 591].map(x => `<circle cx="${x}" cy="352" r="3.4" fill="#c9cdd2"/><circle cx="${x}" cy="384" r="3.4" fill="#c9cdd2"/>`).join('')}
        <!-- 砲身(臼砲) -->
        <path d="M404 340 C376 312 378 270 394 246 C404 230 414 218 418 196 L582 196 C586 218 596 230 606 246 C622 270 624 312 596 340 Z" fill="url(#mnIron)" stroke="#121417" stroke-width="2.6"/>
        ${brassBands(298, 112)}${brassBands(236, 96)}
        <circle cx="388" cy="300" r="15" fill="url(#mnBrassH)" stroke="#5a3c16" stroke-width="2"/><circle cx="612" cy="300" r="15" fill="url(#mnBrassH)" stroke="#5a3c16" stroke-width="2"/>
        <!-- 口(奥) -->
        <ellipse cx="500" cy="186" rx="110" ry="29" fill="url(#mnIron)" stroke="#121417" stroke-width="2.6"/>
        <ellipse cx="500" cy="188" rx="90" ry="21" fill="#0c0a09"/>
        <!-- おっさん -->
        <g clip-path="url(#mnMouthBack)"><g class="mn-man"><g transform="translate(500 192) scale(.9)">${manInCannon}</g></g></g>
        <!-- 口の手前の縁 -->
        <path d="M390 186 A110 29 0 0 0 610 186 L610 200 A110 29 0 0 1 390 200 Z" fill="url(#mnBrassH)" stroke="#5a3c16" stroke-width="2"/>
        <path d="M410 190 A90 21 0 0 0 590 190" fill="none" stroke="#0c0a09" stroke-width="3"/>
        <g class="mn-man mn-hands"><g transform="translate(500 192) scale(.9)">${hands}</g></g>
      </g>
      <!-- 操作盤 -->
      <rect x="112" y="532" width="776" height="112" rx="22" fill="#000" opacity=".35" filter="url(#mnBlur)" transform="translate(8 8)"/>
      <rect x="112" y="528" width="776" height="112" rx="22" fill="url(#mnWalnut)" stroke="url(#mnBrassH)" stroke-width="5"/>
      <rect x="126" y="542" width="748" height="84" rx="14" fill="none" stroke="#2c1a0e" stroke-opacity=".5" stroke-width="2"/>
      <rect x="404" y="512" width="192" height="30" rx="8" fill="#f1e6cc" stroke="url(#mnBrassH)" stroke-width="3"/>
      <text x="500" y="533" text-anchor="middle" font-size="17" font-weight="900" fill="#4a3020" font-family="Zen Maru Gothic, sans-serif">点火スイッチは 1 つ</text>
    </svg>
    <div class="mn-buttons">${Array.from({length: N}, (_, i) => `<button type="button" class="mn-btn" data-mn="${i}" aria-label="ボタン ${i + 1}"><i></i><span>${i + 1}</span></button>`).join('')}</div>
  </div>`;

  const css = `
  .play-screen .boardwrap.k-munage{display:grid;place-items:center}
  .mn-board{position:relative;width:min(100%,calc(100cqh * 1000 / 690));aspect-ratio:1000/690;container-type:size}
  .mn-scene{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .mn-buttons{position:absolute;left:13.6%;right:13.6%;top:79.4%;height:12.4%;display:grid;grid-template-columns:repeat(var(--n),1fr);align-items:center;justify-items:center}
  .mn-btn{position:relative;width:min(88%,10.6cqh);aspect-ratio:1;padding:0;border:0;border-radius:50%;cursor:pointer;
    background:conic-gradient(from 210deg,#6b4a1c,#f6dc97,#b78a3f,#5d3f15,#e9c77a,#6b4a1c);box-shadow:0 2px 3px #0008,inset 0 0 0 1px #3a250c}
  .mn-btn::before{content:"";position:absolute;inset:13%;border-radius:50%;background:#1b120b;box-shadow:inset 0 2px 3px #000}
  .mn-btn i{position:absolute;inset:18%;border-radius:50%;transform:translateY(-14%);transition:transform .09s ease-out,box-shadow .09s,background .12s;
    background:radial-gradient(circle at 34% 28%,#ffb3a6 0 9%,#f0493a 30%,#b81d14 70%,#86100a);
    box-shadow:0 .55cqh 0 #6a0b06,0 .8cqh 3px #000a,inset 0 -2px 3px #0005}
  .mn-btn span{position:absolute;left:50%;top:104%;transform:translateX(-50%);font:900 max(10px,2.3cqh)/1 var(--font);color:#f3e3c2;text-shadow:0 1px 1px #0009;pointer-events:none}
  .mn-btn:hover:not(.on) i{filter:brightness(1.1)}
  .mn-btn:focus-visible{outline:3px solid var(--mark);outline-offset:2px}
  .mn-btn.on{cursor:default}
  .mn-btn.on i{transform:translateY(0);background:radial-gradient(circle at 34% 28%,#d6ffc8 0 9%,#4fca5c 30%,#21913a 70%,#136326);box-shadow:0 .1cqh 0 #0e4d1b,0 .2cqh 2px #0009,inset 0 2px 3px #0006}
  .mn-btn.bad i{background:radial-gradient(circle at 34% 28%,#fff 0 9%,#ffd34a 30%,#e09a00 70%,#a86a00)}
  .mn-sweat{animation:mnSweat 1.8s ease-in infinite}
  @keyframes mnSweat{0%{transform:translateY(0);opacity:0}25%{opacity:1}100%{transform:translateY(14px);opacity:0}}
  .mn-man{animation:mnFidget 2.6s ease-in-out infinite;transform-origin:500px 200px}
  @keyframes mnFidget{50%{transform:translateY(3px)}}
  .mn-cannon.shake{animation:mnShake .07s linear infinite;transform-origin:500px 420px}
  @keyframes mnShake{0%{transform:translate(-2px,0) rotate(-.6deg)}50%{transform:translate(2px,-1px) rotate(.6deg)}100%{transform:translate(-1px,1px)}}
  .mn-board.fired .mn-man{visibility:hidden}
  /* 全画面の打ち上げ */
  .mn-launch{position:fixed;inset:0;z-index:900;pointer-events:none;overflow:hidden;container-type:size}
  .mn-launch .mn-sky{position:absolute;inset:0;opacity:0;background:linear-gradient(#0b1840 0%,#1d3f86 35%,#4f8fd6 70%,#9fd2f2 100%)}
  .mn-launch .mn-cloud{position:absolute;width:30cqw;height:9cqh;border-radius:999px;background:#fff;opacity:.9;filter:blur(1px)}
  .mn-launch .mn-cloud::before{content:"";position:absolute;left:18%;bottom:30%;width:46%;height:150%;border-radius:50%;background:#fff}
  .mn-launch .mn-line{position:absolute;width:2px;height:18cqh;background:linear-gradient(#fff0,#fffc,#fff0)}
  .mn-launch .mn-flyer{position:absolute;left:0;top:0;transform-origin:50% 50%}
  .mn-launch .mn-flash{position:absolute;border-radius:50%;background:radial-gradient(#fff 0 18%,#ffe27a 34%,#ff8a2b 52%,#ff8a2b00 70%)}
  .mn-launch .mn-smoke{position:absolute;border-radius:50%;background:radial-gradient(#f4f1ec,#cfc9c0 58%,#cfc9c000 72%)}
  .mn-launch .mn-star{position:absolute;left:50%;top:17%;width:11cqh;height:11cqh;margin:-5.5cqh 0 0 -5.5cqh;background:#fffbe0;
    clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);filter:drop-shadow(0 0 10px #ffe56a);opacity:0}
  .mn-launch .mn-kira{position:absolute;left:50%;top:26%;transform:translateX(-50%);font-family:"Dela Gothic One",var(--font);font-size:6cqh;color:#fff7b8;text-shadow:0 0 14px #ffd23f;opacity:0;white-space:nowrap}
  .mn-launch .cutin{pointer-events:auto}
  `;

  // ---- 画面に差し込む ----
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  document.querySelector('.stagehead h2').textContent = '胸毛絶体絶命';
  const hround = document.querySelector('#hround');
  hround.innerHTML = '<span class="hchip">ボタン 12 個</span>';
  const names = ['あなた', 'CPU 1', 'CPU 2'];
  let turn = 0, over = false, pressed = 0;
  const bad = window.MN_BAD ?? 7;
  const strip = () => {
    const av = ['<span class="avatar ">あ</span>', '<span class="dot face">C</span>', '<span class="dot face" style="background:#2f5fd0;color:#fff">C</span>'];
    document.querySelector('#strip').innerHTML = names.map((n, i) => `<div class="pl ${i === turn && !over ? 'turn' : ''}">${av[i]}<span class="who"><span class="nm">${n}</span><span class="nt">${i === turn && !over ? 'ボタンを選ぶ' : i === 0 ? '' : 'CPU 中級'}</span></span></div>`).join('');
    document.querySelector('#status').textContent = over ? `${names[turn]}が点火スイッチを押した!` : turn === 0 ? 'ボタンを 1 つ押してください' : `${names[turn]}が選んでいます…`;
    document.querySelector('#sidenote').innerHTML = `<div class="kv"><span>押したボタン</span><b class="num">${pressed} / ${N}</b></div>`;
  };
  const wrap = document.querySelector('#boardwrap');
  wrap.onclick = null; wrap.className = 'boardwrap k-munage'; wrap.innerHTML = board;
  document.querySelector('#acts').innerHTML = '';
  const root = wrap.querySelector('.mn-board');
  strip();
  for (const i of window.MN_PRESSED || []) { root.querySelector(`[data-mn="${i}"]`).classList.add('on'); pressed++; }
  strip();

  function press(i) {
    const b = root.querySelector(`[data-mn="${i}"]`);
    if (over || b.classList.contains('on')) return;
    b.classList.add('on'); pressed++;
    if (i === bad) return fire();
    turn = (turn + 1) % names.length; strip();
    if (turn) setTimeout(() => { const left = [...root.querySelectorAll('.mn-btn:not(.on)')]; press(+left[Math.floor(Math.random() * left.length)].dataset.mn); }, 900);
  }
  root.addEventListener('click', e => { const b = e.target.closest('.mn-btn'); e.stopPropagation(); if (b && turn === 0) press(+b.dataset.mn); }, true);

  function fire() {
    over = true; strip();
    root.querySelector(`[data-mn="${bad}"]`).classList.add('bad');
    const burn = root.querySelector('.mn-burn');
    burn.animate([{strokeDasharray: '0 1'}, {strokeDasharray: '1 0'}], {duration: 650, fill: 'forwards', easing: 'ease-in'});
    const cannon = root.querySelector('.mn-cannon');
    setTimeout(() => cannon.classList.add('shake'), 450);
    setTimeout(launch, 1050);
  }

  function launch() {
    const cannon = root.querySelector('.mn-cannon');
    cannon.classList.remove('shake');
    // おっさんの今の位置(画面の座標)から飛ばす
    const man = root.querySelector('.mn-man').getBoundingClientRect();
    const mouth = root.querySelector('.mn-cannon ellipse[rx="90"]').getBoundingClientRect();
    root.classList.add('fired');
    const L = document.createElement('div'); L.className = 'mn-launch';
    const W = innerWidth, H = innerHeight;
    L.innerHTML = `<div class="mn-sky"></div>
      ${Array.from({length: 7}, (_, i) => `<div class="mn-cloud" style="left:${(i * 37) % 90 - 8}%;top:-20%"></div>`).join('')}
      ${Array.from({length: 14}, (_, i) => `<div class="mn-line" style="left:${(i * 53) % 97 + 1}%;top:-25%"></div>`).join('')}
      <div class="mn-flash"></div>${'<div class="mn-smoke"></div>'.repeat(5)}
      ${flyer}<div class="mn-smoke mn-front"></div><div class="mn-star"></div><div class="mn-kira">キラーン</div><div class="mn-cut"></div>`;
    document.body.append(L);
    const fl = L.querySelector('.mn-flyer');
    // 飛ぶ絵は 260×380。盤のおっさん(腰から上)と同じ大きさから始める
    const k = root.getBoundingClientRect().width / 1000 * .9;
    const h0 = 380 * k, w0 = 260 * k;
    Object.assign(fl.style, {width: w0 + 'px', height: h0 + 'px'});
    // 飛ぶ絵の腰(viewBox の y=20)を口の高さに
    const cx = mouth.x + mouth.width / 2, cy = mouth.y + mouth.height / 2 - (20 - -10) * k;
    const at = (x, y, s, r) => `translate(${x - w0 / 2}px, ${y - h0 / 2}px) rotate(${r}deg) scale(${s})`;
    // 閃光と煙
    const flash = L.querySelector('.mn-flash'), d = mouth.width * 2.4;
    Object.assign(flash.style, {left: cx - d / 2 + 'px', top: mouth.y + mouth.height / 2 - d / 2 + 'px', width: d + 'px', height: d + 'px'});
    flash.animate([{transform: 'scale(.1)', opacity: 1}, {transform: 'scale(1.2)', opacity: 0}], {duration: 420, easing: 'ease-out', fill: 'forwards'});
    const front = L.querySelector('.mn-front'), fr = mouth.width * 1.3;
    Object.assign(front.style, {left: cx - fr / 2 + 'px', top: mouth.y + mouth.height / 2 - fr * .45 + 'px', width: fr + 'px', height: fr * .7 + 'px'});
    front.animate([{opacity: 1, transform: 'scale(.6)'}, {opacity: 1, transform: 'scale(1.1)', offset: .5}, {opacity: 0, transform: 'scale(1.4) translateY(-20%)'}], {duration: 700, fill: 'forwards'});
    L.querySelectorAll('.mn-smoke:not(.mn-front)').forEach((s, i) => {
      const r = mouth.width * (.7 + i * .12), a = (i - 2) * .55;
      Object.assign(s.style, {left: cx - r / 2 + 'px', top: mouth.y - r / 2 + 'px', width: r + 'px', height: r + 'px'});
      s.animate([{transform: 'translate(0,0) scale(.3)', opacity: .95}, {transform: `translate(${Math.sin(a) * r * 1.1}px, ${-Math.cos(a) * r * .9 - 20}px) scale(1.6)`, opacity: 0}],
        {duration: 1300 + i * 120, easing: 'ease-out', fill: 'forwards'});
    });
    // おっさん: 盤から勢いよく上へ(大きくなりながら)→ 空で回りながら遠ざかる
    fl.animate([
      {transform: at(cx, cy, 1, 0), offset: 0},
      {transform: at(cx, cy - h0 * .9, 1.15, -8), offset: .07},
      {transform: at(W * .5 + (cx - W * .5) * .4, H * .32, 1.6, -60), offset: .22, easing: 'ease-in-out'},
      {transform: at(W * .5, H * .3, 1.2, -400), offset: .45},
      {transform: at(W * .5, H * .17, .03, -1260), offset: 1},
    ], {duration: 2500, easing: 'cubic-bezier(.25,.7,.4,1)', fill: 'forwards'});
    // 空(全画面)と流れる雲
    L.querySelector('.mn-sky').animate([{opacity: 0}, {opacity: 1}], {delay: 380, duration: 320, fill: 'forwards'});
    L.querySelectorAll('.mn-cloud').forEach((c, i) => c.animate([{transform: 'translateY(0)'}, {transform: `translateY(${H * 1.6}px)`}],
      {delay: 450 + i * 260, duration: 900, iterations: 2, easing: 'linear'}));
    L.querySelectorAll('.mn-line').forEach((c, i) => c.animate([{transform: 'translateY(0)', opacity: 1}, {transform: `translateY(${H * 1.5}px)`, opacity: 1}],
      {delay: 420 + (i * 137) % 900, duration: 420, iterations: 3, easing: 'linear'}));
    // キラーン
    L.querySelector('.mn-star').animate([{transform: 'scale(0) rotate(0)', opacity: 1}, {transform: 'scale(1.6) rotate(90deg)', opacity: 1, offset: .5}, {transform: 'scale(1) rotate(135deg)', opacity: 1}],
      {delay: 2450, duration: 600, fill: 'forwards'});
    L.querySelector('.mn-kira').animate([{transform: 'translateX(-50%) scale(0)', opacity: 1}, {transform: 'translateX(-50%) scale(1)', opacity: 1}],
      {delay: 2550, duration: 420, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'forwards'});
    // カットイン(アプリの .cutin と同じ作り。赤)
    setTimeout(() => {
      L.querySelector('.mn-cut').outerHTML = `<button class="cutin red f-mo tall" tabindex="-1"><span class="veil"></span><span class="band"></span><span class="txt"><span class="mainl" style="font-size:min(12cqh,13cqw)">ゲームオーバー</span><small>${names[turn]}の負け</small></span></button>`;
    }, 3300);
  }
  window.MN_FIRE = () => press(bad);
})();
