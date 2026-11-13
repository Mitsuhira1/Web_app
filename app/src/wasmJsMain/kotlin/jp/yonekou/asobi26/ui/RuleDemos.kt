package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.Arrangement
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * ルール説明の動く図。id ごとに、決まった長さで繰り返すアニメーションを描く。
 * 実際のゲームと同じ描き方(卓・石・ビーズ・紙)を使い、説明文と同じ動きを見せる。
 */
private class DemoSpec(val periodMs: Int, val heightDp: Int, val caption: String, val draw: DrawScope.(t: Float, tm: TextMeasurer) -> Unit)

private val DEMOS: Map<String, DemoSpec> = mapOf(
    "life_move" to DemoSpec(4200,150,"給料日(赤)は通り過ぎても給料。ストップは数が余っても止まります。",{t,tm->lifeMove(t,tm)}),
    "mahjong_discard" to DemoSpec(3500,150,"手牌を選び、打牌ボタンで河へ置きます。",{t,tm->mahjongDiscard(t,tm)}),
    "hanafuda_play" to DemoSpec(3500,160,"同じ月の手札と場札を合わせて取ります。",{t,tm->newCardDemo(t,tm,0)}),
    "speed_play" to DemoSpec(3500,160,"台札と1つ違う数字を、相手の手を待たずに出せます。",{t,tm->newCardDemo(t,tm,1)}),
    "holdem_play" to DemoSpec(3500,160,"手札2枚と共通の5枚から、最も強い5枚を作ります。",{t,tm->newCardDemo(t,tm,2)}),
    "uno_play" to DemoSpec(3500,160,"同じ色か数字の札を出し、手札をなくします。",{t,tm->newCardDemo(t,tm,3)}),
    "solitaire_play" to DemoSpec(3500,160,"赤黒交互・1つ小さい札を重ねます。",{t,tm->newCardDemo(t,tm,4)}),

    "reversi_flip" to DemoSpec(3200, 120, "黒を置くと、黒ではさまれた白がすべて黒に裏返ります。", ::reversiFlip),
    "reversi_legal" to DemoSpec(2000, 170, "置けるのは、相手の石をはさめるマス(点の所)だけです。", ::reversiLegal),
    "c4_drop" to DemoSpec(2400, 170, "列を選ぶと、コマはいちばん下の空いた所まで落ちます。", ::c4Drop),
    "c4_line" to DemoSpec(3000, 170, "縦・横・斜めのどれかで4つ並べたら勝ちです。", ::c4Line),
    "mancala_sow" to DemoSpec(3600, 120, "穴の石を全部取り、右(反時計回り)へ1個ずつまきます。", ::mancalaSow),
    "mancala_extra" to DemoSpec(3400, 120, "最後の1個が自分の倉に入ったら、もう1回まけます。", ::mancalaExtra),
    "mancala_capture" to DemoSpec(4000, 170, "空だった自分の穴で止まると、向かいの石ごと倉に入れられます。", ::mancalaCapture),
    "dots_close" to DemoSpec(3400, 150, "4辺目を引いて箱を閉じたら自分の箱。続けてもう1本引けます。", ::dotsClose),
    "dots_danger" to DemoSpec(2600, 150, "3辺目を引くと、相手に4辺目を引かれて箱を取られます。", ::dotsDanger),
    "hitblow_judge" to DemoSpec(4400, 150, "位置も数字も合えばヒット(赤)、数字だけ合えばブロー(白)。この例は1ヒット2ブローです。", ::hitBlowJudge),
    "gomoku_five" to DemoSpec(3000, 150, "縦・横・斜めのどれかで5つ並べたら勝ちです。", ::gomokuFive),
    "hex_connect" to DemoSpec(3800, 170, "赤は上と下の赤い辺を、自分のコマのつながりで結べば勝ちです。", ::hexConnect),
    "morris_mill" to DemoSpec(4200, 170, "3つ並べる(ミル)と、相手のコマを1つ選んで取れます。", ::morrisMill),
    "hare_trap" to DemoSpec(3200, 150, "ウサギの行き先を全部ふさげば、猟犬の勝ちです。", ::hareTrap),
    "checkers_jump" to DemoSpec(3200, 170, "斜め前の相手のコマの向こうが空いていたら、跳び越えて取ります。", ::checkersJump),
    "yacht_roll" to DemoSpec(3600, 130, "残したいサイコロ(黄の枠)以外を振り直して、役をそろえます。", ::yachtRoll),
    "chess_castle" to DemoSpec(3400, 110, "キングをルークの方へ2つ動かし、ルークがキングを跳び越えて隣に来ます。", ::chessCastle),
    "chess_enpassant" to DemoSpec(3800, 170, "相手のポーンが2つ進んで真横に来た直後だけ、斜め前へ進んで取れます。", ::chessEnPassant),
    "chess_mate" to DemoSpec(3400, 150, "キングがどこへ逃げても取られる形がチェックメイトです(奥の段への詰み)。", ::chessMate),
    "shogi_promote" to DemoSpec(3400, 170, "敵陣(相手側の奥の段。色の付いた所)に入った駒は、裏返して成れます。歩は「と」になり、金と同じ動きになります。", ::shogiPromote),
    "shogi_drop" to DemoSpec(4200, 170, "取った駒は持ち駒になり、空いているマスに打てます。", ::shogiDrop),
    "bg_move" to DemoSpec(3800, 150, "出た目の数だけ、1つずつ駒を進めます(5と3なら、5つと3つ)。", ::bgMove),
    "bg_hit" to DemoSpec(3600, 150, "相手の駒が1つだけのポイントに止まると、その駒を真ん中のバーへ送れます。", ::bgHit),
    "ludo_start" to DemoSpec(3600, 150, "6が出た時だけ、家の駒を出発のマスに出せます。", ::ludoStart),
    "ludo_capture" to DemoSpec(3600, 130, "相手の駒にぴったり止まると、その駒は家に戻ります(星のマスでは取られません)。", ::ludoCapture),
    "cc_jump" to DemoSpec(3800, 170, "隣のコマを跳び越えて、続けて何回でも跳べます。", ::ccJump),
    "go_capture" to DemoSpec(3400, 170, "相手の石の周りの空き(呼吸点)を全部ふさぐと、その石を取れます。", ::goCapture),
    "poker_draw" to DemoSpec(3800, 150, "要らない札を選んで、山の札と1回だけ交換できます。", ::pokerDraw),
    "memory_pair" to DemoSpec(4200, 150, "2枚めくって同じ数なら取れます。違えば裏に戻します。", ::memoryPair),
    "bj_hit" to DemoSpec(3800, 150, "ヒットで1枚引きます。K と 7 と 4 で21。A は11にも1にも数えます。", ::bjHit),
    "sevens_next" to DemoSpec(3400, 140, "列の両端の隣(この例では ♥5 と ♥9)だけを出せます。", ::sevensNext),
    "daifugo_beat" to DemoSpec(3600, 150, "前と同じ枚数で、より強い札を出します(5のペアには、6以上のペア)。", ::daifugoBeat),
    "daifugo_rev" to DemoSpec(3600, 150, "同じ数を4枚出すと革命。強さが逆になり、3が一番強くなります。", ::daifugoRev),
)

fun hasDemo(id: String): Boolean = id in DEMOS

@Composable
fun RuleDemo(id: String, modifier: Modifier = Modifier) {
    val spec = DEMOS[id] ?: return
    val c = LocalAsobi.current
    val tm = rememberTextMeasurer()
    val inf = rememberInfiniteTransition(label = id)
    val t by inf.animateFloat(0f, 1f, infiniteRepeatable(tween(spec.periodMs, easing = LinearEasing), RepeatMode.Restart), label = id)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val table = tableFor(c)
        Canvas(Modifier.fillMaxWidth().height(spec.heightDp.dp).clip(RoundedCornerShape(14.dp))) {
            drawRect(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(table.top, table.bottom)))
            woodGrain(Offset.Zero, size, table.grain, 10)
            spec.draw(this, t, tm)
        }
        Text(spec.caption, color = c.sub, fontSize = 12.sp, lineHeight = 18.sp)
    }
}

// ---- 描き方の部品 ----

private val BLACK = Color(0xFF23262D)
private val WHITE = Color(0xFFF4F1E8)
private fun seg(t: Float, a: Float, b: Float) = ((t - a) / (b - a)).coerceIn(0f, 1f)

private fun DrawScope.label(tm: TextMeasurer, text: String, center: Offset, color: Color = Color.White, size: Int = 14) {
    val lay = tm.measure(text, TextStyle(color = color, fontSize = size.sp, fontWeight = FontWeight.Bold))
    drawRoundRect(Color(0x99000000), Offset(center.x - lay.size.width / 2f - 8f, center.y - lay.size.height / 2f - 4f),
        Size(lay.size.width + 16f, lay.size.height + 8f), CornerRadius(10f))
    drawText(lay, topLeft = Offset(center.x - lay.size.width / 2f, center.y - lay.size.height / 2f))
}

