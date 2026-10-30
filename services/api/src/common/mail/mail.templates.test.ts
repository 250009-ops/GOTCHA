import * as assert from 'node:assert/strict';
import {
  emailVerificationEmail,
  passwordResetEmail,
  universityInvitationEmail,
} from './mail.templates';

const verifyUrl = 'https://gotchaa.uz/learn/verify-email?token=abc123';
const resetUrl = 'https://gotchaa.uz/learn/reset-password?token=xyz789';

const verify = emailVerificationEmail('Sarvarbek', verifyUrl);
assert.match(verify.subject, /Emailni tasdiqlang/);
assert.match(verify.subject, /Подтвердите email/);
assert.match(verify.subject, /Verify your email/);
assert.match(verify.text, /O'ZBEKCHA/);
assert.match(verify.text, /РУССКИЙ/);
assert.match(verify.text, /ENGLISH/);
assert.match(verify.text, /Verify \/ Tasdiqlash \/ Подтвердить: https:\/\/gotchaa\.uz\/learn\/verify-email\?token=abc123/);
assert.match(verify.html, /Emailni tasdiqlash/);
assert.match(verify.html, /Подтвердить email/);
assert.match(verify.html, /Verify email/);
assert.match(verify.html, /abc123/);
assert.doesNotMatch(verify.html, /Fellow NewUU/);

const reset = passwordResetEmail('Sarvarbek', resetUrl);
assert.match(reset.subject, /Parolni tiklash/);
assert.match(reset.subject, /Сброс пароля/);
assert.match(reset.subject, /Reset your password/);
assert.match(reset.text, /O'ZBEKCHA/);
assert.match(reset.text, /РУССКИЙ/);
assert.match(reset.text, /ENGLISH/);
assert.match(reset.text, /Reset \/ Tiklash \/ Сброс: https:\/\/gotchaa\.uz\/learn\/reset-password\?token=xyz789/);
assert.match(reset.html, /Parolni tiklash/);
assert.match(reset.html, /Сбросить пароль/);
assert.match(reset.html, /Reset password/);
assert.match(reset.html, /xyz789/);
assert.doesNotMatch(reset.html, /Fellow NewUU/);

const invite = universityInvitationEmail('Sarvarbek', 'Erkinov', 'https://gotchaa.uz');
assert.equal(typeof invite.subject, 'string');
assert.ok(invite.subject.length > 0);
assert.match(invite.html, /Assalamu alaykum, Sarvarbek/);
assert.match(invite.html, /https:\/\/gotchaa\.uz/);

console.log('mail.templates.test.ts: ok');
