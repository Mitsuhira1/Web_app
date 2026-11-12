package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * ヘックス(n×n のひし形の盤。n は 7・9・11)。席0=赤(先手)は上の辺と下の辺を、席1=青は左の辺と右の辺をつなぐ。
 * 手はマスの番号 r*n+c。隣は (r-1,c) (r-1,c+1) (r,c-1) (r,c+1) (r+1,c-1) (r+1,c) の6つ。引き分けはない。
 */
class HexState(val n: Int, val cells: IntArray, val turn: Int, val winner: Int, val lastMove: Int, val winPath: IntArray)

class Hex(val n: Int) : Rules<HexState> {
    override val playerCount = 2

    override fun initial(rng: Random) = HexState(n, IntArray(n * n), 0, -1, -1, IntArray(0))

    override fun toMove(s: HexState): Int = if (s.winner >= 0) -1 else s.turn

    override fun legalMoves(s: HexState): IntArray =
        if (s.winner >= 0) IntArray(0) else (0 until n * n).filter { s.cells[it] == 0 }.toIntArray()

    override fun isLegal(s: HexState, m: Int): Boolean = s.winner < 0 && m in 0 until n * n && s.cells[m] == 0

    override fun play(s: HexState, m: Int): HexState {
        val cells = s.cells.copyOf()
        cells[m] = s.turn + 1
        val path = winningPath(cells, s.turn)
        return HexState(n, cells, 1 - s.turn, if (path.isNotEmpty()) s.turn else -1, m, path)
    }

    fun neighbors(i: Int): IntArray {
        val r = i / n
        val c = i % n
        val out = ArrayList<Int>(6)
        for ((dr, dc) in NB) {
            val rr = r + dr
            val cc = c + dc
            if (rr in 0 until n && cc in 0 until n) out.add(rr * n + cc)
        }
        return out.toIntArray()
    }

    private val nbCache: Array<IntArray> = Array(n * n) { neighbors(it) }

    /** 席 p がつながっていれば、その道筋(最短ではない)を返す */
    fun winningPath(cells: IntArray, p: Int): IntArray {
        val v = p + 1
        val prev = IntArray(n * n) { -2 }
        val queue = IntArray(n * n)
        var head = 0
        var tail = 0
        for (k in 0 until n) {
            val start = if (p == 0) k else k * n
            if (cells[start] == v) { prev[start] = -1; queue[tail++] = start }
        }
        while (head < tail) {
            val x = queue[head++]
            val atGoal = if (p == 0) x / n == n - 1 else x % n == n - 1
            if (atGoal) {
                val path = ArrayList<Int>()
                var y = x
                while (y >= 0) { path.add(y); y = prev[y] }
                return path.toIntArray()
            }
            for (y in nbCache[x]) if (cells[y] == v && prev[y] == -2) { prev[y] = x; queue[tail++] = y }
        }
        return IntArray(0)
    }

    override fun outcome(s: HexState): Outcome? = if (s.winner >= 0) Outcome(s.winner, "") else null

    /** 盤を全部埋めた時に席0がつながっているか(埋まった盤ではどちらか一方が必ずつながる) */
    fun redWinsFilled(cells: IntArray): Boolean = winningPath(cells, 0).isNotEmpty()

    companion object {
        val NB = listOf(-1 to 0, -1 to 1, 0 to -1, 0 to 1, 1 to -1, 1 to 0)

        /**
         * CPU: 残りのマスをランダムに埋める試し打ち(プレイアウト)をくり返し、
         * 「そのマスを自分が取った試し打ちでの勝率」が最も高いマスを選ぶ(AMAF)。回数で強さを変える。
         */
        val brain = Brain<HexState> { rules, s, seat, level, rng, budget ->
            val h = rules as Hex
            val n = h.n
            val empties = (0 until n * n).filter { s.cells[it] == 0 }.toIntArray()
            if (empties.size == 1) return@Brain empties[0]
            if (empties.size == n * n) {
                // 最初の1手は中央付近
                val c = n / 2 * n + n / 2
                return@Brain c
            }
            // すぐ勝てる手
            for (m in empties) {
                val cells = s.cells.copyOf(); cells[m] = seat + 1
                if (h.winningPath(cells, seat).isNotEmpty()) return@Brain m
            }
            // 相手がすぐ勝つ手をふさぐ
            if (level != Level.EASY) {
                for (m in empties) {
                    val cells = s.cells.copyOf(); cells[m] = 2 - seat
                    if (h.winningPath(cells, 1 - seat).isNotEmpty()) return@Brain m
                }
            }
            val maxPlayouts = when (level) { Level.EASY -> 100; Level.NORMAL -> 700; Level.HARD -> 60_000 }
            val wins = IntArray(n * n)
            val tries = IntArray(n * n)
            val work = IntArray(n * n)
            val order = empties.copyOf()
            var done = 0
            while (done < maxPlayouts && !(budget.over() && done >= 100)) {
                s.cells.copyInto(work)
                // 並べ替えて交互に埋める
                for (i in order.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val t = order[i]; order[i] = order[j]; order[j] = t }
                var color = s.turn + 1
                for (x in order) { work[x] = color; color = 3 - color }
                val redWon = h.redWinsFilled(work)
                val iWon = (seat == 0) == redWon
                for (x in empties) if (work[x] == seat + 1) { tries[x]++; if (iWon) wins[x]++ }
                done++
            }
            var best = empties[0]
            var bestRate = -1.0
            for (x in empties) {
                val rate = if (tries[x] == 0) 0.0 else wins[x].toDouble() / tries[x] + (if (level == Level.EASY) rng.nextDouble() * 0.15 else 0.0)
                if (rate > bestRate) { bestRate = rate; best = x }
            }
            best
        }

        val def = GameDef("hex", { Hex(it.int("size", 11).let { v -> if (v in listOf(7, 9, 11)) v else 11 }) }, brain)
    }
}
