# Atmos Merchant API Integration (Gotcha)

Local card payments (UzCard, Humo, Visa, Mastercard) for **import-by-size** via Atmos Merchant API.

## API Flow (Merchant API — NOT Hosted Checkout)

The integration uses the official Atmos Merchant API methods:

1. **Create Transaction** (`POST /merchant/pay/create`) — creates a draft transaction
2. **Pre-confirm Transaction** (`POST /merchant/pay/pre-apply`) — sends OTP to cardholder
3. **Confirm Transaction** (`POST /merchant/pay/apply`) — confirms with OTP, debits card
4. **Get Transaction Info** (`POST /merchant/pay/get`) — check status
5. **Cancel Transaction** (`POST /merchant/pay/reverse`) — refund/cancel

**We do NOT use the Hosted Checkout** (`/checkout/invoice/create`, `checkout.pays.uz`) as it times out.

## User Flow

1. User sees price modal in Gotcha (UZS amount)
2. User clicks "Purchase" → checkout creates Atmos transaction
3. User enters card number + expiry in Gotcha modal
4. Backend calls `/merchant/pay/pre-apply` → Atmos sends OTP SMS to cardholder
5. User enters OTP in Gotcha modal
6. Backend calls `/merchant/pay/apply` → payment confirmed
7. Import proceeds

## URLs (production — `gotchaa.uz`)

| Purpose | URL |
|--------|-----|
| Atmos callback (webhook) | `https://gotchaa.uz/api/v1/billing/atmos/webhook` |
| API | `https://gotchaa.uz/api/v1` |

Give Atmos the **callback URL** so they can POST payment confirmations.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/billing/imports/quote` | Get price quote |
| POST | `/billing/imports/checkout` | Create transaction (step=card) |
| POST | `/billing/imports/payments/:id/pre-apply` | Submit card, trigger OTP |
| POST | `/billing/imports/payments/:id/apply` | Submit OTP, confirm payment |
| POST | `/billing/imports/payments/:id/retry-otp` | Resend OTP |
| POST | `/billing/imports/payments/:id/cancel` | Cancel/refund |
| GET | `/billing/imports/payments/:id` | Get payment status |
| POST | `/billing/atmos/webhook` | Atmos callback (public) |

## Env (`deploy/.env` — never commit secrets)

```bash
ATMOS_CONSUMER_KEY=…
ATMOS_CONSUMER_SECRET=…
ATMOS_STORE_ID=…
ATMOS_API_KEY=…              # callback MD5 key (when Atmos provides it)
ATMOS_API_BASE=https://apigw.atmos.uz
ATMOS_IKPU=10899001001000000
ATMOS_MIN_AMOUNT_SOM=500
ATMOS_MERCHANT_TIN=…         # YaTT PINFL for OFD
# ATMOS_TERMINAL_ID=…        # DO NOT SET for store 100696 — sending terminal_id on create returns STPIMS-ERR-103; Atmos auto-selects terminal 101157 when omitted.
# ATMOS_LANG=ru

# Keep false until sandbox E2E works:
PAYMENT_GATEWAY_ENABLED=false
IMPORTS_UNLIMITED=true
```

When ready to charge for real:

```bash
PAYMENT_GATEWAY_ENABLED=true
IMPORTS_UNLIMITED=false
```

Then redeploy / run `deploy/update.sh` so runtime `.env` syncs.

## Pricing

- Admin → **Import & Pricing** → **Page Tiers** (amounts in **UZS / soʻm**)
- Prices below **500 soʻm** (Atmos minimum) cannot be saved — validation runs in admin only
- Free pool: **Free Limits** (daily imports, monthly pages, allowed formats)
- Atmos amount = UZS × 100 (**tiyins**)
- OFD line uses `ATMOS_IKPU`
- Optional: `ATMOS_MIN_AMOUNT_SOM=500` (default 500 soʻm)

## Live Deployment Checklist

Before payments work in production, complete all steps:

### 1. Atmos Merchant Setup (one-time)
- [ ] Obtain merchant credentials from Atmos: `ATMOS_CONSUMER_KEY`, `ATMOS_CONSUMER_SECRET`, `ATMOS_STORE_ID`
- [ ] **Ensure Merchant Pay API is enabled** for your store (not just Hosted Checkout)
- [ ] Register callback URL with Atmos: `https://YOUR_DOMAIN/api/v1/billing/atmos/webhook`
- [ ] Obtain callback MD5 key (`ATMOS_API_KEY`) when Atmos issues it
- [ ] Confirm IKPU code with your accountant (`ATMOS_IKPU`)
- [ ] Obtain YaTT/PINFL for OFD receipts (`ATMOS_MERCHANT_TIN`)

### 2. Server Configuration (`deploy/.env`)
```bash
# Fill these with real Atmos credentials
ATMOS_CONSUMER_KEY=your_key_here
ATMOS_CONSUMER_SECRET=your_secret_here
ATMOS_STORE_ID=your_store_id
ATMOS_API_KEY=your_callback_key    # optional until Atmos provides it
ATMOS_API_BASE=https://apigw.atmos.uz
ATMOS_IKPU=10899001001000000
ATMOS_MERCHANT_TIN=your_tin

# Enable payment gateway (CRITICAL — both must be set)
PAYMENT_GATEWAY_ENABLED=true
IMPORTS_UNLIMITED=false
```

