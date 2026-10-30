/**
 * Verify all student IDs from the CSV have been emailed.
 * Usage: node scripts/verify-university-invites.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const csvPath = resolve(repoRoot, 'scripts/student-exams.csv');
const logPath = resolve(__dirname, '.university-invites-sent.log');

const csv = readFileSync(csvPath, 'utf8');
const sent = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : [],
);

const all = [];
for (const line of csv.split(/\r?\n/)) {
  const id = line.split(',')[0]?.trim();
  if (!/^\d{6}$/.test(id)) continue;
  all.push(`${id}@newuu.uz`);
}

const missing = all.filter((e) => !sent.has(e));
console.log(`Total students: ${all.length}`);
console.log(`Sent: ${sent.size}`);
console.log(`Missing: ${missing.length}`);
if (missing.length) {
  console.log('First 20 missing:', missing.slice(0, 20).join(', '));
  process.exit(1);
}
console.log('All students have been emailed.');
process.exit(0);
