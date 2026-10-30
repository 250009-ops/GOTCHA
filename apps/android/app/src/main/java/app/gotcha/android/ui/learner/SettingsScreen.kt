package app.gotcha.android.ui.learner

import app.gotcha.android.util.uiString
import app.gotcha.android.util.uiPlural
import app.gotcha.android.R
import app.gotcha.android.ui.theme.GotchaBlue

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.AppLanguageOption
import app.gotcha.android.data.model.CatalogLanguage
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.SubscriptionInfo
import app.gotcha.android.data.model.UserTargetLanguage
import app.gotcha.android.data.model.toAppLanguageOption
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.WebMaxWidth
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import java.util.Locale
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.role
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material.icons.automirrored.outlined.ArrowBack

private val uiLanguageOptions = listOf(
    AppLanguageOption("en", "English", "English", "🇬🇧"),
    AppLanguageOption("ru", "Russian", "Русский", "🇷🇺"),
    AppLanguageOption("uz", "Uzbek", "O'zbek", "🇺🇿"),
)

private val cefrLevels = listOf("a1", "a2", "b1", "b2", "c1", "c2")

private data class TargetLangModalState(
    val mode: String,
    val existing: UserTargetLanguage? = null,
)

@Composable
fun SettingsScreen(
    /** Null when Settings is a bottom tab (no back arrow). */
    onBack: (() -> Unit)? = null,
    onLogout: () -> Unit,
    onOpenImport: () -> Unit,
    onChangePassword: () -> Unit,
    onProfileUpdated: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    var me by remember { mutableStateOf<MeResponse?>(null) }
    var subscription by remember { mutableStateOf<SubscriptionInfo?>(null) }
    var languageOptions by remember { mutableStateOf<List<AppLanguageOption>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }
    var uploadingPhoto by remember { mutableStateOf(false) }
    var langModal by remember { mutableStateOf<TargetLangModalState?>(null) }

    var displayName by remember { mutableStateOf("") }
    var nativeLanguage by remember { mutableStateOf("en") }
    var uiLanguage by remember { mutableStateOf("en") }
    var fontSlider by remember { mutableFloatStateOf(0.5f) }
    var lineSpacing by remember { mutableFloatStateOf(1.5f) }
    var theme by remember { mutableStateOf("light") }
    var showKnown by remember { mutableStateOf(false) }
    var tts by remember { mutableStateOf(false) }
    var notificationsEnabled by remember { mutableStateOf(true) }
    var appTheme by remember { mutableStateOf(app.gotcha.android.ui.theme.GotchaThemeState.appTheme) }
    // UI-32: the last saved values; Save is enabled only when the draft differs.
    var savedDraft by remember { mutableStateOf<List<Any?>>(emptyList()) }
    val snackbar = remember { androidx.compose.material3.SnackbarHostState() }
    val savedMsg = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_saved)
    fun draft(): List<Any?> = listOf(
        displayName.trim(), nativeLanguage, uiLanguage, (fontSlider * 100).toInt(), (lineSpacing * 10).toInt(),
        theme, showKnown, tts, notificationsEnabled, appTheme,
    )

    fun applyMe(data: MeResponse) {
        me = data
        displayName = data.displayName.orEmpty()
        nativeLanguage = data.nativeLanguage?.lowercase().orEmpty().ifBlank { "en" }
        uiLanguage = data.uiLanguage?.lowercase().orEmpty().ifBlank { "en" }
        val prefs = data.preferences
        fontSlider = ((prefs?.readerFontScale ?: 1.0) - 0.8).toFloat().div(0.8f).coerceIn(0f, 1f)
        lineSpacing = (prefs?.readerLineSpacing ?: 1.5).toFloat()
        theme = prefs?.readerTheme?.lowercase().orEmpty().ifBlank { "light" }
        showKnown = prefs?.showKnownWords ?: false
        tts = prefs?.ttsEnabled ?: false
        notificationsEnabled = prefs?.notificationsEnabled ?: true
        appTheme = app.gotcha.android.ui.theme.AppUiPrefs.normalizeTheme(prefs?.appTheme ?: app.gotcha.android.ui.theme.GotchaThemeState.appTheme)
        savedDraft = draft()
    }
    val dirty = savedDraft.isNotEmpty() && draft() != savedDraft

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploadingPhoto = true
            saveError = null
            try {
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                if (mime !in setOf("image/jpeg", "image/png", "image/webp")) {
                    saveError = uiString(R.string.settings_photo_type)
                    return@launch
                }
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Could not read image")
                if (bytes.size > 2 * 1024 * 1024) {
                    saveError = uiString(R.string.settings_photo_size)
                    return@launch
                }
                val name = when {
                    mime.contains("png") -> "avatar.png"
                    mime.contains("webp") -> "avatar.webp"
                    else -> "avatar.jpg"
                }
                container.userRepository.uploadAvatar(bytes, name, mime)
                applyMe(container.userRepository.meFetch().data)
                onProfileUpdated()
            } catch (e: Exception) {
                saveError = e.apiErrorMessage(R.string.err_upload_failed)
            } finally {
                uploadingPhoto = false
            }
        }
    }

    LaunchedEffect(reloadKey) {
        loading = me == null
        saveError = null
        me?.let { applyMe(it) }
        container.userRepository.mePeek()?.let { applyMe(it.data) }
        try {
            applyMe(container.userRepository.meFetch().data)
            languageOptions = runCatching { container.contentRepository.catalogLanguages() }
                .getOrDefault(emptyList())
                .filter { it.isEnabled }
                .map(CatalogLanguage::toAppLanguageOption)
            subscription = runCatching { container.api.subscription() }.getOrNull()
        } catch (e: Exception) {
            if (me == null) saveError = e.apiErrorMessage(context.getString(app.gotcha.android.R.string.settings_load_failed))
        } finally {
            loading = false
        }
    }

    val targetLanguages = me?.targetLanguages.orEmpty()
    val visibleTargets = targetLanguages.filter { it.targetLanguage != nativeLanguage }
    val quota = subscription?.usage?.quota ?: 50
    val lookupsToday = subscription?.usage?.lookupsToday ?: 0
    val allowance = subscription?.usage?.importAllowance
    val plan = subscription?.subscription
    val usagePct = if (quota in 1 until 1_000_000) ((lookupsToday.toFloat() / quota) * 100).toInt().coerceIn(0, 100) else 0
    val importUsagePct = if (allowance != null && allowance.dailyFreeImportsPerUser > 0) {
        ((allowance.dailyFreeUsed.toFloat() / allowance.dailyFreeImportsPerUser) * 100).toInt().coerceIn(0, 100)
    } else {
        0
    }
    val pagesWindow = pageWindowLabel(allowance?.resetCycle)

    Box(Modifier.fillMaxSize()) {
    WebCenteredColumn(
        maxWidth = WebMaxWidth.W3xl,
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Spacer(Modifier.height(learnerScrollTopInset()))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (onBack != null) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.common_back),
                    tint = GotchaColors.Ink,
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .clickable(onClick = onBack)
                        .padding(10.dp),
                )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_title),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = GotchaColors.Ink,
                    )
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_subtitle),
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextSubtle,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (saving || loading || !dirty) GotchaColors.WebAccent.copy(alpha = 0.45f) else GotchaColors.WebAccent)
                        .clickable(enabled = !loading && !saving && dirty) {
                            scope.launch {
                                saving = true
                                saveError = null
                                try {
                                    container.userRepository.updateProfile(
                                        displayName = displayName.trim().ifBlank { null },
                                        uiLanguage = uiLanguage,
                                        nativeLanguage = nativeLanguage,
                                    )
                                    container.userRepository.updatePreferences(
                                        readerFontScale = 0.8 + fontSlider * 0.8,
                                        readerLineSpacing = lineSpacing.toDouble(),
                                        readerTheme = theme,
                                        showKnownWords = showKnown,
                                        ttsEnabled = tts,
                                        notificationsEnabled = notificationsEnabled,
                                        appTheme = appTheme,
                                    )
                                    // UI-17 / UI-06: language and theme apply at once, no relaunch.
                                    app.gotcha.android.ui.theme.AppUiPrefs.updateLanguage(uiLanguage)
                                    app.gotcha.android.ui.theme.AppUiPrefs.updateTheme(appTheme)
                                    applyMe(container.userRepository.meFetch().data)
                                    launch { snackbar.showSnackbar(savedMsg) }
                                } catch (e: Exception) {
                                    saveError = e.apiErrorMessage(context.getString(app.gotcha.android.R.string.settings_save_failed))
                                } finally {
                                    saving = false
                                }
                            }
                        }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) {
                    Text(
                        androidx.compose.ui.res.stringResource(if (saving) app.gotcha.android.R.string.settings_saving else app.gotcha.android.R.string.ui_save_changes),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = Color.White,
                    )
                }
            }

            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = me != null,
            )
            if (saveError != null && me == null && !loading) {
                // UI-10: load failure gets a Retry, not just red text.
                app.gotcha.android.ui.components.ErrorState(message = saveError!!, onRetry = { reloadKey += 1 })
            } else saveError?.let {
                Text(it, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.Danger)
            }

            SettingsSection(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_account)) {
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_photo), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_photo_hint)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        SettingsAvatar(me?.displayName, me?.avatarUrl)
                        Text(
                            androidx.compose.ui.res.stringResource(if (uploadingPhoto) app.gotcha.android.R.string.settings_uploading else app.gotcha.android.R.string.ui_change_photo),
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = GotchaColors.Ink,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .border(1.dp, Color.Black.copy(alpha = 0.1f), RoundedCornerShape(14.dp))
                                .clickable(
                                    enabled = !uploadingPhoto,
                                    onClick = offline.guardClick {
                                        photoPicker.launch(
                                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                        )
                                    },
                                )
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_display_name), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_display_name_sub)) {
                    SettingsTextField(displayName, { displayName = it }, androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_your_name))
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_native_language), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_native_sub)) {
                    SettingsDropdown(
                        value = nativeLanguage,
                        options = languageOptions.ifEmpty { uiLanguageOptions },
                        onSelect = { nativeLanguage = it },
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_app_language), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_app_language_sub)) {
                    SettingsDropdown(value = uiLanguage, options = uiLanguageOptions, onSelect = { uiLanguage = it })
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_email), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_email_sub)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            me?.email.orEmpty(),
                            fontFamily = Inter,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        Text(
                            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_verified),
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                            color = Color(0xFF007A55),
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(Color(0xFFD0FAE5))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_password), showDivider = false) {
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_change_password),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Color.Black.copy(alpha = 0.1f), RoundedCornerShape(14.dp))
                            .clickable(onClick = offline.guardClick(onChangePassword))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
            }

            SettingsSection(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_target_languages)) {
                if (visibleTargets.isEmpty()) {
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_no_targets),
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextSubtle,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    )
                } else {
                    visibleTargets.forEachIndexed { index, tl ->
                        TargetLanguageRow(
                            tl = tl,
                            options = languageOptions,
                            showDivider = index < visibleTargets.lastIndex,
                            canRemove = visibleTargets.size > 1,
                            onRemove = {
                                scope.launch {
                                    saveError = null
                                    try {
                                        container.userRepository.removeTargetLanguage(tl.targetLanguage)
                                        applyMe(container.userRepository.meFetch().data)
                                        onProfileUpdated()
                                    } catch (e: Exception) {
                                        saveError = e.apiErrorMessage(R.string.err_language_remove)
                                    }
                                }
                            },
                            onEdit = { langModal = TargetLangModalState(mode = "edit", existing = tl) },
                        )
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { langModal = TargetLangModalState(mode = "add") }
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, tint = GotchaColors.Ink, modifier = Modifier.size(16.dp))
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_add_language), fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = GotchaColors.Ink)
                }
            }

            SettingsSection(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_reading_preferences)) {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_preview), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = GotchaColors.TextSubtle)
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_preview_text),
                        fontFamily = Inter,
                        fontSize = (14 * (0.8 + fontSlider * 0.8)).sp,
                        lineHeight = (14 * lineSpacing).sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(GotchaColors.SurfaceCard)
                            .padding(16.dp),
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_default_font_size), "${(100 * (0.8 + fontSlider * 0.8)).toInt()}%") {
                    Slider(
                        value = fontSlider,
                        onValueChange = { fontSlider = it },
                        colors = SliderDefaults.colors(thumbColor = GotchaColors.WebAccent, activeTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_line_spacing), "${String.format(Locale.US, "%.1f", lineSpacing)}×") {
                    Slider(
                        value = lineSpacing,
                        onValueChange = { lineSpacing = it },
                        valueRange = 1f..2.5f,
                        colors = SliderDefaults.colors(thumbColor = GotchaColors.WebAccent, activeTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_app_theme), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_app_theme_sub)) {
                    ThemeChips(
                        options = listOf(
                            "system" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.theme_system),
                            "light" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_theme_light),
                            "dark" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_theme_dark),
                        ),
                        selected = appTheme,
                        onSelect = { appTheme = it },
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_reader_theme)) {
                    ThemeChips(
                        options = listOf(
                            "light" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_theme_light),
                            "sepia" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_theme_sepia),
                            "dark" to androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_theme_dark),
                        ),
                        selected = theme,
                        onSelect = { theme = it },
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_highlight_known), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_highlight_known_sub)) {
                    Switch(
                        checked = showKnown,
                        onCheckedChange = { showKnown = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_tts), androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_tts_sub), showDivider = false) {
                    Switch(
                        checked = tts,
                        onCheckedChange = { tts = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
            }

            SettingsSection(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_learning_goals)) {
                SettingsRow(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_email_notifications),
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_email_notifications_sub),
                    showDivider = false,
                ) {
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = { notificationsEnabled = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
            }

            SettingsSection(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_usage)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Brush.linearGradient(listOf(GotchaBlue.B700, Color(0xFF432DD7))))
                            .padding(20.dp),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column {
                                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_free_allowance), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = GotchaBlue.B200)
                                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_pay_per_import), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color.White)
                                }
                                Icon(Icons.Outlined.Bolt, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                            }
                            listOfNotNull(
                                uiString(R.string.settings_ai_lookups_line, "$lookupsToday/${if (quota <= 0 || quota >= 1_000_000) "∞" else quota}"),
                                allowance?.let { uiString(R.string.settings_free_imports_left, it.dailyFreeRemaining, it.dailyFreeImportsPerUser) }
                                    ?: plan?.importLimit?.takeIf { it in 1 until 1_000_000 }?.let { uiString(R.string.settings_up_to_imports, it) }
                                    ?: uiString(R.string.settings_free_allowance_admin),
                                allowance?.let { uiString(R.string.settings_free_pages_left, it.monthlyPagesRemaining, it.monthlyFreePageLimit, pagesWindow) },
                                uiString(R.string.settings_public_library),
                            ).forEach { line ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                                    Icon(Icons.Outlined.Check, contentDescription = null, tint = GotchaBlue.B200, modifier = Modifier.size(14.dp))
                                    Text(line, fontFamily = Inter, fontSize = 14.sp, color = GotchaBlue.B200)
                                }
                            }
                            Text(
                                androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_import_more),
                                fontFamily = Inter,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaBlue.B700,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(GotchaColors.SurfaceCard)
                                    .clickable(onClick = offline.guardClick(onOpenImport))
                                    .padding(vertical = 10.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_ai_lookups_today), fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted)
                            Text("$lookupsToday/${if (quota <= 0 || quota >= 1_000_000) "∞" else quota}", fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted) // i18n-ok: numbers only
                        }
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(GotchaColors.SurfaceMuted),
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth(usagePct.coerceAtLeast(4) / 100f)
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(GotchaBlue.B500),
                            )
                        }
                    }
                    if (allowance != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_free_imports_today), fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted)
                                Text(
                                    "${allowance.dailyFreeUsed}/${allowance.dailyFreeImportsPerUser}",
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = GotchaColors.TextMuted,
                                )
                            }
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(GotchaColors.SurfaceMuted),
                            ) {
                                Box(
                                    Modifier
                                        .fillMaxWidth(importUsagePct / 100f)
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(50))
                                        .background(GotchaBlue.B700),
                                )
                            }
                        }
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GotchaColors.SurfaceCard)
                    .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(16.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.settings_signed_in_as, me?.email.orEmpty()),
                    fontFamily = Inter,
                    fontSize = 13.sp,
                    color = GotchaColors.TextSubtle,
                )
                Text(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.ui_sign_out),
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier
                        .clickable(onClick = offline.guardClick(onLogout))
                        .minimumInteractiveComponentSize(),
                )
            }
            Spacer(Modifier.height(learnerScrollBottomInset()))
        }
    }
        androidx.compose.material3.SnackbarHost(
            snackbar,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = learnerNavBarInset() + 16.dp),
        )
    }

    langModal?.let { modal ->
        TargetLanguageModal(
            state = modal,
            languageOptions = languageOptions,
            usedCodes = visibleTargets.map { it.targetLanguage },
            nativeLanguage = nativeLanguage,
            onDismiss = { langModal = null },
            onSaved = {
                scope.launch {
                    applyMe(container.userRepository.meFetch().data)
                    onProfileUpdated()
                    langModal = null
                }
            },
        )
    }
}

