package app.gotcha.android.ui.learner

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import app.gotcha.android.BuildConfig
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.LearnerNotification
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.ui.components.FormFieldSkeleton
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.SkeletonBox
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.i18n.LocalUiCopy
import java.time.Instant
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
private fun profileDirBottomPad(): androidx.compose.ui.unit.Dp {
    val nav = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    return nav + 48.dp + 24.dp
}

@Composable
private fun ProfileDirHeader(
    title: String,
    onBack: () -> Unit,
    centered: Boolean = true,
    trailing: @Composable (() -> Unit)? = null,
) {
    if (centered) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(56.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            ProfileBackButton(onBack)
            Text(
                title,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = GotchaColors.Ink,
            )
            Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                if (trailing != null) trailing()
            }
        }
    } else {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(56.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ProfileBackButton(onBack)
            Spacer(Modifier.width(12.dp))
            Text(
                title,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = GotchaColors.Ink,
                modifier = Modifier.weight(1f),
            )
            if (trailing != null) trailing() else Spacer(Modifier.size(36.dp))
        }
    }
}

@Composable
private fun ProfileBackButton(onBack: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, CircleShape)
            .clickable(onClick = onBack),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_arrow_left),
            contentDescription = "Back",
            tint = GotchaColors.Ink,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
        color = GotchaColors.TextMuted,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}

@Composable
private fun SettingsCard(content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp)),
    ) {
        content()
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    showDivider: Boolean = true,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
            Text(subtitle, fontFamily = Manrope, fontSize = 11.sp, color = GotchaColors.TextSubtle)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedTrackColor = GotchaColors.BrandPurpleMid,
                checkedThumbColor = Color.White,
                uncheckedTrackColor = GotchaColors.Border,
                uncheckedThumbColor = Color.White,
                uncheckedBorderColor = GotchaColors.Border,
            ),
        )
    }
    if (showDivider) HorizontalDivider(color = GotchaColors.Border)
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.TextMuted)
}

@Composable
private fun ProfileField(
    value: String,
    onValueChange: (String) -> Unit = {},
    readOnly: Boolean = false,
    singleLine: Boolean = true,
    minHeight: Int = 44,
    isPassword: Boolean = false,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(minHeight.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            readOnly = readOnly,
            singleLine = singleLine,
            visualTransformation = if (isPassword) {
                androidx.compose.ui.text.input.PasswordVisualTransformation()
            } else {
                androidx.compose.ui.text.input.VisualTransformation.None
            },
            keyboardOptions = if (isPassword) {
                androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Password)
            } else {
                androidx.compose.foundation.text.KeyboardOptions.Default
            },
            textStyle = TextStyle(
                fontFamily = Manrope,
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
            ),
            cursorBrush = SolidColor(GotchaColors.BrandPurpleMid),
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) trailing()
    }
}

@Composable
private fun SegmentedControl(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { opt ->
            val on = selected == opt
            Text(
                opt,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (on) GotchaColors.BrandPurpleTint else Color.Transparent)
                    .clickable { onSelect(opt) }
                    .padding(vertical = 8.dp),
                textAlign = TextAlign.Center,
                fontFamily = Manrope,
                fontWeight = if (on) FontWeight.Bold else FontWeight.Medium,
                fontSize = 13.sp,
                color = if (on) GotchaColors.BrandPurpleMid else GotchaColors.TextMuted,
            )
        }
    }
}

// Reuses the single canonical language list (app.gotcha.android.data.model.APP_LANGUAGE_OPTIONS)
// so Settings never drifts from what Sign Up / Edit Profile offer.
private val PROFILE_LANG_OPTIONS = app.gotcha.android.data.model.APP_LANGUAGE_OPTIONS

private fun langLabel(code: String?): String =
    PROFILE_LANG_OPTIONS.firstOrNull { it.code.equals(code, ignoreCase = true) }?.englishLabel
        ?: code?.uppercase().orEmpty().ifBlank { "English" }

private fun profileInitials(displayName: String?, email: String?): String {
    val fromName = displayName
        ?.trim()
        ?.split(Regex("\\s+"))
        ?.filter { it.isNotBlank() }
        ?.take(2)
        ?.mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
        ?.joinToString("")
        .orEmpty()
    if (fromName.isNotBlank()) return fromName
    val fromEmail = email?.substringBefore("@")?.take(2)?.uppercase().orEmpty()
    return fromEmail.ifBlank { "G" }
}

