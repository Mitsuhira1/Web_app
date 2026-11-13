package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import jp.yonekou.asobi26.data.Avatar
import jp.yonekou.asobi26.AppModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun AvatarCrop(uri: Uri, model: AppModel, close: () -> Unit) {
    val ctx = LocalContext.current
    val colors = LocalAsobi.current
    var loading by remember(uri) { mutableStateOf(true) }
    val source by produceState<Bitmap?>(null, uri) { value = withContext(Dispatchers.Default) { Avatar.decode(ctx, uri) }; loading = false }
    var zoom by remember(uri) { mutableFloatStateOf(1f) }
    var fx by remember(uri) { mutableFloatStateOf(.5f) }
    var fy by remember(uri) { mutableFloatStateOf(.5f) }
    val currentZoom by rememberUpdatedState(zoom)
    AlertDialog(onDismissRequest = close, containerColor = colors.surface,
        title = { Text("写真の位置と大きさ") },
        text = { Column {
            Text("写真をドラッグして位置を調整。指2本または下のバーで拡大できます。", color = colors.sub)
            val bitmap = source
            if (bitmap != null) {
                val image = remember(bitmap) { bitmap.asImageBitmap() }
                val crop = Avatar.cropBounds(bitmap, zoom, fx, fy)
                Canvas(Modifier.fillMaxWidth().aspectRatio(1f).padding(8.dp).pointerInput(bitmap) {
                    detectTransformGestures { _, pan, scale, _ ->
                        zoom = (currentZoom * scale).coerceIn(1f, 4f)
                        val bounds = Avatar.cropBounds(bitmap, zoom, fx, fy)
                        fx = ((bounds.left + bounds.width() / 2f - pan.x * bounds.width() / size.width) / bitmap.width).coerceIn(0f, 1f)
                        fy = ((bounds.top + bounds.height() / 2f - pan.y * bounds.height() / size.height) / bitmap.height).coerceIn(0f, 1f)
                    }
                }) {
                    val path = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset.Zero, size)) }
                    clipPath(path) { drawImage(image, IntOffset(crop.left, crop.top), IntSize(crop.width(), crop.height()), dstSize = IntSize(size.width.toInt(), size.height.toInt())) }
                    drawCircle(colors.accent, size.minDimension / 2, style = Stroke(3.dp.toPx()))
                }
                Slider(value = zoom, onValueChange = { zoom = it }, valueRange = 1f..4f)
            } else Text(if (loading) "写真を読み込んでいます…" else "この写真を開けませんでした。キャンセルして別の写真を選んでください。", color = colors.ink)
        } },
        confirmButton = { TextButton(enabled = source != null, onClick = { source?.let { model.saveAvatarCrop(it, zoom, fx, fy) }; close() }) { Text("この位置で保存") } },
        dismissButton = { TextButton(onClick = close) { Text("キャンセル") } })
}
