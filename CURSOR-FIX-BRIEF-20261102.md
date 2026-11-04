# Gotcha: fix brief for Cursor (from Kai and the Gotcha team, 2 Nov 2026)

You're working in the LIVE codebase (API ad4625ad8690 and the matching web builds). Fix every issue below in code and copy, in en/ru/uz.

## Hard rules
- Do NOT deploy, push, run migrations or data changes on prod, delete anything, or touch payments config without Sarvarbek's explicit OK. Make the changes locally, build, test, then show him a summary.
- Never rotate the Atmos or API keys. Keep all user data. Don't print secrets.

## Product decisions (final)
- Refunds: no refunds for a change of mind (put this line at checkout and in the Terms/Oferta). Automatic Atmos reversal ONLY for failed paid imports. The late-Atmos-confirm and cancel-after-confirm cases get flagged needs_attention for a MANUAL refund, with no auto-reverse. Fix the admin refund vs auto-reverse race: block the admin refund while an import is processing or needs_attention.
- Seller: name only "the Erkin Tizim team" (no legal details).
- Plus = 50% off paid IMPORTS (the code is 0% now, so fix it; add it to the plans API features). Catalog books are a flat 49,000 soʻm: remove the buy-3 10% and buy-5 20% discounts and the per-page surcharge. The Oferta says Plus doesn't change catalog book prices.
- Hide the promo code field.
- Free imports: all 5 formats stay allowed; update the copy to match.
- Limits: chapter quizzes 10 a day Free and 200 Plus; Mashq 20 a day Free and unlimited Plus; lookups 20 a day Free and "no fixed daily limit" on Plus; imports 3 a day and 50 pages a month Free, 20 a day and 2,000 pages a month Plus, with reset times. Show these in the Terms, Oferta, landing page, Plus page and app.
- Plus is a pass, not a subscription: fix the uz "obuna" wording and remove "Plus is not sold on the web yet".
- No "spaced repetition" or fluency claims. The SRS is FSRS.
- Remove or wire up the admin Plus fair-use 200/200 fields that do nothing. Update FEATURES.md (FSRS; XP, freezes and daily practice are live).
- Hide Renew for Free users. Merge the duplicate lookup counters in Settings. Fix the uz date format ("2026 M12 1 kuni"). Fix the FAQ's "imports are paid" line (there's a free quota). Unify ru/uz terms. Fix "not flashcards" vs the flashcard copy.
- Landing data-use line: AI lookups go to OpenAI (USA); data is stored in Uzbekistan. Privacy: consent records and audit logs are kept after deletion; disclose the TTS 300-a-day cap; store the two consents separately.
- TTS settings: migrations 0039/0040 reset everyone to ON. Prepare a restore script from the 31 Oct backup but DO NOT run it.

## Full detailed lists from the team below

---
# SOURCE: team/pm/FEATURE-POLICY-MATRIX-20261102.md
# Gotcha feature / policy matrix (2 Nov 2026, ~10:00 Asia/Tashkent, UTC+5). READ-ONLY.
**Sources.**
- **Live site:** web bundle /assets/index-DT06Mbbb.js, which contains the landing page and the LIVE Terms/Oferta/Privacy; learner bundle /learn/assets/index-DiEtSX6J.js; anonymous GET /api/v1/billing/plans and /marketing/plans.
- **API enforces:** the Lead's web-launch-04/ENFORCED-POLICY-ad4625a.md (file:line refs into live-dist-ad4625a/dist), plus the DevOps settings dump team/devops/settings-dump-20261102.md.
- **Other inputs:** QA's live Free-account check (09:50), Marketing's claims inventory (/tmp/gotcha-claims-inventory-20261102.md), team/FEATURES.md, and the admin audits (PANEL-AUDIT-MERGED, ADMIN-AUDIT-20261031).

**Drafts note.** team/pm/legal/web/pending-payments-02 is an uncommitted DRAFT. Its pre-edit copy (backup-pending-payments-02-20261102-0935/) is byte-equal to the live text. The current draft adds 3 lines: Plus 20 imports/day and 2,000 pages/month, the Free lookup/quiz line, and the resets. Those lines are NOT live. This matrix compares against the LIVE text. That draft still says "10 quizzes" without separating chapter quizzes from Mashq (see row 2).

**Legend.** "–" means not stated there. MISMATCH = Y/N. NI = NEEDS INPUT (owner).

