package jp.yonekou.asobi26.data

import jp.yonekou.asobi26.web.*

import jp.yonekou.asobi26.core.MatchRecord

/** 設定と「続きから」の保存(SharedPreferences)。 */
class Prefs(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("asobi", Context.MODE_PRIVATE)

    /** 0=端末に合わせる 1=ライト 2=ダーク */
    var themeMode: Int
        get() = sp.getInt(KEY_THEME, 0)
        set(v) { sp.edit().putInt(KEY_THEME, v).apply() }

    var showHints: Boolean
        get() = sp.getBoolean(KEY_HINTS, true)
        set(v) { sp.edit().putBoolean(KEY_HINTS, v).apply() }

    var tapSound: Boolean
        get() = sp.getBoolean(KEY_TAP, true)
        set(v) { sp.edit().putBoolean(KEY_TAP, v).apply() }

    /** CPU の手番の長さ(見やすさ): 0=短め 1=普通 2=長め。考える強さは変わらない */
    var cpuPace: Int
        get() = sp.getInt(KEY_PACE, 1)
        set(v) { sp.edit().putInt(KEY_PACE, v).apply() }

    /** CPU の強さの初期値(Level の番号) */
    var defaultLevel: Int
        get() = sp.getInt(KEY_LEVEL, 1)
        set(v) { sp.edit().putInt(KEY_LEVEL, v).apply() }

    var playerName: String
        get() = sp.getString(KEY_NAME, "あなた") ?: "あなた"
        set(v) { sp.edit().putString(KEY_NAME, v).apply() }

    /** ゲームごとの前回の設定(設定の画面を開いた時に、前の選択を出す)。GameOptions の文字列|強さ|手番 */
    fun lastSetup(gameId: String): String? = sp.getString(KEY_SETUP + gameId, null)
    fun saveSetup(gameId: String, text: String) { sp.edit().putString(KEY_SETUP + gameId, text).apply() }

    /** 途中の対局(ゲームごとに1つ)。新しい順の id 一覧と、記録の文字列 */
    fun savedMatches(): List<MatchRecord> {
        val ids = (sp.getString(KEY_RECENT, "") ?: "").split(',').filter { it.isNotEmpty() }
        return ids.mapNotNull { id -> sp.getString(KEY_REC + id, null)?.let { MatchRecord.decode(it) } }
    }

    fun saveMatch(rec: MatchRecord) {
        val ids = (sp.getString(KEY_RECENT, "") ?: "").split(',').filter { it.isNotEmpty() && it != rec.gameId }
        val list = (listOf(rec.gameId) + ids).take(MAX_SAVED)
        val e = sp.edit()
        for (old in ids.drop(MAX_SAVED - 1)) e.remove(KEY_REC + old)
        e.putString(KEY_RECENT, list.joinToString(",")).putString(KEY_REC + rec.gameId, rec.encode()).apply()
    }

    fun removeMatch(gameId: String) {
        val ids = (sp.getString(KEY_RECENT, "") ?: "").split(',').filter { it.isNotEmpty() && it != gameId }
        sp.edit().putString(KEY_RECENT, ids.joinToString(",")).remove(KEY_REC + gameId).apply()
    }

    // ---- 成績 ----
    /** ゲームごとの成績。vsCpu[強さ] = (勝ち, 負け, 引き分け)。ひとり用は clears(解けた回数)と best(最少の手数、0=なし) */
    class Stats(val vsCpu: List<IntArray>, val clears: Int, val plays: Int, val best: Int) {
        val wins: Int get() = vsCpu.sumOf { it[0] }
        val losses: Int get() = vsCpu.sumOf { it[1] }
        val draws: Int get() = vsCpu.sumOf { it[2] }
        val games: Int get() = wins + losses + draws + plays
    }

    fun stats(gameId: String): Stats {
        val vs = List(3) { lv ->
            val f = (sp.getString("$KEY_ST$gameId:$lv", "") ?: "").split(',').mapNotNull { it.toIntOrNull() }
            IntArray(3) { f.getOrElse(it) { 0 } }
        }
        val solo = (sp.getString("$KEY_SOLO$gameId", "") ?: "").split(',').mapNotNull { it.toIntOrNull() }
        return Stats(vs, solo.getOrElse(0) { 0 }, solo.getOrElse(1) { 0 }, solo.getOrElse(2) { 0 })
    }

    /** CPU 対戦の結果。result: 0=勝ち 1=負け 2=引き分け */
    fun recordVsCpu(gameId: String, level: Int, result: Int) {
        val st = stats(gameId).vsCpu[level.coerceIn(0, 2)]
        st[result.coerceIn(0, 2)]++
        sp.edit().putString("$KEY_ST$gameId:${level.coerceIn(0, 2)}", st.joinToString(",")).apply()
    }

    /** ひとり用の結果。cleared なら記録を更新する(higherIsBetter=true なら大きい方、false なら小さい方が良い記録) */
    fun recordSolo(gameId: String, cleared: Boolean, value: Int, higherIsBetter: Boolean = false) {
        val st = stats(gameId)
        val clears = st.clears + if (cleared) 1 else 0
        val better = if (higherIsBetter) value > st.best else (st.best == 0 || value < st.best)
        val best = if (cleared && better) value else st.best
        sp.edit().putString("$KEY_SOLO$gameId", "$clears,${st.plays + 1},$best").apply()
    }

    fun clearStats() {
        val e = sp.edit()
        for (k in sp.all.keys) if (k.startsWith(KEY_ST) || k.startsWith(KEY_SOLO)) e.remove(k)
        e.apply()
    }

    companion object {
        private const val KEY_ST = "st_"
        private const val KEY_SOLO = "solo_"
        private const val KEY_THEME = "theme"
        private const val KEY_HINTS = "hints"
        private const val KEY_TAP = "tap"
        private const val KEY_PACE = "cpuPace"
        private const val KEY_LEVEL = "level"
        private const val KEY_NAME = "name"
        private const val KEY_RECENT = "recent"
        private const val KEY_REC = "rec_"
        private const val KEY_SETUP = "setup_"
        private const val MAX_SAVED = 5

        /** 起動画面を含むアプリ全体の昼夜を決める(Activity が作られる前に呼ぶ) */
        fun applyTheme(mode: Int) {
            AppCompatDelegate.setDefaultNightMode(
                when (mode) {
                    1 -> AppCompatDelegate.MODE_NIGHT_NO
                    2 -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                }
            )
        }
    }
}
