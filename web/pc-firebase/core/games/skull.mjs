import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * スカル (Skull / Skull & Roses) — 3〜6人用ブラフカードゲーム
 * 各プレイヤーは「花3枚・ドクロ1枚」の計4枚を持つ。
 * 自分の前に1枚ずつ伏せて追加するか、「何枚めくってもドクロを引かないか」を宣言（チャレンジ）し合う。
 * 最高宣言者が自分の場から順にめくり、ドクロを引かずに達成すれば1ポイント（2ポイント先取で勝利）。
 * ドクロを引いたらカードを1枚失い、全カードを失うと脱落。
 *
 * ローカルルール / オプション:
 * - players: 3〜6人 (既定 4)
 * - targetPoints: '2' (2ポイント先取・標準) / '1' (1ポイント先取・時短)
 */

export const SKULL_CARD_FLOWER = 0;
export const SKULL_CARD_SKULL = 1;

export const SKULL_MOVE_PASS = 0;
// 1..24: 枚数宣言
export const SKULL_MOVE_PLACE_FLOWER = 100;
export const SKULL_MOVE_PLACE_SKULL = 101;
export const SKULL_MOVE_REVEAL_BASE = 200; // 200 + seat
export const SKULL_MOVE_DISCARD_FLOWER = 300;
export const SKULL_MOVE_DISCARD_SKULL = 301;

function nextRng(state) {
  let x = (state | 0) || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = x >>> 0;
  return { state: u || 1, value: u / 4294967296 };
}

function nextAliveSeat(alive, fromSeat, n) {
  for (let step = 1; step <= n; step++) {
    const s = (fromSeat + step) % n;
    if (alive[s]) return s;
  }
  return -1;
}

function nextActiveBidder(alive, passed, fromSeat, n) {
  for (let step = 1; step <= n; step++) {
    const s = (fromSeat + step) % n;
    if (alive[s] && !passed[s]) return s;
  }
  return -1;
}

function totalCardsOnTable(stacks) {
  let sum = 0;
  for (const st of stacks) sum += st.length;
  return sum;
}

