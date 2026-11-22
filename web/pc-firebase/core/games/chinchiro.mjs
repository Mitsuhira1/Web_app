import { rngFloat, withView } from './_utils.mjs';

/**
 * チンチロリン (Chinchiro) — 2〜6人用ダイス+チップゲーム
 * 親と子がサイコロ3個を振って役の強さを競い、賭けチップを精算する。
 * 親はラウンドごとに交代し、全員が1回ずつ親を務めたら(人数ラウンドで)終了。
 * 最もチップが多い人の勝ち(同点首位は引き分け)。チップがマイナスになっても
 * 脱落はさせず、最終順位だけで判定する。
 *
 * 進行:
 * - 全員チップを同額(初期100)持つ。子の賭けは親との一対一精算。
 * - 親が先に振り、次に子が親の次の席から順に1人ずつ振る。
 * - 振る手は「サイコロ3個を振る」1つだけ。役が出れば確定、出なければ(目なし)
 *   最大3回まで振り直し(3回目は目なしでも確定)。全員確定したら精算。
 *
 * 役(強い順): ピンゾロ(1,1,1) > アラシ(2〜6のゾロ目) > シゴロ(4,5,6) >
 *   通常の目(ペア+残り1つ、その数字が目。6が最強・1が最弱) > 目なし > ヒフミ(1,2,3)
 * 倍率: ピンゾロ5倍 / アラシ3倍 / シゴロ2倍 / 通常の目・目なし1倍。
 *   ヒフミは「負けた時に2倍払い」の役で、mult は 2。
 * 精算: 子ごとに親と比較し、勝った側の役の倍率で bet × mult を敗者→勝者へ。
 *   ただし負けた側がヒフミの場合は、勝った側の倍率より小さくならないよう
 *   ヒフミの倍率(2)を下限にする(ヒフミで負けたら2倍払い)。
 *
 * オプション / ローカルルール:
 * - players: 2〜6人 (既定 4)
 * - bet: '10' (標準) / '20' — 1回の賭け金
 * - drawRule: 'banker' (引き分けは親の勝ちとして精算・標準) / 'push' (精算なし)
 * - bankerInstant: 'off' (標準) / 'on' — 親がピンゾロ・アラシ・シゴロ・6の目を
 *   出したら子が振る前に親の即勝ち、親がヒフミ・目なし・1の目を出したら即負け
 *   として、そのラウンドを即精算して終了する
 * - shonben: 'off' (標準) / 'on' — 各回の振りで5%の確率でションベン(サイコロが
 *   どんぶりから飛び出す)となり、その振り手は即負け確定で確定する
 */

export const CHINCHIRO_MOVE_ROLL = 0;
export const CHINCHIRO_START_CHIPS = 100;

export function evaluateChinchiro(dice) {
  const d = [...dice].sort((a, b) => a - b);
  if (d[0] === 1 && d[1] === 1 && d[2] === 1) {
    return { kind: 'pinzoro', rank: 600, point: 1, mult: 5, label: 'ピンゾロ' };
  }
  if (d[0] === d[1] && d[1] === d[2]) {
    return { kind: 'arashi', rank: 500 + d[0], point: d[0], mult: 3, label: 'アラシ' };
  }
  if (d[0] === 4 && d[1] === 5 && d[2] === 6) {
    return { kind: 'shigoro', rank: 400, point: 0, mult: 2, label: 'シゴロ' };
  }
  if (d[0] === 1 && d[1] === 2 && d[2] === 3) {
    return { kind: 'hifumi', rank: -100, point: 0, mult: 2, label: 'ヒフミ' };
  }
  if (d[0] === d[1] || d[1] === d[2] || d[0] === d[2]) {
    const point = d[0] === d[1] ? d[2] : d[0] === d[2] ? d[1] : d[0];
    return { kind: 'normal', rank: 100 + point, point, mult: 1, label: `${point}の目` };
  }
  return { kind: 'menashi', rank: 0, point: 0, mult: 1, label: '目なし' };
}

// 子1人分の精算を計算する純粋関数。
// 戻り値: { result: 'child_win'|'banker_win'|'push', amount } (amount は敗者→勝者への枚数)
export function settleChinchiro(bankerEval, childEval, bet, drawRule) {
  if (!bankerEval || !childEval) return { result: 'push', amount: 0 };
  if (childEval.rank === bankerEval.rank) {
    if (drawRule !== 'banker') return { result: 'push', amount: 0 };
    // 引き分けは親の勝ち: 子が敗者。子がヒフミなら2倍の下限を適用する。
    const mult = childEval.kind === 'hifumi' ? Math.max(bankerEval.mult, childEval.mult) : bankerEval.mult;
    return { result: 'banker_win', amount: bet * mult };
  }
  if (childEval.rank > bankerEval.rank) {
    const mult = bankerEval.kind === 'hifumi' ? Math.max(childEval.mult, bankerEval.mult) : childEval.mult;
    return { result: 'child_win', amount: bet * mult };
  }
  const mult = childEval.kind === 'hifumi' ? Math.max(bankerEval.mult, childEval.mult) : bankerEval.mult;
  return { result: 'banker_win', amount: bet * mult };
}

