package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Cards
import jp.yonekou.asobi26.core.games.Go
import jp.yonekou.asobi26.core.games.GoState
import jp.yonekou.asobi26.core.games.Poker
import jp.yonekou.asobi26.core.games.PokerState
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

// =====================================================================
// 碁石(那智黒と蛤)。碁と五目ならべで使う
// =====================================================================

/** 那智黒の石: 艶を抑えた黒に、左上の柔らかい光 */
fun DrawScope.slateStone(c: Offset, r: Float, alpha: Float = 1f) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.38f * alpha), r, c + Offset(r * 0.1f, r * 0.16f))
    drawCircle(safeRadial(listOf(Color(0xFF5C5F66), Color(0xFF25272C), Color(0xFF0D0E10)), c + Offset(-r * 0.32f, -r * 0.38f), r * 1.5f), r, c, alpha = alpha)
    drawCircle(Color.White.copy(alpha = 0.16f * alpha), r * 0.3f, c + Offset(-r * 0.34f, -r * 0.4f))
}

/** 蛤の石: 白に細い縞(石ごとに向きを変える)と、強い艶 */
fun DrawScope.shellStone(c: Offset, r: Float, stripeAngle: Float, alpha: Float = 1f) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.32f * alpha), r, c + Offset(r * 0.1f, r * 0.16f))
    drawCircle(safeRadial(listOf(Color.White, Color(0xFFF1EEE6), Color(0xFFCFCAB9)), c + Offset(-r * 0.3f, -r * 0.36f), r * 1.6f), r, c, alpha = alpha)
    clipPath(Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, r * 0.94f)) }) {
        rotate(stripeAngle, c) {
            var x = c.x - r
            var k = 0
            while (x < c.x + r) {
                drawLine(Color(0xFFC9C2AE).copy(alpha = (if (k % 3 == 0) 0.16f else 0.08f) * alpha), Offset(x, c.y - r), Offset(x, c.y + r), r * (if (k % 3 == 0) 0.035f else 0.02f))
                x += r * 0.19f; k++
            }
        }
    }
    drawCircle(Color.White.copy(alpha = 0.8f * alpha), r * 0.24f, c + Offset(-r * 0.34f, -r * 0.4f))
}

/** 石の縞の向き(場所で決まる。毎回同じ) */
fun stripeOf(i: Int): Float = ((i * 37) % 180).toFloat()

// =====================================================================
// 碁(9・13・19路)。1回目のタップで仮置き、同じ所をもう一度で決定
// =====================================================================

