/**
 * Send GOTCHA university invitation emails to NewUU students.
 *
 * CSV source: scripts/student-exams.csv (Student ID → {id}@newuu.uz)
 *
 * Usage:
 *   node scripts/send-university-invitations.mjs                  # dry-run, first 5
 *   node scripts/send-university-invitations.mjs --send           # send all
 *   node scripts/send-university-invitations.mjs --send --limit 3
 *   node scripts/send-university-invitations.mjs --send --resume
 *   node scripts/send-university-invitations.mjs --send --only 250421@newuu.uz
 *
 * Loads SMTP from deploy/.env, services/api/.env, or process env.
 */
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const defaultCsv = resolve(repoRoot, 'scripts/student-exams.csv');
const sentLogPath = resolve(__dirname, '.university-invites-sent.log');

for (const envFile of [
  resolve(repoRoot, 'deploy/.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../.env.local'),
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

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const shouldResume = args.includes('--resume');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : shouldSend ? Infinity : 5;
const csvPath = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : defaultCsv;
const onlyEmail = args.includes('--only') ? args[args.indexOf('--only') + 1]?.trim().toLowerCase() : '';
const delayMs = Number(process.env.INVITE_EMAIL_DELAY_MS || '2000');

const appUrl = (process.env.APP_URL || process.env.VITE_WEB_URL || 'https://gotchaa.uz').replace(/\/$/, '');
const smtpHost = process.env.SMTP_HOST?.trim();
const smtpPort = Number(process.env.SMTP_PORT || '465');
const smtpSecureRaw = process.env.SMTP_SECURE ?? 'true';
const smtpSecure = smtpSecureRaw === 'true' || smtpSecureRaw === '1' || smtpPort === 465;
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const smtpFrom = process.env.SMTP_FROM?.trim() || 'GOTCHA <noreply@gotchaa.uz>';
const replyTo = process.env.SMTP_REPLY_TO?.trim() || 'support@gotchaa.uz';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({ preheader, title, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const ctaBlock = ctaLabel && ctaUrl
    ? `<p style="margin:28px 0 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#6c1d95;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader ?? title)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#6c1d95;padding:24px 28px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">GOTCHA</p>
              <p style="margin:6px 0 0;font-size:12px;color:#e9d5ff;">Read your way to fluency</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>
              <div style="font-size:15px;line-height:1.6;color:#4b5563;">${bodyHtml}</div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                ${escapeHtml(footerNote ?? `You received this email from GOTCHA (${appUrl}).`)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function universityInvitationEmail(firstName, lastName) {
  const name = firstName.trim() || 'there';
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const greeting = firstName.trim()
    ? `<strong>Assalamu alaykum, ${escapeHtml(name)}!</strong>`
    : '<strong>Assalamu alaykum!</strong>';
  const title = 'Fellow NewUU students — try GOTCHA';
  const text = [
    firstName.trim() ? `Assalamu alaykum, ${name}!` : 'Assalamu alaykum!',
    '',
    'We are fellow students at New Uzbekistan University building GOTCHA — a language learning app that helps you read your way to fluency.',
    '',
    'We are in early trials and would love your honest feedback. Please try it for free and let us know what you think.',
    '',
    'If you know friends who need a product like this, please recommend us — that helps us scale.',
    '',
    `Get started: ${appUrl}`,
    '',
    'Thank you,',
    'The GOTCHA team',
    'New Uzbekistan University',
  ].join('\n');

  const html = buildEmailHtml({
    preheader: 'Fellow NewUU students — try GOTCHA and share feedback.',
    title,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">${greeting}</p>
      <p>We are fellow students at <strong>New Uzbekistan University</strong> building <strong>GOTCHA</strong> — a language learning app that helps you read your way to fluency.</p>
      <p>We are in early trials and would love your honest feedback. Please try it for free and let us know what you think.</p>
      <p>If you know <strong>friends</strong> who need a product like this, please recommend us — that helps us scale.</p>
    `,
    ctaLabel: 'Try GOTCHA for free',
    ctaUrl: appUrl,
    footerNote:
      'You received this from fellow NewUU students via GOTCHA (noreply). Reply to support@gotchaa.uz with questions or feedback.',
  });

  return { subject: title, text, html, fullName };
}

function parseStudents(csvText) {
  const lines = csvText.split(/\r?\n/);
  const students = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const id = cols[0]?.trim();
    if (!/^\d{6}$/.test(id)) continue;
    students.push({
      studentId: id,
      email: `${id}@newuu.uz`,
      firstName: (cols[1] ?? '').trim(),
      lastName: (cols[2] ?? '').trim(),
    });
  }
  const byId = new Map(students.map((s) => [s.studentId, s]));
  if (byId.size !== students.length) {
    console.warn(`Warning: duplicate student IDs in CSV (${students.length - byId.size} duplicates dropped)`);
  }
  return [...byId.values()];
}

function loadSentSet() {
  if (!existsSync(sentLogPath)) return new Set();
  return new Set(
    readFileSync(sentLogPath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const students = parseStudents(readFileSync(csvPath, 'utf8'));
  const filtered = onlyEmail ? students.filter((s) => s.email === onlyEmail) : students;
  if (onlyEmail && filtered.length === 0) {
    console.error(`No student found for ${onlyEmail} in CSV`);
    process.exit(1);
  }
  const sentSet = shouldResume && !onlyEmail ? loadSentSet() : new Set();
  const pending = filtered.filter((s) => !sentSet.has(s.email));
  const batch = pending.slice(0, Number.isFinite(limit) ? limit : pending.length);

  console.log(`CSV: ${csvPath}`);
  console.log(`Students total: ${students.length}, already sent: ${sentSet.size}, pending: ${pending.length}`);
  console.log(`Mode: ${shouldSend ? 'SEND' : 'DRY-RUN'} | batch: ${batch.length}`);
  console.log(`From: ${smtpFrom} | Reply-To: ${replyTo} | App: ${appUrl}`);

  if (!shouldSend) {
    for (const s of batch) {
      const { subject, fullName } = universityInvitationEmail(s.firstName, s.lastName);
      console.log(`[dry-run] ${s.studentId} ${s.email} (${fullName}) — ${subject}`);
    }
    console.log('\nAdd --send to deliver. Example: node scripts/send-university-invitations.mjs --send --limit 1');
    return;
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in deploy/.env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.verify();
    console.log(`SMTP verified (${smtpHost}:${smtpPort})`);
  } catch (err) {
    console.error('SMTP verify failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < batch.length; i++) {
    const s = batch[i];
    const { subject, text, html, fullName } = universityInvitationEmail(s.firstName, s.lastName);
    try {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: s.email,
        subject,
        text,
        html,
        replyTo,
        encoding: 'utf-8',
      });
      appendFileSync(sentLogPath, `${s.email}\n`, 'utf8');
      ok++;
      console.log(`[${i + 1}/${batch.length}] sent ${s.studentId} ${s.email} (${fullName}) id=${info.messageId ?? 'n/a'}`);
    } catch (err) {
      fail++;
      console.error(`[${i + 1}/${batch.length}] FAILED ${s.email}:`, err instanceof Error ? err.message : err);
    }

    if (i < batch.length - 1) await sleep(delayMs);
  }

  console.log(`\nDone. Sent: ${ok}, failed: ${fail}, log: ${sentLogPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
