package app.gotcha.android.ui.auth

import app.gotcha.android.data.api.networkUserMessage
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.layout.ime
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import kotlinx.coroutines.delay
import kotlinx.coroutines.CancellationException
import androidx.compose.material3.minimumInteractiveComponentSize
import android.content.Context
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import app.gotcha.android.ui.components.AuthFooterLink
import app.gotcha.android.ui.components.AuthTextLink
import app.gotcha.android.ui.components.FormErrorBanner
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.api.apiErrorCode
import app.gotcha.android.data.api.apiErrorEmail
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.ChatLangs
import app.gotcha.android.data.model.APP_LANGUAGE_OPTIONS
import app.gotcha.android.data.model.AppLanguageOption
import app.gotcha.android.data.model.toAppLanguageOption
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.components.BrandWordmark
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.components.GotchaTextField
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import java.io.IOException
import kotlinx.coroutines.launch
import retrofit2.HttpException

private val EMAIL_RE = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")

internal fun String.isValidEmail(): Boolean = EMAIL_RE.matches(trim())

/** Field-level email error (§B #25/#26), or null when valid. */
private fun emailError(ctx: Context, email: String): String? = when {
    email.isBlank() -> ctx.getString(R.string.auth_err_email_required)
    !email.isValidEmail() -> ctx.getString(R.string.auth_err_email_invalid)
    else -> null
}

@Composable
fun SignInScreen(
    onSignedIn: (isAdmin: Boolean) -> Unit,
    onGoSignUp: () -> Unit,
    onForgotPassword: () -> Unit = {},
) {
    val container = LocalAppContainer.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var emailErr by remember { mutableStateOf<String?>(null) }
    var unverifiedEmail by remember { mutableStateOf<String?>(null) }

    if (unverifiedEmail != null) {
        EmailVerificationPending(
            email = unverifiedEmail!!,
            onBackToSignIn = { unverifiedEmail = null },
        )
        return
    }

    val canSubmit = email.isValidEmail() && password.isNotEmpty() && !loading
    val submit: () -> Unit = submit@{
        emailErr = emailError(ctx, email)
        if (emailErr != null || password.isEmpty()) return@submit
        focusManager.clearFocus()
        scope.launch {
            loading = true
            error = null
            try {
                val res = container.authRepository.login(email.trim(), password)
                onSignedIn(res.isAdmin)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(
                    "GotchaAuth",
                    "login failed status=${(e as? HttpException)?.code()} code=${e.apiErrorCode()}",
                )
                if (e.apiErrorCode() == "EMAIL_NOT_VERIFIED") {
                    unverifiedEmail = e.apiErrorEmail() ?: email.trim()
                } else {
                    error = e.toSignInMessage(ctx)
                }
            } finally {
                loading = false
            }
        }
    }

    AuthScaffold(
        title = stringResource(R.string.auth_welcome_back),
        subtitle = stringResource(R.string.auth_sign_in_sub),
        footer = {
            AuthFooterLink(
                prompt = stringResource(R.string.auth_no_account),
                action = stringResource(R.string.auth_sign_up_link),
                onClick = onGoSignUp,
                enabled = !loading,
            )
        },
        bottomBar = {
            GotchaPrimaryButton(
                text = stringResource(R.string.auth_sign_in),
                loading = loading,
                enabled = canSubmit,
                shapeRadius = 14,
                modifier = Modifier.fillMaxWidth().testTag("sign_in_button"),
                onClick = submit,
            )
        },
    ) {
        FormErrorBanner(error, Modifier.padding(bottom = 16.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_email_label),
            value = email,
            onValueChange = { email = it; if (emailErr != null) emailErr = null },
            placeholder = stringResource(R.string.auth_email_placeholder),
            keyboardType = KeyboardType.Email,
            error = emailErr,
            enabled = !loading,
            imeAction = ImeAction.Next,
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
            autofill = ContentType.EmailAddress,
            onFocusLost = { if (email.isNotBlank()) emailErr = emailError(ctx, email) },
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_password_label),
            value = password,
            onValueChange = { password = it },
            placeholder = stringResource(R.string.auth_password_placeholder_signin),
            isPassword = true,
            enabled = !loading,
            imeAction = ImeAction.Done,
            keyboardActions = KeyboardActions(onDone = { if (canSubmit) submit() }),
            autofill = ContentType.Password,
        )
        Spacer(Modifier.height(4.dp))
        AuthTextLink(
            text = stringResource(R.string.auth_forgot_password),
            onClick = onForgotPassword,
            enabled = !loading,
            fontSize = 13.sp,
            modifier = Modifier.align(Alignment.End),
        )
    }
}

