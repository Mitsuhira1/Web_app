package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.OhNo
import jp.yonekou.asobi26.core.games.OhNoState
import kotlinx.coroutines.delay

// =====================================================================
// Oh, No!(見本 2026-11-11 を了承済み: このアプリだけの札の柄・山札をタップで引く・いつでも押せる Oh, No!・PASS の丸ボタン)
// =====================================================================

/** 札の色(赤・黄・緑・青・ワイルドの黒) */
val OHNO_COLORS = listOf(Color(0xFFE0453A), Color(0xFFF2B629), Color(0xFF2E9E5B), Color(0xFF2F6FD0), Color(0xFF23232D))
private val OHNO_NAMES = listOf("赤", "黄", "緑", "青")

/** 札1枚をかく。chosen: 場のワイルドで決まった色(-1 = まだ) */
fun DrawScope.ohNoCard(tm: TextMeasurer, card: Int, chosen: Int = -1, at: Offset = Offset.Zero, cw: Float = size.width, ch: Float = size.height) = translate(at.x, at.y) {
    val w = cw; val h = ch
    val r = w * 0.14f
    drawRoundRect(Color.White, Offset.Zero, Size(w, h), CornerRadius(r))
    val pad = w * 0.06f
    val v = OhNo.value(card)
    val wild = v >= 13
    val col = if (wild && chosen in 0..3) OHNO_COLORS[chosen] else OHNO_COLORS[OhNo.color(card)]
    val inner = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(pad, pad, w - pad, h - pad, CornerRadius(r * 0.7f))) }
    clipPath(inner) {
        drawRect(col)
        // 白い斜めの帯
        rotate(-24f, Offset(w / 2, h / 2)) { drawRect(Color.White.copy(alpha = 0.18f), Offset(-w * 0.3f, h * 0.36f), Size(w * 1.6f, h * 0.28f)) }
    }
    val c = Offset(w / 2, h / 2)
    val idx = when (v) { 10 -> "⊘"; 11 -> "⇄"; 12 -> "+2"; 13 -> "W"; 14 -> "+4"; else -> "$v" }
    fun label(text: String, at: Offset, size: Float, color: Color, center: Boolean = true) {
        val lay = tm.measure(text, TextStyle(color = color, fontSize = (size / density).sp, fontWeight = FontWeight.Black))
        drawText(lay, topLeft = if (center) at - Offset(lay.size.width / 2f, lay.size.height / 2f) else at)
    }
    label(idx, Offset(pad * 1.6f, pad * 0.9f), w * 0.2f, Color.White, center = false)
    rotate(180f, c) { label(idx, Offset(pad * 1.6f, pad * 0.9f), w * 0.2f, Color.White, center = false) }
    if (wild && chosen !in 0..3) {
        // 4色の羽根
        val pr = w * 0.33f
        for (i in 0 until 4) drawArc(OHNO_COLORS[listOf(0, 1, 3, 2)[i]], -180f + i * 90f, 90f, true, c - Offset(pr, pr), Size(pr * 2, pr * 2))
        if (v == 14) label("+4", c + Offset(0f, pr * 0.62f), w * 0.26f, Color.White)
        return@translate
    }
    // 白いひし形
    val d = w * 0.36f
    val dia = Path().apply { moveTo(c.x, c.y - d); lineTo(c.x + d, c.y); lineTo(c.x, c.y + d); lineTo(c.x - d, c.y); close() }
    drawPath(dia, Color.White)
    when (v) {
        10 -> { drawCircle(col, d * 0.42f, c, style = Stroke(d * 0.13f)); drawLine(col, c + Offset(-d * 0.3f, d * 0.3f), c + Offset(d * 0.3f, -d * 0.3f), d * 0.13f) }
        11 -> {
            val rr = d * 0.38f
            drawArc(col, 200f, 140f, false, c - Offset(rr, rr), Size(rr * 2, rr * 2), style = Stroke(d * 0.12f))
            drawArc(col, 20f, 140f, false, c - Offset(rr, rr), Size(rr * 2, rr * 2), style = Stroke(d * 0.12f))
            val a = d * 0.16f
            drawPath(Path().apply { moveTo(c.x + rr * 0.77f, c.y - rr * 0.64f); lineTo(c.x + rr * 0.77f + a, c.y - rr * 0.64f + a * 0.2f); lineTo(c.x + rr * 0.77f - a * 0.2f, c.y - rr * 0.64f + a); close() }, col)
            drawPath(Path().apply { moveTo(c.x - rr * 0.77f, c.y + rr * 0.64f); lineTo(c.x - rr * 0.77f - a, c.y + rr * 0.64f - a * 0.2f); lineTo(c.x - rr * 0.77f + a * 0.2f, c.y + rr * 0.64f - a); close() }, col)
        }
        else -> {
            label(if (v >= 12) idx else "$v", c, if (v >= 12) w * 0.3f else w * 0.4f, col)
            // 6と9は下に線(逆さでも区別できるように)
            if (v == 6 || v == 9) drawLine(col, c + Offset(-w * 0.08f, w * 0.17f), c + Offset(w * 0.08f, w * 0.17f), w * 0.035f)
        }
    }
    if (wild) {
        // 決まった色のワイルド: 右下に小さな4色の羽根
        val pr = w * 0.1f
        val pc = Offset(w - pad - pr * 1.4f, h - pad - pr * 1.4f)
        for (i in 0 until 4) drawArc(OHNO_COLORS[listOf(0, 1, 3, 2)[i]], -180f + i * 90f, 90f, true, pc - Offset(pr, pr), Size(pr * 2, pr * 2))
        drawCircle(Color.White, pr, pc, style = Stroke(2f))
    }
}

