package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.synchronized
import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/** 1回の質問と答え。hit = 数字も位置も同じ、blow = 数字は同じで位置が違う */
class Guess(val code: Int, val hit: Int, val blow: Int)

/**
 * ヒット＆ブロー。数字は 0〜9 の重複なしで digits 桁(先頭の0も可)。数は Int で持ち、桁は10進で取り出す。
 * solo: 1人で、CPUが決めた数を当てる(席は1つ)。
 * 対戦: 2人がそれぞれ秘密の数を決め(最初の2手)、交互に相手の数を当てる。先手が当てても後手にも同じ回数の機会がある。
 */
class HitBlowState(
    val digits: Int,
    val solo: Boolean,
    val secrets: IntArray,
    val guesses: List<List<Guess>>,
    val turn: Int,
    /** ONGOING / -1(引き分け) / 勝った席 */
    val result: Int,
    val reason: String,
) {
    val settingSecret: Boolean get() = !solo && secrets.any { it < 0 }
}

class HitBlow(val digits: Int, val solo: Boolean) : Rules<HitBlowState> {
    override val playerCount = if (solo) 1 else 2

    override fun initial(rng: Random): HitBlowState {
        val secrets = if (solo) intArrayOf(randomCode(digits, rng)) else intArrayOf(-1, -1)
        return HitBlowState(digits, solo, secrets, List(playerCount) { emptyList() }, 0, ONGOING, "")
    }

    override fun toMove(s: HitBlowState): Int = when {
        s.result != ONGOING -> -1
        s.settingSecret -> s.secrets.indexOfFirst { it < 0 }
        else -> s.turn
    }

    override fun legalMoves(s: HitBlowState): IntArray = if (toMove(s) < 0) IntArray(0) else allCodes(digits).copyOf()

    override fun isLegal(s: HitBlowState, m: Int): Boolean = toMove(s) >= 0 && isValid(m, digits)

    override fun play(s: HitBlowState, m: Int): HitBlowState {
        if (s.settingSecret) {
            val sec = s.secrets.copyOf()
            sec[toMove(s)] = m
            return HitBlowState(digits, solo, sec, s.guesses, 0, ONGOING, "")
        }
        val me = s.turn
        val target = if (solo) s.secrets[0] else s.secrets[1 - me]
        val (h, b) = judge(m, target, digits)
        val lists = s.guesses.map { ArrayList(it) }
        lists[me].add(Guess(m, h, b))
        if (solo) {
            return if (h == digits) HitBlowState(digits, solo, s.secrets, lists, 0, 0, "${lists[0].size}回で正解")
            else HitBlowState(digits, solo, s.secrets, lists, 0, ONGOING, "")
        }
        if (me == 0) return HitBlowState(digits, solo, s.secrets, lists, 1, ONGOING, "")
        // 後手が答えた所で1回分が終わる。ここで勝ち負けを決める
        val a = lists[0].last().hit == digits
        val b2 = lists[1].last().hit == digits
        val round = lists[1].size
        return when {
            a && b2 -> HitBlowState(digits, solo, s.secrets, lists, 0, -1, "同じ回数(${round}回)で正解")
            a -> HitBlowState(digits, solo, s.secrets, lists, 0, 0, "${round}回で正解")
            b2 -> HitBlowState(digits, solo, s.secrets, lists, 0, 1, "${round}回で正解")
            round >= MAX_ROUNDS -> HitBlowState(digits, solo, s.secrets, lists, 0, -1, "${MAX_ROUNDS}回で決着がつきませんでした")
            else -> HitBlowState(digits, solo, s.secrets, lists, 0, ONGOING, "")
        }
    }

    override fun outcome(s: HitBlowState): Outcome? = if (s.result == ONGOING) null else Outcome(s.result, s.reason)

    override fun scores(s: HitBlowState): IntArray = IntArray(playerCount) { s.guesses[it].size }

