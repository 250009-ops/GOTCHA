package app.gotcha.android.ui.theme

import android.content.Context
import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

/**
 * Device-local mirror of the two account preferences that must apply before sign-in and without a relaunch:
 * UI language (UI-17) and app theme (UI-06). The server copy (users.uiLanguage / preferences.appTheme) wins
 * whenever /users/me is loaded; Settings writes both.
 */
object AppUiPrefs {
    private const val FILE = "gotcha_ui_prefs"
    private const val KEY_LANG = "ui_language"
    private const val KEY_THEME = "app_theme"
    val supportedLanguages = listOf("en", "ru", "uz")

    /** en | ru | uz — snapshot state, so a change recomposes every stringResource call immediately. */
    var language by mutableStateOf("en")
        private set

    private var appContext: Context? = null

    fun init(context: Context) {
        val ctx = context.applicationContext
        appContext = ctx
        val sp = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        language = normalize(sp.getString(KEY_LANG, null) ?: Locale.getDefault().language)
        GotchaThemeState.appTheme = normalizeTheme(sp.getString(KEY_THEME, null))
    }

    fun updateLanguage(code: String?) {
        val next = normalize(code)
        if (next == language) return
        language = next
        appContext?.getSharedPreferences(FILE, Context.MODE_PRIVATE)?.edit()?.putString(KEY_LANG, next)?.apply()
    }

    fun updateTheme(theme: String?) {
        val next = normalizeTheme(theme)
        if (next == GotchaThemeState.appTheme) return
        GotchaThemeState.appTheme = next
        appContext?.getSharedPreferences(FILE, Context.MODE_PRIVATE)?.edit()?.putString(KEY_THEME, next)?.apply()
    }

    private var localizedFor: Pair<String, android.content.res.Resources>? = null

    /**
     * Resources re-rooted on the in-app language, for strings built outside composition (coroutine error
     * fallbacks, relative-time helpers). Reading [language] keeps composable callers recomposing on a switch.
     * Null before [init] (JVM unit tests), in which case callers fall back to the English default.
     */
    fun localizedResources(): android.content.res.Resources? {
        val ctx = appContext ?: return null
        val lang = language
        localizedFor?.let { (l, r) -> if (l == lang) return r }
        val cfg = Configuration(ctx.resources.configuration).apply { setLocale(Locale.forLanguageTag(lang)) }
        val res = ctx.createConfigurationContext(cfg).resources
        localizedFor = lang to res
        return res
    }

    /** m4: on sign-out, don't carry this account's UI language/theme to the next account. */
    fun resetForSignOut() {
        updateLanguage(java.util.Locale.getDefault().language)
        updateTheme(null)
    }

    fun normalize(code: String?): String {
        val c = code?.lowercase()?.take(2).orEmpty()
        return if (c in supportedLanguages) c else "en"
    }

    fun normalizeTheme(theme: String?): String = when (theme?.lowercase()) {
        "light" -> "light"
        "dark" -> "dark"
        else -> "system"
    }
}

/**
 * Re-roots resources on the in-app language so `stringResource` follows Settings → App language at once,
 * independent of the device locale.
 */
@Composable
fun LocalizedContent(language: String = AppUiPrefs.language, content: @Composable () -> Unit) {
    val base = LocalContext.current
    val baseConfig = LocalConfiguration.current
    val (ctx, config) = remember(base, baseConfig, language) {
        val locale = Locale.forLanguageTag(language)
        val cfg = Configuration(baseConfig).apply { setLocale(locale) }
        LocaleContextWrapper(base, base.createConfigurationContext(cfg)) to cfg
    }
    CompositionLocalProvider(LocalContext provides ctx, LocalConfiguration provides config) {
        content()
    }
}

/** Keeps the Activity identity (for billing, permissions, window access) while serving localized resources. */
private class LocaleContextWrapper(base: Context, private val localized: Context) : android.content.ContextWrapper(base) {
    override fun getResources(): android.content.res.Resources = localized.resources
}