/** 横に並んだ緑の盤(cols×rows)を中央に描き、マスの大きさと左上を返す */
private fun DrawScope.feltGrid(cols: Int, rows: Int): Pair<Float, Offset> {
    val cell = min(size.width * 0.86f / cols, size.height * 0.84f / rows)
    val tl = Offset((size.width - cell * cols) / 2, (size.height - cell * rows) / 2)
    drawRoundRect(Color(0xFF6E4524), tl - Offset(6f, 6f), Size(cell * cols + 12f, cell * rows + 12f), CornerRadius(8f))
    drawRect(Color(0xFF2E7D55), tl, Size(cell * cols, cell * rows))
    for (k in 0..cols) drawLine(Color(0xFF17452E), tl + Offset(k * cell, 0f), tl + Offset(k * cell, rows * cell), 2f)
    for (k in 0..rows) drawLine(Color(0xFF17452E), tl + Offset(0f, k * cell), tl + Offset(cols * cell, k * cell), 2f)
    return cell to tl
}

// ---- リバーシ ----

private fun reversiFlip(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = feltGrid(5, 1)
    fun cc(i: Int) = tl + Offset((i + 0.5f) * cell, cell / 2)
    val r = cell * 0.42f
    stone(cc(0), r, BLACK)
    val place = seg(t, 0.2f, 0.3f)
    if (place <= 0f) {
        drawCircle(Color(0x99FFFDF8), cell * 0.11f * (1 + 0.2f * sin(t * 40)), cc(4))
    } else stone(cc(4), r * popScale(place), BLACK)
    for (i in 1..3) {
        val f = seg(t, 0.32f + (3 - i) * 0.08f, 0.42f + (3 - i) * 0.08f)
        val col = if (f < 0.5f) WHITE else BLACK
        if (f <= 0f || f >= 1f) stone(cc(i), r, if (f >= 1f) BLACK else WHITE)
        else flatDisc(cc(i), r, abs(cos(PI.toFloat() * f)), col)
    }
}

private fun reversiLegal(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = feltGrid(6, 4)
    fun cc(col: Int, row: Int) = tl + Offset((col + 0.5f) * cell, (row + 0.5f) * cell)
    val r = cell * 0.42f
    stone(cc(2, 1), r, WHITE); stone(cc(3, 1), r, BLACK); stone(cc(2, 2), r, BLACK); stone(cc(3, 2), r, WHITE)
    val pulse = 0.85f + 0.3f * sin(t * 2 * PI.toFloat())
    for ((x, y) in listOf(2 to 0, 1 to 1, 4 to 2, 3 to 3)) drawCircle(Color(0xCCFFFDF8), cell * 0.12f * pulse, cc(x, y))
    label(tm, "黒の番", Offset(size.width / 2, cell * 0.35f + 4f), size = 12)
}

// ---- コネクトフォー ----

private fun DrawScope.c4Frame(cols: Int, rows: Int, discs: Map<Int, Color>, falling: Triple<Int, Float, Color>?): Pair<Float, Offset> {
    val cell = min(size.width * 0.7f / cols, size.height * 0.9f / (rows + 0.6f))
    val tl = Offset((size.width - cell * cols) / 2, size.height - cell * rows - size.height * 0.05f)
    fun cc(col: Int, row: Int) = tl + Offset((col + 0.5f) * cell, (rows - row - 0.5f) * cell)
    drawRoundRect(C4_HOLE, tl, Size(cell * cols, cell * rows), CornerRadius(cell * 0.2f))
    for ((k, col) in discs) c4Disc(cc(k % cols, k / cols), cell * 0.4f, col)
    if (falling != null) {
        val (col, y, color) = falling
        c4Disc(Offset(tl.x + (col + 0.5f) * cell, y), cell * 0.4f, color)
    }
    val frame = androidx.compose.ui.graphics.Path().apply {
        fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
        addRoundRect(androidx.compose.ui.geometry.RoundRect(Rect(tl, Size(cell * cols, cell * rows)), CornerRadius(cell * 0.2f)))
        for (k in 0 until cols * rows) {
            val c = cc(k % cols, k / cols)
            addOval(Rect(c.x - cell * 0.37f, c.y - cell * 0.37f, c.x + cell * 0.37f, c.y + cell * 0.37f))
        }
    }
    drawPath(frame, C4_WOOD)
    return cell to tl
}

private fun c4Drop(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cols = 4
    val rows = 4
    val discs = mapOf(0 to C4_BLACK, 1 to C4_RED, 4 to C4_BLACK)
    val cell = min(size.width * 0.7f / cols, size.height * 0.9f / (rows + 0.6f))
    val tlY = size.height - cell * rows - size.height * 0.05f
    val f = seg(t, 0.15f, 0.6f)
    val target = tlY + (rows - 1 - 0.5f) * cell // 列1の2段目(下から)
    val y = if (t < 0.15f) tlY - cell * 0.5f else mix(tlY - cell * 0.5f, target, bounceOut(f))
    c4Frame(cols, rows, discs, Triple(1, y, C4_RED))
    if (t < 0.15f) label(tm, "▼", Offset(size.width / 2 - cell * 0.5f, tlY - cell * 0.5f), size = 11)
}

private fun c4Line(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cols = 4
    val rows = 4
    val reds = listOf(0, 5, 10, 15)
    val shown = (t / 0.12f).toInt().coerceAtMost(4)
    val discs = HashMap<Int, Color>()
    discs[1] = C4_BLACK; discs[2] = C4_BLACK; discs[3] = C4_BLACK; discs[6] = C4_BLACK; discs[7] = C4_BLACK; discs[11] = C4_BLACK
    for (k in 0 until shown) discs[reds[k]] = C4_RED
    val (cell, tl) = c4Frame(cols, rows, discs, null)
    if (shown == 4) {
        val l = seg(t, 0.5f, 0.75f)
        fun cc(k: Int) = tl + Offset((k % cols + 0.5f) * cell, (rows - k / cols - 0.5f) * cell)
        val a = cc(0)
        val b = cc(15)
        drawLine(Color.White, a, Offset(mix(a.x, b.x, l), mix(a.y, b.y, l)), strokeWidth = cell * 0.12f, cap = StrokeCap.Round)
        if (l >= 1f) label(tm, "4つ並んだ!", Offset(size.width * 0.82f, size.height * 0.25f), size = 12)
    }
}

// ---- マンカラ ----

private fun DrawScope.mancalaRow(pits: IntArray, flyFrom: Int, flyTo: Int, flyT: Float, highlightStore: Boolean): List<Rect> {
    // pits[0..5] = 穴、pits[6] = 倉(右端)
    val h = size.height * 0.8f
    val w = min(size.width * 0.92f, h * 4.2f)
    val tl = Offset((size.width - w) / 2, (size.height - h) / 2)
    woodPanel(tl, Size(w, h), h * 0.2f, Color(0xFFB5814A), Color(0xFF7A4E27))
    val m = h * 0.12f
    val storeW = w * 0.14f
    val gap = w * 0.012f
    val pitW = (w - 2 * m - storeW - gap * 6) / 6
    val pitH = min(pitW, h - 2 * m)
    val rects = ArrayList<Rect>()
    for (i in 0..5) {
        val x = tl.x + m + i * (pitW + gap)
        rects.add(Rect(x, tl.y + (h - pitH) / 2, x + pitW, tl.y + (h + pitH) / 2))
    }
    rects.add(Rect(tl.x + w - m - storeW, tl.y + m, tl.x + w - m, tl.y + h - m))
    for (i in 0..6) {
        recess(rects[i].topLeft, rects[i].size, Color(0xFF6B4523), if (i == 6 && highlightStore) Color(0xFFFFE08A) else null)
        demoBeads(i, pits[i], rects[i])
    }
    if (flyFrom >= 0) {
        val a = rects[flyFrom].center
        val b = rects[flyTo].center
        val e = ease(flyT)
        bead(Offset(mix(a.x, b.x, e), mix(a.y, b.y, e) - h * 0.25f * (1 - (2 * e - 1) * (2 * e - 1))), pitW * 0.13f, BEAD_COLORS[flyTo % 8])
    }
    return rects
}

private fun DrawScope.demoBeads(seed: Int, n: Int, rect: Rect) {
    val r = min(rect.width, rect.height) * 0.14f
    for (i in 0 until n) {
        val s = beadSpot(i, n)
        bead(Offset(rect.center.x + s.x * (rect.width / 2 - r * 1.3f), rect.center.y + s.y * (rect.height / 2 - r * 1.3f)), r, BEAD_COLORS[(seed * 3 + i) % 8])
    }
}

/** start の穴から n 個まく途中の状態 */
private fun sowing(base: IntArray, start: Int, t: Float, a: Float, b: Float): Triple<IntArray, Pair<Int, Int>, Float> {
    val n = base[start]
    val p = base.copyOf()
    val stepF = seg(t, a, b) * n
    val k = stepF.toInt().coerceAtMost(n)
    if (t < a) return Triple(p, -1 to -1, 0f)
    p[start] = 0
    for (j in 1..k) p[start + j]++
    return if (k < n) Triple(p, (if (k == 0) start else start + k) to (start + k + 1), stepF - k) else Triple(p, -1 to -1, 0f)
}

private fun mancalaSow(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (p, fly, ft) = sowing(intArrayOf(2, 1, 4, 0, 1, 2, 3), 2, t, 0.15f, 0.75f)
    mancalaRow(p, fly.first, fly.second, ft, false)
}

