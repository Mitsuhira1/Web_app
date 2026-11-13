package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// =====================================================================
// 花札48枚(0.5.8): 黒いふちの札に、月ごとの植物と、光・タネ・短冊を簡単な形で描く。
// 札の中は 100×162 の座標で描く(どの大きさでも同じ形)。色は資料 4.3 の決まり。
// =====================================================================

private val H_BG = Color(0xFFF4EAD0)
private val H_RED = Color(0xFFC8362E)
private val H_GREEN = Color(0xFF1F5D3A)
private val H_BLACK = Color(0xFF15151A)
private val H_PURPLE = Color(0xFF7A5AC0)
private val H_YELLOW = Color(0xFFE6B21F)
private val H_PINK = Color(0xFFF29BB5)
private val H_BLUE = Color(0xFF2F4FA3)
private val H_BROWN = Color(0xFF7A4A28)
private val H_WHITE = Color(0xFFFFFDF5)

private const val HW = 100f
private const val HH = 162f

/** 花札1枚。tl は左上、w は幅(高さは 1.62 倍)。dim なら薄く */
fun DrawScope.hanaCard(tl: Offset, w: Float, card: Int, picked: Boolean = false, hint: Boolean = false) {
    val h = w * 1.62f
    drawRoundRect(Color.Black.copy(alpha = 0.3f), tl + Offset(0f, w * 0.05f), Size(w, h), CornerRadius(w * 0.08f))
    drawRoundRect(H_BLACK, tl, Size(w, h), CornerRadius(w * 0.08f))
    val k = w / HW
    translate(tl.x, tl.y) {
        scale(k, k, pivot = Offset.Zero) {
            clipRect(5f, 5f, HW - 5f, HH - 5f) { drawFace(card) }
        }
    }
    if (picked || hint) drawRoundRect(Color(0xFFFFD94F), tl - Offset(w * 0.03f, w * 0.03f), Size(w * 1.06f, h + w * 0.06f), CornerRadius(w * 0.1f), style = Stroke(w * (if (picked) 0.08f else 0.06f)))
}

/** 花札の裏(赤茶の無地) */
fun DrawScope.hanaBack(tl: Offset, w: Float) {
    val h = w * 1.62f
    drawRoundRect(Color.Black.copy(alpha = 0.3f), tl + Offset(0f, w * 0.05f), Size(w, h), CornerRadius(w * 0.08f))
    drawRoundRect(H_BLACK, tl, Size(w, h), CornerRadius(w * 0.08f))
    drawRoundRect(Color(0xFF8E2A22), tl + Offset(w * 0.05f, w * 0.05f), Size(w * 0.9f, h - w * 0.1f), CornerRadius(w * 0.05f))
}

private fun DrawScope.blob(x: Float, y: Float, r: Float, c: Color) = drawCircle(c, r, Offset(x, y))

private fun DrawScope.flower(x: Float, y: Float, r: Float, petal: Color, center: Color, n: Int = 5) {
    for (i in 0 until n) {
        val a = 2 * PI * i / n - PI / 2
        blob(x + r * 0.55f * cos(a).toFloat(), y + r * 0.55f * sin(a).toFloat(), r * 0.48f, petal)
    }
    blob(x, y, r * 0.28f, center)
}

/** 紅葉の葉(丸みのある5つの葉先を放射状に重ねた手の形と、軸) */
private fun DrawScope.mapleLeaf(x: Float, y: Float, r: Float, c: Color, rot: Float) {
    rotate(rot, Offset(x, y)) {
        drawLine(Color(0xFF6A1A12), Offset(x, y), Offset(x, y + r * 0.9f), r * 0.1f, cap = StrokeCap.Round)
        for ((deg, len) in listOf(-90f to 1f, -45f to 0.85f, -135f to 0.85f, 0f to 0.6f, 180f to 0.6f)) {
            rotate(deg + 90f, Offset(x, y)) {
                drawOval(c, Offset(x - r * 0.22f, y - r * len), Size(r * 0.44f, r * len))
            }
        }
        blob(x, y, r * 0.28f, c)
        drawLine(Color(0x66FFFFFF), Offset(x, y), Offset(x, y - r * 0.8f), r * 0.05f)
    }
}

