package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.GlassLoadingScreen
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.GotchaMultilineTextField
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.LevelChip
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Inter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private const val MIN_PASTE_WORDS = 50
private const val MAX_PASTE_CHARS = 5_000_000

private fun pasteWordCount(text: String): Int =
    if (text.isBlank()) 0 else text.trim().split(Regex("\\s+")).count { it.isNotBlank() }

@Composable
fun LearnerSubpage(
    title: String,
    onBack: () -> Unit,
    body: @Composable () -> Unit,
) {
    GotchaSystemBars(darkIcons = true)
    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.WebCanvas)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(top = 12.dp, bottom = 12.dp)
                .height(44.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Back",
                    tint = GotchaColors.Ink,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                title,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = GotchaColors.Ink,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        body()
    }
}

@Composable
fun WebDirectoryFormPanel(
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

@Composable
private fun TopicResultRow(item: ContentItem, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CoverThumb(item.coverImageUrl, Modifier.size(width = 56.dp, height = 78.dp), corner = 8)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                item.title ?: "Untitled",
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                item.authorName ?: item.genre ?: "",
                fontFamily = Inter,
                color = GotchaColors.TextMuted,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LangChip(item.language ?: "?", softPurple = true)
                if (!item.cefrLevel.isNullOrBlank()) LevelChip(item.cefrLevel)
            }
        }
    }
}

