package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.StatsHistoryDay
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.OfflineInteraction
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.components.ProgressStatsSkeleton
import app.gotcha.android.ui.components.SkeletonBox
import app.gotcha.android.ui.components.StatCardSkeleton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.Manrope
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.WebMaxWidth
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

private data class LangProgress(
    val code: String,
    val name: String,
    val level: String,
    val towardLabel: String,
    val pct: Float,
    val wordCount: Int,
)

/** Statistics tab — matches web-learner StatsPage. */
@Composable
fun ProgressScreen(
    onOpenAchievements: () -> Unit = {},
    onOpenHistory: () -> Unit = {},
    onOpenCefr: () -> Unit = {},
    onOpenLanguage: (String) -> Unit = {},
    onOpenStreak: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var vocab by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var range7d by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(reloadKey) {
        loading = stats == null
        error = null
        container.userRepository.statsPeek()?.let { stats = it.data; loading = false }
        container.userRepository.mePeek()?.let { me = it.data }
        container.vocabRepository.listPeek()?.let { vocab = it.data }
        try {
            stats = container.userRepository.statsFetch().data
            me = runCatching { container.userRepository.meFetch().data }.getOrNull() ?: me
            vocab = runCatching { container.vocabRepository.listFetch().data }.getOrDefault(vocab)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (stats == null) error = e.apiErrorMessage("Failed to load statistics")
        } finally {
            loading = false
        }
    }

    val s = stats
    val statsLoading = loading && s == null
    val streak = s?.streakCount ?: me?.streakCount ?: 0
    val totalMinutes = s?.totalReadMinutes ?: 0
    val todayMinutes = s?.todayReadMinutes ?: 0
    val totalVocab = s?.vocabularyTotal ?: vocab.size
    val mastered = vocab.count { it.mastered } .takeIf { it > 0 } ?: s?.vocabularyMastered ?: 0
    val learning = (totalVocab - mastered).coerceAtLeast(0)
    val rangeDays = if (range7d) 7 else 30
    val avgMinPerDay = if (rangeDays > 0) totalMinutes / rangeDays else 0
    val languages = remember(me, vocab) { buildLanguageProgress(me, vocab) }
    val masteredPct = if (totalVocab > 0) (mastered * 100 / totalVocab) else 0
    val learningPct = if (totalVocab > 0) 100 - masteredPct else 0

    WebCenteredColumn(
        maxWidth = WebMaxWidth.W6xl,
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.height(learnerScrollTopInset()))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Statistics", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color(0xFF111827))
                    Text("Track your learning progress over time.", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF99A1AF))
                }
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF3F4F6))
                        .padding(4.dp),
                ) {
                    StatsRangeChip("Last 7 days", range7d) { range7d = true }
                    StatsRangeChip("Last 30 days", !range7d) { range7d = false }
                }
            }

            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = stats != null || me != null,
            )
            if (error != null && stats == null) {
                Text(error!!, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.Danger, modifier = Modifier.clickable { reloadKey++ })
            }

            if (statsLoading) {
                ProgressStatsSkeleton()
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatsKpiCard("$streak days", "Current streak", Color(0xFFBB4D00), Color(0xFFFFFBEB), Color(0xFFFEE685), Modifier.weight(1f))
                        StatsKpiCard(
                            "${totalMinutes / 60}h ${totalMinutes % 60}m",
                            "Total reading",
                            Color(0xFF7008E7),
                            Color(0xFFF5F3FF),
                            Color(0xFFDDD6FF),
                            Modifier.weight(1f),
                            sub = "avg ${avgMinPerDay}m/day",
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatsKpiCard("$totalVocab", "Words saved", Color(0xFF1447E6), Color(0xFFEFF6FF), Color(0xFFBEDBFF), Modifier.weight(1f), sub = "$mastered mastered")
                        StatsKpiCard("${todayMinutes}m", "Read today", Color(0xFF364153), Color(0xFFF9FAFB), Color(0xFFE5E7EB), Modifier.weight(1f))
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
                Text("Language Progress", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
                if (languages.isEmpty()) {
                    Text("Language progress appears as you save words while reading.", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF99A1AF))
                } else {
                    languages.forEach { lang ->
                        Box(modifier = Modifier.clickable(onClick = offline.guardClick { onOpenLanguage(lang.code) })) {
                            LanguageProgressCard(lang)
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
                Text("Vocabulary Breakdown", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    VocabBreakdownTile("Total saved", totalVocab, Color(0xFFE5E7EB), Color(0xFF364153), Modifier.weight(1f))
                    VocabBreakdownTile("Still learning", learning, Color(0xFF51A2FF), Color(0xFF1447E6), Modifier.weight(1f))
                    VocabBreakdownTile("Mastered", mastered, Color(0xFF00D492), Color(0xFF007A55), Modifier.weight(1f))
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0xFFF3F4F6)),
                ) {
                    Row(Modifier.fillMaxSize()) {
                        Box(Modifier.fillMaxWidth(masteredPct / 100f).fillMaxHeight().background(Color(0xFF00D492)))
                        Box(Modifier.fillMaxWidth(learningPct / 100f).fillMaxHeight().background(Color(0xFF51A2FF)))
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("$masteredPct% mastered", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
                    Text("$learningPct% in progress", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
                }
            }
            Spacer(Modifier.height(learnerScrollBottomInset()))
        }
    }
}

@Composable
private fun StatsRangeChip(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        label,
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        color = if (active) Color(0xFF1E2939) else Color(0xFF99A1AF),
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (active) Color.White else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

@Composable
private fun StatsKpiCard(
    value: String,
    label: String,
    textColor: Color,
    bgColor: Color,
    borderColor: Color,
    modifier: Modifier = Modifier,
    sub: String? = null,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0xFF2107AA)),
            contentAlignment = Alignment.Center,
        ) {
            Text("G", fontFamily = app.gotcha.android.ui.theme.BagelFatOne, fontSize = 22.sp, color = Color.White)
        }
        Column {
            Text(value, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = textColor)
            Text(label, fontFamily = Inter, fontSize = 12.sp, color = textColor.copy(alpha = 0.7f))
            sub?.let { Text(it, fontFamily = Inter, fontSize = 12.sp, color = textColor.copy(alpha = 0.5f)) }
        }
    }
}

