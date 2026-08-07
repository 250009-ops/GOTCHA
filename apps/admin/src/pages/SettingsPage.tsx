import { useEffect, useState } from 'react';
import { Button, Card, Input, LoadingBlock, PageHeader, Select } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Settings {
  platformName: string;
  supportEmail: string;
  aiDailyLimit: number;
  aiEnabled: boolean;
  aiLookupModel: string;
  aiQuizModel: string;
  aiDefaultUserQuota: number;
  aiConfigured?: boolean;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  defaultCefr: string;
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Settings>('/admin/settings').then(setSettings).catch(console.error);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const { aiConfigured: _ignored, ...payload } = settings;
      const res = await api<Settings>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSettings(res);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <LoadingBlock />;

  const lookupModels = MODEL_OPTIONS.includes(settings.aiLookupModel)
    ? MODEL_OPTIONS
    : [settings.aiLookupModel, ...MODEL_OPTIONS];
  const quizModels = MODEL_OPTIONS.includes(settings.aiQuizModel)
    ? MODEL_OPTIONS
    : [settings.aiQuizModel, ...MODEL_OPTIONS];

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage GOTCHA app configurations, AI LLM integrations, content moderation, security, and billing plans."
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
            <label className="text-sm">
              <span className="text-slate-500 block mb-1">Default CEFR</span>
              <Select
                value={String(settings.defaultCefr ?? 'a2')}
                onChange={(e) => setSettings({ ...settings, defaultCefr: e.target.value })}
              >
                {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.allowRegistrations)}
                onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
              />
              Allow new registrations
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.maintenanceMode)}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              />
              Maintenance mode
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
              These settings gate learner lookups and quizzes. API key is read from server env
              ({settings.aiConfigured ? 'configured' : 'missing — set OPENAI_API_KEY and restart API'}).
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
                <span className="text-slate-500 block mb-1">Platform daily AI limit (all users)</span>
                <Input
                  type="number"
                  min={0}
                  value={Number(settings.aiDailyLimit ?? 0)}
                  onChange={(e) => setSettings({ ...settings, aiDailyLimit: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500 block mb-1">Default user daily quota (no plan)</span>
                <Input
                  type="number"
                  min={0}
                  value={Number(settings.aiDefaultUserQuota ?? 50)}
                  onChange={(e) => setSettings({ ...settings, aiDefaultUserQuota: Number(e.target.value) })}
                />
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
                    const { aiConfigured: _ignored, ...payload } = settings;
                    const res = await api<Settings>('/admin/settings', {
                      method: 'PATCH',
                      body: JSON.stringify(payload),
                    });
                    setSettings(res);
                    setSaved(true);
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
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{user?.displayName || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Role</span>
                <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
