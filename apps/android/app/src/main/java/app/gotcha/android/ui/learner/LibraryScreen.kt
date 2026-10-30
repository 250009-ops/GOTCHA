package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.AuthUser
import app.gotcha.android.data.model.CatalogLanguage
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.FeaturedCollection
import app.gotcha.android.data.model.FeedResponse
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.ui.components.HomeScreenSkeleton
import app.gotcha.android.ui.components.LibraryBrowseSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebBreakpoints
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.WebMaxWidth
import app.gotcha.android.ui.theme.webPageHorizontalPad
import app.gotcha.android.ui.theme.webPageVerticalPad
import app.gotcha.android.ui.theme.webScreenWidthDp
import coil.compose.AsyncImage
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt

private val staticFilterTabs = listOf("Fiction", "News", "Imports", "A1–A2", "B1–B2", "C1–C2")

private val coverPalettes = listOf(
    listOf(GotchaBlue.B500, GotchaBlue.B400, Color(0xFF4F39F6)),
    listOf(Color(0xFF00D492), Color(0xFF00BBA7), Color(0xFF0092B8)),
    listOf(Color(0xFFFB2C6B), Color(0xFFF6339A), Color(0xFFE60076)),
    listOf(Color(0xFF2B7FFF), Color(0xFF6A5CFF), Color(0xFF4F39F6)),
    listOf(Color(0xFFFFB900), Color(0xFFFF8904), Color(0xFFE6360A)),
    listOf(Color(0xFF05DF72), Color(0xFF00C951), Color(0xFF00966B)),
)

fun coverBrushForId(id: String): Brush {
    var hash = 0
    for (ch in id) hash = (hash + ch.code) % coverPalettes.size
    val colors = coverPalettes[hash]
    return Brush.linearGradient(colors)
}

private fun formatWordCount(count: Int): String =
    if (count >= 1000) String.format(Locale.US, "%.1fk words", count / 1000.0) else "$count words"

private fun formatUzs(amount: Double): String = formatSom(amount)

private fun itemSubtitle(item: ContentItem) = item.subtitle ?: item.description.orEmpty()

private fun isUserImport(item: ContentItem) =
    item.contentType == "user_import" || item.contentSource == "user_import"

private fun cefrColors(level: String): Pair<Color, Color> = when (level.lowercase()) {
    "a1" -> Color(0xFFD1FAE5) to Color(0xFF047857)
    "a2" -> Color(0xFFCCFBF1) to Color(0xFF0F766E)
    "b1" -> Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
    "b2" -> Color(0xFFE0E7FF) to Color(0xFF4338CA)
    "c1" -> GotchaBlue.B50 to GotchaBlue.B700
    "c2" -> Color(0xFFFCE7F3) to Color(0xFFBE185D)
    else -> Color(0xFFF3F4F6) to Color(0xFF4B5563)
}