private fun mancalaExtra(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (p, fly, ft) = sowing(intArrayOf(1, 2, 0, 3, 1, 0, 2), 3, t, 0.15f, 0.6f)
    val done = t >= 0.62f
    mancalaRow(p, fly.first, fly.second, ft, done)
    if (done) label(tm, "もう1回!", Offset(size.width / 2, size.height * 0.2f), size = 13)
}

private fun mancalaCapture(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    // 上の段(相手)と下の段(自分)。自分の穴1(1個)→穴2(空)へ。向かいに4個
    val h = size.height * 0.86f
    val w = min(size.width * 0.92f, h * 2.6f)
    val tl = Offset((size.width - w) / 2, (size.height - h) / 2)
    woodPanel(tl, Size(w, h), h * 0.15f, Color(0xFFB5814A), Color(0xFF7A4E27))
    val m = h * 0.08f
    val storeW = w * 0.12f
    val gap = w * 0.012f
    val pitW = (w - 2 * m - storeW * 2 - gap * 7) / 6
    val pitH = min(pitW, (h - 3 * m) / 2)
    fun pit(row: Int, i: Int): Rect {
        val x = tl.x + m + storeW + gap + i * (pitW + gap)
        val y = if (row == 0) tl.y + m else tl.y + h - m - pitH
        return Rect(x, y, x + pitW, y + pitH)
    }
    val myStore = Rect(tl.x + w - m - storeW, tl.y + m, tl.x + w - m, tl.y + h - m)
    val oppStore = Rect(tl.x + m, tl.y + m, tl.x + m + storeW, tl.y + h - m)
    val top = intArrayOf(2, 1, 4, 0, 3, 1)
    val bottom = intArrayOf(0, 1, 0, 2, 1, 3)
    var store = 2
    val move = seg(t, 0.15f, 0.3f)
    val take = seg(t, 0.45f, 0.75f)
    if (move >= 1f) { bottom[1] = 0; bottom[2] = 1 }
    if (take >= 1f) { bottom[2] = 0; top[2] = 0; store += 5 }
    recess(oppStore.topLeft, oppStore.size, Color(0xFF6B4523)); demoBeads(9, 3, oppStore)
    recess(myStore.topLeft, myStore.size, Color(0xFF6B4523), if (take >= 1f) Color(0xFFFFE08A) else null); demoBeads(6, store, myStore)
    for (i in 0..5) {
        val tr = pit(0, i)
        recess(tr.topLeft, tr.size, Color(0xFF6B4523), if (i == 2 && t in 0.32f..0.75f) Color(0xFFFFE08A) else null)
        demoBeads(i + 7, if (i == 2 && take > 0f && take < 1f) 0 else top[i], tr)
        val br = pit(1, i)
        recess(br.topLeft, br.size, Color(0xFF6B4523), if (i == 2 && t in 0.32f..0.75f) Color(0xFFFFE08A) else null)
        demoBeads(i, if (i == 2 && take > 0f && take < 1f) 0 else bottom[i], br)
    }
    if (move > 0f && move < 1f) {
        val a = pit(1, 1).center; val b = pit(1, 2).center
        val e = ease(move)
        bead(Offset(mix(a.x, b.x, e), mix(a.y, b.y, e) - pitH * 0.6f * (1 - (2 * e - 1) * (2 * e - 1))), pitW * 0.13f, BEAD_COLORS[2])
    }
    if (take > 0f && take < 1f) {
        val e = ease(take)
        for (k in 0 until 5) {
            val a = if (k < 4) pit(0, 2).center else pit(1, 2).center
            val b = myStore.center
            bead(Offset(mix(a.x, b.x, e) + k * 3f, mix(a.y, b.y, e) - k * 2f), pitW * 0.13f, BEAD_COLORS[(k + 2) % 8])
        }
    }
    if (take >= 1f) label(tm, "横取り!", Offset(size.width / 2, size.height / 2), size = 13)
}

// ---- ドット＆ボックス ----

private fun DrawScope.paperGrid(cols: Int, rows: Int): Pair<Float, Offset> {
    val cell = min(size.width * 0.6f / cols, size.height * 0.7f / rows)
    val tl = Offset((size.width - cell * cols) / 2, (size.height - cell * rows) / 2)
    drawRoundRect(Color(0x44000000), tl - Offset(cell * 0.3f - 3f, cell * 0.3f - 5f), Size(cell * (cols + 0.6f), cell * (rows + 0.6f)), CornerRadius(8f))
    drawRoundRect(Color(0xFFFBF8F0), tl - Offset(cell * 0.3f, cell * 0.3f), Size(cell * (cols + 0.6f), cell * (rows + 0.6f)), CornerRadius(8f))
    return cell to tl
}

private fun DrawScope.dots(cols: Int, rows: Int, cell: Float, tl: Offset) {
    for (r in 0..rows) for (c in 0..cols) drawCircle(Color(0xFF2B2B2B), cell * 0.07f, tl + Offset(c * cell, r * cell))
}

private fun DrawScope.ink(a: Offset, b: Offset, t: Float, color: Color, cell: Float) {
    if (t <= 0f) return
    drawLine(color, a, Offset(mix(a.x, b.x, t), mix(a.y, b.y, t)), strokeWidth = cell * 0.08f, cap = StrokeCap.Round)
}

private fun dotsClose(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = paperGrid(2, 1)
    fun p(c: Int, r: Int) = tl + Offset(c * cell, r * cell)
    ink(p(0, 0), p(1, 0), 1f, INK_RED, cell)
    ink(p(0, 0), p(0, 1), 1f, INK_RED, cell)
    ink(p(0, 1), p(1, 1), 1f, INK_BLUE, cell)
    val close = seg(t, 0.15f, 0.3f)
    ink(p(1, 0), p(1, 1), close, INK_BLUE, cell)
    val box = seg(t, 0.3f, 0.42f)
    if (box > 0f) {
        val s = popScale(box)
        val c = tl + Offset(cell / 2, cell / 2)
        val half = (cell / 2 - 5f) * s
        drawRoundRect(INK_BLUE.copy(alpha = 0.22f), c - Offset(half, half), Size(half * 2, half * 2), CornerRadius(6f))
        drawCircle(INK_BLUE, cell * 0.16f * s, c, style = Stroke(cell * 0.05f))
    }
    if (t in 0.42f..0.62f) label(tm, "もう1本!", Offset(size.width / 2, size.height * 0.15f), size = 12)
    ink(p(1, 0), p(2, 0), seg(t, 0.62f, 0.76f), INK_BLUE, cell)
    dots(2, 1, cell, tl)
}

private fun dotsDanger(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = paperGrid(2, 1)
    fun p(c: Int, r: Int) = tl + Offset(c * cell, r * cell)
    ink(p(0, 0), p(1, 0), 1f, INK_BLUE, cell)
    ink(p(0, 0), p(0, 1), 1f, INK_RED, cell)
    ink(p(0, 1), p(1, 1), seg(t, 0.15f, 0.3f), INK_BLUE, cell)
    if (t > 0.35f) {
        val pulse = 0.5f + 0.5f * sin((t - 0.35f) * 30)
        drawRoundRect(Color(0xFFD93A2B).copy(alpha = 0.15f + 0.2f * pulse), tl + Offset(4f, 4f), Size(cell - 8f, cell - 8f), CornerRadius(6f))
        ink(p(1, 0), p(1, 1), seg(t, 0.55f, 0.7f), INK_RED, cell)
        if (t > 0.7f) label(tm, "取られた!", Offset(size.width / 2, size.height * 0.15f), size = 12)
    }
    dots(2, 1, cell, tl)
}

// ---- ヒット＆ブロー ----

private fun DrawScope.tile(tm: TextMeasurer, text: String, center: Offset, s: Float, ring: Color?, covered: Boolean = false) {
    val tl = center - Offset(s / 2, s / 2)
    drawRoundRect(Color(0x55000000), tl + Offset(1f, 3f), Size(s, s), CornerRadius(s * 0.18f))
    drawRoundRect(if (covered) Color(0xFF6E4524) else Color(0xFFF6EEDC), tl, Size(s, s), CornerRadius(s * 0.18f))
    if (ring != null) drawRoundRect(ring, tl - Offset(3f, 3f), Size(s + 6f, s + 6f), CornerRadius(s * 0.22f), style = Stroke(4f))
    val lay = tm.measure(if (covered) "?" else text, TextStyle(color = if (covered) Color(0xFFF4E6CC) else Color(0xFF2B2118), fontSize = (s / 2.6f / density).sp, fontWeight = FontWeight.Bold))
    drawText(lay, topLeft = center - Offset(lay.size.width / 2f, lay.size.height / 2f))
}

