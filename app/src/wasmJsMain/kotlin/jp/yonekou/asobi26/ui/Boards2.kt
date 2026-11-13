package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Checkers
import jp.yonekou.asobi26.core.games.CheckersState
import jp.yonekou.asobi26.core.games.Gomoku
import jp.yonekou.asobi26.core.games.GomokuState
import jp.yonekou.asobi26.core.games.HareHounds
import jp.yonekou.asobi26.core.games.HareState
import jp.yonekou.asobi26.core.games.HexState
import jp.yonekou.asobi26.core.games.Morris
import jp.yonekou.asobi26.core.games.MorrisState
import jp.yonekou.asobi26.core.games.Yacht
import jp.yonekou.asobi26.core.games.YachtState
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

// =====================================================================
// 段階2の盤: 五目ならべ・ヘックス・ナインメンズモリス・ウサギと猟犬・チェッカー・ヨット
// どの盤も rememberMoveAnim(手が進んだら必ず描き直す・動きの間は待たせる)と効果音の合図を使う。
// =====================================================================

private fun lerpOffset(a: Offset, b: Offset, t: Float) = Offset(mix(a.x, b.x, t), mix(a.y, b.y, t))

private val GO_BLACK = Color(0xFF1C1E24)
private val GO_WHITE = Color(0xFFF5F2EA)

/** 置ける所・動かせる先の印(小さな明るい点) */
private fun DrawScope.hintDot(center: Offset, r: Float) {
    drawCircle(Color(0xB3FFFDF8), r, center)
    drawCircle(Color(0x40000000), r, center, style = Stroke(1.2f))
}

/** 選んでいるコマの輪(黄) */
internal fun DrawScope.selectRing(center: Offset, r: Float) {
    drawCircle(ACCENT, r, center, style = Stroke(r * 0.18f))
}

// =====================================================================
// 五目ならべ(15×15、碁石。1回目のタップで仮置き、同じ所をもう一度で決定)
// =====================================================================

@Composable
fun GomokuBoard(ses: Session<GomokuState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        if (t.lastMove >= 0) sfx?.play(Sound.GO)
    }) { _, t -> if (t.lastMove < 0) 0 else 240 }
    val st = ma.to
    val n = Gomoku.N
    var pending by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { pending = -1 }
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled && ma.done)
    val cells by rememberUpdatedState(st.cells)
    val turn = st.turn
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1f).testTag("board").pointerInput(ses) {
            detectTapGestures { p ->
                if (!canTap) return@detectTapGestures
                val m = size.width * 0.05f
                val step = (size.width - 2 * m) / (n - 1)
                val col = ((p.x - m) / step).roundToInt()
                val row = ((p.y - m) / step).roundToInt()
                if (col !in 0 until n || row !in 0 until n) return@detectTapGestures
                val i = row * n + col
                if (cells[i] != 0) return@detectTapGestures
                if (pending == i) { pending = -1; move(i) } else pending = i
            }
        },
    ) {
        val w = size.width
        val m = w * 0.05f
        val step = (w - 2 * m) / (n - 1)
        // 榧(かや)のような明るい木の盤
        val line = Color(0xFF3B2A14)
        cachedLayer("gomoku:$n") {
        drawRoundRect(KAYA_FLAT, cornerRadius = CornerRadius(w * 0.015f))
        kayaGrain(w)
        for (k in 0 until n) {
            val p = m + k * step
            drawLine(line, Offset(p, m), Offset(p, w - m), 1.4f)
            drawLine(line, Offset(m, p), Offset(w - m, p), 1.4f)
        }
        for ((x, y) in listOf(3 to 3, 3 to 11, 11 to 3, 11 to 11, 7 to 7)) drawCircle(line, step * 0.12f, Offset(m + x * step, m + y * step))
        }
        fun at(i: Int) = Offset(m + (i % n) * step, m + (i / n) * step)
        val r = step * 0.47f
        for (i in 0 until n * n) {
            val v = st.cells[i]
            if (v == 0) continue
            val sc = if (!ma.done && i == st.lastMove) popScale(ma.elapsed / 240f) else 1f
            if (v == 1) slateStone(at(i), r * sc) else shellStone(at(i), r * sc, stripeOf(i))
        }
        if (ma.done && st.winLine.isNotEmpty()) {
            for (i in st.winLine) drawCircle(ACCENT, r * 1.05f, at(i), style = Stroke(r * 0.22f))
            drawLine(ACCENT.copy(alpha = 0.85f), at(st.winLine.first()), at(st.winLine.last()), r * 0.25f, cap = StrokeCap.Round)
        } else if (ma.done && st.lastMove >= 0) {
            drawCircle(Color(0xFFE2553A), r * 0.22f, at(st.lastMove))
        }
        // 仮置き(半透明の石と黄色の輪)
        if (pending >= 0 && st.cells[pending] == 0) {
            stone(at(pending), r, if (turn == 0) GO_BLACK else GO_WHITE, shadow = false, alpha = 0.55f)
            selectRing(at(pending), r * 1.1f)
        }
    }
}

/**
 * 碁盤の木目(柾目): 縦にまっすぐ通る細い筋を、太さと濃さを少しずつ変えて並べる。
 * 波打つ線は不自然に見えたので使わない。位置は毎回同じ(乱数の種を固定)。
 */
private fun DrawScope.kayaGrain(w: Float) {
    // ごく淡い木目だけ(はっきりした木目は作りものらしく見えたので、無地に近くする)
    grain(Grain.STRAIGHT, Offset.Zero, Size(w, w), alpha = 0.18f)
}