/** Content detail — Library → detail → reader. Honest fields only (no Figma seed content). */
@Composable
fun ContentDetailScreen(
    contentId: String,
    onBack: () -> Unit,
    onRead: (String) -> Unit,
    onOpenContent: (String) -> Unit = {},
) {
    val container = LocalAppContainer.current
    val seededItem = remember(contentId) { container.contentRepository.contentMemory(contentId) }
    var item by remember(contentId) { mutableStateOf(seededItem) }
    var similar by remember(contentId) { mutableStateOf<List<ContentItem>>(emptyList()) }
    var loadProgress by remember(contentId) { mutableIntStateOf(if (seededItem != null) 100 else 0) }
    var isFetching by remember(contentId) { mutableStateOf(false) }
    var awaitingPeek by remember(contentId) { mutableStateOf(seededItem == null) }
    LaunchedEffect(contentId) {
        val targetId = contentId
        if (item == null) awaitingPeek = true
        isFetching = false
        if (item == null) loadProgress = 0

        container.contentRepository.getPeek(targetId)?.let { peek ->
            item = peek.data
            loadProgress = 60
        }
        awaitingPeek = false

        val hasCachedItem = item != null
        if (hasCachedItem) {
            loadProgress = 100
            try {
                val fresh = container.contentRepository.getFetch(targetId).data
                if (targetId == contentId) item = fresh
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Keep cached detail on refresh failure.
            }
        } else {
            isFetching = true
            loadProgress = 10
            try {
                val fetched = container.contentRepository.getFetch(targetId).data
                if (targetId != contentId) return@LaunchedEffect
                item = fetched
                loadProgress = 60
                loadProgress = 100
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Empty state below when item stays null.
            } finally {
                if (targetId == contentId) isFetching = false
            }
        }

        if (targetId != contentId) return@LaunchedEffect
        runCatching { container.contentRepository.prefetchReader(targetId) }
        similar = runCatching {
            val type = item?.contentType?.takeIf { it.equals("book", ignoreCase = true) } ?: "book"
            container.contentRepository.list(type = type, q = null).items
                .filter { it.id != contentId }
                .take(6)
                .ifEmpty {
                    container.contentRepository.list(q = null).items
                        .filter { it.id != contentId }
                        .take(6)
                }
        }.getOrDefault(emptyList())
        if (similar.isNotEmpty()) {
            runCatching { container.contentRepository.prefetchReaders(similar.map { it.id }, limit = 4) }
        }
    }
    val navBottom = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    val bottomPad = navBottom + 40.dp + 16.dp

    val title = item?.title?.takeIf { it.isNotBlank() } ?: "Untitled"
    val author = item?.authorName?.takeIf { it.isNotBlank() }
    val lang = item?.language?.takeIf { it.isNotBlank() }?.uppercase()
    val levelLabel = item?.cefrLevel?.takeIf { it.isNotBlank() }?.uppercase()
    val description = item?.description?.takeIf { it.isNotBlank() }
    val progressPct = (item?.progressPct ?: 0.0).coerceIn(0.0, 100.0)
    val progress = (progressPct / 100.0).toFloat()
    val segmentCount = item?.segmentCount?.takeIf { it > 0 }
    val wordCount = item?.wordCount?.takeIf { it > 0 }
    val chaptersLabel = segmentCount?.let { n ->
        if (n == 1) "1 Segment" else "$n Segments"
    }
    val readTime = wordCount?.let { words ->
        val mins = (words / 200).coerceAtLeast(1)
        "~$mins min read"
    }
    val progressLabel = when {
        progressPct <= 0.0 -> "Not started"
        segmentCount != null -> {
            val chapterOf = kotlin.math.ceil(progress * segmentCount).toInt().coerceIn(1, segmentCount)
            "Segment $chapterOf of $segmentCount (${progressPct.toInt()}% completed)"
        }
        else -> "${progressPct.toInt()}% completed"
    }
    val cta = if (progressPct > 0.0) "Continue Reading" else "Start Reading"

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Icon(
                Icons.Outlined.ChevronLeft,
                contentDescription = "Back",
                tint = GotchaColors.Ink,
                modifier = Modifier
                    .size(20.dp)
                    .clickable(onClick = onBack),
            )
            Text(
                "Book Details",
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = GotchaColors.Ink,
            )
            // Balance toolbar; Share deferred until a real share API exists.
            Spacer(Modifier.size(20.dp))
        }

        if (item == null && (awaitingPeek || isFetching)) {
            GlassLoadingScreen(
                progress = loadProgress.coerceAtLeast(10),
                title = "Loading book details…",
                subtitle = if (loadProgress < 60) "Fetching metadata" else "Preparing your library",
                modifier = Modifier.fillMaxSize(),
            )
        } else if (item == null) {
            OfflineEmptyState(
                subtitle = "Connect to the internet to load this book, or open it once while online to save it for offline reading.",
            )
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = bottomPad),
            ) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .width(100.dp)
                                .height(140.dp)
                                .shadow(4.dp, RoundedCornerShape(12.dp), spotColor = Color(0x14000000))
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (!item?.coverImageUrl.isNullOrBlank()) {
                                CoverThumb(item!!.coverImageUrl, Modifier.fillMaxSize(), corner = 12)
                            } else {
                                Box(
                                    Modifier.fillMaxSize().background(GotchaColors.BrandPurple),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        "G",
                                        color = Color.White.copy(0.5f),
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = Inter,
                                        fontSize = 28.sp,
                                    )
                                }
                            }
                        }
                        Column(
                            Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            if (lang != null || levelLabel != null) {
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    if (lang != null) {
                                        Box(
                                            Modifier
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(GotchaColors.BrandPurpleSoft)
                                                .padding(horizontal = 6.dp, vertical = 2.dp),
                                        ) {
                                            Text(lang, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = GotchaColors.BrandPurple)
                                        }
                                    }
                                    if (levelLabel != null) {
                                        Box(
                                            Modifier
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(GotchaColors.WarningBg)
                                                .padding(horizontal = 6.dp, vertical = 2.dp),
                                        ) {
                                            Text(levelLabel, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = GotchaColors.WarningText)
                                        }
                                    }
                                }
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(title, fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = GotchaColors.Ink)
                                if (author != null) {
                                    Text(author, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextMuted)
                                }
                            }
                            if (chaptersLabel != null || readTime != null) {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (chaptersLabel != null) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                painterResource(R.drawable.ic_book_open),
                                                null,
                                                tint = GotchaColors.TextMuted,
                                                modifier = Modifier.size(14.dp),
                                            )
                                            Text(chaptersLabel, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted)
                                        }
                                    }
                                    if (readTime != null) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                painterResource(R.drawable.ic_activity_clock),
                                                null,
                                                tint = GotchaColors.TextMuted,
                                                modifier = Modifier.size(14.dp),
                                            )
                                            Text(readTime, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (description != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Description", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.Ink)
                            Text(
                                description,
                                fontFamily = Inter,
                                fontSize = 13.sp,
                                color = GotchaColors.TextMuted,
                                lineHeight = 20.sp,
                            )
                        }
                    }

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Current Progress", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                            Text(
                                progressLabel,
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.TextMuted,
                            )
                        }
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(GotchaColors.Border),
                        ) {
                            if (progress > 0f) {
                                Box(
                                    Modifier
                                        .fillMaxWidth(progress)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(GotchaColors.BrandPurple),
                                )
                            }
                        }
                    }

                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(GotchaColors.BrandPurple)
                            .clickable { onRead(contentId) }
                            .padding(vertical = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(cta, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.White)
                    }
                }

                if (similar.isNotEmpty()) {
                    Column(
                        Modifier.fillMaxWidth().padding(bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            "Similar Books",
                            fontFamily = Inter,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                            modifier = Modifier.padding(horizontal = 24.dp),
                        )
                        Row(
                            Modifier
                                .horizontalScroll(rememberScrollState())
                                .padding(start = 24.dp, end = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            similar.take(6).forEach { s ->
                                SimilarBookCard(
                                    title = s.title ?: "Untitled",
                                    author = s.authorName ?: "",
                                    lang = s.language?.uppercase() ?: "",
                                    level = s.cefrLevel?.take(2)?.uppercase() ?: "",
                                    coverUrl = s.coverImageUrl,
                                    onClick = { onOpenContent(s.id) },
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
private fun SimilarBookCard(
    title: String,
    author: String,
    lang: String,
    level: String,
    coverUrl: String?,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .width(180.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .width(40.dp)
                .height(55.dp)
                .clip(RoundedCornerShape(6.dp))
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(6.dp)),
        ) {
            if (!coverUrl.isNullOrBlank()) {
                CoverThumb(coverUrl, Modifier.fillMaxSize(), corner = 6)
            } else {
                Box(Modifier.fillMaxSize().background(GotchaColors.BrandPurpleSoft))
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = GotchaColors.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (author.isNotBlank()) {
                Text(author, fontFamily = Inter, fontSize = 10.sp, color = GotchaColors.TextSubtle, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (lang.isNotBlank() || level.isNotBlank()) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (lang.isNotBlank()) {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(3.dp))
                                .background(GotchaColors.BrandPurpleSoft)
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        ) {
                            Text(lang, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 8.sp, color = GotchaColors.BrandPurple)
                        }
                    }
                    if (level.isNotBlank()) {
                        Text(level, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 9.sp, color = GotchaColors.WarningText)
                    }
                }
            }
        }
    }
}

// Words directory screens live in VocabularyDirectoryScreens.kt (Figma 30:202 / 34:192 / 34:284 / 36:9).

@Composable
fun LibraryCategoryScreen(category: String, onBack: () -> Unit, onOpenReader: (String) -> Unit) {
    val container = LocalAppContainer.current
    var results by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    LaunchedEffect(category) {
        val type = when (category.lowercase()) {
            "books" -> "book"
            "articles" -> "article"
            "news" -> "news"
            else -> null
        }
        results = runCatching { container.contentRepository.list(type = type).items }.getOrDefault(emptyList())
    }
    LearnerSubpage(
        title = category.replaceFirstChar(Char::titlecase),
        onBack = onBack,
        body = {
            LazyColumn(contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    Text("${results.size} items found", fontFamily = Inter, color = GotchaColors.TextMuted, fontSize = 13.sp, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(results, key = { it.id }) { item ->
                    TopicResultRow(item) { onOpenReader(item.id) }
                }
            }
        },
    )
}

@Composable
fun TopicResultsScreen(topic: String, onBack: () -> Unit, onOpenReader: (String) -> Unit) {
    val container = LocalAppContainer.current
    var results by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    LaunchedEffect(topic) {
        results = runCatching { container.contentRepository.list(q = topic).items }.getOrDefault(emptyList())
    }
    LearnerSubpage(
        title = topic,
        onBack = onBack,
        body = {
            LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("${results.size} items found", fontFamily = Inter, color = GotchaColors.TextMuted, fontSize = 13.sp)
                }
                items(results, key = { it.id }) { item ->
                    TopicResultRow(item) { onOpenReader(item.id) }
                }
            }
        },
    )
}
@Composable
fun BookmarksScreen(onBack: () -> Unit) {
    LearnerSubpage(
        title = "Bookmarks",
        onBack = onBack,
        body = {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    "Bookmarks you save in the reader will appear here.",
                    fontFamily = Inter,
                    color = GotchaColors.TextMuted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(24.dp),
                )
            }
        },
    )
}

