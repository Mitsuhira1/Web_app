package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Cards
import jp.yonekou.asobi26.core.games.KlondikeBoard
import jp.yonekou.asobi26.core.games.Solitaire
import jp.yonekou.asobi26.core.games.SolitaireState

// =====================================================================
// ソリティア(クロンダイク)。並べ方は一般的なパソコンのソリティアと同じ:
// 左上に山札とめくった札、右上に組札4つ、下に7列。札はタップで選んで行き先をタップ、またはドラッグで動かす。
// 選んだ札をもう一度タップすると、組札(だめなら置ける列)へ自動で動かす。
// =====================================================================

/** 盤の上の場所。src は Solitaire の番号(1 = めくった札、2〜5 = 組札、6〜12 = 列)。0 = 山札 */
private class SolLayout(val w: Float, val h: Float, b: KlondikeBoard, drawCount: Int) {
    val gap = w * 0.018f
    val cw = (w - gap * 8) / 7f
    val ch = cw * 1.4f
    val top = gap
    fun colX(i: Int) = gap + i * (cw + gap)
    val stock = Rect(colX(0), top, colX(0) + cw, top + ch)
    /** めくった札(3枚めくりは少しずらして3枚まで見せる) */
    val wasteShown = b.waste.takeLast(if (drawCount >= 3) 3 else 1)
    val wasteStep = cw * 0.28f
    fun wasteAt(k: Int) = Offset(colX(1) + k * wasteStep, top)
    val wasteTop: Rect get() { val o = wasteAt((wasteShown.size - 1).coerceAtLeast(0)); return Rect(o.x, o.y, o.x + cw, o.y + ch) }
    fun found(i: Int) = Rect(colX(3 + i), top, colX(3 + i) + cw, top + ch)
    val tabTop = top + ch + gap * 2.5f
    /** 列ごとの、裏と表の重ねる間(長い列は詰める) */
    val downStep = FloatArray(7)
    val upStep = FloatArray(7)
    init {
        for (i in 0 until 7) {
            val down = b.piles[i].size - b.open[i]
            val up = b.open[i]
            var d = ch * 0.12f; var u = ch * 0.27f
            val need = d * down + u * (up - 1).coerceAtLeast(0) + ch
            val avail = h - tabTop - gap
            if (need > avail && need > 0) { val k = ((avail - ch) / (need - ch)).coerceIn(0.2f, 1f); d *= k; u *= k }
            downStep[i] = d; upStep[i] = u
        }
    }
    fun cardY(i: Int, j: Int, down: Int): Float = tabTop + (if (j < down) j * downStep[i] else down * downStep[i] + (j - down) * upStep[i])
    fun column(i: Int) = Rect(colX(i), tabTop, colX(i) + cw, h)
}

