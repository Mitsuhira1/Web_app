package jp.yonekou.asobi26.core

/** 早い者勝ちや同じ配札の競争。手には操作した席を含め、ホストが受信順に確定する。 */
interface ConcurrentRules<S> : Rules<S> {
    fun actor(move:Int):Int
    fun legalMovesFor(state:S,seat:Int):IntArray
    override fun legalMoves(s:S):IntArray=(0 until playerCount).flatMap{legalMovesFor(s,it).asList()}.toIntArray()
}
