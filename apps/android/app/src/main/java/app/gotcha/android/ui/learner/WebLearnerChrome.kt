package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import app.gotcha.android.R
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.theme.GlassChrome
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import coil.compose.AsyncImage
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeChild

data class LearnerBottomTab(
    val route: String,
    @androidx.annotation.StringRes val labelRes: Int,
    @DrawableRes val iconRes: Int,
)

/** Main tab routes that show floating top/bottom glass chrome (not inner directories like browse). */
val learnerChromeRoutes = setOf(
    "library",
    "words",
    "import",
    "progress",
    "settings",
)

/** Icons aligned with web-learner sidebar (Lucide Home / Brain / Upload / BarChart3 / Settings). */
val learnerBottomTabs = listOf(
    LearnerBottomTab("library", R.string.nav_library, R.drawable.ic_nav_home),
    LearnerBottomTab("vocabulary", R.string.nav_vocabulary, R.drawable.ic_nav_brain),
    LearnerBottomTab("import", R.string.nav_import, R.drawable.ic_nav_upload),
    LearnerBottomTab("stats", R.string.nav_statistics, R.drawable.ic_nav_chart),
    LearnerBottomTab("settings", R.string.nav_settings, R.drawable.ic_settings_gear),
)

@Composable
fun WebLearnerShellFrame(
    currentRoute: String?,
    unreadNotifs: Int,
    unreadMessages: Int,
    streakCount: Int,
    displayName: String?,
    email: String?,
    avatarUrl: String?,
    searchAvailable: Boolean,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    searchExpanded: Boolean,
    onSearchExpandedChange: (Boolean) -> Unit,
    showChrome: Boolean,
    hazeState: HazeState,
    onNav: (String) -> Unit,
    onMessages: () -> Unit,
    onLogout: () -> Unit,
    content: @Composable () -> Unit,
) {
    val chromeRoute = webChromeRoute(currentRoute)
    val glassFade = 24.dp

    Box(modifier = Modifier.fillMaxSize().background(GotchaColors.WebCanvas)) {
        content()

        if (showChrome) {
            LearnerFrostedTopBar(
                modifier = Modifier.align(Alignment.TopCenter),
                hazeState = hazeState,
                fadeBottom = glassFade,
                searchAvailable = searchAvailable,
                searchExpanded = searchExpanded,
                onSearchExpandedChange = onSearchExpandedChange,
                searchQuery = searchQuery,
                onSearchChange = onSearchChange,
                streakCount = streakCount,
                unreadNotifs = unreadNotifs,
                displayName = displayName,
                email = email,
                avatarUrl = avatarUrl,
                onNotifications = { onNav("notifications") },
                onLogout = onLogout,
            )
            LearnerFrostedBottomBar(
                modifier = Modifier.align(Alignment.BottomCenter),
                hazeState = hazeState,
                fadeTop = glassFade,
                currentChromeRoute = chromeRoute,
                onSelect = onNav,
            )
            MessagingChatFab(
                unreadCount = unreadMessages,
                onClick = onMessages,
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        } else {
            SystemNavGlass(
                modifier = Modifier.align(Alignment.BottomCenter),
                hazeState = hazeState,
                fadeTop = 32.dp,
            )
        }
    }
}

@Composable
fun PayAsYouGoHomeBanner(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val brush = Brush.horizontalGradient(listOf(GotchaColors.WebPayFrom, GotchaColors.WebPayTo))
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(brush)
            .border(1.dp, Color.White.copy(alpha = 0.10f), shape)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(GotchaColors.SurfaceCard.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.AccountBalanceWallet,
                contentDescription = null,
                tint = Color(0xFFFCD34D),
                modifier = Modifier.size(18.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_pay_as_you_go),
                color = Color.White,
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            Text(
                androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_import_books_pay_per_file),
                color = GotchaBlue.B200,
                fontFamily = Inter,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
fun Modifier.learnerTabScrollInsets(): Modifier = this

@Composable
fun learnerScrollTopInset(): Dp = LocalLearnerTopInset.current

@Composable
fun learnerScrollBottomInset(): Dp = LocalLearnerBottomInset.current

@Composable
fun learnerStatusBarInset(): Dp {
    val fromInsets = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    return max(fromInsets, 24.dp)
}

@Composable
fun learnerNavBarInset(): Dp {
    val fromInsets = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return max(fromInsets, 48.dp)
}

private val ChatFabClearance = 72.dp

@Composable
fun rememberLearnerChromeInsets(showChrome: Boolean, searchExpanded: Boolean = false): Pair<Dp, Dp> {
    val navBar = learnerNavBarInset()
    val statusBar = learnerStatusBarInset()
    return if (showChrome) {
        val searchExtra = if (searchExpanded) GlassChrome.SearchPanelHeight + 8.dp else 0.dp
        // UI-29: also clear the chat FAB (56 dp + badge) so it never covers row actions at the list end.
        val bottom = GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navBar + GlassChrome.ContentClearance +
            ChatFabClearance
        val top = statusBar + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight +
            GlassChrome.TopContentClearance + searchExtra
        top to bottom
    } else {
        val bottom = navBar + GlassChrome.ContentClearance + 16.dp
        val top = statusBar + GlassChrome.TopContentClearance
        top to bottom
    }
}

@Composable
private fun LearnerFrostedTopBar(
    hazeState: HazeState,
    fadeBottom: Dp,
    searchAvailable: Boolean,
    searchExpanded: Boolean,
    onSearchExpandedChange: (Boolean) -> Unit,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    streakCount: Int,
    unreadNotifs: Int,
    displayName: String?,
    email: String?,
    avatarUrl: String?,
    onNotifications: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val statusInset = learnerStatusBarInset()
    val searchPanelExtra = if (searchExpanded && searchAvailable) GlassChrome.SearchPanelHeight + 8.dp else 0.dp
    val totalHeight = statusInset + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight + searchPanelExtra + fadeBottom
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val pillAlpha = if (blurCapable) 0.82f else 0.94f
    val searchFocus = remember { FocusRequester() }

    LaunchedEffect(searchExpanded) {
        if (searchExpanded) searchFocus.requestFocus()
    }

    Box(modifier = modifier.fillMaxWidth().height(totalHeight)) {
        ClearGlassSheet(
            hazeState = hazeState,
            fadeTop = fadeBottom,
            fadeAtBottom = true,
            modifier = Modifier.fillMaxSize(),
        )
        // UI-30: opaque theme scrim behind the status bar so scrolled covers never show through.
        Box(
            Modifier
                .fillMaxWidth()
                .height(statusInset)
                .background(GotchaColors.WebCanvas.copy(alpha = 0.96f)),
        )
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = statusInset + GlassChrome.NavPillTopGap)
                .fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = GlassChrome.TopPillSideInset)
                    .height(GlassChrome.TopBarHeight)
                    .shadow(
                        elevation = 6.dp,
                        shape = barShape,
                        clip = false,
                        spotColor = Color.Black.copy(alpha = 0.06f),
                        ambientColor = Color.Black.copy(alpha = 0.03f),
                    )
                    .clip(barShape)
                    .background(GotchaColors.SurfaceCard.copy(alpha = pillAlpha)),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    BrandMark(size = 32, elevated = true)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        StreakPill(streakCount)
                        NotificationButton(unreadNotifs, onNotifications)
                        if (searchAvailable) {
                            SearchIconButton(
                                expanded = searchExpanded,
                                onClick = { onSearchExpandedChange(!searchExpanded) },
                            )
                        }
                        UserMenuButton(displayName, email, avatarUrl, onLogout)
                    }
                }
            }
            if (searchExpanded && searchAvailable) {
                WebSearchField(
                    query = searchQuery,
                    onQueryChange = onSearchChange,
                    modifier = Modifier
                        .padding(horizontal = GlassChrome.TopPillSideInset)
                        .padding(top = 8.dp)
                        .focusRequester(searchFocus),
                )
            }
        }
    }
}

