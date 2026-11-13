package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.Chess
import jp.yonekou.asobi26.core.games.ChessState
import jp.yonekou.asobi26.core.games.Shogi
import jp.yonekou.asobi26.core.games.ShogiState
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.min

// =====================================================================
// 第1弾の盤: 将棋(9×9)・5五将棋(5×5)・チェス
// どの盤も rememberMoveAnim(手が進んだら必ず描き直す・動きの間は待たせる)と効果音の合図を使う。
// =====================================================================

private const val PIECE_MS = 230

private val KAYA_LIGHT = Color(0xFFE9C987)
private val KAYA_DARK = Color(0xFFD6AE66)
private val KAYA_LINE = Color(0xFF5E3D14)
private val LAST_MOVE = Color(0x40FFC65C)
private val CHECK_RED = Color(0x66E0463A)

// =====================================================================
// 将棋(9×9・5×5)
// =====================================================================

/** 盤と駒台の位置(Canvas の中) */
private class ShogiGeo(val w: Float, val hgt: Float, val n: Int) {
    val handH = w * 0.15f
    val margin = w * 0.035f
    val cell = min((w - 2 * margin) / n, (hgt - 2 * handH - 4 * margin) / n)
    val boardW = cell * n
    val left = (w - boardW) / 2
    val top = handH + 2 * margin
    fun cellCenter(dr: Int, dc: Int) = Offset(left + (dc + 0.5f) * cell, top + (dr + 0.5f) * cell)
    /** 駒台の駒の位置。bottom=true なら手前の台。k 番目 */
    fun handSlot(bottom: Boolean, k: Int, count: Int): Offset {
        val slotW = min(boardW / 7f, handH * 1.05f)
        val y = if (bottom) top + boardW + margin + handH / 2 else margin + handH / 2
        val total = slotW * count
        val x0 = if (bottom) left + boardW - total else left // 手前は右寄せ、奥は左寄せ
        return Offset(x0 + (k + 0.5f) * slotW, y)
    }
    val handPieceW get() = min(boardW / 7f, handH * 1.05f) * 0.72f
}

