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
 * 将棋(9×9)と5五将棋(5×5)。席0=先手(盤の下側、上へ進む)、席1=後手。
 * board: 0=空、+k=先手の駒、-k=後手の駒。k は下の定数(1〜14)。マスは r*W+c(r=0 が上の段)。
 * hands: 持ち駒の数。hands[席*8 + k](k は 1〜7 の成っていない駒)。
 * 手の番号: ((from*128 + to)*2 + 成り)。駒を打つ手は from = W*H + 駒の種類。
 * keys・inCheckHist は、これまでの局面(最初の局面を含む)の識別子と「その局面で手番の側が王手されていたか」。千日手の判定に使う。
 */
class ShogiState(
    val board: IntArray,
    val hands: IntArray,
    val turn: Int,
    val ply: Int,
    val lastMove: Int,
    val keys: LongArray,
    val inCheckHist: BooleanArray,
    val winner: Int,
    val over: Boolean,
    val reason: String,
) {
    /** 手番の側が王手されているか */
    val inCheck: Boolean get() = inCheckHist.last()
    fun hand(side: Int, kind: Int): Int = hands[side * 8 + kind]
}

class Shogi(val small: Boolean) : Rules<ShogiState> {
    val w = if (small) 5 else 9
    val h = w
    val n = w * h
    /** 成れる段の数(敵陣) */
    private val zone = if (small) 1 else 3
    /** この手数に達したら引き分け */
    val maxPly = if (small) 200 else 256

    override val playerCount = 2

    override fun initial(rng: Random): ShogiState {
        val b = IntArray(n)
        if (small) {
            // 後手(上): 5a玉 4a金 3a銀 2a角 1a飛 / 5b歩。先手(下)はこれを180度回した形
            val top = intArrayOf(K, G, S, B, R)
            for (c in 0 until 5) { b[c] = -top[c]; b[4 * 5 + 4 - c] = top[c] }
            b[1 * 5 + 0] = -P
            b[3 * 5 + 4] = P
        } else {
            val back = intArrayOf(L, N, S, G, K, G, S, N, L)
            for (c in 0 until 9) {
                b[c] = -back[c]; b[2 * 9 + c] = -P
                b[8 * 9 + c] = back[c]; b[6 * 9 + c] = P
            }
            b[1 * 9 + 1] = -R; b[1 * 9 + 7] = -B
            b[7 * 9 + 1] = B; b[7 * 9 + 7] = R
        }
        val hands = IntArray(16)
        return ShogiState(b, hands, 0, 0, -1, longArrayOf(hash(b, hands, 0)), booleanArrayOf(false), -1, false, "")
    }

    override fun toMove(s: ShogiState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: ShogiState): IntArray = if (s.over) IntArray(0) else legal(s.board, s.hands, s.turn)

    override fun play(s: ShogiState, m: Int): ShogiState {
        val b = s.board.copyOf()
        val hd = s.hands.copyOf()
        make(b, hd, s.turn, m)
        val next = 1 - s.turn
        val key = hash(b, hd, next)
        val chk = inCheck(b, next)
        val keys = s.keys.copyOf(s.keys.size + 1).also { it[it.size - 1] = key }
        val chks = s.inCheckHist.copyOf(s.inCheckHist.size + 1).also { it[it.size - 1] = chk }
        val ply = s.ply + 1
        fun end(winner: Int, reason: String) = ShogiState(b, hd, next, ply, m, keys, chks, winner, true, reason)
        if (legal(b, hd, next).isEmpty()) return end(s.turn, if (chk) "詰み" else "指せる手がありません")
        // 千日手: 同じ局面(盤・持ち駒・手番)が4回目
        val same = keys.indices.filter { keys[it] == key }
        if (same.size >= 4) {
            val first = same[0]
            // その間ずっと片方が王手をかけ続けていたら、王手をかけた側の負け(連続王手の千日手)
            // 局面 i の手番は i が偶数なら先手。王手をかけ続けた側(checker)の相手(defender)の手番の局面が、すべて王手なら
            for (checker in 0..1) {
                val defender = 1 - checker
                val idx = (first + 1 until keys.size).filter { it % 2 == defender }
                if (idx.isNotEmpty() && idx.all { chks[it] }) return end(defender, "連続王手の千日手")
            }
            return if (small) end(1, "千日手(先手の負け)") else end(-1, "千日手")
        }
        if (ply >= maxPly) return end(-1, "${maxPly}手に達しました")
        return ShogiState(b, hd, next, ply, m, keys, chks, -1, false, "")
    }