function nextRng(state) {
  let x = (state | 0) || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = x >>> 0;
  return { state: u || 1, value: u / 4294967296 };
}

function rollDice(rngState) {
  let rs = rngState;
  const dice = [];
  for (let i = 0; i < 3; i++) {
    const r = nextRng(rs);
    rs = r.state;
    dice.push(1 + Math.floor(r.value * 6));
  }
  dice.sort((a, b) => a - b);
  return { dice, rngState: rs };
}

function isBankerInstantWin(ev) {
  return ev.kind === 'pinzoro' || ev.kind === 'arashi' || ev.kind === 'shigoro'
    || (ev.kind === 'normal' && ev.point === 6);
}

function isBankerInstantLose(ev) {
  return ev.kind === 'hifumi' || ev.kind === 'menashi' || ev.kind === 'shonben'
    || (ev.kind === 'normal' && ev.point === 1);
}

export const CHINCHIRO_SPEC = {
  id: 'chinchiro',
  no: 52,
  name: 'チンチロリン',
  category: 'BOARD',
  players: '2〜6人',
  intro: 'サイコロ3個の役で親と勝負！ピンゾロは5倍、ヒフミは2倍払い。チップを増やそう！',
  seatNames: ['1番', '2番', '3番', '4番', '5番', '6番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 4),
  options: [
    { key: 'players', label: '人数', default: '4', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人'], ['5', '5人'], ['6', '6人']] },
    { key: 'bet', label: '賭け金', default: '10', group: 'rule', values: [['10', '10枚'], ['20', '20枚']] },
    { key: 'drawRule', label: '引き分け', default: 'banker', group: 'local', values: [['banker', '親の勝ち'], ['push', '精算なし']] },
    { key: 'bankerInstant', label: '親の即勝ち・即負け', default: 'off', group: 'local', hint: '親が強い役を出したら子が振る前に即勝ち、弱い役なら即負けになるルール', values: [['off', 'なし'], ['on', 'あり']] },
    { key: 'shonben', label: 'ションベン', default: 'off', group: 'local', hint: '振るたび5%の確率でサイコロが飛び出し、その振り手は即負け確定になるルール', values: [['off', 'なし'], ['on', 'あり(5%)']] },
  ],
  sections: [
    ['概要と目的', '全員がチップ100枚を持ち、親と子がサイコロ3個の役で勝負します。親はラウンドごとに交代し、全員が1回ずつ親を務めたら終了で、チップが最も多い人の勝ちです。チップがマイナスになっても脱落はありません。'],
    ['役と精算', '強い順に、ピンゾロ(1,1,1・5倍)、アラシ(ゾロ目・3倍)、シゴロ(4,5,6・2倍)、通常の目(ペア+残り1つの数字)、目なし、ヒフミ(1,2,3)です。子は親と一対一で比べ、勝った側の役の倍率で賭け金を精算します。ヒフミで負けた側は2倍払いです。'],
    ['ローカルルール', '・賭け金(10枚 / 20枚)\n・引き分け(親の勝ち / 精算なし)\n・親の即勝ち・即負け(親がピンゾロ・アラシ・シゴロ・6の目で即勝ち、ヒフミ・目なし・1の目で即負け)\n・ションベン(5%で即負け確定)'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 4);
    const bet = parseInt(opts.jt('bet', '10'), 10) || 10;
    const drawRule = opts.jt('drawRule', 'banker');
    const bankerInstant = opts.jt('bankerInstant', 'off') === 'on';
    const shonben = opts.jt('shonben', 'off') === 'on';

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'chinchiro',
        me,
        n: st.n,
        roundNo: st.roundNo,
        totalRounds: st.n,
        banker: st.banker,
        chips: st.chips.slice(),
        turn: st.turn,
        attempts: st.attempts,
        maxAttempts: 3,
        dice: st.dice.slice(),
        results: st.results.map((x) => (x ? { dice: x.dice.slice(), ...x.eval } : null)),
        bet: st.bet,
        lastAction: st.lastAction,
        lastRound: st.lastRound,
        winner: st.winner,
        reason: st.reason,
      }));
    }

    // ラウンド精算: chips を更新し、lastRound を作って次のラウンド(または終了)へ進めた状態を返す
    function finishRound(base, chips, results, instant) {
      const banker = base.banker;
      const bankerEval = results[banker] ? results[banker].eval : null;
      const entries = [];
      const nextChips = chips.slice();
      for (let i = 1; i < n; i++) {
        const child = (banker + i) % n;
        let entry;
        if (instant) {
          const amount = bet * (bankerEval ? bankerEval.mult : 1);
          if (instant === 'win') {
            nextChips[child] -= amount;
            nextChips[banker] += amount;
            entry = { child, from: child, to: banker, amount, result: 'banker_win' };
          } else {
            nextChips[banker] -= amount;
            nextChips[child] += amount;
            entry = { child, from: banker, to: child, amount, result: 'child_win' };
          }
        } else {
          const childEval = results[child] ? results[child].eval : null;
          const stl = settleChinchiro(bankerEval, childEval, bet, drawRule);
          if (stl.result === 'child_win') {
            nextChips[banker] -= stl.amount;
            nextChips[child] += stl.amount;
            entry = { child, from: banker, to: child, amount: stl.amount, result: stl.result };
          } else if (stl.result === 'banker_win') {
            nextChips[child] -= stl.amount;
            nextChips[banker] += stl.amount;
            entry = { child, from: child, to: banker, amount: stl.amount, result: stl.result };
          } else {
            entry = { child, from: -1, to: -1, amount: 0, result: 'push' };
          }
        }
        entries.push(entry);
      }
      const lastRound = {
        roundNo: base.roundNo,
        banker,
        instant: instant || null,
        results: results.map((x) => (x ? { dice: x.dice.slice(), ...x.eval } : null)),
        entries,
        chipsAfter: nextChips.slice(),
      };
      if (base.roundNo >= n) {
        const maxChip = Math.max(...nextChips);
        const winners = nextChips.map((c, i) => (c === maxChip ? i : -1)).filter((i) => i >= 0);
        const winner = winners.length === 1 ? winners[0] : -1;
        const reason = winner >= 0
          ? `全${n}ラウンド終了 (${winner + 1}番がチップ${maxChip}枚で勝利)`
          : `全${n}ラウンド終了 (チップ${maxChip}枚で引き分け)`;
        return attachView({
          ...base, chips: nextChips, results, turn: -1, attempts: 0, lastRound, winner, reason,
        });
      }
      const nextBanker = (banker + 1) % n;
      return attachView({
        ...base,
        chips: nextChips,
        results: Array.from({ length: n }, () => null),
        roundNo: base.roundNo + 1,
        banker: nextBanker,
        turn: nextBanker,
        attempts: 0,
        dice: [],
        lastRound,
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        return attachView({
          n,
          bet,
          chips: Array.from({ length: n }, () => CHINCHIRO_START_CHIPS),
          roundNo: 1,
          banker: 0,
          turn: 0,
          attempts: 0,
          dice: [],
          results: Array.from({ length: n }, () => null),
          rngState: initSeed,
          lastAction: null,
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
        return new Int32Array([CHINCHIRO_MOVE_ROLL]);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const seat = s.turn;
        let rs = s.rngState;
        const rolled = rollDice(rs);
        rs = rolled.rngState;
        const dice = rolled.dice;

        let ev = null;
        let isShonben = false;
        if (shonben) {
          const r = nextRng(rs);
          rs = r.state;
          if (r.value < 0.05) isShonben = true;
        }
        if (isShonben) {
          ev = { kind: 'shonben', rank: -200, point: 0, mult: 1, label: 'ションベン' };
        } else {
          ev = evaluateChinchiro(dice);
        }

        const attempts = s.attempts + 1;
        const settled = isShonben || ev.kind !== 'menashi' || attempts >= 3;
        const lastAction = {
          seat, type: 'roll', dice: dice.slice(), attempts, settled, shonben: isShonben,
          eval: settled ? { ...ev } : null,
        };

        if (!settled) {
          // 目なしで振り直し: 同じ振り手のまま
          return attachView({ ...s, dice, attempts, rngState: rs, lastAction });
        }

        const results = s.results.slice();
        results[seat] = { dice: dice.slice(), eval: { ...ev } };
        const base = { ...s, dice, rngState: rs, lastAction };

        // 親の即勝ち・即負け (親が確定した時点で判定)
        if (seat === s.banker && bankerInstant) {
          if (isBankerInstantWin(ev)) return finishRound(base, s.chips, results, 'win');
          if (isBankerInstantLose(ev)) return finishRound(base, s.chips, results, 'lose');
        }
        // ションベンした子は即負け確定だが、精算は全員確定後(親の役との比較で
        // rank -200 が最弱のため、通常精算で必ず負ける)。親のションベンも同様。

        // 振る順: 親 → 親の次の席から順に
        const order = Array.from({ length: n }, (_, i) => (s.banker + i) % n);
        const idx = order.indexOf(seat);
        if (idx < n - 1) {
          return attachView({
            ...base, results, turn: order[idx + 1], attempts: 0,
          });
        }
        return finishRound(base, s.chips, results, null);
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.chips);
      },
    };
  },
  brain: {
    // 合法手は「振る」だけなので、レベルによらず常にそれを返す
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      return legal.length ? legal[0] : -1;
    },
  },
};
