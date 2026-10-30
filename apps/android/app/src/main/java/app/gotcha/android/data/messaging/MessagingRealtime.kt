package app.gotcha.android.data.messaging

import app.gotcha.android.data.TokenStore
import app.gotcha.android.data.model.ChatMessageDto
import app.gotcha.android.data.model.ConversationSummary
import app.gotcha.android.data.repo.MessagingRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min

sealed class MessagingEvent {
    data class MessageReceived(val conversationId: String, val message: ChatMessageDto) : MessagingEvent()
    data class ThreadUpdated(val conversationId: String, val messages: List<ChatMessageDto>) : MessagingEvent()
    data class PresenceUpdated(
        val conversationId: String,
        val online: Boolean,
        val lastSeenAt: String?,
        val typing: Boolean,
        val peerLastReadAt: String?,
    ) : MessagingEvent()
    data class InboxUpdated(val conversations: List<ConversationSummary>) : MessagingEvent()
    data class ConnectionState(val connected: Boolean, val transport: Transport) : MessagingEvent()

    enum class Transport { WEBSOCKET, POLLING, DISCONNECTED }
}

@Serializable
private data class WsEnvelope(
    val type: String? = null,
    @SerialName("conversationId") val conversationId: String? = null,
    val message: ChatMessageDto? = null,
)

/**
 * Real-time messaging transport for Android.
 *
 * Attempts a WebSocket connection to `/messaging/ws` (Bearer token). When the server
 * endpoint is unavailable — as in the current REST-only API — falls back to polite polling
 * so open chats still receive updates without manual refresh.
 */
private const val WEBSOCKET_ENABLED = false

