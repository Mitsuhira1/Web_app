import { brainLevel, pickRandom, rngInt, withView } from './_utils.mjs';

/**
 * ルーレット (Casino Roulette: European 0 / American 0・00) — 1〜6人用ボードゲーム
 * カジノで一般的なテーブルゲーム形式のルーレット（ロジック・CPU・状態管理のみ）。
 *
 * 整数ムーブ体系:
 * - 0..999     : チップ配置 = chipIdx * 200 + spotIdx (chipIdx: 0..4 -> [1,5,25,100,500], spotIdx: 0..151)
 * - 1000..1151 : ベット個別撤去 = 1000 + spotIdx
 * - 2000       : 手番内の直前操作を1手戻す (Undo)
 * - 2001       : 手番内のベットを全消去 (Clear)
 * - 2002       : 前ラウンドと同額・同配置を再ベット (Rebet)
 * - 2003       : 現在のベットを2倍にする (Double / 2x)
 * - 2004       : ベット確定（全員完了でホイール回転＆精算）
 * - 2005       : リバイ / チップ補充 (rounds=0 エンドレスモードで残高0時のみ)
 */

export const ROULETTE_CHIPS = [1, 5, 25, 100, 500];

export const EURO_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const AMER_WHEEL = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 14, 2, 35,
];

export const RED_NUMS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function pocketColor(pocket) {
  const s = String(pocket);
  if (s === '0' || s === '00') return 'green';
  return RED_NUMS.has(Number(s)) ? 'red' : 'black';
}

