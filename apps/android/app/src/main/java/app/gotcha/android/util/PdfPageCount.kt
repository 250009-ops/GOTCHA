package app.gotcha.android.util

object PdfPageCount {
    private const val MAX_BILLABLE_PAGES = 4000

    /** Catalog page count from uncompressed PDF objects. Null for object streams. */
    fun count(bytes: ByteArray): Int? {
        val latin1 = bytes.toString(Charsets.ISO_8859_1)
        if (!latin1.contains("%PDF")) return null
        var maxCount = 0
        val patterns = listOf(
            Regex("""/Type\s*/Pages\b[\s\S]{0,1200}?/Count\s+(\d+)"""),
            Regex("""/Count\s+(\d+)[\s\S]{0,1200}?/Type\s*/Pages\b"""),
        )
        for (re in patterns) {
            for (match in re.findAll(latin1)) {
                val n = match.groupValues[1].toIntOrNull() ?: continue
                if (n > maxCount) maxCount = n
            }
        }
        if (maxCount > 0) return minOf(MAX_BILLABLE_PAGES, maxCount)
        val leaves = Regex("""/Type\s*/Page(?!s)\b""").findAll(latin1).count()
        return if (leaves > 0) minOf(MAX_BILLABLE_PAGES, leaves) else null
    }
}