private fun fontScaleToSlider(scale: Double): Float = ((scale - 0.8) / 0.8).toFloat().coerceIn(0f, 1f)

private fun sliderToFontScale(slider: Float): Double =
    (0.8 + (slider.coerceIn(0f, 1f) * 0.8)).let { (it * 20).roundToInt() / 20.0 }

private fun fontScaleLabel(scale: Double): String = "${(scale * 100).roundToInt()}%"

/** Edit profile — only fields backed by PATCH /users/me. */
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    @Suppress("UNUSED_PARAMETER") onChangePassword: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var nativeLang by remember { mutableStateOf("en") }
    var avatarUrl by remember { mutableStateOf<String?>(null) }
    var emailVerified by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var nativePickerOpen by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var uploadingPhoto by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploadingPhoto = true
            saveError = null
            try {
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                val name = when {
                    mime.contains("png") -> "avatar.png"
                    mime.contains("webp") -> "avatar.webp"
                    else -> "avatar.jpg"
                }
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Could not read image")
                val updated = container.userRepository.uploadAvatar(bytes, name, mime)
                avatarUrl = updated.avatarUrl
            } catch (e: Exception) {
                saveError = e.message ?: "Couldn’t upload photo"
            } finally {
                uploadingPhoto = false
            }
        }
    }

    LaunchedEffect(reloadKey) {
        loading = name.isEmpty() && email.isEmpty()
        error = null
        if (name.isEmpty() && email.isEmpty()) {
            container.userRepository.mePeek()?.let { peek ->
                val cached = peek.data
                name = cached.displayName.orEmpty()
                email = cached.email
                nativeLang = cached.nativeLanguage?.lowercase() ?: "en"
                avatarUrl = cached.avatarUrl
                emailVerified = !cached.emailVerifiedAt.isNullOrBlank()
                loading = false
            }
        }
        try {
            val result = container.userRepository.meFetch()
            val me = result.data
            name = me.displayName.orEmpty()
            email = me.email
            nativeLang = me.nativeLanguage?.lowercase() ?: "en"
            avatarUrl = me.avatarUrl
            emailVerified = !me.emailVerifiedAt.isNullOrBlank()
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (name.isEmpty() && email.isEmpty()) {
                error = e.apiErrorMessage("Failed to load profile")
            }
        } finally {
            loading = false
        }
    }

    val bottom = profileDirBottomPad()
    val initials = remember(name, email) { profileInitials(name, email) }
    val profileLoading = loading && name.isEmpty() && email.isEmpty()

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad(),
    ) {
        ProfileDirHeader(
            title = "Edit Profile",
            onBack = onBack,
            trailing = {
                Text(
                    if (saving) "…" else "Save",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = GotchaColors.BrandPurpleMid,
                    modifier = Modifier.clickable(enabled = !saving && !profileLoading) {
                        scope.launch {
                            saving = true
                            saveError = null
                            try {
                                container.userRepository.updateProfile(
                                    displayName = name.trim().ifBlank { null },
                                    nativeLanguage = nativeLang,
                                )
                                onBack()
                            } catch (e: Exception) {
                                saveError = e.message ?: "Save failed"
                            } finally {
                                saving = false
                            }
                        }
                    },
                )
            },
        )
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = bottom),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = name.isNotEmpty() || email.isNotEmpty(),
            )
            if (error != null && name.isEmpty() && email.isEmpty()) {
                Text(
                    error!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable { reloadKey += 1 },
                )
            }
            if (saveError != null) {
                Text(
                    saveError!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                )
            }
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (profileLoading) {
                    SkeletonBox(Modifier.size(100.dp), cornerRadius = 50.dp)
                    SkeletonBox(Modifier.width(160.dp).height(20.dp), cornerRadius = 6.dp)
                    SkeletonBox(Modifier.width(200.dp).height(14.dp), cornerRadius = 6.dp)
                } else {
                    Box(
                        Modifier
                            .size(100.dp)
                            .border(3.dp, GotchaColors.BrandPurpleMid, CircleShape)
                            .clip(CircleShape)
                            .background(GotchaColors.BrandPurpleSoft)
                            .clickable(enabled = !uploadingPhoto) {
                                photoPicker.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                )
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (!avatarUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = resolveMediaUrl(avatarUrl),
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            Text(
                                initials,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 32.sp,
                                color = GotchaColors.BrandPurpleMid,
                            )
                        }
                    }
                    val copy = LocalUiCopy.current
                    Text(
                        if (uploadingPhoto) "…" else copy.changePhoto,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = GotchaColors.BrandPurpleMid,
                        modifier = Modifier.clickable(enabled = !uploadingPhoto) {
                            photoPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                            )
                        },
                    )
                    Text(
                        copy.photoHint,
                        fontFamily = Manrope,
                        fontSize = 12.sp,
                        color = GotchaColors.TextMuted,
                    )
                }

                if (profileLoading) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        repeat(3) {
                            SkeletonBox(Modifier.fillMaxWidth().height(44.dp), cornerRadius = 12.dp)
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Full Name")
                            ProfileField(name, onValueChange = { name = it })
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Email")
                            ProfileField(
                                email,
                                readOnly = true,
                                trailing = {
                                    if (emailVerified) {
                                        Box(
                                            Modifier
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(Color(0xFFECFDF3))
                                                .padding(horizontal = 6.dp, vertical = 2.dp),
                                        ) {
                                            Text(
                                                "Verified",
                                                fontFamily = Manrope,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                color = Color(0xFF027A48),
                                            )
                                        }
                                    }
                                },
                            )
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Native Language")
                            Box {
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color.White)
                                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                        .clickable { nativePickerOpen = true }
                                        .padding(horizontal = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(langLabel(nativeLang), fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.Ink)
                                    Icon(
                                        painter = painterResource(R.drawable.ic_book_open),
                                        contentDescription = "Change native language",
                                        tint = GotchaColors.BrandPurple,
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                DropdownMenu(
                                    expanded = nativePickerOpen,
                                    onDismissRequest = { nativePickerOpen = false },
                                ) {
                                    PROFILE_LANG_OPTIONS.forEach { opt ->
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    "${opt.flag}  ${opt.englishLabel}",
                                                    fontFamily = Manrope,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 14.sp,
                                                )
                                            },
                                            onClick = {
                                                nativeLang = opt.code
                                                nativePickerOpen = false
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Password / delete account: no learner APIs yet (web marks both coming soon).
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

/** Notifications inbox — Figma 179:10 (top-bar bell). */
@Composable
fun NotificationsListScreen(
    onBack: () -> Unit,
    onOpenSettings: () -> Unit = {},
    onOpenHref: (String) -> Unit = {},
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    var items by remember { mutableStateOf<List<LearnerNotification>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf("all") }
    var reloadKey by remember { mutableIntStateOf(0) }
    val unreadCount = items.count { it.unread }
    val filtered = remember(filter, items) {
        when (filter) {
            "unread" -> items.filter { it.unread }
            "system" -> items.filter { it.kind.equals("system", ignoreCase = true) }
            else -> items
        }
    }
    val bottom = profileDirBottomPad()

    LaunchedEffect(reloadKey) {
        loading = items.isEmpty()
        error = null
        if (items.isEmpty()) {
            container.userRepository.notificationsPeek()?.let { peek ->
                items = peek.data.items
                loading = false
            }
        }
        try {
            items = container.userRepository.notificationsFetch().data.items
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) {
                error = e.apiErrorMessage("Failed to load notifications")
            }
        } finally {
            loading = false
        }
    }

    fun markAllRead() {
        if (unreadCount == 0) return
        items = items.map { it.copy(unread = false) }
        scope.launch {
            try {
                container.userRepository.markAllNotificationsRead()
                items = container.userRepository.notifications().items
            } catch (e: Exception) {
                error = e.apiErrorMessage("Couldn't mark notifications as read")
                reloadKey += 1
            }
        }
    }

    fun openItem(item: LearnerNotification) {
        if (item.unread) {
            items = items.map { if (it.id == item.id) it.copy(unread = false) else it }
            scope.launch {
                runCatching { container.userRepository.markNotificationRead(item.id) }
            }
        }
        val href = item.href?.trim().orEmpty()
        if (href.isNotBlank()) onOpenHref(href) else onOpenSettings()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ProfileBackButton(onBack)
                Text(
                    "Notifications",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 20.sp,
                    color = GotchaColors.Ink,
                )
            }
            Text(
                if (unreadCount > 0) "Mark all as read" else "All caught up",
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = if (unreadCount > 0) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                modifier = Modifier.clickable(enabled = unreadCount > 0, onClick = offline.guardClick(::markAllRead)),
            )
        }
        HorizontalDivider(color = GotchaColors.Border)
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = items.isNotEmpty(),
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
        )
        Row(
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(
                "all" to "All (${items.size})",
                "unread" to "Unread ($unreadCount)",
                "system" to "System",
            ).forEach { (key, label) ->
                val selected = filter == key
                Text(
                    label,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (selected) GotchaColors.BrandPurple else Color.White)
                        .border(1.dp, if (selected) GotchaColors.BrandPurple else GotchaColors.Border, RoundedCornerShape(20.dp))
                        .clickable { filter = key }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontFamily = Manrope,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = if (selected) Color.White else GotchaColors.TextMuted,
                )
            }
        }
        when {
            loading && items.isEmpty() -> {
                Column(
                    Modifier
                        .weight(1f)
                        .padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    repeat(4) { SkeletonBox(Modifier.fillMaxWidth().height(88.dp), cornerRadius = 16.dp) }
                }
            }
            error != null && items.isEmpty() -> OfflineEmptyState(
                subtitle = "Connect to the internet to load your notifications.",
                onRetry = { reloadKey += 1 },
            )
            filtered.isEmpty() -> {
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        when (filter) {
                            "unread" -> "No unread notifications."
                            "system" -> "No system notifications yet."
                            else -> "You're all caught up."
                        },
                        fontFamily = Manrope,
                        fontSize = 14.sp,
                        color = GotchaColors.TextMuted,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            else -> {
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp)
                        .padding(bottom = bottom),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    filtered.forEach { item ->
                        val (iconRes, iconBg) = notificationVisual(item.kind)
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(
                                    width = if (item.unread) 1.5.dp else 1.dp,
                                    color = if (item.unread) GotchaColors.BrandPurple else GotchaColors.Border,
                                    shape = RoundedCornerShape(16.dp),
                                )
                                .clickable(onClick = { openItem(item) })
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(iconBg),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    painter = painterResource(iconRes),
                                    contentDescription = null,
                                    tint = GotchaColors.Ink,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        item.title,
                                        fontFamily = Manrope,
                                        fontWeight = if (item.unread) FontWeight.Bold else FontWeight.SemiBold,
                                        fontSize = 15.sp,
                                        color = GotchaColors.Ink,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f),
                                    )
                                    if (item.unread) {
                                        Box(
                                            Modifier
                                                .size(8.dp)
                                                .clip(CircleShape)
                                                .background(GotchaColors.BrandPurple),
                                        )
                                    }
                                }
                                Text(
                                    item.body,
                                    fontFamily = Manrope,
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp,
                                    color = GotchaColors.TextMuted,
                                )
                                Text(
                                    notificationTimeLabel(item.createdAt),
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 11.sp,
                                    color = GotchaColors.TextSubtle,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun notificationVisual(kind: String): Pair<Int, Color> = when (kind.lowercase()) {
    "streak" -> R.drawable.ic_flame to Color(0xFFFFEDD5)
    "vocab" -> R.drawable.ic_activity_clock to Color(0xFFE0F2FE)
    "message" -> R.drawable.ic_message to GotchaColors.BrandPurpleSoft
    "achievement" -> R.drawable.ic_party_popper to Color(0xFFFEF3C7)
    "content" -> R.drawable.ic_book_open to GotchaColors.BrandPurpleSoft
    "goal" -> R.drawable.ic_target to Color(0xFFEDE9FE)
    else -> R.drawable.ic_bell to Color(0xFFD1FAE5)
}

private fun notificationTimeLabel(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val then = Instant.parse(iso).toEpochMilli()
        val mins = ((System.currentTimeMillis() - then) / 60_000).toInt()
        when {
            mins < 1 -> "now"
            mins < 60 -> "${mins}m ago"
            mins < 1440 -> "${mins / 60}h ago"
            mins < 2880 -> "Yesterday"
            else -> "${mins / 1440}d ago"
        }
    } catch (_: Exception) {
        ""
    }
}

/** Notification preferences — Figma 34:442 (profile settings). */
@Composable
fun NotificationsSettingsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var enabled by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }

    var hasLoaded by remember { mutableStateOf(false) }

    LaunchedEffect(reloadKey) {
        loading = !hasLoaded
        error = null
        if (!hasLoaded) {
            container.userRepository.mePeek()?.let { peek ->
                enabled = peek.data.preferences?.notificationsEnabled ?: true
                hasLoaded = true
                loading = false
            }
        }
        try {
            val result = container.userRepository.meFetch()
            enabled = result.data.preferences?.notificationsEnabled ?: true
            hasLoaded = true
        } catch (e: Exception) {
            if (!hasLoaded) {
                error = e.apiErrorMessage("Failed to load notifications")
            }
        } finally {
            loading = false
        }
    }

    val bottom = profileDirBottomPad()
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ProfileDirHeader("Notifications", onBack)
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = hasLoaded,
            )
            if (error != null && !hasLoaded) {
                Text(
                    error!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable { reloadKey += 1 },
                )
            }
            if (saveError != null) {
                Text(saveError!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            SectionLabel("Reminders")
            SettingsCard {
                ToggleRow(
                    title = "Learning reminders",
                    subtitle = "Streak and daily reading alerts (when push is available)",
                    checked = enabled,
                    onCheckedChange = { next ->
                        enabled = next
                        scope.launch {
                            saveError = null
                            runCatching {
                                container.userRepository.updatePreferences(notificationsEnabled = next)
                            }.onFailure { e ->
                                enabled = !next
                                saveError = e.message ?: "Couldn’t save preference"
                            }
                        }
                    },
                    showDivider = false,
                )
            }
            Text(
                "Granular notification channels aren’t available yet — this matches the web preference.",
                fontFamily = Manrope,
                fontSize = 12.sp,
                color = GotchaColors.TextMuted,
            )
        }
    }
}

