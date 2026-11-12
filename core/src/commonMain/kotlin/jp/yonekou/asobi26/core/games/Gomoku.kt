package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.softPick
import kotlin.random.Random

/**
 * 五目ならべ(15×15)。席0=黒(先手)、席1=白。手はマスの番号 r*15+c。
 * exact=true(標準): ちょうど5つで勝ち(6つ以上の長連は勝ちにならない)。false(自由): 5つ以上で勝ち。
 * 禁じ手(三三など)は使わない。盤が埋まったら引き分け。
 */
class GomokuState(val cells: IntArray, val turn: Int, val winner: Int, val full: Boolean, val lastMove: Int, val winLine: IntArray)

class Gomoku(val exact: Boolean) : Rules<GomokuState> {
    override val playerCount = 2

    override fun initial(rng: Random) = GomokuState(IntArray(N * N), 0, -1, false, -1, IntArray(0))

    override fun toMove(s: GomokuState): Int = if (s.winner >= 0 || s.full) -1 else s.turn

    override fun legalMoves(s: GomokuState): IntArray =
        if (toMove(s) < 0) IntArray(0) else (0 until N * N).filter { s.cells[it] == 0 }.toIntArray()

    override fun isLegal(s: GomokuState, m: Int): Boolean = toMove(s) >= 0 && m in 0 until N * N && s.cells[m] == 0

    override fun play(s: GomokuState, m: Int): GomokuState {
        val cells = s.cells.copyOf()
        cells[m] = s.turn + 1
        val line = winLine(cells, m)
        val full = line.isEmpty() && cells.none { it == 0 }
        return GomokuState(cells, 1 - s.turn, if (line.isNotEmpty()) s.turn else -1, full, m, line)
    }

    /** m を通る勝ちの並び(なければ空) */
    fun winLine(cells: IntArray, m: Int): IntArray {
        val v = cells[m]
        val r0 = m / N
        val c0 = m % N
        for ((dr, dc) in DIRS) {
            val list = ArrayList<Int>()
            var r = r0
            var c = c0
            while (inside(r - dr, c - dc) && cells[(r - dr) * N + c - dc] == v) { r -= dr; c -= dc }
            while (inside(r, c) && cells[r * N + c] == v) { list.add(r * N + c); r += dr; c += dc }
            if (if (exact) list.size == 5 else list.size >= 5) return list.toIntArray()
        }
        return IntArray(0)
    }

    override fun outcome(s: GomokuState): Outcome? = when {
        s.winner >= 0 -> Outcome(s.winner, "")
        s.full -> Outcome(-1, "盤が埋まりました")
        else -> null
    }

