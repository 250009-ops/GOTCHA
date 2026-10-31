import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { learnerRoutePath } from '../lib/authRoutes';

const TITLES: Array<[RegExp, string]> = [
  [/^\/login\/?$/, 'Sign in — GOTCHA'],
  [/^\/register\/?$/, 'Create account — GOTCHA'],
  [/^\/forgot-password\/?$/, 'Forgot password — GOTCHA'],
  [/^\/reset-password\/?$/, 'Reset password — GOTCHA'],
  [/^\/verify-email\/?$/, 'Verify email — GOTCHA'],
  [/^\/app\/messages\/?$/, 'Messages — GOTCHA'],
  [/^\/app\/vocabulary\/?$/, 'Vocabulary — GOTCHA'],
  [/^\/app\/practice\/?$/, 'Practice — GOTCHA'],
  [/^\/app\/import/, 'Import — GOTCHA'],
  [/^\/app\/stats\/?$/, 'Statistics — GOTCHA'],
  [/^\/app\/notifications\/?$/, 'Notifications — GOTCHA'],
  [/^\/app\/settings\/?$/, 'Settings — GOTCHA'],
  [/^\/app\/read\//, 'Reader — GOTCHA'],
  [/^\/app\/?$/, 'Library — GOTCHA'],
];

export function DocumentTitle() {
  const { pathname } = useLocation();
  const routePath = learnerRoutePath(pathname);

  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(routePath));
    document.title = match?.[1] ?? 'GOTCHA — Learn by reading';
  }, [routePath]);

  return null;
}
