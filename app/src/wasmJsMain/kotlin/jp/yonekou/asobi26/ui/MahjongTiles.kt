package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.drawText
import jp.yonekou.asobi26.core.games.MahjongHand

// =====================================================================
// 麻雀の牌(0.5.8): 象牙色の表・山吹色の裏と厚み。萬子は漢数字+赤い「萬」、筒子は丸、索子は棒、字牌は字(白は青い枠)。
// 字は書体 B(Yuji Boku)。どれも簡単な形の組み合わせなので、毎回描いても軽い。
// =====================================================================

private val MJ_INK = Color(0xFF1D2433)
private val MJ_RED = Color(0xFFB3261C)
private val MJ_GREEN = Color(0xFF1F7A45)
private val MJ_BLUE = Color(0xFF1F4FA3)
private val KANJI_NUM = listOf("一", "二", "三", "四", "五", "六", "七", "八", "九")
private val HONORS = listOf("東", "南", "西", "北", "白", "發", "中")

/** 筒子の丸の位置(牌の幅・高さに対する割合と半径) */
private val PIN = mapOf(
    1 to listOf(floatArrayOf(.5f, .5f, .3f)),
    2 to listOf(floatArrayOf(.5f, .27f, .17f), floatArrayOf(.5f, .73f, .17f)),
    3 to listOf(floatArrayOf(.25f, .2f, .15f), floatArrayOf(.5f, .5f, .15f), floatArrayOf(.75f, .8f, .15f)),
    4 to listOf(floatArrayOf(.28f, .27f, .16f), floatArrayOf(.72f, .27f, .16f), floatArrayOf(.28f, .73f, .16f), floatArrayOf(.72f, .73f, .16f)),
    5 to listOf(floatArrayOf(.26f, .22f, .14f), floatArrayOf(.74f, .22f, .14f), floatArrayOf(.5f, .5f, .14f), floatArrayOf(.26f, .78f, .14f), floatArrayOf(.74f, .78f, .14f)),
    6 to listOf(floatArrayOf(.28f, .2f, .14f), floatArrayOf(.72f, .2f, .14f), floatArrayOf(.28f, .52f, .14f), floatArrayOf(.72f, .52f, .14f), floatArrayOf(.28f, .82f, .14f), floatArrayOf(.72f, .82f, .14f)),
    7 to listOf(floatArrayOf(.2f, .15f, .12f), floatArrayOf(.5f, .25f, .12f), floatArrayOf(.8f, .35f, .12f), floatArrayOf(.28f, .6f, .13f), floatArrayOf(.72f, .6f, .13f), floatArrayOf(.28f, .85f, .13f), floatArrayOf(.72f, .85f, .13f)),
    8 to listOf(floatArrayOf(.28f, .14f, .12f), floatArrayOf(.72f, .14f, .12f), floatArrayOf(.28f, .38f, .12f), floatArrayOf(.72f, .38f, .12f), floatArrayOf(.28f, .62f, .12f), floatArrayOf(.72f, .62f, .12f), floatArrayOf(.28f, .86f, .12f), floatArrayOf(.72f, .86f, .12f)),
    9 to listOf(floatArrayOf(.2f, .18f, .12f), floatArrayOf(.5f, .18f, .12f), floatArrayOf(.8f, .18f, .12f), floatArrayOf(.2f, .5f, .12f), floatArrayOf(.5f, .5f, .12f), floatArrayOf(.8f, .5f, .12f), floatArrayOf(.2f, .82f, .12f), floatArrayOf(.5f, .82f, .12f), floatArrayOf(.8f, .82f, .12f)),
)

/** 索子の棒の並び(行ごとの本数) */
private fun souRows(n: Int): List<Int> = when (n) {
    1 -> listOf(1); 2 -> listOf(2); 3 -> listOf(3); 4 -> listOf(2, 2); 5 -> listOf(2, 1, 2); 6 -> listOf(3, 3)
    7 -> listOf(1, 3, 3); 8 -> listOf(4, 4); else -> listOf(3, 3, 3)
}

/**
 * 牌1枚(表)。tl は表の左上、w は幅(高さは 1.36 倍)。厚みと影は下に描く。
 * redOk = 赤ドラありのルール。
 */
