package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.*
import jp.yonekou.asobi26.core.games.*

private val tableText=Color(0xFFFFF6DE)
@OptIn(ExperimentalLayoutApi::class)
@Composable private fun CardsRow(cards:List<Int>,picked:Int=-1,enabled:Boolean=false,onPick:(Int)->Unit={}) {
    FlowRow(horizontalArrangement=Arrangement.spacedBy(5.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        cards.forEachIndexed { i,card -> PokerCard(card,picked==i,enabled){onPick(i)} }
    }
}
@Composable private fun PokerCard(card:Int,picked:Boolean=false,enabled:Boolean=false,onClick:()->Unit={}) {
    val tm=rememberTextMeasurer()
    Canvas(Modifier.size(48.dp,68.dp).semantics{contentDescription=if(card<0)"裏向きの札" else Cards.SUITS[Cards.suit(card)]+Cards.rankLabel(card);selected=picked}
        .clickable(enabled=enabled,onClick=onClick)) {
        if(card<0)cardBack(Offset.Zero,size.width) else playingCard(tm,Offset.Zero,size.width,card,highlight=picked)
    }
}
@Composable private fun OpponentRows(ses:Session<*>,me:Int,details:(Int)->String) {
    Column(verticalArrangement=Arrangement.spacedBy(7.dp)) {
        for(p in ses.seats.indices.filter{it!=me})Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            PlayerFace(null,ses.seats[p].human||ses.seats[p].remote,p,30.dp,ring=ses.toMove==p)
            Text("${seatLabel(ses,p)}　${details(p)}",color=tableText,fontSize=13.sp)
        }
    }
}
@Composable private fun NewTable(gap:Int=12,content:@Composable ColumnScope.()->Unit) {
    Column(Modifier.fillMaxSize().clip(RoundedCornerShape(18.dp)).background(Brush.verticalGradient(listOf(Mat.feltTop,Mat.feltBottom)))
        .verticalScroll(rememberScrollState()).padding(12.dp),verticalArrangement=Arrangement.spacedBy(gap.dp),content=content)
}
@Composable private fun Seen(version:Int) {val shown=LocalBoardShown.current;LaunchedEffect(version){shown(version)}}

@Composable fun HoldemBoard(ses:Session<HoldemState>,version:Int,enabled:Boolean,onMove:(Int)->Unit) {
    Seen(version)
    val s=ses.state;val me=viewSeat(ses);val g=ses.rules as Holdem;val legal=g.legalMoves(s).toSet()
    var raiseDialog by remember{mutableStateOf(false)}
    val raises=legal.filter{it>=Holdem.RAISE}.sorted()
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f).fillMaxWidth()){HoldemTable(ses,s,g,me)}
        CardButtonRow(listOf(CardBtn("降りる",enabled&&Holdem.FOLD in legal){onMove(Holdem.FOLD)},CardBtn("チェック／コール",enabled&&Holdem.CALL in legal,true){onMove(Holdem.CALL)}))
        CardButtonRow(listOf(CardBtn("レイズ",enabled&&raises.isNotEmpty()){raiseDialog=true},CardBtn("オールイン",enabled&&Holdem.ALL_IN in legal){onMove(Holdem.ALL_IN)},CardBtn("次の局",enabled&&Holdem.NEXT in legal,true){onMove(Holdem.NEXT)}))
    }
    var raiseAmount by remember(version){mutableStateOf(raises.firstOrNull()?.minus(Holdem.RAISE)?.toString().orEmpty())}
    val raiseMove=raiseAmount.toIntOrNull()?.let{it+Holdem.RAISE}
    if(raiseDialog)AlertDialog(onDismissRequest={raiseDialog=false},title={Text("レイズ")},text={
        Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
            Text("最小 ${raises.firstOrNull()?.minus(Holdem.RAISE) ?: 0} ～ 最大 ${raises.lastOrNull()?.minus(Holdem.RAISE) ?: 0}")
            OutlinedTextField(value=raiseAmount,onValueChange={raiseAmount=it.filter(Char::isDigit).take(6)},label={Text("この回の合計")},
                singleLine=true,keyboardOptions=androidx.compose.foundation.text.KeyboardOptions(keyboardType=androidx.compose.ui.text.input.KeyboardType.Number))
        }
    },confirmButton={TextButton(enabled=enabled&&raiseMove!=null&&raiseMove in legal,onClick={raiseDialog=false;raiseMove?.let(onMove)}){Text("レイズする")}},
        dismissButton={TextButton(onClick={raiseDialog=false}){Text("戻る")}},containerColor=LocalAsobi.current.surface)

}

