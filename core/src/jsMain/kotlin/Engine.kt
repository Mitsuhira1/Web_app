@file:OptIn(ExperimentalJsExport::class)

import jp.yonekou.asobi26.core.*
import jp.yonekou.asobi26.core.games.*
import kotlin.random.Random

/**
 * ブラウザの画面(JavaScript)から呼ぶ入口。規則と CPU は元のアプリと同じコードを使う。
 * 画面との受け渡しは文字列(JSON)と整数だけにして、Web Worker の中でも外でも同じに動かす。
 */
internal val matches = HashMap<Int, Session<Any?>>()
internal var nextHandle = 1

private fun q(s: String): String {
    val sb = StringBuilder("\"")
    for (c in s) when (c) {
        '"' -> sb.append("\\\""); '\\' -> sb.append("\\\\"); '\n' -> sb.append("\\n")
        else -> sb.append(c)
    }
    return sb.append('"').toString()
}

private fun ints(a: IntArray) = a.joinToString(",", "[", "]")

@JsExport
fun catalogJson(): String = Catalog.all.joinToString(",", "[", "]") { g ->
    val opts = g.options.filter { it.group != "time" }.joinToString(",", "[", "]") { o ->
        "{\"key\":${q(o.key)},\"label\":${q(o.label)},\"group\":${q(o.group)},\"default\":${q(o.default)},\"values\":${o.values.joinToString(",", "[", "]") { "[${q(it.first)},${q(it.second)}]" }}}"
    }
    val seatNames = g.seatNames.joinToString(",", "[", "]") { q(it) }
    "{\"id\":${q(g.id)},\"no\":${g.no},\"name\":${q(g.name)},\"category\":${q(g.category.name)},\"players\":${q(g.players)},\"intro\":${q(g.intro)},\"playable\":${g.playable},\"options\":$opts,\"seatNames\":$seatNames}"
}

/** 対局を始める。seed は 10 進の文字列(64bit を JS の数にしないため)。humanSeats は人の席の番号(例 "0")。返り値は対局の番号 */
@JsExport
@Suppress("UNCHECKED_CAST")
fun newMatch(gameId: String, options: String, seed: String, humanSeats: String, cpuLevel: Int): Int {
    val info = Catalog.byId(gameId) ?: return -1
    val def = info.def as? GameDef<Any?> ?: return -1
    val opts = GameOptions.decode(options)
    val humans = humanSeats.split(',').filter { it.isNotEmpty() }.map { it.toInt() }.toSet()
    val n = def.seatsFor(opts)
    val seats = (0 until n).map { i ->
        if (i in humans) Seat(true, Level.NORMAL, "あなた") else Seat(false, Level.values()[cpuLevel.coerceIn(0, 2)], "CPU")
    }
    val h = nextHandle++
    matches[h] = Session(def, opts, seats, seed.toLong())
    return h
}

/** 手を指す。規則で確かめて、指せなければ false */
@JsExport
fun playMove(h: Int, move: Int): Boolean = matches[h]?.submit(move) ?: false

/** 戻す(自分の直前の手まで)。できなければ false */
@JsExport
fun undoMove(h: Int): Boolean = matches[h]?.undo() ?: false

/** CPU が考えて手を返す(指しはしない)。millis は考える時間の上限 */
@JsExport
fun cpuChoose(h: Int, millis: Int): Int {
    val ses = matches[h] ?: return -1
    val seat = ses.toMove
    if (seat < 0) return -1
    val level = ses.seats[seat].level
    val rng = Random(ses.seed * 131 + ses.moves.size)
    return try {
        ses.def.brain.choose(ses.rules, ses.state, seat, level, rng, Budget(millis.toLong()))
    } catch (e: OutOfTime) {
        ses.rules.legalMoves(ses.state).firstOrNull() ?: -1
    }
}

@JsExport
fun isHumanTurn(h: Int): Boolean = matches[h]?.isHumanTurn ?: false

@JsExport
fun matchRecord(h: Int): String = matches[h]?.record()?.encode() ?: ""