/** 碁盤・将棋盤の色(明るく平らな木。参考: 一般的な将棋アプリの盤) */
val KAYA_FLAT = Color(0xFFF1D7A1)

// =====================================================================
// ヘックス(ひし形の盤。赤は上下、青は左右をつなぐ)
// =====================================================================

private val HEX_RED = Color(0xFFC8362E)
private val HEX_BLUE = Color(0xFF2F64C0)

@Composable
fun HexBoard(ses: Session<HexState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        if (t.lastMove >= 0) sfx?.play(Sound.WOOD, rate = 1.05f + (t.lastMove % 4) * 0.03f)
    }) { _, t -> if (t.lastMove < 0) 0 else 220 }
    val st = ma.to
    val n = st.n
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled && ma.done)
    val cells by rememberUpdatedState(st.cells)
    val s3 = sqrt(3f)
    val wUnits = (1.5f * n - 0.5f) * s3 + 1.2f
    val hUnits = 1.5f * (n - 1) + 2f + 1.2f
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(wUnits / hUnits).pointerInput(n) {
            detectTapGestures { p ->
                if (!canTap) return@detectTapGestures
                val geo = HexGeo(size.width.toFloat(), size.height.toFloat(), n)
                var best = -1
                var bd = Float.MAX_VALUE
                for (i in 0 until n * n) {
                    val c = geo.center(i)
                    val d = hypot(c.x - p.x, c.y - p.y)
                    if (d < bd) { bd = d; best = i }
                }
                if (best >= 0 && bd < geo.r && cells[best] == 0) move(best)
            }
        },
    ) {
        val geo = HexGeo(size.width, size.height, n)
        val r = geo.r
        // 辺の色(赤=上下、青=左右)
        for (i in 0 until n) {
            edge(geo.center(i), r, listOf(150, 210, 270, 330), HEX_RED)
            edge(geo.center((n - 1) * n + i), r, listOf(330, 30, 90, 150), HEX_RED)
            edge(geo.center(i * n), r, listOf(90, 150, 210), HEX_BLUE)
            edge(geo.center(i * n + n - 1), r, listOf(270, 330, 30), HEX_BLUE)
        }
        val win = st.winPath.toSet()
        for (i in 0 until n * n) {
            val c = geo.center(i)
            // かえでの六角のマス(下に濃い色をずらして厚みを出す)
            drawPath(hexPath(c + Offset(0f, r * 0.09f), r * 0.95f), Color(0xFF7A5A34))
            drawPath(hexPath(c, r * 0.95f), Brush.verticalGradient(listOf(Mat.mapleTop, Mat.mapleBottom), startY = c.y - r, endY = c.y + r))
            drawPath(hexPath(c, r * 0.95f), Color(0xFF8A6A3A), style = Stroke(1f))
            val v = st.cells[i]
            if (v != 0) {
                val col = if (v == 1) HEX_RED else HEX_BLUE
                val sc = if (!ma.done && i == st.lastMove) popScale(ma.elapsed / 220f) else 1f
                glassStone(c, r * 0.68f * sc, col)
                if (ma.done && i in win) drawCircle(ACCENT, r * 0.8f, c, style = Stroke(r * 0.16f))
            }
        }
        if (ma.done && st.lastMove >= 0 && win.isEmpty()) drawCircle(Color.White, r * 0.18f, geo.center(st.lastMove))
    }
}

private class HexGeo(w: Float, h: Float, val n: Int) {
    private val s3 = sqrt(3f)
    val r: Float = min(w / ((1.5f * n - 0.5f) * s3 + 1.2f), h / (1.5f * (n - 1) + 2f + 1.2f))
    private val ox = (w - ((1.5f * n - 0.5f) * s3) * r) / 2f
    private val oy = (h - (1.5f * (n - 1) + 2f) * r) / 2f
    fun center(i: Int): Offset {
        val row = i / n
        val col = i % n
        return Offset(ox + (col + row * 0.5f) * s3 * r + s3 * r / 2f, oy + row * 1.5f * r + r)
    }
}

private fun hexPath(c: Offset, r: Float): Path = Path().apply {
    for (k in 0 until 6) {
        val a = Math.toRadians((-90 + k * 60).toDouble())
        val x = c.x + r * cos(a).toFloat()
        val y = c.y + r * sin(a).toFloat()
        if (k == 0) moveTo(x, y) else lineTo(x, y)
    }
    close()
}

/** 六角形の外側の辺(角度の順につなぐ)を太い色の線で描く */
private fun DrawScope.edge(c: Offset, r: Float, angles: List<Int>, color: Color) {
    for (k in 0 until angles.size - 1) {
        val a = Math.toRadians(angles[k].toDouble())
        val b = Math.toRadians(angles[k + 1].toDouble())
        val rr = r * 1.08f
        drawLine(color, Offset(c.x + rr * cos(a).toFloat(), c.y + rr * sin(a).toFloat()), Offset(c.x + rr * cos(b).toFloat(), c.y + rr * sin(b).toFloat()), r * 0.28f, cap = StrokeCap.Round)
    }
}

// =====================================================================
// ナインメンズモリス(置く→動かす。ミルで相手のコマを取る)
// =====================================================================

/** 点の位置(7×7 の格子) */
internal val MORRIS_XY = arrayOf(
    0 to 0, 3 to 0, 6 to 0, 1 to 1, 3 to 1, 5 to 1, 2 to 2, 3 to 2, 4 to 2,
    0 to 3, 1 to 3, 2 to 3, 4 to 3, 5 to 3, 6 to 3, 2 to 4, 3 to 4, 4 to 4,
    1 to 5, 3 to 5, 5 to 5, 0 to 6, 3 to 6, 6 to 6,
)
private val MORRIS_WHITE = Color(0xFFF1E6CF)
private val MORRIS_BLACK = Color(0xFF3A2A1E)

