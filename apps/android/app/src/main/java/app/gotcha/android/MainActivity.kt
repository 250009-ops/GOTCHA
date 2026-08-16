package app.gotcha.android

import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import app.gotcha.android.di.AppContainer
import app.gotcha.android.ui.nav.GotchaNavHost
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaTheme
import kotlinx.coroutines.flow.MutableStateFlow

val LocalAppContainer = staticCompositionLocalOf<AppContainer> {
    error("AppContainer not provided")
}

/** QA / deep-link: `adb … --es navigate_word "книга"` */
val PendingWordNavigation = MutableStateFlow<String?>(null)

/** QA: `adb … --es navigate_route "progress"` (tab or directory route). */
val PendingLearnerRoute = MutableStateFlow<String?>(null)

/** QA: `adb … --es navigate_reader "<contentId>"` opens top-level reader. */
val PendingReaderNavigation = MutableStateFlow<String?>(null)

/** Production App Links: https://gotchaa.uz/learn/verify-email|reset-password?token= */
sealed class AuthDeepLink {
    data class VerifyEmail(val token: String) : AuthDeepLink()
    data class ResetPassword(val token: String) : AuthDeepLink()
}

val PendingAuthDeepLink = MutableStateFlow<AuthDeepLink?>(null)

class MainActivity : ComponentActivity() {
    private fun consumeNavExtras(intent: Intent?) {
        if (intent == null) return
        intent.getStringExtra("navigate_word")?.trim()?.takeIf { it.isNotEmpty() }?.let {
            PendingWordNavigation.value = it
        }
        intent.getStringExtra("navigate_reader")?.trim()?.takeIf { it.isNotEmpty() }?.let {
            PendingReaderNavigation.value = it
        }
        intent.getStringExtra("navigate_route")?.trim()?.takeIf { it.isNotEmpty() }?.let { route ->
            if (route.startsWith("reader/")) {
                PendingReaderNavigation.value = route.removePrefix("reader/")
            } else {
                PendingLearnerRoute.value = route
            }
        }
        consumeAuthDeepLink(intent.data)
    }

    private fun consumeAuthDeepLink(data: Uri?) {
        if (data == null) return
        val host = data.host.orEmpty()
        if (!host.equals("gotchaa.uz", ignoreCase = true) &&
            !host.equals("www.gotchaa.uz", ignoreCase = true)
        ) {
            return
        }
        val path = data.path.orEmpty().trimEnd('/')
        val token = data.getQueryParameter("token")?.trim().orEmpty()
        if (token.isEmpty()) return
        when {
            path.endsWith("/verify-email") || path == "/verify-email" ->
                PendingAuthDeepLink.value = AuthDeepLink.VerifyEmail(token)
            path.endsWith("/reset-password") || path == "/reset-password" ->
                PendingAuthDeepLink.value = AuthDeepLink.ResetPassword(token)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        consumeNavExtras(intent)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // Default: dark status icons on light screens.
        // Per-screen overrides via GotchaSystemBars (re-applies SystemBarStyle).
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(
                AndroidColor.TRANSPARENT,
                AndroidColor.TRANSPARENT,
            ),
            navigationBarStyle = SystemBarStyle.light(
                AndroidColor.TRANSPARENT,
                AndroidColor.TRANSPARENT,
            ),
        )
        // Ensure OEM 3-button nav stays transparent so learner glass can blend under it.
        window.statusBarColor = AndroidColor.TRANSPARENT
        window.navigationBarColor = AndroidColor.TRANSPARENT
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        consumeNavExtras(intent)
        val container = (application as GotchaApp).container
        setContent {
            GotchaTheme {
                CompositionLocalProvider(LocalAppContainer provides container) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = GotchaColors.Surface,
                    ) {
                        GotchaNavHost()
                    }
                }
            }
        }
    }
}
