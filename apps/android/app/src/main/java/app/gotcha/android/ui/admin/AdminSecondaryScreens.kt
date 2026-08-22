package app.gotcha.android.ui.admin

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.data.model.AdminAchievement
import app.gotcha.android.data.model.AdminAiUsageResponse
import app.gotcha.android.data.model.AdminAnalytics
import app.gotcha.android.data.model.AdminCampaign
import app.gotcha.android.data.model.AdminCreateCampaignRequest
import app.gotcha.android.data.model.AdminCreateContentRequest
import app.gotcha.android.data.model.AdminIngestPreview
import app.gotcha.android.data.model.AdminUpdateContentRequest
import app.gotcha.android.data.model.AdminGamificationResponse
import app.gotcha.android.data.model.AdminLanguage
import app.gotcha.android.data.model.AdminLanguagesResponse
import app.gotcha.android.data.model.AdminLevelTestsResponse
import app.gotcha.android.data.model.AdminNamedPct
import app.gotcha.android.data.model.AdminNotificationsResponse
import app.gotcha.android.data.model.AdminMe
import app.gotcha.android.data.model.AdminSettings
import app.gotcha.android.data.model.AdminSupportResponse
import app.gotcha.android.data.model.AdminSupportTicket
import app.gotcha.android.data.model.AdminUpdateCampaignRequest
import app.gotcha.android.data.model.AdminUserRow
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.ImportPageTier
import app.gotcha.android.data.model.ImportPricingRulePatch
import app.gotcha.android.data.model.UpdateImportFreeLimitsRequest
import app.gotcha.android.data.model.UpdateImportPageTierRequest
import app.gotcha.android.data.model.UpdateImportPricingRulesRequest
import app.gotcha.android.ui.components.ErrorBox
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Figma import modal accent (#6C5CE7). */
private val ImportAccent = Color(0xFF6C5CE7)

@Composable
fun AdminContentDetailScreen(contentId: String, onBack: () -> Unit, onEdit: (String) -> Unit = {}) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var item by remember { mutableStateOf<ContentItem?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var markFree by remember { mutableStateOf(false) }
    var activeVisible by remember { mutableStateOf(false) }
    var publishing by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var statusMsg by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(contentId) {
        try {
            item = container.adminRepository.content().find { it.id == contentId }
                ?: container.contentRepository.get(contentId)
            val c = item
            if (c == null) {
                error = "Content not found"
            } else {
                markFree = c.isFree == true || (c.priceUsd ?: 0.0) <= 0.0
                activeVisible = c.resolvedStatus() == "published"
            }
        } catch (e: Exception) {
            error = e.message ?: "Failed to load content"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Edit Product", onBack)
            ErrorBox(error!!)
        }
        else -> {
            val c = item!!
            val free = markFree
            val bottomInset = LocalAdminBottomInset.current
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebAdminCanvas)
                    .verticalScroll(rememberScrollState())
                    // Top clearance comes from AdminBackHeader (LocalAdminTopInset) — do not double-pad.
                    .padding(bottom = bottomInset + 24.dp),
            ) {
                AdminBackHeader("Edit Product", onBack)
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Figma 122:312 — cover thumb + upload CTA
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(width = 80.dp, height = 110.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(GotchaColors.BrandPurpleSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (!c.coverImageUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = resolveMediaUrl(c.coverImageUrl),
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                )
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Edit material",
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .border(1.dp, GotchaColors.BrandPurple, RoundedCornerShape(10.dp))
                                    .clickable { onEdit(contentId) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                color = GotchaColors.BrandPurple,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                            )
                            Text(
                                "Recommended: 600 x 800 px",
                                color = GotchaColors.TextMuted,
                                fontSize = 11.sp,
                            )
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        LabeledReadonlyField("Product Title", c.title ?: "Untitled")
                        LabeledReadonlyField(
                            "Description",
                            c.description?.ifBlank { null } ?: "No description",
                            minHeight = 70.dp,
                            fontSize = 13.sp,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            DropdownField(
                                "Language",
                                adminLanguageLabel(c.language),
                                Modifier.weight(1f),
                            )
                            DropdownField(
                                "Level",
                                adminLevelLabel(c.cefrLevel),
                                Modifier.weight(1f),
                            )
                            DropdownField(
                                "Type",
                                adminTypeLabel(c.contentType),
                                Modifier.weight(1f),
                            )
                        }
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LabeledReadonlyField(
                                "Base Price (UZS)",
                                if (free) "Free" else formatUsdMicros(c.priceUsd),
                                modifier = Modifier.weight(1f),
                            )
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(
                                    "Mark as Free",
                                    color = GotchaColors.TextMuted,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                )
                                Switch(
                                    checked = markFree,
                                    onCheckedChange = { markFree = it },
                                    colors = SwitchDefaults.colors(
                                        checkedTrackColor = GotchaColors.BrandPurple,
                                        uncheckedTrackColor = Color(0xFFE5E7EB),
                                    ),
                                )
                            }
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Active & Visible in Store",
                                color = GotchaColors.Ink,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                            )
                            Switch(
                                checked = activeVisible,
                                onCheckedChange = { checked ->
                                    if (!checked) {
                                        // No unpublish API — keep live honesty.
                                        statusMsg = "Unpublish is not available via API."
                                        return@Switch
                                    }
                                    if (c.resolvedStatus() == "published") {
                                        activeVisible = true
                                        return@Switch
                                    }
                                    publishing = true
                                    scope.launch {
                                        try {
                                            item = container.adminRepository.publishContent(c.id)
                                            activeVisible = true
                                            statusMsg = null
                                        } catch (e: Exception) {
                                            statusMsg = e.message ?: "Publish failed"
                                            activeVisible = false
                                        } finally {
                                            publishing = false
                                        }
                                    }
                                },
                                enabled = !publishing,
                                colors = SwitchDefaults.colors(
                                    checkedTrackColor = GotchaColors.BrandPurple,
                                    uncheckedTrackColor = Color(0xFFE5E7EB),
                                ),
                            )
                        }
                        Text(
                            if (deleting) "Deleting…" else "Delete permanently",
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, GotchaColors.Danger, RoundedCornerShape(12.dp))
                                .clickable(enabled = !deleting) {
                                    deleting = true
                                    scope.launch {
                                        try {
                                            container.adminRepository.deleteContent(c.id)
                                            onBack()
                                        } catch (e: Exception) {
                                            statusMsg = e.message ?: "Delete failed"
                                        } finally {
                                            deleting = false
                                        }
                                    }
                                }
                                .padding(vertical = 12.dp),
                            color = GotchaColors.Danger,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                        )
                    }

                    // Figma 122:359 — Views | Sales | Rating strip
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        DetailStat("Views", formatCompact(c.viewCount ?: 0), Modifier.weight(1f))
                        Box(
                            Modifier
                                .width(1.dp)
                                .height(24.dp)
                                .background(GotchaColors.Border),
                        )
                        DetailStat("Sales", formatInt(c.salesCount ?: 0), Modifier.weight(1f))
                        Box(
                            Modifier
                                .width(1.dp)
                                .height(24.dp)
                                .background(GotchaColors.Border),
                        )
                        // No rating field on ContentItem — stay honest.
                        DetailStat("Rating", "—", Modifier.weight(1f))
                    }

                    Text(
                        "Save Changes",
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(GotchaColors.BrandPurple)
                            .clickable {
                                statusMsg = "Metadata edits are display-only until an update API is wired."
                            }
                            .padding(vertical = 14.dp),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                    )
                    statusMsg?.let {
                        Text(it, color = GotchaColors.TextMuted, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = GotchaColors.TextMuted, fontSize = 11.sp)
        Text(value, color = GotchaColors.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
    }
}

@Composable
private fun LabeledReadonlyField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    minHeight: Dp = 0.dp,
    fontSize: TextUnit = 14.sp,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = GotchaColors.TextMuted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (minHeight > 0.dp) Modifier.height(minHeight) else Modifier)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(value, color = GotchaColors.Ink, fontSize = fontSize)
        }
    }
}

@Composable
private fun DropdownField(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = GotchaColors.TextMuted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(8.dp))
                .padding(10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(value, color = GotchaColors.Ink, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Icon(
                painter = androidx.compose.ui.res.painterResource(R.drawable.ic_chevron_down),
                contentDescription = null,
                tint = GotchaColors.TextSubtle,
                modifier = Modifier.size(12.dp),
            )
        }
    }
}

private fun adminLanguageLabel(code: String?): String = when (code?.lowercase()) {
    "en" -> "English"
    "ru" -> "Russian"
    "uz" -> "Uzbek"
    "es" -> "Spanish"
    "de" -> "German"
    "fr" -> "French"
    "ja" -> "Japanese"
    "ko" -> "Korean"
    "pt" -> "Portuguese"
    null, "" -> "—"
    else -> code.replaceFirstChar { it.uppercase() }
}

private fun adminLevelLabel(level: String?): String {
    val l = level?.uppercase() ?: return "—"
    return when (l) {
        "A1" -> "A1 Beg"
        "A2" -> "A2 Elem"
        "B1" -> "B1 Int"
        "B2" -> "B2 Upp"
        "C1" -> "C1 Adv"
        "C2" -> "C2 Mast"
        else -> l
    }
}

private fun adminTypeLabel(type: String?): String = when (type?.lowercase()) {
    "book", "ebook", "e-book" -> "Book"
    "article" -> "Article"
    "news" -> "News"
    "story" -> "Story"
    null, "" -> "—"
    else -> type.replaceFirstChar { it.uppercase() }
}

