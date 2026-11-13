package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.audio.Sound
import jp.yonekou.asobi26.core.Session
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import jp.yonekou.asobi26.core.games.C4State
import jp.yonekou.asobi26.core.games.ConnectFour
import jp.yonekou.asobi26.core.games.DotsBoxes
import jp.yonekou.asobi26.core.games.DotsState
import jp.yonekou.asobi26.core.games.Guess
import jp.yonekou.asobi26.core.games.HitBlow
import jp.yonekou.asobi26.core.games.HitBlowState
import jp.yonekou.asobi26.core.games.MancalaState
import jp.yonekou.asobi26.core.games.Reversi
import jp.yonekou.asobi26.core.games.ReversiState
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// =====================================================================
// 1手ぶんの変化のアニメーション(全ゲーム共通の仕組み)
//
// 注意: Session は Compose の状態ではないので、盤の関数には必ず version(手が進むたびに変わる数)を渡す。
// 渡さないと、引数が前と同じ(同じ人の番が続く時・終局の時)と判断されて描き直しが省かれ、盤が止まって見える。
// =====================================================================

/** from(直前に見せていた状態)から to(いまの状態)へ。elapsed は開始からのミリ秒、done は終わったか */
class MoveAnim<S>(val from: S, val to: S, private val elapsedOf: () -> Float, private val doneOf: () -> Boolean) {
    constructor(from: S, to: S, elapsed: Float, done: Boolean) : this(from, to, { elapsed }, { done })
    // Web 版の軽量化: 経過時間は読んだ時に取り出す。盤の絵(Canvas)の中だけで読めば、
    // 動きの間は絵だけを描き直し、盤の部品全体を毎コマ作り直さない(値は前と同じ)
    val elapsed: Float get() = elapsedOf()
    val done: Boolean get() = doneOf()
}

/**
 * 対局が進むたびに変わる数(AppModel.tick)。盤や表示の部品はこれを読むので、
 * 親の部品が描き直しを省いても、手が進めば必ず描き直される。
 */
val LocalTick = compositionLocalOf { 0 }

/**
 * CPU の手番の長さ。factor は CPU の手の動きの長さの倍率(設定の「短め・普通・長め」)、
 * skip は CPU の番をとばしている間(画面のダブルタップ)で、その間の CPU の手は動きを見せない。
 */
object CpuPace {
    @Volatile var factor: Float = 1f
    @Volatile var skip: Boolean = false
}

/** 盤が version の局面を描き終えた(アニメーションが終わった)ことを知らせる先 */
val LocalBoardShown = staticCompositionLocalOf<(Int) -> Unit> { {} }

/**
 * 手が1つ進んだ時だけアニメーションする(待った・やり直し・再開は一瞬で切り替える)。
 * アニメーション中は onBusy(true) にして、人の操作と CPU の手の適用を待たせる。
 * 描き終えたら LocalBoardShown に知らせる(それまで結果の板や CPU の次の手は待つ)。
 */
@Composable
fun <S> rememberMoveAnim(
    ses: Session<S>,
    onBusy: (Boolean) -> Unit,
    onStep: (suspend (from: S, to: S) -> Unit)? = null,
    durationOf: (S, S) -> Int,
): MoveAnim<S> {
    LocalTick.current // 手が進んだら必ず描き直す
    val st = ses.state
    val count = ses.moves.size
    val version = ses.version
    var shown by remember(ses) { mutableStateOf(st) }
    var shownCount by remember(ses) { mutableIntStateOf(count) }
    val anim = remember(ses) { Animatable(0f) }
    var total by remember(ses) { mutableIntStateOf(1) }
    // 実際の長さ ÷ 盤が考えている長さ(盤の描き方は元の長さの時間で計算するので、経過時間を戻して渡す)
    var stretch by remember(ses) { mutableFloatStateOf(1f) }
    val busy by rememberUpdatedState(onBusy)
    val shownCb by rememberUpdatedState(LocalBoardShown.current)
    val stepping = count == shownCount + 1 && shown !== st
    LaunchedEffect(ses, version) {
        if (count == shownCount + 1 && shown !== st) {
            // CPU の手は、設定の長さに合わせる(とばしている間は動きを見せない)
            val mover = ses.rules.toMove(shown)
            val byCpu = mover in ses.seats.indices && !ses.seats[mover].human && !ses.seats[mover].remote
            val base = durationOf(shown, st)
            val ms = if (!byCpu || base <= 0) base else if (CpuPace.skip) 1 else (base * CpuPace.factor).toInt().coerceAtLeast(1)
            if (ms > 0) {
                total = ms
                stretch = ms.toFloat() / base.coerceAtLeast(1)
                busy(true)
                val from = shown
                try {
                    coroutineScope {
                        // 効果音などの合図(動きと同時に進める。動きより長くしない)
                        if (onStep != null && !(byCpu && CpuPace.skip)) launch { onStep(from, st) }
                        anim.snapTo(0f)
                        anim.animateTo(ms.toFloat(), tween(ms, easing = LinearEasing))
                    }
                } finally {
                    busy(false)
                }
            }
        }
        shown = st
        shownCount = count
        shownCb(version)
    }
    val doneState = remember(ses) { derivedStateOf { (if (anim.isRunning) anim.value else 0f) >= total } }
    if (!stepping) return MoveAnim(st, st, 0f, true)
    return MoveAnim(shown, st, { (if (anim.isRunning) anim.value else 0f) / stretch }, { doneState.value })
}

