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
 * ナインメンズモリス。点は24個(3重の四角)。席0=白(先手)、席1=黒。各9個。
 *  0-----1-----2
 *  | 3---4---5 |
 *  | | 6-7-8 | |
 *  9-10-11 12-13-14
 *  | |15-16-17| |
 *  | 18--19--20 |
 *  21----22----23
 * 手: 置く=点の番号(0..23)、動かす=100+元*24+先、取る=1000+点の番号。
 * 3つ並べる(ミル)と、続けて相手のコマを1つ取る(ミルに入っていないもの。全部ミルなら何でも)。
 * 置き終わったら隣へ動かす。自分のコマが3つになったら、どこへでも飛べる。
 * 相手のコマを2つ以下にするか、相手が動けなくなったら勝ち。置き終わった後、取り合いなしで100手続いたら引き分け。
 */
class MorrisState(
    val board: IntArray,
    val inHand: IntArray,
    val turn: Int,
    /** ミルを作ったので、続けて相手のコマを取る番 */
    val removing: Boolean,
    val quiet: Int,
    val winner: Int,
    val over: Boolean,
    val lastMove: Int,
) {
    fun count(p: Int): Int = board.count { it == p + 1 }
}

object Morris : Rules<MorrisState> {
    val ADJ: Array<IntArray> = arrayOf(
        intArrayOf(1, 9), intArrayOf(0, 2, 4), intArrayOf(1, 14), intArrayOf(4, 10), intArrayOf(1, 3, 5, 7), intArrayOf(4, 13),
        intArrayOf(7, 11), intArrayOf(4, 6, 8), intArrayOf(7, 12), intArrayOf(0, 10, 21), intArrayOf(3, 9, 11, 18), intArrayOf(6, 10, 15),
        intArrayOf(8, 13, 17), intArrayOf(5, 12, 14, 20), intArrayOf(2, 13, 23), intArrayOf(11, 16), intArrayOf(15, 17, 19), intArrayOf(12, 16),
        intArrayOf(10, 19), intArrayOf(16, 18, 20, 22), intArrayOf(13, 19), intArrayOf(9, 22), intArrayOf(19, 21, 23), intArrayOf(14, 22),
    )
    val MILLS: Array<IntArray> = arrayOf(
        intArrayOf(0, 1, 2), intArrayOf(3, 4, 5), intArrayOf(6, 7, 8), intArrayOf(9, 10, 11), intArrayOf(12, 13, 14), intArrayOf(15, 16, 17),
        intArrayOf(18, 19, 20), intArrayOf(21, 22, 23), intArrayOf(0, 9, 21), intArrayOf(3, 10, 18), intArrayOf(6, 11, 15), intArrayOf(1, 4, 7),
        intArrayOf(16, 19, 22), intArrayOf(8, 12, 17), intArrayOf(5, 13, 20), intArrayOf(2, 14, 23),
    )
    const val QUIET_LIMIT = 100

    override val playerCount = 2

    override fun initial(rng: Random) = MorrisState(IntArray(24), intArrayOf(9, 9), 0, false, 0, -1, false, -1)

    override fun toMove(s: MorrisState): Int = if (s.over) -1 else s.turn

    fun inMill(board: IntArray, i: Int): Boolean {
        val v = board[i]
        if (v == 0) return false
        return MILLS.any { m -> i in m && m.all { board[it] == v } }
    }

    override fun legalMoves(s: MorrisState): IntArray {
        if (s.over) return IntArray(0)
        val me = s.turn + 1
        val opp = 2 - s.turn
        val out = ArrayList<Int>()
        if (s.removing) {
            val opps = (0 until 24).filter { s.board[it] == opp }
            val free = opps.filter { !inMill(s.board, it) }
            for (i in free.ifEmpty { opps }) out.add(1000 + i)
        } else if (s.inHand[s.turn] > 0) {
            for (i in 0 until 24) if (s.board[i] == 0) out.add(i)
        } else {
            val flying = s.count(s.turn) == 3
            for (f in 0 until 24) {
                if (s.board[f] != me) continue
                if (flying) { for (t in 0 until 24) if (s.board[t] == 0) out.add(100 + f * 24 + t) }
                else for (t in ADJ[f]) if (s.board[t] == 0) out.add(100 + f * 24 + t)
            }
        }
        return out.toIntArray()
    }