function buildSpots() {
  const spots = [];

  function add(spot) {
    const idx = spots.length;
    const nums = spot.nums.map(String);
    spots.push({
      idx,
      id: spot.id,
      kind: spot.kind,
      label: spot.label,
      mult: spot.mult,
      nums,
      numSet: new Set(nums),
      amerOnly: !!spot.amerOnly,
      evenMoney: !!spot.evenMoney,
    });
  }

  // 0..37: Straight Up (36x total return = 35:1 + stake)
  add({ id: 's:0', kind: 'straight', label: '0', mult: 36, nums: ['0'] });
  for (let n = 1; n <= 36; n++) {
    add({ id: `s:${n}`, kind: 'straight', label: String(n), mult: 36, nums: [n] });
  }
  add({ id: 's:00', kind: 'straight', label: '00', mult: 36, nums: ['00'], amerOnly: true });

  // 38..70: Horizontal Splits (18x total return = 17:1 + stake)
  for (let n = 1; n <= 33; n++) {
    add({
      id: `sp:${n}-${n + 3}`,
      kind: 'split',
      label: `スプリット ${n}/${n + 3}`,
      mult: 18,
      nums: [n, n + 3],
    });
  }

  // 71..94: Vertical Splits (18x)
  for (let c = 0; c < 12; c++) {
    for (let r = 1; r <= 2; r++) {
      const n = c * 3 + r;
      add({
        id: `sp:${n}-${n + 1}`,
        kind: 'split',
        label: `スプリット ${n}/${n + 1}`,
        mult: 18,
        nums: [n, n + 1],
      });
    }
  }

  // 95..106: Streets (12x total return = 11:1 + stake)
  for (let c = 0; c < 12; c++) {
    const n = c * 3 + 1;
    add({
      id: `st:${n}`,
      kind: 'street',
      label: `ストリート ${n}-${n + 2}`,
      mult: 12,
      nums: [n, n + 1, n + 2],
    });
  }

  // 107..128: Corners (9x total return = 8:1 + stake)
  for (let c = 0; c < 11; c++) {
    for (let r = 1; r <= 2; r++) {
      const n = c * 3 + r;
      add({
        id: `cn:${n}-${n + 1}-${n + 3}-${n + 4}`,
        kind: 'corner',
        label: `コーナー ${n}/${n + 1}/${n + 3}/${n + 4}`,
        mult: 9,
        nums: [n, n + 1, n + 3, n + 4],
      });
    }
  }

  // 129..139: Six Lines (6x total return = 5:1 + stake)
  for (let c = 0; c < 11; c++) {
    const n = c * 3 + 1;
    add({
      id: `ln:${n}`,
      kind: 'line',
      label: `ライン ${n}-${n + 5}`,
      mult: 6,
      nums: [n, n + 1, n + 2, n + 3, n + 4, n + 5],
    });
  }

  // 140..142: Columns (3x total return = 2:1 + stake)
  for (let col = 1; col <= 3; col++) {
    const nums = [];
    for (let c = 0; c < 12; c++) nums.push(c * 3 + col);
    add({
      id: `col:${col}`,
      kind: 'column',
      label: `${col}列目 (2:1)`,
      mult: 3,
      nums,
    });
  }

  // 143..145: Dozens (3x total return = 2:1 + stake)
  for (let d = 1; d <= 3; d++) {
    const start = (d - 1) * 12 + 1;
    const nums = [];
    for (let n = start; n < start + 12; n++) nums.push(n);
    add({
      id: `doz:${d}`,
      kind: 'dozen',
      label: `${start}〜${start + 11}`,
      mult: 3,
      nums,
    });
  }

  // 146..151: Even-Money Outside Bets (2x total return = 1:1 + stake)
  const all1to36 = Array.from({ length: 36 }, (_, i) => i + 1);
  add({ id: 'out:low', kind: 'outside', label: '1〜18', mult: 2, nums: all1to36.filter((n) => n <= 18), evenMoney: true });
  add({ id: 'out:even', kind: 'outside', label: 'EVEN(偶数)', mult: 2, nums: all1to36.filter((n) => n % 2 === 0), evenMoney: true });
  add({ id: 'out:red', kind: 'outside', label: '赤(RED)', mult: 2, nums: all1to36.filter((n) => RED_NUMS.has(n)), evenMoney: true });
  add({ id: 'out:black', kind: 'outside', label: '黒(BLACK)', mult: 2, nums: all1to36.filter((n) => !RED_NUMS.has(n)), evenMoney: true });
  add({ id: 'out:odd', kind: 'outside', label: 'ODD(奇数)', mult: 2, nums: all1to36.filter((n) => n % 2 === 1), evenMoney: true });
  add({ id: 'out:high', kind: 'outside', label: '19〜36', mult: 2, nums: all1to36.filter((n) => n >= 19), evenMoney: true });

  return spots;
}

export const ROULETTE_SPOTS = buildSpots();

const SPOT_BY_ID = new Map(ROULETTE_SPOTS.map((s) => [s.id, s]));

export const MOVE_UNDO = 2000;
export const MOVE_CLEAR = 2001;
export const MOVE_REBET = 2002;
export const MOVE_DOUBLE = 2003;
export const MOVE_CONFIRM = 2004;
export const MOVE_REBUY = 2005;

const MAX_HISTORY = 20;

function nextRng(state) {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return {
    state: t,
    value: ((r ^ (r >>> 14)) >>> 0) / 4294967296,
  };
}

function sumBets(betMap) {
  let total = 0;
  for (const k of Object.keys(betMap)) total += betMap[k] | 0;
  return total;
}

function cloneBetMap(betMap) {
  const out = {};
  for (const k of Object.keys(betMap)) {
    const v = betMap[k] | 0;
    if (v > 0) out[k] = v;
  }
  return out;
}

