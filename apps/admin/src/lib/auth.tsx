import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiUpload, clearToken, getToken, setTokens } from './api';

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string | null;
}

interface AuthContextValue {
  user: AdminProfile | null;
  loading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LEARNER_APP_URL = (
  import.meta.env.VITE_LEARNER_APP_URL ?? 'http://localhost:5175'
).replace(/\/$/, '');

/** Admin app base for login returnUrl (path-aware on single-host deploys). */
function adminAppReturnUrl() {
  const fromEnv = import.meta.env.VITE_ADMIN_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/?$/, '/');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${window.location.origin}${base === '/' ? '/' : base}`;
}

/** Consume one-time token handoff from shared learner login (`#accessToken=...&refreshToken=...`). */
function consumeHashTokens() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || !raw.includes('accessToken=')) return false;
  const params = new URLSearchParams(raw);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  if (!accessToken || !refreshToken) return false;
  setTokens({ accessToken, refreshToken });
  const clean = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', clean);
  return true;
}

export function redirectToSharedLogin() {
  const returnUrl = encodeURIComponent(adminAppReturnUrl());
  window.location.href = `${LEARNER_APP_URL}/login?returnUrl=${returnUrl}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const profile = await api<AdminProfile>('/admin/me');
    setUser(profile);
  }, []);

  useEffect(() => {
    consumeHashTokens();
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    refresh()
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const updated = await apiUpload<Pick<AdminProfile, 'avatarUrl'>>('/users/me/avatar', file);
    setUser((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, logout, refresh, uploadAvatar }),
    [user, loading, logout, refresh, uploadAvatar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
