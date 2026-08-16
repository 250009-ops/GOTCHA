package app.gotcha.android.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.api.apiErrorCode
import app.gotcha.android.data.api.apiErrorEmail
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.APP_LANGUAGE_OPTIONS
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.components.BrandWordmark
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import android.util.Log
import java.io.IOException
import kotlinx.coroutines.launch
import retrofit2.HttpException

@Composable
fun SignInScreen(
    onSignedIn: (isAdmin: Boolean) -> Unit,
    onGoSignUp: () -> Unit,
    onForgotPassword: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var unverifiedEmail by remember { mutableStateOf<String?>(null) }

    if (unverifiedEmail != null) {
        EmailVerificationPending(
            email = unverifiedEmail!!,
            onBackToSignIn = { unverifiedEmail = null },
        )
        return
    }

    AuthScaffold(
        title = "Welcome back",
        subtitle = "Sign in to continue learning",
        footer = {
            Row {
                Text(
                    "Don't have an account? ",
                    color = GotchaColors.TextPlaceholder,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                )
                Text(
                    "Sign up",
                    color = GotchaColors.BrandPurpleDeep,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.clickable(onClick = onGoSignUp),
                )
            }
        },
    ) {
        GotchaTextField(
            label = "Email Address",
            value = email,
            onValueChange = { email = it },
            placeholder = "sarah@example.com",
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = "Password",
            value = password,
            onValueChange = { password = it },
            placeholder = "Minimum 8 characters",
            isPassword = true,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Forgot password?",
            color = GotchaColors.BrandPurpleDeep,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier
                .align(Alignment.End)
                .padding(bottom = 4.dp)
                .clickable(onClick = onForgotPassword),
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = Color(0xFFDC2626), fontFamily = Manrope, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = "Sign In",
            loading = loading,
            containerColor = GotchaColors.BrandPurpleDeep,
            shapeRadius = 14,
            modifier = Modifier.testTag("sign_in_button"),
            onClick = {
                scope.launch {
                    loading = true
                    error = null
                    try {
                        val res = container.authRepository.login(email.trim(), password)
                        onSignedIn(res.isAdmin)
                    } catch (e: Exception) {
                        Log.w(
                            "GotchaAuth",
                            "login failed status=${(e as? HttpException)?.code()} code=${e.apiErrorCode()}",
                        )
                        if (e.apiErrorCode() == "EMAIL_NOT_VERIFIED") {
                            unverifiedEmail = e.apiErrorEmail() ?: email.trim()
                        } else {
                            error = e.toSignInMessage()
                        }
                    } finally {
                        loading = false
                    }
                }
            },
        )
    }
}

