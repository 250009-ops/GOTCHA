import { Navigate, Route, Routes } from 'react-router-dom';
import AdminShell from './components/AdminShell';
import AiUsagePage from './pages/AiUsagePage';
import AnalyticsPage from './pages/AnalyticsPage';
import ContentEditorPage from './pages/ContentEditorPage';
import ContentPage from './pages/ContentPage';
import DashboardPage from './pages/DashboardPage';
import GamificationPage from './pages/GamificationPage';
import ImportPricingPage from './pages/ImportPricingPage';
import LanguagesPage from './pages/LanguagesPage';
import LevelTestsPage from './pages/LevelTestsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './pages/ProtectedRoute';
import SettingsPage from './pages/SettingsPage';
import SupportPage from './pages/SupportPage';
import UsersPage from './pages/UsersPage';
import { useAuth } from './lib/auth';

/** Dashboard is superadmin/analyst/editor only — moderators would otherwise land
 *  on a hard "Forbidden resource" error immediately after logging in. */
function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'moderator') return <Navigate to="/content/user-imports" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="content/new" element={<ContentEditorPage />} />
          <Route path="content/:id/edit" element={<ContentEditorPage />} />
          <Route path="content/:directory" element={<ContentPage />} />
          <Route path="languages" element={<LanguagesPage />} />
          <Route path="level-tests" element={<LevelTestsPage />} />
          <Route path="ai-usage" element={<AiUsagePage />} />
          <Route path="gamification" element={<GamificationPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="import-pricing" element={<ImportPricingPage />} />
          <Route path="import-pricing/:directory" element={<ImportPricingPage />} />
          {/* Legacy Subscriptions nav → Import & Pricing */}
          <Route path="subscriptions" element={<Navigate to="/import-pricing" replace />} />
          <Route path="subscriptions/:directory" element={<Navigate to="/import-pricing" replace />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Figma IA: ops live under Content → User Imports (not sidebar nav) */}
          <Route path="licenses" element={<Navigate to="/content/user-imports" replace />} />
          <Route path="moderation" element={<Navigate to="/content/user-imports" replace />} />
          <Route path="ingestion" element={<Navigate to="/content/user-imports" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
