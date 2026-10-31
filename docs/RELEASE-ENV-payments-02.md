# payments-02 release env (G5)

> **G4: `VITE_LEGAL_V2` must never be set in the deploy env** (no deploy/.env, CI, compose, systemd or build script).
> It is a QA-preview-only flag; builds for staging or production must be made without it. Check before every deploy:
> `grep -rn VITE_LEGAL_V2 deploy/ infra/ scripts/ .github/ apps/*/.env*` must print nothing.

Ship in the SAME release as payments-02 (the quiz cap is enforced in code since 0480d38, atomic since PAY2-04):

| Env | Value | Where | Effect |
|---|---|---|---|
| `VITE_PLUS_QUIZ_CAP_LIVE` | `true` | apps/web landing build (landing-premium-02, 65ac209) | Shows the Plus quiz bullet "200 chapter quizzes a day (10 on Free)" (plusB[1]). |

The in-app paywall (apps/web-learner, PlusPage) needs no env: variant 10c (lookups, quizzes, import discount,
Everything in Free) renders from `/billing/plus/offer` limits (plusQuizzes/freeQuizzes > 0 and importDiscountPct > 0);
covered by apps/web-learner/src/lib/payments.test.ts (plusBullets(50, true) → 10c, bQuiz text en/uz/ru).

Verified 31 Oct 2026 (Tashkent, UTC+5): lp02 QA-preview build (VITE_LEGAL_V2=true, local /tmp only, never a deploy build: see G4 above) with
`VITE_PLUS_QUIZ_CAP_LIVE=true` compiles the bullets to `[plusB[0], plusB[1], plusB[2]]`; with `false`, plusB[1] is absent.
