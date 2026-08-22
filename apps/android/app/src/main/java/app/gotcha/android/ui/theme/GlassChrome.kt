package app.gotcha.android.ui.theme

import androidx.compose.ui.unit.dp

/**
 * Shared frosted top/bottom chrome metrics for Admin + Learner shells.
 * Selected tab = purple circle on icon only; label below with clear gap.
 *
 * Intrinsic ≈ TabIconCircle + TabIconLabelGap + label(~12) + 2×NavInnerVerticalPad.
 * Tuned so icon→label is balanced (not overlapping, not overly gappy).
 */
object GlassChrome {
    val NavHeight = 64.dp

    val TopBarHeight = 56.dp

    val SearchPanelHeight = 44.dp

    /** Figma bottom nav inset ~x=35 on 390. */
    val NavSideInset = 24.dp
    val TopPillSideInset = 24.dp

    /** Figma rounded-[40px]. */
    val NavBarCorner = 40.dp

    val NavPillBottomGap = 8.dp
    val NavPillTopGap = 10.dp

    /** Breathing room below bottom pill — content ends just above nav frost. */
    val ContentClearance = 12.dp

    /** Gap between top pill bottom and first scroll content. */
    val TopContentClearance = 12.dp

    val NavInnerVerticalPad = 3.dp
    val NavInnerHorizontalPad = 2.dp

    val TabIconCircle = 28.dp
    val TabIconSize = 17.dp

    val TabIconLabelGap = 2.dp

    @Deprecated("Prefer icon-circle + label-below")
    val TabCapsuleHeight = 52.dp
}