@Composable
fun MorrisBoard(ses: Session<MorrisState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        val m = t.lastMove
        when {
            m >= 1000 -> sfx?.play(Sound.TAKE)
            m >= 100 -> { delay(230); sfx?.play(Sound.WOOD) }
            m >= 0 -> sfx?.play(Sound.WOOD)
        }
    }) { _, t -> if (t.lastMove < 0) 0 else 280 }
    val st = ma.to
    var sel by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { sel = -1 }
    val legal = if (enabled && ma.done) ses.rules.legalMoves(st).toList() else emptyList()
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1f).testTag("board").pointerInput(ses) {
            detectTapGestures { p ->
                val lg = legalNow
                if (lg.isEmpty()) return@detectTapGestures
                val cell = size.width * 0.86f / 6f
                val o = size.width * 0.07f
                var hit = -1
                for (i in 0 until 24) {
                    val (x, y) = MORRIS_XY[i]
                    if (hypot(o + x * cell - p.x, o + y * cell - p.y) < cell * 0.45f) { hit = i; break }
                }
                if (hit < 0) return@detectTapGestures
                when {
                    lg.any { it >= 1000 } -> if (1000 + hit in lg) move(1000 + hit)
                    lg.any { it < 100 } -> if (hit in lg) move(hit)
                    else -> {
                        val mv = 100 + sel * 24 + hit
                        if (sel >= 0 && mv in lg) { sel = -1; move(mv) } else if (lg.any { it in 100 until 1000 && (it - 100) / 24 == hit }) sel = hit else sel = -1
                    }
                }
            }
        },
    ) {
        val w = size.width
        val cell = w * 0.86f / 6f
        val o = w * 0.07f
        fun at(i: Int) = Offset(o + MORRIS_XY[i].first * cell, o + MORRIS_XY[i].second * cell)
        // 胡桃の板に真鍮の線をはめ込んだ盤
        woodPanel(Offset.Zero, size, w * 0.04f, Color(0xFF6B4528), Color(0xFF3E2414))
        val lw = w * 0.011f
        for (k in 0..2) {
            val a = o + k * cell
            val b = o + (6 - k) * cell
            brassRect(Offset(a, a), Offset(b, b), lw)
        }
        brassLine(Offset(o + 3 * cell, o), Offset(o + 3 * cell, o + 2 * cell), lw)
        brassLine(Offset(o + 3 * cell, o + 4 * cell), Offset(o + 3 * cell, o + 6 * cell), lw)
        brassLine(Offset(o, o + 3 * cell), Offset(o + 2 * cell, o + 3 * cell), lw)
        brassLine(Offset(o + 4 * cell, o + 3 * cell), Offset(o + 6 * cell, o + 3 * cell), lw)
        for (i in 0 until 24) brassHole(at(i), cell * 0.13f)
        val r = cell * 0.36f
        val mv = st.lastMove
        val moving = !ma.done && mv in 100 until 1000
        val from = if (moving) (mv - 100) / 24 else -1
        val to = if (moving) (mv - 100) % 24 else -1
        for (i in 0 until 24) {
            val v = st.board[i]
            if (v == 0 || i == to) continue
            val sc = if (!ma.done && mv == i) popScale(ma.elapsed / 220f) else 1f
            turnedPiece(at(i), r * sc, dark = v != 1)
        }
        // 取られたコマ(小さくなって消える)
        if (!ma.done && mv >= 1000) {
            val p = mv - 1000
            val v = ma.from.board[p]
            if (v != 0) turnedPiece(at(p), r * (1f - ease(ma.elapsed / 260f)), dark = v != 1, alpha = 1f - ease(ma.elapsed / 260f))
        }
        // 動いているコマ(持ち上げて滑らせる)
        if (moving) {
            val t = ease(ma.elapsed / 240f)
            val v = st.board[to]
            val pos = lerpOffset(at(from), at(to), t) + Offset(0f, -r * 0.4f * sin(PI.toFloat() * t))
            turnedPiece(pos, r * (1f + 0.08f * sin(PI.toFloat() * t)), dark = v != 1)
        }
        if (ma.done && mv >= 0) {
            val last = when { mv < 24 -> mv; mv in 100 until 1000 -> (mv - 100) % 24; mv >= 1000 -> mv - 1000; else -> -1 }
            if (last in 0 until 24) drawCircle(ACCENT, r * 1.18f, at(last), style = Stroke(r * .15f))
        }
        // ミルを作ったばかり: その並びを光らせる
        if (st.removing && ma.done) {
            val dest = when { mv in 0 until 100 -> mv; mv in 100 until 1000 -> (mv - 100) % 24; else -> -1 }
            if (dest >= 0) for (mill in Morris.MILLS) if (dest in mill && mill.all { st.board[it] == st.board[dest] }) {
                drawLine(ACCENT.copy(alpha = 0.85f), at(mill.first()), at(mill.last()), r * 0.35f, cap = StrokeCap.Round)
            }
        }
        // 操作の手がかり
        if (legal.isNotEmpty()) {
            when {
                legal.any { it >= 1000 } -> for (m in legal) if (m >= 1000) drawCircle(Color(0xFFE2553A), r * 1.12f, at(m - 1000), style = Stroke(r * 0.2f))
                legal.any { it < 100 } -> for (m in legal) if (m < 100) hintDot(at(m), cell * 0.12f)
                else -> {
                    val movable = legal.filter { it in 100 until 1000 }.map { (it - 100) / 24 }.toSet()
                    for (i in movable) if (i != sel) drawCircle(Color(0x99FFFDF8), r * 1.1f, at(i), style = Stroke(r * 0.12f))
                    if (sel >= 0) {
                        selectRing(at(sel), r * 1.15f)
                        for (m in legal) if (m in 100 until 1000 && (m - 100) / 24 == sel) hintDot(at((m - 100) % 24), cell * 0.13f)
                    }
                }
            }
        }
    }
}

