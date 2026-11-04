/**
 * Canonical GOTCHA logo (team/BRAND-logo.md) — the learner-panel mark, identical in web-learner, admin and web.
 * Source of truth: packages/shared/brand (assets/ = the Designer's masters). This file is copied verbatim into
 * apps/{web-learner,admin,web}/src/components/GotchaLogo.tsx by `node packages/shared/brand/sync.mjs` — edit it here.
 * Ratios: radius 0.3125·s, G 0.5625·s (baked into the SVG), wordmark cap 0.5625·s, lockup gap 0.375·s,
 * shadow only at s ≥ 32. The tile is always BrandNavy; only the wordmark colour switches.
 */
import type { ReactNode } from 'react';

const BRAND = `${import.meta.env.BASE_URL ?? '/'}brand/`;
// Logo elevation, tinted to the brand blue (was rgba(77,23,154,.5)); defined in gotcha-tokens.css.
const SHADOW = 'var(--g-mark-shadow)';

type MarkProps = { size?: number; elevated?: boolean; className?: string; title?: string };

/** The tile alone. Sizes: 20, 24, 32 (default), 40, 56, 100. */
export function BrandMark({ size = 32, elevated = size >= 32, className, title }: MarkProps) {
  return (
    <img
      src={`${BRAND}gotcha-mark.svg`}
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
      className={['shrink-0 select-none', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, borderRadius: size * 0.3125, boxShadow: elevated && size >= 32 ? SHADOW : undefined }}
    />
  );
}

type LogoProps = {
  /** Tile size in px (learner sidebar = 32). The wordmark scales with it. */
  size?: number;
  /** `light` = white wordmark (for dark surfaces), `ink` = #101828 wordmark (for light surfaces). */
  tone?: 'light' | 'ink';
  /** Mark only (collapsed sidebars). Also forced below 24 px. */
  markOnly?: boolean;
  /** Descriptor under the wordmark ("Language Learning", "Admin Console"): Inter 10 px, 2 px below. */
  subtitle?: ReactNode;
  subtitleClassName?: string;
  elevated?: boolean;
  className?: string;
};

/** Lockup: tile + 0.375·s gap + Bagel wordmark (+ optional descriptor). */
export function GotchaLogo({ size = 32, tone = 'light', markOnly = false, subtitle, subtitleClassName, elevated, className }: LogoProps) {
  const only = markOnly || size < 24;
  return (
    <span className={['inline-flex items-center', className].filter(Boolean).join(' ')} style={{ gap: size * 0.375 }}>
      <BrandMark size={size} elevated={elevated} title={only ? 'GOTCHA' : undefined} />
      {!only && (
        <span className="flex flex-col min-w-0">
          <img
            // wordmark-dark = white (on dark), wordmark-light = Ink (on light)
            src={`${BRAND}gotcha-wordmark-${tone === 'light' ? 'dark' : 'light'}.svg`}
            alt="GOTCHA"
            draggable={false}
            className="select-none block"
            style={{ height: size * 0.5625, width: 'auto' }}
          />
          {subtitle != null && (
            <span
              className={
                subtitleClassName ??
                `text-[10px] leading-none mt-0.5 ${tone === 'light' ? 'text-white/30' : 'text-[#4a5565]'}`
              }
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default GotchaLogo;