@Composable
fun SignUpScreen(
    onSignedUp: (isAdmin: Boolean) -> Unit,
    onGoSignIn: () -> Unit,
) {
    val container = LocalAppContainer.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var nameErr by remember { mutableStateOf<String?>(null) }
    var emailErr by remember { mutableStateOf<String?>(null) }
    var passwordErr by remember { mutableStateOf<String?>(null) }

    // Registration is a 2-step wizard, matching web-learner's AuthPage: credentials first, then
    // native + target language(s). Native starts empty — do not default to English. Target is
    // also unselected so Progress does not invent a leftover language they never chose.
    var step by remember { mutableStateOf("credentials") }
    var nativeLanguage by remember { mutableStateOf<String?>(null) }
    var targetLanguages by remember { mutableStateOf(emptySet<String>()) }
    var languageOptions by remember { mutableStateOf(APP_LANGUAGE_OPTIONS.take(3)) }

    LaunchedEffect(Unit) {
        runCatching { container.contentRepository.catalogLanguages() }
            .onSuccess { rows ->
                val mapped = rows.filter { it.isEnabled }.map { it.toAppLanguageOption() }
                if (mapped.isNotEmpty()) {
                    languageOptions = mapped
                    ChatLangs.setEnabled(mapped.map { it.code })
                    if (nativeLanguage != null && mapped.none { it.code == nativeLanguage }) {
                        nativeLanguage = null
                    }
                    targetLanguages = targetLanguages
                        .filter { code -> mapped.any { it.code == code } && code != nativeLanguage }
                        .toSet()
                }
            }
    }
    var pendingVerificationEmail by remember { mutableStateOf<String?>(null) }
    var accountAlreadyExists by remember { mutableStateOf(false) }

    if (pendingVerificationEmail != null) {
        EmailVerificationPending(
            email = pendingVerificationEmail!!,
            onBackToSignIn = onGoSignIn,
        )
        return
    }

    val continueToLanguages: () -> Unit = go@{
        nameErr = if (name.isBlank()) ctx.getString(R.string.auth_err_name_required) else null
        emailErr = emailError(ctx, email)
        passwordErr = when {
            password.isEmpty() -> ctx.getString(R.string.auth_err_password_required)
            password.length < 8 -> ctx.getString(R.string.auth_err_password_short)
            else -> null
        }
        if (nameErr != null || emailErr != null || passwordErr != null) return@go
        focusManager.clearFocus()
        error = null
        step = "languages"
    }

    // §B #37: shared-axis X between the two steps (300 ms, emphasized easing, 30 dp slide + fade).
    val emphasized = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val slidePx = with(LocalDensity.current) { 30.dp.roundToPx() }
    AnimatedContent(
        targetState = step,
        transitionSpec = {
            val dir = if (targetState == "languages") 1 else -1
            (slideInHorizontally(tween(300, easing = emphasized)) { dir * slidePx } + fadeIn(tween(300, easing = emphasized)))
                .togetherWith(slideOutHorizontally(tween(300, easing = emphasized)) { -dir * slidePx } + fadeOut(tween(150)))
        },
        label = "signup-step", // i18n-ok: animation label
    ) { current ->
    if (current == "languages") {
        AuthScaffold(
            title = stringResource(R.string.auth_learn_title),
            subtitle = stringResource(R.string.auth_learn_sub),
            caption = stringResource(R.string.auth_step_of, 2, 2),
            footer = null,
            bottomBar = {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    GotchaPrimaryButton(
                        text = stringResource(R.string.auth_back),
                        containerColor = GotchaColors.SurfaceMuted,
                        contentColor = GotchaColors.BrandNavy,
                        shapeRadius = 14,
                        maxLines = 2,
                        enabled = !loading,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            error = null
                            accountAlreadyExists = false
                            step = "credentials"
                        },
                    )
                    GotchaPrimaryButton(
                        // P3b-08: short localized CTA + 2-line wrap (ru/uz truncated at 360dp / 1.3x).
                        text = stringResource(R.string.auth_sign_up_cta),
                        maxLines = 2,
                        loading = loading,
                        enabled = nativeLanguage != null && targetLanguages.isNotEmpty(),
                        shapeRadius = 14,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            val native = nativeLanguage
                            if (native.isNullOrBlank()) {
                                error = ctx.getString(R.string.auth_err_pick_native)
                                return@GotchaPrimaryButton
                            }
                            if (targetLanguages.isEmpty()) {
                                error = ctx.getString(R.string.auth_err_pick_learning)
                                return@GotchaPrimaryButton
                            }
                            scope.launch {
                                loading = true
                                error = null
                                accountAlreadyExists = false
                                try {
                                    container.endSession()
                                    val res = container.authRepository.register(
                                        email = email.trim(),
                                        password = password,
                                        displayName = name.trim().ifBlank { null },
                                        nativeLanguage = native,
                                        targetLanguages = targetLanguages.toList(),
                                    )
                                    if (res.requiresEmailVerification || (res.accessToken.isNullOrBlank() && !res.email.isNullOrBlank())) {
                                        pendingVerificationEmail = res.email ?: email.trim()
                                    } else if (res.isAdmin || res.user != null) {
                                        onSignedUp(res.isAdmin)
                                    } else {
                                        pendingVerificationEmail = email.trim()
                                    }
                                } catch (e: Exception) {
                                    when (e.apiErrorCode()) {
                                        "EMAIL_EXISTS_UNVERIFIED" -> pendingVerificationEmail = e.apiErrorEmail() ?: email.trim()
                                        "EMAIL_ALREADY_REGISTERED" -> {
                                            accountAlreadyExists = true
                                            error = ctx.getString(R.string.auth_err_account_exists)
                                        }
                                        else -> error = if (e is IOException) {
                                            // P3b.1 GOT-QA-P3b-05: same wording as forgot-password; TLS shown as TLS.
                                            e.networkUserMessage() ?: ctx.getString(R.string.auth_err_network)
                                        } else {
                                            e.apiErrorMessage(ctx.getString(R.string.auth_err_registration_failed))
                                        }
                                    }
                                } finally {
                                    loading = false
                                }
                            }
                        },
                    )
                }
            },
        ) {
            FormErrorBanner(error, Modifier.padding(bottom = if (accountAlreadyExists) 4.dp else 16.dp))
            if (error != null && accountAlreadyExists) {
                AuthTextLink(
                    text = stringResource(R.string.auth_sign_in_instead),
                    onClick = onGoSignIn,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(8.dp))
            }
            Text(
                stringResource(R.string.auth_native_language),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.InkSecondary,
            )
            Spacer(Modifier.height(8.dp))
            AuthLanguageSearchField(
                options = languageOptions,
                selectedCodes = listOfNotNull(nativeLanguage),
                onAdd = { code ->
                    nativeLanguage = code
                    targetLanguages = targetLanguages - code
                },
                onRemove = { nativeLanguage = null },
                multiple = false,
                placeholder = stringResource(R.string.auth_search_native),
            )
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.auth_learn_label),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.InkSecondary,
            )
            Spacer(Modifier.height(8.dp))
            AuthLanguageSearchField(
                options = languageOptions,
                selectedCodes = targetLanguages.toList(),
                exclude = setOfNotNull(nativeLanguage),
                onAdd = { targetLanguages = targetLanguages + it },
                onRemove = { targetLanguages = targetLanguages - it },
                multiple = true,
                placeholder = stringResource(R.string.auth_search_learn),
            )
        }
    } else {
    AuthScaffold(
        title = stringResource(R.string.auth_create_account),
        subtitle = stringResource(R.string.auth_sign_up_sub),
        caption = stringResource(R.string.auth_step_of, 1, 2),
        footer = {
            AuthFooterLink(
                prompt = stringResource(R.string.auth_have_account),
                action = stringResource(R.string.auth_sign_in_link),
                onClick = onGoSignIn,
                enabled = !loading,
            )
        },
        bottomBar = {
            GotchaPrimaryButton(
                text = stringResource(R.string.auth_continue),
                enabled = name.isNotBlank() && email.isNotBlank() && password.isNotEmpty(),
                shapeRadius = 14,
                modifier = Modifier.fillMaxWidth().testTag("sign_up_continue_button"),
                onClick = continueToLanguages,
            )
        },
    ) {
        GotchaTextField(
            label = stringResource(R.string.auth_name_label),
            value = name,
            onValueChange = { name = it; if (nameErr != null) nameErr = null },
            placeholder = stringResource(R.string.auth_name_placeholder),
            error = nameErr,
            imeAction = ImeAction.Next,
            capitalization = KeyboardCapitalization.Words,
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
            autofill = ContentType.PersonFullName,
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_email_label),
            value = email,
            onValueChange = { email = it; if (emailErr != null) emailErr = null },
            placeholder = stringResource(R.string.auth_email_placeholder),
            keyboardType = KeyboardType.Email,
            error = emailErr,
            imeAction = ImeAction.Next,
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
            autofill = ContentType.EmailAddress,
            onFocusLost = { if (email.isNotBlank()) emailErr = emailError(ctx, email) },
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_password_label),
            value = password,
            onValueChange = { password = it; if (passwordErr != null) passwordErr = null },
            placeholder = stringResource(R.string.auth_password_placeholder_new),
            isPassword = true,
            error = passwordErr,
            imeAction = ImeAction.Next,
            keyboardActions = KeyboardActions(onNext = { continueToLanguages() }),
            autofill = ContentType.NewPassword,
        )
    }
    }
    }
}


