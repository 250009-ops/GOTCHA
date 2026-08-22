package app.gotcha.android.ui.learner

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Filter/sort criteria for the Words list (applied client-side + API sort). */
data class VocabFilterCriteria(
    val language: String = "All",
    val mastery: String = "All levels",
    val sortBy: String = "Recently added",
    val sourceTitle: String = "All sources",
) {
    fun isDefault(): Boolean =
        language == "All" &&
            mastery == "All levels" &&
            sortBy == "Recently added" &&
            sourceTitle == "All sources"

    fun sortApiParam(): String = when (sortBy) {
        "Alphabetical" -> "alpha"
        "Due for review first" -> "due"
        else -> "recent"
    }
}

data class ReviewWeakWord(
    val id: String,
    val lemma: String,
    val translation: String?,
    val rating: String,
    val sourceLang: String?,
    val contextSentence: String?,
    val contentTitle: String?,
)

data class ReviewSessionResult(
    val reviewed: Int = 0,
    val correct: Int = 0,
    val weak: List<ReviewWeakWord> = emptyList(),
) {
    val needPractice: Int get() = weak.size
    val accuracyPct: Int
        get() = if (reviewed <= 0) 0 else ((correct * 100f) / reviewed).toInt().coerceIn(0, 100)
}

fun applyVocabFilter(
    items: List<VocabItem>,
    filter: VocabFilterCriteria,
    query: String = "",
): List<VocabItem> {
    val q = query.trim().lowercase(Locale.ROOT)
    var list = items.asSequence()
    if (filter.language != "All") {
        val lang = filter.language.lowercase(Locale.ROOT)
        list = list.filter { (it.sourceLang ?: "").equals(lang, ignoreCase = true) }
    }
    list = when (filter.mastery) {
        "New (1)" -> list.filter { !it.mastered && (it.repetitions ?: 0) <= 0 }
        "Learning (2-3)" -> list.filter {
            !it.mastered && (it.repetitions ?: 0) in 1..3
        }
        "Familiar (4)" -> list.filter { !it.mastered && (it.repetitions ?: 0) >= 4 }
        "Mastered (5)" -> list.filter { it.mastered }
        else -> list
    }
    if (filter.sourceTitle != "All sources") {
        list = list.filter {
            (it.content?.title ?: "").equals(filter.sourceTitle, ignoreCase = true)
        }
    }
    if (q.isNotEmpty()) {
        list = list.filter {
            (it.lemma ?: "").lowercase(Locale.ROOT).contains(q) ||
                (it.translation ?: "").lowercase(Locale.ROOT).contains(q)
        }
    }
    val sorted = list.toList()
    return when (filter.sortBy) {
        "Alphabetical" -> sorted.sortedBy { (it.lemma ?: "").lowercase(Locale.ROOT) }
        "Mastery level" -> sorted.sortedWith(
            compareByDescending<VocabItem> { it.mastered }
                .thenByDescending { it.repetitions ?: 0 },
        )
        "Most reviewed" -> sorted.sortedByDescending { it.repetitions ?: 0 }
        "Due for review first" -> sorted.sortedBy { it.dueAt ?: "9999" }
        else -> sorted // API recent / already ordered
    }
}

internal fun formatVocabRelative(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return try {
        val zone = ZoneId.systemDefault()
        val day = Instant.parse(iso).atZone(zone).toLocalDate()
        val today = Instant.now().atZone(zone).toLocalDate()
        val days = ChronoUnit.DAYS.between(today, day)
        when {
            days < -1 -> "${-days}d ago"
            days == -1L -> "Yesterday"
            days == 0L -> "Today"
            days == 1L -> "Tomorrow"
            else -> "in ${days}d"
        }
    } catch (_: Exception) {
        iso.take(10)
    }
}

internal fun formatVocabDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return try {
        val instant = Instant.parse(iso)
        DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
            .withZone(ZoneId.systemDefault())
            .format(instant)
    } catch (_: Exception) {
        iso.take(10)
    }
}

private fun masteryDots(item: VocabItem?): Int = when {
    item == null -> 0
    item.mastered -> 5
    (item.repetitions ?: 0) >= 4 -> 4
    (item.repetitions ?: 0) >= 3 -> 3
    (item.repetitions ?: 0) >= 1 -> 2
    else -> 1
}

