package app.gotcha.android.data.repo

import app.gotcha.android.data.ChatLangs
import app.gotcha.android.data.ContentCacheStore
import app.gotcha.android.data.FetchResult
import app.gotcha.android.data.TokenStore
import app.gotcha.android.data.fetchWithCache
import app.gotcha.android.data.readCachedJson
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
import app.gotcha.android.data.model.ChatMessageDto
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.data.model.ConversationDetail
import app.gotcha.android.data.model.ConversationSummary
import app.gotcha.android.data.model.ContentListResponse
import app.gotcha.android.data.model.ContentStats
import app.gotcha.android.data.model.FeedResponse
import app.gotcha.android.data.model.ForgotPasswordRequest
import app.gotcha.android.data.model.ImportApplyRequest
import app.gotcha.android.data.model.ImportCheckoutRequest
import app.gotcha.android.data.model.ImportPasteRequest
import app.gotcha.android.data.model.ImportPreApplyRequest
import app.gotcha.android.data.model.ImportPricingResponse
import app.gotcha.android.data.model.OkMessageResponse
import app.gotcha.android.data.model.PracticeResultResponse
import app.gotcha.android.data.model.PracticeSession
import app.gotcha.android.data.model.RegisterResponse
import app.gotcha.android.data.model.ResendVerificationRequest
import app.gotcha.android.data.model.StartPracticeRequest
import app.gotcha.android.data.model.SubmitAnswerItem
import app.gotcha.android.data.model.SubmitPracticeRequest
import app.gotcha.android.data.model.UpdateImportFreeLimitsRequest
import app.gotcha.android.data.model.UpdateImportPageTierRequest
import app.gotcha.android.data.model.UpdateImportPricingRulesRequest
import app.gotcha.android.data.model.ImportQuoteRequest
import app.gotcha.android.data.model.ImportUrlRequest
import app.gotcha.android.data.model.ImportsListResponse
import app.gotcha.android.data.model.LoginRequest
import app.gotcha.android.data.model.LookupRequest
import app.gotcha.android.data.model.LookupResponse
import app.gotcha.android.data.model.TranslateRequest
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.NotificationReadResponse
import app.gotcha.android.data.model.NotificationsInboxResponse
import app.gotcha.android.data.model.MessagingPeer
import app.gotcha.android.data.model.RegisterRequest
import app.gotcha.android.data.model.ReviewVocabularyRequest
import app.gotcha.android.data.model.SaveVocabularyRequest
import app.gotcha.android.data.model.Segment
import app.gotcha.android.data.model.SegmentsResponse
import app.gotcha.android.data.model.UpdatePreferencesRequest
import app.gotcha.android.data.model.UpdateProfileRequest
import app.gotcha.android.data.model.UpdateProgressRequest
import app.gotcha.android.data.model.UserImport
import app.gotcha.android.data.model.UserPreferences
import app.gotcha.android.data.model.UserStats
import app.gotcha.android.data.model.VocabItem
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.util.Locale
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class AuthRepository(
    private val api: GotchaApi,
    private val tokenStore: TokenStore,
    private val json: Json,
) {
    suspend fun login(email: String, password: String): AuthResponse {
        val res = api.login(
            LoginRequest(
                email = email.trim().lowercase(),
                password = password,
            ),
        )
        persist(res)
        return res
    }

    /**
     * `/auth/register` requires email verification before a session is issued (see
     * AuthService.register) — it returns `{requiresEmailVerification, email, message}` with no
     * tokens, NOT an [AuthResponse]. Only the (production-disabled) dev-auth bypass returns
     * tokens directly. Callers must branch on [RegisterResponse.requiresEmailVerification].
     */
    suspend fun register(
        email: String,
        password: String,
        displayName: String?,
        nativeLanguage: String,
        targetLanguages: List<String>,
    ): RegisterResponse {
        val res = api.register(
            RegisterRequest(
                email = email.trim().lowercase(),
                password = password,
                displayName = displayName,
                nativeLanguage = nativeLanguage,
                targetLanguages = targetLanguages,
            ),
        )
        if (res.accessToken != null && res.refreshToken != null && res.user != null) {
            tokenStore.saveSession(
                access = res.accessToken,
                refresh = res.refreshToken,
                userJson = json.encodeToString(AuthUser.serializer(), res.user),
                isAdmin = res.isAdmin,
            )
        }
        return res
    }

    suspend fun forgotPassword(email: String): OkMessageResponse =
        api.forgotPassword(ForgotPasswordRequest(email))

    suspend fun resendVerification(email: String): OkMessageResponse =
        api.resendVerification(ResendVerificationRequest(email))

    suspend fun verifyEmail(token: String) = api.verifyEmail(token)

    suspend fun resetPassword(token: String, password: String) =
        api.resetPassword(
            app.gotcha.android.data.model.ResetPasswordRequest(token, password),
        )

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

class ContentRepository(
    private val api: GotchaApi,
    private val cache: ContentCacheStore,
    private val json: Json,
) {
    /** Production (gotchaa.uz) has POST /ai/lookup only — /ai/translate is local Nest, 404 live. */
    @Volatile
    private var translateRouteMissing = false

    private val memLock = Any()
    private val contentMem = LinkedHashMap<String, ContentItem>(16, 0.75f, true)
    private val segmentsMem = LinkedHashMap<String, List<Segment>>(8, 0.75f, true)

    private fun memContent(id: String): ContentItem? = synchronized(memLock) { contentMem[id] }

    private fun memSegments(id: String): List<Segment>? = synchronized(memLock) { segmentsMem[id] }

    private fun putMemContent(item: ContentItem) {
        if (item.id.isBlank()) return
        synchronized(memLock) {
            contentMem[item.id] = item
            while (contentMem.size > 32) contentMem.remove(contentMem.keys.first())
        }
    }

    private fun putMemSegments(id: String, segments: List<Segment>) {
        if (id.isBlank() || segments.isEmpty()) return
        synchronized(memLock) {
            segmentsMem[id] = segments
            while (segmentsMem.size > 12) segmentsMem.remove(segmentsMem.keys.first())
        }
    }

    suspend fun catalogLanguages() = api.catalogLanguages()

    suspend fun feed(): FeedResponse = feedFetch().data

    suspend fun feedFetch(): FetchResult<FeedResponse> = fetchWithCache(
        json = json,
        cacheKey = "feed",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.feed() },
        serializer = FeedResponse.serializer(),
    ).also { seedContentItems(it.data.readerWarmIds()) }

    suspend fun feedPeek(): FetchResult<FeedResponse>? = readCachedJson(
        json = json,
        cacheKey = "feed",
        readCache = cache::get,
        serializer = FeedResponse.serializer(),
    )

    suspend fun list(q: String? = null, type: String? = null): ContentListResponse =
        listFetch(q, type).data

    suspend fun listFetch(
        q: String? = null,
        type: String? = null,
    ): FetchResult<ContentListResponse> {
        val cacheKey = "library|${q.orEmpty()}|${type.orEmpty()}"
        return fetchWithCache(
            json = json,
            cacheKey = cacheKey,
            readCache = cache::get,
            writeCache = cache::put,
            fetch = { api.contentList(q = q, type = type, pageSize = 40) },
            serializer = ContentListResponse.serializer(),
        ).also { seedContentItems(it.data.items) }
    }

    suspend fun listPeek(
        q: String? = null,
        type: String? = null,
    ): FetchResult<ContentListResponse>? {
        val cacheKey = "library|${q.orEmpty()}|${type.orEmpty()}"
        return readCachedJson(
            json = json,
            cacheKey = cacheKey,
            readCache = cache::get,
            serializer = ContentListResponse.serializer(),
        )
    }

    suspend fun get(id: String): ContentItem = getFetch(id).data

    suspend fun getFetch(id: String): FetchResult<ContentItem> = fetchWithCache(
        json = json,
        cacheKey = "content|$id",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.content(id) },
        serializer = ContentItem.serializer(),
        shouldCache = { it.id.isNotBlank() },
    ).also { if (it.data.id.isNotBlank()) putMemContent(it.data) }

    fun contentMemory(id: String): ContentItem? = memContent(id)

    fun segmentsMemory(id: String): List<Segment>? = memSegments(id)

    suspend fun getPeek(id: String): FetchResult<ContentItem>? {
        memContent(id)?.let { return FetchResult(it, isStale = true) }
        return readCachedJson(
            json = json,
            cacheKey = "content|$id",
            readCache = cache::get,
            serializer = ContentItem.serializer(),
        )?.also { putMemContent(it.data) }
    }

    suspend fun segments(id: String): SegmentsResponse = segmentsFetch(id).data

    suspend fun segmentsFetch(id: String): FetchResult<SegmentsResponse> = fetchWithCache(
        json = json,
        cacheKey = "segments|$id",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { fetchAllSegments(id) },
        serializer = SegmentsResponse.serializer(),
        shouldCache = { it.segments.isNotEmpty() },
    ).also { if (it.data.segments.isNotEmpty()) putMemSegments(id, it.data.segments) }

    suspend fun segmentsPeek(id: String): FetchResult<SegmentsResponse>? {
        memSegments(id)?.let { return FetchResult(SegmentsResponse(contentId = id, segments = it), isStale = true) }
        return readCachedJson(
            json = json,
            cacheKey = "segments|$id",
            readCache = cache::get,
            serializer = SegmentsResponse.serializer(),
        )?.also { peeked ->
            if (peeked.data.segments.isNotEmpty()) putMemSegments(id, peeked.data.segments)
        }
    }

    /** Warm content|{id} + segments|{id} so the next Reader open can peek instantly. */
    suspend fun prefetchReader(id: String) {
        if (id.isBlank()) return
        val hasContent = getPeek(id) != null
        val hasSegments = segmentsPeek(id)?.data?.segments?.isNotEmpty() == true
        if (hasContent && hasSegments) return
        if (!hasContent) runCatching { getFetch(id) }
        if (!hasSegments) runCatching { segmentsFetch(id) }
    }

    suspend fun prefetchReaders(ids: List<String>, limit: Int = 8) {
        coroutineScope {
            ids.distinct().filter { it.isNotBlank() }.take(limit).map { id ->
                async { prefetchReader(id) }
            }.awaitAll()
        }
    }

    private suspend fun fetchAllSegments(id: String): SegmentsResponse {
        val all = ArrayList<Segment>()
        var from = 0
        var contentId = id
        val pageSize = 200
        repeat(80) {
            val page = api.segments(id, from = from, limit = pageSize)
            if (page.contentId.isNotBlank()) contentId = page.contentId
            all += page.segments
            if (page.segments.size < pageSize) {
                return SegmentsResponse(contentId = contentId, segments = all)
            }
            from += page.segments.size
        }
        return SegmentsResponse(contentId = contentId, segments = all)
    }

    private suspend fun seedContentItems(items: List<ContentItem>) {
        items.forEach { item ->
            if (item.id.isBlank()) return@forEach
            val key = "content|${item.id}"
            putMemContent(item)
            if (cache.get(key) == null) {
                runCatching { cache.put(key, json.encodeToString(ContentItem.serializer(), item)) }
            }
        }
    }
    suspend fun lookup(req: LookupRequest): LookupResponse = api.lookup(req)

    /**
     * Sentence translation for chat To-line.
     * Production has no POST /ai/translate (404). Web uses POST /ai/lookup
     * `{ token, sentence, lemma?, sourceLang, targetLang }` → `{ translation }`.
     * Lang codes must be AppLanguage: en/ru/uz/...
     */
    suspend fun translate(text: String, sourceLang: String, targetLang: String): String {
        val src = ChatLangs.apiCode(sourceLang)
        val dst = ChatLangs.apiCode(targetLang)
        val trimmed = text.trim()
        if (src == dst) return trimmed
        if (trimmed.isEmpty()) return trimmed

        if (!translateRouteMissing) {
            try {
                val res = api.translate(TranslateRequest(text = trimmed, sourceLang = src, targetLang = dst))
                return acceptTranslation(trimmed, res.translation)
            } catch (e: HttpException) {
                if (e.code() == 404 || e.code() == 405) {
                    translateRouteMissing = true
                } else {
                    throw e
                }
            }
        }
        return translateViaLookup(trimmed, src, dst)
    }

    private suspend fun translateViaLookup(text: String, src: String, dst: String): String {
        val parts = lookupChunks(text).map { chunk ->
            val token = chunk.take(LOOKUP_TOKEN_MAX)
            val res = api.lookup(
                LookupRequest(
                    token = token,
                    sentence = chunk.take(LOOKUP_SENTENCE_MAX).ifBlank { token },
                    lemma = token.lowercase(Locale.US),
                    sourceLang = src,
                    targetLang = dst,
                ),
            )
            val piece = res.translation?.trim().orEmpty()
            if (piece.isBlank()) error("Empty translation")
            piece
        }
        val joined = parts.joinToString(" ").trim()
        return acceptTranslation(text, joined)
    }

    private fun acceptTranslation(original: String, raw: String?): String {
        val out = raw?.trim().orEmpty()
        if (out.isBlank()) error("Empty translation")
        if (ChatLangs.sameText(out, original)) error("Translation unchanged")
        return out
    }

    private fun lookupChunks(text: String): List<String> {
        if (text.length <= LOOKUP_TOKEN_MAX) return listOf(text)
        val sentences = text.split(Regex("(?<=[.!?…])\\s+")).filter { it.isNotBlank() }
        val out = ArrayList<String>()
        for (sentence in sentences.ifEmpty { listOf(text) }) {
            if (sentence.length <= LOOKUP_TOKEN_MAX) {
                out += sentence
                continue
            }
            val buf = StringBuilder()
            for (word in sentence.split(Regex("\\s+"))) {
                if (buf.isNotEmpty() && buf.length + 1 + word.length > LOOKUP_TOKEN_MAX) {
                    out += buf.toString()
                    buf.clear()
                }
                if (buf.isNotEmpty()) buf.append(' ')
                if (word.length > LOOKUP_TOKEN_MAX) {
                    if (buf.isNotEmpty()) {
                        out += buf.toString()
                        buf.clear()
                    }
                    out += word.take(LOOKUP_TOKEN_MAX)
                } else {
                    buf.append(word)
                }
            }
            if (buf.isNotEmpty()) out += buf.toString()
        }
        return out.ifEmpty { listOf(text.take(LOOKUP_TOKEN_MAX)) }
    }

    companion object {
        private const val LOOKUP_TOKEN_MAX = 80
        private const val LOOKUP_SENTENCE_MAX = 500
    }

    suspend fun knownWords(): List<app.gotcha.android.data.model.KnownWord> = api.knownWords()

    suspend fun markKnownWord(lemma: String, sourceLang: String, status: String) =
        api.markKnownWord(
            app.gotcha.android.data.model.MarkKnownWordRequest(
                lemma = lemma,
                sourceLang = sourceLang,
                status = status,
            ),
        )

    suspend fun updateProgress(
        id: String,
        pct: Double,
        segmentId: String? = null,
        readSeconds: Int? = null,
        completed: Boolean? = null,
    ) = api.updateProgress(
        id,
        UpdateProgressRequest(
            segmentId = segmentId,
            progressPct = pct,
            readSeconds = readSeconds,
            completed = completed,
        ),
    )
}

