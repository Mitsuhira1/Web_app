package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
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
import jp.yonekou.asobi26.core.games.Backgammon
import jp.yonekou.asobi26.core.games.BgState
import jp.yonekou.asobi26.core.games.CcState
import jp.yonekou.asobi26.core.games.ChineseCheckers
import jp.yonekou.asobi26.core.games.Ludo
import jp.yonekou.asobi26.core.games.LudoState
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// =====================================================================
// 第2弾の盤: バックギャモン・ルドー・チャイニーズチェッカー
// =====================================================================

/** サイコロ1個(中心と一辺)。dim=true は使い終わった目 */
fun DrawScope.drawDie(center: Offset, s: Float, face: Int, dim: Boolean = false, rot: Float = 0f) {
    if (s <= 2f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    rotate(rot, pivot = center) {
        val tl = center - Offset(s / 2, s / 2)
        val rr = CornerRadius(s * 0.2f)
        drawRoundRect(Color(0x55000000), tl + Offset(s * 0.03f, s * 0.07f), Size(s, s), rr)
        drawRoundRect(Brush.linearGradient(listOf(Mat.ivoryTop, Mat.ivoryBottom), tl, tl + Offset(s, s)), tl, Size(s, s), rr)
        drawRoundRect(Mat.ivoryEdge, tl, Size(s, s), rr, style = Stroke(1f))
        val pip = s * 0.115f
        val q = s * 0.26f
        val spots = when (face) {
            1 -> listOf(0 to 0)
            2 -> listOf(-1 to -1, 1 to 1)
            3 -> listOf(-1 to -1, 0 to 0, 1 to 1)
            4 -> listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1)
            5 -> listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1)
            else -> listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1)
        }
        for ((dx, dy) in spots) {
            val o = Offset(center.x + dx * q, center.y + dy * q)
            val pr = if (face == 1) pip * 1.6f else pip
            drawCircle(Color(0x33000000), pr * 1.12f, o + Offset(0f, pr * 0.12f))
            drawCircle(safeRadial(listOf(if (face == 1) Color(0xFFB0261A) else Color(0xFF05070B), if (face == 1) Color(0xFFE0483A) else Color(0xFF2A2F3C)), o, pr), pr, o)
        }
        if (dim) drawRoundRect(Color(0x99000000), tl, Size(s, s), rr)
    }
}

/** 「振る」ボタン(黄の帯)と、その横のサイコロ */
@Composable
fun RollBar(dice: List<Int>, used: Int, canRoll: Boolean, onRoll: () -> Unit) {
    val c = LocalAsobi.current
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.width(96.dp).height(40.dp)) {
            val s = size.height * 0.9f
            dice.forEachIndexed { i, f -> drawDie(Offset(s * 0.6f + i * s * 1.15f, size.height / 2), s, f, dim = i < used) }
        }
        val shape = RoundedCornerShape(14.dp)
        Box(
            Modifier.weight(1f).height(46.dp).clip(shape)
                .background(if (canRoll) c.primaryBrush else Brush.verticalGradient(listOf(c.surface2, c.surface2)))
                .clickable(enabled = canRoll, role = Role.Button, onClick = onRoll),
            contentAlignment = Alignment.Center,
        ) {
            Text("振る", color = if (canRoll) c.onPrimary else c.sub, fontSize = 16.sp, fontWeight = FontWeight.Black)
        }
    }
}

// =====================================================================
// バックギャモン
// =====================================================================

private val BG_WHITE = Color(0xFFEFE3C8)
private val BG_BLACK = Color(0xFF33271F)
private const val BG_MS = 260
private const val ROLL_MS = 420

private class BgGeo(val w: Float, val h: Float) {
    val m = w * 0.03f
    val trayW = w * 0.085f
    val barW = w * 0.07f
    val colW = (w - 2 * m - trayW - barW) / 12f
    val r = min(colW * 0.46f, (h - 2 * m) * 0.042f)
    val top = m
    val bottom = h - m
    val barX = m + 6 * colW + barW / 2
    val trayX = w - m - trayW / 2
    fun colX(c: Int) = m + c * colW + (if (c >= 6) barW else 0f) + colW / 2
    /** 表示用のポイント番号(0〜23) → 列と上下 */
    fun place(vi: Int): Pair<Int, Boolean> = if (vi < 12) (11 - vi) to false else (vi - 12) to true
    fun stackPos(vi: Int, k: Int): Offset {
        val (c, top) = place(vi)
        val step = 2 * r
        val y = if (top) this.top + r + k * step else bottom - r - k * step
        return Offset(colX(c), y)
    }
}