/** 弾みながら落ちる動き(0〜1) */
fun bounceOut(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    val n = 7.5625f
    val d = 2.75f
    return when {
        x < 1 / d -> n * x * x
        x < 2 / d -> { val y = x - 1.5f / d; n * y * y + 0.75f }
        x < 2.5 / d -> { val y = x - 2.25f / d; n * y * y + 0.9375f }
        else -> { val y = x - 2.625f / d; n * y * y + 0.984375f }
    }
}

/** 少し大きくなってから戻る(置いた瞬間の「ポン」) */
fun popScale(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return if (x < 0.6f) ease(x / 0.6f) * 1.12f else mix(1.12f, 1f, ease((x - 0.6f) / 0.4f))
}

val INK_BLUE = Color(0xFF24427A)
val INK_RED = Color(0xFFB23A24)

// =====================================================================
// リバーシ
// =====================================================================

private const val RV_PLACE = 200f
private const val RV_FLIP = 260f
private const val RV_STEP = 75f

private fun reversiDist(a: Int, b: Int) = max(abs(a / 8 - b / 8), abs(a % 8 - b % 8))

@Composable
@Suppress("UNUSED_PARAMETER")
fun ReversiBoard(ses: Session<ReversiState>, version: Int, hints: Boolean, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { f, t ->
        if (t.lastMove in 0..63) {
            sfx?.play(Sound.STONE)
            // 裏返る石: 近い順に、距離ごとに1回
            val dists = (0 until 64).filter { f.cells[it] != 0 && f.cells[it] != t.cells[it] }.map { reversiDist(it, t.lastMove) }.distinct().sorted()
            var at = 0f
            for (d in dists) {
                val tt = RV_PLACE + (d - 1) * RV_STEP + RV_FLIP * 0.5f
                delay((tt - at).toLong().coerceAtLeast(0))
                at = tt
                sfx?.play(Sound.FLIP, volume = 0.7f)
            }
        }
    }) { f, t ->
        if (t.lastMove !in 0..63) 0 else {
            val far = (0 until 64).filter { f.cells[it] != 0 && f.cells[it] != t.cells[it] }.maxOfOrNull { reversiDist(it, t.lastMove) } ?: 0
            (RV_PLACE + (far - 1).coerceAtLeast(0) * RV_STEP + RV_FLIP + 80).toInt()
        }
    }
    val st = ma.to
    val legal = if (hints && ma.done) Reversi.legalMoves(st).filter { it != Reversi.PASS }.toSet() else emptySet()
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled)
    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1f).pointerInput(Unit) {
            detectTapGestures { p ->
                if (!canTap) return@detectTapGestures
                val m = size.width * 0.045f
                val cell = (size.width - 2 * m) / 8f
                val col = ((p.x - m) / cell).toInt()
                val row = ((p.y - m) / cell).toInt()
                if (col in 0..7 && row in 0..7) move(row * 8 + col)
            }
        },
    ) {
        val w = size.width
        val m = w * 0.045f
        val cell = (w - 2 * m) / 8f
        if (w < 4f) { woodPanel(Offset.Zero, size, w * 0.03f, Color(0xFF7A4A28), Color(0xFF4A2A14)); return@Canvas }
        cachedLayer("reversi", pad = (w * 0.03f).toInt() + 8) {
        woodPanel(Offset.Zero, size, w * 0.03f, Color(0xFF7A4A28), Color(0xFF4A2A14))
        val felt = Rect(m, m, w - m, w - m)
        drawRect(safeRadial(listOf(Color(0xFF3C9466), Color(0xFF256A47)), center = felt.center, radius = w * 0.7f), felt.topLeft, felt.size)
        grain(Grain.FELT, felt.topLeft, felt.size, scale = 2f)
        drawRect(Color(0x40000000), felt.topLeft, felt.size, style = Stroke(w * 0.006f))
        for (k in 0..8) {
            val p = m + k * cell
            drawLine(Color(0xFF17452E), Offset(p, m), Offset(p, w - m), strokeWidth = 2f)
            drawLine(Color(0xFF17452E), Offset(m, p), Offset(w - m, p), strokeWidth = 2f)
        }
        for ((sx, sy) in listOf(2 to 2, 2 to 6, 6 to 2, 6 to 6)) drawCircle(Color(0xFF17452E), cell * 0.07f, Offset(m + sx * cell, m + sy * cell))
        }
        val black = Color(0xFF23262D)
        val white = Color(0xFFF4F1E8)
        for (i in 0 until 64) {
            val center = Offset(m + (i % 8 + 0.5f) * cell, m + (i / 8 + 0.5f) * cell)
            val r = cell * 0.42f
            val now = st.cells[i]
            val before = ma.from.cells[i]
            if (!ma.done && i == st.lastMove && before == 0) {
                stone(center, r * popScale(ma.elapsed / RV_PLACE), if (now == 1) black else white)
            } else if (!ma.done && before != 0 && before != now) {
                val start = RV_PLACE + (reversiDist(i, st.lastMove) - 1) * RV_STEP
                val t = ((ma.elapsed - start) / RV_FLIP).coerceIn(0f, 1f)
                val col = if (t < 0.5f) before else now
                flatDisc(center, r, abs(cos(PI.toFloat() * t)), if (col == 1) black else white)
            } else if (now != 0) {
                stone(center, r, if (now == 1) black else white)
            } else if (i in legal) {
                drawCircle(Color(0x99FFFDF8), cell * 0.11f, center)
            }
            if (ma.done && i == st.lastMove) drawCircle(c.shu, cell * 0.09f, center)
        }
    }
}