/** 画面に描くための情報(JSON)。盤の中身はゲームごとに違うので "board" に入れる */
@JsExport
fun viewJson(h: Int, me: Int): String {
    val ses = matches[h] ?: return "{}"
    val st = ses.state
    val o = ses.outcome
    val legal = if (ses.toMove >= 0) ses.rules.legalMoves(st) else IntArray(0)
    val board = when (st) {
        is ReversiState -> "{\"kind\":\"reversi\",\"cells\":${ints(st.cells)},\"turn\":${st.turn},\"last\":${st.lastMove},\"black\":${st.count(1)},\"white\":${st.count(2)}}"
        is ShogiState -> {
            val small = (ses.rules as Shogi).small
            "{\"kind\":\"shogi\",\"w\":${if (small) 5 else 9},\"cells\":${ints(st.board)},\"hands\":${ints(st.hands)},\"turn\":${st.turn},\"last\":${st.lastMove},\"check\":${st.inCheck},\"ply\":${st.ply}}"
        }
        is C4State -> "{\"kind\":\"c4\",\"cells\":${ints(st.cells)},\"turn\":${st.turn},\"last\":${st.lastMove},\"win\":${ints(st.winLine)}}"
        is GomokuState -> "{\"kind\":\"gomoku\",\"cells\":${ints(st.cells)},\"turn\":${st.turn},\"last\":${st.lastMove},\"win\":${ints(st.winLine)}}"
        is HexState -> "{\"kind\":\"hex\",\"n\":${st.n},\"cells\":${ints(st.cells)},\"turn\":${st.turn},\"last\":${st.lastMove},\"win\":${ints(st.winPath)}}"
        is MancalaState -> "{\"kind\":\"mancala\",\"pits\":${ints(st.pits)},\"turn\":${st.turn},\"last\":${st.lastMove},\"extra\":${st.extraTurn}}"
        is MorrisState -> "{\"kind\":\"morris\",\"board\":${ints(st.board)},\"inHand\":${ints(st.inHand)},\"turn\":${st.turn},\"removing\":${st.removing},\"last\":${st.lastMove}}"
        is CheckersState -> "{\"kind\":\"checkers\",\"cells\":${ints(st.cells)},\"turn\":${st.turn},\"paths\":${st.paths.joinToString(",", "[", "]") { ints(it) }},\"lastPath\":${ints(st.lastPath)}}"
        is ChessState -> "{\"kind\":\"chess\",\"board\":${ints(st.board)},\"turn\":${st.turn},\"last\":${st.lastMove},\"check\":${st.inCheck},\"ply\":${st.ply}}"
        is DotsState -> "{\"kind\":\"dots\",\"n\":${(ses.rules as DotsBoxes).n},\"edgeBy\":${ints(st.edgeBy)},\"owner\":${ints(st.owner)},\"turn\":${st.turn},\"score\":${ints(st.score)},\"last\":${st.lastEdge}}"
        is HitBlowState -> "{\"kind\":\"hitblow\",\"digits\":${st.digits},\"solo\":${st.solo},\"setting\":${st.settingSecret},\"secrets\":${ints(st.secrets)},\"turn\":${st.turn},\"guesses\":${st.guesses.joinToString(",", "[", "]") { l -> l.joinToString(",", "[", "]") { "[${it.code},${it.hit},${it.blow}]" } }}}"
        is HareState -> "{\"kind\":\"hare\",\"board\":${ints(st.board)},\"turn\":${st.turn},\"plies\":${st.plies},\"vertical\":${st.vertical},\"last\":${st.lastMove},\"x\":${ints(HareHounds.X)},\"adj\":${HareHounds.ADJ.joinToString(",", "[", "]") { ints(it) }}}"
        is CcState -> {
            val cc = ses.rules as ChineseCheckers
            "{\"kind\":\"chinese\",\"board\":${ints(st.board)},\"turn\":${st.turn},\"last\":${st.lastMove},\"camps\":${ints(cc.camps)},\"pts\":${ChineseCheckers.POINTS.joinToString(",", "[", "]") { ints(it) }},\"ply\":${st.ply}}"
        }
        is LudoState -> "{\"kind\":\"ludo\",\"n\":${st.n},\"slots\":${ints((ses.rules as Ludo).slots)},\"pos\":${st.pos.joinToString(",", "[", "]") { ints(it) }},\"die\":${st.die},\"turn\":${st.turn},\"last\":${st.lastMove},\"captured\":${st.captured}}"
        is BgState -> "{\"kind\":\"backgammon\",\"points\":${ints(st.points)},\"bar\":${ints(st.bar)},\"off\":${ints(st.off)},\"dice\":${ints(st.dice)},\"shown\":${ints(st.shown)},\"turn\":${st.turn},\"last\":${st.lastMove}}"
        is GoState -> "{\"kind\":\"go\",\"n\":${st.n},\"board\":${ints(st.board)},\"turn\":${st.turn},\"captures\":${ints(st.captures)},\"passes\":${st.passes},\"last\":${st.lastMove},\"owner\":${st.owner?.let { ints(it) } ?: "null"},\"dead\":${st.dead?.let { d -> d.joinToString(",", "[", "]") { if (it) "1" else "0" } } ?: "null"}}"
        is YachtState -> "{\"kind\":\"yacht\",\"players\":${st.players},\"dice\":${ints(st.dice)},\"rollsLeft\":${st.rollsLeft},\"turn\":${st.turn},\"sheets\":${st.sheets.joinToString(",", "[", "]") { ints(it) }},\"last\":${st.lastScored}}"
        else -> cardsView(st, ses.rules, me, legal, ses.isHumanTurn) ?: "null"
    }
    val outcome = if (o == null) "null" else "{\"winner\":${o.winner},\"reason\":${q(o.reason)}}"
    return "{\"toMove\":${ses.toMove},\"human\":${ses.isHumanTurn},\"mine\":${ses.seats.indexOfFirst { it.human }},\"remote\":${ses.toMove >= 0 && ses.seats[ses.toMove].remote},\"legal\":${ints(legal)},\"outcome\":$outcome,\"moves\":${ses.moves.size},\"canResign\":${ses.canResign},\"undoAllowed\":${ses.def.undoAllowed},\"scores\":${ses.rules.scores(st)?.let { ints(it) } ?: "null"},\"seats\":${ses.seats.joinToString(",", "[", "]") { "{\"name\":${q(it.name)},\"human\":${it.human},\"remote\":${it.remote},\"level\":${it.level.ordinal}}" }},\"board\":$board}"
}

