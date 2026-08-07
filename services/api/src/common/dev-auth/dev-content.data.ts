/** Sample catalog used when PostgreSQL is unavailable and DEV_AUTH_ANY_CREDENTIAL=true */

import { tokenizeText, uniqueWordCount } from '../../utils/tokenizer';
import type { TokenMapEntry } from '@gotcha/shared';

export const DEV_CONTENT_IDS = {
  lighthouse: '00000000-0000-4000-8000-000000000001',
  russianStory: '00000000-0000-4000-8000-000000000002',
  uzbekStory: '00000000-0000-4000-8000-000000000003',
  littlePrince: '00000000-0000-4000-8000-000000000004',
} as const;

const now = new Date();

const LIGHTHOUSE_CHAPTERS: Array<{ id: string; title: string; text: string }> = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    title: 'The Cliff',
    text: `The old lighthouse had stood on the cliff for more than a hundred years. Its white walls, weathered by salt and storm, rose magnificently against the grey winter sky. Edmund, who had been the custodial keeper for thirty years, climbed the spiral staircase each evening with the same deliberate care to illuminate the great lantern that guided ships through the treacherous coastal fog.

He was a solitary man, meticulous in his habits. Every morning he recorded the weather, the passing ships, and any peculiar events in his worn leather journal — a practice his predecessor had begun in 1887. The treacherous rocks below had caused many wrecks over the centuries, and Edmund regarded his duty as something close to sacred.

One still autumn morning, a vessel appeared on the horizon unlike any Edmund had catalogued in his decades of careful observation. It was not a cargo ship, nor a fishing boat, nor any of the familiar coastal ferries. This one moved with a distinctive silence, as if the sea itself had decided to keep the secret of its arrival.`,
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    title: 'The Visitor',
    text: `By noon the vessel had anchored in the sheltered cove beneath the cliff. Edmund watched through his brass telescope as a small boat was lowered. A single figure rowed ashore with calm, measured strokes. When the stranger climbed the steep path to the lighthouse, Edmund opened the heavy oak door before the knock came.

The visitor was a woman in a dark coat, carrying a leather satchel. She introduced herself as Clara Hale, a maritime historian researching forgotten coastal stations. Her questions were precise, almost clinical, yet her eyes lingered on the lantern room with something closer to longing than curiosity.

Edmund offered tea and answered carefully. He had always preferred solitude, but Clara's presence unsettled him in a way he could not yet name. Outside, the sea mist thickened, and the anchored vessel vanished into the grey.`,
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    title: 'The Records',
    text: `That evening Clara asked to see the journals. Edmund hesitated, then led her to the small archive beneath the stairs. Leather-bound volumes lined the shelves — weather, wrecks, repairs, and the quiet routines of keepers who had served before him. Clara turned the pages with reverence, pausing at entries from 1887 where Edmund's predecessor had first described a silent ship on the autumn horizon.

"These records are incomplete," she said softly. "Or perhaps deliberately incomplete." Edmund felt a chill that had nothing to do with the draft from the stone walls. He had copied those early pages a hundred times and never noticed the gaps she now pointed out with a fingertip.

Together they compared tide tables, lighthouse logs, and a faded chart marked with pencil circles. The pattern suggested something that had returned, decade after decade, always in silence.`,
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    title: 'What Remains',
    text: `At dawn the cove was empty. The vessel had gone without a sound, leaving only a thin rope scar on the wet sand. Clara stood at the cliff edge with Edmund, the lantern extinguished behind them, and handed him a single page copied from a foreign archive — a description of the same lighthouse, written in another century, by a keeper who had also watched a silent ship arrive.

"Some stories are kept alive by the people who refuse to forget them," she said. Edmund folded the page into his journal. Whether Clara was historian, messenger, or something stranger, he no longer needed to decide. His duty remained: tend the light, keep the records, and watch the horizon.

When she left by the coastal road, the mist lifted. The sea looked ordinary again. Edmund climbed the spiral staircase one more time, deliberate as always, and illuminated the lantern for the ships that still needed guiding home.`,
  },
];

