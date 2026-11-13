package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Hanafuda
import jp.yonekou.asobi26.core.games.Holdem
import jp.yonekou.asobi26.core.games.Mahjong
import jp.yonekou.asobi26.core.games.OhNo
import jp.yonekou.asobi26.core.games.Solitaire
import jp.yonekou.asobi26.core.games.Speed
import kotlinx.coroutines.delay

/** 始まる時に札を切る音を鳴らすゲーム */
private val SHUFFLE_GAMES = setOf("hanafuda", "speed", "holdem", "uno", "solitaire", "daifugo", "sevens", "poker", "memory", "blackjack")

/** 盤の中で音を鳴らしていないゲームの、手ごとの音(null = 鳴らさない) */
private fun moveSound(id: String, m: Int): Sound? = when (id) {
    "mahjong" -> when (m) { Mahjong.PASS -> null; Mahjong.NEXT -> Sound.MJ_MIX; else -> Sound.MJ }
    "hanafuda" -> when (m) { Hanafuda.NEXT -> Sound.SHUFFLE; Hanafuda.KOI, Hanafuda.STOP -> null; else -> Sound.HANA }
    "holdem" -> when (m) { Holdem.NEXT -> Sound.SHUFFLE; Holdem.FOLD -> Sound.DEAL; else -> Sound.CHIP }
    "uno" -> when (m) { OhNo.DRAW -> Sound.DEAL; OhNo.PASS, OhNo.DECLARE -> null; else -> Sound.CARD }
    "speed" -> if (m % Speed.SEAT == Speed.RESET) Sound.DEAL else Sound.CARD
    "solitaire" -> when (m % Solitaire.SEAT) { Solitaire.DRAW -> Sound.DEAL; Solitaire.GIVE_UP -> null; else -> Sound.CARD }
    else -> null
}

/**
 * 対局の音のうち、盤の部品が鳴らしていないもの:
 * 始まる時に札を切る音(麻雀は牌を混ぜる音)と、麻雀・花札・テキサスポーカー・Oh, No!・スピード・ソリティアの手ごとの音。
 */
@Composable
fun MoveSounds(ses: Session<*>, version: Int) {
    val sfx = LocalSfx.current
    val id = ses.def.id
    var seen by remember(ses) { mutableIntStateOf(ses.moves.size) }
    LaunchedEffect(ses) {
        if (ses.moves.isEmpty()) {
            delay(250)
            if (id == "mahjong") sfx?.play(Sound.MJ_MIX) else if (id in SHUFFLE_GAMES) sfx?.play(Sound.SHUFFLE)
        }
    }
    LaunchedEffect(version) {
        val n = ses.moves.size
        if (n > seen) moveSound(id, ses.moves[n - 1])?.let { sfx?.play(it) }
        seen = n
    }
}

private val COUNT_RED = Color(0xFFD6332B)

/**
 * 制限時間のカウントダウンの演出(盤の操作はじゃましない):
 * - 画面の下の端に、残り時間の帯(減っていく。残り10秒から赤)
 * - 自分の番で残り10秒から、1秒ごとに木の「コッ」。残り3秒からは高く強い音
 * - 自分の番で残り5秒から、画面の真ん中に大きな数字(1秒ごとに縮みながら薄くなる)と、画面のふちの赤い光
 * - 時間が切れたら、拍子木の音と「時間切れ」の帯
 */
