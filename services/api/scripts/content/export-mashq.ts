/**
 * Pages that still have fewer than 5 active questions. 20 pages per file.
 * Usage: npx ts-node --transpile-only scripts/content/export-mashq.ts <segments.jsonl> [inserted.json]
 * inserted.json is { "<segmentId>": <added count> } from the paid-batch revalidation.
 */
import { createReadStream, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { MASHQ_CHUNK, chunkBy } from '../../src/modules/content/content-gen';
import { readingPassage } from '../../src/modules/ai/quiz-grounding';

const root = resolve(__dirname, '../../../..');
const outDir = resolve(root, 'content-gen/mashq/todo');

type Row = {
  id: string;
  contentId: string;
  lang: string;
  title?: string;
  segmentIndex: number;
  pageIndex: number;
  readers?: number;
  wordCount: number;
  active: number;
  text: string;
};

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('segments jsonl required');
  const inserted = process.argv[3]
    ? JSON.parse(readFileSync(process.argv[3], 'utf8')) as Record<string, number>
    : {};
  const pages: Row[] = [];
  let catalog = 0;
  let short = 0;
  const rl = createInterface({ input: createReadStream(source, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Row;
    catalog += 1;
    const active = Number(row.active ?? 0) + Number(inserted[row.id] ?? 0);
    if (Number(row.wordCount) < 60 || readingPassage(row.text).trim().length < 80) {
      short += 1;
      continue;
    }
    if (active >= 5) continue;
    pages.push(row);
  }

  const byBook = new Map<string, Row[]>();
  for (const page of pages) {
    const list = byBook.get(page.contentId) ?? [];
    list.push(page);
    byBook.set(page.contentId, list);
  }
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(outDir)) {
    if (name.endsWith('.json')) unlinkSync(resolve(outDir, name));
  }
  let files = 0;
  const books = [...byBook.entries()].sort((a, b) => {
    const readers = (b[1][0]?.readers ?? 0) - (a[1][0]?.readers ?? 0);
    if (readers !== 0) return readers;
    return String(a[1][0]?.title ?? '').localeCompare(String(b[1][0]?.title ?? ''));
  });
  books.forEach(([contentId, list], rank) => {
    list.sort((a, b) => a.segmentIndex - b.segmentIndex || a.pageIndex - b.pageIndex);
    chunkBy(list, MASHQ_CHUNK).forEach((chunk, index) => {
      files += 1;
      const name = `${String(rank + 1).padStart(3, '0')}-${contentId}-${String(index + 1).padStart(3, '0')}.json`;
      writeFileSync(resolve(outDir, name), JSON.stringify({
        contentId,
        sourceLang: chunk[0]?.lang ?? '',
        title: chunk[0]?.title ?? '',
        readers: chunk[0]?.readers ?? 0,
        pages: chunk.map((page) => ({
          segmentId: page.id,
          contentId,
          segmentIndex: page.segmentIndex,
          text: readingPassage(page.text).slice(0, 4000),
        })),
      }));
    });
  });
  console.log(JSON.stringify({
    catalogPages: catalog,
    tooShort: short,
    pagesNeedingQuestions: pages.length,
    books: byBook.size,
    files,
    directory: 'content-gen/mashq/todo',
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'export failed');
  process.exit(1);
});
