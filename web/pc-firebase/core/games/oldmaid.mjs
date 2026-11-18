import { makeDeck, shuffle, cardRank, cardObj, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ババ抜き / ジジ抜き (Old Maid) — 2〜6人用カードゲーム
 * ローカルルール:
 * - variant: 'baba' (ジョーカー1枚入りのババ抜き) / 'jiji' (ジョーカーなし52枚からランダムに1枚抜いたジジ抜き)
 * - drawDir: 'left' (左隣・次席から引く) / 'right' (右隣・前席から引く)
 * - shuffleHand: 'on' (引く前に手札をシャッフルできる) / 'off' (シャッフルなし)
 */
export const OLDMAID_SPEC = {
  id: 'oldmaid',
  no: 34,
  name: 'ババ抜き',
  category: 'CARD',
  players: '2〜6人',
  intro: '同じ数字のペアを捨てて、隣の人の手札から1枚引き合う定番トランプ。',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    { key: 'players', label: '人数', default: '4', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人'], ['5', '5人'], ['6', '6人']] },
    { key: 'variant', label: 'ルール種別', default: 'baba', group: 'local', hint: 'ジジ抜きは最後に誰が余り札になるか分かりません', values: [['baba', 'ババ抜き(ジョーカーあり)'], ['jiji', 'ジジ抜き(1枚抜き)']] },
    { key: 'drawDir', label: '引く向き', default: 'left', group: 'local', values: [['left', '次の人から引く'], ['right', '前の人から引く']] },
    { key: 'shuffleHand', label: '手札シャッフル', default: 'on', group: 'local', values: [['on', 'あり'], ['off', 'なし']] },
  ],
  sections: [
    ['概要と目的', '同じ数字のペアを捨てながら、隣の手札から1枚ずつ引いていきます。手札がなくなった人から上がり、最後に1枚だけ残った人が負けです。'],
    ['ローカルルール', '・ババ抜き / ジジ抜き(52枚からランダムに1枚抜いて隠す)\n・引く向き(次の人 / 前の人)\n・手札シャッフルボタン(あり / なし)'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 4);
    const variant = opts.jt('variant', 'baba');
    const drawDir = opts.jt('drawDir', 'left');
    const allowShuffle = opts.jt('shuffleHand', 'on') === 'on';

    function discardPairs(hand) {
      const byRank = new Map();
      const kept = [];
      for (const c of hand) {
        if (c >= 52) {
          kept.push(c);
          continue;
        }
        const r = cardRank(c);
        if (byRank.has(r)) {
          byRank.delete(r); // ペア消滅
        } else {
          byRank.set(r, c);
        }
      }
      for (const c of byRank.values()) kept.push(c);
      return kept;
    }

    function nextActive(hands, from, step) {
      for (let i = 1; i < n; i++) {
        const idx = (from + i * step + n * 4) % n;
        if (hands[idx].length > 0) return idx;
      }
      return -1;
    }

    function targetSeat(hands, p) {
      return nextActive(hands, p, drawDir === 'left' ? 1 : -1);
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const tgt = st.turn >= 0 ? targetSeat(st.hands, st.turn) : -1;
        return JSON.stringify({
          kind: 'oldmaid',
          me,
          n: st.n,
          variant,
          turn: st.turn,
          target: tgt,
          handCounts: st.hands.map((h) => h.length),
          myHand: me >= 0 && me < st.n ? st.hands[me].map(cardObj) : [],
          outOrder: st.outOrder,
          loser: st.loser,
          lastDraw: st.lastDraw,
          allowShuffle,
          // ジジ抜きの抜け札は終局後のみ公開
          removedCard: st.reason && st.removed >= 0 ? cardObj(st.removed) : null,
        });
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        let deck = shuffle(makeDeck(variant === 'baba' ? 1 : 0), rng);
        let removed = -1;
        if (variant === 'jiji') {
          removed = deck.pop();
        }
        const raw = Array.from({ length: n }, () => []);
        deck.forEach((c, idx) => raw[idx % n].push(c));
        const hands = raw.map(discardPairs);
        const outOrder = [];
        hands.forEach((h, i) => { if (h.length === 0) outOrder.push(i); });

        let turn = 0;
        if (hands[turn].length === 0) turn = nextActive(hands, 0, 1);

        const active = hands.filter((h) => h.length > 0).length;
        let loser = -1;
        let reason = '';
        if (active <= 1) {
          loser = hands.findIndex((h) => h.length > 0);
          reason = '初期配札で決着しました';
        }

        return attachView({
          n,
          hands,
          outOrder,
          removed,
          turn: reason ? -1 : turn,
          loser,
          lastDraw: null,
          shuffledThisTurn: false,
          reason,
        });
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const tgt = targetSeat(s.hands, s.turn);
        if (tgt < 0) return new Int32Array(0);
        const cnt = s.hands[tgt].length;
        const moves = [];
        for (let i = 0; i < cnt; i++) moves.push(i);
        if (allowShuffle && !s.shuffledThisTurn && cnt > 1) moves.push(100);
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const tgt = targetSeat(s.hands, p);
        const hands = s.hands.map((h) => h.slice());
        const outOrder = s.outOrder.slice();

        if (m === 100) {
          // 対象の手札をシャッフル(決定論的ローテーション+反転)
          const th = hands[tgt];
          const k = (outOrder.length + th.length + p) % th.length;
          hands[tgt] = th.slice(k).concat(th.slice(0, k)).reverse();
          return attachView({ ...s, hands, shuffledThisTurn: true });
        }

        const picked = hands[tgt].splice(m, 1)[0];
        if (hands[tgt].length === 0 && !outOrder.includes(tgt)) outOrder.push(tgt);

        const beforeLen = hands[p].length;
        hands[p].push(picked);
        hands[p] = discardPairs(hands[p]);
        const paired = hands[p].length < beforeLen + 1;
        if (hands[p].length === 0 && !outOrder.includes(p)) outOrder.push(p);

        const lastDraw = { by: p, from: tgt, paired };

        const remaining = [];
        for (let i = 0; i < n; i++) if (hands[i].length > 0) remaining.push(i);

        if (remaining.length <= 1) {
          const loser = remaining.length === 1 ? remaining[0] : -1;
          // 勝者は最初に出た人(1位)
          const winner = outOrder.length > 0 ? outOrder[0] : -1;
          const reason = loser >= 0
            ? `${loser + 1}番にババが残りました (${winner + 1}番が1位上がり)`
            : '全員が上がりました';
          return attachView({
            ...s, hands, outOrder, turn: -1, loser, lastDraw, shuffledThisTurn: false, reason,
          });
        }

        const nextTurn = nextActive(hands, p, 1);
        return attachView({
          ...s, hands, outOrder, turn: nextTurn, lastDraw, shuffledThisTurn: false,
        });
      },
      outcome(s) {
        if (!s.reason) return null;
        const winner = s.outOrder.length > 0 ? s.outOrder[0] : -1;
        return { ys_1: winner, zs_1: s.reason };
      },
      scores(s) {
        // 上がり順位が高いほど高得点(未上がりは0)
        return new Int32Array(s.hands.map((h, i) => {
          const idx = s.outOrder.indexOf(i);
          return idx >= 0 ? (n - idx) * 10 : 0;
        }));
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s)).filter((m) => m < 100);
      return legal[rngInt(rng, legal.length)];
    },
  },
};
