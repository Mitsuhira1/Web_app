package jp.yonekou.asobi26.core.net


enum class InviteKind(
    /** v1: SDP全体を圧縮した形式 */ val prefix: String,
    /** v2: 必要な値だけを取り出した短縮形式 */ val prefixCompact: String,
    val label: String,
    /** この種類のSDPで使う DTLS の役割 */ val setup: String,
) {
    OFFER("AS1O-", "AS2O-", "招待コード", "actpass"),
    ANSWER("AS1A-", "AS2A-", "返信コード", "active"),
}

internal fun hex2(v: Int): String = "0123456789ABCDEF"[v shr 4].toString() + "0123456789ABCDEF"[v and 15]

class Decoded(val sdp: String?, val error: String?)

/** 短縮形式に入れる接続候補 */
class CompactCandidate(val ip: ByteArray, val port: Int, val type: Int) {
    val isV6: Boolean get() = ip.size == 16
}

/** 接続に必要な最小限の値(SDPの残りは、受け取った側の自分のライブラリが出す雛形で補う) */
class CompactInfo(
    val ufrag: String,
    val pwd: String,
    val fingerprint: ByteArray,
    val candidates: List<CompactCandidate>,
    /** 招待コードにだけ入れる、返信を中継サーバー経由で自動で渡すための秘密の鍵(16バイト)。なければ手動の返信コードのみ */
    val relayKey: ByteArray? = null,
)

sealed class Parsed {
    class Full(val sdp: String) : Parsed()
    class Compact(val info: CompactInfo) : Parsed()
    class Bad(val message: String) : Parsed()
}

/**
 * WebRTC の接続情報(SDP)を、チャットに貼れる短い1行のコードにする。
 * 小さくするために ①使えない/不要な接続候補を捨てる(最大6件) ②deflate圧縮 ③4バイトのチェックサム付き Base64。
 * 貼り付け時は、前後に他の文章があってもコード部分だけを拾う。
 */
object InviteCodec {
    private const val MAX_CANDIDATES = 6
    private const val MAX_SDP_BYTES = 16 * 1024

    private const val MAX_COMPACT_CANDIDATES = 5
    private const val EXT_RELAY_KEY = 1 // 短縮形式の最後に付けられる追加項目: 1 + 鍵16バイト
    private val TYPES = arrayOf("host", "srflx", "prflx", "relay")

    /** 短縮形式にできればそれを、できなければ全体を圧縮した形式を返す。 */
    fun encode(kind: InviteKind, sdp: String): String {
        val info = compactOf(sdp)
        return if (info != null) encodeCompact(kind, info) else encodeFull(kind, sdp)
    }

    fun encodeCompact(kind: InviteKind, info: CompactInfo): String {
        val out = ByteSink(96)
        val u = info.ufrag.encodeToByteArray()
        val p = info.pwd.encodeToByteArray()
        out.write(u.size); out.write(u)
        out.write(p.size); out.write(p)
        out.write(info.fingerprint)
        out.write(info.candidates.size)
        for (c in info.candidates) {
            out.write((if (c.isV6) 1 else 0) or (c.type shl 1))
            out.write(c.ip)
            out.write(c.port shr 8); out.write(c.port and 0xff)
        }
        val key = info.relayKey
        if (key != null) {
            require(key.size == RelayCrypto.KEY_BYTES) { "鍵の長さが違います" }
            out.write(EXT_RELAY_KEY); out.write(key)
        }
        return kind.prefixCompact + withChecksum(out.toByteArray())
    }

    private fun withChecksum(body: ByteArray): String {
        val crc = Crc32.of(body)
        val packed = body.copyOf(body.size + 4)
        for (k in 0 until 4) packed[body.size + k] = (crc shr (24 - 8 * k)).toByte()
        return B64.urlEncode(packed)
    }