@Composable
fun AdminAddProductScreen(
    onBack: () -> Unit,
    onImportSuccess: (ContentItem) -> Unit = {},
    onImportError: (String) -> Unit = {},
    contentId: String? = null,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val editing = !contentId.isNullOrBlank()
    var title by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var genre by remember { mutableStateOf("") }
    var language by remember { mutableStateOf("en") }
    var level by remember { mutableStateOf("b1") }
    var contentType by remember { mutableStateOf("book") }
    var price by remember { mutableStateOf("0") }
    var bodyText by remember { mutableStateOf("") }
    var sourceUrl by remember { mutableStateOf("") }
    var sourceMode by remember { mutableStateOf("paste") }
    var pdfBytes by remember { mutableStateOf<ByteArray?>(null) }
    var pdfName by remember { mutableStateOf<String?>(null) }
    var coverBytes by remember { mutableStateOf<ByteArray?>(null) }
    var coverName by remember { mutableStateOf("cover.jpg") }
    var coverMime by remember { mutableStateOf("image/jpeg") }
    var coverPreview by remember { mutableStateOf<String?>(null) }
    var preview by remember { mutableStateOf<AdminIngestPreview?>(null) }
    var openChapters by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var importing by remember { mutableStateOf(false) }
    var analyzing by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var cancelled by remember { mutableStateOf(false) }
    val literary = contentType == "book" || contentType == "story"
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
        coverMime = mime
        coverName = when {
            mime.contains("png") -> "cover.png"
            mime.contains("webp") -> "cover.webp"
            else -> "cover.jpg"
        }
        coverBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        coverPreview = uri.toString()
    }
    val pdfPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val name = runCatching {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && idx >= 0) cursor.getString(idx) else null
            }
        }.getOrNull() ?: uri.lastPathSegment ?: "book.pdf"
        if (!name.lowercase().endsWith(".pdf")) {
            onImportError("Only PDF files are supported")
            return@rememberLauncherForActivityResult
        }
        pdfName = name
        pdfBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        sourceMode = "pdf"
        preview = null
        if (title.isBlank()) {
            title = name.substringBeforeLast('.').replace(Regex("[-_]+"), " ").trim()
        }
    }

    LaunchedEffect(contentId) {
        val id = contentId ?: return@LaunchedEffect
        runCatching { container.adminRepository.contentDetail(id) }
            .onSuccess { item ->
                title = item.title.orEmpty()
                author = item.author?.trim().orEmpty().ifBlank { item.subtitle.orEmpty() }
                description = item.description.orEmpty()
                genre = item.genre.orEmpty()
                language = item.language ?: "en"
                level = item.cefrLevel ?: "b1"
                contentType = item.contentType ?: "book"
                price = if (item.isFree) "0" else (item.priceUsd ?: 0.0).toString()
                sourceUrl = item.sourceUrl.orEmpty()
                coverPreview = item.coverImageKey?.let { resolveMediaUrl(it) }
                if (item.chapters.isNotEmpty()) {
                    preview = AdminIngestPreview(
                        wordCount = item.chapters.sumOf { it.wordCount },
                        chapterCount = item.chapters.size,
                        pageCount = item.chapters.sumOf { it.pages.size },
                        chapters = item.chapters,
                    )
                    openChapters = item.chapters.map { it.chapterIndex }.toSet()
                }
            }
            .onFailure { onImportError(it.message ?: "Failed to load material") }
    }

    fun requestBody(plainOverride: String? = bodyText.ifBlank { null }) = AdminCreateContentRequest(
        title = title.trim().ifBlank { "Untitled" },
        author = author.trim().ifBlank { null },
        description = description.trim().ifBlank { null },
        genre = genre.trim().ifBlank { null },
        language = language.trim().lowercase().ifBlank { "en" },
        cefrLevel = level.trim().lowercase().ifBlank { "b1" },
        contentType = contentType,
        plainText = if (sourceMode == "paste") plainOverride else null,
        sourceUrl = if (sourceMode == "url") sourceUrl.trim().ifBlank { null } else null,
        priceUsd = price.toDoubleOrNull() ?: 0.0,
        isFree = (price.toDoubleOrNull() ?: 0.0) <= 0.0,
        chapters = preview?.chaptersPayload?.takeIf { it.isNotEmpty() },
    )

    fun analyze() {
        analyzing = true
        scope.launch {
            try {
                val result = if (sourceMode == "pdf") {
                    val bytes = pdfBytes ?: throw IllegalStateException("Choose a PDF first")
                    container.adminRepository.ingestPreviewFile(
                        bytes = bytes,
                        fileName = pdfName ?: "book.pdf",
                        title = title.trim().ifBlank { "Untitled" },
                        contentType = contentType,
                        language = language.trim().lowercase().ifBlank { "en" },
                    )
                } else {
                    container.adminRepository.ingestPreview(requestBody())
                }
                preview = result
                openChapters = result.chapters.map { it.chapterIndex }.toSet()
            } catch (e: Exception) {
                onImportError(e.message ?: "AI ingest failed")
            } finally {
                analyzing = false
            }
        }
    }

    fun submit(publishAfter: Boolean) {
        if (title.isBlank()) {
            onImportError("Error: Title is required.")
            return
        }
        if (author.isBlank() && !editing) {
            onImportError("Error: Author is required.")
            return
        }
        cancelled = false
        importing = true
        progress = 0.08f
        scope.launch {
            try {
                val steps = listOf(0.28f, 0.55f, 0.72f, 0.9f)
                for (p in steps) {
                    if (cancelled) {
                        importing = false
                        return@launch
                    }
                    delay(280)
                    progress = p
                }
                val id = if (editing) {
                    container.adminRepository.updateContent(
                        contentId!!,
                        AdminUpdateContentRequest(
                            title = title.trim(),
                            author = author.trim().ifBlank { null },
                            description = description.trim().ifBlank { null },
                            genre = genre.trim().ifBlank { null },
                            language = language.trim().lowercase(),
                            cefrLevel = level.trim().lowercase(),
                            contentType = contentType,
                            priceUsd = price.toDoubleOrNull() ?: 0.0,
                            isFree = (price.toDoubleOrNull() ?: 0.0) <= 0.0,
                        ),
                    ).id
                } else {
                    var createBody = requestBody(bodyText.ifBlank { "$title." })
                    if (sourceMode == "pdf" && createBody.chapters.isNullOrEmpty()) {
                        val bytes = pdfBytes ?: throw IllegalStateException("Choose a PDF first")
                        val analyzed = container.adminRepository.ingestPreviewFile(
                            bytes = bytes,
                            fileName = pdfName ?: "book.pdf",
                            title = title.trim().ifBlank { "Untitled" },
                            contentType = contentType,
                            language = language.trim().lowercase().ifBlank { "en" },
                        )
                        preview = analyzed
                        createBody = requestBody()
                    }
                    container.adminRepository.createContent(createBody).id
                }
                coverBytes?.let { bytes ->
                    runCatching { container.adminRepository.uploadContentCover(id, bytes, coverName, coverMime) }
                }
                progress = 1f
                delay(200)
                if (cancelled) {
                    importing = false
                    return@launch
                }
                val created = ContentItem(id = id, title = title.trim(), contentType = contentType, author = author)
                val finalItem = if (publishAfter) {
                    runCatching { container.adminRepository.publishContent(id) }.getOrDefault(created)
                } else {
                    created
                }
                importing = false
                onImportSuccess(finalItem)
            } catch (e: Exception) {
                importing = false
                onImportError(e.message ?: "We couldn't process this content. Please check the source and try again.")
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.WebAdminCanvas)
                .verticalScroll(rememberScrollState()),
        ) {
            AdminBackHeader(if (editing) "Edit product" else "Add product", onBack)
            Column(
                modifier = Modifier.padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(
                            width = 1.dp,
                            color = GotchaColors.Border,
                            shape = RoundedCornerShape(12.dp),
                        )
                        .clickable {
                            photoPicker.launch(
                                androidx.activity.result.PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageOnly,
                                ),
                            )
                        }
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (!coverPreview.isNullOrBlank()) {
                        AsyncImage(
                            model = resolveMediaUrl(coverPreview),
                            contentDescription = null,
                            modifier = Modifier
                                .size(width = 72.dp, height = 96.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Outlined.Image,
                            contentDescription = null,
                            tint = GotchaColors.BrandPurple,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Text(
                        "Upload Cover Image",
                        color = GotchaColors.BrandPurple,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                    )
                }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                        .clickable {
                            pdfPicker.launch(arrayOf("application/pdf"))
                        }
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.UploadFile,
                        contentDescription = null,
                        tint = if (pdfBytes != null) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                        modifier = Modifier.size(24.dp),
                    )
                    Text(
                        if (pdfName.isNullOrBlank()) "Upload Source PDF" else pdfName!!,
                        color = GotchaColors.BrandPurple,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                GotchaTextField("Product Title", title, { title = it }, placeholder = "Alice in Wonderland")
                GotchaTextField("Author", author, { author = it }, placeholder = "Lewis Carroll")
                GotchaTextField("Description", description, { description = it }, placeholder = "Short catalog description")
                GotchaTextField("Genre", genre, { genre = it }, placeholder = "Novel, short story, news…")
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(modifier = Modifier.weight(1f)) {
                        GotchaTextField("Language", language, { language = it }, placeholder = "en")
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        GotchaTextField("CEFR Level", level, { level = it }, placeholder = "b1")
                    }
                }
                GotchaTextField("Type (book / story / article / news)", contentType, { contentType = it.lowercase() }, placeholder = "book")
                GotchaTextField("Price (UZS)", price, { price = it }, placeholder = "0 for free")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("paste" to "Paste text", "pdf" to "Upload PDF", "url" to "Page URL").forEach { (mode, label) ->
                        Text(
                            label,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (sourceMode == mode) GotchaColors.BrandPurple else Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                                .clickable { sourceMode = mode }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            color = if (sourceMode == mode) Color.White else GotchaColors.Ink,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                        )
                    }
                }
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        when (sourceMode) {
                            "url" -> "Page URL"
                            "pdf" -> "Source PDF"
                            else -> if (literary) "Paste book / story" else "Paste article / news"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = GotchaColors.TextMuted,
                    )
                    Spacer(Modifier.height(6.dp))
                    if (sourceMode == "url") {
                        GotchaTextField("Source URL", sourceUrl, { sourceUrl = it }, placeholder = "https://…/article")
                    } else if (sourceMode == "pdf") {
                        Text(
                            if (pdfName.isNullOrBlank()) "Choose a PDF above, then detect chapters from its outline, contents list, and printed headings."
                            else "Ready to analyze: $pdfName",
                            fontSize = 13.sp,
                            color = GotchaColors.TextMuted,
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(8.dp))
                                .padding(12.dp),
                        ) {
                            BasicTextField(
                                value = bodyText,
                                onValueChange = { bodyText = it },
                                modifier = Modifier.fillMaxSize(),
                                textStyle = TextStyle(fontSize = 13.sp, color = GotchaColors.Ink),
                                decorationBox = { inner ->
                                    if (bodyText.isEmpty()) {
                                        Text(
                                            if (literary) "Paste the book or story. Copyright pages are dropped; chapter titles stay as printed."
                                            else "Paste the tight article or news body.",
                                            color = GotchaColors.TextSubtle,
                                            fontSize = 13.sp,
                                        )
                                    }
                                    inner()
                                },
                            )
                        }
                    }
                }
                Text(
                    if (analyzing) "Detecting chapters…" else if (literary) "Detect chapters" else "Prepare body",
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.BrandPurple, RoundedCornerShape(12.dp))
                        .clickable(enabled = !analyzing && !importing) { analyze() }
                        .padding(vertical = 12.dp),
                    color = GotchaColors.BrandPurple,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
                preview?.let { result ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            if (literary) "${result.chapterCount} chapters · ${result.pageCount} pages · ${result.wordCount} words"
                            else "Tight body · ${result.wordCount} words",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = GotchaColors.Ink,
                        )
                        if (literary) {
                            result.chapters.forEach { ch ->
                                val open = ch.chapterIndex in openChapters
                                Column {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                openChapters = if (open) openChapters - ch.chapterIndex else openChapters + ch.chapterIndex
                                            }
                                            .padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(
                                            if (open) Icons.Outlined.KeyboardArrowDown else Icons.Outlined.ChevronRight,
                                            contentDescription = null,
                                            tint = GotchaColors.TextSubtle,
                                            modifier = Modifier.size(16.dp),
                                        )
                                        Text(
                                            ch.title,
                                            modifier = Modifier.weight(1f),
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 13.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                    if (open) {
                                        ch.pages.forEach { page ->
                                            Text(
                                                "  ${page.title} · ${page.wordCount} words",
                                                fontSize = 12.sp,
                                                color = GotchaColors.TextMuted,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    GotchaPrimaryButton(
                        "Publish Product",
                        onClick = { submit(publishAfter = true) },
                        loading = importing,
                        containerColor = GotchaColors.BrandPurple,
                        shapeRadius = 12,
                    )
                    Text(
                        "Save as Draft",
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .clickable(enabled = !importing) { submit(publishAfter = false) }
                            .padding(vertical = 14.dp),
                        color = GotchaColors.TextMuted,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                Spacer(Modifier.height(24.dp))
            }
        }
        if (importing) {
            AdminImportLoadingOverlay(
                progress = progress,
                onCancel = {
                    cancelled = true
                    importing = false
                },
            )
        }
    }
}

/** Figma 123:93 — modal over dimmed Content Manager. */
@Composable
fun AdminImportLoadingOverlay(
    progress: Float,
    onCancel: () -> Unit,
) {
    val animated by animateFloatAsState(targetValue = progress.coerceIn(0f, 1f), animationSpec = tween(350), label = "importPct")
    val pct = (animated * 100).toInt().coerceIn(0, 100)
    val stepLabel = when {
        pct < 35 -> "Step 1 of 3: Fetching source text"
        pct < 75 -> "Step 2 of 3: Analyzing syntax & structures"
        else -> "Step 3 of 3: Building vocabulary map"
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 35.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Color.White)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(100.dp)) {
                Canvas(modifier = Modifier.size(100.dp)) {
                    val stroke = 8.dp.toPx()
                    drawArc(
                        color = Color(0xFFE5E7EB),
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                        size = Size(size.minDimension, size.minDimension),
                        topLeft = Offset.Zero,
                    )
                    drawArc(
                        color = ImportAccent,
                        startAngle = -90f,
                        sweepAngle = 360f * animated,
                        useCenter = false,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                        size = Size(size.minDimension, size.minDimension),
                        topLeft = Offset.Zero,
                    )
                }
                Text(
                    "$pct%",
                    fontFamily = Inter,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 28.sp,
                    color = ImportAccent,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Importing Content...",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = GotchaColors.Ink,
                )
                Text(
                    "Fetching and processing your article. We are extracting the core text, vocabulary, and grammar structures.",
                    color = GotchaColors.TextMuted,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(GotchaColors.Border),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(animated.coerceIn(0.02f, 1f))
                            .height(6.dp)
                            .clip(RoundedCornerShape(100.dp))
                            .background(ImportAccent),
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(stepLabel, color = ImportAccent, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("$pct%", color = ImportAccent, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
            Text(
                "Cancel Import",
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                    .clickable(onClick = onCancel)
                    .padding(14.dp),
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.TextMuted,
            )
        }
    }
}

/** Figma 123:138 */
@Composable
fun AdminImportSuccessScreen(
    contentId: String,
    onDone: () -> Unit,
) {
    val container = LocalAppContainer.current
    var item by remember { mutableStateOf<ContentItem?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(contentId) {
        item = runCatching {
            container.adminRepository.content().find { it.id == contentId }
                ?: container.contentRepository.get(contentId)
        }.getOrNull()
    }

    val title = item?.title ?: "Imported content"
    val type = (item?.contentType ?: "article").replaceFirstChar { it.uppercase() }
    val lang = (item?.language ?: "en").uppercase()
    val level = (item?.cefrLevel ?: "b1").uppercase()
    val words = item?.wordCount ?: 0
    val pages = maxOf(1, (words + 309) / 310)
    val levelLabel = when (level.lowercase()) {
        "a1" -> "A1 Beginner"
        "a2" -> "A2 Elementary"
        "b1" -> "B1 Intermediate"
        "b2" -> "B2 Upper-Int"
        "c1" -> "C1 Advanced"
        "c2" -> "C2 Mastery"
        else -> level
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(top = LocalAdminTopInset.current),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(24.dp))
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(Color(0xFFE6F4EA)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Check, null, tint = Color(0xFF137333), modifier = Modifier.size(36.dp))
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Import Complete!",
                fontFamily = Inter,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 24.sp,
                color = GotchaColors.Ink,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Your content has been processed and is ready for the store.",
                modifier = Modifier.padding(horizontal = 32.dp),
                color = GotchaColors.TextMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            Column(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GotchaColors.WebAdminCanvas)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("META INFORMATION", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.TextMuted)
                MetaRow("Title", title)
                MetaRow("Type", type)
                MetaRow("Language", "English ($lang)".takeIf { lang == "EN" } ?: "$lang")
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("CEFR Level", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.TextMuted)
                    Text(
                        levelLabel,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF3F0FF))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        color = ImportAccent,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                    )
                }
                MetaRow("Length", "$pages Pages • ${formatInt(words)} words")
            }
        }
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GotchaPrimaryButton(
                "Set Price & Publish",
                onClick = {
                    busy = true
                    scope.launch {
                        runCatching { container.adminRepository.publishContent(contentId) }
                        busy = false
                        onDone()
                    }
                },
                loading = busy,
                containerColor = ImportAccent,
                shapeRadius = 12,
            )
            Text(
                "Save as Draft",
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                    .clickable(onClick = onDone)
                    .padding(14.dp),
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.TextMuted,
            )
        }
    }
}