// =====================================================================
// コネクトフォー
// =====================================================================

@Composable
@Suppress("UNUSED_PARAMETER")
fun ConnectFourBoard(ses: Session<C4State>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { _, t ->
        if (t.lastMove >= 0) {
            val dur = 300 + (ConnectFour.ROWS - t.lastMove / ConnectFour.COLS) * 70
            delay((dur * 0.36f).toLong()) // 弾む動きが最初に底へ着く時
            sfx?.play(Sound.DISC, rate = 0.96f + (t.lastMove % 3) * 0.03f)
        }
    }) { _, t -> if (t.lastMove < 0) 0 else 300 + (ConnectFour.ROWS - t.lastMove / ConnectFour.COLS) * 70 }
    var preview by remember(ses) { mutableIntStateOf(-1) }
    LaunchedEffect(version, enabled) { preview = -1 }
    val st = ma.to
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled)
    val cols = ConnectFour.COLS
    val rows = ConnectFour.ROWS
    // 4つ並んだ所を光らせる(脈打つ光)
    val glowing = ma.done && st.winLine.isNotEmpty()
    val inf = rememberInfiniteTransition(label = "c4glow")
    val pulse by inf.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing), RepeatMode.Reverse),
        label = "c4glow",
    )
    val glow = if (glowing) pulse else 0f
    Canvas(
        Modifier.fillMaxWidth().aspectRatio((cols + 1.2f) / (rows + 0.7f + 0.75f)).testTag("c4Board").pointerInput(ses) {
            detectTapGestures { p ->
                val cl = size.width / (cols + 1.2f)
                if (canTap) {
                    val column = ((p.x - cl * 0.6f) / cl).toInt().coerceIn(0, cols - 1)
                    if (ses.rules.isLegal(ses.state, column)) {
                        if (preview == column) { preview = -1; move(column) } else preview = column
                    }
                }
            }
        },
    ) {
        // 見本C: 明るい無地の木の盤を、横長の台に差し込んで床に置いた形(光沢・木目なし)
        val cell = size.width / (cols + 1.2f)
        val inset = cell * 0.6f
        val foot = cell * 0.75f
        val bottom = size.height - foot
        val top = bottom - rows * cell // 上は落ちてくるコマのための余白
        val boardRect = Rect(inset - cell * 0.14f, top - cell * 0.14f, inset + cols * cell + cell * 0.14f, bottom + cell * 0.1f)
        val floor = size.height - foot * 0.12f
        // 床の影
        drawOval(Color(0x59000000), Offset(cell * 0.1f, floor - foot * 0.18f), Size(size.width - cell * 0.2f, foot * 0.3f))
        // 穴の奥(暗い色)
        drawRoundRect(C4_HOLE, boardRect.topLeft, boardRect.size, CornerRadius(cell * 0.22f))
        fun center(idx: Int) = Offset(inset + (idx % cols + 0.5f) * cell, bottom - (idx / cols + 0.5f) * cell)
        val r = cell * 0.4f
        for (idx in 0 until cols * rows) {
            val v = st.cells[idx]
            if (v == 0) continue
            val color = if (v == 1) C4_RED else C4_BLACK
            if (!ma.done && idx == st.lastMove) {
                val target = center(idx)
                val dur = 300f + (rows - idx / cols) * 70f
                val y = mix(top - cell * 0.5f, target.y, bounceOut(ma.elapsed / dur))
                c4Disc(Offset(target.x, y), r, color)
            } else {
                c4Disc(center(idx), r, color)
            }
        }
        // 盤(穴あきの板)
        val frame = Path().apply {
            fillType = PathFillType.EvenOdd
            addRoundRect(androidx.compose.ui.geometry.RoundRect(boardRect, CornerRadius(cell * 0.22f)))
            for (idx in 0 until cols * rows) {
                val cc = center(idx)
                addOval(Rect(cc.x - cell * 0.38f, cc.y - cell * 0.38f, cc.x + cell * 0.38f, cc.y + cell * 0.38f))
            }
        }
        drawPath(frame, C4_WOOD)
        drawRect(C4_WOOD_EDGE, Offset(boardRect.left + cell * 0.1f, boardRect.bottom - cell * 0.12f), Size(boardRect.width - cell * 0.2f, cell * 0.12f))
        if (preview >= 0 && enabled && ma.done) {
            val row = (0 until rows).firstOrNull { st.cells[it * cols + preview] == 0 }
            if (row != null) {
                val at = center(row * cols + preview)
                val col = if (st.turn == 0) C4_RED else C4_BLACK
                // 仮置き: 列を明るく帯で示し、上に持ったコマ、入る穴に濃いコマと太い白い輪(もう一度タップで落とす)
                val x0 = inset + preview * cell
                drawRect(Color.White.copy(alpha = 0.22f), Offset(x0 + cell * 0.04f, top - cell * 0.1f), Size(cell * 0.92f, bottom - top + cell * 0.1f))
                c4Disc(Offset(at.x, top - cell * 0.5f), r, col)
                drawCircle(col.copy(alpha = 0.85f), cell * .36f, at)
                drawCircle(Color.White, cell * .38f, at, style = Stroke(cell * .09f))
                drawCircle(Color(0xFF1A2140), cell * .44f, at, style = Stroke(cell * .03f))
            }
        }
        // 台(盤の下を受ける横長の台)
        drawRoundRect(C4_BASE, Offset(inset - cell * 0.35f, bottom - cell * 0.02f), Size(cols * cell + cell * 0.7f, floor - bottom + cell * 0.02f), CornerRadius(cell * 0.12f))
        if (glowing) {
            // 揃った4つ: 光の輪(脈打つ)+白い縁+結ぶ線
            for (idx in st.winLine) {
                val cc = center(idx)
                drawCircle(
                    safeRadial(listOf(Color(0xFFFFF3B0).copy(alpha = 0.55f + 0.35f * glow), Color.Transparent), center = cc, radius = cell * (0.62f + 0.1f * glow)),
                    cell * (0.62f + 0.1f * glow), cc,
                )
                drawCircle(Color.White, cell * 0.39f, cc, style = Stroke(cell * (0.06f + 0.03f * glow)))
            }
            drawLine(Color.White.copy(alpha = 0.7f + 0.3f * glow), center(st.winLine.first()), center(st.winLine.last()), strokeWidth = cell * 0.09f,
                cap = androidx.compose.ui.graphics.StrokeCap.Round)
        }
        if (ma.done && st.lastMove >= 0 && st.lastMove !in st.winLine) {
            // 最後に置かれたコマ: 白い輪
            drawCircle(Color(0xEEFFFFFF), cell * 0.39f, center(st.lastMove), style = Stroke(cell * 0.05f))
        }
    }
}

