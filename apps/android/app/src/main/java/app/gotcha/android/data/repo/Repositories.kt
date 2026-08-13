package app.gotcha.android.data.repo

import app.gotcha.android.data.TokenStore
import app.gotcha.android.data.api.GotchaApi
import app.gotcha.android.data.model.AdminAdjustTierRequest
import app.gotcha.android.data.model.AdminCreateCampaignRequest
import app.gotcha.android.data.model.AdminCreateContentRequest
import app.gotcha.android.data.model.AdminDashboard
import app.gotcha.android.data.model.AdminUpdateCampaignRequest
import app.gotcha.android.data.model.AdminUpdateUserRequest
import app.gotcha.android.data.model.AdminUsersResponse
import app.gotcha.android.data.model.AuthResponse
import app.gotcha.android.data.model.AuthUser
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.ContentListResponse
import app.gotcha.android.data.model.ContentStats
import app.gotcha.android.data.model.FeedResponse
import app.gotcha.android.data.model.ImportApplyRequest
import app.gotcha.android.data.model.ImportCheckoutRequest
import app.gotcha.android.data.model.ImportPasteRequest
import app.gotcha.android.data.model.ImportPreApplyRequest
import app.gotcha.android.data.model.ImportPricingResponse
import app.gotcha.android.data.model.UpdateImportFreeLimitsRequest
import app.gotcha.android.data.model.UpdateImportPageTierRequest
import app.gotcha.android.data.model.UpdateImportPricingRulesRequest
import app.gotcha.android.data.model.ImportQuoteRequest
import app.gotcha.android.data.model.ImportUrlRequest
import app.gotcha.android.data.model.ImportsListResponse
import app.gotcha.android.data.model.LoginRequest
import app.gotcha.android.data.model.LookupRequest
import app.gotcha.android.data.model.LookupResponse
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.RegisterRequest
import app.gotcha.android.data.model.ReviewVocabularyRequest
import app.gotcha.android.data.model.SaveVocabularyRequest
import app.gotcha.android.data.model.SegmentsResponse
import app.gotcha.android.data.model.UpdatePreferencesRequest
import app.gotcha.android.data.model.UpdateProfileRequest
import app.gotcha.android.data.model.UpdateProgressRequest
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.data.model.UserPreferences
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import kotlinx.serialization.json.Json

class AuthRepository(
    private val api: GotchaApi,
    private val tokenStore: TokenStore,
    private val json: Json,
) {
    suspend fun login(email: String, password: String): AuthResponse {
        val res = api.login(LoginRequest(email = email, password = password))
        persist(res)
        return res
    }

    suspend fun register(
        email: String,
        password: String,
        displayName: String?,
    ): AuthResponse {
        val res = api.register(
            RegisterRequest(
                email = email,
                password = password,
                displayName = displayName,
                nativeLanguage = "en",
                targetLanguages = listOf("en"),
            ),
        )
        persist(res)
        return res
    }

    suspend fun logout() = tokenStore.clear()

    suspend fun sessionUser(): AuthUser? =
        tokenStore.userJson()?.let { json.decodeFromString(AuthUser.serializer(), it) }

    suspend fun isLoggedIn(): Boolean = !tokenStore.accessToken().isNullOrBlank()

    suspend fun isAdmin(): Boolean = tokenStore.isAdmin()

    private suspend fun persist(res: AuthResponse) {
        tokenStore.saveSession(
            access = res.accessToken,
            refresh = res.refreshToken,
            userJson = json.encodeToString(AuthUser.serializer(), res.user),
            isAdmin = res.isAdmin,
        )
    }
}

class ContentRepository(private val api: GotchaApi) {
    suspend fun feed(): FeedResponse = api.feed()
    suspend fun list(q: String? = null, type: String? = null): ContentListResponse =
        api.contentList(q = q, type = type, pageSize = 40)
    suspend fun get(id: String): ContentItem = api.content(id)
    suspend fun segments(id: String): SegmentsResponse = api.segments(id)
    suspend fun lookup(req: LookupRequest): LookupResponse = api.lookup(req)
    suspend fun updateProgress(id: String, pct: Double, segmentId: String?) =
        api.updateProgress(id, UpdateProgressRequest(segmentId = segmentId, progressPct = pct))
}

