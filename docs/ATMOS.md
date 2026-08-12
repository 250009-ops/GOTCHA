# Atmos pay-per-import (Gotcha)

Local card payments for **import-by-size** via Atmos hosted checkout. Premium subscription checkout is out of scope.

## URLs (production — `gotchaa.uz`)

| Purpose | URL |
|--------|-----|
| Atmos callback (webhook) | `https://gotchaa.uz/api/v1/billing/atmos/webhook` |
| Learner success return | `https://gotchaa.uz/learn/app/import/payment-return?paymentId=…` |
| API | `https://gotchaa.uz/api/v1` |

Give Atmos the **callback URL** so they can POST payment confirmations before finalizing debit.

## Env (`deploy/.env` — never commit secrets)

```bash
ATMOS_CONSUMER_KEY=…
ATMOS_CONSUMER_SECRET=…
ATMOS_STORE_ID=…
ATMOS_API_KEY=…              # callback MD5 key (when Atmos provides it)
ATMOS_API_BASE=https://apigw.atmos.uz
ATMOS_IKPU=10899001001000000
ATMOS_MERCHANT_TIN=…         # YaTT PINFL for OFD

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
- Free pool: **Free Limits** (daily imports, monthly pages, allowed formats)
- Atmos amount = UZS × 100 (**tiyins**)
- OFD line uses `ATMOS_IKPU`

## API surface

- `POST /billing/imports/quote`
- `POST /billing/imports/checkout`
- `GET /billing/imports/payments/:id`
- `POST /billing/atmos/webhook` (public)
- Import create endpoints accept `paymentId` when gateway is on

## Live Deployment Checklist

Before payments work in production, complete all steps:

### 1. Atmos Merchant Setup (one-time)
- [ ] Obtain merchant credentials from Atmos: `ATMOS_CONSUMER_KEY`, `ATMOS_CONSUMER_SECRET`, `ATMOS_STORE_ID`
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
- [ ] Verify learner panel: Import page shows "Paid imports use page-tier prices… via Atmos"

### 4. Configure Pricing (Admin Panel)
- [ ] Admin → **Import & Pricing** → **Page Tiers** — set prices in UZS (soʻm)
- [ ] Admin → **Import & Pricing** → **Free Limits** — configure daily/monthly free allowances

### 5. Test End-to-End
- [ ] As learner, exceed free allowance or import a large PDF
- [ ] Confirm Atmos checkout page opens with correct amount
- [ ] Pay with test card (UzCard/Humo sandbox)
- [ ] Confirm payment callback marks `ImportPayment` as `paid`
- [ ] Confirm import proceeds after payment
- [ ] Check OFD/fiscal receipt (if IKPU/TIN are set)

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Imports are free right now" on Import page | `PAYMENT_GATEWAY_ENABLED=false` or `IMPORTS_UNLIMITED=true` | Set both flags correctly in `deploy/.env`, redeploy |
| "Atmos is not configured" error | Missing `ATMOS_CONSUMER_KEY/SECRET/STORE_ID` | Fill credentials in `deploy/.env`, run `deploy/update.sh` |
| Webhook returns 401/invalid signature | Missing/wrong `ATMOS_API_KEY` | Obtain correct key from Atmos, update `deploy/.env` |
| Payment stuck on pending | Webhook URL not registered with Atmos | Register `https://YOUR_DOMAIN/api/v1/billing/atmos/webhook` in Atmos cabinet |

## Sandbox Testing

For development/staging without real charges:
1. Use Atmos sandbox credentials (same `apigw.atmos.uz` endpoint, different store)
2. Set `PAYMENT_GATEWAY_ENABLED=true`, `IMPORTS_UNLIMITED=false` in local `.env`
3. Run API locally, test checkout flow with sandbox cards

## Security

- Secrets only in gitignored env files
- No card PAN on Gotcha servers (hosted invoice page)
- Webhook verifies `MD5(store_id + transaction_id + invoice + amount + api_key)` when `ATMOS_API_KEY` is set
