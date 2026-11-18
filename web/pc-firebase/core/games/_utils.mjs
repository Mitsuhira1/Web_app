export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardSuit(id) {
  return id >= 52 ? 4 : Math.floor(id / 13);
}

export function cardRank(id) {
  return id >= 52 ? 0 : (id % 13) + 1;
}

export function cardLabel(id) {
  if (id < 0) return '';
  if (id >= 52) return 'JOKER';
  return SUITS[cardSuit(id)] + RANKS[cardRank(id)];
}

export function cardObj(id) {
  return id < 0 ? null : { id, t: cardLabel(id) };
}

export function makeDeck(jokers = 0) {
  const d = [];
  for (let i = 0; i < 52; i++) d.push(i);
  for (let j = 0; j < jokers; j++) d.push(52 + j);
  return d;
}

export function rngFloat(rng) {
  return typeof rng === 'function' ? rng() : rng.kd();
}

export function rngInt(rng, max) {
  if (max <= 1) return 0;
  return Math.floor(rngFloat(rng) * max);
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export function brainLevel(level) {
  if (typeof level === 'number') return level;
  if (level && typeof level.v2_1 === 'number') return level.v2_1;
  if (level && typeof level.ordinal === 'number') return level.ordinal;
  return 1;
}

export function pickRandom(arr, rng) {
  return arr[rngInt(rng, arr.length)];
}

export function withView(state, viewFn) {
  Object.defineProperty(state, '__extraView', {
    value: viewFn,
    enumerable: false,
    configurable: true,
  });
  return state;
}
