package jp.yonekou.asobi26.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import jp.yonekou.asobi26.AppModel
import jp.yonekou.asobi26.web.Uri
import jp.yonekou.asobi26.web.rememberImagePicker

/** 初回起動の画面: 表示名とアイコンの写真。どちらも飛ばせる(あとから設定で変えられる) */
@Composable
fun FirstRunScreen(model: AppModel) {
    val c = LocalAsobi.current
    val tap = rememberTap(model.tapSound)
    var name by remember { mutableStateOf("") }
    var cropUri by remember { mutableStateOf<Uri?>(null) }
    cropUri?.let { uri -> AvatarCrop(uri, model) { cropUri = null } }
    val pick = rememberImagePicker { uri -> if (uri != null) cropUri = uri }
    // 下の画面へ操作を通さない
    Box(Modifier.fillMaxSize().screenBackground(c).clickable(enabled = true, indication = null, interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }) { }) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(24.dp))
            Text("はじめまして", color = c.ink, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Text("日本アソビ大辞典", color = c.accentInk, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(32.dp))
            PlayerFace(model.avatar, human = true, cpuIndex = 0, size = 112.dp)
            Spacer(Modifier.height(14.dp))
            Row2(model, pick, tap)
            if (model.avatarFailed) Text("この写真は読み込めませんでした", color = c.sub, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            Spacer(Modifier.height(28.dp))
            Text("表示名", color = c.sub, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.Start).padding(bottom = 6.dp))
            OutlinedTextField(
                name, { v -> name = v.filter { it !in "|,:;=\n" }.take(12) }, Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text("あなた", color = c.sub) }, shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = c.ink, unfocusedTextColor = c.ink, focusedBorderColor = c.accent, unfocusedBorderColor = c.line, cursorColor = c.accent),
            )
            Text("通信対戦で相手に見える名前です(12文字まで)", color = c.sub, fontSize = 11.sp, modifier = Modifier.align(Alignment.Start).padding(top = 6.dp))
            Spacer(Modifier.height(32.dp))
            BigButton("はじめる", Modifier.fillMaxWidth(), primary = true) { tap(); model.finishOnboarding(name) }
            Text(
                "スキップ", color = c.sub, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 10.dp).clip(RoundedCornerShape(12.dp)).clickable(role = Role.Button) { tap(); model.finishOnboarding("") }.padding(horizontal = 24.dp, vertical = 12.dp),
            )
            Text("あとから設定で変えられます", color = c.sub, fontSize = 11.sp)
        }
    }
}

@Composable
private fun Row2(model: AppModel, pick: () -> Unit, tap: () -> Unit) {
    val c = LocalAsobi.current
    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "写真を選ぶ", color = c.onAccent, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(c.accent).clickable(role = Role.Button) {
                tap(); pick()
            }.padding(horizontal = 16.dp, vertical = 9.dp),
        )
        if (model.avatar != null) Text(
            "元に戻す", color = c.ink, fontSize = 13.sp,
            modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(c.chip).clickable(role = Role.Button) { tap(); model.clearAvatar() }.padding(horizontal = 16.dp, vertical = 9.dp),
        )
    }
}
