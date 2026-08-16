import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { UserAvatar } from '../components/UserAvatar';
import { cn } from '../components/ui/utils';
import { api, clearTokens } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  CEFR_LEVELS,
  LANGUAGE_META,
  type AppLanguage,
  type CatalogLanguage,
  type CefrLevel,
  type SubscriptionInfo,
  type UserTargetLanguage,
} from '../lib/types';

const READER_THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'sepia', label: 'Sepia', icon: BookOpen },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#f3f4f6] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f9fafb]">
        <h2 className="font-bold text-gray-900 text-xl">{title}</h2>
      </div>
      <div className="divide-y divide-[#f9fafb]">{children}</div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#364153]">{label}</div>
        {description && <div className="text-xs text-[#99a1af] mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function RangeSlider({ value, min, max, step, onChange, width = 112 }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; width?: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="range-slider"
      style={{ width, '--range-progress': `${pct}%` } as React.CSSProperties}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-8 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-[#7c3aed]' : 'bg-[#cbced4]')}
    >
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[15px]' : 'translate-x-[1px]')} />
    </button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Fill in both password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password updated. Please sign in again.');
      onClose();
      // Backend revokes all refresh tokens on password change — force a fresh login.
      clearTokens();
      window.location.assign('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Change password" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">Current password</label>
          <input
            type={show ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">New password</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-9 pl-3 pr-9 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe]"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">Confirm new password</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe]"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="mt-1 h-9 rounded-[14px] bg-[#7f22fe] hover:bg-[#7008e7] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Update password
        </button>
      </div>
    </ModalShell>
  );
}

function TargetLanguageModal({
  mode,
  existing,
  usedCodes,
  nativeLanguage,
  languageOptions,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  existing?: UserTargetLanguage;
  usedCodes: string[];
  nativeLanguage: AppLanguage;
  languageOptions: Array<{ code: string; name: string; flagEmoji: string }>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const available = languageOptions.filter(
    (l) => l.code !== nativeLanguage && (mode === 'edit' || !usedCodes.includes(l.code)),
  );
  const [targetLanguage, setTargetLanguage] = useState<string>(
    existing?.targetLanguage ?? available[0]?.code ?? 'en',
  );
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(existing?.cefrLevel ?? 'a1');
  const [isPrimary, setIsPrimary] = useState(existing?.isPrimary ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      if (mode === 'add') {
        await api('/users/me/target-languages', {
          method: 'POST',
          body: JSON.stringify({ targetLanguage, cefrLevel, isPrimary }),
        });
        toast.success('Language added');
      } else if (existing) {
        await api(`/users/me/target-languages/${existing.targetLanguage}`, {
          method: 'PATCH',
          body: JSON.stringify({ cefrLevel, isPrimary }),
        });
        toast.success('Language updated');
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save language');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={mode === 'add' ? 'Add target language' : 'Edit target language'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">Language</label>
          {mode === 'add' ? (
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe]"
            >
              {available.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flagEmoji} {l.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="h-9 px-3 flex items-center bg-gray-50 border border-[#e5e7eb] rounded-[14px] text-sm text-gray-600">
              {LANGUAGE_META[existing?.targetLanguage as AppLanguage]?.flag}{' '}
              {LANGUAGE_META[existing?.targetLanguage as AppLanguage]?.label}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">CEFR level</label>
          <select
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe]"
          >
            {CEFR_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#364153] cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded" />
          Set as primary target language
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || (mode === 'add' && available.length === 0)}
          className="mt-1 h-9 rounded-[14px] bg-[#7f22fe] hover:bg-[#7008e7] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'add' ? 'Add language' : 'Save changes'}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    if (!password) {
      toast.error('Enter your password to confirm');
      return;
    }
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      await api('/users/me', { method: 'DELETE', body: JSON.stringify({ currentPassword: password }) });
      toast.success('Account deleted.');
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell title="Delete account" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-[14px] bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          This permanently anonymizes your account and signs you out everywhere. This cannot be undone.
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">Current password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={deleting}
          className="mt-1 h-9 rounded-[14px] bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Permanently delete my account
        </button>
      </div>
    </ModalShell>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, preferences, updateProfile, updatePreferences, uploadAvatar, refreshProfile, logout } = useAuth();

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [langModal, setLangModal] = useState<{ mode: 'add' | 'edit'; existing?: UserTargetLanguage } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [langBusy, setLangBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage>(user?.nativeLanguage ?? 'en');
  const [uiLanguage, setUiLanguage] = useState<AppLanguage>(user?.uiLanguage ?? 'en');
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [dailyGoal, setDailyGoal] = useState(preferences?.dailyGoalMinutes ?? 15);
  const [fontScale, setFontScale] = useState(preferences?.readerFontScale ?? 1);
  const [lineSpacing, setLineSpacing] = useState(preferences?.readerLineSpacing ?? 1.5);
  const [theme, setTheme] = useState(preferences?.readerTheme ?? 'light');
  const [showKnownWords, setShowKnownWords] = useState(preferences?.showKnownWords ?? false);
  const [ttsEnabled, setTtsEnabled] = useState(preferences?.ttsEnabled ?? false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(preferences?.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [catalogLangs, setCatalogLangs] = useState<CatalogLanguage[]>([]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setNativeLanguage(user.nativeLanguage ?? 'en');
      setUiLanguage(user.uiLanguage ?? 'en');
    }
  }, [user]);

  useEffect(() => {
    api<CatalogLanguage[]>('/content/languages')
      .then(setCatalogLangs)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (preferences) {
      setDailyGoal(preferences.dailyGoalMinutes);
      setFontScale(preferences.readerFontScale);
      setLineSpacing(preferences.readerLineSpacing);
      setTheme(preferences.readerTheme);
      setShowKnownWords(preferences.showKnownWords);
      setTtsEnabled(preferences.ttsEnabled);
      setNotificationsEnabled(preferences.notificationsEnabled);
    }
  }, [preferences]);

  useEffect(() => {
    api<SubscriptionInfo>('/billing/subscription')
      .then(setSubscription)
      .catch(console.error)
      .finally(() => setSubLoading(false));
  }, []);

  const languageOptions =
    catalogLangs.length > 0
      ? catalogLangs.filter((l) => l.isEnabled !== false)
      : Object.entries(LANGUAGE_META)
          .filter(([code]) => ['en', 'ru', 'uz'].includes(code))
          .map(([code, meta]) => ({
            code,
            name: meta.label,
            nativeName: meta.nativeName,
            flagEmoji: meta.flag,
            isEnabled: true,
          }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateProfile({ displayName: displayName.trim() || undefined, nativeLanguage, uiLanguage }),
        updatePreferences({
          dailyGoalMinutes: dailyGoal,
          readerFontScale: fontScale,
          readerLineSpacing: lineSpacing,
          readerTheme: theme as 'light' | 'dark' | 'sepia',
          showKnownWords,
          ttsEnabled,
          notificationsEnabled,
        }),
      ]);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const plan = subscription?.subscription?.plan;
  const quota = subscription?.usage.quota ?? plan?.aiDailyQuota ?? 50;
  const lookupsToday = subscription?.usage.lookupsToday ?? 0;
  const usagePct = quota > 0 ? Math.min(100, Math.round((lookupsToday / quota) * 100)) : 0;
  const targetLanguages = user?.targetLanguages ?? [];

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await api('/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gotcha-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleRemoveLanguage = async (lang: string) => {
    if (targetLanguages.length <= 1) {
      toast.error('You must keep at least one target language');
      return;
    }
    setLangBusy(lang);
    try {
      await api(`/users/me/target-languages/${lang}`, { method: 'DELETE' });
      await refreshProfile();
      toast.success('Language removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove language');
    } finally {
      setLangBusy(null);
    }
  };

  const handleAccountDeleted = () => {
    setDeleteModalOpen(false);
    clearTokens();
    window.location.assign('/login');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-5">
      {pwModalOpen && <ChangePasswordModal onClose={() => setPwModalOpen(false)} />}
      {langModal && (
        <TargetLanguageModal
          mode={langModal.mode}
          existing={langModal.existing}
          usedCodes={targetLanguages.map((tl) => tl.targetLanguage)}
          nativeLanguage={nativeLanguage}
          languageOptions={languageOptions}
          onClose={() => setLangModal(null)}
          onSaved={refreshProfile}
        />
      )}
      {deleteModalOpen && (
        <DeleteAccountModal onClose={() => setDeleteModalOpen(false)} onDeleted={handleAccountDeleted} />
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-[#99a1af] text-sm mt-0.5">Manage your account and learning preferences.</p>
        </div>
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving}
          className="h-9 px-4 rounded-[14px] bg-[#7f22fe] hover:bg-[#7008e7] disabled:opacity-60 text-white text-sm font-medium flex items-center gap-2 shrink-0"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save changes
        </button>
      </div>

      <Section title="Account">
        <Row label="Photo" description="Used on Home, Profile, and chat. JPG, PNG, or WebP up to 2 MB.">
          <div className="flex items-center gap-3">
            <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={48} />
            <label className="h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50 inline-flex items-center cursor-pointer">
              {avatarBusy ? 'Uploading…' : 'Change photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setAvatarBusy(true);
                  void uploadAvatar(file)
                    .then(() => toast.success('Photo updated'))
                    .catch((err) => toast.error(err instanceof Error ? err.message : 'Upload failed'))
                    .finally(() => setAvatarBusy(false));
                }}
              />
            </label>
          </div>
        </Row>
        <Row label="Display name" description="Shown on your profile and leaderboard">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-48 h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
          />
        </Row>
        <Row label="Native language" description="Used for translations and lookups">
          <select
            value={nativeLanguage}
            onChange={(e) => setNativeLanguage(e.target.value as AppLanguage)}
            className="w-48 h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
          >
            {languageOptions.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flagEmoji} {l.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="App language" description="Interface language on web and mobile. Same account value.">
          <select
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as AppLanguage)}
            className="w-48 h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
          >
            {(['en', 'ru', 'uz'] as const).map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_META[code].flag} {LANGUAGE_META[code].label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Email" description="Used for login and notifications">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6a7282]">{user?.email}</span>
            <span className="text-[11px] font-semibold text-[#007a55] bg-[#d0fae5] rounded-full px-1.5 py-0.5">Verified</span>
          </div>
        </Row>
        <Row label="Password">
          <button
            type="button"
            onClick={() => setPwModalOpen(true)}
            className="h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50"
          >
            Change password
          </button>
        </Row>
      </Section>

      <Section title="Target Languages">
        {targetLanguages.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400">No target languages set yet.</div>
        ) : (
          targetLanguages.map((tl) => {
            const catalog = languageOptions.find((l) => l.code === tl.targetLanguage);
            const meta = LANGUAGE_META[tl.targetLanguage as AppLanguage];
            return (
              <div key={tl.targetLanguage} className="flex items-center gap-3 px-5 py-3.5">
                <span className="text-xl leading-none">{catalog?.flagEmoji ?? meta?.flag ?? '🌐'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1e2939]">{catalog?.name ?? meta?.label ?? tl.targetLanguage}</div>
                  <div className="text-xs text-[#99a1af] mt-0.5">
                    Level: {tl.cefrLevel.toUpperCase()}
                    {tl.placementScore != null ? ` · Score: ${tl.placementScore}/100` : ''}
                  </div>
                </div>
                {tl.isPrimary && (
                  <span className="text-[11px] font-semibold text-[#7008e7] bg-[#ede9fe] rounded-full px-2 py-0.5 shrink-0">Primary</span>
                )}
                {targetLanguages.length > 1 && (
                  <button
                    type="button"
                    disabled={langBusy === tl.targetLanguage}
                    onClick={() => void handleRemoveLanguage(tl.targetLanguage)}
                    className="p-1.5 rounded-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 disabled:opacity-40"
                    title="Remove language"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLangModal({ mode: 'edit', existing: tl })}
                  className="p-1.5 rounded-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={() => setLangModal({ mode: 'add' })}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[14px] border border-black/10 bg-white text-xs font-medium text-[#0a0a0a] hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />Add language
          </button>
        </div>
      </Section>

      <Section title="Reading Preferences">
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-[#99a1af] uppercase tracking-[0.6px] mb-3">Preview</div>
          <div
            className="font-serif text-[#1e2939] bg-white rounded-[14px] p-4"
            style={{ fontSize: `${14 * fontScale}px`, lineHeight: lineSpacing }}
          >
            The old lighthouse had stood on the cliff for more than a hundred years. Its white walls,{' '}
            <span className="border-b-[1.6px] border-dashed border-[#ffb900]">weathered</span> by salt and storm, rose{' '}
            <span className="border-b-[1.6px] border-[#51a2ff]">magnificently</span> against the grey winter sky.
          </div>
        </div>

        <Row label="Font size" description={`${Math.round(fontScale * 100)}% — base size`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#99a1af]">A</span>
            <RangeSlider value={fontScale} min={0.8} max={1.6} step={0.05} onChange={setFontScale} />
            <span className="text-sm font-semibold text-[#0a0a0a]">A</span>
          </div>
        </Row>
        <Row label="Line spacing" description={`${lineSpacing.toFixed(1)}× line height`}>
          <RangeSlider value={lineSpacing} min={1} max={2.5} step={0.1} onChange={setLineSpacing} />
        </Row>
        <Row label="Reader theme">
          <div className="flex gap-2">
            {READER_THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border text-xs font-medium transition-all',
                  theme === t.value ? 'border-[#a684ff] bg-[#f5f3ff] text-[#7008e7]' : 'border-[#e5e7eb] text-[#6a7282] hover:border-gray-300',
                )}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Show known words" description="When off, known words show without any highlight">
          <Toggle checked={showKnownWords} onChange={setShowKnownWords} />
        </Row>
        <Row label="Text-to-speech" description="Read text aloud while you follow along">
          <Toggle checked={ttsEnabled} onChange={setTtsEnabled} />
        </Row>
      </Section>

      <Section title="Learning Goals">
        <Row label="Daily reading goal" description={`${dailyGoal} minutes per day`}>
          <RangeSlider value={dailyGoal} min={5} max={120} step={5} onChange={setDailyGoal} width={128} />
        </Row>
        <Row label="Streak reminders" description="Get notified before your streak breaks">
          <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </Row>
      </Section>

      <Section title="Usage & Imports">
        <div className="p-5">
          {subLoading ? (
            <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Loading usage…</div>
          ) : (
            <>
              {/* GOTCHA has no recurring subscription — every account gets a free daily/monthly
                  allowance, and imports beyond that are billed per-document via Atmos (see the
                  Import page). This card reports real usage, not a "plan" tier. */}
              <div
                className="rounded-[14px] p-5"
                style={{ backgroundImage: 'linear-gradient(161deg, #7f22fe 0%, #432dd7 100%)' }}
              >
                <div className="rounded-[14px] text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#ddd6ff]">Free allowance</div>
                      <div className="text-2xl font-bold mt-1">Pay per import</div>
                    </div>
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-1.5 py-4">
                    {[
                      `AI lookups: ${lookupsToday}/${quota >= 1_000_000 ? '∞' : quota} today`,
                      `${plan?.importLimit && plan.importLimit < 1_000_000 ? `Up to ${plan.importLimit} free imports per month` : 'Free import allowance applies monthly'}`,
                      'Access to the public library',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 shrink-0 text-[#ddd6ff]" />
                        <span className="text-[#ddd6ff]">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/app/import')}
                    className="w-full h-9 rounded-[14px] bg-white text-[#7008e7] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-50"
                  >
                    <Zap className="w-4 h-4" />Import more content
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between text-xs text-[#6a7282] mb-1.5">
                  <span>AI lookups today</span>
                  <span>{lookupsToday}/{quota >= 1_000_000 ? '∞' : quota}</span>
                </div>
                <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                  <div className="h-full bg-[#8e51ff] transition-all" style={{ width: `${quota >= 1_000_000 ? 4 : usagePct}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Danger Zone">
        <Row label="Export my data" description="Download all your vocabulary and reading history">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportData()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </button>
        </Row>
        <Row label="Delete account" description="Permanently delete your account and all data">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[14px] border border-[#ffc9c9] bg-white text-sm font-medium text-[#e7000b] hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
        </Row>
      </Section>

      <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={28} />
          Signed in as{' '}
          <span className="font-medium text-gray-600 truncate max-w-[180px]">
            {user?.displayName ?? user?.email}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => { logout(); navigate('/login'); }}
          className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
