package app.gotcha.android.ui.admin

import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.data.model.AdminActivityItem
import app.gotcha.android.data.model.AdminDashboard
import app.gotcha.android.data.model.AdminMe
import app.gotcha.android.data.model.AdminUserRow
import app.gotcha.android.data.model.AdminUsersResponse
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.ImportPricingResponse
import app.gotcha.android.data.model.ImportPricingRulePatch
import app.gotcha.android.data.model.UpdateImportPricingRulesRequest
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.components.BrandWordmark
import app.gotcha.android.ui.components.ErrorBox
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.theme.GlassChrome
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.haze
import dev.chrisbanes.haze.hazeChild
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.max

private data class AdminTab(val route: String, val label: String, @DrawableRes val iconRes: Int)

private val adminTabs = listOf(
    AdminTab("dashboard", "Dashboard", R.drawable.ic_admin_nav_grid),
    AdminTab("content", "Content", R.drawable.ic_admin_nav_book),
    AdminTab("pricing", "Pricing", R.drawable.ic_admin_nav_card),
    AdminTab("users", "Users", R.drawable.ic_admin_nav_users),
    AdminTab("more", "More", R.drawable.ic_admin_nav_more),
)

private val bottomTabRoutes = adminTabs.map { it.route }.toSet()

/** Bottom inset so lists scroll under frosted bar + system nav. */
val LocalAdminBottomInset = staticCompositionLocalOf { 0.dp }

/** Top inset so headers clear floating top pill + status-bar glass. */
val LocalAdminTopInset = staticCompositionLocalOf { 0.dp }

@Composable
fun AdminShell(onBackToLearner: () -> Unit, onLogout: () -> Unit = {}) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    GotchaSystemBars(darkIcons = true)
    val showChrome = current in bottomTabRoutes

    val hazeState = remember { HazeState() }
    val navBarDp = adminNavBarInset()
    val statusBarDp = adminStatusBarInset()
    val glassFadeTop = 36.dp
    val glassFadeBottom = 36.dp
    val bottomInset =
        if (showChrome) {
            GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navBarDp + GlassChrome.ContentClearance
        } else {
            max(navBarDp - 12.dp, 32.dp)
        }
    val topInset =
        if (showChrome) {
            statusBarDp + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight + GlassChrome.TopContentClearance
        } else {
            // Secondary: top pill hidden, but status frost remains — clear camera/status bar.
            statusBarDp + GlassChrome.TopContentClearance
        }

    CompositionLocalProvider(
        LocalAdminBottomInset provides bottomInset,
        LocalAdminTopInset provides topInset,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.Surface),
        ) {
            NavHost(
                navController = nav,
                startDestination = "dashboard",
                modifier = Modifier
                    .fillMaxSize()
                    .haze(state = hazeState),
            ) {
                composable("dashboard") {
                    AdminDashboardScreen(
                        onOpenUsers = {
                            nav.navigate("users") {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        onOpenContent = {
                            nav.navigate("content") {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        onOpenAiUsage = { nav.navigate("ai-usage") },
                        onOpenSupport = { nav.navigate("support") },
                        onOpenLearner = onBackToLearner,
                    )
                }
                composable("content") {
                    AdminContentScreen(
                        onOpenDetail = { id -> nav.navigate("content/$id") },
                        onAdd = { nav.navigate("add-product") },
                    )
                }
                composable(
                    "content/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminContentDetailScreen(
                        contentId = entry.arguments?.getString("id").orEmpty(),
                        onBack = { nav.popBackStack() },
                        onEdit = { id -> nav.navigate("content/$id/edit") },
                    )
                }
                composable("add-product") {
                    AdminAddProductScreen(
                        onBack = { nav.popBackStack() },
                        onImportSuccess = { item ->
                            nav.navigate("import-success/${item.id}") {
                                popUpTo("add-product") { inclusive = true }
                            }
                        },
                        onImportError = { message ->
                            val encoded = android.net.Uri.encode(message.take(280))
                            nav.navigate("import-error/$encoded")
                        },
                    )
                }
                composable(
                    "content/{id}/edit",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    val id = entry.arguments?.getString("id").orEmpty()
                    AdminAddProductScreen(
                        contentId = id,
                        onBack = { nav.popBackStack() },
                        onImportSuccess = {
                            nav.popBackStack("content", inclusive = false)
                        },
                        onImportError = { message ->
                            val encoded = android.net.Uri.encode(message.take(280))
                            nav.navigate("import-error/$encoded")
                        },
                    )
                }
                composable(
                    "import-success/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminImportSuccessScreen(
                        contentId = entry.arguments?.getString("id").orEmpty(),
                        onDone = { nav.popBackStack("content", inclusive = false) },
                    )
                }
                composable(
                    "import-error/{message}",
                    arguments = listOf(navArgument("message") { type = NavType.StringType }),
                ) { entry ->
                    val raw = entry.arguments?.getString("message").orEmpty()
                    AdminImportErrorScreen(
                        detail = android.net.Uri.decode(raw).ifBlank {
                            "We couldn't process this content. Please check the source and try again."
                        },
                        onRetry = { nav.popBackStack() },
                        onBack = { nav.popBackStack("content", inclusive = false) },
                    )
                }
                composable("pricing") {
                    AdminImportPricingScreen(
                        onOpenLimits = { nav.navigate("pricing/limits") },
                        onOpenTiers = { nav.navigate("pricing/tiers") },
                    )
                }
                composable(
                    "pricing/rule/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminPricingRuleEditScreen(
                        ruleId = entry.arguments?.getString("id").orEmpty(),
                        onBack = { nav.popBackStack() },
                    )
                }
                composable("pricing/limits") {
                    AdminPricingLimitsEditScreen(onBack = { nav.popBackStack() })
                }
                composable("pricing/tiers") {
                    AdminPricingTiersScreen(
                        onBack = { nav.popBackStack() },
                        onOpenTier = { id -> nav.navigate("pricing/tiers/$id") },
                        onAddTier = { nav.navigate("pricing/tiers/new") },
                    )
                }
                composable(
                    "pricing/tiers/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminPricingTierEditScreen(
                        tierId = entry.arguments?.getString("id").orEmpty(),
                        onBack = { nav.popBackStack() },
                    )
                }
                composable("users") {
                    AdminUsersScreen(onOpenUser = { id -> nav.navigate("users/$id") })
                }
                composable(
                    "users/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminUserDetailScreen(
                        userId = entry.arguments?.getString("id").orEmpty(),
                        onBack = { nav.popBackStack() },
                    )
                }
                composable("more") {
                    AdminMoreScreen(
                        onNavigate = { route -> nav.navigate(route) },
                        onLogout = onLogout,
                        onOpenLearner = onBackToLearner,
                    )
                }
                composable("analytics") { AdminAnalyticsScreen(onBack = { nav.popBackStack() }) }
                composable("notifications") { AdminNotificationsScreen(onBack = { nav.popBackStack() }) }
                composable("support") {
                    AdminSupportScreen(
                        onBack = { nav.popBackStack() },
                        onOpenTicket = { id -> nav.navigate("support/$id") },
                    )
                }
                composable(
                    "support/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) { entry ->
                    AdminTicketDetailScreen(
                        ticketId = entry.arguments?.getString("id").orEmpty(),
                        onBack = { nav.popBackStack() },
                    )
                }
                composable("gamification") { AdminGamificationScreen(onBack = { nav.popBackStack() }) }
                composable("languages") { AdminLanguagesScreen(onBack = { nav.popBackStack() }) }
                composable("settings") { AdminSettingsScreen(onBack = { nav.popBackStack() }) }
                composable("ai-usage") { AdminAiUsageScreen(onBack = { nav.popBackStack() }) }
            }

            if (showChrome) {
                AdminFrostedTopBar(
                    modifier = Modifier.align(Alignment.TopCenter),
                    hazeState = hazeState,
                    fadeBottom = glassFadeBottom,
                    onNotifications = { nav.navigate("notifications") },
                )
                AdminFrostedBottomBar(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    hazeState = hazeState,
                    fadeTop = glassFadeTop,
                    currentRoute = current,
                    onSelect = { route ->
                        nav.navigate(route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            } else {
                AdminSystemStatusGlass(
                    modifier = Modifier.align(Alignment.TopCenter),
                    hazeState = hazeState,
                    fadeBottom = 28.dp,
                )
                AdminSystemNavGlass(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    hazeState = hazeState,
                    fadeTop = 40.dp,
                )
            }
        }
    }
}

