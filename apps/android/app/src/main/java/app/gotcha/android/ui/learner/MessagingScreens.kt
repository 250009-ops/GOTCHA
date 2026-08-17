package app.gotcha.android.ui.learner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.DpOffset
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Done
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.R
import app.gotcha.android.data.ChatLangs
import app.gotcha.android.data.api.apiErrorMessage
import app.gotcha.android.data.model.APP_LANGUAGE_OPTIONS
import app.gotcha.android.data.model.AppLanguageOption
import app.gotcha.android.data.model.ChatMessageDto
import app.gotcha.android.data.model.ConversationDetail
import app.gotcha.android.data.model.MessageReplyToDto
import app.gotcha.android.data.model.ConversationSummary
import app.gotcha.android.data.model.LookupRequest
import app.gotcha.android.data.model.LookupResponse
import app.gotcha.android.data.model.MeResponse
import app.gotcha.android.data.model.MessagingPeer
import app.gotcha.android.data.model.SaveVocabularyRequest
import app.gotcha.android.data.messaging.MessagingEvent
import app.gotcha.android.ui.components.ChatSkeleton
import app.gotcha.android.ui.components.InlineListRowSkeleton
import app.gotcha.android.ui.components.OfflineBannerIfNeeded
import app.gotcha.android.ui.components.OfflineEmptyState
import app.gotcha.android.ui.components.SkeletonBox
import app.gotcha.android.ui.components.rememberOfflineInteraction
import app.gotcha.android.ui.theme.GotchaColors
import app.gotcha.android.ui.theme.Manrope
import coil.compose.AsyncImage
import app.gotcha.android.data.model.coverUrl
import app.gotcha.android.data.resolveMediaUrl
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

@Composable
private fun messagingBottomPad(): androidx.compose.ui.unit.Dp = messagingDirBottomPad()

private fun messagingInitials(name: String?): String {
    val parts = name.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(2).uppercase(Locale.getDefault())
        else -> "${parts[0].first()}${parts[1].first()}".uppercase(Locale.getDefault())
    }
}

private fun langChipColors(code: String): Pair<Color, Color> = when (code.uppercase(Locale.getDefault())) {
    "RU" -> Color(0xFFF0E7FF) to Color(0xFF7008E7)
    "EN" -> Color(0xFFE0F2FE) to Color(0xFF0369A1)
    "UZ" -> Color(0xFFECFDF5) to Color(0xFF047857)
    "FR" -> Color(0xFFFEF3C7) to Color(0xFFB45309)
    "JA" -> Color(0xFFFFE4E6) to Color(0xFFBE123C)
    else -> Color(0xFFF3F4F6) to Color(0xFF4A5565)
}

@Composable
private fun MsgLangChip(code: String) {
    val c = code.uppercase(Locale.getDefault()).take(2)
    val (bg, fg) = langChipColors(c)
    Text(
        c,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 2.dp),
        fontFamily = Manrope,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        color = fg,
    )
}

private fun langMeta(code: String): AppLanguageOption {
    val c = ChatLangs.normalize(code).lowercase(Locale.US)
    return APP_LANGUAGE_OPTIONS.firstOrNull { it.code == c }
        ?: AppLanguageOption(c, code, langName(code), "🌐")
}

@Composable
private fun ToLangPicker(
    selected: String,
    options: List<String>,
    onSelect: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    var menuWidth by remember { mutableStateOf(120.dp) }
    val selectedMeta = langMeta(selected)
    val code = selectedMeta.code.uppercase(Locale.US)
    val (bg, fg) = langChipColors(code)
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(bg)
                .clickable { open = true }
                .onSizeChanged { size ->
                    menuWidth = with(density) { size.width.toDp() }.coerceAtLeast(120.dp)
                }
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                "To",
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.sp,
                color = fg.copy(alpha = 0.75f),
            )
            Text(
                "${selectedMeta.flag} $code",
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                color = fg,
            )
            Icon(
                painter = painterResource(R.drawable.ic_chevron_down),
                contentDescription = "Choose To language",
                tint = fg,
                modifier = Modifier.size(12.dp),
            )
        }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            offset = DpOffset(0.dp, 8.dp),
            modifier = Modifier.width(menuWidth),
            shape = RoundedCornerShape(12.dp),
            containerColor = Color.White,
            shadowElevation = 8.dp,
            tonalElevation = 0.dp,
        ) {
            options.forEach { opt ->
                val meta = langMeta(opt)
                val active = ChatLangs.normalize(opt) == ChatLangs.normalize(selected)
                DropdownMenuItem(
                    text = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(meta.flag, fontSize = 16.sp)
                            Text(
                                "${meta.englishLabel} (${meta.code.uppercase(Locale.US)})",
                                fontFamily = Manrope,
                                fontWeight = if (active) FontWeight.ExtraBold else FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = if (active) GotchaColors.BrandPurple else GotchaColors.Ink,
                            )
                        }
                    },
                    onClick = {
                        onSelect(ChatLangs.normalize(opt))
                        open = false
                    },
                )
            }
        }
    }
}

private fun relativeAgo(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val then = Instant.parse(iso).toEpochMilli()
        val mins = ((System.currentTimeMillis() - then) / 60000).toInt()
        when {
            mins < 1 -> "now"
            mins < 60 -> "${mins}m ago"
            mins < 1440 -> "${mins / 60}h ago"
            mins < 2880 -> "Yesterday"
            else -> "${mins / 1440}d ago"
        }
    } catch (_: Exception) {
        ""
    }
}

private fun clockTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val zdt = Instant.parse(iso).atZone(ZoneId.systemDefault())
        DateTimeFormatter.ofPattern("h:mm a").format(zdt)
    } catch (_: Exception) {
        ""
    }
}

private const val MESSAGE_EDIT_WINDOW_MS = 48L * 60L * 60L * 1000L

private fun canEditMessage(msg: ChatMessageDto): Boolean {
    if (!msg.mine || msg.deleted) return false
    val created = runCatching { Instant.parse(msg.createdAt.orEmpty()).toEpochMilli() }.getOrNull()
        ?: return false
    return System.currentTimeMillis() - created < MESSAGE_EDIT_WINDOW_MS
}

private fun messageSnippet(body: String?, deleted: Boolean, fallback: String = "Message"): String {
    if (deleted) return "Message deleted"
    val text = body?.trim().orEmpty()
    if (text.isBlank()) return fallback
    return if (text.length > 80) text.take(80) + "…" else text
}

private fun presenceLabel(online: Boolean, lastSeenAt: String?, typing: Boolean): String {
    if (typing) return "typing…"
    if (online) return "online"
    if (lastSeenAt.isNullOrBlank()) return "last seen recently"
    val ms = runCatching {
        System.currentTimeMillis() - Instant.parse(lastSeenAt).toEpochMilli()
    }.getOrNull() ?: return "last seen recently"
    val mins = (ms / 60_000L).toInt()
    if (mins < 1) return "last seen just now"
    if (mins < 60) return "last seen ${mins}m ago"
    val hours = mins / 60
    if (hours < 24) return "last seen ${hours}h ago"
    return "last seen ${hours / 24}d ago"
}

private fun applyReadReceipts(messages: List<ChatMessageDto>, peerLastReadAt: String?): List<ChatMessageDto> {
    if (peerLastReadAt.isNullOrBlank()) return messages
    val readAt = runCatching { Instant.parse(peerLastReadAt).toEpochMilli() }.getOrNull() ?: return messages
    return messages.map { msg ->
        if (!msg.mine || msg.status == "sending" || msg.status == "failed" || msg.id.startsWith("local-")) msg
        else {
            val created = runCatching { Instant.parse(msg.createdAt.orEmpty()).toEpochMilli() }.getOrNull()
            msg.copy(status = if (created != null && created <= readAt) "read" else "sent")
        }
    }
}

@Composable
private fun AvatarCircle(name: String?, url: String?, size: androidx.compose.ui.unit.Dp = 44.dp, online: Boolean = false) {
    var imageFailed by remember(url) { mutableStateOf(false) }
    val initials = messagingInitials(name)
    Box(modifier = Modifier.size(size)) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(CircleShape)
            .background(GotchaColors.BrandPurpleSoft),
        contentAlignment = Alignment.Center,
    ) {
        val resolved = resolveMediaUrl(url)
        if (!resolved.isNullOrBlank() && !imageFailed) {
            AsyncImage(
                model = resolved,
                contentDescription = name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                onError = { imageFailed = true },
            )
        } else {
            Text(
                initials,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.35f).sp,
                color = GotchaColors.BrandPurple,
            )
        }
    }
        if (online) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size((size.value * 0.28f).dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .padding(1.5.dp),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .background(Color(0xFF22C55E)),
                )
            }
        }
    }
}

