import { AiSwitch, aiSwitchText } from '../components/safety/AiSwitch';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BookOpen,
  Check,
  ChevronRight,
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
import { LanguageSearchInput } from '../components/LanguageSearchInput';
import { cn } from '../components/ui/utils';
import { api, clearTokens } from '../lib/api';
import { withAppBase } from '../lib/authRoutes';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { persistLearnerLocale } from '../lib/learnerLocale';
import type { UiLanguage } from '@gotcha/shared';
import { practiceCopyFor } from '@gotcha/shared';
import { applyAppTheme } from '../lib/appTheme';
import {
  CEFR_LEVELS,
  LANGUAGE_META,
  LIVE_LANGUAGES,
  UI_LANGUAGES,
  languageFlag,
  languageLabel,
  type AppLanguage,
  type CatalogLanguage,
  type CefrLevel,
  type SubscriptionInfo,
  type UserTargetLanguage,
} from '../lib/types';


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#f3f4f6] overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-[#f9fafb]">
        <h2 className="font-bold text-gray-900 text-xl">{title}</h2>
      </div>
      <div className="divide-y divide-[#f9fafb]">{children}</div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 min-w-0">
      <div className="min-w-0 sm:flex-1">
        <div className="text-sm font-medium text-[#364153]">{label}</div>
        {description && <div className="text-xs text-[#99a1af] mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <div className="min-w-0 w-full sm:w-auto sm:shrink-0 flex sm:justify-end">
        {children}
      </div>
    </div>
  );
}

function RangeSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="range-slider w-full sm:w-28 max-w-full"
      style={{ '--range-progress': `${pct}%` } as React.CSSProperties}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-8 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-g-blue-700' : 'bg-[#cbced4]')}
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
  const copy = useLearnerCopy();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(copy.settings.fillPasswordFields);
      return;
    }
    if (newPassword.length < 8) {
      toast.error(copy.settings.newPasswordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(copy.settings.passwordsMismatch);
      return;
    }
    setSaving(true);
    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success(copy.settings.passwordUpdated);
      onClose();
      // Backend revokes all refresh tokens on password change — force a fresh login.
      clearTokens();
      window.location.assign(withAppBase('/login'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.passwordChangeFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={copy.settings.changePassword} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">{copy.settings.currentPassword}</label>
          <input
            type={show ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">{copy.settings.newPassword}</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={copy.auth.passwordPlaceholderRegister}
              className="w-full h-9 pl-3 pr-9 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700"
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
          <label className="text-xs font-semibold text-[#4a5565]">{copy.settings.confirmPassword}</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="mt-1 h-9 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {copy.settings.updatePassword}
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
  const copy = useLearnerCopy();
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
    if (mode === 'add' && targetLanguage === nativeLanguage) {
      toast.error(copy.settings.targetSameAsNative);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'add') {
        await api('/users/me/target-languages', {
          method: 'POST',
          body: JSON.stringify({ targetLanguage, cefrLevel, isPrimary }),
        });
        toast.success(copy.settings.languageAdded);
      } else if (existing) {
        await api(`/users/me/target-languages/${existing.targetLanguage}`, {
          method: 'PATCH',
          body: JSON.stringify({ cefrLevel, isPrimary }),
        });
        toast.success(copy.settings.languageUpdated);
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.languageSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={mode === 'add' ? copy.settings.addTargetLanguage : copy.settings.editTargetLanguage} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">{copy.settings.languageLabel}</label>
          {mode === 'add' ? (
            <LanguageSearchInput
              options={available}
              value={targetLanguage ? [targetLanguage] : []}
              onChange={(codes) => setTargetLanguage(codes[0] ?? '')}
              multiple={false}
              placeholder={copy.auth.targetLanguagesPlaceholder}
            />
          ) : (
            <div className="h-9 px-3 flex items-center bg-gray-50 border border-[#e5e7eb] rounded-[14px] text-sm text-gray-600">
              {languageFlag(existing?.targetLanguage)} {languageLabel(existing?.targetLanguage)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a5565]">{copy.settings.cefrLevel}</label>
          <select
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
            className="w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700"
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
          {copy.settings.setPrimary}
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || (mode === 'add' && available.length === 0)}
          className="mt-1 h-9 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'add' ? copy.settings.addLanguage : copy.settings.saveLanguage}
        </button>
      </div>
    </ModalShell>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, preferences, updateProfile, updatePreferences, uploadAvatar, refreshProfile, logout } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const practiceCopy = useMemo(() => practiceCopyFor(locale), [locale]);

  const readerThemes = [
    { value: 'light' as const, label: copy.settings.themeLight, icon: Sun },
    { value: 'sepia' as const, label: copy.settings.themeSepia, icon: BookOpen },
    { value: 'dark' as const, label: copy.settings.themeDark, icon: Moon },
  ];

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [langModal, setLangModal] = useState<{ mode: 'add' | 'edit'; existing?: UserTargetLanguage } | null>(null);
  const [langBusy, setLangBusy] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage>(user?.nativeLanguage ?? 'en');
  const [uiLanguage, setUiLanguage] = useState<AppLanguage>(user?.uiLanguage ?? 'uz');
  const [avatarBusy, setAvatarBusy] = useState(false);

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
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setNativeLanguage(user.nativeLanguage ?? 'en');
      setUiLanguage(user.uiLanguage ?? 'uz');
    }
  }, [user]);

  useEffect(() => {
    api<CatalogLanguage[]>('/content/languages')
      .then(setCatalogLangs)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (preferences) {
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
          .filter(([code]) => (LIVE_LANGUAGES as readonly string[]).includes(code))
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
      // W-21a: the header/localStorage locale used to win over Settings (a second PATCH reverted it).
      // Persist the chosen UI language locally first so header, storage and server agree.
      if ((UI_LANGUAGES as readonly string[]).includes(uiLanguage)) persistLearnerLocale(uiLanguage as UiLanguage);
      await Promise.all([
        updateProfile({ displayName: displayName.trim() || undefined, nativeLanguage, uiLanguage }),
        updatePreferences({
          readerFontScale: fontScale,
          readerLineSpacing: lineSpacing,
          readerTheme: theme as 'light' | 'dark' | 'sepia',
          showKnownWords,
          ttsEnabled,
          notificationsEnabled,
        }),
      ]);
      await refreshProfile();
      toast.success(copy.settings.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const plan = subscription?.subscription?.plan;
  const quota = subscription?.usage.quota ?? plan?.aiDailyQuota ?? 50;
  const lookupsToday = subscription?.usage.lookupsToday ?? 0;
  const usagePct = quota > 0 && quota < 1_000_000 ? Math.min(100, Math.round((lookupsToday / quota) * 100)) : 0;
  const importAllowance = subscription?.usage.importAllowance;
  const targetLanguages = user?.targetLanguages ?? [];
  const visibleTargetLanguages = useMemo(
    () => targetLanguages.filter((tl) => tl.targetLanguage !== nativeLanguage),
    [targetLanguages, nativeLanguage],
  );

  const handleRemoveLanguage = async (lang: string) => {
    if (visibleTargetLanguages.length <= 1) {
      toast.error(copy.settings.keepOneTarget);
      return;
    }
    setLangBusy(lang);
    try {
      await api(`/users/me/target-languages/${lang}`, { method: 'DELETE' });
      await refreshProfile();
      toast.success(copy.settings.languageRemoved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.languageRemoveFailed);
    } finally {
      setLangBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 lg:py-8 space-y-5 min-w-0">
      {pwModalOpen && <ChangePasswordModal onClose={() => setPwModalOpen(false)} />}
      {langModal && (
        <TargetLanguageModal
          mode={langModal.mode}
          existing={langModal.existing}
          usedCodes={visibleTargetLanguages.map((tl) => tl.targetLanguage)}
          nativeLanguage={nativeLanguage}
          languageOptions={languageOptions}
          onClose={() => setLangModal(null)}
          onSaved={refreshProfile}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{copy.settings.title}</h1>
          <p className="text-[#99a1af] text-sm mt-0.5">{copy.settings.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving}
          className="h-9 px-4 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {copy.common.saveChanges}
        </button>
      </div>

      <Section title={copy.settings.account}>
        <Row label={copy.settings.photo} description={copy.settings.photoHint}>
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={48} />
            <label className="h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50 inline-flex items-center cursor-pointer shrink-0">
              {avatarBusy ? copy.settings.uploading : copy.settings.changePhoto}
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
                    .then(() => toast.success(copy.settings.photoUpdated))
                    .catch((err) => toast.error(err instanceof Error ? err.message : copy.settings.uploadFailed))
                    .finally(() => setAvatarBusy(false));
                }}
              />
            </label>
          </div>
        </Row>
        <Row label={copy.settings.displayName} description={copy.settings.displayNameHint}>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={copy.settings.displayNamePlaceholder}
            className="w-full sm:w-48 max-w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all"
          />
        </Row>
        <Row label={copy.settings.nativeLanguage} description={copy.settings.nativeLanguageHint}>
          <select
            value={nativeLanguage}
            onChange={(e) => setNativeLanguage(e.target.value as AppLanguage)}
            className="w-full sm:w-48 max-w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all"
          >
            {languageOptions.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flagEmoji} {l.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label={copy.settings.appLanguage} description={copy.settings.appLanguageHint}>
          <select
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as AppLanguage)}
            className="w-full sm:w-48 max-w-full h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all"
          >
            {UI_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_META[code].flag} {LANGUAGE_META[code].label}
              </option>
            ))}
          </select>
        </Row>
        <Row label={copy.settings.email} description={copy.settings.emailHint}>
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <span className="text-sm text-[#6a7282] truncate">{user?.email}</span>
            <span className="text-[11px] font-semibold text-[#007a55] bg-[#d0fae5] rounded-full px-1.5 py-0.5 shrink-0">{copy.common.verified}</span>
          </div>
        </Row>
        <Row label={copy.settings.password}>
          <button
            type="button"
            onClick={() => setPwModalOpen(true)}
            className="h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50 w-full sm:w-auto"
          >
            {copy.settings.changePassword}
          </button>
        </Row>
      </Section>

      <Section title={copy.settings.targetLanguages}>
        {visibleTargetLanguages.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400">
            {targetLanguages.some((tl) => tl.targetLanguage === nativeLanguage)
              ? copy.settings.nativeCannotBeTarget
              : copy.settings.noTargetLanguages}
          </div>
        ) : (
          visibleTargetLanguages.map((tl) => {
            const catalog = languageOptions.find((l) => l.code === tl.targetLanguage);
            return (
              <div key={tl.targetLanguage} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 min-w-0">
                <span className="text-xl leading-none">{catalog?.flagEmoji ?? languageFlag(tl.targetLanguage)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1e2939]">{catalog?.name ?? languageLabel(tl.targetLanguage)}</div>
                  <div className="text-xs text-[#99a1af] mt-0.5">
                    {copy.common.level(tl.cefrLevel)}
                    {tl.placementScore != null ? ` · ${copy.common.score(tl.placementScore)}` : ''}
                  </div>
                </div>
                {tl.isPrimary && (
                  <span className="text-[11px] font-semibold text-g-blue-700 bg-g-blue-50 rounded-full px-2 py-0.5 shrink-0">{copy.common.primary}</span>
                )}
                {visibleTargetLanguages.length > 1 && (
                  <button
                    type="button"
                    disabled={langBusy === tl.targetLanguage}
                    onClick={() => void handleRemoveLanguage(tl.targetLanguage)}
                    className="p-1.5 rounded-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 disabled:opacity-40"
                    title={copy.settings.removeLanguage}
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
            <Plus className="w-4 h-4" />{copy.settings.addLanguage}
          </button>
        </div>
      </Section>

      <Section title={copy.settings.readingPreferences}>
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-[#99a1af] uppercase tracking-[0.6px] mb-3">{copy.settings.preview}</div>
          <div
            className="font-serif text-[#1e2939] bg-white rounded-[14px] p-4"
            style={{ fontSize: `${14 * fontScale}px`, lineHeight: lineSpacing }}
          >
            The old lighthouse had stood on the cliff for more than a hundred years. Its white walls,{' '}
            <span className="border-b-[1.6px] border-dashed border-[#ffb900]">weathered</span> by salt and storm, rose{' '}
            <span className="border-b-[1.6px] border-[#51a2ff]">magnificently</span> against the grey winter sky.
          </div>
        </div>

        <Row label={copy.settings.fontSize} description={copy.settings.fontSizeHint(Math.round(fontScale * 100))}>
          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
            <span className="text-xs text-[#99a1af] shrink-0">A</span>
            <RangeSlider value={fontScale} min={0.8} max={1.6} step={0.05} onChange={setFontScale} />
            <span className="text-sm font-semibold text-[#0a0a0a] shrink-0">A</span>
          </div>
        </Row>
        <Row label={copy.settings.lineSpacing} description={copy.settings.lineSpacingHint(lineSpacing.toFixed(1))}>
          <RangeSlider value={lineSpacing} min={1} max={2.5} step={0.1} onChange={setLineSpacing} />
        </Row>
        <Row label={practiceCopy.appTheme}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={practiceCopy.appTheme}>
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={(preferences?.appTheme ?? 'system') === t}
                onClick={() => {
                  applyAppTheme(t);
                  void updatePreferences({ appTheme: t }).catch(() => undefined);
                }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border text-xs font-medium transition-all',
                  (preferences?.appTheme ?? 'system') === t ? 'border-g-blue-200 bg-g-blue-50 text-g-blue-700' : 'border-[#e5e7eb] text-[#4a5565] hover:border-gray-300',
                )}
              >
                {t === 'system' ? practiceCopy.themeSystem : t === 'light' ? practiceCopy.themeLight : practiceCopy.themeDark}
              </button>
            ))}
          </div>
        </Row>
        <Row label={copy.settings.readerTheme}>
          <div className="flex flex-wrap gap-2">
            {readerThemes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border text-xs font-medium transition-all',
                  theme === t.value ? 'border-g-blue-200 bg-g-blue-50 text-g-blue-700' : 'border-[#e5e7eb] text-[#6a7282] hover:border-gray-300',
                )}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label={copy.settings.showKnownWords} description={copy.settings.showKnownWordsHint}>
          <Toggle checked={showKnownWords} onChange={setShowKnownWords} />
        </Row>
        <Row label={copy.settings.tts} description={copy.settings.ttsHint}>
          <Toggle checked={ttsEnabled} onChange={setTtsEnabled} />
        </Row>
      </Section>

      <Section title={copy.settings.learningGoals}>
        <Row
          label={copy.settings.emailNotifications}
          description={copy.settings.emailNotificationsHint}
        >
          <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </Row>
      </Section>

      <Section title={aiSwitchText(user?.uiLanguage).title}>
        <AiSwitch lang={user?.uiLanguage} aiDisabled={(user as { aiDisabled?: boolean } | null)?.aiDisabled} aiDisabledBy={(user as { aiDisabledBy?: string | null } | null)?.aiDisabledBy} onChanged={refreshProfile} />
      </Section>

      <Section title={copy.settings.usageImports}>
        <div className="p-4 sm:p-5 min-w-0">
          {subLoading ? (
            <div className="h-20 flex items-center justify-center text-gray-400 text-sm">{copy.settings.loadingUsage}</div>
          ) : (
            <>
              {/* GOTCHA has no recurring subscription — every account gets a free daily/monthly
                  allowance, and imports beyond that are billed per-document via Atmos (see the
                  Import page). This card reports real usage, not a "plan" tier. */}
              <div
                className="rounded-[14px] p-4 sm:p-5 min-w-0"
                style={{ backgroundImage: 'linear-gradient(161deg, var(--g-blue-700) 0%, #432dd7 100%)' }}
              >
                <div className="rounded-[14px] text-white min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-g-blue-200">{copy.settings.freeAllowance}</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1">{copy.settings.payPerImport}</div>
                    </div>
                    <Zap className="w-6 h-6 text-white shrink-0" />
                  </div>
                  <div className="space-y-1.5 py-4">
                    {[
                      copy.settings.aiLookupsLine(lookupsToday, quota === 0 || quota >= 1_000_000 ? '∞' : String(quota)),
                      importAllowance
                        ? copy.settings.freeImportsLine(importAllowance.dailyFreeRemaining, importAllowance.dailyFreeImportsPerUser)
                        : plan?.importLimit && plan.importLimit < 1_000_000
                          ? copy.settings.importLimitLine(plan.importLimit)
                          : null,
                      importAllowance
                        ? copy.settings.freePagesLine(
                            importAllowance.monthlyPagesRemaining,
                            importAllowance.monthlyFreePageLimit,
                            importAllowance.resetCycle === 'daily'
                              ? copy.billing.today
                              : importAllowance.resetCycle === 'yearly'
                                ? copy.billing.thisYear
                                : copy.billing.thisMonth,
                          )
                        : null,
                      copy.settings.publicLibraryAccess,
                    ].filter(Boolean).map((f) => (
                      <div key={f as string} className="flex items-start gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 shrink-0 text-g-blue-200 mt-0.5" />
                        <span className="text-g-blue-200 break-words">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/app/import')}
                    className="w-full min-w-0 h-9 px-3 rounded-[14px] bg-white text-g-blue-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-50"
                  >
                    <Zap className="w-4 h-4 shrink-0" />{copy.settings.importMoreContent}
                  </button>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#6a7282] mb-1.5">
                    <span>{copy.settings.aiLookupsToday}</span>
                    <span>{lookupsToday}/{quota === 0 || quota >= 1_000_000 ? '∞' : quota}</span>
                  </div>
                  <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    <div className="h-full bg-g-blue-500 transition-all" style={{ width: `${quota === 0 || quota >= 1_000_000 ? 4 : usagePct}%` }} />
                  </div>
                </div>
                {importAllowance ? (
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#6a7282] mb-1.5">
                      <span>{copy.settings.freeImportsToday}</span>
                      <span>{importAllowance.dailyFreeUsed}/{importAllowance.dailyFreeImportsPerUser}</span>
                    </div>
                    <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-g-blue-700 transition-all"
                        style={{
                          width: `${
                            importAllowance.dailyFreeImportsPerUser > 0
                              ? Math.min(100, Math.round((importAllowance.dailyFreeUsed / importAllowance.dailyFreeImportsPerUser) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Section>

      <div className="bg-white rounded-2xl border border-[#f3f4f6] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
          <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={28} />
          <span className="min-w-0 truncate">
            {copy.settings.signedInAs}{' '}
            <span className="font-medium text-gray-600">
              {user?.displayName ?? user?.email}
            </span>
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => { logout(); navigate('/login'); }}
          className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 gap-2 w-full sm:w-auto shrink-0"
        >
          <LogOut className="w-4 h-4" />
          {copy.settings.signOut}
        </Button>
      </div>
    </div>
  );
}
