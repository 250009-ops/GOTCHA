import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CheckCheck,
  ChevronRight,
  Flame,
  Target,
  MessageSquare,
  Megaphone,
  Brain,
} from 'lucide-react';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { localizeNotificationItem } from '@gotcha/shared';

type LearnerNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  refId?: string | null;
  unread: boolean;
  createdAt: string;
};

type Inbox = {
  items: LearnerNotification[];
  unreadCount: number;
};

const filters = ['all', 'unread', 'library', 'reminders', 'messages', 'system'] as const;
type Filter = (typeof filters)[number];
const REMINDER_KINDS = new Set(['streak', 'goal', 'vocab']);
const PAGE = 30;

/** Badge counts in the shell (sidebar / header) refresh right away when this fires. */
export const NOTIFICATIONS_CHANGED = 'gotcha:notifications-changed';

const NX = {
  en: { reminders: 'Reminders', messages: 'Messages', thisWeek: 'This week', earlier: 'Earlier', more: 'Show more', allRead: 'All caught up' },
  ru: { reminders: 'Напоминания', messages: 'Сообщения', thisWeek: 'На этой неделе', earlier: 'Ранее', more: 'Показать ещё', allRead: 'Всё прочитано' },
  uz: { reminders: 'Eslatmalar', messages: 'Xabarlar', thisWeek: 'Shu hafta', earlier: 'Avvalroq', more: 'Yana koʻrsatish', allRead: 'Hammasi oʻqilgan' },
};

function matches(filter: Filter, item: { kind: string; unread: boolean }) {
  if (filter === 'unread') return item.unread;
  if (filter === 'library') return item.kind === 'content';
  if (filter === 'reminders') return REMINDER_KINDS.has(item.kind);
  if (filter === 'messages') return item.kind === 'message';
  if (filter === 'system') return item.kind === 'system';
  return true;
}

function dayBucket(iso: string): 0 | 1 | 2 | 3 {
  const t = new Date(iso).getTime();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (t >= start.getTime()) return 0;
  if (t >= start.getTime() - 86_400_000) return 1;
  if (t >= start.getTime() - 6 * 86_400_000) return 2;
  return 3;
}

function relativeTime(
  iso: string | undefined,
  np: ReturnType<typeof useLearnerCopy>['notificationsPage'],
  ce: ReturnType<typeof useLearnerCopy>['commonExt'],
) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return np.justNow;
  if (mins < 60) return np.minutesAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return np.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return ce.yesterday;
  return np.daysAgo(days);
}

function visual(kind: string) {
  switch (kind) {
    case 'content':
      return { icon: BookOpen, bg: 'bg-g-blue-50', fg: 'text-g-blue-700' };
    case 'message':
      return { icon: MessageSquare, bg: 'bg-g-info-surface', fg: 'text-g-info-text' };
    case 'streak':
      return { icon: Flame, bg: 'bg-[#fff7ed]', fg: 'text-[#c2410c]' };
    case 'goal':
      return { icon: Target, bg: 'bg-[#ecfdf5]', fg: 'text-[#047857]' };
    case 'vocab':
      return { icon: Brain, bg: 'bg-[#eef2ff]', fg: 'text-[#3730a3]' };
    default:
      return { icon: Megaphone, bg: 'bg-[#f3f4f6]', fg: 'text-[#4b5563]' };
  }
}