    companion object {
        const val N = 15
        val DIRS = listOf(0 to 1, 1 to 0, 1 to 1, 1 to -1)
        fun inside(r: Int, c: Int) = r in 0 until N && c in 0 until N

        /** 石の周り2マス以内の空きマス(候補手)。盤が空なら中央 */
        fun candidates(cells: IntArray): IntArray {
            if (cells.all { it == 0 }) return intArrayOf(N / 2 * N + N / 2)
            val out = ArrayList<Int>()
            for (i in 0 until N * N) {
                if (cells[i] != 0) continue
                val r = i / N
                val c = i % N
                var near = false
                loop@ for (dr in -2..2) for (dc in -2..2) {
                    val rr = r + dr
                    val cc = c + dc
                    if (inside(rr, cc) && cells[rr * N + cc] != 0) { near = true; break@loop }
                }
                if (near) out.add(i)
            }
            return out.toIntArray()
        }

        /** マス m に色 v を置いた時の並びの強さ(4方向の合計) */
        fun patternScore(cells: IntArray, m: Int, v: Int, exact: Boolean): Int {
            var total = 0
            val r0 = m / N
            val c0 = m % N
            for ((dr, dc) in DIRS) {
                var count = 1
                var open = 0
                var r = r0 + dr
                var c = c0 + dc
                while (inside(r, c) && cells[r * N + c] == v) { count++; r += dr; c += dc }
                if (inside(r, c) && cells[r * N + c] == 0) open++
                r = r0 - dr
                c = c0 - dc
                while (inside(r, c) && cells[r * N + c] == v) { count++; r -= dr; c -= dc }
                if (inside(r, c) && cells[r * N + c] == 0) open++
                total += when {
                    count == 5 || (count > 5 && !exact) -> 1_000_000
                    count > 5 -> 0
                    count == 4 && open == 2 -> 100_000
                    count == 4 && open == 1 -> 12_000
                    count == 3 && open == 2 -> 6_000
                    count == 3 && open == 1 -> 600
                    count == 2 && open == 2 -> 250
                    count == 2 && open == 1 -> 50
                    count == 1 && open == 2 -> 12
                    else -> 2
                }
            }
            return total
        }

        /** 候補手の点数: 自分が置く強さ + 相手に置かれる強さ(守り) */
        private fun moveScore(cells: IntArray, m: Int, me: Int, exact: Boolean, defense: Double): Double =
            patternScore(cells, m, me + 1, exact) + defense * patternScore(cells, m, 2 - me, exact)

        val brain = Brain<GomokuState> { rules, s, seat, level, rng, budget ->
            val g = rules as Gomoku
            val cand = candidates(s.cells)
            if (cand.size == 1) return@Brain cand[0]
            val scored = cand.map { it to moveScore(s.cells, it, seat, g.exact, if (level == Level.EASY) 0.45 else 0.95) }.sortedByDescending { it.second }
            when (level) {
                // 初級・中級: 形の点数(桁が大きく違うので対数で比べる)の近い手から選ぶ。
                // 初級は守りを軽く見るので、相手の三や四を見落とすことがある(でたらめな所には打たない)
                Level.EASY -> {
                    if (scored[0].second >= 1_000_000) scored[0].first
                    else softPick(rng, scored.take(8), 1.0) { kotlin.math.ln(it.second + 1.0) }.first
                }
                Level.NORMAL -> {
                    if (scored[0].second >= 500_000) scored[0].first
                    else softPick(rng, scored.take(6), 0.25) { kotlin.math.ln(it.second + 1.0) }.first
                }
                Level.HARD -> {
                    if (scored[0].second >= 1_000_000) return@Brain scored[0].first
                    val me = seat + 1
                    val opp = 2 - seat
                    // 相手の五を止める手が最優先(scored の上位に来る)。それ以外は四追いの読み
                    val oppFive = fivePoints(s.cells, opp, g.exact)
                    if (oppFive.isNotEmpty()) return@Brain oppFive[0]
                    vcf(s.cells, me, opp, g.exact, 6, budget)?.let { return@Brain it } // 四追いは6手まで(上手な人くらい)
                    // 相手に四追いがあれば、それを消す手を探す(上位の候補と、四追いの手順の点から)
                    val threat = vcf(s.cells, opp, me, g.exact, 6, budget)
                    val pool = scored.take(12).map { it.first }.toMutableList()
                    if (threat != null && threat !in pool) pool.add(0, threat)
                    var best = scored[0].first
                    var bestV = Double.NEGATIVE_INFINITY
                    for (m in pool) {
                        if (budget.over()) break
                        val cells = s.cells.copyOf()
                        cells[m] = me
                        val v = moveScore(s.cells, m, seat, g.exact, 0.95)
                        val safe = threat == null || vcf(cells, opp, me, g.exact, 8, budget) == null
                        val follow = candidates(cells).maxOfOrNull { patternScore(cells, it, me, g.exact) }?.toDouble() ?: 0.0
                        val value = v + 0.1 * follow - (if (safe) 0.0 else 10_000_000.0)
                        if (value > bestV) { bestV = value; best = m }
                    }
                    best
                }
            }
        }

        /** 色 v が置けば五になる空きマス */
        fun fivePoints(cells0: IntArray, v: Int, exact: Boolean): List<Int> {
            val g = Gomoku(exact)
            val cells = cells0.copyOf()
            val out = ArrayList<Int>()
            for (i in candidates(cells)) {
                if (cells[i] != 0) continue
                cells[i] = v
                if (g.winLine(cells, i).isNotEmpty()) out.add(i)
                cells[i] = 0
            }
            return out
        }

        /** m の周り(4方向に4マス以内)で、色 v が置けば五になる空きマス */
        private fun fivePointsNear(g: Gomoku, cells: IntArray, m: Int, v: Int): List<Int> {
            val out = ArrayList<Int>()
            val r0 = m / N
            val c0 = m % N
            for ((dr, dc) in DIRS) for (k in -4..4) {
                if (k == 0) continue
                val r = r0 + dr * k
                val c = c0 + dc * k
                if (!inside(r, c)) continue
                val q = r * N + c
                if (cells[q] != 0 || q in out) continue
                cells[q] = v
                if (g.winLine(cells, q).isNotEmpty()) out.add(q)
                cells[q] = 0
            }
            return out
        }

        /**
         * 四追い(四を続けて作り、相手に止めさせ続けて五に至る手順)を探す。見つかれば最初の手。
         * 相手が止めた所で相手に五ができる場合や、相手が先に五を作れる場合は失敗とする。
         */
        fun vcf(cells0: IntArray, v: Int, opp: Int, exact: Boolean, depth: Int, budget: jp.yonekou.asobi26.core.Budget): Int? {
            val g = Gomoku(exact)
            val cells = cells0.copyOf()
            fun go(d: Int): Int? {
                if (budget.over()) return null
                for (i in candidates(cells)) {
                    if (cells[i] != 0) continue
                    cells[i] = v
                    if (g.winLine(cells, i).isNotEmpty()) { cells[i] = 0; return i }
                    cells[i] = 0
                }
                if (d <= 0) return null
                for (i in candidates(cells)) {
                    if (cells[i] != 0) continue
                    cells[i] = v
                    val fives = fivePointsNear(g, cells, i, v)
                    var ok = false
                    if (fives.size >= 2) ok = true
                    else if (fives.size == 1) {
                        val p = fives[0]
                        cells[p] = opp
                        // 相手が止めた手で五ができたら失敗
                        if (g.winLine(cells, p).isEmpty()) ok = go(d - 1) != null
                        cells[p] = 0
                    }
                    cells[i] = 0
                    if (ok) return i
                }
                return null
            }
            return go(depth)
        }

        val def = GameDef("gomoku", { Gomoku(it.str("rule", "exact") == "exact") }, brain)
    }
}
