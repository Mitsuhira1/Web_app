package jp.yonekou.asobi26.web

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState

/** 画面の大きさ(Android の LocalConfiguration と同じ使い方) */
class Configuration(val screenWidthDp: Int, val screenHeightDp: Int)
@JsFun("() => window.innerWidth") private external fun innerW(): Int
@JsFun("() => window.innerHeight") private external fun innerH(): Int
object LocalConfiguration { val current: Configuration get() = Configuration(innerW(), innerH()) }

/** 短いお知らせ(Android の Toast と同じ使い方)。画面の下に少しの間出す */
@JsFun("(t, ms) => { try { globalThis.asobiToast(t, ms); } catch (e) {} }")
private external fun jsToast(text: String, ms: Int)
object Toast {
    const val LENGTH_SHORT = 0
    const val LENGTH_LONG = 1
    class Msg(private val text: String, private val long: Boolean) { fun show() = jsToast(text, if (long) 3500 else 2000) }
    fun makeText(@Suppress("UNUSED_PARAMETER") ctx: Context, text: String, length: Int) = Msg(text, length == LENGTH_LONG)
}

@JsFun("(t) => { try { if (navigator.share) { navigator.share({ text: t }).catch(() => {}); return; } } catch (e) {} try { navigator.clipboard.writeText(t); globalThis.asobiToast('コピーしました', 2000); } catch (e) {} }")
private external fun jsShare(text: String)
fun webShare(text: String) = jsShare(text)

/** 写真を選ぶ(Android の写真の選択と同じ使い方)。選んだファイルの中身を Uri として渡す */
@JsFun("(cb) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files && i.files[0]; if (!f) { cb(null); return; } const b = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000)); cb(btoa(s)); }; i.click(); }")
private external fun jsPickImage(cb: (String?) -> Unit)

@OptIn(kotlin.io.encoding.ExperimentalEncodingApi::class)
@Composable
fun rememberImagePicker(onPicked: (Uri?) -> Unit): () -> Unit {
    val cb = rememberUpdatedState(onPicked)
    return remember { { jsPickImage { b64 -> cb.value(b64?.let { Uri(kotlin.io.encoding.Base64.decode(it)) }) } } }
}
