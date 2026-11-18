import { brainLevel, pickRandom, shuffle, withView } from './_utils.mjs';

const COLORS = ['red', 'blue', 'black', 'yellow'];

export function tileColor(id) {
  if (id >= 104) return 4;
  return Math.floor((id % 52) / 13);
}

export function tileNum(id) {
  if (id >= 104) return 0;
  return (id % 13) + 1;
}

export function tileObj(id) {
  if (id >= 104) return { id, n: 0, c: 4, t: 'JOKER' };
  const c = tileColor(id);
  const n = tileNum(id);
  return { id, n, c, t: String(n) };
}

function evalSet(set) {
  if (!set || set.length < 3) return { valid: false, sum: 0 };
  const jokers = set.filter((id) => id >= 104).length;
  const tiles = set.filter((id) => id < 104);
  if (tiles.length === 0) return { valid: false, sum: 0 };

  // Check Group (same number, distinct colors, len <= 4)
  if (set.length <= 4) {
    const n0 = tileNum(tiles[0]);
    const cols = new Set();
    let sameNum = true;
    for (const t of tiles) {
      if (tileNum(t) !== n0 || cols.has(tileColor(t))) {
        sameNum = false;
        break;
      }
      cols.add(tileColor(t));
    }
    if (sameNum) {
      return { valid: true, sum: n0 * set.length, type: 'group' };
    }
  }

  // Check Run (same color, consecutive numbers, len <= 13)
  if (set.length <= 13) {
    const c0 = tileColor(tiles[0]);
    const nums = [];
    let sameCol = true;
    for (const t of tiles) {
      if (tileColor(t) !== c0) {
        sameCol = false;
        break;
      }
      nums.push(tileNum(t));
    }
    if (sameCol) {
      nums.sort((a, b) => a - b);
      let dup = false;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1]) { dup = true; break; }
      }
      if (!dup) {
        const minN = nums[0];
        const maxN = nums[nums.length - 1];
        const span = maxN - minN + 1;
        const neededJokers = span - nums.length;
        if (neededJokers <= jokers) {
          // Compute sum assigning remaining jokers to extend right up to 13, then left down to 1
          let rem = jokers - neededJokers;
          let lo = minN;
          let hi = maxN;
          while (rem > 0 && hi < 13) { hi++; rem--; }
          while (rem > 0 && lo > 1) { lo--; rem--; }
          if (rem === 0) {
            const sum = ((lo + hi) * (hi - lo + 1)) / 2;
            return { valid: true, sum, type: 'run' };
          }
        }
      }
    }
  }

  return { valid: false, sum: 0 };
}

function tilePenalty(id, jokerPenalty) {
  return id >= 104 ? jokerPenalty : tileNum(id);
}

