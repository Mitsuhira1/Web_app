import { brainLevel, pickRandom, withView } from './_utils.mjs';

function buildBoardSpec(boardType) {
  if (boardType === 'triangle') {
    // 15-hole 5-row triangle: (r, c) with 0 <= c <= r < 5
    const holes = [];
    const rcToIdx = new Map();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c <= r; c++) {
        rcToIdx.set(`${r},${c}`, holes.length);
        holes.push([r, c]);
      }
    }
    const dirs = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, 0], [1, 1]];
    const jumps = [];
    for (let i = 0; i < holes.length; i++) {
      const [r, c] = holes[i];
      for (const [dr, dc] of dirs) {
        const over = rcToIdx.get(`${r + dr},${c + dc}`);
        const to = rcToIdx.get(`${r + dr * 2},${c + dc * 2}`);
        if (over !== undefined && to !== undefined) {
          jumps.push([i, over, to]);
        }
      }
    }
    const cells = new Array(15).fill(1);
    cells[0] = 0; // top empty
    return { size: 15, rows: 5, cols: 5, holes, jumps, initialCells: cells, centerIdx: -1 };
  }

  // 7x7 grid: english (33 holes) or european (37 holes)
  const isValid = (r, c) => {
    if (r < 0 || r >= 7 || c < 0 || c >= 7) return false;
    const inCorner = (r < 2 || r > 4) && (c < 2 || c > 4);
    if (!inCorner) return true;
    if (boardType === 'european') {
      // European adds (1,1), (1,5), (5,1), (5,5)
      return (r === 1 || r === 5) && (c === 1 || c === 5);
    }
    return false;
  };

  const holes = [];
  const rcToIdx = new Map();
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (isValid(r, c)) {
        rcToIdx.set(`${r},${c}`, holes.length);
        holes.push([r, c]);
      }
    }
  }
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const jumps = [];
  for (let i = 0; i < holes.length; i++) {
    const [r, c] = holes[i];
    for (const [dr, dc] of dirs) {
      const over = rcToIdx.get(`${r + dr},${c + dc}`);
      const to = rcToIdx.get(`${r + dr * 2},${c + dc * 2}`);
      if (over !== undefined && to !== undefined) {
        jumps.push([i, over, to]);
      }
    }
  }
  const cells = new Array(holes.length).fill(1);
  const centerIdx = rcToIdx.get('3,3');
  const emptyIdx = boardType === 'european' ? rcToIdx.get('2,3') : centerIdx;
  cells[emptyIdx] = 0;
  return { size: holes.length, rows: 7, cols: 7, holes, jumps, initialCells: cells, centerIdx };
}

