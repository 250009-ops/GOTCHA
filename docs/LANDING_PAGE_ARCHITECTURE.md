# GOTCHA Public Landing Page — Architecture

**Status:** Design-first architecture. No UI, Figma, or application code is implemented as part of this document.  
**Audience:** Figma (layout, named slots, empty/loading/error variants) then engineering (`apps/web` + `services/api`).  
**Surfaces in scope:** public marketing site at `https://gotchaa.uz/` (`apps/web`) and the unauthenticated API it will call.  
**Out of scope:** Android APK, VPS Android deploy, learner paywall internals, re-seeding Figma demo catalog. Keep production catalog titles such as MOBY-DICK. Do not invent fake learners or fake books.

**Related docs (do not duplicate):** `docs/ARCHITECTURE.md` (system topology), `docs/ATMOS.md` (UZS / 500 soʻm minimum), `docs/LIBRARY_CONTENT_PAYWALL_SCOPE.md` (catalog `isFree` + `priceUsd` stores soʻm), `docs/figma/FILE.md` (existing Figma file). This file is the canonical landing/marketing architecture.

**Production URLs**

| Surface | URL |
|---------|-----|
| Marketing landing | `https://gotchaa.uz/` |
| Learner app | `https://gotchaa.uz/learn/` |
| Admin CMS | `https://gotchaa.uz/admin/` |
| API | `https://gotchaa.uz/api/v1` |
| Covers / avatars | `https://gotchaa.uz/uploads/` (`deploy/nginx/gotcha.conf`) |

**Date:** 17 August 2026.

---

## 1. Purpose and Figma-first workflow

The public landing is GOTCHA’s acquisition page. It must look production-grade **and** stay honest: pay-as-you-go in UZS via Atmos, no Premium subscription, live catalog and live import prices, real readers.

### 1.1 Sequence (mandatory)

```
1. Figma designs screens, tokens, and named content slots
        ↓  (design approved)
2. Engineering implements the public API + wires slots in apps/web
        ↓
3. Polish (motion, responsive QA, cache headers, empty-state copy)
```

Do **not** code new landing sections before Figma. Do **not** ask Figma to invent catalog books, prices, or “top students.” Figma designs **slots**; production data fills them.

### 1.2 What Figma owns

- Visual system: type, color, spacing, elevation, motion (see existing file `66RRxTemdRSw60Fg4NUrUn`, page **03 Admin & Marketing**).
- Desktop **1440**, tablet **768**, mobile **390** frames for the landing.
- Component variants for every dynamic block: **loading**, **populated**, **empty**, **degraded** (API down).
- Named slots listed in §3. Bind each slot to a field in §4 — not to placeholder copy that looks like live data.

### 1.3 What engineering owns (after Figma)

- `GET /api/v1/marketing/landing` (new, public) and wiring in `apps/web`.
- Cache, CORS, cover URL resolution, privacy filters, empty-state behavior.
- Admin “show on landing” using the existing `ContentCollection` model — not a new CMS.

### 1.4 Product constraints Figma and engineering must honor

- Currency is **UZS (soʻm)**. Catalog `ContentItem.priceUsd` and `ImportPageTier.priceUsd` are legacy column names that store soʻm. Display `priceUzs`, never `$`.
- Atmos minimum charge is **500 soʻm** (`ATMOS_MIN_AMOUNT_SOM`, `atmosMinAmountSom()` in `services/api/src/modules/billing/atmos.client.ts`).
- **No Premium subscription.** Copy must not say “$9/mo”, “Start free trial”, or “unlimited Premium.”
- User-imported books the owner already paid to import stay free **to that owner**. Import fees are separate from catalog book purchases. The landing may say “pay once per import” and “catalog books may be free or paid” — it must not imply a subscription unlocks the library.
- Do not re-seed Figma demo catalog samples. Do not hide MOBY-DICK if it is a real published catalog item.
- Hide QA / synthetic accounts via `liveLearnerWhere()` in `services/api/src/common/production-users.ts`.
- If the live cohort is small, show an empty/fallback state. Never invent names, quotes, or a floor learner count.

`docs/figma/FIGMA_AI_PRODUCT_PROMPT.md` still mentions a Premium tier. **Ignore that for this landing.** This document is authoritative for marketing copy and data.

---

## 2. Current vs target architecture

### 2.1 Current (mostly static marketing)

