# Import pagination & professional import paths

## Pagination rule (implemented)

| Constant | Value | Purpose |
|----------|-------|---------|
| `TARGET_SEGMENT_WORDS` | **100** | Preferred words per `ContentSegment` / reader page |
| `MAX_SEGMENT_WORDS` | **150** | Soft ceiling before forcing a split (~1.5× target) |
| Approx. chars | ~600–700 at ~100 words | Rough Latin-script estimate |

**Split order:** paragraph (`\n\n`) → sentence (`.!?…`) → hard word cut only if a single unit exceeds the max.

**Applies to:** paste import (API) and URL import (ingestion worker).

**Code:** `services/api/src/utils/tokenizer.ts` and `services/worker/src/utils/tokenizer.ts` (`paginateText`).

## Figma evidence

| Source | Finding |
|--------|---------|
| Make file `lnByZa67DhwO1884b0g5FH` — `mock-data.ts` `readerStory` | Chapters are narrative pages of **~150–220 words** each (no numeric constant) |
| Make `ImportPage` | Min paste **50 words**; PDF/EPUB UI “Max 10 MB”; scanned PDFs unsupported |
| Product prompt / schema | Segment list + prev/next; line length **~65–75 chars** only — **no words-per-page limit** |
| Design file `66RRxTemdRSw60Fg4NUrUn` | MCP read blocked without edit access on the Figma account |

**Chosen 100 words** (max 150) for shorter reader pages; Figma mock chapters were ~150–220 with no hard constant.

## What works now

| Path | Status |
|------|--------|
| **Paste** | Auto-splits into multiple `ContentSegment`s; reader prev/next + chapter list |
| **URL** | Queued → worker extracts text → same pagination (needs Redis + worker running) |
| **PDF / EPUB** | Schema + Figma UI only — **no upload API or parsers yet** |

## What you must still provide (professional all-paths)

1. **Infra (Docker already sketched in `infra/docker-compose.yml`)**
   - Postgres + **Redis** (URL worker / BullMQ)
   - **MinIO** (or S3) for PDF/EPUB blobs — env: `S3_*` in `.env.example`
2. **OpenAI key** — `OPENAI_API_KEY` for dictionary / quiz (not required for pagination)
3. **PDF parsing** — choose library (e.g. `pdf-parse` / `pdfjs`) or paid OCR for scans; Figma: text PDFs only
4. **EPUB parsing** — e.g. `epub2` / JSZip + HTML extract; map chapters → segments (prefer EPUB TOC over word-split when present)
5. **Upload API** — `POST /imports/file` multipart → MinIO → worker job (`pdf` / `epub`)
6. **URL quality (optional)** — Readability/Mozilla extract or similar (current HTML strip is basic)
7. **Gutenberg / RSS (if planned)** — API keys / feed URLs + licensing notes
8. **Legal** — ToS: user warrants rights to imported text; no hosting of pirated books; attribution for public-domain sources

## How to test locally

```bash
# Infra
docker compose -f infra/docker-compose.yml up -d

# API
cd services/api && npm run build && npm run start:dev   # or your usual start

# Worker (for URL imports)
cd services/worker && npm run start

# Paste long text (≥ ~150 words) → expect multiple segments
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"learner@gotcha.app\",\"password\":\"$LEARNER_PASSWORD\"}"
# Use accessToken:
curl -s -X POST http://localhost:3000/imports/paste \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Pagination test\",\"language\":\"en\",\"text\":\"<long text>\"}"
# Then GET /content/<contentId>/segments — expect Page 1, Page 2, …
```
