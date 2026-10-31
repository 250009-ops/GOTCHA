import { readFileSync as r3bRead } from 'node:fs';
import { readFileSync } from 'node:fs';
import * as assert from 'node:assert/strict';
import { PAY_COPY, PAY_OFERTA_URL, PAY_SELLER, cancelScreen, plusOfertaConsent, plusOfertaHref, plusLegalHref, plusPayGate, plusBullets, plusFill, plusHeadline, plusLead, plusLookupsBullet, plusPaywallVariant, plusReminderKey, plusSmallPrint, slowDownMessage, UI_LANGUAGE_PICKER } from '@gotcha/shared';
import { dailyLimitText, isDailyLimitError, isSlowDownError, limitTitle } from './dailyLimit';
import { plusSuccessLine, paymentKindOf, safeOwnReceipt, formatPaymentDate, mergePages, paymentSourceKey, paymentStatusKey, paymentTitle, priceOrNull, safeReceiptUrl, statusTone } from './payments';

assert.equal(priceOrNull(0), null, 'never render 0 soʻm');
assert.equal(priceOrNull(-1), null);
assert.equal(priceOrNull(undefined), null);
assert.match(priceOrNull(500)!, /500 soʻm$/);
assert.equal(statusTone('paid'), 'ok');
assert.equal(statusTone('weird'), 'muted');
assert.equal(paymentTitle({ kind: 'catalog', estimatedPages: 1 }), 'Book purchase');
assert.equal(paymentTitle({ kind: 'import', estimatedPages: 42 }), 'Import · ~42 pages');
assert.equal(safeReceiptUrl('javascript:alert(1)'), null);
assert.equal(safeReceiptUrl('https://ofd.soliq.uz/x'), 'https://ofd.soliq.uz/x');
assert.match(formatPaymentDate('2026-10-31T08:21:00Z'), /13:21/, 'UTC+5');
const a: any = { id: 'a' }, b: any = { id: 'b' };
assert.deepEqual(mergePages([a], [a, b]).map((x) => x.id), ['a', 'b']);
assert.equal(paymentTitle({ kind: 'plus', estimatedPages: 0, plusDays: 365 }), 'Plus pass · 365 days');
assert.equal(paymentTitle({ kind: 'admin_grant', estimatedPages: 0 }), 'Gift from Gotcha');
assert.equal(safeOwnReceipt('/billing/payments/abc-1/receipt'), '/billing/payments/abc-1/receipt');
assert.equal(safeOwnReceipt('https://evil/x'), null);
assert.equal(paymentKindOf({ contentFormat: 'plus_pass:30' }), 'plus');
assert.equal(paymentKindOf({ contentFormat: 'pdf', contentId: 'c1' }), 'catalog');
assert.equal(paymentKindOf({ contentFormat: 'pdf' }), 'import');
// Final spec (264 renders) + 13:57/14:00 decisions
assert.equal(cancelScreen({ status: 'cancelled' }), '06');
assert.equal(cancelScreen({ status: 'reversing' }), '06b');
assert.equal(cancelScreen({ status: 'paid', code: 'refund_requires_support' }), '06c');
// pay-copy.json (UI/UX, verbatim PLUS-OFFER §4) snapshot; refund keys: PM decision A, synced from UI/UX pay-copy.json 17:08 in round-3b (see PAY_COPY_SYNC_R3B): rendered strings must match exactly in en/uz/ru.
const PAY_COPY_REF = {"en": {"plus.title": "No daily limit on word lookups with Plus.", "plus.b1": "No daily limit on word lookups (20 a day on Free)", "plus.lead": "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.", "plus.successSub": "Plus is active until 31.10.2027. No daily limit on word lookups.", "plus.expSub": "You're on Free again: 20 word lookups a day. Your words, books and progress are all kept.", "plus.bImp": "50% off every paid import", "plus.bQuiz": "200 chapter quizzes a day (10 on Free)", "plus.perMonth": "≈ 16 666 soʻm / month", "lim.free": "You've used today's 20 word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.", "lim.quiz": "You've used today's chapter quizzes. They reset tomorrow.", "lim.title": "Daily limits", "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "trust.refundPlus": "If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "trust.refund": "If a purchase is faulty, we fix it first: we re-run the import or unlock the book again. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "help.refundA": "Yes, but we fix it first: we re-run the import, unlock the book again or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz (the only channel) within 14 calendar days of purchase, with your account email, the payment date and what went wrong; approved refunds go back to your card within 10 working days. No refunds for a change of mind or unused Plus days."}, "uz": {"plus.title": "Plus bilan soʻz izohlarida kunlik cheklov yoʻq.", "plus.b1": "Soʻz izohlarida kunlik cheklov yoʻq (bepul tarifda kuniga 20 ta)", "plus.lead": "Bepul tarifda kuniga 20 ta soʻz izohi bor. Plusʼda soʻz izohlarida kunlik cheklov yoʻq, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.", "plus.successSub": "Plus 31.10.2027 gacha faol. Soʻz izohlarida kunlik cheklov yoʻq.", "plus.expSub": "Yana bepul tarifdasiz: kuniga 20 ta soʻz izohi. Soʻzlar, kitoblar va natijalar saqlangan.", "plus.bImp": "Har bir pullik importga 50% chegirma", "plus.bQuiz": "Kuniga 200 ta bob testi (bepul tarifda 10 ta)", "plus.perMonth": "≈ 16 666 soʻm / oy", "lim.free": "Bugungi 20 ta soʻz izohi tugadi. Soʻz izohlarida kunlik cheklov boʻlmasligi uchun Plusʼni oling yoki ertaga qayting.", "lim.quiz": "Bugungi bob testlari tugadi. Ertaga yangilanadi.", "lim.title": "Kunlik limitlar", "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "trust.refundPlus": "Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "trust.refund": "Xaridda muammo boʻlsa, avvalo uni tuzatamiz: importni qayta bajaramiz yoki kitobni qayta ochib beramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "help.refundA": "Ha, lekin avvalo muammoni tuzatamiz: importni qayta bajaramiz, kitobni qayta ochib beramiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga (yagona kanal) yozing; hisobingiz emailini, toʻlov sanasini va nima notoʻgʻri boʻlganini koʻrsating. Maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi. Fikringiz oʻzgargan boʻlsa yoki Plusning foydalanilmagan kunlari uchun pul qaytarilmaydi."}, "ru": {"plus.title": "С Plus нет дневного лимита на пояснения слов.", "plus.b1": "Без дневного лимита на пояснения слов (в бесплатном плане 20 в день)", "plus.lead": "В бесплатном плане 20 пояснений слов в день. В Plus нет дневного лимита на пояснения слов, и длинная глава не оборвётся на середине.", "plus.successSub": "Plus активен до 31.10.2027. Без дневного лимита на пояснения слов.", "plus.expSub": "Вы снова на бесплатном плане: 20 пояснений слов в день. Слова, книги и прогресс сохранены.", "plus.bImp": "Скидка 50% на каждый платный импорт", "plus.bQuiz": "200 тестов по главам в день (в бесплатном плане 10)", "plus.perMonth": "≈ 16 666 сум / мес.", "lim.free": "Вы использовали 20 пояснений слов за сегодня. С Plus нет дневного лимита на пояснения слов. Или возвращайтесь завтра.", "lim.quiz": "Тесты по главам на сегодня закончились. Завтра они обновятся.", "lim.title": "Дневные лимиты", "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.", "trust.refundPlus": "Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.", "trust.refund": "Если с покупкой что-то не так, мы сначала исправим проблему: повторно выполним импорт или снова откроем доступ к книге. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.", "help.refundA": "Да, но сначала мы исправляем проблему: повторно выполним импорт, снова откроем доступ к книге или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz (единственный канал) в течение 14 календарных дней после покупки; укажите email аккаунта, дату платежа и что пошло не так. Одобренный возврат поступит на вашу карту в течение 10 рабочих дней. Деньги не возвращаются, если вы передумали, а также за неиспользованные дни Plus."}} as Record<'en' | 'uz' | 'ru', Record<string, string>>;
for (const l of ['en', 'uz', 'ru'] as const) {
  const n = { plus: 0, free: 20, pct: 50, plusQ: 200, freeQ: 10, perMonth: '16 666', date: '31.10.2027' };
  for (const k of Object.keys(PAY_COPY_REF[l])) assert.equal(plusFill((PAY_COPY[l] as Record<string, string>)[k], n), PAY_COPY_REF[l][k], `${l} ${k} = pay-copy.json`);
  assert.equal(plusSuccessLine(PAY_COPY[l]['plus.successSub'], '2027-10-31T10:00:00Z'), PAY_COPY_REF[l]['plus.successSub'], `${l} 11d success line`);
  assert.equal(dailyLimitText({ kind: 'lookups', plan: 'free', limit: 20, plusLimit: null, resetAt: '2026-10-31T19:00:00Z' }, l, 'Asia/Tashkent').message, PAY_COPY_REF[l]['lim.free']);
  assert.equal(dailyLimitText({ kind: 'quizzes', plan: 'plus', limit: 200, plusLimit: null, resetAt: '2026-10-31T19:00:00Z' }, l, 'Asia/Tashkent').message, PAY_COPY_REF[l]['lim.quiz']);
  assert.equal(limitTitle(l), PAY_COPY_REF[l]['lim.title']);
  assert.equal(plusHeadline(null, l), PAY_COPY_REF[l]['plus.title']);
  assert.equal(plusLookupsBullet(null, 20, l), PAY_COPY_REF[l]['plus.b1']);
  assert.equal(plusLead(null, 20, l), PAY_COPY_REF[l]['plus.lead']);
  assert.ok(!('err.fairUse' in PAY_COPY[l]), 'no Plus lookup limit-hit key');
  assert.ok(!/unlimited|fair[- ]use|cheksiz|безлимит|oqilona|разумного/i.test(JSON.stringify(PAY_COPY[l])), l + ' no unlimited / fair use');
}
assert.equal(plusReminderKey(3), 'plus.rem7'); assert.equal(plusReminderKey(1), 'plus.rem1'); assert.equal(plusReminderKey(0), 'plus.remToday');
assert.equal(PAY_OFERTA_URL, null);
assert.deepEqual(PAY_SELLER, { en: 'the Erkin Tizim team', uz: 'Erkin Tizim jamoasi', ru: 'команда Erkin Tizim' });
assert.equal(PAY_COPY.en['trust.cards'], 'Pay via Atmos · Uzcard · Humo');
const SMALL = {"en": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "uz": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "ru": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней."} as Record<'en' | 'uz' | 'ru', string>;
for (const l of ['en', 'uz', 'ru'] as const) {
  const c = PAY_COPY[l] as Record<string, string>;
  assert.equal(c['plus.small'], SMALL[l], 'plus.small = PLUS-OFFER small print ' + l);
  assert.ok(!('rc.stir' in c), 'no STIR field');
  const all = JSON.stringify(c);
  assert.ok(!/Visa|Mastercard|STIR|LEGAL NAME|unlimited|cheksiz|безлимит/i.test(all), l);
  for (const k of ['trust.refund', 'refund.full', 'help.refundA', 'support.review']) assert.ok(/14/.test(c[k]) && /10/.test(c[k]), l + ' ' + k + ' has the 14-day claim window');
  // PAY2-10: soʻm (U+02BB) everywhere, incl. plus.perMonth (pay-copy.json's ASCII "so'm" reported to UI/UX).
  assert.ok(!/so['‘’ʼ`]m/i.test(JSON.stringify(c)), l + ' soʻm uses U+02BB');
  if (l === 'uz') assert.ok(!/[a-z]'[a-z]/i.test(JSON.stringify(c)), 'uz uses ʻ, not ASCII apostrophes');
}
assert.match(PAY_COPY.en['trust.refund'], /Write to support@gotchaa\.uz/);
assert.match(PAY_COPY.en['trust.refund'], /within 14 calendar days of purchase; approved refunds go back to your card within 10 working days\.$/);
// payments-02 / PAYMENTS §14: paywall 10b numbers come from admin config, never hardcoded.
for (const l of ['en', 'ru', 'uz'] as const) {
  for (const k of ['plus.b1', 'plus.bImp', 'plus.lead', 'plus.successSub', 'plus.expSub', 'plus.perMonth'] as const) {
    assert.ok(!/\b(200|50)\b|50%|16 666/.test(PAY_COPY[l][k]), `${l} ${k} has no hardcoded limit/discount/price`);
  }
}
assert.equal(plusFill(PAY_COPY.en['plus.b1'], { plus: 200, free: 20, pct: 50 }), 'No daily limit on word lookups (20 a day on Free)');
assert.equal(plusFill(PAY_COPY.en['plus.bQuiz'], { plus: 200, free: 20, pct: 50, plusQ: 200, freeQ: 10 }), '200 chapter quizzes a day (10 on Free)');
assert.equal(plusFill(PAY_COPY.uz['plus.bQuiz'], { plus: 200, free: 20, pct: 50, plusQ: 200, freeQ: 10 }), 'Kuniga 200 ta bob testi (bepul tarifda 10 ta)');
assert.equal(plusFill(PAY_COPY.ru['plus.bQuiz'], { plus: 200, free: 20, pct: 50, plusQ: 200, freeQ: 10 }), '200 тестов по главам в день (в бесплатном плане 10)');
assert.equal(plusFill(PAY_COPY.en['plus.lead'], { plus: 200, free: 20, pct: 50 }), "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.");
assert.equal(plusFill(PAY_COPY.en['plus.b1'], { plus: 300, free: 40, pct: 50 }), 'No daily limit on word lookups (40 a day on Free)', 'admin change flows into copy');
assert.equal(plusFill(PAY_COPY.en['plus.bImp'], { plus: 200, free: 50, pct: 50 }), '50% off every paid import');
assert.equal(plusFill(PAY_COPY.uz['plus.bImp'], { plus: 200, free: 50, pct: 50 }), 'Har bir pullik importga 50% chegirma');
assert.deepEqual(plusBullets(0), ['plus.b1', 'plus.b3'], '10: 2 bullets');
assert.deepEqual(plusBullets(50), ['plus.b1', 'plus.bImp', 'plus.b3'], '10b: + import discount');
assert.deepEqual(plusBullets(50, true), ['plus.b1', 'plus.bQuiz', 'plus.bImp', 'plus.b3'], '10c: all 4 (gen_pay.py order)');
assert.deepEqual(plusBullets(0, true), ['plus.b1', 'plus.b3'], 'quiz cap without discount: 10 (quiz bullet only in 10c)');
assert.deepEqual(plusBullets(0, false), ['plus.b1', 'plus.b3'], '10: neither live');
assert.equal(plusPaywallVariant(0, false), '10'); assert.equal(plusPaywallVariant(50, false), '10b'); assert.equal(plusPaywallVariant(50, true), '10c'); assert.equal(plusPaywallVariant(0, true), '10');
for (const [pct, q, v, n] of [[0, false, '10', 2], [50, false, '10b', 3], [0, true, '10', 2], [50, true, '10c', 4]] as const) {
  assert.equal(plusPaywallVariant(pct, q), v); assert.equal(plusBullets(pct, q).length, n);
}
assert.equal(slowDownMessage('en'), "You're looking up words very quickly. Take a short pause and try again in a minute.");
assert.equal(slowDownMessage('uz'), 'So\u02BBzlarni juda tez qidiryapsiz. Biroz kutib, bir daqiqadan so\u02BBng qayta urinib ko\u02BBring.');
assert.equal(slowDownMessage('ru'), 'Вы ищете слова слишком быстро. Подождите немного и попробуйте снова через минуту.');
for (const l of ['en', 'uz', 'ru']) assert.ok(!/unlimited|fair use/i.test(slowDownMessage(l)));
assert.equal(limitTitle('uz'), 'Kunlik limitlar'); assert.equal(limitTitle('ru'), 'Дневные лимиты');
// Headline / bullet / lead: Marketing PLUS-OFFER §4 while Plus lookups have no cap (null), numbers from config.
assert.equal(plusHeadline(null, 'en'), 'No daily limit on word lookups with Plus.');
assert.equal(plusHeadline(null, 'ru'), 'С Plus нет дневного лимита на пояснения слов.');
assert.equal(plusHeadline(null, 'uz'), 'Plus bilan soʻz izohlarida kunlik cheklov yoʻq.');
assert.equal(PAY_COPY.en['plus.title'], plusHeadline(null, 'en'));
assert.equal(plusLookupsBullet(null, 20, 'en'), 'No daily limit on word lookups (20 a day on Free)');
assert.equal(plusLead(null, 20, 'en'), "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.");
assert.equal(plusHeadline(200, 'uz'), 'Plus bilan kuniga 200 ta soʻz izohini oling.');
assert.ok(!/four|четыре|toʻrt/i.test(PAY_COPY.en['plus.title'] + PAY_COPY.ru['plus.title'] + PAY_COPY.uz['plus.title']));
// Daily limit UX: friendly Defaults #4 text + reset time in the user's timezone (Tashkent default); Plus gets no upsell.
{
  const resetAt = '2026-10-31T19:00:00.000Z';
  const free = dailyLimitText({ kind: 'lookups', plan: 'free', limit: 20, plusLimit: null, resetAt }, 'en', 'Asia/Tashkent');
  assert.equal(free.message, "You've used today's 20 word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.");
  assert.equal(free.reset, 'Resets at 00:00 (Tashkent time).'); assert.equal(free.upsell, true);
  // Screen 16: no Plus lookup limit-hit message (dormant hard cap → neutral speed-guard copy, no number, no upsell).
  const plus = dailyLimitText({ kind: 'lookups', plan: 'plus', limit: 200, plusLimit: 200, resetAt }, 'uz', 'Asia/Tashkent');
  assert.equal(plus.message, slowDownMessage('uz')); assert.equal(plus.upsell, false);
  assert.ok(!/Plus|200/.test(plus.message));
  // Free lookups ignore a numeric plusLimit: always the pay-copy.json lim.free text.
  assert.equal(dailyLimitText({ kind: 'lookups', plan: 'free', limit: 20, plusLimit: 200, resetAt }, 'en', 'Asia/Tashkent').message, PAY_COPY_REF.en['lim.free']);
  const quiz = dailyLimitText({ kind: 'quizzes', plan: 'plus', limit: 200, plusLimit: 200, resetAt }, 'ru', 'Asia/Tashkent');
  assert.equal(quiz.message, 'Тесты по главам на сегодня закончились. Завтра они обновятся.'); assert.equal(quiz.reset, 'Обновится в 00:00 (по Ташкенту).');
  assert.equal(dailyLimitText({ kind: 'quizzes', plan: 'free', limit: 10, plusLimit: 200, resetAt }, 'en', 'Europe/Moscow').reset, 'Resets at 22:00 (Europe/Moscow).');
  assert.ok(isSlowDownError(Object.assign(new Error('x'), { code: 'lookup_slow_down' }))); assert.ok(!isSlowDownError(new Error('x')));
  const e = Object.assign(new Error('x'), { dailyLimit: { kind: 'lookups', plan: 'plus', limit: 200, plusLimit: 200, resetAt } });
  assert.ok(isDailyLimitError(e)); assert.ok(!isDailyLimitError(new Error('x')));
}
// Refund sentences: Plus vs generic (import/book), both 14 days + 10 working days.
assert.match(PAY_COPY.en['trust.refundPlus'], /we fix it first or extend Plus by the days you lost\. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim\./); // PM decision A (UI/UX pay-copy.json 17:08)
assert.match(PAY_COPY.en['trust.refund'], /re-run the import or unlock the book again/); // PM decision A
assert.ok(!/Plus/.test(PAY_COPY.en['trust.refund']));
// PAY1-09 localized statuses
for (const s of ['active', 'revoked', 'canceled', 'paid', 'refunded']) for (const l of ['en', 'ru', 'uz'] as const) assert.ok(PAY_COPY[l][paymentStatusKey(s) as 'status.paid'], `${l} ${s}`);
assert.equal(PAY_COPY.uz[paymentStatusKey('active') as 'status.paid'], 'Faol');
assert.equal(paymentStatusKey('weird'), null);
// PAY1-10 uz date
assert.equal(formatPaymentDate('2026-10-30T08:21:00Z', 'uz-UZ'), '30-okt 2026, 13:21');
assert.equal(formatPaymentDate('2026-01-05T20:00:00Z', 'uz'), '6-yan 2026, 01:00', 'Tashkent day rollover');
// PAY1-12 Play source
assert.equal(paymentSourceKey('google_play'), 'history.src.play');
assert.equal(paymentSourceKey(undefined), 'history.src.atmos');
// PAY2-03 (Marketing 15:07): pct = 0 replaces the whole books/imports sentence with the exact approved text.
const SMALL_OFF = {
  en: "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books and imports are paid for separately. If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.",
  uz: "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar va importlar alohida toʻlanadi. Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.",
  ru: "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги и импорты оплачиваются отдельно. Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.",
} as const;
for (const lang of ['en', 'uz', 'ru'] as const) {
  const src = PAY_COPY[lang]['plus.small'];
  assert.equal(src, PAY_COPY_REF[lang]['plus.small'], `${lang} discount-on verbatim source`);
  assert.equal(plusSmallPrint(src, 50), src, `${lang} verbatim when discount live`);
  assert.equal(plusSmallPrint(src, 0), SMALL_OFF[lang], `${lang} exact no-discount small print`);
}
assert.ok(SMALL_OFF.uz.includes('\u02BB'), 'uz uses U+02BB');
// PAY2-06: picker shows Oʻzbekcha with U+02BB (never ASCII ' / U+2018 / U+02BC).
assert.equal(UI_LANGUAGE_PICKER.uz.nativeName, 'O\u02BBzbekcha');
console.log('payments.test: ok');
// PAY2-10: the price formatter and every surface use soʻm with U+02BB.
{
  const { paySom } = await import('@gotcha/shared');
  for (const l of ['en', 'uz'] as const) assert.match(paySom(24990, l), /^24 990 so\u02BBm$/);
  assert.match(paySom(24990, 'ru'), /^24 990 сум$/);
  console.log('PAY2-10 soʻm: ok');
}

// G1: Plus checkout Public Offer tick-box, PM README 'Plus checkout tick-box' word for word (decision A, 16:30) (brackets = the /oferta link).
{
  const R = (() => { const r = readFileSync('/workspace/gotcha-handoff/team/pm/legal/web/README.md', 'utf8'); const sec = r.split('## Plus checkout tick-box')[1].split('\n## ')[0]; return Object.fromEntries([...sec.matchAll(/^- \*\*(en|ru|uz):\*\* (.+)$/gm)].map((m) => [m[1], m[2].trim()])); })() as Record<string, string>;
  assert.equal(plusOfertaConsent('en').text, "I accept the [Public Offer](/oferta) and the [Terms of Use](/terms), and I have read the [Privacy Policy](/privacy). I understand Plus starts right after payment and does not renew automatically. If a purchase is faulty, we fix it or extend Plus; money is returned only for duplicate or failed charges, or if we can't deliver.");
  assert.equal(plusOfertaConsent('en').text, R.en, 'en = README now');
  assert.equal(plusOfertaConsent('ru').text, "Я принимаю [Публичную оферту](/oferta) и [Пользовательское соглашение](/terms) и ознакомился(-ась) с [Политикой конфиденциальности](/privacy). Я понимаю, что Plus начинает действовать сразу после оплаты и не продлевается автоматически. Если с покупкой что-то не так, мы исправим проблему или продлим Plus; деньги возвращаются только при двойном или неудавшемся списании, а также если мы не можем предоставить покупку.");
  assert.equal(plusOfertaConsent('ru').text, R.ru, 'ru = README now');
  assert.equal(plusOfertaConsent('uz').text, "[Ommaviy oferta](/oferta) va [Foydalanish shartlari](/terms)ni qabul qilaman hamda [Maxfiylik siyosati](/privacy) bilan tanishib chiqdim. Plus toʻlovdan soʻng darhol boshlanishini va avtomatik uzaytirilmasligini tushunaman. Xaridda muammo boʻlsa, uni tuzatamiz yoki Plusni uzaytiramiz; pul faqat ikki marta yechilgan yoki muvaffaqiyatsiz toʻlovda yoxud xaridni yetkaza olmasak qaytariladi.");
  assert.equal(plusOfertaConsent('uz').text, R.uz, 'uz = README now');
  for (const l of ['en', 'ru', 'uz']) assert.deepEqual(plusOfertaConsent(l).parts.filter((p) => p.href).map((p) => p.href), ['/oferta', '/terms', '/privacy'], l + ' three links (LG4-20)');
  assert.equal(plusOfertaConsent('uz').parts[0].text, 'Ommaviy oferta');
  assert.equal(plusLegalHref('https://gotchaa.uz/', '/terms', 'ru'), 'https://gotchaa.uz/terms?lang=ru');
  assert.equal(plusOfertaConsent('en').hint, 'Please accept the Public Offer to continue.');
  assert.equal(plusOfertaConsent('ru').hint, 'Чтобы продолжить, примите Публичную оферту.');
  assert.equal(plusOfertaConsent('uz').hint, 'Davom etish uchun Ommaviy ofertani qabul qiling.');
  assert.equal(plusOfertaHref('https://gotchaa.uz/', 'ru'), 'https://gotchaa.uz/oferta?lang=ru');
  assert.equal(plusOfertaHref('https://gotchaa.uz', 'uz'), 'https://gotchaa.uz/oferta?lang=uz');
  // Disabled state: unticked (the default) → Pay disabled + hint; ticked → enabled.
  assert.deepEqual(plusPayGate({ accepted: false, hasPlan: true, loading: false }), { disabled: true, needsOferta: true });
  assert.deepEqual(plusPayGate({ accepted: true, hasPlan: true, loading: false }), { disabled: false, needsOferta: false });
  assert.equal(plusPayGate({ accepted: true, hasPlan: true, loading: true }).disabled, true);
  console.log('oferta checkout copy + gate: ok');
}
{
  // PAY2-08 imp.paidNoResult (UI/UX key, exact copy); r3b: body + imp.refundDue rewritten to Terms §8 (fix first; money back after 10 working days of the claim).
  const S = await import('@gotcha/shared');
  const P = S.PAY_COPY as Record<'en' | 'ru' | 'uz', Record<string, string>>;
  const want = {
    en: ['Payment received, import not finished', "We fix it first: we'll run the import again. If we can't deliver it within 10 working days of your claim, the money goes back to your card within 10 working days. Write to support@gotchaa.uz within 14 calendar days of purchase.", 'Ask for a refund'],
    ru: ['Оплата получена, импорт не завершён', 'Сначала мы исправляем проблему: повторно выполним импорт. Если мы не сможем предоставить его в течение 10 рабочих дней после вашего обращения, деньги поступят на вашу карту в течение 10 рабочих дней. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки.', 'Запросить возврат'],
    uz: ['To\u02BBlov qabul qilindi, import yakunlanmadi', 'Avvalo muammoni tuzatamiz: importni qayta bajaramiz. Agar uni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak, pul 10 ish kuni ichida kartangizga qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing.', 'Pulni qaytarishni so\u02BBrash'],
  } as const;
  for (const l of ['en', 'ru', 'uz'] as const) {
    assert.deepEqual([P[l]['imp.paidNoResult.title'], P[l]['imp.paidNoResult.body'], P[l]['imp.paidNoResult.refund']], [...want[l]]);
    assert.ok(P[l]['imp.refundDue'].length > 0);
  }
  assert.equal(S.refundRequestHref('p-1'), 'mailto:support@gotchaa.uz?subject=Refund%20request%20p-1&body=Payment%20reference%3A%20p-1');
  // Legal terms: uz 'soʻz izohlari', ru 'пояснения слов'; the old terms are gone from pay copy.
  const all = JSON.stringify(P) + [S.plusHeadline(null, 'uz'), S.plusHeadline(null, 'ru'), S.plusHeadline(5, 'uz'), S.plusHeadline(5, 'ru')].join();
  assert.doesNotMatch(all, /so\u02BBz qidir|подсказ/i);
  console.log('PAY2-08 paidNoResult + legal terms: ok');
}

// Round-3b: refund decision A keys + imp.cap.pre.reset synced verbatim from team/uiux/payments/src/pay-copy.json (17:08:41 Tashkent,
// sha256 77dadf054edc6af4abd46fb249d0e7092069c7f97849baefd630d18b98ee012c). plus.small synced too (steering 17:15); support.review is code-only (rewritten to Terms §8 below).
const PAY_COPY_SYNC_R3B: Record<'en' | 'ru' | 'uz', Record<string, string>> = {"en": {"trust.refund": "If a purchase is faulty, we fix it first: we re-run the import or unlock the book again. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "trust.refundPlus": "If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days.", "help.refundA": "Yes, but we fix it first: we re-run the import, unlock the book again or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz (the only channel) within 14 calendar days of purchase, with your account email, the payment date and what went wrong; approved refunds go back to your card within 10 working days. No refunds for a change of mind or unused Plus days.", "imp.cap.pre.reset": "Free pages reset on the 1st of the month, 00:00 Tashkent time.", "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If a purchase is faulty, we fix it first or extend Plus by the days you lost. Money is returned only for a duplicate charge, a failed charge, or a purchase we can't deliver within 10 working days of your claim. Write to support@gotchaa.uz within 14 calendar days of purchase; approved refunds go back to your card within 10 working days."}, "ru": {"trust.refund": "Если с покупкой что-то не так, мы сначала исправим проблему: повторно выполним импорт или снова откроем доступ к книге. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.", "trust.refundPlus": "Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней.", "help.refundA": "Да, но сначала мы исправляем проблему: повторно выполним импорт, снова откроем доступ к книге или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz (единственный канал) в течение 14 календарных дней после покупки; укажите email аккаунта, дату платежа и что пошло не так. Одобренный возврат поступит на вашу карту в течение 10 рабочих дней. Деньги не возвращаются, если вы передумали, а также за неиспользованные дни Plus.", "imp.cap.pre.reset": "Бесплатные страницы обновляются 1-го числа в 00:00 по Ташкенту.", "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если с покупкой что-то не так, мы сначала исправим проблему или продлим Plus на потерянные дни. Деньги возвращаются только при двойном списании, неудавшемся платеже или если мы не можем предоставить покупку в течение 10 рабочих дней после вашего обращения. Напишите на support@gotchaa.uz в течение 14 календарных дней после покупки; одобренный возврат поступит на вашу карту в течение 10 рабочих дней."}, "uz": {"trust.refund": "Xaridda muammo boʻlsa, avvalo uni tuzatamiz: importni qayta bajaramiz yoki kitobni qayta ochib beramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "trust.refundPlus": "Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi.", "help.refundA": "Ha, lekin avvalo muammoni tuzatamiz: importni qayta bajaramiz, kitobni qayta ochib beramiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga (yagona kanal) yozing; hisobingiz emailini, toʻlov sanasini va nima notoʻgʻri boʻlganini koʻrsating. Maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi. Fikringiz oʻzgargan boʻlsa yoki Plusning foydalanilmagan kunlari uchun pul qaytarilmaydi.", "imp.cap.pre.reset": "Bepul sahifalar har oyning 1-kuni soat 00:00 da (Toshkent vaqti) yangilanadi.", "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Xaridda muammo boʻlsa, avvalo uni tuzatamiz yoki Plusʼni yoʻqotilgan kunlarga uzaytiramiz. Pul faqat ikki marta yechilgan toʻlov, muvaffaqiyatsiz toʻlov yoki xaridni murojaatingizdan keyin 10 ish kuni ichida yetkaza olmasak qaytariladi. Xariddan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; maʼqullangan pul 10 ish kuni ichida kartangizga qaytariladi."}};
for (const l of ['en', 'ru', 'uz'] as const) {
  for (const [k, v] of Object.entries(PAY_COPY_SYNC_R3B[l])) assert.equal((PAY_COPY[l] as Record<string, string>)[k], v, `${l} ${k} = pay-copy.json (r3b)`);
  // All limit resets are 00:00 Asia/Tashkent: no 05:00 / UTC reset left in any user-facing pay string.
  for (const [k, v] of Object.entries(PAY_COPY[l] as Record<string, string>)) assert.ok(!/05[:.]00|\b5:00\b|\bUTC\b|GMT/.test(v), `${l} ${k} has no 05:00/UTC reset`);
  assert.match(PAY_COPY[l]['imp.cap.pre.reset'], /00:00/);
}
assert.ok(!/Plus/.test(PAY_COPY.en['trust.refund']), 'trust.refund (imports/books) does not mention Plus');
console.log('payments r3b copy sync: OK');

// Round-3b: --g-on-cta (#ffffff, light AND dark) is the only text/icon colour on the purple CTA fills (#2107aa light / #5550ec dark);
// --g-on-fill stays on the ok/bad fills only. Contrast: #fff on #2107aa 12.53:1, on #5550ec 5.61:1 (dark --g-on-fill #0a0b14 was 3.50:1).
{
  const css = r3bRead('src/styles/payments-tokens.css', 'utf8');
  const blocks = css.split(/\[data-theme=.dark.\]/);
  assert.equal(blocks.length, 2, 'light + dark token blocks');
  for (const b of blocks) assert.match(b, /--g-on-cta:\s*#ffffff;/i, 'on-cta white in light and dark');
  const pay = r3bRead('src/components/payments/index.tsx', 'utf8');
  const plus = r3bRead('src/pages/PlusPage.tsx', 'utf8');
  for (const src of [pay, plus]) for (const line of src.split('\n')) {
    if (/var\(--g-cta\)/.test(line) || /plus-pay/.test(line)) { assert.ok(!/text-white|g-on-fill/.test(line), 'purple fill uses --g-on-cta: ' + line.trim().slice(0, 80)); }
  }
  assert.match(pay, /data-testid="pay-cancel-link"\s+className="[^"]*min-h-\[44px\]/, 'Cancel link >= 44px');
  assert.match(pay, /background: 'var\(--g-bad\)', color: 'var\(--g-on-fill\)'/, 'bad fill uses --g-on-fill');
  assert.match(pay, /<Icon className="w-16 h-16"/, 'result icon 64px (large, >= 3:1 graphic)');
  console.log('payments r3b tokens/targets: OK');
}

// Round-3b: code-only refund keys follow Terms §8 (team/pm/legal/web/terms-*.md): fix first; money back only for a duplicate charge,
// a failed charge, or a purchase not delivered within 10 working days of the claim; claims within 14 calendar days; approved refunds within 10 working days.
for (const l of ['en', 'ru', 'uz'] as const) {
  const c = PAY_COPY[l] as Record<string, string>;
  for (const k of ['support.review', 'refund.full', 'imp.paidNoResult.body', 'plus.small', 'trust.refund', 'trust.refundPlus', 'help.refundA']) {
    assert.ok(/14/.test(c[k]) && /10/.test(c[k]), `${l} ${k}: 14-day claim + 10 working days`);
    assert.ok(/fix it first|we fix it first|сначала|avvalo/i.test(c[k]), `${l} ${k}: fix first`);
  }
  for (const k of ['support.review', 'refund.full', 'plus.small', 'trust.refund', 'trust.refundPlus', 'help.refundA'])
    assert.ok(/duplicate charge|двойном списании|ikki marta yechilgan/.test(c[k]), `${l} ${k}: duplicate/failed/not delivered`);
  assert.ok(/10/.test(c['imp.refundDue']) && /support@gotchaa\.uz/.test(c['imp.refundDue']), `${l} imp.refundDue: not delivered -> card within 10 working days`);
  assert.ok(!/we'll refund you within|вернём деньги в течение 10|pulingizni 10 ish kuni ichida qaytaramiz/.test(c['imp.paidNoResult.body']), `${l} paidNoResult no unconditional refund`);
}
console.log('payments r3b Terms §8 keys: OK');
