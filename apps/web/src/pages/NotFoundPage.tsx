import { Link } from 'react-router-dom';
import { SiteFooter, SiteNav } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { useMarketingCopy } from '../lib/webLocaleContext';

/**
 * web-launch-02: a real 404 page instead of silently redirecting every unknown path to "/".
 * The SPA cannot set an HTTP status, so it is noindex here. DevOps can add an nginx 404 for
 * unknown paths later (see REVIEW-web-launch-02.md).
 */
export default function NotFoundPage() {
  const copy = useMarketingCopy();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo title={copy.notFound.seoTitle} description={copy.notFound.body} path="/404" noindex />
      <SiteNav />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="font-['Manrope',sans-serif] text-[56px] font-extrabold text-[#2107aa]">404</p>
        <h1 className="font-['Manrope',sans-serif] text-2xl font-bold text-[#101828]">{copy.notFound.title}</h1>
        <p className="text-base text-[#4a5565]">{copy.notFound.body}</p>
        <Link to="/" className="mt-2 rounded-lg bg-[#2107aa] px-5 py-3 text-sm font-semibold text-white">
          {copy.notFound.home}
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
