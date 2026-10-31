#!/usr/bin/env node
// payments-02 release only: copies the PM's pending-payments-02 Terms + Public Offer into legal-pm-payments/ (byte copies).
// Never used by web-launch-04. legal-pm/ (current terms/privacy) is left untouched.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.env.LEGAL_PM_PAYMENTS_DIR || '/workspace/gotcha-handoff/team/pm/legal/web/pending-payments-02';
for (const d of ['terms', 'oferta']) for (const l of ['en', 'ru', 'uz']) copyFileSync(join(dir, `${d}-${l}.html`), `legal-pm-payments/${d}-${l}.html`);
console.log('legal-pm-payments synced from', dir);
