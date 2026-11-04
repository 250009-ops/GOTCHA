/** round-3b WLF-16: prisma/seed.ts cannot run against prod and never overwrites existing rows. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedRefusal } from '../../prisma/seed-guard';

const local = 'postgresql://postgres@127.0.0.1:5432/gotcha_dev';
assert.match(String(seedRefusal({ NODE_ENV: 'production', ALLOW_SEED: '1', DATABASE_URL: local } as any)), /production/);
assert.match(String(seedRefusal({ DATABASE_URL: local } as any)), /ALLOW_SEED/);
assert.match(String(seedRefusal({ ALLOW_SEED: '1', DATABASE_URL: 'postgresql://u:p@db.gotchaa.uz:5432/gotcha' } as any)), /not local/);
assert.match(String(seedRefusal({ ALLOW_SEED: '1', DATABASE_URL: 'postgresql://u:p@10.0.0.5:5432/gotcha' } as any)), /not local/);
assert.equal(seedRefusal({ ALLOW_SEED: '1', DATABASE_URL: local } as any), null);
assert.equal(seedRefusal({ ALLOW_SEED: '1', DATABASE_URL: 'postgresql://postgres@ci-db:5432/gotcha_test' } as any), null);

const root = join(__dirname, '../..');
const seed = readFileSync(join(root, 'prisma/seed.ts'), 'utf8');
assert.ok(seed.indexOf('seedRefusal()') > 0 && seed.indexOf('seedRefusal()') < seed.indexOf('new PrismaClient()'), 'guard runs before the client exists');
assert.match(seed, /upsert\(\{ args, query \}\) \{ return query\(\{ \.\.\.args, update: \{\} \}\)/, 'every upsert is insert-only (no price/plan/admin reset)');
const build = JSON.parse(readFileSync(join(root, 'tsconfig.build.json'), 'utf8'));
assert.ok(build.exclude.includes('prisma/seed.ts') && build.include.every((g: string) => g.startsWith('src/')), 'seed stays out of dist');
console.log('wlf16-seed-guard: OK (prod/no-ALLOW_SEED/remote host refused; upserts insert-only; not in dist)');
