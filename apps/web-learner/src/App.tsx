import { LocaleNavigate } from './components/LocaleNavigate';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { useAppTheme } from './lib/appTheme';
import AuthPage from './pages/AuthPage';
import ImportPage from './pages/ImportPage';
import ImportPaymentReturnPage from './pages/ImportPaymentReturnPage';
import PaymentsPage from './pages/PaymentsPage';
import PlusPage from './pages/PlusPage';
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
import NotFoundPage from './pages/NotFoundPage';
import TgEntry from './tg/TgEntry';
import TgSignup from './tg/TgSignup';
import TgLogin from './tg/TgLogin';
import TelegramShell, { TelegramBackButton } from './tg/TelegramShell';
import TgProfilePage from './tg/TgProfilePage';
import { isTelegramMode } from './lib/telegram';

export default function App() {
  const { preferences } = useAuth();
  useAppTheme(preferences?.appTheme);
  // Opened from the Telegram bot: same /app routes, Telegram shell (floating tab bar, native back button).
  const telegram = isTelegramMode();
  return (
    <>
    {telegram && <TelegramBackButton />}
    <Routes>
      <Route path="/" element={<LocaleNavigate to="/app" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/tg" element={<TgEntry />} />
      <Route path="/tg/signup" element={<TgSignup />} />
      <Route path="/tg/login" element={<TgLogin />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            {telegram ? <TelegramShell /> : <LearnerShell />}
          </ProtectedRoute>
        }
      >
        <Route index element={<LibraryPage />} />
        <Route path="browse" element={<LibraryPage />} />
        <Route path="vocabulary" element={<VocabularyPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="import/payment-return" element={<ImportPaymentReturnPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="plus" element={<PlusPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={telegram ? <TgProfilePage /> : <LocaleNavigate to="/app/settings" />} />
        {/* Mashq home lives in the shell (sidebar + top bar); a running session opens as a focused full-screen layer. */}
        <Route path="practice" element={<PracticePage />} />
        {/* S3a: /app/<legacy> → new route; unknown → 404 page inside the shell */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/app/read/:id"
        element={
          <ProtectedRoute>
            <ReaderPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}
