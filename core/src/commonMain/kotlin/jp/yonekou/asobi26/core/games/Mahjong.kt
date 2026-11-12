package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

data class MjRiichi(val waits:Set<Int>,val double:Boolean,val declaration:Int=-1)
data class MjRoundResult(val label:String,val winners:List<Int>,val deltas:List<Int>,val scores:Map<Int,MjScore>,val tenpai:Set<Int>,
    val nextDealer:Int,val nextRound:Int,val nextHonba:Int,val end:Boolean)
data class MahjongState(val seed:Long,val serial:Int,val round:Int,val dealer:Int,val honba:Int,val sticks:Int,val points:List<Int>,
    val wall:List<Int>,val pos:Int,val liveEnd:Int,val hands:List<List<Int>>,val melds:List<List<MjMeld>>,val rivers:List<List<Int>>,
    val claimed:Set<Int>,val riichi:Map<Int,MjRiichi>,val ippatsu:Set<Int>,val temporaryFuriten:Set<Int>,val riichiFuriten:Set<Int>,
    val draws:List<Int>,val turn:Int,val phase:Int=0,val drawnTile:Int=-1,val lastDiscard:Int=-1,val discarder:Int=-1,
    val reactionSeats:List<Int> = emptyList(),val responses:Map<Int,Int> = emptyMap(),val pendingKan:Int=-1,val pendingRiichi:Int=-1,
    val kans:Int=0,val rinshan:Boolean=false,val calls:Boolean=false,val banned:Set<Int> = emptySet(),val fourKanAbort:Boolean=false,
    val liability:Map<Int,Int> = emptyMap(),val result:MjRoundResult?=null,val action:String="",val lastMover:Int=-1)
