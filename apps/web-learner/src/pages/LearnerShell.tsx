import { Onboarding } from '../components/onboarding/Onboarding';
import { AgePrompt } from '../components/safety/AgePrompt';
import type { OnboardingStep } from '../lib/onboarding';
import { LimitDialog } from '../components/LimitDialog';
import { SidebarPlusCard } from '../components/SidebarPlusCard';
import { usePaymentsEnabled } from '../lib/limits';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Brain,
  ChevronLeft,
  ChevronRight,
  Flame,
  GraduationCap,
  Home,
  HelpCircle,
  LogOut,
  Menu,
  Receipt,
  UserRound,
  Zap,
  MessageSquare,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { api, getAccessToken } from '../lib/api';
import { GlobalSearch } from '../components/GlobalSearch';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';
import { useAuth } from '../lib/auth';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { UserAvatar } from '../components/UserAvatar';
import { LanguagePicker } from '../components/LanguagePicker';
import { GotchaLogo } from '../components/GotchaLogo';

interface NavItem {
  path: string;
  labelKey: keyof ReturnType<typeof useLearnerCopy>['nav'];
  icon: React.ElementType;
  exact?: boolean;
}

const primaryNav: NavItem[] = [
  { path: '/app', labelKey: 'library', icon: Home, exact: true },
  { path: '/app/vocabulary', labelKey: 'vocabulary', icon: Brain },
  { path: '/app/practice', labelKey: 'practice', icon: GraduationCap },
  { path: '/app/import', labelKey: 'import', icon: Upload },
];

const secondaryNav: NavItem[] = [
  { path: '/app/stats', labelKey: 'statistics', icon: BarChart3 },
  { path: '/app/notifications', labelKey: 'notifications', icon: Bell },
  { path: '/app/messages', labelKey: 'messages', icon: MessageSquare },
];

function prefersExpandedSidebar() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

/** Header library search — never on Messages, Vocabulary, Browse, or other app pages. */
function learnerAppPath(pathname: string) {
  const raw = pathname.replace(/\/$/, '') || '/';
  return raw.startsWith('/learn/') ? raw.slice('/learn'.length) || '/' : raw;
}

function shouldShowGlobalSearch(pathname: string) {
  return learnerAppPath(pathname) === '/app';
}

