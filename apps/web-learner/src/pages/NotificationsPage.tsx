import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
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

const filters = ['all', 'unread', 'library', 'system'] as const;
type Filter = (typeof filters)[number];

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
      return { icon: BookOpen, bg: 'bg-[#f3e8ff]', fg: 'text-[#7008e7]' };
    case 'message':
      return { icon: MessageSquare, bg: 'bg-[#e0f2fe]', fg: 'text-[#0369a1]' };
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

  const load = () =>
    api<Inbox>('/notifications')
      .then(setInbox)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'unread') return inbox.items.filter((i) => i.unread);
    if (filter === 'library') return inbox.items.filter((i) => i.kind === 'content');
    if (filter === 'system') return inbox.items.filter((i) => i.kind === 'system');
    return inbox.items;
  }, [filter, inbox.items]);

  const markAll = async () => {
    if (inbox.unreadCount === 0) return;
    setInbox((prev) => ({
      items: prev.items.map((i) => ({ ...i, unread: false })),
      unreadCount: 0,
    }));
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    void load();
  };

  const openItem = async (item: LearnerNotification) => {
    if (item.unread) {
      setInbox((prev) => ({
        items: prev.items.map((row) => (row.id === item.id ? { ...row, unread: false } : row)),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      await api(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => undefined);
    }
    navigate(notificationHref(item.href));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{copy.notifications.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{copy.notifications.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={inbox.unreadCount === 0}
          onClick={() => void markAll()}
          className="text-sm font-semibold text-[#7f22fe] disabled:text-gray-400"
        >
          {inbox.unreadCount > 0 ? copy.notifications.markAllRead : copy.notifications.emptyDescription}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((key) => {
          const count =
            key === 'all'
              ? inbox.items.length
              : key === 'unread'
                ? inbox.unreadCount
                : key === 'library'
                  ? inbox.items.filter((i) => i.kind === 'content').length
                  : inbox.items.filter((i) => i.kind === 'system').length;
          const label =
            key === 'all'
              ? np.filterAll(count)
              : key === 'unread'
                ? np.filterUnread(count)
                : key === 'library'
                  ? np.filterLibrary(count)
                  : np.filterSystem(count);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all capitalize',
                filter === key
                  ? 'bg-[#7f22fe] text-white border-[#7f22fe] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-6 py-16 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">
            {filter === 'unread'
              ? np.emptyUnread
              : filter === 'library'
                ? np.emptyLibrary
                : copy.notifications.emptyDescription}
          </div>
          <p className="text-sm text-gray-500 mt-1">{np.catalogHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const v = visual(item.kind);
            const Icon = v.icon;
            const localized = localizeNotificationItem(locale, item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void openItem(item)}
                className={cn(
                  'w-full text-left bg-white rounded-2xl p-4 flex gap-3 transition-all',
                  item.unread
                    ? 'border-[1.5px] border-[#7f22fe] shadow-sm shadow-violet-100'
                    : 'border border-gray-100 hover:border-violet-200',
                )}
              >
                <div className={cn('size-10 rounded-xl grid place-items-center shrink-0', v.bg)}>
                  <Icon className={cn('size-5', v.fg)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('text-sm truncate', item.unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800')}>
                      {localized.title}
                    </div>
                    <div className="text-[11px] text-gray-400 shrink-0">{relativeTime(item.createdAt, np, copy.commonExt)}</div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{localized.body}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