function makeRouletteRules(opts) {
  const n = Math.max(1, Math.min(6, opts.it('players', 2)));
  const wheelType = opts.jt('wheel', 'euro') === 'amer' ? 'amer' : 'euro';
  const startChips = Math.max(100, opts.it('startChips', 1000));
  const maxRounds = Math.max(0, opts.it('rounds', 10));
  const laPartage = opts.jt('laPartage', 'off') === 'half' ? 'half' : 'off';

  const wheelOrder = wheelType === 'amer' ? AMER_WHEEL : EURO_WHEEL;

  function isSpotAllowed(spot) {
    return !(spot.amerOnly && wheelType !== 'amer');
  }

  function findNextActiveSeat(chips, confirmed, startIdx) {
    for (let i = startIdx; i < n; i++) {
      if (confirmed[i]) continue;
      if (maxRounds > 0 && chips[i] <= 0) continue;
      return i;
    }
    return -1;
  }

  function computeCanRebet(s, seat) {
    if (seat < 0 || seat >= n) return false;
    const curTotal = sumBets(s.bets[seat]);
    const prevTotal = sumBets(s.prevBets[seat]);
    return curTotal === 0 && prevTotal > 0 && prevTotal <= s.chips[seat];
  }

  function computeCanDouble(s, seat) {
    if (seat < 0 || seat >= n) return false;
    const curTotal = sumBets(s.bets[seat]);
    return curTotal > 0 && curTotal <= s.chips[seat];
  }

  function computeCanRebuy(s, seat) {
    if (seat < 0 || seat >= n) return false;
    return maxRounds === 0 && s.chips[seat] === 0 && sumBets(s.bets[seat]) === 0 && !s.confirmed[seat];
  }

  function settleRound(s) {
    const { state: nextRngState, value } = nextRng(s.rngState);
    const pocketIdx = Math.min(wheelOrder.length - 1, Math.floor(value * wheelOrder.length));
    const pocket = wheelOrder[pocketIdx];
    const pocketStr = String(pocket);
    const color = pocketColor(pocket);
    const isZero = pocketStr === '0' || pocketStr === '00';

    const nextChips = s.chips.slice();
    const wagered = new Array(n).fill(0);
    const payouts = new Array(n).fill(0);
    const nets = new Array(n).fill(0);
    const laPartageReturns = new Array(n).fill(0);
    const roundBets = s.bets.map((b) => cloneBetMap(b));
    const nextPrevBets = s.prevBets.map((b) => cloneBetMap(b));

    for (let i = 0; i < n; i++) {
      const bm = s.bets[i];
      const w = sumBets(bm);
      wagered[i] = w;
      if (w > 0) {
        nextPrevBets[i] = cloneBetMap(bm);
      }

      let payout = 0;
      let partage = 0;
      for (const spotId of Object.keys(bm)) {
        const amt = bm[spotId] | 0;
        if (amt <= 0) continue;
        const spot = SPOT_BY_ID.get(spotId);
        if (!spot) continue;
        if (spot.numSet.has(pocketStr)) {
          payout += amt * spot.mult;
        } else if (isZero && laPartage === 'half' && spot.evenMoney) {
          const ret = Math.floor(amt / 2);
          payout += ret;
          partage += ret;
        }
      }

      payouts[i] = payout;
      laPartageReturns[i] = partage;
      nextChips[i] += payout;
      nets[i] = payout - w;
    }

    const lastRound = {
      roundNo: s.roundNo,
      pocket,
      pocketStr,
      pocketIdx,
      color,
      bets: roundBets,
      wagered,
      payouts,
      nets,
      laPartageReturns,
      bankrollsAfter: nextChips.slice(),
    };

    const nextHistory = s.history.concat([{
      roundNo: s.roundNo,
      pocket,
      pocketStr,
      color,
    }]);
    if (nextHistory.length > MAX_HISTORY) {
      nextHistory.splice(0, nextHistory.length - MAX_HISTORY);
    }

    const allBroke = nextChips.every((c) => c <= 0);
    // 2 人以上で、チップが残っているのが 1 人だけになったら、その場で決着(2 人なら、0 枚になった方の負け)
    const lastStanding = n >= 2 && nextChips.filter((c) => c > 0).length === 1;
    const finished = maxRounds > 0 && (s.roundNo >= maxRounds || allBroke || lastStanding);

    if (finished) {
      let winner = -1;
      let reason = '';
      if (n === 1) {
        const finalC = nextChips[0];
        const diff = finalC - startChips;
        if (finalC <= 0) {
          winner = -1;
          reason = `全${s.roundNo}ラウンド終了 (チップ0枚)`;
        } else if (diff > 0) {
          winner = 0;
          reason = `全${s.roundNo}ラウンド終了 (${finalC}枚 / +${diff}枚で勝ち越し！)`;
        } else if (diff === 0) {
          winner = -1;
          reason = `全${s.roundNo}ラウンド終了 (${finalC}枚 / 引き分け)`;
        } else {
          winner = -1;
          reason = `全${s.roundNo}ラウンド終了 (${finalC}枚 / ${diff}枚)`;
        }
      } else {
        const maxC = Math.max(...nextChips);
        const leaders = nextChips.map((c, idx) => (c === maxC ? idx : -1)).filter((idx) => idx >= 0);
        if (allBroke) {
          winner = -1;
          reason = `全${s.roundNo}ラウンド終了 (全員チップ0枚で引き分け)`;
        } else if (lastStanding && s.roundNo < maxRounds) {
          winner = leaders[0];
          reason = `第${s.roundNo}ラウンドで決着 (${winner + 1}番以外のチップが0枚)`;
        } else if (leaders.length === 1) {
          winner = leaders[0];
          reason = `全${s.roundNo}ラウンド終了 (${winner + 1}番が${maxC}枚で優勝！)`;
        } else {
          winner = -1;
          reason = `全${s.roundNo}ラウンド終了 (${maxC}枚で引き分け)`;
        }
      }

      return attach({
        ...s,
        rngState: nextRngState,
        chips: nextChips,
        bets: Array.from({ length: n }, () => ({})),
        prevBets: nextPrevBets,
        confirmed: new Array(n).fill(true),
        turnHistory: [],
        turnSteps: 0,
        turn: -1,
        phase: 'done',
        lastRound,
        history: nextHistory,
        winner,
        reason,
      });
    }

    const emptyBets = Array.from({ length: n }, () => ({}));
    const nextConfirmed = nextChips.map((c) => (maxRounds > 0 && c <= 0));
    const nextTurn = findNextActiveSeat(nextChips, nextConfirmed, 0);

    return attach({
      ...s,
      rngState: nextRngState,
      roundNo: s.roundNo + 1,
      chips: nextChips,
      bets: emptyBets,
      prevBets: nextPrevBets,
      confirmed: nextConfirmed,
      turnHistory: [],
      turnSteps: 0,
      turn: nextTurn,
      phase: 'bet',
      lastRound,
      history: nextHistory,
    });
  }

  function attach(state) {
    return withView(state, (_r, me, st) => {
      const tableTotals = st.bets.map(sumBets);
      const bankrolls = st.chips.map((c, i) => c + tableTotals[i]);
      const activeSeat = st.turn;
      const curActiveTotal = activeSeat >= 0 ? tableTotals[activeSeat] : 0;

      return JSON.stringify({
        kind: 'roulette',
        me,
        n,
        wheelType,
        wheelOrder,
        laPartage,
        startChips,
        maxRounds,
        roundNo: st.roundNo,
        turn: st.turn,
        phase: st.phase,
        chips: st.chips,
        tableTotals,
        bankrolls,
        confirmed: st.confirmed,
        bets: st.bets,
        canUndo: !st.reason && st.turnHistory.length > 0,
        canClear: !st.reason && curActiveTotal > 0,
        canRebet: !st.reason && computeCanRebet(st, activeSeat),
        canDouble: !st.reason && computeCanDouble(st, activeSeat),
        canRebuy: !st.reason && computeCanRebuy(st, activeSeat),
        rebuyCounts: st.rebuyCounts,
        spotChips: ROULETTE_CHIPS,
        spotCount: ROULETTE_SPOTS.length,
        lastRound: st.lastRound,
        history: st.history,
      });
    });
  }

  return {
    playerCount: n,
    wheelType,
    wheelOrder,
    startChips,
    maxRounds,
    laPartage,
    isSpotAllowed,
    initial(rng) {
      let rngState = ((rngInt(rng, 0x10000) << 16) ^ rngInt(rng, 0x10000)) >>> 0;
      if (rngState === 0) rngState = 0x9e3779b9;
      return attach({
        rngState,
        roundNo: 1,
        chips: new Array(n).fill(startChips),
        bets: Array.from({ length: n }, () => ({})),
        prevBets: Array.from({ length: n }, () => ({})),
        confirmed: new Array(n).fill(false),
        rebuyCounts: new Array(n).fill(0),
        turnHistory: [],
        turnSteps: 0,
        turn: 0,
        phase: 'bet',
        lastRound: null,
        history: [],
        winner: null,
        reason: '',
      });
    },
    toMove(s) {
      return s.reason ? -1 : s.turn;
    },
    legalMoves(s) {
      if (s.reason || s.turn < 0) return [];
      const p = s.turn;
      const avail = s.chips[p];
      const curBetMap = s.bets[p];
      const curTotal = sumBets(curBetMap);
      const moves = [];

      // Place chip moves: 0..999
      for (let ci = 0; ci < ROULETTE_CHIPS.length; ci++) {
        const chipVal = ROULETTE_CHIPS[ci];
        if (chipVal > avail) break;
        const base = ci * 200;
        for (let si = 0; si < ROULETTE_SPOTS.length; si++) {
          if (isSpotAllowed(ROULETTE_SPOTS[si])) {
            moves.push(base + si);
          }
        }
      }

      // Remove bet moves: 1000..1151
      for (let si = 0; si < ROULETTE_SPOTS.length; si++) {
        const sp = ROULETTE_SPOTS[si];
        if ((curBetMap[sp.id] || 0) > 0) {
          moves.push(1000 + si);
        }
      }

      if (s.turnHistory.length > 0) moves.push(MOVE_UNDO);
      if (curTotal > 0) moves.push(MOVE_CLEAR);
      if (computeCanRebet(s, p)) moves.push(MOVE_REBET);
      if (computeCanDouble(s, p)) moves.push(MOVE_DOUBLE);
      moves.push(MOVE_CONFIRM);
      if (computeCanRebuy(s, p)) moves.push(MOVE_REBUY);

      return moves;
    },
    isLegal(s, m) {
      if (s.reason || s.turn < 0) return false;
      const p = s.turn;
      const avail = s.chips[p];
      const curBetMap = s.bets[p];
      const curTotal = sumBets(curBetMap);

      if (m >= 0 && m < 1000) {
        const ci = Math.floor(m / 200);
        const si = m % 200;
        if (ci < 0 || ci >= ROULETTE_CHIPS.length) return false;
        if (si < 0 || si >= ROULETTE_SPOTS.length) return false;
        const spot = ROULETTE_SPOTS[si];
        return isSpotAllowed(spot) && ROULETTE_CHIPS[ci] <= avail;
      }
      if (m >= 1000 && m < 1000 + ROULETTE_SPOTS.length) {
        const spot = ROULETTE_SPOTS[m - 1000];
        return (curBetMap[spot.id] || 0) > 0;
      }
      if (m === MOVE_UNDO) return s.turnHistory.length > 0;
      if (m === MOVE_CLEAR) return curTotal > 0;
      if (m === MOVE_REBET) return computeCanRebet(s, p);
      if (m === MOVE_DOUBLE) return computeCanDouble(s, p);
      if (m === MOVE_CONFIRM) return true;
      if (m === MOVE_REBUY) return computeCanRebuy(s, p);
      return false;
    },
    play(s, m) {
      if (!this.isLegal(s, m)) return s;
      const p = s.turn;
      const snap = { bet: cloneBetMap(s.bets[p]), chips: s.chips[p] };

      // Place chip
      if (m >= 0 && m < 1000) {
        const ci = Math.floor(m / 200);
        const si = m % 200;
        const amt = ROULETTE_CHIPS[ci];
        const spot = ROULETTE_SPOTS[si];
        const chips = s.chips.slice();
        chips[p] -= amt;
        const bets = s.bets.map((b, i) => (i === p ? cloneBetMap(b) : b));
        bets[p][spot.id] = (bets[p][spot.id] || 0) + amt;
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.concat([snap]),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Remove specific spot
      if (m >= 1000 && m < 1000 + ROULETTE_SPOTS.length) {
        const spot = ROULETTE_SPOTS[m - 1000];
        const chips = s.chips.slice();
        const bets = s.bets.map((b, i) => (i === p ? cloneBetMap(b) : b));
        chips[p] += bets[p][spot.id] || 0;
        delete bets[p][spot.id];
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.concat([snap]),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Undo within current turn
      if (m === MOVE_UNDO) {
        const prev = s.turnHistory[s.turnHistory.length - 1];
        const chips = s.chips.slice();
        chips[p] = prev.chips;
        const bets = s.bets.map((b, i) => (i === p ? cloneBetMap(prev.bet) : b));
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.slice(0, -1),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Clear all current bets
      if (m === MOVE_CLEAR) {
        const chips = s.chips.slice();
        chips[p] += sumBets(s.bets[p]);
        const bets = s.bets.map((b, i) => (i === p ? {} : b));
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.concat([snap]),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Rebet previous round
      if (m === MOVE_REBET) {
        const prevMap = cloneBetMap(s.prevBets[p]);
        const total = sumBets(prevMap);
        const chips = s.chips.slice();
        chips[p] -= total;
        const bets = s.bets.map((b, i) => (i === p ? prevMap : b));
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.concat([snap]),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Double current bets
      if (m === MOVE_DOUBLE) {
        const curTotal = sumBets(s.bets[p]);
        const chips = s.chips.slice();
        chips[p] -= curTotal;
        const bets = s.bets.map((b, i) => {
          if (i !== p) return b;
          const doubled = {};
          for (const k of Object.keys(b)) doubled[k] = (b[k] | 0) * 2;
          return doubled;
        });
        return attach({
          ...s,
          chips,
          bets,
          turnHistory: s.turnHistory.concat([snap]),
          turnSteps: s.turnSteps + 1,
        });
      }

      // Rebuy in endless mode
      if (m === MOVE_REBUY) {
        const chips = s.chips.slice();
        chips[p] = startChips;
        const rebuyCounts = s.rebuyCounts.slice();
        rebuyCounts[p] += 1;
        return attach({
          ...s,
          chips,
          rebuyCounts,
          turnSteps: s.turnSteps + 1,
        });
      }

      // Confirm (2004)
      const confirmed = s.confirmed.slice();
      confirmed[p] = true;
      const nextSeat = findNextActiveSeat(s.chips, confirmed, p + 1);
      if (nextSeat >= 0) {
        return attach({
          ...s,
          confirmed,
          turnHistory: [],
          turnSteps: 0,
          turn: nextSeat,
        });
      }

      return settleRound({
        ...s,
        confirmed,
      });
    },
    outcome(s) {
      return s.winner === null && !s.reason
        ? null
        : { winner: s.winner, reason: s.reason };
    },
    scores(s) {
      return s.chips.map((c, i) => c + sumBets(s.bets[i]));
    },
  };
}

function chooseRouletteMove(rules, s, seat, level, rng) {
  const lv = brainLevel(level);
  const avail = s.chips[seat];
  const curTotal = sumBets(s.bets[seat]);

  // Endless mode: rebuy if busted at start of turn
  if (avail === 0 && curTotal === 0 && rules.isLegal(s, MOVE_REBUY)) {
    return MOVE_REBUY;
  }

  // Always confirm if nothing left to bet or CPU reached its bet-count cap
  const maxSteps = lv === 0 ? 2 : lv === 1 ? 3 : 4;
  if (avail <= 0 || s.turnSteps >= maxSteps) {
    return MOVE_CONFIRM;
  }

  const totalBankroll = avail + curTotal;
  const maxLeader = Math.max(...s.chips.map((c, i) => c + sumBets(s.bets[i])));
  const behindRatio = maxLeader > totalBankroll ? (maxLeader - totalBankroll) / Math.max(1, totalBankroll) : 0;
  const isFinalPush = rules.maxRounds > 0 && s.roundNo >= rules.maxRounds - 1 && behindRatio > 0.25;

  // Target per-round risk budget
  let budgetRatio;
  if (lv === 0) budgetRatio = 0.22;
  else if (lv === 1) budgetRatio = 0.16;
  else budgetRatio = isFinalPush ? 0.45 : 0.14;

  const targetBudget = Math.max(1, Math.min(totalBankroll, Math.round(totalBankroll * budgetRatio)));
  if (curTotal > 0 && (curTotal >= targetBudget || rngInt(rng, 10) < (lv === 0 ? 4 : 3))) {
    return MOVE_CONFIRM;
  }

  // Occasionally rebet on normal/hard if affordable and within budget
  if (curTotal === 0 && rules.isLegal(s, MOVE_REBET)) {
    const prevSum = sumBets(s.prevBets[seat]);
    if (prevSum <= targetBudget * 1.4 && rngInt(rng, 10) < (lv === 2 ? 4 : 3)) {
      return MOVE_REBET;
    }
  }

  // Pick bet spot pool according to difficulty
  const outsideSpots = ROULETTE_SPOTS.filter((sp) => sp.idx >= 146 && rules.isSpotAllowed(sp));
  const dozenColSpots = ROULETTE_SPOTS.filter((sp) => sp.idx >= 140 && sp.idx <= 145 && rules.isSpotAllowed(sp));
  const cornerLineSpots = ROULETTE_SPOTS.filter((sp) => sp.idx >= 107 && sp.idx <= 139 && rules.isSpotAllowed(sp));
  const insideSpots = ROULETTE_SPOTS.filter((sp) => sp.idx <= 106 && rules.isSpotAllowed(sp));

  let candidateSpots;
  if (lv === 0) {
    const r = rngInt(rng, 10);
    candidateSpots = r < 4 ? outsideSpots : r < 7 ? dozenColSpots : insideSpots;
  } else if (lv === 1) {
    const r = rngInt(rng, 10);
    candidateSpots = r < 4 ? outsideSpots : r < 7 ? dozenColSpots : r < 9 ? cornerLineSpots : insideSpots;
  } else {
    // Hard: core outside/dozen bet first, optionally hedge with corner/split or chase on final rounds
    if (curTotal === 0) {
      candidateSpots = isFinalPush ? (rngInt(rng, 2) === 0 ? dozenColSpots : cornerLineSpots) : (rngInt(rng, 10) < 6 ? outsideSpots : dozenColSpots);
    } else {
      candidateSpots = rngInt(rng, 10) < 5 ? cornerLineSpots : insideSpots;
    }
  }

  const spot = pickRandom(candidateSpots, rng);

  // Pick largest chip that doesn't wildly overshoot remaining budget
  const remainingBudget = Math.max(1, Math.min(avail, targetBudget - curTotal));
  let chosenChipIdx = 0;
  for (let ci = ROULETTE_CHIPS.length - 1; ci >= 0; ci--) {
    if (ROULETTE_CHIPS[ci] <= avail && ROULETTE_CHIPS[ci] <= remainingBudget) {
      chosenChipIdx = ci;
      break;
    }
  }
  if (lv === 0 && chosenChipIdx > 1 && rngInt(rng, 2) === 0) {
    chosenChipIdx = Math.max(0, chosenChipIdx - 1);
  }

  const move = chosenChipIdx * 200 + spot.idx;
  return rules.isLegal(s, move) ? move : MOVE_CONFIRM;
}

export const ROULETTE_SPEC = {
  id: 'roulette',
  no: 43,
  name: 'ルーレット',
  category: 'BOARD',
  players: '1〜6人',
  intro: '回転するホイールと数字・色・列への多彩なベットで勝負するカジノ定番のテーブルゲーム。',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 2),
  makeRules: makeRouletteRules,
  chooseMove: chooseRouletteMove,
  options: [
    {
      key: 'players',
      label: '人数',
      default: '2',
      group: 'rule',
      values: [
        ['1', '1人(ソロ)'],
        ['2', '2人'],
        ['3', '3人'],
        ['4', '4人'],
        ['5', '5人'],
        ['6', '6人'],
      ],
    },
    {
      key: 'wheel',
      label: 'ホイール種類',
      default: 'euro',
      group: 'rule',
      hint: '0のみのヨーロピアン(37穴)か、0と00があるアメリカン(38穴)かを選びます',
      values: [
        ['euro', 'ヨーロピアン (0)'],
        ['amer', 'アメリカン (0・00)'],
      ],
    },
    {
      key: 'startChips',
      label: '初期チップ',
      default: '1000',
      group: 'rule',
      values: [
        ['500', '500枚'],
        ['1000', '1000枚'],
        ['2000', '2000枚'],
      ],
    },
    {
      key: 'rounds',
      label: 'ゲーム数',
      default: '10',
      group: 'rule',
      values: [
        ['5', '5ラウンド'],
        ['10', '10ラウンド'],
        ['15', '15ラウンド'],
        ['0', 'エンドレス(チップ補充あり)'],
      ],
    },
    {
      key: 'laPartage',
      label: '0が出た時のルール',
      default: 'off',
      group: 'local',
      hint: '0または00が出た時、赤黒/偶奇/高低の賭け額を半額返還するカジノルール',
      values: [
        ['off', '標準 (0/00で没収)'],
        ['half', 'ラ・パルタージュ (イーブン賭け半額返還)'],
      ],
    },
  ],
  sections: [
    [
      '概要と目的',
      '盤上の数字やグループにチップを賭け、ルーレットの玉が落ちる番号を予想するカジノの定番ゲームです。設定したラウンド数の終了時に最も多くのチップを持っているプレイヤーの勝利となります。',
    ],
    [
      '賭け方と倍率',
      '・ストレート(1点賭け): 36倍\n・スプリット(2点賭け): 18倍\n・ストリート(横3点): 12倍\n・コーナー(4点角): 9倍\n・シックスライン(6点): 6倍\n・コラム/ダズン(12点): 3倍\n・赤黒 / 偶奇 / 1〜18・19〜36(18点): 2倍\n※倍率は賭け金を含む払い戻し総額です。',
    ],
    [
      '操作方法',
      'チップ(1・5・25・100・500)と賭けたい枠を選んで配置します。「戻す」「クリア」「前回と同じ(Rebet)」「2倍(2x)」も手番内で利用できます。全員が「確定」を押すとホイールが回転し、結果に応じて払い戻しが行われます。',
    ],
    [
      'ローカルルール',
      '・ホイール: ヨーロピアン(0のみ・37ポケット) / アメリカン(0・00あり・38ポケット)\n・0が出た時のルール: ラ・パルタージュを有効にすると、0/00停止時に2倍配当枠への賭け金の半額が返還されます\n・エンドレス設定時はチップ0枚で「補充(リバイ)」が可能です',
    ],
  ],
};
