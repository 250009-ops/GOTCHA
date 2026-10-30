package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.ImportQuoteFreeLimits
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.ui.theme.WebCenteredColumn
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.WebMaxWidth
import app.gotcha.android.ui.theme.webPageHorizontalPad
import app.gotcha.android.ui.theme.webScreenWidthDp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Locale

private const val PAGE_SIZE = 8

private enum class ImportTab { Url, Paste, File }

@Composable
fun ImportScreen(
    onClose: () -> Unit,
    onBrowseCatalog: () -> Unit,
    onOpenUrl: () -> Unit = {},
    onOpenPaste: () -> Unit = {},
    onOpenFile: () -> Unit = {},
    onRead: (String) -> Unit = {},
    embedded: Boolean = false,
) {
    GotchaSystemBars(darkIcons = true)
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()

    var imports by remember { mutableStateOf<List<UserImport>>(emptyList()) }
    var total by remember { mutableIntStateOf(0) }
    var page by remember { mutableIntStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var allowance by remember { mutableStateOf<ImportQuoteFreeLimits?>(null) }
    var importRemaining by remember { mutableStateOf<Int?>(null) }
    var importsUnlimited by remember { mutableStateOf(false) }
    var historyLoading by remember { mutableStateOf(true) }
    var deletingId by remember { mutableStateOf<String?>(null) }
    var historyError by remember { mutableStateOf<String?>(null) }
    var selectedTab by remember { mutableStateOf(ImportTab.Url) }

    val atImportLimit = !importsUnlimited && importRemaining != null && importRemaining!! <= 0
    val gatewayEnabled = allowance?.gatewayEnabled != false

    suspend fun loadHistory(pageToLoad: Int) {
        val res = container.importRepository.list(pageToLoad, PAGE_SIZE)
        imports = res.items
        total = res.total
        page = res.page
        hasMore = res.hasMore
        allowance = res.freeAllowance
        importRemaining = res.importRemaining
        importsUnlimited = res.importsUnlimited == true
    }

    LaunchedEffect(Unit) {
        historyLoading = true
        runCatching { loadHistory(1) }
            .onFailure { historyError = it.apiErrorMessage("Could not load import history") }
        historyLoading = false
    }

    LaunchedEffect(imports, page) {
        val pending = imports.any { isPendingImportStatus(it.ingestionStatus) }
        if (!pending) return@LaunchedEffect
        while (imports.any { isPendingImportStatus(it.ingestionStatus) }) {
            delay(2500)
            runCatching { loadHistory(page) }
        }
    }

    fun deleteImport(id: String) {
        scope.launch {
            deletingId = id
            historyError = null
            try {
                container.importRepository.delete(id)
                val nextPage = if (imports.size <= 1 && page > 1) page - 1 else page
                loadHistory(nextPage)
            } catch (e: Exception) {
                historyError = e.apiErrorMessage("Delete failed")
            } finally {
                deletingId = null
            }
        }
    }

    WebCenteredColumn(maxWidth = WebMaxWidth.W6xl, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = webPageHorizontalPad(webScreenWidthDp())),
        ) {
            Spacer(Modifier.height(learnerScrollTopInset()))
            if (!embedded) {
                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .align(Alignment.CenterHorizontally)
                        .size(width = 36.dp, height = 5.dp)
                        .clip(RoundedCornerShape(2.5.dp))
                        .background(GotchaColors.Border),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = if (embedded) 0.dp else 8.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        if (embedded) "Import Content" else "Add Content",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = GotchaColors.Ink,
                    )
                    if (embedded) {
                        Text(
                            "Add your own texts — articles, books, or any text you want to read and learn from.",
                            fontFamily = Inter,
                            color = Color(0xFF99A1AF),
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                if (!embedded) {
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
            }

            allowance?.let {
                Spacer(Modifier.height(12.dp))
                FreeAllowanceBanner(it)
            }

            Spacer(Modifier.height(16.dp))
            if (embedded) {
                ImportWebTabPanel(
                    selectedTab = selectedTab,
                    onTab = { selectedTab = it },
                    atImportLimit = atImportLimit,
                    gatewayEnabled = gatewayEnabled,
                    onImported = {
                        scope.launch {
                            historyLoading = true
                            runCatching { loadHistory(1) }
                                .onFailure { historyError = it.apiErrorMessage("Could not refresh import history") }
                            historyLoading = false
                        }
                    },
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ImportOption(Icons.Outlined.Link, "Import from URL", "Paste a link to any article or web page", onOpenUrl)
                    ImportOption(Icons.Outlined.ContentPaste, "Paste Text", "Paste any text and start reading with translations", onOpenPaste)
                    ImportOption(Icons.Outlined.UploadFile, "Upload File", "Import a PDF or EPUB from your device", onOpenFile)
                }
            }

            Spacer(Modifier.height(28.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    "Import History",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    importHistorySummary(allowance, importRemaining, importsUnlimited, total),
                    fontFamily = Inter,
                    color = Color(0xFF99A1AF),
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.width(160.dp),
                )
            }

            Spacer(Modifier.height(12.dp))

            when {
                historyLoading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = GotchaColors.BrandPurple,
                            strokeWidth = 2.dp,
                        )
                    }
                }
                imports.isEmpty() -> {
                    ImportHistoryEmptyState()
                }
                else -> {
                    if (historyError != null) {
                        Text(
                            historyError!!,
                            fontFamily = Inter,
                            color = GotchaColors.Danger,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    imports.forEach { item ->
                        ImportHistoryRow(
                            item = item,
                            deleting = deletingId == item.id,
                            onRead = onRead,
                            onDelete = { deleteImport(item.id) },
                        )
                        Spacer(Modifier.height(12.dp))
                    }
                    if (page > 1 || hasMore) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            TextButton(
                                onClick = {
                                    scope.launch {
                                        historyLoading = true
                                        runCatching { loadHistory(page - 1) }
                                        historyLoading = false
                                    }
                                },
                                enabled = page > 1 && deletingId == null,
                            ) {
                                Text("Previous", fontFamily = Inter, fontSize = 12.sp)
                            }
                            Text(
                                "Page $page of ${maxOf(1, (total + PAGE_SIZE - 1) / PAGE_SIZE)}",
                                fontFamily = Inter,
                                color = Color(0xFF99A1AF),
                                fontSize = 12.sp,
                            )
                            TextButton(
                                onClick = {
                                    scope.launch {
                                        historyLoading = true
                                        runCatching { loadHistory(page + 1) }
                                        historyLoading = false
                                    }
                                },
                                enabled = hasMore && deletingId == null,
                            ) {
                                Text("Next", fontFamily = Inter, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(learnerScrollBottomInset()))
        }
    }
}

private fun importHistorySummary(
    allowance: ImportQuoteFreeLimits?,
    importRemaining: Int?,
    importsUnlimited: Boolean,
    total: Int,
): String {
    val countLabel = "$total import${if (total == 1) "" else "s"}"
    return when {
        allowance != null -> "${allowance.dailyFreeRemaining} free left today · $countLabel"
        importsUnlimited || importRemaining == null -> countLabel
        else -> countLabel
    }
}

private fun isPendingImportStatus(status: String?): Boolean =
    status == "queued" || status == "processing" || status == "tokenizing"

private fun importRelativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return runCatching {
        val created = Instant.parse(iso)
        val mins = ChronoUnit.MINUTES.between(created, Instant.now())
        when {
            mins < 1 -> "just now"
            mins < 60 -> "${mins}m ago"
            mins < 24 * 60 -> "${mins / 60}h ago"
            else -> "${mins / (24 * 60)}d ago"
        }
    }.getOrDefault("")
}

private fun formatImportWordCount(count: Int): String =
    "%,d words".format(Locale.US, count)

@Composable
private fun FreeAllowanceBanner(allowance: ImportQuoteFreeLimits) {
    val text = formatFreeAllowanceText(allowance)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(GotchaBlue.B50)
            .border(1.dp, GotchaBlue.B200, RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        Text(text, fontFamily = Inter, color = GotchaBlue.B800, fontSize = 12.sp, lineHeight = 16.sp)
    }
}

@Composable
private fun ImportWebTabPanel(
    selectedTab: ImportTab,
    onTab: (ImportTab) -> Unit,
    atImportLimit: Boolean,
    gatewayEnabled: Boolean,
    onImported: () -> Unit,
) {
    val panelShape = RoundedCornerShape(16.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(panelShape)
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), panelShape),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(width = 1.dp, color = Color(0xFFF3F4F6), shape = RoundedCornerShape(0.dp)),
        ) {
            ImportWebTabButton(
                label = "URL",
                icon = Icons.Outlined.Link,
                selected = selectedTab == ImportTab.Url,
                onClick = { onTab(ImportTab.Url) },
                modifier = Modifier.weight(1f),
            )
            ImportWebTabButton(
                label = "Paste",
                icon = Icons.Outlined.ContentPaste,
                selected = selectedTab == ImportTab.Paste,
                onClick = { onTab(ImportTab.Paste) },
                modifier = Modifier.weight(1f),
            )
            ImportWebTabButton(
                label = "File",
                icon = Icons.Outlined.FileUpload,
                selected = selectedTab == ImportTab.File,
                onClick = { onTab(ImportTab.File) },
                modifier = Modifier.weight(1f),
            )
        }
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (atImportLimit) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFFFFBEB))
                        .border(1.dp, Color(0xFFFEE685), RoundedCornerShape(14.dp))
                        .padding(12.dp),
                ) {
                    Text(
                        if (gatewayEnabled) {
                            "Import allowance reached. Delete an old import or pay per material size via Atmos."
                        } else {
                            "Import allowance reached. Delete an old import to free up space — paid imports are not available right now."
                        },
                        fontFamily = Inter,
                        color = Color(0xFFBB4D00),
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                    )
                }
            }
            Text(
                if (gatewayEnabled) {
                    "Paid imports use page-tier prices from Admin (UZS) via Atmos. Free daily/page allowances from Import & Pricing apply first."
                } else {
                    "Imports are free right now — paid imports via Atmos are currently disabled. Admin free limits apply as soon as payments are enabled."
                },
                fontFamily = Inter,
                color = Color(0xFF99A1AF),
                fontSize = 11.sp,
                lineHeight = 16.sp,
            )
            when (selectedTab) {
                ImportTab.Url -> ImportUrlForm(onImported = onImported, embedded = true)
                ImportTab.Paste -> ImportPasteForm(onImported = onImported, embedded = true)
                ImportTab.File -> ImportFileForm(onImported = onImported, embedded = true)
            }
        }
    }
}

