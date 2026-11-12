package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.Budget
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import jp.yonekou.asobi26.core.softPick
import kotlin.math.ln
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * 碁(9・13・19路)。席0=黒(先手)、席1=白。日本ルール(地と取った石を数える)、コミ6目半。
 * board: 0=空 1=黒 2=白。手: 0〜n*n-1 = 石を置く、PASS = n*n、RESIGN = n*n+1。
 * 自殺手と、前に出た局面に戻る手(コウ)は打てない。2回続けてパスで終局。
 * 終局の死に石は、その局面からの試し打ちをくり返して「たいてい取られる石」を死に石とみなす(乱数は局面から決まるので、毎回同じ結果)。
 */
class GoState(
    val n: Int,
    val board: IntArray,
    val turn: Int,
    /** 取った石(アゲハマ)。席ごと */
    val captures: IntArray,
    val passes: Int,
    val ply: Int,
    val hashes: LongArray,
    val lastMove: Int,
    val winner: Int,
    val over: Boolean,
    val reason: String,
    /** 終局後の地の持ち主(0=なし 1=黒 2=白)と、死に石(true)。終局前は null */
    val owner: IntArray?,
    val dead: BooleanArray?,
    /** 直前の手で取った石の位置 */
    val lastCaptured: IntArray,
)

class Go(val n: Int) : Rules<GoState> {
    val size = n * n
    val PASS = size
    val RESIGN = size + 1
    val komiHalf = 13 // コミ6目半 = 13/2

    override val playerCount = 2

    private val nb: Array<IntArray> = Array(size) { i ->
        val r = i / n; val c = i % n
        buildList { if (r > 0) add(i - n); if (r < n - 1) add(i + n); if (c > 0) add(i - 1); if (c < n - 1) add(i + 1) }.toIntArray()
    }

    override fun initial(rng: Random) = GoState(n, IntArray(size), 0, IntArray(2), 0, 0, longArrayOf(0L), -1, -1, false, "", null, null, IntArray(0))

    override fun toMove(s: GoState): Int = if (s.over) -1 else s.turn

    // ---- 石のかたまりと呼吸点 ----
    private fun group(b: IntArray, p: Int, out: IntArray): Int {
        val color = b[p]
        var cnt = 0
        out[cnt++] = p
        val seen = BooleanArray(size)
        seen[p] = true
        var k = 0
        while (k < cnt) {
            val q = out[k++]
            for (x in nb[q]) if (!seen[x] && b[x] == color) { seen[x] = true; out[cnt++] = x }
        }
        return cnt
    }

    private fun hasLiberty(b: IntArray, stones: IntArray, cnt: Int): Boolean {
        for (k in 0 until cnt) for (x in nb[stones[k]]) if (b[x] == 0) return true
        return false
    }

    private fun libertyCount(b: IntArray, stones: IntArray, cnt: Int, limit: Int): Int {
        val seen = HashSet<Int>()
        for (k in 0 until cnt) for (x in nb[stones[k]]) if (b[x] == 0) { seen.add(x); if (seen.size >= limit) return limit }
        return seen.size
    }

    /** 置いてみる(b を書き換える)。取った石の数を返す。自殺手なら -1(b は元に戻さないので写しに使う) */
    private fun place(b: IntArray, p: Int, color: Int, buf: IntArray, captured: MutableList<Int>?): Int {
        b[p] = color
        val opp = 3 - color
        var taken = 0
        for (x in nb[p]) {
            if (b[x] != opp) continue
            val cnt = group(b, x, buf)
            if (!hasLiberty(b, buf, cnt)) {
                for (k in 0 until cnt) { b[buf[k]] = 0; captured?.add(buf[k]) }
                taken += cnt
            }
        }
        val cnt = group(b, p, buf)
        if (!hasLiberty(b, buf, cnt)) return -1
        return taken
    }

    private fun hash(b: IntArray, turn: Int): Long {
        var h = if (turn == 0) 0x51L else 0x77L
        for (i in 0 until size) if (b[i] != 0) h = h xor (ZOB[i * 2 + b[i] - 1])
        return h
    }

