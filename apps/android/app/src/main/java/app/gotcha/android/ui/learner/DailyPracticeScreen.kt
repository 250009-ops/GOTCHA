package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaColors

import android.media.MediaPlayer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.DailyPracticeItem
import app.gotcha.android.data.model.PracticeAnswerRequest
import app.gotcha.android.data.model.PracticeAnswerResponse
import app.gotcha.android.data.model.PracticeCloze
import app.gotcha.android.data.model.PracticeHint
import app.gotcha.android.data.model.PracticeMistake
import app.gotcha.android.data.model.PracticeOverview
import app.gotcha.android.data.model.PracticeSummary
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.i18n.PracticeCopy
import app.gotcha.android.ui.i18n.practiceCopyFor
import app.gotcha.android.ui.theme.GotchaBlue
import app.gotcha.android.ui.theme.GotchaTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

/** Semantic practice colours (DESIGN-practice §2, tokens.css): light + dark. */
data class PracticePalette(
    val bg: Color, val card: Color, val card2: Color, val text: Color, val text2: Color, val text3: Color,
    val line: Color, val cta: Color, val accent: Color, val accentSoft: Color, val track: Color,
    val ok: Color, val okBg: Color, val bad: Color, val badBg: Color, val warn: Color, val warnBg: Color,
    val streak: Color, val streakBg: Color,
)

val PracticeLight = PracticePalette(
    bg = GotchaBlue.Canvas, card = Color.White, card2 = Color(0xFFF9FAFF), text = GotchaColors.Ink, text2 = GotchaColors.TextMuted,
    text3 = GotchaBlue.TextPlaceholder, line = GotchaColors.Border, cta = GotchaBlue.B700, accent = GotchaBlue.B700,
    accentSoft = GotchaBlue.B50, track = Color(0xFFE4E7F5), ok = GotchaColors.SuccessText, okBg = GotchaColors.SuccessBg,
    bad = Color(0xFFDC2626), badBg = GotchaColors.DangerBg, warn = GotchaColors.WarningText, warnBg = GotchaColors.WarningBg,
    streak = Color(0xFFC2410C), streakBg = Color(0xFFFFF7ED),
)

val PracticeDark = PracticePalette(
    bg = GotchaBlue.DarkBase, card = GotchaBlue.DarkCard, card2 = GotchaBlue.DarkRaised, text = GotchaBlue.DarkText,
    text2 = GotchaBlue.DarkText2, text3 = Color(0xFF8A8FA8), line = GotchaBlue.DarkBorder, cta = GotchaBlue.B500,
    accent = GotchaBlue.B300, accentSoft = Color(0x332107AA), track = Color(0xFF262A40), ok = Color(0xFF34D399),
    okBg = Color(0x1F10B981), bad = Color(0xFFF87171), badBg = Color(0x1FEF4444), warn = Color(0xFFFBBF24),
    warnBg = Color(0x1FF59E0B), streak = Color(0xFFFB923C), streakBg = Color(0x1FF97316),
)

/** system | light | dark (UserPreferences.appTheme, shared with web). */
@Composable
fun resolveDark(appTheme: String?): Boolean = when (appTheme) {
    "dark" -> true
    "light" -> false
    else -> isSystemInDarkTheme()
}

private enum class Stage { Hub, Play, Summary }

/** Daily mixed practice (FSRS): hub → player → summary. Matches team/design/practice-mobile-*.png. */
@Composable
fun DailyPracticeScreen(onBack: () -> Unit, onOpenLibrary: () -> Unit) {
    // UI-06 / UI-17: theme and copy follow the app-wide state (system or user choice), like every other screen.
    val dark = app.gotcha.android.ui.theme.GotchaThemeState.isDark
    val lang = app.gotcha.android.ui.theme.AppUiPrefs.language
    GotchaTheme(darkTheme = dark) {
        DailyPracticeContent(
            c = if (dark) PracticeDark else PracticeLight,
            t = remember(lang) { practiceCopyFor(lang) },
            onBack = onBack,
            onOpenLibrary = onOpenLibrary,
        )
    }
}

