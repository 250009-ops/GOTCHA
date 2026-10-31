import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { LEGAL_HTML_V2 } from '../lib/legalHtml.generated';
import { useWebLocale } from '../lib/webLocaleContext';
import { marketingLocaleFor } from '../lib/webLocale';

/**
 * Legal pages from PM's canonical HTML (team/pm/legal/web, embedded verbatim by scripts/gen_legal.py).
 * QA build (VITE_LEGAL_V2=true): red NOT FOR DEPLOY banner. Production build: blocked by the
 * legal-publish-guard while [EFFECTIVE DATE] is unfilled; the banner disappears only once it can publish.
 */
const QA_BUILD = import.meta.env.VITE_LEGAL_V2 === 'true';
const TITLES = {
  terms: { uz: 'Foydalanish shartlari', ru: 'Условия использования', en: 'Terms of Use' },
  privacy: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности', en: 'Privacy Policy' },
  oferta: { uz: 'Ommaviy oferta', ru: 'Публичная оферта', en: 'Public offer' },
} as const;

const PROSE =
  "[&_h1]:mb-6 [&_h1]:font-['Manrope',sans-serif] [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-[#101828] " +
  "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#101828] " +
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-[#101828] [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 ' +
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-[#2107aa] [&_a]:underline [&_strong]:text-[#101828] ' +
  '[&_table]:my-4 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_th]:border [&_th]:border-[#e5e7eb] ' +
  '[&_th]:bg-[#f9fafb] [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-[#e5e7eb] [&_td]:p-2 [&_td]:align-top ' +
  '[&_mark]:bg-yellow-200';

export default function LegalV2Page({ doc }: { doc: 'terms' | 'privacy' | 'oferta' }) {
  const { copyLocale } = useWebLocale();
  const lang = marketingLocaleFor(copyLocale);
  const html = (LEGAL_HTML_V2[lang] ?? LEGAL_HTML_V2.uz)[doc];
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo title={TITLES[doc][lang]} description={TITLES[doc][lang]} path={`/${doc}`} noindex lang={lang} />
      <SiteNav />
      {QA_BUILD && (<div role="note" className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white" data-testid="legal-draft-banner">
        QA DRAFT · NOT FOR DEPLOY · pending legal review and owner approval
      </div>)}
      <main
        lang={lang}
        className={`mx-auto w-full max-w-[860px] px-5 py-12 text-[15px] leading-[1.7] text-[#4a5565] ${PROSE}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <SiteFooter />
    </div>
  );
}
