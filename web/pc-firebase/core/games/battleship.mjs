import { brainLevel, rngFloat, rngInt, withView } from './_utils.mjs';

/**
 * バトルシップ / 海戦ゲーム (Battleship) — 2人専用
 * お互いに 10×10 の盤面を持ち、長さ [5,4,3,3,2] の 5 隻の艦を相手に見えないように
 * 縦横に配置する。配置が終わったら交互に相手盤面の座標を 1 つ指定して攻撃し、
 * 艦のあるマスはヒット、無ければミス。1 隻の全マスがヒットしたら撃沈。
 * 先に相手の全艦を撃沈した人の勝ち。
 *
 * 進行: フェーズ 'place'(配置。席0が5隻→席1が5隻の順番制) → 'battle'(攻撃) → 終了。
 * 手の符号化:
 * - 配置: move = shipIdx*1000 + dir*100 + (y*10+x)。dir 0=横(右へ), 1=縦(下へ)。
 * - 攻撃: move = y*10+x (0〜99、相手盤面の座標)。既に撃ったマスは非合法。
 * 重なり・盤外の配置は禁止。
 *
 * オプション / ローカルルール:
 * - salvo: 'off'(標準: 1手番1発) / 'on'(一斉射撃サルボ: 自分の未撃沈の艦の数だけ
 *   1手番に連続発射できる。状態の shotsLeft が残り発射数)
 * - chain: 'off'(標準) / 'on'(連続攻撃: ヒットしたら追加でもう1発撃てる)
 *   ※ salvo と併用時: ヒットでは shotsLeft が減らない(=追加発射)扱いとする。
 *     ミスは通常どおり shotsLeft を 1 消費する。
 * - noAdjacent: 'off'(標準: 制限なし) / 'ortho'(自艦同士が上下左右に隣接する配置禁止)
 *   / 'all'(斜めも含め隣接禁止)
 *
 * 隠し情報: 相手の艦の位置は view に含めない。敵盤面は自分が撃った結果のみ
 * (未攻撃=unknown / ミス / ヒット / 撃沈した艦のマスは ship として公開)。
 * 観戦者(me=-1 等)には両者の艦位置を出さず、撃沈した艦だけを公開する。
 * 配置フェーズの lastAction(座標)は、配置した本人以外には座標を伏せて渡す。
 */

export const BATTLESHIP_FLEET = [5, 4, 3, 3, 2];
export const BATTLESHIP_SIZE = 10;

// 艦 shipIdx を (x,y) から dir 方向に置いた時のマス一覧 (盤外・不正なら空配列)
export function shipCells(shipIdx, dir, x, y) {
  const len = BATTLESHIP_FLEET[shipIdx];
  if (!len || (dir !== 0 && dir !== 1) || !Number.isInteger(x) || !Number.isInteger(y)) return [];
  const cells = [];
  for (let i = 0; i < len; i++) {
    const cx = dir === 0 ? x + i : x;
    const cy = dir === 0 ? y : y + i;
    if (cx < 0 || cx >= BATTLESHIP_SIZE || cy < 0 || cy >= BATTLESHIP_SIZE) return [];
    cells.push(cy * BATTLESHIP_SIZE + cx);
  }
  return cells;
}

export function encodePlaceMove(shipIdx, dir, x, y) {
  return shipIdx * 1000 + dir * 100 + (y * 10 + x);
}

export function decodePlaceMove(move) {
  if (!Number.isInteger(move) || move < 0) return null;
  const pos = move % 100;
  const dir = Math.floor(move / 100) % 10;
  const shipIdx = Math.floor(move / 1000);
  if (shipIdx < 0 || shipIdx >= BATTLESHIP_FLEET.length || (dir !== 0 && dir !== 1)) return null;
  return { shipIdx, dir, x: pos % 10, y: Math.floor(pos / 10) };
}

// liarsdice.mjs と同じ xorshift。play() 内では乱数を使わないが、
// 将来の拡張と initial の種生成のために同じ方式をそろえておく。
function nextRng(state) {
  let x = (state | 0) || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = x >>> 0;
  return { state: u || 1, value: u / 4294967296 };
}