@Composable
fun SignUpScreen(
    onSignedUp: (isAdmin: Boolean) -> Unit,
    onGoSignIn: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Registration is a 2-step wizard, matching web-learner's AuthPage: credentials first, then
    // native + target language(s). Do not pre-select a target (historically RU) — the learner
    // must pick at least one, or Progress invents a leftover language they never chose.
    var step by remember { mutableStateOf("credentials") }
    var nativeLanguage by remember { mutableStateOf("en") }
    var targetLanguages by remember { mutableStateOf(emptySet<String>()) }
    var pendingVerificationEmail by remember { mutableStateOf<String?>(null) }
    var accountAlreadyExists by remember { mutableStateOf(false) }

    if (pendingVerificationEmail != null) {
        EmailVerificationPending(
            email = pendingVerificationEmail!!,
            onBackToSignIn = onGoSignIn,
        )
        return
    }

    if (step == "languages") {
        AuthScaffold(
            title = "What do you want to learn?",
            subtitle = "Pick your native language and at least one language to learn — you can add more later in Settings.",
            footer = {},
        ) {
            Text(
                "Your native language",
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.InkSecondary,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                APP_LANGUAGE_OPTIONS.forEach { opt ->
                    val selected = nativeLanguage == opt.code
                    LanguagePickChip(
                        flag = opt.flag,
                        label = opt.englishLabel,
                        selected = selected,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            nativeLanguage = opt.code
                            targetLanguages = targetLanguages - opt.code
                        },
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
            Text(
                "Languages you want to learn (pick at least one)",
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.InkSecondary,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                APP_LANGUAGE_OPTIONS.filter { it.code != nativeLanguage }.forEach { opt ->
                    val selected = targetLanguages.contains(opt.code)
                    LanguagePickChip(
                        flag = opt.flag,
                        label = opt.englishLabel,
                        selected = selected,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            targetLanguages = if (selected) targetLanguages - opt.code else targetLanguages + opt.code
                        },
                    )
                }
            }
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error!!, color = Color(0xFFDC2626), fontFamily = Manrope, fontSize = 13.sp)
                if (accountAlreadyExists) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Sign in instead",
                        color = GotchaColors.BrandPurpleDeep,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.clickable(onClick = onGoSignIn),
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                GotchaPrimaryButton(
                    text = "Back",
                    containerColor = Color(0xFFF2F4F7),
                    shapeRadius = 14,
                    modifier = Modifier.weight(1f),
                    onClick = {
                        error = null
                        accountAlreadyExists = false
                        step = "credentials"
                    },
                )
                GotchaPrimaryButton(
                    text = "Create Account",
                    loading = loading,
                    enabled = targetLanguages.isNotEmpty(),
                    containerColor = GotchaColors.BrandPurpleDeep,
                    shapeRadius = 14,
                    modifier = Modifier.weight(1f),
                    onClick = {
                        if (targetLanguages.isEmpty()) {
                            error = "Pick at least one language to learn"
                            return@GotchaPrimaryButton
                        }
                        scope.launch {
                            loading = true
                            error = null
                            accountAlreadyExists = false
                            try {
                                val res = container.authRepository.register(
                                    email = email.trim(),
                                    password = password,
                                    displayName = name.trim().ifBlank { null },
                                    nativeLanguage = nativeLanguage,
                                    targetLanguages = targetLanguages.toList(),
                                )
                                if (res.requiresEmailVerification) {
                                    pendingVerificationEmail = res.email ?: email.trim()
                                } else if (res.isAdmin || res.user != null) {
                                    onSignedUp(res.isAdmin)
                                } else {
                                    // Defensive fallback — treat as pending verification.
                                    pendingVerificationEmail = email.trim()
                                }
                            } catch (e: Exception) {
                                when (e.apiErrorCode()) {
                                    "EMAIL_EXISTS_UNVERIFIED" -> pendingVerificationEmail = e.apiErrorEmail() ?: email.trim()
                                    "EMAIL_ALREADY_REGISTERED" -> {
                                        accountAlreadyExists = true
                                        error = e.apiErrorMessage("Account already exists")
                                    }
                                    else -> error = e.apiErrorMessage("Registration failed")
                                }
                            } finally {
                                loading = false
                            }
                        }
                    },
                )
            }
        }
        return
    }

    AuthScaffold(
        title = "Create your account",
        subtitle = "Start your reading journey today",
        footer = {
            Row {
                Text("Already have an account? ", color = GotchaColors.TextPlaceholder, fontSize = 14.sp)
                Text(
                    "Sign in",
                    color = GotchaColors.BrandPurpleDeep,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.clickable(onClick = onGoSignIn),
                )
            }
        },
    ) {
        GotchaTextField(
            label = "Full Name",
            value = name,
            onValueChange = { name = it },
            placeholder = "e.g. Sarah Connor",
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = "Email Address",
            value = email,
            onValueChange = { email = it },
            placeholder = "sarah@example.com",
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = "Password",
            value = password,
            onValueChange = { password = it },
            placeholder = "Minimum 8 characters",
            isPassword = true,
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = Color(0xFFDC2626), fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = "Continue",
            containerColor = GotchaColors.BrandPurpleDeep,
            shapeRadius = 14,
            onClick = {
                if (name.isBlank() || email.isBlank() || password.isBlank()) {
                    error = "Please fill in all fields"
                    return@GotchaPrimaryButton
                }
                if (password.length < 8) {
                    error = "Password must be at least 8 characters"
                    return@GotchaPrimaryButton
                }
                error = null
                step = "languages"
            },
        )
    }
}

