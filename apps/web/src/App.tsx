import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { PrivacyPage, RoadmapPage, TermsPage } from './pages/LegalPage';
import OfertaPage from './pages/OfertaPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/oferta" element={<OfertaPage />} />
      <Route path="/roadmap" element={<RoadmapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
