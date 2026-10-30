# Figma AI — Gotcha Product & Schema Prompt

**Copy everything below the horizontal rule into Figma AI.**

Do not paste UI instructions (colors, fonts, spacing, component shapes). This prompt defines **product behavior, data, and information architecture only**. Figma AI must own all visual design decisions using Figma's full capability: variables, design tokens, component variants, auto-layout, responsive constraints, accessibility, dark/light modes, micro-interactions, and prototype flows.

---

## INSTRUCTIONS TO FIGMA AI

You are designing the complete UI/UX for **Gotcha**, a professional language-learning platform competing with LingQ and Duolingo, with a **reading-first** methodology.

**Your responsibility:** visual design, layout, typography, color, motion, component library, and prototype connections.

**Not your input from this prompt:** pixel specs, color hex codes, font choices, or "make it look like X app." Use your best professional judgment and Figma-native patterns.

**Product constraints you must respect:**

- Platforms (four surfaces, one shared schema):
  1. **Flutter mobile app** — Android-first, phone + tablet
  2. **Desktop learner web app** — React, primary reading/study experience on laptop/desktop (1280px–1920px+)
  3. **React admin CMS** — desktop web for editorial staff
  4. **Marketing website** — desktop + mobile web for acquisition
- Languages in product: **English, Russian, Uzbek** (content + UI localization)
- Learner logo reference: purple wordmark "Gotcha" (brand exists; you define how it integrates)
- Mobile and desktop learner apps share the **same features and API** — desktop is not a stripped-down version; it is the power-user surface (wider layout, keyboard, multi-panel reader)
- Admin and marketing are separate Figma pages/sections from learner apps

**Figma file organization (recommended pages):**

| Page | Contents |
|------|----------|
| 🎨 Design System | Tokens, typography, components shared across all surfaces |
| 📱 Mobile Learner | Phone frames (375–430w) + tablet (768–1024w) |
| 🖥️ Desktop Learner | Web app frames (1280, 1440, 1920w) |
| ⚙️ Admin CMS | Editorial desktop (1440w) |
| 🌐 Marketing | Landing desktop + mobile breakpoints |

**Deliverables expected from you:**

1. Unified design system (variables, text styles, color modes, spacing scale, elevation) — **one system, surface-specific layout patterns**
2. Component library with variants (buttons, inputs, cards, chips, modals, toasts, nav bars, tabs, data tables, split panels)
3. All screens listed below (mobile **and** desktop learner) with **empty, loading, error, and success states**
4. Interactive prototypes:
   - Mobile: onboarding → library → reader → save word → SRS → practice
   - Desktop: login → library grid → open reader (3-panel) → click word → save → inline SRS sidebar
5. Admin CMS screens with data-dense tables and forms
6. Marketing site with pricing tied to subscription tiers
7. Accessibility: touch targets (mobile), focus rings + keyboard nav (desktop), contrast, screen-reader labels (annotate in Figma)
8. Responsive specs: document how mobile ↔ tablet ↔ desktop learner layouts relate (shared components, different shell)

---

## PRODUCT OVERVIEW

**Gotcha** helps users learn a target language by reading authentic texts (stories, articles, news, user imports). When users tap unknown words, AI provides translation + grammar notes. Saved words enter spaced repetition (SRS). After reading, AI generates comprehension quizzes from the same text.

**Target users:** self-directed adult learners, intermediate focus, trilingual Central Asian + global audience.

**Subscription tiers:**

| Tier | AI daily quota | Import limit | Offline |
|------|----------------|--------------|---------|
| Free | 50 lookups/quizzes per day | 10 imports | No |
| Premium | Higher quota | Unlimited | Yes (future) |

---

## DOMAIN SCHEMA (source of truth)

Design screens to display and edit these entities. Field names match API/database.

### User & profile

