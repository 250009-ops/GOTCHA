import { PrismaClient, AppLanguage, CefrLevel, ContentType, ContentSource, PublishStatus, LicenseStatus, AdminRole, WordStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { tokenizeText, slugify, uniqueWordCount } from '../src/utils/tokenizer';
import {
  ADMIN_METRICS_KEY,
  FIGMA_ADMIN_METRICS,
} from '../src/modules/admin/admin-figma-metrics';
import { syntheticUserEmailWhere } from '../src/common/production-users';

const prisma = new PrismaClient();

/** Seed passwords come from env; never hardcode. Random fallback is printed once for local dev only. */
function seedPassword(envKey: string): string {
  const v = process.env[envKey]?.trim();
  if (v) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envKey} must be set when seeding in production.`);
  }
  return `dev-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}
const SEED_ADMIN_PASSWORD = seedPassword('SEED_ADMIN_PASSWORD');
const SEED_LEARNER_PASSWORD = seedPassword('SEED_LEARNER_PASSWORD');

const DEMO_CATALOG_SLUGS = [
  'the-master-and-margarita',
  'sherlock-holmes',
  'uzbek-folk-tales',
  'anna-karenina',
  'first-space-news',
  'uzbek-cuisine-history',
  'the-great-gatsby',
  'war-and-peace',
];

const SAMPLE_DEMO_SLUGS = [
  'the-lighthouse-keeper',
  'a-morning-in-tashkent',
  'утро-в-городе',
  'bahor-tongi',
  'the-little-prince-opening',
  'tech-news-language-apps-grow',
];

const DEMO_CATALOG_TITLES = [
  'The Lighthouse Keeper',
  'A Morning in Tashkent',
  'Утро в городе',
  'Bahor tongi',
  'The Little Prince — Opening',
  'Tech News: Language Apps Grow',
];

/** Only create Figma sample stories when explicitly requested. Production deploys must never resurrect deleted catalog. */
const seedDemoCatalog =
  process.env.SEED_DEMO_CATALOG === '1' || process.env.SEED_DEMO_CATALOG === 'true';

async function purgeCatalogBySlugs(slugs: string[], titles: string[] = []) {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  const uniqueTitles = [...new Set(titles.filter(Boolean))];
  if (!uniqueSlugs.length && !uniqueTitles.length) return;
  const items = await prisma.contentItem.findMany({
    where: {
      OR: [
        ...(uniqueSlugs.length ? [{ slug: { in: uniqueSlugs } }] : []),
        ...(uniqueTitles.length ? [{ title: { in: uniqueTitles } }] : []),
      ],
    },
    select: { id: true, slug: true, title: true },
  });
  for (const item of items) {
    await prisma.$transaction(async (tx) => {
      await tx.userVocabulary.updateMany({
        where: { contentId: item.id },
        data: { contentId: null, contextSegmentId: null },
      });
      await tx.practiceSession.updateMany({
        where: { contentId: item.id },
        data: { contentId: null, segmentId: null },
      });
      await tx.userImport.updateMany({ where: { contentId: item.id }, data: { contentId: null } });
      await tx.ingestionJob.updateMany({ where: { contentId: item.id }, data: { contentId: null } });
      await tx.moderationQueue.updateMany({ where: { contentId: item.id }, data: { contentId: null } });
      await tx.contentItem.updateMany({ where: { parentContentId: item.id }, data: { parentContentId: null } });
      await tx.contentItem.delete({ where: { id: item.id } });
    });
  }
  if (items.length) {
    console.log(`Purged ${items.length} seed catalog item(s): ${items.map((i) => i.slug).join(', ')}`);
  }
}

/** Multi-chapter B1 story matching the Figma Reader screen. */
const LIGHTHOUSE_CHAPTERS: Array<{ title: string; text: string }> = [
  {
    title: 'The Cliff',
    text: `The old lighthouse had stood on the cliff for more than a hundred years. Its white walls, weathered by salt and storm, rose magnificently against the grey winter sky. Edmund, who had been the custodial keeper for thirty years, climbed the spiral staircase each evening with the same deliberate care to illuminate the great lantern that guided ships through the treacherous coastal fog.

He was a solitary man, meticulous in his habits. Every morning he recorded the weather, the passing ships, and any peculiar events in his worn leather journal — a practice his predecessor had begun in 1887. The treacherous rocks below had caused many wrecks over the centuries, and Edmund regarded his duty as something close to sacred.

One still autumn morning, a vessel appeared on the horizon unlike any Edmund had catalogued in his decades of careful observation. It was not a cargo ship, nor a fishing boat, nor any of the familiar coastal ferries. This one moved with a distinctive silence, as if the sea itself had decided to keep the secret of its arrival.`,
  },
  {
    title: 'The Visitor',
    text: `By noon the vessel had anchored in the sheltered cove beneath the cliff. Edmund watched through his brass telescope as a small boat was lowered. A single figure rowed ashore with calm, measured strokes. When the stranger climbed the steep path to the lighthouse, Edmund opened the heavy oak door before the knock came.

The visitor was a woman in a dark coat, carrying a leather satchel. She introduced herself as Clara Hale, a maritime historian researching forgotten coastal stations. Her questions were precise, almost clinical, yet her eyes lingered on the lantern room with something closer to longing than curiosity.

Edmund offered tea and answered carefully. He had always preferred solitude, but Clara's presence unsettled him in a way he could not yet name. Outside, the sea mist thickened, and the anchored vessel vanished into the grey.`,
  },
  {
    title: 'The Records',
    text: `That evening Clara asked to see the journals. Edmund hesitated, then led her to the small archive beneath the stairs. Leather-bound volumes lined the shelves — weather, wrecks, repairs, and the quiet routines of keepers who had served before him. Clara turned the pages with reverence, pausing at entries from 1887 where Edmund's predecessor had first described a silent ship on the autumn horizon.

"These records are incomplete," she said softly. "Or perhaps deliberately incomplete." Edmund felt a chill that had nothing to do with the draft from the stone walls. He had copied those early pages a hundred times and never noticed the gaps she now pointed out with a fingertip.

Together they compared tide tables, lighthouse logs, and a faded chart marked with pencil circles. The pattern suggested something that had returned, decade after decade, always in silence.`,
  },
  {
    title: 'What Remains',
    text: `At dawn the cove was empty. The vessel had gone without a sound, leaving only a thin rope scar on the wet sand. Clara stood at the cliff edge with Edmund, the lantern extinguished behind them, and handed him a single page copied from a foreign archive — a description of the same lighthouse, written in another century, by a keeper who had also watched a silent ship arrive.

"Some stories are kept alive by the people who refuse to forget them," she said. Edmund folded the page into his journal. Whether Clara was historian, messenger, or something stranger, he no longer needed to decide. His duty remained: tend the light, keep the records, and watch the horizon.

When she left by the coastal road, the mist lifted. The sea looked ordinary again. Edmund climbed the spiral staircase one more time, deliberate as always, and illuminated the lantern for the ships that still needed guiding home.`,
  },
];

