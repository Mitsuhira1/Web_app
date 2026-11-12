package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.OutOfTime
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.math.abs
import kotlin.random.Random

/**
 * チェス。席0=白(先手、盤の下側)、席1=黒。
 * board: 0=空、+k=白、-k=黒(k: 1ポーン 2ナイト 3ビショップ 4ルーク 5クイーン 6キング)。マスは r*8+c(r=0 が黒側の端=8段目)。
 * castle: キャスリングできる権利(1=白キング側 2=白クイーン側 4=黒キング側 8=黒クイーン側)。ep: アンパッサンで取れる先のマス(-1 = なし)。
 * 手の番号: from | to<<6 | promo<<12(promo は昇格する駒。0 = 昇格なし)。
 */
class ChessState(
    val board: IntArray,
    val turn: Int,
    val castle: Int,
    val ep: Int,
    val half: Int,
    val ply: Int,
    val lastMove: Int,
    val keys: LongArray,
    val inCheck: Boolean,
    val winner: Int,
    val over: Boolean,
    val reason: String,
)

object Chess : Rules<ChessState> {
    const val P = 1; const val N = 2; const val B = 3; const val R = 4; const val Q = 5; const val K = 6
    const val MATE = 1_000_000

    override val playerCount = 2

    fun fromSq(m: Int) = m and 63
    fun toSq(m: Int) = (m shr 6) and 63
    fun promo(m: Int) = m shr 12
    fun encode(f: Int, t: Int, promo: Int = 0) = f or (t shl 6) or (promo shl 12)

    override fun initial(rng: Random): ChessState {
        val b = IntArray(64)
        val back = intArrayOf(R, N, B, Q, K, B, N, R)
        for (c in 0 until 8) {
            b[c] = -back[c]; b[8 + c] = -P
            b[56 + c] = back[c]; b[48 + c] = P
        }
        return ChessState(b, 0, 15, -1, 0, 0, -1, longArrayOf(hash(b, 0, 15, -1)), false, -1, false, "")
    }

    override fun toMove(s: ChessState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: ChessState): IntArray = if (s.over) IntArray(0) else legal(Pos(s.board.copyOf(), s.turn, s.castle, s.ep))

    override fun play(s: ChessState, m: Int): ChessState {
        val p = Pos(s.board.copyOf(), s.turn, s.castle, s.ep)
        val moving = abs(p.b[fromSq(m)])
        val captures = p.b[toSq(m)] != 0 || (moving == P && toSq(m) == s.ep)
        p.make(m)
        val half = if (moving == P || captures) 0 else s.half + 1
        val key = hash(p.b, p.side, p.castle, p.ep)
        val keys = s.keys.copyOf(s.keys.size + 1).also { it[it.size - 1] = key }
        val chk = attacked(p.b, kingSquare(p.b, p.side), 1 - p.side)
        val ply = s.ply + 1
        fun st(winner: Int, over: Boolean, reason: String) = ChessState(p.b, p.side, p.castle, p.ep, half, ply, m, keys, chk, winner, over, reason)
        if (legal(Pos(p.b.copyOf(), p.side, p.castle, p.ep)).isEmpty()) {
            return if (chk) st(s.turn, true, "チェックメイト") else st(-1, true, "ステイルメイト")
        }
        if (insufficient(p.b)) return st(-1, true, "駒が足りず、チェックメイトできません")
        if (keys.count { it == key } >= 3) return st(-1, true, "同じ局面が3回")
        if (half >= 100) return st(-1, true, "50手ルール")
        if (ply >= 500) return st(-1, true, "500手に達しました")
        return st(-1, false, "")
    }

    override fun outcome(s: ChessState): Outcome? = if (!s.over) null else Outcome(s.winner, s.reason)