@Composable
fun LibraryScreen(
    onOpenReader: (String) -> Unit,
    onImport: () -> Unit,
    onBrowse: (filter: String?, collection: String?) -> Unit,
    onBackToLibrary: () -> Unit = {},
    isBrowse: Boolean = false,
    browseFilter: String? = null,
    browseCollection: String? = null,
    headerQuery: String = "",
    onHeaderSearchChange: (String) -> Unit = {},
    highlightContentId: String? = null,
) {
    val container = LocalAppContainer.current
    val widthDp = webScreenWidthDp()
    val hPad = webPageHorizontalPad(widthDp)
    val vPad = webPageVerticalPad(widthDp)
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    var user by remember { mutableStateOf<AuthUser?>(null) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var feed by remember { mutableStateOf<FeedResponse?>(null) }
    var catalog by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var langs by remember { mutableStateOf<List<CatalogLanguage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var catalogLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var viewGrid by remember { mutableStateOf(true) }
    var search by remember { mutableStateOf(headerQuery) }
    var activeFilter by remember { mutableStateOf(browseFilter ?: "All") }

    LaunchedEffect(headerQuery) {
        search = headerQuery
    }
    LaunchedEffect(browseFilter) {
        if (!browseFilter.isNullOrBlank()) activeFilter = browseFilter
    }

    LaunchedEffect(Unit) {
        loading = feed == null
        error = null
        container.contentRepository.feedPeek()?.let {
            feed = it.data
            loading = false
        }
        try {
            user = container.authRepository.sessionUser()
            langs = runCatching { container.contentRepository.catalogLanguages() }.getOrDefault(emptyList())
            feed = container.contentRepository.feedFetch().data
            stats = runCatching { container.userRepository.statsFetch().data }.getOrNull()
            val me = runCatching { container.userRepository.meFetch().data }.getOrNull()
            if (user == null && me != null) {
                user = AuthUser(
                    id = me.id,
                    email = me.email,
                    displayName = me.displayName,
                    nativeLanguage = me.nativeLanguage,
                    uiLanguage = me.uiLanguage,
                    streakCount = me.streakCount,
                    avatarUrl = me.avatarUrl,
                )
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (feed == null) error = e.apiErrorMessage("Failed to load library")
        } finally {
            loading = false
        }
    }

    val nativeCode = user?.nativeLanguage?.trim()?.lowercase().orEmpty()
    val languageTabs = langs
        .filter { it.isEnabled }
        .map { it.code.uppercase() }
        .filter { it.lowercase() != nativeCode }
    val filterTabs = listOf("All") + languageTabs + staticFilterTabs
    val langFlags = langs.associate { it.code.lowercase() to (it.flagEmoji ?: "🌐") }

    val catalogLangQuery = languageTabs.firstOrNull { it.equals(activeFilter, true) }?.lowercase().orEmpty()
        .takeIf { it != nativeCode }.orEmpty()

    LaunchedEffect(isBrowse, browseCollection, catalogLangQuery, activeFilter) {
        if (!isBrowse || !browseCollection.isNullOrBlank()) {
            if (!isBrowse) catalog = emptyList()
            return@LaunchedEffect
        }
        if (activeFilter == "Imports") return@LaunchedEffect
        catalogLoading = true
        try {
            val all = mutableListOf<ContentItem>()
            var page = 1
            var hasMore = true
            while (hasMore && page <= 10) {
                val result = container.contentRepository.listFetch(
                    lang = catalogLangQuery.ifBlank { null },
                    page = page,
                    pageSize = 100,
                )
                all += result.data.items
                hasMore = result.data.hasMore
                page += 1
            }
            catalog = all.distinctBy { it.id }
        } catch (_: Exception) {
            // keep whatever we have
        } finally {
            catalogLoading = false
        }
    }

    val collection = feed?.featuredCollections?.firstOrNull { it.browseKey == browseCollection }
    val uniqueItems = remember(feed) {
        val raw = buildList {
            feed?.continueReading?.let { addAll(it) }
            feed?.recentlyPublished?.let { addAll(it) }
            feed?.myImports?.let { addAll(it) }
            feed?.featuredCollections?.forEach { col ->
                col.items.mapNotNull { it.content }.let { addAll(it) }
            }
        }
        raw.distinctBy { it.id }
    }
    val baseItems = when {
        collection != null -> collection.items.mapNotNull { it.content }.distinctBy { it.id }
        isBrowse && activeFilter == "Imports" -> feed?.myImports.orEmpty()
        isBrowse -> catalog
        else -> uniqueItems
    }
    val allowed = languageTabs.map { it.lowercase() }.toSet()
    val filtered = baseItems.filter { item ->
        if (!isUserImport(item)) {
            val lang = item.language?.trim()?.lowercase().orEmpty()
            if (nativeCode.isNotBlank() && lang == nativeCode) return@filter false
            if (allowed.isNotEmpty() && lang.isNotBlank() && lang !in allowed) return@filter false
        }
        matchesSearch(item, search) && matchesFilter(item, activeFilter, languageTabs)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas),
    ) {
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = feed != null || catalog.isNotEmpty(),
        )
        when {
            loading && !isBrowse -> {
                val cols = when {
                    widthDp >= WebBreakpoints.Xl -> 5
                    widthDp >= WebBreakpoints.Lg -> 4
                    widthDp >= WebBreakpoints.Sm -> 3
                    else -> 2
                }
                WebCenteredColumn(maxWidth = WebMaxWidth.W7xl, modifier = Modifier.fillMaxSize()) {
                    HomeScreenSkeleton(Modifier.fillMaxWidth())
                }
            }
            isBrowse -> {
                val gridLoading = loading || (collection == null && catalogLoading && catalog.isEmpty())
                WebCenteredColumn(maxWidth = WebMaxWidth.W7xl, modifier = Modifier.fillMaxSize()) {
                    BrowseBody(
                        widthDp = widthDp,
                        hPad = 0.dp,
                        vPad = 0.dp,
                        collectionTitle = collection?.title,
                        collectionDesc = collection?.description,
                        search = search,
                        onSearch = {
                            search = it
                            onHeaderSearchChange(it)
                        },
                        viewGrid = viewGrid,
                        onViewGrid = { viewGrid = it },
                        filterTabs = filterTabs,
                        activeFilter = activeFilter,
                        onFilter = { activeFilter = it },
                        filtered = filtered,
                        emptyLibrary = !gridLoading && !catalogLoading && baseItems.isEmpty(),
                        gridLoading = gridLoading,
                        langFlags = langFlags,
                        highlightId = highlightContentId,
                        onBack = onBackToLibrary,
                        onOpenReader = { id -> offline.guardClick { onOpenReader(id) }() },
                        onImport = onImport,
                    )
                }
            }
            else -> WebCenteredColumn(maxWidth = WebMaxWidth.W7xl, modifier = Modifier.fillMaxSize()) {
                HomeBody(
                    widthDp = widthDp,
                    hPad = 0.dp,
                    vPad = 0.dp,
                user = user,
                stats = stats,
                feed = feed,
                error = error,
                langFlags = langFlags,
                highlightId = highlightContentId,
                uniqueEmpty = uniqueItems.isEmpty(),
                onOpenReader = { id -> offline.guardClick { onOpenReader(id) }() },
                onBrowse = onBrowse,
                onImport = onImport,
                )
            }
        }
    }
}

@Composable
private fun HomeBody(
    widthDp: Int,
    hPad: androidx.compose.ui.unit.Dp,
    vPad: androidx.compose.ui.unit.Dp,
    user: AuthUser?,
    stats: UserStats?,
    feed: FeedResponse?,
    error: String?,
    langFlags: Map<String, String>,
    highlightId: String?,
    uniqueEmpty: Boolean,
    onOpenReader: (String) -> Unit,
    onBrowse: (String?, String?) -> Unit,
    onImport: () -> Unit,
) {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val greeting = when {
        hour < 12 -> "morning"
        hour < 17 -> "afternoon"
        else -> "evening"
    }
    val firstName = (user?.displayName ?: "Learner").split(" ").first()
    val streak = stats?.streakCount ?: user?.streakCount ?: 0
    val words = if ((stats?.wordsLearned ?: 0) > 0) stats!!.wordsLearned else stats?.vocabularyTotal ?: 0
    val streakSubtitle = when (streak) {
        0 -> "Start reading today to begin a streak."
        1 -> "You're on day 1 — keep it going tomorrow!"
        else -> "Keep your streak alive — you're on a roll."
    }
    val hero = feed?.continueReading?.firstOrNull()
    val heroSide = run {
        val continued = feed?.continueReading.orEmpty().drop(1).take(3)
        if (continued.isNotEmpty()) continued
        else feed?.recentlyPublished.orEmpty().filter { it.id != hero?.id }.take(3)
    }
    val highlighted = highlightId?.let { id ->
        buildList {
            addAll(feed?.continueReading.orEmpty())
            addAll(feed?.recentlyPublished.orEmpty())
            addAll(feed?.myImports.orEmpty())
        }.firstOrNull { it.id == id }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = hPad),
        verticalArrangement = Arrangement.spacedBy(32.dp),
    ) {
        Spacer(Modifier.height(learnerScrollTopInset()))
        if (widthDp >= WebBreakpoints.Lg) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    GreetingBlock(greeting, firstName, streakSubtitle)
                    PayAsYouGoHomeBanner(onClick = onImport)
                }
                StatChips(streak, words, fill = false, modifier = Modifier.padding(start = 16.dp))
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                GreetingBlock(greeting, firstName, streakSubtitle)
                PayAsYouGoHomeBanner(onClick = onImport)
                StatChips(streak, words, fill = true, modifier = Modifier.fillMaxWidth())
            }
        }

        highlighted?.let { item ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("NEW MATERIAL", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = GotchaBlue.B700, letterSpacing = 0.8.sp)
                Text(item.title.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF111827))
                Text("On your library dashboard — open it when you want to read or purchase.", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF9CA3AF))
                Box(Modifier.width(168.dp)) {
                    ContentCard(item = item, highlighted = true, langFlags = langFlags, onOpen = { onOpenReader(item.id) })
                }
            }
        }

        if (hero != null) {
            if (widthDp >= WebBreakpoints.Lg && heroSide.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp), modifier = Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { ContinueReadingCard(hero, onOpenReader) }
                    Row(Modifier.weight(2f), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        heroSide.forEach { item ->
                            Box(Modifier.weight(1f)) {
                                ContentCard(item, langFlags = langFlags, onOpen = { onOpenReader(item.id) })
                            }
                        }
                    }
                }
            } else {
                ContinueReadingCard(hero, onOpenReader)
                if (heroSide.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(heroSide, key = { it.id }) { item ->
                            Box(Modifier.width(136.dp)) {
                                ContentCard(item, langFlags = langFlags, onOpen = { onOpenReader(item.id) })
                            }
                        }
                    }
                }
            }
        }

        Shelf(
            title = "New in the library",
            subtitle = "Admin catalog — A4 covers, not your personal imports",
            items = feed?.recentlyPublished.orEmpty().take(10),
            widthDp = widthDp,
            langFlags = langFlags,
            highlightId = highlightId,
            onSeeAll = { onBrowse(null, null) },
            onOpen = onOpenReader,
        )
        Shelf(
            title = "Your imports",
            subtitle = "Files and URLs you brought in — kept separate from the store",
            items = feed?.myImports.orEmpty().take(10),
            widthDp = widthDp,
            langFlags = langFlags,
            onSeeAll = { onBrowse("Imports", null) },
            onOpen = onOpenReader,
        )
        feed?.featuredCollections.orEmpty().forEach { col ->
            val items = col.items.mapNotNull { it.content }
            if (items.isEmpty()) return@forEach
            Shelf(
                title = col.title ?: "Collection",
                subtitle = col.description,
                items = items,
                widthDp = widthDp,
                langFlags = langFlags,
                onSeeAll = { onBrowse(null, col.browseKey.ifBlank { null }) },
                onOpen = onOpenReader,
            )
        }

        if (uniqueEmpty) {
            EmptyLibrary(onImport)
        }
        if (!uniqueEmpty && feed?.featuredCollections.orEmpty().all { it.items.isEmpty() } &&
            feed?.recentlyPublished.isNullOrEmpty()
        ) {
            SectionHeading("Browse Library", "Explore all available reading content") { onBrowse(null, null) }
        }
        if (error != null && feed == null) {
            Text(error, fontFamily = Inter, color = GotchaColors.Danger, fontSize = 13.sp)
        }
        Spacer(Modifier.height(learnerScrollBottomInset()))
    }
}

