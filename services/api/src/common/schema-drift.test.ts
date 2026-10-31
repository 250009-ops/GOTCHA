/**
 * WLF-06: schema.prisma must match the migrations (prisma migrate diff is empty). Needs TEST_DATABASE_URL (throwaway);
 * creates and drops its own empty shadow database next to it.
 */
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.TEST_DATABASE_URL;
if (!base) {
  console.log('schema-drift.test: SKIP (no TEST_DATABASE_URL)');
  process.exit(0);
}
const name = `drift_shadow_${Date.now()}`;
const shadow = base.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
const sh = (cmd: string, input?: string) => execSync(cmd, { cwd: __dirname + '/../..', input, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, DATABASE_URL: base } }).toString();
sh(`npx prisma db execute --url "${base}" --stdin`, `CREATE DATABASE "${name}";`);
try {
  const out = sh(`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "${shadow}" --script`);
  assert.ok(!/CREATE|ALTER|DROP/.test(out), 'schema.prisma drifts from migrations:\n' + out);
  console.log('schema-drift.test: ok (migrate diff empty)');
} finally {
  sh(`npx prisma db execute --url "${base}" --stdin`, `DROP DATABASE IF EXISTS "${name}";`);
}
