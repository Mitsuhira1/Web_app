package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * 盤の質感(木目・フェルト・石)。画像ファイルは使わず、乱れ(ノイズ)から計算で作る。
 * どれも「白 = そのまま、暗い = 濃くする」の濃淡の模様で、盤の色の上に乗算で重ねる。
 * これで盤ごとの色(ライト/ダーク)はそのままに、本物らしい質感だけを足せる。
 * 作るのは1種類につき1回だけ(起動時に別スレッドで先に作っておく。間に合わなければ最初に使う時に作る)。
 */
enum class Grain {
    /** 柾目(まっすぐ通る木目。碁盤・将棋盤の榧) */
    STRAIGHT,
    /** 板目(山形にうねる木目。卓・盤の枠・胡桃の板) */
    FLAT,
    /** フェルト(細かい毛並み) */
    FELT,
    /** 石(粘板岩のまだら) */
    STONE,
}

object Textures {
    private const val SIZE = 384
    private val cache = HashMap<Grain, ImageBitmap>()

    /** 起動時に呼ぶ(別スレッド) */
    fun prepare() {
        for (g in Grain.values()) get(g)
    }

    fun get(g: Grain): ImageBitmap = cache.getOrPut(g) { make(g) }

    // ---- 乱れ(値ノイズ)----
    private fun hash(x: Int, y: Int, seed: Int): Float {
        var h = x * 374761393 + y * 668265263 + seed * 1442695041
        h = (h xor (h ushr 13)) * 1274126177
        h = h xor (h ushr 16)
        return (h and 0xFFFF) / 65535f
    }

    private fun smooth(t: Float) = t * t * (3 - 2 * t)

    /** 周期 period で繋がる値ノイズ(端が継ぎ目なくつながる) */
    private fun noise(x: Float, y: Float, px: Int, py: Int, seed: Int): Float {
        val x0 = floor(x).toInt(); val y0 = floor(y).toInt()
        val fx = smooth(x - x0); val fy = smooth(y - y0)
        fun h(i: Int, j: Int) = hash(Math.floorMod(i, px), Math.floorMod(j, py), seed)
        val a = h(x0, y0); val b = h(x0 + 1, y0); val c = h(x0, y0 + 1); val d = h(x0 + 1, y0 + 1)
        return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy
    }

    private fun fbm(x: Float, y: Float, px: Int, py: Int, oct: Int, seed: Int): Float {
        var sum = 0f; var amp = 0.5f; var f = 1f; var norm = 0f
        for (o in 0 until oct) {
            sum += amp * noise(x * f, y * f, px * f.toInt(), py * f.toInt(), seed + o * 17)
            norm += amp; amp *= 0.5f; f *= 2f
        }
        return sum / norm
    }

    private fun make(g: Grain): ImageBitmap {
        val n = SIZE
        val px = IntArray(n * n)
        for (y in 0 until n) for (x in 0 until n) {
            val u = x.toFloat() / n
            val v = y.toFloat() / n
            val shade: Float = when (g) {
                Grain.STRAIGHT -> {
                    // 縦にまっすぐ通る年輪(柾目)。少しだけ揺らぎ、細い繊維と導管の点が乗る
                    val warp = fbm(u * 3f, v * 1f, 3, 1, 3, 11) * 1.6f
                    // 年輪の間隔は場所によって変える(本物の柾目は等間隔ではない)
                    val dens = 18f + 10f * fbm(u * 2f, 0f, 2, 1, 2, 4)
                    val ring = 0.5f + 0.5f * sin(2 * PI.toFloat() * (u * dens + warp))
                    val late = ring.pow(10f) // 夏目(細くて少し濃い線)
                    val fiber = fbm(u * 64f, v * 2f, 64, 2, 2, 5)
                    val tone = fbm(u * 4f, v * 1f, 4, 1, 3, 8) // 色むら
                    val pore = if (fbm(u * 128f, v * 8f, 128, 8, 1, 9) > 0.84f) 1f else 0f
                    1f - (0.16f * late + 0.08f * fiber + 0.10f * tone + 0.04f * pore)
                }
                Grain.FLAT -> {
                    // 板目: 中心からの距離で年輪を作り、大きくうねらせる
                    // 年輪は横に流れ、ゆるく山形にうねる(強くうねらせると大理石のように見えるので控えめに)
                    val w1 = fbm(u * 2f, v * 3f, 2, 3, 4, 3) * 1.6f
                    val d = v * 10f + w1 + sin(2 * PI.toFloat() * u) * 0.35f
                    val ring = 0.5f + 0.5f * sin(2 * PI.toFloat() * d)
                    val late = ring.pow(6f)
                    val fiber = fbm(u * 40f, v * 3f, 40, 3, 2, 7)
                    val tone = fbm(u * 5f, v * 5f, 5, 5, 3, 21)
                    1f - (0.17f * late + 0.10f * fiber + 0.10f * tone)
                }
                Grain.FELT -> {
                    val a = fbm(u * 96f, v * 96f, 96, 96, 2, 13)
                    val b = fbm(u * 6f, v * 6f, 6, 6, 3, 2)
                    1f - (0.18f * a + 0.10f * b)
                }
                Grain.STONE -> {
                    val a = fbm(u * 8f, v * 8f, 8, 8, 5, 31)
                    val vein = 1f - kotlin.math.abs(fbm(u * 4f, v * 4f, 4, 4, 4, 41) - 0.5f) * 2f
                    1f - (0.25f * a + 0.15f * vein.pow(8f))
                }
            }
            val c = (shade.coerceIn(0f, 1f) * 255).roundToInt()
            px[y * n + x] = (0xFF shl 24) or (c shl 16) or (c shl 8) or c
        }
        return pixelsToImageBitmap(px, n, n)
    }
}

/**
 * 質感を乗算で重ねる(いまの色を保って、木目などの濃淡だけを足す)。
 * scale: 模様の細かさ(1 = 1枚を領域の幅に合わせる。大きいほど細かく繰り返す)。
 */
fun DrawScope.grain(g: Grain, topLeft: Offset, area: Size, scale: Float = 1f, alpha: Float = 1f) {
    val img = Textures.get(g)
    // 1枚の大きさは整数にそろえ、すき間も重なりもなく並べる(重なると乗算で線が出る)
    val tile = (area.width / scale).roundToInt()
    if (tile < 2) return
    clipRect(topLeft.x, topLeft.y, topLeft.x + area.width, topLeft.y + area.height) {
        val x0 = topLeft.x.toInt()
        val y0 = topLeft.y.toInt()
        var y = y0
        while (y < topLeft.y + area.height) {
            var x = x0
            while (x < topLeft.x + area.width) {
                drawImage(
                    img, IntOffset.Zero, IntSize(img.width, img.height),
                    IntOffset(x, y), IntSize(tile, tile),
                    alpha = alpha, blendMode = BlendMode.Multiply,
                )
                x += tile
            }
            y += tile
        }
    }
}
