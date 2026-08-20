package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.model.ImportQuoteFreeLimits
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars

@Composable
fun ImportScreen(
    onClose: () -> Unit,
    onBrowseCatalog: () -> Unit,
    onOpenUrl: () -> Unit = {},
    onOpenPaste: () -> Unit = {},
    onOpenFile: () -> Unit = {},
) {
    GotchaSystemBars(darkIcons = true)
    val container = LocalAppContainer.current
    var recent by remember { mutableStateOf<List<UserImport>>(emptyList()) }
    var allowance by remember { mutableStateOf<ImportQuoteFreeLimits?>(null) }

    LaunchedEffect(Unit) {
        val listed = runCatching { container.importRepository.list() }.getOrNull()
        recent = listed?.items.orEmpty()
        allowance = listed?.freeAllowance
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .learnerDirectoryStatusPad()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(top = 12.dp, bottom = 24.dp),
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .align(Alignment.CenterHorizontally)
                .size(width = 36.dp, height = 5.dp)
                .clip(RoundedCornerShape(2.5.dp))
                .background(GotchaColors.Border),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Add Content", fontWeight = FontWeight.ExtraBold, fontSize = 24.sp)
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFFF2F4F7)),
            ) {
                Icon(Icons.Outlined.Close, contentDescription = "Close")
            }
        }

        // URL/Paste/File each own their full quote → payment → import flow (DirectoryScreens.kt /
        // ImportFileScreen.kt) — this sheet is just the entry point, so there's no local "mode" state
        // (and no risk of a second, payment-unaware import path drifting out of sync with them).
        Column(modifier = Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            allowance?.let { FreeAllowanceBanner(it) }
            ImportOption(
                Icons.Outlined.Explore,
                "Browse Catalog",
                "Return to Library to browse published books, articles & news",
                onBrowseCatalog,
            )
            ImportOption(Icons.Outlined.Link, "Import from URL", "Paste a link to any article or web page", onOpenUrl)
            ImportOption(Icons.Outlined.ContentPaste, "Paste Text", "Paste any text and start reading with translations", onOpenPaste)
            ImportOption(Icons.Outlined.UploadFile, "Upload File", "Import a PDF or EPUB from your device", onOpenFile)
        }
        if (recent.isNotEmpty()) {
            Spacer(Modifier.height(24.dp))
            Text(
                "RECENTLY IMPORTED",
                color = Color(0xFF667085),
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 24.dp),
            )
            Spacer(Modifier.height(12.dp))
            recent.take(5).forEach { item ->
                RecentImportRow(item, Modifier.padding(horizontal = 24.dp, vertical = 4.dp))
            }
        }
    }
}

@Composable
private fun FreeAllowanceBanner(allowance: ImportQuoteFreeLimits) {
    val pagesWindow = when (allowance.resetCycle?.lowercase()) {
        "daily" -> "today"
        "yearly" -> "this year"
        else -> "this month"
    }
    val text = if (!allowance.gatewayEnabled) {
        "Imports are currently free (payments paused). Configured pool: ${allowance.dailyFreeImportsPerUser} imports/day · ${allowance.monthlyFreePageLimit} pages $pagesWindow."
    } else {
        "${allowance.dailyFreeRemaining} of ${allowance.dailyFreeImportsPerUser} free imports left today · ${allowance.monthlyPagesRemaining} of ${allowance.monthlyFreePageLimit} free pages left $pagesWindow."
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFFF5F3FF))
            .border(1.dp, Color(0xFFDDD6FF), RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        Text(text, color = Color(0xFF5B21B6), fontSize = 12.sp, lineHeight = 16.sp)
    }
}

@Composable
private fun ImportOption(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(GotchaColors.BrandPurpleSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(22.dp))
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(subtitle, color = Color(0xFF667085), fontSize = 13.sp, lineHeight = 18.sp)
        }
        Icon(Icons.Outlined.ChevronRight, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun RecentImportRow(item: UserImport, modifier: Modifier = Modifier) {
    val lang = item.language?.uppercase() ?: item.content?.language?.uppercase()
    val level = item.content?.cefrLevel?.uppercase()
    val badge = listOfNotNull(lang, level).joinToString(" • ")
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF2F4F7), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(GotchaColors.Surface),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Description, null, modifier = Modifier.size(16.dp), tint = GotchaColors.TextMuted)
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                item.title ?: "Import",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "Imported • ${item.importType?.uppercase() ?: item.ingestionStatus ?: "queued"}",
                color = Color(0xFF667085),
                fontSize = 12.sp,
            )
        }
        if (badge.isNotBlank()) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(GotchaColors.InfoBg)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    badge,
                    color = GotchaColors.InfoText,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                )
            }
        }
    }
}