@Composable
private fun ImportWebTabButton(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) Color(0x80F5F3FF) else Color.Transparent
    val borderColor = if (selected) GotchaColors.BrandPurple else Color.Transparent
    val textColor = if (selected) GotchaBlue.B700 else Color(0xFF99A1AF)
    Column(
        modifier = modifier
            .background(bg)
            .border(width = 2.dp, color = borderColor, shape = RoundedCornerShape(0.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = textColor, modifier = Modifier.size(14.dp))
        Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = textColor)
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
            Text(title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = GotchaColors.Ink)
            Text(subtitle, fontFamily = Inter, color = Color(0xFF667085), fontSize = 13.sp, lineHeight = 18.sp)
        }
        Icon(Icons.Outlined.ChevronRight, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun ImportHistoryEmptyState() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(GotchaColors.BrandPurpleSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Upload, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(22.dp))
        }
        Text("No imports yet", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = GotchaColors.Ink)
        Text(
            "Paste text, import from a URL, or upload a PDF/EPUB to build your personal reading library.",
            fontFamily = Inter,
            color = Color(0xFF99A1AF),
            fontSize = 13.sp,
            lineHeight = 18.sp,
        )
    }
}

@Composable
private fun ImportHistoryRow(
    item: UserImport,
    deleting: Boolean,
    onRead: (String) -> Unit,
    onDelete: () -> Unit,
) {
    val status = item.ingestionStatus.orEmpty()
    val showActions = status == "ready" || status == "failed"
    val contentId = item.content?.id ?: item.contentId

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFF3F4F6), RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(GotchaColors.BrandPurpleSoft),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Description, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            item.title ?: "Import",
                            fontFamily = Inter,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = GotchaColors.Ink,
                        )
                        item.sourceUrl?.takeIf { it.isNotBlank() }?.let { url ->
                            Text(
                                url,
                                fontFamily = Inter,
                                color = Color(0xFF99A1AF),
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        Text(
                            item.importType?.replace('_', ' ')?.replaceFirstChar { it.titlecase(Locale.getDefault()) } ?: "Import",
                            fontFamily = Inter,
                            color = Color(0xFF99A1AF),
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    ImportStatusBadge(status)
                }

                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    item.createdAt?.let {
                        Text(importRelativeTime(it), fontFamily = Inter, color = Color(0xFF99A1AF), fontSize = 12.sp)
                    }
                    item.content?.wordCount?.takeIf { it > 0 }?.let { wc ->
                        Text(formatImportWordCount(wc), fontFamily = Inter, color = Color(0xFF99A1AF), fontSize = 12.sp)
                    }
                    if (isPendingImportStatus(status) &&
                        item.progressPagesTotal != null &&
                        item.progressPagesTotal > 0
                    ) {
                        Text(
                            "${minOf(item.progressPagesDone ?: 0, item.progressPagesTotal)} / ${item.progressPagesTotal} pages",
                            fontFamily = Inter,
                            color = GotchaBlue.LearningText,
                            fontSize = 12.sp,
                        )
                    }
                    if (isPendingImportStatus(status) && item.progressPhase == "ocr") {
                        Text("AI is reading scanned pages…", fontFamily = Inter, color = GotchaBlue.B800, fontSize = 12.sp)
                    }
                    if (isPendingImportStatus(status) && item.progressPhase == "ai") {
                        Text("AI is cleaning up the text…", fontFamily = Inter, color = GotchaBlue.B800, fontSize = 12.sp)
                    }
                    if (status == "failed" && !item.errorMessage.isNullOrBlank()) {
                        Text(
                            item.errorMessage,
                            fontFamily = Inter,
                            color = Color(0xFFFB2C36),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        if (showActions) {
            HorizontalDivider(
                modifier = Modifier.padding(top = 12.dp),
                color = Color(0xFFF9FAFB),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (status == "ready" && !contentId.isNullOrBlank()) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Color(0x1A000000), RoundedCornerShape(14.dp))
                            .background(Color.White)
                            .clickable { onRead(contentId) }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(Icons.Outlined.OpenInNew, null, modifier = Modifier.size(14.dp), tint = GotchaColors.Ink)
                        Text("Read", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = GotchaColors.Ink)
                    }
                }
                Spacer(Modifier.weight(1f))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(enabled = !deleting, onClick = onDelete)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (deleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = Color(0xFFFF6467),
                        )
                    } else {
                        Icon(Icons.Outlined.Delete, null, modifier = Modifier.size(14.dp), tint = Color(0xFFFF6467))
                    }
                    Text(
                        "Delete",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                        color = Color(0xFFFF6467),
                    )
                }
            }
        }
    }
}

