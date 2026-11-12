package jp.yonekou.asobi26.audio

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * 効果音の種類。variants は「同じ音の少し違う版」の数(毎回同じ音だと機械的に聞こえるので、鳴らす時に選ぶ)。
 * volume は鳴らす時の大きさ(0〜1)。
 * 電子音ではなく、実際の道具の音に近づける: 物が当たる力(固い物ほど短い)で、道具と台の共鳴を鳴らし、
 * 小さな弾み・こすれ・部屋の短い響きを重ねる。
 */
enum class Sound(val variants: Int, val volume: Float) {
    /** 画面のボタン(小さな木の札を指で軽くたたく「トッ」) */
    TAP(2, 0.42f),
    /** 戻る(少し低く柔らかい「トン」) */
    BACK(2, 0.42f),
    /** リバーシの石(固いプラスチックの円盤)を盤に置く「パチッ」 */
    STONE(4, 0.9f),
    /** 石を裏返して置き直す軽い「カチ」 */
    FLIP(3, 0.9f),
    /** 碁石を厚い木の盤に打つ「パチン」 */
    GO(4, 0.9f),
    /** 将棋の駒を盤に打つ(木と木の高く乾いた「パチッ」) */
    KOMA(4, 0.9f),
    /** チェスの駒(底にフェルトの重い木の駒)を置く「コト」 */
    CHESS(3, 0.8f),
    /** ビー玉を木のくぼみに落とす「カチャッ」 */
    MARBLE(4, 0.75f),
    /** ビー玉がたまり場にまとめて転がり込む「ジャラッ」 */
    RATTLE(3, 0.75f),
    /** コネクトフォーの円盤が枠の中を落ちて底に当たる「カタタン」 */
    DISC(3, 0.8f),
    /** 木のコマを木の盤に置く「コトッ」(モリス・チェッカー・ヘックスなど) */
    WOOD(4, 0.8f),
    /** 取ったコマを盤の外に置く(コマどうしが軽く当たる「カチッ」) */
    TAKE(3, 0.55f),
    /** 鉛筆で線を引く「シャッ」 */
    PEN(3, 0.5f),
    /** 鉛筆で印を書き込む「カリカリ」 */
    SCRIBBLE(2, 0.45f),
    /** 数字の札を置く(木の札の「コッ」) */
    TILE(3, 0.65f),
    /** ピンを穴に差す「プチ」 */
    PEG(3, 0.5f),
    /** サイコロをいくつか振って、フェルトの皿に転がす */
    DICE(3, 0.8f),
    /** ルーレットを回す(つめが歯に当たる「カラララ…カタ、カタ」) */
    SPIN(2, 0.7f),
    /** カードを卓に出す「パサッ」 */
    CARD(4, 0.65f),
    /** カードをめくる「ペラッ」 */
    CARD_FLIP(3, 0.6f),
    /** カードを配る・引く(卓の上をすべる「スッ」) */
    DEAL(3, 0.5f),
    /** カードを切る(リフルシャッフル「パラララ…ザッ」) */
    SHUFFLE(2, 0.7f),
    /** チップを置く(陶器のチップが当たる「チャリ」) */
    CHIP(3, 0.6f),
    /** 花札を場にたたきつける「パチン」 */
    HANA(3, 0.8f),
    /** 麻雀の牌を卓に打つ「タンッ」 */
    MJ(4, 0.85f),
    /** 麻雀の牌を混ぜる「ジャラジャラ」 */
    MJ_MIX(1, 0.6f),
    /** カットイン(風を切る音と、拍子木の「カーン」) */
    CUTIN(1, 0.75f),
    /** 自分の番の知らせ(小さな鈴の「チーン」) */
    TURN(1, 0.4f),
    /** 知らせ(木をたたく「コンコン」。待ったが押された時) */
    KNOCK(1, 0.7f),
    /** 残り時間のカウントダウン(木魚のような「コッ」) */
    COUNT(1, 0.6f),
    /** 残り3秒から(高く強い「カッ」) */
    COUNT_LAST(1, 0.8f),
    /** 時間切れ(拍子木を2回「カカン」) */
    TIMEUP(1, 0.85f),
    /** 勝ち(マリンバで上がっていく) */
    WIN(1, 0.65f),
    /** 負け(マリンバで下がっていく) */
    LOSE(1, 0.55f),
    /** 引き分け */
    DRAW(1, 0.55f),
}

/** 音の計算(純粋な Kotlin。JVM のテストでも作れる) */
object Synth {
    const val RATE = 44100

    /** 共鳴1つ: 高さ[Hz]・大きさ・60dB 小さくなるまでの時間[秒] */
    class Mode(val f: Double, val a: Double, val t60: Double)

