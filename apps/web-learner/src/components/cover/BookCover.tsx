/**
 * Book cover is a landing-page poster: the six finished photographs, an admin upload,
 * or a linocut sheet in that same layout (author, picture, title, language, purple G).
 * Never a geometric motif.
 */
import { useState, type CSSProperties } from 'react';
import {
  COVER_LABEL_FONT_STACK,
  COVER_PALETTE,
  HERO_TITLE_MAX_LINES,
  coverImageToShow,
  coverTitleFontStack,
  fixUzApostrophes,
  heroTitlePx,
  isLandingCoverId,
  landingPosterSvg,
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

/** Same file the landing page uses: public/covers/{id}.jpg (2:3 poster). */
export function landingPosterUrl(id: string | null | undefined): string | null {
  if (!isLandingCoverId(id)) return null;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}covers/${id}.jpg`;
}

/** Title as displayed: Uzbek oʻ/gʻ normalised to U+02BB (uz only — never touches English apostrophes). */
export function coverDisplayTitle(item: Pick<BookCoverItem, 'title' | 'language'>): string {
  const t = String(item.title ?? '').trim();
  return item.language === 'uz' ? fixUzApostrophes(t) : t;
}

export function BookCover({
  item,
  variant = 'card',
  className,
  resolveUrl,
}: {
  item: BookCoverItem;
  variant?: BookCoverVariant;
  className?: string;
  /** Maps a stored /uploads/… key to an absolute URL (each app has its own). */
  resolveUrl?: (u: string | null | undefined) => string | null;
  /** Unused. The poster image already contains the title. Kept so older callers still type-check. */
  showText?: boolean;
}) {
  const poster = landingPosterUrl(item.id);
  const uploadRaw = item.coverMode === 'upload' ? coverImageToShow(item) : null;
  const upload = uploadRaw ? (resolveUrl ? resolveUrl(uploadRaw) : uploadRaw) : null;
  const [posterFailed, setPosterFailed] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const src = poster && !posterFailed ? poster : upload && !uploadFailed ? upload : null;
  const kind = poster && !posterFailed ? 'landing' : src ? 'upload' : 'poster';
  const sheet =
    kind === 'poster'
      ? landingPosterSvg({
          title: coverDisplayTitle(item),
          author: item.language === 'uz' ? fixUzApostrophes(item.authorName || item.author || '') : item.authorName || item.author,
          language: item.language,
          genre: item.genre,
        })
      : '';

  const frame = ['gc-cover relative overflow-hidden', className].filter(Boolean).join(' ');
  if (kind === 'poster') {
    return (
      <div
        className={frame}
        data-v={variant}
        data-cover-mode="poster"
        style={{ background: COVER_PALETTE.paper }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: sheet }}
      />
    );
  }

  return (
    <div
      className={frame}
      data-v={variant}
      data-cover-mode={kind}
      style={{ background: COVER_PALETTE.paper }}
      aria-hidden="true"
    >
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={src!}
        alt=""
        loading="lazy"
        onError={() => {
          if (kind === 'landing') setPosterFailed(true);
          else setUploadFailed(true);
        }}
      />
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
