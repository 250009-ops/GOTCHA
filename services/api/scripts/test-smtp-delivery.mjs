/**
 * Test SMTP delivery to a specific address with verbose SMTP logging.
 * Usage: node scripts/test-smtp-delivery.mjs 250421@newuu.uz
 */
import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

for (const envFile of [
  resolve(repoRoot, 'deploy/.env'),
  resolve(__dirname, '../.env'),
]) {
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

const to = process.argv[2] || '250421@newuu.uz';
const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT || '465');
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const from = process.env.SMTP_FROM?.trim() || 'GOTCHA <noreply@gotchaa.uz>';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  logger: true,
  debug: true,
});

try {
  await transporter.verify();
  console.log('\n--- SMTP verify OK ---\n');
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'GOTCHA delivery test',
    text: `Test delivery to ${to} at ${new Date().toISOString()}`,
    html: `<p>Test delivery to <strong>${to}</strong> at ${new Date().toISOString()}</p>`,
    replyTo: 'support@gotchaa.uz',
  });
  console.log('\n--- SEND RESULT ---');
  console.log(JSON.stringify({
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    envelope: info.envelope,
  }, null, 2));
} catch (err) {
  console.error('\n--- SEND FAILED ---');
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === 'object' && 'response' in err) {
    console.error('SMTP response:', err.response);
  }
  process.exit(1);
}