/** Reading preferences — font scale, theme, known words, TTS (API-backed). */
@Composable
fun ReadingPreferencesScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var fontSlider by remember { mutableFloatStateOf(fontScaleToSlider(1.0)) }
    var theme by remember { mutableStateOf("Light") }
    var showKnown by remember { mutableStateOf(false) }
    var tts by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var hasLoaded by remember { mutableStateOf(false) }

    fun applyPrefs(prefs: app.gotcha.android.data.model.UserPreferences?) {
        fontSlider = fontScaleToSlider(prefs?.readerFontScale ?: 1.0)
        theme = when (prefs?.readerTheme?.lowercase()) {
            "sepia" -> "Sepia"
            "dark" -> "Dark"
            else -> "Light"
        }
        showKnown = prefs?.showKnownWords ?: false
        tts = prefs?.ttsEnabled ?: false
    }

    fun persist(
        scale: Double? = null,
        themeValue: String? = null,
        known: Boolean? = null,
        ttsValue: Boolean? = null,
    ) {
        scope.launch {
            saveError = null
            runCatching {
                container.userRepository.updatePreferences(
                    readerFontScale = scale,
                    readerTheme = themeValue?.lowercase(),
                    showKnownWords = known,
                    ttsEnabled = ttsValue,
                )
            }.onFailure { e ->
                saveError = e.message ?: "Couldn’t save preference"
            }
        }
    }

    LaunchedEffect(reloadKey) {
        loading = !hasLoaded
        error = null
        if (!hasLoaded) {
            container.userRepository.mePeek()?.let { peek ->
                applyPrefs(peek.data.preferences)
                hasLoaded = true
                loading = false
            }
        }
        try {
            val result = container.userRepository.meFetch()
            applyPrefs(result.data.preferences)
            hasLoaded = true
        } catch (e: Exception) {
            if (!hasLoaded) {
                error = e.apiErrorMessage("Failed to load preferences")
            }
        } finally {
            loading = false
        }
    }

    val bottom = profileDirBottomPad()
    val fontScale = sliderToFontScale(fontSlider)

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val copy = LocalUiCopy.current
        ProfileDirHeader(copy.readingPreferences, onBack)
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = hasLoaded,
            )
            if (error != null && !hasLoaded) {
                Text(
                    error!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable { reloadKey += 1 },
                )
            }
            if (saveError != null) {
                Text(saveError!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                SectionLabel("Reading")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(copy.defaultFontSize, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.TextMuted)
                        if (loading) {
                            SkeletonBox(Modifier.width(40.dp).height(14.dp), cornerRadius = 4.dp)
                        } else {
                            Text(fontScaleLabel(fontScale), fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.BrandPurpleMid)
                        }
                    }
                    Slider(
                        value = fontSlider,
                        onValueChange = { fontSlider = it },
                        onValueChangeFinished = { persist(scale = sliderToFontScale(fontSlider)) },
                        enabled = !loading,
                        colors = SliderDefaults.colors(
                            thumbColor = GotchaColors.BrandPurpleMid,
                            activeTrackColor = GotchaColors.BrandPurpleMid,
                            inactiveTrackColor = GotchaColors.Border,
                        ),
                    )
                }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FieldLabel(copy.defaultTheme)
                        SegmentedControl(listOf("Light", "Sepia", "Dark"), theme) { next ->
                            theme = next
                            persist(themeValue = next)
                        }
                    }
                    SettingsCard {
                        ToggleRow(
                            copy.highlightKnown,
                            copy.highlightKnownSub,
                            showKnown,
                            {
                                showKnown = it
                                persist(known = it)
                            },
                        )
                        ToggleRow(
                            copy.tts,
                            copy.ttsSub,
                            tts,
                            {
                                tts = it
                                persist(ttsValue = it)
                            },
                            showDivider = false,
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }

/** Help — no help CMS yet; show honest contact + real app version. */
@Composable
fun HelpSupportScreen(onBack: () -> Unit) {
    val bottom = profileDirBottomPad()
    val context = LocalContext.current
    fun openUrl(url: String) {
        runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ProfileDirHeader("Help & Support", onBack)
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Contact")
                SettingsCard {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Email Support", fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
                        Text(
                            "support@gotchaa.uz",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = GotchaColors.BrandPurpleMid,
                            modifier = Modifier.clickable {
                                openUrl("mailto:support@gotchaa.uz")
                            },
                        )
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("About")
                SettingsCard {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Version", fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
                        Text(
                            BuildConfig.VERSION_NAME,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel("Legal")
                SettingsCard {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { openUrl("${BuildConfig.WEB_BASE_URL}/privacy") }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Privacy Policy", fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
                        Text("gotchaa.uz", fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.BrandPurpleMid)
                    }
                    HorizontalDivider(color = GotchaColors.Border)
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { openUrl("${BuildConfig.WEB_BASE_URL}/terms") }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Terms of Service", fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
                        Text("gotchaa.uz", fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.BrandPurpleMid)
                    }
                }
            }
        }
    }
}

