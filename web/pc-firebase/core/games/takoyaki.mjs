import { makeDeck, shuffle, cardRank, cardObj, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * たこやき (Takoyaki / Trash / Garbage) — 2〜4人用カードゲーム
 * 1〜10の10マス(裏向き)を並べ、引いた札(A〜10)を対応する番号のマスに表向きに置いて連鎖させ、
 * 先に自分のマスをすべて表にしたら勝ち。
 * ローカルルール:
 * - wild: 'k_wild' (Kのみワイルド・J/Qはハズレ) / 'jqk_wild' (J/Q/Kすべてワイルド) / 'none' (絵札すべてハズレ)
 * - joker: 'off' (52枚) / 'wild' (ジョーカー2枚・最強ワイルド) / 'bomb' (ジョーカー2枚・引くと自分の表札を1枚裏に戻すドボン！)
 * - roundDown: 'single' (1回勝負) / 'countdown' (勝った人は次のラウンドで目標枚数が1枚ずつ減る・3勝先取)
 */
export const TAKOYAKI_SPEC = {
  id: 'takoyaki',
  no: 32,
  name: 'たこやき',
  category: 'CARD',
  players: '2〜4人',
  intro: '1〜10のマスに同じ数字のカードを並べて連鎖！全部表にしたら上がり。',
  seatNames: ['1番', '2番', '3番', '4番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 2),
  options: [
    { key: 'players', label: '人数', default: '2', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人']] },
    { key: 'wild', label: '絵札(J・Q・K)の扱い', default: 'k_wild', group: 'local', hint: 'ワイルドはどこにでも置ける万能札です', values: [['k_wild', 'Kのみワイルド(J・Qハズレ)'], ['jqk_wild', 'J・Q・Kすべてワイルド'], ['none', 'すべてハズレ']] },
    { key: 'joker', label: 'ジョーカー', default: 'off', group: 'local', values: [['off', 'なし(52枚)'], ['wild', 'あり(ワイルド)'], ['bomb', 'あり(ドボン: 表1枚を裏へ)']] },
    { key: 'roundDown', label: 'ラウンド制', default: 'single', group: 'local', hint: '減らしルールは勝つたびに必要枚数が減ります', values: [['single', '1回勝負'], ['countdown', '3勝先取(上がり毎に-1枚)']] },
  ],
  sections: [
    ['概要と目的', '自分の前に1〜10のカードを裏向きに並べ、山札や捨て札から引いたカードで1〜10を順番に表向きにしていきます。先にすべて表にした人が勝ちです。'],
    ['連鎖', '置いた場所に元々あった裏向きのカードをめくり、その数字のマスが空いていれば連続して置けます。ハズレが出たら捨てて交代です。'],
    ['ローカルルール', '・絵札の扱い(Kのみワイルド / JQKワイルド / ハズレ)\n・ジョーカー(なし / ワイルド / ドボン)\n・3勝先取の枚数減らしルール'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 2);
    const wildMode = opts.jt('wild', 'k_wild');
    const jokerMode = opts.jt('joker', 'off');
    const countdown = opts.jt('roundDown', 'single') === 'countdown';

    function isWild(id) {
      if (id >= 52) return jokerMode === 'wild';
      const r = cardRank(id);
      if (wildMode === 'k_wild') return r === 13;
      if (wildMode === 'jqk_wild') return r >= 11 && r <= 13;
      return false;
    }

    function isBomb(id) {
      return id >= 52 && jokerMode === 'bomb';
    }

    function setupRound(deckSeedArr, targets, wins, roundNo, starter) {
      const deck = deckSeedArr;
      let idx = 0;
      const boards = [];
      const open = [];
      for (let p = 0; p < n; p++) {
        const t = targets[p];
        boards.push(deck.slice(idx, idx + t));
        open.push(new Array(t).fill(false));
        idx += t;
      }
      const discard = [deck[idx++]];
      const stock = deck.slice(idx);
      return {
        n,
        targets,
        wins,
        roundNo,
        boards,
        open,
        stock,
        discard,
        turn: starter,
        phase: 'draw', // 'draw' | 'place' | 'bomb'
        held: -1,
        winner: -1,
        reason: '',
      };
    }

    function nextRoundDeck(s) {
      // ラウンド間で決定論的にシャッフルされた山札を作る
      const all = makeDeck(jokerMode !== 'off' ? 2 : 0);
      const seedMix = s.roundNo * 97 + s.discard.length * 13 + s.stock.length * 7;
      for (let i = all.length - 1; i > 0; i--) {
        const j = (seedMix + i * 31) % (i + 1);
        const t = all[i]; all[i] = all[j]; all[j] = t;
      }
      return all;
    }

    function canPlaceSlot(s, p, slot, cardId) {
      if (slot < 0 || slot >= s.targets[p]) return false;
      if (s.open[p][slot]) return false;
      if (isWild(cardId)) return true;
      const r = cardRank(cardId);
      return r >= 1 && r <= s.targets[p] && r - 1 === slot;
    }

    function checkBoardDone(s, p) {
      return s.open[p].every(Boolean);
    }

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'takoyaki',
        me,
        n: st.n,
        turn: st.turn,
        phase: st.phase,
        roundNo: st.roundNo,
        targets: st.targets,
        wins: st.wins,
        held: st.turn === me || st.phase === 'place' ? cardObj(st.held) : null,
        stockCount: st.stock.length,
        discardTop: st.discard.length ? cardObj(st.discard[st.discard.length - 1]) : null,
        discardCount: st.discard.length,
        boards: st.boards.map((b, p) => b.map((cid, idx) => (st.open[p][idx] ? cardObj(cid) : null))),
        open: st.open,
      }));
    }

    return {
      playerCount: n,
      initial(rng) {
        const deck = shuffle(makeDeck(jokerMode !== 'off' ? 2 : 0), rng);
        const targets = new Array(n).fill(10);
        const wins = new Array(n).fill(0);
        return attachView(setupRound(deck, targets, wins, 1, 0));
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const p = s.turn;
        if (s.phase === 'draw') {
          const moves = [0]; // 0: 山札から引く
          if (s.discard.length > 0) {
            const top = s.discard[s.discard.length - 1];
            // 捨て札トップが置ける場合のみ取れる(またはルール上いつでも取れても良いが置けないと意味がない)
            for (let slot = 0; slot < s.targets[p]; slot++) {
              if (canPlaceSlot(s, p, slot, top)) { moves.push(1); break; }
            }
          }
          return new Int32Array(moves);
        }
        if (s.phase === 'bomb') {
          // 自分の表になっているカード1枚を裏に戻す (move = 30 + slot)
          const moves = [];
          for (let i = 0; i < s.targets[p]; i++) {
            if (s.open[p][i]) moves.push(30 + i);
          }
          if (moves.length === 0) moves.push(20); // 表がなければ捨てて終了
          return new Int32Array(moves);
        }
        // phase === 'place'
        const moves = [];
        for (let slot = 0; slot < s.targets[p]; slot++) {
          if (canPlaceSlot(s, p, slot, s.held)) moves.push(10 + slot);
        }
        if (moves.length === 0) moves.push(20); // 置けないので捨てて手番終了
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const stock = s.stock.slice();
        const discard = s.discard.slice();
        const boards = s.boards.map((b) => b.slice());
        const open = s.open.map((o) => o.slice());

        if (s.phase === 'draw') {
          let drawn;
          if (m === 1 && discard.length > 0) {
            drawn = discard.pop();
          } else {
            if (stock.length === 0 && discard.length > 1) {
              const top = discard.pop();
              while (discard.length > 0) stock.push(discard.pop());
              discard.push(top);
            }
            if (stock.length === 0) {
              return attachView({ ...s, turn: -1, winner: -1, reason: '山札が尽きました' });
            }
            drawn = stock.shift();
          }
          if (isBomb(drawn)) {
            discard.push(drawn);
            const hasOpen = open[p].some(Boolean);
            if (!hasOpen) {
              return attachView({ ...s, stock, discard, boards, open, held: -1, phase: 'draw', turn: (p + 1) % n });
            }
            return attachView({ ...s, stock, discard, boards, open, held: -1, phase: 'bomb' });
          }
          return attachView({ ...s, stock, discard, boards, open, held: drawn, phase: 'place' });
        }

        if (s.phase === 'bomb') {
          if (m >= 30) {
            const slot = m - 30;
            open[p][slot] = false;
          }
          return attachView({ ...s, stock, discard, boards, open, held: -1, phase: 'draw', turn: (p + 1) % n });
        }

        // phase === 'place'
        if (m === 20) {
          discard.push(s.held);
          return attachView({ ...s, stock, discard, boards, open, held: -1, phase: 'draw', turn: (p + 1) % n });
        }

        const slot = m - 10;
        const swapped = boards[p][slot];
        boards[p][slot] = s.held;
        open[p][slot] = true;

        if (checkBoardDone({ open }, p)) {
          const wins = s.wins.slice();
          wins[p] += 1;
          if (!countdown || wins[p] >= 3 || s.targets[p] <= 1) {
            return attachView({
              ...s, stock, discard, boards, open, wins, held: -1, turn: -1,
              winner: p, reason: `${p + 1}番がすべてのマスを表にしました！`,
            });
          }
          const targets = s.targets.slice();
          targets[p] = Math.max(1, targets[p] - 1);
          const nextDeck = nextRoundDeck(s);
          return attachView(setupRound(nextDeck, targets, wins, s.roundNo + 1, (p + 1) % n));
        }

        if (isBomb(swapped)) {
          discard.push(swapped);
          return attachView({ ...s, stock, discard, boards, open, held: -1, phase: 'bomb' });
        }

        return attachView({ ...s, stock, discard, boards, open, held: swapped, phase: 'place' });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.open.map((o, i) => (countdown ? s.wins[i] * 100 : 0) + o.filter(Boolean).length));
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length <= 1) return legal[0] ?? -1;
      const lv = brainLevel(level);
      if (s.phase === 'draw') {
        if (legal.includes(1) && lv >= 1) return 1; // 捨て札が置けるなら取る
        return legal[0];
      }
      if (s.phase === 'place') {
        // ワイルドの時はなるべく後半の枠かランダム
        if (lv >= 1) return legal[legal.length - 1];
        return legal[rngInt(rng, legal.length)];
      }
      // bomb: 表になっている小さい番号を裏に戻す
      return legal[0];
    },
  },
};
