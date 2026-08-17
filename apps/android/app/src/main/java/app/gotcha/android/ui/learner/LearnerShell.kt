package app.gotcha.android.ui.learner

import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.ChatLangs
import app.gotcha.android.data.model.VocabItem
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.gotcha.android.ui.nav.learnerSlideComposable
import app.gotcha.android.ui.nav.learnerTabComposable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.navigation.navArgument
import app.gotcha.android.PendingLearnerRoute
import app.gotcha.android.PendingWordNavigation
import app.gotcha.android.R
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.components.BrandWordmark
import app.gotcha.android.ui.components.ReconnectionFlashOverlay
import app.gotcha.android.ui.i18n.LocalUiCopy
import app.gotcha.android.ui.i18n.uiCopyFor
import app.gotcha.android.ui.theme.GlassChrome
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.haze
import dev.chrisbanes.haze.hazeChild
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private data class Tab(val route: String, val label: String, @DrawableRes val iconRes: Int)

private val tabs = listOf(
    Tab("home", "Home", R.drawable.ic_nav_home),
    Tab("library", "Library", R.drawable.ic_nav_book),
    Tab("words", "Words", R.drawable.ic_nav_words),
    Tab("progress", "Progress", R.drawable.ic_nav_chart),
    Tab("profile", "Profile", R.drawable.ic_nav_user),
)

private val tabRoutes = tabs.map { it.route }.toSet()

/** Routes that keep the floating top/bottom chrome (main tabs only). */
private val chromeRoutes = tabRoutes

/** App tab strip height — see [GlassChrome.NavHeight]. */
val LearnerGlassNavHeight = GlassChrome.NavHeight

/**
 * Persistent top chrome on the 5 main tabs — same floating-pill geometry as bottom nav
 * (brand left + notifications bell right; height below the status bar).
 */
val LearnerTopBarHeight = GlassChrome.TopBarHeight

/** Bottom inset so lists can scroll under the frosted bar + system nav. */
val LocalLearnerBottomInset = staticCompositionLocalOf { 0.dp }

/** Top inset so headers clear the floating top pill + status-bar glass. */
val LocalLearnerTopInset = staticCompositionLocalOf { 0.dp }

private const val LearnerStartRoute = "home"

/**
 * Status-bar + frost clearance for full-screen directory routes (not tab chrome).
 * Tab screens must keep using [LocalLearnerTopInset] so they do not double-pad.
 */
fun Modifier.learnerDirectoryStatusPad(): Modifier =
    statusBarsPadding().padding(top = GlassChrome.TopContentClearance)

/**
 * Bottom-nav tab switch. Navigation 2.8 treats
 * `navigate(start) + popUpTo(start) { saveState } + launchSingleTop + restoreState`
 * as a no-op when the start destination was never popped — Home stays off-screen.
 */