@Composable
fun MessagesInboxScreen(
    onBack: () -> Unit,
    onOpenChat: (conversationId: String) -> Unit,
    onFindLearners: () -> Unit,
    onOpenPeer: (peerId: String) -> Unit,
    embedded: Boolean = false,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var conversations by remember { mutableStateOf<List<ConversationSummary>>(emptyList()) }
    var suggestions by remember { mutableStateOf<List<MessagingPeer>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    val bottomPad = messagingBottomPad()
    val topPad = if (embedded) LocalLearnerTopInset.current else 0.dp
    val offline = rememberOfflineInteraction(container.connectivityObserver)

    fun reload() {
        scope.launch {
            loading = conversations.isEmpty() && suggestions.isEmpty()
            error = null
            if (conversations.isEmpty()) {
                container.messagingRepository.conversationsPeek()?.let { peek ->
                    conversations = peek.data
                    loading = false
                }
            }
            if (suggestions.isEmpty()) {
                container.messagingRepository.suggestionsPeek()?.let { peek ->
                    suggestions = peek.data
                    loading = false
                }
            }
            try {
                conversations = container.messagingRepository.conversationsFetch().data
                suggestions = runCatching { container.messagingRepository.suggestionsFetch().data }
                    .getOrDefault(suggestions)
            } catch (e: Exception) {
                if (conversations.isEmpty() && suggestions.isEmpty()) {
                    error = e.apiErrorMessage("Failed to load messages")
                }
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }
    LaunchedEffect(Unit) {
        container.messagingRealtime.events.collectLatest { event ->
            when (event) {
                is MessagingEvent.InboxUpdated -> conversations = event.conversations
                else -> Unit
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .then(if (!embedded) Modifier.messagingDirectoryStatusPad() else Modifier),
    ) {
        if (!embedded) {
            MessagingDirectoryHeader(title = "Messages", onBack = onBack)
        }

        val filteredConversations = remember(conversations, searchQuery) {
            val q = searchQuery.trim().lowercase(Locale.getDefault())
            if (q.isBlank()) conversations
            else conversations.filter { c ->
                val name = c.peer?.displayName.orEmpty().lowercase(Locale.getDefault())
                val handle = c.peer?.handle.orEmpty().lowercase(Locale.getDefault())
                val body = c.lastMessage?.body.orEmpty().lowercase(Locale.getDefault())
                name.contains(q) || handle.contains(q) || body.contains(q)
            }
        }
        val listLoading = loading && conversations.isEmpty() && suggestions.isEmpty()

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = topPad + if (embedded) 8.dp else 8.dp,
                bottom = bottomPad,
            ),
        ) {
            if (embedded) {
                item {
                    Text(
                        "Messages",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 28.sp,
                        color = GotchaColors.Ink,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                    )
                }
            }
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(14.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Outlined.Search, null, tint = GotchaColors.TextSubtle, modifier = Modifier.size(20.dp))
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        textStyle = TextStyle(fontFamily = Manrope, fontSize = 15.sp, color = GotchaColors.Ink),
                        cursorBrush = SolidColor(GotchaColors.BrandPurple),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        decorationBox = { inner ->
                            if (searchQuery.isBlank()) {
                                Text(
                                    "Search conversations, learners...",
                                    fontFamily = Manrope,
                                    color = GotchaColors.TextSubtle,
                                    fontSize = 15.sp,
                                )
                            }
                            inner()
                        },
                    )
                }
                Spacer(Modifier.height(16.dp))
            }

            if (conversations.isNotEmpty() || suggestions.isNotEmpty()) {
                item {
                    OfflineBannerIfNeeded(
                        connectivity = container.connectivityObserver,
                        hasCachedContent = true,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                    )
                }
            }

            if (error != null && conversations.isEmpty() && suggestions.isEmpty() && !loading) {
                item {
                    OfflineEmptyState(
                        subtitle = "Connect to the internet to load your conversations.",
                        onRetry = { reload() },
                        compact = true,
                    )
                }
            }

            if (!listLoading && suggestions.isNotEmpty()) {
                item {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Suggested from Readings",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = GotchaColors.Ink,
                        )
                        Text(
                            "Find more",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = GotchaColors.BrandPurple,
                            modifier = Modifier.clickable(onClick = onFindLearners),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        suggestions.take(8).forEach { s ->
                            SuggestedCard(s) {
                                offline.guardClick {
                                    scope.launch {
                                        try {
                                            val detail = container.messagingRepository.start(
                                                peerUserId = s.id,
                                                contentId = s.reading?.id,
                                            )
                                            onOpenChat(detail.id)
                                        } catch (e: Exception) {
                                            error = e.apiErrorMessage("Couldn't start this chat")
                                        }
                                    }
                                }()
                            }
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }

            item {
                Text(
                    "Recent Chats",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = GotchaColors.Ink,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
            }

            if (listLoading) {
                item {
                    InlineListRowSkeleton(
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                    )
                }
            } else if (conversations.isEmpty()) {
                item {
                    Text(
                        "No conversations yet. Find learners from shared readings.",
                        fontFamily = Manrope,
                        color = GotchaColors.TextMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                    )
                }
            } else if (filteredConversations.isEmpty()) {
                item {
                    Text(
                        "No conversations match your search.",
                        fontFamily = Manrope,
                        color = GotchaColors.TextMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                    )
                }
            } else {
                items(filteredConversations, key = { it.id }) { c ->
                    ChatRow(
                        conversation = c,
                        onClick = {
                            container.messagingRepository.rememberPreview(c)
                            onOpenChat(c.id)
                        },
                        onAvatar = { c.peer?.id?.let(onOpenPeer) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SuggestedCard(peer: MessagingPeer, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(154.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            AvatarCircle(peer.displayName, peer.avatarUrl, 36.dp, online = peer.online)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    peer.displayName.orEmpty(),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = GotchaColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    peer.handle.orEmpty(),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    color = GotchaColors.TextSubtle,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            MsgLangChip(peer.primaryLanguage ?: peer.nativeLanguage ?: "en")
            Text("Learner", fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = GotchaColors.TextMuted)
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            peer.reading?.coverUrl()?.let { url ->
                CoverThumb(url, Modifier.size(width = 28.dp, height = 40.dp), corner = 6)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
                Text("READING", fontFamily = Manrope, fontSize = 10.sp, color = GotchaColors.TextSubtle)
                Text(
                    peer.reading?.title ?: "Shared reading",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = GotchaColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ChatRow(
    conversation: ConversationSummary,
    onClick: () -> Unit,
    onAvatar: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .border(width = 0.dp, color = Color.Transparent, shape = RoundedCornerShape(0))
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.clickable(onClick = onAvatar)) {
                AvatarCircle(conversation.peer?.displayName, conversation.peer?.avatarUrl, 44.dp, online = conversation.peer?.online == true)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        conversation.peer?.displayName ?: "Learner",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = GotchaColors.Ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    MsgLangChip(conversation.language ?: conversation.peer?.primaryLanguage ?: "en")
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        conversation.lastMessage?.body ?: "No messages yet",
                        fontFamily = Manrope,
                        fontSize = 13.sp,
                        fontStyle = if (conversation.lastMessage?.deleted == true) FontStyle.Italic else FontStyle.Normal,
                        color = GotchaColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (!conversation.lastMessage?.deleted && !conversation.lastMessage?.translation.isNullOrBlank()) {
                        Icon(
                            Icons.Outlined.Translate,
                            contentDescription = "Translated message",
                            tint = GotchaColors.BrandPurple,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                relativeAgo(conversation.lastMessageAt ?: conversation.lastMessage?.createdAt),
                fontFamily = Manrope,
                fontSize = 11.sp,
                color = GotchaColors.TextSubtle,
            )
            if (conversation.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(GotchaColors.BrandPurple),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "${conversation.unreadCount.coerceAtMost(9)}",
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 10.sp,
                        color = Color.White,
                    )
                }
            }
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagingChatScreen(
    conversationId: String,
    onBack: () -> Unit,
    onOpenPeer: (peerId: String) -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val seeded = remember(conversationId) {
        container.messagingRepository.conversationMemory(conversationId)
    }
    var detail by remember(conversationId) { mutableStateOf(seeded) }
    var draft by remember(conversationId) { mutableStateOf("") }
    var loading by remember(conversationId) { mutableStateOf(seeded == null) }
    var error by remember(conversationId) { mutableStateOf<String?>(null) }
    var actionError by remember(conversationId) { mutableStateOf<String?>(null) }
    var translateHint by remember(conversationId) { mutableStateOf<String?>(null) }
    var tipVisible by remember(conversationId) { mutableStateOf(true) }
    var selectedWord by remember(conversationId) { mutableStateOf<String?>(null) }
    var selectedSentence by remember(conversationId) { mutableStateOf("") }
    var selectedNativeLine by remember(conversationId) { mutableStateOf("") }
    var selectedLineLang by remember(conversationId) { mutableStateOf("EN") }
    var lookup by remember(conversationId) { mutableStateOf<LookupResponse?>(null) }
    val highlightWord = if (lookup?.kind == "sentence") selectedWord
        else lookup?.phrase?.takeIf { it.isNotBlank() } ?: selectedWord
    var lookupLoading by remember(conversationId) { mutableStateOf(false) }
    var lookupError by remember(conversationId) { mutableStateOf<String?>(null) }
    var savedMsg by remember(conversationId) { mutableStateOf<String?>(null) }
    var nativeLang by remember(conversationId) { mutableStateOf("EN") }
    var toLangOverride by remember(conversationId) { mutableStateOf<String?>(null) }
    var toLangReady by remember(conversationId) { mutableStateOf(false) }
    var pending by remember(conversationId) { mutableStateOf<List<ChatMessageDto>>(emptyList()) }
    var replyTo by remember(conversationId) { mutableStateOf<ChatMessageDto?>(null) }
    var editing by remember(conversationId) { mutableStateOf<ChatMessageDto?>(null) }
    var confirmDelete by remember(conversationId) { mutableStateOf<ChatMessageDto?>(null) }
    var lastTypingAt by remember(conversationId) { mutableStateOf(0L) }
    var langOverlay by remember(conversationId) { mutableStateOf<Map<String, String>>(emptyMap()) }
    var linesById by remember(conversationId) { mutableStateOf<Map<String, Pair<String, String>>>(emptyMap()) }
    val listState = rememberLazyListState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val offline = rememberOfflineInteraction(container.connectivityObserver)
    val serverMessages = detail?.messages.orEmpty()
    val messages = remember(serverMessages, pending) {
        val ids = serverMessages.map { it.id }.toSet()
        serverMessages + pending.filter { it.id !in ids }
    }
    val toOptions = ChatLangs.others(nativeLang)
    val toLang = remember(nativeLang, toLangOverride, detail) {
        ChatLangs.coerceTo(
            nativeLang,
            toLangOverride ?: ChatLangs.learningTarget(
                nativeLang,
                detail?.peer?.nativeLanguage,
                toOptions.firstOrNull(),
            ),
        )
    }
    fun persistTo(code: String) {
        val next = ChatLangs.coerceTo(nativeLang, code)
        toLangOverride = next
        scope.launch { container.chatLangStore.saveToLang(conversationId, next) }
    }

    suspend fun translateToward(text: String, sourceLang: String, destLang: String): String {
        val src = ChatLangs.normalize(sourceLang)
        val dst = ChatLangs.normalize(destLang)
        if (src == dst) return text
        container.chatLangStore.cachedTranslation(text, src, dst)
            ?.takeIf { it.isNotBlank() && !ChatLangs.sameText(it, text) }
            ?.let { return it }
        val out = container.contentRepository.translate(text, src, dst)
        if (out.isBlank() || ChatLangs.sameText(out, text)) error("Translation unchanged")
        if (src == "RU" && looksLikeLang(out, src)) error("Translation still in $src")
        container.chatLangStore.rememberTranslation(text, src, dst, out)
        return out
    }

    suspend fun tryTranslate(text: String, sourceLang: String, destLang: String): String? {
        val src = ChatLangs.normalize(sourceLang)
        val dst = ChatLangs.normalize(destLang)
        if (src == dst) return text
        repeat(2) {
            try {
                return translateToward(text, src, dst)
            } catch (_: Exception) {
            }
        }
        return null
    }

    fun rememberPair(messageId: String, toText: String?, nativeText: String?) {
        val extras = buildMap {
            toText?.takeIf { it.isNotBlank() }?.let { put(overlayKey(messageId, toLang), it) }
            nativeText?.takeIf { it.isNotBlank() }?.let { put(overlayKey(messageId, nativeLang), it) }
        }
        if (extras.isNotEmpty()) langOverlay = langOverlay + extras
        val top = toText?.trim().orEmpty()
        val bottom = nativeText?.trim().orEmpty()
        linesById = linesById + (messageId to (top to bottom))
    }

    fun load() {
        scope.launch {
            error = null
            if (detail == null) {
                loading = true
                container.messagingRepository.conversationPeek(conversationId)?.let { peek ->
                    detail = peek.data
                    loading = false
                }
            }
            try {
                val fresh = container.messagingRepository.conversationFetch(conversationId).data
                detail = fresh
                runCatching { container.messagingRepository.markRead(conversationId) }
            } catch (e: Exception) {
                if (detail == null) {
                    error = e.apiErrorMessage("Failed to load chat")
                }
            } finally {
                loading = false
            }
        }
    }

    fun replaceMessage(updated: ChatMessageDto) {
        detail = detail?.let { d ->
            d.copy(messages = d.messages.map { if (it.id == updated.id) updated else it })
        }
        detail?.let { cached ->
            scope.launch { runCatching { container.messagingRepository.cacheConversation(cached) } }
        }
    }

    fun startReply(msg: ChatMessageDto) {
        if (msg.deleted) return
        editing = null
        replyTo = msg
    }

    fun startEdit(msg: ChatMessageDto) {
        if (!canEditMessage(msg)) return
        replyTo = null
        editing = msg
        draft = linesById[msg.id]?.second?.takeIf { it.isNotBlank() }
            ?: msg.translation?.takeIf { it.isNotBlank() }
            ?: msg.body
    }

    fun cancelComposerMode() {
        replyTo = null
        if (editing != null) draft = ""
        editing = null
    }

    fun deleteConfirmed(msg: ChatMessageDto) {
        if (!offline.isOnline) {
            offline.guardClick {}()
            return
        }
        confirmDelete = null
        scope.launch {
            try {
                replaceMessage(container.messagingRepository.delete(conversationId, msg.id))
            } catch (e: Exception) {
                actionError = e.apiErrorMessage("Failed to delete")
            }
        }
    }

    fun sendMessage() {
        if (!offline.isOnline) {
            offline.guardClick {}()
            return
        }
        val text = draft.trim()
        if (text.isBlank()) return
        val editingMsg = editing
        draft = ""
        actionError = null
        translateHint = null
        if (editingMsg != null) {
            editing = null
            scope.launch {
                val to = ChatLangs.normalize(toLang)
                val native = ChatLangs.normalize(nativeLang)
                val source = ChatLangs.inferComposerSource(text, native, to)
                var toText: String? = if (source == to) text else null
                var nativeText: String? = if (source == native) text else null
                repeat(3) { attempt ->
                    if (toText == null) toText = tryTranslate(text, source, to)
                    if (nativeText == null) {
                        nativeText = tryTranslate(text, source, native)
                            ?: toText?.let { tryTranslate(it, to, native) }
                    }
                    if (toText != null && nativeText != null) return@repeat
                    if (attempt < 2) delay(400L * (attempt + 1))
                }
                val sendBody = toText ?: text
                val sendLang = if (toText != null) to else source
                val sendNative = nativeText?.takeIf { it.isNotBlank() && !ChatLangs.sameText(it, sendBody) }
                try {
                    val updated = container.messagingRepository.edit(
                        conversationId,
                        editingMsg.id,
                        sendBody,
                        translation = sendNative,
                        bodyLang = sendLang.lowercase(Locale.US),
                    )
                    rememberPair(updated.id, toText, nativeText)
                    replaceMessage(updated)
                } catch (e: Exception) {
                    draft = text
                    editing = editingMsg
                    actionError = e.apiErrorMessage("Failed to edit")
                }
            }
            return
        }
        val replyTarget = replyTo
        replyTo = null
        val localId = "local-${UUID.randomUUID()}"
        val to = ChatLangs.normalize(toLang)
        val native = ChatLangs.normalize(nativeLang)
        val source = ChatLangs.inferComposerSource(text, native, to)
        val nowIso = Instant.now().toString()
        val nativeSeed = if (source == native) text else ""
        pending = pending + ChatMessageDto(
            id = localId,
            body = if (source == to) text else "",
            translation = nativeSeed.takeIf { it.isNotBlank() },
            bodyLang = to.lowercase(Locale.US),
            mine = true,
            createdAt = nowIso,
            status = "sending",
            replyTo = replyTarget?.let {
                MessageReplyToDto(
                    id = it.id,
                    body = it.body,
                    senderId = it.senderId.orEmpty(),
                    deleted = it.deleted,
                )
            },
        )
        rememberPair(localId, if (source == to) text else null, nativeSeed.takeIf { it.isNotBlank() })
        scope.launch {
            var toText: String? = if (source == to) text else null
            var nativeText: String? = if (source == native) text else null
            repeat(3) { attempt ->
                if (toText == null) toText = tryTranslate(text, source, to)
                if (nativeText == null) {
                    nativeText = tryTranslate(text, source, native)
                        ?: toText?.let { tryTranslate(it, to, native) }
                }
                rememberPair(localId, toText, nativeText)
                pending = pending.map { msg ->
                    if (msg.id != localId) msg
                    else msg.copy(
                        body = toText ?: "",
                        translation = nativeText,
                        bodyLang = to.lowercase(Locale.US),
                    )
                }
                if (toText != null && nativeText != null) return@repeat
                if (attempt < 2) delay(400L * (attempt + 1))
            }
            if (toText == null) {
                translateHint = "Couldn’t translate to ${langName(to)} yet. Your original is below — retrying."
            }
            val sendBody = toText ?: text
            val sendLang = if (toText != null) to else source
            val sendNative = nativeText?.takeIf { it.isNotBlank() && !ChatLangs.sameText(it, sendBody) }
            try {
                val sent = container.messagingRepository.send(
                    conversationId,
                    sendBody,
                    translation = sendNative,
                    bodyLang = sendLang.lowercase(Locale.US),
                    replyToId = replyTarget?.id,
                )
                val merged = sent.copy(
                    body = toText ?: sent.body.ifBlank { text },
                    translation = sent.translation?.takeIf { it.isNotBlank() } ?: nativeText,
                    bodyLang = (if (toText != null) to else detected).lowercase(Locale.US),
                    status = sent.status ?: "sent",
                )
                rememberPair(merged.id, toText, nativeText)
                pending = pending.filter { it.id != localId }
                val next = detail?.let { d ->
                    if (d.messages.any { it.id == merged.id }) d
                    else d.copy(messages = d.messages + merged)
                }
                detail = next
                next?.let { cached ->
                    runCatching { container.messagingRepository.cacheConversation(cached) }
                }
            } catch (e: Exception) {
                pending = pending.filter { it.id != localId }
                replyTo = replyTarget
                actionError = e.apiErrorMessage("Failed to send message")
            }
        }
    }

    LaunchedEffect(conversationId) {
        container.messagingRealtime.setActiveConversation(conversationId)
        load()
    }
    LaunchedEffect(conversationId) {
        var native = "en"
        fun applyMe(me: MeResponse) {
            native = me.nativeLanguage?.lowercase()?.ifBlank { "en" } ?: "en"
        }
        container.userRepository.mePeek()?.data?.let(::applyMe)
        runCatching { applyMe(container.userRepository.me()) }
        nativeLang = ChatLangs.normalize(native)
        val saved = runCatching { container.chatLangStore.savedToLang(conversationId) }.getOrNull()
        if (saved != null) toLangOverride = ChatLangs.coerceTo(nativeLang, saved)
        toLangReady = true
    }
    LaunchedEffect(conversationId, toLangReady, nativeLang, detail) {
        if (!toLangReady || toLangOverride != null || detail == null) return@LaunchedEffect
        persistTo(toLang)
    }
    DisposableEffect(conversationId) {
        onDispose { container.messagingRealtime.setActiveConversation(null) }
    }
    LaunchedEffect(Unit) {
        container.messagingRealtime.events.collectLatest { event ->
            if (event is MessagingEvent.MessageReceived && event.conversationId == conversationId) {
                pending = pending.filter { it.id != event.message.id && it.body != event.message.body }
                val next = detail?.let { d ->
                    if (d.messages.any { it.id == event.message.id }) d
                    else d.copy(messages = d.messages + event.message)
                } ?: detail
                detail = next
                next?.let { cached ->
                    runCatching { container.messagingRepository.cacheConversation(cached) }
                }
            }
            if (event is MessagingEvent.ThreadUpdated && event.conversationId == conversationId) {
                val next = detail?.copy(messages = event.messages) ?: detail
                detail = next
                next?.let { cached ->
                    runCatching { container.messagingRepository.cacheConversation(cached) }
                }
            }
            if (event is MessagingEvent.PresenceUpdated && event.conversationId == conversationId) {
                detail = detail?.let { d ->
                    d.copy(
                        peerLastReadAt = event.peerLastReadAt ?: d.peerLastReadAt,
                        peer = d.peer?.copy(
                            online = event.online,
                            lastSeenAt = event.lastSeenAt,
                            typing = event.typing,
                        ),
                        messages = applyReadReceipts(d.messages, event.peerLastReadAt),
                    )
                }
            }
        }
    }
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }
    LaunchedEffect(messages.map { it.id }.joinToString(), nativeLang, toLang) {
        val to = ChatLangs.normalize(toLang)
        val native = ChatLangs.normalize(nativeLang)
        for (msg in messages) {
            if (msg.deleted) continue
            val existing = linesById[msg.id]
            val topOk = existing?.first?.let { it.isNotBlank() && looksLikeLang(it, to) } == true
            val botOk = existing?.second?.isNotBlank() == true &&
                (existing.second.let { !ChatLangs.sameText(it, existing.first) } || to == native)
            if (topOk && botOk) continue

            val bodyLang = msg.bodyLang?.let { ChatLangs.normalize(it) }
                ?: ChatLangs.detect(msg.body)
                ?: native
            val storedTr = msg.translation?.trim()?.takeIf { it.isNotBlank() }
            val storedTrLang = storedTr?.let { ChatLangs.detect(it) }

            var toText = listOfNotNull(
                existing?.first?.takeIf { looksLikeLang(it, to) },
                msg.body.takeIf { looksLikeLang(it, to) },
                storedTr?.takeIf { storedTrLang == to || looksLikeLang(it, to) },
                langOverlay[overlayKey(msg.id, to)]?.takeIf { looksLikeLang(it, to) },
            ).firstOrNull()

            var nativeText = listOfNotNull(
                existing?.second?.takeIf { it.isNotBlank() },
                msg.body.takeIf { looksLikeLang(it, native) },
                storedTr?.takeIf { storedTrLang == native || looksLikeLang(it, native) },
                storedTr?.takeIf { looksLikeLang(msg.body, to) },
                langOverlay[overlayKey(msg.id, native)],
            ).firstOrNull { !it.isNullOrBlank() }

            val seed = storedTr?.takeIf { !ChatLangs.sameText(it, msg.body) } ?: msg.body
            val seedLang = storedTrLang ?: bodyLang
            if (toText.isNullOrBlank()) {
                toText = tryTranslate(seed, seedLang, to)
            }
            if (nativeText.isNullOrBlank()) {
                nativeText = tryTranslate(toText ?: seed, if (toText != null) to else seedLang, native)
                    ?: tryTranslate(seed, seedLang, native)
                    ?: msg.body.takeIf { looksLikeLang(it, native) }
            }
            rememberPair(msg.id, toText, nativeText)
        }
    }

    if (selectedWord != null) {
        LaunchedEffect(selectedWord, selectedSentence, selectedLineLang, nativeLang) {
            val word = selectedWord ?: return@LaunchedEffect
            lookupLoading = true
            lookupError = null
            lookup = null
            savedMsg = null
            try {
                val source = ChatLangs.apiCode(selectedLineLang)
                val target = ChatLangs.apiCode(nativeLang)
                lookup = container.contentRepository.lookup(
                    LookupRequest(
                        token = word,
                        lemma = word.lowercase(Locale.US),
                        sentence = selectedSentence.take(4000).ifBlank { word },
                        sourceLang = source,
                        targetLang = target,
                    ),
                )
            } catch (e: Exception) {
                lookupError = e.apiErrorMessage("Lookup failed. Try again when you're online.")
            } finally {
                lookupLoading = false
            }
        }
        ModalBottomSheet(
            onDismissRequest = {
                selectedWord = null
                lookup = null
                lookupError = null
            },
            sheetState = sheetState,
            containerColor = Color.White,
            scrimColor = Color.Black.copy(alpha = 0.12f),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = messagingDirBottomPad()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val sentenceLike = lookup?.kind == "sentence"
                val sourceLemma = (lookup?.lemma ?: selectedWord).orEmpty()
                Text(
                    if (sentenceLike) selectedWord.orEmpty() else lookup?.phrase?.takeIf { it.isNotBlank() } ?: sourceLemma,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = if (sentenceLike) 18.sp else 28.sp,
                    color = GotchaColors.BrandPurple,
                )
                if (!sentenceLike) {
                    lookup?.phrase?.takeIf { it.isNotBlank() && !it.equals(sourceLemma, ignoreCase = true) }?.let { phrase ->
                        Text(
                            phrase,
                            fontFamily = Manrope,
                            fontSize = 14.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                    if (sourceLemma.isNotBlank() && lookup?.phrase?.equals(sourceLemma, ignoreCase = true) != true) {
                        Text(
                            sourceLemma,
                            fontFamily = Manrope,
                            fontSize = 15.sp,
                            color = GotchaColors.TextSubtle,
                        )
                    }
                }
                when {
                    lookupLoading -> Text(
                        "Looking up…",
                        fontFamily = Manrope,
                        fontSize = 15.sp,
                        color = GotchaColors.TextMuted,
                    )
                    lookupError != null -> Text(
                        lookupError!!,
                        fontFamily = Manrope,
                        fontSize = 15.sp,
                        color = Color(0xFFB42318),
                    )
                    lookup != null -> {
                        val pos = lookup?.partOfSpeech
                        if (!pos.isNullOrBlank()) {
                            Text(
                                pos,
                                fontFamily = Manrope,
                                fontSize = 13.sp,
                                color = GotchaColors.TextSubtle,
                            )
                        }
                        lookup?.contextualMeaning?.takeIf { it.isNotBlank() && lookup?.kind != "sentence" }?.let { meaning ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "NATURAL MEANING",
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = GotchaColors.BrandPurple,
                                )
                                Text(meaning, fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = GotchaColors.Ink)
                            }
                        }
                        lookup?.translation?.takeIf { it.isNotBlank() && it != lookup?.contextualMeaning }?.let { tr ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "TRANSLATION",
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = GotchaColors.BrandPurple,
                                )
                                Text(tr, fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.Ink)
                            }
                        }
                        lookup?.grammarNote?.takeIf { it.isNotBlank() && it != lookup?.contextualMeaning }?.let { note ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "GRAMMAR NOTE",
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = GotchaColors.TextSubtle,
                                )
                                Text(note, fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.TextMuted)
                            }
                        }
                        savedMsg?.let { note ->
                            Text(note, fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.SuccessText)
                        }
                        val markable = lookup?.kind != "sentence"
                            && (selectedWord?.trim()?.split(Regex("\\s+"))?.count { it.isNotBlank() } ?: 0) <= 1
                        if (markable) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(GotchaColors.BrandPurple)
                                .clickable(enabled = !lookupLoading && lookup?.translation?.isNotBlank() == true) {
                                    val l = lookup ?: return@clickable
                                    val word = selectedWord ?: return@clickable
                                    scope.launch {
                                        try {
                                            val lemma = (l.lemma ?: word).lowercase(Locale.US)
                                            val source = ChatLangs.apiCode(selectedLineLang)
                                            val target = ChatLangs.apiCode(nativeLang)
                                            container.vocabRepository.save(
                                                SaveVocabularyRequest(
                                                    lemma = lemma,
                                                    sourceLang = source,
                                                    targetLang = target,
                                                    translation = l.translation.orEmpty(),
                                                    contextSentence = selectedNativeLine.take(200).ifBlank {
                                                        selectedSentence.take(200)
                                                    }.ifBlank { null },
                                                ),
                                            )
                                            runCatching {
                                                container.contentRepository.markKnownWord(lemma, source, "learning")
                                            }
                                            savedMsg = "Saved to vocabulary"
                                        } catch (e: Exception) {
                                            savedMsg = e.message ?: "Save failed"
                                        }
                                    }
                                }
                                .padding(vertical = 10.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Save to vocabulary",
                                color = Color.White,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                            )
                        }
                        }
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .messagingDirectoryStatusPad()
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_arrow_left),
                contentDescription = "Back",
                tint = GotchaColors.Ink,
                modifier = Modifier
                    .size(20.dp)
                    .clickable(onClick = onBack),
            )
            Box(Modifier.clickable { detail?.peer?.id?.let(onOpenPeer) }) {
                AvatarCircle(detail?.peer?.displayName, detail?.peer?.avatarUrl, 32.dp, online = detail?.peer?.online == true)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    detail?.peer?.displayName?.takeIf { it.isNotBlank() }
                        ?: detail?.peer?.handle?.takeIf { it.isNotBlank() }
                        ?: "Chat",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = GotchaColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    presenceLabel(
                        online = detail?.peer?.online == true,
                        lastSeenAt = detail?.peer?.lastSeenAt,
                        typing = detail?.peer?.typing == true,
                    ).ifBlank { detail?.peer?.handle.orEmpty() },
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    color = when {
                        detail?.peer?.typing == true -> GotchaColors.BrandPurple
                        detail?.peer?.online == true -> Color(0xFF16A34A)
                        else -> GotchaColors.TextSubtle
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ToLangPicker(
                selected = toLang,
                options = toOptions,
                onSelect = ::persistTo,
            )
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))

        if (tipVisible) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF4EFFF))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "💡 Tap words to learn their meaning.",
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = GotchaColors.BrandPurple,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.Outlined.Close,
                    contentDescription = "Dismiss tip",
                    tint = GotchaColors.BrandPurple,
                    modifier = Modifier
                        .size(16.dp)
                        .clickable { tipVisible = false },
                )
            }
        }

        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = detail != null,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            when {
                detail != null -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            val presented = presentBubble(
                                msg = msg,
                                nativeLang = nativeLang,
                                toLang = toLang,
                                overlayNative = langOverlay[overlayKey(msg.id, nativeLang)],
                                overlayTo = langOverlay[overlayKey(msg.id, toLang)],
                                forced = linesById[msg.id],
                            )
                            MessageBubble(
                                msg = msg,
                                presented = presented,
                                selectedWord = highlightWord,
                                peerName = detail?.peer?.displayName ?: "Learner",
                                onWordTap = { word, sentence, lineLang ->
                                    selectedSentence = sentence
                                    selectedNativeLine = presented.secondary.ifBlank {
                                        if (ChatLangs.normalize(lineLang) == ChatLangs.normalize(nativeLang)) sentence else ""
                                    }
                                    selectedLineLang = lineLang
                                    selectedWord = word
                                },
                                onReply = { startReply(msg) },
                                onEdit = { startEdit(msg) },
                                onDelete = { confirmDelete = msg },
                            )
                        }
                        if (detail?.peer?.typing == true) {
                            item(key = "typing") {
                                Text(
                                    "typing…",
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color(0xFFF3F4F6))
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
                                    fontFamily = Manrope,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = GotchaColors.BrandPurple,
                                )
                            }
                        }
                    }
                }
                error != null -> OfflineEmptyState(
                    subtitle = "Connect to the internet to load this chat. Open it once while online to keep messages for offline.",
                    onRetry = { load() },
                )
                else -> ChatSkeleton(modifier = Modifier.fillMaxSize())
            }

            actionError?.let { msg ->
                Text(
                    msg,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFFEBEE))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = Color(0xFFB42318),
                )
            }
            translateHint?.let { msg ->
                Text(
                    msg,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFFF7ED))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontFamily = Manrope,
                    fontSize = 13.sp,
                    color = Color(0xFFC2410C),
                )
            }

            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(GotchaColors.Border))
            if (replyTo != null || editing != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF5F3FF))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 4.dp),
                    ) {
                        Text(
                            if (editing != null) "Editing message"
                            else "Reply to ${if (replyTo?.mine == true) "yourself" else (detail?.peer?.displayName ?: "learner")}",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = GotchaColors.BrandPurple,
                        )
                        Text(
                            messageSnippet(
                                (editing ?: replyTo)?.body,
                                (editing ?: replyTo)?.deleted == true,
                            ),
                            fontFamily = Manrope,
                            fontSize = 12.sp,
                            color = GotchaColors.TextSubtle,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Icon(
                        Icons.Outlined.Close,
                        contentDescription = "Cancel",
                        tint = GotchaColors.TextSubtle,
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { cancelComposerMode() },
                    )
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(GotchaColors.Surface)
                        .border(1.dp, GotchaColors.Border, RoundedCornerShape(20.dp))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    BasicTextField(
                        value = draft,
                        onValueChange = {
                            draft = it
                            if (it.isNotBlank()) {
                                val now = System.currentTimeMillis()
                                if (now - lastTypingAt > 2000L) {
                                    lastTypingAt = now
                                    scope.launch {
                                        runCatching { container.messagingRepository.typing(conversationId) }
                                    }
                                }
                            }
                        },
                        textStyle = TextStyle(fontFamily = Manrope, fontSize = 14.sp, color = GotchaColors.Ink),
                        cursorBrush = SolidColor(GotchaColors.BrandPurple),
                        modifier = Modifier.weight(1f),
                        decorationBox = { inner ->
                            if (draft.isBlank()) {
                                Text(
                                    if (editing != null) "Edit message..." else "Type a message...",
                                    fontFamily = Manrope,
                                    fontSize = 14.sp,
                                    color = GotchaColors.TextSubtle,
                                )
                            }
                            inner()
                        },
                    )
                }
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            if (draft.isNotBlank()) GotchaColors.BrandPurple
                            else GotchaColors.BrandPurple.copy(alpha = 0.45f),
                        )
                        .clickable(enabled = draft.isNotBlank(), onClick = ::sendMessage),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.AutoMirrored.Outlined.Send,
                        contentDescription = "Send",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            confirmDelete?.let { msg ->
                AlertDialog(
                    onDismissRequest = { confirmDelete = null },
                    title = { Text("Delete message?", fontFamily = Manrope, fontWeight = FontWeight.Bold) },
                    text = { Text("This message will be deleted for everyone.", fontFamily = Manrope) },
                    confirmButton = {
                        TextButton(onClick = { deleteConfirmed(msg) }) {
                            Text("Delete", color = Color(0xFFB42318), fontFamily = Manrope)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { confirmDelete = null }) {
                            Text("Cancel", fontFamily = Manrope)
                        }
                    },
                )
            }
        }
    }
}

