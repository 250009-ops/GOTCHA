package app.gotcha.android.ui.learner

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
    }

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
                    saveError = "Use JPG, PNG, or WebP"
                    return@launch
                }
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Could not read image")
                if (bytes.size > 2 * 1024 * 1024) {
                    saveError = "Photo must be 2 MB or smaller"
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
                saveError = e.apiErrorMessage("Upload failed")
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
            if (me == null) saveError = e.apiErrorMessage("Failed to load settings")
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

    WebCenteredColumn(
        maxWidth = WebMaxWidth.W3xl,
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Spacer(Modifier.height(learnerScrollTopInset()))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Settings",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = Color(0xFF111827),
                    )
                    Text(
                        "Manage your account and learning preferences.",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = Color(0xFF99A1AF),
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (saving || loading) GotchaColors.WebAccent.copy(alpha = 0.6f) else GotchaColors.WebAccent)
                        .clickable(enabled = !loading && !saving) {
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
                                    )
                                    applyMe(container.userRepository.meFetch().data)
                                } catch (e: Exception) {
                                    saveError = e.apiErrorMessage("Save failed")
                                } finally {
                                    saving = false
                                }
                            }
                        }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) {
                    Text(
                        if (saving) "Saving…" else "Save changes",
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
            saveError?.let {
                Text(it, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.Danger)
            }

            SettingsSection("Account") {
                SettingsRow("Photo", "Used on Home, Profile, and chat. JPG, PNG, or WebP up to 2 MB.") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        SettingsAvatar(me?.displayName, me?.avatarUrl)
                        Text(
                            if (uploadingPhoto) "Uploading…" else "Change photo",
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = Color(0xFF0A0A0A),
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
                SettingsRow("Display name", "Shown on your profile and leaderboard") {
                    SettingsTextField(displayName, { displayName = it }, "Your name")
                }
                SettingsRow("Native language", "Used for translations and lookups") {
                    SettingsDropdown(
                        value = nativeLanguage,
                        options = languageOptions.ifEmpty { uiLanguageOptions },
                        onSelect = { nativeLanguage = it },
                    )
                }
                SettingsRow("App language", "Interface language on web and mobile.") {
                    SettingsDropdown(value = uiLanguage, options = uiLanguageOptions, onSelect = { uiLanguage = it })
                }
                SettingsRow("Email", "Used for login and notifications") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            me?.email.orEmpty(),
                            fontFamily = Inter,
                            fontSize = 14.sp,
                            color = Color(0xFF6A7282),
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        Text(
                            "Verified",
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
                SettingsRow("Password", showDivider = false) {
                    Text(
                        "Change password",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = Color(0xFF0A0A0A),
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Color.Black.copy(alpha = 0.1f), RoundedCornerShape(14.dp))
                            .clickable(onClick = offline.guardClick(onChangePassword))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
            }

            SettingsSection("Target Languages") {
                if (visibleTargets.isEmpty()) {
                    Text(
                        "No target languages set yet.",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = Color(0xFF99A1AF),
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
                                        saveError = e.apiErrorMessage("Could not remove language")
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
                    Icon(Icons.Outlined.Add, contentDescription = null, tint = Color(0xFF0A0A0A), modifier = Modifier.size(16.dp))
                    Text("Add language", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Color(0xFF0A0A0A))
                }
            }

            SettingsSection("Reading Preferences") {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("PREVIEW", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Color(0xFF99A1AF))
                    Text(
                        "The old lighthouse had stood on the cliff for more than a hundred years.",
                        fontFamily = Inter,
                        fontSize = (14 * (0.8 + fontSlider * 0.8)).sp,
                        lineHeight = (14 * lineSpacing).sp,
                        color = Color(0xFF1E2939),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color.White)
                            .padding(16.dp),
                    )
                }
                SettingsRow("Font size", "${(100 * (0.8 + fontSlider * 0.8)).toInt()}% — base size") {
                    Slider(
                        value = fontSlider,
                        onValueChange = { fontSlider = it },
                        colors = SliderDefaults.colors(thumbColor = GotchaColors.WebAccent, activeTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow("Line spacing", "${String.format(Locale.US, "%.1f", lineSpacing)}× line height") {
                    Slider(
                        value = lineSpacing,
                        onValueChange = { lineSpacing = it },
                        valueRange = 1f..2.5f,
                        colors = SliderDefaults.colors(thumbColor = GotchaColors.WebAccent, activeTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow("Reader theme") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("light" to "Light", "sepia" to "Sepia", "dark" to "Dark").forEach { (value, label) ->
                            val on = theme == value
                            Text(
                                label,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Medium,
                                fontSize = 12.sp,
                                color = if (on) Color(0xFF7008E7) else Color(0xFF6A7282),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (on) Color(0xFFF5F3FF) else Color.White)
                                    .border(1.dp, if (on) Color(0xFFA684FF) else Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                                    .clickable { theme = value }
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                            )
                        }
                    }
                }
                SettingsRow("Show known words", "When off, known words show without any highlight") {
                    Switch(
                        checked = showKnown,
                        onCheckedChange = { showKnown = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
                SettingsRow("Text-to-speech", "Read text aloud while you follow along", showDivider = false) {
                    Switch(
                        checked = tts,
                        onCheckedChange = { tts = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
            }

            SettingsSection("Learning Goals") {
                SettingsRow(
                    "Email notifications",
                    "Get an email for new messages, plus reminders before your streak breaks",
                    showDivider = false,
                ) {
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = { notificationsEnabled = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.WebAccent),
                    )
                }
            }

            SettingsSection("Usage & Imports") {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFF7F22FE), Color(0xFF432DD7))))
                            .padding(20.dp),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column {
                                    Text("FREE ALLOWANCE", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Color(0xFFDDD6FF))
                                    Text("Pay per import", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color.White)
                                }
                                Icon(Icons.Outlined.Bolt, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                            }
                            listOfNotNull(
                                "AI lookups: $lookupsToday/${if (quota <= 0 || quota >= 1_000_000) "∞" else quota} today",
                                allowance?.let { "${it.dailyFreeRemaining} of ${it.dailyFreeImportsPerUser} free imports left today" }
                                    ?: plan?.importLimit?.takeIf { it in 1 until 1_000_000 }?.let { "Up to $it free imports per day" }
                                    ?: "Free import allowance from admin Import & Pricing",
                                allowance?.let { "${it.monthlyPagesRemaining} of ${it.monthlyFreePageLimit} free pages left $pagesWindow" },
                                "Access to the public library",
                            ).forEach { line ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                                    Icon(Icons.Outlined.Check, contentDescription = null, tint = Color(0xFFDDD6FF), modifier = Modifier.size(14.dp))
                                    Text(line, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFFDDD6FF))
                                }
                            }
                            Text(
                                "Import more content",
                                fontFamily = Inter,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = Color(0xFF7008E7),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White)
                                    .clickable(onClick = offline.guardClick(onOpenImport))
                                    .padding(vertical = 10.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("AI lookups today", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF6A7282))
                            Text("$lookupsToday/${if (quota <= 0 || quota >= 1_000_000) "∞" else quota}", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF6A7282))
                        }
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(Color(0xFFF3F4F6)),
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth(usagePct.coerceAtLeast(4) / 100f)
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(Color(0xFF8E51FF)),
                            )
                        }
                    }
                    if (allowance != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Free imports today", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF6A7282))
                                Text(
                                    "${allowance.dailyFreeUsed}/${allowance.dailyFreeImportsPerUser}",
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = Color(0xFF6A7282),
                                )
                            }
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(Color(0xFFF3F4F6)),
                            ) {
                                Box(
                                    Modifier
                                        .fillMaxWidth(importUsagePct / 100f)
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(50))
                                        .background(Color(0xFF7F22FE)),
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
                    .background(Color.White)
                    .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Signed in as ${me?.email.orEmpty()}",
                    fontFamily = Inter,
                    fontSize = 13.sp,
                    color = Color(0xFF99A1AF),
                )
                Text(
                    "Sign out",
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable(onClick = offline.guardClick(onLogout)),
                )
            }
            Spacer(Modifier.height(learnerScrollBottomInset()))
        }
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

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp)),
    ) {
        Text(
            title,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = Color(0xFF111827),
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
        )
        HorizontalDivider(color = Color(0xFFF9FAFB))
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
                Text(label, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = Color(0xFF364153))
                description?.let {
                    Text(it, fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF), modifier = Modifier.padding(top = 2.dp))
                }
            }
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                trailing()
            }
        }
        if (showDivider) HorizontalDivider(color = Color(0xFFF9FAFB))
    }
}

