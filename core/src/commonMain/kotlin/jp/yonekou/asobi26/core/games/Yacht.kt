package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * ヨット(サイコロ5個、12の欄)。1〜6人。手番では最大3回振れる(1回目は全部、2・3回目は残すサイコロを選んで振り直す)。
 * 最後に、まだ使っていない欄を1つ選んで得点を書く(0点でも書く)。全員が12欄を埋めたら終わり。合計の多い人が勝ち。
 * 欄: 0〜5 = 1〜6の目(その目の合計)、6 = チョイス(全部の合計)、7 = フォーダイス(同じ目4つ以上で全部の合計)、
 * 8 = フルハウス(3つ+2つ。5つ同じも可。全部の合計)、9 = Sストレート(4つ続き、15点)、10 = Bストレート(5つ続き、30点)、11 = ヨット(5つ同じ、50点)。
 * 1〜6の目の合計が63点以上で、ボーナス35点。
 * 手: 振る = 残すサイコロの印(0〜31。ビット i が 1 のサイコロ i を残す。1回目は 0 だけ)、欄に書く = 100 + 欄の番号。
 * サイコロの目は seed と振った回数から決まる(同じ記録から同じ目になる)。CPU は seed を見ない。
 */
class YachtState(
    val players: Int,
    val seed: Long,
    val rollCount: Int,
    val dice: IntArray,
    /** この手番の残りの振れる回数(3 = まだ振っていない) */
    val rollsLeft: Int,
    val turn: Int,
    /** sheets[p][欄] = 点(-1 = まだ) */
    val sheets: Array<IntArray>,
    val over: Boolean,
    val lastScored: Int,
) {
    fun total(p: Int): Int = Yacht.total(sheets[p])
}

class Yacht(val players: Int) : Rules<YachtState> {
    override val playerCount = players

    override fun initial(rng: Random) = YachtState(players, rng.nextLong(), 0, IntArray(5), 3, 0, Array(players) { IntArray(CATS) { -1 } }, false, -1)

    override fun toMove(s: YachtState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: YachtState): IntArray {
        if (s.over) return IntArray(0)
        val out = ArrayList<Int>()
        if (s.rollsLeft == 3) return intArrayOf(0)
        if (s.rollsLeft > 0) for (mask in 0 until 31) out.add(mask) // 31 = 全部残す(振る意味がない)は除く
        for (c in 0 until CATS) if (s.sheets[s.turn][c] < 0) out.add(100 + c)
        return out.toIntArray()
    }

    override fun isLegal(s: YachtState, m: Int): Boolean {
        if (s.over) return false
        if (s.rollsLeft == 3) return m == 0
        if (m in 0 until 31) return s.rollsLeft > 0
        val c = m - 100
        return c in 0 until CATS && s.sheets[s.turn][c] < 0
    }

    override fun play(s: YachtState, m: Int): YachtState {
        if (m < 100) {
            val dice = s.dice.copyOf()
            var count = s.rollCount
            for (i in 0 until 5) {
                if (s.rollsLeft == 3 || (m ushr i) and 1 == 0) { dice[i] = die(s.seed, count); count++ }
            }
            return YachtState(players, s.seed, count, dice, s.rollsLeft - 1, s.turn, s.sheets, false, -1)
        }
        val c = m - 100
        val sheets = Array(players) { s.sheets[it].copyOf() }
        sheets[s.turn][c] = score(c, s.dice)
        val next = (s.turn + 1) % players
        val over = sheets.all { sh -> sh.all { it >= 0 } }
        return YachtState(players, s.seed, s.rollCount, IntArray(5), 3, if (over) -1 else next, sheets, over, c)
    }

    override fun outcome(s: YachtState): Outcome? {
        if (!s.over) return null
        val totals = IntArray(players) { s.total(it) }
        val best = totals.max()
        val winners = totals.indices.filter { totals[it] == best }
        return Outcome(if (winners.size == 1) winners[0] else -1, if (players == 1) "${best}点" else "")
    }

    override fun scores(s: YachtState): IntArray = IntArray(players) { s.total(it) }