@Composable
private fun MasteryDotsRow(filled: Int, size: Int = 8, gap: Int = 4) {
    Row(horizontalArrangement = Arrangement.spacedBy(gap.dp)) {
        repeat(5) { index ->
            Box(
                modifier = Modifier
                    .size(size.dp)
                    .clip(CircleShape)
                    .background(if (index < filled) GotchaColors.BrandPurpleMid else GotchaColors.Border),
            )
        }
    }
}

@Composable
private fun ReviewLangChip(code: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(GotchaColors.BrandPurpleTint)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(
            code.uppercase(),
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            color = GotchaColors.BrandPurpleMid,
        )
    }
}

internal fun dueVocabFromCache(items: List<VocabItem>, limit: Int = 50): List<VocabItem> {
    val now = Instant.now()
    return items.filter { item ->
        val due = item.dueAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
        due == null || !due.isAfter(now)
    }.take(limit)
}

/** SRS Review overlay — matches web-learner VocabularyPage ReviewModal. */
@Composable
fun VocabularyReviewModal(
    onClose: () -> Unit,
    onRefresh: () -> Unit,
    seedQueue: List<VocabItem>? = null,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var queue by remember(seedQueue) { mutableStateOf(seedQueue.orEmpty()) }
    var loading by remember { mutableStateOf(queue.isEmpty()) }
    var index by remember { mutableIntStateOf(0) }
    var revealed by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var reviewed by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(seedQueue) {
        if (seedQueue != null) {
            queue = seedQueue
            loading = false
            return@LaunchedEffect
        }
        loading = queue.isEmpty()
        error = null
        try {
            queue = container.vocabRepository.reviewQueue(limit = 200)
            index = 0
            revealed = false
            reviewed = 0
        } catch (e: Exception) {
            if (queue.isEmpty()) error = e.message ?: "Failed to load review queue"
        } finally {
            loading = false
        }
    }

    fun closeModal() {
        onClose()
        onRefresh()
    }

    fun rate(rating: String) {
        val item = queue.getOrNull(index) ?: return
        if (busy) return
        busy = true
        scope.launch {
            try {
                container.vocabRepository.review(item.id, rating)
                reviewed += 1
                revealed = false
                index += 1
                error = null
            } catch (e: Exception) {
                error = e.message ?: "Review failed"
            } finally {
                busy = false
            }
        }
    }

    if (queue.isEmpty() && !loading && error == null) return

    val done = index >= queue.size
    val item = queue.getOrNull(index)
    val progress = if (queue.isEmpty()) 0f else (index.toFloat() / queue.size).coerceIn(0f, 1f)

    androidx.compose.ui.window.Dialog(
        onDismissRequest = { closeModal() },
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Outlined.Psychology,
                            contentDescription = null,
                            tint = GotchaColors.WebAccent,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "SRS Review",
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = Color(0xFF374151),
                        )
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "${(index + 1).coerceAtMost(queue.size.coerceAtLeast(1))} / ${queue.size}",
                            fontFamily = Inter,
                            fontSize = 12.sp,
                            color = Color(0xFF9CA3AF),
                        )
                        Box(
                            Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { closeModal() },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.Close,
                                contentDescription = "Close",
                                tint = Color(0xFF9CA3AF),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }

                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .background(Color(0xFFF3F4F6)),
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(progress)
                            .height(4.dp)
                            .background(GotchaColors.WebAccent),
                    )
                }

                when {
                    loading && queue.isEmpty() -> {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(280.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            LoadingBox(Modifier.size(48.dp))
                        }
                    }
                    error != null && queue.isEmpty() -> {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(error!!, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Danger)
                            ReviewFlatButton(text = "Close", onClick = { closeModal() }, filled = true)
                        }
                    }
                    done -> {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                Modifier
                                    .size(64.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFD1FAE5)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Outlined.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF059669),
                                    modifier = Modifier.size(32.dp),
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            Text(
                                "Session complete!",
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                color = Color(0xFF111827),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Reviewed $reviewed word${if (reviewed == 1) "" else "s"}. Great job!",
                                fontFamily = Inter,
                                fontSize = 14.sp,
                                color = Color(0xFF6B7280),
                            )
                            Spacer(Modifier.height(24.dp))
                            ReviewFlatButton(text = "Back to vocabulary", onClick = { closeModal() }, filled = true)
                        }
                    }
                    item != null -> {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                item.lemma.orEmpty(),
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 30.sp,
                                color = Color(0xFF111827),
                                textAlign = TextAlign.Center,
                            )
                            item.contextSentence?.takeIf { it.isNotBlank() }?.let { ctx ->
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "\"$ctx\"",
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = Color(0xFF9CA3AF),
                                    fontStyle = FontStyle.Italic,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 8.dp),
                                )
                            }

                            Spacer(Modifier.height(24.dp))

                            if (!revealed) {
                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFF9FAFB))
                                        .border(
                                            2.dp,
                                            Color(0xFFE5E7EB),
                                            RoundedCornerShape(12.dp),
                                        )
                                        .clickable(enabled = !busy) { revealed = true }
                                        .padding(vertical = 12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text(
                                        "Show translation",
                                        fontFamily = Inter,
                                        fontSize = 14.sp,
                                        color = Color(0xFF9CA3AF),
                                    )
                                    Text(
                                        "Tap to reveal",
                                        fontFamily = Inter,
                                        fontSize = 11.sp,
                                        color = Color(0xFF9CA3AF).copy(alpha = 0.6f),
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                            } else {
                                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color(0xFFF5F3FF))
                                            .padding(horizontal = 16.dp, vertical = 12.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            item.translation.orEmpty(),
                                            fontFamily = Inter,
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 16.sp,
                                            color = Color(0xFF374151),
                                            textAlign = TextAlign.Center,
                                        )
                                    }

                                    Row(
                                        Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        listOf(
                                            Triple("Again", Color(0xFFDC2626), Color(0xFFFECACA)),
                                            Triple("Hard", Color(0xFFD97706), Color(0xFFFDE68A)),
                                            Triple("Good", Color(0xFF2563EB), Color(0xFFBFDBFE)),
                                            Triple("Easy", Color(0xFF059669), Color(0xFFA7F3D0)),
                                        ).forEach { (label, textColor, borderColor) ->
                                            Column(
                                                Modifier
                                                    .weight(1f)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(Color.White)
                                                    .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                                                    .clickable(enabled = !busy) { rate(label) }
                                                    .padding(vertical = 10.dp),
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                verticalArrangement = Arrangement.spacedBy(4.dp),
                                            ) {
                                                Text(
                                                    label,
                                                    fontFamily = Inter,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 12.sp,
                                                    color = textColor,
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            error?.let { msg ->
                                Spacer(Modifier.height(12.dp))
                                Text(
                                    msg,
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = GotchaColors.Danger,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Daily Review — wired to GET /vocabulary/review-queue + POST /vocabulary/{id}/review. */
@Composable
fun VocabularyReviewScreen(
    onBack: () -> Unit,
    onComplete: (ReviewSessionResult) -> Unit,
    seedQueue: List<VocabItem>? = null,
    modal: Boolean = false,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var queue by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var index by remember { mutableIntStateOf(0) }
    var reveal by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var reviewed by remember { mutableIntStateOf(0) }
    var correct by remember { mutableIntStateOf(0) }
    var weak by remember { mutableStateOf<List<ReviewWeakWord>>(emptyList()) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(seedQueue, reloadKey) {
        loading = queue.isEmpty()
        error = null
        if (seedQueue != null) {
            queue = seedQueue
            index = 0
            reveal = false
            loading = false
            return@LaunchedEffect
        }
        container.vocabRepository.listPeek()?.let { peek ->
            val cachedDue = dueVocabFromCache(peek.data)
            if (cachedDue.isNotEmpty()) {
                queue = cachedDue
                loading = false
            }
        }
        try {
            queue = container.vocabRepository.reviewQueue()
            index = 0
            reveal = false
            reviewed = 0
            correct = 0
            weak = emptyList()
        } catch (e: Exception) {
            if (queue.isEmpty()) {
                error = e.message ?: "Failed to load review queue"
            }
        } finally {
            loading = false
        }
    }

    fun finish() {
        onComplete(ReviewSessionResult(reviewed = reviewed, correct = correct, weak = weak))
    }

    fun advanceLocal() {
        reveal = false
        if (index + 1 >= queue.size) finish() else index += 1
    }

    fun rate(rating: String) {
        val word = queue.getOrNull(index) ?: return
        if (busy) return
        busy = true
        scope.launch {
            try {
                container.vocabRepository.review(word.id, rating)
                reviewed += 1
                val key = rating.lowercase(Locale.ROOT)
                if (key == "good" || key == "easy") {
                    correct += 1
                } else if (key == "again" || key == "hard") {
                    weak = weak + ReviewWeakWord(
                        id = word.id,
                        lemma = word.lemma.orEmpty(),
                        translation = word.translation,
                        rating = rating.replaceFirstChar { it.uppercase() },
                        sourceLang = word.sourceLang,
                        contextSentence = word.contextSentence,
                        contentTitle = word.content?.title,
                    )
                }
                advanceLocal()
            } catch (e: Exception) {
                error = e.message ?: "Review failed"
            } finally {
                busy = false
            }
        }
    }

    when {
        loading && queue.isEmpty() -> LoadingBox(Modifier.fillMaxSize())
        error != null && queue.isEmpty() -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val word = queue.getOrNull(index)
            val total = queue.size
            val progress = if (total == 0) 0f else ((index).toFloat() / total).coerceIn(0f, 1f)

            Column(
                Modifier
                    .fillMaxWidth()
                    .then(
                        if (modal) {
                            Modifier.padding(bottom = 8.dp)
                        } else {
                            Modifier
                                .fillMaxSize()
                                .background(GotchaColors.Surface)
                                .statusBarsPadding()
                                .navigationBarsPadding()
                                .padding(bottom = 32.dp)
                        },
                    ),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = queue.isNotEmpty(),
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(top = 16.dp)
                        .height(56.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Box(
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, CircleShape)
                            .clickable(onClick = onBack),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_x_circle),
                            contentDescription = "Close",
                            tint = Color.Unspecified,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            if (modal) "SRS Review" else "Daily Review",
                            fontFamily = Inter,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                        )
                        Text(
                            if (total == 0) "0 cards" else "${(index + 1).coerceAtMost(total)} of $total cards",
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                    Spacer(Modifier.size(36.dp))
                }

                if (word == null) {
                    Column(
                        Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            if (reviewed > 0) "Session complete!" else "You're caught up!",
                            fontFamily = Inter,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 22.sp,
                            color = GotchaColors.Ink,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            if (reviewed > 0) {
                                "Reviewed $reviewed word${if (reviewed == 1) "" else "s"}."
                            } else {
                                "No words due for review right now."
                            },
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        ReviewFlatButton(
                            text = "Done",
                            onClick = { if (reviewed > 0) finish() else onBack() },
                            filled = true,
                        )
                    }
                } else {
                    Column(
                        Modifier
                            .padding(horizontal = 20.dp)
                            .fillMaxWidth()
                            .shadow(
                                12.dp,
                                RoundedCornerShape(24.dp),
                                spotColor = Color(0x08121316),
                                ambientColor = Color(0x08121316),
                            )
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(24.dp))
                            .clickable(enabled = !busy) { reveal = !reveal }
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        ReviewLangChip((word.sourceLang ?: "?").uppercase(Locale.ROOT))
                        Column(
                            Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                word.lemma.orEmpty(),
                                fontFamily = Inter,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 36.sp,
                                color = GotchaColors.Ink,
                                textAlign = TextAlign.Center,
                            )
                            if (reveal) {
                                Text(
                                    word.translation.orEmpty(),
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = GotchaColors.BrandPurpleMid,
                                    textAlign = TextAlign.Center,
                                )
                            } else {
                                Text(
                                    "Tap to reveal",
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.TextSubtle,
                                )
                            }
                        }
                        if (reveal) {
                            val ctx = word.contextSentence?.takeIf { it.isNotBlank() }
                            if (ctx != null) {
                                HorizontalDivider(color = GotchaColors.Border, thickness = 1.dp)
                                Column(
                                    Modifier.fillMaxWidth(),
                                    verticalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Text(
                                        "EXAMPLE",
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        color = GotchaColors.TextSubtle,
                                    )
                                    Text(
                                        ctx,
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 16.sp,
                                        lineHeight = 24.sp,
                                        color = GotchaColors.Ink,
                                    )
                                }
                            }
                            val found = word.content?.title?.takeIf { it.isNotBlank() }
                            if (found != null) {
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .drawReviewTopBorder()
                                        .padding(top = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Icon(
                                        painter = painterResource(R.drawable.ic_book_open_ink),
                                        contentDescription = null,
                                        tint = Color.Unspecified,
                                        modifier = Modifier.size(16.dp),
                                    )
                                    Text(
                                        found,
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp,
                                        color = GotchaColors.TextMuted,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }

                    if (error != null) {
                        Text(
                            error!!,
                            modifier = Modifier.padding(horizontal = 20.dp),
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            color = GotchaColors.Danger,
                        )
                    }

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp)
                            .padding(top = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            "HOW WELL DID YOU KNOW THIS?",
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                            fontFamily = Inter,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = GotchaColors.TextSubtle,
                        )
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            listOf(
                                "Again" to Color(0xFFEF4444),
                                "Hard" to Color(0xFFF59E0B),
                                "Good" to Color(0xFF10B981),
                                "Easy" to Color(0xFF3B82F6),
                            ).forEach { (label, color) ->
                                Column(
                                    Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color.White)
                                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                        .clickable(enabled = reveal && !busy) { rate(label) }
                                        .padding(12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text(
                                        label,
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 15.sp,
                                        color = if (reveal && !busy) color else GotchaColors.TextSubtle,
                                    )
                                }
                            }
                        }
                    }

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .padding(top = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(GotchaColors.Border),
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth(progress)
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(GotchaColors.BrandPurpleMid),
                            )
                        }
                        Text(
                            "Skip Card",
                            modifier = Modifier.clickable(enabled = !busy) { advanceLocal() },
                            fontFamily = Inter,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                    }
                }
            }
        }
    }
}

private fun Modifier.drawReviewTopBorder(): Modifier = this.then(
    Modifier.drawBehind {
        val stroke = 1.dp.toPx()
        drawLine(
            color = GotchaColors.Border,
            start = Offset(0f, 0f),
            end = Offset(size.width, 0f),
            strokeWidth = stroke,
        )
    },
)

/** Review complete — session results only (no Figma hard-coded stats). */
@Composable
fun ReviewCompleteScreen(
    result: ReviewSessionResult?,
    onBack: () -> Unit,
    onReviewWeak: () -> Unit = onBack,
) {
    val session = result ?: ReviewSessionResult()
    val accuracy = session.accuracyPct
    val purpleSweep = (accuracy / 100f) * 360f
    val greenSweep = ((100 - accuracy) / 100f) * 360f

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(32.dp))
                    .background(GotchaColors.BrandPurpleTint),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_party_popper),
                    contentDescription = null,
                    tint = Color.Unspecified,
                    modifier = Modifier.size(32.dp),
                )
            }
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    if (session.reviewed > 0) "Review Complete!" else "All caught up",
                    modifier = Modifier.fillMaxWidth(),
                    fontFamily = Inter,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 26.sp,
                    color = GotchaColors.Ink,
                    textAlign = TextAlign.Center,
                )
                Text(
                    if (session.reviewed > 0) {
                        "Reviewed ${session.reviewed} word${if (session.reviewed == 1) "" else "s"}."
                    } else {
                        "No cards were reviewed this session."
                    },
                    modifier = Modifier.fillMaxWidth(),
                    fontFamily = Inter,
                    fontWeight = FontWeight.Normal,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                    textAlign = TextAlign.Center,
                )
            }
        }

        if (session.reviewed > 0) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .shadow(
                        4.dp,
                        RoundedCornerShape(16.dp),
                        spotColor = Color(0x08121316),
                        ambientColor = Color(0x08121316),
                    )
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Box(Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                        Canvas(Modifier.size(72.dp)) {
                            val stroke = 7.2.dp.toPx()
                            val arcSize = Size(size.width - stroke, size.height - stroke)
                            val topLeft = Offset(stroke / 2, stroke / 2)
                            drawCircle(GotchaColors.Border, style = Stroke(stroke))
                            if (greenSweep > 0f) {
                                drawArc(
                                    color = GotchaColors.SuccessBright,
                                    startAngle = -90f + purpleSweep,
                                    sweepAngle = greenSweep,
                                    useCenter = false,
                                    style = Stroke(stroke, cap = StrokeCap.Butt),
                                    size = arcSize,
                                    topLeft = topLeft,
                                )
                            }
                            if (purpleSweep > 0f) {
                                drawArc(
                                    color = GotchaColors.BrandPurpleMid,
                                    startAngle = -90f,
                                    sweepAngle = purpleSweep,
                                    useCenter = false,
                                    style = Stroke(stroke, cap = StrokeCap.Butt),
                                    size = arcSize,
                                    topLeft = topLeft,
                                )
                            }
                        }
                        Text(
                            "$accuracy%",
                            fontFamily = Inter,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                        )
                    }
                    Text(
                        "Accuracy",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.sp,
                        color = Color(0xFF667085),
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ReviewLegendDot(
                        GotchaColors.BrandPurpleMid,
                        "${session.reviewed} cards reviewed",
                        GotchaColors.TextMuted,
                    )
                    ReviewLegendDot(
                        GotchaColors.SuccessBright,
                        "${session.correct} correct",
                        GotchaColors.SuccessText,
                    )
                    ReviewLegendDot(
                        Color(0xFF991B1B),
                        "${session.needPractice} need more practice",
                        Color(0xFF991B1B),
                    )
                }
            }
        }

        if (session.weak.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "WORDS TO REVISIT",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    session.weak.forEach { w ->
                        RevisitRow(w.lemma, w.translation.orEmpty(), w.rating)
                    }
                }
            }
        }

        Column(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReviewFlatButton(text = "Done", onClick = onBack, filled = true)
            if (session.weak.isNotEmpty()) {
                ReviewFlatButton(text = "Review Weak Words", onClick = onReviewWeak, filled = false)
            }
        }
    }
}

