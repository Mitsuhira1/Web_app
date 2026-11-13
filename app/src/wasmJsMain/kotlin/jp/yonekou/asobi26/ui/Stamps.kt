package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.Compat

// =====================================================================
// スタンプ16種類(通信対戦のチャット)。見本(asobi の「チャットとスタンプの見本」)と同じ形を、
// 72×72 の座標で書いた図形の並びから描く。絵は円・だ円・四角・線の形(path)・字だけで、画像ファイルは使わない。
// =====================================================================

class Stamp(val label: String, val svg: String)

val STAMPS: List<Stamp> = listOf(
    Stamp("よろしく", """<circle cx="36" cy="36" r="30" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><path d="M23 33q5-8 10 0M39 33q5-8 10 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><path d="M24 43q12 14 24 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="42" r="4" fill="#F29B8A" opacity=".7"/><circle cx="51" cy="42" r="4" fill="#F29B8A" opacity=".7"/>"""),
    Stamp("いい手！", """<rect x="12" y="34" width="14" height="28" rx="3" fill="var(--felt)" stroke="var(--walnut)" stroke-width="2.2"/><path d="M28 36l7-20q3-6 8-2 3 3 1 8l-3 8h15q6 1 5 7l-4 18q-1 5-7 5H28z" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M34 46h18M33 53h17" stroke="var(--walnut)" stroke-width="2" stroke-linecap="round" opacity=".5"/><path d="M52 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--gold)"/>"""),
    Stamp("ありがとう", """<path d="M36 62C8 42 12 14 36 27 60 14 64 42 36 62z" fill="var(--red)" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 26q4-6 10-3" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>"""),
    Stamp("うれしい", """<circle cx="36" cy="38" r="28" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><path d="M22 33q5-8 10 0M40 33q5-8 10 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><path d="M22 42q14 0 28 0q-2 16-14 16T22 42z" fill="#7A2E22" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M29 54q7-6 14 0" fill="#F29B8A"/><path d="M10 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM60 8l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="var(--gold)"/>"""),
    Stamp("ぐぬぬ", """<circle cx="36" cy="38" r="28" fill="#F2A58F" stroke="var(--walnut)" stroke-width="2.4"/><path d="M21 28l12 5M51 28l-12 5" stroke="var(--walnut)" stroke-width="3.2" stroke-linecap="round"/><path d="M23 38h9M40 38h9" stroke="var(--walnut)" stroke-width="3.2" stroke-linecap="round"/><path d="M22 52q4-6 7 0t7 0 7 0 7 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><path d="M54 10l-3 6M60 14l-5 4" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/>"""),
    Stamp("うーん", """<circle cx="36" cy="40" r="26" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><path d="M22 31l10-3M40 28l10 3" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="38" r="2.6" fill="var(--walnut)"/><circle cx="44" cy="38" r="2.6" fill="var(--walnut)"/><path d="M28 52h16" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><text x="52" y="22" font-size="20" font-weight="900" fill="var(--gold)" font-family="Zen Maru Gothic,sans-serif">?</text>"""),
    Stamp("まいった", """<path d="M18 66V8" stroke="var(--walnut)" stroke-width="4" stroke-linecap="round"/><path d="M20 12q12-6 22 0t22 0v26q-10 6-22 0t-22 0z" fill="#fff" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 24q8-3 16 0t16 0" fill="none" stroke="var(--line)" stroke-width="2"/>"""),
    Stamp("待って", """<rect x="16" y="22" width="9" height="26" rx="4.5" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.2" transform="rotate(-12 20 40)"/><rect x="26" y="10" width="9" height="34" rx="4.5" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.2"/><rect x="36" y="8" width="9" height="36" rx="4.5" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.2"/><rect x="46" y="12" width="9" height="32" rx="4.5" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.2"/><path d="M16 38q-4 8 6 22h26q8-6 8-18V30H20z" fill="var(--skin)" stroke="var(--walnut)" stroke-width="2.2" stroke-linejoin="round"/><path d="M60 52q4-2 6 2" stroke="var(--gold)" stroke-width="3" stroke-linecap="round" fill="none"/>"""),
    Stamp("ごめん", """<circle cx="34" cy="40" r="26" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><path d="M22 34l8 3-8 3M46 34l-8 3 8 3" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 52q8-5 16 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><path d="M58 14q-8 12-3 18a6 6 0 0 0 10 -4q0-7-7-14z" fill="#7DB8E8" stroke="var(--walnut)" stroke-width="2"/>"""),
    Stamp("GG", """<path d="M20 12h32v14q0 14-16 18-16-4-16-18z" fill="var(--gold)" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 16h-8q0 14 10 16M52 16h8q0 14-10 16" fill="none" stroke="var(--walnut)" stroke-width="2.4" stroke-linecap="round"/><path d="M36 44v10M26 60h20M28 54h16v6H28z" fill="var(--gold)" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 18q-1 8 4 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>"""),
    Stamp("おどろき", """<circle cx="36" cy="40" r="26" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><circle cx="26" cy="36" r="5.5" fill="#fff" stroke="var(--walnut)" stroke-width="2"/><circle cx="46" cy="36" r="5.5" fill="#fff" stroke="var(--walnut)" stroke-width="2"/><circle cx="26" cy="37" r="2" fill="var(--walnut)"/><circle cx="46" cy="37" r="2" fill="var(--walnut)"/><ellipse cx="36" cy="53" rx="5" ry="6.5" fill="#7A2E22" stroke="var(--walnut)" stroke-width="2.2"/><path d="M12 14l4 8M60 14l-4 8M36 4v8" stroke="var(--red)" stroke-width="3.2" stroke-linecap="round"/>"""),
    Stamp("はやく", """<path d="M20 8h32M20 64h32" stroke="var(--walnut)" stroke-width="4.5" stroke-linecap="round"/><path d="M23 10q0 20 13 26-13 6-13 26M49 10q0 20-13 26 13 6 13 26" fill="#fff4" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 58q9-10 18 0z" fill="var(--gold)"/><path d="M31 18h10q-3 8-5 10-2-2-5-10z" fill="var(--gold)"/>"""),
    Stamp("がんばれ", """<path d="M36 6q4 12 14 20t6 24q-2 14-20 16-18-2-20-16 0-10 8-16-1 8 4 10 0-10 8-38z" fill="#F08A2E" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M36 34q4 8 10 14t-2 14q-8 4-14-2t-2-12q4 2 6 0 0-6 2-14z" fill="var(--gold)"/><path d="M36 50q5 5 3 9-4 3-7 0t4-9z" fill="#FFF3C4"/>"""),
    Stamp("おつかれ", """<path d="M12 30h38v14q0 14-19 14T12 44z" fill="#fff" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M50 34h6q6 0 6 6t-6 6h-7" fill="none" stroke="var(--walnut)" stroke-width="2.4"/><path d="M12 34h38" stroke="var(--felt)" stroke-width="5"/><path d="M24 22q-4-6 0-10t0-8M36 22q-4-6 0-10t0-8" stroke="var(--sub)" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M8 64h46" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/>"""),
    Stamp("ねむい", """<circle cx="32" cy="42" r="26" fill="var(--face)" stroke="var(--walnut)" stroke-width="2.4"/><path d="M19 38q5 5 10 0M35 38q5 5 10 0" fill="none" stroke="var(--walnut)" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="54" rx="4" ry="3" fill="#7A2E22" stroke="var(--walnut)" stroke-width="1.8"/><text x="50" y="22" font-size="16" font-weight="900" fill="var(--sub)" font-family="Zen Maru Gothic,sans-serif">z</text><text x="58" y="12" font-size="11" font-weight="900" fill="var(--sub)" font-family="Zen Maru Gothic,sans-serif">z</text>"""),
    Stamp("やったー", """<path d="M8 64L22 24l26 26z" fill="var(--gold)" stroke="var(--walnut)" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 46l14 10M20 36l16 12" stroke="var(--walnut)" stroke-width="2" opacity=".5"/><path d="M34 18q8-6 6-14M44 30q10-2 14-10M42 20q4 2 6-2" fill="none" stroke="var(--red)" stroke-width="2.6" stroke-linecap="round"/><circle cx="52" cy="12" r="3" fill="var(--felt)"/><circle cx="60" cy="30" r="3" fill="var(--red)"/><circle cx="46" cy="6" r="2.5" fill="#7DB8E8"/><rect x="56" y="40" width="6" height="6" fill="var(--gold)" transform="rotate(25 59 43)"/>"""),
)