    /** 駒が足りない(キング同士・キングと軽い駒1つ・同じ色のマスのビショップ同士) */
    private fun insufficient(b: IntArray): Boolean {
        val others = (0 until 64).filter { b[it] != 0 && abs(b[it]) != K }
        if (others.isEmpty()) return true
        if (others.size == 1 && abs(b[others[0]]) in intArrayOf(N, B)) return true
        if (others.all { abs(b[it]) == B }) {
            val colors = others.map { (it / 8 + it % 8) % 2 }.toSet()
            if (colors.size == 1) return true
        }
        return false
    }

    fun kingSquare(b: IntArray, side: Int): Int {
        val k = if (side == 0) K else -K
        for (i in 0 until 64) if (b[i] == k) return i
        return -1
    }

    private val KN = arrayOf(intArrayOf(-2, -1), intArrayOf(-2, 1), intArrayOf(-1, -2), intArrayOf(-1, 2), intArrayOf(1, -2), intArrayOf(1, 2), intArrayOf(2, -1), intArrayOf(2, 1))
    private val KG = arrayOf(intArrayOf(-1, -1), intArrayOf(-1, 0), intArrayOf(-1, 1), intArrayOf(0, -1), intArrayOf(0, 1), intArrayOf(1, -1), intArrayOf(1, 0), intArrayOf(1, 1))
    private val DIAG = arrayOf(intArrayOf(-1, -1), intArrayOf(-1, 1), intArrayOf(1, -1), intArrayOf(1, 1))
    private val ORTH = arrayOf(intArrayOf(-1, 0), intArrayOf(1, 0), intArrayOf(0, -1), intArrayOf(0, 1))

    /** マス sq に by の駒が利いているか */
    fun attacked(b: IntArray, sq: Int, by: Int): Boolean {
        if (sq < 0) return false
        val r0 = sq / 8
        val c0 = sq % 8
        val sg = if (by == 0) 1 else -1
        // ポーン: 白のポーンは下(r+1)から斜め上を取る
        val pr = r0 + (if (by == 0) 1 else -1)
        if (pr in 0..7) for (dc in intArrayOf(-1, 1)) {
            val c = c0 + dc
            if (c in 0..7 && b[pr * 8 + c] == sg * P) return true
        }
        for (d in KN) {
            val r = r0 + d[0]; val c = c0 + d[1]
            if (r in 0..7 && c in 0..7 && b[r * 8 + c] == sg * N) return true
        }
        for (d in KG) {
            val r = r0 + d[0]; val c = c0 + d[1]
            if (r in 0..7 && c in 0..7 && b[r * 8 + c] == sg * K) return true
        }
        for (d in DIAG) {
            var r = r0 + d[0]; var c = c0 + d[1]
            while (r in 0..7 && c in 0..7) {
                val v = b[r * 8 + c]
                if (v != 0) { if (v == sg * B || v == sg * Q) return true; break }
                r += d[0]; c += d[1]
            }
        }
        for (d in ORTH) {
            var r = r0 + d[0]; var c = c0 + d[1]
            while (r in 0..7 && c in 0..7) {
                val v = b[r * 8 + c]
                if (v != 0) { if (v == sg * R || v == sg * Q) return true; break }
                r += d[0]; c += d[1]
            }
        }
        return false
    }

    /** 盤・手番・権利をまとめた、書き換えて使う局面(読みとルールの両方で使う) */
    class Pos(val b: IntArray, var side: Int, var castle: Int, var ep: Int) {
        private val stCap = IntArray(64)
        private val stCapSq = IntArray(64)
        private val stCastle = IntArray(64)
        private val stEp = IntArray(64)
        private var sp = 0

