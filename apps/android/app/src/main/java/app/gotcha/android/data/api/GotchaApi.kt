package app.gotcha.android.data.api

import app.gotcha.android.data.model.AdminAiUsageResponse
import app.gotcha.android.data.model.AdminAnalytics
import app.gotcha.android.data.model.AdminAddLanguageRequest
import app.gotcha.android.data.model.AdminCampaign
import app.gotcha.android.data.model.CatalogLanguage
import app.gotcha.android.data.model.AdminCreateCampaignRequest
import app.gotcha.android.data.model.AdminCreateContentRequest
import app.gotcha.android.data.model.AdminDashboard
import app.gotcha.android.data.model.AdminAchievement
import app.gotcha.android.data.model.AdminGamificationResponse
import app.gotcha.android.data.model.AdminLanguage
import app.gotcha.android.data.model.AdminUpdateAchievementRequest
import app.gotcha.android.data.model.AdminLanguagesResponse
import app.gotcha.android.data.model.AdminLevelTestsResponse
import app.gotcha.android.data.model.AdminMe
import app.gotcha.android.data.model.AdminNotificationsResponse
import app.gotcha.android.data.model.AdminSettings
import app.gotcha.android.data.model.AdminSupportResponse
import app.gotcha.android.data.model.AdminUpdateLanguageRequest
import app.gotcha.android.data.model.AdminUpdateSettingsRequest
import app.gotcha.android.data.model.AdminUpdateCampaignRequest
import app.gotcha.android.data.model.AdminAdjustTierRequest
import app.gotcha.android.data.model.AdminHardDeleteResponse
import app.gotcha.android.data.model.AdminResetPasswordResponse
import app.gotcha.android.data.model.AdminUpdateUserRequest
import app.gotcha.android.data.model.AdminUserRow
import app.gotcha.android.data.model.AdminUsersResponse
import app.gotcha.android.data.model.AuthResponse
import app.gotcha.android.data.model.AuthUser
import app.gotcha.android.data.model.ChangePasswordRequest
import app.gotcha.android.data.model.DeleteAccountRequest
import app.gotcha.android.data.model.ForgotPasswordRequest
import app.gotcha.android.data.model.OkMessageResponse
import app.gotcha.android.data.model.PracticeResultResponse
import app.gotcha.android.data.model.PracticeSession
import app.gotcha.android.data.model.RegisterResponse
import app.gotcha.android.data.model.ResendVerificationRequest
import app.gotcha.android.data.model.ResetPasswordRequest
import app.gotcha.android.data.model.ResetPasswordResponse
import app.gotcha.android.data.model.VerifyEmailResponse
import app.gotcha.android.data.model.StartPracticeRequest
import app.gotcha.android.data.model.SubmitPracticeRequest
import app.gotcha.android.data.model.ChatMessageDto
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.ContentListResponse
import app.gotcha.android.data.model.ContentStats
import app.gotcha.android.data.model.ConversationDetail
import app.gotcha.android.data.model.ConversationStatusDto
import app.gotcha.android.data.model.ConversationSummary
import app.gotcha.android.data.model.TypingRequest
import app.gotcha.android.data.model.FeedResponse
import app.gotcha.android.data.model.MessagingOkResponse
import app.gotcha.android.data.model.MessagingPeer
import app.gotcha.android.data.model.EditMessageRequest
import app.gotcha.android.data.model.SendMessageRequest
import app.gotcha.android.data.model.StartConversationRequest
import app.gotcha.android.data.model.ImportApplyRequest
import app.gotcha.android.data.model.ImportApplyResponse
import app.gotcha.android.data.model.ImportCancelRequest
import app.gotcha.android.data.model.ImportCancelResponse
import app.gotcha.android.data.model.CatalogCheckoutResponse
import app.gotcha.android.data.model.ImportCheckoutRequest
import app.gotcha.android.data.model.ImportCheckoutResponse
import app.gotcha.android.data.model.ImportPasteRequest
import app.gotcha.android.data.model.ImportPaymentStatus
import app.gotcha.android.data.model.ImportPreApplyRequest
import app.gotcha.android.data.model.ImportPreApplyResponse
import app.gotcha.android.data.model.ImportPricingResponse
import app.gotcha.android.data.model.ImportFreeLimits
import app.gotcha.android.data.model.ImportPageTier
import app.gotcha.android.data.model.UpdateImportFreeLimitsRequest
import app.gotcha.android.data.model.UpdateImportPageTierRequest
import app.gotcha.android.data.model.UpdateImportPricingRulesRequest
import app.gotcha.android.data.model.ImportQuoteRequest
import app.gotcha.android.data.model.ImportQuoteResponse
import app.gotcha.android.data.model.ImportUrlRequest
import app.gotcha.android.data.model.ImportsListResponse
import app.gotcha.android.data.model.LoginRequest
import app.gotcha.android.data.model.KnownWord
import app.gotcha.android.data.model.LookupRequest
import app.gotcha.android.data.model.LookupResponse
import app.gotcha.android.data.model.TranslateRequest
import app.gotcha.android.data.model.TranslateResponse
import app.gotcha.android.data.model.MarkKnownWordRequest
import app.gotcha.android.data.model.UpdateVocabularyRequest
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.NotificationReadResponse
import app.gotcha.android.data.model.NotificationsInboxResponse
import app.gotcha.android.data.model.RefreshRequest
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
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface GotchaApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): RegisterResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): AuthResponse

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequest): OkMessageResponse

    @POST("auth/resend-verification")
    suspend fun resendVerification(@Body body: ResendVerificationRequest): OkMessageResponse

    @GET("auth/verify-email")
    suspend fun verifyEmail(@Query("token") token: String): VerifyEmailResponse

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): ResetPasswordResponse

    @GET("content/feed")
    suspend fun feed(@Query("targetLang") targetLang: String? = null): FeedResponse

    @GET("content/languages")
    suspend fun catalogLanguages(): List<CatalogLanguage>

    @GET("content")
    suspend fun contentList(
        @Query("q") q: String? = null,
        @Query("type") type: String? = null,
        @Query("lang") lang: String? = null,
        @Query("level") level: String? = null,
        @Query("page") page: Int? = null,
        @Query("pageSize") pageSize: Int? = null,
    ): ContentListResponse

    @GET("content/{id}")
    suspend fun content(@Path("id") id: String): ContentItem

    @GET("content/{id}/segments")
    suspend fun segments(
        @Path("id") id: String,
        @Query("from") from: Int? = 0,
        @Query("limit") limit: Int? = 500,
    ): SegmentsResponse

    @PUT("content/{id}/progress")
    suspend fun updateProgress(
        @Path("id") id: String,
        @Body body: UpdateProgressRequest,
    ): ContentItem

    @POST("ai/lookup")
    suspend fun lookup(@Body body: LookupRequest): LookupResponse

    @POST("ai/translate")
    suspend fun translate(@Body body: TranslateRequest): TranslateResponse

    @GET("reading/known-words")
    suspend fun knownWords(): List<KnownWord>

    @PUT("reading/known-words")
    suspend fun markKnownWord(@Body body: MarkKnownWordRequest): KnownWord

    @GET("vocabulary")
    suspend fun vocabulary(@Query("sort") sort: String? = "recent"): List<VocabItem>

    @GET("vocabulary/review-queue")
    suspend fun reviewQueue(@Query("limit") limit: Int? = 20): List<VocabItem>

    @POST("vocabulary")
    suspend fun saveVocabulary(@Body body: SaveVocabularyRequest): VocabItem

    @POST("vocabulary/{id}/review")
    suspend fun reviewVocabulary(
        @Path("id") id: String,
        @Body body: ReviewVocabularyRequest,
    ): VocabItem

    @DELETE("vocabulary/{id}")
    suspend fun deleteVocabulary(@Path("id") id: String)

    @PATCH("vocabulary/{id}")
    suspend fun updateVocabulary(
        @Path("id") id: String,
        @Body body: UpdateVocabularyRequest,
    ): VocabItem

    @GET("imports")
    suspend fun imports(
        @Query("page") page: Int? = 1,
        @Query("pageSize") pageSize: Int? = 20,
    ): ImportsListResponse

    @POST("imports/paste")
    suspend fun importPaste(@Body body: ImportPasteRequest): UserImport

    @POST("imports/url")
    suspend fun importUrl(@Body body: ImportUrlRequest): UserImport

    @DELETE("imports/{id}")
    suspend fun deleteImport(@Path("id") id: String)

    @Multipart
    @POST("imports/file")
    suspend fun importFile(
        @Part file: MultipartBody.Part,
        @Part("title") title: RequestBody?,
        @Part("language") language: RequestBody?,
        @Part("paymentId") paymentId: RequestBody?,
    ): UserImport

    @POST("billing/imports/quote")
    suspend fun importQuote(@Body body: ImportQuoteRequest): ImportQuoteResponse

    @POST("billing/imports/checkout")
    suspend fun importCheckout(@Body body: ImportCheckoutRequest): ImportCheckoutResponse

    @POST("billing/content/{id}/checkout")
    suspend fun catalogCheckout(@Path("id") id: String): CatalogCheckoutResponse

    @GET("billing/imports/payments/{id}")
    suspend fun importPayment(@Path("id") id: String): ImportPaymentStatus

    @POST("billing/imports/payments/{id}/pre-apply")
    suspend fun importPreApply(@Path("id") id: String, @Body body: ImportPreApplyRequest): ImportPreApplyResponse

    @POST("billing/imports/payments/{id}/apply")
    suspend fun importApply(@Path("id") id: String, @Body body: ImportApplyRequest): ImportApplyResponse

    @POST("billing/imports/payments/{id}/retry-otp")
    suspend fun importRetryOtp(@Path("id") id: String): ImportPreApplyResponse

    @POST("billing/imports/payments/{id}/cancel")
    suspend fun importCancel(@Path("id") id: String, @Body body: ImportCancelRequest): ImportCancelResponse

    @POST("practice/sessions")
    suspend fun startPractice(@Body body: StartPracticeRequest): PracticeSession

    @POST("practice/sessions/{id}/answers")
    suspend fun submitPractice(@Path("id") id: String, @Body body: SubmitPracticeRequest): PracticeResultResponse

    @GET("practice/sessions/{id}")
    suspend fun getPracticeSession(@Path("id") id: String): PracticeSession

    @GET("users/me")
    suspend fun me(): MeResponse

    @PATCH("users/me")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): AuthUser

    @Multipart
    @POST("users/me/avatar")
    suspend fun uploadAvatar(@Part file: MultipartBody.Part): AuthUser

    @PATCH("users/me/preferences")
    suspend fun updatePreferences(@Body body: UpdatePreferencesRequest): UserPreferences

    @PATCH("users/me/password")
    suspend fun changePassword(@Body body: ChangePasswordRequest): OkMessageResponse

    @DELETE("users/me")
    suspend fun deleteAccount(@Body body: DeleteAccountRequest): OkMessageResponse

    @POST("users/me/target-languages")
    suspend fun addTargetLanguage(@Body body: app.gotcha.android.data.model.AddTargetLanguageRequest): MeResponse

    @PATCH("users/me/target-languages/{lang}")
    suspend fun updateTargetLanguage(
        @Path("lang") lang: String,
        @Body body: app.gotcha.android.data.model.UpdateTargetLanguageRequest,
    ): MeResponse

    @DELETE("users/me/target-languages/{lang}")
    suspend fun removeTargetLanguage(@Path("lang") lang: String): MeResponse

    @GET("users/me/stats")
    suspend fun stats(): UserStats

    @GET("notifications")
    suspend fun notifications(): NotificationsInboxResponse

    @GET("notifications/unread-count")
    suspend fun notificationsUnreadCount(): NotificationsInboxResponse

    @POST("notifications/read-all")
    suspend fun notificationsReadAll(): NotificationReadResponse

    @POST("notifications/{id}/read")
    suspend fun notificationRead(@Path("id") id: String): NotificationReadResponse

    @GET("messaging/conversations")
    suspend fun messagingConversations(@Query("q") q: String? = null): List<ConversationSummary>

    @GET("messaging/conversations/{id}")
    suspend fun messagingConversation(@Path("id") id: String): ConversationDetail

    @POST("messaging/conversations")
    suspend fun messagingStart(@Body body: StartConversationRequest): ConversationDetail

    @POST("messaging/conversations/{id}/messages")
    suspend fun messagingSend(
        @Path("id") id: String,
        @Body body: SendMessageRequest,
    ): ChatMessageDto

    @PATCH("messaging/conversations/{id}/messages/{messageId}")
    suspend fun messagingEdit(
        @Path("id") id: String,
        @Path("messageId") messageId: String,
        @Body body: EditMessageRequest,
    ): ChatMessageDto

    @DELETE("messaging/conversations/{id}/messages/{messageId}")
    suspend fun messagingDelete(
        @Path("id") id: String,
        @Path("messageId") messageId: String,
    ): ChatMessageDto

    @POST("messaging/presence")
    suspend fun messagingPresence(): MessagingOkResponse

    @POST("messaging/conversations/{id}/typing")
    suspend fun messagingTyping(
        @Path("id") id: String,
        @Body body: TypingRequest = TypingRequest(),
    ): MessagingOkResponse

    @GET("messaging/conversations/{id}/status")
    suspend fun messagingStatus(@Path("id") id: String): ConversationStatusDto

    @POST("messaging/conversations/{id}/read")
    suspend fun messagingMarkRead(@Path("id") id: String): MessagingOkResponse

    @GET("messaging/suggestions")
    suspend fun messagingSuggestions(): List<MessagingPeer>

    @GET("messaging/learners")
    suspend fun messagingLearners(
        @Query("q") q: String? = null,
        @Query("lang") lang: String? = null,
        @Query("sameReadings") sameReadings: Boolean? = null,
    ): List<MessagingPeer>

    @GET("messaging/peers/{id}")
    suspend fun messagingPeer(@Path("id") id: String): MessagingPeer

    @GET("admin/me")
    suspend fun adminMe(): AdminMe

    @GET("admin/dashboard")
    suspend fun adminDashboard(): AdminDashboard

    @GET("admin/users")
    suspend fun adminUsers(
        @Query("q") q: String? = null,
        @Query("tier") tier: String? = null,
        @Query("status") status: String? = null,
    ): AdminUsersResponse

    @GET("admin/users/{id}")
    suspend fun adminUser(@Path("id") id: String): AdminUserRow

    @PATCH("admin/users/{id}")
    suspend fun adminUpdateUser(@Path("id") id: String, @Body body: AdminUpdateUserRequest): AdminUserRow

    @POST("admin/users/{id}/reset-password")
    suspend fun adminResetUserPassword(@Path("id") id: String): AdminResetPasswordResponse

    @POST("admin/users/{id}/adjust-tier")
    suspend fun adminAdjustUserTier(
        @Path("id") id: String,
        @Body body: AdminAdjustTierRequest,
    ): AdminUserRow

    @DELETE("admin/users/{id}")
    suspend fun adminHardDeleteUser(@Path("id") id: String): AdminHardDeleteResponse

    @GET("admin/content")
    suspend fun adminContent(@Query("status") status: String? = null): List<ContentItem>

    @GET("admin/content/stats")
    suspend fun adminContentStats(): ContentStats

    @POST("admin/content/ingest-preview")
    suspend fun adminIngestPreview(@Body body: AdminCreateContentRequest): app.gotcha.android.data.model.AdminIngestPreview

    @Multipart
    @POST("admin/content/ingest-preview-file")
    suspend fun adminIngestPreviewFile(
        @Part file: MultipartBody.Part,
        @Part("title") title: RequestBody?,
        @Part("contentType") contentType: RequestBody?,
        @Part("language") language: RequestBody?,
    ): app.gotcha.android.data.model.AdminIngestPreview

    @POST("admin/content")
    suspend fun adminCreateContent(@Body body: AdminCreateContentRequest): ContentItem

    @GET("admin/content/{id}")
    suspend fun adminContentDetail(@Path("id") id: String): app.gotcha.android.data.model.AdminContentDetail

    @PATCH("admin/content/{id}")
    suspend fun adminUpdateContent(
        @Path("id") id: String,
        @Body body: app.gotcha.android.data.model.AdminUpdateContentRequest,
    ): ContentItem

    @Multipart
    @POST("admin/content/{id}/cover")
    suspend fun adminUploadContentCover(
        @Path("id") id: String,
        @Part file: MultipartBody.Part,
    ): app.gotcha.android.data.model.AdminCoverUploadResponse

    @PATCH("admin/content/{id}/publish")
    suspend fun adminPublishContent(@Path("id") id: String): ContentItem

    @PATCH("admin/content/{id}/archive")
    suspend fun adminArchiveContent(@Path("id") id: String): AdminHardDeleteResponse

    @DELETE("admin/content/{id}")
    suspend fun adminDeleteContent(@Path("id") id: String): AdminHardDeleteResponse

    @GET("admin/import-pricing")
    suspend fun importPricing(@Query("range") range: String? = "12m"): ImportPricingResponse

    @PATCH("admin/import-pricing/rules")
    suspend fun updateImportPricingRules(@Body body: UpdateImportPricingRulesRequest): ImportPricingResponse

    @PATCH("admin/import-pricing/tiers/{id}")
    suspend fun updateImportPageTier(
        @Path("id") id: String,
        @Body body: UpdateImportPageTierRequest,
    ): ImportPageTier

    @PATCH("admin/import-pricing/limits")
    suspend fun updateImportFreeLimits(@Body body: UpdateImportFreeLimitsRequest): ImportFreeLimits

    @GET("admin/analytics")
    suspend fun adminAnalytics(@Query("range") range: String? = "7d"): AdminAnalytics

    @GET("admin/support")
    suspend fun adminSupport(): AdminSupportResponse

    @GET("admin/languages")
    suspend fun adminLanguages(): AdminLanguagesResponse

    @POST("admin/languages")
    suspend fun adminAddLanguage(@Body body: AdminAddLanguageRequest): AdminLanguage

    @PATCH("admin/languages/{code}")
    suspend fun adminUpdateLanguage(
        @Path("code") code: String,
        @Body body: AdminUpdateLanguageRequest,
    ): AdminLanguage

    @DELETE("admin/languages/{code}")
    suspend fun adminRemoveLanguage(@Path("code") code: String): AdminLanguage

    @GET("admin/gamification")
    suspend fun adminGamification(): AdminGamificationResponse

    @PATCH("admin/gamification/achievements/{id}")
    suspend fun adminUpdateAchievement(
        @Path("id") id: String,
        @Body body: AdminUpdateAchievementRequest,
    ): AdminAchievement

    @GET("admin/notifications")
    suspend fun adminNotifications(): AdminNotificationsResponse

    @POST("admin/notifications")
    suspend fun adminCreateCampaign(@Body body: AdminCreateCampaignRequest): AdminCampaign

    @PATCH("admin/notifications/{id}")
    suspend fun adminUpdateCampaign(
        @Path("id") id: String,
        @Body body: AdminUpdateCampaignRequest,
    ): AdminCampaign

    @GET("admin/level-tests")
    suspend fun adminLevelTests(): AdminLevelTestsResponse

    @GET("admin/ai-usage")
    suspend fun adminAiUsage(@Query("range") range: String? = "7d"): AdminAiUsageResponse

    @GET("admin/settings")
    suspend fun adminSettings(): AdminSettings

    @PATCH("admin/settings")
    suspend fun adminUpdateSettings(@Body body: AdminUpdateSettingsRequest): AdminSettings
}