@Composable
private fun SearchIconButton(expanded: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .then(
                if (expanded) {
                    Modifier.background(GotchaColors.BrandPurpleSoft)
                } else {
                    Modifier
                        .border(1.dp, GotchaColors.Border, CircleShape)
                        .background(GotchaColors.SurfaceCard)
                },
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Outlined.Search,
            contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_search_library),
            tint = if (expanded) GotchaColors.BrandPurple else GotchaColors.TextMuted,
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun LearnerFrostedBottomBar(
    hazeState: HazeState,
    currentChromeRoute: String,
    onSelect: (String) -> Unit,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val navInset = learnerNavBarInset()
    val totalHeight = fadeTop + GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navInset
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val pillAlpha = if (blurCapable) 0.92f else 0.98f
    val inactiveNav = GotchaColors.TextMuted
    val activeNav = GotchaColors.BrandPurple
    Box(modifier = modifier.fillMaxWidth().height(totalHeight)) {
        ClearGlassSheet(
            hazeState = hazeState,
            fadeTop = fadeTop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = fadeTop)
                .fillMaxWidth()
                .padding(horizontal = GlassChrome.NavSideInset)
                .height(GlassChrome.NavHeight)
                .shadow(
                    elevation = 6.dp,
                    shape = barShape,
                    clip = false,
                    spotColor = Color.Black.copy(alpha = 0.06f),
                    ambientColor = Color.Black.copy(alpha = 0.06f),
                )
                .clip(barShape)
                .background(GotchaColors.SurfaceCard.copy(alpha = pillAlpha))
                .border(1.dp, GotchaColors.Border, barShape),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        horizontal = GlassChrome.NavInnerHorizontalPad,
                        vertical = GlassChrome.NavInnerVerticalPad,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                learnerBottomTabs.forEach { tab ->
                    val selected = isWebNavActive(currentChromeRoute, tab.route)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                            ) { onSelect(tab.route) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier.size(GlassChrome.TabIconCircle),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (selected) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(CircleShape)
                                            .background(GotchaColors.BrandPurple),
                                    )
                                }
                                Icon(
                                    painter = painterResource(tab.iconRes),
                                    contentDescription = androidx.compose.ui.res.stringResource(tab.labelRes),
                                    modifier = Modifier.size(GlassChrome.TabIconSize),
                                    tint = if (selected) Color.White else inactiveNav,
                                )
                            }
                            Text(
                                androidx.compose.ui.res.stringResource(tab.labelRes),
                                modifier = Modifier.padding(top = GlassChrome.TabIconLabelGap),
                                style = TextStyle(
                                    fontFamily = Inter,
                                    fontSize = 10.sp,
                                    lineHeight = 12.sp,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                    color = if (selected) activeNav else inactiveNav,
                                    platformStyle = PlatformTextStyle(includeFontPadding = false),
                                ),
                                maxLines = 1,
                                softWrap = false,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StreakPill(streakCount: Int) {
    Row(
        modifier = Modifier
            .height(36.dp)
            .clip(CircleShape)
            .background(GotchaColors.WebStreakBg)
            .border(1.dp, GotchaColors.WebStreakBorder, CircleShape)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            Icons.Outlined.LocalFireDepartment,
            contentDescription = null,
            tint = GotchaColors.WebStreakIcon,
            modifier = Modifier.size(14.dp),
        )
        Text(
            "$streakCount",
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = GotchaColors.WebStreakText,
        )
    }
}

@Composable
private fun NotificationButton(unreadNotifs: Int, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(40.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .border(1.dp, GotchaColors.Border, CircleShape)
                .background(GotchaColors.SurfaceCard)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClick,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.NotificationsNone,
                contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_notifications),
                tint = GotchaColors.TextMuted,
                modifier = Modifier.size(16.dp),
            )
        }
        if (unreadNotifs > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 2.dp, y = (-2).dp)
                    .defaultMinSize(minWidth = 18.dp, minHeight = 18.dp)
                    .clip(CircleShape)
                    .background(GotchaColors.WebBadge)
                    .padding(horizontal = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (unreadNotifs > 9) "9+" else "$unreadNotifs",
                    color = Color.White,
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
            }
        }
    }
}