private data class PresentedBubble(
    val primary: String,
    val secondary: String,
    val primaryLang: String,
    val secondaryLang: String,
)

private fun overlayKey(messageId: String, lang: String): String =
    "$messageId|${ChatLangs.normalize(lang)}"

private fun looksLikeLang(text: String, lang: String): Boolean {
    val trimmed = text.trim()
    if (trimmed.isBlank()) return false
    val got = ChatLangs.detect(trimmed) ?: return false
    return got == ChatLangs.normalize(lang)
}

private fun presentBubble(
    msg: ChatMessageDto,
    nativeLang: String,
    toLang: String,
    overlayNative: String?,
    overlayTo: String?,
    forced: Pair<String, String>?,
): PresentedBubble {
    val native = ChatLangs.normalize(nativeLang)
    val to = ChatLangs.normalize(toLang)
    val body = msg.body.trim()
    val stored = msg.translation?.trim().orEmpty()
    val forcedTo = forced?.first?.trim().orEmpty()
    val forcedNative = forced?.second?.trim().orEmpty()
    val overlayT = overlayTo?.trim().orEmpty()
    val overlayN = overlayNative?.trim().orEmpty()
    val bodyLang = msg.bodyLang?.uppercase(Locale.US)?.take(2)

    fun clearlyNative(text: String) = looksLikeLang(text, native) && !looksLikeLang(text, to)

    val toLine = listOf(forcedTo, overlayT, body, stored).firstOrNull { t ->
        t.isNotBlank() && !clearlyNative(t) && (
            looksLikeLang(t, to) ||
                t == forcedTo ||
                t == overlayT ||
                (t == body && bodyLang == to)
            )
    }.orEmpty()

    val nativeLine = listOf(forcedNative, overlayN, stored, body).firstOrNull { t ->
        t.isNotBlank() &&
            !ChatLangs.sameText(t, toLine) &&
            (t == forcedNative || t == overlayN || t == stored || looksLikeLang(t, native))
    }.orEmpty()

    return PresentedBubble(
        primary = toLine,
        secondary = visibleNativeLine(toLine, nativeLine, to, native),
        primaryLang = to,
        secondaryLang = native,
    )
}

