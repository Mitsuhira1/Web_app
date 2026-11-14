import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.games.Yacht
import jp.yonekou.asobi26.core.games.YachtState
import kotlin.random.Random

/** ヨットの CPU の試験(0.5.15 の申し送りの確認): ストレートの残し方と、強さの順(上級 > 中級 > 初級) */
fun yachtCheck(): String {
    val sb = StringBuilder()
    var bad = 0
    fun check(name: String, ok: Boolean) { if (!ok) bad++; sb.append(if (ok) "OK " else "NG ").append(name).append('\n') }

    // 1) 空いている欄が S・B ストレートだけ、目 [3,3,1,3,2]、残り振り直し 2 回 → 2個以上残し、同じ目を重ねて残さない
    val rules = Yacht(2)
    val sheet = IntArray(Yacht.CATS) { if (it == 9 || it == 10) -1 else 0 }
    val st = YachtState(2, 1L, 0, intArrayOf(3, 3, 1, 3, 2), 2, 0, arrayOf(sheet.copyOf(), IntArray(Yacht.CATS)), false, -1)
    for (lv in Level.values()) {
        val m = Yacht.brain.choose(rules, st, 0, lv, Random(1), Budget(2000))
        val kept = if (m in 0..30) (0 until 5).filter { (m ushr it) and 1 == 1 }.map { st.dice[it] } else emptyList()
        check("ストレートだけ空き(${lv.label}): 残す=$kept", m in 0..30 && kept.size >= 2 && kept.toSet().size == kept.size)
    }

    // 2) 強さ: ひとりで 60 回ずつ最後まで遊んだ平均点
    val avg = HashMap<Level, Double>()
    var slowest = 0L
    for (lv in Level.values()) {
        var sum = 0L
        repeat(60) { g ->
            val r = Yacht(1)
            var s = r.initial(Random(1000L + g))
            var guard = 0
            while (r.toMove(s) >= 0 && guard++ < 200) {
                val t0 = System.nanoTime()
                val m = Yacht.brain.choose(r, s, 0, lv, Random(g), Budget(5000))
                slowest = maxOf(slowest, System.nanoTime() - t0)
                s = r.play(s, m)
            }
            sum += s.total(0)
        }
        avg[lv] = sum / 60.0
        sb.append("平均点 ${lv.label}: ${"%.1f".format(sum / 60.0)}\n")
    }
    sb.append("1手の最長: ${slowest / 1_000_000} ms\n")
    check("強さ: 上級 > 中級 > 初級", avg[Level.HARD]!! > avg[Level.NORMAL]!! && avg[Level.NORMAL]!! > avg[Level.EASY]!!)
    sb.append(if (bad == 0) "すべて通りました\n" else "$bad 件が通りませんでした\n")
    return sb.toString()
}