        fun make(m: Int) {
            val f = fromSq(m)
            val t = toSq(m)
            val pc = b[f]
            val kind = abs(pc)
            val sg = if (side == 0) 1 else -1
            var cap = b[t]
            var capSq = t
            if (kind == P && t == ep && cap == 0) { capSq = t + 8 * sg; cap = b[capSq]; b[capSq] = 0 }
            stCap[sp] = cap; stCapSq[sp] = capSq; stCastle[sp] = castle; stEp[sp] = ep; sp++
            b[t] = if (promo(m) != 0) sg * promo(m) else pc
            b[f] = 0
            if (kind == K && abs(t - f) == 2) {
                // キャスリング: ルークも動かす
                if (t > f) { b[t - 1] = b[t + 1]; b[t + 1] = 0 } else { b[t + 1] = b[t - 2]; b[t - 2] = 0 }
            }
            ep = if (kind == P && abs(t - f) == 16) (f + t) / 2 else -1
            castle = castle and CASTLE_MASK[f] and CASTLE_MASK[t]
            side = 1 - side
        }

        fun unmake(m: Int) {
            side = 1 - side
            sp--
            val f = fromSq(m)
            val t = toSq(m)
            val sg = if (side == 0) 1 else -1
            val pc = if (promo(m) != 0) sg * P else b[t]
            b[f] = pc
            b[t] = 0
            if (abs(pc) == K && abs(t - f) == 2) {
                if (t > f) { b[t + 1] = b[t - 1]; b[t - 1] = 0 } else { b[t - 2] = b[t + 1]; b[t + 1] = 0 }
            }
            b[stCapSq[sp]] = stCap[sp]
            castle = stCastle[sp]
            ep = stEp[sp]
        }

        /** 王手放置を調べる前の手。capturesOnly は取る手と昇格だけ。full=false なら昇格はクイーンとナイトだけ */
        fun pseudo(out: IntArray, capturesOnly: Boolean, full: Boolean): Int {
            var n = 0
            val sg = if (side == 0) 1 else -1
            fun mine(v: Int) = v != 0 && (v > 0) == (side == 0)
            fun enemy(v: Int) = v != 0 && (v > 0) != (side == 0)
            for (sq in 0 until 64) {
                val v = b[sq]
                if (!mine(v)) continue
                val r0 = sq / 8
                val c0 = sq % 8
                when (abs(v)) {
                    P -> {
                        val dir = -sg
                        val lastRow = if (side == 0) 0 else 7
                        val startRow = if (side == 0) 6 else 1
                        fun addP(t: Int) {
                            if (t / 8 == lastRow) {
                                out[n++] = encode(sq, t, Q); out[n++] = encode(sq, t, N)
                                if (full) { out[n++] = encode(sq, t, R); out[n++] = encode(sq, t, B) }
                            } else out[n++] = encode(sq, t)
                        }
                        val r1 = r0 + dir
                        if (r1 in 0..7) {
                            if (b[r1 * 8 + c0] == 0 && (!capturesOnly || r1 == lastRow)) {
                                addP(r1 * 8 + c0)
                                val r2 = r0 + 2 * dir
                                if (!capturesOnly && r0 == startRow && b[r2 * 8 + c0] == 0) out[n++] = encode(sq, r2 * 8 + c0)
                            }
                            for (dc in intArrayOf(-1, 1)) {
                                val c = c0 + dc
                                if (c !in 0..7) continue
                                val t = r1 * 8 + c
                                if (enemy(b[t]) || t == ep) addP(t)
                            }
                        }
                    }
                    N -> for (d in KN) {
                        val r = r0 + d[0]; val c = c0 + d[1]
                        if (r !in 0..7 || c !in 0..7) continue
                        val t = b[r * 8 + c]
                        if (mine(t) || (capturesOnly && t == 0)) continue
                        out[n++] = encode(sq, r * 8 + c)
                    }
                    K -> {
                        for (d in KG) {
                            val r = r0 + d[0]; val c = c0 + d[1]
                            if (r !in 0..7 || c !in 0..7) continue
                            val t = b[r * 8 + c]
                            if (mine(t) || (capturesOnly && t == 0)) continue
                            out[n++] = encode(sq, r * 8 + c)
                        }
                        if (!capturesOnly) {
                            val opp = 1 - side
                            if (side == 0 && sq == 60) {
                                if (castle and 1 != 0 && b[61] == 0 && b[62] == 0 && b[63] == R &&
                                    !attacked(b, 60, opp) && !attacked(b, 61, opp) && !attacked(b, 62, opp)) out[n++] = encode(60, 62)
                                if (castle and 2 != 0 && b[59] == 0 && b[58] == 0 && b[57] == 0 && b[56] == R &&
                                    !attacked(b, 60, opp) && !attacked(b, 59, opp) && !attacked(b, 58, opp)) out[n++] = encode(60, 58)
                            }
                            if (side == 1 && sq == 4) {
                                if (castle and 4 != 0 && b[5] == 0 && b[6] == 0 && b[7] == -R &&
                                    !attacked(b, 4, opp) && !attacked(b, 5, opp) && !attacked(b, 6, opp)) out[n++] = encode(4, 6)
                                if (castle and 8 != 0 && b[3] == 0 && b[2] == 0 && b[1] == 0 && b[0] == -R &&
                                    !attacked(b, 4, opp) && !attacked(b, 3, opp) && !attacked(b, 2, opp)) out[n++] = encode(4, 2)
                            }
                        }
                    }
                    else -> {
                        val dirs = when (abs(v)) { B -> DIAG; R -> ORTH; else -> QUEEN }
                        for (d in dirs) {
                            var r = r0 + d[0]; var c = c0 + d[1]
                            while (r in 0..7 && c in 0..7) {
                                val t = b[r * 8 + c]
                                if (mine(t)) break
                                if (!capturesOnly || t != 0) out[n++] = encode(sq, r * 8 + c)
                                if (t != 0) break
                                r += d[0]; c += d[1]
                            }
                        }
                    }
                }
            }
            return n
        }
    }

