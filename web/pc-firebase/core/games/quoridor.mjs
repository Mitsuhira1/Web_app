import { brainLevel, rngInt, withView } from './_utils.mjs';

/**
 * コリドール (Quoridor) — 2〜4人用ボードゲーム (9×9マス)
 * 規則:
 * - 各プレイヤーは自分のコマ1個と壁を持つ。壁の枚数は 2人=各10枚、3人以上=各5枚。
 *   (4人の各5枚は公式通り。3人は公式には無い組み合わせのため、本実装の拡張として各5枚とする)
 * - 開始位置とゴール (座標は x=0〜8 が左→右、y=0〜8 が上→下):
 *   席0=(4,8) 下辺中央 → ゴールは y=0 の列 / 席1=(4,0) 上辺中央 → ゴールは y=8 の列
 *   席2=(0,4) 左辺中央 → ゴールは x=8 の列 / 席3=(8,4) 右辺中央 → ゴールは x=0 の列
 *   3人の場合は席0・席1・席2を使う。
 * - 手番では次のどちらか1つを行う。
 *   (a) コマ移動: 上下左右に1マス。壁で遮られていないこと。
 *       移動先に相手のコマがある場合は、その先へ直進ジャンプできる。
 *       ジャンプ先が盤外・壁で遮られている場合は、相手コマの左右
 *       (移動方向と垂直のマス) へ斜めに移動できる (その際も壁の遮りを見る)。
 *   (b) 壁設置: マスの境界に、長さ2マス分の壁を1枚置く。
 *       壁同士の重なり・交差は禁止。残り枚数が必要。
 *       置いた後も全プレイヤーにゴールまでの経路が1つ以上残らなければならない。
 * - 先に反対側の端 (自分のゴール列) に到達した人の勝ち。
 * オプション:
 * - players: '2' (既定) / '3' / '4'
 *
 * 壁の表現 (このファイル全体で一貫させる):
 * - hWalls[y][x] (x,y ともに 0〜7): 横向きの壁。マス (x,y) と (x+1,y) の「下辺」と
 *   (x,y+1) と (x+1,y+1) の「上辺」を兼ねる位置、つまり行 y と行 y+1 の境界に、
 *   列 x と列 x+1 の2マス分にわたって置かれた壁。
 *   → 縦移動 (x,y)↔(x,y+1) は、hWalls[y][x] (x<8 の時) または hWalls[y][x-1] (x>0 の時) で遮られる。
 * - vWalls[y][x] (x,y ともに 0〜7): 縦向きの壁。マス (x,y) と (x,y+1) の「右辺」を兼ねる位置、
 *   つまり列 x と列 x+1 の境界に、行 y と行 y+1 の2マス分にわたって置かれた壁。
 *   → 横移動 (x,y)↔(x+1,y) は、vWalls[y][x] (y<8 の時) または vWalls[y-1][x] (y>0 の時) で遮られる。
 *
 * 手の符号化:
 * - コマ移動: 移動先セル y*9+x (0〜80)
 * - 壁設置: 100 + (y*8+x)*2 + (縦向きなら1、横向きなら0) (100〜227)
 */

export const QUORIDOR_WALL_BASE = 100;

// 開始位置 (セル番号 y*9+x)。席の順に 0:下、1:上、2:左、3:右。
export const QUORIDOR_STARTS = [8 * 9 + 4, 0 * 9 + 4, 4 * 9 + 0, 4 * 9 + 8];

export function decodeQuoridorMove(m) {
  if (m < QUORIDOR_WALL_BASE) {
    return { type: 'move', x: m % 9, y: Math.floor(m / 9) };
  }
  const v = m - QUORIDOR_WALL_BASE;
  const vertical = v % 2 === 1;
  const idx = Math.floor(v / 2);
  return { type: 'wall', x: idx % 8, y: Math.floor(idx / 8), vertical, orientation: vertical ? 'v' : 'h' };
}

