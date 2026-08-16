package app.gotcha.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val ColorError = Color(0xFFDC2626)

private val GotchaColorScheme = lightColorScheme(
    primary = GotchaColors.BrandPurple,
    onPrimary = GotchaColors.SurfaceCard,
    secondary = GotchaColors.BrandPurpleDeep,
    onSecondary = GotchaColors.SurfaceCard,
    background = GotchaColors.Surface,
    onBackground = GotchaColors.Ink,
    surface = GotchaColors.SurfaceCard,
    onSurface = GotchaColors.Ink,
    surfaceVariant = GotchaColors.BrandPurpleSoft,
    onSurfaceVariant = GotchaColors.TextMuted,
    outline = GotchaColors.Border,
    error = ColorError,
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

@Composable
fun GotchaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = GotchaColorScheme,
        typography = GotchaTypography,
        content = content,
    )
}
