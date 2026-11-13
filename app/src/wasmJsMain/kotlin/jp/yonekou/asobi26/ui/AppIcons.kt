package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * 自作のアイコン(material-icons-extended を入れずに軽く保つため)。24×24、線の太さ2、端は丸。
 */
object AppIcons {
    private fun stroke(name: String, block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit): ImageVector =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
            path(
                fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, pathBuilder = block,
            )
        }.build()

    /** 待った(左向きに戻る矢印) */
    val Undo: ImageVector = stroke("Undo") {
        moveTo(9f, 14f)
        lineTo(4f, 9f)
        lineTo(9f, 4f)
        moveTo(4f, 9f)
        horizontalLineTo(14.5f)
        curveTo(17.5f, 9f, 20f, 11.5f, 20f, 14.5f)
        curveTo(20f, 17.5f, 17.5f, 20f, 14.5f, 20f)
        horizontalLineTo(11f)
    }

    /** チャット(吹き出しと2本の線) */
    val Chat: ImageVector = stroke("Chat") {
        moveTo(4f, 5f); horizontalLineTo(20f); verticalLineTo(16f); horizontalLineTo(11f); lineTo(6f, 20f); verticalLineTo(16f); horizontalLineTo(4f); close()
        moveTo(8f, 9.5f); horizontalLineTo(16f)
        moveTo(8f, 12.5f); horizontalLineTo(13f)
    }

    /** 閉じる(×) */
    val Close: ImageVector = stroke("Close") {
        moveTo(6f, 6f); lineTo(18f, 18f)
        moveTo(18f, 6f); lineTo(6f, 18f)
    }

    /** CPUの番をとばす(右向きの二重の矢じり) */
    val SkipCpu: ImageVector = stroke("SkipCpu") {
        moveTo(5f, 6f); lineTo(11f, 12f); lineTo(5f, 18f)
        moveTo(13f, 6f); lineTo(19f, 12f); lineTo(13f, 18f)
    }

    /** ルール(開いた本) */
    val Rules: ImageVector = stroke("Rules") {
        moveTo(12f, 6.5f)
        curveTo(10f, 5f, 7f, 4.5f, 3f, 5f)
        verticalLineTo(18.5f)
        curveTo(7f, 18f, 10f, 18.5f, 12f, 20f)
        curveTo(14f, 18.5f, 17f, 18f, 21f, 18.5f)
        verticalLineTo(5f)
        curveTo(17f, 4.5f, 14f, 5f, 12f, 6.5f)
        close()
        moveTo(12f, 6.5f)
        verticalLineTo(20f)
    }

    /** 最初から(丸い矢印) */
    val Restart: ImageVector = stroke("Restart") {
        moveTo(20f, 12f)
        curveTo(20f, 16.4f, 16.4f, 20f, 12f, 20f)
        curveTo(7.6f, 20f, 4f, 16.4f, 4f, 12f)
        curveTo(4f, 7.6f, 7.6f, 4f, 12f, 4f)
        curveTo(14.8f, 4f, 17.2f, 5.4f, 18.6f, 7.6f)
        moveTo(19f, 3.5f)
        verticalLineTo(8f)
        horizontalLineTo(14.5f)
    }

    private fun filled(name: String, block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit): ImageVector =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
            path(fill = SolidColor(Color.Black), pathBuilder = block)
        }.build()

    /** 戻る(左向きの山形) */
    val Back: ImageVector = stroke("Back") {
        moveTo(15f, 5f); lineTo(8f, 12f); lineTo(15f, 19f)
    }

    /** 設定(8つの歯がある歯車。真ん中に穴) */
    val Settings: ImageVector = ImageVector.Builder("Settings", 24.dp, 24.dp, 24f, 24f).apply {
        path(fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd) {
            val teeth = 8
            val outer = 10.6f
            val inner = 7.9f
            for (i in 0 until teeth) {
                val base = i * 2 * PI / teeth
                val half = PI / teeth
                // 歯の根もと → 歯の先(少し細く) → 歯の先 → 根もと
                val pts = listOf(
                    inner to base - half * 0.62,
                    outer to base - half * 0.42,
                    outer to base + half * 0.42,
                    inner to base + half * 0.62,
                )
                for ((j, p) in pts.withIndex()) {
                    val x = 12f + p.first * cos(p.second).toFloat()
                    val y = 12f + p.first * sin(p.second).toFloat()
                    if (i == 0 && j == 0) moveTo(x, y) else lineTo(x, y)
                }
                // 次の歯までは内側の円に沿う
                val next = (i + 1) * 2 * PI / teeth - half * 0.62
                val steps = 3
                for (k in 1..steps) {
                    val ang = base + half * 0.62 + (next - (base + half * 0.62)) * k / steps
                    lineTo(12f + inner * cos(ang).toFloat(), 12f + inner * sin(ang).toFloat())
                }
            }
            close()
            // 真ん中の穴
            val r = 3.3f
            moveTo(12f + r, 12f)
            for (k in 1..24) {
                val ang = k * 2 * PI / 24
                lineTo(12f + r * cos(ang).toFloat(), 12f + r * sin(ang).toFloat())
            }
            close()
        }
    }.build()

    /** ゲーム(4つの箱) */
    val Games: ImageVector = filled("Games") {
        moveTo(4f, 4f); horizontalLineTo(10.5f); verticalLineTo(10.5f); horizontalLineTo(4f); close()
        moveTo(13.5f, 4f); horizontalLineTo(20f); verticalLineTo(10.5f); horizontalLineTo(13.5f); close()
        moveTo(4f, 13.5f); horizontalLineTo(10.5f); verticalLineTo(20f); horizontalLineTo(4f); close()
        moveTo(13.5f, 13.5f); horizontalLineTo(20f); verticalLineTo(20f); horizontalLineTo(13.5f); close()
    }

    /** プレイヤー(1人。席の顔の丸に使う) */
    val Person: ImageVector = stroke("Person") {
        moveTo(15.5f, 8.5f); curveTo(15.5f, 10.43f, 13.93f, 12f, 12f, 12f); curveTo(10.07f, 12f, 8.5f, 10.43f, 8.5f, 8.5f)
        curveTo(8.5f, 6.57f, 10.07f, 5f, 12f, 5f); curveTo(13.93f, 5f, 15.5f, 6.57f, 15.5f, 8.5f); close()
        moveTo(5f, 20f); curveTo(5f, 16.5f, 8f, 14.5f, 12f, 14.5f); curveTo(16f, 14.5f, 19f, 16.5f, 19f, 20f)
    }

    /** ディーラー(帽子をかぶった人) */
    val Dealer: ImageVector = stroke("Dealer") {
        moveTo(15.5f, 10f); curveTo(15.5f, 11.93f, 13.93f, 13.5f, 12f, 13.5f); curveTo(10.07f, 13.5f, 8.5f, 11.93f, 8.5f, 10f)
        moveTo(6.5f, 8.5f); horizontalLineTo(17.5f)
        moveTo(9f, 8.5f); verticalLineTo(4f); horizontalLineTo(15f); verticalLineTo(8.5f)
        moveTo(5f, 21f); curveTo(5f, 17.5f, 8f, 15.5f, 12f, 15.5f); curveTo(16f, 15.5f, 19f, 17.5f, 19f, 21f)
    }

    /** みんなで遊ぶ(2人) */
    val People: ImageVector = stroke("People") {
        moveTo(12.5f, 9f); curveTo(12.5f, 10.93f, 10.93f, 12.5f, 9f, 12.5f); curveTo(7.07f, 12.5f, 5.5f, 10.93f, 5.5f, 9f)
        curveTo(5.5f, 7.07f, 7.07f, 5.5f, 9f, 5.5f); curveTo(10.93f, 5.5f, 12.5f, 7.07f, 12.5f, 9f); close()
        moveTo(3f, 20f); curveTo(3f, 16.5f, 6f, 14.5f, 9f, 14.5f); curveTo(12f, 14.5f, 15f, 16.5f, 15f, 20f)
        moveTo(19.5f, 10f); curveTo(19.5f, 11.38f, 18.38f, 12.5f, 17f, 12.5f); curveTo(15.62f, 12.5f, 14.5f, 11.38f, 14.5f, 10f)
        curveTo(14.5f, 8.62f, 15.62f, 7.5f, 17f, 7.5f); curveTo(18.38f, 7.5f, 19.5f, 8.62f, 19.5f, 10f); close()
        moveTo(15.5f, 15.5f); curveTo(18.5f, 15.5f, 21f, 17f, 21f, 20f)
    }

    /** 成績(棒グラフ) */
    val Stats: ImageVector = stroke("Stats") {
        moveTo(5f, 20f); verticalLineTo(11f); moveTo(10f, 20f); verticalLineTo(5f); moveTo(15f, 20f); verticalLineTo(13f)
        moveTo(20f, 20f); verticalLineTo(8f); moveTo(2.5f, 20.5f); horizontalLineTo(21.5f)
    }

    /** 再生(続きから) */
    val Play: ImageVector = filled("Play") {
        moveTo(8f, 5f); lineTo(19f, 12f); lineTo(8f, 19f); close()
    }

    /** 近くの人(電波) */
    val Nearby: ImageVector = stroke("Nearby") {
        moveTo(13.2f, 12f); curveTo(13.2f, 12.66f, 12.66f, 13.2f, 12f, 13.2f); curveTo(11.34f, 13.2f, 10.8f, 12.66f, 10.8f, 12f)
        curveTo(10.8f, 11.34f, 11.34f, 10.8f, 12f, 10.8f); curveTo(12.66f, 10.8f, 13.2f, 11.34f, 13.2f, 12f); close()
        moveTo(7.8f, 7.8f); curveTo(5.5f, 10.1f, 5.5f, 13.9f, 7.8f, 16.2f)
        moveTo(16.2f, 7.8f); curveTo(18.5f, 10.1f, 18.5f, 13.9f, 16.2f, 16.2f)
        moveTo(5f, 5f); curveTo(1.1f, 8.9f, 1.1f, 15.1f, 5f, 19f)
        moveTo(19f, 5f); curveTo(22.9f, 8.9f, 22.9f, 15.1f, 19f, 19f)
    }

    /** オンライン(地球) */
    val Globe: ImageVector = stroke("Globe") {
        moveTo(21f, 12f); curveTo(21f, 16.97f, 16.97f, 21f, 12f, 21f); curveTo(7.03f, 21f, 3f, 16.97f, 3f, 12f)
        curveTo(3f, 7.03f, 7.03f, 3f, 12f, 3f); curveTo(16.97f, 3f, 21f, 7.03f, 21f, 12f); close()
        moveTo(3f, 12f); horizontalLineTo(21f)
        moveTo(12f, 3f); curveTo(14.8f, 6f, 14.8f, 18f, 12f, 21f)
        moveTo(12f, 3f); curveTo(9.2f, 6f, 9.2f, 18f, 12f, 21f)
    }

    /** 参加(入る矢印) */
    val Enter: ImageVector = stroke("Enter") {
        moveTo(10f, 4f); horizontalLineTo(6f); curveTo(4.9f, 4f, 4f, 4.9f, 4f, 6f); verticalLineTo(18f); curveTo(4f, 19.1f, 4.9f, 20f, 6f, 20f); horizontalLineTo(10f)
        moveTo(14f, 8f); lineTo(18f, 12f); lineTo(14f, 16f); moveTo(18f, 12f); horizontalLineTo(9f)
    }

    /** 役(サイコロ) */
    val Dice: ImageVector = stroke("Dice") {
        moveTo(7f, 4f); horizontalLineTo(17f); curveTo(18.7f, 4f, 20f, 5.3f, 20f, 7f); verticalLineTo(17f); curveTo(20f, 18.7f, 18.7f, 20f, 17f, 20f)
        horizontalLineTo(7f); curveTo(5.3f, 20f, 4f, 18.7f, 4f, 17f); verticalLineTo(7f); curveTo(4f, 5.3f, 5.3f, 4f, 7f, 4f); close()
        moveTo(9f, 9f); lineTo(9.01f, 9f); moveTo(15f, 9f); lineTo(15.01f, 9f); moveTo(12f, 12f); lineTo(12.01f, 12f)
        moveTo(9f, 15f); lineTo(9.01f, 15f); moveTo(15f, 15f); lineTo(15.01f, 15f)
    }
}
