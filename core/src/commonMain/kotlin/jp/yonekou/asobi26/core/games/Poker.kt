package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/**
 * トランプの札。0〜51 = マーク(0♠ 1♥ 2♦ 3♣)*13 + 数(0 = 2 … 12 = A)。表示の数は rankLabel。
 * カードゲーム全体で使う。
 */
object Cards {
    fun suit(c: Int) = c / 13
    /** 2〜14(14 = A) */
    fun rank(c: Int) = c % 13 + 2
    fun rankLabel(c: Int): String = when (val r = rank(c)) { 11 -> "J"; 12 -> "Q"; 13 -> "K"; 14 -> "A"; else -> r.toString() }
    val SUITS = listOf("♠", "♥", "♦", "♣")
    fun isRed(c: Int) = suit(c) == 1 || suit(c) == 2

    /** 種から山札を作る(同じ種なら同じ並び) */
    fun deck(seed: Long): IntArray {
        val d = IntArray(52) { it }
        val r = Random(seed)
        for (i in 51 downTo 1) { val j = r.nextInt(i + 1); val t = d[i]; d[i] = d[j]; d[j] = t }
        return d
    }

    /**
     * 5枚の役の強さ(大きいほど強い)。上の桁が役(0 ブタ 1 ワンペア 2 ツーペア 3 スリーカード 4 ストレート 5 フラッシュ
     * 6 フルハウス 7 フォーカード 8 ストレートフラッシュ)、下の桁が比べる順の数。
     */
    fun handValue(cards: IntArray): Int {
        val ranks = cards.map { rank(it) }.sortedDescending()
        val counts = ranks.groupingBy { it }.eachCount()
        val flush = cards.map { suit(it) }.toSet().size == 1
        val uniq = ranks.distinct()
        var straightHigh = -1
        if (uniq.size == 5) {
            if (uniq[0] - uniq[4] == 4) straightHigh = uniq[0]
            if (uniq == listOf(14, 5, 4, 3, 2)) straightHigh = 5 // A-2-3-4-5
        }
        // 比べる順: 枚数の多い順、同じなら数の大きい順
        val order = counts.entries.sortedWith(compareBy<Map.Entry<Int, Int>>({ -it.value }, { -it.key })).map { it.key }
        val pattern = counts.values.sortedDescending()
        val cat = when {
            straightHigh > 0 && flush -> 8
            pattern[0] == 4 -> 7
            pattern[0] == 3 && pattern[1] == 2 -> 6
            flush -> 5
            straightHigh > 0 -> 4
            pattern[0] == 3 -> 3
            pattern[0] == 2 && pattern[1] == 2 -> 2
            pattern[0] == 2 -> 1
            else -> 0
        }
        val keys = if (straightHigh > 0) listOf(straightHigh) else order
        var v = cat
        for (k in 0 until 5) v = v * 15 + (keys.getOrNull(k) ?: 0)
        return v
    }

    val HAND_NAMES = listOf("ブタ(役なし)", "ワンペア", "ツーペア", "スリーカード", "ストレート", "フラッシュ", "フルハウス", "フォーカード", "ストレートフラッシュ")
    fun handCategory(v: Int): Int { var x = v; repeat(5) { x /= 15 }; return x }
    fun handName(cards: IntArray): String {
        val v = handValue(cards)
        val cat = handCategory(v)
        if (cat == 8 && cards.map { rank(it) }.toSet() == setOf(10, 11, 12, 13, 14)) return "ロイヤルストレートフラッシュ"
        return HAND_NAMES[cat]
    }
}

/**
 * ポーカー(5枚の交換。ファイブカードドロー)。2〜6人。
 * 1ゲーム: 参加料 → 1回目の賭け → 交換(0〜5枚) → 2回目の賭け → 勝負。賭けは決まった額(1回目20・2回目40)、上乗せは3回まで。
 * 10ゲームか、1人を除いて持ち点がなくなったら終わり。持ち点の多い人の勝ち。
 * 手: FOLD(降りる)/CALL(チェック・コール)/RAISE(ベット・レイズ)/ 100+交換する札(5ビット)。
 */
