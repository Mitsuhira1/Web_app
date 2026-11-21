// スパイダーソリティア(ソリティアの「種類: スパイダー」)。
// クロンダイクと同じく、多人数なら同じ配札を各自が同時に解く(ConcurrentRules として登録は asobi-pc-core.mjs 側)。
// 手の番号: seat*1000000 + code。code 0 = 山札から配る、1 = やめる、
//   それ以外 = src*10000 + n*100 + dest(src・dest は列 k を 6+k で表す。クロンダイクと同じ並び)。
// 札の番号 0〜103: base = c % 52、マーク = floor(base/13)、数 = base%13+1(A=1)。
import { shuffle } from './_utils.mjs';

const SEAT = 1000000;
const suitOf = (c) => Math.floor((c % 52) / 13);
const rankOf = (c) => (c % 52) % 13 + 1;

function makeDeck(suits) {
  // 104 枚。1 種: ♠×8、2 種: ♠♥×4、4 種: 4 マーク×2。同じ札は 52 ずつ足して番号を分ける
  const use = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  const per = 8 / use.length, out = [];
  for (let k = 0; k < per; k++) for (const s of use) for (let r = 0; r < 13; r++) out.push(k * 52 + s * 13 + r);
  return out;
}

// 列の一番下から、同じマークで 1 つずつ小さくつながっている枚数(表の札の範囲で)
function runLen(pile, open) {
  if (!pile.length) return 0;
  let n = 1;
  for (let i = pile.length - 1; i > pile.length - open; i--) {
    const a = pile[i - 1], b = pile[i];
    if (suitOf(a) === suitOf(b) && rankOf(a) === rankOf(b) + 1) n++; else break;
  }
  return n;
}

function cloneBoard(b) {
  return { stock: b.stock.slice(), piles: b.piles.map((p) => p.slice()), open: b.open.slice(), done: b.done.slice(), moves: b.moves, gaveUp: b.gaveUp, last: b.last };
}

export function SpiderSolitaire(players, suits) {
  this.players = players;
  this.suits = suits;
  this.isSpider = true;
}

const P = SpiderSolitaire.prototype;
P.qs = function () { return this.players; };
P.ss = function (rng) {
  const ids = shuffle(makeDeck(this.suits), rng);
  const piles = [], open = [];
  let pos = 0;
  for (let i = 0; i < 10; i++) { const n = i < 4 ? 6 : 5; piles.push(ids.slice(pos, pos + n)); pos += n; open.push(1); }
  const board = { stock: ids.slice(pos), piles, open, done: [], moves: 0, gaveUp: false, last: -1 };
  const boards = [];
  for (let i = 0; i < this.players; i++) boards.push(cloneBoard(board));
  return this.attach({ boards, winner: -1, over: false, lastMover: -1 });
};
P.ts = function (s) {
  if (s.over) return -1;
  const i = s.boards.findIndex((b) => !b.gaveUp);
  return i;
};
P.os = function (s, seat) {
  if (s.over || seat < 0 || seat >= s.boards.length) return new Int32Array(0);
  const b = s.boards[seat];
  if (b.gaveUp) return new Int32Array(0);
  const out = [seat * SEAT + 1];
  if (b.stock.length && b.piles.every((p) => p.length)) out.push(seat * SEAT);
  for (let k = 0; k < 10; k++) {
    const p = b.piles[k], run = runLen(p, b.open[k]);
    for (let n = 1; n <= run; n++) {
      const first = p[p.length - n];
      for (let d = 0; d < 10; d++) {
        if (d === k) continue;
        const q = b.piles[d];
        if (!q.length) { if (n < p.length) out.push(seat * SEAT + (6 + k) * 10000 + n * 100 + (6 + d)); }
        else if (rankOf(q[q.length - 1]) === rankOf(first) + 1) out.push(seat * SEAT + (6 + k) * 10000 + n * 100 + (6 + d));
      }
    }
  }
  return new Int32Array(out);
};
P.ps = function (s) {
  const out = [];
  for (let i = 0; i < this.players; i++) out.push(...this.os(s, i));
  return new Int32Array(out);
};
P.rs = function (s, m) { return this.ts(s) >= 0 && this.ps(s).includes(m); };
P.ws = function (s, m) {
  const seat = Math.floor(m / SEAT), code = m % SEAT;
  const b = cloneBoard(s.boards[seat]);
  b.moves++;
  b.last = code;
  if (code === 1) b.gaveUp = true;
  else if (code === 0) {
    for (let d = 0; d < 10 && b.stock.length; d++) { b.piles[d].push(b.stock.shift()); b.open[d]++; }
  } else {
    const k = Math.floor(code / 10000) - 6, n = Math.floor((code % 10000) / 100), d = code % 100 - 6;
    const moving = b.piles[k].splice(b.piles[k].length - n, n);
    b.open[k] = b.piles[k].length ? Math.max(1, b.open[k] - n) : 0;
    b.piles[d].push(...moving);
    b.open[d] += n;
  }
  // K〜A が同じマークでそろったら組札へ(配った時は全部の列を見る)
  for (let d = 0; d < 10; d++) {
    const p = b.piles[d];
    if (p.length >= 13 && rankOf(p[p.length - 1]) === 1 && runLen(p, b.open[d]) >= 13) {
      b.done.push(suitOf(p[p.length - 1]));
      p.splice(p.length - 13, 13);
      b.open[d] = p.length ? Math.max(1, b.open[d] - 13) : 0;
    }
  }
  const boards = s.boards.slice();
  boards[seat] = b;
  const won = b.done.length === 8;
  const over = won || boards.every((x) => x.gaveUp);
  return this.attach({ boards, winner: won ? seat : -1, over, lastMover: seat });
};
P.xs = function (s) {
  if (!s.over) return null;
  return { winner: s.winner, reason: s.winner >= 0 ? '8組すべてそろえました' : this.players === 1 ? 'この配札を終了しました' : '全員が終了しました' };
};
P.us = function (s) { return new Int32Array(s.boards.map((b) => b.done.length)); };

