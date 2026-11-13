package jp.yonekou.asobi26.net

import jp.yonekou.asobi26.core.net.InviteCodec
import jp.yonekou.asobi26.core.net.InviteKind
import jp.yonekou.asobi26.core.net.InviteTransport
import jp.yonekou.asobi26.core.net.LinkState
import jp.yonekou.asobi26.core.net.Parsed
import jp.yonekou.asobi26.core.net.Relay
import jp.yonekou.asobi26.core.net.RelaySubscription
import jp.yonekou.asobi26.core.net.Transport
import jp.yonekou.asobi26.core.net.TransportListener
import jp.yonekou.asobi26.web.Context

/*
 * 通信の部品(Web 版)。元のアプリの WebRtcTransport・NtfyRelay・NearbyTransport と同じ名前・同じ使い方。
 * つなぐ・送る・受けるは web/net.js(ブラウザの WebRTC と HTTP)が行い、招待コードの形式・部屋の手順は Android 版と同じ Kotlin のコード。
 */

@JsFun("""(enc, dec, linked, unlinked, failed, text, inv) => {
  const core = { rtcEncode: enc, rtcDecode: dec, netLinked: linked, netUnlinked: unlinked, netLinkFailed: failed, netText: text, netInviteEvent: inv,
    netInit: (b, r) => { globalThis.asobiNetB = b; globalThis.asobiNetR = r; } };
  globalThis.asobiCreateNet(core, {});
}""")
private external fun jsNetInit(
    enc: (Boolean, String) -> String, dec: (String, Boolean, String) -> String,
    linked: (String) -> Unit, unlinked: (String) -> Unit, failed: (String) -> Unit, text: (String, String) -> Unit, inv: () -> Unit,
)
@JsFun("(cb) => globalThis.asobiNetB.createInvite((p, c, e) => cb(p ?? null, c ?? null, e ?? null))")
private external fun jsCreateInvite(cb: (String?, String?, String?) -> Unit)
@JsFun("(id, code, cb) => globalThis.asobiNetB.acceptReply(id, code, (e) => cb(e ?? null))")
private external fun jsAcceptReply(id: String, code: String, cb: (String?) -> Unit)
@JsFun("(code, cb) => globalThis.asobiNetB.acceptInvite(code, (p, c, e) => cb(p ?? null, c ?? null, e ?? null))")
private external fun jsAcceptInvite(code: String, cb: (String?, String?, String?) -> Unit)
@JsFun("(id, t) => globalThis.asobiNetB.sendTo(id, t)")
private external fun jsSendTo(id: String, text: String)
@JsFun("(id) => globalThis.asobiNetB.disconnect(id)")
private external fun jsDisconnect(id: String)
@JsFun("() => globalThis.asobiNetB && globalThis.asobiNetB.closeAll()")
private external fun jsCloseAll()
@JsFun("(id) => globalThis.asobiNetB.linkState(id)")
private external fun jsLinkState(id: String): String
@JsFun("(topic, msg, cb) => globalThis.asobiNetR.publish(topic, msg, (e) => cb(e ?? null))")
private external fun jsPublish(topic: String, msg: String, cb: (String?) -> Unit)
@JsFun("(topic, st, msg) => globalThis.asobiNetR.subscribe(topic, st, msg)")
private external fun jsSubscribe(topic: String, onStatus: (Boolean) -> Unit, onMessage: (String) -> Unit): JsAny
@JsFun("(s) => { try { s.close(); } catch (e) {} }")
private external fun jsCloseSub(s: JsAny)