    override fun outcome(s: ShogiState): Outcome? = if (!s.over) null else Outcome(s.winner, s.reason)

    // ---------------- 手の作り方 ----------------

    fun from(m: Int) = (m shr 1) / 128
    fun to(m: Int) = (m shr 1) % 128
    fun promotes(m: Int) = m and 1 == 1
    fun isDrop(m: Int) = from(m) >= n
    fun dropKind(m: Int) = from(m) - n
    fun encode(from: Int, to: Int, promo: Boolean) = ((from * 128 + to) shl 1) or (if (promo) 1 else 0)

    /** 先手から見て r 段目が、side の敵陣か */
    private fun inZone(r: Int, side: Int) = if (side == 0) r < zone else r >= h - zone

    /** side の駒 kind が r 段目に来たら、もう動けない(成らないといけない・打てない) */
    fun deadEnd(kind: Int, r: Int, side: Int): Boolean {
        val far = if (side == 0) r else h - 1 - r // 相手側の端からの段数(0 = 一番奥)
        return when (kind) {
            P, L -> far == 0
            N -> far <= 1
            else -> false
        }
    }

    /**
     * side の指せる手(王手放置などを除く前の手)を out に入れて数を返す。
     * capturesOnly: 駒を取る手だけ(読みの延長用)。full=false の時は、歩・角・飛の不成を省く(読みの高速化。実際の合法手には含める)。
     */
    fun pseudo(b: IntArray, hd: IntArray, side: Int, out: IntArray, capturesOnly: Boolean, full: Boolean): Int {
        var cnt = 0
        val sgn = if (side == 0) 1 else -1
        for (sq in 0 until n) {
            val v = b[sq]
            if (v == 0 || (v > 0) != (side == 0)) continue
            val kind = abs(v)
            val r0 = sq / w
            val c0 = sq % w
            fun add(to: Int) {
                val tr = to / w
                val canPro = kind in 1..7 && kind != G && kind != K && (inZone(r0, side) || inZone(tr, side))
                if (canPro) {
                    out[cnt++] = encode(sq, to, true)
                    if (!deadEnd(kind, tr, side) && (full || kind == S || kind == N || kind == L)) out[cnt++] = encode(sq, to, false)
                } else out[cnt++] = encode(sq, to, false)
            }
            for (d in STEPS[kind]) {
                val r = r0 + d[0] * sgn
                val c = c0 + d[1]
                if (r !in 0 until h || c !in 0 until w) continue
                val t = b[r * w + c]
                if (t != 0 && (t > 0) == (side == 0)) continue
                if (capturesOnly && t == 0) continue
                add(r * w + c)
            }
            for (d in SLIDES[kind]) {
                var r = r0 + d[0] * sgn
                var c = c0 + d[1]
                while (r in 0 until h && c in 0 until w) {
                    val t = b[r * w + c]
                    if (t != 0 && (t > 0) == (side == 0)) break
                    if (!capturesOnly || t != 0) add(r * w + c)
                    if (t != 0) break
                    r += d[0] * sgn
                    c += d[1]
                }
            }
        }
        if (capturesOnly) return cnt
        // 打つ手
        var pawnFiles = 0
        for (sq in 0 until n) if (b[sq] == sgn * P) pawnFiles = pawnFiles or (1 shl (sq % w))
        for (kind in 1..7) {
            if (hd[side * 8 + kind] == 0) continue
            for (to in 0 until n) {
                if (b[to] != 0) continue
                if (deadEnd(kind, to / w, side)) continue
                if (kind == P && (pawnFiles shr (to % w)) and 1 == 1) continue // 二歩
                out[cnt++] = encode(n + kind, to, false)
            }
        }
        return cnt
    }