private fun visibleNativeLine(toLine: String, nativeLine: String, toLang: String, nativeLang: String): String {
    if (nativeLine.isBlank()) return ""
    if (toLine.isBlank()) return nativeLine
    if (ChatLangs.sameText(nativeLine, toLine)) return ""
    if (ChatLangs.normalize(toLang) == ChatLangs.normalize(nativeLang)) return ""
    return nativeLine
}

@Composable
private fun MessageBubble(
    msg: ChatMessageDto,
    presented: PresentedBubble,
    selectedWord: String?,
    peerName: String,
    onWordTap: (word: String, sentence: String, lineLang: String) -> Unit,
    onReply: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember(msg.id) { mutableStateOf(false) }
    val bodyColor = if (msg.mine) Color.White else GotchaColors.Ink
    val secondaryColor = if (msg.mine) Color.White.copy(alpha = 0.8f) else Color(0xFF6A7282)
    val primaryText = presented.primary.ifBlank { "…" }
    val parent = msg.replyTo
    val replyName = when {
        parent == null -> null
        parent.senderId.isNotBlank() && parent.senderId == msg.senderId -> if (msg.mine) "You" else peerName
        msg.mine -> peerName
        else -> "You"
    }
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (msg.mine) Alignment.End else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (msg.mine && !msg.deleted) {
                MessageActionsButton(
                    expanded = menuOpen,
                    onExpandedChange = { menuOpen = it },
                    canEdit = canEditMessage(msg),
                    canDelete = msg.mine,
                    onReply = onReply,
                    onEdit = onEdit,
                    onDelete = onDelete,
                )
            }
            Column(
                modifier = Modifier
                    .widthIn(min = 160.dp, max = 260.dp)
                    .clip(
                        RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (msg.mine) 16.dp else 4.dp,
                            bottomEnd = if (msg.mine) 4.dp else 16.dp,
                        ),
                    )
                    .then(
                        when {
                            msg.deleted -> Modifier
                                .background(Color.White)
                                .border(1.dp, Color(0xFFD1D5DC), RoundedCornerShape(16.dp))
                            msg.mine -> Modifier.background(GotchaColors.BrandNavy)
                            else -> Modifier.background(Color(0xFFF3F4F6))
                        },
                    )
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (msg.deleted) {
                    Text(
                        "This message was deleted",
                        fontFamily = Manrope,
                        fontSize = 14.sp,
                        fontStyle = FontStyle.Italic,
                        color = GotchaColors.TextSubtle,
                    )
                } else {
                    msg.replyTo?.let { parent ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 4.dp),
                        ) {
                            Text(
                                replyName ?: "Reply",
                                fontFamily = Manrope,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp,
                                color = if (msg.mine) Color.White else GotchaColors.BrandPurple,
                            )
                            Text(
                                messageSnippet(parent.body, parent.deleted),
                                fontFamily = Manrope,
                                fontSize = 12.sp,
                                color = if (msg.mine) Color.White.copy(alpha = 0.8f) else Color(0xFF6A7282),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    if (presented.primary.isBlank()) {
                        Text(
                            "…",
                            fontFamily = Manrope,
                            fontSize = 15.sp,
                            color = bodyColor.copy(alpha = 0.7f),
                            lineHeight = 20.sp,
                        )
                    } else {
                        TappableMessageText(
                            text = primaryText,
                            color = bodyColor,
                            fontSize = 15.sp,
                            selectedWord = selectedWord,
                            onSender = msg.mine,
                            onWordTap = { word -> onWordTap(word, presented.primary, presented.primaryLang) },
                        )
                    }
                    if (presented.secondary.isNotBlank()) {
                        TappableMessageText(
                            text = presented.secondary,
                            color = secondaryColor,
                            fontSize = 13.sp,
                            italic = true,
                            selectedWord = selectedWord,
                            onSender = msg.mine,
                            onWordTap = { word -> onWordTap(word, presented.secondary, presented.secondaryLang) },
                        )
                    }
                }
            }
            if (!msg.mine && !msg.deleted) {
                MessageActionsButton(
                    expanded = menuOpen,
                    onExpandedChange = { menuOpen = it },
                    canEdit = false,
                    canDelete = false,
                    onReply = onReply,
                    onEdit = onEdit,
                    onDelete = onDelete,
                )
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                buildString {
                    append(clockTime(msg.createdAt))
                    if (!msg.editedAt.isNullOrBlank() && !msg.deleted) append(" · edited")
                },
                fontFamily = Manrope,
                fontSize = 10.sp,
                color = GotchaColors.TextSubtle,
            )
            if (msg.mine && !msg.deleted) {
                MessageSendStatus(status = msg.status)
            }
        }
    }
}

