package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.data.model.StatsHeatmapDay
import app.gotcha.android.ui.theme.Inter
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt

data class StatsSeriesPoint(val label: String, val value: Float)

private enum class StatsChartKind { Area, Bar, DotLine }

private const val CHART_HEIGHT_DP = 200
private val YAxisWidth = 32.dp
private val AxisTickColor = Color(0xFF99A1AF)
private val GridStroke = Color(0xFFF3F4F6)
private val AxisStroke = Color(0xFFE5E7EB)

private val heatmapLevelColors = listOf(
    Color(0xFFF3F4F6),
    GotchaBlue.B50,
    GotchaBlue.B200,
    GotchaBlue.B500,
    GotchaBlue.B700,
)

fun formatStatsShortDate(iso: String): String {
    val date = runCatching { LocalDate.parse(iso) }.getOrNull() ?: return iso
    return date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
}

private fun niceMax(max: Float): Float {
    if (max <= 0f) return 4f
    val magnitude = 10f.pow(floor(log10(max.toDouble())).toFloat())
    val normalized = max / magnitude
    val step = when {
        normalized <= 1f -> 1f
        normalized <= 2f -> 2f
        normalized <= 4f -> 4f
        normalized <= 8f -> 8f
        else -> 10f
    }
    return step * magnitude
}

private fun chartDomain(data: List<StatsSeriesPoint>): Pair<Float, Float> {
    val maxVal = data.maxOfOrNull { it.value } ?: 0f
    return 0f to niceMax(maxVal)
}

private fun chartTicks(max: Float): List<Float> {
    if (max <= 4f) return (0..4).map { it.toFloat() }.filter { it <= max }
    val step = max / 4f
    return (0..4).map { (step * it).roundToInt().toFloat() }
}

private fun xLabelIndices(count: Int, maxLabels: Int = 6): List<Int> {
    if (count <= 0) return emptyList()
    if (count <= maxLabels) return (0 until count).toList()
    val step = (count - 1).toFloat() / (maxLabels - 1)
    return (0 until maxLabels).map { (it * step).roundToInt().coerceIn(0, count - 1) }.distinct()
}

@Composable
fun StatsChartCard(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
            .padding(20.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
                Text(subtitle, fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF), modifier = Modifier.padding(top = 2.dp))
            }
            trailing?.invoke()
        }
        Spacer(Modifier.height(20.dp))
        content()
    }
}

@Composable
fun StatsGLogo(size: Int = 32) {
    app.gotcha.android.ui.components.BrandMark(size = size)
}

@Composable
fun StatsEmptyState(title: String, description: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Outlined.BarChart, null, tint = Color(0xFF99A1AF), modifier = Modifier.size(40.dp))
        Text(title, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF111827))
        Text(description, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF99A1AF), textAlign = TextAlign.Center)
    }
}

@Composable
fun StatsAreaLineChart(
    data: List<StatsSeriesPoint>,
    color: Color = GotchaBlue.B500,
    emptyMessage: String = "No activity in this range",
) = StatsAxisChart(data, color, emptyMessage, StatsChartKind.Area)

@Composable
fun StatsBarChart(
    data: List<StatsSeriesPoint>,
    color: Color = Color(0xFF51A2FF),
    emptyMessage: String = "No words saved in this range",
) = StatsAxisChart(data, color, emptyMessage, StatsChartKind.Bar)

@Composable
fun StatsDotLineChart(
    data: List<StatsSeriesPoint>,
    color: Color = Color(0xFF00966B),
    emptyMessage: String = "No word saves yet",
) = StatsAxisChart(data, color, emptyMessage, StatsChartKind.DotLine)

