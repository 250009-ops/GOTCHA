import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Cpu,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Receipt,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminAvatar } from './AdminAvatar';
import { AdminNotifications } from './AdminNotifications';
import { AdminSearch } from './AdminSearch';
import { redirectToSharedLogin, useAuth } from '../lib/auth';
import { useAppTheme, type AppTheme } from '../lib/appTheme';
import { cn } from '../lib/utils';
import { GotchaLogo } from './GotchaLogo';

type AdminRole = 'superadmin' | 'editor' | 'moderator' | 'analyst';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles: AdminRole[];
}

const nav: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true, roles: ['superadmin', 'analyst', 'editor'] },
  { to: '/users', label: 'Learners', icon: Users, roles: ['superadmin', 'analyst', 'moderator'] },
  { to: '/content', label: 'Content Library', icon: BookOpen, roles: ['superadmin', 'editor'] },
  // Moderators only have API access to the moderation queue (not the full curriculum/licensing
  // catalog), so they get a dedicated link straight to that tab instead of "Content Library".
  { to: '/content/user-imports', label: 'Moderation Queue', icon: ShieldCheck, roles: ['moderator'] },
  { to: '/languages', label: 'Languages', icon: Globe2, roles: ['superadmin', 'editor', 'analyst'] },
  { to: '/ai-usage', label: 'AI Usage', icon: Cpu, roles: ['superadmin', 'analyst', 'editor'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['superadmin', 'editor'] },
  { to: '/import-pricing', label: 'Import & Pricing', icon: CreditCard, roles: ['superadmin', 'analyst', 'editor'] },
  { to: '/payments', label: 'Payments', icon: Receipt, roles: ['superadmin', 'analyst'] },
  { to: '/payments/pricing', label: 'Pricing', icon: Tags, roles: ['superadmin', 'analyst', 'editor'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['superadmin'] },
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useAppTheme();
  const name = user?.displayName || 'Admin';
  const role = user?.role ? user.role.replace('_', ' ') : 'Admin';

  const filteredNav = useMemo(() => {
    const userRole = (user?.role ?? 'moderator') as AdminRole;
    return nav.filter((item) => item.roles.includes(userRole));
  }, [user?.role]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const Sidebar = (
    <aside className="bg-g-admin-sidebar text-white w-[240px] h-full flex flex-col px-4 py-6 shrink-0">
      <div className="flex items-center gap-2 pl-3 mb-7 shrink-0">
        <GotchaLogo tone="light" subtitle="Admin Console" />
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        {filteredNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition',
                isActive
                  ? 'bg-g-blue-700 text-white font-semibold'
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
        <AdminAvatar name={user?.displayName} email={user?.email} url={user?.avatarUrl} size={40} />
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
    <div className="h-screen max-h-dvh bg-g-admin-bg flex overflow-hidden">
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
            <div className="flex-1 min-w-0 flex items-center gap-2"><GotchaLogo size={24} tone="ink" /><span className="text-xs font-medium text-slate-500">Admin</span></div>
            <AdminNotifications />
            <AdminAvatar name={user?.displayName} email={user?.email} url={user?.avatarUrl} size={32} />
          </div>
          <AdminSearch className="w-full" />
        </header>

        {/* Desktop topbar — search + notifications (Figma 47:6) */}
        <header className="hidden lg:flex shrink-0 z-30 items-center justify-end gap-3 px-8 py-4 bg-g-topbar backdrop-blur border-b border-g-line">
          <AdminSearch />
          <select
            aria-label="Appearance"
            value={theme}
            onChange={(e) => setTheme(e.target.value as AppTheme)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <AdminNotifications />
        </header>

        <main className="px-4 py-6 lg:px-8 lg:pb-10 flex-1 min-h-0 min-w-0 overflow-y-auto [overflow-anchor:none]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
