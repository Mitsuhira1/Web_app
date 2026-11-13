package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.BuildConfig
import jp.yonekou.asobi26.Screen
import jp.yonekou.asobi26.core.Catalog
import jp.yonekou.asobi26.core.OptionSpec
import jp.yonekou.asobi26.core.Category
import jp.yonekou.asobi26.core.GameInfo
import jp.yonekou.asobi26.core.GameOptions
import jp.yonekou.asobi26.core.Level

@Composable
fun AppRoot(model: AppModel) {
    val c = LocalAsobi.current
    model.onlineTick
    // スマホの戻る操作も、画面の「戻る」と同じ音を鳴らす
    val backTap = rememberBackTap()
    BackHandler(enabled = model.backStack.size > 1) { backTap(); model.back() }
    // ホームで「ゲーム」以外のタブを開いている時は、戻るで「ゲーム」へ
    BackHandler(enabled = model.backStack.size == 1 && model.homeTab != 0) { backTap(); model.homeTab = 0 }
    Box(Modifier.fillMaxSize().screenBackground(c)) {
        when (val s = model.screen) {
            Screen.Home -> HomeScreen(model)
            is Screen.Detail -> DetailScreen(model, s.gameId)
            is Screen.Rules -> RulesScreen(model, s.gameId)
            Screen.Play -> PlayScreen(model)
            Screen.Settings -> SettingsScreen(model)
            Screen.Lobby -> LobbyScreen(model)
            Screen.RoomSettings -> OnlineGameSettingsScreen(model)
            Screen.Join -> JoinScreen(model)
        }
        if (!model.onboarded) FirstRunScreen(model)
        if (model.confirmRoomReturn) AlertDialog(
            onDismissRequest = { model.confirmRoomReturn = false },
            title = { Text("ゲーム選択へ戻りますか？") },
            text = { Text("対局を終了し、全員で同じ部屋のゲーム選択へ戻ります。部屋は解散しません。") },
            confirmButton = { TextButton(onClick = { model.returnToRoom() }) { Text("部屋へ戻る") } },
            dismissButton = { TextButton(onClick = { model.confirmRoomReturn = false }) { Text("続ける") } }, containerColor = c.surface,
        )
        if (model.confirmReplay) {
            val r = model.room
            val excluded = r?.members?.filter { it.slot != r.mySlot && it.slot !in r.readySlots }?.joinToString("・") { it.name }.orEmpty()
            AlertDialog(onDismissRequest = { model.confirmReplay = false }, title = { Text("再戦を始めますか？") },
                text = { Text(if (excluded.isEmpty()) "参加者全員で再戦します。" else "$excluded はまだ「もう一度」を押していません。今回は試合に参加せず、部屋で待機します。") },
                confirmButton = { TextButton(onClick = { model.confirmOnlineReplay() }) { Text("このメンバーで開始") } },
                dismissButton = { TextButton(onClick = { model.confirmReplay = false }) { Text("待つ") } }, containerColor = c.surface)
        }
        // 通信の知らせ(部屋が閉じた・参加者が抜けた など)を1回だけ出す
        model.onlineNotice?.let { text ->
            AlertDialog(
                onDismissRequest = { model.onlineNotice = null },
                confirmButton = { TextButton(onClick = { model.onlineNotice = null }) { Text("閉じる") } },
                text = { Text(text) },
                containerColor = c.surface,
            )
        }
    }
}

// =====================================================================
// ホーム(下のタブ: ゲーム / みんなで遊ぶ / 成績)
// =====================================================================

@Composable
fun HomeScreen(model: AppModel) {
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (model.homeTab) {
                1 -> TogetherTab(model)
                2 -> StatsTab(model)
                3 -> SettingsScreen(model)
                else -> GamesTab(model)
            }
        }
        BottomNav(model)
    }
}

