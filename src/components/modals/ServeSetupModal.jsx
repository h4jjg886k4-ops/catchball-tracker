import React from 'react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ServeSetupModal() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  if (!currentMatch) return null;

  function select(servingTeam) {
    dispatch({ type: 'SET_SERVE_TEAM', servingTeam });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div className="bg-slate-800 rounded-2xl w-full max-w-sm mx-4 p-6 border border-slate-600 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏐</div>
          <h2 className="text-white font-black text-xl mb-1">{t('whoServesFirst')}</h2>
          <p className="text-slate-400 text-sm">
            {t('setLabel')} {currentMatch.currentSetIndex + 1}
          </p>
        </div>

        <div className="space-y-3">
          <button
            className="w-full py-5 rounded-xl bg-green-700 hover:bg-green-600 active:scale-95 text-white font-black text-lg transition-all"
            onClick={() => select('home')}
          >
            {currentMatch.homeTeam.name}
            <div className="text-green-200 font-normal text-sm mt-0.5">{t('myTeam')}</div>
          </button>

          <button
            className="w-full py-5 rounded-xl bg-red-800 hover:bg-red-700 active:scale-95 text-white font-black text-lg transition-all"
            onClick={() => select('opponent')}
          >
            {currentMatch.opponentTeam.name}
            <div className="text-red-200 font-normal text-sm mt-0.5">{t('opponent')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
