# Google Play Billing + unified entitlements

**Decision (Sarvarbek, 30 Oct 2026):** Android sells every digital item (imports, catalog books, Plus) through
Google Play Billing only. There is no Atmos checkout and no link or wording that sends people to web payment in the
app. The web app (gotchaa.uz) keeps Atmos. Purchases from either source unlock on every platform after login.

## How it works
| Piece | Where |
|---|---|
| SKU → unlock mapping, per-platform price | `store_products` table; Admin → Payments → Pricing → *Google Play products* (audited) |
| Unified ledger | `entitlements` (source `atmos` / `google_play` / `admin`). Access checks keep reading `user_subscriptions`, `content_purchases`, `import_payments`, which are kept in sync |
| Token verification | `POST /billing/play/verify` → Play Developer API (`purchases.products.get` / `purchases.subscriptionsv2.get`), account binding through `obfuscatedAccountId = sha256("gotcha:"+userId)`, then acknowledge (books, Plus) or consume (import credits) |
| RTDN | `POST /billing/play/rtdn` (Pub/Sub push). Authenticated with a Google OIDC token: `PLAY_RTDN_AUDIENCE` **and** `PLAY_RTDN_SA_EMAIL` (both REQUIRED; the token's `email` must match and be verified). When OIDC is configured, `?token=` is ignored. The legacy `PLAY_RTDN_TOKEN` mode is only used when no audience is set (deprecated; production refuses to boot without valid OIDC config). Messages are deduped by Pub/Sub `messageId`. The state is always re-read from the Play API; a voided notification is confirmed against `voidedpurchases.list` before anything is revoked. Voided, refunded, or expired purchases revoke exactly the unlock they granted. A spent import credit is flagged `needsAttention` for support |
| Client | `GET /billing/entitlements` at login (web + Android). Android `PlayBilling.syncAtLogin()` also re-sends unacknowledged purchases |

Prices can differ per platform. The Play price customers pay is set in Play Console, and `store_products.price_uzs` records it for reports. PRICING.md §6 proposes the same list price on both platforms, with Gotcha absorbing Google's ~15% fee. The alternative is about +15% on Play.

## Server env
```
PLAY_PACKAGE_NAME=app.gotcha.android
PLAY_SERVICE_ACCOUNT_JSON=/run/secrets/play-sa.json   # or the inline JSON
PLAY_RTDN_AUDIENCE=https://api.gotchaa.uz/api/v1/billing/play/rtdn
PLAY_RTDN_SA_EMAIL=play-rtdn@<gcp-project>.iam.gserviceaccount.com   # REQUIRED with the audience
PLAY_TOKEN_KEY=<32+ random bytes>          # REQUIRED whenever PLAY_SERVICE_ACCOUNT_JSON is set (no fallback key); AES-256-GCM for tokens at rest
PLAY_ACCOUNT_PEPPER=<random>               # optional: salts obfuscatedAccountId (set once, never change)
# PLAY_RTDN_TOKEN=<long random>  (only if OIDC push auth is not used)
```

## Play Console steps (owner account: esarvarbek135@gmail.com). Not done; do these manually
1. **Payments profile:** Play Console → Setup → Payments profile. Create or link a merchant account. Check that Uzbekistan payouts are supported; if they are not, use the company's eligible entity.
2. **Upload a build containing Billing:** upload the AAB (it includes `com.android.billingclient:billing-ktx:7.1.1`) to *Internal testing*. Products can only be created after this.
3. **One-time products** (Monetize → Products → In-app products). Product id = SKU; set the price in UZS:
   - `import_tier_<min>_<max>`: one per active page tier. The ids are already seeded *inactive* in `store_products` by migration 0021, so copy them exactly.
   - `book_<slug>`: one per paid catalog book. Add the same SKU in Admin → Pricing → Google Play products, choosing *Catalog book* and the book id.
4. **Subscription** (Monetize → Subscriptions): create product `plus_monthly` with a base plan (monthly, auto-renewing) priced in UZS. It is seeded inactive.
5. **API access:** Setup → API access. Link a Google Cloud project and create a service account. In Users & permissions, grant it *View financial data* and *Manage orders and subscriptions*. Download the JSON key and store it as the `PLAY_SERVICE_ACCOUNT_JSON` secret on the server.
6. **RTDN:** in that GCP project, create a Pub/Sub topic `play-rtdn`. Grant `google-play-developer-notifications@system.gserviceaccount.com` the *Pub/Sub Publisher* role on it. Then create a **push** subscription to `https://api.gotchaa.uz/api/v1/billing/play/rtdn` with authentication on: service account = `PLAY_RTDN_SA_EMAIL`, audience = `PLAY_RTDN_AUDIENCE`. In Play Console → Monetization setup, set the topic and click *Send test notification*. The API responds 204.
7. **License testers:** Setup → License testing. Add tester Gmail accounts so test purchases aren't charged.
8. **Activate SKUs:** after each product is *Active* in Play Console, turn it on in Admin → Pricing → Google Play products.
9. **Data safety form:** declare *Purchase history* (collected) and answer *Contains in-app purchases* = Yes. Card data never touches the app; Google handles it.
10. **Listing and app copy:** no mention of web prices or of paying on the website (Play payments policy).

## Not covered yet
- A Plus paywall screen on Android. `PlayBilling.buyPlus()` is ready, but no screen sells Plus because it isn't marketed yet (GTM §0).
- Play Console products themselves (steps above).
- A real end-to-end purchase (needs steps 1–7 and a signed internal-testing build).


## Background jobs and the 3-day rule

Google refunds any purchase that isn't acknowledged (subscriptions, books) or consumed (import tiers) within **3 days**.
`PlayBillingService.runJobs()` runs every 15 minutes in the API process:

- retries ack/consume for purchases younger than 3 days that still aren't settled;
- logs `ALERT` at ERROR level for any still unsettled after 48 h (wire this to alerting);
- re-reads subscriptions expiring in the next 24 h (at most every 6 h per row); `GET /billing/entitlements` also re-reads lapsed Play subscriptions (at most hourly) before reporting them as expired;
- purges RTDN message ids older than 7 days.

Subscription states: ACTIVE, IN_GRACE_PERIOD and CANCELED (until expiry) grant Plus; ON_HOLD and PAUSED do not.

Import tiers: a Play import purchase can be verified without a quote (e.g. recovered at login). It becomes an unused credit for its page tier and covers any import whose tier's maxPages is ≤ the bought tier's. A credit that is too small is kept (`credit_too_small`), never voided.

## Rolling back

Before rolling back migration 0021 (Play tables), `pg_dump` `play_purchases`, `store_products` and `entitlements`: the down migration drops them and the purchase history cannot be rebuilt otherwise. 0020's down migration restores plan values from `subscription_plans_backup_0020`.

## p2c changes

- **Play Billing Library 9.1.0** (`billing-ktx`), Kotlin 2.2.10 (PBL 8+ ships Kotlin 2.2 metadata). `enableAutoServiceReconnection()`; product details come from `QueryProductDetailsResult` (unfetched products are reported, not silently missing); one-time prices/offers use `oneTimePurchaseOfferDetailsList`.
- Purchase-flow decisions (response codes, verify status, resync filter, credit reuse, base-plan offer, resume debounce) live in `PlayPurchaseLogic` and are unit-tested (`PlayPurchaseLogicTest`).
- Resume sync: only unacknowledged purchases and owned import consumables are re-verified, at most every 5 minutes.
- Unconfirmed voids answer 503 (Pub/Sub retries) and the 15-min job sweeps `voidedpurchases` as a backstop.
- Existing plaintext tokens: run `npx ts-node --transpile-only scripts/backfill-play-tokens.ts` once after setting `PLAY_TOKEN_KEY`.
- Debug builds can target a test API: `./gradlew assembleDebug -PapiBaseUrl=http://10.0.2.2:3000/api/v1/` (or `GOTCHA_API_BASE_URL`); cleartext is allowed only in debug.
