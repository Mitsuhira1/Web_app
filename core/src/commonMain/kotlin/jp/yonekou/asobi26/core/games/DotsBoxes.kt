package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.OutOfTime
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * ドット＆ボックス(n×n 個の箱。点は (n+1)×(n+1))。2人。
 * 線の番号: 横線 h(r,c) = r*n + c (r=0..n, c=0..n-1)、縦線 v(r,c) = n*(n+1) + r*(n+1) + c (r=0..n-1, c=0..n)。
 * 箱を閉じた人は続けてもう1本引く。線を全部引いたら終わり、箱の多い方が勝ち。
 */
/** edgeBy[e] = その線を引いた席(-1 = まだ) */
class DotsState(val drawn: Long, val owner: IntArray, val turn: Int, val score: IntArray, val lastEdge: Int, val over: Boolean, val edgeBy: IntArray) {
    fun isDrawn(e: Int): Boolean = (drawn ushr e) and 1L == 1L
}

class DotsBoxes(val n: Int) : Rules<DotsState> {
    val hCount = (n + 1) * n
    val edgeCount = 2 * n * (n + 1)

    /** 箱ごとの4辺 */
    val boxEdges: Array<IntArray> = Array(n * n) { b ->
        val r = b / n
        val c = b % n
        intArrayOf(r * n + c, (r + 1) * n + c, hCount + r * (n + 1) + c, hCount + r * (n + 1) + c + 1)
    }

    /** 線ごとの、隣の箱(1つか2つ) */
    val edgeBoxes: Array<IntArray> = Array(edgeCount) { e ->
        val list = ArrayList<Int>()
        for (b in 0 until n * n) if (e in boxEdges[b]) list.add(b)
        list.toIntArray()
    }

    private val full: Long = if (edgeCount == 64) -1L else (1L shl edgeCount) - 1

    override val playerCount = 2

    override fun initial(rng: Random) = DotsState(0L, IntArray(n * n) { -1 }, 0, IntArray(2), -1, false, IntArray(edgeCount) { -1 })

    override fun toMove(s: DotsState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: DotsState): IntArray =
        if (s.over) IntArray(0) else (0 until edgeCount).filter { !s.isDrawn(it) }.toIntArray()

    override fun isLegal(s: DotsState, m: Int): Boolean = !s.over && m in 0 until edgeCount && !s.isDrawn(m)

    override fun play(s: DotsState, m: Int): DotsState {
        val drawn = s.drawn or (1L shl m)
        val owner = s.owner.copyOf()
        val score = s.score.copyOf()
        var completed = 0
        for (b in edgeBoxes[m]) {
            if (boxEdges[b].all { (drawn ushr it) and 1L == 1L }) { owner[b] = s.turn; completed++ }
        }
        score[s.turn] += completed
        val over = drawn == full
        val by = s.edgeBy.copyOf()
        by[m] = s.turn
        return DotsState(drawn, owner, if (completed > 0) s.turn else 1 - s.turn, score, m, over, by)
    }

    override fun outcome(s: DotsState): Outcome? {
        if (!s.over) return null
        val a = s.score[0]
        val b = s.score[1]
        return Outcome(if (a > b) 0 else if (b > a) 1 else -1, "箱 $a 対 $b")
    }

    override fun scores(s: DotsState): IntArray = s.score.copyOf()

    // ---- CPU 用の計算(線の集合 mask だけで決まる) ----
    fun sides(mask: Long, b: Int): Int = boxEdges[b].count { (mask ushr it) and 1L == 1L }

    /** その線を引くと閉じる箱の数 */
    fun completes(mask: Long, e: Int): Int = edgeBoxes[e].count { sides(mask, it) == 3 }

    /** 引いても相手に箱を渡さない線(隣の箱が3辺にならない) */
    fun isSafe(mask: Long, e: Int): Boolean = edgeBoxes[e].all { sides(mask, it) < 2 }