class VocabRepository(private val api: GotchaApi) {
    suspend fun list(sort: String = "recent"): List<VocabItem> = api.vocabulary(sort)
    suspend fun reviewQueue(limit: Int = 50): List<VocabItem> = api.reviewQueue(limit)
    suspend fun review(id: String, rating: String): VocabItem =
        api.reviewVocabulary(id, ReviewVocabularyRequest(rating.lowercase()))
    suspend fun save(req: SaveVocabularyRequest): VocabItem = api.saveVocabulary(req)
    suspend fun delete(id: String) = api.deleteVocabulary(id)
}

class ImportRepository(private val api: GotchaApi) {
    suspend fun list(): ImportsListResponse = api.imports()
    suspend fun paste(title: String, text: String, language: String?, paymentId: String? = null): UserImport =
        api.importPaste(ImportPasteRequest(title, text, language, paymentId))
    suspend fun url(url: String, title: String?, language: String?, paymentId: String? = null): UserImport =
        api.importUrl(ImportUrlRequest(title, url, language, paymentId))
    suspend fun quote(
        importType: String,
        contentFormat: String? = null,
        textLength: Int? = null,
        wordCount: Int? = null,
        pageCount: Int? = null,
    ) = api.importQuote(
        ImportQuoteRequest(importType, contentFormat, textLength, wordCount, pageCount),
    )
    suspend fun checkout(
        importType: String,
        contentFormat: String? = null,
        textLength: Int? = null,
        wordCount: Int? = null,
        pageCount: Int? = null,
    ) = api.importCheckout(
        ImportCheckoutRequest(importType, contentFormat, textLength, wordCount, pageCount, "android"),
    )
    suspend fun paymentStatus(id: String) = api.importPayment(id)
    suspend fun preApply(paymentId: String, cardNumber: String, expiry: String) =
        api.importPreApply(paymentId, ImportPreApplyRequest(cardNumber, expiry))
    suspend fun apply(paymentId: String, otp: String) =
        api.importApply(paymentId, ImportApplyRequest(otp))
    suspend fun retryOtp(paymentId: String) = api.importRetryOtp(paymentId)
}

class MessagingRepository(private val api: GotchaApi) {
    suspend fun conversations(q: String? = null) = api.messagingConversations(q)
    suspend fun conversation(id: String) = api.messagingConversation(id)
    suspend fun start(peerUserId: String, contentId: String? = null, language: String? = null) =
        api.messagingStart(
            app.gotcha.android.data.model.StartConversationRequest(
                peerUserId = peerUserId,
                contentId = contentId,
                language = language,
            ),
        )
    suspend fun send(conversationId: String, body: String, translation: String? = null) =
        api.messagingSend(
            conversationId,
            app.gotcha.android.data.model.SendMessageRequest(body = body, translation = translation),
        )

    suspend fun sendAndReload(conversationId: String, body: String): app.gotcha.android.data.model.ConversationDetail {
        send(conversationId, body.trim())
        return conversation(conversationId)
    }
    suspend fun markRead(conversationId: String) = api.messagingMarkRead(conversationId)
    suspend fun suggestions() = api.messagingSuggestions()
    suspend fun learners(q: String? = null, lang: String? = null, sameReadings: Boolean? = null) =
        api.messagingLearners(q, lang, sameReadings)
    suspend fun peer(id: String) = api.messagingPeer(id)
}

