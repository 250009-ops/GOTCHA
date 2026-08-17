import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

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

  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match?.[1] ?? 'GOTCHA — Learn by reading';
  }, [pathname]);

  return null;
}
