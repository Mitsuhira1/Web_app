package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

data class HoldemState(val seed:Long,val round:Int,val dealer:Int,val chips:List<Int>,val hands:List<List<Int>>,
    val board:List<Int>,val street:Int,val bets:List<Int>,val invested:List<Int>,val folded:Set<Int>,val acted:Set<Int>,
    val raiseAllowed:Set<Int>,val minRaise:Int,val turn:Int,val lastAction:String="",val lastMover:Int=-1,
    val payouts:List<Int> = emptyList(),val over:Boolean=false)
/** ノーリミット、ブラインド10/20。各サイドポットは拠出額ごとに独立精算する。 */
class Holdem(val players:Int,val rounds:Int=10):Rules<HoldemState>{
    override val playerCount=players
    override fun initial(rng:Random)=newHand(rng.nextLong(),0,0,List(players){1000})
    private fun newHand(seed:Long,round:Int,dealer0:Int,chips:List<Int>):HoldemState{
        val alive=chips.indices.filter{chips[it]>0}
        if(round>=rounds||alive.size<2)return HoldemState(seed,round,dealer0,chips,List(players){emptyList()},emptyList(),0,List(players){0},List(players){0},emptySet(),emptySet(),emptySet(),20,-1,over=true)
        val dealer=alive.firstOrNull{it>=dealer0}?:alive.first()
        fun next(p:Int)=alive.firstOrNull{it>p}?:alive.first()
        val sb=if(alive.size==2)dealer else next(dealer);val bb=next(sb)
        val deck=Cards.deck(seed+round*104729L);var pos=0
        val hands=List(players){p->if(p in alive)List(2){deck[pos++]} else emptyList()}
        val bets=MutableList(players){0};val cash=chips.toMutableList()
        for((p,amt)in listOf(sb to 10,bb to 20)){bets[p]=minOf(amt,cash[p]);cash[p]-=bets[p]}
        val start=next(bb)
        val s=HoldemState(seed,round,dealer,cash,hands,emptyList(),0,bets,bets.toList(),chips.indices.filter{it !in alive}.toSet(),emptySet(),alive.toSet(),20,start,"ブラインド10/20")
        return advance(s,bb)
    }
    override fun toMove(s:HoldemState)=if(s.over)-1 else s.turn
    override fun legalMoves(s:HoldemState):IntArray{
        if(s.over)return intArrayOf()
        if(s.street==4)return intArrayOf(NEXT)
        val p=s.turn;val max=s.bets.max();val call=(max-s.bets[p]).coerceAtLeast(0);val out=mutableListOf(FOLD,CALL)
        if((p in s.raiseAllowed||call>=s.minRaise)&&s.chips[p]>call&&s.chips.indices.any{it!=p&&it !in s.folded&&s.chips[it]>0}){
            val top=s.bets[p]+s.chips[p]
            if(top>=max+s.minRaise)for(target in max+s.minRaise..top)out+=RAISE+target
            out+=ALL_IN
        }else if(s.chips[p]<=call)out+=ALL_IN
        return out.toIntArray()
    }
    override fun play(s:HoldemState,m:Int):HoldemState{
        if(m==NEXT)return nextHand(s)
        val p=s.turn;val bets=s.bets.toMutableList();val chips=s.chips.toMutableList();val invested=s.invested.toMutableList()
        var folded=s.folded;var acted=s.acted+p;var allowed=s.raiseAllowed-p;var minRaise=s.minRaise
        val oldMax=bets.max()
        var text="チェック"
        if(m==FOLD){folded=folded+p;text="フォールド"}else{
            val target=when(m){CALL->oldMax;ALL_IN->bets[p]+chips[p];else->m-RAISE}
            val amount=minOf(chips[p],(target-bets[p]).coerceAtLeast(0))
            bets[p]+=amount;chips[p]-=amount;invested[p]+=amount
            if(bets[p]>oldMax){val increase=bets[p]-oldMax
                if(increase>=s.minRaise){minRaise=increase;acted=setOf(p);allowed=chips.indices.filter{it!=p&&it !in folded&&chips[it]>0}.toSet()}
                text=if(chips[p]==0)"オールイン" else "レイズ ${bets[p]}"
            }else if(amount>0)text=if(chips[p]==0)"オールイン" else "コール $amount"
        }
        return advance(s.copy(chips=chips,bets=bets,invested=invested,folded=folded,acted=acted,raiseAllowed=allowed,minRaise=minRaise,lastMover=p,lastAction=text),p)
    }
    private fun advance(s:HoldemState,after:Int):HoldemState{
        val alive=s.chips.indices.filter{it !in s.folded}
        if(alive.size==1)return settle(s)
        val needing=alive.filter{s.chips[it]>0&&(it !in s.acted||s.bets[it]<s.bets.max())}
        if(needing.isNotEmpty() && !(alive.count{s.chips[it]>0}==1&&needing.size==1&&s.bets[needing[0]]>=s.bets.max())){
            val next=(1..players).map{(after+it)%players}.first{it in needing}
            return s.copy(turn=next)
        }
        if(s.street>=3)return settle(s)
        val deck=Cards.deck(s.seed+s.round*104729L);val holeCount=s.hands.sumOf{it.size}
        // 配札後に各ストリートで1枚バーンする。未公開の未来札はCPUへ渡さない。
        val board=listOf(deck[holeCount+1],deck[holeCount+2],deck[holeCount+3],deck[holeCount+5],deck[holeCount+7]).take(when(s.street){0->3;1->4;else->5})
        val nextStreet=s.copy(board=board,street=s.street+1,bets=List(players){0},acted=emptySet(),raiseAllowed=alive.toSet(),minRaise=20)
        return advance(nextStreet,s.dealer)
    }
    private fun settle(s:HoldemState):HoldemState{
        val pots=s.invested.filter{it>0}.distinct().sorted();val payout=MutableList(players){0};var prev=0
        for(cap in pots){val contributors=s.invested.indices.filter{s.invested[it]>=cap};val amount=(cap-prev)*contributors.size;prev=cap
            val eligible=contributors.filter{it !in s.folded}
            if(eligible.isEmpty()){for(p in contributors)payout[p]+=cap-(pots.getOrNull(pots.indexOf(cap)-1)?:0);continue}
            val best=eligible.maxOf{p->if(eligible.size==1)0 else bestValue((s.hands[p]+s.board).toIntArray())}
            val winners=eligible.filter{p->eligible.size==1||bestValue((s.hands[p]+s.board).toIntArray())==best}.sortedBy{(it-s.dealer-1+players)%players}
            for((i,p)in winners.withIndex())payout[p]+=amount/winners.size+if(i<amount%winners.size)1 else 0
        }
        val cash=s.chips.mapIndexed{p,v->v+payout[p]}
        // 精算画面を独立した状態として残し、全員が同じ結果を見てから次局へ。
        return s.copy(chips=cash,payouts=payout,street=4,turn=(s.dealer+1)%players,lastAction="ショーダウン")
    }
    fun nextHand(s:HoldemState)=newHand(s.seed,s.round+1,(s.dealer+1)%players,s.chips)
    override fun outcome(s:HoldemState):Outcome?{if(!s.over)return null;val top=s.chips.max();val w=s.chips.indices.filter{s.chips[it]==top};return Outcome(if(w.size==1)w[0] else -1,"持ち点 $top")}
    override fun scores(s:HoldemState)=s.chips.toIntArray()
    companion object{
        const val FOLD=0;const val CALL=1;const val ALL_IN=2;const val NEXT=3;const val RAISE=100
        fun bestValue(cards:IntArray):Int{require(cards.size>=5);var best=0
            for(a in 0 until cards.size-4)for(b in a+1 until cards.size-3)for(c in b+1 until cards.size-2)for(d in c+1 until cards.size-1)for(e in d+1 until cards.size)best=maxOf(best,Cards.handValue(intArrayOf(cards[a],cards[b],cards[c],cards[d],cards[e])))
            return best
        }
        private fun visibleWinRate(s:HoldemState,seat:Int,rng:Random,budget:Budget):Double {
            val known=(s.hands[seat]+s.board).toSet()
            val pool=(0..51).filter{it !in known}
            val opponents=s.hands.indices.count{it!=seat&&it !in s.folded}
            var won=0.0;var samples=0
            repeat(32){
                if(samples>=4&&budget.over())return@repeat
                val sample=pool.shuffled(rng);var pos=5-s.board.size
                val board=s.board+sample.take(pos)
                val own=bestValue((s.hands[seat]+board).toIntArray())
                var beaten=false;var ties=1
                repeat(opponents){val cards=listOf(sample[pos++],sample[pos++])+board;val value=bestValue(cards.toIntArray());if(value>own)beaten=true;if(value==own)ties++}
                if(!beaten)won+=1.0/ties
                samples++
            }
            return won/samples.coerceAtLeast(1)
        }
        val brain=Brain<HoldemState>{rules,s,seat,lv,rng,budget->
            val legal=rules.legalMoves(s)
            if(s.street==4)NEXT else {
                val hand=s.hands[seat];val value=if(s.board.size>=3)Cards.handCategory(bestValue((hand+s.board).toIntArray())) else if(Cards.rank(hand[0])==Cards.rank(hand[1]))2 else if(hand.any{Cards.rank(it)>=12})1 else 0
                val call=s.bets.max()-s.bets[seat];val raises=legal.filter{it>=RAISE}
                if(lv==Level.HARD){
                    val chance=visibleWinRate(s,seat,rng,budget)
                    val odds=call.toDouble()/(s.invested.sum()+call).coerceAtLeast(1)
                    when{call>0&&chance+0.10<odds->FOLD
                        raises.isNotEmpty()&&(chance>0.72||rng.nextInt(25)==0)->raises.first()
                        else->CALL}
                }else when{lv==Level.EASY->if(rng.nextInt(5)==0)FOLD else CALL
                    value>=2&&raises.isNotEmpty()&&rng.nextInt(3)==0->raises.first()
                    call>s.chips[seat]/3&&value==0->FOLD
                    else->CALL}
            }
        }
        val def=GameDef("holdem",{Holdem(it.int("players",4).coerceIn(2,6),it.int("rounds",10).coerceIn(1,20))},brain,false,{it.int("players",4).coerceIn(2,6)})
    }
}
