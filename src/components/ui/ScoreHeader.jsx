import React, { useState, useEffect, useRef } from 'react';
import { Shuffle, ChevronUp, ChevronDown } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ScoreHeader({ onShowSubstitution }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  const [flashHome, setFlashHome] = useState(false);
  const [flashOpp,  setFlashOpp]  = useState(false);
  const [showChangeServe, setShowChangeServe] = useState(false);
  const prevHomeRef = useRef(0);
  const prevOppRef  = useRef(0);

  if (!currentMatch) return null;
  const currentSet    = currentMatch.sets[currentMatch.currentSetIndex];
  const setsWon       = currentMatch.sets.filter(s => s.winner === 'home').length;
  const setsLost      = currentMatch.sets.filter(s => s.winner === 'opponent').length;
  const servingTeam   = currentMatch.servingTeam;
  const isHomeServing = servingTeam === 'home';
  const servingTeamName  = isHomeServing ? currentMatch.homeTeam.name  : currentMatch.opponentTeam.name;
  const otherTeamName    = isHomeServing ? currentMatch.opponentTeam.name : currentMatch.homeTeam.name;
  const otherServingTeam = isHomeServing ? 'opponent' : 'home';

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

  function confirmChangeServe() {
    dispatch({ type: 'SET_SERVE_TEAM', servingTeam: otherServingTeam });
    setShowChangeServe(false);
  }

  return (
    <div className="bg-slate-900 border-b border-slate-700 select-none flex-shrink-0">

      {/* Set indicator dots */}
      <div className="flex justify-center gap-2 pt-1.5 pb-0.5">
        {currentMatch.sets.map((s, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${
            s.winner === 'home'     ? 'bg-green-400' :
            s.winner === 'opponent' ? 'bg-red-400'   :
            i === currentMatch.currentSetIndex ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'
          }`} />
        ))}
      </div>

      {/* ── Scoreboard panel ──────────────────────────────────────────────── */}
      <div
        className="mx-3 mb-1.5 rounded-2xl border border-slate-700/60 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #080d18 100%)' }}
      >
        {/* Team names */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <div className="flex-1 min-w-0">
            <div className={`font-black text-sm uppercase tracking-wide truncate transition-colors ${
              isHomeServing ? 'text-green-200' : 'text-slate-400'
            }`}>
              {currentMatch.homeTeam.name}
            </div>
            <div className="text-green-700 text-[10px] font-bold">{setsWon} {t('setsLabel')}</div>
          </div>
          <div className="px-3 flex-shrink-0">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center">
              {t('setLabel')} {currentMatch.currentSetIndex + 1}
            </div>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className={`font-black text-sm uppercase tracking-wide truncate transition-colors ${
              !isHomeServing ? 'text-red-200' : 'text-slate-400'
            }`}>
              {currentMatch.opponentTeam.name}
            </div>
            <div className="text-red-700 text-[10px] font-bold">{setsLost} {t('setsLabel')}</div>
          </div>
        </div>

        {/* ── Serving indicator + Sub button ────────────────────────────── */}
        <div className={`mx-3 mb-2 rounded-xl flex items-center gap-2 px-2.5 py-1.5 ${
          isHomeServing
            ? 'bg-green-900/70 border border-green-700/60'
            : 'bg-red-900/60 border border-red-700/60'
        }`}>
          <span className="text-xl leading-none flex-shrink-0 animate-pulse">🏐</span>
          <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
            <span className={`font-black text-sm truncate leading-tight ${
              isHomeServing ? 'text-green-100' : 'text-red-100'
            }`}>
              {servingTeamName}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
              isHomeServing ? 'text-green-400' : 'text-red-400'
            }`}>
              {t('serving')}
            </span>
          </div>
          <button
            className="flex-shrink-0 border border-slate-500/50 rounded-lg px-2 py-1 text-slate-400 text-[9px] font-semibold uppercase tracking-wide hover:border-slate-300 hover:text-slate-200 active:bg-slate-700/50 transition-all"
            onClick={() => setShowChangeServe(true)}
          >
            {t('changeServe')}
          </button>
          <button
            className="flex-shrink-0 btn-3d btn-3d-blue text-[11px] px-3 py-1.5 gap-1 font-semibold"
            onClick={onShowSubstitution}
          >
            <Shuffle size={12} /> {t('sub')}
          </button>
        </div>

        {/* ── Score digits + buttons ─────────────────────────────────────── */}
        <div className="flex items-center px-3 pb-3 pt-0 gap-3">

          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              className="btn-3d btn-3d-green w-10 h-10"
              onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'home', delta: 1 })}
            >
              <ChevronUp size={20} />
            </button>
            <div
              className={`font-mono font-black leading-none tabular-nums transition-all duration-200 ${flashHome ? 'scale-110' : ''}`}
              style={{
                fontSize: 'clamp(2rem, 7vw, 2.75rem)',
                color: flashHome ? '#4ade80' : '#22c55e',
                textShadow: '0 0 24px rgba(34,197,94,0.5)',
              }}
            >
              {String(currentSet.homeScore).padStart(2, '0')}
            </div>
            <button
              className="btn-3d btn-3d-slate w-10 h-10"
              onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'home', delta: -1 })}
            >
              <ChevronDown size={20} />
            </button>
          </div>

          <div className="text-slate-600 font-black text-2xl flex-shrink-0 pb-1">:</div>

          {/* Opponent */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              className="btn-3d btn-3d-red w-10 h-10"
              onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'opponent', delta: 1 })}
            >
              <ChevronUp size={20} />
            </button>
            <div
              className={`font-mono font-black leading-none tabular-nums transition-all duration-200 ${flashOpp ? 'scale-110' : ''}`}
              style={{
                fontSize: 'clamp(2rem, 7vw, 2.75rem)',
                color: flashOpp ? '#f87171' : '#ef4444',
                textShadow: '0 0 24px rgba(239,68,68,0.5)',
              }}
            >
              {String(currentSet.opponentScore).padStart(2, '0')}
            </div>
            <button
              className="btn-3d btn-3d-slate w-10 h-10"
              onClick={() => dispatch({ type: 'ADJUST_SCORE', team: 'opponent', delta: -1 })}
            >
              <ChevronDown size={20} />
            </button>
          </div>

        </div>
      </div>

      {/* ── Change serve modal ─────────────────────────────────────────────── */}
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
