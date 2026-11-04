package app.gotcha.android

import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import app.gotcha.android.GotchaApp
import app.gotcha.android.debug.ExternalImportDebug
import app.gotcha.android.debug.ExternalImportDebugOverlay
import app.gotcha.android.di.AppContainer
import app.gotcha.android.ui.nav.GotchaNavHost
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaTheme
import app.gotcha.android.data.import.cacheExternalImport
import app.gotcha.android.data.import.isSupportedImportMime
import app.gotcha.android.data.import.titleFromFileName
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

/** Restores Browse Library when returning from the root-level reader (LearnerShell is recreated). */
data class ReaderReturnContext(
    val browseFilter: String? = null,
    val browseCollection: String? = null,
    val librarySearch: String = "",
)

val PendingReaderReturn = MutableStateFlow<ReaderReturnContext?>(null)

/** Production App Links: https://gotchaa.uz/learn/verify-email|reset-password?token= */
sealed class AuthDeepLink {
    data class VerifyEmail(val token: String) : AuthDeepLink()
    data class ResetPassword(val token: String) : AuthDeepLink()
}

val PendingAuthDeepLink = MutableStateFlow<AuthDeepLink?>(null)

/** Cached share/open payload — file bytes are copied in MainActivity so URI permissions cannot expire. */
data class ExternalImportRequest(
    val cachePath: String,
    val fileName: String,
    val mimeType: String,
    val title: String,
)

