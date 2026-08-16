package app.gotcha.android.ui.learner

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.data.model.AuthUser
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.FeedResponse
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.ui.components.HomeFeedCardsSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.components.LevelChip
import app.gotcha.android.ui.components.SkeletonBox
import app.gotcha.android.ui.components.StatCard
import app.gotcha.android.ui.components.StatCardSkeleton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage

@Composable
fun HomeScreen(
    onOpenReader: (String) -> Unit,
    onSeeAll: () -> Unit,
    onOpenStreak: () -> Unit = {},
    onOpenDailyGoal: () -> Unit = {},
    onOpenProfile: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    var user by remember { mutableStateOf<AuthUser?>(null) }
    var feed by remember { mutableStateOf<FeedResponse?>(null) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var streakCount by remember { mutableIntStateOf(0) }
    var dailyGoal by remember { mutableIntStateOf(app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
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
        loading = feed == null && stats == null
        error = null
        if (feed == null) {
            container.contentRepository.feedPeek()?.let { peek ->
                feed = peek.data
                loading = false
            }
        }
        if (stats == null) {
            container.userRepository.statsPeek()?.let { peek ->
                stats = peek.data
                loading = false
            }
        }
        try {
            user = container.authRepository.sessionUser()
            val feedResult = container.contentRepository.feedFetch()
            feed = feedResult.data
            val statsResult = runCatching { container.userRepository.statsFetch() }.getOrNull()
            stats = statsResult?.data ?: stats
            val meResult = runCatching { container.userRepository.meFetch() }.getOrNull()
            val me = meResult?.data
            dailyGoal = me?.preferences?.dailyGoalMinutes
                ?: app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES
            // Same source as Streak detail: live stats.streakCount (not stale session).
            streakCount = stats?.streakCount
                ?: me?.streakCount
                ?: user?.streakCount
                ?: 0
            if (me != null) {
                user = AuthUser(
                    id = me.id,
                    email = me.email,
                    displayName = me.displayName ?: user?.displayName,
                    nativeLanguage = me.nativeLanguage ?: user?.nativeLanguage,
                    uiLanguage = me.uiLanguage ?: user?.uiLanguage,
                    streakCount = me.streakCount,
                    avatarUrl = me.avatarUrl ?: user?.avatarUrl,
                )
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (feed == null && stats == null) {
                error = e.apiErrorMessage("Failed to load home")
            }
        } finally {
            loading = false
        }
    }

    LaunchedEffect(feed) {
        val warm = feed?.readerWarmIds()?.map { it.id }.orEmpty()
        if (warm.isNotEmpty()) {
            runCatching { container.contentRepository.prefetchReaders(warm) }
        }
    }

    val bottomInset = LocalLearnerBottomInset.current
    val topInset = LocalLearnerTopInset.current
    val feedLoading = loading && feed == null
    val statsLoading = loading && stats == null
    val goal = dailyGoal.coerceAtLeast(1)
    val minutes = (stats?.todayReadMinutes ?: 0).coerceAtMost(goal)
    val pct = (minutes / goal.toFloat()).coerceIn(0f, 1f)
    val todayWords = stats?.todayWordsSaved ?: 0
    val continueItems = feed?.continueReading.orEmpty()
    val recommendedItems = feed?.recentlyPublished.orEmpty()
    val myImportItems = feed?.myImports.orEmpty()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface),
        contentPadding = PaddingValues(
            top = topInset,
            bottom = bottomInset + 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp, bottom = 16.dp)
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "Welcome back,",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Normal,
                        color = GotchaColors.TextMuted,
                        fontSize = 14.sp,
                        lineHeight = 17.sp,
                    )
                    if (user == null && loading) {
                        SkeletonBox(Modifier.width(160.dp).height(22.dp), cornerRadius = 8.dp)
                    } else {
                        Text(
                            user?.displayName ?: user?.email?.substringBefore("@") ?: "Learner",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 22.sp,
                            lineHeight = 27.sp,
                            color = GotchaColors.Ink,
                        )
                    }
                }
                HomeAvatar(
                    name = user?.displayName ?: user?.email,
                    avatarUrl = user?.avatarUrl,
                    onClick = offline.guardClick(onOpenProfile),
                )
            }
        }
        item {
            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = feed != null || stats != null,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
            )
        }
        item {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(
                            elevation = 8.dp,
                            shape = RoundedCornerShape(20.dp),
                            spotColor = Color(0x217008E7),
                        )
                        .clip(RoundedCornerShape(20.dp))
                        .background(GotchaColors.BrandPurple)
                        .clickable(onClick = offline.guardClick(onOpenStreak))
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.13f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_flame),
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            "$streakCount-Day Streak!",
                            color = Color.White,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                        Text(
                            "Keep it up! Read today to maintain your progress.",
                            color = GotchaColors.BrandPurpleMuted,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Normal,
                            fontSize = 13.sp,
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                        .clickable(onClick = offline.guardClick(onOpenDailyGoal))
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Box(modifier = Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                        Canvas(modifier = Modifier.size(72.dp)) {
                            drawCircle(
                                color = GotchaColors.Border,
                                style = Stroke(width = 8.dp.toPx()),
                            )
                            drawArc(
                                color = GotchaColors.BrandPurple,
                                startAngle = -90f,
                                sweepAngle = 360f * pct,
                                useCenter = false,
                                style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round),
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                "Today",
                                fontFamily = Manrope,
                                fontSize = 11.sp,
                                color = GotchaColors.TextMuted,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "$minutes / $goal",
                                fontFamily = Manrope,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = GotchaColors.Ink,
                            )
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "Daily Goal",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                        )
                        Text(
                            "$minutes / $goal min read today",
                            fontFamily = Manrope,
                            color = GotchaColors.TextMuted,
                            fontSize = 13.sp,
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(GotchaColors.BrandPurpleSoft)
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        ) {
                            Text(
                                "${(pct * 100).toInt()}% done",
                                color = GotchaColors.BrandPurple,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }

                if (statsLoading) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCardSkeleton(Modifier.weight(1f))
                        StatCardSkeleton(Modifier.weight(1f))
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(
                            "New words",
                            "$todayWords",
                            GotchaColors.BrandPurple,
                            Modifier.weight(1f),
                        )
                        StatCard(
                            "Reading time",
                            "$minutes min",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Continue Reading",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = GotchaColors.Ink,
                    )
                    when {
                        error != null && feed == null -> OfflineEmptyState(
                            subtitle = "Connect to the internet to load your reading list.",
                            onRetry = { reloadKey += 1 },
                            compact = true,
                        )
                        feedLoading -> HomeFeedCardsSkeleton()
                        continueItems.isEmpty() -> {
                            Text(
                                "Pick something from Library to start reading.",
                                fontFamily = Manrope,
                                color = GotchaColors.TextSubtle,
                                fontSize = 13.sp,
                            )
                        }
                        else -> continueItems.take(4).forEach { item ->
                            ContinueCard(item, onClick = offline.guardClick { onOpenReader(item.id) })
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Recommended for you",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = GotchaColors.Ink,
                        )
                        Text(
                            "See all",
                            color = GotchaColors.BrandPurple,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            modifier = Modifier.clickable(onClick = offline.guardClick(onSeeAll)),
                        )
                    }
                    if (feedLoading) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
                            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
                        }
                    } else {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(recommendedItems.take(8)) { item ->
                                RecommendCard(
                                    item,
                                    onClick = offline.guardClick { onOpenReader(item.id) },
                                )
                            }
                        }
                    }
                }

                if (myImportItems.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Your imports",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = GotchaColors.Ink,
                        )
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(myImportItems.take(8)) { item ->
                                RecommendCard(
                                    item,
                                    onClick = offline.guardClick { onOpenReader(item.id) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ContinueCard(item: ContentItem, onClick: () -> Unit) {
    val pct = ((item.progressPct ?: 0.0) / 100.0).toFloat().coerceIn(0f, 1f)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        CoverThumb(item.coverImageUrl, Modifier.size(width = 50.dp, height = 70.dp), corner = 8)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                LangChip(item.language ?: "?", large = true)
                Text(
                    "${(item.progressPct ?: 0.0).toInt()}% read",
                    color = GotchaColors.TextSubtle,
                    fontFamily = Manrope,
                    fontSize = 12.sp,
                )
            }
            Text(
                item.title ?: "Untitled",
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(GotchaColors.Border),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(pct)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(GotchaColors.BrandPurple),
                )
            }
        }
    }
}

