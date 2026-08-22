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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.InlineVocabularyListSkeleton
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.WebMaxWidth

private enum class VocabChipFilter { All, Due, Learning, Known }

/** Vocabulary tab — matches web-learner VocabularyPage. */
@Composable
fun VocabularyScreen(
    filter: VocabFilterCriteria = VocabFilterCriteria(),
    onOpenWord: (String) -> Unit = {},
    onOpenReview: () -> Unit = {},
    onOpenFilter: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    var items by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var queue by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var chipFilter by remember { mutableStateOf(VocabChipFilter.All) }
    var reviewOpen by remember { mutableStateOf(false) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(reloadKey, filter.sortApiParam()) {
        val sort = filter.sortApiParam()
        loading = items.isEmpty()
        error = null
        container.vocabRepository.listPeek(sort)?.let { peek ->
            items = peek.data
            loading = false
        }
        try {
            items = container.vocabRepository.listFetch(sort).data
            queue = runCatching { container.vocabRepository.reviewQueue() }.getOrDefault(emptyList())
            stats = runCatching { container.userRepository.statsFetch().data }.getOrNull() ?: stats
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) error = e.apiErrorMessage("Failed to load vocabulary")
        } finally {
            loading = false
        }
    }

    when {
        error != null && items.isEmpty() && !loading -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val dueIds = remember(queue) { queue.map { it.id }.toSet() }
            val filtered = remember(items, query, chipFilter, dueIds) {
                val q = query.trim().lowercase()
                items.filter { item ->
                    if (q.isNotBlank()) {
                        val hit = item.lemma.orEmpty().lowercase().contains(q) ||
                            item.translation.orEmpty().lowercase().contains(q)
                        if (!hit) return@filter false
                    }
                    when (chipFilter) {
                        VocabChipFilter.Due -> dueIds.contains(item.id)
                        VocabChipFilter.Learning -> !item.mastered
                        VocabChipFilter.Known -> item.mastered
                        VocabChipFilter.All -> true
                    }
                }
            }
            val totalKnown = items.count { it.mastered }
            val totalLearning = items.size - totalKnown
            val dueCount = queue.size
            val masteredPct = if (items.isNotEmpty()) totalKnown * 100 / items.size else 0
            val listLoading = loading && items.isEmpty()

            Box(Modifier.fillMaxSize()) {
            WebCenteredColumn(
                maxWidth = WebMaxWidth.W6xl,
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebCanvas),
            ) {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(
                        top = learnerScrollTopInset(),
                        bottom = learnerScrollBottomInset(),
                    ),
                ) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Vocabulary", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Color(0xFF111827))
                                Text(
                                    "${items.size} words · $totalLearning learning · $totalKnown mastered",
                                    fontFamily = Inter,
                                    fontSize = 14.sp,
                                    color = Color(0xFF99A1AF),
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                            if (dueCount > 0) {
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(GotchaColors.WebAccent)
                                        .clickable(onClick = offline.guardClick { reviewOpen = true })
                                        .padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Icon(Icons.Outlined.Psychology, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                    Text("Review $dueCount due", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color.White)
                                }
                            }
                        }
                    }

                    item {
                        OfflineBannerIfNeeded(
                            connectivity = container.connectivityObserver,
                            hasCachedContent = items.isNotEmpty() || stats != null,
                        )
                    }

                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                VocabStatChip("Total", items.size, Icons.Outlined.Book, Color(0xFF364153), Color(0xFFF9FAFB), Color(0xFFE5E7EB), Modifier.weight(1f))
                                VocabStatChip(
                                    "Due",
                                    dueCount,
                                    Icons.Outlined.Schedule,
                                    if (dueCount > 0) Color(0xFFBB4D00) else Color(0xFF364153),
                                    if (dueCount > 0) Color(0xFFFFFBEB) else Color(0xFFF9FAFB),
                                    if (dueCount > 0) Color(0xFFFEE685) else Color(0xFFE5E7EB),
                                    Modifier.weight(1f),
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                VocabStatChip("Learning", totalLearning, Icons.Outlined.Psychology, Color(0xFF1447E6), Color(0xFFEFF6FF), Color(0xFFBEDBFF), Modifier.weight(1f))
                                VocabStatChip("Mastered", totalKnown, Icons.Outlined.CheckCircle, Color(0xFF007A55), Color(0xFFECFDF5), Color(0xFFA4F4CF), Modifier.weight(1f))
                            }
                        }
                    }

                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(12.dp))
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                        ) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Mastery", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF374151))
                                Text("$masteredPct%", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.WebAccent)
                            }
                            LinearProgressIndicator(
                                progress = { masteredPct / 100f },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp)
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(50)),
                                color = GotchaColors.WebAccent,
                                trackColor = Color(0xFFF3F4F6),
                            )
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
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
                                        value = query,
                                        onValueChange = { query = it },
                                        singleLine = true,
                                        textStyle = TextStyle(fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF111827)),
                                        cursorBrush = SolidColor(GotchaColors.WebAccent),
                                        modifier = Modifier.fillMaxWidth(),
                                        decorationBox = { inner ->
                                            if (query.isEmpty()) {
                                                Text("Search words…", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF9CA3AF))
                                            }
                                            inner()
                                        },
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            VocabChipFilter.entries.forEach { chip ->
                                val on = chipFilter == chip
                                Text(
                                    chip.name.lowercase(),
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 12.sp,
                                    color = if (on) Color.White else Color(0xFF4B5563),
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(if (on) GotchaColors.WebAccent else Color.White)
                                        .border(1.dp, if (on) GotchaColors.WebAccent else Color(0xFFE5E7EB), RoundedCornerShape(50))
                                        .clickable { chipFilter = chip }
                                        .padding(horizontal = 14.dp, vertical = 6.dp),
                                )
                            }
                        }
                    }

                    if (listLoading) {
                        item { InlineVocabularyListSkeleton() }
                    } else if (filtered.isEmpty()) {
                        item {
                            Text(
                                if (items.isEmpty()) "No words saved yet — tap words while reading to add them." else "No words match this filter.",
                                fontFamily = Inter,
                                fontSize = 14.sp,
                                color = Color(0xFF99A1AF),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                    } else {
                        items(filtered, key = { it.id }) { item ->
                            WebVocabRow(
                                item = item,
                                isDue = dueIds.contains(item.id),
                                onClick = offline.guardClick { item.lemma?.let(onOpenWord) },
                            )
                        }
                    }

                    item {
                        Text(
                            "Showing ${filtered.size} of ${items.size}",
                            fontFamily = Inter,
                            fontSize = 12.sp,
                            color = Color(0xFF99A1AF),
                            modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
                        )
                    }
                }
            }
            if (reviewOpen) {
                VocabularyReviewModal(
                    onClose = { reviewOpen = false },
                    onRefresh = { reloadKey += 1 },
                    seedQueue = queue.takeIf { it.isNotEmpty() },
                )
            }
            }
        }
    }
}

@Composable
private fun VocabStatChip(
    label: String,
    value: Int,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    textColor: Color,
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
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = textColor, modifier = Modifier.size(16.dp))
        Column {
            Text("$value", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
            Text(label, fontFamily = Inter, fontSize = 11.sp, color = textColor.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun WebVocabRow(item: VocabItem, isDue: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f),
        ) {
            LangChip(item.sourceLang ?: "?", vocabulary = true)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.lemma.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Color(0xFF111827))
                Text(item.translation.orEmpty(), fontFamily = Inter, fontSize = 13.sp, color = Color(0xFF6B7280))
            }
        }
        Text(
            when {
                item.mastered -> "known"
                isDue -> "due"
                else -> "learning"
            },
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            color = when {
                item.mastered -> Color(0xFF047857)
                isDue -> Color(0xFFBB4D00)
                else -> Color(0xFF1D4ED8)
            },
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(
                    when {
                        item.mastered -> Color(0xFFD1FAE5)
                        isDue -> Color(0xFFFFFBEB)
                        else -> Color(0xFFDBEAFE)
                    },
                )
                .padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