```
User {
  id, email, displayName, avatarUrl
  nativeLanguage: en | ru | uz
  uiLanguage: en | ru | uz
  streakCount: number
  streakLastDate: date
  timezone
}

UserTargetLanguage {
  targetLanguage: en | ru | uz
  cefrLevel: a1 | a2 | b1 | b2 | c1 | c2
  isPrimary: boolean
  placementScore: number?
}

UserPreferences {
  readerFontScale: number (default 1.0)
  readerTheme: light | dark | sepia
  readerLineSpacing: number
  showKnownWords: boolean
  ttsEnabled: boolean
  dailyGoalMinutes: number (default 15)
  notificationsEnabled: boolean
}
```

### Content

```
ContentItem {
  id, slug, title, subtitle?, description?
  language: en | ru | uz
  contentType: book | article | story | news | user_import
  contentSource: public_domain | licensed | rss | user_import | ai_generated
  cefrLevel: a1–c2
  genre?, coverImageUrl, audioUrl?
  wordCount, uniqueWordCount
  publishStatus: draft | review | published | archived
  progressPct? (computed per user)
  knownWordRatio? (computed per user)
}

ContentSegment {
  id, segmentIndex, title?, plainText
  tokenMap: JSON (word tokens for tap targets)
  sentenceMap: JSON
  wordCount
}

ContentCollection {
  slug, title, description?, language, isFeatured, sortOrder
  items: ContentItem[]
}

ContentBookmark {
  userId + contentId (saved library)
}
```

### Reading & analytics

```
ReadingProgress {
  contentId, segmentId?, charOffset, progressPct (0–100)
  knownWordRatio (0–1), totalReadSeconds, lastReadAt, completedAt?
}

ReadingSession {
  contentId, segmentId?, startedAt, endedAt?, durationSeconds
  wordsTapped, wordsSaved
}

UserKnownWord {
  lemma, sourceLang, status: unknown | learning | known | ignored
}
```

Reader must visually distinguish **unknown**, **learning**, **known**, and **ignored** lemmas (you decide how — underline, opacity, color token, etc.).

### Vocabulary & SRS

```
UserVocabulary {
  lemma, sourceLang, targetLang, translation
  contextSentence?, notes?
  easeFactor, intervalDays, repetitions
  dueAt, lastReviewedAt, mastered: boolean
}

Review rating enum: again | hard | good | easy
```

SRS review UI: show lemma → reveal translation → user picks one of four ratings.

### AI lookup

```
POST /ai/lookup → {
  lemma, translation, phonetic?, partOfSpeech?, grammarNote?
}
```

Show lookup UI with actions: **Save to vocabulary**, **Mark as known**, **Ignore word**.
- **Mobile:** bottom sheet or full-width drawer
- **Desktop:** anchored popover near clicked word, or persistent right dictionary panel (see Desktop Reader)

### Practice

```
PracticeSession {
  practiceType: comprehension | cloze | flashcard | writing
  questionCount, correctCount?, completedAt?
}

PracticeQuestion {
  prompt, options[]?, correctAnswer, explanation?
}
```

After reading a segment, offer practice types. Show score summary with per-question explanations.

### Imports

```
UserImport {
  title, importType: paste | url | pdf | epub
  sourceUrl?, language?, ingestionStatus: queued | processing | tokenizing | ready | failed
  errorMessage?, contentId?, isPublic
}
```

Show import history with status badges and retry for failed.

### Billing

```
SubscriptionPlan { tier: free | premium, name, priceMonthly, aiDailyQuota, importLimit, offlineEnabled }
UserSubscription { status: active | trialing | past_due | canceled, currentPeriodEnd?, provider? }
AiUsageDaily { lookupCount, quizCount, tokensUsed } // show usage vs quota
```

### Admin (CMS)

```
AdminUser { role: superadmin | editor | moderator | analyst }

License {
  rightsHolder, contractRef?, status: draft | pending | cleared | expired | revoked
  territories[], validFrom?, validUntil?, attributionText, royaltyNotes?
}

ModerationQueue {
  reason, status: pending | approved | rejected, reviewer?, notes?
}

IngestionJob {
  sourceType: url | pdf | epub | gutenberg | cms | paste
  status, attempts, errorMessage?, contentId?
}

AuditLog { action, entityType, entityId?, metadata, createdAt }
```