/** Orange-dotted “unknown” lemmas in the Figma Reader mock. */
export const DEV_LIGHTHOUSE_UNKNOWN = new Set([
  'magnificently', 'custodial', 'treacherous', 'meticulous', 'peculiar',
  'predecessor', 'catalogued', 'distinctive', 'maritime', 'unsettled',
  'deliberately', 'archive', 'fingertip', 'ordinary', 'messenger',
  'illuminated', 'weathered', 'clinical',
]);

/** Blue “learning” lemmas in the Figma Reader mock. */
export const DEV_LIGHTHOUSE_LEARNING = [
  'spiral', 'deliberate', 'illuminate', 'solitary', 'vessel',
  'reverence', 'longing', 'horizon', 'measured',
];

function buildSegment(
  contentId: string,
  chapter: { id: string; title: string; text: string },
  index: number,
) {
  const { tokenMap, sentenceMap, wordCount } = tokenizeText(chapter.text);
  return {
    id: chapter.id,
    contentId,
    segmentIndex: index,
    title: chapter.title,
    plainText: chapter.text,
    tokenMap,
    sentenceMap,
    wordCount,
  };
}

const lighthouseSegments = LIGHTHOUSE_CHAPTERS.map((ch, i) =>
  buildSegment(DEV_CONTENT_IDS.lighthouse, ch, i),
);
const lighthouseWordCount = lighthouseSegments.reduce((s, c) => s + c.wordCount, 0);
const lighthouseUnique = uniqueWordCount(
  lighthouseSegments.flatMap((s) => s.tokenMap) as TokenMapEntry[],
);

function buildSimpleStory(
  id: string,
  title: string,
  segmentId: string,
  segmentTitle: string,
  text: string,
  meta: {
    slug: string;
    subtitle: string;
    description: string;
    language: string;
    cefrLevel: string;
  },
) {
  const { tokenMap, sentenceMap, wordCount } = tokenizeText(text);
  return {
    item: {
      id,
      slug: meta.slug,
      title,
      subtitle: meta.subtitle,
      description: meta.description,
      language: meta.language,
      contentType: 'story',
      contentSource: 'public_domain',
      cefrLevel: meta.cefrLevel,
      genre: 'fiction',
      wordCount,
      uniqueWordCount: uniqueWordCount(tokenMap),
      publishStatus: 'published',
      publishedAt: now,
      progressPct: 0,
    },
    segments: [
      {
        id: segmentId,
        contentId: id,
        segmentIndex: 0,
        title: segmentTitle,
        plainText: text,
        tokenMap,
        sentenceMap,
        wordCount,
      },
    ],
  };
}

const russian = buildSimpleStory(
  DEV_CONTENT_IDS.russianStory,
  'Утро в кафе',
  '00000000-0000-4000-8000-000000000022',
  'Часть 1',
  'Ранним утром Мария открыла маленькое кафе на углу улицы. В воздухе пахло свежим хлебом и кофе. Студенты читали газеты у окна, а старик медленно пил чай.',
  {
    slug: 'dev-russian-cafe',
    subtitle: 'Короткий рассказ',
    description: 'Простой текст для практики чтения на русском.',
    language: 'ru',
    cefrLevel: 'a2',
  },
);

const uzbek = buildSimpleStory(
  DEV_CONTENT_IDS.uzbekStory,
  'Bozordagi tong',
  '00000000-0000-4000-8000-000000000023',
  '1-qism',
  "Erta tongda bozor jonlangan. Savdogarlar mevalarni joylab, xaridorlar narxlarni so'rashdi. Bolalar kulib yugurishardi, havo yangi non hidi bilan to'ldi.",
  {
    slug: 'dev-uzbek-market',
    subtitle: 'Qisqa hikoya',
    description: "O‘zbek tilida o‘qish uchun qisqa matn.",
    language: 'uz',
    cefrLevel: 'a2',
  },
);

