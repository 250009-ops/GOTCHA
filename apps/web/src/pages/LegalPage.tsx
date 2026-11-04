import { LandingShell } from '../components/LandingChrome';
import { Seo } from '../components/Seo';
import { LEGAL_TITLES, legalHtml, type LegalDoc } from '../lib/legalPm';
import { useWebLocale } from '../lib/webLocaleContext';
import { marketingLocaleFor } from '../lib/webLocale';

// WLF-07: the page body is the PM's HTML fragment (<article class="legal …" lang="…">), unchanged.
// The fragments are static, repo-vendored, comment-free text (check-legal enforces), not user input.
function PmLegalPage({ doc, path }: { doc: LegalDoc; path: string }) {
  const { copyLocale } = useWebLocale();
  const locale = marketingLocaleFor(copyLocale);
  const title = LEGAL_TITLES[doc][locale];
  return (
    <LandingShell>
      <Seo title={title} description={title} path={path} />
      <main className="lp-legal mx-auto w-full max-w-[820px] px-5 py-10 md:px-12 lg:py-14">
        <div className="legal-pm" data-legal-doc={doc} dangerouslySetInnerHTML={{ __html: legalHtml(doc, locale) }} />
      </main>
    </LandingShell>
  );
}

export function TermsPage() {
  return <PmLegalPage doc="terms" path="/terms" />;
}

export function PrivacyPage() {
  return <PmLegalPage doc="privacy" path="/privacy" />;
}

export function OfertaPage() {
  return <PmLegalPage doc="oferta" path="/oferta" />;
}
