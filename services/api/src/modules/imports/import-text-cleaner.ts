import * as cheerio from 'cheerio';

/** Chrome / chrome-adjacent selectors stripped before article text extraction. */
const CHROME_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'canvas',
  'video',
  'audio',
  'source',
  'track',
  'map',
  'area',
  'link',
  'meta',
  'nav',
  'footer',
  'aside',
  'header',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'dialog',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="search"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[aria-hidden="true"]',
  '.nav',
  '.navbar',
  '.navigation',
  '.menu',
  '.sidebar',
  '.side-bar',
  '.footer',
  '.site-footer',
  '.header',
  '.site-header',
  '.cookie',
  '.cookies',
  '.cookie-banner',
  '.cookie-consent',
  '#cookie',
  '#cookies',
  '.consent',
  '.gdpr',
  '.newsletter',
  '.subscribe',
  '.subscription',
  '.paywall',
  '.promo',
  '.advert',
  '.advertisement',
  '.ads',
  '.ad-slot',
  '.social',
  '.share',
  '.sharing',
  '.share-buttons',
  '.related',
  '.related-articles',
  '.related-posts',
  '.recommended',
  '.comments',
  '#comments',
  '.comment-list',
  '.breadcrumb',
  '.breadcrumbs',
  '.pagination',
  '.pager',
  '.toc',
  '.table-of-contents',
  '.mw-editsection',
  '.noprint',
  '.mw-jump-link',
  '.vector-toc',
  '.vector-header',
  '.vector-menu',
  '.catlinks',
  '#catlinks',
  '#mw-navigation',
  '#mw-panel',
  '#mw-head',
  '#footer',
  '#siteNotice',
  '.skip-link',
  '.skip-to-content',
  '.screen-reader-text',
  '.visually-hidden',
  '.sr-only',
  '.hatnote',
  '.dablink',
  '.ambox',
  '.metadata',
  '.navbox',
  '.vertical-navbox',
  '.sistersitebox',
].join(', ');

const GENERIC_IMAGE_LABELS = new Set([
  'image',
  'img',
  'photo',
  'picture',
  'graphic',
  'icon',
  'logo',
  'avatar',
  'thumbnail',
  'banner',
  'spacer',
  'decoration',
  'decorative',
]);

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'br',
  'hr',
  'figure',
  'figcaption',
  'details',
  'summary',
]);

export function looksLikeHtml(input: string): boolean {
  const sample = input.slice(0, 8000);
  if (/<(html|body|article|main|div|p|table|img|h[1-6]|ul|ol|section)\b/i.test(sample)) return true;
  if (/&nbsp;|&amp;|&lt;|&#\d+;/i.test(sample) && /<\/?[a-z][\s\S]*>/i.test(sample)) return true;
  return false;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
    });
}

function isMeaningfulCaption(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = decodeBasicEntities(raw).replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 160) return null;
  if (/^https?:\/\//i.test(t)) return null;
  if (/^data:/i.test(t)) return null;
  const lower = t.toLowerCase();
  if (GENERIC_IMAGE_LABELS.has(lower)) return null;
  if (/^(img|image|photo|picture|icon|logo)[-_\s]?\d*$/i.test(t)) return null;
  if (/^[\W\d_]+$/.test(t)) return null;
  return t;
}

/** Strip binary/base64/markdown image noise and leftover markup from plain text. */
export function stripImageNoise(text: string): string {
  let out = text;
  out = out.replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, ' ');
  out = out.replace(/!\[([^\]]*)\]\((?:[^)]+)\)/g, (_, alt: string) => {
    const caption = isMeaningfulCaption(alt);
    return caption ? `\n[Image: ${caption}]\n` : ' ';
  });
  out = out.replace(/<img\b[^>]*>/gi, ' ');
  out = out.replace(/<\/?(?:svg|picture|source|figure|figcaption)\b[^>]*>/gi, ' ');
  out = out.replace(/(?:^|\s)(?:[A-Za-z0-9+/]{80,}={0,2})(?=\s|$)/g, ' ');
  return out;
}

export function normalizeImportWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripChromePhrases(text: string): string {
  return text
    .replace(/^\s*skip to (main )?content\s*$/gim, '')
    .replace(/^\s*jump to (navigation|search|content)\s*$/gim, '')
    .replace(/^\s*cookie(s)? (policy|settings|preferences|notice)\s*$/gim, '')
    .replace(/^\s*accept( all)? cookies\s*$/gim, '')
    .replace(/^\s*share (this|on)\b.*$/gim, '')
    .replace(/^\s*related articles?\s*$/gim, '')
    .replace(/^\s*you may also like\s*$/gim, '');
}

/** Final plain-text cleanup shared by Paste / URL / PDF / EPUB. */
export function cleanImportPlainText(text: string): string {
  let out = decodeBasicEntities(text);
  out = stripImageNoise(out);
  out = stripChromePhrases(out);
  out = out.replace(/<\/?[a-z][^>]*>/gi, ' ');
  out = decodeBasicEntities(out);
  out = normalizeImportWhitespace(out);
  return out;
}

