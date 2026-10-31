// final-5 admin guards: dead routes gone (A/B), every page route role-guarded (A16) and matching the nav,
// plan-limit fields wired to /admin/plan-limits (A4/A5), deletion requests + typed confirm (A10/B12).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROUTE_ROLES, canOpen } from '../src/lib/routeRoles.ts';
const rd = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const app = rd('App.tsx');
for (const dead of ['level-tests', 'subscriptions', 'support', 'licenses', 'moderation', 'ingestion'])
  assert.ok(!app.includes(`path="${dead}`), `dead route ${dead} still present`);
const paths = [...app.matchAll(/<Route path="([^"*]+)"/g)].map((m) => m[1]);
for (const p of paths) {
  assert.ok(ROUTE_ROLES[p], `no roles for ${p}`);
  assert.match(app, new RegExp(`path="${p.replace(/[/:]/g, '\\$&')}" element=\\{<RoleRoute roles=\\{ROUTE_ROLES\\['${p.replace(/[/:]/g, '\\$&')}'\\]\\}>`), `${p} not guarded`);
}
const shell = rd('components/AdminShell.tsx');
for (const m of shell.matchAll(/\{ to: '\/([^']*)'.*?roles: \[([^\]]*)\]/g)) {
  if (!m[1]) continue;
  const navRoles = m[2].match(/'(\w+)'/g).map((s) => s.slice(1, -1)).sort();
  const key = m[1] === 'content/user-imports' ? 'content/:directory' : m[1];
  for (const r of navRoles) assert.ok(ROUTE_ROLES[key].includes(r), `nav ${m[1]} shows to ${r} but route forbids`);
}
assert.equal(canOpen('moderator', ROUTE_ROLES.settings), false);
assert.equal(canOpen('analyst', ROUTE_ROLES.reports), false);
assert.equal(canOpen('moderator', ROUTE_ROLES.reports), true);
assert.equal(canOpen(undefined, ROUTE_ROLES.users), false);
const card = rd('components/LookupLimitsCard.tsx');
assert.match(card, /'\/admin\/plan-limits'/); assert.match(card, /freeLookupsPerDay/); assert.match(card, /freeQuizzesPerDay/);
assert.ok(!/'analyst'/.test(card.split('canEditAiLimits')[1].split('}')[0]), 'analyst must not edit limits');
const users = rd('pages/UsersPage.tsx');
assert.match(users, /DeletionRequestsCard/); assert.match(users, /\?confirm=/); assert.match(users, /confirmText\.trim\(\) !== selected\.id/);
assert.match(rd('components/DeletionRequestsCard.tsx'), /\/admin\/users-deletion-requests/);
console.log(`admin-final5: OK (${paths.length} guarded routes, 6 dead routes absent, plan-limits + deletion requests wired)`);
