import { useEffect, useState } from 'react';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, Textarea } from '../components/ui';
import { api } from '../lib/api';

export function LicensesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null);
  const [rightsHolder, setRightsHolder] = useState('');
  const [attributionText, setAttributionText] = useState('');

  async function load() {
    setItems(await api('/admin/licenses'));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ rightsHolder, attributionText, status: 'cleared' }),
    });
    setRightsHolder('');
    setAttributionText('');
    await load();
  }

  if (!items) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Licenses" subtitle="Rights registry for curated content." />
      <Card className="p-5 mb-4">
        <form className="grid gap-3 max-w-xl" onSubmit={createLicense}>
          <Input value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} placeholder="Rights holder" required />
          <Textarea value={attributionText} onChange={(e) => setAttributionText(e.target.value)} placeholder="Attribution text" required />
          <Button type="submit">Add license</Button>
        </form>
      </Card>
      <Card className="p-2">
        <DataTable headers={['Holder', 'Status', 'Attribution']}>
          {items.map((item) => (
            <tr key={String(item.id)}>
              <td className="px-4 py-3 text-sm font-medium">{String(item.rightsHolder)}</td>
              <td className="px-4 py-3"><Badge className="bg-violet-50 text-[#6c1d95]">{String(item.status)}</Badge></td>
              <td className="px-4 py-3 text-sm text-slate-500">{String(item.attributionText)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function ModerationPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/moderation?status=pending').then(setItems).catch(console.error);
  }, []);

  async function review(id: string, status: string) {
    await api(`/admin/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
  }

  if (!items) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Moderation" subtitle="Review user imports awaiting approval." />
      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No pending items.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={String(item.id)} className="p-5">
              <div className="font-semibold">{String(item.reason)}</div>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => review(String(item.id), 'approved')}>Approve</Button>
                <Button variant="danger" onClick={() => review(String(item.id), 'rejected')}>Reject</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function IngestionPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/ingestion').then(setItems).catch(console.error);
  }, []);
  if (!items) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Ingestion" subtitle="Background processing jobs." />
      <Card className="p-2">
        <DataTable headers={['Type', 'Status', 'Attempts', 'Error']}>
          {items.map((item) => (
            <tr key={String(item.id)}>
              <td className="px-4 py-3 text-sm">{String(item.sourceType)}</td>
              <td className="px-4 py-3 text-sm">{String(item.status)}</td>
              <td className="px-4 py-3 text-sm">{String(item.attempts)}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{String(item.errorMessage ?? '—')}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
