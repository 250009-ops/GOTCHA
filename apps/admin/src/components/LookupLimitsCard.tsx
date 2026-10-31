import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';
import { Button, Card, Input } from './ui';

export function canEditAiLimits(role?: string | null) {
  return role === 'superadmin' || role === 'editor'; // final-5 A16: analysts view only
}

type LookupLimitsCardProps = {
  defaultUserQuota: number;
  dailyLimit: number;
  usersAtQuota?: number;
  todayPlatformUsed?: number;
  canEdit: boolean;
  showSettingsLink?: boolean;
  showImportPricingLink?: boolean;
  onSaved?: () => void;
};

export function LookupLimitsCard({
  defaultUserQuota,
  dailyLimit,
  usersAtQuota = 0,
  todayPlatformUsed,
  canEdit,
  showSettingsLink = true,
  showImportPricingLink = true,
  onSaved,
}: LookupLimitsCardProps) {
  // final-5 A4/A5: the enforced Free/Plus caps live in platform_settings (GET/PATCH /admin/plan-limits).
  const [freeLookups, setFreeLookups] = useState(20);
  const [freeQuizzes, setFreeQuizzes] = useState(10);
  const [plusQuizzes, setPlusQuizzes] = useState(200);
  useEffect(() => {
    api<{ freeLookupsPerDay: number; freeQuizzesPerDay: number; plusQuizzesPerDay: number }>('/admin/plan-limits')
      .then((v) => { setFreeLookups(v.freeLookupsPerDay); setFreeQuizzes(v.freeQuizzesPerDay); setPlusQuizzes(v.plusQuizzesPerDay); })
      .catch(() => undefined);
  }, []);
  void defaultUserQuota;
  const [platformLimit, setPlatformLimit] = useState(dailyLimit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlatformLimit(dailyLimit);
  }, [defaultUserQuota, dailyLimit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const n = (v: number) => Math.max(0, Math.floor(Number(v) || 0));
      await api('/admin/plan-limits', {
        method: 'PATCH',
        body: JSON.stringify({ freeLookupsPerDay: n(freeLookups), freeQuizzesPerDay: n(freeQuizzes), plusQuizzesPerDay: n(plusQuizzes) }),
      });
      await api('/admin/ai-usage/limits', { method: 'PATCH', body: JSON.stringify({ aiDailyLimit: n(platformLimit) }) });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lookup limits');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3">
        <div className="font-semibold">Daily word-lookup quota</div>
        <div className="text-sm text-slate-500">
          This is the cap learners hit after tapping words in a book or chat
          (“Daily AI lookup limit reached”). Change it here — it applies on the next lookup.
          {showSettingsLink || showImportPricingLink ? (
            <>
              {' '}
              Also under{' '}
              {[
                showImportPricingLink ? (
                  <Link key="pricing" to="/import-pricing" className="text-[#6c1d95] font-medium hover:underline">
                    Import & Pricing
                  </Link>
                ) : null,
                showSettingsLink ? (
                  <Link key="settings" to="/settings" className="text-[#6c1d95] font-medium hover:underline">
                    Settings → AI controls
                  </Link>
                ) : null,
              ]
                .filter(Boolean)
                .reduce<ReactNode[]>((acc, node, i) => {
                  if (i > 0) acc.push(' and ');
                  acc.push(node);
                  return acc;
                }, [])}
              .
            </>
          ) : null}
        </div>
      </div>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(e) => void save(e)}>
        <label className="text-sm">
          <span className="text-slate-500 block mb-1">Free: word lookups per day</span>
          <Input type="number" min={0} step={1} data-testid="free-lookups" disabled={!canEdit} value={freeLookups} onChange={(e) => setFreeLookups(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500 block mb-1">Free: chapter quizzes per day</span>
          <Input type="number" min={0} step={1} data-testid="free-quizzes" disabled={!canEdit} value={freeQuizzes} onChange={(e) => setFreeQuizzes(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500 block mb-1">Plus: chapter quizzes per day</span>
          <Input type="number" min={0} step={1} data-testid="plus-quizzes" disabled={!canEdit} value={plusQuizzes} onChange={(e) => setPlusQuizzes(Number(e.target.value))} />
        </label>
        <div className="text-xs text-slate-400 md:col-span-2">{formatNumber(usersAtQuota)} learner{usersAtQuota === 1 ? '' : 's'} at the lookup cap today. Counters reset at midnight Tashkent time. Free imports (3 a day, 50 pages a month) are set under Import &amp; Pricing.</div>
        <label className="text-sm">
          <span className="text-slate-500 block mb-1">Platform daily AI limit (all learners)</span>
          <Input
            type="number"
            min={0}
            step={1}
            disabled={!canEdit}
            value={platformLimit}
            onChange={(e) => setPlatformLimit(Number(e.target.value))}
          />
          <span className="text-xs text-slate-400 mt-1 block">
            {todayPlatformUsed != null ? `Today: ${formatNumber(todayPlatformUsed)}` : null}
            {dailyLimit ? ` / ${formatNumber(dailyLimit)}` : ''}.
            0 = no platform cap.
          </span>
        </label>
        <div className="md:col-span-2 flex items-center gap-3">
          {canEdit ? (
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save limits'}</Button>
          ) : (
            <span className="text-xs text-slate-500">You can view this cap. Ask a superadmin or editor to change it.</span>
          )}
          {saved && <span className="text-sm text-emerald-600">Saved — learners use the new cap on the next lookup.</span>}
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </form>
    </Card>
  );
}