@Composable
private fun UserMenuButton(
    displayName: String?,
    email: String?,
    avatarUrl: String?,
    onLogout: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier = Modifier
                .size(36.dp)
                .shadow(2.dp, CircleShape)
                .clip(CircleShape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = { menuOpen = true },
                ),
            contentAlignment = Alignment.Center,
        ) {
            WebUserAvatar(name = displayName ?: email, url = avatarUrl, size = 32)
        }
        if (menuOpen) {
            Popup(
                alignment = Alignment.TopEnd,
                onDismissRequest = { menuOpen = false },
                properties = PopupProperties(focusable = true),
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 44.dp, end = 4.dp)
                        .width(240.dp)
                        .shadow(8.dp, RoundedCornerShape(12.dp))
                        .clip(RoundedCornerShape(12.dp))
                        .background(GotchaColors.SurfaceCard)
                        .padding(12.dp),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        WebUserAvatar(name = displayName ?: email, url = avatarUrl, size = 36)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                displayName.orEmpty().ifBlank { "Learner" },
                                fontFamily = Inter,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaColors.Ink,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                email.orEmpty(),
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.TextMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .padding(vertical = 10.dp)
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(GotchaColors.Border),
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(GotchaColors.Surface)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .clickable {
                                menuOpen = false
                                onLogout()
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = null,
                            tint = GotchaColors.TextMuted,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_log_out),
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WebSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(GlassChrome.SearchPanelHeight)
            .clip(RoundedCornerShape(14.dp))
            .background(GotchaColors.SurfaceCard.copy(alpha = 0.95f))
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            Icons.Outlined.Search,
            contentDescription = null,
            tint = GotchaColors.TextSubtle,
            modifier = Modifier.size(14.dp),
        )
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = TextStyle(
                fontFamily = Inter,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
            ),
            cursorBrush = SolidColor(GotchaColors.BrandPurple),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                if (query.isEmpty()) {
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_search_library),
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextSubtle,
                    )
                }
                inner()
            },
        )
    }
}

