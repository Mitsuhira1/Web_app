package jp.yonekou.asobi26.core

import kotlin.random.Random

/**
 * 「同じ種と手の並びなら、どの環境でも同じ局面になる」ことの試験(クロスプレイの土台)。
 * 全ゲームを、種から決まる「ランダムな合法手」で終局まで指し、毎手の合法手・手番・得点・結果を 64bit のハッシュにまとめる。
 * JVM(Android 版と同じ実行系)と JS(ブラウザ)で出力を比べ、1 行でも違えば乱数・並べ替え・規則がずれている。
 */
object CrossCheck {
    private fun mix(h: Long, v: Long): Long {
        var x = (h xor v) * 0x100000001B3L
        x = x xor (x ushr 29)
        return x
    }

    private fun <S> playout(def: GameDef<S>, options: GameOptions, seed: Long, cpuMoves: Int): String {
        val rules = def.makeRules(options)
        var s = rules.initial(Random(seed))
        val pick = Random(seed * 31 + 7)
        val brainRng = Random(seed * 17 + 3)
        var h = 0xCBF29CE484222325uL.toLong()
        var steps = 0
        while (steps < 4000) {
            val seat = rules.toMove(s)
            if (seat < 0) break
            val legal = rules.legalMoves(s)
            if (legal.isEmpty()) break
            h = mix(h, seat.toLong()); h = mix(h, legal.size.toLong())
            for (m in legal) h = mix(h, m.toLong())
            rules.scores(s)?.forEach { h = mix(h, it.toLong()) }
            val m = if (steps < cpuMoves && rules !is ConcurrentRules<*>) {
                def.brain.choose(rules, s, seat, Level.EASY, brainRng, Budget(600_000))
            } else legal[pick.nextInt(legal.size)]
            h = mix(h, m.toLong())
            s = rules.play(s, m)
            steps++
        }
        val o = rules.outcome(s)
        h = mix(h, (o?.winner ?: -9).toLong())
        rules.scores(s)?.forEach { h = mix(h, it.toLong()) }
        return "steps=$steps winner=${o?.winner} hash=${h.toULong().toString(16)}"
    }

    /** 全ゲーム × 数個の種。cpuMoves > 0 なら最初の数手は CPU(初級)が指す */
    fun report(seeds: Int = 3, cpuMoves: Int = 0): String {
        val sb = StringBuilder()
        for (g in Catalog.all) {
            val def = g.def ?: continue
            for (k in 1..seeds) {
                val seed = 1000L * k + g.no
                sb.append(g.id).append(' ').append(seed).append(' ').append(playout(def, GameOptions(), seed, cpuMoves)).append('\n')
            }
        }
        // 席の並べ替え(Android 版 OnlineRoom.start と同じ手順)
        for (seed in longArrayOf(1L, 99L, 123456789012L, -5L)) {
            val order = mutableListOf(0, 1, 2, -1, -1, -1)
            val r = JavaRandom(seed)
            for (i in order.size - 1 downTo 1) { val j = r.nextInt(i + 1); val t = order[i]; order[i] = order[j]; order[j] = t }
            sb.append("seatshuffle ").append(seed).append(' ').append(order.joinToString(",")).append('\n')
        }
        return sb.toString()
    }
}
