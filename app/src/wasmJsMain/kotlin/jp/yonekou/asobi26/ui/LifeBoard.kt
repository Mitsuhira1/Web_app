package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Life
import jp.yonekou.asobi26.core.games.LifeBoardData
import jp.yonekou.asobi26.core.games.LifeData
import jp.yonekou.asobi26.core.games.LifePlayer
import jp.yonekou.asobi26.core.games.LifeSquare
import jp.yonekou.asobi26.core.games.LifeState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// =====================================================================
// 人生すごろく(盤の色・形は docs/life/盤面見本.html から取る。盤の色は印刷なのでテーマに合わせない)
// =====================================================================

private const val CW = 156f
private const val CH = 112f
private const val MG = 44f
private val LINE = Color(0xFF4A3520)
private val CREAM = Color(0xFFFFF8DC)
private val INK = Color(0xFF2B1D10)
private val GET = Color(0xFF1257B8)
private val LOSE = Color(0xFFC9281C)
private val STOP_RED = Color(0xFFC9281C)
private val YELLOW = Color(0xFFFFD94F)
val LIFE_COLORS = listOf(Color(0xFFE2574C), Color(0xFF4A7FD0), Color(0xFFF4D35E), Color(0xFF3FAE62), Color(0xFF7A4CC2), Color(0xFFF08A3C))
private val WHEEL = listOf(0xFFE2574C, 0xFFF2A541, 0xFFF4D35E, 0xFF7CC576, 0xFF3FA7B5, 0xFF4A7FD0, 0xFF7A4CC2, 0xFFC24C9A, 0xFFE88AA0, 0xFF8FD3C8).map { Color(it) }
/** 谷の格の色(地・枠・山) */
private val GRADE_BG = listOf(Color(0xFFF6CF57), Color(0xFFCFD8F4), Color(0xFFF7B3D9))
private val GRADE_EDGE = listOf(Color(0xFFC9952B), Color(0xFF8E9CCB), Color(0xFFB0468A))
private val GRADE_HILL = listOf(Color(0xFFE0A92F), Color(0xFFAAB6E0), Color(0xFFE585BD))

private fun px(c: Float) = MG + c * CW
private fun py(r: Float) = MG + r * CH
private fun boardW(b: LifeBoardData) = MG * 2 + CW * b.cols
private fun boardH(b: LifeBoardData) = MG * 2 + CH * b.rows

/** 席の名前を入れた出来事の文([k] を名前に) */
private fun lifeLine(ses: Session<LifeState>, line: String): String =
    Regex("\\[(\\d)]").replace(line) { seatLabel(ses, it.groupValues[1].toInt()) }

/** 金額と「もらう」「はらう」に色を付ける */
private fun moneyText(text: String, base: Color = INK, money: Color = base): AnnotatedString = buildAnnotatedString {
    val re = Regex("\\$[\\d,]+|もらう|はらう|もらえる")
    var at = 0
    for (m in re.findAll(text)) {
        withStyle(SpanStyle(color = base)) { append(text.substring(at, m.range.first)) }
        val color = when (m.value) { "もらう", "もらえる" -> GET; "はらう" -> LOSE; else -> money }
        withStyle(SpanStyle(color = color, fontWeight = FontWeight.Black)) { append(m.value) }
        at = m.range.last + 1
    }
    withStyle(SpanStyle(color = base)) { append(text.substring(at)) }
}

/** マスの見出し・地の色 */
private class TileLook(val bg: Color, val head: String, val headColor: Color, val fg: Color = INK, val edge: Color = LINE)

private fun look(q: LifeSquare, grade: Int): TileLook = when (q.type) {
    "payday" -> TileLook(Color(0xFFE23B2E), "給料日", Color.White, Color.White, Color(0xFF7A130C))
    "job" -> TileLook(Color(0xFFC9EFCF), "就職", Color(0xFF17663A))
    "rank" -> TileLook(Color(0xFFC9EFCF), if (grade == 0) "ランクアップ!" else "転職!", Color(0xFF17663A))
    "ticket" -> TileLook(Color(0xFFE6D8FF), "ゆめチケット", Color(0xFF5A2AA8))
    "child" -> TileLook(Color(0xFFFFCFE0), "ファミリー", Color(0xFFB5235F))
    "house" -> TileLook(Color(0xFFFFE7A3), "マイホーム", Color(0xFF8A5A00))
    "treasure", "treasureBuy", "treasurePick", "dokkanReturn", "dokkanPass" -> TileLook(YELLOW, "お宝", Color(0xFF7A4A00))
    "gamble" -> TileLook(Color(0xFFA9E5D6), "運だめし", Color(0xFF0D6351))
    "hap" -> TileLook(Color(0xFF2F3542), "ハプニング!", YELLOW, Color.White, Color(0xFF11141B))
    "bonus" -> TileLook(Color(0xFFFF9BD6), "ぴったりボーナス", Color(0xFF8A0F5C))
    "giveAll", "giveRight" -> TileLook(CREAM, "ふるまい", Color(0xFF8A2B12))
    "start" -> TileLook(Color(0xFF2F9E56), "スタート", Color.White, Color.White, Color(0xFF0F4D26))
    "stop" -> TileLook(Color.White, "ストップ!", Color.White, STOP_RED, STOP_RED)
    "goal" -> TileLook(YELLOW, "ゴール!", Color.White, STOP_RED, STOP_RED)
    else -> TileLook(CREAM, "", INK)
}