```
Browser  https://gotchaa.uz/
   │
   ├─ apps/web/src/pages/LandingPage.tsx   hardcoded hero, how-it-works, features, testimonials
   ├─ apps/web/src/lib/api.ts              GET /marketing/plans  +  GET /marketing/stats
   └─ apps/web/src/lib/links.ts            FALLBACK_PLANS, FALLBACK_LEARNER_COUNT = 12_840
                │
                ▼
   services/api/src/modules/marketing/
     GET /marketing/plans   @Public  — Free + “Pay as you go” copy; no UZS page tiers
     GET /marketing/stats   @Public  — counts ALL users; floors displayLearnerCount at 12_840
```

What is live today:

| Block | Source | Problem |
|-------|--------|---------|
| Hero, How it works, Features | Hardcoded arrays in `LandingPage.tsx` | Fine as evergreen copy; not CMS |
| Testimonials | Hardcoded “Alina T. / Rustam K. / Dilnoza M.” | Invented learners — not allowed for “top students” |
| Pricing cards | `GET /marketing/plans` with `FALLBACK_PLANS` | No live `ImportPageTier` UZS amounts; “Pay as you go” is generic |
| Learner count CTA | `GET /marketing/stats` | Does not use `liveLearnerWhere()`; invents 12,840 when DB is small |
| Catalog showcase | **Missing** | Admin-published `ContentItem` never appears on the landing |
| Top readers | **Missing** | Settings copy mentions a leaderboard (`SettingsPage.tsx`) but no public API exists |

Auth model: `JwtAuthGuard` is global (`services/api/src/modules/auth/auth.module.ts`). Only `@Public()` routes are callable without a learner JWT. Existing public routes that the landing could theoretically reuse:

| Endpoint | Auth | Useful for landing? |
|----------|------|---------------------|
| `GET /marketing/stats` | Public | Partial — must stop flooring at 12,840 and must filter live learners |
| `GET /marketing/plans` | Public | Partial — honest pay-as-you-go copy, **not** live page-tier prices |
| `GET /billing/plans` | Public | No — raw `SubscriptionPlan` rows, including unused premium modeling |
| `GET /billing/gateway-status` | Public | Optional footnote (Atmos configured / UZS) — not a pricing table |
| `GET /content/languages` | Public | Optional language chips in hero |
| `GET /content/feed` | **JWT** | Cannot be used by the anonymous marketing site |
| `GET /content` | **JWT** | Same |
| `GET /admin/import-pricing` | **Admin JWT** | Cannot be called from `apps/web` |
| `POST /billing/imports/quote` | **JWT** | Per-user quote; not a public price list |

There is **no** unauthenticated catalog, import-tier, or leaderboard endpoint. Piecing the landing from the table above would either require auth or stay incomplete. **Target: one aggregated public payload.**

### 2.2 Target (CMS/live data behind named slots)

```
Figma (slots)  →  apps/web LandingPage
                      │  one request
                      ▼
              GET /api/v1/marketing/landing   @Public
                      │
        ┌─────────────┼──────────────────┐
        ▼             ▼                  ▼
  Published catalog   ImportPageTier     Live learners
  (featured coll.     + freeLimits       (streak / minutes /
   else recent)       + atmos min        words) via liveLearnerWhere()
```

Static evergreen sections (hero headline, how-it-works, feature grid, legal footer) stay design-owned. Three blocks become **data-driven**: catalog showcase, import pricing, top readers. Learner count in the final CTA uses the same live filter, with no fake floor.

---

## 3. Information architecture (landing sections)

Anchor IDs are for nav (`SiteNav` / `SiteFooter` in `apps/web/src/components/SiteChrome.tsx`). Figma must keep these IDs so hash links (`/#pricing`, `/#catalog`) keep working.

| # | Section | Anchor | Kind | Figma frame name |
|---|---------|--------|------|------------------|
| 0 | Sticky nav | — | Static + CTAs | `Landing / Nav` |
| 1 | Hero | — | Mostly static; optional live language chips + live learner count | `Landing / Hero` |
| 2 | How it works | `#how` | Static (3 steps) | `Landing / How` |
| 3 | Features | `#features` | Static (6 cards) | `Landing / Features` |
| 4 | **Catalog showcase** | `#catalog` | **Dynamic** | `Landing / Catalog` |
| 5 | **Import pricing** | `#pricing` | **Dynamic** | `Landing / Pricing` |
| 6 | **Top readers** | `#readers` | **Dynamic** (replaces invented testimonials) | `Landing / TopReaders` |
| 7 | Final CTA | — | Static copy + live learner count | `Landing / CTA` |
| 8 | Footer | — | Static (Product / Legal / Roadmap) | `Landing / Footer` |

