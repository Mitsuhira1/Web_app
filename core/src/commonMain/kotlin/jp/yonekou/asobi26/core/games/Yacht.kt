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

        /**
         * 初級・中級の残し方: 空いている欄で役に立つかどうかで決める(0.5.15)。
         * 候補ごとに「役に立つ度合い」を数えて、いちばん大きい候補を残す。どれも 0 なら全部振り直す(0)。
         * 全部残す(31)になる時は、呼ぶ側が「すぐ書く」に切り替える。
         */
        fun simpleHold(dice: IntArray, sheet: IntArray): Int {
            val counts = IntArray(7)
            for (d in dice) counts[d]++
            var bestMask = 0
            var bestScore = 0.0
            // 同じ目を n 個残す
            for (f in 1..6) {
                val n = counts[f]
                if (n == 0) continue
                var sc = 0.0
                if (sheet[f - 1] < 0) sc = maxOf(sc, n + f / 10.0)
                if ((sheet[7] < 0 || sheet[11] < 0) && n >= 2) sc = maxOf(sc, n * 0.9 + 0.1)
                if (sheet[8] < 0 && n >= 2) sc = maxOf(sc, n * 0.8)
                if (sheet[6] < 0 && f >= 4) sc = maxOf(sc, n * 0.3 + f / 10.0)
                if (sc > bestScore) {
                    bestScore = sc
                    var mask = 0
                    for (i in 0 until 5) if (dice[i] == f) mask = mask or (1 shl i)
                    bestMask = mask
                }
            }
            // ストレートの窓(長さ4: 1-4・2-5・3-6 / 長さ5: 1-5・2-6)。窓の目は1種類につき1個だけ残す
            fun window(lo: Int, len: Int) {
                var h = 0
                var tie = 0.0
                var mask = 0
                for (f in lo until lo + len) if (counts[f] > 0) {
                    h++
                    if (f == 3 || f == 4) tie += 0.01
                    for (i in 0 until 5) if (dice[i] == f) { mask = mask or (1 shl i); break }
                }
                val sc = (if (len == 4) when (h) { 4 -> 5.0; 3 -> 2.2; else -> h * 0.5 }
                          else when (h) { 5 -> 6.0; 4 -> 3.4; 3 -> 2.2; else -> h * 0.5 }) + tie
                if (sc > bestScore) { bestScore = sc; bestMask = mask }
            }
            if (sheet[9] < 0) for (lo in 1..3) window(lo, 4)
            if (sheet[10] < 0) for (lo in 1..2) window(lo, 5)
            return bestMask
        }

        // ---- 上級: 2回先まで読む(目は「個数の組」で数える。重みは 多項係数 ÷ 6^k) ----

        /** k 個のサイコロの出目の組(昇順)と、その出る確率 */
        private val outcomeTables: Array<Pair<List<IntArray>, DoubleArray>> by lazy {
            Array(6) { k ->
                val list = ArrayList<IntArray>()
                val w = ArrayList<Double>()
                val cur = IntArray(k)
                fun rec(pos: Int, from: Int) {
                    if (pos == k) {
                        // 多項係数 k! / (c1! … c6!)
                        val c = IntArray(7)
                        for (v in cur) c[v]++
                        var m = 1.0
                        for (x in 2..k) m *= x
                        for (v in 1..6) for (x in 2..c[v]) m /= x
                        list.add(cur.copyOf()); w.add(m)
                        return
                    }
                    for (v in from..6) { cur[pos] = v; rec(pos + 1, v) }
                }
                rec(0, 1)
                var total = 1.0
                repeat(k) { total *= 6.0 }
                list to DoubleArray(w.size) { w[it] / total }
            }
        }

        private const val V2_BASE = 1 shl 20 // v2 の記憶の番地は、v1 と重ならないようにずらす
        private fun key(sorted: IntArray): Int { var k = 0; for (d in sorted) k = k * 7 + d; return k }

        /** kept(残す目)に k 個を振り足した時の f の期待値 */
        private fun expect(kept: IntArray, k: Int, budget: Budget?, f: (IntArray) -> Double): Double {
            val (list, ws) = outcomeTables[k]
            val all = IntArray(5)
            var sum = 0.0
            for (t in list.indices) {
                val o = list[t]
                for (a in kept.indices) all[a] = kept[a]
                for (a in 0 until k) all[kept.size + a] = o[a]
                val d = all.copyOf(); d.sort()
                sum += ws[t] * f(d)
                if (budget != null && (t and 31) == 31 && budget.over()) { return sum / ws.take(t + 1).sum() }
            }
            return sum
        }

        /** 同じ目の組み合わせを残す mask を1つずつ(昇順の目の並びで返す) */
        private fun keepChoices(dice: IntArray): List<Pair<Int, IntArray>> {
            val seen = HashSet<Int>()
            val out = ArrayList<Pair<Int, IntArray>>()
            for (mask in 0 until 31) {
                val kept = (0 until 5).filter { (mask ushr it) and 1 == 1 }.map { dice[it] }.toIntArray().also { it.sort() }
                // 残す数の違う組が同じ key にならないよう、長さも混ぜる
                if (!seen.add(key(kept) * 8 + kept.size)) continue
                out.add(mask to kept)
            }
            return out
        }

        /** 振り直さずに書く時の価値(従来の bestCategory) */
        private fun v1(dice: IntArray, sheet: IntArray, memo: HashMap<Int, Double>): Double {
            val sorted = dice.copyOf().also { it.sort() }
            val k = key(sorted)
            return memo.getOrPut(k) { bestCategory(sorted, sheet).second }
        }

        /** あと1回振れる時の価値: いま書くか、どこかを残して1回振るかの良い方 */
        private fun v2(dice: IntArray, sheet: IntArray, memo: HashMap<Int, Double>, budget: Budget?): Double {
            val sorted = dice.copyOf().also { it.sort() }
            val k = key(sorted) + V2_BASE
            memo[k]?.let { return it }
            var best = v1(sorted, sheet, memo)
            for ((_, kept) in keepChoices(sorted)) {
                val e = expect(kept, 5 - kept.size, budget) { v1(it, sheet, memo) }
                if (e > best) best = e
            }
            memo[k] = best
            return best
        }

        val brain = Brain<YachtState> { rules, s, seat, level, rng, budget ->
            if (s.rollsLeft == 3) return@Brain 0
            val sheet = s.sheets[seat]
            val (cat, nowV) = bestCategory(s.dice, sheet)
            if (s.rollsLeft == 0) return@Brain 100 + cat
            when (level) {
                Level.EASY -> {
                    // そこそこの点が出たらすぐ書く。それ以外は多い目を残して振る(ボーナスや先の欄は考えない)
                    if (nowV >= 10) 100 + cat else simpleHold(s.dice, sheet).let { if (it == 31) 100 + cat else it }
                }
                Level.NORMAL -> {
                    if (nowV >= 28) 100 + cat else simpleHold(s.dice, sheet).let { if (it == 31) 100 + cat else it }
                }
                Level.HARD -> {
                    // 上級: 2回振れる手番では2回先まで、最後の1回では1回先まで読む。いま書く価値より 0.5 以上よければ残して振る
                    var bestMask = -1
                    var bestE = nowV
                    val memo = HashMap<Int, Double>()
                    for ((mask, kept) in keepChoices(s.dice)) {
                        val k = 5 - kept.size
                        val e = if (s.rollsLeft >= 2) expect(kept, k, budget) { v2(it, sheet, memo, budget) }
                                else expect(kept, k, budget) { v1(it, sheet, memo) }
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
