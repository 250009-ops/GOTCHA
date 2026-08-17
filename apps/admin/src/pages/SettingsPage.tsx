import { useEffect, useState } from 'react';
import { AdminAvatar } from '../components/AdminAvatar';
import { Button, Card, Input, LoadingBlock, PageHeader, Select } from '../components/ui';
import { api, clearToken } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Settings {
  platformName: string;
  supportEmail: string;
  aiDailyLimit: number;
  aiEnabled: boolean;
  aiLookupModel: string;
  aiQuizModel: string;
  aiImportCleanupModel: string;
  aiDefaultUserQuota: number;
  aiConfigured?: boolean;
  contentModerationEnabled: boolean;
  autoApproveImports: boolean;
}

const MODEL_OPTIONS = [
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o-mini',
  'gpt-4o',
  'o4-mini',
];

function settingsPayload(settings: Settings) {
  return {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail?.trim() || undefined,
    aiEnabled: settings.aiEnabled,
    aiDailyLimit: settings.aiDailyLimit,
    aiDefaultUserQuota: settings.aiDefaultUserQuota,
    aiLookupModel: settings.aiLookupModel,
    aiQuizModel: settings.aiQuizModel,
    aiImportCleanupModel: settings.aiImportCleanupModel,
    contentModerationEnabled: settings.contentModerationEnabled,
    autoApproveImports: settings.autoApproveImports,
  };
}