Nav additions after implementation: Catalog, Pricing, Top readers (or “Learners”), Features, How it works. Sign in → `https://gotchaa.uz/learn/login`. Get started → `https://gotchaa.uz/learn/register`. Helpers already exist: `loginUrl()` / `registerUrl()` in `apps/web/src/lib/links.ts`.

### 3.1 Named slots (Figma → API)

Use these slot names in Figma (component properties or text-layer names). Engineering binds the same names.

**`Landing / Nav`**

| Slot | Binding | Notes |
|------|---------|-------|
| `nav.signIn` | static URL | Learner login |
| `nav.getStarted` | static URL | Learner register |

**`Landing / Hero`**

| Slot | Binding | Notes |
|------|---------|-------|
| `hero.eyebrow` | static | e.g. “Reading-first language learning” |
| `hero.headline` | static | Design-owned |
| `hero.subhead` | static | Design-owned |
| `hero.ctaPrimary` | static URL | Register |
| `hero.ctaSecondary` | `#how` or video | Do not invent a demo video URL if none exists; use “See how it works” |
| `hero.meta.noCard` | static | “No credit card required” is true |
| `hero.meta.noSub` | static | “No subscription — pay as you go in soʻm” |
| `hero.languages[]` | `payload.languages[]` | Optional; from `GET /content/languages` or included in landing payload |
| `hero.learnerCount` | `payload.stats.learnerCount` | Hide the number if `learnerCount === 0` |

**`Landing / Catalog`**

| Slot | Binding |
|------|---------|
| `catalog.kicker` | static (“Library”) |
| `catalog.title` | static |
| `catalog.subtitle` | static |
| `catalog.cards[]` | `payload.catalog.items[]` |
| `catalog.card.cover` | `coverImageUrl` |
| `catalog.card.title` | `title` |
| `catalog.card.author` | `author` |
| `catalog.card.language` | `language` |
| `catalog.card.cefr` | `cefr` |
| `catalog.card.price` | `isFree` ? “Free” : formatted `priceUzs` |
| `catalog.card.type` | `contentType` |
| `catalog.cta` | Learner library URL (`/learn/` after login) |
| `catalog.empty` | empty variant — no fake books |
| `catalog.degraded` | API down — hide section or last-known cards |

**`Landing / Pricing`**

| Slot | Binding |
|------|---------|
| `pricing.kicker` | static |
| `pricing.title` | static — “Pay as you go. No subscription.” |
| `pricing.subtitle` | static — Atmos, UZS |
| `pricing.free.allowance` | `payload.importPricing.freeLimits` |
| `pricing.tiers[]` | `payload.importPricing.tiers[]` |
| `pricing.tier.label` | `label` (e.g. “1 – 10 pages”) |
| `pricing.tier.range` | `minPages`–`maxPages` |
| `pricing.tier.price` | formatted `priceUzs` |
| `pricing.footnote.atmosMin` | `payload.importPricing.atmosMinAmountSom` (500) |
| `pricing.footnote.currency` | always `UZS` |
| `pricing.empty` | hide table; keep “pay as you go” copy |
| `pricing.degraded` | last-known tiers or copy-only |

**`Landing / TopReaders`**

| Slot | Binding |
|------|---------|
| `readers.kicker` | static (“Community” / “Top readers”) |
| `readers.title` | static |
| `readers.cards[]` | `payload.topReaders[]` |
| `readers.card.displayName` | `displayName` only |
| `readers.card.initials` | derived from `displayName` |
| `readers.card.minutes` | `minutesRead` |
| `readers.card.streak` | `streakDays` |
| `readers.card.words` | `wordsLearned` |
| `readers.empty` | small-cohort copy — never filler names |
| `readers.degraded` | hide section |

**`Landing / CTA`**

| Slot | Binding |
|------|---------|
| `cta.headline` | static |
| `cta.learnerCount` | `payload.stats.learnerCount` — omit numeral if 0 |
| `cta.primary` | register URL |
| `cta.secondary` | optional contact — only if a real address is kept |

Drop the current hardcoded testimonials block (`LandingPage.tsx` lines 66–88). It is not a data contract and must not be redesigned as “social proof” with invented people. If marketing later wants quotes, they must be real, consented, and stored — out of scope here.

### 3.2 Cover and media rules (Figma + engineering)