/** Figma 41:847 — request a password-reset email; the actual reset happens via the emailed link. */
@Composable
fun ForgotPasswordScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableStateOf(false) }

    GotchaSystemBars()

    if (sent) {
        val context = LocalContext.current
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(GotchaColors.SurfaceCard)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            EmailPendingIcon()
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.auth_check_inbox),
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = GotchaColors.BrandNavy,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.auth_reset_sent, email),
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(
                text = stringResource(R.string.auth_open_email),
                containerColor = GotchaColors.BrandPurple,
                shapeRadius = 14,
                onClick = { openEmailApp(context) },
            )
            Spacer(Modifier.height(12.dp))
            GotchaPrimaryButton(
                text = stringResource(R.string.auth_back_to_sign_in),
                containerColor = GotchaColors.SurfaceMuted,
                contentColor = GotchaColors.BrandNavy,
                shapeRadius = 14,
                onClick = onBack,
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.SurfaceCard)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(R.string.auth_back),
            color = GotchaColors.BrandPurple,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(onClick = onBack),
        )
        Spacer(Modifier.height(24.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            BrandMark(size = 56)
            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.auth_forgot_password),
                color = GotchaColors.BrandNavy,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.auth_forgot_sub),
                color = GotchaColors.TextPlaceholder,
                fontFamily = Manrope,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(28.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_email_label),
            value = email,
            onValueChange = { email = it },
            placeholder = "name@example.com", // i18n-ok: example address
            keyboardType = KeyboardType.Email,
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = GotchaColors.Danger, fontFamily = Manrope, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = stringResource(R.string.auth_send_reset_link),
            loading = loading,
            containerColor = GotchaColors.BrandPurple,
            shapeRadius = 14,
            onClick = {
                if (email.isBlank()) {
                    error = ctx.getString(R.string.auth_err_email_required)
                    return@GotchaPrimaryButton
                }
                scope.launch {
                    loading = true
                    error = null
                    try {
                        container.authRepository.forgotPassword(email.trim())
                        sent = true
                    } catch (e: Exception) {
                        error = e.apiErrorMessage(ctx.getString(R.string.auth_reset_failed_send))
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
    val ctx = LocalContext.current
    val container = LocalAppContainer.current
    var phase by remember { mutableStateOf(if (token.isBlank()) "error" else "verifying") }
    var message by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        if (token.isBlank()) {
            phase = "error"
            message = ctx.getString(R.string.auth_link_missing)
            return@LaunchedEffect
        }
        try {
            container.endSession()
            val res = container.authRepository.verifyEmail(token)
            email = res.email
            phase = "success"
        } catch (e: Exception) {
            phase = "error"
            message = e.apiErrorMessage(ctx.getString(R.string.auth_link_invalid))
        }
    }

    GotchaSystemBars()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.SurfaceCard)
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
                "success" -> stringResource(R.string.auth_email_verified)
                "error" -> stringResource(R.string.auth_link_expired)
                else -> stringResource(R.string.auth_verifying)
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
                "success" -> email?.let { stringResource(R.string.auth_email_confirmed, it) } ?: stringResource(R.string.auth_email_confirmed_plain)
                "error" -> message ?: stringResource(R.string.auth_link_invalid)
                else -> stringResource(R.string.auth_verifying_sub)
            },
            fontFamily = Manrope,
            fontSize = 14.sp,
            color = GotchaColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        if (phase != "verifying") {
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(
                text = if (phase == "success") stringResource(R.string.auth_sign_in) else stringResource(R.string.auth_back_to_sign_in),
                containerColor = GotchaColors.BrandPurple,
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
    val ctx = LocalContext.current
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
                .background(GotchaColors.SurfaceCard)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            EmailPendingIcon()
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.auth_password_updated),
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = GotchaColors.BrandNavy,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.auth_password_updated_sub),
                fontFamily = Manrope,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))
            GotchaPrimaryButton(
                text = stringResource(R.string.auth_sign_in),
                containerColor = GotchaColors.BrandPurple,
                shapeRadius = 14,
                onClick = onDone,
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.SurfaceCard)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(R.string.auth_back),
            color = GotchaColors.BrandPurple,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(onClick = onDone),
        )
        Spacer(Modifier.height(24.dp))
        Text(
            stringResource(R.string.auth_new_password_title),
            color = GotchaColors.BrandNavy,
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 22.sp,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            stringResource(R.string.auth_new_password_sub),
            color = GotchaColors.TextPlaceholder,
            fontFamily = Manrope,
            fontSize = 14.sp,
        )
        Spacer(Modifier.height(28.dp))
        if (token.isBlank()) {
            Text(
                stringResource(R.string.auth_reset_link_missing),
                color = GotchaColors.Danger,
                fontFamily = Manrope,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(20.dp))
            GotchaPrimaryButton(text = stringResource(R.string.auth_back_to_sign_in), onClick = onDone)
            return
        }
        GotchaTextField(
            label = stringResource(R.string.auth_new_password),
            value = password,
            onValueChange = { password = it },
            placeholder = stringResource(R.string.auth_password_placeholder_new),
            isPassword = true,
        )
        Spacer(Modifier.height(16.dp))
        GotchaTextField(
            label = stringResource(R.string.auth_confirm_password),
            value = confirm,
            onValueChange = { confirm = it },
            placeholder = stringResource(R.string.auth_repeat_password),
            isPassword = true,
        )
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = GotchaColors.Danger, fontFamily = Manrope, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        GotchaPrimaryButton(
            text = stringResource(R.string.auth_update_password),
            loading = loading,
            containerColor = GotchaColors.BrandPurple,
            shapeRadius = 14,
            onClick = {
                when {
                    password.length < 8 -> error = ctx.getString(R.string.auth_err_password_short)
                    password != confirm -> error = ctx.getString(R.string.auth_err_password_mismatch)
                    else -> scope.launch {
                        loading = true
                        error = null
                        try {
                            container.authRepository.resetPassword(token, password)
                            done = true
                        } catch (e: Exception) {
                            error = e.apiErrorMessage(ctx.getString(R.string.auth_reset_failed))
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
    val ctx = LocalContext.current
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    GotchaSystemBars()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.SurfaceCard)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(16.dp))
        EmailPendingIcon()
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.auth_verify_title),
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 22.sp,
            color = GotchaColors.BrandNavy,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.auth_verify_sent, email),
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
        GotchaPrimaryButton(
            text = stringResource(R.string.auth_open_email),
            containerColor = GotchaColors.BrandPurple,
            shapeRadius = 14,
            onClick = { openEmailApp(context) },
        )
        Spacer(Modifier.height(12.dp))
        GotchaPrimaryButton(
            text = stringResource(R.string.auth_verified_sign_in),
            containerColor = GotchaColors.SurfaceMuted,
            contentColor = GotchaColors.BrandNavy,
            shapeRadius = 14,
            onClick = onBackToSignIn,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            if (loading) stringResource(R.string.auth_sending) else stringResource(R.string.auth_resend_verification),
            color = GotchaColors.BrandPurple,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            modifier = Modifier.clickable(enabled = !loading) {
                scope.launch {
                    loading = true
                    message = null
                    try {
                        container.authRepository.resendVerification(email)
                        message = ctx.getString(R.string.auth_verification_sent)
                    } catch (e: Exception) {
                        message = e.apiErrorMessage(ctx.getString(R.string.auth_resend_failed))
                    } finally {
                        loading = false
                    }
                }
            },
        )
        Spacer(Modifier.height(24.dp))
    }
}

