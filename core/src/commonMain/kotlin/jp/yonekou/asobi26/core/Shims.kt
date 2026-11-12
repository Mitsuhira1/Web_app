package jp.yonekou.asobi26.core

import kotlin.time.TimeSource

/**
 * JVM(Android)と JS(ブラウザ)の両方で動かすための小さな置き換え。
 * 元のアプリ(Android)のコードから、JVM にしかない部品だけをここに集めた。規則の結果は変えない。
 */

private val clockOrigin = TimeSource.Monotonic.markNow()

/** 単調に増える時刻(ナノ秒)。CPU の思考時間の打ち切りに使う */
fun nowNanos(): Long = clockOrigin.elapsedNow().inWholeNanoseconds

/** ブラウザは 1 スレッドなので、スレッドごとの値は 1 つの値で足りる */
class ThreadLocal<T> private constructor(private val v: Lazy<T>) {
    fun get(): T = v.value
    companion object { fun <T> withInitial(f: () -> T): ThreadLocal<T> = ThreadLocal(lazy(f)) }
}

/** ブラウザは 1 スレッドなので、排他は要らない */
inline fun <R> synchronized(@Suppress("UNUSED_PARAMETER") lock: Any, block: () -> R): R = block()

/** 3 桁ごとにカンマ(Java の "%,d" と同じ) */
fun groupDigits(v: Int): String {
    val neg = v < 0
    val digits = (if (neg) -(v.toLong()) else v.toLong()).toString()
    val sb = StringBuilder()
    for ((i, ch) in digits.withIndex()) { if (i > 0 && (digits.length - i) % 3 == 0) sb.append(','); sb.append(ch) }
    return (if (neg) "-" else "") + sb
}

/**
 * Java の java.util.Random と同じ数列を出す乱数(線形合同法)。
 * Android 版の席の並べ替え(OnlineRoom.start)が java.util.Random を使っているので、クロスプレイで同じ並びにするために必要。
 */
class JavaRandom(seed: Long) {
    private var seed: Long = (seed xor 0x5DEECE66DL) and ((1L shl 48) - 1)

    private fun next(bits: Int): Int {
        seed = (seed * 0x5DEECE66DL + 0xBL) and ((1L shl 48) - 1)
        return (seed ushr (48 - bits)).toInt()
    }

    fun nextInt(bound: Int): Int {
        require(bound > 0)
        var r = next(31)
        val m = bound - 1
        if (bound and m == 0) return ((bound.toLong() * r.toLong()) shr 31).toInt()
        var u = r
        while (true) {
            r = u % bound
            if (u - r + m >= 0) break
            u = next(31)
        }
        return r
    }
}

/** 壁の時計(ミリ秒)。通信の「チャットの連続送信」の間隔の判定に使う */
expect fun currentTimeMillis(): Long