class PracticeRepository(private val api: GotchaApi) {
    suspend fun start(contentId: String?, segmentId: String?, practiceType: String): PracticeSession =
        api.startPractice(StartPracticeRequest(contentId = contentId, segmentId = segmentId, practiceType = practiceType))

    suspend fun submit(sessionId: String, answers: List<SubmitAnswerItem>): PracticeResultResponse =
        api.submitPractice(sessionId, SubmitPracticeRequest(answers))

    suspend fun get(sessionId: String): PracticeSession = api.getPracticeSession(sessionId)
}

class VocabRepository(
    private val api: GotchaApi,
    private val cache: ContentCacheStore,
    private val json: Json,
) {
    suspend fun list(sort: String = "recent"): List<VocabItem> = listFetch(sort).data

    suspend fun listFetch(sort: String = "recent"): FetchResult<List<VocabItem>> = fetchWithCache(
        json = json,
        cacheKey = "vocab|$sort",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.vocabulary(sort) },
        serializer = kotlinx.serialization.builtins.ListSerializer(VocabItem.serializer()),
    )

    suspend fun listPeek(sort: String = "recent"): FetchResult<List<VocabItem>>? = readCachedJson(
        json = json,
        cacheKey = "vocab|$sort",
        readCache = cache::get,
        serializer = kotlinx.serialization.builtins.ListSerializer(VocabItem.serializer()),
    )

    suspend fun reviewQueue(limit: Int = 50): List<VocabItem> = api.reviewQueue(limit)
    suspend fun review(id: String, rating: String): VocabItem =
        api.reviewVocabulary(id, ReviewVocabularyRequest(rating.lowercase()))
    suspend fun save(req: SaveVocabularyRequest): VocabItem = api.saveVocabulary(req)
    suspend fun update(id: String, mastered: Boolean? = null, notes: String? = null): VocabItem =
        api.updateVocabulary(id, app.gotcha.android.data.model.UpdateVocabularyRequest(mastered, notes))
    suspend fun delete(id: String) = api.deleteVocabulary(id)
}