---

## MOBILE APP — SCREEN INVENTORY

For each screen, design all states: **loading skeleton**, **empty**, **error with retry**, **populated**.

### Authentication & onboarding

| Screen | Data shown | Actions |
|--------|------------|---------|
| Welcome | Brand, value props | Continue, Sign in |
| Register | email, password, displayName, nativeLanguage | Create account |
| Login | email, password | Sign in, Forgot password (future) |
| Target language pick | en / ru / uz multi-select, primary flag | Continue |
| Placement test (optional) | Sample reading passage, comprehension questions | Skip, Submit → suggested CEFR |
| Daily goal | Slider or presets (5–60 min) | Continue |
| Notification permission | System dialog trigger | Allow, Not now |

### Main navigation (learner)

Bottom or side nav tabs (you decide):

1. **Library** — content discovery
2. **Vocabulary** — saved words + SRS
3. **Import** — add content
4. **Profile** — stats, settings, subscription

### Library

| Screen | Data | Actions |
|--------|------|---------|
| Home feed | Featured collections, continue reading row, streak + daily goal progress | Open content, see all |
| Collection detail | Collection title, sorted ContentItems with cover, title, CEFR chip, progress bar | Open item |
| Search & filter | Query, filters: language, CEFR, contentType, genre | Apply filters |
| Content detail | Cover, title, description, wordCount, CEFR, knownWordRatio, progressPct | Start / Resume / Bookmark |
| Bookmarks list | Bookmarked ContentItems | Remove bookmark, open |

### Reader (core experience)

| Element | Behavior |
|---------|----------|
| Segment navigation | Previous / next segment or chapter list |
| Text body | Tap any token → AI lookup sheet |
| Progress | Auto-save charOffset + progressPct |
| Top bar | Title, segment indicator, settings (font, theme) |
| Bottom actions | Save progress, open practice, dictionary |
| Session timer | Contributes to streak + daily goal |
| Completion | Confetti/summary → offer quiz |

Reader settings drawer binds to `UserPreferences` (font scale, theme, line spacing, showKnownWords, tts).

### Vocabulary

| Screen | Data | Actions |
|--------|------|---------|
| Word list | lemma, translation, due date, source content title | Sort: recent / due / alpha, search |
| Word detail | Full entry + context sentence + review history | Edit notes, delete |
| SRS review queue | Count due today | Start review |
| Review session | Flashcard: lemma → reveal → rate again/hard/good/easy | Complete → stats |

### Practice

| Screen | Data | Actions |
|--------|------|---------|
| Practice picker | Available types for current segment | Start session |
| Quiz session | Questions one-by-one or scroll | Submit answers |
| Results | Score, correctCount/questionCount, explanations | Retry, back to library |

### Import

| Screen | Data | Actions |
|--------|------|---------|
| Import hub | Paste / URL / File tabs | — |
| Paste form | title, text, language | Submit → processing → ready |
| URL form | title, url, language | Submit → queued (poll status) |
| Import history | UserImport list with status badges | Open content when ready, retry failed |

### Profile & settings

| Screen | Data | Actions |
|--------|------|---------|
| Profile home | displayName, avatar, streakCount, stats summary | Edit profile |
| Stats | words learned, reading time, mastered count, CEFR progress | — |
| Settings | All UserPreferences fields | Save |
| Subscription | Current plan, usage meters (lookups/quizzes/imports), upgrade CTA | Manage (future payment) |
| Target languages | UserTargetLanguage list | Add/remove, set primary |
| Logout | — | Confirm logout |

---

## DESKTOP LEARNER WEB APP — SCREEN INVENTORY & UX

Design a **full-featured desktop learner experience** (not a responsive shrink of mobile). Same schema and API as mobile; optimized for mouse, keyboard, and wide screens. Target viewports: **1280×800 (min)**, **1440×900 (primary)**, **1920×1080 (large)**.

### Desktop UX principles (you implement visually)

