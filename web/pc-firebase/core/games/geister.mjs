import { brainLevel, pickRandom, rngInt, shuffle, withView } from './_utils.mjs';

const HOME_CELLS = [
  [25, 26, 27, 28, 31, 32, 33, 34], // seat 0 (rows 4,5; cols 1..4)
  [1, 2, 3, 4, 7, 8, 9, 10],        // seat 1 (rows 0,1; cols 1..4)
];
const EXITS = [
  [0, 5],   // seat 0 exits
  [30, 35], // seat 1 exits
];

function makeGeisterRules(opts, rng) {
  const manualSetup = opts.jt('setup', 'manual') === 'manual';

  function attach(s) {
    return withView(s, (_rules, me) => {
      const revealAll = s.winner !== null || me < 0;
      const cells = s.board.map((p) => {
        if (!p) return 0;
        if (revealAll || p.owner === me) return p.kind;
        return 3; // hidden opponent ghost
      });
      const owners = s.board.map((p) => (p ? p.owner : -1));
      return JSON.stringify({
        kind: 'geister',
        me,
        turn: s.turn,
        phase: s.phase,
        board: cells,
        owners,
        captured: s.captured,
        moves: s.moves,
        lastFrom: s.lastFrom,
        lastTo: s.lastTo,
      });
    });
  }

  return {
    playerCount: 2,
    initial(initRng) {
      const r = initRng || rng;
      const board = new Array(36).fill(null);
      for (let seat = 0; seat < 2; seat++) {
        const kinds = shuffle([1, 1, 1, 1, 2, 2, 2, 2], r);
        HOME_CELLS[seat].forEach((cell, idx) => {
          board[cell] = { owner: seat, kind: kinds[idx] };
        });
      }
      return attach({
        board,
        phase: manualSetup ? 'setup' : 'play',
        turn: 0,
        captured: [
          { blue: 0, red: 0 }, // captured BY seat 0 (opponent's ghosts)
          { blue: 0, red: 0 }, // captured BY seat 1
        ],
        moves: 0,
        winner: null,
        reason: '',
        lastFrom: -1,
        lastTo: -1,
      });
    },
    toMove(s) {
      return s.turn;
    },
    legalMoves(s) {
      if (s.winner !== null) return [];
      const moves = [];
      if (s.phase === 'setup') {
        for (let a = 0; a < 8; a++) {
          for (let b = a + 1; b < 8; b++) {
            const ca = HOME_CELLS[s.turn][a];
            const cb = HOME_CELLS[s.turn][b];
            if (s.board[ca].kind !== s.board[cb].kind) {
              moves.push(a * 8 + b);
            }
          }
        }
        moves.push(99); // confirm setup
        return moves;
      }

      // Escape moves
      for (const ex of EXITS[s.turn]) {
        const p = s.board[ex];
        if (p && p.owner === s.turn && p.kind === 1) {
          moves.push(2000 + ex);
        }
      }

      // Orthogonal steps
      for (let i = 0; i < 36; i++) {
        const p = s.board[i];
        if (!p || p.owner !== s.turn) continue;
        const r = Math.floor(i / 6);
        const c = i % 6;
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) continue;
          const to = nr * 6 + nc;
          const target = s.board[to];
          if (target && target.owner === s.turn) continue;
          moves.push(i * 36 + to);
        }
      }
      return moves;
    },
    isLegal(s, m) {
      return this.legalMoves(s).includes(m);
    },
    play(s, m) {
      const board = s.board.map((p) => (p ? { ...p } : null));
      const captured = [
        { ...s.captured[0] },
        { ...s.captured[1] },
      ];

      if (s.phase === 'setup') {
        if (m === 99) {
          if (s.turn === 0) {
            return attach({
              board,
              phase: 'setup',
              turn: 1,
              captured,
              moves: s.moves,
              winner: null,
              reason: '',
              lastFrom: -1,
              lastTo: -1,
            });
          }
          return attach({
            board,
            phase: 'play',
            turn: 0,
            captured,
            moves: 0,
            winner: null,
            reason: '',
            lastFrom: -1,
            lastTo: -1,
          });
        }
        const a = Math.floor(m / 8);
        const b = m % 8;
        const ca = HOME_CELLS[s.turn][a];
        const cb = HOME_CELLS[s.turn][b];
        const tmp = board[ca];
        board[ca] = board[cb];
        board[cb] = tmp;
        return attach({
          board,
          phase: 'setup',
          turn: s.turn,
          captured,
          moves: s.moves,
          winner: null,
          reason: '',
          lastFrom: ca,
          lastTo: cb,
        });
      }

      if (m >= 2000) {
        const from = m - 2000;
        board[from] = null;
        return attach({
          board,
          phase: 'done',
          turn: s.turn,
          captured,
          moves: s.moves + 1,
          winner: s.turn,
          reason: '脱出成功！（青いオバケが相手の角から脱出しました）',
          lastFrom: from,
          lastTo: -1,
        });
      }

      const from = Math.floor(m / 36);
      const to = m % 36;
      const target = board[to];
      if (target) {
        if (target.kind === 1) captured[s.turn].blue++;
        else captured[s.turn].red++;
      }
      board[to] = board[from];
      board[from] = null;
      const moves = s.moves + 1;

      if (captured[s.turn].blue >= 4) {
        return attach({
          board,
          phase: 'done',
          turn: s.turn,
          captured,
          moves,
          winner: s.turn,
          reason: '勝利！（相手の青いオバケをすべて取りました）',
          lastFrom: from,
          lastTo: to,
        });
      }
      if (captured[s.turn].red >= 4) {
        return attach({
          board,
          phase: 'done',
          turn: s.turn,
          captured,
          moves,
          winner: 1 - s.turn,
          reason: '決着！（赤いオバケを4つ取らせて勝利）',
          lastFrom: from,
          lastTo: to,
        });
      }
      if (moves >= 220) {
        return attach({
          board,
          phase: 'done',
          turn: s.turn,
          captured,
          moves,
          winner: -1,
          reason: '引き分け（規定手数に達しました）',
          lastFrom: from,
          lastTo: to,
        });
      }
      return attach({
        board,
        phase: 'play',
        turn: 1 - s.turn,
        captured,
        moves,
        winner: null,
        reason: '',
        lastFrom: from,
        lastTo: to,
      });
    },
    outcome(s) {
      return s.winner === null ? null : { winner: s.winner, reason: s.reason };
    },
    scores() {
      return null;
    },
  };
}