/** 止まった時のカードに出す文 */
fun lifeSquareText(q: LifeSquare, grade: Int): String = when (q.type) {
    "job" -> LifeData.JOBS[q.job].let { "${it.name}になれる。給料 $${Life.fmt(it.salary)}" }
    "payday" -> "給料日。給料をもらう。" + if (q.freeterCut) "ここまでに職業がない人はフリーター。" else ""
    "stop" -> when (q.kind) {
        "marriage" -> "結婚! ルーレットを回し、出た数×$1,000を全員からお祝いにもらう。1〜7は近場コース、8〜10は世界コース。"
        "valley" -> "ゆめの谷の入り口。ゆめチケットを0〜2枚使って谷の格を決める(1枚でプラチナ、2枚でレジェンド)。ルーレットの1〜7はお金コース、8〜10はお宝コース。"
        "gate" -> "チャンスゲート。ゆめチケット1枚で、ランクアップ・転職・フリーターの就職のどれか1つができる。"
        "settle" -> "ふもとの精算所。子ども1人につき$50,000もらい、約束手形を1枚$25,000で返す。"
        else -> q.textAt(grade)
    }
    else -> q.textAt(grade)
}

@Composable
private fun SquareTile(q: LifeSquare, grade: Int, owner: Int) {
    val l = look(q, grade)
    val big = q.type in setOf("payday", "start", "stop", "goal", "job", "bonus")
    Box(
        Modifier.offset(px(q.x.toFloat()).dp - 1.5.dp, py(q.row.toFloat()).dp - 1.5.dp).size((CW + 3).dp, (CH + 3).dp)
            .then(if (q.type == "stop" || q.type == "goal") Modifier.border(3.dp, if (q.type == "goal") Color.White else YELLOW).padding(3.dp).border(3.dp, LINE) else Modifier)
            .background(l.bg).border(if (q.type == "stop" || q.type == "goal") 4.dp else 3.dp, l.edge)
            .padding(horizontal = 6.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = if (big) Alignment.CenterHorizontally else Alignment.Start) {
            when (q.type) {
                "payday", "start" -> {
                    Text(l.head, color = l.fg, fontSize = 24.sp, fontWeight = FontWeight.Black, lineHeight = 26.sp)
                    val sub = if (q.type == "start") q.text else q.note
                    if (sub.isNotEmpty()) Text(sub, color = l.fg, fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, lineHeight = 13.sp)
                }
                "stop", "goal" -> {
                    Text(l.head, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(STOP_RED).padding(horizontal = 10.dp))
                    Text(q.text, color = STOP_RED, fontSize = if (q.text.length > 6) 16.sp else 19.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, lineHeight = 20.sp)
                }
                "job" -> {
                    val j = LifeData.JOBS[q.job]
                    Text(l.head, color = l.headColor, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(j.name, color = INK, fontSize = if (j.name.length > 6) 13.sp else 17.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, lineHeight = 17.sp)
                    Text("給料 $${Life.fmt(j.salary)}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xFF17663A)).padding(horizontal = 8.dp))
                }
                "bonus" -> Text(l.head, color = l.headColor, fontSize = 15.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, lineHeight = 17.sp)
                else -> {
                    if (l.head.isNotEmpty()) Text(l.head, color = l.headColor, fontSize = if (q.type == "hap") 13.sp else 10.5.sp, fontWeight = FontWeight.Black, lineHeight = 13.sp)
                    Text(moneyText(q.textAt(grade), l.fg, if (q.type == "hap") YELLOW else l.fg), fontSize = 11.5.sp, fontWeight = FontWeight.Bold, lineHeight = 15.sp, overflow = TextOverflow.Clip)
                }
            }
        }
        if (q.ticketMark) Text("ゆめ券", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black,
            modifier = Modifier.align(Alignment.TopEnd).rotate(8f).clip(RoundedCornerShape(4.dp)).background(Color(0xFF7A3FC4)).padding(horizontal = 3.dp))
        if (owner >= 0) Box(Modifier.align(Alignment.TopEnd).size(14.dp).clip(CircleShape).background(LIFE_COLORS[owner]).border(2.dp, LINE, CircleShape))
    }
}

/** 景色の区画(上からの段の範囲) */
private class Band(val zone: String, val top: Float, val bottom: Float)

private fun bands(b: LifeBoardData): List<Band> {
    fun range(vararg zones: String): Pair<Float, Float>? {
        val rows = b.squares.filter { it.zone in zones }.map { it.row }
        return if (rows.isEmpty()) null else rows.min().toFloat() to rows.max().toFloat() + 1f
    }
    val out = ArrayList<Band>()
    val order = listOf(arrayOf("mountain"), arrayOf("foot"), arrayOf("valleyMoney", "valleyTreasure"), arrayOf("field"), arrayOf("near", "world"), arrayOf("town"))
    var prev = 0f
    for ((i, z) in order.withIndex()) {
        val r = range(*z) ?: continue
        val top = if (i == 0) 0f else prev
        val bottom = if (i == order.lastIndex) b.rows.toFloat() else r.second
        out.add(Band(z[0], top, bottom))
        prev = bottom
    }
    return out
}

/** 景色(簡単な形の組み合わせ。マスのない所に、区画ごとの絵を置く) */
private fun DrawScope.lifeScenery(b: LifeBoardData, grade: Int) {
    val k = density
    fun X(c: Float) = px(c) * k
    fun Y(r: Float) = py(r) * k
    val w = size.width
    val st = Stroke(3f * k)
    drawRect(Color(0xFF9AD67C))
    val bs = bands(b)
    fun bandOf(row: Int) = bs.firstOrNull { row >= it.top && row < it.bottom }?.zone ?: "field"
    for (band in bs) {
        val top = if (band.top == 0f) 0f else Y(band.top) - 0.4f * CH * k
        val bottom = if (band.bottom >= b.rows) size.height else Y(band.bottom) - 0.4f * CH * k
        when (band.zone) {
            "mountain" -> {
                drawRect(Color(0xFFBDE6FF), Offset(0f, 0f), Size(w, bottom))
                drawCircle(YELLOW, 46f * k, Offset(X(8.3f), Y(0.5f))); drawCircle(LINE, 46f * k, Offset(X(8.3f), Y(0.5f)), style = st)
                val peak = Path().apply { moveTo(X(1.5f), bottom); lineTo(X(5.5f), Y(-0.15f)); lineTo(X(9.3f), bottom); close() }
                drawPath(peak, Color(0xFF8C9BB5)); drawPath(peak, LINE, style = st)
                val snow = Path().apply { moveTo(X(4.72f), Y(0.7f)); lineTo(X(5.5f), Y(-0.15f)); lineTo(X(6.23f), Y(0.7f)); lineTo(X(5.9f), Y(0.5f)); lineTo(X(5.5f), Y(0.75f)); lineTo(X(5.1f), Y(0.5f)); close() }
                drawPath(snow, Color.White); drawPath(snow, LINE, style = st)
            }
            "foot" -> drawRect(Color(0xFF7CC26A), Offset(0f, top), Size(w, bottom - top))
            "valleyMoney" -> {
                val r = CornerRadius(34f * k)
                drawRoundRect(GRADE_BG[grade], Offset(X(0f) - 18f * k, top + 6f * k), Size(w - 2 * (MG - 18f) * k, bottom - top - 12f * k), r)
                drawRoundRect(GRADE_EDGE[grade], Offset(X(0f) - 18f * k, top + 6f * k), Size(w - 2 * (MG - 18f) * k, bottom - top - 12f * k), r, style = Stroke(8f * k))
            }
            "field" -> drawRect(Color(0xFF9AD67C), Offset(0f, top), Size(w, bottom - top))
            "near" -> {
                drawRect(Color(0xFFB7E08A), Offset(0f, top), Size(X(4.5f), bottom - top))
                drawRect(Color(0xFF6CC5EE), Offset(X(4.5f), top), Size(w - X(4.5f), bottom - top))
            }
            "town" -> drawRect(Color(0xFF8FD06B), Offset(0f, top), Size(w, bottom - top))
        }
    }
    // マスのない所に、区画の絵を置く
    val used = HashSet<Int>()
    for (q in b.squares) used.add(q.row * b.cols + q.x)
    var villageDrawn = false
    var wheelDrawn = false
    for (row in 0 until b.rows) for (c in 0 until b.cols) {
        if (row * b.cols + c in used) continue
        val cx = X(c + 0.5f)
        val cy = Y(row + 0.5f)
        val h = (row * 31 + c * 17) % 7
        when (bandOf(row)) {
            "mountain" -> if (row > 1 && h % 3 == 0) cloud(cx, cy, k * 0.7f)
            "foot" -> if (!villageDrawn && c <= 3) { village(cx, cy, k); villageDrawn = true } else pine(cx, cy + 20f * k, k * (1f + h / 10f))
            "valleyMoney" -> if (c < 5) gold(cx, cy + 10f * k, k, if (grade == 1) Color.White else YELLOW) else gem(cx, cy, k, grade)
            "field" -> if (!wheelDrawn && c >= 5 && row + 1 < b.rows && (row + 1) * b.cols + c !in used) { bigWheel(cx, cy + CH * 0.5f * k, 70f * k, k); wheelDrawn = true; used.add((row + 1) * b.cols + c) }
                else if (h % 2 == 0) house(cx, cy, k, if (h == 0) Color(0xFFE2574C) else Color(0xFF3FA7B5)) else tree(cx, cy, k)
            "near" -> if (c < 4.5f) paddy(cx, cy, k, h) else sea(cx, cy, k, h)
            "town" -> if (h % 3 == 0) tree(cx, cy, k) else house(cx, cy, k, listOf(Color(0xFFE2574C), Color(0xFF3FA7B5), Color(0xFF7A4CC2))[h % 3])
        }
    }
    if (grade == 2) {
        val vb = bs.firstOrNull { it.zone == "valleyMoney" }
        if (vb != null) for (i in 0 until 26) {
            val x = X(0.2f) + ((i * 197) % (CW * 8.6f)) * k
            val y = Y(vb.top) + ((i * 89) % (CH * (vb.bottom - vb.top - 0.6f))) * k
            star(x, y, 6f * k, Color.White)
        }
    }
    drawRoundRect(YELLOW, Offset(6f * k, 6f * k), Size(size.width - 12f * k, size.height - 12f * k), CornerRadius(22f * k), style = Stroke(6f * k))
}

private fun DrawScope.outlined(p: Path, fill: Color) { drawPath(p, fill); drawPath(p, LINE, style = Stroke(3f * density)) }
private fun DrawScope.circleO(c: Offset, r: Float, fill: Color) { drawCircle(fill, r, c); drawCircle(LINE, r, c, style = Stroke(3f * density)) }
private fun DrawScope.rectO(tl: Offset, s: Size, fill: Color) { drawRect(fill, tl, s); drawRect(LINE, tl, s, style = Stroke(3f * density)) }

private fun DrawScope.tree(x: Float, y: Float, k: Float) {
    rectO(Offset(x - 4 * k, y), Size(8 * k, 16 * k), Color(0xFF8A5A2B)); circleO(Offset(x, y - 8 * k), 17 * k, Color(0xFF2F9E56))
}
private fun DrawScope.pine(x: Float, y: Float, k: Float) {
    rectO(Offset(x - 3 * k, y), Size(6 * k, 10 * k), Color(0xFF8A5A2B))
    outlined(Path().apply { moveTo(x, y - 40 * k); lineTo(x + 18 * k, y); lineTo(x - 18 * k, y); close() }, Color(0xFF1F7A45))
}
private fun DrawScope.cloud(x: Float, y: Float, k: Float) {
    for ((dx, dy, r) in listOf(Triple(-18f, -6f, 18f), Triple(12f, -12f, 22f), Triple(30f, 2f, 15f), Triple(-34f, 4f, 13f))) circleO(Offset(x + dx * k, y + dy * k), r * k, Color.White)
    drawOval(Color.White, Offset(x - 43 * k, y - 8 * k), Size(86 * k, 24 * k))
}
private fun DrawScope.house(x: Float, y: Float, k: Float, roof: Color) {
    val w = 70 * k; val h = 46 * k
    rectO(Offset(x - w / 2, y - h / 2 + 10 * k), Size(w, h), Color.White)
    outlined(Path().apply { moveTo(x - w / 2 - 10 * k, y - h / 2 + 10 * k); lineTo(x, y - h / 2 - 22 * k); lineTo(x + w / 2 + 10 * k, y - h / 2 + 10 * k); close() }, roof)
    rectO(Offset(x - 8 * k, y + h / 2 - 14 * k), Size(16 * k, 24 * k), Color(0xFF8A5A2B))
}
private fun DrawScope.paddy(x: Float, y: Float, k: Float, h: Int) {
    for (j in 0..1) drawRoundRect(if ((h + j) % 2 == 0) Color(0xFF8FD06B) else Color(0xFFD9EC7A), Offset(x - 62 * k, y - 40 * k + j * 46 * k), Size(124 * k, 38 * k), CornerRadius(5 * k))
}
private fun DrawScope.sea(x: Float, y: Float, k: Float, h: Int) {
    when (h % 3) {
        0 -> { drawOval(Color(0xFFF1D9A3), Offset(x - 60 * k, y), Size(120 * k, 34 * k)); drawLine(Color(0xFF8A5A2B), Offset(x, y + 16 * k), Offset(x + 4 * k, y - 36 * k), 7 * k)
            circleO(Offset(x + 4 * k, y - 40 * k), 16 * k, Color(0xFF2F9E56)) }
        1 -> { outlined(Path().apply { moveTo(x - 36 * k, y); lineTo(x + 34 * k, y); lineTo(x + 20 * k, y + 26 * k); lineTo(x - 22 * k, y + 26 * k); close() }, Color.White)
            outlined(Path().apply { moveTo(x, y); lineTo(x, y - 44 * k); lineTo(x + 30 * k, y - 8 * k); close() }, YELLOW) }
        else -> for (i in 0..2) drawArc(Color.White, 200f, 140f, false, Offset(x - 50 * k + i * 34 * k, y - 10 * k + (i % 2) * 18 * k), Size(30 * k, 20 * k), style = Stroke(4 * k))
    }
}
private fun DrawScope.gold(x: Float, y: Float, k: Float, c: Color) {
    for ((a, b) in listOf(0f to 0f, 18f to 4f, -17f to 5f, 8f to -12f, -8f to -11f, 0f to -24f)) circleO(Offset(x + a * k, y + b * k), 11 * k, c)
}
private fun DrawScope.gem(x: Float, y: Float, k: Float, grade: Int) {
    outlined(Path().apply { moveTo(x - 14 * k, y + 14 * k); lineTo(x, y - 18 * k); lineTo(x + 14 * k, y + 14 * k); close() }, if (grade == 2) Color(0xFFFF9BD6) else Color(0xFF7DE0FF))
}
private fun DrawScope.star(x: Float, y: Float, r: Float, c: Color) {
    drawPath(Path().apply { moveTo(x, y - r); lineTo(x + r * 0.3f, y - r * 0.3f); lineTo(x + r, y); lineTo(x + r * 0.3f, y + r * 0.3f); lineTo(x, y + r)
        lineTo(x - r * 0.3f, y + r * 0.3f); lineTo(x - r, y); lineTo(x - r * 0.3f, y - r * 0.3f); close() }, c)
}
private fun DrawScope.village(x: Float, y: Float, k: Float) {
    drawOval(Color(0xFFE2C98F), Offset(x - 90 * k, y - 40 * k), Size(180 * k, 90 * k)); drawOval(LINE, Offset(x - 90 * k, y - 40 * k), Size(180 * k, 90 * k), style = Stroke(3 * k))
    for ((dx, s, c) in listOf(Triple(-36f, 1.1f, Color(0xFFFFCFE0)), Triple(30f, 0.9f, Color(0xFFBFE6FF)))) {
        val tx = x + dx * k; val ty = y + 26 * k
        outlined(Path().apply { moveTo(tx, ty - 44 * s * k); lineTo(tx + 36 * s * k, ty); lineTo(tx - 36 * s * k, ty); close() }, c)
    }
}
private fun DrawScope.bigWheel(x: Float, y: Float, r: Float, k: Float) {
    drawCircle(LINE, r + 8 * k, Offset(x, y + 8 * k)); circleO(Offset(x, y), r + 8 * k, Color.White)
    for (i in 0 until 10) drawArc(WHEEL[i], i * 36f - 90f, 36f, true, Offset(x - r, y - r), Size(2 * r, 2 * r))
    drawCircle(LINE, r, Offset(x, y), style = Stroke(3 * k)); circleO(Offset(x, y), r * 0.22f, Color.White)
}

/** 村のコマを置く所(景色の村と同じ場所) */
private fun villageCell(b: LifeBoardData): Pair<Float, Float> {
    val used = b.squares.map { it.row * b.cols + it.x }.toHashSet()
    val bs = bands(b)
    val foot = bs.firstOrNull { it.zone == "foot" } ?: return 0.5f to 0.5f
    for (row in 0 until b.rows) for (c in 0..3) {
        if (row >= foot.top && row < foot.bottom && row * b.cols + c !in used) return c + 0.5f to row + 0.5f
    }
    return 0.5f to foot.top + 0.5f
}

/** コマ */
private fun DrawScope.pawn(x: Float, y: Float, color: Color, k: Float, ring: Boolean) {
    if (ring) drawCircle(Color.White.copy(alpha = 0.6f), 26 * k, Offset(x, y - 6 * k))
    val p = Path().apply {
        moveTo(x - 13 * k, y + 16 * k); quadraticBezierTo(x - 13 * k, y - 4 * k, x - 6 * k, y - 6 * k)
        lineTo(x + 6 * k, y - 6 * k); quadraticBezierTo(x + 13 * k, y - 4 * k, x + 13 * k, y + 16 * k); close()
    }
    drawPath(p, color); drawPath(p, LINE, style = Stroke(3 * k))
    circleO(Offset(x, y - 14 * k), 10 * k, color)
}

/** ルーレット(出た数を中央に出す。回る時は角度を進める) */
@Composable
private fun Roulette(turn: Float, modifier: Modifier) {
    Canvas(modifier) {
        val r = size.minDimension / 2 - 4f
        val c = center
        rotate(turn, c) { for (i in 0 until 10) drawArc(WHEEL[i], i * 36f - 90f, 36f, true, c - Offset(r, r), Size(2 * r, 2 * r)) }
        drawCircle(LINE, r, c, style = Stroke(4f))
        drawCircle(Color.White, r * 0.46f, c); drawCircle(LINE, r * 0.46f, c, style = Stroke(3f))
        drawPath(Path().apply { moveTo(c.x - 9f, c.y - r - 2f); lineTo(c.x + 9f, c.y - r - 2f); lineTo(c.x, c.y - r + 14f); close() }, STOP_RED)
    }
}

private fun spinCount(f: LifeState, t: LifeState) = t.spins - f.spins

@Composable
fun LifeBoard(ses: Session<LifeState>, version: Int, enabled: Boolean, clock: Int, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val g = ses.rules as Life
    val b = g.board
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val spinMs = 700
    val stepMs = 170
    val ma = rememberMoveAnim(ses, onBusy, onStep = { f, t ->
        if (spinCount(f, t) > 0) sfx?.play(Sound.SPIN)
        if (t.path.isNotEmpty()) { delay(spinMs.toLong()); repeat(t.path.size) { delay(stepMs.toLong()); sfx?.play(Sound.PEG, rate = 1f + it * 0.02f, volume = 0.7f) } }
    }) { f, t -> (if (spinCount(f, t) > 0) spinMs else 0) + t.path.size * stepMs + (if (t.log.isNotEmpty()) 250 else 0) }
    val st = ma.to
    val me = viewSeat(ses)
    val legal = if (enabled && ma.done) g.legalMoves(st).toSet() else emptySet()
    val e = ma.elapsed
    // 動いている途中のコマの位置
    val walking = !ma.done && st.path.isNotEmpty()
    val stepIndex = if (walking) ((e - spinMs) / stepMs).toInt().coerceIn(-1, st.path.size - 1) else st.path.size - 1
    fun posOf(i: Int): Int = if (walking && i == st.actor) (if (stepIndex < 0) ma.from.players[i].pos else st.path[stepIndex]) else st.players[i].pos

    var showItems by remember { mutableStateOf(false) }
    var overview by remember(ses) { mutableStateOf(false) }
    // 指や「＋」「−」で盤を動かした後は、番が変わっても自動で追わない(「今いる所」で元に戻す)
    var userMoved by remember(ses) { mutableStateOf(false) }
    var guess by remember(ses, version) { mutableIntStateOf(0) }
    val dens = LocalDensity.current

    Column(Modifier.fillMaxSize().testTag("lifeBoard")) {
        // 上: 全員の持ち金
        val rows = if (g.n > 4) 2 else 1
        val perRow = (g.n + rows - 1) / rows
        for (r in 0 until rows) Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (i in r * perRow until minOf(g.n, (r + 1) * perRow)) {
                val p = st.players[i]
                val on = i == st.turn && !st.over
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(if (on) c.accent.copy(alpha = 0.22f) else c.chip)
                        .border(2.dp, if (on) c.accent else Color.Transparent, RoundedCornerShape(8.dp)).padding(horizontal = 5.dp, vertical = 3.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(9.dp).clip(CircleShape).background(LIFE_COLORS[i]).border(1.5.dp, Color.White, CircleShape))
                        Text(" " + seatLabel(ses, i), color = c.ink, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text("$" + Life.fmt(p.money), color = c.ink, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1)
                    if (p.loans > 0 || p.done) Text(if (p.village) "村" else if (p.finish > 0) "${p.finish}着" else "手形${p.loans}", color = c.sub, fontSize = 9.sp, maxLines = 1)
                }
            }
        }
        // 直前の出来事
        val logText = if (st.log.isEmpty() || st.actor < 0) (if (st.over) "全員が終わりました" else "${seatLabel(ses, st.turn)}の番です")
            else seatLabel(ses, st.actor) + ": " + st.log.joinToString("・") { lifeLine(ses, it) }
        Text(logText, color = c.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(c.surface).padding(horizontal = 8.dp, vertical = 4.dp).testTag("lifeLog"))
        // まん中: 盤
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF3B7F47)).clipToBounds()) {
            val vw = constraints.maxWidth.toFloat()
            val vh = constraints.maxHeight.toFloat()
            val bw = with(dens) { boardW(b).dp.toPx() }
            val bh = with(dens) { boardH(b).dp.toPx() }
            val fitScale = minOf(vw / bw, vh / bh)
            val baseScale = (vw / with(dens) { 360.dp.toPx() }).coerceAtLeast(fitScale)
            val scale = remember(ses) { Animatable(baseScale) }
            val ox = remember(ses) { Animatable(0f) }
            val oy = remember(ses) { Animatable(0f) }
            fun clampX(x: Float, s: Float) = if (bw * s <= vw) (vw - bw * s) / 2 else x.coerceIn(vw - bw * s, 0f)
            fun clampY(y: Float, s: Float) = if (bh * s <= vh) (vh - bh * s) / 2 else y.coerceIn(vh - bh * s, 0f)
            fun cellCenter(i: Int): Offset {
                val p = st.players[i]
                if (p.village && !(walking && i == st.actor)) { val (vx, vy) = villageCell(b); return Offset(px(vx), py(vy)) }
                val q = g.sq[posOf(i)]
                return Offset(px(q.x + 0.5f), py(q.row + 0.5f))
            }
            val focusSeat = if (walking) st.actor else if (st.over) me else st.turn
            val focus = cellCenter(focusSeat)
            // 動いているコマ・番の人を追って盤を動かす
            LaunchedEffect(focus, overview, userMoved) {
                if (userMoved && !overview) return@LaunchedEffect
                if (overview) {
                    scale.animateTo(fitScale, tween(350))
                    ox.animateTo(clampX(0f, fitScale), tween(350)); oy.animateTo(clampY(0f, fitScale), tween(350))
                } else {
                    if (scale.value < baseScale * 0.9f) scale.animateTo(baseScale, tween(300))
                    val s = scale.value
                    val fx = with(dens) { focus.x.dp.toPx() }; val fy = with(dens) { focus.y.dp.toPx() }
                    val tx = clampX(vw / 2 - fx * s, s); val ty = clampY(vh / 2 - fy * s, s)
                    kotlinx.coroutines.coroutineScope {
                        launch { ox.animateTo(tx, tween(260)) }
                        launch { oy.animateTo(ty, tween(260)) }
                    }
                }
            }
            val scope = rememberCoroutineScope()
            Box(
                Modifier.fillMaxSize().pointerInput(ses, bw, bh, vw, vh) {
                    detectTransformGestures { centroid, pan, zoom, _ ->
                        val s0 = scale.value
                        val s1 = (s0 * zoom).coerceIn(fitScale, baseScale * 2.2f)
                        val nx = centroid.x - (centroid.x - ox.value) * (s1 / s0) + pan.x
                        val ny = centroid.y - (centroid.y - oy.value) * (s1 / s0) + pan.y
                        scope.launch { scale.snapTo(s1); ox.snapTo(clampX(nx, s1)); oy.snapTo(clampY(ny, s1)) }
                        if (zoom != 1f || pan != Offset.Zero) userMoved = true
                        if (overview && s1 > fitScale * 1.05f) overview = false
                    }
                },
            ) {
                CompositionLocalProvider(LocalDensity provides Density(dens.density, 1f)) {
                    Box(
                        Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).size(boardW(b).dp, boardH(b).dp).graphicsLayer {
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0f)
                            scaleX = scale.value; scaleY = scale.value
                            translationX = ox.value; translationY = oy.value
                        },
                    ) {
                        Canvas(Modifier.fillMaxSize()) { lifeScenery(b, st.grade) }
                        val owners = remember(version) { IntArray(LifeData.JOBS.size) { j -> st.players.indexOfFirst { it.job == j } } }
                        for (q in b.squares) SquareTile(q, st.grade, if (q.type == "job") owners[q.job] else -1)
                        Canvas(Modifier.fillMaxSize()) {
                            val k = density
                            val counts = HashMap<Int, Int>()
                            for (i in 0 until g.n) {
                                val ctr = cellCenter(i)
                                val key = if (st.players[i].village && !(walking && i == st.actor)) -1 else posOf(i)
                                val idx = (counts[key] ?: 0); counts[key] = idx + 1
                                val dx = ((idx % 3) - 1) * 30f; val dy = (idx / 3) * 26f + 18f
                                pawn((ctr.x + dx) * k, (ctr.y + dy) * k, LIFE_COLORS[i], k, i == focusSeat && !st.over)
                            }
                        }
                    }
                }
            }
            // 拡大・縮小のボタン(右上に固定)。押した後は自動で追わない
            fun zoomBy(f: Float) {
                val s0 = scale.value
                val s1 = (s0 * f).coerceIn(fitScale, baseScale * 2.2f)
                val cx = vw / 2; val cy = vh / 2
                val nx = cx - (cx - ox.value) * (s1 / s0); val ny = cy - (cy - oy.value) * (s1 / s0)
                userMoved = true; overview = false
                scope.launch {
                    launch { scale.animateTo(s1, tween(200)) }
                    launch { ox.animateTo(clampX(nx, s1), tween(200)) }
                    launch { oy.animateTo(clampY(ny, s1), tween(200)) }
                }
            }
            Column(Modifier.align(Alignment.TopEnd).padding(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((label, f) in listOf("＋" to 1.35f, "−" to 1f / 1.35f)) {
                    Box(
                        Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xE6FFFDF8)).border(1.dp, Color(0x33000000), RoundedCornerShape(10.dp))
                            .clickable(role = androidx.compose.ui.semantics.Role.Button, onClickLabel = if (f > 1f) "拡大" else "縮小") { zoomBy(f) },
                        contentAlignment = Alignment.Center,
                    ) { Text(label, color = Color(0xFF2A2118), fontSize = 20.sp, fontWeight = FontWeight.Black) }
                }
            }
            // 回っているルーレット(右下)
            val spinning = !ma.done && spinCount(ma.from, st) > 0 && e < spinMs
            val turn = if (spinning) e / spinMs * 720f + st.lastSpin * 36f else 0f
            if (st.lastSpin > 0 && (!ma.done || st.actor >= 0)) {
                Box(Modifier.align(Alignment.BottomEnd).padding(8.dp).size(84.dp)) {
                    Roulette(-turn, Modifier.fillMaxSize())
                    Text(if (spinning) "" else "${st.lastSpin}", color = STOP_RED, fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.Center))
                }
            }
            // 止まったマスのカード(選ぶことがある時)
            if (legal.isNotEmpty() && st.phase != Life.P_TURN) LifeChoiceCard(ses, g, st, legal, onMove, Modifier.align(Alignment.Center))
            else if (legal.isNotEmpty() && st.players[st.turn].finish > 0) GuessCard(guess, { guess = it }, Modifier.align(Alignment.Center))
        }
        // 下: 自分の持ち物
        val mine = st.players[me]
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            val sal = g.salary(mine, 0)
            InfoPill(g.jobName(mine) + if (mine.job >= 0) " $${Life.fmt(sal)}" else "", Modifier.weight(1.6f))
            InfoPill("券 ${mine.tickets}", Modifier.weight(0.7f))
            InfoPill("子 ${mine.children}", Modifier.weight(0.7f))
            InfoPill("手形 ${mine.loans}", Modifier.weight(0.8f))
        }
        // 場所を固定したボタン
        val spinMove = if (st.phase == Life.P_TURN && st.players[st.turn].finish > 0) (if (guess in 1..10) Life.GUESS + guess else -1) else Life.SPIN
        CardButtonRow(listOf(
            CardBtn("全体図", true) { overview = !overview; userMoved = false },
            CardBtn("今いる所", true) { overview = false; showItems = false; userMoved = false },
            CardBtn("持ち物", true) { showItems = true },
            CardBtn(if (clock >= 0 && spinMove in legal) "回す ${clock}" else "ルーレット", spinMove in legal, true) { onMove(spinMove) },
        ))
    }
    if (showItems) LifeItems(ses, g, st, me, Life.REPAY in legal, { onMove(Life.REPAY) }) { showItems = false }
}

