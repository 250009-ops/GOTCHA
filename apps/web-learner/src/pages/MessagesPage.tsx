import { deletedAccountLine, isUserDeletedError, shownName } from '../lib/deletedUser';
import { BlockButton, FriendGateNotice, ReportButton } from '../components/safety/SafetyActions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, ChevronDown, Clock, CornerUpLeft, Languages, MessageSquare, MoreHorizontal, Pencil, Search, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PeerProfileModal, type MessagingPeerProfile } from '../components/PeerProfileModal';
import { UserAvatar } from '../components/UserAvatar';
import { api, getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  apiChatLang,
  chatLangFlag,
  chatLangName,
  chatToLabel,
  chatTranslatingLabel,
  coerceToLang,
  inferComposerSource,
  composeChatPair,
  learningTarget,
  loadToLang,
  looksLikeLang,
  normalizeChatLang,
  otherChatLangs,
  presentBubble,
  sameChatText,
  saveToLang,
  tokenizeChatText,
  tryTranslateChat,
} from '../lib/chatLang';
import type { LookupResult, VocabItem } from '../lib/types';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { clampPhraseSpan, findChatWordPartRange, isSentenceLikeSelection, isVocabMarkableSelection, lookupHeadline, sentenceAroundPhrase, tokenInSpan, type TokenSpan } from '../lib/phraseSpan';

type Peer = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  nativeLanguage?: string;
  primaryLanguage?: string;
  online?: boolean;
  lastSeenAt?: string | null;
  typing?: boolean;
  /** Privacy §11: the account was deleted; name is localised from this flag, composer is closed. */
  deleted?: boolean;
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
    deleted?: boolean;
    status?: 'sending' | 'sent' | 'read' | null;
  } | null;
  unreadCount: number;
  lastMessageAt?: string | null;
};

type MessageReplyTo = {
  id: string;
  body: string;
  translation?: string | null;
  bodyLang?: string | null;
  senderId: string;
  deleted: boolean;
};

type ChatMessage = {
  id: string;
  body: string;
  translation?: string | null;
  bodyLang?: string | null;
  senderId: string;
  mine: boolean;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
  replyTo?: MessageReplyTo | null;
  status?: 'sending' | 'sent' | 'read' | 'failed' | null;
};

type ConversationDetail = {
  id: string;
  language?: string | null;
  peer: Peer | null;
  content?: ContentRef | null;
  messages: ChatMessage[];
  peerLastReadAt?: string | null;
};

type Suggestion = Peer & { reading?: ContentRef | null };

type LinePair = { to: string; native: string };

const TEMPLATE_PEER_NAMES = new Set([
  'john doe',
  'yuki t.',
  'yuki t',
  'marc l.',
  'marc l',
  'elena r.',
  'elena r',
  'elena read',
]);

function isTemplatePeerName(name?: string | null) {
  return TEMPLATE_PEER_NAMES.has((name ?? '').trim().toLowerCase());
}

function langBadge(_code?: string | null) {
  return 'bg-[#f3f4f6] text-[#4a5565]';
}

function inboxTimestamp(iso: string | undefined | null, yesterdayLabel: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startThat) / 86_400_000);
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return yesterdayLabel;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${px}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [px]);
  return matches;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

function canEditMessage(m: ChatMessage) {
  if (!m.mine || m.deleted) return false;
  return Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
}

