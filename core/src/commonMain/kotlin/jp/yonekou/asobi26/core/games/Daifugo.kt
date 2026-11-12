package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * 大富豪(大貧民)。3〜6人。ジョーカー1枚を入れた53枚を全部配る。
 * 強さ: 3 < 4 < … < K < A < 2 < ジョーカー(1枚で出した時)。革命の間は 3〜2 の強さが逆になる。
 * 場に出ている札と同じ形(同じ枚数の組、または同じ長さの階段)で、より強い札を出す。出せない・出さない時はパス。
 * 一度パスした人は、場が流れるまで出せない。最後に出した人以外が全員パスしたら場が流れ、最後に出した人から始める。
 * 組: 同じ数の1〜4枚(ジョーカーはどの数の代わりにもなる)。4枚で出すと革命。
 * 階段(設定): 同じマークの3枚以上の続き。8切り(設定): 8を含む札を出すと場が流れ、出した人から続ける。
 * しばり(設定): 前と同じマークの組み合わせで出すと、場が流れるまでそのマークしか出せない。
 * スペ3返し: 1枚で出たジョーカーには、♠3 だけが勝てる(出すと場が流れる)。
 * 2回目からは、前の回の順位で札を交換する(大貧民 → 大富豪へ一番強い2枚、大富豪 → 大貧民へ好きな2枚。4人以上なら貧民と富豪で1枚)。
 * 決まった回数を遊び、順位の点(1位が人数-1点 … 最下位が0点)の合計が多い人の勝ち。
 * 手: PASS / JOKER1 / 組 100 + 強さ*64 + ジョーカー*16 + マーク(4ビット) / 階段 2000 + マーク*200 + 下の強さ*14 + 長さ / 交換 10000 + a*64 + b、20000 + a。
 * 札の番号: 0〜51 は Cards と同じ、52 = ジョーカー。強さ(v)は 3 = 0 … 2 = 12。CPU は自分の手札と、場に出た札だけを見る。
 */
class DaifugoState(
    val players: Int,
    val seed: Long,
    val round: Int,
    val hands: LongArray,
    /** 場の札(最後に出た手。-1 = 場が空) */
    val field: Int,
    val fieldOwner: Int,
    val passed: BooleanArray,
    val rev: Boolean,
    /** しばりのマーク(0 = なし) */
    val lock: Int,
    /** この回の順位(-1 = まだ) */
    val place: IntArray,
    /** 前の回の順位(交換に使う。1回目は全員 -1) */
    val prevPlace: IntArray,
    val points: IntArray,
    /** 0 = 交換(札を渡す)、1 = 札を出す */
    val phase: Int,
    val turn: Int,
    /** これまでに場に出た札(この回) */
    val gone: Long,
    val lastMove: Int,
    val lastMover: Int,
    /** 直前に終わった回の順位(表示用) */
    val lastPlaces: IntArray?,
    /** 直前の手で場が流れたか(8切り・全員パスなど。表示用) */
    val cleared: Boolean,
    val over: Boolean,
    /** 11バックで、場が流れるまで強さが逆になっている */
    val jback: Boolean = false,
    /** 7渡し・10捨て・12ボンバーで、まだ渡す・捨てる・言う数 */
    val pGive: Int = 0,
    val pDiscard: Int = 0,
    val pBomb: Int = 0,
    /** 5スキップで飛ばす人数 */
    val pSkip: Int = 0,
    /** 8切り・スペ3返しで、出し終えたら場が流れる */
    val pClear: Boolean = false,
) {
    /** いまの強さの向き(革命と11バック) */
    val flipped: Boolean get() = rev != jback
    fun count(p: Int) = hands[p].countOneBits()
    fun has(p: Int, c: Int) = (hands[p] shr c) and 1L == 1L
}

/** 出す手を読みやすくしたもの */
class DfPlay(val kind: Int, val n: Int, val v: Int, val joker: Boolean, val suitMask: Int, val cards: Long) {
    val isJokerSingle get() = kind == Daifugo.K_GROUP && n == 1 && joker
    val hasEight get() = if (kind == Daifugo.K_STAIRS) v <= 5 && 5 < v + n else v == 5 && !isJokerSingle
}

