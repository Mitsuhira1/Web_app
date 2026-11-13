package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import kotlin.math.roundToInt
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.draw.rotate
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.GameInfo
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.*
import jp.yonekou.asobi26.core.ConcurrentRules
import jp.yonekou.asobi26.core.games.C4State
import jp.yonekou.asobi26.core.games.CheckersState
import jp.yonekou.asobi26.core.games.ChessState
import jp.yonekou.asobi26.core.games.GoState
import jp.yonekou.asobi26.core.games.PokerState
import jp.yonekou.asobi26.core.games.MemoryState
import jp.yonekou.asobi26.core.games.BjState
import jp.yonekou.asobi26.core.games.SevensState
import jp.yonekou.asobi26.core.games.Sevens
import jp.yonekou.asobi26.core.games.DaifugoState
import jp.yonekou.asobi26.core.games.BgState
import jp.yonekou.asobi26.core.games.CcState
import jp.yonekou.asobi26.core.games.LudoState
import jp.yonekou.asobi26.core.games.ShogiState
import jp.yonekou.asobi26.core.games.GomokuState
import jp.yonekou.asobi26.core.games.HareState
import jp.yonekou.asobi26.core.games.HexState
import jp.yonekou.asobi26.core.games.MorrisState
import jp.yonekou.asobi26.core.games.YachtState
import androidx.compose.ui.graphics.luminance
import jp.yonekou.asobi26.core.games.DotsState
import jp.yonekou.asobi26.core.games.HitBlowState
import jp.yonekou.asobi26.core.games.MancalaState
import jp.yonekou.asobi26.core.games.ReversiState

private fun <S> scoresOf(s: Session<S>): IntArray? = s.rules.scores(s.state)

/** 席ごとの目印の色(ゲームごと) */
fun seatColor(gameId: String, seat: Int, c: AsobiColors): Color = when (gameId) {
    "reversi" -> if (seat == 0) Color(0xFF1E2430) else Color(0xFFFAFAF7)
    "connect4" -> if (seat == 0) C4_RED else C4_BLACK
    "gomoku" -> if (seat == 0) Color(0xFF1C1E24) else Color(0xFFF5F2EA)
    "hex" -> if (seat == 0) Color(0xFFE0463A) else Color(0xFF3A7BE0)
    "morris" -> if (seat == 0) Color(0xFFF1E6CF) else Color(0xFF3A2A1E)
    "hare" -> if (seat == 0) Color(0xFF8A5A34) else Color(0xFFF7F7F2)
    "checkers" -> if (seat == 0) Color(0xFF2B2A2E) else Color(0xFFEFE3C8)
    "chess" -> if (seat == 0) Color(0xFFF7F3EA) else Color(0xFF2A2730)
    "shogi", "gogo" -> if (seat == 0) Color(0xFF2B2A2E) else Color(0xFFF3EFE4)
    "backgammon" -> if (seat == 0) Color(0xFFF4F0E6) else Color(0xFF2A2730)
    "ludo" -> LUDO_COLORS[if (seat == 0) 0 else 2]
    "chinese" -> CC_COLORS[seat.coerceIn(0, 5)]
    "go" -> if (seat == 0) Color(0xFF15171B) else Color(0xFFF7F4EC)
    else -> if (seat == 0) c.indigo else c.shu
}

/** 結果の板のために盤の下に取っておく空きの上限 */
private val RESULT_RESERVE = 210.dp

/** 卓の画面を全部使うカードゲーム(上の名札は出さず、卓の上に名札を描く) */
private val CARD_TABLE_GAMES = setOf("poker", "memory", "blackjack", "sevens", "daifugo", "hanafuda", "speed", "holdem", "uno", "solitaire", "mahjong", "life")

val C4_RED = Color(0xFFC8362E)
val C4_BLACK = Color(0xFFF2CC58)
val C4_HOLE = Color(0xFF2A1D10)
val C4_WOOD = Color(0xFFE9CC94)
val C4_WOOD_EDGE = Color(0xFFCDAE72)
val C4_BASE = Color(0xFFB8955A)

@Suppress("UNCHECKED_CAST")
@Composable
fun PlayScreen(model: AppModel) {
    val ses = model.session ?: return
    val gi = model.info ?: return
    // 対局オブジェクト(ses)は同じまま中身が変わる。手が進むたびに増える tick を LocalTick で下の部品に配り、
    // 各部品はそれを読む。こうすると、途中の部品が描き直しを省いても(同じ人の番が続く時・終局の時など)、
    // 盤や表示は必ず描き直される。
    val tick = model.tick
    val attentionRound=when(val state=ses.state){is MahjongState->state.serial;is HoldemState->state.round;is HanaState->state.round;else->0}
    val attentionSeat=if(ses.rules is ConcurrentRules<*>)0 else ses.toMove
    val attention = remember(ses, attentionSeat, attentionRound, ses.outcome != null) { TurnAttention() }
    var activity by remember(ses, attentionSeat, attentionRound) { mutableIntStateOf(0) }
    val rotated = model.localPass && ses.options.str("rotateTurns", "false") == "true" && viewSeat(ses) % 2 == 1
    val shownCb = remember(model) { { v: Int -> model.boardShown(v) } }
    CompositionLocalProvider(LocalTick provides tick, LocalBoardShown provides shownCb, LocalAvatar provides model.avatar) {
        Box(Modifier.fillMaxSize().rotate(if (rotated) 180f else 0f).pointerInput(attention) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    if (!model.handover && event.changes.any { it.pressed }) { attention.touched = true; activity++ }
                }
            }
        }) {
            PlayContent(model, ses, gi)
            TurnFeedback(model, ses, attention, activity)
        }
    }
}

