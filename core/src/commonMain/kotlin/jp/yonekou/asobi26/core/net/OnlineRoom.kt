package jp.yonekou.asobi26.core.net

import jp.yonekou.asobi26.core.JavaRandom
import jp.yonekou.asobi26.core.currentTimeMillis
import jp.yonekou.asobi26.core.Compat
import jp.yonekou.asobi26.core.GameOptions

/**
 * 通信対戦の部屋(ホスト中心の星型。最大6人)。MineLink の Room の入退室の部分を、このアプリ用に作り直したもの。
 * ゲームの中身は送らない。送るのは「開始(ゲーム・設定・種・席)」と「手」だけで、各端末が同じ規則で同じ局面を作る
 * (このアプリの規則は、同じ種と同じ手の並びから必ず同じ局面になる)。
 *
 * メッセージ(| 区切りの文字列):
 *  HELLO|名前|手順番号|規則の番号  参加者→ホスト  入室を願う(0.5.9 までは名前だけ)。規則の番号は「ゲーム:番号,…」
 *  WELCOME|番号|手順番号  ホスト→参加者  入室できた(番号 = 自分の slot。ホストは 0。手順番号は 0.5.10〜)
 *  DENY|full / playing   ホスト→参加者  入室できない
 *  ROSTER|ゲーム|設定|slot:名前,slot:名前  ホスト→全員  名簿と、選んでいるゲーム
 *  BEGIN|回|ゲーム|設定|種|席            ホスト→全員  対局を始める(席 = 席ごとの slot。-1 は CPU。「,」区切り)
 *  REQ|回|手の番号|手    参加者→ホスト  自分の手を指したい
 *  MOVE|回|手の番号|手   ホスト→全員    手を確定した(ホストの手・CPU の手・参加者の手)
 *  SYNC|回|手,手,...     ホスト→参加者  手の並びを全部送り直す(ずれた時)
 *  NEED|回              参加者→ホスト  手が飛んだので送り直してほしい
 *  AGAIN|回             参加者→ホスト  再戦の準備完了(開始はホストの確認後)
 *  READY|回|slot,...     ホスト→全員    再戦の準備済み名簿
 *  LOBBY_REQUEST|回      参加者→ホスト  全員でゲーム選択に戻る
 *  LOBBY|回              ホスト→全員    部屋を維持してゲーム選択へ戻る
 *  SELECT_REQ / SELECT  ヨットの選択状態(表示用、手の記録には含めない)
 *  CLOCK                ホストが決めた残り秒数(表示用)
 *  RESIGN_REQ           参加者の降参要求。ホストが通常のMOVEとして確定する
 *  UNDO_REQ|回           参加者→ホスト  「待った」を願う
 *  UNDO_ASK|回|番号|slot|手数  ホスト→全員  slot の人が「待った」を押した(手数 = 了承されたら戻る先の手数)。返事を集める
 *  UNDO_VOTE|回|番号|1/0  参加者→ホスト  了承する / しない
 *  UNDO_DONE|回|番号|1|slot|手,手,...  ホスト→全員  全員が了承した。手の並びをこれに置きかえる(全部送るので、ずれない)
 *  UNDO_DONE|回|番号|0|slot|断った slot  ホスト→全員  了承されなかった(-2 = 時間内に返事がなかった)。そのまま続ける
 *  COMPAT|slot:番号,...  ホスト→全員  各人の通信の手順の番号(0.5.10〜。古い版は載らない=1)。機能が使えるかの判定に使う
 *  CHAT_REQ|回|種類|本文  参加者→ホスト  チャットを送りたい(種類 0=文字 1=スタンプの番号)
 *  CHAT|回|通し番号|slot|種類|本文  ホスト→全員  チャットを確定した(間隔・長さ・スタンプの番号を確かめてから配る)
 *  BYE                  ホスト→全員    部屋を閉じた
 * 「回」は何回目の対局か。前の対局の遅れたメッセージを捨てるのに使う。
 * 通知はメインスレッドで来る前提(通信層の約束)。この型は Android に依存しない(JVM で試験する)。
 */
