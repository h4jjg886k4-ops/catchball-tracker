import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, RotateCcw, ArrowLeft } from 'lucide-react';
import { EVENT_TYPES as T, EVENT_CONFIG } from '../../utils/constants';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { EVENT_TYPE_I18N_KEY } from '../../i18n/translations';

// ── large 3D tap button ──────────────────────────────────────────────────────
function BigBtn({ emoji, label, score, btnClass, onClick }) {
  return (
    <button
      className={`btn-3d ${btnClass} relative flex flex-col items-center justify-center gap-3 font-bold touch-none select-none`}
      onClick={onClick}
    >
      {score && (
        <span className={`absolute top-3 right-3 text-sm font-black px-2 py-0.5 rounded-full ${
          score === '+1' ? 'bg-green-400 text-green-950' : 'bg-red-400 text-red-950'
        }`}>
          {score}
        </span>
      )}
      <span className="text-5xl leading-none">{emoji}</span>
      <span className="text-lg font-black text-center px-3 leading-tight">{label}</span>
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function GameModeButtons() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { selectedPlayerId, currentMatch } = state;
  const [showMistakeMenu, setShowMistakeMenu] = useState(false);

  if (!selectedPlayerId || !currentMatch) return null;
  const player = currentMatch.homeTeam.players.find(p => p.id === selectedPlayerId);
  if (!player) return null;

  const currentSet = currentMatch.sets[currentMatch.currentSetIndex];
  const lastEvent  = currentSet.events[currentSet.events.length - 1];
  const lastEvtCfg = lastEvent ? EVENT_CONFIG.find(c => c.type === lastEvent.type) : null;
  const lastEvtLabel = lastEvtCfg && EVENT_TYPE_I18N_KEY[lastEvtCfg.type]
    ? t(EVENT_TYPE_I18N_KEY[lastEvtCfg.type])
    : lastEvtCfg?.label;

  function record(type) {
    dispatch({
      type: 'RECORD_EVENT',
      event: { id: uuidv4(), type, playerId: selectedPlayerId, timestamp: Date.now() },
    });
    setShowMistakeMenu(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-900">

      {/* ── sticky top bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full bg-blue-800 border-2 border-blue-500 flex items-center justify-center text-xl font-black text-white flex-shrink-0">
            {player.number}
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-base leading-tight truncate">{player.name}</div>
            <div className="text-slate-400 text-xs">{player.position || t('player')}</div>
          </div>
        </div>

        <button
          className={`btn-3d flex items-center gap-1.5 px-3 py-2 text-sm font-semibold flex-shrink-0 ${
            lastEvent ? 'btn-3d-amber' : 'btn-3d-dark cursor-not-allowed'
          }`}
          onClick={() => lastEvent && dispatch({ type: 'UNDO_LAST_EVENT' })}
          disabled={!lastEvent}
        >
          <RotateCcw size={15} />
          {lastEvtCfg
            ? <span className="max-w-[80px] truncate">{lastEvtCfg.emoji} {lastEvtLabel}</span>
            : <span>{t('undoAction')}</span>}
        </button>

        <button
          className="btn-3d btn-3d-dark w-10 h-10 flex-shrink-0"
          onClick={() => dispatch({ type: 'DESELECT_PLAYER' })}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── live score strip ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-center gap-6 py-1.5">
        <span className="text-slate-400 text-xs">{currentMatch.homeTeam.name}</span>
        <span className="text-white font-black text-2xl tabular-nums font-mono">
          {String(currentSet.homeScore).padStart(2, '0')}
          <span className="text-slate-600 mx-2 font-light">–</span>
          {String(currentSet.opponentScore).padStart(2, '0')}
        </span>
        <span className="text-slate-400 text-xs">{currentMatch.opponentTeam.name}</span>
      </div>

      {/* ── action area ───────────────────────────────────────────────── */}
      {showMistakeMenu ? (

        /* Mistake sub-menu */
        <div className="flex-1 flex flex-col p-4 gap-3">
          <button
            className="btn-3d btn-3d-slate flex items-center gap-2 px-4 py-2 text-sm font-semibold self-start"
            onClick={() => setShowMistakeMenu(false)}
          >
            <ArrowLeft size={16} /> {t('back')}
          </button>
          <div className="text-slate-500 text-xs uppercase tracking-wider text-center pb-1">
            {t('gmMistakeHint')}
          </div>
          <div className="flex-1 grid gap-4" style={{ gridTemplateRows: '1fr 1fr 1fr' }}>
            <BigBtn
              emoji="❌"
              label={t('gmBadServe')}
              score="-1"
              btnClass="btn-3d-red"
              onClick={() => record(T.SERVE_ERROR)}
            />
            <BigBtn
              emoji="💥"
              label={t('gmAttackOut')}
              score="-1"
              btnClass="btn-3d-red"
              onClick={() => record(T.ATTACK_OUT)}
            />
            <BigBtn
              emoji="🤚"
              label={t('gmBadPass')}
              btnClass="btn-3d-slate"
              onClick={() => record(T.FREE_BALL)}
            />
          </div>
        </div>

      ) : (

        /* Main 2×2 grid */
        <div className="flex-1 p-4 grid grid-cols-2 gap-4" style={{ gridTemplateRows: '1fr 1fr' }}>
          <BigBtn
            emoji="⚡"
            label={t('gmSuccessAttack')}
            score="+1"
            btnClass="btn-3d-green"
            onClick={() => record(T.ATTACK_WIN_3RD)}
          />
          <BigBtn
            emoji="↩️"
            label={t('gmFailedAttempt')}
            btnClass="btn-3d-blue"
            onClick={() => record(T.ATTACK_CONT_3RD)}
          />
          <BigBtn
            emoji="🎯"
            label={t('ace')}
            score="+1"
            btnClass="btn-3d-green"
            onClick={() => record(T.ACE)}
          />
          <BigBtn
            emoji="⚠️"
            label={t('gmMistake')}
            btnClass="btn-3d-orange"
            onClick={() => setShowMistakeMenu(true)}
          />
        </div>

      )}
    </div>
  );
}
