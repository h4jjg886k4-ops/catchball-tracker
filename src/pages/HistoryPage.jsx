import React, { useState } from 'react';
import { ArrowLeft, Trash2, BarChart2, Play, Search } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { VIEWS } from '../utils/constants';

export default function HistoryPage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const { matches } = state;
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = matches.filter(m => {
    const q = search.toLowerCase();
    return (
      m.homeTeam?.name?.toLowerCase().includes(q) ||
      m.opponentTeam?.name?.toLowerCase().includes(q)
    );
  });

  function handleOpen(match) {
    dispatch({ type: 'LOAD_MATCH', match });
    navigate(VIEWS.STATS);
  }

  function handleDelete(matchId) {
    dispatch({ type: 'DELETE_MATCH', matchId });
    setConfirmDelete(null);
  }

  function handleResume(match) {
    dispatch({ type: 'LOAD_MATCH', match });
    navigate(VIEWS.LIVE);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <button
          className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          onClick={() => navigate(VIEWS.HOME)}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-white font-bold text-xl flex-1">{t('matchHistory')}</h1>
        <span className="text-slate-400 text-sm">{matches.length} {t('matches')}</span>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={t('searchMatches')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-slate-600 py-12">
            {search ? t('noMatchesFound') : t('noSavedMatches')}
          </div>
        )}

        {filtered.map(match => {
          const setsWon = match.sets?.filter(s => s.winner === 'home').length || 0;
          const setsLost = match.sets?.filter(s => s.winner === 'opponent').length || 0;
          const isWin = setsWon > setsLost;
          const isActive = match.status !== 'completed';

          return (
            <div
              key={match.id}
              className={`bg-slate-800 rounded-2xl border overflow-hidden transition-all ${
                isActive ? 'border-blue-700' : 'border-slate-700'
              }`}
            >
              {isActive && (
                <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-1.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">{t('liveInProgress')}</span>
                </div>
              )}

              <div className="px-4 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white font-bold">
                      {match.homeTeam?.name} {t('vs')} {match.opponentTeam?.name}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {new Date(match.date).toLocaleDateString(undefined, {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </div>
                  </div>
                  {!isActive && (
                    <div className={`text-right ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                      <div className="text-2xl font-black tabular-nums">{setsWon}–{setsLost}</div>
                      <div className="text-xs font-semibold uppercase">{isWin ? t('win') : t('loss')}</div>
                    </div>
                  )}
                </div>

                {/* Set scores */}
                {match.sets?.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {match.sets.map((s, i) => (
                      <div
                        key={i}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          s.winner === 'home'
                            ? 'bg-green-900/50 text-green-300 border border-green-800'
                            : s.winner === 'opponent'
                            ? 'bg-red-900/50 text-red-300 border border-red-900'
                            : 'bg-slate-700 text-slate-300 border border-slate-600'
                        }`}
                      >
                        {s.homeScore}–{s.opponentScore}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {isActive ? (
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
                      onClick={() => handleResume(match)}
                    >
                      <Play size={15} /> {t('resume')}
                    </button>
                  ) : (
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                      onClick={() => handleOpen(match)}
                    >
                      <BarChart2 size={15} /> {t('viewStats')}
                    </button>
                  )}

                  {confirmDelete === match.id ? (
                    <div className="flex gap-1">
                      <button
                        className="px-3 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                        onClick={() => handleDelete(match.id)}
                      >
                        {t('delete')}
                      </button>
                      <button
                        className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                        onClick={() => setConfirmDelete(null)}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-red-900 flex items-center justify-center transition-colors flex-shrink-0"
                      onClick={() => setConfirmDelete(match.id)}
                    >
                      <Trash2 size={15} className="text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