@Composable
private fun adminNavBarInset(): Dp {
    val fromInsets = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return max(fromInsets, 48.dp)
}

@Composable
private fun adminStatusBarInset(): Dp {
    val fromInsets = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    return max(fromInsets, 24.dp)
}

@Composable
private fun AdminClearGlassSheet(
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
        backgroundColor = GotchaColors.Surface,
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
                backgroundColor = GotchaColors.Surface
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
private fun AdminFrostedTopBar(
    hazeState: HazeState,
    fadeBottom: Dp,
    onNotifications: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val statusInset = adminStatusBarInset()
    val totalHeight = statusInset + GlassChrome.NavPillTopGap + GlassChrome.TopBarHeight + fadeBottom
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    ) {
        AdminClearGlassSheet(
            hazeState = hazeState,
            fadeTop = fadeBottom,
            fadeAtBottom = true,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = statusInset + GlassChrome.NavPillTopGap)
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
                .background(Color.White.copy(alpha = if (blurCapable) 0.90f else 0.96f)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    BrandMark(
                        size = 32,
                        cornerRadius = 7,
                        tileColor = GotchaColors.BrandPurpleMid,
                    )
                    BrandWordmark(
                        fontSize = 18,
                        color = GotchaColors.BrandNavy,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(GotchaColors.Surface)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onNotifications,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_bell),
                        contentDescription = "Notifications",
                        tint = GotchaColors.BrandNavy,
                        modifier = Modifier.size(18.dp),
                    )
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 6.dp, end = 6.dp)
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(GotchaColors.Danger),
                    )
                }
            }
        }
    }
}

