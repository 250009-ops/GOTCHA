/**
 * One-off (P3 UI-24): de-hyphenate and unwrap hard line breaks in already-ingested segments.
 * New imports are reflowed at ingest (content-ingest.ts buildSegmentsFromChapters → reflowProse).
 *
 * Dry run (default, read-only — prints what would change):
 *   npx ts-node --transpile-only scripts/backfill-reflow-segments.ts [--content <uuid>]
 * Apply (writes plain_text + re-tokenised token_map / sentence_map / word_count per segment):
 *   npx ts-node --transpile-only scripts/backfill-reflow-segments.ts --apply [--content <uuid>]
 *
 * Segment ids, indexes and pagination are kept, so progress and vocabulary rows still point at the right
 * segment. Known drift (m3 / PS-04): within a changed segment the text gets shorter (removed "-\n" and
 * "\n"), so reading_progress.char_offset resumes slightly *later* than where the reader stopped, by at most
 * the number of removed characters before that offset (typically a few words). Saved-word contexts keep their
 * old sentence text. Accepted for P3; a proportional char_offset rescale is a follow-up if QA flags it.
 * Known heuristic limits (PS-03): a real compound broken at a line end ("well-\nknown") loses its hyphen,
 * and German lines whose continuation starts with a capitalised noun are not unwrapped.
 * A word hyphenated across two segments is left as is. Idempotent: reflowProse is a no-op on reflowed text.
 * Take a DB snapshot before --apply on production.
 */
import { PrismaClient } from '@prisma/client';
import { reflowProse } from '../src/modules/imports/import-text-cleaner';
import { tokenizeText } from '../src/utils/tokenizer';

async function main() {
  const apply = process.argv.includes('--apply');
  const ci = process.argv.indexOf('--content');
  const contentId = ci > 0 ? process.argv[ci + 1] : undefined;
  const prisma = new PrismaClient();
  let scanned = 0;
  let changed = 0;
  let cursor: string | undefined;
  try {
    for (;;) {
      const rows = await prisma.contentSegment.findMany({
        where: contentId ? { contentId } : undefined,
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, contentId: true, segmentIndex: true, plainText: true },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      for (const r of rows) {
        scanned++;
        const next = reflowProse(r.plainText).trim();
        if (next === r.plainText.trim()) continue;
        changed++;
        if (!apply) {
          if (changed <= 20) console.log(`would update ${r.contentId}#${r.segmentIndex} (${r.plainText.length} → ${next.length} chars)`);
          continue;
        }
        const { tokenMap, sentenceMap, wordCount } = tokenizeText(next);
        await prisma.contentSegment.update({
          where: { id: r.id },
          data: { plainText: next, tokenMap: tokenMap as never, sentenceMap: sentenceMap as never, wordCount },
        });
      }
    }
    console.log(`${apply ? 'updated' : 'would update'} ${changed} of ${scanned} segments`);
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => { console.error(e); process.exit(1); });
