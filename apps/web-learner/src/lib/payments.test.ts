import * as assert from 'node:assert/strict';
import { PAY_COPY, PAY_OFERTA_URL, PAY_SELLER, cancelScreen, plusOfertaConsent, plusOfertaHref, plusPayGate, plusBullets, plusFill, plusHeadline, plusLead, plusLookupsBullet, plusPaywallVariant, plusReminderKey, plusSmallPrint, slowDownMessage, UI_LANGUAGE_PICKER } from '@gotcha/shared';
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
// pay-copy.json (UI/UX, verbatim PLUS-OFFER §4) snapshot: rendered strings must match exactly in en/uz/ru.
const PAY_COPY_REF = {"en": {"plus.title": "No daily limit on word lookups with Plus.", "plus.b1": "No daily limit on word lookups (20 a day on Free)", "plus.lead": "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.", "plus.successSub": "Plus is active until 31.10.2027. No daily limit on word lookups.", "plus.expSub": "You're on Free again: 20 word lookups a day. Your words, books and progress are all kept.", "plus.bImp": "50% off every paid import", "plus.bQuiz": "200 chapter quizzes a day (10 on Free)", "plus.perMonth": "≈ 16 666 soʻm / month", "lim.free": "You've used today's 20 word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.", "lim.quiz": "You've used today's chapter quizzes. They reset tomorrow.", "lim.title": "Daily limits", "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.", "trust.refundPlus": "Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.", "trust.refund": "Refunds only if a purchase is faulty: you were charged but didn't receive what you paid for, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.", "help.refundA": "Yes, if a purchase is faulty: you were charged but did not get the import, book or Plus, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz (the only channel) within 14 days of payment, with the payment reference; once we accept it, we refund within 10 working days."}, "uz": {"plus.title": "Plus bilan soʻz qidirishda kunlik cheklov yoʻq.", "plus.b1": "Soʻz qidirishda kunlik cheklov yoʻq (bepul tarifda kuniga 20 ta)", "plus.lead": "Bepul tarifda kuniga 20 ta soʻz qidirish bor. Plusʼda soʻz qidirishda kunlik cheklov yoʻq, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.", "plus.successSub": "Plus 31.10.2027 gacha faol. Soʻz qidirishda kunlik cheklov yoʻq.", "plus.expSub": "Yana bepul tarifdasiz: kuniga 20 ta soʻz qidirish. Soʻzlar, kitoblar va natijalar saqlangan.", "plus.bImp": "Har bir pullik importga 50% chegirma", "plus.bQuiz": "Kuniga 200 ta bob testi (bepul tarifda 10 ta)", "plus.perMonth": "≈ 16 666 soʻm / oy", "lim.free": "Bugungi 20 ta soʻz qidirish tugadi. Soʻz qidirishda kunlik cheklov boʻlmasligi uchun Plusʼni oling yoki ertaga qayting.", "lim.quiz": "Bugungi bob testlari tugadi. Ertaga yangilanadi.", "lim.title": "Kunlik limitlar", "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.", "trust.refundPlus": "Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.", "trust.refund": "Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin xarid qilingan narsa berilmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.", "help.refundA": "Ha, agar xarid nosoz boʻlsa: pul yechilgan, lekin import, kitob yoki Plus kelmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga (yagona kanal) toʻlov raqami bilan yozing; murojaat qabul qilingach, 10 ish kuni ichida pulni qaytaramiz."}, "ru": {"plus.title": "С Plus нет дневного лимита на подсказки по словам.", "plus.b1": "Без дневного лимита на подсказки по словам (в бесплатном плане 20 в день)", "plus.lead": "В бесплатном плане 20 подсказок по словам в день. В Plus нет дневного лимита на подсказки по словам, и длинная глава не оборвётся на середине.", "plus.successSub": "Plus активен до 31.10.2027. Без дневного лимита на подсказки по словам.", "plus.expSub": "Вы снова на бесплатном плане: 20 подсказок по словам в день. Слова, книги и прогресс сохранены.", "plus.bImp": "Скидка 50% на каждый платный импорт", "plus.bQuiz": "200 тестов по главам в день (в бесплатном плане 10)", "plus.perMonth": "≈ 16 666 сум / мес.", "lim.free": "Вы использовали 20 подсказок за сегодня. С Plus нет дневного лимита на подсказки по словам. Или возвращайтесь завтра.", "lim.quiz": "Тесты по главам на сегодня закончились. Завтра они обновятся.", "lim.title": "Дневные лимиты", "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.", "trust.refundPlus": "Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.", "trust.refund": "Возврат только при сбое покупки: деньги списаны, а покупка не получена, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.", "help.refundA": "Да, если покупка с ошибкой: деньги списаны, а импорт, книга или Plus не получены, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz (единственный канал) в течение 14 дней после оплаты и укажите номер платежа; после одобрения запроса мы вернём деньги в течение 10 рабочих дней."}} as Record<'en' | 'uz' | 'ru', Record<string, string>>;
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
const SMALL = {"en": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.", "uz": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.", "ru": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней."} as Record<'en' | 'uz' | 'ru', string>;
for (const l of ['en', 'uz', 'ru'] as const) {
  const c = PAY_COPY[l] as Record<string, string>;
  assert.equal(c['plus.small'], SMALL[l], 'plus.small = PLUS-OFFER small print ' + l);
  assert.ok(!('rc.stir' in c), 'no STIR field');
  const all = JSON.stringify(c);
  assert.ok(!/Visa|Mastercard|STIR|LEGAL NAME|unlimited|cheksiz|безлимит/i.test(all), l);
  for (const k of ['trust.refund', 'refund.full', 'help.refundA', 'support.review']) assert.ok(/14/.test(c[k]), l + ' ' + k + ' has the 14-day claim window');
  // PAY2-10: soʻm (U+02BB) everywhere, incl. plus.perMonth (pay-copy.json's ASCII "so'm" reported to UI/UX).
  assert.ok(!/so['‘’ʼ`]m/i.test(JSON.stringify(c)), l + ' soʻm uses U+02BB');
  if (l === 'uz') assert.ok(!/[a-z]'[a-z]/i.test(JSON.stringify(c)), 'uz uses ʻ, not ASCII apostrophes');
}
assert.match(PAY_COPY.en['trust.refund'], /report|Tell us/);
assert.match(PAY_COPY.en['trust.refund'], /within 14 days of payment; approved refunds are returned within 10 working days\.$/);
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
assert.equal(plusHeadline(null, 'ru'), 'С Plus нет дневного лимита на подсказки по словам.');
assert.equal(plusHeadline(null, 'uz'), 'Plus bilan soʻz qidirishda kunlik cheklov yoʻq.');
assert.equal(PAY_COPY.en['plus.title'], plusHeadline(null, 'en'));
assert.equal(plusLookupsBullet(null, 20, 'en'), 'No daily limit on word lookups (20 a day on Free)');
assert.equal(plusLead(null, 20, 'en'), "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.");
assert.equal(plusHeadline(200, 'uz'), 'Plus bilan kuniga 200 ta soʻz qidiring.');
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
assert.match(PAY_COPY.en['trust.refundPlus'], /Plus wasn't delivered/);
assert.match(PAY_COPY.en['trust.refund'], /didn't receive what you paid for/);
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
  en: "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books and imports are paid for separately. Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
  uz: 'Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar va importlar alohida toʻlanadi. Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.',
  ru: 'Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги и импорты оплачиваются отдельно. Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.',
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

// G1: Plus checkout Public Offer tick-box, PM final copy word for word (brackets = the /oferta link).
{
  const full = (l: string) => { const c = plusOfertaConsent(l); return `${c.before}[${c.link}]${c.after}`; };
  assert.equal(full('en'), 'I accept the [Public Offer]. I understand that Plus starts right after payment, does not renew automatically, and is refunded only if the purchase is faulty (for example, charged but not delivered).');
  assert.equal(full('ru'), 'Я принимаю [Публичную оферту]. Я понимаю, что Plus начинает действовать сразу после оплаты, не продлевается автоматически, а деньги возвращаются только при сбое покупки (например, если оплата прошла, а Plus не подключён).');
  assert.equal(full('uz'), '[Ommaviy oferta]ni qabul qilaman. Plus to\u02bblovdan so\u02bbng darhol boshlanishini, avtomatik uzaytirilmasligini va pul faqat xaridda nosozlik bo\u02bblsa (masalan, to\u02bblov o\u02bbtib, Plus ulanmagan bo\u02bblsa) qaytarilishini tushunaman.');
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
