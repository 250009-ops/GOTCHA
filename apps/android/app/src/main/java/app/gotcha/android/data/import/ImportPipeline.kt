package app.gotcha.android.data.import

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.data.repo.ImportRepository
import app.gotcha.android.debug.ExternalImportDebug
import kotlinx.coroutines.delay
import java.io.File

const val MAX_IMPORT_FILE_BYTES = 100L * 1024 * 1024
private val ACCEPTED_EXT = listOf(".pdf", ".epub")

fun isSupportedImportMime(mime: String?): Boolean {
    if (mime.isNullOrBlank()) return false
    val normalized = mime.lowercase()
    return normalized == "application/pdf" ||
        normalized == "application/epub+zip" ||
        normalized == "application/epub" ||
        normalized == "application/x-epub+zip"
}

data class ResolvedImportFile(
    val uri: Uri,
    val name: String,
    val sizeBytes: Long,
    val mimeType: String,
)

fun resolveImportContentId(item: UserImport): String? =
    item.contentId?.takeIf { it.isNotBlank() } ?: item.content?.id?.takeIf { it.isNotBlank() }

fun importProgressMessage(item: UserImport): String {
    val done = item.progressPagesDone
    val total = item.progressPagesTotal
    return when (item.progressPhase) {
        "ocr" -> "Scanning pages with OCR…"
        "ai" -> "Cleaning up text…"
        else -> when {
            done != null && total != null && total > 0 ->
                "Processing pages $done / $total…"
            else -> "Preparing your reading material…"
        }
    }
}

suspend fun awaitImportReady(
    importRepository: ImportRepository,
    importId: String,
    onProgress: (UserImport) -> Unit = {},
): UserImport? {
    repeat(240) { attempt ->
        val item = importRepository.list(page = 1, pageSize = 20).items.find { it.id == importId }
        when {
            item == null -> return null
            item.ingestionStatus == "failed" ->
                throw IllegalStateException(item.errorMessage ?: "Import failed")
            resolveImportContentId(item) != null &&
                (item.ingestionStatus == "ready" || item.content != null) -> return item
            else -> onProgress(item)
        }
        delay(if (attempt < 6) 1000L else 2000L)
    }
    return null
}

fun resolveImportUri(
    context: Context,
    uri: Uri,
    mimeHint: String? = null,
): Pair<ResolvedImportFile?, String?> {
    var name: String? = null
    var size = 0L
    runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIdx >= 0) name = cursor.getString(nameIdx)
                if (sizeIdx >= 0) size = cursor.getLong(sizeIdx)
            }
        }
    }
    // Telegram/content URIs often expose PDF metadata in DISPLAY_NAME (wrong book title).
    // Prefer the real filename from the URI path when it ends with .pdf / .epub.
    val pathSegment = uri.lastPathSegment?.let { android.net.Uri.decode(it) }?.substringAfterLast('/')
    val pathLooksLikeFile = pathSegment != null &&
        ACCEPTED_EXT.any { pathSegment.lowercase().endsWith(it) }
    val baseName = when {
        pathLooksLikeFile -> pathSegment!!
        !name.isNullOrBlank() && ACCEPTED_EXT.any { name!!.lowercase().endsWith(it) } -> name!!
        !name.isNullOrBlank() -> name!!
        else -> uri.lastPathSegment ?: "import"
    }
    val lower = baseName.lowercase()
    val mime = mimeHint?.takeIf { it.isNotBlank() }
        ?: context.contentResolver.getType(uri)
    val hasAcceptedExt = ACCEPTED_EXT.any { lower.endsWith(it) }
    if (!hasAcceptedExt && !isSupportedImportMime(mime)) {
        return null to "Only PDF and EPUB files are supported"
    }
    if (size > MAX_IMPORT_FILE_BYTES) {
        return null to "File exceeds the 100 MB limit"
    }
    val isEpub = lower.endsWith(".epub") || mime?.contains("epub", ignoreCase = true) == true
    val resolvedName = when {
        hasAcceptedExt -> baseName
        isEpub -> "$baseName.epub"
        else -> "$baseName.pdf"
    }
    val resolvedMime = mime ?: if (isEpub) "application/epub+zip" else "application/pdf"
    return ResolvedImportFile(uri, resolvedName, size, resolvedMime) to null
}

/** Copy a content URI into app cache so Telegram/share permissions cannot expire mid-import. */
fun cacheExternalImport(context: Context, uri: Uri, mimeHint: String?): Pair<File, ResolvedImportFile>? {
    val (resolved, error) = resolveImportUri(context, uri, mimeHint)
    if (resolved == null) {
        ExternalImportDebug.log("CACHE", "resolveImportUri failed: $error uri=$uri mime=$mimeHint")
        return null
    }
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
    if (bytes == null) {
        ExternalImportDebug.log("CACHE", "openInputStream=null uri=$uri")
        return null
    }
    ExternalImportDebug.log("CACHE", "read ${bytes.size} bytes name=${resolved.name}")
    val ext = if (resolved.mimeType.contains("epub", ignoreCase = true)) ".epub" else ".pdf"
    val dir = File(context.cacheDir, "external-imports").apply { mkdirs() }
    val cached = File(dir, "share-${System.currentTimeMillis()}$ext")
    cached.writeBytes(bytes)
    val mime = mimeHint?.takeIf { it.isNotBlank() } ?: resolved.mimeType
    return cached to resolved.copy(mimeType = mime)
}

fun titleFromFileName(fileName: String): String =
    fileName.substringBeforeLast('.').replace(Regex("[-_]+"), " ").trim()

fun deleteCachedImport(cachePath: String?) {
    if (cachePath.isNullOrBlank()) return
    runCatching { File(cachePath).delete() }
}
