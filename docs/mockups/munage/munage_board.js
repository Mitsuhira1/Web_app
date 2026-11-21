// 胸毛絶体絶命 — 盤面の見本(第 3 版)。実際の対局画面(左上の戻る・右の側板・左下の設定)に盤だけを差し込む。
// 盤: サーカスの舞台に、太鼓の台に載せた臼砲(中におっさん)。下に 24 個のボタン(2 段)。
// 外れを押すと、黒帯つきのアニメ映像に切り替わる(驚く顔 → 導火線 → ドーン → 打ち上げ → キラーン)→ カットイン。
(() => {
  const N = 24;
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
  const board = `<div class="mn-board" style="--n:${N / 2}">
    <svg class="mn-scene" viewBox="0 0 1000 690" aria-hidden="true">
      ${DEFS}
      <defs>
        <linearGradient id="mnCurtain" spreadMethod="repeat" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="38" y2="0">
          <stop stop-color="#6a1014"/><stop offset=".45" stop-color="#b8323a"/><stop offset=".7" stop-color="#8e1b1f"/><stop offset="1" stop-color="#6a1014"/></linearGradient>
        <linearGradient id="mnFloor" x2="0" y2="1"><stop stop-color="#9c6a3b"/><stop offset=".4" stop-color="#c0894f"/><stop offset="1" stop-color="#a56f3d"/></linearGradient>
        <radialGradient id="mnWallShade" cx=".5" cy=".55" r=".65"><stop stop-color="#fff" stop-opacity=".0"/><stop offset=".6" stop-color="#2a0a06" stop-opacity=".18"/><stop offset="1" stop-color="#1a0504" stop-opacity=".6"/></radialGradient>
        <linearGradient id="mnBeam" x2="0" y2="1"><stop stop-color="#fff8dc" stop-opacity=".42"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></linearGradient>
        <linearGradient id="mnPanel" x2="0" y2="1"><stop stop-color="#2a3a66"/><stop offset="1" stop-color="#182346"/></linearGradient>
        <clipPath id="mnStage"><rect width="1000" height="690" rx="22"/></clipPath>
      </defs>
      <g clip-path="url(#mnStage)">
        <!-- 奥の幕(赤と生成りのしま) -->
        ${stripes}
        <rect width="1000" height="372" fill="url(#mnWallShade)"/>
        <!-- 床 -->
        <rect y="372" width="1000" height="318" fill="url(#mnFloor)"/>
        <g stroke="#6e4422" stroke-width="2" opacity=".45">${planks}</g>
        <rect y="364" width="1000" height="12" fill="url(#mnGold)"/>
        <rect y="376" width="1000" height="16" fill="#000" opacity=".22"/>
        <!-- スポットライト -->
        <path d="M430 -10 H570 L760 520 H240 Z" fill="url(#mnBeam)" filter="url(#mnBlur)"/>
        <ellipse cx="500" cy="456" rx="250" ry="56" fill="#fff4cc" opacity=".35" filter="url(#mnBlur)"/>
        <!-- 影 -->
        <ellipse cx="516" cy="468" rx="170" ry="34" fill="#2a1406" opacity=".45" filter="url(#mnBlur)"/>
        <!-- 左右の幕と上の飾り -->
        ${curtain(-1)}${curtain(1)}
        <path d="M0 0 H1000 V62 H0 Z" fill="#8e1b1f"/>
        <path d="M0 62 ${Array.from({length: 10}, (_, i) => `Q${50 + i * 100} 100 ${100 + i * 100} 62`).join(' ')}" fill="#8e1b1f" stroke="url(#mnGold)" stroke-width="6"/>
        <g fill="url(#mnGold)">${Array.from({length: 9}, (_, i) => `<circle cx="${100 + i * 100}" cy="64" r="7"/><path d="M${96 + i * 100} 70 L${92 + i * 100} 96 H${108 + i * 100} L${104 + i * 100} 70 Z"/>`).join('')}</g>
        <path d="M0 20 H1000" stroke="url(#mnGold)" stroke-width="4" opacity=".8"/>
        <!-- 大砲(少し小さく) -->
        <g transform="translate(500 470) scale(.8) translate(-500 -492)"><g class="mn-cannon">${cannon(true)}</g></g>
        <!-- 操作盤 -->
        <rect x="92" y="512" width="816" height="168" rx="22" fill="#000" opacity=".4" filter="url(#mnBlur)" transform="translate(6 8)"/>
        <rect x="92" y="508" width="816" height="168" rx="22" fill="url(#mnPanel)" stroke="url(#mnGold)" stroke-width="6"/>
        <rect x="106" y="522" width="788" height="140" rx="14" fill="none" stroke="#f3cf6a" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 8" stroke-linecap="round"/>
      </g>
    </svg>
    <div class="mn-buttons">${Array.from({length: N}, (_, i) => `<button type="button" class="mn-btn" data-mn="${i}" aria-label="ボタン ${i + 1}"><i><span>${i + 1}</span></i></button>`).join('')}</div>
  </div>`;

  const css = `
  .play-screen .boardwrap.k-munage{display:grid;place-items:center}
  .mn-board{position:relative;width:min(100%,calc(100cqh * 1000 / 690));aspect-ratio:1000/690;container-type:size;border-radius:2.2%;box-shadow:0 6px 16px #3d26164d}
  .mn-scene{position:absolute;inset:0;width:100%;height:100%}
  .mn-buttons{position:absolute;left:11%;right:11%;top:75.4%;height:21.4%;display:grid;grid-template-columns:repeat(var(--n),1fr);grid-template-rows:1fr 1fr;align-items:center;justify-items:center}
  .mn-btn{position:relative;width:min(84%,8.4cqh);aspect-ratio:1;padding:0;border:0;border-radius:50%;cursor:pointer;
    background:conic-gradient(from 210deg,#6b4a1c,#f6dc97,#b78a3f,#5d3f15,#e9c77a,#6b4a1c);box-shadow:0 2px 3px #0009,inset 0 0 0 1px #3a250c}
  .mn-btn::before{content:"";position:absolute;inset:12%;border-radius:50%;background:#0d0a08;box-shadow:inset 0 2px 3px #000}
  .mn-btn i{position:absolute;inset:17%;display:grid;place-items:center;border-radius:50%;transform:translateY(-16%);transition:transform .09s ease-out,box-shadow .09s,background .12s;
    background:radial-gradient(circle at 34% 28%,#ffb3a6 0 9%,#f0493a 30%,#b81d14 70%,#86100a);
    box-shadow:0 .5cqh 0 #6a0b06,0 .75cqh 3px #000a,inset 0 -2px 3px #0005}
  .mn-btn span{font:900 max(9px,2.1cqh)/1 var(--font);color:#fff4e4;text-shadow:0 1px 1px #0009;pointer-events:none}
  .mn-btn:hover:not(.on) i{filter:brightness(1.1)}
  .mn-btn:focus-visible{outline:3px solid var(--mark);outline-offset:2px}
  .mn-btn.on{cursor:default}
  .mn-btn.on i{transform:translateY(0);background:radial-gradient(circle at 34% 28%,#d6ffc8 0 9%,#4fca5c 30%,#21913a 70%,#136326);box-shadow:0 .1cqh 0 #0e4d1b,0 .2cqh 2px #0009,inset 0 2px 3px #0006}
  .mn-btn.bad i{background:radial-gradient(circle at 34% 28%,#fff 0 9%,#ffd34a 30%,#e09a00 70%,#a86a00)}
  .mn-sweat{animation:mnSweat 1.8s ease-in infinite}
  @keyframes mnSweat{0%{transform:translateY(0);opacity:0}25%{opacity:1}100%{transform:translateY(14px);opacity:0}}
  .mn-board .mn-man{animation:mnFidget 2.6s ease-in-out infinite}
  @keyframes mnFidget{50%{transform:translateY(3px)}}
  /* ---- アニメ映像 ---- */
  .mn-anime{position:fixed;inset:0;z-index:900;overflow:hidden;background:#000;container-type:size;font-family:"Dela Gothic One",var(--font)}
  .mn-anime .cut{position:absolute;inset:0;visibility:hidden}
  .mn-anime .cut.on{visibility:visible}
  .mn-anime .cut svg{position:absolute;inset:0;width:100%;height:100%}
  .mn-anime .bar{position:absolute;left:0;right:0;height:9cqh;background:#000;z-index:5}
  .mn-anime .bar.t{top:0}.mn-anime .bar.b{bottom:0}
  .mn-anime .word{position:absolute;z-index:3;color:#fff;-webkit-text-stroke:.9cqh #1a0e08;paint-order:stroke fill;white-space:nowrap;line-height:1}
  .mn-anime .speed line{stroke:#fff;stroke-linecap:round}
  .mn-anime .cutin{pointer-events:auto;z-index:6}
  `;

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
      </svg><div class="word" style="right:9cqw;top:18cqh;font-size:13cqh;transform:rotate(8deg)">!?</div>
      <div class="word" style="left:8cqw;top:20cqh;font-size:8cqh;transform:rotate(-8deg)">ひぃっ</div></div>`;
    // カット B: 導火線を火が走る
    const cutB = `<div class="cut b"><svg ${S}>${DEFS}
        <rect width="1600" height="900" fill="#1b0c08"/>${focusLines(1300, 300, 110, '#5a1d10', 9)}
        <path class="fuse" d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#c9a06a" stroke-width="34" stroke-linecap="round"/>
        <path d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#7a5630" stroke-width="34" stroke-dasharray="10 22"/>
        <path class="burnt" d="M-40 860 C300 760 520 820 760 640 C980 470 1100 420 1660 250" fill="none" stroke="#2b1a10" stroke-width="36" stroke-linecap="round" pathLength="1" stroke-dasharray="0 1"/>
        <g class="spark"><g fill="#ffd23f">${burst(0, 0, 9, 22, 70, 5)}</g><circle r="26" fill="#fff8d0"/>
          <g stroke="#ffcc33" stroke-width="5" stroke-linecap="round">${Array.from({length: 10}, (_, i) => { const a = i * .63; return `<line x1="${Math.cos(a) * 40}" y1="${Math.sin(a) * 40}" x2="${Math.cos(a) * 96}" y2="${Math.sin(a) * 96}"/>`; }).join('')}</g></g>
      </svg><div class="word" style="left:7cqw;top:16cqh;font-size:9cqh;color:#ffe27a">ジジジ…</div></div>`;
    // カット C: ドーン(白黒反転の一瞬の絵)
    const cutC = `<div class="cut c"><svg ${S}>
        <rect width="1600" height="900" fill="#fff"/>${focusLines(800, 520, 140, '#111', 21)}
        <g fill="#111">${burst(800, 560, 22, 160, 430, 8)}</g><g fill="#fff">${burst(800, 560, 16, 70, 210, 12)}</g>
      </svg><div class="word" style="left:50%;top:40%;font-size:22cqh;transform:translate(-50%,-50%) rotate(-6deg);color:#111;-webkit-text-stroke:1.2cqh #fff">ドーン!!</div></div>`;
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
      </svg><div class="word kira" style="left:50%;top:30%;font-size:9cqh;transform:translateX(-50%);color:#fff7b0;opacity:0">キラーン</div></div>`;
    return `${cutA}${cutB}${cutC}${cutD}<div class="bar t"></div><div class="bar b"></div><div class="mn-cut"></div>`;
  }

  // ---- 画面に差し込む ----
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  document.querySelector('.stagehead h2').textContent = '胸毛絶体絶命';
  document.querySelector('#hround').innerHTML = `<span class="hchip">ボタン ${N} 個</span>`;
  const names = ['あなた', 'CPU 1', 'CPU 2'];
  let turn = 0, over = false, pressed = 0;
  const bad = window.MN_BAD ?? 13;
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
    // 盤: 導火線の先に火がつく(0.45 秒)→ アニメ映像へ切り替え
    root.querySelector('.mn-spark').animate([{r: 0}, {r: 10}, {r: 6}, {r: 11}], {duration: 450, fill: 'forwards'});
    setTimeout(playAnime, 450);
  }

  function playAnime() {
    const L = document.createElement('div'); L.className = 'mn-anime';
    L.innerHTML = animeHtml(names[turn]);
    document.body.append(L);
    const cut = (sel) => { L.querySelectorAll('.cut').forEach(c => c.classList.toggle('on', c.matches(sel))); };
    const q = s => L.querySelector(s);
    // 黒帯がすっと入る
    q('.bar.t').animate([{transform: 'translateY(-100%)'}, {transform: 'none'}], {duration: 160, easing: 'ease-out'});
    q('.bar.b').animate([{transform: 'translateY(100%)'}, {transform: 'none'}], {duration: 160, easing: 'ease-out'});
    // A: 驚く顔(0〜0.8 秒)。寄りながら震える
    cut('.a');
    q('.a svg').animate([{transform: 'scale(1.18)'}, {transform: 'scale(1)'}], {duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards'});
    q('.a .shake').animate([{transform: 'translate(0,0)'}, {transform: 'translate(8px,-5px)'}, {transform: 'translate(-7px,4px)'}, {transform: 'translate(5px,6px)'}],
      {duration: 120, iterations: Infinity, delay: 240});
    L.querySelectorAll('.a .word').forEach((w, i) => w.animate([{transform: w.style.transform + ' scale(2.4)', opacity: 0}, {transform: w.style.transform, opacity: 1}],
      {duration: 200, delay: 160 + i * 110, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'both'}));
    // B: 導火線(0.8〜1.45 秒)
    setTimeout(() => {
      cut('.b');
      const path = q('.b .fuse'), spark = q('.b .spark'), burnt = q('.b .burnt'), len = path.getTotalLength(), t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / 600), e = t * t * (1.6 - .6 * t);
        const pt = path.getPointAtLength(e * len);
        spark.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${now * .9}) scale(${.9 + Math.random() * .35})`);
        burnt.setAttribute('stroke-dasharray', `${e} 1`);
        if (t < 1 && L.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      q('.b .word').animate([{opacity: 0}, {opacity: 1}], {duration: 120, fill: 'both'});
    }, 800);
    // C: ドーン(1.45〜1.75 秒)。画面ごと揺れる
    setTimeout(() => {
      cut('.c');
      q('.c').animate([{transform: 'translate(0,0) scale(1.06)'}, {transform: 'translate(-18px,10px) scale(1.03)'}, {transform: 'translate(14px,-12px)'}, {transform: 'translate(-6px,6px)'}, {transform: 'none'}],
        {duration: 300});
      q('.c .word').animate([{transform: 'translate(-50%,-50%) rotate(-6deg) scale(2.2)'}, {transform: 'translate(-50%,-50%) rotate(-6deg) scale(1)'}], {duration: 160, easing: 'ease-out', fill: 'both'});
    }, 1450);
    // D: 打ち上げ(1.75〜4.2 秒)
    setTimeout(() => {
      cut('.d');
      const world = q('.d .world'), fl = q('.d .flyer'), spin = q('.d .spin');
      world.animate([{transform: 'translateY(0)'}, {transform: 'translateY(0)', offset: .14}, {transform: 'translateY(2600px)'}],
        {duration: 1900, easing: 'cubic-bezier(.55,0,.45,1)', fill: 'forwards'});
      L.querySelectorAll('.d .puff').forEach((p, i) => p.animate([{opacity: 0, transform: p.getAttribute('transform') + ' scale(.3)'}, {opacity: 1, transform: p.getAttribute('transform') + ' scale(1)'}],
        {duration: 260 + i * 60, easing: 'ease-out', fill: 'both'}));
      fl.animate([
        {transform: 'translate(800px,700px) scale(.55)'},
        {transform: 'translate(800px,420px) scale(1.05)', offset: .12},
        {transform: 'translate(790px,400px) scale(1)', offset: .62},
        {transform: 'translate(800px,170px) scale(.02)'},
      ], {duration: 2400, easing: 'ease-in-out', fill: 'forwards'});
      spin.animate([{transform: 'rotate(0)'}, {transform: 'rotate(-40deg)', offset: .1}, {transform: 'rotate(-1150deg)'}], {duration: 2400, easing: 'cubic-bezier(.3,.2,.6,1)', fill: 'forwards'});
      L.querySelectorAll('.d .speed line').forEach((ln, i) => ln.animate([{transform: 'translateY(0)'}, {transform: 'translateY(1500px)'}],
        {duration: 380, delay: 300 + (i * 53) % 380, iterations: 4, easing: 'linear'}));
      q('.d .twinkle').animate([{opacity: 1, transform: 'translate(800px,170px) scale(0) rotate(0)'}, {opacity: 1, transform: 'translate(800px,170px) scale(1.5) rotate(60deg)', offset: .5}, {opacity: 1, transform: 'translate(800px,170px) scale(1) rotate(90deg)'}],
        {delay: 2350, duration: 450, fill: 'forwards'});
      q('.d .kira').animate([{opacity: 0, transform: 'translateX(-50%) scale(.2)'}, {opacity: 1, transform: 'translateX(-50%) scale(1)'}],
        {delay: 2450, duration: 300, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'forwards'});
    }, 1750);
    // 黒帯が抜けて、アプリと同じカットイン
    setTimeout(() => {
      q('.bar.t').animate([{transform: 'none'}, {transform: 'translateY(-100%)'}], {duration: 200, fill: 'forwards'});
      q('.bar.b').animate([{transform: 'none'}, {transform: 'translateY(100%)'}], {duration: 200, fill: 'forwards'});
      q('.mn-cut').outerHTML = `<button class="cutin red f-mo tall" tabindex="-1"><span class="veil"></span><span class="band"></span><span class="txt"><span class="mainl" style="font-size:min(12cqh,13cqw)">ゲームオーバー</span><small>${names[turn]}の負け</small></span></button>`;
    }, 4650);
  }
  window.MN_FIRE = () => press(bad);
})();
