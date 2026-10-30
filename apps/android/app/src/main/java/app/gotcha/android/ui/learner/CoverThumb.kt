package app.gotcha.android.ui.learner

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Alignment
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import app.gotcha.android.data.resolveMediaUrl
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage

// Moved from the deleted HomeScreen.kt (dead screen, removed in P3b per Kai).
@Composable
fun CoverThumb(url: String?, modifier: Modifier = Modifier, corner: Int = 8) {
    if (!url.isNullOrBlank()) {
        AsyncImage(
            model = resolveMediaUrl(url),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier.clip(RoundedCornerShape(corner.dp)),
        )
    } else {
        Box(
            modifier = modifier
                .clip(RoundedCornerShape(corner.dp))
                .background(GotchaColors.BrandFill),
            contentAlignment = Alignment.Center,
        ) {
            Text("G", color = Color.White.copy(0.5f), fontWeight = FontWeight.Bold, fontFamily = Manrope)
        }
    }
}