    /** variant ごとに少しずつ違う音を作る */
    fun make(s: Sound, variant: Int = 0): ShortArray {
        val rng = Random(s.ordinal * 131 + variant * 17 + 5)
        fun j(x: Double, amount: Double = 0.05) = x * (1 + (rng.nextDouble() * 2 - 1) * amount)
        /** 共鳴の組を、少しずつずらして作る */
        fun body(vararg m: Triple<Double, Double, Double>, spread: Double = 0.05) = m.map { Mode(j(it.first, spread), it.second * j(1.0, 0.15), it.third * j(1.0, 0.12)) }

        // --- 台と道具の共鳴(よく使うもの) ---
        /** 厚い木の盤(碁盤・将棋盤): 低く短い「コッ」という胴の響き */
        fun thickBoard() = body(Triple(210.0, 0.22, 0.1), Triple(450.0, 0.4, 0.09), Triple(930.0, 0.42, 0.06), Triple(1480.0, 0.3, 0.045), Triple(2300.0, 0.2, 0.03))
        /** うすい木の板(折りたたみの盤・木の箱) */
        fun thinBoard() = body(Triple(330.0, 0.35, 0.07), Triple(700.0, 0.5, 0.06), Triple(1350.0, 0.42, 0.04), Triple(2450.0, 0.25, 0.03))
        /** フェルト・マット(響かない。低い「トッ」だけ) */
        fun felt() = body(Triple(170.0, 0.3, 0.04), Triple(340.0, 0.35, 0.03), Triple(640.0, 0.2, 0.02))

        return when (s) {
            Sound.TAP -> render(0.09, rng, room = 0.0) { b ->
                b.strike(0.0, 1.0, 0.7, body(Triple(1050.0, 1.0, 0.035), Triple(2300.0, 0.4, 0.02), Triple(3900.0, 0.15, 0.012), Triple(420.0, 0.35, 0.03)), noise = 0.25, noiseHz = 2600.0)
            }
            Sound.BACK -> render(0.11, rng, room = 0.0) { b ->
                b.strike(0.0, 1.0, 1.1, body(Triple(620.0, 1.0, 0.045), Triple(1400.0, 0.4, 0.025), Triple(280.0, 0.5, 0.04)), noise = 0.2, noiseHz = 1500.0)
                b.strike(j(0.028, 0.2), 0.3, 0.9, body(Triple(820.0, 1.0, 0.03), Triple(1900.0, 0.3, 0.02)), noise = 0.1, noiseHz = 2000.0)
            }
            Sound.STONE -> render(0.2, rng, room = 0.0) { b ->
                // リバーシの石: 録音(KReversi の石を置く音)の高さごとの強さと消え方に合わせた。録音は4kHzより上がないので、そこは碁石の録音を目安に足した
                b.matched(0.0, 1.0, Ref.STONE, j(1.0, 0.06))
            }
            Sound.FLIP -> render(0.16, rng, room = 0.0) { b ->
                // 裏返す: 石の縁が先に当たり、すぐ面が着く(軽い2つの当たり)
                b.matched(0.0, 0.6, Ref.STONE.lighter(), j(1.12, 0.05))
                b.matched(j(0.028, 0.2), 1.0, Ref.STONE.lighter(), j(1.0, 0.05))
            }
            Sound.GO -> render(0.26, rng, room = 0.0) { b ->
                // 碁石: 録音10本(KaTrain・Sabaki の石を打つ音)の平均に合わせた
                b.matched(0.0, 1.0, Ref.GO, j(1.0, 0.07))
            }
            Sound.KOMA -> render(0.26, rng, room = 0.0) { b ->
                // 将棋の駒: 録音(lishogi の駒を打つ音)に合わせた。4kHz より上が中心の、乾いた高い「パチッ」
                b.matched(0.0, 1.0, Ref.KOMA, j(1.0, 0.05))
            }
            Sound.CHESS -> render(0.1, rng, room = 0.0) { b ->
                // チェスの駒: 録音(lichess の駒を置く音)に合わせた。400〜1000Hz が中心の、ごく短い「コッ」
                b.matched(0.0, 1.0, Ref.CHESS, j(1.0, 0.06))
            }
            Sound.MARBLE -> render(0.3, rng) { b ->
                // ガラス玉が木のくぼみに落ちて、小さく弾み、ほかの玉に当たる
                var t = 0.0
                var amp = 1.0
                var gap = j(0.03, 0.25)
                var k = 0
                while (amp > 0.06 && t < 0.2) {
                    val glass = body(Triple(5200.0, 1.0, 0.03), Triple(7900.0, 0.8, 0.022), Triple(11200.0, 0.5, 0.014), Triple(14500.0, 0.25, 0.008), spread = 0.12)
                    b.strike(t, amp, 0.07, glass, noise = 0.35, noiseHz = 9000.0)
                    if (k < 2) b.strike(t, amp * 0.6, 0.4, body(Triple(380.0, 1.0, 0.05), Triple(820.0, 0.6, 0.04), Triple(1700.0, 0.3, 0.03)), noise = 0.15, noiseHz = 1500.0)
                    t += gap; gap *= 0.62; amp *= 0.5; k++
                }
            }
            Sound.RATTLE -> render(0.5, rng) { b ->
                // いくつもの玉が当たり合いながら転がり込む
                var t = 0.0
                for (k in 0 until 16) {
                    val glass = body(Triple(5000.0, 1.0, 0.028), Triple(7700.0, 0.8, 0.02), Triple(11000.0, 0.5, 0.012), spread = 0.2)
                    val amp = (0.5 + rng.nextDouble() * 0.5) * exp(-k / 7.0)
                    b.strike(t, amp, 0.07, glass, noise = 0.3, noiseHz = 9000.0)
                    if (k % 3 == 0) b.strike(t, amp * 0.5, 0.4, body(Triple(360.0, 1.0, 0.05), Triple(790.0, 0.6, 0.04)), noise = 0.1, noiseHz = 1200.0)
                    t += 0.006 + rng.nextDouble() * 0.028 * (1 + k / 8.0)
                }
            }
            Sound.DISC -> render(0.36, rng) { b ->
                // プラスチックの円盤が枠の内側に2〜3回当たりながら落ち、底(下の円盤)に当たって小さく弾む
                val disc = { body(Triple(1700.0, 1.0, 0.022), Triple(2900.0, 0.8, 0.016), Triple(4600.0, 0.5, 0.011), Triple(7000.0, 0.25, 0.007), spread = 0.1) }
                val frame = { body(Triple(520.0, 1.0, 0.05), Triple(1150.0, 0.6, 0.035), Triple(240.0, 0.6, 0.06)) }
                b.strike(0.0, 0.35, 0.2, disc(), noise = 0.3, noiseHz = 4000.0)
                b.strike(j(0.045, 0.2), 0.3, 0.2, disc(), noise = 0.3, noiseHz = 4000.0)
                val land = j(0.1, 0.1)
                b.strike(land, 1.0, 0.22, disc(), noise = 0.45, noiseHz = 3500.0)
                b.strike(land, 0.9, 0.5, frame(), noise = 0.2, noiseHz = 1100.0)
                b.strike(land + j(0.05, 0.2), 0.35, 0.22, disc(), noise = 0.3, noiseHz = 3500.0)
                b.strike(land + j(0.082, 0.2), 0.14, 0.22, disc(), noise = 0.2, noiseHz = 3500.0)
            }
            Sound.WOOD -> render(0.14, rng, room = 0.0) { b ->
                // 木のコマ: 録音(lichess・lidraughts の木のコマが当たる音)に合わせた。600〜2500Hz が中心
                b.matched(0.0, 1.0, Ref.WOOD, j(1.0, 0.06))
            }
            Sound.TAKE -> render(0.26, rng, room = 0.0) { b ->
                // コマを取る: 録音(lishogi の駒を取る音)に合わせた。取ったコマを駒台に置く、高く軽い音
                b.matched(0.0, 1.0, Ref.TAKE, j(1.0, 0.06))
            }
            Sound.PEN -> render(j(0.2, 0.1), rng, room = 0.0) { b ->
                // 鉛筆の線: こすれる音は 4kHz より上が中心の幅広い雑音(GCompris の線を引く音の録音に合わせた)。紙の繊維の細かい引っかかりで揺れる
                b.stroke(0.0, b.n.toDouble() / RATE - 0.012, Ref.PEN_BANDS)
            }
            Sound.SCRIBBLE -> {
                val a = scratch(0.07, rng, 1100.0, 4600.0, 0.3)
                val gap = DoubleArray((0.025 * RATE).toInt())
                val c1 = scratch(0.06, rng, 1100.0, 4300.0, 0.3)
                val c2 = scratch(0.06, rng, 1100.0, 4800.0, 0.3)
                finish(a + gap + c1 + gap + c2, rng, room = 0.04)
            }
            Sound.TILE -> render(0.15, rng) { b ->
                b.strike(0.0, 1.0, 0.25, body(Triple(1500.0, 1.0, 0.025), Triple(2800.0, 0.6, 0.016), Triple(4400.0, 0.3, 0.01)), noise = 0.35, noiseHz = 3500.0)
                b.strike(0.0, 0.7, 0.5, body(Triple(560.0, 1.0, 0.04), Triple(1100.0, 0.5, 0.03)), noise = 0.15, noiseHz = 1200.0)
            }
            Sound.PEG -> render(0.11, rng, room = 0.05) { b ->
                b.strike(0.0, 0.9, 0.3, body(Triple(2000.0, 1.0, 0.014), Triple(3700.0, 0.5, 0.009), Triple(900.0, 0.5, 0.02)), noise = 0.4, noiseHz = 3800.0)
                // 穴の底に着く
                b.strike(j(0.014, 0.2), 0.5, 0.6, body(Triple(650.0, 1.0, 0.025), Triple(1300.0, 0.4, 0.016)), noise = 0.1, noiseHz = 1200.0)
            }
            Sound.DICE -> render(0.85, rng) { b ->
                // サイコロ3つ: それぞれが弾みながら転がり、ぶつかり合い、止まる。皿はフェルト張り
                val die = { body(Triple(2400.0, 1.0, 0.016), Triple(3900.0, 0.8, 0.012), Triple(6000.0, 0.5, 0.008), Triple(8800.0, 0.25, 0.006), spread = 0.12) }
                for (d in 0 until 3) {
                    var t = d * 0.035 + rng.nextDouble() * 0.03
                    var gap = 0.085 + rng.nextDouble() * 0.04
                    var amp = 0.75 + rng.nextDouble() * 0.25
                    while (t < 0.72 && amp > 0.05) {
                        // 角で当たる時は固く高く、面で着く時は低い
                        val edge = rng.nextDouble() < 0.6
                        b.strike(t, amp * (if (edge) 0.8 else 0.5), if (edge) 0.14 else 0.4, die(), noise = 0.35, noiseHz = if (edge) 5000.0 else 2500.0)
                        b.strike(t, amp * 0.8, 1.0, felt() + body(Triple(520.0, 0.5, 0.035), Triple(1050.0, 0.25, 0.025)), noise = 0.25, noiseHz = 900.0)
                        // ほかのサイコロに当たる
                        if (rng.nextDouble() < 0.3) b.strike(t + 0.012, amp * 0.6, 0.1, die(), noise = 0.3, noiseHz = 6000.0)
                        t += gap * (0.7 + rng.nextDouble() * 0.6); gap *= 0.78; amp *= 0.74
                    }
                }
            }
            Sound.SPIN -> render(1.05, rng) { b ->
                // つめが歯車の歯をはじく。回る速さが落ちるにつれて間が開き、最後は止まる
                var t = 0.0
                var gap = 0.022
                var k = 0
                while (t < 0.95) {
                    val amp = 0.55 + 0.45 * (gap / 0.16).coerceAtMost(1.0)
                    b.strike(t, amp, 0.18, body(Triple(2700.0, 1.0, 0.014), Triple(4300.0, 0.7, 0.01), Triple(6600.0, 0.35, 0.007), Triple(1150.0, 0.5, 0.02), spread = 0.04), noise = 0.35, noiseHz = 4500.0)
                    if (k % 2 == 0) b.strike(t, amp * 0.4, 0.6, body(Triple(420.0, 1.0, 0.03), Triple(900.0, 0.5, 0.02)), noise = 0.1, noiseHz = 900.0)
                    t += gap; gap *= 1.115; k++
                }
            }
            Sound.CARD -> render(0.2, rng, room = 0.06) { b ->
                // 空気を切る短い「ス」のあと、紙が卓に着く「パサ」
                b.swish(0.0, j(0.055, 0.2), 2600.0, 5200.0, 0.9, 0.35)
                val at = j(0.045, 0.15)
                b.slap(at, 1.0, 0.012, 2300.0, 0.8)
                b.strike(at, 0.5, 1.4, felt() + body(Triple(420.0, 0.4, 0.03)), noise = 0.1, noiseHz = 600.0)
                // 反対の端が遅れて着く
                b.slap(at + j(0.018, 0.3), 0.3, 0.008, 3200.0, 0.9)
            }
            Sound.CARD_FLIP -> render(0.2, rng, room = 0.06) { b ->
                // 端をつまんで起こす「ペ」、返して着く「ラッ」
                b.slap(0.0, 0.55, 0.006, 3800.0, 1.2)
                b.swish(0.01, j(0.06, 0.2), 1800.0, 4200.0, 0.8, 0.3)
                val at = j(0.075, 0.12)
                b.slap(at, 1.0, 0.011, 2600.0, 0.8)
                b.strike(at, 0.4, 1.4, felt(), noise = 0.08, noiseHz = 600.0)
            }
            Sound.DEAL -> render(0.22, rng, room = 0.05) { b ->
                // 札が札の上をすべって、卓の上を走る
                b.swish(0.0, j(0.13, 0.15), 3000.0, 6500.0, 1.0, 1.0)
                b.swish(0.02, j(0.1, 0.15), 900.0, 1800.0, 0.7, 0.35)
                b.slap(j(0.115, 0.1), 0.35, 0.008, 2800.0, 0.9)
            }
            Sound.SHUFFLE -> render(1.1, rng, room = 0.07) { b ->
                // リフル: 2つの山の札が1枚ずつ、だんだん速くはじけ落ちる。そのあと山をそろえて卓に軽く当てる
                var t = 0.04
                var gap = 0.021
                var k = 0
                while (t < 0.5) {
                    val amp = 0.45 + rng.nextDouble() * 0.4
                    b.slap(t, amp, 0.004 + rng.nextDouble() * 0.003, 2600.0 + rng.nextDouble() * 2600.0, 1.0)
                    if (k % 4 == 0) b.strike(t, amp * 0.25, 1.0, felt(), noise = 0.05, noiseHz = 500.0)
                    t += gap * (0.6 + rng.nextDouble() * 0.8); gap = (gap * 0.955).coerceAtLeast(0.007); k++
                }
                // 山を押し込む「ザーッ」
                b.swish(0.56, 0.2, 2200.0, 5200.0, 0.9, 0.8)
                b.swish(0.58, 0.17, 700.0, 1500.0, 0.7, 0.3)
                // そろえて卓にトントン
                for (at in listOf(0.84, 0.95)) {
                    b.slap(at, 0.7, 0.01, 1900.0, 0.8)
                    b.strike(at, 0.7, 1.2, body(Triple(170.0, 1.0, 0.05), Triple(380.0, 0.6, 0.04), Triple(800.0, 0.3, 0.03)), noise = 0.1, noiseHz = 600.0)
                }
            }
            Sound.CHIP -> render(0.26, rng) { b ->
                // 陶器のチップが山に落ちて、2〜3回小さく当たる
                var t = 0.0
                var amp = 1.0
                for (k in 0 until 3) {
                    b.strike(t, amp, 0.09, body(Triple(3900.0, 1.0, 0.045), Triple(6200.0, 0.8, 0.032), Triple(9100.0, 0.5, 0.02), Triple(12400.0, 0.25, 0.012), spread = 0.07), noise = 0.25, noiseHz = 7000.0)
                    if (k == 0) b.strike(t, 0.4, 1.0, felt(), noise = 0.05, noiseHz = 500.0)
                    t += j(0.032, 0.3) * (1.0 - k * 0.25); amp *= 0.5
                }
            }
            Sound.HANA -> render(0.2, rng) { b ->
                // 厚く固い小さな札を、場の札にたたきつける。紙の鋭い「パチ」と、座布団ごしの低い音
                b.slap(0.0, 1.0, 0.007, 3400.0, 0.7)
                b.strike(0.0, 0.9, 0.2, body(Triple(1900.0, 1.0, 0.016), Triple(3100.0, 0.8, 0.012), Triple(4800.0, 0.5, 0.008)), noise = 0.4, noiseHz = 4200.0)
                b.strike(0.0, 0.8, 1.2, felt() + body(Triple(520.0, 0.3, 0.03)), noise = 0.1, noiseHz = 700.0)
                b.slap(j(0.012, 0.3), 0.25, 0.005, 4200.0, 1.0)
            }
            Sound.MJ -> render(0.24, rng) { b ->
                // 重い樹脂の牌をマットに打つ。牌は固く、高い響きがはっきり出る。卓の板が低く鳴る
                val tile = body(Triple(1750.0, 1.0, 0.03), Triple(2950.0, 0.9, 0.024), Triple(4700.0, 0.6, 0.016), Triple(7200.0, 0.3, 0.01))
                b.strike(0.0, 1.0, 0.2, tile, noise = 0.5, noiseHz = 3800.0)
                b.strike(0.0, 0.6, 0.8, body(Triple(190.0, 0.35, 0.06), Triple(380.0, 0.6, 0.05), Triple(760.0, 0.5, 0.035)), noise = 0.15, noiseHz = 700.0)
                // 指を離す時に牌が少し動く
                b.strike(j(0.02, 0.3), 0.18, 0.25, tile.take(2), noise = 0.2, noiseHz = 3500.0)
            }
            Sound.MJ_MIX -> render(1.2, rng, room = 0.08) { b ->
                // たくさんの牌がマットの上でぶつかり合う。始めと終わりは静か
                var t = 0.0
                while (t < 1.1) {
                    val x = t / 1.1
                    val env = sin(PI * x).pow(0.7)
                    val amp = env * (0.35 + rng.nextDouble() * 0.65)
                    b.strike(t, amp, 0.2, body(Triple(1700.0, 1.0, 0.022), Triple(2900.0, 0.9, 0.018), Triple(4600.0, 0.6, 0.012), Triple(7000.0, 0.3, 0.008), spread = 0.18), noise = 0.4, noiseHz = 3800.0)
                    t += 0.008 + rng.nextDouble() * 0.03
                }
                b.swish(0.0, 1.1, 500.0, 900.0, 0.6, 0.12)
            }
            Sound.CUTIN -> render(0.75, rng, room = 0.16) { b ->
                // 帯が入ってくる風切りの「シュッ」と、止まる所で拍子木の「カーン」
                b.swish(0.0, 0.2, 700.0, 5200.0, 1.4, 0.5)
                hyoshigi(b, 0.19, 1.0, ::j)
            }
            Sound.TURN -> render(0.9, rng, room = 0.12) { b ->
                // 小さな鈴(おりん)を軽く鳴らす。倍音が少しずれてうなる
                val f = 1318.5
                b.strike(0.0, 1.0, 0.5, listOf(Mode(f, 1.0, 0.75), Mode(f * 1.004, 0.5, 0.7), Mode(f * 2.76, 0.4, 0.4), Mode(f * 5.4, 0.2, 0.2), Mode(f * 8.9, 0.08, 0.1)), noise = 0.05, noiseHz = 5000.0)
            }
            Sound.KNOCK -> render(0.5, rng, room = 0.12) { b ->
                for ((at, amp) in listOf(0.0 to 0.9, 0.17 to 1.0)) {
                    b.strike(at, amp, 0.7, body(Triple(330.0, 0.5, 0.09), Triple(690.0, 0.9, 0.08), Triple(1380.0, 0.6, 0.05), Triple(2300.0, 0.3, 0.03)), noise = 0.3, noiseHz = 1800.0)
                }
            }
            Sound.COUNT -> render(0.2, rng, room = 0.08) { b ->
                // 木魚のような、中が空の木をたたく音
                b.strike(0.0, 1.0, 0.6, listOf(Mode(760.0, 1.0, 0.07), Mode(1560.0, 0.45, 0.04), Mode(2500.0, 0.2, 0.025), Mode(380.0, 0.3, 0.05)), noise = 0.2, noiseHz = 2000.0)
            }
            Sound.COUNT_LAST -> render(0.24, rng, room = 0.1) { b ->
                b.strike(0.0, 1.0, 0.3, listOf(Mode(1180.0, 1.0, 0.08), Mode(2420.0, 0.55, 0.05), Mode(3900.0, 0.3, 0.03), Mode(590.0, 0.3, 0.05)), noise = 0.3, noiseHz = 3000.0)
            }
            Sound.TIMEUP -> render(0.9, rng, room = 0.18) { b ->
                hyoshigi(b, 0.0, 0.8, ::j)
                hyoshigi(b, 0.15, 1.0, ::j)
            }
            Sound.WIN -> render(1.5, rng, room = 0.16) { b ->
                // マリンバで ド・ミ・ソ・ド と上がり、最後は和音
                val seq = listOf(523.25, 659.25, 783.99, 1046.5)
                seq.forEachIndexed { i, f -> marimba(b, i * 0.105, f, 0.8) }
                for (f in listOf(523.25, 783.99, 1318.5)) marimba(b, 0.52, f, 0.7)
            }
            Sound.LOSE -> render(1.3, rng, room = 0.16) { b ->
                listOf(783.99, 698.46, 587.33).forEachIndexed { i, f -> marimba(b, i * 0.2, f, 0.8) }
                marimba(b, 0.62, 392.0, 0.9)
            }
            Sound.DRAW -> render(1.0, rng, room = 0.14) { b ->
                marimba(b, 0.0, 523.25, 0.8); marimba(b, 0.2, 523.25, 0.7); marimba(b, 0.2, 392.0, 0.5)
            }
        }
    }

