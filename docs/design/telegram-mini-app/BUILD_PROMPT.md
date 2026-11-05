# Gotcha — Telegram Mini App, Telegram auth, referral program

You are building this in `C:\projects\GOTCHA_android app`. The design is final and approved. It is in `docs/design/telegram-mini-app/`: open `index.html` in a browser. Every screen is plain HTML with inline styles, and those values (sizes, colors, radii, copy) are the spec. Match them exactly. Do not add features that are not in the design, and do not leave out ones that are.

Stack, as already in the repo:
- Learner web app: `apps/web-learner` (React 19, Vite, Tailwind v4 `--g-*` tokens, react-router v7, sonner).
- API: `services/api` (NestJS, Prisma).
- Shared copy: `packages/shared`.

Keep all existing logic and API behaviour working. Website users must notice nothing except the new login, register and referral parts.

Work in 4 phases. Each phase is one branch and one PR, with tests. Do not start the next phase until the current one's checks pass. Deploy only after the PR is reviewed.

---

## Global rules

- **Prices and limits** always come from the API. Never hardcode them.
  - Plus: 24 990 soʻm / 30 days and 199 990 soʻm / 365 days, from `plus.pass.price_*`.
  - Import page tiers: 12 000, 29 000, 49 000 and 79 000 soʻm.
  - Free limits: 20 lookups a day, 20 Mashq questions a day, 3 imports a day, 50 pages a month.
- **Payments** are Atmos only (Uzcard / Humo card, then SMS code), the same flow as the website. **No Telegram Stars.**
- **UI languages:** uz, ru and en for every new string. Uzbek uses Latin script with ʻ (U+02BB). The design copy is the uz source; write natural ru and en versions.
- **Telegram header:** the bar "Yopish · Gotcha · mini ilova" in the mockups is Telegram's own header. **Do not build it.** Use `Telegram.WebApp.BackButton` on sub-screens.
- **Accessibility:** touch targets at least 44px, real `<button>`/`<a>`/`<input>`, and `aria-label` on icon-only buttons.
- **Secrets:** never log codes, tokens, initData or phone numbers in plain text.

---

## Phase 1 — API: Telegram bot and Telegram auth (`services/api`)

### Environment variables

| Variable | What it holds |
|---|---|
| `TELEGRAM_BOT_TOKEN` | The bot's token |
| `TELEGRAM_BOT_USERNAME` | The bot's username |
| `TELEGRAM_WEBHOOK_SECRET` | Secret checked on every webhook call |
| `TELEGRAM_MINI_APP_URL` | `https://gotchaa.uz/tg` |

Document all four in `.env.example`.

### Prisma (one migration)

- **User:** add
  - `phone String? @unique` (E.164, e.g. `+998901234567`)
  - `phoneVerifiedAt DateTime?`
  - `telegramId BigInt? @unique`
  - `telegramUsername String?`

  Email stays as it is. A user may have an email, a phone, or both. Every user has one password.
- **`TelegramLoginChallenge`:**
  - `id`, `userId`, `kind` (`code` | `link`)
  - `codeHash?`, `token?` (unique)
  - `status` (`pending` | `approved` | `denied` | `expired` | `used`)
  - `attempts Int @default(0)`, `userAgent`, `ip`, `expiresAt`, `createdAt`
- **`TelegramPendingSignup`:**
  - `telegramId` (unique), `phone?`, `phoneSharedAt?`
  - `firstName`, `lastName`, `startParam?`, `createdAt`
- **`ReferralCode`:** `userId` (unique), `code` (unique, uppercase, 4–16 characters, defaulting to the first name; add a numeric suffix when taken).
- **`Referral`:**
  - `id`, `referrerId`, `refereeId` (unique), `code`, `source` (`web` | `telegram`)
  - `status` (`registered` | `rewarded` | `void`)
  - `rewardPaymentId?`, `rewardedAt?`, `createdAt`
- **platform_settings** (admin-editable): `referral.friend_discount_pct` = 20, `referral.referrer_reward_days` = 30, `referral.max_rewards_per_year` = 12, `referral.enabled` = true.

### Bot (`modules/telegram`, grammY, webhook)

