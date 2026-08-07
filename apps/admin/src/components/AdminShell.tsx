import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Cpu,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import avatarUrl from '../assets/avatar.png';
import { AdminNotifications } from './AdminNotifications';
import { AdminSearch } from './AdminSearch';
import { redirectToSharedLogin, useAuth } from '../lib/auth';
import { cn, initials } from '../lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/content', label: 'Content Library', icon: BookOpen },
  { to: '/languages', label: 'Languages', icon: Globe2 },
  { to: '/level-tests', label: 'Level Tests', icon: ClipboardCheck },
  { to: '/ai-usage', label: 'AI Usage', icon: Cpu },
  { to: '/gamification', label: 'Gamification', icon: Sparkles },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/support', label: 'Support', icon: Ticket },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const name = user?.displayName || 'Admin';
  const role = user?.role ? user.role.replace('_', ' ') : 'Admin';

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const Sidebar = (
    <aside className="bg-[#1c1929] text-white w-[240px] h-full flex flex-col px-4 py-6 shrink-0">
      <div className="flex items-center gap-2 pl-3 mb-7 shrink-0">
        <div className="size-8 rounded-lg bg-[#6c1d95] grid place-items-center text-white font-extrabold text-xl">
          G
        </div>
        <div>
          <div className="text-[16px] font-bold leading-none">GOTCHA</div>
          <div className="text-[10px] font-semibold tracking-[1px] uppercase text-[#6c1d95] mt-1">
            Admin Console
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition',
                isActive
                  ? 'bg-[#6c1d95] text-white font-semibold'
                  : 'text-slate-400 font-medium hover:text-white hover:bg-white/5',
              )
            }
          >
            <item.icon className="size-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3 shrink-0">
        <img src={avatarUrl} alt="" className="size-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-xs text-slate-400 capitalize truncate">{role}</div>
        </div>
        <button
          type="button"
          title="Log out"
          onClick={() => {
            logout();
            redirectToSharedLogin();
          }}
          className="text-slate-400 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );

  return (
    /* Fixed-height shell: sidebar + topbar stay pinned; only main scrolls */
    <div className="h-screen max-h-dvh bg-[#f8fafc] flex overflow-hidden">
      <div className="hidden lg:block h-full z-20 shrink-0">{Sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="relative z-50 h-full w-[min(240px,85vw)] shadow-2xl translate-x-0">
            {Sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-0 h-full">
        {/* Narrow-web topbar */}
        <header className="lg:hidden shrink-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Open menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="font-bold flex-1 min-w-0 truncate">GOTCHA Admin</div>
            <AdminNotifications />
            <div className="size-8 rounded-full bg-[#6c1d95] text-white grid place-items-center text-xs font-bold shrink-0">
              {initials(user?.displayName, user?.email)}
            </div>
          </div>
          <AdminSearch className="w-full" />
        </header>

        {/* Desktop topbar — search + notifications (Figma 47:6) */}
        <header className="hidden lg:flex shrink-0 z-30 items-center justify-end gap-3 px-8 py-4 bg-[#f8fafc]/95 backdrop-blur border-b border-slate-200/70">
          <AdminSearch />
          <AdminNotifications />
        </header>

        <main className="px-4 py-6 lg:px-8 lg:pb-10 flex-1 min-h-0 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