type CheerioAPI = ReturnType<typeof cheerio.load>;

function cellText($: CheerioAPI, el: any): string {
  const raw = $(el).text().replace(/\s+/g, ' ').trim();
  return decodeBasicEntities(raw);
}

function isLayoutTable($: CheerioAPI, table: any): boolean {
  const role = ($(table).attr('role') || '').toLowerCase();
  if (role === 'presentation' || role === 'none') return true;
  const cls = `${$(table).attr('class') || ''} ${$(table).attr('id') || ''}`.toLowerCase();
  if (/(nav|menu|layout|grid|wrapper|chrome|sidebar|footer|header|infobox-?nav)/i.test(cls)) {
    return true;
  }

  const cells = $(table).find('td, th').toArray();
  if (cells.length === 0) return true;
  if (cells.length <= 2) {
    const linkHeavy = cells.every((c) => {
      const links = $(c).find('a').length;
      const words = cellText($, c).split(/\s+/).filter(Boolean).length;
      return links > 0 && words <= 6;
    });
    if (linkHeavy) return true;
  }

  let shortLinkCells = 0;
  for (const c of cells) {
    const t = cellText($, c);
    const words = t.split(/\s+/).filter(Boolean).length;
    const links = $(c).find('a').length;
    if ((!t || words <= 2) && links > 0) shortLinkCells++;
  }
  return shortLinkCells / cells.length >= 0.75;
}

function tableToPlainText($: CheerioAPI, table: any): string {
  if (isLayoutTable($, table)) return '';

  const rows: string[][] = [];
  $(table)
    .find('tr')
    .each((_, tr) => {
      const cols: string[] = [];
      $(tr)
        .children('th, td')
        .each((__, cell) => {
          const t = cellText($, cell);
          if (t) cols.push(t);
        });
      if (cols.length) rows.push(cols);
    });

  if (rows.length === 0) return '';

  const flat = rows.flat();
  if (flat.length <= 3 && flat.every((c) => c.split(/\s+/).length <= 4)) {
    const onlyLinks = $(table).find('a').length >= flat.length;
    if (onlyLinks) return '';
  }

  return rows.map((cols) => cols.join(' | ')).join('\n');
}

function nearestMediaCaption($: CheerioAPI, el: any): string | null {
  const $el = $(el);
  const container = $el.closest('figure, .thumb, .thumbinner, .gallerybox, .mw-file');
  if (container.length) {
    const fromFig = isMeaningfulCaption(container.find('figcaption').first().text());
    if (fromFig) return fromFig;
    const fromThumb = isMeaningfulCaption(
      container.find('.thumbcaption, .mw-thumbcaption, .gallerytext').first().text(),
    );
    if (fromThumb) return fromThumb;
  }
  return (
    isMeaningfulCaption($el.attr('alt')) ||
    isMeaningfulCaption($el.attr('title')) ||
    isMeaningfulCaption($el.attr('aria-label'))
  );
}

function imagePlaceholder($: CheerioAPI, el: any): string {
  const caption = nearestMediaCaption($, el);
  return caption ? `\n[Image: ${caption}]\n` : '';
}

function isMediaCaptionNode($: CheerioAPI, node: any): boolean {
  const tag = String(node.name || '').toLowerCase();
  const cls = `${$(node).attr('class') || ''}`;
  if (tag === 'figcaption') return true;
  if (/\b(thumbcaption|mw-thumbcaption|gallerytext)\b/i.test(cls)) return true;
  return false;
}

function nodeToText($: CheerioAPI, node: any): string {
  if (!node) return '';
  if (node.type === 'text') {
    return node.data || '';
  }
  if (node.type !== 'tag') return '';

  const tag = String(node.name || '').toLowerCase();

  if (tag === 'br' || tag === 'hr') return '\n';
  if (tag === 'img') return imagePlaceholder($, node);
  if (tag === 'picture') {
    const img = $(node).find('img').get(0);
    return img ? imagePlaceholder($, img) : '';
  }
  if (tag === 'svg' || tag === 'math') return '';
  if (tag === 'table') {
    const plain = tableToPlainText($, node);
    return plain ? `\n${plain}\n` : '';
  }
  // Captions are emitted once via [Image: …] from the related <img>.
  if (isMediaCaptionNode($, node)) {
    const container = $(node).closest('figure, .thumb, .thumbinner, .gallerybox, .mw-file');
    if (container.find('img, picture, svg').length) return '';
    const t = isMeaningfulCaption($(node).text());
    return t ? `\n${t}\n` : '';
  }

  let inner = '';
  for (const child of node.children || []) {
    inner += nodeToText($, child);
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const heading = inner.replace(/\s+/g, ' ').trim();
    return heading ? `\n\n## ${heading}\n\n` : '\n';
  }
  if (tag === 'li') return `\n• ${inner.trim()}\n`;
  if (BLOCK_TAGS.has(tag)) return `\n${inner}\n`;
  return inner;
}