    private val QUEEN = DIAG + ORTH

    /** そのマスから動いた・取られた時に消えるキャスリングの権利 */
    private val CASTLE_MASK = IntArray(64) { 15 }.also {
        it[60] = 15 and 3.inv(); it[63] = 15 and 1.inv(); it[56] = 15 and 2.inv()
        it[4] = 15 and 12.inv(); it[7] = 15 and 4.inv(); it[0] = 15 and 8.inv()
    }

    fun legal(p: Pos): IntArray {
        val buf = IntArray(256)
        val cnt = p.pseudo(buf, capturesOnly = false, full = true)
        val out = IntArray(cnt)
        var k = 0
        val me = p.side
        for (i in 0 until cnt) {
            val m = buf[i]
            p.make(m)
            val ok = !attacked(p.b, kingSquare(p.b, me), 1 - me)
            p.unmake(m)
            if (ok) out[k++] = m
        }
        return out.copyOf(k)
    }

    private val ZOB = LongArray(64 * 13 + 64 + 32).also { a ->
        val r = Random(64_2026)
        for (i in a.indices) a[i] = r.nextLong()
    }

    fun hash(b: IntArray, side: Int, castle: Int, ep: Int): Long {
        var x = if (side == 0) 0L else ZOB[64 * 13 + 64 + 20]
        for (i in 0 until 64) if (b[i] != 0) x = x xor ZOB[i * 13 + b[i] + 6]
        x = x xor ZOB[64 * 13 + 64 + castle]
        if (ep >= 0) x = x xor ZOB[64 * 13 + ep]
        return x
    }

    // ---------------- CPU ----------------
    val VALUES = intArrayOf(0, 100, 320, 330, 500, 900, 0)

    private fun center(sq: Int): Int {
        val r = sq / 8
        val c = sq % 8
        return 6 - (abs(2 * r - 7) + abs(2 * c - 7)) / 2 // 中央ほど大きい(0〜6)
    }