    override fun legalMoves(s: GoState): IntArray {
        if (s.over) return IntArray(0)
        val out = ArrayList<Int>()
        val buf = IntArray(size)
        val color = s.turn + 1
        for (p in 0 until size) {
            if (s.board[p] != 0) continue
            val b = s.board.copyOf()
            if (place(b, p, color, buf, null) < 0) continue
            val h = hash(b, 1 - s.turn)
            if (s.hashes.contains(h)) continue // コウ(前の局面に戻る)
            out.add(p)
        }
        out.add(PASS)
        out.add(RESIGN)
        return out.toIntArray()
    }

    override fun isLegal(s: GoState, m: Int): Boolean {
        if (s.over) return false
        if (m == PASS || m == RESIGN) return true
        if (m !in 0 until size || s.board[m] != 0) return false
        val b = s.board.copyOf()
        if (place(b, m, s.turn + 1, IntArray(size), null) < 0) return false
        return !s.hashes.contains(hash(b, 1 - s.turn))
    }

    override fun play(s: GoState, m: Int): GoState {
        val ply = s.ply + 1
        if (m == RESIGN) return GoState(n, s.board, s.turn, s.captures, s.passes, ply, s.hashes, m, 1 - s.turn, true, "投了", null, null, IntArray(0))
        if (m == PASS) {
            val passes = s.passes + 1
            val h = hash(s.board, 1 - s.turn)
            val hs = s.hashes.copyOf(s.hashes.size + 1).also { it[it.size - 1] = h }
            val st = GoState(n, s.board, 1 - s.turn, s.captures, passes, ply, hs, m, -1, false, "", null, null, IntArray(0))
            return if (passes >= 2) finish(st) else st
        }
        val b = s.board.copyOf()
        val caps = ArrayList<Int>()
        place(b, m, s.turn + 1, IntArray(size), caps)
        val captures = s.captures.copyOf().also { it[s.turn] += caps.size }
        val h = hash(b, 1 - s.turn)
        val hs = s.hashes.copyOf(s.hashes.size + 1).also { it[it.size - 1] = h }
        val st = GoState(n, b, 1 - s.turn, captures, 0, ply, hs, m, -1, false, "", null, null, caps.toIntArray())
        return if (ply >= size * 3) finish(st) else st
    }

    override fun outcome(s: GoState): Outcome? = if (s.over) Outcome(s.winner, s.reason) else null

    override fun scores(s: GoState): IntArray = intArrayOf(s.captures[0], s.captures[1])

    // ---- 終局の数え方 ----
    /** 試し打ちを何回もして、各点がどちらの色になりやすいかを数える(+ = 黒) */
    fun ownership(board: IntArray, turn: Int, playouts: Int, rng: Random): FloatArray {
        val sum = FloatArray(size)
        val buf = IntArray(size)
        repeat(playouts) {
            val b = board.copyOf()
            playout(b, turn, rng, buf, size * 2)
            val own = areaOwner(b)
            for (i in 0 until size) sum[i] += when (own[i]) { 1 -> 1f; 2 -> -1f; else -> 0f }
        }
        for (i in 0 until size) sum[i] /= playouts
        return sum
    }

    /** 盤を最後まで埋めた時の、各点の持ち主(石の色、または一色だけに囲まれた空き) */
    private fun areaOwner(b: IntArray): IntArray {
        val own = IntArray(size)
        val seen = BooleanArray(size)
        val q = IntArray(size)
        for (i in 0 until size) {
            if (b[i] != 0) { own[i] = b[i]; continue }
            if (seen[i]) continue
            var cnt = 0; q[cnt++] = i; seen[i] = true
            var k = 0; var touch = 0
            while (k < cnt) {
                val p = q[k++]
                for (x in nb[p]) {
                    if (b[x] == 0) { if (!seen[x]) { seen[x] = true; q[cnt++] = x } } else touch = touch or b[x]
                }
            }
            val o = if (touch == 1) 1 else if (touch == 2) 2 else 0
            for (t in 0 until cnt) own[q[t]] = o
        }
        return own
    }