function makePegSolitaireRules(opts) {
  const boardType = opts.jt('board', 'english');
  const spec = buildBoardSpec(boardType);

  function getLegalJumps(cells) {
    const res = [];
    for (const [from, over, to] of spec.jumps) {
      if (cells[from] === 1 && cells[over] === 1 && cells[to] === 0) {
        res.push([from, over, to]);
      }
    }
    return res;
  }

  function attach(s) {
    return withView(s, (_rules, me) => JSON.stringify({
      kind: 'pegsolitaire',
      me,
      boardType,
      rows: spec.rows,
      cols: spec.cols,
      holes: spec.holes,
      cells: s.cells,
      pegsLeft: s.pegsLeft,
      moves: s.moves,
      centerIdx: spec.centerIdx,
      lastFrom: s.lastFrom,
      lastTo: s.lastTo,
    }));
  }

  return {
    playerCount: 1,
    spec,
    initial() {
      const cells = spec.initialCells.slice();
      const pegsLeft = cells.reduce((a, b) => a + b, 0);
      return attach({
        cells,
        pegsLeft,
        moves: 0,
        lastFrom: -1,
        lastTo: -1,
        winner: null,
        reason: '',
      });
    },
    toMove() {
      return 0;
    },
    legalMoves(s) {
      if (s.winner !== null) return [];
      return getLegalJumps(s.cells).map(([from, _over, to]) => from * 64 + to);
    },
    isLegal(s, m) {
      if (s.winner !== null) return false;
      const from = Math.floor(m / 64);
      const to = m % 64;
      return spec.jumps.some(([f, o, t]) => f === from && t === to && s.cells[f] === 1 && s.cells[o] === 1 && s.cells[t] === 0);
    },
    play(s, m) {
      const from = Math.floor(m / 64);
      const to = m % 64;
      const jump = spec.jumps.find(([f, _o, t]) => f === from && t === to);
      if (!jump) return s;
      const cells = s.cells.slice();
      cells[jump[0]] = 0;
      cells[jump[1]] = 0;
      cells[jump[2]] = 1;
      const pegsLeft = s.pegsLeft - 1;
      const moves = s.moves + 1;

      const nextLegal = getLegalJumps(cells);
      let winner = null;
      let reason = '';
      if (nextLegal.length === 0) {
        if (pegsLeft === 1) {
          winner = 0;
          const inCenter = spec.centerIdx >= 0 && cells[spec.centerIdx] === 1;
          reason = inCenter
            ? 'パーフェクト！（中央に1本だけ残りました）'
            : 'クリア！（残り1本）';
        } else {
          winner = -1;
          reason = `手詰まり（残り ${pegsLeft} 本）`;
        }
      }

      return attach({
        cells,
        pegsLeft,
        moves,
        lastFrom: from,
        lastTo: to,
        winner,
        reason,
      });
    },
    outcome(s) {
      return s.winner === null ? null : { winner: s.winner, reason: s.reason };
    },
    scores(s) {
      if (s.winner === null) return null;
      return [spec.initialCells.length - s.pegsLeft];
    },
  };
}

function choosePegMove(rules, s, _seat, level, rng) {
  const legal = rules.legalMoves(s);
  if (legal.length === 0) return 0;
  const lv = brainLevel(level);
  if (lv <= 0) return pickRandom(legal, rng);

  // 1-ply lookahead: prefer moves that leave more follow-up jumps and keep pegs near center
  let bestScore = -1e9;
  let best = [];
  for (const m of legal) {
    const ns = rules.play(s, m);
    const follow = rules.legalMoves(ns).length;
    const to = m % 64;
    const [r, c] = rules.spec.holes[to];
    const centerDist = Math.abs(r - (rules.spec.rows - 1) / 2) + Math.abs(c - (rules.spec.cols - 1) / 2);
    const score = (ns.pegsLeft === 1 ? 1000 : 0) + follow * 10 - centerDist;
    if (score > bestScore) {
      bestScore = score;
      best = [m];
    } else if (score === bestScore) {
      best.push(m);
    }
  }
  return pickRandom(best, rng);
}

export const PEGSOLITAIRE_SPEC = {
  id: 'pegsolitaire',
  no: 42,
  name: 'ペグ・ソリティア',
  category: 'BOARD',
  playersText: '1人',
  intro: '隣のペグを飛び越えて取り除き、最後に1本だけ残すクラシックパズル。',
  undoAllowed: true,
  seatsFor: () => 1,
  seatNames: ['プレイヤー'],
  makeRules: makePegSolitaireRules,
  chooseMove: choosePegMove,
  options: [
    {
      key: 'board',
      label: '盤面の形',
      values: [
        ['english', 'イギリス式（33穴・標準）'],
        ['european', 'ヨーロッパ式（37穴）'],
        ['triangle', '三角形（15穴）'],
      ],
      default: 'english',
    },
  ],
  sections: [
    { title: '概要と目的', body: '1人用の古典パズルです。空いている穴を1つ残して並んだペグを、別のペグで飛び越えて取り除き、最後に1本だけ残すことを目指します。' },
    { title: '動かし方', body: 'ペグを1つ選び、上下左右（三角形盤は斜めも含む6方向）の隣にあるペグを飛び越えて、その先の空いている穴へ動かします。飛び越えられたペグは取り除かれます。' },
    { title: 'クリア条件', body: '動かせるペグがなくなったとき、残りが1本ならクリアです。イギリス式で最後の中央の穴に1本残るとパーフェクト！' },
  ],
};
