package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import app.gotcha.android.data.import.titleFromFileName
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.PendingExternalImport
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.import.ExternalImportState
import app.gotcha.android.debug.ExternalImportDebug
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Inter
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@Composable
fun ExternalImportScreen(
    onCancel: () -> Unit,
    onOpenReader: (String) -> Unit,
) {
    GotchaSystemBars()
    val container = LocalAppContainer.current
    val controller = container.externalImportController
    val state by controller.state.collectAsState()
    val scope = rememberCoroutineScope()

    var paymentStep by remember { mutableStateOf<String?>(null) }
    var paymentId by remember { mutableStateOf<String?>(null) }
    var amountLabel by remember { mutableStateOf<String?>(null) }
    var cardNumber by remember { mutableStateOf("") }
    var cardExpiry by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var maskedPhone by remember { mutableStateOf<String?>(null) }
    var paymentLoading by remember { mutableStateOf(false) }
    var paymentError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        ExternalImportDebug.log("SCREEN", "ExternalImportScreen composed")
        PendingExternalImport.collectLatest { request ->
            ExternalImportDebug.log("SCREEN", "pending collect request=${request?.fileName}")
            if (request == null) return@collectLatest
            PendingExternalImport.value = null
            paymentStep = null
            paymentError = null
            if (request.cachePath.isBlank()) {
                ExternalImportDebug.log("SCREEN", "skip begin: empty cachePath (failed read)")
                return@collectLatest
            }
            controller.reset()
            ExternalImportDebug.log("SCREEN", "controller.begin ${request.fileName}")
            controller.begin(request)
        }
    }

    LaunchedEffect(state) {
        if (state is ExternalImportState.Failed) paymentStep = null
    }

    LaunchedEffect(state) {
        if (state is ExternalImportState.AwaitingPayment) paymentStep = "price"
    }

    LaunchedEffect(state) {
        val ready = state as? ExternalImportState.Ready ?: return@LaunchedEffect
        onOpenReader(ready.contentId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface),
        contentAlignment = Alignment.Center,
    ) {
        when (val current = state) {
            is ExternalImportState.Idle,
            is ExternalImportState.Working,
            -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    modifier = Modifier.padding(32.dp),
                ) {
                    Icon(
                        Icons.AutoMirrored.Outlined.MenuBook,
                        contentDescription = null,
                        tint = GotchaColors.BrandPurple,
                    )
                    CircularProgressIndicator(color = GotchaColors.BrandPurple)
                    Text(
                        if (current is ExternalImportState.Working) current.message else "Opening your book…",
                        fontFamily = Inter,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = GotchaColors.Ink,
                        textAlign = TextAlign.Center,
                    )
                    if (current is ExternalImportState.Working) {
                        Text(
                            current.fileName,
                            fontFamily = Inter,
                            fontSize = 13.sp,
                            color = GotchaColors.TextMuted,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            is ExternalImportState.AwaitingPayment -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_open_in_gotcha),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (paymentStep == "price") {
                        ImportQuoteStepUi(
                            quote = current.quote,
                            displayTitle = titleFromFileName(current.fileName),
                            fileName = current.fileName,
                            typeLabel = current.importType.uppercase(),
                            loading = paymentLoading,
                            error = paymentError,
                            onProceed = {
                                scope.launch {
                                    paymentLoading = true
                                    paymentError = null
                                    try {
                                        val checkout = container.importRepository.checkout(
                                            importType = current.importType,
                                            contentFormat = "ebook",
                                            pageCount = current.pageCount,
                                        )
                                        if (checkout.isFree || checkout.step == "done") {
                                            paymentStep = null
                                            controller.continueAfterFreeCheckout(checkout.paymentId)
                                        } else {
                                            paymentId = checkout.paymentId
                                            amountLabel = formatSom(current.quote.amountUzs)
                                            paymentStep = "card"
                                        }
                                    } catch (e: Exception) {
                                        paymentError = e.apiErrorMessage("Failed to start payment")
                                    } finally {
                                        paymentLoading = false
                                    }
                                }
                            },
                            onCancel = {
                                controller.reset()
                                onCancel()
                            },
                        )
                    } else {
                        Unit // Card checkout removed: in-app purchases go through Google Play (ImportRepository.checkout)
                    }
                }
            }

            is ExternalImportState.Failed -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text(
                        current.message,
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.Danger,
                        textAlign = TextAlign.Center,
                    )
                    GotchaPrimaryButton(text = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_try_again), onClick = { controller.retry() })
                    TextButton(onClick = {
                        controller.reset()
                        onCancel()
                    }) {
                        Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_go_back), fontFamily = Inter, color = GotchaColors.TextMuted)
                    }
                }
            }

            is ExternalImportState.Ready -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = GotchaColors.BrandPurple)
                    Spacer(Modifier.height(12.dp))
                    Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_opening_reader), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Ink)
                }
            }
        }
    }
}
