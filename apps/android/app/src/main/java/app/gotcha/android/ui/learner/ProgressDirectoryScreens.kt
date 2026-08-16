package app.gotcha.android.ui.learner

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.StatsHistoryDay
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch

@Composable
private fun progressDirBottomPad(): androidx.compose.ui.unit.Dp {
    // SystemNavGlass = fadeTop(40) + navBars; keep last CTA fully above frost + sysnav.
    val nav = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    return nav + 48.dp + 24.dp
}

@Composable
private fun ProgressDirHeader(
    title: String,
    onBack: () -> Unit,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
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
                    painter = painterResource(R.drawable.ic_arrow_left),
                    contentDescription = "Back",
                    tint = GotchaColors.Ink,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    title,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = GotchaColors.Ink,
                )
                if (subtitle != null) {
                    Text(
                        subtitle,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Normal,
                        fontSize = 12.sp,
                        color = GotchaColors.TextMuted,
                    )
                }
            }
        }
        if (trailing != null) trailing() else Spacer(Modifier.size(36.dp))
    }
}

/** Figma 30:6 — streak-detail-screen. */
@Composable
fun StreakDetailScreen(onBack: () -> Unit, onStartReading: () -> Unit = onBack) {
    val container = LocalAppContainer.current
    var streak by remember { mutableIntStateOf(0) }
    var best by remember { mutableIntStateOf(0) }
    var activeDates by remember { mutableStateOf<Set<LocalDate>>(emptySet()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        container.userRepository.statsPeek()?.let { peek ->
            val stats = peek.data
            streak = stats.streakCount
            best = stats.bestStreak.takeIf { it > 0 } ?: streak
            activeDates = stats.history?.heatmap.orEmpty()
                .filter { it.count > 0 }
                .mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }
                .toSet()
        }
        runCatching { container.userRepository.statsFetch() }.getOrNull()?.let { result ->
            val stats = result.data
            streak = stats.streakCount
            best = stats.bestStreak.takeIf { it > 0 } ?: streak
            activeDates = stats.history?.heatmap.orEmpty()
                .filter { it.count > 0 }
                .mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }
                .toSet()
        }
        loading = false
    }

    val today = remember { LocalDate.now() }
    val minMonth = remember(activeDates) {
        (activeDates.minOrNull() ?: today).withDayOfMonth(1)
    }
    val maxMonth = remember { today.withDayOfMonth(1) }
    var visibleMonth by remember { mutableStateOf(maxMonth) }
    val canGoPrev = visibleMonth.isAfter(minMonth)
    val canGoNext = visibleMonth.isBefore(maxMonth)

    val calendarWeeks = remember(visibleMonth, activeDates) {
        buildMonthWeeks(visibleMonth, activeDates)
    }
    val totalDaysRead = activeDates.size
    val thisMonthDays = activeDates.count {
        it.year == today.year && it.month == today.month
    }
    val streakStartedLabel = remember(activeDates, streak, today) {
        streakStartDate(activeDates, streak, today)?.let { formatMonthDay(it) }
    }

    // Extra pad so Start Reading clears SystemNavGlass frost + sysnav.
    val bottom = progressDirBottomPad() + 24.dp

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ProgressDirHeader("Your Streak", onBack)
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = !loading,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(
                Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(GotchaColors.BrandPurpleMid.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(90.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(GotchaColors.BrandPurple, Color(0xFF4F12B5)),
                            ),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$streak",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 40.sp,
                        color = Color.White,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "$streak-Day Streak!",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 24.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    "Longest streak: $best days",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                )
            }
        }

        Column(Modifier.padding(horizontal = 20.dp)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        formatMonthYear(visibleMonth),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GotchaColors.Ink,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(
                            Icons.Outlined.ChevronLeft,
                            contentDescription = "Previous month",
                            tint = if (canGoPrev) GotchaColors.Ink else GotchaColors.TextSubtle,
                            modifier = Modifier
                                .size(16.dp)
                                .clickable(enabled = canGoPrev) {
                                    visibleMonth = visibleMonth.minusMonths(1)
                                },
                        )
                        Icon(
                            Icons.Outlined.ChevronRight,
                            contentDescription = "Next month",
                            tint = if (canGoNext) GotchaColors.Ink else GotchaColors.TextSubtle,
                            modifier = Modifier
                                .size(16.dp)
                                .clickable(enabled = canGoNext) {
                                    visibleMonth = visibleMonth.plusMonths(1)
                                },
                        )
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    listOf("M", "T", "W", "T", "F", "S", "S").forEach { d ->
                        Text(
                            d,
                            modifier = Modifier.width(32.dp),
                            textAlign = TextAlign.Center,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                }
                calendarWeeks.forEach { week ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        week.forEach { cell ->
                            val date = cell.date
                            val on = cell.active
                            val isToday = date == today
                            val inMonth = date.month == visibleMonth.month && date.year == visibleMonth.year
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(
                                        if (on) GotchaColors.BrandPurpleMid else Color.Transparent,
                                    )
                                    .then(
                                        if (isToday) {
                                            Modifier.border(
                                                2.dp,
                                                GotchaColors.BrandPurpleMid,
                                                RoundedCornerShape(16.dp),
                                            )
                                        } else {
                                            Modifier
                                        },
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "${date.dayOfMonth}",
                                    fontFamily = Manrope,
                                    fontWeight = when {
                                        isToday -> FontWeight.ExtraBold
                                        on -> FontWeight.Bold
                                        else -> FontWeight.Medium
                                    },
                                    fontSize = 13.sp,
                                    color = when {
                                        on -> Color.White
                                        !inMonth -> GotchaColors.TextSubtle
                                        else -> GotchaColors.Ink
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }

        Column(
            Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val summaryRows = buildList {
                add("Total days read" to "$totalDaysRead days")
                add("This month" to "$thisMonthDays days")
                if (streakStartedLabel != null) {
                    add("Streak started" to streakStartedLabel)
                }
            }
            summaryRows.forEach { (label, value) ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(label, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.TextMuted)
                    Text(value, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = GotchaColors.Ink)
                }
            }
        }

        Column(
            Modifier.padding(horizontal = 20.dp).padding(top = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GotchaColors.BrandPurpleTint)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Keep it up!", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.BrandPurpleMid)
                Text(
                    if (streak > 0) {
                        "Read today to reach a ${streak + 1}-day streak and secure your learning habit."
                    } else {
                        "Read today to start a streak and build your learning habit."
                    },
                    fontFamily = Manrope,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = GotchaColors.TextMuted,
                )
            }
            GotchaPrimaryButton(
                text = "Start Reading",
                onClick = onStartReading,
                modifier = Modifier.fillMaxWidth().height(54.dp),
            )
        }
    }
}

private data class CalendarCell(val date: LocalDate, val active: Boolean)

private fun buildMonthWeeks(
    monthStart: LocalDate,
    activeDates: Set<LocalDate>,
): List<List<CalendarCell>> {
    val first = monthStart.withDayOfMonth(1)
    // Monday-first grid (matches M T W T F S S header).
    val lead = (first.dayOfWeek.value + 6) % 7
    val gridStart = first.minusDays(lead.toLong())
    return (0 until 6).map { week ->
        (0 until 7).map { day ->
            val date = gridStart.plusDays((week * 7 + day).toLong())
            CalendarCell(date, date in activeDates)
        }
    }.filter { week ->
        week.any { it.date.month == first.month && it.date.year == first.year }
    }
}

private fun streakStartDate(activeDates: Set<LocalDate>, streak: Int, today: LocalDate): LocalDate? {
    if (streak <= 0) return null
    val cursor = if (today in activeDates) today else today.minusDays(1)
    if (cursor !in activeDates) return null
    var start = cursor
    repeat(streak - 1) {
        val prev = start.minusDays(1)
        if (prev !in activeDates) return start
        start = prev
    }
    return start
}

private fun formatMonthYear(monthStart: LocalDate): String {
    val month = monthStart.month.name.lowercase().replaceFirstChar { it.titlecase() }
    return "$month ${monthStart.year}"
}

private fun formatMonthDay(date: LocalDate): String {
    val month = date.month.name.lowercase().replaceFirstChar { it.titlecase() }.take(3)
    return "$month ${date.dayOfMonth}"
}

/** Figma 30:107 — daily-goal-screen. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DailyGoalScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var goal by remember { mutableIntStateOf(app.gotcha.android.ui.i18n.DEFAULT_DAILY_GOAL_MINUTES) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var today by remember { mutableIntStateOf(0) }
    var reminder by remember { mutableStateOf(false) }
    var dailyHistory by remember { mutableStateOf<List<StatsHistoryDay>>(emptyList()) }
    LaunchedEffect(Unit) {
        container.userRepository.mePeek()?.let { peek ->
            val prefs = peek.data.preferences
            goal = prefs?.dailyGoalMinutes ?: goal
            reminder = prefs?.notificationsEnabled ?: reminder
        }
        container.userRepository.statsPeek()?.let { peek ->
            today = peek.data.todayReadMinutes ?: today
            dailyHistory = peek.data.history?.daily.orEmpty()
        }
        runCatching { container.userRepository.meFetch() }.getOrNull()?.let { result ->
            goal = result.data.preferences?.dailyGoalMinutes ?: goal
            reminder = result.data.preferences?.notificationsEnabled ?: reminder
        }
        runCatching { container.userRepository.statsFetch() }.getOrNull()?.let { result ->
            today = result.data.todayReadMinutes ?: today
            dailyHistory = result.data.history?.daily.orEmpty()
        }
    }
    val weekBars = remember(dailyHistory, goal) {
        weekBarFractions(dailyHistory, goal.coerceAtLeast(1))
    }
    val pct = (today / goal.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
    val bottom = progressDirBottomPad()

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .verticalScroll(rememberScrollState())
            .padding(bottom = bottom),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val copy = app.gotcha.android.ui.i18n.LocalUiCopy.current
        ProgressDirHeader(copy.dailyGoal, onBack)
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = dailyHistory.isNotEmpty() || today > 0,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        Column(
            Modifier.fillMaxWidth().padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(120.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(110.dp)) {
                    val stroke = 10.dp.toPx()
                    drawArc(
                        color = GotchaColors.Border,
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                    drawArc(
                        color = GotchaColors.BrandPurpleMid,
                        startAngle = -90f,
                        sweepAngle = 360f * pct,
                        useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "$today / $goal",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        color = GotchaColors.Ink,
                    )
                    Text(
                        copy.minutes,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.sp,
                        color = GotchaColors.TextMuted,
                    )
                }
            }
            Text(
                "${(pct * 100).toInt()}${copy.goalAchieved}",
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
            )
        }

        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(copy.adjustGoal, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GotchaColors.Ink)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(10, 15, 20, 30, 45, 60).forEach { mins ->
                    val selected = goal == mins
                    Text(
                        "${mins}m",
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (selected) GotchaColors.BrandPurpleMid else Color.White)
                            .border(
                                1.dp,
                                if (selected) GotchaColors.BrandPurpleMid else GotchaColors.Border,
                                RoundedCornerShape(20.dp),
                            )
                            .clickable {
                                goal = mins
                                scope.launch {
                                    runCatching {
                                        container.userRepository.updatePreferences(dailyGoalMinutes = mins)
                                    }
                                }
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = if (selected) Color.White else GotchaColors.TextMuted,
                    )
                }
            }
        }

        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(copy.reminders, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GotchaColors.Ink)
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(copy.dailyReminder, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.Ink)
                    Text(copy.dailyReminderSub, fontFamily = Manrope, fontSize = 12.sp, color = GotchaColors.TextMuted)
                }
                Switch(
                    checked = reminder,
                    onCheckedChange = { enabled ->
                        reminder = enabled
                        scope.launch {
                            runCatching {
                                container.userRepository.updatePreferences(notificationsEnabled = enabled)
                            }
                        }
                    },
                    colors = SwitchDefaults.colors(
                        checkedTrackColor = GotchaColors.BrandPurpleMid,
                        checkedThumbColor = Color.White,
                    ),
                )
            }
        }

        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(copy.thisWeek, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GotchaColors.Ink)
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                listOf("M", "T", "W", "T", "F", "S", "S").forEachIndexed { i, label ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            Modifier
                                .width(10.dp)
                                .height(64.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(GotchaColors.Border),
                            contentAlignment = Alignment.BottomCenter,
                        ) {
                            val h = (64 * weekBars.getOrElse(i) { 0f }).dp
                            if (h > 0.dp) {
                                Box(
                                    Modifier
                                        .width(10.dp)
                                        .height(h)
                                        .background(GotchaColors.BrandPurpleMid),
                                )
                            }
                        }
                        Text(label, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.TextMuted)
                    }
                }
            }
        }

        if (saveError != null) {
            Text(
                saveError!!,
                fontFamily = Manrope,
                fontSize = 13.sp,
                color = GotchaColors.Danger,
                modifier = Modifier.padding(horizontal = 20.dp),
            )
        }
        Box(Modifier.padding(horizontal = 20.dp).padding(top = 8.dp)) {
            GotchaPrimaryButton(
                text = copy.saveChanges,
                onClick = {
                    scope.launch {
                        saveError = null
                        runCatching {
                            container.userRepository.updatePreferences(
                                dailyGoalMinutes = goal,
                                notificationsEnabled = reminder,
                            )
                        }.onSuccess {
                            onBack()
                        }.onFailure { e ->
                            saveError = e.message ?: "Couldn’t save goal"
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(54.dp),
            )
        }
    }
}

private fun weekBarFractions(
    daily: List<StatsHistoryDay>,
    goalMinutes: Int,
): List<Float> {
    val goal = goalMinutes.coerceAtLeast(1).toFloat()
    val byDate = daily.associateBy { it.date }
    val today = LocalDate.now()
    // Align bars to Mon..Sun of the current week.
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    return (0 until 7).map { offset ->
        val key = monday.plusDays(offset.toLong()).toString()
        ((byDate[key]?.minutes ?: 0) / goal).coerceIn(0f, 1f)
    }
}

/** Figma 30:538 — cefr-level-screen. Wired to /users/me targetLanguages + vocab stats. */
@Composable
fun CefrLevelScreen(onBack: () -> Unit, onTakeTest: () -> Unit = {}) {
    val container = LocalAppContainer.current
    val bottom = progressDirBottomPad()
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = me == null
        error = null
        if (me == null) {
            container.userRepository.mePeek()?.let { peek ->
                me = peek.data
                loading = false
            }
        }
        if (stats == null) {
            container.userRepository.statsPeek()?.let { peek ->
                stats = peek.data
            }
        }
        try {
            val meResult = container.userRepository.meFetch()
            me = meResult.data
            val statsResult = runCatching { container.userRepository.statsFetch() }.getOrNull()
            stats = statsResult?.data ?: stats
        } catch (e: Exception) {
            if (me == null) {
                error = e.message ?: "Failed to load CEFR level"
            }
        } finally {
            loading = false
        }
    }

    when {
        loading && me == null -> LoadingBox(Modifier.fillMaxSize())
        error != null && me == null -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val primary = me?.targetLanguages?.firstOrNull { it.isPrimary }
                ?: me?.targetLanguages?.firstOrNull()
            val words = stats?.vocabularyTotal ?: 0
            val level = (primary?.cefrLevel ?: inferCefrFromWords(words)).uppercase().take(2)
            val next = nextCefrLevel(level)
            val pct = cefrProgressTowardNext(words, level)
            val unlocks = unlockLinesFor(next ?: level)
            val langName = languageDisplayName(primary?.targetLanguage ?: "en")

            Column(
                Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface)
                    .learnerDirectoryStatusPad()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = bottom),
            ) {
                ProgressDirHeader("Your CEFR Level", onBack)
                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = me != null,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
                Column(
                    Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(Modifier.size(110.dp), contentAlignment = Alignment.Center) {
                        Box(Modifier.size(110.dp).clip(CircleShape).background(GotchaColors.BrandPurpleSoft.copy(alpha = 0.5f)))
                        Box(
                            Modifier
                                .size(90.dp)
                                .clip(CircleShape)
                                .background(GotchaColors.BrandPurple),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(level, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 36.sp, color = Color.White)
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(
                        cefrBandName(level),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                        color = GotchaColors.Ink,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "$langName · from your learning profile",
                        modifier = Modifier.padding(horizontal = 48.dp),
                        textAlign = TextAlign.Center,
                        fontFamily = Manrope,
                        fontSize = 13.sp,
                        color = GotchaColors.TextMuted,
                        lineHeight = 18.sp,
                    )
                }

                if (next != null) {
                    Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                "Progress to $next",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = GotchaColors.Ink,
                            )
                            Text(
                                "${(pct * 100).toInt()}%",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = GotchaColors.BrandPurple,
                            )
                        }
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(10.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(GotchaColors.Border),
                        ) {
                            Box(
                                Modifier
                                    .fillMaxWidth(pct)
                                    .height(10.dp)
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(GotchaColors.BrandPurple),
                            )
                        }
                        Text(
                            "Estimate from $words saved words (not a placement test).",
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                }

                Spacer(Modifier.height(24.dp))
                Text(
                    "At a glance",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = GotchaColors.Ink,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
                Column(
                    Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    listOf(
                        "Words saved" to "$words",
                        "Articles completed" to "${stats?.contentCompleted ?: 0}",
                        "Reading streak" to "${stats?.streakCount ?: me?.streakCount ?: 0} days",
                    ).forEach { (label, value) ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(label, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.TextMuted)
                            Text(value, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = GotchaColors.Ink)
                        }
                    }
                }

                if (next != null) {
                    Spacer(Modifier.height(24.dp))
                    Text(
                        "What $next typically unlocks",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Column(
                        Modifier.padding(horizontal = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        unlocks.forEach { line ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Outlined.Check, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(18.dp))
                                Text(line, fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.TextMuted, lineHeight = 18.sp)
                            }
                        }
                    }
                }
                // Level test CTA hidden — no learner placement API yet.
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

/** Figma 30:642 — language-detail-screen. Wired to me/vocab/feed/content. */
@Composable
fun LanguageDetailScreen(
    code: String,
    onBack: () -> Unit,
    onOpenContent: (String) -> Unit = {},
) {
    val container = LocalAppContainer.current
    val bottom = progressDirBottomPad()
    val upper = code.uppercase()
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var vocab by remember { mutableStateOf<List<VocabItem>>(emptyList()) }
    var historyItems by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var recommended by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    LaunchedEffect(upper, reloadKey) {
        loading = me == null && vocab.isEmpty()
        error = null
        container.userRepository.mePeek()?.let { peek ->
            me = peek.data
            loading = false
        }
        container.vocabRepository.listPeek()?.let { peek ->
            vocab = peek.data
        }
        container.contentRepository.feedPeek()?.let { peek ->
            val continueReading = peek.data.continueReading.orEmpty()
                .filter { it.language.equals(upper, ignoreCase = true) }
            historyItems = continueReading
        }
        try {
            val meResult = runCatching { container.userRepository.meFetch() }.getOrNull()
            me = meResult?.data ?: me
            val vocabResult = runCatching { container.vocabRepository.listFetch() }.getOrNull()
            vocab = vocabResult?.data?.takeIf { it.isNotEmpty() } ?: vocab
            val feedResult = runCatching { container.contentRepository.feedFetch() }.getOrNull()
            val feed = feedResult?.data
            val continueReading = feed?.continueReading.orEmpty()
                .filter { it.language.equals(upper, ignoreCase = true) }
            if (continueReading.isNotEmpty()) historyItems = continueReading
            val catalog = runCatching {
                container.contentRepository.listFetch(q = null, type = null)
            }.getOrNull()?.data?.items.orEmpty()
            val historyIds = continueReading.map { it.id }.toSet()
            recommended = (feed?.recentlyPublished.orEmpty() + catalog)
                .filter { it.language.equals(upper, ignoreCase = true) && it.id !in historyIds }
                .distinctBy { it.id }
                .take(2)
        } catch (e: Exception) {
            if (me == null && vocab.isEmpty()) {
                error = e.message ?: "Failed to load language"
            }
        } finally {
            loading = false
        }
    }

    when {
        loading && me == null && vocab.isEmpty() -> LoadingBox(Modifier.fillMaxSize())
        error != null && me == null && vocab.isEmpty() -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val tl = me?.targetLanguages?.firstOrNull { it.targetLanguage.equals(upper, true) }
            val level = (tl?.cefrLevel ?: "a1").uppercase().take(2)
            val name = languageDisplayName(upper)
            val flag = languageFlag(upper)
            val wordCount = vocab.count { it.sourceLang.equals(upper, ignoreCase = true) }
            val monthStart = YearMonth.now().atDay(1)
            val monthWords = vocab.count { item ->
                item.sourceLang.equals(upper, ignoreCase = true) &&
                    item.createdAt?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }?.let { it >= monthStart } == true
            }
            val articlesInProgress = historyItems.size
            val historyRows = historyItems.map { item ->
                LangHistRow(
                    id = item.id,
                    title = item.title ?: "Untitled",
                    level = item.cefrLevel?.uppercase()?.take(2) ?: level,
                    whenLabel = relativeWhen(item.lastReadAt),
                    pct = item.progressPct?.toInt()?.takeIf { (item.status != "completed") && it < 100 },
                )
            }

            Column(
                Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface)
                    .learnerDirectoryStatusPad()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = bottom),
            ) {
                ProgressDirHeader(
                    title = name,
                    onBack = onBack,
                    subtitle = "$flag Language Detail",
                    trailing = {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(GotchaColors.BrandPurpleMid)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(level, color = Color.White, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    },
                )
                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = me != null || vocab.isNotEmpty() || historyItems.isNotEmpty(),
                    modifier = Modifier.padding(horizontal = 24.dp),
                )

                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    LangStatBlock("Words", "$wordCount total", Modifier.weight(1f))
                    LangStatBlock("This month", "$monthWords new", Modifier.weight(1f))
                    LangStatBlock("In progress", "$articlesInProgress", Modifier.weight(1f))
                }

                Spacer(Modifier.height(8.dp))
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        "Reading History",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GotchaColors.Ink,
                    )
                    if (historyRows.isEmpty()) {
                        Text(
                            "No in-progress reading for $name yet.",
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            color = GotchaColors.TextMuted,
                            modifier = Modifier.padding(vertical = 12.dp),
                        )
                    } else {
                        historyRows.forEach { row ->
                            LanguageHistoryRow(row)
                        }
                    }
                }

                if (recommended.isNotEmpty()) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp)
                            .padding(bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            "Recommended Next",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            recommended.forEach { item ->
                                RecommendedNextCard(
                                    title = item.title ?: "Untitled",
                                    words = item.wordCount?.let { "$it words" } ?: "—",
                                    level = item.cefrLevel?.uppercase()?.take(2) ?: level,
                                    modifier = Modifier.weight(1f),
                                    onClick = offline.guardClick { onOpenContent(item.id) },
                                )
                            }
                            if (recommended.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                } else {
                    Box(Modifier.padding(horizontal = 20.dp).padding(bottom = 8.dp)) {
                        GotchaPrimaryButton(
                            text = "Browse $name in Library",
                            onClick = offline.guardClick { onOpenContent("") },
                            modifier = Modifier.fillMaxWidth().height(51.dp),
                        )
                    }
                }
            }
        }
    }
}