/** 短冊(斜めの帯)。poem = 字のある赤短(黒い線で字を表す) */
private fun DrawScope.ribbon(color: Color, poem: Boolean) {
    rotate(-12f, Offset(50f, 74f)) {
        drawRect(Color.Black.copy(alpha = 0.25f), Offset(39f, 32f), Size(22f, 84f))
        drawRect(color, Offset(37f, 30f), Size(22f, 84f))
        drawRect(Color.White.copy(alpha = 0.25f), Offset(39f, 32f), Size(4f, 80f))
        if (poem) for (i in 0 until 4) drawLine(H_BLACK, Offset(48f, 42f + i * 16f), Offset(48f, 52f + i * 16f), 3.2f, cap = StrokeCap.Round)
    }
}

private fun DrawScope.bird(x: Float, y: Float, s: Float, body: Color, wing: Color) {
    drawOval(body, Offset(x - 14f * s, y - 7f * s), Size(28f * s, 14f * s))
    blob(x + 13f * s, y - 6f * s, 6f * s, body)
    drawPath(Path().apply { moveTo(x + 18f * s, y - 7f * s); lineTo(x + 25f * s, y - 5f * s); lineTo(x + 18f * s, y - 3f * s); close() }, H_YELLOW)
    drawPath(Path().apply { moveTo(x - 6f * s, y - 4f * s); lineTo(x + 6f * s, y - 20f * s); lineTo(x + 8f * s, y - 2f * s); close() }, wing)
    blob(x + 14f * s, y - 7f * s, 1.3f * s, H_BLACK)
}

