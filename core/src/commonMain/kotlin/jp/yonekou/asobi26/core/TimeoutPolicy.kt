package jp.yonekou.asobi26.core

import jp.yonekou.asobi26.core.games.*
import kotlin.random.Random

/**
 * 時間切れの時の手。合法なパスがあればパス、なければ合法な手から無作為に1つ(ユーザーの指示「ランダムな一手」)。
 * 同じ種と手数から同じ手になる(通信でもホストが決めて配るので、ずれない)。
 */
object TimeoutPolicy {
    fun <S> choose(ses: Session<S>, state: S = ses.state, seat: Int = ses.toMove, index: Int = ses.moves.size): Int {
        val legal = ses.rules.legalMoves(state)
        require(legal.isNotEmpty())
        val pass = when (val st = state) {
            is SevensState -> Sevens.PASS
            is DaifugoState -> Daifugo.PASS
            is GoState -> (ses.rules as Go).PASS
            is BjState -> Blackjack.STAND
            is MahjongState -> if(st.phase==1)Mahjong.PASS else null
            is OhNoState -> OhNo.PASS
            is HoldemState -> if(st.street==4)Holdem.NEXT else if(st.bets[st.turn]==st.bets.max())Holdem.CALL else null
            is PokerState -> if (st.bets[st.turn] == st.bets.max()) Poker.CALL else null
            else -> ses.def.passMove
        }
        if (pass != null && pass in legal) return pass
        return legal[Random(ses.seed xor (index.toLong() * 0x9E3779B97F4A7C15uL.toLong())).nextInt(legal.size)]
    }
}