    private fun finish(s: GoState): GoState {
        val rng = Random(s.hashes.last() xor 0x5EEDL)
        val own = ownership(s.board, s.turn, 60, rng)
        val b = s.board.copyOf()
        val dead = BooleanArray(size)
        val prisoners = s.captures.copyOf()
        for (i in 0 until size) {
            val v = b[i]
            if (v == 1 && own[i] < -0.5f) { dead[i] = true; prisoners[1]++ }
            if (v == 2 && own[i] > 0.5f) { dead[i] = true; prisoners[0]++ }
        }
        for (i in 0 until size) if (dead[i]) b[i] = 0
        val area = areaOwner(b)
        // 日本ルール: 地(石のない、一色に囲まれた点。死に石を取った跡も含む)+ 取った石
        var terrB = 0; var terrW = 0
        val owner = IntArray(size)
        for (i in 0 until size) if (b[i] == 0) {
            owner[i] = area[i]
            if (area[i] == 1) terrB++ else if (area[i] == 2) terrW++
        }
        val black2 = (terrB + prisoners[0]) * 2
        val white2 = (terrW + prisoners[1]) * 2 + komiHalf
        val diff = black2 - white2
        val reason = if (diff > 0) "黒の${fmtHalf(diff)}目勝ち" else "白の${fmtHalf(-diff)}目勝ち"
        return GoState(n, s.board, s.turn, s.captures, s.passes, s.ply, s.hashes, s.lastMove, if (diff > 0) 0 else 1, true, reason, owner, dead, IntArray(0))
    }

    private fun fmtHalf(x: Int) = if (x % 2 == 0) "${x / 2}" else "${x / 2}.5"

    // ---- 試し打ち(CPU と終局の判定で使う) ----
    /** 自分の目(四方が自分の石で、つぶすと損な点)か */
    private fun isEye(b: IntArray, p: Int, color: Int): Boolean {
        for (x in nb[p]) if (b[x] != color) return false
        return true
    }

    /** b を最後まで打ち進める(書き換える)。打てなくなったら終わり */
    fun playout(b: IntArray, turn0: Int, rng: Random, buf: IntArray, maxMoves: Int) {
        var turn = turn0
        var passes = 0
        val empties = IntArray(size)
        var moves = 0
        while (passes < 2 && moves < maxMoves) {
            val color = turn + 1
            var ne = 0
            for (i in 0 until size) if (b[i] == 0) empties[ne++] = i
            var played = false
            while (ne > 0) {
                val k = rng.nextInt(ne)
                val p = empties[k]
                empties[k] = empties[--ne]
                if (isEye(b, p, color)) continue
                val save = b.copyOf()
                if (place(b, p, color, buf, null) < 0) { save.copyInto(b); continue }
                played = true
                break
            }
            passes = if (played) 0 else passes + 1
            turn = 1 - turn
            moves++
        }
    }

    companion object {
        private val ZOB = LongArray(19 * 19 * 2).also { a -> val r = Random(1919); for (i in a.indices) a[i] = r.nextLong() }

        /**
         * CPU。初級: 形の良し悪しの簡単な目安で選ぶ。中級・上級: モンテカルロ木探索(試し打ちの勝率で手を選ぶ)。
         * 相手の手番の情報は盤の上のものだけ(碁は全部見えている)。
         */
        val brain = Brain<GoState> { rules, s, seat, level, rng, budget ->
            val g = rules as Go
            // 相手がパスしていて、こちらが勝っているならパスで終わらせる
            val legal = g.legalMoves(s).filter { it != g.RESIGN }
            val places = legal.filter { it != g.PASS }
            if (places.isEmpty()) return@Brain g.PASS
            when (level) {
                Level.EASY -> {
                    val scored = places.map { it to g.heuristic(s, it, seat) }
                    val best = softPick(rng, scored, 1.5) { it.second }
                    if (best.second < -5) g.PASS else best.first
                }
                Level.NORMAL -> g.mcts(s, places, rng, budget, if (g.n == 9) 900 else 500)
                Level.HARD -> g.mcts(s, places, rng, budget, if (g.n == 9) 8000 else 4000)
            }
        }

        val def = GameDef(
            "go",
            { Go(it.int("size", 9).let { v -> if (v in listOf(9, 13, 19)) v else 9 }) },
            brain,
        )
    }

