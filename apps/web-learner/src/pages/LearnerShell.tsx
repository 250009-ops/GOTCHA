import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Home,
  LogOut,
  Settings,
  Upload,
} from 'lucide-react';
import { GlobalSearch } from '../components/GlobalSearch';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';
import { useAuth } from '../lib/auth';
import { avatarInitials } from '../lib/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const primaryNav: NavItem[] = [
  { path: '/app', label: 'Library', icon: Home, exact: true },
  { path: '/app/vocabulary', label: 'Vocabulary', icon: Brain },
  { path: '/app/import', label: 'Import', icon: Upload },
];

const secondaryNav: NavItem[] = [
  { path: '/app/stats', label: 'Statistics', icon: BarChart3 },
];

const mobileNav: NavItem[] = [
  { path: '/app', label: 'Library', icon: Home, exact: true },
  { path: '/app/vocabulary', label: 'Vocab', icon: Brain },
  { path: '/app/import', label: 'Import', icon: Upload },
  { path: '/app/stats', label: 'Stats', icon: BarChart3 },
  { path: '/app/settings', label: 'Settings', icon: Settings },
];

export default function LearnerShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, stats, preferences, logout } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (path: string, exact = false) => {
    if (exact || path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    return location.pathname.startsWith(path);
  };

  const todayMinutes = stats?.todayMinutes ?? 0;
  const dailyGoal = preferences?.dailyGoalMinutes ?? 15;
  const todayPct = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
  const initials = avatarInitials(user?.displayName ?? user?.email ?? 'G');

  const NavLink = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
    const active = isActive(item.path, item.exact);
    const btn = (
      <button
        type="button"
        onClick={() => navigate(item.path)}
        className={cn(
          'w-full flex items-center gap-3 rounded-[14px] text-sm font-medium transition-all duration-150 group',
          collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5',
          active
            ? 'bg-[#7f22fe] text-white shadow-[0_4px_3px_rgba(77,23,154,0.4),0_2px_2px_rgba(77,23,154,0.4)]'
            : 'text-white/50 hover:text-white/90 hover:bg-white/[0.07]',
        )}
      >
        <item.icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
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
      <div className="flex min-h-screen bg-[#F5F3FF]">
        {/* Desktop sidebar — full height, left of header (Figma LearnerShell) */}
        <div
          className={cn(
            'hidden lg:block shrink-0 relative z-20 sticky top-0 h-screen transition-all duration-200',
            expanded ? 'w-60' : 'w-[3.75rem]',
          )}
        >
          <aside className="h-full w-full bg-[#0E0B2A] flex flex-col overflow-hidden">
            <div className={cn('flex items-center border-b border-white/[0.06] shrink-0', expanded ? 'px-4 py-[14px] gap-3' : 'px-0 py-[14px] justify-center')}>
              <div className="w-8 h-8 bg-[#2107aa] rounded-[10px] flex items-center justify-center shrink-0 shadow-[0_10px_7.5px_rgba(77,23,154,0.5),0_4px_3px_rgba(77,23,154,0.5)]">
                <span className="font-brand text-white text-lg leading-none">G</span>
              </div>
              {expanded && (
                <div>
                  <div className="font-brand text-white text-lg tracking-tight leading-none">GOTCHA</div>
                  <div className="text-white/30 text-[10px] leading-none mt-0.5">Language Learning</div>
                </div>
              )}
            </div>

            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
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
                  onClick={() => navigate('/app/settings')}
                  className="w-full p-3 bg-gradient-to-r from-[#7008e7] to-[#372aac] rounded-[14px] text-left border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-white text-xs font-semibold">Upgrade to Premium</span>
                  </div>
                  <p className="text-[#c4b4ff] text-[11px]">Unlimited AI · Imports · Offline</p>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigate('/app/settings')}
                      className="w-full flex items-center justify-center py-2.5 rounded-[14px] bg-gradient-to-r from-[#7008e7] to-[#372aac] border border-white/10"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="bg-gray-900 text-white border-white/10 text-xs">
                    Upgrade to Premium
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
            className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-500 hover:text-[#7f22fe] shadow-sm z-30 flex"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex flex-col flex-1 min-w-0 min-h-screen">
          <header className="h-14 bg-white/95 backdrop-blur border-b border-gray-200/80 flex items-center gap-4 px-4 lg:px-5 sticky top-0 z-30 shrink-0 overflow-visible">
            {/* Mobile brand — book mark + GOTCHA (Figma 9:22260) */}
            <div className="lg:hidden flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundImage: 'linear-gradient(135deg, #7f22fe 0%, #432dd7 100%)' }}
              >
                <BookOpen className="w-3.5 h-3.5 text-white" strokeWidth={1.75} />
              </div>
              <span className="font-brand text-[#101828] tracking-[-0.4px] text-base leading-6">GOTCHA</span>
            </div>

            {/* Desktop search */}
            <div className="hidden lg:block flex-1 max-w-[512px]">
              <GlobalSearch />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2.5">
              {/* Daily goal — desktop header only */}
              <div className="hidden lg:flex items-center gap-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-full px-3 py-1.5">
                <div className="relative w-16 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-full', todayPct >= 100 ? 'bg-emerald-500' : 'bg-[#8e51ff]')}
                    style={{ width: `${todayPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#4a5565] tabular-nums leading-4">
                  {todayMinutes}<span className="text-[#99a1af]">/{dailyGoal}m</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#fffbeb] border border-[#fee685] rounded-full px-2.5 py-1.5">
                <Flame className="w-3.5 h-3.5 text-[#fe9a00]" />
                <span className="text-xs font-bold text-[#bb4d00] tabular-nums leading-4">{stats?.streakCount ?? user?.streakCount ?? 0}</span>
              </div>

              <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.1)]"
                    style={{ backgroundImage: 'linear-gradient(135deg, #8e51ff 0%, #432dd7 100%)' }}
                  >
                    {initials}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-60 p-3 z-[100]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundImage: 'linear-gradient(135deg, #a684ff 0%, #4f39f6 100%)' }}
                    >
                      {initials}
                    </div>
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

          <main className="flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0 relative z-0">
            <Outlet />
          </main>
        </div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
          <div className="flex items-center justify-around h-14 px-1">
            {mobileNav.map((item) => {
              const active = isActive(item.path, item.exact);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={cn('flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl mx-0.5', active ? 'text-[#7f22fe]' : 'text-gray-400')}
                >
                  <div className={cn('p-1.5 rounded-xl', active && 'bg-violet-100')}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
