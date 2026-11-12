package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

data class KlondikeBoard(val stock:List<Int>,val waste:List<Int>,val piles:List<List<Int>>,val open:List<Int>,
    val foundations:List<List<Int>>,val passes:Int=0,val moves:Int=0,val gaveUp:Boolean=false,val lastMove:Int=-1)
data class SolitaireState(val boards:List<KlondikeBoard>,val winner:Int=-1,val over:Boolean=false,val lastMover:Int=-1)
class Solitaire(val players:Int=1,val draw:Int=1,val maxPasses:Int=0):ConcurrentRules<SolitaireState>{
    override val playerCount=players
    override fun actor(move:Int)=move/SEAT
    override fun initial(rng:Random):SolitaireState{
        val deck=Cards.deck(rng.nextLong()).toList();var pos=0
        val piles=List(7){n->List(n+1){deck[pos++]}}
        val b=KlondikeBoard(deck.drop(pos),emptyList(),piles,List(7){1},List(4){emptyList()})
        return SolitaireState(List(players){b.copy()})
    }
    override fun toMove(s:SolitaireState)=if(s.over)-1 else s.boards.indices.firstOrNull{!s.boards[it].gaveUp}?:-1
    override fun legalMovesFor(s:SolitaireState,seat:Int):IntArray{
        if(s.over||seat !in s.boards.indices)return intArrayOf()
        val b=s.boards[seat];if(b.gaveUp)return intArrayOf()
        val out=mutableListOf(seat*SEAT+GIVE_UP)
        if(b.stock.isNotEmpty()||(b.waste.isNotEmpty()&&(maxPasses==0||b.passes<maxPasses)))out+=seat*SEAT+DRAW
        fun source(src:Int)=when(src){1->b.waste.takeLast(1);in 2..5->b.foundations[src-2].takeLast(1);else->b.piles[src-6].takeLast(b.open[src-6])}
        for(src in 1..12){val cards=source(src)
            for(n in 1..cards.size){val moving=cards.takeLast(n);val first=moving.first()
                if(n==1&&src !in 2..5){val suit=Cards.suit(first);val target=b.foundations[suit].lastOrNull();val wanted=if(target==null)14 else if(Cards.rank(target)==14)2 else Cards.rank(target)+1
                    if(Cards.rank(first)==wanted&&b.foundations[suit].size<13)out+=encode(seat,src,n,2+suit)
                }
                for(dest in 6..12){if(dest==src)continue;val top=b.piles[dest-6].lastOrNull()
                    if((top==null&&Cards.rank(first)==13)||(top!=null&&Cards.isRed(top)!=Cards.isRed(first)&&(if(Cards.rank(top)==14)1 else Cards.rank(top))==(if(Cards.rank(first)==14)1 else Cards.rank(first))+1))out+=encode(seat,src,n,dest)
                }
            }
        }
        return out.toIntArray()
    }
    override fun play(s:SolitaireState,m:Int):SolitaireState{
        val seat=actor(m);val code=m%SEAT;val b=s.boards[seat]
        val next=when(code){
            GIVE_UP->b.copy(gaveUp=true,moves=b.moves+1)
            DRAW->if(b.stock.isNotEmpty()){val n=minOf(draw,b.stock.size);b.copy(stock=b.stock.drop(n),waste=b.waste+b.stock.take(n),moves=b.moves+1)}else b.copy(stock=b.waste,waste=emptyList(),passes=b.passes+1,moves=b.moves+1)
            else->{val src=code/10000;val count=(code%10000)/100;val dest=code%100
                val piles=b.piles.map{it.toMutableList()};val open=b.open.toMutableList();val foundations=b.foundations.map{it.toMutableList()};var waste=b.waste
                val moving=when(src){1->listOf(waste.last()).also{waste=waste.dropLast(1)};in 2..5->listOf(foundations[src-2].removeAt(foundations[src-2].lastIndex));else->piles[src-6].takeLast(count).also{repeat(count){piles[src-6].removeAt(piles[src-6].lastIndex)};open[src-6]=(open[src-6]-count).coerceAtLeast(if(piles[src-6].isEmpty())0 else 1)}}
                if(dest in 2..5)foundations[dest-2].addAll(moving)else{piles[dest-6].addAll(moving);open[dest-6]+=count}
                b.copy(waste=waste,piles=piles,open=open,foundations=foundations,moves=b.moves+1)
            }
        }
        val boards=s.boards.toMutableList();boards[seat]=next.copy(lastMove=code)
        val won=next.foundations.sumOf{it.size}==52
        return SolitaireState(boards,if(won)seat else -1,won||boards.all{it.gaveUp},seat)
    }
    override fun outcome(s:SolitaireState)=if(!s.over)null else Outcome(s.winner,if(s.winner>=0)"組札をすべて完成しました" else if(players==1)"この配札を終了しました" else "全員が終了しました")
    override fun scores(s:SolitaireState)=s.boards.map{it.foundations.sumOf{row->row.size}}.toIntArray()
    companion object{
        const val SEAT=1_000_000;const val DRAW=0;const val GIVE_UP=1
        fun encode(seat:Int,src:Int,count:Int,dest:Int)=seat*SEAT+src*10000+count*100+dest
        val brain=Brain<SolitaireState>{r,s,seat,lv,rng,_->
            val g=r as Solitaire;val legal=g.legalMovesFor(s,seat);val b=s.boards[seat]
            val moves=legal.filter{m->
                val code=m%SEAT
                if(code<=1)false else {
                    val src=code/10000;val count=code%10000/100;val dest=code%100
                    val reverse=b.lastMove>1&&b.lastMove/10000==dest&&b.lastMove%100==src
                    val emptyShuffle=src>=6&&dest>=6&&b.piles[dest-6].isEmpty()&&count==b.piles[src-6].size
                    !reverse&&!emptyShuffle&&src !in 2..5
                }
            }
            when{b.moves>300->seat*SEAT+GIVE_UP
                lv==Level.EASY&&moves.isNotEmpty()->moves.random(rng)
                moves.isNotEmpty()->moves.maxBy{m->val code=m%SEAT;val src=code/10000;val count=code%10000/100;val dest=code%100
                    (if(dest in 2..5)100 else 0)+(if(src>=6&&count==b.open[src-6]&&b.piles[src-6].size>count)80 else 0)+(if(src in 2..5)-150 else 0)+count+(if(lv==Level.HARD&&src>=6&&count==b.open[src-6])(b.piles[src-6].size-count)*8 else 0)
                }
                seat*SEAT+DRAW in legal && b.passes<3->seat*SEAT+DRAW
                else->seat*SEAT+GIVE_UP}
        }
        val def=GameDef("solitaire",{Solitaire(it.int("players",1).coerceIn(1,6),it.int("draw",1).coerceIn(1,3),it.int("passes",0))},brain,false,{it.int("players",1).coerceIn(1,6)})
    }
}