@Composable
private fun ReviewFlatButton(text: String, onClick: () -> Unit, filled: Boolean) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .height(51.dp)
            .clip(shape)
            .background(if (filled) GotchaColors.BrandPurpleMid else Color.Transparent)
            .then(
                if (filled) Modifier else Modifier.border(1.dp, GotchaColors.BrandPurpleMid, shape),
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = if (filled) Color.White else GotchaColors.BrandPurpleMid,
        )
    }
}

@Composable
private fun ReviewLegendDot(dot: Color, label: String, labelColor: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
        Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = labelColor)
    }
}

@Composable
private fun RevisitRow(lemma: String, translation: String, tag: String) {
    val (bg, fg) = when (tag) {
        "Again" -> Color(0xFFFEF2F2) to Color(0xFF991B1B)
        else -> Color(0xFFFEF3C7) to GotchaColors.Ink
    }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(lemma, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GotchaColors.Ink)
            if (translation.isNotBlank()) {
                Text(
                    translation,
                    fontFamily = Inter,
                    fontWeight = FontWeight.Normal,
                    fontSize = 13.sp,
                    color = GotchaColors.TextMuted,
                )
            }
        }
        Text(
            tag,
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(bg)
                .padding(horizontal = 6.dp, vertical = 2.dp),
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            color = fg,
        )
    }
}

