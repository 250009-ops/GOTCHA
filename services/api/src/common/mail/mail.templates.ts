export type EmailLayoutOptions = {
  preheader?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildEmailHtml(options: EmailLayoutOptions): string {
  const appUrl = (process.env.LEARNER_APP_URL || process.env.APP_URL || 'https://gotchaa.uz/learn').replace(
    /\/$/,
    '',
  );
  const ctaBlock =
    options.ctaLabel && options.ctaUrl
      ? `<p style="margin:28px 0 0;">
          <a href="${options.ctaUrl}" style="display:inline-block;background:#6c1d95;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;">
            ${escapeHtml(options.ctaLabel)}
          </a>
        </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader ?? options.title)}</span>
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
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(options.title)}</h1>
              <div style="font-size:15px;line-height:1.6;color:#4b5563;">${options.bodyHtml}</div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                ${escapeHtml(options.footerNote ?? `You received this email from GOTCHA (${appUrl}).`)}
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

export function emailVerificationEmail(
  name: string,
  verifyUrl: string,
): { subject: string; text: string; html: string } {
  const title = 'Verify your email for GOTCHA';
  const text = [
    `Hi ${name},`,
    '',
    'Thanks for creating your GOTCHA account.',
    'Please verify your email address to finish sign-up.',
    '',
    `Verify: ${verifyUrl}`,
    '',
    'This link expires in 24 hours. If you didn’t request this, you can ignore this email.',
  ].join('\n');

  const html = buildEmailHtml({
    preheader: 'Verify your email to continue.',
    title,
    bodyHtml: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thanks for creating your <strong>GOTCHA</strong> account.</p>
      <p style="margin-top:12px; font-size:13px; color:#4b5563;">Please verify your email address to finish sign-up. After verification, you can sign in and start reading.</p>
    `,
    ctaLabel: 'Verify email',
    ctaUrl: verifyUrl,
    footerNote:
      'If the button does not work, copy and paste this link into your browser: ' + verifyUrl,
  });

  return { subject: title, text, html };
}

export function passwordResetEmail(
  name: string,
  resetUrl: string,
): { subject: string; text: string; html: string } {
  const title = 'Reset your GOTCHA password';
  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your GOTCHA password.',
    'Use the link below to choose a new password.',
    '',
    `Reset password: ${resetUrl}`,
    '',
    'This link expires in 1 hour. If you didn’t request a reset, you can ignore this email.',
  ].join('\n');

  const html = buildEmailHtml({
    preheader: 'Reset your GOTCHA password.',
    title,
    bodyHtml: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received a request to reset your <strong>GOTCHA</strong> password.</p>
      <p style="margin-top:12px; font-size:13px; color:#4b5563;">Click the button below to choose a new password. If you didn’t ask for this, you can safely ignore this email.</p>
    `,
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footerNote:
      'If the button does not work, copy and paste this link into your browser: ' + resetUrl,
  });

  return { subject: title, text, html };
}
