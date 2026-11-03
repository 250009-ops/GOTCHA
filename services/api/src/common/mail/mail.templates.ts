export type EmailLayoutOptions = {
  preheader?: string;
  title: string;
  titleSubtitle?: string;
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
              <p style="margin:6px 0 0;font-size:12px;color:#e9d5ff;">Notanish soʻzni bosing · Tap the word you don't know</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(options.title)}</h1>
              ${
                options.titleSubtitle
                  ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(options.titleSubtitle)}</p>`
                  : '<div style="margin-bottom:16px;"></div>'
              }
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

function trilingualBlock(sections: Array<{ lang: string; greeting: string; paragraphs: string[] }>): string {
  return sections
    .map((section, index) => {
      const border =
        index < sections.length - 1
          ? 'padding-bottom:22px;margin-bottom:22px;border-bottom:1px solid #e5e7eb;'
          : '';
      const body = section.paragraphs.map((p) => `<p style="margin:0 0 10px;">${p}</p>`).join('');
      return `<div style="${border}">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7c3aed;">${escapeHtml(section.lang)}</p>
        <p style="margin:0 0 10px;font-size:15px;color:#111827;">${section.greeting}</p>
        ${body}
      </div>`;
    })
    .join('');
}

function trilingualCta(uz: string, ru: string, en: string): string {
  return `${uz} · ${ru} · ${en}`;
}

function trilingualTextBlock(
  name: string,
  sections: Array<{ heading: string; greeting: string; lines: string[] }>,
  actionLabel: string,
  actionUrl: string,
  footerLines: string[],
): string {
  const blocks = sections.map((section) =>
    [section.heading, section.greeting, ...section.lines, ''].join('\n'),
  );
  return [...blocks, `${actionLabel}: ${actionUrl}`, '', ...footerLines].join('\n');
}

export function emailVerificationEmail(
  name: string,
  verifyUrl: string,
): { subject: string; text: string; html: string } {
  const safeName = name.trim() || 'there';
  const subject = 'GOTCHA — Emailni tasdiqlang · Подтвердите email · Verify your email';
  const ctaLabel = trilingualCta('Emailni tasdiqlash', 'Подтвердить email', 'Verify email');

  const text = trilingualTextBlock(
    safeName,
    [
      {
        heading: "O'ZBEKCHA",
        greeting: `Salom, ${safeName}!`,
        lines: [
          'GOTCHA hisobingiz uchun rahmat.',
          'Ro‘yxatdan o‘tishni yakunlash uchun emailingizni tasdiqlang.',
          'Tasdiqlagach, tizimga kirib o‘qishni boshlashingiz mumkin.',
        ],
      },
      {
        heading: 'РУССКИЙ',
        greeting: `Здравствуйте, ${safeName}!`,
        lines: [
          'Спасибо за регистрацию в GOTCHA.',
          'Подтвердите email, чтобы завершить создание аккаунта.',
          'После подтверждения вы сможете войти и начать читать.',
        ],
      },
      {
        heading: 'ENGLISH',
        greeting: `Hi ${safeName},`,
        lines: [
          'Thanks for creating your GOTCHA account.',
          'Please verify your email address to finish sign-up.',
          'After verification, you can sign in and start reading.',
        ],
      },
    ],
    'Verify / Tasdiqlash / Подтвердить',
    verifyUrl,
    [
      'Havola 24 soat amal qiladi. Agar siz bu so‘rovni yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.',
      'Ссылка действует 24 часа. Если вы не запрашивали это письмо, просто проигнорируйте его.',
      'This link expires in 24 hours. If you did not request this, you can ignore this email.',
    ],
  );

  const html = buildEmailHtml({
    preheader: 'GOTCHA — emailni tasdiqlang / подтвердите email / verify your email.',
    title: 'Emailni tasdiqlang',
    titleSubtitle: 'Подтвердите email · Verify your email',
    bodyHtml: trilingualBlock([
      {
        lang: "Oʻzbekcha",
        greeting: `Salom, <strong>${escapeHtml(safeName)}</strong>!`,
        paragraphs: [
          '<strong>GOTCHA</strong> hisobingiz uchun rahmat.',
          'Ro‘yxatdan o‘tishni yakunlash uchun emailingizni tasdiqlang. Tasdiqlagach, tizimga kirib o‘qishni boshlashingiz mumkin.',
        ],
      },
      {
        lang: 'Русский',
        greeting: `Здравствуйте, <strong>${escapeHtml(safeName)}</strong>!`,
        paragraphs: [
          'Спасибо за регистрацию в <strong>GOTCHA</strong>.',
          'Подтвердите email, чтобы завершить создание аккаунта. После подтверждения вы сможете войти и начать читать.',
        ],
      },
      {
        lang: 'English',
        greeting: `Hi <strong>${escapeHtml(safeName)}</strong>,`,
        paragraphs: [
          'Thanks for creating your <strong>GOTCHA</strong> account.',
          'Please verify your email address to finish sign-up. After verification, you can sign in and start reading.',
        ],
      },
    ]),
    ctaLabel,
    ctaUrl: verifyUrl,
    footerNote:
      'Havola ishlamasa, brauzerga nusxa ko‘chiring / Если кнопка не работает, скопируйте ссылку / If the button does not work, copy and paste: ' +
      verifyUrl,
  });

  return { subject, text, html };
}

export function passwordResetEmail(
  name: string,
  resetUrl: string,
): { subject: string; text: string; html: string } {
  const safeName = name.trim() || 'there';
  const subject = 'GOTCHA — Parolni tiklash · Сброс пароля · Reset your password';
  const ctaLabel = trilingualCta('Parolni tiklash', 'Сбросить пароль', 'Reset password');

  const text = trilingualTextBlock(
    safeName,
    [
      {
        heading: "O'ZBEKCHA",
        greeting: `Salom, ${safeName}!`,
        lines: [
          'GOTCHA parolingizni tiklash so‘rovi qabul qilindi.',
          'Yangi parol o‘rnatish uchun quyidagi havoladan foydalaning.',
          'Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.',
        ],
      },
      {
        heading: 'РУССКИЙ',
        greeting: `Здравствуйте, ${safeName}!`,
        lines: [
          'Мы получили запрос на сброс пароля GOTCHA.',
          'Перейдите по ссылке ниже, чтобы задать новый пароль.',
          'Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
        ],
      },
      {
        heading: 'ENGLISH',
        greeting: `Hi ${safeName},`,
        lines: [
          'We received a request to reset your GOTCHA password.',
          'Use the link below to choose a new password.',
          'If you did not request a reset, you can safely ignore this email.',
        ],
      },
    ],
    'Reset / Tiklash / Сброс',
    resetUrl,
    [
      'Havola 1 soat amal qiladi.',
      'Ссылка действует 1 час.',
      'This link expires in 1 hour.',
    ],
  );

  const html = buildEmailHtml({
    preheader: 'GOTCHA — parolni tiklash / сброс пароля / reset your password.',
    title: 'Parolni tiklash',
    titleSubtitle: 'Сброс пароля · Reset your password',
    bodyHtml: trilingualBlock([
      {
        lang: "Oʻzbekcha",
        greeting: `Salom, <strong>${escapeHtml(safeName)}</strong>!`,
        paragraphs: [
          '<strong>GOTCHA</strong> parolingizni tiklash so‘rovi qabul qilindi.',
          'Yangi parol o‘rnatish uchun quyidagi tugmani bosing. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.',
        ],
      },
      {
        lang: 'Русский',
        greeting: `Здравствуйте, <strong>${escapeHtml(safeName)}</strong>!`,
        paragraphs: [
          'Мы получили запрос на сброс пароля <strong>GOTCHA</strong>.',
          'Нажмите кнопку ниже, чтобы задать новый пароль. Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
        ],
      },
      {
        lang: 'English',
        greeting: `Hi <strong>${escapeHtml(safeName)}</strong>,`,
        paragraphs: [
          'We received a request to reset your <strong>GOTCHA</strong> password.',
          'Click the button below to choose a new password. If you did not ask for this, you can safely ignore this email.',
        ],
      },
    ]),
    ctaLabel,
    ctaUrl: resetUrl,
    footerNote:
      'Havola ishlamasa, brauzerga nusxa ko‘chiring / Если кнопка не работает, скопируйте ссылку / If the button does not work, copy and paste: ' +
      resetUrl,
  });

  return { subject, text, html };
}

export function newMessageEmail(
  recipientName: string,
  senderName: string,
  preview: string,
  messagesUrl: string,
): { subject: string; text: string; html: string } {
  const title = `${senderName} sent you a message on GOTCHA`;
  const snippet = preview.trim().slice(0, 180) || 'Open GOTCHA to read it.';
  const text = [
    `Hi ${recipientName},`,
    '',
    `${senderName} sent you a new message on GOTCHA:`,
    '',
    snippet,
    '',
    `Open messages: ${messagesUrl}`,
    '',
    'You can turn off message emails in Settings → Email notifications.',
  ].join('\n');

  const html = buildEmailHtml({
    preheader: `${senderName}: ${snippet}`,
    title,
    bodyHtml: `
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong>${escapeHtml(senderName)}</strong> sent you a new message:</p>
      <p style="margin:16px 0;padding:12px 14px;background:#f5f3ff;border-radius:12px;color:#111827;">${escapeHtml(snippet)}</p>
      <p style="margin-top:12px;font-size:13px;color:#4b5563;">Open GOTCHA to reply. You can turn off these emails in Settings.</p>
    `,
    ctaLabel: 'Open messages',
    ctaUrl: messagesUrl,
    footerNote:
      'If the button does not work, copy and paste this link into your browser: ' + messagesUrl,
  });

  return { subject: title, text, html };
}

export function universityInvitationEmail(
  firstName: string,
  lastName: string,
  appUrl: string,
): { subject: string; text: string; html: string } {
  const name = firstName.trim() || 'there';
  const greeting = firstName.trim()
    ? `<strong>Assalamu alaykum, ${escapeHtml(name)}!</strong>`
    : '<strong>Assalamu alaykum!</strong>';
  const title = 'Fellow NewUU students — try GOTCHA';
  const text = [
    firstName.trim() ? `Assalamu alaykum, ${name}!` : 'Assalamu alaykum!',
    '',
    'We are fellow students at New Uzbekistan University building GOTCHA — a language learning app that explains a word in the sentence where you met it.',
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
      <p>We are fellow students at <strong>New Uzbekistan University</strong> building <strong>GOTCHA</strong> — a language learning app that explains a word in the sentence where you met it.</p>
      <p>We are in early trials and would love your honest feedback. Please try it for free and let us know what you think.</p>
      <p>If you know <strong>friends</strong> who need a product like this, please recommend us — that helps us scale.</p>
    `,
    ctaLabel: 'Try GOTCHA for free',
    ctaUrl: appUrl,
    footerNote:
      'You received this from fellow NewUU students via GOTCHA (noreply). Reply to support@gotchaa.uz with questions or feedback.',
  });

  return { subject: title, text, html };
}