val PendingExternalImport = MutableStateFlow<ExternalImportRequest?>(null)

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
        consumeExternalImport(intent)
    }

    private fun consumeExternalImport(intent: Intent?) {
        if (intent == null) {
            ExternalImportDebug.log("IMPORT", "consumeExternalImport: intent=null")
            return
        }
        ExternalImportDebug.logIntent("IMPORT", intent)
        if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_VIEW) {
            ExternalImportDebug.log("IMPORT", "skip: action not SEND/VIEW (${intent.action})")
            return
        }
        val uri = resolveShareUri(intent)
        if (uri == null) {
            ExternalImportDebug.log("IMPORT", "FAIL: no URI (data/clip/extras all empty)")
            return
        }
        ExternalImportDebug.log("IMPORT", "resolvedUri=$uri")
        if (intent.action == Intent.ACTION_SEND &&
            !acceptsImportMime(intent.type) && !intent.type.isNullOrBlank()
        ) {
            ExternalImportDebug.log("IMPORT", "skip SEND: unsupported mime=${intent.type}")
            return
        }
        if (intent.action == Intent.ACTION_VIEW) {
            val mime = intent.type?.takeIf { it.isNotBlank() } ?: contentResolver.getType(uri)
            if (mime != null && !acceptsImportMime(mime) && !uriLooksLikeImportFile(uri)) {
                ExternalImportDebug.log("IMPORT", "skip VIEW: mime=$mime uri=$uri")
                return
            }
        }
        val mimeHint = intent.type?.takeIf { it.isNotBlank() } ?: contentResolver.getType(uri)
        ExternalImportDebug.log("IMPORT", "mimeHint=$mimeHint caching…")
        val cached = cacheExternalImport(this, uri, mimeHint)
        if (cached == null) {
            ExternalImportDebug.log("IMPORT", "FAIL: cacheExternalImport returned null")
            (application as GotchaApp).container.externalImportController.fail(
                "Could not read the shared file. Try saving it to Downloads first.",
            )
            PendingExternalImport.value = ExternalImportRequest(
                cachePath = "",
                fileName = uri.lastPathSegment ?: "import",
                mimeType = mimeHint ?: "application/pdf",
                title = titleFromFileName(uri.lastPathSegment ?: "import"),
            )
        } else {
            val (file, resolved) = cached
            ExternalImportDebug.log("IMPORT", "cached ok path=${file.absolutePath} name=${resolved.name}")
            val container = (application as GotchaApp).container
            val sizeBytes = file.length()
            val existingId = container.externalImportRegistry.lookup(resolved.name, sizeBytes)
            if (existingId != null) {
                ExternalImportDebug.log("IMPORT", "instant reopen contentId=$existingId")
                PendingReaderNavigation.value = existingId
                setIntent(Intent(this, MainActivity::class.java).apply { action = Intent.ACTION_MAIN })
                return
            }
            PendingExternalImport.value = ExternalImportRequest(
                cachePath = file.absolutePath,
                fileName = resolved.name,
                mimeType = resolved.mimeType,
                title = titleFromFileName(resolved.name),
            )
        }
        ExternalImportDebug.log("IMPORT", "PendingExternalImport SET pending=${PendingExternalImport.value?.fileName}")
        setIntent(Intent(this, MainActivity::class.java).apply { action = Intent.ACTION_MAIN })
    }

    private fun resolveShareUri(intent: Intent): Uri? {
        val fromExtras = readStreamUri(intent)
        val fromClip = intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
        return when (intent.action) {
            Intent.ACTION_SEND -> fromExtras ?: fromClip
            // Telegram often sends VIEW with typ=application/pdf but URI only in clipData, not data.
            Intent.ACTION_VIEW -> intent.data ?: fromClip ?: fromExtras
            else -> null
        }
    }

    private fun readStreamUri(intent: Intent): Uri? {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        }
        @Suppress("DEPRECATION")
        return intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

    private fun acceptsImportMime(mime: String?): Boolean =
        mime.isNullOrBlank() || isSupportedImportMime(mime)

    private fun uriLooksLikeImportFile(uri: Uri): Boolean {
        val path = (uri.lastPathSegment ?: uri.toString()).lowercase()
        return path.endsWith(".pdf") || path.endsWith(".epub")
    }

    private fun consumeAuthDeepLink(data: Uri?) {
        if (data == null) return
        val scheme = data.scheme?.lowercase().orEmpty()
        if (scheme == "gotcha") {
            val host = data.host.orEmpty()
            val token = data.getQueryParameter("token")?.trim().orEmpty()
            if (token.isEmpty()) return
            when (host) {
                "verify-email" -> PendingAuthDeepLink.value = AuthDeepLink.VerifyEmail(token)
                "reset-password" -> PendingAuthDeepLink.value = AuthDeepLink.ResetPassword(token)
            }
            return
        }
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
        ExternalImportDebug.log("MAIN", "onNewIntent")
        setIntent(intent)
        consumeNavExtras(intent)
        // Bring existing task to front when Telegram re-opens while app is running.
        if (isExternalImportIntent(intent)) {
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }
    }

    private fun isExternalImportIntent(intent: Intent?): Boolean {
        if (intent == null) return false
        return when (intent.action) {
            Intent.ACTION_SEND -> acceptsImportMime(intent.type)
            Intent.ACTION_VIEW -> {
                val data = resolveShareUri(intent) ?: return false
                val mime = intent.type?.takeIf { it.isNotBlank() } ?: contentResolver.getType(data)
                mime == null || acceptsImportMime(mime) || uriLooksLikeImportFile(data)
            }
            else -> false
        }
    }

    override fun onResume() {
        super.onResume()
        // Google Play purchase sheet needs a foreground Activity.
        (application as GotchaApp).container.playBilling.attach(this)
        // m-p2-7: pending purchases completed while backgrounded are verified as soon as the app returns.
        lifecycleScope.launch { runCatching { (application as GotchaApp).container.playBilling.syncAtLogin(force = false) } }
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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        consumeNavExtras(intent)
        ExternalImportDebug.log("MAIN", "onCreate consumed intent")
        val container = (application as GotchaApp).container
        setContent {
            GotchaTheme {
                CompositionLocalProvider(LocalAppContainer provides container) {
                    Box(Modifier.fillMaxSize()) {
                        Surface(
                            modifier = Modifier.fillMaxSize(),
                            color = GotchaColors.Surface,
                        ) {
                            GotchaNavHost()
                        }
                        ExternalImportDebugOverlay()
                    }
                }
            }
        }
    }
}
