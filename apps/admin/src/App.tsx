import { Navigate, Route, Routes } from 'react-router-dom';
import AdminShell from './components/AdminShell';
import AiUsagePage from './pages/AiUsagePage';
import AnalyticsPage from './pages/AnalyticsPage';
import ContentPage from './pages/ContentPage';
import DashboardPage from './pages/DashboardPage';
import GamificationPage from './pages/GamificationPage';
import LanguagesPage from './pages/LanguagesPage';
import LevelTestsPage from './pages/LevelTestsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './pages/ProtectedRoute';
import SettingsPage from './pages/SettingsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SupportPage from './pages/SupportPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="languages" element={<LanguagesPage />} />
          <Route path="level-tests" element={<LevelTestsPage />} />
          <Route path="ai-usage" element={<AiUsagePage />} />
          <Route path="gamification" element={<GamificationPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Figma IA: ops live under Content → User Imports (not sidebar nav) */}
          <Route path="licenses" element={<Navigate to="/content?tab=user_imports" replace />} />
          <Route path="moderation" element={<Navigate to="/content?tab=user_imports" replace />} />
          <Route path="ingestion" element={<Navigate to="/content?tab=user_imports" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
