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
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './pages/ProtectedRoute';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import { useAuth } from './lib/auth';
import { RoleRoute } from './pages/RoleRoute';
import { ROUTE_ROLES } from './lib/routeRoles';

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
          <Route path="users" element={<RoleRoute roles={ROUTE_ROLES['users']}><UsersPage /></RoleRoute>} />
          <Route path="content" element={<RoleRoute roles={ROUTE_ROLES['content']}><ContentPage /></RoleRoute>} />
          <Route path="content/new" element={<RoleRoute roles={ROUTE_ROLES['content/new']}><ContentEditorPage /></RoleRoute>} />
          <Route path="content/:id/edit" element={<RoleRoute roles={ROUTE_ROLES['content/:id/edit']}><ContentEditorPage /></RoleRoute>} />
          <Route path="content/:directory" element={<RoleRoute roles={ROUTE_ROLES['content/:directory']}><ContentPage /></RoleRoute>} />
          <Route path="languages" element={<RoleRoute roles={ROUTE_ROLES['languages']}><LanguagesPage /></RoleRoute>} />
          <Route path="ai-usage" element={<RoleRoute roles={ROUTE_ROLES['ai-usage']}><AiUsagePage /></RoleRoute>} />
          <Route path="gamification" element={<RoleRoute roles={ROUTE_ROLES['gamification']}><GamificationPage /></RoleRoute>} />
          <Route path="reports" element={<RoleRoute roles={ROUTE_ROLES['reports']}><ReportsPage /></RoleRoute>} />
          <Route path="notifications" element={<RoleRoute roles={ROUTE_ROLES['notifications']}><NotificationsPage /></RoleRoute>} />
          <Route path="import-pricing" element={<RoleRoute roles={ROUTE_ROLES['import-pricing']}><ImportPricingPage /></RoleRoute>} />
          <Route path="import-pricing/:directory" element={<RoleRoute roles={ROUTE_ROLES['import-pricing/:directory']}><ImportPricingPage /></RoleRoute>} />
          <Route path="analytics" element={<RoleRoute roles={ROUTE_ROLES['analytics']}><AnalyticsPage /></RoleRoute>} />
          <Route path="settings" element={<RoleRoute roles={ROUTE_ROLES['settings']}><SettingsPage /></RoleRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