private fun DrawScope.drawFace(card: Int) {
    val m = card / 4
    // 地の色(光札は空の色が違う)
    val bg = when (card) {
        0 -> H_RED      // 松に鶴: 赤い空と日の出
        28 -> Color(0xFFD9D4C4) // 芒に月
        40 -> Color(0xFF3A3F4A) // 柳に小野道風(雨)
        44 -> H_YELLOW  // 桐に鳳凰
        else -> H_BG
    }
    drawRect(bg, Offset.Zero, Size(HW, HH))
    when (m) {
        0 -> { // 松
            if (card == 0) blob(70f, 40f, 22f, Color(0xFFFFE08A))
            drawRect(H_BROWN, Offset(44f, 70f), Size(8f, 92f))
            for ((x, y, r) in listOf(Triple(30f, 96f, 26f), Triple(68f, 104f, 24f), Triple(48f, 74f, 22f), Triple(22f, 130f, 20f), Triple(76f, 134f, 22f))) {
                drawOval(H_GREEN, Offset(x - r, y - r * 0.55f), Size(2 * r, r * 1.1f))
                drawOval(Color(0xFF2E7A50), Offset(x - r * 0.7f, y - r * 0.45f), Size(1.4f * r, r * 0.5f))
            }
            if (card == 0) { // 鶴
                drawOval(H_WHITE, Offset(24f, 106f), Size(46f, 26f))
                drawLine(H_WHITE, Offset(62f, 112f), Offset(78f, 82f), 5f, cap = StrokeCap.Round)
                blob(80f, 80f, 5f, H_WHITE); blob(81f, 77f, 2.4f, H_RED)
                drawPath(Path().apply { moveTo(26f, 112f); lineTo(12f, 104f); lineTo(30f, 124f); close() }, H_BLACK)
            }
        }
        1 -> { // 梅
            drawLine(Color(0xFF3A2414), Offset(10f, 150f), Offset(70f, 20f), 6f, cap = StrokeCap.Round)
            drawLine(Color(0xFF3A2414), Offset(42f, 82f), Offset(90f, 60f), 4f, cap = StrokeCap.Round)
            for ((x, y) in listOf(66f to 30f, 54f to 56f, 80f to 62f, 34f to 98f, 22f to 128f, 60f to 76f)) flower(x, y, 10f, H_RED, H_YELLOW)
            if (card == 4) bird(56f, 120f, 1.1f, Color(0xFF6B8A2E), Color(0xFF4E6A1E)) // 鶯
        }
        2 -> { // 桜
            for ((x, y) in listOf(22f to 24f, 46f to 18f, 72f to 26f, 32f to 46f, 60f to 44f, 84f to 50f, 18f to 66f, 46f to 70f)) flower(x, y, 11f, H_PINK, Color(0xFFD94A6A))
            if (card == 8) { // 幕
                for (i in 0 until 6) drawRect(if (i % 2 == 0) H_RED else H_WHITE, Offset(i * 17f, 100f), Size(17f, 62f))
                drawRect(H_BLACK, Offset(0f, 98f), Size(HW, 4f))
            }
        }
        3 -> { // 藤
            for ((x, len) in listOf(22f to 70f, 50f to 90f, 78f to 64f)) {
                drawLine(Color(0xFF3A2414), Offset(x, 0f), Offset(x, 8f), 3f)
                for (j in 0 until (len / 10).toInt()) blob(x + (if (j % 2 == 0) -3f else 3f), 12f + j * 9f, 6.5f - j * 0.3f, H_PURPLE)
            }
            drawLine(H_BLACK, Offset(0f, 150f), Offset(100f, 132f), 5f)
            if (card == 12) bird(50f, 130f, 1.1f, Color(0xFF3A3A44), H_BLACK) // ホトトギス
        }
        4 -> { // 菖蒲
            for (x in listOf(18f, 34f, 66f, 84f)) drawLine(H_GREEN, Offset(x, 162f), Offset(x + 6f, 70f), 5f, cap = StrokeCap.Round)
            for ((x, y) in listOf(26f to 64f, 74f to 58f, 50f to 44f)) {
                drawOval(H_PURPLE, Offset(x - 10f, y - 6f), Size(20f, 18f))
                drawOval(H_PURPLE, Offset(x - 14f, y + 6f), Size(12f, 16f)); drawOval(H_PURPLE, Offset(x + 2f, y + 6f), Size(12f, 16f))
                blob(x, y + 4f, 2.5f, H_YELLOW)
            }
            if (card == 16) { // 八橋
                for (i in 0 until 3) drawRect(H_BROWN, Offset(4f + i * 32f, 120f - i * 10f), Size(30f, 8f))
                for (i in 0 until 4) drawRect(Color(0xFF4A2E1A), Offset(6f + i * 30f, 126f - i * 10f), Size(4f, 26f))
            }
        }
        5 -> { // 牡丹
            for ((x, y) in listOf(22f to 120f, 78f to 118f, 50f to 140f)) drawOval(H_GREEN, Offset(x - 18f, y - 12f), Size(36f, 24f))
            flower(50f, 82f, 30f, H_RED, H_YELLOW, 7)
            blob(50f, 82f, 10f, Color(0xFFE05A50))
            if (card == 20) { // 蝶
                for (sx in listOf(-1f, 1f)) {
                    drawOval(Color(0xFF3A4FA3), Offset(50f + sx * 12f - 9f, 26f), Size(18f, 16f))
                    drawOval(Color(0xFF6A7FD0), Offset(50f + sx * 10f - 6f, 40f), Size(12f, 12f))
                }
                drawLine(H_BLACK, Offset(50f, 24f), Offset(50f, 52f), 2.5f)
            }
        }
        6 -> { // 萩
            for (i in 0 until 5) {
                val x0 = 10f + i * 20f
                drawArc(Color(0xFF3A2414), 200f, 120f, false, Offset(x0 - 10f, 40f), Size(40f, 120f), style = Stroke(2.5f))
                for (j in 0 until 4) blob(x0 + 6f + j * 3f, 60f + j * 18f, 4.5f, Color(0xFFB0306A))
            }
            if (card == 24) { // 猪
                drawOval(H_BROWN, Offset(18f, 104f), Size(64f, 34f))
                blob(80f, 116f, 10f, H_BROWN)
                for (x in listOf(28f, 40f, 62f, 72f)) drawLine(Color(0xFF4A2E1A), Offset(x, 132f), Offset(x, 148f), 4f)
                blob(84f, 112f, 1.6f, H_BLACK)
            }
        }
        7 -> { // 芒
            if (card == 28) blob(50f, 52f, 30f, H_WHITE) // 月
            if (card == 29) for ((x, y) in listOf(30f to 30f, 52f to 22f, 72f to 36f)) {
                drawLine(H_BLACK, Offset(x - 9f, y - 5f), Offset(x, y), 3f); drawLine(H_BLACK, Offset(x, y), Offset(x + 9f, y - 5f), 3f)
            }
            drawPath(Path().apply { moveTo(0f, 162f); lineTo(0f, 102f); quadraticBezierTo(50f, 70f, 100f, 100f); lineTo(100f, 162f); close() }, Color(0xFF1C1C22))
            for (x in listOf(20f, 50f, 80f)) drawLine(Color(0xFF6A6A70), Offset(x, 110f), Offset(x + 8f, 80f), 2.5f)
        }
        8 -> { // 菊
            flower(50f, 70f, 28f, H_YELLOW, Color(0xFFB07A10), 12)
            flower(24f, 120f, 14f, H_YELLOW, Color(0xFFB07A10), 10)
            flower(78f, 118f, 14f, H_YELLOW, Color(0xFFB07A10), 10)
            if (card == 32) { // 盃
                drawOval(H_RED, Offset(22f, 112f), Size(56f, 22f))
                drawOval(Color(0xFFE6B21F), Offset(30f, 114f), Size(40f, 10f))
                drawRect(H_RED, Offset(42f, 132f), Size(16f, 10f))
            }
        }
        9 -> { // 紅葉
            for ((x, y, r) in listOf(listOf(26f, 34f, 20f), listOf(70f, 26f, 21f), listOf(48f, 66f, 20f), listOf(82f, 74f, 16f), listOf(20f, 90f, 17f))) mapleLeaf(x, y, r, if (x > 60f) Color(0xFFD9542A) else H_RED, (x * 3) % 40 - 20)
            if (card == 36) { // 鹿
                drawOval(H_BROWN, Offset(22f, 110f), Size(52f, 26f))
                drawLine(H_BROWN, Offset(68f, 118f), Offset(78f, 96f), 7f, cap = StrokeCap.Round)
                blob(80f, 94f, 7f, H_BROWN)
                drawLine(Color(0xFF4A2E1A), Offset(80f, 88f), Offset(74f, 74f), 2.5f); drawLine(Color(0xFF4A2E1A), Offset(82f, 88f), Offset(90f, 74f), 2.5f)
                for (x in listOf(28f, 38f, 60f, 68f)) drawLine(Color(0xFF4A2E1A), Offset(x, 132f), Offset(x, 150f), 3f)
            }
        }
        10 -> { // 柳
            for (x in listOf(20f, 44f, 70f, 90f)) {
                drawLine(Color(0xFF3A2414), Offset(x, 0f), Offset(x - 6f, 90f), 2f)
                for (j in 0 until 6) drawOval(Color(0xFF4E8A3A), Offset(x - 8f - j, 10f + j * 14f), Size(8f, 12f))
            }
            if (card == 40) { // 小野道風(傘の人)
                drawArc(H_YELLOW, 180f, 180f, true, Offset(30f, 92f), Size(44f, 30f))
                drawLine(H_BLACK, Offset(52f, 106f), Offset(52f, 146f), 2f)
                drawPath(Path().apply { moveTo(38f, 148f); lineTo(46f, 112f); lineTo(60f, 112f); lineTo(66f, 148f); close() }, H_RED)
                for (i in 0 until 6) drawLine(Color(0x99FFFFFF), Offset(10f + i * 16f, 20f), Offset(4f + i * 16f, 70f), 1.2f)
            }
            if (card == 41) { // 燕
                drawPath(Path().apply { moveTo(30f, 110f); lineTo(70f, 120f); lineTo(30f, 130f); lineTo(44f, 120f); close() }, H_BLACK)
                blob(70f, 119f, 5f, H_BLACK); blob(72f, 122f, 2f, H_RED)
            }
            if (card == 43) { // 雷(カス)
                drawRect(Color(0xFF3A3F4A), Offset(0f, 0f), Size(HW, 50f))
                drawPath(Path().apply { moveTo(50f, 8f); lineTo(40f, 32f); lineTo(52f, 30f); lineTo(44f, 50f); lineTo(62f, 24f); lineTo(50f, 26f); close() }, H_YELLOW)
            }
        }
        else -> { // 桐
            for ((x, y) in listOf(30f to 120f, 70f to 120f, 50f to 138f)) drawOval(H_GREEN, Offset(x - 22f, y - 16f), Size(44f, 32f))
            for ((x, len) in listOf(30f to 4, 50f to 5, 70f to 4)) for (j in 0 until len) blob(x, 30f + j * 10f, 6f, H_PURPLE)
            if (card == 44) { // 鳳凰
                drawOval(H_RED, Offset(24f, 48f), Size(52f, 30f))
                for (i in 0 until 4) drawLine(listOf(H_RED, H_GREEN, H_BLUE, H_RED)[i], Offset(30f, 64f), Offset(6f + i * 6f, 96f + i * 4f), 4f, cap = StrokeCap.Round)
                blob(74f, 52f, 8f, H_RED); blob(76f, 50f, 2f, H_BLACK)
            }
        }
    }
    // 短冊
    when (card) {
        1, 5, 9 -> ribbon(H_RED, poem = true)
        13, 17, 25, 42 -> ribbon(H_RED, poem = false)
        21, 33, 37 -> ribbon(H_BLUE, poem = false)
    }
    // 月の数(左上の小さな札。植物を覚えていなくても月が分かるように)
    drawRoundRect(Color(0xCC15151A), Offset(6f, 6f), Size(22f, 20f), CornerRadius(5f))
    drawMonthNumber(m + 1)
}

