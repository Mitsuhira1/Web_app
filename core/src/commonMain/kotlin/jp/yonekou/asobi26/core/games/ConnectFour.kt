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
 * コネクトフォー(横7列×縦6段)。席0=赤(先手)、席1=黄。手は列番号 0..6。
 * cells[r*7+c]: r=0 が一番下。0=空 1=席0 2=席1。winLine は勝った4マス(なければ空)。
 */
class C4State(val cells: IntArray, val turn: Int, val winner: Int, val full: Boolean, val lastMove: Int, val winLine: IntArray) {
    fun height(col: Int): Int {
        var h = 0
        while (h < ConnectFour.ROWS && cells[h * ConnectFour.COLS + col] != 0) h++
        return h
    }
}

object ConnectFour : Rules<C4State> {
    const val COLS = 7
    const val ROWS = 6
    override val playerCount = 2

    override fun initial(rng: Random) = C4State(IntArray(COLS * ROWS), 0, -1, false, -1, IntArray(0))

    override fun toMove(s: C4State): Int = if (s.winner >= 0 || s.full) -1 else s.turn

    override fun legalMoves(s: C4State): IntArray =
        if (toMove(s) < 0) IntArray(0) else (0 until COLS).filter { s.height(it) < ROWS }.toIntArray()

    override fun isLegal(s: C4State, m: Int): Boolean = toMove(s) >= 0 && m in 0 until COLS && s.height(m) < ROWS

    override fun play(s: C4State, m: Int): C4State {
        val cells = s.cells.copyOf()
        val r = s.height(m)
        val idx = r * COLS + m
        cells[idx] = s.turn + 1
        val line = lineThrough(cells, r, m)
        val full = cells.none { it == 0 }
        return C4State(cells, 1 - s.turn, if (line.isNotEmpty()) s.turn else -1, full && line.isEmpty(), idx, line)
    }

    /** (r,c) を通る4つ以上の並び。あれば最初の4マスを返す。 */
    private fun lineThrough(cells: IntArray, r: Int, c: Int): IntArray {
        val v = cells[r * COLS + c]
        for ((dr, dc) in listOf(0 to 1, 1 to 0, 1 to 1, 1 to -1)) {
            val list = ArrayList<Int>()
            var rr = r
            var cc = c
            while (rr - dr in 0 until ROWS && cc - dc in 0 until COLS && cells[(rr - dr) * COLS + cc - dc] == v) { rr -= dr; cc -= dc }
            while (rr in 0 until ROWS && cc in 0 until COLS && cells[rr * COLS + cc] == v) { list.add(rr * COLS + cc); rr += dr; cc += dc }
            if (list.size >= 4) return list.take(4).toIntArray()
        }
        return IntArray(0)
    }

    override fun outcome(s: C4State): Outcome? = when {
        s.winner >= 0 -> Outcome(s.winner, "")
        s.full -> Outcome(-1, "盤が埋まりました")
        else -> null
    }

    // ---- CPU ----
    /** 4マスの窓ごとに、自分だけ・相手だけの石の数で点をつける。中央の列を少し重く見る。 */
    fun evaluate(s: C4State, me: Int): Int {
        val mine = me + 1
        val opp = 2 - me
        var score = 0
        for (r in 0 until ROWS) if (s.cells[r * COLS + 3] == mine) score += 4 else if (s.cells[r * COLS + 3] == opp) score -= 4
        for ((dr, dc) in listOf(0 to 1, 1 to 0, 1 to 1, 1 to -1)) {
            for (r in 0 until ROWS) for (c in 0 until COLS) {
                val r3 = r + 3 * dr
                val c3 = c + 3 * dc
                if (r3 !in 0 until ROWS || c3 !in 0 until COLS) continue
                var a = 0
                var b = 0
                for (k in 0..3) {
                    val v = s.cells[(r + k * dr) * COLS + c + k * dc]
                    if (v == mine) a++ else if (v == opp) b++
                }
                if (b == 0) score += when (a) { 3 -> 50; 2 -> 8; else -> 0 }
                if (a == 0) score -= when (b) { 3 -> 60; 2 -> 9; else -> 0 }
            }
        }
        return score
    }

    private val ORDER = intArrayOf(3, 2, 4, 1, 5, 0, 6)
    private val search = ThreadLocal.withInitial {
        AlphaBeta(ConnectFour, ::evaluate) { _, moves -> ORDER.filter { it in moves }.toIntArray() }
    }

    val brain = Brain<C4State> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        when (level) {
            // 初級: 目の前の勝ち・負けは見えるが、先の罠は見えない
            Level.EASY -> search.get().pick(s, seat, 2, budget, rng, temp = 45)
            // 中級: 4手先まで読み、最善に近い手から選ぶ(勝てる手・負けを防ぐ手は外さない)
            Level.NORMAL -> search.get().pick(s, seat, 4, budget, rng, temp = 10)
            // 上級: 7手先まで読み、ほぼ最善の手から選ぶ(読み切りはしない。上手な人くらい)
            Level.HARD -> search.get().pick(s, seat, 7, budget, rng, temp = 4)
        }
    }

    val def = GameDef("connect4", { ConnectFour }, brain)
}
