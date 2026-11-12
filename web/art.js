// タイルの絵。見本にあるもの(art_sample.js)はそのまま使い、見本にないゲームは同じ素材の色で描き足した。
import { art as base, A, st, pc } from "./art_sample.js";

const grid = (n, x0, y0, size, color, w = 1) => Array.from({ length: n + 1 }, (_, i) => `<path d="M${x0 + (i * size) / n} ${y0}V${y0 + size}M${x0} ${y0 + (i * size) / n}H${x0 + size}" stroke="${color}" stroke-width="${w}"/>`).join("");
const disc = (x, y, r, c) => `<circle cx="${x}" cy="${y + 1.5}" r="${r}" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * .3}" cy="${y - r * .35}" r="${r * .3}" fill="#fff" opacity=".35"/>`;
const back = (x, y, w, rot = 0) => `<g transform="rotate(${rot} ${x + w / 2} ${y + w * .7})"><rect x="${x}" y="${y + 2}" width="${w}" height="${w * 1.4}" rx="3" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="${w}" height="${w * 1.4}" rx="3" fill="#fffdf7"/><rect x="${x + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${w * 1.4 - 5}" rx="2" fill="#a94c38"/></g>`;
const die = (x, y, s, n) => {
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  return `<rect x="${x}" y="${y + 2}" width="${s}" height="${s}" rx="${s * .18}" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * .18}" fill="url(#iv)" stroke="#b9ac8c"/>` + P.map(([a, b]) => `<circle cx="${x + s / 2 + a * s * .25}" cy="${y + s / 2 + b * s * .25}" r="${s * .08}" fill="#2a2118"/>`).join("");
};

