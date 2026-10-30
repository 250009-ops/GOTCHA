const base = '/assets/landing';

export const landingAssets = {
  heroVisual: `${base}/hero-visual.png`,
  menuIcon: `${base}/menu.svg`,
  bgAccent1: `${base}/bg-accent-1.svg`,
  bgAccent2: `${base}/bg-accent-2.svg`,
  arrowRight: `${base}/arrow-right.svg`,
  arrowRightLg: `${base}/arrow-right-lg.svg`,
  sparkles: `${base}/sparkles.svg`,
  sparklesWhite: `${base}/sparkles-white.svg`,
  sparklesBadge: `${base}/sparkles-badge.svg`,
  play: `${base}/play.svg`,
  check: `${base}/check.svg`,
  checkWhite: `${base}/check-white.svg`,
  bookOpen: `${base}/book-open.svg`,
  bookOpenSm: `${base}/book-open-sm.svg`,
  brain: `${base}/brain.svg`,
  brainSm: `${base}/brain-sm.svg`,
  refreshCw: `${base}/refresh-cw.svg`,
  refreshCwSm: `${base}/refresh-cw-sm.svg`,
  globe: `${base}/globe.svg`,
  barChart: `${base}/bar-chart.svg`,
  chartLine: `${base}/chart-line.svg`,
  upload: `${base}/upload.svg`,
  cloudUpload: `${base}/cloud-upload.svg`,
  star: `${base}/star.svg`,
  circleX: `${base}/circle-x.svg`,
  library: `${base}/library.svg`,
  mousePointerClick: `${base}/mouse-pointer-click.svg`,
  flame: `${base}/flame.svg`,
  flameSm: `${base}/flame-sm.svg`,
  creditCard: `${base}/credit-card.svg`,
  gift: `${base}/gift.svg`,
  alarmClock: `${base}/alarm-clock.svg`,
} as const;

export function Icon({
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
      className="icon-leaf"
      style={{ width: size, height: size }}
    />
  );
}
