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
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    wantToLearn: string;
  };
  how: { title: string; subtitle: string; steps: MarketingStep[] };
  features: { title: string; subtitle: string; items: MarketingFeature[] };
  catalog: { label: string; title: string; browse: string; empty: string };
  cta: { title: string; subtitle: string; button: string };
  notFound: { seoTitle: string; title: string; body: string; home: string };
}

const EN: MarketingCopy = {
  seo: {
    title: 'GOTCHA — Get fluent by actually reading',
    description:
      'Turn any text into a lesson. Tap words for AI definitions, save vocabulary with spaced repetition. English, Russian, and Uzbek.',
  },
  nav: {
    catalog: 'Catalog',
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
    terms: 'Terms of Use',
    rights: '© 2026 GOTCHA. All rights reserved.',
  },
  hero: {
    badge: 'Reading-first language learning',
    title: 'Learn any language by reading the stories you actually love',
    subtitle:
      'Ditch the boring drills. Translate instantly, build your native vocabulary naturally, and level up your comprehension with books and articles matched to your tier.',
    ctaPrimary: 'Get started free',
    ctaSecondary: 'See how it works',
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
      { title: 'Curated Library', body: 'Classic literature, modern short stories and articles, sorted by reading level.' },
      { title: 'Tap-to-Translate', body: 'Tap any word to view a quick definition, sentence contextual usage, and phonetic pronunciation guide instantly.' },
      { title: 'Vocabulary Builder', body: 'Automatically save tapped words into personal decks. Review them anytime with optimized spaced repetition.' },
      { title: 'Reading Streaks', body: 'Streak goals and weekly milestones that help you keep reading every day.' },
      { title: 'Import Your Own', body: 'Bring any digital material into your workspace — support for URLs, PDF, text pasting, and popular eBook formats.' },
    ],
  },
  catalog: { label: 'Library', title: 'Explore the catalog', browse: 'Browse full library', empty: 'Library is being curated — check back soon.' },
  cta: {
    title: 'Start reading in a new language today',
    subtitle: 'Build fluency through stories — not flashcards.',
    button: 'Create free account',
  },
  notFound: { seoTitle: 'Page not found', title: 'Page not found', body: 'This page does not exist or has moved.', home: 'Go to the home page' },
};

const RU: MarketingCopy = {
  ...EN,
  seo: { title: 'GOTCHA — Свободно говорите, читая по-настоящему', description: 'Превратите любой текст в урок. Английский, русский и узбекский.' },
  nav: { catalog: 'Каталог', features: 'Возможности', how: 'Как это работает', signIn: 'Войти', getStarted: 'Начать', openMenu: 'Открыть меню', closeMenu: 'Закрыть меню', language: 'Язык' },
  footer: { tagline: 'Изучение языков через чтение — английский, русский и узбекский.', product: 'Продукт', legal: 'Правовая информация', roadmap: 'Дорожная карта', privacy: 'Политика конфиденциальности', terms: 'Условия использования', rights: '© 2026 GOTCHA. Все права защищены.' },
  hero: { badge: 'Изучение языка через чтение', title: 'Изучайте язык, читая истории, которые вам действительно нравятся', subtitle: 'Забудьте о скучных упражнениях. Мгновенный перевод и тексты по вашему уровню.', ctaPrimary: 'Начать бесплатно', ctaSecondary: 'Как это работает', wantToLearn: 'Хочу изучать' },
  how: { title: 'Как работает GOTCHA', subtitle: 'Научно обоснованный процесс чтения.', steps: [{ n: '01', title: 'Выберите книгу', body: 'Выберите рассказ из библиотеки или загрузите PDF, ePub или статью.' }, { n: '02', title: 'Читайте и учитесь', body: 'Нажмите на слово — получите перевод в контексте.' }, { n: '03', title: 'Следите за прогрессом', body: 'Собирайте словарь и отслеживайте серии чтения.' }] },
  features: { title: 'Всё для беглого чтения', subtitle: 'Инструменты для понимания текста.', items: [{ title: 'Кураторская библиотека', body: 'Классика, рассказы и статьи, отсортированные по уровню.' }, { title: 'Перевод одним нажатием', body: 'Определение и контекст в читалке.' }, { title: 'Словарь', body: 'Сохраняйте слова и повторяйте по интервалам.' }, { title: 'Серии чтения', body: 'Ежедневные цели помогают не бросать привычку.' }, { title: 'Свои материалы', body: 'Импорт URL, PDF и электронных книг.' }] },
  catalog: { label: 'Библиотека', title: 'Каталог', browse: 'Открыть библиотеку', empty: 'Библиотека наполняется — загляните позже.' },
  cta: { title: 'Начните читать на новом языке сегодня', subtitle: 'Учите язык через истории — не карточки.', button: 'Создать бесплатный аккаунт' },
  notFound: { seoTitle: 'Страница не найдена', title: 'Страница не найдена', body: 'Такой страницы нет или она была перемещена.', home: 'На главную' },
};