@Suppress("UNCHECKED_CAST")
@Composable
private fun PlayContent(model: AppModel, ses: Session<*>, gi: GameInfo) {
    LocalTick.current
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    var showRules by remember { mutableStateOf(false) }
    var showRoles by remember { mutableStateOf(false) }
    var showPieces by remember { mutableStateOf(false) }
    if (showPieces) PieceGuide(gi.id) { showPieces = false }
    var askRestart by remember { mutableStateOf(false) }
    var askResign by remember { mutableStateOf(false) }
    var chatAnchorY by remember { mutableIntStateOf(0) }

    val outcome = ses.outcome
    val cpu = ses.seats.firstOrNull { !it.human }
    val subtitle = (if (model.localPass) "手番ごとに交代" else if (model.onlineGame) (if (model.roomOnline) "オンライン対戦" else "近くの人と対戦") else if (cpu != null) "CPU ${cpu.level.label}" else "ひとりで") + " ・ ${ses.moves.size}手"
    val canPlay = (if(model.reviewMove!=null)model.canAdvanceRound else ses.isHumanTurn) && !model.cpuThinking && outcome == null && !model.handover
    val onMove: (Int) -> Unit = { m ->
        if (gi.id == "go" && m == (ses.rules as jp.yonekou.asobi26.core.games.Go).RESIGN) askResign = true
        else if (model.humanMove(m)) tap()
    }
    val busy: (Boolean) -> Unit = { model.changeAnimating(it) }
    val human = viewSeat(ses)
    val won = outcome != null && !model.animating && (outcome.winner == human || (ses.seats.size == 1 && outcome.winner == 0))

    // CPU とだけ対戦している時は、画面のどこでもダブルタップすると CPU の番の動きをとばす。
    // 下の盤やボタンの操作をじゃましないよう、指の動きは見るだけで受け取らない(Initial で見て、消費しない)
    val vsCpuOnly = !model.onlineGame && !model.localPass && ses.seats.count { it.human } == 1
    Box(Modifier.fillMaxSize().then(if (vsCpuOnly) Modifier.pointerInput(ses) {
        var lastDown = 0L
        var lastPos = androidx.compose.ui.geometry.Offset.Zero
        awaitPointerEventScope {
            while (true) {
                val ev = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial)
                val down = ev.changes.firstOrNull { it.pressed && !it.previousPressed } ?: continue
                val t = down.uptimeMillis
                if (t - lastDown < 320 && (down.position - lastPos).getDistance() < 60.dp.toPx()) { model.skipCpu(); lastDown = 0L }
                else { lastDown = t; lastPos = down.position }
            }
        }
    } else Modifier)) {
    val v = LocalTick.current
    Column(Modifier.fillMaxSize()) {
        // 操作ボタンは上の帯にアイコンで並べる(盤の下は空けて、盤を広く使う)
        TopBar(gi.name, subtitle = subtitle, onBack = { model.back() }, gameId = gi.id) {
            LocalTick.current
            if (ses.def.undoAllowed && cpu != null) {
                val canUndo = model.canUndo && !model.animating
                IconChip(AppIcons.Undo, "待った", enabled = canUndo) { tap(); model.undo() }
            }
            // 通信対戦の「待った」(設定の回数が 0 の時は出さない)。押すと全員に了承を求める
            if (model.onlineUndoLimit != 0) {
                Box {
                    IconChip(AppIcons.Undo, "待った", enabled = model.canOnlineUndo && !model.animating) { tap(); model.requestOnlineUndo() }
                    if (model.onlineUndoLeft >= 0) Text(
                        "${model.onlineUndoLeft}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black,
                        modifier = Modifier.align(Alignment.TopEnd).clip(RoundedCornerShape(8.dp)).background(BADGE_RED).padding(horizontal = 4.dp),
                    )
                }
            }
            // 役の一覧は、見本どおり文字の付いた目立つボタンにする(アイコンだけでは気づきにくかった)
            if (gi.id in setOf("chess", "shogi", "gogo")) TextButton(onClick = { showPieces = true }) { Text("駒", color = c.accentInk, fontWeight = FontWeight.Bold) }
            if(gi.id=="mahjong") TextButton(onClick={showRoles=true}){Text("役",color=c.accentInk,fontWeight=FontWeight.Bold)}
            if (gi.id in setOf("yacht", "poker", "holdem")) RolesButton(poker = gi.id in setOf("poker", "holdem")) { tap(); showRoles = true }
            // 通信対戦のチャット(窓を閉じていても、届いたものは吹き出しで少しの間見える)
            if (model.onlineGame) ChatButton(model)
            // CPUの番をとばす(人が1人だけで、残りが CPU の対局のとき)。押せない時も位置を固定するため薄く出す
            if (!model.onlineGame && !model.localPass && ses.seats.count { it.human } == 1 && ses.seats.any { !it.human }) {
                IconChip(AppIcons.SkipCpu, "CPUの番をとばす", enabled = ses.outcome == null && ses.isCpuTurn) { tap(); model.skipCpu() }
            }
            IconChip(AppIcons.Rules, "ルール") { tap(); showRules = true }
            if (!model.onlineGame) IconChip(AppIcons.Restart, "最初から") { tap(); askRestart = true }
        }
        // ヨットは得点表に全員が出るので、名札は出さない(3人以上でも並びきらないため)
        // カードゲームは卓の上に名札を出すので、上の名札は出さない
        if (gi.id != "yacht" && gi.id !in CARD_TABLE_GAMES && ses.seats.size <= 2) PlayerStrip(model, ses, gi, v)
        // 吹き出しを出す高さの目印(名札の帯の下)
        Box(Modifier.fillMaxWidth().height(0.dp).onGloballyPositioned { chatAnchorY = it.positionInRoot().y.roundToInt() })
        if(gi.id!="mahjong"&&gi.id!="life"){
        // 3人以上とカードの卓は、全員を手番の順に並べた帯(番・NEXT・回る向き)で見せる
        val tinfo = if (outcome == null && model.reviewMove == null && (ses.seats.size >= 3 || gi.id in CARD_TABLE_GAMES)) turnInfo(ses) else null
        if (tinfo != null) {
            TurnOrderBar(ses, tinfo)
            // 全員の席の帯がある時は、吹き出しの高さをその下にする
            Box(Modifier.fillMaxWidth().height(0.dp).onGloballyPositioned { chatAnchorY = it.positionInRoot().y.roundToInt() })
        } else
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp).background(c.surface, RoundedCornerShape(12.dp))
                .border(2.dp, if (ses.isHumanTurn && ses.outcome == null) c.accent else Color.Transparent, RoundedCornerShape(12.dp)).padding(8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlayerFace(if (ses.isHumanTurn && showsPhoto(ses, ses.toMove)) model.avatar else null, ses.isHumanTurn, 0, 28.dp)
            Text(if (ses.outcome != null) "対局終了" else if(model.reviewMove!=null)"局の結果" else if (ses.rules is ConcurrentRules<*> && ses.seats.size>1) "それぞれ操作できます" else if (model.localPass || !ses.isHumanTurn) "${seatLabel(ses, ses.toMove)}の番です" else "あなたの番です", color = c.ink, fontWeight = FontWeight.Black, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if(model.reviewMove!=null)"結果確認中"else if (model.clockRemaining < 0) "制限時間なし" else "残り ${model.clockRemaining} 秒", color = if (model.clockRemaining in 0..5) c.shu else c.sub, fontSize = 12.sp, modifier = Modifier.weight(1f))
            if (ses.canResign) androidx.compose.material3.OutlinedButton(onClick = { askResign = true }, enabled = outcome == null && !model.handover && (!model.localPass || ses.isHumanTurn)) { Text("降参") }
        }
        }
        if(gi.id !in setOf("hanafuda", "speed", "holdem", "uno", "solitaire", "mahjong", "life")) StatusLine(model, ses, v)
        // 盤と結果の板。結果の板は盤の下の空きに重ねて出す(盤の大きさ・位置は終局の前後で変えない)。
        // 板の分の空きをいつも下に取っておくので、終局の時に盤がずれたり揺れたりしない。
        val panelVisible = outcome != null && !model.animating
        // 結果が出たら、勝ち・負け・引き分けの音
        val sfx = LocalSfx.current
        LaunchedEffect(panelVisible, ses) {
            if (panelVisible && outcome != null) {
                val win = outcome.winner == human || (ses.seats.size == 1 && outcome.winner == 0)
                sfx?.play(
                    when {
                        win -> Sound.WIN
                        outcome.winner == -1 -> Sound.DRAW
                        else -> Sound.LOSE
                    },
                )
            }
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val fullArea = gi.id == "hitblow" || gi.id == "yacht" || gi.id in CARD_TABLE_GAMES
            val reserve = if (fullArea || gi.id == "ludo" || gi.id == "backgammon") 0.dp else (maxHeight - maxWidth).coerceIn(0.dp, RESULT_RESERVE)
            // 画面全体を使う盤は、上の一行(状態の表示)と重ならないよう少し空ける
            Box(Modifier.fillMaxSize().padding(start = 14.dp, end = 14.dp, top = if (fullArea) 6.dp else 0.dp, bottom = reserve), contentAlignment = Alignment.Center) {
                if (gi.id == "hitblow") {
                    HitBlowBoard(ses as Session<HitBlowState>, v, canPlay, model.tapSound, onMove, busy)
                } else if (gi.id == "yacht") {
                    YachtBoard(ses as Session<YachtState>, v, canPlay, model.tapSound, onMove, busy,
                        fast = model.fastCpu, onSkip = { model.fastCpu = true },
                        remoteSelection = if (model.yachtSelectionIndex == ses.moves.size) model.yachtSelection else null,
                        onSelect = model::selectYachtDice)
                } else if (gi.id == "mahjong") {
                    MahjongBoard(ses as Session<MahjongState>,v,canPlay,model.canAdvanceRound,model.clockRemaining,onMove)
                } else if (gi.id == "life") {
                    LifeBoard(ses as Session<LifeState>, v, canPlay, model.clockRemaining, onMove, busy)
                } else if (gi.id == "hanafuda") {
                    HanafudaBoard(ses as Session<HanaState>,v,canPlay,onMove)
                } else if (gi.id == "speed") {
                    SpeedBoard(ses as Session<SpeedState>,v,canPlay,onMove)
                } else if (gi.id == "holdem") {
                    HoldemBoard(ses as Session<HoldemState>,v,canPlay,onMove)
                } else if (gi.id == "uno") {
                    OhNoBoard(ses as Session<OhNoState>,v,canPlay,onMove,busy)
                } else if (gi.id == "solitaire") {
                    SolitaireBoard(ses as Session<SolitaireState>,v,canPlay,onMove)
                } else if (gi.id == "poker") {
                    PokerBoard(ses as Session<PokerState>, v, canPlay, onMove, busy)
                } else if (gi.id == "memory") {
                    MemoryBoard(ses as Session<MemoryState>, v, canPlay, onMove, busy)
                } else if (gi.id == "blackjack") {
                    BlackjackBoard(ses as Session<BjState>, v, canPlay, onMove, busy)
                } else if (gi.id == "sevens") {
                    SevensBoard(ses as Session<SevensState>, v, canPlay, onMove, busy)
                } else if (gi.id == "daifugo") {
                    DaifugoBoard(ses as Session<DaifugoState>, v, canPlay, onMove, busy)
                } else {
                    // 盤はゲームの箱の色の台にのせる
                    val plate = RoundedCornerShape(22.dp)
                    // コネクトフォーは台に立てた盤なので、台の板は敷かない(見本C)
                    val plateMod = if (gi.id == "connect4") Modifier else Modifier.shadow(12.dp, plate).clip(plate).background(boxBrush(gi.id)).padding(8.dp)
                    Box(plateMod) {
                        when (gi.id) {
                            "reversi" -> ReversiBoard(ses as Session<ReversiState>, v, model.showHints && canPlay, canPlay, onMove, busy)
                            "connect4" -> ConnectFourBoard(ses as Session<C4State>, v, canPlay, onMove, busy)
                            "mancala" -> MancalaBoard(ses as Session<MancalaState>, v, canPlay, onMove, busy)
                            "dots" -> DotsBoard(ses as Session<DotsState>, v, canPlay, onMove, busy)
                            "gomoku" -> GomokuBoard(ses as Session<GomokuState>, v, canPlay, onMove, busy)
                            "hex" -> HexBoard(ses as Session<HexState>, v, canPlay, onMove, busy)
                            "morris" -> MorrisBoard(ses as Session<MorrisState>, v, canPlay, onMove, busy)
                            "hare" -> HareBoard(ses as Session<HareState>, v, canPlay, onMove, busy)
                            "checkers" -> CheckersBoard(ses as Session<CheckersState>, v, canPlay, onMove, busy)
                            "chess" -> ChessBoard(ses as Session<ChessState>, v, canPlay, onMove, busy)
                            "shogi", "gogo" -> ShogiBoard(ses as Session<ShogiState>, v, canPlay, onMove, busy)
                            "backgammon" -> BackgammonBoard(ses as Session<BgState>, v, canPlay, onMove, busy)
                            "ludo" -> LudoBoard(ses as Session<LudoState>, v, canPlay, onMove, busy, showRollControl = false)
                            "chinese" -> ChineseBoard(ses as Session<CcState>, v, canPlay, onMove, busy)
                            "go" -> GoBoard(ses as Session<GoState>, v, canPlay, onMove, busy)
                        }
                    }
                }
            }
            // 外側の Column の中で AnimatedVisibility を直接呼ぶと ColumnScope 版が選ばれてエラーになるので、別の関数に分ける

        }
        if (gi.id == "ludo") {
            val state = ses.state as LudoState
            val rules = ses.rules as jp.yonekou.asobi26.core.games.Ludo
            Box(Modifier.fillMaxWidth().background(c.surface).padding(horizontal = 18.dp, vertical = 8.dp)) {
                RollBar(if (state.die > 0) listOf(state.die) else emptyList(), 0,
                    canPlay && !model.animating && rules.isLegal(state, jp.yonekou.asobi26.core.games.Ludo.ROLL)) { onMove(jp.yonekou.asobi26.core.games.Ludo.ROLL) }
            }
        }
        // 下の余白はいつも同じ(終局の前後で変えると盤が動く)
        Box(Modifier.navigationBarsPadding().height(8.dp))
    }
    ResultOverlay(outcome != null && !model.animating, Modifier.align(Alignment.BottomCenter)) {
        Column(Modifier.fillMaxWidth().background(c.surface).heightIn(max = 480.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 8.dp)) {
            ResultPanel(model, ses, gi, v)
        }
    }
    // 上下を反対にして交代した時は、上の人にも読める向きで結果を出す
    if (model.localPass && outcome != null && !model.animating && ses.seats.size == 2 && ses.seats.all { it.human } && ses.options.str("rotateTurns", "false") == "true")
        TopPassBanner(ses, outcome.winner, Modifier.align(Alignment.TopCenter).windowInsetsPadding(androidx.compose.foundation.layout.WindowInsets.statusBars))
    if (won) Confetti(v)
    MoveSounds(ses, v)
    CountdownOverlay(model, ses)
    OnlineUndoOverlay(model)
    if (model.onlineGame) {
        val slots = model.room?.begin?.seatSlots
        val n = ses.seats.size
        ChatOverlay(model, chatAnchorY + with(androidx.compose.ui.platform.LocalDensity.current) { 6.dp.roundToPx() }) { slot ->
            val i = slots?.indexOf(slot) ?: -1
            if (i < 0 || gi.id == "mahjong" || gi.id == "life") null else (i + 0.5f) / n
        }
    }
    // ヨットの役の一覧(下から出す。後ろを暗くして、外をタップしても閉じる)
    if (showRoles && gi.id in setOf("yacht", "poker", "holdem", "mahjong")) {
        BackHandler { tap(); showRoles = false }
        Box(Modifier.fillMaxSize().background(Color(0x99000000)).pointerInput(Unit) { detectTapGestures { showRoles = false } }, contentAlignment = Alignment.BottomCenter) {
            Box(Modifier.pointerInput(Unit) { detectTapGestures { } }.navigationBarsPadding()) {
                if(gi.id=="mahjong")MahjongRoles{showRoles=false}
                else if (gi.id in setOf("poker", "holdem")) PokerRoles { showRoles = false }
                else YachtRoles(ses.state as YachtState) { showRoles = false }
            }
        }
    }
    // ルールは対局の上に重ねて出す(盤は裏でそのまま。重ね画面ではなく同じ画面の中なので、下まで読める)
    if (showRules) {
        BackHandler { tap(); showRules = false }
        Column(
            Modifier.fillMaxSize().screenBackground(c)
                // 下の盤に触れないよう、ルールの画面で受けた操作はここで止める
                .pointerInput(Unit) { detectTapGestures { } },
        ) {
            TopBar("${gi.name}のルール", onBack = { showRules = false }, gameId = gi.id)
            RulesContent(gi, Modifier.weight(1f).fillMaxWidth())
            Box(Modifier.navigationBarsPadding())
        }
    }
    }

    if (askResign) AlertDialog(
        onDismissRequest = { askResign = false }, containerColor = c.surface,
        title = { Text("降参しますか？") }, text = { Text("この対局はあなたの負けになります。") },
        confirmButton = { TextButton(onClick = { askResign = false; model.resign() }) { Text("降参する") } },
        dismissButton = { TextButton(onClick = { askResign = false }) { Text("対局を続ける") } })
    if (askRestart) {
        AlertDialog(
            onDismissRequest = { askRestart = false },
            confirmButton = { TextButton(onClick = { askRestart = false; model.rematch(false) }) { Text("やり直す") } },
            dismissButton = { TextButton(onClick = { askRestart = false }) { Text("続ける") } },
            title = { Text("最初からやり直しますか?") },
            text = { Text("いまの対局は消えます。") },
            containerColor = c.surface,
        )
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
private fun PlayerStrip(model: AppModel, ses: Session<*>, gi: GameInfo, version: Int) {
    LocalTick.current
    val c = LocalAsobi.current
    val scores = scoresOf(ses)
    val turn = ses.toMove
    Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        ses.seats.forEachIndexed { i, seat ->
            val active = i == turn
            val shape = RoundedCornerShape(14.dp)
            val ink = c.ink
            // 名札: 駒の色の玉・名前・大きな数字。番の人は金の枠
            Row(
                Modifier.weight(1f)
                    .clip(shape).background(if (active) c.accent.copy(alpha = 0.10f).compositeOver(c.surface) else c.surface)
                    .border(if (active) 2.5.dp else 1.dp, if (active) c.accent else c.line, shape).padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val sc = seatColor(gi.id, i, c)
                androidx.compose.foundation.Canvas(Modifier.size(28.dp)) {
                    stone(center, size.minDimension / 2 * 0.92f, sc)
                }
                Column(Modifier.weight(1f)) {
                    Text(if (seat.human || seat.remote) seat.name else "CPU", color = ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    val note = when {
                        active && !seat.human && !seat.remote && model.cpuThinking -> "考えています…"
                        active && seat.human -> if (gi.id == "connect4") (if (i == 0) "先攻・赤" else "後攻・黄") else "あなたの番"
                        seat.remote -> if (gi.id == "connect4") (if (i == 0) "先攻・赤" else "後攻・黄") else if (i == 0) "先攻" else "後攻"
                        !seat.human -> seat.level.label
                        ses.seats.size == 1 -> gi.name
                        else -> if (gi.id == "connect4") (if (i == 0) "先攻・赤" else "後攻・黄") else gi.seatNames.getOrElse(i) { "" }
                    }
                    val noteColor = if (active) c.accentInk else c.sub
                    Text(note, color = noteColor, fontSize = 11.sp, fontWeight = if (active) FontWeight.Black else FontWeight.Normal, maxLines = 1)
                }
                if (scores != null) Text(scores[i].toString(), color = ink, fontSize = 24.sp, fontWeight = FontWeight.Black,
                    style = androidx.compose.ui.text.TextStyle(fontFeatureSettings = "tnum"))
            }
        }
    }
}

/** ヨットなど3人以上の時の CPU の呼び名(得点表と同じ) */
private fun cpuName(ses: Session<*>, seat: Int): String {
    val me = viewSeat(ses)
    if (ses.seats.getOrNull(seat)?.remote == true) return ses.seats[seat].name
    return if (ses.seats.size == 2) "CPU" else "CPU${seat + (if (seat > me) 0 else 1)}"
}

@Composable
@Suppress("UNUSED_PARAMETER")
private fun StatusLine(model: AppModel, ses: Session<*>, version: Int) {
    LocalTick.current
    val c = LocalAsobi.current
    val st = ses.state
    val text = when {
        ses.outcome != null -> ""
        // 通信対戦: 相手の番は名前で出す
        ses.isRemoteTurn -> "${ses.seats[ses.toMove].name}の番です"
        st is ReversiState && model.forcedPass -> "置ける場所がないので、あなたはパスです"
        st is ReversiState && st.lastMove == jp.yonekou.asobi26.core.games.Reversi.PASS -> "置ける場所がないのでパスしました"
        st is MancalaState && st.extraTurn -> if (ses.isHumanTurn) "倉に入りました。もう1回まけます" else "CPUがもう1回まきます"
        st is MancalaState && st.captured > 0 -> "横取り! ${st.captured}個を倉へ"
        st is HitBlowState && st.settingSecret -> if (ses.isHumanTurn) "秘密の数を決めます(相手には見えません)" else "CPUが秘密の数を決めています"
        st is MorrisState && st.removing -> if (ses.isHumanTurn) "ミル! 取る相手のコマ(赤い輪)を選んでください" else "CPUがミルを作りました"
        st is MorrisState && ses.isHumanTurn && st.inHand[st.turn] > 0 -> "空いている点に置いてください(あと${st.inHand[st.turn]}個)"
        st is MorrisState && ses.isHumanTurn && st.count(st.turn) == 3 -> "コマが3つなので、どこへでも飛べます"
        st is MorrisState && ses.isHumanTurn -> "動かすコマを選び、行き先を選んでください"
        st is C4State && ses.isHumanTurn -> "同じ列を2回タップ(1回目は仮置き)"
        st is GomokuState && ses.isHumanTurn -> "置く所を2回タップ(1回目は仮置き)"
        st is HexState && ses.isHumanTurn -> if (st.turn == 0) "赤の番: 上と下をつなぎます" else "青の番: 左と右をつなぎます"
        st is HareState && ses.isHumanTurn -> if (st.turn == 0) "猟犬を選んで動かします(左へは戻れません)" else "ウサギを選んで動かします"
        st is CheckersState && ses.isHumanTurn && st.paths.any { kotlin.math.abs(it[0] / 8 - it[1] / 8) == 2 } -> "取れるコマがあります(必ず取ります)"
        // 動かせる駒がない時は、自動でパスするまでの間も案内を出す(前はパスの後に一瞬しか出なかった)
        (st is BgState || st is LudoState) && model.forcedPass -> "動かせる駒がないので、相手の番です"
        st is BgState && ses.isHumanTurn && !st.rolled -> "サイコロを振ってください"
        st is BgState && ses.isHumanTurn -> "動かす駒を選び、行き先を選んでください"
        st is BgState && st.lastMove == jp.yonekou.asobi26.core.games.Backgammon.PASS -> "動かせる駒がないので、相手の番です"
        st is LudoState && ses.isHumanTurn && st.die == 0 -> "サイコロを振ってください"
        st is LudoState && ses.isHumanTurn -> "${st.die}が出ました。動かす駒を選んでください"
        st is LudoState && ses.toMove >= 0 -> "CPU(${LUDO_NAMES[(ses.rules as jp.yonekou.asobi26.core.games.Ludo).slots[st.turn]]})の番です"
        st is CcState && ses.isHumanTurn -> "あなたの番です(${CC_NAMES[st.turn]})"
        st is CcState && ses.toMove >= 0 -> "CPU(${CC_NAMES[st.turn]})の番です"
        st is GoState && st.lastMove == (ses.rules as jp.yonekou.asobi26.core.games.Go).PASS && !st.over -> if (ses.isHumanTurn) "相手がパスしました。あなたもパスすると終局です" else "パスしました"
        st is GoState && ses.isHumanTurn -> "置く所を2回タップ(1回目は仮置き)"
        st is PokerState && ses.isHumanTurn && st.phase == 1 -> "交換する札をタップしてください"
        st is PokerState && ses.isHumanTurn -> "あなたの番です"
        st is PokerState && ses.toMove >= 0 -> "CPU${(st.turn - ses.seats.indexOfFirst { it.human } + st.players) % st.players}の番です"
        st is MemoryState && ses.isHumanTurn -> if (st.open1 < 0) "1枚目をめくってください" else "2枚目をめくってください"
        st is MemoryState && ses.toMove >= 0 -> "${seatLabel(ses, st.turn)}の番です"
        st is BjState && ses.isHumanTurn && st.phase == 0 -> "賭ける額を選んでください"
        st is BjState && ses.isHumanTurn -> "引くか止めるかを選んでください"
        st is BjState && ses.toMove >= 0 -> "${seatLabel(ses, st.turn)}の番です"
        st is SevensState && ses.isHumanTurn -> if ((ses.rules as Sevens).legalMoves(st).size > 1) "出す札をタップしてください" else "出せる札がありません"
        st is SevensState && ses.toMove >= 0 -> "${seatLabel(ses, st.turn)}の番です"
        st is DaifugoState && ses.isHumanTurn && st.phase == 0 -> "あなたの番・渡す札を選んで「渡す」"
        st is DaifugoState && ses.isHumanTurn -> if (st.field < 0) "あなたの番・好きな札を出せます(親)" else "あなたの番・出す札を選んで「出す」"
        st is DaifugoState && ses.toMove >= 0 -> "${seatLabel(ses, st.turn)}の番です"
        st is ShogiState && st.inCheck && ses.isHumanTurn -> "王手です"
        st is ShogiState && st.inCheck -> "王手!"
        st is ChessState && st.inCheck && ses.isHumanTurn -> "チェックされています"
        st is ChessState && st.inCheck -> "チェック!"
        st is YachtState && !ses.isHumanTurn && model.cpuThinking -> "${cpuName(ses, st.turn)}の番です"
        st is YachtState -> ""
        ses.isHumanTurn -> "あなたの番です"
        model.cpuThinking -> "CPUが考えています…"
        else -> ""
    }
    Box(Modifier.fillMaxWidth().height(if (st is DaifugoState) 42.dp else 30.dp), contentAlignment = Alignment.Center) {
        if (text.isNotEmpty()) {
            Text(
                text, color = c.ink, fontSize = if (st is DaifugoState) 15.sp else 13.sp,
                fontWeight = if (st is DaifugoState) FontWeight.Bold else FontWeight.Normal, textAlign = TextAlign.Center,
                modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(if (c.dark) c.chip else Color.White).padding(horizontal = 14.dp, vertical = 4.dp),
            )
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
private fun ResultPanel(model: AppModel, ses: Session<*>, gi: GameInfo, version: Int) {
    LocalTick.current
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val out = ses.outcome ?: return
    val human = viewSeat(ses)
    // 1台で交代して遊んだ時: だれが勝ったかを名前で出す(上下を反対にする設定なら、下の人から見た結果)
    val pass = model.localPass && ses.seats.count { it.human } >= 2
    val rotatePass = pass && ses.options.str("rotateTurns", "false") == "true" && ses.seats.size == 2
    val title = when {
        rotatePass -> (if (out.winner == -1) "引き分け" else if (out.winner == 0) "勝利" else "敗北") + "(${seatLabel(ses, 0)})"
        pass -> if (out.winner == -1) "引き分け" else "${seatLabel(ses, out.winner)}の勝ち"
        ses.seats.size == 1 && gi.id == "blackjack" -> when (out.winner) { 0 -> "勝ち"; -1 -> "引き分け"; else -> "負け" }
        ses.seats.size == 1 -> if (gi.id == "hitblow") (if (out.winner == 0) "正解!" else "終了") else "結果"
        out.winner == -1 -> "引き分け"
        out.winner == human -> "勝利"
        else -> "敗北"
    }
    val color = when {
        pass && !rotatePass -> c.accentInk
        out.winner == human || (ses.seats.size == 1 && out.winner == 0) -> c.accentInk
        else -> c.ink
    }
    val scores = scoresOf(ses)
    val shape = RoundedCornerShape(24.dp)
    if (model.onlineGame) {
        model.onlineTick
        val room = model.room ?: return
        Column(Modifier.fillMaxWidth().clip(shape).background(c.surface).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, color = color, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text("再戦の準備 ${room.readySlots.size}/${room.members.size}人", color = c.sub)
            BigButton(if (room.isHost) "もう一度・参加者を確認" else if (room.mySlot in room.readySlots) "準備OK・ホストを待っています" else "もう一度", Modifier.fillMaxWidth(), primary = true,
                enabled = room.isHost || room.mySlot !in room.readySlots) { model.rematch(false) }
            BigButton("同じ部屋でほかのゲーム", Modifier.fillMaxWidth()) { model.confirmRoomReturn = true }
        }
        return
    }
    // カードゲーム: 順位の表(2人以上)と、ブラックジャックひとりの結果
    if (gi.id in CARD_TABLE_GAMES && (ses.seats.size > 1 || gi.id == "blackjack")) {
        CardResultPanel(ses, gi, title, color, onAgain = { tap(); model.rematch(false) }, onHome = { tap(); model.goHome() })
        return
    }
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 10.dp).shadow(16.dp, shape).clip(shape).background(c.surface)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                FitText(title, color, FontWeight.Black, 32f, 18f, maxLines = 2)
                if (out.reason.isNotBlank()) Text(out.reason, color = c.sub, fontSize = 13.sp)
            }
            if (scores != null && scores.size == 2 && human >= 0 && gi.id != "hitblow") {
                Text("${scores[human]} - ${scores[1 - human]}", color = c.ink, fontWeight = FontWeight.Black, fontSize = 26.sp)
            }
        }
        // 交代(上下を反対にしない時): 全員の勝ち負けを同じ向きで並べる
        if (pass && !rotatePass) PassResults(ses, out.winner)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BigButton("もう一度", Modifier.weight(1f), primary = true) { tap(); model.rematch(false) }
            if (ses.seats.size == 2 && !model.onlineGame) {
                // いまと逆の順番で始める(先攻だった人は後攻に)
                BigButton(if (human == 0) "後攻でもう一度" else "先攻でもう一度", Modifier.weight(1f)) { tap(); model.rematch(true) }
            }
        }
        BigButton("ホーム", Modifier.fillMaxWidth()) { tap(); model.goHome() }
    }
}

