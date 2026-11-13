package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.layout.Spacer
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.text.font.createFontFamilyResolver
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import kotlin.math.abs
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// =====================================================================
// ゲームの「箱」: 箱の色と、そのゲームの盤や道具の小さな絵(64×64 の座標で描く)
// =====================================================================

/** ゲームごとの箱の色(上・下)。0.5.8 からはタイルの絵の地と同じ素材の色 */
fun boxColors(id: String): Pair<Color, Color> = when (id) {
    "reversi", "checkers", "backgammon", "hitblow", "mancala" -> Mat.walnutTop to Mat.walnutBottom
    "shogi", "gogo", "go", "gomoku" -> Color(0xFFE9C98A) to Color(0xFFD4AE68)
    "hex", "morris", "hare", "chinese" -> Mat.oakTop to Mat.oakBottom
    "chess" -> Color(0xFF739552) to Color(0xFF5E7C42)
    "connect4" -> Color(0xFF3567B8) to Color(0xFF244C8E)
    "ludo" -> Mat.walnutTop to Mat.walnutBottom
    "life" -> Color(0xFF9AD67C) to Color(0xFF7DC060)
    "dots" -> Mat.ivoryTop to Mat.ivoryBottom
    "holdem" -> Color(0xFF2E333D) to Color(0xFF22262F)
    else -> Mat.feltTop to Mat.feltBottom
}

fun boxBrush(id: String): Brush {
    val (a, b) = boxColors(id)
    return Brush.linearGradient(listOf(a, b), start = Offset.Zero, end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY))
}

/** 上の帯で、名前が入りきらない時に使う(言葉の切れ目で改行) */
fun titleBreak(id: String, name: String): String = when (id) {
    "chinese" -> "チャイニーズ\nチェッカー"
    "solitaire" -> "ソリティア"
    "morris" -> "ナインメンズ\nモリス"
    "dots" -> "ドット＆\nボックス"
    "blackjack" -> "ブラック\nジャック"
    "holdem" -> "テキサス\nポーカー"
    "hitblow" -> "ヒット＆\nブロー"
    "connect4" -> "四つ並べ"
    "life" -> "道のり\nすごろく"
    "yacht" -> "サイコロ\n役づくり"
    "backgammon" -> "バック\nギャモン"
    "hare" -> "ウサギと\n猟犬"
    else -> name
}

/** 一覧のタイルなどに出す名前(長いものは改行を入れる) */
fun tileName(id: String, name: String): String = when (id) {
    "chinese" -> "チャイニーズ\nチェッカー"
    "dots" -> "ドット＆\nボックス"
    "morris" -> "ナインメンズ\nモリス"
    "holdem" -> "テキサス\nポーカー"
    "blackjack" -> "ブラック\nジャック"
    "hitblow" -> "ヒット＆\nブロー"
    "connect4" -> "四つ並べ"
    "life" -> "道のり\nすごろく"
    "yacht" -> "サイコロ\n役づくり"
    "backgammon" -> "バック\nギャモン"
    "solitaire" -> "ソリティア"

    else -> name
}

/** 箱(角丸のタイル)。0.5.8 からはタイル全体が盤・駒の絵(artScale は前の版との互換のため) */
@Composable
@Suppress("UNUSED_PARAMETER")
fun GameBox(id: String, size: Dp, modifier: Modifier = Modifier, corner: Dp = size * 0.18f, artScale: Float = 0.7f) {
    GameArt(id, modifier.size(size).clip(RoundedCornerShape(corner)))
}

/**
 * 描いた絵の置き場(ゲームと大きさごとに1枚)。一覧をスクロールするたびに描き直すと重いので、
 * 1度だけ画像に描いて、あとはその画像を貼るだけにする。
 */
private val artCache = LruMap<String, ImageBitmap>(80)

