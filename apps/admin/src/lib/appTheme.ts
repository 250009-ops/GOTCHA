import { useEffect, useState } from 'react';

/** Admin colour theme. Dark mode is unfinished, so System and a stored "dark" stay light. */
export type AppTheme = 'system' | 'light' | 'dark';
const KEY = 'gotcha.admin.appTheme';

export function resolveTheme(_pref: AppTheme | null | undefined): 'light' {
  return 'light';
}

function storedPref(): AppTheme {
  const raw = localStorage.getItem(KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function useAppTheme(): [AppTheme, (t: AppTheme) => void] {
  const [pref, setPref] = useState<AppTheme>(() => storedPref());
  useEffect(() => {
    const next: AppTheme = pref === 'light' ? 'light' : 'system';
    localStorage.setItem(KEY, pref === 'dark' ? 'system' : next);
    document.documentElement.dataset.theme = 'light';
    if (pref === 'dark') setPref('system');
  }, [pref]);
  return [pref === 'dark' ? 'system' : pref, setPref];
}