class PokerState(
    val players: Int,
    val seed: Long,
    val handNo: Int,
    val dealer: Int,
    val chips: IntArray,
    val hands: Array<IntArray>,
    val deckPos: Int,
    /** 0 = 1回目の賭け、1 = 交換、2 = 2回目の賭け */
    val phase: Int,
    val turn: Int,
    val folded: BooleanArray,
    /** この賭けの回で、各自が場に出した額 */
    val bets: IntArray,
    val pot: Int,
    val raises: Int,
    /** この賭けの回で、最後に上乗せした後に順番が回った人(全員が応じたら次へ) */
    val acted: BooleanArray,
    /** 交換が済んだ人 */
    val drew: BooleanArray,
    /** 各自が交換した枚数(-1 = まだ) */
    val drawCount: IntArray,
    /** 各自の直前の行動(表示用) */
    val lastAction: Array<String>,
    val lastMove: Int,
    val lastMover: Int,
    /** 直前のゲームの勝負の結果(表示用。前のゲームの手札と勝った人) */
    val result: PokerResult?,
    val over: Boolean,
    val winner: Int,
)

class PokerResult(val hands: Array<IntArray>, val folded: BooleanArray, val winners: List<Int>, val pot: Int, val text: String)

class Poker(val players: Int) : Rules<PokerState> {
    override val playerCount = players
    val ante = 10
    val maxHands = 10
    val startChips = 1000

    private fun betSize(phase: Int) = if (phase == 0) 20 else 40

    // 最初の親は最後の席(親の次の人から行動するので、先手=席0から始まる)
    override fun initial(rng: Random): PokerState = deal(rng.nextLong(), 0, players - 1, IntArray(players) { startChips }, null)

    /** 新しいゲームを配る(参加料を集める) */
    private fun deal(seed: Long, handNo: Int, dealer: Int, chips0: IntArray, result: PokerResult?): PokerState {
        val deck = Cards.deck(seed * 1_000_003 + handNo * 7919L)
        val chips = chips0.copyOf()
        val folded = BooleanArray(players) { chips[it] <= 0 }
        var pot = 0
        for (p in 0 until players) if (!folded[p]) { val a = minOf(ante, chips[p]); chips[p] -= a; pot += a }
        val hands = Array(players) { p -> IntArray(5) { k -> deck[k * players + p] } }
        val first = nextActive(folded, dealer)
        return PokerState(players, seed, handNo, dealer, chips, hands, 5 * players, 0, first, folded, IntArray(players), pot, 0,
            BooleanArray(players), BooleanArray(players), IntArray(players) { -1 }, Array(players) { "" }, -1, -1, result, false, -1)
    }

    private fun nextActive(folded: BooleanArray, from: Int): Int {
        var p = from
        repeat(players) { p = (p + 1) % players; if (!folded[p]) return p }
        return from
    }

    override fun toMove(s: PokerState): Int = if (s.over) -1 else s.turn

    override fun legalMoves(s: PokerState): IntArray {
        if (s.over) return IntArray(0)
        if (s.phase == 1) return IntArray(32) { 100 + it }
        val toCall = s.bets.max() - s.bets[s.turn]
        val out = ArrayList<Int>()
        if (toCall > 0) out.add(FOLD)
        out.add(CALL)
        if (s.raises < 3 && s.chips[s.turn] > toCall) out.add(RAISE)
        return out.toIntArray()
    }