@Composable
private fun VocabBreakdownTile(label: String, value: Int, dot: Color, text: Color, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFFF9FAFB))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(12.dp).clip(RoundedCornerShape(6.dp)).background(dot))
        Column {
            Text("$value", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = text)
            Text(label, fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
        }
    }
}

/** Legacy profile hub — kept for deep links; settings route uses [SettingsScreen]. */
@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onOpenAdmin: () -> Unit,
    onOpenSettings: (String) -> Unit = {},
) {
    val container = LocalAppContainer.current
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var isAdmin by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) reloadKey += 1
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(reloadKey) {
        loading = me == null
        error = null
        if (me == null) {
            container.userRepository.mePeek()?.let { peek ->
                me = peek.data
                loading = false
            }
        }
        if (stats == null) {
            container.userRepository.statsPeek()?.let { peek ->
                stats = peek.data
            }
        }
        try {
            val meResult = container.userRepository.meFetch()
            me = meResult.data
            val statsResult = runCatching { container.userRepository.statsFetch() }.getOrNull()
            stats = statsResult?.data ?: stats
            isAdmin = container.authRepository.isAdmin()
        } catch (e: Exception) {
            if (me == null) {
                error = e.apiErrorMessage("Failed to load profile")
            }
        } finally {
            loading = false
        }
    }

    val profileLoading = loading && me == null

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas)
            .verticalScroll(rememberScrollState())
            .padding(top = 16.dp, bottom = 24.dp),
    ) {
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = me != null || stats != null,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
        )
        if (error != null && me == null && !profileLoading) {
            OfflineEmptyState(onRetry = { reloadKey += 1 })
        }
        if (profileLoading) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(top = 12.dp, bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SkeletonBox(Modifier.size(80.dp), cornerRadius = 40.dp)
                SkeletonBox(Modifier.width(140.dp).height(20.dp), cornerRadius = 6.dp)
                SkeletonBox(Modifier.width(180.dp).height(14.dp), cornerRadius = 6.dp)
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                repeat(3) {
                    SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
                }
            }
        } else {
            val streak = stats?.streakCount ?: me?.streakCount ?: 0
            val words = stats?.vocabularyTotal ?: stats?.wordsSaved ?: 0
            val articles = stats?.contentCompleted ?: 0
            val displayName = me?.displayName?.takeIf { it.isNotBlank() }
                ?: me?.email?.substringBefore("@")?.takeIf { it.isNotBlank() }
                ?: "Learner"
            val email = me?.email.orEmpty()
            val initials = remember(displayName, email) { profileAvatarInitials(displayName, email) }
            val languages = remember(me) {
                me?.targetLanguages.orEmpty()
                    .sortedByDescending { it.isPrimary }
                    .map { tl ->
                        val code = tl.targetLanguage.uppercase()
                        LangProgress(
                            code = code,
                            name = languageName(code),
                            level = cefrFullLabel(tl.cefrLevel),
                            towardLabel = "",
                            pct = 0f,
                            wordCount = 0,
                        )
                    }
            }
            val memberSince = remember(me?.createdAt) { formatMemberSince(me?.createdAt) }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(top = 12.dp, bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .border(3.dp, GotchaColors.BrandPurple, CircleShape)
                        .clip(CircleShape)
                        .background(GotchaColors.BrandPurpleSoft)
                        .clickable(onClick = offline.guardClick { onOpenSettings("edit_profile") }),
                    contentAlignment = Alignment.Center,
                ) {
                    if (!me?.avatarUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = resolveMediaUrl(me?.avatarUrl),
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            initials,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 26.sp,
                            color = GotchaColors.BrandPurple,
                        )
                    }
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        displayName,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        color = GotchaColors.Ink,
                    )
                    if (email.isNotBlank()) {
                        Text(email, fontFamily = Manrope, color = GotchaColors.TextMuted, fontSize = 13.sp)
                    }
                    if (memberSince != null) {
                        Text(
                            "Member since $memberSince",
                            fontFamily = Manrope,
                            color = GotchaColors.TextSubtle,
                            fontSize = 11.sp,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ProfileMiniStat("$streak Days", "Reading streak", R.drawable.ic_flame, Modifier.weight(1f))
                ProfileMiniStat(formatCount(words), "Words learned", R.drawable.ic_nav_words, Modifier.weight(1f))
                ProfileMiniStat("$articles", "Articles read", R.drawable.ic_nav_book, Modifier.weight(1f))
            }

            if (languages.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Learning Languages",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GotchaColors.Ink,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        languages.take(3).forEach { lang ->
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                    .clickable(onClick = offline.guardClick { onOpenSettings("language/${lang.code}") })
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                LangChip(lang.code, vocabulary = true)
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(lang.name, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                                    Text(lang.level, fontFamily = Manrope, color = GotchaColors.TextMuted, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }

            ProfileSettingsSection(
                nativeLanguage = me?.nativeLanguage,
                uiLanguage = me?.uiLanguage,
                isAdmin = isAdmin,
                offline = offline,
                onOpenSettings = onOpenSettings,
                onOpenAdmin = onOpenAdmin,
                onLogout = onLogout,
            )
        }

        if (profileLoading) {
            ProfileSettingsSection(
                nativeLanguage = null,
                uiLanguage = null,
                isAdmin = false,
                offline = offline,
                onOpenSettings = onOpenSettings,
                onOpenAdmin = onOpenAdmin,
                onLogout = onLogout,
            )
        }
    }
}