| Principle | Desktop behavior |
|-----------|------------------|
| **Persistent shell** | Left sidebar navigation always visible; top bar for search, streak, daily goal, profile |
| **Multi-panel reader** | Reading column + optional right panel (dictionary / notes / segment list) + optional left chapter list |
| **Hover + click** | Word hover preview (translation tooltip); click opens full lookup with grammar |
| **Keyboard-first** | Shortcuts annotated in UI: `←/→` segments, `Space` reveal translation, `1–4` SRS rating, `/` search, `?` shortcut overlay |
| **Information density** | Library as grid or list toggle; vocabulary as sortable table; stats as dashboard cards |
| **Parallel tasks** | Review SRS in modal or side drawer without leaving current reader position |
| **Deep linking** | URL routes: `/library`, `/read/:contentId`, `/vocabulary`, `/practice/:sessionId`, `/import` |
| **Session continuity** | Resume reading banner on home; reader restores scroll/segment from `ReadingProgress` |

### Desktop app shell (global layout)

Design a **master layout frame** reused across authenticated screens:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Top bar: Logo | Global search | Streak + daily goal progress | Profile ▾ │
├──────────┬───────────────────────────────────────────────────────────────┤
│ Sidebar  │ Main content area (route-specific)                            │
│          │                                                               │
│ Library  │                                                               │
│ Reading* │                                                               │
│ Vocab    │                                                               │
│ Practice │                                                               │
│ Import   │                                                               │
│ Stats    │                                                               │
│ Settings │                                                               │
│          │                                                               │
│ [Upgrade]│                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
* "Reading" appears when a text is open; shows current title truncated
```

Sidebar states: expanded (icons + labels), collapsed (icons only). Active route highlighted. Premium upsell card at bottom for free users.

Top bar: global search (`ContentItem` title, genre, language); quick-switch target language; notification bell (future); avatar menu (profile, subscription, logout).

### Authentication & onboarding (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Marketing-style login split | Left: brand + illustration; Right: form card | email, password, Sign in, link to register |
| Register split | Same split layout | email, password, displayName, nativeLanguage |
| Onboarding wizard | Centered stepper (4–5 steps), max-width ~720px | Target languages → placement → daily goal → preferences preview |
| Placement test | Two-column: passage left, questions right | Submit → `PlacementResult.suggestedLevel` |
| Email verification (future) | Centered card | — |

Unauthenticated users hitting `/library` redirect to login (design redirect state).

### Library (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Home dashboard | Hero "Continue reading" card + stats row + collection shelves | `ReadingProgress`, streak, daily goal |
| Library browse | Filter sidebar (language, CEFR, contentType, genre) + main grid/list | `ContentItem[]` with cover, title, chips, progress bar |
| View toggle | Grid / list / compact list | User preference persisted |
| Search results | Full-width results with facet filters | Query + result count |
| Content detail | Two-column: cover + metadata left; description + actions right | Start, Resume, Bookmark, knownWordRatio, wordCount |
| Bookmarks | Same browse pattern, filtered to `ContentBookmark` | Remove bookmark |
| Collection page | Breadcrumb + collection header + item grid | `ContentCollection.items` |

Empty states: illustrated CTA to featured collection or import.

### Reader (desktop — core differentiator)

Design a **three-panel reader** as the hero desktop experience:

```
┌─────────────┬──────────────────────────────┬─────────────────────┐
│ Chapters /  │  Reading text (tokenized)    │ Dictionary panel    │
│ segments    │  Comfortable max line length │                     │
│ list        │  (~65–75 chars)              │ Selected word:      │
│             │                              │ lemma, translation, │
│ Segment 1   │  [Highlighted tokens by      │ phonetic, POS,      │
│ Segment 2 ● │   WordStatus]                │ grammarNote         │
│ Segment 3   │                              │                     │
│             │                              │ [Save] [Known]      │
│             │                              │ [Ignore]            │
│             │                              │                     │
│             │                              │ Saved words in      │
│             │                              │ this segment (list) │
└─────────────┴──────────────────────────────┴─────────────────────┘
```

| Element | Desktop behavior |
|---------|------------------|
| Segment list | Left panel; click jumps segment; shows read/unread indicator |
| Text column | Click token → populate dictionary panel; double-click selects sentence |
| Dictionary panel | Sticky right column (collapsible); shows `POST /ai/lookup` result |
| Hover tooltip | Lightweight translation on hover (optional preference) |
| Progress | Thin progress bar under title; `%` from `ReadingProgress.progressPct` |
| Toolbar | Font size, theme (light/dark/sepia), line spacing, show known words, TTS play |
| Footer bar | Prev/next segment, time this session, words tapped/saved, **Practice this segment** |
| Completion modal | Segment/chapter complete → stats + start quiz CTA |

Reader keyboard overlay (`?`): list all shortcuts.

Tablet/web narrow (<1280px): collapse to two-panel (hide chapter list) or single column with drawers — design breakpoint variant.

### Vocabulary (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Vocabulary hub | Stats cards (total, due today, mastered) + main table | Sortable columns: lemma, translation, dueAt, status, source |
| Table row actions | Inline: review, edit notes, open source content | — |
| Word detail | Slide-over panel from right (not full page) | contextSentence, review history, notes edit |
| SRS review | Full-screen focus mode OR centered card stack | lemma → reveal → Again/Hard/Good/Easy (buttons + keys 1–4) |
| Review complete | Summary: cards reviewed, retention, next due | Return to vocabulary or reader |

Bulk actions (future): select rows → mark mastered / delete.

### Practice (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Practice launcher | Modal or dedicated page; pick type for segment | comprehension, cloze, flashcard, writing |
| Quiz taking | Single question centered, max-width ~640px; progress stepper | `PracticeQuestion` one at a time |
| Multi-choice | Large clickable option cards | — |
| Results | Split: score circle + breakdown list with explanations | Retry, back to reader |

### Import (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Import page | Tabbed: Paste \| URL \| File (pdf/epub future) | — |
| Paste | Large textarea + metadata form side-by-side | title, language, text |
| URL | URL field + preview placeholder | Poll `ingestionStatus` — show progress stepper |
| Import history | Table: title, type, status badge, date, actions | Open when ready, retry failed |
| Drag-and-drop zone | File import (future) | Drop epub/pdf |

### Stats & profile (desktop)

| Screen | Layout notes | Data / actions |
|--------|--------------|----------------|
| Stats dashboard | Chart area (reading minutes over time) + KPI cards | `GET /users/me/stats` |
| Profile | Two-column settings layout | displayName, avatar upload, email (read-only) |
| Preferences | Grouped form sections | All `UserPreferences` fields with live reader preview |
| Subscription | Plan comparison + usage meters | lookups/quizzes/imports vs quota; upgrade CTA |
| Target languages | Table with primary badge | Add/remove languages, CEFR level edit |

### Desktop-specific modals & overlays

| Overlay | Trigger | Contents |
|---------|---------|----------|
| Global search (Cmd+K) | Keyboard or top bar | Recent + search results across content and vocabulary |
| Shortcut help | `?` | Keyboard map |
| AI quota warning | Limit reached | Usage stats + upgrade |
| Session expired | 401 | Re-login modal; preserve route after auth |
| Upgrade to Premium | Import/quota limit | Feature comparison |

### Desktop learner — states to design

- Sidebar collapsed vs expanded
- Dictionary panel open vs closed vs empty (no word selected)
- Reader: loading segment, error loading content, first-time empty lookup panel
- Global search: empty query (recents), no results, loading
- Split view at 1280 vs 1440 vs 1920 (annotate responsive behavior)
- Focus states for all interactive elements (keyboard navigation)
- Reduced-motion variant (respect prefers-reduced-motion)

---

## ADMIN CMS — SCREEN INVENTORY (desktop web)

**Viewport:** 1440×900 primary; min 1280. Data-dense editorial tool — distinct visual language from learner app (you decide: typically neutral/professional vs learner's warm/engaging).

### Admin shell

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Gotcha Admin | Environment badge | User menu                             │
├──────────┬───────────────────────────────────────────────────────────────┤
│ Nav      │ Breadcrumb > Page title                    [Primary action]   │
│          ├───────────────────────────────────────────────────────────────┤
│          │ Filters / tabs (optional)                                     │
│          │ Main table or form workspace                                    │
│          │                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
```

