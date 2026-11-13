package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.BjHand
import jp.yonekou.asobi26.core.games.BjState
import jp.yonekou.asobi26.core.games.Blackjack
import jp.yonekou.asobi26.core.games.Cards
import jp.yonekou.asobi26.core.games.Daifugo
import jp.yonekou.asobi26.core.games.DaifugoState
import jp.yonekou.asobi26.core.games.Memory
import jp.yonekou.asobi26.core.games.MemoryState
import jp.yonekou.asobi26.core.games.Sevens
import jp.yonekou.asobi26.core.games.SevensState
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.graphics.PathEffect
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min

// =====================================================================
// カードゲーム共通の部品
// =====================================================================

/** 7渡しで札を受け取る人(上がっていない次の人) */
private fun nextSeatOf(st: DaifugoState, p: Int): Int {
    var q = p
    repeat(st.players) { q = (q + 1) % st.players; if (st.place[q] < 0) return q }
    return p
}

/** 写真のアイコンを出す席か(この端末の人。手番ごとに交代では、写真はプレイヤー1だけ) */
fun showsPhoto(ses: Session<*>, p: Int): Boolean {
    val seat = ses.seats.getOrNull(p) ?: return false
    return seat.human && !seat.remote && (ses.options.str("localMode", "cpu") != "pass" || p == 0)
}

/** 席の呼び名(あなた/CPU/CPU1…) */
fun seatLabel(ses: Session<*>, p: Int): String {
    if (p !in ses.seats.indices) return "終了"
    if (ses.seats[p].human) return if (ses.options.str("localMode", "cpu") == "pass") ses.seats[p].name else "あなた"
    if (ses.seats[p].remote) return ses.seats[p].name
    val cpus = ses.seats.count { !it.human }
    if (cpus == 1) return "CPU"
    return "CPU" + (ses.seats.take(p).count { !it.human } + 1)
}

