const base = '/assets/auth';

export const authAssets = {
  check: `${base}/check.svg`,
  checkWhite: `${base}/check-white.svg`,
  bookOpen: `${base}/book-open.svg`,
  brain: `${base}/brain.svg`,
  refreshCw: `${base}/refresh-cw.svg`,
  sparkles: `${base}/sparkles.svg`,
  sparklesWhite: `${base}/sparkles-white.svg`,
  heroVisual: `${base}/hero-visual.png`,
  bgAccent1: `${base}/bg-accent-1.svg`,
  arrowRight: `${base}/arrow-right.svg`,
  bgGlow1: `${base}/bg-glow-1.svg`,
  bgGlow2: `${base}/bg-glow-2.svg`,
} as const;

export function AuthIcon({
  src,
  size,
  alt = '',
}: {
  src: string;
  size: number;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