function goalReached(x, y, seat) {
  if (seat === 0) return y === 0;
  if (seat === 1) return y === 8;
  if (seat === 2) return x === 8;
  return x === 0; // seat 3
}

// 壁配列の参照方法をそろえる (2次元配列 [y][x]、一次元配列 (長さ64, y*8+x)、
// 真偽値そのもの、のいずれでも読めるようにする。状態の正規形は2次元配列)
function wallAt(walls, x, y) {
  if (!walls) return false;
  const row = walls[y];
  if (Array.isArray(row)) return !!row[x];
  if (Array.isArray(walls)) return !!walls[y * 8 + x];
  return false;
}

// コマ位置の表し方をそろえる (セル番号、[x,y]、{x,y} のいずれでも読む)
function pawnXY(pawn) {
  if (typeof pawn === 'number') return { x: pawn % 9, y: Math.floor(pawn / 9) };
  if (Array.isArray(pawn)) return { x: pawn[0], y: pawn[1] };
  return { x: pawn.x, y: pawn.y };
}

// (x,y) から (nx,ny) (上下左右に隣接) への移動が壁で遮られているか
function blockedBetween(hWalls, vWalls, x, y, nx, ny) {
  if (ny === y + 1) { // 下へ
    return (x < 8 && wallAt(hWalls, x, y)) || (x > 0 && wallAt(hWalls, x - 1, y));
  }
  if (ny === y - 1) { // 上へ
    return (x < 8 && wallAt(hWalls, x, y - 1)) || (x > 0 && wallAt(hWalls, x - 1, y - 1));
  }
  if (nx === x + 1) { // 右へ
    return (y < 8 && wallAt(vWalls, x, y)) || (y > 0 && wallAt(vWalls, x, y - 1));
  }
  // 左へ
  return (y < 8 && wallAt(vWalls, x - 1, y)) || (y > 0 && wallAt(vWalls, x - 1, y - 1));
}

// BFS でゴールまでの最短経路 (セルの配列。開始セルを含む) を返す。到達不能なら null。
// コマは障害物として数えない (壁だけを見る。公式の「経路を塞ぐ壁は禁止」の判定もこの基準)
function bfsPath(s, seat) {
  const start = pawnXY(s.pawns[seat]);
  if (goalReached(start.x, start.y, seat)) return [start.y * 9 + start.x];
  const prev = new Int16Array(81).fill(-2); // -2=未訪問、-1=開始
  const queue = [start.y * 9 + start.x];
  prev[queue[0]] = -1;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % 9;
    const cy = Math.floor(cur / 9);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx > 8 || ny < 0 || ny > 8) continue;
      const nc = ny * 9 + nx;
      if (prev[nc] !== -2) continue;
      if (blockedBetween(s.hWalls, s.vWalls, cx, cy, nx, ny)) continue;
      prev[nc] = cur;
      if (goalReached(nx, ny, seat)) {
        const path = [nc];
        let p = cur;
        while (p !== -1) { path.push(p); p = prev[p]; }
        return path.reverse();
      }
      queue.push(nc);
    }
  }
  return null;
}

/**
 * 指定席のゴールまでの最短経路長 (マス数) を返す。到達不能なら -1。
 * 壁の合法判定と brain の両方から使う公開ヘルパー。
 * s は { pawns, hWalls, vWalls } を持つ状態 (またはそれに準じたオブジェクト) でよい。
 */
export function quoridorPathLength(s, seat) {
  const path = bfsPath(s, seat);
  return path ? path.length - 1 : -1;
}

function emptyWalls() {
  return Array.from({ length: 8 }, () => Array(8).fill(false));
}

function cloneWalls(walls) {
  const out = emptyWalls();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) if (wallAt(walls, x, y)) out[y][x] = true;
  }
  return out;
}

function wallList(walls) {
  const list = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) if (wallAt(walls, x, y)) list.push({ x, y });
  }
  return list;
}