private fun hitBlowJudge(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val secret = "1234"
    val guess = "1325"
    val labels = TextStyle(color = Color(0xFFFFF4DF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
    val l1 = tm.measure("相手の数", labels)
    val l2 = tm.measure("質問", labels)
    val labelW = maxOf(l1.size.width, l2.size.width).toFloat()
    // 横幅に収まるように札の大きさを決める: 見出し + 札4枚(間隔1.2) + ピン
    val margin = 10f
    val s = min((size.width - 2 * margin - labelW - 12f) / (4 * 1.2f + 1.3f), size.height / 3.4f)
    val x0 = margin + labelW + 12f + s / 2
    val y1 = size.height * 0.34f
    val y2 = size.height * 0.74f
    drawText(l1, topLeft = Offset(margin, y1 - l1.size.height / 2f))
    drawText(l2, topLeft = Offset(margin, y2 - l2.size.height / 2f))
    var hits = 0
    var blows = 0
    for (i in 0..3) {
        val step = seg(t, 0.15f + i * 0.15f, 0.27f + i * 0.15f)
        val g = guess[i]
        val ring = when {
            step <= 0f -> null
            g == secret[i] -> Color(0xFFD93A2B)
            g in secret -> Color(0xFFFFFFFF)
            else -> Color(0x66000000)
        }
        if (step > 0f) { if (g == secret[i]) hits++ else if (g in secret) blows++ }
        tile(tm, secret[i].toString(), Offset(x0 + i * s * 1.2f, y1), s, null, covered = t < 0.08f)
        tile(tm, g.toString(), Offset(x0 + i * s * 1.2f, y2), s, ring)
        if (step > 0f && g in secret) {
            val j = secret.indexOf(g)
            drawLine(ring!!.copy(alpha = 0.8f), Offset(x0 + i * s * 1.2f, y2 - s / 2), Offset(x0 + j * s * 1.2f, y1 + s / 2), strokeWidth = 3f)
        }
    }
    // ピン(ヒット=赤、ブロー=白)
    val pegX = x0 + 3 * s * 1.2f + s * 0.95f
    for (k in 0 until 4) {
        val c = Offset(pegX + (k % 2) * s * 0.42f, y2 - s * 0.21f + (k / 2) * s * 0.42f)
        drawCircle(Color(0x66000000), s * 0.12f, c)
        when {
            k < hits -> stone(c, s * 0.15f, Color(0xFFD93A2B))
            k < hits + blows -> stone(c, s * 0.15f, Color(0xFFF4F1E8))
        }
    }
    if (t > 0.78f) label(tm, "1ヒット 2ブロー", Offset(size.width / 2, size.height * 0.1f + 6f), size = 12)
}


// ---- 五目ならべ ----

private fun gomokuFive(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cols = 9
    val rows = 5
    val step = min(size.width * 0.86f / (cols - 1), size.height * 0.8f / (rows - 1))
    val tl = Offset((size.width - step * (cols - 1)) / 2, (size.height - step * (rows - 1)) / 2)
    drawRoundRect(Color(0xFFE2B972), tl - Offset(step * 0.6f, step * 0.6f), Size(step * (cols - 1 + 1.2f), step * (rows - 1 + 1.2f)), CornerRadius(8f))
    for (k in 0 until cols) drawLine(Color(0xFF3B2A14), tl + Offset(k * step, 0f), tl + Offset(k * step, (rows - 1) * step), 1.4f)
    for (k in 0 until rows) drawLine(Color(0xFF3B2A14), tl + Offset(0f, k * step), tl + Offset((cols - 1) * step, k * step), 1.4f)
    fun at(x: Int, y: Int) = tl + Offset(x * step, y * step)
    val r = step * 0.45f
    for (x in 2..5) stone(at(x, 2), r, BLACK)
    for ((x, y) in listOf(1 to 2, 3 to 1, 4 to 3, 5 to 1)) stone(at(x, y), r, WHITE)
    val p = seg(t, 0.25f, 0.35f)
    if (p > 0f) stone(at(6, 2), r * popScale(p), BLACK) else drawCircle(Color(0x99FFFDF8), r * 0.3f * (1 + 0.2f * sin(t * 40)), at(6, 2))
    val g = seg(t, 0.4f, 0.55f)
    if (g > 0f) drawLine(Color(0xFFFFC65C).copy(alpha = g), at(2, 2), at(6, 2), r * 0.35f, cap = StrokeCap.Round)
    if (t > 0.55f) label(tm, "5つ!", Offset(size.width / 2, size.height * 0.16f), size = 13)
}

// ---- ヘックス ----

private fun demoHex(c: Offset, r: Float): androidx.compose.ui.graphics.Path = androidx.compose.ui.graphics.Path().apply {
    for (k in 0 until 6) {
        val a = (-90 + k * 60) * PI / 180
        val x = c.x + r * cos(a).toFloat()
        val y = c.y + r * sin(a).toFloat()
        if (k == 0) moveTo(x, y) else lineTo(x, y)
    }
    close()
}

private fun hexConnect(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val n = 5
    val s3 = kotlin.math.sqrt(3f)
    val r = min(size.width / ((1.5f * n - 0.5f) * s3 + 1.5f), size.height / (1.5f * (n - 1) + 3f))
    val ox = (size.width - (1.5f * n - 0.5f) * s3 * r) / 2
    val oy = (size.height - (1.5f * (n - 1) + 2f) * r) / 2
    fun at(row: Int, col: Int) = Offset(ox + (col + row * 0.5f) * s3 * r + s3 * r / 2, oy + row * 1.5f * r + r)
    // 赤の辺(上下)
    drawLine(Color(0xFFE0463A), at(0, 0) + Offset(-s3 * r / 2, -r * 0.9f), at(0, n - 1) + Offset(s3 * r / 2, -r * 0.9f), r * 0.3f, cap = StrokeCap.Round)
    drawLine(Color(0xFFE0463A), at(n - 1, 0) + Offset(-s3 * r / 2, r * 0.9f), at(n - 1, n - 1) + Offset(s3 * r / 2, r * 0.9f), r * 0.3f, cap = StrokeCap.Round)
    drawLine(Color(0xFF3A7BE0), at(0, 0) + Offset(-s3 * r * 0.75f, 0f), at(n - 1, 0) + Offset(-s3 * r * 0.75f, 0f), r * 0.3f, cap = StrokeCap.Round)
    drawLine(Color(0xFF3A7BE0), at(0, n - 1) + Offset(s3 * r * 0.75f, 0f), at(n - 1, n - 1) + Offset(s3 * r * 0.75f, 0f), r * 0.3f, cap = StrokeCap.Round)
    for (row in 0 until n) for (col in 0 until n) {
        drawPath(demoHex(at(row, col), r * 0.96f), Color(0xFFF1E3C6))
        drawPath(demoHex(at(row, col), r * 0.96f), Color(0xFF8A6A3A), style = Stroke(1.2f))
    }
    for ((row, col) in listOf(1 to 1, 2 to 3, 3 to 0)) stone(at(row, col), r * 0.7f, Color(0xFF3A7BE0))
    val chain = listOf(0 to 2, 1 to 2, 2 to 1, 3 to 1, 4 to 1)
    chain.forEachIndexed { k, (row, col) ->
        val p = seg(t, 0.08f + k * 0.1f, 0.14f + k * 0.1f)
        if (p > 0f) stone(at(row, col), r * 0.7f * popScale(p), Color(0xFFE0463A))
    }
    val g = seg(t, 0.62f, 0.72f)
    if (g > 0f) for (k in 0 until chain.size - 1) drawLine(Color(0xFFFFC65C).copy(alpha = g), at(chain[k].first, chain[k].second), at(chain[k + 1].first, chain[k + 1].second), r * 0.25f, cap = StrokeCap.Round)
}

// ---- ナインメンズモリス ----

private fun morrisMill(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cell = min(size.width * 0.5f / 6f, size.height * 0.84f / 6f)
    val tl = Offset((size.width - cell * 6) / 2, (size.height - cell * 6) / 2)
    val line = Color(0xFF3B2410)
    drawRoundRect(Color(0xFFC08A52), tl - Offset(cell * 0.6f, cell * 0.6f), Size(cell * 7.2f, cell * 7.2f), CornerRadius(10f))
    for (k in 0..2) drawRect(line, tl + Offset(k * cell, k * cell), Size((6 - 2 * k) * cell, (6 - 2 * k) * cell), style = Stroke(3f))
    drawLine(line, tl + Offset(3 * cell, 0f), tl + Offset(3 * cell, 2 * cell), 3f)
    drawLine(line, tl + Offset(3 * cell, 4 * cell), tl + Offset(3 * cell, 6 * cell), 3f)
    drawLine(line, tl + Offset(0f, 3 * cell), tl + Offset(2 * cell, 3 * cell), 3f)
    drawLine(line, tl + Offset(4 * cell, 3 * cell), tl + Offset(6 * cell, 3 * cell), 3f)
    fun at(x: Int, y: Int) = tl + Offset(x * cell, y * cell)
    val r = cell * 0.36f
    val white = Color(0xFFF1E6CF)
    val black = Color(0xFF3A2A1E)
    stone(at(0, 0), r, white); stone(at(6, 0), r, white)
    stone(at(1, 3), r, black); stone(at(5, 5), r, black)
    val p = seg(t, 0.15f, 0.25f)
    if (p > 0f) stone(at(3, 0), r * popScale(p), white) else drawCircle(Color(0x99FFFDF8), r * 0.35f, at(3, 0))
    val g = seg(t, 0.3f, 0.42f)
    if (g > 0f) drawLine(Color(0xFFFFC65C).copy(alpha = g), at(0, 0), at(6, 0), r * 0.35f, cap = StrokeCap.Round)
    val pick = seg(t, 0.5f, 0.6f)
    val gone = seg(t, 0.7f, 0.82f)
    if (gone < 1f) stone(at(5, 5), r * (1f - gone), black, alpha = 1f - gone)
    if (pick > 0f && gone < 1f) drawCircle(Color(0xFFE2553A).copy(alpha = pick), r * 1.15f, at(5, 5), style = Stroke(r * 0.2f))
    if (t > 0.32f && t < 0.68f) label(tm, "ミル!", Offset(size.width / 2, size.height * 0.5f), size = 13)
}

// ---- ウサギと猟犬 ----

private fun hareTrap(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val xs = intArrayOf(0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4)
    val ys = intArrayOf(1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1)
    val step = min(size.width * 0.84f / 4f, size.height * 0.76f / 2f)
    val tl = Offset((size.width - step * 4) / 2, (size.height - step * 2) / 2)
    fun at(i: Int) = tl + Offset(xs[i] * step, ys[i] * step)
    val edges = listOf(0 to 1, 0 to 2, 0 to 3, 1 to 2, 2 to 3, 1 to 4, 2 to 5, 3 to 6, 1 to 5, 3 to 5, 4 to 5, 5 to 6, 4 to 7, 5 to 8, 6 to 9, 5 to 7, 5 to 9, 7 to 8, 8 to 9, 7 to 10, 8 to 10, 9 to 10)
    for ((a, b) in edges) drawLine(Color(0xFF2F4A1E), at(a), at(b), 3f, cap = StrokeCap.Round)
    for (i in 0 until 11) drawCircle(Color(0xFFEAF2DC), step * 0.14f, at(i))
    val r = step * 0.26f
    val dog = Color(0xFF8A5A34)
    stone(at(8), r, dog); stone(at(9), r, dog)
    val m = ease(seg(t, 0.2f, 0.4f))
    stone(Offset(mix(at(4).x, at(7).x, m), mix(at(4).y, at(7).y, m)), r, dog)
    stone(at(10), r, Color(0xFFF7F7F2))
    drawOval(Color.White, at(10) + Offset(-r * 0.45f, -r * 1.7f), Size(r * 0.35f, r * 1.0f))
    drawOval(Color.White, at(10) + Offset(r * 0.1f, -r * 1.7f), Size(r * 0.35f, r * 1.0f))
    val pulse = seg(t, 0.45f, 0.6f)
    if (pulse > 0f) drawCircle(Color(0xFFE2553A).copy(alpha = pulse), r * (1.2f + 0.1f * sin(t * 30)), at(10), style = Stroke(r * 0.18f))
    if (t > 0.6f) label(tm, "ウサギは動けない", Offset(size.width * 0.38f, size.height * 0.5f), size = 12)
}

// ---- チェッカー ----

private fun checkersJump(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cell = min(size.width * 0.6f / 4f, size.height * 0.9f / 4f)
    val tl = Offset((size.width - cell * 4) / 2, (size.height - cell * 4) / 2)
    for (row in 0 until 4) for (col in 0 until 4) {
        drawRect(if ((row + col) % 2 == 1) Color(0xFF6B3E22) else Color(0xFFE8CFA0), tl + Offset(col * cell, row * cell), Size(cell, cell))
    }
    fun at(col: Int, row: Int) = tl + Offset((col + 0.5f) * cell, (row + 0.5f) * cell)
    val r = cell * 0.4f
    val black = Color(0xFF2B2A2E)
    val cream = Color(0xFFEFE3C8)
    val j = ease(seg(t, 0.25f, 0.5f))
    val gone = seg(t, 0.38f, 0.5f)
    if (gone < 1f) stone(at(1, 2), r, cream, alpha = 1f - gone)
    stone(at(2, 1).let { e -> Offset(mix(at(0, 3).x, e.x, j), mix(at(0, 3).y, e.y, j) - r * 0.8f * sin(PI.toFloat() * j)) }, r, black)
    if (j <= 0f) drawCircle(Color(0x99FFFDF8), cell * 0.12f, at(2, 1))
    if (t > 0.55f) label(tm, "取った!", Offset(size.width / 2, size.height * 0.12f), size = 12)
}

// ---- ヨット ----

private fun yachtRoll(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val s = min(size.width * 0.8f / 5.6f, size.height * 0.62f)
    val gap = s * 0.15f
    val total = s * 5 + gap * 4
    val y = (size.height - s) / 2
    val final = intArrayOf(3, 3, 3, 5, 5)
    val before = intArrayOf(3, 3, 3, 1, 6)
    for (i in 0 until 5) {
        val x = (size.width - total) / 2 + i * (s + gap)
        val held = i < 3
        val rolling = !held && t in 0.3f..0.6f
        val face = when {
            held -> final[i]
            t < 0.3f -> before[i]
            rolling -> ((t * 60).toInt() + i * 2) % 6 + 1
            else -> final[i]
        }
        val wob = if (rolling) sin(t * 80 + i) * 12f else 0f
        rotate(wob, Offset(x + s / 2, y + s / 2)) {
            drawRoundRect(Color(0x55000000), Offset(x + 2f, y + 4f), Size(s, s), CornerRadius(s * 0.2f))
            drawRoundRect(Color.White, Offset(x, y), Size(s, s), CornerRadius(s * 0.2f))
            if (held) drawRoundRect(Color(0xFFFFC65C), Offset(x, y), Size(s, s), CornerRadius(s * 0.2f), style = Stroke(s * 0.07f))
            val q = s * 0.27f
            val spots = when (face) {
                1 -> listOf(0 to 0)
                2 -> listOf(-1 to -1, 1 to 1)
                3 -> listOf(-1 to -1, 0 to 0, 1 to 1)
                4 -> listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1)
                5 -> listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1)
                else -> listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1)
            }
            for ((dx, dy) in spots) drawCircle(if (face == 1) Color(0xFFD9483B) else Color(0xFF1E2430), s * 0.095f, Offset(x + s / 2 + dx * q, y + s / 2 + dy * q))
        }
    }
    if (t > 0.65f) label(tm, "フルハウス!", Offset(size.width / 2, size.height * 0.12f), size = 12)
}


