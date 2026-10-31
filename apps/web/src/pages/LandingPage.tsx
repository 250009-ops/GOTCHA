import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon, landingAssets as a } from '../assets/landing';
import { Seo } from '../components/Seo';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import {
  fetchMarketingLanding,
  type LandingPayload,
} from '../lib/api';
import { SHOW_PRICING } from '../lib/featureFlags';
import { libraryUrl, registerUrl } from '../lib/links';
import { resolveMediaUrl } from '../lib/media';

const STORAGE_KEY = 'gotcha.landing.v2';
const STORAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uz: 'Uzbek',
};

const steps = [
  {
    n: '01',
    title: 'Choose a book',
    body: 'Pick a story from our curated Uzbek/Russian/English library, or drag & drop any PDF, ePub, or web article to start instantly.',
    icon: a.bookOpen,
    iconSize: 22,
  },
  {
    n: '02',
    title: 'Read & learn',
    body: 'Simply tap any unfamiliar word for immediate contextual translations. No more tab-switching or app hopping.',
    icon: a.circleX,
    iconSize: 22,
  },
  {
    n: '03',
    title: 'Track progress',
    body: 'Build your active vocabulary vault, track daily reading streaks, and see your fluency rise tier by tier.',
    icon: a.chartLine,
    iconSize: 22,
  },
] as const;

const features = [
  {
    title: 'Curated Library',
    body: 'A master catalog of classic literature, modern shorts, and news articles carefully graded from level A1 up to C2.',
    icon: a.library,
  },
  {
    title: 'Tap-to-Translate',
    body: 'Tap any word to view a quick definition, sentence contextual usage, and phonetic pronunciation guide instantly.',
    icon: a.mousePointerClick,
  },
  {
    title: 'Vocabulary Builder',
    body: 'Automatically save tapped words into personal decks. Review them anytime with optimized spaced repetition.',
    icon: a.sparkles,
  },
  {
    title: 'Reading Streaks',
    body: 'Gamified streak goals and weekly milestones designed by language experts to help you stay accountable every day.',
    icon: a.flame,
  },
  {
    title: 'Import Your Own',
    body: 'Bring any digital material into your workspace — support for URLs, PDF, text pasting, and popular eBook formats.',
    icon: a.cloudUpload,
  },
  {
    title: 'Pay As You Go',
    body: 'No recurring subscriptions. Pay only for what you actually import, instantly integrated with Uzcard & Humo via Atmos.',
    icon: a.creditCard,
  },
] as const;

type LoadState = 'loading' | 'ready' | 'degraded';

function formatUzs(n: number) {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return `${grouped} soʻm`;
}

function cefrLabel(code: string) {
  return code.trim().toUpperCase();
}

function languageLabel(code: string, languages: LandingPayload['languages']) {
  return languages.find((l) => l.code === code)?.name ?? LANG_LABELS[code] ?? code.toUpperCase();
}

/** Tolerate an empty or partial API response: never assume any field exists. */
function normalizeLanding(raw: unknown): LandingPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<LandingPayload>;
  return {
    generatedAt: typeof r.generatedAt === 'string' ? r.generatedAt : '',
    languages: Array.isArray(r.languages) ? r.languages : [],
    catalog: {
      source: r.catalog?.source === 'recent' ? 'recent' : 'featured',
      items: Array.isArray(r.catalog?.items) ? r.catalog.items : [],
    },
    importPricing: r.importPricing,
  };
}

function readCachedLanding(): LandingPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; payload: LandingPayload };
    if (!parsed?.payload || Date.now() - parsed.savedAt > STORAGE_MAX_AGE_MS) return null;
    return normalizeLanding(parsed.payload);
  } catch {
    return null;
  }
}

function writeCachedLanding(payload: LandingPayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    /* ignore quota */
  }
}

function FadeIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`landing-reveal ${className}`}>{children}</div>;
}

function catalogLoopItems<T>(items: T[]): T[] {
  if (items.length === 0) return [];
  const base = [...items];
  while (base.length < 6) base.push(...items);
  return base;
}