// =====================================================================
// ウサギと猟犬(11点の盤。コマを選んでから行き先を選ぶ)
// =====================================================================

private val HARE_ROW = intArrayOf(1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1)

@Composable
fun HareBoard(ses: Session<HareState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        if (t.lastMove >= 0) { delay(230); sfx?.play(Sound.WOOD, rate = if (t.board[t.lastMove % 11] == HareHounds.HARE) 1.15f else 0.95f) }
    }) { _, t -> if (t.lastMove < 0) 0 else 280 }
    val st = ma.to
    var sel by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { sel = -1 }
    val legal = if (enabled && ma.done) ses.rules.legalMoves(st).toList() else emptyList()
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1.7f).pointerInput(ses) {
            detectTapGestures { p ->
                val lg = legalNow
                if (lg.isEmpty()) return@detectTapGestures
                val geo = HareGeo(size.width.toFloat(), size.height.toFloat())
                var hit = -1
                for (i in 0 until 11) if (hypot(geo.at(i).x - p.x, geo.at(i).y - p.y) < geo.step * 0.4f) { hit = i; break }
                if (hit < 0) return@detectTapGestures
                val mv = sel * 11 + hit
                if (sel >= 0 && mv in lg) { sel = -1; move(mv) } else if (lg.any { it / 11 == hit }) sel = hit else sel = -1
            }
        },
    ) {
        val geo = HareGeo(size.width, size.height)
        // 胡桃の板に真鍮の線をはめ込んだ盤
        woodPanel(Offset.Zero, size, size.height * 0.05f, Color(0xFF6B4528), Color(0xFF3E2414))
        for (a in 0 until 11) for (b in HareHounds.ADJ[a]) if (a < b) brassLine(geo.at(a), geo.at(b), size.height * 0.013f)
        for (i in 0 until 11) brassHole(geo.at(i), geo.step * 0.16f)
        val r = geo.step * 0.3f
        val mv = st.lastMove
        val moving = !ma.done && mv >= 0
        val from = if (moving) mv / 11 else -1
        val to = if (moving) mv % 11 else -1
        for (i in 0 until 11) {
            val v = st.board[i]
            if (v == 0 || i == to) continue
            animal(geo.at(i), r, v)
        }
        if (moving) {
            val t = ease(ma.elapsed / 240f)
            animal(lerpOffset(geo.at(from), geo.at(to), t) + Offset(0f, -r * 0.35f * sin(PI.toFloat() * t)), r, st.board[to])
        }
        if (ma.done && mv >= 0) drawCircle(ACCENT, r * 1.2f, geo.at(mv % 11), style = Stroke(r * .15f))
        if (legal.isNotEmpty()) {
            val movable = legal.map { it / 11 }.toSet()
            for (i in movable) if (i != sel) drawCircle(Color(0x99FFFDF8), r * 1.15f, geo.at(i), style = Stroke(r * 0.12f))
            if (sel >= 0) {
                selectRing(geo.at(sel), r * 1.2f)
                for (m in legal) if (m / 11 == sel) hintDot(geo.at(m % 11), geo.step * 0.11f)
            }
        }
    }
}

private class HareGeo(w: Float, h: Float) {
    val step = min(w * 0.84f / 4f, h * 0.78f / 2f)
    private val ox = (w - step * 4f) / 2f
    private val oy = (h - step * 2f) / 2f
    fun at(i: Int) = Offset(ox + HareHounds.X[i] * step, oy + HARE_ROW[i] * step)
}

/** 猟犬(黒檀の削り出しの駒)とウサギ(象牙色の大理石の駒。ウサギの形をうすく彫ってある) */
private fun DrawScope.animal(c: Offset, r: Float, kind: Int) {
    if (kind == HareHounds.HARE) ivoryPiece(c, r * 1.05f, engrave = true) else turnedPiece(c, r, dark = true)
}

// =====================================================================
// チェッカー(取れる時は必ず取る。連続して跳ぶ道筋を1手で動かす)
// =====================================================================

private val CK_BLACK = Color(0xFF2B2A2E)
private val CK_WHITE = Color(0xFFEFE3C8)
private const val CK_SEG = 200f

