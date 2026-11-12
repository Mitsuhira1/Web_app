package jp.yonekou.asobi26.core

import kotlin.random.Random

/** CPU の強さ */
enum class Level(val label: String) { EASY("初級"), NORMAL("中級"), HARD("上級") }

/** 終局の結果。winner は勝った席(-1 = 引き分け)。 */
class Outcome(val winner: Int, val reason: String)

/** ゲームごとの細かい設定(盤の大きさなど)。文字列のキーと値で持ち、保存・通信しやすくする。 */
class GameOptions(val values: Map<String, String> = emptyMap()) {
    fun int(key: String, default: Int): Int = values[key]?.toIntOrNull() ?: default
    fun str(key: String, default: String): String = values[key] ?: default
    fun with(key: String, value: String): GameOptions = GameOptions(values + (key to value))
    fun encode(): String = values.entries.sortedBy { it.key }.joinToString(";") { "${it.key}=${it.value}" }

    companion object {
        fun decode(text: String): GameOptions =
            GameOptions(text.split(';').filter { '=' in it }.associate { it.substringBefore('=') to it.substringAfter('=') })
    }
}

/**
 * 1つのゲームの規則。状態 S は書き換えない(play は新しい状態を返す)。手は Int で表す。
 * 手番・合法手・終局の判定はすべてここで行い、画面や CPU はこの判定だけを使う。
 */
interface Rules<S> {
    /** この対局の人数 */
    val playerCount: Int

    /** 最初の状態。乱数を使うゲームは rng だけを使う(同じ種から同じ状態になる)。 */
    fun initial(rng: Random): S

    /** 手番の席。終局後は -1 */
    fun toMove(s: S): Int

    /** いま指せる手の一覧(終局後は空) */
    fun legalMoves(s: S): IntArray

    fun isLegal(s: S, m: Int): Boolean = toMove(s) >= 0 && legalMoves(s).contains(m)

    /** 手を指した後の状態。isLegal が true の手だけを渡すこと。 */
    fun play(s: S, m: Int): S

    /** 終局していれば結果、まだなら null */
    fun outcome(s: S): Outcome?

    /** 得点の表示(ないゲームは null) */
    fun scores(s: S): IntArray? = null
}

/** CPU の思考を打ち切るための期限と中止の合図 */
class Budget(millis: Long) {
    private val start = nowNanos()
    private val limit = millis * 1_000_000L
    var cancelled = false
    fun over(): Boolean = cancelled || nowNanos() - start > limit
}

/**
 * CPU の思考。seat は CPU の席。相手の非公開情報を読まないことは各ゲームの実装で守る
 * (ヒット＆ブローは相手の秘密の数字を読まず、自分の質問と答えだけから考える)。
 */
fun interface Brain<S> {
    fun choose(rules: Rules<S>, s: S, seat: Int, level: Level, rng: Random, budget: Budget): Int
}

/** ゲームの種類ごとの定義。規則・CPU・設定の候補をまとめる。 */
class GameDef<S>(
    val id: String,
    val makeRules: (GameOptions) -> Rules<S>,
    val brain: Brain<S>,
    /** 「待った」を使えるか(情報が増えるゲームでは使えない) */
    val undoAllowed: Boolean = true,
    /** 席の数を設定から決める(1人用の遊び方があるゲーム) */
    val seatsFor: (GameOptions) -> Int = { 2 },
    /** 「パス」の手。人の番でこれしか指せない時は、画面が自動で指す(リバーシの置ける所がない時) */
    val passMove: Int? = null,
)
