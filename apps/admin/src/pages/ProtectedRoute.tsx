import { Outlet } from 'react-router-dom';
import { redirectToSharedLogin, useAuth } from '../lib/auth';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  }
  if (!user) {
    redirectToSharedLogin();
    return <div className="min-h-screen grid place-items-center text-slate-500">Redirecting to login…</div>;
  }
  return <Outlet />;
}
