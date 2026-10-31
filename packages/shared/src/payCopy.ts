/** pay.* copy (uz/ru/en). Base: team/uiux/payments/src/pay-copy.json (UI/UX); extra keys: error codes, refund, Plus. Generated, keep in sync. */
export type PayLang = 'en' | 'ru' | 'uz';
export type PayKey =
  | 'cancel.confirmQ'
  | 'cancel.cta'
  | 'cancel.keep'
  | 'cancel.reversed'
  | 'cancel.sub'
  | 'cancel.title'
  | 'cancel.yes'
  | 'card.continue'
  | 'card.detected'
  | 'card.detectedHumo'
  | 'card.expErr'
  | 'card.expiry'
  | 'card.handoff'
  | 'card.localOnly'
  | 'card.noCvv'
  | 'card.number'
  | 'card.ok'
  | 'card.title'
  | 'choose.bookSub'
  | 'choose.bookTitle'
  | 'choose.pages'
  | 'choose.plusNote'
  | 'choose.selected'
  | 'choose.sub'
  | 'choose.tierTitle'
  | 'choose.title'
  | 'choose.yourFile'
  | 'common.placeholder'
  | 'common.som'
  | 'err.amount'
  | 'err.card'
  | 'err.cardExpired'
  | 'err.cardFormat'
  | 'err.cardInvalid'
  | 'err.expired'
  | 'err.funds'
  | 'err.gateway'
  | 'err.generic'
  | 'err.notPriced'
  | 'err.otp'
  | 'err.otpAttempts'
  | 'err.otpExpired'
  | 'err.plusUnavailable'
  | 'err.plusViaPlay'
  | 'err.provider'
  | 'fail.cta'
  | 'fail.kept'
  | 'fail.noCharge'
  | 'fail.other'
  | 'fail.title'
  | 'help.refundA'
  | 'lim.free'
  | 'lim.quiz'
  | 'lim.title'
  | 'help.refundQ'
  | 'history.amount'
  | 'history.book'
  | 'history.date'
  | 'history.empty'
  | 'history.fiscal'
  | 'history.grant'
  | 'history.import'
  | 'history.item'
  | 'history.more'
  | 'history.ofd'
  | 'history.ourReceipt'
  | 'history.plus'
  | 'history.receipt'
  | 'history.reversing'
  | 'history.src.admin'
  | 'history.src.atmos'
  | 'history.src.play'
  | 'history.status'
  | 'history.sub'
  | 'history.title'
  | 'oferta'
  | 'otp.code'
  | 'otp.confirm'
  | 'otp.label'
  | 'otp.resend'
  | 'otp.resendIn'
  | 'otp.sentTo'
  | 'otp.sub'
  | 'otp.title'
  | 'pay.amount'
  | 'pc.cta'
  | 'pc.sub'
  | 'pc.title'
  | 'pending.check'
  | 'pending.ref'
  | 'pending.s1'
  | 'pending.s2'
  | 'pending.s3'
  | 'pending.slow'
  | 'pending.sub'
  | 'pending.title'
  | 'plus.active'
  | 'plus.b1'
  | 'plus.b2'
  | 'plus.b3'
  | 'plus.bImp'
  | 'plus.bQuiz'
  | 'plus.cta'
  | 'plus.ctaShort'
  | 'plus.expCta'
  | 'plus.expSub'
  | 'plus.expTitle'
  | 'plus.extAdd'
  | 'plus.extLeft'
  | 'plus.extNew'
  | 'plus.extNote'
  | 'plus.extTitle'
  | 'plus.item30'
  | 'plus.item365'
  | 'plus.later'
  | 'plus.lead'
  | 'plus.noRenew'
  | 'plus.o30'
  | 'plus.o365'
  | 'plus.perMonth'
  | 'plus.rem1'
  | 'plus.rem7'
  | 'plus.remCta'
  | 'plus.remSub'
  | 'plus.remToday'
  | 'plus.save'
  | 'plus.small'
  | 'plus.stActive'
  | 'plus.stExtend'
  | 'plus.stLeft'
  | 'plus.stPlay'
  | 'plus.stSource'
  | 'plus.stTitle'
  | 'plus.sub'
  | 'plus.success'
  | 'plus.successSub'
  | 'plus.title'
  | 'plus.until'
  | 'rc.back'
  | 'rc.date'
  | 'rc.download'
  | 'rc.fiscal'
  | 'rc.item'
  | 'rc.method'
  | 'rc.no'
  | 'rc.seller'
  | 'rc.status'
  | 'rc.title'
  | 'refund.full'
  | 'rev.stuck'
  | 'rev.sub'
  | 'rev.title'
  | 'rev.track'
  | 'startAgain'
  | 'status.expired'
  | 'status.failed'
  | 'status.paid'
  | 'status.pending'
  | 'status.refunded'
  | 'success.cta'
  | 'success.receipt'
  | 'success.sub'
  | 'success.title'
  | 'summary.apply'
  | 'summary.cancel'
  | 'summary.detail'
  | 'summary.item'
  | 'summary.pay'
  | 'summary.promo'
  | 'summary.show'
  | 'summary.title'
  | 'summary.total'
  | 'support.review'
  | 'trust.cards'
  | 'trust.refund'
  | 'trust.refundPlus'
  | 'imp.freeRetry'
  | 'imp.retryUsing'
  | 'imp.refundDue'
  | 'status.active'
  | 'status.revoked'
  | 'status.canceled'
  | 'status.unknown'
  | 'trust.secure'
  | 'trust.support';