// ---- チェス ----

/** 横に並んだチェスのマス(cols×rows)。マスの大きさと左上を返す */
private fun DrawScope.chessGrid(cols: Int, rows: Int, startDark: Boolean = false): Pair<Float, Offset> {
    val cell = min(size.width * 0.86f / cols, size.height * 0.86f / rows)
    val tl = Offset((size.width - cell * cols) / 2, (size.height - cell * rows) / 2)
    drawRoundRect(Color(0xFF5A3518), tl - Offset(5f, 5f), Size(cell * cols + 10f, cell * rows + 10f), CornerRadius(6f))
    for (r in 0 until rows) for (c in 0 until cols) {
        val dark = ((r + c) % 2 == 1) != startDark
        drawRect(if (dark) Color(0xFFA9774A) else Color(0xFFEBD3A8), tl + Offset(c * cell, r * cell), Size(cell, cell))
    }
    return cell to tl
}

private fun chessCastle(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = chessGrid(8, 1)
    fun at(c: Int) = tl + Offset((c + 0.5f) * cell, cell / 2)
    val k = ease(seg(t, 0.2f, 0.42f))
    val r = ease(seg(t, 0.45f, 0.65f))
    chessPiece(at(4).let { Offset(mix(it.x, at(6).x, k), it.y) }, cell, jp.yonekou.asobi26.core.games.Chess.K, true)
    chessPiece(at(7).let { Offset(mix(it.x, at(5).x, r), it.y - cell * 0.35f * sin(PI.toFloat() * r)) }, cell, jp.yonekou.asobi26.core.games.Chess.R, true)
    if (t > 0.7f) label(tm, "キャスリング", Offset(size.width / 2, size.height * 0.2f), size = 12)
}

private fun chessEnPassant(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = chessGrid(3, 3)
    fun at(c: Int, r: Int) = tl + Offset((c + 0.5f) * cell, (r + 0.5f) * cell)
    val P = jp.yonekou.asobi26.core.games.Chess.P
    // 黒のポーン(右の列)が上から2つ進み、白のポーン(真ん中の下)の真横に来る
    val down = ease(seg(t, 0.15f, 0.35f))
    val take = ease(seg(t, 0.5f, 0.7f))
    val gone = seg(t, 0.62f, 0.72f)
    val bp = Offset(at(2, 0).x, mix(at(2, 0).y, at(2, 2).y, down))
    if (gone < 1f) chessPiece(bp, cell, P, false, alpha = 1f - gone)
    val wFrom = at(1, 2)
    val wTo = at(2, 1)
    chessPiece(Offset(mix(wFrom.x, wTo.x, take), mix(wFrom.y, wTo.y, take)), cell, P, true)
    if (t in 0.38f..0.5f) drawCircle(Color(0x99FFFDF8), cell * 0.12f, wTo)
    if (t > 0.74f) label(tm, "アンパッサン", Offset(size.width / 2, size.height * 0.1f), size = 12)
}

