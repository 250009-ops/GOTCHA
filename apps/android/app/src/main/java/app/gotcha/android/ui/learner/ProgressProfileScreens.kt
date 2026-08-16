package app.gotcha.android.ui.learner

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
import app.gotcha.android.ui.theme.Manrope
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

/** Progress tab — Figma progress-screen 21:294. Full-bleed under glass nav. */
@Composable
fun ProgressScreen(
    onOpenAchievements: () -> Unit = {},
    onOpenHistory: () -> Unit = {},
    onOpenCefr: () -> Unit = {},
    onOpenLanguage: (String) -> Unit = {},
    onOpenStreak: () -> Unit = {},
    onOpenDailyGoal: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val bottomInset = LocalLearnerBottomInset.current
    val topInset = LocalLearnerTopInset.current
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var vocab by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var weekly by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(reloadKey) {
        loading = stats == null
        error = null
        if (stats == null) {
            container.userRepository.statsPeek()?.let { peek ->
                stats = peek.data
                loading = false
            }
        }
        if (me == null) {
            container.userRepository.mePeek()?.let { peek ->
                me = peek.data
            }
        }
        if (vocab.isEmpty()) {
            container.vocabRepository.listPeek()?.let { peek ->
                vocab = peek.data
            }
        }
        try {
            val statsResult = container.userRepository.statsFetch()
            stats = statsResult.data
            val meResult = runCatching { container.userRepository.meFetch() }.getOrNull()
            me = meResult?.data ?: me
            val vocabResult = runCatching { container.vocabRepository.listFetch() }.getOrNull()
            vocab = vocabResult?.data?.takeIf { it.isNotEmpty() } ?: vocab
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (stats == null) {
                error = e.apiErrorMessage("Failed to load stats")
            }
        } finally {
            loading = false
        }
    }

    val statsLoading = loading && stats == null

    when {
        error != null && stats == null && !loading -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val s = stats
            val words = s?.vocabularyTotal ?: s?.wordsSaved ?: vocab.size
            val streak = s?.streakCount ?: me?.streakCount ?: 0
            val articles = s?.contentCompleted ?: 0
            val totalMinutes = s?.totalReadMinutes ?: 0
            val hoursLabel = formatReadTime(totalMinutes)
            val dailyGoal = me?.preferences?.dailyGoalMinutes
                ?: app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES
            val dailyDone = (s?.todayReadMinutes ?: 0).coerceAtMost(dailyGoal.coerceAtLeast(1))
            val dailyPct = (dailyDone / dailyGoal.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
            val languages = remember(me, vocab) {
                buildLanguageProgress(me, vocab)
            }
            val activityPrimary = languages.firstOrNull()
            val chosenForBadge = me?.targetLanguages?.firstOrNull { tl ->
                activityPrimary != null && tl.targetLanguage.equals(activityPrimary.code, ignoreCase = true)
            }
            val levelCode = cefrCode(chosenForBadge?.cefrLevel ?: inferCefrCode(activityPrimary?.wordCount ?: words))
            val levelLabel = cefrShortLabel(levelCode)
            val daily = s?.history?.daily.orEmpty()
            val weeklyMinutes = remember(daily) { weekMinuteSeries(daily) }
            val monthlyHours = remember(daily) { monthHourSeries(daily) }
            val barValues = if (weekly) weeklyMinutes else monthlyHours
            val barLabels =
                if (weekly) listOf("M", "T", "W", "T", "F", "S", "S")
                else listOf("J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D")
            val maxBar = barValues.maxOrNull()?.coerceAtLeast(0.01f) ?: 1f
            val barHeightsDp = barValues.map { v ->
                if (v <= 0f) 4 else (8 + (64 * (v / maxBar))).roundToInt().coerceIn(8, 72)
            }
            val peak = barHeightsDp.indices.maxByOrNull { barHeightsDp[it] } ?: 0
            val earnedBadges = remember(streak, words, articles) {
                buildEarnedAchievementPreviews(streak, words, articles)
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface)
                    .verticalScroll(rememberScrollState())
                    .padding(top = topInset, bottom = bottomInset + 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(top = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Your Progress",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 28.sp,
                        color = GotchaColors.Ink,
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(GotchaColors.BrandPurple)
                            .clickable(onClick = offline.guardClick(onOpenCefr))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        if (statsLoading) {
                            SkeletonBox(Modifier.width(36.dp).height(14.dp), cornerRadius = 4.dp)
                        } else {
                            Text(
                                levelLabel,
                                color = Color.White,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                            )
                        }
                    }
                }

                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = stats != null || me != null,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )

                if (statsLoading) {
                    ProgressStatsSkeleton(Modifier.padding(horizontal = 24.dp))
                } else {
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        ProgressStatCard(
                            "Words learned",
                            formatCount(words),
                            R.drawable.ic_nav_words,
                            cardModifier = Modifier.weight(1f),
                        )
                        Box(Modifier.weight(1f).clickable(onClick = offline.guardClick(onOpenStreak))) {
                            ProgressStatCard(
                                "Reading streak",
                                "$streak Days",
                                R.drawable.ic_flame,
                                cardModifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.weight(1f).clickable(onClick = offline.guardClick(onOpenHistory))) {
                            ProgressStatCard(
                                "Articles read",
                                "$articles",
                                R.drawable.ic_nav_book,
                                cardModifier = Modifier.fillMaxWidth(),
                            )
                        }
                        ProgressStatCard(
                            "Time spent",
                            hoursLabel,
                            R.drawable.ic_nav_chart,
                            cardModifier = Modifier.weight(1f),
                        )
                    }
                }
                }

                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Language Progress",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = GotchaColors.Ink,
                    )
                    if (statsLoading) {
                        SkeletonBox(Modifier.fillMaxWidth().height(72.dp), cornerRadius = 16.dp)
                    } else if (languages.isEmpty()) {
                        Text(
                            "Language progress appears as you save words while reading.",
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            color = GotchaColors.TextMuted,
                        )
                    } else {
                        languages.forEach { lang ->
                            Box(modifier = Modifier.clickable(onClick = offline.guardClick { onOpenLanguage(lang.code) })) {
                                LanguageProgressCard(lang)
                            }
                        }
                    }
                }

                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            if (weekly) "Weekly Activity (mins)" else "Monthly Activity (hrs)",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = GotchaColors.Ink,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(GotchaColors.BrandPurpleSoft)
                                .padding(2.dp),
                        ) {
                            PeriodChip("Weekly", weekly) { weekly = true }
                            PeriodChip("Monthly", !weekly) { weekly = false }
                        }
                    }
                    if (statsLoading) {
                        SkeletonBox(
                            Modifier
                                .fillMaxWidth()
                                .height(100.dp),
                            cornerRadius = 16.dp,
                        )
                    } else if (barValues.all { it <= 0f }) {
                        Text(
                            "No reading activity in this period yet.",
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            color = GotchaColors.TextMuted,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                                .padding(16.dp),
                        )
                    } else {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                                .padding(16.dp)
                                .height(100.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            barHeightsDp.forEachIndexed { i, hDp ->
                                val active = barValues.getOrElse(i) { 0f } > 0f
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Bottom,
                                    modifier = Modifier.width(if (weekly) 30.dp else 22.dp),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .width(14.dp)
                                            .height(hDp.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(
                                                when {
                                                    !active -> GotchaColors.Border
                                                    i == peak -> GotchaColors.BrandPurple
                                                    else -> GotchaColors.BrandPurpleSoft
                                                },
                                            ),
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        barLabels.getOrElse(i) { "" },
                                        fontFamily = Manrope,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp,
                                        color = GotchaColors.TextMuted,
                                    )
                                }
                            }
                        }
                    }
                }

                if (earnedBadges.isNotEmpty()) {
                    Column(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Achievements",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = GotchaColors.Ink,
                            )
                            Text(
                                "See all",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = GotchaColors.BrandPurple,
                                modifier = Modifier.clickable(onClick = offline.guardClick(onOpenAchievements)),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            earnedBadges.take(3).forEach { badge ->
                                AchievementCard(
                                    badge.label,
                                    badge.iconRes,
                                    badge.bg,
                                    badge.tint,
                                    Modifier.weight(1f).clickable(onClick = offline.guardClick(onOpenAchievements)),
                                    book = badge.book,
                                    star = badge.star,
                                )
                            }
                        }
                    }
                }

                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Reading Goals",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = GotchaColors.Ink,
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .clickable(onClick = offline.guardClick(onOpenDailyGoal))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        GoalRow(
                            label = "Daily: $dailyDone / $dailyGoal minutes",
                            pct = dailyPct,
                            badge = "${(dailyPct * 100).toInt()}% done",
                            badgeBg = GotchaColors.BrandPurpleSoft,
                            badgeFg = GotchaColors.BrandPurple,
                            barColor = GotchaColors.BrandPurple,
                        )
                    }
                }
            }
        }
    }
}

