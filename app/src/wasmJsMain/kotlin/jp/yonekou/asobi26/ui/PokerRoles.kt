package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val pokerRoles = listOf(
    Triple("ロイヤルストレートフラッシュ", "10♠ J♠ Q♠ K♠ A♠", "同じマークの10・J・Q・K・A"),
    Triple("ストレートフラッシュ", "5♥ 6♥ 7♥ 8♥ 9♥", "同じマークで5枚の数字が連続"),
    Triple("フォーカード", "9♠ 9♥ 9♦ 9♣ K♠", "同じ数字が4枚"),
    Triple("フルハウス", "8♠ 8♥ 8♦ K♣ K♠", "同じ数字3枚と、別の同じ数字2枚"),
    Triple("フラッシュ", "2♣ 5♣ 8♣ J♣ K♣", "5枚とも同じマーク"),
    Triple("ストレート", "4♠ 5♥ 6♦ 7♣ 8♠", "5枚の数字が連続"),
    Triple("スリーカード", "7♠ 7♥ 7♦ 2♣ K♠", "同じ数字が3枚"),
    Triple("ツーペア", "6♠ 6♥ Q♦ Q♣ A♠", "同じ数字2枚の組が2つ"),
    Triple("ワンペア", "10♠ 10♥ 3♦ 7♣ K♠", "同じ数字が2枚"),
    Triple("ブタ(役なし)", "2♠ 5♥ 8♦ J♣ K♠", "上のどの役にも当てはまらない"),
)

@Composable
fun PokerRoles(onClose: () -> Unit) {
    val c = LocalAsobi.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
        .background(c.surface).padding(14.dp)) {
        Text("役の一覧", color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("強い順", color = c.sub, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))
        Column(Modifier.weight(1f, fill = false).heightIn(max = 430.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for ((name, example, how) in pokerRoles) {
                Column {
                    Text(name, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text(example, color = c.accentInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text(how, color = c.sub, fontSize = 12.sp)
                }
            }
            Text("Aは最も強い数字。ただしA・2・3・4・5のストレートでは最も弱い数字です。同じ役なら数字を比べ、マークの強弱はありません。", color = c.sub, fontSize = 12.sp)
        }
        Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(46.dp).clip(RoundedCornerShape(14.dp))
            .background(c.chip).clickable(role = Role.Button, onClick = onClose), contentAlignment = Alignment.Center) {
            Text("閉じる", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
    }
}
