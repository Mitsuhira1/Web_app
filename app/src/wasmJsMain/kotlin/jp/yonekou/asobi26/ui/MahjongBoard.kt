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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.drawText
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.*

private val mjWhite=Color(0xFFFFF8E8)
private val mjGreen=Color(0xFF185B4B)
private val mjGold=Color(0xFFFFCD63)
@Composable
fun MahjongTile(tile:Int,red:Boolean,width:Dp=38.dp,picked:Boolean=false,enabled:Boolean=false,tag:String="",sideways:Boolean=false,dim:Boolean=false,onClick:()->Unit={}) {
    val tm=androidx.compose.ui.text.rememberTextMeasurer()
    // 選んだ牌は少し持ち上げる(金の枠)
    Canvas(Modifier.width(width).height(width*1.46f).offset(y=if(picked)(-5).dp else 0.dp).rotate(if(sideways)90f else 0f).testTag(tag)
        .semantics{contentDescription=Mahjong.label(tile,red);selected=picked}.clickable(enabled=enabled,onClick=onClick)){
        mjTileFace(tm,androidx.compose.ui.geometry.Offset.Zero,size.width,tile,red,alpha=if(dim)0.45f else 1f,picked=picked)
    }
}
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MahjongBoard(ses:Session<MahjongState>,version:Int,enabled:Boolean,advance:Boolean,clockRemaining:Int=-1,onMove:(Int)->Unit) {
    val s=ses.state;val g=ses.rules as Mahjong;val me=viewSeat(ses);val colors=LocalAsobi.current
    val legal=remember(ses,version){g.legalMoves(s).toSet()}
    val shown=LocalBoardShown.current;LaunchedEffect(version){shown(version)}
    var selected by remember(ses,version){mutableIntStateOf(if(me in s.riichi&&s.turn==me)s.drawnTile else -1)}
    var declaring by remember(ses,version){mutableStateOf(false)}
    var riverSeat by remember(ses){mutableIntStateOf(me)}
    var choices by remember(ses,version){mutableStateOf(emptyList<Int>())}
    var review by remember(ses,s.serial){mutableStateOf(false)}
    var abort by remember(ses,version){mutableStateOf(false)}
    LaunchedEffect(s.lastDiscard){if(s.lastDiscard>=0&&s.discarder in 0..3)riverSeat=s.discarder}
    LaunchedEffect(s.phase){if(s.phase==2)review=true else review=false}
    val discard=selected+if(declaring)Mahjong.RIICHI else 0
    val canDiscard=enabled&&s.phase==0&&s.turn==me&&selected>=0&&discard in legal
    fun choose(candidates:List<Int>){if(candidates.size==1)onMove(candidates[0])else choices=candidates}
    val chi=legal.filter{it in Mahjong.CHI until Mahjong.PON}
    val pon=legal.filter{it in Mahjong.PON until Mahjong.OPEN_KAN}
    val kan=legal.filter{it in Mahjong.OPEN_KAN..Mahjong.OPEN_KAN+33||it in Mahjong.ANKAN..Mahjong.ANKAN+33||it in Mahjong.ADDED_KAN..Mahjong.ADDED_KAN+135}
    Column(Modifier.fillMaxSize().testTag("mahjongBoard")) {
        // 卓: 中央に局と点数、まわりに4人の河、上と左右に相手の手牌(裏)
        Column(Modifier.weight(1f).fillMaxWidth(),horizontalAlignment=Alignment.CenterHorizontally){
            MahjongTable(ses,s,g,me,Modifier.weight(1f).aspectRatio(1f,matchHeightConstraintsFirst=true))
            Text(if(s.phase==1)"${seatLabel(ses,s.discarder)}の ${Mahjong.label(s.lastDiscard,g.red)} に応答"else if(s.phase==2)"局の結果"else"${seatLabel(ses,s.turn)}：${if(s.turn==me&&declaring)"リーチする牌を選択"else s.action}",
                color=colors.accentInk,fontSize=12.sp,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.padding(top=2.dp))
        }
        Row(Modifier.fillMaxWidth().height(40.dp).border(2.dp,if(enabled&&s.phase<2)colors.accent else Color.Transparent,RoundedCornerShape(8.dp)).padding(horizontal=4.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)){
            Text(if(enabled&&s.phase<2)(if(ses.options.str("localMode","cpu")=="pass")ses.seats[me].name else "あなた")+(if(s.phase==1)"が応答"else"の番です")else if(me in s.riichi)"手牌・リーチ中"else"あなたの手牌",color=if(enabled&&s.phase<2)colors.accentInk else colors.ink,fontWeight=FontWeight.Bold,fontSize=12.sp,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.weight(1f))
            if(clockRemaining>=0)Text("${clockRemaining}秒",color=if(clockRemaining<=5)colors.shu else colors.sub,fontSize=11.sp)
            if(s.phase<2&&g.furiten(s,me))Text("フリテン",color=colors.shu,fontSize=11.sp)
            TextButton(onClick={abort=true},enabled=enabled&&Mahjong.KYUSHU in legal){Text("九種九牌",fontSize=11.sp)}
            TextButton(onClick={review=true},enabled=s.phase==2){Text("結果",fontSize=12.sp)}
        }
        if(s.melds[me].isNotEmpty())Row(Modifier.fillMaxWidth().padding(vertical=2.dp),horizontalArrangement=Arrangement.spacedBy(6.dp,Alignment.End)){
            for(meld in s.melds[me])Row(horizontalArrangement=Arrangement.spacedBy(1.dp)){meld.tiles.forEach{MahjongTile(it,g.red,22.dp)}}
        }
        BoxWithConstraints(Modifier.fillMaxWidth()){
            val tileWidth=((maxWidth-18.dp)/7).coerceAtMost(43.dp)
            Column(Modifier.fillMaxWidth().height(tileWidth*2.8f+4.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
                for(row in s.hands[me].chunked(7))Row(horizontalArrangement=Arrangement.spacedBy(3.dp)){
                    for(tile in row){val selectable=(tile+if(declaring)Mahjong.RIICHI else 0) in legal
                        MahjongTile(tile,g.red,tileWidth,selected==tile,enabled&&s.phase==0&&s.turn==me&&selectable,"mjHand-$tile",dim=enabled&&s.phase==0&&s.turn==me&&!selectable){selected=tile}
                    }
                }
            }
        }
        CardButtonRow(listOf(CardBtn("打牌",canDiscard,true){onMove(discard)},CardBtn("リーチ",enabled&&legal.any{it in Mahjong.RIICHI..Mahjong.RIICHI+135},declaring){declaring=!declaring},
            CardBtn("チー",enabled&&chi.isNotEmpty()){choose(chi)},CardBtn("ポン",enabled&&pon.isNotEmpty()){choose(pon)}))
        CardButtonRow(listOf(CardBtn("カン",enabled&&kan.isNotEmpty()){choose(kan)},CardBtn("ロン",enabled&&Mahjong.RON in legal,true){onMove(Mahjong.RON)},
            CardBtn("ツモ",enabled&&Mahjong.TSUMO in legal,true){onMove(Mahjong.TSUMO)},CardBtn("パス",enabled&&Mahjong.PASS in legal){onMove(Mahjong.PASS)}))
    }
    if(choices.isNotEmpty())AlertDialog(onDismissRequest={choices=emptyList()},title={Text("使う牌を選択")},text={
        Column(Modifier.heightIn(max=350.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
            for(code in choices){
                val cards=when{code in Mahjong.ADDED_KAN..Mahjong.ADDED_KAN+135->listOf(code-Mahjong.ADDED_KAN)
                    code in Mahjong.ANKAN..Mahjong.ANKAN+33->s.hands[me].filter{it/4==code-Mahjong.ANKAN}
                    code in Mahjong.OPEN_KAN..Mahjong.OPEN_KAN+33->s.hands[me].filter{it/4==code-Mahjong.OPEN_KAN}+s.lastDiscard
                    else->{val base=if(code>=Mahjong.PON)Mahjong.PON else Mahjong.CHI;listOf((code-base)/136,(code-base)%136,s.lastDiscard).sorted()}}
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(colors.chip).clickable{choices=emptyList();if(code in legal)onMove(code)}.padding(8.dp),horizontalArrangement=Arrangement.spacedBy(4.dp)){
                    cards.forEach{MahjongTile(it,g.red,32.dp)}
                    Text(if(code>=Mahjong.ADDED_KAN)"加槓"else if(code>=Mahjong.ANKAN)"暗槓"else"",color=colors.ink)
                }
            }
        }
    },confirmButton={TextButton(onClick={choices=emptyList()}){Text("戻る")}},containerColor=colors.surface)
    if(abort)AlertDialog(onDismissRequest={abort=false},title={Text("九種九牌で流局しますか？")},confirmButton={TextButton(onClick={abort=false;if(Mahjong.KYUSHU in legal)onMove(Mahjong.KYUSHU)}){Text("流局する")}},dismissButton={TextButton(onClick={abort=false}){Text("続ける")}},containerColor=colors.surface)
    if(review&&s.phase==2&&s.result!=null)MahjongRoundReview(ses,advance,{review=false}){onMove(Mahjong.NEXT)}
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun MahjongRoundReview(ses:Session<MahjongState>,advance:Boolean,onDismiss:()->Unit,onNext:()->Unit){
    val s=ses.state;val g=ses.rules as Mahjong;val result=s.result!!;val colors=LocalAsobi.current
    AlertDialog(onDismissRequest=onDismiss,title={Text(result.label)},text={
        Column(Modifier.heightIn(max=420.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)){
            for(p in 0..3)Text("${seatLabel(ses,p)}　${if(result.deltas[p]>0)"＋"else""}${result.deltas[p]} → ${s.points[p]}",color=colors.ink,fontWeight=if(p in result.winners)FontWeight.Bold else FontWeight.Normal)
            if(result.tenpai.isNotEmpty())Text("テンパイ："+result.tenpai.joinToString("・"){seatLabel(ses,it)},color=colors.sub)
            for(p in result.winners){val sc=result.scores[p]?:continue
                Text("${seatLabel(ses,p)}　${sc.description}",color=colors.accentInk,fontWeight=FontWeight.Black)
                Text(sc.yaku.joinToString("／"){"${it.first} ${if(it.second>=13)"役満"else"${it.second}翻"}"},color=colors.ink)
                val hand=s.hands[p]+if(result.label.contains("ロン"))listOf(s.lastDiscard)else emptyList()
                FlowRow(horizontalArrangement=Arrangement.spacedBy(2.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){hand.forEach{MahjongTile(it,g.red,25.dp)}}
                if(p in s.riichi){Text("裏ドラ表示牌",color=colors.sub,fontSize=11.sp);Row(horizontalArrangement=Arrangement.spacedBy(3.dp)){(0..s.kans).forEach{MahjongTile(s.wall[127+it*2],g.red,23.dp)}}}
            }
            if(!advance)Text("ホストの進行を待っています",color=colors.sub)
        }
    },confirmButton={TextButton(onClick=onNext,enabled=advance){Text(if(result.end)"試合結果へ"else"次の局")}},dismissButton={TextButton(onClick=onDismiss){Text("盤を見る")}},containerColor=colors.surface)
}

@Composable fun MahjongRoles(onClose:()->Unit){
    val c=LocalAsobi.current
    Column(Modifier.fillMaxWidth().heightIn(max=540.dp).background(c.surface,RoundedCornerShape(topStart=20.dp,topEnd=20.dp)).padding(16.dp)){
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){Text("麻雀の役と点数",color=c.ink,fontWeight=FontWeight.Black,fontSize=22.sp,modifier=Modifier.weight(1f));TextButton(onClick=onClose){Text("閉じる")}}
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(14.dp)){
            for((title,body)in listOf(
                "和了の基本" to "4面子と1雀頭、七対子、国士無双のいずれか。1翻以上の役が必要です。ドラ・赤ドラだけでは和了できません。フリテン中はロン不可、ツモは可能です。",
                "1翻" to "立直（門前）・一発・門前清自摸和・平和（門前）・断幺九・一盃口（門前）・役牌（白・發・中・自風・場風）・嶺上開花・槍槓・海底摸月・河底撈魚。",
                "2翻" to "ダブル立直（門前）・七対子（門前）・対々和・三暗刻・三色同刻・三槓子・小三元・混老頭。三色同順・一気通貫・混全帯幺九は鳴くと1翻。",
                "3翻以上" to "二盃口（門前）・混一色（鳴くと2翻）・純全帯幺九（鳴くと2翻）・清一色6翻（鳴くと5翻）。",
                "役満" to "国士無双・四暗刻・大三元・小四喜・大四喜・字一色・清老頭・緑一色・九蓮宝燈・四槓子・天和・地和。複数の役満は加算。国士13面・四暗刻単騎・純正九蓮・大四喜のダブル役満は設定で選択。",
                "符" to "基本20符。門前ロンは+10、ツモは+2（平和ツモは20符）。役牌の雀頭、待ち方、刻子・槓子で加算し10符単位に切り上げ。七対子は25符固定。連風牌の雀頭は4符。",
                "子のロン点・代表例" to "30符1翻1000／2翻2000／3翻3900／4翻7700。40符1翻1300／2翻2600／3翻5200。七対子25符2翻1600。親は基本点から別に計算します（30符2翻2900、40符1翻2000など）。",
                "満貫以上" to "子のロン：満貫8000・跳満12000・倍満16000・三倍満24000・役満32000。親はそれぞれ1.5倍。5翻、4翻40符以上、3翻70符以上で満貫。6〜7翻は跳満、8〜10翻は倍満、11〜12翻は三倍満、13翻以上は数え役満。",
                "本場と供託" to "ロンは1本場につき300点、ツモは各人100点を加算。リーチ棒は1000点。複数ロンでは放銃者から近い和了者が供託を受け取ります。"
            )){Text(title,color=c.accentInk,fontWeight=FontWeight.Bold);Text(body,color=c.ink,fontSize=14.sp,lineHeight=22.sp)}
        }
    }
}


/** 麻雀の卓(1枚の絵)。自分は下、次の人(右)・対面(上)・前の人(左) */
@Composable
private fun MahjongTable(ses:Session<MahjongState>,s:MahjongState,g:Mahjong,me:Int,modifier:Modifier){
    val tm=androidx.compose.ui.text.rememberTextMeasurer()
    Canvas(modifier.clip(RoundedCornerShape(16.dp)).background(safeRadial(listOf(Mat.feltLight,Mat.feltDeep)))){
        val S=size.minDimension
        val ctr=androidx.compose.ui.geometry.Offset(size.width/2,size.height/2)
        fun label(text:String,at:androidx.compose.ui.geometry.Offset,fs:Float,col:Color,bold:Boolean=true):androidx.compose.ui.text.TextLayoutResult{
            val lay=tm.measure(text,androidx.compose.ui.text.TextStyle(color=col,fontSize=(fs/density/fontScale).sp,fontWeight=if(bold)FontWeight.Black else FontWeight.Normal,fontFamily=AppFont))
            drawText(lay,topLeft=at-androidx.compose.ui.geometry.Offset(lay.size.width/2f,lay.size.height/2f));return lay
        }
        // 中央の表示(局・本場・供託・残り)と、4人の点数(それぞれの向きに)
        val pw=S*0.3f
        val ptl=ctr-androidx.compose.ui.geometry.Offset(pw/2,pw/2)
        drawRoundRect(Color(0xFF12301F),ptl,androidx.compose.ui.geometry.Size(pw,pw),androidx.compose.ui.geometry.CornerRadius(pw*0.1f))
        drawRoundRect(Color(0x80C9A24A),ptl,androidx.compose.ui.geometry.Size(pw,pw),androidx.compose.ui.geometry.CornerRadius(pw*0.1f),style=androidx.compose.ui.graphics.drawscope.Stroke(1.2f))
        label("${if(s.round<4)"東"else"南"}${s.round%4+1}局",ctr-androidx.compose.ui.geometry.Offset(0f,pw*0.16f),pw*0.14f,Color(0xFFFFE9B0))
        label("${s.honba}本場・供託${s.sticks}",ctr+androidx.compose.ui.geometry.Offset(0f,pw*0.02f),pw*0.075f,Color(0xFFCFE5D6),false)
        label("残り ${(s.liveEnd-s.pos).coerceAtLeast(0)}",ctr+androidx.compose.ui.geometry.Offset(0f,pw*0.15f),pw*0.075f,Color(0xFFCFE5D6),false)
        val tw=S*0.046f; val th=tw*1.36f
        for(k in 0..3){
            val p=(me+k)%4
            rotate(-90f*k,ctr){
                // 点数(自分の向きから見て下の辺)
                val turn=p==s.turn&&s.phase<2
                label("${Mahjong.WINDS[(p-s.dealer+4)%4]} ${s.points[p]}",ctr+androidx.compose.ui.geometry.Offset(0f,pw*0.38f),pw*0.085f,if(turn)Color(0xFFFFD94F)else Color.White)
                // リーチ棒
                if(p in s.riichi){
                    val y=ctr.y+pw/2+tw*0.45f
                    drawRoundRect(Color.White,androidx.compose.ui.geometry.Offset(ctr.x-pw*0.3f,y),androidx.compose.ui.geometry.Size(pw*0.6f,tw*0.3f),androidx.compose.ui.geometry.CornerRadius(tw*0.15f))
                    drawCircle(MJ_RED_DOT,tw*0.11f,androidx.compose.ui.geometry.Offset(ctr.x,y+tw*0.15f))
                }
                // 河(6枚で折り返す)
                val river=s.rivers[p]
                val declared=s.riichi[p]?.declaration
                val di=if(declared!=null)river.indexOf(declared)else -1
                val sideways=if(di>=0)river.drop(di).firstOrNull{it !in s.claimed}else null
                val x0=ctr.x-3*tw*1.04f
                val y0=ctr.y+pw/2+tw*0.95f
                var col=0;var row=0;var x=x0
                for(tile in river){
                    if(col==6){col=0;row++;x=x0}
                    val y=y0+row*(th*1.12f)
                    val dim=if(tile in s.claimed)0.4f else 1f
                    if(tile==sideways){
                        mjTileSideways(tm,androidx.compose.ui.geometry.Offset(x+th/2,y+th/2+tw*0.1f),tw,tile,g.red,dim);x+=th*1.04f
                    }else{
                        mjTileFace(tm,androidx.compose.ui.geometry.Offset(x,y),tw,tile,g.red,dim,picked=tile==s.lastDiscard&&s.phase==1);x+=tw*1.04f
                    }
                    col++
                }
                // 相手の手牌(裏)と副露(表)。自分の手牌は卓の下に大きく出す
                if(k!=0){
                    val n=s.hands[p].size
                    val bw=S*0.042f; val bh=bw*1.45f
                    val melds=s.melds[p].flatMap{it.tiles}
                    val total=n*bw+(if(melds.isNotEmpty())bw*0.4f+melds.size*bw else 0f)
                    var hx=ctr.x-total/2
                    val hy=ctr.y+S/2-bh-S*0.012f
                    repeat(n){mjTileBack(androidx.compose.ui.geometry.Offset(hx,hy),bw*0.95f,bh);hx+=bw}
                    if(melds.isNotEmpty()){hx+=bw*0.4f;for(t in melds){mjTileFace(tm,androidx.compose.ui.geometry.Offset(hx,hy+bh-bw*1.36f),bw*0.95f,t,g.red);hx+=bw}}
                }
            }
        }
        // ドラ表示牌(左上)
        val dora=g.indicators(s)
        drawRoundRect(Color(0xFF12301F),androidx.compose.ui.geometry.Offset(S*0.02f,S*0.1f),androidx.compose.ui.geometry.Size(S*0.07f+5*tw*1.05f,tw*1.7f),androidx.compose.ui.geometry.CornerRadius(tw*0.3f))
        label("ドラ",androidx.compose.ui.geometry.Offset(S*0.055f,S*0.1f+tw*0.85f),tw*0.5f,Color(0xFFCFE5D6),false)
        for(i in 0 until 5){
            val tl=androidx.compose.ui.geometry.Offset(S*0.09f+i*tw*1.05f,S*0.1f+tw*0.15f)
            if(i<dora.size)mjTileFace(tm,tl,tw,dora[i],g.red) else mjTileBack(tl,tw,th)
        }
        // 相手の名札(番の人は黄色)
        for(k in 1..3){
            val p=(me+k)%4
            val turn=p==s.turn&&s.phase<2
            val text="${Mahjong.WINDS[(p-s.dealer+4)%4]} ${seatLabel(ses,p)}"
            val at=when(k){1->androidx.compose.ui.geometry.Offset(S*0.86f,S*0.84f);2->androidx.compose.ui.geometry.Offset(S*0.82f,S*0.05f);else->androidx.compose.ui.geometry.Offset(S*0.14f,S*0.84f)}
            val lay=tm.measure(text,androidx.compose.ui.text.TextStyle(color=if(turn)Color(0xFF3A2A00)else Color.White,fontSize=(S*0.032f/density/fontScale).sp,fontWeight=FontWeight.Black,fontFamily=AppFont))
            val pad=S*0.02f
            drawRoundRect(if(turn)Color(0xFFFFD94F)else Color(0x99000000),at-androidx.compose.ui.geometry.Offset(lay.size.width/2f+pad,lay.size.height/2f+pad*0.3f),androidx.compose.ui.geometry.Size(lay.size.width+2*pad,lay.size.height+pad*0.6f),androidx.compose.ui.geometry.CornerRadius(lay.size.height.toFloat()))
            drawText(lay,topLeft=at-androidx.compose.ui.geometry.Offset(lay.size.width/2f,lay.size.height/2f))
        }
    }
}
private val MJ_RED_DOT=Color(0xFFC8362E)