@Composable
fun GoBoard(ses: Session<GoState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val g = ses.rules as Go
    val n = g.n
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        if (t.lastMove in 0 until g.size) {
            sfx?.play(Sound.GO)
            if (t.lastCaptured.isNotEmpty()) { kotlinx.coroutines.delay(120); sfx?.play(Sound.TAKE, volume = 0.6f) }
        }
    }) { _, t -> if (t.lastMove in 0 until g.size) 260 else 0 }
    val st = ma.to
    var pending by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { pending = -1 }
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled && ma.done)
    val cells by rememberUpdatedState(st.board)
    val stars = when (n) { 9 -> listOf(2 to 2, 2 to 6, 6 to 2, 6 to 6, 4 to 4); 13 -> listOf(3 to 3, 3 to 9, 9 to 3, 9 to 9, 6 to 6); else -> listOf(3, 9, 15).flatMap { a -> listOf(3, 9, 15).map { a to it } } }
    Column(Modifier.fillMaxWidth()) {
        Canvas(
            Modifier.weight(1f, fill = false).aspectRatio(1f, matchHeightConstraintsFirst = true).align(Alignment.CenterHorizontally).pointerInput(ses) {
                detectTapGestures { p ->
                    if (!canTap) return@detectTapGestures
                    val step = size.width / (n - 1 + 1.3f)
                    val m = step * 0.65f
                    val col = ((p.x - m) / step).roundToInt()
                    val row = ((p.y - m) / step).roundToInt()
                    if (col !in 0 until n || row !in 0 until n) return@detectTapGestures
                    val i = row * n + col
                    if (cells[i] != 0) return@detectTapGestures
                    if (pending == i) { pending = -1; if (g.isLegal(ses.state, i)) move(i) } else pending = i
                }
            },
        ) {
            val w = size.width
            // 端の石が盤からはみ出さないよう、余白は石の大きさに合わせる
            val step = w / (n - 1 + 1.3f)
            val m = step * 0.65f
            drawRoundRect(KAYA_FLAT, cornerRadius = CornerRadius(w * 0.015f))
            grain(Grain.STRAIGHT, Offset.Zero, Size(w, w), alpha = 0.18f)
            val line = Color(0xFF2A1A0A).copy(alpha = 0.85f)
            for (k in 0 until n) {
                val p = m + k * step
                val lw = if (k == 0 || k == n - 1) 2.2f else 1.2f
                drawLine(line, Offset(p, m), Offset(p, w - m), lw)
                drawLine(line, Offset(m, p), Offset(w - m, p), lw)
            }
            for ((x, y) in stars) drawCircle(line, step * 0.1f, Offset(m + x * step, m + y * step))
            fun at(i: Int) = Offset(m + (i % n) * step, m + (i / n) * step)
            val r = step * 0.48f
            // 取られた石(動きの間だけ薄くなって消える)
            if (!ma.done) for (i in st.lastCaptured) {
                val a = 1f - (ma.elapsed / 260f).coerceIn(0f, 1f)
                val v = ma.from.board[i]
                if (v == 1) slateStone(at(i), r, a) else if (v == 2) shellStone(at(i), r, stripeOf(i), a)
            }
            for (i in 0 until g.size) {
                val v = st.board[i]
                if (v == 0) continue
                val sc = if (!ma.done && i == st.lastMove) popScale(ma.elapsed / 260f) else 1f
                if (v == 1) slateStone(at(i), r * sc) else shellStone(at(i), r * sc, stripeOf(i))
            }
            if (ma.done && st.lastMove in 0 until g.size && !st.over) drawCircle(Color(0xFFE0463A), r * 0.42f, at(st.lastMove), style = Stroke(r * 0.12f))
            // 終局: 地の印(小さな四角)と死に石の×
            val owner = st.owner
            val dead = st.dead
            if (st.over && owner != null && dead != null) {
                for (i in 0 until g.size) {
                    val o = at(i)
                    if (st.board[i] == 0 || dead[i]) {
                        val ow = if (dead[i]) 3 - st.board[i] else owner[i]
                        if (ow == 1 || ow == 2) drawRect(if (ow == 1) Color(0xFF15171B) else Color(0xFFF7F4EC), o - Offset(r * 0.3f, r * 0.3f), Size(r * 0.6f, r * 0.6f))
                    }
                    if (dead[i]) {
                        drawLine(Color(0xFFE0463A), o - Offset(r * 0.4f, r * 0.4f), o + Offset(r * 0.4f, r * 0.4f), r * 0.14f)
                        drawLine(Color(0xFFE0463A), o + Offset(-r * 0.4f, r * 0.4f), o + Offset(r * 0.4f, -r * 0.4f), r * 0.14f)
                    }
                }
            }
            if (pending >= 0 && st.board[pending] == 0) {
                if (st.turn == 0) slateStone(at(pending), r, 0.55f) else shellStone(at(pending), r, 0f, 0.55f)
                selectRing(at(pending), r * 1.1f)
            }
        }
        val c = LocalAsobi.current
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            for ((label, mv) in listOf("パス" to g.PASS, "投了" to g.RESIGN)) {
                Box(
                    Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(14.dp)).background(c.chip)
                        .clickable(enabled = enabled && ma.done, role = Role.Button) { pending = -1; move(mv) },
                    contentAlignment = Alignment.Center,
                ) { Text(label, color = if (enabled) c.ink else c.sub, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}


// =====================================================================
// トランプ(カードゲームで使う)
// =====================================================================

/** トランプ1枚(表)。tl は左上、w は幅(高さは 1.4 倍) */
fun DrawScope.playingCard(tm: TextMeasurer, tl: Offset, w: Float, card: Int, alpha: Float = 1f, highlight: Boolean = false) {
    val h = w * 1.4f
    val rr = CornerRadius(w * 0.1f)
    drawRoundRect(Color.Black.copy(alpha = 0.3f * alpha), tl + Offset(w * 0.03f, w * 0.06f), Size(w, h), rr)
    drawRoundRect(Brush.linearGradient(listOf(Color.White, Color(0xFFF2EEE4)), tl, tl + Offset(w, h)), tl, Size(w, h), rr, alpha = alpha)
    drawRoundRect(if (highlight) ACCENT else Color(0xFFCFC8B8), tl, Size(w, h), rr, style = Stroke(if (highlight) w * 0.06f else w * 0.015f), alpha = alpha)
    val col = (if (Cards.isRed(card)) Color(0xFFC8322B) else Color(0xFF1E2230)).copy(alpha = alpha)
    val rank = tm.measure(Cards.rankLabel(card), TextStyle(color = col, fontSize = (w * 0.3f / density).sp, fontWeight = FontWeight.Black))
    drawText(rank, topLeft = tl + Offset(w * 0.08f, w * 0.04f))
    val suitSmall = tm.measure(Cards.SUITS[Cards.suit(card)], TextStyle(color = col, fontSize = (w * 0.22f / density).sp))
    drawText(suitSmall, topLeft = tl + Offset(w * 0.1f, w * 0.04f + rank.size.height * 0.9f))
    val suitBig = tm.measure(Cards.SUITS[Cards.suit(card)], TextStyle(color = col, fontSize = (w * 0.5f / density).sp))
    drawText(suitBig, topLeft = tl + Offset(w - suitBig.size.width - w * 0.08f, h - suitBig.size.height - w * 0.02f))
}

/** トランプ1枚(裏)。白いふちに、えんじ色の地と細い格子(0.5.8 で素材の色にそろえた) */
fun DrawScope.cardBack(tl: Offset, w: Float, alpha: Float = 1f) {
    val h = w * 1.4f
    val rr = CornerRadius(w * 0.1f)
    drawRoundRect(Color.Black.copy(alpha = 0.3f * alpha), tl + Offset(w * 0.03f, w * 0.06f), Size(w, h), rr)
    drawRoundRect(Color(0xFFFFFDF7), tl, Size(w, h), rr, alpha = alpha)
    val inner = androidx.compose.ui.geometry.RoundRect(tl.x + w * 0.08f, tl.y + w * 0.08f, tl.x + w * 0.92f, tl.y + h - w * 0.08f, CornerRadius(w * 0.05f))
    clipPath(Path().apply { addRoundRect(inner) }) {
        drawRect(Color(0xFF8E2F3C), tl, Size(w, h), alpha = alpha)
        var x = -h
        while (x < w) {
            drawLine(Color(0xFFF3DCC0).copy(alpha = 0.35f * alpha), tl + Offset(x, 0f), tl + Offset(x + h, h), w * 0.025f)
            drawLine(Color(0xFFF3DCC0).copy(alpha = 0.35f * alpha), tl + Offset(x + h, 0f), tl + Offset(x, h), w * 0.025f)
            x += w * 0.16f
        }
    }
    drawRoundRect(Color(0x33000000), tl, Size(w, h), rr, alpha = alpha, style = Stroke(w * 0.015f))
}

/** チップ(縁の白い切れ込み模様) */
fun DrawScope.chip(c: Offset, r: Float, color: Color) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.35f), r, c + Offset(0f, r * 0.18f))
    drawCircle(color, r, c)
    drawCircle(Color.White.copy(alpha = 0.9f), r * 0.78f, c, style = Stroke(r * 0.22f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(r * 0.45f, r * 0.45f))))
    drawCircle(Color.White.copy(alpha = 0.25f), r * 0.5f, c, style = Stroke(r * 0.06f))
}

