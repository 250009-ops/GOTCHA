package app.gotcha.android.data.model

import app.gotcha.android.data.resolveMediaUrl
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNames
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String? = null,
    val nativeLanguage: String,
    val targetLanguages: List<String>,
    val clientPlatform: String = "android",
)

/**
 * `/auth/register` does NOT return session tokens in production — it always requires email
 * verification first (see AuthService.register, which returns `{requiresEmailVerification,
 * email, message}` with no `user`/tokens). Only the dev-auth bypass path returns real tokens.
 * All fields are therefore optional so this single response type can decode either shape.
 */
@Serializable
data class RegisterResponse(
    val user: AuthUser? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val isAdmin: Boolean = false,
    val adminRole: String? = null,
    val requiresEmailVerification: Boolean = false,
    val email: String? = null,
    val message: String? = null,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class ForgotPasswordRequest(
    val email: String,
    val clientPlatform: String = "android",
)

@Serializable
data class ResendVerificationRequest(
    val email: String,
    val clientPlatform: String = "android",
)

@Serializable
data class ResetPasswordRequest(
    val token: String,
    val password: String,
)

@Serializable
data class ResetPasswordResponse(
    val reset: Boolean = false,
    val email: String? = null,
    val message: String? = null,
)

@Serializable
data class VerifyEmailResponse(
    val verified: Boolean = false,
    val email: String? = null,
    val message: String? = null,
)

@Serializable
data class OkMessageResponse(
    val sent: Boolean = false,
    val message: String? = null,
)

/**
 * Canonical set of learning languages, matching `@gotcha/shared` `APP_LANGUAGES`.
 * Prefer `/content/languages` at runtime; this list is the offline fallback + flag lookup.
 */
data class AppLanguageOption(val code: String, val nativeLabel: String, val englishLabel: String, val flag: String)

val APP_LANGUAGE_OPTIONS = listOf(
    AppLanguageOption("en", "English", "English", "🇬🇧"),
    AppLanguageOption("ru", "Русский", "Russian", "🇷🇺"),
    AppLanguageOption("uz", "O'zbek", "Uzbek", "🇺🇿"),
    AppLanguageOption("fr", "Français", "French", "🇫🇷"),
    AppLanguageOption("es", "Español", "Spanish", "🇪🇸"),
    AppLanguageOption("ja", "日本語", "Japanese", "🇯🇵"),
    AppLanguageOption("de", "Deutsch", "German", "🇩🇪"),
    AppLanguageOption("ko", "한국어", "Korean", "🇰🇷"),
    AppLanguageOption("pt", "Português", "Portuguese", "🇵🇹"),
    AppLanguageOption("ar", "العربية", "Arabic", "🇸🇦"),
    AppLanguageOption("bn", "বাংলা", "Bengali", "🇧🇩"),
    AppLanguageOption("bg", "Български", "Bulgarian", "🇧🇬"),
    AppLanguageOption("ca", "Català", "Catalan", "🇦🇩"),
    AppLanguageOption("zh", "中文", "Chinese", "🇨🇳"),
    AppLanguageOption("hr", "Hrvatski", "Croatian", "🇭🇷"),
    AppLanguageOption("cs", "Čeština", "Czech", "🇨🇿"),
    AppLanguageOption("da", "Dansk", "Danish", "🇩🇰"),
    AppLanguageOption("nl", "Nederlands", "Dutch", "🇳🇱"),
    AppLanguageOption("fi", "Suomi", "Finnish", "🇫🇮"),
    AppLanguageOption("el", "Ελληνικά", "Greek", "🇬🇷"),
    AppLanguageOption("he", "עברית", "Hebrew", "🇮🇱"),
    AppLanguageOption("hi", "हिन्दी", "Hindi", "🇮🇳"),
    AppLanguageOption("hu", "Magyar", "Hungarian", "🇭🇺"),
    AppLanguageOption("id", "Bahasa Indonesia", "Indonesian", "🇮🇩"),
    AppLanguageOption("it", "Italiano", "Italian", "🇮🇹"),
    AppLanguageOption("ms", "Bahasa Melayu", "Malay", "🇲🇾"),
    AppLanguageOption("no", "Norsk", "Norwegian", "🇳🇴"),
    AppLanguageOption("fa", "فارسی", "Persian", "🇮🇷"),
    AppLanguageOption("pl", "Polski", "Polish", "🇵🇱"),
    AppLanguageOption("ro", "Română", "Romanian", "🇷🇴"),
    AppLanguageOption("sr", "Српски", "Serbian", "🇷🇸"),
    AppLanguageOption("sk", "Slovenčina", "Slovak", "🇸🇰"),
    AppLanguageOption("sw", "Kiswahili", "Swahili", "🇰🇪"),
    AppLanguageOption("sv", "Svenska", "Swedish", "🇸🇪"),
    AppLanguageOption("tl", "Tagalog", "Tagalog", "🇵🇭"),
    AppLanguageOption("th", "ไทย", "Thai", "🇹🇭"),
    AppLanguageOption("tr", "Türkçe", "Turkish", "🇹🇷"),
    AppLanguageOption("uk", "Українська", "Ukrainian", "🇺🇦"),
    AppLanguageOption("ur", "اردو", "Urdu", "🇵🇰"),
    AppLanguageOption("vi", "Tiếng Việt", "Vietnamese", "🇻🇳"),
)

@Serializable
data class CatalogLanguage(
    val code: String,
    val name: String? = null,
    val nativeName: String? = null,
    val flagEmoji: String? = null,
    val isEnabled: Boolean = true,
)

fun CatalogLanguage.toAppLanguageOption(): AppLanguageOption {
    val fallback = APP_LANGUAGE_OPTIONS.firstOrNull { it.code.equals(code, true) }
    return AppLanguageOption(
        code = code.lowercase(),
        nativeLabel = nativeName ?: fallback?.nativeLabel ?: name ?: code,
        englishLabel = name ?: fallback?.englishLabel ?: code,
        flag = flagEmoji ?: fallback?.flag ?: "\uD83C\uDF10",
    )
}

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    val displayName: String? = null,
    val nativeLanguage: String? = null,
    val uiLanguage: String? = null,
    val streakCount: Int = 0,
    val avatarUrl: String? = null,
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class AuthResponse(
    val user: AuthUser,
    @JsonNames("token", "access_token")
    val accessToken: String,
    @JsonNames("refresh_token")
    val refreshToken: String,
    val isAdmin: Boolean = false,
    val adminRole: String? = null,
)

@Serializable
data class ContentItem(
    val id: String,
    val title: String? = null,
    val slug: String? = null,
    val language: String? = null,
    val cefrLevel: String? = null,
    val contentType: String? = null,
    val contentSource: String? = null,
    val genre: String? = null,
    val wordCount: Int? = null,
    val segmentCount: Int? = null,
    val coverImageUrl: String? = null,
    val coverImageKey: String? = null,
    val author: String? = null,
    val authorName: String? = null,
    val description: String? = null,
    val progressPct: Double? = null,
    val knownWordRatio: Double? = null,
    val subtitle: String? = null,
    val lastReadAt: String? = null,
    /** Learner feed uses `status`; admin Nest payloads use `publishStatus`. */
    val status: String? = null,
    val publishStatus: String? = null,
    val isFree: Boolean? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val priceUsd: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val priceUzs: Double? = null,
    val accessGranted: Boolean? = null,
    val salesCount: Int? = null,
    val viewCount: Int? = null,
) {
    fun resolvedStatus(): String = (publishStatus ?: status ?: "draft").lowercase()
    fun catalogPriceUzs(): Double = priceUzs ?: priceUsd ?: 0.0
    fun needsCatalogPayment(): Boolean {
        if (accessGranted == true) return false
        if (accessGranted == false) return catalogPriceUzs() > 0
        return isFree == false && catalogPriceUzs() > 0
    }
}

@Serializable
data class FeaturedCollection(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val description: String? = null,
    val isFeatured: Boolean = false,
    val items: List<FeaturedCollectionItem> = emptyList(),
) { val browseKey: String get() = slug?.ifBlank { null } ?: id.orEmpty() }

@Serializable
data class FeaturedCollectionItem(
    val content: ContentItem? = null,
)

@Serializable
data class FeedResponse(
    val continueReading: List<ContentItem> = emptyList(),
    val featuredCollections: List<FeaturedCollection> = emptyList(),
    val recentlyPublished: List<ContentItem> = emptyList(),
    val myImports: List<ContentItem> = emptyList(),
) {
    fun readerWarmIds(): List<ContentItem> = buildList {
        addAll(continueReading)
        addAll(recentlyPublished)
        featuredCollections.forEach { collection ->
            collection.items.forEach { entry ->
                entry.content?.let { add(it) }
            }
        }
    }
}

@Serializable
data class ContentListResponse(
    val items: List<ContentItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 20,
    val hasMore: Boolean = false,
)

@Serializable
data class Segment(
    val id: String,
    val segmentIndex: Int = 0,
    val chapterIndex: Int = 0,
    val chapterTitle: String? = null,
    val pageIndex: Int = 0,
    val title: String? = null,
    val plainText: String? = null,
    val wordCount: Int? = null,
)

@Serializable
data class SegmentsResponse(
    val contentId: String,
    val segments: List<Segment> = emptyList(),
)

@Serializable
data class LookupRequest(
    val token: String,
    val sentence: String,
    val lemma: String? = null,
    val sourceLang: String,
    val targetLang: String,
)

@Serializable
data class LookupResponse(
    val lemma: String? = null,
    val translation: String? = null,
    val contextualMeaning: String? = null,
    val phrase: String? = null,
    val kind: String? = null,
    val grammarNote: String? = null,
    val partOfSpeech: String? = null,
    val cached: Boolean = false,
)

@Serializable
data class TranslateRequest(
    val text: String,
    val sourceLang: String,
    val targetLang: String,
)

@Serializable
data class TranslateResponse(
    val translation: String? = null,
    val sourceLang: String? = null,
    val targetLang: String? = null,
    val cached: Boolean = false,
)

@Serializable
data class SpeechRequest(
    val text: String,
    val lang: String,
)

@Serializable
data class KnownWord(
    val lemma: String,
    val status: String? = null,
    val sourceLang: String? = null,
)

@Serializable
data class MarkKnownWordRequest(
    val lemma: String,
    val sourceLang: String,
    val status: String,
)

@Serializable
data class SaveVocabularyRequest(
    val lemma: String,
    val sourceLang: String,
    val targetLang: String,
    val translation: String,
    val contextSentence: String? = null,
    val contextSegmentId: String? = null,
    val contentId: String? = null,
    val notes: String? = null,
)

@Serializable
data class VocabContentRef(
    val id: String,
    val title: String? = null,
)

@Serializable
data class ReviewVocabularyRequest(
    val rating: String,
)

@Serializable
data class UpdateVocabularyRequest(
    val mastered: Boolean? = null,
    val notes: String? = null,
)

@Serializable
data class VocabItem(
    val id: String,
    val lemma: String? = null,
    val sourceLang: String? = null,
    val targetLang: String? = null,
    val translation: String? = null,
    val contextSentence: String? = null,
    val mastered: Boolean = false,
    val dueAt: String? = null,
    val intervalDays: Int? = null,
    val repetitions: Int? = null,
    val lastReviewedAt: String? = null,
    val createdAt: String? = null,
    val contentId: String? = null,
    val notes: String? = null,
    val content: VocabContentRef? = null,
)

@Serializable
data class UpdateProgressRequest(
    val segmentId: String? = null,
    val charOffset: Int? = null,
    val progressPct: Double? = null,
    val readSeconds: Int? = null,
    val completed: Boolean? = null,
)

@Serializable
data class ImportPasteRequest(
    val title: String,
    val text: String,
    val language: String? = null,
    val paymentId: String? = null,
)

@Serializable
data class ImportUrlRequest(
    val title: String? = null,
    val url: String,
    val language: String? = null,
    val paymentId: String? = null,
)

@Serializable
data class ImportQuoteRequest(
    val importType: String,
    val contentFormat: String? = null,
    val textLength: Int? = null,
    val wordCount: Int? = null,
    val pageCount: Int? = null,
)

@Serializable
data class ImportInspectResponse(
    val importType: String,
    val pageCount: Int = 1,
)

@Serializable
data class ImportCheckoutRequest(
    val importType: String,
    val contentFormat: String? = null,
    val textLength: Int? = null,
    val wordCount: Int? = null,
    val pageCount: Int? = null,
    val platform: String = "android",
)

@Serializable
data class ImportQuoteTier(
    val id: String? = null,
    val label: String? = null,
    val minPages: Int? = null,
    val maxPages: Int? = null,
    val priceUzs: Double? = null,
)

@Serializable
data class ImportQuoteFreeLimits(
    val gatewayEnabled: Boolean = false,
    val resetCycle: String? = null,
    val allowedFormats: List<String> = emptyList(),
    val dailyFreeImportsPerUser: Int = 0,
    val dailyFreeUsed: Int = 0,
    val dailyFreeRemaining: Int = 0,
    val monthlyFreePageLimit: Int = 0,
    val monthlyPagesUsed: Int = 0,
    val monthlyPagesRemaining: Int = 0,
)

@Serializable
data class ImportQuoteResponse(
    val gatewayEnabled: Boolean = false,
    val estimatedPages: Int = 1,
    val amountUzs: Double = 0.0,
    val isFree: Boolean = true,
    val requiresPayment: Boolean = false,
    val tier: ImportQuoteTier? = null,
    val freeReason: String? = null,
    val minAmountUzs: Double? = null,
    val belowMinimum: Boolean = false,
    val freeLimits: ImportQuoteFreeLimits? = null,
)

@Serializable
data class CatalogCheckoutResponse(
    val contentId: String? = null,
    val title: String? = null,
    val isFree: Boolean = false,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val priceUzs: Double = 0.0,
    val accessGranted: Boolean = false,
    val paymentId: String? = null,
    val status: String? = null,
    val step: String? = null,
    val transactionId: Long? = null,
    val gatewayEnabled: Boolean = false,
)

@Serializable
data class ImportCheckoutResponse(
    val paymentId: String,
    val paymentUrl: String? = null,
    val status: String? = null,
    val isFree: Boolean = false,
    val quote: ImportQuoteResponse? = null,
    val step: String? = null,
    val transactionId: Long? = null,
)

@Serializable
data class ImportPaymentStatus(
    val id: String,
    val status: String,
    val paymentUrl: String? = null,
    val amountTiyins: Int = 0,
    val ofdUrl: String? = null,
)

@Serializable
data class ImportPreApplyRequest(
    val cardNumber: String,
    val expiry: String,
)

@Serializable
data class ImportPreApplyResponse(
    val paymentId: String,
    val maskedPhone: String? = null,
    val step: String? = null,
)

@Serializable
data class ImportApplyRequest(
    val otp: String,
)

@Serializable
data class ImportApplyResponse(
    val paymentId: String,
    val status: String? = null,
    val ofdUrl: String? = null,
    val step: String? = null,
)

@Serializable
data class ImportCancelRequest(
    val reason: String? = null,
)

@Serializable
data class ImportCancelResponse(
    val paymentId: String,
    val status: String,
)

@Serializable
data class UserImport(
    val id: String,
    val title: String? = null,
    val importType: String? = null,
    val language: String? = null,
    val ingestionStatus: String? = null,
    val contentId: String? = null,
    val createdAt: String? = null,
    val sourceUrl: String? = null,
    val errorMessage: String? = null,
    val progressPagesDone: Int? = null,
    val progressPagesTotal: Int? = null,
    val progressPhase: String? = null,
    val content: ContentItem? = null,
)

@Serializable
data class ImportsListResponse(
    val items: List<UserImport> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 20,
    val hasMore: Boolean = false,
    val importLimit: Int? = null,
    val importRemaining: Int? = null,
    val importsUnlimited: Boolean? = null,
    val freeAllowance: ImportQuoteFreeLimits? = null,
)

@Serializable
data class StatsHistoryDay(
    val date: String,
    val minutes: Int = 0,
    val wordsSaved: Int = 0,
)

@Serializable
data class StatsHistoryWeek(
    val weekStart: String,
    val wordsSaved: Int = 0,
)

@Serializable
data class StatsHeatmapDay(
    val date: String,
    val count: Int = 0,
)

@Serializable
data class StatsHistory(
    val daily: List<StatsHistoryDay> = emptyList(),
    val weekly: List<StatsHistoryWeek> = emptyList(),
    val heatmap: List<StatsHeatmapDay> = emptyList(),
)

@Serializable
data class UserStats(
    val vocabularyTotal: Int = 0,
    val vocabularyMastered: Int = 0,
    val vocabularyDue: Int = 0,
    val contentInProgress: Int = 0,
    val contentCompleted: Int = 0,
    val totalReadMinutes: Int = 0,
    val todayReadMinutes: Int = 0,
    val todayWordsSaved: Int = 0,
    val wordsSaved: Int = 0,
    val wordsTapped: Int = 0,
    /** Live current streak (same source as /users/me when streak is active). */
    val streakCount: Int = 0,
    val wordsLearned: Int = 0,
    val bestStreak: Int = 0,
    val history: StatsHistory? = null,
)

@Serializable
data class UserPreferences(
    val readerFontScale: Double? = null,
    val readerTheme: String? = null,
    val readerLineSpacing: Double? = null,
    val showKnownWords: Boolean? = null,
    val ttsEnabled: Boolean? = null,
    val dailyGoalMinutes: Int? = null,
    val notificationsEnabled: Boolean? = null,
)

@Serializable
data class SubscriptionPlan(
    val id: String = "",
    val tier: String = "free",
    val name: String = "",
    val aiDailyQuota: Int = 50,
    val importLimit: Int = 0,
)

@Serializable
data class ImportAllowance(
    val gatewayEnabled: Boolean = false,
    val resetCycle: String = "monthly",
    val dailyFreeImportsPerUser: Int = 0,
    val dailyFreeUsed: Int = 0,
    val dailyFreeRemaining: Int = 0,
    val monthlyFreePageLimit: Int = 0,
    val monthlyPagesUsed: Int = 0,
    val monthlyPagesRemaining: Int = 0,
)

@Serializable
data class SubscriptionUsage(
    val lookupsToday: Int = 0,
    val quota: Int = 50,
    val importAllowance: ImportAllowance? = null,
)

@Serializable
data class SubscriptionInfo(
    val subscription: SubscriptionPlan? = null,
    val usage: SubscriptionUsage = SubscriptionUsage(),
)

@Serializable
data class UpdateProfileRequest(
    val displayName: String? = null,
    val uiLanguage: String? = null,
    val nativeLanguage: String? = null,
)

@Serializable
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)

