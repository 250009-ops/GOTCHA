package app.gotcha.android.util

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale

fun ttsLocale(lang: String?): Locale {
    val raw = (lang ?: "en").trim().lowercase(Locale.US).replace('_', '-')
    val code = raw.take(2).ifBlank { "en" }
    return when (code) {
        "en" -> Locale.US
        "zh" -> Locale.SIMPLIFIED_CHINESE
        "ja" -> Locale.JAPANESE
        "ko" -> Locale.KOREAN
        "pt" -> Locale.forLanguageTag("pt-BR")
        "ar" -> Locale.forLanguageTag("ar-SA")
        "no" -> Locale.forLanguageTag("nb-NO")
        "tl" -> Locale.forLanguageTag("fil-PH")
        else -> Locale.forLanguageTag("$code-${code.uppercase(Locale.US)}")
    }
}

fun ttsLanguageReady(engine: TextToSpeech?, lang: String?): Boolean {
    if (engine == null) return false
    return engine.isLanguageAvailable(ttsLocale(lang)) >= TextToSpeech.LANG_AVAILABLE
}

class CloudPronouncer {
    private var player: MediaPlayer? = null

    fun stop() {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
    }

    suspend fun playMp3(context: Context, bytes: ByteArray) {
        val file = File(context.cacheDir, "gotcha-tts.mp3")
        withContext(Dispatchers.IO) { file.writeBytes(bytes) }
        withContext(Dispatchers.Main) {
            stop()
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            mp.setDataSource(file.absolutePath)
            mp.setOnCompletionListener { stop() }
            mp.setOnErrorListener { _, _, _ ->
                stop()
                true
            }
            mp.prepare()
            player = mp
            mp.start()
        }
    }
}
