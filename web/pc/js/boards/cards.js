/* 札の絵: Oh, No!(見本の ohCard)・花札(48 枚)・トランプ。カードゲームの盤から呼ぶ */
(() => {
  // ---------------------------------------------------------------- Oh, No!
  function ohno(id) {
    const card = Math.floor(id / 10), chosen = id % 10 === 9 ? -1 : id % 10;
    const color = card >= 100 ? 4 : Math.floor(card / 25);
    const k = card % 25, value = card >= 100 ? (card < 104 ? 13 : 14) : k === 0 ? 0 : (k + 1) >> 1;
    const kind = value <= 9 ? value : { 10: 'skip', 11: 'rev', 12: '+2', 13: 'wild', 14: '+4' }[value];
    return ohCard(kind, color, chosen >= 0 && value >= 13 ? chosen : -1);
  }

  // ---------------------------------------------------------------- 花札(月の植物 + 光・タネ・短冊)
  const LIGHTS = new Set([0, 8, 28, 40, 44]), ANIMALS = new Set([4, 12, 16, 20, 24, 32, 36, 41, 29]), RIBBONS = new Set([1, 5, 9, 13, 17, 21, 25, 33, 37, 42]);
  const R = '#C8362E', G = '#1F5D3A', K = '#15151A', P = '#7A5AC0', Y = '#E6B21F', CR = '#F4EAD0', PK = '#F29BB5';
  const flower = (x, y, r, c, n = 5, core = Y) => Array.from({ length: n }, (_, i) => { const a = i * 2 * Math.PI / n - Math.PI / 2; return `<circle cx="${(x + Math.cos(a) * r * .55).toFixed(1)}" cy="${(y + Math.sin(a) * r * .55).toFixed(1)}" r="${(r * .48).toFixed(1)}" fill="${c}"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="${(r * .28).toFixed(1)}" fill="${core}"/>`;
  const leaf = (x, y, s, rot, c = G) => `<path d="M0 0q${s * .5} ${-s * .4} ${s} 0q${-s * .5} ${s * .4} ${-s} 0z" fill="${c}" transform="translate(${x},${y}) rotate(${rot})"/>`;
  const star = (x, y, r, c) => { let d = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * .42 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * q).toFixed(1) + ' ' + (y + Math.sin(a) * q).toFixed(1); } return `<path d="${d}Z" fill="${c}"/>`; };
  const PLANT = [
    // 1 松
    () => `<path d="M8 66V40" stroke="#5a3a22" stroke-width="3"/>` + [[10, 34], [22, 26], [32, 40]].map(([x, y]) => `<path d="M${x - 10} ${y + 6}l10-14 10 14z" fill="${G}"/><path d="M${x - 8} ${y + 12}l8-11 8 11z" fill="#2c7a52"/>`).join(''),
    // 2 梅
    () => `<path d="M2 60q14-10 18-30t20-22" fill="none" stroke="#3a2616" stroke-width="2.5"/>` + [[16, 36], [26, 20], [34, 12], [8, 50]].map(([x, y]) => flower(x, y, 6, R)).join(''),
    // 3 桜
    () => [[10, 14], [24, 10], [34, 22], [14, 30], [28, 34]].map(([x, y]) => flower(x, y, 7, PK, 5, R)).join(''),
    // 4 藤
    () => `<path d="M4 4q16 6 36 2" stroke="#5a3a22" stroke-width="2" fill="none"/>` + [10, 20, 30].map((x) => Array.from({ length: 5 }, (_, i) => `<circle cx="${x + (i % 2) * 2}" cy="${10 + i * 6}" r="2.8" fill="${P}"/>`).join('')).join(''),
    // 5 菖蒲
    () => `<path d="M10 66V30M22 66V24M32 66V34" stroke="${G}" stroke-width="2.5"/>` + [[10, 26], [22, 20], [32, 30]].map(([x, y]) => `<path d="M${x} ${y}l-5 -8 5 3 5 -3z" fill="${P}"/><circle cx="${x}" cy="${y - 2}" r="2" fill="${Y}"/>`).join(''),
    // 6 牡丹
    () => flower(20, 22, 13, R, 7, '#8E1710') + leaf(6, 40, 12, -30) + leaf(26, 42, 12, 20),
    // 7 萩
    () => `<path d="M4 60q10-26 30-46" stroke="#5a3a22" stroke-width="1.5" fill="none"/>` + Array.from({ length: 9 }, (_, i) => `<circle cx="${8 + i * 3.4}" cy="${54 - i * 5}" r="2.4" fill="#B03A6A"/>`).join('') + leaf(18, 46, 8, -40) + leaf(26, 30, 8, -10),
    // 8 芒
    () => `<path d="M0 46Q20 26 40 46V70H0z" fill="${K}"/>` + [6, 14, 22, 30].map((x) => `<path d="M${x} 46q-2-10 2-20" stroke="#E6D9B0" stroke-width="1.5" fill="none"/>`).join(''),
    // 9 菊
    () => flower(20, 22, 13, Y, 12, R) + leaf(8, 40, 10, -20) + leaf(28, 40, 10, 30),
    // 10 紅葉
    () => [[10, 14], [26, 12], [18, 28], [32, 30]].map(([x, y], i) => star(x, y, 8, i % 2 ? Y : R)).join(''),
    // 11 柳
    () => [6, 14, 24, 34].map((x) => `<path d="M${x} 0q-4 20 2 44" stroke="${G}" stroke-width="2" fill="none"/>`).join('') + `<path d="M0 40l40 8" stroke="#3F78C4" stroke-width="1" stroke-dasharray="3 4"/>`,
    // 12 桐
    () => `<path d="M20 12l-12 22h24z" fill="${G}"/>` + [12, 20, 28].map((x) => Array.from({ length: 3 }, (_, i) => `<circle cx="${x}" cy="${6 + i * 5}" r="2.6" fill="${P}"/>`).join('')).join(''),
  ];
  const SPECIAL = {
    0: `<circle cx="28" cy="16" r="9" fill="${R}"/><path d="M6 48q8-10 16-6t10-10l4 6-8 4q4 8-8 10z" fill="#fff" stroke="${K}" stroke-width="1.2"/><circle cx="31" cy="38" r="2" fill="${R}"/>`,
    8: `<path d="M2 30h36v14H2z" fill="${R}"/><path d="M2 30q18-8 36 0" fill="#E6B21F"/>`,
    28: `<path d="M0 34Q20 16 40 34V70H0z" fill="${K}"/><circle cx="20" cy="18" r="12" fill="${CR}" stroke="${Y}" stroke-width="1.5"/>`,
    40: `<path d="M8 50q4-12 14-10t10-8" fill="none" stroke="${K}" stroke-width="2"/><circle cx="12" cy="44" r="4" fill="${R}"/><path d="M26 22h6l-1 12h-4z" fill="#3a2616"/>`,
    44: `<path d="M6 40q10-24 30-16-4 10-14 12 6 6 10 14-14-2-26-10z" fill="${R}" stroke="${Y}" stroke-width="1.5"/>`,
    4: `<path d="M24 20q-6 0-8 6t-8 10l6-2-2 6 8-6q6-2 6-8z" fill="#3a2616"/><circle cx="26" cy="20" r="2.4" fill="${R}"/>`,
    12: `<path d="M8 20l10 6 12-10M10 30l10 4 12-8" stroke="${K}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    16: `<path d="M8 40l10-6 6 6 6-10 6 4" stroke="${K}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    20: `<path d="M20 30q-10-14-14-2 4 10 14 2zM20 30q10-14 14-2-4 10-14 2z" fill="${Y}" stroke="${K}" stroke-width="1"/>`,
    24: `<ellipse cx="20" cy="38" rx="14" ry="8" fill="#6b4a24"/><circle cx="32" cy="34" r="5" fill="#6b4a24"/>`,
    29: `<path d="M8 22l8 4 8-4M18 30l8 4 8-4" stroke="${K}" stroke-width="2.2" fill="none"/>`,
    32: `<ellipse cx="20" cy="38" rx="13" ry="6" fill="${R}" stroke="${Y}" stroke-width="1.5"/><text x="20" y="41" text-anchor="middle" font-size="7" fill="${Y}" font-family="Yuji Boku,serif">壽</text>`,
    36: `<path d="M10 44l10-12 12 2-2 12z" fill="#9a6b3f"/><path d="M28 30l4-10M30 26l6-4" stroke="#6b4a24" stroke-width="1.6"/>`,
    41: `<path d="M8 30q12-8 24 0" stroke="${K}" stroke-width="2.6" fill="none"/><circle cx="32" cy="30" r="2.5" fill="${K}"/>`,
  };
  function hanaSvg(c) {
    const m = c >> 2, light = LIGHTS.has(c), animal = ANIMALS.has(c), rib = RIBBONS.has(c);
    const ribCol = [21, 33, 37].includes(c) ? '#2F5FD0' : R, poem = [1, 5, 9].includes(c);
    let body = PLANT[m]();
    if (SPECIAL[c]) body += SPECIAL[c];
    if (rib) body += `<g transform="rotate(14 20 34)"><rect x="15" y="18" width="10" height="34" fill="${ribCol}" stroke="#fff" stroke-width="1"/>${poem ? `<text x="20" y="30" font-size="6" fill="#fff" text-anchor="middle" font-family="Yuji Boku,serif">あ</text><text x="20" y="40" font-size="6" fill="#fff" text-anchor="middle" font-family="Yuji Boku,serif">か</text>` : ''}</g>`;
    if (light) body += `<circle cx="34" cy="62" r="5" fill="${Y}" stroke="${K}" stroke-width=".8"/><text x="34" y="64.5" font-size="6" text-anchor="middle" fill="${K}" font-family="Yuji Boku,serif">光</text>`;
    return `<svg class="hfc" viewBox="0 0 44 70" role="img" aria-label="${m + 1}月"><rect width="44" height="70" rx="3" fill="${K}"/><rect x="2" y="2" width="40" height="66" rx="1.5" fill="${light && m !== 7 && m !== 2 ? R : CR}"/><g transform="translate(2,2)">${body}</g><text x="5" y="9" font-size="6" fill="${light && m !== 7 && m !== 2 ? CR : '#7a6f60'}" font-family="Yuji Boku,serif">${'一二三四五六七八九十'[m] || (m === 10 ? '十一' : '十二')}</text></svg>`;
  }

  // ---------------------------------------------------------------- トランプ(表の文字 "♠4" などから)
  const SUITS = '♠♥♦♣';
  function trump(t) {
    const m = String(t).match(/^([♠♥♦♣])(10|[2-9JQKA])(.*)$/); if (!m) return null;
    const red = m[1] === '♥' || m[1] === '♦';
    return { html: `<span class="pface ${red ? 'r' : ''}"><i>${m[2]}</i><i>${m[1]}</i><b>${m[1]}</b>${m[3] ? `<em>${m[3]}</em>` : ''}</span>`, red };
  }
  window.CARDFACE = (game, c) => {
    if (game === 'uno' && c.id >= 0) return { cls: 'svgc', html: ohno(c.id) };
    if (game === 'hanafuda' && c.id >= 0) return { cls: 'svgc hana', html: hanaSvg(c.id) };
    const tr = trump(c.t); if (tr) return { cls: 'trump', html: tr.html };
    if (c.t === 'JOKER' || c.t === 'ジョーカー') return { cls: 'trump', html: '<span class="pface"><b style="font-size:22px">🃏</b></span>' };
    return null;
  };
  window.HANA = hanaSvg; window.SUITS = SUITS;
})();