@Composable
private fun DailyPracticeContent(c: PracticePalette, t: PracticeCopy, onBack: () -> Unit, onOpenLibrary: () -> Unit) {
    val container = LocalAppContainer.current
    val repo = container.practiceRepository
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var stage by remember { mutableStateOf(Stage.Hub) }
    var overview by remember { mutableStateOf<PracticeOverview?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var size by remember { mutableStateOf(15) }
    var busy by remember { mutableStateOf(false) }
    var sessionId by remember { mutableStateOf<String?>(null) }
    val queue = remember { mutableStateListOf<DailyPracticeItem>() }
    var idx by remember { mutableStateOf(0) }
    var xpToday by remember { mutableStateOf(0) }
    var goal by remember { mutableStateOf(60) }
    var streak by remember { mutableStateOf(0) }
    var summary by remember { mutableStateOf<PracticeSummary?>(null) }
    var caughtUp by remember { mutableStateOf(false) }

    suspend fun loadOverview() {
        try {
            overview = repo.overview().also { xpToday = it.xpToday; goal = it.dailyGoalXp; streak = it.streakCount }
        } catch (e: CancellationException) { throw e } catch (e: Exception) { error = e.apiErrorMessage() }
    }
    LaunchedEffect(Unit) { loadOverview() }

    fun start(focus: List<String> = emptyList(), extra: Boolean = false) {
        scope.launch {
            busy = true; error = null
            try {
                val s = repo.daily(size, listening = true, focus = focus, extra = extra)
                if (s.sessionId == null || s.items.isEmpty()) {
                    caughtUp = s.caughtUp
                } else {
                    sessionId = s.sessionId; queue.clear(); queue.addAll(s.items); idx = 0; summary = null
                    stage = Stage.Play
                }
            } catch (e: CancellationException) { throw e } catch (e: Exception) { error = e.apiErrorMessage() } finally { busy = false }
        }
    }

    fun finish() {
        val id = sessionId ?: return
        scope.launch {
            try {
                summary = repo.complete(id).also { xpToday = it.xpToday; streak = it.streakCount }
            } catch (e: CancellationException) { throw e } catch (e: Exception) { error = e.apiErrorMessage() }
            stage = Stage.Summary
        }
    }

    Box(Modifier.fillMaxSize().background(c.bg).statusBarsPadding().navigationBarsPadding().imePadding()) {
        when (stage) {
            // UI-11: spinner while the first overview loads (was an empty hub).
            Stage.Hub -> if (overview == null && error == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    androidx.compose.material3.CircularProgressIndicator(color = c.accent, strokeWidth = 3.dp)
                }
            } else PracticeHub(
                c, t, overview, size, busy, caughtUp, error,
                onSize = { size = it },
                onStart = { start() },
                onExtra = { start(extra = true) },
                onGoal = { g -> scope.launch { runCatching { repo.setGoal(g) }; goal = g; loadOverview() } },
                onBack = onBack,
                onOpenLibrary = onOpenLibrary,
            )
            Stage.Play -> {
                val item = queue.getOrNull(idx)
                if (item == null) {
                    LaunchedEffect(Unit) { finish() }
                } else {
                    PracticePlayer(
                        c = c, t = t, item = item, sessionId = sessionId!!, progress = idx.toFloat() / queue.size.coerceAtLeast(1),
                        streak = streak,
                        onClose = { finish() },
                        onAudio = { vocabId ->
                            runCatching {
                                val bytes = repo.audio(vocabId)
                                val f = File.createTempFile("practice", ".mp3", context.cacheDir)
                                f.writeBytes(bytes)
                                MediaPlayer().apply {
                                    setDataSource(f.absolutePath)
                                    setOnCompletionListener { it.release(); f.delete() }
                                    prepare(); start()
                                }
                            }.isSuccess
                        },
                        answer = { req -> repo.answer(req) },
                        onResult = { res ->
                            xpToday = res.xpToday; goal = res.dailyGoalXp; streak = res.streakCount
                            if (res.requeue) {
                                // "Again": one more try 3 items later (server allows exactly one retry).
                                val at = (idx + 3).coerceAtMost(queue.size)
                                queue.add(at, item.copy(key = item.key + ":retry$idx"))
                            }
                        },
                        onNext = { idx += 1 },
                    )
                }
            }
            Stage.Summary -> PracticeSummaryView(
                c, t, summary, goal,
                onDone = { stage = Stage.Hub; scope.launch { loadOverview() } },
                onMistakes = { ids -> start(focus = ids) },
            )
        }
    }
}

