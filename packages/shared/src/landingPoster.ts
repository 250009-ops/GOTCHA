/**
 * Landing-page poster for every book that does not have one of the six finished photographs.
 * Measured from those sheets (800×1200): cream paper, hairline frame, author + NO. above a
 * full-bleed linocut, then the title, a rule, the language, and the purple G.
 * The picture is an original print for that title — not the old geometric motif.
 */
const PAPER = '#F4ECDF';
const INK_TEXT = '#14112B';
const BRAND = '#2107AA';
const FRAME = '#CBC3B6';

function normalizeCoverKey(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFC').toLowerCase().trim();
}

function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  const bytes = new TextEncoder().encode(input);
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function titleFont(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "'Noto Sans Arabic', Literata, serif";
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text)) return "'Noto Sans KR', Literata, sans-serif";
  if (/[\u0400-\u052F]/.test(text) || text.includes('\u02BB') || text.includes('\u02BC')) return 'Literata, Fraunces, serif';
  return 'Fraunces, Literata, serif';
}

/** Small label above the picture. Latin stays in Manrope, like the photographed posters. */
function labelFont(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "'Noto Sans Arabic', Manrope, sans-serif";
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text)) return "'Noto Sans KR', Manrope, sans-serif";
  if (/[\u0400-\u052F]/.test(text)) return 'Literata, Manrope, serif';
  return 'Manrope, Inter, sans-serif';
}

const INK = '#0E2244';
const CREAM = '#F3E6C8';
const SUN = '#E39A4A';
const LIT = '#F0C27A';

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'ENGLISH',
  tr: 'TÜRKÇE',
  ru: 'РУССКИЙ',
  uz: 'OʻZBEKCHA',
  ar: 'العربية',
  de: 'DEUTSCH',
  ko: '한국어',
};

export function posterLanguageLabel(language: string | null | undefined): string {
  const code = String(language ?? '').trim().toLowerCase();
  if (!code) return '';
  return LANGUAGE_LABEL[code] ?? code.toUpperCase();
}

/** Two digits, 07–99, stable for a title. 01–06 stay on the photographed landing posters. */
export function posterIssue(title: string): string {
  const n = (fnv1a32(normalizeCoverKey(title)) % 93) + 7;
  return String(n).padStart(2, '0');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rngOf(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ri(rng: () => number, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

type Kind = 'street' | 'harbor' | 'table' | 'road' | 'arch' | 'roofs' | 'moor' | 'room';

function sceneKind(title: string, genre: string | null | undefined, seed: number): Kind {
  const hay = `${title} ${genre ?? ''}`.toLowerCase();
  if (/sea|ship|boat|harbor|harbour|rig|oil|kuş|bird|sahmer|deniz|море|바다|river|port/.test(hay)) return 'harbor';
  if (/ghost|gothic|opera|arch|cistern|sarnıç|screw|manor|phantom|قصر/.test(hay)) return 'arch';
  if (/tea|bread|kitchen|semaver|samovar|table|food|хлеб|밥|kaşağı/.test(hay)) return 'table';
  if (/horse|rider|efe|ride|степ|ot kish|dalalar|kağnı/.test(hay)) return 'road';
  if (/heart|wall|yellow|room|madness|палата|wallpaper|cell/.test(hay)) return 'room';
  if (/moor|hound|fog|baskerville|heath|train|station/.test(hay)) return 'moor';
  if (/moon|star|yulduz|night|crime|street|город|ноч|wing|날개/.test(hay)) return 'street';
  if (/bird|roof|kuşlar|son kuş/.test(hay)) return 'roofs';
  const kinds: Kind[] = ['street', 'harbor', 'table', 'road', 'arch', 'roofs', 'moor', 'room'];
  return kinds[seed % kinds.length]!;
}

function stars(rng: () => number, n: number, ink: string): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = ri(rng, 16, 730);
    const y = ri(rng, 12, 220);
    s += `<circle cx="${x}" cy="${y}" r="${rng() > 0.8 ? 1.8 : 1}" fill="${CREAM}" opacity="${(0.45 + rng() * 0.5).toFixed(2)}"/>`;
  }
  return s.replace('fill="' + CREAM + '"', `fill="${ink === INK ? CREAM : CREAM}"`);
}

function windows(x: number, y: number, cols: number, rows: number, rng: () => number, night: boolean): string {
  let s = '';
  const w = 10;
  const h = 14;
  const gx = 16;
  const gy = 22;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = night && rng() > 0.72;
      s += `<rect x="${x + c * gx}" y="${y + r * gy}" width="${w}" height="${h}" fill="${lit ? LIT : CREAM}" opacity="${lit ? 1 : 0.9}"/>`;
    }
  }
  return s;
}