/** 交代で遊んだ時の、全員の勝ち負け(同じ向き) */
@Composable
private fun PassResults(ses: Session<*>, winner: Int) {
    val c = LocalAsobi.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (p in ses.seats.indices) {
            val res = if (winner == -1) "引き分け" else if (p == winner) "勝ち" else "負け"
            val win = p == winner
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (win) c.accent.copy(alpha = 0.22f) else c.chip.copy(alpha = 0.6f))
                    .then(if (win) Modifier.border(2.dp, c.accent, RoundedCornerShape(12.dp)) else Modifier).padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PlayerFace(if (showsPhoto(ses, p)) LocalAvatar.current else null, ses.seats[p].human, p, 28.dp)
                Text("  " + seatLabel(ses, p), color = c.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1)
                Text(res, color = if (win) c.accentInk else c.sub, fontSize = 20.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

/** 上下を反対にして交代した時: 上の人(席1)に向けた、逆さまの勝ち負けの帯 */
@Composable
private fun TopPassBanner(ses: Session<*>, winner: Int, modifier: Modifier) {
    val c = LocalAsobi.current
    val res = if (winner == -1) "引き分け" else if (winner == 1) "勝利" else "敗北"
    val win = winner == 1
    Row(
        modifier.rotate(180f).fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp).shadow(12.dp, RoundedCornerShape(20.dp)).clip(RoundedCornerShape(20.dp))
            .background(c.surface).border(3.dp, if (win) c.accent else c.line, RoundedCornerShape(20.dp)).padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PlayerFace(null, true, 1, 36.dp)
        Text(seatLabel(ses, 1), color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1)
        Text(res, color = if (win) c.accentInk else c.ink, fontSize = 32.sp, fontWeight = FontWeight.Black)
    }
}

/** 結果の板を下からすべり込ませる(受け手なしの AnimatedVisibility) */
@Composable
private fun ResultOverlay(visible: Boolean, modifier: Modifier, content: @Composable () -> Unit) {
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = slideInVertically(tween(420)) { it } + fadeIn(tween(300)),
        exit = slideOutVertically(tween(300)) { it } + fadeOut(tween(200)),
    ) {
        content()
    }
}

