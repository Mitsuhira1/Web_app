package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.AlphaBeta
import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.ThreadLocal
import kotlin.random.Random

/**
 * ウサギと猟犬(11点の盤)。席0=猟犬(3匹、先手)、席1=ウサギ。
 *       1 - 4 - 7
 *     / | \ | / | \
 *    0 -2 - 5 - 8- 10
 *     \ | / | \ | /
 *       3 - 6 - 9
 * 猟犬は前(右)か上下にだけ進める(後ろ=左へは戻れない)。ウサギはどの向きにも進める。どれも線でつながった隣の空いた点へ1つ。
 * 猟犬の勝ち: ウサギの番にウサギが動けない。
 * ウサギの勝ち: すべての猟犬より左(後ろ)へ回り込む / 猟犬が10回続けて上下にだけ動く / ウサギが逃げ続けて合計120手になる。
 * 手: 元*11+先。
 */
class HareState(val board: IntArray, val turn: Int, val vertical: Int, val plies: Int, val winner: Int, val reason: String, val lastMove: Int)

object HareHounds : Rules<HareState> {
    const val HOUND = 1
    const val HARE = 2
    const val STALL_LIMIT = 10
    const val PLY_LIMIT = 120

    /** 点の横位置(0〜4) */
    val X = intArrayOf(0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4)

    val ADJ: Array<IntArray> = run {
        val edges = listOf(
            0 to 1, 0 to 2, 0 to 3, 1 to 2, 2 to 3, 1 to 4, 2 to 5, 3 to 6, 1 to 5, 3 to 5,
            4 to 5, 5 to 6, 4 to 7, 5 to 8, 6 to 9, 5 to 7, 5 to 9, 7 to 8, 8 to 9, 7 to 10, 8 to 10, 9 to 10,
        )
        val lists = Array(11) { ArrayList<Int>() }
        for ((a, b) in edges) { lists[a].add(b); lists[b].add(a) }
        Array(11) { lists[it].sorted().toIntArray() }
    }

    override val playerCount = 2

    override fun initial(rng: Random): HareState {
        val b = IntArray(11)
        b[0] = HOUND; b[1] = HOUND; b[3] = HOUND; b[10] = HARE
        return HareState(b, 0, 0, 0, -1, "", -1)
    }

    override fun toMove(s: HareState): Int = if (s.winner >= 0) -1 else s.turn

    fun movesOf(board: IntArray, turn: Int): IntArray {
        val out = ArrayList<Int>()
        for (f in 0 until 11) {
            if (turn == 0 && board[f] != HOUND) continue
            if (turn == 1 && board[f] != HARE) continue
            for (t in ADJ[f]) {
                if (board[t] != 0) continue
                if (turn == 0 && X[t] < X[f]) continue // 猟犬は後ろへ戻れない
                out.add(f * 11 + t)
            }
        }
        return out.toIntArray()
    }

    override fun legalMoves(s: HareState): IntArray = if (s.winner >= 0) IntArray(0) else movesOf(s.board, s.turn)

    override fun play(s: HareState, m: Int): HareState {
        val f = m / 11
        val t = m % 11
        val b = s.board.copyOf()
        b[t] = b[f]
        b[f] = 0
        val plies = s.plies + 1
        if (s.turn == 0) {
            val vertical = if (X[t] == X[f]) s.vertical + 1 else 0
            val hare = b.indexOf(HARE)
            if (movesOf(b, 1).isEmpty()) return HareState(b, 1, vertical, plies, 0, "ウサギを追い詰めました", m)
            if (vertical >= STALL_LIMIT) return HareState(b, 1, vertical, plies, 1, "猟犬が${STALL_LIMIT}回続けて上下に動きました", m)
            if (escaped(b, hare)) return HareState(b, 1, vertical, plies, 1, "ウサギが逃げ切りました", m)
            return HareState(b, 1, vertical, plies, -1, "", m)
        }
        if (escaped(b, t)) return HareState(b, 0, s.vertical, plies, 1, "ウサギが逃げ切りました", m)
        if (plies >= PLY_LIMIT) return HareState(b, 0, s.vertical, plies, 1, "ウサギが${PLY_LIMIT}手逃げ続けました", m)
        if (movesOf(b, 0).isEmpty()) return HareState(b, 0, s.vertical, plies, 1, "猟犬が動けなくなりました", m)
        return HareState(b, 0, s.vertical, plies, -1, "", m)
    }

    /** ウサギがすべての猟犬より左にいる */
    private fun escaped(b: IntArray, hare: Int): Boolean =
        (0 until 11).filter { b[it] == HOUND }.all { X[it] > X[hare] }

    override fun outcome(s: HareState): Outcome? = if (s.winner >= 0) Outcome(s.winner, s.reason) else null

    // ---- CPU ----
    fun evaluate(s: HareState, me: Int): Int {
        val hare = s.board.indexOf(HARE)
        val hounds = (0 until 11).filter { s.board[it] == HOUND }
        val hareMob = ADJ[hare].count { s.board[it] == 0 }
        val behind = hounds.count { X[it] <= X[hare] } // ウサギより左(後ろ)にいない猟犬は良くない
        val houndScore = -hareMob * 30 - behind * 20 + hounds.sumOf { X[it] } * 4 - s.vertical * 6 - X[hare] * 3
        return if (me == 0) houndScore else -houndScore
    }

    private val search = ThreadLocal.withInitial { AlphaBeta(HareHounds, ::evaluate) }

    val brain = Brain<HareState> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        when (level) {
            Level.EASY -> search.get().pick(s, seat, 2, budget, rng, temp = 30)
            Level.NORMAL -> search.get().pick(s, seat, 4, budget, rng, temp = 10)
            Level.HARD -> search.get().pick(s, seat, 8, budget, rng, temp = 5) // 上手な人くらい
        }
    }

    val def = GameDef("hare", { HareHounds }, brain)
}
