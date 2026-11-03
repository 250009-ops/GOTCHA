#!/usr/bin/env node
/**
 * Restore user_preferences.tts_enabled=false from a 31 Oct backup.
 *
 * Migrations 0039/0040 turned TTS on for everyone. This script only PRINTS
 * SQL for rows that were off in the backup. It does not connect and it does
 * not apply anything.
 *
 * Do not run the printed SQL on production without Sarvarbek.
 *
 * Usage: node scripts/restore-tts-from-backup.mjs <path-to-backup.sql>
 */
import { readFileSync } from 'node:fs';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node scripts/restore-tts-from-backup.mjs <path-to-backup.sql>');
  console.error('This script does not connect and does not apply SQL.');
  console.error('Do not run the printed SQL on production without Sarvarbek.');
  process.exit(1);
}

const sql = readFileSync(backupPath, 'utf8');
const ids = new Set();
const lines = sql.split(/\r?\n/);
let copyCols = null;

for (const line of lines) {
  const copy = line.match(/^COPY\s+(?:\S+\.)?"?user_preferences"?\s*\(([^)]+)\)\s+FROM\s+stdin;/i);
  if (copy) {
    copyCols = copy[1].split(',').map((c) => c.trim().replace(/"/g, ''));
    continue;
  }
  if (copyCols && line === '\\.') {
    copyCols = null;
    continue;
  }
  if (copyCols) {
    const ttsAt = copyCols.indexOf('tts_enabled');
    const userAt = copyCols.indexOf('user_id');
    if (ttsAt >= 0 && userAt >= 0) {
      const cells = line.split('\t');
      const flag = (cells[ttsAt] || '').toLowerCase();
      if (flag === 'f' || flag === 'false') ids.add(cells[userAt]);
    }
    continue;
  }
  if (/INSERT INTO\s+"?user_preferences"?/i.test(line) && /\bfalse\b/i.test(line)) {
    const id = line.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (id) ids.add(id[0]);
  }
}

const list = [...ids].filter(Boolean);
console.log('-- DO NOT RUN ON PRODUCTION WITHOUT SARVARBEK.');
console.log('-- Printed only. This script did not connect and did not apply anything.');
console.log(`-- Rows with tts_enabled=false in ${backupPath}: ${list.length}`);
if (list.length === 0) {
  console.log('-- No tts_enabled=false rows found. Nothing to restore.');
  process.exit(0);
}
const quoted = list.map((id) => `'${id.replace(/'/g, '')}'`).join(',\n  ');
console.log(`UPDATE user_preferences
SET tts_enabled = false
WHERE user_id IN (
  ${quoted}
)
AND tts_enabled = true;`);
