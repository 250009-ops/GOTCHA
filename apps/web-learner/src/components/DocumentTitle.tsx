import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { learnerRoutePath } from '../lib/authRoutes';
import { useLearnerCopy } from '../lib/learnerLocaleContext';

export function DocumentTitle() {
  const { pathname } = useLocation();
  const routePath = learnerRoutePath(pathname);
  const copy = useLearnerCopy();

  useEffect(() => {
    const titles: Array<[RegExp, string]> = [
      [/^\/login\/?$/, copy.documentTitles.signIn],
      [/^\/register\/?$/, copy.documentTitles.register],
      [/^\/forgot-password\/?$/, copy.documentTitles.forgotPassword],
      [/^\/reset-password\/?$/, copy.documentTitles.resetPassword],
      [/^\/verify-email\/?$/, copy.documentTitles.verifyEmail],
      [/^\/app\/messages\/?$/, copy.documentTitles.messages],
      [/^\/app\/vocabulary\/?$/, copy.documentTitles.vocabulary],
      [/^\/app\/practice\/?$/, copy.documentTitles.practice],
      [/^\/app\/import/, copy.documentTitles.import],
      [/^\/app\/stats\/?$/, copy.documentTitles.statistics],
      [/^\/app\/notifications\/?$/, copy.documentTitles.notifications],
      [/^\/app\/settings\/?$/, copy.documentTitles.settings],
      [/^\/app\/read\//, copy.documentTitles.reader],
      [/^\/app\/?$/, copy.documentTitles.library],
    ];
    const match = titles.find(([pattern]) => pattern.test(routePath));
    document.title = match?.[1] ?? copy.documentTitles.default;
  }, [routePath, copy]);

  return null;
}
