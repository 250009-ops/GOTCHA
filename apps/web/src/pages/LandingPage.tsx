import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon, landingAssets as a } from '../assets/landing';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { fetchMarketingPlans, fetchMarketingStats, type MarketingPlan } from '../lib/api';
import {
  FALLBACK_LEARNER_COUNT,
  FALLBACK_PLANS,
  registerUrl,
} from '../lib/links';

const steps = [
  {
    n: '01',
    title: 'Choose what to read',
    body: 'Pick from our curated library or import your own content from any URL, PDF, or ePUB.',
    icon: a.bookOpen,
  },
  {
    n: '02',
    title: 'Read with smart word lookup',
    body: 'Tap any word for instant AI definitions, phonetics, grammar notes, and context examples.',
    icon: a.brain,
  },
  {
    n: '03',
    title: 'Review with spaced repetition',
    body: 'Saved words are automatically added to your SRS deck and reviewed at the right moment.',
    icon: a.refreshCw,
  },
] as const;

const features = [
  {
    title: 'Reading-first learning',
    body: 'Immersive reading with word-status tracking. Every page teaches you something.',
    icon: a.bookOpenSm,
  },
  {
    title: 'AI word lookup',
    body: 'Instant translation, phonetics, part of speech, and grammar notes from real context.',
    icon: a.brainSm,
  },
  {
    title: 'Spaced repetition (SRS)',
    body: "Proven flashcard algorithm schedules reviews so you never forget what you've learned.",
    icon: a.refreshCwSm,
  },
  {
    title: '3 languages',
    body: 'English, Russian, and Uzbek - with more on the way.',
    icon: a.globe,
  },
  {
    title: 'Progress analytics',
    body: 'Track reading time, streak, words learned, and CEFR level progression over time.',
    icon: a.barChart,
  },
  {
    title: 'Import anything',
    body: 'Bring your own texts - news, blog posts, PDFs, or ePubs - and tokenized instantly.',
    icon: a.upload,
  },
] as const;

const testimonials = [
  {
    quote:
      "I've tried Duolingo, Babbel, LingQ. Gotcha is the first app that actually makes me enjoy reading. I went from A2 to B1 in 4 months.",
    initials: 'AT',
    name: 'Alina T.',
    meta: 'Learning English',
  },
  {
    quote:
      'The 3-panel reader is incredible for desktop. I can read a whole chapter and look up words without losing my flow. Game changer.',
    initials: 'RK',
    name: 'Rustam K.',
    meta: 'Learning Russian',
  },
  {
    quote:
      "I import BBC articles every morning. By the time I finish reading, I've already saved 10 new words for review. So efficient.",
    initials: 'DM',
    name: 'Dilnoza M.',
    meta: 'Learning English',
  },
] as const;

function Stars() {
  return (
    <div className="flex gap-1" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} src={a.star} size={16} />
      ))}
    </div>
  );
}

function formatLearners(n: number) {
  return n.toLocaleString('en-US');
}

