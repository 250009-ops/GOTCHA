import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api, clearTokens, setTokens } from './api';
import type { UserPreferences, UserProfile, UserStats, VocabItem } from './types';

/** Routes where we must not call /users/me, /users/me/stats, or /auth/refresh. */
const PUBLIC_AUTH_ROUTES = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

interface AuthContextValue {
  user: UserProfile | null;
  stats: UserStats | null;
  preferences: UserPreferences | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{
    accessToken: string;
    refreshToken: string;
    isAdmin: boolean;
  }>;
  register: (data: {
    email: string;
    password: string;
    displayName?: string;
    nativeLanguage: string;
    targetLanguages: string[];
  }) => Promise<{ requiresEmailVerification?: boolean; email?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: { displayName?: string; nativeLanguage?: string; uiLanguage?: string }) => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  vocabItems: VocabItem[];
  vocabLoading: boolean;
  vocabError: string | null;
  refreshVocab: () => Promise<void>;
  rateWord: (id: string, rating: string) => Promise<void>;
  markVocabMastered: (id: string, mastered?: boolean) => Promise<void>;
  removeVocab: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultPreferences: UserPreferences = {
  readerFontScale: 1,
  readerTheme: 'light',
  readerLineSpacing: 1.5,
  showKnownWords: true,
  ttsEnabled: false,
  dailyGoalMinutes: 15,
  notificationsEnabled: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.has(pathname);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  const refreshProfile = useCallback(async () => {
    const [profile, userStats] = await Promise.all([
      api<UserProfile & { preferences?: UserPreferences | null }>('/users/me'),
      api<Record<string, number>>('/users/me/stats'),
    ]);
    setUser(profile);
    setStats({
      streakCount: profile.streakCount ?? 0,
      todayMinutes: userStats.totalReadMinutes ?? 0,
      dailyGoalMinutes: profile.preferences?.dailyGoalMinutes ?? 15,
      wordsLearned: userStats.vocabularyTotal ?? 0,
      wordsKnown: userStats.vocabularyMastered ?? 0,
      totalReadSeconds: (userStats.totalReadMinutes ?? 0) * 60,
    });
    setPreferences(profile.preferences ?? defaultPreferences);
  }, []);

  const refreshVocab = useCallback(async () => {
    setVocabLoading(true);
    setVocabError(null);
    try {
      const items = await api<VocabItem[]>('/vocabulary');
      setVocabItems(
        items.map((item) => ({
          ...item,
          dueAt: typeof item.dueAt === 'string' ? item.dueAt : new Date(item.dueAt as unknown as Date).toISOString(),
        })),
      );
    } catch (e) {
      setVocabError(e instanceof Error ? e.message : 'Failed to load vocabulary');
      throw e;
    } finally {
      setVocabLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem('gotcha_learner_access');
    if (!token) {
      setLoading(false);
      setBootstrapped(true);
      return;
    }
    try {
      await refreshProfile();
      try {
        await refreshVocab();
      } catch {
        /* profile ok; vocab error surfaced via vocabError */
      }
    } catch {
      clearTokens();
      setUser(null);
      setStats(null);
      setPreferences(null);
      setVocabItems([]);
    } finally {
      setLoading(false);
      setBootstrapped(true);
    }
  }, [refreshProfile, refreshVocab]);

  useEffect(() => {
    // Public auth pages: drop *stale* sessions only. Never wipe a session that
    // login/register just established while we are still on /login (user set →
    // effect re-ran and used to clearTokens + setUser(null) before navigate('/app')).
    if (isPublicAuthRoute) {
      if (!user) {
        clearTokens();
        setStats(null);
        setPreferences(null);
        setVocabItems([]);
        setVocabError(null);
      }
      setLoading(false);
      setBootstrapped(true);
      return;
    }
    // Session already established via login/register in this tab.
    if (user) {
      setBootstrapped(true);
      setLoading(false);
      return;
    }
    // Already attempted bootstrap (success or cleared stale tokens).
    if (bootstrapped) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void bootstrap();
  }, [isPublicAuthRoute, bootstrap, bootstrapped, user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{
      accessToken: string;
      refreshToken: string;
      isAdmin?: boolean;
      user: UserProfile;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
    try {
      await refreshProfile();
    } catch {
      /* profile fields partially available from login response */
    }
    try {
      await refreshVocab();
    } catch {
      /* vocabulary is non-blocking after login */
    }
    return {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      isAdmin: !!res.isAdmin,
    };
  }, [refreshProfile, refreshVocab]);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      displayName?: string;
      nativeLanguage: string;
      targetLanguages: string[];
    }) => {
      const res = await api<{
        accessToken?: string;
        refreshToken?: string;
        user?: UserProfile;
        requiresEmailVerification?: boolean;
        email?: string;
        message?: string;
      }>('/auth/register', { method: 'POST', body: JSON.stringify(data) });

      if (res.requiresEmailVerification || (!res.accessToken && res.email)) {
        return {
          requiresEmailVerification: true as const,
          email: res.email ?? data.email,
        };
      }

      if (!res.accessToken || !res.refreshToken || !res.user) {
        throw new Error(res.message || 'Registration failed');
      }

      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      await refreshProfile();
      return {};
    },
    [refreshProfile],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setStats(null);
    setPreferences(null);
    setVocabItems([]);
    setVocabError(null);
  }, []);

  const updatePreferences = useCallback(async (patch: Partial<UserPreferences>) => {
    const updated = await api<UserPreferences>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setPreferences(updated);
  }, []);

  const updateProfile = useCallback(
    async (patch: { displayName?: string; nativeLanguage?: string; uiLanguage?: string }) => {
      const updated = await api<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
    },
    [],
  );

  const uploadAvatar = useCallback(async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const updated = await api<UserProfile>('/users/me/avatar', { method: 'POST', body });
    setUser((prev) => (prev ? { ...prev, ...updated } : prev));
  }, []);

  const rateWord = useCallback(
    async (id: string, rating: string) => {
      await api(`/vocabulary/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating: rating.toLowerCase() }),
      });
      await refreshVocab();
    },
    [refreshVocab],
  );

  const markVocabMastered = useCallback(
    async (id: string, mastered = true) => {
      await api(`/vocabulary/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ mastered }),
      });
      await refreshVocab();
    },
    [refreshVocab],
  );

  const removeVocab = useCallback(
    async (id: string) => {
      await api(`/vocabulary/${id}`, { method: 'DELETE' });
      await refreshVocab();
    },
    [refreshVocab],
  );

  const value = useMemo(
    () => ({
      user,
      stats,
      preferences: preferences ?? defaultPreferences,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      updatePreferences,
      uploadAvatar,
      vocabItems,
      vocabLoading,
      vocabError,
      refreshVocab,
      rateWord,
      markVocabMastered,
      removeVocab,
    }),
    [
      user,
      stats,
      preferences,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      updatePreferences,
      uploadAvatar,
      vocabItems,
      vocabLoading,
      vocabError,
      refreshVocab,
      rateWord,
      markVocabMastered,
      removeVocab,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
