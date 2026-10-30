package app.gotcha.android.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.BuildConfig

@Composable
fun ExternalImportDebugOverlay() {
    if (!BuildConfig.DEBUG || !ExternalImportDebug.showOverlay) return
    val lines by ExternalImportDebug.lines.collectAsState()
    if (lines.isEmpty()) return

    Box(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .heightIn(max = 260.dp)
                .background(Color(0xE6000000))
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                "IMPORT DEBUG (share screenshot)",
                color = Color(0xFFFFD54F),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            )
            lines.forEach { line ->
                Text(
                    line,
                    color = Color(0xFFE0E0E0),
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    lineHeight = 11.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            TextButton(
                onClick = { ExternalImportDebug.clear() },
                modifier = Modifier.align(Alignment.End),
            ) {
                Text("Clear", color = Color(0xFF90CAF9), fontSize = 10.sp)
            }
        }
    }
}
