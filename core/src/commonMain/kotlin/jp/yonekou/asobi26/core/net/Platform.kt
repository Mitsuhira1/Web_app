package jp.yonekou.asobi26.core.net

/**
 * 通信で使う小さな部品(Base64・CRC32・deflate・SHA-256・HMAC・AES-GCM)を、JVM にも JS(ブラウザ)にもある形で自前で持つ。
 * Android 版は java.util.zip・javax.crypto を使っているので、同じ入力から必ず同じ出力になること(互換)が要る。
 * JVM 上で JDK の部品と照らし合わせる試験は jvmMain の CryptoCheck にある。
 */

expect fun secureRandomBytes(n: Int): ByteArray

class ByteSink(initial: Int = 64) {
    private var buf = ByteArray(initial)
    private var n = 0
    private fun ensure(extra: Int) { if (n + extra > buf.size) buf = buf.copyOf(maxOf(buf.size * 2, n + extra)) }
    fun write(b: Int) { ensure(1); buf[n++] = b.toByte() }
    fun write(a: ByteArray) = write(a, 0, a.size)
    fun write(a: ByteArray, off: Int, len: Int) { ensure(len); a.copyInto(buf, n, off, off + len); n += len }
    fun size(): Int = n
    fun toByteArray(): ByteArray = buf.copyOf(n)
}

object Crc32 {
    private val table = IntArray(256) { i -> var c = i; repeat(8) { c = if (c and 1 != 0) (c ushr 1) xor 0xEDB88320.toInt() else c ushr 1 }; c }
    fun of(b: ByteArray): Int { var c = -1; for (x in b) c = table[(c xor x.toInt()) and 0xff] xor (c ushr 8); return c.inv() }
}

object B64 {
    private const val URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    private val rev = IntArray(128) { -1 }.also { for ((i, c) in URL.withIndex()) it[c.code] = i }
    fun urlEncode(b: ByteArray): String {
        val sb = StringBuilder()
        var i = 0
        while (i + 2 < b.size) {
            val v = ((b[i].toInt() and 0xff) shl 16) or ((b[i + 1].toInt() and 0xff) shl 8) or (b[i + 2].toInt() and 0xff)
            sb.append(URL[v shr 18 and 63]).append(URL[v shr 12 and 63]).append(URL[v shr 6 and 63]).append(URL[v and 63]); i += 3
        }
        when (b.size - i) {
            1 -> { val v = (b[i].toInt() and 0xff) shl 16; sb.append(URL[v shr 18 and 63]).append(URL[v shr 12 and 63]) }
            2 -> { val v = ((b[i].toInt() and 0xff) shl 16) or ((b[i + 1].toInt() and 0xff) shl 8); sb.append(URL[v shr 18 and 63]).append(URL[v shr 12 and 63]).append(URL[v shr 6 and 63]) }
        }
        return sb.toString()
    }
    /** 不正な文字・長さは IllegalArgumentException(Java の getUrlDecoder と同じ。パディングの '=' は末尾だけ許す) */
    fun urlDecode(s0: String): ByteArray {
        val s = s0.trimEnd('=')
        if (s.length % 4 == 1) throw IllegalArgumentException("bad length")
        val out = ByteSink(s.length)
        var acc = 0; var bits = 0
        for (ch in s) {
            val v = if (ch.code < 128) rev[ch.code] else -1
            if (v < 0) throw IllegalArgumentException("bad char")
            acc = (acc shl 6) or v; bits += 6
            if (bits >= 8) { bits -= 8; out.write((acc shr bits) and 0xff) }
        }
        return out.toByteArray()
    }
}

object Zlib {
    /** 圧縮せず「無圧縮ブロック」だけで作った raw deflate(どの inflate でも読める。Android 版の Inflater(true) でも読める) */
    fun deflateRaw(b: ByteArray): ByteArray {
        val out = ByteSink(b.size + 16)
        var pos = 0
        if (b.isEmpty()) { out.write(1); out.write(0); out.write(0); out.write(0xff); out.write(0xff); return out.toByteArray() }
        while (pos < b.size) {
            val n = minOf(65535, b.size - pos)
            out.write(if (pos + n >= b.size) 1 else 0)
            out.write(n and 0xff); out.write(n shr 8); out.write(n.inv() and 0xff); out.write((n.inv() shr 8) and 0xff)
            out.write(b, pos, n); pos += n
        }
        return out.toByteArray()
    }

