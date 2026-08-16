package app.gotcha.android.ui.learner

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import kotlinx.coroutines.launch

/** Mirrors web-learner's FileForm (apps/web-learner/src/pages/ImportPage.tsx): PDF/EPUB only, 100 MB max. */
private const val MAX_FILE_BYTES = 100L * 1024 * 1024
private val ACCEPTED_EXT = listOf(".pdf", ".epub")

@Composable
fun ImportFileScreen(onBack: () -> Unit, onImported: () -> Unit) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var fileUri by remember { mutableStateOf<Uri?>(null) }
    var fileName by remember { mutableStateOf<String?>(null) }
    var fileSizeBytes by remember { mutableStateOf(0L) }
    var title by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var paymentStep by remember { mutableStateOf<String?>(null) }
    var paymentId by remember { mutableStateOf<String?>(null) }
    var amountLabel by remember { mutableStateOf<String?>(null) }
    var cardNumber by remember { mutableStateOf("") }
    var cardExpiry by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var maskedPhone by remember { mutableStateOf<String?>(null) }

    fun resetPayment() {
        paymentStep = null
        paymentId = null
        amountLabel = null
        cardNumber = ""
        cardExpiry = ""
        otpCode = ""
        maskedPhone = null
    }

    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        error = null
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
        val lower = (name ?: uri.lastPathSegment ?: "").lowercase()
        if (ACCEPTED_EXT.none { lower.endsWith(it) }) {
            error = "Only PDF and EPUB files are supported"
            return@rememberLauncherForActivityResult
        }
        if (size > MAX_FILE_BYTES) {
            error = "File exceeds the 100 MB limit"
            return@rememberLauncherForActivityResult
        }
        fileUri = uri
        fileName = name
        fileSizeBytes = size
        if (title.isBlank()) {
            title = (name ?: "").substringBeforeLast('.').replace(Regex("[-_]+"), " ").trim()
        }
    }

    suspend fun finishImport(withPaymentId: String?) {
        val uri = fileUri ?: return
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Could not read the selected file")
        val mime = context.contentResolver.getType(uri)
            ?: if ((fileName ?: "").lowercase().endsWith(".epub")) "application/epub+zip" else "application/pdf"
        container.importRepository.file(
            bytes = bytes,
            fileName = fileName ?: "import",
            mimeType = mime,
            title = title.ifBlank { null },
            language = null,
            paymentId = withPaymentId,
        )
        onImported()
    }

    LearnerSubpage(
        title = "Upload File",
        onBack = onBack,
        body = {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (paymentStep == null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                            .clickable { pickFile.launch(arrayOf("application/pdf", "application/epub+zip")) }
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            if (fileUri != null) Icons.Outlined.Description else Icons.Outlined.UploadFile,
                            contentDescription = null,
                            tint = GotchaColors.BrandPurple,
                        )
                        Column {
                            Text(
                                fileName ?: "Choose a PDF or EPUB",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaColors.Ink,
                            )
                            Text(
                                if (fileUri != null) "${fileSizeBytes / 1024} KB · tap to change" else "Max 100 MB · PDF and EPUB",
                                fontFamily = Manrope,
                                fontSize = 12.sp,
                                color = GotchaColors.TextMuted,
                            )
                        }
                    }
                    GotchaTextField(label = "Title (optional)", value = title, onValueChange = { title = it }, placeholder = "Auto from filename")
                    if (error != null) Text(error!!, color = GotchaColors.Danger, fontFamily = Manrope, fontSize = 13.sp)
                    GotchaPrimaryButton(
                        text = "Upload File",
                        onClick = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val isEpub = (fileName ?: "").lowercase().endsWith(".epub")
                                    val importType = if (isEpub) "epub" else "pdf"
                                    // Matches web-learner's handleFileImport heuristic: no PDF/EPUB
                                    // parsing on-device, just a size-based page estimate for pricing.
                                    val pageCount = (fileSizeBytes / 50_000).toInt().coerceIn(1, 500)
                                    val quote = container.importRepository.quote(
                                        importType = importType,
                                        contentFormat = "ebook",
                                        pageCount = pageCount,
                                    )
                                    if (quote.gatewayEnabled && quote.requiresPayment) {
                                        val checkout = container.importRepository.checkout(
                                            importType = importType,
                                            contentFormat = "ebook",
                                            pageCount = pageCount,
                                        )
                                        paymentId = checkout.paymentId
                                        amountLabel = "Payment: ${formatSom(quote.amountUzs)}"
                                        paymentStep = "card"
                                        return@launch
                                    }
                                    var payId: String? = null
                                    if (quote.gatewayEnabled) {
                                        payId = container.importRepository.checkout(
                                            importType = importType,
                                            contentFormat = "ebook",
                                            pageCount = pageCount,
                                        ).paymentId
                                    }
                                    finishImport(payId)
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Upload failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        loading = loading,
                        enabled = fileUri != null,
                    )
                } else {
                    ImportPaymentStepUi(
                        step = paymentStep!!,
                        amountLabel = amountLabel,
                        cardNumber = cardNumber,
                        onCardNumberChange = { cardNumber = it },
                        cardExpiry = cardExpiry,
                        onCardExpiryChange = { cardExpiry = it },
                        otpCode = otpCode,
                        onOtpChange = { otpCode = it },
                        maskedPhone = maskedPhone,
                        loading = loading,
                        error = error,
                        onSubmitCard = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val result = container.importRepository.preApply(
                                        paymentId!!,
                                        cardNumber.replace(" ", ""),
                                        cardExpiry.replace("/", ""),
                                    )
                                    maskedPhone = result.maskedPhone
                                    otpCode = ""
                                    paymentStep = "otp"
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Card verification failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        onConfirmOtp = {
                            scope.launch {
                                loading = true
                                error = null
                                try {
                                    val result = container.importRepository.apply(paymentId!!, otpCode)
                                    when {
                                        result.step == "paid" || result.status == "paid" -> {
                                            val confirmedId = paymentId
                                            resetPayment()
                                            finishImport(confirmedId)
                                        }
                                        result.step == "otp" -> {
                                            otpCode = ""
                                            error = "Check the SMS code and try again."
                                        }
                                        else -> {
                                            error = "Payment failed. Please try again with a different card."
                                            paymentStep = "card"
                                            cardNumber = ""
                                            cardExpiry = ""
                                        }
                                    }
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("OTP verification failed")
                                } finally {
                                    loading = false
                                }
                            }
                        },
                        onResendOtp = {
                            scope.launch {
                                try {
                                    container.importRepository.retryOtp(paymentId!!)
                                    error = null
                                } catch (e: Exception) {
                                    error = e.apiErrorMessage("Could not resend OTP")
                                }
                            }
                        },
                        onCancel = {
                            scope.launch { runCatching { container.importRepository.cancel(paymentId!!) } }
                            resetPayment()
                            error = null
                        },
                    )
                }
            }
        },
    )
}
