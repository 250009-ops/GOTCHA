package app.gotcha.android.ui.onboarding

import androidx.compose.foundation.Image
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
                "Read your way to fluency",
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

private data class OnboardingPage(
    val title: String,
    val body: String,
    val imageRes: Int,
)

private val pages = listOf(
    OnboardingPage(
        "Read real content in any language",
        "Learn English, Russian, or Uzbek by reading actual books, news, and articles with in-context translation.",
        R.drawable.onboarding_1,
    ),
    OnboardingPage(
        "Build vocabulary naturally",
        "Tap any word to instantly translate and add it to your smart spaced repetition deck.",
        R.drawable.onboarding_2,
    ),
    OnboardingPage(
        "Track your journey",
        "Monitor your progress with CEFR levels, daily reading streaks, and real-time comprehension statistics.",
        R.drawable.onboarding_3,
    ),
    OnboardingPage(
        "Join 12,840+ learners",
        "Be part of a thriving global community learning languages through content they actually love.",
        R.drawable.onboarding_4,
    ),
)

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var index by remember { mutableIntStateOf(0) }
    val page = pages[index]
    GotchaSystemBars(darkIcons = true)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .statusBarsPadding()
            .navigationBarsPadding(),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BrandMark(size = 32)
                Spacer(Modifier.width(12.dp))
                BrandWordmark(fontSize = 18)
            }
            if (index < pages.lastIndex) {
                Text(
                    "Skip",
                    color = GotchaColors.TextMuted,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.clickable {
                        scope.launch {
                            container.tokenStore.setOnboardingDone()
                            onDone()
                        }
                    },
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(page.imageRes),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(24.dp))
                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(24.dp)),
                contentScale = ContentScale.Crop,
            )
            Spacer(Modifier.height(32.dp))
            Text(
                page.title,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 28.sp,
                lineHeight = 36.sp,
                color = GotchaColors.Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Text(
                page.body,
                fontFamily = Manrope,
                color = GotchaColors.TextMuted,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            ) {
                pages.indices.forEach { i ->
                    Box(
                        modifier = Modifier
                            .height(8.dp)
                            .width(if (i == index) 24.dp else 8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (i == index) GotchaColors.BrandPurple else GotchaColors.Border),
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            GotchaPrimaryButton(
                text = if (index == pages.lastIndex) "Get Started" else "Next",
                containerColor = GotchaColors.BrandPurple,
                shapeRadius = 16,
                onClick = {
                    if (index < pages.lastIndex) {
                        index++
                    } else {
                        scope.launch {
                            container.tokenStore.setOnboardingDone()
                            onDone()
                        }
                    }
                },
            )
        }
    }
}
