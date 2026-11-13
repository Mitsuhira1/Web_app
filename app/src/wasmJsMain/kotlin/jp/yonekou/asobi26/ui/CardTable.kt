package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxWithConstraintsScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * カードゲームの卓の共通部品(0.4.12 の見本どおり)。
 * 席は「顔の丸+名札」で見せ、枚数・組の数は赤いバッジ、身分は黄色の札、パスは吹き出しで出す。
 * 下のボタンは場所を固定し、使えない時は消さずに暗くする。
 */

/** プレイヤーのアイコン(写真)。設定で選ぶ。null なら決まった絵 */
val LocalAvatar = staticCompositionLocalOf<ImageBitmap?> { null }

private val CPU_FACE = listOf(Color(0xFF3A7BE0), Color(0xFFE0703A), Color(0xFF8A5AD0), Color(0xFF2FA36C), Color(0xFFC0902A))
private val TABLE_WOOD = Color(0xFF5A3A22)
private val FELT_TOP = Color(0xFF2C6B4D)
private val FELT_BOTTOM = Color(0xFF1F5139)
val BADGE_RED = Color(0xFFC8322B)

/** 顔の丸。人は写真(なければ人の絵)、CPU は色ちがいの人の絵、ディーラーは帽子の絵 */
@Composable
fun PlayerFace(avatar: ImageBitmap?, human: Boolean, cpuIndex: Int, size: Dp, ring: Boolean = false, dealer: Boolean = false) {
    val border = if (ring) ACCENT else Color.White
    Box(
        Modifier.size(size).then(if (ring) Modifier.background(ACCENT.copy(alpha = 0.35f), CircleShape).padding(3.dp) else Modifier)
            .clip(CircleShape).border(if (ring) 3.dp else 2.5.dp, border, CircleShape)
            .background(
                when {
                    dealer -> Color(0xFF2B2F45)
                    human -> ACCENT
                    else -> CPU_FACE[cpuIndex.mod(CPU_FACE.size)]
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (human && avatar != null) {
            Image(avatar, contentDescription = "あなたのアイコン", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(CircleShape))
        } else {
            Icon(if (dealer) AppIcons.Dealer else AppIcons.Person, contentDescription = null, tint = if (human) Color(0xFF3A2400) else Color.White, modifier = Modifier.size(size * 0.62f))
        }
    }
}

/**
 * 卓の上の席。x は中心、y は上の端(どちらも卓の左上から)。
 * badge: 赤い丸の数字(残りの枚数・取った組など)、title: 黄色の札(身分など)、bubble: 吹き出し(パスなど)。
 */
@Composable
fun TableSeat(
    x: Dp, y: Dp, name: String, human: Boolean, cpuIndex: Int, turn: Boolean,
    badge: String? = null, title: String? = null, bubble: String? = null, dim: Boolean = false, dealer: Boolean = false,
    face: Dp = 38.dp, width: Dp = 96.dp, extra: (@Composable () -> Unit)? = null, photo: Boolean = true,
) {
    val avatar = if (photo) LocalAvatar.current else null
    Box(Modifier.offset(x - width / 2, y).width(width), contentAlignment = Alignment.TopCenter) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Box(Modifier.padding(top = 4.dp)) {
                Box(Modifier.then(if (dim) Modifier.background(Color.Transparent) else Modifier)) {
                    PlayerFace(avatar, human, cpuIndex, face, ring = turn, dealer = dealer)
                }
                if (badge != null) {
                    // 残りの枚数は「札の束の絵+数字」(何の数字か見て分かるように)
                    Row(
                        Modifier.align(Alignment.TopEnd).offset(24.dp, (-4).dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Canvas(Modifier.size(15.dp, 19.dp)) {
                            val cw = size.width * 0.72f; val ch = size.height * 0.8f
                            for ((k, dx) in listOf(0f, size.width * 0.28f).withIndex()) {
                                val tl = Offset(dx, if (k == 0) size.height * 0.2f else 0f)
                                drawRoundRect(Color.White, tl, Size(cw, ch), CornerRadius(2f))
                                drawRoundRect(Color(0xFF8E2F3C), tl + Offset(1.5f, 1.5f), Size(cw - 3f, ch - 3f), CornerRadius(1.5f))
                            }
                        }
                        Text(
                            badge, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1,
                            modifier = Modifier.padding(start = 1.dp).clip(RoundedCornerShape(7.dp)).background(Color(0xCC1A1410)).padding(horizontal = 4.dp),
                        )
                    }
                }
                if (title != null) {
                    Text(
                        title, color = Color(0xFF3A2400), fontSize = 9.sp, fontWeight = FontWeight.Black, maxLines = 1,
                        modifier = Modifier.align(Alignment.TopStart).offset((-12).dp, (-8).dp).clip(RoundedCornerShape(6.dp)).background(ACCENT)
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                    )
                }
            }
            Text(
                (if (turn) "▶ " else "") + name, color = if (turn) Color(0xFF1A2140) else Color.White.copy(alpha = if (dim) 0.5f else 1f), fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(if (turn) ACCENT else Color(0x8C000000)).padding(horizontal = 8.dp, vertical = 2.dp),
            )
            extra?.invoke()
        }
        if (bubble != null) {
            Text(
                bubble, color = Color(0xFF1A2140), fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1,
                modifier = Modifier.offset(y = (-16).dp).clip(RoundedCornerShape(8.dp)).background(Color.White).padding(horizontal = 7.dp, vertical = 2.dp),
            )
        }
    }
}

/** 残りのパスの白い点(白 = まだ使える) */
@Composable
fun PassDots(left: Int, total: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (i in 0 until total) Box(Modifier.size(7.dp).clip(CircleShape).background(if (i < left) Color.White else Color.White.copy(alpha = 0.25f)))
    }
}