/** ゲームの絵だけ */
@Composable
fun GameArt(id: String, modifier: Modifier) {
    val tm = rememberTextMeasurer()
    Spacer(
        modifier.drawWithCache {
            val px = size.minDimension.toInt().coerceAtLeast(1)
            val key = "$id:$px"
            val bmp = artCache[key] ?: ImageBitmap(px, px).also { img ->
                CanvasDrawScope().draw(this, layoutDirection, Canvas(img), Size(px.toFloat(), px.toFloat())) {
                    scale(px / 100f, pivot = Offset.Zero) { drawTile(id, tm) }
                }
                artCache[key] = img
            }
            onDrawBehind {
                drawImage(bmp, dstOffset = androidx.compose.ui.unit.IntOffset(((size.width - px) / 2f).toInt(), ((size.height - px) / 2f).toInt()), dstSize = IntSize(px, px), filterQuality = FilterQuality.Medium)
            }
        },
    )
}

/** 一覧のタイルの画像(ゲームと「準備中」かどうかごとに1枚。大きさは最初に描いた時のもの) */
private val tileCache = HashMap<String, ImageBitmap>()
@Volatile private var prerendered = false

/** タイル1枚(箱の色・厚みの帯・絵・「準備中」の札)を1枚の画像に描く。別スレッドからも呼べる */
private fun renderTile(id: String, playable: Boolean, w: Int, h: Int, density: Density, tm: TextMeasurer): ImageBitmap {
    val img = ImageBitmap(w, h)
    CanvasDrawScope().draw(density, LayoutDirection.Ltr, Canvas(img), Size(w.toFloat(), h.toFloat())) {
        val r = CornerRadius(14.dp.toPx())
        val clip = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, w.toFloat(), h.toFloat(), r)) }
        clipPath(clip) {
            scale(w / 100f, h / 100f, pivot = Offset.Zero) { drawTile(id, tm) }
        }
        if (!playable) {
            val lay = tm.measure("準備中", TextStyle(color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = AppFont))
            val pad = 6.dp.toPx()
            val bw = lay.size.width + 14.dp.toPx()
            val bh = lay.size.height + 4.dp.toPx()
            val x = w - pad - bw
            drawRoundRect(Color(0xB80A0E24), Offset(x, pad), Size(bw, bh), CornerRadius(8.dp.toPx()))
            drawText(lay, topLeft = Offset(x + (bw - lay.size.width) / 2f, pad + (bh - lay.size.height) / 2f))
        }
    }
    return img
}

/**
 * 一覧を開いた時に、まだ描いていないタイルを別スレッドでまとめて描いておく。
 * スクロールして初めて見えたタイルを、その場で描く時の引っかかりをなくすため。
 */
fun prerenderTiles(@Suppress("UNUSED_PARAMETER") context: Context, @Suppress("UNUSED_PARAMETER") density: Density, sizePx: Int, @Suppress("UNUSED_PARAMETER") games: List<Pair<String, Boolean>>) {
    // Web 版: ブラウザは1スレッドなので、先に描かず、見えた時に描く(描いた画像は使い回す)
    if (prerendered || sizePx <= 0) return
    prerendered = true
}

/** 一覧のタイル1枚。描いておいた画像を貼るだけ(スクロールを軽く) */
@Composable
fun GameTileArt(id: String, playable: Boolean, modifier: Modifier) {
    val tm = rememberTextMeasurer()
    Spacer(
        modifier.drawWithCache {
            val w = size.width.toInt().coerceAtLeast(1)
            val h = size.height.toInt().coerceAtLeast(1)
            val key = "$id:$playable"
            val cached = synchronized(tileCache) { tileCache[key] }
            val bmp = if (cached != null && abs(cached.width - w) <= w / 10 + 1) cached
            else renderTile(id, playable, w, h, this, tm).also { img -> synchronized(tileCache) { tileCache[key] = img } }
            onDrawBehind { drawImage(bmp, dstSize = IntSize(w, h), filterQuality = FilterQuality.Medium) }
        },
    )
}
