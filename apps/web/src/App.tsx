import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { withLocaleQuery } from './lib/localeRedirect';
import LandingPage from './pages/LandingPage';
import { PrivacyPage, TermsPage, OfertaPage } from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import { WebLocaleProvider } from './lib/webLocaleContext';

// web-launch-04: the wl01 legal drafts and the VITE_LEGAL_V2 QA path are retired. Canonical legal text lives in
// team/pm/legal/web/ (+ pending-payments-02/); the live pages stay LegalPage until that text is wired with its guards.

export default function App() {
  return (
    <WebLocaleProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/oferta" element={<OfertaPage />} />
        <Route path="/:locale" element={<LocalePage page="home" />} />
        <Route path="/:locale/privacy" element={<LocalePage page="privacy" />} />
        <Route path="/:locale/terms" element={<LocalePage page="terms" />} />
        <Route path="/:locale/oferta" element={<LocalePage page="oferta" />} />
        {/* web-launch-02: /roadmap removed (UI/UX P0, unverifiable promises); /pricing has no page while prices are hidden (W-13). */}
        <Route path="/roadmap" element={<HomeRedirect />} />
        <Route path="/pricing" element={<HomeRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </WebLocaleProvider>
  );
}

function LocalePage({ page }: { page: 'home' | 'privacy' | 'terms' | 'oferta' }) {
  const { locale } = useParams();
  if (locale !== 'en' && locale !== 'ru' && locale !== 'uz') return <NotFoundPage />;
  if (page === 'privacy') return <PrivacyPage />;
  if (page === 'terms') return <TermsPage />;
  if (page === 'oferta') return <OfertaPage />;
  return <LandingPage />;
}

function HomeRedirect() {
  const { search } = useLocation();
  return <Navigate to={withLocaleQuery('/', search)} replace />;
}
