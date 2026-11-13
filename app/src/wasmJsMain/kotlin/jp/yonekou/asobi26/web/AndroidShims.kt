package jp.yonekou.asobi26.web

/**
 * Android の Context・SharedPreferences・AppCompatDelegate と同じ名前の部品(ブラウザ用)。
 * 保存はブラウザの localStorage(サイトを開き直しても残る)。キーには "asobi." を付ける。
 */
@JsFun("(k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }")
private external fun lsGet(k: String): String?
@JsFun("(k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }")
private external fun lsSet(k: String, v: String)
@JsFun("(k) => { try { localStorage.removeItem(k); } catch (e) {} }")
private external fun lsRemove(k: String)
@JsFun("(p) => { try { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p)) out.push(k.slice(p.length)); } return out.join('\\n'); } catch (e) { return ''; } }")
private external fun lsKeys(prefix: String): String

class SharedPreferences internal constructor(private val prefix: String) {
    fun getString(key: String, def: String?): String? = lsGet(prefix + key) ?: def
    fun getInt(key: String, def: Int): Int = lsGet(prefix + key)?.toIntOrNull() ?: def
    fun getLong(key: String, def: Long): Long = lsGet(prefix + key)?.toLongOrNull() ?: def
    fun getFloat(key: String, def: Float): Float = lsGet(prefix + key)?.toFloatOrNull() ?: def
    fun getBoolean(key: String, def: Boolean): Boolean = lsGet(prefix + key)?.let { it == "true" } ?: def
    fun contains(key: String): Boolean = lsGet(prefix + key) != null
    val all: Map<String, Any?> get() = lsKeys(prefix).split('\n').filter { it.isNotEmpty() }.associateWith { lsGet(prefix + it) }
    fun edit(): Editor = Editor()
    inner class Editor {
        private val ops = ArrayList<() -> Unit>()
        fun putString(key: String, value: String?): Editor { ops.add { if (value == null) lsRemove(prefix + key) else lsSet(prefix + key, value) }; return this }
        fun putInt(key: String, value: Int): Editor { ops.add { lsSet(prefix + key, value.toString()) }; return this }
        fun putLong(key: String, value: Long): Editor { ops.add { lsSet(prefix + key, value.toString()) }; return this }
        fun putFloat(key: String, value: Float): Editor { ops.add { lsSet(prefix + key, value.toString()) }; return this }
        fun putBoolean(key: String, value: Boolean): Editor { ops.add { lsSet(prefix + key, value.toString()) }; return this }
        fun remove(key: String): Editor { ops.add { lsRemove(prefix + key) }; return this }
        fun clear(): Editor { ops.add { for (k in lsKeys(prefix).split('\n')) if (k.isNotEmpty()) lsRemove(prefix + k) }; return this }
        fun apply() { ops.forEach { it() }; ops.clear() }
        fun commit(): Boolean { apply(); return true }
    }
}

open class Context {
    open val applicationContext: Context get() = this
    fun getSharedPreferences(name: String, @Suppress("UNUSED_PARAMETER") mode: Int): SharedPreferences = SharedPreferences("asobi.$name.")
    companion object { const val MODE_PRIVATE = 0 }
}

/** アプリ全体の Context(ブラウザでは1つだけ) */
object WebContext : Context()

object AppCompatDelegate {
    const val MODE_NIGHT_NO = 1
    const val MODE_NIGHT_YES = 2
    const val MODE_NIGHT_FOLLOW_SYSTEM = -1
    /** 画面の昼夜は AppModel.themeMode で決めるので、ここでは何もしない */
    fun setDefaultNightMode(@Suppress("UNUSED_PARAMETER") mode: Int) {}
}
