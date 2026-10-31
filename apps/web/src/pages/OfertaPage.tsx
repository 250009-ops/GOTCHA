import { useSearchParams } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { OFERTA_HTML } from '../lib/ofertaHtml.generated';

export type OfertaLang = 'uz' | 'ru' | 'en';

/** ?lang=uz|ru|en (the checkout link passes the learner's UI language); else the browser language; else uz. */
export function ofertaLang(param: string | null, navLang?: string): OfertaLang {
  const pick = (v?: string | null) => {
    const l = (v ?? '').slice(0, 2).toLowerCase();
    return l === 'uz' || l === 'ru' || l === 'en' ? (l as OfertaLang) : null;
  };
  return pick(param) ?? pick(navLang) ?? 'uz';
}

const TITLE: Record<OfertaLang, string> = { uz: 'Ommaviy oferta', ru: 'Публичная оферта', en: 'Public Offer' };

export default function OfertaPage() {
  const [params] = useSearchParams();
  const lang = ofertaLang(params.get('lang'), typeof navigator !== 'undefined' ? navigator.language : undefined);
  return (
    <div className="bg-white">
      <Seo title={TITLE[lang]} description={TITLE[lang]} path="/oferta" />
      <SiteNav />
      <main lang={lang} className="legal-content mx-auto max-w-[760px] space-y-3 px-4 py-12 md:px-12">
        <div dangerouslySetInnerHTML={{ __html: OFERTA_HTML[lang] }} />
      </main>
      <SiteFooter />
    </div>
  );
}