    /** SDP から短縮形式に必要な値を取り出す。標準的でない内容(SHA-256以外、候補なし等)なら null。 */
    fun compactOf(sdp: String): CompactInfo? {
        val lines = sdp.replace("\r", "").split('\n').filter { it.isNotEmpty() }
        if (lines.count { it.startsWith("m=") } != 1) return null
        val ufrag = lines.firstOrNull { it.startsWith("a=ice-ufrag:") }?.substringAfter(':') ?: return null
        val pwd = lines.firstOrNull { it.startsWith("a=ice-pwd:") }?.substringAfter(':') ?: return null
        val fpLine = lines.firstOrNull { it.startsWith("a=fingerprint:") }?.substringAfter(':') ?: return null
        val fpParts = fpLine.trim().split(' ')
        if (fpParts.size != 2 || !fpParts[0].equals("sha-256", ignoreCase = true)) return null
        val fpHex = fpParts[1].split(':')
        if (fpHex.size != 32) return null
        val fp = ByteArray(32)
        for (k in 0 until 32) fp[k] = (fpHex[k].toIntOrNull(16) ?: return null).toByte()
        if (ufrag.isEmpty() || ufrag.length > 255 || pwd.isEmpty() || pwd.length > 255) return null
        val ranked = ArrayList<Pair<Int, CompactCandidate>>()
        for (ln in lines) {
            if (!ln.startsWith("a=candidate:")) continue
            val r = rankCandidate(ln)
            if (r < 0) continue
            val t = ln.trim().split(' ')
            val ip = literalIp(t[4]) ?: continue
            val port = t[5].toIntOrNull() ?: continue
            val type = TYPES.indexOf(t[7])
            if (type < 0 || port !in 1..65535) continue
            ranked.add(r to CompactCandidate(ip, port, type))
        }
        if (ranked.isEmpty()) return null
        val kept = ranked.sortedBy { it.first }.take(MAX_COMPACT_CANDIDATES).map { it.second }
        return CompactInfo(ufrag, pwd, fp, kept)
    }

    /**
     * IPアドレスの文字列(IPv4/IPv6 の数字表記のみ)をバイト列にする。
     * OS の名前解決(InetAddress)は使わない: 数字表記でない文字列が来た時にネットワーク問い合わせが走り、
     * メインスレッドでは Android が例外を投げてアプリが落ちるため。読めない形は null(その候補は使わない)。
     */
    private fun literalIp(text: String): ByteArray? {
        if (text.contains('%')) return null
        return parseIpv4(text) ?: parseIpv6(text)
    }

    private fun parseIpv4(text: String): ByteArray? {
        val parts = text.split('.')
        if (parts.size != 4) return null
        val b = ByteArray(4)
        for (k in 0 until 4) {
            val p = parts[k]
            if (p.isEmpty() || p.length > 3 || !p.all { it in '0'..'9' }) return null
            val v = p.toInt()
            if (v > 255) return null
            b[k] = v.toByte()
        }
        return b
    }

