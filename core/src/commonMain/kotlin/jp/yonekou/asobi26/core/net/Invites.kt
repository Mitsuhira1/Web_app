package jp.yonekou.asobi26.core.net

enum class InviteState { WAITING_REPLY, CONNECTING, FAILED }

/** ホスト側: 返信を中継サーバー経由で自動で受け取る仕組みの状態(手動の返信コードは、これと関係なくいつでも使える) */
enum class AutoReply {
    /** 使わない(設定でオフ、または自動返信に対応しない形式のコード) */
    OFF,
    /** 中継サーバーにつないでいる最中 */
    STARTING,
    /** つながっていて、返信を待っている */
    LISTENING,
    /** 中継サーバーにつながらない(手動の返信コードなら使える) */
    UNREACHABLE,
}

class Invite(val peerId: String, val code: String) {
    var state: InviteState = InviteState.WAITING_REPLY
        internal set
    var error: String? = null
        internal set
    var auto: AutoReply = AutoReply.OFF
        internal set
    internal var sub: RelaySubscription? = null
}

/**
 * ホスト側: 発行した招待コードの一覧と、返信コードを受け取って接続するまでの状態を管理する。
 * relay があり useRelay() が true の間に作った招待コードには秘密の鍵を入れ、参加者が置いた暗号化済みの返信を自動で受け取る。
 * (受け取った返信は、手で貼り付けられた返信コードと全く同じ経路 submitReply で処理する)
 */
class InviteBook(
    private val net: InviteTransport,
    private val relay: Relay? = null,
    private val useRelay: () -> Boolean = { true },
    /** あと何人分の招待を出せるか(最後の引数なので、呼び出し側は末尾のラムダで書ける) */
    private val freeSlots: () -> Int,
) {
    val items = ArrayList<Invite>()
    var creating: Boolean = false
        private set
    var error: String? = null
        private set
    var onChanged: (() -> Unit)? = null

    /** 招待コードを発行できるか(空き枠の数まで)。 */
    val canCreate: Boolean get() = !creating && items.size < freeSlots()

    private fun changed() { onChanged?.invoke() }

    fun create() {
        if (!canCreate) return
        creating = true
        error = null
        try {
            net.createInvite { peerId, code, err ->
                creating = false
                if (peerId != null && code != null) addInvite(peerId, code) else error = err ?: "招待コードを作れませんでした"
                changed()
            }
        } catch (e: Throwable) {
            // 通信層の想定外の失敗でも、アプリを落とさずエラー表示にする
            creating = false
            error = "招待コードを作れませんでした(${(e::class.simpleName ?: "エラー")})"
        }
        changed()
    }

    /** 新しい招待を一覧に加える。自動返信が使えるなら、鍵入りのコードにして、返信の見張りも始める。 */
    private fun addInvite(peerId: String, code: String) {
        val r = relay
        var shown = code
        var key: ByteArray? = null
        if (r != null && useRelay()) {
            try {
                val k = RelayCrypto.newKey()
                val withKey = InviteCodec.withRelayKey(code, k)
                if (withKey != null) { shown = withKey; key = k }
            } catch (e: Throwable) {
                // 鍵を作れなくても、手動の返信コードで進められる
            }
        }
        val inv = Invite(peerId, shown)
        items.add(inv)
        if (r != null && key != null) listen(inv, r, key)
    }

    private fun listen(inv: Invite, r: Relay, key: ByteArray) {
        inv.auto = AutoReply.STARTING
        try {
            val sub = r.subscribe(
                RelayCrypto.topic(key),
                { connected ->
                    if (inv.auto != AutoReply.OFF && inv.state == InviteState.WAITING_REPLY) {
                        inv.auto = if (connected) AutoReply.LISTENING else AutoReply.UNREACHABLE
                        changed()
                    }
                },
                { message ->
                    // 開けない投稿(鍵が違う・壊れている)は、見知らぬ人の書き込みとして黙って捨てる
                    val plain = RelayCrypto.open(key, message)
                    if (plain != null && inv.auto != AutoReply.OFF && inv.state == InviteState.WAITING_REPLY && inv in items) submitReply(inv, plain)
                },
            )
            // 見張りを始めた途端に返信が届いて、もう止める状態になっていた場合は、すぐ閉じる
            if (inv.auto == AutoReply.OFF) closeQuietly(sub) else inv.sub = sub
        } catch (e: Throwable) {
            inv.auto = AutoReply.UNREACHABLE
        }
    }

    private fun closeQuietly(s: RelaySubscription) {
        try { s.close() } catch (e: Throwable) { /* 止める時の失敗は無視 */ }
    }

    private fun stopListening(inv: Invite) {
        val s = inv.sub
        inv.sub = null
        inv.auto = AutoReply.OFF
        if (s != null) closeQuietly(s)
    }

    fun submitReply(invite: Invite, text: String) {
        if (invite.state == InviteState.CONNECTING) return
        invite.error = null
        invite.state = InviteState.CONNECTING
        try {
            net.acceptReply(invite.peerId, text) { err ->
                if (err != null) {
                    invite.state = InviteState.WAITING_REPLY
                    invite.error = err
                } else {
                    stopListening(invite) // 返信を受け付けた。あとは接続を待つだけなので、見張りは止める
                }
                changed()
            }
        } catch (e: Throwable) {
            invite.state = InviteState.WAITING_REPLY
            invite.error = "返信コードを受け付けられませんでした(${(e::class.simpleName ?: "エラー")})"
        }
        changed()
    }

    fun cancel(invite: Invite) {
        stopListening(invite)
        try { net.cancelInvite(invite.peerId) } catch (e: Throwable) { /* 取り消しの失敗は画面から外すだけで足りる */ }
        items.remove(invite)
        changed()
    }

    /** つながった招待は一覧から外し、つながらなかったものは失敗表示にする。 */
    fun refresh() {
        var any = false
        val it = items.iterator()
        while (it.hasNext()) {
            val inv = it.next()
            when (net.linkState(inv.peerId)) {
                LinkState.OPEN -> { stopListening(inv); it.remove(); any = true }
                LinkState.FAILED, LinkState.GONE -> if (inv.state != InviteState.FAILED) {
                    stopListening(inv)
                    inv.state = InviteState.FAILED
                    inv.error = inv.error ?: "接続できませんでした。新しい招待コードを作り直してください"
                    any = true
                }
                LinkState.PENDING -> {}
            }
        }
        if (any) changed()
    }

    fun closeAll() {
        for (inv in items) {
            stopListening(inv)
            try { net.cancelInvite(inv.peerId) } catch (e: Throwable) { /* 閉じる時の失敗は無視 */ }
        }
        items.clear()
    }
}