/** Word detail — API fields only; hide stubs (IPA / POS / declensions / audio / edit). */
@Composable
fun WordDetailScreen(lemma: String, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var item by remember { mutableStateOf<VocabItem?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(lemma, reloadKey) {
        loading = item == null
        error = null
        if (item == null) {
            container.vocabRepository.listPeek()?.let { peek ->
                item = peek.data.firstOrNull { it.lemma.equals(lemma, ignoreCase = true) }
                loading = false
            }
        }
        try {
            val result = container.vocabRepository.listFetch()
            item = result.data.firstOrNull { it.lemma.equals(lemma, ignoreCase = true) } ?: item
        } catch (e: Exception) {
            if (item == null) {
                error = e.message ?: "Failed to load word"
            }
        } finally {
            loading = false
        }
    }

    val navBars =
        max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    val deleteClearance = navBars + 48.dp + 24.dp

    when {
        loading && item == null -> LoadingBox(Modifier.fillMaxSize())
        item == null && !loading -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val display = item?.lemma ?: lemma
            val src = (item?.sourceLang ?: "?").uppercase(Locale.ROOT)
            val target = (item?.targetLang ?: "").uppercase(Locale.ROOT)
            val translation = item?.translation?.takeIf { it.isNotBlank() }
            val ctx = item?.contextSentence?.takeIf { it.isNotBlank() }
            val foundTitle = item?.content?.title?.takeIf { it.isNotBlank() }
            val addedLabel = item?.createdAt?.let { "Added: ${formatVocabDate(it)}" }
            val timesReviewed = "${item?.repetitions ?: 0}"
            val lastReviewed = formatVocabRelative(item?.lastReviewedAt)
            val nextReview = formatVocabRelative(item?.dueAt)

            Column(
                Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface)
                    .learnerDirectoryStatusPad(),
            ) {
                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = item != null,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(top = 8.dp, bottom = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f, fill = false),
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_arrow_left),
                            contentDescription = "Back",
                            tint = Color.Unspecified,
                            modifier = Modifier
                                .size(24.dp)
                                .clickable(onClick = onBack),
                        )
                        Text(
                            display,
                            fontFamily = Inter,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp,
                            color = GotchaColors.Ink,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }

                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            ReviewLangChip(src)
                            MasteryDotsRow(masteryDots(item))
                        }
                        Text(
                            display,
                            fontFamily = Inter,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 26.sp,
                            color = GotchaColors.Ink,
                        )
                        if (translation != null) {
                            HorizontalDivider(color = GotchaColors.Border)
                            if (target.isNotBlank()) {
                                TranslationLine(target, translation)
                            } else {
                                Text(
                                    translation,
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = GotchaColors.Ink,
                                )
                            }
                        }
                    }

                    if (ctx != null) {
                        Column(
                            Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            SectionLabel("EXAMPLES")
                            ExampleCard(ctx)
                        }
                    }

                    if (foundTitle != null || addedLabel != null) {
                        Column(
                            Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            SectionLabel("FOUND IN")
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier
                                        .width(36.dp)
                                        .height(48.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(
                                            Brush.linearGradient(
                                                colors = listOf(Color(0xFF7F22FE), Color(0xFF432DD7)),
                                            ),
                                        ),
                                )
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        foundTitle ?: "Saved word",
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = GotchaColors.Ink,
                                    )
                                    if (addedLabel != null) {
                                        Text(
                                            addedLabel,
                                            fontFamily = Inter,
                                            fontWeight = FontWeight.Normal,
                                            fontSize = 11.sp,
                                            color = GotchaColors.TextSubtle,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        StatLine("Times reviewed", timesReviewed)
                        StatLine("Last reviewed", lastReviewed)
                        StatLine("Next review", nextReview, valueColor = GotchaColors.BrandPurpleMid)
                    }

                    Text(
                        "Delete Word",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .clickable {
                                val id = item?.id
                                if (id != null) {
                                    scope.launch {
                                        runCatching { container.vocabRepository.delete(id) }
                                        onBack()
                                    }
                                } else onBack()
                            },
                        textAlign = TextAlign.Center,
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = GotchaColors.Danger,
                    )
                    Spacer(Modifier.height(deleteClearance))
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        fontFamily = Inter,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        color = GotchaColors.TextMuted,
    )
}

