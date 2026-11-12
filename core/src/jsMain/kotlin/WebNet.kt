@file:OptIn(ExperimentalJsExport::class)

import jp.yonekou.asobi26.core.*
import jp.yonekou.asobi26.core.net.*

/**
 * 通信対戦の入口(ブラウザ版)。部屋・招待コード・手の受け渡しは、元のアプリと同じ Kotlin のコード(OnlineRoom・InviteBook・JoinFlow)をそのまま使う。
 * ブラウザにしかない部分(WebRTC・中継サーバーへの HTTP)だけを JavaScript(net.js)に任せる。
 */
private var rtcBackend: dynamic = null
private var relayBackend: dynamic = null
private var hooks: dynamic = null

class JsRtc : InviteTransport {
    override var listener: TransportListener? = null
    override var onInviteEvent: (() -> Unit)? = null
    override fun startHosting(info: String) {}
    override fun stopHosting() {}
    override fun startScanning() {}
    override fun stopScanning() {}
    /** すでにつながっている相手なら、部屋ができた直後にもう一度「つながった」を知らせる(HELLO を送るきっかけ) */
    override fun connect(id: String) {
        val st = js("setTimeout")
        st({ if (linkState(id) == LinkState.OPEN) listener?.onLinked(id) }, 0)
    }
    override fun sendTo(id: String, text: String) { rtcBackend.sendTo(id, text) }
    override fun disconnect(id: String) { rtcBackend.disconnect(id) }
    override fun closeAll() { rtcBackend.closeAll() }
    override fun createInvite(done: (peerId: String?, code: String?, error: String?) -> Unit) {
        rtcBackend.createInvite({ p: String?, c: String?, e: String? -> done(p, c, e) })
    }
    override fun acceptReply(peerId: String, replyCode: String, done: (error: String?) -> Unit) {
        rtcBackend.acceptReply(peerId, replyCode, { e: String? -> done(e) })
    }
    override fun acceptInvite(inviteCode: String, done: (peerId: String?, replyCode: String?, error: String?) -> Unit) {
        rtcBackend.acceptInvite(inviteCode, { p: String?, c: String?, e: String? -> done(p, c, e) })
    }
    override fun cancelInvite(peerId: String) { rtcBackend.disconnect(peerId) }
    override fun linkState(peerId: String): LinkState = try { LinkState.valueOf(rtcBackend.linkState(peerId) as String) } catch (e: Throwable) { LinkState.GONE }
}

class JsRelay : Relay {
    override fun publish(topic: String, message: String, done: (error: String?) -> Unit) {
        relayBackend.publish(topic, message, { e: String? -> done(e) })
    }
    override fun subscribe(topic: String, onStatus: (Boolean) -> Unit, onMessage: (String) -> Unit): RelaySubscription {
        val sub = relayBackend.subscribe(topic, { ok: Boolean -> onStatus(ok) }, { m: String -> onMessage(m) })
        return object : RelaySubscription { override fun close() { sub.close() } }
    }
}

private val rtc = JsRtc()
private val relay = JsRelay()
private var room: OnlineRoom? = null
private var book: InviteBook? = null
private var flow: JoinFlow? = null
private var myName = "あなた"
private var beginSeq = 0
private var matchHandle = -1
private var cpuLevel = 1
private class ChatItem(val seq: Int, val slot: Int, val name: String, val kind: Int, val body: String)
private val chatLog = ArrayList<ChatItem>()
private var undoAsk: OnlineRoom.UndoVote? = null
private val undoUsed = HashMap<Int, Int>()
private val undoDeclinedAt = HashMap<Int, Int>()
private var flash: String? = null
private var flashSeq = 0
private fun flashMsg(t: String) { flash = t; flashSeq++ }

private fun changed() { try { hooks?.changed() } catch (e: Throwable) { } }

@JsExport fun netInit(rtcB: dynamic, relayB: dynamic, h: dynamic) { rtcBackend = rtcB; relayBackend = relayB; hooks = h }

// JS(net.js)から Kotlin への通知
@JsExport fun netLinked(id: String) { rtc.listener?.onLinked(id); changed() }
@JsExport fun netUnlinked(id: String) { rtc.listener?.onUnlinked(id); changed() }
@JsExport fun netLinkFailed(id: String) { rtc.listener?.onLinkFailed(id); changed() }
@JsExport fun netText(id: String, text: String) { rtc.listener?.onText(id, text) }
@JsExport fun netInviteEvent() { rtc.onInviteEvent?.invoke(); book?.refresh(); reconcile(); changed() }

/** 招待コード/返信コードの変換(Android 版と同じ形式)。JS は SDP とコードの変換だけをここに頼む */
@JsExport fun rtcEncode(isOffer: Boolean, sdp: String): String = InviteCodec.encode(if (isOffer) InviteKind.OFFER else InviteKind.ANSWER, sdp)