@Composable
fun BackgammonBoard(ses: Session<BgState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val tm = rememberTextMeasurer()
    val B = Backgammon
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        when {
            t.lastMove == B.ROLL -> { sfx?.play(Sound.DICE); delay(ROLL_MS.toLong() - 120); sfx?.play(Sound.DICE, volume = 0.6f) }
            t.lastMove >= 1000 -> { delay(BG_MS.toLong() - 30); sfx?.play(Sound.WOOD, rate = 1.05f); if (t.lastHit) { delay(60); sfx?.play(Sound.TAKE, volume = 0.7f) } }
        }
    }) { _, t -> when { t.lastMove == B.ROLL -> ROLL_MS; t.lastMove >= 1000 -> BG_MS + (if (t.lastHit) 120 else 40); else -> 0 } }
    val st = ma.to
    val me = viewSeat(ses)
    val flip = me == 1
    fun vi(i: Int) = if (flip) 23 - i else i
    var sel by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { sel = -1 }
    val legal = if (enabled && ma.done) B.legalMoves(st) else IntArray(0)
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    var lastDest by remember(ses) { mutableIntStateOf(-1) }
    val OFF = 100
    fun targetOf(s: BgState, m: Int): Int {
        val f = B.fromOf(m); val d = B.dieOf(m)
        val t = if (f == B.BAR) (if (s.turn == 0) 24 - d else d - 1) else if (s.turn == 0) f - d else f + d
        return if (t in 0..23) t else OFF
    }
    LaunchedEffect(version) { if (st.lastMove >= 1000) lastDest = targetOf(ma.from, st.lastMove) }
    Column(Modifier.fillMaxWidth()) {
        Canvas(
            Modifier.fillMaxWidth().aspectRatio(1.22f).testTag("board").pointerInput(ses) {
                detectTapGestures { p ->
                    val lm = legalNow.filter { it >= 1000 }
                    if (lm.isEmpty()) return@detectTapGestures
                    val g = BgGeo(size.width.toFloat(), size.height.toFloat())
                    val s = ses.state
                    // どこをタップしたか: ポイント・バー・上がりの台
                    val hit: Int = when {
                        p.x > g.w - g.m - g.trayW -> OFF
                        abs(p.x - g.barX) < g.barW / 2 -> B.BAR
                        else -> {
                            val x = p.x - g.m
                            var c = (x / g.colW).toInt()
                            if (x > 6 * g.colW) c = ((x - g.barW) / g.colW).toInt()
                            c = c.coerceIn(0, 11)
                            val topHalf = p.y < g.h / 2
                            val v = if (topHalf) 12 + c else 11 - c
                            if (flip) 23 - v else v
                        }
                    }
                    if (sel != -1) {
                        val cands = lm.filter { B.fromOf(it) == sel && targetOf(s, it) == hit }
                        if (cands.isNotEmpty()) { sel = -1; move(cands.minBy { B.dieOf(it) }); return@detectTapGestures }
                    }
                    sel = if (lm.any { B.fromOf(it) == hit }) hit else -1
                }
            },
        ) {
            val g = BgGeo(size.width, size.height)
            woodPanel(Offset.Zero, size, g.m * 1.2f, Mat.walnutTop, Mat.walnutBottom)
            // 盤面
            val felt = Brush.verticalGradient(listOf(Mat.feltTop, Mat.feltBottom), startY = g.m, endY = g.h - g.m)
            drawRect(felt, Offset(g.m, g.m), Size(6 * g.colW, g.h - 2 * g.m))
            drawRect(felt, Offset(g.m + 6 * g.colW + g.barW, g.m), Size(6 * g.colW, g.h - 2 * g.m))
            drawRect(Mat.walnutShadow, Offset(g.barX - g.barW / 2, g.m), Size(g.barW, g.h - 2 * g.m))
            drawRect(Mat.walnutShadow, Offset(g.w - g.m - g.trayW, g.m), Size(g.trayW, g.h - 2 * g.m))
            val triH = (g.h - 2 * g.m) * 0.42f
            for (c in 0 until 12) {
                val x = g.colX(c)
                val col1 = if (c % 2 == 0) Color(0xFF8A3B2A) else Color(0xFFE6D3A8)
                val col2 = if (c % 2 == 0) Color(0xFFE6D3A8) else Color(0xFF8A3B2A)
                drawPath(Path().apply { moveTo(x - g.colW / 2, g.top); lineTo(x + g.colW / 2, g.top); lineTo(x, g.top + triH); close() }, col1)
                drawPath(Path().apply { moveTo(x - g.colW / 2, g.bottom); lineTo(x + g.colW / 2, g.bottom); lineTo(x, g.bottom - triH); close() }, col2)
            }
            // 直前の手の行き先
            val anim = !ma.done
            val last = st.lastMove
            // 選んだ所と、行き先の印
            if (sel >= 0 && ma.done) {
                if (sel == B.BAR) drawRect(ACCENT.copy(alpha = 0.35f), Offset(g.barX - g.barW / 2, g.m), Size(g.barW, g.h - 2 * g.m))
                else { val (c, top) = g.place(vi(sel)); drawRect(ACCENT.copy(alpha = 0.3f), Offset(g.colX(c) - g.colW / 2, if (top) g.top else g.bottom - triH), Size(g.colW, triH)) }
                for (m in legal) if (m >= 1000 && B.fromOf(m) == sel) {
                    val t = targetOf(st, m)
                    if (t == OFF) drawRect(ACCENT.copy(alpha = 0.4f), Offset(g.w - g.m - g.trayW, g.m), Size(g.trayW, g.h - 2 * g.m))
                    else { val (c, top) = g.place(vi(t)); drawCircle(Color(0xCCFFFDF8), g.r * 0.35f, Offset(g.colX(c), if (top) g.top + triH + g.r * 0.6f else g.bottom - triH - g.r * 0.6f)) }
                }
            }
            // 駒を描く(動いている駒は、元の局面から1つ減らして別に描く)
            val showSt = if (anim && last >= 1000) ma.from else st
            val movingFrom = if (anim && last >= 1000) B.fromOf(last) else -2
            val moverSide = ma.from.turn
            for (i in 0 until 24) {
                var cnt = abs(showSt.points[i])
                if (cnt == 0) continue
                val white = showSt.points[i] > 0
                if (i == movingFrom) cnt--
                // 打たれた駒は、動きの後半で消える
                val hitHere = anim && st.lastHit && last >= 1000 && targetOf(ma.from, last) == i
                val drawn = min(cnt, 5)
                for (k in 0 until drawn) {
                    val alpha = if (hitHere) (1f - ((ma.elapsed - BG_MS * 0.5f) / (BG_MS * 0.5f)).coerceIn(0f, 1f)) else 1f
                    bgChecker(g.stackPos(vi(i), k), g.r, white, alpha = alpha)
                }
                if (ma.done && i == lastDest && drawn > 0) drawCircle(ACCENT, g.r * 1.08f, g.stackPos(vi(i), drawn - 1), style = Stroke(g.r * .15f))
                if (cnt > 5) {
                    val pos = g.stackPos(vi(i), 4)
                    val lay = tm.measure("$cnt", TextStyle(color = if (white) Color(0xFF1E2230) else Color.White, fontSize = (g.r * 0.9f / density).sp, fontWeight = FontWeight.Black))
                    drawText(lay, topLeft = pos - Offset(lay.size.width / 2f, lay.size.height / 2f))
                }
            }
            // バーの駒(人の駒は下半分、相手は上半分)
            for (side in 0..1) {
                val cnt = showSt.bar[side] - (if (movingFrom == B.BAR && side == moverSide) 1 else 0)
                val mine = side == (if (flip) 1 else 0)
                for (k in 0 until min(cnt, 4)) {
                    val y = if (mine) g.h / 2 + g.r * 1.4f + k * g.r * 1.6f else g.h / 2 - g.r * 1.4f - k * g.r * 1.6f
                    stone(Offset(g.barX, y), g.r * 0.92f, if (side == 0) BG_WHITE else BG_BLACK)
                }
                // 上がった駒(薄い板を重ねる)
                val off = showSt.off[side]
                for (k in 0 until off) {
                    val y = if (mine) g.bottom - g.r * 0.4f - k * g.r * 0.42f else g.top + g.r * 0.4f + k * g.r * 0.42f
                    drawRoundRect(if (side == 0) BG_WHITE else BG_BLACK, Offset(g.trayX - g.trayW * 0.38f, y - g.r * 0.16f), Size(g.trayW * 0.76f, g.r * 0.32f), CornerRadius(g.r * 0.1f))
                    drawRoundRect(Color(0x55000000), Offset(g.trayX - g.trayW * 0.38f, y - g.r * 0.16f), Size(g.trayW * 0.76f, g.r * 0.32f), CornerRadius(g.r * 0.1f), style = Stroke(1f))
                }
            }
            // 動いている駒
            if (anim && last >= 1000) {
                val t = ease((ma.elapsed / BG_MS).coerceIn(0f, 1f))
                val from = B.fromOf(last)
                val mine = moverSide == (if (flip) 1 else 0)
                val start = if (from == B.BAR) Offset(g.barX, if (mine) g.h / 2 + g.r * 1.4f else g.h / 2 - g.r * 1.4f)
                else g.stackPos(vi(from), (abs(ma.from.points[from]) - 1).coerceIn(0, 4))
                val to = targetOf(ma.from, last)
                val end = if (to == OFF) Offset(g.trayX, if (mine) g.bottom - g.r else g.top + g.r)
                else g.stackPos(vi(to), (abs(st.points[to]) - 1).coerceIn(0, 4))
                val lift = g.r * 1.2f * sin(PI.toFloat() * t)
                stone(Offset(mix(start.x, end.x, t), mix(start.y, end.y, t) - lift), g.r * (1f + 0.08f * sin(PI.toFloat() * t)), if (moverSide == 0) BG_WHITE else BG_BLACK)
            }
            // サイコロ(右半分の真ん中。振っている間は転がす)
            // サイコロ(右半分の真ん中)。ゾロ目は4つ並べ、使った目は暗くする。振っている間は転がす
            val showDice = st.shown.size == 2 && (st.rolled || (anim && last >= 1000))
            if (showDice) {
                val a = st.shown[0]; val b = st.shown[1]
                val faces = if (a == b) listOf(a, a, a, a) else listOf(a, b)
                val s = g.colW * (if (faces.size == 4) 0.72f else 0.95f)
                val cx = g.m + 6 * g.colW + g.barW + 3 * g.colW
                val rolling = anim && last == B.ROLL
                val spin = if (rolling) (1f - ma.elapsed / ROLL_MS).coerceIn(0f, 1f) else 0f
                faces.forEachIndexed { k, f ->
                    val face = if (rolling && spin > 0.15f) ((ma.elapsed / 60).toInt() + k * 3) % 6 + 1 else f
                    val dim = !rolling && (!st.rolled || (if (a == b) k < 4 - st.dice.size else !st.dice.contains(f)))
                    val x = cx + (k - (faces.size - 1) / 2f) * s * 1.25f
                    drawDie(Offset(x, g.h / 2), s, face, dim = dim, rot = spin * 200f * (if (k % 2 == 0) 1 else -1))
                }
            }
        }
        val canRoll = enabled && ma.done && legal.contains(B.ROLL)
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val c = LocalAsobi.current
            // 残りの数(白い小札)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((label, n) in listOf("あなた" to B.pips(st, me), "相手" to B.pips(st, 1 - me))) {
                    Text("$label 残り $n", color = Color(0xFF3A2414), fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xE6FFFFFF)).padding(horizontal = 10.dp, vertical = 2.dp))
                }
            }
            val shape = RoundedCornerShape(14.dp)
            Box(
                Modifier.width(150.dp).height(46.dp).clip(shape)
                    .background(if (canRoll) c.primaryBrush else Brush.verticalGradient(listOf(Color(0x33000000), Color(0x33000000))))
                    .border(2.dp, if (canRoll) ACCENT else Color.Transparent, shape)
                    .clickable(enabled = canRoll, role = Role.Button) { move(B.ROLL) },
                contentAlignment = Alignment.Center,
            ) { Text("振る", color = if (canRoll) c.onPrimary else Color(0x99FFFFFF), fontSize = 16.sp, fontWeight = FontWeight.Black) }
        }
    }
}