@Composable
private fun MessageSendStatus(status: String?) {
    when (status) {
        "sending" -> CircularProgressIndicator(
            modifier = Modifier.size(10.dp),
            strokeWidth = 1.4.dp,
            color = GotchaColors.TextSubtle,
        )
        "failed" -> Text("!", fontFamily = Manrope, fontSize = 10.sp, color = Color(0xFFB42318))
        "read" -> Icon(
            Icons.Outlined.DoneAll,
            contentDescription = "Read",
            tint = GotchaColors.BrandPurple,
            modifier = Modifier.size(14.dp),
        )
        else -> Icon(
            Icons.Outlined.Done,
            contentDescription = "Sent",
            tint = GotchaColors.TextSubtle,
            modifier = Modifier.size(13.dp),
        )
    }
}

@Composable
private fun MessageActionsButton(
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    canEdit: Boolean,
    canDelete: Boolean,
    onReply: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Box {
        Icon(
            Icons.Outlined.MoreVert,
            contentDescription = "Message actions",
            tint = GotchaColors.TextSubtle,
            modifier = Modifier
                .size(22.dp)
                .clickable { onExpandedChange(true) },
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { onExpandedChange(false) },
            shape = RoundedCornerShape(12.dp),
            containerColor = Color.White,
        ) {
            DropdownMenuItem(
                text = { Text("Reply", fontFamily = Manrope, fontSize = 14.sp) },
                onClick = {
                    onExpandedChange(false)
                    onReply()
                },
            )
            if (canEdit) {
                DropdownMenuItem(
                    text = { Text("Edit", fontFamily = Manrope, fontSize = 14.sp) },
                    onClick = {
                        onExpandedChange(false)
                        onEdit()
                    },
                )
            }
            if (canDelete) {
                DropdownMenuItem(
                    text = { Text("Delete", fontFamily = Manrope, fontSize = 14.sp, color = Color(0xFFB42318)) },
                    onClick = {
                        onExpandedChange(false)
                        onDelete()
                    },
                )
            }
        }
    }
}