@Composable
private fun AdminFrostedBottomBar(
    hazeState: HazeState,
    currentRoute: String?,
    onSelect: (String) -> Unit,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val barShape = RoundedCornerShape(GlassChrome.NavBarCorner)
    val navInset = adminNavBarInset()
    val totalHeight = fadeTop + GlassChrome.NavHeight + GlassChrome.NavPillBottomGap + navInset
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(totalHeight),
    ) {
        AdminClearGlassSheet(
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
                    ambientColor = Color.Black.copy(alpha = 0.03f),
                )
                .clip(barShape)
                .background(Color.White.copy(alpha = if (blurCapable) 0.90f else 0.96f)),
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
                adminTabs.forEach { tab ->
                    val selected = currentRoute == tab.route
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
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
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
                                    contentDescription = tab.label,
                                    modifier = Modifier.size(GlassChrome.TabIconSize),
                                    tint = if (selected) Color.White else GotchaColors.TextSubtle,
                                )
                            }
                            Text(
                                tab.label,
                                modifier = Modifier.padding(top = GlassChrome.TabIconLabelGap),
                                style = TextStyle(
                                    fontFamily = Manrope,
                                    fontSize = 10.sp,
                                    lineHeight = 12.sp,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                    color = if (selected) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                                    // Drop Android font padding; do not Trim (glyphs can paint upward).
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
private fun AdminSystemStatusGlass(
    hazeState: HazeState,
    fadeBottom: Dp,
    modifier: Modifier = Modifier,
) {
    val statusInset = adminStatusBarInset()
    AdminClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeBottom,
        fadeAtBottom = true,
        modifier = modifier
            .fillMaxWidth()
            .height(statusInset + fadeBottom),
    )
}

@Composable
private fun AdminSystemNavGlass(
    hazeState: HazeState,
    fadeTop: Dp,
    modifier: Modifier = Modifier,
) {
    val navInset = adminNavBarInset()
    AdminClearGlassSheet(
        hazeState = hazeState,
        fadeTop = fadeTop,
        modifier = modifier
            .fillMaxWidth()
            .height(fadeTop + navInset),
    )
}

@Composable
private fun AdminDashboardScreen(
    onOpenUsers: () -> Unit,
    onOpenContent: () -> Unit,
    onOpenAiUsage: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenLearner: () -> Unit,
) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<AdminDashboard?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = true
        error = null
        try {
            data = container.adminRepository.dashboard()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load dashboard"
            data = null
        } finally {
            loading = false
        }
    }

    val topInset = LocalAdminTopInset.current
    val bottomInset = LocalAdminBottomInset.current

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> ErrorBox(error!!, onRetry = { reloadKey++ })
        else -> {
            val d = data!!
            val growthAccent = when {
                d.userGrowthPct > 0 -> "+${formatPct(d.userGrowthPct)}%"
                d.userGrowthPct < 0 -> "${formatPct(d.userGrowthPct)}%"
                else -> "0%"
            }
            val revenueAccent = when {
                d.revenueToday > 0 -> "+$${formatCompactMoney(d.revenueToday)}"
                d.revenueMomDelta != 0.0 -> {
                    val sign = if (d.revenueMomDelta > 0) "+" else ""
                    "$sign$${formatCompactMoney(kotlin.math.abs(d.revenueMomDelta))}"
                }
                d.mrrGrowthPct != 0.0 -> {
                    val sign = if (d.mrrGrowthPct > 0) "+" else ""
                    "$sign${formatPct(d.mrrGrowthPct)}%"
                }
                else -> "-"
            }
            val revenueHint = when {
                d.revenueToday > 0 -> "today"
                d.revenueMomDelta != 0.0 -> "MoM"
                else -> "MRR"
            }
            val dailyBars = d.revenueDaily.map { it.mrr }
            val trendBars = if (dailyBars.any { it > 0 }) dailyBars else d.revenueTrend.map { it.mrr }
            val trendLabel = if (dailyBars.any { it > 0 }) "7 Days" else "6 Mo"
            val activities = d.recentActivity.ifEmpty {
                buildList {
                    d.recentUsers.take(3).forEach { user ->
                        add(
                            AdminActivityItem(
                                id = "user:${user.id}",
                                type = "user",
                                title = "New user registered",
                                subtitle = "${user.displayName ?: user.email ?: "User"} • ${user.billingTier ?: "Free"}",
                                createdAt = user.createdAt,
                            ),
                        )
                    }
                    if (d.moderationPending > 0) {
                        add(
                            AdminActivityItem(
                                id = "moderation",
                                type = "support",
                                title = "Moderation queue",
                                subtitle = "${d.moderationPending} pending reviews",
                                createdAt = null,
                            ),
                        )
                    }
                    if (isEmpty() && d.publishedContent > 0) {
                        add(
                            AdminActivityItem(
                                id = "content-count",
                                type = "content",
                                title = "Content published",
                                subtitle = "${d.publishedContent} items live in store",
                                createdAt = null,
                            ),
                        )
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.Surface),
                contentPadding = PaddingValues(top = topInset, bottom = bottomInset + 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item {
                    // Figma 122:61 — title; bell lives in frosted top chrome.
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                    ) {
                        Text("Overview", color = GotchaColors.TextMuted, fontSize = 14.sp, fontFamily = Manrope)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Admin Console",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            color = GotchaColors.Ink,
                        )
                    }
                }
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            MetricCard(
                                label = "Total Users",
                                value = formatInt(d.users),
                                accent = growthAccent,
                                accentHint = "this week",
                                accentColor = if (d.userGrowthPct >= 0) GotchaColors.SuccessBright else GotchaColors.Danger,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable(onClick = onOpenUsers),
                            )
                            MetricCard(
                                label = "Active Today",
                                value = formatInt(d.activeToday),
                                accent = "${formatPct(d.engagementPct)}%",
                                accentHint = "engagement",
                                accentColor = GotchaColors.SuccessBright,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable(onClick = onOpenUsers),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            MetricCard(
                                label = "Revenue",
                                value = "$${formatInt(d.mrr.toInt())}",
                                accent = if (d.importRevenueUzs > 0) {
                                    "${formatInt(d.importRevenueUzs)} ${d.importCurrency ?: "UZS"}"
                                } else {
                                    revenueAccent
                                },
                                accentHint = if (d.importRevenueUzs > 0) "imports mo" else revenueHint,
                                accentColor = if (revenueAccent.startsWith("-") && d.importRevenueUzs <= 0) {
                                    GotchaColors.Danger
                                } else {
                                    GotchaColors.SuccessBright
                                },
                                modifier = Modifier.weight(1f),
                            )
                            MetricCard(
                                label = "AI Lookups",
                                value = formatCompact(d.aiLookupsToday),
                                accent = if (d.aiLimit > 0) "${formatPct(d.aiUsagePct)}%" else "-",
                                accentHint = if (d.aiLimit > 0) "of daily limit" else "today",
                                accentColor = GotchaColors.BrandPurple,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable(onClick = onOpenAiUsage),
                            )
                        }
                    }
                }
                if (trendBars.isNotEmpty()) {
                    item {
                        Column(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                                .padding(16.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Revenue Trend", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = GotchaColors.Ink)
                                Text(trendLabel, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.BrandPurple)
                            }
                            Spacer(Modifier.height(12.dp))
                            MiniBarChart(values = trendBars)
                        }
                    }
                }
                item {
                    Column(modifier = Modifier.padding(horizontal = 24.dp)) {
                        Text("Recent Activity", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = GotchaColors.Ink)
                        Spacer(Modifier.height(12.dp))
                        if (activities.isEmpty()) {
                            EmptyState("No recent activity yet.")
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                activities.take(5).forEach { item ->
                                    val (icon, iconBg, iconTint) = when (item.type?.lowercase()) {
                                        "content" -> Triple(
                                            Icons.AutoMirrored.Outlined.MenuBook,
                                            GotchaColors.BrandPurpleSoft,
                                            GotchaColors.BrandPurple,
                                        )
                                        "support" -> Triple(
                                            Icons.Outlined.WarningAmber,
                                            GotchaColors.WarningBg,
                                            Color(0xFFF59E0B),
                                        )
                                        else -> Triple(
                                            Icons.Outlined.PersonAdd,
                                            GotchaColors.SuccessBg,
                                            GotchaColors.SuccessBright,
                                        )
                                    }
                                    val onClick = when (item.type?.lowercase()) {
                                        "content" -> onOpenContent
                                        "support" -> onOpenSupport
                                        else -> onOpenUsers
                                    }
                                    ActivityRow(
                                        icon = icon,
                                        iconBg = iconBg,
                                        iconTint = iconTint,
                                        title = item.title,
                                        subtitle = item.subtitle.orEmpty()
                                            .replace(" - ", " • ")
                                            .replace(" · ", " • "),
                                        time = relativeShort(item.createdAt),
                                        onClick = onClick,
                                    )
                                }
                            }
                        }
                    }
                }
                item {
                    Text(
                        "Open learner app",
                        color = GotchaColors.BrandPurple,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .padding(horizontal = 24.dp)
                            .clickable(onClick = onOpenLearner),
                    )
                }
            }
        }
    }
}