private fun chessMate(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = chessGrid(5, 3)
    fun at(c: Int, r: Int) = tl + Offset((c + 0.5f) * cell, (r + 0.5f) * cell)
    val C = jp.yonekou.asobi26.core.games.Chess
    chessPiece(at(3, 0), cell, C.K, false)
    for (c in 2..4) chessPiece(at(c, 1), cell, C.P, false)
    val mv = ease(seg(t, 0.2f, 0.45f))
    val a = at(0, 2); val b = at(0, 0)
    chessPiece(Offset(a.x, mix(a.y, b.y, mv)), cell, C.R, true)
    if (t > 0.5f) {
        for (c in 0..4) drawRect(Color(0x33E0463A), tl + Offset(c * cell, 0f), Size(cell, cell))
        label(tm, "チェックメイト", Offset(size.width / 2, size.height * 0.88f), size = 12)
    }
}

// ---- 将棋 ----

/** 将棋の盤(cols×rows)。マスの大きさと左上を返す */
private fun DrawScope.shogiGrid(cols: Int, rows: Int, wFrac: Float = 0.62f): Pair<Float, Offset> {
    val cell = min(size.width * wFrac / cols, size.height * 0.86f / rows)
    val tl = Offset((size.width - cell * cols) / 2, (size.height - cell * rows) / 2)
    drawRoundRect(Color(0xFFE9C987), tl - Offset(6f, 6f), Size(cell * cols + 12f, cell * rows + 12f), CornerRadius(6f))
    for (k in 0..cols) drawLine(Color(0xFF5E3D14), tl + Offset(k * cell, 0f), tl + Offset(k * cell, rows * cell), 1.4f)
    for (k in 0..rows) drawLine(Color(0xFF5E3D14), tl + Offset(0f, k * cell), tl + Offset(cols * cell, k * cell), 1.4f)
    return cell to tl
}

private fun shogiPromote(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = shogiGrid(3, 4)
    // 上の3段が敵陣(うすい色)
    drawRect(Color(0x22B3261E), tl, Size(cell * 3, cell * 3))
    fun at(c: Int, r: Int) = tl + Offset((c + 0.5f) * cell, (r + 0.5f) * cell)
    val S = jp.yonekou.asobi26.core.games.Shogi
    val mv = ease(seg(t, 0.15f, 0.35f))
    val flip = seg(t, 0.45f, 0.6f)
    val p = Offset(at(1, 3).x, mix(at(1, 3).y, at(1, 2).y, mv))
    val kind = if (flip < 0.5f) S.P else S.TO
    // 裏返す動き(横に縮んで戻る)
    val sx = kotlin.math.abs(kotlin.math.cos(PI.toFloat() * flip))
    scale(scaleX = sx.coerceAtLeast(0.05f), scaleY = 1f, pivot = p) { komaPiece(tm, p, cell * 0.84f, kind, upside = false) }
    if (t > 0.62f) label(tm, "成った!", Offset(size.width / 2, size.height * 0.1f), size = 12)
}

private fun shogiDrop(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (cell, tl) = shogiGrid(3, 3, wFrac = 0.45f)
    fun at(c: Int, r: Int) = tl + Offset((c + 0.5f) * cell, (r + 0.5f) * cell)
    val S = jp.yonekou.asobi26.core.games.Shogi
    // 駒台(右)
    val stand = Offset(tl.x + cell * 3 + cell * 0.7f, tl.y + cell * 1.5f)
    drawRoundRect(Color(0xFFB98A50), stand - Offset(cell * 0.55f, cell * 0.6f), Size(cell * 1.1f, cell * 1.2f), CornerRadius(8f))
    // 1) 飛車が相手の銀を取る
    val take = ease(seg(t, 0.1f, 0.28f))
    val toHand = ease(seg(t, 0.3f, 0.48f))
    val drop = ease(seg(t, 0.6f, 0.8f))
    val rook = Offset(at(0, 2).x, mix(at(0, 2).y, at(0, 0).y, take))
    komaPiece(tm, rook, cell * 0.84f, S.R, upside = false)
    // 取られた銀: 盤から駒台へ、向きを変えて移る
    if (take < 1f) komaPiece(tm, at(0, 0), cell * 0.84f, S.S, upside = true)
    else if (drop <= 0f) {
        val p = Offset(mix(at(0, 0).x, stand.x, toHand), mix(at(0, 0).y, stand.y, toHand))
        komaPiece(tm, p, cell * 0.84f * (1f - 0.2f * toHand), S.S, upside = toHand < 0.5f)
    } else {
        val target = at(2, 1)
        val p = Offset(mix(stand.x, target.x, drop), mix(stand.y, target.y, drop) - cell * 0.3f * sin(PI.toFloat() * drop))
        komaPiece(tm, p, cell * 0.84f * (0.8f + 0.2f * drop), S.S, upside = false)
    }
    if (t > 0.82f) label(tm, "打った!", Offset(size.width / 2, size.height * 0.1f), size = 12)
}


// ---- バックギャモン ----

/** 横一列のポイント(下向きの三角)を描き、列の幅と左端・上端を返す */
private fun DrawScope.bgStrip(cols: Int): Triple<Float, Float, Float> {
    val colW = min(size.width * 0.86f / cols, size.height * 0.5f)
    val left = (size.width - colW * cols) / 2
    val top = size.height * 0.12f
    val h = size.height * 0.76f
    drawRoundRect(Color(0xFF5A3518), Offset(left - 6f, top - 6f), Size(colW * cols + 12f, h + 12f), CornerRadius(6f))
    drawRect(Color(0xFFE9D3A6), Offset(left, top), Size(colW * cols, h))
    for (c in 0 until cols) {
        val x = left + c * colW
        drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(x, top + h); lineTo(x + colW, top + h); lineTo(x + colW / 2, top + h * 0.3f); close() },
            if (c % 2 == 0) Color(0xFFB8452A) else Color(0xFF3E4659))
    }
    return Triple(colW, left, top + h)
}

private fun bgMove(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (colW, left, bottom) = bgStrip(10)
    val r = colW * 0.42f
    fun at(c: Int) = Offset(left + (c + 0.5f) * colW, bottom - r)
    val white = Color(0xFFF4F0E6)
    drawDie(Offset(size.width * 0.38f, size.height * 0.28f), r * 1.4f, 5)
    drawDie(Offset(size.width * 0.62f, size.height * 0.28f), r * 1.4f, 3)
    val a = ease(seg(t, 0.15f, 0.4f))
    val b = ease(seg(t, 0.5f, 0.75f))
    // 9番目の列の駒が 5つ → 3つ進む(右から左へ)
    val p1 = Offset(mix(at(9).x, at(4).x, a), at(9).y - r * 1.5f * sin(PI.toFloat() * a))
    val p2 = Offset(mix(at(4).x, at(1).x, b), at(4).y - r * 1.5f * sin(PI.toFloat() * b))
    stone(if (b > 0f) p2 else p1, r, white)
}

private fun bgHit(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val (colW, left, bottom) = bgStrip(8)
    val r = colW * 0.42f
    fun at(c: Int) = Offset(left + (c + 0.5f) * colW, bottom - r)
    val white = Color(0xFFF4F0E6)
    val black = Color(0xFF2A2730)
    val mv = ease(seg(t, 0.15f, 0.4f))
    val fly = ease(seg(t, 0.45f, 0.7f))
    val barPos = Offset(size.width / 2, size.height * 0.2f)
    drawRoundRect(Color(0xFF5A3518), Offset(barPos.x - r * 1.4f, 0f), Size(r * 2.8f, barPos.y + r * 1.3f), CornerRadius(6f))
    // 黒の駒(1つだけ)が打たれて、上のバーへ
    stone(Offset(mix(at(2).x, barPos.x, fly), mix(at(2).y, barPos.y, fly)), r, black)
    stone(Offset(mix(at(6).x, at(2).x, mv), at(6).y - r * 1.5f * sin(PI.toFloat() * mv)), r, white)
    if (t > 0.72f) label(tm, "バーへ", Offset(barPos.x, barPos.y + r * 1.8f), size = 12)
}

// ---- ルドー ----

private fun ludoStart(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cell = min(size.width * 0.8f / 9f, size.height * 0.85f / 4f)
    val left = (size.width - cell * 9) / 2
    val top = (size.height - cell * 4) / 2
    val red = Color(0xFFE0463A)
    // 家(左)と、出発のマスから始まる道
    drawRoundRect(red, Offset(left, top), Size(cell * 3.6f, cell * 4), CornerRadius(cell * 0.4f))
    drawRoundRect(Color(0xFFFBF8F0), Offset(left + cell * 0.5f, top + cell * 0.5f), Size(cell * 2.6f, cell * 3f), CornerRadius(cell * 0.3f))
    for (k in 0 until 5) {
        val x = left + cell * 4f + k * cell
        drawRect(if (k == 0) red else Color.White, Offset(x, top + cell * 1.5f), Size(cell, cell))
        drawRect(Color(0x33000000), Offset(x, top + cell * 1.5f), Size(cell, cell), style = Stroke(1f))
    }
    drawDie(Offset(left + cell * 6.5f, top + cell * 0.55f), cell * 0.9f, if (t < 0.25f) ((t * 40).toInt() % 6) + 1 else 6)
    val go = ease(seg(t, 0.35f, 0.6f))
    val home = Offset(left + cell * 1.8f, top + cell * 2f)
    val start = Offset(left + cell * 4.5f, top + cell * 2f)
    val p = Offset(mix(home.x, start.x, go), mix(home.y, start.y, go) - cell * 0.6f * sin(PI.toFloat() * go))
    ludoPawn(p, cell, red)
    if (t > 0.62f) label(tm, "出発!", Offset(size.width / 2, size.height * 0.88f), size = 12)
}