    companion object {
        const val CATS = 12
        val NAMES = listOf("1の目", "2の目", "3の目", "4の目", "5の目", "6の目", "チョイス", "フォーダイス", "フルハウス", "Sストレート", "Bストレート", "ヨット")

        /** n 回目に振ったサイコロの目(1〜6)。seed から決まる */
        fun die(seed: Long, n: Int): Int {
            var z = seed + (n + 1) * -0x61c8864680b583ebL
            z = (z xor (z ushr 30)) * -0x40a7b892e31b1a47L
            z = (z xor (z ushr 27)) * -0x6b2fb644ecceee15L
            z = z xor (z ushr 31)
            return (((z ushr 1) % 6) + 1).toInt()
        }

        fun score(c: Int, dice: IntArray): Int {
            val counts = IntArray(7)
            for (d in dice) counts[d]++
            val sum = dice.sum()
            return when (c) {
                in 0..5 -> counts[c + 1] * (c + 1)
                6 -> sum
                7 -> if (counts.any { it >= 4 }) sum else 0
                8 -> if (counts.any { it == 5 } || (counts.any { it == 3 } && counts.any { it == 2 })) sum else 0
                9 -> if (run(counts) >= 4) 15 else 0
                10 -> if (run(counts) >= 5) 30 else 0
                11 -> if (counts.any { it == 5 }) 50 else 0
                else -> 0
            }
        }

        private fun run(counts: IntArray): Int {
            var best = 0
            var cur = 0
            for (v in 1..6) { if (counts[v] > 0) { cur++; if (cur > best) best = cur } else cur = 0 }
            return best
        }

        fun upper(sheet: IntArray): Int = (0..5).sumOf { maxOf(0, sheet[it]) }
        fun bonus(sheet: IntArray): Int = if (upper(sheet) >= 63) 35 else 0
        fun total(sheet: IntArray): Int = sheet.sumOf { maxOf(0, it) } + bonus(sheet)

        // ---- CPU(サイコロの未来は見ない。いまの目と得点表だけを使う) ----

        /** 欄 c に今の目を書く価値。目の得点に、ボーナスへの貢献と「大事な欄を0点で潰す損」を加える */
        fun value(c: Int, dice: IntArray, sheet: IntArray): Double {
            val sc = score(c, dice).toDouble()
            return when (c) {
                in 0..5 -> {
                    val face = c + 1
                    val par = face * 3.0 // ボーナスの目安(各目3つ)
                    val needBonus = upper(sheet) < 63
                    sc + (if (needBonus) (sc - par) * 0.6 else 0.0)
                }
                6 -> sc - 22.0 // チョイスは後の保険
                7 -> if (sc > 0) sc + 5 else -14.0
                8 -> if (sc > 0) sc + 4 else -12.0
                9 -> if (sc > 0) sc + 6 else -10.0
                10 -> if (sc > 0) sc + 8 else -16.0
                11 -> if (sc > 0) sc + 20 else -18.0
                else -> sc
            }
        }

        fun bestCategory(dice: IntArray, sheet: IntArray): Pair<Int, Double> {
            var best = -1
            var bestV = Double.NEGATIVE_INFINITY
            for (c in 0 until CATS) if (sheet[c] < 0) {
                val v = value(c, dice, sheet)
                if (v > bestV) { bestV = v; best = c }
            }
            return best to bestV
        }

        /** 残すサイコロ mask で1回振り直した時の、最善の欄の価値の期待値(全部の出目を数える) */
        fun expected(dice: IntArray, mask: Int, sheet: IntArray, budget: Budget?): Double {
            val free = (0 until 5).filter { (mask ushr it) and 1 == 0 }
            val k = free.size
            if (k == 0) return bestCategory(dice, sheet).second
            var total = 0.0
            var n = 0
            val d = dice.copyOf()
            val idx = IntArray(k)
            while (true) {
                for (j in 0 until k) d[free[j]] = idx[j] + 1
                total += bestCategory(d, sheet).second
                n++
                var j = 0
                while (j < k) { idx[j]++; if (idx[j] < 6) break; idx[j] = 0; j++ }
                if (j == k) break
                if (budget != null && (n and 255) == 0 && budget.over()) break
            }
            return total / n
        }

        /** 中級の残し方: いちばん多い目を残す(ストレートが見えたら続きを残す) */
        fun simpleHold(dice: IntArray): Int {
            val counts = IntArray(7)
            for (d in dice) counts[d]++
            val distinct = (1..6).count { counts[it] > 0 }
            if (distinct >= 4 && run(counts) >= 4) {
                // 続きの目を1つずつ残す
                var mask = 0
                val kept = HashSet<Int>()
                for (i in 0 until 5) if (dice[i] !in kept) { kept.add(dice[i]); mask = mask or (1 shl i) }
                return mask
            }
            val face = (1..6).maxWith(compareBy<Int> { counts[it] }.thenBy { it })
            var mask = 0
            for (i in 0 until 5) if (dice[i] == face) mask = mask or (1 shl i)
            return mask
        }

        val brain = Brain<YachtState> { rules, s, seat, level, rng, budget ->
            if (s.rollsLeft == 3) return@Brain 0
            val sheet = s.sheets[seat]
            val (cat, nowV) = bestCategory(s.dice, sheet)
            if (s.rollsLeft == 0) return@Brain 100 + cat
            when (level) {
                Level.EASY -> {
                    // そこそこの点が出たらすぐ書く。それ以外は多い目を残して振る(ボーナスや先の欄は考えない)
                    if (nowV >= 10) 100 + cat else simpleHold(s.dice).let { if (it == 31) 100 + cat else it }
                }
                Level.NORMAL -> {
                    if (nowV >= 28) 100 + cat else simpleHold(s.dice).let { if (it == 31) 100 + cat else it }
                }
                Level.HARD -> {
                    var bestMask = -1
                    var bestE = nowV
                    val seen = HashSet<String>()
                    for (mask in 0 until 31) {
                        // 同じ目の組み合わせを残す mask は1回だけ調べる
                        val key = (0 until 5).filter { (mask ushr it) and 1 == 1 }.map { s.dice[it] }.sorted().joinToString(",")
                        if (!seen.add(key)) continue
                        val e = expected(s.dice, mask, sheet, budget)
                        if (e > bestE + 0.5) { bestE = e; bestMask = mask }
                        if (budget.over()) break
                    }
                    if (bestMask >= 0) bestMask else 100 + cat
                }
            }
        }

        val def = GameDef("yacht", { Yacht(it.int("players", 2).coerceIn(1, 6)) }, brain, undoAllowed = false, seatsFor = { it.int("players", 2).coerceIn(1, 6) })
    }
}
