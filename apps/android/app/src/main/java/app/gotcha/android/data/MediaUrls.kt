package app.gotcha.android.data

import app.gotcha.android.BuildConfig

private val LOCAL_OR_LAN_ORIGIN = Regex(
    """^https?://(?:10\.0\.2\.2|127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?""",
    RegexOption.IGNORE_CASE,
)

/**
 * Resolves cover/avatar URLs against the production host. Relative keys and leftover
 * localhost / emulator / LAN hosts are rewritten to https://gotchaa.uz. Cleartext
 * http:// is upgraded to https so release network security never attempts HTTP.
 */
fun resolveMediaUrl(raw: String?): String? {
    val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val origin = productionOrigin()
    val rewritten = LOCAL_OR_LAN_ORIGIN.replace(value, origin)
    return when {
        rewritten.startsWith("https://", ignoreCase = true) -> rewritten
        rewritten.startsWith("http://", ignoreCase = true) ->
            "https://${rewritten.substring(7)}"
        rewritten.startsWith("/") -> "$origin$rewritten"
        else -> "$origin/$rewritten"
    }
}

fun productionOrigin(): String {
    val base = BuildConfig.API_BASE_URL.trim()
    val cut = base.indexOf("/api/")
    val origin = if (cut > 0) base.substring(0, cut) else base.trimEnd('/')
    val normalized = origin.trimEnd('/').ifBlank { "https://gotchaa.uz" }
    return if (normalized.startsWith("http://", ignoreCase = true)) {
        "https://${normalized.substring(7)}"
    } else {
        normalized
    }
}
