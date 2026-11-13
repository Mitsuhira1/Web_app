package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.ui.platform.testTag
import jp.yonekou.asobi26.Screen
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.heightIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.core.Catalog
import jp.yonekou.asobi26.core.net.AutoReply
import jp.yonekou.asobi26.core.net.AutoSend
import jp.yonekou.asobi26.core.net.InviteState
import jp.yonekou.asobi26.core.net.OnlineRoom

// =====================================================================
// 近くの人との通信の許可(MineLink と同じ)
// =====================================================================

/** 近くの人との通信: ブラウザでは許可の確認がないので、そのまま行う(通信の部品が「Web 版では使えません」と知らせる) */
@Composable
fun rememberNearbyGate(): (() -> Unit) -> Unit = { action -> action() }

/** 文字を共有する(LINE などで送る)。ブラウザの共有の機能(なければコピー) */
private fun shareText(@Suppress("UNUSED_PARAMETER") ctx: Context, text: String) = webShare(text)

@Composable
private fun SmallButton(text: String, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val c = LocalAsobi.current
    Text(
        text, color = if (!enabled) c.sub else if (primary) c.onAccent else c.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(if (primary && enabled) c.accent else c.chip)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

/** コードを見せる箱(等幅の字・コピー・送る) */
@Composable
private fun CodeBox(code: String) {
    val c = LocalAsobi.current
    val clip = LocalClipboardManager.current
    val ctx = LocalContext.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            code, color = c.ink, fontSize = 12.sp, fontFamily = FontFamily.Monospace, lineHeight = 17.sp,
            modifier = Modifier.fillMaxWidth().heightIn(max = 180.dp).verticalScroll(rememberScrollState()).clip(RoundedCornerShape(12.dp)).background(c.chip).padding(10.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SmallButton("コピー") { clip.setText(AnnotatedString(code)); Toast.makeText(ctx, "コピーしました", Toast.LENGTH_SHORT).show() }
            SmallButton("送る", primary = true) { shareText(ctx, code) }
        }
    }
}

@Composable
private fun CodeInput(label: String, button: String, enabled: Boolean = true, onSubmit: (String) -> Unit) {
    val c = LocalAsobi.current
    var text by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = text, onValueChange = { text = it }, label = { Text(label) }, maxLines = 3,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (text.isNotBlank()) onSubmit(text) }),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = c.accent, unfocusedBorderColor = c.line, focusedLabelColor = c.accentInk, cursorColor = c.accentInk,
                focusedTextColor = c.ink, unfocusedTextColor = c.ink,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        SmallButton(button, primary = true, enabled = enabled && text.isNotBlank()) { onSubmit(text) }
    }
}

// =====================================================================
// 部屋(ロビー)
// =====================================================================

