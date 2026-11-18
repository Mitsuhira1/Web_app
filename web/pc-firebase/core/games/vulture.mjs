import { shuffle, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ハゲタカのえじき (Hol's der Geier / Raj / Vulture's Prey) — 2〜5人用カードゲーム
 * 場に出た得点カード(-5〜+10の15枚)に対し、全員が手札(1〜15)から1枚伏せて出し、
 * プラス点は最大、マイナス点は最小を出した人が取る。同数(バッティング)は無効で次点の人が取る！
 * ローカルルール:
 * - players: 2〜5人
 * - tieCarry: 'discard' (全員バッティング時は流す・標準) / 'carry' (次の場へ持ち越し・有名ルール)
 */
export const VULTURE_SPEC = {
  id: 'vulture',
  no: 37,
  name: 'ハゲタカのえじき',
  category: 'CARD',
  players: '2〜5人',
  intro: '1〜15の札をせーので出して得点カードを奪い合う！同じ数字はバッティングで無効。',
  seatNames: ['1番', '2番', '3番', '4番', '5番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    { key: 'players', label: '人数', default: '4', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人'], ['5', '5人']] },
    { key: 'tieCarry', label: '全員バッティング時', default: 'discard', group: 'local', hint: '全員が被って誰も取れなかった時、次の得点に持ち越すルール', values: [['discard', '流す(標準)'], ['carry', '次の場へ持ち越し']] },
  ],
  sections: [
    ['概要と目的', '場に出る得点カード(-5〜-1、1〜10の計15枚)を、手札の1〜15のカードを使って取り合います。全15ラウンド終了時に合計点が最も高い人が勝ちです。'],
    ['バッティング', 'プラスのカードは一番大きい数字、マイナスのカードは一番小さい数字を出した人が引き取ります。ただし、同じ数字を出した人が複数いると「バッティング」となり無効になり、次の候補の人が獲得します。'],
    ['ローカルルール', '・全員バッティング時の持ち越し(あり/なし)'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 4);
    const carryOnTie = opts.jt('tieCarry', 'discard') === 'carry';

    function makeVultureDeck() {
      const d = [];
      for (let v = -5; v <= -1; v++) d.push(v);
      for (let v = 1; v <= 10; v++) d.push(v);
      return d;
    }

    function makeHand() {
      const h = [];
      for (let v = 1; v <= 15; v++) h.push(v);
      return h;
    }

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'vulture',
        me,
        n: st.n,
        turn: st.turn,
        roundNo: st.roundNo,
        currentTarget: st.roundNo <= 15 ? st.vultures[st.roundNo - 1] : null,
        carryPot: st.carryPot,
        scores: st.scores,
        pickedFlags: st.picks.map((v) => v > 0),
        myHand: me >= 0 && me < st.n ? st.hands[me] : [],
        myPick: me >= 0 && me < st.n ? st.picks[me] : 0,
        lastRound: st.lastRound,
      }));
    }

    return {
      playerCount: n,
      initial(rng) {
        const vultures = shuffle(makeVultureDeck(), rng);
        const hands = Array.from({ length: n }, () => makeHand());
        return attachView({
          n,
          vultures,
          roundNo: 1,
          carryPot: [],
          hands,
          picks: new Array(n).fill(0),
          turn: 0,
          scores: new Array(n).fill(0),
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
        return new Int32Array(s.hands[s.turn]);
      },
      isLegal(s, m) {
        return !s.reason && s.hands[s.turn].includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const hands = s.hands.map((h) => h.slice());
        const picks = s.picks.slice();
        hands[p] = hands[p].filter((v) => v !== m);
        picks[p] = m;

        if (p + 1 < n) {
          return attachView({ ...s, hands, picks, turn: p + 1 });
        }

        // 全員が選び終わった → 一斉公開＆判定
        const targetCard = s.vultures[s.roundNo - 1];
        const pot = s.carryPot.concat([targetCard]);
        const potSum = pot.reduce((a, b) => a + b, 0);

        // 出現回数を数える
        const freq = new Map();
        for (const v of picks) freq.set(v, (freq.get(v) || 0) + 1);
        const unique = picks.map((v, i) => ({ seat: i, v })).filter((x) => freq.get(x.v) === 1);

        let roundWinner = -1;
        if (unique.length > 0 && potSum !== 0) {
          unique.sort((a, b) => (potSum > 0 ? b.v - a.v : a.v - b.v));
          roundWinner = unique[0].seat;
        }

        const scores = s.scores.slice();
        let nextCarry = [];
        if (roundWinner >= 0) {
          scores[roundWinner] += potSum;
        } else if (carryOnTie) {
          nextCarry = pot;
        }

        const lastRound = {
          roundNo: s.roundNo,
          pot,
          potSum,
          picks: picks.slice(),
          winner: roundWinner,
        };

        if (s.roundNo >= 15) {
          const maxScore = Math.max(...scores);
          const winners = scores.map((sc, i) => (sc === maxScore ? i : -1)).filter((i) => i >= 0);
          const winner = winners.length === 1 ? winners[0] : -1;
          const reason = winner >= 0
            ? `全15戦終了 (${winner + 1}番が${maxScore}点で勝利！)`
            : `全15戦終了 (${maxScore}点で引き分け)`;
          return attachView({
            ...s, hands, picks: new Array(n).fill(0), carryPot: [], scores, lastRound,
            turn: -1, winner, reason,
          });
        }

        return attachView({
          ...s,
          roundNo: s.roundNo + 1,
          carryPot: nextCarry,
          hands,
          picks: new Array(n).fill(0),
          turn: 0,
          scores,
          lastRound,
        });
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
      if (lv === 0) return legal[rngInt(rng, legal.length)];
      const potSum = s.carryPot.reduce((a, b) => a + b, 0) + s.vultures[s.roundNo - 1];
      const absV = Math.abs(potSum);
      if (potSum > 0) {
        // プラス点が大きいほど大きい数字を狙う(少し揺らぎを入れてバッティング回避)
        const sorted = legal.slice().sort((a, b) => a - b);
        const targetIdx = Math.min(sorted.length - 1, Math.floor((absV / 12) * sorted.length));
        const jitter = lv >= 2 ? (rngInt(rng, 3) - 1) : 0;
        const idx = Math.max(0, Math.min(sorted.length - 1, targetIdx + jitter));
        return sorted[idx];
      } else {
        // マイナス点は中〜小の数字で回避
        const sorted = legal.slice().sort((a, b) => a - b);
        const targetIdx = Math.min(sorted.length - 1, Math.floor((absV / 8) * (sorted.length * 0.6)));
        return sorted[targetIdx];
      }
    },
  },
};
