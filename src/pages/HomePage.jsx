import React from 'react';
import { Trophy, Plus, BarChart2, History, LogOut } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { VIEWS } from '../utils/constants';

export default function HomePage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { matches, currentMatch } = state;

  const recentMatches = matches.slice(0, 3);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.78)), url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#0f172a',
      }}
    >
      {/* User bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-slate-400 text-xs truncate max-w-[70%]">
          {user?.displayName || user?.email}
        </span>
        <button
          className="btn-3d btn-3d-slate flex items-center gap-1.5 text-xs px-3 py-1.5"
          onClick={signOut}
        >
          <LogOut size={13} /> {t('logout')}
        </button>
      </div>

      {/* Hero */}
      <div className="bg-slate-900/30 px-6 pt-6 pb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
          <Trophy size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">{t('appName')}</h1>
        <p className="text-slate-400 text-sm">{t('appTagline')}</p>
      </div>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4 bg-slate-900/40 backdrop-blur-sm">
        {/* Resume current match */}
        {currentMatch && currentMatch.status !== 'completed' && (
          <div className="bg-blue-900/40 border border-blue-700 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">{t('liveMatchLabel')}</span>
            </div>
            <div className="text-white font-bold text-lg mb-1">
              {currentMatch.homeTeam.name} {t('vs')} {currentMatch.opponentTeam.name}
            </div>
            <div className="text-slate-400 text-sm mb-4">
              {new Date(currentMatch.date).toLocaleDateString()} · {t('setLabel')} {currentMatch.currentSetIndex + 1}
            </div>
            <div className="flex gap-3 text-3xl font-black text-center mb-4">
              <div className="flex-1 bg-slate-800 rounded-xl py-3">
                <div className="text-xs text-slate-500 mb-1">HOME</div>
                <div className="text-green-400">
                  {currentMatch.sets[currentMatch.currentSetIndex]?.homeScore ?? 0}
                </div>
              </div>
              <div className="flex-1 bg-slate-800 rounded-xl py-3">
                <div className="text-xs text-slate-500 mb-1">OPP</div>
                <div className="text-red-400">
                  {currentMatch.sets[currentMatch.currentSetIndex]?.opponentScore ?? 0}
                </div>
              </div>
            </div>
            <button
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors active:scale-98"
              onClick={() => navigate(VIEWS.LIVE)}
            >
              {t('resumeMatch')} →
            </button>
          </div>
        )}

        {/* New match */}
        <button
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-600 transition-all active:scale-98 text-left"
          onClick={() => dispatch({ type: 'START_NEW_MATCH_SETUP' })}
        >
          <div className="w-12 h-12 rounded-xl bg-green-800 flex items-center justify-center flex-shrink-0">
            <Plus size={24} className="text-green-300" />
          </div>
          <div>
            <div className="text-white font-bold text-lg">{t('newMatch')}</div>
            <div className="text-slate-400 text-sm">{t('newMatchDesc')}</div>
          </div>
        </button>

        {/* History */}
        <button
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-600 transition-all active:scale-98 text-left"
          onClick={() => navigate(VIEWS.HISTORY)}
        >
          <div className="w-12 h-12 rounded-xl bg-purple-900 flex items-center justify-center flex-shrink-0">
            <History size={24} className="text-purple-300" />
          </div>
          <div>
            <div className="text-white font-bold text-lg">{t('matchHistory')}</div>
            <div className="text-slate-400 text-sm">{t('matchHistoryDesc', { count: matches.length })}</div>
          </div>
        </button>

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <div>
            <h2 className="text-slate-400 text-xs uppercase tracking-wider font-semibold px-1 mb-3">
              {t('recentMatches')}
            </h2>
            <div className="space-y-2">
              {recentMatches.map(match => {
                const setsWon = match.sets.filter(s => s.winner === 'home').length;
                const setsLost = match.sets.filter(s => s.winner === 'opponent').length;
                return (
                  <button
                    key={match.id}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-all text-left active:scale-98"
                    onClick={() => {
                      dispatch({ type: 'LOAD_MATCH', match });
                      navigate(VIEWS.STATS);
                    }}
                  >
                    <div>
                      <div className="text-white font-medium text-sm">
                        {match.homeTeam.name} {t('vs')} {match.opponentTeam.name}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {new Date(match.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-bold ${setsWon > setsLost ? 'text-green-400' : 'text-red-400'}`}>
                        {setsWon}–{setsLost}
                      </div>
                      <BarChart2 size={16} className="text-slate-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {matches.length === 0 && !currentMatch && (
          <div className="text-center text-slate-600 py-8">
            <Trophy size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-slate-500">{t('noMatchesYet')}</p>
            <p className="text-slate-600 text-sm">{t('startNewMatchHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
