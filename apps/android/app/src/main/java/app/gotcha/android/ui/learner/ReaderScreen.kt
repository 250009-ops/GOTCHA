package app.gotcha.android.ui.learner

import app.gotcha.android.BuildConfig
import app.gotcha.android.util.uiString
import app.gotcha.android.util.uiPlural
import app.gotcha.android.ui.theme.GotchaBlue
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import android.speech.tts.TextToSpeech
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import app.gotcha.android.R
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
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
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.util.CloudPronouncer
import app.gotcha.android.util.ttsLanguageReady
import app.gotcha.android.util.ttsLocale
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
    GotchaSystemBars()
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val seededContent = remember(contentId) { container.contentRepository.contentMemory(contentId) }
    val seededSegments = remember(contentId) {
        container.contentRepository.segmentsMemory(contentId).orEmpty()
    }
    val readerCtx = androidx.compose.ui.platform.LocalContext.current
    var content by remember(contentId) { mutableStateOf(seededContent) }
    var segments by remember(contentId) { mutableStateOf(seededSegments) }
    var selected by remember(contentId) { mutableStateOf<String?>(null) }
    var selectedSentence by remember(contentId) { mutableStateOf<String?>(null) }
    var lookup by remember(contentId) { mutableStateOf<LookupResponse?>(null) }
    var lookingUp by remember(contentId) { mutableStateOf(false) }
    var lookupError by remember(contentId) { mutableStateOf<String?>(null) }
    var savedMsg by remember(contentId) { mutableStateOf<String?>(null) }
    var vocabMarkable by remember(contentId) { mutableStateOf(true) }
    var loadProgress by remember(contentId) { mutableIntStateOf(0) }
    var smoothProgress by remember(contentId) { mutableIntStateOf(0) }
    var loaderDone by remember(contentId) { mutableStateOf(false) }
    var isFetching by remember(contentId) { mutableStateOf(false) }
    var preparingText by remember(contentId) { mutableStateOf(false) }
    var preparedSource by remember(contentId) { mutableStateOf<String?>(null) }
    var preparedAnnotated by remember(contentId) { mutableStateOf<AnnotatedString?>(null) }
    var fetchError by remember(contentId) { mutableStateOf(false) }
    var reloadKey by remember(contentId) { mutableIntStateOf(0) }
    var payStep by remember(contentId) { mutableStateOf("price") }
    var paymentId by remember(contentId) { mutableStateOf<String?>(null) }
    var cardNumber by remember(contentId) { mutableStateOf("") }
    var cardExpiry by remember(contentId) { mutableStateOf("") }
    var otpCode by remember(contentId) { mutableStateOf("") }
    var maskedPhone by remember(contentId) { mutableStateOf<String?>(null) }
    var payLoading by remember(contentId) { mutableStateOf(false) }
    var payError by remember(contentId) { mutableStateOf<String?>(null) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    val navBottom = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 24.dp)
    val bodyScrollState = rememberScrollState()
    var lastProgressAtMs by remember(contentId) { mutableStateOf(0L) }
    var targetLang by remember(contentId) { mutableStateOf("en") }
    var showUnknownOnly by remember(contentId) { mutableStateOf(false) }
    var pageDraft by remember(contentId) { mutableStateOf("1") }
    var fontScale by remember(contentId) { mutableStateOf(1.0) }
    var readerTheme by remember(contentId) { mutableStateOf("light") }
    var wordStatuses by remember(contentId) { mutableStateOf<Map<String, String>>(emptyMap()) }
    var segmentIndex by remember(contentId) { mutableIntStateOf(0) }
    val context = LocalContext.current
    val ttsEngine = remember { arrayOfNulls<TextToSpeech>(1) }
    val cloudPronouncer = remember { CloudPronouncer() }
    DisposableEffect(Unit) {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) ttsEngine[0] = engine
        }
        onDispose {
            ttsEngine[0]?.stop()
            ttsEngine[0]?.shutdown()
            ttsEngine[0] = null
            cloudPronouncer.stop()
        }
    }

    suspend fun refreshInBackground(targetId: String) {
        try {
            val freshContent = container.contentRepository.getFetch(targetId).data
            if (targetId == contentId) content = freshContent
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Keep cached snapshot on background refresh failure.
        }
    }

    suspend fun applyPreparedPage(targetId: String, pageText: String) {
        val cacheKey = ReaderPageCache.key(targetId, pageText, wordStatuses, showUnknownOnly)
        val annotated = ReaderPageCache.get(cacheKey)
            ?: withContext(Dispatchers.Default) {
                buildTappableAnnotated(pageText, wordStatuses = wordStatuses, showUnknownOnly = showUnknownOnly)
            }.also { ReaderPageCache.put(cacheKey, it) }
        coroutineContext.ensureActive()
        if (targetId != contentId) return
        preparedSource = pageText
        preparedAnnotated = annotated
    }

    // UI-25: progress reflects real work only — no artificial per-tick / milestone delays.
    fun stepProgress(target: Int) {
        if (loadProgress < target) loadProgress = target
        if (smoothProgress < target) smoothProgress = target
    }

    fun finishLoader() {
        loadProgress = 100
        smoothProgress = 100
        loaderDone = true
    }

    /** Content + first page already warm (e.g. Telegram re-open). */
    suspend fun openWarmReader(
        targetId: String,
        warmContent: ContentItem,
        warmSegments: List<Segment>,
    ) {
        if (targetId != contentId) return
        content = warmContent
        segments = warmSegments
        segmentIndex = segmentIndex.coerceIn(0, warmSegments.lastIndex.coerceAtLeast(0))
        val pageText = warmSegments.getOrNull(segmentIndex)?.plainText.orEmpty()
            .ifBlank { readerBodyText(warmSegments, FIRST_PAGE_CHAR_LIMIT) }
        loadProgress = 75
        smoothProgress = 75
        if (pageText.isNotBlank()) {
            applyPreparedPage(targetId, pageText)
        }
        loadProgress = 92
        smoothProgress = 92
        lastProgressAtMs = System.currentTimeMillis()
        finishLoader()
    }

    LaunchedEffect(contentId, reloadKey) {
        val targetId = contentId
        loaderDone = false
        smoothProgress = 0
        loadProgress = 0
        isFetching = false
        preparingText = false
        fetchError = false
        stepProgress(8)

        runCatching {
            container.userRepository.mePeek()?.data?.let { me ->
                targetLang = me.nativeLanguage?.lowercase()?.ifBlank { "en" } ?: "en"
                fontScale = me.preferences?.readerFontScale ?: 1.0
                readerTheme = me.preferences?.readerTheme?.lowercase() ?: "light"
            }
        }

        val peekedContent = container.contentRepository.getPeek(targetId)?.data
        val memSegments = container.contentRepository.segmentsMemory(targetId).orEmpty()
        val peekedSegments = container.contentRepository.segmentsPeek(targetId)?.data?.segments.orEmpty()
        val warmSegments = when {
            memSegments.any { !it.plainText.isNullOrBlank() } -> memSegments
            peekedSegments.any { !it.plainText.isNullOrBlank() } -> peekedSegments
            else -> emptyList()
        }
        val warmOpen = peekedContent != null && warmSegments.isNotEmpty()

        if (!warmOpen) {
            runCatching {
                val me = container.userRepository.me()
                targetLang = me.nativeLanguage?.lowercase()?.ifBlank { "en" } ?: "en"
                fontScale = me.preferences?.readerFontScale ?: 1.0
                readerTheme = me.preferences?.readerTheme?.lowercase() ?: "light"
            }
            runCatching {
                wordStatuses = container.contentRepository.knownWords()
                    .associate { kw ->
                        kw.lemma.lowercase() to (kw.status?.lowercase()?.ifBlank { "known" } ?: "known")
                    }
            }
        } else {
            runCatching {
                wordStatuses = container.contentRepository.knownWords()
                    .associate { kw ->
                        kw.lemma.lowercase() to (kw.status?.lowercase()?.ifBlank { "known" } ?: "known")
                    }
            }
            stepProgress(25) // warm path: peekedContent is non-null here (nit: was an always-true check)
        }

        if (peekedContent?.needsCatalogPayment() == true) {
            if (targetId != contentId) return@LaunchedEffect
            content = peekedContent
            segments = emptyList()
            finishLoader()
            return@LaunchedEffect
        }

        val warmContent = peekedContent?.takeIf { warmOpen }
        if (warmContent != null) {
            openWarmReader(targetId, warmContent, warmSegments)
            refreshInBackground(targetId)
            return@LaunchedEffect
        }

        if (peekedContent != null) stepProgress(25)
        if (peekedSegments.isNotEmpty()) stepProgress(50)

        val bothCached = peekedContent != null && peekedSegments.isNotEmpty()
        if (bothCached) {
            if (targetId != contentId) return@LaunchedEffect
            content = peekedContent
            segments = peekedSegments
            segmentIndex = segmentIndex.coerceIn(0, peekedSegments.lastIndex)
            val pageText = peekedSegments.getOrNull(segmentIndex)?.plainText.orEmpty()
                .ifBlank { readerBodyText(peekedSegments, FIRST_PAGE_CHAR_LIMIT) }
            stepProgress(75)
            if (pageText.isNotBlank()) {
                applyPreparedPage(targetId, pageText)
            }
            stepProgress(92)
            lastProgressAtMs = System.currentTimeMillis()
            refreshInBackground(targetId)
            finishLoader()
            return@LaunchedEffect
        }

        isFetching = true
        stepProgress(15)
        try {
            val fetchedContent = peekedContent ?: container.contentRepository.getFetch(targetId).data
            if (targetId != contentId) return@LaunchedEffect
            content = fetchedContent
            stepProgress(35)
            if (fetchedContent.needsCatalogPayment()) {
                segments = emptyList()
                finishLoader()
                return@LaunchedEffect
            }

            val resumeIndex = fetchedContent.outline
                ?.indexOfFirst { it.id == fetchedContent.currentSegmentId }
                ?.takeIf { it >= 0 } ?: segmentIndex

            val fetchedSegments = if (peekedSegments.isNotEmpty() &&
                peekedSegments.any { !it.plainText.isNullOrBlank() }
            ) {
                peekedSegments
            } else {
                container.contentRepository.segmentsForReaderOpen(fetchedContent, resumeIndex)
            }
            if (targetId != contentId) return@LaunchedEffect
            segments = fetchedSegments
            segmentIndex = resumeIndex.coerceIn(0, fetchedSegments.lastIndex.coerceAtLeast(0))
            stepProgress(60)

            if (fetchedSegments.isEmpty()) {
                finishLoader()
                return@LaunchedEffect
            }

            segmentIndex = segmentIndex.coerceIn(0, fetchedSegments.lastIndex)
            preparingText = true
            val pageText = fetchedSegments.getOrNull(segmentIndex)?.plainText.orEmpty()
                .ifBlank { readerBodyText(fetchedSegments, FIRST_PAGE_CHAR_LIMIT) }
            stepProgress(85)
            if (pageText.isNotBlank()) {
                applyPreparedPage(targetId, pageText)
            }
            if (targetId != contentId) return@LaunchedEffect
            finishLoader()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            if (coroutineContext.isActive && targetId == contentId) {
                fetchError = true
                finishLoader()
            }
        } finally {
            if (coroutineContext.isActive && targetId == contentId) {
                isFetching = false
                preparingText = false
                lastProgressAtMs = System.currentTimeMillis()
            }
        }
    }

    LaunchedEffect(contentId, segmentIndex, segments, showUnknownOnly, wordStatuses) {
        if (content == null || segments.isEmpty()) return@LaunchedEffect
        val seg = segments.getOrNull(segmentIndex) ?: return@LaunchedEffect
        if (seg.plainText.isNullOrBlank()) {
            preparingText = true
            val loaded = runCatching {
                container.contentRepository.fetchSegmentBody(contentId, seg)
            }.getOrNull()
            if (loaded != null && loaded.plainText.isNullOrBlank().not()) {
                segments = segments.mapIndexed { i, s -> if (i == segmentIndex) loaded else s }
            }
            preparingText = false
            if (loaded?.plainText.isNullOrBlank()) return@LaunchedEffect
        }
        val pageText = segments.getOrNull(segmentIndex)?.plainText?.takeIf { it.isNotBlank() } ?: return@LaunchedEffect
        preparingText = true
        applyPreparedPage(contentId, pageText)
        preparingText = false
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
        val completed = markCompleted || scrollPct >= 97.0 || segmentIndex >= segments.lastIndex
        runCatching {
            container.contentRepository.updateProgress(
                id = contentId,
                pct = if (completed) 100.0 else ((segmentIndex + 1).toDouble() / segments.size.coerceAtLeast(1) * 100.0),
                segmentId = segments.getOrNull(segmentIndex)?.id,
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
    // UI-18: system Back first closes the word pop-up; only a second Back leaves the reader.
    // Declared after the reader handler so it takes precedence while enabled.
    BackHandler(enabled = selected != null) {
        selected = null
        lookup = null
        lookupError = null
        selectedSentence = null
    }

    LaunchedEffect(payStep) {
        if (payStep != "celebrate") return@LaunchedEffect
        delay(2200)
        reloadKey += 1
    }

    // Periodic autosave while actively reading, in addition to the on-exit save in handleBack —
    // covers the common case of the user backgrounding the app instead of tapping the back arrow.
    LaunchedEffect(contentId, segments) {
        if (segments.isEmpty()) return@LaunchedEffect
        while (true) {
            delay(20_000)
            sendProgress(markCompleted = false)
        }
    }

    val currentSegment = segments.getOrNull(segmentIndex)
    val currentPageText = currentSegment?.plainText?.takeIf { it.isNotBlank() }.orEmpty()
    val paymentRequired = content?.needsCatalogPayment() == true
    val readerReady = loaderDone && !paymentRequired && content != null && segments.isNotEmpty() &&
        currentPageText.isNotBlank() && preparedAnnotated != null
    val showGlassLoader = !paymentRequired && !fetchError && !loaderDone

    when {
        paymentRequired -> {
            val book = content!!
            // m1: Play build hides our list price (the Play sheet shows the real localized price).
            val amount = book.catalogPriceUzs()?.takeIf { BuildConfig.ATMOS_CHECKOUT_ENABLED }
            Box(Modifier.fillMaxSize().background(Color.White)) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        stringResource(R.string.reader_library),
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = GotchaColors.TextMuted,
                        modifier = Modifier.clickable(onClick = handleBack),
                    )
                    if (payStep == "celebrate") {
                        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Icon(
                                    painter = painterResource(R.drawable.ic_party_popper),
                                    contentDescription = null,
                                    tint = GotchaColors.BrandPurple,
                                    modifier = Modifier.size(48.dp),
                                )
                                Text(
                                    stringResource(R.string.reader_congrats),
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 24.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(
                                    stringResource(R.string.reader_book_yours, book.title?.takeIf { it.isNotBlank() } ?: stringResource(R.string.reader_this_book)),
                                    fontFamily = Inter,
                                    fontSize = 14.sp,
                                    color = GotchaColors.TextMuted,
                                )
                                GotchaPrimaryButton(
                                    text = stringResource(R.string.reader_start_reading),
                                    onClick = { reloadKey += 1 },
                                )
                            }
                        }
                    } else {
                    Text(
                        book.title?.takeIf { it.isNotBlank() } ?: stringResource(R.string.reader_paid_book),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = GotchaColors.Ink,
                    )
                    Text(
                        stringResource(R.string.reader_pay_once),
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextMuted,
                    )
                    if (amount != null) Text(
                        formatSom(amount),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = GotchaColors.BrandPurple,
                    )
                    if (payStep == "price") {
                        if (payError != null) {
                            Text(payError!!, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
                        }
                        GotchaPrimaryButton(
                            text = if (amount != null) uiString(R.string.reader_unlock_for, formatSom(amount)) else uiString(R.string.reader_unlock_book),
                            loading = payLoading,
                            onClick = {
                                scope.launch {
                                    payLoading = true
                                    payError = null
                                    try {
                                        val checkout = container.importRepository.catalogCheckout(contentId)
                                        if (checkout.accessGranted || checkout.step == "done") {
                                            payStep = "celebrate"
                                        } else {
                                            paymentId = checkout.paymentId
                                            // Atmos card checkout is web-only; the Play build never shows a card step.
                                            if (BuildConfig.ATMOS_CHECKOUT_ENABLED) payStep = "card" else payError = uiString(R.string.err_payment_start)
                                        }
                                    } catch (e: CancellationException) {
                                        throw e
                                    } catch (e: Exception) {
                                        payError = e.apiErrorMessage(readerCtx.getString(R.string.reader_checkout_failed))
                                    } finally {
                                        payLoading = false
                                    }
                                }
                            },
                        )
                    } else {
                        Unit // Card checkout removed: in-app purchases go through Google Play (ImportRepository.checkout)
                    }
                    }
                }
            }
        }
        readerReady -> {
            val hasSegments = segments.isNotEmpty()
            val body = preparedSource ?: currentPageText
            val pageAnnotated = preparedAnnotated!!
            val chapterTitle = (currentSegment?.chapterTitle?.takeIf { it.isNotBlank() }
                ?: currentSegment?.title?.substringBefore(" · ")?.takeIf { it.isNotBlank() })
                ?.let(::tidyChapterTitle)
            val chapterRes = androidx.compose.ui.platform.LocalContext.current.resources
            val bookTitle = content?.title?.takeIf { it.isNotBlank() } ?: stringResource(R.string.reader_untitled)
            // Honest API progress only — never invent a Figma % (same rule as Content Detail).
            val pageInChapter = remember(segments, segmentIndex, currentSegment) {
                val chapterIdx = currentSegment?.chapterIndex ?: segments.getOrNull(segmentIndex)?.chapterIndex ?: 0
                val chapterSegments = segments.withIndex().filter { (_, seg) -> seg.chapterIndex == chapterIdx }
                val pos = chapterSegments.indexOfFirst { it.index == segmentIndex }.coerceAtLeast(0)
                Pair(pos + 1, chapterSegments.size.coerceAtLeast(1))
            }
            val chapterGroups = remember(segments) {
                val groups = linkedMapOf<Int, Triple<Int, String, Int>>()
                segments.forEachIndexed { index, seg ->
                    val key = seg.chapterIndex
                    if (!groups.containsKey(key)) {
                        val title = (seg.chapterTitle?.takeIf { it.isNotBlank() }
                            ?: seg.title?.substringBefore(" · ")?.takeIf { it.isNotBlank() })
                            ?.let(::tidyChapterTitle)
                            ?: chapterRes.getString(R.string.reader_chapter_n, key + 1)
                        groups[key] = Triple(index, title, 1)
                    } else {
                        val current = groups.getValue(key)
                        groups[key] = Triple(current.first, current.second, current.third + 1)
                    }
                }
                groups.map { (key, triple) -> key to triple }
            }

            LaunchedEffect(pageInChapter.first) {
                pageDraft = pageInChapter.first.toString()
            }

            fun goToSegment(nextIndex: Int) {
                if (nextIndex !in segments.indices) return
                scope.launch { sendProgress(markCompleted = false) }
                segmentIndex = nextIndex
            }

            fun commitPageJump() {
                val raw = pageDraft.filter { it.isDigit() }.toIntOrNull() ?: pageInChapter.first
                val nextPage = raw.coerceIn(1, pageInChapter.second)
                pageDraft = nextPage.toString()
                val chapterIdx = currentSegment?.chapterIndex ?: segments.getOrNull(segmentIndex)?.chapterIndex ?: 0
                val chapterSegments = segments.withIndex().filter { (_, seg) -> seg.chapterIndex == chapterIdx }
                val target = chapterSegments.getOrNull(nextPage - 1)?.index ?: segmentIndex
                goToSegment(target)
            }
            val sourceLang = (content?.language ?: "RU").uppercase()
            val pageBg = when (readerTheme) {
                "sepia" -> Color(0xFFF4E8D0)
                "dark" -> Color(0xFF1C1917)
                else -> GotchaBlue.ReaderBg
            }
            val pageInk = when (readerTheme) {
                "sepia" -> Color(0xFF3D2B1F)
                "dark" -> Color(0xFFF5F5F4)
                else -> ReaderWordColors.bodyInk
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
                            .height(48.dp)
                            .background(Color.White)
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Row(
                            modifier = Modifier.clickable(onClick = handleBack),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ArrowBack,
                                contentDescription = stringResource(R.string.reader_library),
                                tint = Color(0xFF6A7282),
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                stringResource(R.string.reader_library),
                                fontFamily = Inter,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp,
                                color = Color(0xFF6A7282),
                            )
                        }
                        Box(Modifier.width(1.dp).height(16.dp).background(Color(0xFFE5E7EB)))
                        Text(
                            bookTitle,
                            modifier = Modifier.weight(1f),
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = Color(0xFF1E2939),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Icon(
                                Icons.Outlined.Remove,
                                contentDescription = stringResource(R.string.reader_zoom_out),
                                tint = Color(0xFF6A7282),
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable {
                                        val next = (fontScale - 0.1).coerceAtLeast(0.75)
                                        fontScale = kotlin.math.round(next * 10) / 10.0
                                        scope.launch {
                                            runCatching { container.userRepository.updatePreferences(readerFontScale = fontScale) }
                                        }
                                    }
                                    .padding(6.dp),
                            )
                            Text(
                                "${(fontScale * 100).toInt()}%",
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = Color(0xFF99A1AF),
                                modifier = Modifier.width(32.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                            Icon(
                                Icons.Outlined.Add,
                                contentDescription = stringResource(R.string.reader_zoom_in),
                                tint = Color(0xFF6A7282),
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable {
                                        val next = (fontScale + 0.1).coerceAtMost(1.5)
                                        fontScale = kotlin.math.round(next * 10) / 10.0
                                        scope.launch {
                                            runCatching { container.userRepository.updatePreferences(readerFontScale = fontScale) }
                                        }
                                    }
                                    .padding(6.dp),
                            )
                            Box(Modifier.width(1.dp).height(16.dp).background(Color(0xFFE5E7EB)).padding(horizontal = 4.dp))
                            Icon(
                                Icons.Outlined.Visibility,
                                contentDescription = stringResource(R.string.reader_unknown_only),
                                tint = if (showUnknownOnly) GotchaBlue.B700 else Color(0xFF6A7282),
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (showUnknownOnly) GotchaBlue.B50 else Color.Transparent)
                                    .clickable { showUnknownOnly = !showUnknownOnly }
                                    .padding(6.dp),
                            )
                            Box(Modifier.width(1.dp).height(16.dp).background(Color(0xFFE5E7EB)))
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable(enabled = hasSegments) {
                                        offline.guardClick {
                                            onOpenPractice(contentId, segments.firstOrNull()?.id)
                                        }()
                                    }
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.School,
                                    contentDescription = stringResource(R.string.reader_practice),
                                    tint = if (hasSegments) GotchaBlue.B700 else GotchaColors.TextSubtle,
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    }
                    HorizontalDivider(color = Color(0xFFE5E7EB), thickness = 1.dp)

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
                                Icons.AutoMirrored.Outlined.MenuBook,
                                contentDescription = null,
                                tint = GotchaColors.TextSubtle,
                                modifier = Modifier.size(40.dp),
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                stringResource(R.string.reader_no_text),
                                fontFamily = Inter,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Text(
                                uiString(R.string.reader_still_processing),
                                fontFamily = Inter,
                                fontSize = 13.sp,
                                color = GotchaColors.TextSubtle,
                            )
                        }
                    } else {
                    key(segmentIndex) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(bodyScrollState),
                    ) {
                        Row(
                            modifier = Modifier
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            chapterGroups.forEach { (key, triple) ->
                                val (firstIndex, title, pageCount) = triple
                                val active = segmentIndex >= firstIndex && segmentIndex < firstIndex + pageCount
                                Text(
                                    title,
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 12.sp,
                                    color = if (active) GotchaBlue.B700 else Color(0xFF4A5565),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(if (active) GotchaBlue.B50 else Color.White)
                                        .border(
                                            1.dp,
                                            if (active) GotchaColors.WebAccent else Color(0xFFE5E7EB),
                                            RoundedCornerShape(50),
                                        )
                                        .clickable { goToSegment(firstIndex) }
                                        .padding(horizontal = 12.dp, vertical = 6.dp),
                                )
                            }
                        }
                    Column(
                        modifier = Modifier
                            .padding(horizontal = 20.dp)
                            .padding(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        Text(
                            if (chapterGroups.size > 1) {
                                // UI-19: follow the visible segment's chapter key (groups need not be contiguous).
                                val currentKey = segments.getOrNull(segmentIndex)?.chapterIndex
                                val chapterNum = chapterGroups.indexOfFirst { (key, _) -> key == currentKey }
                                    .let { if (it >= 0) it + 1 else 1 }
                                stringResource(R.string.reader_chapter_of, chapterNum, chapterGroups.size)
                            } else {
                                stringResource(R.string.reader_page_of, segmentIndex + 1, segments.size)
                            },
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            letterSpacing = 1.2.sp,
                            color = GotchaBlue.B500,
                        )

                        Text(
                            chapterTitle ?: bookTitle,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.Bold,
                            fontSize = titleSize,
                            lineHeight = (titleSize.value + 8).sp,
                            color = pageInk,
                        )

                        TappableText(
                            text = body,
                            prepared = pageAnnotated,
                            selected = selected,
                            wordStatuses = wordStatuses,
                            showUnknownOnly = showUnknownOnly,
                            fontSize = bodySize,
                            textColor = pageInk,
                            onWordClick = { word, sentence ->
                                offline.guardClick {
                                    selected = word
                                    selectedSentence = sentence
                                    vocabMarkable = isReaderVocabMarkable(word)
                                    lookingUp = true
                                    lookup = null
                                    lookupError = null
                                    savedMsg = null
                                    scope.launch {
                                        try {
                                            val source = content?.language ?: "ru"
                                            val result = container.contentRepository.lookup(
                                                LookupRequest(
                                                    token = word.take(4000),
                                                    lemma = word.lowercase().take(4000),
                                                    sentence = sentence.take(4000),
                                                    sourceLang = source,
                                                    targetLang = targetLang,
                                                ),
                                            )
                                            lookup = result
                                            selected = readerActiveWord(word, result)
                                            vocabMarkable = isReaderVocabMarkable(word, result.kind)
                                        } catch (e: Exception) {
                                            lookupError = e.apiErrorMessage(readerCtx.getString(R.string.reader_lookup_failed))
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
                    }

                    // Footer navigation — matches web ReaderPage
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White)
                            .border(1.dp, Color(0xFFE5E7EB))
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                            .padding(bottom = navBottom),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                                    .clickable(enabled = segmentIndex > 0) { goToSegment(segmentIndex - 1) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.ChevronLeft,
                                    contentDescription = null,
                                    tint = if (segmentIndex > 0) Color(0xFF1E2939) else GotchaColors.TextSubtle,
                                    modifier = Modifier.size(16.dp),
                                )
                                Text(
                                    stringResource(R.string.reader_previous),
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 13.sp,
                                    color = if (segmentIndex > 0) Color(0xFF1E2939) else GotchaColors.TextSubtle,
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                BasicTextField(
                                    value = pageDraft,
                                    onValueChange = { pageDraft = it.filter { ch -> ch.isDigit() }.take(3) },
                                    singleLine = true,
                                    textStyle = TextStyle(
                                        fontFamily = Inter,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFF1E2939),
                                        textAlign = TextAlign.Center,
                                    ),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Number,
                                        imeAction = ImeAction.Done,
                                    ),
                                    keyboardActions = KeyboardActions(onDone = { commitPageJump() }),
                                    modifier = Modifier
                                        .width(48.dp)
                                        .height(32.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                                        .background(Color.White)
                                        .padding(horizontal = 4.dp, vertical = 6.dp),
                                )
                                Text(
                                    "/ ${pageInChapter.second}",
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = Color(0xFF99A1AF),
                                )
                            }

                            if (segmentIndex < segments.lastIndex) {
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(GotchaColors.BrandFill)
                                        .clickable { goToSegment(segmentIndex + 1) }
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Text(
                                        stringResource(R.string.reader_next),
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = Color.White,
                                    )
                                    Icon(
                                        Icons.Outlined.ChevronRight,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            } else {
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFF059669))
                                        .clickable {
                                            scope.launch {
                                                sendProgress(markCompleted = true)
                                                handleBack()
                                            }
                                        }
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Icon(
                                        Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp),
                                    )
                                    Text(
                                        stringResource(R.string.reader_finish),
                                        fontFamily = Inter,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = Color.White,
                                    )
                                }
                            }
                        }
                    }
                }

                }

                if (selected != null) {
                    DictionaryBottomSheet(
                        word = selected!!,
                        lookup = lookup,
                        loading = lookingUp,
                        savedMsg = savedMsg,
                        error = lookupError,
                        wordStatus = readerLemmaStatus(selected!!, wordStatuses),
                        onClose = { selected = null; lookup = null; lookupError = null; selectedSentence = null },
                        onSpeak = {
                            val spoken = lookup?.phrase?.takeIf { it.isNotBlank() }
                                ?: lookup?.lemma
                                ?: selected
                            if (!spoken.isNullOrBlank()) {
                                val lang = content?.language ?: "en"
                                scope.launch {
                                    try {
                                        if (ttsLanguageReady(ttsEngine[0], lang)) {
                                            ttsEngine[0]?.language = ttsLocale(lang)
                                            ttsEngine[0]?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, spoken)
                                        } else {
                                            val bytes = container.contentRepository.speech(spoken, lang)
                                            cloudPronouncer.playMp3(context, bytes)
                                        }
                                    } catch (_: Exception) {
                                        ttsEngine[0]?.language = ttsLocale(lang)
                                        ttsEngine[0]?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, spoken)
                                    }
                                }
                            }
                        },
                        showVocabActions = vocabMarkable,
                        onSave = offline.guardClick {
                            val l = lookup ?: return@guardClick
                            val activeWord = selected?.trim().orEmpty().ifBlank { return@guardClick }
                            scope.launch {
                                try {
                                    val source = content?.language ?: "ru"
                                    container.vocabRepository.save(
                                        SaveVocabularyRequest(
                                            lemma = activeWord,
                                            sourceLang = source,
                                            targetLang = targetLang,
                                            translation = l.translation ?: "",
                                            contextSentence = selectedSentence?.take(200)
                                                ?: segments.getOrNull(segmentIndex)?.plainText?.take(200),
                                            contextSegmentId = segments.getOrNull(segmentIndex)?.id,
                                            contentId = contentId,
                                        ),
                                    )
                                    wordStatuses = applyReaderWordStatus(wordStatuses, activeWord, lookup, "learning")
                                    savedMsg = readerCtx.getString(R.string.reader_saved_vocab)
                                } catch (e: Exception) {
                                    savedMsg = e.apiErrorMessage(readerCtx.getString(R.string.reader_save_failed))
                                }
                            }
                        },
                        onKnown = offline.guardClick {
                            val activeWord = selected?.trim().orEmpty().ifBlank { return@guardClick }
                            scope.launch {
                                try {
                                    val source = content?.language ?: "ru"
                                    container.contentRepository.markKnownWord(activeWord, source, "known")
                                    wordStatuses = applyReaderWordStatus(wordStatuses, activeWord, lookup, "known")
                                    savedMsg = readerCtx.getString(R.string.reader_marked_known)
                                } catch (e: Exception) {
                                    savedMsg = e.apiErrorMessage(readerCtx.getString(R.string.reader_update_failed))
                                }
                            }
                        },
                        onIgnore = offline.guardClick {
                            val activeWord = selected?.trim().orEmpty().ifBlank { return@guardClick }
                            scope.launch {
                                try {
                                    val source = content?.language ?: "ru"
                                    container.contentRepository.markKnownWord(activeWord, source, "ignored")
                                    wordStatuses = applyReaderWordStatus(wordStatuses, activeWord, lookup, "ignored")
                                    savedMsg = readerCtx.getString(R.string.reader_word_ignored)
                                } catch (e: Exception) {
                                    savedMsg = e.apiErrorMessage(readerCtx.getString(R.string.reader_update_failed))
                                }
                            }
                        },
                        modifier = Modifier.align(Alignment.BottomCenter),
                    )
                }
            }
        }
        showGlassLoader -> {
            GlassLoadingScreen(
                progress = smoothProgress.coerceIn(0, 100),
                title = stringResource(R.string.reader_loading_book),
                subtitle = when {
                    loadProgress < 30 -> stringResource(R.string.reader_loading_details)
                    loadProgress < 70 -> stringResource(R.string.reader_loading_chapters)
                    loadProgress < 95 -> stringResource(R.string.reader_loading_first_page)
                    else -> stringResource(R.string.reader_loading_almost)
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
                            stringResource(R.string.reader_no_text),
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                        Text(
                            uiString(R.string.reader_still_processing),
                            fontFamily = Inter,
                            fontSize = 13.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                }
            } else {
                OfflineEmptyState(
                    subtitle = stringResource(R.string.reader_offline_body),
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
    wordStatuses: Map<String, String> = emptyMap(),
    showUnknownOnly: Boolean = false,
    fontSize: androidx.compose.ui.unit.TextUnit = 16.sp,
    textColor: Color = GotchaColors.Ink,
    onWordClick: (word: String, sentence: String) -> Unit,
) {
    val display = remember(text) {
        if (text.length > FULL_BODY_CHAR_LIMIT) text.take(FULL_BODY_CHAR_LIMIT) + "…" else text
    }
    var dragRange by remember(display) { mutableStateOf<IntRange?>(null) }
    var annotated by remember(display) { mutableStateOf(prepared) }
    var layoutResult by remember { mutableStateOf<TextLayoutResult?>(null) }

    LaunchedEffect(display, selected, dragRange, showUnknownOnly, wordStatuses, prepared) {
        val built = if (selected == null && dragRange == null) {
            prepared
        } else {
            withContext(Dispatchers.Default) {
                buildTappableAnnotated(
                    text = display,
                    selected = selected,
                    wordStatuses = wordStatuses,
                    showUnknownOnly = showUnknownOnly,
                    highlightCharRange = dragRange,
                )
            }
        }
        if (isActive) annotated = built
    }

    fun offsetAt(pos: Offset): Int? {
        val layout = layoutResult ?: return null
        return layout.getOffsetForPosition(pos)
    }

    fun sentenceFor(span: String): String {
        if (span.length > 280) return span.take(4000)
        return display.lineSequence().firstOrNull { it.contains(span, ignoreCase = true) } ?: display.take(280)
    }

    fun wordsBetween(start: Int, end: Int): String {
        val lo = minOf(start, end)
        val hi = maxOf(start, end)
        return annotated.getStringAnnotations("word", lo, hi)
            .distinctBy { it.start }
            .sortedBy { it.start }
            .take(400)
            .joinToString(" ") { it.item }
    }

    Text(
        text = annotated,
        style = TextStyle(
            fontFamily = FontFamily.Serif,
            fontSize = fontSize,
            lineHeight = (fontSize.value * 1.9f).sp,
            color = textColor,
        ),
        onTextLayout = { layoutResult = it },
        modifier = Modifier.drawWithContent {
            drawContent()
            val layout = layoutResult ?: return@drawWithContent
            val underlineYInset = 1.dp.toPx()
            val underlineWidth = 1.6.dp.toPx()
            val dash = PathEffect.dashPathEffect(floatArrayOf(5f, 4f), 0f)
            annotated.getStringAnnotations("highlight", 0, annotated.length).forEach { ann ->
                val boxes = (ann.start until ann.end).mapNotNull { index ->
                    runCatching { layout.getBoundingBox(index) }.getOrNull()
                }
                if (boxes.isEmpty()) return@forEach
                val left = boxes.minOf { it.left }
                val right = boxes.maxOf { it.right }
                val bottom = boxes.maxOf { it.bottom } + underlineYInset
                when (ann.item) {
                    "unknown" -> drawLine(
                        color = ReaderWordColors.unknownUnderline,
                        start = Offset(left, bottom),
                        end = Offset(right, bottom),
                        strokeWidth = underlineWidth,
                        pathEffect = dash,
                    )
                    "learning" -> drawLine(
                        color = ReaderWordColors.learningUnderline,
                        start = Offset(left, bottom),
                        end = Offset(right, bottom),
                        strokeWidth = underlineWidth,
                    )
                }
            }
            annotated.getStringAnnotations("selected", 0, annotated.length).forEach { ann ->
                val boxes = (ann.start until ann.end).mapNotNull { index ->
                    runCatching { layout.getBoundingBox(index) }.getOrNull()
                }
                if (boxes.isEmpty()) return@forEach
                val left = boxes.minOf { it.left } - 1.dp.toPx()
                val top = boxes.minOf { it.top } - 1.dp.toPx()
                val right = boxes.maxOf { it.right } + 1.dp.toPx()
                val bottom = boxes.maxOf { it.bottom } + 1.dp.toPx()
                drawRoundRect(
                    color = ReaderWordColors.selectionRing,
                    topLeft = Offset(left, top),
                    size = androidx.compose.ui.geometry.Size(right - left, bottom - top),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx()),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx()),
                )
            }
        }.pointerInput(display) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val startOff = offsetAt(down.position) ?: return@awaitEachGesture
                val startWord = annotated.getStringAnnotations("word", startOff, startOff).firstOrNull()
                    ?: return@awaitEachGesture

                var endOff = startOff
                var dragged = false
                dragRange = startOff..startOff
                var lastPaintMs = 0L

                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (!change.pressed) break
                    val distance = (change.position - down.position).getDistance()
                    if (distance > 12f) dragged = true
                    endOff = offsetAt(change.position) ?: endOff
                    val lo = minOf(startOff, endOff)
                    val hi = maxOf(startOff, endOff)
                    val now = System.currentTimeMillis()
                    if (now - lastPaintMs >= 40) {
                        dragRange = lo..hi
                        lastPaintMs = now
                    }
                    change.consume()
                }

                dragRange = null
                if (dragged) {
                    val phrase = wordsBetween(startOff, endOff)
                    if (phrase.isNotBlank()) onWordClick(phrase, sentenceFor(phrase))
                } else {
                    onWordClick(startWord.item, sentenceFor(startWord.item))
                }
            }
        },
    )
}

