package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import jp.yonekou.asobi26.audio.Sfx
import jp.yonekou.asobi26.audio.Sound
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 効果音(MainActivity で配る) */
val LocalSfx = staticCompositionLocalOf<Sfx?> { null }

/**
 * ボタンのタップ音(アプリで作った柔らかい音)。端末の「タッチ操作音」の設定には従わず、
 * アプリの「効果音」の設定(Sfx.enabled)だけで鳴らす/鳴らさないを決める。引数は前の版との互換のため。
 */
@Composable
@Suppress("UNUSED_PARAMETER")
fun rememberTap(enabled: Boolean): () -> Unit {
    val sfx = LocalSfx.current
    return remember(sfx) { { sfx?.play(Sound.TAP) } }
}

/** 戻る時の音(タップより少し低く柔らかい) */
@Composable
fun rememberBackTap(): () -> Unit {
    val sfx = LocalSfx.current
    return remember(sfx) { { sfx?.play(Sound.BACK) } }
}

/** 画面の地(上から下へのグラデーション) */
fun Modifier.screenBackground(c: AsobiColors): Modifier = this.background(c.background)

/** 角丸の小さなアイコンボタン(戻る・ルール・待った など) */
@Composable
fun IconChip(icon: ImageVector, label: String, enabled: Boolean = true, onClick: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(14.dp)
    val base = Modifier.size(44.dp).clip(shape).background(c.chip).border(1.dp, c.line, shape)
    Box(
        base.clickable(enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = label, tint = if (enabled) c.ink else c.ink.copy(alpha = 0.28f), modifier = Modifier.size(22.dp))
    }
}

/** 画面上部の帯(戻る・題名・右側のボタン)。gameId を渡すと題名の前に箱の絵を出す */
@Composable
fun TopBar(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)?,
    gameId: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val c = LocalAsobi.current
    val tap = rememberBackTap()
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // 戻るは、戻る用の音を鳴らす
        if (onBack != null) IconChip(AppIcons.Back, "戻る") { tap(); onBack() }
        BoxWithConstraints(Modifier.weight(1f).padding(start = 4.dp)) {
        // ボタンが多くて狭い時は、箱の絵を出さずに名前に場所をゆずる
        val roomy = maxWidth >= 110.dp
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (gameId != null && roomy) GameBox(gameId, 30.dp, corner = 8.dp, artScale = 0.8f)
            Column {
                // 名前が長い時・ボタンが多い時は、字を小さくして全部見せる(省略の「…」にしない)
                FitText(title, c.ink, FontWeight.Bold, 19f, 12f, maxLines = 2, alt = if (gameId != null) titleBreak(gameId, title) else null)
                if (subtitle != null) FitText(subtitle, c.sub, FontWeight.Normal, 11f, 9f, maxLines = 1)
            }
        }
        }
        actions()
    }
}

/** 幅に入るように字の大きさを下げる文字(maxSp から minSp まで)。それでも入らなければ maxLines まで折り返す */
@Composable
fun FitText(text: String, color: Color, weight: FontWeight, maxSp: Float, minSp: Float, maxLines: Int = 1, modifier: Modifier = Modifier, alt: String? = null) {
    BoxWithConstraints(modifier) {
        val tm = androidx.compose.ui.text.rememberTextMeasurer()
        val wPx = constraints.maxWidth
        val base = androidx.compose.material3.LocalTextStyle.current
        fun width(t: String, sp: Float) = tm.measure(t, base.merge(androidx.compose.ui.text.TextStyle(fontSize = sp.sp, fontWeight = weight)), softWrap = false).size.width
        // 入らない時は、言葉の切れ目で改行した alt を使う
        val shown = if (alt != null && wPx < Int.MAX_VALUE && width(text, minSp) > wPx) alt else text
        var size = maxSp
        if (wPx < Int.MAX_VALUE) while (size > minSp && width(shown, size) > wPx) size -= 1f
        Text(shown, color = color, fontWeight = weight, fontSize = size.sp, lineHeight = (size * 1.15f).sp, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
    }
}

/** 角丸の区切りボタン群(1つを選ぶ)。選んでいるものは黄。入りきらない時は段を分けて、字が切れないようにする */
@Composable
fun <T> Segmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = LocalAsobi.current
    // 使えない時は、全体を薄くして、選んでいる所も灰色にする(触れないことが分かるように)
    BoxWithConstraints(modifier.fillMaxWidth().alpha(if (enabled) 1f else 0.4f).clip(RoundedCornerShape(12.dp)).background(c.segment).border(1.dp, c.line, RoundedCornerShape(12.dp)).padding(3.dp)) {
        val avail = maxWidth.value
        // 1つのボタンの幅に、字の幅(太字で測る)と左右の余白が入るように段を分ける
        val tm = androidx.compose.ui.text.rememberTextMeasurer()
        val density = androidx.compose.ui.platform.LocalDensity.current
        val widths = options.map { o -> with(density) { tm.measure(o.second, androidx.compose.material3.LocalTextStyle.current.merge(androidx.compose.ui.text.TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold))).size.width.toDp().value } }
        fun fits(n: Int, longest: Float) = avail / n >= longest + 12f
        val rows = ArrayList<List<Pair<T, String>>>()
        var cur = ArrayList<Pair<T, String>>()
        var curMax = 0f
        options.forEachIndexed { i, o ->
            val longest = maxOf(curMax, widths[i])
            if (cur.isNotEmpty() && !fits(cur.size + 1, longest)) { rows.add(cur); cur = ArrayList(); curMax = 0f }
            cur.add(o); curMax = maxOf(curMax, widths[i])
        }
        if (cur.isNotEmpty()) rows.add(cur)
        // 段の数をそろえる(例: 6つを 4+2 ではなく 3+3)
        val perRow = if (rows.size > 1) (options.size + rows.size - 1) / rows.size else options.size
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (row in options.chunked(perRow)) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((value, label) in row) {
                    val on = value == selected
                    Box(
                        Modifier.weight(1f).heightIn(min = 36.dp).clip(RoundedCornerShape(9.dp))
                            .background(if (on && enabled) c.select else if (on) c.sub.copy(alpha = 0.35f) else Color.Transparent)
                            .clickable(enabled = enabled, role = Role.RadioButton) { onSelect(value) }.padding(horizontal = 2.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            label, color = if (on && enabled) c.onSelect else if (on) c.ink else if (enabled) c.sub else c.sub.copy(alpha = 0.5f), fontSize = 14.sp,
                            fontWeight = if (on) FontWeight.Bold else FontWeight.Normal, textAlign = TextAlign.Center, lineHeight = 17.sp,
                        )
                    }
                }
            }
        }
    }
}

