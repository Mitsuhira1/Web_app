package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.Brain
import jp.yonekou.asobi26.core.GameDef
import jp.yonekou.asobi26.core.Level
import jp.yonekou.asobi26.core.Outcome
import jp.yonekou.asobi26.core.Rules
import kotlin.random.Random

/** ブラックジャックの手札1つ(スプリットすると1人が2つ持つ) */
class BjHand(val cards: IntArray, val bet: Int, val done: Boolean, val doubled: Boolean = false, val splitAces: Boolean = false, val natural: Boolean = false) {
    val total: Int get() = Blackjack.total(cards)
    val bust: Boolean get() = total > 21
    fun add(c: Int) = BjHand(cards + c, bet, done, doubled, splitAces, natural)
    fun finish() = BjHand(cards, bet, true, doubled, splitAces, natural)
}

/** 1回分の結果(表示用) */
class BjResult(val dealer: IntArray, val hands: Array<List<BjHand>>, val delta: IntArray)

/**
 * ブラックジャック。1〜4人(あなた+CPU)とディーラー。10回勝負して、持ち点の多い人が勝ち(1人なら、最後の持ち点が結果)。
 * 1回: 賭ける(10・50・100) → 2枚ずつ配る(ディーラーは1枚を伏せる) → 順にヒット・スタンド・ダブル・スプリット → ディーラーが17以上まで引く → 精算。
 * 山は2組(104枚)で、毎回切り直す。ディーラーは17以上で止まる(Aを含む17も止まる)。ブラックジャック(最初の2枚で21)は1.5倍払い。
 * 手: 100 + 賭け額 / HIT / STAND / DOUBLE / SPLIT。CPU はディーラーの表の1枚と自分の札だけを見る。
 */
class BjState(
    val players: Int,
    val seed: Long,
    val round: Int,
    val chips: IntArray,
    /** 0 = 賭け、1 = 手番 */
    val phase: Int,
    val turn: Int,
    val hands: Array<List<BjHand>>,
    /** いま動かしている手札(スプリットした時の何番目か) */
    val hi: Int,
    val dealer: IntArray,
    val deckPos: Int,
    val result: BjResult?,
    val lastMove: Int,
    val lastMover: Int,
    val over: Boolean,
    /** 人ごとの成績 [勝ち, 負け, 引き分け, ブラックジャック](手札ごとに数える。結果の表示用) */
    val tally: Array<IntArray> = Array(players) { IntArray(4) },
)

class Blackjack(val players: Int, val potStyle: Boolean = false, val stake: Int = 50) : Rules<BjState> {
    override val playerCount = players
    val rounds = 10
    val startChips = 1000

    override fun initial(rng: Random): BjState = newRound(rng.nextLong(), 0, IntArray(players) { startChips }, null, -1, -1, Array(players) { IntArray(4) })

    private fun deck(seed: Long, round: Int): IntArray {
        val d = IntArray(104) { it % 52 }
        val r = Random(seed * 31 + round * 104_729L)
        for (i in d.size - 1 downTo 1) { val j = r.nextInt(i + 1); val t = d[i]; d[i] = d[j]; d[j] = t }
        return d
    }

    private fun newRound(seed: Long, round: Int, chips: IntArray, result: BjResult?, m: Int, mover: Int, tally: Array<IntArray>): BjState {
        val over = round >= rounds || if (potStyle) chips.count { it >= stake } < 2 else chips.all { it <= 0 }
        val first = (0 until players).firstOrNull { chips[it] >= if (potStyle) stake else 1 } ?: 0
        return BjState(players, seed, round, chips, 0, first, Array(players) { emptyList() }, 0, IntArray(0), 0, result, m, mover, over, tally)
    }

    override fun toMove(s: BjState) = if (s.over) -1 else s.turn

    override fun legalMoves(s: BjState): IntArray {
        if (s.over) return IntArray(0)
        val chips = s.chips[s.turn]
        if (s.phase == 0 && potStyle) return if (chips >= stake) intArrayOf(BET + stake) else IntArray(0)
        if (s.phase == 0) return listOf(10, 50, 100).filter { it == 10 || chips >= it }.map { BET + it }.toIntArray()
        val h = s.hands[s.turn][s.hi]
        val out = arrayListOf(HIT, STAND)
        if (!potStyle && h.cards.size == 2 && chips >= h.bet) {
            out.add(DOUBLE)
            if (s.hands[s.turn].size == 1 && Cards.rank(h.cards[0]) == Cards.rank(h.cards[1])) out.add(SPLIT)
        }
        return out.toIntArray()
    }

