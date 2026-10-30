package app.gotcha.android.di



import android.content.Context

import app.gotcha.android.BuildConfig

import app.gotcha.android.data.ChatLangStore
import app.gotcha.android.data.ConnectivityObserver
import app.gotcha.android.data.ContentCacheStore
import app.gotcha.android.data.TokenStore

import app.gotcha.android.data.api.GotchaApi

import app.gotcha.android.data.model.RefreshRequest

import app.gotcha.android.data.repo.AdminRepository

import app.gotcha.android.data.repo.AuthRepository

import app.gotcha.android.data.repo.ContentRepository

import app.gotcha.android.data.repo.ImportRepository

import app.gotcha.android.data.import.ExternalImportController
import app.gotcha.android.data.import.ExternalImportRegistry

import app.gotcha.android.data.messaging.MessagingRealtimeHub

import app.gotcha.android.data.repo.MessagingRepository

import app.gotcha.android.data.repo.PracticeRepository

import app.gotcha.android.data.repo.UserRepository

import app.gotcha.android.data.repo.VocabRepository

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory

import kotlinx.coroutines.CompletableDeferred

import kotlinx.coroutines.flow.MutableSharedFlow

import kotlinx.coroutines.flow.SharedFlow

import kotlinx.coroutines.flow.asSharedFlow

import kotlinx.coroutines.runBlocking

import kotlinx.serialization.json.Json

import okhttp3.Interceptor

import okhttp3.MediaType.Companion.toMediaType

import okhttp3.OkHttpClient

import okhttp3.Request

import okhttp3.logging.HttpLoggingInterceptor

import retrofit2.Retrofit

import java.util.concurrent.TimeUnit



class AppContainer(context: Context) {

    val tokenStore = TokenStore(context.applicationContext)
    val contentCacheStore = ContentCacheStore(context.applicationContext)
    val chatLangStore = ChatLangStore(context.applicationContext)
    val connectivityObserver = ConnectivityObserver(context.applicationContext)



    private val json = Json {

        ignoreUnknownKeys = true

        isLenient = true

        explicitNulls = false

        encodeDefaults = false

        coerceInputValues = true

    }



    /** Emitted when refresh fails and the stored session is cleared. */

    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()



    private val refreshLock = Any()

    private var inFlightRefresh: CompletableDeferred<Boolean>? = null



    private val clientPlatformInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("X-GOTCHA-Client-Platform", "android")
            .build()
        chain.proceed(request)
    }

    private val authInterceptor = Interceptor { chain ->

        val request = chain.request()

        if (request.isPublicAuth()) {

            return@Interceptor chain.proceed(request)

        }

        val token = runBlocking { tokenStore.accessToken() }

        val req = if (token != null) {

            request.newBuilder()

                .header("Authorization", "Bearer $token")

                .build()

        } else {

            request

        }

        chain.proceed(req)

    }



    private val refreshInterceptor = Interceptor { chain ->

        val request = chain.request()

        val response = chain.proceed(request)

        if (response.code != 401) return@Interceptor response



        val hadAuth = request.header("Authorization") != null

        if (request.isPublicAuth() || !hadAuth) return@Interceptor response



        response.close()

        val refreshed = runBlocking { refreshTokensOnce() }

        if (!refreshed) {

            _sessionExpired.tryEmit(Unit)

            val retry = request.newBuilder().removeHeader("Authorization").build()

            return@Interceptor chain.proceed(retry)

        }

        val token = runBlocking { tokenStore.accessToken() }

        val retry = request.newBuilder()

            .header("Authorization", "Bearer $token")

            .build()

        chain.proceed(retry)

    }



    private val client = OkHttpClient.Builder()

        .connectTimeout(30, TimeUnit.SECONDS)

        .readTimeout(60, TimeUnit.SECONDS)

        .addInterceptor(clientPlatformInterceptor)
        .addInterceptor(authInterceptor)

        .addInterceptor(refreshInterceptor)

        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BASIC
                        redactHeader("Authorization")
                    },
                )
            }
        }

        .build()



    private val retrofit = Retrofit.Builder()

        .baseUrl(BuildConfig.API_BASE_URL)

        .client(client)

        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))

        .build()



    val api: GotchaApi = retrofit.create(GotchaApi::class.java)



    /** Bare client for refresh to avoid interceptor loops. */

    private val bareApi: GotchaApi = Retrofit.Builder()

        .baseUrl(BuildConfig.API_BASE_URL)

        .client(

            OkHttpClient.Builder()

                .connectTimeout(30, TimeUnit.SECONDS)

                .build(),

        )

        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))

        .build()

        .create(GotchaApi::class.java)



    /**

     * Deduplicate concurrent refresh attempts (backend rotates refresh tokens on use).

     * Mirrors web-learner's single-flight refresh in api.ts.

     */

    private suspend fun refreshTokensOnce(): Boolean {

        val (deferred, isLeader) = synchronized(refreshLock) {

            val existing = inFlightRefresh

            if (existing != null) {

                Pair(existing, false)

            } else {

                Pair(CompletableDeferred<Boolean>().also { inFlightRefresh = it }, true)

            }

        }

        if (!isLeader) return deferred.await()



        val result = refreshTokensInternal()

        synchronized(refreshLock) {

            inFlightRefresh = null

        }

        deferred.complete(result)

        return result

    }



    private suspend fun refreshTokensInternal(): Boolean {

        val refresh = tokenStore.refreshToken() ?: return false

        return try {

            val res = bareApi.refresh(RefreshRequest(refresh))

            tokenStore.saveSession(

                access = res.accessToken,

                refresh = res.refreshToken,

                userJson = json.encodeToString(app.gotcha.android.data.model.AuthUser.serializer(), res.user),

                isAdmin = res.isAdmin,

            )

            true

        } catch (_: Exception) {

            tokenStore.clear()

            false

        }

    }



    val authRepository = AuthRepository(api, tokenStore, json)

    val contentRepository = ContentRepository(api, contentCacheStore, json)

    val vocabRepository = VocabRepository(api, contentCacheStore, json)

    val playBilling = app.gotcha.android.data.billing.PlayBilling(context.applicationContext, api)

    val importRepository = ImportRepository(api, playBilling)

    val externalImportRegistry = ExternalImportRegistry(context.applicationContext)

    val externalImportController = ExternalImportController(
        importRepository,
        contentRepository,
        externalImportRegistry,
    )

    val userRepository = UserRepository(api, contentCacheStore, json)

    val messagingRepository = MessagingRepository(api, contentCacheStore, json)

    val messagingRealtime = MessagingRealtimeHub(

        apiBaseUrl = BuildConfig.API_BASE_URL,

        tokenStore = tokenStore,

        messagingRepository = messagingRepository,

        json = json,

    )

    val adminRepository = AdminRepository(api)

    val practiceRepository = PracticeRepository(api)

    /** Clears tokens, cached learner data, and live messaging when signing out or switching accounts. */
    suspend fun endSession() {
        messagingRealtime.stop()
        externalImportController.reset()
        tokenStore.clear()
        contentCacheStore.clearAll()
    }

    private companion object {

        private val PUBLIC_AUTH_SUFFIXES = setOf(

            "/auth/login",

            "/auth/register",

            "/auth/refresh",

            "/auth/forgot-password",

            "/auth/resend-verification",

            "/auth/verify-email",

            "/auth/reset-password",

        )



        private fun Request.isPublicAuth(): Boolean {

            val path = url.encodedPath.trimEnd('/')

            return PUBLIC_AUTH_SUFFIXES.any { path.endsWith(it) }

        }

    }

}