private fun ludoCapture(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val cell = min(size.width * 0.86f / 8f, size.height * 0.5f)
    val left = (size.width - cell * 8) / 2
    val y = size.height * 0.55f
    for (k in 0 until 8) {
        drawRect(Color.White, Offset(left + k * cell, y - cell / 2), Size(cell, cell))
        drawRect(Color(0x33000000), Offset(left + k * cell, y - cell / 2), Size(cell, cell), style = Stroke(1f))
    }
    fun at(k: Int) = Offset(left + (k + 0.5f) * cell, y)
    val red = Color(0xFFE0463A); val blue = Color(0xFF3A7BE0)
    drawDie(Offset(size.width / 2, size.height * 0.17f), cell * 0.7f, 4)
    val steps = 4
    val prog = (seg(t, 0.15f, 0.55f) * steps)
    val i = min(prog.toInt(), steps - 1)
    val f = ease(prog - i)
    val gone = seg(t, 0.55f, 0.7f)
    if (gone < 1f) ludoPawn(at(5) - Offset(0f, gone * cell), cell * (1f - gone * 0.6f), blue)
    val p = Offset(mix(at(1 + i).x, at(2 + i).x, f), y - cell * 0.4f * sin(PI.toFloat() * f))
    ludoPawn(p, cell, red)
    if (t > 0.7f) label(tm, "家に戻す", Offset(size.width / 2, size.height * 0.88f), size = 12)
}

// ---- チャイニーズチェッカー ----

private fun ccJump(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val sp = min(size.width * 0.8f / 7f, size.height * 0.85f / 5f)
    val cx = size.width / 2
    val cy = size.height / 2
    // 斜めに並んだ穴の列(下から上へ)
    fun at(k: Int) = Offset(cx + (k - 2) * sp * 0.5f, cy + (2 - k) * sp * 0.87f)
    for (k in -1..5) drawCircle(Color(0xFF7A5228), sp * 0.18f, Offset(cx + (k - 2) * sp * 0.5f, cy + (2 - k) * sp * 0.87f))
    val blue = Color(0xFF3A7BE0)
    bead(at(1), sp * 0.27f, blue)
    bead(at(3), sp * 0.27f, blue)
    val red = Color(0xFFE0463A)
    val j1 = ease(seg(t, 0.15f, 0.38f))
    val j2 = ease(seg(t, 0.45f, 0.68f))
    val p = when {
        j2 > 0f -> Offset(mix(at(2).x, at(4).x, j2), mix(at(2).y, at(4).y, j2) - sp * 0.5f * sin(PI.toFloat() * j2))
        else -> Offset(mix(at(0).x, at(2).x, j1), mix(at(0).y, at(2).y, j1) - sp * 0.5f * sin(PI.toFloat() * j1))
    }
    bead(p, sp * 0.27f, red)
    if (t > 0.7f) label(tm, "2回続けて跳んだ!", Offset(size.width / 2, size.height * 0.1f), size = 12)
}


// ---- 碁 ----

private fun goCapture(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    val n = 5
    val cell = min(size.width * 0.8f / n, size.height * 0.86f / n)
    val tl = Offset((size.width - cell * (n - 1)) / 2, (size.height - cell * (n - 1)) / 2)
    drawRect(Color(0xFFE6BD78), tl - Offset(cell * 0.6f, cell * 0.6f), Size(cell * (n - 1) + cell * 1.2f, cell * (n - 1) + cell * 1.2f))
    for (k in 0 until n) {
        drawLine(Color(0xFF2A1A0A), tl + Offset(k * cell, 0f), tl + Offset(k * cell, (n - 1) * cell), 1.4f)
        drawLine(Color(0xFF2A1A0A), tl + Offset(0f, k * cell), tl + Offset((n - 1) * cell, k * cell), 1.4f)
    }
    fun at(c: Int, r: Int) = tl + Offset(c * cell, r * cell)
    val r = cell * 0.46f
    for ((c, rr) in listOf(1 to 2, 2 to 1, 3 to 2)) slateStone(at(c, rr), r)
    val place = seg(t, 0.25f, 0.35f)
    val gone = seg(t, 0.45f, 0.6f)
    if (gone < 1f) shellStone(at(2, 2), r, 30f, 1f - gone)
    if (place <= 0f) drawCircle(Color(0x99FFFDF8), cell * 0.12f, at(2, 3)) else slateStone(at(2, 3), r * popScale(place))
    if (t > 0.62f) label(tm, "取った!", Offset(size.width / 2, size.height * 0.1f), size = 12)
}

// ---- ポーカー ----

private fun pokerDraw(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    if (size.minDimension < 4f) return@with // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawRect(safeRadial(listOf(Color(0xFF2F8A5A), Color(0xFF1A5E3B)), Offset(size.width / 2, size.height / 2), size.width * 0.6f))
    val cw = min(size.width * 0.13f, size.height * 0.5f)
    val gap = cw * 0.15f
    val x0 = (size.width - (cw * 5 + gap * 4)) / 2
    val y0 = size.height * 0.5f - cw * 0.5f
    // J♠ J♥ 6♠ 9♦ 2♣ から 6♠ と 2♣ を交換し、9♣ と 3♥ が来てツーペアになる(札は マーク*13 + 数-2)
    val before = intArrayOf(9, 22, 4, 33, 39)
    val lift = seg(t, 0.15f, 0.3f)
    val swap = seg(t, 0.45f, 0.7f)
    for (i in 0 until 5) {
        val chosen = i == 2 || i == 4
        val up = if (chosen) cw * 0.35f * (lift - swap).coerceIn(0f, 1f) else 0f
        val x = x0 + i * (cw + gap)
        if (chosen && swap in 0.01f..0.99f) {
            val fx = kotlin.math.abs(kotlin.math.cos(PI.toFloat() * swap))
            scale(scaleX = fx.coerceAtLeast(0.05f), scaleY = 1f, pivot = Offset(x + cw / 2, y0)) {
                if (swap < 0.5f) playingCard(tm, Offset(x, y0 - up), cw, before[i], highlight = true) else cardBack(Offset(x, y0 - up), cw)
            }
        } else {
            val card = if (chosen && swap >= 1f) (if (i == 2) 46 else 14) else before[i]
            playingCard(tm, Offset(x, y0 - up), cw, card, highlight = chosen && lift > 0f && swap <= 0f)
        }
    }
    if (t > 0.75f) label(tm, "ツーペアになった!", Offset(size.width / 2, size.height * 0.12f), size = 12)
}


// ---- カードゲーム ----

private fun DrawScope.felt() {
    if (size.minDimension < 4f) return // 半径0の陰影は Android で例外になる(0.4.5 の不具合)
    drawRect(safeRadial(listOf(Color(0xFF2F8A5A), Color(0xFF1A5E3B)), Offset(size.width / 2, size.height / 2), size.width * 0.6f))
}

/** めくる途中(t: 0 → 1 で裏 → 表) */
private fun DrawScope.demoFlip(tm: TextMeasurer, t: Float, tl: Offset, w: Float, card: Int, hl: Boolean = false) {
    if (t <= 0f) { cardBack(tl, w); return }
    if (t >= 1f) { playingCard(tm, tl, w, card, highlight = hl); return }
    val fx = abs(cos(PI.toFloat() * t)).coerceAtLeast(0.05f)
    scale(scaleX = fx, scaleY = 1f, pivot = Offset(tl.x + w / 2, tl.y)) {
        if (t < 0.5f) cardBack(tl, w) else playingCard(tm, tl, w, card)
    }
}

private fun memoryPair(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    felt()
    val cw = min(size.width * 0.1f, size.height * 0.36f)
    val gap = cw * 0.25f
    val x0 = (size.width - (cw * 6 + gap * 5)) / 2
    val y0 = (size.height - cw * 1.4f) / 2
    // 前半: 2番目(Q♠)と5番目(7♦)をめくって外れ。後半: 2番目と4番目(Q♥)で当たり
    val cards = intArrayOf(5, 10, 30, 23, 31, 47)
    for (i in 0 until 6) {
        val tl = Offset(x0 + i * (cw + gap), y0)
        val f = when (i) {
            1 -> seg(t, 0.05f, 0.12f) - seg(t, 0.38f, 0.45f) + seg(t, 0.55f, 0.62f)
            4 -> seg(t, 0.18f, 0.25f) - seg(t, 0.38f, 0.45f)
            3 -> seg(t, 0.68f, 0.75f)
            else -> 0f
        }
        val gone = (i == 1 || i == 3) && t > 0.92f
        if (gone) continue
        demoFlip(tm, f, tl, cw, cards[i], hl = (i == 1 || i == 3) && t > 0.75f)
    }
    if (t in 0.27f..0.42f) label(tm, "外れ", Offset(size.width / 2, size.height * 0.12f), size = 12)
    if (t > 0.76f) label(tm, "当たり! もう一度めくれます", Offset(size.width / 2, size.height * 0.12f), size = 12)
}

