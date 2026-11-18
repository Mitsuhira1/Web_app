import { makeDeck, shuffle, cardRank, cardObj, withView } from './_utils.mjs';

/**
 * 戦争 (War) — 2人用カードゲーム
 * ローカルルール:
 * - aRule: 'strong' (A最強: 2<...<K<A) / 'weak' (A最弱: A<2<...<K)
 * - warCards: '1' (戦争時は1枚伏せて次で勝負・日本定番) / '3' (3枚伏せて4枚目で勝負・海外定番)
 * - twoBeatsAce: 'off' / 'on' (2がAにだけ勝つ下克上ルール)
 * - joker: 'off' (52枚) / 'on' (ジョーカー2枚入り54枚・最強)
 * - winCond: 'all' (相手の札をすべて奪ったら勝ち) / 'rounds26' (26戦・山1周で獲得枚数が多い方が勝ち)
 */
export const WAR_SPEC = {
  id: 'war',
  no: 31,
  name: '戦争',
  category: 'CARD',
  players: '2人',
  intro: 'お互いに1枚ずつ札を出し、強い方が場の札を総取り。あいこなら「戦争」！',
  seatNames: ['先手', '後手'],
  undoAllowed: false,
  seatsFor: () => 2,
  options: [
    { key: 'aRule', label: 'Aの強さ', default: 'strong', group: 'rule', values: [['strong', 'Aが最強'], ['weak', 'Aが最弱']] },
    { key: 'warCards', label: '戦争(あいこ)の伏せ札', default: '1', group: 'local', hint: '日本式は1枚、海外式は3枚伏せます', values: [['1', '1枚伏せる'], ['3', '3枚伏せる']] },
    { key: 'twoBeatsAce', label: '2がAに勝つ', default: 'off', group: 'local', hint: '2対Aのときだけ2が勝つ下克上ルール', values: [['off', 'なし'], ['on', 'あり']] },
    { key: 'joker', label: 'ジョーカー', default: 'off', group: 'local', hint: '2枚追加(計54枚)・最強札', values: [['off', 'なし(52枚)'], ['on', 'あり(54枚)']] },
    { key: 'winCond', label: '決着ルール', default: 'all', group: 'rule', hint: '「全取り」は長引く場合があります', values: [['all', '相手の札を全取り'], ['rounds26', '26戦の獲得枚数']] },
  ],
  sections: [
    ['概要と目的', '2人に同じ枚数ずつ裏向きに配り、せーので1枚ずつ表に出して数字の強さを比べます。強い方が場の札をすべて獲得します。'],
    ['ローカルルール', '・Aの強さ(最強/最弱)\n・戦争の伏せ札(1枚/3枚)\n・2がAに勝つ(下克上)\n・ジョーカーあり(54枚)\n・決着ルール(全取り/26戦勝負)'],
    ['戦争(あいこ)', '同じ強さの札が出たら「戦争」です。規定枚数を裏向きに伏せた後、次の1枚を表に出して勝った方が溜まった札を総取りします。'],
  ],
  makeRules(opts) {
    const aRule = opts.jt('aRule', 'strong');
    const warCards = opts.it('warCards', 1);
    const twoBeatsAce = opts.jt('twoBeatsAce', 'off') === 'on';
    const useJoker = opts.jt('joker', 'off') === 'on';
    const winCond = opts.jt('winCond', 'all');

    function strength(id) {
      if (id >= 52) return 100;
      const r = cardRank(id);
      if (r === 1) return aRule === 'strong' ? 14 : 1;
      return r;
    }

    function compareCards(c0, c1) {
      const r0 = cardRank(c0), r1 = cardRank(c1);
      if (twoBeatsAce) {
        if (r0 === 2 && r1 === 1) return 1;
        if (r1 === 2 && r0 === 1) return -1;
      }
      const s0 = strength(c0), s1 = strength(c1);
      return s0 > s1 ? 1 : s0 < s1 ? -1 : 0;
    }

    function drawCard(s, p) {
      if (s.decks[p].length > 0) return { card: s.decks[p][0], deck: s.decks[p].slice(1), won: s.won[p].slice(), reshuffled: false };
      if (winCond === 'all' && s.won[p].length > 0) {
        // 獲得札を山札に戻す(決定論的に逆順+ローテーションでシャッフル相当)
        const nextDeck = s.won[p].slice().reverse();
        return { card: nextDeck[0], deck: nextDeck.slice(1), won: [], reshuffled: true };
      }
      return null;
    }

    function totalCards(s, p) {
      return s.decks[p].length + s.won[p].length;
    }

    return {
      playerCount: 2,
      initial(rng) {
        const deck = shuffle(makeDeck(useJoker ? 2 : 0), rng);
        const half = deck.length >> 1;
        return withView({
          decks: [deck.slice(0, half), deck.slice(half)],
          won: [[], []],
          faceUp: [-1, -1],
          pot: [], // 場に出ている札(表・裏すべて)
          war: false,
          warBlindLeft: [0, 0], // 戦争時に伏せる残り枚数
          turn: 0,
          battles: 0,
          lastWinner: -1, // 0, 1, or -2(戦争突入)
          lastRevealed: [-1, -1],
          winner: -1,
          reason: '',
        }, (r, me, st) => JSON.stringify({
          kind: 'war',
          me,
          turn: st.turn,
          deckCounts: [st.decks[0].length, st.decks[1].length],
          wonCounts: [st.won[0].length, st.won[1].length],
          totalCounts: [totalCards(st, 0), totalCards(st, 1)],
          faceUp: [cardObj(st.faceUp[0]), cardObj(st.faceUp[1])],
          lastRevealed: [cardObj(st.lastRevealed[0]), cardObj(st.lastRevealed[1])],
          potCount: st.pot.length,
          war: st.war,
          warBlindLeft: st.warBlindLeft,
          battles: st.battles,
          maxBattles: winCond === 'rounds26' ? 26 : 0,
          lastWinner: st.lastWinner,
        }));
      },
      toMove(s) {
        return s.winner >= -1 && s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        return new Int32Array([0]); // 0: 山札から1枚出す
      },
      isLegal(s, m) {
        return !s.reason && m === 0;
      },
      play(s, m) {
        const p = s.turn;
        const nextDecks = [s.decks[0].slice(), s.decks[1].slice()];
        const nextWon = [s.won[0].slice(), s.won[1].slice()];
        const nextFace = [s.faceUp[0], s.faceUp[1]];
        const nextPot = s.pot.slice();
        const nextBlind = [s.warBlindLeft[0], s.warBlindLeft[1]];
        let nextWar = s.war;
        let nextTurn = 1 - p;
        let battles = s.battles;
        let lastWinner = s.lastWinner;
        let lastRevealed = [s.lastRevealed[0], s.lastRevealed[1]];
        let winner = -1;
        let reason = '';

        // 0が引く前に両者リセット(前回の結果表示後)
        if (p === 0 && nextFace[0] >= 0 && nextFace[1] >= 0 && !s.war) {
          nextFace[0] = -1;
          nextFace[1] = -1;
          lastWinner = -1;
        }

        const drawn = drawCard({ decks: nextDecks, won: nextWon }, p);
        if (!drawn) {
          // 札切れで敗北
          winner = 1 - p;
          reason = `${p === 0 ? '先手' : '後手'}の札が尽きました`;
          return withView({
            ...s, decks: nextDecks, won: nextWon, faceUp: nextFace, pot: nextPot,
            turn: -1, winner, reason,
          }, s.__extraView);
        }

        nextDecks[p] = drawn.deck;
        nextWon[p] = drawn.won;
        nextPot.push(drawn.card);

        if (nextWar && nextBlind[p] > 0) {
          // 戦争中の伏せ札
          nextBlind[p] -= 1;
          // 同じ人が続けて引くわけではなく交互に伏せて最後に表を出す
        } else {
          nextFace[p] = drawn.card;
        }

        // 両者が表札を出し終えたか判定
        if (!nextWar && nextFace[0] >= 0 && nextFace[1] >= 0) {
          battles += 1;
          lastRevealed = [nextFace[0], nextFace[1]];
          const cmp = compareCards(nextFace[0], nextFace[1]);
          if (cmp > 0) {
            nextWon[0].push(...nextPot);
            nextPot.length = 0;
            lastWinner = 0;
            nextTurn = 0;
          } else if (cmp < 0) {
            nextWon[1].push(...nextPot);
            nextPot.length = 0;
            lastWinner = 1;
            nextTurn = 1;
          } else {
            // 戦争突入！
            nextWar = true;
            nextBlind[0] = warCards;
            nextBlind[1] = warCards;
            lastWinner = -2;
            nextFace[0] = -1;
            nextFace[1] = -1;
            nextTurn = 0;
          }
        } else if (nextWar && nextBlind[0] === 0 && nextBlind[1] === 0 && nextFace[0] >= 0 && nextFace[1] >= 0) {
          battles += 1;
          lastRevealed = [nextFace[0], nextFace[1]];
          const cmp = compareCards(nextFace[0], nextFace[1]);
          if (cmp > 0) {
            nextWon[0].push(...nextPot);
            nextPot.length = 0;
            nextWar = false;
            lastWinner = 0;
            nextTurn = 0;
          } else if (cmp < 0) {
            nextWon[1].push(...nextPot);
            nextPot.length = 0;
            nextWar = false;
            lastWinner = 1;
            nextTurn = 1;
          } else {
            // 再戦争！
            nextBlind[0] = warCards;
            nextBlind[1] = warCards;
            lastWinner = -2;
            nextFace[0] = -1;
            nextFace[1] = -1;
            nextTurn = 0;
          }
        }

        // 勝敗判定
        const c0 = nextDecks[0].length + nextWon[0].length;
        const c1 = nextDecks[1].length + nextWon[1].length;
        if (nextPot.length === 0) {
          if (c0 === 0) {
            winner = 1; reason = '後手がすべての札を獲得しました';
          } else if (c1 === 0) {
            winner = 0; reason = '先手がすべての札を獲得しました';
          } else if (winCond === 'rounds26' && battles >= 26) {
            if (c0 > c1) { winner = 0; reason = `26戦終了 (${c0}枚対${c1}枚)`; }
            else if (c1 > c0) { winner = 1; reason = `26戦終了 (${c0}枚対${c1}枚)`; }
            else { winner = -1; reason = `26戦終了 (${c0}枚対${c0}枚で引き分け)`; }
          } else if (battles >= 300) {
            // 無限ループ防止
            winner = c0 > c1 ? 0 : c1 > c0 ? 1 : -1;
            reason = `300戦到達 (${c0}枚対${c1}枚)`;
          }
        } else if (nextDecks[nextTurn].length === 0 && (winCond !== 'all' || nextWon[nextTurn].length === 0)) {
          // 戦争中に札切れ
          winner = 1 - nextTurn;
          reason = `${nextTurn === 0 ? '先手' : '後手'}の札が尽きました`;
        }

        return withView({
          decks: nextDecks,
          won: nextWon,
          faceUp: nextFace,
          pot: nextPot,
          war: nextWar,
          warBlindLeft: nextBlind,
          turn: reason ? -1 : nextTurn,
          battles,
          lastWinner,
          lastRevealed,
          winner,
          reason,
        }, s.__extraView);
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array([s.decks[0].length + s.won[0].length, s.decks[1].length + s.won[1].length]);
      },
    };
  },
  brain: {
    choose() { return 0; },
  },
};
