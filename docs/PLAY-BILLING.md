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
| RTDN | `POST /billing/play/rtdn` (Pub/Sub push). Authenticated with a Google OIDC token (`PLAY_RTDN_AUDIENCE`, optional `PLAY_RTDN_SA_EMAIL`) or a `?token=` secret (`PLAY_RTDN_TOKEN`). The state is always re-read from the Play API. Voided, refunded, or expired purchases revoke exactly the unlock they granted. A spent import credit is flagged `needsAttention` for support |
| Client | `GET /billing/entitlements` at login (web + Android). Android `PlayBilling.syncAtLogin()` also re-sends unacknowledged purchases |

Prices can differ per platform. The Play price customers pay is set in Play Console, and `store_products.price_uzs` records it for reports. PRICING.md §6 proposes the same list price on both platforms, with Gotcha absorbing Google's ~15% fee. The alternative is about +15% on Play.

## Server env
```
PLAY_PACKAGE_NAME=app.gotcha.android
PLAY_SERVICE_ACCOUNT_JSON=/run/secrets/play-sa.json   # or the inline JSON
PLAY_RTDN_AUDIENCE=https://api.gotchaa.uz/api/v1/billing/play/rtdn
PLAY_RTDN_SA_EMAIL=play-rtdn@<gcp-project>.iam.gserviceaccount.com
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
