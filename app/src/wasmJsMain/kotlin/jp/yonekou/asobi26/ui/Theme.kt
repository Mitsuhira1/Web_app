package jp.yonekou.asobi26.ui

import jp.yonekou.asobi26.web.*

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/**
 * アプリの色(0.5.8「机の上の実物」: 生成りの紙・くるみ・フェルトの緑・金)。ダークは濃いくるみ色。
 * indigo / shu は「席の色」(青・朱)として盤や図解で使う。強調の金は accent、選んでいる所の地は select。
 */
@Immutable
class AsobiColors(
    val dark: Boolean,
    val bgTop: Color,
    val bgBottom: Color,
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val line: Color,
    val ink: Color,
    val sub: Color,
    val indigo: Color,
    val indigoSoft: Color,
    val onIndigo: Color,
    val shu: Color,
    val onShu: Color,
    val tileBoard: Color,
    val tileCard: Color,
    val segment: Color,
    val good: Color,
    /** 強調の金(番の人の枠・選んでいる所の印) */
    val accent: Color,
    /** 金の地の上の文字 */
    val onAccent: Color,
    /** 文字で使う強調色(金) */
    val accentInk: Color,
    /** 丸いアイコンボタンなどの地 */
    val chip: Color,
    /** 下のタブの地 */
    val nav: Color,
    /** 切り替えで選んでいる所の地(ライトは濃い木、ダークは金) */
    val select: Color,
    val onSelect: Color,
    /** 小さな切り替え・スイッチの溝の地 */
    val well: Color,
    /** スイッチのオン(フェルトの緑) */
    val felt: Color,
    /** スタートなど主ボタンの地(上・下)と字 */
    val primaryTop: Color,
    val primaryBottom: Color,
    val onPrimary: Color,
) {
    val background: Brush get() = Brush.verticalGradient(listOf(bgTop, bgBottom))
    val primaryBrush: Brush get() = Brush.verticalGradient(listOf(primaryTop, primaryBottom))
}

/** 盤の上で選んでいる所・行き先の印に使う黄(盤の色に関係なく見える) */
val ACCENT = Color(0xFFFFC65C)
val ACCENT2 = Color(0xFFE0A33A)

/** 金のグラデーション(盤の上の主ボタンなど) */
val AccentBrush: Brush = Brush.verticalGradient(listOf(Color(0xFFE9BB5C), Color(0xFFCF9A34)))

/** 素材の色(デザイン資料 3章) */
object Mat {
    val walnutTop = Color(0xFF7B5233)
    val walnutBottom = Color(0xFF5A3A22)
    val walnutShadow = Color(0xFF3D2616)
    val oakTop = Color(0xFFB98952)
    val oakBottom = Color(0xFF98693A)
    val mapleTop = Color(0xFFE8CF9F)
    val mapleBottom = Color(0xFFD7B77E)
    val feltTop = Color(0xFF2C6B4D)
    val feltBottom = Color(0xFF1F5139)
    val feltLight = Color(0xFF2F7252)
    val feltDeep = Color(0xFF1A4732)
    val ivoryTop = Color(0xFFFFFDF5)
    val ivoryBottom = Color(0xFFECE4CF)
    val ivoryEdge = Color(0xFFB9AC8C)
    val komaTop = Color(0xFFF3DCA8)
    val komaBottom = Color(0xFFDEBA74)
    val komaSide = Color(0xFFB98F4C)
    val komaEdge = Color(0xFF8A6A35)
    val tileBack = Color(0xFFE2A23A)
    val tileBackEdge = Color(0xFFA8721C)
    val gold = Color(0xFFB98318)
    val goldDark = Color(0xFFE0AD4A)
}

val DarkColors = AsobiColors(
    dark = true,
    bgTop = Color(0xFF201A14), bgBottom = Color(0xFF18130E), bg = Color(0xFF1C1712),
    surface = Color(0xFF2A221A), surface2 = Color(0xFF342A20), line = Color(0xFF3D3226),
    ink = Color(0xFFF3EBDD), sub = Color(0xFFA89B88),
    indigo = Color(0xFF7FAEFF), indigoSoft = Color(0xFF2E3446), onIndigo = Color(0xFF0D1330),
    shu = Color(0xFFFF7A59), onShu = Color(0xFF2A0E06),
    tileBoard = Color(0xFF2C6B4D), tileCard = Color(0xFFC8463C),
    segment = Color(0xFF2A221A), good = Color(0xFF6DBB7F),
    accent = Mat.goldDark, onAccent = Color(0xFF2A1A08), accentInk = Mat.goldDark,
    chip = Color(0xFF342A20), nav = Color(0xFF2A221A),
    select = Mat.goldDark, onSelect = Color(0xFF2A1A08), well = Color(0xFF342A20), felt = Color(0xFF2E7552),
    primaryTop = Color(0xFFE9BB5C), primaryBottom = Color(0xFFCF9A34), onPrimary = Color(0xFF2A1A08),
)

