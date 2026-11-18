import { makeDeck, shuffle, cardSuit, cardRank, cardObj, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ハーツ (Hearts) — 4人用トリックテイキングカードゲーム
 * ローカルルール:
 * - target: '50' (50点短縮) / '100' (100点標準)
 * - passRule: 'standard' (左→右→対面→なし の4局周期) / 'none' (交換なし)
 * - jd: 'off' (標準) / 'minus10' (♦Jを取ると-10点の超有名ローカルルール)
 * - shootMoon: 'add26' (他の全員に+26点) / 'sub26' (自分が-26点)
 */
export const HEARTS_SPEC = {
  id: 'hearts',
  no: 35,
  name: 'ハーツ',
  category: 'CARD',
  players: '4人',
  intro: 'ハート(1点)と♠Q(13点)を取らないように立ち回る4人トリックテイキング。',
  seatNames: ['南(あなた)', '西', '北', '東'],
  undoAllowed: false,
  seatsFor: () => 4,
  options: [
    { key: 'target', label: '終了点数', default: '100', group: 'rule', values: [['50', '50点(短縮)'], ['100', '100点(標準)']] },
    { key: 'passRule', label: '手札交換', default: 'standard', group: 'rule', values: [['standard', '左→右→対面→なし'], ['none', '交換なし']] },
    { key: 'jd', label: '♦Jの-10点ルール', default: 'off', group: 'local', hint: 'ダイヤのJを取ると-10点になる有名ルール', values: [['off', 'なし'], ['minus10', 'あり(-10点)']] },
    { key: 'shootMoon', label: 'シュート・ザ・ムーン', default: 'add26', group: 'local', values: [['add26', '他の全員に+26点'], ['sub26', '自分から-26点']] },
  ],
  sections: [
    ['概要と目的', '4人それぞれに13枚ずつ配り、13トリックを行います。ハート(各1点)と♠Q(13点)をなるべく取らないようにし、誰かが終了点数に達した時点で最も点数が低い人が勝ちです。'],
    ['基本ルール', '・最初は ♣2 を持っている人が出します。\n・リードと同じマークがあれば必ず出します(マストフォロー)。\n・ハートが1枚出る(ハートブレイク)までは、ハートを先に出せません。\n・1トリック目はハートと♠Qを出せません(手札がそれしかない場合を除く)。'],
    ['シュート・ザ・ムーンとローカルルール', '・1人がハート全13枚と♠Qをすべて取ると「シュート・ザ・ムーン」成功！\n・ローカルルールで「♦Jを取ると-10点」も設定できます。'],
  ],
  makeRules(opts) {
    const target = opts.it('target', 100);
    const passRule = opts.jt('passRule', 'standard');
    const useJd = opts.jt('jd', 'off') === 'minus10';
    const moonMode = opts.jt('shootMoon', 'add26');

    const SUIT_CLUB = 3;
    const SUIT_HEART = 1;
    const SUIT_SPADE = 0;
    const SUIT_DIAMOND = 2;
    const CLUB2 = SUIT_CLUB * 13 + 1; // rank 2 -> idx 1
    const SPADE_Q = SUIT_SPADE * 13 + 11; // rank 12 -> idx 11
    const DIAMOND_J = SUIT_DIAMOND * 13 + 10; // rank 11 -> idx 10

    function rankVal(id) {
      const r = cardRank(id);
      return r === 1 ? 14 : r; // A=14最強
    }

    function passDirForRound(roundNo) {
      if (passRule === 'none') return -1;
      const m = (roundNo - 1) % 4;
      // 0: 左(+1), 1: 右(+3), 2: 対面(+2), 3: なし(-1)
      return m === 0 ? 1 : m === 1 ? 3 : m === 2 ? 2 : -1;
    }

    function sortHand(h) {
      return h.slice().sort((a, b) => {
        const sa = cardSuit(a), sb = cardSuit(b);
        if (sa !== sb) return sa - sb;
        return rankVal(a) - rankVal(b);
      });
    }

    function dealRound(deck, roundNo, totalScores) {
      const hands = [[], [], [], []];
      for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
      for (let p = 0; p < 4; p++) hands[p] = sortHand(hands[p]);
      const dir = passDirForRound(roundNo);
      let starter = 0;
      for (let p = 0; p < 4; p++) if (hands[p].includes(CLUB2)) starter = p;
      return {
        roundNo,
        passDir: dir, // -1=なし, 1=左, 2=対面, 3=右
        phase: dir >= 0 ? 'pass' : 'play',
        passTurn: 0,
        passPicks: [[], [], [], []],
        hands,
        trick: [], // [{ seat, card }]
        leadSeat: starter,
        turn: dir >= 0 ? 0 : starter,
        trickNo: 1,
        broken: false,
        roundPts: [0, 0, 0, 0],
        heartTaken: [0, 0, 0, 0],
        sqTaken: [false, false, false, false],
        totalScores,
        lastTrick: null,
        winner: -1,
        reason: '',
      };
    }

    function nextDeckFromState(s) {
      const d = makeDeck(0);
      let seed = s.roundNo * 1103 + s.totalScores[0] * 17 + s.totalScores[1] * 31 + s.totalScores[2] * 47;
      for (let i = d.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const j = seed % (i + 1);
        const t = d[i]; d[i] = d[j]; d[j] = t;
      }
      return d;
    }

    function isPenaltyCard(c) {
      return cardSuit(c) === SUIT_HEART || c === SPADE_Q;
    }

    function legalPlayCards(s, p) {
      const hand = s.hands[p];
      if (s.trick.length === 0) {
        if (s.trickNo === 1 && hand.includes(CLUB2)) return [CLUB2];
        if (!s.broken) {
          const nonHeart = hand.filter((c) => cardSuit(c) !== SUIT_HEART);
          if (nonHeart.length > 0) return nonHeart;
        }
        return hand.slice();
      }
      const leadSuit = cardSuit(s.trick[0].card);
      const follow = hand.filter((c) => cardSuit(c) === leadSuit);
      if (follow.length > 0) return follow;
      if (s.trickNo === 1) {
        const safe = hand.filter((c) => !isPenaltyCard(c));
        if (safe.length > 0) return safe;
      }
      return hand.slice();
    }

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'hearts',
        me,
        roundNo: st.roundNo,
        phase: st.phase,
        passDir: st.passDir,
        turn: st.turn,
        trickNo: st.trickNo,
        broken: st.broken,
        handCounts: st.hands.map((h) => h.length),
        myHand: me >= 0 && me < 4 ? st.hands[me].map(cardObj) : [],
        myPassPicks: me >= 0 && me < 4 ? st.passPicks[me] : [],
        trick: st.trick.map((t) => ({ seat: t.seat, card: cardObj(t.card) })),
        lastTrick: st.lastTrick,
        roundPts: st.roundPts,
        totalScores: st.totalScores,
      }));
    }

    return {
      playerCount: 4,
      initial(rng) {
        const deck = shuffle(makeDeck(0), rng);
        return attachView(dealRound(deck, 1, [0, 0, 0, 0]));
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const p = s.turn;
        if (s.phase === 'pass') {
          const picks = s.passPicks[p];
          const moves = s.hands[p].slice();
          if (picks.length === 3) moves.push(52); // 52: 交換確定
          return new Int32Array(moves);
        }
        return new Int32Array(legalPlayCards(s, p));
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        if (s.phase === 'pass') {
          const passPicks = s.passPicks.map((a) => a.slice());
          if (m === 52) {
            if (p < 3) {
              return attachView({ ...s, passPicks, turn: p + 1 });
            }
            // 全員3枚選択完了 → 一斉交換
            const hands = s.hands.map((h) => h.slice());
            for (let i = 0; i < 4; i++) {
              const dst = (i + s.passDir) % 4;
              for (const cid of passPicks[i]) {
                const idx = hands[i].indexOf(cid);
                if (idx >= 0) hands[i].splice(idx, 1);
                hands[dst].push(cid);
              }
            }
            for (let i = 0; i < 4; i++) hands[i] = sortHand(hands[i]);
            let starter = 0;
            for (let i = 0; i < 4; i++) if (hands[i].includes(CLUB2)) starter = i;
            return attachView({
              ...s, hands, passPicks: [[], [], [], []], phase: 'play', turn: starter, leadSeat: starter,
            });
          }
          // カード選択トグル
          const idx = passPicks[p].indexOf(m);
          if (idx >= 0) passPicks[p].splice(idx, 1);
          else if (passPicks[p].length < 3) passPicks[p].push(m);
          return attachView({ ...s, passPicks });
        }

        // phase === 'play'
        const hands = s.hands.map((h) => h.slice());
        const cIdx = hands[p].indexOf(m);
        hands[p].splice(cIdx, 1);

        const trick = s.trick.slice();
        trick.push({ seat: p, card: m });
        let broken = s.broken || cardSuit(m) === SUIT_HEART;

        if (trick.length < 4) {
          return attachView({ ...s, hands, trick, broken, turn: (p + 1) % 4 });
        }

        // トリック解決
        const leadSuit = cardSuit(trick[0].card);
        let best = trick[0];
        for (let i = 1; i < 4; i++) {
          if (cardSuit(trick[i].card) === leadSuit && rankVal(trick[i].card) > rankVal(best.card)) {
            best = trick[i];
          }
        }
        const tWinner = best.seat;
        let pts = 0;
        let hCnt = 0;
        let hasSq = false;
        for (const t of trick) {
          if (cardSuit(t.card) === SUIT_HEART) { pts += 1; hCnt += 1; }
          if (t.card === SPADE_Q) { pts += 13; hasSq = true; }
          if (useJd && t.card === DIAMOND_J) { pts -= 10; }
        }
        const roundPts = s.roundPts.slice();
        roundPts[tWinner] += pts;
        const heartTaken = s.heartTaken.slice();
        heartTaken[tWinner] += hCnt;
        const sqTaken = s.sqTaken.slice();
        if (hasSq) sqTaken[tWinner] = true;

        const lastTrick = { winner: tWinner, pts, cards: trick.map((t) => ({ seat: t.seat, card: cardObj(t.card) })) };

        if (s.trickNo < 13) {
          return attachView({
            ...s, hands, trick: [], broken, turn: tWinner, leadSeat: tWinner,
            trickNo: s.trickNo + 1, roundPts, heartTaken, sqTaken, lastTrick,
          });
        }

        // ラウンド終了 → シュート・ザ・ムーン判定
        const moonIdx = heartTaken.findIndex((h, i) => h === 13 && sqTaken[i]);
        const addPts = roundPts.slice();
        if (moonIdx >= 0) {
          const jdBonus = useJd ? roundPts[moonIdx] - 26 : 0; // -10点があれば維持
          for (let i = 0; i < 4; i++) {
            if (moonMode === 'add26') {
              addPts[i] = i === moonIdx ? jdBonus : 26 + (useJd && roundPts[i] < 0 ? roundPts[i] : 0);
            } else {
              addPts[i] = i === moonIdx ? -26 + jdBonus : (useJd && roundPts[i] < 0 ? roundPts[i] : 0);
            }
          }
        }
        const totalScores = s.totalScores.map((sc, i) => sc + addPts[i]);

        if (totalScores.some((sc) => sc >= target)) {
          const minScore = Math.min(...totalScores);
          const winners = totalScores.map((sc, i) => (sc === minScore ? i : -1)).filter((i) => i >= 0);
          const winner = winners.length === 1 ? winners[0] : -1;
          const reason = winner >= 0
            ? `${winner + 1}番が最小点数(${minScore}点)で勝利！`
            : `最小点数(${minScore}点)が複数名のため引き分け`;
          return attachView({
            ...s, hands, trick: [], broken, turn: -1, roundPts, totalScores, lastTrick, winner, reason,
          });
        }

        // 次ラウンドへ
        const nextDeck = nextDeckFromState({ roundNo: s.roundNo, totalScores });
        return attachView(dealRound(nextDeck, s.roundNo + 1, totalScores));
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.totalScores);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      const lv = brainLevel(level);
      if (s.phase === 'pass') {
        if (legal.includes(52)) return 52;
        const picks = s.passPicks[seat];
        const candidates = legal.filter((c) => c < 52 && !picks.includes(c));
        if (lv >= 1) {
          // 危険札(♠Q, ♠K, ♠A, 高いハート)を優先して渡す
          candidates.sort((a, b) => {
            const score = (c) => (c === 11 ? 100 : cardSuit(c) === 0 && (cardRank(c) === 1 || cardRank(c) === 13) ? 90 : cardSuit(c) === 1 ? 50 + (cardRank(c) === 1 ? 14 : cardRank(c)) : (cardRank(c) === 1 ? 14 : cardRank(c)));
            return score(b) - score(a);
          });
          return candidates[0];
        }
        return candidates[rngInt(rng, candidates.length)];
      }
      if (lv === 0) return legal[rngInt(rng, legal.length)];
      // NORMAL / HARD: トリック状況を見て判断
      const rv = (c) => (cardRank(c) === 1 ? 14 : cardRank(c));
      if (s.trick.length === 0) {
        // リード: なるべく小さい札
        return legal.slice().sort((a, b) => rv(a) - rv(b))[0];
      }
      const leadSuit = cardSuit(s.trick[0].card);
      const maxOnTable = Math.max(...s.trick.filter((t) => cardSuit(t.card) === leadSuit).map((t) => rv(t.card)));
      const follow = legal.filter((c) => cardSuit(c) === leadSuit);
      if (follow.length > 0) {
        // 負ける中で最大の札、なければ最小の札(ただし♠Qを避ける)
        const under = follow.filter((c) => rv(c) < maxOnTable).sort((a, b) => rv(b) - rv(a));
        if (under.length > 0) return under[0];
        if (s.trick.length === 3 && !s.trick.some((t) => cardSuit(t.card) === 1 || t.card === 11)) {
          // 最後の1人で失点がないなら高い札を処理
          return follow.slice().sort((a, b) => rv(b) - rv(a))[0];
        }
        return follow.slice().sort((a, b) => rv(a) - rv(b))[0];
      }
      // ボイド: ♠Q > 高いハート > 高い札を捨てる
      return legal.slice().sort((a, b) => {
        const pScore = (c) => (c === 11 ? 200 : cardSuit(c) === 1 ? 100 + rv(c) : rv(c));
        return pScore(b) - pScore(a);
      })[0];
    },
  },
};