@Composable
private fun StatsAxisChart(
    data: List<StatsSeriesPoint>,
    color: Color,
    emptyMessage: String,
    kind: StatsChartKind,
) {
    val domain = remember(data) { chartDomain(data) }
    val yTicks = remember(domain) { chartTicks(domain.second) }
    val isEmpty = data.isEmpty() || data.all { it.value == 0f }
    val xIndices = remember(data.size) { xLabelIndices(data.size) }

    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().height(CHART_HEIGHT_DP.dp)) {
            Column(
                modifier = Modifier.width(YAxisWidth).fillMaxHeight(),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                yTicks.reversed().forEach { tick ->
                    Text(
                        tick.toInt().toString(),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.sp,
                        color = AxisTickColor,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                    )
                }
            }
            Box(Modifier.weight(1f).fillMaxHeight()) {
                val maxY = domain.second
                Canvas(Modifier.fillMaxSize()) {
                    val topPad = 4.dp.toPx()
                    val bottomPad = 4.dp.toPx()
                    val chartW = size.width
                    val chartH = size.height - topPad - bottomPad
                    val gridEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 6.dp.toPx()))

                    yTicks.forEach { tick ->
                        val y = topPad + chartH - (tick / maxY) * chartH
                        drawLine(GridStroke, Offset(0f, y), Offset(chartW, y), 1.dp.toPx(), pathEffect = gridEffect)
                    }
                    drawLine(AxisStroke, Offset(0f, topPad + chartH), Offset(chartW, topPad + chartH), 1.dp.toPx())

                    if (data.isEmpty()) return@Canvas

                    when (kind) {
                        StatsChartKind.Area, StatsChartKind.DotLine -> {
                            val stepX = if (data.size <= 1) 0f else chartW / (data.size - 1)
                            val points = data.mapIndexed { i, pt ->
                                Offset(
                                    i * stepX,
                                    topPad + chartH - (pt.value / maxY) * chartH,
                                )
                            }
                            if (kind == StatsChartKind.Area) {
                                val areaPath = Path().apply {
                                    moveTo(points.first().x, topPad + chartH)
                                    points.forEach { lineTo(it.x, it.y) }
                                    lineTo(points.last().x, topPad + chartH)
                                    close()
                                }
                                drawPath(
                                    areaPath,
                                    Brush.verticalGradient(
                                        0f to color.copy(alpha = 0.35f),
                                        0.55f to color.copy(alpha = 0.12f),
                                        1f to color.copy(alpha = 0.02f),
                                    ),
                                )
                            }
                            for (i in 0 until points.lastIndex) {
                                drawLine(color, points[i], points[i + 1], 2.5.dp.toPx(), cap = StrokeCap.Round)
                            }
                            if (kind == StatsChartKind.DotLine) {
                                points.forEach {
                                    drawCircle(Color.White, 5.dp.toPx(), it)
                                    drawCircle(color, 3.5.dp.toPx(), it)
                                }
                            } else {
                                points.forEach { drawCircle(color, 2.5.dp.toPx(), it) }
                            }
                        }
                        StatsChartKind.Bar -> {
                            val gap = chartW * 0.28f / data.size.coerceAtLeast(1)
                            val barW = ((chartW - gap * (data.size + 1)) / data.size).coerceAtLeast(4.dp.toPx())
                            data.forEachIndexed { i, pt ->
                                val h = (pt.value / maxY) * chartH
                                val x = gap + i * (barW + gap)
                                drawRoundRect(
                                    color = color,
                                    topLeft = Offset(x, topPad + chartH - h),
                                    size = Size(barW, max(h, if (pt.value > 0f) 2.dp.toPx() else 0f)),
                                    cornerRadius = CornerRadius(6.dp.toPx(), 6.dp.toPx()),
                                )
                            }
                        }
                    }
                }
                if (isEmpty) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color.White.copy(alpha = 0.8f))
                            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(999.dp))
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                    ) {
                        Text(emptyMessage, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Color(0xFF99A1AF))
                    }
                }
            }
        }
        if (data.isNotEmpty()) {
            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = YAxisWidth, top = 6.dp)
                    .height(18.dp),
            ) {
                xIndices.forEach { index ->
                    val fraction = if (data.size <= 1) 0f else index.toFloat() / (data.size - 1)
                    Text(
                        data[index].label,
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.sp,
                        color = AxisTickColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .offset(x = maxWidth * fraction - 18.dp),
                    )
                }
            }
        }
    }
}

private fun heatmapLevel(count: Int): Int = when {
    count <= 0 -> 0
    count == 1 -> 1
    count == 2 -> 2
    count == 3 -> 3
    else -> 4
}