/** 平らなフェルトの卓(四角。神経衰弱・7ならべなど、札を並べるゲーム用) */
fun DrawScope.feltTable() {
    if (size.minDimension < 4f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    val r = CornerRadius(size.minDimension * 0.05f)
    drawRoundRect(Brush.verticalGradient(listOf(Color(0xFF5A3518), Color(0xFF3B2210))), Offset.Zero, size, r)
    val ins = size.minDimension * 0.025f
    drawRoundRect(
        safeRadial(listOf(Mat.feltLight, Mat.feltBottom, Mat.feltDeep), Offset(size.width / 2, size.height * 0.4f), size.maxDimension * 0.7f),
        Offset(ins, ins), Size(size.width - ins * 2, size.height - ins * 2), CornerRadius(size.minDimension * 0.035f),
    )
    drawRoundRect(Color(0x59FFD68C), Offset(ins, ins), Size(size.width - ins * 2, size.height - ins * 2), CornerRadius(size.minDimension * 0.035f), style = Stroke(2f))
}

/** ジョーカー(大富豪) */
fun DrawScope.jokerCard(tm: TextMeasurer, tl: Offset, w: Float, alpha: Float = 1f, highlight: Boolean = false) {
    val h = w * 1.4f
    val rr = CornerRadius(w * 0.1f)
    drawRoundRect(Color.Black.copy(alpha = 0.3f * alpha), tl + Offset(w * 0.03f, w * 0.06f), Size(w, h), rr)
    drawRoundRect(Brush.linearGradient(listOf(Color.White, Color(0xFFF2EEE4)), tl, tl + Offset(w, h)), tl, Size(w, h), rr, alpha = alpha)
    drawRoundRect(if (highlight) ACCENT else Color(0xFFCFC8B8), tl, Size(w, h), rr, style = Stroke(if (highlight) w * 0.06f else w * 0.015f), alpha = alpha)
    val star = tm.measure("★", TextStyle(color = Color(0xFFC8322B).copy(alpha = alpha), fontSize = (w * 0.55f / density).sp))
    drawText(star, topLeft = tl + Offset((w - star.size.width) / 2f, (h - star.size.height) / 2f - w * 0.08f))
    val t = tm.measure("JOKER", TextStyle(color = Color(0xFF1E2230).copy(alpha = alpha), fontSize = (w * 0.17f / density).sp, fontWeight = FontWeight.Black))
    drawText(t, topLeft = tl + Offset((w - t.size.width) / 2f, h - t.size.height - w * 0.1f))
}

/** 札1枚(52 = ジョーカー) */
fun DrawScope.anyCard(tm: TextMeasurer, tl: Offset, w: Float, c: Int, alpha: Float = 1f, highlight: Boolean = false) {
    if (c == Daifugo.JOKER) jokerCard(tm, tl, w, alpha, highlight) else playingCard(tm, tl, w, c, alpha, highlight)
}

/** 小さな札(数を大きく。7ならべの場の札) */
fun DrawScope.miniCard(tm: TextMeasurer, tl: Offset, w: Float, card: Int, alpha: Float = 1f) {
    val h = w * 1.4f
    val rr = CornerRadius(w * 0.12f)
    drawRoundRect(Color.Black.copy(alpha = 0.25f * alpha), tl + Offset(0f, w * 0.05f), Size(w, h), rr)
    drawRoundRect(Color(0xFFFBF8F1), tl, Size(w, h), rr, alpha = alpha)
    val col = (if (Cards.isRed(card)) Color(0xFFC8322B) else Color(0xFF1E2230)).copy(alpha = alpha)
    val r = tm.measure(Cards.rankLabel(card), TextStyle(color = col, fontSize = (w * 0.52f / density).sp, fontWeight = FontWeight.Black))
    drawText(r, topLeft = tl + Offset((w - r.size.width) / 2f, h * 0.06f))
    val s = tm.measure(Cards.SUITS[Cards.suit(card)], TextStyle(color = col, fontSize = (w * 0.42f / density).sp))
    drawText(s, topLeft = tl + Offset((w - s.size.width) / 2f, h - s.size.height - h * 0.02f))
}

/** 卓の上の名札(名前・補足。手番は黄色の枠) */
fun DrawScope.seatTag(tm: TextMeasurer, center: Offset, text: String, active: Boolean, dim: Boolean = false) {
    val lay = tm.measure(text, TextStyle(color = Color.White.copy(alpha = if (dim) 0.55f else 1f), fontSize = 11.sp, fontWeight = FontWeight.Bold))
    val w = lay.size.width + 20f
    val h = lay.size.height + 8f
    val tl = center - Offset(w / 2, h / 2)
    drawRoundRect(Color(0x99000000), tl, Size(w, h), CornerRadius(h / 2))
    if (active) drawRoundRect(ACCENT, tl, Size(w, h), CornerRadius(h / 2), style = Stroke(3f))
    drawText(lay, topLeft = tl + Offset(10f, 4f))
}

fun DrawScope.tableLabel(tm: TextMeasurer, center: Offset, text: String, size: TextUnit = 13.sp, color: Color = Color(0xFFFFD58A)) {
    val lay = tm.measure(text, TextStyle(color = color, fontSize = size, fontWeight = FontWeight.Black))
    drawRoundRect(Color(0x55000000), center - Offset(lay.size.width / 2f + 12f, lay.size.height / 2f + 4f), Size(lay.size.width + 24f, lay.size.height + 8f), CornerRadius(12f))
    drawText(lay, topLeft = center - Offset(lay.size.width / 2f, lay.size.height / 2f))
}

/** 札をめくる途中の見た目(t: 0 → 1 で裏 → 表) */
private fun DrawScope.flipping(t: Float, tl: Offset, w: Float, front: DrawScope.() -> Unit) {
    val fx = abs(cos(Math.PI.toFloat() * t)).coerceAtLeast(0.05f)
    scale(scaleX = fx, scaleY = 1f, pivot = Offset(tl.x + w / 2, tl.y)) {
        if (t < 0.5f) cardBack(tl, w) else front()
    }
}

/** 下に並べる操作ボタン。最後のボタンを主に(黄色) */
@Composable
fun CardButtons(buttons: List<Pair<String, () -> Unit>>, primaryLast: Boolean = true) {
    val c = LocalAsobi.current
    Row(Modifier.fillMaxWidth().height(60.dp).padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((i, b) in buttons.withIndex()) {
            val primary = primaryLast && i == buttons.size - 1
            Box(
                Modifier.weight(if (primary) 1.3f else 1f).height(52.dp).clip(RoundedCornerShape(16.dp))
                    .background(if (primary) AccentBrush else Brush.horizontalGradient(listOf(c.chip, c.chip)))
                    .clickable(role = Role.Button) { b.second() },
                contentAlignment = Alignment.Center,
            ) { Text(b.first, color = if (primary) c.onAccent else c.ink, fontSize = 15.sp, fontWeight = FontWeight.Black) }
        }
    }
}

/** 手札を横に並べる時の札の幅と間隔(重ねて並べる) */
internal class HandLayout(val cw: Float, val step: Float, val x0: Float, val y0: Float, val rows: Int, val perRow: Int, val rowGap: Float) {
    fun at(i: Int): Offset = Offset(x0 + (i % perRow) * step, y0 + (i / perRow) * rowGap)
    /**
     * 押した札。見えている重なりの順(下の段・右の札ほど手前)に調べる。
     * lift(i) は札 i を持ち上げて描いている高さ(持ち上げた分だけ上も押せる)。
     * 以前は全部の札の上に余白を足していたため、2段の時に上の段の札の下半分を押すと、下の段の札が選ばれていた(0.4.12 の確認で発見)。
     */
    fun hit(p: Offset, n: Int, lift: (Int) -> Float = { 0f }): Int {
        for (i in n - 1 downTo 0) {
            val o = at(i)
            val top = o.y - lift(i)
            if (p.x >= o.x && p.x <= o.x + cw && p.y >= top && p.y <= top + cw * 1.4f) return i
        }
        return -1
    }
}

internal fun handLayout(w: Float, bottom: Float, n: Int, maxCw: Float): HandLayout {
    val rows = if (n > 13) 2 else 1
    val perRow = (n + rows - 1) / rows
    val cw = min(maxCw, w * 0.16f)
    val avail = w * 0.94f - cw
    val step = if (perRow <= 1) 0f else min(cw * 1.04f, avail / (perRow - 1))
    val total = cw + step * (perRow - 1).coerceAtLeast(0)
    val rowGap = cw * 0.8f
    val y0 = bottom - cw * 1.4f - rowGap * (rows - 1)
    return HandLayout(cw, step, (w - total) / 2, y0, rows, perRow, rowGap)
}

// =====================================================================
// 神経衰弱
// =====================================================================

/** CPU の何人目か(顔の色に使う) */
private fun cpuIndexOf(ses: Session<*>, p: Int): Int = ses.seats.take(p).count { !it.human }

/** 席を横に並べる時の中心(卓の幅 w を n 等分) */
private fun rowX(w: Dp, i: Int, n: Int): Dp = w * ((i + 1f) / (n + 1f))

// =====================================================================
// 神経衰弱
// =====================================================================

@Composable
fun MemoryBoard(ses: Session<MemoryState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val tm = rememberTextMeasurer()
    val g = ses.rules as Memory
    // めくる: 0.25秒。外れた2枚は1.3秒見せてから裏に戻す。当たりは0.8秒見せてから取る
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t -> sfx?.play(Sound.CARD_FLIP) }) { _, t ->
        when { t.lastMove < 0 -> 0; t.missed != null -> 1300; t.hit -> 800; else -> 260 }
    }
    val st = ma.to
    val k = (ma.elapsed / 260f).coerceIn(0f, 1f)
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled && ma.done)
    val n = st.layout.size
    val cols = if (n == 26) 6 else 7
    val rows = (n + cols - 1) / cols
    val me = viewSeat(ses)
    val seatsH = 84.dp
    Column(Modifier.fillMaxSize()) {
        CardTableBox(Modifier.weight(1f).fillMaxWidth()) {
            val topPx = with(LocalDensity.current) { seatsH.toPx() }
            fun geo(w: Float, h: Float): Triple<Float, Float, Float> {
                val cw = min(w * 0.94f / (cols + (cols - 1) * 0.14f), (h - topPx) * 0.95f / (rows * 1.4f + (rows - 1) * 0.14f))
                val gx = cw * 0.14f
                val x0 = (w - (cw * cols + gx * (cols - 1))) / 2
                val y0 = topPx + ((h - topPx) - (cw * 1.4f * rows + gx * (rows - 1))) / 2
                return Triple(cw, x0, y0)
            }
            Canvas(Modifier.fillMaxSize().testTag("cardTable").pointerInput(ses) {
                detectTapGestures { p ->
                    if (!canTap) return@detectTapGestures
                    val (cw, x0, y0) = geo(size.width.toFloat(), size.height.toFloat())
                    val gx = cw * 0.14f
                    val c = ((p.x - x0) / (cw + gx)).toInt()
                    val r = ((p.y - y0) / (cw * 1.4f + gx)).toInt()
                    if (p.x < x0 || p.y < y0 || c !in 0 until cols || r !in 0 until rows) return@detectTapGestures
                    val i = r * cols + c
                    if (i < n && ses.rules.isLegal(ses.state, i)) move(i)
                }
            }) {
                val (cw, x0, y0) = geo(size.width, size.height)
                val gx = cw * 0.14f
                val missed = st.missed
                val justTaken = if (!ma.done && st.hit) setOf(ma.from.open1, st.lastMove) else emptySet()
                for (i in 0 until n) {
                    if (st.taken[i] >= 0 && i !in justTaken) continue
                    val tl = Offset(x0 + (i % cols) * (cw + gx), y0 + (i / cols) * (cw * 1.4f + gx))
                    val up = i == st.open1 || i in justTaken || (!ma.done && missed != null && i in missed)
                    if (!up) { cardBack(tl, cw); continue }
                    val card = st.layout[i]
                    val lift = Offset(0f, cw * 0.12f)
                    if (!ma.done && i == st.lastMove && k < 1f) flipping(k, tl, cw) { playingCard(tm, tl, cw, card) }
                    else playingCard(tm, tl - lift, cw, card, highlight = true)
                }
                // 当たり・はずれは卓の真ん中に大きめに出す(上に出すと名札にくっついて見えた)
                if (!ma.done && st.hit) tableBanner(tm, Offset(size.width / 2, size.height * 0.55f), "当たり! もう一度", Color(0xD9000000), Color(0xFFFFD58A), 16f)
                if (!ma.done && missed != null) tableBanner(tm, Offset(size.width / 2, size.height * 0.55f), "はずれ", Color(0xD9000000), Color.White, 16f)
            }
            // 席: 顔と、取った組の数(赤いバッジ)。1人の時は、めくった回数
            for (p in 0 until g.players) {
                TableSeat(
                    rowX(maxWidth, p, g.players), 4.dp, seatLabel(ses, p), ses.seats[p].human, cpuIndexOf(ses, p), photo = showsPhoto(ses, p),
                    turn = !ses.state.let { it.left == 0 } && st.turn == p && g.players > 1,
                    badge = st.pairs[p].toString(),
                    width = if (g.players > 4) 64.dp else 96.dp, face = if (g.players > 4) 32.dp else 38.dp,
                    extra = if (g.players == 1) ({ Text("${st.attempts}回", color = Color(0xFFFFD58A), fontSize = 11.sp, fontWeight = FontWeight.Black) }) else null,
                )
            }
        }
        CardButtonRow(listOf(CardBtn(if (st.open1 < 0) "1枚目をめくる" else "2枚目をめくる", enabled = false) {}))
    }
}