@Composable
private fun BrowseBody(
    widthDp: Int,
    hPad: androidx.compose.ui.unit.Dp,
    vPad: androidx.compose.ui.unit.Dp,
    collectionTitle: String?,
    collectionDesc: String?,
    search: String,
    onSearch: (String) -> Unit,
    viewGrid: Boolean,
    onViewGrid: (Boolean) -> Unit,
    filterTabs: List<String>,
    activeFilter: String,
    onFilter: (String) -> Unit,
    filtered: List<ContentItem>,
    emptyLibrary: Boolean,
    gridLoading: Boolean = false,
    langFlags: Map<String, String>,
    highlightId: String?,
    onBack: () -> Unit,
    onOpenReader: (String) -> Unit,
    onImport: () -> Unit,
    ) {
    val cols = when {
        widthDp >= 1280 -> 5
        widthDp >= WebBreakpoints.Lg -> 4
        widthDp >= WebBreakpoints.Sm -> 3
        else -> 2
    }
    val bottomPad = learnerNavBarInset() + 12.dp
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = hPad),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(learnerStatusBarInset() + 8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                Icons.AutoMirrored.Outlined.ArrowBack,
                contentDescription = "Back to Library",
                tint = Color(0xFF6B7280),
                modifier = Modifier
                    .size(36.dp)
                    .clickable { onBack() }
                    .padding(6.dp),
            )
            Text(
                collectionTitle ?: "Browse Library",
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = Color(0xFF111827),
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (widthDp >= WebBreakpoints.Sm) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF3F4F6))
                        .padding(4.dp),
                ) {
                    ViewToggle(Icons.Outlined.GridView, viewGrid) { onViewGrid(true) }
                    ViewToggle(Icons.Outlined.ViewList, !viewGrid) { onViewGrid(false) }
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Search, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(14.dp))
                    BasicTextField(
                        value = search,
                        onValueChange = onSearch,
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontFamily = Inter,
                            fontSize = 14.sp,
                            color = Color(0xFF111827),
                        ),
                        cursorBrush = SolidColor(GotchaColors.WebAccent),
                        modifier = Modifier.fillMaxWidth(),
                        decorationBox = { inner ->
                            Box {
                                if (search.isEmpty()) {
                                    Text("Search…", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF9CA3AF))
                                }
                                inner()
                            }
                        },
                    )
                }
            }
        }
        if (!collectionDesc.isNullOrBlank() && search.isBlank()) {
            Text(collectionDesc, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF9CA3AF))
        }
        if (search.isBlank()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                filterTabs.forEach { tab ->
                    val on = activeFilter == tab
                    Text(
                        tab,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (on) GotchaColors.WebAccent else Color.White)
                            .border(1.dp, if (on) GotchaColors.WebAccent else Color(0xFFE5E7EB), RoundedCornerShape(50))
                            .clickable { onFilter(tab) }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                        color = if (on) Color.White else Color(0xFF4B5563),
                    )
                }
            }
        }
        when {
            gridLoading -> LibraryBrowseSkeleton(
                columns = cols,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                bottomPadding = bottomPad,
            )
            emptyLibrary -> EmptyLibrary(onImport)
            filtered.isEmpty() -> EmptySearch()
            viewGrid -> LazyVerticalGrid(
                columns = GridCells.Fixed(cols),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(bottom = bottomPad),
            ) {
                items(filtered, key = { it.id }) { item ->
                    ContentCard(
                        item = item,
                        highlighted = item.id == highlightId,
                        langFlags = langFlags,
                        onOpen = { onOpenReader(item.id) },
                    )
                }
            }
            else -> Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = bottomPad),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                filtered.forEach { item ->
                    ContentCard(
                        item = item,
                        viewList = true,
                        highlighted = item.id == highlightId,
                        langFlags = langFlags,
                        onOpen = { onOpenReader(item.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ViewToggle(icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (active) Color.White else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (active) Color(0xFF374151) else Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun GreetingBlock(greeting: String, firstName: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(
            "Good $greeting, $firstName 👋",
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            color = Color(0xFF111827),
        )
        Text(subtitle, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF6B7280), modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun StatChips(streak: Int, words: Int, fill: Boolean, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val chipMod = if (fill) Modifier.weight(1f) else Modifier
        StatChip(
            Icons.Outlined.LocalFireDepartment,
            "$streak days",
            "Streak",
            Color(0xFFE17100),
            Color(0xFFFFFBEB),
            Color(0xFFFEE685),
            chipMod,
        )
        StatChip(
            Icons.Outlined.Psychology,
            "$words",
            "Words",
            Color(0xFF155DFC),
            GotchaBlue.LearningBg,
            Color(0xFFBEDBFF),
            chipMod,
        )
    }
}

@Composable
private fun StatChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    tint: Color,
    bg: Color,
    border: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        Column {
            Text(value, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF111827))
            Text(label, fontFamily = Inter, fontSize = 11.sp, color = tint.copy(alpha = 0.70f))
        }
    }
}

@Composable
private fun Shelf(
    title: String,
    subtitle: String?,
    items: List<ContentItem>,
    widthDp: Int,
    langFlags: Map<String, String>,
    highlightId: String? = null,
    onSeeAll: () -> Unit,
    onOpen: (String) -> Unit,
) {
    if (items.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionHeading(title, subtitle, onSeeAll)
        if (widthDp >= WebBreakpoints.Lg) {
            val cols = if (widthDp >= 1280) 5 else 4
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
                items.take(cols).forEach { item ->
                    Box(Modifier.weight(1f)) {
                        ContentCard(item, highlighted = item.id == highlightId, langFlags = langFlags, onOpen = { onOpen(item.id) })
                    }
                }
                repeat((cols - items.size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
            }
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(items, key = { it.id }) { item ->
                    Box(Modifier.width(136.dp)) {
                        ContentCard(item, highlighted = item.id == highlightId, langFlags = langFlags, onOpen = { onOpen(item.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeading(title: String, subtitle: String?, onSeeAll: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) {
            Text(title, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF111827))
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, fontFamily = Inter, fontSize = 13.sp, color = Color(0xFF9CA3AF), modifier = Modifier.padding(top = 2.dp))
            }
        }
        if (onSeeAll != null) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onSeeAll() }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("See all", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.WebAccent)
                Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = GotchaColors.WebAccent, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun ContinueReadingCard(item: ContentItem, onOpen: (String) -> Unit) {
    val cover = resolveMediaUrl(item.coverImageUrl)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(176.dp)
            .clip(RoundedCornerShape(16.dp))
            .then(
                if (cover.isNullOrBlank()) Modifier.background(coverBrushForId(item.id))
                else Modifier.background(Color.Black),
            )
            .clickable { onOpen(item.id) },
    ) {
        if (!cover.isNullOrBlank()) {
            AsyncImage(cover, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.70f)))),
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(20.dp)
                .fillMaxWidth(),
        ) {
            Text("CONTINUE READING", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Color.White.copy(alpha = 0.70f), letterSpacing = 0.8.sp)
            Text(item.title.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val sub = itemSubtitle(item)
            if (sub.isNotBlank()) {
                Text(sub, fontFamily = Inter, fontSize = 14.sp, color = Color.White.copy(alpha = 0.60f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val pct = (item.progressPct ?: 0.0).roundToInt()
                Text(
                    if (item.needsCatalogPayment()) formatUzs(item.catalogPriceUzs()) else "$pct%",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Color.White,
                )
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Resume", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Color(0xFF111827))
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, modifier = Modifier.size(12.dp).padding(start = 4.dp), tint = Color(0xFF111827))
                }
            }
            Box(
                Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color.White.copy(alpha = 0.20f)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth((item.progressPct ?: 0.0).toFloat().coerceIn(0f, 100f) / 100f)
                        .height(4.dp)
                        .background(Color.White, RoundedCornerShape(50)),
                )
            }
        }
    }
}

@Composable
private fun ContentCard(
    item: ContentItem,
    viewList: Boolean = false,
    highlighted: Boolean = false,
    langFlags: Map<String, String> = emptyMap(),
    onOpen: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val highlightMod = if (highlighted) Modifier.border(2.dp, GotchaBlue.B700, shape) else Modifier
    if (viewList) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(highlightMod)
                .clip(shape)
                .background(Color.White)
                .border(1.dp, Color(0xFFF3F4F6), shape)
                .clickable { onOpen() }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            CoverArt(item, Modifier.width(52.dp).aspectRatio(3f / 4f).clip(RoundedCornerShape(8.dp)))
            Column(Modifier.weight(1f)) {
                Text(item.title.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF111827), maxLines = 1, overflow = TextOverflow.Ellipsis)
                val sub = itemSubtitle(item)
                if (sub.isNotBlank()) {
                    Text(sub, fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF9CA3AF), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            CefrBadge(item.cefrLevel.orEmpty())
            Text(langFlags[item.language?.lowercase()] ?: "🌐", fontSize = 14.sp)
            Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = Color(0xFFD1D5DB), modifier = Modifier.size(16.dp))
        }
        return
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(highlightMod)
            .clip(shape)
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), shape)
            .clickable { onOpen() },
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f)) {
            CoverArt(item, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.40f)))))
            Row(
                modifier = Modifier.align(Alignment.BottomStart).padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                CefrBadge(item.cefrLevel.orEmpty())
                Text(
                    (item.contentType ?: "").replace('_', ' '),
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color.White.copy(alpha = 0.20f))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    fontFamily = Inter,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    color = Color.White,
                    maxLines = 1,
                )
            }
            Row(
                modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (item.needsCatalogPayment()) {
                    Text(
                        formatUzs(item.catalogPriceUzs()),
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.90f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 10.sp,
                        color = GotchaBlue.B700,
                    )
                }
                Text(langFlags[item.language?.lowercase()] ?: "🌐", fontSize = 16.sp)
            }
        }
        Column(Modifier.padding(12.dp)) {
            Text(item.title.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF111827), maxLines = 2, overflow = TextOverflow.Ellipsis)
            val sub = itemSubtitle(item)
            if (sub.isNotBlank()) {
                Text(sub, fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF9CA3AF), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
            }
            Row(
                Modifier.fillMaxWidth().padding(top = 12.dp).border(width = 0.dp, color = Color.Transparent),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.Book, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(12.dp))
                    Text(formatWordCount(item.wordCount ?: 0), fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF9CA3AF))
                }
                val pct = item.progressPct ?: 0.0
                Text(
                    when {
                        item.needsCatalogPayment() -> "Try sample"
                        pct > 0 -> "${pct.roundToInt()}%"
                        (item.knownWordRatio ?: 0.0) > 0 -> "${((item.knownWordRatio ?: 0.0) * 100).roundToInt()}% known"
                        else -> "New"
                    },
                    fontFamily = Inter,
                    fontWeight = if (pct > 0) FontWeight.SemiBold else FontWeight.Medium,
                    fontSize = 12.sp,
                    color = if (pct > 0) GotchaColors.WebAccent else GotchaBlue.B500.copy(alpha = 0.70f),
                )
            }
            if ((item.progressPct ?: 0.0) > 0) {
                Box(
                    Modifier
                        .padding(top = 6.dp)
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0xFFF3F4F6)),
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth((item.progressPct ?: 0.0).toFloat().coerceIn(0f, 100f) / 100f)
                            .height(4.dp)
                            .background(GotchaBlue.B500, RoundedCornerShape(50)),
                    )
                }
            }
        }
    }
}

