package jp.yonekou.asobi26

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import jp.yonekou.asobi26.res.Res
import jp.yonekou.asobi26.ui.AppRoot
import jp.yonekou.asobi26.ui.AsobiTheme
import jp.yonekou.asobi26.ui.LocalAsobi
import jp.yonekou.asobi26.ui.LocalSfx
import jp.yonekou.asobi26.web.WebApplication
import jp.yonekou.asobi26.web.WebFonts
import jp.yonekou.asobi26.web.dispatchBack
import kotlinx.browser.document
import org.jetbrains.compose.resources.ExperimentalResourceApi

/*
 * Web 版の入口(元のアプリの MainActivity にあたる)。画面は元のアプリの Compose のコードをそのまま使う。
 */

@JsFun("(f) => { globalThis.asobiOnBack = f; }")
private external fun jsSetBack(f: () -> Boolean)
@JsFun("() => { try { globalThis.asobiExit(); } catch (e) {} }")
private external fun jsExit()
@JsFun("() => { try { globalThis.asobiReady && globalThis.asobiReady(); } catch (e) {} }")
private external fun jsReady()
/** 自動の試験用: ゲームの設定画面を開く(globalThis.asobiTestOpen("reversi")) */
@JsFun("(f) => { globalThis.asobiTestOpen = f; }")
private external fun jsSetTestOpen(f: (String) -> Unit)

/** ホームで戻るを押した時の「終了しますか?」 */
private var askExit by mutableStateOf(false)

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    // ブラウザの戻る(Android の戻るボタン)は、画面の BackHandler へ渡す。受け取る人がいなければ(ホーム)終了の確認
    jsSetBack { if (askExit) { askExit = false; true } else if (dispatchBack()) true else { askExit = true; true } }
    ComposeViewport(document.body!!) { App() }
}

@OptIn(ExperimentalResourceApi::class)
@Composable
private fun App() {
    var ready by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        WebFonts.install(
            Res.readBytes("files/zen_maru_gothic_medium.ttf"),
            Res.readBytes("files/zen_maru_gothic_bold.ttf"),
            Res.readBytes("files/koma_yuji_boku.ttf"),
        )
        ready = true
        jsReady()
    }
    if (!ready) return
    val model = remember { AppModel(WebApplication) }
    LaunchedEffect(model) { jsSetTestOpen { id -> model.open(Screen.Detail(id)) } }
    val dark = when (model.themeMode) {
        1 -> false
        2 -> true
        else -> isSystemInDarkTheme()
    }
    AsobiTheme(dark) {
        CompositionLocalProvider(LocalSfx provides model.sfx) { AppRoot(model) }
        if (askExit) {
            val c = LocalAsobi.current
            AlertDialog(
                onDismissRequest = { askExit = false },
                title = { Text("このアプリを終了しますか?") },
                confirmButton = { TextButton(onClick = { askExit = false; jsExit() }) { Text("終了する") } },
                dismissButton = { TextButton(onClick = { askExit = false }) { Text("キャンセル") } },
                containerColor = c.surface,
            )
        }
    }
}