/** 月の数を細い線の数字で描く(TextMeasurer なしで描けるように、7つの線の数字) */
private fun DrawScope.drawMonthNumber(n: Int) {
    val segs = mapOf(
        0 to "abcdef", 1 to "bc", 2 to "abdeg", 3 to "abcdg", 4 to "bcfg", 5 to "acdfg", 6 to "acdefg", 7 to "abc", 8 to "abcdefg", 9 to "abcdfg",
    )
    val digits = n.toString()
    val dw = 6f; val dh = 12f
    val x0 = 17f - digits.length * (dw + 2f) / 2f
    digits.forEachIndexed { i, ch ->
        val x = x0 + i * (dw + 2f); val y = 10f
        val s = segs[ch - '0'] ?: ""
        fun seg(a: Offset, b: Offset) = drawLine(Color.White, a, b, 1.8f, cap = StrokeCap.Round)
        if ('a' in s) seg(Offset(x, y), Offset(x + dw, y))
        if ('b' in s) seg(Offset(x + dw, y), Offset(x + dw, y + dh / 2))
        if ('c' in s) seg(Offset(x + dw, y + dh / 2), Offset(x + dw, y + dh))
        if ('d' in s) seg(Offset(x, y + dh), Offset(x + dw, y + dh))
        if ('e' in s) seg(Offset(x, y + dh / 2), Offset(x, y + dh))
        if ('f' in s) seg(Offset(x, y), Offset(x, y + dh / 2))
        if ('g' in s) seg(Offset(x, y + dh / 2), Offset(x + dw, y + dh / 2))
    }
}
