import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageTierProblems, assertValidPageTiers } from './page-tiers';
import { AdminService } from '../modules/admin/admin.service';

const PM = [
  { label: '1 - 10 pages', minPages: 1, maxPages: 10, price: 12000 },
  { label: '11 - 50 pages', minPages: 11, maxPages: 50, price: 29000 },
  { label: '51 - 100 pages', minPages: 51, maxPages: 100, price: 49000 },
  { label: '101+ pages', minPages: 101, maxPages: null, price: 79000 },
];
assert.deepEqual(pageTierProblems(PM), [], 'PM table (open-ended last tier) is valid');
assert.deepEqual(pageTierProblems([PM[0]]), []);
// prod-shaped bogus rows
const bogus = [
  { label: '1 - 100 pages', minPages: 1, maxPages: 40, price: 12000 },
  { label: '1 - 100 pages', minPages: 1, maxPages: 100, price: 29000 },
  { label: '901 - 1500 pages', minPages: 901, maxPages: 1500, price: 0 },
];
const pb = pageTierProblems(bogus).join('\n');
for (const m of [/does not match its range/, /overlaps/, /Gap between page 100 and 901/, /above 0/]) assert.match(pb, m);
assert.match(pageTierProblems([PM[0], { ...PM[1], minPages: 12, label: '12 - 50 pages' }]).join(), /Gap/);
assert.match(pageTierProblems([{ ...PM[3], minPages: 1, label: '1+ pages' }, PM[1]]).join(), /Only the last/);
assert.match(pageTierProblems([{ ...PM[0], minPages: 2, label: '2 - 10 pages' }]).join(), /start at page 1/);
assert.match(pageTierProblems([{ ...PM[0], price: -5 }]).join(), /above 0/);
assert.throws(() => assertValidPageTiers(bogus), /INVALID_PAGE_TIERS|match/);

// service wiring: create/update/delete reject an invalid resulting table and never touch prices of other rows
const rows = PM.map((r, i) => ({ id: `t${i}`, label: r.label, minPages: r.minPages, maxPages: r.maxPages, priceUsd: r.price, sortOrder: i + 1, active: true }));
const writes: string[] = [];
const prisma = { importPageTier: {
  findMany: async () => rows, findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null, count: async () => rows.length,
  create: async (a: any) => { writes.push('create'); return { id: 'n', ...a.data }; }, update: async () => { writes.push('update'); }, delete: async () => { writes.push('delete'); },
} };
const svc = Object.create(AdminService.prototype) as any; svc.prisma = prisma;
(async () => {
  await assert.rejects(() => svc.deleteImportPageTier('t1'), /Gap/);
  await assert.rejects(() => svc.updateImportPageTier('t3', { priceUzs: 0 }), /price|0/i);
  await assert.rejects(() => svc.updateImportPageTier('t2', { label: '51 - 99 pages' }), /does not match/);
  await assert.rejects(() => svc.createImportPageTier({ label: '90 - 120 pages', minPages: 90, maxPages: 120, priceUzs: 5000 }), /overlap|Only the last/);
  assert.deepEqual(writes, [], 'nothing written for invalid tables');
  await svc.updateImportPageTier('t0', { label: '1 - 10 pages' });
  assert.ok(writes.includes('update'));
  // 0020 seed: PM table, insert-only when empty, labels valid
  const sql = readFileSync(join(__dirname, '../../prisma/migrations/0020_pricing/migration.sql'), 'utf8');
  assert.match(sql, /WHERE NOT EXISTS \(SELECT 1 FROM "import_page_tiers"\)/);
  assert.match(sql, /\('1 - 10 pages',1,10,12000,1\),\('11 - 50 pages',11,50,29000,2\),\('51 - 100 pages',51,100,49000,3\),\('101\+ pages',101,NULL::int,79000,4\)/);
  assert.ok(!/(DELETE FROM|UPDATE)\s+"import_page_tiers"/i.test(sql), 'seed never deletes or updates live tiers');
  console.log('page-tiers.test: OK (contiguous, no overlap, labels match, price > 0, open-ended last; service rejects invalid; 0020 seed insert-only)');
})().catch((e) => { console.error(e); process.exit(1); });