@Composable
private fun ProfileSettingsSection(
    nativeLanguage: String?,
    uiLanguage: String?,
    isAdmin: Boolean,
    offline: OfflineInteraction,
    onOpenSettings: (String) -> Unit,
    onOpenAdmin: () -> Unit,
    onLogout: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val copy = app.gotcha.android.ui.i18n.LocalUiCopy.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Settings",
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = GotchaColors.Ink,
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp)),
        ) {
            ProfileSettingsRow(
                iconRes = R.drawable.ic_message,
                title = "Messages",
                subtitle = "Chats with other learners",
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("messages") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_bell,
                title = copy.notifications,
                subtitle = copy.notificationsSub,
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("notification_settings") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_settings_gear,
                title = copy.readingPreferences,
                subtitle = copy.readingPrefsSub,
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("reading_preferences") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_settings_gear,
                title = copy.password,
                subtitle = copy.passwordSub,
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("change_password") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_book_open,
                title = copy.nativeLanguage,
                subtitle = uiLanguageLabel(nativeLanguage),
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("native_language") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_globe,
                title = copy.appLanguage,
                subtitle = uiLanguageLabel(uiLanguage),
                showDivider = false,
            ) { offline.guardClick { onOpenSettings("app_language") }() }
        }
    }

    if (isAdmin) {
        Text(
            "Admin dashboard",
            color = GotchaColors.BrandPurple,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .padding(bottom = 12.dp)
                .clickable(onClick = offline.guardClick(onOpenAdmin)),
        )
    }

    Text(
        copy.signOut,
        color = GotchaColors.Danger,
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = offline.guardClick {
                scope.launch {
                    container.messagingRealtime.stop()
                    container.authRepository.logout()
                    onLogout()
                }
            })
            .padding(16.dp),
    )
}