@Composable
fun ReadingSettingsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var fontScale by remember { mutableStateOf(1.0f) }
    var theme by remember { mutableStateOf("light") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = true
        error = null
        var hadCache = false
        container.userRepository.mePeek()?.data?.preferences?.let { prefs ->
            fontScale = (prefs.readerFontScale ?: 1.0).toFloat()
            theme = prefs.readerTheme?.lowercase() ?: "light"
            hadCache = true
            loading = false
        }
        try {
            val prefs = container.userRepository.meFetch().data.preferences
            fontScale = (prefs?.readerFontScale ?: 1.0).toFloat()
            theme = prefs?.readerTheme?.lowercase() ?: "light"
        } catch (e: Exception) {
            if (!hadCache) {
                error = e.apiErrorMessage("Failed to load settings")
            }
        } finally {
            loading = false
        }
    }

    LearnerSubpage(
        title = "Reading settings",
        onBack = onBack,
        body = {
            when {
                loading -> LoadingBox(Modifier.fillMaxSize())
                error != null -> OfflineEmptyState(
                    subtitle = "Connect to the internet to load reading settings.",
                    onRetry = { reloadKey += 1 },
                    compact = true,
                )
                else -> Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Text size", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0.9f to "S", 1.0f to "M", 1.2f to "L", 1.4f to "XL").forEach { (scale, label) ->
                            val on = kotlin.math.abs(fontScale - scale) < 0.05f
                            Text(
                                text = label,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (on) GotchaColors.BrandPurple else Color.White)
                                    .border(1.dp, if (on) GotchaColors.BrandPurple else GotchaColors.Border, RoundedCornerShape(10.dp))
                                    .clickable {
                                        fontScale = scale
                                        scope.launch {
                                            runCatching {
                                                container.userRepository.updatePreferences(readerFontScale = scale.toDouble())
                                            }
                                        }
                                    }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                color = if (on) Color.White else GotchaColors.Ink,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    Text("Theme", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("light", "sepia", "dark").forEach { t ->
                            val on = theme == t
                            Text(
                                text = t.replaceFirstChar(Char::titlecase),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (on) GotchaColors.BrandPurple else Color.White)
                                    .border(1.dp, if (on) GotchaColors.BrandPurple else GotchaColors.Border, RoundedCornerShape(10.dp))
                                    .clickable {
                                        theme = t
                                        scope.launch {
                                            runCatching {
                                                container.userRepository.updatePreferences(readerTheme = t)
                                            }
                                        }
                                    }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                color = if (on) Color.White else GotchaColors.Ink,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        },
    )
}


@Composable
fun LevelTestScreen(onBack: () -> Unit) {
    LearnerSubpage(
        title = "Level test",
        onBack = onBack,
        body = {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Quick CEFR placement", fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
                Text("Answer a short set of questions to refresh your level estimate.", fontFamily = Inter, color = GotchaColors.TextMuted, fontSize = 14.sp)
                GotchaPrimaryButton(text = "Start test", onClick = onBack)
            }
        },
    )
}

@Composable
fun ImportUrlForm(onImported: () -> Unit, embedded: Boolean = false) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var paymentStep by remember { mutableStateOf<String?>(null) }
    var pendingQuote by remember { mutableStateOf<app.gotcha.android.data.model.ImportQuoteResponse?>(null) }
    var paymentId by remember { mutableStateOf<String?>(null) }
    var amountLabel by remember { mutableStateOf<String?>(null) }
    var cardNumber by remember { mutableStateOf("") }
    var cardExpiry by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var maskedPhone by remember { mutableStateOf<String?>(null) }

    fun resetPayment() {
        paymentStep = null
        pendingQuote = null
        paymentId = null
        amountLabel = null
        cardNumber = ""
        cardExpiry = ""
        otpCode = ""
        maskedPhone = null
    }

    suspend fun finishImport(withPaymentId: String?) {
        container.importRepository.url(url.trim(), title.ifBlank { null }, null, withPaymentId)
        onImported()
    }

    val formContent: @Composable () -> Unit = {
        if (paymentStep == null) {
            GotchaTextField(label = "Article URL", value = url, onValueChange = { url = it }, placeholder = "https://…")
            GotchaTextField(label = "Title (optional)", value = title, onValueChange = { title = it })
            if (error != null) Text(error!!, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
            GotchaPrimaryButton(
                text = if (loading) "Importing…" else "Import from URL",
                onClick = {
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            container.importRepository.importLimitMessage()?.let {
                                error = it
                                return@launch
                            }
                            val quote = container.importRepository.quote(
                                importType = "url",
                                contentFormat = "article",
                                textLength = 6000,
                            )
                            if (quote.gatewayEnabled && quote.requiresPayment) {
                                pendingQuote = quote
                                amountLabel = formatSom(quote.amountUzs)
                                paymentStep = "price"
                                return@launch
                            }
                            var payId: String? = null
                            if (quote.gatewayEnabled) {
                                payId = container.importRepository.checkout(
                                    importType = "url",
                                    contentFormat = "article",
                                    textLength = 6000,
                                ).paymentId
                            }
                            finishImport(payId)
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Import failed")
                        } finally {
                            loading = false
                        }
                    }
                },
                loading = loading,
                enabled = url.isNotBlank(),
            )
        } else if (paymentStep == "price" && pendingQuote != null) {
            ImportQuoteStepUi(
                quote = pendingQuote!!,
                displayTitle = title.ifBlank { url.trim() }.ifBlank { "Your Import" },
                typeLabel = "URL",
                loading = loading,
                error = error,
                onProceed = {
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            val quote = pendingQuote!!
                            val checkout = container.importRepository.checkout(
                                importType = "url",
                                contentFormat = "article",
                                pageCount = quote.estimatedPages,
                            )
                            if (checkout.isFree || checkout.step == "done") {
                                resetPayment()
                                finishImport(checkout.paymentId)
                            } else {
                                paymentId = checkout.paymentId
                                paymentStep = "card"
                            }
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Failed to start payment")
                        } finally {
                            loading = false
                        }
                    }
                },
                onCancel = {
                    resetPayment()
                    error = null
                },
            )
        } else {
            ImportPaymentStepUi(
                step = paymentStep!!,
                amountLabel = amountLabel,
                cardNumber = cardNumber,
                onCardNumberChange = { cardNumber = it },
                cardExpiry = cardExpiry,
                onCardExpiryChange = { cardExpiry = it },
                otpCode = otpCode,
                onOtpChange = { otpCode = it },
                maskedPhone = maskedPhone,
                loading = loading,
                error = error,
                onSubmitCard = {
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            val result = container.importRepository.preApply(
                                paymentId!!,
                                cardNumber.replace(" ", ""),
                                cardExpiry.replace("/", ""),
                            )
                            maskedPhone = result.maskedPhone
                            otpCode = ""
                            paymentStep = "otp"
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Card verification failed")
                        } finally {
                            loading = false
                        }
                    }
                },
                onConfirmOtp = {
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            val result = container.importRepository.apply(paymentId!!, otpCode)
                            when {
                                result.step == "paid" || result.status == "paid" -> {
                                    val confirmedId = paymentId
                                    resetPayment()
                                    finishImport(confirmedId)
                                }
                                result.step == "otp" -> {
                                    otpCode = ""
                                    error = "Check the SMS code and try again."
                                }
                                else -> {
                                    error = "Payment failed. Please try again with a different card."
                                    paymentStep = "card"
                                    cardNumber = ""
                                    cardExpiry = ""
                                }
                            }
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("OTP verification failed")
                        } finally {
                            loading = false
                        }
                    }
                },
                onResendOtp = {
                    scope.launch {
                        try {
                            container.importRepository.retryOtp(paymentId!!)
                            error = null
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Could not resend OTP")
                        }
                    }
                },
                onCancel = {
                    if (paymentStep == "otp") {
                        paymentStep = "card"
                        otpCode = ""
                        error = null
                    } else {
                        scope.launch { paymentId?.let { runCatching { container.importRepository.cancel(it) } } }
                        resetPayment()
                        error = null
                    }
                },
            )
        }
    }

    if (embedded) {
        formContent()
    } else {
        WebDirectoryFormPanel { formContent() }
    }
}