class OnlineRoom private constructor(
    private val net: Transport,
    val isHost: Boolean,
    myName: String,
    /** 参加者: つないでいるホストの id */
    private val hostLink: String?,
    /** ホスト: 近くの人と(広告を出す)か */
    private val advertise: Boolean,
) : TransportListener {

    /** proto = 通信の手順の番号(古い版は 1)。rules = その端末のゲームごとの規則の番号(空 = 分からない=同じとみなす) */
    class Member(val slot: Int, val name: String, val link: String?) {
        var proto: Int = 1
        var rules: Map<String, Int> = emptyMap()
    }

    enum class Phase { JOINING, LOBBY, PLAYING, CLOSED }

    /** 開始の情報。seatSlots[席] = その席の slot(-1 = CPU。CPU はホストが指す) */
    class Begin(val round: Int, val gameId: String, val options: GameOptions, val seed: Long, val seatSlots: List<Int>, val names: List<String>)

    val myName = clean(myName).ifBlank { "プレイヤー" }
    var phase: Phase = if (isHost) Phase.LOBBY else Phase.JOINING
        private set
    var mySlot: Int = if (isHost) 0 else -1
        private set
    val members = ArrayList<Member>()
    var gameId: String = "daifugo"
        private set
    var options: GameOptions = GameOptions()
        private set
    /** 部屋が閉じた理由(画面に出す) */
    var closedReason: String? = null
        private set
    var begin: Begin? = null
        private set
    /** 近くの人との通信を始められなかった時のエラー(権限不足など。画面に出す) */
    var transportError: String? = null
        private set

    /** 名簿・状態が変わった(画面の更新) */
    var onChanged: (() -> Unit)? = null
    /** 対局が始まった(新しい対局を作る) */
    var onBegin: ((Begin) -> Unit)? = null
    /** 確定した手が届いた(参加者)、または参加者の手を受け付けた(ホスト)。index = 何手目か */
    var onSeatClock: ((index: Int, seat: Int, seconds: Int) -> Unit)? = null
    var onConcurrent: ((slot: Int, move: Int) -> Boolean)? = null
    var onMove: ((index: Int, move: Int) -> Unit)? = null
    /** 手の並びを全部送り直された(参加者) */
    var onSync: ((moves: List<Int>) -> Unit)? = null
    /** ホスト: 参加者の手を受け付けてよいか(手番がその人の席か・手の番号が合っているか・合法か)。slot は送ってきた人 */
    var canAccept: ((slot: Int, index: Int, move: Int) -> Boolean)? = null
    /** ホスト: いまの手の並び(ずれた参加者に送り直す) */
    var currentMoves: (() -> List<Int>)? = null
    /** 参加者が抜けた(ホスト。その人の席は CPU にする) */
    var onLeft: ((slot: Int) -> Unit)? = null

    var onResign: ((Int) -> Unit)? = null
    fun requestResign() {
        if (!isHost && phase == Phase.PLAYING) hostLink?.let { net.sendTo(it, "RESIGN_REQ|$round") }
    }
    var onSelection: ((Int, Int) -> Unit)? = null
    var canSelect: ((Int, Int, Int) -> Boolean)? = null
    var onClock: ((Int, Int) -> Unit)? = null
    fun selectDice(index: Int, mask: Int) {
        if (phase != Phase.PLAYING || gameId != "yacht" || mask !in 0..31) return
        if (isHost) {
            if (canSelect?.invoke(mySlot, index, mask) != true) return
            onSelection?.invoke(index, mask); sendAll("SELECT|$round|$index|$mask")
        } else hostLink?.let { net.sendTo(it, "SELECT_REQ|$round|$index|$mask") }
    }
    fun shareClock(index: Int, seconds: Int) {
        if (isHost && phase == Phase.PLAYING) sendAll("CLOCK|$round|$index|$seconds")
    }
    // ---------------- 版の食い違い ----------------

    /** 参加者: つないでいるホストの通信の手順番号(0.5.9 までのホストは 1) */
    var hostProto: Int = 1
        private set
    private var previousProto: Map<Int, Int> = emptyMap()

    /** 部屋の全員が、この機能(Compat.UNDO など)に対応しているか。1人でも古い版なら false */
    fun supports(feature: Int): Boolean = members.all { it.proto >= feature }

    /** 古い版の人(通信の手順が古く、待った・チャットなどが使えない)の名前 */
    fun legacyNames(): List<String> = members.filter { it.proto < Compat.PROTOCOL }.map { it.name }

    /**
     * ホスト: このゲームを一緒に遊べない人の名前(規則の番号が違う人)。空なら遊べる。
     * 0.5.9 までの版は規則の番号を送ってこないので、同じとみなす(規則を変えたゲームは、先に番号を上げて見分けられるようにしてある)。
     */
    fun rulesMismatch(gameId: String): List<String> {
        val mine = Compat.ruleOf(gameId)
        return members.filter { it.slot != 0 && it.rules[gameId]?.let { r -> r != mine } == true }.map { it.name }
    }

    private fun sendCompat() {
        if (isHost) sendAll("COMPAT|" + members.joinToString(",") { "${it.slot}:${it.proto}" })
    }

    // ---------------- チャット・スタンプ ----------------

    /** 確定したチャット。seq = ホストが付けた通し番号、kind 0 = 文字、1 = スタンプ(body = 番号) */
    class Chat(val seq: Int, val slot: Int, val name: String, val kind: Int, val body: String)

    /** チャットが届いた(全員の端末。自分が送ったものも、ホストが確定してから届く) */
    var onChat: ((Chat) -> Unit)? = null
    private var chatSeq = 0
    private val lastChatAt = HashMap<Int, Long>()
    /** 時計(試験で差し替える) */
    var clock: () -> Long = { currentTimeMillis() }

    /** チャットを送る(kind 0 = 文字、1 = スタンプの番号)。送れた(ホストへ送った)時 true */
    fun sendChat(kind: Int, body: String): Boolean {
        if (phase != Phase.PLAYING && phase != Phase.LOBBY) return false
        if (!supports(Compat.CHAT)) return false
        return if (isHost) hostChat(mySlot, kind, body) else hostLink?.let { net.sendTo(it, "CHAT_REQ|$round|$kind|${if (kind == 0) Compat.cleanChat(body) else body}"); true } ?: false
    }

    private fun hostChat(slot: Int, kind: Int, rawBody: String): Boolean {
        if (!isHost || members.none { it.slot == slot }) return false
        val body = when (kind) {
            0 -> Compat.cleanChat(rawBody).takeIf { it.isNotEmpty() } ?: return false
            1 -> rawBody.toIntOrNull()?.takeIf { it in 0 until Compat.STAMP_COUNT }?.toString() ?: return false
            else -> return false
        }
        val now = clock()
        val last = lastChatAt[slot]
        if (last != null && now - last < Compat.CHAT_GAP_MS) return false
        lastChatAt[slot] = now
        val c = Chat(++chatSeq, slot, nameOf(slot), kind, body)
        sendAll("CHAT|$round|${c.seq}|$slot|$kind|$body")
        onChat?.invoke(c)
        return true
    }

    // ---------------- 「待った」(全員の了承が要る) ----------------

    /** 返事を集めている「待った」。slot = 押した人、target = 了承されたら戻る先の手数 */
    class UndoVote(val id: Int, val slot: Int, val target: Int, val name: String)

    var undoVote: UndoVote? = null
        private set
    private var undoSeq = 0
    private val undoYes = HashSet<Int>()
    /** ホスト: slot の人がいま「待った」できるなら、戻る先の手数(できないなら null) */
    var undoTarget: ((slot: Int) -> Int?)? = null
    /** ホスト: 全員が了承したので戻す。戻した後の手の並びを返す(戻せなかったら null) */
    var onUndoApply: ((UndoVote) -> List<Int>?)? = null
    /** 「待った」が押された(全員の端末で呼ぶ) */
    var onUndoAsk: ((UndoVote) -> Unit)? = null
    /** 「待った」が決まった。ok なら moves が新しい手の並び。by = 断った人の slot(-2 = 時間切れ、-1 = なし) */
    var onUndoDone: ((vote: UndoVote, ok: Boolean, moves: List<Int>, by: Int) -> Unit)? = null

    fun nameOf(slot: Int): String = members.firstOrNull { it.slot == slot }?.name ?: "参加者"

    /** 「待った」を押す */
    fun requestUndo() {
        if (phase != Phase.PLAYING || undoVote != null) return
        if (isHost) hostStartUndo(mySlot) else hostLink?.let { net.sendTo(it, "UNDO_REQ|$round") }
    }

    /** 「待った」に返事をする */
    fun voteUndo(yes: Boolean) {
        val v = undoVote ?: return
        if (phase != Phase.PLAYING) return
        if (isHost) hostVote(mySlot, v.id, yes) else hostLink?.let { net.sendTo(it, "UNDO_VOTE|$round|${v.id}|${if (yes) 1 else 0}") }
    }

    /** ホスト: 返事が時間内にそろわなかった */
    fun expireUndo(id: Int) {
        if (isHost && undoVote?.id == id) finishUndo(false, -2)
    }

    private fun hostStartUndo(slot: Int) {
        if (!isHost || phase != Phase.PLAYING || undoVote != null) return
        val target = undoTarget?.invoke(slot)
        if (target == null) {
            // いまは戻せない(手の受け渡しの途中など): 押した人にだけ知らせる
            members.firstOrNull { it.slot == slot }?.link?.let { net.sendTo(it, "UNDO_DONE|$round|0|0|$slot|-3") }
            return
        }
        val v = UndoVote(++undoSeq, slot, target, nameOf(slot))
        undoVote = v
        undoYes.clear(); undoYes.add(slot)
        sendAll("UNDO_ASK|$round|${v.id}|$slot|$target")
        onUndoAsk?.invoke(v)
        changed()
        checkUndo()
    }

    private fun hostVote(slot: Int, id: Int, yes: Boolean) {
        val v = undoVote ?: return
        if (v.id != id || begin?.seatSlots?.contains(slot) != true) return
        if (!yes) { finishUndo(false, slot); return }
        undoYes.add(slot)
        checkUndo()
    }

    /** ホスト: 対局に出ている人が全員了承したら戻す(CPU の席は数えない) */
    private fun checkUndo() {
        if (undoVote == null) return
        val voters = (begin?.seatSlots ?: emptyList()).filter { s -> s >= 0 && members.any { it.slot == s } }
        if (voters.all { it in undoYes }) finishUndo(true, -1)
    }

    private fun finishUndo(ok: Boolean, by: Int) {
        val v = undoVote ?: return
        undoVote = null
        val moves = if (ok) onUndoApply?.invoke(v) else null
        if (moves != null) sendAll("UNDO_DONE|$round|${v.id}|1|${v.slot}|" + moves.joinToString(","))
        else sendAll("UNDO_DONE|$round|${v.id}|0|${v.slot}|$by")
        onUndoDone?.invoke(v, moves != null, moves ?: emptyList(), by)
        changed()
    }

    val readySlots = linkedSetOf<Int>()
    var onLobby: (() -> Unit)? = null
    var canAgain: (() -> Boolean)? = null
    private var round = 0
    private val helloSent = HashSet<String>()

    init {
        net.listener = this
        if (isHost) {
            members.add(Member(0, this.myName, null).also { it.proto = Compat.PROTOCOL; it.rules = Compat.RULES })
            if (advertise) net.startHosting(adInfo())
        } else if (hostLink != null) {
            net.connect(hostLink)
        }
    }

    private fun changed() { onChanged?.invoke() }

    // ---------------- ホストの操作 ----------------

    /** 選ぶゲームと設定を変える(ロビーで) */
    fun choose(gameId: String, options: GameOptions) {
        if (!isHost) return
        this.gameId = gameId
        this.options = options
        broadcastRoster()
        changed()
    }

    /** 対局を始める。seats = 席の数。人は名簿の順に席へ入れ、残りは CPU。席の順は種で混ぜる */
    fun start(seats: Int, seed: Long, participants: Set<Int> = members.map { it.slot }.toSet()) {
        if (!isHost || phase == Phase.CLOSED) return
        round++
        undoVote = null
        val humans = members.filter { it.slot in participants }.take(seats).map { it.slot }.toMutableList()
        readySlots.clear()
        val order = (humans + List(seats - humans.size) { -1 }).toMutableList()
        val r = JavaRandom(seed)
        for (i in order.size - 1 downTo 1) { val j = r.nextInt(i + 1); val t = order[i]; order[i] = order[j]; order[j] = t }
        val names = order.map { s -> if (s < 0) "CPU" else members.first { it.slot == s }.name }
        val b = Begin(round, gameId, options, seed, order, names)
        begin = b
        phase = Phase.PLAYING
        if (advertise) net.stopHosting()
        sendAll(listOf(W.BEGIN, round, gameId, encodeOptions(options), seed, order.joinToString(",")).joinToString("|"))
        onBegin?.invoke(b)
        changed()
    }

    /** ホスト: 手を確定して全員へ配る(ホストの手・CPU の手・受け付けた参加者の手) */
    fun share(index: Int, move: Int) {
        if (!isHost) return
        sendAll("${W.MOVE}|$round|$index|$move")
    }

    /** 参加者: 自分の手をホストへ送る(ホストが確かめてから MOVE で全員へ返ってくる) */
    fun request(index: Int, move: Int) {
        if (isHost || hostLink == null) return
        net.sendTo(hostLink, "${W.REQ}|$round|$index|$move")
    }

    fun shareSeatClock(index:Int,seat:Int,seconds:Int) {
        if(isHost && phase==Phase.PLAYING)sendAll("CLOCK_PLAYER|$round|$index|$seat|$seconds")
    }

    fun requestConcurrent(move: Int) {
        if (!isHost && phase == Phase.PLAYING) hostLink?.let { net.sendTo(it,"ACTION_REQ|$round|$move") }
    }

    /** 再戦に参加する意思を記録する。開始するのはホストの確認後だけ。 */
    fun again() {
        if (phase != Phase.PLAYING || canAgain?.invoke() == false) return
        if (isHost) { readySlots.add(mySlot); sendReady(); changed() }
        else hostLink?.let { net.sendTo(it, "${W.AGAIN}|$round") }
    }

    private fun sendReady() { sendAll("READY|$round|" + readySlots.joinToString(",")) }

    /** 接続を残して全員をゲーム選択へ戻す。参加者からはホストへ依頼する。 */
    fun backToLobby() {
        if (phase != Phase.PLAYING) return
        if (!isHost) { hostLink?.let { net.sendTo(it, "LOBBY_REQUEST|$round") }; return }
        phase = Phase.LOBBY
        begin = null
        undoVote = null
        readySlots.clear()
        sendAll("LOBBY|$round")
        if (advertise && members.size < MAX) net.startHosting(adInfo())
        onLobby?.invoke()
        broadcastRoster()
        changed()
    }

    /** 部屋を出る(ホストなら部屋を閉じる) */
    fun leave() {
        if (phase == Phase.CLOSED) return
        if (isHost) {
            sendAll(W.BYE)
            if (advertise) net.stopHosting()
            for (m in members) m.link?.let { net.disconnect(it) }
        } else hostLink?.let { net.disconnect(it) }
        phase = Phase.CLOSED
        if (net.listener === this) net.listener = null
    }

    // ---------------- 通信の通知 ----------------

    override fun onLinked(id: String) {
        // 参加者: ホストにつながったら、1回だけ HELLO を送る(通知が2回来ても重ねない)
        if (!isHost && id == hostLink && helloSent.add(id)) net.sendTo(id, "${W.HELLO}|$myName|${Compat.PROTOCOL}|${Compat.encodeRules()}")
    }

    override fun onTransportError(message: String) {
        transportError = message
        changed()
    }

    override fun onLinkFailed(id: String) {
        if (!isHost && id == hostLink) close("ホストにつながりませんでした")
    }

    override fun onUnlinked(id: String) {
        if (!isHost) {
            if (id == hostLink) close("ホストとの接続が切れました")
            return
        }
        val m = members.firstOrNull { it.link == id } ?: return
        members.remove(m)
        readySlots.remove(m.slot)
        if (phase == Phase.PLAYING) {
            onLeft?.invoke(m.slot)
            // 返事を集めている途中で抜けた: 押した本人なら取り消し、ほかの人なら残りの人で決める
            if (undoVote?.slot == m.slot) finishUndo(false, m.slot) else checkUndo()
        } else if (advertise) net.startHosting(adInfo())
        broadcastRoster()
        changed()
    }

    override fun onText(id: String, text: String) {
        try {
            val f = text.split('|')
            if (isHost) hostReceive(id, f) else guestReceive(id, f)
        } catch (e: Exception) {
            // 壊れたメッセージは無視する
        }
    }

    private fun hostReceive(id: String, f: List<String>) {
        when (f[0]) {
            "CHAT_REQ" -> if ((phase == Phase.PLAYING || phase == Phase.LOBBY) && f.getOrNull(1)?.toIntOrNull() == round) {
                val m = members.firstOrNull { it.link == id }
                if (m != null) hostChat(m.slot, f.getOrNull(2)?.toIntOrNull() ?: -1, f.getOrElse(3) { "" })
            }
            "UNDO_REQ" -> if (phase == Phase.PLAYING && f[1].toInt() == round) {
                members.firstOrNull { it.link == id }?.let { hostStartUndo(it.slot) }
            }
            "UNDO_VOTE" -> if (phase == Phase.PLAYING && f[1].toInt() == round) {
                members.firstOrNull { it.link == id }?.let { hostVote(it.slot, f[2].toInt(), f[3] == "1") }
            }
            "RESIGN_REQ" -> if (phase == Phase.PLAYING && f[1].toInt() == round) {
                members.firstOrNull { it.link == id }?.let { onResign?.invoke(it.slot) }
            }
            "SELECT_REQ" -> if (phase == Phase.PLAYING && gameId == "yacht" && f[1].toInt() == round) {
                val member = members.firstOrNull { it.link == id } ?: return
                val index = f[2].toInt(); val mask = f[3].toInt()
                if (mask in 0..31 && canSelect?.invoke(member.slot, index, mask) == true) {
                    onSelection?.invoke(index, mask); sendAll("SELECT|$round|$index|$mask")
                }
            }
            W.HELLO -> {
                if (members.any { it.link == id }) return // 2回目の HELLO は新しい参加にしない
                when {
                    phase == Phase.PLAYING -> { net.sendTo(id, "${W.DENY}|playing"); return }
                    members.size >= MAX -> { net.sendTo(id, "${W.DENY}|full"); return }
                }
                val slot = (1 until MAX).first { s -> members.none { it.slot == s } }
                var name = clean(f.getOrElse(1) { "" }).ifBlank { "プレイヤー" }
                var k = 2
                val base = name
                while (members.any { it.name == name }) name = base + k++
                members.add(Member(slot, name, id).also {
                    it.proto = f.getOrNull(2)?.toIntOrNull() ?: 1
                    it.rules = Compat.decodeRules(f.getOrNull(3) ?: "")
                })
                net.sendTo(id, "${W.WELCOME}|$slot|${Compat.PROTOCOL}")
                if (advertise) { if (members.size >= MAX) net.stopHosting() else net.startHosting(adInfo()) }
                broadcastRoster()
                changed()
            }
            "ACTION_REQ" -> {
                val member=members.firstOrNull { it.link == id } ?: return
                if(phase != Phase.PLAYING || f.getOrNull(1)?.toIntOrNull() != round)return
                val move=f.getOrNull(2)?.toIntOrNull() ?: return
                if(onConcurrent?.invoke(member.slot,move) != true)resync(id)
            }
            W.REQ -> {
                val m = members.firstOrNull { it.link == id } ?: return
                if (f[1].toInt() != round || phase != Phase.PLAYING) return
                val index = f[2].toInt(); val move = f[3].toInt()
                // 「待った」の返事を集めている間は、手を受け付けない(送り直して、参加者の画面を元に戻す)
                if (undoVote == null && canAccept?.invoke(m.slot, index, move) == true) onMove?.invoke(index, move)
                else resync(id)
            }
            W.NEED -> if (f[1].toInt() == round) resync(id)
            W.AGAIN -> if (phase == Phase.PLAYING && f.getOrNull(1)?.toIntOrNull() == round && canAgain?.invoke() != false) {
                val member = members.firstOrNull { it.link == id } ?: return
                readySlots.add(member.slot); sendReady(); changed()
            }
            "LOBBY_REQUEST" -> if (f.getOrNull(1)?.toIntOrNull() == round && members.any { it.link == id }) backToLobby()
        }
    }

    private fun resync(id: String) {
        val moves = currentMoves?.invoke() ?: return
        net.sendTo(id, "${W.SYNC}|$round|" + moves.joinToString(","))
    }

    private fun guestReceive(id: String, f: List<String>) {
        if (id != hostLink) return
        when (f[0]) {
            "CLOCK_PLAYER" -> if(phase==Phase.PLAYING && f.getOrNull(1)?.toIntOrNull()==round) {
                val index=f.getOrNull(2)?.toIntOrNull();val seat=f.getOrNull(3)?.toIntOrNull();val seconds=f.getOrNull(4)?.toIntOrNull()
                if(index!=null&&seat!=null&&seconds!=null&&seat in 0 until MAX&&seconds in 0..120)onSeatClock?.invoke(index,seat,seconds)
            }
            "SELECT" -> if (phase == Phase.PLAYING && gameId == "yacht" && f[1].toInt() == round && f[3].toInt() in 0..31) onSelection?.invoke(f[2].toInt(), f[3].toInt())
            "CLOCK" -> if (phase == Phase.PLAYING && f[1].toInt() == round && f[3].toInt() in 0..120) onClock?.invoke(f[2].toInt(), f[3].toInt())
            "UNDO_ASK" -> if (phase == Phase.PLAYING && f[1].toInt() == round) {
                val slot = f[3].toInt()
                val v = UndoVote(f[2].toInt(), slot, f[4].toInt(), nameOf(slot))
                undoVote = v; onUndoAsk?.invoke(v); changed()
            }
            "UNDO_DONE" -> if (phase == Phase.PLAYING && f[1].toInt() == round) {
                val slot = f[4].toInt()
                val v = undoVote?.takeIf { it.id == f[2].toInt() } ?: UndoVote(f[2].toInt(), slot, -1, nameOf(slot))
                if (undoVote?.id == v.id) undoVote = null
                if (f[3] == "1") onUndoDone?.invoke(v, true, if (f[5].isEmpty()) emptyList() else f[5].split(',').map { it.toInt() }, -1)
                else onUndoDone?.invoke(v, false, emptyList(), f[5].toInt())
                changed()
            }
            "LOBBY" -> if (f.getOrNull(1)?.toIntOrNull() == round && phase == Phase.PLAYING) {
                phase = Phase.LOBBY; begin = null; undoVote = null; readySlots.clear(); onLobby?.invoke(); changed()
            }
            "READY" -> if (phase == Phase.PLAYING && f.getOrNull(1)?.toIntOrNull() == round) {
                readySlots.clear(); f.getOrNull(2)?.split(',')?.mapNotNull { it.toIntOrNull() }?.let { readySlots.addAll(it) }; changed()
            }
            W.WELCOME -> { mySlot = f[1].toInt(); hostProto = f.getOrNull(2)?.toIntOrNull() ?: 1; if (phase == Phase.JOINING) phase = Phase.LOBBY; changed() }
            "COMPAT" -> {
                val protos = f.getOrNull(1)?.split(',')?.mapNotNull { e -> e.split(':').let { p -> p.getOrNull(0)?.toIntOrNull()?.let { k -> p.getOrNull(1)?.toIntOrNull()?.let { v -> k to v } } } }?.toMap() ?: emptyMap()
                for (m in members) m.proto = if (m.slot == 0) hostProto else if (m.slot == mySlot) Compat.PROTOCOL else protos[m.slot] ?: 1
                changed()
            }
            "CHAT" -> if ((phase == Phase.PLAYING || phase == Phase.LOBBY) && f.getOrNull(1)?.toIntOrNull() == round) {
                val seq = f[2].toInt(); val slot = f[3].toInt(); val kind = f[4].toInt(); val body = f.getOrElse(5) { "" }
                if (kind == 0 || kind == 1) onChat?.invoke(Chat(seq, slot, nameOf(slot), kind, body))
            }
            W.DENY -> close(if (f.getOrNull(1) == "playing") "対局中なので入れませんでした" else "部屋が満員でした")
            W.ROSTER -> {
                gameId = f[1]
                options = decodeOptions(f[2])
                previousProto = members.associate { it.slot to it.proto }
                members.clear()
                if (f.size > 3 && f[3].isNotEmpty()) for (e in f[3].split(',')) {
                    val (s, n) = e.split(':', limit = 2)
                    members.add(Member(s.toInt(), n, null))
                }
                if (phase == Phase.PLAYING && begin == null) phase = Phase.LOBBY
                // 名簿が変わると、各人の手順番号はいったん分からなくなるので、前に知っていた分を引き継ぐ
                for (m in members) m.proto = if (m.slot == 0) hostProto else if (m.slot == mySlot) Compat.PROTOCOL else previousProto[m.slot] ?: 1
                changed()
            }
            W.BEGIN -> {
                val incoming = f[1].toInt()
                if (incoming <= round) return
                round = incoming
                undoVote = null
                readySlots.clear()
                val slots = f[5].split(',').map { it.toInt() }
                val names = slots.map { s -> if (s < 0) "CPU" else members.firstOrNull { it.slot == s }?.name ?: "プレイヤー" }
                val b = Begin(round, f[2], decodeOptions(f[3]), f[4].toLong(), slots, names)
                begin = b
                phase = Phase.PLAYING
                onBegin?.invoke(b)
                changed()
            }
            W.MOVE -> if (phase == Phase.PLAYING && f[1].toInt() == round) onMove?.invoke(f[2].toInt(), f[3].toInt())
            W.SYNC -> if (phase == Phase.PLAYING && f[1].toInt() == round) onSync?.invoke(if (f[2].isEmpty()) emptyList() else f[2].split(',').map { it.toInt() })
            W.BYE -> close("ホストが部屋を閉じました")
        }
    }

    /** 参加者: 手が飛んだ(届いた手の番号が先に進んでいる)ので、送り直してもらう */
    fun needSync() {
        if (!isHost && hostLink != null) net.sendTo(hostLink, "${W.NEED}|$round")
    }

    private fun close(reason: String) {
        if (phase == Phase.CLOSED) return
        closedReason = reason
        phase = Phase.CLOSED
        if (net.listener === this) net.listener = null
        changed()
    }

    private fun broadcastRoster() {
        if (!isHost) return
        sendAll("${W.ROSTER}|$gameId|${encodeOptions(options)}|" + members.joinToString(",") { "${it.slot}:${it.name}" })
        sendCompat()
    }

    private fun sendAll(text: String) {
        for (m in members) m.link?.let { net.sendTo(it, text) }
    }

    /** 近くの人との広告名: v1|ホスト名|ゲーム|人数 */
    private fun adInfo() = "v1|$myName|$gameId|${members.size}"

    companion object {
        const val MAX = 6

        fun host(net: Transport, name: String, advertise: Boolean) = OnlineRoom(net, true, name, null, advertise)
        fun guest(net: Transport, name: String, hostLink: String) = OnlineRoom(net, false, name, hostLink, false)

        /** 名前から区切り文字を取り除いて、12文字までにする */
        fun clean(name: String) = name.filter { it != '|' && it != ',' && it != ':' && it != ';' && it != '=' && it != '\n' && it != '\r' }.trim().take(12)

        /** 設定を区切り文字と重ならない形にする(キー~値 を ^ でつなぐ) */
        fun encodeOptions(o: GameOptions): String = o.values.entries.sortedBy { it.key }.joinToString("^") { "${it.key}~${it.value}" }
        fun decodeOptions(s: String): GameOptions =
            GameOptions(if (s.isEmpty()) emptyMap() else s.split('^').filter { '~' in it }.associate { it.substringBefore('~') to it.substringAfter('~') })
    }

    private object W {
        const val HELLO = "HELLO"
        const val WELCOME = "WELCOME"
        const val DENY = "DENY"
        const val ROSTER = "ROSTER"
        const val BEGIN = "BEGIN"
        const val REQ = "REQ"
        const val MOVE = "MOVE"
        const val SYNC = "SYNC"
        const val NEED = "NEED"
        const val AGAIN = "AGAIN"
        const val BYE = "BYE"
    }
}

/** 近くの部屋を探す(参加画面)。広告名 v1|ホスト名|ゲーム|人数 を読む */
class RoomScanner(private val net: Transport) : TransportListener {
    class Found(val id: String, val hostName: String, val gameId: String, val count: Int)

    val rooms = ArrayList<Found>()
    var error: String? = null
        private set
    var onChanged: (() -> Unit)? = null

    fun start() { net.listener = this; net.startScanning() }
    fun stop() { net.stopScanning(); if (net.listener === this) net.listener = null }

    override fun onRoomFound(id: String, info: String) {
        try {
            val f = info.split('|')
            if (f[0] != "v1") return
            rooms.removeAll { it.id == id }
            rooms.add(Found(id, f[1], f[2], f[3].toInt()))
            onChanged?.invoke()
        } catch (e: Exception) {
            // 形式が違う広告は無視
        }
    }

    override fun onRoomLost(id: String) { if (rooms.removeAll { it.id == id }) onChanged?.invoke() }
    override fun onTransportError(message: String) { error = message; onChanged?.invoke() }
}
