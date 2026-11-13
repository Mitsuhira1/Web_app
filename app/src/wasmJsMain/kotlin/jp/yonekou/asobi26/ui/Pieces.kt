package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.games.Chess
import jp.yonekou.asobi26.core.games.Shogi

// =====================================================================
// 駒(0.5.8「机の上の実物」): チェスは旋盤でひいた木の駒、将棋は厚みのある書き駒。
// 形は1回だけ作って使い回す(AQUOS wish5 で軽く)。
// =====================================================================

/** チェスの駒の形(駒の中心を原点、マス 42 の大きさで描いた座標。デザインの見本と同じ) */
private val CHESS_D = mapOf(
    Chess.P to "M-9 14H9V11Q5 9 4 2Q8 -1 5.5 -6A6 6 0 1 0 -5.5 -6Q-8 -1 -4 2Q-5 9 -9 11Z",
    Chess.R to "M-11 14H11V10L8 8V-3L10 -5V-13H6V-10H2.5V-13H-2.5V-10H-6V-13H-10V-5L-8 -3V8L-11 10Z",
    Chess.B to "M-10 14H10V11Q5 9 4 3Q8 0 6 -5Q4 -10 0 -15Q-4 -10 -6 -5Q-8 0 -4 3Q-5 9 -10 11ZM-1.8 -17A1.8 1.8 0 1 0 1.8 -17A1.8 1.8 0 1 0 -1.8 -17Z",
    Chess.N to "M-10 14H10V11Q8 7 7 2Q8 -6 4 -11L2 -15L0 -12Q-5 -11 -7 -6L-10 -1L-8 2L-4 0Q-3 3 -6 7Q-9 9 -10 11Z",
    Chess.Q to "M-11 14H11V11Q6 9 5 2L9 -9L5 -5L3 -13L0 -6L-3 -13L-5 -5L-9 -9L-5 2Q-6 9 -11 11ZM-1.6 -16A1.6 1.6 0 1 0 1.6 -16A1.6 1.6 0 1 0 -1.6 -16Z",
    Chess.K to "M-11 14H11V11Q6 9 5 2Q9 -2 7 -7Q4 -11 1.5 -11V-14H4V-16.5H1.5V-19H-1.5V-16.5H-4V-14H-1.5V-11Q-4 -11 -7 -7Q-9 -2 -5 2Q-6 9 -11 11Z",
)
private val chessPaths = HashMap<Int, Path>()
private fun chessPath(kind: Int): Path = synchronized(chessPaths) {
    chessPaths.getOrPut(kind) { PathParser().parsePathString(CHESS_D[kind] ?: CHESS_D.getValue(Chess.P)).toPath() }
}

// 白は象牙色、黒は濃い木。左から光が当たる横のグラデーション(駒の座標で作り置く)
private val W_PIECE = Brush.horizontalGradient(listOf(Color(0xFFFBF5E6), Color(0xFFEFE3C8), Color(0xFFC9B48D)), startX = -11f, endX = 11f)
private val B_PIECE = Brush.horizontalGradient(listOf(Color(0xFF5A4A40), Color(0xFF33271F), Color(0xFF1C1410)), startX = -11f, endX = 11f)
private val W_EDGE = Color(0xFF6B5A3C)
private val B_EDGE = Color(0xFF0C0806)
private val PIECE_STROKE = Stroke(1.2f, join = StrokeJoin.Round)
private val RING_STROKE = Stroke(1f)

/** チェスの駒。center はマスの中心、s はマスの大きさ */
fun DrawScope.chessPiece(center: Offset, s: Float, kind: Int, white: Boolean, alpha: Float = 1f) {
    val k = s / 42f
    translate(center.x, center.y - k) {
        scale(k, k, pivot = Offset.Zero) {
            // 下に落ちる影(ぼかさない楕円)
            drawOval(Color.Black, Offset(-14f, 10.5f), Size(28f, 9f), alpha = 0.28f * alpha)
            val p = chessPath(kind)
            drawPath(p, if (white) W_PIECE else B_PIECE, alpha = alpha)
            drawPath(p, if (white) W_EDGE else B_EDGE, alpha = alpha, style = PIECE_STROKE)
            // 台座の段の線
            drawLine((if (white) W_EDGE else Color.Black).copy(alpha = 0.5f * alpha), Offset(-9f, 11f), Offset(9f, 11f), RING_STROKE.width)
        }
    }
}

// ---------------------------------------------------------------------
// 将棋の駒(2文字の書き駒。成り駒は赤)
// ---------------------------------------------------------------------

val KOMA_INK = Color(0xFF1C140C)
val KOMA_RED = Color(0xFFB3261C)