@Composable
private fun AdminContentScreen(onOpenDetail: (String) -> Unit, onAdd: () -> Unit) {
    val container = LocalAppContainer.current
    var items by remember { mutableStateOf<List<ContentItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("All") }

    LaunchedEffect(Unit) {
        try {
            items = container.adminRepository.content()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load content"
        } finally {
            loading = false
        }
    }

    val filters = listOf("All", "Books", "Stories", "Articles", "News", "Free")
    val filtered = items.filter { item ->
        val qOk = query.isBlank() ||
            (item.title?.contains(query, true) == true) ||
            (item.language?.contains(query, true) == true) ||
            (item.author?.contains(query, true) == true)
        val fOk = when (filter) {
            "Books" -> item.contentType?.equals("book", true) == true || item.contentType?.equals("ebook", true) == true
            "Stories" -> item.contentType?.equals("story", true) == true
            "Articles" -> item.contentType?.equals("article", true) == true
            "News" -> item.contentType?.equals("news", true) == true
            "Free" -> item.isFree == true || (item.priceUsd ?: 0.0) <= 0.0
            else -> true
        }
        qOk && fOk
    }

    val topInset = LocalAdminTopInset.current
    val bottomInset = LocalAdminBottomInset.current

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> ErrorBox(error!!)
        else -> LazyColumn(
            modifier = Modifier.fillMaxSize().background(GotchaColors.Surface),
            contentPadding = PaddingValues(top = topInset, bottom = bottomInset + 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Content Store",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            color = GotchaColors.Ink,
                            modifier = Modifier.weight(1f),
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(GotchaColors.BrandPurple)
                                .clickable(onClick = onAdd)
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.Add, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Add", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        placeholder = { Text("Search content database...", color = GotchaColors.TextSubtle, fontSize = 14.sp) },
                        leadingIcon = {
                            Icon(
                                painter = painterResource(R.drawable.ic_search),
                                contentDescription = null,
                                tint = GotchaColors.TextSubtle,
                                modifier = Modifier.size(16.dp),
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GotchaColors.BrandPurple,
                            unfocusedBorderColor = GotchaColors.Border,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                        ),
                    )
                    Row(
                        modifier = Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(start = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        filters.forEach { chip ->
                            val selected = filter == chip
                            val isFreeChip = chip == "Free"
                            val bg = when {
                                selected -> GotchaColors.BrandPurple
                                isFreeChip -> GotchaColors.SuccessBg
                                else -> Color.White
                            }
                            val border = when {
                                selected -> GotchaColors.BrandPurple
                                isFreeChip -> Color(0xFFA7F3D0)
                                else -> GotchaColors.Border
                            }
                            val fg = when {
                                selected -> Color.White
                                isFreeChip -> GotchaColors.SuccessBright
                                else -> GotchaColors.TextMuted
                            }
                            Text(
                                chip,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(bg)
                                    .border(1.dp, border, RoundedCornerShape(8.dp))
                                    .clickable { filter = chip }
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                color = fg,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
            if (filtered.isEmpty()) {
                item {
                    EmptyState("No content matches this filter.")
                }
            } else {
                // Figma 122:199 — 10dp between content rows
                items(filtered.take(80), key = { it.id }) { item ->
                    ContentStoreRow(item = item, onClick = { onOpenDetail(item.id) })
                }
            }
        }
    }
}

@Composable
private fun ContentStoreRow(item: ContentItem, onClick: () -> Unit) {
    val free = item.isFree == true || (item.priceUsd ?: 0.0) <= 0.0
    val status = item.resolvedStatus()
    val active = status == "published"
    val typeLabel = when (item.contentType?.lowercase()) {
        "book", "ebook", "e-book" -> "Book"
        "story" -> "Story"
        "article" -> "Article"
        "news" -> "News"
        "user_import", "import" -> "Import"
        else -> item.contentType
            ?.replace('_', ' ')
            ?.split(' ')
            ?.joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            ?: "Book"
    }
    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(width = 48.dp, height = 64.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(GotchaColors.BrandPurpleSoft),
            contentAlignment = Alignment.Center,
        ) {
            val cover = item.coverImageUrl ?: item.coverImageKey
            if (!cover.isNullOrBlank()) {
                AsyncImage(
                    model = resolveMediaUrl(cover),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(Icons.AutoMirrored.Outlined.MenuBook, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    (item.language ?: "EN").take(2).uppercase(),
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(GotchaColors.BrandPurpleSoft)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    color = GotchaColors.BrandPurple,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
                Text(
                    (item.cefrLevel ?: "B1").uppercase(),
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    color = GotchaColors.TextMuted,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
                Text(typeLabel, color = GotchaColors.TextSubtle, fontSize = 11.sp)
            }
            Text(
                item.title ?: "Untitled",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                buildString {
                    append(item.salesCount ?: 0)
                    append(if (free) " downloads" else " sales")
                },
                color = GotchaColors.TextMuted,
                fontSize = 11.sp,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                if (free) "Free" else formatUsdMicros(item.priceUsd),
                fontWeight = FontWeight.ExtraBold,
                fontSize = 14.sp,
                color = if (free) GotchaColors.SuccessBright else GotchaColors.BrandPurple,
            )
            Text(
                if (active) "Active" else "Draft",
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (active) GotchaColors.SuccessBg else Color.White)
                    .border(
                        1.dp,
                        if (active) Color(0xFFA7F3D0) else GotchaColors.Border,
                        RoundedCornerShape(6.dp),
                    )
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                color = if (active) GotchaColors.SuccessBright else GotchaColors.TextMuted,
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
            )
        }
    }
}

@Composable
private fun AdminImportPricingScreen(
    onOpenLimits: () -> Unit,
    onOpenTiers: () -> Unit,
) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<ImportPricingResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val topInset = LocalAdminTopInset.current
    val bottomInset = LocalAdminBottomInset.current

    suspend fun reload() {
        data = container.adminRepository.importPricing()
    }

    LaunchedEffect(Unit) {
        try {
            reload()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load import pricing"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> ErrorBox(error!!)
        else -> {
            val d = data!!
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.Surface),
                contentPadding = PaddingValues(
                    start = 24.dp,
                    end = 24.dp,
                    top = topInset,
                    bottom = bottomInset + 16.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Figma 122:395 — Import & Pricing
                item {
                    Text(
                        "Import & Pricing",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 24.sp,
                        color = GotchaColors.Ink,
                    )
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                "Revenue from Imports",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Text(
                                formatUsdMicros(d.stats?.revenueFromImports),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                                color = GotchaColors.BrandPurple,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                "Free Imports Used",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Text(
                                formatInt(d.stats?.freeImportsUsed ?: 0),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                                color = GotchaColors.Ink,
                            )
                        }
                    }
                }
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .clickable(onClick = onOpenLimits)
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            "Free Account Tier Limits",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 14.sp,
                            color = GotchaColors.Ink,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Daily Imports Allowed", color = GotchaColors.TextMuted, fontSize = 11.sp)
                                Text(
                                    "${d.freeLimits?.dailyFreeImportsPerUser ?: 0} imports",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(GotchaColors.Surface)
                                        .padding(10.dp),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = GotchaColors.Ink,
                                )
                            }
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Monthly Pages Cap", color = GotchaColors.TextMuted, fontSize = 11.sp)
                                Text(
                                    "${formatInt(d.freeLimits?.monthlyFreePageLimit ?: 0)} pages",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(GotchaColors.Surface)
                                        .padding(10.dp),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = GotchaColors.Ink,
                                )
                            }
                        }
                    }
                }
                // Not on Figma 122:395 — linked destination matching web Import & Pricing → Page Tiers
                if (d.tiers.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .clickable(onClick = onOpenTiers)
                                .padding(horizontal = 14.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Page Tiers",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(
                                    "${d.tiers.size} Atmos page-based prices",
                                    color = GotchaColors.TextMuted,
                                    fontSize = 12.sp,
                                )
                            }
                            Text("›", fontSize = 22.sp, color = GotchaColors.TextMuted)
                        }
                    }
                }
            }
        }
    }
}

