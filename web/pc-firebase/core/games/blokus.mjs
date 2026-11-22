import { brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ブロックス (Blokus) — 2〜4人用ボードゲーム (No.49)
 * 20×20 (デュオは14×14) の盤に、21種のポリオミノを自分の色と「角で接し、辺で接しない」
 * ように置いていく。全員が置けなくなったら終わり、残したピースのマス数が一番少ない人の勝ち。
 *
 * 規則とオプション:
 * - board: '20' (標準 20×20、2〜4人。各席が1色を担当)
 *          'duo' (14×14、2人専用。席0が色0・2、席1が色1・3を担当し、手番は色順 0→1→2→3)
 * - 初手は自分の色の開始角 (色0=左上, 1=右上, 2=右下, 3=左下) を必ず含む。
 * - 以後は自分の色と角で接するマスを1つ以上含み、自分の色と辺で接するマスを含まないこと。
 *   他の色とは辺で接してもよい。置けない色は自動で次へ進む (合法手が無い場合のみパスが合法)。
 * - 得点 (小さいほど良い): 席ごとに「担当色の残りピースのマス数合計 − ボーナス」。
 *   ボーナスは、担当色をすべて置き切ったら色ごとに15点、さらにその色の最後のピースが
 *   1マスピースなら5点 (どちらも得点から引く)。
 *
 * 手の符号化: move = (((pieceIdx*8)+oriIdx)*boardSize + y)*boardSize + x
 *   (x, y は向きの外接矩形の左上。パスは BLOKUS_MOVE_PASS)
 */

// ピース21種: セル座標 [x, y] の配列。1マス×1、2マス×1、3マス×2、4マス×5、5マス×12 (合計89マス)
export const BLOKUS_PIECES = [
  [[0, 0]], // 0: 1マス
  [[0, 0], [1, 0]], // 1: 2マス (ドミノ)
  [[0, 0], [1, 0], [2, 0]], // 2: 3マス 直線
  [[0, 0], [0, 1], [1, 1]], // 3: 3マス かど
  [[0, 0], [1, 0], [2, 0], [3, 0]], // 4: 4マス 直線
  [[0, 0], [1, 0], [0, 1], [1, 1]], // 5: 4マス 四角
  [[0, 0], [0, 1], [0, 2], [1, 2]], // 6: 4マス L
  [[0, 0], [1, 0], [2, 0], [1, 1]], // 7: 4マス T
  [[0, 0], [1, 0], [1, 1], [2, 1]], // 8: 4マス ずらし
  [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], // 9: 5マス F
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], // 10: 5マス 直線
  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]], // 11: 5マス L
  [[1, 0], [1, 1], [0, 2], [1, 2], [0, 3]], // 12: 5マス N
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], // 13: 5マス P
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], // 14: 5マス T
  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]], // 15: 5マス U
  [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], // 16: 5マス V
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]], // 17: 5マス W
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], // 18: 5マス X (十字)
  [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]], // 19: 5マス Y
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]], // 20: 5マス Z
];

export const BLOKUS_MOVE_PASS = 999999;

const PIECE_SIZES = BLOKUS_PIECES.map((p) => p.length);

function normalizeCells(cells) {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map((c) => [c[0] - minX, c[1] - minY])
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

// 回転・反転した全向き (重複除く)。各向きは正規化済みセル座標配列。
export function orientationsFor(pieceIdx) {
  const base = BLOKUS_PIECES[pieceIdx];
  const seen = new Set();
  const result = [];
  for (const flip of [false, true]) {
    let cells = base.map(([x, y]) => [flip ? -x : x, y]);
    for (let rot = 0; rot < 4; rot++) {
      const norm = normalizeCells(cells);
      const key = norm.map((c) => c.join(',')).join(';');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(norm);
      }
      cells = cells.map(([x, y]) => [y, -x]);
    }
  }
  return result;
}

const ORIENTATIONS = BLOKUS_PIECES.map((_, i) => orientationsFor(i));