    /** 白から見た局面の点数 */
    fun evaluate(b: IntArray): Int {
        var s = 0
        var heavy = 0
        for (i in 0 until 64) if (b[i] != 0 && abs(b[i]) in N..Q) heavy += VALUES[abs(b[i])]
        val endgame = heavy <= 2600
        var bw = 0
        var bb = 0
        for (i in 0 until 64) {
            val v = b[i]
            if (v == 0) continue
            val kind = abs(v)
            val white = v > 0
            val r = i / 8
            val adv = if (white) 7 - r else r // 自陣の端からの段数
            var p = VALUES[kind]
            when (kind) {
                P -> { p += adv * adv * 2 + (if (i % 8 in 3..4 && adv in 2..4) 12 else 0) }
                N -> p += center(i) * 8 - (if (adv == 0) 10 else 0)
                B -> { p += center(i) * 4 - (if (adv == 0) 8 else 0); if (white) bw++ else bb++ }
                R -> p += if (adv == 6) 20 else 0
                Q -> p += center(i) * 2
                K -> p += if (endgame) center(i) * 10 else -adv * 18 - (if (i % 8 in 2..5) 12 else 0)
            }
            s += if (white) p else -p
        }
        if (bw >= 2) s += 30
        if (bb >= 2) s -= 30
        return s
    }

    private class Engine(s: ChessState, val budget: Budget) {
        val p = Pos(s.board.copyOf(), s.turn, s.castle, s.ep)
        val bufs = Array(48) { IntArray(256) }
        val sc = Array(48) { IntArray(256) }
        var nodes = 0L

        fun eval(): Int = evaluate(p.b).let { if (p.side == 0) it else -it }

        private fun order(buf: IntArray, cnt: Int, s: IntArray) {
            for (i in 0 until cnt) {
                val m = buf[i]
                val cap = p.b[toSq(m)]
                s[i] = (if (cap != 0) 10 * VALUES[abs(cap)] - VALUES[abs(p.b[fromSq(m)])] / 10 + 10_000 else 0) + promo(m) * 1000
            }
            for (i in 1 until cnt) {
                val m = buf[i]; val v = s[i]
                var j = i - 1
                while (j >= 0 && s[j] < v) { buf[j + 1] = buf[j]; s[j + 1] = s[j]; j-- }
                buf[j + 1] = m; s[j + 1] = v
            }
        }

        private fun capturesKing(buf: IntArray, cnt: Int): Boolean {
            for (i in 0 until cnt) if (abs(p.b[toSq(buf[i])]) == K) return true
            return false
        }

        fun negamax(depth: Int, alphaIn: Int, beta: Int, ply: Int): Int {
            if ((++nodes and 1023L) == 0L && budget.over()) throw OutOfTime()
            if (depth <= 0 || ply >= 46) return quiesce(alphaIn, beta, ply, 0)
            val buf = bufs[ply]
            val cnt = p.pseudo(buf, capturesOnly = false, full = false)
            if (capturesKing(buf, cnt)) return MATE - ply
            order(buf, cnt, sc[ply])
            var alpha = alphaIn
            var best = -MATE
            for (i in 0 until cnt) {
                val m = buf[i]
                p.make(m)
                val v = -negamax(depth - 1, -beta, -alpha, ply + 1)
                p.unmake(m)
                if (v > best) best = v
                if (best > alpha) alpha = best
                if (alpha >= beta) break
            }
            // どの手でもキングを取られる: 王手ならチェックメイト、そうでなければステイルメイト(引き分け)
            if (best <= -MATE + ply + 2 && !attacked(p.b, kingSquare(p.b, p.side), 1 - p.side)) return 0
            return best
        }

