# CI test requirements (API) — web-launch-04 final-3

There is no CI config file in this repo (no .github/workflows, .gitlab-ci.yml or similar). Any CI job, or any
person running the release suite, MUST run the API suite like this:

```bash
# throwaway local PostgreSQL 17 only — never a prod or shared DB
export CI=true
export TEST_DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<throwaway_db>
export BOOT_SMOKE_DATABASE_URL=$TEST_DATABASE_URL   # boot-smoke refuses non-local hosts
export DATABASE_URL=$TEST_DATABASE_URL
cd services/api && npx prisma migrate deploy && npm run test:all
```

- `src/common/schema-drift.test.ts` (WLF-06) needs `TEST_DATABASE_URL`; it creates/drops its own shadow DB, so the
  DB user needs CREATEDB. Without the variable it SKIPs locally, and since final-3 it FAILS when `CI=true`.
- The DB tests `wl4-11-delete-purge`, `tts-quota-db`, `report-retention` also read `TEST_DATABASE_URL`.
- `src/prod-boot-refuse.test.ts` (WLF-09) runs the built dist with `NODE_ENV=production` and no CORS/admin URL and
  expects it to exit; it needs no DB.
- Mock or blank `OPENAI_API_KEY`, SMTP and Atmos keys; tests never need real secrets.

Example GitHub Actions service block if a workflow is added later:

```yaml
services:
  postgres:
    image: postgres:17
    env: { POSTGRES_USER: ci, POSTGRES_PASSWORD: ci, POSTGRES_DB: gotcha_test }
    ports: ['5432:5432']
env:
  CI: 'true'
  TEST_DATABASE_URL: postgresql://ci:ci@127.0.0.1:5432/gotcha_test
  BOOT_SMOKE_DATABASE_URL: postgresql://ci:ci@127.0.0.1:5432/gotcha_test
```
