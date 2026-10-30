package app.gotcha.android.data.import

import app.gotcha.android.ExternalImportRequest
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.ImportQuoteResponse
import app.gotcha.android.data.repo.ImportRepository
import app.gotcha.android.debug.ExternalImportDebug
import app.gotcha.android.ui.learner.importBlockingError
import app.gotcha.android.ui.learner.importLimitMessage
import app.gotcha.android.ui.learner.needsPaymentWall
import app.gotcha.android.util.PdfPageCount
import java.io.File
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed class ExternalImportState {
    data object Idle : ExternalImportState()
    data class Working(val message: String, val fileName: String) : ExternalImportState()
    data class AwaitingPayment(
        val quote: ImportQuoteResponse,
        val importType: String,
        val pageCount: Int,
        val title: String,
        val fileName: String,
    ) : ExternalImportState()
    data class Ready(val contentId: String) : ExternalImportState()
    data class Failed(val message: String) : ExternalImportState()
}

/**
 * Application-scoped import pipeline for PDF/EPUB shares from Telegram and other apps.
 * Survives Compose navigation/recomposition — avoids "coroutine scope left the composition".
 */
class ExternalImportController(
    private val importRepository: ImportRepository,
    private val contentRepository: app.gotcha.android.data.repo.ContentRepository,
    private val importRegistry: ExternalImportRegistry,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _state = MutableStateFlow<ExternalImportState>(ExternalImportState.Idle)
    val state: StateFlow<ExternalImportState> = _state.asStateFlow()

    private var activeJob: Job? = null
    private var activeRequest: ExternalImportRequest? = null
    private var pendingImportType: String? = null
    private var pendingPageCount: Int = 1

    fun reset() {
        activeJob?.cancel()
        activeJob = null
        activeRequest = null
        pendingImportType = null
        pendingPageCount = 1
        _state.value = ExternalImportState.Idle
    }

    fun fail(message: String) {
        activeJob?.cancel()
        activeRequest = null
        _state.value = ExternalImportState.Failed(message)
    }

    fun begin(request: ExternalImportRequest) {
        if (request.cachePath.isBlank()) return
        if (activeRequest?.cachePath == request.cachePath && activeJob?.isActive == true) return
        activeJob?.cancel()
        activeRequest = request
        activeJob = scope.launch {
            runPipeline(request, paymentId = null)
        }
    }

    fun retry() {
        val request = activeRequest ?: return
        if (_state.value !is ExternalImportState.Failed) return
        activeJob?.cancel()
        activeJob = scope.launch {
            runPipeline(request, paymentId = null)
        }
    }

    fun continueAfterFreeCheckout(paymentId: String?) {
        val request = activeRequest ?: return
        activeJob?.cancel()
        activeJob = scope.launch {
            if (!paymentId.isNullOrBlank()) {
                val sizeBytes = withContext(Dispatchers.IO) { File(request.cachePath).length() }
                importRegistry.rememberPendingPayment(request.fileName, sizeBytes, paymentId)
            }
            uploadAndOpen(request, paymentId)
        }
    }

    private suspend fun resolveExistingContentId(request: ExternalImportRequest, sizeBytes: Long): String? {
        importRegistry.lookup(request.fileName, sizeBytes)?.let { return it }
        return findExistingImportContentId(
            importRepository = importRepository,
            fileName = request.fileName,
            title = request.title,
            onProgress = { item ->
                _state.value = ExternalImportState.Working(
                    importProgressMessage(item),
                    request.fileName,
                )
            },
        )?.also { id ->
            importRegistry.remember(request.fileName, sizeBytes, id)
        }
    }

    /** Re-use a paid checkout when upload failed after OTP (paymentId lives in local registry). */
    private suspend fun recoverPendingPaidPayment(
        request: ExternalImportRequest,
        sizeBytes: Long,
    ): Boolean {
        val pendingId = importRegistry.lookupPendingPayment(request.fileName, sizeBytes) ?: return false
        return try {
            val status = importRepository.paymentStatus(pendingId)
            if (status.status.equals("paid", ignoreCase = true)) {
                ExternalImportDebug.log("IMPORT", "resume paid paymentId=$pendingId")
                uploadAndOpen(request, pendingId)
                true
            } else {
                importRegistry.clearPendingPayment(request.fileName, sizeBytes)
                false
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            ExternalImportDebug.log("IMPORT", "pending payment verify failed: ${e.message}")
            _state.value = ExternalImportState.Failed(
                e.apiErrorMessage("Could not verify your previous payment. Check your connection and try again."),
            )
            true
        }
    }

    private suspend fun runPipeline(request: ExternalImportRequest, paymentId: String?) {
        try {
            _state.value = ExternalImportState.Working("Opening your book…", request.fileName)
            val sizeBytes = withContext(Dispatchers.IO) { File(request.cachePath).length() }

            resolveExistingContentId(request, sizeBytes)?.let { contentId ->
                ExternalImportDebug.log("IMPORT", "reuse existing contentId=$contentId")
                runCatching { contentRepository.prefetchReader(contentId) }
                deleteCachedImport(request.cachePath)
                activeRequest = null
                _state.value = ExternalImportState.Ready(contentId)
                return
            }

            if (paymentId == null && recoverPendingPaidPayment(request, sizeBytes)) {
                return
            }

            importRepository.importLimitMessage()?.let { throw IllegalStateException(it) }

            val bytes = withContext(Dispatchers.IO) {
                File(request.cachePath).readBytes()
            }
            val isEpub = request.fileName.lowercase().endsWith(".epub")
            val importType = if (isEpub) "epub" else "pdf"
            pendingImportType = importType

            _state.value = ExternalImportState.Working("Analyzing document…", request.fileName)
            val pageCount = if (!isEpub) {
                PdfPageCount.count(bytes)
                    ?: importRepository.inspect(
                        bytes = bytes,
                        fileName = request.fileName,
                        mimeType = request.mimeType,
                    ).pageCount
            } else {
                importRepository.inspect(
                    bytes = bytes,
                    fileName = request.fileName,
                    mimeType = request.mimeType,
                ).pageCount
            }
            pendingPageCount = pageCount

            if (paymentId == null) {
                val quote = importRepository.quote(
                    importType = importType,
                    contentFormat = "ebook",
                    pageCount = pageCount,
                )
                ExternalImportDebug.log(
                    "IMPORT",
                    "quote pay=${quote.requiresPayment} amt=${quote.amountUzs} " +
                        "tier=${quote.tier?.label} pages=${quote.estimatedPages} reason=${quote.freeReason}",
                )
                quote.importBlockingError()?.let { message ->
                    _state.value = ExternalImportState.Failed(message)
                    return
                }
                if (quote.needsPaymentWall()) {
                    _state.value = ExternalImportState.AwaitingPayment(
                        quote = quote,
                        importType = importType,
                        pageCount = pageCount,
                        title = request.title,
                        fileName = request.fileName,
                    )
                    return
                }
                val payId = if (quote.gatewayEnabled) {
                    importRepository.checkout(
                        importType = importType,
                        contentFormat = "ebook",
                        pageCount = pageCount,
                    ).paymentId
                } else {
                    null
                }
                if (!payId.isNullOrBlank()) {
                    importRegistry.rememberPendingPayment(request.fileName, sizeBytes, payId)
                }
                uploadAndOpen(request, payId)
            } else {
                uploadAndOpen(request, paymentId)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.value = ExternalImportState.Failed(e.apiErrorMessage("Could not open this file"))
        }
    }

    private suspend fun uploadAndOpen(request: ExternalImportRequest, paymentId: String?) {
        try {
            _state.value = ExternalImportState.Working("Uploading…", request.fileName)
            val bytes = withContext(Dispatchers.IO) {
                File(request.cachePath).readBytes()
            }
            val result = importRepository.file(
                bytes = bytes,
                fileName = request.fileName,
                mimeType = request.mimeType,
                title = request.title.ifBlank { null },
                language = null,
                paymentId = paymentId,
            )

            _state.value = ExternalImportState.Working("Preparing your reading material…", request.fileName)
            val ready = if (resolveImportContentId(result) != null) {
                result
            } else {
                awaitImportReady(
                    importRepository = importRepository,
                    importId = result.id,
                    onProgress = { item ->
                        _state.value = ExternalImportState.Working(
                            importProgressMessage(item),
                            request.fileName,
                        )
                    },
                )
            }

            val contentId = ready?.let { resolveImportContentId(it) }
            if (!contentId.isNullOrBlank()) {
                val sizeBytes = bytes.size.toLong()
                importRegistry.remember(request.fileName, sizeBytes, contentId)
                deleteCachedImport(request.cachePath)
                activeRequest = null
                _state.value = ExternalImportState.Ready(contentId)
            } else {
                _state.value = ExternalImportState.Failed(
                    "Import is still processing. Try again — your payment is saved.",
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.value = ExternalImportState.Failed(e.apiErrorMessage("Could not open this file"))
        }
    }

    fun clearPendingPaymentForActiveRequest() {
        val request = activeRequest ?: return
        scope.launch(Dispatchers.IO) {
            val sizeBytes = File(request.cachePath).length()
            importRegistry.clearPendingPayment(request.fileName, sizeBytes)
        }
    }

    fun pendingImportMeta(): Pair<String, Int>? {
        val type = pendingImportType ?: return null
        return type to pendingPageCount
    }
}