private fun navigateLearnerTab(nav: NavHostController, route: String) {
    val current = nav.currentDestination?.route
    if (current == route) return
    if (route == LearnerStartRoute) {
        if (!nav.popBackStack(LearnerStartRoute, inclusive = false)) {
            nav.navigate(LearnerStartRoute) { launchSingleTop = true }
        }
        return
    }
    nav.navigate(route) {
        popUpTo(LearnerStartRoute) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
fun LearnerShell(
    onOpenReader: (String) -> Unit,
    onOpenImport: () -> Unit,
    onLogout: () -> Unit,
    onOpenAdmin: () -> Unit,
) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val showBottomBar = current in chromeRoutes
    val container = LocalAppContainer.current
    LaunchedEffect(Unit) {
        runCatching { container.contentRepository.catalogLanguages() }
            .onSuccess { rows ->
                val enabled = rows.filter { it.isEnabled }.map { it.code }
                if (enabled.isNotEmpty()) ChatLangs.setEnabled(enabled)
            }
    }
    var uiLanguage by remember { mutableStateOf("en") }
    var notifUnread by remember { mutableIntStateOf(0) }
    LaunchedEffect(current) {
        val fromCache = container.userRepository.mePeek()?.data?.uiLanguage?.lowercase()
        if (!fromCache.isNullOrBlank()) uiLanguage = fromCache
        runCatching { container.userRepository.meFetch().data.uiLanguage?.lowercase() }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?.let { uiLanguage = it }
    }
    LaunchedEffect(current) {
        runCatching {
            container.userRepository.notificationsPeek()?.let { notifUnread = it.data.unreadCount }
            notifUnread = container.userRepository.notificationsFetch().data.unreadCount
        }
    }
    GotchaSystemBars(darkIcons = true)

    val scope = rememberCoroutineScope()
    var unreadMessages by remember { mutableStateOf(0) }
    var highlightContentId by remember { mutableStateOf<String?>(null) }
    DisposableEffect(Unit) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> scope.launch {
                    if (container.authRepository.isLoggedIn()) {
                        container.messagingRealtime.start()
                    }
                }
                Lifecycle.Event.ON_STOP -> container.messagingRealtime.stop()
                else -> Unit
            }
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(observer)
        onDispose { ProcessLifecycleOwner.get().lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(Unit) {
        container.messagingRealtime.unreadTotal.collect { unreadMessages = it }
    }
    LaunchedEffect(showBottomBar) {
        if (showBottomBar) {
            runCatching {
                val inbox = container.messagingRepository.conversations()
                unreadMessages = inbox.sumOf { it.unreadCount }
            }
        }
    }

    // Optional QA deep-open: adb … --es navigate_word "книга"
    LaunchedEffect(Unit) {
        PendingWordNavigation.collectLatest { lemma ->
            if (!lemma.isNullOrBlank()) {
                PendingWordNavigation.value = null
                nav.navigate("word/$lemma")
            }
        }
    }
    // QA: adb … --es navigate_route "progress" | "streak" | "achievements" | …
    LaunchedEffect(Unit) {
        PendingLearnerRoute.collectLatest { route ->
            if (!route.isNullOrBlank()) {
                PendingLearnerRoute.value = null
                nav.navigate(route) {
                    launchSingleTop = true
                }
            }
        }
    }

    val hazeState = remember { HazeState() }
    var vocabFilter by remember { mutableStateOf(VocabFilterCriteria()) }
    var lastReviewSession by remember { mutableStateOf<ReviewSessionResult?>(null) }
    var pendingReviewQueue by remember { mutableStateOf<List<VocabItem>?>(null) }
    var vocabSourceTitles by remember { mutableStateOf<List<String>>(emptyList()) }
    LaunchedEffect(current) {
        if (current == "words" || current == "vocab_filter") {
            vocabSourceTitles = runCatching {
                container.vocabRepository.listFetch()
            }.getOrNull()?.data?.mapNotNull { it.content?.title?.takeIf(String::isNotBlank) }
                ?.distinct()
                ?.sorted()
                ?: container.vocabRepository.listPeek()?.data
                    ?.mapNotNull { it.content?.title?.takeIf(String::isNotBlank) }
                    ?.distinct()
                    ?.sorted()
                ?: emptyList()
        }
    }
    val navBarDp = learnerNavBarInset()
    val statusBarDp = learnerStatusBarInset()
    // Soft fade so lists can scroll under the frost (tab chrome or sys-only).
    val glassFadeTop = 36.dp
    val glassFadeBottom = 36.dp
    // Always the chrome insets — tab screens must not jump when a directory route
    // hides the pills (LocalLearner* is only consumed by Home/Library/Words/Progress/Profile).
    val chromeBottomInset =
        GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navBarDp + GlassChrome.ContentClearance
    val chromeTopInset =
        statusBarDp + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight + GlassChrome.TopContentClearance

    val uiCopy = remember(uiLanguage) { uiCopyFor(uiLanguage) }
    CompositionLocalProvider(
        LocalLearnerBottomInset provides chromeBottomInset,
        LocalLearnerTopInset provides chromeTopInset,
        LocalUiCopy provides uiCopy,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.Surface),
        ) {
            NavHost(
                navController = nav,
                startDestination = "home",
                modifier = Modifier
                    .fillMaxSize()
                    .haze(state = hazeState),
            ) {
                learnerTabComposable("home") {
                    HomeScreen(
                        onOpenReader = onOpenReader,
                        onSeeAll = { navigateLearnerTab(nav, "library") },
                        onOpenStreak = { nav.navigate("streak") },
                        onOpenDailyGoal = { nav.navigate("daily_goal") },
                        onOpenProfile = { navigateLearnerTab(nav, "profile") },
                        highlightContentId = highlightContentId,
                    )
                }
                learnerTabComposable("library") {
                    // Full-bleed like Home so grid scrolls under clear glass nav.
                    LibraryScreen(
                        // Keep Library → honest Content Detail → Reader (Home still opens Reader).
                        onOpenReader = { id -> nav.navigate("content/$id") },
                        onImport = onOpenImport,
                    )
                }
                learnerTabComposable("words") {
                    // Full-bleed like Home/Library so list scrolls under clear glass nav.
                    VocabularyScreen(
                        filter = vocabFilter,
                        onOpenWord = { lemma -> nav.navigate("word/${lemma}") },
                        onOpenReview = {
                            pendingReviewQueue = null
                            nav.navigate("vocab_review")
                        },
                        onOpenFilter = { nav.navigate("vocab_filter") },
                    )
                }
                learnerTabComposable("progress") {
                    // Full-bleed like Home/Library — scroll under clear glass nav.
                    ProgressScreen(
                        onOpenAchievements = { nav.navigate("achievements") },
                        onOpenHistory = { nav.navigate("history") },
                        onOpenCefr = { nav.navigate("cefr") },
                        onOpenLanguage = { code -> nav.navigate("language/$code") },
                        onOpenStreak = { nav.navigate("streak") },
                        onOpenDailyGoal = { nav.navigate("daily_goal") },
                    )
                }
                learnerTabComposable("profile") {
                    // Full-bleed like Progress — scroll under clear glass nav.
                    ProfileScreen(
                        onLogout = onLogout,
                        onOpenAdmin = onOpenAdmin,
                        onOpenSettings = { key -> nav.navigate(key) },
                    )
                }

                learnerSlideComposable(
                    "content/{contentId}",
                    arguments = listOf(navArgument("contentId") { type = NavType.StringType }),
                ) { entry ->
                    val id = entry.arguments?.getString("contentId") ?: return@learnerSlideComposable
                    ContentDetailScreen(
                        contentId = id,
                        onBack = { nav.popBackStack() },
                        onRead = onOpenReader,
                        onOpenContent = { other -> nav.navigate("content/$other") },
                    )
                }
                learnerSlideComposable("streak") {
                    StreakDetailScreen(
                        onBack = { nav.popBackStack() },
                        onStartReading = {
                            nav.navigate("library") {
                                popUpTo("home") { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                    )
                }
                learnerSlideComposable("daily_goal") { DailyGoalScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("vocab_review") {
                    val seed = pendingReviewQueue
                    VocabularyReviewScreen(
                        seedQueue = seed,
                        onBack = {
                            pendingReviewQueue = null
                            nav.popBackStack()
                        },
                        onComplete = { result ->
                            lastReviewSession = result
                            pendingReviewQueue = null
                            nav.navigate("review_complete") {
                                popUpTo("words") { inclusive = false }
                            }
                        },
                    )
                }
                learnerSlideComposable("review_complete") {
                    ReviewCompleteScreen(
                        result = lastReviewSession,
                        onBack = {
                            nav.navigate("words") { popUpTo("home") { inclusive = false } }
                        },
                        onReviewWeak = {
                            val weak = lastReviewSession?.weak.orEmpty()
                            pendingReviewQueue = weak.map { w ->
                                VocabItem(
                                    id = w.id,
                                    lemma = w.lemma,
                                    translation = w.translation,
                                    sourceLang = w.sourceLang,
                                    contextSentence = w.contextSentence,
                                    content = w.contentTitle?.let {
                                        app.gotcha.android.data.model.VocabContentRef(id = w.id, title = it)
                                    },
                                )
                            }
                            nav.navigate("vocab_review") {
                                popUpTo("words") { inclusive = false }
                            }
                        },
                    )
                }
                learnerSlideComposable(
                    "word/{lemma}",
                    arguments = listOf(navArgument("lemma") { type = NavType.StringType }),
                ) { entry ->
                    val lemma = entry.arguments?.getString("lemma") ?: return@learnerSlideComposable
                    WordDetailScreen(lemma = lemma, onBack = { nav.popBackStack() })
                }
                learnerSlideComposable("vocab_filter") {
                    VocabularyFilterScreen(
                        initial = vocabFilter,
                        sourceTitles = vocabSourceTitles,
                        onBack = { nav.popBackStack() },
                        onApply = { criteria ->
                            vocabFilter = criteria
                            nav.popBackStack()
                        },
                    )
                }
                learnerSlideComposable(
                    "category/{name}",
                    arguments = listOf(navArgument("name") { type = NavType.StringType }),
                ) { entry ->
                    val name = entry.arguments?.getString("name") ?: "All"
                    LibraryCategoryScreen(
                        category = name,
                        onBack = { nav.popBackStack() },
                        onOpenReader = { id -> nav.navigate("content/$id") },
                    )
                }
                learnerSlideComposable(
                    "topic/{name}",
                    arguments = listOf(navArgument("name") { type = NavType.StringType }),
                ) { entry ->
                    val name = entry.arguments?.getString("name") ?: "Literature"
                    TopicResultsScreen(
                        topic = name,
                        onBack = { nav.popBackStack() },
                        onOpenReader = { id -> nav.navigate("content/$id") },
                    )
                }
                learnerSlideComposable("cefr") {
                    CefrLevelScreen(
                        onBack = { nav.popBackStack() },
                        onTakeTest = { nav.navigate("level_test") },
                    )
                }
                learnerSlideComposable(
                    "language/{code}",
                    arguments = listOf(navArgument("code") { type = NavType.StringType }),
                ) { entry ->
                    val code = entry.arguments?.getString("code") ?: "EN"
                    LanguageDetailScreen(
                        code = code,
                        onBack = { nav.popBackStack() },
                        onOpenContent = { id ->
                            if (id.isBlank()) {
                                nav.navigate("library") {
                                    popUpTo("home") { inclusive = false }
                                    launchSingleTop = true
                                }
                            } else {
                                nav.navigate("content/$id")
                            }
                        },
                    )
                }
                learnerSlideComposable("achievements") { AchievementsScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("history") {
                    ReadingHistoryScreen(
                        onBack = { nav.popBackStack() },
                        onOpenReader = { id -> nav.navigate("content/$id") },
                    )
                }
                learnerSlideComposable("bookmarks") { BookmarksScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("reading_settings") { ReadingSettingsScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("notifications") {
                    NotificationsListScreen(
                        onBack = { nav.popBackStack() },
                        onOpenSettings = { nav.navigate("notification_settings") },
                        onOpenHref = { href ->
                            openNotificationHref(nav, href) { id -> highlightContentId = id }
                        },
                    )
                }
                learnerSlideComposable("notification_settings") {
                    NotificationsSettingsScreen(onBack = { nav.popBackStack() })
                }
                learnerSlideComposable("reading_preferences") { ReadingPreferencesScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("edit_profile") {
                    EditProfileScreen(
                        onBack = { nav.popBackStack() },
                    )
                }
                learnerSlideComposable("native_language") { NativeLanguageScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("app_language") { AppLanguageScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("help") { HelpSupportScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("change_password") { ChangePasswordScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("level_test") { LevelTestScreen(onBack = { nav.popBackStack() }) }
                learnerSlideComposable("messages") {
                    MessagesInboxScreen(
                        embedded = false,
                        onBack = { nav.popBackStack() },
                        onOpenChat = { id -> nav.navigate("chat/$id") },
                        onFindLearners = { nav.navigate("find_learners") },
                        onOpenPeer = { id -> nav.navigate("peer/$id") },
                    )
                }
                learnerSlideComposable("find_learners") {
                    FindLearnersScreen(
                        onBack = { nav.popBackStack() },
                        onOpenPeer = { id -> nav.navigate("peer/$id") },
                    )
                }
                learnerSlideComposable(
                    "chat/{conversationId}",
                    arguments = listOf(navArgument("conversationId") { type = NavType.StringType }),
                ) { entry ->
                    val id = entry.arguments?.getString("conversationId") ?: return@learnerSlideComposable
                    MessagingChatScreen(
                        conversationId = id,
                        onBack = { nav.popBackStack() },
                        onOpenPeer = { peerId -> nav.navigate("peer/$peerId") },
                    )
                }
                learnerSlideComposable(
                    "peer/{peerId}",
                    arguments = listOf(navArgument("peerId") { type = NavType.StringType }),
                ) { entry ->
                    val id = entry.arguments?.getString("peerId") ?: return@learnerSlideComposable
                    MessagingPeerProfileScreen(
                        peerId = id,
                        onBack = { nav.popBackStack() },
                        onMessage = { conversationId ->
                            nav.navigate("chat/$conversationId") {
                                popUpTo("messages") { inclusive = false }
                            }
                        },
                    )
                }
            }

            if (showBottomBar) {
                FrostedTopBar(
                    modifier = Modifier.align(Alignment.TopCenter),
                    hazeState = hazeState,
                    fadeBottom = glassFadeBottom,
                    onNotifications = { nav.navigate("notifications") },
                    unreadCount = notifUnread,
                )
                FrostedBottomBar(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    hazeState = hazeState,
                    fadeTop = glassFadeTop,
                    currentRoute = current,
                    onSelect = { route -> navigateLearnerTab(nav, route) },
                )
                // Messaging FAB on Home + Library only (Figma 220:3 / 220:7). Library stacks above import FAB.
                if (current == "home" || current == "library") {
                    MessagingChatFab(
                        unreadCount = unreadMessages,
                        onClick = { nav.navigate("messages") { launchSingleTop = true } },
                        stackOffset = if (current == "library") 68.dp else 0.dp,
                        modifier = Modifier.align(Alignment.BottomEnd),
                    )
                }
            } else {
                // Same clear glass over status / system nav when floating pills are absent.
                SystemStatusGlass(
                    modifier = Modifier.align(Alignment.TopCenter),
                    hazeState = hazeState,
                    fadeBottom = 28.dp,
                )
                // Shorter fade band than tab chrome — sysnav strip is shorter, so 36dp
                // looked like a hard milky step; keep blur/tint identical.
                SystemNavGlass(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    hazeState = hazeState,
                    fadeTop = 40.dp,
                )
            }

            ReconnectionFlashOverlay(
                connectivity = container.connectivityObserver,
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }
}

/**
 * Persistent top chrome across Home / Library / Words / Progress / Profile —
 * mirrors [FrostedBottomBar]: clear-glass sheet in the status-bar zone + floating
 * roundish white pill (brand + notifications). Content scrolls under the frost.
 */
private fun notificationQueryValue(route: String, key: String): String? {
    val query = route.substringAfter('?', missingDelimiterValue = "")
    if (query.isBlank()) return null
    return query.split('&').firstNotNullOfOrNull { part ->
        val idx = part.indexOf('=')
        if (idx <= 0) null
        else if (part.substring(0, idx) == key) part.substring(idx + 1).ifBlank { null } else null
    }
}

private fun notificationContentId(route: String): String? {
    val path = route.substringBefore('?')
    notificationQueryValue(route, "item")?.let { return it }
    notificationQueryValue(route, "id")?.let { return it }
    if (path.startsWith("content/")) {
        return path.removePrefix("content/").substringBefore('/').ifBlank { null }
    }
    return null
}

/**
 * New-catalog news opens the Home dashboard (not Library directory, not Reader paywall).
 */
private fun openNotificationHref(
    nav: NavHostController,
    href: String,
    onHighlightContent: (String?) -> Unit = {},
) {
    val route = href.trim().trimStart('/')
    val path = route.substringBefore('?')
    when {
        route.isBlank() -> return
        path == "streak" -> nav.navigate("streak")
        path == "daily_goal" -> nav.navigate("daily_goal")
        path == "vocab_review" -> nav.navigate("vocab_review")
        path == "words" -> navigateLearnerTab(nav, "words")
        path == "messages" -> nav.navigate("messages")
        path == "achievements" -> nav.navigate("achievements")
        path == "library" || path == "home" || path.startsWith("content/") -> {
            onHighlightContent(notificationContentId(route))
            navigateLearnerTab(nav, "home")
        }
        path == "notification_settings" -> nav.navigate("notification_settings")
        path.startsWith("chat/") -> nav.navigate(path)
        path.startsWith("peer/") -> nav.navigate(path)
        else -> nav.navigate(route)
    }
}

@Composable
private fun FrostedTopBar(
    hazeState: HazeState,
    fadeBottom: Dp,
    onNotifications: () -> Unit,
    unreadCount: Int = 0,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val statusInset = learnerStatusBarInset()
    val totalHeight = statusInset + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight + fadeBottom
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    ) {
        // Single continuous glass: status bar + side gaps + pill zone + soft fade below.
        ClearGlassSheet(
            hazeState = hazeState,
            fadeTop = fadeBottom,
            fadeAtBottom = true,
            modifier = Modifier.fillMaxSize(),
        )

        // Floating software top pill — white + soft shadow (no separate Haze = no seam).
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = statusInset + GlassChrome.NavPillTopGap)
                .fillMaxWidth()
                .padding(horizontal = GlassChrome.TopPillSideInset)
                .height(GlassChrome.TopBarHeight)
                .shadow(
                    elevation = 6.dp,
                    shape = barShape,
                    clip = false,
                    spotColor = Color.Black.copy(alpha = 0.06f),
                    ambientColor = Color.Black.copy(alpha = 0.03f),
                )
                .clip(barShape)
                .background(Color.White.copy(alpha = if (blurCapable) 0.90f else 0.96f)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    BrandMark(
                        size = 32,
                        cornerRadius = 7,
                        tileColor = GotchaColors.BrandPurpleMid,
                    )
                    BrandWordmark(
                        fontSize = 18,
                        color = GotchaColors.BrandNavy,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(GotchaColors.Surface)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onNotifications,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_bell),
                        contentDescription = "Notifications",
                        tint = GotchaColors.BrandNavy,
                        modifier = Modifier.size(18.dp),
                    )
                    if (unreadCount > 0) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(top = 4.dp, end = 4.dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(GotchaColors.BrandPurple),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LearnerTabPad(content: @Composable () -> Unit) {
    val inset = LocalLearnerBottomInset.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = inset),
    ) {
        content()
    }
}

/** System nav inset with a safe floor — Samsung 3-button bar is ~48dp / 135px @450dpi. */
@Composable
private fun learnerNavBarInset(): Dp {
    val fromInsets = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return max(fromInsets, 48.dp)
}

/** Status-bar inset (clock / icons zone) with a small floor for unusual OEMs. */
@Composable
private fun learnerStatusBarInset(): Dp {
    val fromInsets = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    return max(fromInsets, 24.dp)
}

/**
 * Shared clear-glass sheet (blur ~5dp, low tint) with a soft fade so content joins
 * the frost without a hard seam — used under the floating pills AND on no-tab routes.
 *
 * @param fadeAtBottom when true, opaque at the top and fades out toward the bottom
 *   (top chrome). Default false: fades in from the top (bottom chrome).
 */
@Composable
private fun ClearGlassSheet(
    hazeState: HazeState,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
    fadeAtBottom: Boolean = false,
) {
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val clearTintWhite = if (blurCapable) 0.035f else 0.08f
    val clearTintBlack = if (blurCapable) 0.02f else 0.05f
    val clearBlur = 5.dp
    val clearGlassStyle = HazeStyle(
        backgroundColor = GotchaColors.Surface,
        tints = listOf(
            HazeTint(Color.White.copy(alpha = clearTintWhite)),
            HazeTint(Color.Black.copy(alpha = clearTintBlack)),
        ),
        blurRadius = clearBlur,
        noiseFactor = 0f,
        fallbackTint = HazeTint(Color.Black.copy(alpha = 0.08f)),
    )

    Box(
        modifier = modifier
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                val fadeEnd = (fadeTop.toPx() / size.height).coerceIn(0.1f, 0.55f)
                val stops = if (fadeAtBottom) {
                    arrayOf(
                        0f to Color.Black,
                        (1f - fadeEnd) to Color.Black,
                        (1f - fadeEnd * 0.5f) to Color.Black.copy(alpha = 0.45f),
                        1f to Color.Transparent,
                    )
                } else {
                    arrayOf(
                        0f to Color.Transparent,
                        fadeEnd * 0.5f to Color.Black.copy(alpha = 0.45f),
                        fadeEnd to Color.Black,
                        1f to Color.Black,
                    )
                }
                drawRect(
                    brush = Brush.verticalGradient(colorStops = stops),
                    blendMode = BlendMode.DstIn,
                )
            }
            .hazeChild(state = hazeState, style = clearGlassStyle) {
                backgroundColor = GotchaColors.Surface
                tints = listOf(
                    HazeTint(Color.White.copy(alpha = clearTintWhite)),
                    HazeTint(Color.Black.copy(alpha = clearTintBlack)),
                )
                blurRadius = clearBlur
                noiseFactor = 0f
            },
    )
}

/** Full-width status-bar glass when the floating top pill is absent. */
@Composable
private fun SystemStatusGlass(
    hazeState: HazeState,
    fadeBottom: Dp,
    modifier: Modifier = Modifier,
) {
    val statusInset = learnerStatusBarInset()
    val totalHeight = statusInset + fadeBottom
    ClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeBottom,
        fadeAtBottom = true,
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    )
}

/** Full-width system-nav glass when the floating software pill is absent. */
@Composable
private fun SystemNavGlass(
    hazeState: HazeState,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val navInset = learnerNavBarInset()
    val totalHeight = fadeTop + navInset
    ClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeTop,
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    )
}

/**
 * Bottom chrome (Figma 21:277 + Telegram-style continuous glass):
 *
 * - **One** full-width clear-glass Haze sheet for side gaps + under pill float + system nav
 *   (same blur/tint everywhere — no second mismatched frost layer).
 * - Soft vertical alpha fade at the top of that sheet so glass eases in (no hard join line).
 * - Side-inset **floating white pill** for tabs (solid/elevated) drawn on top of the same glass.
 * - Five equal-width tab slots so Profile is never squeezed.
 *
 * Samsung SM-G996N / API 35:
 * - Dual haze (clear 16dp + pill 20dp/white) read as a sharp seam at the pill→sysnav join.
 * - Clear glass needs opaque page-matching `backgroundColor` (`Surface`) + low tint; no Compose
 *   fill on the gap layer (white fill = milk).
 */
@Composable
private fun FrostedBottomBar(
    hazeState: HazeState,
    currentRoute: String?,
    onSelect: (String) -> Unit,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val navInset = learnerNavBarInset()
    val copy = LocalUiCopy.current
    val tabLabel = { route: String, fallback: String ->
        when (route) {
            "home" -> copy.home
            "library" -> copy.library
            "words" -> copy.words
            "progress" -> copy.progress
            "profile" -> copy.profile
            else -> fallback
        }
    }
    val totalHeight = fadeTop + GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navInset
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    ) {
        // Single continuous glass: side gaps + pill zone + float gap + system nav.
        ClearGlassSheet(
            hazeState = hazeState,
            fadeTop = fadeTop,
            modifier = Modifier.fillMaxSize(),
        )

        // Floating software nav pill — white + soft shadow only (no separate Haze = no seam).
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = fadeTop)
                .fillMaxWidth()
                .padding(horizontal = GlassChrome.NavSideInset)
                .height(GlassChrome.NavHeight)
                .shadow(
                    elevation = 6.dp,
                    shape = barShape,
                    clip = false,
                    spotColor = Color.Black.copy(alpha = 0.06f),
                    ambientColor = Color.Black.copy(alpha = 0.03f),
                )
                .clip(barShape)
                .background(Color.White.copy(alpha = if (blurCapable) 0.90f else 0.96f)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        horizontal = GlassChrome.NavInnerHorizontalPad,
                        vertical = GlassChrome.NavInnerVerticalPad,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                tabs.forEach { tab ->
                    val selected = currentRoute == tab.route
                    val label = tabLabel(tab.route, tab.label)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                            ) { onSelect(tab.route) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier = Modifier.size(GlassChrome.TabIconCircle),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (selected) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(CircleShape)
                                            .background(GotchaColors.BrandPurple),
                                    )
                                }
                                Icon(
                                    painter = painterResource(tab.iconRes),
                                    contentDescription = label,
                                    modifier = Modifier.size(GlassChrome.TabIconSize),
                                    tint = if (selected) Color.White else GotchaColors.TextSubtle,
                                )
                            }
                            Text(
                                label,
                                modifier = Modifier.padding(top = GlassChrome.TabIconLabelGap),
                                style = TextStyle(
                                    fontFamily = Manrope,
                                    fontSize = 10.sp,
                                    lineHeight = 12.sp,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                    color = if (selected) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                                    // Drop Android font padding; do not Trim (glyphs can paint upward).
                                    platformStyle = PlatformTextStyle(includeFontPadding = false),
                                ),
                                maxLines = 1,
                                softWrap = false,
                            )
                        }
                    }
                }
            }
        }
    }
}