private data class LangHistRow(
    val id: String?,
    val title: String,
    val level: String,
    val whenLabel: String,
    /** null = completed (green check). */
    val pct: Int?,
)

@Composable
private fun LangStatBlock(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, fontFamily = Manrope, fontSize = 12.sp, color = GotchaColors.TextSubtle)
        Text(value, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GotchaColors.Ink)
    }
}

@Composable
private fun LanguageHistoryRow(row: LangHistRow) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    row.title,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = GotchaColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(GotchaColors.BrandPurpleTint)
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(row.level, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = GotchaColors.BrandPurpleMid)
                    }
                    Text(row.whenLabel, fontFamily = Manrope, fontSize = 12.sp, color = GotchaColors.TextSubtle)
                }
            }
            if (row.pct != null) {
                Text(
                    "${row.pct}%",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = GotchaColors.BrandPurpleMid,
                )
            } else {
                Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(GotchaColors.SuccessBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painterResource(R.drawable.ic_check_green),
                        contentDescription = null,
                        tint = Color.Unspecified,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
        HorizontalDivider(color = GotchaColors.Border, thickness = 1.dp)
    }
}

@Composable
private fun RecommendedNextCard(
    title: String,
    words: String,
    level: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(72.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(GotchaColors.BrandPurpleSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.AutoMirrored.Outlined.MenuBook,
                contentDescription = null,
                tint = GotchaColors.BrandPurple,
                modifier = Modifier.size(28.dp),
            )
        }
        Text(
            title,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = GotchaColors.Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(words, fontFamily = Manrope, fontSize = 11.sp, color = GotchaColors.TextSubtle)
            Box(
                Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(GotchaColors.BrandPurpleTint)
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            ) {
                Text(level, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 9.sp, color = GotchaColors.BrandPurpleMid)
            }
        }
    }
}