export function notificationHref(href?: string | null) {
  const raw = (href ?? '').trim();
  if (!raw) return '/app';
  if (raw.startsWith('/app')) return raw;
  const stripped = raw.replace(/^\//, '');
  const qIndex = stripped.indexOf('?');
  const path = qIndex >= 0 ? stripped.slice(0, qIndex) : stripped;
  const query = qIndex >= 0 ? stripped.slice(qIndex + 1) : '';
  const params = new URLSearchParams(query);
  const itemId = params.get('item') || params.get('id');
  if (path === 'streak' || path === 'daily_goal') return '/app/stats';
  if (path === 'vocab_review' || path === 'words') return '/app/vocabulary';
  if (path === 'library' || path === 'home') {
    return itemId ? `/app?item=${encodeURIComponent(itemId)}` : '/app';
  }
  if (path.startsWith('chat/')) {
    const id = path.slice('chat/'.length).split('/')[0];
    return id ? `/app/messages?c=${encodeURIComponent(id)}` : '/app/messages';
  }
  if (path === 'messages') return '/app/messages';
  if (path.startsWith('content/')) {
    const id = path.slice('content/'.length).split('/')[0];
    return id ? `/app?item=${encodeURIComponent(id)}` : '/app';
  }
  return '/app';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const np = copy.notificationsPage;
  const [inbox, setInbox] = useState<Inbox>({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const nx = NX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const notifyShell = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  const load = () =>
    api<Inbox>('/notifications')
      .then(setInbox)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => inbox.items.filter((i) => matches(filter, i)), [filter, inbox.items]);
  useEffect(() => setLimit(PAGE), [filter]);

  /** Same reminder repeated on the same day → one row with a ×N count (opens the newest, marks all read). */
  const rows = useMemo(() => {
    const out: Array<{ item: LearnerNotification; ids: string[]; unread: boolean; bucket: 0 | 1 | 2 | 3 }> = [];
    const seen = new Map<string, number>();
    for (const item of filtered) {
      const bucket = dayBucket(item.createdAt);
      const key = `${bucket}|${item.kind}|${item.title}|${item.body}`;
      const at = seen.get(key);
      if (at != null) {
        out[at].ids.push(item.id);
        out[at].unread = out[at].unread || item.unread;
      } else {
        seen.set(key, out.length);
        out.push({ item, ids: [item.id], unread: item.unread, bucket });
      }
    }
    return out;
  }, [filtered]);
  const visible = rows.slice(0, limit);
  const bucketLabel = [copy.commonExt.today, copy.commonExt.yesterday, nx.thisWeek, nx.earlier];
  const groups = ([0, 1, 2, 3] as const)
    .map((b) => ({ b, rows: visible.filter((r) => r.bucket === b) }))
    .filter((g) => g.rows.length > 0);

  const markAll = async () => {
    if (inbox.unreadCount === 0) return;
    setInbox((prev) => ({
      items: prev.items.map((i) => ({ ...i, unread: false })),
      unreadCount: 0,
    }));
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    notifyShell();
    void load();
  };

  const openItem = async (item: LearnerNotification, ids: string[] = [item.id]) => {
    const unreadIds = ids.filter((id) => inbox.items.find((row) => row.id === id)?.unread);
    if (unreadIds.length) {
      setInbox((prev) => ({
        items: prev.items.map((row) => (unreadIds.includes(row.id) ? { ...row, unread: false } : row)),
        unreadCount: Math.max(0, prev.unreadCount - unreadIds.length),
      }));
      await Promise.all(unreadIds.map((id) => api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined)));
      notifyShell();
    }
    navigate(notificationHref(item.href));
  };

  const counts: Record<Filter, number> = {
    all: inbox.items.length,
    unread: inbox.unreadCount,
    library: inbox.items.filter((i) => matches('library', i)).length,
    reminders: inbox.items.filter((i) => matches('reminders', i)).length,
    messages: inbox.items.filter((i) => matches('messages', i)).length,
    system: inbox.items.filter((i) => matches('system', i)).length,
  };
  const label = (key: Filter) =>
    key === 'all' ? np.filterAll(counts.all).replace(/\s*\(\d+\)$/, '')
      : key === 'unread' ? np.filterUnread(counts.unread).replace(/\s*\(\d+\)$/, '')
        : key === 'library' ? np.filterLibrary(counts.library).replace(/\s*\(\d+\)$/, '')
          : key === 'system' ? np.filterSystem(counts.system).replace(/\s*\(\d+\)$/, '')
            : key === 'reminders' ? nx.reminders : nx.messages;
  // Optional filters only appear when they have something in them (no dead "System (0)").
  const shownFilters = filters.filter((key) => key === 'all' || key === 'unread' || key === 'library' || counts[key] > 0 || filter === key);

  return (
    <div className="max-w-[860px] mx-auto px-3 sm:px-6 py-5 lg:py-8">
      <div className="flex items-start sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">{copy.notifications.title}</h1>
          <p className="text-sm text-[#6b7080] mt-0.5">{copy.notifications.subtitle}</p>
        </div>
        {inbox.unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void markAll()}
            aria-label={copy.notifications.markAllRead}
            className="shrink-0 inline-flex items-center gap-2 min-h-10 px-3 sm:px-3.5 rounded-[11px] border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50"
          >
            <CheckCheck className="w-4 h-4 text-g-blue-700" />
            <span className="hidden sm:inline">{copy.notifications.markAllRead}</span>
          </button>
        ) : !loading && inbox.items.length > 0 ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full bg-[#ecfdf5] text-[#047857] text-[13px] font-semibold">
            <CheckCheck className="w-4 h-4" />{nx.allRead}
          </span>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide" role="tablist" aria-label={copy.notifications.title}>
        {shownFilters.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 min-h-9 pl-3.5 pr-2 rounded-full text-[13px] font-semibold border transition-colors',
              filter === key
                ? 'bg-g-blue-700 text-g-on-cta border-g-blue-700'
                : 'bg-white text-[#4a5565] border-[#e3e5ee] hover:border-gray-300',
            )}
          >
            {label(key)}
            <span className={cn(
              'min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center tabular-nums',
              filter === key ? 'bg-white/20 text-white' : key === 'unread' && counts.unread > 0 ? 'bg-g-blue-700 text-white' : 'bg-[#f1f2f6] text-[#6b7080]',
            )}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#e9ebf3] rounded-2xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[62px] border-b last:border-b-0 border-[#f2f3f7] animate-pulse bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#e9ebf3] rounded-2xl px-6 py-14 text-center">
          <span className="size-12 rounded-full bg-g-blue-50 grid place-items-center mx-auto mb-3"><Bell className="w-5 h-5 text-g-blue-700" /></span>
          <div className="font-semibold text-[#101828]">
            {filter === 'unread'
              ? np.emptyUnread
              : filter === 'library'
                ? np.emptyLibrary
                : copy.notifications.emptyDescription}
          </div>
          <p className="text-sm text-[#6b7080] mt-1">{np.catalogHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.b} aria-label={bucketLabel[g.b]}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8fa0] mb-2 px-1">{bucketLabel[g.b]}</h2>
              <ul className="bg-white border border-[#e9ebf3] rounded-2xl overflow-hidden">
                {g.rows.map(({ item, ids, unread }) => {
                  const v = visual(item.kind);
                  const Icon = v.icon;
                  const localized = localizeNotificationItem(locale, item);
                  return (
                    <li key={item.id} className="border-b last:border-b-0 border-[#f2f3f7]">
                      <button
                        type="button"
                        onClick={() => void openItem(item, ids)}
                        className={cn(
                          'group w-full text-left flex items-center gap-3 pl-2.5 pr-3 sm:pr-4 py-3 min-h-[62px] transition-colors',
                          unread ? 'bg-[#fbfaff] hover:bg-[#f5f3ff]' : 'hover:bg-[#fafbfd]',
                        )}
                      >
                        <span className={cn('size-[7px] rounded-full shrink-0', unread ? 'bg-g-blue-700' : 'bg-transparent')} aria-hidden />
                        <span className={cn('size-[34px] rounded-[10px] grid place-items-center shrink-0', v.bg)}>
                          <Icon className={cn('size-4', v.fg)} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={cn('text-sm truncate text-[#101828]', unread ? 'font-bold' : 'font-semibold')}>{localized.title}</span>
                            {ids.length > 1 && (
                              <span className="shrink-0 text-[10.5px] font-bold text-[#6b7080] bg-[#f1f2f6] rounded-md px-1.5 py-px">×{ids.length}</span>
                            )}
                          </span>
                          <span className="block text-[13px] text-[#6b7080] truncate mt-0.5">{localized.body}</span>
                        </span>
                        <span className="text-xs text-[#9aa0ae] shrink-0 tabular-nums">{relativeTime(item.createdAt, np, copy.commonExt)}</span>
                        <ChevronRight className="hidden sm:block w-4 h-4 text-[#c3c7d4] group-hover:text-g-blue-700 shrink-0" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {rows.length > limit && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="min-h-10 px-4 rounded-[11px] border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50"
              >
                {nx.more} · {rows.length - limit}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
