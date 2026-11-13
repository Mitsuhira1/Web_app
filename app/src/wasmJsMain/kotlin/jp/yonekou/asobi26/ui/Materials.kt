package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.lerp

/**
 * 本物の素材に寄せた盤と駒の部品(真鍮のはめ込み線・黒檀と楓の削り出しの駒・象牙の駒・ガラスの駒)。
 * どれも左上から光が当たる前提で、図形とグラデーションだけで描く。
 */

private val BRASS = listOf(Color(0xFFF4D58A), Color(0xFFC79A3E), Color(0xFF8C6420))

/** 木の板にはめ込んだ真鍮の線(溝の影+金色の線) */
fun DrawScope.brassLine(a: Offset, b: Offset, w: Float) {
    drawLine(Color(0xAA1E1208), a + Offset(0f, w * 0.35f), b + Offset(0f, w * 0.35f), w * 1.9f, cap = StrokeCap.Round)
    drawLine(Brush.linearGradient(BRASS, a, b + Offset(w * 4, w * 4)), a, b, w, cap = StrokeCap.Round)
}

/** 真鍮の線の四角(モリスの盤) */
fun DrawScope.brassRect(tl: Offset, br: Offset, w: Float) {
    brassLine(tl, Offset(br.x, tl.y), w)
    brassLine(Offset(br.x, tl.y), br, w)
    brassLine(br, Offset(tl.x, br.y), w)
    brassLine(Offset(tl.x, br.y), tl, w)
}

/** 駒を置く穴(真鍮の縁) */
fun DrawScope.brassHole(c: Offset, r: Float) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color(0xFF1E1208), r, c)
    drawCircle(Brush.linearGradient(BRASS, c - Offset(r, r), c + Offset(r, r)), r, c, style = Stroke(r * 0.28f))
    drawCircle(safeRadial(listOf(Color(0xFF0B0704), Color(0xFF3B2715)), c, r * 0.8f), r * 0.66f, c)
}

/**
 * 削り出しの木の駒(上から見た姿)。dark = 黒檀、そうでなければ楓。
 * 外の縁・段の輪・中央の頭が、少しずつ違う明るさで見える。
 */
fun DrawScope.turnedPiece(c: Offset, r: Float, dark: Boolean, alpha: Float = 1f) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    val base = if (dark) Color(0xFF2B1A10) else Color(0xFFE6CC9A)
    val hi = if (dark) Color(0xFF7A5A40) else Color(0xFFFFF6E2)
    val lo = if (dark) Color(0xFF0E0804) else Color(0xFFA9844C)
    drawCircle(Color.Black.copy(alpha = 0.4f * alpha), r, c + Offset(r * 0.12f, r * 0.2f))
    drawCircle(safeRadial(listOf(hi, base, lo), c + Offset(-r * 0.3f, -r * 0.35f), r * 1.5f), r, c, alpha = alpha)
    drawCircle((if (dark) Color.White else Color.Black).copy(alpha = 0.14f * alpha), r * 0.72f, c, style = Stroke(r * 0.06f))
    drawCircle(safeRadial(listOf(lerp(hi, Color.White, 0.2f), base), c + Offset(-r * 0.12f, -r * 0.14f), r * 0.5f), r * 0.38f, c, alpha = alpha)
    drawCircle(Color.White.copy(alpha = (if (dark) 0.22f else 0.5f) * alpha), r * 0.16f, c + Offset(-r * 0.36f, -r * 0.42f))
}

/** 象牙色の大理石の駒。engrave=true なら、ウサギの形をうすく彫った線を入れる */
fun DrawScope.ivoryPiece(c: Offset, r: Float, engrave: Boolean, alpha: Float = 1f) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.4f * alpha), r, c + Offset(r * 0.12f, r * 0.2f))
    drawCircle(safeRadial(listOf(Color.White, Color(0xFFF1EADB), Color(0xFFC8BBA0)), c + Offset(-r * 0.3f, -r * 0.35f), r * 1.6f), r, c, alpha = alpha)
    // 大理石の淡い筋
    for (k in 0 until 3) {
        val y = c.y - r * 0.5f + k * r * 0.45f
        drawLine(Color(0x18806A50), Offset(c.x - r * 0.8f, y + k * r * 0.1f), Offset(c.x + r * 0.7f, y - r * 0.25f), r * 0.05f, cap = StrokeCap.Round)
    }
    if (engrave) {
        // 彫った線: 丸い頭と、後ろへ倒れた長い耳2本(ウサギの横顔)
        val ink = Color(0xFF6E5A3C).copy(alpha = 0.6f * alpha)
        val sw = Stroke(r * 0.07f, join = StrokeJoin.Round)
        val head = c + Offset(-r * 0.08f, r * 0.22f)
        drawOval(ink, head - Offset(r * 0.3f, r * 0.24f), androidx.compose.ui.geometry.Size(r * 0.6f, r * 0.48f), style = sw)
        for ((ang, dx) in listOf(-28f to 0.02f, -12f to 0.16f)) {
            val base = head + Offset(r * dx, -r * 0.18f)
            rotate(ang, pivot = base) {
                drawOval(ink, base - Offset(r * 0.09f, r * 0.62f), androidx.compose.ui.geometry.Size(r * 0.18f, r * 0.62f), style = sw)
            }
        }
        drawCircle(ink, r * 0.045f, head + Offset(r * 0.12f, -r * 0.02f))
    }
    drawCircle(Color.White.copy(alpha = 0.55f * alpha), r * 0.2f, c + Offset(-r * 0.36f, -r * 0.42f))
}

/** ガラスの駒(透きとおった色・底の明るい反射・上の光) */
fun DrawScope.glassStone(c: Offset, r: Float, color: Color, alpha: Float = 1f) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.35f * alpha), r, c + Offset(r * 0.1f, r * 0.18f))
    drawCircle(safeRadial(listOf(lerp(color, Color.White, 0.55f), color, lerp(color, Color.Black, 0.45f)), c + Offset(-r * 0.3f, -r * 0.35f), r * 1.4f), r, c, alpha = alpha)
    drawCircle(lerp(color, Color.White, 0.5f).copy(alpha = 0.45f * alpha), r * 0.45f, c + Offset(r * 0.28f, r * 0.3f))
    drawCircle(Color.White.copy(alpha = 0.75f * alpha), r * 0.18f, c + Offset(-r * 0.35f, -r * 0.4f))
}
