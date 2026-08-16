package app.gotcha.android.ui.learner

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import android.speech.tts.TextToSpeech
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import app.gotcha.android.R
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.LookupRequest
import app.gotcha.android.data.model.LookupResponse
import app.gotcha.android.data.model.SaveVocabularyRequest
import app.gotcha.android.data.model.Segment
import app.gotcha.android.ui.components.GlassLoadingScreen
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext

/** Figma 23:8 — reading-screen (mobile). */
@Composable
fun ReaderScreen(
    contentId: String,
    onBack: () -> Unit,
    onOpenPractice: (contentId: String, segmentId: String?) -> Unit = { _, _ -> },
) {
    GotchaSystemBars(darkIcons = true)
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val seededContent = remember(contentId) { container.contentRepository.contentMemory(contentId) }
    val seededSegments = remember(contentId) {
        container.contentRepository.segmentsMemory(contentId).orEmpty()
    }
    var content by remember(contentId) { mutableStateOf(seededContent) }
    var segments by remember(contentId) { mutableStateOf(seededSegments) }
    var selected by remember(contentId) { mutableStateOf<String?>(null) }
    var selectedSentence by remember(contentId) { mutableStateOf<String?>(null) }
    var lookup by remember(contentId) { mutableStateOf<LookupResponse?>(null) }
    var lookingUp by remember(contentId) { mutableStateOf(false) }
    var lookupError by remember(contentId) { mutableStateOf<String?>(null) }
    var savedMsg by remember(contentId) { mutableStateOf<String?>(null) }
    var loadProgress by remember(contentId) { mutableIntStateOf(if (seededContent != null) 30 else 0) }
    var isFetching by remember(contentId) { mutableStateOf(false) }
    var preparingText by remember(contentId) { mutableStateOf(false) }
    var preparedSource by remember(contentId) { mutableStateOf<String?>(null) }
    var preparedAnnotated by remember(contentId) { mutableStateOf<AnnotatedString?>(null) }
    var fetchError by remember(contentId) { mutableStateOf(false) }
    var reloadKey by remember(contentId) { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    val navBottom = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 24.dp)
    val bodyScrollState = rememberScrollState()
    var lastProgressAtMs by remember(contentId) { mutableStateOf(0L) }
    var targetLang by remember(contentId) { mutableStateOf("en") }
    var showKnownWords by remember(contentId) { mutableStateOf(false) }
    var fontScale by remember(contentId) { mutableStateOf(1.0) }
    var readerTheme by remember(contentId) { mutableStateOf("light") }
    var ttsEnabled by remember(contentId) { mutableStateOf(false) }
    var knownLemmas by remember(contentId) { mutableStateOf<Set<String>>(emptySet()) }
    val context = LocalContext.current
    val ttsEngine = remember { arrayOfNulls<TextToSpeech>(1) }
    DisposableEffect(Unit) {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) ttsEngine[0] = engine
        }
        onDispose {
            ttsEngine[0]?.stop()
            ttsEngine[0]?.shutdown()
            ttsEngine[0] = null
        }
    }

    suspend fun refreshInBackground(targetId: String) {
        try {
            val freshContent = container.contentRepository.getFetch(targetId).data
            if (targetId == contentId) content = freshContent
            val freshSegments = container.contentRepository.segmentsFetch(targetId).data.segments
            if (targetId == contentId) segments = freshSegments
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Keep cached snapshot on background refresh failure.
        }
    }

    suspend fun applyPreparedPage(targetId: String, pageText: String, selectedWord: String?) {
        val known = if (showKnownWords) knownLemmas else emptySet()
        val cacheKey = ReaderPageCache.key(targetId, pageText, known)
        val annotated = ReaderPageCache.get(cacheKey)
            ?: withContext(Dispatchers.Default) { buildTappableAnnotated(pageText, selectedWord, known) }
                .also { ReaderPageCache.put(cacheKey, it) }
        coroutineContext.ensureActive()
        if (targetId != contentId) return
        preparedSource = pageText
        preparedAnnotated = annotated
    }

    LaunchedEffect(contentId, reloadKey) {
        val targetId = contentId
        isFetching = false
        preparingText = false
        fetchError = false
        if (content == null) loadProgress = 10

        container.userRepository.mePeek()?.data?.let { me ->
            targetLang = me.nativeLanguage?.lowercase()?.ifBlank { "en" } ?: "en"
            showKnownWords = me.preferences?.showKnownWords == true
            fontScale = me.preferences?.readerFontScale ?: 1.0
            readerTheme = me.preferences?.readerTheme?.lowercase() ?: "light"
            ttsEnabled = me.preferences?.ttsEnabled == true
        }
        runCatching {
            val me = container.userRepository.me()
            targetLang = me.nativeLanguage?.lowercase()?.ifBlank { "en" } ?: "en"
            showKnownWords = me.preferences?.showKnownWords == true
            fontScale = me.preferences?.readerFontScale ?: 1.0
            readerTheme = me.preferences?.readerTheme?.lowercase() ?: "light"
            ttsEnabled = me.preferences?.ttsEnabled == true
        }
        runCatching {
            knownLemmas = container.contentRepository.knownWords()
                .filter { it.status.equals("known", ignoreCase = true) }
                .mapNotNull { it.lemma.lowercase().takeIf(String::isNotBlank) }
                .toSet()
        }

        val peekedContent = container.contentRepository.getPeek(targetId)?.data
        val peekedSegments = container.contentRepository.segmentsPeek(targetId)?.data?.segments.orEmpty()
        if (peekedContent != null) loadProgress = 30
        if (peekedSegments.isNotEmpty()) loadProgress = 70

        val bothCached = peekedContent != null && peekedSegments.isNotEmpty()
        if (bothCached) {
            val pageText = readerBodyText(peekedSegments, FIRST_PAGE_CHAR_LIMIT)
            applyPreparedPage(targetId, pageText, selected)
            if (targetId != contentId) return@LaunchedEffect
            content = peekedContent
            segments = peekedSegments
            loadProgress = 100
            lastProgressAtMs = System.currentTimeMillis()
            refreshInBackground(targetId)
            return@LaunchedEffect
        }

        isFetching = true
        loadProgress = maxOf(loadProgress, 10)
        try {
            val fetchedContent = peekedContent ?: container.contentRepository.getFetch(targetId).data
            if (targetId != contentId) return@LaunchedEffect
            content = fetchedContent
            loadProgress = 30

            val fetchedSegments = if (peekedSegments.isNotEmpty()) {
                peekedSegments
            } else {
                container.contentRepository.segmentsFetch(targetId).data.segments
            }
            if (targetId != contentId) return@LaunchedEffect
            segments = fetchedSegments
            loadProgress = 70

            if (fetchedSegments.isEmpty()) {
                loadProgress = 100
                return@LaunchedEffect
            }

            preparingText = true
            val pageText = readerBodyText(fetchedSegments, FIRST_PAGE_CHAR_LIMIT)
            loadProgress = 95
            applyPreparedPage(targetId, pageText, selected)
            if (targetId != contentId) return@LaunchedEffect
            loadProgress = 100
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            if (coroutineContext.isActive && targetId == contentId) fetchError = true
        } finally {
            if (coroutineContext.isActive && targetId == contentId) {
                isFetching = false
                preparingText = false
                lastProgressAtMs = System.currentTimeMillis()
            }
        }
    }

    // After the first page is on screen, tokenize the rest without blanking the body.
    LaunchedEffect(contentId, segments, preparedSource) {
        if (content == null || segments.isEmpty() || preparedAnnotated == null) return@LaunchedEffect
        val full = readerBodyText(segments, FULL_BODY_CHAR_LIMIT)
        if (full.isEmpty() || full == preparedSource) return@LaunchedEffect
        val known = if (showKnownWords) knownLemmas else emptySet()
        val cacheKey = ReaderPageCache.key(contentId, full, known)
        val built = ReaderPageCache.get(cacheKey)
            ?: withContext(Dispatchers.Default) { buildTappableAnnotated(full, selected, known) }
                .also { ReaderPageCache.put(cacheKey, it) }
        if (!isActive) return@LaunchedEffect
        preparedSource = full
        preparedAnnotated = built
    }

    // Reading progress + streak wiring — PUT content/{id}/progress with a real readSeconds is
    // what makes content.service.ts's streak.recordActivity fire (this endpoint was previously
    // never called at all from the reader, so opening/finishing a book never touched the streak).
    suspend fun sendProgress(markCompleted: Boolean) {
        if (segments.isEmpty()) return
        val now = System.currentTimeMillis()
        val elapsedSeconds = if (lastProgressAtMs == 0L) 0 else ((now - lastProgressAtMs) / 1000).toInt()
        lastProgressAtMs = now
        if (elapsedSeconds <= 0 && !markCompleted) return
        val scrollPct = if (bodyScrollState.maxValue > 0) {
            (bodyScrollState.value.toFloat() / bodyScrollState.maxValue.toFloat()) * 100.0
        } else {
            100.0
        }
        val completed = markCompleted || scrollPct >= 97.0
        runCatching {
            container.contentRepository.updateProgress(
                id = contentId,
                pct = if (completed) 100.0 else scrollPct,
                segmentId = segments.firstOrNull()?.id,
                readSeconds = elapsedSeconds.coerceAtLeast(0),
                completed = completed,
            )
        }
    }

    val handleBack: () -> Unit = {
        scope.launch { sendProgress(markCompleted = false) }
        onBack()
    }
    BackHandler(onBack = handleBack)

    // Periodic autosave while actively reading, in addition to the on-exit save in handleBack —
    // covers the common case of the user backgrounding the app instead of tapping the back arrow.
    LaunchedEffect(contentId, segments) {
        if (segments.isEmpty()) return@LaunchedEffect
        while (true) {
            delay(20_000)
            sendProgress(markCompleted = false)
        }
    }

    val readerReady = content != null && segments.isNotEmpty() && preparedAnnotated != null
    val showGlassLoader = !readerReady && !fetchError

    when {
        readerReady -> {
            val hasSegments = segments.isNotEmpty()
            val body = preparedSource ?: readerBodyText(segments, FIRST_PAGE_CHAR_LIMIT)
            val pageAnnotated = preparedAnnotated!!
            val chapterTitle = segments.firstOrNull()?.title?.takeIf { it.isNotBlank() }
            val bookTitle = content?.title?.takeIf { it.isNotBlank() } ?: "Untitled"
            // Honest API progress only — never invent a Figma % (same rule as Content Detail).
            val displayProgress = ((content?.progressPct ?: 0.0) / 100.0).toFloat().coerceIn(0f, 1f)
            val sourceLang = (content?.language ?: "RU").uppercase()
            val pageBg = when (readerTheme) {
                "sepia" -> Color(0xFFF4E8D0)
                "dark" -> Color(0xFF1C1917)
                else -> Color.White
            }
            val pageInk = when (readerTheme) {
                "sepia" -> Color(0xFF3D2B1F)
                "dark" -> Color(0xFFF5F5F4)
                else -> GotchaColors.Ink
            }
            val bodySize = (16 * fontScale).sp
            val titleSize = (20 * fontScale).sp

            Box(Modifier.fillMaxSize().background(pageBg)) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding(),
                ) {
                    // Toolbar — Figma 23:19
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(pageBg)
                            .border(width = 0.dp, color = Color.Transparent)
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
                                .clickable(onClick = handleBack),
                        )
                        Text(
                            bookTitle,
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 12.dp),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0xFFF3F4F6))
                                    .clickable(enabled = hasSegments) {
                                        offline.guardClick {
                                            onOpenPractice(contentId, segments.firstOrNull()?.id)
                                        }()
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Outlined.School,
                                    contentDescription = "Practice",
                                    tint = if (hasSegments) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0xFFF3F4F6)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Outlined.BookmarkBorder,
                                    contentDescription = "Bookmark",
                                    tint = GotchaColors.Ink,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(GotchaColors.BrandPurpleSoft)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            ) {
                                Text("AА", color = GotchaColors.BrandPurple, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                    HorizontalDivider(color = GotchaColors.Border, thickness = 1.dp)

                    OfflineBannerIfNeeded(
                        connectivity = container.connectivityObserver,
                        hasCachedContent = readerReady,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                    )

                    if (!hasSegments) {
                        Column(
                            modifier = Modifier.weight(1f).fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Icon(
                                Icons.Outlined.MenuBook,
                                contentDescription = null,
                                tint = GotchaColors.TextSubtle,
                                modifier = Modifier.size(40.dp),
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "This content has no readable text yet",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Text(
                                "It may still be processing — check back soon.",
                                fontFamily = Manrope,
                                fontSize = 13.sp,
                                color = GotchaColors.TextSubtle,
                            )
                        }
                    } else {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(bodyScrollState)
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(GotchaColors.BrandPurpleSoft)
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    sourceLang,
                                    color = GotchaColors.BrandPurple,
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(
                                "Chapter ${(segments.firstOrNull()?.segmentIndex ?: 0) + 1}",
                                color = GotchaColors.TextMuted,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                            )
                        }

                        Text(
                            chapterTitle ?: bookTitle,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = titleSize,
                            lineHeight = (titleSize.value + 8).sp,
                            color = pageInk,
                        )

                        TappableText(
                            text = body,
                            prepared = pageAnnotated,
                            selected = selected,
                            knownLemmas = if (showKnownWords) knownLemmas else emptySet(),
                            fontSize = bodySize,
                            textColor = pageInk,
                            onWordClick = { word, sentence ->
                                offline.guardClick {
                                    selected = word
                                    selectedSentence = sentence
                                    lookingUp = true
                                    lookup = null
                                    lookupError = null
                                    savedMsg = null
                                    scope.launch {
                                        try {
                                            val source = content?.language ?: "ru"
                                            lookup = container.contentRepository.lookup(
                                                LookupRequest(
                                                    token = word,
                                                    lemma = word.lowercase(),
                                                    sentence = sentence.take(500),
                                                    sourceLang = source,
                                                    targetLang = targetLang,
                                                ),
                                            )
                                        } catch (e: Exception) {
                                            lookupError = e.apiErrorMessage("Lookup failed. Try again.")
                                        } finally {
                                            lookingUp = false
                                        }
                                    }
                                }()
                            },
                        )

                        Spacer(Modifier.height(120.dp))
                    }
                    }

                    // Sticky progress — Figma 23:53
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White)
                            .padding(horizontal = 24.dp)
                            .padding(top = 12.dp, bottom = navBottom + 8.dp),
                    ) {
                        HorizontalDivider(color = GotchaColors.Border, thickness = 1.dp, modifier = Modifier.padding(bottom = 12.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                "Immersive Reading Mode",
                                color = GotchaColors.TextMuted,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                            )
                            Text(
                                "${(displayProgress * 100).toInt()}% completed",
                                color = GotchaColors.BrandPurple,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(GotchaColors.Border),
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth(displayProgress)
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(GotchaColors.BrandPurple),
                            )
                        }
                    }
                }

                if (selected != null) {
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 16.dp)
                            .padding(bottom = navBottom + 72.dp),
                    ) {
                        LookupCard(
                            word = selected!!,
                            lookup = lookup,
                            loading = lookingUp,
                            savedMsg = savedMsg,
                            contextSentence = selectedSentence,
                            error = lookupError,
                            ttsEnabled = ttsEnabled,
                            onSpeak = {
                                val spoken = lookup?.lemma ?: selected
                                if (!spoken.isNullOrBlank()) {
                                    ttsEngine[0]?.language = java.util.Locale.forLanguageTag(
                                        (content?.language ?: "en").replace('_', '-'),
                                    )
                                    ttsEngine[0]?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, spoken)
                                }
                            },
                            onDismiss = { selected = null; lookup = null; lookupError = null; selectedSentence = null },
                            onSave = offline.guardClick {
                                val l = lookup ?: return@guardClick
                                scope.launch {
                                    try {
                                        val lemma = (l.lemma ?: selected!!).lowercase()
                                        val source = content?.language ?: "ru"
                                        container.vocabRepository.save(
                                            SaveVocabularyRequest(
                                                lemma = lemma,
                                                sourceLang = source,
                                                targetLang = targetLang,
                                                translation = l.translation ?: "",
                                                contextSentence = selectedSentence?.take(200)
                                                    ?: segments.firstOrNull()?.plainText?.take(200),
                                                contextSegmentId = segments.firstOrNull()?.id,
                                                contentId = contentId,
                                            ),
                                        )
                                        runCatching {
                                            container.contentRepository.markKnownWord(lemma, source, "learning")
                                        }
                                        savedMsg = "Saved to vocabulary"
                                    } catch (e: Exception) {
                                        savedMsg = e.message ?: "Save failed"
                                    }
                                }
                            },
                        )
                    }
                }
            }
        }
        showGlassLoader -> {
            GlassLoadingScreen(
                progress = loadProgress.coerceAtLeast(10),
                title = "Loading your book…",
                subtitle = when {
                    loadProgress < 30 -> "Fetching book details"
                    loadProgress < 70 -> "Downloading chapters"
                    loadProgress < 95 -> "Preparing the first page"
                    else -> "Almost ready"
                },
                modifier = Modifier.fillMaxSize(),
            )
        }
        else -> {
            if (content != null && segments.isEmpty() && !fetchError) {
                Box(
                    Modifier.fillMaxSize().background(GotchaColors.Surface),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "This content has no readable text yet",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                        Text(
                            "It may still be processing — check back soon.",
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                }
            } else {
                OfflineEmptyState(
                    subtitle = "Connect to the internet to load this book, or open it once while online to save it for offline reading.",
                    onRetry = { reloadKey += 1 },
                )
            }
        }
    }
}

