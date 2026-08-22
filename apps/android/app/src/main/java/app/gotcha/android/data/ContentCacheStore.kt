package app.gotcha.android.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.io.File

private val Context.contentCacheDataStore by preferencesDataStore("gotcha_content_cache")

/**
 * Persists last-good JSON snapshots for offline stale-while-revalidate.
 *
 * Book segments are too large for a single DataStore Preferences file (every peek
 * would load every cached book). Each key is a file under filesDir; DataStore is
 * only read as a one-time fallback for older installs.
 */
class ContentCacheStore(private val context: Context) {
    private val dir: File
        get() = File(context.filesDir, "content_cache").apply { mkdirs() }

    suspend fun get(key: String): String? = withContext(Dispatchers.IO) {
        val file = fileFor(key)
        if (file.exists()) {
            runCatching { file.readText() }.getOrNull()?.takeIf { it.isNotBlank() }
                ?: return@withContext null
        } else {
            val prefKey = stringPreferencesKey(key)
            context.contentCacheDataStore.data.first()[prefKey]?.also { legacy ->
                runCatching { atomicWrite(file, legacy) }
            }
        }
    }

    suspend fun put(key: String, json: String) = withContext(Dispatchers.IO) {
        if (json.isBlank()) return@withContext
        atomicWrite(fileFor(key), json)
        runCatching {
            context.contentCacheDataStore.edit { it.remove(stringPreferencesKey(key)) }
        }
    }

    /** Wipe cached learner data when switching accounts or signing out. */
    suspend fun clearAll() = withContext(Dispatchers.IO) {
        dir.listFiles()?.forEach { it.delete() }
        runCatching { context.contentCacheDataStore.edit { it.clear() } }
    }

    private fun fileFor(key: String): File {
        val safe = key.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return File(dir, "$safe.json")
    }

    private fun atomicWrite(file: File, json: String) {
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(file)) {
            file.writeText(json)
            tmp.delete()
        }
    }
}