Navigation: Dashboard | Content | Collections | Licenses | Moderation | Ingestion | Users | Audit

Role-based nav visibility: `AdminUser.role` — moderator sees Moderation; analyst sees Dashboard + Audit; editor sees Content + Collections + Licenses.

| Screen | Purpose | Desktop UX notes |
|--------|---------|------------------|
| Login | Admin auth | Simple centered card; separate from learner login URL |
| Dashboard | KPIs: users, active readers, imports pending, moderation queue size | Card grid + trend sparklines; quick links to queues |
| Content list | Table: title, language, CEFR, status, wordCount, updatedAt | Column sort, multi-filter, bulk select, pagination |
| Content editor | ContentItem metadata + segment manager + token preview | Split: form left, live segment/token preview right |
| Publish workflow | Draft → Review → Published | Status stepper + confirmation modal + audit trail link |
| Collections | CRUD + drag-sort `ContentCollectionItem` | Master-detail: collection list left, items drag-list right |
| Licenses | CRUD License records | Form + linked content table |
| Moderation queue | Pending UserImports/content | Split: queue list left, detail + approve/reject panel right |
| Ingestion monitor | IngestionJob table | Status badges, expandable error logs, retry action |
| Users (future) | User search, subscription tier | Read-only table; support actions |
| Audit log | Read-only AuditLog | Filter by action, entityType, date range; export CSV |

