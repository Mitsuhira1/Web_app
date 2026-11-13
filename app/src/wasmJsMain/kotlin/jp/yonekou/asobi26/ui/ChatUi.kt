package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.core.Compat
import jp.yonekou.asobi26.core.Session
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/** 吹き出しを出しておく長さ[ミリ秒] */
private const val BUBBLE_MS = 4000L

/** 上の帯のチャットのボタン(未読の赤い数字つき)。古い版の人がいる時は薄くして、押すと理由を出す */
@Composable
fun ChatButton(model: AppModel) {
    val tap = rememberTap(model.tapSound)
    val ok = model.chatSupported
    Box {
        Box(Modifier.alpha(if (ok) 1f else 0.38f).testTag("chatButton")) {
            IconChip(AppIcons.Chat, "チャット") {
                tap()
                if (ok) model.openChat(true) else model.notifyChatUnsupported()
            }
        }
        if (ok && model.chatUnread > 0) Text(
            if (model.chatUnread > 99) "99+" else "${model.chatUnread}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.TopEnd).offset(4.dp, (-4).dp).clip(RoundedCornerShape(9.dp)).background(BADGE_RED).padding(horizontal = 5.dp, vertical = 1.dp).testTag("chatBadge"),
        )
    }
}

/** 通知を出しておく長さ[ミリ秒] */
private const val BANNER_MS = 3000L

/**
 * チャットの通知と窓(対局画面・部屋の画面の上に重ねる)。
 * 通知は画面の上に LINE のように出して、3秒で消える(横か上へのスワイプでも消せる)。自分が送ったものは出さない(窓の履歴で見る)。
 * 通知はほかのボタンに重なってよい。通知の部分への操作はスワイプだけを見て、タップは下のボタンへ通す。
 */
@Composable
fun BoxScope.ChatOverlay(model: AppModel) {
    ChatBanner(model)
    if (model.chatOpen) ChatSheet(model)
}

