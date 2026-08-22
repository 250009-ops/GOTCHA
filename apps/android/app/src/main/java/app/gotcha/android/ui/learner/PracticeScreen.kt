package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.PracticeAnswerResult
import app.gotcha.android.data.model.PracticeQuestion
import app.gotcha.android.data.model.PracticeSession
import app.gotcha.android.data.model.StartPracticeRequest
import app.gotcha.android.data.model.SubmitAnswerItem
import app.gotcha.android.ui.components.GlassLoadingScreen
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Inter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private data class PracticeTypeOption(val value: String, val label: String, val description: String)

private val PRACTICE_TYPES = listOf(
    PracticeTypeOption("comprehension", "Comprehension", "Multiple-choice questions about the passage"),
    PracticeTypeOption("cloze", "Fill in the blank", "Complete the missing word from context"),
    PracticeTypeOption("writing", "Short answer", "Answer in your own words"),
)

/** Figma has no dedicated practice frame — this mirrors web-learner's PracticePage.tsx 1:1
 * so the quiz feature (backed by services/api's practice module) has feature parity on mobile. */
@Composable
fun PracticeScreen(
    contentId: String?,
    segmentId: String?,
    onBack: () -> Unit,
) {
    GotchaSystemBars(darkIcons = true)
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()

    var content by remember(contentId) { mutableStateOf<ContentItem?>(null) }
    var contentLoadProgress by remember(contentId) { mutableIntStateOf(0) }
    var contentLoading by remember(contentId) { mutableStateOf(contentId != null) }
    var practiceType by remember { mutableStateOf("comprehension") }
    var starting by remember { mutableStateOf(false) }
    var startError by remember { mutableStateOf<String?>(null) }
    var session by remember { mutableStateOf<PracticeSession?>(null) }
    var questionIdx by remember { mutableStateOf(0) }
    val answers = remember { mutableStateOf(mapOf<String, String>()) }
    var freeText by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var results by remember { mutableStateOf<List<PracticeAnswerResult>>(emptyList()) }
    var score by remember { mutableStateOf(0.0) }
    var showResults by remember { mutableStateOf(false) }

    LaunchedEffect(contentId) {
        if (contentId == null) {
            contentLoading = false
            return@LaunchedEffect
        }
        val targetId = contentId
        contentLoadProgress = 0
        container.contentRepository.getPeek(targetId)?.let { peek ->
            content = peek.data
            contentLoadProgress = 100
            contentLoading = false
            try {
                val fresh = container.contentRepository.getFetch(targetId).data
                if (targetId == contentId) content = fresh
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Keep cached title on background refresh failure.
            }
            return@LaunchedEffect
        }
        contentLoading = true
        contentLoadProgress = 15
        try {
            contentLoadProgress = 40
            val fetched = container.contentRepository.getFetch(targetId).data
            if (targetId == contentId) content = fetched
            contentLoadProgress = 100
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Practice can still start without title metadata.
        } finally {
            if (targetId == contentId) contentLoading = false
        }
    }

    fun startSession() {
        if (segmentId == null) return
        scope.launch {
            starting = true
            startError = null
            try {
                val started = container.practiceRepository.start(contentId, segmentId, practiceType)
                if (started.questions.isEmpty()) {
                    startError = "No quiz questions could be generated for this chapter. Try another one."
                } else {
                    session = started
                    questionIdx = 0
                    answers.value = emptyMap()
                    freeText = ""
                    showResults = false
                }
            } catch (e: Exception) {
                startError = e.apiErrorMessage("Could not start practice session")
            } finally {
                starting = false
            }
        }
    }

    fun finishSession(finalAnswers: Map<String, String>) {
        val s = session ?: return
        scope.launch {
            submitting = true
            try {
                val payload = s.questions.map { q -> SubmitAnswerItem(q.id, finalAnswers[q.id] ?: "") }
                val res = container.practiceRepository.submit(s.id, payload)
                results = res.results
                score = res.score
                showResults = true
            } catch (e: Exception) {
                startError = e.apiErrorMessage("Could not submit answers")
            } finally {
                submitting = false
            }
        }
    }

    fun goNext() {
        val s = session ?: return
        val current = s.questions.getOrNull(questionIdx) ?: return
        val hasOptions = !current.options.isNullOrEmpty()
        var updated = answers.value
        if (!hasOptions) {
            if (freeText.isBlank()) return
            updated = updated + (current.id to freeText.trim())
        } else if (updated[current.id].isNullOrBlank()) {
            return
        }
        answers.value = updated
        if (questionIdx >= s.questions.lastIndex) {
            finishSession(updated)
        } else {
            questionIdx += 1
            freeText = ""
        }
    }

    fun restart() {
        session = null
        showResults = false
        answers.value = emptyMap()
        freeText = ""
        questionIdx = 0
        startError = null
    }

    val headerTitle = when {
        showResults -> "Practice results"
        session != null -> content?.title ?: "Practice"
        else -> content?.title ?: "Practice"
    }

    Column(Modifier.fillMaxSize().background(Color(0xFFFDFCFF)).statusBarsPadding()) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(Color.White)
                .border(width = 0.dp, color = Color.Transparent)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.clickable(onClick = onBack),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Back to reading",
                    tint = Color(0xFF6A7282),
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    "Back to reading",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                    color = Color(0xFF6A7282),
                )
            }
            Box(Modifier.width(1.dp).height(16.dp).background(Color(0xFFE5E7EB)))
            Text(
                headerTitle,
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = Color(0xFF1E2939),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
        HorizontalDivider(color = Color(0xFFE5E7EB), thickness = 1.dp)

        when {
            segmentId == null -> PracticeEmptyState(onBack = onBack)
            contentLoading -> GlassLoadingScreen(
                progress = contentLoadProgress,
                title = "Loading practice…",
                subtitle = "Fetching chapter details",
                modifier = Modifier.fillMaxSize(),
            )
            showResults -> PracticeResultsView(
                session = session,
                results = results,
                score = score,
                onRestart = { restart() },
                onBackToReader = onBack,
            )
            session != null -> PracticeQuizView(
                session = session!!,
                questionIdx = questionIdx,
                answers = answers.value,
                freeText = freeText,
                onFreeTextChange = { freeText = it },
                onSelectAnswer = { value ->
                    val q = session!!.questions.getOrNull(questionIdx) ?: return@PracticeQuizView
                    answers.value = answers.value + (q.id to value)
                },
                submitting = submitting,
                onNext = { goNext() },
            )
            else -> PracticeSetupView(
                contentTitle = content?.title,
                practiceType = practiceType,
                onSelectType = { practiceType = it },
                starting = starting,
                error = startError,
                onStart = { startSession() },
            )
        }
    }
}