@Composable
fun CheckersBoard(ses: Session<CheckersState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        val path = t.lastPath
        for (k in 1 until path.size) {
            delay(CK_SEG.toLong() - 20)
            sfx?.play(Sound.WOOD, rate = 1f + k * 0.03f)
            if (abs(path[k - 1] / 8 - path[k] / 8) == 2) { delay(30); sfx?.play(Sound.TAKE, volume = 0.8f) }
        }
    }) { _, t -> if (t.lastPath.size < 2) 0 else ((t.lastPath.size - 1) * CK_SEG + 80).toInt() }
    val st = ma.to
    // 人が白(後手)なら、盤を回して自分のコマを手前にする
    val flip = ses.seats.getOrNull(1)?.human == true && ses.seats.getOrNull(0)?.human != true
    var sel by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { sel = -1 }
    val paths = if (enabled && ma.done) st.paths else emptyList()
    val move by rememberUpdatedState(onMove)
    val pathsNow by rememberUpdatedState(paths)
    val flipNow by rememberUpdatedState(flip)
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1f).testTag("board").pointerInput(ses) {
            detectTapGestures { p ->
                val ps = pathsNow
                if (ps.isEmpty()) return@detectTapGestures
                val m = size.width * 0.04f
                val cell = (size.width - 2 * m) / 8f
                var col = ((p.x - m) / cell).toInt()
                var row = ((p.y - m) / cell).toInt()
                if (col !in 0..7 || row !in 0..7) return@detectTapGestures
                if (flipNow) { col = 7 - col; row = 7 - row }
                val i = row * 8 + col
                val idx = if (sel >= 0) ps.indexOfFirst { it[0] == sel && it.last() == i } else -1
                if (idx >= 0) { sel = -1; move(idx) } else if (ps.any { it[0] == i }) sel = i else sel = -1
            }
        },
    ) {
        val w = size.width
        val m = w * 0.04f
        val cell = (w - 2 * m) / 8f
        fun at(i: Int): Offset {
            var col = i % 8
            var row = i / 8
            if (flip) { col = 7 - col; row = 7 - row }
            return Offset(m + (col + 0.5f) * cell, m + (row + 0.5f) * cell)
        }
        drawRoundRect(Color(0xFF312E2B), cornerRadius = CornerRadius(w * 0.02f))
        for (row in 0 until 8) for (col in 0 until 8) {
            val dark = (row + col) % 2 == 1
            drawRect(if (dark) Color(0xFF769656) else Color(0xFFEEEED2), Offset(m + col * cell, m + row * cell), Size(cell, cell))
        }
        val r = cell * 0.4f
        val path = st.lastPath
        val animating = !ma.done && path.size >= 2
        val mover = if (animating) path.last() else -1
        // 跳び越えられて取られたコマ(跳んだ時に消える)
        if (animating) {
            for (k in 1 until path.size) {
                val a = path[k - 1]
                val b = path[k]
                if (abs(a / 8 - b / 8) != 2) continue
                val mid = (a / 8 + b / 8) / 2 * 8 + (a % 8 + b % 8) / 2
                val v = ma.from.cells[mid]
                val gone = ((ma.elapsed - (k - 0.5f) * CK_SEG) / 120f).coerceIn(0f, 1f)
                if (v != 0 && gone < 1f) piece(at(mid), r, v, alpha = 1f - gone)
            }
        }
        for (i in 0 until 64) {
            val v = st.cells[i]
            if (v == 0 || i == mover) continue
            piece(at(i), r, v)
        }
        if (animating) {
            val segs = path.size - 1
            val f = (ma.elapsed / CK_SEG).coerceIn(0f, segs.toFloat())
            val k = min(f.toInt(), segs - 1)
            val t = ease(f - k)
            val a = at(path[k])
            val b = at(path[k + 1])
            val hop = if (abs(path[k] / 8 - path[k + 1] / 8) == 2) r * 0.7f else r * 0.25f
            // 途中まではキングになる前のコマで描く
            val v = if (f >= segs) st.cells[mover] else ma.from.cells[path[0]]
            piece(lerpOffset(a, b, t) + Offset(0f, -hop * sin(PI.toFloat() * t)), r * (1f + 0.06f * sin(PI.toFloat() * t)), v)
        } else if (ma.done && path.size >= 2) {
            drawCircle(Color(0x66FFC65C), r * 1.15f, at(path.last()), style = Stroke(r * 0.12f))
        }
        if (paths.isNotEmpty()) {
            val starts = paths.map { it[0] }.toSet()
            for (i in starts) if (i != sel) drawCircle(Color(0x99FFFDF8), r * 1.1f, at(i), style = Stroke(r * 0.12f))
            if (sel >= 0) {
                selectRing(at(sel), r * 1.15f)
                for (pth in paths) if (pth[0] == sel) {
                    hintDot(at(pth.last()), cell * 0.12f)
                    // 跳び越えて取れる相手のコマは赤い枠
                    for (k in 1 until pth.size) {
                        val a = pth[k - 1]; val b = pth[k]
                        if (abs(a / 8 - b / 8) == 2) captureFrame(at((a / 8 + b / 8) / 2 * 8 + (a % 8 + b % 8) / 2), cell)
                    }
                }
            }
        }
    }
}

/** チェッカーのコマ(縁の溝つき)。キングは金の冠 */
private fun DrawScope.piece(c: Offset, r: Float, v: Int, alpha: Float = 1f) {
    val base = if (Checkers.owner(v) == 0) CK_BLACK else CK_WHITE
    stone(c, r, base, alpha = alpha)
    drawCircle((if (Checkers.owner(v) == 0) Color.White else Color.Black).copy(alpha = 0.18f * alpha), r * 0.68f, c, style = Stroke(r * 0.08f))
    if (Checkers.isKing(v)) {
        val k = Path().apply {
            moveTo(c.x - r * 0.42f, c.y + r * 0.2f); lineTo(c.x - r * 0.48f, c.y - r * 0.28f); lineTo(c.x - r * 0.2f, c.y - r * 0.05f)
            lineTo(c.x, c.y - r * 0.42f); lineTo(c.x + r * 0.2f, c.y - r * 0.05f); lineTo(c.x + r * 0.48f, c.y - r * 0.28f)
            lineTo(c.x + r * 0.42f, c.y + r * 0.2f); close()
        }
        drawPath(k, ACCENT.copy(alpha = alpha))
        drawPath(k, Color(0xFF7A4A00).copy(alpha = alpha), style = Stroke(r * 0.06f))
    }
}

