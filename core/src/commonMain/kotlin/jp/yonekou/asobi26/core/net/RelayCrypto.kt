package jp.yonekou.asobi26.core.net


/**
 * 「返信コードを自動で渡す」ための鍵と暗号。
 *
 * ・招待コードの中に 16 バイトの秘密の鍵を入れる(招待コードを知っている人だけが鍵を持つ)。
 * ・その鍵から、中継サーバー上の「掲示板の名前(トピック)」と、返信を包む暗号鍵を別々に作る(HMAC-SHA256)。
 *   掲示板の名前から鍵は逆算できない。
 * ・返信コードは AES-256-GCM で暗号化して置く。中継サーバーに見えるのは暗号文と掲示板の名前だけ。
 *   改ざんされた/鍵の違うものは復号できず、null になる。
 */
object RelayCrypto {
    const val KEY_BYTES = 16
    private const val VERSION = 1
    private const val NONCE_BYTES = 12
    private const val TAG_BITS = 128
    private const val MAX_SEALED_CHARS = 8_000

    fun newKey(): ByteArray = secureRandomBytes(KEY_BYTES)

    /** 中継サーバー上の掲示板の名前。文字は英数字と '-' だけ(ntfy のトピック名の規則に合う)。 */
    fun topic(key: ByteArray): String {
        val h = hmac(key, "asobi26/relay/topic")
        val sb = StringBuilder("as-")
        for (i in 0 until 16) sb.append(hex2(h[i].toInt() and 0xff).lowercase())
        return sb.toString()
    }

    /** 平文を暗号化して、掲示板に置ける1行の文字列(Base64url)にする。 */
    fun seal(key: ByteArray, plain: String): String = sealWith(key, plain, secureRandomBytes(NONCE_BYTES))

    /** nonce を指定して暗号化する(試験用。本番は seal)。 */
    fun sealWith(key: ByteArray, plain: String, nonce: ByteArray): String {
        val ct = AesGcm.seal(Sha256.hmac(key, "asobi26/relay/enc".encodeToByteArray()), nonce, aad(key), plain.encodeToByteArray())
        val packed = ByteArray(1 + NONCE_BYTES + ct.size)
        packed[0] = VERSION.toByte()
        nonce.copyInto(packed, 1)
        ct.copyInto(packed, 1 + NONCE_BYTES)
        return B64.urlEncode(packed)
    }

    /** seal で作った文字列を開く。鍵が違う・改ざん・形式違いは null。 */
    fun open(key: ByteArray, sealed: String): String? {
        val text = sealed.trim()
        if (text.isEmpty() || text.length > MAX_SEALED_CHARS) return null
        return try {
            val packed = B64.urlDecode(text)
            if (packed.size < 1 + NONCE_BYTES + TAG_BITS / 8 || packed[0].toInt() != VERSION) return null
            val nonce = packed.copyOfRange(1, 1 + NONCE_BYTES)
            val pt = AesGcm.open(Sha256.hmac(key, "asobi26/relay/enc".encodeToByteArray()), nonce, aad(key), packed.copyOfRange(1 + NONCE_BYTES, packed.size)) ?: return null
            pt.decodeToString()
        } catch (e: Exception) {
            null
        }
    }

    /** 掲示板の名前と版を、暗号の「付属データ」に入れる(別の掲示板へ移し替えた暗号文は開けなくなる)。 */
    private fun aad(key: ByteArray): ByteArray = (topic(key) + "/v" + VERSION).encodeToByteArray()

    private fun hmac(key: ByteArray, label: String): ByteArray = Sha256.hmac(key, label.encodeToByteArray())

    /** 2つの鍵が同じか(時間を一定にして比べる) */
    fun sameKey(a: ByteArray?, b: ByteArray?): Boolean {
        if (a == null || b == null || a.size != b.size) return false
        var d = 0
        for (i in a.indices) d = d or (a[i].toInt() xor b[i].toInt())
        return d == 0
    }
}