/** Figma 122:395 short type labels (live rules keep full labels on edit). */
internal fun pricingRuleShortLabel(key: String?, label: String?): String {
    val k = key?.lowercase().orEmpty()
    return when {
        k.contains("ebook") || k.contains("book") || k.contains("novel") -> "E-Book"
        k.contains("article") || k.contains("webpage") -> "Article"
        k.contains("news") -> "News"
        k.contains("research") -> "Research"
        k.contains("custom") -> "Custom"
        else -> label?.substringBefore(" / ")?.substringBefore(" · ")?.trim()?.ifBlank { null }
            ?: label ?: key ?: "Type"
    }
}

@Composable
private fun AdminUsersScreen(onOpenUser: (String) -> Unit) {
    val container = LocalAppContainer.current
    var response by remember { mutableStateOf<AdminUsersResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf("All") }
    var query by remember { mutableStateOf("") }
    var debouncedQuery by remember { mutableStateOf("") }
    var showSearch by remember { mutableStateOf(false) }
    val topInset = LocalAdminTopInset.current
    val bottomInset = LocalAdminBottomInset.current

    LaunchedEffect(query) {
        delay(300)
        debouncedQuery = query.trim()
    }

    LaunchedEffect(filter, debouncedQuery) {
        loading = true
        error = null
        val tier = when (filter) {
            "Pay as you go" -> "payg"
            "Free" -> "free"
            else -> null
        }
        val status = when (filter) {
            "Suspended" -> "suspended"
            else -> null
        }
        try {
            response = container.adminRepository.users(
                q = debouncedQuery.ifBlank { null },
                tier = tier,
                status = status,
            )
        } catch (e: Exception) {
            error = e.message ?: "Failed to load users"
            response = null
        } finally {
            loading = false
        }
    }

    val rows = response?.users.orEmpty()

    when {
        loading && response == null -> LoadingBox(Modifier.fillMaxSize())
        error != null && response == null -> ErrorBox(error!!)
        else -> LazyColumn(
            modifier = Modifier.fillMaxSize().background(GotchaColors.Surface),
            contentPadding = PaddingValues(top = topInset, bottom = bottomInset + 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Users",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            color = GotchaColors.Ink,
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "Total: ${formatInt(response?.stats?.total ?: rows.size)} users",
                            color = GotchaColors.TextMuted,
                            fontSize = 12.sp,
                        )
                    }
                    Icon(
                        painter = painterResource(R.drawable.ic_search),
                        contentDescription = "Search",
                        tint = GotchaColors.Ink,
                        modifier = Modifier
                            .size(24.dp)
                            .clickable { showSearch = !showSearch },
                    )
                }
            }
            if (showSearch) {
                item {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        placeholder = { Text("Search users...", color = GotchaColors.TextSubtle) },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GotchaColors.BrandPurple,
                            unfocusedBorderColor = GotchaColors.Border,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                        ),
                    )
                }
            }
            item {
                Row(
                    modifier = Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(start = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf("All", "Pay as you go", "Free", "Suspended").forEach { chip ->
                        val selected = filter == chip
                        val isAlert = chip == "Suspended"
                        val label = when {
                            chip == "Suspended" && (response?.stats?.suspended ?: 0) > 0 ->
                                "Suspended (${response?.stats?.suspended})"
                            else -> chip
                        }
                        val bg = when {
                            selected -> GotchaColors.BrandPurple
                            isAlert -> Color(0xFFFEE2E2)
                            else -> Color.White
                        }
                        val border = when {
                            selected -> GotchaColors.BrandPurple
                            isAlert -> Color(0xFFFCA5A5)
                            else -> GotchaColors.Border
                        }
                        val fg = when {
                            selected -> Color.White
                            isAlert -> GotchaColors.Danger
                            else -> GotchaColors.TextMuted
                        }
                        Text(
                            label,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(bg)
                                .border(1.dp, border, RoundedCornerShape(8.dp))
                                .clickable { filter = chip }
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            color = fg,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
            if (loading) {
                item { LoadingBox(Modifier.fillMaxWidth().padding(24.dp)) }
            } else if (rows.isEmpty()) {
                item {
                    EmptyState(
                        when (filter) {
                            "Suspended" -> "No suspended users."
                            else -> "No users found."
                        },
                    )
                }
            } else {
                items(rows, key = { it.id }) { user ->
                    UserRow(user = user, onClick = { onOpenUser(user.id) })
                }
            }
        }
    }
}

@Composable
private fun UserRow(user: AdminUserRow, onClick: () -> Unit) {
    val payg = user.billingTier?.contains("pay", true) == true ||
        user.planLabel?.contains("pay", true) == true
    val planLabel = user.planLabel
        ?: if (payg) "Pay as you go" else "Free"
    val statusColor = when {
        user.isSuspended -> GotchaColors.Danger
        user.isActiveRecently -> GotchaColors.SuccessBright
        else -> Color(0xFF99A1AF)
    }
    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(GotchaColors.BrandPurpleSoft),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                (user.displayName ?: user.email).take(1).uppercase(),
                fontWeight = FontWeight.Bold,
                color = GotchaColors.BrandPurple,
                fontSize = 14.sp,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    user.displayName ?: user.email,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(statusColor),
                )
            }
            Text(user.email, color = GotchaColors.TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                planLabel,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (payg) GotchaColors.BrandPurpleSoft else Color(0xFFF3F4F6))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
                color = if (payg) GotchaColors.BrandPurple else GotchaColors.TextMuted,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
            )
            Text(
                "Joined ${formatJoined(user.createdAt)}",
                color = GotchaColors.TextSubtle,
                fontSize = 10.sp,
            )
        }
    }
}