class ImportRepository(private val api: GotchaApi) {
    suspend fun list(): ImportsListResponse = api.imports()
    suspend fun delete(id: String) = api.deleteImport(id)
    suspend fun paste(title: String, text: String, language: String?, paymentId: String? = null): UserImport =
        api.importPaste(ImportPasteRequest(title, text, language, paymentId))
    suspend fun url(url: String, title: String?, language: String?, paymentId: String? = null): UserImport =
        api.importUrl(ImportUrlRequest(title, url, language, paymentId))
    suspend fun file(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        title: String?,
        language: String?,
        paymentId: String? = null,
    ): UserImport {
        val body = bytes.toRequestBody((mimeType.ifBlank { "application/octet-stream" }).toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", fileName, body)
        return api.importFile(
            file = part,
            title = title?.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaTypeOrNull()),
            language = language?.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaTypeOrNull()),
            paymentId = paymentId?.toRequestBody("text/plain".toMediaTypeOrNull()),
        )
    }
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
    suspend fun catalogCheckout(contentId: String) = api.catalogCheckout(contentId)
    suspend fun paymentStatus(id: String) = api.importPayment(id)
    suspend fun preApply(paymentId: String, cardNumber: String, expiry: String) =
        api.importPreApply(paymentId, ImportPreApplyRequest(cardNumber, expiry))
    suspend fun apply(paymentId: String, otp: String) =
        api.importApply(paymentId, ImportApplyRequest(otp))
    suspend fun retryOtp(paymentId: String) = api.importRetryOtp(paymentId)
    suspend fun cancel(paymentId: String, reason: String? = null) =
        api.importCancel(paymentId, app.gotcha.android.data.model.ImportCancelRequest(reason))
}