function makeRummikubRules(opts, rng) {
  const players = Math.max(2, Math.min(4, opts.it('players', 2)));
  const needInitial30 = opts.jt('initialMeld', '30') === '30';
  const jokerPenalty = opts.it('jokerPenalty', 30);

  function cloneTable(t) {
    return t.map((set) => set.slice());
  }

  function attach(s) {
    return withView(s, (_rules, me) => {
      const revealAll = s.winner !== null || me === -1;
      return JSON.stringify({
        kind: 'rummikub',
        me,
        players,
        turn: s.turn,
        poolCount: s.pool.length,
        table: s.table.map((set) => set.map(tileObj)),
        rackCounts: s.racks.map((r) => r.length),
        racks: s.racks.map((r, i) => (revealAll || i === me ? r.map(tileObj) : [])),
        initialDone: s.initialDone,
        selected: s.selected,
        newlyPlayed: Array.from(s.newlyPlayed),
        needInitial30,
        lastAction: s.lastAction,
      });
    });
  }

  return {
    playerCount: players,
    needInitial30,
    initial(initRng) {
      const r = initRng || rng;
      const deck = [];
      for (let i = 0; i < 106; i++) deck.push(i);
      const shuffled = shuffle(deck, r);
      const racks = [];
      let idx = 0;
      for (let p = 0; p < players; p++) {
        const hand = shuffled.slice(idx, idx + 14).sort((a, b) => {
          const na = tileNum(a);
          const nb = tileNum(b);
          return na !== nb ? na - nb : tileColor(a) - tileColor(b);
        });
        racks.push(hand);
        idx += 14;
      }
      const pool = shuffled.slice(idx);
      const table = [];
      const initialDone = new Array(players).fill(!needInitial30);
      return attach({
        players,
        pool,
        table,
        racks,
        initialDone,
        turn: 0,
        passes: 0,
        selected: null,
        newlyPlayed: new Set(),
        snapshot: {
          table: [],
          rack: racks[0].slice(),
          baseTableLen: 0,
        },
        winner: null,
        reason: '',
        lastAction: '',
      });
    },
    toMove(s) {
      return s.turn;
    },
    canCommit(s) {
      if (s.newlyPlayed.size === 0) return false;
      const nonEmpty = s.table.filter((set) => set.length > 0);
      if (nonEmpty.length === 0) return false;
      for (const set of nonEmpty) {
        if (!evalSet(set).valid) return false;
      }
      if (!s.initialDone[s.turn]) {
        // Must only add new sets >= 30 total without modifying pre-existing sets
        for (let i = 0; i < s.snapshot.baseTableLen; i++) {
          const orig = s.snapshot.table[i];
          const cur = s.table[i] || [];
          if (orig.length !== cur.length || orig.some((v, idx) => v !== cur[idx])) {
            return false;
          }
        }
        let sum = 0;
        for (let i = s.snapshot.baseTableLen; i < s.table.length; i++) {
          if (s.table[i].length > 0) sum += evalSet(s.table[i]).sum;
        }
        if (sum < 30) return false;
      }
      return true;
    },
    legalMoves(s) {
      if (s.winner !== null) return [];
      const moves = [0]; // draw / pass
      if (this.canCommit(s)) moves.push(1);
      if (s.newlyPlayed.size > 0 || s.selected !== null) moves.push(2);

      const rack = s.racks[s.turn];
      for (let r = 0; r < rack.length; r++) {
        moves.push(100 + r);
      }

      const startSet = s.initialDone[s.turn] ? 0 : s.snapshot.baseTableLen;
      for (let si = startSet; si < s.table.length; si++) {
        for (let ti = 0; ti < s.table[si].length; ti++) {
          moves.push(2000 + si * 32 + ti);
        }
      }

      if (s.selected) {
        for (let si = startSet; si < s.table.length; si++) {
          moves.push(500 + si);
        }
        moves.push(599);
        if (s.selected.src === 'table') {
          const tid = s.table[s.selected.setIdx]?.[s.selected.tileIdx];
          if (tid !== undefined && s.newlyPlayed.has(tid)) {
            moves.push(600);
          }
        }
      }
      return moves;
    },
    isLegal(s, m) {
      return this.legalMoves(s).includes(m);
    },
    play(s, m) {
      const racks = s.racks.map((r) => r.slice());
      let table = cloneTable(s.table);
      const pool = s.pool.slice();
      const initialDone = s.initialDone.slice();
      const newlyPlayed = new Set(s.newlyPlayed);

      const finishTurn = (nextTurn, passes, lastAction, winner = null, reason = '') => {
        const cleanTable = table.filter((set) => set.length > 0);
        return attach({
          players,
          pool,
          table: cleanTable,
          racks,
          initialDone,
          turn: nextTurn,
          passes,
          selected: null,
          newlyPlayed: new Set(),
          snapshot: {
            table: cloneTable(cleanTable),
            rack: racks[nextTurn].slice(),
            baseTableLen: cleanTable.length,
          },
          winner,
          reason,
          lastAction,
        });
      };

      if (m === 0) {
        // Restore snapshot, draw 1 tile if pool > 0
        table = cloneTable(s.snapshot.table);
        racks[s.turn] = s.snapshot.rack.slice();
        let act = `P${s.turn + 1} パス`;
        let passes = s.passes + 1;
        if (pool.length > 0) {
          const drawn = pool.shift();
          racks[s.turn].push(drawn);
          racks[s.turn].sort((a, b) => (tileNum(a) - tileNum(b)) || (tileColor(a) - tileColor(b)));
          act = `P${s.turn + 1} が山から1枚引きました`;
          passes = 0;
        }
        if (passes >= players) {
          // Deadlock: lowest rack penalty wins
          const totals = racks.map((r) => r.reduce((acc, id) => acc + tilePenalty(id, jokerPenalty), 0));
          let best = 0;
          for (let i = 1; i < players; i++) if (totals[i] < totals[best]) best = i;
          return finishTurn(s.turn, passes, act, best, '山札切れ・全員パス（手牌の合計点が最少で勝利）');
        }
        return finishTurn((s.turn + 1) % players, passes, act);
      }

      if (m === 1) {
        // Commit
        initialDone[s.turn] = true;
        const act = `P${s.turn + 1} が ${newlyPlayed.size} 枚出しました`;
        if (racks[s.turn].length === 0) {
          return finishTurn(s.turn, 0, act, s.turn, `P${s.turn + 1} がすべてのタイルを出し切って勝利！`);
        }
        return finishTurn((s.turn + 1) % players, 0, act);
      }

      if (m === 2) {
        // Reset turn
        table = cloneTable(s.snapshot.table);
        racks[s.turn] = s.snapshot.rack.slice();
        return attach({
          ...s,
          table,
          racks,
          selected: null,
          newlyPlayed: new Set(),
          lastAction: 'このターンの操作をリセット',
        });
      }

      if (m >= 100 && m < 500) {
        const r = m - 100;
        return attach({
          ...s,
          selected: { src: 'rack', idx: r },
        });
      }

      if (m >= 2000) {
        const rem = m - 2000;
        const setIdx = Math.floor(rem / 32);
        const tileIdx = rem % 32;
        return attach({
          ...s,
          selected: { src: 'table', setIdx, tileIdx },
        });
      }

      if (m >= 500 && m <= 599 && s.selected) {
        let tileId = -1;
        if (s.selected.src === 'rack') {
          tileId = racks[s.turn].splice(s.selected.idx, 1)[0];
          newlyPlayed.add(tileId);
        } else {
          tileId = table[s.selected.setIdx].splice(s.selected.tileIdx, 1)[0];
        }
        if (m === 599) {
          table.push([tileId]);
        } else {
          table[m - 500].push(tileId);
        }
        return attach({
          ...s,
          table,
          racks,
          newlyPlayed,
          selected: null,
        });
      }

      if (m === 600 && s.selected && s.selected.src === 'table') {
        const tileId = table[s.selected.setIdx].splice(s.selected.tileIdx, 1)[0];
        newlyPlayed.delete(tileId);
        racks[s.turn].push(tileId);
        return attach({
          ...s,
          table,
          racks,
          newlyPlayed,
          selected: null,
        });
      }

      return s;
    },
    outcome(s) {
      return s.winner === null ? null : { winner: s.winner, reason: s.reason };
    },
    scores(s) {
      if (s.winner === null) return null;
      return s.racks.map((r) => -r.reduce((acc, id) => acc + tilePenalty(id, jokerPenalty), 0));
    },
  };
}