@Composable
fun LobbyScreen(model: AppModel) {
    model.onlineTick
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val r = model.room ?: return
    var showInvite by remember(r) { mutableStateOf(false) }
    var previousInvites by remember(r) { mutableStateOf(emptySet<String>()) }
    // ゲームは1回目のタップで仮選択、同じゲームをもう一度タップで決める
    var pendingId by remember { mutableStateOf<String?>(null) }
    val selectedGameId = pendingId ?: r.gameId
    val gi = Catalog.byId(selectedGameId)
    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize()) {
        TopBar(if (r.isHost) "あなたの部屋" else "部屋", subtitle = if (model.roomOnline) "オンライン" else "近くの人と", onBack = { model.back() }) {
            // 同じ部屋の人とのチャット(対局の前でも送れる)
            if (r.phase != OnlineRoom.Phase.JOINING) ChatButton(model)
        }
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (r.phase == OnlineRoom.Phase.JOINING) {
                CardBox(Modifier.fillMaxWidth()) {
                    Text("ホストにつないでいます…", color = c.ink, fontSize = 14.sp, modifier = Modifier.padding(16.dp))
                }
            }
            r.transportError?.let { err ->
                Text(
                    if (err.contains("MISSING_PERMISSION")) "権限が足りません。アプリの設定で「近くのデバイス」と「位置情報」を許可してください。"
                    else "近くの端末と通信を始められません($err)。Bluetooth と Wi-Fi がオンか確かめてください。",
                    color = Color(0xFFC8322B), fontSize = 12.sp, lineHeight = 18.sp,
                )
            }
            // オンラインのホスト: 招待コード(必ず押すので、いちばん上に置く)
            val book = model.invites
            if (r.isHost && book != null) {
                SectionLabel("招待コード(1人に1つ)")
                for (inv in book.items) {
                    CardBox(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                when (inv.state) {
                                    InviteState.WAITING_REPLY -> when (inv.auto) {
                                        AutoReply.LISTENING -> "この招待コードを送ってください。相手がコードを貼ると、自動でつながります"
                                        AutoReply.STARTING -> "この招待コードを送ってください(自動で受け取る準備をしています)"
                                        else -> "この招待コードを送り、相手の「返信コード」を下に貼ってください"
                                    }
                                    InviteState.CONNECTING -> "つないでいます…"
                                    InviteState.FAILED -> "つながりませんでした" + (inv.error?.let { "($it)" } ?: "")
                                },
                                color = c.ink, fontSize = 13.sp, lineHeight = 19.sp,
                            )
                            if (inv.state == InviteState.WAITING_REPLY) {
                                CodeBox(inv.code)
                                CodeInput("返信コード", "つなぐ") { text -> book.submitReply(inv, text) }
                            }
                            SmallButton("取り消す") { book.cancel(inv) }
                        }
                    }
                }
                book.error?.let { Text(it, color = Color(0xFFC8322B), fontSize = 12.sp) }
                SmallButton(if (book.creating) "作っています…" else "招待コードを作る", primary = true, enabled = book.canCreate) { tap(); previousInvites = book.items.map { it.peerId }.toSet(); showInvite = true; book.create() }
            }
            SectionLabel("参加者 ${r.members.size}/${OnlineRoom.MAX}")
            CardBox(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((i, m) in r.members.withIndex()) {
                        val me = m.slot == r.mySlot
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PlayerFace(if (me) model.avatar else null, human = me, cpuIndex = i, size = 34.dp)
                            Text(m.name + if (me && m.name != "あなた") "(あなた)" else "", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            if (m.slot == 0) Tag("ホスト")
                        }
                    }
                }
            }
            // 古い版の人がいる時の知らせ
            r.legacyNames().takeIf { it.isNotEmpty() }?.let { names ->
                Text("${names.joinToString("・")}のアプリが古い版です。「待った」・チャット・時間切れの「負け」は使えません。", color = c.sub, fontSize = 12.sp, lineHeight = 18.sp)
            }
            if (r.isHost) {
                val blocked = model.onlineGames.filter { model.mismatchNames(it).isNotEmpty() }
                if (blocked.isNotEmpty()) Text(
                    "${blocked.flatMap { model.mismatchNames(it) }.distinct().joinToString("・")}のアプリの版が違うので、${blocked.joinToString("・") { it.name }}は選べません。アプリを新しくしてもらってください。",
                    color = Color(0xFFC8322B), fontSize = 12.sp, lineHeight = 18.sp,
                )
            }
            SectionLabel("遊ぶゲーム")
            if (r.isHost) {
                Text("${r.members.size}人で遊べるゲーム", color = c.sub, fontSize = 12.sp)
                for (row in model.onlineGames.filter { model.canChooseOnline(it) }.chunked(3)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        for (g in row) Box(Modifier.weight(1f).border(2.dp,
                            if (g.id == selectedGameId) c.accent else Color.Transparent, RoundedCornerShape(12.dp)).padding(5.dp)) {
                            Column {
                            Text(if (g.id == selectedGameId) "✓ " + g.name else " ", color = c.ink, fontSize = 11.sp)
                            GameTile(g) {
                                tap()
                                if (pendingId == g.id) { if (g.id != r.gameId) model.chooseOnlineGame(g.id); pendingId = null; model.open(Screen.RoomSettings) }
                                else pendingId = g.id
                            }
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
                if (gi != null && !model.canChooseOnline(gi)) Text("参加人数が増えました。人数に合うゲームを選んでください。", color = c.ink)
            } else if (gi != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    GameBox(gi.id, 56.dp, corner = 14.dp, artScale = 0.8f)
                    Column {
                        Text(gi.name, color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Black)
                        Text("ホストが選んでいます", color = c.sub, fontSize = 12.sp)
                    }
                }
            }
            if (!r.isHost && r.phase == OnlineRoom.Phase.LOBBY) {
                Text("ホストが始めるのを待っています", color = c.sub, fontSize = 13.sp)
            }
            Spacer(Modifier.height(10.dp))
        }
        if (r.isHost) {
            Box(Modifier.navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp)) {
                BigButton("ゲーム設定へ", Modifier.fillMaxWidth(), primary = true, enabled = gi != null && model.canChooseOnline(gi) && r.phase == OnlineRoom.Phase.LOBBY) { tap(); model.open(Screen.RoomSettings) }
            }
        }
    }
    ChatOverlay(model)
    OnlineUndoOverlay(model)
    }
    if (showInvite) AlertDialog(
        onDismissRequest = { showInvite = false },
        title = { Text("招待コード") },
        text = {
            val book = model.invites
            val invitation = book?.items?.firstOrNull { it.peerId !in previousInvites }
            if (book?.creating == true) Text("作っています…", color = c.ink)
            else if (book?.error != null) Text(book.error.orEmpty(),color=c.ink)
            else if (invitation != null) CodeBox(invitation.code)
            else Text(book?.error ?: "コードを作れませんでした。もう一度試してください。", color = c.ink)
        },
        confirmButton = { TextButton(onClick = { showInvite = false }) { Text("閉じる") } },
        containerColor = c.surface,
    )

}

