package jp.yonekou.asobi26.core.net

/** JVM と JS で出力を比べる、通信部品の確かな値(固定の入力から作る)。 */
object NetCheck {
    private fun hex(b: ByteArray) = b.joinToString("") { hex2(it.toInt() and 0xff).lowercase() }

    fun report(): String {
        val sb = StringBuilder()
        val key = ByteArray(16) { (it * 7 + 3).toByte() }
        sb.append("topic ").append(RelayCrypto.topic(key)).append('\n')
        val nonce = ByteArray(12) { (it + 1).toByte() }
        for (text in listOf("hello", "", "返信コードの本文 v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n" + "x".repeat(200))) {
            val sealed = RelayCrypto.sealWith(key, text, nonce)
            sb.append("seal ").append(sealed).append(" open=").append(RelayCrypto.open(key, sealed) == text).append('\n')
        }
        sb.append("sha ").append(hex(Sha256.hash("abc".encodeToByteArray()))).append('\n')
        sb.append("sha2 ").append(hex(Sha256.hash(ByteArray(1000) { it.toByte() }))).append('\n')
        sb.append("hmac ").append(hex(Sha256.hmac(key, "asobi26/relay/topic".encodeToByteArray()))).append('\n')
        val data = ByteArray(300) { (it * 31).toByte() }
        sb.append("crc ").append(Crc32.of(data)).append('\n')
        sb.append("b64 ").append(B64.urlEncode(data)).append('\n')
        sb.append("b64rt ").append(B64.urlDecode(B64.urlEncode(data)).contentEquals(data)).append('\n')
        val z = Zlib.deflateRaw(data)
        sb.append("zraw ").append(Zlib.inflateRaw(z, 100000)?.contentEquals(data)).append('\n')
        // 招待コード(短縮形式)の往復
        val info = CompactInfo("abcd", "0123456789abcdefghijkl", ByteArray(32) { (it * 5).toByte() }, listOf(CompactCandidate(byteArrayOf(192.toByte(), 168.toByte(), 1, 5), 5000, 0), CompactCandidate(byteArrayOf(8, 8, 4, 4), 49152, 1)), key)
        val code = InviteCodec.encodeCompact(InviteKind.OFFER, info)
        sb.append("code ").append(code).append('\n')
        val back = InviteCodec.parse(code, InviteKind.OFFER)
        sb.append("parse ").append(if (back is Parsed.Compact) back.info.ufrag + "/" + back.info.candidates.size + "/" + back.info.relayKey?.let { hex(it) } else back.toString()).append('\n')
        return sb.toString()
    }
}
