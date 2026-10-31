import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './lib/auth';
import { DocumentTitle } from './components/DocumentTitle';
import { DailyLimitNotice } from './components/DailyLimitNotice';
import './styles/index.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <DocumentTitle />
        <App />
        <DailyLimitNotice />
        <Toaster
          position="top-right"
          richColors
          visibleToasts={4}
          offset={{ top: 'var(--gotcha-toast-top, 16px)', right: '16px', bottom: '16px', left: '16px' }}
          mobileOffset={{ top: 'var(--gotcha-toast-top, 16px)', right: '16px', bottom: '16px', left: '16px' }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
