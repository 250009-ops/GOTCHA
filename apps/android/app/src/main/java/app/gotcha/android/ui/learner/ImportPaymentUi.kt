package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.data.model.ImportQuoteFreeLimits
import app.gotcha.android.data.model.ImportQuoteResponse
import app.gotcha.android.data.repo.ImportRepository
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToLong

/** UZS soʻm — mirrors web-learner `formatUzs` (Math.round + uz-UZ grouping). */
fun formatSom(amountUzs: Double): String =
    NumberFormat.getNumberInstance(Locale("uz", "UZ")).format(amountUzs.roundToLong()) + " so\u02bbm"

/** Mirrors web PaymentConfirmModal card spacing: groups of 4 digits. */
fun formatCardNumberInput(raw: String): String =
    raw.filter(Char::isDigit).take(19).chunked(4).joinToString(" ")

/** Mirrors web PaymentConfirmModal expiry: auto-inserts `/` after MM. */
fun formatCardExpiryInput(raw: String): String {
    val digits = raw.filter(Char::isDigit).take(4)
    return if (digits.length >= 3) "${digits.take(2)}/${digits.drop(2)}" else digits
}

fun pageWindowLabel(resetCycle: String?): String = when (resetCycle?.lowercase()) {
    "daily" -> "today"
    "yearly" -> "this year"
    else -> "this month"
}

fun formatFreeAllowanceText(allowance: ImportQuoteFreeLimits): String {
    val pagesWindow = pageWindowLabel(allowance.resetCycle)
    return if (!allowance.gatewayEnabled) {
        "Imports are currently free (payments paused). Configured pool: ${allowance.dailyFreeImportsPerUser} imports/day · ${allowance.monthlyFreePageLimit} pages $pagesWindow."
    } else {
        "${allowance.dailyFreeRemaining} of ${allowance.dailyFreeImportsPerUser} free imports left today · ${allowance.monthlyPagesRemaining} of ${allowance.monthlyFreePageLimit} free pages left $pagesWindow."
    }
}

fun importQuoteFooterText(quote: ImportQuoteResponse): String? {
    val limits = quote.freeLimits ?: return null
    return when {
        quote.freeReason == "Within free import allowance" -> "Covered by your free import allowance."
        quote.requiresPayment && quote.tier == null ->
            "This length is not priced yet. Try a shorter document or try again later."
        else -> formatFreeAllowanceText(limits)
    }
}

suspend fun ImportRepository.importLimitMessage(): String? {
    val res = list(1, 1)
    if (res.importsUnlimited == true) return null
    val remaining = res.importRemaining ?: return null
    if (remaining > 0) return null
    val limit = res.importLimit
    return if (limit != null) {
        "Import limit reached ($limit). Delete an import or pay for a new import."
    } else {
        "Import limit reached. Delete an import or pay for a new import."
    }
}