@Serializable
data class DeleteAccountRequest(
    val currentPassword: String,
)

@Serializable
data class UpdatePreferencesRequest(
    val dailyGoalMinutes: Int? = null,
    val readerFontScale: Double? = null,
    val readerTheme: String? = null,
    val readerLineSpacing: Double? = null,
    val showKnownWords: Boolean? = null,
    val ttsEnabled: Boolean? = null,
    val notificationsEnabled: Boolean? = null,
)

@Serializable
data class UserTargetLanguage(
    val targetLanguage: String,
    val cefrLevel: String? = null,
    val isPrimary: Boolean = false,
)

@Serializable
data class AddTargetLanguageRequest(
    val targetLanguage: String,
    val cefrLevel: String? = null,
    val isPrimary: Boolean? = null,
)

@Serializable
data class UpdateTargetLanguageRequest(
    val cefrLevel: String? = null,
    val isPrimary: Boolean? = null,
)

@Serializable
data class MeResponse(
    val id: String,
    val email: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val nativeLanguage: String? = null,
    val uiLanguage: String? = null,
    val streakCount: Int = 0,
    val preferences: UserPreferences? = null,
    val targetLanguages: List<UserTargetLanguage> = emptyList(),
    val createdAt: String? = null,
    val emailVerifiedAt: String? = null,
)

