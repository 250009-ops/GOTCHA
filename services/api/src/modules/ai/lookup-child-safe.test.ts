/** WL4-04: minors' lookups use child-safe prompts on EVERY pass, a separate cache, moderated output, fail closed. */
import * as assert from 'node:assert/strict';
import { AiService } from './ai.service';

const year = new Date().getFullYear();
function make(birthYear: number | null, opts: { flagged?: boolean; modDown?: boolean; gloss?: string } = {}) {
  const calls = { chats: [] as any[], mods: 0, cacheKeys: [] as string[] };
  const prisma: any = {
    dbAvailable: true,
    user: { findUnique: async () => ({ aiDisabled: false, aiDisabledBy: null, birthYear, uiLanguage: 'uz' }) },
    lemmaCache: {
      findUnique: async (a: any) => { calls.cacheKeys.push(a.where.lemma_sourceLang_targetLang_contentHash.contentHash); return null; },
      upsert: async () => ({}),
    },
  };
  const svc: any = new AiService(prisma);
  const client = {
    chat: { completions: { create: async (a: any) => { calls.chats.push(a); return { choices: [{ message: { content: JSON.stringify({ lemma: 'run', translation: opts.gloss ?? 'a long explanation of the meaning', contextualMeaning: 'yugurmoq' }) } }] }; } } },
    moderations: { create: async () => { calls.mods++; if (opts.modDown) throw new Error('down'); return { results: [{ flagged: !!opts.flagged }] }; } },
  };
  svc.getClient = () => client;
  svc.getPlatformAiSettings = async () => ({ enabled: true, lookupModel: 'm', defaultUserQuota: 100 });
  svc.assertAiAvailable = async () => undefined;
  svc.checkQuota = async () => ({ today: new Date(), memoryKey: 'k' });
  svc.incrementUsage = async () => undefined;
  return { svc, calls };
}
const dto: any = { token: 'run', sentence: 'They run home.', sourceLang: 'en', targetLang: 'uz' };

(async () => {
  // Teen: every system prompt (incl. strict second gloss) carries the child-safe text; output moderated.
  const teen = make(year - 15);
  await teen.svc.lookup('u1', dto);
  assert.ok(teen.calls.chats.length >= 2, 'strict second pass ran');
  for (const c of teen.calls.chats) assert.match(c.messages[0].content, /child|young|minor/i, 'child-safe on every pass');
  assert.ok(teen.calls.mods >= 1, 'minor lookup output moderated');

  // Adult: no moderation; cache key differs from the teen's for the same lookup.
  const adult = make(year - 30);
  await adult.svc.lookup('u2', dto);
  assert.equal(adult.calls.mods, 0);
  assert.notEqual(adult.calls.cacheKeys[0], teen.calls.cacheKeys[0], 'cache split by age band');

  // Flagged → localized placeholder, no extra fields.
  const flagged = make(year - 10, { flagged: true });
  const r: any = await flagged.svc.lookup('u3', dto);
  assert.ok(JSON.stringify(r).includes('[xavfsizlik uchun yashirildi]'), JSON.stringify(r));
  assert.ok(!JSON.stringify(r).includes('yugurmoq'));

  // Moderation down → 503 fail closed for minors.
  const down = make(year - 15, { modDown: true });
  await assert.rejects(down.svc.lookup('u4', dto), (e: any) => e.getStatus?.() === 503);
  console.log('lookup-child-safe: OK');
})().catch((e) => { console.error(e); process.exit(1); });
