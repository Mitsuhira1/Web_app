package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.softPick
import kotlin.math.abs
import kotlin.random.Random

/**
 * チャイニーズチェッカー(星形の盤 121 穴、各自10個)。2・3・4・6人。
 * 穴は立方体座標 (q, r, s=-q-r) で表し、POINTS の番号で持つ。陣地は星の6つの先(CAMPS)。
 * 席 k は陣地 camps[k] から出発し、向かいの陣地(-camps[k])へ全部の駒を運ぶ。
 * board[穴] = 0 空き、席+1 = その席の駒。手は from*128 + to。
 */
class CcState(val board: IntArray, val turn: Int, val ply: Int, val winner: Int, val over: Boolean, val reason: String, val lastMove: Int) {
    fun piecesOf(seat: Int): List<Int> = board.indices.filter { board[it] == seat + 1 }
}

class ChineseCheckers(val players: Int) : Rules<CcState> {
    override val playerCount = players

    /** 席 → 出発の陣地の番号(CAMP_DIRS の何番目か) */
    val camps: IntArray = when (players) {
        2 -> intArrayOf(0, 3)
        3 -> intArrayOf(0, 2, 4)
        4 -> intArrayOf(0, 1, 3, 4)
        else -> intArrayOf(0, 1, 2, 3, 4, 5)
    }

    fun target(seat: Int) = (camps[seat] + 3) % 6

    override fun initial(rng: Random): CcState {
        val b = IntArray(POINTS.size)
        for (seat in 0 until players) for (i in CAMP_POINTS[camps[seat]]) b[i] = seat + 1
        return CcState(b, 0, 0, -1, false, "", -1)
    }

    override fun toMove(s: CcState): Int = if (s.over) -1 else s.turn

    /** from から行ける穴(1マス、または続けて跳ぶ) */
    fun reach(board: IntArray, from: Int): List<Int> {
        val out = ArrayList<Int>()
        for (d in 0 until 6) {
            val nb = NEIGHBOR[from][d]
            if (nb >= 0 && board[nb] == 0) out.add(nb)
        }
        val seen = HashSet<Int>()
        seen.add(from)
        val queue = ArrayDeque<Int>()
        queue.add(from)
        while (queue.isNotEmpty()) {
            val p = queue.removeFirst()
            for (d in 0 until 6) {
                val over = NEIGHBOR[p][d]
                if (over < 0 || board[over] == 0) continue
                val land = NEIGHBOR[over][d]
                if (land < 0 || (board[land] != 0 && land != from) || !seen.add(land)) continue
                if (land == from) continue
                out.add(land)
                queue.add(land)
            }
        }
        return out.distinct()
    }

    /** 跳んで行く道筋(画面の動き用)。1マスの移動なら [from, to] */
    fun path(board: IntArray, from: Int, to: Int): List<Int> {
        if (from in NEIGHBOR[to].toList()) return listOf(from, to)
        val parent = HashMap<Int, Int>()
        val queue = ArrayDeque<Int>()
        queue.add(from); parent[from] = -1
        while (queue.isNotEmpty()) {
            val p = queue.removeFirst()
            if (p == to) break
            for (d in 0 until 6) {
                val over = NEIGHBOR[p][d]
                if (over < 0 || board[over] == 0 || over == from) continue
                val land = NEIGHBOR[over][d]
                if (land < 0 || board[land] != 0 || parent.containsKey(land)) continue
                parent[land] = p
                queue.add(land)
            }
        }
        if (!parent.containsKey(to)) return listOf(from, to)
        val list = ArrayList<Int>()
        var x = to
        while (x != -1) { list.add(x); x = parent[x]!! }
        return list.reversed()
    }

    override fun legalMoves(s: CcState): IntArray {
        if (s.over) return IntArray(0)
        val seat = s.turn
        val goal = CAMP_SET[target(seat)]
        val out = ArrayList<Int>()
        val b = s.board.copyOf()
        for (p in s.board.indices) {
            if (s.board[p] != seat + 1) continue
            b[p] = 0
            for (t in reach(b, p)) {
                // ゴールの陣地に入った駒は、陣地の外へ出ない
                if (p in goal && t !in goal) continue
                out.add(p * 128 + t)
            }
            b[p] = seat + 1
        }
        return out.toIntArray()
    }

    override fun play(s: CcState, m: Int): CcState {
        val b = s.board.copyOf()
        val seat = s.turn
        b[m / 128] = 0
        b[m % 128] = seat + 1
        val ply = s.ply + 1
        val goal = CAMP_POINTS[target(seat)]
        val mine = goal.count { b[it] == seat + 1 }
        if (mine == 10 || (mine >= 1 && goal.all { b[it] != 0 })) return CcState(b, seat, ply, seat, true, "", m)
        if (ply >= MAX_PLY) {
            // 手数の上限: ゴールまでの距離の合計が一番小さい人の勝ち
            val d = (0 until players).map { distance(b, it) }
            val best = d.min()
            val w = if (d.count { it == best } == 1) d.indexOf(best) else -1
            return CcState(b, seat, ply, w, true, "${MAX_PLY}手に達しました", m)
        }
        // 動ける手がない人は飛ばす(ふつうは起こらない)
        var next = (seat + 1) % players
        repeat(players) {
            val probe = CcState(b, next, ply, -1, false, "", m)
            if (legalMoves(probe).isNotEmpty()) return probe
            next = (next + 1) % players
        }
        return CcState(b, seat, ply, -1, true, "動ける手がありません", m)
    }

    override fun outcome(s: CcState): Outcome? = if (s.over) Outcome(s.winner, s.reason) else null

