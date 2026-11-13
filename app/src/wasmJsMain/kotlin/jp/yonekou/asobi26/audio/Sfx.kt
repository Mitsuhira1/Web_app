package jp.yonekou.asobi26.audio

import jp.yonekou.asobi26.web.*

@JsFun("(name, vol, rate) => { try { globalThis.asobiSfx && globalThis.asobiSfx.play(name, { volume: vol, rate: rate }); } catch (e) {} }")
private external fun jsPlay(name: String, vol: Float, rate: Float)

/**
 * 効果音(Web 版)。元のアプリと同じく、計算で作る音(Synth)と本物の録音(碁石・将棋の駒)を鳴らす。
 * 音の用意と再生は web/audio.js(Web Audio)が行い、ここからは音の名前と大きさ・高さだけを渡す。
 * 元のアプリの Sfx と同じ使い方(play・enabled・release)。
 */
class Sfx(@Suppress("UNUSED_PARAMETER") context: Context) {
    /** アプリの「効果音」設定 */
    var enabled: Boolean = true

    /** 鳴らす。volume 0〜1、rate 0.5〜2 */
    fun play(s: Sound, volume: Float = 1f, rate: Float = 1f) {
        if (!enabled) return
        jsPlay(s.name, volume.coerceIn(0f, 1f), rate.coerceIn(0.5f, 2f))
    }

    fun release() {}
}