/** コネクトフォーのコマ(平らな円盤と内側の輪) */
internal fun DrawScope.c4Disc(c: Offset, r: Float, color: Color) {
    if (r <= 0.5f) return
    drawCircle(color, r, c)
    drawCircle(if (color == C4_BLACK) Color(0xFF55555C) else Color(0x2E000000), r * 0.68f, c, style = Stroke(r * 0.08f))
}

// =====================================================================
// マンカラ
// =====================================================================

private const val MC_STEP = 150f

/** まく順番の穴(相手の倉は飛ばす) */
private fun sowPath(from: MancalaState, m: Int): List<Int> {
    val oppStore = if (from.turn == 0) 13 else 6
    val list = ArrayList<Int>()
    var i = m
    var n = from.pits[m]
    while (n > 0) {
        i = (i + 1) % 14
        if (i == oppStore) continue
        list.add(i)
        n--
    }
    return list
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun MancalaBoard(ses: Session<MancalaState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { f, t ->
        if (t.lastMove >= 0) {
            val path = sowPath(f, t.lastMove)
            for ((k, pit) in path.withIndex()) {
                delay(MC_STEP.toLong())
                // ビー玉が1つずつ穴に入る音(倉は少し低く)
                val store = pit == 6 || pit == 13
                sfx?.play(Sound.MARBLE, volume = 0.8f, rate = if (store) 0.9f else 0.97f + ((k * 7) % 5) * 0.015f)
            }
            if (t.captured > 0) {
                // 横取り: ビー玉がまとめて倉へ
                delay(140)
                sfx?.play(Sound.RATTLE)
            }
        }
    }) { f, t -> if (t.lastMove < 0) 0 else (f.pits[t.lastMove] * MC_STEP + 320).toInt() }
    val st = ma.to
    val me = viewSeat(ses)
    val bottom = if (me == 0) (0..5).toList() else (7..12).toList()
    val top = if (me == 0) (12 downTo 7).toList() else (5 downTo 0).toList()
    val myStore = if (me == 0) 6 else 13
    val oppStore = if (me == 0) 13 else 6
    val legal = if (enabled && ma.done) ses.rules.legalMoves(st).toSet() else emptySet()
    val move by rememberUpdatedState(onMove)
    val legalNow by rememberUpdatedState(legal)
    val measurer = rememberTextMeasurer()

    // 表示する石の数(種まきの途中なら途中の数)と、飛んでいる1粒
    val pits: IntArray
    var flying: Pair<Int, Int>? = null
    var flyT = 0f
    if (!ma.done && st.lastMove >= 0) {
        val path = sowPath(ma.from, st.lastMove)
        val stepF = (ma.elapsed / MC_STEP).coerceAtMost(path.size.toFloat())
        val k = floor(stepF).toInt()
        if (k >= path.size) {
            pits = st.pits
        } else {
            pits = ma.from.pits.copyOf()
            pits[st.lastMove] = 0
            for (j in 0 until k) pits[path[j]]++
            flying = (if (k == 0) st.lastMove else path[k - 1]) to path[k]
            flyT = stepF - k
        }
    } else pits = st.pits

    Canvas(
        Modifier.fillMaxWidth().aspectRatio(2.35f).pointerInput(Unit) {
            detectTapGestures { p ->
                val geo = MancalaGeo(size.width.toFloat(), size.height.toFloat())
                for ((i, pit) in bottom.withIndex()) {
                    if (pit in legalNow && geo.pitRect(1, i).inflate(4f).contains(p)) { move(pit); break }
                }
            }
        },
    ) {
        val geo = MancalaGeo(size.width, size.height)
        woodPanel(Offset.Zero, size, size.height * 0.16f, Mat.walnutTop, Mat.walnutBottom)
        val hole = Color(0xFF4A2E1A)
        val slots = HashMap<Int, Rect>()
        slots[oppStore] = geo.storeRect(left = true)
        slots[myStore] = geo.storeRect(left = false)
        top.forEachIndexed { i, p -> slots[p] = geo.pitRect(0, i) }
        bottom.forEachIndexed { i, p -> slots[p] = geo.pitRect(1, i) }
        for ((p, rect) in slots) {
            val hl = when {
                ma.done && p == st.lastMove -> c.shu
                p in legal -> ACCENT
                else -> null
            }
            recess(rect.topLeft, rect.size, hole, hl)
            drawBeads(p, pits[p], rect)
            // 数
            val label = pits[p].toString()
            // 数は象牙色の小札に入れて、穴の外(上の列は上、下の列は下)に出す
            val style = TextStyle(color = Color(0xFF2A2118), fontSize = 11.sp, fontWeight = FontWeight.Black)
            val lay = measurer.measure(label, style)
            val isTop = top.contains(p)
            val tagW = maxOf(lay.size.width + 10f, lay.size.height * 1.25f)
            val tagH = lay.size.height + 1f
            val y = if (p == myStore || p == oppStore) rect.bottom - tagH - 4f
            else if (isTop) rect.top - tagH - 2f else rect.bottom + 2f
            val ty = y.coerceIn(0f, size.height - tagH)
            val tl = Offset(rect.center.x - tagW / 2, ty)
            drawRoundRect(Color.Black.copy(alpha = 0.3f), tl + Offset(0f, 1.5f), Size(tagW, tagH), CornerRadius(tagH / 2))
            drawRoundRect(Brush.verticalGradient(listOf(Mat.ivoryTop, Mat.ivoryBottom), startY = ty, endY = ty + tagH), tl, Size(tagW, tagH), CornerRadius(tagH / 2))
            drawText(lay, topLeft = Offset(rect.center.x - lay.size.width / 2f, ty + 0.5f))
        }
        val f = flying
        if (f != null) {
            val a = slots[f.first]!!.center
            val b = slots[f.second]!!.center
            val t = ease(flyT)
            val lift = -size.height * 0.12f * (1 - (2 * t - 1) * (2 * t - 1))
            bead(Offset(mix(a.x, b.x, t), mix(a.y, b.y, t) + lift), geo.beadR * 1.15f, BEAD_COLORS[(f.second + 3) % BEAD_COLORS.size])
        }
    }
}

