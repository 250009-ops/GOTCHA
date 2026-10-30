package app.gotcha.android.ui.i18n

import android.content.Context
import androidx.compose.runtime.staticCompositionLocalOf
import app.gotcha.android.R

const val DEFAULT_DAILY_GOAL_MINUTES = 15

/**
 * Settings / profile copy bundle. Values live in res/values{,-ru,-uz}/strings.xml (UI-17); this class only
 * groups them so existing call sites keep `LocalUiCopy.current.x`.
 */
data class UiCopy(
    val home: String = "",
    val library: String = "",
    val words: String = "",
    val progress: String = "",
    val profile: String = "",
    val appLanguage: String = "",
    val appLanguageHint: String = "",
    val searchLanguages: String = "",
    val languageSaved: String = "",
    val dailyGoal: String = "",
    val adjustGoal: String = "",
    val reminders: String = "",
    val dailyReminder: String = "",
    val dailyReminderSub: String = "",
    val thisWeek: String = "",
    val saveChanges: String = "",
    val minutes: String = "",
    val goalAchieved: String = "",
    val readingPreferences: String = "",
    val defaultFontSize: String = "",
    val defaultTheme: String = "",
    val themeLight: String = "",
    val themeSepia: String = "",
    val themeDark: String = "",
    val highlightKnown: String = "",
    val highlightKnownSub: String = "",
    val tts: String = "",
    val ttsSub: String = "",
    val notifications: String = "",
    val notificationsSub: String = "",
    val readingPrefsSub: String = "",
    val password: String = "",
    val passwordSub: String = "",
    val nativeLanguage: String = "",
    val deleteAccount: String = "",
    val deleteAccountSub: String = "",
    val signOut: String = "",
    val changePhoto: String = "",
    val photoHint: String = "",
    val minutesPerDay: String = "",
)

val LocalUiCopy = staticCompositionLocalOf { UiCopy() }

/** Reads the bundle from a (localized) [ctx]; LocalizedContent swaps the context when the app language changes. */
fun uiCopyFrom(ctx: Context): UiCopy = UiCopy(
    home = ctx.getString(R.string.ui_home),
    library = ctx.getString(R.string.ui_library),
    words = ctx.getString(R.string.ui_words),
    progress = ctx.getString(R.string.ui_progress),
    profile = ctx.getString(R.string.ui_profile),
    appLanguage = ctx.getString(R.string.ui_app_language),
    appLanguageHint = ctx.getString(R.string.ui_app_language_hint),
    searchLanguages = ctx.getString(R.string.ui_search_languages),
    languageSaved = ctx.getString(R.string.ui_language_saved),
    dailyGoal = ctx.getString(R.string.ui_daily_goal),
    adjustGoal = ctx.getString(R.string.ui_adjust_goal),
    reminders = ctx.getString(R.string.ui_reminders),
    dailyReminder = ctx.getString(R.string.ui_daily_reminder),
    dailyReminderSub = ctx.getString(R.string.ui_daily_reminder_sub),
    thisWeek = ctx.getString(R.string.ui_this_week),
    saveChanges = ctx.getString(R.string.ui_save_changes),
    minutes = ctx.getString(R.string.ui_minutes),
    goalAchieved = ctx.getString(R.string.ui_goal_achieved),
    readingPreferences = ctx.getString(R.string.ui_reading_preferences),
    defaultFontSize = ctx.getString(R.string.ui_default_font_size),
    defaultTheme = ctx.getString(R.string.ui_default_theme),
    themeLight = ctx.getString(R.string.ui_theme_light),
    themeSepia = ctx.getString(R.string.ui_theme_sepia),
    themeDark = ctx.getString(R.string.ui_theme_dark),
    highlightKnown = ctx.getString(R.string.ui_highlight_known),
    highlightKnownSub = ctx.getString(R.string.ui_highlight_known_sub),
    tts = ctx.getString(R.string.ui_tts),
    ttsSub = ctx.getString(R.string.ui_tts_sub),
    notifications = ctx.getString(R.string.ui_notifications),
    notificationsSub = ctx.getString(R.string.ui_notifications_sub),
    readingPrefsSub = ctx.getString(R.string.ui_reading_prefs_sub),
    password = ctx.getString(R.string.ui_password),
    passwordSub = ctx.getString(R.string.ui_password_sub),
    nativeLanguage = ctx.getString(R.string.ui_native_language),
    deleteAccount = ctx.getString(R.string.ui_delete_account),
    deleteAccountSub = ctx.getString(R.string.ui_delete_account_sub),
    signOut = ctx.getString(R.string.ui_sign_out),
    changePhoto = ctx.getString(R.string.ui_change_photo),
    photoHint = ctx.getString(R.string.ui_photo_hint),
    minutesPerDay = ctx.getString(R.string.ui_minutes_per_day),
)
