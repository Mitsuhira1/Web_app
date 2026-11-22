import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * コヨーテ (Coyote) — 2〜6人用カードゲーム
 * 全員に1枚ずつカードを配り、自分のカードだけ見えず他全員のカードが見える状態で、
 * 「場の合計値以下の数字」を前の人より大きく宣言するか、「コヨーテ」と指摘し合う。
 *
 * ローカルルール / オプション:
 * - players: 2〜6人 (既定 4)
 * - specialCards: 'on' (特殊カードあり: ×2, MAX→0, ?, 0(夜) の4枚を含む全36枚) / 'off' (特殊カード抜き・数字32枚)
 * - lives: '3' (3回負けで脱落・標準) / '2' (2回負けで脱落) / '1' (1回負けで脱落・時短)
 */

export const COYOTE_MOVE_COYOTE = 0;
export const COYOTE_MAX_BID = 160;

function buildCardCatalog() {
  const cards = [];
  const addNum = (value, count) => {
    const label = String(value);
    for (let i = 0; i < count; i++) {
      cards.push({ id: cards.length, kind: 'num', value, label, short: label });
    }
  };
  // 通常数字カード 32枚 (id 0..31)
  addNum(20, 1);
  addNum(15, 2);
  addNum(10, 3);
  addNum(5, 4);
  addNum(4, 4);
  addNum(3, 4);
  addNum(2, 4);
  addNum(1, 4);
  addNum(0, 3);
  addNum(-5, 2);
  addNum(-10, 1);
  // 特殊カード 4枚 (id 32..35)
  cards.push({ id: 32, kind: 'zero_reshuffle', value: 0, label: '0(夜)', short: '0★' });
  cards.push({ id: 33, kind: 'double', value: 0, label: '×2', short: '×2' });
  cards.push({ id: 34, kind: 'max0', value: 0, label: 'MAX→0', short: 'MAX→0' });
  cards.push({ id: 35, kind: 'mystery', value: 0, label: '?', short: '?' });
  return Object.freeze(cards.map((c) => Object.freeze(c)));
}

export const COYOTE_CARDS = buildCardCatalog();

export function coyoteCardObj(id) {
  if (id == null || id < 0 || id >= COYOTE_CARDS.length) return null;
  const c = COYOTE_CARDS[id];
  return { id: c.id, kind: c.kind, value: c.value, label: c.label, short: c.short };
}

/**
 * 公開されたカードID配列（?で追加されたカードも含む）から最終合計値を計算する。
 * 順序:
 * 1. MAX→0 がある場合、正の数字カード(value > 0)の中で最大の1枚を0として扱う
 * 2. 数字カード(num / zero_reshuffle)の合計を算出 (baseSum)
 * 3. ×2 がある場合、合計値を2倍にする
 */
export function evaluateCoyoteCards(cardIds) {
  let hasMax0 = false;
  let hasDouble = false;
  let hasReshuffle = false;
  let maxPosId = null;
  let maxPosVal = 0;

  for (const id of cardIds) {
    if (id == null || id < 0) continue;
    const c = COYOTE_CARDS[id];
    if (!c) continue;
    if (c.kind === 'max0') hasMax0 = true;
    else if (c.kind === 'double') hasDouble = true;
    else if (c.kind === 'zero_reshuffle') hasReshuffle = true;
    else if (c.kind === 'num' && c.value > maxPosVal) {
      maxPosVal = c.value;
      maxPosId = c.id;
    }
  }

  let baseSum = 0;
  let zeroedDone = false;
  let maxZeroedId = null;
  let maxZeroedValue = 0;

  for (const id of cardIds) {
    if (id == null || id < 0) continue;
    const c = COYOTE_CARDS[id];
    if (!c || c.kind !== 'num') continue;
    if (hasMax0 && !zeroedDone && maxPosId !== null && c.id === maxPosId) {
      zeroedDone = true;
      maxZeroedId = c.id;
      maxZeroedValue = c.value;
      continue;
    }
    baseSum += c.value;
  }

  const total = hasDouble ? baseSum * 2 : baseSum;
  return {
    total,
    baseSum,
    doubled: hasDouble,
    maxZeroedId,
    maxZeroedValue,
    hasReshuffle,
  };
}

// 決定論的 xorshift32 PRNG (play() 内のリシャッフルで restoreMatch / 通信同期の完全再現性を保証)
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

function nextAliveSeat(alive, fromSeat, n) {
  for (let step = 1; step <= n; step++) {
    const s = (fromSeat + step) % n;
    if (alive[s]) return s;
  }
  return -1;
}

function makeFullDeckIds(useSpecial) {
  const len = useSpecial ? 36 : 32;
  const d = [];
  for (let i = 0; i < len; i++) d.push(i);
  return d;
}