/** Password change — mirrors web-learner's PATCH /users/me/password flow (Settings > Password). */
@Composable
fun ChangePasswordScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }

    val bottom = profileDirBottomPad()
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad(),
    ) {
        ProfileDirHeader("Change Password", onBack, centered = false)
        if (success) {
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(24.dp)
                    .padding(bottom = bottom),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    "Password updated",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    "Your password has been changed. You'll need to sign in again on your other devices.",
                    fontFamily = Manrope,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                )
                Spacer(Modifier.weight(1f))
                GotchaPrimaryButton(
                    text = "Done",
                    onClick = onBack,
                    containerColor = GotchaColors.BrandPurpleMid,
                    shapeRadius = 16,
                )
            }
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp)
                    .padding(bottom = bottom),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FieldLabel("Current Password")
                    ProfileField(currentPassword, onValueChange = { currentPassword = it; error = null }, isPassword = true)
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FieldLabel("New Password")
                    ProfileField(newPassword, onValueChange = { newPassword = it; error = null }, isPassword = true)
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FieldLabel("Confirm New Password")
                    ProfileField(confirmPassword, onValueChange = { confirmPassword = it; error = null }, isPassword = true)
                }
                if (error != null) {
                    Text(error!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
                }
                Spacer(Modifier.weight(1f))
                GotchaPrimaryButton(
                    text = "Update Password",
                    loading = loading,
                    enabled = currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmPassword.isNotBlank(),
                    onClick = {
                        if (newPassword.length < 8) {
                            error = "New password must be at least 8 characters"
                            return@GotchaPrimaryButton
                        }
                        if (newPassword != confirmPassword) {
                            error = "Passwords do not match"
                            return@GotchaPrimaryButton
                        }
                        scope.launch {
                            loading = true
                            error = null
                            try {
                                container.userRepository.changePassword(currentPassword, newPassword)
                                success = true
                            } catch (e: Exception) {
                                error = e.apiErrorMessage("Could not change password")
                            } finally {
                                loading = false
                            }
                        }
                    },
                    containerColor = GotchaColors.BrandPurpleMid,
                    shapeRadius = 16,
                )
            }
        }
    }
}

