'use strict';
// マインスイーパーの「運任せのない盤面」(推測しなくても論理だけで解ける地雷の配置)を作る。
// MineLink(ユーザーの別アプリ)の core/NoGuess.kt を JavaScript に移した物。考え方・手順・上限は同じ。
//   解き方: 1. 数字の基本規則 2. 地雷の総数 3. 境界の塊ごとの全探索。見える情報から必ず言えることだけを使う。
//   作り方: ランダムに置いて解き、行き詰まった境界のマスへ/から地雷を 1 つ動かして、解ける所が増えれば残す。
// ホストが 1 回だけ作り、配置を参加者に配る(時間で打ち切るので、同じ種から同じ配置になるとは限らない)。
// 画面を止めないよう Web Worker でも動く(このファイルを Worker として読むと、メッセージで作って返す)。
(function (root) {
  const NODE_CAP = 40000, MAX_COMPONENT_CELLS = 140;

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return n => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) % n);
    };
  }

  function Solver(cols, rows) {
    const size = cols * rows;
    const nbr = new Int32Array(size * 8), nbrN = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      let n = 0; const x = i % cols, y = (i / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) nbr[i * 8 + n++] = ny * cols + nx;
      }
      nbrN[i] = n;
    }
    let layout = null;
    const adj = new Uint8Array(size), st = new Uint8Array(size); // st: 0=未確定 1=開いた 2=地雷と確定
    let opened = 0, knownMines = 0, totalMines = 0, safeTotal = 0, broken = false;
    const stack = new Int32Array(size), queue = new Int32Array(size), queued = new Uint8Array(size);
    let qHead = 0, qCount = 0;
    const parent = new Int32Array(size), conCell = new Int32Array(size), conRoot = new Int32Array(size);
    const headCell = new Int32Array(size), nextCell = new Int32Array(size), headCon = new Int32Array(size), nextCon = new Int32Array(size);
    const inFront = new Uint8Array(size), loc = new Int32Array(size), fcell = new Int32Array(size);
    const cR = new Int32Array(size), cLen = new Int32Array(size), cMem = new Int32Array(size * 8), cStartA = new Int32Array(size + 1);
    const ccCount = new Int32Array(size + 1), ccStart = new Int32Array(size + 2), cellCons = new Int32Array(size * 8);
    const remA = new Int32Array(size), unkA = new Int32Array(size), assign = new Uint8Array(size);
    const seenMine = new Uint8Array(size), seenSafe = new Uint8Array(size);
    let dfsK = 0, dfsNodes = 0, dfsBoth = 0, dfsSolutions = 0, dfsCapped = false;
    const quiet = new Set();

    function enqueue(i) { if (queued[i]) return; queued[i] = 1; queue[(qHead + qCount) % size] = i; qCount++; }
    function open(i) {
      if (st[i]) return;
      let sp = 0; stack[sp++] = i; st[i] = 1;
      while (sp > 0) {
        const c = stack[--sp];
        if (layout[c]) { broken = true; continue; }
        opened++;
        for (let k = 0; k < nbrN[c]; k++) { const n = nbr[c * 8 + k]; if (st[n] === 1 && adj[n] > 0) enqueue(n); }
        if (adj[c] > 0) enqueue(c);
        else for (let k = 0; k < nbrN[c]; k++) { const n = nbr[c * 8 + k]; if (!st[n]) { st[n] = 1; stack[sp++] = n; } }
      }
    }
    function markMine(i) {
      if (st[i]) return;
      if (!layout[i]) broken = true;
      st[i] = 2; knownMines++;
      for (let k = 0; k < nbrN[i]; k++) { const n = nbr[i * 8 + k]; if (st[n] === 1 && adj[n] > 0) enqueue(n); }
    }
    function drain() {
      while (qCount > 0 && !broken) {
        const i = queue[qHead]; qHead = (qHead + 1) % size; qCount--; queued[i] = 0;
        if (st[i] !== 1 || !adj[i]) continue;
        let u = 0, f = 0;
        for (let k = 0; k < nbrN[i]; k++) { const s = st[nbr[i * 8 + k]]; if (!s) u++; else if (s === 2) f++; }
        if (!u) continue;
        const r = adj[i] - f;
        if (r < 0 || r > u) { broken = true; return; }
        if (r === 0) { for (let k = 0; k < nbrN[i]; k++) { const n = nbr[i * 8 + k]; if (!st[n]) open(n); } }
        else if (r === u) { for (let k = 0; k < nbrN[i]; k++) { const n = nbr[i * 8 + k]; if (!st[n]) markMine(n); } }
      }
    }
    function countRule() {
      const unknown = size - opened - knownMines;
      if (unknown <= 0) return false;
      const remaining = totalMines - knownMines;
      if (remaining === 0) { for (let i = 0; i < size; i++) if (!st[i]) open(i); return true; }
      if (remaining === unknown) { for (let i = 0; i < size; i++) if (!st[i]) markMine(i); return true; }
      return false;
    }
    function find(x) {
      let r = x; while (parent[r] !== r) r = parent[r];
      let c = x; while (parent[c] !== r) { const n = parent[c]; parent[c] = r; c = n; }
      return r;
    }
    function enumerate() {
      let nCon = 0;
      for (let i = 0; i < size; i++) { inFront[i] = 0; headCell[i] = -1; headCon[i] = -1; }
      for (let i = 0; i < size; i++) {
        if (st[i] !== 1 || !adj[i]) continue;
        let first = -1;
        for (let k = 0; k < nbrN[i]; k++) {
          const n = nbr[i * 8 + k];
          if (st[n]) continue;
          if (first < 0) { first = n; if (!inFront[n]) { inFront[n] = 1; parent[n] = n; } }
          else {
            if (!inFront[n]) { inFront[n] = 1; parent[n] = n; }
            const a = find(first), b = find(n);
            if (a !== b) parent[b] = a;
          }
        }
        if (first >= 0) { conCell[nCon] = i; conRoot[nCon] = first; nCon++; }
      }
      if (!nCon) return false;
      for (let c = 0; c < nCon; c++) { const r = find(conRoot[c]); conRoot[c] = r; nextCon[c] = headCon[r]; headCon[r] = c; }
      for (let i = size - 1; i >= 0; i--) { if (!inFront[i]) continue; const r = find(i); nextCell[i] = headCell[r]; headCell[r] = i; }
      for (let r = 0; r < size; r++) {
        if (headCell[r] < 0) continue;
        if (solveComponent(r)) return true;
        if (broken) return false;
      }
      return false;
    }
    function solveComponent(r0) {
      let k = 0, cell = headCell[r0];
      while (cell >= 0) { fcell[k] = cell; loc[cell] = k; k++; cell = nextCell[cell]; }
      if (k > MAX_COMPONENT_CELLS) return false;
      let m = 0, con = headCon[r0], memberTotal = 0;
      let h1 = 0x811c9dc5, h2 = 0x01000193; // 前に調べて何も分からなかった塊を覚える印(2 本の 32 ビットの印)
      for (let t = 0; t < k; t++) { h1 = Math.imul(h1 ^ fcell[t], 16777619); h2 = Math.imul(h2 ^ (fcell[t] * 7 + 3), 2246822519); }
      while (con >= 0) {
        const i = conCell[con];
        let f = 0; const s0 = memberTotal;
        for (let q = 0; q < nbrN[i]; q++) { const n = nbr[i * 8 + q], s = st[n]; if (!s) cMem[memberTotal++] = loc[n]; else if (s === 2) f++; }
        cStartA[m] = s0; cLen[m] = memberTotal - s0; cR[m] = adj[i] - f;
        const v = cR[m] * 31 + cLen[m] + 7919 * i;
        h1 = Math.imul(h1 ^ v, 16777619); h2 = Math.imul(h2 ^ (v + 0x9e37), 2246822519);
        m++; con = nextCon[con];
      }
      cStartA[m] = memberTotal;
      const sig = (h1 >>> 0) + ':' + (h2 >>> 0) + ':' + k + ':' + m;
      if (quiet.has(sig)) return false;
      quiet.add(sig);
      for (let t = 0; t <= k; t++) ccCount[t] = 0;
      for (let c = 0; c < m; c++) for (let q = cStartA[c]; q < cStartA[c] + cLen[c]; q++) ccCount[cMem[q]]++;
      ccStart[0] = 0;
      for (let t = 0; t < k; t++) ccStart[t + 1] = ccStart[t] + ccCount[t];
      for (let t = 0; t < k; t++) ccCount[t] = 0;
      for (let c = 0; c < m; c++) for (let q = cStartA[c]; q < cStartA[c] + cLen[c]; q++) { const t = cMem[q]; cellCons[ccStart[t] + ccCount[t]++] = c; }
      for (let c = 0; c < m; c++) { remA[c] = cR[c]; unkA[c] = cLen[c]; if (remA[c] < 0 || remA[c] > unkA[c]) { broken = true; return false; } }
      for (let t = 0; t < k; t++) { seenMine[t] = 0; seenSafe[t] = 0; assign[t] = 0; }
      dfsK = k; dfsNodes = 0; dfsBoth = 0; dfsSolutions = 0; dfsCapped = false;
      dfs(0);
      if (dfsCapped) return false;
      if (!dfsSolutions) { broken = true; return false; }
      let any = false;
      for (let t = 0; t < k; t++) {
        const g = fcell[t];
        if (!seenMine[t] && !st[g]) { open(g); any = true; }
        else if (!seenSafe[t] && !st[g]) { markMine(g); any = true; }
      }
      return any;
    }
    function dfs(pos) {
      if (pos === dfsK) {
        dfsSolutions++;
        for (let t = 0; t < dfsK; t++) {
          if (assign[t] === 1) { if (!seenMine[t]) { seenMine[t] = 1; if (seenSafe[t]) dfsBoth++; } }
          else if (!seenSafe[t]) { seenSafe[t] = 1; if (seenMine[t]) dfsBoth++; }
        }
        return dfsBoth === dfsK;
      }
      if (++dfsNodes > NODE_CAP) { dfsCapped = true; return true; }
      const s = ccStart[pos], e = ccStart[pos + 1];
      let stop = false;
      for (let v = 0; v <= 1; v++) {
        let ok = true;
        for (let q = s; q < e; q++) { const c = cellCons[q]; unkA[c]--; if (v === 1) remA[c]--; if (remA[c] < 0 || remA[c] > unkA[c]) ok = false; }
        if (ok) { assign[pos] = v; if (dfs(pos + 1)) stop = true; }
        for (let q = s; q < e; q++) { const c = cellCons[q]; unkA[c]++; if (v === 1) remA[c]++; }
        if (stop) return true;
      }
      return false;
    }
    function run(lay, mines, startCell, openedNow) {
      layout = lay; totalMines = mines; safeTotal = size - mines;
      for (let i = 0; i < size; i++) { let n = 0; for (let k = 0; k < nbrN[i]; k++) if (layout[nbr[i * 8 + k]]) n++; adj[i] = n; }
      st.fill(0); opened = 0; knownMines = 0; broken = false; qHead = 0; qCount = 0; queued.fill(0); quiet.clear();
      if (!openedNow) open(startCell);
      else for (let i = 0; i < size; i++) if (openedNow[i] && !st[i]) open(i);
      while (!broken) {
        drain();
        if (broken || opened >= safeTotal) break;
        if (countRule()) continue;
        if (!enumerate()) break;
      }
      return broken ? safeTotal : safeTotal - opened;
    }
    return {
      st,
      solve: (lay, mines, start) => run(lay, mines, start, null),
      solveFromState: (lay, mines, openedNow) => run(lay, mines, -1, openedNow),
      isFrontier(i) {
        if (st[i]) return false;
        for (let k = 0; k < nbrN[i]; k++) { const n = nbr[i * 8 + k]; if (st[n] === 1 && adj[n] > 0) return true; }
        return false;
      },
    };
  }

  function randomLayout(rnd, size, mines, protect) {
    const pool = []; for (let i = 0; i < size; i++) if (!protect[i]) pool.push(i);
    for (let k = pool.length - 1; k > 0; k--) { const j = rnd(k + 1); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
    const out = new Uint8Array(size);
    for (let k = 0; k < Math.min(mines, pool.length); k++) out[pool[k]] = 1;
    return out;
  }

  /** startCell と周りの 8 マスには地雷を置かない。{layout, solved} を返す(解けなければ一番よく解けた配置)。 */
  function generate(cols, rows, mines, startCell, seed, timeLimitMs = 15000) {
    const t0 = Date.now(), size = cols * rows, rnd = rng(seed), solver = Solver(cols, rows);
    const sx = startCell % cols, sy = (startCell / cols) | 0;
    const protect = new Uint8Array(size);
    let np = 0;
    for (let i = 0; i < size; i++) if (Math.abs(i % cols - sx) <= 1 && Math.abs(((i / cols) | 0) - sy) <= 1) { protect[i] = 1; np++; }
    if (size - np < mines) for (let i = 0; i < size; i++) protect[i] = i === startCell ? 1 : 0;
    let layout = randomLayout(rnd, size, mines, protect);
    let remain = solver.solve(layout, mines, startCell), best = layout.slice(), bestRemain = remain, stale = 0;
    const free = new Int32Array(size), cand = new Int32Array(size);
    while (remain > 0 && Date.now() - t0 < timeLimitMs) {
      let nc = 0;
      for (let i = 0; i < size; i++) if (solver.isFrontier(i)) cand[nc++] = i;
      if (!nc) for (let i = 0; i < size; i++) if (!solver.st[i]) cand[nc++] = i;
      if (!nc) break;
      const u = cand[rnd(nc)];
      let from = -1, to = -1;
      if (layout[u]) {
        from = u; let nf = 0;
        for (let i = 0; i < size; i++) if (!layout[i] && !protect[i] && (!solver.st[i] || rnd(5) === 0)) free[nf++] = i;
        if (!nf) continue;
        to = free[rnd(nf)];
      } else {
        if (protect[u]) continue;
        to = u; let nm = 0;
        for (let i = 0; i < size; i++) if (layout[i] && (!solver.st[i] || rnd(5) === 0)) free[nm++] = i;
        if (!nm) continue;
        from = free[rnd(nm)];
      }
      layout[from] = 0; layout[to] = 1;
      const r = solver.solve(layout, mines, startCell);
      if (r <= remain) {
        if (r < remain) stale = 0;
        remain = r;
        if (r < bestRemain) { bestRemain = r; best = layout.slice(); }
      } else {
        layout[from] = 1; layout[to] = 0;
        if (++stale > 3000) {
          stale = 0;
          layout = randomLayout(rnd, size, mines, protect);
          remain = solver.solve(layout, mines, startCell);
          if (remain < bestRemain) { bestRemain = remain; best = layout.slice(); }
        }
      }
      if (remain === 0) { best = layout.slice(); bestRemain = 0; }
    }
    return { layout: best, solved: bestRemain === 0, ms: Date.now() - t0 };
  }

  // 配置を通信で送れる短い文字列に(1 マス 1 ビット)
  function encode(layout) {
    const bytes = new Uint8Array((layout.length + 7) >> 3);
    for (let i = 0; i < layout.length; i++) if (layout[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(text, size, mines) {
    try {
      const bin = atob(String(text).replace(/-/g, '+').replace(/_/g, '/'));
      if (bin.length !== ((size + 7) >> 3)) return null;
      const out = new Uint8Array(size); let n = 0;
      for (let i = 0; i < size; i++) if ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) { out[i] = 1; n++; }
      return n === mines ? out : null;
    } catch (e) { return null; }
  }

  const api = { generate, encode, decode, Solver };
  if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function') {
    self.onmessage = e => {
      const { id, cols, rows, mines, start, seed, limit } = e.data;
      const r = generate(cols, rows, mines, start, seed, limit);
      self.postMessage({ id, layout: r.layout, solved: r.solved, ms: r.ms });
    };
  } else {
    // 画面側: Worker で作る(使えない時はその場で作る)。Promise<{layout, solved}>
    let worker = null, seq = 0; const waits = new Map();
    api.generateAsync = (cols, rows, mines, start, seed, limit = 15000) => new Promise(resolve => {
      try {
        if (!worker) {
          worker = new Worker('js/mine-noguess.js');
          worker.onmessage = e => { const w = waits.get(e.data.id); if (w) { waits.delete(e.data.id); w(e.data); } };
          worker.onerror = () => { worker = null; for (const [id, w] of waits) { waits.delete(id); w(null); } };
        }
        const id = ++seq;
        waits.set(id, r => resolve(r || generate(cols, rows, mines, start, seed, Math.min(limit, 3000))));
        worker.postMessage({ id, cols, rows, mines, start, seed, limit });
      } catch (e) { resolve(generate(cols, rows, mines, start, seed, Math.min(limit, 3000))); }
    });
    root.MineNoGuess = api;
  }
})(typeof window !== 'undefined' ? window : self);
