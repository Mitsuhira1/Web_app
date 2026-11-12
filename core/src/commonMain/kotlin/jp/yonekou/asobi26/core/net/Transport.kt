package jp.yonekou.asobi26.core.net

/** 通信層の抽象。本番はNearbyTransport、テストはFakeTransport。コールバックはメインスレッドで呼ばれる前提。 */
interface TransportListener {
    fun onRoomFound(id: String, info: String) {}
    fun onRoomLost(id: String) {}
    fun onLinked(id: String) {}
    fun onLinkFailed(id: String) {}
    fun onUnlinked(id: String) {}
    fun onText(id: String, text: String) {}
    fun onTransportError(message: String) {}
}

interface Transport {
    var listener: TransportListener?
    fun startHosting(info: String)
    fun stopHosting()
    fun startScanning()
    fun stopScanning()
    fun connect(id: String)
    fun sendTo(id: String, text: String)
    fun disconnect(id: String)
    fun closeAll()
}

enum class LinkState { PENDING, OPEN, FAILED, GONE }

/**
 * サーバーを使わず、招待コード/返信コードを手動で交換して端末同士を直接つなぐ通信方式(WebRTC)。
 * ホスト: createInvite → 招待コードを相手に送る → 返信コードが届いたら acceptReply。
 * 参加者: acceptInvite(招待コード) → 返信コードをホストに送る → つながると linkState が OPEN になる。
 * コールバックはメインスレッドで呼ばれる前提。peerId は TransportListener に渡される id と同じ。
 */
interface InviteTransport : Transport {
    /** 接続の状態が変わった時に呼ばれる(画面の更新用) */
    var onInviteEvent: (() -> Unit)?
    fun createInvite(done: (peerId: String?, code: String?, error: String?) -> Unit)
    fun acceptReply(peerId: String, replyCode: String, done: (error: String?) -> Unit)
    fun acceptInvite(inviteCode: String, done: (peerId: String?, replyCode: String?, error: String?) -> Unit)
    fun cancelInvite(peerId: String)
    fun linkState(peerId: String): LinkState
}
