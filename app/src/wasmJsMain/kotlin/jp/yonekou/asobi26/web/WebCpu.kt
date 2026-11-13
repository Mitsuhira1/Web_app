package jp.yonekou.asobi26.web

@JsFun("(rec, ms, cb) => { try { globalThis.asobiCpu(rec, ms).then((m) => cb(m), () => cb(-1)); } catch (e) { cb(-1); } }")
private external fun jsCpu(record: String, ms: Int, cb: (Int) -> Unit)

/** CPU の思考を Worker(web/worker.js。規則と CPU は同じ Kotlin のコードを JS にしたもの)で行う */
object WebCpu {
    fun choose(record: String, millis: Int, done: (Int) -> Unit) = jsCpu(record, millis, done)
}