/** 参加者側: 返信コードを中継サーバーへ自動で送る処理の状態 */
enum class AutoSend {
    /** 使わない(設定でオフ、招待コードが自動返信に対応していない) */
    OFF,
    SENDING,
    /** 中継サーバーが受け取った(ホストが読めばつながる) */
    SENT,
    /** 送れなかった(返信コードを手でホストに送る) */
    FAILED,
}

/**
 * 参加者側: 招待コードから返信コードを作り、ホストへ渡す。
 * 招待コードに鍵が入っていて relay が使えれば、返信コードを暗号化して中継サーバーに置く(ホストが自動で受け取る)。
 * 置けなかった時のために、返信コードそのもの(手動で送る用)はいつでも使える。
 */
class JoinFlow(
    private val net: InviteTransport,
    private val relay: Relay? = null,
    private val useRelay: () -> Boolean = { true },
) {
    var autoSend: AutoSend = AutoSend.OFF
        private set
    /** やり直しや取り消しのたびに増やし、古い非同期の結果が今の状態を書き換えないようにする */
    private var generation = 0

    var busy: Boolean = false
        private set
    var replyCode: String? = null
        private set
    var peerId: String? = null
        private set
    var error: String? = null
        private set
    var onChanged: (() -> Unit)? = null

    private fun changed() { onChanged?.invoke() }

    fun submit(text: String) {
        if (busy || peerId != null) return
        busy = true
        error = null
        autoSend = AutoSend.OFF
        val gen = ++generation
        val key: ByteArray? = if (relay != null && useRelay()) {
            try { InviteCodec.relayKeyOf(text) } catch (e: Throwable) { null }
        } else null
        try {
            net.acceptInvite(text) { id, reply, err ->
                if (gen != generation) {
                    // 返信コードを作っている間に「やり直し」された。できてしまった接続は使わず閉じる
                    if (id != null) try { net.cancelInvite(id) } catch (e: Throwable) { /* 閉じる時の失敗は無視 */ }
                    return@acceptInvite
                }
                busy = false
                if (id != null && reply != null) {
                    peerId = id
                    replyCode = reply
                    if (key != null) sendAuto(reply, key, gen)
                } else {
                    error = err ?: "返信コードを作れませんでした"
                }
                changed()
            }
        } catch (e: Throwable) {
            busy = false
            error = "返信コードを作れませんでした(${(e::class.simpleName ?: "エラー")})"
        }
        changed()
    }

    private fun sendAuto(reply: String, key: ByteArray, gen: Int) {
        val r = relay ?: return
        try {
            val sealed = RelayCrypto.seal(key, reply)
            if (sealed.length > Relay.MAX_MESSAGE_CHARS) { autoSend = AutoSend.FAILED; return }
            autoSend = AutoSend.SENDING
            r.publish(RelayCrypto.topic(key), sealed) { err ->
                if (gen == generation) {
                    autoSend = if (err == null) AutoSend.SENT else AutoSend.FAILED
                    changed()
                }
            }
        } catch (e: Throwable) {
            autoSend = AutoSend.FAILED
        }
    }

    fun linkState(): LinkState = peerId?.let { net.linkState(it) } ?: LinkState.PENDING

    /** 最初からやり直す(つながっていた/待っていた接続は閉じる)。message があれば表示する。 */
    fun reset(message: String? = null) {
        generation++
        autoSend = AutoSend.OFF
        peerId?.let { try { net.cancelInvite(it) } catch (e: Throwable) { /* 閉じる時の失敗は無視 */ } }
        peerId = null
        replyCode = null
        busy = false
        error = message
        changed()
    }
}
