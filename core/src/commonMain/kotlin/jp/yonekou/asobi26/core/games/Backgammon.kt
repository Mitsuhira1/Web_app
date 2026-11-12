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
 * バックギャモン。席0=白(先手、24→1 へ進み、1の先で上げる)、席1=黒(1→24 へ進む)。
 * points[i]: ポイント i+1 の駒(+ = 白の数、- = 黒の数)。bar・off は席ごとの、バーにいる駒・上がった駒の数。
 * dice: この手番でまだ使っていない目(空 = まだ振っていない)。
 * 手: ROLL(振る)/PASS(動かせない)/ 1000 + from*10 + 目(from は 0〜23 のポイント、24 = バー)。
 * サイコロの目は seed と振った回数だけで決まる(CPU は先の目を読まない)。
 */
class BgState(
    val seed: Long,
    val rolls: Int,
    val points: IntArray,
    val bar: IntArray,
    val off: IntArray,
    val dice: IntArray,
    /** 最後に振った2つの目(表示用) */
    val shown: IntArray,
    val turn: Int,
    val winner: Int,
    val reason: String,
    val lastMove: Int,
    /** 直前の手で相手の駒を打った(バーへ送った)か */
    val lastHit: Boolean,
) {
    val over: Boolean get() = winner >= 0
    val rolled: Boolean get() = dice.isNotEmpty()
    fun count(side: Int, i: Int): Int = if (side == 0) maxOf(points[i], 0) else maxOf(-points[i], 0)
}

object Backgammon : Rules<BgState> {
    const val ROLL = 0
    const val PASS = 999
    const val BAR = 24

    override val playerCount = 2

    fun move(from: Int, die: Int) = 1000 + from * 10 + die
    fun fromOf(m: Int) = (m - 1000) / 10
    fun dieOf(m: Int) = (m - 1000) % 10

    private fun die(seed: Long, n: Int): Int = Random(seed * 31 + n * 7919L + 17).nextInt(1, 7)

    override fun initial(rng: Random): BgState {
        val p = IntArray(24)
        p[23] = 2; p[12] = 5; p[7] = 3; p[5] = 5
        p[0] = -2; p[11] = -5; p[16] = -3; p[18] = -5
        return BgState(rng.nextLong(), 0, p, IntArray(2), IntArray(2), IntArray(0), IntArray(0), 0, -1, "", -1, false)
    }

    override fun toMove(s: BgState): Int = if (s.over) -1 else s.turn

    /** 駒の進む先(席0 は小さい番号へ)。範囲外なら上がり */
    private fun target(side: Int, from: Int, d: Int): Int =
        if (from == BAR) (if (side == 0) 24 - d else d - 1) else if (side == 0) from - d else from + d

    private fun allHome(points: IntArray, bar: IntArray, side: Int): Boolean {
        if (bar[side] > 0) return false
        for (i in 0 until 24) {
            val mine = if (side == 0) points[i] > 0 else points[i] < 0
            if (mine && (if (side == 0) i > 5 else i < 18)) return false
        }
        return true
    }

    /** 1つの目で、from の駒を動かせるか(ほかの目のことは考えない) */
    private fun canMove(points: IntArray, bar: IntArray, side: Int, from: Int, d: Int): Boolean {
        if (bar[side] > 0 && from != BAR) return false
        if (from == BAR) { if (bar[side] == 0) return false }
        else if (if (side == 0) points[from] <= 0 else points[from] >= 0) return false
        val t = target(side, from, d)
        if (t in 0..23) {
            val v = points[t]
            return if (side == 0) v >= -1 else v <= 1
        }
        // 上がり
        if (from == BAR || !allHome(points, bar, side)) return false
        val exact = if (side == 0) t == -1 else t == 24
        if (exact) return true
        // 大きい目で上がれるのは、それより奥(上がりから遠い所)に駒がない時だけ
        return if (side == 0) (from + 1 until 6).none { points[it] > 0 } else (18 until from).none { points[it] < 0 }
    }

    /** 盤に1手を適用する(書き換える)。打った時 true */
    private fun apply(points: IntArray, bar: IntArray, off: IntArray, side: Int, from: Int, d: Int): Boolean {
        val sg = if (side == 0) 1 else -1
        if (from == BAR) bar[side]-- else points[from] -= sg
        val t = target(side, from, d)
        if (t !in 0..23) { off[side]++; return false }
        var hit = false
        if (points[t] == -sg) { points[t] = 0; bar[1 - side]++; hit = true }
        points[t] += sg
        return hit
    }

