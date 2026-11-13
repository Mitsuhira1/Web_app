package jp.yonekou.asobi26.core

import jp.yonekou.asobi26.core.games.Blackjack
import jp.yonekou.asobi26.core.games.BjState
import jp.yonekou.asobi26.core.games.Cards
import jp.yonekou.asobi26.core.games.Daifugo
import jp.yonekou.asobi26.core.games.DaifugoState
import jp.yonekou.asobi26.core.games.Reversi
import jp.yonekou.asobi26.core.games.Sevens
import jp.yonekou.asobi26.core.games.SevensState
import kotlin.random.Random

/**
 * 確認用(0.4.10 だけ。確かめてもらったら次の版で消す)。
 * 起きにくい場面(革命・リバーシのパスなど)を、配りの種と手順を探して作り、対局の記録として返す。
 * あなたは席0、ほかは CPU(中級)。
 */
object DebugScenarios {
    class Item(val id: String, val label: String)

    val items = listOf(
        Item("reversi_pass", "リバーシ: あなたがパスになる"),
        Item("daifugo_rev", "大富豪: 革命できる手札で親"),
        Item("daifugo_eight", "大富豪: 8を持って親"),
        Item("daifugo_spade3", "大富豪: ジョーカー1枚に ♠3 で返せる"),
        Item("daifugo_exchange", "大富豪: 2回目の交換(あなたが大富豪)"),
        Item("sevens_out", "7ならべ: パスを3回使った後"),
        Item("bj_split", "ブラックジャック: スプリットできる"),
        Item("bj_natural", "ブラックジャック: ブラックジャックが来る"),
    )

    private fun seats(n: Int) = List(n) { Seat(it == 0, Level.NORMAL, if (it == 0) "あなた" else "CPU") }

    /** 見つからなければ null */
    fun build(id: String): MatchRecord? = when (id) {
        "reversi_pass" -> reversiPass()
        "daifugo_rev" -> daifugoLead { s -> (0 until 13).any { v -> (0 until 4).all { su -> s.has(0, Daifugo.cardOf(su, v)) } } }
        "daifugo_eight" -> daifugoLead { s -> (0 until 4).any { su -> s.has(0, Daifugo.cardOf(su, 5)) } }
        "daifugo_spade3" -> daifugoPlay { s -> s.phase == 1 && s.turn == 0 && s.field == Daifugo.JOKER1 && s.has(0, 1) }
        "daifugo_exchange" -> daifugoPlay { s -> s.round == 1 && s.phase == 0 && s.turn == 0 }
        "sevens_out" -> sevensOut()
        "bj_split" -> blackjack { s -> s.phase == 1 && s.hands[0].size == 1 && s.hands[0][0].cards.let { it.size == 2 && Cards.rank(it[0]) == Cards.rank(it[1]) } }
        "bj_natural" -> blackjack { s -> s.result?.hands?.get(0)?.firstOrNull()?.natural == true && s.round == 1 }
        else -> null
    }

    private fun reversiPass(): MatchRecord? {
        val def = Reversi.def
        for (seed in 1L..400L) {
            val rng = Random(seed)
            val ses = Session(def, GameOptions(), seats(2), seed)
            var guard = 0
            while (ses.outcome == null && guard++ < 120) {
                val legal = ses.rules.legalMoves(ses.state)
                if (ses.toMove == 0 && legal.size == 1 && legal[0] == Reversi.PASS) return ses.record()
                ses.submit(legal[rng.nextInt(legal.size)])
            }
        }
        return null
    }

    /** 1回目の最初(あなたが ♦3 を持って親)で、手札が cond を満たす配り */
    private fun daifugoLead(cond: (DaifugoState) -> Boolean): MatchRecord? {
        val def = Daifugo.def
        for (seed in 1L..20000L) {
            val ses = Session(def, GameOptions(), seats(4), seed)
            val s = ses.state
            if (s.turn == 0 && cond(s)) return ses.record()
        }
        return null
    }

    /** 全員を中級の CPU として進め、cond の場面であなたの番になった所で止める */
    private fun daifugoPlay(cond: (DaifugoState) -> Boolean): MatchRecord? {
        val def = Daifugo.def
        for (seed in 1L..600L) {
            val rng = Random(seed)
            val ses = Session(def, GameOptions(), seats(4), seed)
            var guard = 0
            while (ses.outcome == null && guard++ < 1500) {
                if (cond(ses.state)) return ses.record()
                if (ses.state.round >= 2) break
                ses.submit(Daifugo.heuristic(ses.rules as Daifugo, ses.state, ses.toMove, Level.NORMAL, rng))
            }
        }
        return null
    }

    private fun sevensOut(): MatchRecord? {
        val def = Sevens.def
        val rng = Random(5)
        val ses = Session(def, GameOptions(), seats(4), 11L)
        var guard = 0
        while (guard++ < 200) {
            val s: SevensState = ses.state
            if (s.turn == 0) {
                if (s.passes[0] >= Sevens.MAX_PASS) return ses.record()
                ses.submit(Sevens.PASS)
            } else ses.submit(def.brain.choose(ses.rules, s, s.turn, Level.NORMAL, rng, Budget(20)))
        }
        return null
    }

    private fun blackjack(cond: (BjState) -> Boolean): MatchRecord? {
        val def = Blackjack.def
        for (seed in 1L..3000L) {
            val ses = Session(def, GameOptions(), seats(1), seed)
            ses.submit(Blackjack.BET + 50)
            // 賭ける前から始める(賭けて配られる所を見られるように。配る札は賭けの額によらない)
            if (cond(ses.state)) return MatchRecord(def.id, GameOptions(), seats(1), seed, emptyList())
        }
        return null
    }
}
