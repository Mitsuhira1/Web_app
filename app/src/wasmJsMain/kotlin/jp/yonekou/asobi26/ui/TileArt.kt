package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.games.Chess
import jp.yonekou.asobi26.core.games.Shogi
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// =====================================================================
// 一覧のタイルの絵(0.5.8): 新しい盤・駒の絵を小さくしたもの。地は素材の色(木・フェルト・盤の色)。
// 100×100 の座標で、タイル全体(地を含む)を描く。角を丸めるのは呼ぶ側。
// =====================================================================

private val T_INK = Color(0xFF1D2433)
private val T_RED = Color(0xFFC8362E)
private val T_GREEN = Color(0xFF1F7A45)

private fun vg(a: Color, b: Color, y0: Float = 0f, y1: Float = 100f) = Brush.verticalGradient(listOf(a, b), startY = y0, endY = y1)
private val WALNUT = vg(Mat.walnutTop, Mat.walnutBottom)
private val FELT = vg(Mat.feltTop, Mat.feltBottom)
private val OAK = vg(Mat.oakTop, Mat.oakBottom)

/** 光の当たった玉(白い点 → 色 → 濃い色)と、下にずらした影 */
private fun DrawScope.ball(x: Float, y: Float, r: Float, light: Color, dark: Color, shadow: Float = 1.5f) {
    drawCircle(Color.Black.copy(alpha = 0.3f), r, Offset(x, y + shadow))
    drawCircle(safeRadial(listOf(light, dark), Offset(x - r * 0.35f, y - r * 0.4f), r * 1.6f), r, Offset(x, y))
}
private fun DrawScope.blackStone(x: Float, y: Float, r: Float) = ball(x, y, r, Color(0xFF8A8A90), Color(0xFF101014))
private fun DrawScope.whiteStone(x: Float, y: Float, r: Float) = ball(x, y, r, Color.White, Color(0xFFC9C4B6))
private fun DrawScope.redBall(x: Float, y: Float, r: Float) = ball(x, y, r, Color(0xFFFFB3A8), Color(0xFFA1261C))
private fun DrawScope.blueBall(x: Float, y: Float, r: Float) = ball(x, y, r, Color(0xFFA9C8F5), Color(0xFF1F4FA3))

private fun DrawScope.label(tm: TextMeasurer, text: String, cx: Float, cy: Float, fs: Float, color: Color, koma: Boolean = false, bold: Boolean = true) {
    val style = TextStyle(
        color = color, fontSize = (fs / density / fontScale).sp,
        fontFamily = if (koma) KomaFont else AppFont, fontWeight = if (koma) FontWeight.Normal else if (bold) FontWeight.Black else FontWeight.Bold,
    )
    val lay = tm.measure(text, style)
    drawText(lay, topLeft = Offset(cx - lay.size.width / 2f, cy - lay.size.height / 2f))
}

/** トランプ1枚(白い札・左上に数字・中央にマーク) */
private fun DrawScope.card(tm: TextMeasurer, x: Float, y: Float, w: Float, rank: String, suit: String, red: Boolean, rot: Float = 0f) {
    val h = w * 1.4f
    rotate(rot, Offset(x + w / 2, y + h * 0.7f)) {
        drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, y + 2f), Size(w, h), CornerRadius(3f))
        drawRoundRect(Color(0xFFFFFDF7), Offset(x, y), Size(w, h), CornerRadius(3f))
        drawRoundRect(Color(0x33000000), Offset(x, y), Size(w, h), CornerRadius(3f), style = Stroke(0.6f))
        val ink = if (red) T_RED else T_INK
        label(tm, rank, x + w * 0.25f, y + w * 0.3f, w * 0.4f, ink)
        label(tm, suit, x + w / 2, y + h * 0.62f, w * 0.62f, ink, bold = false)
    }
}