// =====================================================================
// ブラックジャック
// =====================================================================

private const val BJ_SHOW_MS = 2600

@Composable
fun BlackjackBoard(ses: Session<BjState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val g = ses.rules as Blackjack
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, to ->
        sfx?.play(if (to.round != from.round) Sound.DEAL else if (to.lastMove >= Blackjack.BET) Sound.CHIP else Sound.CARD)
    }) { from, to -> if (to.round != from.round && to.result != null) BJ_SHOW_MS else if (to.lastMove >= 0) 300 else 0 }
    val st = ma.to
    val me = viewSeat(ses)
    val showResult = ((!ma.done && st.round != ma.from.round) || st.over) && st.result != null
    val hands = if (showResult) st.result!!.hands else st.hands
    val dealer = if (showResult) st.result!!.dealer else st.dealer
    val move by rememberUpdatedState(onMove)
    val legal = if (enabled && ma.done && !showResult) g.legalMoves(st).toSet() else emptySet()
    // 賭け金が決まっている(プレイヤー同士・総取り)時は、賭けを自動で進める(押す手間をなくす)
    LaunchedEffect(st, legal) {
        if (g.potStyle && st.phase == 0 && legal.size == 1) {
            kotlinx.coroutines.delay(450)
            move(legal.first())
        }
    }
    Column(Modifier.fillMaxSize()) {
        CardTableBox(Modifier.weight(1f).fillMaxWidth()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (g.potStyle) "プレイヤー同士・総取り" else "対戦相手：ディーラー", color = ACCENT, fontWeight = FontWeight.Black, fontSize = 15.sp)
                if (!g.potStyle) {
                    val hide = !showResult && st.phase == 1
                    BlackjackSeat("ディーラー", listOf(BjHand(dealer, 0, true)), null, false, hide, large = false)
                } else {
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0x66000000)).padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("場", color = Color(0xCCFFFFFF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        ChipAmount(hands.sumOf { row -> row.sumOf { it.bet } }, big = true)
                        Spacer(Modifier.weight(1f))
                        Text("1人", color = Color(0xCCFFFFFF), fontSize = 12.sp)
                        ChipAmount(g.stake, big = false, color = Color(0xFF2F5FA8))
                    }
                }
                for (p in (0 until g.players).filter { it != me }) {
                    BlackjackSeat(seatLabel(ses, p), hands[p], st.chips[p], !showResult && st.turn == p, false, large = false)
                }
                BlackjackSeat(seatLabel(ses, me), hands[me], st.chips[me], !showResult && st.turn == me, false, large = true)
                if (showResult) {
                    val result = st.result!!
                    val text = if (g.potStyle) {
                        val winners = result.delta.indices.filter { result.delta[it] > 0 }
                        if (winners.isEmpty()) "引き分け・賭け金を返却" else winners.joinToString(" ／ ") { "${seatLabel(ses, it)} +${result.delta[it]}" }
                    } else "この回：" + result.delta.indices.joinToString(" ／ ") { "${seatLabel(ses, it)} ${if (result.delta[it] > 0) "+" else ""}${result.delta[it]}" }
                    Text(text, color = ACCENT, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
                Text("${(st.round + if (st.over) 0 else 1).coerceAtMost(g.rounds)} / ${g.rounds} 回", color = Color.White, fontSize = 12.sp)
            }
        }
        CardButtonRow(listOf(10, 50, 100).map { a -> CardBtn("${a}賭ける", Blackjack.BET + a in legal, primary = a == if (g.potStyle) g.stake else 50) { move(Blackjack.BET + a) } })
        CardButtonRow(listOf(
            CardBtn("ヒット", Blackjack.HIT in legal, primary = true) { move(Blackjack.HIT) },
            CardBtn("スタンド", Blackjack.STAND in legal) { move(Blackjack.STAND) },
            CardBtn("ダブル", Blackjack.DOUBLE in legal) { move(Blackjack.DOUBLE) },
            CardBtn("分ける", Blackjack.SPLIT in legal) { move(Blackjack.SPLIT) },
        ))
    }
}