@Composable
private fun PracticeEmptyState(onBack: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(GotchaColors.WebAccentSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.School, null, tint = GotchaColors.WebAccent, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(
            "Practice what you read",
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = GotchaColors.Ink,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Open any chapter in the Reader and tap Practice to quiz yourself on it — comprehension, " +
                "fill-in-the-blank, and short-answer questions generated from that exact passage.",
            fontFamily = Inter,
            fontSize = 13.sp,
            color = GotchaColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(text = "Back to library", onClick = onBack)
    }
}

@Composable
private fun PracticeSetupView(
    contentTitle: String?,
    practiceType: String,
    onSelectType: (String) -> Unit,
    starting: Boolean,
    error: String?,
    onStart: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column {
                Text("Quiz yourself", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = GotchaColors.Ink)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Generated from the chapter you were just reading" +
                        (contentTitle?.let { " in \u201c$it\u201d" } ?: "") + ".",
                    fontFamily = Inter,
                    fontSize = 13.sp,
                    color = GotchaColors.TextMuted,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PRACTICE_TYPES.forEach { opt ->
                    val active = opt.value == practiceType
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (active) GotchaColors.WebAccentSoft else Color.White)
                            .border(
                                1.dp,
                                if (active) GotchaColors.WebAccent else GotchaColors.Border,
                                RoundedCornerShape(14.dp),
                            )
                            .clickable { onSelectType(opt.value) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                    ) {
                        Text(
                            opt.label,
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = if (active) GotchaColors.WebAccent else GotchaColors.Ink,
                        )
                        Text(opt.description, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextMuted)
                    }
                }
            }
            if (error != null) {
                Text(error, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.Danger)
            }
            GotchaPrimaryButton(
                text = if (starting) "Generating quiz…" else "Start quiz",
                onClick = onStart,
                loading = starting,
            )
        }
    }
}