/** Profile tab — Figma profile-screen 23:182. Full-bleed under glass nav. */
@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onOpenAdmin: () -> Unit,
    onOpenSettings: (String) -> Unit = {},
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val bottomInset = LocalLearnerBottomInset.current
    val topInset = LocalLearnerTopInset.current
    // bottomInset = pill + gap + navBars; +48 fade/frost +24 breathing (Delete Word / progressDir).
    val profileBottomPad = bottomInset + 48.dp + 24.dp
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var isAdmin by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var showDeleteAccount by remember { mutableStateOf(false) }
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
            .background(GotchaColors.Surface)
            .verticalScroll(rememberScrollState())
            .padding(top = topInset, bottom = profileBottomPad),
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
            val dailyGoal = me?.preferences?.dailyGoalMinutes
                ?: app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES
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
                dailyGoal = dailyGoal,
                nativeLanguage = me?.nativeLanguage,
                uiLanguage = me?.uiLanguage,
                isAdmin = isAdmin,
                offline = offline,
                onOpenSettings = onOpenSettings,
                onOpenAdmin = onOpenAdmin,
                onLogout = onLogout,
                onDeleteAccount = { showDeleteAccount = true },
            )
        }

        if (profileLoading) {
            ProfileSettingsSection(
                dailyGoal = app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES,
                nativeLanguage = null,
                uiLanguage = null,
                isAdmin = false,
                offline = offline,
                onOpenSettings = onOpenSettings,
                onOpenAdmin = onOpenAdmin,
                onLogout = onLogout,
                onDeleteAccount = { showDeleteAccount = true },
            )
        }
    }

    if (showDeleteAccount) {
        DeleteAccountDialog(
            onDismiss = { showDeleteAccount = false },
            onDeleted = {
                showDeleteAccount = false
                scope.launch {
                    container.messagingRealtime.stop()
                    container.authRepository.logout()
                    onLogout()
                }
            },
        )
    }
}

@Composable
private fun ProfileSettingsSection(
    dailyGoal: Int,
    nativeLanguage: String?,
    uiLanguage: String?,
    isAdmin: Boolean,
    offline: OfflineInteraction,
    onOpenSettings: (String) -> Unit,
    onOpenAdmin: () -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit,
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
                iconRes = R.drawable.ic_target,
                title = copy.dailyGoal,
                subtitle = "$dailyGoal ${copy.minutesPerDay}",
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("daily_goal") }() }
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
                showDivider = true,
            ) { offline.guardClick { onOpenSettings("app_language") }() }
            ProfileSettingsRow(
                iconRes = R.drawable.ic_x_circle,
                title = copy.deleteAccount,
                subtitle = copy.deleteAccountSub,
                showDivider = false,
                titleColor = GotchaColors.Danger,
            ) { offline.guardClick(onDeleteAccount)() }
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
private fun GoalRow(label: String, pct: Float, badge: String, badgeBg: Color, badgeFg: Color, barColor: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(label, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(badgeBg)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(badge, color = badgeFg, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
        FigmaProgressBar(pct, barColor)
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