- Catalog covers come from `ContentItem.coverImageKey`, serialized as `coverImageUrl` (see `serializeContent()` in `services/api/src/modules/content/content.service.ts`).
- Values are either a site-relative path (`/uploads/covers/…`) or an absolute `https://` URL.
- Production nginx serves `/uploads/` from `/var/www/gotcha/uploads/` (`deploy/nginx/gotcha.conf`).
- The marketing app must resolve relative paths the same way admin already does: `apps/admin/src/lib/media.ts` `resolveMediaUrl()` → `https://gotchaa.uz/uploads/…`.
- Missing cover: Figma **placeholder silhouette / letter tile**, not a stock Unsplash book and not a Figma demo cover reused as if it were production.

### 3.3 Money formatting

- Format: `12 000 soʻm` (narrow no-break space thousands, Uzbek/English landing locale as designed).
- `0` or `isFree: true` → badge **Free**, not `0 soʻm`.
- Never show USD, `$`, or “priceMonthly”.
- Never show a catalog or import price below 500 soʻm as a payable amount (admin already rejects that via `assertAtmosMinPriceSom`).

---

## 4. Data contracts

All three dynamic blocks are returned together so `apps/web` makes **one** unauthenticated request.

### 4.1 Featured catalog / system materials

**Source of truth:** published admin catalog `ContentItem` rows.

Filter (same catalog definition as `ContentService.getFeed` / `AdminService.catalogWhere`):

- `publishStatus = published`
- `contentSource ≠ user_import`
- `contentType ≠ user_import`

User imports never appear on the marketing landing, even if published. Import money does not equal catalog purchase; the landing is a **storefront for system/catalog materials only**.

**Selection order (prefer existing featured collections — no new CMS):**

1. **Primary:** items in `ContentCollection` where `isFeatured = true`, ordered by collection `sortOrder` then item `sortOrder`. Cap **12**. Skip unpublished / user-import members.
2. **Fallback** if the featured collections are empty: `recentlyPublished` catalog items, `orderBy publishedAt desc`, take **12**. This is the same query `getFeed()` already runs (`content.service.ts`).
3. **Never** pad with seed/demo titles, Unsplash sample stories, or Figma curriculum fixtures (`admin-figma-metrics.ts`).

Schema today:

- `ContentCollection.isFeatured` exists (`schema.prisma`).
- `ContentItem` has **no** `isFeatured` column.
- There is **no** admin UI to attach items to collections. `publishContent()` only sets `publishStatus` + `publishedAt` (`admin.service.ts`). Seed is the only writer of `ContentCollectionItem` (`prisma/seed.ts`, collection slug `starter-library`).

See §6 for the thin admin control.

**Card DTO**

```ts
type LandingCatalogItem = {
  id: string;
  slug: string;
  title: string;
  author: string | null;       // ContentItem.author; serializeContent also exposes authorName
  coverImageUrl: string | null; // ContentItem.coverImageKey
  language: 'en' | 'ru' | 'uz';
  cefr: 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'; // ContentItem.cefrLevel
  contentType: 'book' | 'article' | 'story' | 'news';
  isFree: boolean;
  priceUzs: number;            // 0 when free; from catalogPriceUzs()
};
```

Reuse `catalogPriceUzs()` in `services/api/src/modules/content/catalog-access.ts`. Do not expose `priceUsd` to the marketing client. Do not expose `accessGranted`, segments, or paywall internals.

CTA on a card: deep-link into the learner app (register/login, then library). Do not open reader content anonymously.

### 4.2 Import pricing

**What learners actually pay:** `ImportPageTier` (`import_page_tiers`). Checkout uses `ImportCommerceService.findTier()` / `quote()` — **not** `ImportPricingRule`.

`ImportPricingRule` (`ebook`, `article`, `news`, …) is admin metadata only (`GET/PATCH /admin/import-pricing/rules`). It is **not** applied at quote time. Do not put those per-type `pricePerImport` numbers on the landing as if they were checkout prices.

**Public DTO** (safe subset of `AdminService.importPricing()`):

```ts
type LandingImportPricing = {
  currency: 'UZS';
  atmosMinAmountSom: number; // default 500
  freeLimits: {
    dailyFreeImportsPerUser: number; // PlatformSetting key importFreeLimits
    monthlyFreePageLimit: number;
    allowedFormats: string[];        // e.g. ['article','news']
    resetCycle: 'daily' | 'monthly' | 'yearly';
  };
  tiers: Array<{
    id: string;
    label: string;
    minPages: number;
    maxPages: number | null;
    priceUzs: number;
    sortOrder: number;
  }>;
};
```

