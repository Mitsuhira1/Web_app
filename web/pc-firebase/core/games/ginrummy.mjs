import { makeDeck, shuffle, cardSuit, cardRank, cardObj, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ジンラミー (Gin Rummy) — 2人用カードゲーム
 * ローカルルール:
 * - target: '50' (50点) / '100' (100点標準)
 * - knockRule: 'standard' (デッドウッド10点以下でノック可) / 'straight_gin' (ジン=0点のみ上がり可) / 'oklahoma' (最初のめくり札の数字がノック上限・Aはジンのみ)
 * - aceHigh: 'low' (A-2-3のみ) / 'both' (Q-K-Aもラン可)
 */
export const GINRUMMY_SPEC = {
  id: 'ginrummy',
  no: 36,
  name: 'ジンラミー',
  category: 'CARD',
  players: '2人',
  intro: '10枚の手札で組(メルド)を作り、余り札(デッドウッド)を10点以下にしてノック！',
  seatNames: ['先手', '後手'],
  undoAllowed: false,
  seatsFor: () => 2,
  options: [
    { key: 'target', label: '目標点数', default: '100', group: 'rule', values: [['50', '50点'], ['100', '100点(標準)']] },
    { key: 'knockRule', label: 'ノック条件', default: 'standard', group: 'local', hint: 'オクラホマは最初のめくり札の数字がノック上限になります', values: [['standard', '標準(10点以下)'], ['oklahoma', 'オクラホマ・ジン'], ['straight_gin', 'ストレートジン(0点のみ)']] },
    { key: 'aceHigh', label: 'Q-K-Aの連番', default: 'low', group: 'local', values: [['low', 'A-2-3のみ'], ['both', 'Q-K-Aも可']] },
  ],
  sections: [
    ['概要と目的', '10枚の手札で「同じ数字3〜4枚」または「同じマークの連番3枚以上」の組(メルド)を作ります。組に入らない札(デッドウッド)の合計点を減らし、ノックやジン(0点)で上がって目標点数を目指します。'],
    ['札の点数', 'A=1点、2〜10=数字通り、J・Q・K=10点。'],
    ['ローカルルール', '・オクラホマ・ジン(最初の場札の数字がノック上限、Aならジンのみ)\n・ストレートジン(0点のジンのみ上がり可)\n・Q-K-Aの連番可否'],
  ],
  makeRules(opts) {
    const target = opts.it('target', 100);
    const knockRule = opts.jt('knockRule', 'standard');
    const aceHigh = opts.jt('aceHigh', 'low') === 'both';

    function deadwoodVal(id) {
      const r = cardRank(id);
      return r >= 10 ? 10 : r;
    }

    // 10枚(または11枚)から最適なメルド分割を計算し { deadwood, melds, unmatched } を返す
    function solveMelds(hand) {
      const n = hand.length;
      const sets = [];
      // グループ (同ランク3〜4枚)
      const byRank = new Map();
      for (let i = 0; i < n; i++) {
        const r = cardRank(hand[i]);
        if (!byRank.has(r)) byRank.set(r, []);
        byRank.get(r).push(i);
      }
      for (const idxs of byRank.values()) {
        if (idxs.length >= 3) {
          if (idxs.length === 3) {
            sets.push((1 << idxs[0]) | (1 << idxs[1]) | (1 << idxs[2]));
          } else {
            sets.push((1 << idxs[0]) | (1 << idxs[1]) | (1 << idxs[2]) | (1 << idxs[3]));
            for (let skip = 0; skip < 4; skip++) {
              let m = 0;
              for (let k = 0; k < 4; k++) if (k !== skip) m |= (1 << idxs[k]);
              sets.push(m);
            }
          }
        }
      }
      // ラン (同スート連番3枚以上)
      for (let s = 0; s < 4; s++) {
        const rankToIdx = new Map();
        for (let i = 0; i < n; i++) {
          if (cardSuit(hand[i]) === s) rankToIdx.set(cardRank(hand[i]), i);
        }
        for (let start = 1; start <= 11; start++) {
          let m = 0;
          let len = 0;
          for (let r = start; r <= 13; r++) {
            if (!rankToIdx.has(r)) break;
            m |= (1 << rankToIdx.get(r));
            len++;
            if (len >= 3) sets.push(m);
          }
        }
        if (aceHigh && rankToIdx.has(1)) {
          // Q-K-A, J-Q-K-A ...
          for (let start = 12; start >= 2; start--) {
            let m = 1 << rankToIdx.get(1);
            let ok = true;
            let len = 1;
            for (let r = start; r <= 13; r++) {
              if (!rankToIdx.has(r)) { ok = false; break; }
              m |= (1 << rankToIdx.get(r));
              len++;
            }
            if (ok && len >= 3) sets.push(m);
          }
        }
      }

      const totalVal = hand.reduce((acc, c) => acc + deadwoodVal(c), 0);
      let bestSaved = 0;
      let bestChosen = [];
      const setVals = sets.map((mask) => {
        let v = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) v += deadwoodVal(hand[i]);
        return v;
      });

      function dfs(idx, usedMask, saved, chosen) {
        if (saved > bestSaved) {
          bestSaved = saved;
          bestChosen = chosen.slice();
        }
        for (let i = idx; i < sets.length; i++) {
          if ((usedMask & sets[i]) === 0) {
            chosen.push(sets[i]);
            dfs(i + 1, usedMask | sets[i], saved + setVals[i], chosen);
            chosen.pop();
          }
        }
      }
      dfs(0, 0, 0, []);

      let usedAll = 0;
      const melds = bestChosen.map((mask) => {
        usedAll |= mask;
        const arr = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) arr.push(hand[i]);
        return arr;
      });
      const unmatched = [];
      for (let i = 0; i < n; i++) if ((usedAll & (1 << i)) === 0) unmatched.push(hand[i]);
      return { deadwood: totalVal - bestSaved, melds, unmatched };
    }

    function sortHand(h) {
      return h.slice().sort((a, b) => (cardRank(a) - cardRank(b)) || (cardSuit(a) - cardSuit(b)));
    }

    function setupRound(deck, roundNo, scores, starter) {
      const hands = [sortHand(deck.slice(0, 10)), sortHand(deck.slice(10, 20))];
      const upcard = deck[20];
      const stock = deck.slice(21);
      const knockLimit = knockRule === 'straight_gin' ? 0
        : knockRule === 'oklahoma' ? (cardRank(upcard) === 1 ? 0 : Math.min(10, deadwoodVal(upcard)))
        : 10;
      return {
        roundNo,
        hands,
        stock,
        discard: [upcard],
        turn: starter,
        phase: 'draw', // 'draw' | 'discard'
        knockLimit,
        scores,
        lastRoundResult: null,
        winner: -1,
        reason: '',
      };
    }

    function nextRoundDeck(s) {
      const d = makeDeck(0);
      let seed = s.roundNo * 2027 + s.scores[0] * 37 + s.scores[1] * 53;
      for (let i = d.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const j = seed % (i + 1);
        const t = d[i]; d[i] = d[j]; d[j] = t;
      }
      return d;
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const mySolve = me >= 0 && me < 2 ? solveMelds(st.hands[me]) : null;
        return JSON.stringify({
          kind: 'ginrummy',
          me,
          roundNo: st.roundNo,
          turn: st.turn,
          phase: st.phase,
          knockLimit: st.knockLimit,
          scores: st.scores,
          stockCount: st.stock.length,
          discardTop: st.discard.length ? cardObj(st.discard[st.discard.length - 1]) : null,
          discardCount: st.discard.length,
          oppCount: me >= 0 && me < 2 ? st.hands[1 - me].length : st.hands[1].length,
          myHand: me >= 0 && me < 2 ? st.hands[me].map(cardObj) : [],
          myMelds: mySolve ? mySolve.melds.map((m) => m.map(cardObj)) : [],
          myDeadwood: mySolve ? mySolve.deadwood : 0,
          revealedHands: st.reason ? st.hands.map((h) => h.map(cardObj)) : null,
          lastRoundResult: st.lastRoundResult,
        });
      });
    }

    return {
      playerCount: 2,
      initial(rng) {
        const deck = shuffle(makeDeck(0), rng);
        return attachView(setupRound(deck, 1, [0, 0], 0));
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const p = s.turn;
        if (s.phase === 'draw') {
          const moves = [0]; // 0: 山札から引く
          if (s.discard.length > 0) moves.push(1); // 1: 捨て札から取る
          return new Int32Array(moves);
        }
        // phase === 'discard'
        const hand = s.hands[p];
        const moves = hand.map((c) => 10 + c);
        // ノック/ジン可能かチェック
        for (const c of hand) {
          const rem = hand.filter((x) => x !== c);
          const { deadwood } = solveMelds(rem);
          if (deadwood <= s.knockLimit) {
            moves.push(100 + c);
          }
        }
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const hands = [s.hands[0].slice(), s.hands[1].slice()];
        const stock = s.stock.slice();
        const discard = s.discard.slice();

        if (s.phase === 'draw') {
          if (m === 1 && discard.length > 0) {
            hands[p].push(discard.pop());
          } else {
            if (stock.length <= 2) {
              // 山札残り2枚以下で引き直し(ウォール) → この局は引き分けで次局へ
              const nextDeck = nextRoundDeck(s);
              return attachView(setupRound(nextDeck, s.roundNo + 1, s.scores.slice(), 1 - p));
            }
            hands[p].push(stock.shift());
          }
          hands[p] = sortHand(hands[p]);
          return attachView({ ...s, hands, stock, discard, phase: 'discard' });
        }

        // phase === 'discard'
        const isKnock = m >= 100;
        const cardId = isKnock ? m - 100 : m - 10;
        const idx = hands[p].indexOf(cardId);
        hands[p].splice(idx, 1);
        discard.push(cardId);

        if (!isKnock) {
          if (stock.length <= 2) {
            // 残り2枚以下でウォール流局
            const nextDeck = nextRoundDeck(s);
            return attachView(setupRound(nextDeck, s.roundNo + 1, s.scores.slice(), 1 - p));
          }
          return attachView({ ...s, hands, stock, discard, phase: 'draw', turn: 1 - p });
        }

        // ノック / ジン解決
        const knocker = p;
        const defender = 1 - p;
        const kSolve = solveMelds(hands[knocker]);
        const dSolve = solveMelds(hands[defender]);
        const isGin = kSolve.deadwood === 0;
        let roundWinner;
        let pts;
        let type;
        if (isGin) {
          roundWinner = knocker;
          pts = dSolve.deadwood + 25;
          type = 'gin';
        } else if (kSolve.deadwood < dSolve.deadwood) {
          roundWinner = knocker;
          pts = dSolve.deadwood - kSolve.deadwood;
          type = 'knock';
        } else {
          // アンダーカット！
          roundWinner = defender;
          pts = (kSolve.deadwood - dSolve.deadwood) + 25;
          type = 'undercut';
        }
        const scores = s.scores.slice();
        scores[roundWinner] += pts;
        const lastRoundResult = { roundWinner, pts, type, kDw: kSolve.deadwood, dDw: dSolve.deadwood };

        if (scores[roundWinner] >= target) {
          return attachView({
            ...s, hands, stock, discard, scores, lastRoundResult, turn: -1,
            winner: roundWinner,
            reason: `${roundWinner === 0 ? '先手' : '後手'}が${scores[roundWinner]}点で目標(${target}点)に到達しました！`,
          });
        }

        const nextDeck = nextRoundDeck({ roundNo: s.roundNo, scores });
        const nextSt = setupRound(nextDeck, s.roundNo + 1, scores, roundWinner);
        nextSt.lastRoundResult = lastRoundResult;
        return attachView(nextSt);
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.scores);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      const lv = brainLevel(level);
      if (s.phase === 'draw') {
        if (lv >= 1 && legal.includes(1) && s.discard.length > 0) {
          const top = s.discard[s.discard.length - 1];
          // 捨て札を取ってデッドウッドが下がるなら取る
          const curDw = solveMeldsQuick(s.hands[seat]);
          const withTop = s.hands[seat].concat([top]);
          let bestAfter = 999;
          for (const c of withTop) {
            if (c === top) continue;
            const dw = solveMeldsQuick(withTop.filter((x) => x !== c));
            if (dw < bestAfter) bestAfter = dw;
          }
          if (bestAfter < curDw) return 1;
        }
        return 0;
      }
      // discard: ノック/ジン優先
      const knocks = legal.filter((m) => m >= 100);
      if (knocks.length > 0 && lv >= 1) {
        // ジンの手があれば即ジン
        for (const m of knocks) {
          const cid = m - 100;
          if (solveMeldsQuick(s.hands[seat].filter((x) => x !== cid)) === 0) return m;
        }
        return knocks[0];
      }
      if (lv === 0) {
        const disc = legal.filter((m) => m < 100);
        return disc[rngInt(rng, disc.length)];
      }
      let bestMove = legal[0];
      let bestDw = 999;
      for (const m of legal) {
        if (m >= 100) continue;
        const cid = m - 10;
        const dw = solveMeldsQuick(s.hands[seat].filter((x) => x !== cid));
        if (dw < bestDw) {
          bestDw = dw;
          bestMove = m;
        }
      }
      return bestMove;
    },
  },
};

function solveMeldsQuick(hand) {
  const rankCnt = new Int32Array(14);
  const bySuit = [[], [], [], []];
  let total = 0;
  for (const c of hand) {
    const r = (c % 13) + 1;
    rankCnt[r]++;
    bySuit[Math.floor(c / 13)].push(r);
    total += r >= 10 ? 10 : r;
  }
  // 簡易ヒューリスティック(Brain用高速計算)
  let saved = 0;
  for (let r = 1; r <= 13; r++) {
    if (rankCnt[r] >= 3) saved += rankCnt[r] * (r >= 10 ? 10 : r);
  }
  for (let s = 0; s < 4; s++) {
    const arr = bySuit[s].sort((a, b) => a - b);
    let run = 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i > 0 && arr[i] === arr[i - 1] + 1) {
        run++;
        sum += arr[i] >= 10 ? 10 : arr[i];
      } else {
        if (run >= 3) saved = Math.max(saved, sum);
        run = 1;
        sum = arr[i] >= 10 ? 10 : arr[i];
      }
    }
    if (run >= 3) saved = Math.max(saved, sum);
  }
  return Math.max(0, total - saved);
}