/** バックギャモンの駒(木の丸駒。2本の輪の彫りと影) */
private fun DrawScope.bgChecker(c: Offset, r: Float, white: Boolean, alpha: Float = 1f) {
    if (r <= 0.5f) return
    val base = if (white) BG_WHITE else BG_BLACK
    stone(c, r, base, alpha = alpha)
    val ring = (if (white) Color(0xFF8A7A5C) else Color(0xFF0A0806)).copy(alpha = 0.55f * alpha)
    drawCircle(ring, r * 0.74f, c, style = Stroke(r * 0.07f))
    drawCircle(ring, r * 0.5f, c, style = Stroke(r * 0.06f))
}

// =====================================================================
// ルドー
// =====================================================================

/** 色の位置ごとの色(赤・緑・黄・青) */
val LUDO_COLORS = listOf(Color(0xFFC8463C), Color(0xFF3E9B63), Color(0xFFE0AE36), Color(0xFF3F78C4))
val LUDO_NAMES = listOf("赤", "緑", "黄", "青")

/** 赤(左下)から時計回りの周回 52 マス(列, 行) */
private val LUDO_PATH: List<Pair<Int, Int>> = buildList {
    for (y in 13 downTo 9) add(6 to y)
    for (x in 5 downTo 0) add(x to 8)
    add(0 to 7)
    for (x in 0..5) add(x to 6)
    for (y in 5 downTo 0) add(6 to y)
    add(7 to 0)
    for (y in 0..5) add(8 to y)
    for (x in 9..14) add(x to 6)
    add(14 to 7)
    for (x in 14 downTo 9) add(x to 8)
    for (y in 9..14) add(8 to y)
    add(7 to 14)
    add(6 to 14)
}
private val LUDO_HOME_COL = (13 downTo 9).map { 7 to it }
private val LUDO_BASE = listOf(1.8f to 10.8f, 4.2f to 10.8f, 1.8f to 13.2f, 4.2f to 13.2f)

