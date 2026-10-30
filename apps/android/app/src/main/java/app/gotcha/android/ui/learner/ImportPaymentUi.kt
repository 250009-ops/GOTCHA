package app.gotcha.android.ui.learner

import app.gotcha.android.R
import app.gotcha.android.util.uiString
import app.gotcha.android.util.uiPlural
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
    "daily" -> uiString(R.string.window_today)
    "yearly" -> uiString(R.string.window_year)
    else -> uiString(R.string.window_month)
}

fun formatFreeAllowanceText(allowance: ImportQuoteFreeLimits): String {
    val pagesWindow = pageWindowLabel(allowance.resetCycle)
    return if (!allowance.gatewayEnabled) {
        "Imports are currently free (payments paused). Configured pool: ${allowance.dailyFreeImportsPerUser} imports/day · ${allowance.monthlyFreePageLimit} pages $pagesWindow."
    } else {
        uiString(R.string.settings_free_imports_left, allowance.dailyFreeRemaining, allowance.dailyFreeImportsPerUser) + " · " +
            uiString(R.string.settings_free_pages_left, allowance.monthlyPagesRemaining, allowance.monthlyFreePageLimit, pagesWindow) + "."
    }
}

fun importQuoteFooterText(quote: ImportQuoteResponse): String? {
    val limits = quote.freeLimits ?: return null
    val pagesWindow = pageWindowLabel(limits.resetCycle)
    return when {
        quote.freeReason == "Within free import allowance" ->
            uiString(R.string.import_covered_free)
        quote.requiresPayment && quote.amountUzs > 0 &&
            quote.estimatedPages > limits.monthlyPagesRemaining ->
            uiPlural(R.plurals.import_pages_left, limits.monthlyPagesRemaining, quote.estimatedPages, limits.monthlyPagesRemaining, pagesWindow)
        quote.requiresPayment && quote.tier == null ->
            uiString(R.string.import_not_priced)
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
            ?: uiString(R.string.import_not_priced)
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
    loading -> uiString(R.string.import_processing)
    quote.isEffectivelyFree() -> uiString(R.string.import_open_book)
    else -> uiString(R.string.import_continue_price, formatSom(quote.amountUzs))
}

suspend fun ImportRepository.importLimitMessage(): String? {
    val res = list(1, 1)
    if (res.importsUnlimited == true) return null
    val remaining = res.importRemaining ?: return null
    if (remaining > 0) return null
    val limit = res.importLimit
    return if (limit != null) {
        uiString(R.string.import_limit_n, limit)
    } else {
        uiString(R.string.import_limit)
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
                    .background(GotchaColors.SurfaceMuted)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                uiPlural(R.plurals.import_n_pages, quote.estimatedPages, "%,d".format(Locale.US, quote.estimatedPages)),
                fontFamily = Inter,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = GotchaColors.Ink,
            )
            quote.tier?.label?.let { tierLabel ->
                Text("  ·  ", color = GotchaColors.Border, fontSize = 13.sp)
                Text(tierLabel, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = GotchaColors.Ink)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                .background(GotchaColors.SurfaceCard)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            quote.tier?.let { tier ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        uiString(R.string.import_page_tier, tier.label.orEmpty()),
                        fontFamily = Inter,
                        fontSize = 14.sp,
                        color = GotchaColors.TextMuted,
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
                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_estimated_pages), fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.TextMuted)
                Text("~${quote.estimatedPages}", fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = GotchaColors.Ink)
            }
            HorizontalDivider(color = GotchaColors.Border)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_total), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = GotchaColors.Ink)
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
                color = GotchaColors.TextMuted,
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
            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_cancel),
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