/** 木の縁と緑のフェルトの卓(四角)。中は BoxWithConstraints で、席を dp で置ける */
@Composable
fun CardTableBox(modifier: Modifier = Modifier, content: @Composable BoxWithConstraintsScope.() -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(18.dp)).background(TABLE_WOOD).padding(7.dp).clip(RoundedCornerShape(13.dp))
            .background(Brush.verticalGradient(listOf(FELT_TOP, FELT_BOTTOM))),
    ) {
        BoxWithConstraints(Modifier.fillMaxSize()) { content() }
    }
}

/** 下の操作ボタン1つ分 */
class CardBtn(val label: String, val enabled: Boolean, val primary: Boolean = false, val color: Color? = null, val onClick: () -> Unit)

/** 下の操作ボタン(場所は固定。使えない時は暗くする) */
@Composable
fun CardButtonRow(buttons: List<CardBtn>) {
    val c = LocalAsobi.current
    Row(Modifier.fillMaxWidth().height(62.dp).padding(top = 8.dp, bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (b in buttons) {
            val on = b.enabled
            Box(
                Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(14.dp))
                    .background(
                        when {
                            on && b.color != null -> Brush.horizontalGradient(listOf(b.color, b.color))
                            on && b.primary -> AccentBrush
                            on -> Brush.horizontalGradient(listOf(c.chip, c.chip))
                            else -> Brush.horizontalGradient(listOf(c.chip.copy(alpha = 0.45f), c.chip.copy(alpha = 0.45f)))
                        },
                    )
                    .clickable(enabled = on, role = Role.Button) { b.onClick() },
                contentAlignment = Alignment.Center,
            ) {
                // 字が入りきらない時は小さくする(切らない)
                FitText(b.label, if (on && b.color != null) Color.White else if (on && b.primary) c.onAccent else if (on) c.ink else c.sub.copy(alpha = 0.6f), FontWeight.Black, 15f, 10f, maxLines = 2, modifier = Modifier.padding(horizontal = 4.dp))
            }
        }
    }
}

/** 札の合計などを出す白い丸(bust なら赤) */
fun DrawScope.totalBubble(tm: TextMeasurer, c: Offset, r: Float, text: String, bust: Boolean = false) {
    if (r <= 0.5f) return
    drawCircle(Color.Black.copy(alpha = 0.3f), r, c + Offset(0f, r * 0.12f))
    drawCircle(if (bust) BADGE_RED else Color.White, r, c)
    val lay = tm.measure(text, TextStyle(color = if (bust) Color.White else Color(0xFF1A2140), fontSize = (r * 0.85f / density).sp, fontWeight = FontWeight.Black))
    drawText(lay, topLeft = c - Offset(lay.size.width / 2f, lay.size.height / 2f))
}

/** チップの印(縁の白い切れ込み) */
fun DrawScope.chipMark(c: Offset, r: Float, color: Color = BADGE_RED) {
    if (r <= 0.5f) return
    drawCircle(Color.Black.copy(alpha = 0.3f), r, c + Offset(0f, r * 0.15f))
    drawCircle(color, r, c)
    drawCircle(Color.White, r * 0.75f, c, style = Stroke(r * 0.28f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(r * 0.5f, r * 0.42f))))
}

/** 卓の上に短く出す札(当たり・革命中など) */
fun DrawScope.tableBanner(tm: TextMeasurer, center: Offset, text: String, bg: Color, fg: Color, size: Float = 13f) {
    val lay = tm.measure(text, TextStyle(color = fg, fontSize = size.sp, fontWeight = FontWeight.Black))
    val w = lay.size.width + 28f
    val h = lay.size.height + 10f
    drawRoundRect(bg, center - Offset(w / 2, h / 2), androidx.compose.ui.geometry.Size(w, h), androidx.compose.ui.geometry.CornerRadius(h / 2))
    drawText(lay, topLeft = center - Offset(lay.size.width / 2f, lay.size.height / 2f))
}
