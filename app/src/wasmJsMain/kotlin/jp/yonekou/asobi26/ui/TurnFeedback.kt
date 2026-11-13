package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.core.Session
import kotlinx.coroutines.delay

/** 局面内での選択やサイコロ操作では再通知しない。手番が移った時だけ作り直す。 */
class TurnAttention {
    var touched = false
    var announced = false
    var vibrated = false
    fun shouldVibrate(): Boolean = !touched && !vibrated
    companion object {
        fun timeout(gameId: String): Long = if (gameId in setOf("ludo", "daifugo", "sevens", "poker", "memory", "blackjack")) 5_000 else 15_000
    }
}

@Composable
fun TurnFeedback(model: AppModel, ses: Session<*>, attention: TurnAttention, activity: Int) {
    val c = LocalAsobi.current
    val context = LocalContext.current
    val resumed by pageVisibleState()
    var cutIn by remember(attention) { mutableStateOf(false) }
    val ready = ses.isHumanTurn && ses.outcome == null && !model.handover && !model.animating && !model.forcedPass && model.reviewMove==null && resumed
    LaunchedEffect(attention, ready) {
        if (!ready) { cutIn = false; return@LaunchedEffect }
        if (!attention.announced) {
            attention.announced = true; cutIn = true
            delay(900); cutIn = false
        }
    }
    LaunchedEffect(attention, ready, activity) {
        if (!ready || !attention.shouldVibrate()) return@LaunchedEffect
        delay(TurnAttention.timeout(ses.def.id))
        if (attention.shouldVibrate() && ses.isHumanTurn && ses.outcome == null && resumed) {
            attention.vibrated = true
            vibrate(150)
        }
    }
    if (cutIn) TurnCutIn(if (model.localPass) "${ses.seats[ses.toMove].name}の番です" else "あなたの番です", if (showsPhoto(ses, ses.toMove)) model.avatar else null, attention)
}

/** 手番のカットイン: 紺の斜めの帯が左から入って止まり、右へ抜ける(黄の縁取り・顔の丸) */
@Composable
private fun TurnCutIn(text: String, avatar: androidx.compose.ui.graphics.ImageBitmap?, key: Any) {
    val t = remember(key) { androidx.compose.animation.core.Animatable(0f) }
    val sfx = LocalSfx.current
    LaunchedEffect(key) { sfx?.play(jp.yonekou.asobi26.audio.Sound.TURN) }
    LaunchedEffect(key) { t.animateTo(1f, androidx.compose.animation.core.tween(900, easing = androidx.compose.animation.core.LinearEasing)) }
    val p = t.value
    // 0〜0.22: 入る、0.22〜0.8: 止まる、0.8〜1: 抜ける
    val slide = when {
        p < 0.22f -> -1f + androidx.compose.animation.core.FastOutSlowInEasing.transform(p / 0.22f)
        p < 0.8f -> 0f
        else -> androidx.compose.animation.core.FastOutLinearInEasing.transform((p - 0.8f) / 0.2f)
    }
    val navy = Color(0xFF1C2747)
    val gold = Color(0xFFFFC845)
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        val w = maxWidth
        Box(
            Modifier.fillMaxWidth().height(92.dp).graphicsLayer { translationX = slide * w.toPx() * 1.1f; rotationZ = -4f }.testTag("turnCutIn")
                .drawBehind {
                    val k = size.height * 0.25f
                    // 斜めの帯(平行四辺形)と、上下の黄の線
                    val band = androidx.compose.ui.graphics.Path().apply { moveTo(-k, 0f); lineTo(size.width + k * 2, 0f); lineTo(size.width + k, size.height); lineTo(-k * 2, size.height); close() }
                    drawPath(band, Color(0x55000000), alpha = 1f)
                    translate(0f, -6f) { drawPath(band, navy) }
                    drawRect(gold, Offset(0f, -6f), androidx.compose.ui.geometry.Size(size.width, 5.dp.toPx()))
                    drawRect(gold, Offset(0f, size.height - 6f - 5.dp.toPx()), androidx.compose.ui.geometry.Size(size.width, 5.dp.toPx()))
                },
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center, modifier = Modifier.offset(y = (-3).dp)) {
                Box(Modifier.size(58.dp).clip(CircleShape).background(gold).padding(3.dp)) { PlayerFace(avatar, true, 0, 52.dp) }
                Spacer(Modifier.width(14.dp))
                Text(text, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}
