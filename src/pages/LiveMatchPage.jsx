import React, { useState } from 'react';
import { ArrowLeft, BarChart2, AlignLeft, Layers, StopCircle, UserPlus, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { VIEWS, POSITION_ABBR, EVENT_CONFIG } from '../utils/constants';
import { EVENT_TYPE_I18N_KEY } from '../i18n/translations';
import { calcPlayerStats } from '../utils/stats';
import ScoreHeader from '../components/ui/ScoreHeader';
import RotationView from '../components/ui/RotationView';
import EventButtons from '../components/ui/EventButtons';
import GameModeButtons from '../components/ui/GameModeButtons';
import SubstitutionModal from '../components/modals/SubstitutionModal';
import CourtDrawModal from '../components/modals/CourtDrawModal';
import HeatmapModal from '../components/modals/HeatmapModal';
import RotationSetupModal from '../components/modals/RotationSetupModal';
import ServeSetupModal from '../components/modals/ServeSetupModal';

export default function LiveMatchPage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const {
    currentMatch, selectedPlayerId,
    showSubstitution, showCourtDraw, showHeatmap, needsRotationSetup, needsServeSetup,
  } = state;
  const [showRotationSetup, setShowRotationSetup] = useState(false);
  const [activeTab, setActiveTab] = useState('players');
  const [showEndSetConfirm, setShowEndSetConfirm] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [addError,  setAddError]  = useState('');
  const appMode = state.appMode;

  function switchMode(mode) {
    dispatch({ type: 'SET_APP_MODE', mode });
  }

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
  const players = currentMatch.homeTeam.players;
  const allEvents = currentSet.events || [];

  function handlePlayerSelect(playerId) {
    dispatch({ type: 'SELECT_PLAYER', playerId });
  }

  function handleEndSet() {
    dispatch({ type: 'END_SET' });
    setShowEndSetConfirm(false);
  }

  function handleRotationSetupClose() {
    setShowRotationSetup(false);
    if (needsRotationSetup) dispatch({ type: 'DISMISS_ROTATION_SETUP' });
  }

  function openAddPlayer() {
    setNewName('');
    setNewNumber(String(players.length + 1));
    setAddError('');
    setShowAddPlayer(true);
  }

  function handleAddPlayer() {
    if (!newNumber.trim()) { setAddError(t('errJerseyRequired')); return; }
    dispatch({
      type: 'ADD_PLAYER_TO_MATCH',
      player: { id: uuidv4(), name: newName.trim(), number: newNumber.trim(), position: '' },
    });
    setShowAddPlayer(false);
  }

  // ── bench computation ──────────────────────────────────────────────────────
  const subbedOutIds = new Set(currentSet.substitutions.map(s => s.outPlayerId));
  const currentOnCourt = new Set(currentSet.rotation.filter(id => id !== ''));
  for (const sub of currentSet.substitutions) {
    currentOnCourt.delete(sub.outPlayerId);
    currentOnCourt.add(sub.inPlayerId);
  }
  const isBenched = id => subbedOutIds.has(id) && !currentOnCourt.has(id);
  const activePlayers = players.filter(p => !isBenched(p.id));
  const benchPlayers  = players.filter(p =>  isBenched(p.id));

  // ── player cell (2×3 grid) ─────────────────────────────────────────────────
  function PlayerCell({ player }) {
    const stats = calcPlayerStats(player.id, allEvents);
    const isSelected = selectedPlayerId === player.id;
    return (
      <button
        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all active:scale-[0.97] text-left w-full ${
          isSelected
            ? 'bg-blue-900 border-blue-500 shadow-md shadow-blue-900/40'
            : 'bg-slate-800 border-slate-700 hover:border-blue-700'
        }`}
        onClick={() => handlePlayerSelect(player.id)}
      >
        {/* Jersey */}
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-base font-black flex-shrink-0 leading-none ${
          isSelected ? 'bg-blue-700 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-white'
        }`}>
          {player.number}
        </div>

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-white font-black text-lg leading-none truncate">{player.name}</span>
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

  // ── bench chip (single compact line) ──────────────────────────────────────
  function BenchChip({ player }) {
    return (
      <button
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-blue-800 transition-colors active:scale-95"
        onClick={() => handlePlayerSelect(player.id)}
      >
        <span className="text-[11px] font-black text-slate-500">#{player.number}</span>
        <span className="text-[11px] font-semibold truncate max-w-[90px]">{player.name}</span>
      </button>
    );
  }

  const tabs = [
    { id: 'players',  labelKey: 'playersTab',  icon: AlignLeft },
    { id: 'rotation', labelKey: 'rotationTab', icon: Layers },
    { id: 'log',      labelKey: 'logTab',       icon: BarChart2 },
  ];

  return (
    // h-screen + overflow-hidden locks the page to viewport — no document scroll
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <ScoreHeader onShowSubstitution={() => dispatch({ type: 'SHOW_SUBSTITUTION' })} />

      {/* Tab bar */}
      <div className="flex bg-slate-800 border-b border-slate-700 flex-shrink-0">
        {tabs.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={13} /> {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-700/50 flex items-center justify-end px-3 py-1.5 gap-1.5">
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
      </div>

      {/* Content — flex-1 with min-h-0 allows proper flex child shrinking */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* ── Players tab: fixed layout, no scroll ─────────────────────────── */}
        {activeTab === 'players' && (
          <div className="flex-1 min-h-0 flex flex-col px-2 pt-2 pb-1 gap-1.5 overflow-hidden">

            {/* Hint + Add Player button */}
            <div className="flex items-center justify-between flex-shrink-0 px-0.5">
              <span className="text-slate-600 text-[10px] uppercase tracking-wider">
                {t('tapPlayerHint')}
              </span>
              <button
                className="flex items-center gap-1 text-[10px] font-bold text-green-400 hover:text-green-300 uppercase tracking-wider transition-colors"
                onClick={openAddPlayer}
              >
                <UserPlus size={11} /> {t('addPlayer')}
              </button>
            </div>

            {/* Active section label — only when bench exists */}
            {benchPlayers.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-0.5 flex-shrink-0">
                {t('activePlayersLabel')} · {activePlayers.length}
              </div>
            )}

            {/* 2 × n grid — grows to fill available space, cells have equal height */}
            <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
              {activePlayers.map(p => <PlayerCell key={p.id} player={p} />)}
            </div>

            {/* Bench section */}
            {benchPlayers.length > 0 && (
              <div className="flex-shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-px bg-slate-700/60" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    {t('benchLabel')} · {benchPlayers.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-700/60" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {benchPlayers.map(p => <BenchChip key={p.id} player={p} />)}
                </div>
              </div>
            )}

            {/* Set management — pushed to bottom with mt-auto */}
            <div className="mt-auto flex-shrink-0 pt-1">
              {!showEndSetConfirm ? (
                <div className="flex gap-2">
                  <button
                    className="flex-1 py-2 rounded-lg border border-orange-800 text-orange-400 hover:bg-orange-900/30 font-semibold text-xs transition-colors"
                    onClick={() => setShowEndSetConfirm(true)}
                  >
                    {t('endSet')} {currentMatch.currentSetIndex + 1}
                  </button>
                  <button
                    className="py-2 px-3 rounded-lg border border-red-900/60 text-red-600 hover:bg-red-900/20 font-semibold text-xs transition-colors flex items-center gap-1"
                    onClick={() => { if (confirm(t('endMatchConfirm'))) dispatch({ type: 'END_MATCH' }); }}
                  >
                    <StopCircle size={12} /> {t('endMatch')}
                  </button>
                </div>
              ) : (
                <div className="bg-orange-900/20 border border-orange-800 rounded-lg px-3 py-2">
                  <div className="text-orange-300 font-semibold text-xs mb-2">
                    {t('endSet')} {currentMatch.currentSetIndex + 1}? ({currentSet.homeScore}–{currentSet.opponentScore})
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-600 text-white font-semibold text-xs transition-colors"
                      onClick={handleEndSet}
                    >
                      {t('confirm')}
                    </button>
                    <button
                      className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
                      onClick={() => setShowEndSetConfirm(false)}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rotation tab: scrollable ──────────────────────────────────────── */}
        {activeTab === 'rotation' && (
          <div className="flex-1 overflow-y-auto p-3 animate-fade-in">
            <RotationView />
            <button
              className="mt-3 w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
              onClick={() => setShowRotationSetup(true)}
            >
              {t('setStartingRotation')}
            </button>

            {currentSet.substitutions.length > 0 && (
              <div className="mt-4">
                <div className="text-slate-500 text-xs uppercase tracking-wider mb-2">{t('substitutions')}</div>
                <div className="space-y-2">
                  {currentSet.substitutions.map(sub => {
                    const outP = players.find(p => p.id === sub.outPlayerId);
                    const inP  = players.find(p => p.id === sub.inPlayerId);
                    return (
                      <div key={sub.id} className="bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
                        <span className="text-red-400">#{outP?.number} {outP?.name}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-green-400">#{inP?.number} {inP?.name}</span>
                        <span className="text-slate-600 ml-auto text-xs">{sub.homeScore}-{sub.opponentScore}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Log tab: scrollable ───────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div className="flex-1 overflow-y-auto p-3 animate-fade-in">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">{t('recentEvents')}</div>
            {currentSet.events.length === 0 ? (
              <div className="text-center text-slate-600 py-8">{t('noEventsRecorded')}</div>
            ) : (
              <div className="space-y-1">
                {[...currentSet.events].reverse().map(event => {
                  const player  = players.find(p => p.id === event.playerId);
                  const evtConf = EVENT_CONFIG.find(e => e.type === event.type);
                  const evtLabel = evtConf && EVENT_TYPE_I18N_KEY[evtConf.type]
                    ? t(EVENT_TYPE_I18N_KEY[evtConf.type]) : evtConf?.label;
                  return (
                    <div key={event.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-800 border border-slate-700">
                      <span className="text-lg leading-none">{evtConf?.emoji || '•'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium">{evtLabel || event.type}</div>
                        <div className="text-xs text-slate-400 truncate">#{player?.number} {player?.name}</div>
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums flex-shrink-0">
                        {event.homeScore}–{event.opponentScore}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
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

      {/* Add Player modal */}
      {showAddPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowAddPlayer(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-600 p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">{t('addPlayer')}</h3>
              <button
                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                onClick={() => setShowAddPlayer(false)}
              >
                <X size={15} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {/* Jersey number */}
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-1.5">
                  {t('jerseyNumber')}
                </label>
                <input
                  type="number"
                  value={newNumber}
                  onChange={e => { setNewNumber(e.target.value); setAddError(''); }}
                  placeholder="#"
                  min="1" max="99"
                  autoFocus
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {/* Player name (optional) */}
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-1.5">
                  {t('playerName')}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setAddError(''); }}
                  placeholder={t('nameOptional')}
                  onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {addError && (
              <div className="text-red-400 text-xs mb-3">{addError}</div>
            )}

            <div className="flex gap-2">
              <button
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-colors"
                onClick={() => setShowAddPlayer(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="flex-1 btn-3d btn-3d-green py-3 text-white font-bold text-sm"
                onClick={handleAddPlayer}
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedPlayerId && (appMode === 'game' ? <GameModeButtons /> : <EventButtons />)}
      {showSubstitution && <SubstitutionModal onClose={() => dispatch({ type: 'HIDE_SUBSTITUTION' })} />}
      {showCourtDraw && <CourtDrawModal />}
      {showHeatmap && <HeatmapModal />}
      {/* Serve setup is shown first (mandatory); rotation setup only appears after serve is chosen */}
      {needsServeSetup && <ServeSetupModal />}
      {!needsServeSetup && (showRotationSetup || needsRotationSetup) && (
        <RotationSetupModal onClose={handleRotationSetupClose} />
      )}
    </div>
  );
}
