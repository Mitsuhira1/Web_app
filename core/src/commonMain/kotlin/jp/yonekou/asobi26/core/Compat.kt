package jp.yonekou.asobi26.core

/**
 * 通信対戦の「版の食い違い」を扱う(Android に依存しない)。
 *
 * - [PROTOCOL] は通信の手順の番号。新しいメッセージ(待った・チャットなど)を足したら上げる。
 *   0.5.9 までの版は番号を送ってこないので、1として扱う。
 * - [RULES] は、ゲームごとの「規則の番号」。**規則・CPU が使う手の符号・乱数の使い方を変えたら、そのゲームの番号を上げる**。
 *   番号が違う端末どうしは、同じ手の並びから違う局面になるので、そのゲームは一緒に遊べない。
 *   上げ忘れは `RuleGoldenTest` が見張る(固定の種で自動対戦した結果が変わると失敗する)。
 */
object Compat {
    const val PROTOCOL = 2

    /** 機能ごとに、使える最低の通信の手順の番号。部屋の全員がこの番号以上の時だけ使う */
    const val UNDO = 2
    const val CHAT = 2
    const val TIMEOUT_LOSE = 2

    /** ゲームごとの規則の番号(書かれていないゲームは 1) */
    val RULES: Map<String, Int> = mapOf(
        "life" to 1, "mahjong" to 1, "hanafuda" to 1, "speed" to 1, "holdem" to 1, "uno" to 1, "solitaire" to 1,
        "daifugo" to 1, "sevens" to 1, "poker" to 1, "memory" to 1, "blackjack" to 1, "ludo" to 1, "chinese" to 1,
        "yacht" to 1, "reversi" to 1, "gomoku" to 1, "connect4" to 1, "shogi" to 1, "gogo" to 1, "chess" to 1,
        "backgammon" to 1, "dots" to 1, "mancala" to 1, "hex" to 1, "morris" to 1, "hare" to 1, "checkers" to 1, "go" to 1,
        "hitblow" to 1,
    )

    /**
     * Web 版で遊べないゲームは、規則の番号を 0 と名乗る(Android 版のホストの部屋では選べなくなる)。
     * 画面を元のアプリと同じ Compose のコードにしたので、今は 30 個すべて遊べる(空)。
     */
    val WEB_UNSUPPORTED: Set<String> = emptySet()

    fun ruleOf(gameId: String): Int = if (gameId in WEB_UNSUPPORTED) 0 else RULES[gameId] ?: 1

    fun encodeRules(rules: Map<String, Int> = RULES.mapValues { (k, v) -> if (k in WEB_UNSUPPORTED) 0 else v }): String = rules.entries.sortedBy { it.key }.joinToString(",") { "${it.key}:${it.value}" }

    fun decodeRules(text: String): Map<String, Int> =
        if (text.isEmpty()) emptyMap() else text.split(',').mapNotNull {
            val k = it.substringBefore(':', ""); val v = it.substringAfter(':', "").toIntOrNull()
            if (k.isEmpty() || v == null) null else k to v
        }.toMap()

    /** スタンプの数(`ui/Stamps.kt` の絵の数と合わせる) */
    const val STAMP_COUNT = 16

    /** チャットの文字数の上限と、続けて送れる間隔[ミリ秒] */
    const val CHAT_MAX = 40
    const val CHAT_GAP_MS = 700L

    /** 通信に載せる文字から、区切り文字・制御文字を取り除き、上限で切る(Web 版: JVM にしかない codePointCount を使わない書き方) */
    fun cleanChat(text: String): String {
        val sb = StringBuilder()
        for (ch in text) {
            if (ch == '|' || ch == '\u0000' || ch.isISOControl()) { if (ch == '\n' || ch == '\t' || ch == '|') sb.append(' '); continue }
            sb.append(ch)
        }
        val t = sb.toString().trim().replace(Regex(" {2,}"), " ")
        var n = 0; var i = 0
        while (i < t.length && n < CHAT_MAX) { i += if (t[i].isHighSurrogate() && i + 1 < t.length && t[i + 1].isLowSurrogate()) 2 else 1; n++ }
        return if (i >= t.length) t else t.substring(0, i)
    }
}
