import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Shuffle, ChevronUp, ChevronDown } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { EVENT_TYPE_I18N_KEY } from '../../i18n/translations';
import { EVENT_CONFIG } from '../../utils/constants';

export default function ScoreHeader({ onShowSubstitution }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch, lastUndoneEvent } = state;
  const [flashHome, setFlashHome] = useState(false);
  const [flashOpp,  setFlashOpp]  = useState(false);
  const [undoFlash, setUndoFlash] = useState(false);
  const prevHomeRef = useRef(0);
  const prevOppRef  = useRef(0);

  if (!currentMatch) return null;
  const currentSet     = currentMatch.sets[currentMatch.currentSetIndex];
  const lastEvent      = currentSet.events[currentSet.events.length - 1];
  const lastEventConf  = lastEvent ? EVENT_CONFIG.find(e => e.type === lastEvent.type) : null;
  const lastEventLabel = lastEventConf && EVENT_TYPE_I18N_KEY[lastEventConf.type]
    ? t(EVENT_TYPE_I18N_KEY[lastEventConf.type])
    : lastEventConf?.label;

  useEffect(() => {
    if (currentSet.homeScore !== prevHomeRef.current) {
      setFlashHome(true);
      setTimeout(() => setFlashHome(false), 400);
      prevHomeRef.current = currentSet.homeScore;
    }
  }, [currentSet.homeScore]);

  useEffect(() => {
    if (currentSet.opponentScore !== prevOppRef.current) {
      setFlashOpp(true);
      setTimeout(() => setFlashOpp(false), 400);
      prevOppRef.current = currentSet.opponentScore;
    }
  }, [currentSet.opponentScore]);

  useEffect(() => {
    if (lastUndoneEvent) {
      setUndoFlash(true);
      setTimeout(() => setUndoFlash(false), 600);
    }
  }, [lastUndoneEvent]);

  const setsWon  = currentMatch.sets.filter(s => s.winner === 'home').length;
  const setsLost = currentMatch.sets.filter(s => s.winner === 'opponent').length;

  function handleUndo() { dispatch({ type: 'UNDO_LAST_EVENT' }); }

  return (
    <div className="bg-slate-900 border-b border-slate-700 select-none flex-shrink-0">

      {/* Set indicator dots */}
      <div className="flex justify-center gap-2 pt-2 pb-1">
        {currentMatch.sets.map((s, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${
            s.winner === 'home'     ? 'bg-green-400' :
            s.winner === 'opponent' ? 'bg-red-400'   :
            i === currentMatch.currentSetIndex ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'
          }`} />
        ))}
      </div>

      {/* ── Electronic scoreboard panel ────────────────────────────────── */}
      <div
        className="mx-3 mb-2 rounded-2xl border border-slate-700/60 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #080d18 100%)' }}
      >
        {/* Team names + sets won */}
        <div className="flex items-start justify-between px-4 pt-3 pb-1">
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-sm uppercase tracking-wide truncate">
              {currentMatch.homeTeam.name}
            </div>
            <div className="text-green-500 text-[11px] font-bold">
              {setsWon} {t('setsLabel')}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 px-3 flex-shrink-0">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              {t('setLabel')} {currentMatch.currentSetIndex + 1}
            </div>
            <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              currentMatch.servingTeam === 'home'
                ? 'bg-green-900/80 text-green-300'
                : 'bg-red-900/80 text-red-300'
            }`}>
              {currentMatch.servingTeam === 'home' ? t('serving') : t('receiving')}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-right">
            <div className="text-white font-black text-sm uppercase tracking-wide truncate">
              {currentMatch.opponentTeam.name}
            </div>
            <div className="text-red-500 text-[11px] font-bold">
              {setsLost} {t('setsLabel')}
            </div>
          </div>
        </div>

        {/* Score digits + +/- buttons */}
        <div className="flex items-center px-3 pb-4 pt-1">

          {/* Home score */}
          <div className="flex-1 flex flex-col items-center">
            <div
              className={`font-mono font-black leading-none tabular-nums transition-all duration-200 ${flashHome ? 'scale-110' : ''}`}
              style={{
                fontSize: 'clamp(4rem, 12vw, 6.5rem)',
                color: flashHome ? '#4ade80' : '#22c55e',
                textShadow: '0 0 40px rgba(34,197,94,0.55), 0 0 8px rgba(34,197,94,0.3)',
              }}
            >
              {String(currentSet.homeScore).padStart(2, '0')}
            </div>
            <div className="flex gap-3 mt-3">
              <button
                className="btn-3d btn-3d-green w-14 h-14"
                onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'home', delta: 1 })}
              >
                <ChevronUp size={28} />
              </button>
              <button
                className="btn-3d btn-3d-slate w-14 h-14"
                onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'home', delta: -1 })}
              >
                <ChevronDown size={28} />
              </button>
            </div>
          </div>

          {/* Sub button — center */}
          <div className="flex items-center justify-center px-2">
            <button
              className="btn-3d btn-3d-blue text-xs px-3 py-2.5 gap-1 font-semibold"
              onClick={onShowSubstitution}
            >
              <Shuffle size={14} /> {t('sub')}
            </button>
          </div>

          {/* Opponent score */}
          <div className="flex-1 flex flex-col items-center">
            <div
              className={`font-mono font-black leading-none tabular-nums transition-all duration-200 ${flashOpp ? 'scale-110' : ''}`}
              style={{
                fontSize: 'clamp(4rem, 12vw, 6.5rem)',
                color: flashOpp ? '#f87171' : '#ef4444',
                textShadow: '0 0 40px rgba(239,68,68,0.55), 0 0 8px rgba(239,68,68,0.3)',
              }}
            >
              {String(currentSet.opponentScore).padStart(2, '0')}
            </div>
            <div className="flex gap-3 mt-3">
              <button
                className="btn-3d btn-3d-red w-14 h-14"
                onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'opponent', delta: 1 })}
              >
                <ChevronUp size={28} />
              </button>
              <button
                className="btn-3d btn-3d-slate w-14 h-14"
                onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'opponent', delta: -1 })}
              >
                <ChevronDown size={28} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Undo bar */}
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 border-t transition-all ${
          lastEvent
            ? undoFlash
              ? 'bg-amber-900/60 border-amber-700'
              : 'bg-slate-700/60 border-slate-600 hover:bg-amber-900/30 hover:border-amber-800 active:bg-amber-900/50'
            : 'bg-slate-800/40 border-slate-700/50 opacity-40 cursor-not-allowed'
        }`}
        onClick={lastEvent ? handleUndo : undefined}
        disabled={!lastEvent}
      >
        <div className="flex items-center gap-2 min-w-0">
          <RotateCcw size={15} className={undoFlash ? 'text-amber-300' : 'text-slate-400'} />
          <span className={`text-xs font-semibold ${undoFlash ? 'text-amber-300' : 'text-slate-400'}`}>
            {t('undoAction')}
          </span>
          {lastEvent && lastEventConf ? (
            <span className={`text-xs truncate ${undoFlash ? 'text-amber-200' : 'text-slate-500'}`}>
              {lastEventConf.emoji} {lastEventLabel}
              {' '}({currentSet.homeScore}–{currentSet.opponentScore})
            </span>
          ) : (
            <span className="text-xs text-slate-600">{t('noEventsYet')}</span>
          )}
        </div>
        {lastEvent && (
          <span className={`text-xs flex-shrink-0 ml-2 ${undoFlash ? 'text-amber-300' : 'text-slate-500'}`}>
            {t('tapToUndo')} →
          </span>
        )}
      </button>
    </div>
  );
}
