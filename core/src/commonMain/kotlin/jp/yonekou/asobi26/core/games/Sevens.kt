package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * 7ならべ。2〜6人。52枚を全部配り、4枚の7を場に出してから、♦7 を持っていた人から始める。
 * 手番では、場の列(7から続く同じマークの並び)の両端の隣の札を1枚出す。出さずにパスもできる(3回まで。4回目のパスで失格)。
 * 失格した人の札は、すべて場の決まった位置に置く。手札を早くなくした順に順位が付く。
 * トンネル(設定): A の次に K、K の次に A を出せる。
 * 手 = 札の番号(0〜51)、PASS。札の並びは Cards と同じ(マーク*13 + 数-2。A は 12)。CPU は自分の手札と場だけを見る。
 */
class SevensState(
    val players: Int,
    /** 手札(ビット c が 1 = 札 c を持つ) */
    val hands: LongArray,
    /** 場に出た札 */
    val table: Long,
    /** 使ったパスの回数 */
    val passes: IntArray,
    /** 順位(0 = 1位。-1 = まだ) */
    val place: IntArray,
    /** 失格した人 */
    val out: BooleanArray,
    val turn: Int,
    val lastMove: Int,
    val lastMover: Int,
    val tunnel: Boolean,
    val over: Boolean,
) {
    fun count(p: Int) = hands[p].countOneBits()
    fun has(p: Int, c: Int) = (hands[p] shr c) and 1L == 1L
    fun onTable(c: Int) = (table shr c) and 1L == 1L
}

class Sevens(val players: Int, val tunnel: Boolean) : Rules<SevensState> {
    override val playerCount = players

    override fun initial(rng: Random): SevensState {
        val d = IntArray(52) { it }
        for (i in 51 downTo 1) { val j = rng.nextInt(i + 1); val t = d[i]; d[i] = d[j]; d[j] = t }
        val hands = LongArray(players)
        for ((k, c) in d.withIndex()) hands[k % players] = hands[k % players] or (1L shl c)
        var table = 0L
        var first = 0
        for (s in 0 until 4) {
            val seven = s * 13 + 5
            table = table or (1L shl seven)
            for (p in 0 until players) if ((hands[p] shr seven) and 1L == 1L) {
                hands[p] = hands[p] and (1L shl seven).inv()
                if (s == 2) first = p // ♦7 を持っていた人から
            }
        }
        return SevensState(players, hands, table, IntArray(players), IntArray(players) { -1 }, BooleanArray(players), first, -1, -1, tunnel, false)
    }

    override fun toMove(s: SevensState) = if (s.over) -1 else s.turn

    override fun legalMoves(s: SevensState): IntArray {
        if (s.over) return IntArray(0)
        val out = ArrayList<Int>()
        for (c in playable(s.table, tunnel)) if (s.has(s.turn, c)) out.add(c)
        out.add(PASS)
        return out.toIntArray()
    }

    override fun play(s: SevensState, m: Int): SevensState {
        val p = s.turn
        val hands = s.hands.copyOf()
        var table = s.table
        val passes = s.passes.copyOf()
        val place = s.place.copyOf()
        val out = s.out.copyOf()
        if (m == PASS) {
            passes[p]++
            if (passes[p] > MAX_PASS) {
                // 失格: 札は全部、場の決まった位置へ
                out[p] = true
                table = table or hands[p]
                hands[p] = 0L
            }
        } else {
            hands[p] = hands[p] and (1L shl m).inv()
            table = table or (1L shl m)
            if (hands[p] == 0L) place[p] = (0 until players).count { place[it] >= 0 && !out[it] }
        }
        val alive = (0 until players).filter { place[it] < 0 && !out[it] }
        if (alive.size <= 1) {
            // 最後の1人と失格した人に順位を付けて終わり(失格は、後で失格した人ほど上)
            var next = (0 until players).count { place[it] >= 0 }
            for (q in alive) place[q] = next++
            val outs = (0 until players).filter { out[it] && place[it] < 0 }
            // 失格の順は記録していないので、席の順で並べる(順位は同じ「失格」として表示する)
            for (q in outs) place[q] = next++
            return SevensState(players, hands, table, passes, place, out, p, m, p, tunnel, true)
        }
        var n = p
        do { n = (n + 1) % players } while (place[n] >= 0 || out[n])
        return SevensState(players, hands, table, passes, place, out, n, m, p, tunnel, false)
    }