@Composable
private fun DictionaryBottomSheet(
    word: String,
    lookup: LookupResponse?,
    loading: Boolean,
    savedMsg: String?,
    error: String?,
    wordStatus: String,
    onClose: () -> Unit,
    onSpeak: () -> Unit,
    showVocabActions: Boolean,
    onSave: () -> Unit,
    onKnown: () -> Unit,
    onIgnore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(16.dp, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .navigationBarsPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.reader_dictionary),
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                letterSpacing = 0.6.sp,
                color = Color(0xFF99A1AF),
            )
            Box(
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Close, contentDescription = stringResource(R.string.reader_close), tint = Color(0xFF99A1AF), modifier = Modifier.size(16.dp))
            }
        }
        HorizontalDivider(color = GotchaColors.Divider)

        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 520.dp)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (loading) {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CircularProgressIndicator(color = GotchaColors.WebAccent, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    Text(stringResource(R.string.reader_looking_up), fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF99A1AF))
                }
            } else if (error != null) {
                Text(error, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.DangerText)
            } else if (lookup != null) {
                val sentenceLike = lookup.kind == "sentence"
                val headline = if (sentenceLike) word else lookup.phrase?.takeIf { it.isNotBlank() } ?: lookup.lemma ?: word
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                headline,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = if (sentenceLike) 18.sp else 24.sp,
                                lineHeight = if (sentenceLike) 26.sp else 30.sp,
                                color = Color(0xFF101828),
                            )
                            if (sentenceLike || lookup.phrase?.isNotBlank() == true) {
                                Text(
                                    if (sentenceLike) stringResource(R.string.reader_sentence) else stringResource(R.string.reader_phrase),
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 10.sp,
                                    color = GotchaColors.WebAccent,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(GotchaBlue.B50)
                                        .padding(horizontal = 6.dp, vertical = 2.dp),
                                )
                            }
                        }
                        if (!sentenceLike && lookup.lemma?.isNotBlank() == true &&
                            lookup.phrase?.isNotBlank() == true &&
                            !lookup.lemma.equals(lookup.phrase, ignoreCase = true)
                        ) {
                            Text(lookup.lemma.orEmpty(), fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF6B7382))
                        }
                    }
                    Box(
                        Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onSpeak),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.VolumeUp, contentDescription = stringResource(R.string.reader_pronounce), tint = Color(0xFF99A1AF), modifier = Modifier.size(18.dp))
                    }
                }

                lookup.contextualMeaning?.takeIf { it.isNotBlank() && !sentenceLike }?.let { meaning ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(GotchaBlue.B50)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(stringResource(R.string.reader_natural_meaning), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.WebAccent)
                        Text(meaning, fontFamily = Inter, fontSize = 15.sp, lineHeight = 22.sp, color = GotchaColors.Ink)
                    }
                }

                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .then(
                            if (lookup.contextualMeaning?.isNotBlank() == true && !sentenceLike) {
                                Modifier.border(1.dp, Color(0xFFE5E8EB), RoundedCornerShape(12.dp)).background(Color(0xFFF9FAFB))
                            } else {
                                Modifier.background(GotchaBlue.B50)
                            },
                        )
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stringResource(R.string.reader_translation), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.WebAccent)
                    Text(
                        lookup.translation.orEmpty(),
                        fontFamily = Inter,
                        fontSize = 15.sp,
                        lineHeight = 22.sp,
                        color = Color(0xFF1E2939),
                    )
                }

                if (showVocabActions) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val statusColors = when (wordStatus) {
                            "known" -> Color(0xFFD1FAE5) to Color(0xFF047857)
                            "learning" -> GotchaBlue.LearningBg to GotchaBlue.LearningText
                            "ignored" -> Color(0xFFF3F4F6) to Color(0xFF6B7280)
                            else -> Color(0xFFFFFBEB) to Color(0xFFBB4D00)
                        }
                        Text(
                            wordStatus.replaceFirstChar { it.uppercase() },
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            color = statusColors.second,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(statusColors.first)
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                        Text(uiString(R.string.reader_mark_as), fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DictionaryActionButton(
                            label = stringResource(R.string.reader_save),
                            icon = Icons.Outlined.BookmarkBorder,
                            active = wordStatus == "learning",
                            activeBorder = GotchaBlue.B400,
                            activeBg = GotchaBlue.LearningBg,
                            activeColor = GotchaBlue.LearningText,
                            enabled = wordStatus != "learning",
                            onClick = onSave,
                            modifier = Modifier.weight(1f),
                        )
                        DictionaryActionButton(
                            label = stringResource(R.string.reader_known),
                            icon = Icons.Outlined.Check,
                            active = wordStatus == "known",
                            activeBorder = GotchaColors.SuccessText,
                            activeBg = Color(0xFFD1FAE5),
                            activeColor = Color(0xFF059669),
                            enabled = wordStatus != "known",
                            onClick = onKnown,
                            modifier = Modifier.weight(1f),
                        )
                        DictionaryActionButton(
                            label = stringResource(R.string.reader_ignore),
                            icon = Icons.Outlined.VisibilityOff,
                            active = wordStatus == "ignored",
                            activeBorder = GotchaColors.TextSubtle,
                            activeBg = Color(0xFFF3F4F6),
                            activeColor = Color(0xFF6B7280),
                            enabled = wordStatus != "ignored",
                            onClick = onIgnore,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            savedMsg?.let {
                Text(it, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.SuccessText)
            }
        }
    }
}