export const PAY_COPY: Record<PayLang, Record<PayKey, string>> = {
  "en": {
    "cancel.confirmQ": "Cancel this payment?",
    "cancel.cta": "Back to import",
    "cancel.keep": "Keep paying",
    "cancel.reversed": "Any charge will be reversed automatically. Your bank may take a few days to release it.",
    "cancel.sub": "You cancelled the payment. Nothing was charged.",
    "cancel.title": "Payment cancelled",
    "cancel.yes": "Yes, cancel",
    "card.continue": "Send SMS code",
    "card.detected": "Uzcard",
    "card.detectedHumo": "Humo",
    "card.expErr": "Check the month: use MM/YY",
    "card.expiry": "Expiry (MM/YY)",
    "card.handoff": "Atmos will send a code to the phone linked to your card.",
    "card.localOnly": "Uzcard and Humo cards. No CVV needed.",
    "card.noCvv": "Uzcard and Humo need no CVV, only the number and expiry.",
    "card.number": "Card number",
    "card.ok": "Card number looks right",
    "card.title": "Card details",
    "choose.bookSub": "Pay once to unlock this book in your library.",
    "choose.bookTitle": "Unlock a book",
    "choose.pages": "pages",
    "choose.plusNote": "Plus subscription is not sold on the web yet.",
    "choose.selected": "Your price",
    "choose.sub": "Your free imports for this month are used up. This file is priced by its page count.",
    "choose.tierTitle": "Price by page count",
    "choose.title": "Pay for an import",
    "choose.yourFile": "Your file",
    "common.placeholder": "PLACEHOLDER",
    "common.som": "soʻm",
    "err.amount": "This payment can’t be processed. Please write to support@gotchaa.uz.",
    "err.card": "Card verification failed. Please check your card details and try again.",
    "err.cardExpired": "This card has expired. Use a different card.",
    "err.cardFormat": "Enter a 16–19 digit card number and expiry as MM/YY.",
    "err.cardInvalid": "Card details look wrong. Check the number and expiry.",
    "err.expired": "This payment session has expired. Go back and start checkout again.",
    "lim.free": "You've used today's {free} word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.",
    "lim.quiz": "You've used today's chapter quizzes. They reset tomorrow.",
    "lim.title": "Daily limits",
    "err.funds": "Not enough money on the card. Top up or use a different card.",
    "err.gateway": "Card payments are unavailable right now. Please try later.",
    "err.generic": "Something went wrong. Please try again.",
    "err.notPriced": "This length is not priced yet. Try a shorter file or write to support@gotchaa.uz.",
    "err.otp": "Incorrect SMS code. Please check the code and try again.",
    "err.otpAttempts": "Too many wrong codes. Start the payment again.",
    "err.otpExpired": "The SMS code has expired. Tap “Resend code”.",
    "err.plusUnavailable": "Plus is not sold on the web yet.",
    "err.plusViaPlay": "Your Plus is managed in Google Play.",
    "err.provider": "The payment service had a problem. Nothing was charged. Try again or write to support@gotchaa.uz.",
    "fail.cta": "Try again",
    "fail.kept": "Your card number is kept. Fix it or try another card.",
    "fail.noCharge": "No money was taken. If you see a hold on your card, it will be released by your bank.",
    "fail.other": "Use a different card",
    "fail.title": "Payment failed",
    "help.refundA": "Yes, if a purchase is faulty: you were charged but did not get the import, book or Plus, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz (the only channel) within 14 days of payment, with the payment reference; once we accept it, we refund within 10 working days.",
    "help.refundQ": "Can I get a refund?",
    "history.amount": "Amount",
    "history.book": "Book",
    "history.date": "Date",
    "history.empty": "No payments yet",
    "history.fiscal": "Fiscal receipt",
    "history.grant": "Gift from Gotcha",
    "history.import": "Import",
    "history.item": "Item",
    "history.more": "Load more",
    "history.ofd": "Fiscal receipt (soliq.uz)",
    "history.ourReceipt": "Receipt",
    "history.plus": "Plus pass",
    "history.receipt": "Receipt",
    "history.reversing": "Reversing",
    "history.src.admin": "Gift from Gotcha",
    "history.src.atmos": "Card · Atmos",
    "history.src.play": "Google Play",
    "history.status": "Status",
    "history.sub": "Your purchases and receipts.",
    "imp.freeRetry": "An import you paid for didn't finish. Try it again: it's free, you won't be charged twice.",
    "imp.retryUsing": "Using your earlier payment: no new charge.",
    "imp.refundDue": "An import you paid for kept failing. We'll refund it: no need to do anything. Questions: support@gotchaa.uz.",
    "history.title": "Payments",
    "oferta": "Public offer (oferta)",
    "otp.code": "SMS code",
    "otp.confirm": "Confirm payment",
    "otp.label": "Confirmation code from SMS",
    "otp.resend": "Resend code",
    "otp.resendIn": "Resend in 0:24",
    "otp.sentTo": "The code was sent to the phone linked to your card •••• 9012.",
    "otp.sub": "We sent a code to the phone linked to card •••• 2829.",
    "otp.title": "Enter SMS code",
    "pay.amount": "Pay",
    "pc.cta": "Write to support@gotchaa.uz",
    "pc.sub": "A paid purchase can't be cancelled here.",
    "pc.title": "This payment is already complete",
    "pending.check": "Check again",
    "pending.ref": "Reference",
    "pending.s1": "Card checked",
    "pending.s2": "SMS code confirmed",
    "pending.s3": "Waiting for the bank",
    "pending.slow": "Taking longer than usual. You can leave this page: your import starts as soon as the payment is confirmed, and you'll get a notification.",
    "pending.sub": "Atmos has accepted the code. We're waiting for the bank's confirmation. This usually takes a few seconds.",
    "pending.title": "Confirming your payment",
    "plus.active": "Plus is active until {date}",
    "plus.b1": "No daily limit on word lookups ({free} a day on Free)",
    "plus.b2": "50% off every paid import",
    "plus.b3": "Everything in Free stays included",
    "plus.bImp": "{pct}% off every paid import",
    "plus.bQuiz": "{plusQ} chapter quizzes a day ({freeQ} on Free)",
    "plus.cta": "Get Plus",
    "plus.ctaShort": "Continue",
    "plus.expCta": "Get Plus again",
    "plus.expSub": "You're on Free again: {free} word lookups a day. Your words, books and progress are all kept.",
    "plus.expTitle": "Your Plus has ended",
    "plus.extAdd": "You add",
    "plus.extLeft": "Remaining now",
    "plus.extNew": "New end date",
    "plus.extNote": "New days are added after your current days. You lose nothing.",
    "plus.extTitle": "Extend Plus",
    "plus.item30": "Gotcha Plus · 30 days",
    "plus.item365": "Gotcha Plus · 365 days",
    "plus.later": "Later",
    "plus.lead": "Free gives you {free} word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.",
    "plus.noRenew": "One-time payment. No auto-renew: when the pass ends, you go back to Free.",
    "plus.o30": "30 days",
    "plus.o365": "365 days",
    "plus.perMonth": "≈ {perMonth} so'm / month",
    "plus.rem1": "Plus ends tomorrow",
    "plus.rem7": "Plus ends in 3 days",
    "plus.remCta": "Extend Plus",
    "plus.remSub": "After that you go back to Free. Nothing is charged automatically.",
    "plus.remToday": "Plus ends today",
    "plus.save": "about 33% off",
    "plus.small": "Paid on gotchaa.uz via Atmos. Plus starts right after payment and lasts 30 or 365 days. Buying again adds the days to your current pass. Paid books are bought separately; imports are paid per import, with the Plus discount applied. Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
    "plus.stActive": "Plus · active",
    "plus.stExtend": "Extend Plus",
    "plus.stLeft": "days left",
    "plus.stPlay": "Bought on Google Play: manage it in Google Play.",
    "plus.stSource": "Bought with card · Atmos",
    "plus.stTitle": "Your plan",
    "plus.sub": "One-time payment, no auto-renew. When your pass ends, you're back on Free and keep all your words and progress.",
    "plus.success": "Plus is active",
    "plus.successSub": "Plus is active until {date}. No daily limit on word lookups.",
    "plus.title": "No daily limit on word lookups with Plus.",
    "plus.until": "Plus until",
    "rc.back": "Back to payments",
    "rc.date": "Date",
    "rc.download": "Download PDF",
    "rc.fiscal": "Open Atmos fiscal receipt",
    "rc.item": "Item",
    "rc.method": "Paid with",
    "rc.no": "Receipt no.",
    "rc.seller": "Seller",
    "rc.status": "Status",
    "rc.title": "Receipt",
    "refund.full": "Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
    "rev.stuck": "If the money has not returned in 10 working days, write to support@gotchaa.uz.",
    "rev.sub": "Your card had already been charged. We have asked Atmos to reverse it automatically. The money usually returns within a few days, depending on your bank.",
    "rev.title": "Payment cancelled, refund on the way",
    "rev.track": "Track it in Payments",
    "startAgain": "Start again",
    "status.active": "Active",
    "status.revoked": "Revoked",
    "status.canceled": "Cancelled",
    "status.unknown": "Being checked",
    "status.expired": "Expired",
    "status.failed": "Failed",
    "status.paid": "Paid",
    "status.pending": "Pending",
    "status.refunded": "Refunded",
    "success.cta": "Go to my import",
    "success.receipt": "View fiscal receipt",
    "success.sub": "Your import is being processed. It will appear in your library.",
    "success.title": "Payment successful",
    "summary.apply": "Apply",
    "summary.cancel": "Cancel",
    "summary.detail": "PDF · 64 pages",
    "summary.item": "Import: my-notes.pdf",
    "summary.pay": "Continue to payment",
    "summary.promo": "Promo code",
    "summary.show": "Order details",
    "summary.title": "Order summary",
    "summary.total": "Total",
    "support.review": "We are checking this payment by hand. If money was taken and nothing arrived, write to support@gotchaa.uz with the reference. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
    "trust.cards": "Pay via Atmos · Uzcard · Humo",
    "trust.refund": "Refunds only if a purchase is faulty: you were charged but didn't receive what you paid for, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
    "trust.refundPlus": "Refunds only if a purchase is faulty: you were charged but Plus wasn't delivered, the content is broken, or the charge failed or went through twice. Tell us at support@gotchaa.uz within 14 days of payment; approved refunds are returned within 10 working days.",
    "trust.secure": "Secure card payment via Atmos. Gotcha never stores your card number.",
    "trust.support": "Questions? support@gotchaa.uz"
  },
  "ru": {
    "cancel.confirmQ": "Отменить оплату?",
    "cancel.cta": "Вернуться к импорту",
    "cancel.keep": "Продолжить оплату",
    "cancel.reversed": "Если деньги списались, они вернутся автоматически. Банку может понадобиться несколько дней.",
    "cancel.sub": "Вы отменили оплату. Деньги не списаны.",
    "cancel.title": "Оплата отменена",
    "cancel.yes": "Да, отменить",
    "card.continue": "Получить SMS-код",
    "card.detected": "Uzcard",
    "card.detectedHumo": "Humo",
    "card.expErr": "Проверьте месяц: формат ММ/ГГ",
    "card.expiry": "Срок (ММ/ГГ)",
    "card.handoff": "Atmos отправит код на телефон, привязанный к карте.",
    "card.localOnly": "Карты Uzcard и Humo. CVV не нужен.",
    "card.noCvv": "Для Uzcard и Humo CVV не нужен, только номер и срок.",
    "card.number": "Номер карты",
    "card.ok": "Номер карты верный",
    "card.title": "Данные карты",
    "choose.bookSub": "Оплатите один раз, и книга откроется в вашей библиотеке.",
    "choose.bookTitle": "Открыть книгу",
    "choose.pages": "стр.",
    "choose.plusNote": "Подписка Plus пока не продаётся на сайте.",
    "choose.selected": "Ваша цена",
    "choose.sub": "Бесплатные импорты на этот месяц закончились. Цена файла зависит от количества страниц.",
    "choose.tierTitle": "Цена по количеству страниц",
    "choose.title": "Оплата импорта",
    "choose.yourFile": "Ваш файл",
    "common.placeholder": "ЗАГЛУШКА",
    "common.som": "сум",
    "err.amount": "Этот платёж нельзя провести. Напишите на support@gotchaa.uz.",
    "err.card": "Не удалось проверить карту. Проверьте данные и попробуйте снова.",
    "err.cardExpired": "Срок действия карты истёк. Используйте другую карту.",
    "err.cardFormat": "Введите номер карты из 16–19 цифр и срок в формате ММ/ГГ.",
    "err.cardInvalid": "Данные карты неверны. Проверьте номер и срок.",
    "err.expired": "Сессия оплаты истекла. Вернитесь и начните оплату заново.",
    "lim.free": "Вы использовали {free} подсказок за сегодня. С Plus нет дневного лимита на подсказки по словам. Или возвращайтесь завтра.",
    "lim.quiz": "Тесты по главам на сегодня закончились. Завтра они обновятся.",
    "lim.title": "Дневные лимиты",
    "err.funds": "Недостаточно средств на карте. Пополните её или используйте другую.",
    "err.gateway": "Оплата картой сейчас недоступна. Попробуйте позже.",
    "err.generic": "Что-то пошло не так. Попробуйте снова.",
    "err.notPriced": "Для такого объёма цена пока не задана. Попробуйте файл покороче или напишите на support@gotchaa.uz.",
    "err.otp": "Неверный SMS-код. Проверьте код и попробуйте снова.",
    "err.otpAttempts": "Слишком много неверных кодов. Начните оплату заново.",
    "err.otpExpired": "Срок SMS-кода истёк. Нажмите «Отправить ещё раз».",
    "err.plusUnavailable": "Plus пока не продаётся на сайте.",
    "err.plusViaPlay": "Ваш Plus оформлен через Google Play.",
    "err.provider": "Сбой платёжного сервиса. Деньги не списаны. Попробуйте снова или напишите на support@gotchaa.uz.",
    "fail.cta": "Попробовать снова",
    "fail.kept": "Номер карты сохранён. Исправьте его или выберите другую карту.",
    "fail.noCharge": "Деньги не списаны. Если банк заблокировал сумму, он её вернёт.",
    "fail.other": "Другая карта",
    "fail.title": "Оплата не прошла",
    "help.refundA": "Да, если покупка с ошибкой: деньги списаны, а импорт, книга или Plus не получены, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz (единственный канал) в течение 14 дней после оплаты и укажите номер платежа; после одобрения запроса мы вернём деньги в течение 10 рабочих дней.",
    "help.refundQ": "Можно ли вернуть деньги?",
    "history.amount": "Сумма",
    "history.book": "Книга",
    "history.date": "Дата",
    "history.empty": "Платежей пока нет",
    "history.fiscal": "Фискальный чек",
    "history.grant": "Подарок от Gotcha",
    "history.import": "Импорт",
    "history.item": "Покупка",
    "history.more": "Показать ещё",
    "history.ofd": "Фискальный чек (soliq.uz)",
    "history.ourReceipt": "Чек",
    "history.plus": "Пропуск Plus",
    "history.receipt": "Чек",
    "history.reversing": "Возврат",
    "history.src.admin": "Подарок от Gotcha",
    "history.src.atmos": "Карта · Atmos",
    "history.src.play": "Google Play",
    "history.status": "Статус",
    "history.sub": "Ваши покупки и чеки.",
    "imp.freeRetry": "Оплаченный импорт не завершился. Попробуйте ещё раз — это бесплатно, повторно деньги не спишутся.",
    "imp.retryUsing": "Используем прошлую оплату — новых списаний нет.",
    "imp.refundDue": "Оплаченный импорт так и не получился. Мы вернём деньги, ничего делать не нужно. Вопросы: support@gotchaa.uz.",
    "history.title": "Платежи",
    "oferta": "Публичная оферта",
    "otp.code": "SMS-код",
    "otp.confirm": "Подтвердить оплату",
    "otp.label": "Код подтверждения из SMS",
    "otp.resend": "Отправить ещё раз",
    "otp.resendIn": "Повтор через 0:24",
    "otp.sentTo": "Код отправлен на телефон, привязанный к карте •••• 9012.",
    "otp.sub": "Мы отправили код на телефон, привязанный к карте •••• 2829.",
    "otp.title": "Введите код из SMS",
    "pay.amount": "Оплатить",
    "pc.cta": "Написать на support@gotchaa.uz",
    "pc.sub": "Оплаченную покупку здесь отменить нельзя.",
    "pc.title": "Этот платёж уже прошёл",
    "pending.check": "Проверить снова",
    "pending.ref": "Номер",
    "pending.s1": "Карта проверена",
    "pending.s2": "SMS-код подтверждён",
    "pending.s3": "Ждём ответа банка",
    "pending.slow": "Дольше обычного. Можно закрыть страницу: импорт начнётся сразу после подтверждения, и вы получите уведомление.",
    "pending.sub": "Atmos принял код. Ждём подтверждения от банка, обычно это занимает несколько секунд.",
    "pending.title": "Подтверждаем оплату",
    "plus.active": "Plus активен до {date}",
    "plus.b1": "Без дневного лимита на подсказки по словам (в бесплатном плане {free} в день)",
    "plus.b2": "Скидка 50% на каждый платный импорт",
    "plus.b3": "Всё из бесплатного плана остаётся с вами",
    "plus.bImp": "Скидка {pct}% на каждый платный импорт",
    "plus.bQuiz": "{plusQ} тестов по главам в день (в бесплатном плане {freeQ})",
    "plus.cta": "Подключить Plus",
    "plus.ctaShort": "Продолжить",
    "plus.expCta": "Снова подключить Plus",
    "plus.expSub": "Вы снова на бесплатном плане: {free} подсказок по словам в день. Слова, книги и прогресс сохранены.",
    "plus.expTitle": "Plus закончился",
    "plus.extAdd": "Добавляете",
    "plus.extLeft": "Осталось сейчас",
    "plus.extNew": "Новая дата окончания",
    "plus.extNote": "Новые дни добавляются после текущих. Вы ничего не теряете.",
    "plus.extTitle": "Продлить Plus",
    "plus.item30": "Gotcha Plus · 30 дней",
    "plus.item365": "Gotcha Plus · 365 дней",
    "plus.later": "Позже",
    "plus.lead": "В бесплатном плане {free} подсказок по словам в день. В Plus нет дневного лимита на подсказки по словам, и длинная глава не оборвётся на середине.",
    "plus.noRenew": "Разовый платёж. Без автопродления: когда срок закончится, вы вернётесь на бесплатный план.",
    "plus.o30": "30 дней",
    "plus.o365": "365 дней",
    "plus.perMonth": "≈ {perMonth} сум / мес.",
    "plus.rem1": "Plus закончится завтра",
    "plus.rem7": "Plus закончится через 3 дня",
    "plus.remCta": "Продлить Plus",
    "plus.remSub": "Потом вы вернётесь на бесплатный план. Ничего не спишется автоматически.",
    "plus.remToday": "Plus закончится сегодня",
    "plus.save": "примерно на 33% выгоднее",
    "plus.small": "Оплата на gotchaa.uz через Atmos. Plus включается сразу после оплаты и действует 30 или 365 дней. Повторная покупка добавляет дни к текущему сроку. Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus. Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.",
    "plus.stActive": "Plus · активен",
    "plus.stExtend": "Продлить Plus",
    "plus.stLeft": "дн. осталось",
    "plus.stPlay": "Куплено в Google Play: управляйте в Google Play.",
    "plus.stSource": "Оплачено картой · Atmos",
    "plus.stTitle": "Ваш план",
    "plus.sub": "Разовый платёж, без автопродления. Когда срок закончится, вы вернётесь на бесплатный план, а слова и прогресс сохранятся.",
    "plus.success": "Plus активен",
    "plus.successSub": "Plus активен до {date}. Без дневного лимита на подсказки по словам.",
    "plus.title": "С Plus нет дневного лимита на подсказки по словам.",
    "plus.until": "Plus до",
    "rc.back": "К платежам",
    "rc.date": "Дата",
    "rc.download": "Скачать PDF",
    "rc.fiscal": "Фискальный чек Atmos",
    "rc.item": "Покупка",
    "rc.method": "Способ оплаты",
    "rc.no": "Номер",
    "rc.seller": "Продавец",
    "rc.status": "Статус",
    "rc.title": "Квитанция",
    "refund.full": "Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.",
    "rev.stuck": "Если деньги не вернулись за 10 рабочих дней, напишите на support@gotchaa.uz.",
    "rev.sub": "Деньги уже были списаны. Мы автоматически запросили отмену в Atmos. Обычно деньги возвращаются за несколько дней, в зависимости от банка.",
    "rev.title": "Оплата отменена, деньги вернутся",
    "rev.track": "Следить в разделе «Платежи»",
    "startAgain": "Начать заново",
    "status.active": "Активен",
    "status.revoked": "Отозван",
    "status.canceled": "Отменён",
    "status.unknown": "Проверяется",
    "status.expired": "Истёк",
    "status.failed": "Ошибка",
    "status.paid": "Оплачено",
    "status.pending": "В обработке",
    "status.refunded": "Возвращено",
    "success.cta": "Открыть импорт",
    "success.receipt": "Фискальный чек",
    "success.sub": "Импорт обрабатывается и появится в вашей библиотеке.",
    "success.title": "Оплата прошла",
    "summary.apply": "Применить",
    "summary.cancel": "Отмена",
    "summary.detail": "PDF · 64 стр.",
    "summary.item": "Импорт: my-notes.pdf",
    "summary.pay": "Перейти к оплате",
    "summary.promo": "Промокод",
    "summary.show": "Детали заказа",
    "summary.title": "Ваш заказ",
    "summary.total": "Итого",
    "support.review": "Мы проверяем этот платёж вручную. Если деньги списаны, а покупка не пришла, напишите на support@gotchaa.uz и укажите номер. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.",
    "trust.cards": "Оплата через Atmos · Uzcard · Humo",
    "trust.refund": "Возврат только при сбое покупки: деньги списаны, а покупка не получена, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.",
    "trust.refundPlus": "Возврат только при сбое покупки: деньги списаны, а Plus не включился, контент не работает, платёж прошёл с ошибкой или дважды. Напишите на support@gotchaa.uz в течение 14 дней после оплаты; одобренный возврат поступит в течение 10 рабочих дней.",
    "trust.secure": "Безопасная оплата картой через Atmos. Gotcha не хранит номер вашей карты.",
    "trust.support": "Вопросы? support@gotchaa.uz"
  },
  "uz": {
    "cancel.confirmQ": "Toʻlov bekor qilinsinmi?",
    "cancel.cta": "Importga qaytish",
    "cancel.keep": "Toʻlovni davom ettirish",
    "cancel.reversed": "Pul yechilgan boʻlsa, avtomatik qaytariladi. Bank uni bir necha kunda qaytaradi.",
    "cancel.sub": "Toʻlovni bekor qildingiz. Pul yechilmadi.",
    "cancel.title": "Toʻlov bekor qilindi",
    "cancel.yes": "Ha, bekor qilish",
    "card.continue": "SMS kod olish",
    "card.detected": "Uzcard",
    "card.detectedHumo": "Humo",
    "card.expErr": "Oyni tekshiring: OO/YY",
    "card.expiry": "Amal muddati (OO/YY)",
    "card.handoff": "Atmos kartangizga ulangan telefonga kod yuboradi.",
    "card.localOnly": "Uzcard va Humo kartalari. CVV kerak emas.",
    "card.noCvv": "Uzcard va Humo uchun CVV kerak emas, faqat raqam va muddat.",
    "card.number": "Karta raqami",
    "card.ok": "Karta raqami toʻgʻri",
    "card.title": "Karta maʼlumotlari",
    "choose.bookSub": "Bir marta toʻlang, kitob kutubxonangizda ochiladi.",
    "choose.bookTitle": "Kitobni ochish",
    "choose.pages": "bet",
    "choose.plusNote": "Plus obunasi hozircha saytda sotilmaydi.",
    "choose.selected": "Sizning narxingiz",
    "choose.sub": "Bu oyning bepul importlari tugadi. Fayl narxi sahifalar soniga bogʻliq.",
    "choose.tierTitle": "Sahifalar soni boʻyicha narx",
    "choose.title": "Import uchun toʻlov",
    "choose.yourFile": "Faylingiz",
    "common.placeholder": "NAMUNA",
    "common.som": "soʻm",
    "err.amount": "Bu toʻlovni amalga oshirib boʻlmaydi. support@gotchaa.uz ga yozing.",
    "err.card": "Kartani tekshirib boʻlmadi. Maʼlumotlarni tekshirib, qayta urinib koʻring.",
    "err.cardExpired": "Karta muddati tugagan. Boshqa kartadan foydalaning.",
    "err.cardFormat": "16–19 raqamli karta raqami va muddatni OO/YY koʻrinishida kiriting.",
    "err.cardInvalid": "Karta maʼlumotlari notoʻgʻri. Raqam va muddatni tekshiring.",
    "err.expired": "Toʻlov sessiyasi tugadi. Orqaga qaytib, toʻlovni qaytadan boshlang.",
    "lim.free": "Bugungi {free} ta soʻz qidirish tugadi. Soʻz qidirishda kunlik cheklov boʻlmasligi uchun Plusʼni oling yoki ertaga qayting.",
    "lim.quiz": "Bugungi bob testlari tugadi. Ertaga yangilanadi.",
    "lim.title": "Kunlik limitlar",
    "err.funds": "Kartada mablagʻ yetarli emas. Toʻldiring yoki boshqa kartadan foydalaning.",
    "err.gateway": "Karta orqali toʻlov hozir ishlamayapti. Keyinroq urinib koʻring.",
    "err.generic": "Xatolik yuz berdi. Qayta urinib koʻring.",
    "err.notPriced": "Bu hajm uchun narx hali belgilanmagan. Qisqaroq fayl yuklang yoki support@gotchaa.uz ga yozing.",
    "err.otp": "SMS kod notoʻgʻri. Kodni tekshirib, qayta urinib koʻring.",
    "err.otpAttempts": "Notoʻgʻri kod koʻp marta kiritildi. Toʻlovni qaytadan boshlang.",
    "err.otpExpired": "SMS kod muddati tugadi. “Qayta yuborish”ni bosing.",
    "err.plusUnavailable": "Plus hozircha saytda sotilmaydi.",
    "err.plusViaPlay": "Plus obunangiz Google Play orqali boshqariladi.",
    "err.provider": "Toʻlov xizmatida nosozlik. Pul yechilmadi. Qayta urinib koʻring yoki support@gotchaa.uz ga yozing.",
    "fail.cta": "Qayta urinish",
    "fail.kept": "Karta raqami saqlandi. Tuzating yoki boshqa karta tanlang.",
    "fail.noCharge": "Pul yechilmadi. Agar bank summani band qilgan boʻlsa, uni qaytaradi.",
    "fail.other": "Boshqa karta",
    "fail.title": "Toʻlov oʻtmadi",
    "help.refundA": "Ha, agar xarid nosoz boʻlsa: pul yechilgan, lekin import, kitob yoki Plus kelmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga (yagona kanal) toʻlov raqami bilan yozing; murojaat qabul qilingach, 10 ish kuni ichida pulni qaytaramiz.",
    "help.refundQ": "Pulni qaytarib olsa boʻladimi?",
    "history.amount": "Summa",
    "history.book": "Kitob",
    "history.date": "Sana",
    "history.empty": "Hali toʻlovlar yoʻq",
    "history.fiscal": "Fiskal chek",
    "history.grant": "Gotcha sovgʻasi",
    "history.import": "Import",
    "history.item": "Xarid",
    "history.more": "Yana koʻrsatish",
    "history.ofd": "Fiskal chek (soliq.uz)",
    "history.ourReceipt": "Chek",
    "history.plus": "Plus muddati",
    "history.receipt": "Chek",
    "history.reversing": "Qaytarilmoqda",
    "history.src.admin": "Gotcha sovgʻasi",
    "history.src.atmos": "Karta · Atmos",
    "history.src.play": "Google Play",
    "history.status": "Holat",
    "history.sub": "Xaridlaringiz va cheklar.",
    "imp.freeRetry": "Toʻlangan import yakunlanmadi. Qayta urinib koʻring — bu bepul, pul ikkinchi marta yechilmaydi.",
    "imp.retryUsing": "Avvalgi toʻlovingizdan foydalanamiz — yangi toʻlov yoʻq.",
    "imp.refundDue": "Toʻlangan import baribir chiqmadi. Pulni qaytaramiz, hech narsa qilish shart emas. Savollar: support@gotchaa.uz.",
    "history.title": "Toʻlovlar",
    "oferta": "Ommaviy oferta",
    "otp.code": "SMS kod",
    "otp.confirm": "Toʻlovni tasdiqlash",
    "otp.label": "SMS dagi tasdiqlash kodi",
    "otp.resend": "Qayta yuborish",
    "otp.resendIn": "Qayta: 0:24",
    "otp.sentTo": "Kod kartangizga ulangan telefon raqamiga yuborildi (•••• 9012).",
    "otp.sub": "Kod •••• 2829 kartasiga ulangan telefonga yuborildi.",
    "otp.title": "Tasdiqlash kodini kiriting",
    "pay.amount": "Toʻlash",
    "pc.cta": "support@gotchaa.uz ga yozish",
    "pc.sub": "Toʻlangan xaridni bu yerda bekor qilib boʻlmaydi.",
    "pc.title": "Bu toʻlov allaqachon amalga oshgan",
    "pending.check": "Qayta tekshirish",
    "pending.ref": "Raqam",
    "pending.s1": "Karta tekshirildi",
    "pending.s2": "SMS kod tasdiqlandi",
    "pending.s3": "Bank javobini kutyapmiz",
    "pending.slow": "Odatdagidan uzoqroq. Sahifani yopsangiz boʻladi: toʻlov tasdiqlanishi bilan import boshlanadi va sizga bildirishnoma keladi.",
    "pending.sub": "Atmos kodni qabul qildi. Bank tasdigʻini kutyapmiz, odatda bir necha soniya.",
    "pending.title": "Toʻlov tasdiqlanmoqda",
    "plus.active": "Plus {date} gacha faol",
    "plus.b1": "Soʻz qidirishda kunlik cheklov yoʻq (bepul tarifda kuniga {free} ta)",
    "plus.b2": "Har bir pullik importga 50% chegirma",
    "plus.b3": "Bepul tarifdagi hamma narsa saqlanib qoladi",
    "plus.bImp": "Har bir pullik importga {pct}% chegirma",
    "plus.bQuiz": "Kuniga {plusQ} ta bob testi (bepul tarifda {freeQ} ta)",
    "plus.cta": "Plusʼni olish",
    "plus.ctaShort": "Davom etish",
    "plus.expCta": "Plusni qayta olish",
    "plus.expSub": "Yana bepul tarifdasiz: kuniga {free} ta soʻz qidirish. Soʻzlar, kitoblar va natijalar saqlangan.",
    "plus.expTitle": "Plus muddati tugadi",
    "plus.extAdd": "Qoʻshiladi",
    "plus.extLeft": "Hozir qolgan",
    "plus.extNew": "Yangi tugash sanasi",
    "plus.extNote": "Yangi kunlar joriy kunlardan keyin qoʻshiladi. Hech narsa yoʻqolmaydi.",
    "plus.extTitle": "Plusni uzaytirish",
    "plus.item30": "Gotcha Plus · 30 kun",
    "plus.item365": "Gotcha Plus · 365 kun",
    "plus.later": "Keyinroq",
    "plus.lead": "Bepul tarifda kuniga {free} ta soʻz qidirish bor. Plusʼda soʻz qidirishda kunlik cheklov yoʻq, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.",
    "plus.noRenew": "Bir martalik toʻlov. Avtomatik yangilanmaydi: muddat tugagach, bepul tarifga qaytasiz.",
    "plus.o30": "30 kun",
    "plus.o365": "365 kun",
    "plus.perMonth": "≈ {perMonth} so'm / oy",
    "plus.rem1": "Plus ertaga tugaydi",
    "plus.rem7": "Plus 3 kundan keyin tugaydi",
    "plus.remCta": "Plusni uzaytirish",
    "plus.remSub": "Keyin bepul rejaga qaytasiz. Hech narsa avtomatik yechilmaydi.",
    "plus.remToday": "Plus bugun tugaydi",
    "plus.save": "taxminan 33% arzon",
    "plus.small": "Toʻlov gotchaa.uz saytida Atmos orqali. Plus toʻlovdan keyin darhol ishga tushadi va 30 yoki 365 kun amal qiladi. Qayta sotib olsangiz, kunlar joriy muddatga qoʻshiladi. Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi. Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.",
    "plus.stActive": "Plus · faol",
    "plus.stExtend": "Plusni uzaytirish",
    "plus.stLeft": "kun qoldi",
    "plus.stPlay": "Google Play orqali olingan: Google Playʼda boshqaring.",
    "plus.stSource": "Karta orqali · Atmos",
    "plus.stTitle": "Rejangiz",
    "plus.sub": "Bir martalik toʻlov, avtomatik yangilanmaydi. Muddat tugagach, bepul tarifga qaytasiz, soʻzlaringiz va natijalaringiz saqlanib qoladi.",
    "plus.success": "Plus faollashdi",
    "plus.successSub": "Plus {date} gacha faol. Soʻz qidirishda kunlik cheklov yoʻq.",
    "plus.title": "Plus bilan soʻz qidirishda kunlik cheklov yoʻq.",
    "plus.until": "Plus muddati",
    "rc.back": "Toʻlovlarga qaytish",
    "rc.date": "Sana",
    "rc.download": "PDF yuklab olish",
    "rc.fiscal": "Atmos fiskal cheki",
    "rc.item": "Xarid",
    "rc.method": "Toʻlov usuli",
    "rc.no": "Raqam",
    "rc.seller": "Sotuvchi",
    "rc.status": "Holat",
    "rc.title": "Kvitansiya",
    "refund.full": "Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.",
    "rev.stuck": "Agar pul 10 ish kuni ichida qaytmasa, support@gotchaa.uz ga yozing.",
    "rev.sub": "Kartangizdan pul allaqachon yechilgan edi. Atmosʼdan avtomatik qaytarishni soʻradik. Pul odatda bankka qarab bir necha kunda qaytadi.",
    "rev.title": "Toʻlov bekor qilindi, pul qaytariladi",
    "rev.track": "«Toʻlovlar» boʻlimida kuzatish",
    "startAgain": "Qaytadan boshlash",
    "status.active": "Faol",
    "status.revoked": "Bekor qilingan",
    "status.canceled": "Bekor qilindi",
    "status.unknown": "Tekshirilmoqda",
    "status.expired": "Muddati oʻtgan",
    "status.failed": "Xato",
    "status.paid": "Toʻlangan",
    "status.pending": "Kutilmoqda",
    "status.refunded": "Qaytarilgan",
    "success.cta": "Importni ochish",
    "success.receipt": "Fiskal chek",
    "success.sub": "Import qayta ishlanmoqda va kutubxonangizda paydo boʻladi.",
    "success.title": "Toʻlov amalga oshdi",
    "summary.apply": "Qoʻllash",
    "summary.cancel": "Bekor qilish",
    "summary.detail": "PDF · 64 bet",
    "summary.item": "Import: my-notes.pdf",
    "summary.pay": "Toʻlovga oʻtish",
    "summary.promo": "Promokod",
    "summary.show": "Buyurtma tafsilotlari",
    "summary.title": "Buyurtma",
    "summary.total": "Jami",
    "support.review": "Bu toʻlovni qoʻlda tekshiryapmiz. Pul yechilgan, lekin xarid kelmagan boʻlsa, raqamni koʻrsatib support@gotchaa.uz ga yozing. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.",
    "trust.cards": "Atmos orqali toʻlov · Uzcard · Humo",
    "trust.refund": "Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin xarid qilingan narsa berilmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.",
    "trust.refundPlus": "Pul faqat xarid nosoz boʻlsa qaytariladi: pul yechilgan, lekin Plus ishga tushmagan, kontent buzuq yoki toʻlov xato yo ikki marta oʻtgan. Toʻlovdan keyin 14 kun ichida support@gotchaa.uz manziliga yozing; tasdiqlangan pul 10 ish kuni ichida qaytariladi.",
    "trust.secure": "Atmos orqali xavfsiz karta toʻlovi. Gotcha karta raqamingizni saqlamaydi.",
    "trust.support": "Savollar boʻlsa: support@gotchaa.uz"
  }
};

