# Gotcha — System Architecture

Production-grade language learning platform: **reading-first**, AI-assisted vocabulary, SRS, and practice. Target languages: **English (en)**, **Russian (ru)**, **Uzbek (uz)**.

---

## 1. High-level topology

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Flutter Mobile │     │ Desktop Learner │     │   React Admin   │
│  (Android-first)│     │   Web :5175     │     │   CMS :5173     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  Marketing Web :5174    │
                    └────────────┬────────────┘
                                 │ HTTPS / REST
                                 ▼
                    ┌────────────────────────┐
                    │   NestJS API :3000     │
                    │   /api/v1 + Swagger    │
                    └───────────┬────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   PostgreSQL    │   │     Redis       │   │  MinIO (S3)     │
│   (Prisma ORM)  │   │  job queue      │   │  covers, PDFs   │
└─────────────────┘   └────────┬────────┘   └─────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Worker service       │
                    │   URL/PDF ingestion    │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   OpenAI API           │
                    │   lookup + quiz gen    │
                    └────────────────────────┘
```

**Monorepo layout**

| Path | Role |
|------|------|
| `apps/mobile/` | Flutter learner app |
| `apps/web-learner/` | Desktop learner web app (React + Vite) |
| `apps/admin/` | Content, licenses, moderation CMS |
| `apps/web/` | Marketing landing |
| `services/api/` | NestJS REST API + Prisma |
| `services/worker/` | Background ingestion |
| `packages/shared/` | Shared TypeScript types |
| `infra/docker-compose.yml` | Postgres, Redis, MinIO |

---

## 2. Domain model (Prisma)

### 2.1 Identity & learner profile

| Model | Purpose |
|-------|---------|
| `User` | Account, native/ui language, streak |
| `UserTargetLanguage` | Per-language CEFR level, primary flag |
| `UserPreferences` | Reader theme, font, daily goal, TTS |
| `AuthRefreshToken` | Rotating refresh tokens per device |
| `PlacementResult` | Onboarding placement test outcome |

**Enums:** `AppLanguage` (en, ru, uz), `CefrLevel` (a1–c2)

### 2.2 Content & licensing

| Model | Purpose |
|-------|---------|
| `ContentItem` | Book/article/story; metadata, CEFR, word counts |
| `ContentSegment` | Tokenized reading units (`tokenMap`, `sentenceMap` JSON) |
| `ContentCollection` | Curated shelves (featured, by language) |
| `ContentCollectionItem` | Many-to-many ordering |
| `License` | Rights holder, territories, attribution |
| `ContentBookmark` | User saved items |

**Enums:** `ContentType`, `ContentSource`, `PublishStatus`, `LicenseStatus`

### 2.3 Reading & progress

| Model | Purpose |
|-------|---------|
| `ReadingProgress` | Per-user position, % complete, known-word ratio |
| `ReadingSession` | Time-on-task analytics (taps, saves) |
| `UserKnownWord` | LingQ-style lemma status for highlighting |

**Enums:** `WordStatus` (unknown, learning, known, ignored)

### 2.4 Vocabulary & SRS

| Model | Purpose |
|-------|---------|
| `UserVocabulary` | Saved words with SM-2-style scheduling |
| `VocabularyReview` | Review history |
| `LemmaCache` | Shared AI translation cache |

**Enums:** `SrsRating` (again, hard, good, easy)

### 2.5 Practice

| Model | Purpose |
|-------|---------|
| `PracticeSession` | Quiz or flashcard session |
| `PracticeQuestion` | AI-generated prompts |
| `PracticeAnswer` | User responses + correctness |

**Enums:** `PracticeType` (comprehension, cloze, flashcard, writing)

### 2.6 Imports & ingestion

| Model | Purpose |
|-------|---------|
| `UserImport` | Paste/URL/PDF/EPUB user uploads |
| `IngestionJob` | Async pipeline jobs |
| `ModerationQueue` | Human review before publish |

**Enums:** `ImportType`, `IngestionSourceType`, `IngestionStatus`, `ModerationStatus`

### 2.7 Billing & quotas

| Model | Purpose |
|-------|---------|
| `SubscriptionPlan` | Free vs premium limits |
| `UserSubscription` | Active plan + provider ref |
| `AiUsageDaily` | Daily lookup/quiz/token counts |

**Enums:** `SubscriptionTier`, `SubscriptionStatus`

### 2.8 Admin

| Model | Purpose |
|-------|---------|
| `AdminUser` | Role (superadmin, editor, moderator, analyst) |
| `AuditLog` | Immutable admin action trail |

---

## 3. API surface (`/api/v1`)

| Module | Endpoints | Auth |
|--------|-----------|------|
| **auth** | `POST register`, `login`, `refresh` | Public (except refresh body) |
| **users** | `GET/PATCH me`, `me/stats`, `me/preferences` | JWT |
| **content** | `GET feed`, list, `:id`, segments, `PUT :id/progress` | JWT |
| **reading** | `POST sessions`, `PUT sessions/:id/end`, `GET known-words`, `PUT progress/:contentId` | JWT |
| **vocabulary** | `GET`, `review-queue`, `POST`, `POST :id/review` | JWT |
| **practice** | `POST sessions`, `POST sessions/:id/answers`, `GET sessions/:id` | JWT |
| **ai** | `POST lookup` | JWT |
| **imports** | `GET`, `POST paste`, `POST url` | JWT |
| **billing** | `GET subscription`, `plans` | JWT / public plans |
| **admin** | dashboard, content CRUD, licenses, moderation, ingestion | Admin JWT |

Global: `ThrottlerGuard` (120 req/min), JWT guard with `@Public()` bypass.

---

## 4. Core data flows

### 4.1 Tap-to-translate (reader)

```
User taps token → Mobile POST /ai/lookup {lemma, sourceLang, targetLang, context}
                → API checks LemmaCache → OpenAI if miss → cache + return
                → Optional POST /vocabulary (save) + UserKnownWord upsert