/** 札の裏 */
fun DrawScope.ohNoBack(tm: TextMeasurer) {
    val w = size.width; val h = size.height
    drawRoundRect(Color.White, Offset.Zero, size, CornerRadius(w * 0.14f))
    val pad = w * 0.06f
    drawRoundRect(Color(0xFF1B1F2C), Offset(pad, pad), Size(w - 2 * pad, h - 2 * pad), CornerRadius(w * 0.1f))
    rotate(-24f, Offset(w / 2, h / 2)) {
        val lay = tm.measure("Oh,No!", TextStyle(color = Color(0xFFFFD94F), fontSize = (w * 0.22f / density).sp, fontWeight = FontWeight.Black))
        val o = Offset(w / 2 - lay.size.width / 2f, h / 2 - lay.size.height / 2f)
        drawText(tm.measure("Oh,No!", TextStyle(color = Color(0xFFD6332B), fontSize = (w * 0.22f / density).sp, fontWeight = FontWeight.Black)), topLeft = o + Offset(2f, 2f))
        drawText(lay, topLeft = o)
    }
}

@Composable
internal fun OhNoCardView(card: Int, w: Dp, chosen: Int = -1, modifier: Modifier = Modifier) {
    val tm = rememberTextMeasurer()
    Canvas(modifier.size(w, w * 1.45f).semantics { contentDescription = if (card < 0) "裏向きの札" else OhNo.label(card) }) {
        if (card < 0) ohNoBack(tm) else ohNoCard(tm, card, chosen)
    }
}

