import { useCallback, useEffect, useMemo, useState } from 'react';
import { Languages, MessageSquare, Search, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { avatarInitials } from '../lib/types';

type Peer = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  nativeLanguage?: string;
  primaryLanguage?: string;
};

type ContentRef = {
  id: string;
  title: string;
  coverImageKey?: string | null;
  language?: string;
};

type ConversationRow = {
  id: string;
  language?: string | null;
  peer: Peer | null;
  content?: ContentRef | null;
  lastMessage?: {
    id: string;
    body: string;
    translation?: string | null;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt?: string | null;
};

type ChatMessage = {
  id: string;
  body: string;
  translation?: string | null;
  bodyLang?: string | null;
  senderId: string;
  mine: boolean;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  language?: string | null;
  peer: Peer | null;
  content?: ContentRef | null;
  messages: ChatMessage[];
};

type Suggestion = Peer & { reading?: ContentRef | null };

function langBadge(code?: string | null) {
  const c = (code ?? 'en').toUpperCase().slice(0, 2);
  const styles: Record<string, string> = {
    RU: 'bg-[#f0e7ff] text-[#7008e7]',
    EN: 'bg-[#e0f2fe] text-[#0369a1]',
    UZ: 'bg-[#ecfdf5] text-[#047857]',
    FR: 'bg-[#fef3c7] text-[#b45309]',
    JA: 'bg-[#ffe4e6] text-[#be123c]',
    DE: 'bg-[#e0e7ff] text-[#3730a3]',
    ES: 'bg-[#ffedd5] text-[#c2410c]',
  };
  return styles[c] ?? 'bg-gray-100 text-gray-600';
}

function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// re-export helper used by shell; keep local if types export lacks cn
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipDismissed, setTipDismissed] = useState(false);

  const loadInbox = useCallback(async (q?: string) => {
    setLoadingList(true);
    setError(null);
    try {
      const [inbox, suggested] = await Promise.all([
        api<ConversationRow[]>(`/messaging/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`),
        api<Suggestion[]>('/messaging/suggestions'),
      ]);
      setConversations(inbox);
      setSuggestions(suggested);
      if (!selectedId && inbox[0]) setSelectedId(inbox[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoadingList(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadInbox();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadInbox(search.trim() || undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingThread(true);
      try {
        const d = await api<ConversationDetail>(`/messaging/conversations/${selectedId}`);
        if (cancelled) return;
        setDetail(d);
        await api(`/messaging/conversations/${selectedId}/read`, { method: 'POST' });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to open chat');
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const langLabel = useMemo(() => {
    const code = (detail?.language ?? detail?.peer?.primaryLanguage ?? 'en').toUpperCase();
    const names: Record<string, string> = {
      RU: 'Russian',
      EN: 'English',
      UZ: 'Uzbek',
      FR: 'French',
      JA: 'Japanese',
      DE: 'German',
      ES: 'Spanish',
    };
    return names[code] ?? code;
  }, [detail]);

  const startWith = async (peerId: string, contentId?: string | null) => {
    try {
      const d = await api<ConversationDetail>('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({ peerUserId: peerId, contentId: contentId ?? undefined }),
      });
      setSelectedId(d.id);
      setDetail(d);
      await loadInbox(search.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start chat');
    }
  };

  const send = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`/messaging/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft('');
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                lastMessage: {
                  id: msg.id,
                  body: msg.body,
                  translation: msg.translation,
                  senderId: msg.senderId,
                  createdAt: msg.createdAt,
                },
                lastMessageAt: msg.createdAt,
              }
            : c,
        );
        return next.sort((a, b) =>
          (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
        );
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 flex bg-white overflow-hidden">
      {/* Inbox column */}
      <aside className="w-[360px] shrink-0 border-r border-[#e5e7eb] flex flex-col min-h-0 bg-white">
        <div className="p-4 border-b border-[#e5e7eb]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#99a1af]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] text-sm outline-none focus:border-[#7008e7] focus:ring-1 focus:ring-[#7008e7]/40"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="text-[11px] font-bold tracking-wide text-[#99a1af] mb-3">
              SUGGESTED FROM READINGS
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void startWith(s.id, s.reading?.id)}
                  className="w-[130px] shrink-0 rounded-2xl border border-[#e5e7eb] bg-white p-3 text-left hover:border-[#7008e7]/40 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#f0e7ff] flex items-center justify-center text-xs font-bold text-[#7008e7]">
                      {s.avatarUrl ? (
                        <img src={s.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        avatarInitials(s.displayName)
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-900 truncate max-w-[70px]">
                        {s.displayName.split(' ')[0]}
                        {s.displayName.split(' ')[1] ? ` ${s.displayName.split(' ')[1]![0]}.` : ''}
                      </span>
                      <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded', langBadge(s.primaryLanguage ?? s.nativeLanguage))}>
                        {(s.primaryLanguage ?? s.nativeLanguage ?? 'en').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#99a1af] truncate w-full text-center">
                      {s.reading?.title ?? 'Learner'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pt-2 pb-1 text-[11px] font-bold tracking-wide text-[#99a1af]">
          RECENT CHATS
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingList && conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#99a1af]">Loading conversations…</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#99a1af] flex flex-col items-center gap-2 text-center">
              <MessageSquare className="w-8 h-8 text-[#c4b4ff]" />
              <p>No conversations yet. Start from Suggested from Readings.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cx(
                    'w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f3f4f6] text-left transition-colors',
                    active ? 'bg-[#f5f3ff]' : 'hover:bg-[#f9fafb]',
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-[#f0e7ff] flex items-center justify-center text-sm font-bold text-[#7008e7]">
                      {c.peer?.avatarUrl ? (
                        <img src={c.peer.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        avatarInitials(c.peer?.displayName ?? '?')
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {c.peer?.displayName ?? 'Learner'}
                        </span>
                        <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', langBadge(c.language ?? c.peer?.primaryLanguage))}>
                          {(c.language ?? c.peer?.primaryLanguage ?? 'en').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#99a1af] shrink-0">
                        {relativeTime(c.lastMessageAt ?? c.lastMessage?.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[#4a5565] truncate">
                        {c.lastMessage?.body ?? 'No messages yet'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#7008e7] text-white text-[10px] font-extrabold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread column */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#f9fafb]">
        {!selectedId || !detail ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#99a1af] gap-2">
            <MessageSquare className="w-10 h-10 text-[#c4b4ff]" />
            <p className="text-sm">Select a conversation to start chatting</p>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <>
            <header className="h-14 bg-white border-b border-[#e5e7eb] px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#f0e7ff] flex items-center justify-center text-xs font-bold text-[#7008e7] shrink-0">
                  {detail.peer?.avatarUrl ? (
                    <img src={detail.peer.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    avatarInitials(detail.peer?.displayName ?? '?')
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">
                    {detail.peer?.displayName ?? 'Learner'}
                  </div>
                  <div className="text-[11px] text-[#99a1af] truncate">{detail.peer?.handle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-gray-900">
                {langLabel}
                <Languages className="w-3.5 h-3.5 text-[#7008e7]" />
              </div>
            </header>

            {!tipDismissed && (
              <div className="bg-[#f4efff] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
                <p className="text-[13px] font-semibold text-[#7008e7]">
                  Tips: Tap underlined words to save them to your vocabulary list.
                </p>
                <button
                  type="button"
                  className="text-[#7008e7] text-sm px-1"
                  onClick={() => setTipDismissed(true)}
                  aria-label="Dismiss tip"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
              {loadingThread && detail.messages.length === 0 ? (
                <p className="text-sm text-[#99a1af]">Loading messages…</p>
              ) : (
                detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cx('flex flex-col gap-1', m.mine ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cx(
                        'max-w-[70%] px-3.5 py-3 rounded-2xl text-[15px] leading-5',
                        m.mine
                          ? 'bg-[#2107aa] text-white rounded-br-sm'
                          : 'bg-white border border-[#e5e7eb] text-gray-900 rounded-bl-sm',
                      )}
                    >
                      <p>{m.body}</p>
                      {m.translation && (
                        <p
                          className={cx(
                            'italic text-[13px] mt-1',
                            m.mine ? 'text-white/80' : 'text-[#6a7282]',
                          )}
                        >
                          {m.translation}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#99a1af]">{formatTime(m.createdAt)}</span>
                  </div>
                ))
              )}
            </div>

            <footer className="bg-white border-t border-[#e5e7eb] p-3 flex items-center gap-2 shrink-0">
              <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#e5e7eb] bg-[#f9fafb]">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-[#99a1af]"
                />
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e0f2fe] text-[#0369a1]">
                  {(user?.nativeLanguage ?? 'en').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <button
                type="button"
                disabled={sending || !draft.trim()}
                onClick={() => void send()}
                className="w-10 h-10 rounded-full bg-[#7008e7] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#5b07c4] transition-colors"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
