package jp.yonekou.asobi26.web

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.rememberUpdatedState

/**
 * 元のアプリ(Android)の画面のコードを、なるべく変えずにブラウザで動かすための置き換え部品。
 * Java・Android にしかない部品の、同じ名前・同じ動きのものをここに集める。
 */

@JsFun("() => performance.now()")
private external fun perfNow(): Double

@JsFun("() => Date.now()")
private external fun dateNow(): Double

object Math {
    const val PI: Double = kotlin.math.PI
    fun toRadians(deg: Double): Double = deg / 180.0 * PI
    fun floorMod(a: Int, b: Int): Int = ((a % b) + b) % b
    fun floorMod(a: Long, b: Long): Long = ((a % b) + b) % b
}

object Integer {
    fun bitCount(i: Int): Int = i.countOneBits()
}

object System {
    fun nanoTime(): Long = (perfNow() * 1_000_000.0).toLong()
    fun currentTimeMillis(): Long = dateNow().toLong()
    fun identityHashCode(x: Any?): Int = x?.hashCode() ?: 0
}

/** Android の SystemClock(起動からの時間)。ブラウザでは performance.now */
object SystemClock {
    fun uptimeMillis(): Long = perfNow().toLong()
    fun elapsedRealtime(): Long = perfNow().toLong()
}

/** ブラウザは 1 スレッドなので、排他・Volatile は要らない */
annotation class Volatile
inline fun <R> synchronized(@Suppress("UNUSED_PARAMETER") lock: Any, block: () -> R): R = block()

/** 使った順に古いものを捨てる表(Java の LinkedHashMap(accessOrder) + removeEldestEntry と同じ使い方) */
class LruMap<K, V>(private val max: Int) {
    private val map = LinkedHashMap<K, V>()
    operator fun get(key: K): V? { val v = map.remove(key) ?: return null; map[key] = v; return v }
    operator fun set(key: K, value: V) { map.remove(key); map[key] = value; while (map.size > max) map.remove(map.keys.first()) }
    fun put(key: K, value: V): V? { val old = map[key]; set(key, value); return old }
    fun getOrPut(key: K, make: () -> V): V = get(key) ?: make().also { set(key, it) }
    fun remove(key: K): V? = map.remove(key)
    fun clear() = map.clear()
    val size: Int get() = map.size
    fun containsKey(key: K): Boolean = map.containsKey(key)
}

/** "%,d"・"%d"・"%s"・"%02d"・"%.1f" だけを扱う String.format */
fun String.format(vararg args: Any?): String {
    val sb = StringBuilder()
    var i = 0
    var k = 0
    while (i < length) {
        val c = this[i]
        if (c != '%' || i + 1 >= length) { sb.append(c); i++; continue }
        var j = i + 1
        var comma = false
        var zero = false
        var width = 0
        var prec = -1
        if (this[j] == ',') { comma = true; j++ }
        if (j < length && this[j] == '0') { zero = true; j++ }
        while (j < length && this[j].isDigit()) { width = width * 10 + (this[j] - '0'); j++ }
        if (j < length && this[j] == '.') { j++; prec = 0; while (j < length && this[j].isDigit()) { prec = prec * 10 + (this[j] - '0'); j++ } }
        val conv = if (j < length) this[j] else 's'
        val arg = args.getOrNull(k)
        var s = when (conv) {
            'd' -> {
                val v = (arg as? Number)?.toLong() ?: 0L
                if (comma) groupThousands(v) else v.toString()
            }
            'f' -> {
                val v = (arg as? Number)?.toDouble() ?: 0.0
                val p = if (prec < 0) 6 else prec
                val m = kotlin.math.round(v * pow10(p)) / pow10(p)
                val t = m.toString()
                if (p == 0) m.toLong().toString() else { val dot = t.indexOf('.'); val frac = if (dot < 0) "" else t.substring(dot + 1); (if (dot < 0) t else t.substring(0, dot)) + "." + frac.padEnd(p, '0').take(p) }
            }
            'x' -> ((arg as? Number)?.toLong() ?: 0L).toString(16)
            'X' -> ((arg as? Number)?.toLong() ?: 0L).toString(16).uppercase()
            '%' -> { k--; "%" }
            else -> arg.toString()
        }
        if (width > 0 && s.length < width) s = if (zero) s.padStart(width, '0') else s.padStart(width, ' ')
        sb.append(s)
        k++
        i = j + 1
    }
    return sb.toString()
}
private fun pow10(n: Int): Double { var r = 1.0; repeat(n) { r *= 10.0 }; return r }
private fun groupThousands(v: Long): String {
    val neg = v < 0
    val d = (if (neg) -v else v).toString()
    val sb = StringBuilder()
    for ((i, ch) in d.withIndex()) { if (i > 0 && (d.length - i) % 3 == 0) sb.append(','); sb.append(ch) }
    return (if (neg) "-" else "") + sb
}

// ---------------------------------------------------------------- 戻るボタン(Android の BackHandler と同じ使い方)
// ブラウザの「戻る」(Android の戻るボタン)は main の JS から dispatchBack で届く。後から登録した有効なものが先に受け取る
private class BackEntry(var enabled: Boolean, var onBack: () -> Unit)
private val backStack = ArrayList<BackEntry>()

/** 戻るを受け取る人がいれば渡して true。いなければ false(ホーム: 終了の確認へ) */
fun dispatchBack(): Boolean {
    val e = backStack.lastOrNull { it.enabled } ?: return false
    e.onBack()
    return true
}

@Composable
fun BackHandler(enabled: Boolean = true, onBack: () -> Unit) {
    val current = rememberUpdatedState(onBack)
    DisposableEffect(enabled) {
        val entry = BackEntry(enabled) { current.value() }
        backStack.add(entry)
        onDispose { backStack.remove(entry) }
    }
}