    /** 線 e を引いて手番を渡した時、相手が続けて取れる箱の数(取れるだけ取る相手を想定) */
    fun giveaway(mask0: Long, e: Int): Int {
        var mask = mask0 or (1L shl e)
        var taken = 0
        while (true) {
            var found = -1
            for (x in 0 until edgeCount) if ((mask ushr x) and 1L == 0L && completes(mask, x) > 0) { found = x; break }
            if (found < 0) return taken
            taken += completes(mask, found)
            mask = mask or (1L shl found)
        }
    }

    /**
     * 残りの線から、手番の人が「これから取れる箱 − 相手がこれから取れる箱」の最大値(読み切り)。
     * 値は残りの線の集合だけで決まるので、mask をキーに覚えておく。
     */
    fun solve(mask: Long, memo: HashMap<Long, Int>, budget: Budget): Int {
        if (mask == full) return 0
        memo[mask]?.let { return it }
        if ((memo.size and 1023) == 0 && budget.over()) throw OutOfTime()
        var best = Int.MIN_VALUE
        // 箱を閉じる手を先に読む
        for (pass in 0..1) for (e in 0 until edgeCount) {
            if ((mask ushr e) and 1L == 1L) continue
            val k = completes(mask, e)
            if ((pass == 0) != (k > 0)) continue
            val next = mask or (1L shl e)
            val v = if (k > 0) k + solve(next, memo, budget) else -solve(next, memo, budget)
            if (v > best) best = v
        }
        memo[mask] = best
        return best
    }

    companion object {
        val brain = Brain<DotsState> { rules, s, _, level, rng, budget ->
            val r = rules as DotsBoxes
            val legal = r.legalMoves(s)
            if (legal.size == 1) return@Brain legal[0]
            val captures = legal.filter { r.completes(s.drawn, it) > 0 }
            val safe = legal.filter { r.isSafe(s.drawn, it) }
            fun leastGiven(): Int {
                val costs = legal.map { r.giveaway(s.drawn, it) }
                val min = costs.min()
                val c = legal.indices.filter { costs[it] == min }
                return legal[c[rng.nextInt(c.size)]]
            }
            fun pick(list: List<Int>) = list[rng.nextInt(list.size)]
            when (level) {
                // 初級: 取れる箱は取り、3辺目を作らない線を選ぶ。安全な線がなくなると、渡す箱の数を考えずに引く
                Level.EASY -> when {
                    captures.isNotEmpty() -> pick(captures)
                    safe.isNotEmpty() -> pick(safe)
                    else -> pick(legal.toList())
                }
                Level.NORMAL -> when {
                    captures.isNotEmpty() -> pick(captures)
                    safe.isNotEmpty() -> pick(safe)
                    else -> leastGiven()
                }
                Level.HARD -> {
                    val remaining = legal.size
                    var choice = -1
                    // 上級: 安全な線がなくなった終盤(残り12本以下)だけ読み切る(箱の鎖の数え方を知っている人くらい)
                    if (remaining <= 12 && safe.isEmpty()) {
                        try {
                            val memo = HashMap<Long, Int>()
                            var best = Int.MIN_VALUE
                            val good = ArrayList<Int>()
                            for (e in legal) {
                                val k = r.completes(s.drawn, e)
                                val next = s.drawn or (1L shl e)
                                val v = if (k > 0) k + r.solve(next, memo, budget) else -r.solve(next, memo, budget)
                                if (v > best) { best = v; good.clear() }
                                if (v == best) good.add(e)
                            }
                            choice = pick(good)
                        } catch (e: OutOfTime) {
                            choice = -1
                        }
                    }
                    if (choice >= 0) choice else when {
                        captures.isNotEmpty() -> pick(captures)
                        safe.isNotEmpty() -> pick(safe)
                        else -> leastGiven()
                    }
                }
            }
        }

        val def = GameDef("dots", { DotsBoxes(it.int("size", 4).coerceIn(3, 5)) }, brain)
    }
}
