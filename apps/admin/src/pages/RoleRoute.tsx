import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canOpen } from '../lib/routeRoles';

/** final-5 A16: a role that may not open this page gets a clear 403 screen instead of empty API errors. */
export function RoleRoute({ roles, children }: { roles: readonly string[] | undefined; children: ReactNode }) {
  const { user } = useAuth();
  if (canOpen(user?.role, roles)) return <>{children}</>;
  return (
    <div className="p-10 text-center" data-testid="forbidden">
      <div className="text-2xl font-semibold mb-2">403 — no access</div>
      <p className="text-slate-500 mb-4">Your admin role ({user?.role ?? 'none'}) cannot open this page.</p>
      <Link to="/" className="text-[#6c1d95] font-medium hover:underline">Back to the admin home</Link>
    </div>
  );
}