/** 時計回りに k 回、90度回す(15×15) */
private fun rotCw(x: Float, y: Float, k: Int): Pair<Float, Float> {
    var a = x; var b = y
    repeat(((k % 4) + 4) % 4) { val nx = 14f - b; val ny = a; a = nx; b = ny }
    return a to b
}

/** 色の位置 slot の駒の、進み p の時のマスの中心(列・行。小数) */
private fun ludoCell(slot: Int, p: Int, token: Int): Pair<Float, Float> {
    val base = when {
        p < 0 -> LUDO_BASE[token].let { (it.first - 0.5f) to (it.second - 0.5f) }
        p <= 50 -> LUDO_PATH[p].let { it.first.toFloat() to it.second.toFloat() }
        p < Ludo.GOAL -> LUDO_HOME_COL[p - 51].let { it.first.toFloat() to it.second.toFloat() }
        else -> (7f - 0.35f + (token % 2) * 0.7f) to (7.6f - (token / 2) * 0.45f)
    }
    return rotCw(base.first, base.second, slot)
}

@Composable
fun LudoBoard(ses: Session<LudoState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit, showRollControl: Boolean = true) {
    val sfx = LocalSfx.current
    val g = ses.rules as Ludo
    val stepMs = 110
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, t ->
        val m = t.lastMove
        if (m == Ludo.ROLL) { sfx?.play(Sound.DICE); return@rememberMoveAnim }
        if (m in 1..4) {
            val seat = from.turn
            val f = from.pos[seat][m - 1]
            val steps = if (f < 0) 1 else t.pos[seat][m - 1] - f
            repeat(steps) { delay(stepMs.toLong()); sfx?.play(Sound.PEG, rate = 1f + it * 0.02f, volume = 0.8f) }
            if (t.captured >= 0) { delay(40); sfx?.play(Sound.TAKE, volume = 0.8f) }
        }
    }) { from, t ->
        val m = t.lastMove
        when {
            m == Ludo.ROLL -> 380
            m in 1..4 -> { val f = from.pos[from.turn][m - 1]; (if (f < 0) 1 else t.pos[from.turn][m - 1] - f) * stepMs + (if (t.captured >= 0) 600 else 60) }
            else -> 0
        }
    }
    val st = ma.to
    var lastToken by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { if (st.lastMove in 1..4) lastToken = ma.from.turn * 4 + st.lastMove - 1 }
    val me = viewSeat(ses)
    val view = g.slots[me] // この色の位置を左下に回す
    val legal = if (enabled && ma.done) g.legalMoves(st) else IntArray(0)
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    fun toView(x: Float, y: Float) = rotCw(x, y, -view)
    Column(Modifier.fillMaxWidth()) {
        val active = if (!ma.done && st.lastMove in 1..4) ma.from.turn else st.turn
        val activeColor = LUDO_COLORS[g.slots[active]]
        Text(
            "${LUDO_NAMES[g.slots[active]]}・${seatLabel(ses, active)}の番",
            color = LocalAsobi.current.ink, fontSize = 16.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                .border(2.dp, activeColor, RoundedCornerShape(12.dp))
                .background(activeColor.copy(alpha = 0.12f), RoundedCornerShape(12.dp)).padding(10.dp),
        )
        Canvas(
            Modifier.weight(1f, fill = false).aspectRatio(1f, matchHeightConstraintsFirst = true).align(Alignment.CenterHorizontally).testTag("ludoBoard").pointerInput(ses) {
                detectTapGestures { p ->
                    val lm = legalNow.filter { it in 1..4 }
                    if (lm.isEmpty()) return@detectTapGestures
                    val cell = size.width / 15f
                    val s = ses.state
                    val seat = s.turn
                    // 一番近い、動かせる駒
                    val best = lm.minByOrNull { m ->
                        val (cx, cy) = ludoCell(g.slots[seat], s.pos[seat][m - 1], m - 1).let { toView(it.first, it.second) }
                        val dx = (cx + 0.5f) * cell - p.x; val dy = (cy + 0.5f) * cell - p.y
                        dx * dx + dy * dy
                    } ?: return@detectTapGestures
                    val (cx, cy) = ludoCell(g.slots[seat], s.pos[seat][best - 1], best - 1).let { toView(it.first, it.second) }
                    if (abs((cx + 0.5f) * cell - p.x) < cell * 1.1f && abs((cy + 0.5f) * cell - p.y) < cell * 1.1f) move(best)
                }
            },
        ) {
            val cell = size.width / 15f
            fun rectAt(x: Float, y: Float) = Offset(x * cell, y * cell)
            // 盤の角は丸く切り抜く(家の四角の角と盤の地の色が合わず、白い所が見えていた)
            clipPath(Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, size.width, size.height, CornerRadius(cell * 0.4f))) }) {
            drawRect(Brush.verticalGradient(listOf(Color(0xFFF6EFDD), Color(0xFFEDE3CB))), size = size)
            // 4つの家
            for (slot in 0..3) {
                val col = LUDO_COLORS[slot]
                // 6×6 の四角は回すと角の位置が変わるので、4つの角から左上を求める
                val corners = listOf(rotCw(0f, 9f, slot - view), rotCw(5f, 9f, slot - view), rotCw(0f, 14f, slot - view), rotCw(5f, 14f, slot - view))
                val minX = corners.minOf { it.first }; val minY = corners.minOf { it.second }
                drawRect(col, rectAt(minX, minY), Size(6 * cell, 6 * cell))
                drawRoundRect(Color(0xFFF6EFDD), rectAt(minX + 1f, minY + 1f), Size(4 * cell, 4 * cell), CornerRadius(cell * 0.4f))
                for (k in 0 until 4) {
                    val (bx, by) = rotCw(LUDO_BASE[k].first - 0.5f, LUDO_BASE[k].second - 0.5f, slot - view)
                    drawCircle(col.copy(alpha = 0.35f), cell * 0.42f, Offset((bx + 0.5f) * cell, (by + 0.5f) * cell))
                }
            }
            // 周回のマス
            for ((i, xy) in LUDO_PATH.withIndex()) {
                val (x, y) = toView(xy.first.toFloat(), xy.second.toFloat())
                val startSlot = if (i % 13 == 0) i / 13 else -1
                val fill = if (startSlot >= 0) LUDO_COLORS[startSlot] else Color.White
                drawRect(fill, rectAt(x, y), Size(cell, cell))
                drawRect(Color(0x33000000), rectAt(x, y), Size(cell, cell), style = Stroke(1f))
                if (i in Ludo.SAFE && startSlot < 0) {
                    // 星のマス
                    val c0 = Offset((x + 0.5f) * cell, (y + 0.5f) * cell)
                    val star = Path()
                    for (k in 0 until 10) {
                        val rr = if (k % 2 == 0) cell * 0.36f else cell * 0.15f
                        val a = -PI / 2 + k * PI / 5
                        val pt = c0 + Offset((rr * kotlin.math.cos(a)).toFloat(), (rr * kotlin.math.sin(a)).toFloat())
                        if (k == 0) star.moveTo(pt.x, pt.y) else star.lineTo(pt.x, pt.y)
                    }
                    star.close()
                    drawPath(star, Color(0xFFBDB6A6))
                }
            }
            // ゴールへの道と、中央のゴール
            for (slot in 0..3) {
                for ((x0, y0) in LUDO_HOME_COL) {
                    val (x, y) = rotCw(x0.toFloat(), y0.toFloat(), slot - view)
                    drawRect(LUDO_COLORS[slot], rectAt(x, y), Size(cell, cell))
                    drawRect(Color(0x33000000), rectAt(x, y), Size(cell, cell), style = Stroke(1f))
                }
                val tri = Path()
                val pts = listOf(6f to 9f, 9f to 9f, 7.5f to 7.5f).map { rotCw(it.first - 0.5f, it.second - 0.5f, slot - view) }.map { Offset((it.first + 0.5f) * cell, (it.second + 0.5f) * cell) }
                tri.moveTo(pts[0].x, pts[0].y); tri.lineTo(pts[1].x, pts[1].y); tri.lineTo(pts[2].x, pts[2].y); tri.close()
                drawPath(tri, LUDO_COLORS[slot])
            }
            // サイコロは盤の中央(象牙色)
            val dieFace = if (st.die > 0) st.die else 0
            if (dieFace > 0) {
                val ds = cell * 1.6f
                val tl = Offset(7.5f * cell - ds / 2, 7.5f * cell - ds / 2)
                drawRoundRect(Color.Black.copy(alpha = 0.3f), tl + Offset(0f, cell * 0.1f), Size(ds, ds), CornerRadius(ds * 0.2f))
                drawRoundRect(Brush.verticalGradient(listOf(Mat.ivoryTop, Mat.ivoryBottom), startY = tl.y, endY = tl.y + ds), tl, Size(ds, ds), CornerRadius(ds * 0.2f))
                drawRoundRect(Mat.ivoryEdge, tl, Size(ds, ds), CornerRadius(ds * 0.2f), style = Stroke(1f))
                val pips = when (dieFace) {
                    1 -> listOf(0 to 0); 2 -> listOf(-1 to -1, 1 to 1); 3 -> listOf(-1 to -1, 0 to 0, 1 to 1)
                    4 -> listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1); 5 -> listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1)
                    else -> listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1)
                }
                for ((dx, dy) in pips) drawCircle(if (dieFace == 1) Color(0xFFC8362E) else Color(0xFF22283A), ds * (if (dieFace == 1) 0.13f else 0.09f), Offset(7.5f * cell + dx * ds * 0.26f, 7.5f * cell + dy * ds * 0.26f))
            }
            }
            // 駒
            val anim = !ma.done
            val m = st.lastMove
            val mover = if (anim && m in 1..4) ma.from.turn * 4 + (m - 1) else -1
            val showPos = if (anim && m in 1..4) ma.from.pos else st.pos
            val captureAt = ludoSteps(ma.from, m) * stepMs
            val captured = if (anim && m in 1..4) st.captured else -1
            // 同じ穴の駒をマス内の格子に分ける。異なる色が安全マスに並ぶ時も隠さない。
            val groups = (0 until g.players * 4).filter { it != mover && it != captured }.groupBy { id ->
                ludoCell(g.slots[id / 4], showPos[id / 4][id % 4], id % 4).let { toView(it.first, it.second) }
            }
            for ((xy, ids) in groups) {
                val cols = kotlin.math.ceil(sqrt(ids.size.toFloat())).toInt()
                val rows = (ids.size + cols - 1) / cols
                val scale = if (ids.size == 1) 1f else 0.86f / cols
                for ((index, id) in ids.withIndex()) {
                    val seat = id / 4; val k = id % 4
                    val dx = if (ids.size == 1) 0f else (index % cols - (cols - 1) / 2f) * cell * 0.88f / cols
                    val dy = if (ids.size == 1) 0f else (index / cols - (rows - 1) / 2f) * cell * 0.88f / rows
                    val at = Offset((xy.first + 0.5f) * cell + dx, (xy.second + 0.5f) * cell + dy)
                    ludoPawn(at, cell * scale, LUDO_COLORS[g.slots[seat]])
                    if (ma.done && id == lastToken)
                        drawCircle(Color.White, cell * scale * .44f, at, style = Stroke(cell * scale * .07f))
                    if (seat == st.turn && legal.contains(k + 1)) drawCircle(ACCENT, cell * scale * 0.5f, at, style = Stroke(cell * scale * 0.1f))
                }
            }
            if (captured >= 0) {
                val seat = captured / 4; val k = captured % 4
                val start = ludoCell(g.slots[seat], ma.from.pos[seat][k], k).let { toView(it.first, it.second) }
                val end = ludoCell(g.slots[seat], -1, k).let { toView(it.first, it.second) }
                val time = (ma.elapsed - captureAt).coerceAtLeast(0f)
                val t = ease(((time - 120f) / 480f).coerceIn(0f, 1f))
                val origin = Offset((start.first + 0.5f) * cell, (start.second + 0.5f) * cell)
                if (time > 0 && time < 300) drawCircle(ACCENT.copy(alpha = 1f - time / 300f), cell * (0.45f + time / 300f), origin, style = Stroke(cell * 0.12f))
                ludoPawn(Offset((mix(start.first, end.first, t) + 0.5f) * cell,
                    (mix(start.second, end.second, t) + 0.5f) * cell - cell * sin(PI.toFloat() * t)), cell, LUDO_COLORS[g.slots[seat]])
            }
            if (mover >= 0) {
                val seat = mover / 4; val k = mover % 4
                val f = ma.from.pos[seat][k]
                val steps = ludoSteps(ma.from, m)
                val prog = (ma.elapsed / stepMs).coerceIn(0f, steps.toFloat())
                val i = min(prog.toInt(), steps - 1).coerceAtLeast(0)
                val t = ease(prog - i)
                val a = ludoCell(g.slots[seat], if (f < 0) -1 else f + i, k).let { toView(it.first, it.second) }
                val b = ludoCell(g.slots[seat], if (f < 0) 0 else f + i + 1, k).let { toView(it.first, it.second) }
                val pt = Offset((mix(a.first, b.first, t) + 0.5f) * cell, (mix(a.second, b.second, t) + 0.5f) * cell - cell * 0.35f * sin(PI.toFloat() * t))
                ludoPawn(pt, cell, LUDO_COLORS[g.slots[seat]])
            }
        }
        val canRoll = enabled && ma.done && legal.contains(Ludo.ROLL)
        val face = if (st.die > 0) st.die else if (!ma.done && st.lastMove == Ludo.ROLL) st.die else 0
        if (showRollControl) RollBar(if (face > 0) listOf(face) else emptyList(), 0, canRoll) { move(Ludo.ROLL) }
    }
}