    // ---- CPU の部品 ----
    /** 手の目安の点(取る・逃げる・隅と辺の3線目あたり・直前の手の近く) */
    fun heuristic(s: GoState, p: Int, seat: Int): Double {
        val color = seat + 1
        val b = s.board.copyOf()
        val buf = IntArray(size)
        val taken = place(b, p, color, buf, null)
        if (taken < 0) return -100.0
        var v = taken * 4.0
        val cnt = group(b, p, buf)
        val libs = libertyCount(b, buf, cnt, 3)
        if (libs == 1) v -= 6.0 else if (libs == 2) v -= 0.5
        // 相手をアタリにする
        for (x in nb[p]) if (b[x] == 3 - color) { val c2 = group(b, x, buf); if (libertyCount(b, buf, c2, 2) == 1) v += 2.0 }
        // 自分の目をつぶさない
        if (isEye(s.board, p, color)) v -= 8.0
        val r = p / n; val c = p % n
        val line = minOf(r, c, n - 1 - r, n - 1 - c)
        if (s.ply < n) v += when (line) { 2, 3 -> 1.5; 0 -> -1.5; else -> 0.0 }
        if (s.lastMove in 0 until size) {
            val lr = s.lastMove / n; val lc = s.lastMove % n
            if (kotlin.math.abs(lr - r) <= 2 && kotlin.math.abs(lc - c) <= 2) v += 1.0
        }
        return v
    }

    private class Node(val move: Int, val parent: Node?) {
        val children = ArrayList<Node>()
        var untried: MutableList<Int>? = null
        var visits = 0
        var wins = 0.0
    }

    /** モンテカルロ木探索。maxPlayouts 回か期限まで試し打ちして、いちばん多く調べた手を返す */
    fun mcts(s: GoState, rootMoves: List<Int>, rng: Random, budget: Budget, maxPlayouts: Int): Int {
        val root = Node(-1, null)
        // 根の候補は規則の合法手(コウを含めて確かめ済み)から、自分の目をつぶす手を除いたもの
        root.untried = rootMoves.filter { !isEye(s.board, it, s.turn + 1) }.shuffled(rng).toMutableList()
        val buf = IntArray(size)
        fun candidates(b: IntArray, turn: Int): MutableList<Int> {
            val color = turn + 1
            val list = ArrayList<Int>()
            for (p in 0 until size) if (b[p] == 0 && !isEye(b, p, color)) list.add(p)
            list.shuffle(rng)
            return list
        }
        var done = 0
        while (done < maxPlayouts && !(budget.over() && done >= 30)) {
            val b = s.board.copyOf()
            var turn = s.turn
            var node = root
            // 選ぶ
            while (true) {
                if (node.untried == null) node.untried = candidates(b, turn)
                if (node.untried!!.isNotEmpty() || node.children.isEmpty()) break
                val logN = ln(node.visits.toDouble() + 1)
                node = node.children.maxBy { ch -> ch.wins / (ch.visits + 1e-9) + 0.9 * sqrt(logN / (ch.visits + 1e-9)) }
                if (place(b, node.move, turn + 1, buf, null) < 0) { b[node.move] = 0 }
                turn = 1 - turn
            }
            // 広げる
            val un = node.untried!!
            while (un.isNotEmpty()) {
                val p = un.removeAt(un.size - 1)
                val save = b.copyOf()
                if (place(b, p, turn + 1, buf, null) < 0) { save.copyInto(b); continue }
                val child = Node(p, node)
                node.children.add(child)
                node = child
                turn = 1 - turn
                break
            }
            // 試し打ち
            playout(b, turn, rng, buf, size * 2)
            val own = areaOwner(b)
            var score = -komiHalf / 2.0
            for (i in 0 until size) score += when (own[i]) { 1 -> 1.0; 2 -> -1.0; else -> 0.0 }
            val blackWins = score > 0
            // 戻す(各節点の「その手を打った側」から見た勝ち)
            var nd: Node? = node
            while (nd != null) {
                nd.visits++
                val mover = if (nd.parent == null) 1 - s.turn else {
                    // nd.move を打った側: 根から数えた深さで決まる
                    var depth = 0; var x: Node? = nd; while (x?.parent != null) { depth++; x = x.parent }
                    if (depth % 2 == 1) s.turn else 1 - s.turn
                }
                if ((mover == 0) == blackWins) nd.wins += 1.0
                nd = nd.parent
            }
            done++
        }
        if (root.children.isEmpty()) return PASS
        val best = root.children.maxBy { it.visits }
        val rate = best.wins / best.visits
        // 相手がパスした後、勝っているならパスで終わらせる。勝ち目がほとんどなければ投了
        if (s.passes == 1 && rate > 0.5) return PASS
        if (rate < 0.04 && s.ply > size / 2) return RESIGN
        return best.move
    }
}