| # | Feature / limit | Decision (source of truth) | API enforces | Terms (live) | Oferta (live) | Privacy (live) | Landing en/ru/uz | In-app (Plus page, strings) | Admin | MISMATCH, current text → fix |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Free word lookups | 20/day | 20 (`caps.free.lookups`=20 in DB; plan-caps.js:40); toast at 20 (QA) | "free accounts: up to 20 a day" | same | – | "20 word lookups" (FAQ) | "You've used today's 20 word lookups… Resets at 00:00 (Tashkent time)" | aiDailyQuota field is dead (N3) | N |
| 2 | Chapter quizzes vs Mashq | Free 10 quizzes; Plus 200. Lead: the cap is **chapter quizzes**. Mashq is separate | Chapter quizzes: Free 10, Plus 200 (code defaults, limits.service.js:98-113). **Mashq: own counter, Free 20 (shared fallback; the DB key is MISSING), Plus unlimited** | "up to **200 quizzes per day** (free accounts: up to 10)". Mashq not mentioned | §3 same | – | FAQ "20 Mashq questions a day"; Plus bullet "No daily limit on Mashq (20… on Free)" | Plus page `plus.bQuiz` "No daily limit on Mashq (20 questions a day on Free)"; Settings "Mashq: 0/20 today"; `lim.quiz` "You've used today's chapter quizzes"; no chapter-quiz counter (QA) | – | **Y.** UI "Mashq 20" is CORRECT. The legal text conflates the two. **Fix Terms §7 / Oferta §3:** "up to **200 chapter quizzes a day** (free accounts: up to 10 chapter quizzes a day); **no daily limit on Mashq practice questions** (free accounts: up to 20 a day)". ru: «до **200 тестов по главам в день** (бесплатные аккаунты: до 10); **Mashq без дневного лимита** (бесплатные аккаунты: до 20 вопросов в день)». uz: «kuniga **200 tagacha bob testi** (bepul hisoblar: 10 tagacha); **Mashq uchun kunlik limit yoʻq** (bepul hisoblar: kuniga 20 tagacha savol)». The landing/app should add the chapter-quiz limit: "10 chapter quizzes a day on Free, 200 with Plus". **Correct my earlier note (READINESS v2 item 7): changing "20 Mashq" to 10 would be WRONG.** NI (Lead): set `caps.free.mashq` in the DB so it doesn't rely on the shared fallback. |
| 3 | Plus lookups | Unlimited | null = unlimited (plan-caps.js:45); burst 30/min, 300/h | "no fixed daily limit… Speed protection" | same | – | "No daily limit on word lookups (20 on Free)" | `plus.title` "No daily limit on word lookups with Plus." | `plus.fair_use` 200/200 fields **not enforced** (plan-active.js:10-11) | **Y (admin).** The fair-use fields mislead → hide or remove them in admin, or label them "not enforced". Owner: Lead. |
| 4 | Free imports | 3/day, 50 pages/month | DB: 3 / 50 (dump) | "Free accounts: 3 imports a day and 50 pages a month" | same | – | FAQ same | "3 of 3 free imports left today", "50 of 50 free pages left this month" (QA) | – | N |
| 5 | Plus imports | 20/day, 2,000 pages/month | DB SET: 20 / 2000 (dump; would fall back to 3/50 if unset) | **not stated** | **not stated** | – | **not stated** | **appears nowhere in the UI** (QA) | – | **Y.** Add the line "**Imports with Plus:** up to **20 imports a day** and **2,000 pages a month**" to Terms §7, Oferta §3, the landing Plus bullets and the Plus page (the draft line is ready in pending-payments-02, not published). Owners: PM / Marketing / UI-UX. |
| 6 | Free import formats | Docs: free = pasted text + article link; PDF/EPUB paid | DB `allowedFormats` = **article, news, ebook, research, custom** (dump; code default article, news) | – | – | – | "Pasted text and article links are free… PDF and EPUB imports… are paid per import" | – | – | **Y (possible).** The DB allows more free formats than the copy says. NI (Lead): does `allowedFormats` make ebook/research/custom imports free? If yes, either narrow the setting to article, news or change the copy. FEATURES.md doesn't document it. |
| 7 | Resets | 00:00 Tashkent daily; pages on the 1st | daily 00:00 Asia/Tashkent; monthly on the 1st, resetCycle=monthly, no rollover (dump) | – (only "limits shown in the Service") | – | – | "Daily limits reset at 00:00 Tashkent time" (no monthly rule) | "resetting 1 Dec 00:00" (QA) | – | **Y (minor).** Terms/Oferta should add: "Daily limits reset at 00:00 Tashkent time (UTC+5); monthly page limits reset at 00:00 Tashkent time on the 1st of each month." The landing FAQ should add "…page limits reset on the 1st of each month." |
| 8 | Import prices | 12k / 29k / 49k / 79k | DB import_page_tiers 12000/29000/49000/79000 (dump) | "priced by page count" | – (pass-only offer) | – | "from 12,000 soʻm for 1–10 pages" | Shown only after a file is chosen (QA) | Tier editor visible (B4) | N. Optional: publish the full tier table on the landing/FAQ. Marketing. |
| 9 | Plus 50% off imports | Yes | 50% default (plus-pass.js:15,42; DB key MISSING → default) | "50% off paid imports" | "50% off paid imports" | – | "Plus gets 50% off every paid import" | "50% off every paid import" on the Plus page only (QA) | – | **Y (minor).** Not in the API plan `features`. Add "50% off every paid import" to /billing/plans and /marketing/plans Plus features. Lead. |
| 10 | Catalog book price + Plus book discount | 49,000; Plus 50% off books | Base 49000 (catalogPricingRules, also buy3 10% / buy5 20% volume discounts, perPageSurcharge 0.02); **Plus bookDiscountPct = 0** (default, DB key missing) | "access to paid books" (no price) | **"Plus… does not change the prices of paid books"** | – | – | Plus page "Paid books are bought separately"; library cards show no prices (QA) | – | **Y (conflict).** The decision says Plus 50% off books, but code = 0% and the Oferta says no change. Fix: either set `plus.benefits.bookDiscountPct=50` and change the Oferta to "Plus gives 50% off paid catalog books" (ru «скидка 50% на платные книги каталога», uz «katalogdagi pullik kitoblarga 50% chegirma»), or drop the decision. Also flag: the buy3/buy5 volume discounts and per-page surcharge are in prod settings but in no decision or copy. NI (Kai/Sarvarbek) + Lead. |
| 11 | Plus passes | 24,990 / 30 d; 199,990 / 365 d; no trial, no auto-renew; stackable | DB-set 24990/199990; one-off, stacking (plus-pass.js:57-60) | matches | matches table | – | matches | matches; "≈16 666 so'm · −33%" / `plus.save` "about 33% off" | No Plus price screen (B10) | **Y (copy).** (a) `plus.save` "about 33% off": 199,990 vs 12×24,990 = 299,880 → 33.3%, which is true, but it's a reference-price claim. Keep it as "≈16,666 soʻm a month" or confirm with Marketing/legal. (b) **Stale string `choose.plusNote`: "Plus subscription is not sold on the web yet" / «Подписка Plus пока не продаётся на сайте» / «Plus obunasi hozircha saytda sotilmaydi».** It's false now and says "subscription" → remove it. (c) `err.plusViaPlay` uz «Plus obunangiz…» → «Plus ruxsatnomangiz Google Play orqali boshqariladi». Owner: Lead/Marketing. |
| 12 | Refunds | **Target (Accountant via Kai):** no refund for a change of mind on a delivered, working service; KEEP the remedy choice (fix / price cut / refund) for faulty purchases, always refund duplicate/erroneous charges, auto-reverse failed paid imports, and the refund deadline; show "no refunds for a change of mind" at checkout | Auto-reverse failed paid imports (import-refund.js:11-46, kill switch IMPORT_REFUND_LIVE_REVERSE). **Also** auto-reverse on already-failed/expired confirmations and on learner cancel after confirm (not behind the kill switch); admin manual full refund | Remedy choice + duplicate/failed always refunded + 14 calendar days + "no refund… if you simply changed your mind, except where the law requires otherwise" + "Nothing… limits your rights under consumer protection laws" | same remedy + 14 days | – | – | `help.refundA` (remedy choice; "Refunds go to the same card"); `imp.refundDue` (auto, 10 working days); `imp.paidNoResult.refund` "Ask for a refund"; `refund_requires_support` "This payment is complete. Contact support for a refund."; `payment_not_paid` "This payment cannot be refunded." | No refunds screen (N2) | **Y: POLICY CONFLICT, needs a legal check (not a text fix).** Sarvarbek 09:45 "none except failed-import reversal" conflicts with the Accountant/consumer-law rule already in the live Terms/Oferta. The Accountant's target = the current Terms. Keep them. Gaps vs target: (1) the checkout (`summary.pay` / oferta-consent) has **no "no refunds for a change of mind" line** → add en "Payments are not refunded if you simply change your mind; faulty or duplicate charges are always handled as in the Offer." ru «Если вы просто передумали, деньги не возвращаются; ошибочные и двойные списания мы всегда возвращаем по условиям оферты.» uz «Fikringiz oʻzgargani uchun pul qaytarilmaydi; xato yoki ikki marta yechilgan toʻlovlar oferta shartlari boʻyicha doim qaytariladi.» (2) "Contact support for a refund." → "This payment is complete. If something is wrong with it, contact support@gotchaa.uz." (3) "Ask for a refund" is OK only on the failed/faulty-import screen; keep it there. (4) The two extra auto-reversal paths match the "erroneous charges" target but not the 09:45 wording → Sarvarbek to confirm. Owners: Sarvarbek + Accountant/lawyer; Lead for strings. |
| 13 | **Seller details (CONFLICT)** | Law: seller name, legal form, TIN (STIR/INN), address in the offer. Earlier decision: seller shown only as "the Erkin Tizim team" | – | "the Erkin Tizim team" | "the Erkin Tizim team" (no legal form/TIN/address; 0 hits for STIR/INN) | same | footer `entity:"the Erkin Tizim team"` | – | – | **Y: CONFLICT for Sarvarbek + lawyer.** Fix: add a seller block to the Oferta and Terms: "Seller: [full legal name], [legal form, e.g. YaTT/MChJ], STIR [TIN], [registered address], support@gotchaa.uz". |
| 14 | AI / OpenAI disclosure | Disclose; consent at sign-up | Moderation fails closed; AI on for all | §AI "send OpenAI (USA) the text they need" | – | §5 full table (lookup, translation, quiz, import clean-up, TTS) | **no data-use line on the landing page** (Marketing #7) | Sign-up tick-boxes mention OpenAI (USA) | – | **Y (landing).** Add to the landing near the CTA: en "AI features send the text they need to OpenAI (USA). Your data is stored in Uzbekistan. See the Privacy Policy." ru «AI-функции передают нужный текст в OpenAI (США). Ваши данные хранятся в Узбекистане. Подробнее — в Политике конфиденциальности.» uz «AI funksiyalari kerakli matnni OpenAIʼga (AQSh) yuboradi. Maʼlumotlaringiz Oʻzbekistonda saqlanadi. Batafsil — Maxfiylik siyosatida.» Marketing. |
| 15 | Consent at sign-up | One tick-box for Terms + Privacy (+ Oferta) incl. OpenAI | One `acceptTerms` flag → consentVersion/At/IP; **no separate AI-consent record** (consent.js:6-13, auth.service.js:181-196) | – | – | "Your consent given at sign-up (the 'I agree' tick-box)", "Consent records: what you agreed to, which version and when" | – | **Two** tick-boxes: `signup-consent` (Terms/Privacy/Offer + OpenAI) and a required `signup-ai-consent` | – | **Y (minor).** The UI shows a second AI tick-box whose result is ANDed into one flag, so the Privacy wording "the 'I agree' tick-box" is slightly off. Fix: either merge into one box (matches the README decision) or store the AI consent separately and change the Privacy to "the tick-boxes". Privacy says IP is not in the consent record, but the code stores it → add "and the IP address" (the Terms already says IP). Lead + PM. |
| 16 | Delete account | Available in Settings | Password confirm; soft delete + anonymise + **immediate purge, no grace period**; keeps payments, entitlements, audit logs, consentVersion/At (users.service.js:464-560) | §16 delete any time; messages stay as "Deleted user" | – | "start deleting straight away and aim to finish within 30 days"; payment records kept as the law requires; backups overwritten ~30 days | "Settings lets you… delete your account" | `Delete account` + password (live) | Deletion requests not visible (B12) | **N/minor.** Immediate purge is within "aim to finish within 30 days". Privacy should list that **consent records and audit logs** are kept after deletion (add a row: "Consent records and security audit logs: kept after deletion as long as needed to prove consent / for security and legal claims"). PM. |
| 17 | Data residency | Eskiz, Uzbekistan | VPS on Eskiz (DevOps) | – | – | "stored on our servers in Uzbekistan, hosted by Eskiz. Backups are also kept in Uzbekistan"; only OpenAI is abroad | – (see row 14) | – | – | N. NI (DevOps): confirm the backups (/root/backups on the same VPS) are the only copy and are in UZ. Note: the dump is 72.7 MB, not the "801M" quoted earlier, and **the restore test is NOT confirmed** (settings dump). |
| 18 | Minimum age | Accepted risk: no minimum age, no parental consent | No age gate; unknown age → teen; <13 no messaging; teens friends-only (age-policy.js:10-40) | "There is **no minimum age**"; <13 messaging off; 13-17 friends only | – | Year of birth asked once, optional; minors' rules §12 | – | Birth-year prompt (optional) | – | N (accepted risk, logged). Optional: Privacy §12 could say "if you don't give your age, we treat you as 13–17". PM. |
| 19 | TTS | Built (L-feature) | **Forced ON for all users** (migrations 0039/0040, irreversible); 300/day/user; mp3 kept 30 days | lists text-to-speech | – | TTS sent to OpenAI (≤400 chars); audio kept in UZ, deleted after 30 days | "read aloud" | – | – | **Y (minor).** The 300/day TTS cap is not in the Terms "limits" → add "Text-to-speech: up to 300 requests a day" to Terms §6, or rely on "limits shown in the Service". If the Privacy says TTS can be turned off, it now can't be (forced on): NI (PM) to recheck the §5 opt-out wording ("While AI is off… text-to-speech stop working"). |
| 20 | Practice / Mashq / Daily practice | Built? | practice-engine.service.js, mashq.service.js, `/practice/daily` (401 = exists); live | "chapter quizzes" only | – | quiz passages to OpenAI | "short AI quiz" after a chapter | `use_daily_practice` "Word review now lives in Daily practice"; Mashq pages | – | **Y (docs).** FEATURES.md §D says P1 (daily practice, FSRS, XP) is "BUILT, NOT DEPLOYED", but the live API and bundle have it → update FEATURES.md (Lead). Terms §services list should add "daily practice (Mashq)". |
| 21 | Streaks / XP / streak freezes | Streaks LIVE (L16); XP and freezes = P1 | streak.service.js (Tashkent days, freezes); XP via practice-engine.service.js:311-395, daily cap 1500 | "stats and streaks" | – | – | "Reading streaks", "track daily reading streaks" | `dailyXpGoal` "Daily XP goal", XP tiers, freezes visible | – | **Y (docs).** Built in the live dist; FEATURES.md says not released → update FEATURES.md. Copy OK. |
| 22 | Spaced repetition | FSRS; copy must not say SM-2 | **FSRS** (utils/srs.js, ts-fsrs; SM-2 only if env SRS_ALGORITHM=sm2. NI DevOps: confirm the env is unset) | "spaced-repetition review" | – | – | "spaced-repetition flashcards" (6 places, OK); **"Build fluency through stories — not flashcards."** (C084) | 0 hits for SM-2 | – | **Y.** (a) FEATURES.md L11 says "SM-2" → change to "FSRS". (b) "Build fluency through stories — not flashcards." contradicts the flashcard copy and is a fluency claim → change to "Learn words from the stories you read, then review them with flashcards." Marketing. |
| 23 | Fluency claims (legacy SEO) | No unproven outcomes | – | – | – | – | ru seo.title «GOTCHA — Свободно говорите, читая по-настоящему»; uz «GOTCHA — Oʻqib, erkin gapiring»; en "see your fluency rise tier by tier"; "Everything you need for reading fluency" | – | – | **Y.** Replace them with the en H1 equivalent: ru «GOTCHA — Нажмите на незнакомое слово. Gotcha объяснит его в этом предложении.» uz «GOTCHA — Notanish soʻzni bosing. Gotcha uni oʻsha gapda tushuntiradi.» en "…and track your reading progress." (drop "fluency rise tier by tier"). Marketing. |
| 24 | Covers | Template covers (covers-01, next patch) | – | – | – | – | – | Library covers live (30 "cover" refs) | Admin upload override planned | NI (UI/UX): confirm what is live vs covers-01. No claim made → N. |
| 25 | Onboarding | Approved spec; migration 0041_onboarding_done live | `onboardingDone` (learner refs) | – | – | – | – | 17 onboarding refs in the learner | – | N. NI (UI/UX + QA): verify the flow behind login. |
| 26 | Promo codes | Not decided / not offered | Built: applied to imports and catalog (import-commerce.service.js:277-285, capped 70%); admin CRUD API (admin.controller.js:220-225) | – | **prices fixed; no promo mention** | – | – | `summary.promo` "Promo code" field + 5 promo errors | No promo UI (N15) | **Y.** A live field with no published rule. Fix: either hide the field until promos are decided, or add to the Oferta: "Promo codes, if offered, reduce the price shown before payment; total discounts never exceed 70%." Owners: Kai + Lead. |
| 27 | Support contact | support@gotchaa.uz | DB supportEmail=support@gotchaa.uz | yes | yes | yes | yes | 53 hits; 0 support@gotcha.app (the deleted-user placeholder domain `deleted.gotcha.app` is internal only) | – | N |
| 28 | Unbuilt features (IELTS, offline, leaderboard, CEFR) | Must not be claimed | – | – | "Plus does not include offline reading" | – | 0 IELTS / CEFR / Leaderboard hits | 0 hits | – | N |

## Open NEEDS INPUT
- **Lead:** set `caps.free.mashq` / `plusMashq` in the DB (row 2); `allowedFormats` meaning (6); Plus book discount (10); consent model (15); FEATURES.md updates (20-22).
- **DevOps:** SRS_ALGORITHM env (22); TTS env values (19); a real restore test (17).
- **UI/UX:** covers (24), onboarding (25), the chapter-quiz counter.
- **Marketing:** fluency titles (23), "not flashcards" (22), landing data-use line (14), "about 33% off" (11).
- **QA:** re-verify after the fixes.
- **Sarvarbek + Accountant/lawyer:** refunds (12), seller details (13), the book discount decision (10).

## DECISIONS (2 Nov 2026), to apply once read-only is lifted
- A Refunds (Sarvarbek 09:52): auto-reversal only for failed imports; the other 2 reversal paths become needs_attention for a manual refund. Use the Accountant's change-of-mind clause and add a checkout line. DECIDED.
- B Seller (Sarvarbek 09:56): "Keep only 'the Erkin Tizim team', I accept the risk". No seller details. CLOSED.
- C (Kai): Plus 50% off paid IMPORTS; fix the code to match. Catalog books are a flat 49,000 with no Plus discount and no bulk 10%/20% or per-page surcharge; remove those from the code. The Oferta stays as is for books. DECIDED.
- D (Kai): hide the promo code field. DECIDED.
- E (Kai): keep all 5 free formats; update the copy to match. DECIDED.
- Text fixes 1-10: APPROVED as written (Kai).

## QA verification (09:56-09:58, team/qa/MATRIX-VERIFY-20261102.md)
Confirmed: 2, 7, 9, 10, 11, 12, 13, 14, 23, 26. Partly confirmed: 3, 5, 15, 19-22. Row 6 can't be checked from the live site (it's in the database).
Corrections:
- Row 5: the plans API already states Plus gets 20 imports a day and 2,000 pages a month. The gap is only in the Terms, Oferta, landing page and Plus page.
- Row 15: Privacy already lists the IP address. Drop that fix.
- Row 11: also err.plusUnavailable ("Plus is not sold on the web yet.", en/ru/uz). Remove it.
- Row 12: help.refundA already has a change-of-mind line. Only the checkout line is missing.
- Row 23: also the sign-in page's "Read your way… to fluency." Replace it.