/** 裏向きのトランプ(濃い赤の裏) */
private fun DrawScope.cardBack(x: Float, y: Float, w: Float, h: Float, rot: Float = 0f) {
    rotate(rot, Offset(x + w / 2, y + h / 2)) {
        drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, y + 1.5f), Size(w, h), CornerRadius(2.5f))
        drawRoundRect(Color(0xFFFFFDF7), Offset(x, y), Size(w, h), CornerRadius(2.5f))
        drawRoundRect(Color(0xFF8E2F3C), Offset(x + 1.5f, y + 1.5f), Size(w - 3f, h - 3f), CornerRadius(1.5f))
    }
}

private fun DrawScope.ivoryTile(tm: TextMeasurer, x: Float, y: Float, w: Float, h: Float, text: String, color: Color, fs: Float) {
    drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, y + h * 0.12f + 1f), Size(w, h), CornerRadius(3f))
    drawRoundRect(Mat.tileBack, Offset(x, y + h * 0.1f), Size(w, h), CornerRadius(3f))
    drawRoundRect(vg(Mat.ivoryTop, Mat.ivoryBottom, y, y + h), Offset(x, y), Size(w, h), CornerRadius(3f))
    drawRoundRect(Mat.ivoryEdge, Offset(x, y), Size(w, h), CornerRadius(3f), style = Stroke(0.6f))
    label(tm, text, x + w / 2, y + h * 0.52f, fs, color, koma = true)
}

private fun DrawScope.die(x: Float, y: Float, s: Float, n: Int, rot: Float = 0f) {
    val cx = x + s / 2
    val cy = y + s / 2
    val pos = when (n) {
        1 -> listOf(0 to 0)
        2 -> listOf(-1 to -1, 1 to 1)
        3 -> listOf(-1 to -1, 0 to 0, 1 to 1)
        4 -> listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1)
        5 -> listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1)
        else -> listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1)
    }
    rotate(rot, Offset(cx, cy)) {
        drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, y + 2f), Size(s, s), CornerRadius(s * 0.2f))
        drawRoundRect(vg(Mat.ivoryTop, Mat.ivoryBottom, y, y + s), Offset(x, y), Size(s, s), CornerRadius(s * 0.2f))
        drawRoundRect(Mat.ivoryEdge, Offset(x, y), Size(s, s), CornerRadius(s * 0.2f), style = Stroke(0.6f))
        for ((dx, dy) in pos) drawCircle(if (n == 1) T_RED else Color(0xFF22283A), s * (if (n == 1) 0.14f else 0.09f), Offset(cx + dx * s * 0.26f, cy + dy * s * 0.26f))
    }
}

private fun hexPath(x: Float, y: Float, r: Float): Path = Path().apply {
    for (k in 0 until 6) {
        val a = (k * 60 - 90) * PI / 180
        val px = x + r * cos(a).toFloat()
        val py = y + r * sin(a).toFloat()
        if (k == 0) moveTo(px, py) else lineTo(px, py)
    }
    close()
}