@OptIn(ExperimentalLayoutApi::class)
@Composable fun HanafudaBoard(ses:Session<HanaState>,version:Int,enabled:Boolean,onMove:(Int)->Unit) {
    Seen(version)
    val s=ses.state;val me=viewSeat(ses);val legal=ses.rules.legalMoves(s).toSet()
    var selected by remember(ses,version){mutableIntStateOf(-1)};var target by remember(ses,version){mutableIntStateOf(-1)}
    var roles by remember{mutableStateOf(false)}
    var taken by remember{mutableStateOf(false)}
    val card=if(s.phase==1)s.drawn else selected
    val move=if(s.phase==1)Hanafuda.TAKE+target+1 else Hanafuda.PLAY+card*64+target+1
    val compatible=legal.filter{if(s.phase==1)it>=Hanafuda.TAKE else it>=Hanafuda.PLAY&&it<Hanafuda.TAKE&&(it-Hanafuda.PLAY)/64==card}
    val resolved=if(move in legal)move else compatible.singleOrNull()
    Column(Modifier.fillMaxSize()) {
        val rules=ses.rules as Hanafuda
        val opp=1-me
        // 合わせられる場札(選んだ手札・めくった札と同じ月)に黄色の枠
        val matchMonth=if(card>=0)card/4 else -1
        Column(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.verticalGradient(listOf(Mat.feltTop,Mat.feltBottom))).padding(8.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
            // 相手: 顔・名前・点数と、伏せた手札
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
                PlayerFace(null,ses.seats[opp].human||ses.seats[opp].remote,opp,30.dp,ring=s.turn==opp)
                Column{Text(seatLabel(ses,opp),color=tableText,fontSize=12.sp,fontWeight=FontWeight.Bold);Text("${s.points[opp]}点",color=Color(0xFFFFE9B0),fontSize=11.sp)}
                Canvas(Modifier.weight(1f).height(30.dp)){val w=minOf(size.height/1.62f,size.width/9f);for(i in 0 until s.hands[opp].size)hanaBack(Offset(i*w*1.08f,0f),w)}
            }
            HanaTally("相手の取り札",s.captured[opp])
            // 場: 左に山、右に場札(2段)
            Row(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x26000000)).padding(6.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                Column(horizontalAlignment=Alignment.CenterHorizontally){
                    Text("${s.round+1}月/${rules.rounds}か月",color=tableText,fontSize=10.sp)
                    Box{Canvas(Modifier.size(44.dp,72.dp)){hanaBack(Offset(4f,4f),size.width-6f);hanaBack(Offset.Zero,size.width-6f)}}
                    Text("山 ${s.stock.size}",color=tableText,fontSize=11.sp,fontWeight=FontWeight.Bold)
                    if(s.phase==1){Text("めくった札",color=Color(0xFFFFE9B0),fontSize=10.sp,modifier=Modifier.padding(top=4.dp));HanaCard(s.drawn,picked=true,width=44.dp)}
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxHeight()){
                    val cols=maxOf(4,(s.field.size+1)/2)
                    val cw=minOf((maxWidth-4.dp*(cols-1))/cols,(maxHeight-6.dp)/2/1.62f)
                    Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
                        for(row in s.field.chunked(cols))Row(horizontalArrangement=Arrangement.spacedBy(4.dp)){
                            for(c in row)HanaCard(c,target==c,enabled,width=cw,hint=matchMonth>=0&&c/4==matchMonth&&target!=c){target=c}
                        }
                    }
                }
            }
            HanaTally("あなたの取り札",s.captured[me],Hanafuda.yaku(s.captured[me],rules.viewing).joinToString("・"){"${it.first}${it.second}点"}.ifEmpty{"役なし"}+"　${s.points[me]}点")
            if(s.result.isNotBlank())Text(s.result,color=Color(0xFFFFCF63),fontSize=12.sp,maxLines=2)
            // 自分の手札(横に全部並べる。スクロールしない)
            BoxWithConstraints(Modifier.fillMaxWidth()){
                val n=s.hands[me].size.coerceAtLeast(1)
                val cw=minOf(48.dp,(maxWidth-4.dp*(n-1))/n)
                Row(horizontalArrangement=Arrangement.spacedBy(4.dp)){s.hands[me].forEach{c->HanaCard(c,selected==c,enabled&&s.phase==0,width=cw){selected=c}}}
            }
        }
        CardButtonRow(listOf(CardBtn("取る／置く",enabled&&s.phase in 0..1&&resolved!=null,true){resolved?.let(onMove)},CardBtn("こいこい",enabled&&s.phase==2){onMove(Hanafuda.KOI)},CardBtn("やめる",enabled&&s.phase==2){onMove(Hanafuda.STOP)}))
        CardButtonRow(listOf(CardBtn("次の月",enabled&&s.phase==3,true){onMove(Hanafuda.NEXT)},CardBtn("役",true){roles=true},CardBtn("取り札",true){taken=true}))
    }
    if(taken)AlertDialog(onDismissRequest={taken=false},title={Text("取り札")},text={
        Column(Modifier.heightIn(max=420.dp).verticalScroll(rememberScrollState())){
            for(p in listOf(me,1-me)){
                Text(seatLabel(ses,p),color=LocalAsobi.current.ink)
                FlowRow(horizontalArrangement=Arrangement.spacedBy(4.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){s.captured[p].forEach{HanaCard(it)}}
            }
        }
    },confirmButton={TextButton(onClick={taken=false}){Text("閉じる")}},containerColor=LocalAsobi.current.surface)
    if(roles)AlertDialog(onDismissRequest={roles=false},title={Text("こいこいの役")},text={Text("五光10／四光8／雨四光7／三光5\n猪鹿蝶5／赤短5／青短5\nタネ5枚・タン5枚で1点、以降1枚ごと+1\nカス10枚で1点、以降1枚ごと+1\n花見・月見で一杯 各5（設定による）\n7点以上・こいこい返しの倍率も設定で選択")},confirmButton={TextButton(onClick={roles=false}){Text("閉じる")}},containerColor=LocalAsobi.current.surface)
}
@Composable private fun HanaCard(card:Int,picked:Boolean=false,enabled:Boolean=false,width:androidx.compose.ui.unit.Dp=48.dp,hint:Boolean=false,onClick:()->Unit={}) {
    Canvas(Modifier.size(width,width*1.62f).semantics{contentDescription=Hanafuda.label(card);selected=picked}.clickable(enabled=enabled,onClick=onClick)){
        hanaCard(Offset(size.width*0.04f,size.width*0.04f),size.width*0.92f,card,picked,hint)
    }
}