## UI/UX live quotes (team/uiux/LIVE-POLICY-QUOTES-2026-11-02.md, 46 rows), new items
- U1 Lookups: the Terms say "no fixed daily limit" plus speed protection, while the UI says "No daily limit". Align the UI with the Terms' wording.
- U2 Settings shows a Renew button to Free users. Hide it for Free.
- U3 Settings has two duplicate counters (Word lookups 20/20 and AI lookups 0/20). Merge them into one.
- U4 The landing FAQ says "imports are paid per import", which conflicts with 3 free a day / 50 pages a month. Say that only PDF/EPUB imports are paid.
- U5 Inconsistent wording: ru подсказки vs пояснения, uz soʻz qidirish vs soʻz izohi. Pick one term per language.
- U6 The uz date shows "2026 M12 1 kuni". Use the format "1-dekabr 2026".
Already covered: quizzes (row 1/2), "not sold on the web yet" (rows 8/11).

- Kai 10:05: U1-U6 APPROVED (U2 = hide Renew for Free) and bundled with fixes 1-10 plus QA's 5 corrections. Applies only after Sarvarbek lifts read-only and the Cursor code is on GitHub.

---
# SOURCE: team/qa/MATRIX-VERIFY-20261102.md
# Matrix live verify, 2 Nov 2026, 09:56–09:58 Tashkent (UTC+5). Only GET/HEAD requests, no auth.
Bundles: web /assets/index-DT06Mbbb.js, learner /learn/assets/index-DiEtSX6J.js (the same ones the matrix used). /api/v1/billing/plans and /api/v1/marketing/plans return 200; /api/billing/plans and /api/marketing/plans return 404. /terms, /oferta, /privacy ?lang=en|ru|uz all return 200, but they are the SPA shell (same title); the legal text is in the web bundle.

