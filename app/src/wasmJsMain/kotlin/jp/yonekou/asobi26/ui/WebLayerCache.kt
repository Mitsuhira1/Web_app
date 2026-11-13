package jp.yonekou.asobi26.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import jp.yonekou.asobi26.web.LruMap
import kotlin.math.ceil

// Web 版だけの軽量化: 動かない絵(盤の木目・フェルトなど)を、一度だけ画像に描いて使い回す。
// ブラウザでは、画面のどこかが動くと画面全体を毎コマ描き直す。質感の重ね描き(乗算)は特に重いので、
// 先に1枚の画像にしておけば、動いている間は画像を貼るだけで済む。描かれる絵そのものは同じ。

private val layerCache = LruMap<String, ImageBitmap>(10)

/**
 * block の絵を画像にして貼る。key には、絵を変える条件(ゲーム・盤の大きさの種類・色など)を全部入れる。
 * pad: 領域の外にはみ出す影などのための余白(px)。block の中の size は元の大きさのまま。
 */
fun DrawScope.cachedLayer(key: String, pad: Int = 0, block: DrawScope.() -> Unit) {
    val s = size
    if (s.width < 1f || s.height < 1f) { block(); return }
    val w = ceil(s.width).toInt() + pad * 2
    val h = ceil(s.height).toInt() + pad * 2
    val k = "$key:$w:$h:$density:$fontScale"
    val img = layerCache[k] ?: ImageBitmap(w, h).also { img ->
        val canvas = Canvas(img)
        canvas.translate(pad.toFloat(), pad.toFloat())
        CanvasDrawScope().draw(this, layoutDirection, canvas, s) { block() }
        layerCache[k] = img
    }
    drawImage(img, topLeft = Offset(-pad.toFloat(), -pad.toFloat()))
}

/** cachedLayer の大きさを指定する版(盤の一部だけを画像にする時) */
fun DrawScope.cachedLayer(key: String, area: Size, pad: Int, block: DrawScope.() -> Unit) {
    val w = ceil(area.width).toInt() + pad * 2
    val h = ceil(area.height).toInt() + pad * 2
    if (w <= pad * 2 || h <= pad * 2) { block(); return }
    val k = "$key:$w:$h:$density:$fontScale"
    val img = layerCache[k] ?: ImageBitmap(w, h).also { img ->
        val canvas = Canvas(img)
        canvas.translate(pad.toFloat(), pad.toFloat())
        CanvasDrawScope().draw(this, layoutDirection, canvas, area) { block() }
        layerCache[k] = img
    }
    drawImage(img, topLeft = Offset(-pad.toFloat(), -pad.toFloat()))
}
