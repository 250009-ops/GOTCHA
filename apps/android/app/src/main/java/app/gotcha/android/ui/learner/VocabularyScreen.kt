package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.InlineVocabularyListSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.components.LangChip
import app.gotcha.android.ui.components.StatCard
import app.gotcha.android.ui.components.StatCardSkeleton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import java.text.NumberFormat
import java.util.Locale

/** Words tab — Figma vocabulary-screen 23:60. Full-bleed under glass nav. */
@Composable
fun VocabularyScreen(
    filter: VocabFilterCriteria = VocabFilterCriteria(),
    onOpenWord: (String) -> Unit = {},
    onOpenReview: () -> Unit = {},
    onOpenFilter: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val bottomInset = LocalLearnerBottomInset.current
    val topInset = LocalLearnerTopInset.current
    var items by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var queue by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var reveal by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(reloadKey, filter.sortApiParam()) {
        val sort = filter.sortApiParam()
        loading = items.isEmpty()
        error = null
        if (items.isEmpty()) {
            container.vocabRepository.listPeek(sort)?.let { peek ->
                items = peek.data
                loading = false
            }
        }
        try {
            val vocabResult = container.vocabRepository.listFetch(sort)
            items = vocabResult.data
            queue = runCatching { container.vocabRepository.reviewQueue() }.getOrDefault(emptyList())
            val statsResult = runCatching { container.userRepository.statsFetch() }.getOrNull()
            stats = statsResult?.data ?: stats
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) {
                error = e.apiErrorMessage("Failed to load vocabulary")
            }
        } finally {
            loading = false
        }
    }

    when {
        error != null && items.isEmpty() && !loading -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val filtered = remember(items, filter, query) {
                applyVocabFilter(items, filter, query)
            }
            val listLoading = loading && items.isEmpty()
            val statsLoading = loading && stats == null
            // Daily Review card only from real due queue — never invent a path from the full list.
            val reviewWord = queue.firstOrNull()
            val reviewTotal = queue.size
            val langLabel = when (filter.language.lowercase(Locale.ROOT)) {
                "all", "" -> "All Languages"
                "ru" -> "Russian"
                "en" -> "English"
                "uz" -> "Uzbek"
                else -> filter.language.uppercase(Locale.ROOT)
            }
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface),
                contentPadding = PaddingValues(
                    top = topInset,
                    bottom = bottomInset + 24.dp,
                ),
            ) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .padding(top = 16.dp, bottom = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Vocabulary",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 28.sp,
                            color = GotchaColors.Ink,
                        )
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                                .background(Color.White)
                                .clickable(onClick = offline.guardClick(onOpenFilter))
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                langLabel,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Icon(
                                painter = painterResource(R.drawable.ic_chevron_down),
                                contentDescription = null,
                                tint = Color.Unspecified,
                                modifier = Modifier.size(14.dp),
                            )
                        }
                    }
                }

                item {
                    OfflineBannerIfNeeded(
                        connectivity = container.connectivityObserver,
                        hasCachedContent = items.isNotEmpty() || stats != null,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                    )
                }

                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (statsLoading) {
                            StatCardSkeleton(Modifier.weight(1f))
                            StatCardSkeleton(Modifier.weight(1f))
                        } else {
                            val learned = stats?.vocabularyTotal ?: items.size
                            StatCard(
                                "Words learned",
                                NumberFormat.getNumberInstance(Locale.US).format(learned),
                                GotchaColors.BrandPurple,
                                Modifier.weight(1f),
                            )
                            StatCard(
                                "Due for review",
                                "${stats?.vocabularyDue ?: queue.size} words",
                                GotchaColors.Amber,
                                Modifier.weight(1f),
                            )
                        }
                    }
                }

                item {
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        textStyle = TextStyle(
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = GotchaColors.Ink,
                        ),
                        cursorBrush = SolidColor(GotchaColors.BrandPurpleMid),
                        modifier = Modifier
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 16.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        decorationBox = { inner ->
                            Box {
                                if (query.isEmpty()) {
                                    Text(
                                        "Search words…",
                                        fontFamily = Manrope,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 14.sp,
                                        color = GotchaColors.TextSubtle,
                                    )
                                }
                                inner()
                            }
                        },
                    )
                }

                if (reviewWord != null) {
                    item {
                        Box(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .padding(bottom = 20.dp)
                                .fillMaxWidth()
                                .height(190.dp)
                                .shadow(
                                    elevation = 8.dp,
                                    shape = RoundedCornerShape(20.dp),
                                    spotColor = Color(0x30432DD7),
                                    ambientColor = Color(0x30432DD7),
                                )
                                .clip(RoundedCornerShape(20.dp))
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(Color(0xFF7F22FE), Color(0xFF432DD7)),
                                        start = Offset(0f, 0f),
                                        end = Offset(900f, 520f),
                                    ),
                                )
                                .clickable(onClick = offline.guardClick {
                                    if (reveal) onOpenReview() else reveal = true
                                })
                                .padding(24.dp),
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.SpaceBetween,
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(
                                    "Daily Review • 1 of $reviewTotal".uppercase(Locale.US),
                                    modifier = Modifier.fillMaxWidth(),
                                    color = GotchaColors.BrandPurpleMuted,
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    letterSpacing = 1.sp,
                                    textAlign = TextAlign.Start,
                                )
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Text(
                                        if (reveal) {
                                            reviewWord.translation ?: reviewWord.lemma.orEmpty()
                                        } else {
                                            reviewWord.lemma.orEmpty()
                                        },
                                        color = Color.White,
                                        fontFamily = Manrope,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 32.sp,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                                Text(
                                    if (reveal) "Tap to open review" else "Tap to reveal definition",
                                    color = GotchaColors.BrandPurpleMuted,
                                    fontFamily = Manrope,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }
                }

                item {
                    Text(
                        if (query.isNotBlank() || !filter.isDefault()) "Words" else "Recently Added",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 12.dp),
                    )
                }

                if (listLoading) {
                    item {
                        InlineVocabularyListSkeleton(
                            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                        )
                    }
                } else if (filtered.isEmpty()) {
                    item {
                        Text(
                            if (items.isEmpty()) {
                                "No words yet — save words while reading"
                            } else {
                                "No words match this filter"
                            },
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = GotchaColors.TextSubtle,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp)
                                .padding(vertical = 24.dp),
                            textAlign = TextAlign.Center,
                        )
                    }
                } else {
                    items(filtered, key = { it.id }) { item ->
                        VocabRow(
                            item,
                            Modifier
                                .padding(horizontal = 24.dp)
                                .padding(bottom = 8.dp),
                            onClick = offline.guardClick {
                                item.lemma?.let(onOpenWord)
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun VocabRow(item: VocabItem, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    val filled = when {
        item.mastered -> 5
        (item.repetitions ?: 0) >= 4 -> 4
        (item.repetitions ?: 0) >= 3 -> 3
        (item.repetitions ?: 0) >= 1 -> 2
        else -> 1
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
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
                Text(
                    item.lemma ?: "",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    item.translation ?: "",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Normal,
                    color = GotchaColors.TextMuted,
                    fontSize = 13.sp,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(5) { index ->
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(
                            if (index < filled) GotchaColors.BrandPurple else GotchaColors.Border,
                        ),
                )
            }
        }
    }
}
