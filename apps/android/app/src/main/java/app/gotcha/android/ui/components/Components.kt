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
    containerColor: Color = GotchaColors.BrandPurpleDeep,
    contentColor: Color = Color.White,
    shapeRadius: Int = 14,
) {
    val shape = RoundedCornerShape(shapeRadius.dp)
    val minHeight = if (shapeRadius >= 16) 54.dp else 52.dp
    val fontSize = if (text.length > 14) 14.sp else 16.sp
    // Shadow on an outer Box so elevation does not interfere with Button hit-testing.
    Box(
        modifier = modifier
            .heightIn(min = minHeight)
            .shadow(8.dp, shape, spotColor = containerColor.copy(alpha = 0.19f)),
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
                disabledContainerColor = containerColor.copy(alpha = 0.5f),
                disabledContentColor = contentColor.copy(alpha = 0.8f),
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

@Composable
fun GotchaTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    var visible by remember { mutableStateOf(false) }
    val resolvedType = if (isPassword) KeyboardType.Password else keyboardType
    val disableSuggestions =
        isPassword || resolvedType == KeyboardType.Password || resolvedType == KeyboardType.Email
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = GotchaColors.InkSecondary,
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            singleLine = true,
            placeholder = {
                Text(placeholder, color = GotchaColors.TextPlaceholder, fontSize = 15.sp)
            },
            visualTransformation = if (isPassword && !visible) PasswordVisualTransformation() else VisualTransformation.None,
            trailingIcon = if (isPassword) {
                {
                    IconButton(onClick = { visible = !visible }) {
                        Icon(
                            imageVector = if (visible) Icons.Outlined.Visibility else Icons.Outlined.VisibilityOff,
                            contentDescription = null,
                            tint = GotchaColors.TextMuted,
                        )
                    }
                }
            } else null,
            keyboardOptions = KeyboardOptions(
                keyboardType = resolvedType,
                autoCorrect = !disableSuggestions,
                capitalization = if (disableSuggestions) {
                    KeyboardCapitalization.None
                } else {
                    KeyboardCapitalization.Unspecified
                },
            ),
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
                color = GotchaColors.InkSecondary,
            ),
        )
    }
}

/**
 * GOTCHA brand mark from Figma.
 * - Default / auth: purple tile + white G (node 41:807)
 * - [splash]=true: white tile + navy G (node 21:15)
 * - Onboarding header uses [tileColor] = #6C2BD9 (node 21:33)
 */
@Composable
fun BrandMark(
    size: Int = 56,
    splash: Boolean = false,
    cornerRadius: Int = if (splash && size >= 90) 24 else if (size >= 50) 16 else (size * 0.28f).toInt().coerceAtLeast(7),
    tileColor: Color? = null,
    letterColor: Color? = null,
) {
    val bg = tileColor ?: if (splash) Color.White else GotchaColors.BrandPurpleDeep
    val fg = letterColor ?: if (splash) GotchaColors.BrandNavy else Color.White
    val letterSp = when {
        size >= 90 -> 56.sp
        size >= 50 -> 36.sp
        else -> (size * 0.56f).sp
    }
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(cornerRadius.dp))
            .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "G",
            color = fg,
            fontFamily = BagelFatOne,
            fontWeight = FontWeight.Normal,
            fontSize = letterSp,
            lineHeight = letterSp,
        )
    }
}

@Composable
fun BrandWordmark(
    fontSize: Int = 28,
    color: Color = GotchaColors.BrandNavy,
) {
    Text(
        text = "GOTCHA",
        color = color,
        fontFamily = BagelFatOne,
        fontWeight = FontWeight.Normal,
        fontSize = fontSize.sp,
        letterSpacing = (-0.5).sp,
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
            .background(Color.White)
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
    val animatedProgress by animateFloatAsState(
        targetValue = clamped / 100f,
        animationSpec = tween(durationMillis = 450, easing = LinearEasing),
        label = "glassLoadProgress",
    )

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
                    .background(Color.White.copy(alpha = if (blurCapable) 0.72f else 0.88f))
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
                            sweepAngle = 360f * animatedProgress,
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

private val skeletonBase = Color(0xFFE5E7EB)
private val skeletonHighlight = Color(0xFFF3F4F6)

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
        label = "shimmer",
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
            .background(Color.White)
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
                    .background(Color.White)
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
                    .background(Color.White)
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

@Composable
fun ErrorBox(message: String, onRetry: (() -> Unit)? = null) {
    if (looksLikeNetworkFailure(message)) {
        OfflineEmptyState(
            subtitle = "Connect to the internet to load this screen.",
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
            GotchaPrimaryButton(text = "Retry", onClick = onRetry, modifier = Modifier.width(160.dp))
        }
    }
}

@Composable
fun OfflineEmptyState(
    message: String = "You're offline",
    subtitle: String = "Connect to the internet to load your content.",
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
                "Offline mode",
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
                    "Tap to retry",
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
            "Offline mode — showing saved data",
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