    private val LBASE = intArrayOf(3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258)
    private val LEXT = intArrayOf(0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0)
    private val DBASE = intArrayOf(1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577)
    private val DEXT = intArrayOf(0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13)
    private val ORDER = intArrayOf(16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15)

    private class Huff(lengths: IntArray) {
        val count = IntArray(16)
        val symbol = IntArray(lengths.size)
        init {
            for (l in lengths) count[l]++
            count[0] = 0
            val offs = IntArray(16)
            for (i in 1 until 15) offs[i + 1] = offs[i] + count[i]
            for ((s, l) in lengths.withIndex()) if (l != 0) symbol[offs[l]++] = s
        }
    }

    private class Bits(val d: ByteArray) {
        var pos = 0; var bit = 0
        fun one(): Int { if (pos >= d.size) throw IllegalStateException("eof"); val v = (d[pos].toInt() shr bit) and 1; if (++bit == 8) { bit = 0; pos++ }; return v }
        fun bits(n: Int): Int { var v = 0; for (i in 0 until n) v = v or (one() shl i); return v }
        fun decode(h: Huff): Int {
            var code = 0; var first = 0; var index = 0
            for (len in 1..15) {
                code = code or one()
                val c = h.count[len]
                if (code - c < first) return h.symbol[index + (code - first)]
                index += c; first += c; first = first shl 1; code = code shl 1
            }
            throw IllegalStateException("bad code")
        }
    }

    /** raw deflate を開く。壊れていたら null。maxOut を超えたら null */
    fun inflateRaw(src: ByteArray, maxOut: Int): ByteArray? = try { inflate(src, maxOut) } catch (e: IllegalStateException) { null } catch (e: IndexOutOfBoundsException) { null }

    private fun inflate(src: ByteArray, maxOut: Int): ByteArray? {
        val br = Bits(src)
        val out = ByteSink(src.size * 3)
        var last: Int
        do {
            last = br.one()
            when (br.bits(2)) {
                0 -> {
                    br.bit = 0; br.pos++
                    if (br.pos + 4 > src.size) return null
                    val len = (src[br.pos].toInt() and 0xff) or ((src[br.pos + 1].toInt() and 0xff) shl 8)
                    val nlen = (src[br.pos + 2].toInt() and 0xff) or ((src[br.pos + 3].toInt() and 0xff) shl 8)
                    if (len != (nlen.inv() and 0xffff)) return null
                    br.pos += 4
                    if (br.pos + len > src.size) return null
                    out.write(src, br.pos, len); br.pos += len
                }
                1 -> {
                    val l = IntArray(288) { when { it < 144 -> 8; it < 256 -> 9; it < 280 -> 7; else -> 8 } }
                    codes(br, out, Huff(l), Huff(IntArray(30) { 5 }))
                }
                2 -> {
                    val nlen = br.bits(5) + 257; val ndist = br.bits(5) + 1; val ncode = br.bits(4) + 4
                    val lengths = IntArray(320)
                    for (i in 0 until ncode) lengths[ORDER[i]] = br.bits(3)
                    val lencode = Huff(lengths.copyOf(19))
                    var idx = 0
                    while (idx < nlen + ndist) {
                        val sym = br.decode(lencode)
                        if (sym < 16) lengths[idx++] = sym
                        else {
                            var len = 0; val rep: Int
                            when (sym) {
                                16 -> { if (idx == 0) return null; len = lengths[idx - 1]; rep = 3 + br.bits(2) }
                                17 -> rep = 3 + br.bits(3)
                                else -> rep = 11 + br.bits(7)
                            }
                            if (idx + rep > nlen + ndist) return null
                            repeat(rep) { lengths[idx++] = len }
                        }
                    }
                    codes(br, out, Huff(lengths.copyOfRange(0, nlen)), Huff(lengths.copyOfRange(nlen, nlen + ndist)))
                }
                else -> return null
            }
            if (out.size() > maxOut) return null
        } while (last == 0)
        return out.toByteArray()
    }

