package jp.yonekou.asobi26.core.games

import jp.yonekou.asobi26.core.*
import kotlin.random.Random

/**
 * 色4×25枚＋ワイルド8枚。手の値は札番号ではなく手札の位置。
 * pending: 重ね出しで次の人が引く枚数(重ね出しが「あり」の時だけ使う)。
 * swapping: 7を出して、手札を取りかえる相手を選んでいる所。
 * forgot: 直前の手で、宣言せずに残り1枚になった席(画面のカットイン用)。miscall: 直前の手で、宣言をまちがえた席。
 */
data class OhNoState(val hands: List<List<Int>>, val stock: List<Int>, val discard: List<Int>, val turn: Int,
    val direction: Int = 1, val color: Int, val declared: Int = -1, val drawn: Int = -1,
    val winner: Int = -1, val lastMover: Int = -1, val lastAction: String = "",
    val pending: Int = 0, val swapping: Boolean = false, val forgot: Int = -1, val miscall: Int = -1)

/** 設定(ローカルルール)。初期値は公式に近い遊び方。 */
data class OhNoRules(
    /** 言い忘れ・言いまちがいで引く枚数 */
    val penalty: Int = 2,
    /** +2・+4 の重ね出し */
    val stack: Boolean = false,
    /** 出せるまで引く */
    val drawUntil: Boolean = false,
    /** 記号の札(スキップ・リバース・+2・ワイルド・+4)で上がれない */
    val noActionFinish: Boolean = false,
    /** 7で手札交換・0で手札回し */
    val sevenZero: Boolean = false,
    /** +4 はいつでも出せる */
    val wildAnytime: Boolean = false,
) {
    companion object {
        fun of(o: GameOptions) = OhNoRules(
            o.int("penalty", 2).coerceIn(0, 4), o.str("stack", "off") == "on", o.str("drawUntil", "off") == "on",
            o.str("noActionFinish", "off") == "on", o.str("sevenZero", "off") == "on", o.str("wildAnytime", "off") == "on",
        )
    }
}

class OhNo(val players: Int, val opt: OhNoRules = OhNoRules()) : Rules<OhNoState> {
    override val playerCount = players
    override fun initial(rng: Random): OhNoState {
        val deck=(0..107).shuffled(rng).toMutableList()
        val hands=List(players){List(7){deck.removeAt(0)}}
        val first=deck.first{value(it)<10};deck.remove(first)
        return OhNoState(hands,deck,listOf(first),0,color=color(first))
    }
    override fun toMove(s: OhNoState)=if(s.winner>=0)-1 else s.turn

    fun playable(s: OhNoState, card: Int): Boolean {
        val v=value(card)
        val hand=s.hands[s.turn]
        if(opt.noActionFinish&&hand.size==1&&v>=10)return false
        if(s.pending>0){
            // 重ね出し: +2には+2、+4には+4だけ
            return v==value(s.discard.last())&&v>=12
        }
        if(v==14&&!opt.wildAnytime&&hand.any{color(it)==s.color}) return false
        return v>=13 || color(card)==s.color || v==value(s.discard.last())
    }

    /** 宣言が正しい時(手札2枚で、まだ宣言していない) */
    fun canDeclare(s: OhNoState)=s.hands[s.turn].size==2&&s.declared!=s.turn&&!s.swapping

    override fun legalMoves(s: OhNoState): IntArray {
        if(s.winner>=0)return intArrayOf()
        if(s.swapping)return (0 until players).filter{it!=s.turn}.map{SWAP+it}.toIntArray()
        val out=mutableListOf<Int>()
        s.hands[s.turn].forEachIndexed{i,c->if((s.drawn<0||i==s.drawn)&&playable(s,c)) {
            if(value(c)>=13)for(col in 0..3)out+=PLAY+i*4+col else out+=PLAY+i*4
        }}
        if(s.drawn<0)out+=DRAW else out+=PASS
        // Oh, No! はいつでも押せる(正しくない時は言いまちがいのペナルティ)
        out+=DECLARE
        return out.toIntArray()
    }