/** Figma 123:179 */
@Composable
fun AdminImportErrorScreen(
    detail: String,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(top = LocalAdminTopInset.current),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(24.dp))
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(Color(0xFFFEF2F2)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.WarningAmber, null, tint = GotchaColors.Danger, modifier = Modifier.size(36.dp))
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Import Failed",
                fontFamily = Inter,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 24.sp,
                color = GotchaColors.Ink,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "We couldn't process this content. Please check the source and try again.",
                modifier = Modifier.padding(horizontal = 32.dp),
                color = GotchaColors.TextMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            Column(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFFFEF2F2))
                    .border(1.dp, GotchaColors.Danger, RoundedCornerShape(16.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("DETAILS", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Danger)
                Text(detail, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = GotchaColors.Danger, lineHeight = 20.sp)
            }
        }
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GotchaPrimaryButton(
                "Try Again",
                onClick = onRetry,
                containerColor = ImportAccent,
                shapeRadius = 12,
            )
            Text(
                "Go Back",
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                    .clickable(onClick = onBack)
                    .padding(14.dp),
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = GotchaColors.TextMuted,
            )
        }
    }
}

@Composable
private fun MetaRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.TextMuted)
        Text(
            value,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = GotchaColors.Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 12.dp),
            textAlign = TextAlign.End,
        )
    }
}

