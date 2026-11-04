/**
 * W-28 / S4: re-split chapters of EXISTING catalog content with the fixed splitter + cleanup.
 *
 *   npx ts-node --transpile-only src/scripts/resplit-chapters.ts --title "Strangers on a Train"          # dry-run (default)
 *   npx ts-node --transpile-only src/scripts/resplit-chapters.ts --id <uuid> --backup-dir <dir> --apply  # pg_dump, then one transaction
 *
 * Safety:
 *  - Dry-run unless --apply. Dry-run never writes.
 *  - NEVER run against production. Refuses any DATABASE_URL host that is not localhost/127.0.0.1/::1/a unix
 *    socket, unless --allow-host <host> names it exactly; gotchaa.uz hosts are refused even then.
 *  - --apply first runs pg_dump (data of content_items, content_segments and every table that references a
 *    segment) into --backup-dir and aborts if the dump fails.
 *  - Reading progress / sessions / vocabulary / practice rows that point at an old page are moved to the new
 *    page covering the same text position, so nothing is deleted or orphaned.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { splitAccurateChapters } from '../modules/imports/chapter-split';
import { cleanImportPlainText } from '../modules/imports/import-text-cleaner';
import { buildSegmentsFromChapters } from '../modules/admin/content-ingest';

type Args = { ids: string[]; titles: string[]; apply: boolean; backupDir?: string; allowHost?: string };

export function parseArgs(argv: string[]): Args {
  const a: Args = { ids: [], titles: [], apply: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--apply') a.apply = true;
    else if (k === '--dry-run') a.apply = false;
    else if (k === '--id') a.ids.push(argv[++i]);
    else if (k === '--title') a.titles.push(argv[++i]);
    else if (k === '--backup-dir') a.backupDir = argv[++i];
    else if (k === '--allow-host') a.allowHost = argv[++i];
    else throw new Error(`Unknown arg ${k}`);
  }
  if (!a.ids.length && !a.titles.length) throw new Error('Pass --id <uuid> or --title <exact title>');
  if (a.apply && !a.backupDir) throw new Error('--apply needs --backup-dir');
  return a;
}

/** Throws unless the DB is local (or explicitly allowed and not production). */
export function assertNotProd(databaseUrl: string | undefined, allowHost?: string): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const u = new URL(databaseUrl);
  const host = (u.searchParams.get('host') || u.hostname || '').replace(/^\[|\]$/g, '');
  if (/gotchaa\.uz$/i.test(host) || /prod/i.test(host) || /prod/i.test(u.pathname)) throw new Error(`Refusing production-looking DB host/name: ${host}${u.pathname}`);
  const local = ['localhost', '127.0.0.1', '::1'].includes(host) || host.startsWith('/');
  if (!local && host !== allowHost) throw new Error(`Refusing non-local DB host ${host} (use --allow-host ${host} for a staging server; never prod)`);
  return host;
}

/** Map an old page (by its start offset in the book) to the new page containing that offset. */
export function remapByOffset(oldLens: number[], newLens: number[]): number[] {
  const oldTotal = oldLens.reduce((s, n) => s + n, 0) || 1;
  const newTotal = newLens.reduce((s, n) => s + n, 0) || 1;
  const newStarts: number[] = [];
  let acc = 0;
  for (const n of newLens) { newStarts.push(acc); acc += n; }
  let pos = 0;
  return oldLens.map((n) => {
    const target = (pos / oldTotal) * newTotal;
    pos += n;
    let j = 0;
    while (j + 1 < newStarts.length && newStarts[j + 1] <= target) j++;
    return j;
  });
}

