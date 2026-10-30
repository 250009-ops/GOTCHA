import type { MarketingLocale } from './webLocale';

export interface MarketingStep {
  n: string;
  title: string;
  body: string;
}

export interface MarketingFeature {
  title: string;
  body: string;
}

export interface MarketingCopy {
  seo: { title: string; description: string };
  nav: {
    catalog: string;
    pricing: string;
    readers: string;
    features: string;
    how: string;
    signIn: string;
    getStarted: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  footer: {
    tagline: string;
    product: string;
    legal: string;
    roadmap: string;
    privacy: string;
    terms: string;
    rights: string;
    powered: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    noCard: string;
    payAsYouGo: string;
    wantToLearn: string;
  };
  how: { title: string; subtitle: string; steps: MarketingStep[] };
  features: { title: string; subtitle: string; items: MarketingFeature[] };
  catalog: { label: string; title: string; browse: string; empty: string };
  pricing: {
    label: string;
    title: string;
    subtitle: string;
    freeTierTitle: string;
    freeTierBody: (daily: number, monthly: number) => string;
    volumeHeader: string;
    priceHeader: string;
    minCharge: (amount: string) => string;
  };
  readers: {
    label: string;
    title: string;
    subtitle: string;
    empty: string;
    cta: string;
    streak: string;
    timeRead: string;
    wordsLearned: string;
    days: string;
    mins: string;
    words: string;
  };
  cta: { title: string; subtitle: string; button: string };
}

const EN: MarketingCopy = {
  seo: {
    title: 'GOTCHA — Get fluent by actually reading',
    description:
      'Turn any text into a lesson. Tap words for AI definitions, save vocabulary with spaced repetition. English, Russian, and Uzbek. Pay as you go in soʻm — no subscription.',
  },
  nav: {
    catalog: 'Catalog',
    pricing: 'Pricing',
    readers: 'Top Readers',
    features: 'Features',
    how: 'How It Works',
    signIn: 'Sign in',
    getStarted: 'Get started',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    language: 'Language',
  },
  footer: {
    tagline: 'Reading-first language learning for English, Russian, and Uzbek.',
    product: 'Product',
    legal: 'Legal',
    roadmap: 'Roadmap',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    rights: '© 2026 GOTCHA. All rights reserved.',
    powered: 'Powered by Atmos · UZS',
  },
  hero: {
    badge: 'Reading-first language learning',
    title: 'Learn any language by reading the stories you actually love',
    subtitle:
      'Ditch the boring drills. Translate instantly, build your native vocabulary naturally, and level up your comprehension with books and articles matched to your tier.',
    ctaPrimary: 'Get started free',
    ctaSecondary: 'See how it works',
    noCard: 'No credit card required',
    payAsYouGo: 'No subscription — pay as you go in soʻm',
    wantToLearn: 'I want to learn',
  },
  how: {
    title: 'How GOTCHA works',
    subtitle: 'A scientifically proven reading flow that turns authentic text into active language acquisition.',
    steps: [
      {
        n: '01',
        title: 'Choose a book',
        body: 'Pick a story from our curated Uzbek/Russian/English library, or drag & drop any PDF, ePub, or web article to start instantly.',
      },
      {
        n: '02',
        title: 'Read & learn',
        body: 'Simply tap any unfamiliar word for immediate contextual translations. No more tab-switching or app hopping.',
      },
      {
        n: '03',
        title: 'Track progress',
        body: 'Build your active vocabulary vault, track daily reading streaks, and see your fluency rise tier by tier.',
      },
    ],
  },
  features: {
    title: 'Everything you need for reading fluency',
    subtitle: 'Smarter tooling built specifically to keep your brain focused on context and comprehension.',
    items: [
      { title: 'Curated Library', body: 'A master catalog of classic literature, modern shorts, and news articles carefully graded from level A1 up to C2.' },
      { title: 'Tap-to-Translate', body: 'Tap any word to view a quick definition, sentence contextual usage, and phonetic pronunciation guide instantly.' },
      { title: 'Vocabulary Builder', body: 'Automatically save tapped words into personal decks. Review them anytime with optimized spaced repetition.' },
      { title: 'Reading Streaks', body: 'Gamified streak goals and weekly milestones designed by language experts to help you stay accountable every day.' },
      { title: 'Import Your Own', body: 'Bring any digital material into your workspace — support for URLs, PDF, text pasting, and popular eBook formats.' },
      { title: 'Pay As You Go', body: 'No recurring subscriptions. Pay only for what you actually import, instantly integrated with Uzcard & Humo via Atmos.' },
    ],
  },
  catalog: { label: 'Library', title: 'Explore the catalog', browse: 'Browse full library', empty: 'Library is being curated — check back soon.' },
  pricing: {
    label: 'Pricing',
    title: 'Pay as you go. No subscription.',
    subtitle: 'Secure instant payments in soʻm processed via Atmos. No monthly cards linked, absolute control over your spend.',
    freeTierTitle: 'Generous Free Daily Tier',
    freeTierBody: (daily, monthly) => `${daily} free imports per day · ${monthly} free pages per month`,
    volumeHeader: 'Document volume',
    priceHeader: 'Price per import',
    minCharge: (amount) => `Minimum Atmos transaction charge is ${amount}. All payments are securely encrypted.`,
  },
  readers: {
    label: 'Community',
    title: 'Our top readers this week',
    subtitle: 'Meet fellow learners in Uzbekistan expanding their world and fluency through consistent daily reading.',
    empty: 'Be among the first to build a reading streak on GOTCHA.',
    cta: 'Get started free',
    streak: 'Streak days',
    timeRead: 'Time read',
    wordsLearned: 'Words learned',
    days: 'days',
    mins: 'mins',
    words: 'words',
  },
  cta: {
    title: 'Start reading in a new language today',
    subtitle: 'Join thousands of learners building fluency through stories — not flashcards.',
    button: 'Create free account',
  },
};

const RU: MarketingCopy = {
  ...EN,
  seo: { title: 'GOTCHA — Свободно говорите, читая по-настоящему', description: 'Превратите любой текст в урок. Английский, русский и узбекский. Оплата в сумах — без подписки.' },
  nav: { catalog: 'Каталог', pricing: 'Цены', readers: 'Топ читателей', features: 'Возможности', how: 'Как это работает', signIn: 'Войти', getStarted: 'Начать', openMenu: 'Открыть меню', closeMenu: 'Закрыть меню', language: 'Язык' },
  footer: { tagline: 'Изучение языков через чтение — английский, русский и узбекский.', product: 'Продукт', legal: 'Правовая информация', roadmap: 'Дорожная карта', privacy: 'Политика конфиденциальности', terms: 'Условия использования', rights: '© 2026 GOTCHA. Все права защищены.', powered: 'Работает на Atmos · UZS' },
  hero: { badge: 'Изучение языка через чтение', title: 'Изучайте язык, читая истории, которые вам действительно нравятся', subtitle: 'Забудьте о скучных упражнениях. Мгновенный перевод и тексты по вашему уровню.', ctaPrimary: 'Начать бесплатно', ctaSecondary: 'Как это работает', noCard: 'Банковская карта не нужна', payAsYouGo: 'Без подписки — платите за импорт в сумах', wantToLearn: 'Хочу изучать' },
  how: { title: 'Как работает GOTCHA', subtitle: 'Научно обоснованный процесс чтения.', steps: [{ n: '01', title: 'Выберите книгу', body: 'Выберите рассказ из библиотеки или загрузите PDF, ePub или статью.' }, { n: '02', title: 'Читайте и учитесь', body: 'Нажмите на слово — получите перевод в контексте.' }, { n: '03', title: 'Следите за прогрессом', body: 'Собирайте словарь и отслеживайте серии чтения.' }] },
  features: { title: 'Всё для беглого чтения', subtitle: 'Инструменты для понимания текста.', items: [{ title: 'Кураторская библиотека', body: 'Классика и статьи от A1 до C2.' }, { title: 'Перевод одним нажатием', body: 'Определение и контекст в читалке.' }, { title: 'Словарь', body: 'Сохраняйте слова и повторяйте по интервалам.' }, { title: 'Серии чтения', body: 'Ежедневные цели помогают не бросать привычку.' }, { title: 'Свои материалы', body: 'Импорт URL, PDF и электронных книг.' }, { title: 'Оплата по факту', body: 'Без подписки. Uzcard и Humo через Atmos.' }] },
  catalog: { label: 'Библиотека', title: 'Каталог', browse: 'Открыть библиотеку', empty: 'Библиотека наполняется — загляните позже.' },
  pricing: { label: 'Цены', title: 'Платите по факту. Без подписки.', subtitle: 'Оплата в сумах через Atmos.', freeTierTitle: 'Щедрый бесплатный уровень', freeTierBody: (d, m) => `${d} бесплатных импорта в день · ${m} бесплатных страниц в месяц`, volumeHeader: 'Объём документа', priceHeader: 'Цена за импорт', minCharge: (a) => `Минимальная сумма Atmos — ${a}.` },
  readers: { label: 'Сообщество', title: 'Лучшие читатели недели', subtitle: 'Узбекистанцы, которые каждый день читают.', empty: 'Станьте одним из первых в GOTCHA.', cta: 'Начать бесплатно', streak: 'Дней серии', timeRead: 'Время чтения', wordsLearned: 'Слов выучено', days: 'дн.', mins: 'мин', words: 'слов' },
  cta: { title: 'Начните читать на новом языке сегодня', subtitle: 'Учите язык через истории — не карточки.', button: 'Создать бесплатный аккаунт' },
};

const UZ: MarketingCopy = {
  ...EN,
  seo: { title: 'GOTCHA — Oʻqib, erkin gapiring', description: 'Har qanday matnni darsga aylantiring. Ingliz, rus va oʻzbek. Soʻmda toʻlov — obuna yoʻq.' },
  nav: { catalog: 'Katalog', pricing: 'Narxlar', readers: 'Top oʻquvchilar', features: 'Imkoniyatlar', how: 'Qanday ishlaydi', signIn: 'Kirish', getStarted: 'Boshlash', openMenu: 'Menyuni ochish', closeMenu: 'Menyuni yopish', language: 'Til' },
  footer: { tagline: 'Til oʻrganish oʻqish orqali — ingliz, rus va oʻzbek.', product: 'Mahsulot', legal: 'Huquqiy', roadmap: 'Reja', privacy: 'Maxfiylik', terms: 'Shartlar', rights: '© 2026 GOTCHA. Barcha huquqlar himoyalangan.', powered: 'Atmos · UZS' },
  hero: { badge: 'Oʻqish orqali til oʻrganish', title: 'Yoqtirgan hikoyalaringizni oʻqib, til oʻrganing', subtitle: 'Zerikarli mashqlarni unuting. Darhol tarjima va darajangizga mos matnlar.', ctaPrimary: 'Bepul boshlash', ctaSecondary: 'Qanday ishlaydi', noCard: 'Bank kartasi shart emas', payAsYouGo: 'Obuna yoʻq — soʻmda toʻlang', wantToLearn: 'Oʻrganmoqchi boʻlgan tilim' },
  how: { title: 'GOTCHA qanday ishlaydi', subtitle: 'Haqiqiy matnni til oʻrganishga aylantiradigan jarayon.', steps: [{ n: '01', title: 'Kitob tanlang', body: 'Kutubxonadan tanlang yoki PDF, ePub yuklang.' }, { n: '02', title: 'Oʻqing va oʻrganing', body: 'Soʻzni bosing — kontekstda tarjima oling.' }, { n: '03', title: 'Progressni kuzating', body: 'Lugʻat va kunlik seriyalarni saqlang.' }] },
  features: { title: 'Erkin oʻqish uchun hamma narsa', subtitle: 'Ma’no va tushunishga yoʻnaltirilgan vositalar.', items: [{ title: 'Tanlangan kutubxona', body: 'A1 dan C2 gacha darajalangan matnlar.' }, { title: 'Bosib tarjima', body: 'Ta’rif va kontekst oʻqish oynasida.' }, { title: 'Lugʻat', body: 'Soʻzlarni saqlang va takrorlang.' }, { title: 'Oʻqish seriyalari', body: 'Kunlik maqsadlar odatni saqlaydi.' }, { title: 'Oʻz materiallaringiz', body: 'URL, PDF va elektron kitoblarni import qiling.' }, { title: 'Foydalanganda toʻlash', body: 'Obuna yoʻq. Uzcard va Humo orqali.' }] },
  catalog: { label: 'Kutubxona', title: 'Katalogni koʻring', browse: 'Toʻliq kutubxona', empty: 'Kutubxona toʻldirilmoqda.' },
  pricing: { label: 'Narxlar', title: 'Foydalanganda toʻlang. Obuna yoʻq.', subtitle: 'Atmos orqali soʻmda xavfsiz toʻlov.', freeTierTitle: 'Kengaytirilgan bepul daraja', freeTierBody: (d, m) => `Kuniga ${d} bepul import · Oyiga ${m} bepul sahifa`, volumeHeader: 'Hujjat hajmi', priceHeader: 'Import narxi', minCharge: (a) => `Atmos minimal toʻlov — ${a}.` },
  readers: { label: 'Jamiyat', title: 'Shu haftaning eng yaxshi oʻquvchilari', subtitle: 'Oʻzbekistondagi oʻquvchilar har kuni oʻqimoqda.', empty: 'GOTCHA’da birinchi boʻling.', cta: 'Bepul boshlash', streak: 'Seriya kunlari', timeRead: 'Oʻqilgan vaqt', wordsLearned: 'Oʻrganilgan soʻzlar', days: 'kun', mins: 'daq', words: 'soʻz' },
  cta: { title: 'Bugun yangi tilni oʻqishni boshlang', subtitle: 'Hikoyalar orqali til oʻrganing.', button: 'Bepul hisob yaratish' },
};

const COPIES: Record<MarketingLocale, MarketingCopy> = { en: EN, ru: RU, uz: UZ };

export function marketingCopyFor(locale: MarketingLocale): MarketingCopy {
  return COPIES[locale] ?? EN;
}