/** 図形1つ分(読み込みは1回だけ) */
private class Shape(val tag: String, val attrs: Map<String, String>, val text: String) {
    val path: Path? by lazy { if (tag == "path") PathParser().parsePathString(attrs["d"] ?: "").toPath() else null }
}

private val shapeCache = HashMap<Int, List<Shape>>()
private val TAG = Regex("<(circle|ellipse|rect|path|text)\\b([^>]*?)(?:/>|>([^<]*)</text>)")
private val ATTR = Regex("([a-zA-Z-]+)=\"([^\"]*)\"")

private fun shapesOf(i: Int): List<Shape> = synchronized(shapeCache) {
    shapeCache.getOrPut(i) {
        TAG.findAll(STAMPS[i].svg).map { m ->
            Shape(m.groupValues[1], ATTR.findAll(m.groupValues[2]).associate { it.groupValues[1] to it.groupValues[2] }, m.groupValues[3])
        }.toList()
    }
}

/** 図形の色の名前(見本の var(--…))。ライトとダークで色が変わる */
private fun stampColor(name: String, dark: Boolean): Color? {
    val v = name.trim()
    if (v == "none") return null
    if (v.startsWith("var(")) {
        val k = v.removePrefix("var(--").removeSuffix(")")
        return when (k) {
            "face" -> if (dark) Color(0xFFE8C463) else Color(0xFFF6D77A)
            "skin" -> if (dark) Color(0xFFD9A97C) else Color(0xFFF2C79A)
            "walnut" -> if (dark) Color(0xFFE9D9BE) else Color(0xFF4A3220)
            "felt" -> if (dark) Color(0xFF3F8A66) else Color(0xFF2F6B4E)
            "gold" -> if (dark) Color(0xFFE0B354) else Color(0xFFC79A2E)
            "red" -> if (dark) Color(0xFFE5574F) else Color(0xFFC8322B)
            "line" -> if (dark) Color(0xFF3C3128) else Color(0xFFDDD1BA)
            "sub" -> if (dark) Color(0xFFB8A992) else Color(0xFF7B6B58)
            else -> Color.Magenta
        }
    }
    if (v.startsWith("#")) {
        val h = v.drop(1)
        val full = when (h.length) { 3 -> h.map { "$it$it" }.joinToString("") + "FF"; 4 -> h.map { "$it$it" }.joinToString(""); 6 -> h + "FF"; else -> return Color.Magenta }
        val r = full.substring(0, 2).toInt(16); val g = full.substring(2, 4).toInt(16); val b = full.substring(4, 6).toInt(16); val a = full.substring(6, 8).toInt(16)
        return Color(r, g, b, a)
    }
    return Color.Magenta
}