@Composable
fun OhNoBoard(ses: Session<OhNoState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit = {}) {
    val shown = LocalBoardShown.current
    LaunchedEffect(version) { shown(version) }
    val s = ses.state
    val me = viewSeat(ses)
    val g = ses.rules as OhNo
    val mine = enabled && s.turn == me && s.winner < 0
    val legal = if (mine) g.legalMoves(s).toSet() else emptySet()
    val hand = s.hands[me]
    var selected by remember(ses, version) { mutableIntStateOf(-1) }
    var sorted by remember(ses) { mutableStateOf(false) }
    var picking by remember(ses, version) { mutableStateOf(false) }
    // 見せる順(並べ替えは見た目だけ。手の番号は元の位置)
    val order = if (sorted) hand.indices.sortedWith(compareBy({ OhNo.color(hand[it]) }, { OhNo.value(hand[it]) })) else hand.indices.toList()
    fun canPlay(i: Int) = legal.any { it >= OhNo.PLAY && (it - OhNo.PLAY) / 4 == i }
    val onlyPass = mine && legal.none { it >= OhNo.PLAY || it == OhNo.DRAW } && OhNo.PASS in legal
    Column(Modifier.fillMaxSize().testTag("ohNoBoard")) {
        CardTableBox(Modifier.weight(1f).fillMaxWidth()) {
            val W = maxWidth
            val H = maxHeight
            // 全員の席(残りの枚数・Oh, No! の宣言・番・回る向き)は、画面上部の帯に出す
            // 場: 山札と捨て札
            val cw = minOf(74.dp, W * 0.2f)
            val top = H * 0.05f
            val canDraw = OhNo.DRAW in legal
            Row(Modifier.fillMaxWidth().offset(y = top), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.clickable(enabled = canDraw) { onMove(OhNo.DRAW) }.testTag("ohNoStock")) {
                        OhNoCardView(-1, cw, modifier = Modifier.offset(4.dp, 4.dp))
                        OhNoCardView(-1, cw, modifier = Modifier.offset(2.dp, 2.dp))
                        OhNoCardView(-1, cw)
                    }
                    Text(if (s.pending > 0 && canDraw) "タップで${s.pending}枚引く" else "タップで引く", color = if (canDraw) Color(0xFF3A2A00) else Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(top = 6.dp).clip(RoundedCornerShape(50)).background(if (canDraw) Color(0xFFFFD94F) else Color(0x66000000)).padding(horizontal = 9.dp, vertical = 1.dp))
                }
                Spacer(Modifier.width(26.dp))
                val cur = OHNO_COLORS[s.color.coerceIn(0, 3)]
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.border(4.dp, cur, RoundedCornerShape(14.dp)).border(6.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(14.dp)).padding(9.dp)) {
                        OhNoCardView(s.discard.last(), cw, chosen = if (OhNo.value(s.discard.last()) >= 13) s.color else -1, modifier = Modifier.testTag("ohNoDiscard"))
                    }
                    Row(Modifier.padding(top = 4.dp).clip(RoundedCornerShape(50)).background(Color(0x59000000)).padding(horizontal = 8.dp, vertical = 1.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(13.dp).clip(CircleShape).background(cur).border(2.dp, Color.White, CircleShape))
                        Text(" いまの色: ${OHNO_NAMES[s.color.coerceIn(0, 3)]}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
            // 直前の出来事・向き
            val info = (if (s.lastMover >= 0) "${seatLabel(ses, s.lastMover)}: ${s.lastAction}" else "") + if (s.pending > 0) "　次の人は${s.pending}枚" else ""
            Text(info, color = Color(0xFFEAF7EF), fontSize = 12.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().offset(y = top + cw * 1.45f + 44.dp))
            // 手札(重ねて1列。スクロールなしで全部見える)
            val hw = minOf(76.dp, W * 0.21f)
            val n = order.size
            val span = W - 12.dp
            val step = if (n > 1) minOf(hw + 4.dp, (span - hw) / (n - 1)) else 0.dp
            val total = hw + step * (n - 1).coerceAtLeast(0)
            Text("あなたの手札 ${n}枚" + if (s.declared == me) "　Oh, No! 宣言済み" else "", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 8.dp, bottom = hw * 1.45f + 30.dp))
            Box(Modifier.align(Alignment.BottomCenter).width(total).height(hw * 1.45f + 22.dp)) {
                order.forEachIndexed { k, i ->
                    val ok = canPlay(i)
                    val up = selected == i
                    OhNoCardView(hand[i], hw, modifier = Modifier.offset(x = step * k, y = if (up) 0.dp else 18.dp)
                        .clip(RoundedCornerShape(hw * 0.14f))
                        .drawWithContent { drawContent(); if (mine && !ok) drawRect(Color(0x8C000000)) }
                        .then(if (up) Modifier.border(3.dp, Color(0xFFFFD94F), RoundedCornerShape(10.dp)) else Modifier)
                        .clickable(enabled = mine && ok) { selected = if (selected == i) -1 else i }
                        .testTag("ohNoHand-$k"))
                }
            }
            // パスしか手がない時: 中央に赤くて丸い PASS
            if (onlyPass) Box(
                Modifier.align(Alignment.Center).offset(y = H * 0.12f).size(118.dp).clip(CircleShape)
                    .background(safeRadial(listOf(Color(0xFFFF6A5F), Color(0xFFC8221A))))
                    .border(5.dp, Color.White, CircleShape).clickable { onMove(OhNo.PASS) }.testTag("ohNoPass"),
                contentAlignment = Alignment.Center,
            ) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("PASS", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black); Text("タップでパス", color = Color.White, fontSize = 11.sp) } }
            // 7で手札交換: 相手を選ぶ
            if (mine && s.swapping) ChoicePanel("手札を取りかえる相手を選ぶ") {
                for (m in legal.filter { it >= OhNo.SWAP && it < OhNo.PLAY }.sorted()) {
                    val p = m - OhNo.SWAP
                    PanelButton("${seatLabel(ses, p)}(${s.hands[p].size}枚)", Color.White, Color(0xFF1D2433)) { onMove(m) }
                }
            }
            // ワイルドの色を選ぶ
            if (picking && selected in hand.indices) ChoicePanel("ワイルド: 色を選ぶ", onDismiss = { picking = false }) {
                for (row in 0..1) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for (col in row * 2..row * 2 + 1) PanelButton(OHNO_NAMES[col], OHNO_COLORS[col], Color.White, Modifier.weight(1f)) { picking = false; onMove(OhNo.PLAY + selected * 4 + col) }
                }
                Text("選ぶと、すぐ場に出ます", color = Color(0xFF4B5563), fontSize = 12.sp)
            }
            OhNoCutIn(s, version, onBusy) { seatLabel(ses, it) }
        }
        val sel = selected.takeIf { it in hand.indices }
        val wild = sel != null && OhNo.value(hand[sel]) >= 13
        val playMove = if (sel == null) -1 else OhNo.PLAY + sel * 4
        CardButtonRow(listOf(
            CardBtn("出す", mine && sel != null && (wild || playMove in legal), true) { if (wild) picking = true else onMove(playMove) },
            CardBtn("Oh, No!", mine && OhNo.DECLARE in legal, color = Color(0xFFD6332B)) { onMove(OhNo.DECLARE) },
            CardBtn(if (sorted) "元の順" else "並べ替え", true) { sorted = !sorted },
        ))
    }
}

