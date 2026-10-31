#!/usr/bin/env node
// Copies the PM's current web legal fragments into legal-pm/ (WLF-07). Never reads pending-payments-02 or oferta.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.env.LEGAL_PM_DIR || '/workspace/gotcha-handoff/team/pm/legal/web';
// r3b (WLF-07): legal-pm/terms-* retired: /terms serves legal-pm-payments/ (pending-payments-02); only privacy is vendored here.
for (const d of ['privacy']) for (const l of ['en', 'ru', 'uz']) copyFileSync(join(dir, `${d}-${l}.html`), `legal-pm/${d}-${l}.html`);
console.log('legal-pm synced from', dir);