@Serializable
data class AdminMe(
    val id: String,
    val email: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val role: String? = null,
)

@Serializable
data class AdminDashboard(
    val users: Int = 0,
    val publishedContent: Int = 0,
    val userImports: Int = 0,
    val moderationPending: Int = 0,
    val ingestionQueued: Int = 0,
    val activeSubscribers: Int = 0,
    val activeToday: Int = 0,
    val engagementPct: Double = 0.0,
    val mrr: Double = 0.0,
    val mrrGrowthPct: Double = 0.0,
    val aiLookupsToday: Int = 0,
    val aiLimit: Int = 0,
    val aiUsagePct: Double = 0.0,
    val userGrowthPct: Double = 0.0,
    val conversionPct: Double = 0.0,
    val revenueToday: Double = 0.0,
    val revenueMomDelta: Double = 0.0,
    val revenue: Double = 0.0,
    val revenueGrowthPct: Double = 0.0,
    val revenueCurrency: String? = "USD",
    val importCurrency: String? = "UZS",
    val importRevenueUzs: Int = 0,
    val revenueTrend: List<AdminTrendPoint> = emptyList(),
    val revenueDaily: List<AdminTrendPoint> = emptyList(),
    val userGrowth: List<AdminTrendPoint> = emptyList(),
    val aiCategories: List<AdminAiCategory> = emptyList(),
    val topPhrases: List<AdminTopPhrase> = emptyList(),
    val recentUsers: List<AdminRecentUser> = emptyList(),
    val recentActivity: List<AdminActivityItem> = emptyList(),
)

