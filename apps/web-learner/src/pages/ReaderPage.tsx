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
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ContentItem, ContentSegment, LookupResult, WordStatus } from '../lib/types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function chapterRoman(index: number) {
  return ROMAN[index] ?? String(index + 1);
}

function chapterLabel(seg: ContentSegment | undefined, index: number) {
  if (!seg) return '';
  const title = seg.title?.replace(/^Chapter\s+[IVXLC\d]+\s*[—–-]?\s*/i, '').trim() || seg.title;
  if (title && /^chapter\b/i.test(title)) return title;
  return `Chapter ${chapterRoman(index)} — ${title ?? `Part ${index + 1}`}`;
}

function sidebarChapterTitle(seg: ContentSegment) {
  return seg.title?.replace(/^Chapter\s+[IVXLC\d]+\s*[—–-]?\s*/i, '').trim() || seg.title || `Part ${seg.segmentIndex + 1}`;
}

const STATUS_STYLES: Record<WordStatus, string> = {
  unknown: 'border-b-[1.6px] border-dashed border-[#ffb900] text-[#973c00] cursor-pointer hover:bg-amber-50/80 rounded-[6px]',
  learning: 'border-b-[1.6px] border-solid border-[#51a2ff] text-[#193cb8] cursor-pointer hover:bg-blue-50/80 rounded-[6px]',
  known: 'cursor-pointer hover:bg-gray-100/80 rounded-[6px]',
  ignored: 'text-gray-400 cursor-pointer hover:bg-gray-100/80 rounded-[6px]',
};

