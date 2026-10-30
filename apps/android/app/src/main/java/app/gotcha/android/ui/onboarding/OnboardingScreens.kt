package app.gotcha.android.ui.onboarding

import androidx.compose.foundation.layout.fillMaxHeight
import androidx.annotation.RawRes
import androidx.annotation.StringRes
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.compose.LifecycleResumeEffect
import app.gotcha.android.ui.components.AuthTextLink
import app.gotcha.android.ui.components.rememberReducedMotion
import app.gotcha.android.ui.theme.GotchaThemeState
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.ui.components.BrandMark
import app.gotcha.android.ui.components.BrandWordmark
import app.gotcha.android.ui.components.GotchaPrimaryButton
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.GotchaSystemBars
import app.gotcha.android.ui.theme.Manrope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: (loggedIn: Boolean, isAdmin: Boolean, onboardingDone: Boolean) -> Unit) {
    val container = LocalAppContainer.current
    // Purple gradient → light (white) status-bar icons for contrast
    GotchaSystemBars(darkIcons = false)
    LaunchedEffect(Unit) {
        delay(900)
        val (loggedIn, isAdmin) = container.authRepository.restoreSessionOnLaunch()
        val onboardingDone = container.tokenStore.onboardingDone()
        onFinished(loggedIn, isAdmin, onboardingDone)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(GotchaColors.BrandNavy, GotchaColors.BrandPurpleDeep),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
        ) {
            BrandMark(size = 100, elevated = true)
            Spacer(Modifier.height(24.dp))
            BrandWordmark(fontSize = 48, color = Color.White)
            Spacer(Modifier.height(12.dp))
            Text(
                stringResource(R.string.splash_tagline),
                color = Color.White.copy(alpha = 0.85f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
            )
        }
        Text(
            "Version 2.4.0",
            color = Color.White.copy(alpha = 0.6f),
            fontFamily = Manrope,
            fontSize = 12.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 40.dp),
        )
    }
}

/** DESIGN-android-auth-onboarding.md §A.6: Lottie art per page, copy in string resources. */
private data class OnboardingPage(
    @StringRes val title: Int,
    @StringRes val body: Int,
    @RawRes val anim: Int,
    @RawRes val animDark: Int,
    /** Static hero frame (fraction of the timeline) shown under reduced motion. */
    val heroFrame: Float,
    val loop: Boolean,
)

private val pages = listOf(
    OnboardingPage(R.string.onb_1_title, R.string.onb_1_body, R.raw.onboarding_1_read, R.raw.onboarding_1_read_dark, 110f / 240f, true),
    OnboardingPage(R.string.onb_2_title, R.string.onb_2_body, R.raw.onboarding_2_vocab, R.raw.onboarding_2_vocab_dark, 110f / 240f, true),
    OnboardingPage(R.string.onb_3_title, R.string.onb_3_body, R.raw.onboarding_3_progress, R.raw.onboarding_3_progress_dark, 149f / 150f, false),
    OnboardingPage(R.string.onb_4_title, R.string.onb_4_body, R.raw.onboarding_4_community, R.raw.onboarding_4_community_dark, 180f / 360f, true),
)

@Composable
private fun OnboardingArt(page: OnboardingPage, active: Boolean, modifier: Modifier = Modifier) {
    val reduce = rememberReducedMotion()
    // Dark art follows the in-app theme (system / light / dark), not only the -night qualifier.
    val res = if (GotchaThemeState.isDark) page.animDark else page.anim
    val comp by rememberLottieComposition(LottieCompositionSpec.RawRes(res))
    var resumed by remember { mutableStateOf(true) }
    LifecycleResumeEffect(Unit) {
        resumed = true
        onPauseOrDispose { resumed = false }
    }
    val progress by animateLottieCompositionAsState(
        composition = comp,
        isPlaying = active && resumed && !reduce,
        iterations = if (page.loop) LottieConstants.IterateForever else 1,
        restartOnPlay = true,
    )
    val shape = RoundedCornerShape(24.dp)
    Box(
        modifier
            .fillMaxWidth()
            .widthIn(max = 360.dp)
            .aspectRatio(4f / 3f)
            .clip(shape)
            .border(1.dp, GotchaColors.Border, shape),
    ) {
        LottieAnimation(
            composition = comp,
            progress = { if (reduce) page.heroFrame else progress },
            modifier = Modifier.matchParentSize(),
            contentScale = ContentScale.Fit,
        )
    }
}

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val index = pagerState.currentPage
    GotchaSystemBars()
    val finish: () -> Unit = {
        scope.launch {
            container.tokenStore.setOnboardingDone()
            onDone()
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        // §A.4: shrink spacers on short screens.
        val compact = maxHeight < 640.dp
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = if (compact) 12.dp else 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandMark(size = 32)
                    Spacer(Modifier.width(12.dp))
                    BrandWordmark(fontSize = 18, contentDescription = null)
                }
                if (index < pages.lastIndex) {
                    AuthTextLink(
                        text = stringResource(R.string.onb_skip),
                        onClick = finish,
                        fontSize = 14.sp,
                    )
                }
            }

            // UI-28: swipeable pages (HorizontalPager) instead of button-only paging.
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalAlignment = Alignment.CenterVertically,
            ) { i ->
                val page = pages[i]
                // P3b.1 GOT-QA-P3b-03: at 360dp / font 1.3 (ru) the body was clipped under the dots. The art
                // now gives up height first (weight, fill=false) so the title + body always get their full size.
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight()
                        .padding(horizontal = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    OnboardingArt(
                        page,
                        active = pagerState.currentPage == i && !pagerState.isScrollInProgress,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    Spacer(Modifier.height(if (compact) 20.dp else 32.dp))
                    Text(
                        stringResource(page.title),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 28.sp,
                        lineHeight = 36.sp,
                        color = GotchaColors.Ink,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().semantics { heading() },
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        stringResource(page.body),
                        fontFamily = Manrope,
                        color = GotchaColors.TextMuted,
                        fontSize = 16.sp,
                        lineHeight = 24.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(top = 16.dp, bottom = if (compact) 20.dp else 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().clearAndSetSemantics { },
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                ) {
                    pages.indices.forEach { i ->
                        val w by animateDpAsState(if (i == index) 24.dp else 8.dp, label = "dot")
                        Box(
                            modifier = Modifier
                                .height(8.dp)
                                .width(w)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (i == index) GotchaColors.BrandPurple else GotchaColors.Border),
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
                GotchaPrimaryButton(
                    text = stringResource(if (index == pages.lastIndex) R.string.onb_get_started else R.string.onb_next),
                    shapeRadius = 16,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        if (index < pages.lastIndex) {
                            scope.launch { pagerState.animateScrollToPage(index + 1) }
                        } else {
                            finish()
                        }
                    },
                )
            }
        }
    }
}
