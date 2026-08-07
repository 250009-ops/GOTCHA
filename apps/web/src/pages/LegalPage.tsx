import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../components/SiteChrome';

// ---------------------------------------------------------------------------
// Shared content model for Terms of Service / Privacy Policy
// ---------------------------------------------------------------------------

type Bullet = { label: string; body: string };

type SectionData = {
  id: string;
  number: string;
  title: string;
  tocLabel?: string;
  paragraphs?: string[];
  bulletsIntro?: string;
  bullets?: Bullet[];
  closing?: string;
  highlight?: string;
};

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

function TocTerms({ sections, active }: { sections: SectionData[]; active: string }) {
  return (
    <nav className="sticky top-24 hidden max-h-[calc(100vh-7rem)] w-[280px] shrink-0 flex-col gap-3 self-start overflow-y-auto pr-4 lg:flex">
      <p className="font-['Geist',sans-serif] text-xs font-bold uppercase tracking-wide text-[#9ca3af]">
        Table of Contents
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

function TocPrivacy({ sections, active }: { sections: SectionData[]; active: string }) {
  return (
    <nav className="sticky top-24 hidden max-h-[calc(100vh-7rem)] w-[240px] shrink-0 flex-col gap-1 self-start overflow-y-auto border-r border-[#e5e7eb] pr-4 lg:flex">
      <p className="mb-1 font-['Sora',sans-serif] text-xs font-bold uppercase text-[#9ca3af]">
        Document Outline
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

function MobileToc({ sections }: { sections: SectionData[] }) {
  return (
    <details className="mb-6 w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] lg:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 font-['Geist',sans-serif] text-sm font-semibold text-[#111827]">
        Table of Contents
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

// ---------------------------------------------------------------------------
// Terms of Service — verbatim content from Figma node 8:559 → 41:5
// ---------------------------------------------------------------------------

const TERMS_SECTIONS: SectionData[] = [
  {
    id: 'section-1',
    number: '1',
    title: 'Acceptance of Terms',
    paragraphs: [
      'By creating an account, accessing, or using GOTCHA (collectively, the "Service"), you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not access or use our Service. These Terms constitute a binding legal agreement between you and GOTCHA.',
    ],
  },
  {
    id: 'section-2',
    number: '2',
    title: 'Who May Use Gotcha',
    paragraphs: [
      'You must be at least 13 years old to use the Service. If you are under the age of majority in your jurisdiction, you represent that you have received parental or guardian permission to use GOTCHA and that they agree to these Terms on your behalf.',
    ],
  },
  {
    id: 'section-3',
    number: '3',
    title: 'The Service',
    paragraphs: [
      'GOTCHA provides a reading-first language learning platform including, but not limited to, digitized texts, custom vocabulary practice databases, spaced repetition system (SRS) scheduling, and AI-assisted contextual word lookup interfaces.',
    ],
  },
  {
    id: 'section-4',
    number: '4',
    title: 'Accounts and Security',
    paragraphs: [
      'To access certain features, you must register for an account. You agree to provide accurate, current, and complete information, and to maintain the security of your password. You must notify us immediately of any unauthorized use of your account.',
    ],
  },
  {
    id: 'section-5',
    number: '5',
    title: 'Subscriptions and Payments',
    paragraphs: [
      'Premium features require a paid subscription. All fees are billed in advance and are non-refundable unless required by law. Subscriptions automatically renew at the end of each billing cycle unless cancelled prior to the renewal date.',
    ],
  },
  {
    id: 'section-6',
    number: '6',
    title: 'License to Use Gotcha',
    paragraphs: [
      'We grant you a personal, non-exclusive, non-transferable, revocable, and limited license to access and use the GOTCHA application solely for your personal, non-commercial language learning purposes.',
    ],
  },
  {
    id: 'section-7',
    number: '7',
    title: 'User Content and Imports',
    paragraphs: [
      'Our Service allows you to paste texts, submit web URLs, and upload documents for reading. You retain full ownership of any content you import. You represent that you have all necessary rights to import and process such materials.',
    ],
  },
  {
    id: 'section-8',
    number: '8',
    title: 'Catalog and Licensed Content',
    paragraphs: [
      'The curated texts, audio files, and translations provided in the GOTCHA official catalog are owned by us or our licensors. You agree not to copy, redistribute, sell, or exploit any portion of our curated catalog without explicit authorization.',
    ],
  },
  {
    id: 'section-9',
    number: '9',
    title: 'AI Features and Limitations',
    paragraphs: [
      'GOTCHA incorporates artificial intelligence tools to assist with contextual definitions and grammar explanations. AI results may occasionally be inaccurate or misleading. Do not rely on AI-generated translations as professional or legal advice.',
    ],
  },
  {
    id: 'section-10',
    number: '10',
    title: 'Acceptable Use',
    paragraphs: [
      'You agree not to engage in harassment, upload malicious code, scrape the website, attempt unauthorized access to our servers, or abuse automated AI quotas in a manner that degrades service performance for other learners.',
    ],
  },
  {
    id: 'section-11',
    number: '11',
    title: 'Privacy Policy',
    paragraphs: [
      'Your privacy is vital to us. Our Privacy Policy (available separately) explains how we collect, store, process, and protect your personal information, custom imported texts, and language learning progress metrics.',
    ],
  },
  {
    id: 'section-12',
    number: '12',
    title: 'Intellectual Property',
    paragraphs: [
      'The GOTCHA software, interface, design, proprietary SRS algorithms, logos, branding, and original content are the exclusive property of GOTCHA and are protected by international copyright, trademark, and trade secret laws.',
    ],
  },
  {
    id: 'section-13',
    number: '13',
    title: 'Disclaimers',
    paragraphs: [
      'The Service is provided on an "AS IS" and "AS AVAILABLE" basis. GOTCHA explicitly disclaims all warranties of any kind, whether express or implied, including the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
    ],
  },
  {
    id: 'section-14',
    number: '14',
    title: 'Limitation of Liability',
    paragraphs: [
      "To the maximum extent permitted by law, GOTCHA's total liability for any claim arising out of these Terms or use of the Service shall not exceed the total amount paid by you to GOTCHA during the twelve (12) months preceding the claim.",
    ],
  },
  {
    id: 'section-15',
    number: '15',
    title: 'Indemnity',
    paragraphs: [
      'You agree to defend, indemnify, and hold harmless GOTCHA and its affiliates from and against any claims, damages, costs, liabilities, and expenses arising out of your violation of these Terms or misuse of the Service.',
    ],
  },
  {
    id: 'section-16',
    number: '16',
    title: 'Termination',
    paragraphs: [
      'We reserve the right to suspend or terminate your account or access to the Service at any time, with or without cause or notice, if we believe you are in breach of these Terms of Service.',
    ],
  },
  {
    id: 'section-17',
    number: '17',
    title: 'Changes to Terms',
    paragraphs: [
      'We may update these Terms from time to time. If we make material modifications, we will notify you by email or through a prominent notice on our website prior to the change taking effect. Continued use of the app constitutes acceptance.',
    ],
  },
  {
    id: 'section-18',
    number: '18',
    title: 'Governing Law',
    paragraphs: [
      'These Terms of Service and your relationship with GOTCHA shall be governed by and construed in accordance with the laws of the jurisdiction in which the company is registered, without regard to its conflict of law principles.',
    ],
  },
  {
    id: 'section-19',
    number: '19',
    title: 'Contact Information',
    paragraphs: [
      'For any questions, legal notices, or feedback regarding these Terms, please contact our legal compliance team at legal@gotcha.app.',
    ],
  },
];

const TERMS_INTRO =
  'Please read these Terms of Service carefully before using GOTCHA. These Terms govern your access to and use of our reading-based language tools, automated spaced repetition algorithms, custom document processing services, and AI assistance modules.';

// ---------------------------------------------------------------------------
// Privacy Policy — verbatim content from Figma node 8:559 → 41:152
// ---------------------------------------------------------------------------

const PRIVACY_SECTIONS: SectionData[] = [
  {
    id: 'section-scope',
    number: '1',
    title: 'Scope',
    tocLabel: 'Scope',
    paragraphs: [
      "This Privacy Policy describes how Gotcha Language Learning ('Gotcha', 'we', 'our', or 'us') collects, uses, processes, and shares your personal data when you access or use the GOTCHA language learning application, our website, and any related services. By using our service, you acknowledge that you have read and understood the data practices outlined in this policy.",
      'This policy applies strictly to users, visitors, and customers of GOTCHA. If you do not agree with any terms within this policy, you must immediately cease accessing or using our language learning platform.',
    ],
  },
  {
    id: 'section-data',
    number: '2',
    title: 'Data We Collect',
    tocLabel: 'Data we collect',
    bulletsIntro:
      'In order to provide our reading-first language experience, we collect specific information depending on how you interact with our application:',
    bullets: [
      {
        label: 'Account Data',
        body: 'Your email address, hashed password, display name, native language, target languages, and your self-assessed or tested CEFR proficiency levels.',
      },
      {
        label: 'Learning Activity',
        body: 'Reading progress, articles read, custom vocabulary lists, saved terms, streak statistics, quiz answers, reading speeds, and overall interaction history.',
      },
      {
        label: 'Technical Data',
        body: 'Your device type, browser information, IP address, system crash logs, and localized system preferences.',
      },
      {
        label: 'Billing Data',
        body: 'Subscription plan details and secure reference tokens provided by our third-party payment processors (we do not store raw credit card numbers).',
      },
      {
        label: 'Communications',
        body: 'Any correspondence, feature requests, or support messages you send directly to our team.',
      },
    ],
  },
  {
    id: 'section-use',
    number: '3',
    title: 'How We Use Data',
    tocLabel: 'How we use data',
    bulletsIntro:
      'We utilize your personal data to run, secure, and constantly optimize your language learning journey. This includes the following essential business purposes:',
    bullets: [
      { label: 'Account Management', body: 'To create, secure, and maintain your personal learner profile.' },
      {
        label: 'Platform Functionality',
        body: 'To track your learning streak, save your custom vocabulary lists, and calculate reading comprehension scores.',
      },
      {
        label: 'Personalization',
        body: 'To recommend texts and content tailored directly to your current CEFR level and vocabulary history.',
      },
      {
        label: 'Quotas and Plans',
        body: 'To enforce subscription tiers, usage limits, and premium translation constraints.',
      },
      {
        label: 'Communications',
        body: 'To send service updates, security alerts, and customized progress summaries.',
      },
    ],
  },
  {
    id: 'section-ai',
    number: '4',
    title: 'AI Processing',
    tocLabel: 'AI processing',
    paragraphs: [
      'GOTCHA utilizes advanced AI models to provide instant high-fidelity translations, clear grammatical context, and custom learning explanations. Texts you interact with may be securely processed through our selected AI partners to generate context-specific guides.',
      'To protect learner privacy and increase system efficiency, we optimize translation pipelines by safely caching shared lemma translations and dictionary references. Custom query translations are processed ephemerally and are not used by our partners to train public models.',
    ],
  },
  {
    id: 'section-gdpr',
    number: '5',
    title: 'Legal Bases (GDPR)',
    tocLabel: 'Legal bases',
    bulletsIntro:
      'If you reside within the European Economic Area (EEA) or United Kingdom (UK), we process your data under the following legitimate legal bases:',
    bullets: [
      {
        label: 'Contractual Necessity',
        body: 'Processing necessary to fulfill our service commitments as outlined in our Terms of Service.',
      },
      {
        label: 'Legitimate Interests',
        body: 'Our business interest in improving our reading software, analyzing aggregate platform usage, and securing our infrastructure.',
      },
      { label: 'Consent', body: 'Where you have explicitly granted permission, such as optional analytical cookies.' },
      { label: 'Legal Obligation', body: 'Compliance with governing tax, audit, or law enforcement mandates.' },
    ],
  },
  {
    id: 'section-sharing',
    number: '6',
    title: 'Sharing of Information',
    tocLabel: 'Sharing',
    bulletsIntro:
      'We do not sell, rent, or trade your personal data to third parties. We share your information only with trusted processors necessary to deliver our services:',
    bullets: [
      {
        label: 'Infrastructure & Hosting',
        body: 'Secure cloud servers where application databases and learning assets reside.',
      },
      { label: 'AI Providers', body: 'Processing textual segments for real-time translations and grammatical aids.' },
      { label: 'Payment Processors', body: 'Handling subscription transactions securely (Stripe).' },
      {
        label: 'Analytics Tools',
        body: 'To diagnose app crashes and understand generic user engagement patterns.',
      },
    ],
  },
  {
    id: 'section-transfers',
    number: '7',
    title: 'International Transfers',
    tocLabel: 'International transfers',
    paragraphs: [
      'Gotcha operates globally. Personal data collected from you may be stored and processed in the United States or any other country where we or our service providers maintain facilities.',
      'Whenever we transfer personal data across borders, we implement recognized contractual safeguards, including standard European Commission contractual clauses, to guarantee your privacy rights remain fully protected.',
    ],
  },
  {
    id: 'section-retention',
    number: '8',
    title: 'Data Retention',
    tocLabel: 'Retention',
    paragraphs: [
      'We retain your personal data only as long as your account is active or as necessary to provide you with the language app. If you request account deletion, we purge all personal data within 30 days.',
      'We reserve the right to delete accounts that have been completely inactive for a continuous period of 12 months, following written notification sent to your registered email address.',
    ],
  },
  {
    id: 'section-security',
    number: '9',
    title: 'Data Security',
    tocLabel: 'Security',
    paragraphs: [
      'The security of your personal data is our utmost priority. We employ industry-standard security safeguards to protect your records from unauthorized access, loss, or disclosure.',
      'These measures include end-to-end HTTPS encryption for all data in transit, standard cryptographic hashing for all account passwords, and strict role-based internal access controls.',
    ],
  },
  {
    id: 'section-rights',
    number: '10',
    title: 'Your Rights',
    tocLabel: 'Your rights',
    bulletsIntro:
      'Depending on your location, you have strong legislative rights regarding your personal information. These generally include:',
    bullets: [
      { label: 'Access', body: 'The right to request a full copy of the personal data we hold about you.' },
      { label: 'Correction', body: 'The right to rectify inaccurate account details or test scores.' },
      { label: 'Erasure', body: 'The right to demand the permanent deletion of your learning history and profile.' },
      {
        label: 'Portability',
        body: 'The right to export your active custom vocabulary list in a standardized format.',
      },
    ],
    closing:
      'To exercise any of these rights, please send an inquiry from your registered account email to privacy@gotcha.app. We respond to all requests within 30 days.',
  },
  {
    id: 'section-children',
    number: '11',
    title: "Children's Privacy",
    tocLabel: 'Children',
    paragraphs: [
      'GOTCHA is not intended for or directed towards children under the age of 13. We do not knowingly collect or solicit personal information from children.',
      'If we discover that a child under 13 has registered an account with us, we will take immediate steps to permanently delete the profile and any associated learning metadata.',
    ],
  },
  {
    id: 'section-cookies',
    number: '12',
    title: 'Cookies & Tracking',
    tocLabel: 'Cookies',
    paragraphs: [
      'We use cookies to maintain your login session and store your language preferences (e.g., target language). These essential cookies are required for the app to function.',
      'We also use limited, non-intrusive analytics cookies to measure general app performance and identify navigation friction. You can easily manage your cookie preferences through your browser settings.',
    ],
  },
  {
    id: 'section-imports',
    number: '13',
    title: 'User Imported Content',
    tocLabel: 'User imports',
    paragraphs: [
      'GOTCHA allows users to import custom articles, books, and web pages for personalized reading practice. You are solely responsible for ensuring you have the legal right to import and parse any such content.',
      'We treat your imported materials as private to your account. However, system algorithms and AI models process this text ephemerally to generate vocabulary definitions and grammatical aids.',
    ],
  },
  {
    id: 'section-changes',
    number: '14',
    title: 'Changes to This Policy',
    tocLabel: 'Changes',
    paragraphs: [
      "We may update this Privacy Policy from time to time to reflect changes in our legal obligations or application architecture. When changes are made, we will update the 'Last updated' date at the top of this document.",
      'We encourage you to review this page periodically to stay informed about how we safeguard the information we collect.',
    ],
  },
  {
    id: 'section-contact',
    number: '15',
    title: 'Contact Us',
    tocLabel: 'Contact',
    paragraphs: [
      'If you have any questions, concerns, or feedback regarding this Privacy Policy or our general data handling practices, please reach out to us at our dedicated security inbox:',
    ],
    highlight: 'Email: privacy@gotcha.app',
  },
];

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const UPDATED = 'August 6, 2026';

export function TermsPage() {
  const ids = TERMS_SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <div className="bg-white">
      <SiteNav />
      <div className="mx-auto flex max-w-[1195px] items-start gap-12 px-5 py-10 md:px-12 lg:px-12 lg:py-14">
        <TocTerms sections={TERMS_SECTIONS} active={active} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8 lg:max-w-[720px] lg:gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="font-['Geist',sans-serif] text-[32px] font-extrabold leading-tight text-[#111827] lg:text-[40px]">
              Terms of Service
            </h1>
            <div className="inline-flex w-fit items-center rounded-md bg-[#f9fafb] px-3 py-1.5">
              <p className="font-['Geist',sans-serif] text-[13px] font-medium text-[#4b5563]">
                Last updated: <span className="font-semibold text-[#111827]">{UPDATED}</span>
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-[#e5e7eb]" />

          <p className="font-['Geist',sans-serif] text-[15px] leading-[1.6] text-[#4a5565]">{TERMS_INTRO}</p>

          <MobileToc sections={TERMS_SECTIONS} />

          <div className="flex w-full flex-col gap-8">
            {TERMS_SECTIONS.map((s, i) => (
              <SectionBlock key={s.id} section={s} headingFont="geist" isLast={i === TERMS_SECTIONS.length - 1} />
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export function PrivacyPage() {
  const ids = PRIVACY_SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <div className="bg-white">
      <SiteNav />

      <div className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div className="mx-auto flex max-w-[1195px] flex-col gap-6 px-5 py-10 md:px-12 lg:px-16 lg:py-16">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-3 py-1.5">
              <span className="font-['Geist',sans-serif] text-xs font-semibold text-[#7c3aed]">
                Last updated: {UPDATED}
              </span>
            </span>
            <h1 className="font-['Sora',sans-serif] text-[32px] font-extrabold leading-tight text-[#111827] lg:text-[40px]">
              Privacy Policy
            </h1>
          </div>

          <div className="flex flex-col gap-6 rounded-xl border border-[#e5e7eb] bg-white p-5 sm:flex-row sm:gap-12">
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-['Geist',sans-serif] text-xs font-semibold uppercase text-[#9ca3af]">
                Data Controller
              </p>
              <p className="font-['Sora',sans-serif] text-[15px] font-semibold text-[#111827]">
                Gotcha Language Learning, Inc.
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="font-['Geist',sans-serif] text-xs font-semibold uppercase text-[#9ca3af]">
                Privacy Inquiries &amp; Contact
              </p>
              <p className="font-['Sora',sans-serif] text-[15px] font-semibold text-[#7c3aed]">privacy@gotcha.app</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1195px] items-start gap-12 px-5 py-10 md:px-12 lg:px-16 lg:py-12">
        <TocPrivacy sections={PRIVACY_SECTIONS} active={active} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-8 lg:max-w-[779px]">
          <MobileToc sections={PRIVACY_SECTIONS} />
          {PRIVACY_SECTIONS.map((s, i) => (
            <SectionBlock key={s.id} section={s} headingFont="sora" isLast={i === PRIVACY_SECTIONS.length - 1} />
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

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-white">
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
    <LegalPage title="Product Roadmap" updated="August 6, 2026">
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
        <li>Offline reading for Premium</li>
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