Design patterns: sticky table headers, row hover actions, empty queue states, destructive action confirmations, toast notifications on save/publish.

---

## MARKETING WEBSITE — SCREEN INVENTORY

**Viewports:** Desktop 1440 + mobile 375. Public-facing; converts to register (learner web) or app download.

| Page | Desktop layout | Content blocks (copy direction only) |
|------|----------------|--------------------------------------|
| Home | Full-bleed hero, feature grid 3-col, social proof strip | Hero: "Learn languages by reading real texts"; CTA **Start free** + **Download app** |
| How it works | Horizontal 5-step timeline | Read → Tap → Save → Review → Practice |
| Features | Alternating image/text rows or bento grid | Reader, AI dictionary, SRS, imports, trilingual |
| Pricing | Side-by-side plan cards (Free vs Premium) | Feature comparison table; CTA per tier |
| Desktop app promo | Section highlighting 3-panel reader | "Study on the big screen" — link to web app signup |
| For schools (future) | B2B contact form | Placeholder |
| Blog / Changelog (future) | Card grid | — |
| Footer | Multi-column links | Legal, contact, social, language switcher |

Global: sticky nav with logo, Features, Pricing, Login, **Get started**; mobile hamburger menu.

---

## CROSS-SURFACE FEATURE PARITY

Mobile and desktop learner apps must expose the **same capabilities**. Use this matrix to ensure nothing is missing on either surface:

| Feature | Mobile | Desktop learner |
|---------|--------|-----------------|
| Auth + onboarding | ✓ | ✓ (split layout, stepper) |
| Library + search | ✓ | ✓ (grid/list + filter sidebar) |
| Reader + tap/click lookup | ✓ bottom sheet | ✓ dictionary panel + hover |
| Known-word highlighting | ✓ | ✓ |
| Save to vocabulary | ✓ | ✓ |
| SRS review | ✓ full screen | ✓ focus mode or modal |
| Practice quizzes | ✓ | ✓ |
| Import paste/URL | ✓ | ✓ (larger paste area) |
| Profile + settings | ✓ | ✓ (two-column) |
| Subscription + usage | ✓ | ✓ |
| Stats / streak | ✓ | ✓ (dashboard charts) |
| Bookmarks | ✓ | ✓ |
| Keyboard shortcuts | — | ✓ |
| Global search (Cmd+K) | search screen | ✓ command palette |