@Composable
private fun TappableMessageText(
    text: String,
    color: Color,
    fontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    italic: Boolean = false,
    selectedWord: String? = null,
    onSender: Boolean = false,
    onWordTap: (String) -> Unit,
) {
    val annotated = remember(text, color, fontSize, italic, selectedWord, onSender) {
        val matches = Regex("[\\p{L}\\p{N}'-]+").findAll(text).toList()
        val parts = selectedWord?.trim()?.split(Regex("\\s+"))?.map { it.lowercase() }?.filter { it.isNotEmpty() }.orEmpty()
        val selectedIndexes = hashSetOf<Int>()
        if (parts.size <= 1) {
            matches.forEachIndexed { index, match ->
                if (selectedWord != null && match.value.equals(selectedWord, ignoreCase = true)) selectedIndexes.add(index)
            }
        } else {
            val lowers = matches.map { it.value.lowercase() }
            for (i in 0..lowers.size - parts.size) {
                if (lowers.subList(i, i + parts.size) == parts) {
                    repeat(parts.size) { k -> selectedIndexes.add(i + k) }
                }
            }
        }
        buildAnnotatedString {
            var last = 0
            matches.forEachIndexed { index, match ->
                if (match.range.first > last) append(text.substring(last, match.range.first))
                pushStringAnnotation("word", match.value)
                val selected = selectedIndexes.contains(index)
                withStyle(
                    SpanStyle(
                        color = when {
                            selected && onSender -> Color(0xFF4D179A)
                            selected -> GotchaColors.BrandPurple
                            else -> color
                        },
                        background = when {
                            selected && onSender -> Color.White
                            selected -> GotchaColors.BrandPurpleSoft
                            else -> Color.Unspecified
                        },
                        fontFamily = Manrope,
                        fontSize = fontSize,
                        fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        textDecoration = if (selected) TextDecoration.Underline else TextDecoration.None,
                    ),
                ) {
                    append(match.value)
                }
                pop()
                last = match.range.last + 1
            }
            if (last < text.length) append(text.substring(last))
        }
    }
    var layoutResult by remember { mutableStateOf<TextLayoutResult?>(null) }
    Text(
        text = annotated,
        style = TextStyle(
            fontFamily = Manrope,
            fontSize = fontSize,
            fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
            color = color,
            lineHeight = if (italic) 18.sp else 20.sp,
        ),
        onTextLayout = { layoutResult = it },
        modifier = Modifier
            .pointerInput(annotated) {
                detectTapGestures(
                    onTap = { pos ->
                        val layout = layoutResult ?: return@detectTapGestures
                        val off = layout.getOffsetForPosition(pos)
                        annotated.getStringAnnotations("word", off, off).firstOrNull()?.item?.let(onWordTap)
                    },
                )
            }
            .pointerInput(annotated) {
                var startOff = 0
                var endOff = 0
                detectDragGesturesAfterLongPress(
                    onDragStart = { pos ->
                        startOff = layoutResult?.getOffsetForPosition(pos) ?: 0
                        endOff = startOff
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        endOff = layoutResult?.getOffsetForPosition(change.position) ?: endOff
                    },
                    onDragEnd = {
                        val lo = minOf(startOff, endOff)
                        val hi = maxOf(startOff, endOff)
                        val phrase = annotated.getStringAnnotations("word", lo, hi)
                            .distinctBy { it.start }
                            .sortedBy { it.start }
                            .take(400)
                            .joinToString(" ") { it.item }
                        if (phrase.isNotBlank()) onWordTap(phrase)
                    },
                )
            },
    )
}