export default function LearnerShell() {
  const payments = usePaymentsEnabled();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, stats, logout } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  useCatalogLanguages();
  const [expanded, setExpanded] = useState(prefersExpandedSidebar);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Responsive web (no app-style bottom tab bar): below md the sidebar opens as a slide-in drawer from the ☰ button.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | 'done'>('done');

  const isActive = (path: string, exact = false) => {
    if (exact || path === '/app') {
      const p = location.pathname.replace(/\/$/, '') || '/';
      return p === '/app' || p === '/app/browse';
    }
    return location.pathname.startsWith(path);
  };

  const showGlobalSearch = shouldShowGlobalSearch(location.pathname);

  useEffect(() => {
    document.body.classList.add('gotcha-has-topbar');
    return () => document.body.classList.remove('gotcha-has-topbar');
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (!mq.matches) setExpanded(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const beat = () => {
      if (!getAccessToken()) return;
      void api('/messaging/presence', { method: 'POST' }).catch(() => undefined);
    };
    beat();
    const id = window.setInterval(beat, 25_000);
    return () => window.clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const load = () => {
      if (!getAccessToken()) return;
      void api<{ unreadCount: number }>('/notifications/unread-count')
        .then((res) => setUnreadNotifs(res.unreadCount ?? 0))
        .catch(() => undefined);
      void api<{ unreadCount: number }>('/messaging/unread-count')
        .then((res) => setUnreadMessages(res.unreadCount ?? 0))
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 30_000);
    // Notifications page fires this after "mark read" so the 9+ badges clear immediately.
    window.addEventListener('gotcha:notifications-changed', load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('gotcha:notifications-changed', load);
    };
  }, [user, location.pathname]);

  const highlightPractice = onboardingStep === 'practice';

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    const onMq = () => { if (mq.matches) setDrawerOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (highlightPractice && window.matchMedia('(min-width: 640px)').matches) setExpanded(true);
  }, [highlightPractice]);

  const NavLink = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
    const label = copy.nav[item.labelKey];
    const active = isActive(item.path, item.exact);
    const practiceMark = highlightPractice && item.path === '/app/practice';
    const btn = (
      <button
        type="button"
        data-onboarding={practiceMark ? 'practice' : undefined}
        onClick={() => navigate(item.path)}
        // W-20: icon-only rail items had no accessible name (1 of 7 labelled).
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full flex items-center gap-3 rounded-[14px] text-sm font-medium transition-all duration-150 group relative',
          collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5',
          practiceMark && 'z-50 ring-2 ring-white',
          active
            ? 'bg-g-blue-700 text-g-on-cta shadow-[0_4px_3px_rgba(33,7,170,0.4),0_2px_2px_rgba(33,7,170,0.4)]'
            : 'text-white/50 hover:text-white/90 hover:bg-white/[0.07]',
        )}
      >
        <item.icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')} />
        {!collapsed && <span className="truncate">{label}</span>}
        {(item.path === '/app/notifications' && unreadNotifs > 0) || (item.path === '/app/messages' && unreadMessages > 0) ? (
          <span className={cn(
            'min-w-5 h-5 px-1 rounded-full bg-[#ff3b30] text-[10px] font-bold text-white grid place-items-center',
            collapsed ? 'absolute top-0.5 right-0.5' : 'ml-auto',
          )}>
            {(item.path === '/app/messages' ? unreadMessages : unreadNotifs) > 9 ? '9+' : (item.path === '/app/messages' ? unreadMessages : unreadNotifs)}
          </span>
        ) : null}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="bg-gray-900 text-white border-white/10 text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  const mx = {
    en: { account: 'Profile & account', plan: 'Plan & usage', payments: 'Payments', help: 'Help & support' },
    ru: { account: 'Профиль и аккаунт', plan: 'Тариф и лимиты', payments: 'Платежи', help: 'Помощь' },
    uz: { account: 'Profil va hisob', plan: 'Tarif va foydalanish', payments: 'Toʻlovlar', help: 'Yordam' },
  }[locale === 'ru' || locale === 'uz' ? locale : 'en'];

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Fixed-height shell: sidebar + topbar stay pinned; only main scrolls */}
      <div className="flex h-screen max-h-dvh bg-g-blue-50 overflow-hidden">
        {/* Sidebar — always present for web; icon rail on narrow widths */}
        <div
          className={cn(
            'hidden md:block shrink-0 relative h-full transition-[width] duration-200',
            highlightPractice ? 'z-50' : 'z-20',
            expanded ? 'w-60' : 'w-14',
          )}
        >
          <aside className="h-full w-full bg-g-sidebar flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]">
            <div className={cn('flex items-center border-b border-white/[0.06] shrink-0', expanded ? 'px-4 py-[14px] gap-3' : 'px-2 py-[14px] justify-center')}>
              <GotchaLogo
                markOnly={!expanded}
                tone="light"
                subtitle={copy.shell.tagline}
                subtitleClassName="text-white/30 text-[10px] leading-none mt-0.5"
              />
            </div>

            <nav aria-label={copy.nav.mainLabel} className="flex-1 py-3 px-2 space-y-1 overflow-y-auto min-h-0">
              {primaryNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={!expanded} />
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              {secondaryNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={!expanded} />
              ))}
            </nav>

            <div className="px-2 pb-3 pt-2 border-t border-white/[0.06] space-y-1 shrink-0">
              {/* Sidebar Plus entry: a working link to /app/plus (free: offer · Plus: days left + Extend). Only when payments are on. */}
              {!payments ? null : expanded ? (
                <SidebarPlusCard collapsed={false} locale={locale} />
              ) : (
                <SidebarPlusCard collapsed locale={locale} />
              )}

              <NavLink
                item={{ path: '/app/settings', labelKey: 'settings', icon: Settings }}
                collapsed={!expanded}
              />
            </div>
          </aside>

          <button
            type="button"
            aria-label={expanded ? copy.shell.collapseSidebar : copy.shell.expandSidebar}
            className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-500 hover:text-g-blue-700 shadow-sm z-30 hidden lg:flex"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={copy.nav.mainLabel}>
            <button
              type="button"
              aria-label={copy.settings.close}
              className="absolute inset-0 bg-[rgba(11,12,38,0.5)] backdrop-blur-[2px]"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-g-sidebar flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]">
              <div className="flex items-center justify-between gap-3 px-4 py-[14px] border-b border-white/[0.06] shrink-0">
                <GotchaLogo
                  tone="light"
                  subtitle={copy.shell.tagline}
                  subtitleClassName="text-white/30 text-[10px] leading-none mt-0.5"
                />
                <button
                  type="button"
                  aria-label={copy.settings.close}
                  onClick={() => setDrawerOpen(false)}
                  className="size-10 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/[0.07]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto min-h-0">
                {primaryNav.map((item) => (
                  <NavLink key={item.path} item={item} collapsed={false} />
                ))}
                <div className="h-px bg-white/[0.06] my-2" />
                {secondaryNav.map((item) => (
                  <NavLink key={item.path} item={item} collapsed={false} />
                ))}
              </div>
              <div className="px-2 pb-3 pt-2 border-t border-white/[0.06] space-y-1 shrink-0">
                {payments && <SidebarPlusCard collapsed={false} locale={locale} />}

                <NavLink item={{ path: '/app/settings', labelKey: 'settings', icon: Settings }} collapsed={false} />
              </div>
            </aside>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full">
          {/* W-20: below 640 px the search used to collapse to a 50-64 px pill; it now gets its own row. */}
          <header className="min-h-14 py-2 sm:py-0 sm:h-14 bg-white/95 backdrop-blur border-b border-gray-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-4 lg:px-6 z-30 shrink-0 overflow-visible">
            <div className="md:hidden flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                aria-label={copy.nav.mainLabel}
                aria-expanded={drawerOpen}
                data-testid="nav-drawer-open"
                onClick={() => setDrawerOpen(true)}
                className="relative size-9 rounded-[10px] border border-gray-200 bg-white grid place-items-center text-gray-700 hover:text-g-blue-700"
              >
                <Menu className="w-[18px] h-[18px]" />
                {unreadMessages > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#ff3b30] ring-2 ring-white" />}
              </button>
              <GotchaLogo markOnly tone="ink" size={30} />
            </div>
            {showGlobalSearch ? (
              <div className="order-last basis-full sm:order-none sm:basis-auto w-full sm:max-w-[400px] min-w-0" data-global-search="library-only">
                <GlobalSearch />
              </div>
            ) : (
              <div className="min-w-0 hidden md:block" data-global-search="hidden" />
            )}

            <div className="flex items-center h-9 gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
              <LanguagePicker className="hidden sm:inline-flex shrink-0" />
              <LanguagePicker compact className="inline-flex sm:hidden shrink-0" />

              <div className="h-9 flex items-center gap-1.5 bg-[#fffbeb] border border-[#fee685] rounded-full px-2.5">
                <Flame className="w-3.5 h-3.5 text-[#fe9a00]" />
                <span className="text-xs font-bold text-[#bb4d00] tabular-nums leading-none">{stats?.streakCount ?? user?.streakCount ?? 0}</span>
              </div>

              <button
                type="button"
                aria-label={copy.nav.messages}
                onClick={() => navigate('/app/messages')}
                className="hidden min-[420px]:grid md:hidden relative size-9 rounded-full border border-gray-200 bg-white place-items-center text-gray-600 hover:text-g-blue-700"
              >
                <MessageSquare className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#ff3b30] text-[10px] font-bold text-white grid place-items-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label={copy.shell.notificationsAria}
                onClick={() => navigate('/app/notifications')}
                className="relative size-9 rounded-full border border-gray-200 bg-white grid place-items-center text-gray-600 hover:text-g-blue-700 hover:border-violet-200"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#ff3b30] text-[10px] font-bold text-white grid place-items-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={copy.shell.accountMenuAria}
                    className="size-9 rounded-full grid place-items-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.1)]"
                  >
                    <UserAvatar
                      name={user?.displayName ?? user?.email}
                      url={user?.avatarUrl}
                      size={32}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-[264px] p-0 z-[100] overflow-hidden rounded-2xl border border-[#e9ebf3] shadow-[0_18px_40px_rgba(16,24,40,.14)]">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <UserAvatar
                      name={user?.displayName ?? user?.email}
                      url={user?.avatarUrl}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#101828] truncate">{user?.displayName || user?.email}</div>
                      <div className="text-xs text-[#6b7080] truncate">{user?.email}</div>
                    </div>
                  </div>
                  <div className="px-1.5 pb-1.5" role="menu" aria-label={copy.shell.accountMenuAria}>
                    {[
                      { icon: UserRound, label: mx.account, to: '/app/settings#account' },
                      { icon: Zap, label: mx.plan, to: '/app/settings#plan' },
                      ...(payments ? [{ icon: Receipt, label: mx.payments, to: '/app/payments' }] : []),
                      { icon: Settings, label: copy.nav.settings, to: '/app/settings' },
                    ].map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        role="menuitem"
                        onClick={() => { setUserMenuOpen(false); navigate(item.to); }}
                        className="w-full flex items-center gap-3 h-10 px-2.5 rounded-xl text-sm font-medium text-[#101828] hover:bg-[#f4f5fa]"
                      >
                        <item.icon className="w-[18px] h-[18px] text-[#6b7080]" />
                        {item.label}
                      </button>
                    ))}
                    <a
                      href="mailto:support@gotchaa.uz"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-3 h-10 px-2.5 rounded-xl text-sm font-medium text-[#101828] hover:bg-[#f4f5fa]"
                    >
                      <HelpCircle className="w-[18px] h-[18px] text-[#6b7080]" />
                      {mx.help}
                    </a>
                    <div className="h-px bg-[#eef0f5] my-1.5 mx-1" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 h-10 px-2.5 rounded-xl text-sm font-semibold text-[#dc2626] hover:bg-[#fff1f1]"
                    >
                      <LogOut className="w-[18px] h-[18px]" />
                      {copy.shell.logOut}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          <main
            className={cn(
              'flex-1 min-h-0 min-w-0 relative z-0 overflow-x-hidden',
              location.pathname.startsWith('/app/messages') ? 'overflow-hidden' : 'overflow-y-auto',
            )}
          >
            <AgePrompt />
            <Outlet />
            <Onboarding onStep={setOnboardingStep} />
            <LimitDialog lang={locale} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
