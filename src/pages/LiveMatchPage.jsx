import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, BarChart2, Layers, StopCircle, RotateCw, RotateCcw, Shuffle, List } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { VIEWS, EVENT_TYPES as T, EVENT_CONFIG, HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from '../utils/constants';
import { EVENT_TYPE_I18N_KEY } from '../i18n/translations';
import { calcPlayerStats } from '../utils/stats';
import ScoreHeader from '../components/ui/ScoreHeader';
import SubstitutionModal from '../components/modals/SubstitutionModal';
import CourtDrawModal from '../components/modals/CourtDrawModal';
import HeatmapModal from '../components/modals/HeatmapModal';
import RotationSetupModal from '../components/modals/RotationSetupModal';
import ServeSetupModal from '../components/modals/ServeSetupModal';

// Physical court layout — always LTR
const COURT_LAYOUT = [
  [4, 0, 0], [3, 0, 1], [2, 0, 2],
  [5, 1, 0], [6, 1, 1], [1, 1, 2],
];

// ── Inline button primitives ──────────────────────────────────────────────────
function BigBtn({ emoji, label, score, color = 'slate', onClick }) {
  const cls = {
    green:  'bg-green-800/80 border-green-600 text-green-100 active:bg-green-700',
    red:    'bg-red-900/80   border-red-700   text-red-200   active:bg-red-800',
    blue:   'bg-blue-900/70  border-blue-700  text-blue-200  active:bg-blue-800',
    amber:  'bg-amber-900/70 border-amber-700 text-amber-200 active:bg-amber-800',
    slate:  'bg-slate-700/80 border-slate-600 text-slate-200 active:bg-slate-600',
    teal:   'bg-teal-900/70  border-teal-700  text-teal-200  active:bg-teal-800',
  }[color] ?? 'bg-slate-700/80 border-slate-600 text-slate-200 active:bg-slate-600';
  return (
    <button
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-center transition-all active:scale-95 px-1 py-2 h-[72px] ${cls}`}
      onClick={onClick}
    >
      <span className="text-xl leading-none">{emoji}</span>
      <span className="text-[10px] font-bold leading-tight">{label}</span>
      {score && <span className={`text-[9px] font-black ${score === '+1' ? 'text-green-300' : 'text-red-300'}`}>{score}</span>}
    </button>
  );
}

function SmallBtn({ emoji, label, score, color = 'slate', onClick }) {
  const cls = {
    green:  'bg-green-900/70 border-green-700 text-green-200 active:bg-green-800',
    red:    'bg-red-900/70   border-red-700   text-red-200   active:bg-red-800',
    blue:   'bg-blue-900/70  border-blue-700  text-blue-200  active:bg-blue-800',
    slate:  'bg-slate-700/60 border-slate-600 text-slate-300 active:bg-slate-600',
    teal:   'bg-teal-900/60  border-teal-700  text-teal-300  active:bg-teal-800',
    amber:  'bg-amber-900/60 border-amber-700 text-amber-200 active:bg-amber-800',
  }[color] ?? 'bg-slate-700/60 border-slate-600 text-slate-300 active:bg-slate-600';
  return (
    <button
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition-all active:scale-95 px-1 py-2 h-[58px] ${cls}`}
      onClick={onClick}
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
      {score && <span className={`text-[9px] font-black ${score === '+1' ? 'text-green-300' : 'text-red-300'}`}>{score}</span>}
    </button>
  );
}