/** 緑のポーカーテーブル(木の縁・フェルト)。上は丸く、下は角の丸い四角 */
fun DrawScope.pokerTable() {
    if (size.minDimension < 4f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    val w = size.width; val h = size.height
    val outer = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, w, h, CornerRadius(w * 0.42f, w * 0.42f), CornerRadius(w * 0.42f, w * 0.42f), CornerRadius(w * 0.1f), CornerRadius(w * 0.1f))) }
    drawPath(outer, Brush.verticalGradient(listOf(Color(0xFF5A3518), Color(0xFF3B2210))))
    clipPath(outer) { grain(Grain.FLAT, Offset.Zero, size, scale = 1.2f) }
    val ins = w * 0.035f
    val inner = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(ins, ins, w - ins, h - ins, CornerRadius(w * 0.39f, w * 0.39f), CornerRadius(w * 0.39f, w * 0.39f), CornerRadius(w * 0.07f), CornerRadius(w * 0.07f))) }
    drawPath(inner, safeRadial(listOf(Color(0xFF2F8A5A), Color(0xFF1F6B44), Color(0xFF154E32)), Offset(w / 2, h * 0.38f), h * 0.75f))
    clipPath(inner) { grain(Grain.FELT, Offset.Zero, size, scale = 2.5f) }
    drawPath(inner, Color(0x59FFD68C), style = Stroke(2f))
}