    /** 残りの目で、最大いくつ使えるか */
    private fun maxUse(points: IntArray, bar: IntArray, off: IntArray, side: Int, dice: IntArray): Int {
        if (dice.isEmpty() || off[side] == 15) return 0
        var best = 0
        val tried = HashSet<Int>()
        for (k in dice.indices) {
            val d = dice[k]
            if (!tried.add(d)) continue
            for (from in 0..24) {
                if (!canMove(points, bar, side, from, d)) continue
                val p = points.copyOf(); val b = bar.copyOf(); val o = off.copyOf()
                apply(p, b, o, side, from, d)
                val rest = IntArray(dice.size - 1).also { r -> var j = 0; for (i in dice.indices) if (i != k) r[j++] = dice[i] }
                best = maxOf(best, 1 + maxUse(p, b, o, side, rest))
                if (best == dice.size) return best
            }
        }
        return best
    }

    override fun legalMoves(s: BgState): IntArray {
        if (s.over) return IntArray(0)
        if (!s.rolled) return intArrayOf(ROLL)
        val side = s.turn
        val need = maxUse(s.points, s.bar, s.off, side, s.dice)
        if (need == 0) return intArrayOf(PASS)
        val out = ArrayList<Int>()
        val tried = HashSet<Int>()
        for (k in s.dice.indices) {
            val d = s.dice[k]
            if (!tried.add(d)) continue
            for (from in 0..24) {
                if (!canMove(s.points, s.bar, side, from, d)) continue
                val p = s.points.copyOf(); val b = s.bar.copyOf(); val o = s.off.copyOf()
                apply(p, b, o, side, from, d)
                val rest = IntArray(s.dice.size - 1).also { r -> var j = 0; for (i in s.dice.indices) if (i != k) r[j++] = s.dice[i] }
                if (1 + maxUse(p, b, o, side, rest) == need) out.add(move(from, d))
            }
        }
        // 片方の目しか使えない時は、大きい方の目を使う
        if (need == 1 && s.dice.size == 2 && s.dice[0] != s.dice[1]) {
            val big = maxOf(s.dice[0], s.dice[1])
            if (out.any { dieOf(it) == big }) out.removeAll { dieOf(it) != big }
        }
        return out.toIntArray()
    }

    override fun play(s: BgState, m: Int): BgState {
        val side = s.turn
        if (m == ROLL) {
            val a = die(s.seed, s.rolls)
            val b = die(s.seed, s.rolls + 1)
            val dice = if (a == b) intArrayOf(a, a, a, a) else intArrayOf(a, b)
            return BgState(s.seed, s.rolls + 2, s.points, s.bar, s.off, dice, intArrayOf(a, b), side, -1, "", m, false)
        }
        if (m == PASS) return BgState(s.seed, s.rolls, s.points, s.bar, s.off, IntArray(0), s.shown, 1 - side, -1, "", m, false)
        val p = s.points.copyOf(); val b = s.bar.copyOf(); val o = s.off.copyOf()
        val d = dieOf(m)
        val hit = apply(p, b, o, side, fromOf(m), d)
        val idx = s.dice.indexOf(d)
        val rest = IntArray(s.dice.size - 1).also { r -> var j = 0; for (i in s.dice.indices) if (i != idx) r[j++] = s.dice[i] }
        if (o[side] == 15) {
            val loser = 1 - side
            val reason = when {
                o[loser] > 0 -> ""
                b[loser] > 0 || (0 until 24).any { i -> (if (loser == 1) p[i] < 0 && i <= 5 else p[i] > 0 && i >= 18) } -> "バックギャモン勝ち(3倍)"
                else -> "ギャモン勝ち(2倍)"
            }
            return BgState(s.seed, s.rolls, p, b, o, IntArray(0), s.shown, side, side, reason, m, hit)
        }
        // 目が残っていても、もう動かせなければ手番を渡す
        val done = rest.isEmpty() || maxUse(p, b, o, side, rest) == 0
        return BgState(s.seed, s.rolls, p, b, o, if (done) IntArray(0) else rest, s.shown, if (done) 1 - side else side, -1, "", m, hit)
    }

    override fun outcome(s: BgState): Outcome? = if (s.over) Outcome(s.winner, s.reason) else null

    /** ゴールまでの残りの目の合計(ピップ数) */
    fun pips(s: BgState, side: Int): Int = pips(s.points, s.bar, side)

    private fun pips(points: IntArray, bar: IntArray, side: Int): Int {
        var n = bar[side] * 25
        for (i in 0 until 24) {
            val c = if (side == 0) maxOf(points[i], 0) else maxOf(-points[i], 0)
            n += c * (if (side == 0) i + 1 else 24 - i)
        }
        return n
    }

    override fun scores(s: BgState): IntArray = intArrayOf(s.off[0], s.off[1])

    // ---------------- CPU ----------------

    /** 36通りの目のうち、相手がその距離の駒に当てられる割合(間の邪魔は考えない) */
    private val SHOT = DoubleArray(25).also { t ->
        for (dist in 1..24) {
            var n = 0
            for (a in 1..6) for (b in 1..6) {
                val ok = a == dist || b == dist || (a + b == dist) ||
                    (a == b && (a * 3 == dist || a * 4 == dist))
                if (ok) n++
            }
            t[dist] = n / 36.0
        }
    }

