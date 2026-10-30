package app.gotcha.android

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import app.gotcha.android.debug.ExternalImportDebug

/**
 * Invisible entry for Telegram / system "Open with" intents.
 * Forwards to the running [MainActivity] instead of spawning a second task/window in recents.
 */
class ImportTrampolineActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ExternalImportDebug.log("TRAMP", "onCreate")
        ExternalImportDebug.logIntent("TRAMP", intent)
        forwardToMain()
        finish()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        ExternalImportDebug.log("TRAMP", "onNewIntent")
        ExternalImportDebug.logIntent("TRAMP", intent)
        setIntent(intent)
        forwardToMain()
        finish()
    }

    private fun forwardToMain() {
        val incoming = intent ?: return
        val streamUri = readStreamUri(incoming)
        val clipUri = incoming.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
        val resolvedUri = incoming.data ?: clipUri ?: streamUri
        ExternalImportDebug.log("TRAMP", "forward uri=$resolvedUri (data=${incoming.data} clip=$clipUri stream=$streamUri)")
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                action = incoming.action
                type = incoming.type
                incoming.extras?.let { putExtras(it) }
                if (resolvedUri != null) {
                    data = resolvedUri
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    clipData = android.content.ClipData.newRawUri("", resolvedUri)
                } else {
                    incoming.clipData?.let { clipData = it }
                }
                addFlags(
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            },
        )
        ExternalImportDebug.log("TRAMP", "forwarded to MainActivity")
    }

    private fun readStreamUri(intent: Intent): Uri? =
        ExternalImportDebug.readStreamExtra(intent)
}