### 3. Deploy & Verify
- [ ] Run `npm run deploy:vps:env` to regenerate `deploy/.env` (preserves existing credentials)
- [ ] Run `npm run deploy:vps` or `deploy/update.sh` on VPS to sync runtime env
- [ ] Verify admin panel: Admin → Import & Pricing shows "Gateway: enabled" badge
- [ ] Verify `GET /billing/gateway-status` returns `flow: "merchant-api"`

### 4. Configure Pricing (Admin Panel)
- [ ] Admin → **Import & Pricing** → **Page Tiers** — set prices in UZS (soʻm)
- [ ] Admin → **Import & Pricing** → **Free Limits** — configure daily/monthly free allowances

### 5. Test End-to-End
- [ ] As learner, exceed free allowance or import a large PDF
- [ ] Confirm card input modal appears with card number + expiry fields
- [ ] Enter card number + expiry → OTP should arrive via SMS (or use sandbox OTP below)
- [ ] Enter OTP → payment confirms
- [ ] Confirm import proceeds after payment
- [ ] Check OFD/fiscal receipt (if IKPU/TIN are set)

**Sandbox (confirm PAN/OTP with Atmos for your test store):**

| Field | Example |
|-------|---------|
| Card | `5614 6819 0687 2829` |
| Expiry | `03/30` (MM/YY) |
| SMS OTP | `111111` |

Flow: **Purchase** → card + expiry → **Continue** → **Enter SMS Code** → OTP → **Confirm Payment** → import runs.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Imports are free right now" on Import page | `PAYMENT_GATEWAY_ENABLED=false` or `IMPORTS_UNLIMITED=true` | Set both flags correctly in `deploy/.env`, redeploy |
| POST `/billing/imports/checkout` → 503, terminal not found (STPIMS-ERR-103) | `ATMOS_TERMINAL_ID` set and sent on create | Remove `ATMOS_TERMINAL_ID` from env; omit `terminal_id` on `/merchant/pay/create` — Atmos auto-selects the store terminal |
| pre-apply 403 / API Subscription validation failed | OAuth client not subscribed to Merchant Pay API | Ask Atmos to enable Merchant Pay endpoints for your store |
| "Card verification failed" | Card number/expiry rejected by Atmos | Check card details and expiry (MM/YY); Atmos validates supported card types |
| Incorrect SMS code | Wrong or expired OTP | Re-enter code or tap **Resend Code** (30s cooldown on web) |
| OTP not arriving | Phone number not linked to card, or SMS delay | User should check SMS, retry OTP |
| Webhook returns invalid signature | Missing/wrong `ATMOS_API_KEY` | Obtain correct callback MD5 key from Atmos |

### Verify token from the VPS (redact secrets)

```bash
# Must return HTTP 200 + access_token. 401 invalid_client = Atmos rejected the OAuth client.
curl -sS -X POST 'https://apigw.atmos.uz/token?grant_type=client_credentials' \
  -H "Authorization: Basic $(printf '%s' \"$ATMOS_CONSUMER_KEY:$ATMOS_CONSUMER_SECRET\" | base64 -w0)" \
  -H 'Accept: application/json'
```

### Verify Merchant Pay API access

```bash
# After getting token, test create transaction (use a test amount):
curl -sS -X POST 'https://apigw.atmos.uz/merchant/pay/create' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount": 100, "account": "test123", "store_id": '"$ATMOS_STORE_ID"'}'
```

## Security Notes

- Card data (number, expiry) is **passed through** to Atmos, never stored in Gotcha database
- All communication uses HTTPS (TLS)
- OTP verification happens on Atmos side
- Callback signature validated with MD5 when `ATMOS_API_KEY` is set
- Secrets only in gitignored env files

## Android Integration

The Android app (`ImportScreen.kt`) uses the same API endpoints:
1. `POST /billing/imports/checkout` → returns `step: "card"`
2. `POST /billing/imports/payments/:id/pre-apply` with card data
3. `POST /billing/imports/payments/:id/apply` with OTP

## Refunds: what Atmos supports (checked 30 Oct 2026 against docs.atmos.uz/ru, "Отмена транзакции")
- `POST /merchant/pay/reverse` accepts only `transaction_id` (the `success_trans_id` from apply), an optional `hold_amount` (to keep part of the money, in tiyins) and an optional `reason`. A successful reverse returns `result.code = "OK"`.
- **There is no idempotency key.** Earlier code sent an `Idempotency-Key` header. Atmos doesn't document one, so it was removed. Duplicate protection comes from:
  1. our atomic `paid → refunding` claim, so only one request ever calls reverse, and
  2. Atmos refusing to reverse a transaction that's already been reversed (the error code for that isn't documented).
- `POST /merchant/pay/get` doesn't document a "reversed" status, so we never infer a reversal from `status_message` or `confirmed`.
- Reconciler (every 10 min, plus Admin → Payments → Reconcile): it only touches refunds that have been in `refunding` for **at least 10 minutes**, whoever triggers it. It retries the reverse:
  - `OK` → finalize (`refunded`, access revoked, audited).
  - Anything else → the payment stays `refunding` with `needsAttention` and the Atmos message saved in `cancel_reason`. Support checks the transaction in the Atmos cabinet and finishes the refund by hand.
- It **never** rolls back to `paid`. Before this fix, rolling back could undo a refund that was still going through.
