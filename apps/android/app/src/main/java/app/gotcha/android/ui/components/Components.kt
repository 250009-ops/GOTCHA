package app.gotcha.android.ui.components

import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.material.icons.outlined.ErrorOutline
import app.gotcha.android.ui.theme.Inter
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.haze
import dev.chrisbanes.haze.hazeChild
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.IntOffset
import app.gotcha.android.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.ui.theme.BagelFatOne
import app.gotcha.android.data.ConnectivityObserver
import app.gotcha.android.data.api.looksLikeNetworkFailure
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope

@Composable
fun GotchaPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
    // DESIGN §B #5: CTA is Blue700 (logo blue), not Blue800.
    containerColor: Color = GotchaColors.BrandFill,
    contentColor: Color = GotchaColors.OnBrandFill,
    shapeRadius: Int = 14,
) {
    val shape = RoundedCornerShape(shapeRadius.dp)
    val minHeight = if (shapeRadius >= 16) 54.dp else 52.dp
    val fontSize = if (text.length > 14) 14.sp else 16.sp
    // Shadow on an outer Box so elevation does not interfere with Button hit-testing.
    Box(
        modifier = modifier
            .heightIn(min = minHeight)
            // DESIGN §B #6: brand-tinted ambient + spot shadow (rgba(33,7,170,.22)).
            .shadow(
                if (enabled) 8.dp else 0.dp,
                shape,
                ambientColor = containerColor.copy(alpha = 0.22f),
                spotColor = containerColor.copy(alpha = 0.22f),
            ),
    ) {
        Button(
            onClick = onClick,
            enabled = enabled && !loading,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = minHeight),
            shape = shape,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = containerColor,
                contentColor = contentColor,
                // Loading keeps the full colour (button width/look fixed, §B #20); disabled = M3 38 % (#21).
                disabledContainerColor = if (loading) containerColor else containerColor.copy(alpha = 0.38f),
                disabledContentColor = if (loading) contentColor else contentColor.copy(alpha = 0.8f),
            ),
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), color = contentColor, strokeWidth = 2.dp)
            } else {
                Text(
                    text,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = fontSize,
                    color = contentColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    softWrap = false,
                )
            }
        }
    }
}

@Composable
fun GotchaMultilineTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    minHeight: androidx.compose.ui.unit.Dp = 160.dp,
    labelTrailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = GotchaColors.InkSecondary,
            )
            labelTrailing?.invoke()
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .height(minHeight),
            singleLine = false,
            placeholder = {
                Text(placeholder, color = GotchaColors.TextPlaceholder, fontSize = 15.sp)
            },
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = GotchaColors.SurfaceInput,
                unfocusedContainerColor = GotchaColors.SurfaceInput,
                focusedBorderColor = GotchaColors.BrandPurple,
                unfocusedBorderColor = GotchaColors.BorderInput,
                cursorColor = GotchaColors.BrandPurple,
                focusedTextColor = GotchaColors.InkSecondary,
                unfocusedTextColor = GotchaColors.InkSecondary,
            ),
            textStyle = androidx.compose.ui.text.TextStyle(
                fontFamily = Manrope,
                fontSize = 15.sp,
                lineHeight = 22.sp,
                color = GotchaColors.InkSecondary,
            ),
        )
    }
}