@Composable
private fun DictionaryActionButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    activeBorder: Color,
    activeBg: Color,
    activeColor: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .border(
                1.dp,
                if (active) activeBorder else Color(0xFFE5E7EB),
                RoundedCornerShape(12.dp),
            )
            .background(if (active) activeBg else Color.White)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (active) activeColor else if (enabled) Color(0xFF4A5565) else Color(0xFFD1D5DB),
            modifier = Modifier.size(16.dp),
        )
        Text(
            label,
            fontFamily = Inter,
            fontWeight = FontWeight.Medium,
            fontSize = 12.sp,
            color = if (active) activeColor else if (enabled) Color(0xFF4A5565) else Color(0xFFD1D5DB),
        )
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

private object ReaderWordColors {
    val bodyInk = Color(0xFF1E2939)
    val unknownText = Color(0xFF973C00)
    val unknownUnderline = Color(0xFFFFB900)
    val learningText = Color(0xFF193CB8)
    val learningUnderline = Color(0xFF51A2FF)
    val ignoredText = Color(0xFF9CA3AF)
    val selectionBg = GotchaBlue.B50
    val selectionRing = Color(0x998E51FF)
    val dragHighlightBg = GotchaBlue.B50
    val dragHighlightText = GotchaBlue.B500
}