function findValidMeldInRack(rack, minSum) {
  // Search groups (3 or 4)
  const byNum = new Map();
  const jokers = [];
  rack.forEach((id, idx) => {
    if (id >= 104) jokers.push(idx);
    else {
      const n = tileNum(id);
      if (!byNum.has(n)) byNum.set(n, []);
      byNum.get(n).push(idx);
    }
  });

  const candidates = [];
  for (const [n, idxs] of byNum.entries()) {
    const byCol = new Map();
    for (const idx of idxs) {
      const c = tileColor(rack[idx]);
      if (!byCol.has(c)) byCol.set(c, idx);
    }
    const uniq = Array.from(byCol.values());
    if (uniq.length >= 3) {
      const sum = n * uniq.length;
      if (sum >= minSum) candidates.push({ idxs: uniq, sum });
    } else if (uniq.length === 2 && jokers.length >= 1) {
      const sum = n * 3;
      if (sum >= minSum) candidates.push({ idxs: [uniq[0], uniq[1], jokers[0]], sum });
    }
  }

  // Search runs (3+)
  const byCol = new Map();
  rack.forEach((id, idx) => {
    if (id >= 104) return;
    const c = tileColor(id);
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c).push(idx);
  });
  for (const idxs of byCol.values()) {
    const byN = new Map();
    for (const idx of idxs) {
      const n = tileNum(rack[idx]);
      if (!byN.has(n)) byN.set(n, idx);
    }
    const sortedN = Array.from(byN.keys()).sort((a, b) => a - b);
    let run = [];
    for (let i = 0; i < sortedN.length; i++) {
      if (run.length === 0 || sortedN[i] === sortedN[i - 1] + 1) {
        run.push(sortedN[i]);
      } else {
        if (run.length >= 3) {
          const sum = run.reduce((a, b) => a + b, 0);
          if (sum >= minSum) candidates.push({ idxs: run.map((n) => byN.get(n)), sum });
        }
        run = [sortedN[i]];
      }
    }
    if (run.length >= 3) {
      const sum = run.reduce((a, b) => a + b, 0);
      if (sum >= minSum) candidates.push({ idxs: run.map((n) => byN.get(n)), sum });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.sum - a.sum || b.idxs.length - a.idxs.length);
  return candidates[0].idxs;
}

