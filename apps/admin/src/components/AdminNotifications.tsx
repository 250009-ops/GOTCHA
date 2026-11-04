import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn, relativeTime } from '../lib/utils';

export interface FeedItem {
  id: string;
  type: 'campaign' | 'ticket' | 'alert';
  title: string;
  body: string;
  href: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical';
}

interface FeedResponse {
  unreadCount: number;
  items: FeedItem[];
}

const READ_KEY = 'gotcha.admin.notif.read';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export function AdminNotifications() {
  const navigate = useNavigate();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  const updateCoords = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<FeedResponse>('/admin/notifications/feed');
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
    const t = window.setInterval(() => load().catch(() => undefined), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      saveReadIds(next);
      return next;
    });
  }

  function openItem(item: FeedItem) {
    markRead(item.id);
    setOpen(false);
    navigate(item.href);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load().catch(() => undefined);
        }}
        className="relative size-[38px] rounded-lg border border-slate-200 bg-white grid place-items-center text-slate-500 hover:text-g-blue-700 hover:border-g-blue-700/40 transition"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-g-blue-700 text-white text-[10px] font-bold grid place-items-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] w-[360px] max-h-[min(480px,70vh)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.12)] flex flex-col"
            style={{ top: coords.top, right: coords.right }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <div className="text-sm font-semibold text-slate-900">Notifications</div>
                <div className="text-xs text-slate-500">
                  {unreadCount ? `${unreadCount} unread` : 'All caught up'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-semibold text-g-blue-700 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate('/notifications');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  View all
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading && items.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500 justify-center">
                  <Loader2 className="size-4 animate-spin text-g-blue-700" />
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500 text-center">No notifications yet</div>
              ) : (
                <ul>
                  {items.map((item) => {
                    const unread = !readIds.has(item.id);
                    return (
                      <li key={item.id} className="border-b border-slate-50 last:border-0">
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-slate-50 transition',
                            unread && 'bg-violet-50/40',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                'mt-1.5 size-2 rounded-full shrink-0',
                                unread ? 'bg-g-blue-700' : 'bg-transparent',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900 truncate">{item.title}</div>
                                <div className="text-[11px] text-slate-400 shrink-0">
                                  {relativeTime(item.createdAt)}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.body}</div>
                              <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mt-1">
                                {item.type}
                                {item.severity !== 'info' ? ` · ${item.severity}` : ''}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
