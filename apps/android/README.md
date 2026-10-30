# GOTCHA Android (Jetpack Compose)

Native Android client for the GOTCHA platform — learner + admin in one app with role-based routing after login.

## Production API

Debug and release both talk to the live host:

```
https://gotchaa.uz/api/v1/
```

Web / legal / email deep-link origin: `https://gotchaa.uz`

Set in `app/build.gradle.kts` as `BuildConfig.API_BASE_URL` and `BuildConfig.WEB_BASE_URL` (same value for `debug` and `release`).

## Requirements

- Android Studio Ladybug+ (or SDK 35 + Build-Tools 35)
- JDK 17+ (Android Studio JBR works)
- Network access to `https://gotchaa.uz`

## Run (Android Studio)

1. Open folder `apps/android` in Android Studio.
2. Wait for Gradle sync.
3. Start an emulator (API 24+) or connect a device with USB debugging.
4. Run configuration **app**.

## Run (CLI)

```bash
cd apps/android
./gradlew.bat assembleDebug
./gradlew.bat installDebug
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`  
Debug applicationId: `app.gotcha.android.debug`  
Release applicationId: `app.gotcha.android`

## Release signing (Play Console)

Upload keystore (local only, gitignored):

- File: `apps/android/keystore/gotcha-upload.jks`
- Alias: `gotcha-upload`
- Credentials: `apps/android/local.properties` (`release.storePassword`, `release.keyPassword`)

Release SHA-256 fingerprint (upload key):

```
26:1A:18:56:EE:39:27:12:33:7E:8B:A9:28:1C:95:16:A9:33:B3:0B:51:E9:F3:37:70:BA:A6:E2:86:26:08:43
```

After Play App Signing enrollment, also add Google’s **app signing certificate** SHA-256 to:

- `apps/web/public/.well-known/assetlinks.json`
- `apps/web-learner/public/.well-known/assetlinks.json`

Then redeploy frontends (`npm run deploy:frontends`).

## Build release AAB

**Recommended:** Android Studio → **Build → Generate Signed Bundle / APK** → **Android App Bundle** → select `keystore/gotcha-upload.jks`.

CLI (needs ~16 GB RAM; 8 GB machines may OOM during R8/dex merge):

```bash
cd apps/android
build-release-aab.bat
```

Output: `app/build/outputs/bundle/release/app-release.aab`

CI alternative: GitHub Actions workflow `.github/workflows/android-release.yml` (requires repository secrets for the upload keystore).

## Mobile smoke test

From repo root:

```bash
npm run smoke:mobile
# with AAB artifact check:
node scripts/smoke-mobile.mjs --aab apps/android/app/build/outputs/bundle/release/app-release.aab
```

Validates production API routes, App Links, billing gateway, and optional connected-device checks.

## Figma

- Learner: [Mobile App `21:2`](https://www.figma.com/design/mYIXcSh2YNEDAnCBeajqit/Untitled?node-id=21-2)
- Admin: [Admin Mobile App `122:2`](https://www.figma.com/design/mYIXcSh2YNEDAnCBeajqit/Untitled?node-id=122-2)

### Admin mobile screens (wired)

Bottom tabs: **Dashboard · Content · Pricing · Users · More**

| Route | Figma frame | API |
|-------|-------------|-----|
| `dashboard` | admin-dashboard | `GET /admin/dashboard` |
| `content` | admin-content-store | `GET /admin/content` |
| `content/{id}` | admin-content-detail | content detail from admin list / content API |
| `add-product` | admin-add-product | `POST /admin/content` (+ optional publish) |
| `import-success/{id}` | admin-import-success | after create; `PATCH …/publish` |
| `import-error/{message}` | admin-import-error | validation / API failures |
| `pricing` | admin-import-pricing | `GET /admin/import-pricing` |
| `users` / `users/{id}` | admin-users-list / admin-user-detail | `GET /admin/users`, `PATCH /admin/users/:id` |
| `more` | admin-more-menu | `GET /admin/me` + badges; links AI Usage + Analytics |
| `notifications` | admin-notifications | `GET /admin/notifications` |
| `gamification` | admin-gamification | `GET /admin/gamification` |
| `support` / `support/{id}` | admin-support-tickets / admin-ticket-detail | `GET /admin/support` |
| `languages` | admin-languages | `GET /admin/languages` |
| `level-tests` | admin-level-tests | `GET /admin/level-tests` |
| `analytics` | admin-analytics | `GET /admin/analytics` |
| `ai-usage` | admin-ai-usage | `GET /admin/ai-usage` |
| `settings` | admin-settings | `GET /admin/settings` |

## Implemented vs deferred

**Implemented (wired to production):** splash, onboarding, sign-in/up, forgot-password, email verify / reset-password App Links, learner shell, reader + AI lookup + vocab, import (paste/URL/file + Atmos checkout), messaging (REST + polling; WS if the server exposes `/messaging/ws`), full admin mobile panel from Figma `122:2`.

**Play Console still needed:** release signing keystore, store listing, privacy policy URL in Play Console, Digital Asset Links for App Links, screenshots, Play App Signing.
