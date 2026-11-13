package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

@Composable
fun PieceGuide(gameId: String, close: () -> Unit) {
    val chess = gameId == "chess"
    val names = if (chess) listOf("ポーン", "ナイト", "ビショップ", "ルーク", "クイーン", "キング")
        else listOf("歩", "香", "桂", "銀", "金", "角", "飛", "玉", "と金・成香・成桂・成銀", "馬", "龍")
    var selected by remember(gameId) { mutableStateOf(names.first()) }
    val c = LocalAsobi.current
    val tm = rememberTextMeasurer()
    val rays = selected in setOf("香", "角", "飛", "馬", "龍", "ビショップ", "ルーク", "クイーン")
    fun reachable(x: Int, y: Int): Boolean {
        if (x == 0 && y == 0) return false
        return when (selected) {
            "歩", "ポーン" -> x == 0 && y == -1
            "香" -> x == 0 && y < 0
            "桂" -> abs(x) == 1 && y == -2
            "ナイト" -> abs(x) * abs(y) == 2
            "銀" -> (y == -1 && abs(x) <= 1) || (y == 1 && abs(x) == 1)
            "金", "と金・成香・成桂・成銀" -> (y == -1 && abs(x) <= 1) || (y == 0 && abs(x) == 1) || (x == 0 && y == 1)
            "角", "ビショップ" -> abs(x) == abs(y)
            "飛", "ルーク" -> x == 0 || y == 0
            "クイーン" -> x == 0 || y == 0 || abs(x) == abs(y)
            "馬" -> abs(x) == abs(y) || abs(x) + abs(y) == 1
            "龍" -> x == 0 || y == 0 || abs(x) == 1 && abs(y) == 1
            else -> abs(x) <= 1 && abs(y) <= 1
        }
    }
    AlertDialog(onDismissRequest = close, containerColor = c.surface, title = { Text("駒の動き") },
        text = { Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState())) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(names) { name -> Text(name, color = if (name == selected) c.onAccent else c.ink,
                    modifier = Modifier.background(if (name == selected) c.accent else c.chip, RoundedCornerShape(10.dp))
                        .clickable { selected = name }.padding(12.dp)) }
            }
            Text("手前の駒から見た動き。上が相手側です。", color = c.sub, modifier = Modifier.padding(vertical = 10.dp))
            Canvas(Modifier.fillMaxWidth().aspectRatio(1f)) {
                val cell = size.width / 7
                for (y in 0..6) for (x in 0..6) {
                    drawRect(if ((x + y) % 2 == 0) Color(0xFFEFE5CA) else Color(0xFFD5DEC9), Offset(x * cell, y * cell), Size(cell, cell))
                    val dx = x - 3; val dy = y - 3
                    if (reachable(dx, dy)) drawCircle(Color(0xFF26745C), cell * .18f, Offset((x + .5f) * cell, (y + .5f) * cell))
                    if (selected == "ポーン" && abs(dx) == 1 && dy == -1) drawCircle(Color(0xFFBA593B), cell * .23f,
                        Offset((x + .5f) * cell, (y + .5f) * cell), style = Stroke(3.dp.toPx()))
                }
                val label = tm.measure(if (chess) "駒" else selected.take(1), TextStyle(color = Color(0xFF152B32), fontSize = 22.sp))
                drawText(label, topLeft = Offset(size.width / 2 - label.size.width / 2, size.height / 2 - label.size.height / 2))
            }
            Text(when { selected == "馬" -> "斜めは何マスでも、縦横は1マス進めます。"; selected == "龍" -> "縦横は何マスでも、斜めは1マス進めます。"; rays -> "緑の方向へ何マスでも進めます。"; else -> "緑の点へ進めます。" }, color = c.ink, modifier = Modifier.padding(top = 10.dp))
            Text(when (selected) {
                "ポーン" -> "前へ1マス。最初だけ2マス進めます。橙の輪は相手の駒を取る方向です。最奥で昇格。アンパッサンはルールで確認できます。"
                "ナイト", "桂" -> "途中の駒を飛び越えられます。"
                "キング" -> "相手に取られるマスへは進めません。条件を満たせばキャスリングもできます。"
                else -> "途中の駒は飛び越えられません。味方の駒のマスには進めません。相手の駒を取ると、そのマスで止まります。"
            }, color = c.sub, modifier = Modifier.padding(top = 10.dp))
        } }, confirmButton = { TextButton(onClick = close) { Text("閉じる") } })
}