    override fun outcome(s: SevensState): Outcome? {
        if (!s.over) return null
        val w = s.place.indexOfFirst { it == 0 }
        return Outcome(w, "")
    }

    /** 残りの札の枚数(表示用) */
    override fun scores(s: SevensState): IntArray = IntArray(players) { s.count(it) }

    companion object {
        const val PASS = 52
        const val MAX_PASS = 3

        /** 数(1〜13。A = 1)とマークから札の番号 */
        fun card(suit: Int, n: Int): Int = suit * 13 + (if (n == 1) 12 else n - 2)
        fun num(c: Int): Int = Cards.rank(c).let { if (it == 14) 1 else it }

        /** 7から続く列の、下の端・上の端の数(トンネルでは A の下に K が続く) */
        fun ends(table: Long, suit: Int, tunnel: Boolean): Pair<Int, Int> {
            fun on(n: Int) = (table shr card(suit, n)) and 1L == 1L
            var lo = 7
            var steps = 0
            while (steps < 12) {
                val nx = if (lo == 1) (if (tunnel) 13 else 0) else lo - 1
                if (nx == 0 || !on(nx)) break
                lo = nx; steps++
            }
            var hi = 7
            while (steps < 12) {
                val nx = if (hi == 13) (if (tunnel) 1 else 0) else hi + 1
                if (nx == 0 || !on(nx) || nx == lo) break
                hi = nx; steps++
            }
            return lo to hi
        }

        /** いま場に出せる札(誰が持っているかは問わない) */
        fun playable(table: Long, tunnel: Boolean): List<Int> {
            val out = ArrayList<Int>()
            for (s in 0 until 4) {
                val (lo, hi) = ends(table, s, tunnel)
                val down = if (lo == 1) (if (tunnel) 13 else 0) else lo - 1
                val up = if (hi == 13) (if (tunnel) 1 else 0) else hi + 1
                for (n in listOf(down, up)) if (n != 0 && (table shr card(s, n)) and 1L == 0L) { val c = card(s, n); if (c !in out) out.add(c) }
            }
            return out
        }

        /** 札 c を出すと、その先(7から遠い側)に続く札のうち、自分が持っている枚数とそれ以外の枚数 */
        fun beyond(s: SevensState, me: Int, c: Int): Pair<Int, Int> {
            val suit = Cards.suit(c)
            val n = num(c)
            val (lo, _) = ends(s.table, suit, s.tunnel)
            val goingDown = n == (if (lo == 1) (if (s.tunnel) 13 else 0) else lo - 1)
            var mine = 0; var others = 0
            var k = n
            repeat(12) {
                k = if (goingDown) (if (k == 1) (if (s.tunnel) 13 else 0) else k - 1) else (if (k == 13) (if (s.tunnel) 1 else 0) else k + 1)
                if (k == 0 || k == 7) return mine to others
                val cc = card(suit, k)
                if (s.onTable(cc)) return mine to others
                if (s.has(me, cc)) mine++ else others++
            }
            return mine to others
        }

        val brain = Brain<SevensState> { rules, s, seat, level, rng, _ ->
            val legal = rules.legalMoves(s).filter { it != PASS }
            if (legal.isEmpty()) return@Brain PASS
            if (level == Level.EASY) return@Brain legal[rng.nextInt(legal.size)]
            // 出した先に自分の札が続くほど良い。他の人の札だけを開ける札は、後に回す(止め札)
            fun score(c: Int): Double {
                val (mine, others) = beyond(s, seat, c)
                return mine * 2.0 - others * (if (level == Level.HARD) 0.6 else 0.3) + (if (others == 0) 1.5 else 0.0) + rng.nextDouble() * 0.2
            }
            val best = legal.maxBy { score(it) }
            if (level == Level.HARD) {
                // 上級: どの札も相手を助けるだけで、パスに余裕があり、手札がまだ多い時は、パスで止める
                val (mine, others) = beyond(s, seat, best)
                val left = MAX_PASS - s.passes[seat]
                if (mine == 0 && others >= 3 && left >= 2 && s.count(seat) >= 4) return@Brain PASS
            }
            best
        }

        val def = GameDef(
            "sevens",
            { Sevens(it.int("players", 4).coerceIn(2, 6), it.str("tunnel", "off") == "on") },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 4).coerceIn(2, 6) },
        )
    }
}