@Composable
private fun InfoPill(text: String, modifier: Modifier) {
    val c = LocalAsobi.current
    Text(text, color = c.ink, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        modifier = modifier.clip(RoundedCornerShape(50)).background(c.chip).padding(horizontal = 6.dp, vertical = 3.dp))
}

/** 盤の上に出すカード(太い茶色の線・クリーム色の地) */
@Composable
private fun LifeCard(title: String, text: AnnotatedString, modifier: Modifier, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0x730A121C)))
    Column(
        modifier.padding(horizontal = 18.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(CREAM).border(4.dp, LINE, RoundedCornerShape(14.dp))
            .heightIn(max = 420.dp).verticalScroll(rememberScrollState()).padding(12.dp).testTag("lifeCard"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = Color(0xFF8A2B12), fontSize = 12.sp, fontWeight = FontWeight.Black)
        if (text.isNotEmpty()) Text(text, fontSize = 15.sp, fontWeight = FontWeight.Black, lineHeight = 22.sp)
        content()
    }
}

/** カードの中のボタン */
@Composable
private fun CardChoice(label: String, modifier: Modifier = Modifier, strong: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(10.dp)).background(if (!enabled) Color(0xFFE6E0CC) else if (strong) Color(0xFF7A3FC4) else Color.White)
            .border(3.dp, LINE, RoundedCornerShape(10.dp)).clickable(enabled = enabled) { onClick() }.padding(horizontal = 6.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (strong && enabled) Color.White else INK, fontSize = 13.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, lineHeight = 17.sp) }
}

