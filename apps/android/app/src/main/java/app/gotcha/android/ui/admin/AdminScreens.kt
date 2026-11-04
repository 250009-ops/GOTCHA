package app.gotcha.android.ui.admin

import app.gotcha.android.ui.theme.GotchaBlue
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Group
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
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.Manrope
import app.gotcha.android.ui.theme.webPageHorizontalPad
import app.gotcha.android.ui.theme.webScreenWidthDp
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
    val container = LocalAppContainer.current
    var me by remember { mutableStateOf<AdminMe?>(null) }
    LaunchedEffect(Unit) {
        runCatching { me = container.adminRepository.me() }
        if (me?.role.equals("moderator", true) && (current == null || current == "dashboard")) {
            nav.navigate("content") { launchSingleTop = true }
        }
    }

    fun goTab(route: String) {
        nav.navigate(route) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    CompositionLocalProvider(
        LocalAdminBottomInset provides 0.dp,
        LocalAdminTopInset provides 0.dp,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .background(GotchaColors.WebAdminCanvas),
        ) {
            WebAdminShellFrame(
                currentRoute = current,
                role = me?.role,
                displayName = me?.displayName,
                email = me?.email,
                avatarUrl = me?.avatarUrl,
                onNav = ::goTab,
                onLogout = onLogout,
            ) {
            NavHost(
                navController = nav,
                startDestination = "dashboard",
                modifier = Modifier.fillMaxSize(),
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
            }
        }
    }
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
    var firstName by remember { mutableStateOf("Admin") }

    LaunchedEffect(Unit) {
        runCatching {
            val me = container.adminRepository.me()
            firstName = me.displayName?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() }
                ?: me.email?.substringBefore("@")
                ?: "Admin"
        }
    }

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
            val pad = webPageHorizontalPad(webScreenWidthDp())
            val wide = webScreenWidthDp() >= 1024
            val growthHintColor = if (d.userGrowthPct >= 0) Color(0xFF059669) else Color(0xFFE11D48)
            val growthHint = when {
                d.userGrowthPct > 0 -> "+${formatPct(d.userGrowthPct)}% this week"
                d.userGrowthPct < 0 -> "${formatPct(d.userGrowthPct)}% this week"
                else -> "0% this week"
            }
            val revenueValue = when {
                d.revenue > 0 -> d.revenue
                d.importRevenueUzs > 0 -> d.importRevenueUzs.toDouble()
                else -> d.mrr
            }
            val revenueHint = buildString {
                if (d.revenueToday > 0) append("+${formatUzs(d.revenueToday)} today")
                else if (d.revenueGrowthPct != 0.0) {
                    val sign = if (d.revenueGrowthPct > 0) "+" else ""
                    append("${sign}${formatPct(d.revenueGrowthPct)}% MoM")
                } else append("Real Atmos import payments only")
            }
            val hasDaily = d.revenueDaily.any { it.chartValue() > 0 }
            val revenueBars = (if (hasDaily) d.revenueDaily else d.revenueTrend).map {
                (it.month ?: it.day ?: "") to it.chartValue().toFloat()
            }
            val revenueBadge = if (hasDaily) "7 Days" else "6 Mo"
            val userGrowthPoints = d.userGrowth.map { (it.month ?: "") to it.users.toFloat() }
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
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(top = topInset, bottom = bottomInset + 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item {
                    AdminPageHeader(
                        title = "Dashboard Overview",
                        subtitle = "Welcome back, $firstName. Live platform metrics from the database.",
                    )
                }
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = pad),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AdminStatCard(
                                label = "Total Users",
                                value = formatInt(d.users),
                                hint = growthHint,
                                hintColor = growthHintColor,
                                icon = Icons.Outlined.Group,
                                modifier = Modifier.weight(1f).clickable(onClick = onOpenUsers),
                            )
                            AdminStatCard(
                                label = "Active Today",
                                value = formatInt(d.activeToday),
                                hint = "${formatPct(d.engagementPct)}% engagement · ${formatInt(d.activeSubscribers)} pay as you go",
                                hintColor = Color(0xFF059669),
                                icon = Icons.Outlined.CreditCard,
                                accentBg = Color(0xFFF0F9FF),
                                accentFg = GotchaBlue.InfoText,
                                modifier = Modifier.weight(1f).clickable(onClick = onOpenUsers),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AdminStatCard(
                                label = "Revenue",
                                value = formatUzs(revenueValue),
                                hint = revenueHint,
                                hintColor = Color(0xFF059669),
                                icon = Icons.AutoMirrored.Outlined.TrendingUp,
                                accentBg = Color(0xFFECFDF5),
                                accentFg = Color(0xFF047857),
                                modifier = Modifier.weight(1f),
                            )
                            AdminStatCard(
                                label = "AI Lookups",
                                value = formatCompact(d.aiLookupsToday),
                                hint = if (d.aiLimit > 0) "${formatPct(d.aiUsagePct)}% of daily limit" else "No platform limit configured",
                                hintColor = GotchaColors.WebAdminActive,
                                icon = Icons.Outlined.Memory,
                                accentBg = Color(0xFFFAE8FF),
                                accentFg = Color(0xFFA21CAF),
                                modifier = Modifier.weight(1f).clickable(onClick = onOpenAiUsage),
                            )
                        }
                    }
                }
                item {
                    if (wide) {
                        Row(
                            Modifier.padding(horizontal = pad),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            AdminCard(Modifier.weight(1f)) {
                                DashboardChartHeader(
                                    "User Growth Trend",
                                    if (d.userGrowth.isNotEmpty()) {
                                        "${d.userGrowth.first().month ?: ""} – ${d.userGrowth.last().month ?: ""}"
                                    } else "No data",
                                )
                                AdminLineChart(userGrowthPoints)
                            }
                            AdminCard(Modifier.weight(1f)) {
                                DashboardChartHeader("Revenue Trend", revenueBadge, accent = true)
                                AdminBarChart(revenueBars)
                            }
                        }
                    } else {
                        Column(
                            Modifier.padding(horizontal = pad),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            AdminCard {
                                DashboardChartHeader(
                                    "User Growth Trend",
                                    if (d.userGrowth.isNotEmpty()) {
                                        "${d.userGrowth.first().month ?: ""} – ${d.userGrowth.last().month ?: ""}"
                                    } else "No data",
                                )
                                AdminLineChart(userGrowthPoints)
                            }
                            AdminCard {
                                DashboardChartHeader("Revenue Trend", revenueBadge, accent = true)
                                AdminBarChart(revenueBars)
                            }
                        }
                    }
                }
                if (d.aiCategories.isNotEmpty() || d.topPhrases.isNotEmpty()) {
                    item {
                        Column(
                            Modifier.padding(horizontal = pad),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (d.aiCategories.isNotEmpty()) {
                                AdminCard {
                                    Text("AI Lookup Categories", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF0F172A))
                                    Spacer(Modifier.height(12.dp))
                                    d.aiCategories.forEach { cat ->
                                        Row(
                                            Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        ) {
                                            Box(Modifier.size(10.dp).clip(CircleShape).background(parseAdminHex(cat.color)))
                                            Text(cat.name, fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF475569), modifier = Modifier.weight(1f))
                                            Text("${cat.pct.toInt()}%", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF0F172A))
                                        }
                                    }
                                }
                            }
                            if (d.topPhrases.isNotEmpty()) {
                                AdminCard {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Most Looked-up Idioms & Phrases", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF0F172A), modifier = Modifier.weight(1f))
                                        Text("View Library", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.WebAdminActive, modifier = Modifier.clickable(onClick = onOpenContent))
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    d.topPhrases.take(6).forEach { row ->
                                        Row(
                                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                        ) {
                                            Column(Modifier.weight(1f)) {
                                                Text(row.phrase, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = Color(0xFF0F172A))
                                                Text("${row.language} · ${row.level.uppercase()}", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF64748B))
                                            }
                                            Text("${row.lookups} · ${row.aiMatch.toInt()}%", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFF059669))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (activities.isNotEmpty()) {
                    item {
                        AdminCard(Modifier.padding(horizontal = pad)) {
                            Text("Recent Activity", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF0F172A))
                            Spacer(Modifier.height(12.dp))
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                activities.take(8).forEach { item ->
                                    val onClick = when (item.type?.lowercase()) {
                                        "content" -> onOpenContent
                                        "support" -> onOpenSupport
                                        else -> onOpenUsers
                                    }
                                    val (icon, iconBg, iconTint) = when (item.type?.lowercase()) {
                                        "content" -> Triple(Icons.AutoMirrored.Outlined.MenuBook, GotchaBlue.B100, GotchaBlue.B700)
                                        "support" -> Triple(Icons.Outlined.WarningAmber, Color(0xFFFEF3C7), Color(0xFFF59E0B))
                                        else -> Triple(Icons.Outlined.PersonAdd, Color(0xFFECFDF5), Color(0xFF10B981))
                                    }
                                    ActivityRow(
                                        icon = icon,
                                        iconBg = iconBg,
                                        iconTint = iconTint,
                                        title = item.title,
                                        subtitle = item.subtitle.orEmpty().replace(" - ", " • ").replace(" · ", " • "),
                                        time = relativeShort(item.createdAt),
                                        onClick = onClick,
                                    )
                                }
                            }
                        }
                    }
                }
                item {
                    AdminCard(Modifier.padding(horizontal = pad)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Recent User Acquisitions", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF0F172A))
                            Text("View users", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.WebAdminActive, modifier = Modifier.clickable(onClick = onOpenUsers))
                        }
                        Spacer(Modifier.height(12.dp))
                        if (d.recentUsers.isEmpty()) {
                            Text("No users yet.", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF64748B), modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp))
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                d.recentUsers.take(8).forEach { user ->
                                    Row(
                                        Modifier.fillMaxWidth().clickable { onOpenUsers() },
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    ) {
                                        Box(
                                            Modifier.size(32.dp).clip(CircleShape).background(GotchaBlue.B50),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Text(
                                                (user.displayName ?: user.email ?: "L").take(1).uppercase(),
                                                fontFamily = Inter,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                                color = GotchaColors.WebAdminActive,
                                            )
                                        }
                                        Column(Modifier.weight(1f)) {
                                            Text(user.displayName ?: "Learner", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = Color(0xFF0F172A))
                                            Text(user.email.orEmpty(), fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF64748B), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        }
                                        AdminBadge(user.billingTier ?: "Free")
                                    }
                                }
                            }
                        }
                    }
                }
                item {
                    Text(
                        "Open learner app",
                        color = GotchaColors.WebAdminActive,
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = pad).clickable(onClick = onOpenLearner),
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

    val filters = listOf("All", "Books", "Articles", "News", "User Imports")
    val filtered = items.filter { item ->
        val qOk = query.isBlank() ||
            (item.title?.contains(query, true) == true) ||
            (item.language?.contains(query, true) == true) ||
            (item.author?.contains(query, true) == true)
        val type = item.contentType.orEmpty().lowercase()
        val source = item.contentSource.orEmpty().lowercase()
        val fOk = when (filter) {
            "Books" -> type == "book" || type == "ebook" || type == "e-book"
            "Articles" -> type == "article"
            "News" -> type == "news"
            "User Imports" -> type.contains("import") || source.contains("user") || source.contains("import")
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
            modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
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
                        Column(Modifier.weight(1f)) {
                            Text(
                                "Content Library",
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 26.sp,
                                color = Color(0xFF0F172A),
                            )
                            Text(
                                "Catalog, licenses, and user imports",
                                fontFamily = Inter,
                                fontSize = 14.sp,
                                color = Color(0xFF64748B),
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(GotchaColors.WebAdminActive)
                                .clickable(onClick = onAdd)
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.Add, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Add product", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
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
                            val bg = when {
                                selected -> GotchaColors.WebAdminActive
                                else -> Color.White
                            }
                            val border = when {
                                selected -> GotchaColors.WebAdminActive
                                else -> Color(0xFFE2E8F0)
                            }
                            val fg = when {
                                selected -> Color.White
                                else -> Color(0xFF475569)
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
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
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
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 26.sp,
                        color = Color(0xFF0F172A),
                    )
                    Text(
                        "Atmos import payments, free limits, and page tiers",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = Color(0xFF64748B),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AdminStatCard(
                                label = "Revenue from Imports",
                                value = formatUsdMicros(d.stats?.revenueFromImports),
                                hint = if ((d.stats?.revenueGrowthPct ?: 0.0) != 0.0) {
                                    val g = d.stats!!.revenueGrowthPct
                                    val sign = if (g > 0) "+" else ""
                                    "${sign}${formatPct(g)}% MoM"
                                } else "Atmos payments",
                                hintColor = Color(0xFF059669),
                                icon = Icons.AutoMirrored.Outlined.TrendingUp,
                                accentBg = Color(0xFFECFDF5),
                                accentFg = Color(0xFF047857),
                                modifier = Modifier.weight(1f),
                            )
                            AdminStatCard(
                                label = "Free Imports Used",
                                value = formatInt(d.stats?.freeImportsUsed ?: 0),
                                hint = "${formatInt(d.stats?.freeImportsPool ?: 0)} pool",
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AdminStatCard(
                                label = "Imports Today",
                                value = formatInt(d.stats?.totalImportsToday ?: 0),
                                hint = if ((d.stats?.importsGrowthPct ?: 0.0) != 0.0) {
                                    val g = d.stats!!.importsGrowthPct
                                    val sign = if (g > 0) "+" else ""
                                    "${sign}${formatPct(g)}%"
                                } else null,
                                modifier = Modifier.weight(1f),
                            )
                            AdminStatCard(
                                label = "Conversion",
                                value = "${formatPct(d.stats?.conversionPct ?: 0.0)}%",
                                modifier = Modifier.weight(1f),
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
            modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
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
                            fontFamily = Inter,
                            fontWeight = FontWeight.Bold,
                            fontSize = 26.sp,
                            color = Color(0xFF0F172A),
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Total: ${formatInt(response?.stats?.total ?: rows.size)} users",
                            fontFamily = Inter,
                            color = Color(0xFF64748B),
                            fontSize = 14.sp,
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
            item {
                val stats = response?.stats
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        AdminStatCard(
                            label = "Total Users",
                            value = formatInt(stats?.total ?: rows.size),
                            icon = Icons.Outlined.Group,
                            modifier = Modifier.weight(1f),
                        )
                        AdminStatCard(
                            label = "Pay as you go",
                            value = formatInt(stats?.payAsYouGo ?: 0),
                            accentBg = GotchaBlue.B50,
                            accentFg = GotchaColors.WebAdminActive,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        AdminStatCard(
                            label = "Free",
                            value = formatInt(stats?.free ?: 0),
                            accentBg = Color(0xFFF1F5F9),
                            accentFg = Color(0xFF475569),
                            modifier = Modifier.weight(1f),
                        )
                        AdminStatCard(
                            label = "Suspended",
                            value = formatInt(stats?.suspended ?: 0),
                            hintColor = Color(0xFFE11D48),
                            accentBg = Color(0xFFFFF1F2),
                            accentFg = Color(0xFFE11D48),
                            icon = Icons.Outlined.WarningAmber,
                            modifier = Modifier.weight(1f),
                        )
                    }
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
                            selected -> GotchaColors.WebAdminActive
                            isAlert -> Color(0xFFFEE2E2)
                            else -> Color.White
                        }
                        val border = when {
                            selected -> GotchaColors.WebAdminActive
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
        modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
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
                "More",
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                color = Color(0xFF0F172A),
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
private fun DashboardChartHeader(title: String, badge: String, accent: Boolean = false) {
    Row(
        Modifier.fillMaxWidth().padding(bottom = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF0F172A))
        AdminBadge(
            badge,
            bg = if (accent) GotchaBlue.B100 else Color(0xFFF1F5F9),
            fg = if (accent) GotchaBlue.B700 else Color(0xFF475569),
        )
    }
}

private fun parseAdminHex(raw: String): Color = try {
    val hex = if (raw.startsWith("#")) raw else "#$raw"
    Color(android.graphics.Color.parseColor(hex))
} catch (_: Exception) {
    GotchaBlue.B700
}

internal fun formatUzs(value: Double): String {
    val n = NumberFormat.getIntegerInstance(Locale.US).format(kotlin.math.round(value).toLong())
    return "$n UZS"
}

@Composable
internal fun AdminBackHeader(title: String, onBack: () -> Unit, trailing: (@Composable () -> Unit)? = null, showBack: Boolean = true, subtitle: String? = null) {
    if (!showBack) {
        AdminPageHeader(title = title, subtitle = subtitle, actions = trailing)
        return
    }
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
        Column(Modifier.weight(1f)) {
            Text(
                title,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = Color(0xFF0F172A),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, fontFamily = Inter, fontSize = 13.sp, color = Color(0xFF64748B))
            }
        }
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