private fun num(s: String?, d: Float = 0f): Float = s?.toFloatOrNull() ?: d

/** スタンプ i を、1辺 sizePx の正方形に描く。文字(?・z)は measurer で測って描く */
fun DrawScope.drawStamp(i: Int, dark: Boolean, tm: TextMeasurer, sizePx: Float, alpha: Float = 1f) {
    val k = sizePx / 72f
    for (s in shapesOf(i)) {
        val a = s.attrs
        val fill = stampColor(a["fill"] ?: if (s.tag == "text") "#000" else "#000", dark)
        val strokeColor = a["stroke"]?.let { stampColor(it, dark) }
        val sw = num(a["stroke-width"], 1f)
        val op = num(a["opacity"], 1f) * alpha
        val cap = when (a["stroke-linecap"]) { "round" -> StrokeCap.Round; "square" -> StrokeCap.Square; else -> StrokeCap.Butt }
        val join = when (a["stroke-linejoin"]) { "round" -> StrokeJoin.Round; "bevel" -> StrokeJoin.Bevel; else -> StrokeJoin.Miter }
        val style = Stroke(sw, cap = cap, join = join)
        val rot = a["transform"]?.let { Regex("rotate\\(([-0-9.]+) ([-0-9.]+) ([-0-9.]+)\\)").find(it)?.groupValues?.drop(1)?.map { v -> v.toFloat() } }
        fun body() {
            when (s.tag) {
                "circle" -> {
                    val c = Offset(num(a["cx"]), num(a["cy"])); val r = num(a["r"])
                    fill?.let { drawCircle(it, r, c, alpha = op) }
                    strokeColor?.let { drawCircle(it, r, c, alpha = op, style = style) }
                }
                "ellipse" -> {
                    val cx = num(a["cx"]); val cy = num(a["cy"]); val rx = num(a["rx"]); val ry = num(a["ry"])
                    fill?.let { drawOval(it, Offset(cx - rx, cy - ry), Size(2 * rx, 2 * ry), alpha = op) }
                    strokeColor?.let { drawOval(it, Offset(cx - rx, cy - ry), Size(2 * rx, 2 * ry), alpha = op, style = style) }
                }
                "rect" -> {
                    val tl = Offset(num(a["x"]), num(a["y"])); val sz = Size(num(a["width"]), num(a["height"])); val rr = CornerRadius(num(a["rx"]))
                    fill?.let { drawRoundRect(it, tl, sz, rr, alpha = op) }
                    strokeColor?.let { drawRoundRect(it, tl, sz, rr, alpha = op, style = style) }
                }
                "path" -> s.path?.let { p ->
                    fill?.let { drawPath(p, it, alpha = op) }
                    strokeColor?.let { drawPath(p, it, alpha = op, style = style) }
                }
            }
        }
        if (s.tag == "text") {
            val fs = num(a["font-size"], 16f) * k
            val bold = a["font-weight"]?.toIntOrNull()?.let { it >= 700 } ?: false
            val lay = textLayout(tm, s.text, fs, fill ?: Color.Black, bold)
            drawText(lay, topLeft = Offset(num(a["x"]) * k, num(a["y"]) * k - lay.firstBaseline), alpha = op)
            continue
        }
        scale(k, k, pivot = Offset.Zero) {
            if (rot != null && rot.size == 3) rotate(rot[0], Offset(rot[1], rot[2])) { body() } else body()
        }
    }
}

private val textCache = LruMap<String, TextLayoutResult>(32)

private fun DrawScope.textLayout(tm: TextMeasurer, text: String, fsPx: Float, color: Color, bold: Boolean): TextLayoutResult {
    val key = "$text|${(fsPx * 2).toInt()}|${color.value}|$bold|${System.identityHashCode(tm)}"
    synchronized(textCache) { textCache[key] }?.let { return it }
    val lay = tm.measure(text, TextStyle(color = color, fontSize = (fsPx / density / fontScale).sp, fontWeight = if (bold) FontWeight.Black else FontWeight.Normal))
    synchronized(textCache) { textCache[key] = lay }
    return lay
}

/** スタンプの絵(正方形) */
@Composable
fun StampArt(index: Int, size: Dp, modifier: Modifier = Modifier) {
    val dark = LocalAsobi.current.dark
    val tm = rememberTextMeasurer()
    Canvas(modifier.size(size)) { if (index in STAMPS.indices) drawStamp(index, dark, tm, this.size.minDimension) }
}

/** 試験用: 数が Compat と合っている */
internal val STAMP_COUNT_OK: Boolean get() = STAMPS.size == Compat.STAMP_COUNT