Admin editors:

- `apps/admin/src/pages/ImportPricingPage.tsx`
- `GET/PATCH /admin/import-pricing`, `/admin/import-pricing/tiers/:id`, `/admin/import-pricing/limits`

When an admin changes a tier price, the next cache miss of `GET /marketing/landing` must reflect it (TTL in §7). Do not bake seed defaults (`12 000 / 29 000 / 49 000 / 79 000 soʻm` in `prisma/seed.ts`) into the frontend.

Copy rules:

- Headline: pay-as-you-go, no subscription.
- Show free allowance from `freeLimits` (“3 free imports / day”, “50 free pages / month”, formats) as **live numbers**, not `FALLBACK_PLANS` “15 imports”.
- Page-tier table is the paid path (URL / PDF / paste length → pages → tier).
- Footnote: “Minimum Atmos charge is {atmosMinAmountSom} soʻm.”
- Catalog book prices belong in **Catalog**, not this table.

### 4.3 Top readers (leaderboard)

There is **no** existing public leaderboard. `apps/web-learner/src/pages/SettingsPage.tsx` says display name is “Shown on your profile and leaderboard,” but no ranking API exists. Admin gamification (`admin.service.ts`) only aggregates streaker counts.

**Ranking (use metrics the codebase already tracks):**

| Rank key | Source | Why |
|----------|--------|-----|
| **Primary sort:** `minutesRead` desc | `sum(ReadingProgress.totalReadSeconds)` / 60 | Reading-first product |
| Tie-break 1 | `effectiveStreakCount(User.streakCount, User.streakLastDate)` | `streak.service.ts` — ignore broken streaks |
| Tie-break 2 | `UserVocabulary` count (`wordsLearned`) | Same counter as `UsersService.getStats().vocabularyTotal` |
| Tie-break 3 | `User.createdAt` asc | Stable |

**Eligibility**

- `liveLearnerWhere()`: `deletedAt = null`, no `adminProfile`, email not in `SYNTHETIC_USER_EMAILS` / `@gotcha.test` / `@example.com` / `@mailinator.com` / prefixes `androidqa`, `smoke.`, `smtp.verify`, `gotcha.verify.test`, `verifytest` (`production-users.ts`).
- Minimum activity so idle accounts are not “top students”: `minutesRead >= 30` **or** (`streakDays >= 3` and `wordsLearned >= 10`).
- Must have a usable `displayName` (trimmed, length ≥ 2). If missing, **skip the user** — do not fall back to email, username-from-email, or “Learner 4”.
- Cap: **6** (Figma may show 3 on mobile, 6 on desktop).

**Public DTO (privacy)**

```ts
type LandingTopReader = {
  rank: number;            // 1-based
  displayName: string;     // never email
  initials: string;        // 1–2 letters from displayName
  minutesRead: number;
  streakDays: number;      // effective streak, may be 0
  wordsLearned: number;
};
```

Do **not** return: `id`, `email`, `avatarUrl` (avatars can be identifying), target language, currently-reading title. Do not return synthetic Figma personas.

Empty cohort: `topReaders: []`. Figma empty variant — see §8.

---

## 5. Public API plan

### 5.1 Recommendation: one aggregated endpoint

**`GET /api/v1/marketing/landing`**

- Module: extend `services/api/src/modules/marketing/` (`marketing.controller.ts`, `marketing.service.ts`).
- Decorator: `@Public()` (same as existing `/marketing/stats` and `/marketing/plans`).
- Why this path, not `/content/feed`: the marketing origin has no JWT; feed is learner-personalized (continue reading, my imports, `accessGranted`).
- Why not `/admin/import-pricing`: admin-only, includes revenue.
- Why one payload: `apps/web` already uses `Promise.allSettled` for two calls; three more authenticated-incompatible calls would still leave gaps. One round trip, one cache key, one degraded fallback.

Keep `GET /marketing/plans` and `GET /marketing/stats` until the landing is fully switched, then either:

- make `/stats` delegate to the same live count (no 12,840 floor), or
- leave them as compatibility shims.

Do **not** create a parallel `/public/landing` controller unless a later gateway needs a `/public` namespace. Functionally identical; prefer the existing marketing module.

### 5.2 Response shape