    override fun play(s: PokerState, m: Int): PokerState {
        val p = s.turn
        val chips = s.chips.copyOf()
        val folded = s.folded.copyOf()
        val bets = s.bets.copyOf()
        val acted = s.acted.copyOf()
        val last = s.lastAction.copyOf()
        var pot = s.pot
        var raises = s.raises
        val hands = Array(players) { s.hands[it].copyOf() }
        var deckPos = s.deckPos
        val drew = s.drew.copyOf()
        val drawCount = s.drawCount.copyOf()

        if (s.phase == 1) {
            // 交換: 選んだ札を山の続きと入れ替える
            val deck = Cards.deck(s.seed * 1_000_003 + s.handNo * 7919L)
            val discarding = hands[p].copyOf()
            var n = 0
            for (k in 0 until 5) if ((m - 100) shr k and 1 == 1) {
                hands[p][k] = replacement(deck, deckPos, hands, discarding, Random(s.seed xor (s.handNo * 7919L + deckPos)))
                deckPos++
                n++
            }
            drew[p] = true
            drawCount[p] = n
            last[p] = if (n == 0) "交換なし" else "${n}枚交換"
            val next = (1..players).map { (p + it) % players }.firstOrNull { !folded[it] && !drew[it] }
            if (next != null) return copy(s, hands = hands, deckPos = deckPos, drew = drew, drawCount = drawCount, last = last, turn = next, m = m, mover = p)
            // 全員交換したら、2回目の賭けへ
            return copy(s, hands = hands, deckPos = deckPos, drew = drew, drawCount = drawCount, last = last, phase = 2,
                turn = nextActive(folded, s.dealer), bets = IntArray(players), raises = 0, acted = BooleanArray(players), m = m, mover = p)
        }

        val toCall = bets.max() - bets[p]
        when (m) {
            FOLD -> { folded[p] = true; last[p] = "降りた" }
            CALL -> {
                val pay = minOf(toCall, chips[p])
                chips[p] -= pay; bets[p] += pay; pot += pay
                last[p] = if (toCall == 0) "チェック" else "コール"
            }
            RAISE -> {
                val pay = minOf(toCall + betSize(s.phase), chips[p])
                chips[p] -= pay; bets[p] += pay; pot += pay
                last[p] = if (bets.max() == pay && toCall == 0) "ベット ${pay}" else "レイズ"
                raises++
                for (q in 0 until players) acted[q] = false
            }
        }
        acted[p] = true
        val alive = (0 until players).filter { !folded[it] }
        if (alive.size == 1) return endHand(s, hands, chips, folded, pot, alive, last, m, p)
        val top = bets.max()
        // 降りていない全員が行動し、額がそろったら(持ち点がない人は除く)この回は終わり
        // 持ち点を出し切った人(オールイン)は、もう行動しない
        val next = (1..players).map { (p + it) % players }.firstOrNull { !folded[it] && chips[it] > 0 && !(acted[it] && bets[it] == top) }
        if (next != null) {
            return copy(s, chips = chips, folded = folded, bets = bets, pot = pot, raises = raises, acted = acted, last = last, turn = next, m = m, mover = p)
        }
        if (s.phase == 0) {
            return copy(s, chips = chips, folded = folded, bets = bets, pot = pot, raises = raises, acted = acted, last = last,
                phase = 1, turn = nextActive(folded, s.dealer), m = m, mover = p)
        }
        // 2回目の賭けが終わったら勝負
        val best = alive.maxOf { Cards.handValue(hands[it]) }
        val winners = alive.filter { Cards.handValue(hands[it]) == best }
        return endHand(s, hands, chips, folded, pot, winners, last, m, p)
    }