private fun ludoSteps(from: LudoState, m: Int): Int {
    if (m !in 1..4) return 0
    val f = from.pos[from.turn][m - 1]
    return if (f < 0) 1 else from.die
}

/** ルドーの駒(立体のポーン: 下に影、すその広い胴と丸い頭。光は左上から) */
fun DrawScope.ludoPawn(c: Offset, cell: Float, col: Color) {
    if (cell <= 1f) return
    val dark = androidx.compose.ui.graphics.lerp(col, Color.Black, 0.35f)
    val light = androidx.compose.ui.graphics.lerp(col, Color.White, 0.45f)
    // 影
    drawOval(Color.Black.copy(alpha = 0.3f), c + Offset(-cell * 0.3f, cell * 0.22f), Size(cell * 0.66f, cell * 0.2f))
    // 胴(すその広い形)
    val body = Path().apply {
        moveTo(c.x - cell * 0.3f, c.y + cell * 0.3f)
        quadraticBezierTo(c.x - cell * 0.28f, c.y + cell * 0.12f, c.x - cell * 0.1f, c.y - cell * 0.02f)
        lineTo(c.x + cell * 0.1f, c.y - cell * 0.02f)
        quadraticBezierTo(c.x + cell * 0.28f, c.y + cell * 0.12f, c.x + cell * 0.3f, c.y + cell * 0.3f)
        close()
    }
    drawPath(body, Brush.horizontalGradient(listOf(light, col, dark), startX = c.x - cell * 0.3f, endX = c.x + cell * 0.3f))
    drawPath(body, dark, style = Stroke(cell * 0.03f))
    // 頭
    val head = c - Offset(0f, cell * 0.14f)
    val hr = cell * 0.17f
    drawCircle(safeRadial(listOf(light, col, dark), head - Offset(hr * 0.35f, hr * 0.4f), hr * 1.6f), hr, head)
    drawCircle(dark, hr, head, style = Stroke(cell * 0.025f))
}