@Composable
fun ShogiBoard(ses: Session<ShogiState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val c = LocalAsobi.current
    val g = ses.rules as Shogi
    val tm = rememberTextMeasurer()
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, t ->
        delay(PIECE_MS.toLong() - 30)
        val cap = !g.isDrop(t.lastMove) && from.board[g.to(t.lastMove)] != 0
        sfx?.play(Sound.KOMA)
        if (cap) { delay(40); sfx?.play(Sound.TAKE, volume = 0.7f) }
    }) { _, t -> if (t.lastMove < 0) 0 else PIECE_MS + 60 }
    val st = ma.to
    // 人が後手なら、盤を回して自分の駒を手前にする
    val flip = ses.seats.getOrNull(1)?.human == true && ses.seats.getOrNull(0)?.human != true
    val bottomSide = if (flip) 1 else 0
    // 選んでいる駒: 盤のマス(0〜n-1)か、持ち駒(n + 種類)
    var sel by remember(ses) { mutableIntStateOf(-1) }
    var promoAsk by remember(ses) { mutableStateOf<Pair<Int, Int>?>(null) }
    LaunchedEffect(version) { sel = -1; promoAsk = null }
    val legal = if (enabled && ma.done) g.legalMoves(st) else IntArray(0)
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    val n = g.w
    fun view(sq: Int): Pair<Int, Int> { val r = sq / n; val col = sq % n; return if (flip) (n - 1 - r) to (n - 1 - col) else r to col }
    fun handKinds(s: ShogiState, side: Int) = (1..7).filter { s.hand(side, it) > 0 }.reversed() // 飛・角・金…の順

    Box(Modifier.fillMaxWidth().aspectRatio(0.80f), contentAlignment = Alignment.Center) {
        Canvas(
            Modifier.fillMaxSize().testTag("board").pointerInput(ses) {
                detectTapGestures { p ->
                    val lm = legalNow
                    if (lm.isEmpty() || promoAsk != null) return@detectTapGestures
                    val geo = ShogiGeo(size.width.toFloat(), size.height.toFloat(), n)
                    val stNow = ses.state
                    val me = stNow.turn
                    // 持ち駒(手前の台だけ。人の駒)
                    val kinds = handKinds(stNow, me)
                    val bottomMine = me == bottomSide
                    for ((k, kind) in kinds.withIndex()) {
                        val o = geo.handSlot(bottomMine, k, kinds.size)
                        if (abs(p.x - o.x) < geo.handPieceW * 0.7f && abs(p.y - o.y) < geo.handH * 0.5f) {
                            sel = if (sel == g.n + kind) -1 else g.n + kind
                            return@detectTapGestures
                        }
                    }
                    var col = ((p.x - geo.left) / geo.cell).toInt()
                    var row = ((p.y - geo.top) / geo.cell).toInt()
                    if (p.x < geo.left || p.y < geo.top || col !in 0 until n || row !in 0 until n) { sel = -1; return@detectTapGestures }
                    if (flip) { col = n - 1 - col; row = n - 1 - row }
                    val sq = row * n + col
                    if (sel >= 0) {
                        val cands = lm.filter { g.from(it) == sel && g.to(it) == sq }
                        if (cands.size == 1) { sel = -1; move(cands[0]); return@detectTapGestures }
                        if (cands.size == 2) {
                            promoAsk = cands.first { g.promotes(it) } to cands.first { !g.promotes(it) }
                            return@detectTapGestures
                        }
                    }
                    sel = if (lm.any { g.from(it) == sq }) sq else -1
                }
            },
        ) {
            val geo = ShogiGeo(size.width, size.height, n)
            val cell = geo.cell
            // 駒台
            for (bottom in listOf(false, true)) {
                val y = if (bottom) geo.top + geo.boardW + geo.margin else geo.margin
                woodPanel(Offset(geo.left, y), Size(geo.boardW, geo.handH), cell * 0.12f, Color(0xFFB98A50), Color(0xFF8C6234))
            }
            // 盤
            val bl = Offset(geo.left - cell * 0.12f, geo.top - cell * 0.12f)
            val bs = Size(geo.boardW + cell * 0.24f, geo.boardW + cell * 0.24f)
            drawRoundRect(KAYA_FLAT, bl, bs, CornerRadius(cell * 0.06f))
            grain(Grain.STRAIGHT, bl, bs, alpha = 0.18f)
            for (k in 0..n) {
                val lw = if (k == 0 || k == n) 2.4f else 1.2f
                drawLine(KAYA_LINE, Offset(geo.left + k * cell, geo.top), Offset(geo.left + k * cell, geo.top + geo.boardW), lw)
                drawLine(KAYA_LINE, Offset(geo.left, geo.top + k * cell), Offset(geo.left + geo.boardW, geo.top + k * cell), lw)
            }
            if (n == 9) for (a in listOf(3, 6)) for (b in listOf(3, 6)) drawCircle(KAYA_LINE, cell * 0.06f, Offset(geo.left + a * cell, geo.top + b * cell))
            // 直前の手・王手
            val last = st.lastMove
            if (last >= 0) {
                val (r, col) = view(g.to(last))
                drawRect(LAST_MOVE, Offset(geo.left + col * cell, geo.top + r * cell), Size(cell, cell))
            }
            if (st.inCheck && !st.over || (st.over && st.reason == "詰み")) {
                val k = g.kingSquare(st.board, st.turn)
                if (k >= 0) { val (r, col) = view(k); drawRect(CHECK_RED, Offset(geo.left + col * cell, geo.top + r * cell), Size(cell, cell)) }
            }
            if (sel in 0 until g.n) {
                val (r, col) = view(sel)
                drawRect(ACCENT.copy(alpha = 0.45f), Offset(geo.left + col * cell, geo.top + r * cell), Size(cell, cell))
            }
            // 駒(動いている駒は後で描く)
            val animating = !ma.done && last >= 0
            val moverTo = if (animating) g.to(last) else -1
            val pw = cell * 0.86f
            for (sq in 0 until g.n) {
                val v = st.board[sq]
                if (v == 0 || sq == moverTo) continue
                val (r, col) = view(sq)
                komaPiece(tm, geo.cellCenter(r, col), pw, abs(v), upside = (v > 0) != (bottomSide == 0))
            }
            // 取られた駒は、動きの途中まで元の場所に残す
            if (animating && !g.isDrop(last)) {
                val capV = ma.from.board[g.to(last)]
                val gone = (ma.elapsed / PIECE_MS).coerceIn(0f, 1f)
                if (capV != 0 && gone < 1f) {
                    val (r, col) = view(g.to(last))
                    komaPiece(tm, geo.cellCenter(r, col), pw, abs(capV), upside = (capV > 0) != (bottomSide == 0), alpha = 1f - gone * gone)
                }
            }
            // 駒台の持ち駒
            val showHands = if (animating) ma.from else st
            for (side in 0..1) {
                val bottom = side == bottomSide
                val kinds = handKinds(showHands, side)
                for ((k, kind) in kinds.withIndex()) {
                    val o = geo.handSlot(bottom, k, kinds.size)
                    if (sel == g.n + kind && side == st.turn) drawCircle(ACCENT.copy(alpha = 0.55f), geo.handPieceW * 0.75f, o)
                    komaPiece(tm, o, geo.handPieceW, kind, upside = !bottom)
                    val cnt = showHands.hand(side, kind)
                    if (cnt > 1) {
                        val lay = tm.measure("$cnt", TextStyle(color = Color.White, fontSize = (geo.handPieceW * 0.42f / density).sp, fontWeight = FontWeight.Black))
                        val bc = o + Offset(geo.handPieceW * 0.52f, geo.handPieceW * 0.42f)
                        drawCircle(Color(0xFF3A2410), geo.handPieceW * 0.27f, bc)
                        drawText(lay, topLeft = bc - Offset(lay.size.width / 2f, lay.size.height / 2f))
                    }
                }
            }
            // 動いている駒
            if (animating) {
                val t = ease((ma.elapsed / PIECE_MS).coerceIn(0f, 1f))
                val v = st.board[moverTo]
                val (tr, tc) = view(moverTo)
                val end = geo.cellCenter(tr, tc)
                val start = if (g.isDrop(last)) {
                    val side = ma.from.turn
                    val kinds = handKinds(ma.from, side)
                    geo.handSlot(side == bottomSide, kinds.indexOf(g.dropKind(last)).coerceAtLeast(0), kinds.size)
                } else { val (fr, fc) = view(g.from(last)); geo.cellCenter(fr, fc) }
                // 成る手は、途中まで成る前の駒で描く
                val kind = if (g.promotes(last) && t < 0.6f) Shogi.BASE[abs(v)] else abs(v)
                val lift = cell * 0.18f * kotlin.math.sin(Math.PI.toFloat() * t)
                komaPiece(tm, Offset(mix(start.x, end.x, t), mix(start.y, end.y, t) - lift), pw * (1f + 0.06f * kotlin.math.sin(Math.PI.toFloat() * t)), kind, upside = (v > 0) != (bottomSide == 0))
            }
            // 行き先の印
            if (sel >= 0 && promoAsk == null) {
                for (m in legal) if (g.from(m) == sel) {
                    val (r, col) = view(g.to(m))
                    if (!g.isDrop(m) && st.board[g.to(m)] != 0) captureFrame(geo.cellCenter(r, col), cell)
                    else targetDot(geo.cellCenter(r, col), cell)
                }
            }
        }
        // 成るか成らないかを選ぶ
        val ask = promoAsk
        if (ask != null) {
            Row(
                Modifier.clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.line, RoundedCornerShape(14.dp)).padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val kind = abs(ses.state.board[g.from(ask.first)])
                PromoChoice(tm, Shogi.PROMOTE[kind], "成る", primary = true) { promoAsk = null; sel = -1; move(ask.first) }
                PromoChoice(tm, kind, "成らない", primary = false) { promoAsk = null; sel = -1; move(ask.second) }
            }
        }
    }
}

