import { useEffect } from 'react';
import type { AppTheme } from '@gotcha/shared';

const KEY = 'gotcha.appTheme';

export function resolveTheme(pref: AppTheme | undefined | null): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppTheme(pref: AppTheme | undefined | null) {
  const p: AppTheme = pref ?? 'system';
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* private mode */
  }
  document.documentElement.dataset.theme = resolveTheme(p);
}

/** Keeps <html data-theme> in sync with the appTheme preference (and the OS when it is "system"). */
export function useAppTheme(pref: AppTheme | undefined | null) {
  useEffect(() => {
    if (pref == null) return; // not loaded yet — keep the pre-paint value from index.html
    applyAppTheme(pref);
    if ((pref ?? 'system') !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyAppTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
}
