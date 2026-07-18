import React, { useState, useEffect } from 'react';
import { ArrowLeft, BarChart2, Layers, StopCircle, RotateCw, RotateCcw, Shuffle } from 'lucide-react';
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
      const timer = setTimeout(() => setUndoFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [lastUndoneEvent]);

  if (!currentMatch) {
    return (
      <div style={{ height: '100dvh' }} className="bg-slate-900 flex items-center justify-center">
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

  const lastEvent      = allEvents[allEvents.length - 1];
  const lastEventConf  = lastEvent ? EVENT_CONFIG.find(e => e.type === lastEvent.type) : null;
  const lastEventLabel = lastEventConf && EVENT_TYPE_I18N_KEY[lastEventConf.type]
    ? t(EVENT_TYPE_I18N_KEY[lastEventConf.type]) : lastEventConf?.label;

  // Current on-court players (rotation + substitutions applied)
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

  // ── Compact player card ──────────────────────────────────────────────────────
  function PlayerCell({ player }) {
    const stats = calcPlayerStats(player.id, allEvents);
    const isSelected = selectedPlayerId === player.id;
    return (
      <button
        className={`flex flex-col items-center justify-center gap-0.5 px-1.5 rounded-xl border transition-all active:scale-[0.97] w-full h-full ${
          isSelected
            ? 'bg-blue-900 border-blue-500 shadow-lg shadow-blue-900/40'
            : 'bg-slate-800 border-slate-700 hover:border-blue-700'
        }`}
        onClick={() => handlePlayerSelect(player.id)}
      >
        {/* Jersey + name on same row */}
        <div className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 ${
            isSelected ? 'bg-blue-700 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-white'
          }`}>
            {player.number}
          </div>
          <span className="text-white font-bold text-sm leading-none truncate max-w-[5.5rem]">{player.name}</span>
        </div>
        {/* Stats row */}
        <div className="flex items-center gap-1">
          <span className="text-green-400 text-[10px] font-bold tabular-nums">{stats.cardPoints}<span className="text-green-600 text-[8px]">נק׳</span></span>
          <span className="text-slate-600 text-[8px]">|</span>
          <span className="text-blue-400 text-[10px] font-bold tabular-nums">{stats.cardAttacks}<span className="text-blue-600 text-[8px]">התק׳</span></span>
          <span className="text-slate-600 text-[8px]">|</span>
          <span className="text-red-400 text-[10px] font-bold tabular-nums">{stats.cardMistakes}<span className="text-red-600 text-[8px]">שג׳</span></span>
        </div>
      </button>
    );
  }

  // ── Rotation court panel ─────────────────────────────────────────────────────
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

        {/* Header row: rotation controls + sub button */}
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/60">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex-shrink-0">
            {t('rotationLabel')} {rotIdx + 1}
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            <button
              disabled={!canUndo}
              onClick={() => canUndo && dispatch({ type: 'UNDO_ROTATION' })}
              className={`flex items-center gap-0.5 text-[10px] px-1.5 py-1 rounded-lg font-medium transition-colors ${
                canUndo
                  ? 'bg-amber-900/70 border border-amber-700 text-amber-300 active:scale-95'
                  : 'bg-slate-700/20 border border-slate-700/40 text-slate-600 cursor-not-allowed'
              }`}
            >
              <RotateCcw size={9} /> {t('undoRotation')}
            </button>
            <button
              onClick={() => dispatch({ type: 'MANUAL_ROTATE' })}
              className="flex items-center gap-0.5 text-[10px] bg-slate-700 hover:bg-blue-800 active:scale-95 px-1.5 py-1 rounded-lg font-medium border border-slate-600 text-slate-200 transition-colors"
            >
              <RotateCw size={9} /> {t('rotateBtn')}
            </button>
            <button
              onClick={() => setShowRotationSetup(true)}
              className="text-[9px] text-slate-500 hover:text-slate-300 px-1.5 py-1 rounded transition-colors"
            >
              ✎
            </button>
            {/* Sub button lives here */}
            <button
              className="flex items-center gap-0.5 text-[10px] bg-blue-800 hover:bg-blue-700 active:scale-95 px-2 py-1 rounded-lg font-semibold border border-blue-600 text-blue-100 transition-colors"
              onClick={() => dispatch({ type: 'SHOW_SUBSTITUTION' })}
            >
              <Shuffle size={9} /> {t('switchPlayer')}
            </button>
          </div>
        </div>

        {/* Net divider */}
        <div className="flex-shrink-0 flex items-center gap-2 px-2 pt-1 pb-0.5">
          <div className="flex-1 h-px bg-yellow-500/40 rounded" />
          <span className="text-[8px] font-bold text-yellow-500/60 uppercase tracking-widest">{t('netLabel')}</span>
          <div className="flex-1 h-px bg-yellow-500/40 rounded" />
        </div>

        {/* 2-row × 3-col court grid */}
        <div
          className="flex-1 min-h-0 grid grid-cols-3 px-1.5 pb-1.5 gap-1"
          style={{ gridTemplateRows: 'repeat(2, 1fr)' }}
        >
          {COURT_LAYOUT.map(([pos]) => {
            const player   = playerAt(pos);
            const isServer = pos === 1;
            return (
              <div
                key={pos}
                className={`rounded-lg flex flex-col items-center justify-center overflow-hidden ${
                  isServer
                    ? 'bg-green-900/60 border-2 border-green-600/60 shadow-md shadow-green-900/30'
                    : 'bg-slate-700/50 border border-slate-600/50'
                }`}
              >
                <div className={`text-[8px] font-bold leading-none mb-0.5 ${isServer ? 'text-green-400' : 'text-slate-500'}`}>
                  P{pos}{isServer ? ' 🏐' : ''}
                </div>
                {player ? (
                  <>
                    <div
                      className={`font-black tabular-nums leading-none ${isServer ? 'text-green-200' : 'text-white'}`}
                      style={{ fontSize: 'clamp(0.9rem, 2.8vh, 1.75rem)' }}
                    >
                      {player.number}
                    </div>
                    <div
                      className={`text-center truncate w-full px-0.5 leading-tight font-semibold ${isServer ? 'text-green-300/90' : 'text-slate-300'}`}
                      style={{ fontSize: 'clamp(0.55rem, 1.3vh, 0.8rem)' }}
                    >
                      {player.name.split(' ')[0]}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-600 text-sm">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 flex flex-col overflow-hidden" style={{ height: '100dvh' }}>

      {/* Zone 1: Score header + serve indicator */}
      <ScoreHeader />

      {/* Control bar — always LTR so visual order is predictable */}
      <div className="flex-shrink-0 bg-slate-900/95 border-b border-slate-700/60 flex items-center px-2 py-1.5 gap-2" dir="ltr">
        {!showEndSetConfirm ? (
          <>
            {/* LEFT: mode toggle */}
            <div className="flex-shrink-0 flex items-center border border-slate-700 rounded-lg overflow-hidden">
              <button
                className={`px-2.5 py-2 text-xs font-bold transition-colors ${
                  appMode === 'game' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => dispatch({ type: 'SET_APP_MODE', mode: 'game' })}
              >
                {t('gameModeShort')}
              </button>
              <div className="w-px h-5 bg-slate-700" />
              <button
                className={`px-2.5 py-2 text-xs font-bold transition-colors ${
                  appMode === 'coach' ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => dispatch({ type: 'SET_APP_MODE', mode: 'coach' })}
              >
                {t('coachModeShort')}
              </button>
            </div>

            {/* CENTER: End Set — biggest, most prominent */}
            <button
              className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black text-sm transition-all shadow-md shadow-orange-900/40"
              onClick={() => setShowEndSetConfirm(true)}
            >
              {t('endSet')} {currentMatch.currentSetIndex + 1}
            </button>

            {/* RIGHT: Undo (small) + End Match (red text) */}
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <button
                disabled={!lastEvent}
                onClick={() => lastEvent && dispatch({ type: 'UNDO_LAST_EVENT' })}
                className={`flex items-center gap-0.5 px-2 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                  !lastEvent
                    ? 'border-slate-700/30 text-slate-600 cursor-not-allowed'
                    : undoFlash
                      ? 'bg-amber-900/60 border-amber-700 text-amber-300'
                      : 'border-slate-700 text-slate-400 hover:border-amber-700 hover:text-amber-400'
                }`}
              >
                <RotateCcw size={11} className="flex-shrink-0" />
                <span className="hidden sm:inline">{t('undoAction')}</span>
              </button>
              <button
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-red-900/70 hover:bg-red-800 active:scale-95 border border-red-700/50 text-red-200 font-bold text-xs transition-all"
                onClick={() => { if (confirm(t('endMatchConfirm'))) dispatch({ type: 'END_MATCH' }); }}
              >
                <StopCircle size={12} />
                {t('endMatch')}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-orange-400 text-sm font-semibold flex-1">
              {t('endSet')} {currentMatch.currentSetIndex + 1}? ({currentSet.homeScore}–{currentSet.opponentScore})
            </span>
            <button
              className="flex-shrink-0 py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-black transition-colors"
              onClick={handleEndSet}
            >
              {t('confirm')}
            </button>
            <button
              className="flex-shrink-0 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
              onClick={() => setShowEndSetConfirm(false)}
            >
              {t('cancel')}
            </button>
          </>
        )}
      </div>

      {/* Middle content: player grid (35%) + court rotation (65%) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Player grid — fixed slice, 2×3 */}
        <div
          className="flex-shrink-0 p-1 grid grid-cols-2 gap-1 overflow-hidden"
          style={{ flex: '0 0 35%', gridTemplateRows: 'repeat(3, 1fr)' }}
        >
          {courtPlayers.map(p => <PlayerCell key={p.id} player={p} />)}
          {Array.from({ length: Math.max(0, 6 - courtPlayers.length) }).map((_, i) => (
            <div key={`slot-${i}`} className="rounded-xl border border-slate-700/20 border-dashed bg-slate-800/10" />
          ))}
        </div>

        {/* Court rotation — fills remaining space */}
        <CourtPanel />

      </div>

      {/* Bottom nav — always visible */}
      <div className="flex border-t border-slate-700 bg-slate-900 flex-shrink-0 gap-1.5 px-2 py-1.5">
        <button
          className="btn-3d btn-3d-nav flex-1 py-2.5 gap-1 text-sm font-semibold"
          onClick={() => navigate(VIEWS.HOME)}
        >
          <ArrowLeft size={16} /> {t('home')}
        </button>
        <button
          className="btn-3d btn-3d-blue flex-1 py-2.5 gap-1 text-sm font-semibold"
          onClick={() => navigate(VIEWS.STATS)}
        >
          <BarChart2 size={16} /> {t('stats')}
        </button>
        <button
          className="btn-3d btn-3d-nav flex-1 py-2.5 gap-1 text-sm font-semibold"
          onClick={() => dispatch({ type: 'SHOW_HEATMAP' })}
        >
          <Layers size={16} /> {t('heatmap')}
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