const UZ: MarketingCopy = {
  ...EN,
  seo: { title: 'GOTCHA — Oʻqib, erkin gapiring', description: 'Har qanday matnni darsga aylantiring. Ingliz, rus va oʻzbek.' },
  nav: { catalog: 'Katalog', features: 'Imkoniyatlar', how: 'Qanday ishlaydi', signIn: 'Kirish', getStarted: 'Boshlash', openMenu: 'Menyuni ochish', closeMenu: 'Menyuni yopish', language: 'Til' },
  footer: { tagline: 'Til oʻrganish oʻqish orqali — ingliz, rus va oʻzbek.', product: 'Mahsulot', legal: 'Huquqiy', roadmap: 'Reja', privacy: 'Maxfiylik', terms: 'Shartlar', rights: '© 2026 GOTCHA. Barcha huquqlar himoyalangan.' },
  hero: { badge: 'Oʻqish orqali til oʻrganish', title: 'Yoqtirgan hikoyalaringizni oʻqib, til oʻrganing', subtitle: 'Zerikarli mashqlarni unuting. Darhol tarjima va darajangizga mos matnlar.', ctaPrimary: 'Bepul boshlash', ctaSecondary: 'Qanday ishlaydi', wantToLearn: 'Oʻrganmoqchi boʻlgan tilim' },
  how: { title: 'GOTCHA qanday ishlaydi', subtitle: 'Haqiqiy matnni til oʻrganishga aylantiradigan jarayon.', steps: [{ n: '01', title: 'Kitob tanlang', body: 'Kutubxonadan tanlang yoki PDF, ePub yuklang.' }, { n: '02', title: 'Oʻqing va oʻrganing', body: 'Soʻzni bosing — kontekstda tarjima oling.' }, { n: '03', title: 'Progressni kuzating', body: 'Lugʻat va kunlik seriyalarni saqlang.' }] },
  features: { title: 'Erkin oʻqish uchun hamma narsa', subtitle: 'Ma’no va tushunishga yoʻnaltirilgan vositalar.', items: [{ title: 'Tanlangan kutubxona', body: 'Daraja boʻyicha saralangan asarlar va maqolalar.' }, { title: 'Bosib tarjima', body: 'Ta’rif va kontekst oʻqish oynasida.' }, { title: 'Lugʻat', body: 'Soʻzlarni saqlang va takrorlang.' }, { title: 'Oʻqish seriyalari', body: 'Kunlik maqsadlar odatni saqlaydi.' }, { title: 'Oʻz materiallaringiz', body: 'URL, PDF va elektron kitoblarni import qiling.' }] },
  catalog: { label: 'Kutubxona', title: 'Katalogni koʻring', browse: 'Toʻliq kutubxona', empty: 'Kutubxona toʻldirilmoqda.' },
  cta: { title: 'Bugun yangi tilni oʻqishni boshlang', subtitle: 'Hikoyalar orqali til oʻrganing.', button: 'Bepul hisob yaratish' },
  notFound: { seoTitle: 'Sahifa topilmadi', title: 'Sahifa topilmadi', body: 'Bunday sahifa yoʻq yoki u boshqa joyga koʻchirilgan.', home: 'Bosh sahifaga' },
};

const COPIES: Record<MarketingLocale, MarketingCopy> = { en: EN, ru: RU, uz: UZ };

export function marketingCopyFor(locale: MarketingLocale): MarketingCopy {
  return COPIES[locale] ?? EN;
}