function CatalogCard({
  item,
  languages,
}: {
  item: LandingPayload['catalog']['items'][number];
  languages: LandingPayload['languages'];
}) {
  return (
    <a href={libraryUrl()} className="landing-catalog-card group">
      <div className="relative h-[320px] w-[220px] overflow-hidden rounded-lg">
        <CatalogCover title={item.title} coverImageUrl={item.coverImageUrl} />
        <span className="absolute right-3 top-3 rounded bg-[#101828] px-2 py-1 font-['Manrope',sans-serif] text-[11px] font-bold text-white">
          {cefrLabel(item.cefr)}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-[#4a5565]">
          <span className="font-semibold">{languageLabel(item.language, languages)}</span>
          {item.author && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-[#99a1af]" />
              <span className="min-w-0 truncate font-medium">{item.author}</span>
            </>
          )}
        </div>
        <p className="truncate font-['Manrope',sans-serif] text-[15px] font-bold text-[#101828] group-hover:text-[#2107aa]">
          {item.title}
        </p>
        {item.isFree ? (
          <span className="w-fit rounded bg-[#def2e4] px-1.5 py-0.5 text-[11px] font-bold text-[#047d57]">
            Free
          </span>
        ) : (
          <p className="text-[13px] font-bold text-[#101828]">{formatUzs(item.priceUzs)}</p>
        )}
      </div>
    </a>
  );
}

function CatalogRail({
  items,
  languages,
}: {
  items: LandingPayload['catalog']['items'];
  languages: LandingPayload['languages'];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const loop = useMemo(() => catalogLoopItems(items), [items]);

  useEffect(() => {
    const track = trackRef.current;
    const set = setRef.current;
    if (!track || !set || loop.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let paused = false;
    let last = performance.now();
    const pxPerSec = 38;

    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (!paused) {
        const loopAt = set.offsetWidth;
        if (loopAt > 0) {
          track.scrollLeft += (pxPerSec * dt) / 1000;
          if (track.scrollLeft >= loopAt) track.scrollLeft -= loopAt;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
      last = performance.now();
    };
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', resume);
    track.addEventListener('focusin', pause);
    track.addEventListener('focusout', resume);
    track.addEventListener('pointerdown', pause);
    track.addEventListener('pointerup', resume);
    track.addEventListener('touchstart', pause, { passive: true });
    track.addEventListener('touchend', resume, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('mouseenter', pause);
      track.removeEventListener('mouseleave', resume);
      track.removeEventListener('focusin', pause);
      track.removeEventListener('focusout', resume);
      track.removeEventListener('pointerdown', pause);
      track.removeEventListener('pointerup', resume);
      track.removeEventListener('touchstart', pause);
      track.removeEventListener('touchend', resume);
    };
  }, [loop]);

  return (
    <div ref={trackRef} className="landing-catalog-track" aria-label="Catalog titles">
      <div ref={setRef} className="landing-catalog-set">
        {loop.map((item, index) => (
          <CatalogCard key={`${item.id}-a-${index}`} item={item} languages={languages} />
        ))}
      </div>
      <div className="landing-catalog-set" aria-hidden="true">
        {loop.map((item, index) => (
          <CatalogCard key={`${item.id}-b-${index}`} item={item} languages={languages} />
        ))}
      </div>
    </div>
  );
}

function CatalogCover({ title, coverImageUrl }: { title: string; coverImageUrl: string | null }) {
  const src = resolveMediaUrl(coverImageUrl);
  const [failed, setFailed] = useState(false);
  const letter = title.trim().charAt(0).toUpperCase() || 'G';

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#2107aa]">
        <span className="font-['Manrope',sans-serif] text-6xl font-extrabold text-[var(--g-on-cta)]">{letter}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function LandingPage() {
  const { hash } = useLocation();
  const [payload, setPayload] = useState<LandingPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedLanding();
    if (cached) {
      setPayload(cached);
      setLoadState('ready');
    }

    fetchMarketingLanding()
      .then((raw) => {
        if (cancelled) return;
        const data = normalizeLanding(raw);
        setPayload(data);
        setLoadState(data ? 'ready' : 'degraded');
        if (data) writeCachedLanding(data);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState(cached ? 'degraded' : 'degraded');
        if (!cached) setPayload(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, '');
    let cancelled = false;
    let attempts = 0;
    const jump = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempts++ < 24) window.setTimeout(jump, 50);
    };
    const timer = window.setTimeout(jump, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hash, payload]);

  useEffect(() => {
    if (selectedLang || !payload?.languages.length) return;
    setSelectedLang(payload.languages[0].code);
  }, [payload, selectedLang]);

  const languages = payload?.languages ?? [];
  const catalogItems = payload?.catalog.items ?? [];
  const pricing = payload?.importPricing;
  const catalogLoading = loadState === 'loading' && !payload;
  const registerHref = registerUrl({
    plan: 'free',
    lang: selectedLang ?? undefined,
  });

  return (
    <div className="relative overflow-x-clip bg-[#f3f0ff] font-['Geist',sans-serif] text-[#101828]">
      <Seo
        title="GOTCHA — Get fluent by actually reading"
        description="Turn any text into a lesson. Tap words for AI definitions, save vocabulary with spaced repetition. English, Russian, and Uzbek. Pay as you go in soʻm — no subscription."
        path="/"
      />
      <SiteNav />

      <main>
        <header className="flex flex-col items-center gap-10 px-5 pb-16 pt-16 md:px-10 md:pt-20 lg:px-20 lg:pb-20 lg:pt-24">
          <div className="flex max-w-[860px] flex-col items-center gap-6 text-center">
            <p className="rounded-full bg-[#f3f0ff] px-3 py-1.5 font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#2107aa]">
              Reading-first language learning
            </p>
            <h1 className="font-['Manrope',sans-serif] text-[36px] font-extrabold leading-[1.15] tracking-tight text-[#101828] md:text-5xl lg:text-[56px]">
              Learn any language by reading the stories you actually love
            </h1>
            <p className="max-w-[640px] text-base leading-[1.5] text-[#4a5565] lg:text-lg">
              Ditch the boring drills. Translate instantly, build your native vocabulary naturally, and level up your
              comprehension with books and articles matched to your tier.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <a
                className="inline-flex h-12 items-center justify-center rounded-lg bg-[#2107aa] px-6 font-['Manrope',sans-serif] text-[15px] font-semibold text-[var(--g-on-cta)] transition-transform hover:-translate-y-px"
                href={registerHref}
              >
                Get started free
              </a>
              <a
                className="inline-flex h-12 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-6 font-['Manrope',sans-serif] text-[15px] font-semibold text-[#101828] transition-transform hover:-translate-y-px"
                href="#how"
              >
                See how it works
              </a>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[#4a5565]">
                <span className="inline-flex h-[14px] w-[14px] items-center justify-center">
                  <Icon src={a.check} size={14} />
                </span>
                No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[#4a5565]">
                <span className="inline-flex h-[14px] w-[14px] items-center justify-center">
                  <Icon src={a.check} size={14} />
                </span>
                No subscription — pay as you go in soʻm
              </span>
            </div>
          </div>

          {languages.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <p className="text-[13px] font-semibold uppercase text-[#99a1af]">I want to learn</p>
              {languages.map((lang) => {
                const active = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`rounded-[30px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-[#101828] text-white'
                        : 'border border-[#e2e8f0] bg-white text-[#4a5565] hover:border-[#101828]'
                    }`}
                  >
                    {lang.name}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <section id="how" className="scroll-mt-24 bg-white px-5 py-16 md:px-10 md:py-20 lg:px-20 lg:py-24">
          <FadeIn className="mx-auto flex max-w-[1280px] flex-col items-center gap-10 lg:gap-14">
            <div className="flex max-w-[540px] flex-col items-center gap-3 text-center">
              <h2 className="font-['Manrope',sans-serif] text-[28px] font-extrabold text-[#101828] md:text-4xl">
                How GOTCHA works
              </h2>
              <p className="text-base leading-[1.5] text-[#4a5565]">
                A scientifically proven reading flow that turns authentic text into active language acquisition.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.n}
                  className="flex flex-col gap-5 rounded-2xl border border-[#e2e8f0] bg-white p-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#f3f0ff]">
                      <span className="inline-flex h-[22px] w-[22px] items-center justify-center">
                        <Icon src={step.icon} size={step.iconSize} />
                      </span>
                    </div>
                    <span aria-hidden="true" className="font-['Manrope',sans-serif] text-[32px] font-extrabold text-[#c7d1de]">
                      {step.n}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-['Manrope',sans-serif] text-xl font-bold text-[#101828]">{step.title}</h3>
                    <p className="text-sm leading-[1.5] text-[#4a5565]">{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </FadeIn>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#f3f0ff] px-5 py-16 md:px-10 md:py-20 lg:px-20 lg:py-24">
          <FadeIn className="mx-auto flex max-w-[1280px] flex-col items-center gap-10 lg:gap-14">
            <div className="flex max-w-[540px] flex-col items-center gap-3 text-center">
              <h2 className="font-['Manrope',sans-serif] text-[28px] font-extrabold text-[#101828] md:text-4xl">
                Everything you need for reading fluency
              </h2>
              <p className="text-base leading-[1.5] text-[#4a5565]">
                Smarter tooling built specifically to keep your brain focused on context and comprehension.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="flex flex-col gap-4 rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,24,40,0.08)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f0ff]">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <Icon src={feature.icon} size={20} />
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-['Manrope',sans-serif] text-base font-bold text-[#101828]">{feature.title}</h3>
                    <p className="text-[13px] leading-[1.5] text-[#4a5565]">{feature.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </FadeIn>
        </section>

        <section id="catalog" className="scroll-mt-24 bg-white px-5 py-16 md:px-10 md:py-20 lg:px-20 lg:py-24">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-12">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-2">
                <p className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#2107aa]">Library</p>
                <h2 className="font-['Manrope',sans-serif] text-[28px] font-extrabold text-[#101828] md:text-[32px]">
                  Explore the catalog
                </h2>
              </div>
              <a
                href={libraryUrl()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#2107aa] transition-colors hover:text-[#101828]"
              >
                Browse full library
                <span className="inline-flex h-[14px] w-[14px] items-center justify-center">
                  <Icon src={a.arrowRight} size={14} />
                </span>
              </a>
            </div>

            {catalogLoading ? (
              <div className="landing-catalog-track">
                <div className="landing-catalog-set">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="landing-catalog-card animate-pulse">
                      <div className="h-[320px] w-[220px] rounded-lg bg-[#e2e8f0]" />
                      <div className="mt-3 h-3 w-28 rounded bg-[#e2e8f0]" />
                      <div className="mt-2 h-4 w-40 rounded bg-[#e2e8f0]" />
                    </div>
                  ))}
                </div>
              </div>
            ) : catalogItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#4a5565]">
                Library is being curated — check back soon.
              </p>
            ) : (
              <CatalogRail items={catalogItems} languages={languages} />
            )}
          </div>
        </section>

        {SHOW_PRICING && (
        <section id="pricing" className="scroll-mt-24 bg-[#f3f0ff] px-5 py-16 md:px-10 md:py-20 lg:px-20 lg:py-24">
          <FadeIn className="mx-auto flex max-w-[640px] flex-col items-center gap-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#2107aa]">Pricing</p>
              <h2 className="font-['Manrope',sans-serif] text-[28px] font-extrabold text-[#101828] md:text-4xl">
                Pay as you go. No subscription.
              </h2>
              <p className="max-w-[540px] text-[15px] leading-[1.5] text-[#4a5565]">
                Secure instant payments in soʻm processed via Atmos. No monthly cards linked, absolute control over your
                spend.
              </p>
            </div>

            {pricing && (
              <div className="flex w-full items-center gap-4 rounded-xl border border-[#059669] bg-white p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#def2e4]">
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    <Icon src={a.gift} size={16} />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-['Manrope',sans-serif] text-sm font-bold text-[#101828]">Generous Free Daily Tier</p>
                  <p className="text-[13px] text-[#4a5565]">
                    {pricing.freeLimits.dailyFreeImportsPerUser} free imports per day ·{' '}
                    {pricing.freeLimits.monthlyFreePageLimit} free pages per month
                  </p>
                </div>
              </div>
            )}

            {catalogLoading ? (
              <div className="w-full animate-pulse overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 border-b border-[#e2e8f0] last:border-0" />
                ))}
              </div>
            ) : pricing && pricing.tiers.length > 0 ? (
              <div className="w-full overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
                <div className="flex items-center justify-between bg-[#f3f0ff] px-6 py-4 font-['Manrope',sans-serif] text-xs font-bold uppercase text-[#4a5565]">
                  <span>Document volume</span>
                  <span>Price per import</span>
                </div>
                {pricing.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between border-t border-[#e2e8f0] px-6 py-4 text-[15px] text-[#101828]"
                  >
                    <span className="font-['Manrope',sans-serif] font-semibold">{tier.label}</span>
                    <span className="font-bold">{formatUzs(tier.priceUzs)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="text-center text-xs text-[#99a1af]">
              {pricing?.atmosMinAmountSom ? (
                <>Minimum Atmos transaction charge is {formatUzs(pricing.atmosMinAmountSom)}. </>
              ) : null}
              All payments are securely encrypted.
            </p>
          </FadeIn>
        </section>
        )}

        <section id="community" className="scroll-mt-24 bg-white px-5 py-16 md:px-10 md:py-20 lg:px-20 lg:py-24">
          <FadeIn className="mx-auto flex max-w-[540px] flex-col items-center gap-4 rounded-2xl border border-[#e2e8f0] bg-[#f3f0ff] px-6 py-10 text-center">
            <h2 className="font-['Manrope',sans-serif] text-[22px] font-extrabold text-[#101828] md:text-[28px]">
              Build your reading habit
            </h2>
            <p className="text-sm leading-[1.5] text-[#4a5565]">
              Read a little every day and track your own progress in GOTCHA.
            </p>
            <a
              href={registerHref}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#2107aa] px-6 font-['Manrope',sans-serif] text-sm font-semibold text-[var(--g-on-cta)]"
            >
              Get started free
            </a>
          </FadeIn>
        </section>

        <section className="bg-[#101828] px-5 py-20 md:px-10 lg:px-20 lg:py-[120px]" aria-label="Get started">
          <div className="mx-auto flex max-w-[720px] flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <h2 className="font-['Manrope',sans-serif] text-[32px] font-extrabold leading-[1.2] text-white md:text-[44px]">
                Start reading in a new language today
              </h2>
              <p className="text-base font-medium text-[#99a1af]">Start reading for free</p>
            </div>
            <a
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[#2107aa] px-6 font-['Manrope',sans-serif] text-[15px] font-semibold text-[var(--g-on-cta)] transition-transform hover:-translate-y-px"
              href={registerHref}
            >
              Get started free
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