@Composable
private fun SettingsAvatar(name: String?, url: String?) {
    val initials = name?.split(" ")?.mapNotNull { it.firstOrNull()?.uppercaseChar() }?.take(2)?.joinToString("") ?: "?"
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(Color(0xFFEDE9FE)),
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
            Text(initials, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF7008E7))
        }
    }
}

@Composable
private fun SettingsTextField(value: String, onChange: (String) -> Unit, placeholder: String) {
    androidx.compose.foundation.text.BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF111827)),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFFF9FAFB))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        decorationBox = { inner ->
            if (value.isEmpty()) {
                Text(placeholder, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF99A1AF))
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
            color = Color(0xFF111827),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0xFFF9FAFB))
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
                .clickable { open = !open }
                .padding(horizontal = 12.dp, vertical = 10.dp),
        )
        if (open) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
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
                    "Level: ${(tl.cefrLevel ?: "a1").uppercase()}",
                    fontFamily = Inter,
                    fontSize = 12.sp,
                    color = Color(0xFF99A1AF),
                )
            }
            if (tl.isPrimary) {
                Text(
                    "Primary",
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = Color(0xFF7008E7),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(Color(0xFFEDE9FE))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
            if (canRemove) {
                Text("Remove", fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.Danger, modifier = Modifier.clickable(onClick = onRemove))
            }
            Icon(
                Icons.Outlined.ChevronRight,
                contentDescription = "Edit",
                tint = Color(0xFF99A1AF),
                modifier = Modifier
                    .size(18.dp)
                    .clickable(onClick = onEdit),
            )
        }
        if (showDivider) HorizontalDivider(color = Color(0xFFF9FAFB))
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
                        Text("Language", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFF4A5565))
                        BasicTextField(
                            value = langQuery.ifBlank { selectedLabel?.let { "${it.flag} ${it.englishLabel}" } ?: "" },
                            onValueChange = {
                                langQuery = it
                                langPickerOpen = true
                            },
                            singleLine = true,
                            textStyle = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF111827)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFFF9FAFB))
                                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                        )
                        if (langPickerOpen && filteredLanguages.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
                                    .background(Color.White),
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
                        color = Color(0xFF6A7282),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFFF9FAFB))
                            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("CEFR level", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFF4A5565))
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
                    Text("Set as primary target language", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF364153))
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
                                    error = "Target language cannot match your native language"
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
                            error = e.apiErrorMessage("Could not save language")
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
                Text("Cancel", fontFamily = Inter)
            }
        },
    )
}