@Composable
private fun ProgressStatCard(label: String, value: String, iconRes: Int, cardModifier: Modifier = Modifier) {
    Column(
        modifier = cardModifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontFamily = Manrope, color = GotchaColors.TextSubtle, fontSize = 12.sp)
            Icon(
                painter = painterResource(iconRes),
                contentDescription = null,
                tint = GotchaColors.BrandPurple,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(value, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = GotchaColors.Ink)
    }
}

@Composable
private fun LanguageProgressCard(lang: LangProgress) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LangChip(lang.code, vocabulary = true)
                Text(lang.name, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            }
            Text(lang.level, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
        }
        if (lang.towardLabel.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(lang.towardLabel, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.TextMuted)
                Text("${(lang.pct * 100).toInt()}%", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = GotchaColors.BrandPurple)
            }
            Spacer(Modifier.height(8.dp))
            FigmaProgressBar(lang.pct, GotchaColors.BrandPurple)
        }
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Words saved", fontFamily = Manrope, color = GotchaColors.TextSubtle, fontSize = 12.sp)
            Text("${lang.wordCount} words", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

@Composable
private fun PeriodChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) GotchaColors.BrandPurple else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        color = if (selected) Color.White else GotchaColors.BrandPurple,
    )
}

@Composable
private fun FigmaProgressBar(pct: Float, color: Color, height: Int = 8) {
    // Plain track+fill — Figma 8×4 radius (not pill).
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(height.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(GotchaColors.Border),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(pct.coerceIn(0f, 1f))
                .height(height.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color),
        )
    }
}