/** タイル全体を描く(100×100) */
fun DrawScope.drawTile(id: String, tm: TextMeasurer) {
    when (id) {
        "reversi" -> {
            drawRect(WALNUT, size = Size(100f, 100f))
            drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(14f, 16f), Size(72f, 72f), CornerRadius(4f))
            drawRoundRect(FELT, Offset(14f, 14f), Size(72f, 72f), CornerRadius(4f))
            for (i in 1..3) {
                drawLine(Color(0xFF12301F), Offset(14f + i * 18, 14f), Offset(14f + i * 18, 86f), 1f)
                drawLine(Color(0xFF12301F), Offset(14f, 14f + i * 18), Offset(86f, 14f + i * 18), 1f)
            }
            whiteStone(41f, 41f, 7.5f); blackStone(59f, 41f, 7.5f); blackStone(41f, 59f, 7.5f); whiteStone(59f, 59f, 7.5f)
        }
        "chess" -> {
            drawRect(Color(0xFF739552), size = Size(100f, 100f))
            drawRect(Color(0xFFEBECD0), Offset.Zero, Size(50f, 50f))
            drawRect(Color(0xFFEBECD0), Offset(50f, 50f), Size(50f, 50f))
            // キングの駒(ユーザーの指示)
            chessPiece(Offset(50f, 52f), 90f, Chess.K, white = true)
        }
        "shogi" -> {
            drawRect(Color(0xFFE9C98A), size = Size(100f, 100f))
            drawLine(Color(0xFF4A3520), Offset(0f, 50f), Offset(100f, 50f), 1f)
            drawLine(Color(0xFF4A3520), Offset(50f, 0f), Offset(50f, 100f), 1f)
            // 一覧の絵は正しい向き(逆さにしない)で「王将」
            komaPiece(tm, Offset(50f, 50f), 52f, Shogi.K, upside = false, label = "王将")
        }
        "gogo" -> {
            drawRect(Color(0xFFE9C98A), size = Size(100f, 100f))
            val c0 = 12f; val step = 15.2f
            for (k in 0..5) {
                drawLine(Color(0xFF4A3520), Offset(c0 + k * step, c0), Offset(c0 + k * step, c0 + 5 * step), if (k == 0 || k == 5) 1.6f else 0.9f)
                drawLine(Color(0xFF4A3520), Offset(c0, c0 + k * step), Offset(c0 + 5 * step, c0 + k * step), if (k == 0 || k == 5) 1.6f else 0.9f)
            }
            fun at(i: Int) = c0 + (i + 0.5f) * step
            komaPiece(tm, Offset(at(2), at(4)), 14f, Shogi.K, upside = false)
            komaPiece(tm, Offset(at(2), at(0)), 14f, Shogi.K, upside = true)
            komaPiece(tm, Offset(at(1), at(3)), 13f, Shogi.G, upside = false)
            komaPiece(tm, Offset(at(3), at(1)), 13f, Shogi.S, upside = true)
        }
        "go" -> {
            drawRect(Color(0xFFE3C078), size = Size(100f, 100f))
            for (i in 1..3) {
                drawLine(Color(0xFF3A2A14), Offset(i * 25f, 0f), Offset(i * 25f, 100f), 1f)
                drawLine(Color(0xFF3A2A14), Offset(0f, i * 25f), Offset(100f, i * 25f), 1f)
            }
            blackStone(50f, 50f, 10f); whiteStone(75f, 50f, 10f); whiteStone(50f, 25f, 10f); blackStone(25f, 75f, 10f)
        }
        "gomoku" -> {
            drawRect(Color(0xFFE3C078), size = Size(100f, 100f))
            for (i in 0..5) {
                drawLine(Color(0xFF3A2A14), Offset(10f + i * 16, 0f), Offset(10f + i * 16, 100f), 0.9f)
                drawLine(Color(0xFF3A2A14), Offset(0f, 10f + i * 16), Offset(100f, 10f + i * 16), 0.9f)
            }
            for (k in 0..4) blackStone(10f + (k + 1) * 16, 90f - (k + 1) * 16 + 16f, 6.4f)
            for ((x, y) in listOf(42f to 42f, 58f to 74f, 42f to 58f, 26f to 42f)) whiteStone(x, y, 6.4f)
        }
        "connect4" -> {
            drawRect(Color(0xFFCDBB98), size = Size(100f, 100f))
            drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(12f, 18f), Size(76f, 64f), CornerRadius(6f))
            drawRoundRect(vg(Color(0xFF3567B8), Color(0xFF244C8E)), Offset(12f, 15f), Size(76f, 64f), CornerRadius(6f))
            drawRoundRect(Mat.walnutBottom, Offset(6f, 78f), Size(88f, 8f), CornerRadius(2f))
            val grid = listOf("..R.", ".RY.", "RYRY")
            grid.forEachIndexed { j, row ->
                row.forEachIndexed { i, ch ->
                    val x = 24f + i * 17.3f; val y = 30f + j * 17f
                    when (ch) {
                        'R' -> ball(x, y, 6.6f, Color(0xFFFFB3A8), Color(0xFFC8362E), 0f)
                        'Y' -> ball(x, y, 6.6f, Color(0xFFFFF0B0), Color(0xFFE0A21A), 0f)
                        else -> drawCircle(Color(0xFF1A2F55), 6.6f, Offset(x, y))
                    }
                }
            }
        }
        "checkers" -> {
            drawRect(WALNUT, size = Size(100f, 100f))
            for (j in 0 until 4) for (i in 0 until 4) drawRect(if ((i + j) % 2 == 1) Color(0xFF739552) else Color(0xFFEBECD0), Offset(12f + i * 19, 12f + j * 19), Size(19f, 19f))
            for ((p, red) in listOf((40.5f to 21.5f) to false, (78.5f to 21.5f) to false, (21.5f to 78.5f) to true, (59.5f to 78.5f) to true, (59.5f to 40.5f) to true)) {
                if (red) ball(p.first, p.second, 7.5f, Color(0xFFFFB3A8), Color(0xFFA1261C)) else blackStone(p.first, p.second, 7.5f)
                drawCircle(Color.White.copy(alpha = 0.35f), 4.5f, Offset(p.first, p.second), style = Stroke(0.8f))
            }
        }
        "mancala" -> {
            drawRect(Color(0xFFCDBB98), size = Size(100f, 100f))
            drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(6f, 31f), Size(88f, 44f), CornerRadius(14f))
            drawRoundRect(vg(Mat.walnutTop, Mat.walnutBottom, 28f, 72f), Offset(6f, 28f), Size(88f, 44f), CornerRadius(14f))
            for (i in 0..3) for (y in listOf(41f, 59f)) {
                val c = Offset(26f + i * 16, y)
                drawCircle(safeRadial(listOf(Color(0xFF1E120A), Color(0xFF4A2E1A)), c, 6f), 6f, c)
            }
            drawRoundRect(Color(0xFF2E1C10), Offset(9f, 33f), Size(9f, 34f), CornerRadius(4.5f))
            drawRoundRect(Color(0xFF2E1C10), Offset(82f, 33f), Size(9f, 34f), CornerRadius(4.5f))
            redBall(26f, 40f, 3f); blueBall(43f, 58f, 3f); whiteStone(58f, 41f, 3f); redBall(74f, 59f, 3f); blueBall(29f, 43f, 2.6f)
        }
        "dots" -> {
            drawRect(vg(Mat.ivoryTop, Mat.ivoryBottom), size = Size(100f, 100f))
            drawRect(T_RED.copy(alpha = 0.25f), Offset(20f, 20f), Size(30f, 30f))
            drawRect(Color(0xFF3F78C4).copy(alpha = 0.25f), Offset(50f, 50f), Size(30f, 30f))
            fun ln(a: Offset, b: Offset, c: Color) = drawLine(c, a, b, 3.4f, cap = StrokeCap.Round)
            ln(Offset(20f, 20f), Offset(50f, 20f), T_RED); ln(Offset(20f, 20f), Offset(20f, 50f), T_RED); ln(Offset(20f, 50f), Offset(50f, 50f), T_RED); ln(Offset(50f, 20f), Offset(50f, 50f), T_RED)
            ln(Offset(50f, 50f), Offset(80f, 50f), Color(0xFF3F78C4)); ln(Offset(80f, 50f), Offset(80f, 80f), Color(0xFF3F78C4)); ln(Offset(50f, 80f), Offset(80f, 80f), Color(0xFF3F78C4)); ln(Offset(50f, 50f), Offset(50f, 80f), Color(0xFF3F78C4))
            ln(Offset(80f, 20f), Offset(80f, 50f), Color(0xFF8A7E6A))
            for (x in listOf(20f, 50f, 80f)) for (y in listOf(20f, 50f, 80f)) drawCircle(T_INK, 3.6f, Offset(x, y))
        }
        "hitblow" -> {
            drawRect(WALNUT, size = Size(100f, 100f))
            "371".forEachIndexed { i, d ->
                val x = 12f + i * 22f
                drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, 22f), Size(18f, 26f), CornerRadius(3f))
                drawRoundRect(vg(Mat.ivoryTop, Mat.ivoryBottom, 20f, 46f), Offset(x, 20f), Size(18f, 26f), CornerRadius(3f))
                label(tm, d.toString(), x + 9f, 33.5f, 17f, T_INK)
            }
            drawRoundRect(Color(0xFF2E1C10), Offset(14f, 58f), Size(72f, 26f), CornerRadius(6f))
            redBall(28f, 71f, 6f); whiteStone(44f, 71f, 6f); whiteStone(60f, 71f, 6f)
            drawCircle(Color(0xFF1A0F08), 6f, Offset(76f, 71f))
        }
        "morris" -> {
            drawRect(OAK, size = Size(100f, 100f))
            val ink = Color(0xFF3A2414)
            for (a in listOf(12f, 26f, 40f)) drawRect(ink, Offset(a, a), Size(100 - 2 * a, 100 - 2 * a), style = Stroke(2f))
            drawLine(ink, Offset(50f, 12f), Offset(50f, 40f), 2f); drawLine(ink, Offset(50f, 60f), Offset(50f, 88f), 2f)
            drawLine(ink, Offset(12f, 50f), Offset(40f, 50f), 2f); drawLine(ink, Offset(60f, 50f), Offset(88f, 50f), 2f)
            for ((x, y) in listOf(12f to 12f, 50f to 12f, 88f to 12f)) blackStone(x, y, 7f)
            for ((x, y) in listOf(26f to 74f, 60f to 50f, 88f to 88f)) whiteStone(x, y, 7f)
        }
        "hare" -> {
            drawRect(OAK, size = Size(100f, 100f))
            val c = Color(0xFF3A2414)
            val pts = listOf((30f to 28f) to (70f to 28f), (12f to 50f) to (88f to 50f), (30f to 72f) to (70f to 72f),
                (30f to 28f) to (30f to 72f), (50f to 28f) to (50f to 72f), (70f to 28f) to (70f to 72f),
                (12f to 50f) to (30f to 28f), (12f to 50f) to (30f to 72f), (88f to 50f) to (70f to 28f), (88f to 50f) to (70f to 72f),
                (30f to 28f) to (70f to 72f), (30f to 72f) to (70f to 28f))
            for ((a, b) in pts) drawLine(c, Offset(a.first, a.second), Offset(b.first, b.second), 1.6f)
            for ((x, y) in listOf(12f to 50f, 30f to 28f, 30f to 72f)) turnedPiece(Offset(x, y), 7.5f, dark = true)
            ivoryPiece(Offset(70f, 50f), 8f, engrave = true)
        }
        "yacht" -> {
            drawRect(FELT, size = Size(100f, 100f))
            drawRoundRect(Color(0xFF1A4732), Offset(8f, 8f), Size(84f, 84f), CornerRadius(10f), style = Stroke(1.5f))
            die(14f, 18f, 34f, 5, -10f); die(52f, 46f, 32f, 3, 12f); die(52f, 12f, 24f, 6, 6f)
        }
        "hex" -> {
            drawRect(OAK, size = Size(100f, 100f))
            for ((x, y) in listOf(35f to 34f, 57f to 34f, 46f to 53f, 68f to 53f, 24f to 53f, 35f to 72f, 57f to 72f)) {
                drawPath(hexPath(x, y + 1.5f, 12f), Color(0xFF7A5A34))
                drawPath(hexPath(x, y, 12f), vg(Mat.mapleTop, Mat.mapleBottom, y - 12f, y + 12f))
                drawPath(hexPath(x, y, 12f), Color(0xFF7A5A34), style = Stroke(0.8f))
            }
            redBall(46f, 52f, 7f); blueBall(57f, 33f, 7f)
        }
        "chinese" -> {
            drawRect(Color(0xFF5A3A22), size = Size(100f, 100f))
            drawCircle(Color.Black.copy(alpha = 0.3f), 46f, Offset(50f, 52f))
            drawCircle(OAK, 46f, Offset(50f, 50f))
            // 星形と穴は、盤と同じ座標(立方体座標 q, r)から計算して、ずれないようにする
            val u = 3.25f
            val s3 = 1.7320508f
            fun at(q: Int, r: Int) = Offset(50f + u * s3 * (q + r / 2f), 50f + u * 1.5f * r)
            fun tri(a: Pair<Int, Int>, b: Pair<Int, Int>, c: Pair<Int, Int>) {
                val pts = listOf(a, b, c).map { at(it.first, it.second) }.map { Offset(50f, 50f) + (it - Offset(50f, 50f)) * 1.1f }
                drawPath(Path().apply { moveTo(pts[0].x, pts[0].y); lineTo(pts[1].x, pts[1].y); lineTo(pts[2].x, pts[2].y); close() }, Color(0x2E000000))
            }
            tri(-4 to 8, -4 to -4, 8 to -4)
            tri(4 to -8, 4 to 4, -8 to 4)
            for (p in jp.yonekou.asobi26.core.games.ChineseCheckers.POINTS) drawCircle(Color(0xFF3A2414), u * 0.55f, at(p[0], p[1]))
            // 上の陣地に青、下の陣地に赤の玉
            for (p in jp.yonekou.asobi26.core.games.ChineseCheckers.POINTS) {
                val (q, r) = p[0] to p[1]
                if (r <= -5) blueBall(at(q, r).x, at(q, r).y, u * 0.8f)
                if (r >= 5) redBall(at(q, r).x, at(q, r).y, u * 0.8f)
            }
        }
        "ludo" -> {
            drawRect(vg(Color(0xFFF6EFDD), Color(0xFFEDE3CB)), size = Size(100f, 100f))
            for ((p, col) in listOf((8f to 8f) to Color(0xFF3E9B63), (56f to 8f) to Color(0xFFE0AE36), (8f to 56f) to Color(0xFFC8463C), (56f to 56f) to Color(0xFF3F78C4))) {
                drawRoundRect(col, Offset(p.first, p.second), Size(36f, 36f), CornerRadius(6f))
                drawRoundRect(Color(0xFFF6EFDD), Offset(p.first + 7f, p.second + 7f), Size(22f, 22f), CornerRadius(4f))
                ball(p.first + 18f, p.second + 18f, 5f, lerpWhite(col), col)
            }
            die(40f, 40f, 20f, 3)
        }
        "backgammon" -> {
            drawRect(WALNUT, size = Size(100f, 100f))
            drawRect(FELT, Offset(10f, 12f), Size(80f, 76f))
            for (i in 0..3) {
                val x = 14f + i * 19
                drawPath(Path().apply { moveTo(x, 12f); lineTo(x + 16f, 12f); lineTo(x + 8f, 48f); close() }, if (i % 2 == 1) Color(0xFFE6D3A8) else Color(0xFF8A3B2A))
                drawPath(Path().apply { moveTo(x, 88f); lineTo(x + 16f, 88f); lineTo(x + 8f, 52f); close() }, if (i % 2 == 1) Color(0xFF8A3B2A) else Color(0xFFE6D3A8))
            }
            whiteStone(22f, 22f, 7f); blackStone(22f, 78f, 7f); whiteStone(79f, 78f, 7f)
        }
        "life" -> {
            // ルーレット+下にお札の束と家(お金持ちを目指すのが分かるように)
            drawRect(vg(Color(0xFF9AD67C), Color(0xFF7DC060)), size = Size(100f, 100f))
            val wc = Offset(50f, 36f)
            drawCircle(Color.White, 30f, wc)
            drawCircle(Color(0xFF4A3520), 30f, wc, style = Stroke(2f))
            val cols = listOf(0xFFE2574C, 0xFFF2A541, 0xFFF4D35E, 0xFF7CC576, 0xFF3FA7B5, 0xFF4A7FD0, 0xFF7A4CC2, 0xFFC24C9A)
            for (i in 0 until 8) drawArc(Color(cols[i]), i * 45f - 90f, 45f, true, Offset(24f, 10f), Size(52f, 52f))
            drawCircle(Color.White, 8f, wc); drawCircle(Color(0xFF4A3520), 8f, wc, style = Stroke(2f))
            for (k in 0 until 3) {
                val tl = Offset(8f + k * 2f, 78f - k * 4f)
                drawRoundRect(Color(0xFF6BAA5A), tl, Size(40f, 16f), CornerRadius(2f))
                drawRoundRect(Color(0xFFE8F5D8), tl, Size(40f, 16f), CornerRadius(2f), style = Stroke(1.2f))
            }
            drawCircle(Color(0xFFE8F5D8), 5f, Offset(30f, 78f))
            drawPath(Path().apply { moveTo(58f, 80f); lineTo(75f, 66f); lineTo(92f, 80f); close() }, Color(0xFFC8362E))
            drawRect(Color.White, Offset(61f, 80f), Size(28f, 15f))
            drawRect(Color(0xFF4A3520), Offset(61f, 80f), Size(28f, 15f), style = Stroke(1f))
            drawRect(Color(0xFF7A4A28), Offset(72f, 85f), Size(7f, 10f))
        }
        "mahjong" -> {
            drawRect(FELT, size = Size(100f, 100f))
            listOf("東" to T_INK, "發" to T_GREEN, "中" to T_RED).forEachIndexed { i, (t, col) -> ivoryTile(tm, 14f + i * 25f, 27f, 22f, 42f, t, col, 19f) }
        }
        "hanafuda" -> {
            drawRect(FELT, size = Size(100f, 100f))
            rotate(-8f, Offset(38f, 50f)) {
                drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(20f, 22f), Size(36f, 58f), CornerRadius(3f))
                drawRoundRect(Color(0xFF15151A), Offset(20f, 20f), Size(36f, 58f), CornerRadius(3f))
                drawRect(Color(0xFFC8362E), Offset(22f, 22f), Size(32f, 54f))
                drawCircle(Color.White, 11f, Offset(38f, 40f))
                drawPath(Path().apply { moveTo(22f, 76f); lineTo(22f, 62f); quadraticBezierTo(38f, 50f, 54f, 62f); lineTo(54f, 76f); close() }, Color(0xFF1C1C22))
            }
            rotate(8f, Offset(64f, 52f)) {
                drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(46f, 26f), Size(36f, 58f), CornerRadius(3f))
                drawRoundRect(Color(0xFF15151A), Offset(46f, 24f), Size(36f, 58f), CornerRadius(3f))
                drawRect(Color(0xFFF4EAD0), Offset(48f, 26f), Size(32f, 54f))
                for ((x, y) in listOf(58f to 38f, 70f to 34f, 66f to 46f)) drawCircle(Color(0xFFF29BB5), 6f, Offset(x, y))
                drawRect(Color(0xFFC8362E), Offset(48f, 56f), Size(32f, 24f))
                for (k in 0..2) drawRect(Color.White, Offset(52f + k * 9f, 62f), Size(6f, 12f))
            }
        }
        "poker" -> {
            drawRect(FELT, size = Size(100f, 100f))
            card(tm, 18f, 24f, 30f, "A", "♠", false, -10f)
            card(tm, 50f, 26f, 30f, "K", "♥", true, 8f)
        }
        "holdem" -> {
            drawRect(Color(0xFF22262F), size = Size(100f, 100f))
            drawOval(Color.Black.copy(alpha = 0.35f), Offset(6f, 21f), Size(88f, 68f))
            drawOval(WALNUT, Offset(6f, 18f), Size(88f, 68f))
            drawOval(FELT, Offset(12f, 24f), Size(76f, 56f))
            card(tm, 30f, 34f, 18f, "A", "♥", true)
            card(tm, 52f, 34f, 18f, "A", "♠", false)
            for (y in listOf(74f, 71f)) {
                drawOval(Color(0xFFC8362E), Offset(42f, y - 3.4f), Size(16f, 6.8f))
                drawOval(Color.White, Offset(42f, y - 3.4f), Size(16f, 6.8f), style = Stroke(1f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 2f))))
            }
        }
        "daifugo" -> {
            drawRect(FELT, size = Size(100f, 100f))
            card(tm, 12f, 30f, 26f, "2", "♠", false, -12f)
            card(tm, 37f, 26f, 26f, "A", "♦", true)
            card(tm, 62f, 30f, 26f, "K", "♣", false, 12f)
        }
        "sevens" -> {
            drawRect(FELT, size = Size(100f, 100f))
            card(tm, 8f, 34f, 24f, "6", "♥", true)
            card(tm, 68f, 34f, 24f, "8", "♥", true)
            card(tm, 36f, 26f, 28f, "7", "♥", true)
            drawRoundRect(ACCENT, Offset(36f, 26f), Size(28f, 39.2f), CornerRadius(3f), style = Stroke(2f))
        }
        "speed" -> {
            drawRect(FELT, size = Size(100f, 100f))
            card(tm, 10f, 30f, 28f, "5", "♣", false, -12f)
            card(tm, 62f, 30f, 28f, "6", "♦", true, 12f)
            card(tm, 36f, 22f, 28f, "7", "♠", false)
        }
        "memory" -> {
            drawRect(FELT, size = Size(100f, 100f))
            for ((j, y) in listOf(14f, 54f).withIndex()) for ((i, x) in listOf(12f, 40f, 68f).withIndex()) {
                if ((i == 0 && j == 0) || (i == 2 && j == 1)) card(tm, x, y, 22f, "Q", "♥", true)
                else cardBack(x, y, 22f, 30.8f)
            }
        }
        "blackjack" -> {
            drawRect(FELT, size = Size(100f, 100f))
            card(tm, 14f, 18f, 30f, "A", "♠", false, -10f)
            card(tm, 42f, 22f, 30f, "K", "♥", true, 8f)
            for (y in listOf(84f, 80f, 76f)) {
                drawOval(Color(0xFF2F5FA8), Offset(66f, y - 4f), Size(22f, 8f))
                drawOval(Color.White, Offset(66f, y - 4f), Size(22f, 8f), style = Stroke(1f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.4f, 2.4f))))
            }
        }
        "uno" -> {
            drawRect(FELT, size = Size(100f, 100f))
            for ((p, col, t) in listOf(Triple(18f to 22f, Color(0xFF2F6FD0), "7"), Triple(46f to 26f, Color(0xFFE0453A), "+2"))) {
                val (x, y) = p
                val rot = if (t == "7") -10f else 10f
                rotate(rot, Offset(x + 18f, y + 27f)) {
                    drawRoundRect(Color.Black.copy(alpha = 0.3f), Offset(x, y + 2f), Size(36f, 54f), CornerRadius(5f))
                    drawRoundRect(Color.White, Offset(x, y), Size(36f, 54f), CornerRadius(5f))
                    drawRoundRect(col, Offset(x + 3f, y + 3f), Size(30f, 48f), CornerRadius(3f))
                    drawPath(Path().apply { moveTo(x + 18f, y + 15f); lineTo(x + 28f, y + 27f); lineTo(x + 18f, y + 39f); lineTo(x + 8f, y + 27f); close() }, Color.White)
                    label(tm, t, x + 18f, y + 27f, if (t.length > 1) 12f else 15f, col)
                }
            }
        }
        "solitaire" -> {
            drawRect(FELT, size = Size(100f, 100f))
            val tops = listOf(Triple("K", "♠", false), Triple("Q", "♥", true), Triple("J", "♣", false))
            for ((k, x) in listOf(10f, 39f, 68f).withIndex()) {
                for (i in 0..k) cardBack(x, 12f + i * 8f, 22f, 30.8f)
                card(tm, x, 22f + k * 8f + 8f, 22f, tops[k].first, tops[k].second, tops[k].third)
            }
        }
        else -> {
            drawRect(WALNUT, size = Size(100f, 100f))
            label(tm, "?", 50f, 50f, 40f, Color.White)
        }
    }
}

private fun lerpWhite(c: Color) = Color(
    red = c.red + (1f - c.red) * 0.55f, green = c.green + (1f - c.green) * 0.55f, blue = c.blue + (1f - c.blue) * 0.55f,
)
