import jp.yonekou.asobi26.core.net.*
import java.util.zip.Deflater
import java.util.zip.Inflater
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.random.Random

/** 自前の部品が、JDK の部品(Android 版が使っているもの)と同じ結果になるかを調べる。 */
fun cryptoCheck(): String {
    val sb = StringBuilder()
    val r = Random(42)
    var bad = 0
    fun check(name: String, ok: Boolean) { if (!ok) { bad++; sb.append("NG ").append(name).append('\n') } }
    repeat(60) { i ->
        val len = r.nextInt(0, 3000)
        val data = r.nextBytes(len)
        val key = r.nextBytes(32)
        // SHA-256 / HMAC
        check("sha$i", Sha256.hash(data).contentEquals(java.security.MessageDigest.getInstance("SHA-256").digest(data)))
        val mac = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key.copyOf(r.nextInt(1, 33)).let { k -> k }, "HmacSHA256")) }
        val k2 = r.nextBytes(r.nextInt(1, 100))
        val mac2 = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(k2, "HmacSHA256")) }
        check("hmac$i", Sha256.hmac(k2, data).contentEquals(mac2.doFinal(data)))
        // AES-GCM
        val nonce = r.nextBytes(12); val aad = r.nextBytes(r.nextInt(0, 80))
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce)); updateAAD(aad) }
        val jdk = c.doFinal(data)
        check("gcmseal$i", AesGcm.seal(key, nonce, aad, data).contentEquals(jdk))
        check("gcmopen$i", AesGcm.open(key, nonce, aad, jdk)?.contentEquals(data) == true)
        val bent = jdk.copyOf(); if (bent.isNotEmpty()) bent[0] = (bent[0].toInt() xor 1).toByte()
        check("gcmbad$i", bent.isEmpty() || AesGcm.open(key, nonce, aad, bent) == null)
        // CRC32 / Base64
        check("crc$i", Crc32.of(data) == java.util.zip.CRC32().apply { update(data) }.value.toInt())
        check("b64$i", B64.urlEncode(data) == java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(data))
        check("b64d$i", B64.urlDecode(java.util.Base64.getUrlEncoder().encodeToString(data)).contentEquals(data))
        // deflate: JDK で圧縮 → 自前で開く / 自前で作る → JDK で開く
        val text = ByteArray(len) { (data[it].toInt() and 7).toByte() } // 圧縮しやすい列
        for (level in intArrayOf(Deflater.BEST_COMPRESSION, Deflater.BEST_SPEED, Deflater.NO_COMPRESSION)) {
            val d = Deflater(level, true); d.setInput(text); d.finish()
            val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(512)
            while (!d.finished()) out.write(buf, 0, d.deflate(buf))
            check("inflate$i/$level", Zlib.inflateRaw(out.toByteArray(), 1_000_000)?.contentEquals(text) == true)
        }
        val mine = Zlib.deflateRaw(text)
        val inf = Inflater(true); inf.setInput(mine)
        val ob = java.io.ByteArrayOutputStream(); val b2 = ByteArray(1024)
        while (!inf.finished()) { val g = inf.inflate(b2); if (g == 0 && inf.needsInput()) break; ob.write(b2, 0, g) }
        check("deflate$i", ob.toByteArray().contentEquals(text))
    }
    sb.append(if (bad == 0) "通信部品の照合: すべて一致\n" else "通信部品の照合: $bad 件が不一致\n")
    // 返信コード(Android 版の RelayCrypto と同じ手順を JDK で書き、自前の実装と取り替えて開けるか)
    val key = Random(7).nextBytes(16)
    val jdkHmac = { label: String -> Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key, "HmacSHA256")) }.doFinal(label.toByteArray()) }
    val topic = "as-" + jdkHmac("asobi26/relay/topic").take(16).joinToString("") { "%02x".format(it.toInt() and 0xff) }
    check("topic", topic == RelayCrypto.topic(key))
    val aad = (topic + "/v1").toByteArray()
    val n = Random(8).nextBytes(12)
    val ci = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, SecretKeySpec(jdkHmac("asobi26/relay/enc"), "AES"), GCMParameterSpec(128, n)); updateAAD(aad) }
    val ct = ci.doFinal("返信コードのテスト".toByteArray())
    val packed = byteArrayOf(1) + n + ct
    val sealedJdk = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(packed)
    check("relay-open", RelayCrypto.open(key, sealedJdk) == "返信コードのテスト")
    check("relay-seal", RelayCrypto.sealWith(key, "返信コードのテスト", n) == sealedJdk)
    sb.append(if (bad == 0) "返信コードの互換: JDK 版と一致\n" else "返信コードの互換: 不一致あり\n")
    return sb.toString()
}