@Composable
fun AdminUserDetailScreen(userId: String, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<AdminUserRow?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var confirmHardDelete by remember { mutableStateOf(false) }
    var deleteConfirmText by remember { mutableStateOf("") }

    suspend fun loadUser(): AdminUserRow = container.adminRepository.user(userId)

    LaunchedEffect(userId) {
        loading = true
        error = null
        try {
            user = loadUser()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load user"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("User Profile", onBack)
            ErrorBox(error!!)
        }
        else -> {
            val u = user!!
            val payg = u.billingTier?.contains("pay", true) == true ||
                u.planLabel?.contains("pay", true) == true
            val badgeLabel = when {
                u.isSuspended -> "Suspended"
                payg -> "Pay as you go"
                else -> "Free"
            }
            val badgeBg = when {
                u.isSuspended -> Color(0xFFFEE2E2)
                payg -> GotchaColors.BrandPurpleSoft
                else -> Color(0xFFF3F4F6)
            }
            val badgeFg = when {
                u.isSuspended -> GotchaColors.Danger
                payg -> GotchaColors.BrandPurple
                else -> GotchaColors.TextMuted
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebAdminCanvas)
                    .verticalScroll(rememberScrollState()),
            ) {
                // Figma 122:601 — User Profile
                AdminBackHeader("User Profile", onBack)
                Spacer(Modifier.height(2.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(32.dp))
                            .border(2.dp, GotchaColors.BrandPurple, RoundedCornerShape(32.dp))
                            .background(GotchaColors.BrandPurpleSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            (u.displayName ?: u.email).take(1).uppercase(),
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            color = GotchaColors.BrandPurple,
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                u.displayName ?: "Learner",
                                fontFamily = Inter,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                                color = GotchaColors.Ink,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            Text(
                                badgeLabel,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(badgeBg)
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                                color = badgeFg,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(u.email, color = GotchaColors.TextMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Spacer(Modifier.height(16.dp))
                // Figma 122:624 — Words / Streak / Articles
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    UserStatTile(
                        label = "Words",
                        value = formatInt(u.vocabCount ?: 0),
                        valueColor = GotchaColors.BrandPurple,
                        modifier = Modifier.weight(1f),
                    )
                    UserStatTile(
                        label = "Streak",
                        value = "${u.streakCount} days",
                        valueColor = GotchaColors.Ink,
                        modifier = Modifier.weight(1f),
                    )
                    UserStatTile(
                        label = "Articles",
                        value = formatInt(u.sessionCount ?: 0),
                        valueColor = GotchaColors.Ink,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(16.dp))
                // Figma 122:634 — Recent Activity (live soft feed)
                Column(modifier = Modifier.padding(horizontal = 24.dp)) {
                    Text(
                        "Recent Activity",
                        fontFamily = Inter,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                    Spacer(Modifier.height(10.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (u.recentActivity.isEmpty()) {
                            Text("No recent activity yet.", color = GotchaColors.TextMuted, fontSize = 12.sp)
                        } else {
                            u.recentActivity.take(5).forEach { item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        item.label ?: "Activity",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = GotchaColors.Ink,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        relativeShort(item.createdAt),
                                        color = GotchaColors.TextSubtle,
                                        fontSize = 11.sp,
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                // Admin Actions: Reset PW / Suspend
                Column(modifier = Modifier.padding(horizontal = 24.dp)) {
                    Text(
                        "Admin Actions",
                        fontFamily = Inter,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                    Spacer(Modifier.height(10.dp))
                    if (u.isAdmin) {
                        Text(
                            "Admin accounts cannot be modified here.",
                            color = GotchaColors.TextMuted,
                            fontSize = 13.sp,
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            ActionChip(
                                label = if (busy) "…" else "Reset PW",
                                danger = false,
                                enabled = !busy,
                                modifier = Modifier.weight(1f),
                            ) {
                                busy = true
                                actionError = null
                                actionMessage = null
                                scope.launch {
                                    val result = runCatching { container.adminRepository.resetUserPassword(u.id) }
                                    if (result.isSuccess) {
                                        actionMessage = result.getOrNull()?.message ?: "Reset email sent."
                                    } else {
                                        actionError = result.exceptionOrNull()?.message ?: "Reset failed"
                                    }
                                    busy = false
                                }
                            }
                            ActionChip(
                                label = when {
                                    busy -> "…"
                                    u.isSuspended -> "Unsuspend"
                                    else -> "Suspend"
                                },
                                danger = !u.isSuspended,
                                enabled = !busy,
                                modifier = Modifier.weight(1f),
                            ) {
                                busy = true
                                actionError = null
                                actionMessage = null
                                scope.launch {
                                    val result = runCatching {
                                        container.adminRepository.updateUser(u.id, deleted = !u.isSuspended)
                                    }
                                    if (result.isSuccess) {
                                        user = result.getOrNull() ?: loadUser()
                                    } else {
                                        actionError = result.exceptionOrNull()?.message
                                            ?: if (u.isSuspended) "Unsuspend failed" else "Suspend failed"
                                    }
                                    busy = false
                                }
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Delete User Permanently",
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !busy) {
                                    deleteConfirmText = ""
                                    confirmHardDelete = true
                                }
                                .padding(vertical = 12.dp),
                            textAlign = TextAlign.Center,
                            color = GotchaColors.Danger,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                    }
                    actionMessage?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = GotchaColors.SuccessBright, fontSize = 12.sp)
                    }
                    actionError?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = GotchaColors.Danger, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(32.dp))
            }
            // Figma 208:271 — admin-hard-delete-confirm
            if (confirmHardDelete) {
                androidx.compose.ui.window.Dialog(
                    onDismissRequest = {
                        if (!busy) {
                            confirmHardDelete = false
                            deleteConfirmText = ""
                        }
                    },
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White)
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFFEE2E2)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.WarningAmber,
                                contentDescription = null,
                                tint = GotchaColors.Danger,
                                modifier = Modifier.size(28.dp),
                            )
                        }
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "Delete User Permanently?",
                                fontFamily = Inter,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                                color = GotchaColors.Ink,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                "This action cannot be undone. All user data reading history vocabulary and subscription records will be permanently removed.",
                                fontFamily = Inter,
                                fontSize = 13.sp,
                                color = GotchaColors.TextMuted,
                                textAlign = TextAlign.Center,
                                lineHeight = 18.sp,
                            )
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(GotchaColors.WebAdminCanvas)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(GotchaColors.BrandPurpleSoft),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    (u.displayName ?: u.email).take(1).uppercase(),
                                    fontWeight = FontWeight.Bold,
                                    color = GotchaColors.BrandPurple,
                                )
                            }
                            Column {
                                Text(
                                    u.displayName ?: "Learner",
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(u.email, fontSize = 11.sp, color = GotchaColors.TextMuted)
                            }
                        }
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "TYPE DELETE TO CONFIRM",
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = GotchaColors.TextMuted,
                            )
                            BasicTextField(
                                value = deleteConfirmText,
                                onValueChange = { deleteConfirmText = it },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.Danger,
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color.White)
                                    .border(1.5.dp, GotchaColors.Danger, RoundedCornerShape(10.dp))
                                    .padding(12.dp),
                                decorationBox = { inner ->
                                    Box {
                                        if (deleteConfirmText.isEmpty()) {
                                            Text(
                                                "DELETE",
                                                color = GotchaColors.Danger.copy(alpha = 0.35f),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                            )
                                        }
                                        inner()
                                    }
                                },
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                "Cancel",
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                                    .clickable(enabled = !busy) {
                                        confirmHardDelete = false
                                        deleteConfirmText = ""
                                    }
                                    .padding(vertical = 12.dp),
                                textAlign = TextAlign.Center,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = GotchaColors.TextMuted,
                            )
                            val canDelete = deleteConfirmText == "DELETE"
                            Text(
                                if (busy) "Deleting…" else "Delete",
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (canDelete) GotchaColors.Danger else GotchaColors.Danger.copy(alpha = 0.4f))
                                    .clickable(enabled = !busy && canDelete) {
                                        busy = true
                                        actionError = null
                                        scope.launch {
                                            val result = runCatching {
                                                container.adminRepository.hardDeleteUser(u.id)
                                            }
                                            if (result.isSuccess) {
                                                onBack()
                                            } else {
                                                actionError =
                                                    result.exceptionOrNull()?.message ?: "Delete failed"
                                                busy = false
                                            }
                                        }
                                    }
                                    .padding(vertical = 12.dp),
                                textAlign = TextAlign.Center,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = Color.White,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionChip(
    label: String,
    danger: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Text(
        label,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White)
            .border(
                1.dp,
                if (danger) GotchaColors.Danger else GotchaColors.Border,
                RoundedCornerShape(10.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 12.dp),
        textAlign = TextAlign.Center,
        color = if (danger) GotchaColors.Danger else GotchaColors.Ink,
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
    )
}

@Composable
private fun UserStatTile(
    label: String,
    value: String,
    valueColor: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = GotchaColors.TextMuted, fontSize = 11.sp)
        Text(
            value,
            fontFamily = Inter,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 16.sp,
            color = valueColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun AdminAnalyticsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<AdminAnalytics?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var range by remember { mutableStateOf("7d") }

    LaunchedEffect(range) {
        loading = true
        error = null
        try {
            data = container.adminRepository.analytics(range)
        } catch (e: Exception) {
            error = e.message ?: "Failed to load analytics"
        } finally {
            loading = false
        }
    }

    when {
        loading && data == null -> LoadingBox(Modifier.fillMaxSize())
        error != null && data == null -> Column {
            AdminBackHeader("Analytics", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val d = data!!
            val k = d.kpis
            val dayPoints = d.engagementByDay
            val growthBars = dayPoints.map { it.value.toDouble() }.let { bars ->
                if (bars.any { it > 0 }) bars else emptyList()
            }
            val dayLabels = if (growthBars.isNotEmpty()) {
                dayPoints.map { it.label?.takeLast(2) ?: "" }
            } else {
                emptyList()
            }
            val features = d.featureUsage.take(4)
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Figma 122:679 — Analytics
                item {
                    AdminBackHeader(
                        title = "Analytics",
                        onBack = onBack,
                        showBack = false,
                        trailing = {
                        Text(
                            when (range) {
                                "30d" -> "Last 30 Days"
                                "90d" -> "Last 90 Days"
                                else -> "Last 7 Days"
                            },
                            modifier = Modifier
                                .padding(end = 12.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(GotchaColors.BrandPurple)
                                .clickable {
                                    range = when (range) {
                                        "7d" -> "30d"
                                        "30d" -> "90d"
                                        else -> "7d"
                                    }
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                        )
                        }
                    )
                }
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        AnalyticsKpiTile(
                            label = "Active today",
                            value = formatInt(k?.dau ?: 0),
                            hint = if ((k?.dau ?: 0) == 0) "No activity" else "Live learners",
                            hintColor = GotchaColors.TextMuted,
                            modifier = Modifier.weight(1f),
                        )
                        AnalyticsKpiTile(
                            label = "Revenue",
                            value = formatUsdMicros(k?.revenue),
                            hint = "Import payments",
                            hintColor = GotchaColors.TextMuted,
                            modifier = Modifier.weight(1f),
                        )
                        AnalyticsKpiTile(
                            label = "Returning",
                            value = "${(k?.retentionPct ?: 0.0).toInt()}%",
                            hint = "vs prior range",
                            hintColor = GotchaColors.TextMuted,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                item {
                    Column(
                        modifier = Modifier
                            .padding(horizontal = 24.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .padding(14.dp),
                    ) {
                        Text("Reading sessions", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                        Spacer(Modifier.height(8.dp))
                        if (growthBars.isEmpty()) {
                            Text("No reading sessions in this range.", color = GotchaColors.TextMuted, fontSize = 12.sp)
                        } else {
                            val max = growthBars.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
                            Row(
                                modifier = Modifier.fillMaxWidth().height(78.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom,
                            ) {
                                growthBars.forEachIndexed { i, v ->
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(4.dp),
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .width(20.dp)
                                                .height((((v / max) * 62).toInt().coerceAtLeast(8)).dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(GotchaColors.BrandPurple),
                                        )
                                        Text(
                                            dayLabels.getOrElse(i) { "" },
                                            color = GotchaColors.TextMuted,
                                            fontSize = 9.sp,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                item {
                    Column(
                        modifier = Modifier
                            .padding(horizontal = 24.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                            .padding(14.dp),
                    ) {
                        Text("Feature usage", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                        Spacer(Modifier.height(10.dp))
                        if (features.isEmpty()) {
                            Text("No feature usage data for this range.", color = GotchaColors.TextMuted, fontSize = 12.sp)
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(20.dp),
                            ) {
                                FeatureDonut(features, modifier = Modifier.size(64.dp))
                                Column(
                                    modifier = Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    features.forEach { f ->
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                        ) {
                                            Text(f.name ?: "Feature", color = GotchaColors.TextMuted, fontSize = 12.sp)
                                            Text(
                                                "${f.pct.toInt()}%",
                                                color = GotchaColors.Ink,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnalyticsKpiTile(
    label: String,
    value: String,
    hint: String,
    hintColor: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = GotchaColors.TextMuted, fontSize = 11.sp)
        Text(value, color = GotchaColors.Ink, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
        Text(hint, color = hintColor, fontWeight = FontWeight.SemiBold, fontSize = 10.sp)
    }
}

@Composable
private fun FeatureDonut(features: List<AdminNamedPct>, modifier: Modifier = Modifier) {
    val colors = listOf(
        GotchaColors.BrandPurple,
        GotchaColors.SuccessBright,
        Color(0xFFF97316),
        Color(0xFF3B82F6),
    )
    val total = features.sumOf { it.pct }.coerceAtLeast(1.0)
    Canvas(modifier = modifier) {
        var start = -90f
        features.forEachIndexed { i, f ->
            val sweep = ((f.pct / total) * 360f).toFloat()
            drawArc(
                color = colors.getOrElse(i) { GotchaColors.BrandPurple },
                startAngle = start,
                sweepAngle = sweep,
                useCenter = false,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = size.minDimension * 0.18f),
            )
            start += sweep
        }
    }
}

@Composable
fun AdminNotificationsScreen(onBack: () -> Unit) {
    // Figma 122:1073 list + 208:219 compose
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<AdminNotificationsResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCompose by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<AdminCampaign?>(null) }
    var formError by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var audience by remember { mutableStateOf("all") }

    suspend fun reload() {
        data = container.adminRepository.notifications()
    }

    LaunchedEffect(Unit) {
        try {
            reload()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load notifications"
        } finally {
            loading = false
        }
    }

    fun openCompose(existing: AdminCampaign? = null) {
        selected = existing
        name = existing?.name.orEmpty()
        subject = existing?.subject.orEmpty()
        body = existing?.body.orEmpty()
        audience = when (existing?.audience?.lowercase()) {
            "premium", "pro" -> "payg"
            else -> existing?.audience ?: "all"
        }
        formError = null
        showCompose = true
    }

    suspend fun saveCampaign(status: String) {
        if (name.isBlank() || subject.isBlank() || body.isBlank()) {
            formError = "Name, subject, and body are required."
            return
        }
        saving = true
        formError = null
        val result = runCatching {
            if (selected == null) {
                container.adminRepository.createCampaign(
                    AdminCreateCampaignRequest(
                        name = name.trim(),
                        subject = subject.trim(),
                        body = body.trim(),
                        channel = "push",
                        audience = audience,
                        status = status,
                    ),
                )
            } else {
                container.adminRepository.updateCampaign(
                    selected!!.id,
                    AdminUpdateCampaignRequest(
                        name = name.trim(),
                        subject = subject.trim(),
                        body = body.trim(),
                        audience = audience,
                        channel = "push",
                        status = status,
                    ),
                )
            }
        }
        saving = false
        if (result.isSuccess) {
            showCompose = false
            selected = null
            reload()
        } else {
            formError = result.exceptionOrNull()?.message ?: "Save failed"
        }
    }

    if (showCompose) {
        AdminNotificationComposeScreen(
            isNew = selected == null,
            name = name,
            onName = { name = it },
            subject = subject,
            onSubject = { subject = it },
            body = body,
            onBody = { body = it },
            audience = audience,
            onAudience = { audience = it },
            formError = formError,
            saving = saving,
            onBack = { showCompose = false; selected = null },
            onSaveDraft = { scope.launch { saveCampaign("draft") } },
            onSendNow = { scope.launch { saveCampaign("sent") } },
        )
        return
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Notifications", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val campaigns = data!!.campaigns
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item {
                    AdminBackHeader(
                        title = "Notifications",
                        onBack = onBack,
                        showBack = false,
                        trailing = {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(GotchaColors.BrandPurple)
                                .clickable { openCompose(null) }
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Text("+ New", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        }
                    )
                }
                if (campaigns.isEmpty()) {
                    item { EmptyState("No push notifications yet.") }
                } else {
                    items(campaigns, key = { it.id }) { c ->
                        CampaignRow(
                            c = c,
                            onOpen = { openCompose(c) },
                            onMarkSent = {
                                scope.launch {
                                    runCatching {
                                        container.adminRepository.updateCampaign(
                                            c.id,
                                            AdminUpdateCampaignRequest(status = "sent"),
                                        )
                                    }
                                    reload()
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminNotificationComposeScreen(
    isNew: Boolean,
    name: String,
    onName: (String) -> Unit,
    subject: String,
    onSubject: (String) -> Unit,
    body: String,
    onBody: (String) -> Unit,
    audience: String,
    onAudience: (String) -> Unit,
    formError: String?,
    saving: Boolean,
    onBack: () -> Unit,
    onSaveDraft: () -> Unit,
    onSendNow: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.WebAdminCanvas),
    ) {
        AdminBackHeader(if (isNew) "New Notification" else "Edit Notification", onBack)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            AdminComposeField("CAMPAIGN NAME", name, onName, singleLine = true)
            AdminComposeField("SUBJECT LINE", subject, onSubject, singleLine = true)
            AdminComposeField("MESSAGE BODY", body, onBody, singleLine = false, fieldHeight = 100.dp)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "TARGET AUDIENCE",
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = GotchaColors.TextMuted,
                )
                val audiences = listOf(
                    "all" to "All learners",
                    "free" to "Free",
                    "payg" to "Pay as you go",
                    "active" to "Active",
                    "new_users" to "New learners",
                )
                audiences.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (key, label) ->
                            val on = audience == key
                            Text(
                                label,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(if (on) GotchaColors.BrandPurpleSoft else Color.White)
                                    .border(
                                        1.dp,
                                        if (on) GotchaColors.BrandPurple else GotchaColors.Border,
                                        RoundedCornerShape(20.dp),
                                    )
                                    .clickable { onAudience(key) }
                                    .padding(horizontal = 14.dp, vertical = 8.dp),
                                fontFamily = Inter,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                color = if (on) GotchaColors.BrandPurple else GotchaColors.TextMuted,
                            )
                        }
                    }
                }
            }
            formError?.let { Text(it, color = GotchaColors.Danger, fontSize = 12.sp) }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                if (saving) "Saving…" else "Save Draft",
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                    .clickable(enabled = !saving, onClick = onSaveDraft)
                    .padding(vertical = 14.dp),
                textAlign = TextAlign.Center,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
            )
            Text(
                if (saving) "Sending…" else "Send Now",
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (saving) GotchaColors.BrandPurple.copy(alpha = 0.5f) else GotchaColors.BrandPurple)
                    .clickable(enabled = !saving, onClick = onSendNow)
                    .padding(vertical = 14.dp),
                textAlign = TextAlign.Center,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = Color.White,
            )
        }
    }
}

@Composable
private fun AdminComposeField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    singleLine: Boolean,
    fieldHeight: Dp = 44.dp,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = GotchaColors.TextMuted,
        )
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            textStyle = TextStyle(
                fontFamily = Inter,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
                lineHeight = if (singleLine) 18.sp else 20.sp,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(if (singleLine) 44.dp else fieldHeight)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                .padding(12.dp),
        )
    }
}

@Composable
private fun CampaignRow(
    c: AdminCampaign,
    onOpen: () -> Unit,
    onMarkSent: () -> Unit,
) {
    val status = (c.status ?: "draft").lowercase()
    val (statusBg, statusFg) = when (status) {
        "scheduled" -> Color(0xFFFEF3C7) to Color(0xFFF59E0B)
        "sent", "sending" -> Color(0xFFECFDF5) to Color(0xFF10B981)
        else -> Color(0xFFE5E7EB) to GotchaColors.TextMuted
    }
    val audienceKey = (c.audience ?: "all").lowercase()
    val audienceLabel = when (audienceKey) {
        "all" -> "All learners"
        "premium", "payg" -> "Pay as you go"
        "free" -> "Free"
        "active" -> "Active"
        "new_users" -> "New learners"
        else -> audienceKey.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
    val audiencePremium = audienceKey == "payg" || audienceKey == "premium"
    val dateLabel = when (status) {
        "scheduled" -> "Scheduled: ${formatCampaignDay(c.scheduledAt)}"
        "sent", "sending" -> "Sent: ${formatCampaignDay(c.sentAt ?: c.createdAt)}"
        else -> "Draft"
    }
    Column(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .clickable(onClick = onOpen)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                audienceLabel,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (audiencePremium) GotchaColors.BrandPurpleSoft else Color(0xFFF9FAFB))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                color = if (audiencePremium) GotchaColors.BrandPurple else GotchaColors.TextMuted,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
            )
            Text(
                status.replaceFirstChar { it.uppercase() },
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(statusBg)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                color = statusFg,
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
            )
        }
        Text(
            c.subject?.takeIf { it.isNotBlank() } ?: c.name ?: "Campaign",
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            color = GotchaColors.Ink,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(dateLabel, color = GotchaColors.TextSubtle, fontSize = 11.sp)
            // No open-rate field on NotificationCampaign — stay honest.
            Text("Open Rate: --", color = GotchaColors.TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
        }
        if (status != "sent") {
            Text(
                "Mark sent",
                color = GotchaColors.BrandPurple,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                modifier = Modifier.clickable(onClick = onMarkSent),
            )
        }
    }
}

private fun formatCampaignDay(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val date = iso.take(10)
    val parts = date.split("-")
    if (parts.size < 3) return date
    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val monthIdx = parts[1].toIntOrNull()?.minus(1) ?: return date
    val day = parts[2].toIntOrNull() ?: return date
    val month = months.getOrNull(monthIdx) ?: return date
    return "$month $day"
}

@Composable
fun AdminSupportScreen(onBack: () -> Unit, onOpenTicket: (String) -> Unit) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<AdminSupportResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf("All") }

    LaunchedEffect(Unit) {
        try {
            data = container.adminRepository.support()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load support"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Support Tickets", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val d = data!!
            val openCount = d.stats?.open ?: 0
            val tickets = d.tickets.filter {
                when (filter) {
                    "Open" -> it.status.equals("open", true)
                    "In Progress" -> it.status?.contains("progress", true) == true
                    "Resolved" -> it.status.equals("resolved", true) || it.status.equals("closed", true)
                    else -> true
                }
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    AdminBackHeader(
                        title = "Support Tickets",
                        onBack = onBack,
                        showBack = false,
                        trailing = {
                            if (openCount > 0) {
                                Text(
                                    "$openCount Open",
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFFEE2E2))
                                        .padding(horizontal = 10.dp, vertical = 4.dp),
                                    color = GotchaColors.Danger,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                )
                            }
                        },
                    )
                }
                item {
                    Text(
                        if (openCount == 1) {
                            "1 open ticket assigned to you"
                        } else {
                            "$openCount open tickets assigned to you"
                        },
                        modifier = Modifier.padding(horizontal = 24.dp),
                        color = GotchaColors.TextMuted,
                        fontSize = 13.sp,
                    )
                }
                item {
                    Row(
                        modifier = Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(start = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf("All", "Open", "In Progress", "Resolved").forEach { chip ->
                            val selected = filter == chip
                            Text(
                                chip,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) GotchaColors.BrandPurple else Color.White)
                                    .border(
                                        1.dp,
                                        if (selected) GotchaColors.BrandPurple else GotchaColors.Border,
                                        RoundedCornerShape(8.dp),
                                    )
                                    .clickable { filter = chip }
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                color = if (selected) Color.White else GotchaColors.TextMuted,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
                if (tickets.isEmpty()) {
                    item { EmptyState("No tickets in this filter.") }
                } else {
                    items(tickets, key = { it.id }) { t ->
                        TicketRow(t) { onOpenTicket(t.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun TicketRow(t: AdminSupportTicket, onClick: () -> Unit) {
    val name = t.user?.displayName ?: t.user?.email ?: "User"
    val priority = (t.priority ?: "medium").lowercase()
    val (prioBg, prioFg, prioLabel) = when (priority) {
        "high", "urgent" -> Triple(Color(0xFFFEE2E2), GotchaColors.Danger, priority.replaceFirstChar { it.uppercase() })
        "medium" -> Triple(GotchaColors.WarningBg, Color(0xFFF59E0B), "Medium")
        else -> Triple(GotchaColors.SuccessBg, GotchaColors.SuccessBright, "Low")
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
                name.take(1).uppercase(),
                fontWeight = FontWeight.Bold,
                color = GotchaColors.BrandPurple,
                fontSize = 14.sp,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = GotchaColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(
                    "#${t.id.takeLast(3)}",
                    color = GotchaColors.TextSubtle,
                    fontSize = 11.sp,
                )
            }
            Text(
                t.subject ?: "Ticket",
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(relativeShort(t.createdAt), color = GotchaColors.TextSubtle, fontSize = 11.sp)
        }
        Text(
            prioLabel,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(prioBg)
                .padding(horizontal = 8.dp, vertical = 2.dp),
            color = prioFg,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
        )
    }
}

@Composable
fun AdminTicketDetailScreen(ticketId: String, onBack: () -> Unit) {
    val container = LocalAppContainer.current
    var ticket by remember { mutableStateOf<AdminSupportTicket?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reply by remember { mutableStateOf("") }

    LaunchedEffect(ticketId) {
        try {
            ticket = container.adminRepository.support().tickets.find { it.id == ticketId }
            if (ticket == null) error = "Ticket not found"
        } catch (e: Exception) {
            error = e.message ?: "Failed to load ticket"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Ticket", onBack)
            ErrorBox(error!!)
        }
        else -> {
            val t = ticket!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebAdminCanvas)
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 24.dp),
            ) {
                AdminBackHeader("Ticket #${t.id.takeLast(4)}", onBack)
                Column(modifier = Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(t.user?.displayName ?: "User", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                    Text(t.user?.email ?: "", color = GotchaColors.TextMuted, fontSize = 13.sp)
                    Chip((t.status ?: "open").replace('_', ' '))
                    FieldBlock(t.subject ?: "Subject", t.body ?: "")
                    GotchaTextField("Type your reply...", reply, { reply = it }, placeholder = "Type your reply...")
                    GotchaPrimaryButton("Send", onClick = { reply = "" }, enabled = reply.isNotBlank())
                }
            }
        }
    }
}

@Composable
fun AdminGamificationScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<AdminGamificationResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var toggling by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        data = container.adminRepository.gamification()
    }

    LaunchedEffect(Unit) {
        try {
            reload()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load gamification"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Gamification", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val d = data!!
            val s = d.stats
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item { AdminBackHeader("Gamification", onBack, showBack = false) }
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text("Avg Streak", color = GotchaColors.TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                            Text(
                                "${s?.avgStreakDays ?: 0.0} days",
                                color = GotchaColors.Ink,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                            )
                        }
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text("Streakers (7d+)", color = GotchaColors.TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                            Text(
                                formatInt(s?.streakers ?: 0),
                                color = GotchaColors.Ink,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                            )
                        }
                    }
                }
                item {
                    Text(
                        "Achievement Badges",
                        modifier = Modifier.padding(horizontal = 24.dp),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                }
                if (d.achievements.isEmpty()) {
                    item { EmptyState("No achievements configured.") }
                } else {
                    items(d.achievements, key = { it.id }) { a ->
                        AchievementRow(
                            a = a,
                            enabled = toggling != a.id,
                            onToggle = {
                                scope.launch {
                                    toggling = a.id
                                    try {
                                        container.adminRepository.updateAchievement(a.id, !a.isActive)
                                        reload()
                                    } catch (e: Exception) {
                                        error = e.message ?: "Failed to update achievement"
                                    } finally {
                                        toggling = null
                                    }
                                }
                            },
                        )
                    }
                }
                if (d.seasons.isNotEmpty()) {
                    item {
                        Text(
                            "Leaderboard Season",
                            modifier = Modifier.padding(horizontal = 24.dp),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 14.sp,
                            color = GotchaColors.Ink,
                        )
                    }
                    items(d.seasons, key = { it.id }) { season ->
                        Column(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    season.title ?: "Season",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(
                                    (season.status ?: "active").uppercase(),
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFEFF6FF))
                                        .padding(horizontal = 6.dp, vertical = 2.dp),
                                    color = Color(0xFF3B82F6),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 9.sp,
                                )
                            }
                            val ends = season.endsInDays?.let { "Ends in $it days" } ?: "Ongoing"
                            Text(
                                "$ends • ${formatInt(season.participants)} Active participants",
                                color = GotchaColors.TextMuted,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AchievementRow(
    a: AdminAchievement,
    enabled: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                a.title ?: a.code ?: "Achievement",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${a.points} pts · ${a.category ?: "general"} · threshold ${a.threshold}",
                color = GotchaColors.TextSubtle,
                fontSize = 11.sp,
            )
        }
        Switch(
            checked = a.isActive,
            onCheckedChange = { onToggle() },
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedTrackColor = GotchaColors.BrandPurple,
                checkedThumbColor = Color.White,
            ),
        )
    }
}

@Composable
fun AdminLanguagesScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<AdminLanguagesResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var toggling by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        data = container.adminRepository.languages()
    }

    LaunchedEffect(Unit) {
        try {
            reload()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load languages"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Languages", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> LazyColumn(
            modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
            contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Figma 122:1507 — Languages
            item { AdminBackHeader("Languages", onBack, showBack = false) }
            if (data!!.languages.isEmpty()) {
                item { EmptyState("No languages in catalog.") }
            } else {
                items(data!!.languages, key = { it.code }) { lang ->
                    LanguageRow(
                        lang = lang,
                        enabled = toggling != lang.code,
                        onToggle = { checked ->
                            scope.launch {
                                toggling = lang.code
                                try {
                                    container.adminRepository.updateLanguage(lang.code, checked)
                                    reload()
                                } catch (e: Exception) {
                                    error = e.message ?: "Failed to update language"
                                } finally {
                                    toggling = null
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun LanguageRow(
    lang: AdminLanguage,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(lang.flagEmoji ?: "🌐", fontSize = 24.sp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                lang.name ?: lang.code,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = GotchaColors.Ink,
            )
            Text(
                "${formatInt(lang.learnerCount)} learners • ${formatInt(lang.contentCount)} items",
                color = GotchaColors.TextSubtle,
                fontSize = 11.sp,
            )
            Text(
                "Completion Rate: ${lang.cefrCoverage.toInt()}%",
                color = GotchaColors.TextMuted,
                fontSize = 11.sp,
            )
        }
        Switch(
            checked = lang.isEnabled,
            onCheckedChange = onToggle,
            enabled = enabled,
            colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.BrandPurple),
        )
    }
}

@Composable
fun AdminLevelTestsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<AdminLevelTestsResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            data = container.adminRepository.levelTests()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load level tests"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Level Placements", onBack)
            ErrorBox(error!!)
        }
        else -> {
            val d = data!!
            val s = d.stats
            // Figma 198:22 — Level Placements (live KPIs only; hide seed engine config / pass% / duration)
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    AdminBackHeader(
                        title = "Level Placements",
                        onBack = onBack,
                        trailing = {
                            Text(
                                "GOTCHA ADMIN",
                                color = GotchaColors.BrandPurple,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                        },
                    )
                }
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        LevelKpiTile(
                            label = "Tests Month",
                            value = formatInt(s?.monthTotal ?: 0),
                            hint = "this month",
                            modifier = Modifier.weight(1f),
                        )
                        LevelKpiTile(
                            label = "Avg Score",
                            value = "%.1f".format(s?.avgScore ?: 0.0),
                            hint = "all time",
                            modifier = Modifier.weight(1f),
                        )
                        LevelKpiTile(
                            label = "Total",
                            value = formatInt(s?.total ?: 0),
                            hint = "assessments",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                item {
                    Text(
                        "CEFR Level Performance",
                        modifier = Modifier.padding(horizontal = 24.dp),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                }
                if (s?.byLevel.isNullOrEmpty()) {
                    item { EmptyState("No placement distribution yet.") }
                } else {
                    items(s!!.byLevel, key = { it.level ?: it.hashCode().toString() }) { bucket ->
                        val level = (bucket.level ?: "—").uppercase()
                        Row(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    level,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFF0E7FF))
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    color = GotchaColors.BrandPurple,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 12.sp,
                                )
                                Text(
                                    "${formatInt(bucket.count)} tests completed",
                                    color = GotchaColors.TextMuted,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                            Text(
                                "${bucket.pct}%",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = GotchaColors.Ink,
                            )
                        }
                    }
                }
                item {
                    Text(
                        "Recent Placements",
                        modifier = Modifier.padding(horizontal = 24.dp),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                }
                if (d.results.isEmpty()) {
                    item { EmptyState("No placement results yet.") }
                } else {
                    items(d.results.take(50), key = { it.id }) { r ->
                        val name = r.user?.displayName ?: r.user?.email ?: "Learner"
                        val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
                        val level = r.suggestedLevel?.uppercase() ?: "—"
                        Row(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFFF0E7FF)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    initial,
                                    color = GotchaColors.BrandPurple,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                )
                            }
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                                Text(
                                    "Score: ${"%.0f".format(r.score)} • Level: $level" +
                                        (r.targetLanguage?.let { " • ${it.uppercase()}" } ?: ""),
                                    color = GotchaColors.TextMuted,
                                    fontSize = 11.sp,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelKpiTile(
    label: String,
    value: String,
    hint: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = GotchaColors.TextMuted)
        Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = GotchaColors.Ink)
        Text(hint, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = GotchaColors.TextMuted)
    }
}

@Composable
fun AdminAiUsageScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    var data by remember { mutableStateOf<AdminAiUsageResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            data = container.adminRepository.aiUsage()
        } catch (e: Exception) {
            error = e.message ?: "Failed to load AI usage"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("AI Usage", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val d = data!!
            val t = d.today
            val dailyBars = d.dailyLookups.map { it.toDouble() }
            val hourlyBars = d.hourlyLookups.map { it.toDouble() }
            val volume = when {
                dailyBars.any { it > 0 } -> dailyBars
                hourlyBars.any { it > 0 } -> hourlyBars
                else -> emptyList()
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
                contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item { AdminBackHeader("AI Usage", onBack, showBack = false) }
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        AiKpiTile(
                            label = "Lookups",
                            value = formatInt(t?.lookups ?: 0),
                            modifier = Modifier.weight(1f),
                        )
                        AiKpiTile(
                            label = "Avg / User",
                            value = "%.1f".format(t?.avgLookupsPerUser ?: 0.0),
                            modifier = Modifier.weight(1f),
                        )
                        AiKpiTile(
                            label = "Active Users",
                            value = formatInt(t?.uniqueUsers ?: 0),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (volume.isNotEmpty()) {
                    item {
                        Column(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "Daily Lookup Volume",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 12.sp,
                                color = GotchaColors.TextMuted,
                            )
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                    .padding(12.dp),
                            ) {
                                MiniBarChart(values = volume, heightDp = 48, barWidthDp = 14)
                            }
                        }
                    }
                }
                item {
                    Text(
                        "Top AI Users",
                        modifier = Modifier.padding(horizontal = 24.dp),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 12.sp,
                        color = GotchaColors.TextMuted,
                    )
                }
                if (d.topUsers.isEmpty()) {
                    item { EmptyState("No learner AI usage yet.") }
                } else {
                    items(d.topUsers.take(20)) { row ->
                        val display = buildString {
                            append(row.user?.displayName ?: row.user?.email ?: "User")
                            append(" (")
                            append(row.plan ?: "Free")
                            append(")")
                        }
                        Row(
                            modifier = Modifier
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(display, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = GotchaColors.Ink)
                                Text(
                                    "${row.lookups} lookups · ${row.monthLookups} this month",
                                    color = GotchaColors.TextSubtle,
                                    fontSize = 10.sp,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AiKpiTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color = GotchaColors.Ink,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = GotchaColors.TextSubtle)
        Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = valueColor)
    }
}

@Composable
fun AdminSettingsScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var settings by remember { mutableStateOf<AdminSettings?>(null) }
    var me by remember { mutableStateOf<AdminMe?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var savedFlash by remember { mutableStateOf(false) }
    var uploadingPhoto by remember { mutableStateOf(false) }
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploadingPhoto = true
            error = null
            try {
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                val name = when {
                    mime.contains("png") -> "avatar.png"
                    mime.contains("webp") -> "avatar.webp"
                    else -> "avatar.jpg"
                }
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: error("Could not read image")
                val updated = container.userRepository.uploadAvatar(bytes, name, mime)
                me = me?.copy(avatarUrl = updated.avatarUrl) ?: container.adminRepository.me()
            } catch (e: Exception) {
                error = e.message ?: "Couldn’t upload photo"
            } finally {
                uploadingPhoto = false
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            settings = container.adminRepository.settings()
            runCatching { me = container.adminRepository.me() }
        } catch (e: Exception) {
            error = e.message ?: "Failed to load settings"
        } finally {
            loading = false
        }
    }

    fun persist(patch: (AdminSettings) -> AdminSettings) {
        val current = settings ?: return
        val next = patch(current)
        settings = next
        scope.launch {
            saving = true
            savedFlash = false
            try {
                settings = container.adminRepository.updateSettings(
                    app.gotcha.android.data.model.AdminUpdateSettingsRequest(
                        platformName = next.platformName,
                        supportEmail = next.supportEmail,
                        aiDailyLimit = next.aiDailyLimit,
                        aiEnabled = next.aiEnabled,
                        aiLookupModel = next.aiLookupModel,
                        aiQuizModel = next.aiQuizModel,
                        aiDefaultUserQuota = next.aiDefaultUserQuota,
                        contentModerationEnabled = next.contentModerationEnabled,
                        autoApproveImports = next.autoApproveImports,
                    ),
                )
                savedFlash = true
            } catch (e: Exception) {
                error = e.message ?: "Failed to save settings"
                try {
                    settings = container.adminRepository.settings()
                } catch (_: Exception) {
                }
            } finally {
                saving = false
            }
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null && settings == null -> Column {
            AdminBackHeader("Settings", onBack, showBack = false)
            ErrorBox(error!!)
        }
        else -> {
            val s = settings!!
            // Figma 122:1591 — Settings (live fields only; hide 2FA / session / accent correction)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(GotchaColors.WebAdminCanvas)
                    .verticalScroll(rememberScrollState()),
            ) {
                AdminBackHeader("Settings", onBack, showBack = false)
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (error != null) {
                        Text(error!!, color = GotchaColors.Danger, fontSize = 12.sp)
                    }
                    SettingsSection("Admin account") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !uploadingPhoto) {
                                    photoPicker.launch(
                                        androidx.activity.result.PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                                        ),
                                    )
                                }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
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
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = GotchaColors.Ink,
                                )
                                Text(
                                    if (uploadingPhoto) "Uploading…" else "Change photo · JPG, PNG, or WebP",
                                    color = GotchaColors.TextMuted,
                                    fontSize = 12.sp,
                                )
                            }
                        }
                    }
                    SettingsSection("App Configuration") {
                        SettingsValueRow("Brand Name", s.platformName ?: "GOTCHA")
                        SettingsValueRow("Support Email", s.supportEmail ?: "—", showDivider = false)
                    }
                    SettingsSection("AI Configuration") {
                        SettingsValueRow(
                            "LLM Provider",
                            prettyModelName(s.aiLookupModel),
                            valueColor = GotchaColors.BrandPurple,
                            valueBold = true,
                        )
                        SettingsValueRow("Daily AI Limit", formatInt(s.aiDailyLimit))
                        SettingsToggleRow(
                            "Enable AI for Learners",
                            s.aiEnabled,
                            enabled = !saving,
                            showDivider = false,
                        ) { checked -> persist { it.copy(aiEnabled = checked) } }
                    }
                    SettingsSection("Content Moderation") {
                        SettingsToggleRow(
                            "Require Import Review",
                            s.contentModerationEnabled,
                            enabled = !saving,
                        ) { checked -> persist { it.copy(contentModerationEnabled = checked) } }
                        SettingsToggleRow(
                            "Auto-approve Trusted Imports",
                            s.autoApproveImports,
                            enabled = !saving,
                            showDivider = false,
                        ) { checked -> persist { it.copy(autoApproveImports = checked) } }
                    }
                    if (savedFlash) {
                        Text(
                            "Saved",
                            color = GotchaColors.SuccessBright,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                        )
                    }
                    Text(
                        "Version 2.4.0",
                        color = GotchaColors.TextSubtle,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp, bottom = 24.dp),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

private fun prettyModelName(model: String?): String {
    if (model.isNullOrBlank()) return "—"
    return model
        .replace('-', ' ')
        .split(' ')
        .joinToString(" ") { part ->
            part.replaceFirstChar { ch -> if (ch.isLowerCase()) ch.titlecase() else ch.toString() }
        }
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            title.uppercase(),
            fontWeight = FontWeight.ExtraBold,
            fontSize = 12.sp,
            color = GotchaColors.TextSubtle,
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp)),
        ) {
            content()
        }
    }
}

@Composable
private fun SettingsValueRow(
    label: String,
    value: String,
    showDivider: Boolean = true,
    valueColor: Color = GotchaColors.TextSubtle,
    valueBold: Boolean = false,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.Ink)
            Text(
                value,
                fontWeight = if (valueBold) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp,
                color = valueColor,
            )
        }
        if (showDivider) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(GotchaColors.Border),
            )
        }
    }
}

@Composable
private fun SettingsToggleRow(
    label: String,
    checked: Boolean,
    enabled: Boolean = true,
    showDivider: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.Ink)
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                enabled = enabled,
                colors = SwitchDefaults.colors(checkedTrackColor = GotchaColors.BrandPurple),
            )
        }
        if (showDivider) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(GotchaColors.Border),
            )
        }
    }
}

@Composable
private fun FieldBlock(label: String, value: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Text(label, color = GotchaColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(value, color = GotchaColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun Chip(text: String) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(GotchaColors.BrandPurpleSoft)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        color = GotchaColors.BrandPurple,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
    )
}

@Composable
private fun ActionChip(text: String) {
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(GotchaColors.WebAdminCanvas)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        color = GotchaColors.Ink,
    )
}

@Composable
private fun UsageBar(label: String, pct: Double) {
    Column(modifier = Modifier.padding(vertical = 6.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 13.sp, color = GotchaColors.Ink)
            Text("${pct.toInt()}%", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GotchaColors.BrandPurple)
        }
        Spacer(Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(GotchaColors.Border),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth((pct / 100.0).toFloat().coerceIn(0.05f, 1f))
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(GotchaColors.BrandPurple),
            )
        }
    }
}

@Composable
fun AdminPricingRuleEditScreen(ruleId: String, onBack: () -> Unit) {
    // Figma 208:7 — admin-edit-pricing-rule
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var label by remember { mutableStateOf("") }
    var base by remember { mutableStateOf("") }
    var page by remember { mutableStateOf("") }
    var active by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(ruleId) {
        try {
            val rule = container.adminRepository.importPricing().rules.find { it.id == ruleId }
            if (rule == null) {
                error = "Rule not found"
            } else {
                label = rule.label ?: rule.key ?: "Type"
                base = (rule.pricePerImport ?: 0.0).let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }
                page = (rule.pricePerPage ?: 0.0).let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }
                active = rule.isActive
            }
        } catch (e: Exception) {
            error = e.message ?: "Failed to load rule"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null && label.isEmpty() -> Column {
            AdminBackHeader("Edit Pricing Rule", onBack)
            ErrorBox(error!!)
        }
        else -> Column(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.WebAdminCanvas),
        ) {
            AdminBackHeader("Edit Pricing Rule", onBack)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "PRICING TYPE / CATEGORY",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = GotchaColors.TextSubtle,
                    )
                    Text(
                        label,
                        fontFamily = Inter,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        color = GotchaColors.Ink,
                    )
                }
                AdminLabeledField("Base Price (UZS)", base, { base = it }, placeholder = "49900")
                AdminLabeledField("Per Page Price (UZS)", page, { page = it }, placeholder = "500")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Active Status",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                    Switch(
                        checked = active,
                        onCheckedChange = { active = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = GotchaColors.BrandPurple,
                            uncheckedThumbColor = Color.White,
                            uncheckedTrackColor = GotchaColors.Border,
                        ),
                    )
                }
                if (error != null) {
                    Text(error!!, color = GotchaColors.Danger, fontSize = 13.sp)
                }
                Spacer(Modifier.height(8.dp))
            }
            AdminSaveFooter(
                text = if (saving) "Saving…" else "Save Changes",
                enabled = !saving,
                onClick = {
                    scope.launch {
                        saving = true
                        error = null
                        try {
                            container.adminRepository.updateImportPricingRules(
                                UpdateImportPricingRulesRequest(
                                    rules = listOf(
                                        ImportPricingRulePatch(
                                            id = ruleId,
                                            pricePerImport = base.toDoubleOrNull(),
                                            pricePerPage = page.toDoubleOrNull(),
                                            isActive = active,
                                        ),
                                    ),
                                ),
                            )
                            onBack()
                        } catch (e: Exception) {
                            error = e.message ?: "Save failed"
                        } finally {
                            saving = false
                        }
                    }
                },
            )
        }
    }
}