    private fun endHand(s: PokerState, hands: Array<IntArray>, chips: IntArray, folded: BooleanArray, pot: Int, winners: List<Int>, last: Array<String>, m: Int, mover: Int): PokerState {
        val share = pot / winners.size
        for (w in winners) chips[w] += share
        chips[winners.first()] += pot - share * winners.size
        val text = if ((0 until players).count { !folded[it] } == 1) "ほかの人が降りた" else Cards.handName(hands[winners.first()])
        val result = PokerResult(Array(players) { hands[it].copyOf() }, folded.copyOf(), winners, pot, text)
        val handNo = s.handNo + 1
        val alive = (0 until players).count { chips[it] > 0 }
        if (handNo >= maxHands || alive <= 1) {
            val top = chips.max()
            val w = if (chips.count { it == top } == 1) chips.indexOfFirst { it == top } else -1
            return PokerState(players, s.seed, handNo, s.dealer, chips, hands, s.deckPos, 2, s.turn, folded, IntArray(players), 0, 0,
                BooleanArray(players), s.drew, s.drawCount, last, m, mover, result, true, w)
        }
        val next = deal(s.seed, handNo, nextActive(BooleanArray(players) { chips[it] <= 0 }, s.dealer), chips, result)
        return PokerState(next.players, next.seed, next.handNo, next.dealer, next.chips, next.hands, next.deckPos, next.phase, next.turn, next.folded,
            next.bets, next.pot, next.raises, next.acted, next.drew, next.drawCount, next.lastAction, m, mover, result, false, -1)
    }

    private fun copy(
        s: PokerState, chips: IntArray = s.chips, hands: Array<IntArray> = s.hands, deckPos: Int = s.deckPos, phase: Int = s.phase, turn: Int = s.turn,
        folded: BooleanArray = s.folded, bets: IntArray = s.bets, pot: Int = s.pot, raises: Int = s.raises, acted: BooleanArray = s.acted,
        drew: BooleanArray = s.drew, drawCount: IntArray = s.drawCount, last: Array<String> = s.lastAction, m: Int, mover: Int,
    ) = PokerState(players, s.seed, s.handNo, s.dealer, chips, hands, deckPos, phase, turn, folded, bets, pot, raises, acted, drew, drawCount, last, m, mover, null, false, -1)

    override fun outcome(s: PokerState): Outcome? = if (s.over) Outcome(s.winner, "") else null

    override fun scores(s: PokerState): IntArray = s.chips