export const BATTLESHIP_SPEC = {
  id: 'battleship',
  no: 51,
  name: 'バトルシップ',
  category: 'BOARD',
  players: '2人',
  intro: '相手に見えないように艦を配置し、座標を読み合って全艦撃沈を目指す海戦ゲーム！',
  seatNames: ['1番', '2番'],
  undoAllowed: false,
  seatsFor: () => 2,
  options: [
    { key: 'salvo', label: '一斉射撃(サルボ)', default: 'off', group: 'local', hint: '自分の残っている艦の数だけ、1手番にまとめて撃てる', values: [['off', 'なし(1手番1発)'], ['on', 'あり']] },
    { key: 'chain', label: '連続攻撃', default: 'off', group: 'local', hint: 'ヒットしたら続けてもう1発撃てる(サルボ併用時はヒットで発射数が減らない)', values: [['off', 'なし'], ['on', 'あり']] },
    { key: 'noAdjacent', label: '艦同士の隣接禁止', default: 'off', group: 'local', values: [['off', '制限なし'], ['ortho', '上下左右は禁止'], ['all', '斜めも含め禁止']] },
  ],
  sections: [
    ['概要と目的', 'お互いに10×10の盤面を持ち、長さ5・4・3・3・2の艦を5隻、相手に見えないように配置します。交互に相手の盤面の座標を指定して攻撃し、先に相手の艦をすべて撃沈した人の勝ちです。'],
    ['配置と攻撃', '配置は1番の人から順に、5隻すべてを置きます。重なる配置や盤からはみ出す配置はできません。攻撃で艦のあるマスはヒット、無いマスはミスとなり、1隻の全マスがヒットすると撃沈します。'],
    ['ローカルルール', '・一斉射撃(サルボ): 自分の残っている艦の数だけ1手番に撃てる\n・連続攻撃: ヒットしたらもう1発撃てる\n・隣接禁止: 自分の艦同士が隣り合う配置を禁止する(上下左右のみ / 斜めも含む)'],
  ],
  makeRules(opts) {
    const salvo = opts.jt('salvo', 'off') === 'on';
    const chain = opts.jt('chain', 'off') === 'on';
    const noAdjacent = opts.jt('noAdjacent', 'off'); // 'off' | 'ortho' | 'all'

    const aliveCount = (ships, shotsByFoe) =>
      ships.filter((cells) => cells && !cells.every((c) => shotsByFoe[c] === 2)).length;

    const shipAt = (ships, cell) => ships.findIndex((cells) => cells && cells.includes(cell));

    const isSunk = (ships, idx, shotsByFoe) =>
      !!(ships[idx] && ships[idx].every((c) => shotsByFoe[c] === 2));

    function placementOk(ships, shipIdx, cells) {
      const occupied = new Map(); // cell -> shipIdx (配置済みの自艦)
      ships.forEach((cs, i) => { if (cs && i !== shipIdx) cs.forEach((c) => occupied.set(c, i)); });
      for (const c of cells) if (occupied.has(c)) return false;
      if (noAdjacent !== 'off') {
        const dirs = noAdjacent === 'all'
          ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const c of cells) {
          const x = c % 10, y = Math.floor(c / 10);
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
            if (occupied.has(ny * 10 + nx)) return false;
          }
        }
      }
      return true;
    }

    function attachView(state) {
      return withView(state, (r, me, st) => {
        const valid = me === 0 || me === 1;
        const foe = valid ? 1 - me : -1;

        // 自盤面: 自艦の配置 + 相手から撃たれた結果
        let ownBoard = null;
        if (valid) {
          ownBoard = Array.from({ length: 100 }, (_, c) => {
            const hasShip = shipAt(st.ships[me], c) >= 0;
            const shot = st.shotsBy[foe][c];
            if (shot === 2) return 'hit';
            if (shot === 1) return 'miss';
            return hasShip ? 'ship' : 'water';
          });
        }
        // 敵盤面: 自分が撃った結果のみ。未発見の艦位置は出さない。
        let enemyBoard = null;
        if (valid) {
          enemyBoard = Array.from({ length: 100 }, (_, c) => {
            const shot = st.shotsBy[me][c];
            if (shot === 0) return 'unknown';
            if (shot === 1) return 'miss';
            const idx = shipAt(st.ships[foe], c);
            return idx >= 0 && isSunk(st.ships[foe], idx, st.shotsBy[me]) ? 'ship' : 'hit';
          });
        }
        // 艦ごとの状態。自分の艦は全公開、相手は撃沈した艦のみ長さとマスを公開。
        const shipInfo = (owner, viewer) => st.ships[owner].map((cells, idx) => {
          const sunk = isSunk(st.ships[owner], idx, st.shotsBy[1 - owner]);
          if (viewer === owner) {
            return { index: idx, length: BATTLESHIP_FLEET[idx], placed: !!cells, sunk, cells: cells ? cells.slice() : null };
          }
          return sunk
            ? { index: idx, length: BATTLESHIP_FLEET[idx], placed: true, sunk: true, cells: cells.slice() }
            : { index: idx, length: null, placed: null, sunk: false, cells: null };
        });

        // 配置の lastAction は座標が隠し情報なので、本人以外には伏せる
        let lastAction = st.lastAction;
        if (lastAction && lastAction.type === 'place' && lastAction.seat !== me) {
          lastAction = { seat: lastAction.seat, type: 'place', shipIdx: lastAction.shipIdx };
        }

        return JSON.stringify({
          kind: 'battleship',
          me: valid ? me : -1,
          phase: st.phase,
          turn: st.reason ? -1 : st.turn,
          ownBoard,
          enemyBoard,
          myShips: valid ? shipInfo(me, me) : null,
          enemyShips: valid ? shipInfo(foe, me) : null,
          // 観戦者向け: 両者とも撃沈した艦だけ公開
          publicShips: valid ? null : [shipInfo(0, -1), shipInfo(1, -1)],
          placedShips: valid ? st.ships[me].map((c, i) => (c ? i : -1)).filter((i) => i >= 0) : null,
          placedCounts: st.ships.map((ss) => ss.filter(Boolean).length),
          shotsLeft: st.phase === 'battle' ? st.shotsLeft : 0,
          lastAction,
          winner: st.winner,
          reason: st.reason,
        });
      });
    }

    return {
      playerCount: 2,
      initial(rng) {
        const seed = Math.floor(rngFloat(rng) * 4294967296) >>> 0;
        return attachView({
          phase: 'place',
          ships: [Array(5).fill(null), Array(5).fill(null)],
          shotsBy: [Array(100).fill(0), Array(100).fill(0)],
          turn: 0,
          shotsLeft: 0,
          rngState: seed || 1,
          lastAction: null,
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
        if (s.phase === 'place') {
          const ships = s.ships[s.turn];
          for (let idx = 0; idx < 5; idx++) {
            if (ships[idx]) continue;
            for (let dir = 0; dir < 2; dir++) {
              for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 10; x++) {
                  const cells = shipCells(idx, dir, x, y);
                  if (cells.length && placementOk(ships, idx, cells)) moves.push(encodePlaceMove(idx, dir, x, y));
                }
              }
            }
          }
        } else if (s.phase === 'battle') {
          const shots = s.shotsBy[s.turn];
          for (let c = 0; c < 100; c++) if (shots[c] === 0) moves.push(c);
        }
        return new Int32Array(moves);
      },
      isLegal(s, m) {
        return this.legalMoves(s).includes(m);
      },
      play(s, m) {
        const seat = s.turn;
        const ships = s.ships.map((ss) => ss.map((c) => (c ? c.slice() : null)));
        const shotsBy = s.shotsBy.map((a) => a.slice());

        if (s.phase === 'place') {
          const d = decodePlaceMove(m);
          const cells = shipCells(d.shipIdx, d.dir, d.x, d.y);
          ships[seat][d.shipIdx] = cells;
          const lastAction = { seat, type: 'place', shipIdx: d.shipIdx, dir: d.dir, x: d.x, y: d.y, cells: cells.slice() };
          const done = ships[seat].every(Boolean);
          if (!done) return attachView({ ...s, ships, shotsBy, lastAction });
          if (seat === 0) return attachView({ ...s, ships, shotsBy, turn: 1, lastAction });
          // 両者配置完了 → 攻撃開始。先手の shotsLeft を立てる
          return attachView({ ...s, ships, shotsBy, phase: 'battle', turn: 0, shotsLeft: salvo ? aliveCount(ships[0], shotsBy[1]) : 1, lastAction });
        }

        // battle
        const foe = 1 - seat;
        const hitIdx = shipAt(ships[foe], m);
        const hit = hitIdx >= 0;
        shotsBy[seat][m] = hit ? 2 : 1;
        const sunk = hit && isSunk(ships[foe], hitIdx, shotsBy[seat]);
        const lastAction = {
          seat, type: 'shot', cell: m, x: m % 10, y: Math.floor(m / 10),
          hit, sunk, sunkLength: sunk ? BATTLESHIP_FLEET[hitIdx] : null, shipIdx: hit ? hitIdx : null,
        };

        const allSunk = ships[foe].every((_, i) => isSunk(ships[foe], i, shotsBy[seat]));
        if (allSunk) {
          return attachView({
            ...s, ships, shotsBy, phase: 'done', shotsLeft: 0, lastAction,
            winner: seat, reason: `${seat + 1}番が相手の全艦を撃沈しました`,
          });
        }

        let turn = seat;
        let shotsLeft = s.shotsLeft;
        if (salvo) {
          // chain 併用時: ヒットでは消費しない。ミスでのみ 1 消費する
          if (!(hit && chain)) shotsLeft -= 1;
          if (shotsLeft <= 0) {
            turn = foe;
            shotsLeft = aliveCount(ships[turn], shotsBy[seat]);
          }
        } else if (chain && hit) {
          shotsLeft = 1; // 追加でもう1発
        } else {
          turn = foe;
          shotsLeft = 1;
        }
        return attachView({ ...s, ships, shotsBy, turn, shotsLeft, lastAction });
      },
      outcome(s) {
        return s.reason ? { ys_1: s.winner, zs_1: s.reason } : null;
      },
      scores(s) {
        return new Int32Array([0, 1].map((seat) =>
          s.ships[1 - seat].filter((_, i) => isSunk(s.ships[1 - seat], i, s.shotsBy[seat])).length));
      },
    };
  },
  brain: {
    choose(rules, s, seat, level, rng) {
      const legal = Array.from(rules.legalMoves(s));
      if (!legal.length) return -1;
      const lv = brainLevel(level);
      if (s.phase === 'place' || lv <= 0) {
        return legal[rngInt(rng, legal.length)];
      }
      // 攻撃: 自分が撃った結果だけから判断する(相手の艦位置は見ない)
      const shots = s.shotsBy[seat];
      const foeShips = s.ships[1 - seat];
      const sunkCells = new Set();
      foeShips.forEach((cells, i) => {
        if (cells && cells.every((c) => shots[c] === 2)) cells.forEach((c) => sunkCells.add(c));
      });
      const openHits = [];
      for (let c = 0; c < 100; c++) if (shots[c] === 2 && !sunkCells.has(c)) openHits.push(c);
      const legalSet = new Set(legal);

      if (openHits.length) {
        // ターゲットモード: ヒット中の艦の周囲。並んだヒットの延長を優先する
        const hitSet = new Set(openHits);
        const extended = [];
        const neighbors = [];
        for (const c of openHits) {
          const x = c % 10, y = Math.floor(c / 10);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
            const nc = ny * 10 + nx;
            const px = x - dx, py = y - dy;
            if (px >= 0 && px < 10 && py >= 0 && py < 10 && hitSet.has(py * 10 + px) && legalSet.has(nc)) extended.push(nc);
            if (legalSet.has(nc)) neighbors.push(nc);
          }
        }
        const pool = extended.length ? extended : neighbors;
        if (pool.length) return pool[rngInt(rng, pool.length)];
      }
      // ハントモード: 未ヒットの艦がありそうなマスを市松模様で狙う
      const checker = legal.filter((c) => ((c % 10) + Math.floor(c / 10)) % 2 === 0);
      const pool = checker.length ? checker : legal;
      return pool[rngInt(rng, pool.length)];
    },
  },
};
