package jp.yonekou.asobi26.web

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap

/** Android のアプリ・ViewModel・タイマー・スレッドと同じ名前の部品(ブラウザ用。ブラウザは1スレッド) */
open class Application : Context()
object WebApplication : Application()

open class AndroidViewModel(private val app: Application) {
    @Suppress("UNCHECKED_CAST")
    fun <T : Application> getApplication(): T = app as T
    protected open fun onCleared() {}
}

fun interface Runnable { fun run() }

@JsFun("(f, ms) => setTimeout(f, ms)")
private external fun jsSetTimeout(f: () -> Unit, ms: Int): Int
@JsFun("(id) => clearTimeout(id)")
private external fun jsClearTimeout(id: Int)

class Looper private constructor() { companion object { fun getMainLooper(): Looper = Looper() } }

/** Handler: post・postDelayed・removeCallbacks を setTimeout で */
class Handler(@Suppress("UNUSED_PARAMETER") looper: Looper) {
    private val timers = HashMap<Runnable, MutableList<Int>>()
    fun post(r: Runnable): Boolean = postDelayed(r, 0)
    fun postDelayed(r: Runnable, ms: Long): Boolean {
        var id = 0
        id = jsSetTimeout({
            timers[r]?.let { it.remove(id); if (it.isEmpty()) timers.remove(r) }
            r.run()
        }, ms.coerceIn(0, Int.MAX_VALUE.toLong()).toInt())
        timers.getOrPut(r) { ArrayList() }.add(id)
        return true
    }
    fun removeCallbacks(r: Runnable) { timers.remove(r)?.forEach { jsClearTimeout(it) } }
    fun removeCallbacksAndMessages(@Suppress("UNUSED_PARAMETER") token: Any?) { for ((_, ids) in timers) ids.forEach { jsClearTimeout(it) }; timers.clear() }
}

/** スレッドの代わり: start で、画面の描き直しの合間に1回動かす */
class Thread(private val r: Runnable, @Suppress("UNUSED_PARAMETER") name: String = "") {
    constructor(block: () -> Unit) : this(Runnable { block() })
    var isDaemon: Boolean = false
    var priority: Int = 5
    fun start() { jsSetTimeout({ r.run() }, 0) }
    companion object { const val MIN_PRIORITY = 1; const val NORM_PRIORITY = 5 }
}
object Process { const val THREAD_PRIORITY_BACKGROUND = 10; fun setThreadPriority(@Suppress("UNUSED_PARAMETER") p: Int) {} }

/** 1本のスレッドの代わり: 仕事を順に、画面の描き直しの合間(setTimeout)に行う */
class ExecutorService {
    private var shut = false
    fun execute(task: () -> Unit) { if (!shut) jsSetTimeout({ if (!shut) task() }, 0) }
    fun shutdownNow(): List<Runnable> { shut = true; return emptyList() }
}
object Executors {
    fun newSingleThreadExecutor(): ExecutorService = ExecutorService()
    fun newSingleThreadExecutor(@Suppress("UNUSED_PARAMETER") factory: (Runnable) -> Thread): ExecutorService = ExecutorService()
}

// ---------------------------------------------------------------- 写真(Bitmap・Uri の代わり)
/** 選んだ写真のファイルの中身 */
class Uri(val bytes: ByteArray)

/** Skia の画像を包んだもの(Android の Bitmap の代わり) */
class Bitmap(val image: org.jetbrains.skia.Image) {
    val width: Int get() = image.width
    val height: Int get() = image.height
}
fun Bitmap.asImageBitmap(): ImageBitmap = image.toComposeImageBitmap()
