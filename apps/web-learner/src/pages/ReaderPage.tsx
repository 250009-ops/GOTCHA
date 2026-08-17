import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Volume2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { CatalogPaywall } from '../components/CatalogPaywall';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatUzs } from '../lib/importBilling';
import type { ContentItem, ContentOutlineSegment, ContentSegment, LookupResult, WordStatus } from '../lib/types';
import { clampPhraseSpan, extractSentenceAround, findPhraseTokenRange, isSentenceLikeSelection, lookupHeadline, tokenInSpan, type TokenSpan } from '../lib/phraseSpan';

function displayChapterTitle(title: string | undefined | null, fallbackIndex: number) {
  const raw = title?.trim().replace(/^#+\s*/, '') ?? '';
  if (!raw) return `Chapter ${fallbackIndex + 1}`;
  return raw;
}

function chapterKeyOf(
  item: { chapterIndex?: number; title?: string | null; chapterTitle?: string | null },
  fallbackIndex: number,
) {
  if (typeof item.chapterIndex === 'number') return item.chapterIndex;
  const match = (item.chapterTitle || item.title || '').match(/^chapter\s+(\d+)/i);
  if (match) return Number(match[1]);
  return fallbackIndex;
}

type ResumeMark = { segmentId?: string; segmentIndex?: number };

function resumeStorageKey(contentId: string) {
  return `gotcha.reader.resume.${contentId}`;
}

function readResume(contentId: string): ResumeMark | null {
  try {
    const raw = localStorage.getItem(resumeStorageKey(contentId));
    if (!raw) return null;
    return JSON.parse(raw) as ResumeMark;
  } catch {
    return null;
  }
}

function writeResume(contentId: string, mark: ResumeMark) {
  try {
    localStorage.setItem(resumeStorageKey(contentId), JSON.stringify(mark));
  } catch {
    /* ignore quota */
  }
}

function resolveResumeIndex(
  pages: ContentOutlineSegment[],
  apiSegmentId?: string | null,
  local?: ResumeMark | null,
) {
  const localIdx = local?.segmentId
    ? pages.findIndex((s) => s.id === local.segmentId)
    : -1;
  if (localIdx >= 0) return localIdx;
  const apiIdx = apiSegmentId ? pages.findIndex((s) => s.id === apiSegmentId) : -1;
  if (apiIdx >= 0) return apiIdx;
  if (
    typeof local?.segmentIndex === 'number' &&
    local.segmentIndex >= 0 &&
    local.segmentIndex < pages.length
  ) {
    return local.segmentIndex;
  }
  return 0;
}

const STATUS_STYLES: Record<WordStatus, string> = {
  unknown: 'border-b-[1.6px] border-dashed border-[#ffb900] text-[#973c00] cursor-pointer hover:bg-amber-50/80 rounded-[6px]',
  learning: 'border-b-[1.6px] border-solid border-[#51a2ff] text-[#193cb8] cursor-pointer hover:bg-blue-50/80 rounded-[6px]',
  known: 'cursor-pointer hover:bg-gray-100/80 rounded-[6px]',
  ignored: 'text-gray-400 cursor-pointer hover:bg-gray-100/80 rounded-[6px]',
};

const LONG_PRESS_MS = 380;
const DRAG_CANCEL_PX = 10;

function DictionaryPanel({
  result,
  status,
  onClose,
  onSave,
  onKnown,
  onIgnore,
  onPronounce,
  loading,
  ttsEnabled,
}: {
  result: LookupResult | null;
  status: WordStatus;
  onClose: () => void;
  onSave: () => void;
  onKnown: () => void;
  onIgnore: () => void;
  onPronounce: () => void;
  loading: boolean;
  ttsEnabled: boolean;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f3f4f6] shrink-0">
        <span className="text-xs font-semibold text-[#99a1af] uppercase tracking-[0.6px]">Dictionary</span>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-[#99a1af] hover:text-gray-600 transition-colors" aria-label="Close dictionary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-6 h-6 text-[#7f22fe] animate-spin" />
            <span className="text-sm text-[#99a1af]">Looking up…</span>
          </div>
        )}
        {!loading && result && (
          <>
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-bold text-[#101828] break-words">
                      {result.kind === 'sentence' ? result.lemma : (result.phrase?.trim() || result.lemma)}
                    </span>
                    {result.kind !== 'sentence' && result.phrase?.trim() ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#f5f3ff] text-[#7f22fe]">
                        Phrase
                      </span>
                    ) : result.kind === 'sentence' ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#f5f3ff] text-[#7f22fe]">
                        Sentence
                      </span>
                    ) : null}
                  </div>
                  {result.kind !== 'sentence' && result.phrase?.trim() && result.lemma.trim() && result.phrase.trim().toLowerCase() !== result.lemma.trim().toLowerCase() ? (
                    <div className="text-sm text-[#6b7382] mt-1">{result.lemma}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onPronounce}
                  disabled={!ttsEnabled}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors shrink-0',
                    ttsEnabled
                      ? 'hover:bg-gray-100 text-[#99a1af] hover:text-[#7f22fe]'
                      : 'text-gray-300 cursor-not-allowed',
                  )}
                  aria-label="Pronounce"
                  title={ttsEnabled ? 'Pronounce word' : 'Enable TTS in Settings'}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {result.kind !== 'sentence' && result.contextualMeaning?.trim() ? (
              <div className="bg-[#f5f3ff] rounded-xl p-3">
                <div className="text-xs font-semibold text-[#7f22fe] uppercase tracking-wider mb-1">Natural meaning</div>
                <div className="text-[#1e2939] leading-relaxed">{result.contextualMeaning}</div>
              </div>
            ) : null}
            <div className={result.kind !== 'sentence' && result.contextualMeaning?.trim() ? 'rounded-xl p-3 border border-[#e5e8eb] bg-[#f9fafb]' : 'bg-[#f5f3ff] rounded-xl p-3'}>
              <div className="text-xs font-semibold text-[#7f22fe] uppercase tracking-wider mb-1">Translation</div>
              <div className="text-[#1e2939] leading-relaxed whitespace-pre-wrap break-words">{result.translation}</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={cn('px-2 py-1 rounded-md font-medium', {
                'bg-[#fffbeb] text-[#bb4d00]': status === 'unknown',
                'bg-[#eff6ff] text-[#1447e6]': status === 'learning',
                'bg-emerald-100 text-emerald-700': status === 'known',
                'bg-gray-100 text-gray-500': status === 'ignored',
              })}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
              <span className="text-[#99a1af]">→ Mark as:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={status === 'learning'}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  status === 'learning' ? 'border-blue-200 bg-blue-50 text-[#1447e6]' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-[#4a5565] hover:text-[#1447e6]',
                )}
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={onKnown}
                disabled={status === 'known'}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  status === 'known' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-[#4a5565] hover:text-emerald-600',
                )}
              >
                <Check className="w-4 h-4" />
                <span>Known</span>
              </button>
              <button
                type="button"
                onClick={onIgnore}
                disabled={status === 'ignored'}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  status === 'ignored' ? 'border-gray-300 bg-gray-100 text-gray-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-[#4a5565]',
                )}
              >
                <EyeOff className="w-4 h-4" />
                <span>Ignore</span>
              </button>
            </div>
          </>
        )}
        {!loading && !result && (
          <div className="text-center py-10 text-[#99a1af]">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <div className="text-sm">Tap a word to catch its phrase, or drag any span — even the whole page</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, preferences, updatePreferences, refreshVocab } = useAuth();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [outline, setOutline] = useState<ContentOutlineSegment[]>([]);
  const [pageCache, setPageCache] = useState<Record<number, ContentSegment>>({});
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [lockedSpan, setLockedSpan] = useState<TokenSpan | null>(null);
  const [liveSpan, setLiveSpan] = useState<TokenSpan | null>(null);
  const [activeLookup, setActiveLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [fontScale, setFontScale] = useState(preferences?.readerFontScale ?? 1);
  const [showUnknownOnly, setShowUnknownOnly] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [wordStatuses, setWordStatuses] = useState<Record<string, WordStatus>>({});
  const [loading, setLoading] = useState(true);
  const [pageDraft, setPageDraft] = useState('1');
  const [accessNonce, setAccessNonce] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const readingPaneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    pointerType: string;
    originX: number;
    originY: number;
    anchorI: number;
    endI: number;
    armed: boolean;
    timer: number | null;
    host: HTMLElement;
  } | null>(null);

  const pageCount = outline.length;
  const trialLimit =
    content?.accessGranted === false ? Math.max(0, content.trialSegmentCount ?? 0) : pageCount;
  const isTrial = Boolean(content?.accessGranted === false && trialLimit > 0);
  const segment = pageCache[segmentIndex];
  const literary = content?.contentType === 'book' || content?.contentType === 'story';
  const chapterGroups = useMemo(() => {
    if (!literary) return null;
    const groups: Array<{ key: number; title: string; firstIndex: number; pageCount: number }> = [];
    const byKey = new Map<number, { key: number; title: string; firstIndex: number; pageCount: number }>();
    outline.forEach((seg, i) => {
      const key = chapterKeyOf(seg, i);
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          title: displayChapterTitle(seg.chapterTitle || seg.title?.split(' · ')[0], key),
          firstIndex: i,
          pageCount: 0,
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.pageCount += 1;
    });
    return groups;
  }, [literary, outline]);
  const currentChapter = useMemo(() => {
    if (!chapterGroups?.length) return null;
    const current = outline[segmentIndex];
    if (!current) return chapterGroups[0];
    const key = chapterKeyOf(current, segmentIndex);
    return chapterGroups.find((g) => g.key === key) ?? chapterGroups[0];
  }, [chapterGroups, outline, segmentIndex]);
  const pageInChapter = useMemo(() => {
    if (!currentChapter) return { current: segmentIndex + 1, total: Math.max(1, pageCount) };
    const pages = outline
      .map((seg, index) => ({ seg, index }))
      .filter(({ seg, index }) => chapterKeyOf(seg, index) === currentChapter.key);
    const pos = pages.findIndex(({ index }) => index === segmentIndex);
    return { current: Math.max(1, pos + 1), total: Math.max(1, pages.length) };
  }, [outline, segmentIndex, currentChapter, pageCount]);
  const targetLang = user?.nativeLanguage ?? 'en';
  const sourceLang = content?.language ?? 'en';
  const ttsEnabled = preferences?.ttsEnabled ?? false;

  const pronounceWord = useCallback(() => {
    if (!activeWord || !ttsEnabled) return;
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(activeWord);
    utterance.lang = sourceLang;
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [activeWord, sourceLang, ttsEnabled]);

  // Wall-clock time spent since the last progress save, so PATCH /content/:id/progress
  // gets a real `readSeconds` and content.service.ts's streak.recordActivity actually fires
  // (see docs/E2E_AUDIT_REPORT.md's reading-page-never-triggers-streak finding).
  const lastProgressAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (preferences?.readerFontScale != null) {
      setFontScale(preferences.readerFontScale);
    }
  }, [preferences?.readerFontScale]);

  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const pageCacheRef = useRef(pageCache);
  pageCacheRef.current = pageCache;

  const loadPage = useCallback(async (index: number) => {
    if (!id || index < 0) return;
    const meta = outlineRef.current[index];
    if (!meta || pageCacheRef.current[index]) return;
    const res = await api<{ segments: ContentSegment[] }>(
      `/content/${id}/segments?from=${meta.segmentIndex}&limit=1`,
    );
    const page = res.segments?.[0];
    if (!page) return;
    setPageCache((prev) => (prev[index] ? prev : { ...prev, [index]: page }));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPageCache({});
    setOutline([]);
    Promise.all([
      api<ContentItem>(`/content/${id}`),
      api<Array<{ lemma: string; status: string }>>('/reading/known-words'),
    ]).then(async ([item, known]) => {
      setContent(item);
      const trialCount = item.trialSegmentCount ?? 0;
      const canTrial = item.accessGranted === false && trialCount > 0;
      if (item.accessGranted === false && !canTrial) {
        setOutline([]);
        setPageCache({});
        setPaywallOpen(true);
        return;
      }
      setPaywallOpen(false);
      let pages = item.outline ?? [];
      const cache: Record<number, ContentSegment> = {};
      if (!pages.length) {
        const first = await api<{ segments: ContentSegment[] }>(
          `/content/${id}/segments?from=0&limit=${canTrial ? Math.max(trialCount, 1) : 200}`,
        );
        const segs = first.segments ?? [];
        pages = segs.map((s) => ({
          id: s.id,
          segmentIndex: s.segmentIndex,
          chapterIndex: s.chapterIndex,
          chapterTitle: s.chapterTitle,
          pageIndex: s.pageIndex,
          title: s.title,
          wordCount: s.wordCount,
        }));
        segs.forEach((s, i) => {
          cache[i] = s;
        });
      }
      setOutline(pages);
      let start = resolveResumeIndex(pages, item.currentSegmentId, readResume(id));
      if (canTrial) start = Math.min(start, Math.max(trialCount - 1, 0));
      setSegmentIndex(start);
      writeResume(id, { segmentId: pages[start]?.id, segmentIndex: start });
      if (!cache[start] && pages[start]) {
        const res = await api<{ segments: ContentSegment[] }>(
          `/content/${id}/segments?from=${pages[start].segmentIndex}&limit=1`,
        );
        if (res.segments?.[0]) cache[start] = res.segments[0];
      }
      setPageCache(cache);
      const map: Record<string, WordStatus> = {};
      for (const w of known) {
        map[w.lemma.toLowerCase()] = (w.status as WordStatus) ?? 'known';
      }
      setWordStatuses(map);
      lastProgressAtRef.current = Date.now();
    }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [id, accessNonce]);

  const lemmaStatus = useCallback(
    (lemma: string): WordStatus => wordStatuses[lemma.toLowerCase()] ?? 'unknown',
    [wordStatuses],
  );

  const { unknownCount, learningCount } = useMemo(() => {
    const unknown = new Set<string>();
    const learning = new Set<string>();
    for (const seg of Object.values(pageCache)) {
      for (const t of seg.tokenMap ?? []) {
        if (!t.isWord) continue;
        const key = (t.lemma ?? t.surface).toLowerCase();
        const status = lemmaStatus(key);
        if (status === 'unknown') unknown.add(key);
        if (status === 'learning') learning.add(key);
      }
    }
    return { unknownCount: unknown.size, learningCount: learning.size };
  }, [pageCache, lemmaStatus]);

  const persistFontScale = (next: number) => {
    setFontScale(next);
    void updatePreferences({ readerFontScale: next }).catch(() => undefined);
  };

  const handleWordClick = useCallback(
    async (lemma: string, surface: string, sentence: string, span: TokenSpan, wordTokens: Array<{ i: number; surface: string; lemma: string | null }>) => {
      setLockedSpan(span);
      setLiveSpan(null);
      setActiveWord(lemma);
      setDictOpen(true);
      setLookupLoading(true);
      setActiveLookup(null);
      try {
        const res = await api<LookupResult>('/ai/lookup', {
          method: 'POST',
          body: JSON.stringify({
            token: surface.slice(0, 4000),
            lemma: lemma.slice(0, 4000),
            sentence,
            sourceLang,
            targetLang,
          }),
        });
        const sentenceLike = res.kind === 'sentence' || isSentenceLikeSelection(surface, sentence);
        const phrase = sentenceLike
          ? null
          : (res.phrase?.trim() || (surface.trim().split(/\s+/).length >= 2 && surface.trim().split(/\s+/).length <= 8 ? surface.trim() : null));
        if (phrase) {
          const found = findPhraseTokenRange(wordTokens, phrase, span.startI);
          if (found) setLockedSpan(found);
        } else {
          setLockedSpan(span);
        }
        const head = sentenceLike ? surface : (phrase || res.lemma || lemma);
        setActiveLookup({
          ...res,
          lemma: sentenceLike ? (res.lemma || lookupHeadline(surface)) : (res.lemma ?? lemma),
          phrase: phrase ?? res.phrase ?? null,
          kind: res.kind ?? (sentenceLike ? 'sentence' : phrase ? 'phrase' : 'word'),
        });
        if (head) setActiveWord(head);
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Lookup failed';
        let message = raw;
        if (/disabled by an administrator/i.test(raw)) {
          message = 'AI lookups are temporarily disabled. Please try again later.';
        } else if (/platform ai daily limit/i.test(raw)) {
          message = 'AI lookups are paused for today (platform daily limit). Try again tomorrow.';
        } else if (/quota exceeded|daily limit reached|lookup limit reached/i.test(raw)) {
          message = 'Daily AI lookup limit reached. Try again tomorrow.';
        } else if (/not configured|OPENAI_API_KEY/i.test(raw)) {
          message = 'AI lookup is unavailable right now. Please try again later.';
        } else if (/AI lookup failed/i.test(raw)) {
          message = 'AI lookup failed. Please try again in a moment.';
        }
        toast.error(message);
      } finally {
        setLookupLoading(false);
      }
    },
    [sourceLang, targetLang],
  );

  const markStatus = async (status: WordStatus) => {
    if (!activeWord) return;
    try {
      await api('/reading/known-words', {
        method: 'PUT',
        body: JSON.stringify({ lemma: activeWord, sourceLang, status }),
      });
      setWordStatuses((p) => ({ ...p, [activeWord]: status }));
      toast.success(`"${activeWord}" marked as ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleSave = async () => {
    if (!activeWord || !activeLookup || !segment || !id) return;
    try {
      await api('/vocabulary', {
        method: 'POST',
        body: JSON.stringify({
          lemma: activeWord,
          sourceLang,
          targetLang,
          translation: activeLookup.translation,
          contextSentence: segment.plainText.slice(0, 200),
          contextSegmentId: segment.id,
          contentId: id,
        }),
      });
      setWordStatuses((p) => ({ ...p, [activeWord]: 'learning' }));
      toast.success(`"${activeWord}" saved to vocabulary`);
      void refreshVocab().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const saveProgress = useCallback(async (nextIndex: number, completed = false) => {
    if (!id || !pageCount) return;
    const segmentId = outlineRef.current[nextIndex]?.id ?? pageCacheRef.current[nextIndex]?.id;
    writeResume(id, { segmentId, segmentIndex: nextIndex });
    const pct = Math.round(((nextIndex + 1) / pageCount) * 100);
    const readSeconds = Math.max(0, Math.round((Date.now() - lastProgressAtRef.current) / 1000));
    lastProgressAtRef.current = Date.now();
    try {
      await api(`/content/${id}/progress`, {
        method: 'PUT',
        body: JSON.stringify({
          segmentId,
          progressPct: completed ? 100 : pct,
          completed,
          readSeconds,
        }),
      });
    } catch {
      /* non-blocking — local resume still holds the page */
    }
  }, [id, pageCount]);

  const goToSegment = useCallback((index: number) => {
    if (index < 0 || index >= outlineRef.current.length) return;
    const limit =
      content?.accessGranted === false
        ? Math.max(0, content.trialSegmentCount ?? 0)
        : outlineRef.current.length;
    if (content?.accessGranted === false && index >= limit) {
      setPaywallOpen(true);
      return;
    }
    setSegmentIndex(index);
    setActiveWord(null);
    setLockedSpan(null);
    setLiveSpan(null);
    setActiveLookup(null);
    readingPaneRef.current?.scrollTo({ top: 0 });
    if (id) {
      writeResume(id, {
        segmentId: outlineRef.current[index]?.id,
        segmentIndex: index,
      });
    }
    void (async () => {
      await loadPage(index);
      void loadPage(index - 1);
      void loadPage(index + 1);
      void saveProgress(index);
    })();
  }, [id, loadPage, saveProgress, content?.accessGranted, content?.trialSegmentCount]);

  const goNext = () => {
    if (segmentIndex < pageCount - 1) goToSegment(segmentIndex + 1);
  };

  const goPrev = () => {
    if (segmentIndex > 0) goToSegment(segmentIndex - 1);
  };

  const commitPageJump = () => {
    const raw = Number.parseInt(pageDraft.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(raw)) {
      setPageDraft(String(pageInChapter.current));
      return;
    }
    const total = pageInChapter.total;
    const nextPage = Math.min(Math.max(raw, 1), total);
    setPageDraft(String(nextPage));
    if (currentChapter) {
      goToSegment(currentChapter.firstIndex + nextPage - 1);
      return;
    }
    goToSegment(nextPage - 1);
  };

  useEffect(() => {
    setPageDraft(String(pageInChapter.current));
  }, [pageInChapter.current]);

  useEffect(() => {
    if (!id || !pageCount) return;
    const flush = () => {
      void saveProgress(segmentIndex);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [id, pageCount, segmentIndex, saveProgress]);

  const closeDict = () => {
    setDictOpen(false);
    setActiveWord(null);
    setLockedSpan(null);
    setLiveSpan(null);
    setActiveLookup(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFF]">
        <div className="w-8 h-8 border-2 border-violet-300 border-t-[#7f22fe] rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FDFCFF]">
        <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center gap-3 px-4 shrink-0">
          <button type="button" onClick={() => navigate('/app')} className="flex items-center gap-1.5 text-[#6a7282] hover:text-[#1e2939] text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6 text-[#99a1af] text-sm">Content not found</div>
      </div>
    );
  }

  if (content.accessGranted === false && !isTrial) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FDFCFF]">
        <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center gap-3 px-4 shrink-0">
          <button type="button" onClick={() => navigate('/app')} className="flex items-center gap-1.5 text-[#6a7282] hover:text-[#1e2939] text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <CatalogPaywall
            contentId={content.id}
            title={content.title}
            priceUzs={content.priceUzs ?? 0}
            onUnlocked={() => {
              setLoading(true);
              setAccessNonce((n) => n + 1);
            }}
          />
        </div>
      </div>
    );
  }

  if (!pageCount) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FDFCFF]">
        <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center gap-3 px-4 shrink-0">
          <button type="button" onClick={() => navigate('/app')} className="flex items-center gap-1.5 text-[#6a7282] hover:text-[#1e2939] text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-[#99a1af]">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-[#4a5565] font-medium">No content segments available</div>
            <div className="text-sm mt-1">This item may still be processing.</div>
          </div>
        </div>
      </div>
    );
  }

  const tokens = segment?.tokenMap ?? [];
  const currentChapterLabel = currentChapter?.title
    || displayChapterTitle(segment?.chapterTitle || segment?.title || outline[segmentIndex]?.chapterTitle || outline[segmentIndex]?.title, segmentIndex);
  const zoomPct = Math.round(fontScale * 100);
  const readerTheme = preferences?.readerTheme ?? 'light';
  const pageTone =
    readerTheme === 'sepia'
      ? 'bg-[#F4E8D0] text-[#3D2B1F]'
      : readerTheme === 'dark'
        ? 'bg-[#1C1917] text-[#F5F5F4]'
        : 'bg-[#FDFCFF]';

  return (
    <div className={cn('flex flex-col h-screen max-h-dvh overflow-hidden', pageTone)}>
      {/* Header — Figma 8:5841 */}
      <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center gap-2 sm:gap-3 px-3 sm:px-4 shrink-0 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="flex items-center gap-1.5 text-[#6a7282] hover:text-[#1e2939] text-sm font-medium shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Library</span>
        </button>
        <div className="w-px h-4 bg-[#e5e7eb] shrink-0" />
        <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
          <span className="font-semibold text-[#1e2939] text-sm truncate">{content.title}</span>
          <span className="hidden md:inline text-xs text-[#99a1af] truncate shrink min-w-0">{currentChapterLabel}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#fffbeb] border border-[#fee685] rounded-full px-2.5 py-1">
            <span className="size-2 rounded bg-[#ffb900]" />
            <span className="text-xs font-medium text-[#bb4d00] whitespace-nowrap">{unknownCount} unknown</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#eff6ff] border border-[#bedbff] rounded-full px-2.5 py-1">
            <span className="size-2 rounded bg-[#51a2ff]" />
            <span className="text-xs font-medium text-[#1447e6] whitespace-nowrap">{learningCount} learning</span>
          </div>
          <span className="bg-[#dbeafe] text-[#1447e6] text-[10px] font-semibold rounded-lg px-1.5 py-0.5 leading-[15px]">
            {content.cefrLevel.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => persistFontScale(Math.max(0.75, Math.round((fontScale - 0.1) * 10) / 10))}
            className="p-1.5 rounded-[10px] hover:bg-gray-100 text-[#6a7282]"
            aria-label="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-[#99a1af] w-8 text-center tabular-nums">{zoomPct}%</span>
          <button
            type="button"
            onClick={() => persistFontScale(Math.min(1.5, Math.round((fontScale + 0.1) * 10) / 10))}
            className="p-1.5 rounded-[10px] hover:bg-gray-100 text-[#6a7282]"
            aria-label="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#e5e7eb] mx-1" />
          <button
            type="button"
            onClick={() => setShowUnknownOnly((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 p-1.5 rounded-[10px] text-xs font-medium transition-colors',
              showUnknownOnly ? 'bg-[#f5f3ff] text-[#7008e7]' : 'hover:bg-gray-100 text-[#6a7282]',
            )}
            aria-pressed={showUnknownOnly}
            title="Show only unknown-word highlights"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unknown only</span>
          </button>
          <div className="w-px h-4 bg-[#e5e7eb] mx-1" />
          <button
            type="button"
            onClick={() => navigate(`/app/practice?contentId=${id}&segmentId=${segment?.id ?? outline[segmentIndex]?.id ?? ''}`)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-[10px] text-xs font-medium text-[#7008e7] hover:bg-[#f5f3ff] transition-colors"
            title="Quiz yourself on this chapter"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Practice</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Chapters sidebar — Figma ChapterPanel */}
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-[#e5e7eb] bg-white shrink-0 transition-[width] duration-200 overflow-hidden',
            chaptersOpen ? 'w-56' : 'w-10',
          )}
        >
          {chaptersOpen ? (
            <>
              <div className="px-4 py-3 border-b border-[#f3f4f6]">
                <div className="text-xs font-semibold text-[#99a1af] uppercase tracking-[0.6px]">Chapters</div>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {chapterGroups
                  ? chapterGroups.map((group) => {
                      const activeHere = segmentIndex >= group.firstIndex
                        && segmentIndex < group.firstIndex + group.pageCount;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => goToSegment(group.firstIndex)}
                          className={cn(
                            'w-full text-left px-4 py-2.5 transition-colors',
                            activeHere ? 'bg-[#f5f3ff] border-r-[1.6px] border-[#7f22fe]' : 'hover:bg-gray-50 border-r-[1.6px] border-transparent',
                          )}
                        >
                          <div className={cn('text-sm font-medium truncate', activeHere ? 'text-[#4d179a]' : 'text-[#4a5565]')}>
                            {group.title}
                          </div>
                          {group.pageCount > 1 && (
                            <div className={cn('text-xs mt-0.5', activeHere ? 'text-[#7008e7]' : 'text-[#99a1af]')}>
                              {group.pageCount} pages
                            </div>
                          )}
                        </button>
                      );
                    })
                  : outline.map((seg, i) => {
                      const active = i === segmentIndex;
                      return (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => goToSegment(i)}
                          className={cn(
                            'w-full text-left px-4 py-3 transition-colors',
                            active ? 'bg-[#f5f3ff] border-r-[1.6px] border-[#7f22fe]' : 'hover:bg-gray-50 border-r-[1.6px] border-transparent',
                          )}
                        >
                          <div className={cn('text-xs font-semibold', active ? 'text-[#7008e7]' : 'text-[#99a1af]')}>
                            {pageCount > 1 ? `Page ${i + 1}` : 'Content'}
                          </div>
                          <div className={cn('text-sm font-medium truncate mt-0.5', active ? 'text-[#4d179a]' : 'text-[#4a5565]')}>
                            {displayChapterTitle(seg.chapterTitle || seg.title, i)}
                          </div>
                        </button>
                      );
                    })}
              </div>
              <button
                type="button"
                onClick={() => setChaptersOpen(false)}
                className="h-8 border-t border-[#f3f4f6] flex items-center justify-center gap-1 text-xs font-medium text-[#99a1af] hover:text-[#4a5565] hover:bg-gray-50 transition-colors"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
                Collapse
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setChaptersOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-[#99a1af] hover:text-[#7008e7] hover:bg-[#f5f3ff] transition-colors"
              title="Expand chapters"
            >
              <PanelLeftOpen className="w-4 h-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180">Chapters</span>
            </button>
          )}
        </aside>

        {/* Main reading pane */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div ref={readingPaneRef} className="flex-1 min-h-0 overflow-y-auto">
          {/* Mobile chapter chips */}
          <div className="md:hidden flex gap-2 overflow-x-auto px-4 pt-3 pb-1 scrollbar-hide">
            {(chapterGroups ?? outline.map((seg, i) => ({
              key: i,
              title: displayChapterTitle(seg.chapterTitle || seg.title, i),
              firstIndex: i,
              pageCount: 1,
            }))).map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => goToSegment(group.firstIndex)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[12rem] truncate',
                  segmentIndex >= group.firstIndex && segmentIndex < group.firstIndex + group.pageCount
                    ? 'bg-[#f5f3ff] border-[#7f22fe] text-[#7008e7]'
                    : 'bg-white border-gray-200 text-[#4a5565]',
                )}
              >
                {group.title}
              </button>
            ))}
          </div>

          <div
            className="max-w-[68ch] mx-auto px-5 py-8 lg:py-12 pb-6"
            style={{ fontSize: `${fontScale}rem` }}
          >
            {isTrial ? (
              <div className="mb-6 rounded-xl border border-violet-200 bg-[#f5f3ff] px-4 py-3 text-sm text-[#4d179a]">
                Free sample of this book. Unlock the rest for {formatUzs(content.priceUzs ?? 0)}.
              </div>
            ) : null}
            <div className="mb-8">
              <div className="text-xs font-semibold text-[#8e51ff] uppercase tracking-[1.2px] mb-1">
                {chapterGroups
                  ? `Chapter ${(chapterGroups.findIndex((g) => g.key === currentChapter?.key) + 1) || 1} of ${chapterGroups.length}`
                  : `${segmentIndex + 1} of ${pageCount}`}
              </div>
              <h1 className="text-2xl font-bold text-[#101828] font-serif leading-8">
                {currentChapterLabel}
              </h1>
            </div>

            <div
              className="text-[#1e2939] leading-[1.9] font-serif select-none touch-pan-y"
              onPointerDown={(e) => {
                if (e.button !== 0 || !segment) return;
                const el = (e.target as HTMLElement | null)?.closest?.('[data-token-i]');
                if (!el) return;
                const i = Number(el.getAttribute('data-token-i'));
                if (!Number.isFinite(i)) return;
                if (dragRef.current?.timer) window.clearTimeout(dragRef.current.timer);
                const isTouch = e.pointerType === 'touch';
                const timer = isTouch
                  ? window.setTimeout(() => {
                      const drag = dragRef.current;
                      if (!drag || drag.pointerId !== e.pointerId) return;
                      drag.armed = true;
                      try {
                        drag.host.setPointerCapture(drag.pointerId);
                      } catch {
                        // Capture can fail if the pointer already ended.
                      }
                      setLiveSpan({ startI: drag.anchorI, endI: drag.endI });
                    }, LONG_PRESS_MS)
                  : null;
                dragRef.current = {
                  pointerId: e.pointerId,
                  pointerType: e.pointerType,
                  originX: e.clientX,
                  originY: e.clientY,
                  anchorI: i,
                  endI: i,
                  armed: !isTouch,
                  timer,
                  host: e.currentTarget,
                };
                if (!isTouch) {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setLiveSpan({ startI: i, endI: i });
                }
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== e.pointerId || !segment) return;
                const dist = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY);
                if (!drag.armed) {
                  if (dist > DRAG_CANCEL_PX && drag.timer != null) {
                    window.clearTimeout(drag.timer);
                    drag.timer = null;
                    dragRef.current = null;
                  }
                  return;
                }
                e.preventDefault();
                const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-token-i]');
                if (!hit) return;
                const i = Number(hit.getAttribute('data-token-i'));
                if (!Number.isFinite(i) || i === drag.endI) return;
                drag.endI = i;
                const words = segment.tokenMap.filter((token) => token.isWord);
                const span = clampPhraseSpan(words, drag.anchorI, i);
                if (span) setLiveSpan(span);
              }}
              onPointerUp={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== e.pointerId || !segment) return;
                if (drag.timer != null) window.clearTimeout(drag.timer);
                dragRef.current = null;
                setLiveSpan(null);
                const words = segment.tokenMap.filter((token) => token.isWord);
                const span = clampPhraseSpan(words, drag.anchorI, drag.endI);
                if (!span) return;
                if (!drag.armed && drag.pointerType === 'touch') {
                  // Short tap: still look up the word under the finger.
                }
                const inRange = words.filter((token) => token.i >= span.startI && token.i <= span.endI);
                if (!inRange.length) return;
                const first = inRange[0]!;
                const last = inRange[inRange.length - 1]!;
                const surface = segment.plainText.slice(first.start, last.end).trim();
                const lemma = inRange.map((token) => (token.lemma ?? token.surface).toLowerCase()).join(' ');
                void handleWordClick(
                  lemma,
                  surface,
                  extractSentenceAround(segment.plainText, first.start, last.end),
                  span,
                  words,
                );
              }}
              onPointerCancel={() => {
                if (dragRef.current?.timer != null) window.clearTimeout(dragRef.current.timer);
                dragRef.current = null;
                setLiveSpan(null);
              }}
            >
              {!segment ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-[#7f22fe] animate-spin" />
                </div>
              ) : tokens.map((token) => {
                if (!token.isWord) {
                  return <span key={token.i}>{token.surface}</span>;
                }
                const key = (token.lemma ?? token.surface).toLowerCase();
                const status = lemmaStatus(key);
                const highlightStatus: WordStatus | null = showUnknownOnly
                  ? status === 'unknown'
                    ? 'unknown'
                    : null
                  : status === 'unknown' || status === 'learning'
                    ? status
                    : status === 'ignored'
                      ? 'ignored'
                      : null;
                const selected = tokenInSpan(token.i, liveSpan ?? lockedSpan);

                return (
                  <span
                    key={token.i}
                    data-token-i={token.i}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const words = segment.tokenMap.filter((item) => item.isWord);
                        const span = { startI: token.i, endI: token.i };
                        void handleWordClick(
                          key,
                          token.surface,
                          extractSentenceAround(segment.plainText, token.start, token.end),
                          span,
                          words,
                        );
                      }
                    }}
                    className={cn(
                      'px-px py-0.5',
                      highlightStatus ? STATUS_STYLES[highlightStatus] : STATUS_STYLES.known,
                      selected && 'ring-2 ring-[#8e51ff]/60 bg-[#f5f3ff]',
                    )}
                  >
                    {token.surface}
                  </span>
                );
              })}
            </div>

          </div>
          </div>
          <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-2.5">
            <div className="max-w-[68ch] mx-auto flex items-center justify-between gap-3">
              <Button variant="outline" onClick={goPrev} disabled={segmentIndex === 0} className="rounded-xl gap-1.5">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <form
                className="flex items-center gap-1.5 text-xs text-[#99a1af]"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitPageJump();
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pageDraft}
                  onChange={(e) => setPageDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitPageJump}
                  aria-label="Go to page in this chapter"
                  className="w-12 h-8 text-center rounded-xl border border-[#e5e7eb] bg-white text-[#1e2939] tabular-nums text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#8e51ff]/40 focus:border-[#7f22fe]"
                />
                <span className="tabular-nums">/ {pageInChapter.total}</span>
              </form>
              {isTrial && segmentIndex >= trialLimit - 1 ? (
                <Button onClick={() => setPaywallOpen(true)} className="rounded-xl gap-1.5 bg-[#7f22fe] hover:bg-[#7008e7]">
                  Unlock full book
                </Button>
              ) : segmentIndex < pageCount - 1 ? (
                <Button onClick={goNext} className="rounded-xl gap-1.5 bg-[#7f22fe] hover:bg-[#7008e7]">
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void saveProgress(segmentIndex, true);
                    toast.success('Reading complete!');
                    navigate('/app');
                  }}
                  className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4" />
                  Finish
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Dictionary rail — Figma DictionaryPanel */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-l border-[#e5e7eb] bg-white shrink-0 overflow-hidden transition-[width] duration-200',
            dictOpen ? 'w-72' : 'w-10',
          )}
        >
          {dictOpen ? (
            <DictionaryPanel
              result={activeLookup}
              status={activeWord ? lemmaStatus(activeWord) : 'known'}
              onClose={closeDict}
              onSave={handleSave}
              onKnown={() => void markStatus('known')}
              onIgnore={() => void markStatus('ignored')}
              onPronounce={pronounceWord}
              loading={lookupLoading}
              ttsEnabled={ttsEnabled}
            />
          ) : (
            <button
              type="button"
              onClick={() => setDictOpen(true)}
              className="h-full flex flex-col items-center justify-center gap-1.5 text-[#99a1af] hover:text-[#4a5565] hover:bg-gray-50 transition-colors"
              title="Dictionary"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180 mt-1">Dictionary</span>
            </button>
          )}
        </aside>
      </div>

      {/* Mobile dictionary sheet */}
      {activeWord && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-[#e5e7eb] z-50 max-h-[70vh] overflow-y-auto">
          <DictionaryPanel
            result={activeLookup}
            status={lemmaStatus(activeWord)}
            onClose={closeDict}
            onSave={handleSave}
            onKnown={() => void markStatus('known')}
            onIgnore={() => void markStatus('ignored')}
            onPronounce={pronounceWord}
            loading={lookupLoading}
            ttsEnabled={ttsEnabled}
          />
        </div>
      )}

      {isTrial && paywallOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              className="absolute top-3 right-3 z-10 size-8 rounded-full bg-[#f3f4f6] hover:bg-[#e5e7eb] grid place-items-center text-gray-500"
              onClick={() => setPaywallOpen(false)}
              aria-label="Keep reading the sample"
            >
              <X className="w-4 h-4" />
            </button>
            <CatalogPaywall
              contentId={content.id}
              title={content.title}
              priceUzs={content.priceUzs ?? 0}
              onUnlocked={() => {
                setPaywallOpen(false);
                setLoading(true);
                setAccessNonce((n) => n + 1);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
