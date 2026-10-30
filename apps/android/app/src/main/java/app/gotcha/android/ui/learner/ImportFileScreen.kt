package app.gotcha.android.ui.learner



import androidx.activity.compose.rememberLauncherForActivityResult

import androidx.activity.result.contract.ActivityResultContracts

import androidx.compose.foundation.border

import androidx.compose.foundation.clickable

import androidx.compose.foundation.layout.Arrangement

import androidx.compose.foundation.layout.Column

import androidx.compose.foundation.layout.Row

import androidx.compose.foundation.layout.fillMaxSize

import androidx.compose.foundation.layout.fillMaxWidth

import androidx.compose.foundation.layout.padding

import androidx.compose.foundation.rememberScrollState

import androidx.compose.foundation.verticalScroll

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

import app.gotcha.android.data.import.resolveImportUri

import app.gotcha.android.data.import.titleFromFileName

import app.gotcha.android.ui.components.GotchaPrimaryButton

import app.gotcha.android.ui.components.GotchaTextField

import app.gotcha.android.ui.theme.GotchaColors

import app.gotcha.android.ui.theme.Inter

import app.gotcha.android.util.PdfPageCount

import kotlinx.coroutines.launch



/** In-app manual upload from Library → Import. Telegram/share uses [ExternalImportScreen]. */

@Composable

fun ImportFileForm(onImported: () -> Unit, embedded: Boolean = false) {

    val container = LocalAppContainer.current

    val context = LocalContext.current

    val scope = rememberCoroutineScope()



    var fileUri by remember { mutableStateOf<android.net.Uri?>(null) }

    var fileName by remember { mutableStateOf<String?>(null) }

    var fileSizeBytes by remember { mutableStateOf(0L) }

    var title by remember { mutableStateOf("") }

    var loading by remember { mutableStateOf(false) }

    var error by remember { mutableStateOf<String?>(null) }

    var paymentStep by remember { mutableStateOf<String?>(null) }

    var pendingQuote by remember { mutableStateOf<app.gotcha.android.data.model.ImportQuoteResponse?>(null) }

    var pendingImportType by remember { mutableStateOf<String?>(null) }

    var paymentId by remember { mutableStateOf<String?>(null) }

    var amountLabel by remember { mutableStateOf<String?>(null) }

    var cardNumber by remember { mutableStateOf("") }

    var cardExpiry by remember { mutableStateOf("") }

    var otpCode by remember { mutableStateOf("") }

    var maskedPhone by remember { mutableStateOf<String?>(null) }



    fun resetPayment() {

        paymentStep = null

        pendingQuote = null

        pendingImportType = null

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

        val (resolved, resolveError) = resolveImportUri(context, uri)

        if (resolved == null) {

            error = resolveError

            return@rememberLauncherForActivityResult

        }

        fileUri = resolved.uri

        fileName = resolved.name

        fileSizeBytes = resolved.sizeBytes

        if (title.isBlank()) title = titleFromFileName(resolved.name)

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



    suspend fun performUpload() {

        loading = true

        error = null

        try {

            container.importRepository.importLimitMessage()?.let {

                error = it

                return

            }

            val isEpub = (fileName ?: "").lowercase().endsWith(".epub")

            val importType = if (isEpub) "epub" else "pdf"

            val uri = fileUri ?: return

            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }

                ?: throw IllegalStateException("Could not read the selected file")

            val mime = context.contentResolver.getType(uri)

                ?: if (isEpub) "application/epub+zip" else "application/pdf"

            val pageCount = if (!isEpub) {

                PdfPageCount.count(bytes)

                    ?: container.importRepository.inspect(

                        bytes = bytes,

                        fileName = fileName ?: "import.pdf",

                        mimeType = mime,

                    ).pageCount

            } else {

                container.importRepository.inspect(

                    bytes = bytes,

                    fileName = fileName ?: "import.epub",

                    mimeType = mime,

                ).pageCount

            }

            val quote = container.importRepository.quote(

                importType = importType,

                contentFormat = "ebook",

                pageCount = pageCount,

            )

            quote.importBlockingError()?.let {
                error = it
                return
            }

            if (quote.needsPaymentWall()) {

                pendingQuote = quote

                pendingImportType = importType

                amountLabel = formatSom(quote.amountUzs)

                paymentStep = "price"

                return

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



    val formContent: @Composable () -> Unit = {

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

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

                            fontFamily = Inter,

                            fontWeight = FontWeight.SemiBold,

                            fontSize = 14.sp,

                            color = GotchaColors.Ink,

                        )

                        Text(

                            if (fileUri != null) "${fileSizeBytes / 1024} KB · tap to change" else "Max 100 MB · PDF and EPUB",

                            fontFamily = Inter,

                            fontSize = 12.sp,

                            color = GotchaColors.TextMuted,

                        )

                    }

                }

                GotchaTextField(label = "Title (optional)", value = title, onValueChange = { title = it }, placeholder = "Auto from filename")

                if (error != null) Text(error!!, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)

                GotchaPrimaryButton(

                    text = if (loading) "Importing…" else "Upload File",

                    onClick = { scope.launch { performUpload() } },

                    loading = loading,

                    enabled = fileUri != null,

                )

            } else if (paymentStep == "price" && pendingQuote != null) {

                ImportQuoteStepUi(

                    quote = pendingQuote!!,

                    displayTitle = title.ifBlank { fileName ?: "Your Import" },

                    typeLabel = (pendingImportType ?: "pdf").uppercase(),

                    loading = loading,

                    error = error,

                    onProceed = {

                        scope.launch {

                            loading = true

                            error = null

                            try {

                                val quote = pendingQuote!!

                                val importType = pendingImportType ?: "pdf"

                                val checkout = container.importRepository.checkout(

                                    importType = importType,

                                    contentFormat = "ebook",

                                    pageCount = quote.estimatedPages,

                                )

                                if (checkout.isFree || checkout.step == "done") {

                                    resetPayment()

                                    finishImport(checkout.paymentId)

                                } else {

                                    paymentId = checkout.paymentId

                                    paymentStep = "card"

                                }

                            } catch (e: Exception) {

                                error = e.apiErrorMessage("Failed to start payment")

                            } finally {

                                loading = false

                            }

                        }

                    },

                    onCancel = {

                        resetPayment()

                        error = null

                    },

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

                        if (paymentStep == "otp") {

                            paymentStep = "card"

                            otpCode = ""

                            error = null

                        } else {

                            scope.launch { paymentId?.let { runCatching { container.importRepository.cancel(it) } } }

                            resetPayment()

                            error = null

                        }

                    },

                )

            }

        }

    }



    if (embedded) {

        formContent()

    } else {

        WebDirectoryFormPanel { formContent() }

    }

}



@Composable

fun ImportFileScreen(onBack: () -> Unit, onImported: () -> Unit) {

    LearnerSubpage(

        title = "Upload File",

        onBack = onBack,

        body = {

            Column(

                Modifier

                    .fillMaxSize()

                    .verticalScroll(rememberScrollState()),

            ) {

                ImportFileForm(onImported = onImported)

            }

        },

    )

}