/** Segmented chips that never wrap (UI-31: "Dark" broke onto two lines). */
@Composable
internal fun ThemeChips(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (value, label) ->
            val on = selected == value
            Text(
                label,
                fontFamily = Inter,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                maxLines = 1,
                softWrap = false,
                color = if (on) GotchaColors.BrandPurple else GotchaColors.TextMuted,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (on) GotchaColors.BrandPurpleTint else GotchaColors.SurfaceCard)
                    .border(1.dp, if (on) GotchaColors.BrandPurpleMuted else GotchaColors.Border, RoundedCornerShape(10.dp))
                    .clickable { onSelect(value) }
                    .semantics { this.selected = on; role = androidx.compose.ui.semantics.Role.RadioButton }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(16.dp)),
    ) {
        Text(
            title,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = GotchaColors.Ink,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
        )
        HorizontalDivider(color = GotchaColors.Surface)
        content()
    }
}

@Composable
private fun SettingsRow(
    label: String,
    description: String? = null,
    showDivider: Boolean = true,
    trailing: @Composable () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = GotchaColors.TextMuted)
                description?.let {
                    Text(it, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextSubtle, modifier = Modifier.padding(top = 2.dp))
                }
            }
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                trailing()
            }
        }
        if (showDivider) HorizontalDivider(color = GotchaColors.Surface)
    }
}