@Composable
fun StatsHeatmapCalendar(data: List<StatsHeatmapDay>) {
    if (data.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFF9FAFB))
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text("Activity heatmap will appear as you learn", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
        }
        return
    }

    val weeks = remember(data) { data.chunked(7) }
    val monthLabels = remember(weeks) {
        val labels = mutableListOf<Pair<Int, String>>()
        var lastMonth = -1
        weeks.forEachIndexed { wi, week ->
            val first = week.firstOrNull()?.date ?: return@forEachIndexed
            val date = runCatching { LocalDate.parse(first) }.getOrNull() ?: return@forEachIndexed
            if (date.monthValue != lastMonth) {
                labels += wi to date.format(DateTimeFormatter.ofPattern("MMM", Locale.US))
                lastMonth = date.monthValue
            }
        }
        labels
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            Column {
                Box(modifier = Modifier.height(16.dp)) {
                    monthLabels.forEach { (week, label) ->
                        Text(
                            label,
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 10.sp,
                            color = Color(0xFF99A1AF),
                            modifier = Modifier.padding(start = (week * 15).dp),
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    weeks.forEach { week ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            week.forEach { day ->
                                val level = heatmapLevel(day.count)
                                Box(
                                    modifier = Modifier
                                        .size(12.dp)
                                        .clip(RoundedCornerShape(5.dp))
                                        .background(heatmapLevelColors[level])
                                        .then(
                                            if (level == 0) Modifier.border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(5.dp))
                                            else Modifier,
                                        ),
                                )
                            }
                        }
                    }
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            Text("Fewer books", fontFamily = Inter, fontSize = 11.sp, color = Color(0xFF99A1AF))
            Spacer(Modifier.width(6.dp))
            heatmapLevelColors.forEach { c ->
                Box(Modifier.padding(horizontal = 1.5.dp).size(10.dp).clip(RoundedCornerShape(5.dp)).background(c))
            }
            Spacer(Modifier.width(6.dp))
            Text("More books/day", fontFamily = Inter, fontSize = 11.sp, color = Color(0xFF99A1AF))
        }
    }
}

@Composable
fun StatsActivityCard(
    heatmap: List<StatsHeatmapDay>,
    currentStreak: Int,
    bestStreak: Int,
    formatStreak: (Int) -> String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
            .padding(20.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Activity", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
            Text("Last 10 weeks", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
        }
        Spacer(Modifier.height(16.dp))
        StatsHeatmapCalendar(heatmap)
        HorizontalDivider(modifier = Modifier.padding(top = 16.dp), color = Color(0xFFF9FAFB))
        Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(formatStreak(currentStreak), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
                Text("Current streak", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
            }
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(formatStreak(bestStreak), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF111827))
                Text("Best streak", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF99A1AF))
            }
        }
    }
}

fun buildStatsDailySlice(daily: List<app.gotcha.android.data.model.StatsHistoryDay>, rangeDays: Int): List<app.gotcha.android.data.model.StatsHistoryDay> {
    val sliced = daily.takeLast(rangeDays)
    if (sliced.size >= rangeDays) return sliced
    val byDate = sliced.associateBy { it.date }
    val today = LocalDate.now()
    return (rangeDays - 1 downTo 0).map { offset ->
        val key = today.minusDays(offset.toLong()).toString()
        byDate[key] ?: app.gotcha.android.data.model.StatsHistoryDay(date = key, minutes = 0, wordsSaved = 0)
    }
}

fun buildStatsWeeklySeries(weekly: List<app.gotcha.android.data.model.StatsHistoryWeek>): List<StatsSeriesPoint> {
    if (weekly.isNotEmpty()) {
        return weekly.map { StatsSeriesPoint(formatStatsShortDate(it.weekStart), it.wordsSaved.toFloat()) }
    }
    val today = LocalDate.now()
    return (0 until 8).map { i ->
        val d = today.minusDays(((7 - i) * 7).toLong())
        val dayOfWeek = d.dayOfWeek.value
        val weekStart = d.minusDays((dayOfWeek - 1).toLong())
        StatsSeriesPoint(formatStatsShortDate(weekStart.toString()), 0f)
    }
}

fun formatStatsStreakCount(value: Int): String = if (value > 999) "999+" else value.toString()
