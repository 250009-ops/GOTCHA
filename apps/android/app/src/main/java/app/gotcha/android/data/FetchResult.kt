package app.gotcha.android.data

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/** API payload plus whether it was served from local cache after a network failure. */
data class FetchResult<T>(
    val data: T,
    val isStale: Boolean = false,
)

suspend fun <T> readCachedJson(
    json: Json,
    cacheKey: String,
    readCache: suspend (String) -> String?,
    serializer: KSerializer<T>,
): FetchResult<T>? {
    val cached = readCache(cacheKey)?.let {
        runCatching { json.decodeFromString(serializer, it) }.getOrNull()
    } ?: return null
    return FetchResult(cached, isStale = true)
}

suspend fun <T> fetchWithCache(
    json: Json,
    cacheKey: String,
    readCache: suspend (String) -> String?,
    writeCache: suspend (String, String) -> Unit,
    fetch: suspend () -> T,
    serializer: KSerializer<T>,
    shouldCache: (T) -> Boolean = { true },
): FetchResult<T> {
    return try {
        val result = fetch()
        if (shouldCache(result)) {
            runCatching { writeCache(cacheKey, json.encodeToString(serializer, result)) }
        }
        FetchResult(result, isStale = false)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        readCachedJson(json, cacheKey, readCache, serializer) ?: throw e
    }
}
