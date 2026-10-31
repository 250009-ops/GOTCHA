import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Brain,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Flame,
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  Upload,
} from 'lucide-react';
import { api, getAccessToken } from '../lib/api';
import { GlobalSearch } from '../components/GlobalSearch';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';
import { useAuth } from '../lib/auth';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { UserAvatar } from '../components/UserAvatar';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const primaryNav: NavItem[] = [
  { path: '/app', label: 'Library', icon: Home, exact: true },
  { path: '/app/vocabulary', label: 'Vocabulary', icon: Brain },
  { path: '/app/practice', label: 'Practice', icon: GraduationCap },
  { path: '/app/import', label: 'Import', icon: Upload },
];

const secondaryNav: NavItem[] = [
  { path: '/app/stats', label: 'Statistics', icon: BarChart3 },
  { path: '/app/notifications', label: 'Notifications', icon: Bell },
  { path: '/app/messages', label: 'Messages', icon: MessageSquare },
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user, stats, logout } = useAuth();
  useCatalogLanguages();
  const [expanded, setExpanded] = useState(prefersExpandedSidebar);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const isActive = (path: string, exact = false) => {
    if (exact || path === '/app') {
      const p = location.pathname.replace(/\/$/, '') || '/';
      return p === '/app' || p === '/app/browse';
    }
    return location.pathname.startsWith(path);
  };

  const showGlobalSearch = shouldShowGlobalSearch(location.pathname);

  useEffect(() => {
    document.documentElement.lang = user?.uiLanguage || 'en';
  }, [user?.uiLanguage]);

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
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, [user, location.pathname]);

  const NavLink = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
    const active = isActive(item.path, item.exact);
    const btn = (
      <button
        type="button"
        onClick={() => navigate(item.path)}
        className={cn(
          'w-full flex items-center gap-3 rounded-[14px] text-sm font-medium transition-all duration-150 group relative',
          collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5',
          active
            ? 'bg-[#7f22fe] text-white shadow-[0_4px_3px_rgba(77,23,154,0.4),0_2px_2px_rgba(77,23,154,0.4)]'
            : 'text-white/50 hover:text-white/90 hover:bg-white/[0.07]',
        )}
      >
        <item.icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {item.path === '/app/notifications' && unreadNotifs > 0 && (
          <span className={cn(
            'min-w-5 h-5 px-1 rounded-full bg-[#ff3b30] text-[10px] font-bold text-white grid place-items-center',
            collapsed ? 'absolute top-1 right-1' : 'ml-auto',
          )}>
            {unreadNotifs > 9 ? '9+' : unreadNotifs}
          </span>
        )}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="bg-gray-900 text-white border-white/10 text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Fixed-height shell: sidebar + topbar stay pinned; only main scrolls */}
      <div className="flex h-screen max-h-dvh bg-[#F5F3FF] overflow-hidden">
        {/* Sidebar — always present for web; icon rail on narrow widths */}
        <div
          className={cn(
            'shrink-0 relative z-20 h-full transition-[width] duration-200',
            expanded ? 'w-60' : 'w-14',
          )}
        >
          <aside className="h-full w-full bg-[#0E0B2A] flex flex-col overflow-hidden">
            <div className={cn('flex items-center border-b border-white/[0.06] shrink-0', expanded ? 'px-4 py-[14px] gap-3' : 'px-0 py-[14px] justify-center')}>
              <div className="w-8 h-8 bg-[#2107aa] rounded-[10px] flex items-center justify-center shrink-0 shadow-[0_10px_7.5px_rgba(77,23,154,0.5),0_4px_3px_rgba(77,23,154,0.5)]">
                <span className="font-brand text-[var(--g-on-cta)] text-lg leading-none">G</span>
              </div>
              {expanded && (
                <div>
                  <div className="font-brand text-white text-lg tracking-tight leading-none">GOTCHA</div>
                  <div className="text-white/30 text-[10px] leading-none mt-0.5">Language Learning</div>
                </div>
              )}
            </div>

            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto min-h-0">
              {primaryNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={!expanded} />
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              {secondaryNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={!expanded} />
              ))}
            </nav>

            <div className="px-2 pb-3 pt-2 border-t border-white/[0.06] space-y-1 shrink-0">
              {expanded ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/import')}
                  className="w-full p-3 bg-gradient-to-r from-[#7008e7] to-[#372aac] rounded-[14px] text-left border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-white text-xs font-semibold">Pay as you go</span>
                  </div>
                  <p className="text-[#c4b4ff] text-[11px]">Import books · Pay per file</p>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigate('/app/import')}
                      className="w-full flex items-center justify-center py-2.5 rounded-[14px] bg-gradient-to-r from-[#7008e7] to-[#372aac] border border-white/10"
                    >
                      <Wallet className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="bg-gray-900 text-white border-white/10 text-xs">
                    Pay as you go
                  </TooltipContent>
                </Tooltip>
              )}

              <NavLink
                item={{ path: '/app/settings', label: 'Settings', icon: Settings }}
                collapsed={!expanded}
              />
            </div>
          </aside>

          <button
            type="button"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-500 hover:text-[#7f22fe] shadow-sm z-30 hidden lg:flex"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full">
          <header className="h-14 bg-white/95 backdrop-blur border-b border-gray-200/80 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-6 z-30 shrink-0 overflow-visible">
            {showGlobalSearch ? (
              <div className="w-full max-w-[400px] min-w-0" data-global-search="library-only">
                <GlobalSearch />
              </div>
            ) : (
              <div className="min-w-0" data-global-search="hidden" />
            )}

            <div className="flex items-center h-9 gap-2 sm:gap-2.5 shrink-0">
              <div className="h-9 flex items-center gap-1.5 bg-[#fffbeb] border border-[#fee685] rounded-full px-2.5">
                <Flame className="w-3.5 h-3.5 text-[#fe9a00]" />
                <span className="text-xs font-bold text-[#bb4d00] tabular-nums leading-none">{stats?.streakCount ?? user?.streakCount ?? 0}</span>
              </div>

              <button
                type="button"
                aria-label="Notifications"
                onClick={() => navigate('/app/notifications')}
                className="relative size-9 rounded-full border border-gray-200 bg-white grid place-items-center text-gray-600 hover:text-[#7f22fe] hover:border-violet-200"
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
                    aria-label="Account menu"
                    className="size-9 rounded-full grid place-items-center shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.1)]"
                  >
                    <UserAvatar
                      name={user?.displayName ?? user?.email}
                      url={user?.avatarUrl}
                      size={32}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-60 p-3 z-[100]">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={user?.displayName ?? user?.email}
                      url={user?.avatarUrl}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#111827] truncate">{user?.displayName}</div>
                      <div className="text-xs text-[#6b7280] truncate">{user?.email}</div>
                    </div>
                  </div>
                  <div className="h-px bg-[#e5e7eb] my-2.5" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] text-sm font-medium text-[#6b7280] hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                    Log out
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          <main
            className={cn(
              'flex-1 min-h-0 min-w-0 relative z-0',
              location.pathname.startsWith('/app/messages') ? 'overflow-hidden' : 'overflow-y-auto',
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
