package jp.yonekou.asobi26.core.games

/** type=0順子、1刻子。typeは萬子1〜9、筒子、索子、東南西北白發中の0〜33。 */
data class MjGroup(val tile:Int,val sequence:Boolean,val open:Boolean=false,val kan:Boolean=false)
data class MjMeld(val kind:Int,val tiles:List<Int>,val from:Int=-1) {
    val open:Boolean get()=kind!=2
    val group:MjGroup get()=MjGroup(tiles.minOf{it/4},kind==0,open,kind>=2)
}
data class MjContext(val seatWind:Int=27,val roundWind:Int=27,val tsumo:Boolean=false,val riichi:Int=0,
    val ippatsu:Boolean=false,val rinshan:Boolean=false,val chankan:Boolean=false,val lastTile:Boolean=false,
    val firstTsumo:Boolean=false,val dora:List<Int> = emptyList(),val ura:List<Int> = emptyList(),val red:Boolean=true,
    val openTanyao:Boolean=true,val doubleYakuman:Boolean=false)
data class MjScore(val yaku:List<Pair<String,Int>>,val han:Int,val fu:Int,val base:Int,val yakuman:Int=0) {
    val description:String get()=if(yakuman>0)"${if(yakuman>1)"${yakuman}倍"else""}役満"else"${han}翻 ${fu}符"
    fun ron(dealer:Boolean)=round100(base*if(dealer)6 else 4)
    companion object { fun round100(value:Int)=((value+99)/100)*100 }
}
object MahjongHand {
    val terminals=(0..33).filter{it>=27||it%9==0||it%9==8}.toSet()
    private data class Shape(val pair:Int,val groups:List<MjGroup>,val special:Int=0)
    fun counts(tiles:List<Int>):IntArray=IntArray(34).also{a->tiles.forEach{if(it in 0..135)a[it/4]++}}
    private fun shapes(c0:IntArray,melds:Int):List<Shape>{
        if(c0.any{it>4}||c0.sum()!=14-melds*3)return emptyList()
        val result=mutableListOf<Shape>()
        if(melds==0){
            if(c0.count{it==2}==7)result+=Shape(-1,emptyList(),1)
            if(terminals.all{c0[it]>=1}&&(0..33).all{it in terminals||c0[it]==0})result+=Shape(-1,emptyList(),2)
        }
        for(pair in 0..33)if(c0[pair]>=2){
            val c=c0.copyOf();c[pair]-=2
            fun group(acc:List<MjGroup>){
                val first=c.indexOfFirst{it>0}
                if(first<0){if(acc.size==4-melds)result+=Shape(pair,acc);return}
                if(acc.size>=4-melds)return
                if(c[first]>=3){c[first]-=3;group(acc+MjGroup(first,false));c[first]+=3}
                if(first<27&&first%9<=6&&c[first+1]>0&&c[first+2]>0){c[first]--;c[first+1]--;c[first+2]--;group(acc+MjGroup(first,true));c[first]++;c[first+1]++;c[first+2]++}
            }
            group(emptyList())
        }
        return result
    }
    fun winning(tiles:List<Int>,melds:Int=0)=shapes(counts(tiles),melds).isNotEmpty()
    fun waits(tiles:List<Int>,melds:Int=0):Set<Int>{
        val c=counts(tiles);if(c.sum()!=13-melds*3)return emptySet()
        return (0..33).filter{type->if(c[type]>=4)false else{c[type]++;val win=shapes(c,melds).isNotEmpty();c[type]--;win}}.toSet()
    }
    fun kokushi(tiles:List<Int>)=shapes(counts(tiles),0).any{it.special==2}
    fun doraAfter(indicator:Int):Int=when(indicator){in 0..26->indicator/9*9+(indicator%9+1)%9;in 27..30->27+(indicator-27+1)%4;else->31+(indicator-31+1)%3}
    fun red(tile:Int)=tile in setOf(16,52,88)
    fun evaluate(hand:List<Int>,melds:List<MjMeld>,winningTile:Int,ctx:MjContext):MjScore?{
        val c=counts(hand);val physical=hand+melds.flatMap{it.tiles};if(counts(physical).any{it>4})return null
        val closed=melds.none{it.open};val all=physical.map{it/4};val win=winningTile/4
        val scores=mutableListOf<MjScore>()
        for(shape in shapes(c,melds.size)){
            val placements=if(shape.special>0)listOf(-1)else buildList{if(shape.pair==win)add(-1);shape.groups.forEachIndexed{i,g->if((g.sequence&&win in g.tile..g.tile+2)||(!g.sequence&&win==g.tile))add(i)}}
            for(place in placements){
                val groups=shape.groups+melds.map{it.group};val sequences=groups.filter{it.sequence};val trips=groups.filter{!it.sequence}
                val yakuman=mutableListOf<Pair<String,Int>>()
                fun big(name:String,double:Boolean=false){yakuman+=name to if(double&&ctx.doubleYakuman)26 else 13}
                if(shape.special==2){val before=c.copyOf();before[win]--;big("国士無双",terminals.all{before[it]==1})}
                if(all.all{it>=27})big("字一色")
                if(all.all{it<27&&(it%9==0||it%9==8)})big("清老頭")
                if(all.all{it in setOf(19,20,21,23,25,32)})big("緑一色")
                if(trips.count{it.tile>=31}==3)big("大三元")
                val windTrips=trips.count{it.tile in 27..30}
                if(windTrips==4)big("大四喜",true)else if(windTrips==3&&shape.pair in 27..30)big("小四喜")
                val concealedTrips=shape.groups.count{!it.sequence}-(if(!ctx.tsumo&&place>=0&&!shape.groups[place].sequence)1 else 0)+melds.count{it.kind==2}
                if(concealedTrips==4)big("四暗刻",place==-1)
                if(groups.count{it.kan}==4)big("四槓子")
                if(melds.isEmpty()&&all.all{it<27}&&all.map{it/9}.toSet().size==1){
                    val base=all.first()/9*9;val required=intArrayOf(3,1,1,1,1,1,1,1,3)
                    if((0..8).all{c[base+it]>=required[it]}){val before=c.copyOf();before[win]--;big("九蓮宝燈",(0..8).all{before[base+it]==required[it]})}
                }
                if(ctx.firstTsumo&&ctx.tsumo)big(if(ctx.seatWind==27)"天和"else"地和")
                if(yakuman.isNotEmpty()){val times=yakuman.sumOf{it.second}/13;scores+=MjScore(yakuman,13*times,0,8000*times,times);continue}
                val roles=mutableListOf<Pair<String,Int>>()
                fun role(name:String,han:Int){roles+=name to han}
                if(ctx.riichi>0&&closed)role(if(ctx.riichi==2)"ダブル立直"else"立直",ctx.riichi)
                if(ctx.riichi>0&&ctx.ippatsu)role("一発",1)
                if(ctx.tsumo&&closed)role("門前清自摸和",1)
                if(ctx.rinshan)role("嶺上開花",1)
                if(ctx.chankan)role("槍槓",1)
                if(ctx.lastTile)role(if(ctx.tsumo)"海底摸月"else"河底撈魚",1)
                if(all.none{it in terminals}&&(closed||ctx.openTanyao))role("断幺九",1)
                val hasHonors=all.any{it>=27};val suits=all.filter{it<27}.map{it/9}.toSet()
                if(suits.size==1)role(if(hasHonors)"混一色"else"清一色",if(hasHonors){if(closed)3 else 2}else if(closed)6 else 5)
                if(all.all{it in terminals})role("混老頭",2)
                var pinfu=false;var waitFu=0
                if(shape.special==1)role("七対子",2)
                if(shape.special==0){
                    val valuePair=(if(shape.pair>=31)2 else 0)+(if(shape.pair==ctx.seatWind)2 else 0)+(if(shape.pair==ctx.roundWind)2 else 0)
                    if(place==-1)waitFu=2 else {
                        val group=shape.groups[place]
                        if(group.sequence){val pos=win-group.tile;if(pos==1||(pos==2&&group.tile%9==0)||(pos==0&&group.tile%9==6))waitFu=2}
                    }
                    pinfu=closed&&sequences.size==4&&valuePair==0&&waitFu==0
                    if(pinfu)role("平和",1)
                    for(g in trips){if(g.tile>=31)role(listOf("白","發","中")[g.tile-31],1);if(g.tile==ctx.seatWind)role("自風牌",1);if(g.tile==ctx.roundWind)role("場風牌",1)}
                    if(trips.size==4)role("対々和",2)
                    if(concealedTrips>=3)role("三暗刻",2)
                    if(groups.count{it.kan}>=3)role("三槓子",2)
                    if(trips.count{it.tile>=31}==2&&shape.pair>=31)role("小三元",2)
                    if((0..8).any{rank->(0..2).all{suit->trips.any{it.tile==suit*9+rank}}})role("三色同刻",2)
                    if((0..6).any{rank->(0..2).all{suit->sequences.any{it.tile==suit*9+rank}}})role("三色同順",if(closed)2 else 1)
                    if((0..2).any{suit->listOf(0,3,6).all{rank->sequences.any{it.tile==suit*9+rank}}})role("一気通貫",if(closed)2 else 1)
                    val pairs=sequences.groupingBy{it.tile}.eachCount().values.sumOf{it/2}
                    if(closed&&pairs>=2)role("二盃口",3)else if(closed&&pairs>=1)role("一盃口",1)
                    val outside=shape.pair in terminals&&groups.all{if(it.sequence)it.tile%9==0||it.tile%9==6 else it.tile in terminals}
                    if(outside&&sequences.isNotEmpty())role(if(hasHonors)"混全帯幺九"else"純全帯幺九",if(hasHonors){if(closed)2 else 1}else if(closed)3 else 2)
                }
                if(roles.isEmpty())continue // ドラだけでは和了できない
                val dora=all.sumOf{type->ctx.dora.count{it==type}}
                val ura=if(ctx.riichi>0)all.sumOf{type->ctx.ura.count{it==type}}else 0
                val red=if(ctx.red)physical.count{red(it)}else 0
                if(dora>0)role("ドラ",dora);if(ura>0)role("裏ドラ",ura);if(red>0)role("赤ドラ",red)
                val han=roles.sumOf{it.second}
                var fu=if(shape.special==1)25 else if(pinfu&&ctx.tsumo)20 else {
                    var f=20+(if(ctx.tsumo)2 else if(closed)10 else 0)+waitFu
                    f+=(if(shape.pair>=31)2 else 0)+(if(shape.pair==ctx.seatWind)2 else 0)+(if(shape.pair==ctx.roundWind)2 else 0)
                    groups.forEachIndexed{i,g->if(!g.sequence){
                        val opened=g.open||(!ctx.tsumo&&i==place&&i<shape.groups.size)
                        f+=(if(opened)2 else 4)*(if(g.tile in terminals)2 else 1)*(if(g.kan)4 else 1)
                    }}
                    if(f==20)30 else ((f+9)/10)*10
                }
                val base=when{han>=13->8000;han>=11->6000;han>=8->4000;han>=6->3000;han>=5->2000;else->minOf(2000,fu*(1 shl (han+2)))}
                scores+=MjScore(roles,han,fu,base)
            }
        }
        return scores.maxWithOrNull(compareBy<MjScore>{it.base}.thenBy{it.han}.thenBy{it.fu})
    }
}
