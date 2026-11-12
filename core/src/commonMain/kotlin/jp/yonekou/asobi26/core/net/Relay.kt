package jp.yonekou.asobi26.core.net

/**
 * 中継サーバー: 暗号化された返信を、ホストが受け取れるまで一時的に預かるだけの掲示板。
 * 「掲示板の名前(topic)」に1件置く側(参加者)と、名前を見張る側(ホスト)で使う。
 * コールバックはメインスレッドで呼ばれる前提(本番の実装がメインスレッドへ戻して呼ぶ)。
 */
interface Relay {
    /** 1件置く。一時的な失敗は実装の側で数回やり直し、最終的な結果を done に返す(null=成功)。 */
    fun publish(topic: String, message: String, done: (error: String?) -> Unit)

    /**
     * 掲示板の見張りを始める。onStatus: サーバーにつながった(true)/つながらない(false)が変わった時。
     * onMessage: 新しい投稿が届いた時(同じ投稿は2度渡さない)。close で止める。
     */
    fun subscribe(topic: String, onStatus: (Boolean) -> Unit, onMessage: (String) -> Unit): RelaySubscription

    companion object {
        /** 1件の大きさの上限(文字数)。ntfy は 4096 バイトを超えると添付ファイル扱いになるので、それより小さく。 */
        const val MAX_MESSAGE_CHARS = 3_000
    }
}

interface RelaySubscription {
    fun close()
}
