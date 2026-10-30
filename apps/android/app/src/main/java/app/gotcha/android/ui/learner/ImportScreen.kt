package app.gotcha.android.ui.learner

import app.gotcha.android.util.uiString
import app.gotcha.android.util.uiPlural
import app.gotcha.android.R
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
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
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
    GotchaSystemBars()
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

    // UI-10: Retry re-runs the initial history load.
    var historyReload by remember { mutableStateOf(0) }
    LaunchedEffect(historyReload) {
        historyLoading = true
        historyError = null
        runCatching { loadHistory(1) }
            .onFailure { historyError = it.apiErrorMessage(R.string.err_import_history_load) }
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
                historyError = e.apiErrorMessage(R.string.err_delete_failed)
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
                        if (embedded) uiString(R.string.import_content) else uiString(R.string.import_add_content),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = GotchaColors.Ink,
                    )
                    if (embedded) {
                        Text(
                            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_add_your_own_texts_articles_books_or_any),
                            fontFamily = Inter,
                            color = GotchaColors.TextSubtle,
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
                            .background(GotchaColors.SurfaceMuted),
                    ) {
                        Icon(Icons.Outlined.Close, contentDescription = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_close))
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
                                .onFailure { historyError = it.apiErrorMessage(R.string.err_import_history_refresh) }
                            historyLoading = false
                        }
                    },
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ImportOption(Icons.Outlined.Link, uiString(R.string.x_import_from_url), uiString(R.string.import_from_url_sub), onOpenUrl)
                    ImportOption(Icons.Outlined.ContentPaste, uiString(R.string.x_paste_text), uiString(R.string.import_paste_sub), onOpenPaste)
                    ImportOption(Icons.Outlined.UploadFile, uiString(R.string.x_upload_file), uiString(R.string.import_file_sub), onOpenFile)
                }
            }

            Spacer(Modifier.height(28.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_import_history),
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    importHistorySummary(allowance, importRemaining, importsUnlimited, total),
                    fontFamily = Inter,
                    color = GotchaColors.TextSubtle,
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
                imports.isEmpty() && historyError != null -> {
                    app.gotcha.android.ui.components.ErrorState(
                        message = historyError!!,
                        onRetry = { historyReload += 1 },
                    )
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
                                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_previous), fontFamily = Inter, fontSize = 12.sp)
                            }
                            Text(
                                uiString(R.string.import_page_of, page, maxOf(1, (total + PAGE_SIZE - 1) / PAGE_SIZE)),
                                fontFamily = Inter,
                                color = GotchaColors.TextSubtle,
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
                                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_next), fontFamily = Inter, fontSize = 12.sp)
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
    val countLabel = uiPlural(R.plurals.import_n_imports, total)
    return when {
        allowance != null -> uiString(R.string.import_free_left_today, allowance.dailyFreeRemaining, countLabel)
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
            mins < 1 -> uiString(R.string.time_just_now)
            mins < 60 -> uiString(R.string.time_min_ago, mins.toInt())
            mins < 24 * 60 -> uiString(R.string.time_h_ago, (mins / 60).toInt())
            else -> uiString(R.string.time_d_ago, (mins / (24 * 60)).toInt())
        }
    }.getOrDefault("")
}

private fun formatImportWordCount(count: Int): String =
    uiPlural(R.plurals.vocab_n_words, count)

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
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.SurfaceMuted, panelShape),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(width = 1.dp, color = GotchaColors.SurfaceMuted, shape = RoundedCornerShape(0.dp)),
        ) {
            ImportWebTabButton(
                label = "URL", // i18n-ok: URL is universal
                icon = Icons.Outlined.Link,
                selected = selectedTab == ImportTab.Url,
                onClick = { onTab(ImportTab.Url) },
                modifier = Modifier.weight(1f),
            )
            ImportWebTabButton(
                label = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_paste),
                icon = Icons.Outlined.ContentPaste,
                selected = selectedTab == ImportTab.Paste,
                onClick = { onTab(ImportTab.Paste) },
                modifier = Modifier.weight(1f),
            )
            ImportWebTabButton(
                label = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_file),
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
                        .background(GotchaColors.WebStreakBg)
                        .border(1.dp, GotchaColors.WebStreakBorder, RoundedCornerShape(14.dp))
                        .padding(12.dp),
                ) {
                    Text(
                        if (gatewayEnabled) {
                            uiString(R.string.import_limit_gw)
                        } else {
                            uiString(R.string.import_limit_nogw)
                        },
                        fontFamily = Inter,
                        color = GotchaColors.WebStreakText,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                    )
                }
            }
            Text(
                if (gatewayEnabled) {
                    uiString(R.string.import_paid_play)
                } else {
                    uiString(R.string.import_free_now)
                },
                fontFamily = Inter,
                color = GotchaColors.TextSubtle,
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
    val textColor = if (selected) GotchaBlue.B700 else GotchaColors.TextSubtle
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
            .background(GotchaColors.SurfaceCard)
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
            .background(GotchaColors.SurfaceCard)
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
        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_no_imports_yet), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = GotchaColors.Ink)
        Text(
            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_paste_text_import_from_a_url_or_upload_a),
            fontFamily = Inter,
            color = GotchaColors.TextSubtle,
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
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.SurfaceMuted, RoundedCornerShape(16.dp))
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
                                color = GotchaColors.TextSubtle,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        Text(
                            item.importType?.replace('_', ' ')?.replaceFirstChar { it.titlecase(Locale.getDefault()) } ?: "Import",
                            fontFamily = Inter,
                            color = GotchaColors.TextSubtle,
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
                        Text(importRelativeTime(it), fontFamily = Inter, color = GotchaColors.TextSubtle, fontSize = 12.sp)
                    }
                    item.content?.wordCount?.takeIf { it > 0 }?.let { wc ->
                        Text(formatImportWordCount(wc), fontFamily = Inter, color = GotchaColors.TextSubtle, fontSize = 12.sp)
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
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_ai_is_reading_scanned_pages), fontFamily = Inter, color = GotchaBlue.B800, fontSize = 12.sp)
                    }
                    if (isPendingImportStatus(status) && item.progressPhase == "ai") {
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_ai_is_cleaning_up_the_text), fontFamily = Inter, color = GotchaBlue.B800, fontSize = 12.sp)
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
                color = GotchaColors.Surface,
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
                            .background(GotchaColors.SurfaceCard)
                            .clickable { onRead(contentId) }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, modifier = Modifier.size(14.dp), tint = GotchaColors.Ink)
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_read), fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = GotchaColors.Ink)
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
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_delete),
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
        "ready" -> StatusStyle(GotchaColors.SuccessBg, Color(0xFFA4F4CF), Color(0xFF007A55), "Ready", Icons.Outlined.CheckCircle)
        "processing", "tokenizing" -> StatusStyle(GotchaBlue.LearningBg, Color(0xFFBEDBFF), GotchaBlue.LearningText, "Processing", Icons.Outlined.Schedule)
        "queued" -> StatusStyle(GotchaColors.WebStreakBg, GotchaColors.WebStreakBorder, GotchaColors.WebStreakText, "Queued", Icons.Outlined.Schedule)
        "failed" -> StatusStyle(GotchaColors.DangerBg, Color(0xFFFFC9C9), Color(0xFFC10007), "Failed", Icons.Outlined.ErrorOutline)
        else -> StatusStyle(GotchaColors.Surface, GotchaColors.Border, GotchaColors.TextMuted, status.replaceFirstChar { it.titlecase(Locale.getDefault()) }, Icons.Outlined.Schedule)
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
