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
const PAY_COPY_REF = {"en": {"plus.title": "No daily limit on word lookups with Plus.", "plus.b1": "No daily limit on word lookups (20 a day on Free)", "plus.lead": "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.", "plus.successSub": "Plus is active until 31.10.2027. No daily limit on word lookups.", "plus.expSub": "You're on Free again: 20 word lookups a day. Your words, books and progress are all kept.", "plus.bImp": "50% off every paid import", "plus.bQuiz": "200 chapter quizzes a day (10 on Free)", "plus.perMonth": "≈ 16 666 soʻm / month", "lim.free": "You've used today's 20 word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.", "lim.quiz": "You've used today's chapter quizzes. They reset tomorrow.", "lim.title": "Daily limits", "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "trust.refundPlus": "If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "trust.refund": "If an import or book is not delivered or does not work as described, you may choose the remedy: we fix it (we fix or re-run the import, or unlock the book again), we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "help.refundA": "Yes. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem, with your account email, the payment date and what went wrong; this does not shorten any period set by law. We bear any costs of returning a payment. Refunds go to the same card through Atmos within 10 working days of approval. We don't return money for unused days of a pass that works as described, or if you simply change your mind, unless the law requires otherwise."}, "uz": {"plus.title": "Plus bilan soʻz izohlarida kunlik cheklov yoʻq.", "plus.b1": "Soʻz izohlarida kunlik cheklov yoʻq (bepul tarifda kuniga 20 ta)", "plus.lead": "Bepul tarifda kuniga 20 ta soʻz izohi bor. Plusʼda soʻz izohlarida kunlik cheklov yoʻq, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.", "plus.successSub": "Plus 31.10.2027 gacha faol. Soʻz izohlarida kunlik cheklov yoʻq.", "plus.expSub": "Yana bepul tarifdasiz: kuniga 20 ta soʻz izohi. Soʻzlar, kitoblar va natijalar saqlangan.", "plus.bImp": "Har bir pullik importga 50% chegirma", "plus.bQuiz": "Kuniga 200 ta bob testi (bepul tarifda 10 ta)", "plus.perMonth": "≈ 16 666 soʻm / oy", "lim.free": "Bugungi 20 ta soʻz izohi tugadi. Soʻz izohlarida kunlik cheklov boʻlmasligi uchun Plusʼni oling yoki ertaga qayting.", "lim.quiz": "Bugungi bob testlari tugadi. Ertaga yangilanadi.", "lim.title": "Kunlik limitlar", "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "trust.refundPlus": "Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "trust.refund": "Import yoki kitob yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz (importni tuzatamiz yoki qayta bajaramiz, kitobni qayta ochib beramiz), narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "help.refundA": "Ha. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; hisobingiz emailini, toʻlov sanasini va nima notoʻgʻri boʻlganini koʻrsating. Bu qonunda belgilangan muddatlarni qisqartirmaydi. Toʻlovni qaytarish bilan bogʻliq xarajatlarni biz qoplaymiz. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi. Taʼriflanganidek ishlayotgan ruxsatnomaning foydalanilmagan kunlari uchun yoki shunchaki fikringiz oʻzgargan boʻlsa, pul qaytarilmaydi, qonunda boshqacha belgilangan hollar bundan mustasno."}, "ru": {"plus.title": "С Plus нет дневного лимита на пояснения слов.", "plus.b1": "Без дневного лимита на пояснения слов (в бесплатном плане 20 в день)", "plus.lead": "В бесплатном плане 20 пояснений слов в день. В Plus нет дневного лимита на пояснения слов, и длинная глава не оборвётся на середине.", "plus.successSub": "Plus активен до 31.10.2027. Без дневного лимита на пояснения слов.", "plus.expSub": "Вы снова на бесплатном плане: 20 пояснений слов в день. Слова, книги и прогресс сохранены.", "plus.bImp": "Скидка 50% на каждый платный импорт", "plus.bQuiz": "200 тестов по главам в день (в бесплатном плане 10)", "plus.perMonth": "≈ 16 666 сум / мес.", "lim.free": "Вы использовали 20 пояснений слов за сегодня. С Plus нет дневного лимита на пояснения слов. Или возвращайтесь завтра.", "lim.quiz": "Тесты по главам на сегодня закончились. Завтра они обновятся.", "lim.title": "Дневные лимиты", "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.", "trust.refundPlus": "Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.", "trust.refund": "Если импорт или книга не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему (исправим или повторно выполним импорт, снова откроем доступ к книге), снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.", "help.refundA": "Да. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; укажите email аккаунта, дату платежа и что пошло не так. Это не сокращает сроки, установленные законом. Расходы на возврат платежа несём мы. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения. Деньги не возвращаются за неиспользованные дни доступа, который работает так, как описано, или если вы просто передумали, кроме случаев, когда закон требует иного."}} as Record<'en' | 'uz' | 'ru', Record<string, string>>;
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
const SMALL = {"en": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "uz": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "ru": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения."} as Record<'en' | 'uz' | 'ru', string>;
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
assert.match(PAY_COPY.en['trust.refund'], /Please contact support@gotchaa\.uz/);
assert.match(PAY_COPY.en['trust.refund'], /within 14 calendar days of noticing a problem; this does not shorten any period set by law\. Refunds go to the same card through Atmos within 10 working days of approval\.$/);
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
assert.match(PAY_COPY.en['trust.refundPlus'], /you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money\./); // Terms §8 (Kai decision A 17:20)
assert.match(PAY_COPY.en['trust.refund'], /re-run the import, or unlock the book again/); // PM decision A
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
  en: "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books and imports are paid for separately. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.",
  uz: "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar va importlar alohida toʻlanadi. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.",
  ru: "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги и импорты оплачиваются отдельно. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.",
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
  assert.equal(plusOfertaConsent('en').text, "I accept the [Public Offer](/oferta) and the [Terms of Use](/terms), and I have read the [Privacy Policy](/privacy). I understand Plus starts right after payment and does not renew automatically. If a purchase is faulty, I can choose a fix, a price reduction or a refund; duplicate or failed charges are always refunded.");
  assert.equal(plusOfertaConsent('en').text, R.en, 'en = README now');
  assert.equal(plusOfertaConsent('ru').text, "Я принимаю [Публичную оферту](/oferta) и [Пользовательское соглашение](/terms) и ознакомился(-ась) с [Политикой конфиденциальности](/privacy). Я понимаю, что Plus начинает действовать сразу после оплаты и не продлевается автоматически. Если с покупкой что-то не так, я могу выбрать исправление, снижение цены или возврат денег; при двойном или неудавшемся списании деньги возвращаются всегда.");
  assert.equal(plusOfertaConsent('ru').text, R.ru, 'ru = README now');
  assert.equal(plusOfertaConsent('uz').text, "[Ommaviy oferta](/oferta) va [Foydalanish shartlari](/terms)ni qabul qilaman hamda [Maxfiylik siyosati](/privacy) bilan tanishib chiqdim. Plus toʻlovdan soʻng darhol boshlanishini va avtomatik uzaytirilmasligini tushunaman. Xaridda muammo boʻlsa, tuzatish, narxni pasaytirish yoki pulni qaytarishni tanlashim mumkin; ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi.");
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
    en: ['Payment received, import not finished', "We'll try the import again. You may also choose a price reduction, or cancel the purchase and get your money back: write to support@gotchaa.uz. Refunds go to the same card through Atmos within 10 working days of approval.", 'Ask for a refund'],
    ru: ['Оплата получена, импорт не завершён', 'Мы попробуем импортировать снова. Вы также можете выбрать снижение цены или отменить покупку и вернуть деньги: напишите на support@gotchaa.uz. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.', 'Запросить возврат'],
    uz: ['To\u02BBlov qabul qilindi, import yakunlanmadi', 'Importni qayta urinib koʻramiz. Narxni pasaytirishni yoki xaridni bekor qilib, pulni qaytarishni ham tanlashingiz mumkin: support@gotchaa.uz manziliga yozing. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.', 'Pulni qaytarishni so\u02BBrash'],
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
const PAY_COPY_SYNC_R3B: Record<'en' | 'ru' | 'uz', Record<string, string>> = {"en": {"trust.refund": "If an import or book is not delivered or does not work as described, you may choose the remedy: we fix it (we fix or re-run the import, or unlock the book again), we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "trust.refundPlus": "If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.", "help.refundA": "Yes. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem, with your account email, the payment date and what went wrong; this does not shorten any period set by law. We bear any costs of returning a payment. Refunds go to the same card through Atmos within 10 working days of approval. We don't return money for unused days of a pass that works as described, or if you simply change your mind, unless the law requires otherwise.", "imp.cap.pre.reset": "Free pages reset on the 1st of the month, 00:00 Tashkent time.", "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. If an import, book or Plus pass is not delivered or does not work as described, you may choose the remedy: we fix it or extend your Plus pass by the days you lost, we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval."}, "ru": {"trust.refund": "Если импорт или книга не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему (исправим или повторно выполним импорт, снова откроем доступ к книге), снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.", "trust.refundPlus": "Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения.", "help.refundA": "Да. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; укажите email аккаунта, дату платежа и что пошло не так. Это не сокращает сроки, установленные законом. Расходы на возврат платежа несём мы. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения. Деньги не возвращаются за неиспользованные дни доступа, который работает так, как описано, или если вы просто передумали, кроме случаев, когда закон требует иного.", "imp.cap.pre.reset": "Бесплатные страницы обновляются 1-го числа в 00:00 по Ташкенту.", "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Если импорт, книга или доступ Plus не предоставлены или не работают так, как описано, вы сами выбираете способ решения: мы устраняем проблему или продлеваем доступ Plus на потерянные дни, снижаем цену или отменяем покупку и возвращаем деньги. Деньги всегда возвращаются при двойном списании или неудавшемся платеже. Пожалуйста, напишите на support@gotchaa.uz в течение 14 календарных дней после того, как заметили проблему; это не сокращает сроки, установленные законом. Деньги возвращаются на ту же карту через Atmos в течение 10 рабочих дней после одобрения."}, "uz": {"trust.refund": "Import yoki kitob yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz (importni tuzatamiz yoki qayta bajaramiz, kitobni qayta ochib beramiz), narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "trust.refundPlus": "Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi.", "help.refundA": "Ha. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; hisobingiz emailini, toʻlov sanasini va nima notoʻgʻri boʻlganini koʻrsating. Bu qonunda belgilangan muddatlarni qisqartirmaydi. Toʻlovni qaytarish bilan bogʻliq xarajatlarni biz qoplaymiz. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi. Taʼriflanganidek ishlayotgan ruxsatnomaning foydalanilmagan kunlari uchun yoki shunchaki fikringiz oʻzgargan boʻlsa, pul qaytarilmaydi, qonunda boshqacha belgilangan hollar bundan mustasno.", "imp.cap.pre.reset": "Bepul sahifalar har oyning 1-kuni soat 00:00 da (Toshkent vaqti) yangilanadi.", "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Import, kitob yoki Plus ruxsatnomasi yetkazilmagan yoki taʼriflanganidek ishlamasa, yechimni oʻzingiz tanlaysiz: muammoni bartaraf etamiz yoki Plus ruxsatnomangizni yoʻqotilgan kunlar soniga uzaytiramiz, narxni pasaytiramiz yoki xaridni bekor qilib, pulingizni qaytaramiz. Ikki marta yechilgan yoki muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi. Iltimos, muammoni sezganingizdan keyin 14 kalendar kuni ichida support@gotchaa.uz manziliga yozing; bu qonunda belgilangan muddatlarni qisqartirmaydi. Pul maʼqullangan kundan keyin 10 ish kuni ichida Atmos orqali oʻsha kartaga qaytariladi."}};
for (const l of ['en', 'ru', 'uz'] as const) {
  for (const [k, v] of Object.entries(PAY_COPY_SYNC_R3B[l])) if (k === 'imp.cap.pre.reset') assert.equal((PAY_COPY[l] as Record<string, string>)[k], v, `${l} ${k} = pay-copy.json (r3b)`);
  // All limit resets are 00:00 Asia/Tashkent: no 05:00 / UTC reset left in any user-facing pay string.
  for (const [k, v] of Object.entries(PAY_COPY[l] as Record<string, string>)) assert.ok(!/05[:.]00|\b5:00\b|\bUTC\b|GMT/.test(v), `${l} ${k} has no 05:00/UTC reset`);
  assert.match(PAY_COPY[l]['imp.cap.pre.reset'], /00:00/);
}
assert.ok(!/Plus/.test(PAY_COPY.en['trust.refund']), 'trust.refund (imports/books) does not mention Plus'); // refund keys: Terms §8 (17:20), see below
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

// Round-3b final (Kai decision A 17:20, accountant review): the 8 refund keys follow Terms §8 (team/pm/legal/web/terms-*.md, main == pending)
// in en/ru/uz: the buyer chooses the remedy (fix / Plus extension, price reduction, or cancel + refund); duplicate or failed charges are
// always refunded; 14 days is a request that doesn't shorten legal periods; refunds to the same card via Atmos within 10 working days.
// No "fix first only", no chargeback ban, no "must".
{
  const KEYS = ['trust.refund', 'trust.refundPlus', 'help.refundA', 'plus.small', 'support.review', 'refund.full', 'imp.refundDue', 'imp.paidNoResult.body'];
  const RX = {
    en: { choice: /reduce the price|price reduction/, dup: /always return money for a duplicate charge or a failed charge/, claim: /within 14 calendar days of noticing.*does not shorten any period set by law/, ten: /within 10 working days/, bad: /fix it first|Money is returned only|only for a duplicate|chargeback|\bmust\b/i },
    ru: { choice: /сниж\S* цен/, dup: /всегда возвращаются при двойном списании или неудавшемся платеже/, claim: /14 календарных дней после того, как заметили.*не сокращает сроки, установленные законом/, ten: /10 рабочих дней/, bad: /сначала (мы )?исправ|возвращаются только|только при двойном|чарджбэк|запрещ|обязаны/i },
    uz: { choice: /[Nn]arxni pasaytir/, dup: /muvaffaqiyatsiz toʻlov uchun pul har doim qaytariladi/, claim: /14 kalendar kuni.*qonunda belgilangan muddatlarni qisqartirmaydi/, ten: /10 ish kuni/, bad: /avvalo (muammoni|uni) tuzat|Pul faqat|chargeback|taqiqlan|shart$/i },
  } as const;
  for (const l of ['en', 'ru', 'uz'] as const) {
    const c = PAY_COPY[l] as Record<string, string>; const r = RX[l];
    for (const k of KEYS) { assert.ok(r.ten.test(c[k]), `${l} ${k}: 10 working days`); assert.ok(!r.bad.test(c[k]), `${l} ${k}: no fix-first-only / chargeback ban`); assert.ok(r.choice.test(c[k]) || k === 'imp.refundDue' || k === 'support.review', `${l} ${k}: buyer's choice`); }
    for (const k of ['trust.refund', 'trust.refundPlus', 'help.refundA', 'plus.small', 'refund.full', 'support.review']) { assert.ok(r.dup.test(c[k]), `${l} ${k}: dup/failed always refunded`); assert.ok(r.claim.test(c[k]), `${l} ${k}: 14 days is a request`); }
    assert.ok(!/Plus/.test(c['trust.refund']), `${l} trust.refund (imports/books) does not mention Plus`);
  }
  console.log('payments r3b refund keys = Terms §8 (en/ru/uz): OK');
}