const SEGMENT_REFS: Array<{ table: string; column: string }> = [
  { table: 'reading_progress', column: 'segment_id' },
  { table: 'reading_sessions', column: 'segment_id' },
  { table: 'user_vocabulary', column: 'context_segment_id' },
  { table: 'practice_sessions', column: 'segment_id' },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = assertNotProd(process.env.DATABASE_URL, args.allowHost);
  const prisma = new PrismaClient();
  try {
    const items = await prisma.contentItem.findMany({
      where: { OR: [{ id: { in: args.ids } }, { title: { in: args.titles } }] },
      select: { id: true, title: true, contentType: true, contentSource: true },
    });
    if (!items.length) throw new Error('No matching content items');
    console.log(`DB host ${host} · ${args.apply ? 'APPLY' : 'DRY-RUN (no writes)'}`);

    if (args.apply) {
      fs.mkdirSync(args.backupDir!, { recursive: true });
      const file = path.join(args.backupDir!, `resplit-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
      const tables = ['content_items', 'content_segments', ...SEGMENT_REFS.map((r) => r.table)];
      const u = new URL(process.env.DATABASE_URL!);
      const env = { ...process.env, PGPASSWORD: decodeURIComponent(u.password) || process.env.PGPASSWORD };
      const conn = ['-h', u.searchParams.get('host') || u.hostname, '-p', u.port || u.searchParams.get('port') || '5432',
        '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1)];
      execFileSync('pg_dump', ['--data-only', '--disable-triggers', ...tables.flatMap((t) => ['-t', t]), '-f', file, ...conn], { stdio: 'inherit', env });
      if (!fs.statSync(file).size) throw new Error('Backup is empty, aborting');
      console.log(`Backup: ${file}`);
    }

    for (const item of items) {
      if (item.contentSource === 'user_import' || item.contentType === 'user_import') {
        console.log(`skip ${item.title}: learner import`);
        continue;
      }
      const old = await prisma.contentSegment.findMany({
        where: { contentId: item.id },
        orderBy: { segmentIndex: 'asc' },
        select: { id: true, chapterIndex: true, plainText: true },
      });
      const oldChapters = new Set(old.map((s) => s.chapterIndex)).size;
      const text = cleanImportPlainText(old.map((s) => s.plainText).join('\n\n'));
      const chapters = splitAccurateChapters(text, item.title);
      const segs = buildSegmentsFromChapters(chapters, 'literary');
      const newChapters = new Set(segs.map((s) => s.chapterIndex)).size;
      const map = remapByOffset(old.map((s) => s.plainText.length), segs.map((s) => s.plainText.length));
      const refs: Record<string, number> = {};
      for (const r of SEGMENT_REFS) {
        const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*)::bigint AS n FROM ${r.table} WHERE ${r.column} = ANY($1::uuid[])`, old.map((s) => s.id));
        refs[r.table] = Number(rows[0].n);
      }
      console.log(`${item.title} (${item.id}): chapters ${oldChapters} → ${newChapters}, pages ${old.length} → ${segs.length}; refs ${JSON.stringify(refs)}`);
      if (newChapters <= oldChapters) console.log('  (would skip on --apply: not more chapters)');
      console.log(`  titles: ${chapters.slice(0, 6).map((c) => c.title).join(' | ')}${chapters.length > 6 ? ' …' : ''}`);
      if (!args.apply) continue;
      // Idempotent: page text has no headings once split (titles live in chapter_title), so a re-run finds
      // fewer chapters — never replace a split with one that has the same or fewer chapters.
      if (newChapters <= oldChapters) { console.log('  skip: new split has no more chapters than the current one'); continue; }

      await prisma.$transaction(async (tx) => {
        // Park old pages at negative indexes so the new ones can take 0…n-1 under @@unique(contentId, segmentIndex).
        await tx.$executeRawUnsafe(`UPDATE content_segments SET segment_index = -1 - segment_index WHERE content_id = $1::uuid`, item.id);
        const created: string[] = [];
        for (const s of segs) {
          const row = await tx.contentSegment.create({
            data: { contentId: item.id, segmentIndex: s.segmentIndex, chapterIndex: s.chapterIndex, chapterTitle: s.chapterTitle,
              pageIndex: s.pageIndex, title: s.title, plainText: s.plainText, tokenMap: s.tokenMap as never,
              sentenceMap: s.sentenceMap as never, wordCount: s.wordCount },
            select: { id: true },
          });
          created.push(row.id);
        }
        for (let i = 0; i < old.length; i++) {
          for (const r of SEGMENT_REFS) {
            await tx.$executeRawUnsafe(`UPDATE ${r.table} SET ${r.column} = $1::uuid WHERE ${r.column} = $2::uuid`, created[map[i]], old[i].id);
          }
        }
        await tx.$executeRawUnsafe(`UPDATE content_segments SET parent_segment_id = NULL WHERE content_id = $1::uuid AND segment_index < 0`, item.id);
        await tx.contentSegment.deleteMany({ where: { contentId: item.id, segmentIndex: { lt: 0 } } });
      }, { timeout: 120_000 });
      console.log('  applied');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