/**
 * Auth/form text field per DESIGN-android-auth-onboarding.md §B:
 * BasicTextField 52dp min (grows with font scale), 1.5dp border r12, Blue700 focus border + 3dp ring @16 %,
 * inline error with icon + semantics, 20dp eye toggle with a label, IME actions, autofill content type,
 * label tied to the field for TalkBack, and bring-into-view on focus so the CTA stays above the keyboard.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GotchaTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    inputFilter: ((String) -> String)? = null,
    error: String? = null,
    enabled: Boolean = true,
    imeAction: ImeAction = ImeAction.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    capitalization: KeyboardCapitalization? = null,
    autofill: ContentType? = null,
    onFocusLost: (() -> Unit)? = null,
) {
    var visible by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    var wasFocused by remember { mutableStateOf(false) }
    val bringIntoView = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()
    val resolvedType = if (isPassword) KeyboardType.Password else keyboardType
    val disableSuggestions =
        isPassword || resolvedType == KeyboardType.Password || resolvedType == KeyboardType.Email || capitalization == KeyboardCapitalization.Words
    val resolvedVisualTransformation = when {
        isPassword && !visible -> PasswordVisualTransformation()
        else -> visualTransformation
    }
    val isError = !error.isNullOrBlank()
    val shape = RoundedCornerShape(12.dp)
    val borderColor = when {
        isError -> GotchaColors.Danger
        focused -> GotchaColors.BrandPurple
        else -> GotchaColors.BorderInput
    }
    val ringColor = if (isError) GotchaColors.Danger.copy(alpha = 0.16f) else GotchaColors.BrandPurple.copy(alpha = 0.16f)
    val textColor = if (enabled) GotchaColors.InkSecondary else GotchaColors.TextPlaceholder
    // Error shake (§B #38): 3 × 4dp over 240ms, skipped under reduced motion.
    val shake = remember { Animatable(0f) }
    val reduceMotion = rememberReducedMotion()
    LaunchedEffect(error) {
        if (isError && !reduceMotion) {
            repeat(3) {
                shake.animateTo(4f, tween(40))
                shake.animateTo(-4f, tween(40))
            }
            shake.animateTo(0f, tween(0))
        }
    }
    Column(modifier = modifier.fillMaxWidth().bringIntoViewRequester(bringIntoView)) {
        Text(
            text = label,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = GotchaColors.InkSecondary,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Spacer(Modifier.height(8.dp))
        BasicTextField(
            value = value,
            onValueChange = { raw -> onValueChange(inputFilter?.invoke(raw) ?: raw) },
            enabled = enabled,
            singleLine = true,
            visualTransformation = resolvedVisualTransformation,
            keyboardOptions = KeyboardOptions(
                keyboardType = resolvedType,
                autoCorrectEnabled = !disableSuggestions,
                imeAction = imeAction,
                capitalization = capitalization ?: if (disableSuggestions) {
                    KeyboardCapitalization.None
                } else {
                    KeyboardCapitalization.Unspecified
                },
            ),
            keyboardActions = keyboardActions,
            cursorBrush = SolidColor(GotchaColors.BrandPurple),
            textStyle = androidx.compose.ui.text.TextStyle(
                fontFamily = Manrope,
                fontSize = 15.sp,
                color = textColor,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .offset { IntOffset(shake.value.dp.roundToPx(), 0) }
                .onFocusChanged { state ->
                    focused = state.isFocused
                    if (state.isFocused) {
                        wasFocused = true
                        scope.launch {
                            // Wait for the IME to animate in, then keep the field (and CTA below) visible.
                            delay(250)
                            bringIntoView.bringIntoView()
                        }
                    } else if (wasFocused) {
                        onFocusLost?.invoke()
                    }
                }
                .semantics {
                    contentDescription = label
                    if (isError) error(error.orEmpty())
                    if (autofill != null) contentType = autofill
                },
            decorationBox = { inner ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .drawBehind {
                            if (focused || isError) {
                                val ring = 3.dp.toPx()
                                drawRoundRect(
                                    color = ringColor,
                                    topLeft = Offset(-ring, -ring),
                                    size = androidx.compose.ui.geometry.Size(size.width + 2 * ring, size.height + 2 * ring),
                                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(12.dp.toPx() + ring),
                                )
                            }
                        }
                        .clip(shape)
                        .background(GotchaColors.SurfaceInput)
                        .border(1.5.dp, borderColor, shape)
                        .padding(start = 16.dp, end = if (isPassword) 4.dp else 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.weight(1f).padding(vertical = 14.dp)) {
                        if (value.isEmpty() && placeholder.isNotEmpty()) {
                            Text(
                                placeholder,
                                color = GotchaColors.TextPlaceholder,
                                fontFamily = Manrope,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        inner()
                    }
                    if (isPassword) {
                        IconButton(
                            onClick = { visible = !visible },
                            enabled = enabled,
                            // Touch target: 48 dp (was 40 dp; M3 minimum).
                            modifier = Modifier.size(48.dp),
                        ) {
                            Icon(
                                imageVector = if (visible) Icons.Outlined.Visibility else Icons.Outlined.VisibilityOff,
                                contentDescription = stringResource(
                                    if (visible) R.string.auth_hide_password else R.string.auth_show_password,
                                ),
                                tint = GotchaColors.TextPlaceholder,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }
            },
        )
        AnimatedVisibility(
            visible = isError,
            enter = expandVertically(tween(200)) + fadeIn(tween(200)),
            exit = shrinkVertically(tween(150)) + fadeOut(tween(150)),
        ) {
            Row(
                modifier = Modifier.padding(top = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    contentDescription = null,
                    tint = GotchaColors.Danger,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    error.orEmpty(),
                    fontFamily = Manrope,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    color = GotchaColors.Danger,
                )
            }
        }
    }
}

/** True when the system "Remove animations" setting is on (ANIMATOR_DURATION_SCALE == 0). */
@Composable
fun rememberReducedMotion(): Boolean {
    val ctx = LocalContext.current
    return remember(ctx) {
        runCatching {
            android.provider.Settings.Global.getFloat(
                ctx.contentResolver,
                android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            ) == 0f
        }.getOrDefault(false)
    }
}