---

## KEY USER JOURNEYS (prototype these)

### Mobile
1. **New user:** Register → pick target UZ learning EN → placement → daily goal → library → open story → read → tap word → save → SRS review
2. **Returning user:** Login → continue reading (progress restored) → complete segment → practice quiz → see score
3. **Importer:** Paste article → wait for ready → read imported content
4. **Upgrade path:** Hit import limit → subscription screen → premium benefits

### Desktop learner
5. **Power reader:** Login → continue reading card → 3-panel reader → click unknown word → dictionary panel → save → mark known → next segment → launch practice quiz in modal
6. **Vocabulary session:** Global search → open word → edit notes → start SRS review (keyboard 1–4) → complete → stats dashboard
7. **Import workflow:** Import page → paste long article in split view → watch status stepper → open in reader when ready
8. **Cmd+K flow:** Command palette → search content → jump directly into reader at saved progress

### Admin
9. **Admin:** Login → review moderation item → approve → content appears in learner feed

---

## API ENDPOINTS (for developer handoff annotations)

Annotate frames with endpoint labels where helpful:

```
POST   /auth/register | /auth/login | /auth/refresh
GET    /users/me | /users/me/stats
PATCH  /users/me | /users/me/preferences
GET    /content/feed | /content | /content/:id | /content/:id/segments
PUT    /content/:id/progress
POST   /reading/sessions | PUT /reading/sessions/:id/end
GET    /reading/known-words | PUT /reading/progress/:contentId
GET    /vocabulary | /vocabulary/review-queue
POST   /vocabulary | /vocabulary/:id/review
POST   /ai/lookup
POST   /practice/sessions | /practice/sessions/:id/answers
GET    /imports | POST /imports/paste | /imports/url
GET    /billing/subscription | /billing/plans
GET    /admin/* (dashboard, content, licenses, moderation, ingestion)
```

---

## STATES & EDGE CASES TO DESIGN

### All surfaces
- Offline / no network (reader cached content — premium future)
- AI quota exceeded (friendly upsell, not hard error)
- Empty library (onboarding CTA to featured collection)
- Empty vocabulary (prompt to read and tap/click words)
- Import failed (show errorMessage, retry button)
- Session expired (re-auth without losing reader position)
- Long words / RTL-safe layout (Uzbek Latin script)

### Mobile-specific
- Tablet breakpoint (768–1024): optional 2-column library grid
- Bottom sheet vs full-screen modals for reader lookup
- Touch target minimums for SRS rating buttons

### Desktop-specific
- **1280 vs 1440 vs 1920:** reader panel collapse order (chapters → dictionary → compact toolbar)
- **Hover vs click:** tooltip on hover; full lookup on click — design both
- **Focus trap** in modals (SRS, practice, Cmd+K search)
- **Keyboard-only navigation** through library grid and vocabulary table
- **Scrollbar** styling in reader column for long segments
- **Browser back button:** confirm exit reader if unsaved progress (optional dialog)
- **Split login:** unauthenticated landing vs authenticated app shell
- **Empty dictionary panel:** placeholder illustration "Click a word to translate"
- **Reduced motion:** disable parallax/transitions on marketing and reader

---

## EXPLICIT NON-GOALS FOR THIS PROMPT

Do **not** ask the product owner for:

- Color palette approval
- Font selection approval
- Specific button shapes or icon style
- "Wireframe fidelity" — produce production-quality design

**You (Figma AI) are the visual designer.** This prompt is the product manager + backend architect briefing.

---

## REFERENCE

- Figma file name: **Gotcha — Language Learning**
- File key: `66RRxTemdRSw60Fg4NUrUn`
- Architecture doc: `docs/ARCHITECTURE.md`
- Schema file: `services/api/prisma/schema.prisma`
- Planned learner web app path: `apps/web-learner/` (future — design now, implement after mobile)