    /**
     * 本物の録音を測った値。高さの帯(100〜16000Hz を11に分けた帯。EDGES)ごとの強さ[dB]と、消える速さ[ミリ秒]。
     * tailDb・tailMs は、当たりのあとに小さく残る響き(盤や部屋)の大きさと長さ。fast は当たりの消える速さの倍率。
     * 録音そのものは使わず、測った値から計算で音を作る。資料と比べ方は asobi/docs/効果音の資料.md。
     */
    class Ref(val lev: DoubleArray, val tauMs: DoubleArray, val tailDb: Double, val tailMs: Double, val fast: Double) {
        /** 軽い当たり(低い音と響きを弱く) */
        fun lighter() = Ref(DoubleArray(lev.size) { if (it < 4) lev[it] - 8 else lev[it] }, tauMs, tailDb - 6, tailMs * 0.6, fast * 0.8)

        companion object {
            val EDGES = doubleArrayOf(100.0, 160.0, 250.0, 400.0, 630.0, 1000.0, 1600.0, 2500.0, 4000.0, 6300.0, 10000.0, 16000.0)
            val KOMA = Ref(doubleArrayOf(-26.7, -32.1, -30.2, -29.8, -27.9, -23.5, -19.1, -12.6, -6.2, -5.0, -4.4),
                doubleArrayOf(9.1, 17.8, 10.5, 3.9, 12.5, 1.1, 9.2, 3.0, 5.3, 3.5, 2.1), -17.0, 30.0, 1.0)
            val TAKE = Ref(doubleArrayOf(-7.8, -13.1, -19.6, -17.6, -19.9, -24.9, -16.3, -14.9, -11.2, -3.5, -8.0),
                doubleArrayOf(6.1, 9.0, 5.9, 2.8, 3.7, 3.3, 2.7, 5.3, 7.6, 3.5, 5.3), -14.0, 32.0, 0.5)
            val GO = Ref(doubleArrayOf(-15.3, -21.1, -23.3, -19.6, -13.2, -15.9, -11.0, -6.8, -3.7, -8.7, -17.1),
                doubleArrayOf(6.3, 6.4, 7.6, 5.7, 6.9, 6.7, 5.9, 7.4, 3.3, 3.0, 2.5), -14.0, 30.0, 0.6)
            val CHESS = Ref(doubleArrayOf(-28.5, -37.9, -19.6, -3.6, -3.2, -11.6, -26.1, -30.8, -44.6, -55.8, -60.0),
                doubleArrayOf(8.5, 2.6, 4.8, 2.2, 3.3, 5.1, 4.1, 5.2, 2.5, 2.4, 2.4), -13.0, 6.0, 0.55)
            val WOOD = Ref(doubleArrayOf(-21.0, -23.6, -16.8, -12.3, -7.3, -5.0, -4.1, -19.4, -29.2, -48.9, -58.0),
                doubleArrayOf(6.1, 4.6, 5.1, 3.2, 3.3, 4.1, 2.3, 8.3, 5.6, 2.7, 2.2), -24.0, 15.0, 1.0)
            /** 4kHz より上の3つの帯は録音にないので、碁石の録音の傾きを目安にした値 */
            val STONE = Ref(doubleArrayOf(-19.6, -20.7, -19.2, -15.8, -13.6, -8.6, -5.5, -3.4, -7.5, -12.5, -20.0),
                doubleArrayOf(9.0, 4.5, 2.5, 3.5, 5.3, 8.4, 4.5, 3.8, 3.3, 3.0, 2.5), -14.0, 24.0, 0.5)
            /** 線を引いている間の、帯ごとの強さ */
            val PEN_BANDS = doubleArrayOf(-30.0, -30.0, -28.0, -26.0, -20.0, -16.0, -17.0, -15.0, -9.5, -5.0, -4.0)
        }
    }