export default function LiveMatchPage() {
  const { state, dispatch, navigate, forceSave } = useMatch();
  const { t } = useLanguage();
  const {
    currentMatch, selectedPlayerId,
    showSubstitution, showCourtDraw, showHeatmap,
    needsRotationSetup, needsServeSetup, lastUndoneEvent,
  } = state;
  const [showRotationSetup, setShowRotationSetup] = useState(false);
  const [showEndSetConfirm, setShowEndSetConfirm] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [undoFlash, setUndoFlash] = useState(false);
  // Flash on the last-event bar — increments per logged event, resets after 1s
  const [eventFlashCount, setEventFlashCount] = useState(0);
  const [eventFlash, setEventFlash] = useState(false);
  // Flow stack — named steps for nested sub-menus; back pops; recording clears
  const [flowStack, setFlowStack] = useState([]);
  const currentFlow = flowStack[flowStack.length - 1] ?? null;
  const pushFlow  = (step) => setFlowStack(s => [...s, step]);
  const popFlow   = ()     => setFlowStack(s => s.slice(0, -1));
  const clearFlow = ()     => setFlowStack([]);
  const appMode = state.appMode;

  useEffect(() => {
    if (lastUndoneEvent) {
      setUndoFlash(true);
      const timer = setTimeout(() => setUndoFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [lastUndoneEvent]);

  // Flash the last-event bar for 1 s after each recorded event
  useEffect(() => {
    if (eventFlashCount === 0) return;
    setEventFlash(true);
    const timer = setTimeout(() => setEventFlash(false), 1000);
    return () => clearTimeout(timer);
  }, [eventFlashCount]);

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
  const lastEventPlayerName = lastEvent?.playerId
    ? (players.find(p => p.id === lastEvent.playerId)?.name?.split(' ')[0] ?? null)
    : null;

  function recordEvent(type, extra = {}) {
    if (!selectedPlayerId) return;
    dispatch({
      type: 'RECORD_EVENT',
      event: { id: uuidv4(), type, playerId: selectedPlayerId, timestamp: Date.now(), ...extra },
    });
    clearFlow();
    setEventFlashCount(c => c + 1); // triggers flash on last-event bar
  }

  async function handleEndSet() {
    try {
      await forceSave();
      dispatch({ type: 'END_SET' });
      setShowEndSetConfirm(false);
    } catch { /* saveStatus.error shown in header */ }
  }

  async function handleEndMatch() {
    if (!confirm(t('endMatchConfirm'))) return;
    try {
      await forceSave();
      dispatch({ type: 'END_MATCH' });
    } catch { alert(t('saveFailedAbort')); }
  }

  function handleRotationSetupClose() {
    setShowRotationSetup(false);
    if (needsRotationSetup) dispatch({ type: 'DISMISS_ROTATION_SETUP' });
  }

  // ── Event log panel ───────────────────────────────────────────────────────────
  function EventLogPanel() {
    const reversed = [...allEvents].reverse();
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setShowEventLog(false)}
        />
        {/* Slide-up panel */}
        <div className="fixed inset-x-0 bottom-0 z-40 bg-slate-900 border-t-2 border-slate-700 rounded-t-2xl flex flex-col" style={{ maxHeight: '75dvh' }}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <List size={14} className="text-blue-400" />
              <span className="text-white font-bold text-sm">{t('eventLog')}</span>
              <span className="text-slate-500 text-xs">({allEvents.length})</span>
            </div>
            <button
              className="text-slate-400 hover:text-slate-200 text-sm font-semibold px-2 py-1 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
              onClick={() => setShowEventLog(false)}
            >
              {t('closeBtn')}
            </button>
          </div>

          {/* Event list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {reversed.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">
                {t('noEventsRecorded')}
              </div>
            ) : (
              reversed.map((ev, idx) => {
                const isLast = idx === 0;
                const isSub  = ev.isSubstitution === true;
                const conf   = EVENT_CONFIG.find(c => c.type === ev.type);
                const isHome = HOME_SCORE_EVENTS.has(ev.type);
                const isOpp  = OPPONENT_SCORE_EVENTS.has(ev.type);
                const scoreColor = isHome ? 'text-green-400' : isOpp ? 'text-red-400' : 'text-slate-600';
                const scoreMark  = isHome ? '+1' : isOpp ? '-1' : '•';
                const timeStr = new Date(ev.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                });

                // Substitution entry: show "Sub: out → in" instead of generic label
                let label, subLine;
                if (isSub) {
                  label = t('substitution');
                  const pOut = players.find(p => p.id === ev.outPlayerId);
                  const pIn  = players.find(p => p.id === ev.inPlayerId);
                  subLine = [pOut, pIn].filter(Boolean)
                    .map(p => `#${p.number} ${p.name.split(' ')[0]}`)
                    .join(' → ');
                } else {
                  const evPlayer = players.find(p => p.id === ev.playerId);
                  label = conf && EVENT_TYPE_I18N_KEY[conf.type]
                    ? t(EVENT_TYPE_I18N_KEY[conf.type]) : conf?.label ?? ev.type;
                  subLine = evPlayer ? `#${evPlayer.number} ${evPlayer.name}` : null;
                }

                // Undo button only for non-substitution events
                const isLastUndoable = !isSub && reversed.find(e => !e.isSubstitution) === ev;

                const scoreStr = (ev.homeScore != null && ev.opponentScore != null)
                  ? `${ev.homeScore}-${ev.opponentScore}` : null;

                return (
                  <div
                    key={ev.id ?? idx}
                    className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/80 ${isLast ? 'bg-slate-800/40' : ''} ${isSub ? 'bg-blue-950/20' : ''}`}
                  >
                    {/* Time + score */}
                    <div className="flex flex-col items-start flex-shrink-0 w-14 gap-px">
                      <span className="text-[10px] text-slate-600 font-mono leading-none">{timeStr}</span>
                      {scoreStr && <span className="text-[10px] text-slate-400 font-mono font-semibold leading-none">{scoreStr}</span>}
                    </div>
                    {/* Emoji */}
                    <span className="text-base flex-shrink-0">{conf?.emoji ?? '•'}</span>
                    {/* Label + player/sub line */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-semibold truncate ${isSub ? 'text-blue-300' : 'text-slate-200'}`}>{label}</div>
                      {subLine && (
                        <div className="text-[10px] text-slate-500 truncate">{subLine}</div>
                      )}
                    </div>
                    {/* Score badge */}
                    <span className={`text-[10px] font-black flex-shrink-0 w-5 text-right ${scoreColor}`}>
                      {scoreMark}
                    </span>
                    {/* Undo — only for the most recent non-substitution event */}
                    {isLastUndoable && (
                      <button
                        className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-lg border border-amber-700/60 bg-amber-900/30 text-amber-400 text-[10px] font-semibold hover:bg-amber-900/60 transition-colors active:scale-95"
                        onClick={() => {
                          dispatch({ type: 'UNDO_LAST_EVENT' });
                          setShowEventLog(false);
                        }}
                      >
                        <RotateCcw size={10} />
                        {t('undo')}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Unified court + inline actions ───────────────────────────────────────────
  function UnifiedCourtAndActions() {
    const rotation    = currentSet.rotation;
    const rotIdx      = currentMatch.currentRotationIndex;
    const canUndo     = (currentMatch.rotationHistory || []).length > 0;
    const hasRotation = rotation.some(id => id !== '');
    const selectedPlayer = selectedPlayerId ? players.find(p => p.id === selectedPlayerId) : null;

    function playerAt(pos) {
      const id = rotation[pos - 1];
      return players.find(p => p.id === id) ?? null;
    }

    // ── Court cell ──────────────────────────────────────────────────────────
    function CourtCell({ pos }) {
      const player     = playerAt(pos);
      const isServer   = pos === 1;
      const isSelected = !!(player && selectedPlayerId === player.id);
      const stats      = player ? calcPlayerStats(player.id, allEvents) : null;

      return (
        <button
          className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all select-none overflow-hidden ${
            isSelected
              ? 'bg-blue-900 border-blue-400 shadow-lg shadow-blue-900/50'
              : isServer
                ? 'bg-green-900/60 border-green-600/70 active:bg-green-800/70'
                : 'bg-slate-800/70 border-slate-600/50 active:bg-slate-700/70'
          }`}
          style={{ height: 76 }}
          onClick={() => {
            if (!player) return;
            if (isSelected) { dispatch({ type: 'DESELECT_PLAYER' }); clearFlow(); }
            else            { dispatch({ type: 'SELECT_PLAYER', playerId: player.id }); clearFlow(); }
          }}
        >
          <div className={`text-[7px] font-bold leading-none ${isServer ? 'text-green-400' : 'text-slate-500'}`}>
            P{pos}{isServer ? ' 🏐' : ''}
          </div>
          {player ? (
            <>
              <div className={`font-black tabular-nums text-xl leading-none mt-0.5 ${isSelected ? 'text-blue-200' : isServer ? 'text-green-200' : 'text-white'}`}>
                {player.number}
              </div>
              <div className={`text-[9px] font-semibold truncate w-full px-1 text-center leading-tight ${isSelected ? 'text-blue-300' : isServer ? 'text-green-400' : 'text-slate-300'}`}>
                {player.name.split(' ')[0]}
              </div>
              {stats && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="text-green-400 text-[8px] font-bold">{stats.cardPoints}</span>
                  <span className="text-slate-600 text-[7px]">|</span>
                  <span className="text-blue-400 text-[8px] font-bold">{stats.cardAttacks}</span>
                  <span className="text-slate-600 text-[7px]">|</span>
                  <span className="text-red-400 text-[8px] font-bold">{stats.cardMistakes}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-600 text-sm">—</div>
          )}
        </button>
      );
    }

    // ── Shared sub-menu header ──────────────────────────────────────────────
    function SubHeader({ color, label }) {
      return (
        <div className="flex items-center gap-2 mb-2">
          <button className="text-slate-400 text-xs flex items-center gap-1 hover:text-slate-200 transition-colors" onClick={popFlow}>
            {'←'} {t('back')}
          </button>
          <span className={`text-xs font-bold ${color}`}>{label}</span>
        </div>
      );
    }

    // Attack error step 1: Blocked | Net Touch | Out
    function AttackErrScreen() {
      return (
        <div className="p-3 flex flex-col gap-2">
          <SubHeader color="text-red-400" label={t('attackErrSubmenu')} />
          <div className="grid grid-cols-3 gap-2">
            <BigBtn emoji="🛑" label={t('blockedAttackLabel')} score="-1" color="red" onClick={() => pushFlow('attackErrBlocked')} />
            <BigBtn emoji="🕸️" label={t('attackNetTouch')}    score="-1" color="red" onClick={() => recordEvent(T.ATTACK_NET_TOUCH)} />
            <BigBtn emoji="💥" label={t('attackOut')}          score="-1" color="red" onClick={() => recordEvent(T.ATTACK_OUT)} />
          </div>
        </div>
      );
    }

    // Attack error step 2 (blocked): 2nd or 3rd ball?
    function BlockedBallScreen() {
      return (
        <div className="p-3 flex flex-col gap-2">
          <SubHeader color="text-red-400" label={t('chooseBallNumber')} />
          <div className="grid grid-cols-2 gap-2">
            <BigBtn emoji="2️⃣" label={t('secondBall')} score="-1" color="red" onClick={() => recordEvent(T.ATTACK_BLOCKED, { ballNumber: 2 })} />
            <BigBtn emoji="3️⃣" label={t('thirdBall')}  score="-1" color="red" onClick={() => recordEvent(T.ATTACK_BLOCKED, { ballNumber: 3 })} />
          </div>
        </div>
      );
    }

    // Defence error sub-menu
    function DefenceErrScreen() {
      return (
        <div className="p-3 flex flex-col gap-2">
          <SubHeader color="text-teal-400" label={t('defenceErrSubmenu')} />
          <div className="grid grid-cols-2 gap-2">
            <BigBtn emoji="🚧" label={t('blockError')}           color="red" onClick={() => recordEvent(T.BLOCK_ERROR)} />
            <BigBtn emoji="📍" label={t('defenceLocationError')} color="red" onClick={() => recordEvent(T.DEFENCE_LOCATION_ERROR)} />
          </div>
        </div>
      );
    }

    // ── Inline action area renderer ────────────────────────────────────────
    function InlineActionArea() {
      if (currentFlow === 'attackErr')        return <AttackErrScreen />;
      if (currentFlow === 'attackErrBlocked') return <BlockedBallScreen />;
      if (currentFlow === 'defenseErr')       return <DefenceErrScreen />;

      // Game mode
      if (appMode === 'game') {
        if (currentFlow === 'gameMistake') {
          return (
            <div className="p-2 flex flex-col gap-2">
              <SubHeader color="text-orange-400" label={t('gmMistakeHint')} />
              <div className="grid grid-cols-3 gap-2">
                <BigBtn emoji="❌" label={t('gmBadServe')}   score="-1" color="red"   onClick={() => recordEvent(T.SERVE_ERROR)} />
                <BigBtn emoji="💢" label={t('attackErrBtn')} score="-1" color="red"   onClick={() => pushFlow('attackErr')} />
                <BigBtn emoji="🏐" label={t('gmBadPass')}    color="slate"             onClick={() => recordEvent(T.FREE_BALL)} />
              </div>
            </div>
          );
        }
        return (
          <div className="p-2 grid grid-cols-2 gap-2" style={{ gridTemplateRows: '72px 72px' }}>
            <BigBtn emoji="⚡" label={t('gmSuccessAttack')} score="+1" color="green" onClick={() => recordEvent(T.ATTACK_WIN_3RD)} />
            <BigBtn emoji="↩️" label={t('gmFailedAttempt')} color="blue"             onClick={() => recordEvent(T.ATTACK_CONT_3RD)} />
            <BigBtn emoji="🎯" label={t('ace')}             score="+1" color="green" onClick={() => recordEvent(T.ACE)} />
            <BigBtn emoji="⚠️" label={t('gmMistake')}       color="amber"            onClick={() => pushFlow('gameMistake')} />
          </div>
        );
      }

      // Coach mode
      return (
        <div className="px-2 py-2 space-y-3">
          <div>
            <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider border-b border-sky-900/50 pb-0.5 mb-1.5">{t('catServe')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <SmallBtn emoji="🎯" label={t('ace')}        score="+1" color="green" onClick={() => recordEvent(T.ACE)} />
              <SmallBtn emoji="✅" label={t('serveIn')}    color="blue"             onClick={() => recordEvent(T.SERVE_IN)} />
              <SmallBtn emoji="❌" label={t('serveError')} score="-1" color="red"   onClick={() => recordEvent(T.SERVE_ERROR)} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider border-b border-orange-900/50 pb-0.5 mb-1.5">{t('catAttack')} — {t('secondBall')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <SmallBtn emoji="⚡" label={t('attackWin2nd')}  score="+1" color="green" onClick={() => recordEvent(T.ATTACK_WIN_2ND)} />
              <SmallBtn emoji="↩️" label={t('attackCont2nd')} color="blue"             onClick={() => recordEvent(T.ATTACK_CONT_2ND)} />
              <SmallBtn emoji="💢" label={t('attackErrBtn')}  score="-1" color="red"   onClick={() => pushFlow('attackErr')} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider border-b border-orange-900/50 pb-0.5 mb-1.5">{t('catAttack')} — {t('thirdBall')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <SmallBtn emoji="⚡" label={t('attackWin3rd')}  score="+1" color="green" onClick={() => recordEvent(T.ATTACK_WIN_3RD)} />
              <SmallBtn emoji="↩️" label={t('attackCont3rd')} color="blue"             onClick={() => recordEvent(T.ATTACK_CONT_3RD)} />
              <SmallBtn emoji="💢" label={t('attackErrBtn')}  score="-1" color="red"   onClick={() => pushFlow('attackErr')} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-teal-400 uppercase tracking-wider border-b border-teal-900/50 pb-0.5 mb-1.5">{t('catDefense')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <SmallBtn emoji="🖐️" label={t('blockTouch')}   color="teal"  onClick={() => recordEvent(T.BLOCK_TOUCH)} />
              <SmallBtn emoji="🚫" label={t('blockMistake')} color="slate" onClick={() => recordEvent(T.BLOCK_MISTAKE)} />
              <SmallBtn emoji="⛔" label={t('defenseError')} score="-1" color="red" onClick={() => pushFlow('defenseErr')} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider border-b border-violet-900/50 pb-0.5 mb-1.5">{t('catSetting')}</div>
            <div className="grid grid-cols-2 gap-1.5">
              <SmallBtn emoji="🙌" label={t('setSuccess')} color="blue" onClick={() => recordEvent(T.SET_SUCCESS)} />
              <SmallBtn emoji="🔴" label={t('setError')}   score="-1" color="red" onClick={() => recordEvent(T.SET_ERROR)} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 pb-0.5 mb-1.5">{t('catOther')}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <SmallBtn emoji="🛡️" label={t('block')}         score="+1" color="green" onClick={() => recordEvent(T.BLOCK)} />
              <SmallBtn emoji="🎁" label={t('opponentError')} score="+1" color="green" onClick={() => recordEvent(T.OPPONENT_ERROR)} />
              <SmallBtn emoji="🏐" label={t('freeBall')}      color="slate"             onClick={() => recordEvent(T.FREE_BALL)} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-slate-800/70 border-t border-slate-700 overflow-hidden" dir="ltr">

        {/* Rotation header */}
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/60">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex-shrink-0">
            {t('rotationLabel')} {rotIdx + 1}
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end flex-wrap">
            <button
              onClick={() => setShowRotationSetup(true)}
              className="flex items-center gap-0.5 text-[9px] bg-indigo-900/80 hover:bg-indigo-800 active:scale-95 px-1.5 py-1 rounded-lg font-semibold border border-indigo-700/60 text-indigo-300 transition-colors"
            >
              ✎ {t('setStartingPositions')}
            </button>
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

        {/* Court grid or setup prompt */}
        {!hasRotation ? (
          <div className="flex-shrink-0 flex flex-col items-center justify-center py-5 gap-3">
            <p className="text-slate-500 text-sm">{t('noRotationSetup')}</p>
            <button
              onClick={() => setShowRotationSetup(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 active:scale-95 text-white font-semibold text-sm transition-all"
            >
              ✎ {t('setStartingPositions')}
            </button>
          </div>
        ) : (
          <div
            className="flex-shrink-0 grid grid-cols-3 px-1.5 pb-1 gap-1"
            style={{ gridTemplateRows: '76px 76px' }}
          >
            {COURT_LAYOUT.map(([pos]) => <CourtCell key={pos} pos={pos} />)}
          </div>
        )}

        {/* Separator */}
        <div className="flex-shrink-0 border-t border-slate-700/50" />

        {/* Action area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!selectedPlayer ? (
            <div className="flex items-center justify-center h-full min-h-[60px]">
              <span className="text-slate-600 text-sm">{hasRotation ? t('tapPlayerToLog') : ''}</span>
            </div>
          ) : (
            <>
              {/* Selected player chip */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/40 bg-blue-900/20">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-700 border border-blue-500 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                    {selectedPlayer.number}
                  </div>
                  <span className="text-blue-200 text-sm font-semibold">{selectedPlayer.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${appMode === 'game' ? 'bg-blue-800 text-blue-300' : 'bg-purple-800 text-purple-300'}`}>
                    {t(appMode === 'game' ? 'gameModeShort' : 'coachModeShort')}
                  </span>
                </div>
                <button
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none px-1 transition-colors"
                  onClick={() => { dispatch({ type: 'DESELECT_PLAYER' }); clearFlow(); }}
                >
                  ✕
                </button>
              </div>
              <InlineActionArea />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 flex flex-col overflow-hidden" style={{ height: '100dvh' }}>

      <ScoreHeader />

      {/* Control bar */}
      <div className="flex-shrink-0 bg-slate-900/95 border-b border-slate-700/60 flex items-center px-2 py-1.5 gap-2" dir="ltr">
        {!showEndSetConfirm ? (
          <>
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
            <button
              className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black text-sm transition-all shadow-md shadow-orange-900/40"
              onClick={() => setShowEndSetConfirm(true)}
            >
              {t('endSet')} {currentMatch.currentSetIndex + 1}
            </button>
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <button
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 border border-slate-500 text-slate-200 font-bold text-xs transition-all"
                onClick={() => setShowEventLog(true)}
              >
                <List size={12} />
                {t('logTab')}
              </button>
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
                onClick={handleEndMatch}
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
            <button className="flex-shrink-0 py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-black transition-colors" onClick={handleEndSet}>
              {t('confirm')}
            </button>
            <button className="flex-shrink-0 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors" onClick={() => setShowEndSetConfirm(false)}>
              {t('cancel')}
            </button>
          </>
        )}
      </div>

      {/* Last event bar — flashes green after each logged event */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 border-b border-slate-700/30 overflow-hidden">
        {/* Last event text */}
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden" dir="rtl">
          <span className="text-slate-600 text-[9px] flex-shrink-0">↳</span>
          <span className={`text-[10px] truncate transition-colors duration-300 ${eventFlash ? 'text-green-400 font-semibold' : 'text-slate-400'}`}>
            {lastEvent
              ? [lastEventPlayerName, lastEventLabel].filter(Boolean).join(' — ')
              : t('noEventsYet')}
          </span>
        </div>
        {/* Timestamp */}
        {lastEvent && (
          <span className="text-slate-600 font-mono text-[9px] flex-shrink-0">
            {new Date(lastEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            {lastEvent.homeScore != null ? ` · ${lastEvent.homeScore}-${lastEvent.opponentScore}` : ''}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <UnifiedCourtAndActions />
      </div>

      {/* Bottom nav */}
      <div className="flex border-t border-slate-700 bg-slate-900 flex-shrink-0 gap-1.5 px-2 py-1.5">
        <button className="btn-3d btn-3d-nav flex-1 py-2.5 gap-1 text-sm font-semibold" onClick={() => navigate(VIEWS.HOME)}>
          <ArrowLeft size={16} /> {t('home')}
        </button>
        <button className="btn-3d btn-3d-blue flex-1 py-2.5 gap-1 text-sm font-semibold" onClick={() => navigate(VIEWS.STATS)}>
          <BarChart2 size={16} /> {t('stats')}
        </button>
        <button className="btn-3d btn-3d-nav flex-1 py-2.5 gap-1 text-sm font-semibold" onClick={() => dispatch({ type: 'SHOW_HEATMAP' })}>
          <Layers size={16} /> {t('heatmap')}
        </button>
      </div>

      {/* Full-screen modals */}
      {showSubstitution && <SubstitutionModal onClose={() => dispatch({ type: 'HIDE_SUBSTITUTION' })} />}
      {showCourtDraw && <CourtDrawModal />}
      {showHeatmap && <HeatmapModal />}
      {needsServeSetup && <ServeSetupModal />}
      {!needsServeSetup && (showRotationSetup || needsRotationSetup) && (
        <RotationSetupModal onClose={handleRotationSetupClose} />
      )}

      {/* Event log panel (slide-up) */}
      {showEventLog && <EventLogPanel />}
    </div>
  );
}
