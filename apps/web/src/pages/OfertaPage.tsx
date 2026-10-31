import { useSearchParams } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { OFERTA_HTML, TERMS_HTML } from '../lib/ofertaHtml.generated';

export type OfertaLang = 'uz' | 'ru' | 'en';

/** ?lang=uz|ru|en (the checkout link passes the learner's UI language); else the browser language; else uz. */
export function ofertaLang(param: string | null, navLang?: string): OfertaLang {
  const pick = (v?: string | null) => {
    const l = (v ?? '').slice(0, 2).toLowerCase();
    return l === 'uz' || l === 'ru' || l === 'en' ? (l as OfertaLang) : null;
  };
  return pick(param) ?? pick(navLang) ?? 'uz';
}

const DOCS = {
  oferta: { html: OFERTA_HTML, path: '/oferta', title: { uz: 'Ommaviy oferta', ru: 'Публичная оферта', en: 'Public Offer' } },
  terms: { html: TERMS_HTML, path: '/terms', title: { uz: 'Foydalanish shartlari', ru: 'Условия использования', en: 'Terms of Use' } },
} as const;

/** payments-02 (PM 31 Oct): both /oferta and /terms render team/pm/legal/web/pending-payments-02. */
export function PendingLegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  const [params] = useSearchParams();
  const lang = ofertaLang(params.get('lang'), typeof navigator !== 'undefined' ? navigator.language : undefined);
  return (
    <div className="bg-white">
      <Seo title={d.title[lang]} description={d.title[lang]} path={d.path} />
      <SiteNav />
      <main lang={lang} className="legal-content mx-auto max-w-[760px] space-y-3 px-4 py-12 md:px-12">
        <div dangerouslySetInnerHTML={{ __html: d.html[lang] }} />
      </main>
      <SiteFooter />
    </div>
  );
}

export default function OfertaPage() {
  return <PendingLegalPage doc="oferta" />;
}