@Composable
private fun TappableText(
    text: String,
    prepared: AnnotatedString,
    selected: String?,
    knownLemmas: Set<String> = emptySet(),
    fontSize: androidx.compose.ui.unit.TextUnit = 16.sp,
    textColor: Color = GotchaColors.Ink,
    onWordClick: (word: String, sentence: String) -> Unit,
) {
    val display = remember(text) {
        if (text.length > FULL_BODY_CHAR_LIMIT) text.take(FULL_BODY_CHAR_LIMIT) + "…" else text
    }
    var annotated by remember(display) { mutableStateOf(prepared) }
    LaunchedEffect(prepared) {
        annotated = prepared
    }
    LaunchedEffect(display, selected) {
        if (selected == null) {
            annotated = prepared
            return@LaunchedEffect
        }
        val built = withContext(Dispatchers.Default) { buildTappableAnnotated(display, selected, knownLemmas) }
        if (!isActive) return@LaunchedEffect
        annotated = built
    }
    ClickableText(
        text = annotated,
        style = androidx.compose.ui.text.TextStyle(
            fontFamily = FontFamily.Serif,
            fontSize = fontSize,
            lineHeight = (fontSize.value * 1.75f).sp,
            color = textColor,
        ),
        onClick = { offset ->
            annotated.getStringAnnotations("word", offset, offset).firstOrNull()?.let { ann ->
                val sentence = display.lineSequence().firstOrNull { it.contains(ann.item) } ?: display.take(200)
                onWordClick(ann.item, sentence)
            }
        },
    )
}