    private fun codes(br: Bits, out: ByteSink, lc: Huff, dc: Huff) {
        // 出力の途中を参照するため、書き込んだ分を一度配列で持つ
        var hist = out.toByteArray()
        var histLen = hist.size
        hist = hist.copyOf(maxOf(hist.size * 2, 1024))
        fun put(b: Int) { if (histLen >= hist.size) hist = hist.copyOf(hist.size * 2); hist[histLen++] = b.toByte(); out.write(b) }
        while (true) {
            val sym = br.decode(lc)
            if (sym < 256) put(sym)
            else if (sym == 256) return
            else {
                val s = sym - 257
                if (s >= 29) throw IllegalStateException("bad len")
                val len = LBASE[s] + br.bits(LEXT[s])
                val ds = br.decode(dc)
                if (ds >= 30) throw IllegalStateException("bad dist")
                val dist = DBASE[ds] + br.bits(DEXT[ds])
                if (dist > histLen) throw IllegalStateException("too far")
                repeat(len) { put(hist[histLen - dist].toInt() and 0xff) }
            }
            if (histLen > 1_000_000) throw IllegalStateException("too big")
        }
    }
}

object Sha256 {
    private val K = intArrayOf(
        0x428a2f98, 0x71374491, -0x4a3f0431, -0x164a245b, 0x3956c25b, 0x59f111f1, -0x6dc07d5c, -0x54e3a12b, -0x27f85568, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, -0x7f214e02, -0x6423f959, -0x3e640e8c,
        -0x1b64963f, -0x1041b87a, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, -0x67c1aeae, -0x57ce3993, -0x4ffcd838, -0x40a68039, -0x391ff40d, -0x2a586eb9, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, -0x7e3d36d2, -0x6d8dd37b, -0x5d40175f, -0x57e599b5, -0x3db47490, -0x3893ae5d, -0x2e6d17e7, -0x2966f9dc, -0x0bf1ca7b, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, -0x7b3787ec, -0x7338fdf8, -0x6f410006, -0x5baf9315, -0x41065c09, -0x398e870e,
    )
    private fun rotr(x: Int, n: Int) = (x ushr n) or (x shl (32 - n))
    fun hash(data: ByteArray): ByteArray {
        val h = intArrayOf(0x6a09e667, -0x4498517b, 0x3c6ef372, -0x5ab00ac6, 0x510e527f, -0x64fa9774, 0x1f83d9ab, 0x5be0cd19)
        val padLen = ((data.size + 8) / 64 + 1) * 64
        val m = ByteArray(padLen)
        data.copyInto(m)
        m[data.size] = 0x80.toByte()
        val bitLen = data.size.toLong() * 8
        for (i in 0 until 8) m[padLen - 1 - i] = (bitLen ushr (8 * i)).toByte()
        val w = IntArray(64)
        for (off in 0 until padLen step 64) {
            for (i in 0 until 16) w[i] = ((m[off + 4 * i].toInt() and 0xff) shl 24) or ((m[off + 4 * i + 1].toInt() and 0xff) shl 16) or ((m[off + 4 * i + 2].toInt() and 0xff) shl 8) or (m[off + 4 * i + 3].toInt() and 0xff)
            for (i in 16 until 64) {
                val s0 = rotr(w[i - 15], 7) xor rotr(w[i - 15], 18) xor (w[i - 15] ushr 3)
                val s1 = rotr(w[i - 2], 17) xor rotr(w[i - 2], 19) xor (w[i - 2] ushr 10)
                w[i] = w[i - 16] + s0 + w[i - 7] + s1
            }
            var a = h[0]; var b = h[1]; var c = h[2]; var d = h[3]; var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7]
            for (i in 0 until 64) {
                val t1 = hh + (rotr(e, 6) xor rotr(e, 11) xor rotr(e, 25)) + ((e and f) xor (e.inv() and g)) + K[i] + w[i]
                val t2 = (rotr(a, 2) xor rotr(a, 13) xor rotr(a, 22)) + ((a and b) xor (a and c) xor (b and c))
                hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2
            }
            h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
        }
        val out = ByteArray(32)
        for (i in 0 until 8) for (j in 0 until 4) out[4 * i + j] = (h[i] ushr (24 - 8 * j)).toByte()
        return out
    }
    fun hmac(key: ByteArray, msg: ByteArray): ByteArray {
        var k = if (key.size > 64) hash(key) else key
        k = k.copyOf(64)
        val ipad = ByteArray(64) { (k[it].toInt() xor 0x36).toByte() }
        val opad = ByteArray(64) { (k[it].toInt() xor 0x5c).toByte() }
        return hash(opad + hash(ipad + msg))
    }
}