@Composable
private fun SettingsAvatar(name: String?, url: String?) {
    val initials = name?.split(" ")?.mapNotNull { it.firstOrNull()?.uppercaseChar() }?.take(2)?.joinToString("") ?: "?"
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(GotchaBlue.B50),
        contentAlignment = Alignment.Center,
    ) {
        if (!url.isNullOrBlank()) {
            AsyncImage(
                model = resolveMediaUrl(url),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(initials, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GotchaBlue.B700)
        }
    }
}

@Composable
private fun SettingsTextField(value: String, onChange: (String) -> Unit, placeholder: String) {
    androidx.compose.foundation.text.BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Ink),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(GotchaColors.Surface)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        decorationBox = { inner ->
            if (value.isEmpty()) {
                Text(placeholder, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextSubtle)
            }
            inner()
        },
    )
}

@Composable
private fun SettingsDropdown(value: String, options: List<AppLanguageOption>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val label = options.firstOrNull { it.code.equals(value, true) }?.englishLabel ?: value.uppercase()
    Box {
        Text(
            label,
            fontFamily = Inter,
            fontSize = 14.sp,
            color = GotchaColors.Ink,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(GotchaColors.Surface)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                .clickable { open = !open }
                .padding(horizontal = 12.dp, vertical = 10.dp),
        )
        if (open) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(GotchaColors.SurfaceCard)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                    .padding(vertical = 4.dp),
            ) {
                options.forEach { opt ->
                    Text(
                        "${opt.flag} ${opt.englishLabel}",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onSelect(opt.code)
                                open = false
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun TargetLanguageRow(
    tl: UserTargetLanguage,
    options: List<AppLanguageOption>,
    showDivider: Boolean,
    canRemove: Boolean,
    onRemove: () -> Unit,
    onEdit: () -> Unit,
) {
    val catalog = options.firstOrNull { it.code.equals(tl.targetLanguage, true) }
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(catalog?.flag ?: "🌐", fontSize = 20.sp)
            Column(modifier = Modifier.weight(1f)) {
                Text(catalog?.englishLabel ?: tl.targetLanguage.uppercase(), fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text(
                    uiString(R.string.settings_level, (tl.cefrLevel ?: "a1").uppercase()),
                    fontFamily = Inter,
                    fontSize = 12.sp,
                    color = GotchaColors.TextSubtle,
                )
            }
            if (tl.isPrimary) {
                Text(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_primary),
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = GotchaBlue.B700,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(GotchaBlue.B50)
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
            if (canRemove) {
                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_remove), fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.Danger, modifier = Modifier.clickable(onClick = onRemove))
            }
            Icon(
                Icons.Outlined.ChevronRight,
                contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_edit),
                tint = GotchaColors.TextSubtle,
                modifier = Modifier
                    .size(18.dp)
                    .clickable(onClick = onEdit),
            )
        }
        if (showDivider) HorizontalDivider(color = GotchaColors.Surface)
    }
}

@Composable
private fun TargetLanguageModal(
    state: TargetLangModalState,
    languageOptions: List<AppLanguageOption>,
    usedCodes: List<String>,
    nativeLanguage: String,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val available = languageOptions.filter {
        !it.code.equals(nativeLanguage, true) &&
            (state.mode == "edit" || !usedCodes.any { code -> code.equals(it.code, true) })
    }
    var targetLanguage by remember(state) {
        mutableStateOf(state.existing?.targetLanguage ?: available.firstOrNull()?.code.orEmpty())
    }
    var cefrLevel by remember(state) {
        mutableStateOf(state.existing?.cefrLevel?.lowercase().orEmpty().ifBlank { "a1" })
    }
    var isPrimary by remember(state) { mutableStateOf(state.existing?.isPrimary ?: false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var langQuery by remember { mutableStateOf("") }
    var langPickerOpen by remember { mutableStateOf(false) }
    val filteredLanguages = remember(langQuery, available) {
        available.filter {
            langQuery.isBlank() ||
                it.englishLabel.contains(langQuery, ignoreCase = true) ||
                it.code.contains(langQuery, ignoreCase = true)
        }.take(8)
    }
    val selectedLabel = languageOptions.firstOrNull { it.code.equals(targetLanguage, true) }

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = {
            Text(
                if (state.mode == "add") "Add target language" else "Edit target language",
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (state.mode == "add") {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_language), fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = GotchaColors.TextMuted)
                        BasicTextField(
                            value = langQuery.ifBlank { selectedLabel?.let { "${it.flag} ${it.englishLabel}" } ?: "" },
                            onValueChange = {
                                langQuery = it
                                langPickerOpen = true
                            },
                            singleLine = true,
                            textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Ink),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(GotchaColors.Surface)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                        )
                        if (langPickerOpen && filteredLanguages.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                                    .background(GotchaColors.SurfaceCard),
                            ) {
                                filteredLanguages.forEach { opt ->
                                    Text(
                                        "${opt.flag} ${opt.englishLabel}",
                                        fontFamily = Inter,
                                        fontSize = 14.sp,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                targetLanguage = opt.code
                                                langQuery = ""
                                                langPickerOpen = false
                                            }
                                            .padding(horizontal = 12.dp, vertical = 10.dp),
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Text(
                        "${selectedLabel?.flag ?: "🌐"} ${selectedLabel?.englishLabel ?: targetLanguage.uppercase()}",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextMuted,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(GotchaColors.Surface)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_cefr_level), fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = GotchaColors.TextMuted)
                    SettingsDropdown(
                        value = cefrLevel,
                        options = cefrLevels.map { AppLanguageOption(it, it.uppercase(), it.uppercase(), "") },
                        onSelect = { cefrLevel = it },
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.clickable { isPrimary = !isPrimary },
                ) {
                    Checkbox(checked = isPrimary, onCheckedChange = { isPrimary = it })
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_set_as_primary_target_language), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextMuted)
                }
                error?.let {
                    Text(it, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.Danger)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !saving && (state.mode == "edit" || targetLanguage.isNotBlank()),
                onClick = {
                    scope.launch {
                        saving = true
                        error = null
                        try {
                            if (state.mode == "add") {
                                if (targetLanguage.equals(nativeLanguage, true)) {
                                    error = uiString(R.string.settings_target_eq_native)
                                    return@launch
                                }
                                container.userRepository.addTargetLanguage(
                                    targetLanguage = targetLanguage,
                                    cefrLevel = cefrLevel,
                                    isPrimary = isPrimary,
                                )
                            } else {
                                val lang = state.existing?.targetLanguage ?: return@launch
                                container.userRepository.updateTargetLanguage(
                                    lang = lang,
                                    cefrLevel = cefrLevel,
                                    isPrimary = isPrimary,
                                )
                            }
                            onSaved()
                        } catch (e: Exception) {
                            error = e.apiErrorMessage(R.string.err_language_save)
                        } finally {
                            saving = false
                        }
                    }
                },
            ) {
                Text(if (saving) "Saving…" else if (state.mode == "add") "Add language" else "Save changes", fontFamily = Inter)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !saving) {
                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_cancel), fontFamily = Inter)
            }
        },
    )
}