/**
 * 44dp circle with a 2dp brand ring. Real photo when the account has one;
 * otherwise initials — never the bundled Figma illustration.
 */
@Composable
private fun HomeAvatar(name: String?, avatarUrl: String?, onClick: () -> Unit) {
    var imageFailed by remember(avatarUrl) { mutableStateOf(false) }
    val resolved = resolveMediaUrl(avatarUrl)
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(GotchaColors.BrandPurpleSoft)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (!resolved.isNullOrBlank() && !imageFailed) {
            AsyncImage(
                model = resolved,
                contentDescription = "Profile",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                onError = { imageFailed = true },
            )
        } else {
            Text(
                homeAvatarInitials(name),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.BrandPurple,
            )
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .border(2.dp, GotchaColors.BrandPurple, CircleShape),
        )
    }
}

private fun homeAvatarInitials(name: String?): String {
    val parts = name.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(2).uppercase()
        else -> "${parts[0].first()}${parts[1].first()}".uppercase()
    }
}

@Composable
fun CoverThumb(url: String?, modifier: Modifier = Modifier, corner: Int = 8) {
    if (!url.isNullOrBlank()) {
        AsyncImage(
            model = resolveMediaUrl(url),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier.clip(RoundedCornerShape(corner.dp)),
        )
    } else {
        Box(
            modifier = modifier
                .clip(RoundedCornerShape(corner.dp))
                .background(GotchaColors.BrandPurple),
            contentAlignment = Alignment.Center,
        ) {
            Text("G", color = Color.White.copy(0.5f), fontWeight = FontWeight.Bold, fontFamily = Manrope)
        }
    }
}

@Composable
private fun RecommendCard(item: ContentItem, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(160.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CoverThumb(item.coverImageUrl, Modifier.fillMaxWidth().aspectRatio(3f / 4f), corner = 10)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            LangChip(item.language ?: "?")
            if (!item.cefrLevel.isNullOrBlank()) LevelChip(item.cefrLevel)
        }
        Text(
            item.title ?: "Untitled",
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = GotchaColors.Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