/** AES-256-GCM(128bit タグ、12 バイトの nonce)。Java の "AES/GCM/NoPadding" と同じ出力(暗号文+タグ) */
object AesGcm {
    private val SBOX = IntArray(256).also { s ->
        var p = 1; var q = 1
        do {
            p = p xor ((p shl 1) and 0xff) xor (if (p and 0x80 != 0) 0x1b else 0)
            q = q xor (q shl 1); q = q xor (q shl 2); q = q xor (q shl 4); q = q and 0xff
            if (q and 0x80 != 0) q = q xor 0x09
            val x = q xor ((q shl 1) or (q ushr 7)) xor ((q shl 2) or (q ushr 6)) xor ((q shl 3) or (q ushr 5)) xor ((q shl 4) or (q ushr 4))
            s[p] = (x xor 0x63) and 0xff
        } while (p != 1)
        s[0] = 0x63
    }
    private fun xtime(x: Int) = ((x shl 1) xor (if (x and 0x80 != 0) 0x1b else 0)) and 0xff

    private fun expand(key: ByteArray): Array<IntArray> {
        val nk = key.size / 4; val rounds = nk + 6
        val w = IntArray(4 * (rounds + 1))
        for (i in 0 until nk) w[i] = ((key[4 * i].toInt() and 0xff) shl 24) or ((key[4 * i + 1].toInt() and 0xff) shl 16) or ((key[4 * i + 2].toInt() and 0xff) shl 8) or (key[4 * i + 3].toInt() and 0xff)
        var rcon = 1
        for (i in nk until w.size) {
            var t = w[i - 1]
            if (i % nk == 0) {
                t = (t shl 8) or (t ushr 24)
                t = (SBOX[t ushr 24 and 0xff] shl 24) or (SBOX[t ushr 16 and 0xff] shl 16) or (SBOX[t ushr 8 and 0xff] shl 8) or SBOX[t and 0xff]
                t = t xor (rcon shl 24); rcon = xtime(rcon)
            } else if (nk > 6 && i % nk == 4) {
                t = (SBOX[t ushr 24 and 0xff] shl 24) or (SBOX[t ushr 16 and 0xff] shl 16) or (SBOX[t ushr 8 and 0xff] shl 8) or SBOX[t and 0xff]
            }
            w[i] = w[i - nk] xor t
        }
        return Array(rounds + 1) { r -> IntArray(4) { w[4 * r + it] } }
    }

    private fun encryptBlock(rk: Array<IntArray>, input: ByteArray): ByteArray {
        val s = IntArray(16) { input[it].toInt() and 0xff }
        fun addKey(r: Int) { for (c in 0 until 4) for (j in 0 until 4) s[4 * c + j] = s[4 * c + j] xor ((rk[r][c] ushr (24 - 8 * j)) and 0xff) }
        addKey(0)
        for (r in 1 until rk.size) {
            for (i in 0 until 16) s[i] = SBOX[s[i]]
            val t = s.copyOf()
            for (c in 0 until 4) for (j in 0 until 4) s[4 * c + j] = t[4 * ((c + j) % 4) + j]
            if (r != rk.size - 1) for (c in 0 until 4) {
                val a0 = s[4 * c]; val a1 = s[4 * c + 1]; val a2 = s[4 * c + 2]; val a3 = s[4 * c + 3]
                s[4 * c] = xtime(a0) xor (xtime(a1) xor a1) xor a2 xor a3
                s[4 * c + 1] = a0 xor xtime(a1) xor (xtime(a2) xor a2) xor a3
                s[4 * c + 2] = a0 xor a1 xor xtime(a2) xor (xtime(a3) xor a3)
                s[4 * c + 3] = (xtime(a0) xor a0) xor a1 xor a2 xor xtime(a3)
            }
            addKey(r)
        }
        return ByteArray(16) { s[it].toByte() }
    }