    override fun play(s: BjState, m: Int): BjState {
        val p = s.turn
        val chips = s.chips.copyOf()
        val hands = Array(players) { s.hands[it].toMutableList() }
        val deck = deck(s.seed, s.round)
        var pos = s.deckPos
        fun draw() = deck[pos++]
        if (s.phase == 0) {
            val amt = minOf(m - BET, chips[p])
            chips[p] -= amt
            hands[p] = mutableListOf(BjHand(IntArray(0), amt, false))
            val next = (p + 1 until players).firstOrNull { chips[it] >= if (potStyle) stake else 1 }
            if (next != null) return BjState(players, s.seed, s.round, chips, 0, next, frozen(hands), 0, IntArray(0), 0, s.result, m, p, false, s.tally)
            // 全員が賭けたら配る(1人に1枚ずつ、ディーラーにも1枚。これを2周)
            var dealer = IntArray(0)
            repeat(2) {
                for (q in 0 until players) if (hands[q].isNotEmpty()) hands[q][0] = hands[q][0].add(draw())
                if (!potStyle) dealer += draw()
            }
            val dealerBj = total(dealer) == 21
            for (q in 0 until players) if (hands[q].isNotEmpty() && hands[q][0].total == 21) {
                val h = hands[q][0]
                hands[q][0] = BjHand(h.cards, h.bet, true, natural = true)
            }
            if (dealerBj && players == 1 && !potStyle) return settle(s, chips, hands, dealer, pos, m, p)
            return advance(s, chips, hands, dealer, pos, -1, 0, m, p)
        }
        val h = hands[p][s.hi]
        var dealer = s.dealer
        when (m) {
            HIT -> {
                val n = h.add(draw())
                hands[p][s.hi] = if (n.total >= 21) n.finish() else n
            }
            STAND -> hands[p][s.hi] = h.finish()
            DOUBLE -> {
                chips[p] -= h.bet
                hands[p][s.hi] = BjHand(h.cards + draw(), h.bet * 2, true, doubled = true)
            }
            SPLIT -> {
                chips[p] -= h.bet
                val aces = Cards.rank(h.cards[0]) == 14
                val a = BjHand(intArrayOf(h.cards[0], draw()), h.bet, aces, splitAces = aces)
                val b = BjHand(intArrayOf(h.cards[1], draw()), h.bet, aces, splitAces = aces)
                hands[p] = mutableListOf(if (a.total == 21) a.finish() else a, if (b.total == 21) b.finish() else b)
            }
        }
        return advance(s, chips, hands, dealer, pos, p, s.hi, m, p)
    }

    /** 次に動かす手札へ。全員が済んだら、ディーラーが引いて精算する */
    private fun advance(s: BjState, chips: IntArray, hands: Array<MutableList<BjHand>>, dealer: IntArray, pos: Int, fromP: Int, fromHi: Int, m: Int, mover: Int): BjState {
        val start = if (fromP < 0) 0 else fromP
        for (q in start until players) {
            val from = if (q == fromP) fromHi else 0
            for (k in from until hands[q].size) if (!hands[q][k].done) {
                return BjState(players, s.seed, s.round, chips, 1, q, frozen(hands), k, dealer, pos, s.result, m, mover, false, s.tally)
            }
        }
        return settle(s, chips, hands, dealer, pos, m, mover)
    }

