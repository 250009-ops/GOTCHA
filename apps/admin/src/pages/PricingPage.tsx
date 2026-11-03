import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save } from 'lucide-react';
import { Badge, Button, Card, ErrorBlock, Input, LoadingBlock, PageHeader, Select } from '../components/ui';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';

type Plan = {
  id: string;
  tier: string;
  name: string;
  nameI18n: { en?: string; ru?: string; uz?: string } | null;
  priceUzs: number;
  period: 'month' | 'year' | 'one_time';
  aiDailyQuota: number;
  importLimit: number;
  offlineEnabled: boolean;
  features: string[] | null;
  active: boolean;
};
type Tier = { id: string; label: string; minPages: number; maxPages: number | null; priceUzs: number; active: boolean };
type Promo = {
  id: string;
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffUzs: number | null;
  appliesTo: 'imports' | 'catalog' | 'all';
  validFrom: string | null;
  validTo: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  perUserLimit: number;
  active: boolean;
};
type StoreProduct = {
  id: string;
  platform: 'web' | 'google_play';
  sku: string;
  kind: 'subscription' | 'import_tier' | 'catalog_book';
  planTier: string | null;
  importTierId: string | null;
  contentId: string | null;
  priceUzs: number;
  active: boolean;
};
type Pricing = { currency: 'UZS'; plans: Plan[]; tiers: Tier[]; promos: Promo[]; storeProducts?: StoreProduct[] };
type PlusSettings = {
  price30Uzs: number;
  price365Uzs: number;
  importDiscountPct: number;
  webPlusPassEnabled: boolean;
  freeMashqPerDay: number;
};

