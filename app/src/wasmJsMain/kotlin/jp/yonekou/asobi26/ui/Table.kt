package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.lerp
import kotlin.math.sin

/**
 * 対局画面の「卓」と、駒・石・ビーズなどのイラストの描き方(オリジナル)。
 * 画像ファイルは使わず、グラデーションと図形だけで描く(アプリを軽く保つため)。
 */

/** 卓の色。ライトは明るい木、ダークは暗い木 */
class TablePalette(val top: Color, val bottom: Color, val grain: Color, val vignette: Color)

val LightTable = TablePalette(Color(0xFFC79A66), Color(0xFFA9794A), Color(0x1F3B2412), Color(0x33000000))
val DarkTable = TablePalette(Color(0xFF3A2B1D), Color(0xFF241A11), Color(0x22000000), Color(0x66000000))

fun tableFor(c: AsobiColors) = if (c.dark) DarkTable else LightTable

/** 木目の卓。中身(盤や手札)は content に置く */
@Composable
fun TableBackground(c: AsobiColors, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val t = tableFor(c)
    Box(
        modifier.drawBehind {
            drawRect(Brush.verticalGradient(listOf(t.top, t.bottom)))
            woodGrain(Offset.Zero, size, t.grain, 26)
            drawRect(safeRadial(listOf(Color.Transparent, t.vignette), center = center, radius = size.maxDimension * 0.75f))
        },
        content = content,
    )
}

/**
 * 円形のグラデーション。Android は半径0だと例外で止まる(0.4.5 で実機が落ちた原因)ので、半径を必ず0より大きくする。
 * 盤や駒の描画では Brush.radialGradient を直接使わず、これを使う。
 */
fun safeRadial(colors: List<Color>, center: Offset = Offset.Unspecified, radius: Float = Float.POSITIVE_INFINITY): Brush =
    Brush.radialGradient(colors, center, if (radius.isFinite()) radius.coerceAtLeast(0.01f) else radius)

/** 木目(板目の質感を乗算で重ねる)。color と lines は前の描き方の名残で、濃さの目安にだけ使う */
@Suppress("UNUSED_PARAMETER")
fun DrawScope.woodGrain(topLeft: Offset, area: Size, color: Color, lines: Int) {
    // 卓は平らな色にする(木目は作りものらしく見えたので描かない)
}

/** 木の板(盤の枠など) */
fun DrawScope.woodPanel(topLeft: Offset, size: Size, radius: Float, light: Color, dark: Color) {
    // 影
    drawRoundRect(Color(0x55000000), topLeft + Offset(0f, radius * 0.25f + 4f), size, CornerRadius(radius))
    drawRoundRect(
        Brush.linearGradient(listOf(light, dark), start = topLeft, end = topLeft + Offset(size.width, size.height)),
        topLeft, size, CornerRadius(radius),
    )
    // 木目は描かない(平らな色で見やすく)
    drawRoundRect(Color(0x33FFFFFF), topLeft + Offset(1.5f, 1.5f), Size(size.width - 3f, size.height - 3f), CornerRadius(radius), style = Stroke(1.5f))
}

/** 立体的な石・円盤(上から見て、左上から光が当たる) */
fun DrawScope.stone(center: Offset, r: Float, base: Color, shadow: Boolean = true, alpha: Float = 1f) {
    if (r <= 0.5f) return
    if (shadow) drawCircle(Color.Black.copy(alpha = 0.28f * alpha), r, center + Offset(r * 0.12f, r * 0.18f))
    val hi = lerp(base, Color.White, 0.45f)
    val lo = lerp(base, Color.Black, 0.35f)
    drawCircle(
        safeRadial(listOf(hi, base, lo), center = center + Offset(-r * 0.35f, -r * 0.4f), radius = r * 1.6f),
        r, center, alpha = alpha,
    )
    drawCircle(Color.White.copy(alpha = 0.35f * alpha), r * 0.22f, center + Offset(-r * 0.38f, -r * 0.42f))
}

/** 横に縮めた円盤(リバーシの裏返し用)。sx = 0〜1 */
fun DrawScope.flatDisc(center: Offset, r: Float, sx: Float, base: Color) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    if (sx <= 0.02f) {
        drawLine(lerp(base, Color.Black, 0.3f), center + Offset(0f, -r), center + Offset(0f, r), strokeWidth = r * 0.12f)
        return
    }
    val w = r * sx
    drawOval(Color.Black.copy(alpha = 0.25f), center + Offset(-w + r * 0.1f, -r + r * 0.15f), Size(w * 2, r * 2))
    drawOval(
        safeRadial(listOf(lerp(base, Color.White, 0.4f), base, lerp(base, Color.Black, 0.35f)),
            center = center + Offset(-w * 0.35f, -r * 0.4f), radius = r * 1.6f),
        center + Offset(-w, -r), Size(w * 2, r * 2),
    )
}

/** ガラスのビーズ(マンカラの石) */
fun DrawScope.bead(center: Offset, r: Float, base: Color) {
    if (r <= 0.5f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawCircle(Color.Black.copy(alpha = 0.3f), r, center + Offset(r * 0.15f, r * 0.2f))
    drawCircle(
        safeRadial(listOf(lerp(base, Color.White, 0.55f), base, lerp(base, Color.Black, 0.25f)),
            center = center + Offset(-r * 0.3f, -r * 0.35f), radius = r * 1.5f),
        r, center,
    )
    drawCircle(Color.White.copy(alpha = 0.6f), r * 0.25f, center + Offset(-r * 0.35f, -r * 0.4f))
}

/** くぼみ(マンカラの穴・倉)。中心が暗い楕円 */
fun DrawScope.recess(topLeft: Offset, size: Size, base: Color, highlight: Color? = null) {
    drawRoundRect(
        safeRadial(listOf(lerp(base, Color.Black, 0.45f), base), center = topLeft + Offset(size.width / 2, size.height * 0.45f),
            radius = maxOf(size.width, size.height) * 0.7f),
        topLeft, size, CornerRadius(minOf(size.width, size.height) / 2),
    )
    drawRoundRect(Color(0x40FFFFFF), topLeft + Offset(0f, 2f), size, CornerRadius(minOf(size.width, size.height) / 2), style = Stroke(1.5f))
    if (highlight != null) {
        drawRoundRect(highlight, topLeft - Offset(3f, 3f), Size(size.width + 6f, size.height + 6f), CornerRadius(minOf(size.width, size.height) / 2 + 3f), style = Stroke(4f))
    }
}

/** ビーズの色(決まった順に並べる) */
val BEAD_COLORS = listOf(
    Color(0xFFE05A47), Color(0xFF4A90D9), Color(0xFF5DBB63), Color(0xFFF2C94C),
    Color(0xFF9B6BD3), Color(0xFFEF8A3C), Color(0xFF3FB6B2), Color(0xFFE8E4DA),
)

/** くぼみの中にビーズを並べる位置(個数 n の i 番目)。中心からの相対位置を、半径1で返す */
fun beadSpot(i: Int, n: Int): Offset {
    if (n == 1) return Offset.Zero
    val golden = 2.39996f
    val rr = kotlin.math.sqrt((i + 0.5f) / n)
    val a = i * golden
    return Offset(rr * kotlin.math.cos(a), rr * kotlin.math.sin(a))
}

/** 0〜1 の値を、ゆっくり始まりゆっくり終わる形にする */
fun ease(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return x * x * (3 - 2 * x)
}

/** a から b まで t(0〜1)の位置 */
fun mix(a: Float, b: Float, t: Float) = a + (b - a) * t