// =====================================================================
// チャイニーズチェッカー
// =====================================================================

val CC_COLORS = listOf(Color(0xFFE0463A), Color(0xFF3A7BE0), Color(0xFF2FA36C), Color(0xFFF2C230), Color(0xFF8E5BD6), Color(0xFFF2F0EA))
val CC_NAMES = listOf("赤", "青", "緑", "黄", "紫", "白")
private const val CC_HOP = 150

/** 立方体座標を、陣地 k が下に来るように回す(60度ずつ) */
private fun ccRotate(q: Int, r: Int, k: Int): Pair<Int, Int> {
    var a = q; var b = r; var s = -q - r
    repeat(((k % 6) + 6) % 6) { val na = -s; val nb = -a; val ns = -b; a = na; b = nb; s = ns }
    return a to b
}

@Composable
fun ChineseBoard(ses: Session<CcState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val g = ses.rules as ChineseCheckers
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, t ->
        val m = t.lastMove
        val path = g.path(from.board, m / 128, m % 128)
        for (k in 1 until path.size) { delay(CC_HOP.toLong() - 20); sfx?.play(Sound.MARBLE, rate = 1f + k * 0.03f, volume = 0.8f) }
    }) { from, t -> if (t.lastMove < 0) 0 else (g.path(from.board, t.lastMove / 128, t.lastMove % 128).size - 1) * CC_HOP + 60 }
    val st = ma.to
    val me = viewSeat(ses)
    val rot = g.camps[me]
    var sel by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { sel = -1 }
    val legal = if (enabled && ma.done) g.legalMoves(st) else IntArray(0)
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    val sq3 = sqrt(3f)
    fun pos(i: Int, w: Float, h: Float): Offset {
        val (q, r) = ccRotate(ChineseCheckers.POINTS[i][0], ChineseCheckers.POINTS[i][1], rot)
        val unit = min(w / (sq3 * 12f + 1.6f), h / 25.6f)
        return Offset(w / 2 + unit * sq3 * (q + r / 2f), h / 2 + unit * 1.5f * r)
    }
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(0.92f).pointerInput(ses) {
            detectTapGestures { p ->
                val lm = legalNow
                if (lm.isEmpty()) return@detectTapGestures
                val w = size.width.toFloat(); val h = size.height.toFloat()
                val hit = ChineseCheckers.POINTS.indices.minBy { (pos(it, w, h) - p).getDistanceSquared() }
                val unit = min(w / (sq3 * 12f + 1.6f), h / 25.6f)
                if ((pos(hit, w, h) - p).getDistance() > unit * 1.2f) { sel = -1; return@detectTapGestures }
                if (sel >= 0) {
                    val m = lm.firstOrNull { it / 128 == sel && it % 128 == hit }
                    if (m != null) { sel = -1; move(m); return@detectTapGestures }
                }
                sel = if (lm.any { it / 128 == hit }) hit else -1
            }
        },
    ) {
        val w = size.width; val h = size.height
        val unit = min(w / (sq3 * 12f + 1.6f), h / 25.6f)
        // 丸い木の盤(下に影)
        val discR = min(w, h) / 2f * 0.99f
        drawCircle(Color.Black.copy(alpha = 0.3f), discR, Offset(w / 2, h / 2 + unit * 0.25f))
        drawCircle(Brush.verticalGradient(listOf(Mat.oakTop, Mat.oakBottom), startY = h / 2 - discR, endY = h / 2 + discR), discR, Offset(w / 2, h / 2))
        drawCircle(Color(0xFF6E4A26), discR * 0.97f, Offset(w / 2, h / 2), style = Stroke(unit * 0.08f))
        // 星形(2つの大きな三角を重ねる)は、うすく彫った面
        fun tri(a: Pair<Int, Int>, b: Pair<Int, Int>, c: Pair<Int, Int>) {
            val pts = listOf(a, b, c).map { (q, r) -> val (rq, rr) = ccRotate(q, r, rot); Offset(w / 2 + unit * sq3 * (rq + rr / 2f), h / 2 + unit * 1.5f * rr) }
            val c0 = Offset(w / 2, h / 2)
            val grow = pts.map { c0 + (it - c0) * 1.09f }
            val p = Path().apply { moveTo(grow[0].x, grow[0].y); lineTo(grow[1].x, grow[1].y); lineTo(grow[2].x, grow[2].y); close() }
            drawPath(p, Color(0x1F000000))
        }
        tri(-4 to 8, -4 to -4, 8 to -4)
        tri(4 to -8, 4 to 4, -8 to 4)
        // 陣地の色
        for (seat in 0 until g.players) {
            val col = CC_COLORS[seat]
            for (i in ChineseCheckers.CAMP_POINTS[g.camps[seat]]) drawCircle(col.copy(alpha = 0.28f), unit * 0.72f, pos(i, w, h))
        }
        // 穴
        for (i in ChineseCheckers.POINTS.indices) {
            val o = pos(i, w, h)
            // 彫った穴(内側が暗い)
            drawCircle(safeRadial(listOf(Color(0xFF1E120A), Color(0xFF4A2E1A)), o, unit * 0.36f), unit * 0.36f, o)
            drawCircle(Color(0x40FFFFFF), unit * 0.36f, o + Offset(0f, unit * 0.05f), style = Stroke(unit * 0.05f))
        }
        val anim = !ma.done && st.lastMove >= 0
        val showBoard = if (anim) ma.from.board else st.board
        val moverFrom = if (anim) st.lastMove / 128 else -1
        for (i in showBoard.indices) {
            val v = showBoard[i]
            if (v == 0 || i == moverFrom) continue
            glassStone(pos(i, w, h), unit * 0.52f, CC_COLORS[v - 1])
        }
        if (!anim && st.lastMove >= 0) drawCircle(ACCENT.copy(alpha = 0.7f), unit * 0.7f, pos(st.lastMove % 128, w, h), style = Stroke(unit * 0.12f))
        if (anim) {
            val path = g.path(ma.from.board, st.lastMove / 128, st.lastMove % 128)
            val segs = path.size - 1
            val f = (ma.elapsed / CC_HOP).coerceIn(0f, segs.toFloat())
            val k = min(f.toInt(), segs - 1)
            val t = ease(f - k)
            val a = pos(path[k], w, h); val b = pos(path[k + 1], w, h)
            val lift = unit * 0.9f * sin(PI.toFloat() * t)
            glassStone(Offset(mix(a.x, b.x, t), mix(a.y, b.y, t) - lift), unit * 0.52f * (1f + 0.1f * sin(PI.toFloat() * t)), CC_COLORS[ma.from.turn])
        }
        if (legal.isNotEmpty()) {
            if (sel >= 0) {
                drawCircle(ACCENT, unit * 0.68f, pos(sel, w, h), style = Stroke(unit * 0.14f))
                for (m in legal) if (m / 128 == sel) {
                    val o = pos(m % 128, w, h)
                    drawCircle(Color(0xFF243754), unit * 0.42f, o)
                    drawCircle(Color.White, unit * 0.32f, o)
                }
            } else {
                for (i in legal.map { it / 128 }.toSet()) drawCircle(Color(0x99FFFDF8), unit * 0.62f, pos(i, w, h), style = Stroke(unit * 0.08f))
            }
        }
    }
}