@Composable
private fun ClearGlassSheet(
    hazeState: HazeState,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
    fadeAtBottom: Boolean = false,
) {
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val clearTintWhite = if (blurCapable) 0.035f else 0.08f
    val clearTintBlack = if (blurCapable) 0.02f else 0.05f
    val clearBlur = 5.dp
    val clearGlassStyle = HazeStyle(
        backgroundColor = GotchaColors.WebCanvas,
        tints = listOf(
            HazeTint(Color.White.copy(alpha = clearTintWhite)),
            HazeTint(Color.Black.copy(alpha = clearTintBlack)),
        ),
        blurRadius = clearBlur,
        noiseFactor = 0f,
        fallbackTint = HazeTint(Color.Black.copy(alpha = 0.08f)),
    )

    Box(
        modifier = modifier
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                val fadeEnd = (fadeTop.toPx() / size.height).coerceIn(0.1f, 0.55f)
                val stops = if (fadeAtBottom) {
                    arrayOf(
                        0f to Color.Black,
                        (1f - fadeEnd) to Color.Black,
                        (1f - fadeEnd * 0.5f) to Color.Black.copy(alpha = 0.45f),
                        1f to Color.Transparent,
                    )
                } else {
                    arrayOf(
                        0f to Color.Transparent,
                        fadeEnd * 0.5f to Color.Black.copy(alpha = 0.45f),
                        fadeEnd to Color.Black,
                        1f to Color.Black,
                    )
                }
                drawRect(
                    brush = Brush.verticalGradient(colorStops = stops),
                    blendMode = BlendMode.DstIn,
                )
            }
            .hazeChild(state = hazeState, style = clearGlassStyle) {
                backgroundColor = GotchaColors.WebCanvas
                tints = listOf(
                    HazeTint(Color.White.copy(alpha = clearTintWhite)),
                    HazeTint(Color.Black.copy(alpha = clearTintBlack)),
                )
                blurRadius = clearBlur
                noiseFactor = 0f
            },
    )
}

@Composable
private fun SystemStatusGlass(
    hazeState: HazeState,
    fadeBottom: Dp,
    modifier: Modifier = Modifier,
) {
    val statusInset = learnerStatusBarInset()
    ClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeBottom,
        fadeAtBottom = true,
        modifier = modifier
            .fillMaxWidth()
            .height(statusInset + fadeBottom),
    )
    // UI-30: solid scrim under the status bar itself.
    Box(
        modifier
            .fillMaxWidth()
            .height(statusInset)
            .background(GotchaColors.WebCanvas.copy(alpha = 0.96f)),
    )
}

@Composable
private fun SystemNavGlass(
    hazeState: HazeState,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val navInset = learnerNavBarInset()
    ClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeTop,
        modifier = modifier
            .fillMaxWidth()
            .height(fadeTop + navInset),
    )
}

@Composable
fun WebUserAvatar(name: String?, url: String?, size: Int) {
    val src = resolveMediaUrl(url)
    val initials = remember(name) {
        (name ?: "G")
            .trim()
            .split(Regex("\\s+"))
            .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
            .take(2)
            .joinToString("")
            .ifBlank { "G" }
    }
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(GotchaColors.WebMark),
        contentAlignment = Alignment.Center,
    ) {
        if (!src.isNullOrBlank()) {
            AsyncImage(
                model = src,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(
                initials,
                color = Color.White,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = (size * 0.38).sp,
            )
        }
    }
}

fun isWebNavActive(currentRoute: String?, itemRoute: String): Boolean {
    val route = currentRoute?.substringBefore("?") ?: return false
    return when (itemRoute) {
        "library" -> route == "library" || route == "browse" || route.startsWith("content/")
        "vocabulary" -> route == "vocabulary" || route == "words"
        "import" -> route == "import"
        "stats" -> route == "stats" || route == "progress"
        "settings" -> route == "settings" || route == "profile" ||
            route == "edit_profile" || route == "change_password" ||
            route == "native_language" || route == "app_language" ||
            route == "reading_preferences" || route == "reading_settings" ||
            route == "help"
        else -> route == itemRoute
    }
}

fun webChromeRoute(route: String?): String = when {
    route.isNullOrBlank() -> "library"
    route == "words" -> "vocabulary"
    route == "progress" -> "stats"
    route == "profile" || route == "edit_profile" || route == "change_password" ||
        route == "native_language" || route == "app_language" ||
        route == "reading_preferences" || route == "reading_settings" ||
        route == "help" -> "settings"
    route == "browse" || route.startsWith("content/") -> "library"
    else -> route.substringBefore("/")
}
