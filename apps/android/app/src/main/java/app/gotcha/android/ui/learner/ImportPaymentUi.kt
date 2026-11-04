package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue

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
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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

/** Maps cursor positions between digit-only storage and formatted display. */
private class DigitGroupingOffsetMapping(private val formatted: String) : OffsetMapping {
    override fun originalToTransformed(offset: Int): Int {
        if (offset <= 0) return 0
        var digitsSeen = 0
        for (i in formatted.indices) {
            if (formatted[i].isDigit()) {
                digitsSeen++
                if (digitsSeen == offset) return i + 1
            }
        }
        return formatted.length
    }

    override fun transformedToOriginal(offset: Int): Int =
        formatted.take(offset.coerceIn(0, formatted.length)).count { it.isDigit() }
}

private class CardNumberVisualTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val digits = text.text.filter(Char::isDigit).take(19)
        val formatted = digits.chunked(4).joinToString(" ")
        return TransformedText(AnnotatedString(formatted), DigitGroupingOffsetMapping(formatted))
    }
}

private class CardExpiryVisualTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val digits = text.text.filter(Char::isDigit).take(4)
        val formatted = if (digits.length >= 3) "${digits.take(2)}/${digits.drop(2)}" else digits
        return TransformedText(AnnotatedString(formatted), DigitGroupingOffsetMapping(formatted))
    }
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
    val pagesWindow = pageWindowLabel(limits.resetCycle)
    return when {
        quote.freeReason == "Within free import allowance" ->
            "Covered by your free import allowance."
        quote.requiresPayment && quote.amountUzs > 0 &&
            quote.estimatedPages > limits.monthlyPagesRemaining ->
            "This book is ~${quote.estimatedPages} pages but you have " +
                "${limits.monthlyPagesRemaining} free pages left $pagesWindow. " +
                "Pay once to import it to your library."
        quote.requiresPayment && quote.tier == null ->
            "This length is not priced yet. Try a shorter document or try again later."
        else -> formatFreeAllowanceText(limits)
    }
}

/** True when the user must confirm payment (non-zero charge). */
fun ImportQuoteResponse.needsPaymentWall(): Boolean =
    gatewayEnabled && requiresPayment && tier != null && amountUzs > 0

/** True when checkout can proceed without showing a purchase step. */
fun ImportQuoteResponse.isEffectivelyFree(): Boolean =
    !gatewayEnabled || !requiresPayment || isFree

/** Block import before checkout — mirrors web disabled purchase button cases. */
fun ImportQuoteResponse.importBlockingError(): String? {
    if (!gatewayEnabled || !requiresPayment) return null
    if (tier == null) {
        return freeReason?.takeIf { it.isNotBlank() }
            ?: "This import length is not priced yet. Try a shorter document or try again later."
    }
    if (amountUzs > 0) return null
    val limits = freeLimits
    if (limits != null && estimatedPages > limits.monthlyPagesRemaining) {
        val window = pageWindowLabel(limits.resetCycle)
        return "This document is ~$estimatedPages pages but you only have " +
            "${limits.monthlyPagesRemaining} free pages left $window. " +
            "Try a shorter file or wait for your allowance to reset."
    }
    return "Payment is required but no price is set for this document length. " +
        "Try again later or contact support."
}

fun importQuotePrimaryLabel(quote: ImportQuoteResponse, loading: Boolean): String = when {
    loading -> "Processing…"
    quote.isEffectivelyFree() -> "Open book"
    else -> "Continue · ${formatSom(quote.amountUzs)}"
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
    fileName: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                displayTitle,
                fontFamily = Inter,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                lineHeight = 22.sp,
                color = GotchaColors.Ink,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (!fileName.isNullOrBlank() && fileName != displayTitle) {
                Text(
                    fileName,
                    fontFamily = Inter,
                    fontSize = 12.sp,
                    color = GotchaColors.TextMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
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
                    color = GotchaBlue.B700,
                )
            }
        }

        importQuoteFooterText(quote)?.let { hint ->
            Text(
                hint,
                fontFamily = Inter,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = Color(0xFF6A7282),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (error != null) {
            Text(error, color = GotchaColors.Danger, fontFamily = Inter, fontSize = 13.sp)
        }

        val canPurchase = quote.needsPaymentWall()
        GotchaPrimaryButton(
            text = importQuotePrimaryLabel(quote, loading),
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