class MessagingRepository(
    private val api: GotchaApi,
    private val cache: ContentCacheStore,
    private val json: Json,
) {
    private val memLock = Any()
    private var memInbox: List<ConversationSummary> = emptyList()
    private val memThreads = LinkedHashMap<String, ConversationDetail>(16, 0.75f, true)
    private val memPeers = LinkedHashMap<String, MessagingPeer>(24, 0.75f, true)

    fun rememberPreview(summary: ConversationSummary) = synchronized(memLock) {
        memInbox = listOf(summary) + memInbox.filter { it.id != summary.id }
        summary.peer?.let { putMemPeerLocked(it) }
    }

    fun conversationMemory(id: String): ConversationDetail? = synchronized(memLock) {
        memThreads[id] ?: memInbox.firstOrNull { it.id == id }?.toOfflineDetail()
    }

    fun peerMemory(id: String): MessagingPeer? = synchronized(memLock) { memPeers[id] }

    suspend fun conversations(q: String? = null) = conversationsFetch(q).data

    suspend fun conversationsFetch(q: String? = null): FetchResult<List<ConversationSummary>> {
        if (!q.isNullOrBlank()) {
            return FetchResult(api.messagingConversations(q), isStale = false)
        }
        return fetchWithCache(
            json = json,
            cacheKey = INBOX_KEY,
            readCache = cache::get,
            writeCache = cache::put,
            fetch = { api.messagingConversations(null) },
            serializer = ListSerializer(ConversationSummary.serializer()),
        ).also { putMemInbox(it.data) }
    }

    suspend fun conversationsPeek(): FetchResult<List<ConversationSummary>>? {
        synchronized(memLock) {
            if (memInbox.isNotEmpty()) return FetchResult(memInbox, isStale = true)
        }
        return readCachedJson(
            json = json,
            cacheKey = INBOX_KEY,
            readCache = cache::get,
            serializer = ListSerializer(ConversationSummary.serializer()),
        )?.also { putMemInbox(it.data) }
    }

    suspend fun conversation(id: String) = conversationFetch(id).data

    suspend fun conversationFetch(id: String): FetchResult<ConversationDetail> = fetchWithCache(
        json = json,
        cacheKey = threadKey(id),
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.messagingConversation(id) },
        serializer = ConversationDetail.serializer(),
    ).also { putMemThread(it.data) }

    suspend fun conversationPeek(id: String): FetchResult<ConversationDetail>? {
        conversationMemory(id)?.let { return FetchResult(it, isStale = true) }
        readCachedJson(
            json = json,
            cacheKey = threadKey(id),
            readCache = cache::get,
            serializer = ConversationDetail.serializer(),
        )?.also { putMemThread(it.data) }?.let { return it }
        val summary = conversationsPeek()?.data?.firstOrNull { it.id == id } ?: return null
        return FetchResult(summary.toOfflineDetail(), isStale = true)
    }

    suspend fun start(peerUserId: String, contentId: String? = null, language: String? = null) =
        api.messagingStart(
            app.gotcha.android.data.model.StartConversationRequest(
                peerUserId = peerUserId,
                contentId = contentId,
                language = language,
            ),
        ).also { runCatching { cacheConversation(it) } }

    suspend fun send(
        conversationId: String,
        body: String,
        translation: String? = null,
        bodyLang: String? = null,
        replyToId: String? = null,
    ): ChatMessageDto {
        val sent = api.messagingSend(
            conversationId,
            app.gotcha.android.data.model.SendMessageRequest(
                body = body,
                translation = translation,
                bodyLang = bodyLang,
                replyToId = replyToId,
            ),
        )
        runCatching { appendCachedMessage(conversationId, sent) }
        return sent
    }

    suspend fun edit(
        conversationId: String,
        messageId: String,
        body: String,
        translation: String? = null,
        bodyLang: String? = null,
    ): ChatMessageDto {
        val updated = api.messagingEdit(
            conversationId,
            messageId,
            app.gotcha.android.data.model.EditMessageRequest(
                body = body,
                translation = translation,
                bodyLang = bodyLang,
            ),
        )
        runCatching { replaceCachedMessage(conversationId, updated) }
        return updated
    }

    suspend fun delete(conversationId: String, messageId: String): ChatMessageDto {
        val updated = api.messagingDelete(conversationId, messageId)
        runCatching { replaceCachedMessage(conversationId, updated) }
        return updated
    }

    suspend fun sendAndReload(
        conversationId: String,
        body: String,
        translation: String? = null,
        bodyLang: String? = null,
        replyToId: String? = null,
    ): ConversationDetail {
        send(conversationId, body.trim(), translation = translation, bodyLang = bodyLang, replyToId = replyToId)
        return conversationFetch(conversationId).data
    }

    suspend fun markRead(conversationId: String) = api.messagingMarkRead(conversationId)

    suspend fun heartbeat() = api.messagingPresence()

    suspend fun typing(conversationId: String) = api.messagingTyping(conversationId)

    suspend fun status(conversationId: String) = api.messagingStatus(conversationId)

    suspend fun suggestions() = suggestionsFetch().data

    suspend fun suggestionsFetch(): FetchResult<List<MessagingPeer>> = fetchWithCache(
        json = json,
        cacheKey = SUGGESTIONS_KEY,
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.messagingSuggestions() },
        serializer = ListSerializer(MessagingPeer.serializer()),
    ).also { it.data.forEach(::putMemPeer) }

    suspend fun suggestionsPeek(): FetchResult<List<MessagingPeer>>? = readCachedJson(
        json = json,
        cacheKey = SUGGESTIONS_KEY,
        readCache = cache::get,
        serializer = ListSerializer(MessagingPeer.serializer()),
    )?.also { it.data.forEach(::putMemPeer) }

    suspend fun learners(q: String? = null, lang: String? = null, sameReadings: Boolean? = null) =
        learnersFetch(q, lang, sameReadings).data

    suspend fun learnersFetch(
        q: String? = null,
        lang: String? = null,
        sameReadings: Boolean? = null,
    ): FetchResult<List<MessagingPeer>> = fetchWithCache(
        json = json,
        cacheKey = learnersKey(q, lang, sameReadings),
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.messagingLearners(q, lang, sameReadings) },
        serializer = ListSerializer(MessagingPeer.serializer()),
    )

    suspend fun learnersPeek(
        q: String? = null,
        lang: String? = null,
        sameReadings: Boolean? = null,
    ): FetchResult<List<MessagingPeer>>? = readCachedJson(
        json = json,
        cacheKey = learnersKey(q, lang, sameReadings),
        readCache = cache::get,
        serializer = ListSerializer(MessagingPeer.serializer()),
    )

    suspend fun peer(id: String) = peerFetch(id).data

    suspend fun peerFetch(id: String): FetchResult<MessagingPeer> = fetchWithCache(
        json = json,
        cacheKey = peerKey(id),
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.messagingPeer(id) },
        serializer = MessagingPeer.serializer(),
    ).also { putMemPeer(it.data) }

    suspend fun peerPeek(id: String): FetchResult<MessagingPeer>? {
        peerMemory(id)?.let { return FetchResult(it, isStale = true) }
        readCachedJson(
            json = json,
            cacheKey = peerKey(id),
            readCache = cache::get,
            serializer = MessagingPeer.serializer(),
        )?.also { putMemPeer(it.data) }?.let { return it }
        conversationsPeek()?.data?.firstOrNull { it.peer?.id == id }?.peer?.let {
            return FetchResult(it, isStale = true)
        }
        suggestionsPeek()?.data?.firstOrNull { it.id == id }?.let {
            return FetchResult(it, isStale = true)
        }
        return null
    }

    suspend fun cacheConversation(detail: ConversationDetail) {
        putMemThread(detail)
        cache.put(threadKey(detail.id), json.encodeToString(ConversationDetail.serializer(), detail))
        detail.peer?.let { cache.put(peerKey(it.id), json.encodeToString(MessagingPeer.serializer(), it)) }
    }

    private fun putMemInbox(list: List<ConversationSummary>) = synchronized(memLock) {
        memInbox = list
        list.forEach { it.peer?.let(::putMemPeerLocked) }
    }

    private fun putMemThread(detail: ConversationDetail) = synchronized(memLock) {
        memThreads[detail.id] = detail
        detail.peer?.let(::putMemPeerLocked)
        while (memThreads.size > 40) memThreads.remove(memThreads.keys.first())
    }

    private fun putMemPeer(peer: MessagingPeer) = synchronized(memLock) { putMemPeerLocked(peer) }

    private fun putMemPeerLocked(peer: MessagingPeer) {
        if (peer.id.isBlank()) return
        memPeers[peer.id] = peer
        while (memPeers.size > 64) memPeers.remove(memPeers.keys.first())
    }

    private suspend fun appendCachedMessage(conversationId: String, sent: ChatMessageDto) {
        val existing = conversationPeek(conversationId)?.data
        val messages = (existing?.messages.orEmpty().filter { it.id != sent.id }) + sent
        cacheConversation(
            ConversationDetail(
                id = conversationId,
                language = existing?.language,
                peer = existing?.peer,
                content = existing?.content,
                messages = messages,
                lastMessageAt = sent.createdAt ?: existing?.lastMessageAt,
            ),
        )
    }

    private suspend fun replaceCachedMessage(conversationId: String, updated: ChatMessageDto) {
        val existing = conversationPeek(conversationId)?.data ?: return
        cacheConversation(
            existing.copy(
                messages = existing.messages.map { if (it.id == updated.id) updated else it },
            ),
        )
    }

    private fun ConversationSummary.toOfflineDetail(): ConversationDetail {
        val last = lastMessage
        val seeded = if (last == null || (last.id.isNullOrBlank() && last.body.isNullOrBlank())) {
            emptyList()
        } else {
            listOf(
                ChatMessageDto(
                    id = last.id?.takeIf { it.isNotBlank() } ?: "cached-last-$id",
                    body = last.body.orEmpty(),
                    translation = last.translation,
                    senderId = last.senderId,
                    createdAt = last.createdAt ?: lastMessageAt,
                ),
            )
        }
        return ConversationDetail(
            id = id,
            language = language,
            peer = peer,
            content = content,
            messages = seeded,
            lastMessageAt = lastMessageAt,
        )
    }

    private companion object {
        const val INBOX_KEY = "msg|inbox"
        const val SUGGESTIONS_KEY = "msg|suggestions"
        fun threadKey(id: String) = "msg|thread|$id"
        fun peerKey(id: String) = "msg|peer|$id"
        fun learnersKey(q: String?, lang: String?, sameReadings: Boolean?) =
            "msg|learners|${q.orEmpty()}|${lang.orEmpty()}|$sameReadings"
    }
}