- 2 CONFIRMED (09:57). web.js Terms/Oferta: "up to <strong>200 quizzes per day</strong> (free accounts: up to 10)". No Mashq in the legal text. Landing: "No daily limit on Mashq (20 questions a day on Free…)". learner: lim.quiz "You've used today's chapter quizzes". Settings "Mashq: 0/20 today" (QA 09:50).
- 3 PARTLY / NOT VERIFIABLE (admin fair-use). Live copy confirmed: plans API Plus "No daily limit on word lookups (20 a day on Free)"; aiDailyQuota null.
- 5 PARTLY (09:56). Terms/Oferta/landing/learner: 0 hits for "20 imports" / "2,000 pages". BUT /api/v1/billing/plans and /marketing/plans Plus features DO state "20 free imports a day","Up to 2000 free pages of imports a month" (importLimit 20, monthlyFreePageLimit 2000).
- 6 NOT VERIFIABLE (DB allowedFormats). Live copy confirmed: FAQ "Yes. Pasted text and article links are free within the Free limits. PDF and EPUB imports … are paid per import".
- 7 CONFIRMED (09:57). Terms: "within the limits shown in the Service"; landing FAQ: "Daily limits reset at 00:00 Tashkent time." No monthly/1st rule anywhere (0 hits).
- 9 CONFIRMED (09:56). Plans API Plus features have no 50% item. Landing plusOpt "50% off every paid import"; learner plus.b2 "50% off every paid import".
- 10 CONFIRMED (copy part; the DB discount is not verifiable). Oferta: "Plus does not include offline reading, and it does not change the prices of paid books." Terms: "access to paid books" (no price).
- 11 CONFIRMED (09:57). choose.plusNote "Plus subscription is not sold on the web yet." / «Подписка Plus пока не продаётся на сайте.» / «Plus obunasi hozircha saytda sotilmaydi.»; err.plusViaPlay uz «Plus obunangiz Google Play orqali boshqariladi.»; plus.save "about 33% off". Also stale: err.plusUnavailable "Plus is not sold on the web yet."
- 12 CONFIRMED (copy part). Learner: the no-change-of-mind text is only in help.refundA ("…or if you simply change your mind, unless the law requires otherwise"). Checkout (summary.pay "Continue to payment") has no such line. refund_requires_support "This payment is complete. Contact support for a refund."; Terms/Oferta "14 calendar days".
- 13 CONFIRMED (09:57). Oferta: "The seller is <strong>the Erkin Tizim team</strong> · Email: support@gotchaa.uz". STIR/ИНН/INN: 0 hits.
- 14 CONFIRMED (09:56). Landing cta: "Start reading in a new language today" / "Build fluency through stories — not flashcards." / "Create free account". No data-use line. OpenAI appears only in the Terms/Privacy.
- 15 PARTLY (09:58). Privacy: 'Your consent given at sign-up (the "I agree" tick-box)'; two boxes in UI (QA 09:50). BUT the Privacy already mentions IP: "Consent records (sign-up tick-box version and time; the IP address is kept only while your account exists)". Terms: "We record when you accepted, which version you accepted, and your IP address."
- 19 PARTLY. Cap enforcement is NOT VERIFIABLE. Copy: 0 hits for "300" TTS in the Terms. Privacy still says "word lookup, translation, quizzes, import clean-up and text-to-speech stop working for you" (AI-off opt-out), so the opt-out wording is live.
- 20 PARTLY (FEATURES.md is not verifiable). Live: learner use_daily_practice "Word review now lives in Daily practice."; Terms services list has "chapter quizzes;" but no daily practice/Mashq.
- 21 PARTLY (docs not verifiable). Live: learner dailyXpGoal "Daily XP goal".
- 22 PARTLY (FEATURES.md/env not verifiable). Live: "Build fluency through stories — not flashcards." present; SM-2: 0 hits in either bundle.
- 23 CONFIRMED (09:56). ru seo.title "GOTCHA — Свободно говорите, читая по-настоящему"; uz "GOTCHA — Oʻqib, erkin gapiring"; en "see your fluency rise tier by tier", "Everything you need for reading fluency". Also an extra one: readYourWayBold "to fluency." (auth page).
- 26 CONFIRMED (copy part; backend not verifiable). learner summary.promo "Promo code" + promo widget; web promo_invalid "This promo code is not valid."; Oferta: 0 promo hits.

## Matrix errors found
1. Row 5: "not stated" is wrong for the API. Both plans endpoints already list "20 free imports a day" and "Up to 2000 free pages of imports a month". The gap is only the Terms, Oferta, landing and Plus page.
2. Row 15: "Privacy says IP is not in the consent record" is wrong. The Privacy consent-records row mentions the IP address (kept while the account exists).
3. Row 11: err.plusUnavailable ("Plus is not sold on the web yet", in all 3 languages) is also stale but is not listed.
4. Row 12: a no-change-of-mind line already exists in the learner help (help.refundA). It is missing only at checkout.
5. Row 23: also "Read your way … to fluency." on the auth page.

---
# SOURCE: team/qa/E2E-PUBLIC-READY-20261102.md
# Gotcha public-launch readiness — merged live e2e, 2026-11-02 (Asia/Tashkent, UTC+5)
Live e2e 2026-11-02, run 09:26–09:37 Tashkent time, stopped by the owner's no-changes order at 09:36. This merge is files-only (no network requests).
Sources: QA1 = team/qa/E2E-journeys-QA1-20261102.md; QA2 = team/qa/QA2-e2e-20261102.md; Testers = team/testers/E2E-20261102.md; PM = team/pm/PUBLIC-LAUNCH-READINESS-20261102.md; Admin = team/admin-tester/ADMIN-E2E-PRELAUNCH-20261102.md; Review = web-launch-04/REVIEW-cursor-20261102.md; Mktg = team/marketing/LAUNCH-COPY-FIXES-20261102.md.

## Test accounts
| Account | Owner | Created (Tashkent) | Deleted (Tashkent) |
|---|---|---|---|
| 250421-tak8y2+e2e1102@mail.grokbot.com (throwaway) | QA1 | 2026-11-02 09:30:25 | 09:35:47 (in-app Delete account; re-login fails) |
| 250421-tak8y2+qa2-1@mail.grokbot.com (user a8fdd061…) | QA2 | 09:28 (09:28:28) | 09:34 (09:34:42, DELETE /users/me), as QA2 reported; payment row 99c4fcdf kept (pending Plus, expiry 10:33) |
| qa-learner (vault 2228299) | QA1 | existing | not deleted |
| "QA Test final-6" (vault) | Testers | existing | not deleted |
| qa-admin (editor → temporary superadmin, approved 09:27) | Admin tester | existing | not deleted; test book a58d355d… created and deleted (140→141→140) |

## Verdict
**NO-GO** — an unreviewed build (API ad4625ad8690) runs on prod with live Atmos, page-practice quiz never loads, and advertised quiz limits don't match enforced limits.

