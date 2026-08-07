import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, clearToken, getToken, setToken } from './api';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@gotcha.app');
  const [password, setPassword] = useState('GotchaAdmin2026!');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Gotcha Admin</h1>
        <p className="page-sub">Content, licenses, and moderation</p>
        <div className="form-grid">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" type="submit">Sign in</button>
        </div>
      </form>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">Gotcha Admin</div>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/content">Content</NavLink>
        <NavLink to="/licenses">Licenses</NavLink>
        <NavLink to="/moderation">Moderation</NavLink>
        <NavLink to="/ingestion">Ingestion</NavLink>
        <button className="btn btn-ghost" style={{ marginTop: 'auto' }} onClick={() => { clearToken(); navigate('/login'); }}>
          Log out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api<Record<string, number>>('/admin/dashboard', {}, getToken()).then(setData).catch(console.error);
  }, []);

  return (
    <Shell>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Platform overview</p>
      <div className="stats-grid">
        {data && Object.entries(data).map(([key, value]) => (
          typeof value === 'number' && (
            <div className="stat-card" key={key}>
              <div className="label">{key.replace(/([A-Z])/g, ' $1')}</div>
              <div className="value">{value}</div>
            </div>
          )
        ))}
      </div>
    </Shell>
  );
}

function ContentPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [plainText, setPlainText] = useState('');

  async function load() {
    const res = await api<Array<Record<string, unknown>>>('/admin/content', {}, getToken());
    setItems(res);
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function createContent(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/content', {
      method: 'POST',
      body: JSON.stringify({ title, plainText, language: 'en', contentType: 'article', contentSource: 'public_domain', cefrLevel: 'b1' }),
    }, getToken());
    setTitle('');
    setPlainText('');
    await load();
  }

  async function publish(id: string) {
    await api(`/admin/content/${id}/publish`, { method: 'PATCH' }, getToken());
    await load();
  }

  return (
    <Shell>
      <h1 className="page-title">Content</h1>
      <p className="page-sub">Create and publish reading materials</p>
      <form className="card form-grid" onSubmit={createContent}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <textarea rows={6} value={plainText} onChange={(e) => setPlainText(e.target.value)} placeholder="Plain text content" required />
        <button className="btn btn-primary" type="submit">Create draft</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Title</th><th>Language</th><th>Level</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item.id)}>
                <td>{String(item.title)}</td>
                <td>{String(item.language)}</td>
                <td>{String(item.cefrLevel).toUpperCase()}</td>
                <td><span className={`badge badge-${item.publishStatus === 'published' ? 'published' : 'draft'}`}>{String(item.publishStatus)}</span></td>
                <td>
                  {item.publishStatus !== 'published' && (
                    <button className="btn btn-accent" onClick={() => publish(String(item.id))}>Publish</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function LicensesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [rightsHolder, setRightsHolder] = useState('');
  const [attributionText, setAttributionText] = useState('');

  async function load() {
    setItems(await api('/admin/licenses', {}, getToken()));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ rightsHolder, attributionText, status: 'cleared' }),
    }, getToken());
    setRightsHolder('');
    setAttributionText('');
    await load();
  }

  return (
    <Shell>
      <h1 className="page-title">Licenses</h1>
      <p className="page-sub">Rights registry for curated content</p>
      <form className="card form-grid" onSubmit={createLicense}>
        <input value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} placeholder="Rights holder" required />
        <textarea value={attributionText} onChange={(e) => setAttributionText(e.target.value)} placeholder="Attribution text" required />
        <button className="btn btn-primary" type="submit">Add license</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Holder</th><th>Status</th><th>Attribution</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item.id)}>
                <td>{String(item.rightsHolder)}</td>
                <td><span className="badge badge-pending">{String(item.status)}</span></td>
                <td>{String(item.attributionText)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function ModerationPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/moderation?status=pending', {}, getToken()).then(setItems).catch(console.error);
  }, []);

  async function review(id: string, status: string) {
    await api(`/admin/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, getToken());
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <Shell>
      <h1 className="page-title">Moderation</h1>
      <p className="page-sub">Review user imports</p>
      {items.length === 0 ? <div className="card">No pending items.</div> : items.map((item) => (
        <div className="card" key={String(item.id)}>
          <strong>{String(item.reason)}</strong>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn btn-accent" onClick={() => review(String(item.id), 'approved')}>Approve</button>
            <button className="btn btn-ghost" onClick={() => review(String(item.id), 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </Shell>
  );
}

function IngestionPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/ingestion', {}, getToken()).then(setItems).catch(console.error);
  }, []);

  return (
    <Shell>
      <h1 className="page-title">Ingestion</h1>
      <p className="page-sub">Background processing jobs</p>
      <div className="card">
        <table>
          <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item.id)}>
                <td>{String(item.sourceType)}</td>
                <td>{String(item.status)}</td>
                <td>{String(item.attempts)}</td>
                <td>{String(item.errorMessage ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <LoginPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/content" element={<RequireAuth><ContentPage /></RequireAuth>} />
      <Route path="/licenses" element={<RequireAuth><LicensesPage /></RequireAuth>} />
      <Route path="/moderation" element={<RequireAuth><ModerationPage /></RequireAuth>} />
      <Route path="/ingestion" element={<RequireAuth><IngestionPage /></RequireAuth>} />
    </Routes>
  );
}
