package app.gotcha.android.ui.learner

import app.gotcha.android.util.uiString
import app.gotcha.android.util.uiPlural
import app.gotcha.android.R
import app.gotcha.android.ui.theme.GotchaBlue
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.InlineVocabularyListSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.WebMaxWidth
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.launch

private enum class VocabChipFilter { All, Due, Learning, Known }

private enum class VocabSortKey { Lemma, DueAt, IntervalDays, Repetitions }

/** Vocabulary tab — matches web-learner VocabularyPage (mobile cards). */
@Composable
fun VocabularyScreen(
    initialSearch: String? = null,
    onOpenPractice: () -> Unit = {},
    openReviewOnLaunch: Boolean = false,
    onGoToLibrary: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    var items by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var queue by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var query by remember(initialSearch) { mutableStateOf(initialSearch.orEmpty()) }
    var chipFilter by remember { mutableStateOf(VocabChipFilter.All) }
    var sortKey by remember { mutableStateOf(VocabSortKey.DueAt) }
    var sortAsc by remember { mutableStateOf(true) }
    var reviewOpen by remember { mutableStateOf(openReviewOnLaunch) }
    var rowBusy by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(reloadKey) {
        loading = items.isEmpty()
        error = null
        container.vocabRepository.listPeek()?.let { peek ->
            items = peek.data
            loading = false
        }
        try {
            items = container.vocabRepository.listFetch().data
            queue = runCatching { container.vocabRepository.reviewQueue(limit = 200) }.getOrDefault(emptyList())
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) error = e.apiErrorMessage(R.string.err_vocab_load)
        } finally {
            loading = false
        }
    }

    LaunchedEffect(openReviewOnLaunch) {
        if (openReviewOnLaunch && queue.isNotEmpty()) reviewOpen = true
    }

    fun refreshAll() {
        reloadKey += 1
    }

    fun markKnown(id: String) {
        if (rowBusy != null) return
        rowBusy = id
        scope.launch {
            try {
                container.vocabRepository.update(id, mastered = true)
                refreshAll()
            } catch (_: Exception) {
            } finally {
                rowBusy = null
            }
        }
    }

    fun removeWord(id: String) {
        if (rowBusy != null) return
        rowBusy = id
        scope.launch {
            try {
                container.vocabRepository.delete(id)
                refreshAll()
            } catch (_: Exception) {
            } finally {
                rowBusy = null
            }
        }
    }

    when {
        loading && items.isEmpty() -> {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebCanvas),
                contentAlignment = Alignment.Center,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = GotchaColors.TextSubtle)
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_loading_vocabulary), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextSubtle)
                }
            }
        }
        error != null && items.isEmpty() -> {
            WebCenteredColumn(maxWidth = WebMaxWidth.W6xl, modifier = Modifier.fillMaxSize().background(GotchaColors.WebCanvas)) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    VocabPageHeader(total = 0, learning = 0, mastered = 0, dueCount = 0, showReview = false, onReview = {})
                    VocabEmptyPanel(
                        title = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_couldn_t_load_vocabulary),
                        description = error.orEmpty(),
                        actionLabel = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_retry),
                        onAction = { refreshAll() },
                    )
                }
            }
        }
        items.isEmpty() -> {
            WebCenteredColumn(maxWidth = WebMaxWidth.W6xl, modifier = Modifier.fillMaxSize().background(GotchaColors.WebCanvas)) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column {
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_vocabulary), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = GotchaColors.Ink)
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_build_your_personal_word_list_while_read), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextSubtle)
                    }
                    VocabEmptyPanel(
                        title = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_no_words_saved_yet),
                        description = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_tap_any_word_while_reading_to_look_it_up),
                        actionLabel = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_go_to_library),
                        onAction = onGoToLibrary,
                    )
                }
            }
        }
        else -> {
            val dueIds = remember(queue) { queue.map { it.id }.toSet() }
            val filtered = remember(items, query, chipFilter, dueIds, sortKey, sortAsc) {
                val q = query.trim().lowercase()
                items
                    .filter { item ->
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
                    .sortedWith { a, b ->
                        val cmp = when (sortKey) {
                            VocabSortKey.Lemma -> a.lemma.orEmpty().compareTo(b.lemma.orEmpty(), ignoreCase = true)
                            VocabSortKey.IntervalDays -> (a.intervalDays ?: 0).compareTo(b.intervalDays ?: 0)
                            VocabSortKey.Repetitions -> (a.repetitions ?: 0).compareTo(b.repetitions ?: 0)
                            VocabSortKey.DueAt -> (a.dueAt ?: "").compareTo(b.dueAt ?: "")
                        }
                        if (sortAsc) cmp else -cmp
                    }
            }
            val totalKnown = items.count { it.mastered }
            val totalLearning = items.size - totalKnown
            val dueCount = queue.size
            val masteredPct = if (items.isNotEmpty()) totalKnown * 100 / items.size else 0

            Box(Modifier.fillMaxSize()) {
                WebCenteredColumn(
                    maxWidth = WebMaxWidth.W6xl,
                    modifier = Modifier.fillMaxSize().background(GotchaColors.WebCanvas),
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(top = learnerScrollTopInset(), bottom = learnerScrollBottomInset()),
                    ) {
                        item {
                            VocabPageHeader(
                                total = items.size,
                                learning = totalLearning,
                                mastered = totalKnown,
                                dueCount = dueCount,
                                showReview = dueCount > 0,
                                onReview = offline.guardClick { reviewOpen = true },
                            )
                        }
                        item {
                            // UI-16: entry point to the daily-practice hub (FSRS mixed exercises).
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(GotchaColors.SurfaceCard)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                    .clickable(onClick = offline.guardClick(onOpenPractice))
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Outlined.AutoAwesome, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_daily_practice), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GotchaColors.Ink)
                                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_mixed_exercises_from_the_words_you_saved), fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.TextMuted)
                                }
                                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_start), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.BrandPurple)
                            }
                        }
                        item {
                            OfflineBannerIfNeeded(
                                connectivity = container.connectivityObserver,
                                hasCachedContent = items.isNotEmpty(),
                            )
                        }
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    VocabStatChip(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_total), items.size, Icons.Outlined.Book, GotchaColors.TextMuted, GotchaColors.Surface, GotchaColors.Border, Modifier.weight(1f))
                                    VocabStatChip(
                                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_due), dueCount, Icons.Outlined.Schedule,
                                        if (dueCount > 0) GotchaColors.WebStreakText else GotchaColors.TextMuted,
                                        if (dueCount > 0) GotchaColors.WebStreakBg else GotchaColors.Surface,
                                        if (dueCount > 0) GotchaColors.WebStreakBorder else GotchaColors.Border,
                                        Modifier.weight(1f),
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    VocabStatChip(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_learning), totalLearning, Icons.Outlined.Psychology, GotchaBlue.LearningText, GotchaBlue.LearningBg, Color(0xFFBEDBFF), Modifier.weight(1f))
                                    VocabStatChip(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_mastered), totalKnown, Icons.Outlined.CheckCircle, Color(0xFF007A55), GotchaColors.SuccessBg, Color(0xFFA4F4CF), Modifier.weight(1f))
                                }
                            }
                        }
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(GotchaColors.SurfaceCard)
                                    .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                            ) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.AutoAwesome, null, tint = GotchaColors.WebAccent, modifier = Modifier.size(14.dp))
                                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_mastery), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.TextMuted)
                                    }
                                    Text("$masteredPct%", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.WebAccent)
                                }
                                LinearProgressIndicator(
                                    progress = { masteredPct / 100f },
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(6.dp).clip(RoundedCornerShape(50)),
                                    color = GotchaColors.WebAccent,
                                    trackColor = GotchaColors.SurfaceMuted,
                                )
                            }
                        }
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(GotchaColors.SurfaceCard)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Outlined.Search, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(14.dp))
                                    BasicTextField(
                                        value = query,
                                        onValueChange = { query = it },
                                        singleLine = true,
                                        textStyle = TextStyle(fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Ink),
                                        cursorBrush = SolidColor(GotchaColors.WebAccent),
                                        modifier = Modifier.fillMaxWidth(),
                                        decorationBox = { inner ->
                                            if (query.isEmpty()) Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_search_words), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextSubtle)
                                            inner()
                                        },
                                    )
                                }
                            }
                        }
                        item {
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                VocabChipFilter.entries.forEach { chip ->
                                    val on = chipFilter == chip
                                    val label = when (chip) {
                                        VocabChipFilter.All -> "all"
                                        VocabChipFilter.Due -> uiString(R.string.vocab_chip_due, dueCount)
                                        VocabChipFilter.Learning -> "learning"
                                        VocabChipFilter.Known -> "known"
                                    }
                                    Text(
                                        label,
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.sp,
                                        color = if (on) Color.White else GotchaColors.TextMuted,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (on) GotchaColors.BrandFill else GotchaColors.SurfaceCard)
                                            .border(1.dp, if (on) GotchaColors.WebAccent else GotchaColors.Border, RoundedCornerShape(8.dp))
                                            .clickable { chipFilter = chip }
                                            .padding(horizontal = 10.dp, vertical = 6.dp),
                                    )
                                }
                            }
                        }
                        if (loading && items.isEmpty()) {
                            item { InlineVocabularyListSkeleton() }
                        } else if (filtered.isEmpty()) {
                            item {
                                Text(
                                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_no_words_match_your_search),
                                    fontFamily = Inter,
                                    fontSize = 14.sp,
                                    color = GotchaColors.TextSubtle,
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                                    textAlign = TextAlign.Center,
                                )
                            }
                        } else {
                            items(filtered, key = { it.id }) { item ->
                                VocabWordCard(
                                    item = item,
                                    isDue = dueIds.contains(item.id),
                                    busy = rowBusy == item.id,
                                    onMarkKnown = { markKnown(item.id) },
                                    onRemove = { removeWord(item.id) },
                                )
                            }
                        }
                        item {
                            Text(
                                buildString {
                                    append(uiString(R.string.vocab_showing, filtered.size, items.size))
                                    if (loading) append(uiString(R.string.vocab_refreshing))
                                },
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.TextSubtle,
                                modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 16.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
                if (reviewOpen) {
                    VocabularyReviewModal(
                        onClose = { reviewOpen = false },
                        onRefresh = { refreshAll() },
                        seedQueue = queue.takeIf { it.isNotEmpty() },
                    )
                }
            }
        }
    }
}