private class MancalaGeo(val w: Float, val h: Float) {
    val m = h * 0.09f
    val storeW = w * 0.11f
    val gap = w * 0.012f
    val areaL = m + storeW + gap * 2
    val areaR = w - m - storeW - gap * 2
    val pitW = (areaR - areaL - gap * 5) / 6f
    val pitH = min(pitW, (h - 2 * m - h * 0.2f) / 2f)
    val beadR = pitW * 0.12f

    fun pitRect(row: Int, i: Int): Rect {
        val x = areaL + i * (pitW + gap)
        val y = if (row == 0) m + h * 0.08f else h - m - h * 0.08f - pitH
        return Rect(x, y, x + pitW, y + pitH)
    }

    fun storeRect(left: Boolean): Rect {
        val x = if (left) m else w - m - storeW
        return Rect(x, m, x + storeW, h - m)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawBeads(pit: Int, n: Int, rect: Rect) {
    val shown = min(n, 24)
    val big = n <= 8
    val r = min(rect.width, rect.height) * (if (big) 0.13f else 0.1f)
    val spreadX = rect.width / 2 - r * 1.3f
    val spreadY = rect.height / 2 - r * 1.3f
    for (i in 0 until shown) {
        val s = beadSpot(i, shown)
        bead(Offset(rect.center.x + s.x * spreadX, rect.center.y + s.y * spreadY), r, BEAD_COLORS[(pit * 3 + i) % BEAD_COLORS.size])
    }
}

// =====================================================================
// ドット＆ボックス
// =====================================================================

private const val DB_LINE = 260f
private const val DB_BOX = 300f

@Composable
@Suppress("UNUSED_PARAMETER")
fun DotsBoard(ses: Session<DotsState>, version: Int, enabled: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    val c = LocalAsobi.current
    val sfx = LocalSfx.current
    val ma = rememberMoveAnim(ses, onBusy, onStep = { f, t ->
        if (t.lastEdge >= 0) {
            sfx?.play(Sound.PEN, rate = 0.95f + (t.lastEdge % 4) * 0.03f)
            if ((0 until t.owner.size).any { f.owner[it] < 0 && t.owner[it] >= 0 }) {
                delay(DB_LINE.toLong())
                sfx?.play(Sound.SCRIBBLE)
            }
        }
    }) { f, t ->
        if (t.lastEdge < 0) 0 else if ((0 until t.owner.size).any { f.owner[it] < 0 && t.owner[it] >= 0 }) (DB_LINE + DB_BOX).toInt() else DB_LINE.toInt()
    }
    val st = ma.to
    val r = ses.rules as DotsBoxes
    val n = r.n
    val move by rememberUpdatedState(onMove)
    val canTap by rememberUpdatedState(enabled)
    val drawnNow by rememberUpdatedState(st.drawn)
    val paper = if (c.dark) Color(0xFFE6DFCF) else Color(0xFFFBF8F0)

    fun ends(e: Int): Pair<Pair<Int, Int>, Pair<Int, Int>> =
        if (e < r.hCount) { val row = e / n; val col = e % n; (row to col) to (row to col + 1) }
        else { val k = e - r.hCount; val row = k / (n + 1); val col = k % (n + 1); (row to col) to (row + 1 to col) }

    Canvas(
        Modifier.fillMaxWidth().aspectRatio(1f).pointerInput(n) {
            detectTapGestures { p ->
                if (!canTap) return@detectTapGestures
                val pad = size.width * 0.1f
                val cell = (size.width - 2 * pad) / n
                var best = -1
                var bestD = Float.MAX_VALUE
                for (e in 0 until r.edgeCount) {
                    if ((drawnNow ushr e) and 1L == 1L) continue
                    val (a, b) = ends(e)
                    val mx = pad + (a.second + b.second) / 2f * cell
                    val my = pad + (a.first + b.first) / 2f * cell
                    val d = abs(p.x - mx) + abs(p.y - my)
                    if (d < bestD) { bestD = d; best = e }
                }
                if (best >= 0 && bestD < cell * 0.45f) move(best)
            }
        },
    ) {
        val w = size.width
        // 紙(少し傾けた影つき)
        drawRoundRect(Color(0x44000000), Offset(w * 0.035f, w * 0.045f), Size(w * 0.94f, w * 0.94f), CornerRadius(10f))
        drawRoundRect(paper, Offset(w * 0.03f, w * 0.03f), Size(w * 0.94f, w * 0.94f), CornerRadius(10f))
        for (k in 1 until 18) drawLine(Color(0x1A4A90D9), Offset(w * 0.03f, w * (0.03f + 0.94f * k / 18)), Offset(w * 0.97f, w * (0.03f + 0.94f * k / 18)), 1.5f)
        val pad = w * 0.1f
        val cell = (w - 2 * pad) / n
        val boxT = if (ma.done) 1f else ((ma.elapsed - DB_LINE) / DB_BOX).coerceIn(0f, 1f)
        for (b in 0 until n * n) {
            val o = st.owner[b]
            if (o < 0) continue
            val fresh = ma.from.owner[b] < 0
            val sc = if (fresh) popScale(boxT) else 1f
            if (sc <= 0.01f) continue
            val cx = pad + (b % n + 0.5f) * cell
            val cy = pad + (b / n + 0.5f) * cell
            val half = (cell / 2 - 6f) * sc
            val col = if (o == 0) INK_BLUE else INK_RED
            drawRoundRect(col.copy(alpha = 0.22f), Offset(cx - half, cy - half), Size(half * 2, half * 2), CornerRadius(8f))
            drawCircle(col.copy(alpha = 0.85f), cell * 0.16f * sc, Offset(cx, cy), style = Stroke(cell * 0.05f))
        }
        for (e in 0 until r.edgeCount) {
            val (a, b) = ends(e)
            val p1 = Offset(pad + a.second * cell, pad + a.first * cell)
            val p2 = Offset(pad + b.second * cell, pad + b.first * cell)
            if (st.isDrawn(e)) {
                if (ma.done && e == st.lastEdge) drawLine(ACCENT, p1, p2, strokeWidth = cell * .18f, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                val col = if (st.edgeBy[e] == 0) INK_BLUE else INK_RED
                val t = if (!ma.done && e == st.lastEdge) ease(ma.elapsed / DB_LINE) else 1f
                drawLine(col, p1, Offset(mix(p1.x, p2.x, t), mix(p1.y, p2.y, t)), strokeWidth = cell * 0.075f, cap = androidx.compose.ui.graphics.StrokeCap.Round)
            } else {
                drawLine(Color(0x22000000), p1, p2, strokeWidth = 2f,
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6f, 8f)))
            }
        }
        for (row in 0..n) for (col in 0..n) {
            val p = Offset(pad + col * cell, pad + row * cell)
            drawCircle(Color(0xFF2B2B2B), min(cell * 0.07f, 12f), p)
        }
    }
}

// =====================================================================
// ヒット＆ブロー(数字の木札とピン)
// =====================================================================

val TILE_BRUSH = Brush.verticalGradient(listOf(Mat.ivoryTop, Mat.ivoryBottom))

@Composable
fun NumberTile(text: String, size: Int = 40, covered: Boolean = false, highlight: Color? = null, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier.size(size.dp).shadow(3.dp, shape).clip(shape)
            .background(if (covered) Brush.verticalGradient(listOf(Color(0xFF3A2414), Color(0xFF24160C))) else TILE_BRUSH)
            .border(if (highlight != null) 3.dp else 1.dp, highlight ?: Color(0x55000000), shape),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (covered) "?" else text, color = if (covered) Color(0xFFF4E6CC) else Color(0xFF2B2118), fontSize = (size * 0.5f).sp, fontWeight = FontWeight.Bold)
    }
}