export default function SettingsPage() {
  const { user, refresh, uploadAvatar } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    api<Settings>('/admin/settings')
      .then(setSettings)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load settings'));
  }, []);

  useEffect(() => {
    setProfileName(user?.displayName ?? '');
    setProfileEmail(user?.email ?? '');
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await api('/admin/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: profileName.trim() || undefined,
          email: profileEmail.trim() || undefined,
        }),
      });
      await refresh();
      setProfileSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (!currentPassword || !newPassword) {
      setPwError('Fill in both password fields');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Backend revokes all refresh tokens on password change — force a fresh login.
      setTimeout(() => {
        clearToken();
        window.location.reload();
      }, 1200);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setPwSaving(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await api<Settings>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settingsPayload(settings)),
      });
      setSettings(res);
      setSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    if (loadError) {
      return <p className="text-sm text-red-600">{loadError}</p>;
    }
    return <LoadingBlock />;
  }

  const lookupModels = MODEL_OPTIONS.includes(settings.aiLookupModel)
    ? MODEL_OPTIONS
    : [settings.aiLookupModel, ...MODEL_OPTIONS];
  const quizModels = MODEL_OPTIONS.includes(settings.aiQuizModel)
    ? MODEL_OPTIONS
    : [settings.aiQuizModel, ...MODEL_OPTIONS];
  const importCleanupModels = MODEL_OPTIONS.includes(settings.aiImportCleanupModel)
    ? MODEL_OPTIONS
    : [settings.aiImportCleanupModel || 'gpt-4.1-mini', ...MODEL_OPTIONS];

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your admin photo, platform name, support email, AI limits, and import moderation."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-semibold mb-4">Platform</div>
          <form className="grid gap-3" onSubmit={save}>
            <label className="text-sm">
              <span className="text-slate-500 block mb-1">Platform name</span>
              <Input
                value={String(settings.platformName ?? '')}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-500 block mb-1">Support email</span>
              <Input
                type="email"
                value={String(settings.supportEmail ?? '')}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
              {saved && <span className="text-sm text-emerald-600">Saved</span>}
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="font-semibold mb-1">AI controls</div>
            <p className="text-sm text-slate-500 mb-4">
              These settings gate learner lookups, quizzes, and URL/PDF/EPUB import cleanup.
              API key is read from server env
              ({settings.aiConfigured ? 'configured' : 'missing — set OPENAI_API_KEY and restart API'}).
              Toggle import cleanup with IMPORT_AI_CLEANUP_ENABLED in server env.
            </p>
            <form className="grid gap-3" onSubmit={save}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(settings.aiEnabled)}
                  onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
                />
                Enable AI for learners
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Platform daily AI limit (all learners)</span>
                <Input
                  type="number"
                  min={0}
                  value={Number(settings.aiDailyLimit ?? 0)}
                  onChange={(e) => setSettings({ ...settings, aiDailyLimit: Number(e.target.value) })}
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Shared cap for lookups + quizzes today. 0 = unlimited. Learners are blocked when this is reached.
                </span>
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Daily word-lookup quota per learner</span>
                <Input
                  type="number"
                  min={0}
                  value={Number(settings.aiDefaultUserQuota ?? 50)}
                  onChange={(e) => setSettings({ ...settings, aiDefaultUserQuota: Number(e.target.value) })}
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Each learner’s word lookups per day in books and chat. Editable here and on Dashboard / AI Usage.
                  0 = unlimited. This is the warning they see after tapping too many words.
                </span>
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Lookup model</span>
                <Select
                  value={String(settings.aiLookupModel ?? 'gpt-4.1-mini')}
                  onChange={(e) => setSettings({ ...settings, aiLookupModel: e.target.value })}
                >
                  {lookupModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Quiz model</span>
                <Select
                  value={String(settings.aiQuizModel ?? 'gpt-4.1-mini')}
                  onChange={(e) => setSettings({ ...settings, aiQuizModel: e.target.value })}
                >
                  {quizModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Import cleanup model</span>
                <Select
                  value={String(settings.aiImportCleanupModel ?? 'gpt-4.1-mini')}
                  onChange={(e) => setSettings({ ...settings, aiImportCleanupModel: e.target.value })}
                >
                  {importCleanupModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </label>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save AI settings'}</Button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="font-semibold mb-4">Content Moderation</div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(settings.contentModerationEnabled)}
                  onChange={(e) => setSettings({ ...settings, contentModerationEnabled: e.target.checked })}
                />
                Require review for user imports
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoApproveImports)}
                  onChange={(e) => setSettings({ ...settings, autoApproveImports: e.target.checked })}
                />
                Auto-approve trusted importers
              </label>
              <p className="text-slate-500">
                Moderation and ingestion queues live under Content → User Imports. Licenses for curated material are managed there as well.
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaved(false);
                  try {
                    const res = await api<Settings>('/admin/settings', {
                      method: 'PATCH',
                      body: JSON.stringify(settingsPayload(settings)),
                    });
                    setSettings(res);
                    setSaved(true);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Could not save settings');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save moderation settings
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-semibold mb-4">Admin account</div>
            <form className="grid gap-3 text-sm" onSubmit={saveProfile}>
              <div>
                <span className="text-slate-500 block mb-2">Photo</span>
                <div className="flex items-center gap-3">
                  <AdminAvatar
                    name={profileName || user?.displayName}
                    email={profileEmail || user?.email}
                    url={user?.avatarUrl}
                    size={56}
                  />
                  <label className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 inline-flex items-center cursor-pointer">
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
                          .catch((err) => alert(err instanceof Error ? err.message : 'Upload failed'))
                          .finally(() => setAvatarBusy(false));
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">JPG, PNG, or WebP up to 2 MB. Shown in the sidebar.</p>
              </div>
              <label>
                <span className="text-slate-500 block mb-1">Name</span>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </label>
              <label>
                <span className="text-slate-500 block mb-1">Email</span>
                <Input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                />
              </label>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Role</span>
                <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </Button>
                {profileSaved && <span className="text-sm text-emerald-600">Saved</span>}
              </div>
            </form>

            <div className="h-px bg-slate-100 my-4" />

            <div className="font-semibold mb-3">Change password</div>
            <form className="grid gap-3 text-sm" onSubmit={changePassword}>
              <label>
                <span className="text-slate-500 block mb-1">Current password</span>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                <span className="text-slate-500 block mb-1">New password</span>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                <span className="text-slate-500 block mb-1">Confirm new password</span>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
              {pwSuccess && (
                <p className="text-sm text-emerald-600">Password updated. Signing you out to re-authenticate…</p>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={pwSaving}>
                  {pwSaving ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
