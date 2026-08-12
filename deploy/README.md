# Gotcha on Eskiz VPS2 (single host)

One VPS runs the entire platform: Postgres, Redis, MinIO, API, worker, marketing, learner, and admin.

**Do not run `deploy:vps` until the Eskiz VPS2 IP, root password, and domain are provided.**

## Ports (localhost only on the VPS)

| Service  | Host port |
|----------|-----------|
| Postgres | 5434      |
| Redis    | 6380      |
| MinIO    | 9100/9101 |
| API      | 3200      |

## Public URLs (after DOMAIN is set)

- `https://DOMAIN/` — marketing
- `https://DOMAIN/learn/` — learner
- `https://DOMAIN/admin/` — admin
- `https://DOMAIN/api/v1` — API

## From Windows

```powershell
# Create/refresh deploy/.env secrets (safe anytime; does not deploy)
npm run deploy:vps:env

# After you provide IP + PASSWORD + DOMAIN in deploy/.env:
# npm run deploy:vps
```

`deploy/.env` is gitignored. Root `.env` stays for local dev; VPS placeholders live at the bottom.

## Atmos payments

See [docs/ATMOS.md](../docs/ATMOS.md) for callback/success URLs, env vars, and go-live checklist.

- Callback: `https://DOMAIN/api/v1/billing/atmos/webhook`
- Success: `https://DOMAIN/learn/app/import/payment-return`
- Keep `PAYMENT_GATEWAY_ENABLED=false` until sandbox E2E succeeds, then set `true` and `IMPORTS_UNLIMITED=false`.
