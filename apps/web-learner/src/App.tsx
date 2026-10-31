import { LocaleNavigate } from './components/LocaleNavigate';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { useAppTheme } from './lib/appTheme';
import AuthPage from './pages/AuthPage';
import ImportPage from './pages/ImportPage';
import ImportPaymentReturnPage from './pages/ImportPaymentReturnPage';
import LearnerShell from './pages/LearnerShell';
import LibraryPage from './pages/LibraryPage';
import PracticePage from './pages/PracticePage';
import ReaderPage from './pages/ReaderPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import VocabularyPage from './pages/VocabularyPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const { preferences } = useAuth();
  useAppTheme(preferences?.appTheme);
  return (
    <Routes>
      <Route path="/" element={<LocaleNavigate to="/app" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <LearnerShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<LibraryPage />} />
        <Route path="browse" element={<LibraryPage />} />
        <Route path="vocabulary" element={<VocabularyPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="import/payment-return" element={<ImportPaymentReturnPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/app/read/:id"
        element={
          <ProtectedRoute>
            <ReaderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/practice"
        element={
          <ProtectedRoute>
            <PracticePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<LocaleNavigate to="/app" />} />
    </Routes>
  );
}
