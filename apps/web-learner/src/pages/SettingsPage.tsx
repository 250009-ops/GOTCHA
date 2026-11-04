import { AiSwitch } from '../components/safety/AiSwitch';
import { buildLabel } from '../lib/buildInfo';
import { DeleteAccount } from '../components/safety/DeleteAccount';
import { AVATAR_UNDER13_NOTE, isUnder13 } from '../lib/agePolicy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Receipt,
  Search,
  Shield,
  Sun,
  Target,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { UserAvatar } from '../components/UserAvatar';
import { LanguageSearchInput } from '../components/LanguageSearchInput';
import { CatalogLanguageFlag } from '../components/CatalogLanguageFlag';
import { cn } from '../components/ui/utils';
import { api, clearTokens } from '../lib/api';
import { withAppBase } from '../lib/authRoutes';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import type { UiLanguage } from '@gotcha/shared';
import { READING_PREVIEW, payCopyFor, plusFill, practiceCopyFor, LIMIT_COPY, languageUiName, limitLang, nextTashkentMonthStart, tashkentDate } from '@gotcha/shared';
import { usePaymentsEnabled } from '../lib/limits';
import { applyAppTheme } from '../lib/appTheme';
import {
  CEFR_LEVELS,
  LANGUAGE_META,
  LIVE_LANGUAGES,
  UI_LANGUAGES,
  languageLabel,
  type AppLanguage,
  type CatalogLanguage,
  type CefrLevel,
  type SubscriptionInfo,
  type UserPreferences,
  type UserTargetLanguage,
} from '../lib/types';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX = 2 * 1024 * 1024;
const MINUTE_CHOICES = [5, 10, 15, 20, 30, 45, 60];

function nearestChoice(value: number, choices: readonly number[]): number {
  return choices.reduce((best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best), choices[0]);
}

function Stepper({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; label: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="inline-flex items-stretch rounded-[11px] border border-[#e1e3ec] bg-white overflow-hidden" role="group" aria-label={label}>
      <button type="button" className="min-h-10 min-w-10 text-lg font-semibold text-[#4a5565] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-g-blue-700 disabled:opacity-40" aria-label={`${label} −`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>−</button>
      <span className="min-w-14 grid place-items-center border-x border-[#eceef4] text-sm font-bold tabular-nums text-[#101828]">{value}</span>
      <button type="button" className="min-h-10 min-w-10 text-lg font-semibold text-[#4a5565] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-g-blue-700 disabled:opacity-40" aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}
const DISPLAY_NAME_RE = /^(?!.*(?:https?:\/\/|www\.))[^\u0000-\u001F\u007F\u2028\u2029]*$/u;

const fieldClass = 'w-full h-10 px-3 bg-[#f9faff] border border-[#e4e7f0] rounded-[11px] text-sm text-[#101828] outline-none focus:ring-4 focus:ring-g-blue-50 focus:border-g-blue-600';

function displayNameError(value: string, tooLong: string, invalid: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > 50) return tooLong;
  if (trimmed && !DISPLAY_NAME_RE.test(trimmed)) return invalid;
  return null;
}

function tashkentDaysLeft(iso: string): number {
  const off = 5 * 3_600_000;
  const end = new Date(new Date(iso).getTime() + off);
  const now = new Date(Date.now() + off);
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((endDay - nowDay) / 86_400_000));
}

function isPlusActive(sub: SubscriptionInfo['subscription']): boolean {
  if (!sub) return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.plan?.tier && sub.plan.tier !== 'premium') return false;
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() <= Date.now()) return false;
  return true;
}

type SectionId = 'account' | 'plan' | 'languages' | 'reading' | 'goals' | 'notifications' | 'privacy' | 'danger';

function Section({ id, title, icon: Icon, action, children, danger }: {
  id: SectionId; title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <section
      id={id}
      data-settings-section={id}
      aria-labelledby={`settings-${id}-title`}
      className={cn('bg-white rounded-2xl border overflow-hidden scroll-mt-24 shadow-[0_1px_2px_rgba(16,24,40,0.04)]', danger ? 'border-red-200' : 'border-[#e9ebf3]')}
    >
      <div className={cn('flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b', danger ? 'border-red-100' : 'border-[#f0f1f6]')}>
        <span className={cn('size-8 rounded-[9px] grid place-items-center shrink-0', danger ? 'bg-red-50 text-red-600' : 'bg-g-blue-50 text-g-blue-700')}>
          <Icon className="w-4 h-4" />
        </span>
        <h2 id={`settings-${id}-title`} className="flex-1 min-w-0 font-bold text-[#101828] text-base truncate">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-[#f0f1f6]">{children}</div>
    </section>
  );
}

const RowLabel = createContext<string | undefined>(undefined);

function Row({ label, description, children, stack }: { label: string; description?: string; children: React.ReactNode; stack?: boolean }) {
  return (
    <RowLabel.Provider value={label}>
    <div className={cn('flex flex-col gap-2.5 px-4 sm:px-5 py-3.5 min-w-0 min-h-[60px]', !stack && 'sm:flex-row sm:items-center sm:gap-4')}>
      <div className={cn('min-w-0', !stack && 'sm:flex-1')}>
        <div className="text-sm font-semibold text-[#101828]">{label}</div>
        {description && <div className="text-[12.5px] text-[#6b7080] mt-0.5 leading-snug">{description}</div>}
      </div>
      <div className={cn('min-w-0 w-full flex', !stack && 'sm:w-auto sm:shrink-0 sm:justify-end')}>
        {children}
      </div>
    </div>
    </RowLabel.Provider>
  );
}

/** Two short rows side by side from sm up (stacked on phones). */
function RowPair({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#f0f1f6]">{children}</div>;
}

function RangeSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  const label = useContext(RowLabel);
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="range-slider w-full sm:w-40 max-w-full min-h-11"
      style={{ '--range-progress': `${pct}%` } as React.CSSProperties}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const label = useContext(RowLabel);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-11 w-12 shrink-0 items-center justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-700 rounded-full"
    >
      <span className={cn('relative inline-flex h-6 w-[42px] items-center rounded-full transition-colors', checked ? 'bg-g-blue-700' : 'bg-[#d8dbe5]')}>
        <span className={cn('inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[21px]' : 'translate-x-[3px]')} />
      </span>
    </button>
  );
}