@Composable
fun ImportUrlScreen(onBack: () -> Unit, onImported: () -> Unit) {
    LearnerSubpage(
        title = "Import from URL",
        onBack = onBack,
        body = {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                ImportUrlForm(onImported = onImported)
            }
        },
    )
}

@Composable
fun ImportPasteForm(onImported: () -> Unit, embedded: Boolean = false) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var paymentStep by remember { mutableStateOf<String?>(null) }
    var pendingQuote by remember { mutableStateOf<app.gotcha.android.data.model.ImportQuoteResponse?>(null) }
    var paymentId by remember { mutableStateOf<String?>(null) }
    var amountLabel by remember { mutableStateOf<String?>(null) }
    var cardNumber by remember { mutableStateOf("") }
    var cardExpiry by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var maskedPhone by remember { mutableStateOf<String?>(null) }

    fun resetPayment() {
        paymentStep = null
        pendingQuote = null
        paymentId = null
        amountLabel = null
        cardNumber = ""
        cardExpiry = ""
        otpCode = ""
        maskedPhone = null
    }

    suspend fun finishImport(withPaymentId: String?) {
        container.importRepository.paste(title.ifBlank { "Pasted text" }, text, null, withPaymentId)
        onImported()
    }

    val words = pasteWordCount(text)
    val tooLong = text.length > MAX_PASTE_CHARS
    val valid = words >= MIN_PASTE_WORDS && title.isNotBlank() && !tooLong

    val formContent: @Composable () -> Unit = {
        if (paymentStep == null) {
                    GotchaTextField(label = "Title", value = title, onValueChange = { title = it }, placeholder = "My article")
                    GotchaMultilineTextField(
                        label = "Text",
                        value = text,
                        onValueChange = { text = it },
                        placeholder = "Paste your text here… (minimum $MIN_PASTE_WORDS words; long texts are split into reader pages)",
                        minHeight = 200.dp,
                        labelTrailing = {
                            Text(
                                text = "$words words",
                                fontFamily = Inter,
                                fontWeight = if (words >= MIN_PASTE_WORDS && !tooLong) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 12.sp,
                                color = if (words >= MIN_PASTE_WORDS && !tooLong) Color(0xFF059669) else GotchaColors.TextPlaceholder,
                            )
                        },
                    )
                    if (words > 0 && words < MIN_PASTE_WORDS) {
                        Text(
                            "${MIN_PASTE_WORDS - words} more words needed",
                            color = Color(0xFFD97706),
                            fontFamily = Inter,
                            fontSize = 12.sp,
                        )
                    }
                    if (tooLong) {
                        Text(
                            "Text exceeds the ${"%,d".format(MAX_PASTE_CHARS)}-character maximum. Split into multiple imports.",
                            color = GotchaColors.Danger,
                            fontFamily = Inter,
                            fontSize = 12.sp,
                        )
                    }
                    if (error != null) Text(error!!, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
                    GotchaPrimaryButton(
                        text = if (loading) "Importing…" else "Import Text",
                        onClick = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    container.importRepository.importLimitMessage()?.let {
                                        error = it
                                        return@launch
                                    }
                                    val quote = container.importRepository.quote(
                                        importType = "paste",
                                        contentFormat = "article",
                                        textLength = text.length,
                                        wordCount = words,
                                    )
                                    if (quote.gatewayEnabled && quote.requiresPayment) {
                                        pendingQuote = quote
                                        amountLabel = formatSom(quote.amountUzs)
                                        paymentStep = "price"
                                        return@launch
                                    }
                                    var payId: String? = null
                                    if (quote.gatewayEnabled) {
                                        payId = container.importRepository.checkout(
                                            importType = "paste",
                                            contentFormat = "article",
                                            textLength = text.length,
                                            wordCount = words,
                                        ).paymentId
                                    }
                                    finishImport(payId)
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Import failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        loading = loading,
                        enabled = valid,
                    )
                } else if (paymentStep == "price" && pendingQuote != null) {
                    ImportQuoteStepUi(
                        quote = pendingQuote!!,
                        displayTitle = title.ifBlank { "Your Import" },
                        typeLabel = "Text",
                        loading = loading,
                        error = error,
                        onProceed = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val quote = pendingQuote!!
                                    val checkout = container.importRepository.checkout(
                                        importType = "paste",
                                        contentFormat = "article",
                                        pageCount = quote.estimatedPages,
                                    )
                                    if (checkout.isFree || checkout.step == "done") {
                                        resetPayment()
                                        finishImport(checkout.paymentId)
                                    } else {
                                        paymentId = checkout.paymentId
                                        paymentStep = "card"
                                    }
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Failed to start payment")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        onCancel = {
                            resetPayment()
                            error = null
                        },
                    )
                } else {
                    ImportPaymentStepUi(
                        step = paymentStep!!,
                        amountLabel = amountLabel,
                        cardNumber = cardNumber,
                        onCardNumberChange = { cardNumber = it },
                        cardExpiry = cardExpiry,
                        onCardExpiryChange = { cardExpiry = it },
                        otpCode = otpCode,
                        onOtpChange = { otpCode = it },
                        maskedPhone = maskedPhone,
                        loading = loading,
                        error = error,
                        onSubmitCard = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val result = container.importRepository.preApply(
                                        paymentId!!,
                                        cardNumber.replace(" ", ""),
                                        cardExpiry.replace("/", ""),
                                    )
                                    maskedPhone = result.maskedPhone
                                    otpCode = ""
                                    paymentStep = "otp"
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Card verification failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        onConfirmOtp = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val result = container.importRepository.apply(paymentId!!, otpCode)
                                    when {
                                        result.step == "paid" || result.status == "paid" -> {
                                            val confirmedId = paymentId
                                            resetPayment()
                                            finishImport(confirmedId)
                                        }
                                        result.step == "otp" -> {
                                            otpCode = ""
                                            error = "Check the SMS code and try again."
                                        }
                                        else -> {
                                            error = "Payment failed. Please try again with a different card."
                                            paymentStep = "card"
                                            cardNumber = ""
                                            cardExpiry = ""
                                        }
                                    }
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("OTP verification failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        onResendOtp = {
                            scope.launch {
                                try {
                                    container.importRepository.retryOtp(paymentId!!)
                                    error = null
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Could not resend OTP")
                                }
                            }
                        },
                        onCancel = {
                            if (paymentStep == "otp") {
                                paymentStep = "card"
                                otpCode = ""
                                error = null
                            } else {
                                scope.launch { paymentId?.let { runCatching { container.importRepository.cancel(it) } } }
                                resetPayment()
                                error = null
                            }
                        },
                    )
                }
    }

    if (embedded) {
        formContent()
    } else {
        WebDirectoryFormPanel { formContent() }
    }
}

@Composable
fun PasteTextScreen(onBack: () -> Unit, onImported: () -> Unit) {
    LearnerSubpage(
        title = "Paste text",
        onBack = onBack,
        body = {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                ImportPasteForm(onImported = onImported)
            }
        },
    )
}