val LightColors = AsobiColors(
    dark = false,
    bgTop = Color(0xFFF5F1E8), bgBottom = Color(0xFFEFEADF), bg = Color(0xFFF3EFE6),
    surface = Color(0xFFFFFDF8), surface2 = Color(0xFFF1EBDF), line = Color(0xFFE2D9C8),
    ink = Color(0xFF2A2118), sub = Color(0xFF7A6F60),
    indigo = Color(0xFF2F5FD0), indigoSoft = Color(0xFFE6E9F2), onIndigo = Color(0xFFFFFFFF),
    shu = Color(0xFFE2553A), onShu = Color(0xFFFFFFFF),
    tileBoard = Color(0xFF2C6B4D), tileCard = Color(0xFFC8463C),
    segment = Color(0xFFFFFDF8), good = Color(0xFF2F7A4D),
    accent = Mat.gold, onAccent = Color(0xFFFFFFFF), accentInk = Mat.gold,
    chip = Color(0xFFFFFDF8), nav = Color(0xFFFFFDF8),
    select = Color(0xFF3A2616), onSelect = Color(0xFFF3EFE6), well = Color(0xFFEBE4D4), felt = Mat.feltBottom,
    primaryTop = Color(0xFF4A3020), primaryBottom = Color(0xFF33200F), onPrimary = Color(0xFFF6E2B0),
)

val LocalAsobi = staticCompositionLocalOf { LightColors }

/** 将棋の駒・麻雀の牌の字(太い筆の楷書。Yuji Boku、SIL OFL 1.1。使う字だけに絞って同梱) */
val KomaFont: FontFamily get() = WebFonts.koma

/** アプリ全体の字(丸ゴシック。Zen Maru Gothic、SIL OFL 1.1)。Web 版は起動時に字のファイルを読み込んで作る */
val AppFont: FontFamily get() = WebFonts.app

/** 見出し用(本文と同じ丸ゴシック) */
val TitleFont: FontFamily = AppFont

private val AppTypography: Typography = Typography().let { b ->
    Typography(
        displayLarge = b.displayLarge.copy(fontFamily = AppFont),
        displayMedium = b.displayMedium.copy(fontFamily = AppFont),
        displaySmall = b.displaySmall.copy(fontFamily = AppFont),
        headlineLarge = b.headlineLarge.copy(fontFamily = AppFont),
        headlineMedium = b.headlineMedium.copy(fontFamily = AppFont),
        headlineSmall = b.headlineSmall.copy(fontFamily = AppFont),
        titleLarge = b.titleLarge.copy(fontFamily = AppFont),
        titleMedium = b.titleMedium.copy(fontFamily = AppFont),
        titleSmall = b.titleSmall.copy(fontFamily = AppFont),
        bodyLarge = b.bodyLarge.copy(fontFamily = AppFont),
        bodyMedium = b.bodyMedium.copy(fontFamily = AppFont),
        bodySmall = b.bodySmall.copy(fontFamily = AppFont),
        labelLarge = b.labelLarge.copy(fontFamily = AppFont),
        labelMedium = b.labelMedium.copy(fontFamily = AppFont),
        labelSmall = b.labelSmall.copy(fontFamily = AppFont),
    )
}

@Composable
fun AsobiTheme(dark: Boolean, content: @Composable () -> Unit) {
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.accent, onPrimary = c.onAccent, secondary = c.shu, onSecondary = c.onShu,
            background = c.bg, onBackground = c.ink, surface = c.surface, onSurface = c.ink,
            surfaceVariant = c.surface2, onSurfaceVariant = c.sub, outline = c.line,
            surfaceContainer = c.surface, surfaceContainerHigh = c.surface2, surfaceContainerHighest = c.surface2,
            surfaceContainerLow = c.surface, surfaceContainerLowest = c.bg,
        )
    } else {
        lightColorScheme(
            primary = c.accentInk, onPrimary = Color.White, secondary = c.shu, onSecondary = c.onShu,
            background = c.bg, onBackground = c.ink, surface = c.surface, onSurface = c.ink,
            surfaceVariant = c.surface2, onSurfaceVariant = c.sub, outline = c.line,
            surfaceContainer = c.surface, surfaceContainerHigh = c.surface2, surfaceContainerHighest = c.surface2,
            surfaceContainerLow = c.surface, surfaceContainerLowest = c.bg,
        )
    }
    CompositionLocalProvider(LocalAsobi provides c) {
        MaterialTheme(colorScheme = scheme, typography = AppTypography) {
            ProvideTextStyle(TextStyle(fontFamily = AppFont, color = c.ink), content)
        }
    }
}