private fun bjHit(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    felt()
    val cw = min(size.width * 0.14f, size.height * 0.5f)
    val y0 = size.height * 0.56f - cw * 0.7f
    val x0 = size.width * 0.3f
    // K♠(11) 7♥(18) と、引いた 4♣(41)
    playingCard(tm, Offset(x0, y0), cw, 11)
    playingCard(tm, Offset(x0 + cw * 0.55f, y0), cw, 18)
    val k = seg(t, 0.3f, 0.5f)
    if (k > 0f) {
        val from = Offset(size.width * 0.85f, size.height * 0.08f)
        val to = Offset(x0 + cw * 1.1f, y0)
        val p = from + (to - from) * k
        if (k < 1f) cardBack(p, cw) else playingCard(tm, p, cw, 41, highlight = t > 0.55f)
    } else cardBack(Offset(size.width * 0.85f, size.height * 0.08f), cw)
    label(tm, if (k >= 1f) "合計 21" else "合計 17", Offset(x0 + cw * 0.9f, size.height * 0.14f), size = 13)
}

private fun sevensNext(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    felt()
    val mw = min(size.width * 0.9f / 9.8f, size.height * 0.55f / 1.4f)
    val gx = mw * 0.1f
    val x0 = (size.width - (mw * 9 + gx * 8)) / 2
    val y0 = size.height * 0.5f - mw * 0.7f
    // ♥ の列(数 2〜10)。6・7・8 が出ていて、5 と 9 が出せる
    for (k in 0 until 9) {
        val n = k + 2
        val card = 13 + (n - 2)
        val tl = Offset(x0 + k * (mw + gx), y0)
        when {
            n in 6..8 -> miniCard(tm, tl, mw, card)
            n == 9 && t > 0.6f -> miniCard(tm, tl - Offset(0f, mw * 0.2f * (1f - seg(t, 0.6f, 0.7f))), mw, card)
            n == 5 || n == 9 -> drawRoundRect(ACCENT.copy(alpha = 0.5f + 0.5f * abs(sin(t * 12f))), tl, Size(mw, mw * 1.4f), CornerRadius(mw * 0.12f), style = Stroke(3f))
            else -> drawRoundRect(Color.White.copy(alpha = 0.15f), tl, Size(mw, mw * 1.4f), CornerRadius(mw * 0.12f), style = Stroke(1.5f))
        }
    }
}

private fun DrawScope.fan(tm: TextMeasurer, cards: IntArray, cx: Float, y: Float, cw: Float, alpha: Float = 1f, hl: Boolean = false) {
    val tot = cw + (cards.size - 1) * cw * 0.55f
    for ((i, c) in cards.withIndex()) playingCard(tm, Offset(cx - tot / 2 + i * cw * 0.55f, y), cw, c, alpha = alpha, highlight = hl)
}

private fun daifugoBeat(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    felt()
    val cw = min(size.width * 0.13f, size.height * 0.45f)
    val y = size.height * 0.5f - cw * 0.7f
    // 5♠5♥(3,16) の上に、9♦9♣(33,46) を出す
    fan(tm, intArrayOf(3, 16), size.width * 0.35f, y, cw, alpha = if (t > 0.55f) 0.5f else 1f)
    val k = seg(t, 0.3f, 0.55f)
    if (k > 0f) fan(tm, intArrayOf(33, 46), size.width * 0.35f + size.width * 0.3f * k, y + size.height * 0.3f * (1f - k), cw, hl = k >= 1f)
    label(tm, if (k >= 1f) "9のペアで勝ち" else "5のペア", Offset(size.width / 2, size.height * 0.12f), size = 12)
}

private fun daifugoRev(d: DrawScope, t: Float, tm: TextMeasurer): Unit = with(d) {
    felt()
    val cw = min(size.width * 0.12f, size.height * 0.42f)
    val k = seg(t, 0.15f, 0.4f)
    // 6を4枚(4,17,30,43)
    fan(tm, intArrayOf(4, 17, 30, 43), size.width / 2, size.height * 0.55f - cw * 0.7f + size.height * 0.3f * (1f - k), cw, hl = k >= 1f)
    if (t > 0.45f) {
        label(tm, "革命!", Offset(size.width / 2, size.height * 0.13f), color = Color(0xFFFF9A8A), size = 16)
        label(tm, "強い 3 > 4 > … > A > 2 弱い", Offset(size.width / 2, size.height * 0.9f), size = 11)
    } else label(tm, "強い 2 > A > … > 4 > 3 弱い", Offset(size.width / 2, size.height * 0.9f), size = 11)
}


private fun DrawScope.newCardDemo(t:Float,tm:TextMeasurer,kind:Int) {
    val w=size.width/7;val y=size.height*0.2f;val travel=(t*1.5f).coerceIn(0f,1f)
    if(kind==0){
        for(i in 0..1){val x=size.width*(if(i==0)0.2f else 0.65f)-if(i==1)size.width*0.3f*travel else 0f
            drawRoundRect(Color(0xFFFFF3DA),Offset(x,y),Size(w*1.4f,w*1.7f),androidx.compose.ui.geometry.CornerRadius(8f))
            drawText(tm.measure("桜",TextStyle(color=Color(0xFFA62C51),fontSize=22.sp)),topLeft=Offset(x+w*0.2f,y+w*0.4f))
        }
    }else if(kind==3){
        // Oh, No!: 赤5の上に、同じ色の赤8を出す
        ohNoCard(tm,9,at=Offset(size.width*0.2f,y),cw=w*1.2f,ch=w*1.74f)
        ohNoCard(tm,15,at=Offset(size.width*(0.65f-0.3f*travel)+w*0.15f*travel,y+w*0.12f*travel),cw=w*1.2f,ch=w*1.74f)
    }else{
        val base=when(kind){1->5;2->12;else->3}
        playingCard(tm,Offset(size.width*0.2f,y),w,base)
        playingCard(tm,Offset(size.width*(0.65f-0.3f*travel),y+w*0.15f*travel),w,base+14)
    }
}

private fun DrawScope.mahjongDiscard(t:Float,tm:TextMeasurer){
    val w=size.width/9;val h=w*1.4f;val progress=(t*1.6f).coerceIn(0f,1f)
    for(i in 0..5){val x=w*(1+i)+(if(i==2)w*progress else 0f);val y=size.height-h-(if(i==2)(size.height-h)*progress else 0f)
        drawRoundRect(Color(0xFFFFF8E7),Offset(x,y),Size(w-3,h),androidx.compose.ui.geometry.CornerRadius(5f))
        drawText(tm.measure("${i+1}萬",TextStyle(fontSize=14.sp,color=Color(0xFF173A52))),topLeft=Offset(x+3,y+h/3))
    }
}

/** 人生すごろく: 7が出て進む。給料日を通ると給料、ストップで止まる */
private fun DrawScope.lifeMove(t: Float, tm: TextMeasurer) {
    val n = 6
    val w = size.width / (n + 0.6f)
    val h = w * 0.72f
    val top = size.height - h - 8f
    val kinds = listOf("", "", "給料日", "", "ストップ!", "")
    for (i in 0 until n) {
        val x = w * 0.3f + i * w
        val red = i == 2
        val stop = i == 4
        drawRect(if (red) Color(0xFFE23B2E) else if (stop) Color.White else Color(0xFFFFF8DC), Offset(x, top), Size(w - 4f, h))
        drawRect(if (stop) Color(0xFFC9281C) else Color(0xFF4A3520), Offset(x, top), Size(w - 4f, h), style = Stroke(if (stop) 5f else 3f))
        if (kinds[i].isNotEmpty()) {
            val lay = tm.measure(kinds[i], TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (red) Color.White else Color(0xFFC9281C)))
            drawText(lay, topLeft = Offset(x + (w - 4f - lay.size.width) / 2, top + (h - lay.size.height) / 2))
        }
    }
    // 0〜0.25: ルーレットに「7」 0.25〜0.75: 1マスずつ進む(4マス目のストップで止まる)
    val steps = ((t - 0.25f) / 0.5f * 4f).coerceIn(0f, 4f)
    val at = steps.toInt().coerceAtMost(4)
    val x = w * 0.3f + at * w + w / 2 - 2f
    drawCircle(Color(0xFFE2574C), w * 0.13f, Offset(x, top - w * 0.2f))
    drawCircle(Color(0xFF4A3520), w * 0.13f, Offset(x, top - w * 0.2f), style = Stroke(3f))
    val roll = tm.measure("ルーレット 7", TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF2B1D10)))
    drawText(roll, topLeft = Offset(8f, 4f))
    if (at >= 2) {
        val pay = tm.measure("給料 +$12,000", TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF1257B8)))
        drawText(pay, topLeft = Offset(w * 0.3f + 2 * w, 4f + roll.size.height))
    }
    if (at >= 4) {
        val stop = tm.measure("3つ余っても止まる", TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFC9281C)))
        drawText(stop, topLeft = Offset(size.width - stop.size.width - 8f, 4f))
    }
}
