package jp.yonekou.asobi26.core.net

actual fun secureRandomBytes(n: Int): ByteArray {
    val a = js("globalThis.crypto.getRandomValues(new Int8Array(n))")
    return a.unsafeCast<ByteArray>()
}