@Composable
private fun BottomNav(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val items = listOf(Triple(0, "ゲーム", AppIcons.Games), Triple(1, "みんなで遊ぶ", AppIcons.People), Triple(2, "成績", AppIcons.Stats), Triple(3, "設定", AppIcons.Settings))
    Row(
        Modifier.fillMaxWidth().background(c.nav).drawBehind { drawLine(c.line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.navigationBarsPadding().height(62.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for ((i, label, icon) in items) {
            val on = model.homeTab == i
            val color = if (on) c.accentInk else c.sub
            Column(
                Modifier.weight(1f).fillMaxSize().clickable(role = Role.Tab) { if (!on) { tap(); model.homeTab = i } },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
                Text(label, color = color, fontSize = 11.sp, fontWeight = if (on) FontWeight.Black else FontWeight.Normal)
            }
        }
    }
}

/** 人数の文字("1〜6人" など)から最少・最多 */
private fun playerRange(players: String): IntRange {
    val nums = Regex("\\d+").findAll(players).map { it.value.toInt() }.toList()
    return if (nums.isEmpty()) 2..2 else nums.first()..nums.last()
}

private fun matchesFilter(gi: GameInfo, filter: Int): Boolean {
    val r = playerRange(gi.players)
    return when (filter) {
        1 -> 2 in r
        2 -> r.last >= 3
        3 -> r.first == 1
        else -> true
    }
}

@Composable
private fun GamesTab(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val filter = model.playerFilter
    val board = remember(filter) { Catalog.of(Category.BOARD).filter { matchesFilter(it, filter) } }
    val cards = remember(filter) { Catalog.of(Category.CARD).filter { matchesFilter(it, filter) } }
    val grid = model.homeGrid
    // 全部のタイルを先に別スレッドで描いておく(スクロールで初めて見えた時の引っかかりをなくす)
    val ctx = LocalContext.current
    val density = LocalDensity.current
    val screenW = LocalConfiguration.current.screenWidthDp
    LaunchedEffect(Unit) {
        val px = with(density) { ((screenW.dp - 36.dp - 24.dp) / 3).roundToPx() }
        prerenderTiles(ctx.applicationContext, density, px, Catalog.all.map { it.id to it.playable })
        Thread { Textures.prepare() }.apply { priority = Thread.MIN_PRIORITY }.start()
    }
    Column(Modifier.fillMaxSize()) {
        // 題名と設定はスクロールしない(画面の上の時計などと重ならないよう、少し下げる)
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(start = 18.dp, end = 14.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                // 題名は「あそび箱」と収録数(金)だけ(Web 版はユーザーの指示で「日本アソビ大辞典」から名前を変えた)
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("あそび箱", color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.Black, lineHeight = 30.sp)
                    Text("${Catalog.all.size}", color = c.accentInk, fontSize = 30.sp, fontWeight = FontWeight.Black, lineHeight = 34.sp, modifier = Modifier.padding(start = 4.dp))
                }
            }
            Text(
                "CPU ${Level.values()[model.defaultLevel.coerceIn(0, Level.values().size - 1)].label}", color = c.sub, fontSize = 11.sp,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(c.surface).border(1.dp, c.line, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 3.dp),
            )

        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            state = grid,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 4.dp, bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }, contentType = "head") {
                Column {
                    ContinueBar(model)
                    // 人数の切り替え: 1本の細い枠の中に4つ。選んでいる所は濃い木(ダークは金)
                    Row(
                        Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).background(c.surface)
                            .border(1.dp, c.line, RoundedCornerShape(12.dp)).padding(3.dp),
                    ) {
                        listOf(0 to "すべて", 3 to "1人", 1 to "2人", 2 to "3人以上").forEach { (i, label) ->
                            val on = filter == i
                            Text(
                                label, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                                color = if (on) c.onSelect else c.sub,
                                modifier = Modifier.weight(1f).clip(RoundedCornerShape(9.dp)).background(if (on) c.select else Color.Transparent)
                                    .clickable(role = Role.RadioButton) { tap(); model.playerFilter = i }.padding(vertical = 6.dp),
                            )
                        }
                    }
                }
            }
            if (board.isNotEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }, contentType = "section") { ShelfTitle("ボードゲーム", board.size) }
                items(board, key = { it.id }, contentType = { "tile" }) { gi -> GameTile(gi) { tap(); model.open(Screen.Detail(gi.id)) } }
            }
            if (cards.isNotEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }, contentType = "section") { ShelfTitle("カードゲーム", cards.size) }
                items(cards, key = { it.id }, contentType = { "tile" }) { gi -> GameTile(gi) { tap(); model.open(Screen.Detail(gi.id)) } }
            }
            if (board.isEmpty() && cards.isEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) { Text("当てはまるゲームがありません", color = c.sub, fontSize = 14.sp, modifier = Modifier.padding(top = 24.dp)) }
            }
        }
    }
}

@Composable
private fun ShelfTitle(title: String, count: Int) {
    val c = LocalAsobi.current
    Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = c.ink, fontSize = 16.sp, fontWeight = FontWeight.Black)
        Text("$count", color = c.sub, fontSize = 12.sp)
        Box(Modifier.weight(1f).height(1.dp).background(c.line))
    }
}

@Composable
fun GameTile(gi: GameInfo, onClick: () -> Unit) {
    val c = LocalAsobi.current
    // 部品を少なくする(タイルの絵は1枚の画像、名前は1つの文字)。スクロールを軽くするため
    Column(Modifier.clickable(role = Role.Button, onClick = onClick)) {
        // 下に 2dp の濃い影(ぼかさない)を敷いてから、タイルの絵(角丸は絵の画像の中で切ってある)
        GameTileArt(gi.id, gi.playable, Modifier.fillMaxWidth().aspectRatio(1f).drawBehind {
            drawRoundRect(Color.Black.copy(alpha = 0.2f), Offset(0f, 2.dp.toPx()), size, CornerRadius(14.dp.toPx()))
        })
        Text(tileName(gi.id, gi.name), color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, lineHeight = 16.sp, maxLines = 2, modifier = Modifier.padding(top = 6.dp))
        Text(gi.players, color = c.sub, fontSize = 10.sp, lineHeight = 12.sp)
    }
}

