import { deletedAccountLine, isUserDeletedError, shownName } from '../lib/deletedUser';
import { handleLimitError } from '../lib/limits';
import { BlockButton, FriendGateNotice, ReportButton } from '../components/safety/SafetyActions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AgePrompt } from '../components/safety/AgePrompt';
import { withAppBase } from '../lib/authRoutes';
import { isDailyLimitError } from '../lib/dailyLimit';
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, Check, CheckCheck, ChevronDown, Clock, CornerUpLeft, Flag, Languages, MessageSquare, MoreHorizontal, Pencil, RotateCcw, Search, Send, Trash2, User as UserIcon, X } from 'lucide-react';
import { CatalogLanguageFlag } from '../components/CatalogLanguageFlag';
import { toast } from 'sonner';
import { PeerProfileModal, type MessagingPeerProfile } from '../components/PeerProfileModal';
import { UserAvatar } from '../components/UserAvatar';
import { api, getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  apiChatLang,
  chatLangName,
  chatToLabel,
  chatTranslatingLabel,
  chatTranslateFailedLabel,
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
import { surfaceCopy } from '@gotcha/shared';
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

/** Chat-only UI strings (uz/ru/en) added with the messaging redesign. */
const CHATX = {
  en: {
    notSent: 'Not sent', retry: 'Try again', remove: 'Remove', viewProfile: 'View profile', more: 'More actions', isNew: 'New',
    learning: (lang: string) => `Learning ${lang}`,
    emptyHint: 'Write in your own language — messages are translated automatically. Tap a word in the language you are learning to see its meaning.',
    starters: ['👋 Hi! How are you?', '📖 What are you reading now?', '🤝 Want to practise together?'],
    deleteTitle: 'Delete message?', keep: 'Cancel',
  },
  ru: {
    notSent: 'Не отправлено', retry: 'Повторить', remove: 'Убрать', viewProfile: 'Открыть профиль', more: 'Ещё', isNew: 'Новый',
    learning: (lang: string) => `Изучает: ${lang}`,
    emptyHint: 'Пишите на своём языке — сообщения переводятся автоматически. Нажмите на слово на изучаемом языке, чтобы увидеть значение.',
    starters: ['👋 Привет! Как дела?', '📖 Что вы сейчас читаете?', '🤝 Давайте практиковаться вместе?'],
    deleteTitle: 'Удалить сообщение?', keep: 'Отмена',
  },
  uz: {
    notSent: 'Yuborilmadi', retry: 'Qayta urinish', remove: 'Oʻchirish', viewProfile: 'Profilni koʻrish', more: 'Boshqa amallar', isNew: 'Yangi',
    learning: (lang: string) => `${lang} oʻrganmoqda`,
    emptyHint: 'Oʻz tilingizda yozing — xabar avtomatik tarjima qilinadi. Oʻrganayotgan tilingizdagi soʻzni bossangiz, maʼnosi chiqadi.',
    starters: ['👋 Salom! Qalaysiz?', '📖 Hozir nima oʻqiyapsiz?', '🤝 Birga mashq qilamizmi?'],
    deleteTitle: 'Xabar oʻchirilsinmi?', keep: 'Bekor qilish',
  },
};
const chatX = (lang?: string | null) => CHATX[lang === 'ru' || lang === 'uz' ? lang : 'en'];
const TIP_KEY = 'gotcha.chatTip.dismissed';

const CHAT_TZ = 'Asia/Tashkent';
const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

function chatDateLocale(code?: string | null) {
  if (code === 'ru') return 'ru-RU';
  if (code === 'en') return 'en-GB';
  return 'uz-UZ';
}

function tashkentParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const bag = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHAT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => bag.find((part) => part.type === type)?.value ?? '';
  return { key: `${get('year')}-${get('month')}-${get('day')}`, day: Number(get('day')), month: Number(get('month')), time: `${get('hour')}:${get('minute')}` };
}