/** 部屋を保ったまま、選んだゲームの設定と開始を行う。 */
@Composable
fun OnlineGameSettingsScreen(model: AppModel) {
    model.onlineTick
    val r = model.room ?: return
    val gi = Catalog.byId(r.gameId) ?: return
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val available = model.canChooseOnline(gi)
    Column(Modifier.fillMaxSize().testTag("onlineGameSettings")) {
        TopBar("ゲーム設定", subtitle = "参加者 ${r.members.size}人", onBack = { model.back() })
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                GameBox(gi.id, 72.dp, corner = 16.dp, artScale = 0.8f)
                Column {
                    Text(gi.name, color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text(gi.intro, color = c.sub, fontSize = 13.sp)
                }
            }
            if (!available) Text("参加人数が増えました。戻って人数に合うゲームを選んでください。", color = c.ink)
            if (r.isHost && available) for (spec in gi.options) {
                if (spec.key == "timeoutRule" && r.options.str("moveSeconds", "0") == "0") continue
                SectionLabel(if (spec.key == "players") "合計人数(CPU ${((gi.def?.seatsFor(r.options) ?: 0) - r.members.size).coerceAtLeast(0)}人)" else spec.label)
                val values = if (spec.key == "players") spec.values.filter {
                    (it.first.toIntOrNull() ?: 0) >= maxOf(r.members.size, if (gi.id == "blackjack" && r.options.str("bjStyle", "dealer") == "pot") 2 else 1)
                } else spec.values
                Segmented(values, r.options.str(spec.key, spec.default), { value ->
                    tap()
                    var options = r.options.with(spec.key, value)
                    if (gi.id == "blackjack" && spec.key == "bjStyle" && value == "pot" && options.int("players", 2) < 2) options = options.with("players", "2")
                    r.choose(r.gameId, options)
                })
            }
            Spacer(Modifier.height(12.dp))
        }
        Box(Modifier.fillMaxWidth().background(c.surface).navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp)) {
            BigButton("始める", Modifier.fillMaxWidth().testTag("onlineStart"), primary = true,
                enabled = r.isHost && available && r.members.size >= 2 && r.phase == OnlineRoom.Phase.LOBBY) { tap(); model.startOnlineGame() }
        }
    }
}