const littlePrince = buildSimpleStory(
  DEV_CONTENT_IDS.littlePrince,
  'The Little Prince (Opening)',
  '00000000-0000-4000-8000-000000000024',
  'Opening',
  'Once when I was six years old I saw a magnificent picture in a book about the primeval forest. It showed a boa constrictor swallowing a wild beast. In the book it said: "Boa constrictors swallow their prey whole, without chewing it."',
  {
    slug: 'dev-the-little-prince-opening',
    subtitle: 'Public domain excerpt',
    description: 'A classic opening passage for reading practice in English.',
    language: 'en',
    cefrLevel: 'b1',
  },
);

export const DEV_CONTENT_ITEMS = [
  {
    id: DEV_CONTENT_IDS.lighthouse,
    slug: 'the-lighthouse-keeper',
    title: 'The Lighthouse Keeper',
    subtitle: 'A graded B1 coastal mystery',
    description:
      'A B1 graded story about a solitary keeper, a silent ship, and the records that refuse to stay buried.',
    language: 'en',
    contentType: 'story',
    contentSource: 'public_domain',
    cefrLevel: 'b1',
    genre: 'fiction',
    wordCount: lighthouseWordCount,
    uniqueWordCount: lighthouseUnique,
    publishStatus: 'published',
    publishedAt: now,
    progressPct: 12,
  },
  littlePrince.item,
  russian.item,
  uzbek.item,
];

export const DEV_SEGMENTS: Record<
  string,
  Array<{
    id: string;
    contentId: string;
    segmentIndex: number;
    title: string;
    plainText: string;
    tokenMap: TokenMapEntry[];
    sentenceMap: unknown[];
    wordCount: number;
  }>
> = {
  [DEV_CONTENT_IDS.lighthouse]: lighthouseSegments,
  [DEV_CONTENT_IDS.littlePrince]: littlePrince.segments,
  [DEV_CONTENT_IDS.russianStory]: russian.segments,
  [DEV_CONTENT_IDS.uzbekStory]: uzbek.segments,
};

/** Default lemma statuses for the demo Reader (known / learning / unknown). */
export function buildDevKnownWordStatuses(): Array<{ lemma: string; sourceLang: string; status: string }> {
  const statuses = new Map<string, string>();
  for (const seg of lighthouseSegments) {
    for (const t of seg.tokenMap) {
      if (!t.isWord || !t.lemma) continue;
      const lemma = t.lemma.toLowerCase();
      if (DEV_LIGHTHOUSE_UNKNOWN.has(lemma)) statuses.set(lemma, 'unknown');
      else if (DEV_LIGHTHOUSE_LEARNING.includes(lemma)) statuses.set(lemma, 'learning');
      else statuses.set(lemma, 'known');
    }
  }
  return Array.from(statuses.entries()).map(([lemma, status]) => ({
    lemma,
    sourceLang: 'en',
    status,
  }));
}

export function getDevFeed() {
  const lighthouse = DEV_CONTENT_ITEMS[0];
  return {
    continueReading: [{ ...lighthouse, progressPct: 12 }],
    featuredCollections: [
      {
        id: '00000000-0000-4000-8000-000000000099',
        slug: 'dev-featured',
        title: 'Featured Fiction',
        description: 'The best fiction for intermediate learners',
        language: 'en',
        isFeatured: true,
        sortOrder: 0,
        items: DEV_CONTENT_ITEMS.map((content, i) => ({
          collectionId: '00000000-0000-4000-8000-000000000099',
          contentId: content.id,
          sortOrder: i,
          content,
        })),
      },
    ],
    recentlyPublished: DEV_CONTENT_ITEMS,
  };
}

export function getDevContentById(id: string) {
  const item = DEV_CONTENT_ITEMS.find((c) => c.id === id);
  if (!item) return null;
  const segments = DEV_SEGMENTS[id] ?? [];
  return {
    ...item,
    license: null,
    segments: segments.map((s) => ({
      id: s.id,
      segmentIndex: s.segmentIndex,
      title: s.title,
      wordCount: s.wordCount,
    })),
  };
}

export function getDevSegments(contentId: string) {
  const segments = DEV_SEGMENTS[contentId];
  if (!segments) return null;
  return { contentId, segments };
}