@Composable
private fun BoxWithConstraintsScope.ChoicePanel(title: String, onDismiss: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0x8C050F0A)).then(if (onDismiss != null) Modifier.clickable { onDismiss() } else Modifier))
    Column(
        Modifier.align(Alignment.Center).padding(horizontal = 24.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.White).clickable(enabled = false) {}.padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(title, color = Color(0xFF1D2433), fontSize = 15.sp, fontWeight = FontWeight.Black)
        content()
    }
}

@Composable
private fun PanelButton(label: String, bg: Color, fg: Color, modifier: Modifier = Modifier.fillMaxWidth(), onClick: () -> Unit) {
    Box(modifier.height(54.dp).clip(RoundedCornerShape(14.dp)).background(bg).border(2.dp, Color(0xFFDCE0E5), RoundedCornerShape(14.dp)).clickable { onClick() },
        contentAlignment = Alignment.Center) { Text(label, color = fg, fontSize = 17.sp, fontWeight = FontWeight.Black) }
}

/** 言い忘れのカットイン(画面いっぱい・斜めの帯)と、言いまちがいの札 */
@Composable
private fun BoxWithConstraintsScope.OhNoCutIn(s: OhNoState, version: Int, onBusy: (Boolean) -> Unit, name: (Int) -> String) {
    val who = if (s.forgot >= 0) s.forgot else s.miscall
    if (who < 0) return
    val a = remember(version) { Animatable(0f) }
    var visible by remember(version) { mutableStateOf(true) }
    val tapped = remember(version) { kotlinx.coroutines.CompletableDeferred<Unit>() }
    val busy by rememberUpdatedState(onBusy)
    // 3秒ほど出す(タップで早く消せる)。出ている間は CPU の次の手を待たせる
    val sfx = LocalSfx.current
    LaunchedEffect(version) {
        busy(true)
        sfx?.play(jp.yonekou.asobi26.audio.Sound.CUTIN)
        try {
            a.animateTo(1f, tween(260))
            kotlinx.coroutines.withTimeoutOrNull(if (s.forgot >= 0) 3000L else 1800L) { tapped.await() }
        } finally {
            visible = false
            busy(false)
        }
    }
    if (!visible) return
    if (s.forgot >= 0) {
        Box(Modifier.fillMaxSize().background(Color(0x66000000)).clickable(indication = null, interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }) { tapped.complete(Unit) })
        Box(
            Modifier.align(Alignment.Center).fillMaxWidth(1.15f).height(116.dp).rotate(-7f).alpha(a.value)
                .background(Color(0xFFFFD94F)).border(5.dp, Color(0xFFD6332B)).testTag("ohNoCutIn"),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Oh, No!って言ってないー!", color = Color(0xFFD6332B), fontSize = 25.sp, fontWeight = FontWeight.Black)
                Text("${name(who)}はペナルティで札を引きます", color = Color(0xFF3A2A00), fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
        }
    } else {
        Text("${name(who)}: 言いまちがい!", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.Center).alpha(a.value).clip(RoundedCornerShape(50)).background(Color(0xFFD6332B)).border(3.dp, Color.White, RoundedCornerShape(50)).padding(horizontal = 14.dp, vertical = 5.dp))
    }
}

/** ルールの「特殊な札」: 札の絵と、その下に短い説明(文字だけの説明より分かりやすく) */
@Composable
fun OhNoSpecialCards() {
    val c = LocalAsobi.current
    val items = listOf(
        19 to "スキップ\n次の人の番を飛ばす",
        46 to "リバース\n回る向きが逆になる(2人ではスキップと同じ)",
        73 to "+2\n次の人が2枚引き、番も飛ばされる",
        100 to "ワイルド\n好きな色を選んで出す",
        104 to "+4\n好きな色を選び、次の人が4枚引いて番も飛ばされる。いまの色を持っていない時だけ出せる",
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (row in items.chunked(3)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((card, text) in row) {
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        OhNoCardView(card, 54.dp)
                        val (name, body) = text.split("\n", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
                        Text(name, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp))
                        Text(body, color = c.sub, fontSize = 12.sp, lineHeight = 16.sp, textAlign = TextAlign.Center)
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