@Composable
private fun AdminMoreScreen(
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
    onOpenLearner: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var me by remember { mutableStateOf<AdminMe?>(null) }
    var scheduledCampaigns by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        runCatching { me = container.adminRepository.me() }
        runCatching {
            val n = container.adminRepository.notifications()
            scheduledCampaigns = (n.stats?.scheduled ?: 0) + (n.stats?.draft ?: 0)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(GotchaColors.Surface),
        contentPadding = PaddingValues(
            start = 24.dp,
            end = 24.dp,
            top = LocalAdminTopInset.current,
            bottom = LocalAdminBottomInset.current + 16.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            // Figma 122:773 — title is "More Console Options"
            Text(
                "More Console Options",
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 24.sp,
                color = GotchaColors.Ink,
            )
        }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp)),
            ) {
                // Figma 122:773 — order: Notifications, Gamification, AI Usage, Analytics, Support, Languages, Level Tests, Settings
                MoreRow(Icons.Outlined.Campaign, "Notifications & Campaigns", badge = scheduledCampaigns.takeIf { it > 0 }, badgeColor = GotchaColors.BrandPurple) {
                    onNavigate("notifications")
                }
                MoreRow(Icons.Outlined.EmojiEvents, "Gamification & Streaks") { onNavigate("gamification") }
                MoreRow(Icons.Outlined.Memory, "AI Usage") { onNavigate("ai-usage") }
                MoreRow(Icons.AutoMirrored.Outlined.TrendingUp, "Analytics") { onNavigate("analytics") }
                MoreRow(Icons.Outlined.Language, "Supported Languages") { onNavigate("languages") }
                MoreRow(Icons.Outlined.Settings, "Global Console Settings", showDivider = false) { onNavigate("settings") }
            }
        }
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(GotchaColors.BrandPurple),
                    contentAlignment = Alignment.Center,
                ) {
                    val photo = resolveMediaUrl(me?.avatarUrl)
                    if (!photo.isNullOrBlank()) {
                        AsyncImage(
                            model = photo,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Text(
                            (me?.displayName ?: me?.email ?: "A").take(1).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        me?.displayName?.takeIf { it.isNotBlank() } ?: me?.email ?: "Admin",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        modifier = Modifier.clickable(onClick = onOpenLearner),
                    )
                    Text(
                        me?.role?.replace('_', ' ')?.split(' ')?.joinToString(" ") {
                            it.replaceFirstChar { c -> c.uppercase() }
                        } ?: "Super Admin",
                        color = GotchaColors.TextMuted,
                        fontSize = 11.sp,
                    )
                }
                Text(
                    "Sign Out",
                    color = GotchaColors.Danger,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    modifier = Modifier.clickable {
                        scope.launch {
                            container.authRepository.logout()
                            onLogout()
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun MoreRow(
    icon: ImageVector,
    label: String,
    badge: Int? = null,
    badgeColor: Color = GotchaColors.BrandPurple,
    showDivider: Boolean = true,
    onClick: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, tint = GotchaColors.Ink, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(12.dp))
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink, modifier = Modifier.weight(1f))
            if (badge != null) {
                Text(
                    "$badge",
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(badgeColor)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
                Spacer(Modifier.width(6.dp))
            }
            Text("›", color = GotchaColors.TextSubtle, fontSize = 18.sp)
        }
        if (showDivider) {
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))
        }
    }
}