/** Words shown as "learning" (blue) in the Figma Reader mock. */
const LIGHTHOUSE_LEARNING = [
  'spiral', 'deliberate', 'illuminate', 'solitary', 'vessel',
  'reverence', 'longing', 'horizon', 'measured',
];

/** Harder lemmas left as unknown (orange dotted) — not marked known in seed. */
const LIGHTHOUSE_UNKNOWN = new Set([
  'magnificently', 'custodial', 'treacherous', 'meticulous', 'peculiar',
  'predecessor', 'catalogued', 'distinctive', 'maritime', 'unsettled',
  'deliberately', 'archive', 'fingertip', 'ordinary',
  'messenger', 'illuminated', 'weathered', 'clinical',
]);

const SAMPLE_STORIES: Array<{
  title: string;
  language: AppLanguage;
  level: CefrLevel;
  genre: string;
  text: string;
  source: ContentSource;
}> = [
  {
    title: 'A Morning in Tashkent',
    language: 'en',
    level: 'a2',
    genre: 'culture',
    source: ContentSource.public_domain,
    text: `The sun rose over Tashkent, painting the streets in soft gold. A baker opened his shop and the smell of fresh bread filled the air. Students walked quickly toward the metro, carrying books and hope. An old man sat on a bench and read a newspaper slowly, smiling at a story about spring. Life in the city began again, quiet and full of promise.`,
  },
  {
    title: 'Утро в городе',
    language: 'ru',
    level: 'a2',
    genre: 'culture',
    source: ContentSource.public_domain,
    text: `Солнце поднялось над городом и окрасило улицы в мягкий золотой свет. Пекарь открыл свою лавку, и запах свежего хлеба наполнил воздух. Студенты спешили к метро с книгами в руках. Старик сидел на скамейке и медленно читал газету, улыбаясь весенней заметке. Город просыпался — тихо и полный надежды.`,
  },
  {
    title: 'Bahor tongi',
    language: 'uz',
    level: 'a2',
    genre: 'culture',
    source: ContentSource.public_domain,
    text: `Quyosh shahar ustidan ko'tarildi va ko'chalarni yumshoq oltin rangga bo'ydi. Nonvoy do'konini ochdi va yangi nonning hidida havo to'ldi. Talabalar kitoblari bilan metroga shoshildi. Keksalar skameykada o'tirib, gazetani sekin o'qidi va bahor haqidagi xabarga jilmaydi. Shahar yana uyg'ondi — tinch va umid bilan.`,
  },
  {
    title: 'The Little Prince — Opening',
    language: 'en',
    level: 'b1',
    genre: 'classic',
    source: ContentSource.public_domain,
    text: `Once when I was six years old I saw a magnificent picture in a book about the primeval forest. It showed a boa constrictor swallowing a wild beast. In the book it said: "Boa constrictors swallow their prey whole, without chewing it." I pondered deeply, then made my first drawing.`,
  },
  {
    title: 'Tech News: Language Apps Grow',
    language: 'en',
    level: 'b2',
    genre: 'news',
    source: ContentSource.licensed,
    text: `Language learning applications continue to grow worldwide as millions of users seek flexible ways to study. Experts say reading remains one of the most effective methods for building vocabulary in context. New platforms combine authentic texts with intelligent feedback, helping learners move from recognition to active use faster than traditional textbooks alone.`,
  },
];

