import { useEffect, useState } from 'react';

/** Admin colour theme (system | light | dark), stored per browser. Same keys/semantics as web-learner. */
export type AppTheme = 'system' | 'light' | 'dark';
const KEY = 'gotcha.admin.appTheme';

function resolve(p: AppTheme) {
  if (p !== 'system') return p;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useAppTheme(): [AppTheme, (t: AppTheme) => void] {
  const [pref, setPref] = useState<AppTheme>(() => (localStorage.getItem(KEY) as AppTheme) || 'system');
  useEffect(() => {
    localStorage.setItem(KEY, pref);
    document.documentElement.dataset.theme = resolve(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => (document.documentElement.dataset.theme = resolve('system'));
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  return [pref, setPref];
}
