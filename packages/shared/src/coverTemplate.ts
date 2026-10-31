/**
 * covers-01: template book covers (landing covers-v2 style, COVER-STYLE-v1). Pure, deterministic, zero network.
 * Shared by the learner (apps/web-learner) and the admin (apps/admin) via @gotcha/shared. No AI, no images.
 */
export type CoverMode = 'template' | 'upload' | 'original';
export const COVER_MODES: readonly CoverMode[] = ['template', 'upload', 'original'];

/** One palette for every book (measured from the landing covers). */
export const COVER_PALETTE = {
  paper: '#F4ECDF',
  ink: '#14112B',
  brand: '#2107AA',
  frame: '#CBC3B6',
  cream: '#F5E9CE',
} as const;

/** The 6 measured landing art navies. Only the art panel varies. */
export const COVER_NAVIES = ['#0A1E39', '#092544', '#0C2543', '#1A193A', '#152435', '#152A44'] as const;
export const COVER_MOTIFS = ['arcs', 'horizon', 'dots', 'hatch', 'sun'] as const;
export type CoverMotif = (typeof COVER_MOTIFS)[number];

export function normalizeCoverKey(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFC').toLowerCase().trim();
}

/** FNV-1a 32-bit, unsigned. */
export function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  const bytes = new TextEncoder().encode(input);
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface CoverSeed {
  seed: number;
  tint: string;
  motif: CoverMotif;
}

/** seed = fnv1a32(normalize(title) + "|" + normalize(genre)); tint = navies[seed % 6]; motif = (seed >>> 3) % 5. */
export function coverSeed(title: string | null | undefined, genre?: string | null): CoverSeed {
  const seed = fnv1a32(`${normalizeCoverKey(title)}|${normalizeCoverKey(genre)}`);
  return { seed, tint: COVER_NAVIES[seed % COVER_NAVIES.length], motif: COVER_MOTIFS[(seed >>> 3) % COVER_MOTIFS.length] };
}

const CYRILLIC = /[\u0400-\u052F]/;
/** Fraunces has no Cyrillic and no U+02BB: such titles render entirely in Literata so glyphs never mix. */
export function needsLiterata(text: string | null | undefined): boolean {
  const s = String(text ?? '');
  return CYRILLIC.test(s) || s.includes('\u02BB') || s.includes('\u02BC');
}
export function coverTitleFontStack(text: string | null | undefined): string {
  return needsLiterata(text) ? 'Literata, Fraunces, serif' : 'Fraunces, Literata, serif';
}
export const COVER_LABEL_FONT_STACK = 'Manrope, "Noto Sans", Inter, sans-serif';

/** Card title = clamp(14px, k·w, 30px) with k = min(0.11, long-title fit): 0.14·w ≤12 chars, 0.12·w ≤24, 0.10·w beyond. */
export function cardTitlePx(widthPx: number, title: string | null | undefined): number {
  const len = Array.from(String(title ?? '').trim()).length;
  const k = Math.min(0.11, len <= 12 ? 0.14 : len <= 24 ? 0.12 : 0.1);
  return Math.round(Math.max(14, Math.min(30, widthPx * k)) * 10) / 10;
}
/** Hero: 28–32px, max 2 lines. */
export function heroTitlePx(title: string | null | undefined): number {
  const len = Array.from(String(title ?? '').trim()).length;
  return len <= 18 ? 32 : len <= 30 ? 30 : 28;
}
export const CARD_TITLE_MAX_LINES = 3;
export const HERO_TITLE_MAX_LINES = 2;
export const CARD_AUTHOR_MIN_WIDTH = 150;

/** Uzbek apostrophes: oʻ/gʻ must be U+02BB. Normalises ASCII ' ` and U+2018/2019 after o/g (and O/G). Display-only. */
export function fixUzApostrophes(s: string): string {
  return s.replace(/([oOgG])['`\u2018\u2019\u02BC]/g, '$1\u02BB');
}

export interface CoverSource {
  coverMode?: CoverMode | string | null;
  /** Effective image URL from the API (null in template mode). */
  coverImageUrl?: string | null;
}
/** Image URL to show, or null when the template renders. The API already sends coverImageUrl=null in template mode. */
export function coverImageToShow(item: CoverSource): string | null {
  if (item.coverMode === 'template') return null;
  return item.coverImageUrl || null;
}

/** API-side resolution (also used by tests): which stored key the API exposes as coverImageUrl. */
export function resolveCoverKey(row: {
  coverMode?: string | null;
  coverImageKey?: string | null;
  originalCoverKey?: string | null;
}): string | null {
  const mode = (row.coverMode ?? 'template') as CoverMode;
  if (mode === 'upload') return row.coverImageKey ?? null;
  if (mode === 'original') return row.originalCoverKey ?? row.coverImageKey ?? null;
  return null;
}

/** SVG markup for the code-drawn art panel (viewBox 0 0 100 100, tint + cream). Pure string so admin, learner and tests share it. */
export function coverMotifSvg(motif: CoverMotif, tint: string, seed = 0): string {
  const c = COVER_PALETTE.cream;
  const v = (n: number) => (seed >>> n) & 7; // small deterministic jitter 0..7
  let body = '';
  switch (motif) {
    case 'arcs': {
      const cx = 30 + v(5) * 5, cy = 105;
      for (let i = 0; i < 7; i++) body += `<circle cx="${cx}" cy="${cy}" r="${18 + i * 11}" fill="none" stroke="${c}" stroke-width="${i % 2 ? 1.2 : 3}" opacity="${0.9 - i * 0.08}"/>`;
      break;
    }
    case 'horizon': {
      const y0 = 52 + v(6) * 2;
      body += `<circle cx="${32 + v(9) * 5}" cy="${y0 - 12}" r="11" fill="${c}"/>`;
      body += `<rect x="0" y="${y0}" width="100" height="${100 - y0}" fill="${tint}"/>`;
      for (let i = 0; i < 9; i++) body += `<rect x="0" y="${y0 + 3 + i * (i + 2) * 0.55}" width="100" height="${0.8 + i * 0.25}" fill="${c}" opacity=".85"/>`;
      break;
    }
    case 'dots': {
      const step = 9 + (v(4) % 3);
      for (let y = step / 2; y < 100; y += step)
        for (let x = step / 2; x < 100; x += step) {
          const d = Math.hypot(x - 50, y - 50);
          body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(0.6, 3.2 - d / 22).toFixed(2)}" fill="${c}"/>`;
        }
      break;
    }
    case 'hatch': {
      const gap = 6 + (v(7) % 3);
      for (let i = -100; i < 200; i += gap) body += `<line x1="${i}" y1="0" x2="${i - 100}" y2="100" stroke="${c}" stroke-width="1.1" opacity=".8"/>`;
      body += `<rect x="22" y="22" width="56" height="56" fill="${tint}"/><rect x="30" y="30" width="40" height="40" fill="none" stroke="${c}" stroke-width="2"/>`;
      break;
    }
    case 'sun':
    default: {
      const cy = 44 + v(3) * 2;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        body += `<line x1="50" y1="${cy}" x2="${(50 + Math.cos(a) * 80).toFixed(1)}" y2="${(cy + Math.sin(a) * 80).toFixed(1)}" stroke="${c}" stroke-width=".7" opacity=".45"/>`;
      }
      body += `<circle cx="50" cy="${cy}" r="21" fill="${c}"/><circle cx="50" cy="${cy}" r="27" fill="none" stroke="${c}" stroke-width="1.2"/>`;
      break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="${tint}"/>${body}</svg>`;
}
