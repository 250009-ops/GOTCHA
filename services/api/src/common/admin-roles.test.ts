/**
 * final-5 A16: every admin endpoint is role-checked on the server. Static: each handler under @Controller('admin') or
 * an 'admin/…' path carries @Roles(...). Runtime: RolesGuard refuses non-admins (401), wrong roles (false) and
 * a missing user; analysts can no longer change AI/plan limits; plan-limits PATCH and hard delete are superadmin/editor only.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from './guards';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const ctrls = walk(join(__dirname, '..')).filter((p) => p.endsWith('.controller.ts'));
let checked = 0;
for (const file of ctrls) {
  const src = readFileSync(file, 'utf8');
  const adminClass = /@Controller\(\s*'admin'\s*\)/.test(src);
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\s*@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?/);
    if (!m) return;
    const path = m[2] ?? '';
    if (!adminClass && !path.startsWith('admin')) return;
    // decorators of this handler: walk down until the method signature
    let j = i, block = '';
    while (j < lines.length && !/^\s*(async\s+)?[a-zA-Z0-9_]+\s*\(/.test(lines[j])) block += lines[j++] + '\n';
    // and upward through stacked decorators
    let k = i - 1;
    while (k >= 0 && /^\s*@/.test(lines[k])) block += lines[k--] + '\n';
    assert.ok(/@Roles\(/.test(block), `${file.split('/src/')[1]}:${i + 1} ${m[1]} '${path}' has no @Roles`);
    checked++;
  });
}
assert.ok(checked > 50, `only ${checked} admin handlers found`);

const admin = readFileSync(join(__dirname, '../modules/admin/admin.controller.ts'), 'utf8');
const rolesOf = (route: string, verb: string) => {
  const i = admin.indexOf(`@${verb}('${route}')`);
  assert.ok(i >= 0, route);
  return admin.slice(i, admin.indexOf('\n', admin.indexOf('@Roles(', i))).match(/@Roles\(([^)]*)\)/)![1];
};
assert.ok(!/analyst/.test(rolesOf('ai-usage/limits', 'Patch')), 'analyst may not change AI limits');
assert.equal(rolesOf('plan-limits', 'Patch').replace(/AdminRole\./g, '').replace(/\s/g, ''), 'superadmin,editor');
assert.equal(rolesOf('users/:id', 'Delete').replace(/AdminRole\./g, '').trim(), 'superadmin');
assert.match(rolesOf('users-deletion-requests', 'Get'), /superadmin.*moderator/);

const ctx = (user: unknown) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
const guard = (roles: string[] | undefined, adminRole: string | null) =>
  new RolesGuard({ getAllAndOverride: () => roles } as never, { adminUser: { findUnique: async () => (adminRole ? { role: adminRole } : null) } } as never);
(async () => {
  assert.equal(await guard(['superadmin'], 'superadmin').canActivate(ctx({ sub: 'u' })), true);
  assert.equal(await guard(['superadmin'], 'moderator').canActivate(ctx({ sub: 'u' })), false);
  assert.equal(await guard(['superadmin', 'moderator'], 'analyst').canActivate(ctx({ sub: 'u' })), false);
  assert.equal(await guard(['superadmin'], 'superadmin').canActivate(ctx(undefined)), false);
  await assert.rejects(() => guard(['superadmin'], null).canActivate(ctx({ sub: 'learner' })), UnauthorizedException);
  console.log(`admin-roles.test: OK (${checked} admin handlers carry @Roles; guard refuses learners/wrong roles)`);
})().catch((e) => { console.error(e); process.exit(1); });