@Composable
private fun BlackjackSeat(name: String, hands: List<BjHand>, chips: Int?, active: Boolean, hideHole: Boolean, large: Boolean) {
    val tm = rememberTextMeasurer()
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (active) Color(0x443DCC7E) else Color(0x33000000))
        .border(if (active) 2.dp else 1.dp, if (active) ACCENT else Color(0x33FFFFFF), RoundedCornerShape(12.dp)).padding(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(name + if (active) "の番" else "", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1)
            if (chips != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val bet = hands.sumOf { it.bet }
                if (bet > 0) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("賭け", color = Color(0xCCFFFFFF), fontSize = 11.sp)
                    ChipAmount(bet, big = false, color = Color(0xFF2F5FA8))
                }
                ChipAmount(chips, big = large)
            }
        }
        if (hands.any { it.cards.isNotEmpty() }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Canvas(Modifier.weight(1f).height(if (large) 78.dp else 48.dp)) {
                    // 重ねた札も左上の数字が全部見えるだけずらす(「10」が「1」に見えて合計を数え違えないように)
                    val groups = hands.map { 1f + (it.cards.size - 1).coerceAtLeast(0) * .56f }
                    val units = groups.sum() + (hands.size - 1).coerceAtLeast(0) * .5f
                    val cw = min(size.height / 1.4f, size.width / units.coerceAtLeast(1f))
                    var x = 0f
                    for ((k, hand) in hands.withIndex()) {
                        for ((i, card) in hand.cards.withIndex()) {
                            val at = Offset(x + i * cw * .56f, 0f)
                            if (hideHole && i == 1) cardBack(at, cw) else playingCard(tm, at, cw, card)
                        }
                        x += (groups[k] + .5f) * cw
                    }
                }
                Text(hands.joinToString(" / ") {
                    if (hideHole) "${Blackjack.total(it.cards.take(1).toIntArray())}+？" else if (it.bust) "${it.total} バスト" else "${it.total}" + if (it.done) " 確定" else ""
                }, color = if (hands.any { it.bust }) Color(0xFFFFB7A0) else Color.White, fontSize = if (large) 18.sp else 14.sp, fontWeight = FontWeight.Bold)
            }
        } else Text(if (hands.isNotEmpty()) "配札を待っています" else "賭け待ち", color = Color(0xCCFFFFFF), fontSize = 12.sp)
    }
}

