package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.softPick
import kotlin.random.Random

/**
 * ルドー(2〜4人)。各自4つの駒を、サイコロで盤を一周させてゴールに入れる。
 * slot: 席ごとの色の位置(0=赤 1=緑 2=黄 3=青。2人なら向かい合う 0 と 2)。出発のマスは slot*13。
 * pos[席][駒]: -1 = 家(スタート前)、0〜50 = 周回のマス(出発からの進み)、51〜55 = ゴールへの道、56 = ゴール。
 * 手: ROLL(振る)/PASS(動かせない)/ 1〜4(その番号の駒を動かす)。
 */
class LudoState(
    val n: Int,
    val seed: Long,
    val rolls: Int,
    val pos: Array<IntArray>,
    /** 出た目(0 = まだ振っていない) */
    val die: Int,
    /** この手番で続けて出た6の数 */
    val sixes: Int,
    val turn: Int,
    val winner: Int,
    val lastMove: Int,
    /** 直前の手で取った相手の駒(席*4+駒。-1 = なし) */
    val captured: Int,
    /** 直前の手を指した席 */
    val mover: Int,
) {
    val over: Boolean get() = winner >= 0
    fun home(seat: Int): Int = pos[seat].count { it == Ludo.GOAL }
}

class Ludo(val players: Int) : Rules<LudoState> {
    override val playerCount = players

    /** 席 → 色の位置 */
    val slots: IntArray = when (players) { 2 -> intArrayOf(0, 2); 3 -> intArrayOf(0, 1, 2); else -> intArrayOf(0, 1, 2, 3) }

    override fun initial(rng: Random) = LudoState(players, rng.nextLong(), 0, Array(players) { IntArray(4) { -1 } }, 0, 0, 0, -1, -1, -1, -1)

    override fun toMove(s: LudoState): Int = if (s.over) -1 else s.turn

    /** 周回のマスの通し番号(0〜51)。周回にいない時は -1 */
    fun square(seat: Int, p: Int): Int = if (p in 0..50) (slots[seat] * 13 + p) % 52 else -1

    private fun die(seed: Long, k: Int): Int = Random(seed * 131 + k * 104_729L + 7).nextInt(1, 7)

    fun canMove(s: LudoState, seat: Int, token: Int, d: Int): Boolean {
        val p = s.pos[seat][token]
        if (p == GOAL) return false
        if (p < 0) return d == 6
        return p + d <= GOAL
    }

    override fun legalMoves(s: LudoState): IntArray {
        if (s.over) return IntArray(0)
        if (s.die == 0) return intArrayOf(ROLL)
        // 3回続けて6なら、その手番は終わり
        if (s.sixes >= 3) return intArrayOf(PASS)
        val out = (0 until 4).filter { canMove(s, s.turn, it, s.die) }.map { it + 1 }
        return if (out.isEmpty()) intArrayOf(PASS) else out.toIntArray()
    }

    override fun play(s: LudoState, m: Int): LudoState {
        val seat = s.turn
        if (m == ROLL) {
            val d = die(s.seed, s.rolls)
            return LudoState(players, s.seed, s.rolls + 1, s.pos, d, if (d == 6) s.sixes + 1 else s.sixes, seat, -1, m, -1, seat)
        }
        val next = (seat + 1) % players
        if (m == PASS) return LudoState(players, s.seed, s.rolls, s.pos, 0, 0, next, -1, m, -1, seat)
        val token = m - 1
        val pos = Array(players) { s.pos[it].copyOf() }
        val from = pos[seat][token]
        val to = if (from < 0) 0 else from + s.die
        pos[seat][token] = to
        var cap = -1
        val sq = square(seat, to)
        if (sq >= 0 && sq !in SAFE) {
            for (o in 0 until players) if (o != seat) for (k in 0 until 4) {
                if (square(o, pos[o][k]) == sq) { pos[o][k] = -1; cap = o * 4 + k }
            }
        }
        if (pos[seat].all { it == GOAL }) return LudoState(players, s.seed, s.rolls, pos, 0, 0, seat, seat, m, cap, seat)
        // 6が出たら、もう一度振れる
        val again = s.die == 6
        return LudoState(players, s.seed, s.rolls, pos, 0, if (again) s.sixes else 0, if (again) seat else next, -1, m, cap, seat)
    }

    override fun outcome(s: LudoState): Outcome? = if (s.over) Outcome(s.winner, "") else null

    override fun scores(s: LudoState): IntArray = IntArray(players) { s.home(it) }

    // ---------------- CPU ----------------

    /** 周回のマス sq を、相手の駒がサイコロ1回(1〜6)で狙える数 */
    private fun threats(s: LudoState, pos: Array<IntArray>, seat: Int, sq: Int): Int {
        if (sq < 0 || sq in SAFE) return 0
        var t = 0
        for (o in 0 until players) if (o != seat) for (k in 0 until 4) {
            val p = pos[o][k]
            if (p < 0) {
                // 家にいる駒は、6で出発のマスに出る
                if (slots[o] * 13 == sq) t++
                continue
            }
            if (p > 50) continue
            for (d in 1..6) if (p + d <= 50 && square(o, p + d) == sq) { t++; break }
        }
        return t
    }

    fun moveValue(s: LudoState, m: Int, careful: Boolean): Double {
        val seat = s.turn
        val token = m - 1
        val from = s.pos[seat][token]
        val after = play(s, m)
        val to = after.pos[seat][token]
        var v = (to - maxOf(from, 0)).toDouble()
        if (from < 0) v += 25.0
        if (to == GOAL) v += 40.0
        if (to in 51..55) v += 12.0
        if (after.captured >= 0) v += 45.0 + s.pos[after.captured / 4][after.captured % 4] * 0.5
        val sq = square(seat, to)
        if (sq in SAFE) v += 8.0
        if (careful) {
            v -= threats(s, after.pos, seat, sq) * (14.0 + to * 0.4)
            if (from in 0..50) v += threats(s, s.pos, seat, square(seat, from)) * (12.0 + from * 0.4)
        }
        return v
    }

    companion object {
        const val ROLL = 0
        const val PASS = 99
        const val GOAL = 56
        /** 取られないマス(各色の出発のマスと、星のマス) */
        val SAFE = setOf(0, 8, 13, 21, 26, 34, 39, 47)

        val brain = Brain<LudoState> { rules, s, _, level, rng, _ ->
            val g = rules as Ludo
            val legal = g.legalMoves(s)
            if (legal.size == 1) return@Brain legal[0]
            val ms = legal.toList()
            when (level) {
                Level.EASY -> softPick(rng, ms, 18.0) { g.moveValue(s, it, careful = false) }
                Level.NORMAL -> softPick(rng, ms, 5.0) { g.moveValue(s, it, careful = true) }
                Level.HARD -> ms.maxBy { g.moveValue(s, it, careful = true) }
            }
        }

        val def = GameDef(
            "ludo",
            { Ludo(it.int("players", 4).coerceIn(2, 4)) },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 4).coerceIn(2, 4) },
            passMove = PASS,
        )
    }
}
