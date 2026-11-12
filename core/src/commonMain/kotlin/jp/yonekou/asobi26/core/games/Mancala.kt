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
 * マンカラ(カラハのルール。各6穴、倉2つ)。
 * pits: 0..5 = 席0の穴(左から右)、6 = 席0の倉、7..12 = 席1の穴、13 = 席1の倉。石は反時計回りにまく(相手の倉は飛ばす)。
 * 手は穴の番号(0..5 または 7..12)。
 */
class MancalaState(val pits: IntArray, val turn: Int, val over: Boolean, val lastMove: Int, val extraTurn: Boolean, val captured: Int)

class Mancala(val seeds: Int) : Rules<MancalaState> {
    override val playerCount = 2

    override fun initial(rng: Random): MancalaState {
        val p = IntArray(14) { if (it == 6 || it == 13) 0 else seeds }
        return MancalaState(p, 0, false, -1, false, 0)
    }

    override fun toMove(s: MancalaState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: MancalaState): IntArray {
        if (s.over) return IntArray(0)
        val base = if (s.turn == 0) 0 else 7
        return (base until base + 6).filter { s.pits[it] > 0 }.toIntArray()
    }

    override fun isLegal(s: MancalaState, m: Int): Boolean {
        if (s.over) return false
        val base = if (s.turn == 0) 0 else 7
        return m in base until base + 6 && s.pits[m] > 0
    }

    override fun play(s: MancalaState, m: Int): MancalaState {
        val p = s.pits.copyOf()
        val me = s.turn
        val myStore = if (me == 0) 6 else 13
        val oppStore = if (me == 0) 13 else 6
        var n = p[m]
        p[m] = 0
        var i = m
        while (n > 0) {
            i = (i + 1) % 14
            if (i == oppStore) continue
            p[i]++
            n--
        }
        var captured = 0
        val ownSide = if (me == 0) i in 0..5 else i in 7..12
        // 最後の1粒が自分の空だった穴に入り、向かいの穴に石があれば、両方を自分の倉へ
        if (ownSide && p[i] == 1 && p[12 - i] > 0) {
            captured = p[12 - i] + 1
            p[myStore] += captured
            p[i] = 0
            p[12 - i] = 0
        }
        val extra = i == myStore
        // どちらかの列が空になったら終わり。残りの石は、その列の持ち主の倉へ
        val side0 = (0..5).sumOf { p[it] }
        val side1 = (7..12).sumOf { p[it] }
        val over = side0 == 0 || side1 == 0
        if (over) {
            for (k in 0..5) { p[6] += p[k]; p[k] = 0 }
            for (k in 7..12) { p[13] += p[k]; p[k] = 0 }
        }
        return MancalaState(p, if (extra && !over) me else 1 - me, over, m, extra && !over, captured)
    }

    override fun outcome(s: MancalaState): Outcome? {
        if (!s.over) return null
        val a = s.pits[6]
        val b = s.pits[13]
        return Outcome(if (a > b) 0 else if (b > a) 1 else -1, "倉 $a 対 $b")
    }

    override fun scores(s: MancalaState): IntArray = intArrayOf(s.pits[6], s.pits[13])

    companion object {
        fun evaluate(s: MancalaState, me: Int): Int {
            val mineStore = if (me == 0) 6 else 13
            val oppStore = if (me == 0) 13 else 6
            val mineSide = if (me == 0) (0..5).sumOf { s.pits[it] } else (7..12).sumOf { s.pits[it] }
            val oppSide = if (me == 0) (7..12).sumOf { s.pits[it] } else (0..5).sumOf { s.pits[it] }
            return (s.pits[mineStore] - s.pits[oppStore]) * 10 + (mineSide - oppSide)
        }

        private val search = ThreadLocal.withInitial { HashMap<Int, AlphaBeta<MancalaState>>() }

        private fun searchFor(rules: Rules<MancalaState>): AlphaBeta<MancalaState> {
            val seeds = (rules as Mancala).seeds
            return search.get().getOrPut(seeds) {
                AlphaBeta(rules, ::evaluate) { s, moves ->
                    // 倉で止まる手(もう1回)を先に読む
                    val store = if (s.turn == 0) 6 else 13
                    moves.sortedByDescending { if (it + s.pits[it] == store) 1 else 0 }.toIntArray()
                }
            }
        }

        val brain = Brain<MancalaState> { rules, s, seat, level, rng, budget ->
            val legal = rules.legalMoves(s)
            if (legal.size == 1) return@Brain legal[0]
            val ab = searchFor(rules)
            when (level) {
                Level.EASY -> ab.pick(s, seat, 1, budget, rng, temp = 12)
                Level.NORMAL -> ab.pick(s, seat, 3, budget, rng, temp = 6)
                Level.HARD -> ab.pick(s, seat, 6, budget, rng, temp = 2) // 上手な人くらい(読み切りはしない)
            }
        }

        val def = GameDef("mancala", { Mancala(it.int("seeds", 4).coerceIn(3, 6)) }, brain)
    }
}
