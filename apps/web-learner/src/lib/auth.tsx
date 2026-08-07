import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearTokens, setTokens } from './api';
import type { UserPreferences, UserProfile, UserStats, VocabItem } from './types';

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
  }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: { displayName?: string; nativeLanguage?: string; uiLanguage?: string }) => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [refreshProfile, refreshVocab]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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
    await refreshProfile();
    await refreshVocab();
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
      const res = await api<{ accessToken: string; refreshToken: string; user: UserProfile }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(data) },
      );
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      await refreshProfile();
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