@Composable
fun ImportQuoteStepUi(
    quote: ImportQuoteResponse,
    displayTitle: String,
    typeLabel: String,
    loading: Boolean,
    error: String?,
    onProceed: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                displayTitle,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = GotchaColors.Ink,
            )
            Text(
                typeLabel,
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = GotchaColors.Ink,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color(0xFFF3F4F6))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "~${"%,d".format(Locale.US, quote.estimatedPages)} ${if (quote.estimatedPages == 1) "page" else "pages"}",
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = GotchaColors.Ink,
            )
            quote.tier?.label?.let { tierLabel ->
                Text("  ·  ", color = Color(0xFFD1D5DB), fontSize = 13.sp)
                Text(tierLabel, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.Ink)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, Color(0xFFE4E7EC), RoundedCornerShape(12.dp))
                .background(Color.White)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            quote.tier?.let { tier ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        "Page tier (${tier.label.orEmpty()})",
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = Color(0xFF6A7282),
                    )
                    Text(
                        formatSom(tier.priceUzs ?: 0.0),
                        fontFamily = Inter,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        color = GotchaColors.Ink,
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Estimated pages", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF6A7282))
                Text("~${quote.estimatedPages}", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = GotchaColors.Ink)
            }
            HorizontalDivider(color = Color(0xFFE4E7EC))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Total", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
                Text(
                    formatSom(quote.amountUzs),
                    fontFamily = Inter,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color(0xFF7008E7),
                )
            }
        }

        importQuoteFooterText(quote)?.let { hint ->
            Text(hint, fontFamily = Inter, fontSize = 11.sp, lineHeight = 16.sp, color = Color(0xFF6A7282))
        }

        if (error != null) {
            Text(error, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
        }

        val canPurchase = !(quote.requiresPayment && (quote.tier == null || quote.amountUzs <= 0))
        GotchaPrimaryButton(
            text = if (loading) "Processing…" else "Purchase for ${formatSom(quote.amountUzs)}",
            loading = loading,
            enabled = canPurchase,
            onClick = onProceed,
        )
        Text(
            "Cancel",
            color = GotchaColors.TextMuted,
            fontFamily = Inter,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .clickable(enabled = !loading, onClick = onCancel),
        )
    }
}

@Composable
fun ImportPaymentStepUi(
    step: String,
    amountLabel: String?,
    cardNumber: String,
    onCardNumberChange: (String) -> Unit,
    cardExpiry: String,
    onCardExpiryChange: (String) -> Unit,
    otpCode: String,
    onOtpChange: (String) -> Unit,
    maskedPhone: String?,
    loading: Boolean,
    error: String?,
    onSubmitCard: () -> Unit,
    onConfirmOtp: () -> Unit,
    onResendOtp: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            if (step == "otp") "Enter SMS Code" else "Enter Card Details",
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = GotchaColors.Ink,
        )
        if (amountLabel != null && step == "card") {
            Text(amountLabel, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.BrandPurple)
        }
        Text(
            if (step == "otp") {
                "Code sent to ${maskedPhone ?: "your phone"}"
            } else {
                "UzCard, Humo, Visa, or Mastercard. Card details go directly to the Atmos payment gateway."
            },
            fontFamily = Inter,
            fontSize = 12.sp,
            color = GotchaColors.TextMuted,
        )
    }
    Spacer(Modifier.height(16.dp))

    when (step) {
        "card" -> {
            GotchaTextField(
                label = "Card Number",
                value = cardNumber,
                onValueChange = { onCardNumberChange(formatCardNumberInput(it)) },
                placeholder = "0000 0000 0000 0000",
                keyboardType = KeyboardType.Number,
            )
            Spacer(Modifier.height(12.dp))
            GotchaTextField(
                label = "Expiry (MM/YY)",
                value = cardExpiry,
                onValueChange = { onCardExpiryChange(formatCardExpiryInput(it)) },
                placeholder = "00/00",
                keyboardType = KeyboardType.Number,
            )
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
            }
            Spacer(Modifier.height(16.dp))
            GotchaPrimaryButton(text = "Continue", loading = loading, onClick = onSubmitCard)
        }
        "otp" -> {
            GotchaTextField(
                label = "OTP Code",
                value = otpCode,
                onValueChange = { onOtpChange(it.filter(Char::isDigit).take(6)) },
                placeholder = "123456",
            )
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
            }
            Spacer(Modifier.height(16.dp))
            GotchaPrimaryButton(text = "Confirm Payment", loading = loading, onClick = onConfirmOtp)
            Spacer(Modifier.height(8.dp))
            Text(
                "Resend Code",
                color = GotchaColors.BrandPurple,
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                modifier = Modifier.clickable(onClick = onResendOtp),
            )
        }
    }
    Spacer(Modifier.height(12.dp))
    Text(
        if (step == "otp") "Back" else "Cancel",
        color = GotchaColors.TextMuted,
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        modifier = Modifier.clickable(onClick = onCancel),
    )
}