@Composable
fun AdminPricingLimitsEditScreen(onBack: () -> Unit) {
    // Figma 208:42 — admin-free-limits
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var daily by remember { mutableStateOf("") }
    var monthly by remember { mutableStateOf("") }
    var lookupQuota by remember { mutableStateOf("") }
    var platformAiLimit by remember { mutableStateOf("") }
    var allowedFormats by remember { mutableStateOf(setOf("article", "news")) }
    var resetCycle by remember { mutableStateOf("monthly") }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val formatOptions = listOf(
        "article" to "Articles",
        "news" to "News",
        "ebook" to "Books",
        "research" to "Research Papers",
    )

    LaunchedEffect(Unit) {
        try {
            val pricing = container.adminRepository.importPricing()
            val settings = runCatching { container.adminRepository.settings() }.getOrNull()
            val limits = pricing.freeLimits
            daily = (limits?.dailyFreeImportsPerUser ?: 0).toString()
            monthly = (limits?.monthlyFreePageLimit ?: 0).toString()
            lookupQuota = (settings?.aiDefaultUserQuota ?: 50).toString()
            platformAiLimit = (settings?.aiDailyLimit ?: 0).toString()
            if (!limits?.allowedFormats.isNullOrEmpty()) {
                allowedFormats = limits!!.allowedFormats.map {
                    when (it.lowercase()) {
                        "articles", "article" -> "article"
                        "books", "book", "ebook", "e-book" -> "ebook"
                        else -> it.lowercase()
                    }
                }.toSet()
            }
            resetCycle = limits?.resetCycle?.lowercase()?.takeIf { it.isNotBlank() } ?: "monthly"
        } catch (e: Exception) {
            error = e.message ?: "Failed to load limits"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null && daily.isEmpty() -> Column {
            AdminBackHeader("Free Usage Limits", onBack)
            ErrorBox(error!!)
        }
        else -> Column(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.WebAdminCanvas),
        ) {
            AdminBackHeader("Free Usage Limits", onBack)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEEF2F6))
                        .border(1.dp, Color(0xFFD1D6E0), RoundedCornerShape(12.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "Set daily and monthly limits for free-tier users",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp,
                        color = GotchaColors.TextMuted,
                    )
                }
                AdminLabeledField("Daily Free Imports", daily, { daily = it }, placeholder = "3")
                AdminLabeledField("Monthly Page Limit", monthly, { monthly = it }, placeholder = "50")
                AdminLabeledField("Lookups per learner / day", lookupQuota, { lookupQuota = it }, placeholder = "50")
                AdminLabeledField("Platform daily AI limit", platformAiLimit, { platformAiLimit = it }, placeholder = "0")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Allowed Formats",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = GotchaColors.TextMuted,
                    )
                    formatOptions.forEach { (key, label) ->
                        val on = allowedFormats.contains(key)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                .clickable {
                                    allowedFormats = if (on) allowedFormats - key else allowedFormats + key
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(if (on) GotchaColors.BrandPurple else Color.White)
                                    .border(
                                        1.dp,
                                        if (on) GotchaColors.BrandPurple else GotchaColors.TextSubtle,
                                        RoundedCornerShape(4.dp),
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (on) {
                                    Icon(
                                        Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(12.dp),
                                    )
                                }
                            }
                            Text(
                                label,
                                modifier = Modifier.weight(1f),
                                fontFamily = Inter,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp,
                                color = GotchaColors.Ink,
                            )
                            Text(
                                if (on) "Enabled" else "Disabled",
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.TextSubtle,
                            )
                        }
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Reset Cycle",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = GotchaColors.TextMuted,
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                            .clickable {
                                resetCycle = if (resetCycle == "daily") "monthly" else "daily"
                            }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            if (resetCycle == "daily") "Daily" else "Monthly",
                            fontFamily = Inter,
                            fontWeight = FontWeight.Medium,
                            fontSize = 15.sp,
                            color = GotchaColors.Ink,
                        )
                        Icon(
                            Icons.Outlined.KeyboardArrowDown,
                            contentDescription = null,
                            tint = GotchaColors.TextSubtle,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
                if (error != null) {
                    Text(error!!, color = GotchaColors.Danger, fontSize = 13.sp)
                }
            }
            AdminSaveFooter(
                text = if (saving) "Saving…" else "Save Changes",
                enabled = !saving,
                onClick = {
                    scope.launch {
                        saving = true
                        error = null
                        try {
                            container.adminRepository.updateImportFreeLimits(
                                UpdateImportFreeLimitsRequest(
                                    dailyFreeImportsPerUser = daily.toIntOrNull(),
                                    monthlyFreePageLimit = monthly.toIntOrNull(),
                                    allowedFormats = allowedFormats.toList(),
                                    resetCycle = resetCycle,
                                ),
                            )
                            container.adminRepository.updateSettings(
                                app.gotcha.android.data.model.AdminUpdateSettingsRequest(
                                    aiDefaultUserQuota = lookupQuota.toIntOrNull(),
                                    aiDailyLimit = platformAiLimit.toIntOrNull(),
                                ),
                            )
                            onBack()
                        } catch (e: Exception) {
                            error = e.message ?: "Save failed"
                        } finally {
                            saving = false
                        }
                    }
                },
            )
        }
    }
}

