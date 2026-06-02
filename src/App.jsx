import React from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MatchProvider, useMatch } from './context/MatchContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { VIEWS } from './utils/constants';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SetupPage from './pages/SetupPage';
import LiveMatchPage from './pages/LiveMatchPage';
import StatsPage from './pages/StatsPage';
import HistoryPage from './pages/HistoryPage';

function LangToggle() {
  const { lang, setLang, t } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      className="fixed top-2 right-2 z-50 px-3 py-1 rounded-full bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-600 transition-colors shadow-lg"
      style={{ direction: 'ltr' }}
    >
      {t('langToggleLabel')}
    </button>
  );
}

function AppContent() {
  const { state, dataLoading, dataError, setDataError } = useMatch();
  const { t } = useLanguage();

  if (dataLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('dataLoading')}</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-red-400 mb-4">{t('dataError')}</p>
          <button
            className="btn-3d btn-3d-blue px-6 py-3 text-sm font-semibold"
            onClick={() => setDataError(null)}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  switch (state.view) {
    case VIEWS.SETUP:   return <SetupPage />;
    case VIEWS.LIVE:    return <LiveMatchPage />;
    case VIEWS.STATS:   return <StatsPage />;
    case VIEWS.HISTORY: return <HistoryPage />;
    default:            return <HomePage />;
  }
}

function AuthGate() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <MatchProvider>
      <LangToggle />
      <AppContent />
    </MatchProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <div className="dark">
          <AuthGate />
        </div>
      </LanguageProvider>
    </AuthProvider>
  );
}