/** Form-level error banner (§B #19/#35): DangerBg r12, polite live region, animated in. */
@Composable
fun FormErrorBanner(message: String?, modifier: Modifier = Modifier) {
    AnimatedVisibility(
        visible = !message.isNullOrBlank(),
        enter = expandVertically(tween(200)) + fadeIn(tween(200)),
        exit = shrinkVertically(tween(150)) + fadeOut(tween(150)),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(GotchaColors.DangerBg)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = GotchaColors.Danger, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(message.orEmpty(), fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.Danger)
        }
    }
}

/** Accessible auth text link (§B #9/#33): Manrope, ≥48dp touch target, Role.Button. */
@Composable
fun AuthTextLink(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    fontSize: androidx.compose.ui.unit.TextUnit = 14.sp,
) {
    Box(
        modifier = modifier
            .minimumInteractiveComponentSize()
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = fontSize,
            color = if (enabled) GotchaColors.BrandPurple else GotchaColors.TextPlaceholder,
        )
    }
}

/** "Prompt + link" footer used on sign in and sign up (§B #9). */
@Composable
fun AuthFooterLink(prompt: String, action: String, onClick: () -> Unit, enabled: Boolean = true) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(prompt, fontFamily = Manrope, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = GotchaColors.TextPlaceholder)
        AuthTextLink(action, onClick, enabled = enabled)
    }
}

/**
 * GOTCHA brand mark from Figma.
 * - Default / auth: purple tile + white G (node 41:807)
 * - [splash]=true: white tile + navy G (node 21:15)
 * - Onboarding header uses [tileColor] = #6C2BD9 (node 21:33)
 */
/**
 * Canonical GOTCHA mark (team/BRAND-logo.md): BrandNavy #2107AA tile, radius 0.3125·size, white Bagel "G" at 0.5625·size.
 * Drawable generated from packages/shared/brand by build_android.py. Sizes: 20, 24, 32, 40, 56, 100.
 * [elevated] adds the canonical purple shadow (UI only, size >= 32).
 */
@Composable
fun BrandMark(
    size: Int = 32,
    elevated: Boolean = false,
) {
    val shape = RoundedCornerShape((size * 0.3125f).dp)
    androidx.compose.foundation.Image(
        painter = androidx.compose.ui.res.painterResource(app.gotcha.android.R.drawable.ic_gotcha_mark),
        contentDescription = "GOTCHA", // i18n-ok: brand name
        modifier = Modifier
            .then(
                if (elevated && size >= 32) {
                    Modifier.shadow(10.dp, shape, ambientColor = Color(0x592107AA), spotColor = Color(0x592107AA))
                } else {
                    Modifier
                },
            )
            .size(size.dp),
    )
}