@Composable
fun SolitaireBoard(ses: Session<SolitaireState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit) {
    val shown = LocalBoardShown.current
    LaunchedEffect(version) { shown(version) }
    val s = ses.state
    val me = viewSeat(ses)
    val b = s.boards[me]
    val g = ses.rules as Solitaire
    val legal = if (enabled) g.legalMovesFor(s, me).toSet() else emptySet()
    val tm = rememberTextMeasurer()
    // 選んでいる札(src と枚数)。-1 = なし
    // (タッチの処理は作り直さないので、状態は対局ごとに1つにして、手が進んだら選び直しにする)
    var selSrc by remember(ses) { mutableIntStateOf(-1) }
    var selCount by remember(ses) { mutableIntStateOf(1) }
    LaunchedEffect(version) { selSrc = -1; selCount = 1 }
    // ドラッグ中の札と指の位置
    var dragSrc by remember(ses) { mutableIntStateOf(-1) }
    var dragCount by remember(ses) { mutableIntStateOf(1) }
    var dragAt by remember(ses) { mutableStateOf(Offset.Zero) }
    var dragGrab by remember(ses) { mutableStateOf(Offset.Zero) }
    var askEnd by remember { mutableStateOf(false) }
    val slop = LocalViewConfiguration.current.touchSlop
    val legalNow by rememberUpdatedState(legal)
    val boardNow by rememberUpdatedState(b)
    val move by rememberUpdatedState(onMove)
    fun drawMove() = me * Solitaire.SEAT + Solitaire.DRAW
    fun code(src: Int, n: Int, dest: Int) = Solitaire.encode(me, src, n, dest)
    /** 自動で動かす先(組札を先に、次に列) */
    fun autoMove(src: Int, n: Int): Int? {
        val l = legalNow
        for (d in 2..5) code(src, n, d).let { if (it in l) return it }
        for (d in 6..12) code(src, n, d).let { if (it in l) return it }
        return null
    }

    Column(Modifier.fillMaxSize()) {
        // 競争の時は、相手の組札の枚数
        if (ses.seats.size > 1) Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            for (p in ses.seats.indices) if (p != me) Text("${seatLabel(ses, p)} 組札 ${s.boards[p].foundations.sumOf { it.size }}枚", color = LocalAsobi.current.sub, fontSize = 12.sp)
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val wPx = constraints.maxWidth.toFloat()
            val hPx = constraints.maxHeight.toFloat()
            val lay = SolLayout(wPx, hPx, b, g.draw)
            val layNow by rememberUpdatedState(lay)

            /** 指の下の札: (src, 枚数)。山札は (0, 0)、空の組札・列は (src, 0) */
            fun hit(p: Offset): Pair<Int, Int>? {
                val L = layNow; val bb = boardNow
                if (L.stock.contains(p)) return 0 to 0
                if (bb.waste.isNotEmpty() && L.wasteTop.contains(p)) return 1 to 1
                for (i in 0 until 4) if (L.found(i).contains(p)) return (2 + i) to (if (bb.foundations[i].isEmpty()) 0 else 1)
                for (i in 0 until 7) {
                    val col = L.column(i)
                    if (p.x < col.left || p.x > col.right || p.y < L.tabTop) continue
                    val pile = bb.piles[i]
                    val down = pile.size - bb.open[i]
                    for (j in pile.indices.reversed()) {
                        val y = L.cardY(i, j, down)
                        if (p.y >= y && p.y <= y + L.ch) return if (j < down) (6 + i) to 0 else (6 + i) to (pile.size - j)
                    }
                    return (6 + i) to 0
                }
                return null
            }
            /** 落とした所の行き先(列・組札) */
            fun dropTarget(p: Offset): Int? {
                val L = layNow
                for (i in 0 until 4) if (L.found(i).inflate(L.gap).contains(p)) return 2 + i
                for (i in 0 until 7) { val c = L.column(i); if (p.x >= c.left - L.gap / 2 && p.x <= c.right + L.gap / 2 && p.y >= L.tabTop - L.gap) return 6 + i }
                return null
            }
            fun tap(p: Offset) {
                val h = hit(p) ?: run { selSrc = -1; return }
                val (src, n) = h
                if (src == 0) { selSrc = -1; if (drawMove() in legalNow) move(drawMove()); return }
                if (selSrc >= 0 && selSrc != src) {
                    val m = code(selSrc, selCount, src)
                    if (m in legalNow) { selSrc = -1; move(m); return }
                }
                if (n <= 0) { selSrc = -1; return }
                if (selSrc == src && selCount == n) {
                    // もう一度タップ: 自動で動かす
                    autoMove(src, n)?.let { selSrc = -1; move(it); return }
                    selSrc = -1; return
                }
                selSrc = src; selCount = n
            }

            Canvas(
                Modifier.fillMaxSize().testTag("solitaireBoard").pointerInput(ses, enabled) {
                    if (!enabled) return@pointerInput
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        val start = down.position
                        val h = hit(start)
                        var dragging = false
                        var last = start
                        while (true) {
                            val ev = awaitPointerEvent()
                            val c = ev.changes.firstOrNull { it.id == down.id } ?: break
                            last = c.position
                            if (!dragging && h != null && h.first >= 1 && h.second > 0 && (last - start).getDistance() > slop) {
                                dragging = true
                                dragSrc = h.first; dragCount = h.second
                                // 掴んだ札の左上からの指の位置
                                val L = layNow; val bb = boardNow
                                val tl = when {
                                    h.first == 1 -> L.wasteTop.topLeft
                                    h.first in 2..5 -> L.found(h.first - 2).topLeft
                                    else -> { val i = h.first - 6; val pile = bb.piles[i]; Offset(L.colX(i), L.cardY(i, pile.size - h.second, pile.size - bb.open[i])) }
                                }
                                dragGrab = start - tl
                                selSrc = -1
                            }
                            if (dragging) { dragAt = last; c.consume() }
                            if (c.positionChange() != Offset.Zero && dragging) c.consume()
                            if (!c.pressed) break
                        }
                        if (dragging) {
                            val d = dropTarget(last)
                            val src = dragSrc; val n = dragCount
                            dragSrc = -1
                            if (d != null && d != src) { val m = code(src, n, d); if (m in legalNow) move(m) }
                        } else tap(start)
                    }
                },
            ) {
                val L = lay
                val outline = Color.White.copy(alpha = 0.35f)
                fun slot(r: Rect, label: String) {
                    drawRoundRect(Color.Black.copy(alpha = 0.12f), r.topLeft, r.size, CornerRadius(L.cw * 0.1f))
                    drawRoundRect(outline, r.topLeft, r.size, CornerRadius(L.cw * 0.1f), style = Stroke(2f))
                    if (label.isNotEmpty()) {
                        val lay2 = tm.measure(label, TextStyle(color = outline, fontSize = (L.cw * 0.42f / density).sp, fontWeight = FontWeight.Bold))
                        drawText(lay2, topLeft = r.center - Offset(lay2.size.width / 2f, lay2.size.height / 2f))
                    }
                }
                // フェルト
                drawRect(Brush.verticalGradient(listOf(Mat.feltTop, Mat.feltBottom)))
                // 山札
                if (b.stock.isNotEmpty()) {
                    if (b.stock.size > 1) cardBack(L.stock.topLeft + Offset(2f, 2f), L.cw)
                    cardBack(L.stock.topLeft, L.cw)
                } else slot(L.stock, if (b.waste.isNotEmpty() && Solitaire.DRAW + me * Solitaire.SEAT in legal) "↻" else "×")
                // めくった札
                if (b.waste.isEmpty()) slot(Rect(L.wasteAt(0), Size(L.cw, L.ch)), "")
                val dragWaste = dragSrc == 1
                L.wasteShown.forEachIndexed { k, c ->
                    val isTop = k == L.wasteShown.lastIndex
                    if (isTop && dragWaste) return@forEachIndexed
                    playingCard(tm, L.wasteAt(k), L.cw, c, highlight = isTop && selSrc == 1)
                }
                if (dragWaste && L.wasteShown.size >= 2) playingCard(tm, L.wasteAt(L.wasteShown.size - 2), L.cw, L.wasteShown[L.wasteShown.size - 2])
                // 組札
                for (i in 0 until 4) {
                    val f = b.foundations[i]
                    val dragging = dragSrc == 2 + i
                    val shownCard = if (dragging) f.getOrNull(f.size - 2) else f.lastOrNull()
                    if (shownCard == null) slot(L.found(i), Cards.SUITS[i]) else playingCard(tm, L.found(i).topLeft, L.cw, shownCard, highlight = selSrc == 2 + i)
                }
                // 列
                for (i in 0 until 7) {
                    val pile = b.piles[i]
                    val down = pile.size - b.open[i]
                    if (pile.isEmpty()) slot(Rect(Offset(L.colX(i), L.tabTop), Size(L.cw, L.ch)), "K")
                    val hideFrom = if (dragSrc == 6 + i) pile.size - dragCount else pile.size
                    for (j in pile.indices) {
                        if (j >= hideFrom) break
                        val o = Offset(L.colX(i), L.cardY(i, j, down))
                        if (j < down) cardBack(o, L.cw) else playingCard(tm, o, L.cw, pile[j], highlight = selSrc == 6 + i && j >= pile.size - selCount)
                    }
                }
                // 選んだ札: 太い黄色の枠で囲む
                if (selSrc >= 1 && dragSrc < 0) {
                    val r: Rect? = when (selSrc) {
                        1 -> L.wasteTop
                        in 2..5 -> L.found(selSrc - 2)
                        else -> {
                            val i = selSrc - 6; val pile = b.piles[i]; val down = pile.size - b.open[i]
                            if (pile.isEmpty()) null else Rect(L.colX(i), L.cardY(i, pile.size - selCount, down), L.colX(i) + L.cw, L.cardY(i, pile.size - 1, down) + L.ch)
                        }
                    }
                    if (r != null) drawRoundRect(Color(0xFFFFC845), r.topLeft - Offset(3f, 3f), Size(r.width + 6f, r.height + 6f), CornerRadius(L.cw * 0.12f), style = Stroke(4.dp.toPx()))
                }
                // ドラッグ中の札(指について動く)
                if (dragSrc >= 1) {
                    val cards = when (dragSrc) {
                        1 -> b.waste.takeLast(1)
                        in 2..5 -> b.foundations[dragSrc - 2].takeLast(1)
                        else -> b.piles[dragSrc - 6].takeLast(dragCount)
                    }
                    val base = dragAt - dragGrab
                    val step = if (dragSrc >= 6) L.upStep[dragSrc - 6] else 0f
                    cards.forEachIndexed { k, c -> playingCard(tm, base + Offset(0f, k * step), L.cw, c, highlight = true) }
                }
            }
        }
        // 下の操作(場所は固定)
        val foundationMove = if (selSrc >= 1) (2..5).map { code(selSrc, selCount, it) }.firstOrNull { it in legal }
            else legal.firstOrNull { it % Solitaire.SEAT > 1 && (it % 100) in 2..5 && (it % Solitaire.SEAT) / 10000 !in 2..5 }
        Text("山札 ${b.stock.size}枚 ・ 周回 ${b.passes}回 ・ ${b.moves}手", color = LocalAsobi.current.sub, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        CardButtonRow(listOf(
            CardBtn("組札へ", enabled && foundationMove != null, true) { selSrc = -1; foundationMove?.let(onMove) },
            CardBtn("終了", enabled) { askEnd = true },
        ))
    }
    if (askEnd) AlertDialog(
        onDismissRequest = { askEnd = false },
        title = { Text("この配札を終了しますか？") },
        text = { Text(if (ses.seats.size > 1) "他の人は続けられます。" else "結果画面から新しい配札で遊べます。") },
        confirmButton = { TextButton(onClick = { askEnd = false; onMove(me * Solitaire.SEAT + Solitaire.GIVE_UP) }) { Text("終了") } },
        dismissButton = { TextButton(onClick = { askEnd = false }) { Text("キャンセル") } },
    )
}
