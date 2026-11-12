package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

data class HanaState(val seed:Long,val round:Int,val dealer:Int,val hands:List<List<Int>>,val field:List<Int>,val stock:List<Int>,
    val captured:List<List<Int>>,val points:List<Int>,val turn:Int,val phase:Int=0,val drawn:Int=-1,
    val lastYaku:List<Int> = listOf(0,0),val called:Set<Int> = emptySet(),val result:String="",val over:Boolean=false,val lastMover:Int=-1)
class Hanafuda(val rounds:Int=12,val viewing:Boolean=true,val doubleSeven:Boolean=true,val koiDouble:Boolean=true):Rules<HanaState>{
    override val playerCount=2
    override fun initial(rng:Random)=deal(rng.nextLong(),0,0,listOf(0,0))
    private fun deal(seed:Long,round:Int,dealer:Int,points:List<Int>):HanaState{
        if(round>=rounds)return HanaState(seed,round,dealer,listOf(emptyList(),emptyList()),emptyList(),emptyList(),listOf(emptyList(),emptyList()),points,-1,over=true)
        var attempt=0;var cards:List<Int>
        do{cards=(0..47).shuffled(Random(seed+round*104729L+attempt++))}while(cards.take(8).groupingBy{it/4}.eachCount().any{it.value==4})
        val hands=listOf(cards.drop(8).take(8),cards.drop(16).take(8))
        val s=HanaState(seed,round,dealer,hands,cards.take(8),cards.drop(24),listOf(emptyList(),emptyList()),points,dealer)
        val special=hands.map{h->val counts=h.groupingBy{it/4}.eachCount().values;counts.any{it==4}||(counts.size==4&&counts.all{it==2})}
        val winner=listOf(dealer,1-dealer).firstOrNull{special[it]}
        return if(winner==null)s else finish(s,winner,6,"手四・くっつき")
    }
    override fun toMove(s:HanaState)=if(s.over)-1 else s.turn
    private fun choices(field:List<Int>,card:Int):List<Int>{val same=field.filter{it/4==card/4};return if(same.size in 1..2)same else listOf(-1)}
    override fun legalMoves(s:HanaState):IntArray{
        if(s.over)return intArrayOf()
        return when(s.phase){
            0->s.hands[s.turn].flatMap{c->choices(s.field,c).map{target->PLAY+c*64+target+1}}.toIntArray()
            1->choices(s.field,s.drawn).map{TAKE+it+1}.toIntArray()
            2->intArrayOf(STOP,KOI)
            else->intArrayOf(NEXT)
        }
    }
    private fun capture(s:HanaState,card:Int,target:Int):HanaState{
        val matches=s.field.filter{it/4==card/4};val field=s.field.toMutableList();val captured=s.captured.map{it.toMutableList()}
        if(matches.isEmpty())field+=card else{
            val take=if(matches.size==3)matches else listOf(if(target>=0)target else matches.first())
            field.removeAll(take.toSet());captured[s.turn]+=card;captured[s.turn].addAll(take)
        }
        return s.copy(field=field,captured=captured,lastMover=s.turn)
    }
    override fun play(s:HanaState,m:Int):HanaState{
        if(m==NEXT)return deal(s.seed,s.round+1,s.dealer,s.points)
        if(m==STOP){val base=yaku(s.captured[s.turn],viewing).sumOf{it.second};val multiplier=(if(doubleSeven&&base>=7)2 else 1)*(if(koiDouble&&(1-s.turn) in s.called)2 else 1);return finish(s,s.turn,base*multiplier,"役 ${base}点"+(if(multiplier>1)" ×$multiplier" else ""))}
        if(m==KOI){val previous=s.lastYaku.toMutableList();previous[s.turn]=yaku(s.captured[s.turn],viewing).sumOf{it.second};return finishTurn(s.copy(lastYaku=previous,called=s.called+s.turn))}
        if(s.phase==0){val code=m-PLAY;val card=code/64;val target=code%64-1;val hands=s.hands.map{it.toMutableList()};hands[s.turn].remove(card)
            val n=capture(s.copy(hands=hands),card,target)
            return if(n.stock.isEmpty())afterDraw(n) else n.copy(phase=1,drawn=n.stock.first(),stock=n.stock.drop(1))
        }
        return afterDraw(capture(s,s.drawn,m-TAKE-1).copy(drawn=-1))
    }
    private fun afterDraw(s:HanaState):HanaState{
        val value=yaku(s.captured[s.turn],viewing).sumOf{it.second}
        if(value>s.lastYaku[s.turn]){
            if(s.hands[s.turn].isEmpty()){
                val mult=(if(doubleSeven&&value>=7)2 else 1)*(if(koiDouble&&(1-s.turn) in s.called)2 else 1)
                return finish(s,s.turn,value*mult,"役 $value 点")
            }
            return s.copy(phase=2)
        }
        return finishTurn(s)
    }
    private fun finishTurn(s:HanaState):HanaState{
        if(s.hands.all{it.isEmpty()}||s.stock.isEmpty())return s.copy(phase=3,result="引き分け",turn=s.dealer)
        return s.copy(turn=1-s.turn,phase=0)
    }
    private fun finish(s:HanaState,winner:Int,amount:Int,label:String):HanaState{
        val points=s.points.toMutableList();points[winner]+=amount
        return s.copy(points=points,phase=3,turn=winner,dealer=winner,result="${winner+1}番：$label → $amount 点")
    }
    override fun outcome(s:HanaState):Outcome?{if(!s.over)return null;return Outcome(if(s.points[0]==s.points[1])-1 else s.points.indices.maxBy{s.points[it]},"${s.points[0]} 対 ${s.points[1]}点")}
    override fun scores(s:HanaState)=s.points.toIntArray()
    companion object{
        const val KOI=0;const val STOP=1;const val NEXT=2;const val PLAY=100;const val TAKE=10000
        val months=listOf("松","梅","桜","藤","菖蒲","牡丹","萩","芒","菊","紅葉","柳","桐")
        val lights=setOf(0,8,28,40,44);val animals=setOf(4,12,16,20,24,32,36,41, /* 雁 */29)
        val ribbons=setOf(1,5,9,13,17,21,25,33,37,42)
        fun label(c:Int)="${c/4+1}月 ${months[c/4]}・"+when(c){0->"鶴";8->"幕";28->"月";40->"雨";44->"鳳凰";20->"蝶";24->"猪";32->"盃";36->"鹿";else->when(c){in animals->"タネ";in ribbons->"短冊";else->"カス"}}
        fun yaku(cards:List<Int>,viewing:Boolean=true):List<Pair<String,Int>>{
            val c=cards.toSet();val out=mutableListOf<Pair<String,Int>>();val light=c.count{it in lights}
            when{light==5->out+="五光" to 10;light==4->out+=(if(40 in c)"雨四光" to 7 else "四光" to 8);light==3&&40 !in c->out+="三光" to 5}
            if(c.containsAll(listOf(20,24,36)))out+="猪鹿蝶" to 5
            if(c.containsAll(listOf(1,5,9)))out+="赤短" to 5
            if(c.containsAll(listOf(21,33,37)))out+="青短" to 5
            if(viewing&&32 in c){if(8 in c)out+="花見で一杯" to 5;if(28 in c)out+="月見で一杯" to 5}
            val tane=c.count{it in animals};val tan=c.count{it in ribbons};val kasu=c.count{it !in animals&&it !in ribbons&&it !in lights}+if(32 in c)1 else 0
            if(tane>=5)out+="タネ" to tane-4;if(tan>=5)out+="タン" to tan-4;if(kasu>=10)out+="カス" to kasu-9
            return out
        }
        val brain=Brain<HanaState>{r,s,seat,lv,rng,_->
            val legal=r.legalMoves(s)
            if(s.phase==2){val score=yaku(s.captured[seat],(r as Hanafuda).viewing).sumOf{it.second};if(lv==Level.EASY)legal.random(rng)else if(score>=(if(lv==Level.HARD)7 else 5)||s.hands[seat].size<=2||(lv==Level.HARD&&(1-seat) in s.called))STOP else KOI}
            else if(lv==Level.EASY)legal.random(rng)else legal.maxBy{m->
                if(m==NEXT)0 else{val card=if(s.phase==0)(m-PLAY)/64 else s.drawn;val target=if(s.phase==0)(m-PLAY)%64-1 else m-TAKE-1
                    val captured=if(s.field.any{it/4==card/4})s.captured[seat]+card+(if(s.field.count{it/4==card/4}==3)s.field.filter{it/4==card/4}else listOf(if(target>=0)target else s.field.first{it/4==card/4}))else s.captured[seat]
                    yaku(captured,(r as Hanafuda).viewing).sumOf{it.second}*100+captured.fold(0){total,c->total+(if(c in lights)20 else if(c in animals)10 else if(c in ribbons)5 else 1)}+(if(lv==Level.HARD)yaku(s.captured[1-seat]+captured.filter{it !in s.captured[seat]},(r as Hanafuda).viewing).sumOf{it.second}*35 else 0)
                }
            }
        }
        val def=GameDef("hanafuda",{Hanafuda(it.int("rounds",12).coerceIn(1,12),it.str("viewing","true")=="true",it.str("double7","true")=="true",it.str("koiDouble","true")=="true")},brain,false)
    }
}
