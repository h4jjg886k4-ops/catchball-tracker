import React from 'react';
import { MatchProvider, useMatch } from './context/MatchContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { VIEWS } from './utils/constants';
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
  const { state } = useMatch();

  switch (state.view) {
    case VIEWS.SETUP:
      return <SetupPage />;
    case VIEWS.LIVE:
      return <LiveMatchPage />;
    case VIEWS.STATS:
      return <StatsPage />;
    case VIEWS.HISTORY:
      return <HistoryPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  return (
    <LanguageProvider>
      <MatchProvider>
        <div className="dark">
          <LangToggle />
          <AppContent />
        </div>
      </MatchProvider>
    </LanguageProvider>
  );
}