export default function LandingPage() {
  const { hash } = useLocation();
  const [plans, setPlans] = useState<MarketingPlan[]>(FALLBACK_PLANS);
  const [learnerCount, setLearnerCount] = useState(FALLBACK_LEARNER_COUNT);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([fetchMarketingPlans(), fetchMarketingStats()]).then(
      ([plansResult, statsResult]) => {
        if (cancelled) return;
        if (plansResult.status === 'fulfilled' && plansResult.value.length > 0) {
          setPlans(plansResult.value);
        }
        if (statsResult.status === 'fulfilled') {
          setLearnerCount(statsResult.value.displayLearnerCount);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const freePlan = plans.find((p) => p.tier === 'free') ?? FALLBACK_PLANS[0];
  const premiumPlan = plans.find((p) => p.tier === 'premium') ?? FALLBACK_PLANS[1];

  return (
    <div className="relative overflow-x-clip bg-white">
      <SiteNav />

      <main className="relative bg-white">
        {/* Background accents */}
        <img
          className="absolute -top-[120px] -right-[120px] w-[360px] h-[360px] pointer-events-none z-0"
          src={a.bgAccent1}
          alt=""
          aria-hidden
        />
        <img
          className="absolute -bottom-[180px] -left-[80px] w-[280px] h-[280px] pointer-events-none z-0"
          src={a.bgAccent2}
          alt=""
          aria-hidden
        />

        {/* Hero Section */}
        <header className="relative z-10 w-full bg-white px-4 py-12 md:px-12 lg:px-[120px] lg:py-24">
          <div className="mx-auto max-w-[1200px] flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
            {/* Hero Copy */}
            <div className="flex flex-col items-start gap-5 flex-1 min-w-0">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#f3f4f6] border border-[#e5e7eb] rounded-full">
                <Icon src={a.sparkles} size={16} />
                <span className="text-xs font-semibold tracking-[0.6px] uppercase text-[#6a7282]">
                  Reading-first language learning
                </span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold leading-[1.1] tracking-[-1.5px] text-[#101828]">
                Get fluent by actually reading
              </h1>

              {/* Subtitle */}
              <p className="text-base lg:text-lg leading-[1.6] text-[#6a7282] max-w-[616px]">
                Turn any text into a lesson. Tap words for AI definitions, save vocabulary with spaced
                repetition, and watch comprehension grow page by page.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <a
                  className="inline-flex items-center justify-center gap-2.5 h-12 px-[18px] bg-[#2107aa] text-white text-[15px] font-bold rounded-[14px] shadow-[0_12px_14px_rgba(33,7,170,0.15)] hover:translate-y-[-1px] transition-transform"
                  href={registerUrl({ plan: 'free' })}
                >
                  Start reading for free
                  <Icon src={a.arrowRightLg} size={18} />
                </a>
                <a
                  className="inline-flex items-center justify-center gap-2.5 h-12 px-[18px] bg-white border border-[#e5e7eb] text-[#101828] text-[15px] font-semibold rounded-[14px] hover:translate-y-[-1px] transition-transform"
                  href="#how"
                >
                  <Icon src={a.play} size={18} />
                  Watch demo
                </a>
              </div>

              {/* Meta */}
              <div className="flex flex-col sm:flex-row gap-4">
                <span className="inline-flex items-center gap-2 text-[13px] text-[#6a7282]">
                  <Icon src={a.check} size={16} />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-2 text-[13px] text-[#6a7282]">
                  <Icon src={a.check} size={16} />
                  Free forever plan available
                </span>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative w-full lg:w-[520px] h-[320px] lg:h-[420px] flex-shrink-0 rounded-3xl overflow-hidden shadow-[0_6px_16px_-6px_rgba(0,0,0,0.06),0_18px_40px_-12px_rgba(0,0,0,0.07)]">
              <img
                className="absolute inset-0 w-full h-full object-cover"
                src={a.heroVisual}
                alt="GOTCHA reader on a desktop"
              />
              <div className="absolute inset-0 bg-black/[0.08]" />

              {/* Language chips */}
              <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-[9px] border border-[#e5e7eb] rounded-full">
                <span className="w-2 h-2 bg-[#2107aa] rounded" />
                <span className="text-[13px] font-semibold text-[#101828]">English</span>
              </div>
              <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-[9px] border border-[#e5e7eb] rounded-full">
                <span className="w-2 h-2 bg-[#6c1d95] rounded" />
                <span className="text-[13px] font-semibold text-[#101828]">Russian</span>
              </div>

              {/* Badge */}
              <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-3 py-2.5 bg-[#2107aa] rounded-[14px] shadow-[0_10px_12px_rgba(0,0,0,0.1)]">
                <Icon src={a.sparklesWhite} size={18} />
                <span className="text-[13px] font-bold text-white">AI-powered word lookup</span>
              </div>
            </div>
          </div>
        </header>

        {/* How it Works Section */}
        <section id="how" className="relative z-10 w-full bg-[#f9fafb] px-4 py-12 md:px-12 lg:px-[120px] lg:py-24">
          <div className="mx-auto max-w-[1200px] flex flex-col gap-8">
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-semibold tracking-[1.4px] uppercase text-[#2107aa]">
                How it works
              </p>
              <h2 className="text-[28px] md:text-4xl lg:text-[40px] font-extrabold leading-[1.1] text-[#101828]">
                Three steps to fluency
              </h2>
              <p className="text-sm md:text-base leading-[1.6] text-[#6a7282] max-w-[720px]">
                A clear path from "I don't know this word" to "I understand the whole page".
              </p>
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map((step) => (
                <article
                  key={step.n}
                  className="flex flex-col gap-4 p-6 bg-white border border-[#e5e7eb] rounded-[20px] shadow-[0_2px_5px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-[#f3f4f6] rounded-[14px]">
                      <Icon src={step.icon} size={22} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-[#2107aa]">{step.n}</span>
                      <h3 className="text-lg font-bold leading-[1.3] text-[#101828]">{step.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-[1.6] text-[#6a7282]">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative z-10 w-full bg-white px-4 py-12 md:px-12 lg:px-[120px] lg:py-24">
          <div className="mx-auto max-w-[1200px] flex flex-col gap-8">
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-semibold tracking-[1.4px] uppercase text-[#2107aa]">
                Features
              </p>
              <h2 className="text-[28px] md:text-4xl lg:text-[40px] font-extrabold leading-[1.1] text-[#101828]">
                Everything you need to read and learn
              </h2>
              <p className="text-sm md:text-base leading-[1.6] text-[#6a7282] max-w-[720px]">
                A complete reading-first system - from discovery to retention.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <article
                  key={f.title}
                  className="flex flex-col gap-3 p-5 bg-white border border-[#e5e7eb] rounded-2xl shadow-[0_2px_5px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center justify-center w-10 h-10 bg-[#f3f4f6] rounded-xl">
                    <Icon src={f.icon} size={20} />
                  </div>
                  <h3 className="text-base font-bold leading-[1.3] text-[#101828]">{f.title}</h3>
                  <p className="text-sm leading-[1.6] text-[#6a7282]">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="relative z-10 w-full bg-[#f9fafb] px-4 py-12 md:px-12 lg:px-[120px] lg:py-24">
          <div className="mx-auto max-w-[1200px] flex flex-col gap-8">
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-semibold tracking-[1.4px] uppercase text-[#2107aa]">
                Testimonials
              </p>
              <h2 className="text-[28px] md:text-4xl lg:text-[40px] font-extrabold leading-[1.1] text-[#101828]">
                Learners love GOTCHA
              </h2>
              <p className="text-sm md:text-base leading-[1.6] text-[#6a7282] max-w-[720px]">
                Real learners, real progress - built on a reading-first workflow.
              </p>
            </div>

            {/* Testimonials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <article
                  key={t.initials}
                  className="flex flex-col gap-4 p-6 bg-white border border-[#e5e7eb] rounded-[20px] shadow-[0_2px_5px_rgba(0,0,0,0.05)]"
                >
                  <Stars />
                  <p className="text-sm italic leading-[1.6] text-[#4a5565] flex-1">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-[#2107aa] rounded-full">
                      <span className="text-sm font-bold text-white">{t.initials}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-sm font-semibold text-[#101828]">{t.name}</strong>
                      <span className="text-[13px] text-[#99a1af]">{t.meta}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="relative z-10 w-full bg-white px-4 py-12 md:px-12 lg:px-[120px] lg:py-24">
          <div className="mx-auto max-w-[1200px] flex flex-col gap-8">
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-semibold tracking-[1.4px] uppercase text-[#2107aa]">
                Pricing
              </p>
              <h2 className="text-[28px] md:text-4xl lg:text-[40px] font-extrabold leading-[1.1] text-[#101828]">
                Simple, honest pricing
              </h2>
              <p className="text-sm md:text-base leading-[1.6] text-[#6a7282] max-w-[720px]">
                Start free. Upgrade when you need more.
              </p>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Free Plan */}
              <article className="flex flex-col gap-4 p-6 bg-white border border-[#e5e7eb] rounded-[20px] shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-[#6a7282]">{freePlan.name}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[40px] font-extrabold leading-[1.1] text-[#101828]">
                      {freePlan.priceLabel}
                    </span>
                    <span className="text-sm text-[#99a1af]">{freePlan.priceUnit}</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1">
                  {freePlan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm leading-5 text-[#4a5565]">
                      <Icon src={a.check} size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  className="flex items-center justify-center h-11 bg-[#2107aa] text-white text-sm font-bold rounded-[14px] hover:translate-y-[-1px] transition-transform"
                  href={registerUrl({ plan: 'free' })}
                >
                  {freePlan.cta}
                </a>
              </article>

              {/* Premium Plan */}
              <article className="flex flex-col gap-4 p-6 bg-gradient-to-r from-[#2107aa] to-[#6c1d95] rounded-[20px] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.08),0_18px_40px_-12px_rgba(33,7,170,0.2)] text-white overflow-hidden">
                <div className="flex flex-col gap-2.5">
                  {premiumPlan.popular && (
                    <div className="inline-flex items-center gap-2 w-fit px-2.5 py-1.5 bg-white/15 border border-white/20 rounded-full">
                      <Icon src={a.sparklesBadge} size={16} />
                      <span className="text-xs font-bold text-white">Most popular</span>
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white/80">{premiumPlan.name}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[40px] font-extrabold leading-[1.1] text-white">
                      {premiumPlan.priceLabel}
                    </span>
                    <span className="text-sm text-white/80">{premiumPlan.priceUnit}</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1">
                  {premiumPlan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm leading-5 text-white/80">
                      <Icon src={a.checkWhite} size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  className="flex items-center justify-center h-11 bg-white text-[#2107aa] text-sm font-bold rounded-[14px] hover:translate-y-[-1px] transition-transform"
                  href={registerUrl({ plan: 'premium' })}
                >
                  {premiumPlan.cta}
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="relative z-10 w-full px-4 md:px-12 lg:px-[120px] mb-16 lg:mb-24" aria-label="Get started">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col items-center gap-4 px-6 py-12 md:px-12 lg:px-20 lg:py-24 bg-gradient-to-r from-[#7008e7] via-[#372aac] to-[#4d179a] rounded-2xl lg:rounded-3xl text-center text-white overflow-hidden">
              <h2 className="text-[26px] md:text-4xl lg:text-[40px] font-black leading-[1.1] text-white">
                Ready to read your way to fluency?
              </h2>
              <p className="text-[15px] lg:text-lg leading-[1.6] text-[#ddd6ff] max-w-[720px]">
                Join {formatLearners(learnerCount)} learners already using Gotcha every day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
                <a
                  className="inline-flex items-center justify-center h-12 px-[22px] bg-white text-[#2107aa] text-[15px] font-bold rounded-[14px] shadow-[0_10px_11px_rgba(0,0,0,0.15)] hover:translate-y-[-1px] transition-transform"
                  href={registerUrl({ plan: 'free' })}
                >
                  Start for free - no card needed
                </a>
                <a
                  className="inline-flex items-center justify-center h-12 px-[18px] border border-white/40 text-white text-[15px] font-semibold rounded-[14px] hover:translate-y-[-1px] transition-transform"
                  href="mailto:sales@gotcha.app"
                >
                  Contact sales
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