function birds(rng: () => number, n: number, y0: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = ri(rng, 40, 680);
    const y = y0 + ri(rng, 0, 80);
    const w = ri(rng, 10, 18);
    s += `<path d="M${x} ${y} q${w / 2} ${-6 - (i % 3)} ${w} 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return s;
}

function figure(x: number, y: number, fill: string): string {
  return `<g fill="${fill}">
    <circle cx="${x}" cy="${y}" r="11"/>
    <path d="M${x - 16} ${y + 18} h32 l6 46 h-10 l-4 -28 -4 28 h-10 l-4 -28 -4 28 h-10 z"/>
    <path d="M${x - 18} ${y + 64} h12 l4 48 h-8 z M${x + 6} ${y + 64} h12 l4 48 h-8 z"/>
  </g>`;
}

function street(rng: () => number): string {
  const night = rng() > 0.25;
  const sky = night ? pick(rng, ['#0C1E3A', '#121A38', '#0A2344']) : '#D5E2EF';
  const moon = rng() > 0.3;
  const mx = ri(rng, 480, 660);
  let b = `<rect width="750" height="722" fill="${sky}"/>`;
  if (night) b += stars(rng, ri(rng, 18, 40), sky);
  if (moon) b += `<circle cx="${mx}" cy="${ri(rng, 50, 110)}" r="${ri(rng, 28, 46)}" fill="${night ? CREAM : SUN}"/>`;
  b += `<ellipse cx="${ri(rng, 80, 220)}" cy="${ri(rng, 70, 140)}" rx="${ri(rng, 70, 120)}" ry="22" fill="${night ? '#16325A' : INK}" opacity=".9"/>`;
  b += `<ellipse cx="${ri(rng, 400, 620)}" cy="${ri(rng, 90, 160)}" rx="${ri(rng, 80, 140)}" ry="18" fill="${night ? '#1A3A64' : INK}" opacity=".75"/>`;
  const leftH = ri(rng, 260, 420);
  const rightH = ri(rng, 340, 520);
  b += `<rect x="0" y="${722 - leftH}" width="${ri(rng, 150, 230)}" height="${leftH}" fill="${INK}"/>`;
  b += windows(28, 722 - leftH + 28, 4, Math.floor(leftH / 28) - 1, rng, night);
  const rw = ri(rng, 180, 260);
  b += `<rect x="${750 - rw}" y="${722 - rightH}" width="${rw}" height="${rightH}" fill="${night ? '#081628' : INK}"/>`;
  b += windows(750 - rw + 24, 722 - rightH + 36, 5, Math.floor(rightH / 30) - 1, rng, night);
  if (rng() > 0.4) {
    b += `<path d="M220 430 Q375 340 530 430 L530 468 Q375 390 220 468 Z" fill="${night ? '#152848' : '#16325A'}"/>`;
    b += `<path d="M250 468 Q375 410 500 468" fill="none" stroke="${CREAM}" stroke-width="3"/>`;
  }
  b += `<polygon points="70,722 300,470 450,470 680,722" fill="${night ? '#1A3050' : '#C9D7E4'}"/>`;
  for (let i = 0; i < 8; i++) {
    const y = 500 + i * 28;
    b += `<line x1="${120 - i * 12}" y1="${y}" x2="${630 + i * 8}" y2="${y}" stroke="${night ? CREAM : INK}" stroke-width="1.4" opacity=".55"/>`;
  }
  b += figure(ri(rng, 300, 420), ri(rng, 470, 520), night ? '#07111F' : INK);
  return b;
}

function harbor(rng: () => number): string {
  const sky = pick(rng, ['#E7DCC4', '#F0E2C4', '#D9E3EE']);
  let b = `<rect width="750" height="722" fill="${sky}"/>`;
  const sunX = rng() > 0.5 ? ri(rng, 80, 180) : ri(rng, 540, 680);
  b += `<circle cx="${sunX}" cy="${ri(rng, 70, 140)}" r="${ri(rng, 36, 58)}" fill="${SUN}"/>`;
  b += `<ellipse cx="${ri(rng, 60, 200)}" cy="120" rx="90" ry="26" fill="${INK}"/>`;
  b += `<ellipse cx="${ri(rng, 480, 680)}" cy="${ri(rng, 90, 150)}" rx="110" ry="22" fill="${INK}" opacity=".85"/>`;
  b += birds(rng, ri(rng, 3, 7), 80);
  if (rng() > 0.45) {
    const dx = ri(rng, 250, 420);
    b += `<g fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="square">
      <path d="M${dx} 470 V120"/>
      <path d="M${dx - 70} 200 H${dx + 70}"/>
      <path d="M${dx - 40} 300 H${dx + 40}"/>
      <path d="M${dx - 28} 180 L${dx} 120 L${dx + 28} 180"/>
    </g>`;
    b += `<rect x="${dx - 90}" y="430" width="180" height="40" fill="${INK}"/>`;
  } else {
    b += `<path d="M40 430 L80 390 L120 430 L150 360 L190 430 L230 400 L280 430 L320 370 L360 430 L420 390 L520 350 L560 390 L620 360 L700 400 L750 380 V460 H40 Z" fill="${INK}"/>`;
  }
  b += `<rect y="460" width="750" height="262" fill="#16325A"/>`;
  for (let i = 0; i < 9; i++) {
    b += `<path d="M0 ${490 + i * 24} Q187 ${476 + i * 24} 375 ${492 + i * 24} T750 ${488 + i * 24}" fill="none" stroke="${CREAM}" stroke-width="${1.2 + i * 0.25}" opacity=".8"/>`;
  }
  b += figure(ri(rng, 80, 160), 520, INK);
  b += figure(ri(rng, 520, 640), 530, '#07111F');
  return b;
}

function table(rng: () => number): string {
  let b = `<rect width="750" height="722" fill="#16325A"/>`;
  const wx = rng() > 0.5 ? 430 : 40;
  b += `<rect x="${wx}" y="40" width="280" height="340" fill="#8FB4D4"/>`;
  b += `<circle cx="${wx + 200}" cy="120" r="36" fill="${SUN}"/>`;
  b += `<path d="M${wx + 20} 300 L${wx + 80} 230 L${wx + 140} 280 L${wx + 220} 200 L${wx + 270} 300 Z" fill="${INK}"/>`;
  b += `<path d="M${wx === 40 ? 300 : 40} 40 Q${wx === 40 ? 180 : 520} 80 ${wx === 40 ? 40 : 430} 420" fill="${INK}" opacity=".95"/>`;
  b += `<ellipse cx="375" cy="560" rx="250" ry="70" fill="#0C2240"/>`;
  b += `<path d="M160 520 H590 L640 640 H110 Z" fill="#1C3E68"/>`;
  for (let i = 0; i < 7; i++) {
    b += `<path d="M${150 + i * 60} 530 L${190 + i * 60} 630" stroke="${CREAM}" stroke-width="3" opacity=".7"/>`;
  }
  const vx = ri(rng, 280, 400);
  b += `<ellipse cx="${vx}" cy="470" rx="54" ry="16" fill="${CREAM}"/>`;
  b += `<path d="M${vx - 36} 470 V390 Q${vx} 360 ${vx + 36} 390 V470" fill="${INK}"/>`;
  b += `<rect x="${vx - 8}" y="330" width="16" height="40" fill="${INK}"/>`;
  b += `<circle cx="${vx}" cy="324" r="14" fill="${INK}"/>`;
  b += `<path d="M${vx} 300 C${vx + 20} 260 ${vx - 10} 240 ${vx + 8} 200" fill="none" stroke="${CREAM}" stroke-width="3"/>`;
  b += `<path d="M${vx + 16} 310 C${vx + 40} 270 ${vx + 10} 250 ${vx + 28} 214" fill="none" stroke="${CREAM}" stroke-width="2"/>`;
  b += `<ellipse cx="${vx + 90}" cy="500" rx="28" ry="8" fill="${CREAM}"/>`;
  b += `<path d="M${vx + 70} 500 V470 h40 V500" fill="${INK}"/>`;
  b += figure(rng() > 0.5 ? 560 : 150, 360, '#07111F');
  return b;
}

function road(rng: () => number): string {
  const sky = pick(rng, ['#E7D7B4', '#F2E4C6', '#D7E4F0']);
  let b = `<rect width="750" height="722" fill="${sky}"/>`;
  b += `<circle cx="${ri(rng, 80, 220)}" cy="${ri(rng, 60, 120)}" r="${ri(rng, 40, 64)}" fill="${SUN}"/>`;
  b += `<ellipse cx="180" cy="520" rx="280" ry="120" fill="#1C4A72"/>`;
  b += `<ellipse cx="560" cy="560" rx="260" ry="140" fill="${INK}"/>`;
  b += `<path d="M0 620 Q200 540 400 600 T750 560 V722 H0 Z" fill="#10243C"/>`;
  const hx = ri(rng, 280, 460);
  b += `<g fill="${INK}" transform="translate(${hx} 430)">
    <ellipse cx="0" cy="70" rx="70" ry="22"/>
    <path d="M-40 60 Q-20 10 30 20 Q70 28 78 58 Q40 48 -10 70 Z"/>
    <path d="M-55 78 Q-70 40 -40 36"/>
    <circle cx="62" cy="28" r="12"/>
    <path d="M48 36 L70 8 L86 34"/>
    <circle cx="78" cy="-6" r="9"/>
    <path d="M70 -4 L86 -28 L98 -2"/>
  </g>`;
  b += birds(rng, ri(rng, 0, 4), 80);
  return b;
}

function arch(rng: () => number): string {
  let b = `<rect width="750" height="722" fill="#101C30"/>`;
  const n = ri(rng, 3, 5);
  const gap = 700 / n;
  for (let i = 0; i < n; i++) {
    const x = 40 + i * gap;
    const rh = ri(rng, 180, 320);
    b += `<path d="M${x} 640 V${360 - rh * 0.15} Q${x + gap / 2} ${180 - (i % 2) * 40} ${x + gap - 16} ${360 - rh * 0.15} V640 Z" fill="${i % 2 ? '#1A3358' : INK}"/>`;
    b += `<path d="M${x + 28} 640 V${400} Q${x + gap / 2} ${260} ${x + gap - 44} 400 V640" fill="#0A1628"/>`;
  }
  if (rng() > 0.35) {
    const bx = ri(rng, 260, 460);
    b += `<polygon points="${bx},80 ${bx + 80},640 ${bx - 40},640" fill="${SUN}" opacity=".35"/>`;
  }
  b += `<rect y="620" width="750" height="102" fill="#0A1628"/>`;
  for (let i = 0; i < 6; i++) b += `<line x1="0" y1="${640 + i * 12}" x2="750" y2="${640 + i * 12}" stroke="${CREAM}" stroke-width="1" opacity=".25"/>`;
  return b;
}

function roofs(rng: () => number): string {
  const sky = pick(rng, ['#12183A', '#0E2248', '#1A2040']);
  let b = `<rect width="750" height="722" fill="${sky}"/>`;
  b += stars(rng, ri(rng, 20, 48), sky);
  b += `<circle cx="${ri(rng, 80, 220)}" cy="${ri(rng, 70, 150)}" r="${ri(rng, 48, 78)}" fill="${CREAM}"/>`;
  b += birds(rng, ri(rng, 5, 11), ri(rng, 60, 160));
  let x = 0;
  while (x < 750) {
    const w = ri(rng, 90, 170);
    const h = ri(rng, 80, 180);
    b += `<polygon points="${x},${620} ${x + w / 2},${620 - h} ${x + w},620" fill="${INK}"/>`;
    if (rng() > 0.55) b += `<rect x="${x + w / 2 - 6}" y="${620 - h - ri(rng, 16, 40)}" width="12" height="${ri(rng, 16, 40)}" fill="${INK}"/>`;
    x += w - 8;
  }
  b += `<rect y="620" width="750" height="102" fill="#081422"/>`;
  for (let i = 0; i < 4; i++) {
    b += `<rect x="${ri(rng, 40, 680)}" y="${ri(rng, 480, 580)}" width="16" height="22" fill="${rng() > 0.5 ? LIT : CREAM}"/>`;
  }
  return b;
}

function moor(rng: () => number): string {
  let b = `<rect width="750" height="722" fill="#D5DDEA"/>`;
  b += `<circle cx="${ri(rng, 500, 680)}" cy="90" r="34" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`;
  for (let i = 0; i < 5; i++) {
    b += `<ellipse cx="${120 + i * 140}" cy="${200 + (i % 2) * 30}" rx="${160 - i * 8}" ry="18" fill="${INK}" opacity="${(0.15 + i * 0.08).toFixed(2)}"/>`;
  }
  b += `<path d="M0 460 Q180 400 360 470 T750 430 V560 H0 Z" fill="#1E3C5C"/>`;
  b += `<path d="M0 540 Q220 490 420 560 T750 520 V722 H0 Z" fill="${INK}"/>`;
  const hx = ri(rng, 460, 620);
  b += `<rect x="${hx}" y="360" width="70" height="90" fill="#0A1628"/>`;
  b += `<polygon points="${hx - 8},360 ${hx + 35},328 ${hx + 78},360" fill="#0A1628"/>`;
  b += `<rect x="${hx + 28}" y="390" width="14" height="20" fill="${LIT}"/>`;
  b += `<path d="M80 722 C180 600 260 640 340 722" fill="none" stroke="${CREAM}" stroke-width="8" opacity=".7"/>`;
  return b;
}

function room(rng: () => number): string {
  let b = `<rect width="750" height="722" fill="#1A2744"/>`;
  const motif = rng() > 0.5;
  for (let y = 30; y < 690; y += 36) {
    for (let x = 20; x < 730; x += 36) {
      b += motif
        ? `<circle cx="${x}" cy="${y}" r="4" fill="${CREAM}" opacity=".35"/>`
        : `<path d="M${x} ${y} l8 8 l-8 8 l-8 -8 z" fill="${CREAM}" opacity=".28"/>`;
    }
  }
  b += `<rect x="70" y="80" width="250" height="360" fill="#0E1C32"/>`;
  b += `<rect x="96" y="106" width="198" height="250" fill="#9EBEA0"/>`;
  for (let i = 0; i < 4; i++) b += `<line x1="${116 + i * 48}" y1="106" x2="${116 + i * 48}" y2="356" stroke="${INK}" stroke-width="6"/>`;
  b += `<rect x="400" y="420" width="250" height="28" fill="${INK}"/>`;
  b += `<rect x="430" y="448" width="18" height="160" fill="${INK}"/>`;
  b += `<rect x="600" y="448" width="18" height="160" fill="${INK}"/>`;
  b += `<rect x="80" y="560" width="280" height="24" fill="${INK}"/>`;
  b += `<rect x="110" y="500" width="220" height="60" fill="#243656"/>`;
  if (rng() > 0.4) b += `<circle cx="${ri(rng, 140, 280)}" cy="530" r="16" fill="${CREAM}" opacity=".8"/>`;
  return b;
}

function sceneBody(title: string, genre: string | null | undefined): string {
  const seed = fnv1a32(`${normalizeCoverKey(title)}|${normalizeCoverKey(genre)}`);
  const rng = rngOf(seed);
  const kind = sceneKind(title, genre, seed);
  const body = {
    street: street,
    harbor: harbor,
    table: table,
    road: road,
    arch: arch,
    roofs: roofs,
    moor: moor,
    room: room,
  }[kind](rng);
  const flip = rng() > 0.5 ? `<g transform="translate(750 0) scale(-1 1)">${body}</g>` : body;
  let grain = '';
  for (let i = -200; i < 1100; i += 8) {
    grain += `<line x1="${i}" y1="0" x2="${i - 160}" y2="722" stroke="#0E2244" stroke-width="0.8" opacity="0.09"/>`;
  }
  return `<svg x="25" y="108" width="750" height="722" viewBox="0 0 750 722" preserveAspectRatio="xMidYMid slice">${flip}${grain}</svg>`;
}

function titleSize(title: string): number {
  const n = Array.from(title).length;
  if (n <= 8) return 84;
  if (n <= 14) return 72;
  if (n <= 22) return 58;
  if (n <= 34) return 46;
  return 36;
}

export function landingPosterSvg(input: {
  title: string;
  author?: string | null;
  language?: string | null;
  genre?: string | null;
}): string {
  const title = String(input.title ?? '').trim() || 'Untitled';
  const author = String(input.author ?? '').trim();
  const language = posterLanguageLabel(input.language);
  const issue = posterIssue(title);
  const font = titleFont(title);
  const dir = /[\u0600-\u06FF]/.test(title) ? 'rtl' : 'ltr';
  const authorPx = Array.from(author).length > 24 ? 14 : 16;
  const authorBlock = author
    ? `<foreignObject x="52" y="42" width="560" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${labelFont(author)};font-size:${authorPx}px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${INK_TEXT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(author)}</div></foreignObject>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(title)}" style="position:absolute;inset:0;width:100%;height:100%">
  <rect width="800" height="1200" fill="${PAPER}"/>
  ${sceneBody(title, input.genre)}
  <rect x="24" y="24" width="752" height="1152" fill="none" stroke="${FRAME}" stroke-width="1.5"/>
  ${authorBlock}
  <text x="748" y="74" text-anchor="end" font-family="Manrope, Inter, sans-serif" font-size="18" font-weight="700" letter-spacing="1.5" fill="${INK_TEXT}">NO. ${issue}</text>
  <foreignObject x="52" y="848" width="696" height="220"><div xmlns="http://www.w3.org/1999/xhtml" dir="${dir}" style="font-family:${font};font-weight:600;font-size:${titleSize(title)}px;line-height:.92;letter-spacing:-.03em;color:${INK_TEXT};overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${esc(title)}</div></foreignObject>
  <line x1="56" y1="1083" x2="744" y2="1083" stroke="${INK_TEXT}" stroke-width="1.5"/>
  <text x="56" y="1132" font-family="Manrope, Inter, sans-serif" font-size="16" font-weight="700" letter-spacing="1.6" fill="${INK_TEXT}">${esc(language)}</text>
  <rect x="704" y="1104" width="40" height="40" rx="10" fill="${BRAND}"/>
  <text x="724" y="1132" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="20" font-weight="800" fill="#fff">G</text>
</svg>`;
}