        fun quiesce(alphaIn: Int, beta: Int, ply: Int, qd: Int): Int {
            if ((++nodes and 1023L) == 0L && budget.over()) throw OutOfTime()
            val buf = bufs[ply]
            val cnt = p.pseudo(buf, capturesOnly = true, full = false)
            if (capturesKing(buf, cnt)) return MATE - ply
            val stand = eval()
            if (stand >= beta || qd >= 8 || ply >= 46) return stand
            var alpha = maxOf(alphaIn, stand)
            order(buf, cnt, sc[ply])
            var best = stand
            for (i in 0 until cnt) {
                val m = buf[i]
                p.make(m)
                val v = -quiesce(-beta, -alpha, ply + 1, qd + 1)
                p.unmake(m)
                if (v > best) best = v
                if (best > alpha) alpha = best
                if (alpha >= beta) break
            }
            return best
        }

        fun rootScores(moves: IntArray, depth: Int): IntArray? = try {
            IntArray(moves.size) { i ->
                p.make(moves[i])
                // 相手に指せる手がなければ、王手ならチェックメイト・そうでなければステイルメイト(浅い読みでも見落とさない)
                val replies = legal(p)
                val v = if (replies.isEmpty()) {
                    if (attacked(p.b, kingSquare(p.b, p.side), 1 - p.side)) MATE - 1 else 0
                } else -negamax(depth - 1, -MATE - 1, MATE + 1, 1)
                p.unmake(moves[i])
                v
            }
        } catch (e: OutOfTime) {
            null
        }

        fun best(moves: IntArray, maxDepth: Int, rng: Random): Int {
            var order = moves.copyOf().also { a -> for (i in a.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val x = a[i]; a[i] = a[j]; a[j] = x } }
            var bestMove = order[0]
            for (d in 1..maxDepth) {
                try {
                    var alpha = -MATE - 1
                    val s = IntArray(order.size) { -MATE - 1 }
                    var bi = 0
                    for (i in order.indices) {
                        p.make(order[i])
                        val v = -negamax(d - 1, -MATE - 1, -alpha, 1)
                        p.unmake(order[i])
                        s[i] = v
                        if (v > alpha) { alpha = v; bi = i }
                    }
                    bestMove = order[bi]
                    order = order.indices.sortedByDescending { s[it] }.map { order[it] }.toIntArray()
                    if (alpha >= MATE - 100) break
                } catch (e: OutOfTime) {
                    break
                }
                if (budget.over()) break
            }
            return bestMove
        }
    }

    private fun pickSoft(scores: IntArray?, moves: IntArray, rng: Random, temp: Int): Int {
        if (scores == null) return moves[0]
        val top = scores.max()
        if (top >= MATE - 100) return moves[scores.indexOfFirst { it == top }]
        val alive = moves.indices.filter { scores[it] > -MATE + 100 }.ifEmpty { moves.indices.toList() }
        val pool = alive.filter { top - scores[it] <= temp * 4 }.ifEmpty { listOf(alive.maxBy { scores[it] }) }
        val wts = pool.map { kotlin.math.exp(-(top - scores[it]).toDouble() / temp) }
        var x = rng.nextDouble() * wts.sum()
        for (k in pool.indices) {
            x -= wts[k]
            if (x <= 0) return moves[pool[k]]
        }
        return moves[pool.last()]
    }

    val brain = Brain<ChessState> { rules, s, _, level, rng, budget ->
        val legal = rules.legalMoves(s)
        if (legal.size == 1) return@Brain legal[0]
        val eng = Engine(s, budget)
        when (level) {
            Level.EASY -> pickSoft(eng.rootScores(legal, 1) ?: Engine(s, Budget(400)).rootScores(legal, 1), legal, rng, 110)
            // 時間切れの後は、新しい盤で読み直す(途中で止まった読みの盤は、駒が動いたままなので使わない)
            Level.NORMAL -> pickSoft(eng.rootScores(legal, 2) ?: Engine(s, Budget(400)).rootScores(legal, 1), legal, rng, 35)
            Level.HARD -> eng.best(legal, 8, rng)
        }
    }

    val def = GameDef("chess", { Chess }, brain)
}
