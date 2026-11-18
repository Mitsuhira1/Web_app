import { makeDeck, shuffle, cardSuit, cardRank, cardObj, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ぶたのしっぽ (Buta no Shippo / Pig's Tail) — 2〜6人用カードゲーム
 * 円形に裏向きで並べた山から1枚めくって捨て場に出し、前の札と同じマークまたは同じ数字なら
 * 場の札をすべて引き取る。山がなくなったら手札が一番少ない人の勝ち！
 * ローカルルール:
 * - matchRule: 'suit_or_rank' (同じマークか数字 — 標準) / 'suit_only' (同じマークのみ)
 * - joker: 'off' (52枚) / 'take_all' (ジョーカー2枚・出たら必ず場の札を総取り)
 * - handPlay: 'off' (めくるのみ — 標準) / 'on' (手札から場の札と合わない札を出して回避できる)
 */
export const BUTANOSHIPPO_SPEC = {
  id: 'butanoshippo',
  no: 33,
  name: 'ぶたのしっぽ',
  category: 'CARD',
  players: '2〜6人',
  intro: '丸く並べた山から1枚めくり、前の札と同じマークか数字が出たら場の札を総取り！',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    { key: 'players', label: '人数', default: '4', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人'], ['5', '5人'], ['6', '6人']] },
    { key: 'matchRule', label: '引き取り条件', default: 'suit_or_rank', group: 'local', values: [['suit_or_rank', '同じマークまたは数字'], ['suit_only', '同じマークのみ']] },
    { key: 'joker', label: 'ジョーカー', default: 'off', group: 'local', values: [['off', 'なし(52枚)'], ['take_all', 'あり(出たら総取り)']] },
    { key: 'handPlay', label: '手札から逃げ出し', default: 'off', group: 'local', hint: '引き取った手札から、合わない札を出して山をめくらずに済ませるルール', values: [['off', 'なし(めくるのみ)'], ['on', 'あり']] },
  ],
  sections: [
    ['概要と目的', '中央に裏向きで円形(しっぽ状)に並べた山から1枚ずつめくり、中央の捨て場に出します。山がすべてなくなった時点で、手札(引き取った枚数)が一番少ない人の勝ちです。'],
    ['引き取り', 'めくった札が、すぐ前の札と「同じマーク」または「同じ数字」だった場合、中央に溜まった札をすべて引き取ります。'],
    ['ローカルルール', '・引き取り条件(マークまたは数字 / マークのみ)\n・ジョーカー(出たら強制総取り)\n・手札からの逃げ出し(あり/なし)'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 4);
    const matchRule = opts.jt('matchRule', 'suit_or_rank');
    const useJoker = opts.jt('joker', 'off') === 'take_all';
    const handPlay = opts.jt('handPlay', 'off') === 'on';

    function isMatch(c1, c2) {
      if (c1 < 0 || c2 < 0) return false;
      if (c1 >= 52 || c2 >= 52) return true;
      if (matchRule === 'suit_only') return cardSuit(c1) === cardSuit(c2);
      return cardSuit(c1) === cardSuit(c2) || cardRank(c1) === cardRank(c2);
    }

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'butanoshippo',
        me,
        n: st.n,
        turn: st.turn,
        ring: st.ring.map((c) => (c >= 0 ? 1 : 0)), // 1=残っている, 0=めくり済み
        ringRemain: st.ring.filter((c) => c >= 0).length,
        pileTop: st.pile.length ? cardObj(st.pile[st.pile.length - 1]) : null,
        pileCount: st.pile.length,
        handCounts: st.hands.map((h) => h.length),
        myHand: me >= 0 && me < st.n ? st.hands[me].map(cardObj) : [],
        lastAction: st.lastAction,
      }));
    }

    return {
      playerCount: n,
      initial(rng) {
        const ring = shuffle(makeDeck(useJoker ? 2 : 0), rng);
        const hands = Array.from({ length: n }, () => []);
        return attachView({
          n,
          ring,
          pile: [],
          hands,
          turn: 0,
          lastAction: null,
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
        for (let i = 0; i < s.ring.length; i++) {
          if (s.ring[i] >= 0) moves.push(i);
        }
        if (handPlay && s.pile.length > 0) {
          const top = s.pile[s.pile.length - 1];
          const hand = s.hands[s.turn];
          for (let i = 0; i < hand.length; i++) {
            if (!isMatch(hand[i], top) && hand[i] < 52) moves.push(100 + i);
          }
        }
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const ring = s.ring.slice();
        const pile = s.pile.slice();
        const hands = s.hands.map((h) => h.slice());
        let lastAction;

        if (m >= 100) {
          const hIdx = m - 100;
          const card = hands[p].splice(hIdx, 1)[0];
          pile.push(card);
          lastAction = { seat: p, type: 'escape', card: cardObj(card), took: 0 };
        } else {
          const card = ring[m];
          ring[m] = -1;
          const prev = pile.length ? pile[pile.length - 1] : -1;
          pile.push(card);
          if (card >= 52 || isMatch(card, prev)) {
            const took = pile.length;
            hands[p].push(...pile);
            pile.length = 0;
            lastAction = { seat: p, type: 'take', card: cardObj(card), took };
          } else {
            lastAction = { seat: p, type: 'safe', card: cardObj(card), took: 0 };
          }
        }

        const remain = ring.filter((c) => c >= 0).length;
        if (remain === 0) {
          const counts = hands.map((h) => h.length);
          const minCount = Math.min(...counts);
          const winners = counts.map((c, i) => (c === minCount ? i : -1)).filter((i) => i >= 0);
          const winner = winners.length === 1 ? winners[0] : -1;
          const reason = winner >= 0
            ? `山が尽きました (${winner + 1}番が手札${minCount}枚で最少勝利)`
            : `山が尽きました (最少${minCount}枚で引き分け)`;
          return attachView({ ...s, ring, pile, hands, turn: -1, lastAction, winner, reason });
        }

        return attachView({ ...s, ring, pile, hands, turn: (p + 1) % n, lastAction });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.hands.map((h) => h.length));
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      const lv = brainLevel(level);
      if (lv >= 1) {
        const escapes = legal.filter((m) => m >= 100);
        if (escapes.length > 0 && s.pile.length >= 2) {
          return escapes[rngInt(rng, escapes.length)];
        }
      }
      const flips = legal.filter((m) => m < 100);
      return flips[rngInt(rng, flips.length)];
    },
  },
};
