/**
 * covers-01 integration: admin cover override + revert against a disposable DB (migrated to 0038).
 *   DATABASE_URL=postgresql://t@127.0.0.1:55492/c01 npx ts-node --transpile-only src/modules/admin/cover-mode.pg.test.ts
 */
import * as assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { AdminService } from './admin.service';
import { ContentService } from '../content/content.service';

const prisma = new PrismaClient();
const jpeg = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, n), Buffer.from([0xff, 0xd9])]);
const file = (n: number) => ({ mimetype: 'image/jpeg', size: 70, buffer: jpeg(n), originalname: 'c.jpg' }) as unknown as Express.Multer.File;

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run against a non-local DATABASE_URL');
  const uploads = mkdtempSync(join(tmpdir(), 'covers01-up-'));
  process.env.UPLOADS_DIR = uploads;
  mkdirSync(join(uploads, 'covers'));
  const admin = new AdminService(prisma as never, undefined as never, undefined as never);
  const tag = Date.now().toString(36);
  // A book that pre-dates covers-01: original file on disk + snapshotted original (what 0038 does).
  const legacy = await prisma.contentItem.create({
    data: { slug: `legacy-${tag}`, title: 'Crime and Punishment', language: 'en', contentType: 'book', contentSource: 'public_domain', cefrLevel: 'c1', genre: 'classic' },
  });
  const origKey = `/uploads/covers/${legacy.id}.jpg?v=1`;
  writeFileSync(join(uploads, 'covers', `${legacy.id}.jpg`), jpeg(1));
  await prisma.contentItem.update({ where: { id: legacy.id }, data: { coverImageKey: origKey, originalCoverKey: origKey, coverMode: 'template' } });
  // A brand-new admin book: template automatically.
  const fresh = await prisma.contentItem.create({
    data: { slug: `fresh-${tag}`, title: 'Oʻtkan kunlar', language: 'uz', contentType: 'book', contentSource: 'public_domain', cefrLevel: 'b2' },
  });
  try {
    assert.equal(fresh.coverMode, 'template');
    let d = await admin.getContent(legacy.id);
    assert.equal(d.coverMode, 'template');
    assert.equal(d.coverImageUrl, null);
    assert.equal(d.originalCoverUrl, origKey);

    // Upload override → mode upload, NEW file, original file + key untouched
    const up = await admin.uploadContentCover(legacy.id, file(2));
    assert.equal(up.coverMode, 'upload');
    assert.match(up.coverImageUrl ?? '', new RegExp(`/uploads/covers/${legacy.id}-u\\d+\\.jpg\\?v=\\d+$`));
    assert.deepEqual(readFileSync(join(uploads, 'covers', `${legacy.id}.jpg`)), jpeg(1), 'original file must not be overwritten');
    assert.equal(readdirSync(join(uploads, 'covers')).length, 2);
    let row = await prisma.contentItem.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(row.originalCoverKey, origKey);

    // Use template
    d = (await admin.setContentCoverMode(legacy.id, 'template', null)) as typeof d;
    assert.equal(d.coverMode, 'template');
    assert.equal(d.coverImageUrl, null);
    // Revert to original
    d = (await admin.setContentCoverMode(legacy.id, 'original', null)) as typeof d;
    assert.equal(d.coverImageUrl, origKey);
    // Back to the upload
    d = (await admin.setContentCoverMode(legacy.id, 'upload', null)) as typeof d;
    assert.equal(d.coverImageUrl, up.coverImageUrl);
    // Audit trail
    assert.equal(await prisma.auditLog.count({ where: { entityId: legacy.id, action: 'content.cover_mode' } }), 3);

    // Guards
    await assert.rejects(admin.setContentCoverMode(fresh.id, 'original', null), /no original cover/);
    await assert.rejects(admin.setContentCoverMode(fresh.id, 'upload', null), /Upload a cover image first/);
    await assert.rejects(admin.setContentCoverMode(fresh.id, 'bogus', null), /coverMode must be/);
    // First upload on a never-snapshotted legacy row keeps its old key as the original
    const odd = await prisma.contentItem.create({
      data: { slug: `odd-${tag}`, title: 'Semaver', language: 'tr', contentType: 'story', contentSource: 'public_domain', cefrLevel: 'b2', coverImageKey: '/uploads/covers/old.jpg' },
    });
    await admin.uploadContentCover(odd.id, file(3));
    row = await prisma.contentItem.findUniqueOrThrow({ where: { id: odd.id } });
    assert.equal(row.originalCoverKey, '/uploads/covers/old.jpg');
    await prisma.contentItem.delete({ where: { id: odd.id } });

    // Learner DTO: template ⇒ coverImageUrl null + coverMode, no originalCoverKey leak
    const content = new ContentService(prisma as never, undefined as never);
    await prisma.contentItem.update({ where: { id: legacy.id }, data: { coverMode: 'template', publishStatus: 'published' } });
    const dto = (await content.getById(legacy.id, undefined, true)) as Record<string, unknown>;
    assert.equal(dto.coverMode, 'template');
    assert.equal(dto.coverImageUrl, null);
    assert.equal('originalCoverKey' in dto, false);
    await prisma.contentItem.update({ where: { id: legacy.id }, data: { coverMode: 'original' } });
    const dto2 = (await content.getById(legacy.id, undefined, true)) as Record<string, unknown>;
    assert.equal(dto2.coverImageUrl, origKey);
    console.log('cover-mode pg tests: OK');
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: legacy.id } });
    await prisma.contentItem.deleteMany({ where: { id: { in: [legacy.id, fresh.id] } } });
    await prisma.$disconnect();
    rmSync(uploads, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