/** チップの印と持ち金の数(ブラックジャックの席) */
@Composable
private fun ChipAmount(n: Int, big: Boolean, color: Color = BADGE_RED) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Canvas(Modifier.size(if (big) 20.dp else 16.dp)) { chipMark(center, size.minDimension / 2 * 0.9f, color) }
        Text(n.toString(), color = ACCENT, fontSize = if (big) 17.sp else 14.sp, fontWeight = FontWeight.Black)
    }
}

/** チップの印と数(席の下) */
@Composable
private fun ChipLine(n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Canvas(Modifier.size(14.dp)) { chipMark(center, size.minDimension / 2) }
        Text(n.toString(), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

// =====================================================================
// 7ならべ
// =====================================================================

@Composable
fun SevensBoard(ses: Session<SevensState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val tm = rememberTextMeasurer()
    val g = ses.rules as Sevens
    val me = viewSeat(ses)
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t -> if (t.lastMove != Sevens.PASS) sfx?.play(Sound.CARD) }) { _, t ->
        if (t.lastMove < 0) 0 else if (t.lastMover != me) 650 else 300
    }
    val st = ma.to
    val canAct = enabled && ma.done
    val canTap by rememberUpdatedState(canAct)
    val move by rememberUpdatedState(onMove)
    val hand = (0 until 52).filter { st.has(me, it) }.sortedWith(compareBy({ Cards.suit(it) }, { Sevens.num(it) }))
    val handNow by rememberUpdatedState(hand)
    val legal = if (canAct) ses.rules.legalMoves(st).toSet() else emptySet()
    val legalNow by rememberUpdatedState(legal)
    val others = (0 until g.players).filter { it != me }
    var askOut by remember(ses) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        CardTableBox(Modifier.weight(1f).fillMaxWidth()) {
            val seatsH = 112.dp
            val topPx = with(LocalDensity.current) { seatsH.toPx() }
            Canvas(Modifier.fillMaxSize().testTag("cardTable").pointerInput(ses) {
                detectTapGestures { p ->
                    if (!canTap) return@detectTapGestures
                    val hl = handLayout(size.width.toFloat(), size.height * 0.97f, handNow.size, size.width * 0.15f)
                    val i = hl.hit(p, handNow.size) { k -> if (handNow[k] in legalNow) hl.cw * 0.22f else 0f }
                    if (i >= 0 && handNow[i] in legalNow) move(handNow[i])
                }
            }) {
                val w = size.width; val h = size.height
                // 場: 4段(♠♥♦♣)× 13列(A〜K)。空いた所はマークをうすく出し、出せる所は黄色の枠
                val mw = min(w * 0.94f / (13 + 12 * 0.08f), h * 0.4f / (4 * 1.4f + 3 * 0.12f))
                val gx = mw * 0.08f
                val x0 = (w - (mw * 13 + gx * 12)) / 2
                val playable = Sevens.playable(st.table, g.tunnel).toSet()
                for (s in 0 until 4) for (nn in 1..13) {
                    val c = Sevens.card(s, nn)
                    val tl = Offset(x0 + (nn - 1) * (mw + gx), topPx + s * (mw * 1.4f + mw * 0.12f))
                    if (st.onTable(c)) {
                        val fresh = !ma.done && c == st.lastMove
                        miniCard(tm, tl - Offset(0f, if (fresh) mw * 0.25f * (1f - (ma.elapsed / 300f).coerceAtMost(1f)) else 0f), mw, c)
                    } else {
                        val mine = c in legal
                        val sz = androidx.compose.ui.geometry.Size(mw, mw * 1.4f)
                        if (mine) drawRoundRect(ACCENT, tl, sz, CornerRadius(mw * 0.12f), style = Stroke(2.5f.dp.toPx()))
                        else drawRoundRect(Color.White.copy(alpha = if (c in playable) 0.4f else 0.2f), tl, sz, CornerRadius(mw * 0.12f),
                            style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f))))
                        val sym = tm.measure(Cards.SUITS[s], TextStyle(color = (if (mine) ACCENT else Color.White).copy(alpha = if (mine) 0.9f else 0.22f), fontSize = (mw * 0.42f / density).sp))
                        drawText(sym, topLeft = tl + Offset((mw - sym.size.width) / 2f, (mw * 1.4f - sym.size.height) / 2f))
                    }
                }
                // 自分の手札(出せる札だけ持ち上げて黄色の枠。透けさせない)
                val hl = handLayout(w, h * 0.97f, hand.size, w * 0.15f)
                for ((i, c) in hand.withIndex()) {
                    val ok = c in legal
                    playingCard(tm, hl.at(i) - Offset(0f, if (ok) hl.cw * 0.22f else 0f), hl.cw, c, highlight = ok)
                }
            }
            for ((k, p) in others.withIndex()) {
                val passBubble = !st.over && st.lastMover == p && st.lastMove == Sevens.PASS
                TableSeat(
                    rowX(maxWidth, k, others.size), 14.dp, seatLabel(ses, p), false, cpuIndexOf(ses, p),
                    turn = !st.over && st.turn == p,
                    badge = if (st.place[p] < 0 && !st.out[p]) st.count(p).toString() else null,
                    title = if (st.out[p]) "失格" else if (st.place[p] >= 0) "${st.place[p] + 1}位" else null,
                    bubble = if (passBubble) "パス" else null,
                    dim = st.out[p],
                    width = if (others.size > 3) 64.dp else 96.dp, face = if (others.size > 3) 32.dp else 38.dp,
                    extra = { PassDots(Sevens.MAX_PASS - st.passes[p], Sevens.MAX_PASS) },
                )
            }
            // 自分の残りのパス(手札の上の左)
            Row(
                Modifier.align(Alignment.BottomStart).padding(start = 10.dp, bottom = with(LocalDensity.current) { (maxHeight.toPx() * 0.03f).toDp() } + handHeightDp(maxWidth, maxHeight, hand.size) + 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    when { st.out[me] -> "失格"; st.place[me] >= 0 -> "${st.place[me] + 1}位で上がり"; else -> "パス" },
                    color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black,
                )
                if (st.place[me] < 0 && !st.out[me]) PassDots(Sevens.MAX_PASS - st.passes[me], Sevens.MAX_PASS)
            }
        }
        val left = Sevens.MAX_PASS - st.passes[me]
        CardButtonRow(listOf(CardBtn("パス", canAct && Sevens.PASS in legal) { if (left > 0) move(Sevens.PASS) else askOut = true }))
        if (askOut) {
            val c = LocalAsobi.current
            AlertDialog(
                onDismissRequest = { askOut = false },
                confirmButton = { TextButton(onClick = { askOut = false; move(Sevens.PASS) }) { Text("パスする") } },
                dismissButton = { TextButton(onClick = { askOut = false }) { Text("キャンセル") } },
                title = { Text("失格になります") },
                text = { Text("パスは3回使いました。\nパスすると失格になり、手札は場に並びます。") },
                containerColor = c.surface,
            )
        }
    }
}