@Serializable
data class AdminTrendPoint(
    val month: String? = null,
    val day: String? = null,
    val mrr: Double = 0.0,
    val revenue: Double = 0.0,
    val users: Int = 0,
) {
    fun chartValue(): Double = when {
        revenue != 0.0 -> revenue
        mrr != 0.0 -> mrr
        else -> 0.0
    }
}

@Serializable
data class AdminAiCategory(
    val name: String = "",
    val pct: Double = 0.0,
    val color: String = "",
)

@Serializable
data class AdminTopPhrase(
    val phrase: String = "",
    val language: String = "",
    val level: String = "",
    val lookups: Int = 0,
    val aiMatch: Double = 0.0,
)

@Serializable
data class AdminRecentUser(
    val id: String,
    val displayName: String? = null,
    val email: String? = null,
    val billingTier: String? = null,
    val targetLanguage: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class AdminActivityItem(
    val id: String,
    val type: String? = null,
    val title: String,
    val subtitle: String? = null,
    val createdAt: String? = null,
    val href: String? = null,
)

@Serializable
data class AdminUsersResponse(
    val stats: AdminUserStats? = null,
    val users: List<AdminUserRow> = emptyList(),
)

@Serializable
data class AdminUserStats(
    val total: Int = 0,
    val premium: Int = 0,
    val payAsYouGo: Int = 0,
    val free: Int = 0,
    val suspended: Int = 0,
    val flagged: Int = 0,
)

@Serializable
data class AdminUserRow(
    val id: String,
    val email: String,
    val displayName: String? = null,
    val billingTier: String? = null,
    val planLabel: String? = null,
    val isAdmin: Boolean = false,
    val adminRole: String? = null,
    val streakCount: Int = 0,
    val createdAt: String? = null,
    val vocabCount: Int? = null,
    val sessionCount: Int? = null,
    val isFlagged: Boolean = false,
    val isSuspended: Boolean = false,
    val isActiveRecently: Boolean = false,
    val targetLanguage: String? = null,
    val cefrLevel: String? = null,
    val recentActivity: List<AdminUserActivityItem> = emptyList(),
)

@Serializable
data class ContentStats(
    val total: Int = 0,
    val published: Int = 0,
    val draft: Int = 0,
    val review: Int = 0,
    val archived: Int = 0,
    val activeSalesMonthly: Int = 0,
    val freeItems: Int = 0,
)

@Serializable
data class ImportPricingResponse(
    val range: String? = null,
    val currency: String? = null,
    val atmosConfigured: Boolean = false,
    val paymentGatewayEnabled: Boolean = false,
    val stats: ImportPricingStats? = null,
    val rules: List<ImportPricingRule> = emptyList(),
    val tiers: List<ImportPageTier> = emptyList(),
    val freeLimits: ImportFreeLimits? = null,
)

@Serializable
data class ImportPricingStats(
    val totalImportsToday: Int = 0,
    val importsGrowthPct: Double = 0.0,
    val revenueFromImports: Double = 0.0,
    val revenueGrowthPct: Double = 0.0,
    val freeImportsUsed: Int = 0,
    val freeImportsPool: Int = 0,
    val freeUsedPct: Double = 0.0,
    val conversionPct: Double = 0.0,
    val conversionGrowthPct: Double = 0.0,
    val paidImportsThisMonth: Int = 0,
)

@Serializable
data class ImportPricingRule(
    val id: String,
    val key: String? = null,
    val label: String? = null,
    val pricePerImport: Double? = null,
    val pricePerPage: Double? = null,
    val isActive: Boolean = true,
    val sortOrder: Int = 0,
)

@Serializable
data class ImportPageTier(
    val id: String,
    val label: String? = null,
    val minPages: Int = 0,
    val maxPages: Int? = null,
    val priceUsd: Double = 0.0,
    val priceUzs: Double = 0.0,
    val sortOrder: Int = 0,
)

@Serializable
data class ImportFreeLimits(
    val dailyFreeImportsPerUser: Int = 0,
    val monthlyFreePageLimit: Int = 0,
    val allowedFormats: List<String> = emptyList(),
    val resetCycle: String? = null,
    val allowRollover: Boolean = false,
)

@Serializable
data class UpdateImportPricingRulesRequest(
    val rules: List<ImportPricingRulePatch>,
)

@Serializable
data class ImportPricingRulePatch(
    val id: String,
    val pricePerImport: Double? = null,
    val pricePerPage: Double? = null,
    val isActive: Boolean? = null,
    val label: String? = null,
)

@Serializable
data class UpdateImportPageTierRequest(
    val priceUsd: Double? = null,
    val priceUzs: Double? = null,
    val label: String? = null,
    val minPages: Int? = null,
    val maxPages: Int? = null,
)

@Serializable
data class ImportPageTierDeleted(
    val deleted: Boolean = true,
    val id: String? = null,
)

@Serializable
data class UpdateImportFreeLimitsRequest(
    val dailyFreeImportsPerUser: Int? = null,
    val monthlyFreePageLimit: Int? = null,
    val allowedFormats: List<String>? = null,
    val resetCycle: String? = null,
    val allowRollover: Boolean? = null,
)

@Serializable
data class AdminCreateContentRequest(
    val title: String,
    val description: String? = null,
    val author: String? = null,
    val genre: String? = null,
    val language: String = "en",
    val cefrLevel: String = "b1",
    val contentType: String = "article",
    val plainText: String? = null,
    val sourceUrl: String? = null,
    val priceUsd: Double? = null,
    val isFree: Boolean = false,
    val chapters: List<AdminChapterPayload>? = null,
)

@Serializable
data class AdminUpdateContentRequest(
    val title: String? = null,
    val description: String? = null,
    val author: String? = null,
    val genre: String? = null,
    val language: String? = null,
    val cefrLevel: String? = null,
    val contentType: String? = null,
    val priceUsd: Double? = null,
    val isFree: Boolean? = null,
)

@Serializable
data class AdminChapterPayload(
    val title: String,
    val text: String,
)

@Serializable
data class AdminContentChapterPage(
    val pageIndex: Int = 0,
    val title: String = "",
    val wordCount: Int = 0,
    val preview: String = "",
)

@Serializable
data class AdminContentChapter(
    val title: String,
    val chapterIndex: Int = 0,
    val wordCount: Int = 0,
    val pages: List<AdminContentChapterPage> = emptyList(),
)

@Serializable
data class AdminIngestPreview(
    val wordCount: Int = 0,
    val uniqueWordCount: Int = 0,
    val chapterCount: Int = 0,
    val pageCount: Int = 0,
    val chapters: List<AdminContentChapter> = emptyList(),
    val chaptersPayload: List<AdminChapterPayload> = emptyList(),
)

@Serializable
data class AdminContentDetail(
    val id: String,
    val title: String? = null,
    val author: String? = null,
    val description: String? = null,
    val genre: String? = null,
    val language: String? = null,
    val cefrLevel: String? = null,
    val contentType: String? = null,
    val isFree: Boolean = true,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val priceUsd: Double? = null,
    val sourceUrl: String? = null,
    val coverImageKey: String? = null,
    val subtitle: String? = null,
    val chapters: List<AdminContentChapter> = emptyList(),
)

@Serializable
data class AdminCoverUploadResponse(
    val id: String? = null,
    val coverImageKey: String? = null,
)

@Serializable
data class AdminUpdateUserRequest(
    val displayName: String? = null,
    val deleted: Boolean? = null,
    val tier: String? = null,
)

@Serializable
data class AdminAdjustTierRequest(
    val tier: String,
)

@Serializable
data class AdminResetPasswordResponse(
    val sent: Boolean = false,
    val email: String? = null,
    val message: String? = null,
)

@Serializable
data class AdminHardDeleteResponse(
    val deleted: Boolean = false,
    val id: String? = null,
)

@Serializable
data class AdminUserActivityItem(
    val id: String,
    val label: String? = null,
    val createdAt: String? = null,
    val type: String? = null,
)

@Serializable
data class AdminAnalytics(
    val range: String? = null,
    val kpis: AdminAnalyticsKpis? = null,
    val engagementByHour: List<Int> = emptyList(),
    val engagementByDay: List<AdminNamedValue> = emptyList(),
    val featureUsage: List<AdminNamedPct> = emptyList(),
)

@Serializable
data class AdminNamedValue(
    val label: String? = null,
    val value: Int = 0,
)

@Serializable
data class AdminAnalyticsKpis(
    val dau: Int = 0,
    val dauGrowthPct: Double = 0.0,
    val avgSessionMin: Double = 0.0,
    val avgSessionGrowthPct: Double = 0.0,
    val lessonCompletionPct: Double = 0.0,
    val lessonCompletionDeltaPct: Double = 0.0,
    val retentionPct: Double = 0.0,
    val retentionGrowthPct: Double = 0.0,
    val revenue: Double = 0.0,
    val revenueGrowthPct: Double = 0.0,
)

@Serializable
data class AdminNamedPct(
    val name: String? = null,
    val pct: Double = 0.0,
    val color: String? = null,
)

@Serializable
data class AdminSupportResponse(
    val stats: AdminSupportStats? = null,
    val tickets: List<AdminSupportTicket> = emptyList(),
)

@Serializable
data class AdminSupportStats(
    val open: Int = 0,
    val inProgress: Int = 0,
    val resolved: Int = 0,
    val total: Int = 0,
)

@Serializable
data class AdminSupportTicket(
    val id: String,
    val subject: String? = null,
    val body: String? = null,
    val status: String? = null,
    val priority: String? = null,
    val category: String? = null,
    val createdAt: String? = null,
    val user: AdminTicketUser? = null,
)

@Serializable
data class AdminTicketUser(
    val email: String? = null,
    val displayName: String? = null,
)

@Serializable
data class AdminLanguagesResponse(
    val stats: AdminLanguageStats? = null,
    val languages: List<AdminLanguage> = emptyList(),
)

@Serializable
data class AdminLanguageStats(
    val supported: Int = 0,
    val totalContentItems: Int = 0,
    val avgCefrCoverage: Double = 0.0,
)

@Serializable
data class AdminUpdateLanguageRequest(
    val isEnabled: Boolean? = null,
    val status: String? = null,
)

@Serializable
data class AdminAddLanguageRequest(
    val code: String,
)

@Serializable
data class AdminLanguage(
    val code: String,
    val name: String? = null,
    val nativeName: String? = null,
    val flagEmoji: String? = null,
    val isEnabled: Boolean = true,
    val learnerCount: Int = 0,
    val contentCount: Int = 0,
    val cefrCoverage: Double = 0.0,
    val status: String? = null,
)

@Serializable
data class AdminGamificationStats(
    val achievements: Int = 0,
    val activeAchievements: Int = 0,
    val streakers: Int = 0,
    val vocabMasters: Int = 0,
    val activeReaders: Int = 0,
    val catalogPoints: Int = 0,
    val avgStreakDays: Double = 0.0,
    val totalEarned: Int = 0,
)

@Serializable
data class AdminGamificationSeason(
    val id: String,
    val title: String? = null,
    val status: String? = null,
    val endsInDays: Int? = null,
    val participants: Int = 0,
)

@Serializable
data class AdminGamificationResponse(
    val stats: AdminGamificationStats? = null,
    val achievements: List<AdminAchievement> = emptyList(),
    val seasons: List<AdminGamificationSeason> = emptyList(),
)

@Serializable
data class AdminAchievement(
    val id: String,
    val code: String? = null,
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    val points: Int = 0,
    val threshold: Int = 0,
    val isActive: Boolean = true,
)

@Serializable
data class AdminUpdateAchievementRequest(
    val isActive: Boolean,
)

@Serializable
data class AdminNotificationsResponse(
    val stats: AdminNotificationStats? = null,
    val campaigns: List<AdminCampaign> = emptyList(),
)

@Serializable
data class AdminNotificationStats(
    val draft: Int = 0,
    val scheduled: Int = 0,
    val sent: Int = 0,
    val total: Int = 0,
)

@Serializable
data class AdminCampaign(
    val id: String,
    val name: String? = null,
    val subject: String? = null,
    val body: String? = null,
    val channel: String? = null,
    val status: String? = null,
    val audience: String? = null,
    val createdAt: String? = null,
    val scheduledAt: String? = null,
    val sentAt: String? = null,
)

@Serializable
data class AdminCreateCampaignRequest(
    val name: String,
    val subject: String,
    val body: String,
    val channel: String = "push",
    val audience: String = "all",
    val status: String = "draft",
)

@Serializable
data class AdminUpdateCampaignRequest(
    val name: String? = null,
    val subject: String? = null,
    val body: String? = null,
    val status: String? = null,
    val audience: String? = null,
    val channel: String? = null,
    val scheduledAt: String? = null,
)

@Serializable
data class AdminLevelTestsResponse(
    val stats: AdminLevelTestStats? = null,
    val results: List<AdminLevelTestResult> = emptyList(),
)

@Serializable
data class AdminLevelTestStats(
    val total: Int = 0,
    val monthTotal: Int = 0,
    val avgScore: Double = 0.0,
    val byLevel: List<AdminLevelBucket> = emptyList(),
)

@Serializable
data class AdminLevelBucket(
    val level: String? = null,
    val count: Int = 0,
    val avgScore: Double = 0.0,
    val pct: Int = 0,
)

@Serializable
data class AdminLevelTestResult(
    val id: String,
    val targetLanguage: String? = null,
    val suggestedLevel: String? = null,
    val score: Double = 0.0,
    val createdAt: String? = null,
    val user: AdminTicketUser? = null,
)

@Serializable
data class AdminAiUsageResponse(
    val today: AdminAiToday? = null,
    val hourlyLookups: List<Int> = emptyList(),
    val dailyLookups: List<Int> = emptyList(),
    val topUsers: List<AdminAiTopUser> = emptyList(),
    val insight: String? = null,
)

@Serializable
data class AdminAiToday(
    val lookups: Int = 0,
    val quizzes: Int = 0,
    val tokens: Int = 0,
    val uniqueUsers: Int = 0,
    val growthPct: Double = 0.0,
    val avgLookupsPerUser: Double = 0.0,
    val apiCostToday: Double = 0.0,
    val avgCostPerLookup: Double = 0.0,
    val rateLimitedUsers: Int = 0,
    val flagAlerts: Int = 0,
)

@Serializable
data class AdminAiTopUser(
    val user: AdminTicketUser? = null,
    val plan: String? = null,
    val lookups: Int = 0,
    val monthLookups: Int = 0,
    val cost: Double = 0.0,
    val status: String? = null,
)

@Serializable
data class AdminSettings(
    val platformName: String? = null,
    val supportEmail: String? = null,
    val aiDailyLimit: Int = 0,
    val aiEnabled: Boolean = true,
    val aiLookupModel: String? = null,
    val aiQuizModel: String? = null,
    val aiDefaultUserQuota: Int = 0,
    val aiConfigured: Boolean? = null,
    val maintenanceMode: Boolean = false,
    val allowRegistrations: Boolean = true,
    val defaultCefr: String? = null,
    val contentModerationEnabled: Boolean = true,
    val autoApproveImports: Boolean = false,
)

@Serializable
data class AdminUpdateSettingsRequest(
    val platformName: String? = null,
    val supportEmail: String? = null,
    val aiDailyLimit: Int? = null,
    val aiEnabled: Boolean? = null,
    val aiLookupModel: String? = null,
    val aiQuizModel: String? = null,
    val aiDefaultUserQuota: Int? = null,
    val maintenanceMode: Boolean? = null,
    val allowRegistrations: Boolean? = null,
    val defaultCefr: String? = null,
    val contentModerationEnabled: Boolean? = null,
    val autoApproveImports: Boolean? = null,
)

@Serializable
data class ApiErrorBody(
    val message: JsonElement? = null,
    val statusCode: Int? = null,
    val code: String? = null,
    val email: String? = null,
)

@Serializable
data class MessagingPeer(
    val id: String,
    val displayName: String? = null,
    val handle: String? = null,
    val avatarUrl: String? = null,
    val nativeLanguage: String? = null,
    val primaryLanguage: String? = null,
    val targetLanguages: List<MessagingLang> = emptyList(),
    val reading: MessagingContentRef? = null,
    val createdAt: String? = null,
    val stats: MessagingPeerStats? = null,
    val currentlyReading: MessagingReadingProgress? = null,
    val sharedReadingsNote: String? = null,
    val online: Boolean = false,
    val lastSeenAt: String? = null,
    val typing: Boolean = false,
)

@Serializable
data class MessagingLang(
    val language: String? = null,
    val cefrLevel: String? = null,
    val isPrimary: Boolean = false,
)

@Serializable
data class MessagingContentRef(
    val id: String? = null,
    val title: String? = null,
    val coverImageKey: String? = null,
    val language: String? = null,
)

@Serializable
data class MessagingPeerStats(
    val booksRead: Int = 0,
    val wordsLearned: Int = 0,
    val chats: Int = 0,
)

@Serializable
data class MessagingReadingProgress(
    val id: String? = null,
    val title: String? = null,
    val coverImageKey: String? = null,
    val language: String? = null,
    val progressPct: Double = 0.0,
)

@Serializable
data class MessagingLastMessage(
    val id: String? = null,
    val body: String? = null,
    val translation: String? = null,
    val senderId: String? = null,
    val createdAt: String? = null,
    val deleted: Boolean = false,
    val status: String? = null,
)

@Serializable
data class MessageReplyToDto(
    val id: String,
    val body: String = "",
    val senderId: String = "",
    val deleted: Boolean = false,
)

@Serializable
data class ConversationSummary(
    val id: String,
    val language: String? = null,
    val peer: MessagingPeer? = null,
    val content: MessagingContentRef? = null,
    val lastMessage: MessagingLastMessage? = null,
    val unreadCount: Int = 0,
    val lastMessageAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class ChatMessageSender(
    val id: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

@Serializable
data class ChatMessageDto(
    val id: String,
    val body: String,
    val translation: String? = null,
    val bodyLang: String? = null,
    val senderId: String? = null,
    val sender: ChatMessageSender? = null,
    val mine: Boolean = false,
    val createdAt: String? = null,
    val editedAt: String? = null,
    val deleted: Boolean = false,
    val replyTo: MessageReplyToDto? = null,
    val status: String? = null,
)

@Serializable
data class ConversationDetail(
    val id: String,
    val language: String? = null,
    val peer: MessagingPeer? = null,
    val content: MessagingContentRef? = null,
    val messages: List<ChatMessageDto> = emptyList(),
    val lastMessageAt: String? = null,
    val peerLastReadAt: String? = null,
)

@Serializable
data class ConversationStatusDto(
    val peerLastReadAt: String? = null,
    val peer: ConversationPeerStatus? = null,
)

@Serializable
data class ConversationPeerStatus(
    val id: String? = null,
    val online: Boolean = false,
    val lastSeenAt: String? = null,
    val typing: Boolean = false,
)

@Serializable
data class TypingRequest(
    val typing: Boolean = true,
)

@Serializable
data class StartConversationRequest(
    val peerUserId: String,
    val language: String? = null,
    val contentId: String? = null,
)

@Serializable
data class SendMessageRequest(
    val body: String,
    val translation: String? = null,
    val bodyLang: String? = null,
    val replyToId: String? = null,
)

@Serializable
data class EditMessageRequest(
    val body: String,
    val translation: String? = null,
    val bodyLang: String? = null,
)

@Serializable
data class MessagingOkResponse(
    val ok: Boolean = true,
)

@Serializable
data class LearnerNotification(
    val id: String,
    val kind: String,
    val title: String,
    val body: String,
    val href: String? = null,
    val refId: String? = null,
    val unread: Boolean = true,
    val createdAt: String? = null,
)

@Serializable
data class NotificationsInboxResponse(
    val items: List<LearnerNotification> = emptyList(),
    val unreadCount: Int = 0,
)

@Serializable
data class NotificationReadResponse(
    val ok: Boolean = true,
    val unreadCount: Int = 0,
    val item: LearnerNotification? = null,
)

fun MessagingContentRef?.coverUrl(): String? = resolveMediaUrl(this?.coverImageKey)

fun MessagingReadingProgress.coverUrl(): String? = resolveMediaUrl(coverImageKey)

/** Prisma Decimal and mixed admin payloads arrive as number or string. */
object FlexibleDoubleSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return runCatching { decoder.decodeDouble() }.getOrDefault(0.0)
        return when (val element = jsonDecoder.decodeJsonElement()) {
            JsonNull -> 0.0
            is JsonPrimitive -> element.doubleOrNull ?: element.content.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
    }

    override fun serialize(encoder: Encoder, value: Double) {
        encoder.encodeDouble(value)
    }
}

// ---- Practice / quiz (mirrors services/api practice module + web-learner PracticePage) ----

@Serializable
data class StartPracticeRequest(
    val contentId: String? = null,
    val segmentId: String? = null,
    val practiceType: String,
)

@Serializable
data class PracticeQuestion(
    val id: String,
    val questionIndex: Int = 0,
    val prompt: String,
    val options: List<String>? = null,
    val correctAnswer: String,
    val explanation: String? = null,
)

@Serializable
data class PracticeSession(
    val id: String,
    val contentId: String? = null,
    val segmentId: String? = null,
    val practiceType: String,
    val questionCount: Int = 0,
    val correctCount: Int? = null,
    val completedAt: String? = null,
    val questions: List<PracticeQuestion> = emptyList(),
)

@Serializable
data class SubmitAnswerItem(
    val questionId: String,
    val userAnswer: String,
)

@Serializable
data class SubmitPracticeRequest(
    val answers: List<SubmitAnswerItem>,
)

@Serializable
data class PracticeAnswerResult(
    val questionId: String,
    val userAnswer: String,
    val isCorrect: Boolean,
    val explanation: String? = null,
)

@Serializable
data class PracticeResultResponse(
    val session: PracticeSession? = null,
    val results: List<PracticeAnswerResult> = emptyList(),
    val score: Double = 0.0,
)
