# GOTCHA — social media logo assets

Source: `apps/web-learner/public/brand/gotcha-mark.svg` + `gotcha-lockup-light.svg`
(rendered by `apps/web-learner/src/components/GotchaLogo.tsx`). Reproduced exactly; brand blue `#2107AA`.

| File | What |
|---|---|
| `gotcha-logo.svg` | The exact logo mark (blue rounded tile, white G) |
| `gotcha-avatar.svg`, `gotcha-avatar-{1024,512,400}.png` | **Primary avatar** — white G on full-bleed #2107AA square, safe for circle crops |
| `gotcha-avatar-white.svg`, `gotcha-avatar-white-{1024,512,400}.png` | Alternate — blue logo tile on white, padded for circle crops |
| `gotcha-horizontal-transparent.png` | Horizontal logo (tile + GOTCHA wordmark), 2000px wide, transparent — use on light backgrounds |
| `gotcha-horizontal-white.png` | Same, on white |

## Which file to use

| Platform | Profile picture | Notes |
|---|---|---|
| Instagram | `gotcha-avatar-1024.png` | Circular crop; shown at 320px |
| Telegram | `gotcha-avatar-1024.png` (or `-512`) | Circular crop |
| Facebook | `gotcha-avatar-1024.png` | Circular crop; min 400px |
| X (Twitter) | `gotcha-avatar-400.png` (or `-1024`) | Circular crop; 400×400 recommended |
| YouTube | `gotcha-avatar-1024.png` | 800×800 recommended, circular crop |
| LinkedIn (company page) | `gotcha-avatar-400.png` | Square; 400×400 recommended |

Use the `gotcha-avatar-white-*` variant instead where a light look is preferred.
Horizontal PNGs are for banners, posts, link previews and the LinkedIn/YouTube "about" areas.