private fun readerHighlightStatus(status: String, showUnknownOnly: Boolean): String? {
    if (showUnknownOnly) return if (status == "unknown") "unknown" else null
    return when (status) {
        "unknown", "learning", "ignored" -> status
        else -> null
    }
}

private fun readerWordTextStyle(highlightStatus: String?): SpanStyle? = when (highlightStatus) {
    "unknown" -> SpanStyle(color = ReaderWordColors.unknownText)
    "learning" -> SpanStyle(color = ReaderWordColors.learningText)
    "ignored" -> SpanStyle(color = ReaderWordColors.ignoredText)
    else -> null
}

private fun phraseParts(selected: String?): List<String> {
    if (selected.isNullOrBlank()) return emptyList()
    return selected.split(Regex("[\\s-]+")).map { raw ->
        raw.trim().trim { ch -> ch in ".,!?;:\"'()[]«»—–-" }.lowercase()
    }.filter { it.isNotEmpty() }
}

private fun readerLemmaStatus(lemma: String, statuses: Map<String, String>): String =
    statuses[lemma.lowercase()] ?: "unknown"

private fun readerStatusKeys(activeWord: String, lookup: LookupResponse?): Set<String> = buildSet {
    add(activeWord.trim().lowercase())
    lookup?.lemma?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let { add(it) }
    phraseParts(activeWord).forEach { add(it) }
    lookup?.phrase?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let { phrase ->
        add(phrase)
        phraseParts(phrase).forEach { add(it) }
    }
}