private fun langName(code: String): String = when (code.uppercase(Locale.getDefault())) {
    "RU" -> "Russian"
    "EN" -> "English"
    "UZ" -> "Uzbek"
    "FR" -> "French"
    "JA" -> "Japanese"
    "DE" -> "German"
    "ES" -> "Spanish"
    else -> code
}

private fun formatMemberSince(createdAt: String?): String? {
    if (createdAt.isNullOrBlank()) return null
    return try {
        val date = java.time.LocalDate.parse(createdAt.take(10))
        DateTimeFormatter.ofPattern("MMM yyyy").format(date)
    } catch (_: Exception) {
        null
    }
}

@Composable
fun FindLearnersScreen(
    onBack: () -> Unit,
    onOpenPeer: (peerId: String) -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("same") }
    var langChips by remember {
        mutableStateOf(listOf("same" to "Same readings") + APP_LANGUAGE_OPTIONS.take(3).map { it.code to it.englishLabel })
    }
    var peers by remember { mutableStateOf<List<MessagingPeer>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val bottomPad = messagingBottomPad()

    fun reload() {
        scope.launch {
            val q = query.trim().ifBlank { null }
            val lang = filter.takeUnless { it == "same" }
            val sameReadings = filter == "same"
            error = null
            val peeked = container.messagingRepository.learnersPeek(q, lang, sameReadings)
            if (peeked != null) {
                peers = peeked.data
                loading = false
            } else {
                loading = true
            }
            try {
                peers = container.messagingRepository.learnersFetch(q, lang, sameReadings).data
            } catch (e: Exception) {
                if (peeked == null) {
                    peers = emptyList()
                    error = e.apiErrorMessage("Search failed")
                }
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        runCatching { container.contentRepository.catalogLanguages() }
            .onSuccess { rows ->
                val enabled = rows.filter { it.isEnabled }
                if (enabled.isNotEmpty()) {
                    ChatLangs.setEnabled(enabled.map { it.code })
                    langChips = listOf("same" to "Same readings") +
                        enabled.map { it.code.lowercase() to (it.name ?: it.code.uppercase()) }
                }
            }
    }
    LaunchedEffect(query, filter) {
        kotlinx.coroutines.delay(250)
        reload()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .messagingDirectoryStatusPad(),
    ) {
        MessagingDirectoryHeader(title = "Find Learners", onBack = onBack)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Color.White)
                .border(1.5.dp, GotchaColors.BrandPurple, RoundedCornerShape(14.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Outlined.Search, null, tint = GotchaColors.BrandPurple, modifier = Modifier.size(20.dp))
            BasicTextField(
                value = query,
                onValueChange = { query = it },
                textStyle = TextStyle(fontFamily = Manrope, fontSize = 15.sp, color = GotchaColors.Ink),
                cursorBrush = SolidColor(GotchaColors.BrandPurple),
                modifier = Modifier.weight(1f),
                singleLine = true,
                decorationBox = { inner ->
                    if (query.isBlank()) {
                        Text("Search @username...", fontFamily = Manrope, fontSize = 15.sp, color = GotchaColors.TextSubtle)
                    }
                    inner()
                },
            )
        }

        Spacer(Modifier.height(12.dp))
        Row(
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(start = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            langChips.forEach { (key, label) ->
                val selected = filter == key
                Text(
                    label,
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selected) GotchaColors.BrandPurple else Color.White)
                        .border(1.dp, if (selected) GotchaColors.BrandPurple else GotchaColors.Border, RoundedCornerShape(10.dp))
                        .clickable { filter = key }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = if (selected) Color.White else GotchaColors.TextMuted,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = peers.isNotEmpty(),
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
        )
        Box(modifier = Modifier.weight(1f)) {
            when {
                loading && peers.isEmpty() -> InlineListRowSkeleton(
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
                error != null && peers.isEmpty() -> OfflineEmptyState(
                    subtitle = "Connect to the internet to find learners.",
                    onRetry = { reload() },
                )
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(
                            start = 24.dp,
                            end = 24.dp,
                            top = 4.dp,
                            bottom = bottomPad,
                        ),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        item {
                            val section = when {
                                query.isBlank() && filter == "same" -> "LEARNERS"
                                query.isBlank() -> "LEARNERS"
                                filter == "same" -> "MATCHES FOR \"${query.trim()}\" IN SAME READINGS"
                                else -> "MATCHES FOR \"${query.trim()}\""
                            }
                            Text(
                                section,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = GotchaColors.TextSubtle,
                            )
                        }
                        items(peers, key = { it.id }) { peer ->
                            LearnerMatchCard(peer, onOpen = { onOpenPeer(peer.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LearnerMatchCard(peer: MessagingPeer, onOpen: () -> Unit) {
    val native = peer.nativeLanguage?.uppercase(Locale.getDefault())?.take(2)
    val target = peer.primaryLanguage?.uppercase(Locale.getDefault())?.take(2)
        ?: peer.targetLanguages.firstOrNull()?.language?.uppercase(Locale.getDefault())?.take(2)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
            .clickable(onClick = onOpen)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarCircle(peer.displayName, peer.avatarUrl, 44.dp, online = peer.online)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
                    Text(
                        peer.displayName.orEmpty(),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = GotchaColors.Ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        peer.handle.orEmpty(),
                        fontFamily = Manrope,
                        fontSize = 13.sp,
                        color = GotchaColors.TextSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (native != null || target != null) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(GotchaColors.Surface)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            native ?: target.orEmpty(),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = GotchaColors.TextMuted,
                        )
                        if (native != null && target != null && native != target) {
                            Text("→", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = GotchaColors.TextSubtle)
                            Text(
                                target,
                                fontFamily = Manrope,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = GotchaColors.BrandPurple,
                            )
                        }
                    }
                }
            }
            if (peer.reading != null) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CoverThumb(
                        peer.reading.coverUrl(),
                        Modifier.size(width = 18.dp, height = 26.dp),
                        corner = 3,
                    )
                    Text("Reading:", fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.TextMuted)
                    Text(
                        peer.reading.title.orEmpty(),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = GotchaColors.Ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
fun MessagingPeerProfileScreen(
    peerId: String,
    onBack: () -> Unit,
    onMessage: (conversationId: String) -> Unit,
) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var peer by remember(peerId) { mutableStateOf<MessagingPeer?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }
    val bottomPad = messagingBottomPad()

    LaunchedEffect(peerId, reloadKey) {
        loading = peer == null
        error = null
        if (peer == null) {
            container.messagingRepository.peerPeek(peerId)?.let { peek ->
                peer = peek.data
                loading = false
            }
        }
        try {
            peer = container.messagingRepository.peerFetch(peerId).data
        } catch (e: Exception) {
            if (peer == null) {
                error = e.apiErrorMessage("Failed to load profile")
            }
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GotchaColors.Surface)
            .messagingDirectoryStatusPad(),
    ) {
        MessagingDirectoryHeader(title = "Profile", onBack = onBack)
        OfflineBannerIfNeeded(
            connectivity = container.connectivityObserver,
            hasCachedContent = peer != null,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
        )

        when {
            loading && peer == null -> {
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp)
                        .padding(top = 16.dp, bottom = bottomPad),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    SkeletonBox(Modifier.size(80.dp), cornerRadius = 40.dp)
                    SkeletonBox(Modifier.width(160.dp).height(20.dp), cornerRadius = 8.dp)
                    InlineListRowSkeleton(rows = 3)
                }
            }
            error != null && peer == null -> OfflineEmptyState(
                subtitle = "Connect to the internet to load this profile.",
                onRetry = { reloadKey += 1 },
            )
            peer != null -> {
                val p = peer!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp)
                        .padding(top = 16.dp, bottom = bottomPad),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .size(80.dp)
                            .border(3.dp, GotchaColors.BrandPurple, CircleShape)
                            .clip(CircleShape),
                    ) {
                        AvatarCircle(p.displayName, p.avatarUrl, 80.dp)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(p.displayName.orEmpty(), fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = GotchaColors.Ink)
                        Text(p.handle.orEmpty(), fontFamily = Manrope, fontSize = 13.sp, color = GotchaColors.TextMuted)
                        formatMemberSince(p.createdAt)?.let { since ->
                            Text("Member since $since", fontFamily = Manrope, fontSize = 12.sp, color = GotchaColors.TextSubtle)
                        }
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(GotchaColors.BrandPurple)
                            .clickable {
                                scope.launch {
                                    try {
                                        val d = container.messagingRepository.start(p.id, p.currentlyReading?.id ?: p.reading?.id)
                                        onMessage(d.id)
                                    } catch (e: Exception) {
                                        error = e.apiErrorMessage("Couldn't start this chat")
                                    }
                                }
                            }
                            .padding(vertical = 14.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Spacer(Modifier.weight(1f))
                        Icon(
                            painter = painterResource(R.drawable.ic_message),
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "Message ${p.displayName?.split(" ")?.firstOrNull() ?: "learner"}",
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = Color.White,
                        )
                        Spacer(Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PeerStat("${p.stats?.booksRead ?: 0}", "Books read", R.drawable.ic_book_open, Modifier.weight(1f))
                        PeerStat("${p.stats?.wordsLearned ?: 0}", "Words learned", R.drawable.ic_nav_words, Modifier.weight(1f))
                        PeerStat("${p.stats?.chats ?: 0}", "Chats", R.drawable.ic_message, Modifier.weight(1f))
                    }
                    if (p.targetLanguages.isNotEmpty() || p.nativeLanguage != null) {
                        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Languages", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GotchaColors.Ink)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                val langs = buildList {
                                    p.nativeLanguage?.let { add(it to "Native") }
                                    p.targetLanguages.forEach { add((it.language ?: "en") to (it.cefrLevel?.uppercase() ?: "A1")) }
                                }.distinctBy { it.first }.take(3)
                                langs.forEach { (code, level) ->
                                    Column(
                                        Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color.White)
                                            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
                                            .padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        MsgLangChip(code)
                                        Text(langName(code), fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                                        Text(cefrDisplay(level), fontFamily = Manrope, fontSize = 11.sp, color = GotchaColors.TextMuted)
                                    }
                                }
                            }
                        }
                    }
                    p.currentlyReading?.let { book ->
                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Currently Reading", fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GotchaColors.Ink)
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color.White)
                                    .border(1.dp, GotchaColors.Border, RoundedCornerShape(16.dp))
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    book.coverUrl()?.let { url ->
                                        CoverThumb(url, Modifier.size(width = 42.dp, height = 58.dp), corner = 8)
                                    }
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            MsgLangChip(book.language ?: "en")
                                            Text(
                                                "${book.progressPct.toInt()}% read",
                                                fontFamily = Manrope,
                                                fontSize = 13.sp,
                                                color = GotchaColors.TextSubtle,
                                            )
                                        }
                                        Text(book.title.orEmpty(), fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GotchaColors.Ink)
                                    }
                                }
                                Box(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(GotchaColors.Border),
                                ) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth(fraction = (book.progressPct / 100.0).toFloat().coerceIn(0f, 1f))
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp))
                                            .background(GotchaColors.BrandPurple),
                                    )
                                }
                            }
                        }
                    }
                    p.sharedReadingsNote?.let { note ->
                        Text(
                            note,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(GotchaColors.BrandPurpleSoft)
                                .padding(12.dp),
                            fontFamily = Manrope,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = GotchaColors.BrandPurple,
                        )
                    }
                }
            }
        }
    }
}

private fun cefrDisplay(level: String): String {
    val raw = level.trim()
    if (raw.equals("Native", ignoreCase = true)) return "Native"
    val code = raw.uppercase(Locale.getDefault()).take(2)
    return when {
        code.startsWith("C") -> "$code Proficient"
        code.startsWith("B") -> "$code Intermediate"
        code.startsWith("A") -> "$code Basic"
        else -> raw
    }
}

@Composable
private fun PeerStat(value: String, label: String, iconRes: Int, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, GotchaColors.Border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            painter = painterResource(iconRes),
            contentDescription = null,
            tint = GotchaColors.BrandPurple,
            modifier = Modifier.size(20.dp),
        )
        Text(value, fontFamily = Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = GotchaColors.Ink)
        Text(label, fontFamily = Manrope, fontSize = 11.sp, color = GotchaColors.TextMuted, maxLines = 1)
    }
}