// ------------------------------------------------------------------ hub

@Composable
private fun PracticeHub(
    c: PracticePalette, t: PracticeCopy, o: PracticeOverview?, size: Int, busy: Boolean, caughtUp: Boolean, error: String?,
    onSize: (Int) -> Unit, onStart: () -> Unit, onExtra: () -> Unit, onGoal: (Int) -> Unit, onBack: () -> Unit, onOpenLibrary: () -> Unit,
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBtn(Icons.Outlined.Close, "Close", c.text2, onBack)
            Spacer(Modifier.size(8.dp))
            BrandMark(size = 24)
            Spacer(Modifier.size(8.dp))
            Text(t.title, color = c.text, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
            o?.let { StreakChip(c, it.streakCount) }
        }
        Card(c) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                GoalRing(c, o?.xpToday ?: 0, o?.dailyGoalXp ?: 60, 84)
                Spacer(Modifier.size(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.subtitle, color = c.text2, fontSize = 13.sp)
                    Spacer(Modifier.size(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Pill(t.f(t.dueNow, o?.dueCount ?: 0), c.warn, c.warnBg)
                        Pill(t.f(t.newWords, o?.newCount ?: 0), c.text2, c.card2)
                    }
                }
            }
        }
        if (o != null && o.totalWords == 0) {
            Card(c) {
                Text(t.emptyTitle, color = c.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(t.emptyBody, color = c.text2, fontSize = 14.sp)
                Spacer(Modifier.size(10.dp))
                Cta(t.goToLibrary, c.cta, onOpenLibrary)
            }
            return@Column
        }
        Card(c) {
            Label(c, t.sessionLength)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(10 to t.short, 15 to t.normal, 25 to t.long).forEach { (n, label) ->
                    Choice(c, label, size == n, Modifier.weight(1f)) { onSize(n) }
                }
            }
            Spacer(Modifier.size(12.dp))
            if (caughtUp) {
                Text(t.allCaughtUp, color = c.text2, fontSize = 14.sp)
                Spacer(Modifier.size(8.dp))
                Cta(t.practiceExtra, c.cta, onExtra, enabled = !busy)
            } else {
                Cta(if (o?.practicedToday == true) t.continueSession else t.startSession, c.cta, onStart, enabled = !busy)
            }
            error?.let { Text(it, color = c.bad, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
        }
        Card(c) {
            Label(c, t.goalPicker)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(30, 60, 120, 200).forEach { g ->
                    Choice(c, t.goalNames[g.toString()] ?: "$g XP", (o?.dailyGoalXp ?: 60) == g, Modifier.weight(1f), small = true) { onGoal(g) }
                }
            }
            o?.forecast?.takeIf { it.isNotEmpty() }?.let { fc ->
                Spacer(Modifier.size(12.dp))
                Label(c, t.nextReview)
                val max = (fc.maxOf { it.count }).coerceAtLeast(1)
                Row(Modifier.fillMaxWidth().height(56.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                    fc.forEach { d ->
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(Modifier.fillMaxWidth().height((40f * d.count / max).coerceAtLeast(3f).dp).clip(RoundedCornerShape(4.dp)).background(c.accent))
                            Text("${d.count}", color = c.text3, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------------ player

@Composable
private fun PracticePlayer(
    c: PracticePalette, t: PracticeCopy, item: DailyPracticeItem, sessionId: String, progress: Float, streak: Int,
    onClose: () -> Unit, onAudio: suspend (String) -> Boolean,
    answer: suspend (PracticeAnswerRequest) -> PracticeAnswerResponse,
    onResult: (PracticeAnswerResponse) -> Unit, onNext: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var typed by remember(item.key) { mutableStateOf("") }
    var chosen by remember(item.key) { mutableStateOf<String?>(null) }
    var revealed by remember(item.key) { mutableStateOf(false) }
    var result by remember(item.key) { mutableStateOf<PracticeAnswerResponse?>(null) }
    var busy by remember(item.key) { mutableStateOf(false) }
    var err by remember(item.key) { mutableStateOf<String?>(null) }
    var hintShown by remember(item.key) { mutableStateOf(false) }
    val started = remember(item.key) { System.currentTimeMillis() }

    fun submit(ans: String? = null, self: String? = null) {
        if (busy || result != null) return
        scope.launch {
            busy = true; err = null
            try {
                val r = answer(
                    PracticeAnswerRequest(
                        answerId = UUID.randomUUID().toString(), sessionId = sessionId, vocabId = item.vocabId, type = item.type,
                        answer = ans, selfRating = self, responseMs = (System.currentTimeMillis() - started).toInt(), hintUsed = hintShown,
                    ),
                )
                onResult(r)
                if (item.type == "flashcard") onNext() else result = r
            } catch (e: CancellationException) { throw e } catch (e: Exception) { err = e.apiErrorMessage() } finally { busy = false }
        }
    }

    LaunchedEffect(item.key) {
        if (item.type == "listening_mcq" || item.type == "dictation") {
            if (!onAudio(item.vocabId)) {
                err = t.audioUnavailable
                onNext() // no audio → skip without penalty (stays due)
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBtn(Icons.Outlined.Close, t.endSession, c.text2, onClose)
            LinearProgressIndicator(
                progress = { progress }, color = c.cta, trackColor = c.track,
                modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)).padding(horizontal = 4.dp),
            )
            StreakChip(c, streak)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Pill(t.prompts[item.type] ?: t.typeNames[item.type] ?: item.type, c.accent, c.accentSoft)
            when (item.type) {
                "flashcard" -> Card(c) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(item.word.orEmpty(), color = c.text, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                        IconBtn(Icons.AutoMirrored.Outlined.VolumeUp, t.playAudio, c.accent) { scope.launch { onAudio(item.vocabId) } }
                        if (revealed) {
                            Text(item.translation.orEmpty(), color = c.text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                            item.context?.let { ContextLine(c, it, item.word.orEmpty()) }
                        }
                    }
                }
                "mcq_meaning", "cloze_mcq", "listening_mcq" -> {
                    if (item.type == "mcq_meaning") Text(item.word.orEmpty(), color = c.text, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    if (item.type == "cloze_mcq") item.cloze?.let { ClozeCard(c, it, null) }
                    if (item.type == "listening_mcq") Cta(t.replay, c.card2, { scope.launch { onAudio(item.vocabId) } }, textColor = c.accent)
                    item.options.orEmpty().forEachIndexed { i, opt ->
                        val r = result
                        val state = when {
                            r == null -> if (chosen == opt) 1 else 0
                            opt.equals(r.expected, true) || (item.type == "mcq_meaning" && opt == r.translation) -> 2
                            chosen == opt -> 3
                            else -> 4
                        }
                        OptionRow(c, i + 1, opt, state) { if (result == null) { chosen = opt; submit(ans = opt) } }
                    }
                }
                else -> { // typed_recall, cloze, dictation
                    if (item.type == "cloze") item.cloze?.let { ClozeCard(c, it, result?.expected) }
                    if (item.type == "typed_recall") Text(item.translation.orEmpty(), color = c.text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    if (item.type == "dictation") Cta(t.replay, c.card2, { scope.launch { onAudio(item.vocabId) } }, textColor = c.accent)
                    OutlinedTextField(
                        value = typed, onValueChange = { typed = it }, enabled = result == null && !busy, singleLine = true,
                        placeholder = { Text(t.typeHere) }, modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { if (typed.isNotBlank()) submit(ans = typed) }),
                    )
                    item.hint?.let { h ->
                        if (hintShown) Text("${h.firstLetter}… · ${h.length}", color = c.text2, fontSize = 13.sp)
                        else Text(t.hint, color = c.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { hintShown = true })
                    }
                    result?.takeIf { it.diff.isNotEmpty() && it.verdict == "almost" }?.let { r ->
                        Label(c, t.correctAnswerIs)
                        Text(buildAnnotatedString {
                            r.diff.forEach { p ->
                                when (p.op) {
                                    "add" -> withStyle(SpanStyle(color = c.ok, textDecoration = TextDecoration.Underline)) { append(p.text) }
                                    "del" -> Unit
                                    else -> append(p.text)
                                }
                            }
                        }, color = c.text, fontSize = 18.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
            err?.let { Text(it, color = c.bad, fontSize = 13.sp) }
        }
        // Bottom area: rating row (flashcard), feedback sheet, or Check / Skip.
        val r = result
        when {
            item.type == "flashcard" && !revealed -> BottomBar(c) { Cta(t.showAnswer, c.cta, { revealed = true }) }
            item.type == "flashcard" -> BottomBar(c) {
                Text(t.rateHow, color = c.text2, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("again" to t.again to c.bad, "hard" to t.hard to c.text, "good" to t.good to c.ok, "easy" to t.easy to c.accent)
                        .forEach { (p, color) -> RateBtn(c, p.second, color, Modifier.weight(1f)) { submit(self = p.first) } }
                }
            }
            r != null -> FeedbackSheet(c, t, r, onNext)
            item.options.isNullOrEmpty() -> BottomBar(c) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Cta(t.skip, c.card2, onNext, Modifier.weight(1f), textColor = c.text)
                    Cta(t.check, c.cta, { submit(ans = typed) }, Modifier.weight(1f), enabled = typed.isNotBlank() && !busy)
                }
            }
            else -> BottomBar(c) { Cta(t.skip, c.card2, onNext, textColor = c.text) }
        }
    }
}

@Composable
private fun FeedbackSheet(c: PracticePalette, t: PracticeCopy, r: PracticeAnswerResponse, onNext: () -> Unit) {
    val (fg, bg, title) = when (r.verdict) {
        "correct" -> Triple(c.ok, c.okBg, t.correct)
        "almost" -> Triple(c.warn, c.warnBg, t.almost)
        else -> Triple(c.bad, c.badBg, t.incorrect)
    }
    Column(Modifier.fillMaxWidth().background(bg).padding(16.dp).semantics { contentDescription = title }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = fg, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        if (r.verdict != "correct") Text("${t.correctAnswerIs}: ${r.expected}", color = c.text, fontSize = 14.sp)
        when (r.reason) {
            "typo" -> Text(t.typoNote, color = c.text2, fontSize = 13.sp)
            "diacritics" -> Text(t.accentNote, color = c.text2, fontSize = 13.sp)
            "uz_apostrophe" -> Text(t.uzApostropheNote, color = c.text2, fontSize = 13.sp)
            "real_word" -> Text(t.realWordNote, color = c.text2, fontSize = 13.sp)
        }
        if (r.xpGained > 0) Text("+${r.xpGained} XP", color = c.accent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        if (r.requeue) Text(t.willRetry, color = c.text2, fontSize = 12.sp)
        Cta(t.continueLabel(), if (r.verdict == "wrong") c.bad else if (r.verdict == "almost") c.cta else c.ok, onNext)
    }
}

private fun PracticeCopy.continueLabel() = this.`continue`

// ------------------------------------------------------------------ summary

@Composable
private fun PracticeSummaryView(c: PracticePalette, t: PracticeCopy, s: PracticeSummary?, goal: Int, onDone: () -> Unit, onMistakes: (List<String>) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.size(8.dp))
        GoalRing(c, s?.xpToday ?: 0, goal, 140)
        Text(if ((s?.xpToday ?: 0) >= goal) t.goalReached else t.summaryTitle, color = c.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        s?.let {
            if (it.streakCount > 0) Pill(t.f(t.streakDays, it.streakCount) + if (it.streakExtended) " · +1" else "", c.streak, c.streakBg)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stat(c, "${(it.accuracy * 100).toInt()}%", t.accuracy, Modifier.weight(1f))
                Stat(c, "+${it.xpEarned}", t.xpEarned, Modifier.weight(1f))
                Stat(c, "${it.answered}", t.wordsPracticed, Modifier.weight(1f))
            }
            if (it.mistakes.isNotEmpty()) Card(c) {
                Label(c, t.mistakesToReview)
                it.mistakes.forEach { m: PracticeMistake ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(m.word, color = c.text, fontWeight = FontWeight.SemiBold)
                            Text(m.translation, color = c.text2, fontSize = 13.sp)
                        }
                    }
                }
                Text(t.f(t.dueTomorrow, it.dueTomorrow), color = c.text3, fontSize = 12.sp)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val ids = s?.mistakes?.map { it.vocabId }.orEmpty()
            if (ids.isNotEmpty()) Cta(t.practiceMistakes, c.card2, { onMistakes(ids) }, Modifier.weight(1f), textColor = c.text)
            Cta(t.newSession, c.cta, onDone, Modifier.weight(1f))
        }
    }
}

// ------------------------------------------------------------------ atoms

@Composable
private fun Card(c: PracticePalette, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.card).border(1.dp, c.line, RoundedCornerShape(20.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) { content() }
}

@Composable
private fun Label(c: PracticePalette, s: String) =
    Text(s.uppercase(), color = c.text3, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)

@Composable
private fun Pill(s: String, fg: Color, bg: Color) =
    Text(s, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp))

@Composable
private fun StreakChip(c: PracticePalette, n: Int) = Row(
    Modifier.clip(RoundedCornerShape(999.dp)).background(c.streakBg).padding(horizontal = 8.dp, vertical = 4.dp),
    verticalAlignment = Alignment.CenterVertically,
) {
    Icon(Icons.Outlined.LocalFireDepartment, null, tint = c.streak, modifier = Modifier.size(14.dp))
    Text("$n", color = c.streak, fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun IconBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color, onClick: () -> Unit) =
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = tint, modifier = Modifier.size(22.dp))
    }

@Composable
private fun Cta(text: String, bg: Color, onClick: () -> Unit, modifier: Modifier = Modifier.fillMaxWidth(), enabled: Boolean = true, textColor: Color = Color.White) =
    Box(
        modifier.height(52.dp).clip(RoundedCornerShape(14.dp)).background(if (enabled) bg else bg.copy(alpha = 0.5f)).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(text, color = textColor, fontWeight = FontWeight.Bold, fontSize = 16.sp) }

@Composable
private fun Choice(c: PracticePalette, label: String, selected: Boolean, modifier: Modifier, small: Boolean = false, onClick: () -> Unit) =
    Box(
        modifier.height(if (small) 44.dp else 48.dp).clip(RoundedCornerShape(12.dp))
            .background(if (selected) c.accentSoft else c.card)
            .border(BorderStroke(1.dp, if (selected) c.accent else c.line), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (selected) c.accent else c.text, fontSize = if (small) 11.sp else 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center) }

/** 0 idle · 1 chosen · 2 correct · 3 wrong pick · 4 dimmed */
@Composable
private fun OptionRow(c: PracticePalette, n: Int, text: String, state: Int, onClick: () -> Unit) {
    val (border, bg, fg) = when (state) {
        2 -> Triple(c.ok, c.okBg, c.ok)
        3 -> Triple(c.bad, c.badBg, c.bad)
        4 -> Triple(c.line, c.card, c.text3)
        1 -> Triple(c.accent, c.accentSoft, c.text)
        else -> Triple(c.line, c.card, c.text)
    }
    Row(
        Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(14.dp)).background(bg).border(1.5.dp, border, RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("$n", color = c.text3, fontSize = 12.sp, modifier = Modifier.width24())
        Text(text, color = fg, fontSize = 15.sp)
    }
}

private fun Modifier.width24() = this.then(Modifier.size(width = 24.dp, height = 20.dp))

@Composable
private fun RateBtn(c: PracticePalette, label: String, color: Color, modifier: Modifier, onClick: () -> Unit) =
    Box(modifier.height(52.dp).clip(RoundedCornerShape(12.dp)).background(c.card).border(1.dp, c.line, RoundedCornerShape(12.dp)).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(label, color = color, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }

@Composable
private fun BottomBar(c: PracticePalette, content: @Composable () -> Unit) =
    Column(Modifier.fillMaxWidth().background(c.card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }

@Composable
private fun Stat(c: PracticePalette, value: String, label: String, modifier: Modifier) =
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(c.card).border(1.dp, c.line, RoundedCornerShape(14.dp)).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = c.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Text(label, color = c.text2, fontSize = 11.sp)
    }

@Composable
private fun ClozeCard(c: PracticePalette, cl: PracticeCloze, answer: String?) = Card(c) {
    Text(buildAnnotatedString {
        append(cl.before)
        withStyle(SpanStyle(color = c.accent, fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline)) {
            append(answer ?: cl.hint.ifBlank { "_".repeat(cl.length.coerceAtLeast(3)) })
        }
        append(cl.after)
    }, color = c.text, fontSize = 19.sp, fontFamily = FontFamily.Serif, lineHeight = 28.sp)
}

@Composable
private fun ContextLine(c: PracticePalette, sentence: String, word: String) {
    val i = sentence.indexOf(word, ignoreCase = true)
    Text(buildAnnotatedString {
        if (i < 0) append(sentence) else {
            append(sentence.substring(0, i))
            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.text)) { append(sentence.substring(i, i + word.length)) }
            append(sentence.substring(i + word.length))
        }
    }, color = c.text2, fontSize = 14.sp, textAlign = TextAlign.Center, fontFamily = FontFamily.Serif)
}

@Composable
private fun GoalRing(c: PracticePalette, xp: Int, goal: Int, sizeDp: Int) {
    val frac = (xp.toFloat() / goal.coerceAtLeast(1)).coerceIn(0f, 1f)
    Box(Modifier.size(sizeDp.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.minDimension * 0.09f
            drawArc(c.track, 0f, 360f, false, style = Stroke(w), topLeft = Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w))
            drawArc(c.cta, -90f, 360f * frac, false, style = Stroke(w, cap = StrokeCap.Round), topLeft = Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$xp", color = c.text, fontWeight = FontWeight.Bold, fontSize = (sizeDp / 4).sp)
            Text("/ $goal XP", color = c.text3, fontSize = 10.sp)
        }
    }
}

// ------------------------------------------------------------------ previews (screenshots without an emulator)

private val previewItem = DailyPracticeItem(
    key = "v1:mcq_meaning", vocabId = "v1", type = "mcq_meaning", word = "arduous",
    options = listOf("calm and peaceful", "difficult and tiring", "lasting a short time", "bright or shining"),
)

@Preview(name = "Hub light", widthDp = 360, heightDp = 760)
@Composable
fun PreviewHubLight() = GotchaTheme { Box(Modifier.background(PracticeLight.bg)) {
    PracticeHub(PracticeLight, practiceCopyFor("en"), PracticeOverview(dueCount = 18, newCount = 7, totalWords = 214, xpToday = 42, dailyGoalXp = 60, streakCount = 12,
        forecast = listOf(14, 9, 22, 6, 11, 4, 8).mapIndexed { i, n -> app.gotcha.android.data.model.ForecastDay("d$i", n) }),
        15, false, false, null, {}, {}, {}, {}, {}, {})
} }

@Preview(name = "Hub dark RU", widthDp = 360, heightDp = 760)
@Composable
fun PreviewHubDark() = GotchaTheme(darkTheme = true) { Box(Modifier.background(PracticeDark.bg)) {
    PracticeHub(PracticeDark, practiceCopyFor("ru"), PracticeOverview(dueCount = 18, newCount = 7, totalWords = 214, xpToday = 42, dailyGoalXp = 60, streakCount = 12),
        15, false, false, null, {}, {}, {}, {}, {}, {})
} }

@Preview(name = "Feedback wrong UZ", widthDp = 360, heightDp = 300)
@Composable
fun PreviewFeedback() = GotchaTheme { FeedbackSheet(PracticeLight, practiceCopyFor("uz"),
    PracticeAnswerResponse(correct = false, verdict = "wrong", expected = "difficult and tiring", requeue = true, xpGained = 2), {}) }

@Preview(name = "Summary dark", widthDp = 360, heightDp = 760)
@Composable
fun PreviewSummary() = GotchaTheme(darkTheme = true) { Box(Modifier.background(PracticeDark.bg)) {
    PracticeSummaryView(PracticeDark, practiceCopyFor("en"), PracticeSummary(answered = 20, correct = 17, accuracy = 0.87, xpEarned = 150, xpToday = 75, streakCount = 13, streakExtended = true,
        mistakes = listOf(PracticeMistake("v2", "arduous", "mashaqqatli")), dueTomorrow = 12), 60, {}, {})
} }

@Suppress("unused")
private val keepImports = listOf(PracticeHint::class)