// =====================================================================
// ヨット(サイコロ5個と得点表。残すサイコロをタップしてから振る)
// =====================================================================

private const val DICE_MS = 650

@Composable
fun YachtBoard(
    ses: Session<YachtState>, version: Int, enabled: Boolean, tapSound: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit,
    fast: Boolean = false, onSkip: () -> Unit = {}, remoteSelection: Int? = null, onSelect: (Int) -> Unit = {},
) {
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val tap = rememberTap(tapSound)
    val me = viewSeat(ses)
    val fastNow by rememberUpdatedState(fast)
    // CPU の番は、どれを残して振り直したか・どこに書いたかが見えるように、長めに見せる(「とばす」で省ける)
    val ma = rememberMoveAnim(ses, onBusy, onStep = { f, t ->
        if (fastNow && f.turn != me) return@rememberMoveAnim
        if (t.rollCount > f.rollCount) sfx?.play(Sound.DICE) else if (t.lastScored >= 0) sfx?.play(Sound.PEN, volume = 0.8f)
    }) { f, t ->
        val cpu = f.turn != me
        when {
            cpu && fastNow -> 0
            t.rollCount > f.rollCount -> if (cpu) DICE_MS + 1100 else DICE_MS
            t.lastScored >= 0 -> if (cpu) 1400 else 260
            else -> 0
        }
    }
    val st = ma.to
    val lastMask = ses.moves.lastOrNull()?.takeIf { it < 100 } ?: 0
    // 残すサイコロ(人の番の間だけ自分で選ぶ。CPU の番は CPU が残したものを見せる)
    var held by remember(ses) { mutableIntStateOf(0) }
    LaunchedEffect(st.turn, st.rollsLeft) { if (st.rollsLeft == 3) held = 0 }
    val shownHeld = if (ses.seats.getOrNull(st.turn)?.human == true) held else if (ses.seats.getOrNull(st.turn)?.remote == true && remoteSelection != null) remoteSelection else if (st.rollsLeft < 3) lastMask else 0
    val canAct = enabled && ma.done
    val rolled = st.rollsLeft < 3
    val rolling = !ma.done && ma.to.rollCount > ma.from.rollCount
    val rollMask = if (rolling) (ses.moves.lastOrNull() ?: 0) else 0

    // 役の欄: 1回目のタップで仮に選び、同じ欄をもう一度タップで書き込む
    var pendingCat by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version) { pendingCat = -1 }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // ---- サイコロの皿(緑のフェルト) ----
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                .drawBehind { cachedLayer("yacht-wood") { drawRect(Brush.verticalGradient(listOf(Color(0xFF6A4022), Color(0xFF4A2A14)))); grain(Grain.FLAT, Offset.Zero, size, scale = 1.5f) } }
                .padding(8.dp).clip(RoundedCornerShape(10.dp))
                .drawBehind { cachedLayer("yacht-felt") { drawRect(safeRadial(listOf(Color(0xFF2E8A5A), Color(0xFF1A5E3B)), radius = 900f)); grain(Grain.FELT, Offset.Zero, size, scale = 2f) } }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                for (i in 0 until 5) {
                    val isHeld = (shownHeld ushr i) and 1 == 1
                    val tumbling = rolling && (st.rollsLeft == 2 || (rollMask ushr i) and 1 == 0)
                    val face = when {
                        !rolled && !rolling -> 0
                        tumbling -> ((ma.elapsed / 70f).toInt() * 7 + i * 3) % 6 + 1
                        else -> st.dice[i]
                    }
                    val wob = if (tumbling) sin(ma.elapsed / 40f + i) * 14f * (1f - ma.elapsed / DICE_MS) else 0f
                    Box(
                        Modifier.size(48.dp).clip(RoundedCornerShape(11.dp))
                            .testTag("yachtDie$i").semantics { selected = isHeld }.clickable(enabled = canAct && rolled, role = Role.Checkbox) { tap(); held = held xor (1 shl i); onSelect(held) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Canvas(Modifier.fillMaxSize().padding(if (isHeld) 2.dp else 5.dp)) {
                            rotate(wob) { dieFace(face, isHeld) }
                        }
                    }
                }
            }
            val humanTurn = ses.seats.getOrNull(st.turn)?.human == true && !st.over
            // CPU の番は操作の案内を出さず、何をしたかを書く
            val cpuName = if (ses.seats.getOrNull(st.turn)?.remote == true) ses.seats[st.turn].name else if (players2(ses) == 2) "CPU" else "CPU${st.turn + (if (st.turn > me) 0 else 1)}"
            val heldCount = Integer.bitCount(shownHeld)
            Text(if (st.over) "終了" else "${seatLabel(ses, st.turn)}・" + if (st.rollsLeft == 3) "初回の振り待ち(振り直し2回)" else "振り直し あと${st.rollsLeft}回", color = ACCENT, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(
                when {
                    st.over -> ""
                    humanTurn && !rolled -> "サイコロを振ってください"
                    humanTurn && pendingCat >= 0 -> "「${Yacht.NAMES[pendingCat]}」をもう一度タップで決定"
                    humanTurn && st.rollsLeft == 0 -> "書き込む欄を選んでください(2回タップで決定)"
                    humanTurn -> "残すサイコロをタップ(黄の枠)"
                    !rolled -> "${cpuName}の番"
                    st.rollsLeft == 2 -> "${cpuName}が振りました"
                    heldCount == 0 -> "${cpuName}が全部を振り直しました"
                    else -> "${cpuName}が${heldCount}個残して振り直しました(黄の枠)"
                },
                color = Color.White.copy(alpha = 0.9f), fontSize = 12.sp,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val canRoll = humanTurn && canAct && st.rollsLeft > 0 && (!rolled || held != 31)
                BigButton("振る／振り直す", Modifier.weight(1f), primary = true, enabled = canRoll) {
                    onMove(if (!rolled) 0 else held)
                }
                BigButton("CPUをとばす", Modifier.weight(1f), enabled = !humanTurn && !st.over && ses.seats.getOrNull(st.turn)?.remote != true && !fast) { tap(); onSkip() }
            }
        }
        // ---- 得点表(スクロールしないで全部入るように、行の高さを空きに合わせる) ----
        val players = ses.seats.size
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFFBF7EC)).padding(horizontal = 8.dp, vertical = 4.dp)) {
        val rowH = ((maxHeight - 10.dp) / (Yacht.CATS + 3)).coerceIn(16.dp, 30.dp)
        val fs = (rowH.value * 0.47f).coerceIn(10f, 14f).sp
        Column {
            val ink = Color(0xFF2B2118)
            Row(Modifier.fillMaxWidth().height(rowH), verticalAlignment = Alignment.CenterVertically) {
                Text("役", color = ink.copy(alpha = 0.6f), fontSize = 11.sp, modifier = Modifier.width(96.dp))
                for (p in 0 until players) {
                    val name = if (ses.seats[p].human) "あなた" else if (ses.seats[p].remote) ses.seats[p].name else if (players == 2) "CPU" else "CPU${p + (if (p > me) 0 else 1)}"
                    Text(
                        name, color = if (p == st.turn && !st.over) Color(0xFFB26A00) else ink, fontSize = 11.sp,
                        fontWeight = if (p == st.turn && !st.over) FontWeight.Black else FontWeight.Bold,
                        textAlign = TextAlign.Center, modifier = Modifier.weight(1f), maxLines = 1,
                    )
                }
            }
            for (cat in 0 until Yacht.CATS) {
                if (cat == 6) SheetSubtotal(st, players, ink, rowH)
                val mine = st.turn == me && canAct && rolled && st.sheets[me][cat] < 0
                val picked = mine && pendingCat == cat
                Row(
                    Modifier.fillMaxWidth().height(rowH).clip(RoundedCornerShape(8.dp))
                        .background(if (picked) Color(0x66FFC65C) else if (mine) Color(0x26FFC65C) else Color.Transparent)
                        .then(if (picked) Modifier.border(2.dp, Color(0xFFE09A1A), RoundedCornerShape(8.dp)) else Modifier)
                        .clickable(enabled = mine, role = Role.Button) { tap(); if (pendingCat == cat) { pendingCat = -1; onMove(100 + cat) } else pendingCat = cat },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(Yacht.NAMES[cat], color = ink, fontSize = fs, lineHeight = fs, fontWeight = if (picked) FontWeight.Black else FontWeight.Normal, modifier = Modifier.width(96.dp).padding(start = 4.dp), maxLines = 1)
                    for (p in 0 until players) {
                        val v = st.sheets[p][cat]
                        val justWrote = !ma.done && p == ma.from.turn && cat == st.lastScored
                        val text = when {
                            v >= 0 -> v.toString()
                            p == st.turn && rolled && ses.seats[p].human -> Yacht.score(cat, st.dice).toString()
                            else -> ""
                        }
                        val preview = v < 0
                        Box(
                            Modifier.weight(1f).height(rowH - 2.dp)
                                .then(if (justWrote || (ma.done && st.lastScored == cat && p == (st.turn + players - 1) % players && v >= 0)) Modifier.border(2.dp, ACCENT, RoundedCornerShape(6.dp)) else Modifier),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text, color = if (preview) Color(0xFFB26A00).copy(alpha = 0.75f) else ink, fontSize = fs, lineHeight = fs,
                                fontWeight = if (preview) FontWeight.Normal else FontWeight.Bold,
                            )
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth().height(rowH), verticalAlignment = Alignment.CenterVertically) {
                Text("合計", color = ink, fontSize = fs, fontWeight = FontWeight.Black, modifier = Modifier.width(96.dp).padding(start = 4.dp))
                for (p in 0 until players) Text(
                    st.total(p).toString(), color = ink, fontSize = fs, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center, modifier = Modifier.weight(1f),
                )
            }
        }
        }
    }
}