    private fun settle(s: BjState, chips: IntArray, hands: Array<MutableList<BjHand>>, dealer0: IntArray, pos0: Int, m: Int, mover: Int): BjState {
        if (potStyle) {
            val bets = IntArray(players) { q -> hands[q].sumOf { it.bet } }
            val totals = IntArray(players) { q -> hands[q].filter { !it.bust }.maxOfOrNull { it.total } ?: -1 }
            val best = totals.max()
            val winners = if (best < 0) emptyList() else totals.indices.filter { totals[it] == best }
            val backs = IntArray(players)
            if (winners.isEmpty()) for (q in 0 until players) backs[q] = bets[q]
            else {
                val pot = bets.sum()
                val ordered = winners.sortedBy { (it - s.round % players + players) % players }
                for ((i, q) in ordered.withIndex()) backs[q] = pot / winners.size + if (i < pot % winners.size) 1 else 0
            }
            val delta = IntArray(players) { backs[it] - bets[it] }
            val tally = Array(players) { s.tally[it].copyOf() }
            for (q in 0 until players) if (bets[q] > 0) {
                chips[q] += backs[q]
                tally[q][if (delta[q] > 0) 0 else if (delta[q] < 0) 1 else 2]++
                if (hands[q].any { it.natural }) tally[q][3]++
            }
            return newRound(s.seed, s.round + 1, chips, BjResult(IntArray(0), frozen(hands), delta), m, mover, tally)
        }
        val deck = deck(s.seed, s.round)
        var pos = pos0
        var dealer = dealer0
        val dealerBj = dealer.size == 2 && total(dealer) == 21
        // 生きている手札(バストしていない・ブラックジャックで精算済みでない)が残っている時だけ、ディーラーが引く
        val anyLive = hands.any { l -> l.any { !it.bust && !it.natural } }
        if (!dealerBj && anyLive) while (total(dealer) < 17) dealer += deck[pos++]
        val d = total(dealer)
        val delta = IntArray(players)
        val tally = Array(players) { s.tally[it].copyOf() }
        for (q in 0 until players) for (h in hands[q]) {
            val back = when {
                h.natural && dealerBj -> h.bet
                h.natural -> h.bet + h.bet * 3 / 2
                dealerBj -> 0
                h.bust -> 0
                d > 21 || h.total > d -> h.bet * 2
                h.total == d -> h.bet
                else -> 0
            }
            chips[q] += back
            delta[q] += back - h.bet
            tally[q][if (back > h.bet) 0 else if (back == h.bet) 2 else 1]++
            if (h.natural) tally[q][3]++
        }
        val result = BjResult(dealer, frozen(hands), delta)
        return newRound(s.seed, s.round + 1, chips, result, m, mover, tally)
    }

    private fun frozen(h: Array<MutableList<BjHand>>): Array<List<BjHand>> = Array(players) { h[it].toList() }

    override fun outcome(s: BjState): Outcome? {
        if (!s.over) return null
        if (players == 1) {
            // ひとり: 最初の持ち点より増えたら勝ち、減ったら負け
            val d = s.chips[0] - startChips
            return Outcome(if (d > 0) 0 else if (d == 0) -1 else 1, "持ち点 ${s.chips[0]}(" + (if (d > 0) "+$d" else "$d") + ")")
        }
        val top = s.chips.max()
        val w = s.chips.indices.filter { s.chips[it] == top }
        return Outcome(if (w.size == 1) w[0] else -1, "持ち点 $top")
    }

    override fun scores(s: BjState): IntArray = s.chips

