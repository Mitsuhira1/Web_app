package jp.yonekou.asobi26.core

import kotlin.random.Random

/** 席。human=false なら CPU(level の強さ)。 */
/**
 * 席。human = この端末の人。remote = 通信の相手(ほかの端末の人、または参加者から見たホストの CPU)。
 * remote の席の手は通信で届くので、この端末では CPU に考えさせない。
 */
class Seat(val human: Boolean, val level: Level = Level.NORMAL, val name: String, val remote: Boolean = false)

/**
 * 対局の記録。最初の状態は (gameId, options, seed) で決まり、あとは手の列を順に適用すれば再現できる。
 * 「続きから」の保存・「待った」・再戦は、すべてこの記録の作り直しで行う。
 */
class MatchRecord(
    val gameId: String,
    val options: GameOptions,
    val seats: List<Seat>,
    val seed: Long,
    val moves: List<Int>,
) {
    fun encode(): String {
        val seatText = seats.joinToString(",") { (if (it.human) "H" else "C") + it.level.ordinal + ":" + clean(it.name) }
        return listOf("v1", gameId, options.encode(), seatText, seed.toString(), moves.joinToString(",")).joinToString("|")
    }

    companion object {
        private fun clean(name: String) = name.filter { it != '|' && it != ',' && it != ':' && it != ';' && it != '=' && it != '\n' }

        fun decode(text: String): MatchRecord? = try {
            val f = text.split('|')
            if (f.size != 6 || f[0] != "v1") null else {
                val seats = f[3].split(',').map {
                    val head = it.substringBefore(':')
                    Seat(head[0] == 'H', Level.values()[head.substring(1).toInt()], it.substringAfter(':'))
                }
                val moves = if (f[5].isEmpty()) emptyList() else f[5].split(',').map { it.toInt() }
                MatchRecord(f[1], GameOptions.decode(f[2]), seats, f[4].toLong(), moves)
            }
        } catch (e: Exception) {
            null
        }
    }
}

/**
 * 1局の進行。手の正しさは必ず規則で確かめてから適用する(画面・CPU・将来の通信のどこから来た手も同じ)。
 * メインスレッドだけで使う前提。CPU の思考は state のコピーを別スレッドで読むだけ。
 */
