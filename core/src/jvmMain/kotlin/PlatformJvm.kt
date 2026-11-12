package jp.yonekou.asobi26.core.net

private val rnd = java.security.SecureRandom()
actual fun secureRandomBytes(n: Int): ByteArray = ByteArray(n).also { rnd.nextBytes(it) }