/** ヒット(赤いピン)とブロー(白いピン)の表示 */
@Composable
fun Pegs(hit: Int, blow: Int, n: Int, visible: Int = n, modifier: Modifier = Modifier) {
    Canvas(modifier.size(34.dp, 34.dp)) {
        val cols = 2
        val rowsN = (n + 1) / 2
        val cw = size.width / cols
        val ch = size.height / rowsN
        for (i in 0 until n) {
            val cc = Offset((i % cols + 0.5f) * cw, (i / cols + 0.5f) * ch)
            val r = min(cw, ch) * 0.3f
            drawCircle(Color(0x66000000), r * 0.8f, cc)
            if (i < visible) {
                when {
                    i < hit -> stone(cc, r, Color(0xFFD93A2B))
                    i < hit + blow -> stone(cc, r, Color(0xFFF4F1E8))
                }
            }
        }
    }
}

@Composable
private fun GuessRow(index: Int, g: Guess, n: Int, animate: Boolean, onBusy: (Boolean) -> Unit, showText: Boolean = true) {
    val anim = remember(g) { Animatable(if (animate) 0f else 10_000f) }
    val busy by rememberUpdatedState(onBusy)
    val sfx = LocalSfx.current
    LaunchedEffect(g) {
        if (animate) {
            busy(true)
            try {
                coroutineScope {
                    launch {
                        // 札が1枚ずつ置かれる音 → ピンが立つ音(ヒットは少し高く)
                        for (i in 0 until n) { sfx?.play(Sound.TILE, rate = 0.95f + i * 0.04f); delay(140) }
                        val pegs = g.hit + g.blow
                        for (j in 0 until pegs) { sfx?.play(Sound.PEG, rate = if (j < g.hit) 1.15f else 0.95f); delay((300 / n).toLong()) }
                    }
                    anim.animateTo((n * 140 + 420).toFloat(), tween(n * 140 + 420, easing = LinearEasing))
                }
            } finally { busy(false) }
        }
    }
    val e = anim.value
    val digits = HitBlow.format(g.code, n)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("${index + 1}", color = Color(0xCCFFF4DF), fontSize = 11.sp, modifier = Modifier.width(16.dp), textAlign = TextAlign.End)
        for (i in 0 until n) {
            val t = ((e - i * 140f) / 200f).coerceIn(0f, 1f)
            NumberTile(digits[i].toString(), size = 30, modifier = Modifier.graphicsLayer { scaleY = popScale(t); alpha = if (t <= 0f) 0f else 1f })
        }
        val pegT = ((e - n * 140f) / 300f).coerceIn(0f, 1f)
        // 2×2 の穴に赤い玉(ヒット)・白い玉(ブロー)、横に数字も出す
        Pegs(g.hit, g.blow, n, visible = (pegT * n + 0.999f).toInt().coerceAtMost(n),
            modifier = Modifier.clip(RoundedCornerShape(7.dp)).background(Color(0xFF24160C)))
        if (showText && pegT >= 1f) Column {
            Text("${g.hit}ヒット", color = Color(0xFFFFF4DF), fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.Bold)
            Text("${g.blow}ブロー", color = Color(0xFFFFF4DF), fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun HitBlowBoard(ses: Session<HitBlowState>, version: Int, enabled: Boolean, tapSound: Boolean, onMove: (Int) -> Unit, onBusy: (Boolean) -> Unit) {
    LocalTick.current // 手が進んだら必ず描き直す
    val c = LocalAsobi.current
    val shownCb by rememberUpdatedState(LocalBoardShown.current)
    val tap = rememberTap(tapSound)
    val st = ses.state
    val n = st.digits
    val me = viewSeat(ses)
    var input by remember(ses) { mutableStateOf("") }
    // 画面を開いた時点の質問の数(それより後に増えた行だけアニメーションする)
    val initial = remember(ses) { st.guesses.map { it.size } }

    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // 秘密の数(相手の数は終わるまで伏せる)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            if (!st.solo) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("あなたの数", color = c.ink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        val sec = st.secrets[me]
                        for (i in 0 until n) NumberTile(if (sec >= 0) HitBlow.format(sec, n)[i].toString() else "", size = 28)
                    }
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (st.solo) "当てる数" else "CPUの数", color = c.ink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    val target = if (st.solo) st.secrets[0] else st.secrets[1 - me]
                    val open = ses.outcome != null && target >= 0
                    for (i in 0 until n) NumberTile(if (open) HitBlow.format(target, n)[i].toString() else "", size = 28, covered = !open)
                }
            }
        }
        // 質問の記録(木の板)
        Row(
            Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(14.dp))
                .background(Brush.verticalGradient(listOf(Mat.walnutTop, Mat.walnutBottom))).padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val columns = if (st.solo) listOf(0 to "あなたの質問") else listOf(me to "あなたの質問", (1 - me) to "CPUの質問")
            for ((seat, label) in columns) {
                Column(Modifier.weight(1f).fillMaxHeight()) {
                    Text(label, color = Color(0xFFFFF4DF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    // 質問が増えたら、いちばん下(新しい行)まで自動でスクロールする
                    val scroll = rememberScrollState()
                    val rows = st.guesses[seat].size
                    LaunchedEffect(rows) {
                        delay(30) // 新しい行の高さが決まってから
                        scroll.animateScrollTo(scroll.maxValue)
                    }
                    Column(Modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        st.guesses[seat].forEachIndexed { i, g -> GuessRow(i, g, n, animate = i >= initial.getOrElse(seat) { 0 }, onBusy = onBusy, showText = st.solo) }
                    }
                }
            }
        }
        if (enabled) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                for (i in 0 until n) {
                    NumberTile(input.getOrNull(i)?.toString() ?: "", size = 44, highlight = if (i == input.length) c.indigo else null)
                }
            }
            for (rowDigits in listOf(listOf(1, 2, 3, 4, 5), listOf(6, 7, 8, 9, 0))) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (d in rowDigits) {
                        val can = input.length < n && d.toString() !in input
                        val shape = RoundedCornerShape(10.dp)
                        Box(
                            Modifier.weight(1f).height(46.dp).shadow(if (can) 3.dp else 0.dp, shape).clip(shape)
                                .background(if (can) TILE_BRUSH else Brush.verticalGradient(listOf(Color(0x66FBF6EA), Color(0x66E5D7BC))))
                                .clickable(enabled = can) { tap(); input += d.toString() },
                            contentAlignment = Alignment.Center,
                        ) { Text(d.toString(), color = Color(0xFF2B2118).copy(alpha = if (can) 1f else 0.4f), fontSize = 20.sp, fontWeight = FontWeight.Bold) }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BigButton("1つ消す", Modifier.weight(1f), enabled = input.isNotEmpty()) { tap(); input = input.dropLast(1) }
                BigButton(if (st.settingSecret) "この数に決める" else "質問する", Modifier.weight(1.4f), primary = true, enabled = input.length == n) {
                    val code = input.toInt()
                    input = ""
                    onMove(code)
                }
            }
        }
    }
    // 行のアニメーション(GuessRow)が始まってから「描き終わり待ち」を外す(行の方が数で待たせる)
    val v = ses.version
    LaunchedEffect(ses, v) { shownCb(v) }
}

/** 自分の席。端末交代モードでは現在の人の手札・向きに切り替える。 */
fun viewSeat(ses: Session<*>): Int = if (ses.options.str("localMode", "cpu") == "pass" && ses.isHumanTurn) ses.toMove else ses.seats.indexOfFirst { it.human }.coerceAtLeast(0)