@Composable
fun AdminPricingTiersScreen(onBack: () -> Unit, onOpenTier: (String) -> Unit, onAddTier: () -> Unit) {
    // Figma 208:101 — admin-page-tiers
    val container = LocalAppContainer.current
    var tiers by remember { mutableStateOf<List<ImportPageTier>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            tiers = container.adminRepository.importPricing().tiers
        } catch (e: Exception) {
            error = e.message ?: "Failed to load tiers"
        } finally {
            loading = false
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null -> Column {
            AdminBackHeader("Page Tiers", onBack)
            ErrorBox(error!!)
        }
        else -> LazyColumn(
            modifier = Modifier.fillMaxSize().background(GotchaColors.WebAdminCanvas),
            contentPadding = PaddingValues(bottom = LocalAdminBottomInset.current + 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { AdminBackHeader("Page Tiers", onBack) }
            item {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 24.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEEF2F6))
                        .border(1.dp, Color(0xFFD1D6E0), RoundedCornerShape(12.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "Scale costs by document length",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = GotchaColors.TextMuted,
                    )
                }
            }
            item {
                Text(
                    "ACTIVE TIERS",
                    modifier = Modifier.padding(horizontal = 24.dp),
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = GotchaColors.TextSubtle,
                )
            }
            items(tiers, key = { it.id }) { tier ->
                val idx = tiers.indexOfFirst { it.id == tier.id }.coerceAtLeast(0) + 1
                val range = when {
                    tier.maxPages == null -> "${tier.minPages}+ pages"
                    else -> "${tier.minPages}–${tier.maxPages} pages"
                }
                val price = tier.priceUsd.takeIf { it > 0 } ?: tier.priceUzs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                        .clickable { onOpenTier(tier.id) }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(GotchaColors.BrandPurple)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Text(
                                "T$idx",
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = Color.White,
                            )
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                tier.label?.takeIf { it.isNotBlank() } ?: range,
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = GotchaColors.Ink,
                            )
                            Text(
                                formatTierUzs(price),
                                fontFamily = Inter,
                                fontSize = 12.sp,
                                color = GotchaColors.TextMuted,
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(GotchaColors.WebAdminCanvas),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = androidx.compose.ui.res.painterResource(R.drawable.ic_pencil),
                            contentDescription = "Edit",
                            tint = GotchaColors.TextMuted,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                        .clickable(onClick = onAddTier)
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(GotchaColors.BrandPurple.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Outlined.Add,
                            contentDescription = null,
                            tint = GotchaColors.BrandPurple,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Text(
                        "Add range",
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = GotchaColors.Ink,
                    )
                }
            }
        }
    }
}

