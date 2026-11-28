import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * インカの黄金 (Incan Gold / Diamant) — 3〜6人用チキンレース・ボードゲーム
 * 全5ラウンド制。毎ターン山札から1枚めくり、宝石は探検中の全員で均等割り（余りは道へ）、
 * 障害カードが同じ種類2枚出たらバーストで探検中の全員がそのラウンドの宝石を全喪失。
 * 次のカードをめくる前に、探検中の全員が同時に「進む」か「帰る」かを選択する。
 *
 * ローカルルール / オプション:
 * - players: 3〜6人 (既定 4)
 * - artifacts: 'on' (遺物カードあり・単独帰還時のみ獲得・標準) / 'off' (遺物なし)
 */

export const INCANGOLD_MOVE_RETURN = 0;
export const INCANGOLD_MOVE_CONTINUE = 1;
export const INCANGOLD_TOTAL_ROUNDS = 5;

export const INCANGOLD_HAZARD_TYPES = [
  { type: 'snake', label: '毒蛇' },
  { type: 'spider', label: '毒蜘蛛' },
  { type: 'mummy', label: 'ミイラ' },
  { type: 'fire', label: '炎' },
  { type: 'rock', label: '落石' },
];

const GEM_VALUES = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];

function buildBaseDeck(removedHazardCounts, includeArtifact, roundNo) {
  const deck = [];
  for (let i = 0; i < GEM_VALUES.length; i++) {
    deck.push({ kind: 'gem', value: GEM_VALUES[i], label: `宝石${GEM_VALUES[i]}` });
  }
  for (const hz of INCANGOLD_HAZARD_TYPES) {
    const removed = removedHazardCounts[hz.type] || 0;
    const copies = Math.max(0, 3 - removed);
    for (let c = 0; c < copies; c++) {
      deck.push({ kind: 'hazard', hazard: hz.type, label: hz.label });
    }
  }
  if (includeArtifact) {
    deck.push({ kind: 'artifact', artifactNo: roundNo, label: `遺物#${roundNo}` });
  }
  return deck;
}

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

function firstUndecidedInCave(inCave, choices, n) {
  for (let i = 0; i < n; i++) {
    if (inCave[i] && choices[i] === -1) return i;
  }
  return -1;
}