    /** 手を盤に適用する(b・hd を書き換える)。取った駒の値(なければ 0)を返す */
    fun make(b: IntArray, hd: IntArray, side: Int, m: Int): Int {
        val sgn = if (side == 0) 1 else -1
        val f = from(m)
        val t = to(m)
        if (f >= n) {
            val kind = f - n
            b[t] = sgn * kind
            hd[side * 8 + kind]--
            return 0
        }
        val piece = b[f]
        val cap = b[t]
        b[f] = 0
        b[t] = if (promotes(m)) sgn * PROMOTE[abs(piece)] else piece
        if (cap != 0) hd[side * 8 + BASE[abs(cap)]]++
        return cap
    }

    fun unmake(b: IntArray, hd: IntArray, side: Int, m: Int, cap: Int) {
        val sgn = if (side == 0) 1 else -1
        val f = from(m)
        val t = to(m)
        if (f >= n) {
            b[t] = 0
            hd[side * 8 + (f - n)]++
            return
        }
        val piece = b[t]
        b[f] = if (promotes(m)) sgn * BASE[abs(piece)] else piece
        b[t] = cap
        if (cap != 0) hd[side * 8 + BASE[abs(cap)]]--
    }

    fun kingSquare(b: IntArray, side: Int): Int {
        val k = if (side == 0) K else -K
        for (i in 0 until n) if (b[i] == k) return i
        return -1
    }

    fun inCheck(b: IntArray, side: Int): Boolean {
        val k = kingSquare(b, side)
        return k >= 0 && attacked(b, k, 1 - side)
    }

    /** マス sq に、by の駒が利いているか */
    fun attacked(b: IntArray, sq: Int, by: Int): Boolean {
        val sr = sq / w
        val sc = sq % w
        val sgn = if (by == 0) 1 else -1
        for (dr in -1..1) for (dc in -1..1) {
            if (dr == 0 && dc == 0) continue
            var r = sr + dr
            var c = sc + dc
            var k = 1
            while (r in 0 until h && c in 0 until w) {
                val v = b[r * w + c]
                if (v != 0) {
                    if ((v > 0) == (by == 0)) {
                        // 攻める駒から sq への向き(攻める側の向きに直す)
                        val vr = -dr * sgn
                        val vc = -dc
                        val kind = abs(v)
                        if (k == 1 && STEP_MASK[kind][(vr + 1) * 3 + vc + 1]) return true
                        if (SLIDE_MASK[kind][(vr + 1) * 3 + vc + 1]) return true
                    }
                    break
                }
                r += dr; c += dc; k++
            }
        }
        // 桂馬: 攻める側から見て (-2, ±1) にある sq を狙う
        for (dc in intArrayOf(-1, 1)) {
            val r = sr + 2 * sgn
            val c = sc + dc
            if (r in 0 until h && c in 0 until w && b[r * w + c] == sgn * N) return true
        }
        return false
    }

    /** 合法手(王手放置・打ち歩詰めを除く) */
    fun legal(b0: IntArray, hd0: IntArray, side: Int): IntArray {
        val b = b0.copyOf()
        val hd = hd0.copyOf()
        val buf = IntArray(1200)
        val cnt = pseudo(b, hd, side, buf, capturesOnly = false, full = true)
        val out = IntArray(cnt)
        var k = 0
        for (i in 0 until cnt) {
            val m = buf[i]
            val cap = make(b, hd, side, m)
            var ok = abs(cap) != K && !inCheck(b, side)
            if (ok && isDrop(m) && dropKind(m) == P && inCheck(b, 1 - side)) {
                // 打ち歩詰め: 相手に逃げる手がなければ反則
                ok = hasAnyLegal(b, hd, 1 - side)
            }
            unmake(b, hd, side, m, cap)
            if (ok) out[k++] = m
        }
        return out.copyOf(k)
    }

    private fun hasAnyLegal(b: IntArray, hd: IntArray, side: Int): Boolean {
        val buf = IntArray(1200)
        val cnt = pseudo(b, hd, side, buf, capturesOnly = false, full = true)
        for (i in 0 until cnt) {
            val m = buf[i]
            val cap = make(b, hd, side, m)
            val ok = abs(cap) != K && !inCheck(b, side)
            unmake(b, hd, side, m, cap)
            if (ok) return true
        }
        return false
    }