class MessagingRealtimeHub(
    private val apiBaseUrl: String,
    private val tokenStore: TokenStore,
    private val messagingRepository: MessagingRepository,
    private val json: Json,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val wsClient = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val _events = MutableSharedFlow<MessagingEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<MessagingEvent> = _events.asSharedFlow()

    private val _unreadTotal = MutableStateFlow(0)
    val unreadTotal: StateFlow<Int> = _unreadTotal.asStateFlow()

    private var webSocket: WebSocket? = null
    private var pollJob: Job? = null
    private var reconnectJob: Job? = null
    private val reconnectAttempt = AtomicInteger(0)
    private val started = AtomicBoolean(false)
    private val activeConversationId = MutableStateFlow<String?>(null)

    fun setActiveConversation(id: String?) {
        activeConversationId.value = id
    }

    fun start() {
        if (!started.compareAndSet(false, true)) return
        scope.launch {
            if (tokenStore.accessToken().isNullOrBlank()) {
                started.set(false)
                return@launch
            }
            connectWebSocket()
        }
    }

    fun stop() {
        started.set(false)
        reconnectJob?.cancel()
        pollJob?.cancel()
        pollJob = null
        webSocket?.close(1000, "client_stop")
        webSocket = null
        scope.launch {
            _events.emit(
                MessagingEvent.ConnectionState(false, MessagingEvent.Transport.DISCONNECTED),
            )
        }
    }

    /** Endpoint without credentials: the token goes in the Authorization header, never the URL (REVIEW m11). */
    private fun wsUrl(): String? {
        val https = apiBaseUrl.trimEnd('/')
            .replace(Regex("^http://", RegexOption.IGNORE_CASE), "https://")
        if (!https.startsWith("https://", ignoreCase = true)) return null
        val wsBase = "wss://" + https.removePrefix("https://").removePrefix("HTTPS://")
        return "$wsBase/messaging/ws"
    }

    private suspend fun connectWebSocket() {
        // The API has no /messaging/ws endpoint (REST only), and a token in the query string would leak into
        // proxy logs. Poll until a server WebSocket with header auth ships; then flip WEBSOCKET_ENABLED.
        if (!WEBSOCKET_ENABLED) {
            startPolling()
            return
        }
        val url = wsUrl()
        val token = tokenStore.accessToken()
        if (url == null || token == null) {
            startPolling()
            return
        }
        val request = Request.Builder().url(url).header("Authorization", "Bearer $token").build()
        webSocket = wsClient.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    reconnectAttempt.set(0)
                    pollJob?.cancel()
                    pollJob = null
                    scope.launch {
                        _events.emit(
                            MessagingEvent.ConnectionState(true, MessagingEvent.Transport.WEBSOCKET),
                        )
                    }
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    scope.launch { handleWsPayload(text) }
                }

                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    webSocket.close(code, reason)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    if (started.get()) scheduleReconnect()
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    if (started.get()) {
                        scope.launch { startPolling() }
                        scheduleReconnect()
                    }
                }
            },
        )
        // If the endpoint does not exist the listener fires onFailure quickly → polling kicks in.
        delay(2_500)
        if (started.get() && pollJob == null && webSocket != null) {
            // No onOpen yet — assume WS unavailable and poll until reconnect succeeds.
            startPolling()
        }
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        val attempt = reconnectAttempt.incrementAndGet()
        val delayMs = min(30_000L, 1_000L shl min(attempt, 5))
        reconnectJob = scope.launch {
            delay(delayMs)
            if (started.get()) connectWebSocket()
        }
    }

    private fun startPolling() {
        if (pollJob?.isActive == true) return
        pollJob = scope.launch {
            _events.emit(
                MessagingEvent.ConnectionState(true, MessagingEvent.Transport.POLLING),
            )
            var lastInboxHash = 0
            var lastMessageIds = emptyMap<String, String>()
            var lastThreadStamps = emptyMap<String, String>()
            while (isActive && started.get()) {
                val activeId = activeConversationId.value
                try {
                    if (activeId != null) {
                        val detail = messagingRepository.conversation(activeId)
                        val lastId = detail.messages.lastOrNull()?.id
                        val prev = lastMessageIds[activeId]
                        if (lastId != null && prev != null && lastId != prev) {
                            detail.messages.lastOrNull()?.let { msg ->
                                _events.emit(MessagingEvent.MessageReceived(activeId, msg))
                            }
                        }
                        if (lastId != null) {
                            lastMessageIds = lastMessageIds + (activeId to lastId)
                        }
                        val stamp = detail.messages.joinToString("|") {
                            "${it.id}:${it.editedAt.orEmpty()}:${it.deleted}:${it.body}"
                        }
                        val prevStamp = lastThreadStamps[activeId]
                        if (prevStamp != null && prevStamp != stamp) {
                            _events.emit(MessagingEvent.ThreadUpdated(activeId, detail.messages))
                        }
                        lastThreadStamps = lastThreadStamps + (activeId to stamp)
                        runCatching {
                            messagingRepository.heartbeat()
                            val status = messagingRepository.status(activeId)
                            _events.emit(
                                MessagingEvent.PresenceUpdated(
                                    conversationId = activeId,
                                    online = status.peer?.online == true,
                                    lastSeenAt = status.peer?.lastSeenAt,
                                    typing = status.peer?.typing == true,
                                    peerLastReadAt = status.peerLastReadAt,
                                ),
                            )
                        }
                        delay(3_000)
                    } else {
                        runCatching { messagingRepository.heartbeat() }
                        val inbox = messagingRepository.conversations()
                        _unreadTotal.value = inbox.sumOf { it.unreadCount }
                        val hash = inbox.joinToString { "${it.id}:${it.lastMessageAt}:${it.unreadCount}:${it.peer?.online}" }.hashCode()
                        if (hash != lastInboxHash) {
                            lastInboxHash = hash
                            _events.emit(MessagingEvent.InboxUpdated(inbox))
                        }
                        delay(12_000)
                    }
                } catch (_: Exception) {
                    delay(8_000)
                }
            }
        }
    }

    private suspend fun handleWsPayload(text: String) {
        runCatching {
            val envelope = json.decodeFromString(WsEnvelope.serializer(), text)
            when (envelope.type) {
                "message.new" -> {
                    val convId = envelope.conversationId ?: return
                    val msg = envelope.message ?: return
                    _events.emit(MessagingEvent.MessageReceived(convId, msg))
                }
                "inbox.updated" -> {
                    val inbox = messagingRepository.conversations()
                    _unreadTotal.value = inbox.sumOf { it.unreadCount }
                    _events.emit(MessagingEvent.InboxUpdated(inbox))
                }
            }
        }
    }

    fun destroy() {
        stop()
        scope.cancel()
    }
}
