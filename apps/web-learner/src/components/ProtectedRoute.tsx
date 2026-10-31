import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { withLocaleParams } from '../lib/authRoutes';
import { currentUiLang } from '../lib/api';
import { bootstrapRetryCopy } from '../lib/bootstrapPolicy';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-g-blue-50">
        <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && bootstrapError) {
    const t = bootstrapRetryCopy(currentUiLang());
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-3 bg-g-blue-50 p-6 text-center">
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <p className="text-sm text-slate-600">{t.body}</p>
        <button type="button" onClick={retryBootstrap} className="rounded-xl bg-violet-600 px-4 py-2 text-white">{t.retry}</button>
      </div>
    );
  }

  if (!user) {
    // final-6.1a: remember where the learner was going (e.g. /app/plus?from=landing-plus) for after sign-in.
    const back = encodeURIComponent(location.pathname + location.search);
    const to = location.pathname === '/app' && !location.search ? '/login' : `/login?returnUrl=${back}`;
    return <Navigate to={withLocaleParams(to, location.search)} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