export const COYOTE_SPEC = {
  id: 'coyote',
  no: 44,
  name: 'コヨーテ',
  category: 'CARD',
  players: '2〜6人',
  intro: '自分のカードだけ見ずに全員の合計を予想！超えたと思ったら「コヨーテ！」と指摘しよう。',
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
      key: 'specialCards',
      label: '特殊カード',
      default: 'on',
      group: 'local',
      hint: '×2・MAX→0・?・0(夜)の4枚を入れるかどうか',
      values: [['on', 'あり(標準)'], ['off', 'なし(数字のみ)']],
    },
    {
      key: 'lives',
      label: 'ライフ数',
      default: '3',
      group: 'local',
      hint: '何回負けたら脱落にするか（1回にすると時短ルール）',
      values: [['3', '3回負けで脱落(標準)'], ['2', '2回負けで脱落'], ['1', '1回負けで即終了(時短)']],
    },
  ],
  sections: [
    [
      '概要と目的',
      '全員に1枚ずつカードが配られ、自分のカードだけ見えず他の全員のカードが見える状態でプレイします。手番では前の人より大きい「全員の合計以下の数字」を宣言するか、前の人の宣言が合計を超えていると思って「コヨーテ」と指摘します。最後まで生き残った人の勝ちです。',
    ],
    [
      '特殊カード',
      '・×2: 場の合計値を2倍にします。\n・MAX→0: 場にある正の数字カードのうち最大の1枚を0にします。\n・?: 判定時に山札から1枚追加でめくり、その値・効果を加えます。\n・0(夜): 値は0。このカードが出たラウンド終了後、山札と捨て札をすべて混ぜてシャッフルします。',
    ],
    [
      'ローカルルール',
      '・特殊カードのあり/なし（初心者向け・時短用）\n・ライフ数（3回負けで脱落 / 2回 / 1回負けで即終了）',
    ],
  ],
  makeRules(opts) {
    const n = opts.it('players', 4);
    const useSpecial = opts.jt('specialCards', 'on') !== 'off';
    const maxLives = Math.max(1, Math.min(3, opts.it('lives', 3)));

    function dealRound(deckIn, discardIn, alive, rngStateIn, forceReshuffle) {
      const aliveCount = alive.filter(Boolean).length;
      let deck = deckIn.slice();
      let discard = discardIn.slice();
      let rs = rngStateIn;
      let reshuffled = false;

      if (forceReshuffle || deck.length < aliveCount) {
        const merged = deck.concat(discard);
        const sh = shuffleWithState(merged, rs);
        deck = sh.arr;
        discard = [];
        rs = sh.rngState;
        reshuffled = true;
      }

      const cards = new Array(n).fill(-1);
      for (let i = 0; i < n; i++) {
        if (alive[i]) {
          cards[i] = deck.pop();
        }
      }
      return { deck, discard, cards, rngState: rs, reshuffled };
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const done = !!st.reason;
        const visibleCards = st.cards.map((cid, seatIdx) => {
          if (cid < 0) return null;
          if (done) return coyoteCardObj(cid);
          if (!st.alive[seatIdx]) return null;
          // 観戦者(me < 0 || me >= n)と本人のカードは伏せる（他の全員のカードは見える）
          if (me < 0 || me >= st.n || seatIdx === me) {
            return { hidden: true };
          }
          return coyoteCardObj(cid);
        });

        return JSON.stringify({
          kind: 'coyote',
          me,
          n: st.n,
          roundNo: st.roundNo,
          turn: st.turn,
          maxLives: st.maxLives,
          specialCards: st.useSpecial,
          lives: st.lives,
          losses: st.lives.map((lv) => st.maxLives - lv),
          alive: st.alive,
          cards: visibleCards,
          currentBid: st.currentBid,
          lastBidder: st.lastBidder,
          canCoyote: !done && st.currentBid > 0,
          minBid: st.currentBid + 1,
          maxBid: COYOTE_MAX_BID,
          bidHistory: st.bidHistory,
          deckCount: st.deck.length,
          discardCount: st.discard.length,
          discard: st.discard.map(coyoteCardObj),
          lastRound: st.lastRound,
          done,
        });
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        const fullDeck = makeFullDeckIds(useSpecial);
        const sh = shuffleWithState(fullDeck, initSeed);
        const lives = new Array(n).fill(maxLives);
        const alive = new Array(n).fill(true);
        const dealt = dealRound(sh.arr, [], alive, sh.rngState, false);

        return attachView({
          n,
          useSpecial,
          maxLives,
          roundNo: 1,
          rngState: dealt.rngState,
          deck: dealt.deck,
          discard: dealt.discard,
          lives,
          alive,
          cards: dealt.cards,
          turn: 0,
          currentBid: 0,
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
        if (s.currentBid > 0) moves.push(COYOTE_MOVE_COYOTE);
        for (let b = s.currentBid + 1; b <= COYOTE_MAX_BID; b++) {
          moves.push(b);
        }
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        if (s.reason) return false;
        if (m === COYOTE_MOVE_COYOTE) return s.currentBid > 0;
        return Number.isInteger(m) && m > s.currentBid && m <= COYOTE_MAX_BID;
      },
      play(s, m) {
        if (!this.isLegal(s, m)) return s;

        // 数字宣言
        if (m > 0) {
          const nextTurn = nextAliveSeat(s.alive, s.turn, n);
          return attachView({
            ...s,
            currentBid: m,
            lastBidder: s.turn,
            bidHistory: s.bidHistory.concat([{ seat: s.turn, bid: m }]),
            turn: nextTurn,
          });
        }

        // コヨーテ指摘 (m === 0)
        const caller = s.turn;
        const bidder = s.lastBidder;
        const bid = s.currentBid;

        let deck = s.deck.slice();
        let discard = s.discard.slice();
        let rs = s.rngState;

        const activeCardIds = [];
        let hasMystery = false;
        for (let i = 0; i < n; i++) {
          if (s.alive[i] && s.cards[i] >= 0) {
            activeCardIds.push(s.cards[i]);
            if (COYOTE_CARDS[s.cards[i]].kind === 'mystery') {
              hasMystery = true;
            }
          }
        }

        // ? カードがある場合、山札から1枚追加でめくる
        let mysteryCardId = -1;
        if (hasMystery) {
          if (deck.length === 0 && discard.length > 0) {
            const sh = shuffleWithState(discard, rs);
            deck = sh.arr;
            discard = [];
            rs = sh.rngState;
          }
          if (deck.length > 0) {
            mysteryCardId = deck.pop();
            activeCardIds.push(mysteryCardId);
          }
        }

        const evalRes = evaluateCoyoteCards(activeCardIds);
        const over = bid > evalRes.total;
        const loser = over ? bidder : caller;

        const lives = s.lives.slice();
        lives[loser] = Math.max(0, lives[loser] - 1);
        const alive = lives.map((lv) => lv > 0);
        const eliminated = !alive[loser];

        // 使用したカードを捨て札へ
        for (const cid of activeCardIds) {
          discard.push(cid);
        }

        const revealedCards = s.cards.map((cid, idx) => (s.alive[idx] && cid >= 0 ? coyoteCardObj(cid) : null));
        const survivors = [];
        for (let i = 0; i < n; i++) {
          if (alive[i]) survivors.push(i);
        }

        const lastRound = {
          roundNo: s.roundNo,
          cards: revealedCards,
          mysteryCard: mysteryCardId >= 0 ? coyoteCardObj(mysteryCardId) : null,
          baseSum: evalRes.baseSum,
          maxZeroedId: evalRes.maxZeroedId,
          maxZeroedValue: evalRes.maxZeroedValue,
          doubled: evalRes.doubled,
          finalTotal: evalRes.total,
          bid,
          bidder,
          caller,
          over,
          loser,
          eliminated,
          reshuffled: false,
        };

        // 生存者が1人だけになったら決着
        if (survivors.length <= 1) {
          const winner = survivors.length === 1 ? survivors[0] : -1;
          const reason = `第${s.roundNo}ラウンドで決着`;
          return attachView({
            ...s,
            rngState: rs,
            deck,
            discard,
            lives,
            alive,
            turn: -1,
            lastRound,
            winner,
            reason,
          });
        }

        // 次のラウンドを配布
        const dealt = dealRound(deck, discard, alive, rs, evalRes.hasReshuffle);
        lastRound.reshuffled = dealt.reshuffled;
        const nextStarter = alive[loser] ? loser : nextAliveSeat(alive, loser, n);

        return attachView({
          ...s,
          roundNo: s.roundNo + 1,
          rngState: dealt.rngState,
          deck: dealt.deck,
          discard: dealt.discard,
          lives,
          alive,
          cards: dealt.cards,
          turn: nextStarter,
          currentBid: 0,
          lastBidder: -1,
          bidHistory: [],
          lastRound,
        });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.lives);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const lv = brainLevel(level);
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 1) return legal[0];

      // 他プレイヤーの見えているカードを取得
      const otherIds = [];
      let visibleMystery = false;
      for (let i = 0; i < s.n; i++) {
        if (i !== seat && s.alive[i] && s.cards[i] >= 0) {
          otherIds.push(s.cards[i]);
          if (COYOTE_CARDS[s.cards[i]].kind === 'mystery') visibleMystery = true;
        }
      }

      // 未公開カードプール（自分のカード＋山札）を正確に復元（捨て札と他人のカードを除く）
      const seen = new Set(otherIds);
      for (const d of s.discard) seen.add(d);
      const totalCardCount = s.useSpecial ? 36 : 32;
      const unseen = [];
      for (let id = 0; id < totalCardCount; id++) {
        if (!seen.has(id)) unseen.push(id);
      }

      // Lv0: 簡易推定 + ランダム性高め
      if (lv === 0) {
        const otherEval = evaluateCoyoteCards(otherIds);
        const guessTotal = otherEval.total + 4 + (rngInt(rng, 9) - 4);
        if (s.currentBid > 0 && (s.currentBid > guessTotal || s.currentBid >= COYOTE_MAX_BID)) {
          return COYOTE_MOVE_COYOTE;
        }
        const bump = 1 + rngInt(rng, 5);
        return Math.min(COYOTE_MAX_BID, s.currentBid + bump);
      }

      // Lv1 / Lv2: 未公開カード全通りに対する厳密な分布計算
      // 自分が未公開カード u を持っているときの合計分布を計算する
      // (? が他に見えている場合、または自分が ? を引いた場合は山札平均値で近似)
      const unseenNumSum = unseen.reduce((acc, id) => {
        const c = COYOTE_CARDS[id];
        return acc + (c.kind === 'num' ? c.value : 0);
      }, 0);
      const avgUnseenNum = unseen.length > 0 ? unseenNumSum / unseen.length : 3;

      const possibleTotals = [];
      for (const myCand of unseen) {
        const combined = otherIds.concat([myCand]);
        const isMys = visibleMystery || COYOTE_CARDS[myCand].kind === 'mystery';
        const res = evaluateCoyoteCards(combined);
        let t = res.total;
        if (isMys) {
          t += Math.round(res.doubled ? avgUnseenNum * 2 : avgUnseenNum);
        }
        possibleTotals.push(t);
      }

      if (possibleTotals.length === 0) {
        return s.currentBid > 0 ? COYOTE_MOVE_COYOTE : 1;
      }

      possibleTotals.sort((a, b) => a - b);
      const meanTotal = possibleTotals.reduce((a, b) => a + b, 0) / possibleTotals.length;
      const maxPossible = possibleTotals[possibleTotals.length - 1];

      // 現在の宣言が実際の合計を超えている確率
      const pOver = (bid) => {
        let overCnt = 0;
        for (const t of possibleTotals) {
          if (bid > t) overCnt++;
        }
        return overCnt / possibleTotals.length;
      };

      if (s.currentBid > 0) {
        const curOverProb = pOver(s.currentBid);
        if (s.currentBid >= COYOTE_MAX_BID || curOverProb >= 0.999) {
          return COYOTE_MOVE_COYOTE;
        }
        const callThreshold = lv >= 2 ? 0.56 : 0.64;
        if (curOverProb >= callThreshold) {
          // Lv1 は少しだけ迷いを入れる
          if (lv >= 2 || rngFloat(rng) < 0.85) {
            return COYOTE_MOVE_COYOTE;
          }
        }
      }

      // 数字を宣言する: 安全圏かつ少しプレッシャーをかける値を選ぶ
      const targetRisk = lv >= 2 ? 0.35 : 0.45;
      let safeBid = s.currentBid + 1;
      for (let b = s.currentBid + 1; b <= Math.min(COYOTE_MAX_BID, Math.max(s.currentBid + 1, maxPossible)); b++) {
        if (pOver(b) <= targetRisk) {
          safeBid = b;
        } else {
          break;
        }
      }

      const minNext = s.currentBid + 1;
      if (safeBid <= minNext) {
        // すでにギリギリ → +1 で刻む
        return Math.min(COYOTE_MAX_BID, minNext);
      }

      // 余裕があるときは +1 〜 safeBid の間で刻み幅を選ぶ
      const span = safeBid - minNext;
      if (lv >= 2) {
        // 序盤は少し大きめに上げて相手を絞り、終盤は小さく刻む
        const step = span >= 6 ? Math.min(span, 2 + rngInt(rng, Math.min(5, Math.ceil(span / 2)))) : rngInt(rng, Math.min(3, span + 1));
        return Math.min(COYOTE_MAX_BID, minNext + step);
      } else {
        const mid = Math.round((minNext + Math.min(safeBid, Math.max(minNext, Math.floor(meanTotal)))) / 2);
        const jitter = rngInt(rng, 3) - 1;
        return Math.max(minNext, Math.min(COYOTE_MAX_BID, mid + jitter));
      }
    },
  },
};
