/**
 * Resume sending until every student from the CSV has been emailed.
 * Usage: node scripts/run-university-invites-until-done.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const csvPath = resolve(repoRoot, 'scripts/student-exams.csv');
const logPath = resolve(__dirname, '.university-invites-sent.log');
const sendScript = resolve(__dirname, 'send-university-invitations.mjs');

function stats() {
  const csv = readFileSync(csvPath, 'utf8');
  const sent = new Set(
    existsSync(logPath)
      ? readFileSync(logPath, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : [],
  );
  let total = 0;
  let missing = 0;
  for (const line of csv.split(/\r?\n/)) {
    const id = line.split(',')[0]?.trim();
    if (!/^\d{6}$/.test(id)) continue;
    total++;
    if (!sent.has(`${id}@newuu.uz`)) missing++;
  }
  return { total, sent: sent.size, missing };
}

while (true) {
  const s = stats();
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  console.log(`[${ts}] Sent: ${s.sent}/${s.total}, Missing: ${s.missing}`);
  if (s.missing === 0) {
    console.log('All students have been emailed.');
    break;
  }

  const result = spawnSync(process.execPath, [sendScript, '--send', '--resume'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    console.error(`Send batch exited with code ${result.status}, retrying in 10s...`);
    await new Promise((r) => setTimeout(r, 10000));
  } else {
    await new Promise((r) => setTimeout(r, 2000));
  }
}