    companion object {
        const val FOLD = 0
        const val CALL = 1
        const val RAISE = 2

        /** 交換する札: 役に関わる札を残し、それ以外を替える(4枚のフラッシュ・ストレートは1枚だけ替える) */
        fun drawMask(hand: IntArray): Int {
            val ranks = hand.map { Cards.rank(it) }
            val counts = ranks.groupingBy { it }.eachCount()
            val cat = Cards.handCategory(Cards.handValue(hand))
            if (cat >= 4) return 0
            if (cat >= 1) {
                var mask = 0
                for (k in 0 until 5) if (counts[ranks[k]]!! < 2) mask = mask or (1 shl k)
                return mask
            }
            // 4枚のフラッシュ
            val bySuit = hand.indices.groupBy { Cards.suit(hand[it]) }
            bySuit.values.firstOrNull { it.size == 4 }?.let { keep -> return (0 until 5).filter { it !in keep }.fold(0) { a, k -> a or (1 shl k) } }
            // 4枚続き(片側が開いた形)
            val sorted = hand.indices.sortedBy { ranks[it] }
            for (skip in 0 until 5) {
                val rest = sorted.filter { it != sorted[skip] }.map { ranks[it] }
                if (rest.zipWithNext().all { (a, b) -> b - a == 1 }) return 1 shl sorted[skip]
            }
            // 役なし: A と K だけ残す
            var mask = 0
            for (k in 0 until 5) if (ranks[k] < 13) mask = mask or (1 shl k)
            return mask
        }

        /** 山が尽きたら、だれも持っていない捨て札を再利用する。今の交換で自分が捨てる札は除く。 */
        private fun replacement(deck: IntArray, pos: Int, hands: Array<IntArray>, discarding: IntArray, rng: Random): Int {
            if (pos < deck.size) return deck[pos]
            val available = deck.filter { card -> card !in discarding && hands.none { card in it } }
            return available[rng.nextInt(available.size)]
        }

        /** 自分の札だけから、相手 opp 人に勝つ割合を試し配りで見積もる(相手の札は知らない) */
        fun equity(hand: IntArray, opp: Int, rng: Random, trials: Int, afterDraw: Boolean): Double {
            val known = hand.toSet()
            val rest = (0 until 52).filter { it !in known }.toIntArray()
            var win = 0.0
            val mine = if (afterDraw) Cards.handValue(hand) else 0
            repeat(trials) {
                for (i in rest.size - 1 downTo 1) { val j = rng.nextInt(i + 1); val t = rest[i]; rest[i] = rest[j]; rest[j] = t }
                var pos = 0
                // 全員へ先に配ってから交換する。6人でも交換用の山札を越えて読まない。
                val hands = Array(opp + 1) { p -> if (p == 0) hand.copyOf() else IntArray(5) { rest[pos++] } }
                if (!afterDraw) for (h in hands) {
                    val discarding = h.copyOf()
                    val mask = drawMask(h)
                    for (k in 0 until 5) if (mask shr k and 1 == 1) h[k] = replacement(rest, pos++, hands, discarding, rng)
                }
                val my = if (afterDraw) mine else Cards.handValue(hands[0])
                var best = 0
                for (p in 1..opp) best = maxOf(best, Cards.handValue(hands[p]))
                win += if (my > best) 1.0 else if (my == best) 0.5 else 0.0
            }
            return win / trials
        }

        val brain = Brain<PokerState> { rules, s, seat, level, rng, _ ->
            val g = rules as Poker
            val hand = s.hands[seat] // 自分の札だけを見る
            if (s.phase == 1) {
                val mask = drawMask(hand)
                return@Brain 100 + if (level == Level.EASY && rng.nextDouble() < 0.3) (mask or (1 shl rng.nextInt(5))) else mask
            }
            val legal = g.legalMoves(s)
            val toCall = s.bets.max() - s.bets[seat]
            val opp = (0 until g.players).count { it != seat && !s.folded[it] }.coerceAtLeast(1)
            val eq = when (level) {
                Level.EASY -> (Cards.handCategory(Cards.handValue(hand)) * 0.18 + 0.15).coerceAtMost(0.95)
                Level.NORMAL -> equity(hand, opp, rng, 120, s.phase == 2)
                Level.HARD -> equity(hand, opp, rng, 500, s.phase == 2)
            }
            val potOdds = if (toCall == 0) 0.0 else toCall.toDouble() / (s.pot + toCall)
            val fair = 1.0 / (opp + 1)
            val bluff = when (level) { Level.EASY -> 0.03; Level.NORMAL -> 0.06; Level.HARD -> 0.08 }
            if (level == Level.EASY) {
                // 初級: 場の額は気にせず、役の有無だけで決める(ペア以上は付いていく。スリーカード以上で上乗せ)
                val cat = Cards.handCategory(Cards.handValue(hand))
                return@Brain when {
                    Poker.RAISE in legal && (cat >= 3 || rng.nextDouble() < bluff) -> Poker.RAISE
                    toCall == 0 || cat >= 1 -> Poker.CALL
                    else -> Poker.FOLD
                }
            }
            // 上乗せ: 勝つ見込みが十分高い時(人数が多いほど高い見込みが要る)。ときどきブラフ
            val raiseAt = if (opp == 1) 0.55 else maxOf(0.6, fair * 1.5)
            // コール: 場のチップに対して割に合うか(相手が1人なら、少し広く付いていく)
            val callAt = potOdds * (if (opp == 1) 0.8 else 0.95)
            when {
                Poker.RAISE in legal && (eq > raiseAt || rng.nextDouble() < bluff) -> Poker.RAISE
                toCall == 0 -> Poker.CALL
                eq >= callAt -> Poker.CALL
                else -> Poker.FOLD
            }
        }

        val def = GameDef(
            "poker",
            { Poker(it.int("players", 4).coerceIn(2, 6)) },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 4).coerceIn(2, 6) },
        )
    }
}
