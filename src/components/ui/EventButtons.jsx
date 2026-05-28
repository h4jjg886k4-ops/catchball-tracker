import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, RotateCcw } from 'lucide-react';
import { EVENT_TYPES as T, EVENT_CONFIG } from '../../utils/constants';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { EVENT_TYPE_I18N_KEY } from '../../i18n/translations';


const SCORE_PILL = {
  '+1': 'bg-green-500 text-white',
  '-1': 'bg-red-500   text-white',
};

// section id → translation key
const CAT_KEY = {
  serve:   'catServe',
  attack:  'catAttack',
  defense: 'catDefense',
  setting: 'catSetting',
  other:   'catOther',
};

// ─── section data ────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'serve',
    accent: 'text-sky-400',
    divider: 'border-sky-900',
    cols: 3,
    types: [T.ACE, T.SERVE_IN, T.SERVE_ERROR],
  },
  {
    id: 'attack',
    accent: 'text-amber-400',
    divider: 'border-amber-900',
    cols: 2,
    sub: [
      { subKey: 'secondBall', types: [T.ATTACK_WIN_2ND, T.ATTACK_CONT_2ND] },
      { subKey: 'thirdBall',  types: [T.ATTACK_WIN_3RD, T.ATTACK_CONT_3RD] },
      { subKey: 'attackErr',  types: [T.ATTACK_OUT, T.ATTACK_BLOCKED] },
    ],
  },
  {
    id: 'defense',
    accent: 'text-teal-400',
    divider: 'border-teal-900',
    cols: 2,
    types: [T.BLOCK_TOUCH, T.BLOCK_MISTAKE, T.DEFENSE_ERROR],
  },
  {
    id: 'setting',
    accent: 'text-purple-400',
    divider: 'border-purple-900',
    cols: 2,
    types: [T.SET_SUCCESS, T.SET_ERROR],
  },
  {
    id: 'other',
    accent: 'text-slate-400',
    divider: 'border-slate-700',
    cols: 3,
    types: [T.BLOCK, T.OPPONENT_ERROR, T.FREE_BALL],
  },
];

// ─── single action button ────────────────────────────────────────────────────
function ActionBtn({ cfg, onPress }) {
  const { t } = useLanguage();
  const label = EVENT_TYPE_I18N_KEY[cfg.type] ? t(EVENT_TYPE_I18N_KEY[cfg.type]) : cfg.label;
  return (
    <button
      className={`btn-3d btn-3d-${cfg.color} relative flex flex-col items-center justify-center gap-1 px-2 py-4 text-center font-semibold touch-none select-none`}
      style={{ minHeight: 76 }}
      onClick={() => onPress(cfg.type)}
    >
      {cfg.score && (
        <span className={`absolute top-1.5 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${SCORE_PILL[cfg.score]}`}>
          {cfg.score}
        </span>
      )}
      <span className="text-2xl leading-none">{cfg.emoji}</span>
      <span className="text-xs leading-tight text-center px-1 break-words">{label}</span>
    </button>
  );
}

// ─── section header ──────────────────────────────────────────────────────────
function SectionHeader({ label, accent, divider }) {
  return (
    <div className={`flex items-center gap-3 mb-2 border-b pb-1 ${divider}`}>
      <span className={`text-xs font-black uppercase tracking-widest ${accent}`}>{label}</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function EventButtons() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { selectedPlayerId, currentMatch } = state;

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
  }

  function buildGrid(types, cols) {
    const configs = types.map(tp => EVENT_CONFIG.find(c => c.type === tp)).filter(Boolean);
    return (
      <div className="grid gap-2 mb-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {configs.map(cfg => <ActionBtn key={cfg.type} cfg={cfg} onPress={record} />)}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-900">

      {/* ── sticky top bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center gap-3">
        {/* player chip */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full bg-blue-800 border-2 border-blue-500 flex items-center justify-center text-xl font-black text-white flex-shrink-0">
            {player.number}
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-base leading-tight truncate">{player.name}</div>
            <div className="text-slate-400 text-xs">{player.position || t('player')}</div>
          </div>
        </div>

        {/* undo last */}
        <button
          className={`btn-3d flex items-center gap-1.5 px-3 py-2 text-sm font-semibold flex-shrink-0 ${
            lastEvent ? 'btn-3d-amber' : 'btn-3d-dark cursor-not-allowed'
          }`}
          onClick={() => lastEvent && dispatch({ type: 'UNDO_LAST_EVENT' })}
          disabled={!lastEvent}
        >
          <RotateCcw size={15} />
          {lastEvtCfg ? (
            <span className="max-w-[80px] truncate">{lastEvtCfg.emoji} {lastEvtLabel}</span>
          ) : (
            <span>{t('undoAction')}</span>
          )}
        </button>

        {/* cancel */}
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
        <span className="text-white font-black text-2xl tabular-nums">
          {currentSet.homeScore}
          <span className="text-slate-600 mx-2 font-light">–</span>
          {currentSet.opponentScore}
        </span>
        <span className="text-slate-400 text-xs">{currentMatch.opponentTeam.name}</span>
      </div>

      {/* ── scrollable action area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">

        {SECTIONS.map(section => (
          <div key={section.id}>
            <SectionHeader
              label={t(CAT_KEY[section.id])}
              accent={section.accent}
              divider={section.divider}
            />

            {section.sub ? (
              <div className="space-y-2">
                {section.sub.map(sg => (
                  <div key={sg.subKey}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5 px-0.5">
                      {t(sg.subKey)}
                    </div>
                    {buildGrid(sg.types, section.cols)}
                  </div>
                ))}
              </div>
            ) : (
              buildGrid(section.types, section.cols)
            )}
          </div>
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
}