class Daifugo(
    val players: Int,
    val rounds: Int,
    val stairs: Boolean,
    val eightCut: Boolean,
    val lockRule: Boolean,
    val revolution: Boolean = true,
    val spadeThree: Boolean = true,
    /** 7渡し: 7を出した枚数だけ、次の人に札を渡す */
    val sevenPass: Boolean = false,
    /** 11バック: Jを出すと、場が流れるまで強さが逆になる */
    val jBack: Boolean = false,
    /** 12ボンバー: Qを出した枚数だけ数を言い、全員がその数の札を捨てる */
    val qBomber: Boolean = false,
    /** 5スキップ: 5を出した枚数だけ、次の人を飛ばす */
    val fiveSkip: Boolean = false,
    /** 10捨て: 10を出した枚数だけ、手札を捨てる */
    val tenDiscard: Boolean = false,
) : Rules<DaifugoState> {
    override val playerCount = players

    override fun initial(rng: Random): DaifugoState = startRound(rng.nextLong(), 0, IntArray(players) { -1 }, IntArray(players), null, -1, -1)

    private fun startRound(seed: Long, round: Int, prev: IntArray, points: IntArray, lastPlaces: IntArray?, m: Int, mover: Int): DaifugoState {
        if (round >= rounds) {
            return DaifugoState(players, seed, round, LongArray(players), -1, -1, BooleanArray(players), false, 0, IntArray(players) { -1 }, prev, points, 1, 0, 0L, m, mover, lastPlaces, false, true)
        }
        val d = IntArray(53) { it }
        val r = Random(seed * 7_919 + round * 104_723L)
        for (i in 52 downTo 1) { val j = r.nextInt(i + 1); val t = d[i]; d[i] = d[j]; d[j] = t }
        val hands = LongArray(players)
        for ((k, c) in d.withIndex()) hands[k % players] = hands[k % players] or (1L shl c)
        if (round == 0) {
            val first = (0 until players).first { (hands[it] shr DIA3) and 1L == 1L }
            return DaifugoState(players, seed, round, hands, -1, -1, BooleanArray(players), false, 0, IntArray(players) { -1 }, prev, points, 1, first, 0L, m, mover, lastPlaces, false, false)
        }
        // 交換: 下の人から一番強い札を自動で取る
        val rich = prev.indexOf(0)
        val poor = prev.indexOf(players - 1)
        moveStrongest(hands, poor, rich, 2)
        if (players >= 4) moveStrongest(hands, prev.indexOf(players - 2), prev.indexOf(1), 1)
        return DaifugoState(players, seed, round, hands, -1, -1, BooleanArray(players), false, 0, IntArray(players) { -1 }, prev, points, 0, rich, 0L, m, mover, lastPlaces, false, false)
    }

    private fun moveStrongest(hands: LongArray, from: Int, to: Int, n: Int) {
        repeat(n) {
            val c = (0..52).filter { (hands[from] shr it) and 1L == 1L }.maxBy { power(it, false) }
            hands[from] = hands[from] and (1L shl c).inv()
            hands[to] = hands[to] or (1L shl c)
        }
    }

    override fun toMove(s: DaifugoState) = if (s.over) -1 else s.turn

    override fun legalMoves(s: DaifugoState): IntArray {
        if (s.over) return IntArray(0)
        val h = s.hands[s.turn]
        val cards = (0..52).filter { (h shr it) and 1L == 1L }
        if (s.phase == 0) {
            val two = s.prevPlace[s.turn] == 0
            val out = ArrayList<Int>()
            if (two) { for (i in cards.indices) for (j in i + 1 until cards.size) out.add(GIVE2 + cards[i] * 64 + cards[j]) }
            else for (c in cards) out.add(GIVE1 + c)
            return out.toIntArray()
        }
        if (s.phase == 2) return cards.map { SEVEN + it }.toIntArray()
        if (s.phase == 3) return cards.map { TEN + it }.toIntArray()
        if (s.phase == 4) return (0 until 13).map { BOMB + it }.toIntArray()
        val all = candidates(h, stairs)
        val out = ArrayList<Int>()
        if (s.field < 0) out.addAll(all)
        else {
            val f = decode(s.field)
            for (m in all) if ((spadeThree || !f.isJokerSingle) && beats(decode(m), f, s.flipped, s.lock)) out.add(m)
            out.add(PASS)
        }
        return out.toIntArray()
    }

    override fun play(s: DaifugoState, m: Int): DaifugoState {
        val p = s.turn
        val hands = s.hands.copyOf()
        if (s.phase == 0) {
            // 大富豪(と富豪)が渡す札
            val give = if (m >= GIVE1) listOf(m - GIVE1) else listOf((m - GIVE2) / 64, (m - GIVE2) % 64)
            val to = if (m >= GIVE1) s.prevPlace.indexOf(players - 2) else s.prevPlace.indexOf(players - 1)
            for (c in give) { hands[p] = hands[p] and (1L shl c).inv(); hands[to] = hands[to] or (1L shl c) }
            val next = if (m < GIVE1 && players >= 4) s.prevPlace.indexOf(1) else -1
            if (next >= 0) return copy(s, hands = hands, turn = next, m = m, mover = p)
            // 交換が済んだら、大貧民から出す
            return copy(s, hands = hands, phase = 1, turn = s.prevPlace.indexOf(players - 1), m = m, mover = p)
        }
        if (s.phase >= 2) return special(s, m)
        val passed = s.passed.copyOf()
        val place = s.place.copyOf()
        if (m == PASS) {
            passed[p] = true
            val active = (0 until players).filter { place[it] < 0 }
            // 最後に出した人以外が全員パスしたら、場が流れる
            if (active.all { it == s.fieldOwner || passed[it] }) {
                val lead = if (place[s.fieldOwner] < 0) s.fieldOwner else nextActive(place, s.fieldOwner)
                return copy(s, field = -1, fieldOwner = -1, passed = BooleanArray(players), lock = 0, turn = lead, m = m, mover = p, cleared = true, jback = false)
            }
            return copy(s, passed = passed, turn = nextOpen(place, passed, p), m = m, mover = p)
        }
        val play = decode(m)
        hands[p] = hands[p] and play.cards.inv()
        val gone = s.gone or play.cards
        var rev = s.rev
        if (revolution && play.kind == K_GROUP && play.n == 4) rev = !rev
        var lock = s.lock
        if (lockRule && s.field >= 0) {
            val f = decode(s.field)
            if (!f.joker && !play.joker && f.suitMask == play.suitMask && f.kind == play.kind) lock = play.suitMask
        }
        if (hands[p] == 0L) place[p] = (0 until players).count { place[it] >= 0 }
        val active = (0 until players).filter { place[it] < 0 }
        if (active.size <= 1) {
            for (q in active) place[q] = players - 1
            val pts = s.points.copyOf()
            for (q in 0 until players) pts[q] += players - 1 - place[q]
            return startRound(s.seed, s.round + 1, place, pts, place.copyOf(), m, p)
        }
        // 8切り・スペ3返しは、出し終えたら場が流れて、出した人から続ける
        val spade3 = spadeThree && s.field >= 0 && decode(s.field).isJokerSingle && m == group(0, false, 1)
        val left = hands[p].countOneBits()
        val give = if (sevenPass && left > 0) minOf(countRank(play, V7), left) else 0
        val discard = if (tenDiscard && left > 0) minOf(countRank(play, V10), left - give) else 0
        val bomb = if (qBomber) countRank(play, VQ) else 0
        val skip = if (fiveSkip) countRank(play, V5) else 0
        val jb = if (jBack && countRank(play, VJ) > 0) !s.jback else s.jback
        val st = copy(s, hands = hands, field = m, fieldOwner = p, passed = passed, rev = rev, lock = lock, place = place, turn = p, gone = gone, m = m, mover = p,
            jback = jb, pGive = give, pDiscard = discard, pBomb = bomb, pSkip = skip, pClear = (eightCut && play.hasEight) || spade3)
        return nextStep(st)
    }

    /** 札に含まれる、強さ v の札の数(組はジョーカーも数える。階段は1枚) */
    private fun countRank(p: DfPlay, v: Int): Int = when {
        p.isJokerSingle -> 0
        p.kind == K_STAIRS -> if (v in p.v until p.v + p.n) 1 else 0
        else -> if (p.v == v) p.n else 0
    }

    /** 7渡し・10捨て・12ボンバーの選ぶ所へ進むか、出し終えた後の番を決める */
    private fun nextStep(st: DaifugoState): DaifugoState {
        val p = st.fieldOwner
        if (st.pGive > 0 && st.hands[p] != 0L) return withPhase(st, 2, p)
        if (st.pDiscard > 0 && st.hands[p] != 0L) return withPhase(st, 3, p)
        if (st.pBomb > 0) return withPhase(st, 4, p)
        return finish(st)
    }

    private fun withPhase(st: DaifugoState, phase: Int, turn: Int) = copy(st, phase = phase, turn = turn, m = st.lastMove, mover = st.lastMover, cleared = false)

    /** 出し終えた後: 場が流れるか、次の人(5スキップなら飛ばす)へ */
    private fun finish(st: DaifugoState): DaifugoState {
        val p = st.fieldOwner
        val place = st.place
        val passed = st.passed
        val active = (0 until players).filter { place[it] < 0 }
        val open = active.filter { it != p && !passed[it] }
        val base = copy(st, phase = 1, turn = p, m = st.lastMove, mover = st.lastMover, pGive = 0, pDiscard = 0, pBomb = 0, pSkip = 0, pClear = false)
        // 8切り・ほかに出せる人がいない・5スキップで全員を飛ばした時は、場が流れて出した人から続ける
        if (st.pClear || open.isEmpty() || st.pSkip >= open.size) {
            val lead = if (place[p] < 0) p else nextActive(place, p)
            return copy(base, field = -1, fieldOwner = -1, passed = BooleanArray(players), lock = 0, turn = lead, m = st.lastMove, mover = st.lastMover, cleared = true, jback = false)
        }
        var t = nextOpen(place, passed, p)
        repeat(st.pSkip) { t = nextOpen(place, passed, t) }
        return copy(base, turn = t, m = st.lastMove, mover = st.lastMover)
    }

    /** 回が終わったか(残りが1人以下なら次の回へ) */
    private fun roundEnd(st: DaifugoState, place: IntArray, m: Int, p: Int): DaifugoState? {
        val active = (0 until players).filter { place[it] < 0 }
        if (active.size > 1) return null
        for (q in active) place[q] = players - 1
        val pts = st.points.copyOf()
        for (q in 0 until players) pts[q] += players - 1 - place[q]
        return startRound(st.seed, st.round + 1, place, pts, place.copyOf(), m, p)
    }

    /** 7渡し・10捨て・12ボンバーの手 */
    private fun special(s: DaifugoState, m: Int): DaifugoState {
        val p = s.turn
        val hands = s.hands.copyOf()
        val place = s.place.copyOf()
        var gone = s.gone
        fun out(q: Int) { if (hands[q] == 0L && place[q] < 0) place[q] = (0 until players).count { place[it] >= 0 } }
        var st: DaifugoState
        when (s.phase) {
            2 -> {
                val c = m - SEVEN
                val to = nextActive(place, p)
                hands[p] = hands[p] and (1L shl c).inv(); hands[to] = hands[to] or (1L shl c)
                out(p)
                st = copy(s, hands = hands, place = place, turn = p, m = m, mover = p, pGive = s.pGive - 1)
            }
            3 -> {
                val c = m - TEN
                hands[p] = hands[p] and (1L shl c).inv(); gone = gone or (1L shl c)
                out(p)
                st = copy(s, hands = hands, place = place, gone = gone, turn = p, m = m, mover = p, pDiscard = s.pDiscard - 1)
            }
            else -> {
                // 12ボンバー: 言った数の札を全員が捨てる(出した人から順に、手札がなくなった人は上がり)
                val v = m - BOMB
                var mask = 0L
                for (su in 0 until 4) mask = mask or (1L shl cardOf(su, v))
                for (k in 0 until players) {
                    val q = (p + k) % players
                    if (place[q] >= 0) continue
                    gone = gone or (hands[q] and mask)
                    hands[q] = hands[q] and mask.inv()
                    out(q)
                }
                st = copy(s, hands = hands, place = place, gone = gone, turn = p, m = m, mover = p, pBomb = s.pBomb - 1)
            }
        }
        roundEnd(st, place, m, p)?.let { return it }
        return nextStep(st)
    }

    private fun nextActive(place: IntArray, from: Int): Int {
        var q = from
        repeat(players) { q = (q + 1) % players; if (place[q] < 0) return q }
        return from
    }

    private fun nextOpen(place: IntArray, passed: BooleanArray, from: Int): Int {
        var q = from
        repeat(players) { q = (q + 1) % players; if (place[q] < 0 && !passed[q]) return q }
        return nextActive(place, from)
    }

    private fun copy(
        s: DaifugoState, hands: LongArray = s.hands, field: Int = s.field, fieldOwner: Int = s.fieldOwner, passed: BooleanArray = s.passed,
        rev: Boolean = s.rev, lock: Int = s.lock, place: IntArray = s.place, phase: Int = s.phase, turn: Int, gone: Long = s.gone,
        m: Int, mover: Int, cleared: Boolean = false, jback: Boolean = s.jback, pGive: Int = s.pGive, pDiscard: Int = s.pDiscard,
        pBomb: Int = s.pBomb, pSkip: Int = s.pSkip, pClear: Boolean = s.pClear,
    ) = DaifugoState(players, s.seed, s.round, hands, field, fieldOwner, passed, rev, lock, place, s.prevPlace, s.points, phase, turn, gone, m, mover, s.lastPlaces, cleared, false,
        jback, pGive, pDiscard, pBomb, pSkip, pClear)

    override fun outcome(s: DaifugoState): Outcome? {
        if (!s.over) return null
        val top = s.points.max()
        val w = s.points.indices.filter { s.points[it] == top }
        return Outcome(if (w.size == 1) w[0] else -1, "${top}点")
    }

    override fun scores(s: DaifugoState): IntArray = s.points

    companion object {
        const val PASS = 0
        const val JOKER1 = 1
        const val GIVE2 = 10000
        const val GIVE1 = 20000
        const val JOKER = 52
        const val DIA3 = 2 * 13 + 1
        const val SEVEN = 30000
        const val TEN = 31000
        const val BOMB = 32000
        /** 強さ(3 = 0): 5 = 2、7 = 4、10 = 7、J = 8、Q = 9 */
        const val V5 = 2
        const val V7 = 4
        const val V10 = 7
        const val VJ = 8
        const val VQ = 9
        const val K_GROUP = 0
        const val K_STAIRS = 1

        /** 強さ(3 = 0 … 2 = 12) */
        fun v(c: Int): Int = (Cards.rank(c) - 3 + 13) % 13

        /** いまの向き(革命)での強さ。ジョーカーは 13 */
        fun power(c: Int, rev: Boolean): Int = if (c == JOKER) 13 else if (rev) 12 - v(c) else v(c)

        fun group(v: Int, joker: Boolean, mask: Int) = 100 + v * 64 + (if (joker) 16 else 0) + mask
        fun stair(suit: Int, low: Int, len: Int) = 2000 + suit * 200 + low * 14 + len

        fun cardOf(suit: Int, v: Int): Int = suit * 13 + (v + 1) % 13 // 強さ v の数は v+3。Cards の数の位置は (数-2)

        fun decode(m: Int): DfPlay {
            if (m == JOKER1) return DfPlay(K_GROUP, 1, 13, true, 0, 1L shl JOKER)
            if (m >= 2000) {
                val x = m - 2000
                val suit = x / 200; val low = (x % 200) / 14; val len = (x % 200) % 14
                var cards = 0L
                for (k in 0 until len) cards = cards or (1L shl cardOf(suit, low + k))
                return DfPlay(K_STAIRS, len, low, false, 1 shl suit, cards)
            }
            val x = m - 100
            val v = x / 64; val j = (x % 64) and 16 != 0; val mask = x % 16
            var cards = if (j) 1L shl JOKER else 0L
            for (s in 0 until 4) if (mask shr s and 1 == 1) cards = cards or (1L shl cardOf(s, v))
            return DfPlay(K_GROUP, mask.countOneBits() + (if (j) 1 else 0), v, j, mask, cards)
        }

        /** 手札から出せる形の一覧(場は考えない) */
        fun candidates(h: Long, stairs: Boolean): List<Int> {
            val out = ArrayList<Int>()
            val joker = (h shr JOKER) and 1L == 1L
            for (v in 0 until 13) {
                var have = 0
                for (s in 0 until 4) if ((h shr cardOf(s, v)) and 1L == 1L) have = have or (1 shl s)
                for (mask in 1 until 16) if (mask and have == mask) {
                    out.add(group(v, false, mask))
                    if (joker && mask.countOneBits() <= 3) out.add(group(v, true, mask))
                }
            }
            if (joker) out.add(JOKER1)
            if (stairs) for (s in 0 until 4) {
                for (low in 0 until 13) for (len in 3..13 - low) {
                    if ((0 until len).all { (h shr cardOf(s, low + it)) and 1L == 1L }) out.add(stair(s, low, len)) else break
                }
            }
            return out
        }

        fun beats(a: DfPlay, f: DfPlay, rev: Boolean, lock: Int): Boolean {
            if (a.kind != f.kind || a.n != f.n) return false
            if (f.isJokerSingle) return a.kind == K_GROUP && a.n == 1 && !a.joker && a.v == 0 && a.suitMask == 1 // ♠3 だけ
            if (a.isJokerSingle) return true
            if (lock != 0) {
                if (a.joker) { if (a.suitMask and lock != a.suitMask) return false } else if (a.suitMask != lock) return false
            }
            return if (rev) a.v < f.v else a.v > f.v
        }

        // ---------------- CPU ----------------

        /** 自分以外のだれかが、この手に勝てる札を持っている見込みがあるか(場に出た札と自分の札を除いた残りで数える) */
        fun beatable(play: DfPlay, unseen: Long, rev: Boolean): Boolean {
            val jokerOut = (unseen shr JOKER) and 1L == 1L
            if (play.isJokerSingle) return play.n == 1 && (unseen shr 1) and 1L == 1L // ♠3
            if (play.kind == K_STAIRS) {
                // 同じ長さの、より強い階段が残りの札で作れるか
                for (s in 0 until 4) for (low in 0..13 - play.n) {
                    if (if (rev) low >= play.v else low <= play.v) continue
                    if ((0 until play.n).all { (unseen shr cardOf(s, low + it)) and 1L == 1L }) return true
                }
                return false
            }
            if (play.n == 1 && jokerOut) return true
            for (v in 0 until 13) {
                if (if (rev) v >= play.v else v <= play.v) continue
                var cnt = 0
                for (s in 0 until 4) if ((unseen shr cardOf(s, v)) and 1L == 1L) cnt++
                if (cnt + (if (jokerOut) 1 else 0) >= play.n) return true
            }
            return false
        }

        /** 目安で選ぶ(初級・中級。上級の試し打ちの中でも使う) */
        fun heuristic(g: Daifugo, s: DaifugoState, seat: Int, level: Level, rng: Random): Int = run hr@{
            val legal = g.legalMoves(s)
            val h = s.hands[seat]
            val myCount = s.count(seat)
            if (s.phase == 0) {
                // 渡すのは一番弱い札(ジョーカー・2 は渡さない)
                val cards = (0..52).filter { (h shr it) and 1L == 1L }.sortedBy { power(it, false) }
                return@hr if (s.prevPlace[seat] == 0) GIVE2 + minOf(cards[0], cards[1]) * 64 + maxOf(cards[0], cards[1]) else GIVE1 + cards[0]
            }
            val unseen = ((1L shl 53) - 1) and h.inv() and s.gone.inv()
            if (s.phase == 2 || s.phase == 3) {
                // 渡す・捨てるのは一番弱い札(ジョーカーと2は残す)
                return@hr legal.minBy { val c = it - (if (s.phase == 2) SEVEN else TEN); power(c, false) }
            }
            if (s.phase == 4) {
                // 言う数: 自分が持っていなくて、まだ出ていない札が多い数(相手の手札を減らす)
                return@hr legal.maxBy { mv -> val v = mv - BOMB; var sc = 0; for (su in 0 until 4) { if ((unseen shr cardOf(su, v)) and 1L == 1L) sc += 2; if ((h shr cardOf(su, v)) and 1L == 1L) sc -= 3 }; sc * 20 + power(cardOf(0, v), false) }
            }
            val plays = legal.filter { it != PASS }
            if (plays.isEmpty()) return@hr PASS
            fun pw(p: DfPlay) = if (p.isJokerSingle) 13 else if (s.flipped) 12 - p.v else p.v
            fun held(v: Int): Int { var c = 0; for (x in 0 until 4) if ((h shr cardOf(x, v)) and 1L == 1L) c++; return c }
            val others = (0 until g.players).filter { it != seat && s.place[it] < 0 }
            val danger = others.any { s.count(it) <= 2 }
            if (level == Level.EASY) {
                // 初級(初心者の打ち方): 親の時は一番弱い1枚から出し、組や階段は考えない。
                // 出せる時はパスせず、場を取れるなら強い札もすぐ使う(ジョーカーは最後まで取っておく)
                return@hr plays.minBy { val p = decode(it); pw(p) * 10 + (if (p.joker) 200 else 0) + (if (s.field < 0) p.n * 100 else 0) }
            }
            val hard = level == Level.HARD
            // 上級: 残りが「だれにも勝てない手+1手」で上がれるなら、勝てない手から出す
            if (hard) {
                val controls = plays.filter { !beatable(decode(it), unseen, s.flipped) }
                for (c in controls) {
                    val rest = h and decode(c).cards.inv()
                    if (rest == 0L) return@hr c
                    val restC = candidates(rest, g.stairs)
                    if (restC.any { decode(it).cards == rest }) return@hr c
                }
                // 1手で上がれる
                plays.firstOrNull { decode(it).cards == h }?.let { return@hr it }
            }
            val avg = (0..52).filter { (h shr it) and 1L == 1L }.map { power(it, s.flipped) }.average()
            fun score(m: Int): Double {
                val p = decode(m)
                var sc = -pw(p).toDouble() + p.n * 0.9
                if (p.kind == K_GROUP && !p.joker && held(p.v) > p.n) sc -= 1.6 // 組を崩す
                if (p.joker) sc -= if (myCount <= 3) 0.0 else 5.0
                if (pw(p) >= 11 && myCount > 6) sc -= 2.5 // 強い札を早く使わない
                if (g.eightCut && p.hasEight && s.field >= 0) sc += 2.5 // 8切りで場を取り返す
                if (p.kind == K_GROUP && p.n == 4) sc += if (avg < 5.5) 7.0 else -7.0 // 革命は、弱い札が多い時だけ
                if (hard && s.field < 0 && !beatable(p, unseen, s.flipped) && myCount > 3) sc -= 3.0 // 勝てる札は最後まで取っておく
                return sc + rng.nextDouble() * 0.3
            }
            val best = plays.maxBy { score(it) }
            // 中級・上級: 場を取るのに一番強い札を使うしかない時は、相手の残りが多いならパスする
            if (s.field >= 0) {
                val p = decode(best)
                if (pw(p) >= 12 && myCount > 4 && !danger) return@hr PASS
                if (hard && p.joker && myCount > 3 && !danger) return@hr PASS
            }
            best
        }

        /**
         * 上級: 試し打ち。見えていない札(自分の手札と場に出た札以外)を、相手の残り枚数どおりに配り直して、
         * 候補の手ごとに、この回の終わりまで中級の打ち方で進め、自分の順位の平均がよい手を選ぶ。
         */
        private fun rollout(g: Daifugo, s: DaifugoState, seat: Int, rng: Random, budget: jp.yonekou.asobi26.core.Budget): Int {
            val legal = g.legalMoves(s)
            if (legal.size == 1) return legal[0]
            val h = s.hands[seat]
            val plays = legal.filter { it != PASS }
            // すぐ上がれる・だれにも勝てない手+1手で上がれるなら、それを打つ
            plays.firstOrNull { decode(it).cards == h }?.let { return it }
            val unseenMask = ((1L shl 53) - 1) and h.inv() and s.gone.inv()
            for (c in plays.filter { !beatable(decode(it), unseenMask, s.flipped) }) {
                val rest = h and decode(c).cards.inv()
                if (candidates(rest, g.stairs).any { decode(it).cards == rest }) return c
            }
            val unseen = (0..52).filter { (unseenMask shr it) and 1L == 1L }.toIntArray()
            val others = (0 until g.players).filter { it != seat && s.place[it] < 0 }
            val sum = DoubleArray(legal.size)
            var iter = 0
            while (iter < 60 && (iter < 4 || !budget.over())) {
                for (i in unseen.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val t = unseen[i]; unseen[i] = unseen[j]; unseen[j] = t }
                val hands = s.hands.copyOf()
                var pos = 0
                for (o in others) {
                    var hh = 0L
                    repeat(s.count(o)) { hh = hh or (1L shl unseen[pos++]) }
                    hands[o] = hh
                }
                val det = DaifugoState(s.players, s.seed, s.round, hands, s.field, s.fieldOwner, s.passed, s.rev, s.lock, s.place, s.prevPlace, s.points, s.phase, s.turn, s.gone, s.lastMove, s.lastMover, s.lastPlaces, s.cleared, s.over,
                    s.jback, s.pGive, s.pDiscard, s.pBomb, s.pSkip, s.pClear)
                for (k in legal.indices) {
                    var x = g.play(det, legal[k])
                    var steps = 0
                    while (!x.over && x.round == s.round && x.place[seat] < 0 && steps++ < 400) x = g.play(x, heuristic(g, x, x.turn, Level.NORMAL, rng))
                    val place = when {
                        x.round != s.round -> x.lastPlaces?.get(seat) ?: (g.players - 1)
                        x.place[seat] >= 0 -> x.place[seat]
                        else -> g.players - 1
                    }
                    sum[k] -= place
                }
                iter++
            }
            return legal[sum.indices.maxBy { sum[it] }]
        }

        val brain = Brain<DaifugoState> { rules, s, seat, level, rng, budget ->
            val g = rules as Daifugo
            if (level == Level.HARD && s.phase == 1) rollout(g, s, seat, rng, budget) else heuristic(g, s, seat, level, rng)
        }

        val def = GameDef(
            "daifugo",
            {
                Daifugo(
                    it.int("players", 4).coerceIn(3, 6),
                    if (it.int("rounds", 3) == 5) 5 else 3,
                    it.str("stairs", "on") == "on",
                    it.str("eight", "off") == "on",
                    it.str("lock", "off") == "on",
                    it.str("revolution", "on") == "on",
                    it.str("spade3", "off") == "on",
                    it.str("seven", "off") == "on",
                    it.str("jback", "off") == "on",
                    it.str("bomber", "off") == "on",
                    it.str("five", "off") == "on",
                    it.str("ten", "off") == "on",
                )
            },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 4).coerceIn(3, 6) },
        )
    }
}
