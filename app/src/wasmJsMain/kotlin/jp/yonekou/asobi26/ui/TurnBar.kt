package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.core.Session
import jp.yonekou.asobi26.core.games.HoldemState
import jp.yonekou.asobi26.core.games.OhNoState

/**
 * 画面の上に、自分を含めた全員を手番の順に並べる帯。
 * 番の人は金の枠と「▶」、次の人は「NEXT」、席の間の矢印で回る向きが分かる(文字を読まなくても分かるように)。
 */
class TurnInfo(
    val current: Int,
    val next: Int,
    /** 1 = 席の番号の順(左から右)、-1 = 逆回り */
    val dir: Int,
    val badges: Map<Int, String> = emptyMap(),
    val bubbles: Map<Int, String> = emptyMap(),
    val out: Set<Int> = emptySet(),
)

/** ゲームごとの手番の情報。番のないゲーム(同時に動かす・1人)は null */
fun turnInfo(ses: Session<*>): TurnInfo? {
    val n = ses.seats.size
    if (n < 2) return null
    if (ses.rules is jp.yonekou.asobi26.core.ConcurrentRules<*>) return null
    val cur = ses.toMove
    if (cur < 0) return null
    return when (val s = ses.state) {
        is OhNoState -> {
            val dir = if (s.direction > 0) 1 else -1
            TurnInfo(
                cur, (cur + dir + n) % n, dir,
                badges = s.hands.indices.associateWith { "${s.hands[it].size}" },
                bubbles = if (s.declared >= 0) mapOf(s.declared to "Oh,No!") else emptyMap(),
            )
        }
        is HoldemState -> {
            var q = cur
            repeat(n) { q = (q + 1) % n; if (q !in s.folded && s.chips[q] > 0 && q != cur) return TurnInfo(cur, q, 1, badges = s.chips.indices.associateWith { "${s.chips[it]}" }, out = s.folded) }
            TurnInfo(cur, cur, 1, out = s.folded)
        }
        else -> TurnInfo(cur, (cur + 1) % n, 1)
    }
}

@Composable
fun TurnOrderBar(ses: Session<*>, info: TurnInfo, modifier: Modifier = Modifier) {
    val c = LocalAsobi.current
    val n = ses.seats.size
    BoxWithConstraints(modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 3.dp)) {
        val arrowW = 14.dp
        val chipW = ((maxWidth - arrowW * n) / n).coerceAtMost(96.dp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            for (p in 0 until n) {
                TurnChip(ses, p, info, chipW)
                // 席の間の矢印(最後は先頭へ戻る印)。逆回りなら左向き
                val last = p == n - 1
                Text(
                    if (last) (if (info.dir > 0) "↩" else "↪") else if (info.dir > 0) "▶" else "◀",
                    color = c.accentInk, fontSize = if (last) 13.sp else 10.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center, modifier = Modifier.width(arrowW),
                )
            }
        }
    }
}

@Composable
private fun TurnChip(ses: Session<*>, p: Int, info: TurnInfo, w: androidx.compose.ui.unit.Dp) {
    val c = LocalAsobi.current
    val turn = p == info.current
    val next = p == info.next && !turn
    val shape = RoundedCornerShape(12.dp)
    val avatar = if (showsPhoto(ses, p)) LocalAvatar.current else null
    Box(Modifier.width(w).alpha(if (p in info.out) 0.4f else 1f), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.padding(top = 8.dp).fillMaxWidth().clip(shape)
                .background(if (turn) c.accent.copy(alpha = 0.18f) else c.surface)
                .border(if (turn) 2.5.dp else 1.dp, if (turn) c.accent else if (next) c.accent.copy(alpha = 0.6f) else c.line, shape)
                .padding(top = 9.dp, bottom = 4.dp, start = 2.dp, end = 2.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box {
                PlayerFace(avatar, ses.seats[p].human, p, 24.dp, ring = false)
                info.badges[p]?.let { b ->
                    Text(
                        b, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1,
                        modifier = Modifier.align(Alignment.BottomEnd).offset(12.dp, 2.dp).clip(RoundedCornerShape(8.dp))
                            .background(BADGE_RED).border(1.5.dp, Color.White, RoundedCornerShape(8.dp)).padding(horizontal = 4.dp),
                    )
                }
            }
            Text(
                seatLabel(ses, p), color = c.ink, fontSize = 10.sp, fontWeight = if (turn) FontWeight.Black else FontWeight.Bold,
                lineHeight = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp),
            )
        }
        // 番の人は「▶」の札、次の人は「NEXT」の札(枠の上に重ねる)
        if (turn || next) {
            Text(
                if (turn) "▶ 番" else "NEXT", color = if (turn) c.onAccent else c.accentInk, fontSize = 9.sp, lineHeight = 11.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.clip(RoundedCornerShape(7.dp)).background(if (turn) c.accent else c.surface)
                    .border(1.dp, c.accent, RoundedCornerShape(7.dp)).padding(horizontal = 6.dp, vertical = 1.dp),
            )
        }
        info.bubbles[p]?.let { b ->
            Text(
                b, color = Color(0xFF3A2A00), fontSize = 9.sp, fontWeight = FontWeight.Black, maxLines = 1,
                modifier = Modifier.align(Alignment.BottomCenter).offset(y = 6.dp).clip(RoundedCornerShape(7.dp)).background(Color(0xFFFFD94F)).padding(horizontal = 4.dp),
            )
        }
    }
}