export const SKULL_SPEC = {
  id: 'skull',
  no: 45,
  name: 'スカル',
  category: 'CARD',
  players: '3〜6人',
  intro: '花3枚とドクロ1枚で繰り広げる究極の読み合い！ドクロを避けて宣言枚数をめくり切れ。',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    {
      key: 'players',
      label: '人数',
      default: '4',
      group: 'rule',
      values: [['3', '3人'], ['4', '4人'], ['5', '5人'], ['6', '6人']],
    },
    {
      key: 'targetPoints',
      label: '勝利ポイント',
      default: '2',
      group: 'local',
      hint: '何ポイント先取で勝利にするか（1ポイントにすると時短ルール）',
      values: [['2', '2ポイント先取(標準)'], ['1', '1ポイント先取(時短)']],
    },
  ],
  sections: [
    [
      '概要と目的',
      '各プレイヤーは「花3枚・ドクロ1枚」の計4枚のカードを持ちます。先に2ポイントを獲得するか、最後まで生き残ったプレイヤーの勝ちです。',
    ],
    [
      '流れとチャレンジ',
      'まず全員が1枚ずつ伏せて置きます。以降は「カードを1枚伏せて追加する」か「何枚めくってもドクロを引かないか（チャレンジ）」を宣言します。誰かが宣言したら、他の人はさらに多い枚数を宣言するかパスします。最高宣言者はまず自分の場のカードをすべてめくり、残りを他人の場から選んでめくります。',
    ],
    [
      '成功と失敗',
      'ドクロを引かずに宣言枚数をめくり切れば1ポイント獲得。ドクロをめくると失敗となり、持ちカードを1枚永久に失います（自分のドクロなら自分で選んで捨て、他人のドクロならランダムに1枚失います）。カードが0枚になると脱落です。',
    ],
    [
      'ローカルルール',
      '・勝利ポイント（2ポイント先取 / 1ポイント先取の時短ルール）',
    ],
  ],
  makeRules(opts) {
    const n = Math.max(3, Math.min(6, opts.it('players', 4)));
    const targetPoints = Math.max(1, Math.min(2, opts.it('targetPoints', 2)));

    function startNewRound(base, starter, lastRound) {
      const alive = base.ownedFlowers.map((f, i) => f + base.ownedSkulls[i] > 0);
      const survivors = [];
      for (let i = 0; i < n; i++) if (alive[i]) survivors.push(i);

      if (survivors.length <= 1) {
        const winner = survivors.length === 1 ? survivors[0] : -1;
        return attachView({
          ...base,
          alive,
          phase: 'done',
          turn: -1,
          lastRound,
          winner,
          reason: `第${base.roundNo}ラウンドで決着`,
        });
      }

      const firstTurn = alive[starter] ? starter : nextAliveSeat(alive, starter, n);
      return attachView({
        ...base,
        roundNo: base.roundNo + 1,
        alive,
        phase: 'initial_place',
        turn: firstTurn,
        handFlowers: base.ownedFlowers.slice(),
        handSkulls: base.ownedSkulls.slice(),
        stacks: Array.from({ length: n }, () => []),
        revealedCounts: new Array(n).fill(0),
        placedInitial: alive.map((a) => !a),
        passed: alive.map((a) => !a),
        currentBid: 0,
        challenger: -1,
        bidHistory: [],
        revealedCount: 0,
        revealedSeq: [],
        pendingSkullOwner: -1,
        lastRound,
      });
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const done = !!st.reason;
        const isPlayer = me >= 0 && me < st.n;

        // 各席の場札表示: 上から revealedCounts[i] 枚だけ公開。未公開は本人(または終了時)のみ中身が見える
        const stacksView = st.stacks.map((stack, seatIdx) => {
          const revCnt = st.revealedCounts[seatIdx];
          const len = stack.length;
          const out = [];
          for (let idx = 0; idx < len; idx++) {
            // idx = 0 が底、idx = len - 1 が一番上。上から revCnt 枚 (idx >= len - revCnt) が公開済み
            const isRevealed = idx >= len - revCnt;
            if (isRevealed || done) {
              out.push({ revealed: isRevealed, card: stack[idx] });
            } else if (isPlayer && seatIdx === me) {
              out.push({ revealed: false, card: stack[idx] });
            } else {
              out.push({ revealed: false, hidden: true });
            }
          }
          return out;
        });

        const totalPlaced = totalCardsOnTable(st.stacks);
        const lastRoundView = st.lastRound
          ? {
              ...st.lastRound,
              // 他人のドクロでランダム喪失したカード種別は本人または終了時のみ開示
              lostCard:
                st.lastRound.lostCard == null
                  ? null
                  : (done || (isPlayer && me === st.lastRound.challenger) || st.lastRound.selfSkull)
                    ? st.lastRound.lostCard
                    : null,
            }
          : null;

        return JSON.stringify({
          kind: 'skull',
          me,
          n: st.n,
          roundNo: st.roundNo,
          phase: st.phase,
          turn: st.turn,
          targetPoints: st.targetPoints,
          points: st.points,
          alive: st.alive,
          totalCards: st.ownedFlowers.map((f, i) => f + st.ownedSkulls[i]),
          handCounts: st.handFlowers.map((f, i) => f + st.handSkulls[i]),
          myHand: isPlayer
            ? { flowers: st.handFlowers[me], skulls: st.handSkulls[me] }
            : null,
          myOwned: isPlayer
            ? { flowers: st.ownedFlowers[me], skulls: st.ownedSkulls[me] }
            : null,
          stacks: stacksView,
          stackCounts: st.stacks.map((x) => x.length),
          revealedCounts: st.revealedCounts,
          totalPlaced,
          currentBid: st.currentBid,
          challenger: st.challenger,
          passed: st.passed,
          bidHistory: st.bidHistory,
          revealedCount: st.revealedCount,
          revealedSeq: st.revealedSeq,
          mustRevealOwn:
            st.phase === 'reveal' &&
            st.challenger >= 0 &&
            st.revealedCounts[st.challenger] < st.stacks[st.challenger].length,
          lastRound: lastRoundView,
          done,
        });
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        const ownedFlowers = new Array(n).fill(3);
        const ownedSkulls = new Array(n).fill(1);
        const alive = new Array(n).fill(true);

        return attachView({
          n,
          targetPoints,
          roundNo: 1,
          rngState: initSeed,
          phase: 'initial_place',
          turn: 0,
          points: new Array(n).fill(0),
          alive,
          ownedFlowers,
          ownedSkulls,
          handFlowers: ownedFlowers.slice(),
          handSkulls: ownedSkulls.slice(),
          stacks: Array.from({ length: n }, () => []),
          revealedCounts: new Array(n).fill(0),
          placedInitial: new Array(n).fill(false),
          passed: new Array(n).fill(false),
          currentBid: 0,
          challenger: -1,
          bidHistory: [],
          revealedCount: 0,
          revealedSeq: [],
          pendingSkullOwner: -1,
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
        const p = s.turn;
        const moves = [];

        if (s.phase === 'initial_place') {
          if (s.handFlowers[p] > 0) moves.push(SKULL_MOVE_PLACE_FLOWER);
          if (s.handSkulls[p] > 0) moves.push(SKULL_MOVE_PLACE_SKULL);
          return new Int32Array(moves);
        }

        if (s.phase === 'play_or_bid') {
          if (s.handFlowers[p] > 0) moves.push(SKULL_MOVE_PLACE_FLOWER);
          if (s.handSkulls[p] > 0) moves.push(SKULL_MOVE_PLACE_SKULL);
          const total = totalCardsOnTable(s.stacks);
          for (let b = 1; b <= total; b++) moves.push(b);
          return new Int32Array(moves);
        }

        if (s.phase === 'bidding') {
          moves.push(SKULL_MOVE_PASS);
          const total = totalCardsOnTable(s.stacks);
          for (let b = s.currentBid + 1; b <= total; b++) moves.push(b);
          return new Int32Array(moves);
        }

        if (s.phase === 'reveal') {
          const ch = s.challenger;
          // 自分の場に未公開カードがある間は必ず自分の場からめくる
          if (s.revealedCounts[ch] < s.stacks[ch].length) {
            moves.push(SKULL_MOVE_REVEAL_BASE + ch);
            return new Int32Array(moves);
          }
          for (let i = 0; i < n; i++) {
            if (i !== ch && s.revealedCounts[i] < s.stacks[i].length) {
              moves.push(SKULL_MOVE_REVEAL_BASE + i);
            }
          }
          return new Int32Array(moves);
        }

        if (s.phase === 'discard_own') {
          if (s.ownedFlowers[p] > 0) moves.push(SKULL_MOVE_DISCARD_FLOWER);
          if (s.ownedSkulls[p] > 0) moves.push(SKULL_MOVE_DISCARD_SKULL);
          return new Int32Array(moves);
        }

        return new Int32Array(moves);
      },
      isLegal(s, m) {
        if (s.reason) return false;
        const p = s.turn;
        if (s.phase === 'initial_place') {
          if (m === SKULL_MOVE_PLACE_FLOWER) return s.handFlowers[p] > 0;
          if (m === SKULL_MOVE_PLACE_SKULL) return s.handSkulls[p] > 0;
          return false;
        }
        if (s.phase === 'play_or_bid') {
          if (m === SKULL_MOVE_PLACE_FLOWER) return s.handFlowers[p] > 0;
          if (m === SKULL_MOVE_PLACE_SKULL) return s.handSkulls[p] > 0;
          const total = totalCardsOnTable(s.stacks);
          return Number.isInteger(m) && m >= 1 && m <= total;
        }
        if (s.phase === 'bidding') {
          if (m === SKULL_MOVE_PASS) return true;
          const total = totalCardsOnTable(s.stacks);
          return Number.isInteger(m) && m > s.currentBid && m <= total;
        }
        if (s.phase === 'reveal') {
          const target = m - SKULL_MOVE_REVEAL_BASE;
          if (!Number.isInteger(target) || target < 0 || target >= n) return false;
          const ch = s.challenger;
          if (s.revealedCounts[ch] < s.stacks[ch].length) {
            return target === ch;
          }
          return target !== ch && s.revealedCounts[target] < s.stacks[target].length;
        }
        if (s.phase === 'discard_own') {
          if (m === SKULL_MOVE_DISCARD_FLOWER) return s.ownedFlowers[p] > 0;
          if (m === SKULL_MOVE_DISCARD_SKULL) return s.ownedSkulls[p] > 0;
          return false;
        }
        return false;
      },
      play(s, m) {
        if (!this.isLegal(s, m)) return s;
        const p = s.turn;

        // 1. 初期配置フェーズ / カード追加
        if (m === SKULL_MOVE_PLACE_FLOWER || m === SKULL_MOVE_PLACE_SKULL) {
          const card = m === SKULL_MOVE_PLACE_FLOWER ? SKULL_CARD_FLOWER : SKULL_CARD_SKULL;
          const handFlowers = s.handFlowers.slice();
          const handSkulls = s.handSkulls.slice();
          if (card === SKULL_CARD_FLOWER) handFlowers[p]--;
          else handSkulls[p]--;
          const stacks = s.stacks.map((st) => st.slice());
          stacks[p].push(card);

          if (s.phase === 'initial_place') {
            const placedInitial = s.placedInitial.slice();
            placedInitial[p] = true;
            const allPlaced = placedInitial.every(Boolean);
            const nextTurn = nextAliveSeat(s.alive, p, n);
            return attachView({
              ...s,
              handFlowers,
              handSkulls,
              stacks,
              placedInitial,
              phase: allPlaced ? 'play_or_bid' : 'initial_place',
              turn: nextTurn,
            });
          }

          // play_or_bid 中の追加
          const nextTurn = nextAliveSeat(s.alive, p, n);
          return attachView({
            ...s,
            handFlowers,
            handSkulls,
            stacks,
            turn: nextTurn,
          });
        }

        // 2. チャレンジ宣言（play_or_bid または bidding）
        if (m >= 1 && m <= 24) {
          const total = totalCardsOnTable(s.stacks);
          const bidHistory = s.bidHistory.concat([{ seat: p, bid: m }]);
          const passed = s.phase === 'play_or_bid' ? s.alive.map((a) => !a) : s.passed.slice();

          // 場の全枚数を宣言した場合、または他の未パス生存者が居ない場合は即 reveal へ
          const otherActive = [];
          for (let i = 0; i < n; i++) {
            if (i !== p && s.alive[i] && !passed[i]) otherActive.push(i);
          }

          if (m >= total || otherActive.length === 0) {
            return attachView({
              ...s,
              phase: 'reveal',
              currentBid: m,
              challenger: p,
              passed,
              bidHistory,
              turn: p,
            });
          }

          const nextTurn = nextActiveBidder(s.alive, passed, p, n);
          return attachView({
            ...s,
            phase: 'bidding',
            currentBid: m,
            challenger: p,
            passed,
            bidHistory,
            turn: nextTurn,
          });
        }

        // 3. パス（bidding）
        if (m === SKULL_MOVE_PASS) {
          const passed = s.passed.slice();
          passed[p] = true;
          const bidHistory = s.bidHistory.concat([{ seat: p, bid: 0 }]);

          const remaining = [];
          for (let i = 0; i < n; i++) {
            if (s.alive[i] && !passed[i]) remaining.push(i);
          }

          if (remaining.length <= 1) {
            const ch = s.challenger;
            return attachView({
              ...s,
              passed,
              bidHistory,
              phase: 'reveal',
              turn: ch,
            });
          }

          const nextTurn = nextActiveBidder(s.alive, passed, p, n);
          return attachView({
            ...s,
            passed,
            bidHistory,
            turn: nextTurn,
          });
        }

        // 4. めくりフェーズ (reveal)
        if (m >= SKULL_MOVE_REVEAL_BASE && m < SKULL_MOVE_REVEAL_BASE + n) {
          const target = m - SKULL_MOVE_REVEAL_BASE;
          const ch = s.challenger;
          const stack = s.stacks[target];
          const revIdx = stack.length - 1 - s.revealedCounts[target];
          const card = stack[revIdx];

          const revealedCounts = s.revealedCounts.slice();
          revealedCounts[target]++;
          const revealedSeq = s.revealedSeq.concat([{ seat: target, card }]);

          if (card === SKULL_CARD_FLOWER) {
            const newCount = s.revealedCount + 1;
            // チャレンジ達成！
            if (newCount >= s.currentBid) {
              const points = s.points.slice();
              points[ch]++;
              const lastRound = {
                roundNo: s.roundNo,
                challenger: ch,
                bid: s.currentBid,
                success: true,
                revealedSeq,
                skullOwner: -1,
                selfSkull: false,
                lostCard: null,
                eliminated: false,
              };

              if (points[ch] >= targetPoints) {
                return attachView({
                  ...s,
                  points,
                  revealedCounts,
                  revealedCount: newCount,
                  revealedSeq,
                  phase: 'done',
                  turn: -1,
                  lastRound,
                  winner: ch,
                  reason: `第${s.roundNo}ラウンドで決着`,
                });
              }

              return startNewRound({ ...s, points }, ch, lastRound);
            }

            // まだめくり継続
            return attachView({
              ...s,
              revealedCounts,
              revealedCount: newCount,
              revealedSeq,
            });
          }

          // ドクロをめくった → チャレンジ失敗！
          const selfSkull = target === ch;
          const ownedFlowers = s.ownedFlowers.slice();
          const ownedSkulls = s.ownedSkulls.slice();
          const fCnt = ownedFlowers[ch];
          const sCnt = ownedSkulls[ch];

          // 自分のドクロを踏んだ場合で花・ドクロ両方持っているときは自分で捨てるカードを選ぶ
          if (selfSkull && fCnt > 0 && sCnt > 0) {
            return attachView({
              ...s,
              revealedCounts,
              revealedSeq,
              phase: 'discard_own',
              turn: ch,
              pendingSkullOwner: target,
            });
          }

          // 自動喪失（1種しかない場合、または他人のドクロでランダム喪失）
          let lostCard;
          let rs = s.rngState;
          if (fCnt === 0) {
            lostCard = SKULL_CARD_SKULL;
            ownedSkulls[ch]--;
          } else if (sCnt === 0) {
            lostCard = SKULL_CARD_FLOWER;
            ownedFlowers[ch]--;
          } else {
            // 他人のドクロ: 持ちカード全体から均等確率で1枚喪失
            const r = nextRng(rs);
            rs = r.state;
            const pick = Math.floor(r.value * (fCnt + sCnt));
            if (pick < sCnt) {
              lostCard = SKULL_CARD_SKULL;
              ownedSkulls[ch]--;
            } else {
              lostCard = SKULL_CARD_FLOWER;
              ownedFlowers[ch]--;
            }
          }

          const eliminated = ownedFlowers[ch] + ownedSkulls[ch] <= 0;
          const lastRound = {
            roundNo: s.roundNo,
            challenger: ch,
            bid: s.currentBid,
            success: false,
            revealedSeq,
            skullOwner: target,
            selfSkull,
            lostCard,
            eliminated,
          };

          const nextStarter = selfSkull ? ch : target;
          return startNewRound({ ...s, rngState: rs, ownedFlowers, ownedSkulls }, nextStarter, lastRound);
        }

        // 5. 自分のドクロを踏んだ後のカード選択喪失 (discard_own)
        if (m === SKULL_MOVE_DISCARD_FLOWER || m === SKULL_MOVE_DISCARD_SKULL) {
          const ch = s.challenger;
          const ownedFlowers = s.ownedFlowers.slice();
          const ownedSkulls = s.ownedSkulls.slice();
          const lostCard = m === SKULL_MOVE_DISCARD_FLOWER ? SKULL_CARD_FLOWER : SKULL_CARD_SKULL;
          if (lostCard === SKULL_CARD_FLOWER) ownedFlowers[ch]--;
          else ownedSkulls[ch]--;

          const eliminated = ownedFlowers[ch] + ownedSkulls[ch] <= 0;
          const lastRound = {
            roundNo: s.roundNo,
            challenger: ch,
            bid: s.currentBid,
            success: false,
            revealedSeq: s.revealedSeq,
            skullOwner: ch,
            selfSkull: true,
            lostCard,
            eliminated,
          };

          return startNewRound({ ...s, ownedFlowers, ownedSkulls }, ch, lastRound);
        }

        return s;
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.points);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const lv = brainLevel(level);
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 1) return legal[0];

      // 自分の場にドクロが伏せてあるかチェック
      const myStackHasSkull = s.stacks[seat].includes(SKULL_CARD_SKULL);
      const myStackLen = s.stacks[seat].length;
      const total = totalCardsOnTable(s.stacks);

      if (s.phase === 'initial_place') {
        if (lv === 0) return legal[rngInt(rng, legal.length)];
        // 初期配置: 25〜35% の確率でドクロを仕込む
        if (legal.includes(SKULL_MOVE_PLACE_SKULL) && legal.includes(SKULL_MOVE_PLACE_FLOWER)) {
          const skullProb = lv >= 2 ? 0.3 : 0.25;
          return rngFloat(rng) < skullProb ? SKULL_MOVE_PLACE_SKULL : SKULL_MOVE_PLACE_FLOWER;
        }
        return legal[0];
      }

      if (s.phase === 'discard_own') {
        // 基本的に花が残っていれば花を捨ててドクロを残す（ブラフの武器を守る）
        if (s.ownedFlowers[seat] >= 2 && legal.includes(SKULL_MOVE_DISCARD_FLOWER)) {
          return SKULL_MOVE_DISCARD_FLOWER;
        }
        return legal[rngInt(rng, legal.length)];
      }

      if (s.phase === 'play_or_bid') {
        const placeMoves = legal.filter((m) => m === SKULL_MOVE_PLACE_FLOWER || m === SKULL_MOVE_PLACE_SKULL);
        const bidMoves = legal.filter((m) => m >= 1 && m <= 24);
        if (lv === 0) return legal[rngInt(rng, legal.length)];

        // 自分の場にドクロを置いている場合: 追加置きを優先（手札が無ければ仕方なく最小宣言）
        if (myStackHasSkull) {
          if (placeMoves.length > 0) {
            return placeMoves.includes(SKULL_MOVE_PLACE_FLOWER) ? SKULL_MOVE_PLACE_FLOWER : placeMoves[0];
          }
          return bidMoves[0];
        }

        // 手札があるとき: 場の枚数が少ないうちは追加置きが多め、増えたらチャレンジ開始
        const challengeChance = Math.min(0.85, 0.25 + total * 0.1);
        if (placeMoves.length > 0 && rngFloat(rng) > challengeChance) {
          if (placeMoves.includes(SKULL_MOVE_PLACE_SKULL) && placeMoves.includes(SKULL_MOVE_PLACE_FLOWER)) {
            return rngFloat(rng) < 0.22 ? SKULL_MOVE_PLACE_SKULL : SKULL_MOVE_PLACE_FLOWER;
          }
          return placeMoves[0];
        }

        // チャレンジ開始枚数: 自分の安全枚数 + 1〜2 くらいから始める
        const safeEstimate = Math.min(total, Math.max(1, myStackLen + (lv >= 2 ? 1 : rngInt(rng, 2))));
        return safeEstimate;
      }

      if (s.phase === 'bidding') {
        if (lv === 0) {
          return rngFloat(rng) < 0.55 ? SKULL_MOVE_PASS : legal[rngInt(rng, legal.length)];
        }
        // 自分の場にドクロがあるなら絶対にチャレンジを引き受けずパス！
        if (myStackHasSkull) return SKULL_MOVE_PASS;

        // 生存している他人の数を数え、ドクロが場にある期待枚数を差し引く
        let aliveOthers = 0;
        for (let i = 0; i < s.n; i++) {
          if (i !== seat && s.alive[i]) aliveOthers++;
        }
        const safeCap = Math.max(myStackLen, total - Math.ceil(aliveOthers * (lv >= 2 ? 0.55 : 0.45)));
        if (s.currentBid + 1 <= safeCap && (lv >= 2 || rngFloat(rng) < 0.75)) {
          return s.currentBid + 1;
        }
        return SKULL_MOVE_PASS;
      }

      if (s.phase === 'reveal') {
        if (lv === 0) return legal[rngInt(rng, legal.length)];
        // 他人の山から選ぶとき: このラウンドのセリで宣言した（＝自分の場にドクロが無い可能性が高い）相手を優先
        const bidders = new Set(s.bidHistory.filter((h) => h.bid > 0).map((h) => h.seat));
        const safeTargets = legal.filter((m) => bidders.has(m - SKULL_MOVE_REVEAL_BASE));
        if (lv >= 2 && safeTargets.length > 0) {
          return safeTargets[rngInt(rng, safeTargets.length)];
        }
        return legal[rngInt(rng, legal.length)];
      }

      return legal[0];
    },
  },
};