/** Figma 41:847 — request a password-reset email; the actual reset happens via the emailed link. */
@Composable
fun ForgotPasswordScreen(onBack: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableStateOf(false) }

    GotchaSystemBars(darkIcons = true)

    if (sent) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            EmailPendingIcon()
            Spacer(Modifier.height(20.dp))
            Text(
                "Check your inbox",
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = GotchaColors.BrandNavy,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "If an account exists for $email, we sent a link to reset your password.",
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(text = "Back to Sign In", onClick = onBack)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            "Back",
            color = GotchaColors.BrandPurpleDeep,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(onClick = onBack),
        )
        Spacer(Modifier.height(24.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            BrandMark(size = 56, cornerRadius = 16)
            Spacer(Modifier.height(16.dp))
            Text(
                "Forgot password?",
                color = GotchaColors.BrandNavy,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Enter your email and we'll send you a link to reset your password.",
                color = GotchaColors.TextPlaceholder,
                fontFamily = Manrope,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(28.dp))
        GotchaTextField(
            label = "Email Address",
            value = email,
            onValueChange = { email = it },
            placeholder = "sarah@example.com",
            keyboardType = KeyboardType.Email,
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = Color(0xFFDC2626), fontFamily = Manrope, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = "Send Reset Link",
            loading = loading,
            containerColor = GotchaColors.BrandPurpleDeep,
            shapeRadius = 14,
            onClick = {
                if (email.isBlank()) {
                    error = "Enter your email address"
                    return@GotchaPrimaryButton
                }
                scope.launch {
                    loading = true
                    error = null
                    try {
                        container.authRepository.forgotPassword(email.trim())
                        sent = true
                    } catch (e: Exception) {
                        error = e.apiErrorMessage("Could not send reset link")
                    } finally {
                        loading = false
                    }
                }
            },
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun VerifyEmailFromLinkScreen(
    token: String,
    onDone: () -> Unit,
) {
    val container = LocalAppContainer.current
    var phase by remember { mutableStateOf(if (token.isBlank()) "error" else "verifying") }
    var message by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        if (token.isBlank()) {
            phase = "error"
            message = "This verification link is missing or incomplete."
            return@LaunchedEffect
        }
        try {
            val res = container.authRepository.verifyEmail(token)
            email = res.email
            phase = "success"
        } catch (e: Exception) {
            phase = "error"
            message = e.apiErrorMessage("Invalid or expired verification link")
        }
    }

    GotchaSystemBars(darkIcons = true)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        EmailPendingIcon()
        Spacer(Modifier.height(20.dp))
        Text(
            when (phase) {
                "success" -> "Email verified"
                "error" -> "Link expired"
                else -> "Verifying…"
            },
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 22.sp,
            color = GotchaColors.BrandNavy,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            when (phase) {
                "success" -> "Your email${email?.let { " ($it)" } ?: ""} is confirmed. Sign in to continue."
                "error" -> message ?: "This verification link is invalid or has expired."
                else -> "Hang tight while we confirm your email address…"
            },
            fontFamily = Manrope,
            fontSize = 14.sp,
            color = GotchaColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        if (phase != "verifying") {
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(
                text = if (phase == "success") "Sign In" else "Back to Sign In",
                containerColor = GotchaColors.BrandPurpleDeep,
                shapeRadius = 14,
                onClick = onDone,
            )
        }
    }
}

@Composable
fun ResetPasswordFromLinkScreen(
    token: String,
    onDone: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var done by remember { mutableStateOf(false) }

    if (done) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            EmailPendingIcon()
            Spacer(Modifier.height(20.dp))
            Text(
                "Password updated",
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = GotchaColors.BrandNavy,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Sign in with your new password to continue.",
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(
                text = "Sign In",
                containerColor = GotchaColors.BrandPurpleDeep,
                shapeRadius = 14,
                onClick = onDone,
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            "Back",
            color = GotchaColors.BrandPurpleDeep,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(onClick = onDone),
        )
        Spacer(Modifier.height(24.dp))
        Text(
            "Choose a new password",
            color = GotchaColors.BrandNavy,
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 22.sp,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "Enter a new password for your GOTCHA account. Use at least 8 characters.",
            color = GotchaColors.TextPlaceholder,
            fontFamily = Manrope,
            fontSize = 14.sp,
        )
        Spacer(Modifier.height(28.dp))
        if (token.isBlank()) {
            Text(
                "This reset link is missing or incomplete. Request a new one from Forgot password.",
                color = Color(0xFFDC2626),
                fontFamily = Manrope,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(20.dp))
            GotchaPrimaryButton(text = "Back to Sign In", onClick = onDone)
            return
        }
        GotchaTextField(
            label = "New password",
            value = password,
            onValueChange = { password = it },
            placeholder = "At least 8 characters",
            isPassword = true,
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = "Confirm password",
            value = confirm,
            onValueChange = { confirm = it },
            placeholder = "Repeat your new password",
            isPassword = true,
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = Color(0xFFDC2626), fontFamily = Manrope, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = "Update password",
            loading = loading,
            containerColor = GotchaColors.BrandPurpleDeep,
            shapeRadius = 14,
            onClick = {
                when {
                    password.length < 8 -> error = "Password must be at least 8 characters"
                    password != confirm -> error = "Passwords do not match"
                    else -> scope.launch {
                        loading = true
                        error = null
                        try {
                            container.authRepository.resetPassword(token, password)
                            done = true
                        } catch (e: Exception) {
                            error = e.apiErrorMessage("Could not reset password")
                        } finally {
                            loading = false
                        }
                    }
                }
            },
        )
        Spacer(Modifier.height(24.dp))
    }
}

/** Shown after sign-up (and when signing in to an unverified account). Figma 45:8. */
@Composable
private fun EmailVerificationPending(
    email: String,
    onBackToSignIn: () -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    GotchaSystemBars(darkIcons = true)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        EmailPendingIcon()
        Spacer(Modifier.height(20.dp))
        Text(
            "Verify your email",
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 22.sp,
            color = GotchaColors.BrandNavy,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "We sent a verification link to $email. Open it, then come back and sign in.",
            fontFamily = Manrope,
            fontSize = 14.sp,
            color = GotchaColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        if (message != null) {
            Spacer(Modifier.height(12.dp))
            Text(message!!, color = GotchaColors.SuccessText, fontFamily = Manrope, fontSize = 13.sp, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(28.dp))
        GotchaPrimaryButton(text = "I've verified — Sign In", onClick = onBackToSignIn)
        Spacer(Modifier.height(12.dp))
        Text(
            if (loading) "Sending…" else "Resend verification email",
            color = GotchaColors.BrandPurpleDeep,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(enabled = !loading) {
                scope.launch {
                    loading = true
                    message = null
                    try {
                        container.authRepository.resendVerification(email)
                        message = "Verification email sent"
                    } catch (e: Exception) {
                        message = e.apiErrorMessage("Could not resend email")
                    } finally {
                        loading = false
                    }
                }
            },
        )
    }
}

@Composable
private fun EmailPendingIcon() {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(GotchaColors.BrandPurpleSoft),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Outlined.MailOutline,
            contentDescription = null,
            tint = GotchaColors.BrandPurple,
            modifier = Modifier.size(32.dp),
        )
    }
}

@Composable
private fun LanguagePickChip(
    flag: String,
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) GotchaColors.BrandPurpleSoft else Color(0xFFF9FAFB))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(flag, fontSize = 20.sp)
        Text(
            label,
            fontFamily = Manrope,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            fontSize = 12.sp,
            color = if (selected) GotchaColors.BrandPurpleDeep else GotchaColors.TextMuted,
        )
    }
}

@Composable
private fun AuthScaffold(
    title: String,
    subtitle: String,
    footer: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    GotchaSystemBars(darkIcons = true)
    // Figma 41:797: brand + form + CTA, then flexible gap, then signup footer.
    // Single scroll keeps the Sign In button measurable with IME open on S21+.
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BrandMark(size = 56, cornerRadius = 16)
            BrandWordmark(fontSize = 28)
        }
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                title,
                color = GotchaColors.BrandNavy,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 24.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                subtitle,
                color = GotchaColors.TextPlaceholder,
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.height(28.dp))
        content()
        Spacer(Modifier.height(48.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            footer()
        }
    }
}

private fun Exception.toSignInMessage(): String = when (this) {
    is IOException -> "Can't reach GOTCHA. Check your internet connection."
    else -> apiErrorMessage("Couldn't sign in")
}
