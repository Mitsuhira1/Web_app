package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

data class SpeedState(val hands:List<List<Int>>,val reserves:List<List<Int>>,val tops:List<Int>,val winner:Int=-1,val over:Boolean=false,val lastMover:Int=-1,val lastCard:Int=-1)
/** 双方が同時に出せる。操作した席と札の固有番号を手に含め、競合はホストの受信順で確定。 */
class Speed(val wrap:Boolean=true):ConcurrentRules<SpeedState>{
    override val playerCount=2
    override fun actor(move:Int)=move/SEAT
    override fun initial(rng:Random):SpeedState{
        val deck=Cards.deck(rng.nextLong()).toList()
        return SpeedState(List(2){deck.drop(it*26).take(4)},List(2){deck.drop(it*26+5).take(21)},List(2){deck[it*26+4]})
    }
    fun adjacent(a:Int,b:Int):Boolean{val delta=kotlin.math.abs(Cards.rank(a)-Cards.rank(b));return delta==1||(wrap&&delta==12)}
    private fun plays(s:SpeedState,p:Int)=s.hands[p].flatMap{card->s.tops.indices.filter{adjacent(card,s.tops[it])}.map{p*SEAT+PLAY+card*2+it}}
    override fun toMove(s:SpeedState)=if(s.over)-1 else if(legalMovesFor(s,0).isNotEmpty())0 else 1
    override fun legalMovesFor(s:SpeedState,seat:Int):IntArray{
        if(s.over||seat !in 0..1)return intArrayOf()
        val moves=plays(s,seat)
        return if(moves.isNotEmpty())moves.toIntArray() else if(plays(s,1-seat).isEmpty())intArrayOf(seat*SEAT+RESET)else intArrayOf()
    }
    override fun play(s:SpeedState,m:Int):SpeedState{
        val p=actor(m);val hands=s.hands.map{it.toMutableList()};val reserves=s.reserves.map{it.toMutableList()};val tops=s.tops.toMutableList();var card=-1
        if(m%SEAT==RESET){
            for(q in 0..1){val pile=if(reserves[q].isNotEmpty())reserves[q] else hands[q];if(pile.isNotEmpty())tops[q]=pile.removeAt(0)}
        }else{
            val code=m%SEAT-PLAY;card=code/2;val target=code%2
            hands[p].remove(card);tops[target]=card
            if(reserves[p].isNotEmpty())hands[p]+=reserves[p].removeAt(0)
        }
        val finished=(0..1).filter{hands[it].isEmpty()&&reserves[it].isEmpty()}
        return SpeedState(hands,reserves,tops,if(finished.size==1)finished[0] else -1,finished.isNotEmpty(),p,card)
    }
    override fun outcome(s:SpeedState)=if(s.over)Outcome(s.winner,if(s.winner<0)"同時に出し切りました" else "先にすべて出し切りました")else null
    override fun scores(s:SpeedState)=IntArray(2){-(s.hands[it].size+s.reserves[it].size)}
    companion object{
        const val SEAT=1_000_000;const val RESET=0;const val PLAY=100
        val brain=Brain<SpeedState>{r,s,seat,lv,rng,_->val g=r as Speed;val legal=g.legalMovesFor(s,seat)
            if(legal.isEmpty())-1 else if(lv==Level.EASY)legal.random(rng) else legal.maxBy{m->
                if(m%SEAT==RESET)0 else {val card=(m%SEAT-PLAY)/2;s.hands[seat].count{it!=card&&g.adjacent(it,card)}}
            }}
        val def=GameDef("speed",{Speed(it.str("wrap","true")=="true")},brain,false)
    }
}