/** 小さな札(人数・準備中など) */
@Composable
fun Tag(text: String, strong: Boolean = true) {
    val c = LocalAsobi.current
    Text(
        text,
        color = if (strong) c.onSelect else c.sub,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(if (strong) c.select else c.surface2).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

/** 大きめのボタン。primary は黄のグラデーション、それ以外は控えめな地 */
@Composable
fun BigButton(text: String, modifier: Modifier = Modifier, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(18.dp)
    val base = modifier.height(54.dp)
    val styled = when {
        primary && enabled -> base.clip(shape).background(c.primaryBrush)
        primary -> base.clip(shape).background(c.surface2)
        else -> base.clip(shape).background(c.surface).border(1.dp, c.line, shape)
    }
    Box(styled.clickable(enabled = enabled, role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
        Text(
            text,
            color = if (primary) (if (enabled) c.onPrimary else c.sub) else (if (enabled) c.ink else c.sub),
            fontSize = if (primary) 17.sp else 15.sp, fontWeight = if (primary) FontWeight.Black else FontWeight.Bold,
            letterSpacing = if (primary && text.length <= 5) 3.sp else 0.sp,
        )
    }
}

/** 見出しの小さな文字 */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = LocalAsobi.current
    Text(text, color = if (enabled) c.sub else c.sub.copy(alpha = 0.4f), fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = modifier.padding(start = 4.dp))
}

/** 角丸のカード(設定の行のまとまりなど) */
@Composable
fun CardBox(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(14.dp)
    val m = modifier.clip(shape).background(c.surface).border(1.dp, c.line, shape)
    Box(m) { content() }
}

/** オン・オフの小さなスイッチ(オンはフェルトの緑) */
@Composable
fun Toggle(on: Boolean) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(14.dp)
    Box(
        Modifier.width(46.dp).height(28.dp).clip(shape).background(if (on) c.felt else c.well).border(1.dp, if (on) c.felt else c.line, shape).padding(3.dp),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(Modifier.size(22.dp).clip(CircleShape).background(Color.White).border(0.5.dp, Color(0x33000000), CircleShape))
    }
}

/** ヨットの「役」ボタン(サイコロのアイコンと文字。黄の縁) */
@Composable
fun RolesButton(poker: Boolean = false, onClick: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(22.dp)
    Row(
        Modifier.height(44.dp).clip(shape).background(c.accent.copy(alpha = 0.16f)).border(2.dp, c.accent, shape)
            .clickable(role = Role.Button, onClickLabel = "役", onClick = onClick).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (poker) Text("♠", color = c.accentInk, fontSize = 18.sp)
        else Icon(AppIcons.Dice, contentDescription = null, tint = c.accentInk, modifier = Modifier.size(18.dp))
        Text("役", color = c.accentInk, fontSize = 14.sp, fontWeight = FontWeight.Black)
    }
}