@Composable
private fun AchievementCard(
    label: String,
    iconRes: Int?,
    bg: Color,
    tint: Color,
    modifier: Modifier = Modifier,
    book: Boolean = false,
    star: Boolean = false,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(bg),
            contentAlignment = Alignment.Center,
        ) {
            when {
                iconRes != null -> Icon(painterResource(iconRes), null, tint = tint, modifier = Modifier.size(20.dp))
                book -> Icon(Icons.AutoMirrored.Outlined.MenuBook, null, tint = tint, modifier = Modifier.size(20.dp))
                star -> Icon(Icons.Outlined.Star, null, tint = tint, modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(label, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = GotchaColors.Ink, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ProfileMiniStat(value: String, label: String, iconRes: Int, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(painterResource(iconRes), null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(6.dp))
        Text(value, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = GotchaColors.Ink)
        Text(label, fontFamily = Manrope, color = GotchaColors.TextMuted, fontSize = 11.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ProfileSettingsRow(
    iconRes: Int,
    title: String,
    subtitle: String,
    showDivider: Boolean,
    titleColor: Color = GotchaColors.Ink,
    onClick: () -> Unit = {},
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(
                    painter = painterResource(iconRes),
                    contentDescription = null,
                    tint = Color.Unspecified,
                    modifier = Modifier.size(18.dp),
                )
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(title, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = titleColor)
                    Text(subtitle, fontFamily = Manrope, color = GotchaColors.TextSubtle, fontSize = 11.sp)
                }
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(16.dp))
        }
        if (showDivider) HorizontalDivider(color = GotchaColors.Border)
    }
}

private data class AchievementPreview(
    val label: String,
    val iconRes: Int?,
    val bg: Color,
    val tint: Color,
    val book: Boolean = false,
    val star: Boolean = false,
)

private fun formatCount(n: Int): String = NumberFormat.getIntegerInstance(Locale.US).format(n)

private fun formatReadTime(totalMinutes: Int): String {
    if (totalMinutes <= 0) return "0 min"
    val hours = totalMinutes / 60
    val mins = totalMinutes % 60
    return when {
        hours <= 0 -> "$mins min"
        mins == 0 -> if (hours == 1) "1 hour" else "$hours hours"
        else -> "${hours}h ${mins}m"
    }
}

private fun uiLanguageLabel(code: String?): String = when (code?.lowercase()) {
    "en", null, "" -> "English"
    "ru" -> "Russian"
    "uz" -> "Uzbek"
    else -> code.replaceFirstChar(Char::titlecase)
}

private fun languageName(code: String): String = when (code.uppercase()) {
    "RU" -> "Russian"
    "EN" -> "English"
    "UZ" -> "Uzbek"
    "DE" -> "German"
    "FR" -> "French"
    "ES" -> "Spanish"
    "JA" -> "Japanese"
    else -> code.uppercase()
}

private fun cefrCode(raw: String?): String =
    raw?.trim()?.uppercase()?.take(2)?.takeIf { it.length == 2 } ?: "A1"

private fun cefrShortLabel(code: String): String {
    val c = cefrCode(code)
    val name = when (c) {
        "A1" -> "Beginner"
        "A2" -> "Elementary"
        "B1" -> "Intermediate"
        "B2" -> "Upper-Int"
        "C1" -> "Advanced"
        "C2" -> "Mastery"
        else -> "Learner"
    }
    return "$c $name"
}

private fun cefrFullLabel(raw: String?): String = cefrShortLabel(cefrCode(raw))

private fun nextCefr(code: String): String? = when (cefrCode(code)) {
    "A1" -> "A2"
    "A2" -> "B1"
    "B1" -> "B2"
    "B2" -> "C1"
    "C1" -> "C2"
    else -> null
}

/** Rough band thresholds for “toward next level” — vocab count only (honest estimate). */
private fun cefrBandProgress(words: Int, code: String): Float {
    val (lo, hi) = when (cefrCode(code)) {
        "A1" -> 0 to 300
        "A2" -> 300 to 800
        "B1" -> 800 to 2000
        "B2" -> 2000 to 4000
        "C1" -> 4000 to 8000
        else -> return 1f
    }
    if (words <= lo) return 0f
    if (words >= hi) return 1f
    return ((words - lo).toFloat() / (hi - lo).toFloat()).coerceIn(0f, 1f)
}

private fun inferCefrCode(words: Int): String = when {
    words >= 4000 -> "C1"
    words >= 2000 -> "B2"
    words >= 800 -> "B1"
    words >= 300 -> "A2"
    else -> "A1"
}

private fun buildLanguageProgress(me: MeResponse?, vocab: List<VocabItem>): List<LangProgress> {
    val chosen = me?.targetLanguages.orEmpty()
    val counts = vocab
        .mapNotNull { it.sourceLang?.trim()?.lowercase()?.takeIf(String::isNotBlank) }
        .groupingBy { it }
        .eachCount()
        .filter { it.value > 0 }
    // Show languages the learner actually uses (saved words). Do not invent a leftover
    // signup default (historically RU) as a 0% card that does not match web or reading.
    if (counts.isEmpty()) return emptyList()
    return counts.entries
        .sortedWith(
            compareByDescending<Map.Entry<String, Int>> { entry ->
                chosen.any { it.targetLanguage.equals(entry.key, ignoreCase = true) && it.isPrimary }
            }.thenByDescending { it.value },
        )
        .map { (raw, words) ->
            val tl = chosen.firstOrNull { it.targetLanguage.equals(raw, ignoreCase = true) }
            val code = raw.uppercase()
            val level = cefrCode(tl?.cefrLevel ?: inferCefrCode(words))
            val next = nextCefr(level)
            LangProgress(
                code = code,
                name = languageName(code),
                level = cefrFullLabel(level),
                towardLabel = if (next != null) "Toward $next" else "Top band",
                pct = if (next != null) cefrBandProgress(words, level) else 1f,
                wordCount = words,
            )
        }
}

private fun weekMinuteSeries(daily: List<StatsHistoryDay>): List<Float> {
    val byDate = daily.associateBy { it.date }
    val today = LocalDate.now()
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    return (0 until 7).map { offset ->
        val key = monday.plusDays(offset.toLong()).toString()
        (byDate[key]?.minutes ?: 0).toFloat()
    }
}

private fun monthHourSeries(daily: List<StatsHistoryDay>): List<Float> {
    val byMonth = mutableMapOf<YearMonth, Int>()
    daily.forEach { day ->
        val date = runCatching { LocalDate.parse(day.date) }.getOrNull() ?: return@forEach
        val ym = YearMonth.from(date)
        byMonth[ym] = (byMonth[ym] ?: 0) + day.minutes
    }
    val cursor = YearMonth.now().minusMonths(11)
    return (0 until 12).map { i ->
        ((byMonth[cursor.plusMonths(i.toLong())] ?: 0) / 60f)
    }
}

private fun buildEarnedAchievementPreviews(streak: Int, words: Int, articles: Int): List<AchievementPreview> {
    val out = mutableListOf<AchievementPreview>()
    if (streak >= 3) {
        out += AchievementPreview(
            "${max(streak, 3)}-Day Streak",
            R.drawable.ic_flame,
            GotchaColors.BrandPurpleSoft,
            GotchaColors.BrandPurple,
        )
    }
    if (articles >= 1) {
        out += AchievementPreview(
            if (articles >= 10) "10 Articles" else "First Article",
            null,
            GotchaColors.InfoBg,
            GotchaColors.InfoText,
            book = true,
        )
    }
    if (words >= 100) {
        out += AchievementPreview(
            when {
                words >= 1000 -> "1000 Words"
                words >= 500 -> "500 Words"
                else -> "100 Words"
            },
            null,
            GotchaColors.SuccessBg,
            GotchaColors.SuccessText,
            star = true,
        )
    }
    return out
}

private fun formatMemberSince(createdAt: String?): String? {
    if (createdAt.isNullOrBlank()) return null
    val date = runCatching { LocalDate.parse(createdAt.take(10)) }.getOrNull() ?: return null
    val month = date.month.name.lowercase().replaceFirstChar { it.titlecase() }
    return "$month ${date.year}"
}

private fun profileAvatarInitials(displayName: String?, email: String?): String {
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
