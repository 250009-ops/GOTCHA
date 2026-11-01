import { useEffect } from 'react';
import type { AppTheme } from '@gotcha/shared';

const KEY = 'gotcha.appTheme';

/**
 * Dark mode is unfinished (hard-coded light panels on most pages).
 * Until those tokens cover every screen, System and any stored "dark" stay light.
 * Reader sepia/dark is a separate preference and is not affected.
 */
export function resolveTheme(_pref: AppTheme | undefined | null): 'light' | 'dark' {
  return 'light';
}

export function applyAppTheme(pref: AppTheme | undefined | null) {
  const stored: AppTheme = pref === 'light' ? 'light' : 'system';
  try {
    localStorage.setItem(KEY, stored);
  } catch {
    /* private mode */
  }
  document.documentElement.dataset.theme = 'light';
}

/** Keeps <html data-theme> light until the dark theme covers every page. */
export function useAppTheme(pref: AppTheme | undefined | null) {
  useEffect(() => {
    if (pref == null) return;
    applyAppTheme(pref === 'light' ? 'light' : 'system');
  }, [pref]);
}
