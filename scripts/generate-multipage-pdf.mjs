/**
 * Synthetic multi-page text PDF for import smoke tests (no external deps).
 * Usage: node scripts/generate-multipage-pdf.mjs [pages] [outPath]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const pageCount = Math.max(1, Math.min(500, Number(process.argv[2] || 60)));
const outPath = resolve(
  process.argv[3] || `tmp/synthetic-${pageCount}p.pdf`,
);

function escapePdfText(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pageContent(pageNum, total) {
  const paragraphs = [];
  paragraphs.push(`Page ${pageNum} of ${total}.`);
  paragraphs.push(
    `This is synthetic Gotcha import test content for page ${pageNum}. ` +
      `It contains enough English words so the importer can extract a readable text layer ` +
      `without OCR. The quick brown fox jumps over the lazy dog near the riverbank at dawn.`,
  );
  for (let i = 1; i <= 8; i++) {
    paragraphs.push(
      `Paragraph ${i} on page ${pageNum}: learners practice vocabulary while reading connected prose. ` +
        `Accurate extraction across many pages matters for long books and course packs. ` +
        `Segment pagination should preserve reading order from the first page to the last page.`,
    );
  }
  return paragraphs.join(' ');
}

const objects = [];
const add = (body) => {
  objects.push(body);
  return objects.length;
};

const catalogId = add(null); // placeholder
const pagesId = add(null);
const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

const pageIds = [];
const contentIds = [];

for (let p = 1; p <= pageCount; p++) {
  const text = pageContent(p, pageCount);
  // Simple word-wrap into PDF text operators (Helvetica ~7pt width heuristic).
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > 90) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const leading = 12;
  const startY = 770;
  const maxLines = Math.min(lines.length, 58);
  let stream = 'BT\n/F1 10 Tf\n14 TL\n50 ' + startY + ' Td\n';
  for (let i = 0; i < maxLines; i++) {
    const t = escapePdfText(lines[i]);
    if (i === 0) stream += `(${t}) Tj\n`;
    else stream += `T* (${t}) Tj\n`;
  }
  stream += 'ET';

  const contentId = add(
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  );
  contentIds.push(contentId);
  const pageId = add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
  );
  pageIds.push(pageId);
  void leading;
}

objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
objects[pagesId - 1] =
  `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;

let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefPos = Buffer.byteLength(pdf, 'utf8');
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += '0000000000 65535 f \n';
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
pdf += `startxref\n${xrefPos}\n%%EOF\n`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, pdf, 'utf8');
console.log(JSON.stringify({ outPath, pageCount, bytes: Buffer.byteLength(pdf, 'utf8') }));
