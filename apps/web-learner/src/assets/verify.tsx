// Vite base is `/` locally and `/learn/` in production — never hardcode `/assets/...`.
const base = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}assets/verify`;

export const verifyAssets = {
  envelope: `${base}/envelope.svg`,
  bgGlow: `${base}/bg-glow-web.svg`,
  badgeCheck: `${base}/badge-check.svg`,
  user: `${base}/user.svg`,
  externalLink: `${base}/external-link-web.svg`,
  chevronLeft: `${base}/chevron-left.svg`,
} as const;

export function VerifyIcon({
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
