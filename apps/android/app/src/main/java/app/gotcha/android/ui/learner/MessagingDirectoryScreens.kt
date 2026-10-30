package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import app.gotcha.android.R
import app.gotcha.android.ui.theme.GlassChrome
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter

/** Bottom inset for messaging routes — system nav only (no tab chrome on these screens). */
@Composable
fun messagingDirBottomPad(): androidx.compose.ui.unit.Dp {
    val nav = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    return nav + GlassChrome.ContentClearance + 16.dp
}

/** Status-bar inset with OEM floor — matches [LearnerShell] secondary routes. */
@Composable
fun messagingDirStatusBarInset(): Dp {
    val fromInsets = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    return max(fromInsets, 24.dp)
}

/**
 * Status-bar inset + 20dp clearance so directory titles never kiss status icons
 * (Figma 216:90 / 216:236 / 216:411 / 216:558). Reads insets without consuming
 * them — safer than [statusBarsPadding] when a parent already consumed WindowInsets.
 */
@Composable
fun messagingDirectoryTopPad(): Dp = messagingDirStatusBarInset() + GlassChrome.TopContentClearance

@Composable
fun Modifier.messagingDirectoryStatusPad(): Modifier =
    padding(top = messagingDirectoryTopPad())

/** Figma directory back: 36×36, 12dp corners, surface fill, 1dp border (216:682 / 216:684). */
@Composable
fun MessagingBackButton(onBack: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(36.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(GotchaColors.Surface)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = onBack),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_arrow_left),
            contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_back),
            tint = GotchaColors.Ink,
            modifier = Modifier.size(16.dp),
        )
    }
}

/** Shared inbox / find-learners / peer-profile header (Figma Top Bar, 56dp). */
@Composable
fun MessagingDirectoryHeader(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(GotchaColors.SurfaceCard)
                .padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MessagingBackButton(onBack)
            Text(
                title,
                fontFamily = Inter,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                color = GotchaColors.Ink,
            )
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))
    }
}

/**
 * Floating chat FAB (Figma `chat-fab-wrapper` / node 220:3) shown on main learner tabs.
 * Sits above the bottom nav pill, trailing edge.
 */
@Composable
fun MessagingChatFab(
    unreadCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /** Extra bottom padding — use on Library to stack above the import FAB (Figma 220:7 / 29:2). */
    stackOffset: androidx.compose.ui.unit.Dp = 0.dp,
) {
    val navInset = max(WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(), 48.dp)
    val bottomOffset = navInset + GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + 12.dp + stackOffset

    Box(
        modifier = modifier
            .padding(end = 20.dp, bottom = bottomOffset)
            .size(64.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (unreadCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 2.dp, y = (-2).dp)
                    .size(20.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(GotchaColors.BrandPurple),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (unreadCount > 9) "9+" else unreadCount.toString(),
                    fontFamily = Inter,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 10.sp,
                    color = Color.White,
                )
            }
        }
        Box(
            modifier = Modifier
                .size(56.dp)
                .shadow(
                    elevation = 8.dp,
                    shape = CircleShape,
                    spotColor = GotchaColors.BrandPurple.copy(alpha = 0.35f),
                )
                .clip(CircleShape)
                .background(GotchaColors.BrandPurple)
                .border(3.dp, Color.White, CircleShape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClick,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_message),
                contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_messages),
                tint = Color.White,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}