@Composable
private fun PracticeQuizView(
    session: PracticeSession,
    questionIdx: Int,
    answers: Map<String, String>,
    freeText: String,
    onFreeTextChange: (String) -> Unit,
    onSelectAnswer: (String) -> Unit,
    submitting: Boolean,
    onNext: () -> Unit,
) {
    val question = session.questions.getOrNull(questionIdx) ?: return
    val hasOptions = !question.options.isNullOrEmpty()
    val selected = answers[question.id]
    val isLast = questionIdx >= session.questions.lastIndex

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier
                    .weight(1f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(GotchaColors.Border),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth((questionIdx + 1f) / session.questions.size)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(GotchaColors.WebAccent),
                )
            }
            Text(
                "${questionIdx + 1} / ${session.questions.size}",
                fontFamily = Inter,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                color = GotchaColors.TextSubtle,
            )
        }

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(question.prompt, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = GotchaColors.Ink)

            if (hasOptions) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    question.options!!.forEach { opt ->
                        val isSelected = selected == opt
                        Text(
                            opt,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) GotchaColors.WebAccentSoft else Color.White)
                                .border(
                                    1.dp,
                                    if (isSelected) GotchaColors.WebAccent else GotchaColors.Border,
                                    RoundedCornerShape(14.dp),
                                )
                                .clickable { onSelectAnswer(opt) }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = if (isSelected) GotchaColors.WebAccent else GotchaColors.TextMuted,
                        )
                    }
                }
            } else {
                OutlinedTextField(
                    value = freeText,
                    onValueChange = onFreeTextChange,
                    placeholder = { Text("Type your answer…", fontFamily = Inter) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GotchaColors.WebAccent,
                        unfocusedBorderColor = GotchaColors.Border,
                    ),
                )
            }
        }

        GotchaPrimaryButton(
            text = if (submitting) "Submitting…" else if (isLast) "Finish quiz" else "Next question",
            onClick = onNext,
            loading = submitting,
            enabled = !submitting,
        )
    }
}

@Composable
private fun PracticeResultsView(
    session: PracticeSession?,
    results: List<PracticeAnswerResult>,
    score: Double,
    onRestart: () -> Unit,
    onBackToReader: () -> Unit,
) {
    val pct = (score * 100).toInt()
    val correctCount = results.count { it.isCorrect }
    val bandColor = when {
        pct >= 70 -> GotchaColors.SuccessText
        pct >= 40 -> GotchaColors.WarningText
        else -> GotchaColors.Danger
    }
    val bandBg = when {
        pct >= 70 -> GotchaColors.SuccessBg
        pct >= 40 -> GotchaColors.WarningBg
        else -> GotchaColors.Danger.copy(alpha = 0.1f)
    }
    val message = when {
        pct >= 70 -> "Great work — keep it up!"
        pct >= 40 -> "Good effort — review the explanations below."
        else -> "Keep practicing — review the explanations below."
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 24.dp)
            .navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier.size(64.dp).clip(CircleShape).background(bandBg),
                contentAlignment = Alignment.Center,
            ) {
                Text("$pct%", fontFamily = Inter, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = bandColor)
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "$correctCount / ${results.size} correct",
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = GotchaColors.Ink,
            )
            Spacer(Modifier.height(4.dp))
            Text(message, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.TextMuted, textAlign = TextAlign.Center)
        }

        session?.questions?.forEachIndexed { i, q ->
            val r = results.firstOrNull { it.questionId == q.id }
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(if (r?.isCorrect == true) GotchaColors.SuccessBg else GotchaColors.Danger.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (r?.isCorrect == true) Icons.Outlined.Check else Icons.Outlined.Close,
                            null,
                            tint = if (r?.isCorrect == true) GotchaColors.SuccessText else GotchaColors.Danger,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            "${i + 1}. ${q.prompt}",
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = GotchaColors.Ink,
                        )
                        Text(
                            "Your answer: ${r?.userAnswer?.takeIf { it.isNotBlank() } ?: "—"}",
                            fontFamily = Inter,
                            fontSize = 12.sp,
                            color = GotchaColors.TextMuted,
                        )
                        if (r?.isCorrect != true) {
                            Text(
                                "Correct answer: ${q.correctAnswer}",
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.SuccessText,
                            )
                        }
                        if (!q.explanation.isNullOrBlank()) {
                            Text(q.explanation, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.TextSubtle)
                        }
                    }
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                    .clickable(onClick = onRestart)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.Refresh, null, tint = GotchaColors.Ink, modifier = Modifier.size(16.dp))
                    Text("Try another quiz", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.Ink)
                }
            }
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(GotchaColors.WebAccent)
                    .clickable(onClick = onBackToReader)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Back to reading", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
            }
        }
    }
}