```

### 4.2 Reading session

```
Open content → POST /reading/sessions {contentId, segmentId}
Read + scroll → PUT /reading/progress/:contentId {segmentId, charOffset, progressPct, readSeconds}
Exit reader   → PUT /reading/sessions/:id/end {durationSeconds, wordsTapped, wordsSaved}
              → StreakService updates User.streakCount
```

### 4.3 SRS review

```
GET /vocabulary/review-queue → card stack
User rates card → POST /vocabulary/:id/review {rating: again|hard|good|easy}
                → SM-2 interval update + VocabularyReview row
```

### 4.4 Practice quiz

```
POST /practice/sessions {contentId, segmentId, practiceType}
     → AiService.generateQuiz(segmentText) → PracticeQuestion rows
User answers → POST /practice/sessions/:id/answers
             → score + explanations
```

### 4.5 User import (URL)

```
POST /imports/url → UserImport (queued) + IngestionJob
Worker polls job → fetch HTML → strip → tokenize → ContentItem + segments
                 → UserImport.ingestionStatus = ready | failed
Optional → ModerationQueue → admin approve → publish
```

### 4.6 Admin publish

```
Editor creates ContentItem (draft) → segments tokenized
Moderator clears license → PATCH admin/content/:id/publish
Mobile feed → GET /content/feed (published only)
```

---

## 5. Client applications

### 5.1 Flutter mobile (learner)

**Screens (information architecture):**

- Onboarding → language selection, placement, daily goal
- Auth → register / login
- Library → collections, continue reading, bookmarks
- Content detail → metadata, start/resume
- Reader → segmented text, tap lookup, known-word states
- Vocabulary → list, filters, SRS queue
- Practice → quiz from last segment / flashcards
- Import → paste, URL, status list
- Profile → stats, streak, subscription, settings

**Integration status**

| Area | Status |
|------|--------|
| Auth login/register | Wired |
| Token refresh on 401 | **TODO** — `api_client.dart` |
| Library feed | Partial |
| Reader multi-segment + progress save | **TODO** |
| Known-word highlighting | **TODO** — needs `GET /reading/known-words` |
| SRS review UI | **TODO** — API exists |
| Practice quiz UI | **TODO** — API exists |
| Import status polling | **TODO** — needs worker running |
| Settings / preferences sync | **TODO** |

### 5.2 React admin CMS

- Dashboard metrics
- Content editor + publish workflow
- License registry
- Moderation queue
- Ingestion job monitor

### 5.3 Marketing web

- Landing, pricing, feature highlights
- Links to app store (future)

---

## 6. Infrastructure & ops

| Component | Dev | Production target |
|-----------|-----|-------------------|
| Database | Docker Postgres | Managed Postgres (RDS, Supabase, Neon) |
| Cache/queue | Docker Redis | ElastiCache / Upstash |
| Object storage | MinIO | S3 / R2 |
| API | `npm run dev:api` | Container + load balancer |
| Worker | `npm run dev:worker` | Separate container, auto-scale |
| Secrets | `.env` | Vault / platform secrets |
| Migrations | `prisma migrate dev` | `prisma migrate deploy` in CI |

**Docker compose today:** Postgres, Redis, MinIO only — API/worker/admin not containerized yet.

---

## 7. Security model

- Passwords: bcrypt hashes
- Access JWT: ~15 min expiry
- Refresh tokens: hashed in DB, rotatable
- Admin routes: `AdminGuard` + role check
- Rate limiting: global throttler
- CORS: configurable via `API_CORS_ORIGINS`
- AI keys: server-side only; never in mobile bundle

---

## 8. What remains for professional production

### P0 — Ship blockers

| Item | Owner | Notes |
|------|-------|-------|
| Flutter token refresh | Mobile | Wire `POST /auth/refresh` + retry |
| Reader progress persistence | Mobile + API | Multi-segment, `PUT /reading/progress` |
| SRS review screen | Mobile | Connect review-queue + rating |
| Practice session UI | Mobile | Start/submit flow |
| Import quota enforcement | API | `LimitsService.assertImportAllowed` on imports |
| Quiz quota enforcement | API | `LimitsService.assertQuizAllowed` on practice |
| Run migration `0002_production_enums` | DevOps | Enums + UserKnownWord + bookmarks |
| Worker process in prod | DevOps | Required for URL imports |

### P1 — Product parity (LingQ-class)

| Item | Notes |
|------|-------|
| Known-word highlighting | Reader uses `UserKnownWord.status` |
| Streak + daily goal UI | `StreakService` wired; surface in profile |
| PDF/EPUB import + S3 upload | Schema ready; implementation missing |
| Moderation before public import | Queue exists; mobile shows pending state |
| Stripe / Google Play billing | Read-only plans today; webhooks needed |
| Offline reading (premium) | `offlineEnabled` flag; no sync layer |
| TTS in reader | `ttsEnabled` preference; no player |
| Library search & filters | API query params + mobile UI |
| Placement test flow | `PlacementResult` model; no API/UI |
| Content bookmarks API | Model exists; endpoints TODO |
| Seed collection links | `ContentCollectionItem` rows in seed |
| Email verification / password reset | Not implemented |
| Push notifications (streak reminder) | Not implemented |
| iOS build + App Store | Android-first scope |
| Observability | Structured logging, Sentry, metrics |
| E2E tests | API integration + Flutter widget tests |

### P2 — Scale & polish

| Item | Notes |
|------|-------|
| Full-text search (Elasticsearch/Meilisearch) | Content + vocabulary |
| CDN for covers/audio | MinIO → CloudFront |
| Multi-region API | Read replicas |
| Content recommendation | Based on CEFR + known-word ratio |
| Community features | Shared imports (`isPublic`) |
| Analytics pipeline | Reading sessions → BI |
| Localization | UI strings EN/RU/UZ |
| Figma design system → Code Connect | After Figma AI polish pass |

---

## 9. Schema migrations

| Migration | Contents |
|-----------|----------|
| `0001_init` | Full initial schema (~22 models) |
| `0002_production_enums` | Typed enums, `UserKnownWord`, `ContentBookmark`, `PlacementResult` |

Apply: `cd services/api && npx prisma migrate deploy`

---

## 10. Design ↔ code workflow

1. **Schema + API** = source of truth for product behavior
2. **Figma** = visual design (owned by Figma AI — see `docs/figma/FIGMA_AI_PRODUCT_PROMPT.md`)
3. Optional: capture running app → Figma via MCP `generate_figma_design`
4. Sync back: `get_design_context` + Flutter/React implementation

**Figma file:** [Gotcha — Language Learning](https://www.figma.com/design/66RRxTemdRSw60Fg4NUrUn/Gotcha-%E2%80%94-Language-Learning) (`66RRxTemdRSw60Fg4NUrUn`)

---

## 11. Demo accounts (seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@gotcha.app | set via `SEED_ADMIN_PASSWORD` |
| Learner | learner@gotcha.app | set via `SEED_LEARNER_PASSWORD` |