export function payCopyFor(lang: string | null | undefined): Record<PayKey, string> {
  return PAY_COPY[lang === 'ru' || lang === 'uz' ? lang : 'en'];
}

/** Stable billing error code (API `code`) → pay.* key. Unknown codes fall back to err.generic. */
export const PAY_ERROR_KEYS: Record<string, PayKey> = {
  card_failed: 'err.card', card_invalid: 'err.cardInvalid', card_expired: 'err.cardExpired', insufficient_funds: 'err.funds',
  card_format: 'err.cardFormat', otp_wrong: 'err.otp', otp_expired: 'err.otpExpired', otp_attempts: 'err.otpAttempts',
  otp_format: 'err.otp', session_expired: 'err.expired', provider_error: 'err.provider', amount_not_allowed: 'err.amount',
  gateway_unavailable: 'err.gateway', not_priced: 'err.notPriced', plus_unavailable: 'err.plusUnavailable', plus_via_play: 'err.plusViaPlay',
};
export function payErrorText(code: string | null | undefined, lang: string | null | undefined): string {
  const t = payCopyFor(lang);
  return t[(code && PAY_ERROR_KEYS[code]) || 'err.generic'];
}
/** Error codes that keep the learner on the same step (inline), versus the failure screen. */
export const PAY_INLINE_CODES = new Set(['card_invalid', 'card_expired', 'card_format', 'otp_wrong', 'otp_expired', 'otp_format']);

