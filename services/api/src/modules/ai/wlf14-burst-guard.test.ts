/**
 * round-3b WLF-14 (S3): per-user lookup burst guard 30/min + 300/h (429 lookup_slow_down) for EVERY plan, Plus included
 * (QA: a Plus user made 40 lookups in 57 s, all 200, on final-5). The guard runs before any cache / AI / quota step.
 * The cross-process Postgres variant (lookup_burst_hits) is covered by qa/payments-02-wlive.db.ts.
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AiService } from './ai.service';

const src = readFileSync(join(__dirname, 'ai.service.ts'), 'utf8').replace(/\r/g, '');
const body = src.slice(src.indexOf('  async lookup(userId: string, dto: LookupDto) {'));
assert.match(body.split('\n')[1], /^\s+await this\.burstGuard\(userId\);/, 'lookup() must call the burst guard first');

(async () => {
  const ai = Object.create(AiService.prototype) as any;
  ai.prisma = { platformSetting: { findMany: async () => [] } }; ai.useMemory = () => true; ai.burst = new Map(); ai.burstCfg = null;
  ai.logger = { warn: () => undefined, log: () => undefined };
  const t0 = 2_000_000_000_000;
  // QA repro: 40 lookups in 57 s by one (Plus) user → 30 pass, 10 lookup_slow_down
  const codes: string[] = [];
  for (let i = 0; i < 40; i++) codes.push(await ai.burstGuard('plus-user', t0 + Math.floor((i * 57_000) / 40)).then(() => 'ok', (e: any) => e.getResponse().code));
  assert.equal(codes.filter((c) => c === 'ok').length, 30, codes.join(','));
  assert.ok(codes.slice(30).every((c) => c === 'lookup_slow_down'));
  // hour ceiling: 300 then slow down (one lookup every 2.5 s stays under 30/min)
  let ok = 0; let first = -1;
  for (let i = 0; i < 310; i++) await ai.burstGuard('hour-user', t0 + i * 2_500).then(() => ok++, () => { if (first < 0) first = i; });
  assert.equal(ok, 300); assert.equal(first, 300);
  console.log('wlf14-burst-guard: OK (lookup() guarded first; 40 in 57 s → 30 ok + 10 lookup_slow_down; 300/h ceiling)');
})().catch((e) => { console.error(e); process.exit(1); });