private fun openEmailApp(context: android.content.Context) {
    val emailIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_EMAIL)
    try {
        context.startActivity(emailIntent)
    } catch (_: ActivityNotFoundException) {
        val fallback = Intent(Intent.ACTION_VIEW, Uri.parse("mailto:"))
        context.startActivity(Intent.createChooser(fallback, context.getString(R.string.auth_open_email_chooser)))
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

private fun AppLanguageOption.matchesQuery(query: String): Boolean {
    val q = query.trim().lowercase()
    if (q.isEmpty()) return true
    return code.contains(q, ignoreCase = true) ||
        englishLabel.contains(q, ignoreCase = true) ||
        nativeLabel.contains(q, ignoreCase = true)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AuthLanguageSearchField(
    options: List<AppLanguageOption>,
    selectedCodes: List<String>,
    onAdd: (String) -> Unit,
    onRemove: (String) -> Unit,
    multiple: Boolean,
    placeholder: String,
    exclude: Set<String> = emptySet(),
) {
    var query by remember { mutableStateOf("") }
    var open by remember { mutableStateOf(false) }
    val selected = selectedCodes.mapNotNull { code -> options.firstOrNull { it.code == code } }
    val suggestions = remember(query, options, selectedCodes, exclude) {
        options.filter { it.code !in selectedCodes && it.code !in exclude && it.matchesQuery(query) }.take(8)
    }

    // P3b-08: the field's own bring-into-view fires on focus, *before* the IME finishes animating in
    // and shrinks the scroll viewport above the pinned bottomBar, so the field ended up under the bar.
    // Re-request bring-into-view (field + suggestions) whenever it is focused and the IME height changes.
    val bringIntoView = remember { BringIntoViewRequester() }
    var focused by remember { mutableStateOf(false) }
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    LaunchedEffect(focused, imeBottom, open, suggestions.size) {
        if (focused) {
            withFrameNanos { }
            bringIntoView.bringIntoView()
        }
    }
    Column(
        modifier = Modifier.bringIntoViewRequester(bringIntoView),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(GotchaColors.Surface)
                .border(1.dp, GotchaColors.BorderInput, RoundedCornerShape(14.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (selected.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    selected.forEach { opt ->
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(GotchaColors.BrandPurpleSoft)
                                .padding(start = 8.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(opt.flag, fontSize = 14.sp)
                            Text(
                                opt.englishLabel,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                color = GotchaColors.BrandPurple,
                            )
                            Icon(
                                Icons.Outlined.Close,
                                contentDescription = stringResource(R.string.auth_remove_language, opt.englishLabel),
                                tint = GotchaColors.BrandPurple,
                                // Touch target: 48 dp hit area around the 16 dp glyph (was 16 dp).
                                modifier = Modifier
                                    .minimumInteractiveComponentSize()
                                    .clickable(role = androidx.compose.ui.semantics.Role.Button) { onRemove(opt.code) }
                                    .padding(2.dp)
                                    .size(16.dp),
                            )
                        }
                    }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_search),
                    contentDescription = null,
                    tint = GotchaColors.TextSubtle,
                    modifier = Modifier.size(16.dp),
                )
                BasicTextField(
                    value = query,
                    onValueChange = {
                        query = it
                        open = true
                    },
                    singleLine = true,
                    textStyle = TextStyle(
                        fontFamily = Manrope,
                        fontSize = 15.sp,
                        color = GotchaColors.InkSecondary,
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .height(24.dp)
                        .onFocusChanged {
                        focused = it.isFocused
                        open = it.isFocused || query.isNotBlank()
                    },
                    decorationBox = { inner ->
                        Box {
                            if (query.isEmpty()) {
                                Text(
                                    if (selected.isEmpty()) placeholder else if (multiple) stringResource(R.string.auth_add_another) else placeholder,
                                    fontFamily = Manrope,
                                    fontSize = 15.sp,
                                    color = GotchaColors.TextPlaceholder,
                                )
                            }
                            inner()
                        }
                    },
                )
            }
        }
        if (open && suggestions.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(GotchaColors.SurfaceCard)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp)),
            ) {
                suggestions.forEach { opt ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onAdd(opt.code)
                                query = ""
                                open = multiple
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(opt.flag, fontSize = 18.sp)
                        Column {
                            Text(
                                opt.englishLabel,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = GotchaColors.InkSecondary,
                            )
                            if (opt.nativeLabel != opt.englishLabel) {
                                Text(
                                    opt.nativeLabel,
                                    fontFamily = Manrope,
                                    fontSize = 12.sp,
                                    color = GotchaColors.TextMuted,
                                )
                            }
                        }
                    }
                }
            }
        } else if (open && query.isNotBlank() && suggestions.isEmpty()) {
            Text(
                stringResource(R.string.auth_no_matching_language),
                fontFamily = Manrope,
                fontSize = 13.sp,
                color = GotchaColors.TextMuted,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}

@Composable
private fun AuthScaffold(
    title: String,
    subtitle: String,
    footer: (@Composable () -> Unit)?,
    caption: String? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    GotchaSystemBars()
    // P3b.1 GOT-QA-P3b-02/07: the primary CTA lives in [bottomBar], a fixed bar laid out *below* the
    // scrolling form inside the imePadding/navigationBarsPadding container, so it always sits directly
    // above the IME (or nav bar) no matter how error text, font scale, locale or focus changes the form
    // height. The form scrolls on its own; focused fields are kept visible by the text field's own
    // bring-into-view. Replaces the one-shot 250 ms bringIntoView from p3b.1 rev 1.
    // API 24 gives the first text field initial focus and pops the IME on its own (sign-up "Full name").
    // Drop that initial focus; a tap still focuses normally.
    val focusManager = LocalFocusManager.current
    LaunchedEffect(Unit) {
        withFrameNanos { }
        focusManager.clearFocus()
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f),
    ) {
        val minHeight = maxHeight
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .heightIn(min = minHeight)
                .padding(horizontal = 24.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                BrandMark(size = 56)
                // §B #36: the mark already announces GOTCHA.
                BrandWordmark(fontSize = 28, contentDescription = null)
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
                    modifier = Modifier.fillMaxWidth().semantics { heading() },
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
            if (caption != null) {
                // §B #24: "Step 1 of 2" caption above the fields.
                Text(
                    caption,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = GotchaColors.TextPlaceholder,
                )
                Spacer(Modifier.height(12.dp))
            }
            content()
            Spacer(Modifier.weight(1f).heightIn(min = if (footer != null) 48.dp else 16.dp))
            if (footer != null) {
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
    }
    if (bottomBar != null) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 24.dp, vertical = 12.dp)
                .testTag("auth_bottom_bar"),
        ) {
            bottomBar()
        }
    }
    }
}

private fun Exception.toSignInMessage(ctx: Context): String = when (this) {
    // P3b.1 GOT-QA-P3b-05: one offline wording app-wide (err_offline, as forgot-password), and a TLS
    // failure is reported as a secure-connection error (err_ssl) instead of "check your internet".
    is IOException -> networkUserMessage() ?: ctx.getString(R.string.auth_err_network)
    else -> apiErrorMessage(ctx.getString(R.string.auth_err_sign_in_failed))
}
