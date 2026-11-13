package jp.yonekou.asobi26.data

import jp.yonekou.asobi26.web.*
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.jetbrains.skia.Paint
import org.jetbrains.skia.Rect
import org.jetbrains.skia.SamplingMode
import org.jetbrains.skia.Surface
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/**
 * プレイヤーのアイコン(写真)。元のアプリと同じく、選んだ所を正方形に切り抜いて 256×256 にして保存する。
 * Web 版の保存先はブラウザの localStorage(PNG を Base64 にした文字)。サイトを開き直しても残る。
 */
@OptIn(ExperimentalEncodingApi::class)
object Avatar {
    private const val SIZE = 256
    private const val KEY = "avatar"

    class Bounds(val left: Int, val top: Int, val right: Int, val bottom: Int) {
        fun width() = right - left
        fun height() = bottom - top
    }

    private fun prefs(context: Context) = context.getSharedPreferences("asobi", Context.MODE_PRIVATE)

    fun load(context: Context): Bitmap? = try {
        prefs(context).getString(KEY, null)?.let { Bitmap(Image.makeFromEncoded(Base64.decode(it))) }
    } catch (e: Throwable) { null }

    fun decode(@Suppress("UNUSED_PARAMETER") context: Context, uri: Uri): Bitmap? = try { Bitmap(Image.makeFromEncoded(uri.bytes)) } catch (_: Throwable) { null }

    fun cropBounds(src: Bitmap, zoom: Float, focusX: Float, focusY: Float): Bounds {
        val side = (minOf(src.width, src.height) / zoom.coerceIn(1f, 4f)).toInt().coerceAtLeast(1)
        val x = (focusX * src.width - side / 2f).toInt().coerceIn(0, src.width - side)
        val y = (focusY * src.height - side / 2f).toInt().coerceIn(0, src.height - side)
        return Bounds(x, y, x + side, y + side)
    }

    fun saveCrop(context: Context, src: Bitmap, zoom: Float, x: Float, y: Float): Bitmap? = try {
        val b = cropBounds(src, zoom, x, y)
        val surface = Surface.makeRasterN32Premul(SIZE, SIZE)
        surface.canvas.drawImageRect(src.image, Rect.makeXYWH(b.left.toFloat(), b.top.toFloat(), b.width().toFloat(), b.height().toFloat()),
            Rect.makeWH(SIZE.toFloat(), SIZE.toFloat()), SamplingMode.LINEAR, Paint(), true)
        val out = surface.makeImageSnapshot()
        val png = out.encodeToData(EncodedImageFormat.PNG)?.bytes ?: error("encode")
        prefs(context).edit().putString(KEY, Base64.encode(png)).apply()
        Bitmap(out)
    } catch (_: Throwable) { null }

    fun save(context: Context, uri: Uri): Bitmap? {
        val src = decode(context, uri) ?: return null
        return saveCrop(context, src, 1f, 0.5f, 0.5f)
    }

    fun clear(context: Context) { prefs(context).edit().remove(KEY).apply() }
}
