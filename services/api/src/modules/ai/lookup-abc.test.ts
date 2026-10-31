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
  console.log('lookup-abc: OK');
})().catch((e) => { console.error(e); process.exit(1); });