/** コード → 相手の SDP。template は自分の createOffer/createAnswer が出した SDP。返り値は "OK:"+SDP か "ERR:"+理由、relayKey があれば "KEY:" 行を先頭に足す */
@JsExport fun rtcDecode(code: String, isOffer: Boolean, template: String): String {
    val kind = if (isOffer) InviteKind.OFFER else InviteKind.ANSWER
    return when (val p = InviteCodec.parse(code, kind)) {
        is Parsed.Full -> "OK:" + p.sdp
        is Parsed.Compact -> {
            val sdp = InviteCodec.buildSdp(template, p.info, kind.setup) ?: return "ERR:接続情報を組み立てられませんでした"
            "OK:" + sdp
        }
        is Parsed.Bad -> "ERR:" + p.message
    }
}

@JsExport fun onlineSetLevel(l: Int) { cpuLevel = l.coerceIn(0, 2) }

private fun setup(r: OnlineRoom) {
    r.onChanged = { changed() }
    r.onBegin = { b -> beginOnline(r, b) }
    r.onMove = { index, move ->
        val ses = matches[matchHandle]
        if (ses != null && index == ses.moves.size && ses.submit(move)) {
            if (r.isHost) r.share(index, move)
            changed()
        } else if (ses != null && index > ses.moves.size && !r.isHost) r.needSync()
    }
    r.onSync = { moves -> syncTo(moves) }
    r.canAccept = { slot, index, move ->
        val ses = matches[matchHandle]
        val b = r.begin
        ses != null && b != null && ses.outcome == null && index == ses.moves.size &&
            (Session.resignSeat(move)?.let { seat -> ses.canResign && b.seatSlots.getOrNull(seat) == slot }
                ?: (ses.toMove >= 0 && b.seatSlots.getOrNull(ses.toMove) == slot && ses.rules.isLegal(ses.state, move)))
    }
    r.onResign = { slot -> resignSlot(r, slot) }
    r.onChat = { c ->
        chatLog.add(ChatItem(c.seq, c.slot, c.name, c.kind, c.body))
        while (chatLog.size > 100) chatLog.removeAt(0)
        changed()
    }
    r.undoTarget = { slot ->
        val ses = matches[matchHandle]
        val b = r.begin
        val limit = ses?.options?.int("onlineUndo", 0) ?: 0
        if (ses == null || b == null || ses.outcome != null || ses.rules is ConcurrentRules<*> || limit == 0 ||
            (limit > 0 && (undoUsed[slot] ?: 0) >= limit) || undoDeclinedAt[slot] == ses.moves.size) null
        else ses.undoTargetFor(b.seatSlots.indexOf(slot))
    }
    r.onUndoAsk = { v -> undoAsk = v; changed() }
    r.onUndoApply = { v ->
        val ses = matches[matchHandle]
        if (ses != null && ses.rewindTo(v.target)) { undoUsed[v.slot] = (undoUsed[v.slot] ?: 0) + 1; ses.moves.toList() } else null
    }
    r.onUndoDone = { v, ok, moves, by ->
        if (undoAsk?.id == v.id) undoAsk = null
        val mine = v.slot == r.mySlot
        if (ok) {
            if (!r.isHost) syncTo(moves)
            flashMsg("全員が了承したので、${if (mine) "あなた" else v.name}の「待った」で戻しました")
        } else if (by == -3) flashMsg("いまは「待った」できません")
        else {
            matches[matchHandle]?.let { if (r.isHost) undoDeclinedAt[v.slot] = it.moves.size }
            flashMsg(when { by == -2 -> "返事がそろわなかったので、そのまま続けます"; by == v.slot -> "「待った」は取り消されました"; by == r.mySlot -> "了承しなかったので、そのまま続けます"; else -> "${r.nameOf(by)}が了承しなかったので、そのまま続けます" })
        }
        changed()
    }
    r.currentMoves = { matches[matchHandle]?.moves?.toList() ?: emptyList() }
    r.onLeft = { slot -> onLeft(r, slot) }
    r.onLobby = { changed() }
}

@Suppress("UNCHECKED_CAST")
private fun beginOnline(r: OnlineRoom, b: OnlineRoom.Begin) {
    beginSeq++
    if (r.mySlot !in b.seatSlots) { matchHandle = -1; changed(); return }
    val info = Catalog.byId(b.gameId) ?: return
    val def = info.def as? GameDef<Any?> ?: return
    val seats = b.seatSlots.mapIndexed { i, slot ->
        val mine = slot == r.mySlot
        Seat(human = mine, level = Level.values()[cpuLevel], name = if (mine) myName else b.names[i], remote = !mine && !(r.isHost && slot < 0))
    }
    val h = nextHandle++
    matches[h] = Session(def, b.options, seats, b.seed)
    matchHandle = h
    undoUsed.clear(); undoDeclinedAt.clear(); undoAsk = null
    changed()
}