function inboxTimestamp(iso: string | undefined | null, yesterdayLabel: string, locale?: string | null) {
  if (!iso) return '';
  const parts = tashkentParts(iso);
  if (!parts) return '';
  const today = tashkentParts(new Date().toISOString());
  const yesterday = tashkentParts(new Date(Date.now() - 86_400_000).toISOString());
  if (today && parts.key === today.key) return parts.time;
  if (yesterday && parts.key === yesterday.key) return yesterdayLabel;
  if ((locale ?? 'uz') === 'uz') return `${parts.day}-${UZ_MONTHS[parts.month - 1] ?? ''}`;
  return new Intl.DateTimeFormat(chatDateLocale(locale), { timeZone: CHAT_TZ, day: 'numeric', month: 'short' }).format(new Date(iso));
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

function friendlyError(e: unknown, copy: { commonExt: { error: string; offline: string; tooLong: string } }) {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : '';
  if (status === 400 && /long|4000|maxlength/i.test(msg)) return copy.commonExt.tooLong;
  if (status == null || status === 0 || /failed to fetch|network|load failed/i.test(msg)) return copy.commonExt.offline;
  return copy.commonExt.error;
}

function formatTime(iso: string) {
  return tashkentParts(iso)?.time ?? '';
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
  if (!peer.lastSeenAt) return '';
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
              'cursor-pointer underline decoration-dotted decoration-[1.5px] underline-offset-[4px] rounded-[4px] px-0.5 -mx-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-600',
              mine
                ? 'decoration-white/60 hover:bg-white/15 hover:decoration-white'
                : 'decoration-g-blue-300 hover:bg-g-blue-50 hover:decoration-g-blue-700',
              selected && 'no-underline bg-[#fff2b3] text-[#101828] shadow-[inset_0_-2px_0_#f5b400]',
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
  nativeLang,
  onSelect,
}: {
  selected: string;
  options: string[];
  uiLang?: string | null;
  nativeLang: string;
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
        className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-[11px] border border-[#e3e5ee] bg-white text-[13px] font-semibold text-[#101828] hover:bg-gray-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${chatToLabel(uiLang)}: ${chatLangName(selected, uiLang)}`}
      >
        <span className="hidden sm:inline text-[11px] font-semibold text-[#9aa0ae] mr-0.5">{chatToLabel(uiLang)}</span>
        <CatalogLanguageFlag code={nativeLang.toLowerCase()} className="h-3 w-[18px]" />
        <ArrowRight className="w-3 h-3 text-[#9aa0ae]" aria-hidden />
        <CatalogLanguageFlag code={selected.toLowerCase()} className="h-3 w-[18px]" />
        <span className="hidden md:inline">{chatLangName(selected, uiLang)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#9aa0ae]" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 z-30 min-w-[200px] rounded-[14px] border border-[#e9ebf3] bg-white shadow-[0_18px_40px_rgba(16,24,40,0.14)] p-1.5"
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
                'w-full flex items-center gap-2.5 min-h-10 px-3 rounded-[9px] text-sm text-left hover:bg-g-blue-50',
                code === selected ? 'bg-g-blue-50 font-semibold text-g-blue-700' : 'text-[#101828]',
              )}
            >
              <CatalogLanguageFlag code={code.toLowerCase()} className="h-3.5 w-5" />
              <span className="flex-1">{chatLangName(code, uiLang)}</span>
              {code === selected && <Check className="w-4 h-4" aria-hidden />}
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
  sourceLang,
}: {
  sourceLang?: string;
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
  const { locale } = useLearnerLocale();
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
      <div className="flex items-center justify-between gap-3 h-[60px] px-5 border-b border-[#eceef5] shrink-0">
        <h2 className="text-[15px] font-bold text-[#101828]">{mp.wordMeaning}</h2>
        <button
          type="button"
          onClick={onBack}
          className="size-9 rounded-[10px] border border-[#e3e5ee] grid place-items-center text-[#4a5565] hover:bg-gray-50"
          aria-label={copy.commonExt.close}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5 space-y-5">
        <div className="space-y-1.5">
          {sourceLang && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#6b7080]">
              <CatalogLanguageFlag code={sourceLang.toLowerCase()} className="h-3 w-[18px]" />{chatLangName(sourceLang, locale)}
            </p>
          )}
          <p className="text-[28px] font-extrabold tracking-tight text-[#101828] leading-tight break-words">
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
          <section className="rounded-[14px] bg-[#f4f5ff] px-4 py-3.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-g-blue-700 mb-1.5">{reader.naturalMeaning}</h3>
            <p className="text-sm text-[#0f1729] leading-6">
              {loading ? '…' : (naturalMeaning || lookup?.translation || reader.lookupError)}
            </p>
          </section>
        ) : null}

        {lookup?.translation && (sentenceLike || lookup.translation.trim() !== naturalMeaning) ? (
          <section className={sentenceLike ? 'rounded-[14px] bg-[#f4f5ff] px-4 py-3.5' : undefined}>
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#8a8fa0] mb-1.5">{reader.translation}</h3>
            <p className="text-base font-semibold text-[#101828] leading-6 whitespace-pre-wrap break-words">{lookup.translation}</p>
          </section>
        ) : null}

        {lookup?.grammarNote && lookup.grammarNote.trim() !== naturalMeaning && lookup.grammarNote.trim() !== lookup.translation?.trim() ? (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-2">{surfaceCopy(locale).grammarNote}</h3>
            <p className="text-sm text-[#4a5565] leading-6 whitespace-pre-wrap">{lookup.grammarNote}</p>
          </section>
        ) : null}
      </div>

      {showVocabActions ? (
      <div className="shrink-0 border-t border-[#eceef5] p-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={!canAct}
          onClick={onSave}
          className="h-11 rounded-[12px] bg-g-blue-700 text-g-on-cta text-sm font-bold disabled:opacity-40 hover:bg-g-blue-800"
        >
          {reader.save}
        </button>
        <button
          type="button"
          disabled={!canAct}
          onClick={onKnown}
          className="h-11 rounded-[12px] border border-[#e3e5ee] bg-white text-sm font-semibold text-[#0f1729] disabled:opacity-40 hover:bg-[#f9fafb] inline-flex items-center justify-center gap-1"
        >
          <Check className="w-4 h-4 text-[#16a34a]" />
          {reader.known}
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="h-11 rounded-[12px] border border-[#e3e5ee] bg-white text-sm font-semibold text-[#6b7382] hover:bg-[#f9fafb] inline-flex items-center justify-center gap-1"
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
  const ux = chatX(uiLocale);
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
  const [askAge, setAskAge] = useState(false);
  const [recipientBlocked, setRecipientBlocked] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return window.localStorage.getItem(TIP_KEY) === '1'; } catch { return false; }
  });
  const dismissTip = () => {
    setTipDismissed(true);
    try { window.localStorage.setItem(TIP_KEY, '1'); } catch { /* private mode */ }
  };
  const [headerMenu, setHeaderMenu] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [toLangOverride, setToLangOverride] = useState<string | null>(null);
  const [linesById, setLinesById] = useState<Record<string, LinePair>>({});
  const [translateFailed, setTranslateFailed] = useState<Record<string, boolean>>({});
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
  const lastMessageIdRef = useRef<string | null>(null);
  const typingSentAt = useRef(0);
  const isDesktop = useMinWidth(1024);
  const isXl = useMinWidth(1280);

  const nativeLang = normalizeChatLang(user?.nativeLanguage);
  const uiLang = user?.uiLanguage ?? nativeLang;
  useEffect(() => {
    lastMessageIdRef.current = detail?.messages[detail.messages.length - 1]?.id ?? null;
  }, [detail]);
  const toOptions = useMemo(() => otherChatLangs(nativeLang), [nativeLang]);
  // Default translation language = what *I* am learning (primary target), not the peer's native language.
  const myLearning = useMemo(() => {
    const list = user?.targetLanguages ?? [];
    const code = (list.find((tl) => tl.isPrimary) ?? list[0])?.targetLanguage;
    return code ? normalizeChatLang(code) : null;
  }, [user?.targetLanguages]);
  const toLang = useMemo(
    () =>
      coerceToLang(
        nativeLang,
        toLangOverride
          ?? learningTarget(nativeLang, myLearning && toOptions.includes(myLearning) ? myLearning : detail?.peer?.nativeLanguage, toOptions[0]),
      ),
    [nativeLang, toLangOverride, myLearning, detail?.peer?.nativeLanguage, toOptions],
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
      setConversations(inbox);
      setSuggestions(suggested);
    } catch (e) {
      if (!silent) setError(friendlyError(e, copy));
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
        const seenId = d.messages[d.messages.length - 1]?.id;
        lastMessageIdRef.current = seenId ?? null;
        await api(`/messaging/conversations/${selectedId}/read`, {
          method: 'POST',
          body: JSON.stringify(seenId ? { messageId: seenId } : {}),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
        );
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, copy));
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
        const after = lastMessageIdRef.current;
        const page = after
          ? await api<{ messages?: ChatMessage[] }>(`/messaging/conversations/${selectedId}?after=${encodeURIComponent(after)}`)
          : null;
        if (cancelled) return;
        setDetail((prev) => {
          if (!prev || prev.id !== selectedId) return prev;
          const known = new Set(prev.messages.map((item) => item.id));
          const extra = (page?.messages ?? []).filter((item) => item.id && !known.has(item.id));
          const messages = extra.length ? [...prev.messages, ...extra] : prev.messages;
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
            messages: applyReadReceipts(messages, status.peerLastReadAt),
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
      setError(friendlyError(e, copy));
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
    setPendingDelete(null);
    try {
      const updated = await api<ChatMessage>(
        `/messaging/conversations/${selectedId}/messages/${m.id}`,
        { method: 'DELETE' },
      );
      replaceMessage(updated);
    } catch (e) {
      setError(friendlyError(e, copy));
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

  useEffect(() => {
    setPeerGone(false);
    setRecipientBlocked(false);
    setError(null);
    setHeaderMenu(false);
    setPendingDelete(null);
  }, [selectedId]);

  const removeLocal = (id: string) => {
    setDetail((prev) => (prev ? { ...prev, messages: prev.messages.filter((item) => item.id !== id) } : prev));
    setLinesById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const retryFailed = (m: ChatMessage) => {
    const text = (linesById[m.id]?.native || m.translation || m.body || linesById[m.id]?.to || '').trim();
    removeLocal(m.id);
    if (text) void send(text);
  };

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!selectedId || !text || sending || recipientBlocked) return;
    const replyTarget = override === undefined ? replyTo : null;
    const editingMsg = override === undefined ? editing : null;
    if (override === undefined) {
      setDraft('');
      setReplyTo(null);
      setEditing(null);
    }
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
      const code = (e as { code?: string }).code;
      if (code === 'BIRTH_YEAR_REQUIRED') {
        setAskAge(true);
        setError(mp.birthYearBanner);
      } else if (code === 'RECIPIENT_NOT_ELIGIBLE') {
        // One notice replaces the composer; no duplicate error line.
        setRecipientBlocked(true);
        setError(null);
      } else {
        setError(friendlyError(e, copy));
      }
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
        const settleKey = `${msg.id}:${to}:${native}`;
        if (topOk && botOk) {
          backfillFailRef.current.set(settleKey, 1);
          continue;
        }
        if (backfillFailRef.current.has(settleKey)) continue;
        backfillFailRef.current.set(settleKey, 1);

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
        else if (!nativeText) nativeText = await tryTranslateChat(seed, seedLang, native);
        if (!cancelled) {
          if (!toText && !nativeText) {
            setTranslateFailed((prev) => ({ ...prev, [msg.id]: true }));
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
        if (handleLimitError(e)) return;
        const raw = e instanceof Error ? e.message : copy.errors.lookupFailed;
        let message = raw;
        // lookup_limit: the API already sends the uz/ru/en PLUS-OFFER Defaults #4 text (lib/api.ts).
        if (isDailyLimitError(e)) {
          // Friendly DailyLimitNotice (reset time, user's timezone) is already shown: no error toast.
          message = '';
        } else if ((e as { code?: string } | null)?.code === 'lookup_limit') {
          message = raw;
        } else if (/disabled by an administrator/i.test(raw)) {
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
      sourceLang={selectedLineLang}
    />
  ) : null;
  const showList = isDesktop || !selectedId;
  const showThread = isDesktop || !!selectedId;

  const menuItem = 'w-full flex items-center gap-2.5 min-h-10 px-3 rounded-[9px] text-left text-sm font-medium text-[#101828] hover:bg-g-blue-50';

  return (
    <div className="absolute inset-0 flex bg-white overflow-hidden">
      {askAge ? <AgePrompt force onDone={() => setAskAge(false)} /> : null}
      <aside
        className={cx(
          'shrink-0 border-r border-[#eceef5] flex-col min-h-0 bg-white w-full lg:w-[360px]',
          showList ? 'flex' : 'hidden',
        )}
      >
        <div className="px-4 sm:px-5 pt-5 pb-3">
          <h1 className="text-[22px] font-bold tracking-tight text-[#101828] mb-3">{msg.title}</h1>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0ae]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={msg.searchPlaceholder}
              aria-label={msg.searchPlaceholder}
              className="w-full h-10 pl-10 pr-3 rounded-[11px] bg-[#f4f5fa] border border-transparent text-sm text-[#101828] outline-none placeholder:text-[#9aa0ae] focus:bg-white focus:border-g-blue-600 focus:ring-4 focus:ring-g-blue-50"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 sm:px-5 pb-3 shrink-0 border-b border-[#f0f1f6]">
            <div className="text-[11px] font-bold tracking-[0.12em] text-[#8a8fa0] mb-2.5">
              {mp.suggestedFromReadings}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openPeerProfile(s.id)}
                  className="w-[112px] shrink-0 rounded-xl border border-[#eceef5] bg-white px-2 py-2.5 text-center hover:border-g-blue-200 hover:bg-g-blue-50/40 transition-colors"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <UserAvatar name={s.displayName} url={s.avatarUrl} size={36} online={s.online} />
                    <span className="text-xs font-semibold text-[#101828] truncate max-w-full">
                      {s.displayName.split(' ')[0]}
                      {s.displayName.split(' ')[1] ? ` ${s.displayName.split(' ')[1]![0]}.` : ''}
                    </span>
                    <span className="text-[10.5px] text-[#8a8fa0] truncate w-full">
                      {s.reading?.title ?? mp.learner}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {user?.birthYear == null ? (
          <Link to={`${withAppBase('/app/settings')}#birth-year`} className="mx-4 mt-3 block rounded-xl bg-[#f3f0ff] px-3 py-2 text-sm font-medium text-[#2107AA]">
            {mp.birthYearBanner}
          </Link>
        ) : null}
        <div className="px-4 sm:px-5 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-[#8a8fa0]">
          {mp.recentChats}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingList && conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#99a1af]">{copy.common.loading}</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-sm text-[#4a5565] flex flex-col items-center gap-3 text-center">
              <span className="size-14 rounded-full bg-g-blue-50 grid place-items-center"><MessageSquare className="w-6 h-6 text-g-blue-700" /></span>
              <p className="text-base font-semibold text-[#0f1729]">{mp.emptyTitle}</p>
              <p>{mp.emptyBody}</p>
              <button type="button" onClick={() => document.getElementById('learner-search')?.focus()} className="h-10 px-4 rounded-xl bg-g-blue-700 text-g-on-cta text-sm font-semibold">
                {mp.sendFriend}
              </button>
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === selectedId;
              const learning = c.peer?.primaryLanguage;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cx(
                    'relative w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left transition-colors',
                    active ? 'bg-[#f3f1ff] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-r before:bg-g-blue-700' : 'hover:bg-[#f9fafb]',
                  )}
                >
                  <UserAvatar name={peerName(c.peer, 'Learner')} url={c.peer?.avatarUrl} size={44} online={c.peer?.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cx('text-sm truncate text-[#101828]', c.unreadCount > 0 ? 'font-bold' : 'font-semibold')}>
                        {peerName(c.peer, 'Learner')}
                      </span>
                      {!c.lastMessage ? (
                        <span className="text-[10px] font-bold text-g-blue-700 bg-g-blue-50 px-1.5 py-0.5 rounded-md shrink-0">{ux.isNew}</span>
                      ) : learning ? (
                        <span title={ux.learning(chatLangName(learning, uiLang))} className="shrink-0 inline-flex">
                          <CatalogLanguageFlag code={learning.toLowerCase()} className="h-2.5 w-3.5" />
                        </span>
                      ) : null}
                      <span className="ml-auto text-[11.5px] text-[#9aa0ae] shrink-0 tabular-nums">
                        {inboxTimestamp(c.lastMessageAt ?? c.lastMessage?.createdAt, mp.yesterday, uiLang)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cx('text-[13px] truncate flex items-center gap-1 min-w-0', c.lastMessage?.deleted ? 'text-[#99a1af] italic' : c.lastMessage ? (c.unreadCount > 0 ? 'text-[#101828] font-medium' : 'text-[#4a5565]') : 'text-[#9aa0ae]')}>
                        {c.lastMessage?.senderId === user?.id && !c.lastMessage?.deleted && (
                          c.lastMessage?.status === 'read'
                            ? <CheckCheck className="w-3.5 h-3.5 text-g-blue-700 shrink-0" />
                            : <Check className="w-3.5 h-3.5 text-[#9aa0ae] shrink-0" />
                        )}
                        <span className="truncate">{c.lastMessage?.body ?? (c.peer?.handle ? `@${c.peer.handle.replace(/^@/, '')}` : '')}</span>
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-g-blue-700 text-g-on-cta text-[11px] font-extrabold flex items-center justify-center shrink-0">
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

      <section
        className={cx(
          'flex-1 min-w-0 flex-col bg-[#f6f7fc] relative',
          showThread ? 'flex' : 'hidden',
        )}
      >
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
            <span className="size-16 rounded-full bg-g-blue-50 grid place-items-center"><MessageSquare className="w-7 h-7 text-g-blue-700" /></span>
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
            <header className="h-[64px] bg-white border-b border-[#eceef5] px-2 sm:px-5 flex items-center justify-between gap-2 shrink-0 relative z-20">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  className="lg:hidden size-9 rounded-[10px] border border-[#e3e5ee] grid place-items-center text-[#4a5565] hover:bg-gray-50 shrink-0"
                  aria-label={copy.common.back}
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openPeerProfile(detail.peer?.id)}
                  className="flex items-center gap-3 min-w-0 text-left rounded-xl hover:bg-g-blue-50 px-1.5 py-1"
                >
                  <UserAvatar name={peerName(detail.peer, 'Learner')} url={detail.peer?.avatarUrl} size={38} online={detail.peer?.online} />
                  <div className="min-w-0">
                    <div className="font-bold text-[15px] text-[#101828] truncate">
                      {peerName(detail.peer, 'Learner')}
                    </div>
                    <div className={cx(
                      'text-xs truncate',
                      detail.peer?.typing ? 'text-g-blue-700 font-semibold' : detail.peer?.online ? 'text-[#16a34a] font-medium' : 'text-[#8a8fa0]',
                    )}>
                      {presenceLabel(detail.peer, mp, copy.commonExt) || (detail.peer?.handle ? `@${detail.peer.handle.replace(/^@/, '')}` : '')}
                    </div>
                  </div>
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ToLangPicker selected={toLang} options={toOptions} uiLang={uiLang} nativeLang={nativeLang} onSelect={persistTo} />
                <div className="relative">
                  <button
                    type="button"
                    aria-label={ux.more}
                    aria-haspopup="menu"
                    aria-expanded={headerMenu}
                    onClick={() => setHeaderMenu((v) => !v)}
                    className={cx('size-9 rounded-[11px] border grid place-items-center text-[#4a5565] hover:bg-gray-50', headerMenu ? 'border-g-blue-200 bg-g-blue-50' : 'border-[#e3e5ee] bg-white')}
                  >
                    <MoreHorizontal className="w-[18px] h-[18px]" />
                  </button>
                  {headerMenu && <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label={copy.commonExt.close} onClick={() => setHeaderMenu(false)} />}
                  {/* Kept mounted (only hidden) so the Report / Block dialogs inside survive the menu closing. */}
                  <div
                    role="menu"
                    onClick={() => setHeaderMenu(false)}
                    className={cx(
                      'absolute right-0 top-full mt-2 z-30 w-56 rounded-[14px] border border-[#e9ebf3] bg-white p-1.5 shadow-[0_18px_40px_rgba(16,24,40,0.14)] transition-opacity',
                      headerMenu ? 'opacity-100' : 'opacity-0 pointer-events-none invisible',
                    )}
                  >
                    <button type="button" role="menuitem" className={menuItem} onClick={() => openPeerProfile(detail.peer?.id)}>
                      <UserIcon className="w-4 h-4 text-[#4a5565]" />{ux.viewProfile}
                    </button>
                    {detail.peer?.id && (
                      <ReportButton
                        lang={uiLang}
                        name={peerName(detail.peer, 'Learner')}
                        icon={<Flag className="w-4 h-4 text-[#4a5565]" />}
                        className={menuItem}
                        target={{ kind: 'user', userId: detail.peer.id, conversationId: detail.id }}
                      />
                    )}
                    {detail.peer?.id && (
                      <BlockButton
                        lang={uiLang}
                        name={peerName(detail.peer, 'Learner')}
                        icon={<Ban className="w-4 h-4" />}
                        className={cx(menuItem, 'text-red-600 hover:bg-red-50')}
                        userId={detail.peer.id}
                        onBlocked={() => { setSelectedId(null); void loadInbox(search.trim() || undefined); }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </header>

            {!tipDismissed && detail.messages.length > 0 && (
              <div className="bg-[#f4f2ff] border-b border-[#e3dcff] px-4 sm:px-5 py-2 flex items-center justify-between gap-3 shrink-0">
                <p className="text-[12.5px] text-g-blue-800 leading-5 flex items-center gap-2"><Languages className="w-4 h-4 shrink-0" />{mp.chatTip}</p>
                <button
                  type="button"
                  className="size-7 rounded-lg grid place-items-center text-g-blue-700 hover:bg-white/70"
                  onClick={dismissTip}
                  aria-label={copy.commonExt.close}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 py-4 flex flex-col gap-1.5">
              {loadingThread && detail.messages.length === 0 ? (
                <p className="text-sm text-[#99a1af]">{copy.common.loading}</p>
              ) : detail.messages.length === 0 ? (
                <div className="m-auto max-w-md flex flex-col items-center text-center gap-2 py-8">
                  <UserAvatar name={peerName(detail.peer, 'Learner')} url={detail.peer?.avatarUrl} size={72} />
                  <p className="text-lg font-bold text-[#101828] mt-1">{peerName(detail.peer, 'Learner')}</p>
                  <p className="text-[13px] text-[#6b7080] flex items-center gap-1.5 flex-wrap justify-center">
                    {detail.peer?.handle ? `@${detail.peer.handle.replace(/^@/, '')}` : null}
                    {detail.peer?.primaryLanguage ? (
                      <>
                        {detail.peer?.handle ? <span aria-hidden>·</span> : null}
                        <CatalogLanguageFlag code={detail.peer.primaryLanguage.toLowerCase()} className="h-2.5 w-3.5" />
                        {ux.learning(chatLangName(detail.peer.primaryLanguage, uiLang))}
                      </>
                    ) : null}
                  </p>
                  <div className="mt-3 flex gap-2.5 text-left rounded-[14px] border border-[#e9ebf3] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#4a5565]">
                    <Languages className="w-4 h-4 text-g-blue-700 shrink-0 mt-0.5" />{ux.emptyHint}
                  </div>
                  {!(detail.peer?.deleted || peerGone || recipientBlocked) && (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {ux.starters.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() => setDraft(line.replace(/^\S+\s/, ''))}
                          className="min-h-9 px-3.5 rounded-full border border-g-blue-100 bg-white text-[13px] font-semibold text-g-blue-700 hover:bg-g-blue-50"
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                detail.messages.map((m, i) => {
                  const mine = Boolean(m.mine || (user?.id && m.senderId === user.id));
                  const local = m.id.startsWith('local-');
                  const failed = m.status === 'failed';
                  const next = detail.messages[i + 1];
                  const showAvatar = !mine && (!next || Boolean(next.mine) || next.senderId !== m.senderId);
                  const prev = detail.messages[i - 1];
                  const dayKey = tashkentParts(m.createdAt)?.key;
                  const prevKey = prev ? tashkentParts(prev.createdAt)?.key : null;
                  const dayLabel = dayKey && dayKey !== prevKey
                    ? (dayKey === tashkentParts(new Date().toISOString())?.key
                      ? copy.commonExt.today
                      : inboxTimestamp(m.createdAt, copy.commonExt.yesterday, uiLang))
                    : null;
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
                  const solid = mine && !failed && !m.deleted;
                  return (
                    <div
                      key={m.id}
                      className={cx('group flex w-full flex-col gap-1', mine ? 'items-end' : 'items-start')}
                    >
                      {dayLabel ? (
                        <p className="self-center text-[11.5px] font-semibold text-[#6b7080] bg-[#eceef6] rounded-full px-2.5 py-0.5 my-2">{dayLabel}</p>
                      ) : null}
                      <div className={cx('flex items-end gap-2 max-w-[min(88%,34rem)] sm:max-w-[min(72%,34rem)]', mine && 'flex-row-reverse')}>
                        {!mine && (
                          showAvatar ? (
                            <button
                              type="button"
                              className="hidden sm:block mb-0.5 shrink-0"
                              onClick={() => openPeerProfile(detail.peer?.id)}
                              aria-label={peerName(detail.peer, 'Learner')}
                            >
                              <UserAvatar name={peerName(detail.peer, 'Learner')} url={detail.peer?.avatarUrl} size={28} />
                            </button>
                          ) : <span className="hidden sm:block w-7 shrink-0" aria-hidden />
                        )}
                        <div
                          className={cx(
                            'w-fit max-w-full px-3.5 py-2.5 text-[15px] leading-[1.4]',
                            m.deleted
                              ? 'rounded-2xl bg-transparent border border-dashed border-[#d1d5dc] text-[#99a1af] italic'
                              : failed
                                ? 'rounded-2xl rounded-br-md bg-white border-[1.5px] border-red-200 text-[#101828]'
                                : mine
                                  ? 'rounded-2xl rounded-br-md bg-g-blue-700 text-g-on-cta shadow-[0_4px_12px_rgba(33,7,170,0.18)]'
                                  : 'rounded-2xl rounded-bl-md bg-white border border-[#eceef5] text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
                          )}
                        >
                          {m.replyTo && !m.deleted && (
                            <div
                              className={cx(
                                'mb-2 pl-2 border-l-2 text-[12px] leading-4',
                                solid ? 'border-white/50 text-white/80' : 'border-g-blue-700 text-[#6a7282]',
                              )}
                            >
                              <div className={cx('font-semibold', solid ? 'text-white' : 'text-g-blue-700')}>
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
                                  mine={solid}
                                  chatTipTitle={mp.chatTipTitle}
                                  onWordTap={(word) => {
                                    setSelectedWord(word);
                                    setSelectedSentence(sentenceAroundPhrase(primary, word));
                                    setSelectedNativeLine(secondary ? sentenceAroundPhrase(secondary, word) : '');
                                    setSelectedLineLang(presented.primaryLang);
                                  }}
                                  className="text-[15px] leading-[1.4] [overflow-wrap:anywhere]"
                                />
                              ) : (
                                <p className={cx('italic text-[13px] min-h-5', solid ? 'text-white/80' : 'text-[#6a7282]')}>
                                  {translateFailed[m.id] ? chatTranslateFailedLabel(uiLang) : chatTranslatingLabel(uiLang)}
                                </p>
                              )}
                              {secondary ? (
                                /* The native-language line is a reading aid only: never tappable (no lookups in your own language). */
                                <p
                                  className={cx(
                                    'flex items-baseline gap-1.5 text-[13px] leading-snug mt-1.5 pt-1.5 border-t break-words [overflow-wrap:anywhere]',
                                    solid ? 'text-white/75 border-white/15' : 'text-[#6b7080] border-[#f0f1f6]',
                                  )}
                                >
                                  <span className={cx('shrink-0 text-[9.5px] font-bold tracking-wide px-1 py-px rounded', solid ? 'bg-white/15 text-white/80' : 'bg-[#f1f2f7] text-[#8a8fa0]')}>
                                    {presented.secondaryLang.slice(0, 2).toUpperCase()}
                                  </span>
                                  <span className="min-w-0">{secondary}</span>
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                        {!m.deleted && !local && (
                          <div className="relative shrink-0 self-center">
                            <button
                              type="button"
                              className={cx(
                                'size-7 rounded-full flex items-center justify-center text-[#9aa0ae] bg-white border border-[#eceef5] hover:text-[#4a5565] cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity',
                                menuId === m.id && 'sm:opacity-100 text-[#4a5565] border-g-blue-200',
                              )}
                              aria-label={ux.more}
                              aria-haspopup="menu"
                              aria-expanded={menuId === m.id}
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
                                  role="menu"
                                  className={cx(
                                    'absolute z-30 bottom-9 w-48 rounded-[14px] border border-[#e9ebf3] bg-white p-1.5 shadow-[0_18px_40px_rgba(16,24,40,0.14)]',
                                    mine ? 'right-0' : 'left-0',
                                  )}
                                >
                                  <button type="button" role="menuitem" className={menuItem} onClick={() => startReply(m)}>
                                    <CornerUpLeft className="w-4 h-4 text-g-blue-700" />
                                    {mp.reply}
                                  </button>
                                  {canEditMessage(m) && (
                                    <button type="button" role="menuitem" className={menuItem} onClick={() => startEdit(m)}>
                                      <Pencil className="w-4 h-4 text-[#6a7282]" />
                                      {mp.edit}
                                    </button>
                                  )}
                                  {mine && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className={cx(menuItem, 'text-red-600 hover:bg-red-50')}
                                      onClick={() => { setMenuId(null); setPendingDelete(m); }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      {mp.delete}
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <span className={cx('text-[11px] text-[#9aa0ae] inline-flex items-center gap-1 px-1', !mine && 'sm:pl-10')}>
                        {formatTime(m.createdAt)}
                        {m.editedAt && !m.deleted ? ` · ${mp.edited}` : ''}
                        {mine && !m.deleted && !failed && (
                          m.status === 'sending' ? (
                            <Clock className="w-3 h-3 animate-pulse" />
                          ) : m.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-g-blue-700" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </span>
                      {failed && (
                        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold" role="alert">
                          <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" />{ux.notSent}</span>
                          {!recipientBlocked && (
                            <button type="button" onClick={() => retryFailed(m)} disabled={sending} className="inline-flex items-center gap-1 min-h-7 px-2 rounded-md bg-g-blue-50 text-g-blue-700 hover:bg-g-blue-100 disabled:opacity-50">
                              <RotateCcw className="w-3 h-3" />{ux.retry}
                            </button>
                          )}
                          <button type="button" onClick={() => removeLocal(m.id)} className="min-h-7 px-2 rounded-md bg-[#f1f2f6] text-[#4a5565] hover:bg-[#e8e9ef]">
                            {ux.remove}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {detail.peer?.typing && (
                <div className="flex justify-start sm:pl-9">
                  <div className="px-3.5 py-2 rounded-2xl rounded-bl-md bg-white border border-[#eceef5] text-[13px] text-g-blue-700 font-semibold">
                    {mp.typing}
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>

            {selectedWord && !isXl ? (
              <div className="absolute inset-0 z-40 flex justify-end bg-[rgba(11,12,38,0.45)]">
                <button type="button" className="flex-1 h-full cursor-default" aria-label={copy.commonExt.close} onClick={closeLookup} />
                <div className="h-full w-[92%] max-w-[400px] bg-white shadow-2xl">
                  {wordPanel}
                </div>
              </div>
            ) : null}

            {detail.peer?.deleted || peerGone ? (
              <footer className="bg-white border-t border-[#eceef5] p-4 shrink-0" data-testid="composer-deleted">
                <p className="text-center text-sm text-[#6a7282]">{deletedAccountLine(uiLocale)}</p>
              </footer>
            ) : recipientBlocked ? (
              <footer className="bg-[#fffbeb] border-t border-[#fde68a] px-4 sm:px-5 py-4 shrink-0 flex items-start gap-2.5 text-sm font-medium text-[#92400e]" role="status">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{mp.recipientNotEligible}</span>
              </footer>
            ) : (
            <footer className="bg-white border-t border-[#eceef5] px-3 sm:px-5 py-3 shrink-0">
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
              {error && <p className="mb-2 text-xs font-medium text-red-600" role="alert">{error}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 h-11 sm:h-12 pl-4 pr-1.5 rounded-full border border-[#e3e5ee] bg-[#f9faff] focus-within:bg-white focus-within:border-g-blue-600 focus-within:ring-4 focus-within:ring-g-blue-50">
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
                    aria-label={editing ? mp.editingMessage : msg.typeMessage}
                    placeholder={editing ? mp.editingMessage : msg.typeMessage}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#101828] placeholder:text-[#9aa0ae]"
                  />
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border border-[#e3e5ee] bg-white text-[#4a5565]"
                    title={`${chatLangName(nativeLang, uiLang)} → ${chatLangName(toLang, uiLang)}`}
                  >
                    {nativeLang.slice(0, 2).toUpperCase()}<ArrowRight className="w-3 h-3 text-[#9aa0ae]" aria-hidden />{toLang.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void send()}
                  className="size-11 sm:size-12 rounded-full bg-g-blue-700 text-g-on-cta flex items-center justify-center disabled:opacity-40 hover:bg-g-blue-800 transition-colors shrink-0 shadow-[0_6px_16px_rgba(33,7,170,0.25)] disabled:shadow-none"
                  aria-label={editing ? copy.common.saveChanges : msg.send}
                >
                  <Send className="w-[18px] h-[18px]" />
                </button>
              </div>
            </footer>
            )}
          </>
        )}
      </section>

      {selectedWord && isXl ? (
        <aside className="w-[min(380px,32vw)] shrink-0 border-l border-[#eceef5] bg-white min-h-0 hidden xl:flex flex-col">
          {wordPanel}
        </aside>
      ) : null}

      {pendingDelete && (
        <div className="fixed inset-0 z-[90] bg-[rgba(11,12,38,0.5)] backdrop-blur-[3px] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="chat-del-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setPendingDelete(null); }}>
          <div className="bg-white rounded-[20px] w-full max-w-[420px] p-6 shadow-[0_30px_80px_rgba(11,12,38,0.35)]">
            <div className="size-11 rounded-[12px] bg-red-50 text-red-600 grid place-items-center mb-4"><Trash2 className="w-5 h-5" /></div>
            <h3 id="chat-del-title" className="text-lg font-bold text-[#101828]">{ux.deleteTitle}</h3>
            <p className="text-sm text-[#4a5565] mt-1.5 leading-relaxed">{mp.deleteForEveryone}</p>
            <div className="grid min-[400px]:grid-cols-2 gap-2 mt-5">
              <button type="button" autoFocus onClick={() => setPendingDelete(null)} className="min-h-[46px] px-3 rounded-xl border border-[#e1e3ec] text-sm font-semibold text-[#101828] hover:bg-gray-50">{ux.keep}</button>
              <button type="button" onClick={() => void deleteMessage(pendingDelete)} className="min-h-[46px] px-3 rounded-xl bg-red-600 text-white text-sm font-bold">{mp.delete}</button>
            </div>
          </div>
        </div>
      )}

      <PeerProfileModal
        peerId={profilePeerId}
        onClose={() => setProfilePeerId(null)}
        onMessage={(peer) => void messageFromProfile(peer)}
      />
    </div>
  );
}