async function main() {
  console.log('Seeding Gotcha database...');

  // Free: lookups/imports follow admin Settings + Import & Pricing (do not overwrite on redeploy).
  // Premium: unlimited.
  const UNLIMITED = 1_000_000;
  // Prices/limits come from prisma/pricing-seed.json (PRICING.md §7, non-PROPOSAL rows); admins edit them later.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pricing = require('./pricing-seed.json') as {
    subscriptionPlans: Array<{ tier: 'free' | 'premium'; name: string; nameI18n: Record<string, string>; priceMonthly: number; period: string; aiDailyQuota: number; importLimit: number; offlineEnabled: boolean; features: string[] }>;
  };
  for (const [i, p] of pricing.subscriptionPlans.entries()) {
    const data = {
      name: p.name, priceMonthly: p.priceMonthly, aiDailyQuota: Math.min(p.aiDailyQuota, UNLIMITED), importLimit: Math.min(p.importLimit, UNLIMITED),
      offlineEnabled: p.offlineEnabled, nameI18n: p.nameI18n, period: p.period, features: p.features, active: true, sortOrder: i,
    };
    await prisma.subscriptionPlan.upsert({ where: { tier: p.tier }, update: data, create: { tier: p.tier, ...data } });
  }

  const license = await prisma.license.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      rightsHolder: 'Gotcha Educational Press',
      status: LicenseStatus.cleared,
      territories: ['GLOBAL'],
      attributionText: '© Gotcha Educational Press. Licensed for Gotcha app.',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2028-12-31'),
    },
  });

  const adminPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gotcha.app' },
    update: {
      passwordHash: adminPassword,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    },
    create: {
      email: 'admin@gotcha.app',
      passwordHash: adminPassword,
      displayName: 'Alex Mercer',
      nativeLanguage: 'en',
      emailVerifiedAt: new Date(),
      preferences: { create: {} },
      targetLanguages: {
        create: [{ targetLanguage: 'ru', isPrimary: true }, { targetLanguage: 'uz' }],
      },
    },
  });

  await prisma.adminUser.upsert({
    where: { userId: admin.id },
    update: { role: AdminRole.superadmin },
    create: { userId: admin.id, role: AdminRole.superadmin },
  });

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { tier: 'free' } });
  const premiumPlan = await prisma.subscriptionPlan.findUnique({ where: { tier: 'premium' } });

  /** Idempotent: one active subscription per seed user (stable UUID). */
  async function ensureSubscription(userId: string, planId: string, subscriptionId: string) {
    await prisma.userSubscription.deleteMany({
      where: { userId, NOT: { id: subscriptionId } },
    });
    await prisma.userSubscription.upsert({
      where: { id: subscriptionId },
      update: { planId, status: 'active' },
      create: { id: subscriptionId, userId, planId, status: 'active' },
    });
  }

  if (freePlan) {
    await ensureSubscription(admin.id, freePlan.id, '00000000-0000-4000-8000-000000000010');
  }

  const demoPassword = await bcrypt.hash(SEED_LEARNER_PASSWORD, 12);
  const learnerCreatedAt = new Date('2025-10-12T10:00:00.000Z');
  const demoUser = await prisma.user.upsert({
    where: { email: 'learner@gotcha.app' },
    update: {
      displayName: 'Alex Chen',
      passwordHash: demoPassword,
      nativeLanguage: 'en',
      uiLanguage: 'en',
      streakCount: 7,
      streakLastDate: new Date(),
      emailVerifiedAt: new Date(),
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      createdAt: learnerCreatedAt,
    },
    create: {
      email: 'learner@gotcha.app',
      passwordHash: demoPassword,
      displayName: 'Alex Chen',
      nativeLanguage: 'en',
      uiLanguage: 'en',
      streakCount: 7,
      streakLastDate: new Date(),
      emailVerifiedAt: new Date(),
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      createdAt: learnerCreatedAt,
      preferences: {
        create: {
          dailyGoalMinutes: 20,
          notificationsEnabled: true,
          readerFontScale: 1,
          readerTheme: 'light',
        },
      },
      targetLanguages: {
        create: [
          { targetLanguage: 'ru', isPrimary: true, cefrLevel: 'b1' },
          { targetLanguage: 'en', isPrimary: false, cefrLevel: 'b2' },
          { targetLanguage: 'uz', isPrimary: false, cefrLevel: 'a2' },
        ],
      },
    },
  });

  await prisma.userPreferences.upsert({
    where: { userId: demoUser.id },
    update: { dailyGoalMinutes: 20, notificationsEnabled: true },
    create: {
      userId: demoUser.id,
      dailyGoalMinutes: 20,
      notificationsEnabled: true,
    },
  });

  // Figma Profile: RU B1 / EN B2 / UZ A2
  await prisma.userTargetLanguage.deleteMany({ where: { userId: demoUser.id } });
  await prisma.userTargetLanguage.createMany({
    data: [
      { userId: demoUser.id, targetLanguage: 'ru', isPrimary: true, cefrLevel: 'b1' },
      { userId: demoUser.id, targetLanguage: 'en', isPrimary: false, cefrLevel: 'b2' },
      { userId: demoUser.id, targetLanguage: 'uz', isPrimary: false, cefrLevel: 'a2' },
    ],
  });

  // Demo learner gets Premium so import / AI testing is not blocked by Free quotas.
  if (premiumPlan) {
    await ensureSubscription(demoUser.id, premiumPlan.id, '00000000-0000-4000-8000-000000000011');
  } else if (freePlan) {
    await ensureSubscription(demoUser.id, freePlan.id, '00000000-0000-4000-8000-000000000011');
  }

  const extraCompleted = await prisma.contentItem.findMany({
    where: { slug: { startsWith: 'figma-completed-article-' } },
    select: { slug: true },
  });
  await purgeCatalogBySlugs(
    [
      ...DEMO_CATALOG_SLUGS,
      ...FIGMA_ADMIN_METRICS.content.seedCurriculum.map((row) => slugify(row.title)),
      ...extraCompleted.map((row) => row.slug),
      ...SAMPLE_STORIES.map((story) => slugify(story.title)),
      ...(seedDemoCatalog ? [] : SAMPLE_DEMO_SLUGS),
    ],
    seedDemoCatalog ? [] : DEMO_CATALOG_TITLES,
  );

  if (!seedDemoCatalog) {
    console.log('Skipping demo catalog seed (SEED_DEMO_CATALOG is off).');
  }

  if (seedDemoCatalog) {
  const starterCollection = await prisma.contentCollection.upsert({
    where: { slug: 'starter-library' },
    update: {
      title: 'Featured Fiction',
      description: 'The best fiction for intermediate learners',
    },
    create: {
      slug: 'starter-library',
      title: 'Featured Fiction',
      description: 'The best fiction for intermediate learners',
      language: 'en',
      isFeatured: true,
      sortOrder: 1,
    },
  });

  let collectionSort = 0;
  for (const story of SAMPLE_STORIES) {
    const slug = slugify(story.title);
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(story.text);

    const sampleCover =
      story.language === 'ru'
        ? 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=560&fit=crop'
        : story.language === 'uz'
          ? 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=560&fit=crop'
          : 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=560&fit=crop';
    const item = await prisma.contentItem.upsert({
      where: { slug },
      update: {
        coverImageKey: sampleCover,
        publishStatus: PublishStatus.published,
      },
      create: {
        slug,
        title: story.title,
        description: `Sample ${story.level.toUpperCase()} ${story.genre} content for Gotcha learners.`,
        language: story.language,
        contentType: story.genre === 'news' ? ContentType.news : ContentType.story,
        contentSource: story.source,
        cefrLevel: story.level,
        genre: story.genre,
        coverImageKey: sampleCover,
        licenseId: story.source === ContentSource.licensed ? license.id : undefined,
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: new Date('2026-06-01'),
        createdById: admin.id,
        segments: {
          create: {
            segmentIndex: 0,
            title: 'Part 1',
            plainText: story.text,
            tokenMap: tokenMap as never,
            sentenceMap: sentenceMap as never,
            wordCount,
          },
        },
      },
    });

    await prisma.contentCollectionItem.upsert({
      where: {
        collectionId_contentId: {
          collectionId: starterCollection.id,
          contentId: item.id,
        },
      },
      update: { sortOrder: collectionSort },
      create: {
        collectionId: starterCollection.id,
        contentId: item.id,
        sortOrder: collectionSort,
      },
    });
    collectionSort += 1;
  }

  // Multi-chapter Reader demo content (Figma: The Lighthouse Keeper).
  const chapterPayloads = LIGHTHOUSE_CHAPTERS.map((ch, index) => {
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(ch.text);
    return {
      segmentIndex: index,
      title: ch.title,
      plainText: ch.text,
      tokenMap: tokenMap as never,
      sentenceMap: sentenceMap as never,
      wordCount,
    };
  });
  const lighthouseTotalWords = chapterPayloads.reduce((s, c) => s + c.wordCount, 0);
  const lighthouseAllTokens = chapterPayloads.flatMap((c) => c.tokenMap as Array<{ isWord?: boolean; lemma?: string | null }>);
  const lighthouseUnique = uniqueWordCount(lighthouseAllTokens as never);

  const lighthouseCover =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=560&fit=crop';
  const lighthouse = await prisma.contentItem.upsert({
    where: { slug: 'the-lighthouse-keeper' },
    update: {
      title: 'The Lighthouse Keeper',
      subtitle: 'Chapter I — The Cliff',
      description: 'A B1 graded story about a solitary keeper, a silent ship, and the records that refuse to stay buried.',
      language: 'en',
      contentType: ContentType.story,
      contentSource: ContentSource.public_domain,
      cefrLevel: 'b1',
      genre: 'fiction',
      coverImageKey: lighthouseCover,
      wordCount: lighthouseTotalWords,
      uniqueWordCount: lighthouseUnique,
      publishStatus: PublishStatus.published,
      publishedAt: new Date('2026-07-20T12:00:00.000Z'),
    },
    create: {
      slug: 'the-lighthouse-keeper',
      title: 'The Lighthouse Keeper',
      subtitle: 'A graded B1 coastal mystery',
      description: 'A B1 graded story about a solitary keeper, a silent ship, and the records that refuse to stay buried.',
      language: 'en',
      contentType: ContentType.story,
      contentSource: ContentSource.public_domain,
      cefrLevel: 'b1',
      genre: 'fiction',
      coverImageKey: lighthouseCover,
      wordCount: lighthouseTotalWords,
      uniqueWordCount: lighthouseUnique,
      publishStatus: PublishStatus.published,
      publishedAt: new Date('2026-07-20T12:00:00.000Z'),
      createdById: admin.id,
    },
  });

  await prisma.contentSegment.deleteMany({ where: { contentId: lighthouse.id } });
  await prisma.contentSegment.createMany({
    data: chapterPayloads.map((c) => ({ ...c, contentId: lighthouse.id })),
  });

  await prisma.contentCollectionItem.upsert({
    where: {
      collectionId_contentId: {
        collectionId: starterCollection.id,
        contentId: lighthouse.id,
      },
    },
    update: { sortOrder: 0 },
    create: {
      collectionId: starterCollection.id,
      contentId: lighthouse.id,
      sortOrder: 0,
    },
  });

  // Demo learner word statuses so Reader highlights match Figma intent.
  const allLemmas = new Set<string>();
  for (const t of lighthouseAllTokens) {
    if (t.isWord && t.lemma) allLemmas.add(t.lemma.toLowerCase());
  }
  for (const lemma of allLemmas) {
    let status: WordStatus = WordStatus.known;
    if (LIGHTHOUSE_UNKNOWN.has(lemma)) status = WordStatus.unknown;
    else if (LIGHTHOUSE_LEARNING.includes(lemma)) status = WordStatus.learning;

    await prisma.userKnownWord.upsert({
      where: {
        userId_lemma_sourceLang: {
          userId: demoUser.id,
          lemma,
          sourceLang: 'en',
        },
      },
      create: {
        userId: demoUser.id,
        lemma,
        sourceLang: 'en',
        status,
      },
      update: { status },
    });
  }

  // Clear prior demo progress/sessions so Home Continue Reading matches Figma only.
  await prisma.readingSession.deleteMany({ where: { userId: demoUser.id } });
  await prisma.readingProgress.deleteMany({ where: { userId: demoUser.id } });

  // Continue Reading uses the lighthouse demo only.
  async function upsertProgress(
    contentId: string,
    progressPct: number,
    opts?: { completed?: boolean; readSeconds?: number; lastReadAt?: Date },
  ) {
    const segment = await prisma.contentSegment.findFirst({
      where: { contentId },
      orderBy: { segmentIndex: 'asc' },
    });
    await prisma.readingProgress.upsert({
      where: { userId_contentId: { userId: demoUser.id, contentId } },
      create: {
        userId: demoUser.id,
        contentId,
        segmentId: segment?.id,
        progressPct,
        totalReadSeconds: opts?.readSeconds ?? Math.round(progressPct * 12),
        lastReadAt: opts?.lastReadAt ?? new Date(),
        completedAt: opts?.completed ? new Date() : null,
      },
      update: {
        segmentId: segment?.id,
        progressPct,
        totalReadSeconds: opts?.readSeconds ?? Math.round(progressPct * 12),
        lastReadAt: opts?.lastReadAt ?? new Date(),
        completedAt: opts?.completed ? new Date() : null,
      },
    });
  }

  await upsertProgress(lighthouse.id, 64, { readSeconds: 2400, lastReadAt: new Date() });

  // Align session history with streakCount=7 (heatmap / bestStreak / calendar).
  // Today: 15 / 20 min daily goal + 12 new words; prior 6 days lighter sessions.
  const streakDayStart = new Date();
  streakDayStart.setHours(0, 0, 0, 0);
  streakDayStart.setDate(streakDayStart.getDate() - 6);
  await prisma.readingSession.deleteMany({
    where: {
      userId: demoUser.id,
      startedAt: { gte: streakDayStart },
    },
  });
  {
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const startedAt = new Date();
      startedAt.setHours(10, 0, 0, 0);
      startedAt.setDate(startedAt.getDate() - dayOffset);
      const isToday = dayOffset === 0;
      await prisma.readingSession.create({
        data: {
          userId: demoUser.id,
          contentId: lighthouse.id,
          startedAt,
          endedAt: new Date(startedAt.getTime() + (isToday ? 15 : 12) * 60_000),
          durationSeconds: (isToday ? 15 : 12) * 60,
          wordsSaved: isToday ? 12 : 3,
          wordsTapped: isToday ? 28 : 8,
        },
      });
    }
  }

  // Vocabulary: Figma showcase words first; pad count to 1,247 without lemma_N junk in Recent.
  await prisma.userVocabulary.deleteMany({
    where: { userId: demoUser.id, lemma: { startsWith: 'lemma_' } },
  });
  const vocabSeedWords: Array<{
    lemma: string;
    translation: string;
    source: AppLanguage;
    target: AppLanguage;
    due?: boolean;
  }> = [
    { lemma: 'солнце', translation: 'sun', source: 'ru', target: 'en', due: true },
    { lemma: 'magnificently', translation: 'величественно', source: 'en', target: 'ru', due: true },
    { lemma: 'treacherous', translation: 'опасный', source: 'en', target: 'ru', due: true },
    { lemma: 'solitary', translation: 'одинокий', source: 'en', target: 'ru', due: true },
    { lemma: 'illuminate', translation: 'освещать', source: 'en', target: 'ru', due: true },
    { lemma: 'vessel', translation: 'судно', source: 'en', target: 'ru', due: true },
    { lemma: 'horizon', translation: 'горизонт', source: 'en', target: 'ru', due: true },
    { lemma: 'мастер', translation: 'master', source: 'ru', target: 'en', due: true },
    { lemma: 'любовь', translation: 'love', source: 'ru', target: 'en' },
    { lemma: 'дьявол', translation: 'devil', source: 'ru', target: 'en' },
    { lemma: 'podshoh', translation: 'king', source: 'uz', target: 'en' },
    { lemma: 'palov', translation: 'pilaf', source: 'uz', target: 'en' },
    { lemma: 'non', translation: 'bread', source: 'uz', target: 'en' },
  ];
  const WORD_BANK: Array<{ lemma: string; translation: string; source: AppLanguage; target: AppLanguage }> = [
    { lemma: 'ephemeral', translation: 'эфемерный', source: 'en', target: 'ru' },
    { lemma: 'resilient', translation: 'стойкий', source: 'en', target: 'ru' },
    { lemma: 'luminous', translation: 'светящийся', source: 'en', target: 'ru' },
    { lemma: 'whisper', translation: 'шёпот', source: 'en', target: 'ru' },
    { lemma: 'threshold', translation: 'порог', source: 'en', target: 'ru' },
    { lemma: 'рассвет', translation: 'dawn', source: 'ru', target: 'en' },
    { lemma: 'судьба', translation: 'fate', source: 'ru', target: 'en' },
    { lemma: 'память', translation: 'memory', source: 'ru', target: 'en' },
    { lemma: 'kitob', translation: 'book', source: 'uz', target: 'en' },
    { lemma: 'dost', translation: 'friend', source: 'uz', target: 'en' },
    { lemma: 'bahor', translation: 'spring', source: 'uz', target: 'en' },
    { lemma: 'serenity', translation: 'спокойствие', source: 'en', target: 'ru' },
  ];
  for (const [i, w] of vocabSeedWords.entries()) {
    await prisma.userVocabulary.upsert({
      where: {
        userId_lemma_sourceLang_targetLang: {
          userId: demoUser.id,
          lemma: w.lemma,
          sourceLang: w.source,
          targetLang: w.target,
        },
      },
      create: {
        userId: demoUser.id,
        lemma: w.lemma,
        sourceLang: w.source,
        targetLang: w.target,
        translation: w.translation,
        dueAt: new Date(Date.now() + (w.due ? -60_000 : (i + 1) * 3600_000)),
        mastered: !w.due && i > 8,
        easeFactor: 2.5,
        intervalDays: !w.due && i > 8 ? 21 : 1,
        repetitions: !w.due && i > 8 ? 4 : 1,
        createdAt: new Date(Date.now() - i * 120_000),
      },
      update: {
        translation: w.translation,
        dueAt: new Date(Date.now() + (w.due ? -60_000 : (i + 1) * 3600_000)),
        mastered: !w.due && i > 8,
        createdAt: new Date(Date.now() - i * 120_000),
      },
    });
  }
  const currentVocab = await prisma.userVocabulary.count({ where: { userId: demoUser.id } });
  const TARGET_VOCAB = 1247;
  if (currentVocab < TARGET_VOCAB) {
    const pad: Array<{
      userId: string;
      lemma: string;
      sourceLang: AppLanguage;
      targetLang: AppLanguage;
      translation: string;
      dueAt: Date;
      mastered: boolean;
      easeFactor: number;
      intervalDays: number;
      repetitions: number;
      createdAt: Date;
    }> = [];
    for (let i = currentVocab; i < TARGET_VOCAB; i++) {
      const bank = WORD_BANK[i % WORD_BANK.length];
      pad.push({
        userId: demoUser.id,
        lemma: `${bank.lemma}_${i}`,
        sourceLang: bank.source,
        targetLang: bank.target,
        translation: bank.translation,
        dueAt: new Date(Date.now() + (i + 20) * 3600_000),
        mastered: i % 5 === 0,
        easeFactor: 2.5,
        intervalDays: i % 5 === 0 ? 30 : 2,
        repetitions: i % 5 === 0 ? 5 : 1,
        // Older than showcase words so Recent list shows Figma lemmas first.
        createdAt: new Date(Date.now() - (30 + i) * 86_400_000),
      });
    }
    const chunk = 200;
    for (let i = 0; i < pad.length; i += chunk) {
      await prisma.userVocabulary.createMany({
        data: pad.slice(i, i + chunk),
        skipDuplicates: true,
      });
    }
  }

  // Cap due-for-review to Figma "8 words".
  const dueNow = await prisma.userVocabulary.findMany({
    where: { userId: demoUser.id, mastered: false, dueAt: { lte: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  for (const [i, row] of dueNow.entries()) {
    if (i >= 8) {
      await prisma.userVocabulary.update({
        where: { id: row.id },
        data: { dueAt: new Date(Date.now() + (i + 1) * 86_400_000) },
      });
    }
  }

  // Recent imports for Import screen (Figma 29:7).
  await prisma.userImport.deleteMany({ where: { userId: demoUser.id } });
  const importSamples = [
    {
      title: 'The Art of Translation & Context',
      importType: 'url' as const,
      sourceUrl: 'https://example.com/translation-context',
      language: 'en' as AppLanguage,
      createdAt: new Date(Date.now() - 2 * 3600_000),
    },
    {
      title: 'Sapiens - Chapter 3.pdf',
      importType: 'pdf' as const,
      sourceUrl: null as string | null,
      language: 'es' as AppLanguage,
      createdAt: new Date(Date.now() - 86400_000),
    },
  ];
  for (const imp of importSamples) {
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(
      `${imp.title}. Sample imported text for the GOTCHA learner import screen.`,
    );
    const content = await prisma.contentItem.create({
      data: {
        slug: `import-${slugify(imp.title)}-${imp.createdAt.getTime()}`,
        title: imp.title,
        subtitle: imp.importType.toUpperCase(),
        language: imp.language,
        contentType: ContentType.user_import,
        contentSource: ContentSource.user_import,
        cefrLevel: imp.language === 'es' ? 'c1' : 'b2',
        genre: 'import',
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: imp.createdAt,
        createdById: demoUser.id,
        segments: {
          create: {
            segmentIndex: 0,
            title: 'Imported',
            plainText: `${imp.title}. Sample imported text for the GOTCHA learner import screen.`,
            tokenMap: tokenMap as never,
            sentenceMap: sentenceMap as never,
            wordCount,
          },
        },
      },
    });
    await prisma.userImport.create({
      data: {
        userId: demoUser.id,
        contentId: content.id,
        importType: imp.importType,
        sourceUrl: imp.sourceUrl,
        title: imp.title,
        language: imp.language,
        ingestionStatus: 'ready',
        createdAt: imp.createdAt,
      },
    });
  }
  }

  // Language catalog metadata only — isEnabled is owned by admin (EN/RU/UZ live by default).
  // Do not re-enable Figma extras (FR/ES/JA/DE) on every seed.

  await prisma.platformSetting.deleteMany({ where: { key: ADMIN_METRICS_KEY } });

  const syntheticUsers = await prisma.user.findMany({
    where: { ...syntheticUserEmailWhere(), adminProfile: { is: null } },
    select: { id: true, email: true },
  });
  if (syntheticUsers.length) {
    await prisma.user.updateMany({
      where: { id: { in: syntheticUsers.map((u) => u.id) } },
      data: { deletedAt: new Date() },
    });
    console.log(`Hid ${syntheticUsers.length} QA/seed user(s): ${syntheticUsers.map((u) => u.email).join(', ')}`);
  }

  // Import & Pricing controls (Figma 47:1091)
  // Prices stored as UZS (soʻm). Atmos charges tiyins = UZS × 100.
  //
  // IDEMPOTENT: Do NOT overwrite admin-edited prices on redeploy.
  // Update clause only includes non-price metadata; prices are set only on initial create.
  const importRules = [
    { key: 'ebook', label: 'E-Book / Novel', pricePerImport: 49000, pricePerPage: 500, isActive: true, sortOrder: 1 },
    { key: 'article', label: 'Article / Webpage', pricePerImport: 12000, pricePerPage: 1000, isActive: true, sortOrder: 2 },
    { key: 'news', label: 'News Feed', pricePerImport: 15000, pricePerPage: 800, isActive: true, sortOrder: 3 },
    { key: 'research', label: 'Research Paper', pricePerImport: 39000, pricePerPage: 1500, isActive: true, sortOrder: 4 },
    { key: 'custom', label: 'Custom Document Upload', pricePerImport: 25000, pricePerPage: 1200, isActive: false, sortOrder: 5 },
  ];
  for (const rule of importRules) {
    await prisma.importPricingRule.upsert({
      where: { key: rule.key },
      // IDEMPOTENT: Only update labels/status/sort — preserve admin-edited prices
      update: {
        label: rule.label,
        isActive: rule.isActive,
        sortOrder: rule.sortOrder,
      },
      create: rule,
    });
  }

  const pageTiers = [
    { id: '00000000-0000-4000-8000-000000000041', label: '1 - 10 pages', minPages: 1, maxPages: 10, priceUsd: 12000, sortOrder: 1 },
    { id: '00000000-0000-4000-8000-000000000042', label: '11 - 50 pages', minPages: 11, maxPages: 50, priceUsd: 29000, sortOrder: 2 },
    { id: '00000000-0000-4000-8000-000000000043', label: '51 - 100 pages', minPages: 51, maxPages: 100, priceUsd: 49000, sortOrder: 3 },
    { id: '00000000-0000-4000-8000-000000000044', label: '100+ pages', minPages: 101, maxPages: null, priceUsd: 79000, sortOrder: 4 },
  ];
  for (const tier of pageTiers) {
    await prisma.importPageTier.upsert({
      where: { id: tier.id },
      // IDEMPOTENT: Preserve admin-edited prices AND page ranges (gaps are closed in admin).
      update: {
        sortOrder: tier.sortOrder,
      },
      create: tier,
    });
  }

  // IDEMPOTENT: Only create importFreeLimits if missing — do not overwrite admin edits
  const existingFreeLimits = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
  if (!existingFreeLimits) {
    await prisma.platformSetting.create({
      data: {
        key: 'importFreeLimits',
        value: {
          dailyFreeImportsPerUser: 3,
          monthlyFreePageLimit: 50,
          allowedFormats: ['article', 'news'],
          resetCycle: 'monthly',
          allowRollover: false,
        },
      },
    });
  }

  // IDEMPOTENT: Only create catalogPricingRules if missing — do not overwrite admin edits
  const existingCatalogRules = await prisma.platformSetting.findUnique({ where: { key: 'catalogPricingRules' } });
  if (!existingCatalogRules) {
    await prisma.platformSetting.create({
      data: {
        key: 'catalogPricingRules',
        value: {
          contentType: 'book',
          basePriceUsd: 4.99,
          perPageSurchargeUsd: 0.02,
          volumeDiscountsEnabled: true,
          buy3PctOff: 10,
          buy5PctOff: 20,
        },
      },
    });
  }

  const achievements = [
    { code: 'streak_7', title: 'Week Warrior', description: 'Maintain a 7-day streak', category: 'streak' as const, points: 50, threshold: 7, sortOrder: 1, iconKey: 'flame' },
    { code: 'vocab_100', title: 'Word Collector', description: 'Save 100 vocabulary items', category: 'vocabulary' as const, points: 100, threshold: 100, sortOrder: 2, iconKey: 'book' },
    { code: 'reader_10', title: 'Bookworm', description: 'Complete 10 reading sessions', category: 'reading' as const, points: 75, threshold: 10, sortOrder: 3, iconKey: 'book-open' },
    { code: 'first_import', title: 'Importer', description: 'Import your first text', category: 'special' as const, points: 25, threshold: 1, sortOrder: 4, iconKey: 'upload' },
  ];
  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      update: ach,
      create: ach,
    });
  }

  await prisma.platformSetting.upsert({
    where: { key: 'platformName' },
    update: { value: 'GOTCHA' },
    create: { key: 'platformName', value: 'GOTCHA' },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'supportEmail' },
    update: { value: 'support@gotchaa.uz' },
    create: { key: 'supportEmail', value: 'support@gotchaa.uz' },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'aiEnabled' },
    update: { value: true },
    create: { key: 'aiEnabled', value: true },
  });
  // IDEMPOTENT: Do not overwrite admin lookup / platform AI caps on redeploy.
  const existingAiDailyLimit = await prisma.platformSetting.findUnique({ where: { key: 'aiDailyLimit' } });
  if (!existingAiDailyLimit) {
    await prisma.platformSetting.create({ data: { key: 'aiDailyLimit', value: 150000 } });
  }
  await prisma.platformSetting.upsert({
    where: { key: 'aiLookupModel' },
    update: { value: process.env.OPENAI_MODEL_LOOKUP ?? 'gpt-4.1-mini' },
    create: { key: 'aiLookupModel', value: process.env.OPENAI_MODEL_LOOKUP ?? 'gpt-4.1-mini' },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'aiQuizModel' },
    update: { value: process.env.OPENAI_MODEL_QUIZ ?? 'gpt-4.1-mini' },
    create: { key: 'aiQuizModel', value: process.env.OPENAI_MODEL_QUIZ ?? 'gpt-4.1-mini' },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'aiImportCleanupModel' },
    update: {
      value:
        process.env.OPENAI_MODEL_IMPORT ??
        process.env.OPENAI_MODEL_LOOKUP ??
        'gpt-4.1-mini',
    },
    create: {
      key: 'aiImportCleanupModel',
      value:
        process.env.OPENAI_MODEL_IMPORT ??
        process.env.OPENAI_MODEL_LOOKUP ??
        'gpt-4.1-mini',
    },
  });
  const existingAiUserQuota = await prisma.platformSetting.findUnique({ where: { key: 'aiDefaultUserQuota' } });
  if (!existingAiUserQuota) {
    await prisma.platformSetting.create({ data: { key: 'aiDefaultUserQuota', value: 50 } });
  }

  await prisma.notificationCampaign.deleteMany({
    where: {
      OR: [
        { channel: 'email' },
        { name: { in: ['Premium Upsell', 'Welcome Push', 'Streak Reminder'] } },
        { subject: 'Unlock unlimited AI lookups' },
      ],
    },
  });

  await prisma.supportTicket.deleteMany({
    where: {
      OR: [
        {
          subject: {
            in: [
              'Import failed for EPUB',
              'Billing question',
              'Feature request: dark reader theme',
            ],
          },
        },
        { body: { contains: 'yearly Premium', mode: 'insensitive' } },
      ],
    },
  });

  await prisma.aiUsageDaily.deleteMany({
    where: {
      OR: [
        { user: syntheticUserEmailWhere() },
        { user: { adminProfile: { isNot: null } } },
        { lookupCount: { gte: 1000 } },
      ],
    },
  });

  // Demo messaging: conversations between learner and showcase peers (idempotent).
  const existingConversations = await prisma.conversation.count();
  if (existingConversations === 0) {
    const elena = await prisma.user.findUnique({ where: { email: 'elena@rostov.ru' } });
    const yuki = await prisma.user.findUnique({ where: { email: 'yuki.t@tokyo.jp' } });
    const marc = await prisma.user.findUnique({ where: { email: 'm.andre@quebec.ca' } });
    const peers = [elena, yuki, marc].filter(Boolean) as Array<{ id: string }>;
    const anyContent = await prisma.contentItem.findFirst({
      where: { publishStatus: 'published' },
      select: { id: true },
    });

    for (const peer of peers) {
      const pairKey = [demoUser.id, peer.id].sort().join(':');
      const conversation = await prisma.conversation.create({
        data: {
          pairKey,
          language: 'ru',
          contentId: anyContent?.id,
          lastMessageAt: new Date(),
          participants: {
            create: [
              { userId: demoUser.id, lastReadAt: new Date(Date.now() - 3600_000) },
              { userId: peer.id, lastReadAt: new Date() },
            ],
          },
        },
      });

      const seedMsgs =
        peer.id === elena?.id
          ? [
              {
                senderId: peer.id,
                body: 'Привет, Алекс! Как проходит твое изучение русского?',
                translation: 'Hello, Alex! How is your Russian learning going?',
                bodyLang: 'ru' as const,
                hoursAgo: 3,
              },
              {
                senderId: demoUser.id,
                body: 'Привет! Все отлично. Сегодня прочитал главу Мастера и Маргариты.',
                translation: 'Hi! Everything is great. Today I read a chapter of The Master and Margarita.',
                bodyLang: 'ru' as const,
                hoursAgo: 2.9,
              },
              {
                senderId: peer.id,
                body: "Ого, классика! Если возникнут трудные слова, пиши",
                translation: 'Wow, a classic! If you find difficult words, write to me',
                bodyLang: 'ru' as const,
                hoursAgo: 2.8,
              },
              {
                senderId: demoUser.id,
                body: 'Спасибо! Я как раз добавил несколько новых слов в свой словарь.',
                translation: 'Thanks! I just added some new words to my vocabulary.',
                bodyLang: 'ru' as const,
                hoursAgo: 2.7,
              },
              {
                senderId: peer.id,
                body: "Thanks! That translation of 'книга' makes sense now.",
                translation: null,
                bodyLang: 'en' as const,
                hoursAgo: 2,
              },
            ]
          : peer.id === yuki?.id
            ? [
                {
                  senderId: peer.id,
                  body: 'Would you like to do a speaking practice session tomorrow?',
                  translation: null,
                  bodyLang: 'en' as const,
                  hoursAgo: 5,
                },
              ]
            : [
                {
                  senderId: peer.id,
                  body: "O'zbek tilini o'rganish juda qiziqarli!",
                  translation: 'Learning Uzbek is very interesting!',
                  bodyLang: 'uz' as const,
                  hoursAgo: 26,
                },
              ];

      for (const m of seedMsgs) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: m.senderId,
            body: m.body,
            translation: m.translation,
            bodyLang: m.bodyLang,
            createdAt: new Date(Date.now() - m.hoursAgo * 3600_000),
          },
        });
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(Date.now() - seedMsgs[seedMsgs.length - 1]!.hoursAgo * 3600_000) },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Admin: admin@gotcha.app / ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : SEED_ADMIN_PASSWORD}`);
  console.log(`Demo learner: learner@gotcha.app / ${process.env.SEED_LEARNER_PASSWORD ? '(from SEED_LEARNER_PASSWORD)' : SEED_LEARNER_PASSWORD}`);
  console.log('Production metrics: live user/AI/revenue counts (Figma overlay removed).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
