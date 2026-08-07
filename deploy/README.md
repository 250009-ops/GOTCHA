# Gotcha on Eskiz VPS2 (single host)

One VPS runs the entire platform: Postgres, Redis, MinIO, API, worker, marketing, learner, and admin.

## Ports (localhost only — no clash with itestu)

| Service  | Host port |
|----------|-----------|
| Postgres | 5434      |
| Redis    | 6380      |
| MinIO    | 9100/9101 |
| API      | 3200      |

## Public URLs

Using `DOMAIN=vps10094.eskiz.uz`:

- https://vps10094.eskiz.uz/ — marketing
- https://vps10094.eskiz.uz/learn/ — learner
- https://vps10094.eskiz.uz/admin/ — admin
- https://vps10094.eskiz.uz/api/v1 — API

## From Windows

```powershell
# Once: create deploy/.env (JWT, DB, S3, VPS IP/PASSWORD, OpenAI)
npm run deploy:vps:env

# Ship + install on the VPS
npm run deploy:vps
```

`deploy/.env` is gitignored. Root `.env` keeps local-dev settings; deploy keys are also appended there for convenience.