/** 4人リーチ麻雀。赤3枚・喰いタンあり・後付けありを初期値とする。 */
class Mahjong(val length:Int=4,val red:Boolean=true,val openTanyao:Boolean=true,val multiRon:Boolean=false,
    val doubleYakuman:Boolean=false,val tobi:Boolean=true,val agariYame:Boolean=true):Rules<MahjongState>{
    override val playerCount=4
    override fun initial(rng:Random)=deal(rng.nextLong(),0,0,0,0,0,List(4){25000})
    private fun deal(seed:Long,serial:Int,round:Int,dealer:Int,honba:Int,sticks:Int,points:List<Int>):MahjongState{
        val wall=(0..135).shuffled(Random(seed+serial*104729L));var pos=0
        val hands=List(4){List(13){wall[pos++]}.sorted()}
        val s=MahjongState(seed,serial,round,dealer,honba,sticks,points,wall,pos,122,hands,List(4){emptyList()},List(4){emptyList()},
            emptySet(),emptyMap(),emptySet(),emptySet(),emptySet(),List(4){0},dealer)
        return draw(s,dealer)
    }
    override fun toMove(s:MahjongState)=if(s.phase==3)-1 else s.turn
    fun indicators(s:MahjongState)=if(s.wall.size<136)emptyList()else(0..s.kans).map{s.wall[126+it*2]}
    fun waits(hand:List<Int>,melds:List<MjMeld>):Set<Int>{val own=MahjongHand.counts(hand+melds.flatMap{it.tiles});return MahjongHand.waits(hand,melds.size).filter{own[it]<4}.toSet()}
    private fun score(s:MahjongState,p:Int,tile:Int,tsumo:Boolean,reveal:Boolean=false):MjScore?{
        val hand=if(tsumo)s.hands[p] else s.hands[p]+tile
        val context=MjContext(27+(p-s.dealer+4)%4,27+s.round/4,tsumo,s.riichi[p]?.let{if(it.double)2 else 1}?:0,
            p in s.ippatsu,tsumo&&s.rinshan,!tsumo&&s.pendingKan>=0,s.pos>=s.liveEnd&&!s.rinshan&&s.pendingKan<0,
            tsumo&&s.draws[p]==1&&s.rivers[p].isEmpty()&&!s.calls,
            indicators(s).map{MahjongHand.doraAfter(it/4)},
            if(reveal&&p in s.riichi)(0..s.kans).map{MahjongHand.doraAfter(s.wall[127+it*2]/4)}else emptyList(),red,openTanyao,doubleYakuman)
        return MahjongHand.evaluate(hand,s.melds[p],tile,context)
    }
    fun furiten(s:MahjongState,p:Int):Boolean {
        if(p in s.temporaryFuriten||p in s.riichiFuriten)return true
        val currentWaits=s.riichi[p]?.waits ?: waits(if(s.turn==p&&s.phase==0&&s.drawnTile>=0)s.hands[p]-s.drawnTile else s.hands[p],s.melds[p])
        return s.rivers[p].any{it/4 in currentWaits}
    }
    private fun reaction(s:MahjongState,p:Int):List<Int>{
        val tile=s.lastDiscard;if(tile<0)return listOf(PASS)
        val type=tile/4;val hand=s.hands[p];val ops=mutableListOf(PASS)
        if(score(s,p,tile,false)!=null&&!furiten(s,p)){
            if(s.pendingKan !in ANKAN..ANKAN+33||MahjongHand.kokushi(hand+tile))ops+=RON
        }
        if(s.pendingKan>=0||p in s.riichi||s.pos>=s.liveEnd||s.melds[p].size>=4)return ops
        val same=hand.filter{it/4==type}
        if(same.size>=2)for(a in same.indices)for(b in a+1 until same.size)ops+=PON+same[a]*136+same[b]
        if(same.size==3&&s.kans<4)ops+=OPEN_KAN+type
        if(p==(s.discarder+1)%4&&type<27){
            for(start in type-2..type)if(start>=0&&start/9==type/9&&start%9<=6){
                val need=(start..start+2).filter{it!=type};val a=hand.filter{it/4==need[0]};val b=hand.filter{it/4==need[1]}
                for(x in a)for(y in b)ops+=CHI+minOf(x,y)*136+maxOf(x,y)
            }
        }
        return ops
    }
    override fun legalMoves(s:MahjongState):IntArray{
        if(s.phase==3)return intArrayOf()
        if(s.phase==2)return intArrayOf(NEXT)
        if(s.phase==1)return reaction(s,s.turn).toIntArray()
        val p=s.turn;val hand=s.hands[p];val out=mutableListOf<Int>()
        if(s.drawnTile>=0&&score(s,p,s.drawnTile,true)!=null)out+=TSUMO
        val discards=if(p in s.riichi)hand.filter{it==s.drawnTile} else hand.filter{it/4 !in s.banned}
        out.addAll(discards)
        if(p !in s.riichi&&s.melds[p].none{it.open}&&s.points[p]>=1000&&s.liveEnd-s.pos>=4){
            for(tile in discards)if(waits(hand-tile,s.melds[p]).isNotEmpty())out+=RIICHI+tile
        }
        if(s.drawnTile>=0&&s.kans<4&&s.pos<s.liveEnd){
            for(type in hand.map{it/4}.distinct())if(hand.count{it/4==type}==4){
                if(p !in s.riichi||(s.drawnTile/4==type&&waits(hand.filter{it/4!=type},s.melds[p]+MjMeld(2,hand.filter{it/4==type}))==s.riichi[p]!!.waits))out+=ANKAN+type
            }
            if(p !in s.riichi)for(meld in s.melds[p].filter{it.kind==1})for(tile in hand.filter{it/4==meld.tiles.first()/4})out+=ADDED_KAN+tile
        }
        if(s.draws[p]==1&&s.rivers[p].isEmpty()&&!s.calls&&hand.map{it/4}.distinct().count{it in MahjongHand.terminals}>=9)out+=KYUSHU
        return out.toIntArray()
    }
    override fun play(s:MahjongState,m:Int):MahjongState{
        if(m==NEXT){val result=s.result!!;return if(result.end)s.copy(phase=3,turn=-1)else deal(s.seed,s.serial+1,result.nextRound,result.nextDealer,result.nextHonba,s.sticks,s.points)}
        if(s.phase==1){
            val p=s.turn;val canRon=RON in reaction(s,p);val passed=canRon&&m!=RON
            val n=s.copy(responses=s.responses+(p to m),temporaryFuriten=if(passed)s.temporaryFuriten+p else s.temporaryFuriten,
                riichiFuriten=if(passed&&p in s.riichi)s.riichiFuriten+p else s.riichiFuriten)
            val next=s.reactionSeats.firstOrNull{it !in n.responses}
            return if(next!=null)n.copy(turn=next)else resolve(n)
        }
        val p=s.turn
        if(m==TSUMO)return win(s,listOf(p),-1)
        if(m==KYUSHU)return drawn(s,"九種九牌",true)
        if(m in ANKAN..ANKAN+33||m in ADDED_KAN..ADDED_KAN+135){
            val tile=if(m>=ADDED_KAN)m-ADDED_KAN else s.hands[p].first{it/4==m-ANKAN}
            return reactions(s.copy(lastDiscard=tile,discarder=p,pendingKan=m,action=if(m>=ADDED_KAN)"加槓"else"暗槓",lastMover=p))
        }
        val declare=m in RIICHI..RIICHI+135;val tile=if(declare)m-RIICHI else m
        val hands=s.hands.toMutableList();hands[p]=(hands[p]-tile).sorted()
        val rivers=s.rivers.toMutableList();rivers[p]=rivers[p]+tile
        val points=s.points.toMutableList();var riichi=s.riichi;var sticks=s.sticks;var ippatsu=s.ippatsu-p
        if(declare){points[p]-=1000;sticks++;riichi=riichi+(p to MjRiichi(waits(hands[p],s.melds[p]),s.rivers[p].isEmpty()&&!s.calls,tile));ippatsu=ippatsu+p}
        return reactions(s.copy(hands=hands,rivers=rivers,points=points,sticks=sticks,riichi=riichi,ippatsu=ippatsu,
            drawnTile=-1,lastDiscard=tile,discarder=p,pendingKan=-1,pendingRiichi=if(declare)p else -1,banned=emptySet(),lastMover=p,action=if(declare)"リーチ"else"打牌"))
    }
    private fun reactions(s:MahjongState):MahjongState{
        val queue=(1..3).map{(s.discarder+it)%4}.filter{reaction(s,it).size>1}
        val n=s.copy(phase=1,reactionSeats=queue,responses=emptyMap())
        return if(queue.isEmpty())resolve(n)else n.copy(turn=queue.first())
    }
    private fun resolve(s:MahjongState):MahjongState{
        val winners=s.reactionSeats.filter{s.responses[it]==RON}
        if(winners.isNotEmpty()){
            if(winners.size==3&&multiRon)return drawn(s,"三家和",true)
            return win(s,if(multiRon)winners else winners.take(1),s.discarder)
        }
        if(s.pendingKan>=0)return kan(s,s.discarder,s.pendingKan)
        val n=s.copy(pendingRiichi=-1)
        if(n.fourKanAbort)return drawn(n,"四開槓",true)
        if(n.riichi.size==4)return drawn(n,"四家立直",true)
        if(!n.calls&&n.rivers.all{it.size==1}&&n.rivers.map{it.first()/4}.distinct().singleOrNull() in 27..30)return drawn(n,"四風連打",true)
        val caller=n.reactionSeats.firstOrNull{n.responses[it] in OPEN_KAN..OPEN_KAN+33||n.responses[it] in PON until OPEN_KAN}
            ?:n.reactionSeats.firstOrNull{n.responses[it] in CHI until PON}
        if(caller!=null){val code=n.responses[caller]!!
            if(code>=OPEN_KAN)return kan(n,caller,code)
            val base=if(code>=PON)PON else CHI;val x=(code-base)/136;val y=(code-base)%136
            val tiles=listOf(x,y,n.lastDiscard).sorted();val hand=n.hands.toMutableList();hand[caller]=(hand[caller]-x-y).sorted()
            val melds=n.melds.toMutableList();melds[caller]=melds[caller]+MjMeld(if(base==PON)1 else 0,tiles,n.discarder)
            val forbidden=mutableSetOf(n.lastDiscard/4)
            if(base==CHI){val start=tiles.minOf{it/4};val type=n.lastDiscard/4
                if(type==start&&start%9<=5)forbidden+=start+3
                if(type==start+2&&start%9>=1)forbidden+=start-1
            }
            return n.copy(hands=hand,melds=melds,claimed=n.claimed+n.lastDiscard,turn=caller,phase=0,drawnTile=-1,
                calls=true,ippatsu=emptySet(),banned=forbidden,liability=liability(n,caller,melds[caller],n.discarder),
                reactionSeats=emptyList(),responses=emptyMap(),action=if(base==PON)"ポン"else"チー",lastMover=caller)
        }
        return draw(n,(n.discarder+1)%4)
    }
    private fun liability(s:MahjongState,p:Int,melds:List<MjMeld>,from:Int):Map<Int,Int>{
        val trips=melds.filter{it.kind!=0}.map{it.tiles.first()/4}
        return if(trips.count{it>=31}==3||trips.count{it in 27..30}==4)s.liability+(p to from)else s.liability
    }
    private fun kan(s:MahjongState,p:Int,code:Int):MahjongState{
        val hands=s.hands.toMutableList();val melds=s.melds.toMutableList();var claimed=s.claimed;var liable=s.liability
        when{
            code in ANKAN..ANKAN+33->{val type=code-ANKAN;val take=hands[p].filter{it/4==type};hands[p]=hands[p]-take.toSet();melds[p]=melds[p]+MjMeld(2,take)}
            code>=ADDED_KAN->{val tile=code-ADDED_KAN;hands[p]=hands[p]-tile;melds[p]=melds[p].map{if(it.kind==1&&it.tiles.first()/4==tile/4)it.copy(kind=4,tiles=(it.tiles+tile).sorted())else it}}
            else->{val type=code-OPEN_KAN;val take=hands[p].filter{it/4==type};hands[p]=hands[p]-take.toSet();melds[p]=melds[p]+MjMeld(3,(take+s.lastDiscard).sorted(),s.discarder);claimed=claimed+s.lastDiscard;liable=liability(s,p,melds[p],s.discarder)}
        }
        val rinshanTile=s.wall[122+s.kans];hands[p]=(hands[p]+rinshanTile).sorted()
        val draws=s.draws.toMutableList();draws[p]++
        return s.copy(hands=hands,melds=melds,claimed=claimed,liability=liable,kans=s.kans+1,liveEnd=s.liveEnd-1,
            draws=draws,turn=p,phase=0,drawnTile=rinshanTile,lastDiscard=-1,discarder=-1,pendingKan=-1,pendingRiichi=-1,
            rinshan=true,calls=true,ippatsu=emptySet(),temporaryFuriten=s.temporaryFuriten-p,banned=emptySet(),
            reactionSeats=emptyList(),responses=emptyMap(),fourKanAbort=s.kans==3&&melds.indices.count{i->melds[i].any{it.kind>=2}}>1,
            action="槓・嶺上牌",lastMover=p)
    }
    private fun draw(s:MahjongState,p:Int):MahjongState{
        if(s.pos>=s.liveEnd)return drawn(s,"流局",false)
        val tile=s.wall[s.pos];val hands=s.hands.toMutableList();hands[p]=(hands[p]+tile).sorted();val draws=s.draws.toMutableList();draws[p]++
        return s.copy(hands=hands,pos=s.pos+1,draws=draws,turn=p,phase=0,drawnTile=tile,lastDiscard=-1,discarder=-1,
            rinshan=false,temporaryFuriten=s.temporaryFuriten-p,banned=emptySet(),pendingRiichi=-1,pendingKan=-1,
            reactionSeats=emptyList(),responses=emptyMap(),action="ツモ",lastMover=p)
    }
    private fun win(original:MahjongState,winners:List<Int>,from:Int):MahjongState{
        var s=original
        if(from>=0&&s.pendingRiichi==from){val points=s.points.toMutableList();points[from]+=1000;s=s.copy(points=points,sticks=s.sticks-1,riichi=s.riichi-from)}
        val points=s.points.toMutableList();val scores=mutableMapOf<Int,MjScore>()
        fun pay(p:Int,w:Int,amount:Int){points[p]-=amount;points[w]+=amount}
        for(w in winners){
            val sc=score(s,w,if(from<0)s.drawnTile else s.lastDiscard,from<0,true)!!;scores[w]=sc
            val responsible=s.liability[w]
            val paoBase=if(responsible!=null&&sc.yakuman>0)sc.yaku.filter{it.first=="大三元"||it.first=="大四喜"}.sumOf{it.second}/13*8000 else 0
            val normalBase=sc.base-paoBase
            if(from>=0){
                pay(from,w,MjScore.round100(normalBase*if(w==s.dealer)6 else 4)+s.honba*300)
                if(paoBase>0){val total=paoBase*if(w==s.dealer)6 else 4
                    if(responsible==from)pay(from,w,total)else{pay(from,w,total/2);pay(responsible!!,w,total/2)}
                }
            }else{
                for(p in 0..3)if(p!=w)pay(p,w,MjScore.round100(normalBase*if(w==s.dealer||p==s.dealer)2 else 1)+if(paoBase==0)s.honba*100 else 0)
                if(paoBase>0)pay(responsible!!,w,paoBase*(if(w==s.dealer)6 else 4)+s.honba*300)
            }
        }
        points[winners.first()]+=s.sticks*1000
        val repeat=s.dealer in winners
        return finish(original.copy(sticks=0,riichi=s.riichi),points,if(from<0)"ツモ和了"else if(winners.size>1)"複数ロン"else"ロン和了",winners,scores,emptySet(),repeat,if(repeat)s.honba+1 else 0)
    }
    private fun drawn(s:MahjongState,label:String,abort:Boolean):MahjongState{
        val ready=if(abort)emptySet()else(0..3).filter{waits(s.hands[it],s.melds[it]).isNotEmpty()}.toSet()
        val points=s.points.toMutableList()
        if(ready.size in 1..3)for(p in 0..3)points[p]+=if(p in ready)3000/ready.size else -3000/(4-ready.size)
        return finish(s,points,label,emptyList(),emptyMap(),ready,abort||s.dealer in ready,s.honba+1)
    }
    private fun finish(s:MahjongState,points0:List<Int>,label:String,winners:List<Int>,scores:Map<Int,MjScore>,tenpai:Set<Int>,repeat:Boolean,nextHonba:Int):MahjongState{
        val nextRound=s.round+if(repeat)0 else 1;val nextDealer=if(repeat)s.dealer else(s.dealer+1)%4
        val end=length==1||nextRound>=length||(tobi&&points0.any{it<0})||(agariYame&&s.round==length-1&&s.dealer in winners&&points0[s.dealer]==points0.max())
        val points=points0.toMutableList();var sticks=s.sticks
        if(end&&sticks>0){val best=points.indices.maxWithOrNull(compareBy<Int>{points[it]}.thenBy{-it})!!;points[best]+=sticks*1000;sticks=0}
        val result=MjRoundResult(label,winners,points.mapIndexed{p,n->n-s.points[p]},scores,tenpai,nextDealer,nextRound,nextHonba,end)
        return s.copy(points=points,sticks=sticks,phase=2,turn=0,result=result,action=label,pendingRiichi=-1,ippatsu=emptySet())
    }
    override fun outcome(s:MahjongState):Outcome?{if(s.phase!=3)return null;val best=s.points.indices.maxWithOrNull(compareBy<Int>{s.points[it]}.thenBy{-it})!!;return Outcome(best,"${s.points[best]}点（同点は起家順）")}
    override fun scores(s:MahjongState)=s.points.toIntArray()
    companion object{
        const val TSUMO=500;const val RON=501;const val PASS=502;const val NEXT=503;const val KYUSHU=504;const val RIICHI=1000
        const val CHI=20_000;const val PON=40_000;const val OPEN_KAN=60_000;const val ANKAN=61_000;const val ADDED_KAN=62_000
        val WINDS=listOf("東","南","西","北")
        fun label(tile:Int,red:Boolean=true):String{val t=tile/4;return if(t>=27)listOf("東","南","西","北","白","發","中")[t-27]else (if(red&&MahjongHand.red(tile))"赤"else"")+"${t%9+1}"+listOf("萬","筒","索")[t/9]}
        val def=GameDef("mahjong",{Mahjong(it.int("length",4).coerceIn(1,8),it.str("red","true")=="true",it.str("openTanyao","true")=="true",it.str("ronMode","head")=="multi",it.str("doubleYakuman","false")=="true",it.str("tobi","true")=="true",it.str("agariYame","true")=="true")},MahjongCpu.brain,false,{4},PASS)
    }
}