@Composable
private fun TwoChoices(noLabel: String, yesLabel: String, onMove: (Int) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        CardChoice(noLabel, Modifier.weight(1f)) { onMove(Life.NO) }
        CardChoice(yesLabel, Modifier.weight(1f), strong = true) { onMove(Life.YES) }
    }
}

@Composable
private fun LifeChoiceCard(ses: Session<LifeState>, g: Life, st: LifeState, legal: Set<Int>, onMove: (Int) -> Unit, modifier: Modifier) {
    val p = st.players[st.turn]
    val q = g.sq[p.pos]
    val sqText = moneyText(lifeSquareText(q, st.grade))
    when (st.phase) {
        Life.P_SPIN -> LifeCard("止まったマス", sqText, modifier) { Text("下の「ルーレット」で回します。", color = INK, fontSize = 12.sp) }
        Life.P_YESNO -> {
            val a = -q.amountAt(st.grade)
            when (st.ask) {
                Life.Q_TICKET -> LifeCard("止まったマス", sqText, modifier) { TwoChoices("$${Life.fmt(a)} はらう", "ゆめチケットで\n$${Life.fmt(a)} もらう", onMove) }
                Life.Q_JOB -> LifeCard("就職", moneyText(lifeSquareText(q, st.grade)), modifier) { TwoChoices("就かない", "就く", onMove) }
                Life.Q_BUY -> LifeCard("お宝", sqText, modifier) { TwoChoices("買わない", "$${Life.fmt(q.price)} で引く", onMove) }
                Life.Q_SWAP -> LifeCard("ハプニング!", sqText, modifier) { TwoChoices("取りかえない", "取りかえる", onMove) }
                Life.Q_RETURN -> LifeCard("お宝", AnnotatedString("「ドッカン玉」を場にもどしますか。持ったままゴールすると、ほかのお宝の価値が$0になります。"), modifier) { TwoChoices("もどさない", "もどす", onMove) }
                Life.Q_PASS -> LifeCard("お宝", AnnotatedString("「ドッカン玉」を${seatLabel(ses, (st.turn + 1) % g.n)}に渡しますか。"), modifier) { TwoChoices("渡さない", "渡す", onMove) }
                else -> LifeCard("止まったマス", sqText, modifier) { TwoChoices("いいえ", "はい", onMove) }
            }
        }
        Life.P_HOUSE -> LifeCard("マイホーム", AnnotatedString("家を買えます(1人1軒)。最後に買値の3倍で売れます。足りない分は約束手形で借ります。"), modifier) {
            for (h in LifeData.HOUSES.indices) {
                val ok = Life.HOUSE + h in legal
                val house = LifeData.HOUSES[h]
                CardChoice(house.name + "  $" + Life.fmt(house.price) + if (!ok) "(売り切れ)" else "", Modifier.fillMaxWidth(), enabled = ok) { onMove(Life.HOUSE + h) }
            }
            CardChoice("買わない", Modifier.fillMaxWidth()) { onMove(Life.NO) }
        }
        Life.P_TICKETS -> LifeCard("ストップ! ゆめの谷", sqText, modifier) {
            Text("いまの谷: ${LifeData.GRADES[st.grade]}　手持ちのゆめチケット ${p.tickets}枚", color = INK, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (k in 0..2) CardChoice("${k}枚" + "\n" + LifeData.GRADES[maxOf(st.grade, k)], Modifier.weight(1f), strong = k > 0, enabled = Life.TICKETS + k in legal) { onMove(Life.TICKETS + k) }
            }
        }
        Life.P_JOB -> LifeCard(if (st.ask == Life.Q_GATE) "ストップ! チャンスゲート" else "止まったマス", sqText, modifier) {
            Text("いま: ${g.jobName(p)}(給料 $${Life.fmt(g.salary(p, 0))})・ゆめチケット ${p.tickets}枚", color = INK, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            for (m in legal.filter { it != Life.NO }.sorted()) {
                val label = if (m == Life.RANKUP) "ランクアップ: ${LifeData.JOBS[p.job].upName}($${Life.fmt(LifeData.JOBS[p.job].upSalary)})"
                    else LifeData.JOBS[m - Life.JOB].let { "${if (p.job < 0) "就職" else "転職"}: ${it.name}($${Life.fmt(it.salary)})" }
                CardChoice(label, Modifier.fillMaxWidth(), strong = true) { onMove(m) }
            }
            CardChoice("何もしない", Modifier.fillMaxWidth()) { onMove(Life.NO) }
        }
        Life.P_SEAT -> LifeCard("運だめし", sqText, modifier) {
            Text("相手を選びます。", color = INK, fontSize = 12.sp)
            for (m in legal.sorted()) {
                val o = m - Life.SEAT
                CardChoice(seatLabel(ses, o) + "($" + Life.fmt(st.players[o].money) + ")", Modifier.fillMaxWidth()) { onMove(m) }
            }
        }
        Life.P_TREASURE -> LifeCard(if (st.ask == Life.Q_GOAL) "ゴール! お宝を1つ選ぶ" else if (st.ask == Life.Q_TAKE) "${seatLabel(ses, st.target)}のお宝から選ぶ" else "お宝を1つ選ぶ", AnnotatedString(""), modifier) {
            for (m in legal.sortedByDescending { LifeData.TREASURES[Life.CARD_TYPE[it - Life.CARD]].value }) {
                val t = LifeData.TREASURES[Life.CARD_TYPE[m - Life.CARD]]
                CardChoice(t.name + "  $" + Life.fmt(t.value), Modifier.fillMaxWidth()) { onMove(m) }
            }
        }
        Life.P_BET -> BetCard(sqText, legal, onMove, modifier)
    }
}

/** 数を2つ決めて回す(カジノ船) */
@Composable
private fun BetCard(text: AnnotatedString, legal: Set<Int>, onMove: (Int) -> Unit, modifier: Modifier) {
    var picks by remember { mutableStateOf(listOf<Int>()) }
    LifeCard("運だめし", text, modifier) {
        NumberGrid(picks) { n -> picks = if (n in picks) picks - n else (picks + n).takeLast(2) }
        val m = if (picks.size == 2) Life.BET + (picks.min() - 1) * 10 + (picks.max() - 1) else -1
        CardChoice("この2つで回す", Modifier.fillMaxWidth(), strong = true, enabled = m in legal) { onMove(m) }
    }
}

/** ゴールの後: 数を1つ決める(下のルーレットで回す) */
@Composable
private fun GuessCard(guess: Int, onPick: (Int) -> Unit, modifier: Modifier) {
    LifeCard("夢の山の頂上", AnnotatedString("数を1つ決めてルーレットを回します。当たれば$${Life.fmt(LifeData.goalGuessPrize)}。"), modifier) {
        NumberGrid(if (guess > 0) listOf(guess) else emptyList()) { onPick(it) }
    }
}

@Composable
private fun NumberGrid(picked: List<Int>, onPick: (Int) -> Unit) {
    for (r in 0..1) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        for (k in 1..5) { val n = r * 5 + k; CardChoice("$n", Modifier.weight(1f), strong = n in picked) { onPick(n) } }
    }
}