```ts
type LandingPayload = {
  generatedAt: string; // ISO
  stats: {
    learnerCount: number; // liveLearnerWhere() only — never a design floor
  };
  languages: Array<{
    code: string;
    name: string;
    nativeName: string;
    flagEmoji: string;
  }>;
  catalog: {
    source: 'featured' | 'recent';
    items: LandingCatalogItem[];
  };
  importPricing: LandingImportPricing;
  topReaders: LandingTopReader[];
};
```

HTTP:

- `200` with possibly empty arrays.
- `Cache-Control: public, max-age=30, stale-while-revalidate=120`
- No cookies, no `Authorization` required.
- Do not 500 the marketing page: catch per-block errors and return empty arrays for that block (see §7).

### 5.3 Client (`apps/web`)

Today: `apps/web/src/lib/api.ts` fetches `/marketing/plans` and `/marketing/stats`.

Target:

1. `fetchMarketingLanding()` → `GET ${VITE_API_URL}/marketing/landing`.
2. On success: render slots; persist JSON in `sessionStorage` key `gotcha.landing.v1`.
3. On failure: use sessionStorage last-known if younger than 24h; otherwise empty variants. **Do not** use `FALLBACK_LEARNER_COUNT` (12,840) or `FALLBACK_PLANS` USD-style cards.
4. Resolve covers with a copy of `resolveMediaUrl` (admin `media.ts`). Production `VITE_API_URL` is `https://gotchaa.uz/api/v1`.
5. Same-origin production (`gotchaa.uz` → `/api/v1`) avoids CORS. Locally, `API_CORS_ORIGINS` already includes `http://localhost:5174` (`main.ts`).

CTAs stay on the learner app (`VITE_LEARNER_APP_URL`, production `/learn/`).

### 5.4 Rate limit

Global throttler: 120 req/min (`app.module.ts`). A public landing GET is cheap; still cache so a traffic spike does not hit Prisma for every page view.

---

## 6. Admin controls (system materials on the landing)

Prefer existing featured collections over a new landing CMS.

### 6.1 What exists

| Mechanism | Where | Admin UI? |
|-----------|--------|-----------|
| `ContentCollection.isFeatured` + `ContentCollectionItem.sortOrder` | Prisma; learner `GET /content/feed` | **No** — seed only (`starter-library`) |
| Publish | `PATCH /admin/content/:id/publish` → `publishContent()` | Yes — `ContentPage.tsx` / `ContentEditorPage.tsx` |
| Price | `ContentItem.isFree` + `priceUsd` (soʻm) | Yes — editor Free/Paid + soʻm, min 500 |
| Cover | `POST` cover upload → `coverImageKey` | Yes |

### 6.2 Recommended control (thin, no new CMS)

Add a boolean on the existing content editor / catalog row: **Show on landing**.

Implementation (Phase 1, after Figma — not this task):

1. Ensure a single featured collection exists (reuse slug `starter-library` or `landing-showcase` with `isFeatured: true`). Do not seed demo books into it.
2. Toggle on: `ContentCollectionItem` upsert for that collection.
3. Toggle off: delete the join row.
4. Landing query uses that collection first; if empty, recently published catalog.

Do **not** add `ContentItem.showOnLanding` unless the join table proves awkward — the collection model already expresses “featured shelf.”

Publish behavior: publishing does **not** auto-feature. Editors opt in. Recently-published fallback still fills the shelf when nothing is featured so a newly published MOBY-DICK (or any real catalog book) can appear without a second click.

Unpublish / archive: unpublished items drop out of both featured and recent queries automatically.

### 6.3 What admins do **not** get

- A separate marketing CMS, page builder, or testimonial editor.
- Re-seed of Figma demo catalog / Unsplash covers as production showcase.
- Leaderboard pinning or fake “top student” rows.

Import prices remain **Import & Pricing** (`/admin/import-pricing/tiers` and `/limits`). Catalog prices remain the content editor.

---

## 7. Caching, freshness, and failure

Goals: landing stays fast; admin price/catalog changes show within ~1–2 minutes; API outage never blanks the whole marketing site with an error splash.

### 7.1 Server

There is **no** `CacheModule` / Redis usage in `services/api/src` today. Redis exists in compose for the job queue, not HTTP cache.

Phase 1: **in-process memory cache** in `MarketingService` (TTL **60s**) for the full `LandingPayload`. Invalidate on TTL only (no admin hook required). Optional later: Redis key `marketing:landing` if multiple API workers.

Per-block isolation:

