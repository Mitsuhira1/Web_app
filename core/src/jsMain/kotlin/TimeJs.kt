package jp.yonekou.asobi26.core

actual fun currentTimeMillis(): Long = js("Date.now()").unsafeCast<Double>().toLong()