@Composable
private fun PromoChoice(tm: TextMeasurer, kind: Int, label: String, primary: Boolean, onClick: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.clip(shape).background(if (primary) c.accent else c.chip).clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Canvas(Modifier.size(40.dp)) { komaPiece(tm, Offset(size.width / 2, size.height / 2), size.width * 0.78f, kind, upside = false) }
        Text(label, color = if (primary) c.onAccent else c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

// =====================================================================
// チェス
// =====================================================================

// 見やすさ優先の平らな色(緑とクリーム。木目は使わない)
private val SQ_LIGHT = Color(0xFFEEEED2)
private val SQ_DARK = Color(0xFF769656)

@Composable
fun ChessBoard(ses: Session<ChessState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val c = LocalAsobi.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { from, t ->
        delay(PIECE_MS.toLong() - 30)
        val m = t.lastMove
        val cap = from.board[Chess.toSq(m)] != 0 || (abs(from.board[Chess.fromSq(m)]) == Chess.P && Chess.toSq(m) == from.ep)
        sfx?.play(Sound.CHESS)
        if (cap) { delay(40); sfx?.play(Sound.TAKE, volume = 0.7f) }
    }) { _, t -> if (t.lastMove < 0) 0 else PIECE_MS + 60 }
    val st = ma.to
    val flip = ses.seats.getOrNull(1)?.human == true && ses.seats.getOrNull(0)?.human != true
    var sel by remember(ses) { mutableIntStateOf(-1) }
    var promoAsk by remember(ses) { mutableStateOf<List<Int>?>(null) }
    LaunchedEffect(version) { sel = -1; promoAsk = null }
    val legal = if (enabled && ma.done) Chess.legalMoves(st) else IntArray(0)
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    fun view(sq: Int): Pair<Int, Int> { val r = sq / 8; val col = sq % 8; return if (flip) (7 - r) to (7 - col) else r to col }

    Box(Modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
        Canvas(
            Modifier.fillMaxSize().testTag("board").pointerInput(ses) {
                detectTapGestures { p ->
                    val lm = legalNow
                    if (lm.isEmpty() || promoAsk != null) return@detectTapGestures
                    val m = size.width * 0.04f
                    val cell = (size.width - 2 * m) / 8f
                    var col = ((p.x - m) / cell).toInt()
                    var row = ((p.y - m) / cell).toInt()
                    if (p.x < m || p.y < m || col !in 0..7 || row !in 0..7) { sel = -1; return@detectTapGestures }
                    if (flip) { col = 7 - col; row = 7 - row }
                    val sq = row * 8 + col
                    if (sel >= 0) {
                        val cands = lm.filter { Chess.fromSq(it) == sel && Chess.toSq(it) == sq }
                        if (cands.size == 1) { sel = -1; move(cands[0]); return@detectTapGestures }
                        if (cands.size > 1) { promoAsk = cands.sortedByDescending { Chess.promo(it) }; return@detectTapGestures }
                    }
                    sel = if (lm.any { Chess.fromSq(it) == sq }) sq else -1
                }
            },
        ) {
            val w = size.width
            val m = w * 0.04f
            val cell = (w - 2 * m) / 8f
            fun at(sq: Int): Offset { val (r, col) = view(sq); return Offset(m + (col + 0.5f) * cell, m + (r + 0.5f) * cell) }
            drawRoundRect(Color(0xFF312E2B), cornerRadius = CornerRadius(w * 0.02f))
            for (r in 0 until 8) for (col in 0 until 8) {
                drawRect(if ((r + col) % 2 == 1) SQ_DARK else SQ_LIGHT, Offset(m + col * cell, m + r * cell), Size(cell, cell))
            }
            val last = st.lastMove
            if (last >= 0) for (sq in listOf(Chess.fromSq(last), Chess.toSq(last))) {
                val (r, col) = view(sq)
                drawRect(LAST_MOVE.copy(alpha = 0.38f), Offset(m + col * cell, m + r * cell), Size(cell, cell))
            }
            if (st.inCheck) {
                val k = Chess.kingSquare(st.board, st.turn)
                if (k >= 0) { val (r, col) = view(k); drawRect(CHECK_RED, Offset(m + col * cell, m + r * cell), Size(cell, cell)) }
            }
            if (sel >= 0) { val (r, col) = view(sel); drawRect(ACCENT.copy(alpha = 0.5f), Offset(m + col * cell, m + r * cell), Size(cell, cell)) }
            val animating = !ma.done && last >= 0
            val moverTo = if (animating) Chess.toSq(last) else -1
            // キャスリングで動くルーク
            val castleRook: Pair<Int, Int>? = if (animating && abs(ma.from.board[Chess.fromSq(last)]) == Chess.K && abs(Chess.toSq(last) - Chess.fromSq(last)) == 2) {
                val f = Chess.fromSq(last); val t = Chess.toSq(last)
                if (t > f) (t + 1) to (t - 1) else (t - 2) to (t + 1)
            } else null
            for (sq in 0 until 64) {
                val v = st.board[sq]
                if (v == 0 || sq == moverTo || sq == castleRook?.second) continue
                chessPiece(at(sq), cell, abs(v), v > 0)
            }
            if (animating) {
                val t = ease((ma.elapsed / PIECE_MS).coerceIn(0f, 1f))
                val from = ma.from
                // 取られた駒(アンパッサンは別のマス)
                val f = Chess.fromSq(last)
                val to = Chess.toSq(last)
                val capSq = if (abs(from.board[f]) == Chess.P && to == from.ep && from.board[to] == 0) to + (if (from.turn == 0) 8 else -8) else to
                val capV = from.board[capSq]
                if (capV != 0 && t < 1f) chessPiece(at(capSq), cell, abs(capV), capV > 0, alpha = 1f - t * t)
                val v = st.board[to]
                val kind = if (Chess.promo(last) != 0 && t < 0.7f) Chess.P else abs(v)
                val a = at(f); val b = at(to)
                chessPiece(Offset(mix(a.x, b.x, t), mix(a.y, b.y, t)), cell * (1f + 0.05f * kotlin.math.sin(Math.PI.toFloat() * t)), kind, v > 0)
                if (castleRook != null) {
                    val ra = at(castleRook.first); val rb = at(castleRook.second)
                    val rv = st.board[castleRook.second]
                    chessPiece(Offset(mix(ra.x, rb.x, t), mix(ra.y, rb.y, t)), cell, abs(rv), rv > 0)
                }
            }
            if (sel >= 0 && promoAsk == null) {
                for (mv in legal) if (Chess.fromSq(mv) == sel) {
                    val o = at(Chess.toSq(mv))
                    val enPassant = abs(st.board[Chess.fromSq(mv)]) == Chess.P && Chess.toSq(mv) == st.ep
                    if (st.board[Chess.toSq(mv)] != 0) captureFrame(o, cell)
                    else if (enPassant) { targetDot(o, cell); captureFrame(at(Chess.fromSq(mv) / 8 * 8 + Chess.toSq(mv) % 8), cell) }
                    else targetDot(o, cell)
                }
            }
        }
        val ask = promoAsk
        if (ask != null) {
            val white = ses.state.turn == 0
            Row(
                Modifier.clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.line, RoundedCornerShape(14.dp)).padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (mv in ask) {
                    Box(
                        Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(if (Chess.promo(mv) == Chess.Q) c.accent else c.chip)
                            .clickable(role = Role.Button) { promoAsk = null; sel = -1; move(mv) },
                    ) {
                        Canvas(Modifier.fillMaxSize()) { chessPiece(Offset(size.width / 2, size.height / 2), size.width * 0.9f, Chess.promo(mv), white) }
                    }
                }
            }
        }
    }
}