    override fun play(s: OhNoState,m: Int): OhNoState {
        val hands=s.hands.map{it.toMutableList()};val stock=s.stock.toMutableList();val discard=s.discard.toMutableList()
        fun draw(p:Int,n:Int):Int {
            var got=0
            repeat(n){
                if(stock.isEmpty()&&discard.size>1){val top=discard.removeAt(discard.lastIndex);stock.addAll(discard.shuffled(Random(discard.fold(17L){a,c->a*31+c})));discard.clear();discard+=top}
                if(stock.isNotEmpty()){hands[p]+=stock.removeAt(0);got++}
            }
            return got
        }
        fun next(step:Int=1,dir:Int=s.direction)=(s.turn+dir*step+players*3)%players
        val base=s.copy(forgot=-1,miscall=-1,lastMover=s.turn)
        if(m==DECLARE){
            if(canDeclare(s))return base.copy(declared=s.turn,lastAction="Oh, No!")
            val got=draw(s.turn,opt.penalty)
            return base.copy(hands=hands,stock=stock,discard=discard,miscall=s.turn,
                drawn=if(s.drawn>=0)s.drawn else -1,lastAction=if(got>0)"言いまちがい！ ${got}枚引く" else "言いまちがい")
        }
        if(m in SWAP until SWAP+players){
            val o=m-SWAP;val mine=hands[s.turn].toList();hands[s.turn].clear();hands[s.turn].addAll(hands[o]);hands[o].clear();hands[o].addAll(mine)
            return base.copy(hands=hands,swapping=false,turn=next(),declared=-1,drawn=-1,lastAction="手札を取りかえる")
        }
        if(m==DRAW){
            if(s.pending>0){
                val got=draw(s.turn,s.pending)
                return base.copy(hands=hands,stock=stock,discard=discard,pending=0,turn=next(),declared=-1,drawn=-1,lastAction="${got}枚引く")
            }
            val old=hands[s.turn].size
            if(opt.drawUntil){
                var got=0
                while(true){
                    if(draw(s.turn,1)==0)break
                    got++
                    if(playable(s.copy(hands=hands),hands[s.turn].last()))break
                }
                return if(got>0)base.copy(hands=hands,stock=stock,discard=discard,drawn=hands[s.turn].lastIndex,lastAction="${got}枚引く")
                else base.copy(turn=next(),declared=-1,drawn=-1,lastAction="引ける札なし")
            }
            draw(s.turn,1)
            return if(hands[s.turn].size>old)base.copy(hands=hands,stock=stock,discard=discard,drawn=old,lastAction="1枚引く")
            else base.copy(turn=next(),declared=-1,drawn=-1,lastAction="引ける札なし")
        }
        if(m==PASS)return base.copy(turn=next(),drawn=-1,declared=-1,lastAction="パス")
        val index=(m-PLAY)/4;val card=hands[s.turn].removeAt(index);discard+=card
        val v=value(card);val dir=if(v==11)-s.direction else s.direction
        val nextSeat=(s.turn+dir+players)%players
        var forgot=-1
        if(hands[s.turn].size==1&&s.declared!=s.turn){draw(s.turn,opt.penalty);forgot=s.turn}
        val winner=if(hands[s.turn].isEmpty())s.turn else -1
        val newColor=if(v>=13)(m-PLAY)%4 else color(card)
        var pending=s.pending
        var skipped=v==10||(v==11&&players==2)
        if(v==12||v==14){
            val n=if(v==12)2 else 4
            if(opt.stack){pending+=n}else{draw(nextSeat,n);skipped=true}
        }
        if(winner<0&&opt.sevenZero&&v==7)
            return OhNoState(hands,stock,discard,s.turn,dir,newColor,winner=-1,lastMover=s.turn,lastAction=label(card),pending=pending,swapping=true,forgot=forgot)
        if(winner<0&&opt.sevenZero&&v==0){
            // 0: 全員が、進む向きの次の人へ手札を渡す
            val copy=hands.map{it.toList()}
            for(p in 0 until players){val to=(p+dir+players)%players;hands[to].clear();hands[to].addAll(copy[p])}
        }
        return OhNoState(hands,stock,discard,(s.turn+dir*(if(skipped)2 else 1)+players*3)%players,dir,
            newColor,winner=winner,lastMover=s.turn,lastAction=label(card),pending=pending,forgot=forgot)
    }
    override fun outcome(s: OhNoState)=s.winner.takeIf{it>=0}?.let{Outcome(it,"手札をすべて出しました")}
    override fun scores(s: OhNoState)=IntArray(players){-s.hands[it].sumOf(::points)}
    companion object {
        const val DRAW=0;const val PASS=1;const val DECLARE=2;const val SWAP=50;const val PLAY=100
        fun color(c:Int)=if(c>=100)4 else c/25
        fun value(c:Int):Int {if(c>=100)return if(c<104)13 else 14;val k=c%25;return if(k==0)0 else (k+1)/2}
        val colors=listOf("赤","黄","緑","青")
        fun label(c:Int):String {val v=value(c);return (if(v<13)colors[color(c)]+" " else "")+when(v){10->"スキップ";11->"リバース";12->"+2";13->"ワイルド";14->"+4";else->v.toString()}}
        fun points(c:Int)=when(value(c)){in 0..9->value(c);in 10..12->20;else->50}
        val brain=Brain<OhNoState>{r0,s,_,lv,rng,_->val r=r0 as OhNo;val legal=r.legalMoves(s)
            val hand=s.hands[s.turn]
            when {
                s.swapping -> legal.minBy{if(lv==Level.EASY)rng.nextInt(10) else s.hands[it-SWAP].size}
                // 宣言: 初級はときどき、中級はまれに言い忘れる
                r.canDeclare(s)&&legal.any{it>=PLAY}&&rng.nextDouble()>=when(lv){Level.EASY->0.3;Level.NORMAL->0.08;else->0.0} -> DECLARE
                else -> {
                    val plays=legal.filter{it>=PLAY}
                    if(plays.isEmpty())legal.first{it!=DECLARE} else if(lv==Level.EASY)plays.random(rng) else plays.maxBy{m->
                        val card=hand[(m-PLAY)/4]
                        val targetColor=if(value(card)>=13)(m-PLAY)%4 else color(card)
                        val next=(s.turn+s.direction+s.hands.size*2)%s.hands.size
                        points(card)*10+hand.count{color(it)==targetColor}*3+
                            if(lv==Level.HARD){(if(s.hands[next].size<=2&&value(card) in 10..12)200 else 0)-(if(value(card)>=13&&plays.any{value(hand[(it-PLAY)/4])<13})160 else 0)}else 0
                    }
                }
            }}
        val def=GameDef("uno",{OhNo(it.int("players",4).coerceIn(2,6),OhNoRules.of(it))},brain,false,{it.int("players",4).coerceIn(2,6)})
    }
}
