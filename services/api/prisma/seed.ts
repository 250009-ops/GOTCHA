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

  // Figma learner library / home catalog (covers + authors in subtitle).
  const FIGMA_LEARNER_CONTENT: Array<{
    slug: string;
    title: string;
    author: string;
    language: AppLanguage;
    level: CefrLevel;
    type: ContentType;
    genre: string;
    cover: string;
    text: string;
  }> = [
    {
      slug: 'the-master-and-margarita',
      title: 'The Master and Margarita',
      author: 'Mikhail Bulgakov',
      language: 'ru',
      level: 'c1',
      type: ContentType.book,
      genre: 'novel',
      cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=560&fit=crop',
      text: `Мастер и Маргарита — роман о любви, творчестве и дьяволе, который посещает Москву. Однажды весной, в час небывало жаркого заката, в Москве, на Патриарших прудах, появились два гражданина.`,
    },
    {
      slug: 'sherlock-holmes',
      title: 'Sherlock Holmes',
      author: 'Arthur Conan Doyle',
      language: 'en',
      level: 'b2',
      type: ContentType.book,
      genre: 'mystery',
      cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=560&fit=crop',
      text: `To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex.`,
    },
    {
      slug: 'uzbek-folk-tales',
      title: 'Uzbek Folk Tales',
      author: 'Traditional',
      language: 'uz',
      level: 'a2',
      type: ContentType.book,
      genre: 'folklore',
      cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=560&fit=crop',
      text: `Qadim zamonlarda bir podshoh yashagan ekan. Uning uch o'g'li bor edi. Bir kuni podshoh o'g'illarini chaqirib, ularga aqldan darak beradigan vazifa berdi.`,
    },
    {
      slug: 'anna-karenina',
      title: 'Anna Karenina',
      author: 'Leo Tolstoy',
      language: 'ru',
      level: 'c1',
      type: ContentType.book,
      genre: 'novel',
      cover: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=560&fit=crop',
      text: `Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему. Все смешалось в доме Облонских.`,
    },
    {
      slug: 'first-space-news',
      title: 'First Space News',
      author: 'BBC News',
      language: 'en',
      level: 'b1',
      type: ContentType.news,
      genre: 'news',
      cover: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=560&fit=crop',
      text: `Astronomers have detected signals from a distant galaxy that may reshape how we understand star formation. Scientists say the discovery opens a new chapter in space observation for learners around the world.`,
    },
    {
      slug: 'uzbek-cuisine-history',
      title: 'Uzbek Cuisine History',
      author: 'Tashkent News',
      language: 'uz',
      level: 'a2',
      type: ContentType.article,
      genre: 'culture',
      cover: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=560&fit=crop',
      text: `O'zbek oshxonasi asrlar davomida shakllangan. Palov, somsa va non — milliy taomlarimizning yuragi. Har bir viloyatning o'z retsepti bor.`,
    },
    {
      slug: 'the-great-gatsby',
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      language: 'en',
      level: 'b2',
      type: ContentType.book,
      genre: 'classic',
      cover: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=560&fit=crop',
      text: `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since. Whenever you feel like criticizing anyone, he told me, just remember that all the people in this world haven't had the advantages that you've had.`,
    },
    {
      slug: 'war-and-peace',
      title: 'War and Peace',
      author: 'Leo Tolstoy',
      language: 'ru',
      level: 'c2',
      type: ContentType.book,
      genre: 'novel',
      cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=560&fit=crop',
      text: `Well, Prince, so Genoa and Lucca are now just family estates of the Buonapartes. But I warn you, if you don't tell me that this means war, if you still try to defend the infamies and horrors perpetrated by that Antichrist...`,
    },
  ];

  const figmaContentIds: Record<string, string> = {};
  for (const row of FIGMA_LEARNER_CONTENT) {
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(row.text);
    const item = await prisma.contentItem.upsert({
      where: { slug: row.slug },
      update: {
        title: row.title,
        subtitle: row.author,
        description: `${row.author} · ${row.level.toUpperCase()} ${row.genre}`,
        language: row.language,
        contentType: row.type,
        contentSource: ContentSource.public_domain,
        cefrLevel: row.level,
        genre: row.genre,
        coverImageKey: row.cover,
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: new Date(),
      },
      create: {
        slug: row.slug,
        title: row.title,
        subtitle: row.author,
        description: `${row.author} · ${row.level.toUpperCase()} ${row.genre}`,
        language: row.language,
        contentType: row.type,
        contentSource: ContentSource.public_domain,
        cefrLevel: row.level,
        genre: row.genre,
        coverImageKey: row.cover,
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: new Date(),
        createdById: admin.id,
        segments: {
          create: {
            segmentIndex: 0,
            title: 'Chapter 1',
            plainText: row.text,
            tokenMap: tokenMap as never,
            sentenceMap: sentenceMap as never,
            wordCount,
          },
        },
      },
    });
    figmaContentIds[row.slug] = item.id;
    // Ensure a segment exists even when the item was created earlier without one.
    const segCount = await prisma.contentSegment.count({ where: { contentId: item.id } });
    if (segCount === 0) {
      await prisma.contentSegment.create({
        data: {
          contentId: item.id,
          segmentIndex: 0,
          title: 'Chapter 1',
          plainText: row.text,
          tokenMap: tokenMap as never,
          sentenceMap: sentenceMap as never,
          wordCount,
        },
      });
    }
    await prisma.contentCollectionItem.upsert({
      where: {
        collectionId_contentId: {
          collectionId: starterCollection.id,
          contentId: item.id,
        },
      },
      update: {},
      create: {
        collectionId: starterCollection.id,
        contentId: item.id,
        sortOrder: collectionSort++,
      },
    });
  }

  // Clear prior demo progress/sessions so Home Continue Reading matches Figma only.
  await prisma.readingSession.deleteMany({ where: { userId: demoUser.id } });
  await prisma.readingProgress.deleteMany({ where: { userId: demoUser.id } });

  // Continue Reading (Figma Home): Master 64%, Sherlock 32%.
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

  const masterId = figmaContentIds['the-master-and-margarita'];
  const sherlockId = figmaContentIds['sherlock-holmes'];
  if (masterId) await upsertProgress(masterId, 64, { readSeconds: 2400, lastReadAt: new Date() });
  if (sherlockId) {
    await upsertProgress(sherlockId, 32, {
      readSeconds: 1200,
      lastReadAt: new Date(Date.now() - 3600_000),
    });
  }

  // Keep lighthouse as a completed story so Reader demos still work.
  const firstSegment = await prisma.contentSegment.findFirst({
    where: { contentId: lighthouse.id },
    orderBy: { segmentIndex: 'asc' },
  });
  if (firstSegment) {
    await upsertProgress(lighthouse.id, 100, {
      completed: true,
      readSeconds: 1800,
      lastReadAt: new Date(Date.now() - 86400_000 * 2),
    });
  }

  // Profile "23 articles read" — complete additional catalog + sample stories.
  const extraCompleteSlugs = [
    'anna-karenina',
    'first-space-news',
    'uzbek-cuisine-history',
    'the-great-gatsby',
    'war-and-peace',
    'uzbek-folk-tales',
    'a-morning-in-tashkent',
    'utro-v-gorode',
    'bahor-tongi',
    'the-little-prince-opening',
    'tech-news-language-apps-grow',
  ];
  let completedCount = 1; // lighthouse
  for (const slug of extraCompleteSlugs) {
    const id =
      figmaContentIds[slug] ??
      (await prisma.contentItem.findUnique({ where: { slug } }))?.id;
    if (!id || id === masterId || id === sherlockId) continue;
    await upsertProgress(id, 100, {
      completed: true,
      readSeconds: 600 + completedCount * 40,
      lastReadAt: new Date(Date.now() - completedCount * 3600_000),
    });
    completedCount += 1;
  }
  // Pad to 23 completed with synthetic short articles if needed.
  while (completedCount < 23) {
    const slug = `figma-completed-article-${completedCount}`;
    const sample = `Completed sample article ${completedCount} for GOTCHA Figma profile stats.`;
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(sample);
    const item = await prisma.contentItem.upsert({
      where: { slug },
      // Keep below featured learner catalog in Library (publishedAt desc).
      update: {
        publishStatus: PublishStatus.published,
        publishedAt: new Date('2026-05-01T12:00:00.000Z'),
        coverImageKey: 'https://images.unsplash.com/photo-14565130808-af32db8c1b38?w=400&h=560&fit=crop',
      },
      create: {
        slug,
        title: `Practice Article ${completedCount}`,
        subtitle: 'GOTCHA Library',
        description: 'Seeded completed reading for Figma profile stats.',
        language: 'en',
        contentType: ContentType.article,
        contentSource: ContentSource.public_domain,
        cefrLevel: 'b1',
        genre: 'article',
        coverImageKey: 'https://images.unsplash.com/photo-14565130808-af32db8c1b38?w=400&h=560&fit=crop',
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.published,
        publishedAt: new Date('2026-05-01T12:00:00.000Z'),
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
    await upsertProgress(item.id, 100, {
      completed: true,
      readSeconds: 300,
      lastReadAt: new Date(Date.now() - completedCount * 7200_000),
    });
    completedCount += 1;
  }

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
  if (masterId) {
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const startedAt = new Date();
      startedAt.setHours(10, 0, 0, 0);
      startedAt.setDate(startedAt.getDate() - dayOffset);
      const isToday = dayOffset === 0;
      await prisma.readingSession.create({
        data: {
          userId: demoUser.id,
          contentId: masterId,
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
  const curriculumCovers = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=560&fit=crop',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=560&fit=crop',
  ];
  for (const [curriculumIdx, row] of FIGMA_ADMIN_METRICS.content.seedCurriculum.entries()) {
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

    const priceUsd = Number((row as { priceUsd?: number }).priceUsd ?? 0);
    const salesCount = Number((row as { salesCount?: number }).salesCount ?? 0);
    const isFree = Boolean((row as { isFree?: boolean }).isFree ?? priceUsd <= 0);

    const coverImageKey = curriculumCovers[curriculumIdx % curriculumCovers.length];
    // Keep admin curriculum below Figma learner catalog in Library sort (publishedAt desc).
    const curriculumPublishedAt =
      status === PublishStatus.published ? new Date('2026-07-15T12:00:00.000Z') : null;
    await prisma.contentItem.upsert({
      where: { slug },
      update: {
        title: row.title,
        language: lang,
        contentType,
        cefrLevel: row.level as CefrLevel,
        wordCount: row.wordCount || wordCount,
        publishStatus: status,
        publishedAt: curriculumPublishedAt,
        coverImageKey,
        isFree,
        priceUsd,
        salesCount,
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
        coverImageKey,
        wordCount: row.wordCount || wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: status,
        publishedAt: curriculumPublishedAt ?? undefined,
        isFree,
        priceUsd,
        salesCount,
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

  // Learner Library: Figma catalog sorts above admin curriculum samples.
  for (const [i, slug] of Object.keys(figmaContentIds).entries()) {
    await prisma.contentItem.update({
      where: { slug },
      data: { publishedAt: new Date(Date.now() - i * 60_000) },
    });
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
      // IDEMPOTENT: Only update labels/ranges/sort — preserve admin-edited priceUsd
      update: {
        label: tier.label,
        minPages: tier.minPages,
        maxPages: tier.maxPages,
        sortOrder: tier.sortOrder,
        // NOTE: priceUsd intentionally NOT included — admin edits are the source of truth
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
          allowRollover: true,
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
