package app.gotcha.android.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

private val Context.chatLangDataStore by preferencesDataStore("gotcha_chat_lang")

object ChatLangs {
    @Volatile
    private var enabled: List<String> = listOf("EN", "RU", "UZ")

    val PAIR: List<String>
        get() = enabled

    fun setEnabled(codes: Collection<String>) {
        val next = codes.map { normalize(it) }.filter { it.isNotBlank() }.distinct()
        if (next.isNotEmpty()) enabled = next
    }

    fun normalize(code: String?): String =
        (code ?: "en").uppercase(Locale.US).take(2).ifBlank { "EN" }

    fun apiCode(code: String?): String = normalize(code).lowercase(Locale.US)

    fun others(selected: String): List<String> {
        val code = normalize(selected)
        return PAIR.filter { it != code }
    }

    /** Learning / To: peer native if different, else remaining target / conversation lang. */
    fun learningTarget(native: String?, peerNative: String?, remaining: String?): String =
        learningLang(native, peerNative, remaining, remaining)

    fun learningLang(
        native: String?,
        peerNative: String?,
        primaryTarget: String?,
        conversationLang: String?,
    ): String {
        val mine = normalize(native)
        return listOfNotNull(peerNative, primaryTarget, conversationLang, "ru", "uz", "en")
            .map(::normalize)
            .firstOrNull { it in PAIR && it != mine }
            ?: others(mine).first()
    }

    fun coerceTo(native: String, selected: String?): String {
        val options = others(native)
        val code = selected?.let(::normalize)
        return if (code != null && code in options) code else options.first()
    }

    fun detect(text: String): String? {
        val letters = text.filter { it.isLetter() }
        if (letters.isEmpty()) return null
        val allowed = PAIR.toSet()
        fun pick(code: String) = code.takeIf { it in allowed }
        if (letters.any { it in '\u3040'..'\u30FF' }) return pick("JA") ?: pick("EN")
        if (letters.any { it in '\uAC00'..'\uD7AF' }) return pick("KO") ?: pick("EN")
        if (letters.any { it in '\u4E00'..'\u9FFF' }) return pick("ZH") ?: pick("JA") ?: pick("EN")
        if (letters.any { it in '\u0600'..'\u06FF' }) return pick("AR") ?: pick("FA") ?: pick("UR")
        if (letters.any { it in '\u0590'..'\u05FF' }) return pick("HE")
        if (letters.any { it in '\u0E00'..'\u0E7F' }) return pick("TH")
        if (letters.any { it in '\u0900'..'\u097F' }) return pick("HI")
        val cyr = letters.count { it in '\u0400'..'\u04FF' }
        if (cyr * 4 >= letters.length) {
            if (letters.any { it in "іїєґІЇЄҐ" }) return pick("UK") ?: pick("RU")
            return pick("RU") ?: pick("UK") ?: pick("UZ") ?: pick("EN")
        }
        val lower = text.lowercase(Locale.getDefault())
        if (Regex("o['ʻʼ‘’]|g['ʻʼ‘’]|[ʻʼ]|oʻ|gʻ").containsMatchIn(lower)) return pick("UZ") ?: pick("EN")
        val tokens = Regex("[\\p{L}']+").findAll(lower).map { it.value }.toList()
        val uzHits = tokens.count { it in UZ_HINTS }
        val enHits = tokens.count { it in EN_HINTS }
        if (uzHits > 0 && uzHits >= enHits) return pick("UZ")
        if (enHits > 0) return pick("EN")
        return null
    }

    /** Composer chip is native. Treat typed text as native unless it is clearly the To language. */
    fun inferComposerSource(text: String, nativeLang: String, toLang: String): String {
        val native = normalize(nativeLang)
        val to = normalize(toLang)
        val detected = detect(text)
        if (detected == to && to != native) return to
        if (detected == native) return native
        return native
    }

    fun sameText(a: String?, b: String?): Boolean {
        if (a.isNullOrBlank() || b.isNullOrBlank()) return false
        return a.trim().replace(Regex("\\s+"), " ")
            .equals(b.trim().replace(Regex("\\s+"), " "), ignoreCase = true)
    }

    private val UZ_HINTS = hashSetOf(
        "salom", "rahmat", "yaxshi", "qanday", "nima", "nega", "qayerda", "qaysi", "qachon",
        "bugun", "kecha", "vaqt", "soat", "tuman", "tumani", "viloyat", "viloyati",
        "kitob", "dost", "do'st", "ha", "yoq", "yo'q", "men", "sen", "biz", "ular",
        "kerak", "mumkin", "iltimos", "kechirasiz",
    )
    private val EN_HINTS = hashSetOf(
        "the", "is", "are", "you", "hello", "hi", "hey", "thanks", "and", "this", "that", "have",
        "what", "which", "when", "where", "how", "with", "from", "your", "just", "today",
    )
}

/**
 * Translation cache (hash-only — never store or log message bodies)
 * plus persisted per-conversation To language.
 */
class ChatLangStore(private val context: Context) {
    private val translations = ConcurrentHashMap<String, String>()

    fun cachedTranslation(text: String, sourceLang: String, targetLang: String): String? {
        val src = ChatLangs.normalize(sourceLang)
        val dst = ChatLangs.normalize(targetLang)
        if (src == dst) return text
        return translations[trKey(text, src, dst)]
    }

    fun rememberTranslation(text: String, sourceLang: String, targetLang: String, translation: String) {
        val src = ChatLangs.normalize(sourceLang)
        val dst = ChatLangs.normalize(targetLang)
        if (src == dst || translation.isBlank() || ChatLangs.sameText(text, translation)) return
        translations[trKey(text, src, dst)] = translation
    }

    suspend fun savedToLang(conversationId: String): String? {
        val key = stringPreferencesKey(toPrefKey(conversationId))
        return context.chatLangDataStore.data.first()[key]?.let { ChatLangs.normalize(it) }
    }

    suspend fun saveToLang(conversationId: String, lang: String) {
        val code = ChatLangs.normalize(lang)
        if (code !in ChatLangs.PAIR) return
        val key = stringPreferencesKey(toPrefKey(conversationId))
        context.chatLangDataStore.edit { it[key] = code }
    }

    private fun toPrefKey(conversationId: String): String =
        "to_${conversationId.replace(Regex("[^A-Za-z0-9._-]"), "_")}"

    private fun trKey(text: String, src: String, dst: String): String =
        "$src|$dst|${text.length}|${text.hashCode()}"
}