/** 勝った時の紙吹雪(約2.4秒、1回だけ) */
@Composable
private fun Confetti(key: Int) {
    val anim = remember(key) { Animatable(0f) }
    LaunchedEffect(key) { anim.animateTo(1f, tween(2400, easing = LinearEasing)) }
    val p = anim.value
    if (p >= 1f) return
    val colors = listOf(Color(0xFFE05A47), Color(0xFF4A90D9), Color(0xFFF2C94C), Color(0xFF5DBB63), Color(0xFF9B6BD3), Color(0xFFFFFDF8))
    Canvas(Modifier.fillMaxSize()) {
        val rnd = JavaUtilRandom(key.toLong() * 31 + 7)
        repeat(70) { i ->
            val x0 = rnd.nextFloat() * size.width
            val speed = 0.6f + rnd.nextFloat() * 0.8f
            val delay = rnd.nextFloat() * 0.35f
            val t = ((p - delay) / (1f - delay)).coerceIn(0f, 1f)
            if (t <= 0f) return@repeat
            val y = -20f + t * speed * size.height * 1.1f
            val x = x0 + kotlin.math.sin(t * 9f + i) * 24f
            val w = 8f + rnd.nextFloat() * 8f
            rotate(t * 720f * (if (i % 2 == 0) 1 else -1), pivot = Offset(x, y)) {
                drawRect(colors[i % colors.size].copy(alpha = 1f - t * 0.6f), Offset(x - w / 2, y - w / 4), Size(w, w / 2))
            }
        }
    }
}

