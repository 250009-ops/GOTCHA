package app.gotcha.android.ui.theme

import android.app.Activity
import android.graphics.Color as AndroidColor
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Controls status/navigation bar icon contrast for edge-to-edge.
 *
 * @param darkIcons true → dark glyphs on light backgrounds (auth, learner, admin).
 *                  false → light glyphs on dark backgrounds (splash gradient).
 */
@Composable
fun GotchaSystemBars(darkIcons: Boolean = true) {
    val view = LocalView.current
    if (view.isInEditMode) return
    SideEffect {
        val activity = view.context as? ComponentActivity
        val window = (view.context as Activity).window
        if (activity != null) {
            val transparent = AndroidColor.TRANSPARENT
            activity.enableEdgeToEdge(
                statusBarStyle = if (darkIcons) {
                    SystemBarStyle.light(transparent, transparent)
                } else {
                    SystemBarStyle.dark(transparent)
                },
                navigationBarStyle = if (darkIcons) {
                    SystemBarStyle.light(transparent, transparent)
                } else {
                    SystemBarStyle.dark(transparent)
                },
            )
        }
        window.statusBarColor = AndroidColor.TRANSPARENT
        window.navigationBarColor = AndroidColor.TRANSPARENT
        // Kill OEM contrast scrims so Telegram-style glass can blend into system nav.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = darkIcons
            isAppearanceLightNavigationBars = darkIcons
        }
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = darkIcons
            isAppearanceLightNavigationBars = darkIcons
        }
    }
}