// =====================================================================
// ポーカー(5枚の交換)
// =====================================================================

private const val PK_SHOW_MS = 2600

@Composable
fun PokerBoard(ses: Session<PokerState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val c = LocalAsobi.current
    val tm = rememberTextMeasurer()
    val g = ses.rules as Poker
    // ゲームの終わり(勝負の結果がある手)は、全員の手札を見せる時間を取る
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        when {
            t.result != null && t.lastMove >= 0 -> sfx?.play(Sound.CHIP)
            t.lastMove >= 100 -> sfx?.play(Sound.CARD)
            t.lastMove == Poker.RAISE || t.lastMove == Poker.CALL -> sfx?.play(Sound.CHIP)
        }
    }) { from, t -> if (t.result != null && t.handNo != from.handNo) PK_SHOW_MS else if (t.lastMove >= 0) 220 else 0 }
    val st = ma.to
    val me = viewSeat(ses)
    var mask by remember(ses) { mutableIntStateOf(0) }
    LaunchedEffect(version) { mask = 0 }
    val canAct = enabled && ma.done
    val showing = !ma.done && st.result != null && st.handNo != ma.from.handNo
    val result = if (showing || st.over) st.result else null
    val move by rememberUpdatedState(onMove)
    val canDraw by rememberUpdatedState(canAct && st.phase == 1)
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            Canvas(Modifier.fillMaxSize().pointerInput(ses) {
                detectTapGestures { p ->
                    if (!canDraw) return@detectTapGestures
                    val w = size.width.toFloat(); val h = size.height.toFloat()
                    val cw = min(w * 0.17f, h * 0.15f)
                    val gap = cw * 0.12f
                    val x0 = (w - (cw * 5 + gap * 4)) / 2
                    val y0 = h - cw * 1.4f - h * 0.08f
                    if (p.y < y0 - cw * 0.4f || p.y > y0 + cw * 1.4f) return@detectTapGestures
                    val k = ((p.x - x0) / (cw + gap)).toInt()
                    if (k in 0 until 5) mask = mask xor (1 shl k)
                }
            }) {
                pokerTable()
                val w = size.width; val h = size.height
                // 相手の席。3人ずつの段に分け、カードと隣の席札が重ならないようにする。
                val others = (1 until g.players).map { (me + it) % g.players }
                val small = min(w * 0.075f, h * 0.06f)
                for ((k, p) in others.withIndex()) {
                    val row = k / 3
                    val columns = minOf(3, others.size - row * 3)
                    val cx = w * ((k % 3 + 0.5f) / columns)
                    val cy = h * (if (others.size <= 3) 0.20f else 0.18f + row * 0.18f)
                    val folded = (result?.folded ?: st.folded)[p]
                    val alpha = if (folded) 0.35f else 1f
                    if (result != null && !folded) {
                        for (i in 0 until 5) playingCard(tm, Offset(cx - small * 1.6f + i * small * 0.55f, cy - small * 0.9f), small, result.hands[p][i], highlight = p in result.winners)
                    } else {
                        for (i in 0 until 5) cardBack(Offset(cx - small * 1.6f + i * small * 0.55f, cy - small * 0.9f), small, alpha)
                    }
                    val name = if (ses.seats[p].remote || ses.seats[p].human) ses.seats[p].name else "CPU${k + 1}"
                    val act = if (result != null) (if (p in result.winners) "勝ち" else "") else st.lastAction[p]
                    val tag = tm.measure("$name ${st.chips[p]}" + if (act.isNotEmpty()) " ・ $act" else "", TextStyle(color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold),
                        constraints = androidx.compose.ui.unit.Constraints(maxWidth = (w / columns - 28f).toInt().coerceAtLeast(1)), maxLines = 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    val tl = Offset(cx - tag.size.width / 2f - 10f, cy + small * 0.75f)
                    drawRoundRect(Color(0x99000000), tl, Size(tag.size.width + 20f, tag.size.height + 8f), CornerRadius(14f))
                    if (st.turn == p && !st.over && result == null) drawRoundRect(ACCENT, tl, Size(tag.size.width + 20f, tag.size.height + 8f), CornerRadius(14f), style = Stroke(3f))
                    drawText(tag, topLeft = tl + Offset(10f, 4f))
                }
                // 場のチップと額
                val pot = if (result != null) result.pot else st.pot
                val cc = Offset(w / 2, h * 0.47f)
                val colors = listOf(Color(0xFFC8322B), Color(0xFF2A4FA8), Color(0xFF1E2230))
                val stacks = (pot / 60).coerceIn(1, 9)
                for (i in 0 until stacks) chip(cc + Offset((i % 3 - 1) * w * 0.06f, -(i / 3) * w * 0.018f), w * 0.035f, colors[i % 3])
                val label = tm.measure(if (result != null) result.text else "ポット $pot", TextStyle(color = Color(0xFFFFD58A), fontSize = 13.sp, fontWeight = FontWeight.Black))
                drawRoundRect(Color(0x55000000), cc + Offset(-label.size.width / 2f - 12f, w * 0.06f), Size(label.size.width + 24f, label.size.height + 8f), CornerRadius(12f))
                drawText(label, topLeft = cc + Offset(-label.size.width / 2f, w * 0.06f + 4f))
                // 自分の手札(交換に選んだ札は持ち上げる)
                val hand = if (result != null) result.hands[me] else st.hands[me]
                val cw = min(w * 0.17f, h * 0.15f)
                val gap = cw * 0.12f
                val x0 = (w - (cw * 5 + gap * 4)) / 2
                val y0 = h - cw * 1.4f - h * 0.08f
                val myFolded = (result?.folded ?: st.folded)[me]
                for (i in 0 until 5) {
                    val up = st.phase == 1 && (mask shr i and 1) == 1 && result == null
                    playingCard(tm, Offset(x0 + i * (cw + gap), y0 - if (up) cw * 0.28f else 0f), cw, hand[i], alpha = if (myFolded) 0.45f else 1f,
                        highlight = up || (result != null && me in result.winners))
                }
                val mine = tm.measure("あなた ${st.chips[me]}" + (if (!myFolded) " ・ " + Cards.handName(hand) else " ・ 降りた"), TextStyle(color = Color(0xFFFFD58A), fontSize = 12.sp, fontWeight = FontWeight.Black))
                drawText(mine, topLeft = Offset((w - mine.size.width) / 2f, y0 - cw * 0.62f))
            }
        }
        // 操作のボタン
        val toCall = st.bets.max() - st.bets[me]
        val legalButtons = if (canAct && !st.over) g.legalMoves(st) else intArrayOf()
        // 操作の位置・名前を固定。未選択で交換を確定しない。
        val buttons = listOf("降りる" to Poker.FOLD, "チェック／コール" to Poker.CALL, "ベット／レイズ" to Poker.RAISE,
            "交換しない" to 100, "交換" to (100 + mask))
        Column(Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((rowIndex, row) in buttons.chunked(3).withIndex()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((index, button) in row.withIndex()) {
                    val exchange = rowIndex == 1
                    val enabledButton = canAct && button.second in legalButtons && (if (exchange) st.phase == 1 && (index == 0 || mask != 0) else st.phase != 1)
                    BigButton(button.first, Modifier.weight(1f), enabled = enabledButton, primary = exchange && index == 1) {
                        val m = button.second; mask = 0; move(m)
                    }
                }
            }
        }
    }
}