/** Segmented control: one rounded track, the selected option is a raised white chip. */
function Segmented({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('bg-[#f1f2f7] rounded-[11px] p-[3px] gap-0.5 max-w-full overflow-x-auto', full ? 'flex w-full' : 'inline-flex')}>
      {children}
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex-1 min-h-10 min-w-10 px-3 rounded-[9px] text-[13px] font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-700',
        selected ? 'bg-white text-g-blue-700 shadow-[0_1px_2px_rgba(16,24,40,0.12)]' : 'text-[#4a5565] hover:text-[#101828]',
      )}
    >
      {children}
    </button>
  );
}

/** Usage meter: the existing localized line, plus a bar for how much of today's allowance is used. */
function Meter({ icon: Icon, text, used, total, tone = 'blue' }: { icon: React.ElementType; text: string; used?: number; total?: number; tone?: 'blue' | 'teal' }) {
  const pct = typeof used === 'number' && typeof total === 'number' && total > 0 ? Math.min(100, Math.round((used / total) * 100)) : null;
  return (
    <div className="rounded-xl border border-[#eceef5] px-3.5 py-3 min-w-0">
      <div className="flex items-start gap-2.5">
        <span className={cn('size-7 rounded-[8px] grid place-items-center shrink-0', tone === 'teal' ? 'bg-[#ecfeff] text-[#0e7490]' : 'bg-g-blue-50 text-g-blue-700')}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[13px] font-medium text-[#101828] leading-snug break-words min-w-0 pt-1">{text}</span>
      </div>
      {pct !== null && (
        <div className={cn('h-1.5 rounded-full mt-2.5 overflow-hidden', tone === 'teal' ? 'bg-[#e3f8fb]' : 'bg-g-blue-50')}>
          <div className={cn('h-full rounded-full transition-all', tone === 'teal' ? 'bg-[#0e7490]' : 'bg-g-blue-700')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

const btnOutline = 'min-h-10 px-3.5 rounded-[11px] border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50 inline-flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-700';
const btnPrimary = 'min-h-10 px-3.5 rounded-[11px] bg-g-blue-700 text-g-on-cta text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-700 focus-visible:ring-offset-2';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const copy = useLearnerCopy();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentError, setCurrentError] = useState('');
  const [formError, setFormError] = useState('');

  const submit = async () => {
    setCurrentError('');
    setFormError('');
    if (!currentPassword || !newPassword) {
      setFormError(copy.settings.fillPasswordFields);
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setFormError(copy.settings.newPasswordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(copy.settings.passwordsMismatch);
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
      clearTokens();
      window.location.assign(withAppBase('/login'));
    } catch (e) {
      const status = (e as { status?: number }).status;
      const message = e instanceof Error ? e.message : copy.settings.passwordChangeFailed;
      if (status === 401) setCurrentError(message);
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={copy.settings.changePassword} closeLabel={copy.settings.close} onOpenChange={(open) => { if (!open) onClose(); }}>
      <form className="flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-current-password" className="text-xs font-semibold text-[#4a5565]">{copy.settings.currentPassword}</label>
          <input
            id="settings-current-password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={currentPassword}
            aria-invalid={currentError ? true : undefined}
            aria-describedby={currentError ? 'settings-current-password-error' : undefined}
            onChange={(e) => { setCurrentPassword(e.target.value); setCurrentError(''); }}
            className={fieldClass}
          />
          {currentError && <p id="settings-current-password-error" className="text-xs text-red-600">{currentError}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-new-password" className="text-xs font-semibold text-[#4a5565]">{copy.settings.newPassword}</label>
          <div className="relative">
            <input
              id="settings-new-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              maxLength={128}
              value={newPassword}
              aria-describedby="settings-password-rules"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={copy.auth.passwordPlaceholderRegister}
              className={cn(fieldClass, 'pr-12')}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? copy.settings.hidePassword : copy.settings.showPassword}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p id="settings-password-rules" className="text-xs text-[#99a1af]">{copy.settings.passwordRules}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-confirm-password" className="text-xs font-semibold text-[#4a5565]">{copy.settings.confirmPassword}</label>
          <input
            id="settings-confirm-password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={128}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        {formError && <p className="text-xs text-red-600" role="alert">{formError}</p>}
        <button
          type="submit"
          disabled={saving}
          className="mt-1 min-h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-60 text-g-on-cta text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {copy.settings.updatePassword}
        </button>
      </form>
    </Dialog>
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
  const { locale } = useLearnerLocale();
  const available = languageOptions.filter(
    (l) => l.code !== nativeLanguage && (mode === 'edit' || !usedCodes.includes(l.code)),
  );
  const [targetLanguage, setTargetLanguage] = useState<string>(
    existing?.targetLanguage ?? available[0]?.code ?? 'en',
  );
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(existing?.cefrLevel ?? 'a1');
  const [isPrimary, setIsPrimary] = useState(existing?.isPrimary ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (mode === 'add' && targetLanguage === nativeLanguage) {
      setError(copy.settings.targetSameAsNative);
      return;
    }
    setSaving(true);
    setError('');
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
      setError(e instanceof Error ? e.message : copy.settings.languageSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={mode === 'add' ? copy.settings.addTargetLanguage : copy.settings.editTargetLanguage}
      closeLabel={copy.settings.close}
      onOpenChange={(next) => { if (!next) onClose(); }}
    >
      <form className="flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-target-language" className="text-xs font-semibold text-[#4a5565]">{copy.settings.languageLabel}</label>
          {mode === 'add' ? (
            <LanguageSearchInput
              options={available}
              value={targetLanguage ? [targetLanguage] : []}
              onChange={(codes) => setTargetLanguage(codes[0] ?? '')}
              multiple={false}
              placeholder={copy.auth.targetLanguagesPlaceholder}
            />
          ) : (
            <div id="settings-target-language" className="h-11 px-3 flex items-center gap-2 bg-gray-50 border border-[#e5e7eb] rounded-[14px] text-sm text-gray-600">
              <CatalogLanguageFlag code={existing?.targetLanguage ?? ''} /> {languageUiName(existing?.targetLanguage, locale)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-cefr" className="text-xs font-semibold text-[#4a5565]">{copy.settings.cefrLevel}</label>
          <select
            id="settings-cefr"
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
            className={fieldClass}
          >
            {CEFR_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-[#364153] cursor-pointer min-h-11">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="mt-1 rounded" />
          <span>
            {copy.settings.setPrimary}
            <span className="block text-xs text-[#99a1af] mt-0.5">{copy.settings.primaryHint}</span>
          </span>
        </label>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={saving || (mode === 'add' && available.length === 0)}
          className="mt-1 min-h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-60 text-g-on-cta text-sm font-semibold flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'add' ? copy.settings.addLanguage : copy.settings.saveLanguage}
        </button>
      </form>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  closeLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open title={title} closeLabel={closeLabel} onOpenChange={(next) => { if (!next) onClose(); }}>
      <form className="p-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
        <p className="text-sm text-[#364153] leading-relaxed">{body}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-[14px] border border-[#e5e7eb] text-sm font-medium text-[#364153]">
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={cn('min-h-11 px-4 rounded-[14px] text-sm font-semibold text-white', danger ? 'bg-red-600' : 'bg-g-blue-700')}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, preferences, updateProfile, updatePreferences, uploadAvatar, refreshProfile, logout } = useAuth();
  const copy = useLearnerCopy();
  const { locale, setLocale } = useLearnerLocale();
  const practiceCopy = useMemo(() => practiceCopyFor(locale), [locale]);
  const payments = usePaymentsEnabled();

  const readerThemes = [
    { value: 'light' as const, label: copy.settings.themeLight, icon: Sun },
    { value: 'sepia' as const, label: copy.settings.themeSepia, icon: BookOpen },
    { value: 'dark' as const, label: copy.settings.themeDark, icon: Moon },
  ];

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [langModal, setLangModal] = useState<{ mode: 'add' | 'edit'; existing?: UserTargetLanguage } | null>(null);
  const [langBusy, setLangBusy] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [pendingNative, setPendingNative] = useState<AppLanguage | null>(null);
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage>(user?.nativeLanguage ?? 'en');
  const [birthYearDraft, setBirthYearDraft] = useState('');
  const [birthYearSaving, setBirthYearSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<'upload' | 'remove' | null>(null);
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [exporting, setExporting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [fontScale, setFontScale] = useState(preferences?.readerFontScale ?? 1);
  const [lineSpacing, setLineSpacing] = useState(preferences?.readerLineSpacing ?? 1.5);
  const [theme, setTheme] = useState(preferences?.readerTheme ?? 'light');
  const [appTheme, setAppTheme] = useState<'system' | 'light'>(preferences?.appTheme === 'light' ? 'light' : 'system');
  const [showKnownWords, setShowKnownWords] = useState(preferences?.showKnownWords ?? false);
  const [ttsEnabled, setTtsEnabled] = useState(preferences?.ttsEnabled ?? true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(preferences?.notificationsEnabled ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(preferences?.showOnlineStatus ?? false);
  const [dailyGoal, setDailyGoal] = useState(preferences?.dailyGoalMinutes ?? 15);
  const [dailyGoalXp, setDailyGoalXp] = useState(preferences?.dailyGoalXp ?? 60);
  const [dailyNewWords, setDailyNewWords] = useState(preferences?.dailyNewWords ?? 10);
  const [prefStatus, setPrefStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [catalogLangs, setCatalogLangs] = useState<CatalogLanguage[]>([]);

  const pendingPref = useRef<Partial<UserPreferences>>({});
  const prefTimer = useRef<number | null>(null);
  const prefInFlight = useRef(false);
  const updatePreferencesRef = useRef(updatePreferences);
  updatePreferencesRef.current = updatePreferences;

  const flushPref = useCallback(async () => {
    if (prefInFlight.current) return;
    const patch = pendingPref.current;
    if (!Object.keys(patch).length) return;
    pendingPref.current = {};
    prefInFlight.current = true;
    setPrefStatus('saving');
    try {
      await updatePreferencesRef.current(patch);
      setPrefStatus('saved');
    } catch (e) {
      pendingPref.current = { ...patch, ...pendingPref.current };
      setPrefStatus('error');
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
      prefInFlight.current = false;
      return;
    }
    prefInFlight.current = false;
    if (Object.keys(pendingPref.current).length) void flushPref();
  }, [copy.settings.saveFailed]);

  const queuePref = useCallback((patch: Partial<UserPreferences>, delay = 400) => {
    pendingPref.current = { ...pendingPref.current, ...patch };
    if (prefTimer.current) window.clearTimeout(prefTimer.current);
    prefTimer.current = window.setTimeout(() => { void flushPref(); }, delay);
  }, [flushPref]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!user) return;
    setNativeLanguage(user.nativeLanguage ?? 'en');
    setDisplayName((current) => (document.activeElement?.id === 'settings-display-name' ? current : (user.displayName ?? '')));
  }, [user]);

  useEffect(() => {
    api<CatalogLanguage[]>('/content/languages')
      .then(setCatalogLangs)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!preferences || Object.keys(pendingPref.current).length || prefInFlight.current) return;
    setFontScale(preferences.readerFontScale ?? 1);
    setLineSpacing(preferences.readerLineSpacing ?? 1.5);
    setTheme(preferences.readerTheme ?? 'light');
    setAppTheme(preferences.appTheme === 'light' ? 'light' : 'system');
    setShowKnownWords(preferences.showKnownWords ?? false);
    setTtsEnabled(preferences.ttsEnabled ?? true);
    setNotificationsEnabled(preferences.notificationsEnabled ?? true);
    setShowOnlineStatus(preferences.showOnlineStatus ?? false);
    const minutes = preferences.dailyGoalMinutes ?? 15;
    const snapped = (MINUTE_CHOICES as readonly number[]).includes(minutes) ? minutes : nearestChoice(minutes, MINUTE_CHOICES);
    setDailyGoal(snapped);
    const xp = preferences.dailyGoalXp ?? 60;
    const xpClamped = Math.min(500, Math.max(10, xp));
    setDailyGoalXp(xpClamped);
    const words = preferences.dailyNewWords ?? 10;
    const wordsClamped = Math.min(50, Math.max(0, words));
    setDailyNewWords(wordsClamped);
    const patch: Partial<UserPreferences> = {};
    if (snapped !== minutes) patch.dailyGoalMinutes = snapped;
    if (xpClamped !== xp) patch.dailyGoalXp = xpClamped;
    if (wordsClamped !== words) patch.dailyNewWords = wordsClamped;
    if (Object.keys(patch).length) queuePref(patch);
  }, [preferences]);

  useEffect(() => {
    if (preferences?.appTheme !== 'dark') return;
    applyAppTheme('system');
    setAppTheme('system');
    queuePref({ appTheme: 'system' }, 0);
  }, [preferences?.appTheme, queuePref]);

  useEffect(() => {
    api<SubscriptionInfo>('/billing/subscription')
      .then(setSubscription)
      .catch(() => undefined)
      .finally(() => setSubLoading(false));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (prefStatus !== 'saved') return;
    const id = window.setTimeout(() => setPrefStatus('idle'), 2000);
    return () => window.clearTimeout(id);
  }, [prefStatus]);

  const nameDirty = displayName.trim() !== (user?.displayName ?? '').trim();
  useEffect(() => {
    if (!nameDirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      if (!window.confirm(copy.settings.unsavedLeave)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBefore);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBefore);
      document.removeEventListener('click', onClick, true);
    };
  }, [nameDirty, copy.settings.unsavedLeave]);

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

  const nameProblem = displayNameError(displayName, copy.settings.displayNameTooLong, copy.settings.displayNameInvalid);

  const saveName = async () => {
    if (nameProblem) return;
    setNameStatus('saving');
    try {
      await updateProfile({ displayName: displayName.trim() });
      await refreshProfile();
      setNameStatus('saved');
      toast.success(copy.settings.saved);
    } catch (e) {
      setNameStatus('error');
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    }
  };

  const plan = subscription?.subscription?.plan;
  const sub = subscription?.subscription ?? null;
  const plusActive = isPlusActive(sub);
  const plusExpired = !!sub && !plusActive;
  const plusLabel = plan?.name || copy.settings.plusName;
  const periodEnd = sub?.currentPeriodEnd ?? null;
  const rawQuota = subscription ? subscription.usage.quota : (plan?.aiDailyQuota ?? null);
  const quota = typeof rawQuota === 'number' && rawQuota > 0 ? rawQuota : null;
  const lookupsToday = subscription?.usage.lookupsToday ?? 0;
  const importAllowance = subscription?.usage.importAllowance;
  const limitCopy = LIMIT_COPY[limitLang(locale)];
  const targetLanguages = user?.targetLanguages ?? [];
  const visibleTargetLanguages = useMemo(
    () => targetLanguages.filter((tl) => tl.targetLanguage !== nativeLanguage),
    [targetLanguages, nativeLanguage],
  );
  const primaryTarget = visibleTargetLanguages.find((tl) => tl.isPrimary)?.targetLanguage ?? visibleTargetLanguages[0]?.targetLanguage;
  const previewKey = primaryTarget === 'ru' || primaryTarget === 'uz' || primaryTarget === 'en'
    ? primaryTarget
    : (locale === 'ru' || locale === 'uz' ? locale : 'en');
  const preview = READING_PREVIEW[previewKey];
  const minuteChoices = MINUTE_CHOICES;
  const verified = Boolean(user?.emailVerifiedAt);
  const removeName = languageOptions.find((l) => l.code === pendingRemove)?.name ?? (pendingRemove ? languageLabel(pendingRemove) : '');

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
      setPendingRemove(null);
    }
  };

  const confirmNative = async () => {
    const next = pendingNative;
    setPendingNative(null);
    if (!next) return;
    setNativeLanguage(next);
    try {
      await updateProfile({ nativeLanguage: next });
      await refreshProfile();
      toast.success(copy.settings.saved);
    } catch (e) {
      setNativeLanguage(user?.nativeLanguage ?? 'en');
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    }
  };

  const downloadData = async () => {
    setExporting(true);
    try {
      const data = await api<unknown>('/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gotcha-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    } finally {
      setExporting(false);
    }
  };

  const resendVerification = async () => {
    if (!user?.email || resendIn > 0) return;
    try {
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, clientPlatform: 'web' }),
      });
      toast.success(copy.settings.resendSent);
      setResendIn(60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    }
  };

  const signOutEverywhere = async () => {
    setSignOutAllOpen(false);
    try {
      await api('/auth/logout-all', { method: 'POST' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.settings.saveFailed);
    }
    logout();
    navigate('/login');
  };

  const onPhoto = (file: File) => {
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error(copy.settings.photoWrongType);
      return;
    }
    if (file.size > PHOTO_MAX) {
      toast.error(copy.settings.photoTooBig);
      return;
    }
    setAvatarBusy('upload');
    void uploadAvatar(file)
      .then(() => toast.success(copy.settings.photoUpdated))
      .catch((err) => toast.error(err instanceof Error ? err.message : copy.settings.uploadFailed))
      .finally(() => setAvatarBusy(null));
  };

  const removePhoto = () => {
    setAvatarBusy('remove');
    void api('/users/me/avatar', { method: 'DELETE' })
      .then(() => refreshProfile())
      .then(() => toast.success(copy.settings.photoRemoved))
      .catch((err) => toast.error(err instanceof Error ? err.message : copy.settings.uploadFailed))
      .finally(() => setAvatarBusy(null));
  };

  const [activeSection, setActiveSection] = useState<SectionId>('account');
  const { hash } = useLocation();
  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [hash, subLoading]);
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-settings-section]'));
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActiveSection(top.target.getAttribute('data-settings-section') as SectionId);
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [subLoading]);
  const jumpTo = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const sections: Array<{ id: SectionId; label: string; icon: React.ElementType }> = [
    { id: 'account', label: copy.settings.account, icon: User },
    { id: 'plan', label: copy.settings.planAndUsage, icon: Zap },
    { id: 'languages', label: copy.settings.targetLanguages, icon: Globe },
    { id: 'reading', label: copy.settings.readingPreferences, icon: BookOpen },
    { id: 'goals', label: copy.settings.learningGoals, icon: Target },
    { id: 'notifications', label: copy.settings.notifications, icon: Bell },
    { id: 'privacy', label: copy.settings.privacyAi, icon: Shield },
    { id: 'danger', label: copy.settings.dangerZone, icon: AlertTriangle },
  ];
  const onlineLabel = locale === 'ru' ? 'Показывать, что я в сети' : locale === 'en' ? 'Show when I am online' : 'Onlayn ekanimni koʻrsatish';
  const onlineHint = locale === 'ru' ? 'Скрыто, пока вы не включите. Для младше 18 по умолчанию выключено.' : locale === 'en' ? 'Hidden until you turn this on. Off by default for under-18 accounts.' : 'Yoqmaguningizcha yashirin. 18 yoshgacha sukut boʻyicha oʻchiq.';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 lg:py-8 min-w-0">
      {pwModalOpen && <ChangePasswordModal onClose={() => setPwModalOpen(false)} />}
      {langModal && (
        <TargetLanguageModal
          mode={langModal.mode}
          existing={langModal.existing}
          usedCodes={visibleTargetLanguages.map((tl) => tl.targetLanguage)}
          nativeLanguage={nativeLanguage}
          languageOptions={languageOptions.map((l) => ({ ...l, name: languageUiName(l.code, locale) }))}
          onClose={() => setLangModal(null)}
          onSaved={refreshProfile}
        />
      )}
      {pendingRemove && (
        <ConfirmDialog
          title={copy.settings.removeLanguageTitle}
          body={copy.settings.removeLanguageBody(removeName)}
          confirmLabel={copy.settings.removeLanguage}
          cancelLabel={copy.common.cancel}
          closeLabel={copy.settings.close}
          danger
          onClose={() => setPendingRemove(null)}
          onConfirm={() => { void handleRemoveLanguage(pendingRemove); }}
        />
      )}
      {pendingNative && (
        <ConfirmDialog
          title={copy.settings.nativeChangeTitle}
          body={copy.settings.nativeChangeBody}
          confirmLabel={copy.settings.confirm}
          cancelLabel={copy.common.cancel}
          closeLabel={copy.settings.close}
          onClose={() => setPendingNative(null)}
          onConfirm={() => { void confirmNative(); }}
        />
      )}
      {signOutAllOpen && (
        <ConfirmDialog
          title={copy.settings.signOutAll}
          body={copy.settings.signOutAllBody}
          confirmLabel={copy.settings.signOutAll}
          cancelLabel={copy.common.cancel}
          closeLabel={copy.settings.close}
          danger
          onClose={() => setSignOutAllOpen(false)}
          onConfirm={() => { void signOutEverywhere(); }}
        />
      )}

      <div className="min-w-0 mb-4 lg:mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#101828]">{copy.settings.title}</h1>
        <p className="text-[#6b7080] text-sm mt-0.5">{copy.settings.subtitle}</p>
      </div>

      {/* Below lg: section shortcuts as a sticky, horizontally scrollable chip row (web pattern, no app tab bar). */}
      <nav aria-label={copy.settings.title} className="lg:hidden sticky top-0 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 mb-3 bg-g-blue-50/95 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => jumpTo(sec.id)}
              aria-current={activeSection === sec.id ? 'true' : undefined}
              className={cn(
                'shrink-0 min-h-9 px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap',
                activeSection === sec.id
                  ? 'bg-g-blue-700 border-g-blue-700 text-g-on-cta'
                  : sec.id === 'danger' ? 'bg-white border-[#e3e5ee] text-red-600' : 'bg-white border-[#e3e5ee] text-[#4a5565]',
              )}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7 min-w-0">
        <nav aria-label={copy.settings.title} className="hidden lg:flex flex-col gap-0.5 sticky top-4 self-start">
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => jumpTo(sec.id)}
              aria-current={activeSection === sec.id ? 'true' : undefined}
              className={cn(
                'flex items-center gap-2.5 min-h-10 px-3 rounded-[10px] text-sm text-left transition-colors',
                activeSection === sec.id
                  ? 'bg-white text-g-blue-700 font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-g-blue-100'
                  : sec.id === 'danger' ? 'text-red-600 font-medium hover:bg-white/70' : 'text-[#4a5565] font-medium hover:bg-white/70',
              )}
            >
              <sec.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{sec.label}</span>
            </button>
          ))}
        </nav>

        <div className="space-y-4 min-w-0">
          <Section id="account" title={copy.settings.account} icon={User}>
            <RowLabel.Provider value={copy.settings.photo}>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 min-w-0">
                <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={52} />
                <div className="min-w-0 flex-1 basis-48">
                  <div className="text-base font-bold text-[#101828] truncate">{user?.displayName || user?.email}</div>
                  <div className="text-[12.5px] text-[#6b7080] mt-0.5 leading-snug">{copy.settings.photoHint}</div>
                </div>
                {isUnder13(user) ? (
                  <span className="text-xs text-[#6b7382]" data-testid="avatar-under13">{AVATAR_UNDER13_NOTE[locale === 'ru' || locale === 'uz' ? locale : 'en']}</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={cn(btnOutline, 'cursor-pointer shrink-0')}>
                      <Camera className="w-4 h-4" />
                      {avatarBusy === 'upload' ? copy.settings.uploading : copy.settings.changePhoto}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={avatarBusy !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) onPhoto(file);
                        }}
                      />
                    </label>
                    {user?.avatarUrl && (
                      <button
                        type="button"
                        disabled={avatarBusy !== null}
                        onClick={removePhoto}
                        className="min-h-10 px-3 rounded-[11px] text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {avatarBusy === 'remove' ? copy.settings.removingPhoto : copy.settings.removePhoto}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </RowLabel.Provider>
            <Row label={copy.settings.displayName} description={copy.settings.displayNameHint}>
              <form className="flex flex-col gap-1 w-full sm:w-auto" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-none min-w-0">
                    <input
                      type="text"
                      value={displayName}
                      maxLength={50}
                      id="settings-display-name"
                      aria-label={copy.settings.displayName}
                      aria-invalid={nameProblem ? true : undefined}
                      onChange={(e) => { setDisplayName(e.target.value); setNameStatus('idle'); }}
                      placeholder={copy.settings.displayNamePlaceholder}
                      className={cn(fieldClass, 'sm:w-64 pr-14')}
                    />
                    <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums pointer-events-none', nameProblem ? 'text-red-600' : 'text-[#9aa0ae]')}>
                      {displayName.trim().length}/50
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={!nameDirty || !!nameProblem || nameStatus === 'saving'}
                    className={cn(btnPrimary, 'shrink-0')}
                  >
                    {nameStatus === 'saving' ? copy.common.saving : copy.common.saveChanges}
                  </button>
                </div>
                {nameProblem && <span className="text-xs text-red-600">{nameProblem}</span>}
              </form>
            </Row>
            <RowPair>
              <Row label={copy.settings.nativeLanguage} description={copy.settings.nativeLanguageHint}>
                <div className="relative w-full sm:w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><CatalogLanguageFlag code={nativeLanguage} /></span>
                  <select
                    aria-label={copy.settings.nativeLanguage}
                    value={nativeLanguage}
                    onChange={(e) => {
                      const next = e.target.value as AppLanguage;
                      if (next === (user?.nativeLanguage ?? nativeLanguage)) return;
                      setPendingNative(next);
                    }}
                    className={cn(fieldClass, 'pl-10 bg-white')}
                  >
                    {languageOptions.map((l) => (
                      <option key={l.code} value={l.code}>
                        {(l as { nativeName?: string }).nativeName || l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </Row>
              <Row label={copy.settings.appLanguage} description={copy.settings.appLanguageHint}>
                <select
                  aria-label={copy.settings.appLanguage}
                  value={locale}
                  onChange={(e) => {
                    const next = e.target.value as UiLanguage;
                    void setLocale(next)
                      .then(() => toast.success(copy.settings.saved))
                      .catch((err) => toast.error(err instanceof Error ? err.message : copy.settings.saveFailed));
                  }}
                  className={cn(fieldClass, 'sm:w-48 bg-white')}
                >
                  {UI_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_META[code].nativeName}
                    </option>
                  ))}
                </select>
              </Row>
            </RowPair>
            <RowPair>
              <Row label={copy.settings.birthYear} description={user?.birthYear != null ? copy.settings.birthYearLocked : copy.settings.birthYearHint}>
                {user?.birthYear != null ? (
                  <span id="birth-year" className="inline-flex items-center gap-2 min-h-9 px-3 rounded-[9px] bg-[#f4f5f9] text-sm font-semibold text-[#4a5565] tabular-nums">
                    <Lock className="w-3.5 h-3.5 text-[#9aa0ae]" />{user.birthYear}
                  </span>
                ) : (
                  <form
                    id="birth-year"
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const year = Number(birthYearDraft);
                      if (!Number.isInteger(year)) return;
                      setBirthYearSaving(true);
                      void api('/users/me/age', { method: 'POST', body: JSON.stringify({ birthYear: year }) })
                        .then(() => refreshProfile())
                        .then(() => toast.success(copy.settings.saved))
                        .catch((err) => toast.error(err instanceof Error ? err.message : copy.settings.saveFailed))
                        .finally(() => setBirthYearSaving(false));
                    }}
                  >
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={birthYearDraft}
                      onChange={(e) => setBirthYearDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      aria-label={copy.settings.birthYear}
                      className={cn(fieldClass, 'w-24')}
                    />
                    <button type="submit" disabled={birthYearDraft.length !== 4 || birthYearSaving} className={btnPrimary}>
                      {birthYearSaving ? copy.common.saving : copy.common.saveChanges}
                    </button>
                  </form>
                )}
              </Row>
              <Row label={copy.settings.password}>
                <button type="button" onClick={() => setPwModalOpen(true)} className={cn(btnOutline, 'w-full sm:w-auto')}>
                  <Pencil className="w-4 h-4" />{copy.settings.changePassword}
                </button>
              </Row>
            </RowPair>
            <Row label={copy.settings.email} description={copy.settings.emailHint}>
              <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full sm:justify-end">
                <span className="text-sm text-[#4a5565] truncate min-w-0">{user?.email}</span>
                {user && (verified ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#047857] bg-[#ecfdf5] rounded-[7px] px-2 py-0.5 shrink-0"><Check className="w-3 h-3" />{copy.common.verified}</span>
                ) : (
                  <span className="text-[11.5px] font-semibold text-[#b45309] bg-[#fef3c7] rounded-[7px] px-2 py-0.5 shrink-0">{copy.settings.notVerified}</span>
                ))}
                {user && !verified && (
                  <button
                    type="button"
                    disabled={resendIn > 0}
                    onClick={() => { void resendVerification(); }}
                    className={btnOutline}
                  >
                    {resendIn > 0 ? copy.settings.resendWait(resendIn) : copy.settings.resendEmail}
                  </button>
                )}
              </div>
            </Row>
          </Section>

          <Section
            id="plan"
            title={copy.settings.planAndUsage}
            icon={Zap}
            action={payments && (
              <button
                type="button"
                onClick={() => navigate('/app/import')}
                className={cn(btnOutline, 'hidden sm:inline-flex shrink-0')}
              >
                <Upload className="w-4 h-4 shrink-0" />{copy.settings.importMoreContent}
              </button>
            )}
          >
            {subLoading ? (
              <div className="h-24 flex items-center justify-center text-gray-400 text-sm">{copy.settings.loadingUsage}</div>
            ) : (
              <div className="p-4 sm:p-5 space-y-4 min-w-0">
                <div
                  className="rounded-[14px] px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 text-g-on-cta"
                  style={{ backgroundImage: 'radial-gradient(120% 140% at 100% 0%, var(--g-blue-600) 0%, var(--g-blue-700) 45%, var(--g-blue-900) 100%)' }}
                >
                  <div className="min-w-0 flex-1">
                    {!plusActive && (
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-g-blue-300">{copy.settings.freeAllowance}</div>
                    )}
                    <div className="text-xl sm:text-[22px] font-bold mt-0.5 leading-tight">
                      {plusActive
                        ? (periodEnd ? copy.settings.plusUntil(plusLabel, tashkentDate(periodEnd, limitLang(locale))) : plusLabel)
                        : limitCopy.freePlan}
                    </div>
                    {plusActive && periodEnd && (
                      <span className="inline-flex mt-2 min-h-7 items-center rounded-full bg-white/15 px-2.5 text-xs font-semibold">
                        {copy.settings.daysLeft(tashkentDaysLeft(periodEnd))}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/app/plus')}
                    className="min-h-11 px-5 rounded-[12px] bg-white text-g-blue-700 text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 shadow-[0_6px_16px_rgba(12,3,66,0.25)]"
                  >
                    <Zap className="w-4 h-4" />{plusActive || plusExpired ? copy.settings.renew : copy.settings.upgrade}
                  </button>
                </div>

                <div>
                  <h3 className="text-[13px] font-semibold text-[#4a5565] mb-2">{copy.settings.usageToday}</h3>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <Meter
                      icon={Search}
                      text={quota !== null
                        ? limitCopy.lookupsLeft(Math.max(0, quota - lookupsToday), quota)
                        : copy.settings.aiLookupsLine(lookupsToday, null)}
                      used={quota !== null ? lookupsToday : undefined}
                      total={quota ?? undefined}
                    />
                    <Meter
                      icon={GraduationCap}
                      text={copy.settings.mashqLine(
                        subscription?.usage.mashqToday ?? 0,
                        plusActive ? (subscription?.usage.mashqQuota ?? null) : (subscription?.usage.mashqQuota ?? 20),
                      )}
                      used={subscription?.usage.mashqToday ?? 0}
                      total={(plusActive ? (subscription?.usage.mashqQuota ?? null) : (subscription?.usage.mashqQuota ?? 20)) ?? undefined}
                    />
                    {importAllowance && (
                      <Meter
                        icon={Upload}
                        text={limitCopy.importsLeft(importAllowance.dailyFreeRemaining, importAllowance.dailyFreeImportsPerUser)}
                        used={importAllowance.dailyFreeUsed}
                        total={importAllowance.dailyFreeImportsPerUser}
                      />
                    )}
                    {importAllowance && (
                      <Meter
                        icon={BookOpen}
                        tone="teal"
                        text={limitCopy.pagesLeft(importAllowance.monthlyPagesRemaining, importAllowance.monthlyFreePageLimit)}
                        used={Math.max(0, importAllowance.monthlyFreePageLimit - importAllowance.monthlyPagesRemaining)}
                        total={importAllowance.monthlyFreePageLimit}
                      />
                    )}
                  </div>
                </div>

                <ul className="space-y-1.5 text-[12.5px] text-[#6b7080]">
                  {[
                    plusActive && typeof subscription?.usage.importDiscountPct === 'number'
                      ? plusFill(payCopyFor(locale)['plus.bImp'], { plus: 0, free: 0, pct: subscription.usage.importDiscountPct })
                      : null,
                    copy.settings.publicLibraryAccess,
                  ].filter(Boolean).map((f) => (
                    <li key={f as string} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0 text-[#047857] mt-0.5" />
                      <span className="break-words">{f}</span>
                    </li>
                  ))}
                  {[
                    limitCopy.dailyReset,
                    importAllowance ? limitCopy.monthlyReset(tashkentDate(nextTashkentMonthStart().toISOString(), limitLang(locale))) : null,
                  ].filter(Boolean).map((f) => (
                    <li key={f as string} className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="break-words">{f}</span>
                    </li>
                  ))}
                </ul>

                {payments && (
                  <button
                    type="button"
                    onClick={() => navigate('/app/import')}
                    className={cn(btnOutline, 'w-full sm:hidden')}
                  >
                    <Upload className="w-4 h-4 shrink-0" />{copy.settings.importMoreContent}
                  </button>
                )}
              </div>
            )}
            {payments && (
              <button
                type="button"
                onClick={() => navigate('/app/payments')}
                className="w-full flex items-center gap-2.5 px-4 sm:px-5 min-h-12 bg-[#fafbff] text-sm font-semibold text-[#101828] hover:bg-g-blue-50 text-left"
              >
                <Receipt className="w-4 h-4 text-[#4a5565] shrink-0" />
                <span className="flex-1">{payCopyFor(locale)['history.title']}</span>
                <ChevronRight className="w-4 h-4 text-g-blue-700" />
              </button>
            )}
          </Section>

          <Section id="languages" title={copy.settings.targetLanguages} icon={Globe}>
            <div className="p-4 sm:p-5">
              {visibleTargetLanguages.length === 0 && (
                <div className="pb-4 text-center text-sm text-gray-400">
                  {targetLanguages.some((tl) => tl.targetLanguage === nativeLanguage)
                    ? copy.settings.nativeCannotBeTarget
                    : copy.settings.noTargetLanguages}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {visibleTargetLanguages.map((tl) => (
                  <div
                    key={tl.targetLanguage}
                    className={cn(
                      'flex items-center gap-1 rounded-xl border min-w-0 pl-3.5',
                      tl.isPrimary ? 'border-g-blue-200 bg-g-blue-50/60' : 'border-[#eceef5] bg-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setLangModal({ mode: 'edit', existing: tl })}
                      aria-label={`${copy.settings.editTargetLanguage}: ${languageUiName(tl.targetLanguage, locale)}`}
                      className="flex-1 min-w-0 flex items-center gap-3 py-3 text-left"
                    >
                      <CatalogLanguageFlag code={tl.targetLanguage} className="h-4 w-6 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#101828] truncate">{languageUiName(tl.targetLanguage, locale)}</span>
                        <span className="block text-xs text-[#6b7080] mt-0.5 truncate">
                          {copy.common.level(tl.cefrLevel)}
                          {tl.placementScore != null ? ` · ${copy.common.score(tl.placementScore)}` : ''}
                        </span>
                      </span>
                      {tl.isPrimary && (
                        <span className="ml-auto text-[11px] font-semibold text-g-blue-700 bg-white border border-g-blue-100 rounded-[7px] px-2 py-0.5 shrink-0">{copy.common.primary}</span>
                      )}
                    </button>
                    {visibleTargetLanguages.length > 1 && (
                      <button
                        type="button"
                        disabled={langBusy === tl.targetLanguage}
                        onClick={() => setPendingRemove(tl.targetLanguage)}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 disabled:opacity-40"
                        title={copy.settings.removeLanguage}
                        aria-label={copy.settings.removeLanguage}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setLangModal({ mode: 'add' })}
                  className="min-h-[60px] rounded-xl border border-dashed border-g-blue-200 text-g-blue-700 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-g-blue-50"
                >
                  <Plus className="w-4 h-4" />{copy.settings.addLanguage}
                </button>
              </div>
            </div>
          </Section>

          <Section id="reading" title={copy.settings.readingPreferences} icon={BookOpen}>
            <div className="lg:grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:divide-x divide-[#f0f1f6]">
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#9aa0ae] uppercase tracking-[0.12em] mb-2.5"><Eye className="w-3.5 h-3.5" />{copy.settings.preview}</div>
                <div
                  className="font-serif text-[#1e2939] bg-[#fbfaf7] border border-[#eeebe3] rounded-xl p-4"
                  style={{ fontSize: `${14 * fontScale}px`, lineHeight: lineSpacing }}
                >
                  {preview.before}
                  <span className="border-b-[1.6px] border-dashed border-[#ffb900]">{preview.known}</span>
                  {preview.middle}
                  <span className="border-b-[1.6px] border-[#51a2ff]">{preview.learning}</span>
                  {preview.after}
                </div>
              </div>
              <div className="divide-y divide-[#f0f1f6] border-t lg:border-t-0 border-[#f0f1f6]">
                <Row label={copy.settings.fontSize} description={copy.settings.fontSizeHint(Math.round(fontScale * 100))}>
                  <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                    <span className="text-xs text-[#99a1af] shrink-0">A</span>
                    <RangeSlider value={fontScale} min={0.8} max={1.6} step={0.05} onChange={(v) => { setFontScale(v); queuePref({ readerFontScale: v }); }} />
                    <span className="text-base font-bold text-[#0a0a0a] shrink-0">A</span>
                  </div>
                </Row>
                <Row label={copy.settings.lineSpacing} description={copy.settings.lineSpacingHint(lineSpacing.toFixed(1))}>
                  <RangeSlider value={lineSpacing} min={1} max={2.5} step={0.1} onChange={(v) => { setLineSpacing(v); queuePref({ readerLineSpacing: v }); }} />
                </Row>
                <Row label={copy.settings.readerTheme}>
                  <Segmented label={copy.settings.readerTheme}>
                    {readerThemes.map((t) => (
                      <ChoiceButton
                        key={t.value}
                        selected={theme === t.value}
                        onClick={() => { setTheme(t.value); queuePref({ readerTheme: t.value }); }}
                      >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                      </ChoiceButton>
                    ))}
                  </Segmented>
                </Row>
                <Row label={practiceCopy.appTheme}>
                  <Segmented label={practiceCopy.appTheme}>
                    {(['system', 'light'] as const).map((t) => (
                      <ChoiceButton
                        key={t}
                        selected={appTheme === t}
                        onClick={() => {
                          setAppTheme(t);
                          applyAppTheme(t);
                          queuePref({ appTheme: t }, 0);
                        }}
                      >
                        {t === 'system' ? practiceCopy.themeSystem : practiceCopy.themeLight}
                      </ChoiceButton>
                    ))}
                  </Segmented>
                </Row>
              </div>
            </div>
            <RowPair>
              <Row label={copy.settings.showKnownWords} description={copy.settings.showKnownWordsHint}>
                <Toggle checked={showKnownWords} onChange={(v) => { setShowKnownWords(v); queuePref({ showKnownWords: v }); }} />
              </Row>
              <Row label={copy.settings.tts} description={copy.settings.ttsHint}>
                <Toggle checked={ttsEnabled} onChange={(v) => { setTtsEnabled(v); queuePref({ ttsEnabled: v }); }} />
              </Row>
            </RowPair>
          </Section>

          <Section id="goals" title={copy.settings.learningGoals} icon={Target}>
            <Row label={copy.stats.dailyGoal} description={copy.settings.minutesLabel(dailyGoal)}>
              <Segmented label={copy.stats.dailyGoal}>
                {minuteChoices.map((minutes) => (
                  <ChoiceButton key={minutes} selected={dailyGoal === minutes} onClick={() => { setDailyGoal(minutes); queuePref({ dailyGoalMinutes: minutes }); }}>
                    {minutes}
                  </ChoiceButton>
                ))}
              </Segmented>
            </Row>
            <RowPair>
              <Row label={copy.settings.dailyXpGoal} description={(practiceCopy.goalNames as Record<number, string>)[dailyGoalXp] ?? copy.settings.dailyXpGoal}>
                <Stepper label={copy.settings.dailyXpGoal} value={dailyGoalXp} min={10} max={500} step={10} onChange={(xp) => { setDailyGoalXp(xp); queuePref({ dailyGoalXp: xp }); }} />
              </Row>
              <Row label={copy.settings.dailyNewWords} description={copy.settings.dailyNewWordsHint}>
                <Stepper label={copy.settings.dailyNewWords} value={dailyNewWords} min={0} max={50} step={1} onChange={(n) => { setDailyNewWords(n); queuePref({ dailyNewWords: n }); }} />
              </Row>
            </RowPair>
          </Section>

          <Section id="notifications" title={copy.settings.notifications} icon={Bell}>
            <RowPair>
              <Row label={copy.settings.emailNotifications} description={copy.settings.emailNotificationsHint}>
                <Toggle checked={notificationsEnabled} onChange={(v) => { setNotificationsEnabled(v); queuePref({ notificationsEnabled: v }); }} />
              </Row>
              <Row label={onlineLabel} description={onlineHint}>
                <Toggle checked={showOnlineStatus} onChange={(v) => { setShowOnlineStatus(v); queuePref({ showOnlineStatus: v }); }} />
              </Row>
            </RowPair>
          </Section>

          <Section id="privacy" title={copy.settings.privacyAi} icon={Shield}>
            <AiSwitch lang={locale} aiDisabled={user?.aiDisabled} aiDisabledBy={user?.aiDisabledBy} onChanged={refreshProfile} />
            <Row label={copy.settings.downloadData} description={exporting ? copy.settings.downloadingData : undefined}>
              <button
                type="button"
                disabled={exporting}
                aria-label={copy.settings.downloadData}
                onClick={() => { void downloadData(); }}
                className={cn(btnOutline, 'min-w-10 px-3')}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="text-xs font-bold tracking-wide text-[#6b7080]">JSON</span>
              </button>
            </Row>
          </Section>

          <Section id="danger" title={copy.settings.dangerZone} icon={AlertTriangle} danger>
            <DeleteAccount lang={locale} onDeleted={() => { logout(); window.location.assign('/'); }} />
          </Section>

          <div className="bg-white rounded-2xl border border-[#e9ebf3] px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <UserAvatar name={user?.displayName ?? user?.email} url={user?.avatarUrl} size={32} />
              <span className="min-w-0 truncate text-[13px] text-[#6b7080]">
                {copy.settings.signedInAs}{' '}
                <span className="font-semibold text-[#101828]">
                  {user?.displayName || user?.email}
                </span>
              </span>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSignOutAllOpen(true)}
                className="min-h-10 px-3 rounded-[11px] text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                {copy.settings.signOutAll}
              </button>
              <Button
                variant="outline"
                onClick={() => { logout(); navigate('/login'); }}
                className="rounded-[11px] border-[#e1e3ec] text-[#101828] hover:bg-gray-50 gap-2 min-h-10"
              >
                <LogOut className="w-4 h-4" />
                {copy.settings.signOut}
              </Button>
            </div>
          </div>
          <p data-testid="build-id" className="text-center text-[11px] text-[#99a1af] select-all">{buildLabel()}</p>
        </div>
      </div>

      {prefStatus !== 'idle' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40" role="status">
          <div className="min-h-11 px-4 rounded-full border border-[#e5e7eb] bg-white shadow-lg flex items-center gap-3 text-sm text-[#364153]">
            {prefStatus === 'saving' && <><Loader2 className="w-4 h-4 animate-spin" />{copy.common.saving}</>}
            {prefStatus === 'saved' && <><Check className="w-4 h-4 text-[#007a55]" />{copy.settings.saved}</>}
            {prefStatus === 'error' && (
              <>
                <span>{copy.settings.saveFailed}</span>
                <button type="button" className="min-h-11 font-semibold text-g-blue-700" onClick={() => { void flushPref(); }}>
                  {copy.settings.retry}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
