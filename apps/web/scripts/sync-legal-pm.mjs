#!/usr/bin/env node
// Copies the PM's current web legal fragments into legal-pm/ (WLF-07). Never reads pending-payments-02 or oferta.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.env.LEGAL_PM_DIR || '/workspace/gotcha-handoff/team/pm/legal/web';
for (const d of ['terms', 'privacy']) for (const l of ['en', 'ru', 'uz']) copyFileSync(join(dir, `${d}-${l}.html`), `legal-pm/${d}-${l}.html`);
console.log('legal-pm synced from', dir);
