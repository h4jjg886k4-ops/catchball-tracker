import React, { useState } from 'react';
import { ArrowLeft, BarChart2, Layers, StopCircle, RotateCw, RotateCcw } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { VIEWS, POSITION_ABBR, EVENT_CONFIG } from '../utils/constants';
import { EVENT_TYPE_I18N_KEY } from '../i18n/translations';
import { calcPlayerStats } from '../utils/stats';
import ScoreHeader from '../components/ui/ScoreHeader';
import EventButtons from '../components/ui/EventButtons';
import GameModeButtons from '../components/ui/GameModeButtons';
import SubstitutionModal from '../components/modals/SubstitutionModal';
import CourtDrawModal from '../components/modals/CourtDrawModal';
import HeatmapModal from '../components/modals/HeatmapModal';
import RotationSetupModal from '../components/modals/RotationSetupModal';
import ServeSetupModal from '../components/modals/ServeSetupModal';

// Court layout: [position, row, col] — always LTR, positions are physical
const COURT_LAYOUT = [
  [4, 0, 0], [3, 0, 1], [2, 0, 2],
  [5, 1, 0], [6, 1, 1], [1, 1, 2],
];

export default function LiveMatchPage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const {
    currentMatch, selectedPlayerId,
    showSubstitution, showCourtDraw, showHeatmap, needsRotationSetup, needsServeSetup,
  } = state;
  const [showRotationSetup, setShowRotationSetup] = useState(false);
  const [showEndSetConfirm, setShowEndSetConfirm] = useState(false);
  const appMode = state.appMode;

  function switchMode(mode) { dispatch({ type: 'SET_APP_MODE', mode }); }

  if (!currentMatch) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-4">{t('noMatchActive')}</div>
          <button className="px-6 py-3 bg-blue-700 rounded-xl text-white" onClick={() => navigate(VIEWS.HOME)}>
            {t('goHome')}
          </button>
        </div>
      </div>
    );
  }

  const currentSet = currentMatch.sets[currentMatch.currentSetIndex];
  const players    = currentMatch.homeTeam.players;
  const allEvents  = currentSet.events || [];

  // Derive the 6 players currently on court (accounts for substitutions)
  const currentOnCourt = new Set(currentSet.rotation.filter(id => id !== ''));
  for (const sub of currentSet.substitutions) {
    currentOnCourt.delete(sub.outPlayerId);
    currentOnCourt.add(sub.inPlayerId);
  }
  const courtPlayers = players.filter(p => currentOnCourt.has(p.id));

  function handlePlayerSelect(playerId) { dispatch({ type: 'SELECT_PLAYER', playerId }); }
  function handleEndSet() { dispatch({ type: 'END_SET' }); setShowEndSetConfirm(false); }
  function handleRotationSetupClose() {
    setShowRotationSetup(false);
    if (needsRotationSetup) dispatch({ type: 'DISMISS_ROTATION_SETUP' });
  }

  // ── Player button (Zone 2) ─────────────────────────────────────────────────
  function PlayerCell({ player }) {
    const stats = calcPlayerStats(player.id, allEvents);
    const isSelected = selectedPlayerId === player.id;
    return (
      <button
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-[0.97] text-left w-full h-full ${
          isSelected
            ? 'bg-blue-900 border-blue-500 shadow-md shadow-blue-900/40'
            : 'bg-slate-800 border-slate-700 hover:border-blue-700'
        }`}
        onClick={() => handlePlayerSelect(player.id)}
      >
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-base font-black flex-shrink-0 leading-none ${
          isSelected ? 'bg-blue-700 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-white'
        }`}>
          {player.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-white font-black text-base leading-none truncate">{player.name}</span>
            <span className="flex items-baseline gap-0.5 flex-shrink-0 text-[10px] leading-none">
              <span className="text-green-400 font-bold tabular-nums">{stats.cardPoints}</span>
              <span className="text-slate-600">·</span>
              <span className="text-blue-400 font-bold tabular-nums">{stats.cardAttacks}</span>
              <span className="text-slate-600">·</span>
              <span className="text-red-400 font-bold tabular-nums">{stats.cardMistakes}</span>
            </span>
          </div>
          {player.position && (
            <div className="text-slate-500 text-[10px] leading-tight mt-0.5">
              {POSITION_ABBR[player.position] || player.position}
            </div>
          )}
        </div>
      </button>
    );
  }

  // ── Mini court panel (Zone 3) ──────────────────────────────────────────────
  function MiniCourtPanel() {
    const rotation = currentSet.rotation;
    const rotIdx   = currentMatch.currentRotationIndex;
    const canUndoRotation = (currentMatch.rotationHistory || []).length > 0;

    function getPlayerAtPos(pos) {
      const id = rotation[pos - 1];
      return players.find(p => p.id === id) ?? null;
    }

    return (
      <div className="bg-slate-800/80 border-t border-slate-700 flex-shrink-0" dir="ltr">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            {t('rotationLabel')} {rotIdx + 1}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded-lg transition-colors font-medium ${
                canUndoRotation
                  ? 'bg-amber-900/70 border border-amber-700 text-amber-300 active:scale-95'
                  : 'bg-slate-700/40 border border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
              onClick={() => canUndoRotation && dispatch({ type: 'UNDO_ROTATION' })}
              disabled={!canUndoRotation}
            >
              <RotateCcw size={10} /> {t('undoRotation')}
            </button>
            <button
              className="flex items-center gap-0.5 text-[10px] bg-slate-700 hover:bg-blue-800 active:scale-95 px-2 py-1 rounded-lg transition-colors font-medium border border-slate-600 text-slate-200"
              onClick={() => dispatch({ type: 'MANUAL_ROTATE' })}
            >
              <RotateCw size={10} /> {t('rotateBtn')}
            </button>
            <button
              className="flex items-center gap-0.5 text-[10px] bg-slate-700/50 hover:bg-slate-600 px-2 py-1 rounded-lg transition-colors font-medium border border-slate-600/50 text-slate-400"
              onClick={() => setShowRotationSetup(true)}
            >
              {t('setStartingRotation')}
            </button>
          </div>
        </div>

        {/* Court grid */}
        <div className="px-2 pb-2">
          {/* Net */}
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex-1 h-px bg-yellow-500/40" />
            <span className="text-[8px] font-bold text-yellow-500/60 uppercase tracking-widest">{t('netLabel')}</span>
            <div className="flex-1 h-px bg-yellow-500/40" />
          </div>

          {/* 2×3 position grid */}
          <div className="grid grid-rows-2 grid-cols-3 gap-1">
            {COURT_LAYOUT.map(([pos]) => {
              const player   = getPlayerAtPos(pos);
              const isServer = pos === 1;
              return (
                <div
                  key={pos}
                  className={`rounded-lg text-center py-1.5 px-1 border ${
                    isServer
                      ? 'bg-green-900/50 border-green-600/60'
                      : 'bg-slate-700/40 border-slate-600/50'
                  }`}
                >
                  <div className={`text-[8px] font-bold leading-none ${isServer ? 'text-green-400' : 'text-slate-500'}`}>
                    P{pos}{isServer ? ' 🏐' : ''}
                  </div>
                  {player ? (
                    <>
                      <div className={`font-black text-sm leading-none mt-0.5 tabular-nums ${isServer ? 'text-green-300' : 'text-white'}`}>
                        {player.number}
                      </div>
                      <div className={`text-[9px] truncate leading-tight mt-0.5 ${isServer ? 'text-green-400/80' : 'text-slate-400'}`}>
                        {player.name.split(' ')[0]}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-600 text-xs mt-0.5">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">

      {/* ── Zone 1: Compact score header ──────────────────────────────────── */}
      <ScoreHeader onShowSubstitution={() => dispatch({ type: 'SHOW_SUBSTITUTION' })} />

      {/* ── Control bar: mode toggle + set management ──────────────────────── */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-700/50 flex items-center px-3 py-1.5 gap-1.5">
        <button
          className={`btn-3d text-[11px] font-semibold px-3 py-1.5 ${appMode === 'game' ? 'btn-3d-blue' : 'btn-3d-dark'}`}
          onClick={() => switchMode('game')}
        >
          {t('gameMode')}
        </button>
        <button
          className={`btn-3d text-[11px] font-semibold px-3 py-1.5 ${appMode === 'coach' ? 'btn-3d-purple' : 'btn-3d-dark'}`}
          onClick={() => switchMode('coach')}
        >
          {t('coachMode')}
        </button>

        <div className="flex-1" />

        {!showEndSetConfirm ? (
          <>
            <button
              className="py-1.5 px-3 rounded-lg border border-orange-800/70 text-orange-500 hover:bg-orange-900/20 font-semibold text-xs transition-colors"
              onClick={() => setShowEndSetConfirm(true)}
            >
              {t('endSet')} {currentMatch.currentSetIndex + 1}
            </button>
            <button
              className="py-1.5 px-2.5 rounded-lg border border-red-900/60 text-red-600 hover:bg-red-900/20 font-semibold text-xs transition-colors flex items-center gap-1"
              onClick={() => { if (confirm(t('endMatchConfirm'))) dispatch({ type: 'END_MATCH' }); }}
            >
              <StopCircle size={11} /> {t('endMatch')}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-orange-400 text-xs font-semibold">
              {t('endSet')} {currentMatch.currentSetIndex + 1}? ({currentSet.homeScore}–{currentSet.opponentScore})
            </span>
            <button
              className="py-1 px-2.5 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
              onClick={handleEndSet}
            >
              {t('confirm')}
            </button>
            <button
              className="py-1 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
              onClick={() => setShowEndSetConfirm(false)}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {/* ── Zone 2: Court players — 2×3 grid fills available space ─────────── */}
      <div className="flex-1 min-h-0 p-2 grid grid-cols-2 grid-rows-3 gap-1.5">
        {courtPlayers.map(p => <PlayerCell key={p.id} player={p} />)}
        {/* Empty slots if fewer than 6 players on court */}
        {Array.from({ length: Math.max(0, 6 - courtPlayers.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="rounded-xl border border-slate-700/30 border-dashed bg-slate-800/20" />
        ))}
      </div>

      {/* ── Zone 3: Mini court rotation — always visible ────────────────────── */}
      <MiniCourtPanel />

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <div className="flex border-t border-slate-700 bg-slate-900 flex-shrink-0 gap-2 p-2">
        <button
          className="btn-3d btn-3d-nav flex-1 py-4 gap-1.5 text-base font-semibold"
          onClick={() => navigate(VIEWS.HOME)}
        >
          <ArrowLeft size={22} /> {t('home')}
        </button>
        <button
          className="btn-3d btn-3d-blue flex-1 py-4 gap-1.5 text-base font-semibold"
          onClick={() => navigate(VIEWS.STATS)}
        >
          <BarChart2 size={22} /> {t('stats')}
        </button>
        <button
          className="btn-3d btn-3d-nav flex-1 py-4 gap-1.5 text-base font-semibold"
          onClick={() => dispatch({ type: 'SHOW_HEATMAP' })}
        >
          <Layers size={22} /> {t('heatmap')}
        </button>
      </div>

      {/* Modals */}
      {selectedPlayerId && (appMode === 'game' ? <GameModeButtons /> : <EventButtons />)}
      {showSubstitution && <SubstitutionModal onClose={() => dispatch({ type: 'HIDE_SUBSTITUTION' })} />}
      {showCourtDraw && <CourtDrawModal />}
      {showHeatmap && <HeatmapModal />}
      {needsServeSetup && <ServeSetupModal />}
      {!needsServeSetup && (showRotationSetup || needsRotationSetup) && (
        <RotationSetupModal onClose={handleRotationSetupClose} />
      )}
    </div>
  );
}