@Composable
private fun CoverArt(item: ContentItem, modifier: Modifier) {
    val src = resolveMediaUrl(item.coverImageUrl)
    Box(modifier.background(coverBrushForId(item.id)), contentAlignment = Alignment.Center) {
        if (!src.isNullOrBlank()) {
            AsyncImage(src, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Icon(Icons.Outlined.Book, contentDescription = null, tint = Color.White.copy(alpha = 0.60f), modifier = Modifier.size(40.dp))
        }
    }
}

@Composable
private fun CefrBadge(level: String) {
    if (level.isBlank()) return
    val (bg, fg) = cefrColors(level)
    Text(
        level.uppercase(),
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        color = fg,
    )
}

@Composable
private fun EmptyLibrary(onImport: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Outlined.Book, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(40.dp))
        Text("Your library is empty", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF111827))
        Text("Import your own text or explore featured collections once content is available.", fontFamily = Inter, fontSize = 13.sp, color = Color(0xFF9CA3AF))
        Text(
            "Import content",
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = Color.White,
            modifier = Modifier
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(GotchaColors.WebAccent)
                .clickable { onImport() }
                .padding(horizontal = 16.dp, vertical = 10.dp),
        )
        Row(
            modifier = Modifier.clickable { onImport() }.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Outlined.Upload, contentDescription = null, tint = GotchaColors.WebAccent, modifier = Modifier.size(16.dp))
            Text("Or import your first article", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = GotchaColors.WebAccent)
        }
    }
}