/** Canonical "GOTCHA" wordmark (outlined Bagel Fat One, −0.025em). [fontSize] = cap size; Ink on light, White on dark. */
@Composable
fun BrandWordmark(
    fontSize: Int = 18,
    color: Color = GotchaColors.Ink,
    contentDescription: String? = "GOTCHA",
) {
    androidx.compose.foundation.Image(
        painter = androidx.compose.ui.res.painterResource(app.gotcha.android.R.drawable.ic_gotcha_wordmark),
        contentDescription = contentDescription,
        colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(color),
        modifier = Modifier.height(fontSize.dp),
    )
}

@Composable
fun LangChip(
    code: String,
    modifier: Modifier = Modifier,
    /** Library cards use soft purple for every language (Figma 21:239). */
    softPurple: Boolean = false,
    /** Continue-reading chips use 8×2 / 6dp radius (Figma 21:168). */
    large: Boolean = false,
    /** Vocabulary rows: RU purple, UZ green, EN blue (Figma 23:97+). */
    vocabulary: Boolean = false,
) {
    val upper = code.uppercase()
    val (bg, fg) = when {
        softPurple -> GotchaColors.BrandPurpleSoft to GotchaColors.BrandPurple
        vocabulary -> when (upper) {
            "RU" -> GotchaColors.BrandPurpleSoft to GotchaColors.BrandPurple
            "UZ" -> GotchaColors.SuccessBg to GotchaColors.SuccessText
            "EN" -> GotchaColors.InfoBg to GotchaColors.InfoText
            else -> GotchaColors.BrandPurpleSoft to GotchaColors.BrandPurple
        }
        // Figma home recommended chips: EN/UZ share info-blue; RU is soft purple.
        upper == "EN" || upper == "UZ" -> GotchaColors.InfoBg to GotchaColors.InfoText
        upper == "RU" -> GotchaColors.BrandPurpleSoft to GotchaColors.BrandPurple
        else -> GotchaColors.BrandPurpleSoft to GotchaColors.BrandPurple
    }
    val hPad = if (large) 8.dp else 6.dp
    val radius = if (large) 6.dp else 4.dp
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(radius))
            .background(bg)
            .padding(horizontal = hPad, vertical = 2.dp),
    ) {
        Text(
            upper,
            color = fg,
            fontSize = if (large) 11.sp else 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Manrope,
        )
    }
}

@Composable
fun LevelChip(level: String, modifier: Modifier = Modifier) {
    val upper = level.uppercase()
    // Figma library: A2/B2 = green, B1/C1 = amber
    val (bg, fg) = when {
        upper == "B1" || upper.startsWith("C") -> GotchaColors.WarningBg to GotchaColors.WarningText
        else -> GotchaColors.SuccessBg to GotchaColors.SuccessText
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(upper, color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = Manrope)
    }
}

@Composable
fun FilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    // Figma library filters: rounded 10dp (not pill)
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(if (selected) GotchaColors.BrandPurple else Color.White)
            .then(
                if (!selected) Modifier.border(1.dp, GotchaColors.Border, shape)
                else Modifier,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (selected) Color.White else GotchaColors.TextMuted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            fontFamily = Manrope,
        )
    }
}

@Composable
fun StatCard(label: String, value: String, valueColor: Color = GotchaColors.Ink, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        Text(
            label,
            color = GotchaColors.TextMuted,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            maxLines = 1,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            value,
            color = valueColor,
            fontFamily = Manrope,
            fontWeight = FontWeight.ExtraBold,
            // Figma vocab/home stats use 18 (e.g. "89 words", "1,247").
            fontSize = 18.sp,
            maxLines = 1,
        )
    }
}

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = GotchaColors.BrandPurple)
    }
}