    fun hash(b: IntArray, hd: IntArray, side: Int): Long {
        var x = if (side == 0) 0x1234567L else 0x7654321L
        for (i in 0 until n) if (b[i] != 0) x = x xor ZOB[(i * 29 + b[i] + 14) % ZOB.size]
        for (i in 0 until 16) if (hd[i] != 0) x = x xor (ZOB[(3000 + i * 19 + hd[i]) % ZOB.size] * 31)
        return x
    }

    // ---------------- CPU ----------------

    private val values = if (small) SMALL_VALUES else VALUES

    /** 先手から見た局面の点数 */
    fun evaluate(b: IntArray, hd: IntArray): Int {
        var s = 0
        for (i in 0 until n) {
            val v = b[i]
            if (v == 0) continue
            val kind = abs(v)
            var p = values[kind]
            // 歩は前へ進んだほど少しよい
            if (kind == P) p += (if (v > 0) (h - 1 - i / w) else i / w) * 3
            s += if (v > 0) p else -p
        }
        for (k in 1..7) s += (hd[k] - hd[8 + k]) * values[k] * 115 / 100
        s += kingSafety(b, 0) - kingSafety(b, 1)
        return s
    }

    /** 玉の周りの守り(金・銀・成り駒)と、近くに来た相手の駒 */
    private fun kingSafety(b: IntArray, side: Int): Int {
        val k = kingSquare(b, side)
        if (k < 0) return -100_000
        val kr = k / w
        val kc = k % w
        var sc = 0
        for (dr in -2..2) for (dc in -2..2) {
            val r = kr + dr
            val c = kc + dc
            if (r !in 0 until h || c !in 0 until w || (dr == 0 && dc == 0)) continue
            val v = b[r * w + c]
            if (v == 0) continue
            val mine = (v > 0) == (side == 0)
            val kind = abs(v)
            val near = abs(dr) <= 1 && abs(dc) <= 1
            if (mine && near && DEFENDER[kind]) sc += if (small) 20 else 28
            if (!mine) sc -= if (near) 40 else 15
        }
        return sc
    }

    private class Engine(val g: Shogi, val budget: Budget, s: ShogiState) {
        val b = s.board.copyOf()
        val hd = s.hands.copyOf()
        val bufs = Array(48) { IntArray(1200) }
        val ord = Array(48) { IntArray(1200) }
        var nodes = 0L

        fun eval(side: Int): Int = g.evaluate(b, hd).let { if (side == 0) it else -it }

        private fun score(m: Int): Int {
            if (g.isDrop(m)) return 0
            val cap = b[g.to(m)]
            var v = 0
            if (cap != 0) v += 10 * g.values[abs(cap)] - g.values[abs(b[g.from(m)])] / 10 + 100_000
            if (g.promotes(m)) v += 5_000
            return v
        }

        private fun order(buf: IntArray, cnt: Int, sc: IntArray) {
            for (i in 0 until cnt) sc[i] = score(buf[i])
            // 挿入ソート(点数の高い順)
            for (i in 1 until cnt) {
                val m = buf[i]; val v = sc[i]
                var j = i - 1
                while (j >= 0 && sc[j] < v) { buf[j + 1] = buf[j]; sc[j + 1] = sc[j]; j-- }
                buf[j + 1] = m; sc[j + 1] = v
            }
        }

        private fun capturesKing(buf: IntArray, cnt: Int): Boolean {
            for (i in 0 until cnt) {
                val m = buf[i]
                if (!g.isDrop(m) && abs(b[g.to(m)]) == K) return true
            }
            return false
        }

        fun negamax(depth: Int, alphaIn: Int, beta: Int, side: Int, ply: Int): Int {
            if ((++nodes and 1023L) == 0L && budget.over()) throw OutOfTime()
            if (depth <= 0 || ply >= 46) return quiesce(alphaIn, beta, side, ply, 0)
            val buf = bufs[ply]
            val cnt = g.pseudo(b, hd, side, buf, capturesOnly = false, full = false)
            if (capturesKing(buf, cnt)) return MATE - ply
            order(buf, cnt, ord[ply])
            var alpha = alphaIn
            var best = -MATE
            for (i in 0 until cnt) {
                val m = buf[i]
                val cap = g.make(b, hd, side, m)
                val v = -negamax(depth - 1, -beta, -alpha, 1 - side, ply + 1)
                g.unmake(b, hd, side, m, cap)
                if (v > best) best = v
                if (best > alpha) alpha = best
                if (alpha >= beta) break
            }
            return best
        }

