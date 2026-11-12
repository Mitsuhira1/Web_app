package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

/** 向聴数は牌の種類と副露数だけから計算。CPUは他家の手牌・山・裏ドラを参照しない。 */
object MahjongDistance {
    private val cache=HashMap<String,Int>()
    fun shanten(tiles:List<Int>,melds:Int=0):Int {
        val c=MahjongHand.counts(tiles);val key=c.joinToString("")+":"+melds
        synchronized(cache){cache[key]?.let{return it}}
        var best=8-2*melds
        if(melds==0){
            best=minOf(best,6-c.count{it>=2}+(7-c.count{it>0}).coerceAtLeast(0))
            val kinds=MahjongHand.terminals.count{c[it]>0};val pair=MahjongHand.terminals.any{c[it]>=2}
            best=minOf(best,13-kinds-if(pair)1 else 0)
        }
        val visited=HashSet<String>()
        fun walk(complete:Int,blocks:Int,pair:Boolean){
            if(complete+melds>4)return
            val first=c.indexOfFirst{it>0}
            if(first<0){best=minOf(best,8-2*(melds+complete)-minOf(blocks,4-melds-complete)-if(pair)1 else 0);return}
            val state=c.joinToString("")+":"+complete+":"+blocks+":"+pair
            if(!visited.add(state))return
            if(c[first]>=3){c[first]-=3;walk(complete+1,blocks,pair);c[first]+=3}
            if(first<27&&first%9<=6&&c[first+1]>0&&c[first+2]>0){c[first]--;c[first+1]--;c[first+2]--;walk(complete+1,blocks,pair);c[first]++;c[first+1]++;c[first+2]++}
            if(c[first]>=2){c[first]-=2;if(!pair)walk(complete,blocks,true);if(blocks<4-melds)walk(complete,blocks+1,pair);c[first]+=2}
            if(blocks<4-melds&&first<27){
                if(first%9<=7&&c[first+1]>0){c[first]--;c[first+1]--;walk(complete,blocks+1,pair);c[first]++;c[first+1]++}
                if(first%9<=6&&c[first+2]>0){c[first]--;c[first+2]--;walk(complete,blocks+1,pair);c[first]++;c[first+2]++}
            }
            c[first]--;walk(complete,blocks,pair);c[first]++
        }
        walk(0,0,false)
        synchronized(cache){if(cache.size>8192)cache.clear();cache[key]=best}
        return best
    }
}
object MahjongCpu {
    private fun visible(s:MahjongState,seat:Int,g:Mahjong):IntArray {
        val cards=s.hands[seat]+s.melds.flatten().flatMap{it.tiles}+s.rivers.flatten().filter{it !in s.claimed}+g.indicators(s)
        return MahjongHand.counts(cards.distinct())
    }
    private fun connection(hand:List<Int>,tile:Int):Int{
        val t=tile/4;val c=MahjongHand.counts(hand)
        var value=(c[t]-1)*6
        if(t<27)for(d in -2..2)if(d!=0&&t+d in 0..26&&(t+d)/9==t/9)value+=c[t+d]*(if(kotlin.math.abs(d)==1)3 else 1)
        return value
    }
    private fun danger(s:MahjongState,seat:Int,type:Int,seen:IntArray):Int {
        var risk=0
        for(p in s.riichi.keys.filter{it!=seat}){
            val river=s.rivers[p].map{it/4}.toSet()
            if(type in river)continue
            var r=if(type>=27)5-seen[type] else 8-seen[type]
            if(type<27&&listOf(type-3,type+3).any{it in 0..26&&it/9==type/9&&it in river})r-=3
            risk+=r.coerceAtLeast(1)
        }
        return risk
    }
    private fun discard(g:Mahjong,s:MahjongState,seat:Int,level:Level,rng:Random,budget:Budget,legal:IntArray):Int {
        val discards=legal.filter{it in 0..135};if(discards.size==1)return discards.first()
        if(level==Level.EASY&&rng.nextInt(4)==0)return discards.random(rng)
        val hand=s.hands[seat];val meldCount=s.melds[seat].size;val seen=visible(s,seat,g)
        val dora=g.indicators(s).map{MahjongHand.doraAfter(it/4)}
        data class Choice(val tile:Int,val distance:Int,val shape:Int,val risk:Int)
        val choices=mutableListOf<Choice>()
        for(tile in discards.distinctBy{it/4 to (g.red&&MahjongHand.red(it))}){
            if(choices.isNotEmpty()&&budget.over())break
            val after=hand-tile;val distance=MahjongDistance.shanten(after,meldCount)
            val shape=connection(hand,tile)+(if(tile/4 in dora)6 else 0)+(if(g.red&&MahjongHand.red(tile))5 else 0)
            choices+=Choice(tile,distance,shape,danger(s,seat,tile/4,seen))
        }
        var best=choices.minWith(compareBy<Choice>{it.distance}.thenBy{it.shape}.thenBy{it.risk})
        if(level==Level.HARD){
            if(best.distance>=2&&s.riichi.keys.any{it!=seat}){
                choices.filter{it.risk==0&&it.distance<=best.distance+1}.minByOrNull{it.shape}?.let{best=it}
            }else{
                var bestValue=Int.MIN_VALUE
                for(choice in choices.filter{it.distance<=best.distance+1}.sortedBy{it.distance}.take(5)){
                    val after=hand-choice.tile;var improving=0
                    if(!budget.over())for(type in 0..33){
                        if(budget.over())break
                        val left=(4-seen[type]).coerceAtLeast(0)
                        if(left>0&&MahjongDistance.shanten(after+type*4,meldCount)<choice.distance)improving+=left
                    }
                    val value=-choice.distance*10000+improving*20-choice.shape*5-choice.risk*(if(choice.distance>0)180 else 20)
                    if(value>bestValue){bestValue=value;best=choice}
                }
            }
        }
        return if(Mahjong.RIICHI+best.tile in legal && (level!=Level.EASY||rng.nextBoolean()))Mahjong.RIICHI+best.tile else best.tile
    }
    private fun call(g:Mahjong,s:MahjongState,seat:Int,level:Level,budget:Budget,legal:IntArray):Int {
        if(Mahjong.RON in legal)return Mahjong.RON
        if(level==Level.EASY)return Mahjong.PASS
        val hand=s.hands[seat];val old=MahjongDistance.shanten(hand,s.melds[seat].size)
        var best=Mahjong.PASS;var bestDistance=old
        for(code in legal.filter{it>=Mahjong.CHI}){
            if(budget.over())break
            if(code in Mahjong.OPEN_KAN..Mahjong.OPEN_KAN+33){if(s.riichi.isEmpty()&&old<=1&&((code-Mahjong.OPEN_KAN)>=31||(code-Mahjong.OPEN_KAN)==27+(seat-s.dealer+4)%4||(code-Mahjong.OPEN_KAN)==27+s.round/4))best=code;continue}
            val base=if(code>=Mahjong.PON)Mahjong.PON else Mahjong.CHI
            val a=(code-base)/136;val b=(code-base)%136;val remaining=hand-a-b
            val meld=MjMeld(if(base==Mahjong.PON)1 else 0,listOf(a,b,s.lastDiscard).sorted(),s.discarder)
            val melds=s.melds[seat]+meld;val all=remaining+melds.flatMap{it.tiles}
            val yakuhai=melds.any{it.kind!=0&&(it.tiles.first()/4>=31||it.tiles.first()/4==27+(seat-s.dealer+4)%4||it.tiles.first()/4==27+s.round/4)}
            val tanyao=g.openTanyao&&all.none{it/4 in MahjongHand.terminals}
            val flush=all.map{it/4}.filter{it<27}.map{it/9}.toSet().size==1
            if(!yakuhai&&!tanyao&&!flush)continue
            val distance=remaining.distinctBy{it/4}.minOfOrNull{MahjongDistance.shanten(remaining-it,melds.size)}?:8
            if(distance<bestDistance){bestDistance=distance;best=code}
        }
        return best
    }
    val brain=Brain<MahjongState>{rules,s,seat,level,rng,budget->
        val g=rules as Mahjong;val legal=g.legalMoves(s)
        when{
            Mahjong.TSUMO in legal->Mahjong.TSUMO
            Mahjong.RON in legal->Mahjong.RON
            Mahjong.NEXT in legal->Mahjong.NEXT
            s.phase==1->call(g,s,seat,level,budget,legal)
            Mahjong.KYUSHU in legal&&s.hands[seat].map{it/4}.distinct().count{it in MahjongHand.terminals}<11->Mahjong.KYUSHU
            else->{
                val kan=legal.firstOrNull{it in Mahjong.ANKAN..Mahjong.ANKAN+33||it in Mahjong.ADDED_KAN..Mahjong.ADDED_KAN+135}
                if(kan!=null&&s.riichi.keys.none{it!=seat}&&level!=Level.EASY)kan
                else discard(g,s,seat,level,rng,budget,legal)
            }
        }
    }
}