/**
 * Full-screen frosted loading overlay with determinate circular progress.
 * Used for reader, content detail, and other full-bleed fetch flows.
 *
 * @param progress 0–100 inclusive; drives the ring fill and center label.
 */
@Composable
fun GlassLoadingScreen(
    progress: Int,
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    val hazeState = remember { HazeState() }
    val blurCapable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val clearTintWhite = if (blurCapable) 0.06f else 0.12f
    val clearTintBlack = if (blurCapable) 0.03f else 0.06f
    val glassStyle = HazeStyle(
        backgroundColor = GotchaColors.Surface,
        tints = listOf(
            HazeTint(Color.White.copy(alpha = clearTintWhite)),
            HazeTint(Color.Black.copy(alpha = clearTintBlack)),
        ),
        blurRadius = 12.dp,
        noiseFactor = 0f,
        fallbackTint = HazeTint(GotchaColors.BrandPurpleSoft.copy(alpha = 0.35f)),
    )
    val clamped = progress.coerceIn(0, 100)
    // Ring uses the same value as the center label — ReaderScreen already smooths progress.
    // animateFloatAsState lagged behind rapid updates (100% label, ~50% arc).
    val ringFraction = clamped / 100f

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(GotchaColors.Surface),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .haze(state = hazeState),
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                GotchaColors.BrandPurpleTint,
                                GotchaColors.Surface,
                                GotchaColors.BrandPurpleSoft.copy(alpha = 0.45f),
                            ),
                        ),
                    ),
            )
            Box(
                Modifier
                    .size(220.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 40.dp, y = 48.dp)
                    .background(GotchaColors.BrandPurple.copy(alpha = 0.12f), RoundedCornerShape(110.dp)),
            )
            Box(
                Modifier
                    .size(160.dp)
                    .align(Alignment.BottomStart)
                    .offset(x = (-24).dp, y = (-80).dp)
                    .background(GotchaColors.BrandPurpleMid.copy(alpha = 0.10f), RoundedCornerShape(80.dp)),
            )
        }

        Box(
            Modifier
                .fillMaxSize()
                .hazeChild(state = hazeState, style = glassStyle),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 32.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(GotchaColors.SurfaceCard.copy(alpha = if (blurCapable) 0.72f else 0.88f))
                    .border(1.dp, Color.White.copy(alpha = 0.55f), RoundedCornerShape(24.dp))
                    .padding(horizontal = 28.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(96.dp)) {
                    Canvas(Modifier.fillMaxSize()) {
                        val stroke = 6.dp.toPx()
                        drawArc(
                            color = GotchaColors.Border,
                            startAngle = -90f,
                            sweepAngle = 360f,
                            useCenter = false,
                            style = Stroke(width = stroke, cap = StrokeCap.Round),
                        )
                        drawArc(
                            color = GotchaColors.BrandPurple,
                            startAngle = -90f,
                            sweepAngle = 360f * ringFraction,
                            useCenter = false,
                            style = Stroke(width = stroke, cap = StrokeCap.Round),
                        )
                    }
                    Text(
                        "$clamped%",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        color = GotchaColors.BrandPurple,
                    )
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        title,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = GotchaColors.Ink,
                        textAlign = TextAlign.Center,
                    )
                    if (!subtitle.isNullOrBlank()) {
                        Text(
                            subtitle,
                            fontFamily = Manrope,
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            color = GotchaColors.TextMuted,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

private val skeletonBase: Color get() = GotchaColors.Border
private val skeletonHighlight: Color get() = GotchaColors.SurfaceMuted
@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 8.dp,
) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val shift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 600f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmer", // i18n-ok: animation label
    )
    val brush = Brush.linearGradient(
        colors = listOf(skeletonBase, skeletonHighlight, skeletonBase),
        start = Offset(shift - 200f, 0f),
        end = Offset(shift, 0f),
    )
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush),
    )
}

