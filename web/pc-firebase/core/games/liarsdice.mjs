import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * ライアーズダイス / ブラフ (Liar's Dice / Perudo / Bluff) — 2〜6人用ダイスゲーム
 * 各プレイヤーは5個のサイコロをカップの中で振り、自分だけ出目を確認する。
 * 場全体にある「特定の出目の個数」を予想して宣言し合い、嘘だと思ったら「ダウト」を宣言する。
 *
 * ローカルルール / オプション:
 * - players: 2〜6人 (既定 4)
 * - wildOnes: 'on' (1をワイルド扱い＋1の宣言は半分で上書き可・標準) / 'off' (ワイルドなし)
 * - exactRule: 'off' (ジャスト宣言なし・標準) / 'others_lose' (的中時、他全員-1個) / 'gain_one' (的中時、自分+1個回復・上限5)
 */

export const LIARSDICE_MAX_DICE = 5;
export const LIARSDICE_MOVE_DOUBT = 0;
export const LIARSDICE_MOVE_EXACT = 1;

export function encodeLiarsBid(qty, face) {
  return 100 + qty * 10 + face;
}

export function decodeLiarsBid(move) {
  if (move < 111) return null;
  const v = move - 100;
  const face = v % 10;
  const qty = Math.floor(v / 10);
  if (qty < 1 || face < 1 || face > 6) return null;
  return { qty, face };
}

export function isHigherLiarsBid(prev, next, wildOnes) {
  if (!next || next.qty < 1 || next.face < 1 || next.face > 6) return false;
  if (!prev) return true;
  if (!wildOnes) {
    return next.qty > prev.qty || (next.qty === prev.qty && next.face > prev.face);
  }
  // 1のワイルド扱いルール
  if (prev.face === 1 && next.face === 1) {
    return next.qty > prev.qty;
  }
  if (prev.face !== 1 && next.face === 1) {
    return next.qty >= Math.ceil(prev.qty / 2);
  }
  if (prev.face === 1 && next.face !== 1) {
    return next.qty >= prev.qty * 2 + 1;
  }
  return next.qty > prev.qty || (next.qty === prev.qty && next.face > prev.face);
}

export function countMatchingDice(allDice, face, wildOnes) {
  let count = 0;
  for (const cup of allDice) {
    if (!cup) continue;
    for (const d of cup) {
      if (d === face || (wildOnes && face !== 1 && d === 1)) {
        count++;
      }
    }
  }
  return count;
}

function nextRng(state) {
  let x = (state | 0) || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = x >>> 0;
  return { state: u || 1, value: u / 4294967296 };
}

function rollAllDice(diceCounts, rngState) {
  let rs = rngState;
  const dice = diceCounts.map((cnt) => {
    const cup = [];
    for (let i = 0; i < cnt; i++) {
      const r = nextRng(rs);
      rs = r.state;
      cup.push(1 + Math.floor(r.value * 6));
    }
    cup.sort((a, b) => a - b);
    return cup;
  });
  return { dice, rngState: rs };
}

function nextAliveSeat(diceCounts, fromSeat, n) {
  for (let step = 1; step <= n; step++) {
    const s = (fromSeat + step) % n;
    if (diceCounts[s] > 0) return s;
  }
  return -1;
}

// 二項分布 P(X = k) for X ~ Bin(n, p)
function binomPmf(n, k, p) {
  if (k < 0 || k > n) return 0;
  let c = 1;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i++) {
    c = (c * (n - kk + i)) / i;
  }
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomAtLeast(n, need, p) {
  if (need <= 0) return 1;
  if (need > n) return 0;
  let sum = 0;
  for (let k = need; k <= n; k++) sum += binomPmf(n, k, p);
  return sum;
}

export const LIARSDICE_SPEC = {
  id: 'liarsdice',
  no: 46,
  name: 'ライアーズダイス',
  category: 'BOARD',
  players: '2〜6人',
  intro: 'カップの中のサイコロの出目を読み合い、場全体の個数を宣言！嘘だと思ったら「ダウト！」',
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
      key: 'wildOnes',
      label: '1のワイルド扱い',
      default: 'on',
      group: 'local',
      hint: '「1」を全ての出目の代用とし、1の個数宣言は通常の半分で上書きできるルール',
      values: [['on', 'あり(標準)'], ['off', 'なし']],
    },
    {
      key: 'exactRule',
      label: 'ジャスト(ピタリ)宣言',
      default: 'off',
      group: 'local',
      hint: '前の宣言とちょうど同じ個数だと予想して宣言できるローカルルール',
      values: [
        ['off', 'なし(標準)'],
        ['others_lose', '的中時・他全員−1個'],
        ['gain_one', '的中時・自分＋1個回復'],
      ],
    },
  ],
  sections: [
    [
      '概要と目的',
      '各プレイヤーは5個のサイコロを自分のカップの中で振り、自分だけ出目を確認します。手番では場全体にある「特定の出目の個数」を予想して宣言するか、前の人の宣言が嘘だと思って「ダウト」を宣言します。最後までサイコロが残った人の勝ちです。',
    ],
    [
      '宣言とダウト',
      '次の人は個数を増やすか、同じ個数でより大きい出目を宣言します。ダウトが宣言されたら全員のサイコロを公開し、宣言通りならダウトした人が、宣言未満なら宣言した人がサイコロを1個失います。',
    ],
    [
      'ローカルルール',
      '・1のワイルド扱い: 「1」をすべての出目の代用とし、1の宣言は通常の半分(切り上げ)の個数で上書き可能。1から通常出目に戻す時は「1の個数×2＋1」個以上が必要。\n・ジャスト(ピタリ)宣言: 宣言とちょうど同じ個数だった場合に的中（他全員が1個失う／または自分が1個回復）。外れると自分が1個失う。',
    ],
  ],
  makeRules(opts) {
    const n = Math.max(2, Math.min(6, opts.it('players', 4)));
    const wildOnes = opts.jt('wildOnes', 'on') !== 'off';
    const exactRule = opts.jt('exactRule', 'off');

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const done = !!st.reason;
        const isPlayer = me >= 0 && me < st.n;
        const totalDice = st.diceCounts.reduce((a, b) => a + b, 0);

        const diceView = st.dice.map((cup, idx) => {
          if (st.diceCounts[idx] <= 0 && !done) return [];
          if (done || (isPlayer && idx === me)) return cup.slice();
          return null;
        });

        return JSON.stringify({
          kind: 'liarsdice',
          me,
          n: st.n,
          roundNo: st.roundNo,
          turn: st.turn,
          wildOnes: st.wildOnes,
          exactRule: st.exactRule,
          diceCounts: st.diceCounts,
          totalDice,
          alive: st.diceCounts.map((c) => c > 0),
          dice: diceView,
          myDice: isPlayer ? st.dice[me].slice() : null,
          currentBid: st.currentBid,
          lastBidder: st.lastBidder,
          canDoubt: !done && st.currentBid !== null,
          canExact: !done && st.currentBid !== null && st.exactRule !== 'off',
          bidHistory: st.bidHistory,
          lastRound: st.lastRound,
          done,
        });
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        const diceCounts = new Array(n).fill(LIARSDICE_MAX_DICE);
        const rolled = rollAllDice(diceCounts, initSeed);

        return attachView({
          n,
          wildOnes,
          exactRule,
          roundNo: 1,
          rngState: rolled.rngState,
          diceCounts,
          dice: rolled.dice,
          turn: 0,
          currentBid: null,
          lastBidder: -1,
          bidHistory: [],
          lastRound: null,
          winner: -1,
          reason: '',
        });
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const moves = [];
        if (s.currentBid !== null) {
          moves.push(LIARSDICE_MOVE_DOUBT);
          if (s.exactRule !== 'off') moves.push(LIARSDICE_MOVE_EXACT);
        }
        const totalDice = s.diceCounts.reduce((a, b) => a + b, 0);
        for (let qty = 1; qty <= totalDice; qty++) {
          for (let face = 1; face <= 6; face++) {
            if (isHigherLiarsBid(s.currentBid, { qty, face }, s.wildOnes)) {
              moves.push(encodeLiarsBid(qty, face));
            }
          }
        }
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        if (s.reason) return false;
        if (m === LIARSDICE_MOVE_DOUBT) return s.currentBid !== null;
        if (m === LIARSDICE_MOVE_EXACT) return s.currentBid !== null && s.exactRule !== 'off';
        const bid = decodeLiarsBid(m);
        if (!bid) return false;
        const totalDice = s.diceCounts.reduce((a, b) => a + b, 0);
        if (bid.qty > totalDice) return false;
        return isHigherLiarsBid(s.currentBid, bid, s.wildOnes);
      },
      play(s, m) {
        if (!this.isLegal(s, m)) return s;

        // 宣言 (bid)
        if (m >= 111) {
          const bid = decodeLiarsBid(m);
          const nextTurn = nextAliveSeat(s.diceCounts, s.turn, n);
          return attachView({
            ...s,
            currentBid: bid,
            lastBidder: s.turn,
            bidHistory: s.bidHistory.concat([{ seat: s.turn, qty: bid.qty, face: bid.face }]),
            turn: nextTurn,
          });
        }

        // ダウト or ジャスト 解決
        const caller = s.turn;
        const bidder = s.lastBidder;
        const bid = s.currentBid;
        const actualCount = countMatchingDice(s.dice, bid.face, s.wildOnes);
        const diceCounts = s.diceCounts.slice();
        const losers = [];
        let gained = -1;
        let action = 'doubt';
        let callerSuccess = false;
        let nextStarterBase = caller;

        if (m === LIARSDICE_MOVE_DOUBT) {
          action = 'doubt';
          if (actualCount < bid.qty) {
            // 宣言が嘘 → 宣言者が1個失う
            callerSuccess = true;
            diceCounts[bidder] = Math.max(0, diceCounts[bidder] - 1);
            losers.push(bidder);
            nextStarterBase = bidder;
          } else {
            // 宣言通り → ダウトした人が1個失う
            callerSuccess = false;
            diceCounts[caller] = Math.max(0, diceCounts[caller] - 1);
            losers.push(caller);
            nextStarterBase = caller;
          }
        } else {
          // LIARSDICE_MOVE_EXACT
          action = 'exact';
          nextStarterBase = caller;
          if (actualCount === bid.qty) {
            callerSuccess = true;
            if (s.exactRule === 'others_lose') {
              for (let i = 0; i < n; i++) {
                if (i !== caller && diceCounts[i] > 0) {
                  diceCounts[i] = Math.max(0, diceCounts[i] - 1);
                  losers.push(i);
                }
              }
            } else if (s.exactRule === 'gain_one') {
              if (diceCounts[caller] < LIARSDICE_MAX_DICE) {
                diceCounts[caller]++;
                gained = caller;
              }
            }
          } else {
            callerSuccess = false;
            diceCounts[caller] = Math.max(0, diceCounts[caller] - 1);
            losers.push(caller);
          }
        }

        const eliminated = losers.filter((i) => diceCounts[i] === 0);
        const survivors = [];
        for (let i = 0; i < n; i++) if (diceCounts[i] > 0) survivors.push(i);

        const lastRound = {
          roundNo: s.roundNo,
          allDice: s.dice.map((c) => c.slice()),
          bid,
          bidder,
          caller,
          action,
          actualCount,
          callerSuccess,
          losers,
          gained,
          eliminated,
        };

        if (survivors.length <= 1) {
          const winner = survivors.length === 1 ? survivors[0] : -1;
          return attachView({
            ...s,
            diceCounts,
            turn: -1,
            lastRound,
            winner,
            reason: `第${s.roundNo}ラウンドで決着`,
          });
        }

        const rolled = rollAllDice(diceCounts, s.rngState);
        const nextStarter = diceCounts[nextStarterBase] > 0
          ? nextStarterBase
          : nextAliveSeat(diceCounts, nextStarterBase, n);

        return attachView({
          ...s,
          roundNo: s.roundNo + 1,
          rngState: rolled.rngState,
          diceCounts,
          dice: rolled.dice,
          turn: nextStarter,
          currentBid: null,
          lastBidder: -1,
          bidHistory: [],
          lastRound,
        });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.diceCounts);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const lv = brainLevel(level);
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 1) return legal[0];

      const totalDice = s.diceCounts.reduce((a, b) => a + b, 0);
      const myDice = s.dice[seat] || [];
      const otherDice = totalDice - myDice.length;

      const countMine = (face) => {
        let c = 0;
        for (const d of myDice) {
          if (d === face || (s.wildOnes && face !== 1 && d === 1)) c++;
        }
        return c;
      };

      const probFace = (face) => (s.wildOnes && face !== 1 ? 1 / 3 : 1 / 6);

      if (lv === 0) {
        if (s.currentBid) {
          const need = s.currentBid.qty - countMine(s.currentBid.face);
          const p = binomAtLeast(otherDice, need, probFace(s.currentBid.face));
          if (p < 0.25 && rngFloat(rng) < 0.75) return LIARSDICE_MOVE_DOUBT;
        }
        const bidMoves = legal.filter((m) => m >= 111);
        if (bidMoves.length === 0) return LIARSDICE_MOVE_DOUBT;
        return bidMoves[rngInt(rng, Math.min(bidMoves.length, 6))];
      }

      // 現在の宣言の評価
      if (s.currentBid) {
        const { qty, face } = s.currentBid;
        const mine = countMine(face);
        const need = qty - mine;
        const p = probFace(face);
        const pTrue = binomAtLeast(otherDice, need, p);
        const pExact = binomPmf(otherDice, need, p);

        // ジャスト宣言判定
        if (s.exactRule !== 'off' && lv >= 2 && pExact >= 0.30 && pTrue < 0.55) {
          return LIARSDICE_MOVE_EXACT;
        }

        // ダウト判定
        const doubtThreshold = lv >= 2 ? 0.34 : 0.28;
        if (pTrue < doubtThreshold) {
          return LIARSDICE_MOVE_DOUBT;
        }
      }

      // 次の宣言候補から最も成立確率が高い手（同率なら小さい手）を選ぶ
      const bidMoves = legal.filter((m) => m >= 111);
      if (bidMoves.length === 0) return LIARSDICE_MOVE_DOUBT;

      let bestMove = bidMoves[0];
      let bestScore = -1;
      for (const m of bidMoves) {
        const b = decodeLiarsBid(m);
        const mine = countMine(b.face);
        const need = b.qty - mine;
        const pTrue = binomAtLeast(otherDice, need, probFace(b.face));
        // 小さい宣言ほど次へ繋ぎやすいので微小ペナルティで抑える
        const score = pTrue - b.qty * 0.005 + (lv === 1 ? rngFloat(rng) * 0.08 : rngFloat(rng) * 0.02);
        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }

      // 最良の上げ手でも成立確率が極端に低いならダウトに切り替え
      if (s.currentBid) {
        const bestBid = decodeLiarsBid(bestMove);
        const pBest = binomAtLeast(otherDice, bestBid.qty - countMine(bestBid.face), probFace(bestBid.face));
        if (pBest < (lv >= 2 ? 0.22 : 0.15)) {
          return LIARSDICE_MOVE_DOUBT;
        }
      }

      return bestMove;
    },
  },
};
