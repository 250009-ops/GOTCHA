import { PrismaClient, AppLanguage, CefrLevel, ContentType, ContentSource, PublishStatus, LicenseStatus, AdminRole, WordStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { tokenizeText, slugify, uniqueWordCount } from '../src/utils/tokenizer';
import {
  ADMIN_METRICS_KEY,
  FIGMA_ADMIN_METRICS,
} from '../src/modules/admin/admin-figma-metrics';

const prisma = new PrismaClient();

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

  // Free: 50 lookups/day, 15 imports (raised for demos); Premium: $9, unlimited.
  const UNLIMITED = 1_000_000;
  await prisma.subscriptionPlan.upsert({
    where: { tier: 'free' },
    update: {
      name: 'Free',
      priceMonthly: 0,
      aiDailyQuota: 50,
      importLimit: 15,
      offlineEnabled: false,
    },
    create: {
      tier: 'free',
      name: 'Free',
      priceMonthly: 0,
      aiDailyQuota: 50,
      importLimit: 15,
      offlineEnabled: false,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { tier: 'premium' },
    update: {
      name: 'Premium',
      priceMonthly: 9,
      aiDailyQuota: UNLIMITED,
      importLimit: UNLIMITED,
      offlineEnabled: true,
    },
    create: {
      tier: 'premium',
      name: 'Premium',
      priceMonthly: 9,
      aiDailyQuota: UNLIMITED,
      importLimit: UNLIMITED,
      offlineEnabled: true,
    },
  });

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

  const adminPassword = await bcrypt.hash('GotchaAdmin2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gotcha.app' },
    update: { displayName: 'Alex Mercer', passwordHash: adminPassword },
    create: {
      email: 'admin@gotcha.app',
      passwordHash: adminPassword,
      displayName: 'Alex Mercer',
      nativeLanguage: 'en',
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

  const demoPassword = await bcrypt.hash('Learner2026!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'learner@gotcha.app' },
    update: {},
    create: {
      email: 'learner@gotcha.app',
      passwordHash: demoPassword,
      displayName: 'Demo Learner',
      nativeLanguage: 'uz',
      preferences: { create: {} },
      targetLanguages: {
        create: [{ targetLanguage: 'en', isPrimary: true, cefrLevel: 'a2' }],
      },
    },
  });

  // Demo learner gets Premium so import / AI testing is not blocked by Free quotas.
  if (premiumPlan) {
    await ensureSubscription(demoUser.id, premiumPlan.id, '00000000-0000-4000-8000-000000000011');
  } else if (freePlan) {
    await ensureSubscription(demoUser.id, freePlan.id, '00000000-0000-4000-8000-000000000011');
  }

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

    const item = await prisma.contentItem.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: story.title,
        description: `Sample ${story.level.toUpperCase()} ${story.genre} content for Gotcha learners.`,
        language: story.language,
        contentType: story.genre === 'news' ? ContentType.news : ContentType.story,
        contentSource: story.source,
        cefrLevel: story.level,
        genre: story.genre,
        licenseId: story.source === ContentSource.licensed ? license.id : undefined,
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: new Date(),
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
      wordCount: lighthouseTotalWords,
      uniqueWordCount: lighthouseUnique,
      publishStatus: PublishStatus.published,
      publishedAt: new Date(),
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
      wordCount: lighthouseTotalWords,
      uniqueWordCount: lighthouseUnique,
      publishStatus: PublishStatus.published,
      publishedAt: new Date(),
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

  // Seed a little progress so Library "Continue reading" can surface the story.
  const firstSegment = await prisma.contentSegment.findFirst({
    where: { contentId: lighthouse.id },
    orderBy: { segmentIndex: 'asc' },
  });
  if (firstSegment) {
    await prisma.readingProgress.upsert({
      where: {
        userId_contentId: { userId: demoUser.id, contentId: lighthouse.id },
      },
      create: {
        userId: demoUser.id,
        contentId: lighthouse.id,
        segmentId: firstSegment.id,
        progressPct: 12,
        lastReadAt: new Date(),
      },
      update: {
        segmentId: firstSegment.id,
        progressPct: 12,
        lastReadAt: new Date(),
      },
    });
  }

  // Figma Languages screen catalog (exact learner/content/CEFR figures).
  for (const lang of FIGMA_ADMIN_METRICS.languages.catalog) {
    await prisma.languageCatalog.upsert({
      where: { code: lang.code },
      update: {
        name: lang.name,
        nativeName: lang.nativeName,
        flagEmoji: lang.flagEmoji,
        regionLabel: lang.region,
        status: lang.status,
        cefrCoverage: lang.cefrCoverage,
        learnerCount: lang.learnerCount,
        contentCount: lang.contentCount,
        isEnabled: lang.isEnabled,
        sortOrder: lang.sortOrder,
      },
      create: {
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        flagEmoji: lang.flagEmoji,
        regionLabel: lang.region,
        status: lang.status,
        cefrCoverage: lang.cefrCoverage,
        learnerCount: lang.learnerCount,
        contentCount: lang.contentCount,
        isEnabled: lang.isEnabled,
        sortOrder: lang.sortOrder,
      },
    });
  }

  // Keep Russian in catalog for existing content (not on Figma Languages table).
  await prisma.languageCatalog.upsert({
    where: { code: 'ru' },
    update: {
      name: 'Russian',
      nativeName: 'Русский',
      flagEmoji: '🇷🇺',
      regionLabel: 'RU',
      status: 'Active',
      cefrCoverage: 70,
      isEnabled: true,
      sortOrder: 99,
    },
    create: {
      code: 'ru',
      name: 'Russian',
      nativeName: 'Русский',
      flagEmoji: '🇷🇺',
      regionLabel: 'RU',
      status: 'Active',
      cefrCoverage: 70,
      learnerCount: 980,
      contentCount: 120,
      isEnabled: true,
      sortOrder: 99,
    },
  });

  await prisma.platformSetting.upsert({
    where: { key: ADMIN_METRICS_KEY },
    update: { value: FIGMA_ADMIN_METRICS as never },
    create: { key: ADMIN_METRICS_KEY, value: FIGMA_ADMIN_METRICS as never },
  });

  // Showcase users from Figma Dashboard / AI Usage (idempotent by email).
  const showcaseUsers: Array<{
    email: string;
    displayName: string;
    native: AppLanguage;
    target: AppLanguage;
    tier: 'free' | 'premium';
    subId: string;
  }> = [
    { email: 'soren@existential.dk', displayName: 'Soren Kierkegaard', native: 'en', target: 'de', tier: 'premium', subId: '00000000-0000-4000-8000-000000000021' },
    { email: 'yuki.t@tokyo.jp', displayName: 'Yuki Tanaka', native: 'ja', target: 'en', tier: 'free', subId: '00000000-0000-4000-8000-000000000022' },
    { email: 'elena@rostov.ru', displayName: 'Elena Rostova', native: 'ru', target: 'es', tier: 'premium', subId: '00000000-0000-4000-8000-000000000023' },
    { email: 'm.andre@quebec.ca', displayName: 'Marc-André', native: 'fr', target: 'de', tier: 'free', subId: '00000000-0000-4000-8000-000000000024' },
    { email: 'hans@gotcha.app', displayName: 'Hans Müller', native: 'de', target: 'en', tier: 'premium', subId: '00000000-0000-4000-8000-000000000025' },
    { email: 'carlos@gotcha.app', displayName: 'Carlos Ruiz', native: 'es', target: 'en', tier: 'premium', subId: '00000000-0000-4000-8000-000000000026' },
    { email: 'aisha@gotcha.app', displayName: 'Aisha Al-Mansoor', native: 'en', target: 'fr', tier: 'premium', subId: '00000000-0000-4000-8000-000000000027' },
    { email: 'david@gotcha.app', displayName: 'David Miller', native: 'en', target: 'es', tier: 'free', subId: '00000000-0000-4000-8000-000000000028' },
  ];

  const showcasePassword = await bcrypt.hash('Learner2026!', 12);
  for (const su of showcaseUsers) {
    const user = await prisma.user.upsert({
      where: { email: su.email },
      update: { displayName: su.displayName },
      create: {
        email: su.email,
        passwordHash: showcasePassword,
        displayName: su.displayName,
        nativeLanguage: su.native,
        preferences: { create: {} },
        targetLanguages: {
          create: [{ targetLanguage: su.target, isPrimary: true, cefrLevel: 'a2' }],
        },
      },
    });
    const planId = su.tier === 'premium' ? premiumPlan?.id : freePlan?.id;
    if (planId) await ensureSubscription(user.id, planId, su.subId);
  }

  // Real ContentItem rows (stable slugs) for admin Content Library Publish/Archive.
  for (const row of FIGMA_ADMIN_METRICS.content.seedCurriculum) {
    const slug = slugify(row.title);
    const sample = `${row.title}. Sample graded text for GOTCHA admin curriculum seeding.`;
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(sample);
    const lang = (['en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt'] as const).includes(row.language as never)
      ? (row.language as AppLanguage)
      : 'en';
    const contentType =
      row.type === 'book' ? ContentType.book
        : row.type === 'news' ? ContentType.news
          : ContentType.article;
    const status =
      row.status === 'published' ? PublishStatus.published
        : row.status === 'review' ? PublishStatus.review
          : PublishStatus.draft;

    await prisma.contentItem.upsert({
      where: { slug },
      update: {
        title: row.title,
        language: lang,
        contentType,
        cefrLevel: row.level as CefrLevel,
        wordCount: row.wordCount || wordCount,
        publishStatus: status,
        publishedAt: status === PublishStatus.published ? new Date() : null,
      },
      create: {
        slug,
        title: row.title,
        description: `Figma curriculum sample · ${row.level.toUpperCase()} ${row.type}`,
        language: lang,
        contentType,
        contentSource: ContentSource.public_domain,
        cefrLevel: row.level as CefrLevel,
        genre: row.type,
        wordCount: row.wordCount || wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: status,
        publishedAt: status === PublishStatus.published ? new Date() : undefined,
        createdById: admin.id,
        segments: {
          create: {
            segmentIndex: 0,
            title: 'Part 1',
            plainText: sample,
            tokenMap: tokenMap as never,
            sentenceMap: sentenceMap as never,
            wordCount,
          },
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
    update: { value: 'support@gotcha.app' },
    create: { key: 'supportEmail', value: 'support@gotcha.app' },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'aiEnabled' },
    update: { value: true },
    create: { key: 'aiEnabled', value: true },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'aiDailyLimit' },
    update: { value: 150000 },
    create: { key: 'aiDailyLimit', value: 150000 },
  });
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
    where: { key: 'aiDefaultUserQuota' },
    update: { value: 50 },
    create: { key: 'aiDefaultUserQuota', value: 50 },
  });

  const existingCampaigns = await prisma.notificationCampaign.count();
  if (existingCampaigns === 0) {
    await prisma.notificationCampaign.createMany({
      data: [
        {
          name: 'Welcome Push',
          subject: 'Welcome to GOTCHA',
          body: 'Start reading in your target language today.',
          channel: 'push',
          status: 'sent',
          audience: 'new_users',
          sentAt: new Date(),
          createdById: admin.id,
        },
        {
          name: 'Streak Reminder',
          subject: "Don't lose your streak",
          body: 'Read for 10 minutes to keep your streak alive.',
          channel: 'push',
          status: 'scheduled',
          audience: 'active',
          scheduledAt: new Date(Date.now() + 86400000),
          createdById: admin.id,
        },
        {
          name: 'Premium Upsell',
          subject: 'Unlock unlimited AI lookups',
          body: 'Try Premium free for 7 days.',
          channel: 'email',
          status: 'draft',
          audience: 'free',
          createdById: admin.id,
        },
      ],
    });
  }

  const existingTickets = await prisma.supportTicket.count();
  if (existingTickets === 0) {
    await prisma.supportTicket.createMany({
      data: [
        {
          userId: demoUser.id,
          subject: 'Import failed for EPUB',
          body: 'My EPUB upload stays stuck on processing.',
          status: 'open',
          priority: 'high',
          category: 'imports',
        },
        {
          userId: demoUser.id,
          subject: 'Billing question',
          body: 'How do I switch from monthly to yearly Premium?',
          status: 'in_progress',
          priority: 'medium',
          category: 'billing',
          assigneeId: admin.id,
        },
        {
          subject: 'Feature request: dark reader theme',
          body: 'Please add a true OLED black theme for night reading.',
          status: 'resolved',
          priority: 'low',
          category: 'product',
          resolvedAt: new Date(),
        },
      ],
    });
  }

  const placementCount = await prisma.placementResult.count();
  if (placementCount === 0) {
    await prisma.placementResult.createMany({
      data: [
        { userId: demoUser.id, targetLanguage: 'en', suggestedLevel: 'a2', score: 72.5 },
        { userId: admin.id, targetLanguage: 'ru', suggestedLevel: 'b1', score: 81.0 },
      ],
    });
  }

  const todayDate = new Date(new Date().toISOString().slice(0, 10));
  // Distribute Figma "45,230 lookups today" across showcase + demo users (idempotent upserts).
  const aiShares = [
    { email: 'learner@gotcha.app', lookups: 189 },
    { email: 'hans@gotcha.app', lookups: 412 },
    { email: 'yuki.t@tokyo.jp', lookups: 189 },
    { email: 'carlos@gotcha.app', lookups: 642 },
    { email: 'aisha@gotcha.app', lookups: 395 },
    { email: 'david@gotcha.app', lookups: 290 },
  ];
  let assigned = 0;
  for (const share of aiShares) {
    const u = await prisma.user.findUnique({ where: { email: share.email } });
    if (!u) continue;
    assigned += share.lookups;
    await prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId: u.id, usageDate: todayDate } },
      update: { lookupCount: share.lookups, quizCount: Math.round(share.lookups * 0.08), tokensUsed: share.lookups * 32 },
      create: {
        userId: u.id,
        usageDate: todayDate,
        lookupCount: share.lookups,
        quizCount: Math.round(share.lookups * 0.08),
        tokensUsed: share.lookups * 32,
      },
    });
  }
  // Remainder on admin so aggregate can approach Figma total when not using metrics overlay.
  const remainder = Math.max(0, FIGMA_ADMIN_METRICS.dashboard.aiLookupsToday - assigned);
  await prisma.aiUsageDaily.upsert({
    where: { userId_usageDate: { userId: admin.id, usageDate: todayDate } },
    update: { lookupCount: remainder, quizCount: Math.round(remainder * 0.08), tokensUsed: remainder * 32 },
    create: {
      userId: admin.id,
      usageDate: todayDate,
      lookupCount: remainder,
      quizCount: Math.round(remainder * 0.08),
      tokensUsed: remainder * 32,
    },
  });

  console.log('Seed complete.');
  console.log('Admin: admin@gotcha.app / GotchaAdmin2026!');
  console.log('Demo learner: learner@gotcha.app / Learner2026!');
  console.log(`Figma metrics seeded (${ADMIN_METRICS_KEY}): users=${FIGMA_ADMIN_METRICS.dashboard.users} mrr=${FIGMA_ADMIN_METRICS.dashboard.mrr}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
