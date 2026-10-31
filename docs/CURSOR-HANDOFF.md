# Gotcha — Cursor handoff (31 Oct 2026, 20:44 Asia/Tashkent)
All agent work STOPPED at Sarvarbek's request. Nothing deployed after final-6 + data fixes. No secrets in this file.

## Live on prod (VPS2 189.74.96.74, nginx + pm2 gotcha-api:3200 + gotcha-worker, Postgres)
- final-6: API 6d381d1, learner 443a8e9 (live ~19:01). Payments ON (PAYMENT_GATEWAY_ENABLED=true, ATMOS_SANDBOX=false). Never rotate Atmos/API keys.
- Data fix 04 (Plus 24,990/30d, 199,990/365d), monthly page reset, Plus caps 20/day & 2000 pages/month, Free 3 imports/day & 50 pages/month.
- Free Plus pass granted to user 79278ffb (to 30 Nov).
- Landing r4 (9680835) live 19:45; old routes 301 to /.
- nginx: HTML no-store, hashed assets immutable.
- Backups/rollbacks: /root/backups/final6-20261031-185730/ + /root/rollback-final6.sh; /root/backups/pre-datafix04-20261031-193112/ + rollback-datafix04.sh, rollback-resetcycle.sh; rollback-nginx-cache.sh; rollback-landing-r4.sh; rollback-grant-79278ffb.sh.

## Known live bugs
- /learn/app/practice "Not Found": learner calls practice endpoints missing in API 6d381d1 -> fixed in 6.1a.
- Imports stuck: API queues to Postgres table import_queue_jobs but pm2 runs the old Bull (Redis) gotcha-worker. 2 rows stuck -> fixed in 6.1b.
- Paid imports that fail are charged (Atmos debit at /apply, only marked refund-due) -> fixed in 6.1b-r2.

## Frozen, NOT deployed (on the shared box, unpushed branches; QA was in progress, no GO yet)
- 6.1a: /workspace/gotcha-handoff/web-launch-04/ — API fe30056, learner ec51705. Practice endpoints, register Terms/Privacy/Oferta links, delete account, legacy route redirects, dismissible birth-year prompt, Plus prices, uz apostrophes, /marketing/landing 410. Contract check 139/0. DevOps also gets DEVOPS-SETTINGS.sql.
- 6.1b-r2: API c92935c (on top of fe30056) — DB-queue worker (dist/worker.js, run as pm2 `gotcha-import-worker --kill-timeout 30000`), SIGTERM hand-back, failed free imports don't use up the allowance, auto Atmos reverse for failed paid imports (reverse_failed + needs_attention fallback). 88/88 tests. Do NOT deploy 74355cd. The Atmos sandbox reverse test is still pending.
- Deploy order: 6.1a, then 6.1b-r2; stop the old gotcha-worker but keep its files; back up first.
- Guard: team/qa/tools/api-contract-check.sh must pass.

## Next patch
- covers-01: template covers only, no AI. Reuse the exact landing-page cover style for all books (admin-added, imports, catalog backfill incl. hero); new books get the landing frame, palette and type with a navy panel and a code-drawn motif; keep the originals + revert + admin upload override. Spec: team/uiux/COVER-STYLE-v1.md.
- Onboarding (approved): team/uiux/onboarding/ONBOARDING.md (level + language, tap-word demo, first book, Practice highlight; localStorage done flag; add U+02BB to the Manrope subset).
- Deferred: PAY2-27 footer contrast, 390px fixes, theme, Pay-as-you-go button, 50-word hint, dedicated AI-consent field, admin F1–F4 (Plus price/caps fields, payments views, Plus billing tier), remove admin 'daily' cycle option, pre-payment text extraction/URL fetch, WLF-39, Practice empty state.

## Code location
- The laptop repo C:\projects\GOTCHA_android app is at old 5e4eca0. Everything newer exists only on the shared box (/workspace/gotcha-handoff/). Sync with git bundles; no GitHub push without Sarvarbek's go. Don't touch the .env.

## Rules
- No pay, purchase, delete, push or external send without Sarvarbek's explicit go. Keep all user data and DB backups. Old builds may be deleted 24h after the new version is stable. No refunds, but nobody is charged for a failed import.

## Open
- Sarvarbek's own test payment after the deploy; the og-image re-scrape; DKIM; mail renewal before 30 Nov.
