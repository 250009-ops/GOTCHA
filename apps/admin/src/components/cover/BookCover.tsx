/**
 * covers-01 — template book cover (landing covers-v2 style; team/uiux/COVER-STYLE-v1.md).
 * Same file in apps/web-learner and apps/admin (keep byte-identical; SUMS in the handoff).
 * Title/author are drawn in code (never baked) so any crop (3:4 card, ~0.86 hero, 52px thumb) stays readable.
 * Zero network: palette + code-drawn SVG motif picked by a hash of title|genre.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import {
  CARD_TITLE_MAX_LINES,
  COVER_LABEL_FONT_STACK,
  COVER_PALETTE,
  HERO_TITLE_MAX_LINES,
  coverImageToShow,
  coverMotifSvg,
  coverSeed,
  coverTitleFontStack,
  fixUzApostrophes,
  heroTitlePx,
  needsLiterata,
} from '@gotcha/shared';

export type BookCoverVariant = 'card' | 'hero' | 'thumb';

export interface BookCoverItem {
  id?: string;
  title: string;
  genre?: string | null;
  language?: string | null;
  authorName?: string | null;
  author?: string | null;
  coverMode?: string | null;
  coverImageUrl?: string | null;
}

const CSS = `
.gc-cover{position:relative;overflow:hidden;background:${COVER_PALETTE.paper};color:${COVER_PALETTE.ink};container-type:inline-size;isolation:isolate}
.gc-cover[data-v=card]::after{content:"";position:absolute;inset:6%;border:1.5px solid ${COVER_PALETTE.frame};pointer-events:none;z-index:1}
.gc-art{position:absolute;overflow:hidden}
.gc-art svg{display:block;width:100%;height:100%}
.gc-cover[data-v=card] .gc-art{left:7%;right:7%;top:9%;height:46%}
.gc-cover[data-v=thumb] .gc-art{inset:10%}
.gc-cover[data-v=hero]::after{content:"";position:absolute;inset:14px;border:1.5px solid ${COVER_PALETTE.frame};pointer-events:none}
.gc-cover[data-v=hero] .gc-art{left:7%;right:7%;top:24px;height:var(--gc-hero-art,44%)}
.gc-cover[data-v=hero] .gc-scrim{height:max(46%,var(--gc-hero-text,0px))}
.gc-title{position:absolute;left:7%;right:7%;font-weight:600;font-variation-settings:'opsz' 144,'SOFT' 50;letter-spacing:-.02em;line-height:1.02;
  overflow-wrap:break-word;word-break:normal;hyphens:manual;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}
.gc-cover[data-v=card] .gc-title{bottom:16.5%;font-size:clamp(14px,var(--gc-k,11cqw),30px);-webkit-line-clamp:${CARD_TITLE_MAX_LINES};line-clamp:${CARD_TITLE_MAX_LINES};max-height:calc(${CARD_TITLE_MAX_LINES} * 1.02em + 2px)}
.gc-author{position:absolute;left:7%;right:7%;bottom:8%;border-top:1.2px solid currentColor;padding-top:4px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-author[data-cyr]{letter-spacing:.08em}
@container (max-width:149.98px){.gc-cover[data-v=card] .gc-author{display:none}.gc-cover[data-v=card] .gc-title{bottom:9%}}
.gc-scrim{position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to top,${COVER_PALETTE.ink} 0%,rgba(20,17,43,.85) 55%,rgba(20,17,43,0));pointer-events:none}
.gc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
`;
let injected = false;
function useCoverCss() {
  if (!injected && typeof document !== 'undefined') {
    injected = true;
    const el = document.createElement('style');
    el.setAttribute('data-gc-cover', '1');
    el.textContent = CSS;
    document.head.appendChild(el);
  }
}

/** Title as displayed: Uzbek oʻ/gʻ normalised to U+02BB (uz only — never touches English apostrophes). */
export function coverDisplayTitle(item: Pick<BookCoverItem, 'title' | 'language'>): string {
  const t = String(item.title ?? '').trim();
  return item.language === 'uz' ? fixUzApostrophes(t) : t;
}

/** Card title factor in cqw (spec: .14/.12/.10 by length, capped at .11 = clamp(14px,.11w,30px)). */
function cardK(title: string): string {
  const len = Array.from(title).length;
  const longestWord = Math.max(1, ...title.split(/\s+/).map((w) => Array.from(w).length));
  // a single long word must fit the 86% text box (≈0.56em per glyph) before the 14px floor; break-word is the last resort
  const wordFit = 86 / (longestWord * 0.56);
  return `${Math.min(11, len <= 12 ? 14 : len <= 24 ? 12 : 10, wordFit).toFixed(2)}cqw`;
}

export function BookCover({
  item,
  variant = 'card',
  className,
  resolveUrl,
  showText = true,
}: {
  item: BookCoverItem;
  variant?: BookCoverVariant;
  className?: string;
  /** Maps a stored /uploads/… key to an absolute URL (each app has its own). */
  resolveUrl?: (u: string | null | undefined) => string | null;
  /** Hero callers draw their own title over the scrim; set false to skip the in-cover title. */
  showText?: boolean;
}) {
  useCoverCss();
  const raw = coverImageToShow(item);
  const src = raw ? (resolveUrl ? resolveUrl(raw) : raw) : null;
  const [failed, setFailed] = useState(false);
  const { seed, tint, motif } = useMemo(() => coverSeed(item.title, item.genre), [item.title, item.genre]);
  const svg = useMemo(() => coverMotifSvg(motif, tint, seed), [motif, tint, seed]);
  const title = coverDisplayTitle(item);
  const author = (item.authorName ?? item.author ?? '').trim();
  const useImage = Boolean(src) && !failed;

  return (
    <div
      className={['gc-cover', className].filter(Boolean).join(' ')}
      data-v={variant}
      data-cover-mode={useImage ? 'image' : 'template'}
      data-motif={useImage ? undefined : motif}
      data-tint={useImage ? undefined : tint}
      aria-hidden="true"
    >
      {useImage ? (
        <img className="gc-img" src={src ?? ''} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <>
          {/* Our own generated SVG (constants + numeric seed only; no user text). */}
          <div className="gc-art" dangerouslySetInnerHTML={{ __html: svg }} />
          {variant === 'card' && showText ? (
            <>
              <div
                className="gc-title"
                lang={item.language ?? undefined}
                style={{ fontFamily: coverTitleFontStack(title), ['--gc-k' as string]: cardK(title) }}
              >
                {title}
              </div>
              {author ? (
                <div className="gc-author" data-cyr={needsLiterata(author) ? '' : undefined} style={{ fontFamily: COVER_LABEL_FONT_STACK }}>
                  {author}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
      {variant === 'hero' ? <div className="gc-scrim" /> : null}
    </div>
  );
}

/** Hero title style (28–32px, max 2 lines, white on the scrim). Spread on the hero title element. */
export function heroTitleStyle(title: string): CSSProperties {
  return {
    fontFamily: coverTitleFontStack(title),
    fontWeight: 600,
    fontSize: `${heroTitlePx(title)}px`,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    fontVariationSettings: "'opsz' 144, 'SOFT' 50",
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: HERO_TITLE_MAX_LINES,
    overflow: 'hidden',
    overflowWrap: 'break-word',
    hyphens: 'manual',
  };
}
export const HERO_AUTHOR_STYLE: CSSProperties = {
  fontFamily: COVER_LABEL_FONT_STACK,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
};
