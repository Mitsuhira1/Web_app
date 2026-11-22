import { WAR_SPEC } from './games/war.mjs';
import { TAKOYAKI_SPEC } from './games/takoyaki.mjs';
import { BUTANOSHIPPO_SPEC } from './games/butanoshippo.mjs';
import { OLDMAID_SPEC } from './games/oldmaid.mjs';
import { HEARTS_SPEC } from './games/hearts.mjs';
import { GINRUMMY_SPEC } from './games/ginrummy.mjs';
import { VULTURE_SPEC } from './games/vulture.mjs';
import { GOITA_SPEC } from './games/goita.mjs';
import { QUARTO_SPEC } from './games/quarto.mjs';
import { GEISTER_SPEC } from './games/geister.mjs';
import { RUMMIKUB_SPEC } from './games/rummikub.mjs';
import { PEGSOLITAIRE_SPEC } from './games/pegsolitaire.mjs';
import { ROULETTE_SPEC } from './games/roulette.mjs';

export const EXTRA_GAME_SPECS = [
  WAR_SPEC,
  TAKOYAKI_SPEC,
  BUTANOSHIPPO_SPEC,
  OLDMAID_SPEC,
  HEARTS_SPEC,
  GINRUMMY_SPEC,
  VULTURE_SPEC,
  GOITA_SPEC,
  QUARTO_SPEC,
  GEISTER_SPEC,
  RUMMIKUB_SPEC,
  PEGSOLITAIRE_SPEC,
  ROULETTE_SPEC,
];

function wrapRules(rawRules, OutcomeCtor) {
  return {
    _raw: rawRules,
    qs() {
      return rawRules.playerCount;
    },
    ss(rng) {
      return rawRules.initial(rng);
    },
    ts(s) {
      return rawRules.toMove(s);
    },
    ps(s) {
      const m = rawRules.legalMoves(s);
      return m instanceof Int32Array ? m : new Int32Array(m);
    },
    rs(s, m) {
      return !!rawRules.isLegal(s, m);
    },
    ws(s, m) {
      return rawRules.play(s, m);
    },
    xs(s) {
      const o = rawRules.outcome(s);
      if (o == null) return null;
      return 'ys_1' in o ? o : new OutcomeCtor(o.winner, o.reason || '');
    },
    us(s) {
      const sc = rawRules.scores ? rawRules.scores(s) : null;
      if (sc == null) return null;
      return sc instanceof Int32Array ? sc : new Int32Array(sc);
    },
  };
}

// みんなで同時に動くゲーム(ルーレット)。エンジンの ConcurrentRules として登録する(asobi-pc-core.mjs の initMetadataForClass)。
// 素の規則は legalMovesFor(s, seat) を持ち、手は「席 × 1000000 + 手」。
export class ExtraConcurrentRules {
  constructor(raw, OutcomeCtor) { this._raw = raw; this._Outcome = OutcomeCtor; }
  qs() { return this._raw.playerCount; }
  ss(rng) { return this._raw.initial(rng); }
  ts(s) { return this._raw.toMove(s); }
  os(s, seat) { return new Int32Array(this._raw.legalMovesFor(s, seat)); }
  ps(s) { return new Int32Array(this._raw.legalMoves(s)); }
  rs(s, m) { return !!this._raw.isLegal(s, m); }
  ws(s, m) { return this._raw.play(s, m); }
  xs(s) {
    const o = this._raw.outcome(s);
    if (o == null) return null;
    return 'ys_1' in o ? o : new this._Outcome(o.winner, o.reason || '');
  }
  us(s) {
    const sc = this._raw.scores ? this._raw.scores(s) : null;
    if (sc == null) return null;
    return sc instanceof Int32Array ? sc : new Int32Array(sc);
  }
}

function wrapBrain(spec) {
  const fn = spec.brain && typeof spec.brain.choose === 'function'
    ? (raw, s, seat, level, rng, budget) => spec.brain.choose(raw, s, seat, level, rng, budget)
    : spec.chooseMove;
  return {
    vs(rules, s, seat, level, rng, budget) {
      const raw = rules && rules._raw ? rules._raw : rules;
      return fn(raw, s, seat, level, rng, budget) | 0;
    },
  };
}

export function registerExtraGames(baseList, k) {
  const {
    GameInfo,
    GameDef,
    OptionSpec,
    Section,
    Outcome,
    Category_BOARD,
    Category_CARD,
    listOf,
    to,
    plus,
    emptyList,
  } = k;

  const extraInfos = EXTRA_GAME_SPECS.map((spec) => {
    const def = new GameDef(
      spec.id,
      (opts) => (spec.concurrent ? new ExtraConcurrentRules(spec.makeRules(opts), Outcome) : wrapRules(spec.makeRules(opts), Outcome)),
      wrapBrain(spec),
      !!spec.undoAllowed,
      spec.seatsFor,
      null,
    );
    const sections = listOf(
      (spec.sections || []).map((sec) =>
        Array.isArray(sec)
          ? new Section(sec[0], sec[1], emptyList())
          : new Section(sec.title, sec.body, emptyList()),
      ),
    );
    const options = listOf(
      (spec.options || []).map(
        (opt) =>
          new OptionSpec(
            opt.key,
            opt.label,
            listOf(opt.values.map(([val, lbl]) => to(val, lbl))),
            opt.default,
            opt.group || 'rule',
            opt.hint || null,
          ),
      ),
    );
    const category = spec.category === 'BOARD' ? Category_BOARD : Category_CARD;
    const seatNames = spec.seatNames ? listOf(spec.seatNames) : undefined;
    const playersText = spec.playersText || spec.players || '2人';
    return new GameInfo(
      spec.id,
      spec.no,
      spec.name,
      category,
      playersText,
      spec.intro,
      def,
      sections,
      options,
      seatNames,
    );
  });

  return plus(baseList, listOf(extraInfos));
}

export function extraGameView(st, rules, me) {
  if (st && typeof st.__extraView === 'function') {
    const raw = rules && rules._raw ? rules._raw : rules;
    return st.__extraView(raw, me, st);
  }
  return null;
}
