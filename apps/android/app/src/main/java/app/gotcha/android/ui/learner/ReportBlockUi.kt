package app.gotcha.android.ui.learner

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.R
import app.gotcha.android.data.model.ReportUserRequest
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Inter
import app.gotcha.android.data.api.apiErrorMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** P3b report & block (Play UGC policy). Reasons match the API enum `UserReportReason`. */
internal val REPORT_REASONS = listOf(
    "spam" to R.string.report_reason_spam,
    "harassment" to R.string.report_reason_harassment,
    "inappropriate" to R.string.report_reason_inappropriate,
    "underage" to R.string.report_reason_underage,
    "other" to R.string.report_reason_other,
)

/** Report a user (optionally a specific message) and optionally block them in the same step. */
@Composable
fun ReportUserDialog(
    reportedUserId: String,
    peerName: String,
    messageId: String? = null,
    conversationId: String? = null,
    onDismiss: () -> Unit,
    onDone: (blocked: Boolean) -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var reason by remember { mutableStateOf<String?>(null) }
    var details by remember { mutableStateOf("") }
    var alsoBlock by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val canSend = reason != null && (reason != "other" || details.isNotBlank()) && !sending

    AlertDialog(
        onDismissRequest = { if (!sending) onDismiss() },
        title = { Text(stringResource(R.string.report_title, peerName), fontFamily = Inter) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.report_body), fontFamily = Inter, fontSize = 13.sp, color = GotchaColors.TextMuted)
                REPORT_REASONS.forEach { (key, label) ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { reason = key },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = reason == key, onClick = { reason = key })
                        Text(stringResource(label), fontFamily = Inter, fontSize = 14.sp)
                    }
                }
                OutlinedTextField(
                    value = details,
                    onValueChange = { details = it.take(1000) },
                    label = { Text(stringResource(R.string.report_details)) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                )
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { alsoBlock = !alsoBlock },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = alsoBlock, onCheckedChange = { alsoBlock = it })
                    Text(stringResource(R.string.report_also_block, peerName), fontFamily = Inter, fontSize = 14.sp)
                }
                error?.let { Text(it, color = GotchaColors.DangerText, fontFamily = Inter, fontSize = 13.sp) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSend,
                onClick = {
                    scope.launch {
                        sending = true
                        error = null
                        try {
                            container.messagingRepository.report(
                                ReportUserRequest(
                                    reportedUserId = reportedUserId,
                                    reason = reason!!,
                                    details = details.trim().ifBlank { null },
                                    messageId = messageId,
                                    conversationId = conversationId,
                                    alsoBlock = alsoBlock,
                                ),
                            )
                            onDone(alsoBlock)
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            error = e.apiErrorMessage(R.string.report_failed)
                        } finally {
                            sending = false
                        }
                    }
                },
            ) { Text(stringResource(R.string.report_send), color = GotchaColors.DangerText, fontFamily = Inter) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !sending) { Text(stringResource(R.string.x_cancel), fontFamily = Inter) }
        },
    )
}

/** Confirm block / unblock. */
@Composable
fun BlockUserDialog(
    peerName: String,
    unblock: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                stringResource(if (unblock) R.string.unblock_title else R.string.block_title, peerName),
                fontFamily = Inter,
            )
        },
        text = {
            Text(
                stringResource(if (unblock) R.string.unblock_body else R.string.block_body),
                fontFamily = Inter,
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(
                    stringResource(if (unblock) R.string.unblock_action else R.string.block_action),
                    color = GotchaColors.DangerText,
                    fontFamily = Inter,
                )
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.x_cancel), fontFamily = Inter) } },
    )
}