    private fun parseIpv6(text: String): ByteArray? {
        if (text.length > 39 || !text.contains(':')) return null
        if (!text.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' || it == ':' }) return null
        val dbl = text.indexOf("::")
        if (dbl >= 0 && text.indexOf("::", dbl + 1) >= 0) return null // "::" は1回だけ(":::" も不可)
        val head: List<String>
        val tail: List<String>
        if (dbl >= 0) {
            val h = text.substring(0, dbl)
            val t = text.substring(dbl + 2)
            head = if (h.isEmpty()) emptyList() else h.split(':')
            tail = if (t.isEmpty()) emptyList() else t.split(':')
            if (head.size + tail.size > 7) return null // "::" は最低1グループ分を省略している
        } else {
            head = text.split(':')
            tail = emptyList()
            if (head.size != 8) return null
        }
        val groups = IntArray(8)
        for (i in head.indices) groups[i] = hex16(head[i]) ?: return null
        for (i in tail.indices) groups[8 - tail.size + i] = hex16(tail[i]) ?: return null
        val out = ByteArray(16)
        for (i in 0 until 8) {
            out[2 * i] = (groups[i] shr 8).toByte()
            out[2 * i + 1] = (groups[i] and 0xff).toByte()
        }
        return out
    }

    private fun hex16(g: String): Int? = if (g.isEmpty() || g.length > 4) null else g.toIntOrNull(16)

    /**
     * 短縮形式の値から、受け取った側のライブラリが出した雛形SDP(template)を元に、相手のSDPを組み立てる。
     * 差し替えるのは ICE の ufrag/pwd、DTLS の指紋と役割、接続候補だけ。他の行は雛形のまま(=自分のライブラリが理解する形)。
     * 雛形に必要な行がなければ null。
     */
    fun buildSdp(template: String, info: CompactInfo, setup: String): String? {
        val lines = template.replace("\r", "").split('\n').filter { it.isNotEmpty() }
        val out = ArrayList<String>(lines.size + info.candidates.size)
        var seen = 0
        for (ln in lines) {
            when {
                ln.startsWith("a=candidate:") || ln.startsWith("a=end-of-candidates") -> {}
                ln.startsWith("a=ice-ufrag:") -> { out.add("a=ice-ufrag:" + info.ufrag); seen = seen or 1 }
                ln.startsWith("a=ice-pwd:") -> { out.add("a=ice-pwd:" + info.pwd); seen = seen or 2 }
                ln.startsWith("a=fingerprint:") -> {
                    out.add("a=fingerprint:sha-256 " + info.fingerprint.joinToString(":") { hex2(it.toInt() and 0xff) })
                    seen = seen or 4
                }
                ln.startsWith("a=setup:") -> { out.add("a=setup:$setup"); seen = seen or 8 }
                ln.startsWith("m=") -> out.add(Regex("^(m=\\S+) \\d+ ").replaceFirst(ln, "$1 9 "))
                ln.startsWith("c=IN IP4 ") -> out.add("c=IN IP4 0.0.0.0")
                else -> out.add(ln)
            }
        }
        if (seen != 15) return null
        for ((i, c) in info.candidates.withIndex()) out.add(candidateLine(i, c))
        return out.joinToString("\r\n", postfix = "\r\n")
    }

    private fun candidateLine(index: Int, c: CompactCandidate): String {
        val typePref = intArrayOf(126, 100, 110, 0)[c.type]
        val priority = (typePref shl 24) or ((65535 - index) shl 8) or 255
        return "a=candidate:${index + 1} 1 udp $priority ${ipText(c.ip)} ${c.port} typ ${TYPES[c.type]} generation 0"
    }

    /** バイト列を数字表記にする(IPv6 は省略しない8グループ形式)。名前解決の機能は使わない。 */
    private fun ipText(ip: ByteArray): String {
        if (ip.size == 4) return ip.joinToString(".") { (it.toInt() and 0xff).toString() }
        val sb = StringBuilder(39)
        for (i in 0 until 8) {
            if (i > 0) sb.append(':')
            sb.append((((ip[2 * i].toInt() and 0xff) shl 8) or (ip[2 * i + 1].toInt() and 0xff)).toString(16))
        }
        return sb.toString()
    }

    /** SDP に含まれる接続候補を、ICE 候補として個別に再投入するための (sdpMid, 行) の一覧 */
    fun candidateLines(sdp: String): List<String> =
        sdp.replace("\r", "").split('\n').filter { it.startsWith("a=candidate:") }.map { it.removePrefix("a=") }

    fun midOf(sdp: String): String =
        sdp.replace("\r", "").split('\n').firstOrNull { it.startsWith("a=mid:") }?.substringAfter(':')?.trim() ?: "0"

    /** SDP 全体を圧縮した形式(v1)。短縮形式にできない時の予備。 */
    fun encodeFull(kind: InviteKind, sdp: String): String {
        val raw = slim(sdp).encodeToByteArray()
        val body = Zlib.deflateRaw(raw)
        return kind.prefix + withChecksum(body)
    }

    /** v1(全体を圧縮した形式)だけを読む。短縮形式は parse を使う。 */
    fun decode(text: String, kind: InviteKind): Decoded {
        return when (val r = parse(text, kind)) {
            is Parsed.Full -> Decoded(r.sdp, null)
            is Parsed.Compact -> Decoded(null, "短縮形式のコードです(雛形が必要)")
            is Parsed.Bad -> Decoded(null, r.message)
        }
    }

    /** 招待コード(短縮形式)に、自動返信用の鍵を足したコードを返す。短縮形式でなければ(=手動のみの形式)null。 */
    fun withRelayKey(inviteCode: String, key: ByteArray): String? {
        val p = parse(inviteCode, InviteKind.OFFER) as? Parsed.Compact ?: return null
        val i = p.info
        return encodeCompact(InviteKind.OFFER, CompactInfo(i.ufrag, i.pwd, i.fingerprint, i.candidates, key))
    }

    /** 貼り付けられた招待コードに入っている自動返信用の鍵。なければ null。 */
    fun relayKeyOf(text: String): ByteArray? =
        ((parse(text, InviteKind.OFFER) as? Parsed.Compact)?.info)?.relayKey

    /** 貼り付けられた文章からコードを探して読む。v1(全体)・v2(短縮)のどちらでも。 */
    fun parse(text: String, kind: InviteKind): Parsed {
        val i1 = text.indexOf(kind.prefix)
        val i2 = text.indexOf(kind.prefixCompact)
        val compact = i2 >= 0 && (i1 < 0 || i2 < i1)
        val at = if (compact) i2 else i1
        if (at < 0) {
            val other = InviteKind.values().firstOrNull { it != kind && (text.contains(it.prefix) || text.contains(it.prefixCompact)) }
            return Parsed.Bad(if (other != null) "これは${other.label}です。${kind.label}を貼り付けてください" else "${kind.label}が見つかりません")
        }
        val body = openChecked(text, at + (if (compact) kind.prefixCompact else kind.prefix).length) ?: return Parsed.Bad(badCode)
        if (body.second != null) return Parsed.Bad(body.second!!)
        val bytes = body.first!!
        return if (compact) readCompact(bytes) else readFull(bytes)
    }

    private const val badCode = "コードが途中で切れているか壊れています。全体をコピーし直してください"

    /** Base64 を読み、チェックサムを確かめて本体のバイト列を返す(first=本体 / second=エラー)。 */
    private fun openChecked(text: String, start: Int): Pair<ByteArray?, String?>? {
        var end = start
        while (end < text.length && isCodeChar(text[end])) end++
        val packed = try {
            B64.urlDecode(text.substring(start, end))
        } catch (e: IllegalArgumentException) {
            return null to badCode
        }
        if (packed.size < 6) return null to badCode
        val n = packed.size - 4
        val body = packed.copyOf(n)
        var expect = 0
        for (k in 0 until 4) expect = (expect shl 8) or (packed[n + k].toInt() and 0xff)
        if (Crc32.of(body) != expect) return null to badCode
        return body to null
    }

    private fun readCompact(b: ByteArray): Parsed {
        try {
            var i = 0
            val ul = b[i++].toInt() and 0xff
            val ufrag = b.decodeToString(i, i + ul); i += ul
            val pl = b[i++].toInt() and 0xff
            val pwd = b.decodeToString(i, i + pl); i += pl
            val fp = b.copyOfRange(i, i + 32); i += 32
            val n = b[i++].toInt() and 0xff
            if (ufrag.isEmpty() || pwd.isEmpty() || n == 0 || n > 16) return Parsed.Bad(badCode)
            val list = ArrayList<CompactCandidate>(n)
            for (k in 0 until n) {
                val f = b[i++].toInt() and 0xff
                val len = if (f and 1 == 1) 16 else 4
                val ip = b.copyOfRange(i, i + len); i += len
                val port = ((b[i].toInt() and 0xff) shl 8) or (b[i + 1].toInt() and 0xff); i += 2
                val type = (f shr 1) and 3
                if (port == 0) return Parsed.Bad(badCode)
                list.add(CompactCandidate(ip, port, type))
            }
            var key: ByteArray? = null
            if (i < b.size) {
                if (b[i].toInt() != EXT_RELAY_KEY || b.size - i - 1 != RelayCrypto.KEY_BYTES) return Parsed.Bad(badCode)
                key = b.copyOfRange(i + 1, b.size)
                i = b.size
            }
            if (i != b.size) return Parsed.Bad(badCode)
            return Parsed.Compact(CompactInfo(ufrag, pwd, fp, list, key))
        } catch (e: IndexOutOfBoundsException) {
            return Parsed.Bad(badCode)
        }
    }

    private fun readFull(body: ByteArray): Parsed {
        val raw = Zlib.inflateRaw(body, MAX_SDP_BYTES) ?: return Parsed.Bad("コードを読み取れません。全体をコピーし直してください")
        val sdp = raw.decodeToString()
        if (!sdp.startsWith("v=0")) return Parsed.Bad("コードの内容が正しくありません")
        return Parsed.Full(sdp.replace("\r", "").split('\n').filter { it.isNotEmpty() }.joinToString("\r\n", postfix = "\r\n"))
    }

    private fun isCodeChar(c: Char) = c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c == '-' || c == '_'

    /** 接続候補を絞り、改行を LF にそろえる(復号側で CRLF に戻す)。 */
    fun slim(sdp: String): String {
        val lines = sdp.replace("\r", "").split('\n').filter { it.isNotEmpty() }
        val others = ArrayList<String>(lines.size)
        val ranked = ArrayList<Pair<Int, String>>()
        val fallback = ArrayList<String>()
        for (ln in lines) {
            if (ln.startsWith("a=candidate:")) {
                fallback.add(ln)
                val r = rankCandidate(ln)
                if (r >= 0) ranked.add(r to ln)
            } else {
                others.add(ln)
            }
        }
        val kept: List<String> = if (ranked.isNotEmpty()) ranked.sortedBy { it.first }.take(MAX_CANDIDATES).map { it.second } else fallback.take(MAX_CANDIDATES)
        // 候補の行は、元の位置(終わりの a=end-of-candidates の直前)へまとめて戻す
        val endIdx = others.indexOfFirst { it.startsWith("a=end-of-candidates") }
        val result = ArrayList<String>(others)
        result.addAll(if (endIdx >= 0) endIdx else result.size, kept)
        return result.joinToString("\n")
    }

    /** 0=最優先 / 1=同じLANなら有効 / 2=低優先 / -1=捨てる。UDP・component 1 のみ使う。 */
    fun rankCandidate(line: String): Int {
        val t = line.trim().split(' ')
        if (t.size < 8 || t[6] != "typ") return -1
        if (!t[2].equals("udp", ignoreCase = true) || t[1] != "1") return -1
        val ip = t[4].lowercase()
        if (ip.startsWith("fe80") || ip.startsWith("169.254.")) return -1
        return when (t[7]) {
            "srflx", "prflx", "relay" -> 0
            "host" -> when {
                ip.contains(':') -> if (ip.startsWith("fc") || ip.startsWith("fd")) 2 else 0
                ip.startsWith("10.") || ip.startsWith("192.168.") || isPrivate172(ip) || ip.endsWith(".local") -> 1
                else -> 0
            }
            else -> 2
        }
    }

    private fun isPrivate172(ip: String): Boolean {
        if (!ip.startsWith("172.")) return false
        val second = ip.substring(4).substringBefore('.').toIntOrNull() ?: return false
        return second in 16..31
    }
}