        fun quiesce(alphaIn: Int, beta: Int, side: Int, ply: Int, qd: Int): Int {
            if ((++nodes and 1023L) == 0L && budget.over()) throw OutOfTime()
            val buf = bufs[ply]
            val cnt = g.pseudo(b, hd, side, buf, capturesOnly = true, full = false)
            if (capturesKing(buf, cnt)) return MATE - ply
            val stand = eval(side)
            if (stand >= beta || qd >= 6 || ply >= 46) return stand
            var alpha = maxOf(alphaIn, stand)
            order(buf, cnt, ord[ply])
            var best = stand
            for (i in 0 until cnt) {
                val m = buf[i]
                val cap = g.make(b, hd, side, m)
                val v = -quiesce(-beta, -alpha, 1 - side, ply + 1, qd + 1)
                g.unmake(b, hd, side, m, cap)
                if (v > best) best = v
                if (best > alpha) alpha = best
                if (alpha >= beta) break
            }
            return best
        }

        /** 合法手それぞれの点数(depth まで読む)。期限が来たら null */
        fun rootScores(moves: IntArray, depth: Int, side: Int): IntArray? = try {
            IntArray(moves.size) { i ->
                val m = moves[i]
                val cap = g.make(b, hd, side, m)
                // 王手の手は、相手に逃げる手があるかを確かめる(浅い読みでも1手詰めは見落とさない)
                val v = if (g.inCheck(b, 1 - side) && g.legal(b, hd, 1 - side).isEmpty()) MATE - 1
                else -negamax(depth - 1, -MATE - 1, MATE + 1, 1 - side, 1)
                g.unmake(b, hd, side, m, cap)
                v
            }
        } catch (e: OutOfTime) {
            null
        }

        /** 反復深化で最善手を探す */
        fun best(moves: IntArray, maxDepth: Int, side: Int, rng: Random): Int {
            // 同じ点の手が毎回同じにならないよう、最初の並びを乱数で混ぜる
            var order = moves.copyOf().also { a -> for (i in a.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val x = a[i]; a[i] = a[j]; a[j] = x } }
            var bestMove = order[0]
            for (d in 1..maxDepth) {
                try {
                    var alpha = -MATE - 1
                    val sc = IntArray(order.size) { -MATE - 1 }
                    var bestIdx = 0
                    for (i in order.indices) {
                        val m = order[i]
                        val cap = g.make(b, hd, side, m)
                        val v = -negamax(d - 1, -MATE - 1, -alpha, 1 - side, 1)
                        g.unmake(b, hd, side, m, cap)
                        sc[i] = v
                        if (v > alpha) { alpha = v; bestIdx = i }
                    }
                    bestMove = order[bestIdx]
                    // 次の深さは、よかった手から読む
                    order = order.indices.sortedByDescending { sc[it] }.map { order[it] }.toIntArray()
                    if (alpha >= MATE - 100) break
                } catch (e: OutOfTime) {
                    break
                }
                if (budget.over()) break
            }
            return bestMove
        }
    }

