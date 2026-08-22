package app.gotcha.android.ui.theme

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Breakpoints copied from web-learner Tailwind (`sm` 640 / `lg` 1024 / `xl` 1280). */
object WebBreakpoints {
    const val Sm = 640
    const val Lg = 1024
    const val Xl = 1280
}

/** Tailwind `max-w-7xl` (1280px), `max-w-6xl` (1152px), `max-w-3xl` (768px). */
object WebMaxWidth {
    val W7xl = 1280.dp
    val W6xl = 1152.dp
    val W3xl = 768.dp
}

@Composable
fun webScreenWidthDp(): Int = LocalConfiguration.current.screenWidthDp

fun webPageHorizontalPad(widthDp: Int): Dp = if (widthDp >= WebBreakpoints.Sm) 24.dp else 12.dp

fun webPageVerticalPad(widthDp: Int): Dp = if (widthDp >= WebBreakpoints.Lg) 32.dp else 24.dp

@Composable
fun Modifier.webPagePad(): Modifier {
    val w = webScreenWidthDp()
    return padding(
        horizontal = webPageHorizontalPad(w),
        vertical = webPageVerticalPad(w),
    )
}

fun prefersExpandedSidebar(widthDp: Int): Boolean = widthDp >= WebBreakpoints.Lg

@Composable
fun WebCenteredColumn(
    maxWidth: Dp,
    modifier: Modifier = Modifier,
    horizontalPadding: Dp? = null,
    verticalPadding: Dp? = null,
    content: @Composable () -> Unit,
) {
    val widthDp = webScreenWidthDp()
    val hPad = horizontalPadding ?: webPageHorizontalPad(widthDp)
    val vPad = verticalPadding ?: webPageVerticalPad(widthDp)
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = maxWidth)
                .fillMaxWidth()
                .padding(horizontal = hPad, vertical = vPad),
        ) {
            content()
        }
    }
}