@Suppress("UNCHECKED_CAST")
private fun syncTo(moves: List<Int>) {
    val ses = matches[matchHandle] ?: return
    val rec = MatchRecord(ses.def.id, ses.options, ses.seats, ses.seed, moves)
    val back = Session.restore(ses.def as GameDef<Any?>, rec) ?: return
    matches[matchHandle] = back
    changed()
}

@Suppress("UNCHECKED_CAST")
private fun onLeft(r: OnlineRoom, slot: Int) {
    val ses = matches[matchHandle] ?: return
    val b = r.begin ?: return
    if (ses.outcome != null) return
    val seats = ses.seats.mapIndexed { i, s -> if (b.seatSlots.getOrNull(i) == slot) Seat(false, s.level, "CPU", remote = false) else s }
    val rec = MatchRecord(ses.def.id, ses.options, seats, ses.seed, ses.moves.toList())
    matches[matchHandle] = Session.restore(ses.def as GameDef<Any?>, rec) ?: return
    changed()
}

private fun reconcile() {
    val f = flow ?: return
    if (room != null) return
    val id = f.peerId ?: return
    when (f.linkState()) {
        LinkState.OPEN -> {
            val r = OnlineRoom.guest(rtc, myName, id)
            setup(r); room = r; flow = null
            changed()
        }
        LinkState.FAILED, LinkState.GONE -> f.reset("つながりませんでした。招待コードの貼り付けからやり直してください")
        LinkState.PENDING -> {}
    }
}

@JsExport fun onlineHost(name: String) {
    onlineLeave()
    myName = OnlineRoom.clean(name).ifBlank { "あなた" }
    val r = OnlineRoom.host(rtc, myName, advertise = false)
    setup(r)
    r.choose("reversi", GameOptions())
    val bk = InviteBook(rtc, relay, { true }) { OnlineRoom.MAX - r.members.size }
    bk.onChanged = { changed() }
    book = bk
    room = r
    changed()
}

@JsExport fun onlineInviteCreate() { book?.create() }
@JsExport fun onlineInviteReply(index: Int, text: String) { val b = book ?: return; b.items.getOrNull(index)?.let { b.submitReply(it, text) } }
@JsExport fun onlineInviteCancel(index: Int) { val b = book ?: return; b.items.getOrNull(index)?.let { b.cancel(it) } }

@JsExport fun onlineJoin(name: String, code: String) {
    myName = OnlineRoom.clean(name).ifBlank { "あなた" }
    val f = flow ?: JoinFlow(rtc, relay) { true }.also { it.onChanged = { reconcile(); changed() }; flow = it }
    f.submit(code)
}
@JsExport fun onlineJoinReset() { flow?.reset(null); flow = null; changed() }

@JsExport fun onlineChoose(gameId: String, options: String) { room?.choose(gameId, GameOptions.decode(options)) }

/** ホスト: 対局を始める。人数は設定から決まる席の数(足りない席は CPU) */
@JsExport fun onlineStart(seed: String): Boolean {
    val r = room ?: return false
    if (!r.isHost) return false
    val def = Catalog.byId(r.gameId)?.def ?: return false
    val seats = def.seatsFor(r.options)
    if (r.members.size > seats) return false
    if (r.rulesMismatch(r.gameId).isNotEmpty()) return false
    r.start(seats, seed.toLong())
    return true
}
@JsExport fun onlineAgain() { room?.again() }
@JsExport fun onlineBackToLobby() { room?.backToLobby() }

@JsExport fun onlineLeave() {
    try { room?.leave() } catch (e: Throwable) { }
    book?.closeAll()
    try { rtc.closeAll() } catch (e: Throwable) { }
    room = null; book = null; flow = null; matchHandle = -1
    changed()
}

/** 手を指す。ホストは自分で確定して全員に配り、参加者はホストへ頼む(確定はホストから戻ってくる) */
@JsExport fun onlinePlay(h: Int, move: Int): Boolean {
    val r = room ?: return false
    val ses = matches[h] ?: return false
    val index = ses.moves.size
    return if (r.isHost) {
        if (ses.isHumanTurn && ses.submit(move)) { r.share(index, move); true } else false
    } else {
        if (ses.isHumanTurn && ses.rules.isLegal(ses.state, move)) { r.request(index, move); true } else false
    }
}

/** ホスト: CPU の席の手を指す(ホストの端末だけが計算する) */
@JsExport fun onlineCpuPlay(h: Int, move: Int): Boolean {
    val r = room ?: return false
    if (!r.isHost) return false
    val ses = matches[h] ?: return false
    val index = ses.moves.size
    return if (ses.submit(move)) { r.share(index, move); true } else false
}

