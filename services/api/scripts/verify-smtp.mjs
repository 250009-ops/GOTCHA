/**
 * Verify SMTP without sending mail (unless --send-probe).
 * Usage:
 *   node scripts/verify-smtp.mjs
 *   node scripts/verify-smtp.mjs --send-probe 250421@newuu.uz
 */
import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

for (const envFile of [resolve(repoRoot, 'deploy/.env'), resolve(__dirname, '../.env')]) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT || '465');
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const from = process.env.SMTP_FROM?.trim() || 'GOTCHA <noreply@gotchaa.uz>';
const sendProbe = process.argv.includes('--send-probe');
const probeTo = sendProbe ? process.argv[process.argv.indexOf('--send-probe') + 1] : '';

if (!host || !user || !pass) {
  console.error('SMTP_HOST / SMTP_USER / SMTP_PASS missing');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log(`SMTP OK ${host}:${port} as ${user}`);
} catch (err) {
  console.error('SMTP verify FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
}

if (sendProbe) {
  if (!probeTo) {
    console.error('Usage: node scripts/verify-smtp.mjs --send-probe you@example.com');
    process.exit(1);
  }
  const info = await transporter.sendMail({
    from,
    to: probeTo,
    subject: 'Verify your email for GOTCHA',
    text: [
      'Hi there,',
      '',
      'Thanks for creating your GOTCHA account.',
      'Please verify your email address to finish sign-up.',
      '',
      'Verify: https://gotchaa.uz/learn/verify-email?token=probe',
    ].join('\n'),
    html: '<p>SMTP probe using the verification subject. Ignore this message.</p>',
  });
  console.log(`Probe sent to ${probeTo}: ${info.response} accepted=${JSON.stringify(info.accepted)}`);
}