@Composable
fun StatCardSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(GotchaColors.SurfaceCard)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
    ) {
        SkeletonBox(Modifier.width(72.dp).height(12.dp), cornerRadius = 4.dp)
        Spacer(Modifier.height(8.dp))
        SkeletonBox(Modifier.width(48.dp).height(18.dp), cornerRadius = 4.dp)
    }
}

/** Server-fed home cards only — continue reading + recommended row. */
@Composable
fun HomeFeedCardsSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(2) {
            SkeletonBox(Modifier.fillMaxWidth().height(94.dp), cornerRadius = 16.dp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
        }
    }
}

/** Embeddable list placeholder — safe inside parent LazyColumn. */
@Composable
fun InlineListRowSkeleton(rows: Int = 5, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(rows) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonBox(Modifier.size(44.dp), cornerRadius = 22.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    SkeletonBox(Modifier.fillMaxWidth(0.6f).height(14.dp), cornerRadius = 4.dp)
                    SkeletonBox(Modifier.fillMaxWidth(0.85f).height(12.dp), cornerRadius = 4.dp)
                }
            }
        }
    }
}

@Composable
fun InlineVocabularyListSkeleton(rows: Int = 4, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        repeat(rows) {
            SkeletonBox(Modifier.fillMaxWidth().height(72.dp), cornerRadius = 12.dp)
        }
    }
}

@Composable
fun ProgressStatsSkeleton(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCardSkeleton(Modifier.weight(1f))
            StatCardSkeleton(Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCardSkeleton(Modifier.weight(1f))
            StatCardSkeleton(Modifier.weight(1f))
        }
    }
}

@Composable
fun FormFieldSkeleton(modifier: Modifier = Modifier, height: Dp = 52.dp) {
    SkeletonBox(modifier.fillMaxWidth().height(height), cornerRadius = 12.dp)
}

@Composable
fun HomeScreenSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SkeletonBox(Modifier.width(120.dp).height(14.dp))
                SkeletonBox(Modifier.width(160.dp).height(22.dp), cornerRadius = 10.dp)
            }
            SkeletonBox(Modifier.size(44.dp), cornerRadius = 22.dp)
        }
        SkeletonBox(Modifier.fillMaxWidth().height(72.dp), cornerRadius = 20.dp)
        SkeletonBox(Modifier.fillMaxWidth().height(104.dp), cornerRadius = 16.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
            SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
        }
        SkeletonBox(Modifier.width(140.dp).height(18.dp), cornerRadius = 6.dp)
        repeat(2) {
            SkeletonBox(Modifier.fillMaxWidth().height(94.dp), cornerRadius = 16.dp)
        }
        SkeletonBox(Modifier.width(180.dp).height(18.dp), cornerRadius = 6.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
            SkeletonBox(Modifier.width(160.dp).height(180.dp), cornerRadius = 16.dp)
        }
    }
}

@Composable
fun LibraryBrowseSkeleton(
    columns: Int = 2,
    modifier: Modifier = Modifier,
    bottomPadding: Dp = 0.dp,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = bottomPadding),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        userScrollEnabled = false,
    ) {
        items(10) {
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(GotchaColors.SurfaceCard)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SkeletonBox(Modifier.fillMaxWidth().height(144.dp), cornerRadius = 12.dp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SkeletonBox(Modifier.width(28.dp).height(16.dp), cornerRadius = 4.dp)
                    SkeletonBox(Modifier.width(28.dp).height(16.dp), cornerRadius = 4.dp)
                }
                SkeletonBox(Modifier.fillMaxWidth().height(14.dp), cornerRadius = 4.dp)
                SkeletonBox(Modifier.width(100.dp).height(12.dp), cornerRadius = 4.dp)
            }
        }
    }
}