private data class BadgeVm(val title: String, val subtitle: String, val earned: Boolean, val kind: String)

/** Figma 30:758 — achievements-screen. Thresholds from live streak/vocab/articles. */
@Composable
fun AchievementsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val bottom = progressDirBottomPad()
    var stats by remember { mutableStateOf<UserStats?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = stats == null
        error = null
        container.userRepository.statsPeek()?.let { peek ->
            stats = peek.data
            loading = false
        }
        try {
            val result = container.userRepository.statsFetch()
            stats = result.data
        } catch (e: Exception) {
            if (stats == null) {
                error = e.message ?: "Failed to load achievements"
            }
        } finally {
            loading = false
        }
    }

    when {
        loading && stats == null -> LoadingBox(Modifier.fillMaxSize())
        error != null && stats == null -> OfflineEmptyState(onRetry = { reloadKey += 1 })
        else -> {
            val streak = stats?.streakCount ?: 0
            val words = stats?.vocabularyTotal ?: stats?.wordsSaved ?: 0
            val articles = stats?.contentCompleted ?: 0
            val sections = listOf(
                "Reading Streaks" to listOf(
                    BadgeVm("3-Day Streak", "Keep showing up", streak >= 3, "flame"),
                    BadgeVm("7-Day Streak", "One solid week", streak >= 7, "flame"),
                    BadgeVm("14-Day Streak", "Habit forming", streak >= 14, "flame"),
                    BadgeVm("30-Day Streak", "Habit builder", streak >= 30, "flame"),
                    BadgeVm("100-Day Streak", "Language legend", streak >= 100, "flame"),
                ),
                "Vocabulary" to listOf(
                    BadgeVm("First 10 words", "Beginner vocab", words >= 10, "star"),
                    BadgeVm("100 Words", "Getting serious", words >= 100, "star"),
                    BadgeVm("500 Words", "Halfway there", words >= 500, "star"),
                    BadgeVm("1000 Words", "Elite speaker", words >= 1000, "star"),
                ),
                "Reading" to listOf(
                    BadgeVm("First Article", "Habit unlocked", articles >= 1, "book"),
                    BadgeVm("10 Articles", "Broad interest", articles >= 10, "book"),
                    BadgeVm("50 Articles", "Unstoppable", articles >= 50, "book"),
                ),
            )
            val total = sections.sumOf { it.second.size }
            val earned = sections.sumOf { (_, badges) -> badges.count { it.earned } }

            Column(
                Modifier
                    .fillMaxSize()
                    .background(GotchaColors.Surface)
                    .learnerDirectoryStatusPad(),
            ) {
                ProgressDirHeader(
                    title = "Achievements",
                    onBack = onBack,
                    subtitle = "$earned / $total earned",
                )
                OfflineBannerIfNeeded(
                    connectivity = container.connectivityObserver,
                    hasCachedContent = stats != null,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp)
                        .padding(top = 8.dp, bottom = bottom),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    sections.forEach { (cat, badges) ->
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(cat, fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GotchaColors.Ink)
                            badges.chunked(2).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    row.forEach { badge ->
                                        BadgeCard(badge, Modifier.weight(1f))
                                    }
                                    if (row.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BadgeCard(badge: BadgeVm, modifier: Modifier = Modifier) {
    val bg = when {
        !badge.earned -> GotchaColors.Border.copy(alpha = 0.5f)
        badge.kind == "flame" -> GotchaColors.BrandPurpleSoft
        badge.kind == "star" -> GotchaColors.SuccessBg
        badge.kind == "book" -> GotchaColors.InfoBg
        else -> GotchaColors.BrandPurpleSoft
    }
    val tint = when {
        !badge.earned -> GotchaColors.TextSubtle
        badge.kind == "flame" -> GotchaColors.BrandPurple
        badge.kind == "star" -> GotchaColors.SuccessText
        badge.kind == "book" -> GotchaColors.InfoText
        else -> GotchaColors.BrandPurple
    }
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(12.dp)
            .height(112.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(24.dp)).background(bg),
            contentAlignment = Alignment.Center,
        ) {
            when {
                !badge.earned || badge.kind == "lock" ->
                    Icon(Icons.Outlined.Lock, null, tint = tint, modifier = Modifier.size(20.dp))
                badge.kind == "flame" ->
                    Icon(painterResource(R.drawable.ic_flame), null, tint = tint, modifier = Modifier.size(20.dp))
                badge.kind == "star" ->
                    Icon(Icons.Outlined.Star, null, tint = tint, modifier = Modifier.size(20.dp))
                badge.kind == "book" ->
                    Icon(Icons.AutoMirrored.Outlined.MenuBook, null, tint = tint, modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            badge.title,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = GotchaColors.Ink,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            badge.subtitle,
            fontFamily = Manrope,
            fontSize = 11.sp,
            color = GotchaColors.TextSubtle,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private data class HistoryVm(
    val id: String?,
    val lang: String,
    val title: String,
    val whenLabel: String,
    val completed: Boolean,
    val pct: Int?,
    val sortKey: String = "",
)

/** Figma 30:887 — reading-history-screen. Wired to feed continueReading. */
@Composable
fun ReadingHistoryScreen(onBack: () -> Unit, onOpenReader: (String) -> Unit) {
    val container = LocalAppContainer.current
    var apiItems by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    val bottom = progressDirBottomPad()

    LaunchedEffect(reloadKey) {
        loading = apiItems.isEmpty()
        error = null
        container.contentRepository.feedPeek()?.let { peek ->
            apiItems = peek.data.continueReading.distinctBy { it.id }
                .sortedByDescending { it.lastReadAt.orEmpty() }
            loading = false
        }
        try {
            val result = container.contentRepository.feedFetch()
            apiItems = result.data.continueReading.distinctBy { it.id }
                .sortedByDescending { it.lastReadAt.orEmpty() }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (apiItems.isEmpty()) {
                error = e.message ?: "Failed to load history"
            }
        } finally {
            loading = false
        }
    }

    val sections = remember(apiItems) {
        apiItems
            .map { item ->
                val completed = item.status.equals("completed", true) ||
                    (item.progressPct != null && item.progressPct >= 99.0)
                HistoryVm(
                    id = item.id,
                    lang = item.language?.uppercase()?.take(2) ?: "—",
                    title = item.title ?: "Untitled",
                    whenLabel = relativeWhen(item.lastReadAt),
                    completed = completed,
                    pct = item.progressPct?.toInt()?.takeIf { !completed },
                    sortKey = item.lastReadAt.orEmpty(),
                )
            }
            .groupBy { row ->
                val date = runCatching { LocalDate.parse(row.sortKey.take(10)) }.getOrNull()
                    ?: LocalDate.now()
                YearMonth.from(date).format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US))
            }
            .toList()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad(),
    ) {
        ProgressDirHeader(title = "Reading History", onBack = onBack)
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = apiItems.isNotEmpty(),
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        when {
            loading && apiItems.isEmpty() -> LoadingBox(Modifier.fillMaxSize())
            error != null && apiItems.isEmpty() -> OfflineEmptyState(onRetry = { reloadKey += 1 })
            sections.isEmpty() -> {
                Text(
                    "No reading history yet. Start an article from Library or Home.",
                    fontFamily = Manrope,
                    fontSize = 14.sp,
                    color = GotchaColors.TextMuted,
                    modifier = Modifier.padding(24.dp),
                )
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = bottom),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    sections.forEach { (month, rows) ->
                        item(key = month) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    month.uppercase(),
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = GotchaColors.TextMuted,
                                )
                                rows.forEach { row ->
                                    HistoryListItem(
                                        row = row,
                                        onClick = offline.guardClick { row.id?.let(onOpenReader) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryListItem(row: HistoryVm, onClick: () -> Unit) {
    val langBg = when (row.lang.uppercase()) {
        "RU" -> GotchaColors.BrandPurpleMid
        "EN" -> Color(0xFF0284C7)
        "UZ" -> Color(0xFF059669)
        else -> GotchaColors.BrandPurpleMid
    }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(langBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                row.lang.uppercase(),
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                color = Color.White,
            )
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                row.title,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(row.whenLabel, fontFamily = Manrope, fontSize = 12.sp, color = GotchaColors.TextSubtle)
                if (row.completed) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(GotchaColors.SuccessBg)
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text("Completed", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = Color(0xFF059669))
                    }
                } else if (row.pct != null) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(GotchaColors.WarningBg)
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            "${row.pct}% read",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = GotchaColors.Amber,
                        )
                    }
                }
            }
        }
        if (row.completed) {
            Box(
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(GotchaColors.SuccessBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painterResource(R.drawable.ic_check_green),
                    contentDescription = null,
                    tint = Color.Unspecified,
                    modifier = Modifier.size(16.dp),
                )
            }
        } else {
            Icon(
                Icons.Outlined.ChevronRight,
                contentDescription = null,
                tint = GotchaColors.TextSubtle,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

private fun languageDisplayName(code: String?): String = when (code?.uppercase()) {
    "RU" -> "Russian"
    "EN" -> "English"
    "UZ" -> "Uzbek"
    "DE" -> "German"
    "FR" -> "French"
    "ES" -> "Spanish"
    "JA" -> "Japanese"
    else -> code?.uppercase() ?: "Language"
}

private fun languageFlag(code: String): String = when (code.uppercase()) {
    "RU" -> "🇷🇺"
    "EN" -> "🇬🇧"
    "UZ" -> "🇺🇿"
    "DE" -> "🇩🇪"
    "FR" -> "🇫🇷"
    "ES" -> "🇪🇸"
    "JA" -> "🇯🇵"
    else -> "🌐"
}

private fun cefrBandName(code: String): String = when (code.uppercase().take(2)) {
    "A1" -> "Beginner"
    "A2" -> "Elementary"
    "B1" -> "Intermediate"
    "B2" -> "Upper Intermediate"
    "C1" -> "Advanced"
    "C2" -> "Mastery"
    else -> "Learner"
}

private fun nextCefrLevel(code: String): String? = when (code.uppercase().take(2)) {
    "A1" -> "A2"
    "A2" -> "B1"
    "B1" -> "B2"
    "B2" -> "C1"
    "C1" -> "C2"
    else -> null
}

private fun inferCefrFromWords(words: Int): String = when {
    words >= 4000 -> "c1"
    words >= 2000 -> "b2"
    words >= 800 -> "b1"
    words >= 300 -> "a2"
    else -> "a1"
}

private fun cefrProgressTowardNext(words: Int, code: String): Float {
    val (lo, hi) = when (code.uppercase().take(2)) {
        "A1" -> 0 to 300
        "A2" -> 300 to 800
        "B1" -> 800 to 2000
        "B2" -> 2000 to 4000
        "C1" -> 4000 to 8000
        else -> return 1f
    }
    if (words <= lo) return 0f
    if (words >= hi) return 1f
    return ((words - lo).toFloat() / (hi - lo)).coerceIn(0f, 1f)
}

private fun unlockLinesFor(level: String): List<String> = when (level.uppercase().take(2)) {
    "A2" -> listOf(
        "Handle short everyday texts and simple stories",
        "Follow clear, slow speech on familiar topics",
        "Build a practical core vocabulary for daily life",
    )
    "B1" -> listOf(
        "Understand the main points of clear standard texts",
        "Describe experiences and plans in connected writing",
        "Read graded literature and news with support",
    )
    "B2" -> listOf(
        "Read complex texts and literary prose with ease",
        "Express viewpoints on abstract, cultural topics",
        "Access professional literature and global news",
    )
    "C1", "C2" -> listOf(
        "Follow nuanced argumentation and long-form writing",
        "Work with specialized and academic material",
        "Read nearly any authentic text with confidence",
    )
    else -> listOf(
        "Recognize familiar words and very basic phrases",
        "Build confidence with short supported texts",
    )
}

private fun relativeWhen(iso: String?): String {
    if (iso.isNullOrBlank()) return "Recently"
    val date = runCatching { LocalDate.parse(iso.take(10)) }.getOrNull() ?: return "Recently"
    val today = LocalDate.now()
    val days = java.time.temporal.ChronoUnit.DAYS.between(date, today)
    return when {
        days <= 0L -> "Today"
        days == 1L -> "Yesterday"
        days < 7L -> "$days days ago"
        else -> {
            val month = date.month.name.lowercase().replaceFirstChar { it.titlecase() }.take(3)
            "$month ${date.dayOfMonth}, ${date.year}"
        }
    }
}