@Composable
private fun DetailTranslationChip(code: String) {
    val upper = code.uppercase(Locale.ROOT)
    val (bg, fg) = when (upper) {
        "UZ" -> GotchaColors.SuccessBg to GotchaColors.SuccessText
        "EN" -> GotchaColors.InfoBg to GotchaColors.InfoText
        else -> GotchaColors.BrandPurpleTint to GotchaColors.BrandPurpleMid
    }
    Box(
        Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .padding(horizontal = 4.dp, vertical = 1.dp),
    ) {
        Text(
            upper,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            color = fg,
        )
    }
}

@Composable
private fun TranslationLine(code: String, value: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        DetailTranslationChip(code)
        Text(
            value,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            color = GotchaColors.Ink,
        )
    }
}

@Composable
private fun ExampleCard(src: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Text(
            src,
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            color = GotchaColors.Ink,
        )
    }
}

@Composable
private fun StatLine(label: String, value: String, valueColor: Color = GotchaColors.Ink) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            label,
            fontFamily = Inter,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            color = GotchaColors.TextMuted,
        )
        Text(
            value,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = valueColor,
        )
    }
}

/** Filter sheet — Apply returns criteria; SOURCE uses real content titles only. */
@Composable
fun VocabularyFilterScreen(
    initial: VocabFilterCriteria = VocabFilterCriteria(),
    sourceTitles: List<String> = emptyList(),
    onBack: () -> Unit,
    onApply: (VocabFilterCriteria) -> Unit,
) {
    var language by remember(initial) { mutableStateOf(initial.language) }
    var mastery by remember(initial) { mutableStateOf(initial.mastery) }
    var sortBy by remember(initial) { mutableStateOf(initial.sortBy) }
    var source by remember(initial) { mutableStateOf(initial.sourceTitle) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0x66101828))
            .clickable(onClick = onBack),
    ) {
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .background(Color.White)
                .clickable(enabled = false) {}
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(top = 8.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .width(36.dp)
                        .height(5.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(GotchaColors.Border),
                )
            }
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Filter Vocabulary",
                    fontFamily = Inter,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    "Reset",
                    modifier = Modifier.clickable {
                        language = "All"
                        mastery = "All levels"
                        sortBy = "Recently added"
                        source = "All sources"
                    },
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = GotchaColors.TextSubtle,
                )
            }

            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                FilterSection("LANGUAGE") {
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf(
                            "All" to "All",
                            "ru" to "🇷🇺 Russian",
                            "en" to "🇬🇧 English",
                            "uz" to "🇺🇿 Uzbek",
                        ).forEach { (key, label) ->
                            FilterPill(
                                text = label,
                                selected = language.equals(key, ignoreCase = true) ||
                                    (language == "All" && key == "All"),
                                onClick = { language = key },
                            )
                        }
                    }
                }
                FilterSection("MASTERY LEVEL") {
                    val levels = listOf(
                        "New (1)",
                        "Learning (2-3)",
                        "Familiar (4)",
                        "Mastered (5)",
                        "All levels",
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            levels.take(3).forEach { label ->
                                FilterPill(label, mastery == label) { mastery = label }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            levels.drop(3).forEach { label ->
                                FilterPill(label, mastery == label) { mastery = label }
                            }
                        }
                    }
                }
                FilterSection("SORT BY") {
                    listOf(
                        "Recently added",
                        "Alphabetical",
                        "Mastery level",
                        "Most reviewed",
                        "Due for review first",
                    ).forEach { label ->
                        RadioRow(label, sortBy == label) { sortBy = label }
                    }
                }
                val titles = sourceTitles.filter { it.isNotBlank() }.distinct().sorted()
                if (titles.isNotEmpty()) {
                    FilterSection("SOURCE") {
                        (listOf("All sources") + titles).forEach { label ->
                            CheckboxRow(
                                label,
                                source == label || (label == "All sources" && source == "All sources"),
                            ) {
                                source = label
                            }
                        }
                    }
                }
            }

            Column(
                Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                GotchaPrimaryButton(
                    text = "Apply Filters",
                    onClick = {
                        onApply(
                            VocabFilterCriteria(
                                language = language,
                                mastery = mastery,
                                sortBy = sortBy,
                                sourceTitle = source,
                            ),
                        )
                    },
                    containerColor = GotchaColors.BrandPurpleMid,
                    shapeRadius = 14,
                )
                Text(
                    "Show filtered words",
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = GotchaColors.TextSubtle,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun FilterSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            title,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = GotchaColors.TextMuted,
        )
        content()
    }
}

@Composable
private fun FilterPill(text: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) GotchaColors.BrandPurpleMid else GotchaColors.Surface)
            .then(
                if (selected) Modifier else Modifier.border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp)),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        fontFamily = Inter,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
        fontSize = 13.sp,
        color = if (selected) Color.White else GotchaColors.TextMuted,
    )
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
        Box(
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .border(2.dp, if (selected) GotchaColors.BrandPurpleMid else GotchaColors.Border, CircleShape)
                .padding(3.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(GotchaColors.BrandPurpleMid))
            }
        }
    }
}

@Composable
private fun CheckboxRow(label: String, checked: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(18.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(if (checked) GotchaColors.BrandPurpleMid else Color.White)
                .border(1.dp, if (checked) GotchaColors.BrandPurpleMid else GotchaColors.Border, RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) {
                Text("✓", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
        Text(
            label,
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = GotchaColors.Ink,
            modifier = Modifier.weight(1f),
        )
    }
}