    /** 拍子木(固い樫の棒どうしを打つ): 高くよく通る「カーン」 */
    private fun hyoshigi(b: Buf, at: Double, amp: Double, j: (Double, Double) -> Double) {
        val bar = listOf(Mode(j(1980.0, 0.02), 1.0, 0.22), Mode(j(2140.0, 0.02), 0.7, 0.18), Mode(j(4350.0, 0.03), 0.6, 0.11), Mode(j(5200.0, 0.03), 0.4, 0.08),
            Mode(j(7900.0, 0.03), 0.3, 0.05), Mode(j(11000.0, 0.03), 0.15, 0.03))
        b.strike(at, amp, 0.09, bar, noise = 0.6, noiseHz = 6000.0)
    }

    /** マリンバの1音(柔らかいばちで木の板をたたく。基音・4倍・約9.2倍の響き) */
    private fun marimba(b: Buf, at: Double, f: Double, amp: Double) {
        val long = (0.75 * (440.0 / f).pow(0.4)).coerceIn(0.3, 0.95)
        b.strike(at, amp, 1.1, listOf(Mode(f, 1.0, long), Mode(f * 3.98, 0.3, long * 0.25), Mode(f * 9.2, 0.1, long * 0.1)), noise = 0.12, noiseHz = 1800.0)
    }