@Composable
private fun SheetSubtotal(st: YachtState, players: Int, ink: Color, rowH: androidx.compose.ui.unit.Dp) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 1.dp).height(rowH - 2.dp).background(Color(0x14000000), RoundedCornerShape(6.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("小計 / ボーナス", color = ink.copy(alpha = 0.75f), fontSize = 11.sp, lineHeight = 11.sp, modifier = Modifier.width(96.dp).padding(start = 4.dp), maxLines = 1)
        for (p in 0 until players) {
            val up = Yacht.upper(st.sheets[p])
            val b = Yacht.bonus(st.sheets[p])
            Text(
                if (b > 0) "$up +35" else "$up/63", color = if (b > 0) Color(0xFF2F8A55) else ink.copy(alpha = 0.7f), fontSize = 11.sp, lineHeight = 11.sp,
                textAlign = TextAlign.Center, modifier = Modifier.weight(1f), maxLines = 1,
            )
        }
    }
}

private fun players2(ses: Session<YachtState>) = ses.seats.size

/** サイコロの面(0 = まだ振っていない) */
private fun DrawScope.dieFace(face: Int, held: Boolean) {
    if (size.minDimension <= 2f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    val s = size.minDimension
    val rr = CornerRadius(s * 0.2f)
    drawRoundRect(Color(0x55000000), Offset(s * 0.03f, s * 0.07f), Size(s, s), rr)
    drawRoundRect(Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFE6E2D8))), size = Size(s, s), cornerRadius = rr)
    if (held) drawRoundRect(ACCENT, size = Size(s, s), cornerRadius = rr, style = Stroke(s * 0.07f))
    if (face == 0) {
        drawCircle(Color(0x33000000), s * 0.08f, Offset(s / 2, s / 2))
        return
    }
    val pip = s * 0.115f
    val q = s * 0.26f
    val cx = s / 2
    val cy = s / 2
    val spots = when (face) {
        1 -> listOf(0 to 0)
        2 -> listOf(-1 to -1, 1 to 1)
        3 -> listOf(-1 to -1, 0 to 0, 1 to 1)
        4 -> listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1)
        5 -> listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1)
        else -> listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1)
    }
    // 目は大きく、くぼみの影を付けて見やすくする
    for ((dx, dy) in spots) {
        val o = Offset(cx + dx * q, cy + dy * q)
        val pr = if (face == 1) pip * 1.6f else pip
        drawCircle(Color(0x33000000), pr * 1.12f, o + Offset(0f, pr * 0.12f))
        drawCircle(safeRadial(listOf(if (face == 1) Color(0xFFB0261A) else Color(0xFF05070B), if (face == 1) Color(0xFFE0483A) else Color(0xFF2A2F3C)), o, pr), pr, o)
    }
}