function chooseRummikubMove(rules, s, seat, level, rng) {
  const legal = rules.legalMoves(s);
  if (legal.length === 0) return 0;
  const lv = brainLevel(level);
  if (lv <= 0) {
    // Easy CPU still tries to commit if valid, otherwise draws
    if (legal.includes(1)) return 1;
    if (s.selected && s.selected.src === 'rack') return 599;
    return 0;
  }

  // 1. If board is already valid & committable, commit!
  if (legal.includes(1)) return 1;

  const rack = s.racks[seat];
  const minSum = s.initialDone[seat] ? 0 : 30;

  // 2. If a rack tile is currently selected, place it
  if (s.selected && s.selected.src === 'rack') {
    const tid = rack[s.selected.idx];
    // If last set was created this turn and is not yet valid, add to it
    const lastIdx = s.table.length - 1;
    if (lastIdx >= s.snapshot.baseTableLen) {
      const lastSet = s.table[lastIdx];
      if (!evalSet(lastSet).valid && evalSet([...lastSet, tid]).valid) {
        return 500 + lastIdx;
      }
      if (lastSet.length < 3) {
        // Check if adding tid keeps it potentially valid
        return 500 + lastIdx;
      }
    }
    // Check if it extends an existing valid set (only if initialDone)
    if (s.initialDone[seat]) {
      for (let si = 0; si < s.table.length; si++) {
        if (evalSet([...s.table[si], tid]).valid) return 500 + si;
      }
    }
    return 599;
  }

  // 3. If we started building a new set this turn, continue completing it
  if (s.table.length > s.snapshot.baseTableLen) {
    const lastSet = s.table[s.table.length - 1];
    if (!evalSet(lastSet).valid) {
      for (let r = 0; r < rack.length; r++) {
        // Try if adding rack[r] makes it valid or closer to valid
        if (evalSet([...lastSet, rack[r]]).valid) return 100 + r;
      }
      // Try finding a 3-tile meld that includes lastSet
      if (lastSet.length === 1) {
        const meld = findValidMeldInRack([lastSet[0], ...rack], minSum);
        if (meld && meld.includes(0)) {
          const nextIdx = meld.find((x) => x > 0);
          if (nextIdx !== undefined) return 100 + (nextIdx - 1);
        }
      }
      // Otherwise reset and draw
      return 0;
    }
  }

  // 4. Find a fresh meld in rack
  const meld = findValidMeldInRack(rack, minSum);
  if (meld && meld.length >= 3) {
    return 100 + meld[0];
  }

  // 5. If initialDone, try extending an existing table set
  if (s.initialDone[seat]) {
    for (let r = 0; r < rack.length; r++) {
      for (let si = 0; si < s.table.length; si++) {
        if (evalSet([...s.table[si], rack[r]]).valid) return 100 + r;
      }
    }
  }

  return 0;
}

export const RUMMIKUB_SPEC = {
  id: 'rummikub',
  no: 41,
  name: 'ラミィキューブ',
  category: 'BOARD',
  playersText: '2〜4人',
  intro: '1〜13の数字タイルで「同じ数の組」や「連番」を作り、場の組も組み替えながら手牌を出し切る。',
  undoAllowed: false,
  seatsFor: (opts) => Math.max(2, Math.min(4, opts.it('players', 2))),
  seatNames: ['P1', 'P2', 'P3', 'P4'],
  makeRules: makeRummikubRules,
  chooseMove: chooseRummikubMove,
  options: [
    {
      key: 'players',
      label: '人数',
      values: [
        ['2', '2人'],
        ['3', '3人'],
        ['4', '4人'],
      ],
      default: '2',
    },
    {
      key: 'initialMeld',
      label: '初回出し（30点ルール）',
      values: [
        ['30', '合計30点以上必要（標準）'],
        ['off', '制限なし'],
      ],
      default: '30',
    },
    {
      key: 'jokerPenalty',
      label: '残ったジョーカーの減点',
      values: [
        ['30', '30点（標準）'],
        ['50', '50点'],
      ],
      default: '30',
    },
  ],
  sections: [
    { title: '概要と目的', body: '1〜13（4色×2組＝104枚）＋ジョーカー2枚の計106枚のタイルを使います。手牌14枚を最初にすべて場に出し切ったプレイヤーの勝ちです。' },
    { title: '出せる組（メルド）', body: '・グループ：同じ数字で色がすべて異なる3〜4枚（例：赤7・青7・黒7）\n・ラン：同じ色で数字が連続する3枚以上（例：青4・青5・青6・青7）\nジョーカーはどのタイルとしても使えます。' },
    { title: '初回30点ルールと場の組み替え', body: '最初に出すときは、場の組を使わずに自分の手牌だけで合計30点以上の組を出す必要があります（設定でオフ可能）。2回目以降は場の組をバラしたり組み替えたりして手牌を出せます。出せないときは山から1枚引いて手番終了です。' },
  ],
};
