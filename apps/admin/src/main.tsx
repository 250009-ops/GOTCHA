import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthProvider } from './lib/auth';
import './styles.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