// =====================================================================
// ヨットの役の一覧(上の帯の「役」から開く)
// =====================================================================

/** 役の例の目(説明用) */
private val ROLE_EXAMPLES = listOf(
    intArrayOf(4, 4, 4, 1, 6), intArrayOf(6, 5, 4, 3, 2), intArrayOf(5, 5, 5, 5, 1), intArrayOf(5, 5, 5, 3, 3),
    intArrayOf(1, 2, 3, 4, 6), intArrayOf(2, 3, 4, 5, 6), intArrayOf(6, 6, 6, 6, 6),
)
/** 役の名前・作り方・点数・欄の番号(-1 = 1〜6の目のどれか) */
private class RoleRow(val name: String, val how: String, val points: String, val cat: Int)
private val ROLE_ROWS = listOf(
    RoleRow("1〜6の目", "その目をたくさんそろえる", "その目の合計(例: 4が3つで12点)", -1),
    RoleRow("チョイス", "どんな目でもよい", "5個の合計", 6),
    RoleRow("フォーダイス", "同じ目を4つ以上そろえる", "5個の合計", 7),
    RoleRow("フルハウス", "同じ目3つ+別の同じ目2つ", "5個の合計", 8),
    RoleRow("Sストレート", "4つ続きの目(1234など)", "15点", 9),
    RoleRow("Bストレート", "5つ続きの目(12345・23456)", "30点", 10),
    RoleRow("ヨット", "5つ全部同じ目", "50点", 11),
)

@Composable
fun YachtRoles(st: YachtState, onClose: () -> Unit) {
    val c = LocalAsobi.current
    val seat = st.turn.coerceAtLeast(0)
    val rolled = st.rollsLeft < 3
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)).background(c.surface).padding(horizontal = 14.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("役の一覧", color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            if (rolled) Text("右の数字 = いま書いた時の点(薄い数字は書いた点)", color = c.sub, fontSize = 11.sp)
        }
        Column(Modifier.padding(top = 6.dp)) {
            for ((k, row) in ROLE_ROWS.withIndex()) {
                val name = row.name
                val cat = row.cat
                val now = if (!rolled) null else if (cat < 0) (0 until 6).filter { st.sheets[seat][it] < 0 }.maxOfOrNull { Yacht.score(it, st.dice) } else if (st.sheets[seat][cat] < 0) Yacht.score(cat, st.dice) else null
                // もう書いた欄は、書いた点を薄い色で出す(まだ振っていない時は何も出さない)
                val done = if (cat >= 0 && st.sheets[seat][cat] >= 0) st.sheets[seat][cat] else null
                val good = now != null && now > 0 && cat >= 7
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (good) c.accent.copy(alpha = 0.16f) else Color.Transparent).padding(vertical = 7.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(name, color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(92.dp))
                    Canvas(Modifier.width(104.dp).height(19.dp)) {
                        val s = size.height
                        for ((i, f) in ROLE_EXAMPLES[k].withIndex()) {
                            translate(left = i * (s + 1.5f)) { dieFace(f, false) } // 高さ = 一辺(dieFace は高さで大きさを決める)
                        }
                    }
                    Column(Modifier.weight(1f).padding(start = 6.dp)) {
                        Text(row.how, color = c.ink, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold)
                        Text(row.points, color = c.sub, fontSize = 11.sp, lineHeight = 14.sp)
                    }
                    Text(now?.toString() ?: done?.toString() ?: "", color = if (good) c.accentInk else if (now == null) c.sub.copy(alpha = 0.6f) else c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(32.dp), textAlign = TextAlign.End)
                }
            }
            Text("1〜6の目の合計が63点以上で、ボーナス35点", color = c.sub, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp, start = 4.dp))
        }
        Box(
            Modifier.padding(top = 10.dp).fillMaxWidth().height(46.dp).clip(RoundedCornerShape(14.dp)).background(c.chip).clickable(role = Role.Button, onClick = onClose),
            contentAlignment = Alignment.Center,
        ) { Text("閉じる", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
    }
}
