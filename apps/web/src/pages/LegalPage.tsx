import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { legalCopyFor, type LegalSection } from '../lib/legalCopy';
import { useWebLocale } from '../lib/webLocaleContext';
import { marketingLocaleFor } from '../lib/webLocale';

type SectionData = LegalSection;

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        );
        setActive(topMost.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  return active;
}

function SectionBlock({
  section,
  headingFont,
  isLast,
}: {
  section: SectionData;
  headingFont: 'geist' | 'sora';
  isLast: boolean;
}) {
  const headingFontClass = headingFont === 'sora' ? "font-['Sora',sans-serif]" : "font-['Geist',sans-serif]";
  return (
    <div
      id={section.id}
      className={`flex w-full scroll-mt-28 flex-col gap-4 pb-8 ${
        isLast ? '' : 'border-b border-[#e5e7eb]'
      }`}
    >
      <h2 className={`flex items-baseline gap-2 text-[18px] font-bold ${headingFontClass}`}>
        <span className="text-[#7c3aed]">{section.number}.</span>
        <span className="text-[#111827]">{section.title}</span>
      </h2>
      <div className="flex w-full flex-col gap-3 font-['Geist',sans-serif] text-[14px] leading-[1.6] text-[#4a5565]">
        {section.paragraphs?.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
        {section.bulletsIntro && <p>{section.bulletsIntro}</p>}
        {section.bullets && (
          <div className="flex flex-col gap-3">
            {section.bullets.map((b) => (
              <div key={b.label} className="flex items-start gap-2 pl-2">
                <span className="font-bold text-[#7c3aed]">•</span>
                <p>
                  <span className="font-semibold text-[#111827]">{b.label}: </span>
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        )}
        {section.closing && <p>{section.closing}</p>}
        {section.highlight && (
          <div className="mt-1 w-full rounded-lg bg-[#f5f3ff] p-4">
            <p className="text-sm font-semibold text-[#7c3aed]">{section.highlight}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TocTerms({
  sections,
  active,
  tocTitle,
}: {
  sections: SectionData[];
  active: string;
  tocTitle: string;
}) {
  return (
    <nav className="sticky top-24 hidden max-h-[calc(100vh-7rem)] w-[280px] shrink-0 flex-col gap-3 self-start overflow-y-auto pr-4 lg:flex">
      <p className="font-['Geist',sans-serif] text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
        {tocTitle}
      </p>
      <div className="flex flex-col gap-0.5">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`truncate rounded-md px-3 py-2 font-['Geist',sans-serif] text-[13px] transition-colors ${
                isActive
                  ? 'bg-[#f5f3ff] font-semibold text-[#7c3aed]'
                  : 'font-medium text-[#4b5563] hover:bg-[#f9fafb]'
              }`}
            >
              {s.number}. {s.title}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function TocPrivacy({
  sections,
  active,
  tocTitle,
}: {
  sections: SectionData[];
  active: string;
  tocTitle: string;
}) {
  return (
    <nav className="sticky top-24 hidden max-h-[calc(100vh-7rem)] w-[240px] shrink-0 flex-col gap-1 self-start overflow-y-auto border-r border-[#e5e7eb] pr-4 lg:flex">
      <p className="mb-1 font-['Sora',sans-serif] text-xs font-bold uppercase text-[#9ca3af]">
        {tocTitle}
      </p>
      {sections.map((s) => {
        const isActive = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-['Geist',sans-serif] text-[13px] transition-colors ${
              isActive ? 'bg-[#f5f3ff] font-semibold text-[#7c3aed]' : 'text-[#4b5563] hover:bg-[#f9fafb]'
            }`}
          >
            <span className={`w-[18px] shrink-0 text-[12px] font-semibold ${isActive ? 'text-[#7c3aed]' : 'text-[#9ca3af]'}`}>
              {s.number}
            </span>
            <span className="flex-1 truncate">{s.tocLabel ?? s.title}</span>
          </a>
        );
      })}
    </nav>
  );
}

function MobileToc({ sections, tocTitle }: { sections: SectionData[]; tocTitle: string }) {
  return (
    <details className="mb-6 w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] lg:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 font-['Geist',sans-serif] text-sm font-semibold text-[#111827]">
        {tocTitle}
      </summary>
      <div className="flex flex-col gap-0.5 px-2 pb-3">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-md px-3 py-2 font-['Geist',sans-serif] text-[13px] text-[#4b5563] hover:bg-white"
          >
            {s.number}. {s.tocLabel ?? s.title}
          </a>
        ))}
      </div>
    </details>
  );
}

export function TermsPage() {
  const { copyLocale } = useWebLocale();
  const legal = legalCopyFor(marketingLocaleFor(copyLocale));
  const doc = legal.terms;
  const sections = doc.sections;
  const ids = sections.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <div className="bg-white">
      <Seo title={doc.seoTitle} description={doc.seoDescription} path="/terms" />
      <SiteNav />
      <div className="mx-auto flex max-w-[1195px] items-start gap-12 px-5 py-10 md:px-12 lg:px-12 lg:py-14">
        <TocTerms sections={sections} active={active} tocTitle={doc.tocTitle} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8 lg:max-w-[720px] lg:gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="font-['Geist',sans-serif] text-[32px] font-extrabold leading-tight text-[#111827] lg:text-[40px]">
              {doc.pageTitle}
            </h1>
            <div className="inline-flex w-fit items-center rounded-md bg-[#f9fafb] px-3 py-1.5">
              <p className="font-['Geist',sans-serif] text-[13px] font-medium text-[#4b5563]">
                {doc.lastUpdatedLabel}{' '}
                <span className="font-semibold text-[#111827]">{doc.lastUpdated}</span>
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-[#e5e7eb]" />

          {doc.intro && (
            <p className="font-['Geist',sans-serif] text-[15px] leading-[1.6] text-[#4a5565]">{doc.intro}</p>
          )}

          <MobileToc sections={sections} tocTitle={doc.tocTitle} />

          <div className="flex w-full flex-col gap-8">
            {sections.map((s, i) => (
              <SectionBlock key={s.id} section={s} headingFont="geist" isLast={i === sections.length - 1} />
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export function PrivacyPage() {
  const { copyLocale } = useWebLocale();
  const legal = legalCopyFor(marketingLocaleFor(copyLocale));
  const doc = legal.privacy;
  const sections = doc.sections;
  const ids = sections.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <div className="bg-white">
      <Seo title={doc.seoTitle} description={doc.seoDescription} path="/privacy" />
      <SiteNav />

      <div className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div className="mx-auto flex max-w-[1195px] flex-col gap-6 px-5 py-10 md:px-12 lg:px-16 lg:py-16">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-3 py-1.5">
              <span className="font-['Geist',sans-serif] text-xs font-semibold text-[#7c3aed]">
                {doc.lastUpdatedLabel} {doc.lastUpdated}
              </span>
            </span>
            <h1 className="font-['Sora',sans-serif] text-[32px] font-extrabold leading-tight text-[#111827] lg:text-[40px]">
              {doc.pageTitle}
            </h1>
          </div>

          <div className="flex flex-col gap-6 rounded-xl border border-[#e5e7eb] bg-white p-5 sm:flex-row sm:gap-12">
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-['Geist',sans-serif] text-xs font-semibold uppercase text-[#9ca3af]">
                {doc.dataControllerLabel}
              </p>
              <p className="font-['Sora',sans-serif] text-[15px] font-semibold text-[#111827]">
                {doc.dataController}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-['Geist',sans-serif] text-xs font-semibold uppercase text-[#9ca3af]">
                {doc.privacyContactLabel}
              </p>
              <p className="font-['Sora',sans-serif] text-[15px] font-semibold text-[#7c3aed]">
                {doc.privacyContact}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1195px] items-start gap-12 px-5 py-10 md:px-12 lg:px-16 lg:py-12">
        <TocPrivacy sections={sections} active={active} tocTitle={doc.tocTitle} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8 lg:max-w-[779px]">
          <MobileToc sections={sections} tocTitle={doc.tocTitle} />
          {sections.map((s, i) => (
            <SectionBlock key={s.id} section={s} headingFont="sora" isLast={i === sections.length - 1} />
          ))}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple legal page wrapper — used by pages without a dedicated Figma design
// ---------------------------------------------------------------------------

function LegalPage({
  title,
  updated,
  description,
  path,
  children,
}: {
  title: string;
  updated: string;
  description: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-white">
      <Seo title={title} description={description} path={path} />
      <SiteNav />

      <img
        className="absolute -top-20 -right-10 w-[360px] h-[360px] opacity-55 pointer-events-none z-0"
        src="/assets/legal/bg-accent-1.svg"
        alt=""
        width={360}
        height={360}
      />
      <img
        className="absolute bottom-[180px] -left-[100px] w-[280px] h-[280px] opacity-45 pointer-events-none z-0"
        src="/assets/legal/bg-accent-2.svg"
        alt=""
        width={280}
        height={280}
      />

      <main className="relative z-10 max-w-[760px] mx-auto px-4 md:px-12 lg:px-[120px] py-16 lg:py-24">
        <Link className="inline-block mb-7 text-sm font-semibold text-[#2107aa] hover:underline" to="/">
          ← Back to home
        </Link>

        <p className="mb-3 text-xs font-bold tracking-[0.6px] uppercase text-[#2107aa]">Legal</p>

        <h1 className="mb-3 text-4xl lg:text-5xl font-['Bagel_Fat_One',cursive] font-normal tracking-[-0.5px] leading-[1.15] text-[#101828]">
          {title}
        </h1>

        <p className="mb-9 text-sm leading-5 text-[#6a7282]">Last updated {updated}</p>

        <div className="legal-content space-y-3">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function RoadmapPage() {
  return (
    <LegalPage
      title="Product Roadmap"
      updated="August 6, 2026"
      path="/roadmap"
      description="What GOTCHA is building next for reading-first fluency across English, Russian, and Uzbek."
    >
      <p className="text-base leading-[1.7] text-[#4a5565]">
        What we're building next for reading-first fluency across English, Russian, and Uzbek.
      </p>
      <h2 className="mt-8 mb-3 text-xl font-bold tracking-[-0.3px] text-[#101828]">Now</h2>
      <ul className="list-disc pl-5 space-y-1 text-base leading-[1.7] text-[#4a5565]">
        <li>Desktop 3-panel reader with AI word lookup</li>
        <li>Spaced repetition reviews from your reading</li>
        <li>URL, PDF, and ePub imports</li>
      </ul>
      <h2 className="mt-8 mb-3 text-xl font-bold tracking-[-0.3px] text-[#101828]">Next</h2>
      <ul className="list-disc pl-5 space-y-1 text-base leading-[1.7] text-[#4a5565]">
        <li>Offline reading</li>
        <li>Richer CEFR progress analytics</li>
        <li>More curated library titles with licensed partners</li>
      </ul>
      <h2 className="mt-8 mb-3 text-xl font-bold tracking-[-0.3px] text-[#101828]">Later</h2>
      <ul className="list-disc pl-5 space-y-1 text-base leading-[1.7] text-[#4a5565]">
        <li>Additional target languages</li>
        <li>Classroom / team plans</li>
        <li>Deeper mobile parity with desktop reader</li>
      </ul>
    </LegalPage>
  );
}
