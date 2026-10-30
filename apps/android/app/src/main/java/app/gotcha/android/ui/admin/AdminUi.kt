package app.gotcha.android.ui.admin

import app.gotcha.android.ui.theme.GotchaBlue

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.webPageHorizontalPad
import app.gotcha.android.ui.theme.webScreenWidthDp

@Composable
fun AdminPageHeader(
    title: String,
    subtitle: String? = null,
    actions: @Composable (() -> Unit)? = null,
) {
    val pad = webPageHorizontalPad(webScreenWidthDp())
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = pad)
            .padding(bottom = 24.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                color = Color(0xFF0F172A),
                letterSpacing = (-0.3).sp,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    fontFamily = Inter,
                    fontSize = 14.sp,
                    color = Color(0xFF64748B),
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
        if (actions != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                actions()
            }
        }
    }
}

@Composable
fun AdminCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0).copy(alpha = 0.80f), RoundedCornerShape(16.dp))
            .padding(20.dp),
    ) {
        content()
    }
}

@Composable
fun AdminStatCard(
    label: String,
    value: String,
    hint: String? = null,
    hintColor: Color = Color(0xFF64748B),
    icon: ImageVector? = null,
    accentBg: Color = GotchaBlue.B50,
    accentFg: Color = GotchaColors.WebAdminActive,
    modifier: Modifier = Modifier,
) {
    AdminCard(modifier = modifier) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(
                    label.uppercase(),
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = Color(0xFF64748B),
                    letterSpacing = 0.4.sp,
                )
                Text(
                    value,
                    fontFamily = Inter,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 28.sp,
                    color = Color(0xFF0F172A),
                    modifier = Modifier.padding(top = 8.dp),
                )
                if (!hint.isNullOrBlank()) {
                    Text(hint, fontFamily = Inter, fontSize = 12.sp, color = hintColor, modifier = Modifier.padding(top = 12.dp))
                }
            }
            if (icon != null) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(accentBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, contentDescription = null, tint = accentFg, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

@Composable
fun AdminBadge(text: String, bg: Color = Color(0xFFF1F5F9), fg: Color = Color(0xFF475569)) {
    Text(
        text,
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 2.dp),
    )
}

@Composable
fun AdminPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Text(
        text,
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        color = Color.White,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(GotchaColors.WebAdminActive)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
fun AdminBarChart(values: List<Pair<String, Float>>, modifier: Modifier = Modifier) {
    if (values.isEmpty()) {
        Text("No data yet.", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF64748B), modifier = Modifier.padding(vertical = 40.dp).fillMaxWidth())
        return
    }
    val max = values.maxOf { it.second }.coerceAtLeast(1f)
    val barColor = GotchaColors.WebAdminActive
    Canvas(modifier = modifier.fillMaxWidth().height(160.dp)) {
        val gap = 8.dp.toPx()
        val barW = ((size.width - gap * (values.size + 1)) / values.size).coerceAtLeast(4f)
        values.forEachIndexed { i, (_, v) ->
            val h = (v / max) * (size.height - 8.dp.toPx())
            val x = gap + i * (barW + gap)
            drawRoundRect(
                color = barColor,
                topLeft = Offset(x, size.height - h),
                size = Size(barW, h),
                cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx()),
            )
        }
    }
}

@Composable
fun AdminLineChart(values: List<Pair<String, Float>>, modifier: Modifier = Modifier) {
    if (values.size < 2) {
        AdminBarChart(values, modifier)
        return
    }
    val max = values.maxOf { it.second }.coerceAtLeast(1f)
    val line = GotchaBlue.B700
    val fill = GotchaBlue.B700.copy(alpha = 0.12f)
    Canvas(modifier = modifier.fillMaxWidth().height(160.dp)) {
        val pts = values.mapIndexed { i, (_, v) ->
            val x = if (values.size == 1) size.width / 2 else size.width * i / (values.size - 1)
            val y = size.height - (v / max) * (size.height - 8.dp.toPx())
            Offset(x, y)
        }
        val area = Path().apply {
            moveTo(pts.first().x, size.height)
            pts.forEach { lineTo(it.x, it.y) }
            lineTo(pts.last().x, size.height)
            close()
        }
        drawPath(area, fill, style = Fill)
        for (i in 0 until pts.lastIndex) {
            drawLine(line, pts[i], pts[i + 1], strokeWidth = 3.dp.toPx())
        }
        pts.forEach { drawCircle(line, 4.dp.toPx(), it) }
    }
}