@Composable
fun LibraryGridSkeleton(
    modifier: Modifier = Modifier,
    bottomPadding: Dp = 0.dp,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = bottomPadding),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        userScrollEnabled = false,
    ) {
        items(4) {
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(GotchaColors.SurfaceCard)
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SkeletonBox(Modifier.fillMaxWidth().height(130.dp), cornerRadius = 12.dp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SkeletonBox(Modifier.width(28.dp).height(16.dp), cornerRadius = 4.dp)
                    SkeletonBox(Modifier.width(28.dp).height(16.dp), cornerRadius = 4.dp)
                }
                SkeletonBox(Modifier.fillMaxWidth().height(14.dp), cornerRadius = 4.dp)
                SkeletonBox(Modifier.width(100.dp).height(12.dp), cornerRadius = 4.dp)
            }
        }
    }
}

@Composable
fun ListRowSkeleton(modifier: Modifier = Modifier, rows: Int = 5) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        userScrollEnabled = false,
    ) {
        items(rows) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonBox(Modifier.size(44.dp), cornerRadius = 22.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    SkeletonBox(Modifier.fillMaxWidth(0.6f).height(14.dp), cornerRadius = 4.dp)
                    SkeletonBox(Modifier.fillMaxWidth(0.85f).height(12.dp), cornerRadius = 4.dp)
                }
            }
        }
    }
}

@Composable
fun ChatSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        repeat(3) { i ->
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = if (i % 2 == 0) Arrangement.Start else Arrangement.End,
            ) {
                SkeletonBox(
                    Modifier.width(if (i % 2 == 0) 220.dp else 180.dp).height(64.dp),
                    cornerRadius = 16.dp,
                )
            }
        }
    }
}

@Composable
fun VocabularySkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBox(Modifier.fillMaxWidth().height(120.dp), cornerRadius = 16.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
            SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
        }
        SkeletonBox(Modifier.fillMaxWidth().height(48.dp), cornerRadius = 14.dp)
        repeat(4) {
            SkeletonBox(Modifier.fillMaxWidth().height(72.dp), cornerRadius = 14.dp)
        }
    }
}

@Composable
fun ProgressSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SkeletonBox(Modifier.width(120.dp).height(28.dp), cornerRadius = 8.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(3) {
                SkeletonBox(Modifier.weight(1f).height(72.dp), cornerRadius = 12.dp)
            }
        }
        SkeletonBox(Modifier.fillMaxWidth().height(160.dp), cornerRadius = 16.dp)
        SkeletonBox(Modifier.fillMaxWidth().height(120.dp), cornerRadius = 16.dp)
        SkeletonBox(Modifier.width(140.dp).height(18.dp), cornerRadius = 6.dp)
        SkeletonBox(Modifier.fillMaxWidth().height(88.dp), cornerRadius = 16.dp)
    }
}

/**
 * Shared load-error state (UI-09/UI-10): icon, message, Retry. Network failures fall back to the
 * offline state so the copy matches the cause.
 */
@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    if (looksLikeNetworkFailure(message)) {
        OfflineEmptyState(onRetry = onRetry, compact = true, modifier = modifier)
        return
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp)
            .semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        androidx.compose.material3.Icon(
            androidx.compose.material.icons.Icons.Outlined.ErrorOutline,
            contentDescription = null,
            tint = GotchaColors.TextSubtle,
            modifier = Modifier.size(36.dp),
        )
        Text(
            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.error_title),
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = GotchaColors.Ink,
            textAlign = TextAlign.Center,
        )
        Text(message, fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.TextMuted, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        androidx.compose.material3.OutlinedButton(
            onClick = onRetry,
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, GotchaColors.Border),
            colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(contentColor = GotchaColors.BrandPurple),
            modifier = Modifier.heightIn(min = 44.dp),
        ) {
            Text(androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.common_retry), fontFamily = Inter, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun ErrorBox(message: String, onRetry: (() -> Unit)? = null) {
    if (looksLikeNetworkFailure(message)) {
        OfflineEmptyState(
            subtitle = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.offline_screen_subtitle),
            onRetry = onRetry,
            compact = true,
        )
        return
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, color = GotchaColors.TextMuted)
        if (onRetry != null) {
            Spacer(Modifier.height(12.dp))
            GotchaPrimaryButton(text = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.common_retry), onClick = onRetry, modifier = Modifier.width(160.dp))
        }
    }
}