    /** 音を足し込む入れ物 */
    class Buf(val n: Int, private val rng: Random) {
        val d = DoubleArray(n)

        /**
         * 物が当たる音を足す。at 秒後に、長さ contactMs[ミリ秒] の力(山なりの形)で modes の共鳴をたたく。
         * 力が短い(固い物どうし)ほど高い共鳴までよく鳴り、長い(柔らかい)と高い音は出ない。本物と同じ理屈。
         * noise は当たった瞬間の雑音(noiseHz 付近)。
         */
        fun strike(at: Double, amp: Double, contactMs: Double, modes: List<Mode>, noise: Double = 0.0, noiseHz: Double = 3000.0) {
            val start = (at * RATE).toInt()
            if (start >= n || amp <= 0.0) return
            val len = maxOf(2, (contactMs * RATE / 1000).toInt())
            val area = len / 2.0
            for (m in modes) {
                val f = m.f.coerceAtMost(RATE * 0.45)
                val w = 2 * PI * f / RATE
                val r = exp(-6.91 / (m.t60 * RATE))
                val c1 = 2 * r * cos(w)
                val c2 = r * r
                val g = amp * m.a * sin(w) / area
                var y1 = 0.0
                var y2 = 0.0
                val total = minOf(n - start, (m.t60 * RATE * 1.15).toInt() + len)
                for (i in 0 until total) {
                    val x = if (i < len) 0.5 * (1 - cos(2 * PI * i / len)) else 0.0
                    val y = c1 * y1 - c2 * y2 + x
                    y2 = y1; y1 = y
                    d[start + i] += g * y
                }
            }
            if (noise > 0) {
                val bp = Biquad.bandpass(noiseHz, 0.8)
                val decay = maxOf(contactMs * 1.6 / 1000, 0.0006) * RATE
                val total = minOf(n - start, (decay * 7).toInt())
                for (i in 0 until total) {
                    val env = (if (i < len / 2) i / (len / 2.0) else 1.0) * exp(-i / decay)
                    d[start + i] += amp * noise * 1.6 * bp.process(rng.nextDouble() * 2 - 1) * env
                }
            }
        }