@Composable
fun AdminPricingTierEditScreen(tierId: String, onBack: () -> Unit) {
    val isNew = tierId == "new"
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var label by remember { mutableStateOf("") }
    var minPages by remember { mutableStateOf("1") }
    var maxPages by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(tierId) {
        try {
            val pricing = container.adminRepository.importPricing()
            if (isNew) {
                val high = pricing.tiers.maxOfOrNull { it.maxPages ?: it.minPages } ?: 0
                minPages = (high + 1).coerceAtLeast(1).toString()
                maxPages = ""
                label = ""
                price = ""
            } else {
                val tier = pricing.tiers.find { it.id == tierId }
                if (tier == null) {
                    error = "Tier not found"
                } else {
                    label = tier.label.orEmpty()
                    minPages = tier.minPages.toString()
                    maxPages = tier.maxPages?.toString().orEmpty()
                    val p = if (tier.priceUsd > 0) tier.priceUsd else tier.priceUzs
                    price = if (p % 1.0 == 0.0) p.toInt().toString() else p.toString()
                }
            }
        } catch (e: Exception) {
            error = e.message ?: "Failed to load tier"
        } finally {
            loading = false
        }
    }

    fun persist() {
        scope.launch {
            saving = true
            error = null
            try {
                val min = minPages.toIntOrNull()
                val max = maxPages.trim().toIntOrNull()
                val n = price.toDoubleOrNull()
                if (min == null || min < 1) {
                    error = "Each tier needs a minimum of at least 1 page."
                    return@launch
                }
                if (maxPages.isNotBlank() && (max == null || max < min)) {
                    error = "Max pages must be empty (unlimited) or ≥ min pages."
                    return@launch
                }
                val body = UpdateImportPageTierRequest(
                    label = label.trim().ifBlank { null },
                    minPages = min,
                    maxPages = max,
                    priceUsd = n,
                    priceUzs = n,
                )
                if (isNew) {
                    container.adminRepository.createImportPageTier(body)
                } else {
                    container.adminRepository.updateImportPageTier(tierId, body)
                }
                onBack()
            } catch (e: Exception) {
                error = e.message ?: "Save failed"
            } finally {
                saving = false
            }
        }
    }

    when {
        loading -> LoadingBox(Modifier.fillMaxSize())
        error != null && !isNew && label.isEmpty() && minPages == "1" -> Column {
            AdminBackHeader("Edit Tier", onBack)
            ErrorBox(error!!)
        }
        else -> Column(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.WebAdminCanvas),
        ) {
            AdminBackHeader(if (isNew) "New range" else "Edit Tier", onBack)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                AdminLabeledField("Label", label, { label = it }, placeholder = "1 - 10 pages")
                AdminLabeledField("Min pages", minPages, { minPages = it.filter(Char::isDigit) }, placeholder = "1")
                AdminLabeledField("Max pages (blank = unlimited)", maxPages, { maxPages = it.filter(Char::isDigit) }, placeholder = "10")
                AdminLabeledField("Price (UZS)", price, { price = it }, placeholder = "12000")
                if (error != null) {
                    Text(error!!, color = GotchaColors.Danger, fontSize = 13.sp)
                }
                if (!isNew) {
                    Text(
                        if (confirmDelete) "Tap again to delete this range" else "Delete range",
                        color = GotchaColors.Danger,
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .clickable(enabled = !saving) {
                                if (!confirmDelete) {
                                    confirmDelete = true
                                } else {
                                    scope.launch {
                                        saving = true
                                        error = null
                                        try {
                                            container.adminRepository.deleteImportPageTier(tierId)
                                            onBack()
                                        } catch (e: Exception) {
                                            error = e.message ?: "Delete failed"
                                            confirmDelete = false
                                        } finally {
                                            saving = false
                                        }
                                    }
                                }
                            }
                            .padding(vertical = 8.dp),
                    )
                }
            }
            AdminSaveFooter(
                text = if (saving) "Saving…" else if (isNew) "Add range" else "Save Changes",
                enabled = !saving,
                onClick = { persist() },
            )
        }
    }
}