    private fun gmul(x: ByteArray, y: ByteArray): ByteArray {
        val z = ByteArray(16); val v = y.copyOf()
        for (i in 0 until 128) {
            if ((x[i / 8].toInt() shr (7 - i % 8)) and 1 == 1) for (k in 0 until 16) z[k] = (z[k].toInt() xor v[k].toInt()).toByte()
            val lsb = v[15].toInt() and 1
            for (k in 15 downTo 1) v[k] = (((v[k].toInt() and 0xff) ushr 1) or ((v[k - 1].toInt() and 1) shl 7)).toByte()
            v[0] = ((v[0].toInt() and 0xff) ushr 1).toByte()
            if (lsb == 1) v[0] = (v[0].toInt() xor 0xe1).toByte()
        }
        return z
    }

    private fun ghash(h: ByteArray, aad: ByteArray, ct: ByteArray): ByteArray {
        var y = ByteArray(16)
        fun feed(data: ByteArray) {
            var i = 0
            while (i < data.size) {
                val blk = ByteArray(16); data.copyInto(blk, 0, i, minOf(i + 16, data.size))
                for (k in 0 until 16) blk[k] = (blk[k].toInt() xor y[k].toInt()).toByte()
                y = gmul(blk, h); i += 16
            }
        }
        feed(aad); feed(ct)
        val lens = ByteArray(16)
        val a = aad.size.toLong() * 8; val c = ct.size.toLong() * 8
        for (i in 0 until 8) { lens[7 - i] = (a ushr (8 * i)).toByte(); lens[15 - i] = (c ushr (8 * i)).toByte() }
        for (k in 0 until 16) lens[k] = (lens[k].toInt() xor y[k].toInt()).toByte()
        return gmul(lens, h)
    }

    private fun ctr(rk: Array<IntArray>, nonce: ByteArray, data: ByteArray): ByteArray {
        val out = ByteArray(data.size)
        val cb = ByteArray(16); nonce.copyInto(cb)
        var counter = 2
        var i = 0
        while (i < data.size) {
            cb[12] = (counter ushr 24).toByte(); cb[13] = (counter ushr 16).toByte(); cb[14] = (counter ushr 8).toByte(); cb[15] = counter.toByte()
            val ks = encryptBlock(rk, cb)
            for (k in 0 until minOf(16, data.size - i)) out[i + k] = (data[i + k].toInt() xor ks[k].toInt()).toByte()
            i += 16; counter++
        }
        return out
    }

    private fun tag(rk: Array<IntArray>, nonce: ByteArray, aad: ByteArray, ct: ByteArray): ByteArray {
        val h = encryptBlock(rk, ByteArray(16))
        val s = ghash(h, aad, ct)
        val j0 = ByteArray(16); nonce.copyInto(j0); j0[15] = 1
        val e = encryptBlock(rk, j0)
        return ByteArray(16) { (s[it].toInt() xor e[it].toInt()).toByte() }
    }

    fun seal(key: ByteArray, nonce: ByteArray, aad: ByteArray, plain: ByteArray): ByteArray {
        val rk = expand(key)
        val ct = ctr(rk, nonce, plain)
        return ct + tag(rk, nonce, aad, ct)
    }

    /** 改ざん・鍵違いは null */
    fun open(key: ByteArray, nonce: ByteArray, aad: ByteArray, sealed: ByteArray): ByteArray? {
        if (sealed.size < 16) return null
        val rk = expand(key)
        val ct = sealed.copyOfRange(0, sealed.size - 16)
        val t = sealed.copyOfRange(sealed.size - 16, sealed.size)
        val want = tag(rk, nonce, aad, ct)
        var diff = 0
        for (i in 0 until 16) diff = diff or (t[i].toInt() xor want[i].toInt())
        if (diff != 0) return null
        return ctr(rk, nonce, ct)
    }
}