@Composable
fun OfflineEmptyState(
    message: String = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.offline_message),
    subtitle: String = androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.offline_subtitle),
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    Box(
        modifier = modifier
            .then(if (compact) Modifier.fillMaxWidth() else Modifier.fillMaxSize())
            .then(if (compact) Modifier else Modifier.background(GotchaColors.SurfaceMuted)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 32.dp, vertical = if (compact) 24.dp else 0.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.offline_title),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = GotchaColors.Ink,
                textAlign = TextAlign.Center,
            )
            Text(
                message,
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                color = GotchaColors.TextMuted,
                textAlign = TextAlign.Center,
            )
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = GotchaColors.TextSubtle,
                    textAlign = TextAlign.Center,
                )
            }
            if (onRetry != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.offline_tap_retry),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = GotchaColors.BrandPurple,
                    modifier = Modifier.clickable(onClick = onRetry),
                )
            }
        }
    }
}

@Composable
fun ReconnectionFlashOverlay(
    connectivity: ConnectivityObserver,
    modifier: Modifier = Modifier,
) {
    val alpha = remember { Animatable(0f) }
    LaunchedEffect(connectivity) {
        var wasOffline = !connectivity.currentOnline()
        connectivity.isOnline.collect { online ->
            if (wasOffline && online) {
                alpha.snapTo(1f)
                alpha.animateTo(0f, animationSpec = tween(durationMillis = 550))
            }
            wasOffline = !online
        }
    }
    if (alpha.value > 0.001f) {
        Box(
            modifier
                .fillMaxSize()
                .background(GotchaColors.BrandPurple.copy(alpha = alpha.value * 0.42f)),
        )
    }
}

@Composable
fun OfflineBanner(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(GotchaColors.SurfaceMuted)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            androidx.compose.ui.res.stringResource(app.gotcha.android.R.string.x_offline_mode_showing_saved_data),
            fontFamily = Manrope,
            fontSize = 13.sp,
            color = GotchaColors.TextMuted,
        )
    }
}

@Composable
fun rememberIsOnline(connectivity: ConnectivityObserver): Boolean {
    val online by connectivity.isOnline.collectAsState(initial = connectivity.currentOnline())
    return online
}

/** Show stale-cache banner only when device is offline and cached content is visible. */
fun shouldShowOfflineBanner(
    isOnline: Boolean,
    hasCachedContent: Boolean,
): Boolean = !isOnline && hasCachedContent

@Composable
fun OfflineBannerIfNeeded(
    connectivity: ConnectivityObserver,
    hasCachedContent: Boolean,
    modifier: Modifier = Modifier,
) {
    val isOnline = rememberIsOnline(connectivity)
    if (shouldShowOfflineBanner(isOnline, hasCachedContent)) {
        OfflineBanner(modifier)
    }
}

class OfflineInteraction(
    val isOnline: Boolean,
    private val onBlocked: () -> Unit,
) {
    fun guardClick(onClick: () -> Unit): () -> Unit = {
        if (isOnline) onClick() else onBlocked()
    }
}

@Composable
fun rememberOfflineInteraction(
    connectivity: ConnectivityObserver,
    offlineMessage: String = "Internet connection failure",
): OfflineInteraction {
    val isOnline = rememberIsOnline(connectivity)
    val context = LocalContext.current
    return remember(isOnline, offlineMessage) {
        OfflineInteraction(isOnline) {
            Toast.makeText(context, offlineMessage, Toast.LENGTH_SHORT).show()
        }
    }
}

fun Modifier.offlineClickable(
    isOnline: Boolean,
    onOffline: () -> Unit,
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier = clickable(enabled = enabled) {
    if (isOnline) onClick() else onOffline()
}