const cardJson = (c) => `{"c":${c},"r":${rankOf(c) === 1 ? 14 : rankOf(c)},"s":${suitOf(c)}}`;
P.attach = function (s) {
  const self = this;
  Object.defineProperty(s, '__extraView', {
    enumerable: false, configurable: true,
    value: (_rules, me) => {
      const b = s.boards[Math.max(0, Math.min(me, s.boards.length - 1))];
      return `{"kind":"solitaire","variant":"spider","me":${me},"suits":${self.suits},"stock":${b.stock.length},"deals":${Math.ceil(b.stock.length / 10)},`
        + `"piles":[${b.piles.map((p) => `[${p.map(cardJson).join(',')}]`).join(',')}],"open":[${b.open.join(',')}],`
        + `"done":[${b.done.join(',')}],"last":${b.last},"moves":${b.moves},`
        + `"others":[${s.boards.map((x, i) => `[${i},${x.done.length},${x.gaveUp}]`).join(',')}]}`;
    },
  });
  return s;
};

// CPU: 伏せ札を開く手・同じマークでつながる手を優先。良い手が無ければ配る、配れなければやめる。
export function spiderChoose(r, s, seat) {
  const legal = [...r.os(s, seat)];
  const b = s.boards[seat];
  let best = -1, bestV = 0;
  for (const m of legal) {
    const code = m % SEAT;
    if (code < 2) continue;
    const k = Math.floor(code / 10000) - 6, n = Math.floor((code % 10000) / 100), d = code % 100 - 6;
    const p = b.piles[k], q = b.piles[d];
    const first = p[p.length - n], below = p[p.length - n - 1];
    const wasJoined = n < b.open[k] && below != null && rankOf(below) === rankOf(first) + 1;
    const wasSame = wasJoined && suitOf(below) === suitOf(first);
    const destTop = q[q.length - 1];
    const toSame = destTop != null && suitOf(destTop) === suitOf(first);
    let v = 0;
    if (b.open[k] === n && p.length > n) v += 100;                                          // 伏せ札が開く
    if (n === p.length && q.length) v += 60;                                                   // 列が空く
    if (toSame && !wasSame) v += 40 + n;
    if (!q.length && v < 100) v = 0;                                                           // 空き列へは開く時だけ
    if (wasSame) v = 0;
    if (wasJoined && !toSame) v = 0;
    if (v > bestV) { bestV = v; best = m; }
  }
  if (best >= 0) return best;
  if (legal.includes(seat * SEAT)) return seat * SEAT;
  return seat * SEAT + 1;
}
