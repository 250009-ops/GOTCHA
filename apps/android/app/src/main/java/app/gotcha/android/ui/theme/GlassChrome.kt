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
    val NavHeight = 76.dp

    val TopBarHeight = 56.dp

    /** Figma bottom nav inset ~x=35 on 390. */
    val NavSideInset = 24.dp
    val TopPillSideInset = 24.dp

    /** Figma rounded-[40px]. */
    val NavBarCorner = 40.dp

    val NavPillBottomGap = 8.dp
    val NavPillTopGap = 10.dp

    /** Breathing room below bottom pill / above system nav (lists still scroll under frost). */
    val ContentClearance = 8.dp

    /**
     * Breathing room below the top pill (or status glass on secondary screens).
     * Must clear the opaque frost band so titles/headers are not under the glass.
     */
    val TopContentClearance = 20.dp

    val NavInnerVerticalPad = 8.dp
    val NavInnerHorizontalPad = 2.dp

    val TabIconCircle = 30.dp
    val TabIconSize = 17.dp

    /** Clear air between purple circle bottom and label top (was 14 → balanced at 4). */
    val TabIconLabelGap = 4.dp

    @Deprecated("Prefer icon-circle + label-below")
    val TabCapsuleHeight = 52.dp
}
