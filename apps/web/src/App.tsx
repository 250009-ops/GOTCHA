import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { withLocaleQuery } from './lib/localeRedirect';
import LandingPage from './pages/LandingPage';
import LegalV2Page from './pages/LegalV2Page';
import NotFoundPage from './pages/NotFoundPage';
import { WebLocaleProvider } from './lib/webLocaleContext';

// landing-premium-02: /privacy, /terms and /oferta render PM's canonical legal HTML (verbatim).
// VITE_LEGAL_V2=true (QA build) shows the NOT FOR DEPLOY banner; a production build without it fails while
// [EFFECTIVE DATE] is unfilled (vite.config.ts legal-publish-guard). /oferta is routed but not linked anywhere.

export default function App() {
  return (
    <WebLocaleProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<LegalV2Page doc="privacy" />} />
        <Route path="/terms" element={<LegalV2Page doc="terms" />} />
        <Route path="/oferta" element={<LegalV2Page doc="oferta" />} />
        {/* web-launch-02: /roadmap removed (UI/UX P0, unverifiable promises); /pricing has no page while prices are hidden (W-13). */}
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