@Composable
private fun ImportStatusBadge(status: String) {
    val (bg, border, text, label, icon) = when (status) {
        "ready" -> StatusStyle(Color(0xFFECFDF5), Color(0xFFA4F4CF), Color(0xFF007A55), "Ready", Icons.Outlined.CheckCircle)
        "processing", "tokenizing" -> StatusStyle(GotchaBlue.LearningBg, Color(0xFFBEDBFF), GotchaBlue.LearningText, "Processing", Icons.Outlined.Schedule)
        "queued" -> StatusStyle(Color(0xFFFFFBEB), Color(0xFFFEE685), Color(0xFFBB4D00), "Queued", Icons.Outlined.Schedule)
        "failed" -> StatusStyle(Color(0xFFFEF2F2), Color(0xFFFFC9C9), Color(0xFFC10007), "Failed", Icons.Outlined.ErrorOutline)
        else -> StatusStyle(Color(0xFFF9FAFB), Color(0xFFE5E7EB), Color(0xFF4B5563), status.replaceFirstChar { it.titlecase(Locale.getDefault()) }, Icons.Outlined.Schedule)
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, modifier = Modifier.size(12.dp), tint = text)
        Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = text)
    }
}

private data class StatusStyle(
    val bg: Color,
    val border: Color,
    val text: Color,
    val label: String,
    val icon: ImageVector,
)