/** 取り札を「光・タネ・短冊・カス」の数で1行に */
@Composable private fun HanaTally(label:String,cards:List<Int>,tail:String=""){
    val light=cards.count{it in Hanafuda.lights};val tane=cards.count{it in Hanafuda.animals};val tan=cards.count{it in Hanafuda.ribbons}
    val kasu=cards.size-light-tane-tan
    Text("$label　光$light　タネ$tane　短冊$tan　カス$kasu"+if(tail.isNotEmpty())"　→ $tail" else "",color=tableText,fontSize=11.sp,fontWeight=FontWeight.Bold,maxLines=1,
        overflow=androidx.compose.ui.text.style.TextOverflow.Ellipsis,modifier=Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Color(0x40000000)).padding(horizontal=8.dp,vertical=3.dp))
}

@Composable fun SpeedBoard(ses:Session<SpeedState>,version:Int,enabled:Boolean,onMove:(Int)->Unit) {
    Seen(version)
    val s=ses.state;val me=viewSeat(ses);val other=1-me;val rules=ses.rules as Speed;val legal=rules.legalMovesFor(s,me).toSet()
    var selected by remember(s.hands[me]){mutableIntStateOf(-1)}
    val chosen=s.hands[me].getOrNull(selected)
    fun play(target:Int){chosen?.let{onMove(me*Speed.SEAT+Speed.PLAY+it*2+target)}}
    fun allowed(target:Int)=enabled&&chosen!=null&&me*Speed.SEAT+Speed.PLAY+chosen*2+target in legal
    Column(Modifier.fillMaxSize()){
        Box(Modifier.weight(1f)){NewTable {
            OpponentRows(ses,me){"残り ${s.hands[it].size+s.reserves[it].size}枚"}
            CardsRow(s.hands[other])
            Text("台札　左右どちらにも出せます",color=tableText)
            Row(horizontalArrangement=Arrangement.spacedBy(30.dp)){s.tops.forEachIndexed{i,c->PokerCard(c,enabled=allowed(i)){play(i)}}}
            Text("あなた：残り ${s.hands[me].size+s.reserves[me].size}枚／山 ${s.reserves[me].size}枚",color=tableText)
            CardsRow(s.hands[me],selected,enabled){selected=it}
        }}
        CardButtonRow(listOf(CardBtn("左に出す",allowed(0),true){play(0)},CardBtn("右に出す",allowed(1),true){play(1)}))
        CardButtonRow(listOf(CardBtn("台札を更新",enabled&&me*Speed.SEAT+Speed.RESET in legal){onMove(me*Speed.SEAT+Speed.RESET)}))
    }
}



