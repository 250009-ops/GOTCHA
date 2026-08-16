package app.gotcha.android.ui.learner

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import java.text.NumberFormat
import java.util.Locale

/**
 * Atmos card + OTP payment step, shared by every import entry point (URL, paste, file) so the
 * quote → checkout → card → OTP → apply sequence (services/api ImportCommerceService, mirrored by
 * web-learner's PaymentConfirmModal) can't silently diverge or be skipped by a new screen again.
 */
fun formatSom(amountUzs: Double): String =
    NumberFormat.getNumberInstance(Locale("uz", "UZ")).format(amountUzs.toLong()) + " so\u02bbm"

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
            "Payment required",
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = GotchaColors.Ink,
        )
        if (amountLabel != null) {
            Text(amountLabel, fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.BrandPurple)
        }
        Text(
            "UzCard, Humo, Visa, or Mastercard. Card details go directly to the Atmos payment gateway.",
            fontFamily = Manrope,
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
                onValueChange = { onCardNumberChange(it.filter(Char::isDigit).take(16)) },
                placeholder = "5614 6819 0687 2829",
            )
            Spacer(Modifier.height(12.dp))
            GotchaTextField(
                label = "Expiry (MM/YY)",
                value = cardExpiry,
                onValueChange = { onCardExpiryChange(it.filter { c -> c.isDigit() || c == '/' }.take(5)) },
                placeholder = "03/30",
            )
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, color = GotchaColors.Danger, fontFamily = Manrope, fontSize = 13.sp)
            }
            Spacer(Modifier.height(16.dp))
            GotchaPrimaryButton(text = "Continue", loading = loading, onClick = onSubmitCard)
        }
        "otp" -> {
            Text(
                "Enter SMS code sent to ${maskedPhone ?: "your phone"}",
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
            )
            Spacer(Modifier.height(12.dp))
            GotchaTextField(
                label = "OTP Code",
                value = otpCode,
                onValueChange = { onOtpChange(it.filter(Char::isDigit).take(6)) },
                placeholder = "123456",
            )
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, color = GotchaColors.Danger, fontFamily = Manrope, fontSize = 13.sp)
            }
            Spacer(Modifier.height(16.dp))
            GotchaPrimaryButton(text = "Confirm Payment", loading = loading, onClick = onConfirmOtp)
            Spacer(Modifier.height(8.dp))
            Text(
                "Resend Code",
                color = GotchaColors.BrandPurple,
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                modifier = Modifier.clickable(onClick = onResendOtp),
            )
        }
    }
    Spacer(Modifier.height(12.dp))
    Text(
        "Cancel",
        color = GotchaColors.TextMuted,
        fontFamily = Manrope,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        modifier = Modifier.clickable(onClick = onCancel),
    )
}
