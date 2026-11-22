import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * 6ニムト (Take 6! / 6 nimmt!) — 2〜6人用カードゲーム
 * 1〜104の数字カード（牛マーク＝失点）を使い、各プレイヤーに10枚配り、場に4列を作る。
 * 毎ターン全員が同時に1枚選び、一斉公開して数字の小さい順に配置する。
 * 配置先は「末尾がそのカードより小さく、かつ最も大きい列」の末尾。
 * 列の6枚目を置く人はその列の5枚をすべて引き取り（牛マーク合計が失点）、自分のカードが新しい列の先頭になる。
 * どの列の末尾よりも小さいカードは、好きな列を1つ選んで全部引き取り、その列の1枚目にする。
 * 全10ターン終了時に失点が最も少ない人の勝ち。
 *
 * ローカルルール / オプション:
 * - players: 2〜6人 (既定 4)
 * - professional: 'off' (1〜104の全カード・標準) / 'on' (使用カードを 人数×10＋4 までに制限)
 * - endMode: 'single' (1ラウンドで終了・標準) / 'to66' (誰かの累計失点が66を超えるまでラウンドを繰り返す)
 *
 * 手の符号化:
 * - カード選択フェーズ: カード番号そのもの (1〜104)
 * - 列選択フェーズ: 列番号 (0〜3)
 * フェーズ (state.phase) で意味を分ける。
 */

export const TAKE6_MAX_CARD = 104;
export const TAKE6_ROW_COUNT = 4;
export const TAKE6_HAND_SIZE = 10;
export const TAKE6_BULL_LIMIT = 66;
export const TAKE6_PHASE_CHOOSE = 'choose';
export const TAKE6_PHASE_ROW_PICK = 'rowPick';
export const TAKE6_PHASE_DONE = 'done';

/** 牛マーク（失点）: 55→7、11の倍数→5、10の倍数→3、5で終わる数→2、その他→1 */
export function bullHeads(n) {
  if (n === 55) return 7;
  if (n % 11 === 0) return 5;
  if (n % 10 === 0) return 3;
  if (n % 10 === 5) return 2;
  return 1;
}

export function rowBullHeads(row) {
  return row.reduce((sum, c) => sum + bullHeads(c), 0);
}

function nextRng(state) {
  let x = (state | 0) || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = x >>> 0;
  return { state: u || 1, value: u / 4294967296 };
}