@Composable
private fun EmptySearch() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Outlined.Search, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(32.dp))
        Text("No content found", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF111827), modifier = Modifier.padding(top = 8.dp))
        Text("Try a different search or filter to find something to read.", fontFamily = Inter, fontSize = 13.sp, color = Color(0xFF9CA3AF))
    }
}

private fun matchesSearch(item: ContentItem, query: String): Boolean {
    if (query.isBlank()) return true
    val hay = "${item.title} ${item.subtitle.orEmpty()} ${item.authorName.orEmpty()}".lowercase()
    return hay.contains(query.trim().lowercase())
}

private fun matchesFilter(item: ContentItem, activeFilter: String, languageTabs: List<String>): Boolean {
    if (activeFilter == "Imports") return isUserImport(item)
    if (isUserImport(item)) return false
    if (activeFilter == "All") return true
    val langTab = languageTabs.firstOrNull { it.equals(activeFilter, true) }
    if (langTab != null) return (item.language ?: "").equals(langTab, true)
    if (activeFilter.matches(Regex("^[a-zA-Z]{2}$"))) {
        return (item.language ?: "").equals(activeFilter, true)
    }
    if (activeFilter == "Fiction") {
        val g = (item.genre ?: "").lowercase()
        return g == "fiction" || g == "folk tales" || g == "culture" || g == "classic" ||
            item.contentType == "story" || item.contentType == "book"
    }
    if (activeFilter == "News") return item.contentType == "news" || item.contentType == "article"
    if (activeFilter == "A1–A2") return item.cefrLevel.equals("a1", true) || item.cefrLevel.equals("a2", true)
    if (activeFilter == "B1–B2") return item.cefrLevel.equals("b1", true) || item.cefrLevel.equals("b2", true)
    if (activeFilter == "C1–C2") return item.cefrLevel.equals("c1", true) || item.cefrLevel.equals("c2", true)
    return false
}