private fun applyReaderWordStatus(
    current: Map<String, String>,
    activeWord: String,
    lookup: LookupResponse?,
    status: String,
): Map<String, String> = current + readerStatusKeys(activeWord, lookup).associateWith { status }

private fun readerActiveWord(surface: String, lookup: LookupResponse?): String {
    if (lookup?.kind == "sentence") return surface
    return lookup?.phrase?.trim()?.takeIf { it.isNotEmpty() }
        ?: lookup?.lemma?.trim()?.takeIf { it.isNotEmpty() }
        ?: surface
}

private fun isReaderSentenceLike(surface: String, sentence: String? = null): Boolean {
    val words = surface.trim().split(Regex("\\s+")).count { it.isNotBlank() }
    if (words <= 1) return false
    if (words > 8) return true
    if (Regex("[.!?…。！？]").containsMatchIn(surface) && words >= 3) return true
    val normalizedSurface = surface.trim().lowercase().replace(Regex("\\s+"), " ")
    val normalizedSentence = sentence?.trim()?.lowercase()?.replace(Regex("\\s+"), " ").orEmpty()
    if (normalizedSurface.length >= 12 &&
        (normalizedSurface == normalizedSentence ||
            (normalizedSentence.startsWith(normalizedSurface) && words >= 5))
    ) {
        return true
    }
    return false
}

