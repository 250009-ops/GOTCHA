/**
 * Restore the default superadmin account (admin@gotcha.app / GotchaAdmin2026!).
 * Handles the common failure mode: admin changed email away from admin@gotcha.app
 * (often unverified) and/or a duplicate admin@gotcha.app row was created by a prior restore.
 *
 * Usage: npm run restore-admin   (from services/api, with DATABASE_URL set)
 * Env:   DATABASE_URL, optional ADMIN_EMAIL / ADMIN_PASSWORD
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const envFile of ['.env', '.env.local']) {
  const path = resolve(__dirname, '..', envFile);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@gotcha.app').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'GotchaAdmin2026!';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const superadmins = await prisma.adminUser.findMany({
    where: { role: AdminRole.superadmin },
    include: { user: true },
    orderBy: { user: { createdAt: 'asc' } },
  });

  const primary = superadmins[0] ?? null;

  const emailCheck = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { adminProfile: true },
  });
  if (emailCheck && !emailCheck.adminProfile && (!primary || emailCheck.id !== primary.userId)) {
    console.error(
      `Cannot restore: ${ADMIN_EMAIL} belongs to a learner account (${emailCheck.id}).`,
    );
    console.error('Rename or delete that learner account first, then re-run this script.');
    process.exit(1);
  }

  // Remove every superadmin row except the primary (oldest) account.
  for (const extra of superadmins.slice(1)) {
    const orphan = await prisma.user.findUnique({ where: { id: extra.userId } });
    if (!orphan) continue;
    console.log(`Removing extra superadmin ${orphan.email} (${orphan.id})`);
    await prisma.user.delete({ where: { id: orphan.id } });
  }

  // Duplicate admin@gotcha.app created while the real admin had a different email.
  const staleHolder = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { adminProfile: true },
  });
  if (staleHolder && primary && staleHolder.id !== primary.userId) {
    console.log(`Removing stale duplicate ${staleHolder.email} (${staleHolder.id})`);
    await prisma.user.delete({ where: { id: staleHolder.id } });
  }

  let adminUserId;

  if (primary) {
    const updated = await prisma.user.update({
      where: { id: primary.userId },
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        emailVerifiedAt: new Date(),
        deletedAt: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    adminUserId = updated.id;

    await prisma.adminUser.update({
      where: { userId: primary.userId },
      data: { role: AdminRole.superadmin },
    });
  } else if (staleHolder?.adminProfile) {
    const updated = await prisma.user.update({
      where: { id: staleHolder.id },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        deletedAt: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    adminUserId = updated.id;
    await prisma.adminUser.update({
      where: { userId: staleHolder.id },
      data: { role: AdminRole.superadmin },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        displayName: 'Alex Mercer',
        nativeLanguage: 'en',
        emailVerifiedAt: new Date(),
        preferences: { create: {} },
        targetLanguages: {
          create: [{ targetLanguage: 'ru', isPrimary: true }, { targetLanguage: 'uz' }],
        },
        adminProfile: { create: { role: AdminRole.superadmin } },
      },
    });
    adminUserId = created.id;
  }

  await prisma.authRefreshToken.updateMany({
    where: { revokedAt: null, user: { adminProfile: { isNot: null } } },
    data: { revokedAt: new Date() },
  });

  console.log('Admin credentials restored.');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  User ID:  ${adminUserId}`);
  console.log('Sign in at https://gotchaa.uz/admin/ — use these credentials on the shared login page.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
