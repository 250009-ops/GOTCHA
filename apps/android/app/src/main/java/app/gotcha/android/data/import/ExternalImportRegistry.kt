package app.gotcha.android.data.import

import android.content.Context
import java.io.File
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
private data class ExternalImportMap(
    val entries: Map<String, String> = emptyMap(),
    val pendingPayments: Map<String, String> = emptyMap(),
)

/**
 * Maps Telegram/share file identity → content id so re-opening the same PDF skips re-import.
 */
class ExternalImportRegistry(context: Context) {
    private val file = File(context.filesDir, "external-import-map.json")
    private val json = Json { ignoreUnknownKeys = true }

    fun lookupKey(fileName: String, sizeBytes: Long): String =
        "${normalize(fileName)}|$sizeBytes"

    fun lookup(fileName: String, sizeBytes: Long): String? {
        val map = read().entries
        return map[lookupKey(fileName, sizeBytes)]
            ?: map[normalize(fileName)]
    }

    fun remember(fileName: String, sizeBytes: Long, contentId: String) {
        if (contentId.isBlank()) return
        val current = read()
        val next = current.entries.toMutableMap()
        next[lookupKey(fileName, sizeBytes)] = contentId
        next[normalize(fileName)] = contentId
        val pending = current.pendingPayments.toMutableMap()
        pending.remove(lookupKey(fileName, sizeBytes))
        pending.remove(normalize(fileName))
        write(ExternalImportMap(next, pending))
    }

    fun rememberPendingPayment(fileName: String, sizeBytes: Long, paymentId: String) {
        if (paymentId.isBlank()) return
        val current = read()
        val pending = current.pendingPayments.toMutableMap()
        pending[lookupKey(fileName, sizeBytes)] = paymentId
        write(ExternalImportMap(current.entries, pending))
    }

    fun lookupPendingPayment(fileName: String, sizeBytes: Long): String? {
        val pending = read().pendingPayments
        return pending[lookupKey(fileName, sizeBytes)]
    }

    fun clearPendingPayment(fileName: String, sizeBytes: Long) {
        val current = read()
        val pending = current.pendingPayments.toMutableMap()
        if (pending.remove(lookupKey(fileName, sizeBytes)) == null) return
        write(ExternalImportMap(current.entries, pending))
    }

    private fun normalize(name: String): String =
        name.lowercase().trim().replace(Regex("\\s+"), " ")

    private fun read(): ExternalImportMap =
        runCatching {
            if (!file.exists()) return@runCatching ExternalImportMap()
            json.decodeFromString<ExternalImportMap>(file.readText())
        }.getOrElse { ExternalImportMap() }

    private fun write(map: ExternalImportMap) {
        runCatching { file.writeText(json.encodeToString(map)) }
    }
}

private suspend fun findMatchingImport(
    importRepository: app.gotcha.android.data.repo.ImportRepository,
    fileName: String,
    title: String,
): app.gotcha.android.data.model.UserImport? {
    val needle = fileName.lowercase().substringBeforeLast('.').take(32)
    if (needle.isBlank()) return null
    val items = importRepository.list(page = 1, pageSize = 100).items
    return items.firstOrNull { imp ->
        if (imp.ingestionStatus == "failed") return@firstOrNull false
        val impTitle = imp.title?.lowercase().orEmpty()
        impTitle.contains(needle) ||
            title.equals(imp.title, ignoreCase = true) ||
            titleFromFileName(fileName).equals(imp.title, ignoreCase = true)
    }
}

suspend fun findExistingImportContentId(
    importRepository: app.gotcha.android.data.repo.ImportRepository,
    fileName: String,
    title: String,
    onProgress: (app.gotcha.android.data.model.UserImport) -> Unit = {},
): String? {
    val match = findMatchingImport(importRepository, fileName, title) ?: return null
    val readyContentId = resolveImportContentId(match)
    if (readyContentId != null && (match.ingestionStatus == "ready" || match.content != null)) {
        return readyContentId
    }
    if (match.ingestionStatus == "processing" || readyContentId == null) {
        val ready = awaitImportReady(
            importRepository = importRepository,
            importId = match.id,
            onProgress = onProgress,
        )
        return ready?.let { resolveImportContentId(it) }
    }
    return readyContentId
}
