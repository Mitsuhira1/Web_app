/* ルール動画の注釈(録画の時だけページに入れる。アプリ本体には入れない)。
 * 時間はすべて「動画の上の時間(ミリ秒)」で書く。ページの時計はゆっくり流しているので、ここで換算する。
 * 守ること(ユーザーの指示 2026-11-28):
 *  - 説明の文は、とげ(しっぽ)の無い札にする。矢印は「動きの向き」を見せる時だけ使い、文と矢印を両方つけない
 *  - 差す物が画面に出てから出す(先に出さない)
 *  - カットイン・結果の画面が出ている間は、注釈を全部隠す(上に重ねない)
 *  - ゆっくり。文は最低 4 秒は出す
 */
(() => {
  'use strict';
  const K = window.__TUT_K || 1; // ページの時間 = 動画の時間 × K
  const AC = '#1F9BFF', AC_DARK = '#0B6FC2', NG = '#E8432E';
  const T = (window.T = {});
  T.K = K;
  T.sleep = (ms) => new Promise((r) => setTimeout(r, ms * K));
  T.until = async (fn, maxMs = 60000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > maxMs * K) throw new Error('until: ' + fn); await T.sleep(40); } };
  const css = `
  #tut{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:"Zen Maru Gothic",sans-serif;transition:opacity ${300 * K}ms ease}
  #tut.hide{opacity:0}
  #tut svg{position:absolute;left:0;top:0;overflow:visible}
  .tut-fade{opacity:0;transition:opacity ${450 * K}ms ease, transform ${450 * K}ms cubic-bezier(.2,.9,.3,1)}
  .tut-fade.on{opacity:1}
  .tut-ring{transform-box:fill-box;transform-origin:center;transform:scale(1.12)}
  .tut-ring.on{transform:scale(1)}
  .tut-ring.on .tut-pulse{animation:tutPulse ${1600 * K}ms ease-in-out infinite}
  @keyframes tutPulse{0%,100%{opacity:1}50%{opacity:.55}}
  .tut-cap{position:absolute;left:50%;bottom:52px;max-width:820px;transform:translate(-50%,10px);box-sizing:border-box;
    background:rgba(255,253,247,.97);color:#2A1C0C;border-radius:18px;padding:14px 26px 15px 22px;border-left:8px solid ${AC};
    font-size:28px;line-height:1.42;font-weight:700;letter-spacing:.02em;box-shadow:0 10px 30px rgba(40,25,10,.28);white-space:nowrap;text-align:left}
  .tut-cap.on{transform:translate(-50%,0)}
  .tut-cap.tut-side{left:auto;bottom:auto;transform:translateY(8px);white-space:normal;word-break:auto-phrase;line-break:strict;font-size:25px;line-height:1.55;padding:14px 18px 15px 18px;max-width:none}
  .tut-cap.tut-side.on{transform:none}
  .tut-cap em{font-style:normal;color:#D9541A;font-weight:900;display:inline;font-size:inherit;margin:0;padding:0}
  .tut-lab{position:absolute;transform:translate(-50%,-50%) scale(.9);background:#fff;color:${AC_DARK};border:3px solid ${AC};border-radius:999px;
    padding:3px 16px 4px;font-size:23px;font-weight:900;white-space:nowrap;box-shadow:0 5px 14px rgba(0,0,0,.3)}
  .tut-lab.on{transform:translate(-50%,-50%) scale(1)}
  .tut-lab.ng{color:${NG};border-color:${NG}}
  .tut-badge{position:absolute;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:${AC};color:#fff;border:3px solid #fff;box-sizing:border-box;
    display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,.4);transform:scale(0);opacity:1;
    transition:transform ${260 * K}ms cubic-bezier(.3,1.7,.5,1), opacity ${400 * K}ms ease}
  .tut-badge.on{transform:scale(1)}
  .tut-badge.off{opacity:0}
  .tut-cur{position:absolute;left:0;top:0;width:44px;height:44px;transition:transform ${900 * K}ms cubic-bezier(.45,.05,.25,1), opacity ${300 * K}ms ease;opacity:0}
  .tut-cur.on{opacity:1}
  .tut-cur svg{position:static;transition:transform ${120 * K}ms ease;transform-origin:6px 4px}
  .tut-cur.down svg{transform:scale(.82)}
  .tut-rip{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:4px solid ${AC};box-sizing:border-box;animation:tutRip ${600 * K}ms ease-out forwards}
  @keyframes tutRip{from{transform:scale(.4);opacity:1}to{transform:scale(3.4);opacity:0}}
  .tut-draw{transition:stroke-dashoffset ${900 * K}ms cubic-bezier(.4,0,.2,1)}
  `;
  const root = document.createElement('div'); root.id = 'tut';
  root.innerHTML = `<style>${css}</style><svg width="1280" height="720" viewBox="0 0 1280 720"><defs>
    <filter id="tutGlow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
    <marker id="tutHead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0L10 5L0 10z" fill="${AC}"/></marker>
    <marker id="tutHeadW" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.2" markerHeight="2.2" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M-1 -1.4L11.6 5L-1 11.4z" fill="#fff"/></marker>
  </defs><g id="tutG"></g></svg>`;
  document.body.appendChild(root);
  const G = root.querySelector('#tutG');
  const items = new Map();
  const on = (el) => { el.getBoundingClientRect(); el.classList.add('on'); };
  const fadeOut = (el) => { el.classList.remove('on'); setTimeout(() => el.remove(), 500 * K); };

  // カットイン・結果の画面が出ている間は、注釈を全部隠す
  const blocked = () => !!document.querySelector('#cutlayer .cutin') || (document.querySelector('#result') && !document.querySelector('#result').hidden);
  T.blocked = blocked;
  (function watch() { root.classList.toggle('hide', blocked()); requestAnimationFrame(watch); })();
  T.noCut = () => T.until(() => !document.querySelector('#cutlayer .cutin'));

  // ---- 盤の座標(マンカラ。js/boards/fix.js の pos と同じ。自分は先手=下の列)
  const svgEl = () => document.querySelector('#boardwrap svg');
  T.pt = (x, y) => { const m = svgEl().getScreenCTM(); const p = new DOMPoint(x, y).matrixTransform(m); return [p.x, p.y]; };
  T.k = () => svgEl().getScreenCTM().a;
  const pos = (i) => i <= 5 ? [170 + i * 92, 262] : i === 6 ? [730, 190] : i <= 12 ? [170 + (12 - i) * 92, 118] : [70, 190];
  T.pos = pos;
  // 形: {c:[x,y],r} 円 / {c,rx,ry} だ円 / {x,y,w,h,rr} 角丸の四角(すべて盤の座標) / {el} 画面の部品
  T.shape = {
    pit: (i, pad = 11) => (i === 6 || i === 13) ? { c: pos(i), rx: 40 + pad - 2, ry: 118 + 3 } : { c: pos(i), r: 38 + pad }, // 倉は上の数の札にかからないよう、縦はほぼ同じ大きさ
    row: (side) => { const y = side === 0 ? 262 : 118; return { x: 170 - 50, y: y - 50, w: 5 * 92 + 100, h: 100, rr: 50 }; },
  };
  const toPage = (sh) => {
    if (sh.page) return sh.page;
    if (sh.els) { // いくつかの部品をまとめて囲む
      const rs = (typeof sh.els === 'string' ? [...document.querySelectorAll(sh.els)] : sh.els).map((e) => e.getBoundingClientRect()); const p = sh.pad ?? 6;
      const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top)), r2 = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom));
      return { x: l - p, y: t - p, w: r2 - l + p * 2, h: b - t + p * 2, rr: sh.rr ?? 12 };
    }
    if (sh.el) { const r = (typeof sh.el === 'string' ? document.querySelector(sh.el) : sh.el).getBoundingClientRect(); const p = sh.pad ?? 6; return { x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2, rr: sh.rr ?? 14 }; }
    const k = T.k();
    if (sh.r != null) { const [x, y] = T.pt(...sh.c); return { cx: x, cy: y, r: sh.r * k }; }
    if (sh.rx != null) { const [x, y] = T.pt(...sh.c); return { cx: x, cy: y, rx: sh.rx * k, ry: sh.ry * k }; }
    const [x, y] = T.pt(sh.x, sh.y); return { x, y, w: sh.w * k, h: sh.h * k, rr: sh.rr * k };
  };
  const shapeSvg = (p, attrs) => p.r != null ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" ${attrs}/>` : p.rx != null ? `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" ${attrs}/>` : `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rr}" ${attrs}/>`;
  T.center = (sh) => { const p = toPage(sh); return p.r != null || p.rx != null ? [p.cx, p.cy] : [p.x + p.w / 2, p.y + p.h / 2]; };

  // ---- 囲み(差す物と同じ形・ほぼ同じ大きさ)
  T.ring = (id, sh, o = {}) => {
    T.clear(id);
    const p = toPage(sh), col = o.ng ? NG : AC;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'tut-fade tut-ring');
    g.innerHTML = shapeSvg(p, `fill="none" stroke="#fff" stroke-width="11" filter="url(#tutGlow)"`) + `<g class="tut-pulse">${shapeSvg(p, `fill="none" stroke="${col}" stroke-width="6" ${o.dash ? 'stroke-dasharray="14 9"' : ''}`)}</g>`;
    G.appendChild(g); on(g); items.set(id, g);
  };
  // ---- かぶりを調べる(ユーザーの指示 2026-11-28: 名札・説明の札・番号を、ほかの物にかぶせない)。
  // T.avoid([...セレクタ]) で避ける物を決める。かぶったら録画を止める(エラー)。囲み同士・囲みと差す物は調べない
  T.avoidSel = null;
  T.avoid = (sels) => { T.avoidSel = sels; };
  const b4rect = (el) => { // 出し終わった時の形(出る途中の縮み・ずれを除く)
    const cs = getComputedStyle(el), w = el.offsetWidth, h = el.offsetHeight, l = parseFloat(el.style.left), t = parseFloat(el.style.top);
    if (el.classList.contains('tut-lab') || el.classList.contains('tut-badge')) return { l: l - w / 2, t: t - h / 2, r: l + w / 2, b: t + h / 2 };
    if (el.classList.contains('tut-side')) return { l, t, r: l + w, b: t + h };
    const r = el.getBoundingClientRect(); return { l: r.left, t: r.top - (parseFloat(cs.transform.split(',')[5]) || 0), r: r.right, b: r.bottom };
  };
  const hit = (a, b, m = 2) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > m && Math.min(a.b, b.b) - Math.max(a.t, b.t) > m;
  T.check = (el, rc) => {
    if (!T.avoidSel) return;
    const name = '「' + el.textContent.slice(0, 16) + '」';
    for (const sel of T.avoidSel) for (const e of document.querySelectorAll(sel)) {
      if (root.contains(e)) continue; const q = e.getBoundingClientRect(); if (!q.width || !q.height) continue;
      { const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); // 上に出た画面(一覧など)で隠れている物は調べない
        if (top && !e.contains(top) && !top.contains(e) && top.closest('.mbox') && !e.closest('.mbox')) continue; }
      if (hit(rc, { l: q.left, t: q.top, r: q.right, b: q.bottom })) throw new Error(`かぶり: ${name} が ${sel}「${e.textContent.trim().slice(0, 12)}」に重なる`);
    }
    for (const [id, o] of items) { if (o === el || !o.classList.contains('on')) continue;
      let qq; if (o.tagName === 'g') { const bb = o.querySelector('circle,ellipse,rect,path').getBBox(); qq = { l: bb.x, t: bb.y, r: bb.x + bb.width, b: bb.y + bb.height }; } else qq = b4rect(o); // 囲みは出し終わった大きさ(svg は画面と同じ座標)
      if (o.tagName === 'g' && el.dataset.for === id) continue; // 自分の囲みとは調べない
      if (hit(rc, qq)) throw new Error(`かぶり: ${name} が注釈 ${id} に重なる ${JSON.stringify(rc)} / ${JSON.stringify(qq)}`); }
    if (capEl && capEl !== el && hit(rc, b4rect(capEl))) throw new Error(`かぶり: ${name} が説明の文に重なる`);
  };
  // ---- 短い名札(とげ無し)。at: 盤の座標 [x,y] か、画面の座標 {page:[x,y]}
  T.label = (id, text, at, o = {}) => {
    T.clear(id);
    const [x, y] = at.page || T.pt(...at);
    const d = document.createElement('div'); d.className = 'tut-fade tut-lab' + (o.ng ? ' ng' : ''); d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px'; if (o.for) d.dataset.for = o.for; root.appendChild(d); on(d); items.set(id, d);
    T.check(d, b4rect(d));
  };
  // ---- 説明の文(盤の下の空いた所。1 つだけ。新しい文に入れ替える時は、いったん消してから出す)
  let capEl = null;
  T.cap = async (html) => {
    if (capEl) { fadeOut(capEl); capEl = null; await T.sleep(380); }
    if (!html) return;
    const d = document.createElement('div'); d.className = 'tut-fade tut-cap'; d.innerHTML = html;
    if (T.capBox) { // 決めた欄(右の側板の空いた所など)に出す。狭い欄なので改行は入れず、言葉の切れ目で自動で折り返す
      const b = T.capBox; d.classList.add('tut-side'); d.innerHTML = html.replace(/<br\s*\/?>/g, ''); Object.assign(d.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px' });
      root.appendChild(d); on(d); capEl = d;
      if (b.maxH && d.offsetHeight > b.maxH) throw new Error(`説明の文が欄に入らない(${d.offsetHeight}>${b.maxH} 幅${b.width}): ` + d.textContent);
    } else {
      const wrap = document.querySelector('#boardwrap').getBoundingClientRect();
      d.style.left = (wrap.left + wrap.width / 2) + 'px';
      root.appendChild(d); on(d); capEl = d;
      if (d.getBoundingClientRect().width > 860) throw new Error('説明の文が長すぎる: ' + d.textContent);
    }
    T.check(d, b4rect(d));
  };
  // ---- 番号(石をまいた順)
  T.badge = (id, n, at) => {
    T.clear(id);
    const [x, y] = at.page || T.pt(...at);
    const d = document.createElement('div'); d.className = 'tut-badge'; d.textContent = n; d.style.left = x + 'px'; d.style.top = y + 'px';
    root.appendChild(d); on(d); items.set(id, d);
  };
  // ---- 向きを見せる矢印(線を引くように出す)。pts は盤の座標の点列(なめらかにつなぐ)
  T.arrow = (id, d, o = {}) => {
    T.clear(id);
    const m = o.page ? new DOMMatrix() : svgEl().getScreenCTM();
    const path = d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, a, b) => { const q = new DOMPoint(+a, +b).matrixTransform(m); return q.x.toFixed(1) + ' ' + q.y.toFixed(1); });
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'tut-fade on');
    g.innerHTML = `<path d="${path}" fill="none" stroke="#fff" stroke-width="${o.w ? o.w + 6 : 15}" stroke-linecap="round" stroke-linejoin="round" filter="url(#tutGlow)" class="tut-draw" data-m="url(#tutHeadW)"/>`
      + `<path d="${path}" fill="none" stroke="${AC}" stroke-width="${o.w || 9}" stroke-linecap="round" stroke-linejoin="round" class="tut-draw" data-m="url(#tutHead)"/>`;
    G.appendChild(g);
    const ps = [...g.querySelectorAll('path')], L = ps[0].getTotalLength();
    ps.forEach((p) => { p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.strokeDashoffset = 0; });
    // 矢じりは、線が先まで引けてから付ける(先に矢じりだけ出ないように)
    setTimeout(() => ps.forEach((p) => p.setAttribute('marker-end', p.dataset.m)), 860 * K);
    items.set(id, g);
  };
  T.clear = (...ids) => { for (const id of ids) { const e = items.get(id); if (e) { items.delete(id); e.classList.remove('on'); if (e.classList.contains('tut-badge')) e.classList.add('off'); setTimeout(() => e.remove(), 500 * K); } } };
  T.clearAll = () => T.clear(...items.keys());
  T.clearPrefix = (pre) => T.clear(...[...items.keys()].filter((k) => k.startsWith(pre)));

  // ---- マウスのカーソル(人の操作を見せる)
  const cur = document.createElement('div'); cur.className = 'tut-cur';
  cur.innerHTML = `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M6 4 L6 34 L13.5 27 L18.5 39 L24 36.6 L19 25 L29.5 25 Z" fill="#fff" stroke="#1d1d1d" stroke-width="2.6" stroke-linejoin="round" filter="url(#tutGlow)"/></svg>`;
  root.appendChild(cur);
  let cx = 640, cy = 640;
  const place = (x, y, instant) => { if (instant) { cur.style.transition = 'none'; } cur.style.transform = `translate(${x - 6}px,${y - 4}px)`; if (instant) { cur.getBoundingClientRect(); cur.style.transition = ''; } cx = x; cy = y; };
  T.cursorShow = (at) => { const [x, y] = at.page || T.pt(...at); place(x, y, true); on(cur); };
  T.cursorTo = async (at, ms = 900) => { const [x, y] = at.page || T.pt(...at); cur.style.transitionDuration = `${ms * K}ms, ${300 * K}ms`; place(x, y); await T.sleep(ms + 60); };
  T.cursorHide = () => cur.classList.remove('on');
  T.cursorOn = () => on(cur);
  T.press = async (el) => {
    cur.classList.add('down');
    const r = document.createElement('div'); r.className = 'tut-rip'; r.style.left = cx + 'px'; r.style.top = cy + 'px'; root.appendChild(r); setTimeout(() => r.remove(), 700 * K);
    await T.sleep(130);
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await T.sleep(120); cur.classList.remove('down');
  };

  // ---- 盤の石が落ちる順番を読む(js/boards/fix.js の .mdrop の animation-delay)。[{pit, delay}] を delay 順に
  T.drops = () => {
    const out = [];
    document.querySelectorAll('#boardwrap .mdrop:not(.mcap-land)').forEach((g) => {
      const c = g.querySelector('circle:nth-child(2)'); const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      let best = -1, bd = 1e9; for (let i = 0; i < 14; i++) { const [px, py] = pos(i); const dd = (i === 6 || i === 13) ? Math.abs(px - x) * 3 + Math.max(0, Math.abs(py - y) - 100) : Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = i; } }
      out.push({ pit: best, delay: parseFloat(g.style.animationDelay) || 0 });
    });
    const land = document.querySelector('#boardwrap .mcap-land');
    if (land) out.push({ pit: -1, delay: parseFloat(land.style.animationDelay) || 0, land: true });
    return out.sort((a, b) => a.delay - b.delay);
  };
  // 番号を出す場所(穴の右上・下。倉は上の方)
  T.badgeAt = (i) => { const [x, y] = pos(i); if (i === 6 || i === 13) return [x, y - 84]; return i <= 5 ? [x + 33, y - 33] : [x + 33, y + 33]; };
})();
