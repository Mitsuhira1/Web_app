import { shuffle, brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * ごいた (Goita) — 4人(2vs2ペア戦) 伝統ゲーム
 * 駒32枚: し(10枚,10点), 香(4枚,20点), 馬(4枚,20点), 銀(4枚,30点), 金(4枚,30点), 角(2枚,40点), 飛(2枚,40点), 王(2枚,50点)
 * 向かい合う席(0&2 vs 1&3)が味方チーム。
 * ローカルルール:
 * - target: '100' / '150' (150点先取・標準)
 * - kingDouble: 'on' (7枚目と8枚目が両方王なら100点・標準) / 'off' (倍付けなし)
 * - fiveShi: 'redeal' (し5枚は配り直し・6枚以上即勝ち) / 'ignore' (なし)
 */
export const GOITA_SPEC = {
  id: 'goita',
  no: 38,
  name: 'ごいた',
  category: 'BOARD',
  players: '4人',
  intro: '向かいの味方と組んで8枚の駒を出し切る能登の伝統ゲーム。150点先取！',
  seatNames: ['南(チームA)', '西(チームB)', '北(チームA)', '東(チームB)'],
  undoAllowed: false,
  seatsFor: () => 4,
  options: [
    { key: 'target', label: '勝利点', default: '150', group: 'rule', values: [['100', '100点'], ['150', '150点(標準)']] },
    { key: 'kingDouble', label: '王の倍付け(100点)', default: 'on', group: 'local', hint: '最後2枚が連続で王(7枚目受け・8枚目攻め等)のとき倍の100点', values: [['on', 'あり(標準)'], ['off', 'なし']] },
    { key: 'fiveShi', label: 'し(歩)5枚以上の扱い', default: 'redeal', group: 'local', values: [['redeal', '5枚は配り直し/6枚以上勝ち'], ['ignore', '特別処理なし']] },
  ],
  sections: [
    ['概要と目的', '4人が向かい合う2チーム(1・3番 vs 2・4番)に分かれ、各8枚配られた竹駒を早く出し切ることを目指します。上がった時の最後の「攻め駒」の点数がチームに入り、先に150点に達したチームが勝ちです。'],
    ['駒と点数', 'し(10枚)=10点 / 香(4枚)=20点 / 馬(4枚)=20点 / 銀(4枚)=30点 / 金(4枚)=30点 / 角(2枚)=40点 / 飛(2枚)=40点 / 王(2枚)=50点。'],
    ['受けと攻め', '前の人が出した「攻め駒」を同じ駒(または王)で「受け」て、自分の「攻め駒」を出します。王は「し・香」以外の攻めを受けられます。全員パスして親に戻ったら、好きな駒で新たに攻められます(1枚目は伏せて出せます)。'],
  ],
  makeRules(opts) {
    const target = opts.it('target', 150);
    const kingDouble = opts.jt('kingDouble', 'on') === 'on';
    const fiveShi = opts.jt('fiveShi', 'redeal') === 'redeal';

    // 駒ID: 0:し, 1:香, 2:馬, 3:銀, 4:金, 5:角, 6:飛, 7:王
    const NAMES = ['し', '香', '馬', '銀', '金', '角', '飛', '王'];
    const PTS = [10, 20, 20, 30, 30, 40, 40, 50];
    const COUNTS = [10, 4, 4, 4, 4, 2, 2, 2];

    function makeGoitaDeck() {
      const d = [];
      for (let k = 0; k < 8; k++) {
        for (let c = 0; c < COUNTS[k]; c++) d.push(k);
      }
      return d;
    }

    function canBlock(piece, attack) {
      if (attack < 0) return false;
      if (piece === attack) return true;
      // 王は「し(0)」「香(1)」以外の攻めを受けられる(王の攻めは王でのみ受け可=上と統合)
      if (piece === 7 && attack >= 2) return true;
      return false;
    }

    function dealHands(deck) {
      const hands = [[], [], [], []];
      for (let i = 0; i < deck.length; i++) hands[i % 4].push(deck[i]);
      hands.forEach((hand) => hand.sort((a, b) => a - b));
      return hands;
    }

    function dealRound(deck, roundNo, teamScores, dealer) {
      let hands = dealHands(deck);
      if (fiveShi) {
        const deckSeed = deck.reduce((seed, piece) => Math.imul(seed ^ piece, 16777619), 2166136261);
        for (let retry = 1; retry <= 10; retry++) {
          const shiCounts = hands.map((hand) => hand.filter((piece) => piece === 0).length);
          const maxShi = Math.max(...shiCounts);
          if (maxShi < 5) break;
          if (maxShi >= 6) {
            const p = shiCounts.findIndex((c) => c >= 6);
            const team = p % 2;
            const bonus = maxShi === 8 ? 100 : 50;
            teamScores = teamScores.slice();
            teamScores[team] += bonus;
            if (teamScores[team] >= target) {
              return {
                roundNo, hands, played: [[], [], [], []], teamScores,
                turn: -1, phase: 'attack', activeAttack: -1, attacker: -1, passCount: 0,
                winner: team, reason: `チーム${team === 0 ? 'A(1・3番)' : 'B(2・4番)'}が「し」${maxShi}枚(${bonus}点)で${teamScores[team]}点到達！`,
              };
            }
          }
          // 同じシードの対局で再現できるように配り直す。最後は「し」を均等に配る。
          const seed = deckSeed + Math.imul(retry, 0x9e3779b9);
          hands = dealHands(retry === 10 ? makeGoitaDeck() : seededDeck(seed));
        }
      }
      return {
        roundNo,
        hands,
        played: [[], [], [], []], // { piece, hidden }
        teamScores,
        turn: dealer,
        phase: 'attack', // 'block' | 'attack'
        activeAttack: -1,
        attacker: dealer,
        passCount: 0,
        lastRoundResult: null,
        winner: -1,
        reason: '',
      };
    }

    const roundSeed = (roundNo, scores) => roundNo * 4099 + scores[0] * 19 + scores[1] * 43;
    function seededDeck(seed) {
      const d = makeGoitaDeck();
      for (let i = d.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const j = seed % (i + 1);
        const t = d[i]; d[i] = d[j]; d[j] = t;
      }
      return d;
    }

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'goita',
        me,
        roundNo: st.roundNo,
        turn: st.turn,
        phase: st.phase,
        activeAttack: st.activeAttack,
        activeAttackName: st.activeAttack >= 0 ? NAMES[st.activeAttack] : '',
        attacker: st.attacker,
        teamScores: st.teamScores,
        handCounts: st.hands.map((h) => h.length),
        myHand: me >= 0 && me < 4 ? st.hands[me] : [],
        played: st.played.map((pl, seat) => pl.map((x) => (x.hidden && seat !== me && !st.reason ? -1 : x.piece))),
        lastRoundResult: st.lastRoundResult,
        pieceNames: NAMES,
        piecePts: PTS,
      }));
    }

    return {
      playerCount: 4,
      initial(rng) {
        const deck = shuffle(makeGoitaDeck(), rng);
        return attachView(dealRound(deck, 1, [0, 0], 0));
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        if (s.reason) return new Int32Array(0);
        const hand = s.hands[s.turn];
        const uniq = Array.from(new Set(hand));
        if (s.phase === 'attack') {
          return new Int32Array(uniq); // 0..7 の駒種を攻めとして出す
        }
        // phase === 'block'
        const moves = uniq.filter((k) => canBlock(k, s.activeAttack));
        moves.push(99); // 99 = なし(パス)
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const hands = s.hands.map((h) => h.slice());
        const played = s.played.map((pl) => pl.slice());

        if (s.phase === 'block') {
          if (m === 99) {
            const nextP = (p + 1) % 4;
            const passCount = s.passCount + 1;
            if (nextP === s.attacker || passCount >= 3) {
              // 一巡して親に戻った → 親が新たに攻める(1枚伏せ/通常攻め)
              return attachView({
                ...s, hands, played, turn: s.attacker, phase: 'attack', activeAttack: -1, passCount: 0,
              });
            }
            return attachView({ ...s, hands, played, turn: nextP, passCount });
          }
          // 受け駒を出す
          const idx = hands[p].indexOf(m);
          hands[p].splice(idx, 1);
          played[p].push({ piece: m, hidden: false });
          return attachView({
            ...s, hands, played, phase: 'attack', activeAttack: -1, passCount: 0,
          });
        }

        // phase === 'attack'
        const idx = hands[p].indexOf(m);
        hands[p].splice(idx, 1);
        const isFirstHidden = s.activeAttack < 0 && played[p].length % 2 === 0;
        played[p].push({ piece: m, hidden: isFirstHidden });

        // 上がり判定 (手札0枚)
        if (hands[p].length === 0) {
          let pts = PTS[m];
          if (kingDouble && m === 7 && played[p].length >= 2 && played[p][played[p].length - 2].piece === 7) {
            pts = 100;
          }
          const team = p % 2;
          const teamScores = s.teamScores.slice();
          teamScores[team] += pts;
          const lastRoundResult = { roundNo: s.roundNo, winnerSeat: p, team, lastPiece: m, pts };

          if (teamScores[team] >= target) {
            // 個人スコア互換のため winner = team (0 or 1), ただしSeatベースで表現
            return attachView({
              ...s, hands, played, teamScores, lastRoundResult, turn: -1,
              winner: p,
              reason: `チーム${team === 0 ? 'A(1・3番)' : 'B(2・4番)'}が${teamScores[team]}点で勝利！(上がり: ${p + 1}番・${NAMES[m]} ${pts}点)`,
            });
          }

          const nextDeck = seededDeck(roundSeed(s.roundNo, teamScores));
          const nextSt = dealRound(nextDeck, s.roundNo + 1, teamScores, p);
          nextSt.lastRoundResult = lastRoundResult;
          return attachView(nextSt);
        }

        return attachView({
          ...s, hands, played, phase: 'block', activeAttack: m, attacker: p, passCount: 0, turn: (p + 1) % 4,
        });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array([s.teamScores[0], s.teamScores[1], s.teamScores[0], s.teamScores[1]]);
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      const lv = brainLevel(level);
      if (lv === 0) return legal[rngInt(rng, legal.length)];
      if (s.phase === 'block') {
        const blocks = legal.filter((m) => m !== 99);
        if (blocks.length === 0) return 99;
        // 味方の攻めにはなるべくパス(ただし手札が少ない時は受けて上がる)
        const partner = (seat + 2) % 4;
        if (s.attacker === partner && s.hands[seat].length > 2) return 99;
        // 王は温存し、同じ駒で受けられるならそちらを優先
        const nonKing = blocks.filter((k) => k !== 7);
        return nonKing.length > 0 ? nonKing[0] : blocks[0];
      }
      // attack: 残り2枚以下なら高得点駒を最後に出すように調整、通常は手札に2枚ある駒や安い駒から攻める
      const hand = s.hands[seat];
      if (hand.length === 2) {
        return legal.slice().sort((a, b) => a - b)[0]; // 安い方を先に出して高い方を上がり駒に
      }
      const counts = new Map();
      for (const c of hand) counts.set(c, (counts.get(c) || 0) + 1);
      const sorted = legal.slice().sort((a, b) => (counts.get(b) - counts.get(a)) || (a - b));
      return sorted[0];
    },
  },
};
