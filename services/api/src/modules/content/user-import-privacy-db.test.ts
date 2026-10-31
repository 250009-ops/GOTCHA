/**
 * final-5 (Kai) privacy + data loss, on a LOCAL migrated DB (TEST_DATABASE_URL; skipped otherwise; never prod):
 *  - a PUBLISHED user import: anonymous and non-owner get 404 on getById + getSegments; progress/quiz cannot be used
 *    to unlock it; the owner still reads it.
 *  - moderation 'dismissed' closes the row and leaves publish state unchanged.
 *  - deleting a purchased catalog book archives it; the buyer keeps reading; the FK refuses a raw delete (RESTRICT).
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ContentService } from './content.service';
import { AdminService } from '../admin/admin.service';
import { ReadingService } from '../reading/reading.service';

(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1|host=\/tmp/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('user-import-privacy-db: SKIP (set TEST_DATABASE_URL to a local DB)'); return;
  }
  const db = new PrismaClient({ datasources: { db: { url } } });
  const t = Date.now();
  const mkUser = (n: string) => db.user.create({ data: { email: `${n}-${t}@test.local`, passwordHash: 'x', birthYear: 1990, nativeLanguage: 'uz' } as any });
  const [owner, other, buyer] = await Promise.all([mkUser('owner'), mkUser('other'), mkUser('buyer')]);
  const mkItem = (slug: string, extra: Record<string, unknown>) => db.contentItem.create({ data: {
    slug: `${slug}-${t}`, title: slug, language: 'en', cefrLevel: 'a2', publishStatus: 'published', publishedAt: new Date(), ...extra,
    segments: { create: [{ segmentIndex: 0, plainText: 'secret text', tokenMap: [], sentenceMap: [], wordCount: 2 }] },
  } as any });
  const imp = await mkItem('imp', { contentType: 'user_import', contentSource: 'user_import', createdById: owner.id });
  const content = Object.create(ContentService.prototype) as any; content.prisma = db; content.useDevContent = () => false;
  try {
    const nf = (p: Promise<unknown>) => assert.rejects(p, (e: any) => e?.status === 404 || /not found/i.test(e?.message));
    await nf(content.getById(imp.id, undefined, false));
    await nf(content.getById(imp.id, other.id, false));
    await nf(content.getSegments(imp.id, 0, 5, undefined, false));
    await nf(content.getSegments(imp.id, 0, 5, other.id, false));
    // progress must not be a back door
    const reading = Object.create(ReadingService.prototype) as any; reading.prisma = db; reading.useMemory = () => false;
    await nf(reading.updateProgress(other.id, imp.id, { progressPct: 1 }));
    await db.readingProgress.create({ data: { userId: other.id, contentId: imp.id } as any }).catch(() => undefined);
    await nf(content.getById(imp.id, other.id, false));
    const mine = await content.getById(imp.id, owner.id, false);
    assert.equal(mine.id, imp.id);
    assert.equal((await content.getSegments(imp.id, 0, 5, owner.id, false)).segments[0].plainText ?? 'ok', 'secret text');

    // moderation dismissed: closes row, keeps publish state (and the import stays private)
    const q = await db.moderationQueue.create({ data: { contentId: imp.id, reason: 'report' } });
    const admin = Object.create(AdminService.prototype) as any; admin.prisma = db;
    const res = await admin.reviewModeration(owner.id, q.id, 'dismissed');
    assert.equal(res.status, 'dismissed');
    assert.equal((await db.contentItem.findUnique({ where: { id: imp.id } }))!.publishStatus, 'published');
    await assert.rejects(() => admin.reviewModeration(owner.id, q.id, 'pending'), /approved, rejected or dismissed/);

    // purchases: archive instead of delete; buyer keeps access; FK RESTRICT
    const book = await mkItem('book', { contentType: 'book', contentSource: 'licensed', isFree: false, priceUsd: 49000 });
    await db.contentPurchase.create({ data: { userId: buyer.id, contentId: book.id, amountUsd: 49000, status: 'completed', provider: 'atmos' } });
    const del = await admin.deleteContent(book.id);
    assert.deepEqual([del.deleted, del.archived], [false, true]);
    assert.equal((await db.contentItem.findUnique({ where: { id: book.id } }))!.publishStatus, 'archived');
    assert.equal((await content.getById(book.id, buyer.id, false)).id, book.id, 'buyer still reads the archived book');
    await nf(content.getById(book.id, other.id, false));
    await assert.rejects(() => db.contentItem.delete({ where: { id: book.id } }), /foreign key|Foreign key|P2003|violates/i);
    assert.equal(await db.contentPurchase.count({ where: { contentId: book.id } }), 1);
    console.log('user-import-privacy-db: OK (published import 404 for anon + non-owner incl. progress back door; owner reads; dismissed keeps state; purchased book archived, buyer reads, FK RESTRICT)');
  } finally {
    await db.contentPurchase.deleteMany({ where: { userId: buyer.id } });
    await db.moderationQueue.deleteMany({ where: { contentId: imp.id } });
    await db.readingProgress.deleteMany({ where: { userId: { in: [owner.id, other.id, buyer.id] } } });
    await db.contentItem.deleteMany({ where: { slug: { endsWith: `-${t}` } } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, other.id, buyer.id] } } });
    await db.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