    companion object {
        const val P = 1; const val L = 2; const val N = 3; const val S = 4; const val G = 5; const val B = 6; const val R = 7; const val K = 8
        const val TO = 9; const val NL = 10; const val NN = 11; const val NS = 12; const val UMA = 13; const val RYU = 14
        const val MATE = 1_000_000

        /** 成った後の駒 / 成る前の駒 */
        val PROMOTE = intArrayOf(0, TO, NL, NN, NS, G, UMA, RYU, K, TO, NL, NN, NS, UMA, RYU)
        val BASE = intArrayOf(0, P, L, N, S, G, B, R, K, P, L, N, S, B, R)

        /** 駒の文字(盤に書く1文字) */
        val NAMES = arrayOf("", "歩", "香", "桂", "銀", "金", "角", "飛", "玉", "と", "杏", "圭", "全", "馬", "竜")
        /** 説明などで使う呼び名 */
        val LONG_NAMES = arrayOf("", "歩", "香車", "桂馬", "銀", "金", "角", "飛車", "玉", "と金", "成香", "成桂", "成銀", "馬", "竜")

        private val GOLD = arrayOf(intArrayOf(-1, -1), intArrayOf(-1, 0), intArrayOf(-1, 1), intArrayOf(0, -1), intArrayOf(0, 1), intArrayOf(1, 0))
        private val DIAG = arrayOf(intArrayOf(-1, -1), intArrayOf(-1, 1), intArrayOf(1, -1), intArrayOf(1, 1))
        private val ORTH = arrayOf(intArrayOf(-1, 0), intArrayOf(1, 0), intArrayOf(0, -1), intArrayOf(0, 1))

        /** 1マスだけ動ける向き(先手から見て。上が -1)。桂馬の跳びもここに入れる */
        val STEPS: Array<Array<IntArray>> = arrayOf(
            arrayOf(),
            arrayOf(intArrayOf(-1, 0)),
            arrayOf(),
            arrayOf(intArrayOf(-2, -1), intArrayOf(-2, 1)),
            arrayOf(intArrayOf(-1, -1), intArrayOf(-1, 0), intArrayOf(-1, 1), intArrayOf(1, -1), intArrayOf(1, 1)),
            GOLD,
            arrayOf(),
            arrayOf(),
            DIAG + ORTH,
            GOLD, GOLD, GOLD, GOLD,
            ORTH,
            DIAG,
        )

        /** どこまでも進める向き */
        val SLIDES: Array<Array<IntArray>> = arrayOf(
            arrayOf(), arrayOf(), arrayOf(intArrayOf(-1, 0)), arrayOf(), arrayOf(), arrayOf(),
            DIAG, ORTH, arrayOf(), arrayOf(), arrayOf(), arrayOf(), arrayOf(), DIAG, ORTH,
        )

        /** 利きを調べる表(桂馬は除く)。[(dr+1)*3 + dc+1] */
        private val STEP_MASK: Array<BooleanArray> = Array(15) { k ->
            BooleanArray(9).also { m -> for (d in STEPS[k]) if (abs(d[0]) <= 1) m[(d[0] + 1) * 3 + d[1] + 1] = true }
        }
        private val SLIDE_MASK: Array<BooleanArray> = Array(15) { k ->
            BooleanArray(9).also { m -> for (d in SLIDES[k]) m[(d[0] + 1) * 3 + d[1] + 1] = true }
        }

        /** 玉の守りになる駒(金・銀・成り駒) */
        private val DEFENDER = BooleanArray(15).also { for (k in intArrayOf(G, S, TO, NL, NN, NS)) it[k] = true }

        val VALUES = intArrayOf(0, 100, 280, 320, 480, 540, 780, 950, 0, 520, 500, 500, 520, 1050, 1250)
        val SMALL_VALUES = intArrayOf(0, 100, 280, 320, 500, 560, 700, 850, 0, 580, 500, 500, 560, 980, 1150)

        private val ZOB = LongArray(4096).also { a ->
            val r = Random(20261107)
            for (i in a.indices) a[i] = r.nextLong()
        }

        val brain = Brain<ShogiState> { rules, s, seat, level, rng, budget ->
            val g = rules as Shogi
            val legal = g.legalMoves(s)
            if (legal.size == 1) return@Brain legal[0]
            val eng = Engine(g, budget, s)
            when (level) {
                // 初級: 1手先(取り合いの決着までは見る)だけを見て、点数の近い手から選ぶ
                Level.EASY -> pickSoft(eng.rootScores(legal, 1, seat) ?: Engine(g, Budget(400), s).rootScores(legal, 1, seat), legal, rng, 140)
                // 中級: 相手の応手まで読む
                // 時間切れの後は、新しい盤で読み直す(途中で止まった読みの盤は、駒が動いたままなので使わない。0.4.12 の確認で発見)
                Level.NORMAL -> pickSoft(eng.rootScores(legal, 2, seat) ?: Engine(g, Budget(400), s).rootScores(legal, 1, seat), legal, rng, 45)
                Level.HARD -> eng.best(legal, if (g.small) 9 else 7, seat, rng)
            }
        }

        /** 点数の近い手から、差に応じた確率で選ぶ。詰みは必ず指し、詰まされる手は避ける */
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

        val def = GameDef("shogi", { Shogi(false) }, brain)
        val smallDef = GameDef("gogo", { Shogi(true) }, brain)
    }
}
