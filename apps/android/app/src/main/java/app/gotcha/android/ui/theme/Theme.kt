package app.gotcha.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val ColorError = Color(0xFFDC2626)

/** Light M3 scheme — GOTCHA Blue (DESIGN-practice.md §0 mapping table). */
private val GotchaColorScheme = lightColorScheme(
    primary = GotchaBlue.B700,
    onPrimary = GotchaColors.SurfaceCard,
    primaryContainer = GotchaBlue.B50,
    onPrimaryContainer = GotchaBlue.B700,
    secondary = GotchaBlue.B800,
    onSecondary = GotchaColors.SurfaceCard,
    background = GotchaColors.Surface,
    onBackground = GotchaColors.Ink,
    surface = GotchaColors.SurfaceCard,
    onSurface = GotchaColors.Ink,
    surfaceVariant = GotchaBlue.InfoBg,
    onSurfaceVariant = GotchaColors.TextMuted,
    outline = GotchaColors.Border,
    error = ColorError,
)

/** Dark M3 scheme (DESIGN-practice.md §0): ink ramp surfaces, Blue300 primary, Blue500 containers. */
private val GotchaDarkColorScheme = darkColorScheme(
    primary = GotchaBlue.B300,
    onPrimary = GotchaBlue.DarkBase,
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

private val GotchaTypography = Typography(
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
 * [darkTheme] is opt-in: most screens still paint GotchaColors (light) directly, so following the system
 * dark mode would mix schemes. Flip the default to `isSystemInDarkTheme()` once screens use MaterialTheme roles.
 */
@Composable
fun GotchaTheme(darkTheme: Boolean = false, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) GotchaDarkColorScheme else GotchaColorScheme,
        typography = GotchaTypography,
        content = content,
    )
}
