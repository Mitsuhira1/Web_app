package jp.yonekou.asobi26.core.net

@JsFun("() => (globalThis.crypto.getRandomValues(new Uint8Array(1))[0])")
private external fun randomByte(): Int

actual fun secureRandomBytes(n: Int): ByteArray = ByteArray(n) { randomByte().toByte() }
