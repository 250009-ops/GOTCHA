# Gotcha — Language Learning Platform

Production monorepo for **Gotcha**: learn English, Russian, and Uzbek through authentic reading with AI-powered vocabulary, SRS, and practice.

## Stack

| Layer | Tech |
|---|---|
| Mobile | Flutter (Android-first) |
| Desktop learner | React + Vite (port 5175) |
| API | NestJS + Prisma + PostgreSQL |
| Worker | BullMQ + Redis (URL ingestion) |
| Admin CMS | React + Vite (port 5173) |
| Marketing | React + Vite (port 5174) |
| Storage | MinIO (S3-compatible) |

## Quick start

### 1. Infrastructure (Docker Desktop)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if needed, then:

```powershell
cd "C:\projects\GOTCHA_android app"
.\scripts\setup.ps1
```

Or manually:

```powershell
copy .env.example .env
docker compose -f infra/docker-compose.yml up -d
```

**First Docker launch:** open Docker Desktop from the Start menu and wait until it shows "Running" (may take 2–3 minutes). On Windows, if Docker fails, **reboot** after install, then run `wsl --install` in an elevated PowerShell.

**Port 5433:** Gotcha Postgres uses host port **5433** (not 5432) to avoid conflicting with a local Windows PostgreSQL service.


### Windows: WSL/Docker blocked?

See **[Windows troubleshooting](docs/WINDOWS_TROUBLESHOOTING.md)** (403 on `wsl --install`, `wsl` not recognized, local PostgreSQL without Docker).

**Local PostgreSQL (no Docker):**

```powershell
cd "C:\projects\GOTCHA_android app"
.\scripts\setup-local-postgres.ps1
```


**Without Docker:** set `DEV_AUTH_ANY_CREDENTIAL=true` in `.env` — the learner web app works with in-memory auth and sample content.

### 2. Install & database

```powershell
npm install
npm run db:generate
cd services/api
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Run services

```powershell
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Worker (optional, for URL imports)
npm run dev:worker

# Terminal 3 — Admin CMS
npm run dev:admin

# Terminal 4 — Marketing site
npm run dev:web

# Terminal 5 — Desktop learner app
npm run dev:web-learner

# Or use the helper script (opens two terminals):
# .\scripts\start-dev.ps1
```

### 4. Flutter mobile

Install [Flutter SDK](https://docs.flutter.dev/get-started/install), then:

```powershell
cd apps/mobile
flutter pub get
flutter run
```

API base URL for Android emulator: `http://10.0.2.2:3000/api/v1` (configured in `lib/core/network/api_client.dart`).

## URLs

| Service | URL |
|---|---|
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Admin | http://localhost:5173 |
| Marketing | http://localhost:5174 |
| **Learner (desktop)** | **http://localhost:5175** |
| MinIO console | http://localhost:9001 |

## Demo accounts (after seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@gotcha.app | set via `SEED_ADMIN_PASSWORD` |
| Learner | learner@gotcha.app | set via `SEED_LEARNER_PASSWORD` |

## Project structure

```
gotcha/
  apps/mobile/       Flutter learner app
  apps/admin/        Content & license CMS
  apps/web/          Marketing landing page
  apps/web-learner/  Desktop learner web app (React + Vite)
  services/api/      NestJS REST API + Prisma
  services/worker/   Background ingestion jobs
  packages/shared/   Shared TypeScript types
  infra/             Docker Compose (Postgres, Redis, MinIO)
```

## Documentation

- [Windows troubleshooting (WSL, PostgreSQL)](docs/WINDOWS_TROUBLESHOOTING.md)
- [System architecture](docs/ARCHITECTURE.md) — topology, schema, API, gaps
- [Figma AI product prompt](docs/figma/FIGMA_AI_PRODUCT_PROMPT.md) — schema & flows for Figma (no UI specs)
- [Figma file notes](docs/figma/FILE.md)
- [Import pagination (paste / files / URL)](docs/IMPORT_PAGINATION.md) � multi-segment chunks (~100 words)

## Features

- Interactive reader with tap-to-translate
- AI word lookup with grammar notes (cached)
- Spaced repetition vocabulary (SM-2 style)
- AI comprehension & cloze practice from reading segments
- User imports (paste text, URL queue)
- Admin CMS: content publishing, license registry, moderation, ingestion monitor
- Subscription tiers (free / premium) with AI quotas
- Seed catalog: EN, RU, UZ sample stories + licensed news article

## Environment

Copy `.env.example` to `.env` and set:

- `OPENAI_API_KEY` — paste your OpenAI key (leave empty for local demo lookups). Restart the API after changing. Learner Reader uses it for live translations; Admin **Settings → AI controls** toggles enablement, models, and daily limits; **AI Usage** shows live logs when available.
- `OPENAI_MODEL_LOOKUP` / `OPENAI_MODEL_QUIZ` — defaults for AI models (admin can override via Settings)
- `OPENAI_BASE_URL` — optional (Azure OpenAI / proxies)
- `JWT_SECRET` — use a long random string in production
- `DATABASE_URL` — must match your PostgreSQL instance (see below)

### Local database (optional with dev auth)

For full functionality (content feed, vocabulary persistence, etc.), use PostgreSQL with user `gotcha` / password `gotcha_dev` / database `gotcha`:

```powershell
docker compose -f infra/docker-compose.yml up -d postgres
npm run db:migrate
npm run db:seed
```

If Docker is unavailable, install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or point `DATABASE_URL` in `.env` at an existing PostgreSQL server and run migrations manually.

### Dev login without PostgreSQL

Set `DEV_AUTH_ANY_CREDENTIAL=true` in `.env` (included in `.env.example`) to sign in locally with **any email and password**. The API starts even when PostgreSQL is down and issues real JWTs using an in-memory dev user store. A small **sample content library** (EN/RU/UZ stories) is served so the learner UI is usable without running migrations.

```powershell
# Example — works with any credentials
curl -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"anything"}'
```

Then open http://localhost:5175/login and sign in with the same arbitrary credentials.

**Security:** Never set `DEV_AUTH_ANY_CREDENTIAL=true` in production. Omit the variable or set it to `false` to restore normal password verification.

**API dev note:** If `npm run dev:api` fails with `Cannot find module dist/main`, run `npm run build --workspace=services/api` once, then retry.

## Production notes

- Run `npm run db:deploy` in CI/CD instead of `migrate dev`
- Put API behind HTTPS (nginx / Cloudflare)
- Replace MinIO with AWS S3 or Cloudflare R2
- Configure Stripe/Google Play for billing webhooks
- Set `API_CORS_ORIGINS` to your admin and web domains