@Composable
fun BoxScope.CountdownOverlay(model: AppModel, ses: Session<*>) {
    LocalTick.current
    val total = ses.options.int("moveSeconds", 0)
    if (total <= 0) return
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val left = model.clockRemaining
    val running = left >= 0 && ses.outcome == null && model.reviewMove == null
    val mine = running && ses.isHumanTurn && !model.handover
    var prev by remember(ses) { mutableIntStateOf(-1) }
    var timeUp by remember(ses) { mutableStateOf<String?>(null) }
    LaunchedEffect(left, mine) {
        if (mine && left in 1..10 && left != prev) sfx?.play(if (left <= 3) Sound.COUNT_LAST else Sound.COUNT)
        prev = left
    }
    // 時間切れの合図は AppModel から受け取る(残り0秒はすぐ次の手番の秒数に変わるので、画面からは見えないことがある)
    val up = model.timeUp
    val seenUp = remember(ses) { model.timeUp?.seq ?: 0 }
    LaunchedEffect(up?.seq) {
        if (up == null || up.seq <= seenUp) return@LaunchedEffect
        timeUp = if (up.lose) "${if (up.seat in ses.seats.indices) seatLabel(ses, up.seat) else ""}の負けです" else "かわりに一手進めます"
        sfx?.play(Sound.TIMEUP, volume = if (ses.seats.getOrNull(up.seat)?.human == true) 1f else 0.6f)
        delay(1500)
        timeUp = null
    }

    // 下の端の帯
    if (running) {
        val frac by animateFloatAsState((left.toFloat() / total).coerceIn(0f, 1f), tween(if (left >= total) 0 else 1000, easing = LinearEasing), label = "clock")
        val hot = left <= 10
        Box(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().fillMaxWidth().height(5.dp).background(c.line.copy(alpha = 0.5f)).testTag("clockBar")) {
            Box(Modifier.fillMaxWidth(frac).fillMaxHeight().background(if (hot) COUNT_RED else c.accent))
        }
    }
    // 残り5秒から: ふちの赤い光と、真ん中の大きな数字
    if (mine && left in 1..5) {
        val pulse = remember { Animatable(0f) }
        LaunchedEffect(left) { pulse.snapTo(0f); pulse.animateTo(1f, tween(900, easing = FastOutSlowInEasing)) }
        val p = pulse.value
        Box(Modifier.fillMaxSize().drawBehind {
            val a = (0.5f * (1f - p)).coerceIn(0f, 1f) * (if (left <= 3) 1f else 0.7f)
            val w = size.minDimension * 0.16f
            drawRect(Brush.verticalGradient(listOf(COUNT_RED.copy(alpha = a), Color.Transparent), endY = w), size = Size(size.width, w))
            drawRect(Brush.verticalGradient(listOf(Color.Transparent, COUNT_RED.copy(alpha = a)), startY = size.height - w, endY = size.height), Offset(0f, size.height - w), Size(size.width, w))
            drawRect(Brush.horizontalGradient(listOf(COUNT_RED.copy(alpha = a), Color.Transparent), endX = w), size = Size(w, size.height))
            drawRect(Brush.horizontalGradient(listOf(Color.Transparent, COUNT_RED.copy(alpha = a)), startX = size.width - w, endX = size.width), Offset(size.width - w, 0f), Size(w, size.height))
        })
        Text(
            "$left", color = COUNT_RED, fontSize = 150.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.Center).testTag("countNumber").graphicsLayer {
                val s = 1.5f - 0.5f * p
                scaleX = s; scaleY = s
                alpha = (0.75f * (1f - p * p)).coerceIn(0f, 1f)
            },
        )
    }
    // 時間切れの帯
    timeUp?.let { sub ->
        val a = remember(sub) { Animatable(0f) }
        LaunchedEffect(sub) { a.animateTo(1f, tween(180)) }
        Box(
            Modifier.align(Alignment.Center).fillMaxWidth(1.15f).height(104.dp).rotate(-5f).alpha(a.value)
                .background(COUNT_RED).border(4.dp, Color(0xFFFFD94F)).testTag("timeUpBand"),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("時間切れ", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
                Text(sub, color = Color(0xFFFFE9A8), fontSize = 13.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

/** 通信の「待った」: 返事を集めている間の窓と、結果の知らせ */
@Composable
fun BoxScope.OnlineUndoOverlay(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(true)
    model.undoAsk?.let { ask ->
        AlertDialog(
            onDismissRequest = {}, containerColor = c.surface,
            title = { Text("${if (ask.mine) "あなた" else ask.name}が「待った」を押しました。") },
            text = {
                Text(
                    when {
                        ask.mine -> "全員が了承すると戻ります。返事を待っています…"
                        ask.answered -> "ほかの人の返事を待っています…"
                        else -> "了承すると、${ask.name}が前に指した所まで戻ります。1人でも了承しなければ、そのまま続けます。"
                    },
                )
            },
            confirmButton = { if (!ask.mine && !ask.answered) TextButton(onClick = { tap(); model.answerUndo(true) }, modifier = Modifier.testTag("undoYes")) { Text("了承する") } },
            dismissButton = { if (!ask.mine && !ask.answered) TextButton(onClick = { tap(); model.answerUndo(false) }, modifier = Modifier.testTag("undoNo")) { Text("了承しない") } },
        )
    }
    model.flash?.let { text ->
        Text(
            text, color = c.onSelect, fontSize = 13.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 64.dp, start = 24.dp, end = 24.dp)
                .clip(RoundedCornerShape(14.dp)).background(c.select).padding(horizontal = 16.dp, vertical = 10.dp).testTag("flash"),
        )
    }
}