/** Delete account — mirrors web-learner DELETE /users/me (password + type DELETE). */
@Composable
fun DeleteAccountDialog(onDismiss: () -> Unit, onDeleted: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var password by remember { mutableStateOf("") }
    var confirmText by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = { if (!loading) onDismiss() }) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Color.White)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Delete account",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = GotchaColors.Ink,
                )
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(enabled = !loading, onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close", tint = GotchaColors.TextMuted, modifier = Modifier.size(18.dp))
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFFEF2F2))
                    .border(1.dp, Color(0xFFFEE2E2), RoundedCornerShape(14.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    tint = GotchaColors.Danger,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    "This permanently anonymizes your account and signs you out everywhere. This cannot be undone.",
                    fontFamily = Manrope,
                    fontSize = 12.sp,
                    color = Color(0xFFB91C1C),
                    lineHeight = 16.sp,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                FieldLabel("Current password")
                ProfileField(password, onValueChange = { password = it; error = null }, isPassword = true)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                FieldLabel("Type DELETE to confirm")
                ProfileField(confirmText, onValueChange = { confirmText = it; error = null })
            }
            if (error != null) {
                Text(error!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            GotchaPrimaryButton(
                text = "Permanently delete my account",
                loading = loading,
                enabled = password.isNotBlank() && confirmText.isNotBlank(),
                onClick = {
                    if (password.isBlank()) {
                        error = "Enter your password to confirm"
                        return@GotchaPrimaryButton
                    }
                    if (confirmText.trim().uppercase() != "DELETE") {
                        error = "Type DELETE to confirm"
                        return@GotchaPrimaryButton
                    }
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            container.userRepository.deleteAccount(password)
                            onDeleted()
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Could not delete account")
                        } finally {
                            loading = false
                        }
                    }
                },
                containerColor = GotchaColors.Danger,
                shapeRadius = 14,
            )
        }
    }
}

