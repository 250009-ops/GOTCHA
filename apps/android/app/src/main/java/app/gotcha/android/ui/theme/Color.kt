package app.gotcha.android.ui.theme

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

object GotchaColors {
    val BrandPurple = GotchaBlue.B700
    val BrandPurpleDeep = GotchaBlue.B800
    /** Figma review/detail accent (#6C2BD9). */
    val BrandPurpleMid = GotchaBlue.B700
    val BrandNavy = GotchaBlue.B700
    val BrandPurpleSoft = GotchaBlue.B100
    val BrandPurpleTint = GotchaBlue.B50
    val BrandPurpleMuted = GotchaBlue.B300

    /** Web-learner dashboard tokens (`apps/web-learner` CSS). */
    val WebSidebar = GotchaBlue.Sidebar
    val WebCanvas = GotchaBlue.Canvas
    val WebAccent = GotchaBlue.B700
    val WebAccentSoft = GotchaBlue.B50
    val WebMark = GotchaBlue.B700
    val WebPayFrom = GotchaBlue.B700
    val WebPayTo = GotchaBlue.B900
    val WebStreakBg = Color(0xFFFFFBEB)
    val WebStreakBorder = Color(0xFFFEE685)
    val WebStreakIcon = Color(0xFFFE9A00)
    val WebStreakText = Color(0xFFBB4D00)
    val WebBadge = Color(0xFFFF3B30)
    val WebAdminSidebar = GotchaBlue.AdminSidebar
    val WebAdminActive = GotchaBlue.B700
    val WebAdminCanvas = Color(0xFFF8FAFC)

    val Ink = Color(0xFF101828)
    val InkSecondary = GotchaBlue.AdminSidebar
    val TextMuted = Color(0xFF4A5565)
    val TextSubtle = Color(0xFF99A1AF)
    val TextPlaceholder = GotchaBlue.TextPlaceholder

    val Surface = Color(0xFFF9FAFB)
    /** Muted grey for offline empty states (Figma offline mode). */
    val SurfaceMuted = Color(0xFFECEEF2)
    val SurfaceCard = Color(0xFFFFFFFF)
    val SurfaceInput = GotchaBlue.SurfaceInput
    val Border = Color(0xFFE5E7EB)
    val BorderInput = GotchaBlue.BorderInput

    val SuccessBg = Color(0xFFECFDF5)
    val SuccessText = Color(0xFF047857)
    val InfoBg = GotchaBlue.InfoBg
    val InfoText = GotchaBlue.InfoText
    val WarningBg = Color(0xFFFEF3C7)
    val WarningText = Color(0xFFB45309)
    val Amber = Color(0xFFD97706)
    val Danger = Color(0xFFEF4444)
    val SuccessBright = Color(0xFF10B981)
}