    override fun scores(s: CcState): IntArray = IntArray(players) { seat -> CAMP_POINTS[target(seat)].count { s.board[it] == seat + 1 } }

    // ---------------- CPU ----------------

    /** 席の駒の、ゴールの先端までの距離の合計 */
    fun distance(board: IntArray, seat: Int): Int {
        val tip = TIPS[target(seat)]
        var sum = 0
        for (i in board.indices) if (board[i] == seat + 1) sum += dist(i, tip)
        return sum
    }

    /** 局面の点数(小さいほど良い): 距離の合計と、一番遅れた駒 */
    private fun cost(board: IntArray, seat: Int): Double {
        val tip = TIPS[target(seat)]
        var sum = 0
        var worst = 0
        for (i in board.indices) if (board[i] == seat + 1) { val d = dist(i, tip); sum += d; if (d > worst) worst = d }
        return sum + worst * 0.6
    }

    private fun after(board: IntArray, m: Int, seat: Int): IntArray = board.copyOf().also { it[m / 128] = 0; it[m % 128] = seat + 1 }

    companion object {
        const val MAX_PLY = 600

        /** 立方体座標の6方向 */
        private val DIRS = arrayOf(intArrayOf(1, -1), intArrayOf(1, 0), intArrayOf(0, 1), intArrayOf(-1, 1), intArrayOf(-1, 0), intArrayOf(0, -1))

        /** 121 の穴(q, r) */
        val POINTS: List<IntArray> = buildList {
            for (r in -8..8) for (q in -8..8) {
                val s = -q - r
                val up = q >= -4 && r >= -4 && s >= -4
                val down = q <= 4 && r <= 4 && s <= 4
                if (up || down) add(intArrayOf(q, r))
            }
        }
        private val INDEX: Map<Long, Int> = POINTS.withIndex().associate { (i, p) -> key(p[0], p[1]) to i }
        private fun key(q: Int, r: Int) = q * 1000L + r
        fun indexOf(q: Int, r: Int): Int = INDEX[key(q, r)] ?: -1

        val NEIGHBOR: Array<IntArray> = Array(POINTS.size) { i -> IntArray(6) { d -> indexOf(POINTS[i][0] + DIRS[d][0], POINTS[i][1] + DIRS[d][1]) } }

        /**
         * 6つの陣地。0 = 下(r>4)、1 = 左下(q<-4)、2 = 左上(s>4)、3 = 上(r<-4)、4 = 右上(q>4)、5 = 右下(s<-4)。
         * k と k+3 が向かい合う。
         */
        private fun inCamp(c: Int, q: Int, r: Int): Boolean {
            val s = -q - r
            return when (c) { 0 -> r > 4; 1 -> q < -4; 2 -> s > 4; 3 -> r < -4; 4 -> q > 4; else -> s < -4 }
        }
        val CAMP_POINTS: Array<List<Int>> = Array(6) { c -> POINTS.indices.filter { inCamp(c, POINTS[it][0], POINTS[it][1]) } }
        val CAMP_SET: Array<Set<Int>> = Array(6) { CAMP_POINTS[it].toSet() }

        /** 各陣地の先端の穴 */
        val TIPS: IntArray = IntArray(6) { c ->
            when (c) { 0 -> indexOf(-4, 8); 1 -> indexOf(-8, 4); 2 -> indexOf(-4, -4); 3 -> indexOf(4, -8); 4 -> indexOf(8, -4); else -> indexOf(4, 4) }
        }

        fun dist(a: Int, b: Int): Int {
            val dq = POINTS[a][0] - POINTS[b][0]
            val dr = POINTS[a][1] - POINTS[b][1]
            return maxOf(abs(dq), abs(dr), abs(dq + dr))
        }

        val brain = Brain<CcState> { rules, s, seat, level, rng, budget ->
            val g = rules as ChineseCheckers
            val legal = g.legalMoves(s)
            if (legal.size == 1) return@Brain legal[0]
            val base = g.cost(s.board, seat)
            val ms = legal.toList()
            fun gain(m: Int) = base - g.cost(g.after(s.board, m, seat), seat)
            when (level) {
                // 初級: 進める距離の近い手から迷いながら選ぶ(遅れた駒は気にしない)
                Level.EASY -> softPick(rng, ms, 1.6) { (g.distance(s.board, seat) - g.distance(g.after(s.board, m = it, seat = seat), seat)).toDouble() }
                Level.NORMAL -> softPick(rng, ms, 0.6) { gain(it) }
                Level.HARD -> {
                    // 2手先: この手の後に、次の自分の手でどこまで進めるか(相手の手は考えない)
                    val ranked = ms.sortedByDescending { gain(it) }.take(14)
                    var best = ranked[0]
                    var bestV = Double.NEGATIVE_INFINITY
                    for (m in ranked) {
                        if (budget.over()) break
                        val b1 = g.after(s.board, m, seat)
                        val probe = CcState(b1, seat, s.ply, -1, false, "", m)
                        val next = g.legalMoves(probe).maxOfOrNull { m2 -> g.cost(b1, seat) - g.cost(g.after(b1, m2, seat), seat) } ?: 0.0
                        val v = gain(m) + 0.85 * next
                        if (v > bestV) { bestV = v; best = m }
                    }
                    best
                }
            }
        }

        val def = GameDef(
            "chinese",
            { ChineseCheckers(it.int("players", 2).let { p -> if (p in listOf(2, 3, 4, 6)) p else 2 }) },
            brain,
            seatsFor = { it.int("players", 2).let { p -> if (p in listOf(2, 3, 4, 6)) p else 2 } },
        )
    }
}