/** 手札の並びの高さ(dp)。手札の上に文字を置く時に使う */
@Composable
private fun handHeightDp(w: Dp, h: Dp, n: Int): Dp {
    val d = LocalDensity.current
    return with(d) {
        val hl = handLayout(w.toPx(), h.toPx() * 0.97f, n.coerceAtLeast(1), w.toPx() * 0.15f)
        (h.toPx() * 0.97f - hl.y0 + hl.cw * 0.22f).toDp()
    }
}

// =====================================================================
// 大富豪
// =====================================================================

private const val DF_SHOW_MS = 2600

private val TITLES_3 = listOf("大富豪", "平民", "大貧民")
fun dfTitle(place: Int, players: Int): String = when {
    players == 3 -> TITLES_3[place]
    place == 0 -> "大富豪"
    place == 1 -> "富豪"
    place == players - 1 -> "大貧民"
    place == players - 2 -> "貧民"
    else -> "平民"
}

@Composable
fun DaifugoBoard(ses: Session<DaifugoState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val tm = rememberTextMeasurer()
    val g = ses.rules as Daifugo
    val me = viewSeat(ses)
    // CPU の手は、だれが何を出したか追えるように、ゆっくり見せる
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, t ->
        if (t.round != from.round) sfx?.play(Sound.DEAL) else if (t.lastMove != Daifugo.PASS) sfx?.play(Sound.CARD)
    }) { from, t ->
        val cpu = t.lastMover != me
        when {
            t.round != from.round -> DF_SHOW_MS
            t.cleared -> if (cpu) 1100 else 700
            t.lastMove < 0 -> 0
            cpu -> if (t.lastMove == Daifugo.PASS) 700 else 1000
            else -> 320
        }
    }
    val st = ma.to
    val canAct = enabled && ma.done
    val canTap by rememberUpdatedState(canAct)
    val move by rememberUpdatedState(onMove)
    var sel by remember(ses) { mutableLongStateOf(0L) }
    LaunchedEffect(version) { sel = 0L }
    val showing = !ma.done && st.round != ma.from.round
    val hand = (0..52).filter { st.has(me, it) }.sortedWith(compareBy({ Daifugo.power(it, false) }, { it }))
    val handNow by rememberUpdatedState(hand)
    // 直前に出た札(場が流れた手なら、流れる前の札を少しの間見せる)
    val shownField = if (!ma.done && st.cleared && st.lastMove >= Daifugo.JOKER1 && st.lastMove < Daifugo.GIVE2) st.lastMove
    else if (!ma.done && st.cleared && ma.from.field >= 0) ma.from.field else st.field
    val shownOwner = if (!ma.done && st.cleared) st.lastMover.takeIf { st.lastMove != Daifugo.PASS } ?: ma.from.fieldOwner else st.fieldOwner
    val others = (0 until g.players).filter { it != me }.sortedBy { (it - me + g.players) % g.players }
    Column(Modifier.fillMaxSize()) {
        CardTableBox(Modifier.weight(1f).fillMaxWidth()) {
            val wDp = maxWidth
            Canvas(Modifier.fillMaxSize().testTag("cardTable").pointerInput(ses) {
                detectTapGestures { p ->
                    if (!canTap) return@detectTapGestures
                    val hl = handLayout(size.width.toFloat(), size.height * 0.97f, handNow.size, size.width * 0.15f)
                    val i = hl.hit(p, handNow.size) { k -> if ((sel shr handNow[k]) and 1L == 1L) hl.cw * 0.3f else 0f }
                    if (i >= 0) sel = sel xor (1L shl handNow[i])
                }
            }) {
                val w = size.width; val h = size.height
                val fieldY = h * 0.36f
                val flags = buildList { if (st.rev) add("革命中"); if (st.jback) add("11バック中"); if (st.lock != 0) add("しばり " + (0 until 4).filter { st.lock shr it and 1 == 1 }.joinToString("") { Cards.SUITS[it] }) }
                if (flags.isNotEmpty()) tableBanner(tm, Offset(w / 2, fieldY - 22.dp.toPx()), flags.joinToString(" ・ "), BADGE_RED, Color.White)
                val fw = min(w * 0.16f, h * 0.13f)
                if (shownField >= 0 && !showing) {
                    val cards = (0..52).filter { (Daifugo.decode(shownField).cards shr it) and 1L == 1L }.sortedBy { Daifugo.power(it, false) }
                    val tot = fw + (cards.size - 1) * fw * 0.55f
                    val fading = st.cleared && !ma.done
                    for ((i, c) in cards.withIndex()) anyCard(tm, Offset((w - tot) / 2 + i * fw * 0.55f, fieldY), fw, c, alpha = if (fading) 1f - (ma.elapsed / 1100f).coerceAtMost(1f) * 0.6f else 1f)
                    if (shownOwner >= 0) {
                        val cap = tm.measure("${seatLabel(ses, shownOwner)}が出した", TextStyle(color = Color(0xFFD8E8DC), fontSize = 10.sp))
                        drawText(cap, topLeft = Offset((w - cap.size.width) / 2f, fieldY + fw * 1.4f + 6.dp.toPx()))
                    }
                }
                if (showing) {
                    st.lastPlaces?.let { lp -> tableBanner(tm, Offset(w / 2, h * 0.45f), "${st.round}回目の結果: あなたは${dfTitle(lp[me], g.players)}", Color(0xCC000000), Color(0xFFFFD58A), 15f) }
                }
                // 自分の手札(選んだ札を持ち上げる)
                val hl = handLayout(w, h * 0.97f, hand.size, w * 0.15f)
                for ((i, c) in hand.withIndex()) {
                    val up = (sel shr c) and 1L == 1L
                    anyCard(tm, hl.at(i) - Offset(0f, if (up) hl.cw * 0.3f else 0f), hl.cw, c, highlight = up)
                }
            }
            for ((k, p) in others.withIndex()) {
                val a = Math.PI * (1.0 - (k + 1.0) / (others.size + 1))
                val x = wDp / 2 + wDp * (0.38f * kotlin.math.cos(a).toFloat())
                val y = 18.dp + 44.dp * (1f - kotlin.math.sin(a).toFloat())
                val title = if (showing) st.lastPlaces?.let { dfTitle(it[p], g.players) } else if (st.prevPlace[p] >= 0) dfTitle(st.prevPlace[p], g.players) else null
                TableSeat(
                    x, y, seatLabel(ses, p), false, cpuIndexOf(ses, p),
                    turn = !st.over && !showing && st.turn == p,
                    badge = if (st.place[p] < 0 && !st.over && !showing) st.count(p).toString() else null,
                    title = title,
                    bubble = when { st.place[p] >= 0 && !showing -> "${st.place[p] + 1}位で上がり"; st.passed[p] && !showing -> "パス"; else -> null },
                    width = if (others.size > 3) 66.dp else 90.dp, face = if (others.size > 3) 32.dp else 38.dp,
                )
            }
            // 自分の身分と回・点(手札の上の左)
            Row(
                Modifier.align(Alignment.BottomStart).padding(start = 10.dp, bottom = with(LocalDensity.current) { (maxHeight.toPx() * 0.03f).toDp() } + handHeightDp(maxWidth, maxHeight, hand.size) + 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (st.prevPlace[me] >= 0) Text(
                    dfTitle(st.prevPlace[me], g.players), color = Color(0xFF3A2400), fontSize = 9.sp, fontWeight = FontWeight.Black,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(ACCENT).padding(horizontal = 4.dp, vertical = 1.dp),
                )
                Text(
                    if (st.place[me] >= 0) "${st.place[me] + 1}位で上がり" else "${(st.round + 1).coerceAtMost(g.rounds)}/${g.rounds}回目 ・ ${st.points[me]}点",
                    color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black,
                )
            }
        }
        val legal = if (canAct) ses.rules.legalMoves(st) else IntArray(0)
        val chosen = legal.firstOrNull { m ->
            when (st.phase) {
                0 -> (if (m >= Daifugo.GIVE1) 1L shl (m - Daifugo.GIVE1) else (1L shl ((m - Daifugo.GIVE2) / 64)) or (1L shl ((m - Daifugo.GIVE2) % 64))) == sel
                2 -> 1L shl (m - Daifugo.SEVEN) == sel
                3 -> 1L shl (m - Daifugo.TEN) == sel
                4 -> false
                else -> m != Daifugo.PASS && Daifugo.decode(m).cards == sel
            }
        }
        // 7渡し・10捨て・12ボンバーの案内
        val prompt = when {
            !canAct || st.turn != me -> null
            st.phase == 2 -> "7渡し: ${seatLabel(ses, nextSeatOf(st, me))}に渡す札を1枚選んで「渡す・捨てる」(あと${st.pGive}枚)"
            st.phase == 3 -> "10捨て: 捨てる札を1枚選んで「渡す・捨てる」(あと${st.pDiscard}枚)"
            else -> null
        }
        if (prompt != null) Text(prompt, color = LocalAsobi.current.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth().padding(top = 6.dp))
        if (canAct && st.phase == 4 && st.turn == me) {
            Text("12ボンバー: 数を1つ選ぶと、全員がその数の札を捨てます(あと${st.pBomb}回)", color = LocalAsobi.current.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
            val names = listOf("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2")
            for (row in names.indices.chunked(7)) Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (v in row) Box(
                    Modifier.weight(1f).height(38.dp).clip(RoundedCornerShape(10.dp)).background(ACCENT).clickable { move(Daifugo.BOMB + v) },
                    contentAlignment = Alignment.Center,
                ) { Text(names[v], color = Color(0xFF3A2400), fontSize = 15.sp, fontWeight = FontWeight.Black) }
                if (row.size < 7) repeat(7 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        CardButtonRow(listOf(
            CardBtn("パス", canAct && st.phase == 1 && Daifugo.PASS in legal) { sel = 0L; move(Daifugo.PASS) },
            CardBtn("渡す・捨てる", chosen != null && st.phase in setOf(0, 2, 3)) { val m = chosen ?: return@CardBtn; sel = 0L; move(m) },
            CardBtn("出す", chosen != null && st.phase == 1, primary = true) { val m = chosen ?: return@CardBtn; sel = 0L; move(m) },
        ))
    }
}