    /** side から見た局面の点数(大きいほど良い) */
    fun evaluate(points: IntArray, bar: IntArray, off: IntArray, side: Int, simple: Boolean): Double {
        val opp = 1 - side
        val my = pips(points, bar, side)
        val their = pips(points, bar, opp)
        var v = (their - my).toDouble() + (off[side] - off[opp]) * 2.0
        v += (bar[opp] - bar[side]) * 12.0
        if (simple) return v
        val sg = if (side == 0) 1 else -1
        // 互いの駒がまだすれ違っていない(接触がある)か: 白の一番後ろの駒が、黒の一番後ろの駒より奥にあるか
        val whiteBack = (23 downTo 0).firstOrNull { points[it] > 0 } ?: -1
        val blackBack = (0..23).firstOrNull { points[it] < 0 } ?: 99
        val contact = bar[0] > 0 || bar[1] > 0 || whiteBack > blackBack
        if (!contact) return v * 1.5 + off[side] * 6.0
        for (i in 0 until 24) {
            val c = points[i] * sg
            val home = if (side == 0) i <= 5 else i >= 18
            if (c >= 2) {
                v += if (home) 6.0 else 3.0
                // 6つ続いた壁(プライム)ほど強い
                var run = 1
                var j = i + 1
                while (j < 24 && points[j] * sg >= 2) { run++; j++ }
                if (run >= 3) v += run * 2.0
            } else if (c == 1) {
                // 打たれやすさ: 後ろにいる相手の駒からの距離
                var shot = 0.0
                for (k in 0 until 24) {
                    if (points[k] * sg >= 0) continue
                    val dist = if (side == 0) i - k else k - i // 相手は side と逆向きに進む
                    if (dist in 1..24) shot = maxOf(shot, SHOT[dist])
                }
                if (bar[opp] > 0) { val dist = if (side == 0) i + 1 else 24 - i; if (dist in 1..24) shot = maxOf(shot, SHOT[dist]) }
                val progress = if (side == 0) 24 - i else i + 1
                v -= shot * (8.0 + progress * 0.8)
            }
        }
        return v
    }

    /** 1手番の動かし方をすべて並べる(最初の手と、終わった後の局面) */
    private fun sequences(s: BgState, side: Int): List<Pair<Int, BgState>> {
        val out = ArrayList<Pair<Int, BgState>>()
        val seen = HashSet<String>()
        fun go(st: BgState, first: Int) {
            if (st.over || st.turn != side || !st.rolled) {
                val key = st.points.joinToString(",") + "|" + st.bar.joinToString(",") + st.off.joinToString(",")
                if (seen.add(key)) out.add(first to st)
                return
            }
            val ms = legalMoves(st)
            for (m in ms) go(play(st, m), if (first < 0) m else first)
        }
        go(s, -1)
        return out
    }

    private fun value(st: BgState, side: Int, simple: Boolean): Double =
        if (st.over) (if (st.winner == side) 10_000.0 else -10_000.0) else evaluate(st.points, st.bar, st.off, side, simple)

    val brain = Brain<BgState> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        val seqs = sequences(s, seat)
        when (level) {
            // 初級: 進み具合と打つ・打たれるだけを見て、点数の近い動かし方から迷いながら選ぶ
            Level.EASY -> softPick(rng, seqs, 6.0) { value(it.second, seat, true) }.first
            Level.NORMAL -> softPick(rng, seqs, 2.0) { value(it.second, seat, false) }.first
            Level.HARD -> {
                // 上位の候補について、相手の21通りの目それぞれの最善の返しを平均して比べる
                val ranked = seqs.sortedByDescending { value(it.second, seat, false) }.take(5)
                var best = ranked[0].first
                var bestV = Double.NEGATIVE_INFINITY
                for ((first, after) in ranked) {
                    if (budget.over()) break
                    if (after.over) return@Brain first
                    var total = 0.0
                    var weight = 0.0
                    for (a in 1..6) for (b in a..6) {
                        val w = if (a == b) 1.0 else 2.0
                        val dice = if (a == b) intArrayOf(a, a, a, a) else intArrayOf(a, b)
                        val oppTurn = BgState(after.seed, after.rolls, after.points, after.bar, after.off, dice, intArrayOf(a, b), 1 - seat, -1, "", -1, false)
                        val replies = sequences(oppTurn, 1 - seat)
                        val worst = replies.minOfOrNull { value(it.second, seat, false) } ?: value(after, seat, false)
                        total += worst * w
                        weight += w
                    }
                    val v = total / weight
                    if (v > bestV) { bestV = v; best = first }
                }
                best
            }
        }
    }

    val def = GameDef("backgammon", { Backgammon }, brain, undoAllowed = false, passMove = PASS)
}
