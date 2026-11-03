import { Link, useLocation } from 'react-router-dom';
import { LocaleNavigate } from '../components/LocaleNavigate';
import { resolveLegacyPath } from '../lib/legacyRoutes';
import { useLearnerLocale } from '../lib/learnerLocaleContext';

const T = {
  en: { title: 'Page not found', body: 'This page does not exist or has moved.', home: 'Go to Library' },
  ru: { title: 'Страница не найдена', body: 'Такой страницы нет или она переехала.', home: 'В библиотеку' },
  uz: { title: 'Sahifa topilmadi', body: 'Bunday sahifa yoʻq yoki u koʻchirilgan.', home: 'Kutubxonaga oʻtish' },
};
export const notFoundText = (l?: string | null) => T[l === 'ru' || l === 'uz' ? l : 'en'];

/** S3a: legacy URL → redirect to its new equivalent; anything else → a real 404 page. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const { locale } = useLearnerLocale();
  const to = resolveLegacyPath(pathname);
  if (to) return <LocaleNavigate to={to} />;
  const t = notFoundText(locale);
  return (
    <main role="main" data-testid="not-found" className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-[#2107AA]">404</p>
      <h1 className="text-xl font-bold text-[#101828]">{t.title}</h1>
      <p className="text-sm text-[#4a5565]">{t.body}</p>
      <Link to="/app" className="mt-2 h-11 px-5 inline-flex items-center rounded-[14px] bg-[#2107AA] text-white text-sm font-bold">{t.home}</Link>
    </main>
  );
}