/** 「続きから」の帯(いちばん新しい途中の対局)。ほかにもあれば下に小さく並べる */
@Composable
private fun ContinueBar(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    // 1手も進んでいない対局は出さない。出すのは新しい順に5ゲームまで
    val list = model.saved.filter { Catalog.byId(it.gameId)?.playable == true && it.moves.isNotEmpty() }.take(5)
    if (list.isEmpty()) return
    val first = list.first()
    val gi = Catalog.byId(first.gameId) ?: return
    val shape = RoundedCornerShape(16.dp)
    // フェルトの緑の板(下に濃い緑の 3dp の段)
    Row(
        Modifier.fillMaxWidth().height(74.dp).drawBehind { drawRoundRect(Color(0xFF123222), Offset(0f, 3.dp.toPx()), size, CornerRadius(16.dp.toPx())) }
            .clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF27634A), Color(0xFF1A4A34))))
            .clickable(role = Role.Button) { tap(); model.resume(first) }.padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        GameBox(gi.id, 52.dp, corner = 10.dp)
        Column(Modifier.weight(1f)) {
            Text("続きから", color = Color(0xFFCFE5D6), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text("${gi.name} ・ ${first.moves.size}手目", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(Modifier.size(38.dp).clip(CircleShape).background(Color(0xFFF1C96B)), contentAlignment = Alignment.Center) {
            Icon(AppIcons.Play, contentDescription = "再開", tint = Color(0xFF3A2616), modifier = Modifier.size(20.dp))
        }
    }
    if (list.size > 1) {
        // 横にスクロールさせず、2つずつ並べる(右端が切れて見えないように)
        Column(Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (pair in list.drop(1).chunked(2)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (rec in pair) {
                        val g = Catalog.byId(rec.gameId) ?: continue
                        Row(
                            Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.line, RoundedCornerShape(14.dp)).clickable(role = Role.Button) { tap(); model.resume(rec) }
                                .padding(start = 6.dp, end = 10.dp, top = 6.dp, bottom = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            GameBox(g.id, 26.dp, corner = 7.dp, artScale = 0.8f)
                            Column(Modifier.weight(1f)) {
                                Text(g.name, color = c.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${rec.moves.size}手目", color = c.sub, fontSize = 11.sp, maxLines = 1)
                            }
                        }
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

// ---- みんなで遊ぶ ----

@Composable
private fun TogetherTab(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val (_, hostOnline) = rememberHostActions(model)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 18.dp)) {
        Text("みんなで遊ぶ", color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 16.dp))
        Text(
            "先に友だちと接続します。遊ぶゲームとルールは、接続した後にホストが決めます。",
            color = c.sub, fontSize = 13.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 6.dp),
        )
        Spacer(Modifier.height(18.dp))
        SectionLabel("ルームを作る(ホスト)")
        Spacer(Modifier.height(10.dp))
        // Web 版では「近くの人と」(Bluetooth・Wi-Fi Direct)が使えないので、そのボタンは出さない
        ConnectCard(AppIcons.Globe, "オンライン", "招待コードを送って、離れた友だちと接続します。", Color(0xFF3A7BE0), Color(0xFF2556B0)) { tap(); hostOnline() }
        Spacer(Modifier.height(18.dp))
        SectionLabel("ルームに参加")
        Spacer(Modifier.height(10.dp))
        ConnectCard(AppIcons.Enter, "参加する", "近くのルームを探す、または招待コードを入力します。", Color(0xFFF2A93B), Color(0xFFD97C1E)) { tap(); model.open(Screen.Join) }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ConnectCard(icon: ImageVector, title: String, note: String, a: Color, b: Color, onClick: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Row(
        Modifier.fillMaxWidth().shadow(6.dp, shape).clip(shape).background(Brush.linearGradient(listOf(a, b)))
            .clickable(role = Role.Button, onClick = onClick).padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(Modifier.size(60.dp).clip(RoundedCornerShape(18.dp)).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(34.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text(note, color = Color.White.copy(alpha = 0.92f), fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}

// ---- 成績 ----

@Composable
private fun StatsTab(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    @Suppress("UNUSED_VARIABLE") val v = model.statsVersion
    val games = Catalog.all.filter { it.playable }
    val stats = games.map { it to model.statsOf(it.id) }
    // CPU と対戦できるゲーム / ひとりで遊べるゲーム(ヒット＆ブローは両方)
    val vsGames = stats.filter { (gi, _) -> gi.def!!.seatsFor(GameOptions()) >= 2 }
    val soloGames = stats.filter { (gi, _) -> gi.id == "hitblow" || gi.id == "yacht" }
    var askClear by remember { mutableStateOf(false) }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column(Modifier.statusBarsPadding().padding(top = 16.dp)) {
                Text("成績", color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.Black)
                val w = stats.sumOf { it.second.wins }
                val l = stats.sumOf { it.second.losses }
                val d = stats.sumOf { it.second.draws }
                Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox("勝ち", w, c.accentInk, Modifier.weight(1f))
                    StatBox("負け", l, c.sub, Modifier.weight(1f))
                    StatBox("引き分け", d, c.sub, Modifier.weight(1f))
                }
            }
        }
        // ---- CPU との対戦 ----
        item { StatsHeading("CPUとの対戦", "強さごとの 勝ち・負け・引き分け") }
        items(vsGames, key = { "vs_" + it.first.id }) { (gi, st) ->
            CardBox(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        GameBox(gi.id, 36.dp, corner = 9.dp, artScale = 0.8f)
                        Text(gi.name, color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        val n = st.wins + st.losses + st.draws
                        Text(if (n == 0) "記録なし" else "勝率 ${st.wins * 100 / n}%", color = if (n == 0) c.sub else c.accentInk, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (lv in Level.values()) {
                            val a = st.vsCpu[lv.ordinal]
                            Column(
                                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(c.surface2).padding(vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(lv.label, color = c.sub, fontSize = 11.sp)
                                Text("${a[0]}勝 ${a[1]}敗", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                Text(if (a[2] > 0) "${a[2]}分" else " ", color = c.sub, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
        // ---- ひとりで ----
        if (soloGames.isNotEmpty()) {
            item { StatsHeading("ひとりで", "ヒット＆ブローは最少の手数、ヨットは最高点") }
            items(soloGames, key = { "solo_" + it.first.id }) { (gi, st) ->
                CardBox(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        GameBox(gi.id, 36.dp, corner = 9.dp, artScale = 0.8f)
                        Text(gi.name, color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        if (gi.id == "yacht") {
                            SoloCell("遊んだ", if (st.plays == 0) "-" else "${st.plays}回")
                            SoloCell("最高", if (st.best == 0) "-" else "${st.best}点")
                        } else {
                            SoloCell("解けた", if (st.plays == 0) "-" else "${st.clears}/${st.plays}回")
                            SoloCell("最少", if (st.best == 0) "-" else "${st.best}手")
                        }
                    }
                }
            }
        }
        item {
            Text(
                "成績を消す", color = c.sub, fontSize = 13.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(12.dp))
                    .clickable(role = Role.Button) { tap(); askClear = true }.padding(12.dp),
            )
        }
    }
    if (askClear) {
        AlertDialog(
            onDismissRequest = { askClear = false },
            confirmButton = { TextButton(onClick = { askClear = false; model.clearStats() }) { Text("消す") } },
            dismissButton = { TextButton(onClick = { askClear = false }) { Text("やめる") } },
            title = { Text("成績を消しますか?") },
            text = { Text("すべてのゲームの記録が消えます。元に戻せません。") },
            containerColor = c.surface,
        )
    }
}

@Composable
private fun StatsHeading(title: String, note: String) {
    val c = LocalAsobi.current
    Column(Modifier.padding(top = 12.dp, start = 4.dp)) {
        Text(title, color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text(note, color = c.sub, fontSize = 12.sp)
    }
}

@Composable
private fun SoloCell(label: String, value: String) {
    val c = LocalAsobi.current
    Column(
        Modifier.width(76.dp).clip(RoundedCornerShape(12.dp)).background(c.surface2).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, color = c.sub, fontSize = 11.sp)
        Text(value, color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StatBox(label: String, value: Int, color: Color, modifier: Modifier) {
    val c = LocalAsobi.current
    CardBox(modifier) {
        Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$value", color = color, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text(label, color = c.sub, fontSize = 12.sp)
        }
    }
}

// =====================================================================
// 説明と遊び方の選択
// =====================================================================

@Composable
fun DetailScreen(model: AppModel, gameId: String) {
    val gi = Catalog.byId(gameId) ?: return
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    // 前回この遊びを始めた時の設定を、最初から選んでおく
    val saved = remember(gameId) { model.savedSetup(gameId) }
    val prev = saved?.first
    val chosen = remember(gameId) { mutableStateMapOf<String, String>().apply { gi.options.forEach { o -> put(o.key, prev?.values?.get(o.key)?.takeIf { v -> o.values.any { it.first == v } } ?: o.default) } } }
    var level by remember(gameId) { mutableIntStateOf(saved?.second?.coerceIn(0, 2) ?: model.defaultLevel) }
    var localMode by remember(gameId) { mutableStateOf(prev?.str("localMode", "cpu") ?: "cpu") }
    var localHumans by remember(gameId) { mutableIntStateOf(prev?.int("humans", 2) ?: 2) }
    var rotateTurns by remember(gameId) { mutableStateOf(prev?.str("rotateTurns", "false") == "true") }
    var seat by remember(gameId) { mutableIntStateOf(saved?.third?.takeIf { it in -1..1 } ?: 0) } // 0=先攻 1=後攻 -1=ランダム
    val names = remember(gameId) { mutableStateListOf<String>().apply { for (i in 1..6) add(prev?.str("pname$i", "") ?: "") } }
    val options = GameOptions(chosen.toMap() + mapOf("localMode" to localMode, "humans" to localHumans.toString(), "rotateTurns" to rotateTurns.toString()) +
        (1..6).associate { "pname$it" to cleanName(names[it - 1]) })
    // 変えたらすぐ保存する(ローカルルールなどを、アプリを閉じても覚えておく)
    LaunchedEffect(options.encode(), level, seat) { if (gi.playable) model.saveSetup(gameId, options, Level.values()[level.coerceIn(0, 2)], seat) }
    LaunchedEffect(gameId, chosen["bjStyle"]) {
        if (gameId == "blackjack" && chosen["bjStyle"] == "pot" && (chosen["players"]?.toIntOrNull() ?: 1) < 2) chosen["players"] = "2"
    }
    val solo = gi.def?.seatsFor(options) == 1

    Column(Modifier.fillMaxSize()) {
        TopBar("", onBack = { model.back() }) {
            if (gi.sections.isNotEmpty()) IconChip(AppIcons.Rules, "ルール") { tap(); model.open(Screen.Rules(gi.id)) }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            // 上: フェルトの板に、盤の絵・名前・ひとこと・人数と種類の札
            val shape = RoundedCornerShape(18.dp)
            Row(
                Modifier.fillMaxWidth().padding(top = 4.dp)
                    .drawBehind { drawRoundRect(Color(0xFF123222), Offset(0f, 3.dp.toPx()), size, CornerRadius(18.dp.toPx())) }
                    .clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF27634A), Color(0xFF1A4A34)))).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                GameBox(gi.id, 84.dp, corner = 12.dp)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    // 長い名前は字を小さくして、言葉の途中で折り返さないようにする
                    val title = when (gi.id) { "chinese" -> "チャイニーズ\nチェッカー"; "solitaire" -> "ソリティア\n(クロンダイク)"; else -> gi.name }
                    val longest = title.split('\n').maxOf { it.length }
                    FitText(title, Color.White, FontWeight.Black, if (longest <= 6) 22f else 19f, 13f, maxLines = 2)
                    Text(gi.intro, color = Color(0xFFDCEBE1), fontSize = 11.5.sp, lineHeight = 17.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        HeroTag(gi.players)
                        HeroTag(gi.category.label)
                    }
                }
            }
            if (!gi.playable) {
                Text("このゲームはまだ遊べません(準備中)。ルールの説明と対戦は、今後の更新で追加します。", color = c.sub, fontSize = 14.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 16.dp))
            } else {
                val total = gi.def?.seatsFor(options) ?: 1
                val pass = localMode == "pass"
                val canPass = gi.def != null && model.maxPlayers(gi) >= 2 && gi.id !in setOf("speed", "solitaire")
                if (canPass) {
                    PanelLabel("遊び方")
                    Segmented(listOf("cpu" to "CPUと対戦", "pass" to "手番ごとに交代"), localMode, { tap(); localMode = it })
                }
                // 人数と相手
                val playersSpec = gi.options.firstOrNull { it.key == "players" }
                if (playersSpec != null || !solo) {
                    PanelLabel("人数と相手")
                    Panel {
                        if (playersSpec != null) {
                            val vals = if (gi.id == "blackjack" && chosen["bjStyle"] == "pot") playersSpec.values.filter { it.first != "1" } else playersSpec.values
                            val cur = chosen["players"] ?: playersSpec.default
                            val idx = vals.indexOfFirst { it.first == cur }.coerceAtLeast(0)
                            val cpus = (total - if (pass) localHumans else 1).coerceAtLeast(0)
                            PanelRow("合計の人数", if (cpus > 0) "CPU ${cpus}人" else null) {
                                Stepper(vals.getOrNull(idx)?.second ?: "", idx > 0, idx < vals.size - 1,
                                    onMinus = { tap(); chosen["players"] = vals[idx - 1].first }, onPlus = { tap(); chosen["players"] = vals[idx + 1].first })
                            }
                        }
                        if (!solo) {
                            PanelRow("CPUの強さ", divider = playersSpec != null) {
                                MiniSegmented(Level.values().map { it.ordinal to it.label }, level, { tap(); level = it })
                            }
                            val seatOpts = listOf(0 to gi.seatNames[0], 1 to gi.seatNames[1], -1 to "ランダム")
                            if (fitsMini(seatOpts.map { it.second })) PanelRow("手番", divider = true) { MiniSegmented(seatOpts, seat, { tap(); seat = it }) }
                            else PanelRow("手番", divider = true, below = { Segmented(seatOpts, seat, { tap(); seat = it }) })
                        }
                    }
                }
                // 手番ごとに交代(CPUと対戦の時も場所は変えず、薄くして触れなくする)
                if (canPass) {
                    localHumans = localHumans.coerceIn(1, total)
                    PanelLabel("手番ごとに交代", enabled = pass)
                    Panel(enabled = pass, switched = true) {
                        PanelRow("交代する人") {
                            Stepper("${localHumans}人", pass && localHumans > 1, pass && localHumans < total,
                                onMinus = { tap(); localHumans-- }, onPlus = { tap(); localHumans++ })
                        }
                        // 1人目は表示名(設定の画面で変える)。2人目からはここで決める
                        PanelRow("1人目", "表示名(設定で変更)", divider = true) {
                            Text(model.playerName.ifBlank { "プレイヤー1" }, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Black, maxLines = 1)
                        }
                        for (i in 1 until localHumans) {
                            PanelRow("${i + 1}人目の名前", divider = true) { NameBox(i, names[i], pass) { names[i] = it } }
                        }
                        PanelRow("手番ごとに画面を上下反対にする", "向かい合って座る時", divider = true, onClick = if (pass) ({ tap(); rotateTurns = !rotateTurns }) else null) {
                            Toggle(rotateTurns)
                        }
                    }
                }
                // ルールとローカルルール
                val ruleSpecs = gi.options.filter { it.key != "players" && it.group == "rule" }
                val localSpecs = gi.options.filter { it.group == "local" }
                if (ruleSpecs.isNotEmpty() || gi.id == "reversi") {
                    PanelLabel("ルール")
                    Panel {
                        ruleSpecs.forEachIndexed { i, spec -> OptionItem(spec, chosen[spec.key] ?: spec.default, divider = i > 0) { tap(); chosen[spec.key] = it } }
                        if (gi.id == "reversi") PanelRow("置ける場所を表示", divider = ruleSpecs.isNotEmpty(), onClick = { tap(); model.changeHints(!model.showHints) }) { Toggle(model.showHints) }
                    }
                }
                if (localSpecs.isNotEmpty()) {
                    PanelLabel("ローカルルール")
                    Panel { localSpecs.forEachIndexed { i, spec -> OptionItem(spec, chosen[spec.key] ?: spec.default, divider = i > 0) { tap(); chosen[spec.key] = it } } }
                }
                gi.options.firstOrNull { it.key == "moveSeconds" }?.let { spec ->
                    PanelLabel("時間")
                    Panel {
                        OptionItem(spec, chosen[spec.key] ?: spec.default, divider = false) { tap(); chosen[spec.key] = it }
                        // 時間切れの扱いは、制限時間がある時だけ選べる
                        val limited = (chosen[spec.key] ?: spec.default) != "0"
                        gi.options.firstOrNull { it.key == "timeoutRule" }?.takeIf { limited }?.let { rule ->
                            OptionItem(rule, chosen[rule.key] ?: rule.default, divider = true) { tap(); chosen[rule.key] = it }
                        }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 16.dp, end = 16.dp, bottom = 10.dp, top = 6.dp)) {
            BigButton(if (gi.playable) "スタート" else "準備中", Modifier.fillMaxWidth(), primary = true, enabled = gi.playable) {
                tap()
                model.startGame(gi, options, Level.values()[level], seat)
            }
        }
    }
}

/** 設定の板の見出し */
@Composable
private fun PanelLabel(text: String, enabled: Boolean = true) {
    val c = LocalAsobi.current
    Text(text, color = c.sub.copy(alpha = if (enabled) 1f else 0.5f), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
        modifier = Modifier.padding(start = 2.dp, top = 14.dp, bottom = 6.dp))
}

/** 項目をまとめる板(角丸 14dp・細い線)。enabled=false なら薄くして触れなくする */
@Composable
private fun Panel(enabled: Boolean = true, switched: Boolean = false, content: @Composable () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(14.dp)
    // switched = 入り切りのある板。線の太さは変えず(高さが揺れない)、入っている時は金の線、切れている時は灰色の地に薄い字
    val edge = if (switched) (if (enabled) c.accent else c.line) else c.line
    Box(Modifier.fillMaxWidth().clip(shape).background(if (switched && !enabled) c.well else c.surface).border(if (switched) 2.dp else 1.dp, edge, shape)) {
        Column(Modifier.fillMaxWidth().alpha(if (enabled) 1f else 0.4f)) { content() }
        // 触れなくする覆い(下の部品にタップを渡さない)
        if (!enabled) Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } })
    }
}

/** 板の中の1行(高さ 44dp から)。右に部品、below があれば行の下に全幅の部品 */
@Composable
private fun PanelRow(
    title: String, sub: String? = null, divider: Boolean = false, onClick: (() -> Unit)? = null,
    below: (@Composable () -> Unit)? = null, trailing: (@Composable () -> Unit)? = null,
) {
    val c = LocalAsobi.current
    if (divider) Box(Modifier.fillMaxWidth().height(1.dp).background(c.line))
    Column(
        Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(role = Role.Switch, onClick = onClick) else Modifier)
            .heightIn(min = 44.dp).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f)) {
                Text(title, color = c.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, lineHeight = 17.sp)
                if (sub != null) Text(sub, color = c.sub, fontSize = 10.5.sp, lineHeight = 14.sp)
            }
            if (trailing != null) trailing()
        }
        if (below != null) { Spacer(Modifier.height(6.dp)); below() }
    }
}

/** 値が「あり/なし」の項目か(スイッチにする)。オンにあたる値を返す */
private val ON_LABELS = setOf("あり", "する", "つなぐ", "3枚")
private val OFF_LABELS = setOf("なし", "しない", "つながない")
private fun switchOn(spec: OptionSpec): String? {
    if (spec.values.size != 2) return null
    val on = spec.values.firstOrNull { it.second in ON_LABELS } ?: return null
    spec.values.firstOrNull { it.second in OFF_LABELS } ?: return null
    return on.first
}

/** 右の小さな切り替えに入る長さか(3つまでで短い) */
private fun fitsMini(labels: List<String>) = labels.size <= 3 && labels.sumOf { it.length } <= 11 && labels.all { it.length <= 6 }

/** ルールの1項目: あり/なしはスイッチ、3つまでで短いものは右の小さな切り替え、ほかは行の下に全幅の切り替え */
@Composable
private fun OptionItem(spec: OptionSpec, value: String, divider: Boolean, onChange: (String) -> Unit) {
    val on = switchOn(spec)
    when {
        on != null -> {
            val off = spec.values.first { it.first != on }.first
            PanelRow(spec.label, spec.hint, divider, onClick = { onChange(if (value == on) off else on) }) { Toggle(value == on) }
        }
        fitsMini(spec.values.map { it.second }) -> PanelRow(spec.label, spec.hint, divider) { MiniSegmented(spec.values, value, onChange) }
        else -> PanelRow(spec.label, spec.hint, divider, below = { Segmented(spec.values, value, onChange) })
    }
}

/** 行の右の小さな切り替え */
@Composable
private fun <T> MiniSegmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    val c = LocalAsobi.current
    Row(Modifier.clip(RoundedCornerShape(9.dp)).background(c.well).padding(2.dp)) {
        for ((v, label) in options) {
            val on = v == selected
            Text(
                label, color = if (on) c.onSelect else c.sub, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1,
                modifier = Modifier.clip(RoundedCornerShape(7.dp)).background(if (on) c.select else Color.Transparent)
                    .clickable(role = Role.RadioButton) { onSelect(v) }.heightIn(min = 30.dp).padding(horizontal = 9.dp, vertical = 6.dp),
            )
        }
    }
}

/** 人数の「− 4人 ＋」 */
@Composable
private fun Stepper(label: String, canMinus: Boolean, canPlus: Boolean, onMinus: () -> Unit, onPlus: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(9.dp)
    Row(Modifier.clip(shape).border(1.dp, c.line, shape), verticalAlignment = Alignment.CenterVertically) {
        for ((i, sign) in listOf("−", "＋").withIndex()) {
            if (i == 1) Text(label, color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.widthIn(min = 48.dp).padding(horizontal = 4.dp))
            val en = if (i == 0) canMinus else canPlus
            Box(
                Modifier.size(width = 36.dp, height = 32.dp).background(c.well).clickable(enabled = en, role = Role.Button, onClickLabel = if (i == 0) "減らす" else "増やす") { if (i == 0) onMinus() else onPlus() },
                contentAlignment = Alignment.Center,
            ) { Text(sign, color = if (en) c.ink else c.sub.copy(alpha = 0.4f), fontSize = 16.sp, fontWeight = FontWeight.Black) }
        }
    }
}

/** 2人目からの名前の欄(小さな入力欄) */
@Composable
private fun NameBox(index: Int, value: String, enabled: Boolean, onChange: (String) -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(9.dp)
    Box(Modifier.width(150.dp).clip(shape).background(c.bg).border(1.dp, c.line, shape).padding(horizontal = 10.dp, vertical = 7.dp)) {
        if (value.isEmpty()) Text("プレイヤー${index + 1}", color = c.sub, fontSize = 13.sp)
        androidx.compose.foundation.text.BasicTextField(
            value, { onChange(cleanName(it)) }, enabled = enabled, singleLine = true,
            textStyle = androidx.compose.material3.LocalTextStyle.current.merge(androidx.compose.ui.text.TextStyle(color = c.ink, fontSize = 13.sp)),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(c.accentInk), modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** 名前に使えない文字(保存の区切り)を除く */
private fun cleanName(s: String) = s.filter { it !in "|,:;=\n" }.take(10)

@Composable
private fun HeroTag(text: String) {
    Text(
        text, color = Color.White, fontSize = 11.sp,
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Color(0x47000000)).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

// =====================================================================
// ルール(図解つき)
// =====================================================================

@Composable
fun RulesScreen(model: AppModel, gameId: String) {
    val gi = Catalog.byId(gameId) ?: return
    Column(Modifier.fillMaxSize()) {
        TopBar("${gi.name}のルール", onBack = { model.back() }, gameId = gi.id)
        RulesContent(gi, Modifier.weight(1f).fillMaxWidth().navigationBarsPadding())
    }
}

/** ルールの各項目(図解+説明)。説明画面と対局中のルールで共通 */
@Composable
fun RulesContent(gi: GameInfo, modifier: Modifier = Modifier) {
    val c = LocalAsobi.current
    LazyColumn(modifier, contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(gi.sections) { sec ->
            CardBox(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(c.accent))
                        Text(sec.title, color = c.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    for (d in sec.demos) RuleDemo(d)
                    if (gi.id == "uno" && sec.title == "特殊な札") OhNoSpecialCards()
                    else Text(sec.body, color = c.ink, fontSize = 14.sp, lineHeight = 24.sp)
                }
            }
        }
    }
}

// =====================================================================
// 設定
// =====================================================================

@Composable
fun SettingsScreen(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val focus = LocalFocusManager.current
    var name by remember { mutableStateOf(model.playerName) }
    Column(Modifier.fillMaxSize()) {
        TopBar("設定", onBack = { if (model.screen == Screen.Home) model.homeTab = 0 else model.back() })
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SectionLabel("テーマ", Modifier.padding(top = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ThemeCard("ライト", model.themeMode == 1, Brush.verticalGradient(listOf(LightColors.bgTop, LightColors.bgBottom)), Modifier.weight(1f)) { tap(); model.changeTheme(1) }
                ThemeCard("ダーク", model.themeMode == 2, Brush.verticalGradient(listOf(DarkColors.bgTop, DarkColors.bgBottom)), Modifier.weight(1f)) { tap(); model.changeTheme(2) }
                ThemeCard(
                    "端末の設定", model.themeMode == 0,
                    Brush.horizontalGradient(0.5f to LightColors.bgTop, 0.5f to DarkColors.bgTop), Modifier.weight(1f),
                ) { tap(); model.changeTheme(0) }
            }

            SectionLabel("プレイ", Modifier.padding(top = 10.dp))
            CardBox(Modifier.fillMaxWidth()) {
                Column {
                    ToggleRow("置ける場所を表示", "リバーシの点など。CPU対戦のヒントになります", model.showHints) { tap(); model.changeHints(it) }
                    Divider()
                    ToggleRow("効果音", "タップ音(端末の「タッチ操作音」がオフだと鳴りません)", model.tapSound) { model.changeTapSound(it) }
                }
            }

            SectionLabel("CPUの手番の長さ", Modifier.padding(top = 10.dp))
            Segmented(listOf(0 to "短め", 1 to "普通", 2 to "長め"), model.cpuPace, { tap(); model.changeCpuPace(it) })
            Text("CPUの手の動きと間の長さです(考える強さは変わりません)。CPUとの対戦中は、画面をダブルタップするとCPUの番をとばせます。", color = c.sub, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(horizontal = 4.dp))

            SectionLabel("CPUの強さ(初期選択)", Modifier.padding(top = 10.dp))
            Segmented(Level.values().map { it.ordinal to it.label }, model.defaultLevel, { tap(); model.changeDefaultLevel(it) })

            SectionLabel("プレイヤー", Modifier.padding(top = 10.dp))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(12); model.changePlayerName(name) },
                label = { Text("名前") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = c.accent, unfocusedBorderColor = c.line, focusedLabelColor = c.accentInk, cursorColor = c.accentInk,
                    focusedTextColor = c.ink, unfocusedTextColor = c.ink,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            AvatarSetting(model)

            SectionLabel("ライセンス", Modifier.padding(top = 10.dp))
            Text(
                "字: Zen Maru Gothic(SIL Open Font License 1.1)\n将棋の駒・麻雀の牌の字: Yuji Boku(SIL Open Font License 1.1)\n碁石・リバーシの石の音: KaTrain(Jordan Seaward, MIT License)\n将棋の駒の音: ShogiHome(Kubo Ryosuke, MIT License)\nCompose Multiplatform・Kotlin(Apache License 2.0)\n画面の描画: Skiko(Apache License 2.0)・Skia(BSD 3-Clause License)\n通信対戦: ブラウザの WebRTC",
                color = c.sub, fontSize = 12.sp, lineHeight = 20.sp,
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ThemeCard(label: String, on: Boolean, preview: Brush, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalAsobi.current
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier.clip(shape).background(c.surface)
            .then(if (on) Modifier.background(c.accent.copy(alpha = 0.14f)) else Modifier)
            .clickable(role = Role.RadioButton, onClick = onClick).padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier.fillMaxWidth().height(64.dp).clip(RoundedCornerShape(10.dp)).background(preview)
                .then(if (on) Modifier.background(Color.Transparent) else Modifier),
        )
        // 字を大きくした端末でも切れないよう、入りきらない時は字を小さくする
        FitText(label, if (on) c.accentInk else c.ink, if (on) FontWeight.Black else FontWeight.Normal, 13f, 8f, maxLines = 1)
        Box(Modifier.size(width = 28.dp, height = 4.dp).clip(RoundedCornerShape(2.dp)).background(if (on) c.accent else Color.Transparent))
    }
}

@Composable
private fun ToggleRow(title: String, note: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val c = LocalAsobi.current
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Switch) { onChange(!checked) }.padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = c.ink, fontSize = 15.sp)
            Text(note, color = c.sub, fontSize = 12.sp, lineHeight = 18.sp)
        }
        Toggle(checked)
    }
}

@Composable
private fun Divider() {
    val c = LocalAsobi.current
    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(c.line))
}

/** プレイヤーのアイコン(写真を選ぶ・元に戻す) */
@Composable
private fun AvatarSetting(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    var cropUri by remember { mutableStateOf<Uri?>(null) }
    cropUri?.let { uri -> AvatarCrop(uri, model) { cropUri = null } }
    val pick = rememberImagePicker { uri ->
        if (uri != null) cropUri = uri
    }
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        PlayerFace(model.avatar, human = true, cpuIndex = 0, size = 56.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "写真を選ぶ", color = c.onAccent, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(c.accent).clickable(role = Role.Button) {
                        tap(); pick()
                    }.padding(horizontal = 14.dp, vertical = 8.dp),
                )
                if (model.avatar != null) Text(
                    "元に戻す", color = c.ink, fontSize = 13.sp,
                    modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(c.chip).clickable(role = Role.Button) { tap(); model.clearAvatar() }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
            if (model.avatarFailed) Text("この写真は読み込めませんでした", color = c.sub, fontSize = 12.sp)
        }
    }
}