function chooseGeisterMove(rules, s, seat, level, rng) {
  const legal = rules.legalMoves(s);
  if (legal.length === 0) return 0;
  if (s.phase === 'setup') {
    // CPU confirms immediately (initial arrangement is already shuffled)
    return 99;
  }
  const lv = brainLevel(level);
  if (lv <= 0) return pickRandom(legal, rng);

  // Always escape if possible
  const esc = legal.find((m) => m >= 2000);
  if (esc !== undefined) return esc;

  let bestScore = -1e9;
  let bestMoves = [];
  const targetRow = seat === 0 ? 0 : 5;
  for (const m of legal) {
    const from = Math.floor(m / 36);
    const to = m % 36;
    const piece = s.board[from];
    const target = s.board[to];
    let score = 0;
    if (target) {
      // Capturing is good unless we already took 3 reds
      score += s.captured[seat].red >= 3 ? -5 : 40;
    }
    const r = Math.floor(to / 6);
    const c = to % 6;
    const distExit = Math.abs(r - targetRow) + Math.min(c, 5 - c);
    if (piece.kind === 1) {
      // Blue: advance toward exits
      score += (10 - distExit) * 4;
      if (EXITS[seat].includes(to)) score += 35;
    } else {
      // Red: bluff forward or block
      score += (10 - distExit) * 2;
    }
    score += rngInt(rng, 4);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [m];
    } else if (score === bestScore) {
      bestMoves.push(m);
    }
  }
  return pickRandom(bestMoves, rng);
}

export const GEISTER_SPEC = {
  id: 'geister',
  no: 40,
  name: 'ガイスター',
  category: 'BOARD',
  playersText: '2人',
  intro: '青と赤のオバケを4つずつ配置し、相手の色を見抜きながら3つの勝利条件を狙う心理戦。',
  undoAllowed: false,
  seatsFor: () => 2,
  seatNames: ['先手', '後手'],
  makeRules: makeGeisterRules,
  chooseMove: chooseGeisterMove,
  options: [
    {
      key: 'setup',
      label: '初期配置',
      values: [
        ['manual', '自分で配置（標準）'],
        ['random', 'ランダム配置'],
      ],
      default: 'manual',
    },
  ],
  sections: [
    { title: '概要と目的', body: '自分からは色が見え、相手からは色が見えない8体のオバケ（良い青4・悪い赤4）を6×6の盤で動かす心理戦ボードゲームです。' },
    { title: '3つの勝利条件', body: '①相手の青いオバケを4つすべて取る\n②自分の赤いオバケを相手に4つすべて取らせる\n③自分の青いオバケを、相手側奥の左右どちらかの角マス（出口）から盤外へ脱出させる' },
    { title: '操作', body: '配置フェーズでは2つのオバケを選んで入れ替え、「配置決定」で開始します。対局中はオバケを上下左右の空きマス（または相手のオバケがいるマス）に1マス動かします。' },
  ],
};