class UserRepository(private val api: GotchaApi) {
    suspend fun me(): MeResponse = api.me()
    suspend fun stats(): UserStats = api.stats()
    suspend fun updateProfile(
        displayName: String? = null,
        uiLanguage: String? = null,
        nativeLanguage: String? = null,
    ): AuthUser =
        api.updateProfile(
            UpdateProfileRequest(
                displayName = displayName,
                uiLanguage = uiLanguage,
                nativeLanguage = nativeLanguage,
            ),
        )
    suspend fun updatePreferences(
        dailyGoalMinutes: Int? = null,
        notificationsEnabled: Boolean? = null,
        readerFontScale: Double? = null,
        readerTheme: String? = null,
        readerLineSpacing: Double? = null,
        showKnownWords: Boolean? = null,
        ttsEnabled: Boolean? = null,
    ): UserPreferences =
        api.updatePreferences(
            UpdatePreferencesRequest(
                dailyGoalMinutes = dailyGoalMinutes,
                notificationsEnabled = notificationsEnabled,
                readerFontScale = readerFontScale,
                readerTheme = readerTheme,
                readerLineSpacing = readerLineSpacing,
                showKnownWords = showKnownWords,
                ttsEnabled = ttsEnabled,
            ),
        )
}

class AdminRepository(private val api: GotchaApi) {
    suspend fun me() = api.adminMe()
    suspend fun dashboard(): AdminDashboard = api.adminDashboard()
    suspend fun users(
        q: String? = null,
        tier: String? = null,
        status: String? = null,
    ): AdminUsersResponse = api.adminUsers(q, tier, status)
    suspend fun user(id: String) = api.adminUser(id)
    suspend fun updateUser(
        id: String,
        deleted: Boolean? = null,
        displayName: String? = null,
        tier: String? = null,
    ) = api.adminUpdateUser(id, AdminUpdateUserRequest(displayName, deleted, tier))
    suspend fun resetUserPassword(id: String) = api.adminResetUserPassword(id)
    suspend fun adjustUserTier(id: String, tier: String) =
        api.adminAdjustUserTier(id, AdminAdjustTierRequest(tier))
    suspend fun hardDeleteUser(id: String) = api.adminHardDeleteUser(id)
    suspend fun content(): List<ContentItem> = api.adminContent()
    suspend fun contentStats(): ContentStats = api.adminContentStats()
    suspend fun createContent(body: AdminCreateContentRequest): ContentItem = api.adminCreateContent(body)
    suspend fun publishContent(id: String): ContentItem = api.adminPublishContent(id)
    suspend fun archiveContent(id: String): ContentItem = api.adminArchiveContent(id)
    suspend fun importPricing(): ImportPricingResponse = api.importPricing()
    suspend fun updateImportPricingRules(body: UpdateImportPricingRulesRequest) = api.updateImportPricingRules(body)
    suspend fun updateImportPageTier(id: String, body: UpdateImportPageTierRequest) = api.updateImportPageTier(id, body)
    suspend fun updateImportFreeLimits(body: UpdateImportFreeLimitsRequest) = api.updateImportFreeLimits(body)
    suspend fun analytics(range: String = "7d") = api.adminAnalytics(range)
    suspend fun support() = api.adminSupport()
    suspend fun languages() = api.adminLanguages()
    suspend fun updateLanguage(code: String, isEnabled: Boolean) =
        api.adminUpdateLanguage(
            code,
            app.gotcha.android.data.model.AdminUpdateLanguageRequest(
                isEnabled = isEnabled,
                status = if (isEnabled) "Active" else "Draft",
            ),
        )
    suspend fun gamification() = api.adminGamification()
    suspend fun notifications() = api.adminNotifications()
    suspend fun createCampaign(body: AdminCreateCampaignRequest) = api.adminCreateCampaign(body)
    suspend fun updateCampaign(id: String, body: AdminUpdateCampaignRequest) = api.adminUpdateCampaign(id, body)
    suspend fun levelTests() = api.adminLevelTests()
    suspend fun aiUsage(range: String = "today") = api.adminAiUsage(range)
    suspend fun settings() = api.adminSettings()
    suspend fun updateSettings(body: app.gotcha.android.data.model.AdminUpdateSettingsRequest) =
        api.adminUpdateSettings(body)
}
