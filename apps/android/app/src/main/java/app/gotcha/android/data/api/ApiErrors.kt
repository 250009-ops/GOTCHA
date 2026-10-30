package app.gotcha.android.data.api

import app.gotcha.android.data.model.ApiErrorBody
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * NestJS error responses carry the real, user-facing message (and sometimes a machine-readable
 * `code`, e.g. `EMAIL_NOT_VERIFIED`) in the JSON body — never in [HttpException.message], which is
 * just "HTTP 401 Unauthorized". Screens that need to branch on a specific backend error (auth
 * flows especially) should read through here instead of falling back to a generic message.
 */
private val errorJson = Json { ignoreUnknownKeys = true; isLenient = true }

// Retrofit's HttpException wraps a single-use okhttp3.ResponseBody: errorBody()!!.string() reads
// and closes the underlying source, so a *second* call throws/returns empty and silently loses the
// real backend message. Screens routinely call apiErrorCode() to branch and then apiErrorMessage()
// as the fallback on the same exception (see SignUpScreen), so we cache the one-time parse per
// exception instance to keep every call after the first reading real data instead of the generic
// "HTTP 409 Conflict" style message.
private val bodyCache = java.util.Collections.synchronizedMap(java.util.WeakHashMap<HttpException, ApiErrorBody?>())

private fun HttpException.body(): ApiErrorBody? = bodyCache.getOrPut(this) {
    runCatching {
        val raw = response()?.errorBody()?.string() ?: return@runCatching null
        errorJson.decodeFromString(ApiErrorBody.serializer(), raw)
    }.getOrNull()
}

/** Machine-readable error code from the API body, if present (e.g. `EMAIL_NOT_VERIFIED`). */
fun Throwable.apiErrorCode(): String? = (this as? HttpException)?.body()?.code

/** Email associated with a structured auth error (e.g. unverified-account flows). */
fun Throwable.apiErrorEmail(): String? = (this as? HttpException)?.body()?.email

/** True when the failure is DNS, timeout, TLS, or a dropped connection — not an API business error. */
fun Throwable.isNetworkFailure(): Boolean {
    var current: Throwable? = this
    val seen = HashSet<Throwable>()
    while (current != null && seen.add(current)) {
        when (current) {
            is UnknownHostException,
            is ConnectException,
            is SocketTimeoutException,
            is NoRouteToHostException,
            is SocketException,
            is SSLException,
            -> return true
        }
        if (looksLikeNetworkFailure(current.message)) return true
        current = current.cause
    }
    return false
}

/** Detects raw OkHttp/Android host errors so UI never shows them to learners. */
fun looksLikeNetworkFailure(message: String?): Boolean {
    val m = message.orEmpty().lowercase()
    if (m.isBlank()) return false
    return listOf(
        "unable to resolve host",
        "no address associated",
        "failed to connect",
        "connection timed out",
        "network is unreachable",
        "software caused connection abort",
        "connection reset",
        "you're offline",
        "couldn't reach the server",
        "couldn't establish a secure connection",
        "check your internet",
    ).any { m.contains(it) }
}

fun Throwable.networkUserMessage(): String? {
    if (!isNetworkFailure()) return null
    val chain = generateSequence(this) { it.cause }
    return when {
        chain.any { it is SocketTimeoutException } ->
            "The connection timed out. Check your internet and try again."
        chain.any { it is SSLException } ->
            "Couldn't establish a secure connection. Try again."
        else ->
            "You're offline. Connect to the internet and try again."
    }
}

/** Interface language for messages built outside composition (set by LearnerShell). */
object ApiErrorLanguage {
    @Volatile var current: String? = null
}

/** QA N8: friendly, localized rate-limit text instead of NestJS's raw "ThrottlerException: Too Many Requests". */
fun rateLimitMessage(lang: String? = ApiErrorLanguage.current): String = when (lang?.take(2)?.lowercase()) {
    "ru" -> "Слишком много запросов. Подождите немного и попробуйте снова."
    "uz" -> "Soʻrovlar juda koʻp. Biroz kuting va qayta urinib koʻring."
    else -> "Too many requests. Please wait a moment and try again."
}

/** Human-readable message from the API body, falling back to a safe user-facing string. */
fun Throwable.apiErrorMessage(fallback: String = "Something went wrong"): String {
    networkUserMessage()?.let { return it }
    val http = this as? HttpException
    if (http?.code() == 429 || http?.body()?.code == "rate_limited") return rateLimitMessage()
    val fromBody = http?.body()?.message?.let { el ->
        runCatching {
            when {
                el is JsonArray -> el.joinToString(" ") { it.jsonPrimitive.content }
                else -> (el as? JsonPrimitive)?.content
            }
        }.getOrNull()
    }
    val raw = fromBody ?: message
    return if (looksLikeNetworkFailure(raw)) {
        "You're offline. Connect to the internet and try again."
    } else {
        raw ?: fallback
    }
}