- **Webhook:** `POST /api/v1/telegram/webhook`. Verify the `X-Telegram-Bot-Api-Secret-Token` header. On deploy, register the webhook and set the chat Menu Button to a web_app button labelled "Ochish" that opens `TELEGRAM_MINI_APP_URL`.
- **`/start`** (screen 01): send the welcome card. The image is the "quietly" reader preview, followed by the text shown in the design. Add two inline web_app buttons: "Roʻyxatdan oʻtish" (opens `/tg/signup`) and "Hisobim bor" (opens `/tg/login`). If this Telegram user is already linked, send one "Ochish" button instead.
- **`/start` with a parameter:**
  - `r_<CODE>`: store it as `startParam` on the TelegramPendingSignup, then behave like `/start`.
  - `login_<token>`: send the confirm card (screen 05, second message). It shows the account name and the device parsed from the challenge's userAgent, with the buttons "Tasdiqlash" and "Bu men emasman". If the Telegram user is not linked, say so and show the "Roʻyxatdan oʻtish" button.
  - `signup`: same as `/start`.
- **Contact messages:** accept a contact only if `contact.user_id === from.id`. Then normalise the number to E.164 and save it to TelegramPendingSignup.phone and phoneSharedAt. If the number already belongs to another user, reply in uz/ru/en that the number is already registered, and add a "Hisobim bor" button.
- **Notifications** (screen 19): when a user has a `telegramId` and `notificationsEnabled`, send the existing notification kinds through the bot as well.
  - **Text:** build it with `packages/shared/notificationCopy` in the user's UI language.
  - **Kinds:** content (new book), goal, vocab, message and streak. No others.
  - **Buttons:** one web_app button per message, deep-linking via the `startapp` param.

    | Kind | Button | Opens |
    |---|---|---|
    | content | "Oʻqish" | the book |
    | goal | "Oʻqishni davom ettirish" | the reading in progress |
    | vocab | "Mashqni boshlash" | Mashq |
    | message | "Javob berish" | the chat |
    | streak | "Oʻqishni davom ettirish" | the reading in progress |

  - **Rate limit:** at most 3 bot messages per user per day, never between 22:00 and 08:00 Asia/Tashkent.
  - **Blocked bot:** when the user blocks the bot (403), stop sending.
- **Tests:** webhook secret check; `contact.user_id` mismatch rejected; `/start login_<token>` approve and deny.

### Auth endpoints

- **`POST /auth/telegram/session`** `{ initData }`
  - Validate initData with HMAC-SHA256 (secret key = HMAC("WebAppData", bot token)) and reject if `auth_date` is older than 24 hours. This check is used for every Telegram endpoint.
  - Linked user: return the normal access and refresh tokens.
  - Otherwise: `{ needsSignup: true, prefill: { fullName }, phone: <masked or null> }`.
- **`GET /auth/telegram/contact`** `{ initData }` → `{ phone: masked, verified: true }` once the bot has received the contact. The mini app polls this every 1.5 s for up to 60 s after calling `WebApp.requestContact()`. Never trust the client callback's `responseUnsafe`.
- **`POST /auth/telegram/register`**
  - **Body:** `{ initData, fullName, password, nativeLanguage, targetLanguages[], birthYear?, acceptTerms, acceptAi }`.
  - **Rules:** the phone must already be verified in TelegramPendingSignup. Reuse the existing register validation (password at least 8, consents required, `SignupSafetyFields` rules).
  - **Creates:** a user with `phone`, `phoneVerifiedAt`, `telegramId` and `telegramUsername`, and no email.
  - **Referral:** attach it from `startParam`. Then delete the pending row and return tokens.
- **`POST /auth/telegram/link`** `{ initData, identifier, password }` (screen 04)
  - Sign in with an email or phone plus the password, then set telegramId on that user.
  - If that Telegram ID is linked to someone else, return 409.
  - Return tokens.
- **Website login:** change `POST /auth/login` to take `{ identifier, password }` and keep accepting `email` for backwards compatibility.
  - Identifier is an email: unchanged.
  - Identifier is a phone (normalise `+998`, spaces and dashes): find the user by phone. If that user has a `telegramId`, do not return tokens. Create a `code` challenge with a 6-digit code (bcrypt or sha256 + pepper, TTL 5 min), send it through the bot (screen 05, first message), and return `{ step: 'telegram_code', challengeId, maskedPhone: '+998 90 *** ** 67' }`.
  - Wrong password: same error as today. Do not reveal whether the phone exists.