@Composable
private fun BoxScope.ChatBanner(model: AppModel) {
    val latest = model.chatLog.lastOrNull()
    var shown by remember { mutableStateOf<AppModel.ChatItem?>(null) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(latest?.id) {
        val m = latest ?: return@LaunchedEffect
        // 自分のもの・窓を開いている間・昔のもの(画面に戻った時の履歴)は出さない
        if (m.mine || model.chatOpen || SystemClock.elapsedRealtime() - m.at > 1500) return@LaunchedEffect
        shown = m; visible = true
        delay(BANNER_MS)
        visible = false
    }
    androidx.compose.animation.AnimatedVisibility(
        visible = visible && !model.chatOpen,
        modifier = Modifier.align(Alignment.TopCenter),
        enter = androidx.compose.animation.slideInVertically { -it } + androidx.compose.animation.fadeIn(),
        exit = androidx.compose.animation.slideOutVertically { -it } + androidx.compose.animation.fadeOut(),
    ) {
        val m = shown
        if (m != null) Banner(m, Modifier.then(SwipeAwayElement(LocalDensity.current.density * 36f) { visible = false }))
    }
}

@Composable
private fun Banner(m: AppModel.ChatItem, modifier: Modifier) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(18.dp)
    Row(
        modifier.statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp).fillMaxWidth()
            .clip(shape).background(c.surface).border(1.5.dp, c.ink.copy(alpha = 0.85f), shape)
            .padding(horizontal = 12.dp, vertical = 9.dp).testTag("chatBanner"),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(34.dp).clip(androidx.compose.foundation.shape.CircleShape).background(c.select), contentAlignment = Alignment.Center) {
            androidx.compose.material3.Icon(AppIcons.Chat, contentDescription = null, tint = c.onSelect, modifier = Modifier.size(20.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(m.name, color = c.sub, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            if (m.kind == 1) Text(STAMPS.getOrNull(m.body.toIntOrNull() ?: 0)?.label ?: "", color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black, maxLines = 1)
            else Text(m.body, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        }
        if (m.kind == 1) StampArt(m.body.toIntOrNull() ?: 0, 44.dp)
    }
}

/**
 * 横か上へのスワイプで onDismiss を呼ぶ。タップは消費せず、下に重なっているボタンへ通す
 * (sharePointerInputWithSiblings)。
 */
private class SwipeAwayElement(val limit: Float, val onDismiss: () -> Unit) : androidx.compose.ui.node.ModifierNodeElement<SwipeAwayNode>() {
    override fun create() = SwipeAwayNode(limit, onDismiss)
    override fun update(node: SwipeAwayNode) { node.limit = limit; node.onDismiss = onDismiss }
    override fun equals(other: Any?) = other is SwipeAwayElement && other.limit == limit && other.onDismiss == onDismiss
    override fun hashCode() = onDismiss.hashCode() * 31 + limit.hashCode()
}

private class SwipeAwayNode(var limit: Float, var onDismiss: () -> Unit) : Modifier.Node(), androidx.compose.ui.node.PointerInputModifierNode {
    private var start: Offset? = null
    private var done = false
    override fun sharePointerInputWithSiblings() = true
    override fun onCancelPointerInput() { start = null }
    override fun onPointerEvent(pointerEvent: androidx.compose.ui.input.pointer.PointerEvent, pass: androidx.compose.ui.input.pointer.PointerEventPass, bounds: androidx.compose.ui.unit.IntSize) {
        if (pass != androidx.compose.ui.input.pointer.PointerEventPass.Main) return
        val ch = pointerEvent.changes.firstOrNull() ?: return
        val s = start
        when {
            ch.pressed && !ch.previousPressed -> { start = ch.position; done = false }
            ch.pressed && s != null && !done -> {
                val d = ch.position - s
                if (kotlin.math.abs(d.x) > limit || d.y < -limit) { done = true; onDismiss() }
            }
            !ch.pressed -> start = null
        }
    }
}

@Composable
private fun BoxScope.ChatSheet(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    BackHandler { model.openChat(false) }
    var tab by remember { mutableStateOf(0) }
    var text by remember { mutableStateOf("") }
    val none = remember { MutableInteractionSource() }
    // 後ろを暗くして、外をタップしても閉じる
    Box(Modifier.fillMaxSize().background(Color(0x59000000)).clickable(indication = null, interactionSource = none) { model.openChat(false) })
    val shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    Column(
        Modifier.align(Alignment.BottomCenter).fillMaxWidth().imePadding().fillMaxHeight(0.76f)
            .background(c.surface, shape).border(1.5.dp, c.ink.copy(alpha = 0.85f), shape)
            .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { }
            .navigationBarsPadding().testTag("chatSheet"),
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("チャット", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            IconChip(AppIcons.Close, "閉じる") { tap(); model.openChat(false) }
        }
        // 履歴(新しいものが下)
        val listState = rememberLazyListState()
        val log = model.chatLog
        LaunchedEffect(log.lastOrNull()?.id, model.chatOpen) { if (log.isNotEmpty()) listState.scrollToItem(log.size - 1) }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (log.isEmpty()) Text("まだ何もありません。\n文字かスタンプを送ってみましょう。", color = c.sub, fontSize = 12.sp, lineHeight = 20.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.align(Alignment.Center))
            else LazyColumn(Modifier.fillMaxSize().testTag("chatLog"), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(log, key = { it.id }) { m -> MessageRow(m) }
            }
        }
        Segmented(listOf(0 to "文字", 1 to "スタンプ"), tab, { tap(); tab = it }, Modifier.padding(horizontal = 14.dp))
        if (tab == 0) {
            Text("${text.length} / ${Compat.CHAT_MAX}", color = c.sub, fontSize = 10.sp, modifier = Modifier.align(Alignment.End).padding(end = 16.dp, top = 4.dp))
            fun send() { if (text.isNotBlank() && model.sendChat(0, text)) text = "" }
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 2.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    text, { v -> text = v.replace("\n", " ").take(Compat.CHAT_MAX) }, Modifier.weight(1f).testTag("chatInput"), singleLine = true,
                    placeholder = { Text("メッセージ", color = c.sub) }, shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { send() }),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = c.ink, unfocusedTextColor = c.ink, focusedBorderColor = c.accent, unfocusedBorderColor = c.line, cursorColor = c.accent),
                )
                val on = text.isNotBlank()
                Box(
                    Modifier.height(52.dp).clip(RoundedCornerShape(12.dp)).background(if (on) c.select else c.select.copy(alpha = 0.3f))
                        .clickable(enabled = on) { tap(); send() }.padding(horizontal = 18.dp).testTag("chatSend"),
                    contentAlignment = Alignment.Center,
                ) { Text("送る", color = c.onSelect, fontSize = 14.sp, fontWeight = FontWeight.Black) }
            }
        } else {
            Column(Modifier.fillMaxWidth().height(290.dp).verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (row in STAMPS.indices.chunked(4)) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (i in row) Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(c.bg).border(1.dp, c.line, RoundedCornerShape(14.dp))
                            .clickable { tap(); model.sendChat(1, i.toString()); model.openChat(false) }.padding(vertical = 5.dp).testTag("stamp$i"),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        StampArt(i, 52.dp)
                        Text(STAMPS[i].label, color = c.ink, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageRow(m: AppModel.ChatItem) {
    val c = LocalAsobi.current
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (m.mine) Alignment.End else Alignment.Start) {
        Text(m.name, color = c.sub, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
        if (m.kind == 1) StampArt(m.body.toIntOrNull() ?: 0, 60.dp)
        else Text(
            m.body, color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, lineHeight = 19.sp,
            modifier = Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(14.dp))
                .background(if (m.mine) c.accent.copy(alpha = 0.28f).compositeOver(c.surface) else c.bg)
                .border(1.dp, if (m.mine) c.accent else c.line, RoundedCornerShape(14.dp)).padding(horizontal = 11.dp, vertical = 7.dp),
        )
    }
}