/** カードゲームの結果(順位の表。ブラックジャックひとりは、勝ち負けと持ち点・回数) */
@Composable
private fun CardResultPanel(ses: Session<*>, gi: GameInfo, title: String, titleColor: Color, onAgain: () -> Unit, onHome: () -> Unit) {
    val c = LocalAsobi.current
    val st = ses.state
    val human = viewSeat(ses)
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 10.dp).shadow(16.dp, shape).clip(shape).background(c.surface)
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, color = titleColor, fontWeight = FontWeight.Black, fontSize = 30.sp)
        if (st is BjState && ses.seats.size == 1) {
            val chips = st.chips[0]
            val d = chips - 1000
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Canvas(Modifier.size(22.dp)) { chipMark(center, size.minDimension / 2) }
                Text("%,d".format(chips), color = c.ink, fontWeight = FontWeight.Black, fontSize = 24.sp)
                Text(if (d > 0) "+$d" else "$d", color = if (d > 0) Color(0xFF2E8C55) else if (d < 0) Color(0xFFC8322B) else c.sub, fontWeight = FontWeight.Black, fontSize = 16.sp)
            }
            val t = st.tally[0]
            Text("${st.round}回で、勝ち${t[0]}・負け${t[1]}・引き分け${t[2]}" + (if (t[3] > 0) "\nブラックジャック${t[3]}回" else ""), color = c.sub, fontSize = 13.sp, textAlign = TextAlign.Center)
        } else {
            // 並べる順と、右に出す値
            val n = ses.seats.size
            // 並べる順・比べる数(同じなら同じ順位)・右に出す値
            class Rank(val order: List<Int>, val key: (Int) -> Int, val value: (Int) -> String, val sub: String)
            val r = when (st) {
                is DaifugoState -> Rank((0 until n).sortedByDescending { st.points[it] }, { st.points[it] }, { "${st.points[it]}点" }, "${(ses.rules as jp.yonekou.asobi26.core.games.Daifugo).rounds}回の合計点")
                is SevensState -> Rank((0 until n).sortedBy { st.place[it] }, { -st.place[it] }, { if (st.out[it]) "失格" else "上がり" }, "上がった順")
                is MemoryState -> Rank((0 until n).sortedByDescending { st.pairs[it] }, { st.pairs[it] }, { "${st.pairs[it]}組" }, "取った組の数")
                is BjState -> Rank((0 until n).sortedByDescending { st.chips[it] }, { st.chips[it] }, { "%,d".format(st.chips[it]) }, "最後の持ち点")
                is MahjongState -> Rank((0 until n).sortedByDescending{st.points[it]}, {st.points[it]*4-it}, {"${st.points[it]}点"}, "最終点数（同点は起家順）")
                is HanaState -> Rank((0 until n).sortedByDescending{st.points[it]}, {st.points[it]}, {"${st.points[it]}点"}, "合計点")
                is HoldemState -> Rank((0 until n).sortedByDescending{st.chips[it]}, {st.chips[it]}, {"${st.chips[it]}点"}, "最後の持ち点")
                is OhNoState -> Rank((0 until n).sortedBy{st.hands[it].size}, {-st.hands[it].size}, {"残り${st.hands[it].size}枚"}, "残りの手札")
                is SpeedState -> Rank((0 until n).sortedBy{st.hands[it].size+st.reserves[it].size}, {-st.hands[it].size-st.reserves[it].size}, {"残り${st.hands[it].size+st.reserves[it].size}枚"}, "残りの札")
                is SolitaireState -> Rank((0 until n).sortedByDescending{st.boards[it].foundations.sumOf{f->f.size}}, {st.boards[it].foundations.sumOf{f->f.size}}, {"組札${st.boards[it].foundations.sumOf{f->f.size}}枚"}, "組札の完成数")
                is LifeState -> { val lg = ses.rules as jp.yonekou.asobi26.core.games.Life
                    Rank(lg.ranking(st), { lg.total(st.players[it]) }, { "$" + jp.yonekou.asobi26.core.games.Life.fmt(lg.total(st.players[it])) }, "家(買値の3倍)・お宝を売り、手形を返した後のお金") }
                is PokerState -> Rank((0 until n).sortedByDescending { st.chips[it] }, { st.chips[it] }, { "%,d".format(st.chips[it]) }, "最後の持ち点")
                else -> Rank((0 until n).toList(), { 0 }, { "" }, "")
            }
            Text(r.sub, color = c.sub, fontSize = 12.sp)
            var rank = 0
            var prevKey: Int? = null
            for ((i, p) in r.order.withIndex()) {
                val v = r.value(p)
                val key = r.key(p)
                if (key != prevKey) rank = i + 1
                prevKey = key
                val mine = p == human
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(if (mine) c.accent.copy(alpha = 0.18f) else c.chip.copy(alpha = 0.5f))
                        .then(if (mine) Modifier.border(2.dp, c.accent, RoundedCornerShape(12.dp)) else Modifier)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(if (rank == 1) "1位" else "${rank}位", color = if (rank == 1) c.accentInk else c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(34.dp))
                    PlayerFace(if (showsPhoto(ses, p)) LocalAvatar.current else null, ses.seats[p].human, ses.seats.take(p).count { !it.human }, 28.dp)
                    Text(seatLabel(ses, p), color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1)
                    if (st is DaifugoState) st.lastPlaces?.let { lp ->
                        Text(dfTitle(lp[p], n), color = Color(0xFF3A2400), fontSize = 10.sp, fontWeight = FontWeight.Black,
                            modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(ACCENT).padding(horizontal = 5.dp, vertical = 1.dp))
                    }
                    Text(v, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black)
                }
            }
        }
        BigButton("もう一度", Modifier.fillMaxWidth(), primary = true) { onAgain() }
        BigButton("ホーム", Modifier.fillMaxWidth()) { onHome() }
    }
}