## Issues (deduplicated)
### S1
- E2E-01 Unreviewed build on prod with live Atmos: API ad4625ad8690 / learner DiEtSX6J / admin wSGPCaUO / landing 5b5c52f, source not on GitHub or box; refund/idempotency behaviour unverifiable [QA2, Review, PM]
### S2
- E2E-02 Page-practice quiz ("Practice this page") stuck on "preparing questions" >45–60 s, uz and ru, no console error [QA1 E2E-J01, Testers #1]
- E2E-03 Advertised quiz limits wrong: copy says Free 20 Mashq / Plus no limit, API enforces 10/200 and Terms say 10/200 (landing, FAQ, API features, learner fallback) [PM #7, QA2, Mktg #1–2]
- E2E-04 Refund race: admin refund can fire a second Atmos reverse while auto-reverse is in flight; `due` → admin refund leaves inconsistent state [Review, QA2]
- E2E-05 Four August paid 500-UZS rows with Atmos id, no import, no refund; verify in Atmos cabinet (also 23b1a8d1, 068d90bd) [QA2]
- E2E-06 http://gotchaa.uz returns 500 (W-01) [QA2, PM #15]
- E2E-07 Backup restore test and uptime alert not done [PM #11]
- E2E-08 Admin regressions: Safety reports, deletion requests, plan limits, gamification, cover-mode panel missing from live admin [QA2, Review, Admin E3]
- E2E-09 Admin has no Plus management (no Plus badge/filter, expiry, grant/extend; "Change plan" Free/Premium) [Admin E1]
- E2E-10 Admin books: no template cover for new books, no cover column [Admin E2]
- E2E-11 Admin imports: ~9/40 failed in legacy ingestion table, no retry, no health summary [Admin E4, QA2]
- E2E-12 Admin payments: no reconcile/stuck view or Plus purchases list; 0-so'm free/Plus-allowance rows shown as "paid" (expected per QA2) [Admin E5, QA2]
- E2E-13 Landing/SEO copy still claims spaced repetition (feature card, JSON-LD, SEO dict), legacy streak/tier cards, data-residency line missing; refund support line and PLUS-OFFER §4 conflict with Terms [Mktg #3–8]
### S3
- E2E-14 No Dark app theme (System/Light only); reader Dark theme low contrast on headings/apostrophes [QA1 E2E-J02]
- E2E-15 Uzbek apostrophes inconsistent in book content (' ‘ ʻ); words with ‘ split into tokens → wrong lookups [QA1 E2E-J03]
- E2E-16 Reader popup briefly shows previous word while "Looking up…"; first lookup up to ~10 s [QA1 E2E-J04, Testers #7]
- E2E-17 Untranslated strings: "Mashq: 0/20 today" (uz/ru/en), "Free tarifi", "Sepia", "Mashq" on ru Plus page [QA1 E2E-J05, Testers #11]
- E2E-18 Streak shows 0 days after a completed practice (+35 XP) [QA1 E2E-J06, Testers #6]
- E2E-19 "Saved to dictionary" toast covers "Practice this page" button and persists on hover [Testers #3]
- E2E-20 Free-import counters contradict (Settings "3 of 3" and "0/3", history 1 import) [Testers #4]
- E2E-21 Sidebar "Pay as you go" does nothing; Plus reachable only by URL; logged-out /learn/app/plus → login (WLF-38) [Testers #5, Mktg]
- E2E-22 Free register card says "pay per import via Atmos", contradicting 3 free imports/day [Testers #9]
- E2E-23 Pending Plus payment 99c4fcdf must be confirmed expired with paid_at null after 10:33 (SQL Q6) [QA2]
- E2E-24 Admin: plan named "Premium" vs Plus, no Plus quiz field; unknown routes silently redirect; editor role 403s/blank Settings; Create draft no confirmation, 7 vs ~40 languages, Delete beside Publish; Overview 0% engagement and revenue mismatch [Admin E6–E9]
- E2E-25 No www→apex redirect; web HTML lacks HSTS/CSP/Referrer-Policy [PM #15–16, QA2]
- E2E-26 Settings build id shows "dev"/blank (no VITE_BUILD_SHA) [Review]
- E2E-27 Live-only migrations 0039/0040 reset every user's TTS-off choice; old-numbered p2 migrations applied out of order; CRLF checksum risk [Review]
- E2E-28 No analytics on site [PM #12]
- E2E-29 Terms/Oferta don't yet state Plus 20 imports/day and 2,000 pages/month (draft ready) [PM #8]
### S4
- E2E-30 Register consent: both ticks (Terms/Privacy/Oferta + AI) are on step 2, unticked by default — testers' "no consent checkbox" is wrong; only a step-1 visibility UX point [QA1, PM #4, Testers #8 corrected]
- E2E-31 Settings delete conflict: testers saw no Delete account, but QA1 deleted the throwaway via /learn/app/settings (possibly different account/build); data export and age/privacy controls may genuinely be missing; register asks no age [Testers #2, QA1, PM #5]
- E2E-32 Practice example sentence cut mid-word ("juhud ra") [QA1 E2E-J06]
- E2E-33 No lookup counter visible in reader (Settings only) [QA1 E2E-J07]
- E2E-34 Verify email uses straight '/‘ instead of ʻ in uz [QA1 E2E-J08]
- E2E-35 /learn/app/library redirects to /learn/app; ?ui= ignored when logged in (note) [QA1 E2E-J09]
- E2E-36 Crime and Punishment opens with Planet eBook boilerplate [Testers #10]
- E2E-37 ru Plus page: refund paragraph duplicated, heading reads as a sentence [Testers #11]
- E2E-38 en library card stretched tall; landing library strip mostly Turkish books, no uz/ru [Testers #12–13]
- E2E-39 API hardening: public gateway-status, X-Powered-By: Express, bad-signature webhook → 200, SPA soft-404 for /.env etc., 21st lookup = structured 429 [QA2, PM #16]
- E2E-40 Payment rows retained after account deletion — Legal to confirm against Privacy policy [QA2]
- E2E-41 Admin English-only; 4 Google Play import SKUs inactive, no promo codes, rate-limit keys not visible [Admin E10–E11]
- E2E-42 Landing polish: em dash in titles, static lang="en"/EN meta for every ?lang=, sitemap lacks ?lang= URLs, "33% less" in docs [Mktg P1–P4]
- E2E-43 Mail plan/VPS/domain expiry dates unknown (Eskiz panel) [PM #10]

Counts: S1 1 · S2 12 · S3 16 · S4 14 (total 43).

## Untested
- Paid imports (incl. Plus 50% discount, tier prices 12k/29k/49k/79k) and failed-paid-import auto-reverse/refunds — not tested live (owner said skip) [QA1, QA2, PM #6]
- No-double-charge check; Plus 365-day checkout; Plus checkout tick-box UI on screen (API oferta_required PASS)
- 10/day quiz cap (not reachable: bank exhausted), 4th import → paid prompt, full multi-question quiz
- Dark app theme (absent); reader/practice at 390px and in uz (testers); pasted import (testers, free limit used)
- Admin screens for learners' live state beyond the admin tester's run; worker pm2 state on VPS; support@ real send/receive
- Everything after 09:36 (run stopped by owner's no-changes order)

## Automated live checks
No 'Automated live checks' section existed in this file before the merge (file was absent at 2026-11-02 merge time); nothing to carry over.

---
# SOURCE: web-launch-04/REVIEW-cursor-20261102.md
# REVIEW — Cursor work since 31 Oct handoff (read-only) — 2 Nov 2026, ~09:35 Asia/Tashkent
Reviewer: Grok Bot for Gotcha Lead Engineer. No pushes, deploys, DB writes, POSTs or secrets. Live = unauthenticated GET only.
Evidence: `web-launch-04/review-cursor-20261102-evidence/` (probe.tsv, live.tsv, diff-live-vs-covers01.txt, scripts).

## 1. Summary
- **GitHub: nothing new.** main = 4bd684b (22 Aug), branch list identical to 31 Oct (main, backup/main-pre-20261031, 4× box/api/*, 6× box/web/*), **0 PRs** (open or closed), search for commits after 31 Oct = 0. Repo last pushed 31 Oct 16:07 UTC (21:07 Tashkent). `docs/CURSOR-HANDOFF.md` does not exist on main.
- **Box: nothing new.** Newest commit in any worktree is covers-01-r2 (31 Oct 20:40 Tashkent).
- **But LIVE has changed:** API `/api/v1/health/version` = **`ad4625ad8690` (built 2026-11-01)** — not on GitHub (422 "No commit found") and not in any box repo. Live learner (assets mtime 1 Nov 11:27 Tashkent), admin (1 Nov 09:12) and landing (**2 Nov 08:56**, build id `5b5c52f` / 2026-11-01, also not on GitHub) are all builds **from unpushed source** (most likely the laptop/Cursor workspace). The handoff said "nothing deployed after final-6" and "no push without Sarvarbek's go" — someone has deployed 3 times since, with code we can't review.
- Live is a **mix**: 6.1a features (practice, 410, plans price) + parts of covers (learner template covers) + onboarding + new admin pricing/payments/plus-settings screens — while the admin **lost** Safety Reports, Plan limits, Deletion requests, Gamification and the covers cover-mode panel versus 6.1a/covers-01. That points to a different source lineage → regressions.
- Because the live source is not available, every "present" below means *visible in the live bundle / live API*, not code-reviewed. Worker/refund items cannot be verified from outside at all.

## 2. Handoff items — status
| item | status | evidence |
|---|---|---|
| 6.1a practice endpoints | PRESENT | live GET /practice/overview, /daily, /forecast, /sessions/:id, /pages/:id/bank-status → 401 (exist) |
| 6.1a legacy redirects + 404 page | PRESENT (client) | learner bundle has /app/profile,/library,/pricing,/billing redirect map + NotFound; server returns SPA 200 (expected) |
| 6.1a birth-year card (dismissible) | PRESENT | `gotcha.agePrompt.dismissed.` localStorage key, `birthYear` optional in register |
| 6.1a build id in Settings | PARTIAL / BROKEN | code `build ${VITE_BUILD_SHA||"dev"}` present but learner env block has **no VITE_BUILD_SHA/DATE** → shows dev/blank; landing has `5b5c52f`; API ok |
| 6.1a ʻ/ʼ fix | PRESENT | `Oʻzbekcha` (U+02BB) ×4 in learner, live API copy "0 soʻm" |
| 6.1a ?ui= | PRESENT? | `/?ui=en` 200; not visually verified |
| 6.1a consent ticks incl. AI | PARTIAL | register sends `acceptTerms: m&&g` (both ticks ANDed) + `consentVersion` web-2026-10-31.4; **no separate AI field** (as in 6.1a; still deferred) |
| 6.1a same-origin returnTo | PRESENT? | `returnUrl` handling in learner (4 refs); open-redirect guard not verifiable without source |
| 6.1a 410 /marketing/landing | PRESENT | 410 `endpoint_retired` |
| 6.1a monthly free cycle | PRESENT | /billing/plans free period=month; marketing "50 free pages … a month"; admin cycle options only monthly/yearly |
| 6.1a Plus prices + visibility | PRESENT | /billing/plans premium priceMonthly 24990, priceHidden false; /marketing/plans "24 990 soʻm 30-day pass" |
| 6.1b-r2 SKIP LOCKED worker | UNVERIFIABLE | not observable via GET; ad4625a unknown — confirm on VPS that pm2 runs `gotcha-import-worker` (dist/worker.js) and old Bull `gotcha-worker` is stopped |
| 6.1b-r2 SIGTERM hand-back | UNVERIFIABLE | idem |
| 6.1b-r2 free failures not counted | UNVERIFIABLE | idem |
| 6.1b-r2 auto-reverse (successTransId + Idempotency-Key, at most once, kill switch, reverse_failed + needs_attention) | UNVERIFIABLE / PARTIAL signal | admin bundle has `needsAttention`, new `POST /admin/payments/:id/refund`; no `reverse_failed` string in admin. Atmos sandbox reverse test was still pending on 31 Oct |
| covers template (learner) | PRESENT | learner: `coverMode`, fnv1a hash, Fraunces/Literata, palette #F4ECDF/#14112B/#2107AA/#CBC3B6 |
| covers migration 0038 lossless | UNVERIFIABLE | API exposes coverMode? (learner reads `coverMode==="upload"`); migration state needs DB read-only check `_prisma_migrations` |
| covers admin panel / PATCH cover-mode | **MISSING** | admin bundle has no `cover-mode` call (covers-01 had it) |
| covers UX fixes (hero ink #14112B, no frame on images, toggle #2107AA) | PARTIAL? | colours present in bundle; frame/toggle need visual check (REVIEW-UX-covers-01.md) |
| onboarding (ONBOARDING.md) | PRESENT (new) | learner `gotcha.onboarding.done`, `data-testid=onboarding`, PATCH `{onboardingDone:true}` → **new API field (migration?)**; screenshots team/uiux/live-qa-2026-11-02/onb-*-390.png |
| admin F1–F4 | PRESENT (new) | admin calls GET/PATCH /admin/plus-settings, /admin/pricing(+plans/promos/store-products/tiers), GET /admin/payments, POST /admin/payments/:id/refund, POST /admin/users/:id/adjust-tier |
| deferred: PAY2-27 footer contrast | UNKNOWN | neither #99A1AF nor #6A7282 literal in landing bundle (Tailwind tokens); visual check |
| deferred: translations | UNKNOWN | visual QA |
| deferred: theme on reload | PRESENT? | `gotcha.appTheme` localStorage key |
| deferred: 390px | IN PROGRESS | onboarding 390 screenshots dated 2 Nov |
| deferred: Pay-as-you-go | CHANGED | live /marketing/plans has new "pay-per-import · Pay as you go" tier; learner has "Pay as you go" |
| deferred: 50-word hint | MISSING | no string found |
| deferred: AI consent field | MISSING | see above |
| deferred: admin daily option removed | DONE | admin cycle options: monthly, yearly only |
| deferred: WLF-24/18/19/22, PAY2-19 | UNKNOWN | need source |
| pre-payment URL fetch | PRESENT (new) | learner POST /imports/url/preview |

## 3. New / changed areas on live (vs covers-01 / 6.1a bundles)
New client calls: admin payments list + refund, plus-settings, pricing (plans/promos/store-products/tiers), users/:id/export, users/:id/adjust-tier; learner logout, logout-all, users/me/export, DELETE users/me/avatar, practice sessions/:id + bank-status, imports/url/preview, onboarding PATCH.
**Removed** from admin vs 6.1a: GET/PATCH /admin/safety/reports (P3c Reports + 24h SLA), /admin/plan-limits, /admin/users-deletion-requests, /admin/gamification(+achievements), /admin/content/:id/cover-mode.
Pricing copy changed: Free "20 Mashq questions a day"; Plus "No daily limit on Mashq" — but API still returns Plus quizDailyQuota=200 / Free 10 (contradiction).

## 4. Risks
**P0**
1. Unreviewed, unpushed code on prod (ad4625a, 5b5c52f, learner/admin) with payments ON (live Atmos). No git trail, no rollback point matching the handoff's backups. Get the source pushed to a branch and the deployer's notes before any further change.
2. Paid-import refund path unknown: whether 6.1b-r2 auto-reverse (Idempotency-Key, at most once) is in ad4625a is unknown; new admin manual `POST /admin/payments/:id/refund` exists → risk of **double refund** (auto + manual) or charged-for-failure if 6.1b-r2 missing. Atmos sandbox reverse test was never done.
3. Import worker: if the old Bull `gotcha-worker` is still running and the DB-queue worker absent, imports stay stuck (31 Oct bug) — and paid ones get charged.
4. Admin moderation regression: Safety Reports page gone from admin (child-safety/report SLA, Privacy/LG4 obligations); deletion-requests view gone.
**P1**
5. Migrations: onboarding (`onboardingDone`), covers 0038, possibly pricing/promos/store-products tables — unknown which migrations ran on prod; risk of lost or out-of-order migration vs box lineage (37 + 0038). Read-only `select migration_name from _prisma_migrations` needed.
6. Quota/copy mismatch: "No daily limit on Mashq" for Plus vs quizDailyQuota 200 (consumer-law/oferta exposure); Free 20 Mashq vs 10 quizzes.
7. nginx caching regression: HTML and hashed assets now have **no Cache-Control** (handoff: HTML no-store, assets immutable) → stale-build testers again.
8. Auth: new logout/logout-all and same-origin returnUrl unreviewed; AI consent still not stored separately (both ticks collapsed into acceptTerms).
**P2**
9. Build id missing in learner (VITE_BUILD_SHA not set) → can't map bundle to commit.
10. Admin covers override panel missing → no revert-to-original for covers.
11. Old landing routes (/pricing, /roadmap, /features) now 200 SPA instead of 301 (handoff r4) — SEO/duplicate content check.
12. 50-word hint, PAY2-27 contrast, translations unverified.

## 5. Live contract result (GET-only adaptation of team/qa/tools/api-contract-check.sh)
- Bundles fetched by GET: learner /learn/assets/index-DiEtSX6J.js, admin /admin/assets/index-wSGPCaUO.js, landing /assets/index-DT06Mbbb.js (single chunks each). Extracted with the team extractor: **152 client calls** (learner 91, admin 61, landing 0 — landing uses no /api/v1 wrapper).
- **55 GET calls probed live: 55 exist (401/200/410), 0 missing (no "Cannot GET" 404).**
- **97 non-GET calls (POST/PATCH/PUT/DELETE): not verifiable** — OPTIONS returns 204 for any path incl. a nonexistent one (CORS preflight), and POST was forbidden. Of these, the new ones (pricing, plus-settings, refund, adjust-tier, logout(-all), url/preview, avatar DELETE, onboarding PATCH) are not in any reviewable API.
- Verdict: **PASS for GET, INCONCLUSIVE overall.** Full check needs the ad4625a API dist run through the original local script.
- /api/v1/health/version → `{"sha":"ad4625ad8690","date":"2026-11-01"}`; /health (no /api/v1) is served by the landing SPA.

## 6. Kai's questions
**(a) Plus quiz cap 200/day.** In the newest reviewable code (6.1b-r2 c92935c): `PracticeService` → `LimitsService.reserveQuizSlot()` (services/api/src/services/limits.service.ts ~L118) — atomic `UPDATE … quiz_count < cap`, 429 `quiz_limit`; cap from `getPlanCaps()` (common/plan-caps.ts L54-55): setting **`caps.plus.quizzes`** fallback 200 (`DAILY_CAP_FALLBACKS`, packages/shared/src/dailyLimits.ts); Free `caps.free.quizzes` fallback 10. Applies to **both Plus and Free** (chapter quizzes; the FSRS practice/Mashq session routes are not behind reserveQuizSlot). **Live:** cannot be confirmed — ad4625a source unavailable; /billing/plans says premium quizDailyQuota=200, while /marketing/plans says "No daily limit on Mashq" for Plus. Treat as unverified/contradictory.
**(b) SM-2?** No — reviewable code uses **FSRS** (ts-fsrs, services/api/src/utils/srs.ts: retention 0.9, max interval 365d, fuzz, short-term steps; stability/difficulty/fsrsState/dueAt per card; due queue = `dueAt <= now` ordered asc in vocabulary.service / practice-engine). SM-2 only as rollback via env `SRS_ALGORITHM=sm2` (legacy easeFactor 2.5 fields still in schema). Live learner shows Again/Hard/Good/Easy and `dueAt`, consistent with FSRS; algorithm env on prod unknown.
**(c) Mapping.** API ad4625ad8690 → **no GitHub commit/branch, no box repo**. Landing build id 5b5c52f (2026-11-01) → not on GitHub. Learner & admin: no build id embedded (VITE_BUILD_SHA unset) → unmappable; closest lineage: learner ⊃ 6.1a + covers learner + onboarding; admin is a different lineage (has pricing/payments, lacks safety reports/cover-mode).
**LAUNCH-COPY-FIXES-20261102.md:** file **not found** anywhere under /workspace (team/marketing has no such file) — claims not checked. Send the path.

## 7. QA e2e test list (P0 first)
**Payments/refunds (P0):** Plus 30d/365d checkout price = 24 990 / 199 990 shown = charged (sandbox or Sarvarbek's own card); OTP fail/cancel no charge; paid import that fails → exactly one Atmos reverse, payment marked reversed, no second reverse on retry; kill-switch off → `due` + needs_attention; admin manual refund on an already auto-reversed payment is refused; Idempotency-Key reused; pay-per-import price shown upfront = charged; url/preview does not charge.
**Worker/imports (P0):** pm2 list shows the DB-queue worker only; queued job claimed once with 2 workers (SKIP LOCKED); SIGTERM mid-job → job returns to queue; failed free import doesn't consume the 3/day or 50 pages/month; stuck rows from 31 Oct resolved.
**Migrations (P0/P1):** read-only list of `_prisma_migrations` vs box 37+0038; covers backfill kept cover_image_key; onboardingDone column present; rollback script still valid.
**Auth (P1):** register needs both ticks; consentVersion stored; login returnUrl only same-origin /app/* (try //evil, https://evil); logout / logout-all invalidates tokens; delete account; email verify.
**Admin (P1):** Safety reports page present? (currently missing); deletion requests; plus-settings edit reflects on /billing/plans; promos; adjust-tier; user export; no 'daily' cycle.
**Learner (P1):** /app/practice loads + Mashq caps (Free 20/day?) and Plus no cap vs 200; quiz 429 copy; redirects/404 page; birth-year card dismiss; onboarding flow (level, language, tap-word demo, first book, Practice highlight, done flag) at 390px uz/ru/en; template covers card/hero/thumb, Cyrillic + oʻ titles.
**Landing/infra (P2):** ?ui=en; legal footer contrast; old routes 301; Cache-Control (HTML no-store, assets immutable); og-image; build id visible in Settings.

---
# Addendum (2 Nov, ~09:50 Tashkent): live API dist ad4625ad8690 — refunds, worker, migrations
Source: /workspace/gotcha-handoff/live-dist-ad4625a/ (compiled JS, no TS source). **sha256 verified**: e1f52319…386a matches `live-dist-ad4625a.tgz.sha256`; the tgz contents are identical to the unpacked dir; dist/build-info.json = {sha: ad4625ad8690, date: 2026-11-01}. Static review only, nothing run.

## P0-1 Admin manual refund vs auto import-refund
**Admin path:** `POST /admin/payments/:id/refund` → admin-ops.service.js `refundPayment` (L95: reason ≥3 chars, full amount only) → import-commerce.service.js `refundPaidPayment` (L598):
- Pre-checks: `status === refunded` → returns `alreadyRefunded`, no Atmos call; `status !== paid` → 409. **It does not look at `refund_state`, `refundedAt` or `needsAttention`.**
- **The claim is atomic:** `updateMany where {id, status: paid}` → `refunding`; count 0 → 409 `refund_in_progress`. Then Atmos `reverseTransaction({transactionId: reverseIdFor(tx) (= successTransId), idempotencyKey: paymentId})`. On error → back to `paid` + needsAttention. Then `finalizeRefund` (`updateMany where status=refunding` → refunded, in a transaction, revokes purchases/entitlements, writes an audit row). Concurrency cases:
  - **two admin clicks at once:** only one gets the claim → safe;
  - **admin-initiated refund still `refunding`:** `/refund/finalize` closes it once only.
- The admin's optional `Idempotency-Key` header is **only written to the audit log**. Atmos always gets **key = payment id**.

**Auto path:** import-refund.js `settleFailedImportPayment`, called from imports.service.js L550 with `importRefundReverser()` (also successTransId) and **key = payment id**. The claim is atomic too: `updateMany where {status: paid, refundState: null}` → `refundState='processing'`. **`status` stays `paid` until Atmos answers.** Then:
- success → `status=refunded, refundState=refunded, refundedAt`;
- error → `refundState='reverse_failed', needsAttention=true` and status stays `paid`.

The auto path skips anything not `paid`, so it never runs after an admin refund has started (`refunding`) or finished.

**The races:**
| order | result |
|---|---|
| admin first, then the import fails | safe: auto sees status≠paid → `not_paid` |
| auto finished (refunded), then admin | safe: `alreadyRefunded`, no Atmos call |
| **auto in flight (`refundState=processing`, status still `paid`), admin clicks** | **admin claim succeeds → a second `/merchant/pay/reverse` for the same successTransId, with the same Idempotency-Key = payment id.** If Atmos honours the key, the second call is deduped. Then auto's success write (`where refundState=processing`, no status check) flips `refunding`→`refunded`, admin's finalize gets `refund_conflict` (409) → admin sees an error, and entitlement revocation/audit from the admin path is skipped. If Atmos does **not** dedupe, it rejects the reverse ("already reversed"): the admin call fails → row goes back to paid + needsAttention while auto marks it refunded. Either way **no double money movement only if Atmos rejects/dedupes a second reverse of the same transaction**, which is unverified (sandbox reverse test never ran). |
| auto `reverse_failed` (status paid), then admin | intended manual retry. If the "failed" auto call actually reversed at Atmos (timeout after success), the admin call relies on the same Atmos dedupe/rejection |
| kill switch OFF → `refundState='due'`, then admin refund | refund works, but `refundPaidPayment`/`finalizeRefund` **never touch refund_state/refundedAt/needsAttention**. The row ends `status=refunded, refundState='due', needsAttention=true` (stuck in "needs attention"). And `prepareRetryPayment` checks `refundState==='due'` **before** `status===refunded`, so a user retry clears the mark and returns ok on an already-refunded payment. **Possible free re-import / inconsistent state; needs a test** |

**Verdict: UNSAFE (conditionally).** There is no double charge path inside our DB logic. But the admin claim ignores an in-flight auto reverse, so prevention of a double reverse rests on Atmos idempotency, which is untested. The `due` → admin refund path also leaves inconsistent state.

**Minimal fix (API only, no migration):**
1. Admin claim: `where: { id, status: paid, OR: [{ refundState: null }, { refundState: { in: ['due','reverse_failed'] } }] }` (i.e. refuse while `refundState='processing'`; return 409 `auto_refund_in_progress`).
2. In `refundPaidPayment` success / `finalizeRefund`, also set `refundState='refunded', refundedAt=now, needsAttention=false`.
3. Auto success write: `where: { id, refundState: 'processing', status: paid }` (don't overwrite an admin `refunding`).
4. `prepareRetryPayment`: check `status === refunded` first.
5. Run the Atmos sandbox test of a duplicate reverse with the same Idempotency-Key, and of an already-reversed transaction, before relying on it. Add a test for each race above (mocked Atmos).

## Worker, kill switch, reverse_failed (live dist)
- Worker: `dist/worker.js` is standalone and claims with `FOR UPDATE SKIP LOCKED` on `import_queue_jobs` (modules/imports/import-queue.js L36-43). It also has a heartbeat and a reaper. **PRESENT**. Whether pm2 actually runs it (and the old Bull worker is stopped) is still a VPS check.
- SIGTERM/SIGINT → `worker.stop()` drains up to `importWorkerDrainMs()`, then `releaseImportJob` for each in-flight job. **PRESENT** (pm2 `--kill-timeout` must be ≥ the drain time).
- Kill switch: `IMPORT_REFUND_LIVE_REVERSE` = 0/false/no/off disables auto-reverse; the default is ON, and it only applies if Atmos is configured. **PRESENT**.
- reverse_failed + needs_attention, `due` + needs_attention, and a retry clearing `due`: **PRESENT**. Not a bug: the auto path passes the raw providerPaymentId, but `importRefundReverser()` maps it to successTransId, so the reverse goes to the right transaction.
- Free failures not counted: not traced in this pass.

## Migrations: live (45 + lock file) vs box (37 + 0038)
- All 38 box migrations exist in live with **identical SQL apart from line endings** (CRLF vs LF across 0017–0038). Prisma's checksum is computed over the raw bytes, so `migrate status`/`dev` will report "modified after applied" if prod recorded the other variant. `migrate deploy` does not block on that, but check `_prisma_migrations.checksum` read-only.
- **Live-only migrations:**
  - **old-numbered, from the p2 lineage, not in box:** `0019_z_pricing_snapshot`, `0020_pricing_z_restore`, `0022_play_hardening`, `0023_refund_reconcile` (adds `import_payments.reconcile_attempts`, **no IF NOT EXISTS**);
  - **new:** `0039_mashq_page_bank` (page_questions tables, idempotency key on practice sessions, `mashq_question_count`, **and sets every `tts_enabled=false` → true**), `0040_tts_reset_on` (same data update again; owner decision 31 Oct), `0041_onboarding_done`.
- No box migration was lost. If prod had applied the box's 37 (final-6), deploying ad4625a applied the four old-numbered ones **out of order**. They are additive or idempotent, but `0020_pricing_z_restore` re-applies a snapshot of subscription_plans taken at that moment, which should be harmless. 0039 and 0040 are **irreversible data changes** (users' TTS-off choice was wiped).
- Needed (read-only): `select migration_name, finished_at, checksum from _prisma_migrations order by started_at`.

---
# SOURCE: web-launch-04/ENFORCED-POLICY-ad4625a.md
# What the LIVE API ad4625ad8690 actually enforces — 2 Nov 2026, ~10:05 Asia/Tashkent
Read-only. Source: /workspace/gotcha-handoff/live-dist-ad4625a/dist (sha256 verified, build-info ad4625ad8690 / 2026-11-01) + unauthenticated GETs to gotchaa.uz (/api/v1/billing/plans, /marketing/plans, /billing/gateway-status, /health/version). Paths below are relative to `dist/`.
**Caveat A:** `@gotcha/shared` (key names + fallbacks for Mashq, lookup burst, XP) is NOT in the dist (node_modules). Values marked "(shared, box 6.1b)" come from the box's packages/shared and may differ in the live build.
**Caveat B:** values marked **DUMP** depend on prod `platform_settings` / tables → *needs a read-only settings dump by DevOps*.

## 1. Limits and caps
| item | enforced where | setting key → default | live (GET) |
|---|---|---|---|
| Free AI word lookups/day | modules/ai/ai.service.js:206 `lookupMode` → common/plan-caps.js:40,73-84 | `caps.free.lookups` → 20 (shared) / env FREE_DAILY_LOOKUPS (common/plan-limits.js:20) | 20 (plans aiDailyQuota) — DUMP to confirm setting |
| Plus lookups | plan-caps.js:45 `plus.lookups = optionalCap(plus.ai_lookup_quota)` → **null = unlimited**; above quota → 'dictionary' mode until `plus.lookup_hard_cap` (L76-81) | `plus.ai_lookup_quota`, `plus.lookup_hard_cap` → unset | aiDailyQuota null ("No daily limit") — DUMP |
| `plus.fair_use.lookups_per_day` / `quizzes_per_day` (default 200/200) | common/plan-active.js:10-11 — **only read/edited by admin (modules/admin/admin.service.js:537-548); not enforced anywhere** | — | — |
| Chapter quizzes/day | modules/practice/practice.service.js:43 → services/limits.service.js:98-113 atomic `reserveQuizSlot` | Free `caps.free.quizzes` → 10; Plus `caps.plus.quizzes` → 200 (plan-limits.js:23,31-33; env PLUS_DAILY_QUIZZES) — **applies to Plus too** | Free 10, Plus quizDailyQuota 200 |
| Mashq questions/day (separate counter `mashq_question_count`, migr. 0039) | modules/practice/mashq.service.js:154 → limits.service.js:115-141 `reserveMashq` | Free `DAILY_CAP_KEYS.freeMashq` (shared; fallback not visible, copy says 20); Plus `plusMashq` via `optionalCap` → **null = unlimited** (plan-caps.js:42,47) | marketing copy: Free 20, Plus "No daily limit" — DUMP |
| Mashq burst | mashq.service.js:389-415 (per-minute, per-hour, max open sessions) | `MASHQ_BURST_KEYS.*` (shared; fallbacks not visible) | DUMP |
| Lookup burst | ai.service.js:252, 542-560 (DB-backed) | `lookup.burst_per_minute` 30, `lookup.burst_per_hour` 300 (shared, box 6.1b) | DUMP |
| HTTP throttles | practice.controller.js:84 (6/min), :93 (40/min); billing.controller.js:153 (20/min); auth.controller.js:148 AUTH_THROTTLE | code constants | — |
| Payment creation rate | import-commerce.service.js:46, `assertPayCreateRate` | `payments.create_per_minute` / `_per_hour` (fallbacks in PAY_CREATE_FALLBACKS) | DUMP |
| Free imports/day | import-commerce.service.js:137-157 `getFreeLimits` (setting JSON `importFreeLimits`), 205-225 `learnerAllowance`, 247-262 `quote` | `importFreeLimits.dailyFreeImportsPerUser` → 3 | 3 |
| Plus imports/day | same, `plusDailyImportsPerUser` → null (falls back to Free 3!) | DUMP | 20 (plans importLimit) |
| Pages/month | same, `monthlyFreePageLimit` → 50; Plus `plusMonthlyPageLimit` → null (falls back to 50) | DUMP | Free 50, Plus 2000 |
| Allowed free formats | `allowedFormats` → ['article','news'] (L141) | DUMP | — |
| Failed free imports | not counted (import-commerce.service.js:189-200 excludes ingestionStatus 'failed') | — | — |
| Reset cycle / timezone | daily: 00:00 Asia/Tashkent (plan-limits.js:72-86, plan-caps.js:62-65); pages: `resetCycle` monthly (stored 'daily' is read as monthly, 'yearly' honoured, L154) — 1st of month 00:00 Tashkent | `importFreeLimits.resetCycle` → monthly | "a month" |
| `IMPORTS_UNLIMITED` / gateway off → unlimited | services/limits.service.js:30-41 | env | gateway-status: paymentGatewayEnabled true, atmosConfigured true |
| Old `assertImportAllowed` | limits.service.js:53-82 → limit always null (no-op) | — | — |
| TTS | modules/ai/ai-safety.js:62-63 `TTS_DAILY_LIMIT_PER_USER` → **300/day/user** (429 TTS_DAILY_LIMIT); mp3 retention modules/ai/tts-retention.js:20 → 30 days | env | — |
| TTS default | migrations 0039 (last line) and 0040 set every `user_preferences.tts_enabled=false → true` (owner decision 31 Oct) — irreversible | — | — |
| AI moderation | ai-safety.js:67-77 fails CLOSED (503 AI_MODERATION_UNAVAILABLE); ai.service.js:129 | — | — |
| Catalog book free preview | modules/content/catalog-access.js:55 `CATALOG_TRIAL_MAX_SEGMENTS = 3` | constant | — |

## 2. Prices
| item | where | key → default | live |
|---|---|---|---|
| Plus 30-day pass (SKU `plus_pass_30`) | modules/billing/plus-pass.js:19-37 | `plus.pass.price_30_uzs` → env PLUS_PASS_30_PRICE_UZS → 24 990 | 24 990 |
| Plus 365-day pass (`plus_pass_365`) | same | `plus.pass.price_365_uzs` → 199 990 | priceYearUzs 199 990 |
| Plus enabled on web | plus-pass.js:38 env `WEB_PLUS_PASS` | env | shown |
| Trial / auto-renew | **none**: one-time passes; stacking extends expiry (plus-pass.js:57-60); reminders `PLUS_REMINDER_DAYS` 3,1,0; admin grant 7/30/365 or a custom date ≤3y (L85-98) | — | autoRenew:false, periodDays 30 |
| Plus import discount | plus-pass.js:15,42 `PLUS_DEFAULT_IMPORT_DISCOUNT_PCT=50`, clamp 0-70; applied import-commerce.service.js:279 | `plus.benefits.importDiscountPct` → **50 %** | not in plan copy — DUMP |
| Plus book discount | plus-pass.js:44 `bookDiscountPct` → 0; applied import-commerce.service.js:1366 | `plus.benefits` → 0 | DUMP |
| Total discount cap | plus-pass.js:100-104 `MAX_TOTAL_DISCOUNT_PCT=70`, never below the Atmos minimum | constant | — |
| Pay-as-you-go import price | import-commerce.service.js:226-246 `findTier` on table `import_page_tiers` (`price_usd` holds UZS), sellable ≥ Atmos min (page-tiers.js `isSellableTier`) | **table → DUMP** | "Price shown upfront" |
| Catalog book price | import-commerce.service.js ~1360-1401 (list price − Plus book % − promo, capped 70 %) | content item price → DUMP | — |
| Play SKUs | modules/billing/google-play.client.js, `/billing/play/products` (auth) | admin `store_products` → DUMP | 401 |

## 3. Promo codes
Applied to imports (import-commerce.service.js:277-285 `pricing.resolvePromo(code,userId,'imports')`, stacked after the Plus discount, capped 70 %) and catalog checkout (billing.controller.js:118). Admin CRUD: admin.controller.js:220-225 (`pricing.promo.create/update`). Codes/limits live in the DB → DUMP.

## 4. Refund paths
| path | where | kill switch / state |
|---|---|---|
| Auto-reverse of a failed paid import | modules/billing/import-refund.js:11-46, called by imports.service.js:550 | `IMPORT_REFUND_LIVE_REVERSE` (default ON; off → `refund_state='due'` + needs_attention); error → `reverse_failed` + needs_attention; key = payment id; successTransId via reverser |
| Retry after a `due` mark | import-refund.js:47-61 `prepareRetryPayment` clears `due` | — |
| **Auto-reverse when Atmos confirms a payment already failed/expired** | import-commerce.service.js:~530-533 `reverseOrFlag` | **NOT behind the kill switch** |
| **Auto-reverse when the learner cancels after Atmos confirmed** | import-commerce.service.js:~588-593 `reverseOrFlag` | **NOT behind the kill switch** |
| Paid late with no import attached | import-commerce.service.js:800-809 → only flagged (needs_attention, LATE_UNATTACHED, free retry); `LATE_UNATTACHED_REFUND_MS` 7 days (L53) | no auto reverse |
| Admin manual refund | admin-ops.service.js:95-113 → import-commerce.service.js:598-641 (full only, atomic paid→refunding, key = payment id) + /refund/finalize (admin-ops:117-146) + reconcile stale `refunding` >10 min (L673-695) | see REVIEW addendum: ignores an in-flight auto refund |
| Refund rule text | import-commerce.service.js:1543 REFUND_RULE_EN (remedy: fix / re-run / refund) | — |
**vs Sarvarbek 09:45 ("auto-reversal only for failed paid imports"): CONFLICT.** Two more automatic reversals exist (cancelled-then-confirmed and learner-cancel-after-confirm), and the kill switch does not cover them.

## 5. Consent
common/safety/consent.js:6-13: `CONSENT_VERSION='web-2026-10-31.4'` (also accepts '…31.3'). auth.service.js:181-196 stores `consentVersion, consentAt, consentIp` only when `acceptTerms===true`. **No AI-consent field**: the learner ANDs its two ticks into `acceptTerms`. Oferta version for payments: plus-pass.js `OFERTA_VERSION='oferta-2026-10-31.payments-02'` (+ migration 0035 payment oferta acceptance).

## 6. Delete account
modules/users/users.service.js:464-504. Password confirm required. **Soft delete + anonymise + immediate purge, no grace period**:
- user row kept with `email=deleted-<id>@deleted.gotcha.app`, `displayName='Deleted user'`, and passwordHash/avatar/tokens/birthYear/consentIp nulled, `deletedAt` set; refresh tokens revoked.
- purge (L520-560): imports (+ their content and files), vocabulary, known words, reading progress/sessions, practice sessions, bookmarks, placement, aiUsageDaily, notifications, friend requests, blocks, peer-message notifications, reports unlinked, target languages, preferences, avatar files. Failures go to job-health `account-purge`.
- **Kept**: payments, entitlements and audit logs (not in the purge list), plus `consentVersion/consentAt`.

## 7. Age check
common/safety/age-policy.js:10-40: age = year − birthYear − 1 (conservative). Bands: <13 under13, <18 teen, else adult; unknown → `AGE_UNKNOWN_BAND` env (default **teen**). Messaging: under13 never; teen only with friends. common/production-users.js:88-95 hides minors / under-13 from learner lists. Prompt shown if no birthYear and not yet prompted (needsAgePrompt). No hard age gate at register.

## 8. Streaks and XP
services/streak.service.js (Tashkent calendar days, `STREAK_TIMEZONE`, streak freezes `streakFreezes`); XP modules/practice/practice-engine.service.js:311-395 via shared `xpForAnswer`, daily cap `XP_RULES.dailyCap` (1500 in box shared 6.1b; anti-farming minTypingMs, maxSameItemPerDay). Values are in shared → confirm against the live build.

## 9. SRS
utils/srs.js: **FSRS** (ts-fsrs): request_retention 0.9, maximum_interval 365 d, fuzz on, short-term steps on; mastered at stability ≥ 90 d. SM-2 only if env `SRS_ALGORITHM=sm2` (DUMP env). Due queue: `dueAt <= now`, fsrsState≠0 (practice-engine.service.js:79-142).

## 10. Other setting-gated behaviour
PAYMENT_GATEWAY_ENABLED (gateway on), WEB_PLUS_PASS, IMPORT_REFUND_LIVE_REVERSE, IMPORTS_UNLIMITED / DEV_UNLIMITED_IMPORTS, TTS_DAILY_LIMIT_PER_USER, TTS retention, AGE_UNKNOWN_BAND, SRS_ALGORITHM, PLUS_REMINDER_DAYS, PLUS_BENEFITS_JSON, ATMOS min amount, and plan-caps cache 60 s. **Needs a DevOps env + platform_settings dump** (keys only; no secrets).

## 11. Comparison with team/pm/FEATURE-POLICY-MATRIX-20261102.md
**The file does not exist** (searched /workspace/gotcha-handoff, incl. team/pm, which only has privacy-policy-edits.md). The comparison cannot be done until it's provided. Conflicts already visible against live copy and decisions:
1. Plus chapter quizzes are **capped at 200/day** in code, while the copy says Plus has "No daily limit on Mashq". That's true for Mashq only (no Plus cap unless set); a chapter-quiz cap still exists. Free: chapter quizzes 10 vs Mashq 20 — two different counters.
2. Plus imports 20/day and 2000 pages hold only if `importFreeLimits.plus*` is set in the DB; the code default falls back to the Free values (3/50) → DUMP.
3. Admin's "Plus fair use 200 lookups/200 quizzes" fields are **not enforced**.
4. The 50 % Plus import discount is enforced by default but is not mentioned in the plan features.
5. Auto-reversal outside failed imports (2 paths, no kill switch) conflicts with the 09:45 decision.
6. No AI-consent field; delete keeps payment/audit data and has no grace period. Check against the privacy policy.
7. TTS forced on for all users by 0039/0040.
