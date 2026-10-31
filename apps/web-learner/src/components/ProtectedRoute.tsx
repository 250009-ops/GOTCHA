import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { withLocaleParams } from '../lib/authRoutes';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-g-blue-50">
        <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={withLocaleParams('/login', location.search)} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