```
try catalog → items or []
try importPricing → tiers or empty + atmosMinAmountSom fallback 500
try topReaders → [] 
try stats → learnerCount 0
```

Never fail the request because top readers timed out.

Headers: `Cache-Control: public, max-age=30, stale-while-revalidate=120`. CDN/nginx can honor this; `location /` for `apps/web` is SPA `index.html` (short cache); the **API** response is what SWR applies to.

### 7.2 Client

- Fetch once per page load; do not poll.
- `sessionStorage` last-known payload.
- `Promise.allSettled` is unnecessary if there is a single endpoint; still catch network errors.
- If the document is up but API is down: render evergreen sections (hero, how, features, footer) + last-known dynamic blocks if present; otherwise empty variants.
- **Forbidden fallbacks:** `FALLBACK_LEARNER_COUNT`, invented testimonials, hardcoded Unsplash catalog, seed page-tier numbers presented as live.

### 7.3 Freshness expectations

| Change in admin | Visible on landing |
|-----------------|--------------------|
| Publish / unpublish / cover / price | ≤ 60s (cache TTL) + 30s browser max-age |
| Import page tier / free limits | same |
| Learner streak / minutes | same (leaderboard is not realtime) |

---

## 8. Empty and privacy states (top readers and the rest)

### 8.1 Top readers — small live cohort

If `topReaders.length === 0` (typical early production):

- Figma: one calm empty module, not three ghost cards with fake names.
- Copy direction: “Be among the first to build a reading streak on GOTCHA.” + CTA to register.
- Do **not** show 0-minute users, emails, or “Alina T.”
- If `1 ≤ n < 3`: show `n` real cards; do not duplicate or pad.

If `learnerCount` is small but `topReaders` is empty because nobody passed the activity threshold, still show the empty readers module rather than promoting inactive accounts.

### 8.2 Catalog empty

No published catalog (or only user imports): hide the shelf or empty state “Library is being curated.” Never re-seed Figma samples to fill it.

### 8.3 Pricing empty

No tiers in DB: keep pay-as-you-go explanation; hide the table. Still show Atmos min if known.

### 8.4 Stats

`learnerCount === 0`: CTA without a numeral (“Start reading for free”), not “Join 0 learners” and not “Join 12,840 learners.”

### 8.5 Privacy checklist

- Public JSON contains no emails, user ids, or avatars.
- Synthetic/QA users excluded via `liveLearnerWhere()`.
- `displayName` only; skip users without one.
- Covers are catalog art, not user photos.
- Do not log landing query params that could identify a reader.

---

## 9. Out of scope

- Android app / APK / Play listing / excluding APK from VPS deploy (already excluded).
- Learner paywall UX, Atmos card/OTP modal, `CatalogPaywall.tsx`, `POST /billing/content/:id/checkout`.
- Re-seeding demo catalog, SAMPLE_STORIES, Figma admin metrics books, Unsplash seed covers as marketing inventory.
- Building a new marketing CMS, blog, or i18n site (EN/RU/UZ landing copy can be design-static for Phase 1).
- Premium / `SubscriptionPlan.premium` / `$9/mo`.
- Implementing Figma or this API in the same change as this document.

---

## 10. Implementation phases (after Figma — do not implement here)

### Phase 0 — Figma (this is the current phase)

