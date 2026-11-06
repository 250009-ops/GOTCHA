import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Flame, GraduationCap, Languages, Upload, UserRound } from 'lucide-react';
import { api, getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { LimitDialog } from '../components/LimitDialog';
import { AgePrompt } from '../components/safety/AgePrompt';
import { cn } from '../components/ui/utils';
import { getWebApp, haptic, setupWebApp, waitForWebApp } from '../lib/telegram';
import { tgCopyFor } from './tgCopy';

/** Tab roots: no Telegram back button here, the floating tab bar is shown instead. */
export const TG_TAB_ROOTS = ['/app', '/app/browse', '/app/vocabulary', '/app/practice', '/app/import', '/app/profile'];
/** Sub-pages that need the whole screen (chat composer, card payment): no tab bar. */
const NO_TABBAR = ['/app/messages', '/app/plus', '/app/import/payment-return'];

const norm = (p: string) => p.replace(/\/+$/, '') || '/';

/**
 * Telegram Mini App shell for `/app/*` (replaces the website sidebar when opened from Telegram):
 * Telegram draws the header; we add a slim greeting bar on tab roots and the floating rounded tab bar.
 */
export default function TelegramShell() {
  const location = useLocation();
  const { user, stats } = useAuth();
  const { locale } = useLearnerLocale();
  const t = tgCopyFor(locale);
  const path = norm(location.pathname);
  const [unread, setUnread] = useState(0);
  const [due, setDue] = useState(0);

  const isRoot = TG_TAB_ROOTS.includes(path);
  const showTabs = !NO_TABBAR.some((p) => path.startsWith(p));

  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const beat = () => {
      if (getAccessToken()) void api('/messaging/presence', { method: 'POST' }).catch(() => undefined);
    };
    beat();
    const id = window.setInterval(beat, 25_000);
    return () => window.clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const load = () => {
      if (!getAccessToken()) return;
      void api<{ unreadCount: number }>('/notifications/unread-count').then((r) => setUnread(r.unreadCount ?? 0)).catch(() => undefined);
      void api<{ dueCount?: number }>('/practice/overview').then((r) => setDue(r.dueCount ?? 0)).catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 60_000);
    window.addEventListener('gotcha:notifications-changed', load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('gotcha:notifications-changed', load);
    };
  }, [user, path]);

  const tabs = [
    { to: '/app', label: t.tabLibrary, Icon: BookOpen, active: path === '/app' || path === '/app/browse' },
    { to: '/app/vocabulary', label: t.tabVocab, Icon: Languages, active: path.startsWith('/app/vocabulary') },
    { to: '/app/practice', label: t.tabPractice, Icon: GraduationCap, active: path.startsWith('/app/practice'), badge: due },
    { to: '/app/import', label: t.tabImport, Icon: Upload, active: path === '/app/import' },
    { to: '/app/profile', label: t.tabProfile, Icon: UserRound, active: path.startsWith('/app/profile') },
  ];

  const firstName = (user?.displayName ?? '').trim().split(/\s+/)[0] || '';

  return (
    <div className="h-[100dvh] flex flex-col bg-[#f6f7fb] font-sans text-[#101828]">
      {isRoot && (
        <div className="shrink-0 flex items-center gap-2.5 px-4 pt-3 pb-1">
          <div className="flex-1 min-w-0 flex items-center gap-2" aria-label={firstName || 'Gotcha'}>
            <span className="size-8 rounded-[10px] bg-g-blue-700 text-white grid place-items-center text-base font-extrabold">G</span>
            <span className="text-[15px] font-extrabold tracking-[0.04em]">GOTCHA</span>
          </div>
          <Link
            to="/app/stats"
            aria-label={`${stats?.streakCount ?? 0}`}
            className="h-9 px-3 rounded-full bg-[#fff7e6] border border-[#fde3a7] text-[#b45309] inline-flex items-center gap-1 text-sm font-bold"
          >
            <Flame className="w-4 h-4" />
            {stats?.streakCount ?? 0}
          </Link>
          <Link
            to="/app/notifications"
            aria-label={t.notifications}
            className="relative size-10 rounded-full bg-white border border-[#e6e8f0] grid place-items-center text-[#4a5565]"
          >
            <Bell className="w-[19px] h-[19px]" />
            {unread > 0 && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-[#ef4444] ring-2 ring-white" />}
          </Link>
        </div>
      )}

      <main
        className={cn(
          'flex-1 min-h-0 min-w-0 relative overflow-x-hidden',
          path.startsWith('/app/messages') ? 'overflow-hidden' : 'overflow-y-auto',
        )}
        style={showTabs ? { paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        <AgePrompt />
        <Outlet />
        <LimitDialog lang={locale} />
      </main>

      {showTabs && (
        <nav
          aria-label={t.navLabel}
          className="fixed z-50 left-3 right-3 h-[68px] p-1.5 grid grid-cols-5 gap-0.5 rounded-[34px] bg-white border border-[#e4e7ef] shadow-[0_14px_34px_-12px_rgba(16,24,40,0.32)]"
          style={{ bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
        >
          {tabs.map(({ to, label, Icon, active, badge }) => (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              onClick={() => haptic('select')}
              className={cn(
                'relative flex flex-col items-center justify-center gap-[3px] rounded-[28px] text-[11px] min-w-0 transition-colors',
                active ? 'bg-[#ecebff] text-g-blue-700 font-bold' : 'text-[#5d6475] font-semibold',
              )}
            >
              <Icon className="w-[23px] h-[23px]" strokeWidth={1.9} />
              <span className="truncate max-w-full px-1">{label}</span>
              {!!badge && badge > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ea580c] text-white text-[10.5px] font-extrabold grid place-items-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Telegram's native back button for every non-root screen (reader included). Rendered once in App. */
export function TelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const depth = useRef(0);
  const path = norm(location.pathname);

  useEffect(() => {
    depth.current += 1;
  }, [location.key]);

  // Reload inside Telegram lands straight on /app/*: still apply theme + chrome once.
  useEffect(() => {
    void waitForWebApp().then((w) => {
      if (w?.initData) setupWebApp(w);
    });
  }, []);

  useEffect(() => {
    const back = getWebApp()?.BackButton;
    if (!back) return;
    const isRoot = TG_TAB_ROOTS.includes(path) || path.startsWith('/tg');
    const onBack = () => {
      haptic('light');
      // Deep links open straight on a sub-page; there is nothing to go back to, so go home.
      if (depth.current <= 1) navigate('/app', { replace: true });
      else navigate(-1);
    };
    if (isRoot) {
      back.hide();
      return;
    }
    back.show();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [path, navigate]);

  return null;
}