- **`POST /auth/login/telegram-code`** `{ challengeId, code }`
  - At most 5 attempts, then the challenge expires.
  - On success, return tokens and mark the challenge `used`.
  - **Resend:** `POST /auth/login/telegram-code/resend`, at most once every 60 s.
  - **"Bu men emasman"** in the bot sets `denied`. Notify the user in the bot that the password may be known to someone else, and add a "Parolni oʻzgartirish" button.
- **"Telegram botdan davom etish" on the website:**
  - **Create:** `POST /auth/telegram/login-link` creates a `link` challenge with a random 32-byte token and TTL 5 min. It returns `{ token, deepLink: https://t.me/<bot>?start=login_<token> }`.
  - **Poll:** the website calls `GET /auth/telegram/login-link/:token` every 2 s. It returns `pending`, `approved`, `denied` or `expired`.
  - **Exchange:** on `approved`, the website calls `POST /auth/telegram/login-link/:token/exchange` once and gets tokens.
- **Forgot password for phone accounts:** send the reset code through the bot (the same code challenge with `kind=code`, purpose reset). Email accounts keep the email flow.
- **Profile:** expose `phone` (masked) and `hasEmail` on `/users/me`. Users can add or verify an email later in Settings (the existing email verification).
- **Tests:** initData validation (valid, tampered, expired); phone uniqueness; the code challenge (ok, wrong ×5, expired, resend cooldown); the link challenge (approve, deny, expire, exchange once); email login unchanged.

### Referral backend

- **Codes:** `GET /referrals/me` creates the code lazily. It returns:
  - `code`, `webLink` (`https://gotchaa.uz/r/<CODE>`) and `telegramLink` (`https://t.me/<bot>?start=r_<CODE>`)
  - `invited`, `paid` and `daysEarned`
  - `friends: [{ name: "Aziz R.", date, status }]`, where the name is the first name plus the last initial.
- **Capture:**
  - The website route `/r/:code` sets cookie `gotcha_ref` (30 days, SameSite=Lax) and redirects to `/register?ref=CODE`.
  - The website register sends `referralCode`; Telegram register takes it from `startParam`.
  - Attach a referral only for brand-new accounts. Ignore self-referral (same user, or same phone or Telegram ID as the referrer).
- **Friend discount:** on the referee's first Plus checkout, apply `friend_discount_pct` server-side in the quote, shown as a line "Taklif chegirmasi −20%". It does not stack with a promo code; the larger discount wins. Show the discounted total everywhere the price is shown.
- **Reward:** when the Atmos webhook marks the referee's first Plus payment as paid:
  - **Extend:** add `referrer_reward_days` to the referrer's Plus with the existing `extendedEnd` logic, set `status=rewarded`, and respect `max_rewards_per_year`.
  - **Notify:** add a new in-app notification kind `referral` ("Doʻstingiz Plus oldi — sizga +30 kun Plus qoʻshildi"), also sent through the bot.
  - **Refund:** mark the referral `void`. Do not remove days automatically; log it for admin.
- **Tests:** capture by cookie and by start param; self-referral ignored; discount applied once only; reward granted once; the yearly cap.

---

## Phase 2 — Mini app UI (`apps/web-learner`, route `/tg`)

Build it inside `apps/web-learner` so it reuses `lib/api`, copy, hooks and page logic. Add `TelegramApp.tsx`, mounted at `/tg/*`. Load `https://telegram.org/js/telegram-web-app.js` only for `/tg`. On start:
- call `WebApp.ready()`, `expand()` and `disableVerticalSwipes()`;
- set the header and background colors from the theme;
- follow `themeParams` and `colorScheme`; the dark tokens are on screen 20;
- respect `contentSafeAreaInset` and `safeAreaInset`.

If the app is opened outside Telegram (no initData), show a page saying "Telegramda oching" with a button that opens the bot.

**Session:** on load, call `/auth/telegram/session`. Linked users go to `/tg` (Kutubxona); others go to `/tg/signup`. Store tokens the same way the website does.

### Floating tab bar (screens 06, 08, 09, 11, 15)

