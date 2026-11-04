package app.gotcha.android.ui.learner

import app.gotcha.android.ui.theme.GotchaBlue

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.data.model.VocabItem
import app.gotcha.android.ui.components.LoadingBox
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import kotlinx.coroutines.launch

/** SRS Review overlay — matches web-learner VocabularyPage ReviewModal. */
@Composable
fun VocabularyReviewModal(
    onClose: () -> Unit,
    onRefresh: () -> Unit,
    seedQueue: List<VocabItem>? = null,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var queue by remember(seedQueue) { mutableStateOf(seedQueue.orEmpty()) }
    var loading by remember { mutableStateOf(queue.isEmpty()) }
    var index by remember { mutableIntStateOf(0) }
    var revealed by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var reviewed by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(seedQueue) {
        if (seedQueue != null) {
            queue = seedQueue
            loading = false
            return@LaunchedEffect
        }
        loading = queue.isEmpty()
        error = null
        try {
            queue = container.vocabRepository.reviewQueue(limit = 200)
            index = 0
            revealed = false
            reviewed = 0
        } catch (e: Exception) {
            if (queue.isEmpty()) error = e.message ?: "Failed to load review queue"
        } finally {
            loading = false
        }
    }

    fun closeModal() {
        onClose()
        onRefresh()
    }

    fun rate(rating: String) {
        val item = queue.getOrNull(index) ?: return
        if (busy) return
        busy = true
        scope.launch {
            try {
                container.vocabRepository.review(item.id, rating)
                reviewed += 1
                revealed = false
                index += 1
                error = null
            } catch (e: Exception) {
                error = e.message ?: "Review failed"
            } finally {
                busy = false
            }
        }
    }

    if (queue.isEmpty() && !loading && error == null) return

    val done = index >= queue.size
    val item = queue.getOrNull(index)
    val progress = if (queue.isEmpty()) 0f else (index.toFloat() / queue.size).coerceIn(0f, 1f)

    Dialog(
        onDismissRequest = { closeModal() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Psychology, null, tint = GotchaColors.WebAccent, modifier = Modifier.size(16.dp))
                        Text("SRS Review", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF374151))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "${(index + 1).coerceAtMost(queue.size.coerceAtLeast(1))} / ${queue.size}",
                            fontFamily = Inter,
                            fontSize = 12.sp,
                            color = Color(0xFF9CA3AF),
                        )
                        Box(
                            Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { closeModal() },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.Close, null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
                        }
                    }
                }

                Box(Modifier.fillMaxWidth().height(4.dp).background(Color(0xFFF3F4F6))) {
                    Box(Modifier.fillMaxWidth(progress).height(4.dp).background(GotchaColors.WebAccent))
                }

                when {
                    loading && queue.isEmpty() -> {
                        Box(Modifier.fillMaxWidth().height(280.dp), contentAlignment = Alignment.Center) {
                            LoadingBox(Modifier.size(48.dp))
                        }
                    }
                    error != null && queue.isEmpty() -> {
                        Column(
                            Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(error!!, fontFamily = Inter, fontSize = 14.sp, color = GotchaColors.Danger)
                            ReviewModalButton("Close", onClick = { closeModal() }, filled = true)
                        }
                    }
                    done -> {
                        Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                Modifier.size(64.dp).clip(CircleShape).background(Color(0xFFD1FAE5)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Outlined.CheckCircle, null, tint = Color(0xFF059669), modifier = Modifier.size(32.dp))
                            }
                            Spacer(Modifier.height(16.dp))
                            Text("Session complete!", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color(0xFF111827))
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Reviewed $reviewed word${if (reviewed == 1) "" else "s"}. Great job!",
                                fontFamily = Inter,
                                fontSize = 14.sp,
                                color = Color(0xFF6B7280),
                            )
                            Spacer(Modifier.height(24.dp))
                            ReviewModalButton("Back to vocabulary", onClick = { closeModal() }, filled = true)
                        }
                    }
                    item != null -> {
                        Column(
                            Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                item.lemma.orEmpty(),
                                fontFamily = Inter,
                                fontWeight = FontWeight.Bold,
                                fontSize = 30.sp,
                                color = Color(0xFF111827),
                                textAlign = TextAlign.Center,
                            )
                            item.contextSentence?.takeIf { it.isNotBlank() }?.let { ctx ->
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "\"$ctx\"",
                                    fontFamily = Inter,
                                    fontSize = 12.sp,
                                    color = Color(0xFF9CA3AF),
                                    fontStyle = FontStyle.Italic,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 8.dp),
                                )
                            }
                            Spacer(Modifier.height(24.dp))
                            if (!revealed) {
                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFF9FAFB))
                                        .border(2.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                                        .clickable(enabled = !busy) { revealed = true }
                                        .padding(vertical = 12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Text("Show translation", fontFamily = Inter, fontSize = 14.sp, color = Color(0xFF9CA3AF))
                                    Text(
                                        "Tap to reveal",
                                        fontFamily = Inter,
                                        fontSize = 11.sp,
                                        color = Color(0xFF9CA3AF).copy(alpha = 0.6f),
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                            } else {
                                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(GotchaBlue.B50)
                                            .padding(horizontal = 16.dp, vertical = 12.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            item.translation.orEmpty(),
                                            fontFamily = Inter,
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 16.sp,
                                            color = Color(0xFF374151),
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        listOf(
                                            Triple("Again", Color(0xFFDC2626), Color(0xFFFECACA)),
                                            Triple("Hard", Color(0xFFD97706), Color(0xFFFDE68A)),
                                            Triple("Good", Color(0xFF2563EB), Color(0xFFBFDBFE)),
                                            Triple("Easy", Color(0xFF059669), Color(0xFFA7F3D0)),
                                        ).forEach { (label, textColor, borderColor) ->
                                            Column(
                                                Modifier
                                                    .weight(1f)
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(Color.White)
                                                    .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                                                    .clickable(enabled = !busy) { rate(label) }
                                                    .padding(vertical = 10.dp),
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                            ) {
                                                Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = textColor)
                                            }
                                        }
                                    }
                                }
                            }
                            error?.let { msg ->
                                Spacer(Modifier.height(12.dp))
                                Text(msg, fontFamily = Inter, fontSize = 12.sp, color = GotchaColors.Danger, textAlign = TextAlign.Center)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewModalButton(text: String, onClick: () -> Unit, filled: Boolean) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .height(51.dp)
            .clip(shape)
            .background(if (filled) GotchaColors.BrandPurpleMid else Color.Transparent)
            .then(if (filled) Modifier else Modifier.border(1.dp, GotchaColors.BrandPurpleMid, shape))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = if (filled) Color.White else GotchaColors.BrandPurpleMid,
        )
    }
}
