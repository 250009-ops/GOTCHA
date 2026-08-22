const RETURN_KEY = 'gotcha:admin:content-library-return';
const DRAFT_PREFIX = 'gotcha:admin:content-editor-draft:';

export function saveContentLibraryReturn(path: string) {
  if (!path.startsWith('/content') || path.includes('/edit') || path === '/content/new') return;
  sessionStorage.setItem(RETURN_KEY, path);
}

export function getContentLibraryReturn(fallback = '/content'): string {
  return sessionStorage.getItem(RETURN_KEY) ?? fallback;
}

export function catalogListHref(tabPath: string, query: string) {
  return `${tabPath}${query}`;
}

export type ContentEditorDraft = {
  savedAt: number;
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  cefrLevel: string;
  contentType: string;
  isFree: boolean;
  priceUsd: string;
  sourceMode: 'paste' | 'url' | 'pdf';
  plainText: string;
  sourceUrl: string;
  preview: unknown | null;
  openChapters: Record<number, boolean>;
};

function draftKey(id: string | undefined) {
  return `${DRAFT_PREFIX}${id ?? 'new'}`;
}

export function loadContentEditorDraft(id: string | undefined): ContentEditorDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as ContentEditorDraft;
  } catch {
    return null;
  }
}

export function saveContentEditorDraft(id: string | undefined, draft: ContentEditorDraft) {
  sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
}

export function clearContentEditorDraft(id: string | undefined) {
  sessionStorage.removeItem(draftKey(id));
}

export function isBlankContentEditorDraft(draft: ContentEditorDraft): boolean {
  return (
    !draft.title.trim() &&
    !draft.author.trim() &&
    !draft.description.trim() &&
    !draft.genre.trim() &&
    !draft.plainText.trim() &&
    !draft.sourceUrl.trim() &&
    !draft.preview
  );
}

/** Ignore empty autosaves that would wipe title/author after the server payload loads. */
export function shouldRestoreEditorDraft(
  draft: ContentEditorDraft | null,
  server?: { title?: string | null; author?: string | null },
): draft is ContentEditorDraft {
  if (!draft) return false;
  if (Date.now() - draft.savedAt > 1000 * 60 * 60 * 24) return false;
  if (isBlankContentEditorDraft(draft)) return false;
  if (server?.title?.trim() && !draft.title.trim()) return false;
  return true;
}