/** 持ち物(全員分)。手形を返すのもここ */
@Composable
private fun LifeItems(ses: Session<LifeState>, g: Life, st: LifeState, me: Int, canRepay: Boolean, onRepay: () -> Unit, onClose: () -> Unit) {
    val c = LocalAsobi.current
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onClose), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = 560.dp).clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)).background(c.surface)
                .pointerInput(Unit) { detectTapGestures { } }.verticalScroll(rememberScrollState()).padding(16.dp).testTag("lifeItems"),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("持ち物", color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("ゆめの谷: ${LifeData.GRADES[st.grade]}", color = c.sub, fontSize = 12.sp)
            for (i in 0 until g.n) {
                val p = st.players[i]
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (i == me) c.accent.copy(alpha = 0.15f) else c.chip).padding(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(12.dp).clip(CircleShape).background(LIFE_COLORS[i]))
                        Text(" " + seatLabel(ses, i), color = c.ink, fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("$" + Life.fmt(p.money), color = c.ink, fontWeight = FontWeight.Black, fontSize = 14.sp)
                    }
                    Text("${g.jobName(p)}(給料 $${Life.fmt(g.salary(p, 0))}${if (p.freeter) "×ルーレットの数" else ""})・ゆめチケット ${p.tickets}枚・子ども ${p.children}人・約束手形 ${p.loans}枚", color = c.ink, fontSize = 12.sp)
                    Text("家: " + (if (p.house >= 0) LifeData.HOUSES[p.house].let { "${it.name}(買値 $${Life.fmt(it.price)})" } else "なし"), color = c.ink, fontSize = 12.sp)
                    Text("お宝: " + (if (p.cards.isEmpty()) "なし" else p.cards.joinToString("、") { LifeData.TREASURES[Life.CARD_TYPE[it]].let { t -> "${t.name} $${Life.fmt(t.value)}" } }), color = c.ink, fontSize = 12.sp)
                    Text("いまの計算: $${Life.fmt(g.total(p))}", color = c.sub, fontSize = 11.sp)
                }
            }
            CardButtonRow(listOf(CardBtn("手形を1枚返す($${Life.fmt(LifeData.loan)})", canRepay, false) { onRepay(); onClose() }, CardBtn("閉じる", true, true) { onClose() }))
        }
    }
}