private fun isReaderVocabMarkable(surface: String, kind: String? = null): Boolean {
    if (kind == "sentence") return false
    if (isReaderSentenceLike(surface)) return false
    return phraseParts(surface).size <= 1
}

private fun buildTappableAnnotated(
    text: String,
    selected: String? = null,
    wordStatuses: Map<String, String> = emptyMap(),
    showUnknownOnly: Boolean = false,
    highlightCharRange: IntRange? = null,
): AnnotatedString {
    val tokens = Regex("""\S+|\s+""").findAll(text).toList()
    val wordIndexes = mutableListOf<Int>()
    val cleans = mutableListOf<String>()
    tokens.forEachIndexed { index, match ->
        val token = match.value
        val clean = token.trim().trim { ch -> ch in ".,!?;:\"'()[]«»—–-" }
        if (clean.isNotEmpty() && token.any { it.isLetter() }) {
            wordIndexes.add(index)
            cleans.add(clean.lowercase())
        }
    }
    val parts = phraseParts(selected)
    val selectedTokenIndexes = hashSetOf<Int>()
    if (parts.size == 1) {
        wordIndexes.forEachIndexed { i, tokIndex ->
            if (cleans[i] == parts[0]) selectedTokenIndexes.add(tokIndex)
        }
    } else if (parts.size >= 2) {
        for (i in 0..cleans.size - parts.size) {
            if (cleans.subList(i, i + parts.size) == parts) {
                repeat(parts.size) { k -> selectedTokenIndexes.add(wordIndexes[i + k]) }
            }
        }
        val closed = parts.joinToString("")
        if (closed.length >= 6 && selectedTokenIndexes.isEmpty()) {
            for (n in 2..minOf(3, cleans.size)) {
                for (i in 0..cleans.size - n) {
                    if (cleans.subList(i, i + n).joinToString("") == closed) {
                        repeat(n) { k -> selectedTokenIndexes.add(wordIndexes[i + k]) }
                    }
                }
            }
        }
    }
    return buildAnnotatedString {
        tokens.forEachIndexed { index, match ->
            val token = match.value
            val clean = token.trim().trim { ch -> ch in ".,!?;:\"'()[]«»—–-" }
            val isWord = clean.isNotEmpty() && token.any { it.isLetter() }
            if (isWord) {
                val status = readerLemmaStatus(clean, wordStatuses)
                val highlightStatus = readerHighlightStatus(status, showUnknownOnly)
                val wordStyle = readerWordTextStyle(highlightStatus)
                val tokenRange = match.range
                val inDragHighlight = highlightCharRange?.let { range ->
                    tokenRange.first <= range.last && tokenRange.last >= range.first
                } == true
                val isSelected = selectedTokenIndexes.contains(index)
                val start = length
                pushStringAnnotation(tag = "word", annotation = clean)
                when {
                    isSelected -> {
                        if (wordStyle != null) {
                            withStyle(SpanStyle(background = ReaderWordColors.selectionBg, color = wordStyle.color)) {
                                append(token)
                            }
                        } else {
                            withStyle(SpanStyle(background = ReaderWordColors.selectionBg)) {
                                append(token)
                            }
                        }
                    }
                    inDragHighlight -> {
                        withStyle(
                            SpanStyle(
                                background = ReaderWordColors.dragHighlightBg,
                                color = ReaderWordColors.dragHighlightText,
                            ),
                        ) { append(token) }
                    }
                    wordStyle != null -> withStyle(wordStyle) { append(token) }
                    else -> append(token)
                }
                val end = length
                pop()
                if (highlightStatus != null && (highlightStatus == "unknown" || highlightStatus == "learning")) {
                    addStringAnnotation(tag = "highlight", annotation = highlightStatus, start = start, end = end)
                }
                if (isSelected) {
                    addStringAnnotation(tag = "selected", annotation = "1", start = start, end = end)
                }
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

    fun key(contentId: String, text: String, statuses: Map<String, String> = emptyMap(), showUnknownOnly: Boolean = false): String =
        "$contentId|${text.length}|${text.hashCode()}|${statuses.size}|${statuses.hashCode()}|$showUnknownOnly"

    fun get(key: String): AnnotatedString? = synchronized(lock) { map[key] }

    fun put(key: String, value: AnnotatedString) {
        synchronized(lock) { map[key] = value }
    }
}

/**
 * UI-19: collapse letter-spaced headings from PDF extraction ("L E I P Z I G" → "LEIPZIG",
 * "Chapter L E I P Z I G" → "LEIPZIG") so chips and headers stay readable for already-ingested books.
 */
internal fun tidyChapterTitle(raw: String): String {
    val spaced = Regex("""(?:\b\p{L}\s){3,}\p{L}\b""")
    var t = spaced.replace(raw.trim()) { m -> m.value.replace(Regex("""\s+"""), "") }
    // "Chapter LEIPZIG" (a place/heading, not a number) → keep the heading only.
    val m = Regex("""^(?i:chapter)\s+(\p{Lu}{4,})$""").find(t)
    if (m != null && !Regex("""^[IVXLCDM]+$""").matches(m.groupValues[1])) t = m.groupValues[1]
    return t
}