- **Shape:** `position: fixed; left: 12px; right: 12px; bottom: 14px + safe-area`; height 68, padding 6, radius 34.
- **Light theme:** background `#fff`, border `1px solid #e4e7ef`, shadow `0 14px 34px -12px rgba(16,24,40,.32)`.
- **Dark theme** (screen 20): background `#1c2733`, border `#2b3a4b`.
- **Tabs:** 5 equal tabs, each with a 23px stroke icon and an 11px label.
  - Active tab: a pill with radius 28; light background `#ecebff` with text `#2107AA` at weight 700; dark background `#2e2a5c` with text `#cfc8ff`.
  - Inactive tab: `#5d6475` (dark `#9aa9b8`).
  - Mashq shows an orange badge with the due count (`#ea580c`).
- **Order:** Kutubxona, Lugʻat, Mashq, Yuklash, Profil.
- **Visibility:** hidden on the reader, the Mashq session, payment, sign-up and login. Scrollable pages need `padding-bottom: 96px + safe-area`.
- **Haptics:** `HapticFeedback.selectionChanged()` on tab change, and `notificationOccurred` on Mashq answers.

### Screens

Use these files as the spec, with the existing hooks and endpoints.

| # | Screen | What to build |
|---|---|---|
| 02 | Sign-up step 1 | Full name prefilled from Telegram. The phone row starts as a button "Telegram raqamini ulashish", which calls `requestContact()` and polls `/auth/telegram/contact`. Once verified it shows the green row "Telegramdan" and the note. Then the password with eye toggle and the rule hint. Stepper: Hisob, Tillar. |
| 03 | Sign-up step 2 | Native language select (default from Telegram `language_code`, else uz), target-language chips (multi), optional birth year, the two existing consent texts verbatim (`signupConsent.ts`), and the button "Bepul hisob yaratish". |
| 04 | Existing account | Email or phone plus password, "Parolni unutdingizmi?", then the `/auth/telegram/link` call. |
| 06 | Kutubxona | Greeting, streak pill (opens Stats), bell (opens Notifications), daily goal card, continue reading, tabs Hammasi / Badiiy / Yangiliklar / Importlar (the existing KindFilter), recommended grid. |
| 07 | Reader | Existing reader logic. The word sheet slides up from the bottom (`dvh` aware) and shows: word, IPA, audio, translation, explanation, context, "Bilaman" / "Lugʻatga qoʻshish", and the remaining free lookups line. TTS and Aa buttons work as on the website. |
| 08 | Lugʻat | Stats strip, search, status chips, rows with strength bars, and a bottom button "Mashqda takrorlash · N" above the tab bar. |
| 09–10 | Mashq | Existing DailyPractice logic: XP ring, session length (5/10/20), forecast, chapter quizzes, the question screen with the feedback bar. |
| 11 | Yuklash | URL / Matn / Fayl tabs, quota pills, book-import price tiers (from the API), recent imports. |
| 12 | Statistika | 7 kun / 30 kun, the 4 KPIs, daily minutes chart, languages. |
| 13 | Bildirishnomalar | The existing NotificationsPage logic. |
| 14 | Xabarlar | The existing MessagesPage logic (inbox search, language tabs, tap a message to translate). |
| 15 | Profil | Plus card, "Hisob va parol", "Doʻstlarni taklif qilish" (opens 21), Statistika, Xabarlar, Toʻlovlar, "Tillar va kunlik maqsad", the notifications switch (`notificationsEnabled`; the subtitle says they arrive through the bot), Mavzu = follows Telegram, Yordam (mailto support), Chiqish. |
| 16–18 | Plus, payment, history | The existing PlusPage, CardForm and PaymentsPage logic, restyled. 16 is Plus, 17 the card step of offer → card → SMS, 18 the payment history. |
| 21 | Referral | Hero, the personal t.me link with "Nusxa" (`navigator.clipboard`, toast "Nusxa olindi"), stats, friends, and the button "Doʻstlarga yuborish". The button calls `WebApp.openTelegramLink('https://t.me/share/url?url=<telegramLink>&text=<uz text>')`. |

---

## Phase 3 — Website auth changes (`AuthPage`, `AuthShell`)