/**
 * Wikipedia / Parsoid often renders galleries as <p><img></p><p>caption</p>.
 * Promote sibling captions onto the image alt, then drop the caption paragraph.
 */
function promoteSiblingFileCaptions($: CheerioAPI): void {
  $('span[typeof*="mw:File"], figure, .thumb').each((_, el) => {
    const $el = $(el);
    const img = $el.find('img').get(0) || ($el.is('img') ? el : null);
    if (!img) return;

    const fileBlock = $el.closest('p').length ? $el.closest('p') : $el;
    const captionEl = fileBlock.next('p');
    if (!captionEl.length) return;
    if (captionEl.find('img, span[typeof*="mw:File"], table').length) return;

    const caption = isMeaningfulCaption(captionEl.text());
    if (!caption) return;

    if (!isMeaningfulCaption($(img).attr('alt'))) {
      $(img).attr('alt', caption);
    }
    captionEl.remove();
  });
}

/**
 * Convert HTML to reader-ready plain text:
 * strips chrome, tables → "a | b | c" rows, images → optional [Image: caption].
 */
export function htmlToCleanText(html: string): string {
  if (!html?.trim()) return '';

  const $ = cheerio.load(html);
  $(CHROME_SELECTORS).remove();
  $('svg').remove();
  // Drop empty Parsoid template marker spans (payload lives in data-mw attrs).
  $('span[typeof*="mw:Transclusion"]').each((_, el) => {
    if (!$(el).text().trim() && !$(el).find('img, table, p').length) {
      $(el).remove();
    }
  });
  $('[data-mw]').removeAttr('data-mw');
  promoteSiblingFileCaptions($);

  const root =
    $('article').get(0) ||
    $('main').get(0) ||
    $('[role="main"]').get(0) ||
    $('.mw-parser-output').get(0) ||
    $('.post-content, .entry-content, .article-body, #content, #mw-content-text').get(0) ||
    $('body').get(0) ||
    $.root().children().get(0);

  if (!root) return cleanImportPlainText($.root().text());

  const text = nodeToText($, root);
  return cleanImportPlainText(text);
}

/**
 * Detect repeated short lines at page tops/bottoms (headers/footers) and remove them.
 */
export function stripRepeatedPdfHeadersFooters(pages: string[]): string[] {
  if (pages.length < 2) return pages.map((p) => cleanPdfPageText(p));

  const headCounts = new Map<string, number>();
  const footCounts = new Map<string, number>();

  const headLine = (page: string) => {
    const line = page
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) || '';
    return line.length > 0 && line.length <= 80 ? line : '';
  };
  const footLine = (page: string) => {
    const lines = page
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const line = lines[lines.length - 1] || '';
    return line.length > 0 && line.length <= 80 ? line : '';
  };

  for (const page of pages) {
    const h = headLine(page);
    const f = footLine(page);
    if (h) headCounts.set(h, (headCounts.get(h) || 0) + 1);
    if (f) footCounts.set(f, (footCounts.get(f) || 0) + 1);
  }

  const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
  const dropHeads = new Set(
    [...headCounts.entries()].filter(([, n]) => n >= threshold).map(([l]) => l),
  );
  const dropFoots = new Set(
    [...footCounts.entries()].filter(([, n]) => n >= threshold).map(([l]) => l),
  );

  const pageNum = /^(page\s*)?\d{1,4}$/i;

  return pages.map((page) => {
    let lines = page.split('\n');
    while (lines.length) {
      const t = lines[0].trim();
      if (t && (dropHeads.has(t) || pageNum.test(t))) {
        lines = lines.slice(1);
        continue;
      }
      break;
    }
    while (lines.length) {
      const t = lines[lines.length - 1].trim();
      if (t && (dropFoots.has(t) || pageNum.test(t))) {
        lines = lines.slice(0, -1);
        continue;
      }
      break;
    }
    return cleanPdfPageText(lines.join('\n'));
  });
}

/**
 * Normalize PDF/OCR table-ish spacing so chapters stay readable for vocabulary tapping.
 */
export function cleanPdfPageText(text: string): string {
  let out = text.replace(/\r\n?/g, '\n');
  out = out
    .split('\n')
    .map((line) => {
      const gaps = line.match(/ {2,}/g);
      if (gaps && gaps.length >= 2 && line.trim().length > 0) {
        return line
          .trim()
          .split(/ {2,}/)
          .map((c) => c.trim())
          .filter(Boolean)
          .join(' | ');
      }
      return line;
    })
    .join('\n');

  return cleanImportPlainText(out);
}

/**
 * Prepare pasted content: HTML paste gets full HTML cleanup; plain text still loses image noise.
 */
export function preparePastedText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (looksLikeHtml(trimmed)) {
    return htmlToCleanText(trimmed);
  }
  return cleanImportPlainText(trimmed);
}