/** Sentence (or short window) containing the tapped token — never the full chapter. */
function extractSentenceAround(text: string, start: number, end: number): string {
  if (!text) return '';
  const len = text.length;
  const a = Math.max(0, Math.min(start, len));
  const b = Math.max(a, Math.min(end, len));

  let s = a;
  while (s > 0) {
    const ch = text[s - 1];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n' || ch === '…') break;
    s--;
  }
  while (s < a && /\s/.test(text[s]!)) s++;

  let e = b;
  while (e < len) {
    const ch = text[e]!;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      e++;
      break;
    }
    if (ch === '\n') break;
    e++;
  }

  let sentence = text.slice(s, e).trim();
  if (sentence.length > 400) {
    const ws = Math.max(0, a - 80);
    const we = Math.min(len, b + 80);
    sentence = text.slice(ws, we).trim();
  }
  return sentence.slice(0, 500);
}

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
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-[#101828]">{result.lemma}</span>
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
            <div className="bg-[#f5f3ff] rounded-xl p-3">
              <div className="text-xs font-semibold text-[#7f22fe] uppercase tracking-wider mb-1">Translation</div>
              <div className="text-[#1e2939] leading-relaxed">{result.translation}</div>
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
            <div className="text-sm">Click any word to look it up</div>
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
  const [segments, setSegments] = useState<ContentSegment[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [activeLookup, setActiveLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [fontScale, setFontScale] = useState(preferences?.readerFontScale ?? 1);
  const [showUnknownOnly, setShowUnknownOnly] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [wordStatuses, setWordStatuses] = useState<Record<string, WordStatus>>({});
  const [loading, setLoading] = useState(true);

  const segment = segments[segmentIndex];
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api<ContentItem>(`/content/${id}`),
      api<{ segments: ContentSegment[] }>(`/content/${id}/segments?from=0&limit=500`),
      api<Array<{ lemma: string; status: string }>>('/reading/known-words'),
    ]).then(([item, segRes, known]) => {
      setContent(item);
      const segs = segRes.segments ?? [];
      setSegments(segs);
      const map: Record<string, WordStatus> = {};
      for (const w of known) {
        map[w.lemma.toLowerCase()] = (w.status as WordStatus) ?? 'known';
      }
      setWordStatuses(map);
      const resumeIdx = segs.findIndex((s) => s.id === (item as ContentItem & { currentSegmentId?: string }).currentSegmentId);
      setSegmentIndex(resumeIdx >= 0 ? resumeIdx : 0);
      lastProgressAtRef.current = Date.now();
    }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [id]);

  const lemmaStatus = useCallback(
    (lemma: string): WordStatus => wordStatuses[lemma.toLowerCase()] ?? 'unknown',
    [wordStatuses],
  );

  const { unknownCount, learningCount } = useMemo(() => {
    const unknown = new Set<string>();
    const learning = new Set<string>();
    for (const seg of segments) {
      for (const t of seg.tokenMap ?? []) {
        if (!t.isWord) continue;
        const key = (t.lemma ?? t.surface).toLowerCase();
        const status = lemmaStatus(key);
        if (status === 'unknown') unknown.add(key);
        if (status === 'learning') learning.add(key);
      }
    }
    return { unknownCount: unknown.size, learningCount: learning.size };
  }, [segments, lemmaStatus]);

  const persistFontScale = (next: number) => {
    setFontScale(next);
    void updatePreferences({ readerFontScale: next }).catch(() => undefined);
  };

  const handleWordClick = useCallback(
    async (lemma: string, surface: string, sentence: string) => {
      setActiveWord(lemma);
      setDictOpen(true);
      setLookupLoading(true);
      setActiveLookup(null);
      try {
        const res = await api<LookupResult>('/ai/lookup', {
          method: 'POST',
          body: JSON.stringify({
            token: surface,
            lemma,
            sentence,
            sourceLang,
            targetLang,
          }),
        });
        setActiveLookup({
          lemma: res.lemma ?? lemma,
          translation: res.translation,
        });
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Lookup failed';
        let message = raw;
        if (/disabled by an administrator/i.test(raw)) {
          message = 'AI lookups are temporarily disabled. Please try again later.';
        } else if (/quota exceeded|daily limit reached/i.test(raw)) {
          message = 'Daily AI lookup limit reached. Try again tomorrow or upgrade your plan.';
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

  const saveProgress = async (nextIndex: number, completed = false) => {
    if (!id || !segments.length) return;
    const pct = Math.round(((nextIndex + 1) / segments.length) * 100);
    const readSeconds = Math.max(0, Math.round((Date.now() - lastProgressAtRef.current) / 1000));
    lastProgressAtRef.current = Date.now();
    try {
      await api(`/content/${id}/progress`, {
        method: 'PUT',
        body: JSON.stringify({
          segmentId: segments[nextIndex]?.id,
          progressPct: completed ? 100 : pct,
          completed,
          readSeconds,
        }),
      });
    } catch {
      /* non-blocking */
    }
  };

  const goToSegment = (index: number) => {
    if (index < 0 || index >= segments.length) return;
    setSegmentIndex(index);
    setActiveWord(null);
    setActiveLookup(null);
    void saveProgress(index);
  };

  const goNext = () => {
    if (segmentIndex < segments.length - 1) goToSegment(segmentIndex + 1);
  };

  const goPrev = () => {
    if (segmentIndex > 0) goToSegment(segmentIndex - 1);
  };

  const closeDict = () => {
    setDictOpen(false);
    setActiveWord(null);
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

  if (!segments.length || !segment) {
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

  const tokens = segment.tokenMap ?? [];
  const currentChapterLabel = chapterLabel(segment, segmentIndex);
  const zoomPct = Math.round(fontScale * 100);

  return (
    <div className="flex flex-col h-screen max-h-dvh bg-[#FDFCFF] overflow-hidden">
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
            onClick={() => navigate(`/app/practice?contentId=${id}&segmentId=${segment.id}`)}
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
                {segments.map((seg, i) => {
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
                        Ch. {seg.segmentIndex + 1}
                      </div>
                      <div className={cn('text-sm font-medium truncate mt-0.5', active ? 'text-[#4d179a]' : 'text-[#4a5565]')}>
                        {sidebarChapterTitle(seg)}
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
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Mobile chapter chips */}
          <div className="md:hidden flex gap-2 overflow-x-auto px-4 pt-3 pb-1 scrollbar-hide">
            {segments.map((seg, i) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => goToSegment(i)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  i === segmentIndex
                    ? 'bg-[#f5f3ff] border-[#7f22fe] text-[#7008e7]'
                    : 'bg-white border-gray-200 text-[#4a5565]',
                )}
              >
                Ch. {seg.segmentIndex + 1}
              </button>
            ))}
          </div>

          <div
            className="max-w-[68ch] mx-auto px-5 py-8 lg:py-12"
            style={{ fontSize: `${fontScale}rem` }}
          >
            <div className="mb-8">
              <div className="text-xs font-semibold text-[#8e51ff] uppercase tracking-[1.2px] mb-1">
                {segmentIndex + 1} of {segments.length}
              </div>
              <h1 className="text-2xl font-bold text-[#101828] font-serif leading-8">
                {currentChapterLabel}
              </h1>
            </div>

            <div className="text-[#1e2939] leading-[1.9] font-serif">
              {tokens.map((token) => {
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

                return (
                  <span
                    key={token.i}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      handleWordClick(
                        key,
                        token.surface,
                        extractSentenceAround(segment.plainText, token.start, token.end),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleWordClick(
                          key,
                          token.surface,
                          extractSentenceAround(segment.plainText, token.start, token.end),
                        );
                      }
                    }}
                    className={cn(
                      'px-px py-0.5',
                      highlightStatus ? STATUS_STYLES[highlightStatus] : STATUS_STYLES.known,
                      activeWord === key && 'ring-2 ring-[#8e51ff]/60 bg-[#f5f3ff]',
                    )}
                  >
                    {token.surface}
                  </span>
                );
              })}
            </div>

            <div className="mt-12 pt-6 border-t border-[#f3f4f6] flex items-center justify-between gap-3">
              <Button variant="outline" onClick={goPrev} disabled={segmentIndex === 0} className="rounded-xl gap-1.5">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <span className="text-xs text-[#99a1af] tabular-nums">
                {segmentIndex + 1} / {segments.length}
              </span>
              {segmentIndex < segments.length - 1 ? (
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
    </div>
  );
}
