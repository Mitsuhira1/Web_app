package jp.yonekou.asobi26.web

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font

/** 画面の部品から使う Context(Android の LocalContext と同じ名前) */
val LocalContext = staticCompositionLocalOf<Context> { WebApplication }

/** 字(起動時に読み込んだファイルから作る) */
object WebFonts {
    var app: FontFamily = FontFamily.Default
    var koma: FontFamily = FontFamily.Default
    fun install(medium: ByteArray, bold: ByteArray, koma: ByteArray) {
        app = FontFamily(
            Font("zen-medium-n", medium, FontWeight.Normal), Font("zen-medium", medium, FontWeight.Medium),
            Font("zen-bold-sb", bold, FontWeight.SemiBold), Font("zen-bold", bold, FontWeight.Bold),
            Font("zen-bold-eb", bold, FontWeight.ExtraBold), Font("zen-bold-bk", bold, FontWeight.Black),
        )
        this.koma = FontFamily(Font("yuji-boku", koma, FontWeight.Normal))
    }
}

/** ARGB の画素の並びから画像を作る(Android の Bitmap.createBitmap(pixels, w, h, ARGB_8888) と同じ) */
fun pixelsToImageBitmap(px: IntArray, w: Int, h: Int): ImageBitmap {
    val bytes = ByteArray(w * h * 4)
    for (i in px.indices) {
        val c = px[i]
        // Skia の N32(ブラウザでは BGRA・アルファ乗算済み)。不透明なので乗算は不要
        bytes[i * 4] = (c and 0xff).toByte()
        bytes[i * 4 + 1] = ((c shr 8) and 0xff).toByte()
        bytes[i * 4 + 2] = ((c shr 16) and 0xff).toByte()
        bytes[i * 4 + 3] = ((c ushr 24) and 0xff).toByte()
    }
    val info = org.jetbrains.skia.ImageInfo.makeN32(w, h, org.jetbrains.skia.ColorAlphaType.PREMUL)
    val bmp = org.jetbrains.skia.Bitmap()
    bmp.allocPixels(info)
    bmp.installPixels(info, bytes, w * 4)
    return org.jetbrains.skia.Image.makeFromBitmap(bmp).toComposeImageBitmap()
}

/** java.util.Random と同じ数列(紙吹雪の並びを元のアプリと同じにする) */
class JavaUtilRandom(seed: Long) {
    private var s: Long = (seed xor 0x5DEECE66DL) and ((1L shl 48) - 1)
    private fun next(bits: Int): Int { s = (s * 0x5DEECE66DL + 0xBL) and ((1L shl 48) - 1); return (s ushr (48 - bits)).toInt() }
    fun nextFloat(): Float = next(24) / (1 shl 24).toFloat()
    fun nextInt(bound: Int): Int { var r = next(31); val m = bound - 1; if (bound and m == 0) return ((bound.toLong() * r.toLong()) shr 31).toInt(); var u = r; while (true) { r = u % bound; if (u - r + m >= 0) break; u = next(31) }; return r }
}

@JsFun("(ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }")
private external fun jsVibrate(ms: Int)
fun vibrate(ms: Int) = jsVibrate(ms)

@JsFun("() => document.visibilityState !== 'hidden'")
private external fun jsVisible(): Boolean

/** 画面が見えているか(Android の RESUMED の代わり) */
@Composable
fun pageVisibleState(): State<Boolean> = remember { mutableStateOf(jsVisible()) }