class UserRepository(
    private val api: GotchaApi,
    private val cache: ContentCacheStore,
    private val json: Json,
) {
    suspend fun me(): MeResponse = meFetch().data

    suspend fun meFetch(): FetchResult<MeResponse> = fetchWithCache(
        json = json,
        cacheKey = "me",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.me() },
        serializer = MeResponse.serializer(),
    )

    suspend fun mePeek(): FetchResult<MeResponse>? = readCachedJson(
        json = json,
        cacheKey = "me",
        readCache = cache::get,
        serializer = MeResponse.serializer(),
    )

    suspend fun stats(): UserStats = statsFetch().data

    suspend fun statsFetch(): FetchResult<UserStats> = fetchWithCache(
        json = json,
        cacheKey = "stats",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.stats() },
        serializer = UserStats.serializer(),
    )

    suspend fun statsPeek(): FetchResult<UserStats>? = readCachedJson(
        json = json,
        cacheKey = "stats",
        readCache = cache::get,
        serializer = UserStats.serializer(),
    )

    suspend fun updateProfile(
        displayName: String? = null,
        uiLanguage: String? = null,
        nativeLanguage: String? = null,
    ): AuthUser {
        val user = api.updateProfile(
            UpdateProfileRequest(
                displayName = displayName,
                uiLanguage = uiLanguage,
                nativeLanguage = nativeLanguage,
            ),
        )
        runCatching { meFetch() }
        return user
    }

    suspend fun uploadAvatar(bytes: ByteArray, fileName: String, mimeType: String): AuthUser {
        val body = bytes.toRequestBody((mimeType.ifBlank { "image/jpeg" }).toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", fileName, body)
        val user = api.uploadAvatar(part)
        runCatching { meFetch() }
        return user
    }

    suspend fun updatePreferences(
        dailyGoalMinutes: Int? = null,
        notificationsEnabled: Boolean? = null,
        readerFontScale: Double? = null,
        readerTheme: String? = null,
        readerLineSpacing: Double? = null,
        showKnownWords: Boolean? = null,
        ttsEnabled: Boolean? = null,
    ): UserPreferences {
        val prefs = api.updatePreferences(
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
        runCatching { meFetch() }
        return prefs
    }
    suspend fun changePassword(currentPassword: String, newPassword: String) =
        api.changePassword(
            app.gotcha.android.data.model.ChangePasswordRequest(
                currentPassword = currentPassword,
                newPassword = newPassword,
            ),
        )
    suspend fun deleteAccount(currentPassword: String) =
        api.deleteAccount(
            app.gotcha.android.data.model.DeleteAccountRequest(currentPassword = currentPassword),
        )

    suspend fun addTargetLanguage(targetLanguage: String, cefrLevel: String? = null, isPrimary: Boolean? = null) =
        api.addTargetLanguage(
            app.gotcha.android.data.model.AddTargetLanguageRequest(targetLanguage, cefrLevel, isPrimary),
        )

    suspend fun updateTargetLanguage(lang: String, cefrLevel: String? = null, isPrimary: Boolean? = null) =
        api.updateTargetLanguage(
            lang,
            app.gotcha.android.data.model.UpdateTargetLanguageRequest(cefrLevel, isPrimary),
        )

    suspend fun removeTargetLanguage(lang: String) = api.removeTargetLanguage(lang)

    suspend fun notifications(): NotificationsInboxResponse = notificationsFetch().data

    suspend fun notificationsFetch(): FetchResult<NotificationsInboxResponse> = fetchWithCache(
        json = json,
        cacheKey = "notifications",
        readCache = cache::get,
        writeCache = cache::put,
        fetch = { api.notifications() },
        serializer = NotificationsInboxResponse.serializer(),
    )

    suspend fun notificationsPeek(): FetchResult<NotificationsInboxResponse>? = readCachedJson(
        json = json,
        cacheKey = "notifications",
        readCache = cache::get,
        serializer = NotificationsInboxResponse.serializer(),
    )

    suspend fun markNotificationRead(id: String): NotificationReadResponse {
        val res = api.notificationRead(id)
        runCatching { notificationsFetch() }
        return res
    }

    suspend fun markAllNotificationsRead(): NotificationReadResponse {
        val res = api.notificationsReadAll()
        runCatching { notificationsFetch() }
        return res
    }
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
    suspend fun ingestPreview(body: AdminCreateContentRequest) = api.adminIngestPreview(body)
    suspend fun ingestPreviewFile(
        bytes: ByteArray,
        fileName: String,
        title: String,
        contentType: String,
        language: String,
    ) = api.adminIngestPreviewFile(
        MultipartBody.Part.createFormData(
            "file",
            fileName,
            bytes.toRequestBody("application/pdf".toMediaTypeOrNull()),
        ),
        title.toRequestBody("text/plain".toMediaTypeOrNull()),
        contentType.toRequestBody("text/plain".toMediaTypeOrNull()),
        language.toRequestBody("text/plain".toMediaTypeOrNull()),
    )
    suspend fun contentDetail(id: String) = api.adminContentDetail(id)
    suspend fun updateContent(id: String, body: app.gotcha.android.data.model.AdminUpdateContentRequest) =
        api.adminUpdateContent(id, body)
    suspend fun uploadContentCover(id: String, bytes: ByteArray, fileName: String, mimeType: String) =
        api.adminUploadContentCover(
            id,
            MultipartBody.Part.createFormData(
                "file",
                fileName,
                bytes.toRequestBody((mimeType.ifBlank { "image/jpeg" }).toMediaTypeOrNull()),
            ),
        )
    suspend fun publishContent(id: String): ContentItem = api.adminPublishContent(id)
    suspend fun archiveContent(id: String) = api.adminDeleteContent(id)
    suspend fun deleteContent(id: String) = api.adminDeleteContent(id)
    suspend fun importPricing(): ImportPricingResponse = api.importPricing()
    suspend fun updateImportPricingRules(body: UpdateImportPricingRulesRequest) = api.updateImportPricingRules(body)
    suspend fun updateImportPageTier(id: String, body: UpdateImportPageTierRequest) = api.updateImportPageTier(id, body)
    suspend fun updateImportFreeLimits(body: UpdateImportFreeLimitsRequest) = api.updateImportFreeLimits(body)
    suspend fun analytics(range: String = "7d") = api.adminAnalytics(range)
    suspend fun support() = api.adminSupport()
    suspend fun languages() = api.adminLanguages()
    suspend fun addLanguage(code: String) =
        api.adminAddLanguage(app.gotcha.android.data.model.AdminAddLanguageRequest(code))
    suspend fun removeLanguage(code: String) = api.adminRemoveLanguage(code)
    suspend fun updateLanguage(code: String, isEnabled: Boolean) =
        api.adminUpdateLanguage(
            code,
            app.gotcha.android.data.model.AdminUpdateLanguageRequest(
                isEnabled = isEnabled,
                status = if (isEnabled) "Active" else "Draft",
            ),
        )
    suspend fun gamification() = api.adminGamification()
    suspend fun updateAchievement(id: String, isActive: Boolean) =
        api.adminUpdateAchievement(
            id,
            app.gotcha.android.data.model.AdminUpdateAchievementRequest(isActive = isActive),
        )
    suspend fun notifications() = api.adminNotifications()
    suspend fun createCampaign(body: AdminCreateCampaignRequest) = api.adminCreateCampaign(body)
    suspend fun updateCampaign(id: String, body: AdminUpdateCampaignRequest) = api.adminUpdateCampaign(id, body)
    suspend fun levelTests() = api.adminLevelTests()
    suspend fun aiUsage(range: String = "today") = api.adminAiUsage(range)
    suspend fun settings() = api.adminSettings()
    suspend fun updateSettings(body: app.gotcha.android.data.model.AdminUpdateSettingsRequest) =
        api.adminUpdateSettings(body)
}