export const INCANGOLD_SPEC = {
  id: 'incangold',
  no: 47,
  name: 'インカの黄金',
  category: 'CARD',
  players: '3〜6人',
  intro: '遺跡の奥へ進むか、安全に宝石を持ち帰るか！同じ障害が2枚出たら全没収のチキンレース。',
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
      key: 'artifacts',
      label: '遺物(アーティファクト)',
      default: 'on',
      group: 'local',
      hint: '1人だけで帰還した時に持ち帰れる高得点カード（1〜3枚目5点、4〜5枚目10点）',
      values: [['on', 'あり(標準)'], ['off', 'なし']],
    },
  ],
  sections: [
    [
      '概要と目的',
      '全5ラウンドの遺跡探検を行い、最終的にテントへ持ち帰った宝石の合計が最も多いプレイヤーの勝ちです。合計が同点の場合は、獲得した遺物カードの枚数が多いプレイヤーの勝ちで、枚数も同じなら引き分けです（公式ルールどおり）。',
    ],
    [
      '進むか、帰るか',
      '毎ターン山札からカードが1枚めくられます。宝石カードが出たら探検中の全員で均等に分け、余りは道に残ります。次のカードをめくる前に、残っている全員が同時に「進む」か「帰る」を選びます。帰るを選んだ人は手持ちの宝石と、道に余っていた宝石（複数人で帰れば均等割り）を安全に持ち帰ります。',
    ],
    [
      '探検失敗と遺物',
      '同じ種類の障害カードが2枚出ると探検失敗となり、残っていた全員はそのラウンドの宝石をすべて失います（失敗の原因となった障害カード1枚は以降のラウンドから除外されます）。遺物オプションありの場合、1人だけで帰還すると道にある遺物を独占できます（1〜3枚目は5点、4〜5枚目は10点）。',
    ],
  ],
  makeRules(opts) {
    const n = Math.max(3, Math.min(6, opts.it('players', 4)));
    const useArtifacts = opts.jt('artifacts', 'on') !== 'off';

    function startRound(base, roundNo, lastStep, lastRound) {
      const baseDeck = buildBaseDeck(base.removedHazards, useArtifacts, roundNo);
      const sh = shuffleWithState(baseDeck, base.rngState);
      const deck = sh.arr;
      const inCave = new Array(n).fill(true);
      const roundGems = new Array(n).fill(0);
      let pathGems = 0;
      const pathCards = [];
      const pathArtifacts = [];
      const hazardCounts = {};

      // 1枚目を自動でめくる（1枚目はバーストし得ない）
      const firstCard = deck.pop();
      pathCards.push(firstCard);
      if (firstCard.kind === 'gem') {
        const each = Math.floor(firstCard.value / n);
        const rem = firstCard.value % n;
        for (let i = 0; i < n; i++) roundGems[i] += each;
        pathGems += rem;
      } else if (firstCard.kind === 'artifact') {
        pathArtifacts.push(firstCard);
      } else if (firstCard.kind === 'hazard') {
        hazardCounts[firstCard.hazard] = 1;
      }

      const choices = new Array(n).fill(-1);
      return attachView({
        ...base,
        roundNo,
        rngState: sh.rngState,
        deck,
        inCave,
        roundGems,
        pathGems,
        pathCards,
        pathArtifacts,
        hazardCounts,
        choices,
        turn: 0,
        lastStep,
        lastRound,
      });
    }

    function finishGame(base, lastStep, lastRound) {
      const maxScore = Math.max(...base.tentGems);
      let winners = base.tentGems
        .map((sc, i) => (sc === maxScore ? i : -1))
        .filter((i) => i >= 0);
      // 公式ルール: 同点の場合は遺物カードの枚数が多い方が勝ち。枚数も同じなら引き分け
      if (winners.length > 1) {
        const counts = base.artifactsBySeat || [];
        const maxArt = Math.max(...winners.map((i) => counts[i] || 0));
        winners = winners.filter((i) => (counts[i] || 0) === maxArt);
      }
      const winner = winners.length === 1 ? winners[0] : -1;
      const reason = `全${INCANGOLD_TOTAL_ROUNDS}ラウンド終了`;
      return attachView({
        ...base,
        inCave: new Array(n).fill(false),
        roundGems: new Array(n).fill(0),
        choices: new Array(n).fill(-1),
        turn: -1,
        lastStep,
        lastRound,
        winner,
        reason,
      });
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const done = !!st.reason;
        const isPlayer = me >= 0 && me < st.n;

        return JSON.stringify({
          kind: 'incangold',
          me,
          n: st.n,
          roundNo: st.roundNo,
          totalRounds: INCANGOLD_TOTAL_ROUNDS,
          turn: st.turn,
          useArtifacts: st.useArtifacts,
          tentGems: st.tentGems,
          roundGems: st.roundGems,
          inCave: st.inCave,
          pathGems: st.pathGems,
          pathCards: st.pathCards,
          pathArtifactsCount: st.pathArtifacts.length,
          hazardCounts: st.hazardCounts,
          removedHazards: st.removedHazards,
          artifactsClaimedTotal: st.artifactsClaimedTotal,
          artifactsBySeat: st.artifactsBySeat ? st.artifactsBySeat.slice() : new Array(st.n).fill(0),
          nextArtifactValue: st.artifactsClaimedTotal < 3 ? 5 : 10,
          decided: st.choices.map((c, i) => !st.inCave[i] || c !== -1),
          myChoice: isPlayer ? st.choices[me] : -1,
          deckCount: st.deck.length,
          lastStep: st.lastStep,
          lastRound: st.lastRound,
          done,
        });
      });
    }

    return {
      playerCount: n,
      initial(rng) {
        const initSeed = Math.max(1, Math.floor(rngFloat(rng) * 0x7fffffff) | 0);
        const base = {
          n,
          useArtifacts,
          rngState: initSeed,
          tentGems: new Array(n).fill(0),
          removedHazards: {},
          artifactsClaimedTotal: 0,
          artifactsBySeat: new Array(n).fill(0),
          winner: -1,
          reason: '',
        };
        return startRound(base, 1, null, null);
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        return new Int32Array([INCANGOLD_MOVE_RETURN, INCANGOLD_MOVE_CONTINUE]);
      },
      isLegal(s, m) {
        if (s.reason) return false;
        return m === INCANGOLD_MOVE_RETURN || m === INCANGOLD_MOVE_CONTINUE;
      },
      play(s, m) {
        if (!this.isLegal(s, m)) return s;
        const p = s.turn;
        const choices = s.choices.slice();
        choices[p] = m;

        const nextP = firstUndecidedInCave(s.inCave, choices, n);
        if (nextP >= 0) {
          return attachView({ ...s, choices, turn: nextP });
        }

        // 探検中の全員が選択完了 → 一斉公開＆解決
        const returners = [];
        const stayers = [];
        for (let i = 0; i < n; i++) {
          if (!s.inCave[i]) continue;
          if (choices[i] === INCANGOLD_MOVE_RETURN) returners.push(i);
          else stayers.push(i);
        }

        const tentGems = s.tentGems.slice();
        const artifactsBySeat = s.artifactsBySeat ? s.artifactsBySeat.slice() : new Array(n).fill(0);
        const roundGems = s.roundGems.slice();
        const inCave = s.inCave.slice();
        let pathGems = s.pathGems;
        let pathArtifacts = s.pathArtifacts.slice();
        let artifactsClaimedTotal = s.artifactsClaimedTotal;
        const removedHazards = { ...s.removedHazards };

        // 1. 帰還処理
        let sharedPathGems = 0;
        let claimedArtifactPts = 0;
        let claimedArtifactCount = 0;
        const bankedBySeat = {};

        if (returners.length > 0) {
          sharedPathGems = Math.floor(pathGems / returners.length);
          pathGems = pathGems % returners.length;

          if (returners.length === 1 && pathArtifacts.length > 0) {
            for (let k = 0; k < pathArtifacts.length; k++) {
              artifactsClaimedTotal++;
              claimedArtifactPts += artifactsClaimedTotal <= 3 ? 5 : 10;
              claimedArtifactCount++;
            }
            artifactsBySeat[returners[0]] += claimedArtifactCount;
            pathArtifacts = [];
          }

          for (const seat of returners) {
            const gain = roundGems[seat] + sharedPathGems + (returners.length === 1 ? claimedArtifactPts : 0);
            tentGems[seat] += gain;
            bankedBySeat[seat] = gain;
            roundGems[seat] = 0;
            inCave[seat] = false;
          }
        }

        // 2. 全員帰還した → ラウンド終了
        if (stayers.length === 0) {
          const lastStep = {
            roundNo: s.roundNo,
            returners,
            stayers: [],
            sharedPathGems,
            claimedArtifactPts,
            claimedArtifactCount,
            bankedBySeat,
            drawnCard: null,
            busted: false,
            bustHazard: null,
          };
          const lastRound = {
            roundNo: s.roundNo,
            busted: false,
            bustHazard: null,
            lostBySeat: {},
            tentGems: tentGems.slice(),
          };
          const updated = { ...s, tentGems, artifactsClaimedTotal, artifactsBySeat, removedHazards };
          if (s.roundNo >= INCANGOLD_TOTAL_ROUNDS) {
            return finishGame(updated, lastStep, lastRound);
          }
          return startRound(updated, s.roundNo + 1, lastStep, lastRound);
        }

        // 3. 続行組がいる → 山札から1枚めくる
        const deck = s.deck.slice();
        const pathCards = s.pathCards.slice();
        const hazardCounts = { ...s.hazardCounts };

        if (deck.length === 0) {
          // 山札切れ: 残存全員安全帰還
          for (const seat of stayers) {
            tentGems[seat] += roundGems[seat];
            roundGems[seat] = 0;
            inCave[seat] = false;
          }
          const lastStep = {
            roundNo: s.roundNo,
            returners,
            stayers,
            sharedPathGems,
            claimedArtifactPts,
            claimedArtifactCount,
            bankedBySeat,
            drawnCard: null,
            busted: false,
            bustHazard: null,
          };
          const lastRound = {
            roundNo: s.roundNo,
            busted: false,
            bustHazard: null,
            lostBySeat: {},
            tentGems: tentGems.slice(),
          };
          const updated = { ...s, tentGems, artifactsClaimedTotal, artifactsBySeat, removedHazards };
          if (s.roundNo >= INCANGOLD_TOTAL_ROUNDS) {
            return finishGame(updated, lastStep, lastRound);
          }
          return startRound(updated, s.roundNo + 1, lastStep, lastRound);
        }

        const drawnCard = deck.pop();
        pathCards.push(drawnCard);

        if (drawnCard.kind === 'gem') {
          const each = Math.floor(drawnCard.value / stayers.length);
          const rem = drawnCard.value % stayers.length;
          for (const seat of stayers) roundGems[seat] += each;
          pathGems += rem;
        } else if (drawnCard.kind === 'artifact') {
          pathArtifacts.push(drawnCard);
        } else if (drawnCard.kind === 'hazard') {
          const prevCnt = hazardCounts[drawnCard.hazard] || 0;
          hazardCounts[drawnCard.hazard] = prevCnt + 1;

          if (prevCnt >= 1) {
            // バースト（探検失敗）！
            const lostBySeat = {};
            for (const seat of stayers) {
              lostBySeat[seat] = roundGems[seat];
              roundGems[seat] = 0;
              inCave[seat] = false;
            }
            // 原因となった障害カード1枚を以降ラウンドから永久除外
            removedHazards[drawnCard.hazard] = (removedHazards[drawnCard.hazard] || 0) + 1;

            const lastStep = {
              roundNo: s.roundNo,
              returners,
              stayers,
              sharedPathGems,
              claimedArtifactPts,
              claimedArtifactCount,
              bankedBySeat,
              drawnCard,
              busted: true,
              bustHazard: drawnCard.hazard,
            };
            const lastRound = {
              roundNo: s.roundNo,
              busted: true,
              bustHazard: drawnCard.hazard,
              lostBySeat,
              tentGems: tentGems.slice(),
            };
            const updated = { ...s, tentGems, artifactsClaimedTotal, artifactsBySeat, removedHazards };
            if (s.roundNo >= INCANGOLD_TOTAL_ROUNDS) {
              return finishGame(updated, lastStep, lastRound);
            }
            return startRound(updated, s.roundNo + 1, lastStep, lastRound);
          }
        }

        const lastStep = {
          roundNo: s.roundNo,
          returners,
          stayers,
          sharedPathGems,
          claimedArtifactPts,
          claimedArtifactCount,
          bankedBySeat,
          drawnCard,
          busted: false,
          bustHazard: null,
        };

        const nextChoices = new Array(n).fill(-1);
        const firstNext = firstUndecidedInCave(inCave, nextChoices, n);
        return attachView({
          ...s,
          deck,
          tentGems,
          roundGems,
          inCave,
          pathGems,
          pathCards,
          pathArtifacts,
          hazardCounts,
          artifactsClaimedTotal,
          artifactsBySeat,
          removedHazards,
          choices: nextChoices,
          turn: firstNext,
          lastStep,
        });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array(s.tentGems);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const lv = brainLevel(level);
      const shownHazards = Object.keys(s.hazardCounts).filter((k) => s.hazardCounts[k] > 0);
      const activeCount = s.inCave.filter(Boolean).length;

      // 障害がまだ1枚も出ていないなら、次の1枚でバーストする確率は0%！
      if (shownHazards.length === 0) {
        if (lv === 0 && rngFloat(rng) < 0.15) return INCANGOLD_MOVE_RETURN;
        return INCANGOLD_MOVE_CONTINUE;
      }

      if (lv === 0) {
        const retProb = Math.min(0.85, shownHazards.length * 0.22);
        return rngFloat(rng) < retProb ? INCANGOLD_MOVE_RETURN : INCANGOLD_MOVE_CONTINUE;
      }

      // 次の1枚でバーストする確率を山札残り構成から推定
      let dangerCardsLeft = 0;
      for (const hz of shownHazards) {
        const removed = s.removedHazards[hz] || 0;
        const left = Math.max(0, 3 - removed - 1);
        dangerCardsLeft += left;
      }
      const pBust = s.deck.length > 0 ? dangerCardsLeft / s.deck.length : 0;

      const myGems = s.roundGems[seat];
      const artifactBonus = s.pathArtifacts.length * (s.artifactsClaimedTotal < 3 ? 5 : 10);
      const returnGain = myGems + Math.floor(s.pathGems / Math.max(1, Math.min(2, activeCount))) + (activeCount <= 2 ? artifactBonus * 0.6 : 0);

      // 1枚進んだときの期待宝石増分 (平均約 7.5 / activeCount)
      const expectedStepGain = (1 - pBust) * (7.5 / Math.max(1, activeCount));
      const expectedBustLoss = pBust * (myGems + 1);

      const seatBias = ((seat % 3) - 1) * 0.18;
      const greed = (lv >= 2 ? 1.05 : 0.95) + seatBias + (rngFloat(rng) - 0.5) * 0.35;
      if (returnGain >= 8 && expectedBustLoss > expectedStepGain * Math.max(0.4, greed)) {
        return INCANGOLD_MOVE_RETURN;
      }
      if (shownHazards.length >= 3 && myGems >= 4 && rngFloat(rng) < 0.7 + seatBias * -0.5) {
        return INCANGOLD_MOVE_RETURN;
      }
      if (artifactBonus > 0 && myGems >= 3 && pBust >= 0.1 && rngFloat(rng) < 0.55 - seatBias) {
        return INCANGOLD_MOVE_RETURN;
      }
      return INCANGOLD_MOVE_CONTINUE;
    },
  },
};
