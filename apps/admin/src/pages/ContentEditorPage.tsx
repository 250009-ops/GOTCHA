import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, FileText, ImagePlus, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LibraryPreviewModal } from '../components/LibraryPreviewModal';
import { Button, Card, ErrorBlock, Input, PageHeader, Select, Textarea } from '../components/ui';
import { api, apiUpload } from '../lib/api';
import {
  clearContentEditorDraft,
  getContentLibraryReturn,
  loadContentEditorDraft,
  saveContentEditorDraft,
  shouldRestoreEditorDraft,
  type ContentEditorDraft,
} from '../lib/contentLibraryNav';
import { APP_LANGUAGES, LANGUAGE_META } from '../lib/utils';

type ChapterPreview = {
  title: string;
  chapterIndex: number;
  wordCount: number;
  pages: Array<{ pageIndex: number; title: string; wordCount: number; preview: string }>;
};

type IngestPreview = {
  wordCount: number;
  uniqueWordCount: number;
  chapterCount: number;
  pageCount: number;
  chapters: ChapterPreview[];
  chaptersPayload: Array<{ title: string; text: string }>;
};

const literary = (type: string) => type === 'book' || type === 'story';

function coverSrc(key: string) {
  if (key.startsWith('http') || key.startsWith('blob:') || key.startsWith('data:')) return key;
  const api = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
  const origin = String(api).replace(/\/api\/v1\/?$/, '');
  return key.startsWith('/') ? `${origin}${key}` : key;
}