export const QUORIDOR_SPEC = {
  id: 'quoridor',
  no: 50,
  name: 'コリドール',
  category: 'BOARD',
  players: '2〜4人',
  intro: '壁で相手の進路を妨げながら、自分のコマを反対側の端まで先に進めよう！',
  seatNames: ['1番', '2番', '3番', '4番'],
  undoAllowed: false,
  seatsFor: (opts) => opts.it('players', 2),
  options: [
    { key: 'players', label: '人数', default: '2', group: 'rule', values: [['2', '2人'], ['3', '3人'], ['4', '4人']] },
  ],
  sections: [
    ['概要と目的', '9×9の盤で、自分のコマを反対側の端の列まで先に進めた人の勝ちです。手番では、コマを1マス進めるか、壁を1枚置くかのどちらかを選びます。'],
    ['コマの移動とジャンプ', 'コマは上下左右に1マス進めます（壁のある境界は通れません）。相手のコマと隣り合った時は、その先へ飛び越えることができます。飛び越えた先が盤外や壁の時は、相手のコマの左右のマスへ斜めに進めます。'],
    ['壁', '壁は2マス分の長さで、重ねたり交差させたりはできません。壁は2人では各10枚、3人以上では各5枚です。どのプレイヤーにもゴールまでの道が1つ以上残る置き方はできません。'],
  ],
  makeRules(opts) {
    const n = opts.it('players', 2);
    const wallsPerPlayer = n === 2 ? 10 : 5;

    function attachView(state) {
      return withView(state, (r, me, st) => JSON.stringify({
        kind: 'quoridor',
        me,
        n: st.n,
        pawns: st.pawns.map((p) => pawnXY(p)),
        wallsLeft: st.wallsLeft.slice(),
        hWalls: wallList(st.hWalls),
        vWalls: wallList(st.vWalls),
        turn: st.turn,
        lastAction: st.lastAction,
      }));
    }

    // コマ移動の移動先セル一覧 (ジャンプ・斜め移動を含む)
    function pawnDestinations(s, seat) {
      const { x, y } = pawnXY(s.pawns[seat]);
      const occupied = new Set(s.pawns.map((p) => { const q = pawnXY(p); return q.y * 9 + q.x; }));
      const dests = [];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx > 8 || ny < 0 || ny > 8) continue;
        if (blockedBetween(s.hWalls, s.vWalls, x, y, nx, ny)) continue;
        if (!occupied.has(ny * 9 + nx)) {
          dests.push(ny * 9 + nx);
          continue;
        }
        // 相手コマがある: その先へ直進ジャンプを試す
        const jx = nx + dx;
        const jy = ny + dy;
        const jumpIn = jx >= 0 && jx <= 8 && jy >= 0 && jy <= 8;
        const jumpOpen = jumpIn && !blockedBetween(s.hWalls, s.vWalls, nx, ny, jx, jy) && !occupied.has(jy * 9 + jx);
        if (jumpOpen) {
          dests.push(jy * 9 + jx);
        } else {
          // ジャンプできない (盤外・壁・さらに別のコマ) → 相手コマの左右 (垂直方向) へ斜め移動
          const perps = dx !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
          for (const [px, py] of perps) {
            const sx = nx + px;
            const sy = ny + py;
            if (sx < 0 || sx > 8 || sy < 0 || sy > 8) continue;
            if (blockedBetween(s.hWalls, s.vWalls, nx, ny, sx, sy)) continue;
            if (occupied.has(sy * 9 + sx)) continue;
            dests.push(sy * 9 + sx);
          }
        }
      }
      return dests;
    }

    // 壁設置が合法か (重なり・交差・残り枚数・経路を塞がないこと)
    function wallLegal(s, seat, x, y, vertical) {
      if (x < 0 || x > 7 || y < 0 || y > 7) return false;
      if (s.wallsLeft[seat] <= 0) return false;
      const h = s.hWalls;
      const v = s.vWalls;
      if (vertical) {
        if (wallAt(v, x, y)) return false; // 同じ場所に重なり
        if (wallAt(h, x, y)) return false; // 交差
        if (y > 0 && wallAt(v, x, y - 1)) return false; // 縦に重なる
        if (y < 7 && wallAt(v, x, y + 1)) return false;
      } else {
        if (wallAt(h, x, y)) return false;
        if (wallAt(v, x, y)) return false; // 交差
        if (x > 0 && wallAt(h, x - 1, y)) return false; // 横に重なる
        if (x < 7 && wallAt(h, x + 1, y)) return false;
      }
      // 仮置きして、全員にゴールまでの経路が残るか BFS で検証する
      const h2 = cloneWalls(h);
      const v2 = cloneWalls(v);
      if (vertical) v2[y][x] = true; else h2[y][x] = true;
      const trial = { pawns: s.pawns, hWalls: h2, vWalls: v2 };
      for (let seat2 = 0; seat2 < s.n; seat2++) {
        if (quoridorPathLength(trial, seat2) < 0) return false;
      }
      return true;
    }

    function legalMovesFor(s) {
      if (s.reason) return [];
      const seat = s.turn;
      const moves = pawnDestinations(s, seat);
      if (s.wallsLeft[seat] > 0) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            if (wallLegal(s, seat, x, y, false)) moves.push(QUORIDOR_WALL_BASE + (y * 8 + x) * 2);
            if (wallLegal(s, seat, x, y, true)) moves.push(QUORIDOR_WALL_BASE + (y * 8 + x) * 2 + 1);
          }
        }
      }
      return moves;
    }

    return {
      playerCount: n,
      initial(rng) { // rng は使わない (初期配置は固定)
        return attachView({
          n,
          pawns: QUORIDOR_STARTS.slice(0, n),
          hWalls: emptyWalls(),
          vWalls: emptyWalls(),
          wallsLeft: Array(n).fill(wallsPerPlayer),
          turn: 0,
          lastAction: null,
          winner: -1,
          reason: '',
        });
      },
      toMove(s) {
        return s.reason ? -1 : s.turn;
      },
      legalMoves(s) {
        return new Int32Array(legalMovesFor(s));
      },
      isLegal(s, m) {
        return legalMovesFor(s).includes(m);
      },
      play(s, m) {
        const p = s.turn;
        const pawns = s.pawns.slice();
        const hWalls = cloneWalls(s.hWalls);
        const vWalls = cloneWalls(s.vWalls);
        const wallsLeft = s.wallsLeft.slice();
        let lastAction;
        let winner = -1;
        let reason = '';

        if (m < QUORIDOR_WALL_BASE) {
          const from = pawnXY(pawns[p]);
          pawns[p] = m;
          const to = pawnXY(m);
          lastAction = { seat: p, type: 'move', from, to };
          if (goalReached(to.x, to.y, p)) {
            winner = p;
            reason = `${p + 1}番がゴールに到達しました`;
          }
        } else {
          const d = decodeQuoridorMove(m);
          if (d.vertical) vWalls[d.y][d.x] = true; else hWalls[d.y][d.x] = true;
          wallsLeft[p] -= 1;
          lastAction = { seat: p, type: 'wall', x: d.x, y: d.y, vertical: d.vertical };
        }

        return attachView({
          ...s,
          pawns,
          hWalls,
          vWalls,
          wallsLeft,
          turn: reason ? -1 : (p + 1) % n,
          lastAction,
          winner,
          reason,
        });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        // 各席のゴールまでの最短経路長。到達不能 (通常は起きない) は 99 とする
        return new Int32Array(
          Array.from({ length: s.n }, (_, seat) => {
            const len = quoridorPathLength(s, seat);
            return len < 0 ? 99 : len;
          }),
        );
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      if (legal.length === 0) return -1;
      const lv = brainLevel(level);
      const pawnMoves = legal.filter((m) => m < QUORIDOR_WALL_BASE);
      const wallMoves = legal.filter((m) => m >= QUORIDOR_WALL_BASE);

      // 自分の最短経路を1手で一番短くするコマ移動を選ぶ (同点は先勝ちで決定的に)
      const bestAdvance = () => {
        let best = -1;
        let bestLen = Infinity;
        for (const m of pawnMoves) {
          const next = rules.play(s, m);
          const len = quoridorPathLength(next, seat);
          const score = len < 0 ? 99 : len;
          if (score < bestLen) { bestLen = score; best = m; }
        }
        return best;
      };

      if (lv === 0) {
        return legal[rngInt(rng, legal.length)];
      }
      if (lv === 1 || wallMoves.length === 0) {
        const adv = bestAdvance();
        return adv >= 0 ? adv : legal[rngInt(rng, legal.length)];
      }

      // レベル2: 一番ゴールに近い相手が自分より近い場合だけ、壁でその相手を遅らせる。
      // 壁候補の全探索 (最大128通り×全員のBFS) は重いので、候補を絞る:
      // 相手の最短経路 (BFS の経路) に含まれる辺を遮る壁だけを候補にする
      // (1つの辺を遮る壁は最大2通り。経路は長くても数十マスなので候補は数十以下になる)。
      const myLen = quoridorPathLength(s, seat);
      let threat = -1;
      let threatLen = Infinity;
      for (let o = 0; o < s.n; o++) {
        if (o === seat) continue;
        const len = quoridorPathLength(s, o);
        if (len >= 0 && len < threatLen) { threatLen = len; threat = o; }
      }
      if (threat >= 0 && threatLen < myLen) {
        const path = bfsPath(s, threat);
        if (path) {
          const candSet = new Set();
          for (let i = 0; i + 1 < path.length; i++) {
            const a = { x: path[i] % 9, y: Math.floor(path[i] / 9) };
            const b = { x: path[i + 1] % 9, y: Math.floor(path[i + 1] / 9) };
            if (b.y === a.y + 1 || b.y === a.y - 1) {
              // 縦の辺: その境界を遮る横壁は、列が a.x と a.x-1 の2通り
              const wy = Math.min(a.y, b.y);
              for (const wx of [a.x, a.x - 1]) {
                if (wx >= 0 && wx <= 7) candSet.add(QUORIDOR_WALL_BASE + (wy * 8 + wx) * 2);
              }
            } else {
              // 横の辺: その境界を遮る縦壁は、行が a.y と a.y-1 の2通り
              const wx = Math.min(a.x, b.x);
              for (const wy of [a.y, a.y - 1]) {
                if (wy >= 0 && wy <= 7) candSet.add(QUORIDOR_WALL_BASE + (wy * 8 + wx) * 2 + 1);
              }
            }
          }
          let bestWall = -1;
          let bestGain = 0; // 相手の経路の伸び (1以上でないと置かない)
          let bestOwn = Infinity; // その時の自分の経路長 (小さい方を優先)
          for (const m of candSet) {
            if (!wallMoves.includes(m)) continue;
            const next = rules.play(s, m);
            const oppAfter = quoridorPathLength(next, threat);
            const ownAfter = quoridorPathLength(next, seat);
            if (oppAfter < 0 || ownAfter < 0) continue; // 合法手なので起きないはずだが保険
            if (ownAfter > myLen) continue; // 自分の経路を塞ぐ (伸ばす) 壁は置かない
            const gain = oppAfter - threatLen;
            if (gain > bestGain || (gain === bestGain && gain > 0 && ownAfter < bestOwn)) {
              bestGain = gain;
              bestOwn = ownAfter;
              bestWall = m;
            }
          }
          if (bestWall >= 0) return bestWall;
        }
      }
      const adv = bestAdvance();
      return adv >= 0 ? adv : legal[rngInt(rng, legal.length)];
    },
  },
};
