import { Navigate, Route, Routes } from 'react-router-dom';
import AdminShell from './components/AdminShell';
import AiUsagePage from './pages/AiUsagePage';
import ContentEditorPage from './pages/ContentEditorPage';
import ContentPage from './pages/ContentPage';
import OverviewPage from './pages/OverviewPage';
import PricingPage from './pages/PricingPage';
import PaymentsPage from './pages/PaymentsPage';
import ImportPricingPage from './pages/ImportPricingPage';
import LanguagesPage from './pages/LanguagesPage';
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './pages/ProtectedRoute';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import { useAuth } from './lib/auth';

/** Dashboard is superadmin/analyst/editor only — moderators would otherwise land
 *  on a hard "Forbidden resource" error immediately after logging in. */
function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'moderator') return <Navigate to="/content/user-imports" replace />;
  return <OverviewPage />;
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
          <Route path="ai-usage" element={<AiUsagePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="import-pricing" element={<ImportPricingPage />} />
          <Route path="import-pricing/:directory" element={<ImportPricingPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/pricing" element={<PricingPage />} />
          {/* Analytics merged into Overview */}
          <Route path="analytics" element={<Navigate to="/" replace />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
