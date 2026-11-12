package jp.yonekou.asobi26.core

import kotlin.random.Random

/** 思考の途中で期限が来た時に、探索を抜けるための例外 */
class OutOfTime : RuntimeException()

/**
 * 2人用・完全情報のゲームの αβ 探索(反復深化)。手番が続けて回ってくるゲーム(マンカラ等)にも対応するため、
 * 「手番が自分か」で最大化/最小化を切り替える(符号の反転はしない)。
 *
 * eval(s, me): 自分(me)から見た局面の点数。勝ちは WIN 付近の値で表す。
 * order: 手の並べ替え(よい手を先に読むと枝刈りが効く)。
 */
class AlphaBeta<S>(
    private val rules: Rules<S>,
    private val eval: (S, Int) -> Int,
    private val order: ((S, IntArray) -> IntArray)? = null,
) {
    private var me = 0
    private lateinit var budget: Budget
    private var nodes = 0L

    /** 最後の探索で読んだ局面の数(テスト・調整用) */
    val lastNodes: Long get() = nodes

    /**
     * 最善手を返す。maxDepth まで1手ずつ深く読み、期限が来たら最後に読み終えた深さの結果を使う。
     * noise > 0 なら、最善との差が noise 以内の手からランダムに選ぶ(弱めのCPU用)。
     */
    fun best(s: S, seat: Int, maxDepth: Int, budget: Budget, rng: Random, noise: Int = 0): Int {
        me = seat
        this.budget = budget
        nodes = 0
        val moves = sorted(s, rules.legalMoves(s))
        if (moves.size == 1) return moves[0]
        var bestMoves: List<Int> = listOf(moves[0])
        for (depth in 1..maxDepth) {
            try {
                val scores = IntArray(moves.size)
                val top: Int
                if (noise > 0) {
                    // 弱めのCPU: 全部の手の正確な点数を出し、最善に近い手から選ぶ
                    for (i in moves.indices) scores[i] = value(rules.play(s, moves[i]), depth - 1, -INF, INF, 1)
                    top = scores.max()
                    bestMoves = moves.indices.filter { scores[it] >= top - noise }.map { moves[it] }
                } else {
                    // 最善手だけを求める(2手目以降は「最善を超えるか」だけを調べるので、点数は上限値になる)
                    var alpha = -INF
                    var bestIdx = 0
                    for (i in moves.indices) {
                        val v = value(rules.play(s, moves[i]), depth - 1, alpha, INF, 1)
                        scores[i] = if (v > alpha) v else -INF + 1
                        if (v > alpha) { alpha = v; bestIdx = i }
                    }
                    top = alpha
                    bestMoves = listOf(moves[bestIdx])
                }
                // 次の深さでは、今回よかった手から読む
                val idx = moves.indices.sortedByDescending { scores[it] }
                val reordered = idx.map { moves[it] }.toIntArray()
                reordered.copyInto(moves)
                if (top >= WIN - 1000 || top <= -WIN + 1000) break // 勝ち負けが読み切れた
            } catch (e: OutOfTime) {
                break
            }
            if (budget.over()) break
        }
        return bestMoves[rng.nextInt(bestMoves.size)]
    }

    /**
     * 人らしい弱さで選ぶ(初級・中級用)。
     * 弱さは「読みの浅さ」と「点数の近い手の迷い」だけで出し、でたらめな手は指さない。
     * - depth までの読みで全部の手に点数を付ける(期限が来たら、読み終えた深さの点数を使う)。
     * - 読み切った勝ちは必ず指す。読んだ範囲で負けが決まる手は、ほかに手があれば指さない。
     * - 残りは、最善との差に応じた確率(差が temp なら約 1/2.7)で選ぶ。差が temp の4倍を超える手は選ばない。
     *   temp は評価関数の単位(ゲームごとに違う)。0 なら最善手だけ。
     */
    fun pick(s: S, seat: Int, depth: Int, budget: Budget, rng: Random, temp: Int): Int {
        me = seat
        this.budget = budget
        nodes = 0
        val moves = sorted(s, rules.legalMoves(s))
        if (moves.size == 1) return moves[0]
        var done: IntArray? = null
        for (d in 1..depth) {
            try {
                val scores = IntArray(moves.size)
                for (i in moves.indices) scores[i] = value(rules.play(s, moves[i]), d - 1, -INF, INF, 1)
                done = scores
                if (scores.max() >= WIN - 1000) break
            } catch (e: OutOfTime) {
                break
            }
            if (budget.over()) break
        }
        val scores = done ?: return moves[0]
        val top = scores.max()
        if (top >= WIN - 1000 || temp <= 0) {
            val bests = moves.indices.filter { scores[it] == top }
            return moves[bests[rng.nextInt(bests.size)]]
        }
        val alive = moves.indices.filter { scores[it] > -WIN + 1000 }.ifEmpty { moves.indices.toList() }
        val pool = alive.filter { top - scores[it] <= temp * 4 }.ifEmpty { listOf(alive.maxBy { scores[it] }) }
        val weights = pool.map { kotlin.math.exp(-(top - scores[it]).toDouble() / temp) }
        var r = rng.nextDouble() * weights.sum()
        for (k in pool.indices) {
            r -= weights[k]
            if (r <= 0) return moves[pool[k]]
        }
        return moves[pool.last()]
    }

    private fun value(s: S, depth: Int, alphaIn: Int, betaIn: Int, ply: Int): Int {
        if ((++nodes and 1023L) == 0L && budget.over()) throw OutOfTime()
        val out = rules.outcome(s)
        if (out != null) return when (out.winner) {
            -1 -> 0
            me -> WIN - ply
            else -> -WIN + ply
        }
        if (depth <= 0) return eval(s, me)
        val moves = sorted(s, rules.legalMoves(s))
        var alpha = alphaIn
        var beta = betaIn
        if (rules.toMove(s) == me) {
            var best = -INF
            for (m in moves) {
                val v = value(rules.play(s, m), depth - 1, alpha, beta, ply + 1)
                if (v > best) best = v
                if (best > alpha) alpha = best
                if (alpha >= beta) break
            }
            return best
        } else {
            var best = INF
            for (m in moves) {
                val v = value(rules.play(s, m), depth - 1, alpha, beta, ply + 1)
                if (v < best) best = v
                if (best < beta) beta = best
                if (alpha >= beta) break
            }
            return best
        }
    }

    private fun sorted(s: S, moves: IntArray): IntArray = order?.invoke(s, moves) ?: moves

    companion object {
        const val INF = 1_000_000_000
        const val WIN = 100_000_000
    }
}

/** 点数の付いた候補から、最善との差に応じた確率で選ぶ(読みを使わないゲームの初級・中級用。考え方は AlphaBeta.pick と同じ) */
fun <T> softPick(rng: Random, items: List<T>, temp: Double, score: (T) -> Double): T {
    if (items.size == 1 || temp <= 0) return items.maxBy(score)
    val sc = items.map(score)
    val top = sc.max()
    val pool = items.indices.filter { top - sc[it] <= temp * 4 }
    val w = pool.map { kotlin.math.exp(-(top - sc[it]) / temp) }
    var r = rng.nextDouble() * w.sum()
    for (k in pool.indices) {
        r -= w[k]
        if (r <= 0) return items[pool[k]]
    }
    return items[pool.last()]
}