/** App Language — Figma 208:330; persists uiLanguage via PATCH /users/me. */
@Composable
fun AppLanguageScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var selected by remember { mutableStateOf("en") }
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var hasLoaded by remember { mutableStateOf(false) }

    LaunchedEffect(reloadKey) {
        loading = !hasLoaded
        error = null
        if (!hasLoaded) {
            container.userRepository.mePeek()?.let { peek ->
                selected = peek.data.uiLanguage?.lowercase() ?: "en"
                hasLoaded = true
                loading = false
            }
        }
        try {
            val result = container.userRepository.meFetch()
            selected = result.data.uiLanguage?.lowercase() ?: "en"
            hasLoaded = true
        } catch (e: Exception) {
            if (!hasLoaded) {
                error = e.apiErrorMessage("Failed to load language")
            }
        } finally {
            loading = false
        }
    }

    val filtered = remember(query) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) PROFILE_LANG_OPTIONS
        else PROFILE_LANG_OPTIONS.filter {
            it.nativeLabel.lowercase().contains(q) ||
                it.englishLabel.lowercase().contains(q) ||
                it.code.contains(q)
        }
    }

    val bottom = profileDirBottomPad()
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val copy = LocalUiCopy.current
        ProfileDirHeader(copy.appLanguage, onBack)
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Text(
                copy.appLanguageHint,
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
            )
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = hasLoaded,
            )
            if (error != null && !hasLoaded) {
                Text(
                    error!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable { reloadKey += 1 },
                )
            }
            if (saveError != null) {
                Text(saveError!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_search),
                    contentDescription = null,
                    tint = GotchaColors.TextSubtle,
                    modifier = Modifier.size(18.dp),
                )
                BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    textStyle = TextStyle(
                        fontFamily = Manrope,
                        fontSize = 15.sp,
                        color = GotchaColors.Ink,
                    ),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        Box {
                            if (query.isEmpty()) {
                                Text(
                                    copy.searchLanguages,
                                    fontFamily = Manrope,
                                    fontSize = 15.sp,
                                    color = GotchaColors.TextSubtle,
                                )
                            }
                            inner()
                        }
                    },
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                filtered.forEach { lang ->
                        val on = selected == lang.code
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                                .clickable {
                                    val previous = selected
                                    selected = lang.code
                                    scope.launch {
                                        saveError = null
                                        runCatching {
                                            container.userRepository.updateProfile(uiLanguage = lang.code)
                                        }.onFailure { e ->
                                            selected = previous
                                            saveError = e.message ?: "Couldn’t save language"
                                        }
                                    }
                                }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.weight(1f),
                            ) {
                                Box(
                                    Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(GotchaColors.Surface),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(lang.flag, fontSize = 22.sp)
                                }
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        lang.nativeLabel,
                                        fontFamily = Manrope,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 15.sp,
                                        color = GotchaColors.Ink,
                                    )
                                    Text(
                                        lang.englishLabel,
                                        fontFamily = Manrope,
                                        fontSize = 12.sp,
                                        color = GotchaColors.TextMuted,
                                    )
                                }
                            }
                            if (on) {
                                Box(
                                    Modifier
                                        .size(22.dp)
                                        .clip(RoundedCornerShape(11.dp))
                                        .background(GotchaColors.BrandPurple),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(12.dp),
                                    )
                                }
                            } else {
                                Box(
                                    Modifier
                                        .size(22.dp)
                                        .border(1.5.dp, GotchaColors.Border, CircleShape),
                                )
                            }
                        }
                    }
                }
            Text(
                copy.languageSaved,
                fontFamily = Manrope,
                fontSize = 12.sp,
                color = GotchaColors.TextMuted,
            )
        }
    }
}