@Composable
internal fun MetricCard(
    label: String,
    value: String,
    accent: String,
    accentHint: String,
    accentColor: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = GotchaColors.TextMuted)
        Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = GotchaColors.Ink)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(accent, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = accentColor)
            Spacer(Modifier.width(4.dp))
            Text(accentHint, fontSize = 10.sp, color = GotchaColors.TextMuted)
        }
    }
}

@Composable
internal fun MiniBarChart(
    values: List<Double>,
    heightDp: Int = 90,
    barWidthDp: Int = 12,
) {
    val maxV = values.maxOrNull()?.takeIf { it > 0 } ?: 1.0
    val chartH = heightDp.toFloat()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(heightDp.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom,
    ) {
        values.forEach { v ->
            val h = ((v / maxV) * chartH).coerceIn(8.0, chartH.toDouble()).dp
            Box(
                modifier = Modifier
                    .width(barWidthDp.dp)
                    .height(h)
                    .clip(RoundedCornerShape(3.dp))
                    .background(GotchaColors.BrandPurple),
            )
        }
    }
}

@Composable
internal fun ActivityRow(
    icon: ImageVector,
    iconBg: Color,
    title: String,
    subtitle: String,
    time: String,
    onClick: (() -> Unit)? = null,
    iconTint: Color = GotchaColors.Ink,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(iconBg),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(14.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
            Text(subtitle, color = GotchaColors.TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(time, color = GotchaColors.TextSubtle, fontSize = 11.sp)
    }
}

@Composable
internal fun EmptyState(message: String) {
    Text(
        message,
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(20.dp),
        color = GotchaColors.TextMuted,
        fontSize = 14.sp,
    )
}

@Composable
internal fun AdminBackHeader(title: String, onBack: () -> Unit, trailing: (@Composable () -> Unit)? = null) {
    // Figma SubScreenHeader (208:18 etc.) — circular bordered back + ExtraBold 20 title
    val topInset = LocalAdminTopInset.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = topInset)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.AutoMirrored.Outlined.ArrowBack,
                contentDescription = "Back",
                modifier = Modifier.size(18.dp),
                tint = GotchaColors.Ink,
            )
        }
        Text(
            title,
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 20.sp,
            color = GotchaColors.Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        trailing?.invoke()
    }
}