export const art = {
  ...base,
  gomoku: A("#e3c078", grid(4, 10, 10, 80, "#3a2a14") + st(30, 50, 9, "k1") + st(50, 50, 9, "k1") + st(70, 50, 9, "k1") + st(50, 30, 9, "k2") + st(30, 70, 9, "k2")),
  connect4: A("#2b4a6b", Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<circle cx="${20 + c * 20}" cy="${22 + r * 19}" r="7.5" fill="#16293f"/>`).join("")).join("") + disc(20, 79, 7.5, "#d8452e") + disc(40, 79, 7.5, "#e6b21f") + disc(40, 60, 7.5, "#d8452e") + disc(60, 79, 7.5, "#d8452e") + disc(60, 60, 7.5, "#e6b21f")),
  dots: A("#f4ead0", Array.from({ length: 16 }, (_, i) => `<circle cx="${20 + (i % 4) * 20}" cy="${20 + Math.floor(i / 4) * 20}" r="3" fill="#3a2a14"/>`).join("") + `<rect x="22" y="22" width="16" height="16" fill="#c8463c" opacity=".35"/><path d="M20 20H40V40H20Z M40 20H60 M60 40V60 M40 60H60" stroke="#c8463c" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M20 60V80H40 M60 20H80V40" stroke="#3f78c4" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  hitblow: A("url(#w1)", [3, 7, 1].map((n, i) => `<rect x="${12 + i * 26}" y="22" width="22" height="30" rx="3" fill="url(#iv)"/><text x="${23 + i * 26}" y="45" font-size="20" font-weight="900" text-anchor="middle" fill="#2a2118">${n}</text>`).join("") + `<circle cx="38" cy="70" r="7" fill="#c8463c"/><circle cx="58" cy="70" r="7" fill="#fffdf5" stroke="#b9ac8c"/>`),
  morris: A("#e3c078", `<rect x="14" y="14" width="72" height="72" fill="none" stroke="#5a3a22" stroke-width="2.5"/><rect x="29" y="29" width="42" height="42" fill="none" stroke="#5a3a22" stroke-width="2.5"/><path d="M50 14V29M50 71V86M14 50H29M71 50H86" stroke="#5a3a22" stroke-width="2.5"/>` + st(14, 14, 8, "k2") + st(50, 14, 8, "k2") + st(86, 14, 8, "k2") + st(29, 71, 8, "k1") + st(71, 50, 8, "k1")),
  checkers: A("#769656", Array.from({ length: 16 }, (_, i) => ((i % 4) + Math.floor(i / 4)) % 2 ? "" : `<rect x="${(i % 4) * 25}" y="${Math.floor(i / 4) * 25}" width="25" height="25" fill="#eeeed2"/>`).join("") + st(37.5, 37.5, 9, "k1") + st(62.5, 62.5, 9, "k2") + st(12.5, 87.5, 9, "k1") + st(87.5, 12.5, 9, "k2")),
  hare: A("#e3c078", `<path d="M14 50L32 28H68L86 50L68 72H32Z M32 28V72 M50 28V72 M68 28V72 M14 50H86" stroke="#5a3a22" stroke-width="2" fill="none"/>` + `<circle cx="14" cy="50" r="8" fill="#6b4a2a"/><circle cx="32" cy="28" r="8" fill="#6b4a2a"/><circle cx="32" cy="72" r="8" fill="#6b4a2a"/>` + st(86, 50, 8, "k2")),
  chinese: A("url(#w1)", `<polygon points="50,8 61,30 86,30 72,50 86,70 61,70 50,92 39,70 14,70 28,50 14,30 39,30" fill="#b98952"/>` + [[50, 20, "#c8463c"], [44, 30, "#c8463c"], [56, 30, "#c8463c"], [50, 80, "#3f78c4"], [44, 70, "#3f78c4"], [56, 70, "#3f78c4"], [24, 36, "#3e9b63"], [76, 64, "#e0ae36"], [38, 50, "#5a3a22"], [50, 50, "#5a3a22"], [62, 50, "#5a3a22"]].map(([x, y, c]) => disc(x, y, 4.6, c)).join("")),
  yacht: A("url(#f1)", die(12, 22, 30, 5) + die(48, 16, 30, 3) + die(30, 56, 30, 6)),
  gogo: A("#e9c98a", `<path d="M0 33H100M0 66H100M33 0V100M66 0V100" stroke="#4a3520"/><path d="M50 16L68 25L74 80H26L32 25Z" transform="translate(1,3)" fill="#000" opacity=".3"/><path d="M50 16L68 25L74 80H26L32 25Z" fill="url(#km)" stroke="#8a6a35"/><text x="50" y="47" font-size="20" text-anchor="middle" fill="#1b140d" style="font-family:'Yuji Boku',serif">王</text><text x="50" y="71" font-size="20" text-anchor="middle" fill="#1b140d" style="font-family:'Yuji Boku',serif">将</text>`),
  sevens: A("url(#f1)", pc(10, 28, "6", "♥", 1, 24, -10) + pc(38, 24, "7", "♥", 1, 24, 0) + pc(66, 28, "8", "♥", 1, 24, 10)),
  speed: A("url(#f1)", pc(14, 28, "9", "♣", 0, 28, -8) + pc(56, 28, "10", "♦", 1, 28, 8)),
  memory: A("url(#f1)", back(12, 14, 22) + back(39, 14, 22) + pc(66, 14, "Q", "♠", 0, 22) + pc(12, 52, "Q", "♥", 1, 22) + back(39, 52, 22) + back(66, 52, 22)),
  blackjack: A("url(#f1)", pc(16, 26, "A", "♠", 0, 30, -8) + pc(48, 28, "J", "♥", 1, 30, 8) + `<circle cx="78" cy="80" r="9" fill="#c8463c" stroke="#fffdf5" stroke-width="2" stroke-dasharray="4 3"/>`),
  solitaire: A("url(#f1)", [0, 1, 2].map((i) => back(10 + i * 28, 12, 22)).join("") + pc(10, 40, "K", "♠", 0, 22) + pc(38, 46, "Q", "♥", 1, 22) + pc(66, 52, "J", "♣", 0, 22)),
};
// 同じ絵を画面に何枚も出すと、色の定義(id)が重なり、隠れた画面の定義を参照して色が抜けることがある。出すたびに名前を変える
let artSeq = 0;
export function tileArt(id) {
  const svg = art[id] || A("url(#w1)", "");
  const n = ++artSeq;
  return svg.replace(/id="([A-Za-z0-9]+)"/g, `id="$1_${n}"`).replace(/url\(#([A-Za-z0-9]+)\)/g, `url(#$1_${n})`);
}
