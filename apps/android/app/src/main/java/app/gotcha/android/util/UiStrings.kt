package app.gotcha.android.util

import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import app.gotcha.android.ui.theme.AppUiPrefs

/**
 * M1 (UI-17): localized strings in the in-app language from anywhere (composables, coroutines, helpers).
 * Composables may equally use stringResource(); this exists for non-composable code paths such as
 * `catch (e) { error = e.apiErrorMessage(uiString(R.string.err_…)) }`.
 * [englishFallback] is only used before AppUiPrefs.init (plain JVM unit tests).
 */
fun uiString(@StringRes id: Int, vararg args: Any, englishFallback: String = ""): String {
    val res = AppUiPrefs.localizedResources() ?: return englishFallback
    return if (args.isEmpty()) res.getString(id) else res.getString(id, *args)
}

fun uiPlural(@PluralsRes id: Int, count: Int, vararg args: Any, englishFallback: String = ""): String {
    val res = AppUiPrefs.localizedResources() ?: return englishFallback
    val a: Array<out Any> = if (args.isEmpty()) arrayOf(count) else args
    return res.getQuantityString(id, count, *a)
}