fun DrawScope.mjTileFace(tm: TextMeasurer, tl: Offset, w: Float, tile: Int, redOk: Boolean, alpha: Float = 1f, picked: Boolean = false) {
    val h = w * 1.36f
    val rr = CornerRadius(w * 0.12f)
    drawRoundRect(Color.Black, tl + Offset(0f, h * 0.1f), Size(w, h), rr, alpha = 0.3f * alpha)
    drawRoundRect(Mat.tileBack, tl + Offset(0f, h * 0.07f), Size(w, h), rr, alpha = alpha)
    drawRoundRect(Brush.verticalGradient(listOf(Mat.ivoryTop, Mat.ivoryBottom), startY = tl.y, endY = tl.y + h), tl, Size(w, h), rr, alpha = alpha)
    drawRoundRect(if (picked) ACCENT else Mat.ivoryEdge, tl, Size(w, h), rr, alpha = alpha, style = Stroke(if (picked) w * 0.08f else 0.8f))
    val t = tile / 4
    val aka = redOk && MahjongHand.red(tile)
    val inset = w * 0.1f
    val fx = tl.x + inset; val fy = tl.y + inset
    val fw = w - 2 * inset; val fh = h - 2 * inset
    fun glyph(ch: String, cx: Float, cy: Float, size: Float, color: Color) {
        val lay = komaGlyph(tm, ch, size, color)
        drawText(lay, topLeft = Offset(cx - lay.size.width / 2f, cy - lay.size.height / 2f), alpha = alpha)
    }
    when {
        t >= 27 -> {
            val name = HONORS[t - 27]
            if (name == "白") {
                drawRoundRect(MJ_BLUE, Offset(tl.x + w * 0.2f, tl.y + h * 0.2f), Size(w * 0.6f, h * 0.6f), CornerRadius(w * 0.06f), alpha = alpha, style = Stroke(w * 0.07f))
            } else {
                val col = when (name) { "中" -> MJ_RED; "發" -> MJ_GREEN; else -> MJ_INK }
                glyph(name, tl.x + w / 2, tl.y + h * 0.52f, w * 0.72f, col)
            }
        }
        t / 9 == 0 -> {
            glyph(KANJI_NUM[t % 9], tl.x + w / 2, tl.y + h * 0.3f, w * 0.5f, if (aka) MJ_RED else MJ_INK)
            glyph("萬", tl.x + w / 2, tl.y + h * 0.72f, w * 0.52f, MJ_RED)
        }
        t / 9 == 1 -> {
            val n = t % 9 + 1
            PIN.getValue(n).forEachIndexed { k, (ax, ay, ar) ->
                val col = when {
                    aka -> MJ_RED
                    n == 1 -> MJ_RED
                    n == 7 && k < 3 -> MJ_GREEN
                    k % 3 == 1 -> MJ_RED
                    k % 2 == 1 -> MJ_GREEN
                    else -> MJ_BLUE
                }
                val c = Offset(fx + ax * fw, fy + ay * fh)
                val r = ar * fw * (if (n == 1) 1.1f else 1f)
                drawCircle(col, r, c, alpha = alpha)
                drawCircle(Color.White, r * 0.45f, c, alpha = 0.75f * alpha)
                if (n == 1) drawCircle(col, r * 0.22f, c, alpha = alpha)
            }
        }
        else -> {
            val n = t % 9 + 1
            val rows = souRows(n)
            val sh = fh / rows.size * 0.8f
            val sw = fw * 0.13f
            var k = 0
            rows.forEachIndexed { ri, cnt ->
                val cy = fy + (ri + 0.5f) * fh / rows.size
                for (j in 0 until cnt) {
                    val cx = fx + (j + 0.5f) * fw / cnt
                    val red = aka || n == 1 || (n % 2 == 1 && n >= 5 && ri == rows.size / 2 && j == cnt / 2 && cnt % 2 == 1)
                    val col = if (red) MJ_RED else MJ_GREEN
                    val tlS = Offset(cx - sw / 2, cy - sh / 2)
                    drawRoundRect(col, tlS, Size(sw, sh), CornerRadius(sw / 2), alpha = alpha)
                    drawLine(Color.White.copy(alpha = 0.6f * alpha), Offset(cx, cy - sh * 0.1f), Offset(cx, cy + sh * 0.1f), sw * 0.25f)
                    k++
                }
            }
        }
    }
}

/** 牌の裏(山吹色)。tl は左上、w・h は大きさ(横向きにも使う) */
fun DrawScope.mjTileBack(tl: Offset, w: Float, h: Float, alpha: Float = 1f) {
    val rr = CornerRadius(minOf(w, h) * 0.15f)
    drawRoundRect(Color.Black, tl + Offset(0f, minOf(w, h) * 0.12f), Size(w, h), rr, alpha = 0.3f * alpha)
    drawRoundRect(Mat.tileBack, tl, Size(w, h), rr, alpha = alpha)
    drawRoundRect(Mat.tileBackEdge, tl, Size(w, h), rr, alpha = alpha, style = Stroke(0.7f))
    drawRoundRect(Color(0xFFFFF5DD), tl, Size(w, h * 0.2f), rr, alpha = alpha)
}

/** 横に倒した牌(リーチの宣言牌など)。中心 center のまわりに 90° 回して描く */
fun DrawScope.mjTileSideways(tm: TextMeasurer, center: Offset, w: Float, tile: Int, redOk: Boolean, alpha: Float = 1f) {
    val h = w * 1.36f
    rotate(90f, center) { mjTileFace(tm, center - Offset(w / 2, h / 2), w, tile, redOk, alpha) }
}
