package app.gotcha.android.ui.learner

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.haze
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.PendingLearnerRoute
import app.gotcha.android.PendingReaderReturn
import app.gotcha.android.ReaderReturnContext
import app.gotcha.android.PendingWordNavigation
import app.gotcha.android.data.ChatLangs
import app.gotcha.android.ui.components.ReconnectionFlashOverlay
import app.gotcha.android.ui.i18n.LocalUiCopy
import app.gotcha.android.ui.i18n.uiCopyFor
import app.gotcha.android.ui.nav.learnerSlideComposable
import app.gotcha.android.ui.nav.learnerTabComposable
import app.gotcha.android.ui.theme.GotchaSystemBars
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

val LocalLearnerBottomInset = staticCompositionLocalOf { 0.dp }
val LocalLearnerTopInset = staticCompositionLocalOf { 0.dp }

private const val LearnerStartRoute = "library"

fun Modifier.learnerDirectoryStatusPad(): Modifier = this

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

private fun sidebarToRoute(item: String): String = when (item) {
    "vocabulary" -> "words"
    "stats" -> "progress"
    "settings" -> "settings"
    else -> item
}

@Composable
fun LearnerShell(
    onOpenReader: (String) -> Unit,
    onLogout: () -> Unit,
    onOpenAdmin: () -> Unit,
    @Suppress("UNUSED_PARAMETER") onOpenImport: () -> Unit = {},
    onOpenPractice: () -> Unit = {},
    onOpenImportUrl: () -> Unit = {},
    onOpenImportPaste: () -> Unit = {},
    onOpenImportFile: () -> Unit = {},
) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val container = LocalAppContainer.current
    LaunchedEffect(Unit) {
        runCatching { container.contentRepository.catalogLanguages() }
            .onSuccess { rows ->
                val enabled = rows.filter { it.isEnabled }.map { it.code }
                if (enabled.isNotEmpty()) ChatLangs.setEnabled(enabled)
            }
    }
    val pendingBrowseRestore = remember {
        PendingReaderReturn.value?.also { PendingReaderReturn.value = null }
    }

    var uiLanguage by remember { mutableStateOf("en") }
    var notifUnread by remember { mutableIntStateOf(0) }
    var streakCount by remember { mutableIntStateOf(0) }
    var displayName by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf<String?>(null) }
    var avatarUrl by remember { mutableStateOf<String?>(null) }
    var librarySearch by remember { mutableStateOf(pendingBrowseRestore?.librarySearch.orEmpty()) }
    var browseFilter by remember { mutableStateOf(pendingBrowseRestore?.browseFilter) }
    var browseCollection by remember { mutableStateOf(pendingBrowseRestore?.browseCollection) }
    var highlightContentId by remember { mutableStateOf<String?>(null) }
    var unreadMessages by remember { mutableIntStateOf(0) }
    var searchExpanded by remember { mutableStateOf(false) }
    val hazeState = remember { HazeState() }
    val showChrome = current in learnerChromeRoutes
    val searchAvailable = false

    LaunchedEffect(current) {
        searchExpanded = false
    }

    LaunchedEffect(current) {
        val fromCache = container.userRepository.mePeek()?.data?.uiLanguage?.lowercase()
        if (!fromCache.isNullOrBlank()) uiLanguage = fromCache
        runCatching { container.userRepository.meFetch().data }
            .getOrNull()
            ?.let { me ->
                me.uiLanguage?.lowercase()?.takeIf { it.isNotBlank() }?.let { uiLanguage = it }
                displayName = me.displayName
                email = me.email
                avatarUrl = me.avatarUrl
                streakCount = me.streakCount
            }
        runCatching { container.userRepository.statsFetch().data.streakCount }
            .getOrNull()
            ?.let { streakCount = it }
    }
    LaunchedEffect(current) {
        runCatching {
            container.userRepository.notificationsPeek()?.let { notifUnread = it.data.unreadCount }
            notifUnread = container.userRepository.notificationsFetch().data.unreadCount
        }
    }
    GotchaSystemBars(darkIcons = true)

    val scope = rememberCoroutineScope()
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
        while (true) {
            runCatching { container.messagingRepository.heartbeat() }
            delay(25_000)
        }
    }
    LaunchedEffect(Unit) {
        container.messagingRealtime.unreadTotal.collect { unreadMessages = it }
    }
    LaunchedEffect(showChrome) {
        if (showChrome) {
            runCatching {
                unreadMessages = container.messagingRepository.conversations().sumOf { it.unreadCount }
            }
        }
    }

    var pendingVocabSearch by remember { mutableStateOf<String?>(null) }
    var pendingVocabReview by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        PendingWordNavigation.collectLatest { lemma ->
            if (!lemma.isNullOrBlank()) {
                PendingWordNavigation.value = null
                pendingVocabSearch = lemma
                navigateLearnerTab(nav, "words")
            }
        }
    }
    LaunchedEffect(Unit) {
        PendingLearnerRoute.collectLatest { route ->
            if (!route.isNullOrBlank()) {
                PendingLearnerRoute.value = null
                val mapped = sidebarToRoute(route)
                nav.navigate(mapped) { launchSingleTop = true }
            }
        }
    }
    LaunchedEffect(pendingBrowseRestore) {
        if (pendingBrowseRestore != null) {
            nav.navigate("browse") { launchSingleTop = true }
        }
    }

    val openReaderFromLearner: (String) -> Unit = { id ->
        if (current == "browse") {
            PendingReaderReturn.value = ReaderReturnContext(
                browseFilter = browseFilter,
                browseCollection = browseCollection,
                librarySearch = librarySearch,
            )
        } else {
            PendingReaderReturn.value = null
        }
        onOpenReader(id)
    }

    val uiCopy = remember(uiLanguage) { uiCopyFor(uiLanguage) }
    val (chromeTopInset, chromeBottomInset) = rememberLearnerChromeInsets(showChrome, searchExpanded)
    CompositionLocalProvider(
        LocalLearnerBottomInset provides chromeBottomInset,
        LocalLearnerTopInset provides chromeTopInset,
        LocalUiCopy provides uiCopy,
    ) {
        WebLearnerShellFrame(
            currentRoute = current,
            unreadNotifs = notifUnread,
            unreadMessages = unreadMessages,
            streakCount = streakCount,
            displayName = displayName,
            email = email,
            avatarUrl = avatarUrl,
            searchAvailable = searchAvailable,
            searchQuery = librarySearch,
            onSearchChange = { q ->
                librarySearch = q
                if (q.isNotBlank() && current == "library") {
                    browseFilter = null
                    browseCollection = null
                    nav.navigate("browse") { launchSingleTop = true }
                }
            },
            searchExpanded = searchExpanded,
            onSearchExpandedChange = { searchExpanded = it },
            showChrome = showChrome,
            hazeState = hazeState,
            onNav = { item ->
                when (item) {
                    "notifications" -> nav.navigate("notifications")
                    "messages" -> nav.navigate("messages")
                    else -> {
                        val dest = sidebarToRoute(item)
                        if (dest == "library") {
                            librarySearch = ""
                            browseFilter = null
                            browseCollection = null
                        }
                        navigateLearnerTab(nav, dest)
                    }
                }
            },
            onMessages = { nav.navigate("messages") },
            onLogout = onLogout,
        ) {
            Box(Modifier.fillMaxSize()) {
                NavHost(
                    navController = nav,
                    startDestination = LearnerStartRoute,
                    modifier = Modifier
                        .fillMaxSize()
                        .haze(state = hazeState),
                ) {
                    learnerTabComposable("library") {
                        LibraryScreen(
                            onOpenReader = openReaderFromLearner,
                            onImport = { navigateLearnerTab(nav, "import") },
                            onBrowse = { filter, collection ->
                                browseFilter = filter
                                browseCollection = collection
                                nav.navigate("browse") { launchSingleTop = true }
                            },
                            highlightContentId = highlightContentId,
                        )
                    }
                    learnerTabComposable("browse") {
                        LibraryScreen(
                            isBrowse = true,
                            browseFilter = browseFilter,
                            browseCollection = browseCollection,
                            headerQuery = librarySearch,
                            onHeaderSearchChange = { librarySearch = it },
                            highlightContentId = highlightContentId,
                            onOpenReader = openReaderFromLearner,
                            onImport = { navigateLearnerTab(nav, "import") },
                            onBrowse = { filter, collection ->
                                browseFilter = filter
                                browseCollection = collection
                            },
                            onBackToLibrary = { navigateLearnerTab(nav, "library") },
                        )
                    }
                    learnerTabComposable("words") {
                        val initialSearch = pendingVocabSearch
                        val openReview = pendingVocabReview
                        if (initialSearch != null) pendingVocabSearch = null
                        if (openReview) pendingVocabReview = false
                        VocabularyScreen(
                            initialSearch = initialSearch,
                            openReviewOnLaunch = openReview,
                            onGoToLibrary = { navigateLearnerTab(nav, "library") },
                        )
                    }
                    learnerTabComposable("import") {
                        ImportScreen(
                            embedded = true,
                            onClose = { navigateLearnerTab(nav, "library") },
                            onBrowseCatalog = { navigateLearnerTab(nav, "library") },
                            onOpenUrl = onOpenImportUrl,
                            onOpenPaste = onOpenImportPaste,
                            onOpenFile = onOpenImportFile,
                            onRead = openReaderFromLearner,
                        )
                    }
                    learnerTabComposable("progress") {
                        ProgressScreen()
                    }
                    learnerSlideComposable("notifications") {
                        NotificationsListScreen(
                            onBack = { nav.popBackStack() },
                            onOpenSettings = { nav.navigate("notification_settings") },
                            onOpenHref = { href ->
                                openNotificationHref(
                                    nav = nav,
                                    href = href,
                                    onHighlightContent = { id -> highlightContentId = id },
                                    onOpenVocabReview = {
                                        pendingVocabReview = true
                                        navigateLearnerTab(nav, "words")
                                    },
                                )
                            },
                        )
                    }
                    learnerSlideComposable("messages") {
                        MessagesInboxScreen(
                            embedded = false,
                            onBack = { nav.popBackStack() },
                            onOpenChat = { id -> nav.navigate("chat/$id") },
                            onFindLearners = { nav.navigate("find_learners") },
                            onOpenPeer = { id -> nav.navigate("peer/$id") },
                        )
                    }
                    learnerTabComposable("settings") {
                        SettingsScreen(
                            onLogout = onLogout,
                            onOpenImport = { navigateLearnerTab(nav, "import") },
                            onChangePassword = { nav.navigate("change_password") },
                            onProfileUpdated = {
                                scope.launch {
                                    runCatching { container.userRepository.meFetch().data }
                                        .getOrNull()
                                        ?.let { me ->
                                            displayName = me.displayName
                                            email = me.email
                                            avatarUrl = me.avatarUrl
                                        }
                                }
                            },
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
                            onRead = openReaderFromLearner,
                            onOpenContent = { other -> nav.navigate("content/$other") },
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
                            onOpenReader = openReaderFromLearner,
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
                            onOpenReader = openReaderFromLearner,
                        )
                    }
                    learnerSlideComposable("bookmarks") { BookmarksScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("reading_settings") { ReadingSettingsScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("notification_settings") {
                        NotificationsSettingsScreen(onBack = { nav.popBackStack() })
                    }
                    learnerSlideComposable("reading_preferences") { ReadingPreferencesScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("edit_profile") {
                        EditProfileScreen(onBack = { nav.popBackStack() })
                    }
                    learnerSlideComposable("native_language") { NativeLanguageScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("app_language") { AppLanguageScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("help") { HelpSupportScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("change_password") { ChangePasswordScreen(onBack = { nav.popBackStack() }) }
                    learnerSlideComposable("level_test") { LevelTestScreen(onBack = { nav.popBackStack() }) }
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
                ReconnectionFlashOverlay(
                    connectivity = container.connectivityObserver,
                    modifier = Modifier.align(Alignment.Center),
                )
            }
        }
    }
}

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

private fun openNotificationHref(
    nav: NavHostController,
    href: String,
    onHighlightContent: (String?) -> Unit = {},
    onOpenVocabReview: () -> Unit = {},
) {
    val route = href.trim().trimStart('/')
    val path = route.substringBefore('?')
    when {
        route.isBlank() -> return
        path == "streak" || path == "daily_goal" || path == "achievements" || path == "history" ||
            path == "cefr" || path.startsWith("language/") || path == "stats" || path == "progress" ->
            navigateLearnerTab(nav, "progress")
        path == "vocab_review" || path == "words" || path == "vocabulary" -> {
            if (path == "vocab_review") onOpenVocabReview() else navigateLearnerTab(nav, "words")
        }
        path == "messages" -> nav.navigate("messages")
        path == "library" || path == "home" || path.startsWith("content/") -> {
            onHighlightContent(notificationContentId(route))
            navigateLearnerTab(nav, "library")
        }
        path == "notification_settings" -> nav.navigate("notification_settings")
        path.startsWith("chat/") -> nav.navigate(path)
        path.startsWith("peer/") -> nav.navigate(path)
        else -> nav.navigate(route)
    }
}