    override fun play(s: MorrisState, m: Int): MorrisState {
        val board = s.board.copyOf()
        val hand = s.inHand.copyOf()
        val me = s.turn
        if (m >= 1000) {
            board[m - 1000] = 0
            return finishTurn(board, hand, me, 0, m)
        }
        val dest: Int
        if (m >= 100) {
            val f = (m - 100) / 24
            dest = (m - 100) % 24
            board[f] = 0
            board[dest] = me + 1
        } else {
            dest = m
            board[dest] = me + 1
            hand[me]--
        }
        if (inMill(board, dest)) {
            // 取れる相手のコマがあれば、続けて取る
            if (board.any { it == 2 - me }) return MorrisState(board, hand, me, true, s.quiet, -1, false, m)
        }
        val placingDone = hand[0] == 0 && hand[1] == 0
        return finishTurn(board, hand, me, if (placingDone) s.quiet + 1 else 0, m)
    }

    /** 手番を相手に渡し、勝ち負け・引き分けを判定する */
    private fun finishTurn(board: IntArray, hand: IntArray, me: Int, quiet: Int, m: Int): MorrisState {
        val opp = 1 - me
        val oppTotal = board.count { it == opp + 1 } + hand[opp]
        if (oppTotal < 3) return MorrisState(board, hand, opp, false, quiet, me, true, m)
        val next = MorrisState(board, hand, opp, false, quiet, -1, false, m)
        if (legalMoves(next).isEmpty()) return MorrisState(board, hand, opp, false, quiet, me, true, m)
        if (quiet >= QUIET_LIMIT) return MorrisState(board, hand, opp, false, quiet, -1, true, m)
        return next
    }

    override fun outcome(s: MorrisState): Outcome? {
        if (!s.over) return null
        return if (s.winner < 0) Outcome(-1, "${QUIET_LIMIT}手のあいだ取り合いがありませんでした") else Outcome(s.winner, "")
    }

    override fun scores(s: MorrisState): IntArray = intArrayOf(s.count(0) + s.inHand[0], s.count(1) + s.inHand[1])

    // ---- CPU ----
    fun evaluate(s: MorrisState, me: Int): Int {
        val opp = 1 - me
        val material = (s.count(me) + s.inHand[me]) - (s.count(opp) + s.inHand[opp])
        var mills = 0
        var twos = 0
        for (mill in MILLS) {
            val a = mill.count { s.board[it] == me + 1 }
            val b = mill.count { s.board[it] == opp + 1 }
            val e = mill.count { s.board[it] == 0 }
            if (a == 3) mills++
            if (b == 3) mills--
            if (a == 2 && e == 1) twos++
            if (b == 2 && e == 1) twos--
        }
        var mob = 0
        if (s.inHand[me] == 0 && s.inHand[opp] == 0) {
            for (i in 0 until 24) {
                if (s.board[i] == 0) continue
                val free = ADJ[i].count { s.board[it] == 0 }
                if (s.board[i] == me + 1) mob += free else mob -= free
            }
        }
        val removeBonus = if (s.removing) (if (s.turn == me) 80 else -80) else 0
        return material * 120 + mills * 25 + twos * 18 + mob * 4 + removeBonus
    }

    private val search = ThreadLocal.withInitial {
        AlphaBeta(Morris, ::evaluate) { s, moves ->
            // ミルを作る手・取る手を先に読む
            moves.sortedByDescending { m ->
                when {
                    m >= 1000 -> 2
                    else -> {
                        val dest = if (m >= 100) (m - 100) % 24 else m
                        val b = s.board.copyOf()
                        if (m >= 100) b[(m - 100) / 24] = 0
                        b[dest] = s.turn + 1
                        if (inMill(b, dest)) 1 else 0
                    }
                }
            }.toIntArray()
        }
    }

    val brain = Brain<MorrisState> { rules, s, seat, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        when (level) {
            Level.EASY -> search.get().pick(s, seat, 1, budget, rng, temp = 40)
            Level.NORMAL -> search.get().pick(s, seat, 2, budget, rng, temp = 15)
            Level.HARD -> search.get().pick(s, seat, 5, budget, rng, temp = 6) // 上手な人くらい
        }
    }

    val def = GameDef("morris", { Morris }, brain)
}