1. Open [Gotcha — Language Learning](https://www.figma.com/design/66RRxTemdRSw60Fg4NUrUn/Gotcha-%E2%80%94-Language-Learning) (`66RRxTemdRSw60Fg4NUrUn`).
2. Design **Landing** at 1440 / 768 / 390 with the section list in §3.
3. Name slots exactly as in §3.1.
4. Provide **loading / populated / empty / degraded** variants for Catalog, Pricing, Top readers, and CTA count.
5. Use UZS soʻm in pricing and catalog price chips; no Premium; no invented students; no demo catalog titles as if they were production.
6. Hand off: this markdown + Figma frame links. Engineering does not invent layout.

### Phase 1 — Public API + wiring

1. `GET /api/v1/marketing/landing` in `MarketingModule` (`@Public()`).
2. Catalog query: featured `ContentCollection` then recent published catalog; `catalogPriceUzs()`; exclude user imports.
3. Import pricing: active `ImportPageTier` + `getImportFreeLimits()` + `atmosMinAmountSom()`.
4. Top readers: ranking in §4.3 + `liveLearnerWhere()`.
5. Stats: `prisma.user.count({ where: liveLearnerWhere() })` with **no** design floor. Fix or wrap `MarketingService.stats()` so it cannot keep advertising 12,840.
6. In-memory TTL cache + `Cache-Control`.
7. Optional: **Show on landing** toggle writing `ContentCollectionItem` (existing tables).
8. `apps/web`: fetch, `resolveMediaUrl`, sessionStorage last-known, hide/empty per §8. Remove invented testimonials. Stop using `FALLBACK_LEARNER_COUNT` as live truth.
9. Nav anchors `#catalog`, `#pricing`, `#readers`.

### Phase 2 — Polish

1. Pixel-match Figma (tokens, motion, reduced-motion).
2. Responsive QA of cards (cover aspect, CEFR chip, soʻm wrapping).
3. Optional Redis cache if API is multi-instance.
4. Deprecate `/marketing/plans` from the landing once copy is fully data-driven.
5. Analytics: section impressions only — no PII.

---

## 11. File map (what exists today)

| Path | Role |
|------|------|
| `apps/web/src/pages/LandingPage.tsx` | Current landing (static + plans/stats) |
| `apps/web/src/lib/api.ts` | `fetchMarketingPlans`, `fetchMarketingStats` |
| `apps/web/src/lib/links.ts` | Learner URLs + **unsafe** fallbacks (12,840 / `$0` plans) |
| `apps/web/src/components/SiteChrome.tsx` | Nav / footer |
| `apps/web/vite.config.ts` | Dev port **5174** |
| `services/api/src/modules/marketing/` | Public plans + stats |
| `services/api/src/modules/content/content.service.ts` | Authenticated feed; `serializeContent`; featured collections |
| `services/api/src/modules/content/catalog-access.ts` | `catalogPriceUzs`, user-import exclusion |
| `services/api/src/modules/billing/import-commerce.service.ts` | Real checkout tiers (`ImportPageTier`) |
| `services/api/src/modules/admin/admin.service.ts` | Publish, import pricing, `liveLearnerWhere` KPIs |
| `apps/admin/src/pages/ImportPricingPage.tsx` | Admin UZS tiers + free limits |
| `apps/admin/src/pages/ContentEditorPage.tsx` | Publish + catalog soʻm price |
| `apps/admin/src/lib/media.ts` | Cover URL resolver to reuse |
| `services/api/src/common/production-users.ts` | Synthetic email exclusion |
| `services/api/src/services/streak.service.ts` | `effectiveStreakCount` |
| `deploy/nginx/gotcha.conf` | `/` marketing, `/learn/`, `/admin/`, `/api/`, `/uploads/` |

---

## 12. Gaps discovered (for Phase 1)

1. **No public catalog list.** `GET /content/feed` requires JWT and mixes personal library state. Landing cannot show admin-published books today.
2. **No public import price list.** Live UZS tiers live behind `GET /admin/import-pricing`. `GET /marketing/plans` does not read `ImportPageTier`.
3. **No leaderboard API.** Settings mentions one; nothing ranks live learners for the marketing site.
4. **`MarketingService.stats()` is unsafe for production honesty:** counts all users (including synthetic/admins) and sets `displayLearnerCount = max(count, 12840)`.
5. **Invented testimonials** on the current landing conflict with “use real live learners.”
6. **`ContentCollection.isFeatured` has no admin UI.** Publish does not add items to the featured shelf. Landing should fall back to recently published until a “Show on landing” toggle exists.
7. **`ImportPricingRule` is unused at checkout.** Do not display those rows as what users pay.
8. **Client fallbacks in `links.ts`** (`FALLBACK_LEARNER_COUNT`, `$0` / “15 imports”) will fight live UZS pricing if left as the offline default.
9. **No HTTP cache layer** in the API. Phase 1 should add a short in-memory TTL rather than hitting Prisma on every visit.
10. **Cover resolution** is implemented for admin/learner, not for `apps/web`.
11. **Figma product prompt is stale** on subscriptions; this document overrides it for the landing.

---

## 13. Definition of done (when engineering implements, post-Figma)

- Figma landing exists with named slots and empty/degraded variants.
- Anonymous `GET /api/v1/marketing/landing` returns catalog, UZS import tiers, top readers, and a live learner count.
- Admin publish + import-tier edits appear on the landing after cache TTL without a deploy.
- No emails, no synthetic users, no fake 12,840, no Premium, no demo-catalog padding.
- Marketing page remains usable if the API is down (evergreen sections + last-known or empty states).
