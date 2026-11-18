import { brainLevel, pickRandom, withView } from './_utils.mjs';

const LINES_4 = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

const SQUARES_2X2 = [
  [0, 1, 4, 5], [1, 2, 5, 6], [2, 3, 6, 7],
  [4, 5, 8, 9], [5, 6, 9, 10], [6, 7, 10, 11],
  [8, 9, 12, 13], [9, 10, 13, 14], [10, 11, 14, 15],
];

function isQuartoGroup(board, group) {
  const a = board[group[0]];
  const b = board[group[1]];
  const c = board[group[2]];
  const d = board[group[3]];
  if (a < 0 || b < 0 || c < 0 || d < 0) return false;
  if ((a & b & c & d) !== 0) return true;
  if (((~a & ~b & ~c & ~d) & 15) !== 0) return true;
  return false;
}

function findWinningLine(board, square2x2) {
  for (const g of LINES_4) {
    if (isQuartoGroup(board, g)) return g;
  }
  if (square2x2) {
    for (const g of SQUARES_2X2) {
      if (isQuartoGroup(board, g)) return g;
    }
  }
  return null;
}

function makeQuartoRules(opts) {
  const square2x2 = opts.jt('square2x2', 'off') === 'on';

  function attach(s) {
    return withView(s, (_rules, me) => JSON.stringify({
      kind: 'quarto',
      me,
      turn: s.turn,
      phase: s.phase,
      board: s.board,
      chosenPiece: s.chosenPiece,
      usedMask: s.usedMask,
      winLine: s.winLine,
      square2x2,
      lastCell: s.lastCell,
    }));
  }

  return {
    playerCount: 2,
    square2x2,
    initial() {
      return attach({
        board: new Array(16).fill(-1),
        usedMask: 0,
        chosenPiece: -1,
        phase: 'pick', // 'pick' | 'place'
        turn: 0,
        winLine: null,
        winner: null,
        reason: '',
        lastCell: -1,
      });
    },
    toMove(s) {
      return s.turn;
    },
    legalMoves(s) {
      if (s.winner !== null) return [];
      const moves = [];
      if (s.phase === 'pick') {
        for (let p = 0; p < 16; p++) {
          if ((s.usedMask & (1 << p)) === 0) moves.push(p);
        }
      } else {
        for (let i = 0; i < 16; i++) {
          if (s.board[i] < 0) moves.push(i);
        }
      }
      return moves;
    },
    isLegal(s, m) {
      if (s.winner !== null) return false;
      if (m < 0 || m >= 16) return false;
      if (s.phase === 'pick') return (s.usedMask & (1 << m)) === 0;
      return s.board[m] < 0;
    },
    play(s, m) {
      const board = s.board.slice();
      if (s.phase === 'pick') {
        return attach({
          board,
          usedMask: s.usedMask | (1 << m),
          chosenPiece: m,
          phase: 'place',
          turn: 1 - s.turn,
          winLine: null,
          winner: null,
          reason: '',
          lastCell: s.lastCell,
        });
      }
      board[m] = s.chosenPiece;
      const winLine = findWinningLine(board, square2x2);
      if (winLine) {
        return attach({
          board,
          usedMask: s.usedMask,
          chosenPiece: -1,
          phase: 'done',
          turn: s.turn,
          winLine,
          winner: s.turn,
          reason: 'クアルト成立！（同じ特徴が4つ並びました）',
          lastCell: m,
        });
      }
      if (board.every((v) => v >= 0)) {
        return attach({
          board,
          usedMask: s.usedMask,
          chosenPiece: -1,
          phase: 'done',
          turn: s.turn,
          winLine: null,
          winner: -1,
          reason: '引き分け（盤面がすべて埋まりました）',
          lastCell: m,
        });
      }
      return attach({
        board,
        usedMask: s.usedMask,
        chosenPiece: -1,
        phase: 'pick',
        turn: s.turn,
        winLine: null,
        winner: null,
        reason: '',
        lastCell: m,
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

function chooseQuartoMove(rules, s, _seat, level, rng) {
  const legal = rules.legalMoves(s);
  if (legal.length === 0) return 0;
  const lv = brainLevel(level);
  if (lv <= 0) return pickRandom(legal, rng);

  if (s.phase === 'place') {
    for (const cell of legal) {
      const nb = s.board.slice();
      nb[cell] = s.chosenPiece;
      if (findWinningLine(nb, rules.square2x2)) return cell;
    }
    if (lv >= 2) {
      // Prefer center/corners slightly
      const pref = [5, 6, 9, 10, 0, 3, 12, 15];
      for (const c of pref) {
        if (legal.includes(c)) return c;
      }
    }
    return pickRandom(legal, rng);
  }

  // phase === 'pick': avoid giving a piece that lets opponent win immediately
  const safe = [];
  for (const p of legal) {
    let oppWins = false;
    for (let cell = 0; cell < 16; cell++) {
      if (s.board[cell] >= 0) continue;
      const nb = s.board.slice();
      nb[cell] = p;
      if (findWinningLine(nb, rules.square2x2)) {
        oppWins = true;
        break;
      }
    }
    if (!oppWins) safe.push(p);
  }
  if (safe.length > 0) return pickRandom(safe, rng);
  return pickRandom(legal, rng);
}

export const QUARTO_SPEC = {
  id: 'quarto',
  no: 39,
  name: 'クアルト',
  category: 'BOARD',
  playersText: '2人',
  intro: '4つの特徴を持つ16個のコマを並べ、共通点のある4つを揃える。ただし置くコマは相手が選ぶ。',
  undoAllowed: true,
  seatsFor: () => 2,
  seatNames: ['先手', '後手'],
  makeRules: makeQuartoRules,
  chooseMove: chooseQuartoMove,
  options: [
    {
      key: 'square2x2',
      label: '2×2の四角でも勝ち',
      values: [
        ['off', 'なし（標準）'],
        ['on', 'あり（上級ルール）'],
      ],
      default: 'off',
      group: 'local',
    },
  ],
  sections: [
    { title: '概要と目的', body: '色・高さ・形・穴の有無という4つの特徴を持つ16個のコマを使います。縦・横・斜め（設定で2×2の四角も）に、どれか1つでも同じ特徴を持つコマを4つ並べたら「クアルト」で勝ちです。' },
    { title: '特徴的なルール', body: '自分で置くコマを自分で選ぶことはできません。手番のプレイヤーは「相手から渡されたコマを盤に置く」→「次に相手が置くコマを1つ選んで渡す」の順に行います。' },
    { title: '勝敗', body: '自分の手番でコマを置いたとき、共通点のある4つが揃ったらその場で勝ちです（見落としなしの自動判定）。16マスすべて埋まって揃わなければ引き分けです。' },
  ],
};