        /**
         * 録音を測った値(Ref)どおりの当たりを足す。帯ごとに、消える速さの違う響きをいくつも重ねて、
         * 帯の強さが測った値になるようにする。そのあとに小さく長く残る響きを足す。pitch は高さの倍率(版ごとに少し変える)。
         */
        fun matched(at: Double, amp: Double, ref: Ref, pitch: Double = 1.0, modes: Int = 6) {
            val start = (at * RATE).toInt()
            if (start >= n) return
            val len = minOf(n - start, ((ref.tailMs / 1000 * 7 + 0.03) * RATE).toInt())
            val t = DoubleArray(len)
            fun add(f0: Double, a: Double, tau: Double) {
                val f = (f0 * pitch).coerceAtMost(RATE * 0.46)
                val w = 2 * PI * f / RATE
                val ph = rng.nextDouble() * 2 * PI
                val m = minOf(len, (tau * 8 * RATE).toInt())
                val k = exp(-1.0 / (tau * RATE))
                var e = a
                for (i in 0 until m) { t[i] += e * sin(w * i + ph) * (if (i < 11) i / 11.0 else 1.0); e *= k }
            }
            for (b in ref.lev.indices) {
                if (ref.lev[b] < -45) continue
                val energy = 10.0.pow(ref.lev[b] / 10)
                val lo = Ref.EDGES[b]; val hi = Ref.EDGES[b + 1]
                for (k in 0 until modes) {
                    val f = lo * (hi / lo).pow((k + rng.nextDouble()) / modes)
                    val tau = ref.tauMs[b] / 1000 * ref.fast * (0.55 + rng.nextDouble() * 0.95)
                    val a = sqrt(2 * energy / (modes * tau))
                    add(f, a, tau)
                    // 響き: 高い音ほど早く消える
                    val f2 = lo * (hi / lo).pow(rng.nextDouble())
                    val tt = ref.tailMs / 1000 * (0.7 + rng.nextDouble() * 0.6) * minOf(1.0, (2500 / f2).pow(0.35))
                    add(f2, a * 10.0.pow(ref.tailDb / 20), tt)
                }
            }
            var peak = 1e-9
            for (v in t) if (abs(v) > peak) peak = abs(v)
            for (i in 0 until len) d[start + i] += amp * t[i] / peak
        }