/** Native language — EN / RU / UZ. Persists via PATCH /users/me nativeLanguage. */
@Composable
fun NativeLanguageScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var selected by remember { mutableStateOf("en") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var hasLoaded by remember { mutableStateOf(false) }

    LaunchedEffect(reloadKey) {
        loading = !hasLoaded
        error = null
        if (!hasLoaded) {
            container.userRepository.mePeek()?.let { peek ->
                selected = peek.data.nativeLanguage?.lowercase() ?: "en"
                hasLoaded = true
                loading = false
            }
        }
        try {
            val result = container.userRepository.meFetch()
            selected = result.data.nativeLanguage?.lowercase() ?: "en"
            hasLoaded = true
        } catch (e: Exception) {
            if (!hasLoaded) {
                error = e.apiErrorMessage("Failed to load native language")
            }
        } finally {
            loading = false
        }
    }

    val bottom = profileDirBottomPad()
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ProfileDirHeader("Native language", onBack)
        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Text(
                "Chat translations and word meanings use this language. You can reset it anytime.",
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
            )
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = hasLoaded,
            )
            if (error != null && !hasLoaded) {
                Text(
                    error!!,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.Danger,
                    modifier = Modifier.clickable { reloadKey += 1 },
                )
            }
            if (saveError != null) {
                Text(saveError!!, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PROFILE_LANG_OPTIONS.forEach { lang ->
                    val on = selected == lang.code
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .clickable {
                                val previous = selected
                                selected = lang.code
                                scope.launch {
                                    saveError = null
                                    runCatching {
                                        container.userRepository.updateProfile(nativeLanguage = lang.code)
                                    }.onFailure { e ->
                                        selected = previous
                                        saveError = e.message ?: "Couldn’t save native language"
                                    }
                                }
                            }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Box(
                                Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(GotchaColors.Surface),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(lang.flag, fontSize = 22.sp)
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    lang.nativeLabel,
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(
                                    lang.englishLabel,
                                    fontFamily = Manrope,
                                    fontSize = 12.sp,
                                    color = GotchaColors.TextMuted,
                                )
                            }
                        }
                        if (on) {
                            Box(
                                Modifier
                                    .size(22.dp)
                                    .clip(RoundedCornerShape(11.dp))
                                    .background(GotchaColors.BrandPurple),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Outlined.Check,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(12.dp),
                                )
                            }
                        } else {
                            Box(
                                Modifier
                                    .size(22.dp)
                                    .clip(CircleShape)
                                    .border(1.5.dp, GotchaColors.Border, CircleShape),
                            )
                        }
                    }
                }
            }
        }
    }
}
