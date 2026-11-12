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
 * リバーシ(8×8)。席0=黒(先手)、席1=白。
 * cells: 0=空 1=黒 2=白。打てる所がない時は「パス」(PASS)だけが合法手になる。両者とも打てなければ終局。
 */
class ReversiState(val cells: IntArray, val turn: Int, val over: Boolean, val lastMove: Int) {
    fun count(color: Int): Int = cells.count { it == color }
}

object Reversi : Rules<ReversiState> {
    const val PASS = 64
    private val DIRS = intArrayOf(-9, -8, -7, -1, 1, 7, 8, 9)

    override val playerCount = 2

    override fun initial(rng: Random): ReversiState {
        val c = IntArray(64)
        c[27] = 2; c[28] = 1; c[35] = 1; c[36] = 2
        return ReversiState(c, 0, false, -1)
    }

    override fun toMove(s: ReversiState): Int = if (s.over) -1 else s.turn

    /** idx に color を置いた時に裏返る石の数(0 なら置けない) */
    fun flips(cells: IntArray, idx: Int, color: Int): Int {
        if (cells[idx] != 0) return 0
        val opp = 3 - color
        var total = 0
        val r0 = idx / 8
        val c0 = idx % 8
        for (d in DIRS) {
            val dr = if (d <= -7) -1 else if (d >= 7) 1 else 0
            val dc = when (d) { -9, -1, 7 -> -1; -7, 1, 9 -> 1; else -> 0 }
            var r = r0 + dr
            var c = c0 + dc
            var n = 0
            while (r in 0..7 && c in 0..7 && cells[r * 8 + c] == opp) { r += dr; c += dc; n++ }
            if (n > 0 && r in 0..7 && c in 0..7 && cells[r * 8 + c] == color) total += n
        }
        return total
    }

    private fun placeable(cells: IntArray, color: Int): IntArray {
        var n = 0
        val tmp = IntArray(64)
        for (i in 0 until 64) if (flips(cells, i, color) > 0) tmp[n++] = i
        return tmp.copyOf(n)
    }

    override fun legalMoves(s: ReversiState): IntArray {
        if (s.over) return IntArray(0)
        val m = placeable(s.cells, s.turn + 1)
        return if (m.isEmpty()) intArrayOf(PASS) else m
    }

    override fun isLegal(s: ReversiState, m: Int): Boolean {
        if (s.over) return false
        if (m == PASS) return placeable(s.cells, s.turn + 1).isEmpty()
        return m in 0..63 && flips(s.cells, m, s.turn + 1) > 0
    }

    override fun play(s: ReversiState, m: Int): ReversiState {
        val color = s.turn + 1
        val cells = s.cells.copyOf()
        if (m != PASS) {
            val r0 = m / 8
            val c0 = m % 8
            for (d in DIRS) {
                val dr = if (d <= -7) -1 else if (d >= 7) 1 else 0
                val dc = when (d) { -9, -1, 7 -> -1; -7, 1, 9 -> 1; else -> 0 }
                var r = r0 + dr
                var c = c0 + dc
                var n = 0
                while (r in 0..7 && c in 0..7 && cells[r * 8 + c] == 3 - color) { r += dr; c += dc; n++ }
                if (n > 0 && r in 0..7 && c in 0..7 && cells[r * 8 + c] == color) {
                    var rr = r0 + dr
                    var cc = c0 + dc
                    repeat(n) { cells[rr * 8 + cc] = color; rr += dr; cc += dc }
                }
            }
            cells[m] = color
        }
        val next = 1 - s.turn
        val over = placeable(cells, next + 1).isEmpty() && placeable(cells, color).isEmpty()
        return ReversiState(cells, next, over, m)
    }

    override fun outcome(s: ReversiState): Outcome? {
        if (!s.over) return null
        val b = s.count(1)
        val w = s.count(2)
        val reason = "黒 $b ・ 白 $w"
        return Outcome(if (b > w) 0 else if (w > b) 1 else -1, reason)
    }

    override fun scores(s: ReversiState): IntArray = intArrayOf(s.count(1), s.count(2))

    // ---- CPU ----
    private val WEIGHTS = intArrayOf(
        100, -25, 10, 5, 5, 10, -25, 100,
        -25, -40, -2, -2, -2, -2, -40, -25,
        10, -2, 2, 1, 1, 2, -2, 10,
        5, -2, 1, 0, 0, 1, -2, 5,
        5, -2, 1, 0, 0, 1, -2, 5,
        10, -2, 2, 1, 1, 2, -2, 10,
        -25, -40, -2, -2, -2, -2, -40, -25,
        100, -25, 10, 5, 5, 10, -25, 100,
    )

    /** 局面の点数。序中盤は位置の重みと打てる場所の数、終盤は石の数を重く見る。 */
    fun evaluate(s: ReversiState, me: Int): Int {
        val mine = me + 1
        val opp = 2 - me
        val empties = s.cells.count { it == 0 }
        var pos = 0
        for (i in 0 until 64) {
            val v = s.cells[i]
            if (v == 0) continue
            var w = WEIGHTS[i]
            // 角を取った後の隣のマスは、もう危なくない
            if (w < 0 && cornerTakenNear(s.cells, i)) w = 3
            pos += if (v == mine) w else -w
        }
        val mob = placeable(s.cells, mine).size - placeable(s.cells, opp).size
        val disc = s.count(mine) - s.count(opp)
        return if (empties <= 12) disc * 20 + pos else pos * 4 + mob * 12 + disc
    }

    private fun cornerTakenNear(cells: IntArray, i: Int): Boolean {
        val r = i / 8
        val c = i % 8
        val cr = if (r < 4) 0 else 7
        val cc = if (c < 4) 0 else 7
        return cells[cr * 8 + cc] != 0
    }

    private val search = ThreadLocal.withInitial {
        AlphaBeta(Reversi, ::evaluate) { s, moves ->
            // 角 → 重みの高い順に読む
            moves.sortedByDescending { if (it == PASS) 0 else WEIGHTS[it] }.toIntArray()
        }
    }

    val brain = Brain<ReversiState> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        val empties = s.cells.count { it == 0 }
        when (level) {
            // 初級: 1手だけ見て、見た目によい所(角・辺・多く返せる所)から迷いながら選ぶ
            Level.EASY -> search.get().pick(s, seat, 1, budget, rng, temp = 60)
            // 中級: 相手の返しまで読む。終盤も読み切らない
            Level.NORMAL -> search.get().pick(s, seat, 2, budget, rng, temp = 20)
            // 上級: 4手先まで読む。最後の8マスだけ数え切る(上手な人くらい)
            Level.HARD -> if (empties <= 8) search.get().pick(s, seat, empties, budget, rng, temp = 2) else search.get().pick(s, seat, 4, budget, rng, temp = 8)
        }
    }

    val def = GameDef("reversi", { Reversi }, brain, passMove = PASS)
}