private fun qq(s: String?): String = if (s == null) "null" else {
    val sb = StringBuilder("\"")
    for (c in s) when (c) { '"' -> sb.append("\\\""); '\\' -> sb.append("\\\\"); '\n' -> sb.append("\\n"); '\r' -> sb.append("\\r"); else -> sb.append(c) }
    sb.append('"').toString()
}

@JsExport fun onlineState(): String {
    val r = room
    val f = flow
    val members = r?.members?.joinToString(",", "[", "]") { "{\"slot\":${it.slot},\"name\":${qq(it.name)}}" } ?: "[]"
    val inv = book?.items?.withIndex()?.joinToString(",", "[", "]") { (i, v) -> "{\"i\":$i,\"code\":${qq(v.code)},\"state\":${qq(v.state.name)},\"error\":${qq(v.error)},\"auto\":${qq(v.auto.name)}}" } ?: "[]"
    val join = "{\"busy\":${f?.busy ?: false},\"reply\":${qq(f?.replyCode)},\"error\":${qq(f?.error)},\"auto\":${qq(f?.autoSend?.name)},\"active\":${f != null}}"
    return "{\"role\":${qq(if (r == null) "none" else if (r.isHost) "host" else "guest")},\"phase\":${qq(r?.phase?.name)},\"mySlot\":${r?.mySlot ?: -1},\"members\":$members," +
        "\"gameId\":${qq(r?.gameId)},\"options\":${qq(r?.options?.encode())},\"invites\":$inv,\"canCreate\":${book?.canCreate ?: false},\"creating\":${book?.creating ?: false}," +
        "\"bookError\":${qq(book?.error)},\"join\":$join,\"closed\":${qq(r?.closedReason)},\"transportError\":${qq(r?.transportError)},\"beginSeq\":$beginSeq,\"match\":$matchHandle," +
        "\"ready\":${r?.readySlots?.joinToString(",", "[", "]") ?: "[]"},\"round\":${r?.begin?.round ?: 0},\"legacy\":${(r?.legacyNames() ?: emptyList()).joinToString(",", "[", "]") { qq(it) }},\"mismatch\":${(r?.let { it.rulesMismatch(it.gameId) } ?: emptyList()).joinToString(",", "[", "]") { qq(it) }},\"undoOk\":${r != null && r.supports(Compat.UNDO) && (r.undoTarget?.invoke(r.mySlot) != null)},\"chatOk\":${r != null && r.supports(Compat.CHAT)},\"canResign\":${matches[matchHandle]?.canResign ?: false},\"flash\":\"${flashSeq}|${(flash ?: "").replace("\"", "")}\",\"undoAsk\":${undoAsk?.let { "{\"id\":${it.id},\"name\":${qq(it.name)},\"mine\":${it.slot == (r?.mySlot ?: -9)}}" } ?: "null"},\"chat\":${chatLog.takeLast(30).joinToString(",", "[", "]") { "{\"seq\":${it.seq},\"slot\":${it.slot},\"name\":${qq(it.name)},\"kind\":${it.kind},\"body\":${qq(it.body)}}" }},\"names\":${r?.begin?.names?.joinToString(",", "[", "]") { qq(it) } ?: "[]"}}"
}

/** 降参(Session が扱う特別な手)を、その席の人のものとして指す(ホストだけ) */
private fun resignSlot(r: OnlineRoom, slot: Int) {
    val ses = matches[matchHandle] ?: return
    val b = r.begin ?: return
    val seat = b.seatSlots.indexOf(slot)
    if (!r.isHost || seat < 0 || !ses.canResign || ses.outcome != null) return
    val index = ses.moves.size
    val m = Session.resignMove(seat)
    if (ses.submit(m)) { r.share(index, m); changed() }
}
@JsExport fun onlineResign() { val r = room ?: return; if (r.isHost) resignSlot(r, r.mySlot) else r.requestResign() }

@JsExport fun onlineSendChat(kind: Int, body: String): Boolean = room?.sendChat(kind, body) ?: false
@JsExport fun onlineRequestUndo() { room?.requestUndo() }
@JsExport fun onlineVoteUndo(yes: Boolean) { room?.voteUndo(yes); undoAsk = null; changed() }

/** そのゲームを遊べない(規則の番号が違う)参加者の名前 */
@JsExport fun onlineMismatch(gameId: String): String = (room?.rulesMismatch(gameId) ?: emptyList()).joinToString(",", "[", "]") { qq(it) }

/** ホスト: 再戦。準備ができた人(readySlots)で始める */
@JsExport fun onlineStartReady(seed: String): Boolean {
    val r = room ?: return false
    if (!r.isHost) return false
    val def = Catalog.byId(r.gameId)?.def ?: return false
    val seats = def.seatsFor(r.options)
    val who = r.readySlots.toSet() + r.mySlot
    r.start(seats, seed.toLong(), who)
    return true
}
