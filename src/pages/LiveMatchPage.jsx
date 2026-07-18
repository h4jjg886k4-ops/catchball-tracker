import React, { useState, useEffect } from 'react';
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

// Physical court positions — always LTR regardless of language
const COURT_LAYOUT = [
  [4, 0, 0], [3, 0, 1], [2, 0, 2],
  [5, 1, 0], [6, 1, 1], [1, 1, 2],
];

export default function LiveMatchPage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const {
    currentMatch, selectedPlayerId,
    showSubstitution, showCourtDraw, showHeatmap,
    needsRotationSetup, needsServeSetup, lastUndoneEvent,
  } = state;
  const [showRotationSetup, setShowRotationSetup] = useState(false);
  const [showEndSetConfirm, setShowEndSetConfirm] = useState(false);
  const [undoFlash, setUndoFlash] = useState(false);
  const appMode = state.appMode;

  useEffect(() => {
    if (lastUndoneEvent) {
      setUndoFlash(true);
      const t = setTimeout(() => setUndoFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastUndoneEvent]);

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

  // Last event for undo label
  const lastEvent     = allEvents[allEvents.length - 1];
  const lastEventConf = lastEvent ? EVENT_CONFIG.find(e => e.type === lastEvent.type) : null;
  const lastEventLabel = lastEventConf && EVENT_TYPE_I18N_KEY[lastEventConf.type]
    ? t(EVENT_TYPE_I18N_KEY[lastEventConf.type]) : lastEventConf?.label;

  // 6 players currently on court (substitutions applied)
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

  // ── Compact player button ─────────────────────────────────────────────────
  function PlayerCell({ player }) {
    const stats = calcPlayerStats(player.id, allEvents);
    const isSelected = selectedPlayerId === player.id;
    return (
      <button
        className={`flex items-center gap-2 px-2.5 rounded-xl border transition-all active:scale-[0.97] text-left w-full h-full ${
          isSelected
            ? 'bg-blue-900 border-blue-500 shadow-lg shadow-blue-900/40'
            : 'bg-slate-800 border-slate-700 hover:border-blue-700'
        }`}
        onClick={() => handlePlayerSelect(player.id)}
      >
        {/* Jersey number */}
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 leading-none ${
          isSelected ? 'bg-blue-700 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-white'
        }`}>
          {player.number}
        </div>
        {/* Name + live stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-white font-black text-sm leading-tight truncate">{player.name}</span>
            <span className="flex items-baseline gap-0.5 flex-shrink-0 text-[9px] leading-none">
              <span className="text-green-400 font-bold tabular-nums">{stats.cardPoints}</span>
              <span className="text-slate-600">·</span>
              <span className="text-blue-400 font-bold tabular-nums">{stats.cardAttacks}</span>
              <span className="text-slate-600">·</span>
              <span className="text-red-400 font-bold tabular-nums">{stats.cardMistakes}</span>
            </span>
          </div>
          {player.position && (
            <div className="text-slate-500 text-[9px] leading-none mt-0.5 truncate">
              {POSITION_ABBR[player.position] || player.position}
            </div>
          )}
        </div>
      </button>
    );
  }

  // ── Court rotation panel ───────────────────────────────────────────────────
  // Fills all remaining vertical space; uses vmin/vh font clamps so boxes
  // look good at every iPad size and orientation.
  function CourtPanel() {
    const rotation = currentSet.rotation;
    const rotIdx   = currentMatch.currentRotationIndex;
    const canUndo  = (currentMatch.rotationHistory || []).length > 0;

    function playerAt(pos) {
      const id = rotation[pos - 1];
      return players.find(p => p.id === id) ?? null;
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-slate-800/70 border-t border-slate-700 overflow-hidden" dir="ltr">
        {/* Header row */}
        <div className="flex-shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b border-slate-700/60">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            {t('rotationLabel')} {rotIdx + 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={!canUndo}
              onClick={() => canUndo && dispatch({ type: 'UNDO_ROTATION' })}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
                canUndo
                  ? 'bg-amber-900/70 border border-amber-700 text-amber-300 active:scale-95'
                  : 'bg-slate-700/30 border border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
            >
              <RotateCcw size={10} /> {t('undoRotation')}
            </button>
            <button
              onClick={() => dispatch({ type: 'MANUAL_ROTATE' })}
              className="flex items-center gap-0.5 text-[10px] bg-slate-700 hover:bg-blue-800 active:scale-95 px-2 py-1 rounded-lg font-medium border border-slate-600 text-slate-200 transition-colors"
            >
              <RotateCw size={10} /> {t('rotateBtn')}
            </button>
            <button
              onClick={() => setShowRotationSetup(true)}
              className="text-[9px] text-slate-500 hover:text-slate-300 px-1.5 py-1 rounded transition-colors"
            >
              ✎
            </button>
          </div>
        </div>

        {/* Net */}
        <div className="flex-shrink-0 flex items-center gap-2 px-2 pt-1.5 pb-1">
          <div className="flex-1 h-px bg-yellow-500/50 rounded" />
          <span className="text-[9px] font-bold text-yellow-500/70 uppercase tracking-widest">{t('netLabel')}</span>
          <div className="flex-1 h-px bg-yellow-500/50 rounded" />
        </div>

        {/* 2 × 3 court grid — fills remaining space */}
        <div
          className="flex-1 min-h-0 grid grid-cols-3 px-2 pb-2 gap-1.5"
          style={{ gridTemplateRows: 'repeat(2, 1fr)' }}
        >
          {COURT_LAYOUT.map(([pos]) => {
            const player   = playerAt(pos);
            const isServer = pos === 1;
            return (
              <div
                key={pos}
                className={`rounded-xl flex flex-col items-center justify-center overflow-hidden ${
                  isServer
                    ? 'bg-green-900/60 border-2 border-green-600/70 shadow-lg shadow-green-900/30'
                    : 'bg-slate-700/50 border border-slate-600/60'
                }`}
              >
                {/* Position label */}
                <div className={`text-[9px] font-bold leading-none mb-0.5 ${isServer ? 'text-green-400' : 'text-slate-500'}`}>
                  P{pos}{isServer ? ' 🏐' : ''}
                </div>
                {player ? (
                  <>
                    {/* Jersey number — scales with available height */}
                    <div
                      className={`font-black tabular-nums leading-none ${isServer ? 'text-green-200' : 'text-white'}`}
                      style={{ fontSize: 'clamp(1.1rem, 3.5vh, 2.25rem)' }}
                    >
                      {player.number}
                    </div>
                    {/* First name */}
                    <div
                      className={`text-center truncate w-full px-1 mt-0.5 leading-tight font-semibold ${isServer ? 'text-green-300/90' : 'text-slate-300'}`}
                      style={{ fontSize: 'clamp(0.6rem, 1.6vh, 0.875rem)' }}
                    >
                      {player.name.split(' ')[0]}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-600" style={{ fontSize: 'clamp(0.75rem, 2vh, 1rem)' }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">

      {/* ── Zone 1: Score header (with serve indicator) ───────────────────── */}
      <ScoreHeader onShowSubstitution={() => dispatch({ type: 'SHOW_SUBSTITUTION' })} />

      {/* ── Control bar: undo · end-set · end-match · mode toggle ─────────── */}
      <div className="flex-shrink-0 bg-slate-900/95 border-b border-slate-700/60 flex items-center px-2 py-1 gap-1.5">
        {!showEndSetConfirm ? (
          <>
            {/* Undo button */}
            <button
              disabled={!lastEvent}
              onClick={() => lastEvent && dispatch({ type: 'UNDO_LAST_EVENT' })}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold flex-1 min-w-0 transition-all ${
                !lastEvent
                  ? 'bg-slate-800/50 border-slate-700/40 text-slate-600 cursor-not-allowed'
                  : undoFlash
                    ? 'bg-amber-900/60 border-amber-700 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-800 hover:text-amber-400'
              }`}
            >
              <RotateCcw size={12} className="flex-shrink-0" />
              <span className="flex-shrink-0">{t('undoAction')}</span>
              {lastEvent && (
                <span className={`text-[10px] truncate ml-0.5 ${undoFlash ? 'text-amber-200' : 'text-slate-500'}`}>
                  {lastEventConf ? `${lastEventConf.emoji} ${lastEventLabel}` : t('manualScore')}
                </span>
              )}
            </button>

            {/* End Set */}
            <button
              className="flex-shrink-0 py-1.5 px-2.5 rounded-lg border border-orange-800/70 text-orange-500 hover:bg-orange-900/20 font-semibold text-[11px] transition-colors"
              onClick={() => setShowEndSetConfirm(true)}
            >
              {t('endSet')} {currentMatch.currentSetIndex + 1}
            </button>

            {/* End Match */}
            <button
              className="flex-shrink-0 py-1.5 px-2 rounded-lg border border-red-900/60 text-red-600 hover:bg-red-900/20 font-semibold text-[11px] transition-colors flex items-center gap-0.5"
              onClick={() => { if (confirm(t('endMatchConfirm'))) dispatch({ type: 'END_MATCH' }); }}
            >
              <StopCircle size={11} />
            </button>

            {/* Mode toggle — tiny G / C */}
            <div className="flex-shrink-0 flex items-center gap-0.5 border border-slate-700 rounded-lg overflow-hidden">
              <button
                className={`px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  appMode === 'game' ? 'bg-blue-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                onClick={() => dispatch({ type: 'SET_APP_MODE', mode: 'game' })}
              >
                G
              </button>
              <button
                className={`px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  appMode === 'coach' ? 'bg-purple-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                onClick={() => dispatch({ type: 'SET_APP_MODE', mode: 'coach' })}
              >
                C
              </button>
            </div>
          </>
        ) : (
          /* End-set confirmation replaces the bar */
          <>
            <span className="text-orange-400 text-xs font-semibold flex-1 truncate">
              {t('endSet')} {currentMatch.currentSetIndex + 1}? ({currentSet.homeScore}–{currentSet.opponentScore})
            </span>
            <button
              className="flex-shrink-0 py-1.5 px-3 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
              onClick={handleEndSet}
            >
              {t('confirm')}
            </button>
            <button
              className="flex-shrink-0 py-1.5 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
              onClick={() => setShowEndSetConfirm(false)}
            >
              {t('cancel')}
            </button>
          </>
        )}
      </div>

      {/* ── Middle content: players (38%) + rotation (62%) ───────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Zone 2: 6 court players — fixed 38% slice, 2×3 grid */}
        <div
          className="flex-shrink-0 p-1.5 grid grid-cols-2 gap-1 overflow-hidden"
          style={{ flex: '0 0 38%', gridTemplateRows: 'repeat(3, 1fr)' }}
        >
          {courtPlayers.map(p => <PlayerCell key={p.id} player={p} />)}
          {/* Dashed placeholders when rotation not yet configured */}
          {Array.from({ length: Math.max(0, 6 - courtPlayers.length) }).map((_, i) => (
            <div key={`slot-${i}`} className="rounded-xl border border-slate-700/30 border-dashed bg-slate-800/20" />
          ))}
        </div>

        {/* Zone 3: Court rotation — flex-1 takes remaining 62% */}
        <CourtPanel />

      </div>

      {/* ── Bottom nav — flex-shrink-0 guarantees it's always visible ─────── */}
      <div className="flex border-t border-slate-700 bg-slate-900 flex-shrink-0 gap-2 p-2">
        <button
          className="btn-3d btn-3d-nav flex-1 py-3 gap-1.5 text-sm font-semibold"
          onClick={() => navigate(VIEWS.HOME)}
        >
          <ArrowLeft size={18} /> {t('home')}
        </button>
        <button
          className="btn-3d btn-3d-blue flex-1 py-3 gap-1.5 text-sm font-semibold"
          onClick={() => navigate(VIEWS.STATS)}
        >
          <BarChart2 size={18} /> {t('stats')}
        </button>
        <button
          className="btn-3d btn-3d-nav flex-1 py-3 gap-1.5 text-sm font-semibold"
          onClick={() => dispatch({ type: 'SHOW_HEATMAP' })}
        >
          <Layers size={18} /> {t('heatmap')}
        </button>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
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
