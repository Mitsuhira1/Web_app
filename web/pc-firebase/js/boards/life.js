/* 人生すごろく(Android 版の盤にならう: 景色のある盤・色分けしたマス・ルーレットは右の欄)。規則は持たない。
 * ホイールで拡大・縮小(カーソルの所が中心)、ドラッグで移動。 */
(() => {
  const E = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CW = 156, CH = 112, MG = 72, LINE = '#4A3520', CREAM = '#FFF8DC', INK = '#2B1D10', RED = '#C9281C', YEL = '#FFD94F';
  const COLS = ['#E2574C', '#4A7FD0', '#F4D35E', '#3FAE62', '#7A4CC2', '#F08A3C'];
  const WHEEL = ['#E2574C', '#F2A541', '#F4D35E', '#7CC576', '#3FA7B5', '#4A7FD0', '#7A4CC2', '#C24C9A', '#E88AA0', '#8FD3C8'];
  const GBG = ['#F6CF57', '#CFD8F4', '#F7B3D9'], GEDGE = ['#C9952B', '#8E9CCB', '#B0468A'];
  const px = (c) => MG + c * CW, py = (r) => MG + r * CH;
  const LOOK = (q, grade) => ({
    payday: ['#E23B2E', '給料日', '#fff', '#fff', '#7A130C'], job: ['#C9EFCF', '就職', '#17663A'], rank: ['#C9EFCF', grade === 0 ? 'ランクアップ!' : '転職!', '#17663A'],
    ticket: ['#E6D8FF', 'ゆめチケット', '#5A2AA8'], child: ['#FFCFE0', 'ファミリー', '#B5235F'], house: ['#FFE7A3', 'マイホーム', '#8A5A00'],
    treasure: [YEL, 'お宝', '#7A4A00'], treasureBuy: [YEL, 'お宝', '#7A4A00'], treasurePick: [YEL, 'お宝', '#7A4A00'], dokkanReturn: [YEL, 'お宝', '#7A4A00'], dokkanPass: [YEL, 'お宝', '#7A4A00'],
    gamble: ['#A9E5D6', '運だめし', '#0D6351'], hap: ['#2F3542', 'ハプニング!', YEL, '#fff', '#11141B'], bonus: ['#FF9BD6', 'ぴったりボーナス', '#8A0F5C'],
    giveAll: [CREAM, 'ふるまい', '#8A2B12'], giveRight: [CREAM, 'ふるまい', '#8A2B12'], start: ['#2F9E56', 'スタート', '#fff', '#fff', '#0F4D26'],
    stop: ['#fff', 'ストップ!', '#fff', RED, RED], goal: [YEL, 'ゴール!', '#fff', RED, RED],
  }[q.type] || [CREAM, '', INK]);
  let JOBS = [];
  const KW = ['ゆめチケット', '約束手形', '子ども', '結婚', 'お宝', '給料', 'ランクアップ', '転職', 'フリーター', 'マイホーム', 'ゴール', 'ストップ', 'お祝い', '全員'];
  const money = (t) => { let h = E(t).replace(/(\$[\d,]+)|(もらう|もらえる)|(はらう)/g, (m, a, g, l) => a ? `<b class="amt">${a}</b>` : g ? `<b class="get">${g}</b>` : `<b class="lose">${l}</b>`);
    const words = [...JOBS, ...KW].filter(Boolean).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (words.length) h = h.replace(new RegExp(`(<[^>]*>)|(${words.join('|')})`, 'g'), (m, tag, w) => tag || `<b class="kw">${w}</b>`);
    return h; };

  // ---------------------------------------------------------------- 景色
  function bands(b) {
    const range = (...zs) => { const rows = b.squares.filter((q) => zs.includes(q.zone)).map((q) => q.row); return rows.length ? [Math.min(...rows), Math.max(...rows) + 1] : null; };
    const order = [['mountain'], ['foot'], ['valleyMoney', 'valleyTreasure'], ['field'], ['near', 'world'], ['town']];
    const out = []; let prev = 0;
    order.forEach((z, i) => { const r = range(...z); if (!r) return; const top = i === 0 ? 0 : prev, bottom = i === order.length - 1 ? b.rows : r[1]; out.push({ zone: z[0], top, bottom }); prev = bottom; });
    return out;
  }
  const O = (d, fill) => `<path d="${d}" fill="${fill}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>`;
  const C = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${LINE}" stroke-width="3"/>`;
  const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${LINE}" stroke-width="3"/>`;
  const tree = (x, y) => R(x - 4, y, 8, 16, '#8A5A2B') + C(x, y - 8, 17, '#2F9E56');
  const pine = (x, y, k) => R(x - 3, y, 6, 10, '#8A5A2B') + O(`M${x} ${y - 40 * k}L${x + 18 * k} ${y}L${x - 18 * k} ${y}Z`, '#1F7A45');
  const cloud = (x, y) => [[-18, -6, 18], [12, -12, 22], [30, 2, 15], [-34, 4, 13]].map(([dx, dy, r]) => C(x + dx * .7, y + dy * .7, r * .7, '#fff')).join('') + `<ellipse cx="${x}" cy="${y}" rx="30" ry="8.5" fill="#fff"/>`;
  const house = (x, y, roof) => R(x - 35, y - 13, 70, 46, '#fff') + O(`M${x - 45} ${y - 13}L${x} ${y - 45}L${x + 45} ${y - 13}Z`, roof) + R(x - 8, y + 9, 16, 24, '#8A5A2B');
  const paddy = (x, y, h) => [0, 1].map((j) => `<rect x="${x - 62}" y="${y - 40 + j * 46}" width="124" height="38" rx="5" fill="${(h + j) % 2 === 0 ? '#8FD06B' : '#D9EC7A'}"/>`).join('');
  const sea = (x, y, h) => h % 3 === 0 ? `<ellipse cx="${x}" cy="${y + 17}" rx="60" ry="17" fill="#F1D9A3"/><path d="M${x} ${y + 16}L${x + 4} ${y - 36}" stroke="#8A5A2B" stroke-width="7"/>${C(x + 4, y - 40, 16, '#2F9E56')}`
    : h % 3 === 1 ? O(`M${x - 36} ${y}L${x + 34} ${y}L${x + 20} ${y + 26}L${x - 22} ${y + 26}Z`, '#fff') + O(`M${x} ${y}L${x} ${y - 44}L${x + 30} ${y - 8}Z`, YEL)
    : [0, 1, 2].map((i) => `<path d="M${x - 50 + i * 34} ${y + (i % 2) * 18}q15 -12 30 0" fill="none" stroke="#fff" stroke-width="4"/>`).join('');
  const gold = (x, y, c) => [[0, 0], [18, 4], [-17, 5], [8, -12], [-8, -11], [0, -24]].map(([a, b2]) => C(x + a, y + b2, 11, c)).join('');
  const gem = (x, y, g) => O(`M${x - 14} ${y + 14}L${x} ${y - 18}L${x + 14} ${y + 14}Z`, g === 2 ? '#FF9BD6' : '#7DE0FF');
  const village = (x, y) => `<ellipse cx="${x}" cy="${y + 5}" rx="90" ry="45" fill="#E2C98F" stroke="${LINE}" stroke-width="3"/>` + [[-36, 1.1, '#FFCFE0'], [30, .9, '#BFE6FF']].map(([dx, s, c]) => O(`M${x + dx} ${y + 26 - 44 * s}L${x + dx + 36 * s} ${y + 26}L${x + dx - 36 * s} ${y + 26}Z`, c)).join('');
  const bigWheel = (x, y, r) => C(x, y, r + 8, '#fff') + Array.from({ length: 10 }, (_, i) => { const a0 = (i * 36 - 90) * Math.PI / 180, a1 = ((i + 1) * 36 - 90) * Math.PI / 180; return `<path d="M${x} ${y}L${x + r * Math.cos(a0)} ${y + r * Math.sin(a0)}A${r} ${r} 0 0 1 ${x + r * Math.cos(a1)} ${y + r * Math.sin(a1)}Z" fill="${WHEEL[i]}"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${LINE}" stroke-width="3"/>` + C(x, y, r * .22, '#fff');
  function scenery(b, grade) {
    const W = MG * 2 + CW * b.cols, H = MG * 2 + CH * b.rows, bs = bands(b);
    let s = `<rect width="${W}" height="${H}" fill="#9AD67C"/>`;
    const bandOf = (row) => (bs.find((x) => row >= x.top && row < x.bottom) || { zone: 'field' }).zone;
    for (const band of bs) {
      const top = band.top === 0 ? 0 : py(band.top) - .4 * CH, bottom = band.bottom >= b.rows ? H : py(band.bottom) - .4 * CH;
      if (band.zone === 'mountain') s += `<rect width="${W}" height="${bottom}" fill="#BDE6FF"/>${C(px(8.3), py(.5), 46, YEL)}${O(`M${px(1.5)} ${bottom}L${px(5.5)} ${py(-.15)}L${px(9.3)} ${bottom}Z`, '#8C9BB5')}${O(`M${px(4.72)} ${py(.7)}L${px(5.5)} ${py(-.15)}L${px(6.23)} ${py(.7)}L${px(5.9)} ${py(.5)}L${px(5.5)} ${py(.75)}L${px(5.1)} ${py(.5)}Z`, '#fff')}`;
      else if (band.zone === 'foot') s += `<rect y="${top}" width="${W}" height="${bottom - top}" fill="#7CC26A"/>`;
      else if (band.zone === 'valleyMoney') s += `<rect x="${px(0) - 18}" y="${top + 6}" width="${W - 2 * (MG - 18)}" height="${bottom - top - 12}" rx="34" fill="${GBG[grade]}" stroke="${GEDGE[grade]}" stroke-width="8"/>`;
      else if (band.zone === 'near') s += `<rect y="${top}" width="${px(4.5)}" height="${bottom - top}" fill="#B7E08A"/><rect x="${px(4.5)}" y="${top}" width="${W - px(4.5)}" height="${bottom - top}" fill="#6CC5EE"/>`;
      else if (band.zone === 'town') s += `<rect y="${top}" width="${W}" height="${bottom - top}" fill="#8FD06B"/>`;
    }
    const used = new Set(b.squares.map((q) => q.row * b.cols + q.x));
    let vil = null; const free = [];
    for (let row = 0; row < b.rows; row++) for (let c = 0; c < b.cols; c++) {
      if (used.has(row * b.cols + c)) continue;
      const cx = px(c + .5), cy = py(row + .5), h = (row * 31 + c * 17) % 7, z = bandOf(row);
      if (z === 'mountain') { if (row > 1 && h % 3 === 0) s += cloud(cx, cy); }
      else if (z === 'foot') { if (!vil && c <= 3) { s += village(cx, cy); vil = [cx, cy]; } else s += pine(cx, cy + 20, 1 + h / 10); }
      else if (z === 'valleyMoney') s += c < 5 ? gold(cx, cy + 10, grade === 1 ? '#fff' : YEL) : gem(cx, cy, grade);
      else if (z === 'field') free.push([row, c, cx, cy, z, h]);
      else if (z === 'near') s += c < 4.5 ? paddy(cx, cy, h) : sea(cx, cy, h);
      else if (z === 'town') free.push([row, c, cx, cy, z, h]);
    }
    const ctr = (q) => [px(q.x) + CW / 2, py(q.row) + CH / 2], byId = new Map(b.squares.map((q) => [q.id, q]));
    let road = '', road2 = '', arrows = '';
    for (const q of b.squares) for (const n of q.next) { const t = byId.get(n); if (!t) continue; const [x1, y1] = ctr(q), [x2, y2] = ctr(t);
      road += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${LINE}" stroke-width="44" stroke-linecap="round"/>`; road2 += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#F6E7BF" stroke-width="34" stroke-linecap="round"/>`;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, br = q.next.length > 1;
      arrows += `<g transform="translate(${mx},${my}) rotate(${ang})"><path d="${br ? 'M-7 -9L6 0L-7 9Z' : 'M-5 -6L4 0L-5 6Z'}" fill="${br ? RED : '#8A6A3A'}" stroke="#fff" stroke-width="${br ? 2 : 1.2}"/></g>`; }
    // 買える家の場所: 町と野原の空いた所(下から)
    const nH = (b.houses || []).length, rows = [...new Set(free.map((f) => f[0]))].sort((a, c) => c - a);
    // 家が全部並ぶ、いちばん下の段に、端から端まで等しい間で置く
    const rowFree = (r) => free.filter((f) => f[0] === r).sort((a, c) => a[1] - c[1]);
    const rowPick = rows.find((r) => rowFree(r).length >= nH);
    const lots = rowPick != null ? (() => { const rf = rowFree(rowPick), x0 = rf[0][2], x1 = rf[rf.length - 1][2], cy = rf[0][3]; return Array.from({ length: nH }, (_, k) => [nH > 1 ? x0 + (x1 - x0) * k / (nH - 1) : x0, cy]); })()
      : free.sort((a, c) => c[0] - a[0] || a[1] - c[1]).slice(0, nH).map(([, , cx, cy]) => [cx, cy]);
    // 木は、家の並ぶ段には置かない(家に重ならないように)
    for (const [row, , cx, cy, , h] of free) if (row !== rowPick && h % 3 === 0) s += tree(cx, cy);
    return { svg: s, road: road + road2, arrows, W, H, village: vil || [px(.5), py(.5)], lots };
  }

  // ---------------------------------------------------------------- マス
  // 字の大きさ: 幅 130・高さ h の中に入る、いちばん大きな大きさ(12.5〜8.5)
  function fitSize(t, h) {
    const len = [...String(t)].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? .56 : 1), 0);
    for (let fs = 12.5; fs >= 8.5; fs -= .5) { const per = Math.floor(128 / fs) - 1, lines = Math.ceil(len / per) + (len > per * 2 ? 1 : 0); if (lines * fs * 1.32 <= h) return fs; }
    return 8.5;
  }
  function tile(q, grade) {
    const [bg, head, hc, fg = INK, edge = LINE] = LOOK(q, grade), x = px(q.x), y = py(q.row), big = ['payday', 'start', 'stop', 'goal', 'job', 'bonus'].includes(q.type);
    let inner;
    if (q.type === 'payday' || q.type === 'start') inner = `<div class="lh big" style="color:${fg}">${head}</div>${(q.type === 'start' ? q.label : q.note) ? `<div class="ls" style="color:${fg}">${money(q.type === 'start' ? q.label : q.note)}</div>` : ''}`;
    else if (q.type === 'stop' || q.type === 'goal') { const n = [...String(q.label)].length; inner = `<div class="lpill">${head}</div><div class="lstop" style="font-size:${n > 7 ? 13 : n > 5 ? 15 : 19}px">${E(q.label)}</div>`; }
    else if (q.type === 'job') inner = `<div class="lh" style="color:${hc}">${head}</div><div class="ljob" style="font-size:${(q.jobName || '').length > 8 ? 11.5 : (q.jobName || '').length > 6 ? 13 : 17}px">${E(q.jobName || '')}</div><div class="lsal">給料 $${Number(q.salary || 0).toLocaleString()}</div>`;
    else if (q.type === 'bonus') inner = `<div class="lh" style="color:${hc};font-size:15px">${head}</div>`;
    else { const txt = (q.tile || [])[grade] || q.label || ''; inner = `${head ? `<div class="lh" style="color:${hc}">${head}</div>` : ''}<div class="lt" style="color:${fg};font-size:${fitSize(txt, head ? 70 : 86)}px">${money(txt)}</div>`; }
    const dbl = q.type === 'stop' || q.type === 'goal';
    const I = 9;
    return `<g data-sq="${q.id}">${dbl ? `<rect x="${x + I - 6}" y="${y + I - 6}" width="${CW - 2 * I + 12}" height="${CH - 2 * I + 12}" rx="8" fill="${q.type === 'goal' ? '#fff' : YEL}" stroke="${LINE}" stroke-width="3"/>` : ''}<rect x="${x + I}" y="${y + I}" width="${CW - 2 * I}" height="${CH - 2 * I}" rx="7" fill="${bg}" stroke="${edge}" stroke-width="${dbl ? 4 : 3.5}"/>
      <foreignObject x="${x + I + 4}" y="${y + I + 3}" width="${CW - 2 * I - 8}" height="${CH - 2 * I - 6}"><div xmlns="http://www.w3.org/1999/xhtml" lang="ja" class="ltile ${big ? 'c' : ''}">${inner}</div></foreignObject>
      ${q.ticket ? `<g transform="translate(${x + CW - 40},${y + 3}) rotate(8)"><rect width="28" height="14" rx="3" fill="#7A3FC4"/><text x="14" y="10.5" font-size="9" font-weight="900" text-anchor="middle" fill="#fff">ゆめ券</text></g>` : ''}</g>`;
  }
  function lotSvg(hs, [x, y], owners, A) {
    // 家の絵: どれも幅およそ 110 に収め、正面と右の側面・屋根の側面で立体に見せる
    const own = owners.length, col = own ? COLS[owners[0]] : '#C9C2B0', ink = own ? LINE : '#8F887B';
    const wall = own ? '#FFFDF5' : '#ECE7DA', side = own ? '#DCD4BE' : '#D2CCBE', roofS = own ? `color-mix(in srgb,${col} 62%,#000)` : '#A9A396';
    const glass = own ? '#BFE6FF' : '#DCD7CB', wood = own ? '#8A5A2B' : '#B3A894', green = own ? '#5DB85A' : '#CBD0BE', water = own ? '#6CC5EE' : '#D3DCE0';
    const sw = `stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"`, D = 10, Dy = 6;
    // 箱(正面 + 右の側面)
    const blk = (x0, y0, w, h) => `<path d="M${x0 + w} ${y0}l${D} ${-Dy}v${h}l${-D} ${Dy}z" fill="${side}" ${sw}/><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${wall}" ${sw}/>`;
    // 切妻の屋根(正面の三角 + 右の屋根面)
    const gable = (x0, y0, w, h) => `<path d="M${x0 + w / 2} ${y0 - h}l${D} ${-Dy}L${x0 + w + 5 + D} ${y0 - Dy}L${x0 + w + 5} ${y0}z" fill="${roofS}" ${sw}/><path d="M${x0 - 5} ${y0}L${x0 + w / 2} ${y0 - h}L${x0 + w + 5} ${y0}z" fill="${col}" ${sw}/>`;
    // 寄棟の屋根(台形)
    const hip = (x0, y0, w, h) => `<path d="M${x0 + w - 12} ${y0 - h}l${D} ${-Dy}L${x0 + w + 6 + D} ${y0 - Dy}L${x0 + w + 6} ${y0}z" fill="${roofS}" ${sw}/><path d="M${x0 - 6} ${y0}L${x0 + 12} ${y0 - h}H${x0 + w - 12}L${x0 + w + 6} ${y0}z" fill="${col}" ${sw}/>`;
    const win = (x0, y0, w = 9, h = 9) => `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${glass}" stroke="${ink}" stroke-width="1.6"/><path d="M${x0 + w / 2} ${y0}v${h}M${x0} ${y0 + h / 2}h${w}" stroke="${ink}" stroke-width=".9"/>`;
    const door = (x0, y0, h = 15) => `<rect x="${x0}" y="${y0}" width="10" height="${h}" rx="1.5" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>`;
    const tree = (tx, ty, r) => `<rect x="${tx - 2.5}" y="${ty}" width="5" height="${r * .9}" fill="${wood}"/><circle cx="${tx}" cy="${ty - r * .2}" r="${r}" fill="${green}" ${sw}/>`;
    const G = y + 20; // 地面の高さ
    let art = '';
    switch (hs.id) {
      case 'mansion': art = blk(x - 24, G - 70, 48, 70) + `<path d="M${x - 24} ${G - 70}l${D} ${-Dy}h48l${-D} ${Dy}z" fill="${col}" ${sw}/>` + [0, 1, 2, 3, 4].map((r) => win(x - 17, G - 63 + r * 11, 8, 7) + win(x - 4, G - 63 + r * 11, 8, 7) + win(x + 9, G - 63 + r * 11, 8, 7)).join('') + door(x - 5, G - 10, 10); break;
      case 'cottage': art = blk(x - 22, G - 24, 44, 24) + gable(x - 22, G - 24, 44, 30) + `<rect x="${x + 10}" y="${G - 52}" width="7" height="14" fill="${wood}" ${sw}/>` + door(x - 5, G - 15) + win(x + 8, G - 18); break;
      case 'ikko': art = blk(x - 30, G - 30, 60, 30) + gable(x - 30, G - 30, 60, 28) + win(x - 22, G - 22) + win(x + 13, G - 22) + door(x - 5, G - 16) + win(x - 5, G - 50, 10, 8); break;
      case 'oka': art = `<path d="M${x - 60} ${G}C${x - 44} ${G - 4} ${x - 40} ${G - 32} ${x - 28} ${G - 32}H${x + 32}C${x + 44} ${G - 32} ${x + 48} ${G - 4} ${x + 62} ${G}z" fill="${green}" ${sw}/>` + blk(x - 18, G - 52, 36, 20) + gable(x - 18, G - 52, 36, 20) + win(x - 12, G - 46) + door(x + 3, G - 47, 15); break;
      // 庭つきの家: 家の横に、花の咲いた土地(ほかの家には土地がない)
      case 'niwa': { const soil = own ? '#B9824F' : '#C4BBA9', soilS = own ? '#8E5F35' : '#AAA190', L = x - 4, R = x + 46, T = G - 14;
        art = blk(x - 54, G - 30, 40, 30) + gable(x - 54, G - 30, 40, 24) + win(x - 48, G - 22) + door(x - 30, G - 16)
          + `<path d="M${L} ${G}H${R}V${G + 5}H${L}z" fill="${soilS}" ${sw}/><path d="M${R} ${G}L${R + 10} ${T}V${T + 5}L${R} ${G + 5}z" fill="${soilS}" ${sw}/>`
          + `<path d="M${L} ${G}L${L + 10} ${T}H${R + 10}L${R} ${G}z" fill="${soil}" ${sw}/>`
          + [[.5, 1], [1.5, 1], [2.5, 1], [3.5, 1], [0, 0], [1, 0], [2, 0], [3, 0]].map(([c, r], k) => { const fx = L + 9 + c * 11 + (1 - r) * 0 + r * 4, fy = G - 4 - r * 7, pc = own ? ['#FF7FA8', '#FFD94F', '#FF9A4D', '#FFFFFF', '#C59CFF'][k % 5] : '#D8D2C6';
            return `<path d="M${fx} ${fy}v-6" stroke="${own ? '#3F8F3A' : '#A9A396'}" stroke-width="1.6"/>` + [0, 72, 144, 216, 288].map((a) => `<circle cx="${(fx + 2.6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(fy - 7 + 2.6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2.1" fill="${pc}" stroke="${ink}" stroke-width=".6"/>`).join('') + `<circle cx="${fx}" cy="${fy - 7}" r="1.4" fill="${own ? '#F2B230' : '#BDB5A6'}"/>`; }).join(''); break; }
      case 'mizuumi': art = `<ellipse cx="${x + 28}" cy="${G - 4}" rx="26" ry="9" fill="${water}" ${sw}/><path d="M${x + 16} ${G - 5}q5 -3 10 0M${x + 30} ${G - 2}q5 -3 10 0" stroke="#fff" stroke-width="1.6" fill="none"/>`
        + blk(x - 52, G - 30, 40, 30) + gable(x - 52, G - 30, 40, 24) + win(x - 46, G - 22) + door(x - 30, G - 16); break;
      default: art = blk(x - 52, G - 34, 96, 34) + hip(x - 52, G - 34, 96, 18) + `<rect x="${x - 34}" y="${G - 60}" width="6" height="12" fill="${wood}" ${sw}/><rect x="${x + 24}" y="${G - 60}" width="6" height="12" fill="${wood}" ${sw}/>`
        + [0, 1, 2, 3].map((k) => win(x - 46 + k * 11, G - 26, 8, 9) + win(x + 4 + k * 10, G - 26, 8, 9)).join('') + `<path d="M${x - 14} ${G - 34}L${x - 4} ${G - 44}L${x + 6} ${G - 34}z" fill="${col}" ${sw}/>` + door(x - 9, G - 16, 16);
    }
    const lw = Math.max(90, [...`${hs.name} $${Number(hs.price).toLocaleString()}`].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 7.4 : 12.8), 0) + 16);
    const tags = owners.map((o, k) => `<g transform="translate(${x - 30 + k * 22},${y - 58})"><rect x="-14" y="-10" width="${Math.max(28, A.name(o).length * 11 + 8)}" height="18" rx="9" fill="${COLS[o]}" stroke="#fff" stroke-width="2"/><text x="${Math.max(28, A.name(o).length * 11 + 8) / 2 - 14}" y="3.5" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="2" paint-order="stroke">${E(A.name(o))}</text></g>`).join('');
    return `<g class="lot ${own ? 'owned' : ''}"><ellipse cx="${x}" cy="${y + 22}" rx="56" ry="9" fill="#000" opacity=".12"/>${art}<g transform="translate(${x},${y + 38})"><rect x="${-lw / 2}" y="-11" width="${lw}" height="22" rx="6" fill="${own ? '#FFF8DC' : 'rgba(255,255,255,.75)'}" stroke="${own ? LINE : '#9A9184'}" stroke-width="2"/><text y="5" font-size="12.5" font-weight="900" text-anchor="middle" fill="${own ? INK : '#6E665A'}">${E(hs.name)} $${Number(hs.price).toLocaleString()}</text></g>${tags}</g>`;
  }
  // スタート: 左と下の余白まで広げた大きなマス(4 人の駒が並べる)
  const START_PAD = 60;
  function startTile(q) { const x = px(q.x) + 9 - START_PAD, y = py(q.row) + 9, w = CW - 18 + START_PAD, h = CH - 18 + START_PAD;
    return `<g data-sq="${q.id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#2F9E56" stroke="#0F4D26" stroke-width="3.5"/><text x="${x + w / 2}" y="${y + 26}" font-size="22" font-weight="900" text-anchor="middle" fill="#fff">スタート</text><text x="${x + w / 2}" y="${y + 44}" font-size="11" font-weight="700" text-anchor="middle" fill="#fff">$5,000 もらって出発</text></g>`; }
  // コマ(頭と体のある人形。番の人は大きく光る)
  const pawnSvg = (x, y, col, turn, i, me, nm = '', tagUp = 0, nameW = Math.max(36, [...nm].length * 11 + 12)) => `<g class="lpawn ${turn ? 'turn' : ''}" data-pawn="${i}" transform="translate(${x},${y}) scale(1.3)">
    ${turn ? `<circle r="36" cy="-8" fill="url(#lglow)" class="halo"/>` : ''}
    <path d="M-14 16Q-15 -2 -6 -5H6Q15 -2 14 16Z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cy="-14" r="11" fill="none" stroke="#fff" stroke-width="7"/>
    <g transform="translate(0,${26 - tagUp})"><rect x="${-(nameW / 2)}" y="-11" width="${nameW}" height="18" rx="9" fill="${col}" stroke="#fff" stroke-width="${me ? 3 : 2}"/><text y="3.5" font-size="11.5" font-weight="900" text-anchor="middle" fill="#fff">${E(nm)}</text><path d="M-4 -8L0 -14L4 -8Z" fill="${col}"/></g>
    <ellipse cx="0" cy="17" rx="15" ry="5" fill="#000" opacity=".3"/>
    <path d="M-14 16Q-15 -2 -6 -5H6Q15 -2 14 16Z" fill="${col}" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M-9 13Q-10 0 -4 -2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>
    <circle cy="-14" r="11" fill="#FFE2C4" stroke="${LINE}" stroke-width="2.6"/>
    <path d="M-11 -16Q-10 -27 0 -26Q10 -27 11 -16Q5 -21 0 -20Q-5 -21 -11 -16Z" fill="${col}" stroke="${LINE}" stroke-width="2"/>
    <circle cx="-4" cy="-13" r="1.7" fill="${LINE}"/><circle cx="4" cy="-13" r="1.7" fill="${LINE}"/><path d="M-3 -8Q0 -6 3 -8" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/></g>`;

  // ---------------------------------------------------------------- ルーレット(右の欄)
  const wheelAngle = (n) => -((n - 1) * 36 + 18);
  function wheelSvg(last) {
    let seg = '';
    for (let k = 0; k < 10; k++) { const a0 = (k * 36 - 90) * Math.PI / 180, a1 = ((k + 1) * 36 - 90) * Math.PI / 180, am = (a0 + a1) / 2, tx = 34 * Math.cos(am), ty = 34 * Math.sin(am);
      seg += `<path d="M0 0L${(46 * Math.cos(a0)).toFixed(2)} ${(46 * Math.sin(a0)).toFixed(2)}A46 46 0 0 1 ${(46 * Math.cos(a1)).toFixed(2)} ${(46 * Math.sin(a1)).toFixed(2)}Z" fill="${WHEEL[k]}" stroke="#fff" stroke-width="1.2"/><text x="${tx.toFixed(2)}" y="${(ty + 5).toFixed(2)}" font-size="14" font-weight="900" text-anchor="middle" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="2.5" paint-order="stroke" transform="rotate(${k * 36 + 18} ${tx.toFixed(2)} ${ty.toFixed(2)})">${k + 1}</text>`; }
    return `<svg viewBox="-58 -62 116 120"><circle r="54" fill="${LINE}"/><circle r="51" fill="none" stroke="#C99A55" stroke-width="2"/><g class="wr" style="transform:rotate(${last > 0 ? wheelAngle(last) : 0}deg)">${seg}</g><circle r="13" fill="#FFFDF5" stroke="${LINE}" stroke-width="3"/><path d="M-9 -60H9L0 -42Z" fill="${RED}" stroke="#fff" stroke-width="1.6"/></svg>`;
  }

  // ---------------------------------------------------------------- 盤の動かし方(拡大・縮小・移動)
  const view = { z: 0, tx: 0, ty: 0, h: -1, follow: -1 };
  function apply(el, inner, W, H) {
    const vw = el.clientWidth, vh = el.clientHeight, zmin = Math.min(vw / W, vh / H);
    view.z = Math.min(2.2, Math.max(zmin, view.z));
    const cl = (t, s, v) => s <= v ? (v - s) / 2 : Math.min(28, Math.max(v - s - 28, t));
    view.tx = cl(view.tx, W * view.z, vw); view.ty = cl(view.ty, H * view.z, vh);
    view.tx = Math.round(view.tx); view.ty = Math.round(view.ty);
    const svg = inner.firstElementChild;
    if (svg && !view.live) { svg.setAttribute('width', Math.round(W * view.z)); svg.setAttribute('height', Math.round(H * view.z)); view.zc = view.z; }
    inner.style.transform = view.live && view.zc ? `translate(${view.tx}px,${view.ty}px) scale(${view.z / view.zc})` : `translate(${view.tx}px,${view.ty}px)`;
  }
  function centerOn(el, inner, W, H, x, y, smooth) {
    view.tx = el.clientWidth / 2 - x * view.z; view.ty = el.clientHeight / 2 - y * view.z;
    inner.style.transition = smooth ? 'transform .45s ease' : ''; apply(el, inner, W, H); if (smooth) setTimeout(() => (inner.style.transition = ''), 480);
  }

  // ---------------------------------------------------------------- 本体
  let board = null, bh = -1, guess = 0, bet = [], seen = null, anim = null, sc = null, stopState = null;
  function life(b, A) {
    if (bh !== A.handle) { bh = A.handle; board = null; guess = 0; bet = []; seen = null; sc = null; view.h = -1; A.call('lifeBoardJson', A.handle).then((t) => { board = JSON.parse(t); A.redraw(); }); }
    const fmt = (v) => '$' + Number(v).toLocaleString();
    const nm = (t) => E(String(t).replace(/\[(\d)]/g, (_, i) => A.name(+i)));
    // 席の一覧: 持ち物はいつも同じ並び・枠つき
    A.strip(b.players.map((p, i) => `<div class="pl lpl ${i === b.turn && b.phase !== 9 ? 'turn' : ''}"><span class="dot" style="background:${COLS[i]}"></span><span class="who"><span class="nm">${E(A.name(i))}${p.finish ? `<i class="lfin">${p.finish}着</i>` : ''}</span>
      <span class="ljob2"><i>職業</i><b>${E(p.job)}</b></span><span class="lchips"><span class="lc"><i class="ic-t"></i>券<b>${p.tickets}</b></span><span class="lc"><i class="ic-c"></i>子<b>${Math.max(0, p.children)}</b></span><span class="lc ${p.loans ? 'warn' : ''}"><i class="ic-l"></i>手形<b>${p.loans}</b></span></span></span><span class="num lmoney">${fmt(p.money)}${p.salary ? `<small>給料 ${fmt(p.salary)}</small>` : ''}</span></div>`).join(''));
    const spinMove = b.guessing ? (guess ? 200 + guess : -1) : 0, canSpin = A.view.human && spinMove >= 0 && A.view.legal.includes(spinMove);
    const cpuSpin = !A.view.human && b.canSpin;
    // 右の欄: ボタン 2 つと、大きなルーレット
    A.side(`<div class="lside"><div class="lbtns"><button class="btn gold ${cpuSpin && A.remoteTurn ? 'waiting' : ''}" data-spin="1" ${canSpin || (cpuSpin && A.remoteTurn) ? '' : 'disabled'}>ルーレット</button><button class="btn" data-repay="1" ${b.canRepay && A.view.human ? '' : 'disabled'}>手形を返す</button></div>
      <button class="lwheel ${canSpin ? 'can' : 'off'}" data-spin="1" aria-label="ルーレット">${wheelSvg(b.lastSpin)}</button></div>`, (d) => {
      if (!A.view.human) return;
      if (d.spin != null) { if (anim) { anim.finish(); return; } if (canSpin) A.play(spinMove); return; }
      if (d.repay != null && b.canRepay) return A.play(3);
    });
    if (!board) { A.board('<div class="empty">盤を読み込んでいます…</div>', () => {}); return; }
    if (!sc || sc.h !== A.handle || sc.grade !== b.grade) sc = Object.assign(scenery(board, b.grade), { h: A.handle, grade: b.grade });
    JOBS = [...new Set(board.squares.map((q) => q.jobName).filter(Boolean))];
    const P = (id) => { const q = board.squares[id]; return q ? [px(q.x) + CW / 2, py(q.row) + CH / 2] : sc.village; };
    const tiles = board.squares.map((q) => q.type === 'start' ? startTile(q) : tile(q, b.grade)).join('');
    // マスの文が隠れないよう、駒はマスの下のふちに立たせる
    const isStart = (p) => !p.village && board.squares[p.pos] && board.squares[p.pos].type === 'start';
    const pawns = b.players.map((p, i) => { const [x, y] = p.village ? sc.village : P(p.pos); const k = b.players.slice(0, i).filter((o) => o.pos === p.pos && !!o.village === !!p.village).length;
      if (isStart(p)) return pawnSvg(x - START_PAD / 2 - 66 + (k % 4) * 44, y + 62 + Math.floor(k / 4) * 30, COLS[i], i === b.turn && b.phase !== 9, i, i === A.mySeat, i === A.mySeat ? 'あなた' : A.name(i), (k % 2) * 17);
      return pawnSvg(x - 45 + k * 30,  y + CH / 2 - 6 - (k % 2) * 4, COLS[i], i === b.turn && b.phase !== 9, i, i === A.mySeat, i === A.mySeat ? 'あなた' : A.name(i), k * 15); });
    // 番の人を最後に描く(いちばん上)
    const order = b.players.map((_, i) => i).sort((a, c) => (a === b.turn) - (c === b.turn));
    const svg = `<svg viewBox="0 0 ${sc.W} ${sc.H}" width="${sc.W}" height="${sc.H}"><defs><radialGradient id="lglow"><stop offset="0" stop-color="#FFF6B0" stop-opacity=".95"/><stop offset=".55" stop-color="#FFD94F" stop-opacity=".55"/><stop offset="1" stop-color="#FFD94F" stop-opacity="0"/></radialGradient></defs>${sc.svg}${sc.road}${tiles}${sc.arrows}${(board.houses || []).map((hs, k) => sc.lots[k] ? lotSvg(hs, sc.lots[k], b.players.map((p, i) => (p.house === hs.name ? i : -1)).filter((i) => i >= 0), A) : '').join('')}${order.map((i) => pawns[i]).join('')}<rect x="6" y="6" width="${sc.W - 12}" height="${sc.H - 12}" rx="22" fill="none" stroke="${YEL}" stroke-width="6"/></svg>`;
    // 止まったマスのカード(選ぶことがある時)は、盤の真ん中に大きく
    const q0 = board.squares[b.players[b.turn] ? b.players[b.turn].pos : 0];
    const look = q0 ? LOOK(q0, b.grade) : [CREAM, '', INK];
    const card = b.choices.length || b.title ? `<div class="lcard" id="lcard"><div class="lcard-h" style="background:${look[0]};color:${look[3] || INK}">${E(b.title || look[1] || '')}</div>${b.text ? `<p>${money(nm(b.text)).replace(/&amp;/g, '&')}</p>` : ''}<div class="lchoices">${b.choices.map(([m, l, strong, en]) => `<button class="btn ${strong ? 'gold' : ''} ${!A.view.human ? 'cpuview' : ''}" data-lm="${m}" ${en ? '' : 'disabled'} ${!A.view.human ? 'tabindex="-1"' : ''}>${nm(l)}</button>`).join('')}</div>
      ${b.bet && A.view.human ? `<div class="lgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="btn ${bet.includes(n) ? 'gold' : ''}" data-bet="${n}">${n}</button>`).join('')}</div><div class="lchoices"><button class="btn gold" data-betgo="1" ${bet.length === 2 ? '' : 'disabled'}>この 2 つで回す</button></div>` : ''}</div>` : '';
    const gcard = b.guessing && A.view.human ? `<div class="lcard"><div class="lcard-h" style="background:${YEL}">夢の山の頂上</div><p>数を 1 つ決めて、ルーレットを回します。当たれば <b>$20,000</b>。</p><div class="lgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="btn ${guess === n ? 'gold' : ''}" data-guess="${n}">${n}</button>`).join('')}</div></div>` : '';
    const log = b.log.length ? `<div class="llog">${b.log.slice(-3).map((l, k, a) => `<div class="${k === a.length - 1 ? 'new' : ''}">${money(nm(l)).replace(/&amp;/g, '&')}</div>`).join('')}</div>` : '';
    A.board(`<div class="lifewrap2"><div class="lview" id="lview"><div class="linner">${svg}</div></div><div class="lzoom" id="lzoom" aria-label="拡大縮小"><button type="button" data-zf="1.25" aria-label="拡大">＋</button><button type="button" data-zf="0.8" aria-label="縮小">－</button><button type="button" data-zf="0" aria-label="現在位置へ">◎</button></div>${card}${gcard}<div class="lstopcard" id="lstop" hidden></div><div class="lstopcard lsqcard" id="lsq" hidden></div></div>`, (d) => {
      if (d.sqclose != null) { const e = document.getElementById('lsq'); if (e && !e.hidden) { e.hidden = true; A.sfx('BACK'); } return; }
      if (d.stopok != null) { const sEl = document.getElementById('lstop'); if (sEl) sEl.classList.add('out'); stopState = null; A.animClear(); return; }
      if (!A.view.human) return;
      if (d.lm != null) return A.play(+d.lm);
      if (d.guess != null) { guess = +d.guess; return A.redraw(); }
      if (d.bet != null) { const n = +d.bet; bet = bet.includes(n) ? bet.filter((x) => x !== n) : bet.concat([n]).slice(-2); return A.redraw(); }
      if (d.betgo != null && bet.length === 2) { const m = 300 + (Math.min(...bet) - 1) * 10 + (Math.max(...bet) - 1); if (A.view.legal.includes(m)) A.play(m); }
    });
    // 説明の「OK」「閉じる」は、演出の待ち時間(盤のクリックを止めている間)でも効くよう、札で直接受ける
    { const sEl = document.getElementById('lstop'), qEl = document.getElementById('lsq');
      if (sEl) sEl.onclick = (e) => { if (!e.target.closest('[data-stopok]')) return; e.stopPropagation(); sEl.classList.add('out'); clearTimeout(showStop.t); showStop.t = setTimeout(() => { if (sEl.isConnected && sEl.classList.contains('out')) sEl.hidden = true; }, 350); stopState = null; A.animClear(); };
      if (qEl) qEl.onclick = (e) => { if (!e.target.closest('[data-sqclose]')) return; e.stopPropagation(); if (!qEl.hidden) { qEl.hidden = true; A.sfx('BACK'); } }; }
    const el = document.getElementById('lview'), inner = el.firstElementChild;
    // 止まったマスの説明(ルールを開くなどで描き直しても、残りの時間だけ出す)
    const showStop = () => { const st = stopState, sEl = document.getElementById('lstop'); if (!st || !sEl || st.h !== A.handle) return; const now = performance.now(), left = st.start + st.ms - now; if (left <= 0) { stopState = null; return; }
      if (now < st.start) { setTimeout(showStop, st.start - now); return; }
      sEl.innerHTML = st.html; sEl.hidden = false; sEl.classList.remove('out'); const bar = sEl.querySelector('.lbar i'); if (bar) bar.animate([{ transform: `scaleX(${left / st.ms})` }, { transform: 'scaleX(0)' }], { duration: left, easing: 'linear', fill: 'forwards' });
      clearTimeout(showStop.t); showStop.t = setTimeout(() => { if (sEl.isConnected) sEl.classList.add('out'); if (stopState === st) stopState = null; showStop.t = setTimeout(() => { if (sEl.isConnected && sEl.classList.contains('out')) sEl.hidden = true; }, 350); }, left); };
    setTimeout(showStop, 0);
    const W = sc.W, H = sc.H;
    // 初めて: 幅に合わせて、番の人の所へ
    if (view.h !== A.handle) { view.h = A.handle; view.z = Math.max(el.clientWidth / W, Math.min(el.clientWidth / W, el.clientHeight / H)); view.follow = -1; }
    apply(el, inner, W, H);
    // 拡大・縮小・現在位置へボタン(スマホ向け)
    const lz = document.getElementById('lzoom');
    if (lz) lz.onclick = (e) => {
      const btn = e.target.closest('[data-zf]'); if (!btn) return;
      e.stopPropagation();
      const f = +btn.dataset.zf, zmin = Math.min(el.clientWidth / W, el.clientHeight / H), z0 = view.z;
      if (f === 0) {
        view.z = Math.max(el.clientWidth / W, zmin);
        const curP = b.players[b.turn];
        if (curP) { const [x, y] = curP.village ? sc.village : P(curP.pos); centerOn(el, inner, W, H, x, y, true); return; }
      } else {
        const mx = el.clientWidth / 2, my = el.clientHeight / 2;
        view.z = Math.min(2.2, Math.max(zmin, z0 * f));
        view.tx = mx - (mx - view.tx) * view.z / z0; view.ty = my - (my - view.ty) * view.z / z0;
      }
      inner.style.transition = ''; view.live = false; apply(el, inner, W, H);
    };
    // ホイールで拡大・縮小(カーソルの所が中心)
    el.onwheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z0 = view.z; const zmin = Math.min(el.clientWidth / W, el.clientHeight / H);
      view.z = Math.min(2.2, Math.max(zmin, z0 * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); view.tx = mx - (mx - view.tx) * view.z / z0; view.ty = my - (my - view.ty) * view.z / z0; inner.style.transition = '';
      view.live = true; if (!view.raf) view.raf = requestAnimationFrame(() => { view.raf = 0; apply(el, inner, W, H); });
      clearTimeout(view.idle); view.idle = setTimeout(() => { view.live = false; apply(el, inner, W, H); }, 180); };
    // ドラッグで移動 + ピンチ拡大縮小
    const pts = new Map();
    let pinch0 = null;
    el.onpointerdown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()], r = el.getBoundingClientRect();
        pinch0 = { d: Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y)), z: view.z, tx: view.tx, ty: view.ty, mx: (p1.x + p2.x) / 2 - r.left, my: (p1.y + p2.y) / 2 - r.top };
        el.onpointermove = (ev) => {
          pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (pts.size < 2 || !pinch0) return;
          const [q1, q2] = [...pts.values()], d = Math.hypot(q2.x - q1.x, q2.y - q1.y), zmin = Math.min(el.clientWidth / W, el.clientHeight / H);
          view.z = Math.min(2.2, Math.max(zmin, pinch0.z * (d / pinch0.d)));
          view.tx = pinch0.mx - (pinch0.mx - pinch0.tx) * view.z / pinch0.z;
          view.ty = pinch0.my - (pinch0.my - pinch0.ty) * view.z / pinch0.z;
          view.live = true; inner.style.transition = ''; apply(el, inner, W, H);
        };
        el.onpointerup = el.onpointercancel = (ev) => { pts.delete(ev.pointerId); if (pts.size < 2) { pinch0 = null; view.live = false; apply(el, inner, W, H); el.onpointermove = null; } };
        return;
      }
      const sx = e.clientX, sy = e.clientY, tx0 = view.tx, ty0 = view.ty; let moved = false;
      el.onpointermove = (ev) => { if (pts.size > 1) return; const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; el.classList.add('drag'); view.tx = tx0 + dx; view.ty = ty0 + dy; inner.style.transition = ''; apply(el, inner, W, H); };
      el.onpointerup = el.onpointercancel = (ev) => { pts.delete(ev.pointerId); if (pts.size) return; el.onpointermove = null; el.classList.remove('drag'); if (ev.type === 'pointercancel' || moved) return;
        // 説明が出ている時は、盤のどこを押しても(ほかのマスでも)閉じるだけ
        const open = document.getElementById('lsq'); if (open && !open.hidden) { open.hidden = true; A.sfx('BACK'); return; }
        const t = document.elementsFromPoint(ev.clientX, ev.clientY).map((x) => x.closest && x.closest('[data-sq]')).find(Boolean); if (t) { A.sfx('TAP'); showSquare(+t.dataset.sq); } }; };
    const showSquare = (id) => { const q = board.squares[id]; if (!q) return; const lk = LOOK(q, b.grade), sEl = document.getElementById('lsq'); if (!sEl) return;
      sEl.innerHTML = `<div class="lcard-h" style="background:${lk[0]};color:${lk[3] || INK}">${E(lk[1] || 'マス')}</div><p>${money((q.texts || [])[b.grade] || q.text)}</p>${q.ticket ? '<div class="lsqticket"><span class="lbadge-t">ゆめ券</span>止まると、ゆめチケットも1枚もらえる。</div>' : ''}<div class="lstopfoot"><span></span><button class="btn gold lok" data-sqclose="1">閉じる</button></div>`; sEl.hidden = false; };
    // 番が変わった時は、番の人の所へ
    const me0 = b.players[b.turn];
    if (view.follow !== b.turn && me0) { view.follow = b.turn; const [x, y] = me0.village ? sc.village : P(me0.pos); centerOn(el, inner, W, H, x, y, true); }
    // ルーレットが回って、駒が 1 マスずつ進む。止まったマスを真ん中に大きく出す
    const s0 = seen; seen = { spins: b.spins, pos: b.players.map((p) => p.pos) };
    if (s0 && b.spins !== s0.spins && b.lastSpin > 0) {
      const wr = document.querySelector('#sidenote .wr'), dur = 1500 * A.speed;
      const lc = document.getElementById('lcard'); if (lc) { lc.hidden = true; }
      if (wr) { wr.style.transformOrigin = '0 0'; anim = wr.animate([{ transform: `rotate(${wheelAngle(b.lastSpin) - 360 * 4 - 17}deg)` }, { transform: `rotate(${wheelAngle(b.lastSpin)}deg)` }], { duration: dur, easing: 'cubic-bezier(.15,.6,.25,1)' }); anim.onfinish = () => { anim = null; }; A.sfx('SPIN'); }
      const who = b.players.findIndex((p, i) => p.pos !== s0.pos[i]);
      let walk = 0, stopMs = 0;
      if (who >= 0) {
        const pe = document.querySelector(`#boardwrap [data-pawn="${who}"]`), path = b.path && b.path.length ? b.path : [b.players[who].pos];
        const pts = [s0.pos[who], ...path.filter((id) => id !== s0.pos[who])].map(P), end = pts[pts.length - 1];
        if (pe && pts.length > 1) {
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); pe.parentNode.appendChild(g); g.appendChild(pe);
          const glowEls = [...document.querySelectorAll('#boardwrap .lpawn.turn')]; glowEls.forEach((e) => e.classList.add('noglow')); pe.classList.add('walking');
          setTimeout(() => { glowEls.forEach((e) => e.classList.remove('noglow')); pe.classList.remove('walking'); }, dur + Math.min(2600, 280 * (pts.length - 1)) * A.speed);
          walk = Math.min(2600, 280 * (pts.length - 1)) * A.speed;
          const fr = []; pts.forEach(([x, y], k) => { fr.push({ transform: `translate(${x - end[0]}px,${y - end[1]}px)`, offset: k / (pts.length - 1) }); if (k < pts.length - 1) { const [x2, y2] = pts[k + 1]; fr.push({ transform: `translate(${(x + x2) / 2 - end[0]}px,${(y + y2) / 2 - end[1] - 26}px)`, offset: (k + .5) / (pts.length - 1) }); } });
          fr.sort((a, c) => a.offset - c.offset); g.animate(fr, { duration: walk, delay: dur, easing: 'linear', fill: 'backwards' });
          for (let k = 1; k < pts.length; k++) A.sfx('WOOD', (dur + walk * k / (pts.length - 1)) / A.speed - 20, { volume: .6 });
        }
        // 止まったマス
        const q = board.squares[b.players[who].pos];
        if (q && !card) { const lk = LOOK(q, b.grade), canOk = !(A.isOnline && who !== A.mySeat);
          const html = `<div class="lcard-h" style="background:${lk[0]};color:${lk[3] || INK}"><span class="lwho" style="background:${COLS[who]}">${E(A.name(who))}</span>${E(lk[1] || 'マス')}</div><p>${money((q.texts || [])[b.grade] || q.text)}</p><div class="lstopfoot"><span class="lbar"><i></i></span>${canOk ? '<button class="btn gold lok" data-stopok="1">OK</button>' : ''}</div>`;
          stopState = { html, start: performance.now() + dur + walk, ms: 6000, h: A.handle }; stopMs = 6000; }
      }
      { const lc = document.getElementById('lcard'); if (lc) setTimeout(() => { if (lc.isConnected) lc.hidden = false; }, dur + walk + 100); }
      A.anim(dur / A.speed + walk / A.speed + 300 + stopMs); A.land(-1);
    } else A.land(-1);
  }
  window.RENDER.life = life;
})();