function shuffleWithState(arr, rngState) {
  const a = arr.slice();
  let rs = rngState;
  for (let i = a.length - 1; i > 0; i--) {
    const r = nextRng(rs);
    rs = r.state;
    const j = Math.floor(r.value * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return { arr: a, rngState: rs };
}

/** 配置先の列: 末尾が card より小さく、かつ最も大きい列。なければ -1 */
function targetRow(rows, card) {
  let best = -1;
  let bestTail = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    const tail = rows[i][rows[i].length - 1];
    if (tail < card && tail > bestTail) {
      bestTail = tail;
      best = i;
    }
  }
  return best;
}

export const TAKE6_SPEC = {
  id: 'take6',
  no: 48,
  name: '6ニムト',
  category: 'CARD',
  players: '2〜6人',
  intro: '全員同時にカードを出し、小さい順に列へ並べる。6枚目を置くと列の牛マークが失点に！',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    {
      key: 'players',
      label: '人数',
      default: '4',
      group: 'rule',
      values: [['2', '2人'], ['3', '3人'], ['4', '4人'], ['5', '5人'], ['6', '6人']],
    },
    {
      key: 'professional',
      label: 'プロフェッショナル',
      default: 'off',
      group: 'local',
      hint: '使用カードを「人数×10＋4」までに制限し、カウンティングできるようにするルール',
      values: [['off', 'なし(1〜104・標準)'], ['on', 'あり']],
    },
    {
      key: 'endMode',
      label: '終了条件',
      default: 'single',
      group: 'local',
      values: [['single', '1ラウンドで終了(標準)'], ['to66', '累計66点を超えるまで繰り返す']],
    },
  ],
  sections: [
    [
      '概要と目的',
      '1〜104の数字カードを全員同時に1枚ずつ出し、小さい順に場の4列へ配置します。全10ターン終了時に、引き取ったカードの牛マーク（失点）が最も少ない人の勝ちです。',
    ],
    [
      '配置と引き取り',
      'カードは「末尾がそのカードより小さく、かつ最も大きい列」の末尾に置きます。列の6枚目を置く人は、その列の5枚をすべて引き取り（牛マーク合計が失点）、自分のカードが新しい列の先頭になります。どの列の末尾よりも小さいカードを出した場合は、好きな列を1つ選んで全部引き取り、その列の1枚目にします。',
    ],
    [
      'オプション',
      '・プロフェッショナル: 使用カードを「人数×10＋4」までに制限します。\n・累計66点制: 1ラウンドで終わらず、誰かの累計失点が66点を超えるまでラウンドを繰り返します。',
    ],
  ],
  makeRules(opts) {
    const n = Math.max(2, Math.min(6, opts.it('players', 4)));
    const professional = opts.jt('professional', 'off') === 'on';
    const endMode = opts.jt('endMode', 'single') === 'to66' ? 'to66' : 'single';
    const maxCard = professional ? n * TAKE6_HAND_SIZE + TAKE6_ROW_COUNT : TAKE6_MAX_CARD;

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const isPlayer = me >= 0 && me < st.n;
        return JSON.stringify({
          kind: 'take6',
          me,
          n: st.n,
          phase: st.phase,
          turn: st.turn,
          roundNo: st.roundNo,
          turnNo: st.turnNo,
          professional: st.professional,
          endMode: st.endMode,
          maxCard: st.maxCard,
          rows: st.rows.map((row) => row.slice()),
          rowBulls: st.rows.map((row) => rowBullHeads(row)),
          myHand: isPlayer ? st.hands[me].slice() : [],
          handCounts: st.hands.map((h) => h.length),
          decided: st.choices.map((c) => c !== -1),
          myChoice: isPlayer ? st.choices[me] : -1,
          roundScores: st.roundPenalties.slice(),
          totalScores: st.penalties.slice(),
          lastReveal: st.lastReveal,
          lastRound: st.lastRound,
          done: st.phase === TAKE6_PHASE_DONE,
        });
      });
    }

    function cloneState(s) {
      return {
        ...s,
        hands: s.hands.map((h) => h.slice()),
        rows: s.rows.map((row) => row.slice()),
        choices: s.choices.slice(),
        queue: s.queue.map((e) => ({ ...e })),
        roundPenalties: s.roundPenalties.slice(),
        penalties: s.penalties.slice(),
        lastReveal: s.lastReveal ? JSON.parse(JSON.stringify(s.lastReveal)) : null,
        lastRound: s.lastRound ? { ...s.lastRound } : null,
      };
    }

    function startRound(base, roundNo) {
      const deck = [];
      for (let c = 1; c <= maxCard; c++) deck.push(c);
      const sh = shuffleWithState(deck, base.rngState);
      const cards = sh.arr;
      let idx = 0;
      const hands = [];
      for (let seat = 0; seat < n; seat++) {
        const hand = cards.slice(idx, idx + TAKE6_HAND_SIZE).sort((a, b) => a - b);
        idx += TAKE6_HAND_SIZE;
        hands.push(hand);
      }
      const rows = cards.slice(idx, idx + TAKE6_ROW_COUNT).sort((a, b) => a - b).map((c) => [c]);
      return attachView({
        ...base,
        rngState: sh.rngState,
        roundNo,
        turnNo: 1,
        hands,
        rows,
        choices: new Array(n).fill(-1),
        queue: [],
        roundPenalties: new Array(n).fill(0),
        phase: TAKE6_PHASE_CHOOSE,
        turn: 0,
      });
    }

    function finishGame(ns) {
      const minScore = Math.min(...ns.penalties);
      const winners = ns.penalties
        .map((sc, i) => (sc === minScore ? i : -1))
        .filter((i) => i >= 0);
      ns.winner = winners.length === 1 ? winners[0] : -1;
      ns.reason = endMode === 'to66' ? '累計66点を超過' : '10ターン終了';
      ns.phase = TAKE6_PHASE_DONE;
      ns.turn = -1;
      ns.queue = [];
      return attachView(ns);
    }

    // キュー（小さい順に並んだ未解決の選択カード）を処理する。
    // 列選択が必要なカードに当たったら phase='rowPick' で中断する。
    function processQueue(ns) {
      while (ns.queue.length > 0) {
        const e = ns.queue[0];
        const target = targetRow(ns.rows, e.card);
        if (target === -1) {
          ns.phase = TAKE6_PHASE_ROW_PICK;
          ns.turn = e.seat;
          return ns;
        }
        ns.queue.shift();
        if (ns.rows[target].length >= 5) {
          const took = ns.rows[target].slice();
          const tookBulls = rowBullHeads(took);
          ns.roundPenalties[e.seat] += tookBulls;
          ns.penalties[e.seat] += tookBulls;
          ns.rows[target] = [e.card];
          ns.lastReveal.placements.push({ seat: e.seat, card: e.card, row: target, took, tookBulls, rowPick: false });
        } else {
          ns.rows[target].push(e.card);
          ns.lastReveal.placements.push({ seat: e.seat, card: e.card, row: target, took: [], tookBulls: 0, rowPick: false });
        }
      }
      return finishTurn(ns);
    }

    function finishTurn(ns) {
      const handsEmpty = ns.hands.every((h) => h.length === 0);
      if (!handsEmpty) {
        ns.turnNo += 1;
        ns.choices = new Array(n).fill(-1);
        ns.phase = TAKE6_PHASE_CHOOSE;
        ns.turn = 0;
        return attachView(ns);
      }
      // ラウンド終了
      ns.lastRound = {
        roundNo: ns.roundNo,
        roundScores: ns.roundPenalties.slice(),
        totalScores: ns.penalties.slice(),
      };
      if (endMode === 'to66' && Math.max(...ns.penalties) <= TAKE6_BULL_LIMIT) {
        const base = {
          n,
          professional,
          endMode,
          maxCard,
          rngState: ns.rngState,
          penalties: ns.penalties.slice(),
          lastReveal: ns.lastReveal,
          lastRound: ns.lastRound,
          winner: -1,
          reason: '',
        };
        return startRound(base, ns.roundNo + 1);
      }
      return finishGame(ns);
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        const base = {
          n,
          professional,
          endMode,
          maxCard,
          rngState: initSeed,
          penalties: new Array(n).fill(0),
          lastReveal: null,
          lastRound: null,
          winner: -1,
          reason: '',
        };
        return startRound(base, 1);
      },
      toMove(s) {
        return s.phase === TAKE6_PHASE_DONE ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.phase === TAKE6_PHASE_DONE) return new Int32Array(0);
        if (s.phase === TAKE6_PHASE_ROW_PICK) return new Int32Array([0, 1, 2, 3]);
        return new Int32Array(s.hands[s.turn].slice().sort((a, b) => a - b));
      },
      isLegal(s, m) {
        if (s.phase === TAKE6_PHASE_DONE) return false;
        if (s.phase === TAKE6_PHASE_ROW_PICK) return Number.isInteger(m) && m >= 0 && m < TAKE6_ROW_COUNT;
        if (s.phase === TAKE6_PHASE_CHOOSE) return s.hands[s.turn].includes(m);
        return false;
      },
      play(s, m) {
        if (!this.isLegal(s, m)) return s;

        if (s.phase === TAKE6_PHASE_ROW_PICK) {
          const ns = cloneState(s);
          const e = ns.queue.shift();
          const took = ns.rows[m].slice();
          const tookBulls = rowBullHeads(took);
          ns.roundPenalties[e.seat] += tookBulls;
          ns.penalties[e.seat] += tookBulls;
          ns.rows[m] = [e.card];
          ns.lastReveal.placements.push({ seat: e.seat, card: e.card, row: m, took, tookBulls, rowPick: true });
          return processQueue(ns);
        }

        // カード選択フェーズ（同時選択: 未選択の次の席へ進める）
        const ns = cloneState(s);
        const seat = ns.turn;
        ns.hands[seat] = ns.hands[seat].filter((c) => c !== m);
        ns.choices[seat] = m;
        const next = ns.choices.findIndex((c) => c === -1);
        if (next >= 0) {
          ns.turn = next;
          return attachView(ns);
        }
        // 全員そろった → 一斉解決（小さい順）
        ns.queue = ns.choices
          .map((card, seatIdx) => ({ seat: seatIdx, card }))
          .sort((a, b) => a.card - b.card);
        ns.lastReveal = {
          roundNo: ns.roundNo,
          turnNo: ns.turnNo,
          cards: ns.choices.map((card, seatIdx) => ({ seat: seatIdx, card })),
          placements: [],
        };
        return processQueue(ns);
      },
      outcome(s) {
        return s.phase === TAKE6_PHASE_DONE ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.penalties);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 0) return -1;
      const lv = brainLevel(level);

      if (s.phase === TAKE6_PHASE_ROW_PICK) {
        if (lv === 0) return legal[rngInt(rng, legal.length)];
        let bestRow = legal[0];
        let bestBulls = Infinity;
        for (const rowIdx of legal) {
          const bulls = rowBullHeads(s.rows[rowIdx]);
          if (bulls < bestBulls) {
            bestBulls = bulls;
            bestRow = rowIdx;
          }
        }
        return bestRow;
      }

      if (lv === 0) return legal[rngInt(rng, legal.length)];

      const minRowBulls = Math.min(...s.rows.map((row) => rowBullHeads(row)));
      let bestCard = legal[0];
      let bestScore = Infinity;
      for (const card of legal) {
        const target = targetRow(s.rows, card);
        let score;
        if (target === -1) {
          // どの列にも置けない: 安い列を引き取るしかない
          score = 30 + minRowBulls;
        } else if (s.rows[target].length >= 5) {
          // 6枚目: その列を引き取る
          score = 20 + rowBullHeads(s.rows[target]);
        } else {
          const tail = s.rows[target][s.rows[target].length - 1];
          const gap = card - tail;
          score = s.rows[target].length * 1.2 + (gap <= 3 ? 0.5 : 0) + (gap >= 20 ? 1.0 : 0);
        }
        if (lv === 1) score += rngFloat(rng) * 3;
        if (score < bestScore) {
          bestScore = score;
          bestCard = card;
        }
      }
      return bestCard;
    },
  },
};
