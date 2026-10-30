package app.gotcha.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val ColorError = Color(0xFFDC2626)

/** Light M3 scheme — GOTCHA Blue (DESIGN-practice.md §0 mapping table). */
private fun gotchaLightScheme() = lightColorScheme(
    primary = GotchaBlue.B700,
    onPrimary = Color.White,
    primaryContainer = GotchaBlue.B50,
    onPrimaryContainer = GotchaBlue.B700,
    secondary = GotchaBlue.B800,
    onSecondary = Color.White,
    background = Color(0xFFF9FAFB),
    onBackground = Color(0xFF101828),
    surface = Color.White,
    onSurface = Color(0xFF101828),
    surfaceVariant = GotchaBlue.InfoBg,
    onSurfaceVariant = Color(0xFF4A5565),
    outline = Color(0xFFE5E7EB),
    error = ColorError,
)

/** Dark M3 scheme (DESIGN-practice.md §0): ink ramp surfaces, Blue300 primary, Blue500 containers. */
private fun gotchaDarkScheme() = darkColorScheme(
    // M2: B500 so white labels on filled M3 buttons reach 5.61:1 (B400 was 3.43:1).
    primary = GotchaBlue.B500,
    onPrimary = Color.White,
    primaryContainer = GotchaBlue.B500,
    onPrimaryContainer = Color.White,
    secondary = GotchaBlue.B400,
    onSecondary = GotchaBlue.DarkBase,
    background = GotchaBlue.DarkBase,
    onBackground = GotchaBlue.DarkText,
    surface = GotchaBlue.DarkCard,
    onSurface = GotchaBlue.DarkText,
    surfaceVariant = GotchaBlue.DarkRaised,
    onSurfaceVariant = GotchaBlue.DarkText2,
    surfaceContainerLow = GotchaBlue.DarkRaised,
    surfaceContainerHigh = GotchaBlue.DarkOverlay,
    outline = GotchaBlue.DarkBorderStrong,
    outlineVariant = GotchaBlue.DarkBorder,
    error = GotchaBlue.DarkError,
    onError = GotchaBlue.DarkBase,
)

/** Built per theme so text colours follow light/dark. */
private fun gotchaTypography() = Typography(
    displayLarge = TextStyle(
        fontFamily = BagelFatOne,
        fontWeight = FontWeight.Normal,
        fontSize = 48.sp,
        color = GotchaColors.Ink,
    ),
    headlineLarge = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 24.sp,
        color = GotchaColors.BrandNavy,
    ),
    headlineMedium = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 22.sp,
        color = GotchaColors.Ink,
    ),
    titleLarge = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        color = GotchaColors.Ink,
    ),
    titleMedium = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        color = GotchaColors.Ink,
    ),
    bodyLarge = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        color = GotchaColors.Ink,
    ),
    bodyMedium = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        color = GotchaColors.TextMuted,
    ),
    bodySmall = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        color = GotchaColors.TextSubtle,
    ),
    labelLarge = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
    ),
)

/**
 * App-wide theme (UI-06). Defaults to [GotchaThemeState.isDark] = system night mode unless the user picked
 * Light/Dark in Settings → Appearance. [GotchaColors] neutrals read the same state, so legacy direct-token
 * screens and MaterialTheme roles always agree.
 */
@Composable
fun GotchaTheme(darkTheme: Boolean = GotchaThemeState.isDark, content: @Composable () -> Unit) {
    val scheme = remember(darkTheme) { if (darkTheme) gotchaDarkScheme() else gotchaLightScheme() }
    val typography = remember(darkTheme) { gotchaTypography() }
    MaterialTheme(
        colorScheme = scheme,
        typography = typography,
        content = content,
    )
}
