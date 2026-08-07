import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  Download,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  avatarInitials,
  LANGUAGE_META,
  type AppLanguage,
  type CatalogLanguage,
  type SubscriptionInfo,
} from '../lib/types';

const READER_THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'sepia', label: 'Sepia', icon: BookOpen },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

function comingSoon(feature: string) {
  toast(`${feature} is coming soon`);
}

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

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, preferences, updateProfile, updatePreferences, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage>(user?.nativeLanguage ?? 'en');

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
      ? catalogLangs
      : Object.entries(LANGUAGE_META).map(([code, meta]) => ({
          code,
          name: meta.label,
          nativeName: meta.label,
          flagEmoji: meta.flag,
          isEnabled: true,
        }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateProfile({ displayName: displayName.trim() || undefined, nativeLanguage }),
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
  const isPremium = plan?.tier === 'premium';
  const quota = subscription?.usage.quota ?? plan?.aiDailyQuota ?? 50;
  const lookupsToday = subscription?.usage.lookupsToday ?? 0;
  const usagePct = quota > 0 ? Math.min(100, Math.round((lookupsToday / quota) * 100)) : 0;
  const initials = avatarInitials(user?.displayName ?? user?.email ?? 'G');
  const targetLanguages = user?.targetLanguages ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-5">
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
        <Row label="Email" description="Used for login and notifications">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6a7282]">{user?.email}</span>
            <span className="text-[11px] font-semibold text-[#007a55] bg-[#d0fae5] rounded-full px-1.5 py-0.5">Verified</span>
          </div>
        </Row>
        <Row label="Password">
          <button
            type="button"
            onClick={() => comingSoon('Password change')}
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
                <button type="button" onClick={() => comingSoon('Editing target languages')} className="p-1.5 rounded-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={() => comingSoon('Adding a target language')}
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

      <Section title="Subscription">
        <div className="p-5">
          {subLoading ? (
            <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Loading plan…</div>
          ) : (
            <>
              <div
                className="rounded-[14px] p-5"
                style={{ backgroundImage: isPremium ? undefined : 'linear-gradient(161deg, #7f22fe 0%, #432dd7 100%)' }}
              >
                <div className={cn('rounded-[14px]', !isPremium && 'text-white')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={cn('text-xs font-semibold uppercase tracking-wide', isPremium ? 'text-violet-500' : 'text-[#ddd6ff]')}>Current plan</div>
                      <div className="text-2xl font-bold mt-1">{plan?.name ?? 'Free'}</div>
                    </div>
                    <Crown className={cn('w-6 h-6', isPremium ? 'text-amber-500' : 'text-white')} />
                  </div>
                  <div className="space-y-1.5 py-4">
                    {(isPremium
                      ? plan?.features?.slice(0, 3) ?? ['Unlimited AI', 'Imports', 'Offline']
                      : [`AI lookups: ${lookupsToday}/${quota} today`, `Up to ${plan?.importLimit ?? 3} imports per month`, 'Access to public library']
                    ).map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <Check className={cn('w-3.5 h-3.5 shrink-0', isPremium ? 'text-emerald-500' : 'text-[#ddd6ff]')} />
                        <span className={isPremium ? 'text-gray-600' : 'text-[#ddd6ff]'}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {!isPremium && (
                    <button
                      type="button"
                      onClick={() => comingSoon('Upgrading to Premium')}
                      className="w-full h-9 rounded-[14px] bg-white text-[#7008e7] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-50"
                    >
                      <Zap className="w-4 h-4" />Upgrade to Premium — $9/mo
                    </button>
                  )}
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
            onClick={() => comingSoon('Data export')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[14px] border border-black/10 bg-white text-sm font-medium text-[#0a0a0a] hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" />Export
          </button>
        </Row>
        <Row label="Delete account" description="Permanently delete your account and all data">
          <button
            type="button"
            onClick={() => comingSoon('Account deletion')}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[14px] border border-[#ffc9c9] bg-white text-sm font-medium text-[#e7000b] hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
        </Row>
      </Section>

      <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Signed in as <span className="font-medium text-gray-600">{initials}</span>
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
