package app.gotcha.android.debug

import android.content.Intent
import android.net.Uri
import android.util.Log
import app.gotcha.android.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** On-screen trace for Telegram / share → import → reader (debug builds only). */
object ExternalImportDebug {
    private const val TAG = "ExtImportDbg"
    private const val MAX_LINES = 48

    private val _lines = MutableStateFlow<List<String>>(emptyList())
    val lines = _lines.asStateFlow()

    /** Off by default — set true temporarily when diagnosing Telegram imports. */
    var showOverlay: Boolean = false

    fun clear() {
        _lines.value = emptyList()
    }

    fun log(step: String, detail: String) {
        if (!BuildConfig.DEBUG) return
        val ts = (System.currentTimeMillis() % 100_000L).toString().padStart(5, '0')
        val line = "$ts [$step] $detail"
        Log.d(TAG, line)
        _lines.update { current -> (current + line).takeLast(MAX_LINES) }
    }

    fun logIntent(step: String, intent: Intent?) {
        if (!BuildConfig.DEBUG) return
        if (intent == null) {
            log(step, "intent=null")
            return
        }
        log(step, "action=${intent.action} type=${intent.type} flags=0x${intent.flags.toString(16)}")
        log(step, "data=${intent.data}")
        val clip = intent.clipData
        if (clip == null) {
            log(step, "clipData=null")
        } else {
            log(step, "clipCount=${clip.itemCount}")
            for (i in 0 until clip.itemCount.coerceAtMost(3)) {
                log(step, "clip[$i]=${clip.getItemAt(i).uri}")
            }
        }
        val stream = readStreamExtra(intent)
        log(step, "EXTRA_STREAM=$stream")
        val extraKeys = intent.extras?.keySet()?.joinToString(",") ?: "(none)"
        log(step, "extrasKeys=$extraKeys")
    }

    fun readStreamExtra(intent: Intent): Uri? {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
    }
}