    companion object {
        const val HIT = 1
        const val STAND = 2
        const val DOUBLE = 3
        const val SPLIT = 4
        const val BET = 100

        /** 札の点(2〜10はそのまま、絵札は10、Aは11か1) */
        fun cardValue(c: Int): Int = when (val r = Cards.rank(c)) { 14 -> 11; 11, 12, 13 -> 10; else -> r }

        fun total(cards: IntArray): Int {
            var t = 0; var aces = 0
            for (c in cards) { t += cardValue(c); if (Cards.rank(c) == 14) aces++ }
            while (t > 21 && aces > 0) { t -= 10; aces-- }
            return t
        }

        /** Aを11と数えている(柔らかい)手か */
        fun soft(cards: IntArray): Boolean {
            var t = 0; var aces = 0
            for (c in cards) { t += cardValue(c); if (Cards.rank(c) == 14) aces++ }
            while (t > 21 && aces > 0) { t -= 10; aces-- }
            return aces > 0
        }

        /** 基本戦略(ディーラーは17で止まる・スプリット後のダブルあり) */
        fun basic(cards: IntArray, up: Int, canDouble: Boolean, canSplit: Boolean): Int {
            val u = cardValue(up) // 2〜11
            if (canSplit) {
                val v = cardValue(cards[0])
                val split = when (v) {
                    11, 8 -> true
                    9 -> u in 2..9 && u != 7
                    7 -> u in 2..7
                    6 -> u in 2..6
                    4 -> u in 5..6
                    2, 3 -> u in 2..7
                    else -> false
                }
                if (split) return SPLIT
            }
            val t = total(cards)
            if (soft(cards) && t <= 21) {
                return when {
                    t >= 19 -> STAND
                    t == 18 -> if (u in 3..6 && canDouble) DOUBLE else if (u >= 9) HIT else STAND
                    t == 17 -> if (u in 3..6 && canDouble) DOUBLE else HIT
                    t in 15..16 -> if (u in 4..6 && canDouble) DOUBLE else HIT
                    else -> if (u in 5..6 && canDouble) DOUBLE else HIT
                }
            }
            return when {
                t >= 17 -> STAND
                t in 13..16 -> if (u in 2..6) STAND else HIT
                t == 12 -> if (u in 4..6) STAND else HIT
                t == 11 -> if (canDouble) DOUBLE else HIT
                t == 10 -> if (u in 2..9 && canDouble) DOUBLE else HIT
                t == 9 -> if (u in 3..6 && canDouble) DOUBLE else HIT
                else -> HIT
            }
        }

        val brain = Brain<BjState> { rules, s, seat, level, rng, _ ->
            val legal = rules.legalMoves(s)
            if (s.phase == 0) {
                val want = if ((rules as Blackjack).potStyle) rules.stake else when (level) { Level.EASY -> if (rng.nextBoolean()) 10 else 50; else -> 50 }
                return@Brain if (BET + want in legal) BET + want else BET + 10
            }
            val h = s.hands[seat][s.hi]
            if ((rules as Blackjack).potStyle) {
                // 総取りの札は画面で全員に公開されている。上級は確定した相手の点も見る。
                val bestShown = s.hands.indices.filter { it != seat }.flatMap { s.hands[it] }.filter { it.done && !it.bust }.maxOfOrNull { it.total } ?: 0
                val target = when (level) { Level.EASY -> 16; Level.NORMAL -> 18; Level.HARD -> maxOf(17, bestShown) }
                return@Brain if (h.total >= target) STAND else HIT
            }
            val up = s.dealer[0] // 伏せた札(dealer[1])は見ない
            val canD = DOUBLE in legal
            val canS = SPLIT in legal
            val t = h.total
            val u = cardValue(up)
            when (level) {
                // 初級: ディーラーの札は見ず、15以上で止まる
                Level.EASY -> if (t >= 15) STAND else HIT
                // 中級: よく知られた目安だけ(17以上で止まる・相手が弱い札なら13以上で止まる・11はダブル・A と 8 は分ける)
                Level.NORMAL -> when {
                    canS && (Cards.rank(h.cards[0]) == 14 || Cards.rank(h.cards[0]) == 8) -> SPLIT
                    canD && t == 11 && !soft(h.cards) -> DOUBLE
                    soft(h.cards) -> if (t >= 18) STAND else HIT
                    t >= 17 -> STAND
                    t >= 13 && u <= 6 -> STAND
                    else -> HIT
                }
                // 上級: 基本戦略で打つが、上手な人もよく外す細かい所(Aを含む手のダブル・9や2・3を分ける・12対2〜3)は、素直な手にする
                Level.HARD -> {
                    val b = basic(h.cards, up, canD, canS)
                    val v0 = cardValue(h.cards[0])
                    when {
                        b == DOUBLE && soft(h.cards) -> if (t >= 18) STAND else HIT
                        b == SPLIT && v0 in listOf(2, 3, 4, 6, 9) -> basic(h.cards, up, canD, false)
                        b == STAND && t == 12 -> HIT
                        else -> b
                    }
                }
            }
        }

        val def = GameDef(
            "blackjack",
            { Blackjack(it.int("players", 1).coerceIn(if (it.str("bjStyle", "dealer") == "pot") 2 else 1, 4), it.str("bjStyle", "dealer") == "pot", it.int("stake", 50).takeIf { v -> v in listOf(10, 50, 100) } ?: 50) },
            brain,
            undoAllowed = false,
            seatsFor = { it.int("players", 1).coerceIn(if (it.str("bjStyle", "dealer") == "pot") 2 else 1, 4) },
        )
    }
}