// =====================================================================
// 参加する(近くの部屋 / 招待コード)
// =====================================================================

@Composable
fun JoinScreen(model: AppModel) {
    model.onlineTick
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    val gate = rememberNearbyGate()
    // 画面を開いたら近くの部屋を探し始め、閉じたら止める
    DisposableEffect(Unit) {
        onDispose { model.stopScan() }
    }
    Column(Modifier.fillMaxSize()) {
        TopBar("ルームに参加", onBack = { model.back() })
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SectionLabel("近くの部屋")
            val sc = model.scanner
            if (sc == null) {
                SmallButton("近くの部屋を探す", primary = true) { tap(); gate { model.startScan() } }
            } else {
                sc.error?.let { Text("近くの端末と通信を始められません($it)。Bluetooth と Wi-Fi がオンか確かめてください", color = Color(0xFFC8322B), fontSize = 12.sp) }
                if (sc.rooms.isEmpty()) Text("探しています…(ホストが部屋を作ると、ここに出ます)", color = c.sub, fontSize = 13.sp)
                for (f in sc.rooms) {
                    val g = Catalog.byId(f.gameId)
                    CardBox(Modifier.fillMaxWidth()) {
                        Row(
                            Modifier.fillMaxWidth().clickable(role = Role.Button) { tap(); model.joinNearby(f) }.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (g != null) GameBox(g.id, 44.dp, corner = 12.dp, artScale = 0.8f)
                            Column(Modifier.weight(1f)) {
                                Text("${f.hostName}の部屋", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                Text("${g?.name ?: ""} ・ ${f.count}人", color = c.sub, fontSize = 12.sp)
                            }
                            SmallButton("入る", primary = true) { tap(); model.joinNearby(f) }
                        }
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            SectionLabel("招待コードで参加(オンライン)")
            val flow = model.joinFlow
            val reply = flow?.replyCode
            when {
                reply != null -> {
                    Text(
                        when (flow.autoSend) {
                            AutoSend.SENT -> "返信をホストに届けました。ホストの画面でつながるのを待っています…"
                            AutoSend.SENDING -> "返信をホストに届けています…"
                            else -> "この返信コードをホストに送ってください。ホストが貼るとつながります"
                        },
                        color = c.ink, fontSize = 13.sp, lineHeight = 19.sp,
                    )
                    if (flow.autoSend != AutoSend.SENT && flow.autoSend != AutoSend.SENDING) CodeBox(reply)
                    SmallButton("やり直す") { tap(); model.cancelJoin() }
                }
                flow?.busy == true -> Text("返信コードを作っています…", color = c.sub, fontSize = 13.sp)
                else -> {
                    flow?.error?.let { Text(it, color = Color(0xFFC8322B), fontSize = 12.sp) }
                    CodeInput("ホストからの招待コード", "参加する") { text -> tap(); model.submitInvite(text) }
                }
            }
            Text(
                "オンラインでは、つなぐ時だけ公開の中継サーバー(ntfy.sh)と STUN サーバーを使います。相手と自分のIPアドレスが、これらのサーバーと相手に伝わります。",
                color = c.sub, fontSize = 11.sp, lineHeight = 17.sp,
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}

/** みんなで遊ぶ: 部屋を作る(近く・オンライン)/ 参加する */
@Composable
fun rememberHostActions(model: AppModel): Pair<() -> Unit, () -> Unit> {
    val gate = rememberNearbyGate()
    return { gate { model.hostRoom(online = false) } } to { model.hostRoom(online = true) }
}
