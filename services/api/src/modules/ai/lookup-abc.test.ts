/** Lookup bugs (a) context joining, (b) targetLang is whatever the client sends (UI language), (c) POS-aware gloss. */
import * as assert from 'node:assert/strict';
import { AiService } from './ai.service';
import { clampContext, normalizePartOfSpeech, LOOKUP_SYSTEM_PROMPT } from './lookup-normalize';

function make(reply: Record<string, unknown>) {
  const calls = { chats: [] as any[], upserts: [] as any[] };
  const prisma: any = {
    dbAvailable: true,
    user: { findUnique: async () => ({ aiDisabled: false, aiDisabledBy: null, birthYear: 1990, uiLanguage: 'ru' }) },
    lemmaCache: { findUnique: async () => null, upsert: async (a: any) => { calls.upserts.push(a); return {}; } },
  };
  const svc: any = new AiService(prisma);
  svc.getClient = () => ({ chat: { completions: { create: async (a: any) => { calls.chats.push(a); return { choices: [{ message: { content: JSON.stringify(reply) } }] }; } } } });
  svc.getPlatformAiSettings = async () => ({ enabled: true, lookupModel: 'm', defaultUserQuota: 100 });
  svc.assertAiAvailable = async () => undefined;
  svc.checkQuota = async () => ({ today: new Date(), memoryKey: 'k' });
  svc.incrementUsage = async () => undefined;
  return { svc, calls };
}

(async () => {
  // (a)
  assert.equal(clampContext('She answered without\nany hesi-\ntation and left.'), 'She answered without any hesitation and left.');
  // (c) normaliser + prompt
  assert.equal(normalizePartOfSpeech('Noun'), 'noun');
  assert.equal(normalizePartOfSpeech('adj.'), 'adjective');
  assert.equal(normalizePartOfSpeech('thing'), null);
  assert.match(LOOKUP_SYSTEM_PROMPT, /partOfSpeech/);
  assert.match(LOOKUP_SYSTEM_PROMPT, /"hesitation" → "ikkilanish"/);

  const { svc, calls } = make({ lemma: 'hesitation', partOfSpeech: 'noun', translation: 'ikkilanish', contextualMeaning: 'ikkilanmasdan' });
  const r: any = await svc.lookup('u1', { token: 'hesitation', sentence: 'She answered without\nany hesitation.', sourceLang: 'en', targetLang: 'uz' });
  assert.equal(r.partOfSpeech, 'noun', JSON.stringify(r));
  assert.equal(r.translation, 'ikkilanish');
  const user = calls.chats[0].messages[1].content as string;
  assert.match(user, /SENTENCE: "She answered without any hesitation\."/, '(a) joined context sent to the model');
  // (b) server glosses into the requested targetLang (client sends the UI language), not the profile uiLanguage/native
  assert.match(user, /GLOSS LANGUAGE: .*uz/i);
  assert.equal(calls.upserts[0]?.create?.partOfSpeech, 'noun', 'POS cached');

  const bookId = '11111111-1111-4111-8111-111111111111';
  const rows = new Map<string, any>();
  const bookCalls = { chats: 0 };
  const prisma: any = {
    dbAvailable: true,
    user: { findUnique: async () => ({ aiDisabled: false, aiDisabledBy: null, birthYear: 1990, uiLanguage: 'uz' }) },
    lemmaCache: {
      findUnique: async (q: any) => rows.get(q.where.lemma_sourceLang_targetLang_contentHash.contentHash) ?? null,
      upsert: async (q: any) => { rows.set(q.where.lemma_sourceLang_targetLang_contentHash.contentHash, { lemma: q.create.lemma, translation: q.create.translation, grammarNote: q.create.grammarNote, partOfSpeech: q.create.partOfSpeech }); return {}; },
    },
  };
  const bookSvc: any = new AiService(prisma);
  bookSvc.getClient = () => ({ chat: { completions: { create: async () => { bookCalls.chats += 1; return { choices: [{ message: { content: JSON.stringify({ lemma: 'ship', partOfSpeech: 'noun', translation: 'kema', contextualMeaning: 'dengiz kemasi' }) } }], usage: { prompt_tokens: 10, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 0 } } }; } } } });
  bookSvc.getPlatformAiSettings = async () => ({ enabled: true, lookupModel: 'm', defaultUserQuota: 100 });
  bookSvc.assertAiAvailable = async () => undefined;
  bookSvc.checkQuota = async () => ({ today: new Date(), memoryKey: 'k' });
  bookSvc.incrementUsage = async () => undefined;
  bookSvc.useMemory = () => false;
  const first: any = await bookSvc.lookup('u1', { token: 'ship', sentence: 'The ship sailed.', sourceLang: 'en', targetLang: 'uz', contentId: bookId });
  bookSvc.memoryCache.clear();
  await new Promise((resolve) => setImmediate(resolve));
  const second: any = await bookSvc.lookup('u1', { token: 'ship', sentence: 'Another ship waited.', sourceLang: 'en', targetLang: 'uz', contentId: bookId });
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.translation, 'kema');
  assert.equal(bookCalls.chats, 1, 'second tap in the same book must not call the model');

  const dictCalls = { chats: 0 };
  const dictPrisma: any = {
    dbAvailable: true,
    user: { findUnique: async () => ({ aiDisabled: false, aiDisabledBy: null, birthYear: 1990, uiLanguage: 'uz' }) },
    wordDictionary: {
      findUnique: async () => ({
        lemma: 'ship',
        senses: { uz: [{ meaning: 'kema', pos: 'noun' }, { meaning: 'kemada suzmoq', pos: 'verb' }] },
      }),
    },
    lemmaCache: { findUnique: async () => { throw new Error('cache should not be read'); } },
  };
  const dictSvc: any = new AiService(dictPrisma);
  dictSvc.getClient = () => ({ chat: { completions: { create: async () => { dictCalls.chats += 1; throw new Error('openai'); } } } });
  dictSvc.getPlatformAiSettings = async () => ({ enabled: true, lookupModel: 'm', defaultUserQuota: 100 });
  const dictHit: any = await dictSvc.lookup('u1', { token: 'Ship', sentence: 'The ship sailed.', sourceLang: 'en', targetLang: 'uz', contentId: bookId });
  assert.equal(dictHit.source, 'dictionary');
  assert.equal(dictHit.translation, 'kema');
  assert.equal(dictHit.cached, true);
  assert.equal(dictCalls.chats, 0, 'dictionary hit must not call OpenAI');

  console.log('lookup-abc: OK');
})().catch((e) => { console.error(e); process.exit(1); });