export default function ContentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('en');
  const [cefrLevel, setCefrLevel] = useState('b1');
  const [contentType, setContentType] = useState('book');
  const [isFree, setIsFree] = useState(true);
  const [priceUsd, setPriceUsd] = useState('0');
  const [sourceMode, setSourceMode] = useState<'paste' | 'url' | 'pdf'>('paste');
  const [plainText, setPlainText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<IngestPreview | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [publishStatus, setPublishStatus] = useState('draft');
  const [showLibraryPreview, setShowLibraryPreview] = useState(false);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([...APP_LANGUAGES]);
  const serverLoaded = useRef(false);
  const draftRestored = useRef(false);

  function returnToLibrary() {
    navigate(getContentLibraryReturn());
  }

  function applyDraft(draft: ContentEditorDraft) {
    setTitle(draft.title);
    setAuthor(draft.author);
    setDescription(draft.description);
    setGenre(draft.genre);
    setLanguage(draft.language);
    setCefrLevel(draft.cefrLevel);
    setContentType(draft.contentType);
    setIsFree(draft.isFree);
    setPriceUsd(draft.priceUsd);
    setSourceMode(draft.sourceMode);
    setPlainText(draft.plainText);
    setSourceUrl(draft.sourceUrl);
    if (draft.preview) {
      setPreview(draft.preview as IngestPreview);
      setOpenChapters(draft.openChapters);
    }
  }

  function currentDraft(): ContentEditorDraft {
    return {
      savedAt: Date.now(),
      title,
      author,
      description,
      genre,
      language,
      cefrLevel,
      contentType,
      isFree,
      priceUsd,
      sourceMode,
      plainText,
      sourceUrl,
      preview,
      openChapters,
    };
  }

  useEffect(() => {
    if (editing && !serverLoaded.current) return;
    if (loading) return;
    const timer = window.setTimeout(() => {
      saveContentEditorDraft(id, currentDraft());
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    editing,
    loading,
    title,
    author,
    description,
    genre,
    language,
    cefrLevel,
    contentType,
    isFree,
    priceUsd,
    sourceMode,
    plainText,
    sourceUrl,
    preview,
    openChapters,
  ]);

  useEffect(() => {
    api<{ languages: Array<{ code: string; isEnabled: boolean }> }>('/admin/languages')
      .then((data) => {
        const codes = data.languages.filter((l) => l.isEnabled).map((l) => l.code);
        if (codes.length) setEnabledLanguages(codes);
      })
      .catch(console.error);
  }, []);

  const languageOptions = useMemo(() => {
    const codes = new Set(enabledLanguages);
    if (language) codes.add(language);
    return [...codes];
  }, [enabledLanguages, language]);

  useEffect(() => {
    if (id) return;
    const draft = loadContentEditorDraft(undefined);
    if (shouldRestoreEditorDraft(draft)) {
      applyDraft(draft);
      draftRestored.current = true;
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    serverLoaded.current = false;
    draftRestored.current = false;
    setLoading(true);
    api<{
      title: string;
      author?: string | null;
      subtitle?: string | null;
      description?: string | null;
      genre?: string | null;
      language: string;
      cefrLevel: string;
      contentType: string;
      isFree: boolean;
      priceUsd: number;
      priceUzs?: number;
      sourceUrl?: string | null;
      coverImageKey?: string | null;
      publishStatus?: string;
      chapters?: ChapterPreview[];
    }>(`/admin/content/${id}`)
      .then((item) => {
        if (cancelled) return;
        const serverAuthor = (item.author ?? item.subtitle ?? '').trim();
        setTitle(item.title);
        setAuthor(serverAuthor);
        setDescription(item.description ?? '');
        setGenre(item.genre ?? '');
        setLanguage(item.language);
        setCefrLevel(item.cefrLevel);
        setContentType(item.contentType);
        setIsFree(item.isFree);
        setPriceUsd(String(item.priceUzs ?? item.priceUsd ?? 0));
        setSourceUrl(item.sourceUrl ?? '');
        setPublishStatus(item.publishStatus ?? 'draft');
        if (item.coverImageKey) setCoverPreview(coverSrc(item.coverImageKey));
        if (item.chapters?.length) {
          setPreview({
            wordCount: item.chapters.reduce((s, c) => s + c.wordCount, 0),
            uniqueWordCount: 0,
            chapterCount: item.chapters.length,
            pageCount: item.chapters.reduce((s, c) => s + c.pages.length, 0),
            chapters: item.chapters,
            chaptersPayload: [],
          });
          setOpenChapters(Object.fromEntries(item.chapters.map((c) => [c.chapterIndex, true])));
        }
        serverLoaded.current = true;
        const draft = loadContentEditorDraft(id);
        if (shouldRestoreEditorDraft(draft, { title: item.title, author: serverAuthor })) {
          applyDraft(draft);
          draftRestored.current = true;
        } else {
          clearContentEditorDraft(id);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const canAnalyze =
    sourceMode === 'pdf'
      ? Boolean(pdfFile)
      : sourceMode === 'url'
        ? sourceUrl.trim().length > 8
        : plainText.trim().length > 40;

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const result = sourceMode === 'pdf' && pdfFile
        ? await apiUpload<IngestPreview>('/admin/content/ingest-preview-file', pdfFile, 'file', {
            title: title || 'Untitled',
            contentType,
            language,
          })
        : await api<IngestPreview>('/admin/content/ingest-preview', {
            method: 'POST',
            body: JSON.stringify({
              title: title || 'Untitled',
              contentType,
              language,
              plainText: sourceMode === 'paste' ? plainText : undefined,
              sourceUrl: sourceMode === 'url' ? sourceUrl : undefined,
            }),
          });
      setPreview(result);
      setOpenChapters(Object.fromEntries(result.chapters.map((c) => [c.chapterIndex, true])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI ingest failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (!isFree && Number(priceUsd || 0) < 500) {
      setError('Paid books need a price of at least 500 soʻm (Atmos minimum).');
      setBusy(false);
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        genre: genre.trim() || undefined,
        language,
        cefrLevel,
        contentType,
        isFree,
        priceUsd: isFree ? 0 : Number(priceUsd || 0),
        priceUzs: isFree ? 0 : Number(priceUsd || 0),
        contentSource: 'public_domain',
        plainText: sourceMode === 'paste' ? plainText || undefined : undefined,
        sourceUrl: sourceMode === 'url' ? sourceUrl || undefined : undefined,
        chapters: preview?.chaptersPayload?.length ? preview.chaptersPayload : undefined,
      };
      if (sourceMode === 'pdf' && pdfFile && !payload.chapters?.length) {
        const analyzed = await apiUpload<IngestPreview>('/admin/content/ingest-preview-file', pdfFile, 'file', {
          title: title || 'Untitled',
          contentType,
          language,
        });
        payload.chapters = analyzed.chaptersPayload;
        setPreview(analyzed);
      }
      if (editing && id) {
        await api(`/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        if (coverFile) await apiUpload(`/admin/content/${id}/cover`, coverFile);
      } else {
        const created = await api<{ id: string }>('/admin/content', {
          method: 'POST',
          body: JSON.stringify({ ...payload, plainText: payload.plainText || (title ? `${title}.` : 'Draft.') }),
        });
        if (coverFile) await apiUpload(`/admin/content/${created.id}/cover`, coverFile);
      }
      clearContentEditorDraft(id);
      returnToLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const outlineLabel = useMemo(() => {
    if (!preview) return literary(contentType) ? 'Chapters appear here after AI analyze' : 'Tight article/news body — no chapter tree';
    if (!literary(contentType)) return 'Single body (article / news)';
    return `${preview.chapterCount} chapters · ${preview.pageCount} pages · ${preview.wordCount} words`;
  }, [preview, contentType]);

  if (loading) return <div className="text-sm text-slate-500">Loading material…</div>;

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit material' : 'New material'}
        subtitle="Add catalog details, then detect chapters from pasted text, a PDF, or a URL. Printed headings and the contents list become the outline; pages stay word-count slices inside each chapter."
        actions={
          <div className="flex flex-wrap gap-2">
            {title.trim() ? (
              <Button type="button" variant="secondary" onClick={() => setShowLibraryPreview(true)}>
                <Eye className="size-4" /> Preview library
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={returnToLibrary}>
              Back to library
            </Button>
          </div>
        }
      />
      {error && <ErrorBlock message={error} />}
      <form onSubmit={(e) => void save(e)} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <Card className="p-5 space-y-3">
            <div className="font-semibold">Material information</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" required={!editing} />
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre (novel, short story, news…)" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languageOptions.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_META[l as keyof typeof LANGUAGE_META]?.flag ?? '🌐'} {LANGUAGE_META[l as keyof typeof LANGUAGE_META]?.label ?? l}</option>
                ))}
              </Select>
              <Select value={cefrLevel} onChange={(e) => setCefrLevel(e.target.value)}>
                {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
              <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
                <option value="book">Book / Roman</option>
                <option value="story">Story</option>
                <option value="article">Article</option>
                <option value="news">News</option>
              </Select>
              <Select
                value={isFree ? 'free' : 'paid'}
                onChange={(e) => {
                  const free = e.target.value === 'free';
                  setIsFree(free);
                  if (free) setPriceUsd('0');
                }}
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            {!isFree && (
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Price (soʻm)</span>
                <Input
                  className="mt-1"
                  type="number"
                  min="500"
                  step="1"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  placeholder="e.g. 22000"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Learners pay this amount via Atmos before they can open the book. Minimum 500 soʻm.
                </p>
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Cover image</span>
              <div className="mt-2 flex items-center gap-3">
                <div className="size-20 rounded-xl border border-dashed border-slate-300 overflow-hidden bg-slate-50 grid place-items-center">
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus className="size-6 text-slate-400" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setCoverFile(file);
                    setCoverPreview(file ? URL.createObjectURL(file) : coverPreview);
                  }}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Source PDF</span>
              <div className="mt-2 flex items-center gap-3">
                <div className="size-20 rounded-xl border border-dashed border-slate-300 overflow-hidden bg-slate-50 grid place-items-center">
                  <FileText className={`size-6 ${pdfFile ? 'text-[#6c1d95]' : 'text-slate-400'}`} />
                </div>
                <div className="min-w-0">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setPdfFile(file);
                      if (file) {
                        setSourceMode('pdf');
                        setPreview(null);
                      }
                    }}
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {pdfFile
                      ? pdfFile.name
                      : 'Upload a text PDF (up to 100 MB / about 4,000 pages). Chapter names come from the PDF outline and headings.'}
                  </div>
                </div>
              </div>
            </label>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-semibold">Source & chapter detect</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={sourceMode === 'paste' ? 'primary' : 'secondary'} onClick={() => setSourceMode('paste')}>
                Paste text
              </Button>
              <Button type="button" variant={sourceMode === 'pdf' ? 'primary' : 'secondary'} onClick={() => setSourceMode('pdf')}>
                Upload PDF
              </Button>
              <Button type="button" variant={sourceMode === 'url' ? 'primary' : 'secondary'} onClick={() => setSourceMode('url')}>
                Page URL
              </Button>
            </div>
            {sourceMode === 'paste' ? (
              <Textarea
                rows={12}
                value={plainText}
                onChange={(e) => setPlainText(e.target.value)}
                placeholder={literary(contentType) ? 'Paste the book or story. Copyright and contents pages are dropped; chapter titles stay as printed (Chapter 1. Loomings).' : 'Paste the article or news body. Kept as a tight single piece.'}
                required={!editing && !preview && !pdfFile}
              />
            ) : sourceMode === 'pdf' ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                {pdfFile
                  ? `Ready to analyze: ${pdfFile.name}`
                  : 'Choose a PDF above, then detect chapters from its outline, contents list, and printed headings.'}
              </div>
            ) : (
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.gutenberg.org/ebooks/2701 or any public book/article URL"
                required={!editing && !preview}
              />
            )}
            {sourceMode === 'url' && (
              <p className="text-xs text-slate-500">
                Large novels are fetched in full (plain text when available) and split into printed chapters from the contents list and headings. Detection can take up to a few minutes.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canAnalyze || analyzing} onClick={() => void analyze()}>
                <Sparkles className="size-4" />
                {analyzing
                  ? literary(contentType)
                    ? 'Fetching and splitting chapters…'
                    : 'Preparing body…'
                  : literary(contentType)
                    ? 'Detect chapters'
                    : 'Prepare body'}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden h-fit xl:sticky xl:top-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chapters</div>
            <div className="text-sm text-slate-600 mt-1">{outlineLabel}</div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto py-2">
            {!preview || preview.chapters.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-400">Run AI analyze to build the outline.</div>
            ) : literary(contentType) ? (
              preview.chapters.map((ch) => {
                const open = openChapters[ch.chapterIndex] !== false;
                return (
                  <div key={ch.chapterIndex} className="border-b border-slate-50">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-violet-50/60"
                      onClick={() => setOpenChapters((prev) => ({ ...prev, [ch.chapterIndex]: !open }))}
                    >
                      {open ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{ch.title}</div>
                        <div className="text-[11px] text-slate-400">{ch.pages.length} pages · {ch.wordCount} words</div>
                      </div>
                    </button>
                    {open && (
                      <div className="pb-2">
                        {ch.pages.map((p) => (
                          <div key={p.pageIndex} className="pl-10 pr-4 py-1.5">
                            <div className="text-xs font-medium text-[#6c1d95]">{p.title}</div>
                            <div className="text-[11px] text-slate-500 line-clamp-2">{p.preview}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-600">
                Tight body · {preview.wordCount} words. No chapter tree for article/news.
              </div>
            )}
          </div>
        </Card>
      </form>

      {showLibraryPreview ? (
        <LibraryPreviewModal
          item={{
            id: id ?? 'preview-draft',
            title: title.trim() || 'Untitled',
            description: description || null,
            author: author || null,
            language,
            cefrLevel,
            contentType,
            wordCount: preview?.wordCount ?? 0,
            isFree,
            priceUzs: Number(priceUsd) || 0,
            publishStatus,
            coverImageKey: coverPreview,
          }}
          onClose={() => setShowLibraryPreview(false)}
        />
      ) : null}
    </div>
  );
}
