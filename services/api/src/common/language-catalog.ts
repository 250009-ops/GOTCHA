import { BadRequestException } from '@nestjs/common';
import { APP_LANGUAGES, LANGUAGE_META, LIVE_LANGUAGES } from '@gotcha/shared';
import { PrismaService } from '../prisma/prisma.service';

const ALIGN_KEY = 'languageCatalogLiveAligned';
/** One-shot: enable the full world catalog so signup search/AI/content work after deploy. */
const WORLD_KEY = 'languageCatalogWorldV1';

let catalogReady = false;

export function isAppLanguageCode(code: string): boolean {
  return (APP_LANGUAGES as readonly string[]).includes(code);
}

export async function ensureLanguageCatalog(prisma: PrismaService) {
  if (catalogReady) return;

  for (const code of APP_LANGUAGES) {
    const meta = LANGUAGE_META[code];
    await prisma.languageCatalog.upsert({
      where: { code },
      update: {
        name: meta.label,
        nativeName: meta.nativeName,
        flagEmoji: meta.flag,
        regionLabel: code.toUpperCase(),
      },
      create: {
        code,
        name: meta.label,
        nativeName: meta.nativeName,
        flagEmoji: meta.flag,
        regionLabel: code.toUpperCase(),
        status: 'Active',
        isEnabled: true,
        sortOrder: APP_LANGUAGES.indexOf(code) + 1,
      },
    });
  }

  const aligned = await prisma.platformSetting.findUnique({ where: { key: ALIGN_KEY } });
  if (!aligned) {
    await prisma.languageCatalog.updateMany({
      where: { code: { notIn: [...LIVE_LANGUAGES] } },
      data: { isEnabled: false, status: 'Draft' },
    });
    await prisma.languageCatalog.updateMany({
      where: { code: { in: [...LIVE_LANGUAGES] } },
      data: { isEnabled: true, status: 'Active' },
    });
    await prisma.platformSetting.upsert({
      where: { key: ALIGN_KEY },
      update: { value: { at: new Date().toISOString() } as never },
      create: { key: ALIGN_KEY, value: { at: new Date().toISOString() } as never },
    });
  }

  const world = await prisma.platformSetting.findUnique({ where: { key: WORLD_KEY } });
  if (!world) {
    await prisma.languageCatalog.updateMany({
      where: { code: { in: [...APP_LANGUAGES] } },
      data: { isEnabled: true, status: 'Active' },
    });
    await prisma.platformSetting.upsert({
      where: { key: WORLD_KEY },
      update: { value: { at: new Date().toISOString() } as never },
      create: { key: WORLD_KEY, value: { at: new Date().toISOString() } as never },
    });
  }

  catalogReady = true;
}

export async function getEnabledLanguageCodes(prisma: PrismaService): Promise<string[]> {
  await ensureLanguageCatalog(prisma);
  const rows = await prisma.languageCatalog.findMany({
    where: { isEnabled: true, code: { in: [...APP_LANGUAGES] } },
    orderBy: { sortOrder: 'asc' },
    select: { code: true },
  });
  const codes = rows.map((r) => r.code).filter((c) => isAppLanguageCode(c));
  return codes.length ? codes : [...LIVE_LANGUAGES];
}

export async function assertEnabledLanguage(prisma: PrismaService, code: string, label = 'Language') {
  const enabled = await getEnabledLanguageCodes(prisma);
  if (!enabled.includes(code)) {
    throw new BadRequestException(`${label} "${code}" is not enabled. Ask an admin to add it first.`);
  }
}
