// QA regressions: BUG-01..04 (practice), BUG-06/07 (payments), BUG-08 (plurals), BUG-10 (API error copy).
import * as assert from 'node:assert/strict';
import { PracticeType } from '@prisma/client';
import { localizeApiError, pluralRu, pluralEn } from '@gotcha/shared';
import { learnerCopyFor } from '@gotcha/shared/learner-copy';
// AiService pulls in jsdom at load time; the service under test only needs it as a DI token.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('node:module');
const origLoad = Module._load;
Module._load = function (req: string, ...rest: unknown[]) {
  if (/ai\.service$|limits\.service$/.test(req)) return { AiService: class {}, LimitsService: class {} };
  return origLoad.call(this, req, ...rest);
};
const { PracticeService } = require('./practice.service');
const { ImportCommerceService } = require('../billing/import-commerce.service');

const Q = (id: string, a: string) => ({ id, correctAnswer: a, explanation: 'x', questionIndex: 0 });
function practice(session: any) {
  const writes: any[] = [];
  const prisma: any = {
    practiceSession: {
      findFirst: async ({ where }: any) => (session && where.userId === session.userId && where.id === session.id ? session : null),
      update: async ({ data }: any) => { writes.push(['session', data]); return { ...session, ...data }; },
      updateMany: async ({ where, data }: any) => { if (session.completedAt !== null || where.completedAt !== null) return { count: 0 }; writes.push(['session', data]); Object.assign(session, data); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ ...session }),
    },
    practiceAnswer: { create: async ({ data }: any) => { writes.push(['answer', data]); return data; } },
  };
  prisma.$transaction = (fn: any) => fn(prisma);
  return { svc: new PracticeService(prisma, {} as any, {} as any), writes };
}
const base = { id: 's1', userId: 'u1', completedAt: null, questionCount: 3, questions: [Q('q1', 'A'), Q('q2', 'B'), Q('q3', 'C')] };

async function main() {
  // BUG-01 duplicates rejected, nothing written
  {
    const { svc, writes } = practice({ ...base });
    await assert.rejects(svc.submitAnswers('u1', 's1', { answers: [{ questionId: 'q1', userAnswer: 'A' }, { questionId: 'q1', userAnswer: 'A' }, { questionId: 'q1', userAnswer: 'A' }] } as any), /Duplicate/);
    assert.equal(writes.length, 0);
  }
  // BUG-01 partial answers: unanswered count as wrong; score ≤ 1
  {
    const { svc } = practice({ ...base });
    const r = await svc.submitAnswers('u1', 's1', { answers: [{ questionId: 'q1', userAnswer: ' a. ' }] } as any);
    assert.equal(r.score, 1 / 3);
  }
  // m7: a second concurrent submit loses with 409 and writes nothing
  {
    const sess = { ...base };
    const { svc, writes } = practice(sess);
    const [a, b] = await Promise.allSettled([
      svc.submitAnswers('u1', 's1', { answers: [{ questionId: 'q1', userAnswer: 'A' }] } as any),
      svc.submitAnswers('u1', 's1', { answers: [{ questionId: 'q1', userAnswer: 'A' }] } as any),
    ]);
    assert.equal([a, b].filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(writes.filter((w) => w[0] === 'answer').length, 1);
  }
  // BUG-03 unknown id: 400, no completion, no answers leaked
  {
    const { svc, writes } = practice({ ...base });
    await assert.rejects(svc.submitAnswers('u1', 's1', { answers: [{ questionId: 'q1', userAnswer: 'A' }, { questionId: 'nope', userAnswer: 'A' }] } as any), /Unknown questionId/);
    assert.equal(writes.length, 0);
  }
  // BUG-02 flashcard / mixed legacy sessions refused before any AI or DB work
  {
    const { svc } = practice(null);
    for (const t of [PracticeType.flashcard, PracticeType.mixed]) {
      await assert.rejects(svc.startSession('u1', { practiceType: t } as any), (e: any) => e.getResponse().code === 'use_daily_practice');
    }
  }
  // BUG-04 other user's / missing session → 404
  {
    const { svc } = practice({ ...base });
    await assert.rejects(svc.getSession('u2', 's1'), (e: any) => e.getStatus() === 404);
    await assert.rejects(svc.getSession('u1', 'missing'), (e: any) => e.getStatus() === 404);
  }

  // BUG-06/07 payments: covered (with the REVIEW-p1 refund flow) in billing/review-p1-payments.test.ts

  // BUG-08 plurals
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 111].map((n) => pluralRu(n, 'слово', 'слова', 'слов')), ['слово', 'слова', 'слов', 'слов', 'слово', 'слова', 'слов', 'слов']);
  assert.equal(pluralEn(1, 'word', 'words'), 'word');
  assert.equal(learnerCopyFor('ru').common.words(1), '1 слово');
  assert.equal(learnerCopyFor('ru').common.words(3), '3 слова');
  assert.equal(learnerCopyFor('en').common.words(1), '1 word');

  // BUG-10 localized API errors
  assert.equal(localizeApiError('ru', { message: 'Invalid or expired email verification token.', status: 400 }), 'Ссылка подтверждения недействительна или устарела.');
  assert.equal(localizeApiError('uz', { message: 'Some new english error', status: 500 }), 'Server xatosi. Keyinroq urinib koʻring.');
  assert.equal(localizeApiError('ru', { message: ['email must be an email'], status: 400 }), 'Проверьте введённые данные.');
  assert.equal(localizeApiError('en', { message: 'Some new english error', status: 400 }), 'Some new english error');
  assert.equal(localizeApiError('ru', { message: 'Invalid credentials', status: 401 }), 'Неверный email или пароль.');

  console.log('qa-bugs: all passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
