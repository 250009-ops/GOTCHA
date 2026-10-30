# Gotcha Figma Design — Build Scripts

Run these **in order** via Figma MCP `use_figma` after:

1. `.cursor/mcp.json` includes Figma server (done)
2. **Cursor → Settings → MCP → figma → Connect** (complete OAuth in browser)
3. **Reload Cursor window**
4. Agent chat: *"Run Gotcha Figma scripts from docs/figma"*

## Step 0 — Create file

Use MCP tool `create_new_file`:

```json
{
  "planKey": "<from whoami>",
  "fileName": "Gotcha — Language Learning",
  "editorType": "design"
}
```

Save the returned `file_key` and `file_url`.

## Scripts (use_figma)

| Order | Script | Purpose |
|-------|--------|---------|
| 1 | `01-pages.js` | Create 8 pages |
| 2 | `02-design-tokens.js` | Color variables + text styles |
| 3 | `03-components.js` | Buttons, cards, nav, reader tokens |
| 4 | `04-mobile-screens.js` | Library, reader, vocab, practice, profile |
| 5 | `05-admin-screens.js` | Dashboard, content, licenses |
| 6 | `06-marketing.js` | Landing page 1440px |

Each script returns `{ createdNodeIds }` for the next step.

## Design tokens

| Token | Hex |
|-------|-----|
| brand/primary | #6D28D9 |
| brand/accent | #0D9488 |
| brand/warm | #F59E0B |
| surface/background | #F8FAFC |
| surface/reader | #FFFEF9 |
| text/primary | #0F172A |

Font: **Plus Jakarta Sans** (Medium 500, Bold 700, ExtraBold 800)

Mobile frame: **390 × 844**

## If MCP tools are missing

1. Type `/add-plugin figma` in Agent chat again
2. Open **Cursor Settings → MCP** — ensure `figma` shows green/connected
3. Sign in with the Figma account that owns your team
4. Start a **new Agent chat** (fresh session loads MCP tools)
