package app.gotcha.android.ui.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.ui.learner.WebUserAvatar
import app.gotcha.android.ui.theme.BagelFatOne
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebBreakpoints
import app.gotcha.android.ui.theme.webScreenWidthDp

private data class AdminWebNav(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val roles: Set<String>,
    val exact: Boolean = false,
)

private val adminWebNav = listOf(
    AdminWebNav("dashboard", "Dashboard", Icons.Outlined.GridView, setOf("superadmin", "analyst", "editor"), exact = true),
    AdminWebNav("users", "Users", Icons.Outlined.Group, setOf("superadmin", "analyst", "moderator")),
    AdminWebNav("content", "Content Library", Icons.AutoMirrored.Outlined.MenuBook, setOf("superadmin", "editor")),
    AdminWebNav("content", "Moderation Queue", Icons.Outlined.VerifiedUser, setOf("moderator")),
    AdminWebNav("languages", "Languages", Icons.Outlined.Language, setOf("superadmin", "editor", "analyst")),
    AdminWebNav("ai-usage", "AI Usage", Icons.Outlined.Memory, setOf("superadmin", "analyst", "editor")),
    AdminWebNav("gamification", "Gamification", Icons.Outlined.EmojiEvents, setOf("superadmin", "editor", "analyst")),
    AdminWebNav("notifications", "Notifications", Icons.Outlined.NotificationsNone, setOf("superadmin", "editor")),
    AdminWebNav("pricing", "Import & Pricing", Icons.Outlined.CreditCard, setOf("superadmin", "analyst", "editor")),
    AdminWebNav("analytics", "Analytics", Icons.AutoMirrored.Outlined.TrendingUp, setOf("superadmin", "analyst")),
    AdminWebNav("settings", "Settings", Icons.Outlined.Settings, setOf("superadmin")),
)

@Composable
fun WebAdminShellFrame(
    currentRoute: String?,
    role: String?,
    displayName: String?,
    email: String?,
    avatarUrl: String?,
    onNav: (String) -> Unit,
    onLogout: () -> Unit,
    content: @Composable () -> Unit,
) {
    val widthDp = webScreenWidthDp()
    val persistent = widthDp >= WebBreakpoints.Lg
    var drawerOpen by remember { mutableStateOf(false) }
    val userRole = (role ?: "moderator").lowercase()
    val items = adminWebNav.filter { userRole in it.roles }

    Box(Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas)) {
        Row(Modifier.fillMaxSize()) {
            if (persistent) {
                AdminWebSidebar(
                    items = items,
                    currentRoute = currentRoute,
                    displayName = displayName,
                    email = email,
                    avatarUrl = avatarUrl,
                    role = userRole,
                    onNav = onNav,
                    onLogout = onLogout,
                )
            }
            Column(Modifier.weight(1f).fillMaxHeight()) {
                if (!persistent) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.95f))
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            Icons.Outlined.Menu,
                            contentDescription = "Open menu",
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { drawerOpen = true }
                                .padding(8.dp),
                            tint = Color(0xFF0F172A),
                        )
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            app.gotcha.android.ui.components.BrandMark(size = 24)
                            app.gotcha.android.ui.components.BrandWordmark(fontSize = 14, color = GotchaColors.Ink)
                            Text("Admin", fontFamily = Inter, fontSize = 12.sp, color = Color(0xFF64748B))
                        }
                        Icon(
                            Icons.Outlined.NotificationsNone,
                            contentDescription = "Notifications",
                            modifier = Modifier
                                .size(36.dp)
                                .clickable { onNav("notifications") }
                                .padding(6.dp),
                            tint = Color(0xFF334155),
                        )
                        WebUserAvatar(name = displayName ?: email, url = avatarUrl, size = 32)
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFE2E8F0)))
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(GotchaColors.WebAdminCanvas.copy(alpha = 0.95f))
                            .padding(horizontal = 32.dp, vertical = 16.dp),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Outlined.NotificationsNone,
                            contentDescription = "Notifications",
                            modifier = Modifier
                                .size(36.dp)
                                .clickable { onNav("notifications") }
                                .padding(6.dp),
                            tint = Color(0xFF334155),
                        )
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFE2E8F0).copy(alpha = 0.70f)))
                }
                Box(Modifier.weight(1f).fillMaxWidth()) { content() }
            }
        }

        if (!persistent && drawerOpen) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.40f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { drawerOpen = false },
            )
            Box(Modifier.fillMaxHeight().width(240.dp)) {
                AdminWebSidebar(
                    items = items,
                    currentRoute = currentRoute,
                    displayName = displayName,
                    email = email,
                    avatarUrl = avatarUrl,
                    role = userRole,
                    onNav = {
                        drawerOpen = false
                        onNav(it)
                    },
                    onLogout = onLogout,
                )
            }
        }
    }
}

@Composable
private fun AdminWebSidebar(
    items: List<AdminWebNav>,
    currentRoute: String?,
    displayName: String?,
    email: String?,
    avatarUrl: String?,
    role: String,
    onNav: (String) -> Unit,
    onLogout: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(240.dp)
            .fillMaxHeight()
            .background(GotchaColors.WebAdminSidebar)
            .padding(horizontal = 16.dp, vertical = 24.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(start = 12.dp, bottom = 28.dp),
        ) {
            app.gotcha.android.ui.components.BrandMark(size = 32, elevated = true)
            Column {
                app.gotcha.android.ui.components.BrandWordmark(fontSize = 18, color = Color.White)
                Text(
                    "Admin Console",
                    color = Color.White.copy(alpha = 0.3f),
                    fontFamily = Inter,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items.forEach { item ->
                val active = if (item.exact) currentRoute == item.route
                else currentRoute == item.route || currentRoute?.startsWith("${item.route}/") == true
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (active) GotchaColors.WebAdminActive else Color.Transparent)
                        .clickable { onNav(item.route) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(item.icon, contentDescription = null, tint = if (active) Color.White else Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                    Text(
                        item.label,
                        color = if (active) Color.White else Color(0xFF94A3B8),
                        fontFamily = Inter,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(12.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            WebUserAvatar(name = displayName ?: email, url = avatarUrl, size = 40)
            Column(Modifier.weight(1f)) {
                Text(
                    displayName?.ifBlank { null } ?: "Admin",
                    color = Color.White,
                    fontFamily = Inter,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    role.replace('_', ' '),
                    color = Color(0xFF94A3B8),
                    fontFamily = Inter,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                Icons.AutoMirrored.Outlined.Logout,
                contentDescription = "Log out",
                tint = Color(0xFF94A3B8),
                modifier = Modifier.size(16.dp).clickable(onClick = onLogout),
            )
        }
    }
}