/** Fill mockup samples with live values: masked card (Atmos returns no phone) and the resend countdown. */
export function payFill(text: string, v: { mask?: string; seconds?: number }): string {
  let out = text;
  if (v.mask) out = out.replace(/•••• \d{4}/g, `•••• ${v.mask.replace(/\D/g, '').slice(-4)}`);
  if (v.seconds != null) out = out.replace(/\d:\d\d/, `${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, '0')}`);
  return out;
}
/** "199 990 soʻm" / "199 990 сум": space-grouped, never "0" (0 means not priced). */
export function paySom(amount: number, lang: string | null | undefined): string {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${lang === 'ru' ? 'сум' : 'soʻm'}`;
}
/** Uzcard / Humo from the BIN (text chip only, no logos). */
export function cardBrand(pan: string): 'uzcard' | 'humo' | null {
  const d = pan.replace(/\D/g, '');
  if (/^(8600|5614)/.test(d)) return 'uzcard';
  if (/^9860/.test(d)) return 'humo';
  return null;
}

/** Legal placeholders until Legal provides them. The oferta link stays a non-navigating placeholder. */
/** Sarvarbek 13:57 ('I accept the risk'): seller shown as the team only; no legal name / STIR fields. */
/** Plus numbers come from admin config (plan aiDailyQuota, plus.benefits.importDiscountPct, pass prices), never hardcoded. */
export type PlusNumbers = { plus: number; free: number; pct: number; perMonth?: string; plusQ?: number; freeQ?: number; date?: string };
export function plusFill(text: string, v: PlusNumbers): string {
  return text.replace(/\{date\}/g, v.date ?? '').replace(/\{plus\}/g, String(v.plus)).replace(/\{free\}/g, String(v.free)).replace(/\{pct\}/g, String(v.pct)).replace(/\{perMonth\}/g, v.perMonth ?? '').replace(/\{plusQ\}/g, String(v.plusQ ?? '')).replace(/\{freeQ\}/g, String(v.freeQ ?? ''));
}
/** Paywall variants (UI/UX confirmed, PLUS-OFFER.md §4 order):
 *  10c = lookups, chapter quizzes, import discount, Everything in Free: ONLY when the quiz cap AND the import discount are live.
 *  10b = lookups, import discount, Everything in Free (discount live, quiz cap not or not both).
 *  10  = lookups, Everything in Free (otherwise, incl. quiz cap without discount). */
export function plusPaywallVariant(pct: number, quizCap: boolean): '10' | '10b' | '10c' {
  const imp = pct > 0;
  return quizCap && imp ? '10c' : imp ? '10b' : '10';
}
export function plusBullets(pct: number, quizCap = false): PayKey[] {
  const v = plusPaywallVariant(pct, quizCap);
  if (v === '10c') return ['plus.b1', 'plus.bQuiz', 'plus.bImp', 'plus.b3'];
  if (v === '10b') return ['plus.b1', 'plus.bImp', 'plus.b3'];
  return ['plus.b1', 'plus.b3'];
}

/** PAY2-03 (Marketing final, PLUS-OFFER.md 31 Oct 15:07): while the import discount is off (pct = 0) the WHOLE
 *  books/imports sentence of plus.small is replaced; the rest is unchanged. With pct > 0 the text is verbatim. */
const PLUS_SMALL_NO_DISCOUNT: Array<[string, string]> = [
  ['Paid books are bought separately; imports are paid per import, with the Plus discount applied.', 'Paid books and imports are paid for separately.'],
  ['Pullik kitoblar alohida toʻlanadi; importlar har biri uchun Plus chegirmasi bilan toʻlanadi.', 'Pullik kitoblar va importlar alohida toʻlanadi.'],
  ['Платные книги оплачиваются отдельно; импорты оплачиваются поштучно со скидкой Plus.', 'Платные книги и импорты оплачиваются отдельно.'],
];
export function plusSmallPrint(text: string, pct: number): string {
  if (pct > 0) return text;
  return PLUS_SMALL_NO_DISCOUNT.reduce((t, [from, to]) => t.replace(from, to), text);
}

export const PAY_SELLER = { en: 'the Erkin Tizim team', uz: 'Erkin Tizim jamoasi', ru: 'команда Erkin Tizim' } as const;
export const PAY_OFERTA_URL: string | null = null;

/** Reminder copy for an Atmos pass (decided: 3 days, 1 day, and on the day). Key plus.rem7 carries the 3-day text in the final spec. */
export function plusReminderKey(daysLeft: number): PayKey | null {
  if (daysLeft === 3) return 'plus.rem7';
  if (daysLeft === 1) return 'plus.rem1';
  if (daysLeft === 0) return 'plus.remToday';
  return null;
}

/** Cancel outcome → screen: 06 cancelled (nothing charged), 06b race reversal, 06c already paid (support only). */
export function cancelScreen(r: { status?: string | null; code?: string | null }): '06' | '06b' | '06c' {
  if (r.code === 'refund_requires_support') return '06c';
  if (r.status === 'reversing') return '06b';
  return '06';
}