    companion object {
        const val ONGOING = -2
        const val MAX_ROUNDS = 15

        fun digitsOf(code: Int, n: Int): IntArray {
            val d = IntArray(n)
            var x = code
            for (i in n - 1 downTo 0) { d[i] = x % 10; x /= 10 }
            return d
        }

        fun format(code: Int, n: Int): String = digitsOf(code, n).joinToString("")

        fun isValid(code: Int, n: Int): Boolean {
            if (code < 0) return false
            var limit = 1
            repeat(n) { limit *= 10 }
            if (code >= limit) return false
            val d = digitsOf(code, n)
            return d.toSet().size == n
        }

        private val cache = HashMap<Int, IntArray>()

        fun allCodes(n: Int): IntArray = synchronized(cache) {
            cache.getOrPut(n) {
                var limit = 1
                repeat(n) { limit *= 10 }
                (0 until limit).filter { isValid(it, n) }.toIntArray()
            }
        }

        fun randomCode(n: Int, rng: Random): Int {
            val all = allCodes(n)
            return all[rng.nextInt(all.size)]
        }

        /** (hit, blow) */
        fun judge(guess: Int, secret: Int, n: Int): Pair<Int, Int> {
            val g = digitsOf(guess, n)
            val t = digitsOf(secret, n)
            var hit = 0
            var common = 0
            for (i in 0 until n) {
                if (g[i] == t[i]) hit++
                if (g[i] in t) common++
            }
            return hit to (common - hit)
        }

        private fun fits(code: Int, history: List<Guess>, n: Int): Boolean =
            history.all { val (h, b) = judge(it.code, code, n); h == it.hit && b == it.blow }

        /**
         * CPU。自分の質問と答え(guesses[seat])だけを使い、相手の秘密の数は読まない。
         * 初級: 最近の答えにだけ合う数 / 中級: すべての答えに合う数からランダム /
         * 上級: 答えの分かれ方が最も細かくなる(最悪でも候補が一番少なく残る)数を選ぶ。
         */
        val brain = Brain<HitBlowState> { rules, s, seat, level, rng, budget ->
            val n = s.digits
            if (s.settingSecret) return@Brain randomCode(n, rng)
            val history = s.guesses[seat]
            val all = allCodes(n)
            if (history.isEmpty()) return@Brain randomCode(n, rng)
            val used = history.map { it.code }.toSet()
            val cands = all.filter { fits(it, history, n) }
            when (level) {
                Level.EASY -> {
                    val recent = history.takeLast(1)
                    val pool = all.filter { it !in used && fits(it, recent, n) }.ifEmpty { cands }
                    if (rng.nextDouble() < 0.5 && cands.isNotEmpty()) cands[rng.nextInt(cands.size)] else pool[rng.nextInt(pool.size)]
                }
                Level.NORMAL -> cands[rng.nextInt(cands.size)]
                Level.HARD -> {
                    if (cands.size <= 2) return@Brain cands[0]
                    // 上級: 正解の候補から一部(40個)を選び、その中で答えの分かれ方がよい数を選ぶ(すべてを調べる完璧な選び方はしない)
                    val pool = cands.shuffled(rng).take(40)
                    val candSet = cands.toHashSet()
                    var best = Int.MAX_VALUE
                    val bestList = ArrayList<Int>()
                    val counts = IntArray((n + 1) * (n + 1))
                    for (g in pool) {
                        if (budget.over() && bestList.isNotEmpty()) break
                        counts.fill(0)
                        for (c in cands) { val (h, b) = judge(g, c, n); counts[h * (n + 1) + b]++ }
                        val worst = counts.max()
                        if (worst < best) { best = worst; bestList.clear() }
                        if (worst == best) bestList.add(g)
                    }
                    // 同じ点なら、正解の可能性がある数を優先する
                    val inCand = bestList.filter { it in candSet }
                    val pick = inCand.ifEmpty { bestList }
                    pick[rng.nextInt(pick.size)]
                }
            }
        }

        val def = GameDef(
            "hitblow",
            { HitBlow(it.int("digits", 4).coerceIn(3, 4), it.str("mode", "vs") == "solo") },
            brain,
            undoAllowed = false,
            seatsFor = { if (it.str("mode", "vs") == "solo") 1 else 2 },
        )
    }
}
