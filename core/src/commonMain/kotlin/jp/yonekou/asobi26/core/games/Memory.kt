package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * 神経衰弱。裏返して並べた札から2枚めくり、同じ数なら取ってもう一度、違えば裏に戻して次の人へ。
 * 1〜6人(1人なら、全部そろえるまでの回数を数える)。札は52枚(同じ数が4枚)か26枚(♠と♥。同じ数が2枚)。
 * 手 = めくる場所の番号。
 * 並びは非公開(layout)。めくって見えた札は公開の情報で、seenAt に「何枚目にめくったか」を残す。CPU は seenAt の分だけを使う。
 */
class MemoryState(
    val players: Int,
    /** 場所ごとの札 */
    val layout: IntArray,
    /** 取った人(-1 = まだ場にある) */
    val taken: IntArray,
    /** この手番の1枚目(-1 = まだ) */
    val open1: Int,
    /** 外れて裏に戻す2枚(表示用。次の人がめくり始めるまで見せる) */
    val missed: IntArray?,
    val turn: Int,
    val pairs: IntArray,
    /** これまでにめくった枚数 */
    val flips: Int,
    /** 場所ごとに、最後に見えた時の flips(-1 = まだ見えていない) */
    val seenAt: IntArray,
    val attempts: Int,
    val lastMove: Int,
    val lastMover: Int,
    /** 直前の2枚目で当たったか */
    val hit: Boolean,
) {
    val left: Int get() = taken.count { it < 0 }
}

class Memory(val players: Int, val cards: Int) : Rules<MemoryState> {
    override val playerCount = players

    override fun initial(rng: Random): MemoryState {
        val pool = IntArray(cards) { it } // 26枚なら ♠ と ♥ の13枚ずつ
        for (i in pool.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val t = pool[i]; pool[i] = pool[j]; pool[j] = t }
        return MemoryState(players, pool, IntArray(pool.size) { -1 }, -1, null, 0, IntArray(players), 0, IntArray(pool.size) { -1 }, 0, -1, -1, false)
    }

    override fun toMove(s: MemoryState) = if (s.left == 0) -1 else s.turn

    override fun legalMoves(s: MemoryState): IntArray =
        if (s.left == 0) IntArray(0) else s.layout.indices.filter { s.taken[it] < 0 && it != s.open1 }.toIntArray()

    override fun play(s: MemoryState, m: Int): MemoryState {
        val seen = s.seenAt.copyOf()
        seen[m] = s.flips
        if (s.open1 < 0) {
            return MemoryState(players, s.layout, s.taken, m, null, s.turn, s.pairs, s.flips + 1, seen, s.attempts, m, s.turn, false)
        }
        val a = s.open1
        val hit = Cards.rank(s.layout[a]) == Cards.rank(s.layout[m])
        val taken = s.taken.copyOf()
        val pairs = s.pairs.copyOf()
        if (hit) { taken[a] = s.turn; taken[m] = s.turn; pairs[s.turn]++ }
        val next = if (hit) s.turn else (s.turn + 1) % players
        return MemoryState(players, s.layout, taken, -1, if (hit) null else intArrayOf(a, m), next, pairs, s.flips + 1, seen, s.attempts + 1, m, s.turn, hit)
    }

    override fun outcome(s: MemoryState): Outcome? {
        if (s.left > 0) return null
        if (players == 1) return Outcome(0, "${s.attempts}回で全部そろえました")
        val top = s.pairs.max()
        val w = s.pairs.indices.filter { s.pairs[it] == top }
        return Outcome(if (w.size == 1) w[0] else -1, "${top}組")
    }

    override fun scores(s: MemoryState): IntArray = if (players == 1) intArrayOf(s.attempts) else s.pairs

    companion object {
        /**
         * 覚えているか(人と同じように、古い札ほど忘れる)。age = その札が見えてから何枚めくったか。
         * 初級: 直前の2枚(さっき見えた2枚)を半分くらいの確かさで覚えているだけ。
         * 中級: 10枚前までを、古いほど忘れやすく覚えている。
         * 上級: 24枚前までを、中級よりよく覚えている(全部は覚えていない。上手な人くらい)。
         */
        fun remembers(level: Level, age: Int, rng: Random): Boolean = when (level) {
            Level.EASY -> age <= 2 && rng.nextDouble() < 0.5
            Level.NORMAL -> age <= 10 && rng.nextDouble() < 1.0 - age / 12.0
            Level.HARD -> age <= 24 && rng.nextDouble() < 1.0 - age / 30.0
        }

        val brain = Brain<MemoryState> { rules, s, _, level, rng, _ ->
            val legal = rules.legalMoves(s)
            // 覚えている札だけを使う(まだ見えていない札の中身は読まない)。覚えているかどうかは、めくるたびに決める
            val mem = BooleanArray(s.layout.size) { i -> s.seenAt[i] >= 0 && (i == s.open1 || remembers(level, s.flips - s.seenAt[i], rng)) }
            fun known(i: Int) = mem[i]
            val unknown = legal.filter { !known(it) }
            if (s.open1 < 0) {
                // 覚えている中に同じ数の2枚があれば、それをめくる
                val byRank = legal.filter { known(it) }.groupBy { Cards.rank(s.layout[it]) }
                byRank.values.firstOrNull { it.size >= 2 }?.let { return@Brain it[0] }
                return@Brain if (unknown.isNotEmpty()) unknown[rng.nextInt(unknown.size)] else legal[rng.nextInt(legal.size)]
            }
            val r = Cards.rank(s.layout[s.open1]) // 1枚目はいまめくって見えている
            legal.firstOrNull { known(it) && Cards.rank(s.layout[it]) == r }?.let { return@Brain it }
            if (unknown.isNotEmpty()) unknown[rng.nextInt(unknown.size)] else legal[rng.nextInt(legal.size)]
        }

        val def = GameDef(
            "memory",
            { Memory(it.int("players", 2).coerceIn(1, 6), if (it.int("cards", 52) == 26) 26 else 52) },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 2).coerceIn(1, 6) },
        )
    }
}