@Composable
private fun LimitRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = GotchaColors.TextMuted, fontSize = 13.sp)
        Text(value, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
    }
}

internal fun formatInt(value: Int): String =
    NumberFormat.getNumberInstance(Locale.US).format(value)

internal fun formatPct(value: Double): String =
    if (kotlin.math.abs(value % 1.0) < 0.05) value.toInt().toString()
    else String.format(Locale.US, "%.1f", value)

internal fun formatCompactMoney(value: Double): String = when {
    kotlin.math.abs(value) >= 1_000 -> {
        val k = value / 1_000.0
        if (kotlin.math.abs(k % 1.0) < 0.05) "${k.toInt()}K"
        else String.format(Locale.US, "%.1fK", k)
    }
    kotlin.math.abs(value) >= 100 -> value.toInt().toString()
    else -> String.format(Locale.US, "%.2f", value)
}

internal fun formatCompact(value: Int): String = when {
    value >= 1_000_000 -> {
        val m = value / 1_000_000.0
        if (m % 1.0 == 0.0) "${m.toInt()}M" else "%.1fM".format(m)
    }
    value >= 1_000 -> {
        val k = value / 1_000.0
        if (k % 1.0 == 0.0) "${k.toInt()}K" else "%.1fK".format(k)
    }
    else -> formatInt(value)
}

/** Import-pricing amounts are UZS soʻm (same as web admin `formatMoney`). */
internal fun formatUsdMicros(amount: Double?): String {
    val n = amount ?: 0.0
    val formatted = NumberFormat.getNumberInstance(Locale("uz", "UZ")).apply {
        maximumFractionDigits = if (n >= 100 || n % 1.0 == 0.0) 0 else 2
        minimumFractionDigits = 0
    }.format(n)
    return "$formatted soʻm"
}

/** Dense list-row money (no unit) so Figma horizontal Base/Page + switch fits. */
internal fun formatSomList(amount: Double?): String {
    val n = amount ?: 0.0
    return if (n >= 1000) formatCompact(n.toInt())
    else NumberFormat.getNumberInstance(Locale("uz", "UZ")).apply {
        maximumFractionDigits = if (n % 1.0 == 0.0) 0 else 2
        minimumFractionDigits = 0
    }.format(n)
}

internal fun relativeShort(iso: String?): String {
    if (iso.isNullOrBlank()) return "-"
    return try {
        val normalized = iso.trim().replace(' ', 'T')
        val parsed = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(
            normalized.take(19),
        ) ?: return iso.take(10)
        val diffMs = System.currentTimeMillis() - parsed.time
        val mins = diffMs / 60_000
        when {
            mins < 1 -> "now"
            mins < 60 -> "${mins}m ago"
            mins < 24 * 60 -> "${mins / 60}h ago"
            mins < 7 * 24 * 60 -> "${mins / (24 * 60)}d ago"
            else -> iso.take(10)
        }
    } catch (_: Exception) {
        iso.take(10)
    }
}

internal fun formatJoined(iso: String?): String {
    if (iso.isNullOrBlank()) return "recently"
    // ISO timestamps: 2025-10-12T... → "Oct 2025"
    val date = iso.take(10)
    val parts = date.split("-")
    if (parts.size < 2) return date
    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val monthIdx = parts[1].toIntOrNull()?.minus(1) ?: return date
    val year = parts[0]
    val month = months.getOrNull(monthIdx) ?: return date
    return "$month $year"
}
