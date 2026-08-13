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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

@Composable
fun ImportScreen(
    onClose: () -> Unit,
    onBrowseCatalog: () -> Unit,
    onOpenUrl: () -> Unit = {},
    onOpenPaste: () -> Unit = {},
) {
    GotchaSystemBars(darkIcons = true)
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf<String?>(null) }
    var recent by remember { mutableStateOf<List<UserImport>>(emptyList()) }
    var title by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var paymentStep by remember { mutableStateOf<String?>(null) }
    var currentPaymentId by remember { mutableStateOf<String?>(null) }
    var cardNumber by remember { mutableStateOf("") }
    var cardExpiry by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var maskedPhone by remember { mutableStateOf<String?>(null) }
    var pendingImportData by remember { mutableStateOf<Triple<String, String?, String?>?>(null) }

    LaunchedEffect(Unit) {
        recent = runCatching { container.importRepository.list().items }.getOrDefault(emptyList())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        Box(
            modifier = Modifier
                .padding(top = 8.dp)
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

        if (mode == null) {
            Column(modifier = Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ImportOption(
                    Icons.Outlined.Explore,
                    "Browse Catalog",
                    "Return to Library to browse published books, articles & news",
                    onBrowseCatalog,
                )
                ImportOption(Icons.Outlined.Link, "Import from URL", "Paste a link to any article or web page", onOpenUrl)
                ImportOption(Icons.Outlined.ContentPaste, "Paste Text", "Paste any text and start reading with translations", onOpenPaste)
            }
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
        } else {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    if (mode == "url") "Import from URL" else "Paste Text",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                Spacer(Modifier.height(16.dp))
                GotchaTextField("Title", title, { title = it }, placeholder = "Optional title")
                Spacer(Modifier.height(12.dp))
                if (mode == "url") {
                    GotchaTextField("URL", url, { url = it }, placeholder = "https://…")
                } else {
                    GotchaTextField("Text", text, { text = it }, placeholder = "Paste your content here")
                }
                if (message != null) {
                    Spacer(Modifier.height(12.dp))
                    Text(message!!, color = GotchaColors.SuccessText, fontSize = 13.sp)
                }
                Spacer(Modifier.height(20.dp))
                when (paymentStep) {
                    "card" -> {
                        GotchaTextField(
                            "Card Number",
                            cardNumber,
                            { cardNumber = it.filter { c -> c.isDigit() }.take(16) },
                            placeholder = "8600 1234 5678 9012",
                        )
                        Spacer(Modifier.height(12.dp))
                        GotchaTextField(
                            "Expiry (YY/MM)",
                            cardExpiry,
                            { cardExpiry = it.filter { c -> c.isDigit() || c == '/' }.take(5) },
                            placeholder = "28/12",
                        )
                        Spacer(Modifier.height(16.dp))
                        GotchaPrimaryButton(
                            text = "Continue",
                            loading = loading,
                            onClick = {
                                scope.launch {
                                    loading = true
                                    message = null
                                    try {
                                        val result = container.importRepository.preApply(
                                            currentPaymentId!!,
                                            cardNumber.replace(" ", ""),
                                            cardExpiry.replace("/", ""),
                                        )
                                        maskedPhone = result.maskedPhone
                                        paymentStep = "otp"
                                        message = "OTP sent to ${result.maskedPhone ?: "your phone"}"
                                    } catch (e: Exception) {
                                        message = e.message ?: "Card verification failed"
                                    } finally {
                                        loading = false
                                    }
                                }
                            },
                        )
                    }
                    "otp" -> {
                        Text(
                            "Enter SMS code sent to ${maskedPhone ?: "your phone"}",
                            fontSize = 14.sp,
                            color = GotchaColors.TextMuted,
                        )
                        Spacer(Modifier.height(12.dp))
                        GotchaTextField(
                            "OTP Code",
                            otpCode,
                            { otpCode = it.filter { c -> c.isDigit() }.take(6) },
                            placeholder = "123456",
                        )
                        Spacer(Modifier.height(16.dp))
                        GotchaPrimaryButton(
                            text = "Confirm Payment",
                            loading = loading,
                            onClick = {
                                scope.launch {
                                    loading = true
                                    message = null
                                    try {
                                        val result = container.importRepository.apply(currentPaymentId!!, otpCode)
                                        if (result.step == "paid" || result.status == "paid") {
                                            val (importType, importUrl, importText) = pendingImportData!!
                                            if (importType == "url") {
                                                container.importRepository.url(
                                                    importUrl!!,
                                                    title.ifBlank { null },
                                                    null,
                                                    currentPaymentId,
                                                )
                                            } else {
                                                container.importRepository.paste(
                                                    title = title.ifBlank { "Pasted text" },
                                                    text = importText!!,
                                                    language = null,
                                                    paymentId = currentPaymentId,
                                                )
                                            }
                                            paymentStep = null
                                            currentPaymentId = null
                                            pendingImportData = null
                                            cardNumber = ""
                                            cardExpiry = ""
                                            otpCode = ""
                                            message = "Import started"
                                            recent = container.importRepository.list().items
                                            mode = null
                                        } else {
                                            message = "Payment failed. Please try again."
                                            paymentStep = "card"
                                            cardNumber = ""
                                            cardExpiry = ""
                                            otpCode = ""
                                        }
                                    } catch (e: Exception) {
                                        message = e.message ?: "OTP verification failed"
                                    } finally {
                                        loading = false
                                    }
                                }
                            },
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Resend Code",
                            color = GotchaColors.BrandPurple,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable {
                                scope.launch {
                                    try {
                                        container.importRepository.retryOtp(currentPaymentId!!)
                                        message = "OTP resent"
                                    } catch (e: Exception) {
                                        message = e.message ?: "Could not resend OTP"
                                    }
                                }
                            },
                        )
                    }
                    else -> {
                        GotchaPrimaryButton(
                            text = "Import",
                            loading = loading,
                            onClick = {
                                scope.launch {
                                    loading = true
                                    message = null
                                    try {
                                        val isUrl = mode == "url"
                                        val importType = if (isUrl) "url" else "paste"
                                        val words = text.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.size
                                        val quote = container.importRepository.quote(
                                            importType = importType,
                                            contentFormat = "article",
                                            textLength = if (isUrl) 6000 else text.length,
                                            wordCount = if (isUrl) null else words,
                                        )

                                        if (quote.gatewayEnabled && quote.requiresPayment) {
                                            val checkout = container.importRepository.checkout(
                                                importType = importType,
                                                contentFormat = "article",
                                                textLength = if (isUrl) 6000 else text.length,
                                                wordCount = if (isUrl) null else words,
                                            )
                                            if (checkout.step == "card" || checkout.isFree == false) {
                                                currentPaymentId = checkout.paymentId
                                                pendingImportData = Triple(importType, if (isUrl) url.trim() else null, if (!isUrl) text else null)
                                                val amount = quote.amountUzs.toLong()
                                                val fmt = NumberFormat.getNumberInstance(Locale("uz", "UZ")).format(amount)
                                                message = "Payment: $fmt soʻm"
                                                paymentStep = "card"
                                                return@launch
                                            }
                                        }

                                        var paymentId: String? = null
                                        if (quote.gatewayEnabled) {
                                            val checkout = container.importRepository.checkout(
                                                importType = importType,
                                                contentFormat = "article",
                                                textLength = if (isUrl) 6000 else text.length,
                                                wordCount = if (isUrl) null else words,
                                            )
                                            paymentId = checkout.paymentId
                                        }

                                        if (isUrl) {
                                            container.importRepository.url(
                                                url.trim(),
                                                title.ifBlank { null },
                                                null,
                                                paymentId,
                                            )
                                        } else {
                                            container.importRepository.paste(
                                                title = title.ifBlank { "Pasted text" },
                                                text = text,
                                                language = null,
                                                paymentId = paymentId,
                                            )
                                        }
                                        message = "Import started"
                                        recent = container.importRepository.list().items
                                        mode = null
                                    } catch (e: Exception) {
                                        message = e.message ?: "Import failed"
                                    } finally {
                                        loading = false
                                    }
                                }
                            },
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    "Back",
                    color = GotchaColors.BrandPurple,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable {
                        paymentStep = null
                        currentPaymentId = null
                        pendingImportData = null
                        cardNumber = ""
                        cardExpiry = ""
                        otpCode = ""
                        mode = null
                    },
                )
            }
        }
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