function messageSnippet(
  m: Pick<ChatMessage, 'body' | 'deleted'> | MessageReplyTo,
  deletedLabel: string,
  fallback = '',
) {
  if (m.deleted) return deletedLabel;
  const text = m.body.trim();
  if (!text) return fallback;
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function applyReadReceipts(messages: ChatMessage[], peerLastReadAt?: string | null) {
  if (!peerLastReadAt) return messages;
  const readAt = new Date(peerLastReadAt).getTime();
  return messages.map((m) => {
    if (!m.mine || m.status === 'sending' || m.status === 'failed' || m.id.startsWith('local-')) return m;
    const nextStatus: ChatMessage['status'] = new Date(m.createdAt).getTime() <= readAt ? 'read' : 'sent';
    return { ...m, status: nextStatus };
  });
}

function presenceLabel(
  peer: Peer | null | undefined,
  mp: ReturnType<typeof useLearnerCopy>['messagesPage'],
  ce: ReturnType<typeof useLearnerCopy>['commonExt'],
) {
  if (!peer) return '';
  if (peer.typing) return mp.typing;
  if (peer.online) return mp.online;
  if (!peer.lastSeenAt) return mp.lastSeen(ce.today);
  const ms = Date.now() - new Date(peer.lastSeenAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return mp.lastSeen(`1${ce.minutes}`);
  if (mins < 60) return mp.lastSeen(`${mins}${ce.minutes}`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mp.lastSeen(`${hours}${ce.hours}`);
  const days = Math.floor(hours / 24);
  return mp.lastSeen(`${days}${ce.days}`);
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function TappableMessageText({
  text,
  selectedWord,
  onWordTap,
  className,
  mine = false,
  chatTipTitle,
}: {
  text: string;
  selectedWord: string | null;
  onWordTap: (word: string) => void;
  className?: string;
  mine?: boolean;
  chatTipTitle: string;
}) {
  const parts = useMemo(() => tokenizeChatText(text), [text]);
  const wordParts = useMemo(
    () => parts.flatMap((part, i) => (part.type === 'word' ? [{ i, surface: part.value }] : [])),
    [parts],
  );
  const selectedRange = useMemo(
    () => (selectedWord ? findChatWordPartRange(parts, selectedWord) : null),
    [parts, selectedWord],
  );
  const [liveSpan, setLiveSpan] = useState<TokenSpan | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    pointerType: string;
    originX: number;
    originY: number;
    anchorI: number;
    endI: number;
    armed: boolean;
    timer: number | null;
    host: HTMLElement;
  } | null>(null);

  const commitSpan = (span: TokenSpan) => {
    const inRange = wordParts.filter((token) => token.i >= span.startI && token.i <= span.endI);
    if (!inRange.length) return;
    onWordTap(inRange.map((token) => token.surface).join(' '));
  };

  return (
    <p
      className={cx(className, 'select-none break-words whitespace-pre-wrap touch-pan-y')}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const el = (e.target as HTMLElement | null)?.closest?.('[data-chat-token-i]');
        if (!el) return;
        const i = Number(el.getAttribute('data-chat-token-i'));
        if (!Number.isFinite(i)) return;
        if (dragRef.current?.timer) window.clearTimeout(dragRef.current.timer);
        const isTouch = e.pointerType === 'touch';
        const timer = isTouch
          ? window.setTimeout(() => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== e.pointerId) return;
              drag.armed = true;
              try {
                drag.host.setPointerCapture(drag.pointerId);
              } catch {
                // Pointer may have already ended.
              }
              setLiveSpan({ startI: drag.anchorI, endI: drag.endI });
            }, 380)
          : null;
        dragRef.current = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          originX: e.clientX,
          originY: e.clientY,
          anchorI: i,
          endI: i,
          armed: !isTouch,
          timer,
          host: e.currentTarget,
        };
        if (!isTouch) {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setLiveSpan({ startI: i, endI: i });
        }
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dist = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY);
        if (!drag.armed) {
          if (dist > 10 && drag.timer != null) {
            window.clearTimeout(drag.timer);
            drag.timer = null;
            dragRef.current = null;
          }
          return;
        }
        e.preventDefault();
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-chat-token-i]');
        if (!hit || !e.currentTarget.contains(hit)) return;
        const i = Number(hit.getAttribute('data-chat-token-i'));
        if (!Number.isFinite(i) || i === drag.endI) return;
        drag.endI = i;
        const span = clampPhraseSpan(wordParts, drag.anchorI, i);
        if (span) setLiveSpan(span);
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        if (drag.timer != null) window.clearTimeout(drag.timer);
        dragRef.current = null;
        setLiveSpan(null);
        const span = clampPhraseSpan(wordParts, drag.anchorI, drag.endI);
        if (span) commitSpan(span);
      }}
      onPointerCancel={() => {
        if (dragRef.current?.timer != null) window.clearTimeout(dragRef.current.timer);
        dragRef.current = null;
        setLiveSpan(null);
      }}
    >
      {parts.map((part, i) => {
        if (part.type !== 'word') {
          return <span key={`${i}-${part.value}`}>{part.value}</span>;
        }
        const selected = tokenInSpan(i, liveSpan ?? selectedRange);
        return (
          <span
            key={`${i}-${part.value}`}
            data-chat-token-i={i}
            role="button"
            tabIndex={0}
            title={chatTipTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordTap(part.value);
              }
            }}
            className={cx(
              'cursor-pointer underline underline-offset-[3px] rounded-[4px] px-0.5 -mx-px transition-colors',
              mine
                ? 'decoration-white/80 hover:bg-white/20 hover:decoration-white'
                : 'decoration-g-blue-200 hover:bg-g-blue-50 hover:decoration-g-blue-700',
              selected && (mine
                ? 'font-semibold bg-white text-g-blue-900 decoration-g-blue-900 decoration-2 shadow-sm'
                : 'font-semibold bg-g-blue-50 text-g-blue-900 decoration-g-blue-700 decoration-2'),
            )}
          >
            {part.value}
          </span>
        );
      })}
    </p>
  );
}