        /**
         * 鉛筆の線: 帯ごとの強さ(bands[dB])に合わせた雑音。書き始めにすっと立ち上がり、終わりで力が抜ける。
         * 紙の繊維に引っかかるたびに、少し強くなる(細かい揺れ)。
         */
        fun stroke(at: Double, seconds: Double, bands: DoubleArray) {
            val start = (at * RATE).toInt()
            val total = minOf(n - start, (seconds * RATE).toInt())
            if (total <= 0) return
            val filters = bands.indices.map { Biquad.bandpass(sqrt(Ref.EDGES[it] * Ref.EDGES[it + 1]), 1.6) }
            val gains = bands.map { 10.0.pow(it / 20) }
            var grain = 0.0
            var slow = 0.0
            for (i in 0 until total) {
                val x = i.toDouble() / total
                val env = (if (x < 0.06) x / 0.06 else 1.0) * (if (x > 0.72) ((1 - x) / 0.28).pow(1.3) else 1.0)
                if (rng.nextDouble() < 700.0 / RATE) grain = 0.5 + rng.nextDouble() * 0.9
                grain *= 0.9
                // 手の速さのゆっくりした揺れ
                slow += (rng.nextDouble() * 2 - 1 - slow) * 0.002
                val white = rng.nextDouble() * 2 - 1
                var v = 0.0
                for (k in filters.indices) v += gains[k] * filters[k].process(white)
                d[start + i] += v * env * (0.55 + grain) * (1 + slow * 6).coerceIn(0.5, 1.5)
            }
        }

        /** 紙が当たる「パサッ」「パチ」: hz 付近の雑音が、すぐ立ち上がって decay[秒] で消える。q が小さいほど幅広い音 */
        fun slap(at: Double, amp: Double, decay: Double, hz: Double, q: Double) {
            val start = (at * RATE).toInt()
            if (start >= n) return
            val bp = Biquad.bandpass(hz, q)
            val hp = Biquad.highpass(500.0, 0.7)
            val total = minOf(n - start, (decay * 8 * RATE).toInt())
            val rise = (0.0004 * RATE)
            for (i in 0 until total) {
                val env = minOf(1.0, i / rise) * exp(-i / (decay * RATE))
                d[start + i] += amp * 2.2 * hp.process(bp.process(rng.nextDouble() * 2 - 1)) * env
            }
        }

        /** 空気や紙がこすれる「シュッ」: 雑音の高さが f0 から f1 へ動く。山なりに大きくなって消える */
        fun swish(at: Double, seconds: Double, f0: Double, f1: Double, q: Double, amp: Double) {
            val start = (at * RATE).toInt()
            val total = minOf(n - start, (seconds * RATE).toInt())
            if (total <= 0) return
            var bp = Biquad.bandpass(f0, q)
            var x1 = 0.0; var x2 = 0.0; var y1 = 0.0; var y2 = 0.0
            for (i in 0 until total) {
                val x = i.toDouble() / total
                if (i % 32 == 0) bp = Biquad.bandpass(f0 * (f1 / f0).pow(x), q)
                val env = sin(PI * x).pow(1.4)
                val white = rng.nextDouble() * 2 - 1
                // フィルタの係数だけ入れ替えて、状態は引き継ぐ(切り替えで「プチ」と鳴らないように)
                val y = bp.b0 * white + bp.b1 * x1 + bp.b2 * x2 - bp.a1 * y1 - bp.a2 * y2
                x2 = x1; x1 = white; y2 = y1; y1 = y
                d[start + i] += amp * 2.0 * y * env
            }
        }
    }