@Composable
private fun VocabPageHeader(
    total: Int,
    learning: Int,
    mastered: Int,
    dueCount: Int,
    showReview: Boolean,
    onReview: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_vocabulary), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = GotchaColors.Ink)
            Text(
                uiPlural(R.plurals.vocab_n_words, total) + " · " + uiString(R.string.vocab_summary_rest, learning, mastered),
                fontFamily = Inter,
                fontSize = 14.sp,
                color = GotchaColors.TextSubtle,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        if (showReview) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(GotchaColors.BrandFill)
                    .clickable(onClick = onReview)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Outlined.Psychology, null, tint = Color.White, modifier = Modifier.size(16.dp))
                Text(uiString(R.string.vocab_review_n_due, dueCount), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color.White)
            }
        }
    }
}

@Composable
private fun VocabEmptyPanel(title: String, description: String, actionLabel: String, onAction: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(16.dp))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Outlined.Book, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(40.dp))
        Text(title, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GotchaColors.Ink)
        Text(description, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextSubtle, textAlign = TextAlign.Center)
        Text(
            actionLabel,
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = Color.White,
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(GotchaColors.BrandFill)
                .clickable(onClick = onAction)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun VocabStatChip(
    label: String,
    value: Int,
    icon: ImageVector,
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
        Icon(icon, null, tint = textColor, modifier = Modifier.size(16.dp))
        Column {
            Text("$value", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
            Text(label, fontFamily = Inter, fontSize = 11.sp, color = textColor.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun VocabWordCard(
    item: VocabItem,
    isDue: Boolean,
    busy: Boolean,
    onMarkKnown: () -> Unit,
    onRemove: () -> Unit,
) {
    val status = if (item.mastered) "known" else "learning"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (isDue) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFFBBF24)))
                    }
                    Text(item.lemma.orEmpty(), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = GotchaColors.Ink)
                    VocabStatusBadge(status)
                }
                Text(
                    item.translation.orEmpty(),
                    fontFamily = Inter,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    uiString(R.string.vocab_next_review, formatVocabDueDate(item.dueAt), item.intervalDays ?: 0, item.repetitions ?: 0),
                    fontFamily = Inter,
                    fontSize = 11.sp,
                    color = GotchaColors.TextSubtle,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                if (!item.mastered) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(enabled = !busy, onClick = onMarkKnown)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Check, null, tint = Color(0xFF059669), modifier = Modifier.size(16.dp))
                    }
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(enabled = !busy, onClick = onRemove)
                        .padding(8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Delete, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun VocabStatusBadge(status: String) {
    val (bg, fg) = if (status == "known") Color(0xFFD1FAE5) to GotchaColors.SuccessText else Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
    Text(
        status,
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

internal fun formatVocabDueDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return try {
        val zone = ZoneId.systemDefault()
        val due = Instant.parse(iso).atZone(zone).toLocalDate()
        val today = Instant.now().atZone(zone).toLocalDate()
        val diff = ChronoUnit.DAYS.between(today, due).toInt()
        when {
            diff < -1 -> uiString(R.string.vocab_overdue, kotlin.math.abs(diff))
            diff < 0 -> uiString(R.string.common_yesterday)
            diff == 0 -> uiString(R.string.common_today)
            diff == 1 -> uiString(R.string.vocab_tomorrow)
            else -> uiString(R.string.vocab_in_days, diff)
        }
    } catch (_: Exception) {
        iso.take(10)
    }
}
