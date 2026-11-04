import type { NavigateFunction } from 'react-router-dom';

export const READER_LIBRARY_RETURN_KEY = 'gotcha.readerLibraryReturn';

export type ReaderLocationState = {
  libraryReturn?: string;
};

/** Safe in-app return targets for the reader "Library" back action. */
export function normalizeLibraryReturn(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/app')) return null;
  if (trimmed.startsWith('/app/read')) return null;
  return trimmed;
}

export function rememberReaderLibraryReturn(path: string | null | undefined): void {
  const normalized = normalizeLibraryReturn(path);
  if (normalized) {
    sessionStorage.setItem(READER_LIBRARY_RETURN_KEY, normalized);
  } else {
    sessionStorage.removeItem(READER_LIBRARY_RETURN_KEY);
  }
}

export function readStoredReaderLibraryReturn(): string | null {
  return normalizeLibraryReturn(sessionStorage.getItem(READER_LIBRARY_RETURN_KEY));
}

export function resolveReaderLibraryReturn(state: unknown): string {
  const fromState = normalizeLibraryReturn((state as ReaderLocationState | null)?.libraryReturn);
  if (fromState) return fromState;
  const fromStorage = readStoredReaderLibraryReturn();
  if (fromStorage) return fromStorage;
  return '/app';
}

export function openReader(
  navigate: NavigateFunction,
  contentId: string,
  libraryReturn?: string | null,
): void {
  const normalized = normalizeLibraryReturn(libraryReturn);
  rememberReaderLibraryReturn(normalized);
  navigate(`/app/read/${contentId}`, {
    state: normalized ? ({ libraryReturn: normalized } satisfies ReaderLocationState) : undefined,
  });
}