class Session<S>(
    val def: GameDef<S>,
    val options: GameOptions,
    val seats: List<Seat>,
    seed: Long,
) {
    val rules: Rules<S> = def.makeRules(options)
    var seed: Long = seed
        private set
    private val moveList = ArrayList<Int>()
    val moves: List<Int> get() = moveList

    var state: S = rules.initial(Random(seed))
        private set

    /** 変化のたびに増える(画面の更新や、古い CPU の結果を捨てるのに使う) */
    var version: Int = 0
        private set

    private var resignedSeat: Int? = null
    /** 降参ではなく時間切れで負けた時 true */
    private var timedOut = false
    val canResign: Boolean get() = seats.size == 2 && def.id in RESIGN_GAMES
    val toMove: Int get() = if (resignedSeat != null) -1 else rules.toMove(state)
    val outcome: Outcome? get() = resignedSeat?.let { Outcome(1 - it, if (timedOut) "${seats[it].name}の時間切れ" else "${seats[it].name}が降参しました") } ?: rules.outcome(state)
    val isHumanTurn: Boolean get() {
        if(outcome != null)return false
        @Suppress("UNCHECKED_CAST") val concurrent=rules as? ConcurrentRules<S>
        return if(concurrent != null)seats.indices.any{seats[it].human && concurrent.legalMovesFor(state,it).isNotEmpty()} else toMove >= 0 && seats[toMove].human
    }
    val isCpuTurn: Boolean get() = toMove >= 0 && !seats[toMove].human && !seats[toMove].remote
    val isRemoteTurn: Boolean get() = toMove >= 0 && seats[toMove].remote

    /** 手を適用する。正しくない手(手番違い・合法でない)なら何もせず false。 */
    fun submit(m: Int): Boolean {
        if (outcome != null) return false
        val resigned = resignSeat(m)
        if (resigned != null) {
            if (!canResign || resigned !in seats.indices) return false
            resignedSeat = resigned; timedOut = false; moveList.add(m); version++; return true
        }
        val late = timeoutSeat(m)
        if (late != null) {
            // 時間切れの負け: 2人のゲームで、その人の番の時だけ
            if (seats.size != 2 || late != rules.toMove(state)) return false
            resignedSeat = late; timedOut = true; moveList.add(m); version++; return true
        }
        if (!rules.isLegal(state, m)) return false
        state = rules.play(state, m)
        moveList.add(m)
        version++
        return true
    }

    /** 「待った」ができるか(人が指した手が1つ以上ある)。終局後でもよい */
    fun canUndo(): Boolean {
        if (def.undoAllowed && resignedSeat != null) return true
        if (!def.undoAllowed || moveList.isEmpty()) return false
        var s = rules.initial(Random(seed))
        for (m in moveList) {
            val who = rules.toMove(s)
            if (who >= 0 && seats[who].human) return true
            s = rules.play(s, m)
        }
        return false
    }

    /** 「待った」: 直前の人の手番まで戻す。終局後でも戻せる。戻せた時 true。 */
    fun undo(): Boolean {
        if (def.undoAllowed && resignedSeat != null) { moveList.removeAt(moveList.lastIndex); resignedSeat = null; timedOut = false; version++; return true }
        if (!def.undoAllowed || moveList.isEmpty()) return false
        // 手を1つずつ外し、「人が指した手」を1つ外した直後で、人の手番になっている所で止める
        val list = ArrayList(moveList)
        var removedHuman = false
        while (list.isNotEmpty()) {
            val replayed = replay(list.subList(0, list.size - 1)) ?: return false
            val seatOfLast = rules.toMove(replayed)
            list.removeAt(list.size - 1)
            if (seatOfLast >= 0 && seats[seatOfLast].human) removedHuman = true
            if (removedHuman && rules.toMove(replayed) >= 0 && seats[rules.toMove(replayed)].human) break
        }
        if (!removedHuman) return false
        state = replay(list) ?: return false
        resignedSeat = null
        timedOut = false
        moveList.clear()
        moveList.addAll(list)
        version++
        return true
    }

    /**
     * 通信の「待った」: seat の人が最後に指した手の直前は、何手目か(その手数まで戻す)。
     * 戻せない(その人がまだ指していない・待ったのないゲーム・終局後)時は null。
     */
    fun undoTargetFor(seat: Int): Int? {
        if (!def.undoAllowed || resignedSeat != null || seat !in seats.indices) return null
        var s = rules.initial(Random(seed))
        var target: Int? = null
        for ((i, m) in moveList.withIndex()) {
            if (rules.toMove(s) == seat) target = i
            s = rules.play(s, m)
        }
        return target
    }

    /** 手の並びを先頭から len 手までに戻す(通信の「待った」)。戻せた時 true */
    fun rewindTo(len: Int): Boolean {
        if (len !in 0 until moveList.size) return false
        val list = ArrayList(moveList.subList(0, len))
        state = replay(list) ?: return false
        resignedSeat = null
        timedOut = false
        moveList.clear()
        moveList.addAll(list)
        version++
        return true
    }

    /** 最初からやり直す(同じ設定・新しい乱数) */
    fun restart(newSeed: Long) {
        seed = newSeed
        moveList.clear()
        resignedSeat = null
        timedOut = false
        state = rules.initial(Random(seed))
        version++
    }

    fun record(): MatchRecord = MatchRecord(def.id, options, seats, seed, ArrayList(moveList))

    private fun replay(list: List<Int>): S? {
        var s = rules.initial(Random(seed))
        for (m in list) {
            if (!rules.isLegal(s, m)) return null
            s = rules.play(s, m)
        }
        return s
    }

    companion object {
        val RESIGN_GAMES = setOf("reversi", "connect4", "gomoku", "hex", "morris", "hare", "checkers", "chess", "shogi", "gogo", "go", "mancala", "dots", "backgammon")
        fun resignMove(seat: Int): Int = -1_000_000 - seat
        fun resignSeat(move: Int): Int? = if (move in -1_000_001..-1_000_000) -1_000_000 - move else null
        /** 時間切れの負け(2人のゲーム) */
        fun timeoutMove(seat: Int): Int = -1_000_010 - seat
        fun timeoutSeat(move: Int): Int? = if (move in -1_000_011..-1_000_010) -1_000_010 - move else null

        /** 記録から対局を作り直す。記録が壊れている(途中に合法でない手がある)時は null。 */
        fun <S> restore(def: GameDef<S>, rec: MatchRecord): Session<S>? {
            if (rec.gameId != def.id) return null
            val ses = Session(def, rec.options, rec.seats, rec.seed)
            if (rec.seats.size != ses.rules.playerCount) return null
            for (m in rec.moves) if (!ses.submit(m)) return null
            return ses
        }
    }
}