    private fun render(seconds: Double, rng: Random, room: Double = 0.1, block: (Buf) -> Unit): ShortArray {
        val b = Buf((seconds * RATE).toInt(), rng)
        block(b)
        return finish(b.d, rng, room)
    }

    /**
     * 鉛筆と紙のこすれ: 紙の繊維に引っかかる細かい当たり(不規則な間隔)を、紙の高い音域だけ通して重ねる。
     * 書き始めと終わりは力が弱い(音が小さい)。
     */
    private fun scratch(seconds: Double, rng: Random, density: Double, center: Double, bodyAmount: Double): DoubleArray {
        val n = (seconds * RATE).toInt()
        val d = DoubleArray(n)
        val bp1 = Biquad.bandpass(center, 1.1)
        val bp2 = Biquad.bandpass(center * 1.7, 1.4)
        val hp = Biquad.highpass(1800.0, 0.7)
        val lp1 = Biquad.lowpass(7000.0, 0.7)
        val lp2 = Biquad.lowpass(7000.0, 0.7)
        var grain = 0.0
        for (i in 0 until n) {
            val x = i.toDouble() / n
            val env = sqrt(sin(PI * x).coerceAtLeast(0.0)) * (if (x < 0.08) x / 0.08 else 1.0)
            if (rng.nextDouble() < density / RATE) grain = 0.6 + rng.nextDouble() * 0.6
            grain *= 0.86
            val white = rng.nextDouble() * 2 - 1
            val v = bp1.process(white * (bodyAmount + grain)) + 0.5 * bp2.process(white * grain)
            d[i] = lp2.process(lp1.process(hp.process(v))) * env
        }
        return d
    }

    /**
     * 仕上げ: 部屋の短い響き(机や壁からのはね返り)を少し足し、低すぎる音と高すぎる音を落とし、
     * 最大の大きさをそろえて 16bit にする。room は響きの量(0 = なし)。
     */
    private fun finish(dry: DoubleArray, rng: Random, room: Double): ShortArray {
        val tail = if (room > 0) (0.16 * RATE).toInt() else (0.01 * RATE).toInt()
        val n = dry.size + tail
        val d = DoubleArray(n)
        dry.copyInto(d, 0, 0, dry.size)
        if (room > 0) {
            // はね返り(机の面・近くの壁): 数ミリ秒〜数十ミリ秒おくれた、こもった小さな写し
            val lp = Biquad.lowpass(3800.0, 0.7)
            val soft = DoubleArray(dry.size) { lp.process(dry[it]) }
            val taps = listOf(0.0043 to 0.55, 0.0091 to 0.4, 0.0157 to 0.32, 0.0238 to 0.25, 0.0343 to 0.18, 0.0477 to 0.13, 0.0631 to 0.09, 0.0832 to 0.06, 0.109 to 0.04)
            for ((sec, g) in taps) {
                val off = (sec * (0.9 + rng.nextDouble() * 0.2) * RATE).toInt()
                for (i in soft.indices) if (i + off < n) d[i + off] += soft[i] * g * room * 2.2
            }
        }
        val hp = Biquad.highpass(70.0, 0.7)
        val lp = Biquad.lowpass(15000.0, 0.7)
        val fade = (0.006 * RATE).toInt().coerceAtLeast(1)
        var peak = 1e-9
        for (i in 0 until n) {
            var v = lp.process(hp.process(d[i]))
            if (i > n - fade) v *= (n - i).toDouble() / fade
            d[i] = v
            if (abs(v) > peak) peak = abs(v)
        }
        val k = 0.88 / peak
        return ShortArray(n) {
            // とがった所だけ少し丸める(割れた音にしない)
            val v = d[it] * k
            val s = if (abs(v) > 0.7) (if (v > 0) 1 else -1) * (0.7 + (abs(v) - 0.7) * 0.6) else v
            (s * 32767).toInt().coerceIn(-32767, 32767).toShort()
        }
    }

    /** 2次の IIR フィルタ(RBJ の式) */
    class Biquad(val b0: Double, val b1: Double, val b2: Double, val a1: Double, val a2: Double) {
        private var x1 = 0.0
        private var x2 = 0.0
        private var y1 = 0.0
        private var y2 = 0.0
        fun process(x: Double): Double {
            val y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = x; y2 = y1; y1 = y
            return y
        }

        companion object {
            fun bandpass(f: Double, q: Double): Biquad {
                val w = 2 * PI * f.coerceAtMost(RATE * 0.45) / RATE
                val alpha = sin(w) / (2 * q)
                val a0 = 1 + alpha
                return Biquad(alpha / a0, 0.0, -alpha / a0, -2 * cos(w) / a0, (1 - alpha) / a0)
            }

            fun lowpass(f: Double, q: Double): Biquad {
                val w = 2 * PI * f / RATE
                val alpha = sin(w) / (2 * q)
                val c = cos(w)
                val a0 = 1 + alpha
                return Biquad((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0)
            }

            fun highpass(f: Double, q: Double): Biquad {
                val w = 2 * PI * f / RATE
                val alpha = sin(w) / (2 * q)
                val c = cos(w)
                val a0 = 1 + alpha
                return Biquad((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0)
            }
        }
    }
}
