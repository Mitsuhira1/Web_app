package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.AlphaBeta
import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.ThreadLocal
import kotlin.random.Random

/**
 * チェッカー(アメリカンルール、8×8 の黒マスだけを使う)。席0=黒(先手、下から上へ)、席1=白(上から下へ)。
 * cells[r*8+c]: 0=空 1=黒 2=黒キング 3=白 4=白キング。
 * ・ふつうのコマは斜め前へ1マス。キングは斜め前後へ1マス。
 * ・取れる時は必ず取る(どの取り方を選んでもよい)。取った後さらに取れるなら続けて跳ぶ。ふつうのコマは前にしか跳べない。
 * ・相手の一番奥の段に着いたらキングになる(跳んでいる途中でなったら、その手はそこで終わり)。
 * ・相手のコマを全部取るか、相手が動けなくなったら勝ち。取り合いなしで80手続いたら引き分け。
 * 手は、この局面の合法手(道筋)を決まった順に並べた時の番号。
 */
class CheckersState(val cells: IntArray, val turn: Int, val quiet: Int, val winner: Int, val over: Boolean, val lastPath: IntArray) {
    /** この局面の合法手の道筋(先頭が元のマス、続いて止まるマス)。決まった順に並ぶ */
    val paths: List<IntArray> by lazy(LazyThreadSafetyMode.PUBLICATION) { if (over) emptyList() else Checkers.generate(cells, turn) }
}

object Checkers : Rules<CheckersState> {
    const val QUIET_LIMIT = 80
    override val playerCount = 2

    override fun initial(rng: Random): CheckersState {
        val c = IntArray(64)
        for (r in 0 until 8) for (col in 0 until 8) {
            if ((r + col) % 2 == 0) continue
            if (r <= 2) c[r * 8 + col] = 3
            if (r >= 5) c[r * 8 + col] = 1
        }
        return CheckersState(c, 0, 0, -1, false, IntArray(0))
    }

    fun owner(v: Int): Int = when (v) { 1, 2 -> 0; 3, 4 -> 1; else -> -1 }
    fun isKing(v: Int) = v == 2 || v == 4

    private fun dirs(v: Int): List<Pair<Int, Int>> = when (v) {
        1 -> listOf(-1 to -1, -1 to 1)
        3 -> listOf(1 to -1, 1 to 1)
        else -> listOf(-1 to -1, -1 to 1, 1 to -1, 1 to 1)
    }

    fun generate(cells: IntArray, turn: Int): List<IntArray> {
        val jumps = ArrayList<IntArray>()
        for (i in 0 until 64) if (owner(cells[i]) == turn) jumpFrom(cells, i, cells[i], listOf(i), HashSet(), jumps)
        val list = if (jumps.isNotEmpty()) jumps else {
            val simple = ArrayList<IntArray>()
            for (i in 0 until 64) {
                val v = cells[i]
                if (owner(v) != turn) continue
                for ((dr, dc) in dirs(v)) {
                    val r = i / 8 + dr
                    val c = i % 8 + dc
                    if (r in 0..7 && c in 0..7 && cells[r * 8 + c] == 0) simple.add(intArrayOf(i, r * 8 + c))
                }
            }
            simple
        }
        return list.sortedWith { a, b ->
            var k = 0
            while (k < a.size && k < b.size && a[k] == b[k]) k++
            if (k < a.size && k < b.size) a[k] - b[k] else a.size - b.size
        }
    }