function PlusPassCard({ onSaved }: { onSaved: (text: string) => void }) {
  const [plus, setPlus] = useState<PlusSettings | null>(null);
  const [price30, setPrice30] = useState('');
  const [price365, setPrice365] = useState('');
  const [discount, setDiscount] = useState('');
  const [freeMashq, setFreeMashq] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const row = await api<PlusSettings>('/admin/plus-settings');
    setPlus(row);
    setPrice30(String(row.price30Uzs));
    setPrice365(String(row.price365Uzs));
    setDiscount(String(row.importDiscountPct));
    setFreeMashq(String(row.freeMashqPerDay));
  }, []);
  useEffect(() => { void load().catch((e) => setErr(e instanceof Error ? e.message : 'Could not load Plus settings')); }, [load]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api('/admin/plus-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          price30Uzs: Number(price30),
          price365Uzs: Number(price365),
          importDiscountPct: Number(discount),
          freeMashqPerDay: Number(freeMashq),
        }),
      });
      await load();
      onSaved('Plus pass saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (!plus && !err) return <LoadingBlock />;
  return (
    <Card className="p-4">
      <h2 className="text-base font-bold text-slate-900">Plus pass</h2>
      <p className="mt-1 mb-3 text-xs text-slate-500">
        These are the prices learners pay. Web checkout is {plus?.webPlusPassEnabled ? 'on' : 'off'} (read-only).
        Free Mashq is questions per day and resets at 00:00 Tashkent. Plus Mashq has no daily cap.
      </p>
      {err ? <p className="mb-2 text-sm text-rose-700">{err}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">30-day price (UZS)
          <Input inputMode="numeric" value={price30} onChange={(e) => setPrice30(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-xs font-semibold text-slate-600">365-day price (UZS)
          <Input inputMode="numeric" value={price365} onChange={(e) => setPrice365(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Plus import discount %
          <Input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Free Mashq questions / day
          <Input inputMode="numeric" value={freeMashq} onChange={(e) => setFreeMashq(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <div className="mt-3">
        <Button disabled={busy} onClick={() => void save()}><Save className="size-4" /> Save Plus pass</Button>
      </div>
    </Card>
  );
}

const tashkentDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Payments → Pricing: DB-driven plans, page tiers and promo codes. Every change is written to the AuditLog. */
export default function PricingPage() {
  const [data, setData] = useState<Pricing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Plan>>>({});
  const [sku, setSku] = useState({ sku: '', kind: 'catalog_book', target: '', priceUzs: '' });
  const [promo, setPromo] = useState({ code: '', kind: 'percent', value: '', appliesTo: 'all', validTo: '', maxRedemptions: '', description: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Pricing>('/admin/pricing'));
      setEdits({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing');
    }
  }, []);
  useEffect(() => void load(), [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const savePlan = (p: Plan) => {
    const e = edits[p.tier] ?? {};
    const body: Record<string, unknown> = {};
    if (e.nameI18n) body.nameI18n = { ...p.nameI18n, ...e.nameI18n };
    if (e.priceUzs != null) body.priceUzs = Number(e.priceUzs);
    if (e.period) body.period = e.period;
    if (e.aiDailyQuota != null) body.aiDailyQuota = Number(e.aiDailyQuota);
    if (e.active != null) body.active = e.active;
    if (e.features) body.features = e.features;
    return run(() => api(`/admin/pricing/plans/${p.tier}`, { method: 'PATCH', body: JSON.stringify(body) }), `Saved ${p.tier}.`);
  };

  const setPlan = (tier: string, patch: Partial<Plan>) => setEdits((x) => ({ ...x, [tier]: { ...x[tier], ...patch } }));

  if (error && !data) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pricing"
        subtitle="Plans, import page tiers and promo codes come from the database. Prices are in UZS; every change is audited."
        actions={<Button onClick={() => load()}><RefreshCw className="size-4" /> Refresh</Button>}
      />
      {msg && <p className="text-sm text-slate-600" role="status">{msg}</p>}

      <PlusPassCard onSaved={(text) => setMsg(text)} />

      <Card className="p-4">
        <h2 className="mb-3 text-base font-bold text-slate-900">Plans</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.plans.map((p) => {
            const e = edits[p.tier] ?? {};
            const names = { ...p.nameI18n, ...e.nameI18n };
            return (
              <div key={p.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500">{p.tier}</span>
                  <Badge className={(e.active ?? p.active) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{(e.active ?? p.active) ? 'active' : 'inactive'}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['en', 'ru', 'uz'] as const).map((l) => (
                    <label key={l} className="text-xs font-semibold text-slate-600">
                      Name {l.toUpperCase()}
                      <Input value={names?.[l] ?? ''} onChange={(ev) => setPlan(p.tier, { nameI18n: { ...names, [l]: ev.target.value } })} />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Price (UZS)
                    <Input inputMode="numeric" disabled readOnly value={String(p.priceUzs)} title={p.tier === 'free' ? 'Free has no price' : 'Charged price is the Plus pass above'} />
                    {p.tier !== 'free' ? <span className="mt-1 block font-normal text-slate-500">Charged price is the Plus pass above.</span> : null}
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Period
                    <Select value={p.period} disabled title="Plus is a 30-day or 365-day pass">
                      <option value="month">month</option>
                      <option value="year">year</option>
                      <option value="one_time">one time</option>
                    </Select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    AI lookups / day
                    <Input inputMode="numeric" value={String(e.aiDailyQuota ?? p.aiDailyQuota)} onChange={(ev) => setPlan(p.tier, { aiDailyQuota: Number(ev.target.value.replace(/\D/g, '') || 0) })} />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">
                  Features (comma-separated keys)
                  <Input value={(e.features ?? p.features ?? []).join(', ')} onChange={(ev) => setPlan(p.tier, { features: ev.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                </label>
                <div className="flex items-center justify-between pt-1">
                  {p.tier !== 'free' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={e.active ?? p.active} onChange={(ev) => setPlan(p.tier, { active: ev.target.checked })} /> Sellable
                    </label>
                  ) : <span className="text-xs text-slate-500">Free plan is always on</span>}
                  <Button disabled={!edits[p.tier]} onClick={() => void savePlan(p)}><Save className="size-4" /> Save</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-base font-bold text-slate-900">Import page tiers</h2>
        <p className="mb-3 text-xs text-slate-500">Edit amounts under Import &amp; Pricing. Inactive tiers are not offered at checkout.</p>
        <table className="w-full text-sm">
          <tbody>
            {data.tiers.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-2">{t.label}</td>
                <td className="py-2 tabular-nums">{formatMoney(t.priceUzs)}</td>
                <td className="py-2 text-right">
                  <Button variant="secondary" onClick={() => void run(() => api(`/admin/pricing/tiers/${t.id}/active`, { method: 'PATCH', body: JSON.stringify({ active: !t.active }) }), `${t.label}: ${t.active ? 'deactivated' : 'activated'}.`)}>
                    {t.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-base font-bold text-slate-900">Google Play products (Android)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Android sells imports, books and Plus only through Google Play. Map each Play Console product id (SKU) to what it unlocks.
          The Play price is set in Play Console; the price here is for reports and may differ from web (e.g. +15% for Google&apos;s fee).
          Activate a SKU only after the product is live in Play Console.
        </p>
        <div className="mb-4 grid gap-2 md:grid-cols-5">
          <Input aria-label="SKU" placeholder="book_my_title" value={sku.sku} onChange={(e) => setSku({ ...sku, sku: e.target.value.toLowerCase() })} />
          <Select aria-label="Kind" value={sku.kind} onChange={(e) => setSku({ ...sku, kind: e.target.value, target: '' })}>
            <option value="catalog_book">Catalog book</option>
            <option value="import_tier">Import page tier</option>
            <option value="subscription">Plus subscription</option>
          </Select>
          {sku.kind === 'import_tier' ? (
            <Select aria-label="Page tier" value={sku.target} onChange={(e) => setSku({ ...sku, target: e.target.value })}>
              <option value="">Page tier…</option>
              {data.tiers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          ) : sku.kind === 'catalog_book' ? (
            <Input aria-label="Book id" placeholder="book id (uuid)" value={sku.target} onChange={(e) => setSku({ ...sku, target: e.target.value.trim() })} />
          ) : (
            <Input aria-label="Plan" value="premium" readOnly />
          )}
          <Input aria-label="Price (UZS)" inputMode="numeric" placeholder="price UZS" value={sku.priceUzs} onChange={(e) => setSku({ ...sku, priceUzs: e.target.value.replace(/\D/g, '') })} />
          <Button
            disabled={!sku.sku || !sku.priceUzs || (sku.kind !== 'subscription' && !sku.target)}
            onClick={() =>
              void run(
                () =>
                  api('/admin/pricing/store-products', {
                    method: 'POST',
                    body: JSON.stringify({
                      platform: 'google_play', sku: sku.sku, kind: sku.kind, priceUzs: Number(sku.priceUzs), active: false,
                      ...(sku.kind === 'subscription' ? { planTier: 'premium' } : sku.kind === 'import_tier' ? { importTierId: sku.target } : { contentId: sku.target }),
                    }),
                  }).then(() => setSku({ sku: '', kind: 'catalog_book', target: '', priceUzs: '' })),
                `SKU ${sku.sku} added (inactive).`,
              )
            }
          >
            <Plus className="size-4" /> Add SKU
          </Button>
        </div>
        {(data.storeProducts ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No store products yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500"><th className="py-1">SKU</th><th>Platform</th><th>Unlocks</th><th>Price</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data.storeProducts ?? []).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{p.sku}</td>
                  <td>{p.platform === 'google_play' ? 'Google Play' : 'Web'}</td>
                  <td>{p.kind === 'subscription' ? `Plan: ${p.planTier}` : p.kind === 'import_tier' ? `Tier: ${data.tiers.find((t) => t.id === p.importTierId)?.label ?? p.importTierId}` : `Book: ${p.contentId?.slice(0, 8)}…`}</td>
                  <td className="tabular-nums">{formatMoney(p.priceUzs)}</td>
                  <td>{p.active ? <Badge className="bg-emerald-50 text-emerald-700">active</Badge> : <Badge>inactive</Badge>}</td>
                  <td className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void run(
                          () => api(`/admin/pricing/store-products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ platform: p.platform, sku: p.sku, kind: p.kind, planTier: p.planTier, importTierId: p.importTierId, contentId: p.contentId, priceUzs: p.priceUzs, active: !p.active }) }),
                          `${p.sku} ${p.active ? 'deactivated' : 'activated'}.`,
                        )
                      }
                    >
                      {p.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-bold text-slate-900">Promo codes</h2>
        <div className="mb-4 grid gap-2 md:grid-cols-7">
          <Input aria-label="Code" placeholder="CODE" value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} />
          <Select aria-label="Discount type" value={promo.kind} onChange={(e) => setPromo({ ...promo, kind: e.target.value })}>
            <option value="percent">% off (max 70)</option>
            <option value="amount">UZS off</option>
          </Select>
          <Input aria-label="Value" inputMode="numeric" placeholder={promo.kind === 'percent' ? '20' : '5000'} value={promo.value} onChange={(e) => setPromo({ ...promo, value: e.target.value.replace(/\D/g, '') })} />
          <Select aria-label="Applies to" value={promo.appliesTo} onChange={(e) => setPromo({ ...promo, appliesTo: e.target.value })}>
            <option value="all">imports + books</option>
            <option value="imports">imports</option>
            <option value="catalog">books</option>
          </Select>
          <Input aria-label="Valid until" type="date" value={promo.validTo} onChange={(e) => setPromo({ ...promo, validTo: e.target.value })} />
          <Input aria-label="Max uses" inputMode="numeric" placeholder="max uses" value={promo.maxRedemptions} onChange={(e) => setPromo({ ...promo, maxRedemptions: e.target.value.replace(/\D/g, '') })} />
          <Button
            disabled={promo.code.length < 3 || !promo.value}
            onClick={() =>
              void run(
                () =>
                  api('/admin/pricing/promos', {
                    method: 'POST',
                    body: JSON.stringify({
                      code: promo.code,
                      ...(promo.kind === 'percent' ? { percentOff: Number(promo.value) } : { amountOffUzs: Number(promo.value) }),
                      appliesTo: promo.appliesTo,
                      // End of the chosen day in Tashkent (UTC+5).
                      validTo: promo.validTo ? new Date(`${promo.validTo}T23:59:59+05:00`).toISOString() : null,
                      maxRedemptions: promo.maxRedemptions ? Number(promo.maxRedemptions) : null,
                    }),
                  }).then(() => setPromo({ code: '', kind: 'percent', value: '', appliesTo: 'all', validTo: '', maxRedemptions: '', description: '' })),
                `Promo ${promo.code} created.`,
              )
            }
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        {data.promos.length === 0 ? (
          <p className="text-sm text-slate-500">No promo codes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">Code</th><th>Discount</th><th>Applies to</th><th>Valid until (UTC+5)</th><th>Used</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.promos.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{p.code}</td>
                  <td>{p.percentOff != null ? `${p.percentOff}%` : formatMoney(p.amountOffUzs ?? 0)}</td>
                  <td>{p.appliesTo}</td>
                  <td>{tashkentDate(p.validTo)}</td>
                  <td className="tabular-nums">{p.redemptions}{p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''}</td>
                  <td className="text-right">
                    <Button variant="secondary" onClick={() => void run(() => api(`/admin/pricing/promos/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }), `${p.code} ${p.active ? 'paused' : 'resumed'}.`)}>
                      {p.active ? 'Pause' : 'Resume'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
