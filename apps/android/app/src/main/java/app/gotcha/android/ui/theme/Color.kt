package app.gotcha.android.ui.theme

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color

/** Figma mobile tokens (node 21:2 / auth + learner shells). */
/**
 * GOTCHA brand palette — the ONE place brand colours are defined on Android (mirrors packages/shared/styles/gotcha-tokens.css).
 * Scale anchored on the logo blue #2107AA (= B700 = BrandNavy). Legacy violet names in [GotchaColors] alias into it,
 * so re-branding is a change here only.
 */
object GotchaBlue {
    val B50 = Color(0xFFEEF0FF)
    val B100 = Color(0xFFE0E3FF)
    val B200 = Color(0xFFC5CAFD)
    val B300 = Color(0xFFA0A6FA)
    val B400 = Color(0xFF7A7EF5)
    val B500 = Color(0xFF5550EC)
    val B600 = Color(0xFF3B2AD6)
    val B700 = Color(0xFF2107AA)
    val B800 = Color(0xFF1A068A)
    val B900 = Color(0xFF14056B)
    val B950 = Color(0xFF0C0342)
    val Sidebar = Color(0xFF0B0C26)
    val Canvas = Color(0xFFF6F7FF)
    val AdminSidebar = Color(0xFF181A28)
    val SurfaceInput = Color(0xFFF9FAFF)
    val BorderInput = Color(0xFFE4E7F0)
    val TextPlaceholder = Color(0xFF6B7080)
    val LearningText = Color(0xFF0E7490)
    val LearningBg = Color(0xFFECFEFF)
    val InfoText = Color(0xFF334155)
    val InfoBg = Color(0xFFF1F5F9)
    val ReaderBg = Color(0xFFFFFFFF)

    // Dark theme ramp (DESIGN-practice.md §0)
    val DarkBase = Color(0xFF0A0B14)
    val DarkRaised = Color(0xFF11121E)
    val DarkCard = Color(0xFF181A28)
    val DarkOverlay = Color(0xFF212336)
    val DarkText = Color(0xFFEDEDF0)
    val DarkText2 = Color(0xFFA1A1AA)
    val DarkText3 = Color(0xFF8B8B94)
    val DarkBorder = Color(0x12FFFFFF)
    val DarkBorderStrong = Color(0x1AFFFFFF)
    val DarkSuccess = Color(0xFF34D399)
    val DarkError = Color(0xFFF87171)
}

/**
 * App-wide light/dark switch. [isDark] is snapshot state, so every composable that reads a [GotchaColors]
 * neutral recomposes when the system night mode or the in-app theme choice changes (UI-06).
 */
object GotchaThemeState {
    /** system | light | dark (UserPreferences.appTheme, mirrored locally in AppUiPrefs). */
    var appTheme by mutableStateOf("system")
    /** Set by MainActivity from the current configuration's night mask. */
    var systemDark by mutableStateOf(false)
    /** Admin screens are light-only; they flip this while shown. */
    var forceLight by mutableStateOf(false)

    val isDark: Boolean
        get() = !forceLight && when (appTheme) {
            "dark" -> true
            "light" -> false
            else -> systemDark
        }
}

private inline fun pick(light: Color, dark: Color): Color = if (GotchaThemeState.isDark) dark else light

object GotchaColors {
    /** Primary brand fill/accent: logo blue in light, lifted Blue400 on dark surfaces for contrast. */
    val BrandPurple get() = pick(GotchaBlue.B700, GotchaBlue.B400)
    val BrandPurpleDeep get() = pick(GotchaBlue.B800, GotchaBlue.B300)
    /** Figma review/detail accent (#6C2BD9). */
    val BrandPurpleMid get() = pick(GotchaBlue.B700, GotchaBlue.B400)
    val BrandNavy get() = pick(GotchaBlue.B700, GotchaBlue.B300)
    val BrandPurpleSoft get() = pick(GotchaBlue.B100, Color(0xFF231E5C))
    val BrandPurpleTint get() = pick(GotchaBlue.B50, Color(0xFF17143D))
    val BrandPurpleMuted get() = pick(GotchaBlue.B300, GotchaBlue.B500)

    /** Web-learner dashboard tokens (`apps/web-learner` CSS). */
    val WebSidebar = GotchaBlue.Sidebar
    val WebCanvas get() = pick(GotchaBlue.Canvas, GotchaBlue.DarkBase)
    val WebAccent get() = pick(GotchaBlue.B700, GotchaBlue.B400)
    val WebAccentSoft get() = pick(GotchaBlue.B50, Color(0xFF17143D))
    val WebMark = GotchaBlue.B700
    val WebPayFrom = GotchaBlue.B700
    val WebPayTo = GotchaBlue.B900
    val WebStreakBg get() = pick(Color(0xFFFFFBEB), Color(0xFF2B2110))
    val WebStreakBorder get() = pick(Color(0xFFFEE685), Color(0xFF5C4515))
    val WebStreakIcon = Color(0xFFFE9A00)
    val WebStreakText get() = pick(Color(0xFFBB4D00), Color(0xFFFBBF24))
    val WebBadge = Color(0xFFFF3B30)
    // Admin stays light-only (GotchaThemeState.forceLight), so these never need a dark value.
    val WebAdminSidebar = GotchaBlue.AdminSidebar
    val WebAdminActive = GotchaBlue.B700
    val WebAdminCanvas = Color(0xFFF8FAFC)

    val Ink get() = pick(Color(0xFF101828), GotchaBlue.DarkText)
    val InkSecondary get() = pick(GotchaBlue.AdminSidebar, Color(0xFFD4D4DC))
    val TextMuted get() = pick(Color(0xFF4A5565), GotchaBlue.DarkText2)
    val TextSubtle get() = pick(Color(0xFF99A1AF), GotchaBlue.DarkText3)
    val TextPlaceholder get() = pick(GotchaBlue.TextPlaceholder, GotchaBlue.DarkText3)

    /** Screen background. */
    val Surface get() = pick(Color(0xFFF9FAFB), GotchaBlue.DarkBase)
    /** Muted grey for offline empty states / neutral chips (Figma offline mode). */
    val SurfaceMuted get() = pick(Color(0xFFF3F4F6), GotchaBlue.DarkOverlay)
    /** Cards, sheets, bars. */
    val SurfaceCard get() = pick(Color(0xFFFFFFFF), GotchaBlue.DarkCard)
    val SurfaceInput get() = pick(GotchaBlue.SurfaceInput, GotchaBlue.DarkRaised)
    val Border get() = pick(Color(0xFFE5E7EB), Color(0xFF2A2D42))
    val BorderInput get() = pick(GotchaBlue.BorderInput, Color(0xFF34374F))

    val SuccessBg get() = pick(Color(0xFFECFDF5), Color(0xFF0F2A22))
    val SuccessText get() = pick(Color(0xFF047857), GotchaBlue.DarkSuccess)
    val InfoBg get() = pick(GotchaBlue.InfoBg, GotchaBlue.DarkRaised)
    val InfoText get() = pick(GotchaBlue.InfoText, GotchaBlue.DarkText2)
    val WarningBg get() = pick(Color(0xFFFEF3C7), Color(0xFF2B2110))
    val WarningText get() = pick(Color(0xFFB45309), Color(0xFFFBBF24))
    val Amber = Color(0xFFD97706)
    val Danger get() = pick(Color(0xFFEF4444), GotchaBlue.DarkError)
    val DangerBg get() = pick(Color(0xFFFFF5F5), Color(0xFF2D1416))
    val SuccessBright = Color(0xFF10B981)
}
