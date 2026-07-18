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
  const [showChangeServe, setShowChangeServe] = useState(false);
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
  const servingTeam = currentMatch.servingTeam;
  const isHomeServing = servingTeam === 'home';
  const servingTeamName  = isHomeServing ? currentMatch.homeTeam.name  : currentMatch.opponentTeam.name;
  const otherTeamName    = isHomeServing ? currentMatch.opponentTeam.name : currentMatch.homeTeam.name;
  const otherServingTeam = isHomeServing ? 'opponent' : 'home';

  function handleUndo() { dispatch({ type: 'UNDO_LAST_EVENT' }); }

  function confirmChangeServe() {
    dispatch({ type: 'SET_SERVE_TEAM', servingTeam: otherServingTeam });
    setShowChangeServe(false);
  }

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

      {/* ── Scoreboard panel ──────────────────────────────────────────────── */}
      <div
        className="mx-3 mb-2 rounded-2xl border border-slate-700/60 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #080d18 100%)' }}
      >
        {/* Team names row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex-1 min-w-0">
            <div className={`font-black text-sm uppercase tracking-wide truncate transition-colors ${
              isHomeServing ? 'text-green-200' : 'text-slate-400'
            }`}>
              {currentMatch.homeTeam.name}
            </div>
            <div className="text-green-600 text-[11px] font-bold mt-0.5">{setsWon} {t('setsLabel')}</div>
          </div>
          <div className="px-3 flex-shrink-0 text-center">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              {t('setLabel')} {currentMatch.currentSetIndex + 1}
            </div>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className={`font-black text-sm uppercase tracking-wide truncate transition-colors ${
              !isHomeServing ? 'text-red-200' : 'text-slate-400'
            }`}>
              {currentMatch.opponentTeam.name}
            </div>
            <div className="text-red-600 text-[11px] font-bold mt-0.5">{setsLost} {t('setsLabel')}</div>
          </div>
        </div>

        {/* ── Prominent serving indicator ──────────────────────────────── */}
        <div className={`mx-3 mb-3 rounded-xl flex items-center justify-between px-3 py-2.5 ${
          isHomeServing
            ? 'bg-green-900/70 border border-green-700/60'
            : 'bg-red-900/60 border border-red-700/60'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none flex-shrink-0 animate-pulse">🏐</span>
            <div className="min-w-0">
              <div className={`font-black text-base leading-tight truncate ${
                isHomeServing ? 'text-green-100' : 'text-red-100'
              }`}>
                {servingTeamName}
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-widest ${
                isHomeServing ? 'text-green-400' : 'text-red-400'
              }`}>
                {t('serving')}
              </div>
            </div>
          </div>
          <button
            className="flex-shrink-0 ml-2 border border-slate-500/60 rounded-lg px-2.5 py-1.5 text-slate-400 text-[10px] font-semibold uppercase tracking-wide hover:border-slate-300 hover:text-slate-200 active:bg-slate-700/50 transition-all"
            onClick={() => setShowChangeServe(true)}
          >
            {t('changeServe')}
          </button>
        </div>

        {/* Score digits + +/- buttons */}
        <div className="flex items-center px-3 pb-4 pt-0">

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

      {/* ── Change serve confirmation modal ───────────────────────────────── */}
      {showChangeServe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowChangeServe(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-xs mx-4 p-5 border border-slate-600 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl text-center mb-3">🔄</div>
            <p className="text-white font-bold text-base text-center mb-5 leading-snug">
              {t('changeServeTo', { team: otherTeamName })}
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 active:scale-95 text-white font-black text-base transition-all"
                onClick={confirmChangeServe}
              >
                {t('yes')}
              </button>
              <button
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-base transition-all"
                onClick={() => setShowChangeServe(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