    private fun jumpFrom(cells: IntArray, at: Int, piece: Int, path: List<Int>, taken: HashSet<Int>, out: ArrayList<IntArray>) {
        var extended = false
        val r0 = at / 8
        val c0 = at % 8
        val me = owner(piece)
        for ((dr, dc) in dirs(piece)) {
            val mr = r0 + dr
            val mc = c0 + dc
            val lr = r0 + 2 * dr
            val lc = c0 + 2 * dc
            if (lr !in 0..7 || lc !in 0..7) continue
            val mid = mr * 8 + mc
            val land = lr * 8 + lc
            val midV = cells[mid]
            if (owner(midV) != 1 - me || mid in taken) continue
            // 着地点は空き(動いているコマ自身の元の位置も空きとみなす)
            if (cells[land] != 0 && land != path[0]) continue
            extended = true
            val promotes = !isKing(piece) && ((me == 0 && lr == 0) || (me == 1 && lr == 7))
            taken.add(mid)
            val next = path + land
            if (promotes) out.add(next.toIntArray()) else jumpFrom(cells, land, piece, next, taken, out)
            taken.remove(mid)
        }
        if (!extended && path.size > 1) out.add(path.toIntArray())
    }

    override fun toMove(s: CheckersState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: CheckersState): IntArray = IntArray(s.paths.size) { it }

    override fun isLegal(s: CheckersState, m: Int): Boolean = !s.over && m in s.paths.indices

    override fun play(s: CheckersState, m: Int): CheckersState {
        val path = s.paths[m]
        val cells = s.cells.copyOf()
        val from = path[0]
        var piece = cells[from]
        cells[from] = 0
        var captured = false
        for (k in 1 until path.size) {
            val a = path[k - 1]
            val b = path[k]
            if (kotlin.math.abs(a / 8 - b / 8) == 2) {
                cells[(a / 8 + b / 8) / 2 * 8 + (a % 8 + b % 8) / 2] = 0
                captured = true
            }
        }
        val to = path.last()
        if (piece == 1 && to / 8 == 0) piece = 2
        if (piece == 3 && to / 8 == 7) piece = 4
        cells[to] = piece
        val quiet = if (captured) 0 else s.quiet + 1
        val next = 1 - s.turn
        val nextPaths = generate(cells, next)
        return when {
            nextPaths.isEmpty() -> CheckersState(cells, next, quiet, s.turn, true, path)
            quiet >= QUIET_LIMIT -> CheckersState(cells, next, quiet, -1, true, path)
            else -> CheckersState(cells, next, quiet, -1, false, path)
        }
    }

    override fun outcome(s: CheckersState): Outcome? {
        if (!s.over) return null
        return if (s.winner < 0) Outcome(-1, "取り合いなしで${QUIET_LIMIT}手続きました") else Outcome(s.winner, "")
    }

    override fun scores(s: CheckersState): IntArray = intArrayOf(s.cells.count { owner(it) == 0 }, s.cells.count { owner(it) == 1 })

    /** 手の番号から道筋を得る(画面用) */
    fun pathOf(s: CheckersState, m: Int): IntArray? = s.paths.getOrNull(m)

    // ---- CPU ----
    fun evaluate(s: CheckersState, me: Int): Int {
        var score = 0
        for (i in 0 until 64) {
            val v = s.cells[i]
            if (v == 0) continue
            val r = i / 8
            val c = i % 8
            var p = if (isKing(v)) 165 else 100
            if (!isKing(v)) p += if (owner(v) == 0) (7 - r) * 4 else r * 4 // 前へ進んだほど良い
            if (c in 2..5 && r in 2..5) p += 6
            if (!isKing(v) && ((owner(v) == 0 && r == 7) || (owner(v) == 1 && r == 0))) p += 8 // 奥の段の守り
            score += if (owner(v) == me) p else -p
        }
        return score
    }

    private val search = ThreadLocal.withInitial { AlphaBeta(Checkers, ::evaluate) }

    val brain = Brain<CheckersState> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        when (level) {
            Level.EASY -> search.get().pick(s, seat, 2, budget, rng, temp = 40)
            Level.NORMAL -> search.get().pick(s, seat, 3, budget, rng, temp = 15)
            Level.HARD -> search.get().pick(s, seat, 6, budget, rng, temp = 8) // 上手な人くらい
        }
    }

    val def = GameDef("checkers", { Checkers }, brain)
}
