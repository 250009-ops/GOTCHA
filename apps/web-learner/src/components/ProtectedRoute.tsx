import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3FF]">
        <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Tester P0: a server error is not a logout. Keep the session and offer a retry.
  if (!user && sessionError) {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F5F3FF] px-6 text-center">
        <p className="text-base font-semibold text-[#101828]">Gotcha is temporarily unavailable.</p>
        <p className="text-sm text-[#4a5565]">You are still signed in. Please try again in a moment.</p>
        <button type="button" onClick={retrySession} className="h-11 rounded-lg bg-[#2107aa] px-5 text-sm font-semibold text-[var(--g-on-cta)]">
          Try again
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