function ToLangPicker({
  selected,
  options,
  uiLang,
  onSelect,
}: {
  selected: string;
  options: string[];
  uiLang?: string | null;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-gray-900"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold text-[#99a1af]">{chatToLabel(uiLang)}</span>
        {chatLangName(selected, uiLang)}
        <Languages className="w-3.5 h-3.5 text-g-blue-700" />
        <ChevronDown className="w-3.5 h-3.5 text-[#99a1af]" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 z-20 min-w-full rounded-xl border border-[#e5e7eb] bg-white shadow-lg overflow-hidden"
        >
          {options.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={code === selected}
              onClick={() => {
                onSelect(code);
                setOpen(false);
              }}
              className={cx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-g-blue-50',
                code === selected && 'bg-g-blue-50 font-semibold',
              )}
            >
              <span>{chatLangFlag(code)}</span>
              {chatLangName(code, uiLang)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WordMeaningPanel({
  word,
  lookup,
  loading,
  error,
  savedMsg,
  onBack,
  onSave,
  onKnown,
  onIgnore,
  copy,
}: {
  word: string;
  lookup: LookupResult | null;
  loading: boolean;
  error: string | null;
  savedMsg: string | null;
  onBack: () => void;
  onSave: () => void;
  onKnown: () => void;
  onIgnore: () => void;
  copy: ReturnType<typeof useLearnerCopy>;
}) {
  const mp = copy.messagesPage;
  const reader = copy.reader;
  const lemma = lookup?.lemma || word;
  const phonetic = lookup?.phonetic?.trim();
  const canAct = !loading && !!lookup?.translation;
  const naturalMeaning = lookup?.contextualMeaning?.trim() || '';
  const sentenceLike = lookup?.kind === 'sentence' || isSentenceLikeSelection(word);
  const showVocabActions = isVocabMarkableSelection(word, undefined, lookup?.kind);
  const headline = sentenceLike
    ? lookupHeadline(word, null, lemma)
    : (lookup?.phrase?.trim() || lemma);
  return (
    <div className="h-full w-full bg-white flex flex-col min-h-0">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="size-8 rounded-lg bg-[#f2f5f5] border border-[#e4e7ec] grid place-items-center text-[#6b7382] hover:text-gray-800"
          aria-label={copy.commonExt.close}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-[#0f1729]">{mp.wordMeaning}</h2>
      </div>
      <div className="h-px bg-[#e5e8eb] shrink-0" />
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5 space-y-5">
        <div className="space-y-1.5">
          <p className="text-[22px] font-extrabold text-[#0f1729] leading-tight break-words">
            {headline}
          </p>
          {!sentenceLike && lookup?.phrase?.trim() && lemma.trim() && lookup.phrase.trim().toLowerCase() !== lemma.trim().toLowerCase() ? (
            <p className="text-sm text-[#6b7382]">{lemma}</p>
          ) : null}
          {phonetic ? (
            <p className="text-sm text-[#6b7382]">[{phonetic}]</p>
          ) : loading ? (
            <p className="text-sm text-[#6b7382]">{reader.lookingUp}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {lookup?.partOfSpeech ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#f3f4f6] text-[#4a5565] capitalize">
                {lookup.partOfSpeech}
              </span>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {savedMsg ? <p className="text-sm text-[#047857]">{savedMsg}</p> : null}

        {!sentenceLike && (naturalMeaning || loading) ? (
          <section className="rounded-xl bg-g-blue-50 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-g-blue-700 mb-2">{reader.naturalMeaning}</h3>
            <p className="text-sm text-[#0f1729] leading-6">
              {loading ? '…' : (naturalMeaning || lookup?.translation || reader.lookupError)}
            </p>
          </section>
        ) : null}

        {lookup?.translation && (sentenceLike || lookup.translation.trim() !== naturalMeaning) ? (
          <section className={sentenceLike ? 'rounded-xl bg-g-blue-50 p-3' : undefined}>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-g-blue-700 mb-2">{reader.translation}</h3>
            <p className="text-sm text-[#0f1729] leading-6 whitespace-pre-wrap break-words">{lookup.translation}</p>
          </section>
        ) : null}

        {lookup?.grammarNote && lookup.grammarNote.trim() !== naturalMeaning && lookup.grammarNote.trim() !== lookup.translation?.trim() ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-2">Grammar note</h3>
            <p className="text-sm text-[#4a5565] leading-6 whitespace-pre-wrap">{lookup.grammarNote}</p>
          </section>
        ) : null}
      </div>

      {showVocabActions ? (
      <div className="shrink-0 border-t border-[#e4e7ec] p-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={!canAct}
          onClick={onSave}
          className="h-10 rounded-xl bg-g-blue-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#6d1ce0]"
        >
          {reader.save}
        </button>
        <button
          type="button"
          disabled={!canAct}
          onClick={onKnown}
          className="h-10 rounded-xl border border-[#e4e7ec] bg-white text-sm font-semibold text-[#0f1729] disabled:opacity-40 hover:bg-[#f9fafb] inline-flex items-center justify-center gap-1"
        >
          <Check className="w-4 h-4 text-[#16a34a]" />
          {reader.known}
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="h-10 rounded-xl border border-[#e4e7ec] bg-white text-sm font-semibold text-[#6b7382] hover:bg-[#f9fafb] inline-flex items-center justify-center gap-1"
        >
          <X className="w-4 h-4" />
          {reader.ignore}
        </button>
      </div>
      ) : null}
    </div>
  );
}

export default function MessagesPage() {
  const { locale: uiLocale } = useLearnerLocale();
  const peerName = (p: Peer | null | undefined, fallback: string) => shownName(p, uiLocale, fallback) ?? fallback;
  const [peerGone, setPeerGone] = useState(false);
  const copy = useLearnerCopy();
  const msg = copy.messages;
  const mp = copy.messagesPage;
  const { user, refreshVocab, vocabItems, markVocabMastered } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedChat = searchParams.get('c')?.trim() || null;
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(requestedChat);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [toLangOverride, setToLangOverride] = useState<string | null>(null);
  const [linesById, setLinesById] = useState<Record<string, LinePair>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState('');
  const [selectedNativeLine, setSelectedNativeLine] = useState('');
  const [selectedLineLang, setSelectedLineLang] = useState('EN');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [profilePeerId, setProfilePeerId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const backfillFailRef = useRef<Map<string, number>>(new Map());
  const typingSentAt = useRef(0);
  const isDesktop = useMinWidth(1024);
  const isXl = useMinWidth(1280);

  const nativeLang = normalizeChatLang(user?.nativeLanguage);
  const uiLang = user?.uiLanguage ?? nativeLang;
  const toOptions = useMemo(() => otherChatLangs(nativeLang), [nativeLang]);
  const toLang = useMemo(
    () =>
      coerceToLang(
        nativeLang,
        toLangOverride
          ?? learningTarget(nativeLang, detail?.peer?.nativeLanguage, toOptions[0]),
      ),
    [nativeLang, toLangOverride, detail?.peer?.nativeLanguage, toOptions],
  );

  const persistTo = (code: string) => {
    const next = coerceToLang(nativeLang, code);
    setToLangOverride(next);
    if (selectedId) saveToLang(selectedId, next);
  };

  const rememberPair = useCallback((messageId: string, toText?: string | null, nativeText?: string | null) => {
    const top = toText?.trim() ?? '';
    const bottom = nativeText?.trim() ?? '';
    setLinesById((prev) => ({ ...prev, [messageId]: { to: top, native: bottom } }));
  }, []);

  const loadInbox = useCallback(async (q?: string, silent = false) => {
    if (!silent) setLoadingList(true);
    if (!silent) setError(null);
    try {
      const [inbox, suggested] = await Promise.all([
        api<ConversationRow[]>(`/messaging/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`),
        api<Suggestion[]>('/messaging/suggestions'),
      ]);
      setConversations(inbox.filter((c) => !isTemplatePeerName(c.peer?.displayName)));
      setSuggestions(suggested.filter((s) => !isTemplatePeerName(s.displayName)));
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : copy.commonExt.error);
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, []);

  useEffect(() => {
    if (requestedChat) {
      setSelectedId(requestedChat);
      return;
    }
    if (!isDesktop || selectedId || conversations.length === 0) return;
    setSelectedId(conversations[0].id);
  }, [isDesktop, selectedId, conversations, requestedChat]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadInbox(search.trim() || undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setToLangOverride(null);
      setLinesById({});
      setSelectedWord(null);
      setReplyTo(null);
      setEditing(null);
      setMenuId(null);
      return;
    }
    const saved = loadToLang(selectedId);
    setToLangOverride(saved ? coerceToLang(nativeLang, saved) : null);
    setLinesById({});
    setSelectedWord(null);
    setReplyTo(null);
    setEditing(null);
    setMenuId(null);
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
        if (!cancelled) setError(e instanceof Error ? e.message : copy.commonExt.error);
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, nativeLang]);

  useEffect(() => {
    if (selectedId && toLangOverride == null && detail) {
      persistTo(toLang);
    }
    // Seed default To once per conversation after detail loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, detail?.id, toLangOverride]);

  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const tick = () => {
      if (!getAccessToken()) return;
      void api('/messaging/presence', { method: 'POST' }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 25_000);
    return () => window.clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!selectedId || !getAccessToken()) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api<{
          peerLastReadAt?: string | null;
          peer?: { id: string; online: boolean; lastSeenAt?: string | null; typing?: boolean } | null;
        }>(`/messaging/conversations/${selectedId}/status`);
        if (cancelled) return;
        setDetail((prev) => {
          if (!prev || prev.id !== selectedId) return prev;
          return {
            ...prev,
            peerLastReadAt: status.peerLastReadAt ?? prev.peerLastReadAt,
            peer: prev.peer && status.peer
              ? {
                  ...prev.peer,
                  online: status.peer.online,
                  lastSeenAt: status.peer.lastSeenAt,
                  typing: !!status.peer.typing,
                }
              : prev.peer,
            messages: applyReadReceipts(prev.messages, status.peerLastReadAt),
          };
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId && c.peer && status.peer
              ? {
                  ...c,
                  peer: {
                    ...c.peer,
                    online: status.peer.online,
                    lastSeenAt: status.peer.lastSeenAt,
                  },
                }
              : c,
          ),
        );
      } catch {
        /* keep last known status */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadInbox(search.trim() || undefined, true);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [loadInbox, search]);

  const [gatedPeer, setGatedPeer] = useState<{ id: string; under13: boolean } | null>(null);
  const startWith = async (peerId: string, contentId?: string | null) => {
    try {
      const d = await api<ConversationDetail>('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({ peerUserId: peerId, contentId: contentId ?? undefined }),
      });
      setSelectedId(d.id);
      setDetail(d);
      setGatedPeer(null);
      setProfilePeerId(null);
      await loadInbox(search.trim() || undefined);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'MESSAGING_NOT_ALLOWED') {
        setGatedPeer({ id: peerId, under13: false });
        setProfilePeerId(null);
        return;
      }
      setError(e instanceof Error ? e.message : copy.commonExt.error);
    }
  };

  const openPeerProfile = (peerId?: string | null) => {
    if (peerId) setProfilePeerId(peerId);
  };

  const messageFromProfile = async (peer: MessagingPeerProfile) => {
    const existing = conversations.find((c) => c.peer?.id === peer.id);
    if (existing) {
      setSelectedId(existing.id);
      setProfilePeerId(null);
      return;
    }
    await startWith(peer.id, peer.currentlyReading?.id ?? peer.reading?.id);
  };

  const composePayload = async (text: string, editingMsg?: ChatMessage | null) => {
    const pair = await composeChatPair(text, nativeLang, toLang);
    if (!pair.toText && editingMsg?.body?.trim()) {
      const prev = editingMsg.body.trim();
      const prevLang = editingMsg.bodyLang ? normalizeChatLang(editingMsg.bodyLang) : null;
      if (prevLang === normalizeChatLang(toLang) || looksLikeLang(prev, toLang)) {
        toast.message(`Couldn’t translate to ${chatLangName(toLang, uiLang)} yet. Keeping the previous ${chatLangName(toLang, uiLang)} line.`);
        const sendNative = pair.nativeText && !sameChatText(pair.nativeText, prev) ? pair.nativeText : undefined;
        return {
          ...pair,
          toText: prev,
          sendBody: prev,
          sendLang: normalizeChatLang(toLang),
          sendNative,
        };
      }
    }
    if (!pair.toText) {
      toast.message(`Couldn’t translate to ${chatLangName(toLang, uiLang)} yet. Your original is below.`);
    }
    return pair;
  };

  const patchInboxLast = (msg: ChatMessage) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              lastMessage: {
                id: msg.id,
                body: msg.deleted ? mp.messageDeleted : msg.body,
                translation: msg.deleted ? null : msg.translation,
                senderId: msg.senderId,
                createdAt: msg.createdAt,
                deleted: !!msg.deleted,
              },
              lastMessageAt: msg.createdAt,
            }
          : c,
      );
      return next.sort((a, b) =>
        (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
      );
    });
  };

  const replaceMessage = (msg: ChatMessage) => {
    setDetail((prev) =>
      prev
        ? { ...prev, messages: prev.messages.map((item) => (item.id === msg.id ? msg : item)) }
        : prev,
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId && c.lastMessage?.id === msg.id
          ? {
              ...c,
              lastMessage: {
                id: msg.id,
                body: msg.deleted ? mp.messageDeleted : msg.body,
                translation: msg.deleted ? null : msg.translation,
                senderId: msg.senderId,
                createdAt: c.lastMessage.createdAt,
                deleted: !!msg.deleted,
              },
            }
          : c,
      ),
    );
  };

  const startReply = (m: ChatMessage) => {
    if (m.deleted) return;
    setEditing(null);
    setReplyTo(m);
    setMenuId(null);
  };

  const startEdit = (m: ChatMessage) => {
    if (!canEditMessage(m)) return;
    setReplyTo(null);
    setEditing(m);
    setDraft(linesById[m.id]?.native || m.translation || m.body);
    setMenuId(null);
  };

  const cancelComposerMode = () => {
    setReplyTo(null);
    if (editing) setDraft('');
    setEditing(null);
  };

  const deleteMessage = async (m: ChatMessage) => {
    if (!selectedId || !m.mine || m.deleted) return;
    setMenuId(null);
    if (!window.confirm(mp.deleteForEveryone)) return;
    try {
      const updated = await api<ChatMessage>(
        `/messaging/conversations/${selectedId}/messages/${m.id}`,
        { method: 'DELETE' },
      );
      replaceMessage(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.commonExt.error);
    }
  };

  const notifyTyping = () => {
    if (!selectedId) return;
    const now = Date.now();
    if (now - typingSentAt.current < 2000) return;
    typingSentAt.current = now;
    void api(`/messaging/conversations/${selectedId}/typing`, {
      method: 'POST',
      body: JSON.stringify({ typing: true }),
    }).catch(() => undefined);
  };

  useEffect(() => setPeerGone(false), [selectedId]);

  const send = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    const text = draft.trim();
    const replyTarget = replyTo;
    const editingMsg = editing;
    setDraft('');
    setReplyTo(null);
    setEditing(null);
    setSending(true);
    setError(null);
    const localId = `local-${Date.now()}`;
    const to = normalizeChatLang(toLang);
    const native = normalizeChatLang(nativeLang);
    const source = inferComposerSource(text, native, to);
    if (!editingMsg) {
      const pending: ChatMessage = {
        id: localId,
        body: source === to ? text : '',
        translation: source === native && source !== to ? text : undefined,
        bodyLang: apiChatLang(to),
        senderId: user?.id ?? '',
        mine: true,
        createdAt: new Date().toISOString(),
        status: 'sending',
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              body: replyTarget.body,
              translation: replyTarget.translation,
              bodyLang: replyTarget.bodyLang,
              senderId: replyTarget.senderId,
              deleted: !!replyTarget.deleted,
            }
          : null,
      };
      rememberPair(localId, source === to ? text : '', source === native ? text : '');
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, pending] } : prev,
      );
    } else {
      rememberPair(
        editingMsg.id,
        source === to ? text : (linesById[editingMsg.id]?.to ?? ''),
        source === native ? text : (linesById[editingMsg.id]?.native ?? ''),
      );
    }
    try {
      const { sendBody, sendLang, sendNative, toText, nativeText } = await composePayload(text, editingMsg);
      rememberPair(editingMsg?.id ?? localId, toText, nativeText);
      if (!editingMsg) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((item) =>
                  item.id === localId
                    ? {
                        ...item,
                        body: toText ?? '',
                        translation: nativeText && !sameChatText(nativeText, toText) ? nativeText : sendNative,
                        bodyLang: apiChatLang(sendLang),
                      }
                    : item,
                ),
              }
            : prev,
        );
      }
      if (editingMsg) {
        const msg = await api<ChatMessage>(
          `/messaging/conversations/${selectedId}/messages/${editingMsg.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              body: sendBody,
              translation: sendNative,
              bodyLang: apiChatLang(sendLang),
            }),
          },
        );
        rememberPair(msg.id, toText, nativeText ?? msg.translation);
        replaceMessage({
          ...msg,
          body: toText ?? sendBody,
          translation: sendNative ?? nativeText ?? msg.translation,
          bodyLang: apiChatLang(sendLang),
        });
        return;
      }
      const msg = await api<ChatMessage>(`/messaging/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: sendBody,
          translation: sendNative,
          bodyLang: apiChatLang(sendLang),
          replyToId: replyTarget?.id,
        }),
      });
      rememberPair(msg.id, toText, nativeText ?? msg.translation);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((item) =>
                item.id === localId
                  ? {
                      ...msg,
                      body: sendBody,
                      translation: sendNative ?? msg.translation,
                      bodyLang: apiChatLang(sendLang),
                      status: msg.status ?? 'sent',
                    }
                  : item,
              ),
            }
          : prev,
      );
      patchInboxLast({
        ...msg,
        body: sendBody,
        translation: sendNative ?? msg.translation,
        status: msg.status ?? 'sent',
      });
    } catch (e) {
      if (isUserDeletedError(e)) setPeerGone(true);
      if (!editingMsg) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((item) =>
                  item.id === localId ? { ...item, status: 'failed' } : item,
                ),
              }
            : prev,
        );
      } else {
        setDraft(text);
        setEditing(editingMsg);
      }
      setError(e instanceof Error ? e.message : copy.commonExt.error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const messages = detail?.messages ?? [];
    if (!detail || messages.length === 0) return;
    let cancelled = false;

    (async () => {
      const to = normalizeChatLang(toLang);
      const native = normalizeChatLang(nativeLang);
      for (const msg of messages) {
        if (cancelled) return;
        if (msg.deleted || msg.id.startsWith('local-')) continue;
        const existing = linesById[msg.id];
        const topOk = !!existing?.to?.trim();
        const botOk = !!existing?.native?.trim()
          && (!sameChatText(existing.native, existing.to) || to === native);
        if (topOk && botOk) {
          backfillFailRef.current.delete(msg.id);
          continue;
        }
        const fails = backfillFailRef.current.get(msg.id) ?? 0;
        if (fails >= 5) continue;

        const storedTr = msg.translation?.trim() || null;
        const bodyLooksNative = looksLikeLang(msg.body, native) && !looksLikeLang(msg.body, to);
        const bodyLooksTo = looksLikeLang(msg.body, to) && !looksLikeLang(msg.body, native);
        const bodyLang = msg.bodyLang ? normalizeChatLang(msg.bodyLang) : null;

        let toText = [
          existing?.to?.trim() || null,
          bodyLooksTo || (bodyLang === to && !bodyLooksNative) ? msg.body : null,
          storedTr && looksLikeLang(storedTr, to) && !looksLikeLang(storedTr, native) ? storedTr : null,
        ].find((item) => item?.trim()) ?? null;

        let nativeText = [
          existing?.native?.trim() || null,
          storedTr && !sameChatText(storedTr, toText ?? msg.body) ? storedTr : null,
          bodyLooksNative ? msg.body : null,
        ].find((item) => item?.trim()) ?? null;

        const seed = storedTr && !sameChatText(storedTr, msg.body) ? storedTr : msg.body;
        const seedLang = bodyLooksNative ? native : (bodyLooksTo || bodyLang === to ? to : (bodyLang ?? native));
        if (!toText) toText = await tryTranslateChat(seed, seedLang, to);
        if (!nativeText) {
          nativeText = await tryTranslateChat(toText ?? seed, toText ? to : seedLang, native)
            ?? await tryTranslateChat(seed, seedLang, native)
            ?? (bodyLooksNative ? msg.body : null);
        }
        if (!cancelled) {
          if (toText && nativeText && !sameChatText(toText, nativeText)) {
            backfillFailRef.current.delete(msg.id);
          } else {
            backfillFailRef.current.set(msg.id, fails + 1);
          }
          rememberPair(msg.id, toText, nativeText);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // linesById is updated inside; using it as a dep would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.messages, toLang, nativeLang, rememberPair]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length]);

  useEffect(() => {
    if (!selectedWord) {
      setLookup(null);
      setLookupError(null);
      setSavedMsg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLookupLoading(true);
      setLookupError(null);
      setLookup(null);
      setSavedMsg(null);
      try {
        const res = await api<LookupResult>('/ai/lookup', {
          method: 'POST',
          body: JSON.stringify({
            token: selectedWord,
            lemma: selectedWord.toLowerCase(),
            sentence: selectedSentence.slice(0, 4000) || selectedWord,
            sourceLang: apiChatLang(selectedLineLang),
            targetLang: uiLocale, // Lookup bug (b): answer in the UI language
          }),
        });
        if (!cancelled) {
          const sentenceLike = res.kind === 'sentence' || isSentenceLikeSelection(selectedWord, selectedSentence);
          setLookup({
            ...res,
            phrase: sentenceLike ? null : res.phrase,
            kind: res.kind ?? (sentenceLike ? 'sentence' : res.phrase ? 'phrase' : 'word'),
          });
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : copy.errors.lookupFailed;
        let message = raw;
        if (/disabled by an administrator/i.test(raw)) {
          message = 'AI lookups are temporarily disabled. Please try again later.';
        } else if (/platform ai daily limit/i.test(raw)) {
          message = 'AI lookups are paused for today (platform daily limit). Try again tomorrow.';
        } else if (/quota exceeded|daily limit reached|lookup limit reached/i.test(raw)) {
          message = 'Daily AI lookup limit reached. Try again tomorrow.';
        } else if (/not configured|OPENAI_API_KEY/i.test(raw)) {
          message = 'AI lookup is unavailable right now. Please try again later.';
        } else if (/AI lookup failed/i.test(raw)) {
          message = 'AI lookup failed. Please try again in a moment.';
        }
        if (!cancelled) setLookupError(message);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedWord, selectedSentence, selectedLineLang, uiLocale, copy.errors.lookupFailed]);

  const saveWord = async (mastered = false) => {
    if (!selectedWord || !lookup?.translation) return;
    try {
      const lemma = (lookup.lemma || selectedWord).toLowerCase();
      const existing = vocabItems.find((item) => item.lemma.toLowerCase() === lemma);
      let vocabId = existing?.id;
      if (!vocabId) {
        const saved = await api<VocabItem>('/vocabulary', {
          method: 'POST',
          body: JSON.stringify({
            lemma,
            sourceLang: apiChatLang(selectedLineLang),
            targetLang: apiChatLang(nativeLang),
            translation: lookup.translation,
            contextSentence: (selectedNativeLine || selectedSentence).slice(0, 200) || undefined,
          }),
        });
        vocabId = saved.id;
      }
      if (mastered && vocabId) {
        await markVocabMastered(vocabId, true);
        setSavedMsg(copy.reader.known);
        toast.success(`"${lemma}" ${copy.reader.markedAs(copy.reader.known)}`);
      } else {
        setSavedMsg(copy.reader.savedToVocab);
        toast.success(`"${lemma}" ${copy.reader.savedToVocab}`);
      }
      void refreshVocab().catch(() => undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : copy.errors.saveFailed;
      setSavedMsg(message);
      toast.error(message);
    }
  };

  const closeLookup = () => {
    setSelectedWord(null);
    setLookup(null);
    setLookupError(null);
    setSavedMsg(null);
  };

  const wordPanel = selectedWord ? (
    <WordMeaningPanel
      word={selectedWord}
      lookup={lookup}
      loading={lookupLoading}
      error={lookupError}
      savedMsg={savedMsg}
      onBack={closeLookup}
      onSave={() => void saveWord(false)}
      onKnown={() => void saveWord(true)}
      onIgnore={closeLookup}
      copy={copy}
    />
  ) : null;
  const showList = isDesktop || !selectedId;
  const showThread = isDesktop || !!selectedId;

  return (
    <div className="absolute inset-0 flex bg-white overflow-hidden">
      <aside
        className={cx(
          'shrink-0 border-r border-[#e5e7eb] flex-col min-h-0 bg-white w-full lg:w-[360px]',
          showList ? 'flex' : 'hidden',
        )}
      >
        <div className="px-4 pt-4 pb-3 border-b border-[#e5e7eb]">
          <h1 className="text-lg font-bold text-gray-900 mb-3">{msg.title}</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#99a1af]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={msg.searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] text-sm outline-none focus:border-g-blue-700 focus:ring-1 focus:ring-g-blue-700/40"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="text-[11px] font-bold tracking-wide text-[#99a1af] mb-3">
              {mp.suggestedFromReadings}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openPeerProfile(s.id)}
                  className="w-[130px] shrink-0 rounded-2xl border border-[#e5e7eb] bg-white p-3 text-left hover:border-g-blue-700/40 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <UserAvatar name={s.displayName} url={s.avatarUrl} size={40} online={s.online} />
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
                      {s.reading?.title ?? mp.learner}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pt-2 pb-1 text-[11px] font-bold tracking-wide text-[#99a1af]">
          {mp.recentChats}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingList && conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#99a1af]">{copy.common.loading}</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#99a1af] flex flex-col items-center gap-2 text-center">
              <MessageSquare className="w-8 h-8 text-g-blue-200" />
              <p>{mp.noConversationsHint}</p>
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  className={cx(
                    'w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f3f4f6] text-left transition-colors',
                    active ? 'bg-[#f4efff]' : 'hover:bg-[#f9fafb]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openPeerProfile(c.peer?.id)}
                    className="relative shrink-0 rounded-full"
                    aria-label={`Open ${peerName(c.peer, 'learner')} profile`}
                  >
                    <UserAvatar name={peerName(c.peer, 'Learner')} url={c.peer?.avatarUrl} size={44} online={c.peer?.online} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {peerName(c.peer, 'Learner')}
                        </span>
                        <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', langBadge(c.language ?? c.peer?.primaryLanguage))}>
                          {(c.language ?? c.peer?.primaryLanguage ?? 'en').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#99a1af] shrink-0">
                        {inboxTimestamp(c.lastMessageAt ?? c.lastMessage?.createdAt, mp.yesterday)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cx('text-xs truncate flex items-center gap-1', c.lastMessage?.deleted ? 'text-[#99a1af] italic' : 'text-[#4a5565]')}>
                        {c.lastMessage?.senderId === user?.id && !c.lastMessage?.deleted && (
                          c.lastMessage?.status === 'read'
                            ? <CheckCheck className="w-3.5 h-3.5 text-g-blue-700 shrink-0" />
                            : <Check className="w-3 h-3 text-[#99a1af] shrink-0" />
                        )}
                        <span className="truncate">{c.lastMessage?.body ?? msg.noConversations}</span>
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-g-blue-700 text-white text-[10px] font-extrabold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <section
        className={cx(
          'flex-1 min-w-0 flex-col bg-[#f9fafb] relative',
          showThread ? 'flex' : 'hidden',
        )}
      >
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
            <div className="size-16 rounded-full bg-[#f4efff] grid place-items-center text-[28px]">💬</div>
            <p className="text-base font-semibold text-[#0f1729]">{mp.selectConversation}</p>
            <p className="text-sm text-[#6b7382] max-w-sm">{msg.subtitle}</p>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {gatedPeer && <FriendGateNotice lang={uiLang} peerId={gatedPeer.id} under13={gatedPeer.under13} />}
          </div>
        ) : !detail ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#99a1af] gap-2">
            <p className="text-sm">{loadingThread ? mp.loadingConversation : (error || copy.commonExt.error)}</p>
          </div>
        ) : (
          <>
            <header className="h-14 bg-white border-b border-[#e5e7eb] px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  className="lg:hidden size-9 rounded-lg grid place-items-center text-[#6b7382] hover:bg-[#f4efff] shrink-0"
                  aria-label={copy.common.back}
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => openPeerProfile(detail.peer?.id)}
                  className="flex items-center gap-3 min-w-0 text-left rounded-xl hover:bg-g-blue-50 px-1 py-0.5"
                >
                <UserAvatar name={peerName(detail.peer, 'Learner')} url={detail.peer?.avatarUrl} size={36} online={detail.peer?.online} />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">
                    {peerName(detail.peer, 'Learner')}
                  </div>
                  <div className={cx(
                    'text-[11px] truncate',
                    detail.peer?.typing ? 'text-g-blue-700 font-semibold' : detail.peer?.online ? 'text-[#16a34a]' : 'text-[#99a1af]',
                  )}>
                    {presenceLabel(detail.peer, mp, copy.commonExt) || detail.peer?.handle}
                  </div>
                  </div>
                </button>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {detail.peer?.id && <ReportButton lang={uiLang} target={{ kind: 'user', userId: detail.peer.id, conversationId: detail.id }} />}
                {detail.peer?.id && <BlockButton lang={uiLang} userId={detail.peer.id} onBlocked={() => { setSelectedId(null); void loadInbox(search.trim() || undefined); }} />}
                <ToLangPicker selected={toLang} options={toOptions} uiLang={uiLang} onSelect={persistTo} />
              </div>
            </header>

            {!tipDismissed && (
              <div className="bg-[#f4efff] border-b border-[#d3c2ff] px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 shrink-0">
                <p className="text-[12px] text-g-blue-800 leading-5">{mp.chatTip}</p>
                <button
                  type="button"
                  className="text-g-blue-700 hover:text-g-blue-800 text-sm leading-none px-1"
                  onClick={() => setTipDismissed(true)}
                  aria-label={copy.commonExt.close}
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 space-y-3 bg-g-blue-50">
              {loadingThread && detail.messages.length === 0 ? (
                <p className="text-sm text-[#99a1af]">{copy.common.loading}</p>
              ) : (
                detail.messages.map((m) => {
                  const mine = Boolean(m.mine || (user?.id && m.senderId === user.id));
                  const forced = linesById[m.id];
                  const presented = presentBubble({
                    body: m.body,
                    translation: m.translation,
                    bodyLang: m.bodyLang,
                    nativeLang,
                    toLang,
                    forcedTo: forced?.to,
                    forcedNative: forced?.native,
                  });
                  const primary = presented.primary;
                  const secondary = presented.secondary;
                  const replyForced = m.replyTo ? linesById[m.replyTo.id] : undefined;
                  const replyPresented = m.replyTo && !m.replyTo.deleted
                    ? presentBubble({
                        body: m.replyTo.body,
                        translation: m.replyTo.translation,
                        bodyLang: m.replyTo.bodyLang,
                        nativeLang,
                        toLang,
                        forcedTo: replyForced?.to,
                        forcedNative: replyForced?.native,
                      })
                    : null;
                  const replyName = m.replyTo
                    ? m.replyTo.senderId === user?.id
                      ? mp.you
                      : (peerName(detail.peer, copy.nav.library))
                    : null;
                  return (
                    <div
                      key={m.id}
                      className={cx('group flex w-full flex-col gap-1', mine ? 'items-end' : 'items-start')}
                    >
                      <div className={cx('flex items-end gap-1.5 max-w-[min(86%,32rem)]', mine && 'flex-row-reverse')}>
                        {!mine && (
                          <button
                            type="button"
                            className="hidden sm:block mb-0.5"
                            onClick={() => openPeerProfile(detail.peer?.id)}
                            aria-label={peerName(detail.peer, 'Learner')}
                          >
                            <UserAvatar name={peerName(detail.peer, 'Learner')} url={detail.peer?.avatarUrl} size={28} />
                          </button>
                        )}
                        <div
                          className={cx(
                            'w-fit max-w-full px-3.5 py-2.5 text-[15px] leading-5 shadow-sm',
                            m.deleted
                              ? 'rounded-2xl bg-transparent border border-dashed border-[#d1d5dc] text-[#99a1af] italic shadow-none'
                              : mine
                                ? 'rounded-2xl rounded-br-md bg-g-blue-700 text-white'
                                : 'rounded-2xl rounded-bl-md bg-white border border-[#e5e7eb] text-gray-900',
                          )}
                        >
                          {m.replyTo && !m.deleted && (
                            <div
                              className={cx(
                                'mb-2 pl-2 border-l-2 text-[12px] leading-4',
                                mine ? 'border-white/50 text-white/80' : 'border-g-blue-700 text-[#6a7282]',
                              )}
                            >
                              <div className={cx('font-semibold', mine ? 'text-white' : 'text-g-blue-700')}>
                                {replyName}
                              </div>
                              <div className="line-clamp-2 break-words">
                                {replyPresented
                                  ? (replyPresented.primary || messageSnippet(m.replyTo, mp.messageDeleted))
                                  : messageSnippet(m.replyTo, mp.messageDeleted)}
                              </div>
                            </div>
                          )}
                          {m.deleted ? (
                            <span className="text-[14px]">{mp.messageDeleted}</span>
                          ) : (
                            <>
                              {primary ? (
                                <TappableMessageText
                                  text={primary}
                                  selectedWord={lookup?.phrase?.trim() || selectedWord}
                                  mine={mine}
                                  chatTipTitle={mp.chatTipTitle}
                                  onWordTap={(word) => {
                                    setSelectedWord(word);
                                    setSelectedSentence(sentenceAroundPhrase(primary, word));
                                    setSelectedNativeLine(secondary ? sentenceAroundPhrase(secondary, word) : '');
                                    setSelectedLineLang(presented.primaryLang);
                                  }}
                                  className="text-[15px] leading-5"
                                />
                              ) : (
                                <p className={cx('italic text-[13px]', mine ? 'text-white/80' : 'text-[#6a7282]')}>
                                  {chatTranslatingLabel(uiLang)}
                                </p>
                              )}
                              {secondary ? (
                                <TappableMessageText
                                  text={secondary}
                                  selectedWord={lookup?.phrase?.trim() || selectedWord}
                                  mine={mine}
                                  chatTipTitle={mp.chatTipTitle}
                                  onWordTap={(word) => {
                                    setSelectedWord(word);
                                    setSelectedSentence(sentenceAroundPhrase(secondary, word));
                                    setSelectedNativeLine(sentenceAroundPhrase(secondary, word));
                                    setSelectedLineLang(presented.secondaryLang);
                                  }}
                                  className={cx(
                                    'italic text-[13px] mt-1',
                                    mine ? 'text-white/80' : 'text-[#6a7282]',
                                  )}
                                />
                              ) : null}
                            </>
                          )}
                        </div>
                        {!m.deleted && (
                          <div className="relative shrink-0 self-center">
                            <button
                              type="button"
                              className={cx(
                                'w-7 h-7 rounded-full flex items-center justify-center text-[#99a1af] bg-white/80 border border-[#e5e7eb] shadow-sm hover:bg-white hover:text-[#4a5565] cursor-pointer',
                                menuId === m.id && 'bg-white text-[#4a5565] border-g-blue-200',
                              )}
                              aria-label={copy.commonExt.confirm}
                              onClick={() => setMenuId((id) => (id === m.id ? null : m.id))}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {menuId === m.id && (
                              <>
                                <button
                                  type="button"
                                  className="fixed inset-0 z-20 cursor-default"
                                  aria-label={copy.commonExt.close}
                                  onClick={() => setMenuId(null)}
                                />
                                <div
                                  className={cx(
                                    'absolute z-30 bottom-8 min-w-[148px] rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg',
                                    mine ? 'right-0' : 'left-0',
                                  )}
                                >
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-g-blue-50 cursor-pointer"
                                    onClick={() => startReply(m)}
                                  >
                                    <CornerUpLeft className="w-3.5 h-3.5 text-g-blue-700" />
                                    {mp.reply}
                                  </button>
                                  {canEditMessage(m) && (
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-g-blue-50 cursor-pointer"
                                      onClick={() => startEdit(m)}
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#6a7282]" />
                                      {mp.edit}
                                    </button>
                                  )}
                                  {mine && (
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                                      onClick={() => void deleteMessage(m)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {mp.delete}
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-[#99a1af] inline-flex items-center gap-1 px-1">
                        {formatTime(m.createdAt)}
                        {m.editedAt && !m.deleted ? ' · edited' : ''}
                        {mine && !m.deleted && (
                          m.status === 'sending' ? (
                            <Clock className="w-3 h-3 animate-pulse" />
                          ) : m.status === 'failed' ? (
                            <span className="text-red-500">!</span>
                          ) : m.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-g-blue-700" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </span>
                    </div>
                  );
                })
              )}
              {detail.peer?.typing && (
                <div className="flex justify-start">
                  <div className="px-3.5 py-2 rounded-2xl rounded-bl-md bg-white border border-[#e5e7eb] text-[13px] text-g-blue-700 font-semibold shadow-sm">
                    {mp.typing}
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>

            {selectedWord && !isXl ? (
              <div className="absolute inset-0 z-40 flex justify-end bg-black/30">
                <button type="button" className="flex-1 h-full cursor-default" aria-label={copy.commonExt.close} onClick={closeLookup} />
                <div className="h-full w-full max-w-[380px] bg-white shadow-2xl">
                  {wordPanel}
                </div>
              </div>
            ) : null}

            {detail.peer?.deleted || peerGone ? (
              <footer className="bg-white border-t border-[#e5e7eb] p-3 shrink-0" data-testid="composer-deleted">
                <p className="text-center text-sm text-[#6a7282]">{deletedAccountLine(uiLocale)}</p>
              </footer>
            ) : (
            <footer className="bg-white border-t border-[#e5e7eb] p-3 shrink-0">
              {(replyTo || editing) && (
                <div className="mb-2 flex items-start gap-2 rounded-xl bg-g-blue-50 px-3 py-2">
                  <div className="min-w-0 flex-1 border-l-2 border-g-blue-700 pl-2">
                    <p className="text-[11px] font-bold text-g-blue-700">
                      {editing ? mp.editingMessage : mp.replyTo(replyTo?.mine ? mp.you : (peerName(detail.peer, mp.you)))}
                    </p>
                    <p className="text-xs text-[#6a7282] truncate">
                      {messageSnippet(editing ?? replyTo ?? { body: '', deleted: false }, mp.messageDeleted)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelComposerMode}
                    className="text-[#99a1af] hover:text-gray-700"
                    aria-label={copy.common.cancel}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#e5e7eb] bg-[#f9fafb]">
                  <input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (e.target.value.trim()) notifyTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={editing ? mp.editingMessage : msg.typeMessage}
                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-[#99a1af]"
                  />
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f3f4f6] text-[#4a5565]">
                    {nativeLang.slice(0, 2)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void send()}
                  className="w-10 h-10 rounded-full bg-g-blue-700 text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#5b07c4] transition-colors"
                  aria-label={editing ? copy.common.saveChanges : msg.send}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </footer>
            )}
            {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}
          </>
        )}
      </section>

      {selectedWord && isXl ? (
        <aside className="w-[min(380px,32vw)] shrink-0 border-l border-[#e4e7ec] bg-white min-h-0 hidden xl:flex flex-col">
          {wordPanel}
        </aside>
      ) : null}

      <PeerProfileModal
        peerId={profilePeerId}
        onClose={() => setProfilePeerId(null)}
        onMessage={(peer) => void messageFromProfile(peer)}
      />
    </div>
  );
}