private object NetBridge {
    var ready = false
    var rtc: WebRtcTransport? = null
    fun ensure() {
        if (ready) return
        ready = true
        jsNetInit(
            { isOffer, sdp -> InviteCodec.encode(if (isOffer) InviteKind.OFFER else InviteKind.ANSWER, sdp) },
            { code, isOffer, template ->
                val kind = if (isOffer) InviteKind.OFFER else InviteKind.ANSWER
                when (val p = InviteCodec.parse(code, kind)) {
                    is Parsed.Full -> "OK:" + p.sdp
                    is Parsed.Compact -> InviteCodec.buildSdp(template, p.info, kind.setup)?.let { "OK:$it" } ?: "ERR:接続情報を組み立てられませんでした"
                    is Parsed.Bad -> "ERR:" + p.message
                }
            },
            { id -> rtc?.listener?.onLinked(id); rtc?.onInviteEvent?.invoke() },
            { id -> rtc?.listener?.onUnlinked(id); rtc?.onInviteEvent?.invoke() },
            { id -> rtc?.listener?.onLinkFailed(id); rtc?.onInviteEvent?.invoke() },
            { id, t -> rtc?.listener?.onText(id, t) },
            { rtc?.onInviteEvent?.invoke() },
        )
    }
}

/** 遠くの人と(招待コードの WebRTC)。元のアプリの WebRtcTransport と同じ使い方 */
class WebRtcTransport(@Suppress("UNUSED_PARAMETER") context: Context) : InviteTransport {
    override var listener: TransportListener? = null
    override var onInviteEvent: (() -> Unit)? = null
    init { NetBridge.rtc = this; NetBridge.ensure() }
    override fun startHosting(info: String) {}
    override fun stopHosting() {}
    override fun startScanning() {}
    override fun stopScanning() {}
    /** すでにつながっている相手なら、部屋ができた直後にもう一度「つながった」を知らせる(HELLO を送るきっかけ) */
    override fun connect(id: String) { if (linkState(id) == LinkState.OPEN) listener?.onLinked(id) }
    override fun sendTo(id: String, text: String) = jsSendTo(id, text)
    override fun disconnect(id: String) = jsDisconnect(id)
    override fun closeAll() = jsCloseAll()
    override fun createInvite(done: (peerId: String?, code: String?, error: String?) -> Unit) = jsCreateInvite(done)
    override fun acceptReply(peerId: String, replyCode: String, done: (error: String?) -> Unit) = jsAcceptReply(peerId, replyCode, done)
    override fun acceptInvite(inviteCode: String, done: (peerId: String?, replyCode: String?, error: String?) -> Unit) = jsAcceptInvite(inviteCode, done)
    override fun cancelInvite(peerId: String) = jsDisconnect(peerId)
    override fun linkState(peerId: String): LinkState = try { LinkState.valueOf(jsLinkState(peerId)) } catch (_: Throwable) { LinkState.GONE }
}

/** 返信コードの一時預かり(ntfy)。元のアプリの NtfyRelay と同じ使い方 */
class NtfyRelay(@Suppress("UNUSED_PARAMETER") post: (() -> Unit) -> Unit) : Relay {
    override fun publish(topic: String, message: String, done: (error: String?) -> Unit) { NetBridge.ensure(); jsPublish(topic, message, done) }
    override fun subscribe(topic: String, onStatus: (Boolean) -> Unit, onMessage: (String) -> Unit): RelaySubscription {
        NetBridge.ensure()
        val s = jsSubscribe(topic, onStatus, onMessage)
        return object : RelaySubscription { override fun close() = jsCloseSub(s) }
    }
}

/** 近くの人と(Bluetooth・Wi-Fi Direct)はブラウザでは使えない */
class NearbyTransport(@Suppress("UNUSED_PARAMETER") context: Context) : Transport {
    override var listener: TransportListener? = null
    override fun startHosting(info: String) { listener?.onTransportError("近くの人と(Bluetooth・Wi-Fi Direct)は、Web 版では使えません") }
    override fun stopHosting() {}
    override fun startScanning() { listener?.onTransportError("近くの人と(Bluetooth・Wi-Fi Direct)は、Web 版では使えません") }
    override fun stopScanning() {}
    override fun connect(id: String) {}
    override fun sendTo(id: String, text: String) {}
    override fun disconnect(id: String) {}
    override fun closeAll() {}
}