/** 駒の字(種類ごと。手前の玉は「玉将」、相手の側は「王将」) */
fun komaText(kind: Int, upside: Boolean): String = when (kind) {
    Shogi.K -> if (upside) "王将" else "玉将"
    else -> KOMA_TEXT.getOrElse(kind) { "" }
}
private val KOMA_TEXT = arrayOf("", "歩兵", "香車", "桂馬", "銀将", "金将", "角行", "飛車", "玉将", "と", "成香", "成桂", "成銀", "竜馬", "竜王")

/** 字の形の作り置き(駒の種類・大きさ・色ごと)。毎フレーム測り直すと重いので */
private val komaGlyphs = LruMap<String, TextLayoutResult>(160)

internal fun DrawScope.komaGlyph(tm: TextMeasurer, ch: String, fsPx: Float, color: Color): TextLayoutResult {
    val key = "$ch|${(fsPx * 2).toInt()}|${color.value}|${System.identityHashCode(tm)}"
    synchronized(komaGlyphs) { komaGlyphs[key] }?.let { return it }
    val lay = tm.measure(ch, TextStyle(color = color, fontSize = (fsPx / density / fontScale).sp, fontFamily = KomaFont))
    synchronized(komaGlyphs) { komaGlyphs[key] = lay }
    return lay
}

/** 駒の五角形(中心 cx,cy・幅 w・高さ h) */
private fun komaPath(cx: Float, cy: Float, w: Float, h: Float, dy: Float = 0f) = Path().apply {
    moveTo(cx, cy - h / 2 + dy)
    lineTo(cx + w * 0.38f, cy - h * 0.32f + dy)
    lineTo(cx + w / 2, cy + h / 2 + dy)
    lineTo(cx - w / 2, cy + h / 2 + dy)
    lineTo(cx - w * 0.38f, cy - h * 0.32f + dy)
    close()
}

/**
 * 将棋の駒(五角形・下に厚みと影)。center は駒の中心、w は駒の幅。upside=true なら逆さ(相手の駒)。
 * kind は Shogi の定数(成り駒は赤い字)。
 */
fun DrawScope.komaPiece(tm: TextMeasurer, center: Offset, w: Float, kind: Int, upside: Boolean, alpha: Float = 1f, label: String? = null) {
    val h = w * 1.12f
    val cx = center.x
    val cy = center.y
    val side = w * 0.06f
    // 影は回さない(光はいつも左上から)
    drawPath(komaPath(cx + w * 0.04f, cy + w * 0.03f, w, h, side), Color.Black, alpha = 0.3f * alpha)
    rotate(if (upside) 180f else 0f, pivot = center) {
        val face = komaPath(cx, cy - side / 2, w, h)
        // 側面(厚み)
        drawPath(komaPath(cx, cy + side / 2, w, h), Mat.komaSide, alpha = alpha)
        drawPath(face, Brush.verticalGradient(listOf(Mat.komaTop, Mat.komaBottom), startY = cy - h / 2, endY = cy + h / 2), alpha = alpha)
        drawPath(face, Mat.komaEdge, alpha = alpha, style = Stroke(w * 0.025f, join = StrokeJoin.Round))
        val promoted = kind >= Shogi.TO
        val color = if (promoted) KOMA_RED else KOMA_INK
        val text = label ?: komaText(kind, upside)
        val top = cy - side / 2
        if (text.length >= 2) {
            val fs = w * 0.42f
            val a = komaGlyph(tm, text.substring(0, 1), fs, color)
            val b = komaGlyph(tm, text.substring(1, 2), fs, color)
            val gap = fs * 0.98f
            val mid = top + h * 0.0f
            drawText(a, topLeft = Offset(cx - a.size.width / 2f, mid - gap / 2 - a.size.height / 2f), alpha = alpha)
            drawText(b, topLeft = Offset(cx - b.size.width / 2f, mid + gap / 2 - b.size.height / 2f), alpha = alpha)
        } else if (text.isNotEmpty()) {
            val lay = komaGlyph(tm, text, w * 0.6f, color)
            drawText(lay, topLeft = Offset(cx - lay.size.width / 2f, top + h * 0.07f - lay.size.height / 2f), alpha = alpha)
        }
    }
}

/** 取れる相手の駒のマス: 駒に点を重ねず、マスを赤い枠で囲む(うすい赤の地) */
fun DrawScope.captureFrame(center: Offset, cell: Float) {
    val tl = center - Offset(cell / 2, cell / 2)
    val inset = cell * 0.05f
    drawRect(Color(0x33E0463A), tl, Size(cell, cell))
    drawRoundRect(
        Color(0xFFE0463A), tl + Offset(inset, inset), Size(cell - 2 * inset, cell - 2 * inset),
        androidx.compose.ui.geometry.CornerRadius(cell * 0.12f), style = Stroke(cell * 0.07f),
    )
}

/** 空いている行き先のマス: 中央に小さな点 */
fun DrawScope.targetDot(center: Offset, cell: Float) {
    drawCircle(Color(0xCCFFFDF8), cell * 0.12f, center)
    drawCircle(Color(0x66000000), cell * 0.12f, center, style = Stroke(1.2f))
}