@JsExport
fun crossCheckReport(seeds: Int, cpuMoves: Int): String = CrossCheck.report(seeds, cpuMoves)

/** 将棋の手の分解(画面用) */
@JsExport fun shogiFrom(m: Int): Int = (m shr 1) / 128
@JsExport fun shogiTo(m: Int): Int = (m shr 1) % 128
@JsExport fun shogiPromo(m: Int): Boolean = m and 1 == 1

// ---------------------------------------------------------------- 効果音(計算で作る音。元のアプリの Synth をそのまま使う)
@JsExport fun soundList(): String = jp.yonekou.asobi26.audio.Sound.entries.joinToString(",", "[", "]") { "{\"name\":\"${it.name}\",\"variants\":${it.variants},\"volume\":${it.volume}}" }
@JsExport fun soundRate(): Int = jp.yonekou.asobi26.audio.Synth.RATE
@JsExport fun synthPcm(name: String, variant: Int): ShortArray = jp.yonekou.asobi26.audio.Synth.make(jp.yonekou.asobi26.audio.Sound.valueOf(name), variant)

@JsExport fun netCheckReport(): String = jp.yonekou.asobi26.core.net.NetCheck.report()

/** 手の記録(文字列)から対局を作り直す。通信対戦のホストが、CPU の思考を別スレッドの Worker へ渡す時に使う */
@JsExport
@Suppress("UNCHECKED_CAST")
fun restoreMatch(record: String): Int {
    val rec = MatchRecord.decode(record) ?: return -1
    val def = Catalog.byId(rec.gameId)?.def as? GameDef<Any?> ?: return -1
    val ses = Session.restore(def, rec) ?: return -1
    val h = nextHandle++
    matches[h] = ses
    return h
}

@JsExport fun dropMatch(h: Int) { matches.remove(h) }

/** 試験用: 勝者(終わっていなければ -9)と得点 */
@JsExport
fun matchSummary(h: Int): String {
    val ses = matches[h] ?: return "{}"
    val o = ses.outcome
    val sc = ses.rules.scores(ses.state)
    return "{\"winner\":${o?.winner ?: -9},\"scores\":${if (sc == null) "null" else ints(sc)},\"moves\":${ses.moves.size}}"
}

/** 手番ごとに交代: 人の席と名前(カンマ区切り)を指定して始める */
@JsExport
@Suppress("UNCHECKED_CAST")
fun newMatchNamed(gameId: String, options: String, seed: String, humanSeats: String, cpuLevel: Int, names: String): Int {
    val info = Catalog.byId(gameId) ?: return -1
    val def = info.def as? GameDef<Any?> ?: return -1
    val opts = GameOptions.decode(options)
    val humans = humanSeats.split(',').filter { it.isNotEmpty() }.map { it.toInt() }
    val nm = names.split(',')
    val n = def.seatsFor(opts)
    val seats = (0 until n).map { i ->
        val k = humans.indexOf(i)
        if (k >= 0) Seat(true, Level.NORMAL, nm.getOrNull(k)?.ifBlank { null } ?: "プレイヤー${k + 1}") else Seat(false, Level.values()[cpuLevel.coerceIn(0, 2)], "CPU")
    }
    val h = nextHandle++
    matches[h] = Session(def, opts, seats, seed.toLong())
    return h
}

/** 時間切れ: lose なら(2人の時だけ)負けの手、そうでなければ元のアプリと同じ「ランダムな一手」(パス優先) */
@JsExport
fun timeoutPlay(h: Int, lose: Boolean): Boolean {
    val ses = matches[h] ?: return false
    val seat = ses.toMove
    if (seat < 0 || ses.outcome != null) return false
    val m = if (lose && ses.seats.size == 2) Session.timeoutMove(seat) else TimeoutPolicy.choose(ses)
    return ses.submit(m)
}

/** 降参(人の席) */
@JsExport
fun resignMatch(h: Int, seat: Int): Boolean {
    val ses = matches[h] ?: return false
    if (!ses.canResign || ses.outcome != null) return false
    return ses.submit(Session.resignMove(seat))
}

/** 設定から決まる席の数 */
@JsExport fun seatCount(gameId: String, options: String): Int = Catalog.byId(gameId)?.def?.seatsFor(GameOptions.decode(options)) ?: 2

/** ルールの説明(見出しと本文の組) */
@JsExport fun rulesJson(gameId: String): String =
    Catalog.byId(gameId)?.sections?.joinToString(",", "[", "]") { "[${q(it.title)},${q(it.body)}]" } ?: "[]"