@Composable
private fun LookupCard(
    word: String,
    lookup: LookupResponse?,
    loading: Boolean,
    savedMsg: String?,
    contextSentence: String?,
    error: String? = null,
    ttsEnabled: Boolean = false,
    onSpeak: () -> Unit = {},
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(10.dp, RoundedCornerShape(16.dp), spotColor = Color(0x266C2BD9))
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(2.dp, GotchaColors.BrandPurple, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    lookup?.lemma ?: word,
                    color = GotchaColors.BrandPurple,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 22.sp,
                )
                Text(
                    buildString {
                        val meta = listOfNotNull(lookup?.partOfSpeech, lookup?.grammarNote)
                            .joinToString(", ")
                        when {
                            meta.isNotBlank() -> append(meta)
                            loading -> append("Looking up…")
                            error != null -> append("Lookup failed")
                            else -> append("word")
                        }
                    },
                    color = GotchaColors.TextSubtle,
                    fontFamily = Manrope,
                    fontSize = 12.sp,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (ttsEnabled) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(GotchaColors.BrandPurpleSoft)
                            .clickable(onClick = onSpeak),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_volume),
                            contentDescription = "Speak",
                            tint = GotchaColors.BrandPurple,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF3F4F6))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Close, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(16.dp))
                }
            }
        }
        HorizontalDivider(color = GotchaColors.Border, thickness = 1.dp)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                when {
                    loading -> "Translating…"
                    error != null -> error
                    else -> lookup?.translation ?: "—"
                },
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = if (error != null) Color(0xFFDC2626) else GotchaColors.Ink,
            )
            if (!contextSentence.isNullOrBlank() && error == null) {
                Text(
                    "Context: '…${contextSentence.take(80)}…'",
                    color = GotchaColors.TextMuted,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
            }
            if (savedMsg != null) {
                Text(savedMsg, color = GotchaColors.SuccessText, fontFamily = Manrope, fontSize = 13.sp)
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(GotchaColors.BrandPurple)
                .clickable(enabled = !loading && lookup?.translation != null, onClick = onSave)
                .padding(vertical = 10.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Add, null, tint = Color.White, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(8.dp))
            Text("Add to vocabulary", color = Color.White, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

private const val FIRST_PAGE_CHAR_LIMIT = 3_500
private const val FULL_BODY_CHAR_LIMIT = 12_000

private fun readerBodyText(segments: List<Segment>, limit: Int): String {
    val joined = buildString {
        segments.forEachIndexed { index, segment ->
            if (index > 0) append("\n\n")
            append(segment.plainText.orEmpty())
            if (length >= limit) return@buildString
        }
    }
    return if (joined.length > limit) joined.take(limit) + "…" else joined
}

private fun buildTappableAnnotated(
    text: String,
    selected: String? = null,
    knownLemmas: Set<String> = emptySet(),
): AnnotatedString {
    return buildAnnotatedString {
        val regex = Regex("""\S+|\s+""")
        regex.findAll(text).forEach { match ->
            val token = match.value
            val clean = token.trim().trim { ch -> ch in ".,!?;:\"'()[]«»—–-" }
            val isWord = clean.isNotEmpty() && token.any { it.isLetter() }
            if (isWord) {
                pushStringAnnotation("word", clean)
                if (selected != null && clean == selected) {
                    withStyle(
                        SpanStyle(
                            fontWeight = FontWeight.Bold,
                            textDecoration = TextDecoration.Underline,
                            background = GotchaColors.BrandPurpleSoft,
                        ),
                    ) { append(token) }
                } else if (knownLemmas.contains(clean.lowercase())) {
                    withStyle(SpanStyle(color = GotchaColors.TextSubtle)) { append(token) }
                } else {
                    append(token)
                }
                pop()
            } else {
                append(token)
            }
        }
    }
}

private object ReaderPageCache {
    private const val MAX = 24
    private val lock = Any()
    private val map = object : LinkedHashMap<String, AnnotatedString>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, AnnotatedString>?): Boolean = size > MAX
    }

    fun key(contentId: String, text: String, known: Set<String> = emptySet()): String =
        "$contentId|${text.length}|${text.hashCode()}|${known.size}"

    fun get(key: String): AnnotatedString? = synchronized(lock) { map[key] }

    fun put(key: String, value: AnnotatedString) {
        synchronized(lock) { map[key] = value }
    }
}