@Composable
private fun AdminLabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            label,
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = GotchaColors.TextMuted,
        )
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(
                fontFamily = Inter,
                fontWeight = FontWeight.Medium,
                fontSize = 15.sp,
                color = GotchaColors.Ink,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            decorationBox = { inner ->
                Box {
                    if (value.isEmpty()) {
                        Text(placeholder, color = GotchaColors.TextSubtle, fontSize = 15.sp)
                    }
                    inner()
                }
            },
        )
    }
}

@Composable
private fun AdminSaveFooter(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            // Clear system-nav frost on secondary screens (no bottom tab pill).
            .padding(bottom = LocalAdminBottomInset.current),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(GotchaColors.Border),
        )
        Text(
            text,
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(if (enabled) GotchaColors.BrandPurple else GotchaColors.BrandPurple.copy(alpha = 0.5f))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(vertical = 14.dp),
            textAlign = TextAlign.Center,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            color = Color.White,
        )
    }
}

private fun formatTierUzs(amount: Double): String {
    val formatted = java.text.NumberFormat.getNumberInstance(java.util.Locale.US).apply {
        maximumFractionDigits = if (amount % 1.0 == 0.0) 0 else 2
        minimumFractionDigits = 0
    }.format(amount)
    return "$formatted UZS"
}
