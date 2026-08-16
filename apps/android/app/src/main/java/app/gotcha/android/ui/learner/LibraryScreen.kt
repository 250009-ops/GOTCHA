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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.FilterChip
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.LevelChip
import app.gotcha.android.ui.components.LibraryGridSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage

/** Library tab — Figma library-screen 21:212. Full-bleed under glass nav. */
@Composable
fun LibraryScreen(
    onOpenReader: (String) -> Unit,
    onImport: () -> Unit,
) {
    val container = LocalAppContainer.current
    val bottomInset = LocalLearnerBottomInset.current
    val topInset = LocalLearnerTopInset.current
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("All") }
    var reloadKey by remember { mutableStateOf(0) }
    var items by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(query, filter, reloadKey) {
        loading = items.isEmpty()
        error = null
        if (items.isEmpty()) {
            val type = when (filter) {
                "Books" -> "book"
                "Articles" -> "article"
                "News" -> "news"
                else -> null
            }
            container.contentRepository.listPeek(
                q = query.ifBlank { null },
                type = type,
            )?.let { peek ->
                items = peek.data.items
                loading = false
            }
        }
        try {
            val type = when (filter) {
                "Books" -> "book"
                "Articles" -> "article"
                "News" -> "news"
                else -> null
            }
            val result = container.contentRepository.listFetch(
                q = query.ifBlank { null },
                type = type,
            )
            items = result.data.items
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) {
                error = e.apiErrorMessage("Failed to load library")
            }
        } finally {
            loading = false
        }
    }

    LaunchedEffect(items) {
        if (items.isNotEmpty()) {
            runCatching { container.contentRepository.prefetchReaders(items.map { it.id }) }
        }
    }

    // FAB ~16dp above floating software pill (Figma 29:2 above 21:277).
    val fabBottom = max(bottomInset + 12.dp, 88.dp)
    val gridBottom = bottomInset + 72.dp

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = topInset + 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Library",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 28.sp,
                    color = GotchaColors.Ink,
                )
                // Product search: inline filter of `/content` (Discover route retired).
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_search),
                        contentDescription = null,
                        tint = GotchaColors.TextSubtle,
                        modifier = Modifier.size(20.dp),
                    )
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        cursorBrush = SolidColor(GotchaColors.BrandPurple),
                        textStyle = TextStyle(
                            fontFamily = Manrope,
                            fontSize = 15.sp,
                            color = GotchaColors.Ink,
                        ),
                        modifier = Modifier.weight(1f),
                        decorationBox = { inner ->
                            if (query.isEmpty()) {
                                Text(
                                    "Search books, news, articles...",
                                    fontFamily = Manrope,
                                    color = GotchaColors.TextSubtle,
                                    fontSize = 15.sp,
                                )
                            }
                            inner()
                        },
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(start = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf("All", "Books", "Articles", "News").forEach { label ->
                    FilterChip(label, selected = filter == label) { filter = label }
                }
                Spacer(modifier = Modifier.width(16.dp))
            }

            OfflineBannerIfNeeded(
                connectivity = container.connectivityObserver,
                hasCachedContent = items.isNotEmpty(),
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
            )

            when {
                loading && items.isEmpty() -> LibraryGridSkeleton(bottomPadding = gridBottom)
                error != null && items.isEmpty() -> OfflineEmptyState(
                    subtitle = "Connect to the internet to load the library, or browse titles you already opened.",
                    onRetry = { reloadKey += 1 },
                    compact = true,
                )
                items.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "No content yet. Tap + to import.",
                            fontFamily = Manrope,
                            color = GotchaColors.TextMuted,
                            fontSize = 14.sp,
                        )
                    }
                }
                else -> LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(
                        start = 24.dp,
                        end = 24.dp,
                        bottom = gridBottom,
                    ),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(items, key = { it.id }) { item ->
                        LibraryCard(item, onClick = offline.guardClick { onOpenReader(item.id) })
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 24.dp, bottom = fabBottom)
                .size(56.dp)
                .shadow(
                    elevation = 12.dp,
                    shape = CircleShape,
                    spotColor = Color(0x4D6B08E8),
                    ambientColor = Color(0x336B08E8),
                )
                .clip(CircleShape)
                .background(Color(0xFF6B08E8))
                .clickable(onClick = onImport),
            contentAlignment = Alignment.Center,
        ) {
            Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(width = 24.dp, height = 3.dp)
                        .clip(RoundedCornerShape(1.5.dp))
                        .background(Color.White),
                )
                Box(
                    modifier = Modifier
                        .size(width = 3.dp, height = 24.dp)
                        .clip(RoundedCornerShape(1.5.dp))
                        .background(Color.White),
                )
            }
        }
    }
}

@Composable
private fun LibraryCard(item: ContentItem, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val coverMod = Modifier.fillMaxWidth().height(130.dp)
        if (!item.coverImageUrl.isNullOrBlank()) {
            AsyncImage(
                model = resolveMediaUrl(item.coverImageUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = coverMod.clip(RoundedCornerShape(12.dp)),
            )
        } else {
            Box(
                modifier = coverMod
                    .clip(RoundedCornerShape(12.dp))
                    .background(GotchaColors.BrandPurple),
                contentAlignment = Alignment.Center,
            ) {
                Text("G", color = Color.White.copy(0.5f), fontWeight = FontWeight.Bold, fontFamily = Manrope)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LangChip(item.language ?: "?", softPurple = true)
            if (!item.cefrLevel.isNullOrBlank()) LevelChip(item.cefrLevel)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                item.title ?: "Untitled",
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                item.authorName ?: item.contentType ?: "",
                fontFamily = Manrope,
                color = GotchaColors.TextSubtle,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}