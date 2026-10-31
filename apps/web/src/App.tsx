import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { withLocaleQuery } from './lib/localeRedirect';
import LandingPage from './pages/LandingPage';
import { PrivacyPage, TermsPage } from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import { WebLocaleProvider } from './lib/webLocaleContext';

// web-launch-02: PM's new legal pages are QA-only (NOT FOR DEPLOY). VITE_LEGAL_V2 is inlined at build time,
// so the deploy build drops this branch and the generated legal HTML entirely.
const LEGAL_V2 = import.meta.env.VITE_LEGAL_V2 === 'true';
const LegalV2Page = LEGAL_V2 ? lazy(() => import('./pages/LegalV2Page')) : null;

export default function App() {
  return (
    <WebLocaleProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={LegalV2Page ? <Suspense fallback={null}><LegalV2Page doc="privacy" /></Suspense> : <PrivacyPage />} />
        <Route path="/terms" element={LegalV2Page ? <Suspense fallback={null}><LegalV2Page doc="terms" /></Suspense> : <TermsPage />} />
        {/* web-launch-02: /roadmap removed (UI/UX P0, unverifiable promises); /pricing has no page while prices are hidden (W-13). */}
        {LegalV2Page && <Route path="/oferta" element={<Suspense fallback={null}><LegalV2Page doc="oferta" /></Suspense>} />}
        <Route path="/roadmap" element={<HomeRedirect />} />
        <Route path="/pricing" element={<HomeRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </WebLocaleProvider>
  );
}

function HomeRedirect() {
  const { search } = useLocation();
  return <Navigate to={withLocaleQuery('/', search)} replace />;
}