- **Login (screen 22):**
  - **Field:** "Email yoki telefon raqam". Detect a phone with a regex, and show a phone-friendly keyboard hint on mobile.
  - **Buttons:** "Kirish" first. Directly below, at the same width and height (48px, radius 12), comes "Telegram botdan davom etish": background `#f2f8fd`, border `#cfe3f4`, text `#1d5f96`, and a round `#2481cc` icon with the Telegram plane.
  - **"Hisobingiz yoʻqmi?"** sits below a divider.
- **When login returns `step: 'telegram_code'`:** show screen 23 in the same card shell.
  - **Card:** a 6-box code input with auto-advance and paste support, the "Tasdiqlash" button, "Telegramda botni ochish" (a deep link to the bot), and "Qayta yuborish · 0:42" with the 60 s cooldown.
  - **Errors:** wrong code shows "Kod notoʻgʻri", expired shows "Kod muddati tugadi — qayta yuboring".
- **"Telegram botdan davom etish":**
  - Call `/auth/telegram/login-link` and open the deep link in a new tab.
  - Swap the card to a waiting state: spinner, "Telegramda tasdiqlang", a "Bekor qilish" button, and polling.
  - On `approved`, exchange for tokens and continue to the app. On `denied` or `expired`, show the message and let the user try again.
- **Register (screen 24):**
  - **Fields:** unchanged (full name, email, password, then step 2).
  - **Telegram button:** under "Davom etish", the same style as on login, labelled "Telegram bot orqali roʻyxatdan oʻtish" (deep link `start=signup`, plus `r_CODE` when a ref is present). Helper line below it: "Telegramda raqamingiz bir bosishda tasdiqlanadi."
  - **Referral banner:** when `?ref=` or the `gotcha_ref` cookie is present, show "<Name> sizni taklif qildi. Birinchi Plus xaridingizga 20% chegirma avtomatik qoʻllanadi." Resolve the name with `GET /referrals/resolve/:code` (public, first name only). Send `referralCode` with register.
- Keep every existing test passing. Update tests that check login payload shape (WL4-07 order and similar) only where the payload changed.

---

## Phase 4 — Website referral UI

- **Route:** `/app/referral` (screen 25), inside LearnerShell.
  - **Content:** title, dark hero with the link field, "Nusxa olish", "Telegramda ulashish" (t.me/share link) and the code; 3 stat tiles; friends table (scrolls inside its own box on mobile).
  - **Sidebar:** add "Doʻstlarni taklif qilish" to the account menu.
- **Sidebar card** in the LearnerShell bottom slot, above Sozlamalar. Show it when `referral.enabled`; the pay-as-you-go card shows only when the referral feature is off. The card must **work**, not just link:
  - It shows the user's real link from `/referrals/me` (cached for 5 min) and the "N doʻst Plus oldi" count.
  - "Nusxa" copies the link and shows a toast. "Batafsil" opens `/app/referral`.
  - **Collapsed sidebar:** a gift icon button that copies the link (tooltip "Havolani nusxalash") and shows the toast.
- **Plus triggers:**
  - **PlusPage:** under the plans, add "Yoki doʻstlarni taklif qiling — har biri uchun +30 kun Plus →" linking to `/app/referral`.
  - **Daily-limit paywalls** (lookups and Mashq): add the same secondary link under the existing Plus CTA.
  - **Friend discount:** a referee who has not bought Plus yet sees the discount as a line on PlusPage and in the checkout summary.
- **Admin** (if there is an admin settings page): expose the 4 `referral.*` settings.

---

## Definition of done (all phases)

- `tsc --noEmit` passes for web-learner and the API.
- `node --test apps/web-learner/tests/*.test.mjs` (run from `apps/web-learner`) passes.
- The API test suite and the new tests pass.
- Manual run in Telegram (test bot, BotFather test environment or a staging bot):
  - `/start` → sign-up with contact share → Kutubxona.
  - Notifications arrive in the bot.
  - Website login with that phone → code arrives in the bot → logged in.
  - "Telegram botdan davom etish" → confirm in the bot → logged in.
  - Referral link → new account → buys Plus (Atmos test card) → the referrer gets +30 days and a bot message.
- Both light and dark Telegram themes are checked on Android and iOS Telegram, and on Telegram Desktop.
- Report for each phase: PR link, what was tested, and screenshots of every screen next to the design file.