/** テキサスポーカーの卓: だ円の卓(くるみのふち+フェルト)のまわりに席、中央に共通の札とポット、下に自分の2枚と「いまの役」 */
@Composable private fun HoldemTable(ses:Session<HoldemState>,s:HoldemState,g:Holdem,me:Int){
    val tm=rememberTextMeasurer()
    val showdown=s.street==4
    BoxWithConstraints(Modifier.fillMaxSize().clip(RoundedCornerShape(18.dp)).background(Color(0xFF22262F))){
        val W=maxWidth;val H=maxHeight
        val tableH=H*0.70f
        val cx=W/2;val cy=tableH*0.55f
        val rx=W*0.46f;val ry=tableH*0.40f
        val others=(1 until s.chips.size).map{(me+it)%s.chips.size}
        // 卓と、各席の前のチップ(数字つき)・ディーラーの「D」
        Canvas(Modifier.fillMaxSize()){
            val c=Offset(cx.toPx(),cy.toPx());val a=rx.toPx();val b=ry.toPx()
            drawOval(Color.Black.copy(alpha=0.35f),Offset(c.x-a,c.y-b+6f),androidx.compose.ui.geometry.Size(2*a,2*b))
            drawOval(Brush.verticalGradient(listOf(Mat.walnutTop,Mat.walnutBottom),startY=c.y-b,endY=c.y+b),Offset(c.x-a,c.y-b),androidx.compose.ui.geometry.Size(2*a,2*b))
            val inA=a-14.dp.toPx();val inB=b-14.dp.toPx()
            drawOval(safeRadial(listOf(Mat.feltLight,Mat.feltDeep),c,inA.coerceAtLeast(1f)),Offset(c.x-inA,c.y-inB),androidx.compose.ui.geometry.Size(2*inA,2*inB))
            drawOval(Color.White.copy(alpha=0.12f),Offset(c.x-inA*0.8f,c.y-inB*0.8f),androidx.compose.ui.geometry.Size(1.6f*inA,1.6f*inB),style=androidx.compose.ui.graphics.drawscope.Stroke(1.5f))
            fun seatAt(k:Int,n:Int):Offset{ // k 番目の相手(上の弧)。自分は下
                val ang=Math.toRadians(200.0+140.0*(k+0.5)/n)
                return Offset(c.x+a*kotlin.math.cos(ang).toFloat(),c.y+b*kotlin.math.sin(ang).toFloat())
            }
            fun betAt(p:Int,at:Offset){
                val bet=s.bets.getOrElse(p){0}
                if(bet<=0||showdown)return
                for(i in 0 until minOf(3,1+bet/50))chipMark(at+Offset(0f,-i*3.dp.toPx()),7.dp.toPx(),BADGE_RED)
                val lay=tm.measure("$bet",TextStyle(color=Color.White,fontSize=11.sp,fontWeight=FontWeight.Black))
                drawText(lay,topLeft=at+Offset(10.dp.toPx(),-lay.size.height/2f))
            }
            others.forEachIndexed{k,p->val st=seatAt(k,others.size);betAt(p,st+(c-st)*0.42f)
                if(p==s.dealer){val d=st+(c-st)*0.25f+Offset(-16.dp.toPx(),0f);drawCircle(Color.White,8.dp.toPx(),d);val l=tm.measure("D",TextStyle(color=Color(0xFF1D2433),fontSize=10.sp,fontWeight=FontWeight.Black));drawText(l,topLeft=d-Offset(l.size.width/2f,l.size.height/2f))}
            }
            val mine=Offset(c.x,c.y+b*0.62f);betAt(me,mine+Offset(-20.dp.toPx(),0f))
            if(me==s.dealer){val d=mine+Offset(30.dp.toPx(),0f);drawCircle(Color.White,8.dp.toPx(),d);val l=tm.measure("D",TextStyle(color=Color(0xFF1D2433),fontSize=10.sp,fontWeight=FontWeight.Black));drawText(l,topLeft=d-Offset(l.size.width/2f,l.size.height/2f))}
            // 共通の札の場所(5枚)
            val cw=minOf(36.dp.toPx(),(2*inA)*0.7f/5.4f)
            val x0=c.x-cw*5.3f/2
            for(i in 0 until 5){
                val tl=Offset(x0+i*cw*1.08f,c.y-cw*1.4f*0.75f)
                if(i<s.board.size)playingCard(tm,tl,cw,s.board[i])
                else drawRoundRect(Color.White.copy(alpha=0.35f),tl,androidx.compose.ui.geometry.Size(cw,cw*1.4f),androidx.compose.ui.geometry.CornerRadius(cw*0.1f),style=androidx.compose.ui.graphics.drawscope.Stroke(1.5f,pathEffect=androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6f,5f))))
            }
            // ポット
            val pot=if(showdown)0 else s.invested.sum()
            val pl=tm.measure("ポット $pot",TextStyle(color=Color(0xFFFFE9B0),fontSize=13.sp,fontWeight=FontWeight.Black))
            val pc=Offset(c.x,c.y+cw*0.95f)
            drawRoundRect(Color(0x99000000),pc-Offset(pl.size.width/2f+10.dp.toPx(),pl.size.height/2f+2.dp.toPx()),androidx.compose.ui.geometry.Size(pl.size.width+20.dp.toPx(),pl.size.height+4.dp.toPx()),androidx.compose.ui.geometry.CornerRadius(50f))
            chipMark(pc-Offset(pl.size.width/2f+4.dp.toPx(),0f),6.dp.toPx(),BADGE_RED)
            drawText(pl,topLeft=pc-Offset(pl.size.width/2f-6.dp.toPx(),pl.size.height/2f))
        }
        // 相手の席(顔の丸・名前・持ち点・2枚の札)。降りた人は薄く
        others.forEachIndexed{k,p->
            val ang=Math.toRadians(200.0+140.0*(k+0.5)/others.size)
            val sx=cx+rx*kotlin.math.cos(ang).toFloat();val sy=cy+ry*kotlin.math.sin(ang).toFloat()
            val folded=p in s.folded
            TableSeat(sx,(sy-30.dp).coerceAtLeast(0.dp),seatLabel(ses,p),ses.seats[p].human||ses.seats[p].remote,p,s.turn==p&&!showdown,
                bubble=if(folded)"降り" else if(showdown&&s.payouts.getOrElse(p){0}>0)"+${s.payouts[p]}" else null,dim=folded,face=32.dp,width=minOf(92.dp,W/(others.size.coerceAtLeast(3))),photo=showsPhoto(ses,p),
                extra={Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(3.dp),modifier=Modifier.alpha(if(folded)0.45f else 1f)){
                    Text("${s.chips[p]}",color=Color(0xFFFFE9B0),fontSize=11.sp,fontWeight=FontWeight.Black)
                    for(card in s.hands[p].take(2))Canvas(Modifier.size(14.dp,20.dp)){if(showdown&&!folded)playingCard(tm,Offset.Zero,size.width,card) else cardBack(Offset.Zero,size.width)}
                }})
        }
        // 下: 自分の2枚(大きく)・持ち点・いまの役
        Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal=10.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
            val box=Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Color(0xFF14171D)).border(1.dp,if(s.turn==me&&!showdown)ACCENT else Color(0x33FFFFFF),RoundedCornerShape(12.dp)).padding(vertical=8.dp)
            Column(box,horizontalAlignment=Alignment.CenterHorizontally){
                Text(seatLabel(ses,me),color=Color(0xCCFFFFFF),fontSize=11.sp)
                Row(verticalAlignment=Alignment.CenterVertically){Canvas(Modifier.size(14.dp)){chipMark(center,size.minDimension/2,BADGE_RED)};Text(" ${s.chips[me]}",color=Color(0xFFFFE9B0),fontSize=15.sp,fontWeight=FontWeight.Black)}
            }
            Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){
                for(card in s.hands[me])Canvas(Modifier.size(52.dp,73.dp).alpha(if(me in s.folded)0.5f else 1f)){playingCard(tm,Offset.Zero,size.width,card)}
            }
            Column(box,horizontalAlignment=Alignment.CenterHorizontally){
                Text("いまの役",color=Color(0xCCFFFFFF),fontSize=11.sp)
                val cards=s.hands[me]+s.board
                Text(if(cards.size>=5)Cards.HAND_NAMES[Cards.handCategory(Holdem.bestValue(cards.toIntArray()))] else if(s.hands[me].size==2&&Cards.rank(s.hands[me][0])==Cards.rank(s.hands[me][1]))"ワンペア" else "—",
                    color=Color.White,fontSize=13.sp,fontWeight=FontWeight.Black,maxLines=1,textAlign=androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
        // 進み具合と、直前の動き(下に小さく)
        val toCall=((s.bets.maxOrNull()?:0)-s.bets.getOrElse(me){0}).coerceAtLeast(0)
        Text("${minOf(s.round+1,g.rounds)}/${g.rounds}回・"+listOf("プリフロップ","フロップ","ターン","リバー","精算")[s.street]+(if(toCall>0&&!showdown)"・コールに必要 $toCall" else "")+(if(s.lastMover>=0)"　${seatLabel(ses,s.lastMover)}: ${s.lastAction}" else ""),
            color=Color(0xB3FFFFFF),fontSize=11.sp,maxLines=1,overflow=androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier=Modifier.align(Alignment.TopCenter).offset(y=tableH-2.dp).padding(horizontal=10.dp))
    }
}