export function decodeBlokusMove(move, boardSize) {
  if (move === BLOKUS_MOVE_PASS) return { pass: true };
  const x = move % boardSize;
  const rest1 = Math.floor(move / boardSize);
  const y = rest1 % boardSize;
  const rest2 = Math.floor(rest1 / boardSize);
  const oriIdx = rest2 % 8;
  const pieceIdx = Math.floor(rest2 / 8);
  return { pass: false, pieceIdx, oriIdx, x, y };
}

function encodeMove(pieceIdx, oriIdx, x, y, boardSize) {
  return (((pieceIdx * 8) + oriIdx) * boardSize + y) * boardSize + x;
}

export const BLOKUS_SPEC = {
  id: 'blokus',
  no: 49,
  name: 'ブロックス',
  category: 'BOARD',
  players: '2〜4人',
  intro: 'ピースを角でつなげて広げよう。辺でくっつく置き方は禁止！残りマスが一番少ない人の勝ち。',
  seatNames: ['1番', '2番', '3番', '4番'],
  undoAllowed: false,
  seatsFor: (opts) => (opts.jt('board', '20') === 'duo' ? 2 : opts.it('players', 4)),
  options: [
    { key: 'players', label: '人数', default: '4', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人']] },
    { key: 'board', label: '盤面', default: '20', group: 'rule', hint: 'デュオは14×14・2人専用で、1人が2色ずつ担当します', values: [['20', '標準 20×20'], ['duo', 'デュオ 14×14 (2人)']] },
  ],
  sections: [
    ['概要と目的', '各自21種のピースを持ち、自分の色のピースを盤に置いていきます。全員が置けなくなったら終わり、手元に残ったピースのマス数が一番少ない人の勝ちです。'],
    ['配置のルール', '最初の1手は、盤の四隅にある自分の色の角を必ず含めて置きます。2手目以降は、自分の色と「角と角が接する」マスを1つ以上含み、「辺と辺が接する」マスを含まないように置きます。他の色とは辺で接してもかまいません。'],
    ['得点とデュオ', '残したピースのマス数がそのまま失点です。担当色をすべて置き切ると15点、さらに最後に置いたのが1マスピースなら5点が引かれます。デュオ (14×14) は2人専用で、1人が2色ずつ担当します。'],
  ],
  makeRules(opts) {
    const duo = opts.jt('board', '20') === 'duo';
    const boardSize = duo ? 14 : 20;
    const playerCount = duo ? 2 : Math.min(4, Math.max(2, opts.it('players', 4)));
    const colorCount = duo ? 4 : playerCount;
    // 色 → 担当席。標準は色=席、デュオは席0が色0・2、席1が色1・3。
    const seatOfColor = duo ? [0, 1, 0, 1] : Array.from({ length: colorCount }, (_, c) => c);
    const corners = [
      [0, 0],
      [boardSize - 1, 0],
      [boardSize - 1, boardSize - 1],
      [0, boardSize - 1],
    ];

    // --- 配置判定 (盤・残りピースだけに依存する純粋関数) ---
    function placementLegal(board, color, cells, ax, ay, firstMove) {
      let diagTouch = false;
      let coversCorner = false;
      const [cx, cy] = corners[color];
      for (const [dx, dy] of cells) {
        const x = ax + dx;
        const y = ay + dy;
        if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return false;
        if (board[y * boardSize + x] !== -1) return false;
        if (x === cx && y === cy) coversCorner = true;
        // 辺で接する自色があれば不可
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [ox, oy] of nb) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < boardSize && ny < boardSize && board[ny * boardSize + nx] === color) return false;
        }
        const dg = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [ox, oy] of dg) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < boardSize && ny < boardSize && board[ny * boardSize + nx] === color) diagTouch = true;
        }
      }
      return firstMove ? coversCorner : diagTouch;
    }

    // 現在の色の全合法配置を列挙する。候補マス (初手は角、それ以外は自色と角で接し
    // 辺で接しない空マス) を必ず含む配置だけを探すことで列挙を絞る。
    function enumeratePlacements(board, color, remainingPieces, placedCountColor) {
      const firstMove = placedCountColor === 0;
      const cand = new Set();
      if (firstMove) {
        cand.add(corners[color][1] * boardSize + corners[color][0]);
      } else {
        for (let i = 0; i < board.length; i++) {
          if (board[i] !== color) continue;
          const x = i % boardSize;
          const y = Math.floor(i / boardSize);
          for (const [ox, oy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= boardSize || ny >= boardSize) continue;
            const ni = ny * boardSize + nx;
            if (board[ni] !== -1) continue;
            // そのマス自体が自色と辺で接していたら、置いても辺接触になるので候補から外す
            let edge = false;
            for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const mx = nx + ex;
              const my = ny + ey;
              if (mx >= 0 && my >= 0 && mx < boardSize && my < boardSize && board[my * boardSize + mx] === color) { edge = true; break; }
            }
            if (!edge) cand.add(ni);
          }
        }
      }
      const moves = new Set();
      for (const pieceIdx of remainingPieces) {
        const oris = ORIENTATIONS[pieceIdx];
        for (let oriIdx = 0; oriIdx < oris.length; oriIdx++) {
          const cells = oris[oriIdx];
          for (const ci of cand) {
            const cx0 = ci % boardSize;
            const cy0 = Math.floor(ci / boardSize);
            for (const [dx, dy] of cells) {
              const ax = cx0 - dx;
              const ay = cy0 - dy;
              const mv = encodeMove(pieceIdx, oriIdx, ax, ay, boardSize);
              if (moves.has(mv)) continue;
              if (placementLegal(board, color, cells, ax, ay, firstMove)) moves.add(mv);
            }
          }
        }
      }
      return [...moves];
    }

    function remainingCellsOf(remainingColor) {
      return remainingColor.reduce((sum, p) => sum + PIECE_SIZES[p], 0);
    }

    function computeScores(st) {
      const perColor = [];
      for (let c = 0; c < colorCount; c++) {
        let v = remainingCellsOf(st.remaining[c]);
        if (st.remaining[c].length === 0) {
          v -= 15;
          if (st.lastPiece[c] === 0) v -= 5;
        }
        perColor.push(v);
      }
      const scores = new Array(playerCount).fill(0);
      for (let c = 0; c < colorCount; c++) scores[seatOfColor[c]] += perColor[c];
      return { scores, perColor };
    }

    // fromColor の次の色から順に、置ける色を探す。全色置けなければ終了。
    function advance(st, fromColor) {
      for (let step = 1; step <= colorCount; step++) {
        const nc = (fromColor + step) % colorCount;
        if (enumeratePlacements(st.board, nc, st.remaining[nc], st.placedCount[nc]).length > 0) {
          return { currentColor: nc, finished: false };
        }
      }
      return { currentColor: fromColor, finished: true };
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const { scores, perColor } = computeScores(st);
        return JSON.stringify({
          kind: 'blokus',
          me,
          boardSize: st.boardSize,
          board: st.board,
          currentColor: st.finished ? -1 : st.currentColor,
          currentSeat: st.finished ? -1 : seatOfColor[st.currentColor],
          colorCount: st.colorCount,
          seatOfColor: st.seatOfColor,
          remaining: st.remaining,
          remainingCells: perColor.map((v, c) => remainingCellsOf(st.remaining[c])),
          colorScores: perColor,
          scores,
          finished: st.finished,
          lastAction: st.lastAction,
        });
      });
    }

    return {
      playerCount,
      initial(rng) {
        return attachView({
          boardSize,
          colorCount,
          seatOfColor,
          board: new Array(boardSize * boardSize).fill(-1),
          remaining: Array.from({ length: colorCount }, () => BLOKUS_PIECES.map((_, i) => i)),
          placedCount: new Array(colorCount).fill(0),
          lastPiece: new Array(colorCount).fill(-1),
          currentColor: 0,
          finished: false,
          lastAction: null,
        });
      },
      toMove(s) {
        return s.finished ? -1 : seatOfColor[s.currentColor];
      },
      legalMoves(s) {
        if (s.finished) return new Int32Array(0);
        const moves = enumeratePlacements(s.board, s.currentColor, s.remaining[s.currentColor], s.placedCount[s.currentColor]);
        return new Int32Array(moves.length ? moves : [BLOKUS_MOVE_PASS]);
      },
      isLegal(s, m) {
        if (s.finished) return false;
        if (m === BLOKUS_MOVE_PASS) {
          return enumeratePlacements(s.board, s.currentColor, s.remaining[s.currentColor], s.placedCount[s.currentColor]).length === 0;
        }
        const d = decodeBlokusMove(m, boardSize);
        if (d.pass || d.pieceIdx < 0 || d.pieceIdx >= BLOKUS_PIECES.length) return false;
        if (!s.remaining[s.currentColor].includes(d.pieceIdx)) return false;
        const cells = ORIENTATIONS[d.pieceIdx][d.oriIdx];
        if (!cells) return false;
        return placementLegal(s.board, s.currentColor, cells, d.x, d.y, s.placedCount[s.currentColor] === 0);
      },
      play(s, m) {
        const color = s.currentColor;
        const seat = seatOfColor[color];
        const board = s.board.slice();
        const remaining = s.remaining.map((r) => r.slice());
        const placedCount = s.placedCount.slice();
        const lastPiece = s.lastPiece.slice();
        let lastAction;

        if (m === BLOKUS_MOVE_PASS) {
          lastAction = { seat, color, type: 'pass' };
        } else {
          const d = decodeBlokusMove(m, boardSize);
          const cells = ORIENTATIONS[d.pieceIdx][d.oriIdx];
          const placedCells = [];
          for (const [dx, dy] of cells) {
            const idx = (d.y + dy) * boardSize + (d.x + dx);
            board[idx] = color;
            placedCells.push(idx);
          }
          remaining[color] = remaining[color].filter((p) => p !== d.pieceIdx);
          placedCount[color] += 1;
          lastPiece[color] = d.pieceIdx;
          lastAction = { seat, color, type: 'place', piece: d.pieceIdx, move: m, cells: placedCells };
        }

        const draft = { board, remaining, placedCount };
        const { currentColor, finished } = advance(draft, color);
        return attachView({
          ...s,
          board,
          remaining,
          placedCount,
          lastPiece,
          currentColor,
          finished,
          lastAction,
        });
      },
      outcome(s) {
        if (!s.finished) return null;
        const { scores } = computeScores(s);
        const min = Math.min(...scores);
        const winners = scores.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
        const winner = winners.length === 1 ? winners[0] : -1;
        return { ys_1: winner, zs_1: winner >= 0 ? `${winner + 1}番の勝ち` : '引き分け' };
      },
      scores(s) {
        return new Int32Array(computeScores(s).scores);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 0) return BLOKUS_MOVE_PASS;
      if (legal.includes(BLOKUS_MOVE_PASS)) return BLOKUS_MOVE_PASS;
      const lv = brainLevel(level);
      if (lv <= 0) return legal[rngInt(rng, legal.length)];

      // 貪欲: 置くマス数が大きく、置いた後に自色と角で接する空マス (次の接点) が増える配置を選ぶ
      const size = s.boardSize;
      const color = s.currentColor;
      let bestScore = -Infinity;
      let best = [];
      for (const mv of legal) {
        const d = decodeBlokusMove(mv, size);
        const cells = ORIENTATIONS[d.pieceIdx][d.oriIdx];
        const own = new Set(cells.map(([dx, dy]) => (d.y + dy) * size + (d.x + dx)));
        const frontier = new Set();
        for (const idx of own) {
          const x = idx % size;
          const y = Math.floor(idx / size);
          for (const [ox, oy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const ni = ny * size + nx;
            if (s.board[ni] !== -1 || own.has(ni)) continue;
            // 自色 (既存+今回) と辺で接するマスは接点にならない
            let edge = false;
            for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const mx = nx + ex;
              const my = ny + ey;
              if (mx < 0 || my < 0 || mx >= size || my >= size) continue;
              const mi = my * size + mx;
              if (s.board[mi] === color || own.has(mi)) { edge = true; break; }
            }
            if (!edge) frontier.add(ni);
          }
        }
        const score = cells.length * 100 + frontier.size * 12;
        if (score > bestScore) {
          bestScore = score;
          best = [mv];
        } else if (score === bestScore) {
          best.push(mv);
        }
      }
      return best[rngInt(rng, best.length)];
    },
  },
};
