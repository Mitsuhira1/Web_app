package jp.yonekou.asobi26.core.net

/**
 * 1行の JSON オブジェクトから、いちばん外側の「文字列・数値・真偽値・null」の値を文字列として取り出す小さな読み取り器。
 * 中継サーバー(ntfy)の返す1行1件の JSON を読むためだけに使う。入れ子(配列・オブジェクト)の中身は読み飛ばす。
 * 壊れた入力は null を返す(例外は投げない)。Android 標準の org.json に頼らないので、JVM のテストでもそのまま動く。
 */
object MiniJson {
    private const val MAX_DEPTH = 32

    fun flatObject(text: String): Map<String, String>? {
        val n = text.length
        var i = skipSpace(text, 0)
        if (i >= n || text[i] != '{') return null
        i++
        val out = HashMap<String, String>()
        i = skipSpace(text, i)
        if (i < n && text[i] == '}') return out
        while (true) {
            i = skipSpace(text, i)
            if (i >= n || text[i] != '"') return null
            val key = readString(text, i) ?: return null
            i = skipSpace(text, key.second)
            if (i >= n || text[i] != ':') return null
            i = skipSpace(text, i + 1)
            if (i >= n) return null
            when (text[i]) {
                '"' -> {
                    val v = readString(text, i) ?: return null
                    out[key.first] = v.first
                    i = v.second
                }
                '{', '[' -> i = skipNested(text, i) ?: return null
                else -> {
                    val start = i
                    while (i < n && text[i] != ',' && text[i] != '}' && text[i] != ']' && !text[i].isWhitespace()) i++
                    if (i == start) return null
                    out[key.first] = text.substring(start, i)
                }
            }
            i = skipSpace(text, i)
            if (i >= n) return null
            when (text[i]) {
                ',' -> i++
                '}' -> return out
                else -> return null
            }
        }
    }

    private fun skipSpace(t: String, from: Int): Int {
        var i = from
        while (i < t.length && t[i].isWhitespace()) i++
        return i
    }

    /** t[at] が '"' である文字列を読み、(中身, 終わりの次の位置) を返す。 */
    private fun readString(t: String, at: Int): Pair<String, Int>? {
        val sb = StringBuilder()
        var i = at + 1
        while (i < t.length) {
            val c = t[i]
            when {
                c == '"' -> return sb.toString() to (i + 1)
                c == '\\' -> {
                    if (i + 1 >= t.length) return null
                    when (val e = t[i + 1]) {
                        '"', '\\', '/' -> { sb.append(e); i += 2 }
                        'b' -> { sb.append('\b'); i += 2 }
                        'f' -> { sb.append('\u000C'); i += 2 }
                        'n' -> { sb.append('\n'); i += 2 }
                        'r' -> { sb.append('\r'); i += 2 }
                        't' -> { sb.append('\t'); i += 2 }
                        'u' -> {
                            if (i + 6 > t.length) return null
                            val code = t.substring(i + 2, i + 6).toIntOrNull(16) ?: return null
                            sb.append(code.toChar())
                            i += 6
                        }
                        else -> return null
                    }
                }
                c < ' ' -> return null // 文字列の中に生の制御文字は置けない
                else -> { sb.append(c); i++ }
            }
        }
        return null
    }

    /** t[at] が '{' か '[' の入れ子を、対応する閉じ括弧の次の位置まで読み飛ばす(括弧の種類が合わなければ null)。 */
    private fun skipNested(t: String, at: Int): Int? {
        val closers = CharArray(MAX_DEPTH)
        var depth = 0
        var i = at
        while (i < t.length) {
            when (val c = t[i]) {
                '"' -> {
                    val s = readString(t, i) ?: return null
                    i = s.second
                    continue
                }
                '{', '[' -> {
                    if (depth >= MAX_DEPTH) return null
                    closers[depth++] = if (c == '{') '}' else ']'
                }
                '}', ']' -> {
                    if (depth == 0 || closers[depth - 1] != c) return null
                    depth--
                    if (depth == 0) return i + 1
                }
            }
            i++
        }
        return null
    }
}
