import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, RotateCcw } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Court layout viewed from the coach's sideline (home team faces up toward net).
 *
 * Volleyball positions (standard):
 *   Front row (near net): P4 (left)  P3 (middle)  P2 (right)
 *   Back  row (near end): P5 (left)  P6 (middle)  P1 (right, SERVER)
 */
const LAYOUT = [
  [4, 0, 0], [3, 0, 1], [2, 0, 2],
  [5, 1, 0], [6, 1, 1], [1, 1, 2],
];

export default function RotationView() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  const [animPhase, setAnimPhase] = useState('idle');
  const prevVersionRef = useRef(null);
  const timerRef = useRef(null);

  if (!currentMatch) return null;

  const currentSet = currentMatch.sets[currentMatch.currentSetIndex];
  const rotation = currentSet.rotation;
  const players = currentMatch.homeTeam.players;
  const rotVersion = currentMatch.rotationVersion ?? 0;
  const rotIdx = currentMatch.currentRotationIndex;
  const canUndoRotation = (currentMatch.rotationHistory || []).length > 0;

  useEffect(() => {
    if (prevVersionRef.current === null) {
      prevVersionRef.current = rotVersion;
      return;
    }
    if (rotVersion !== prevVersionRef.current) {
      prevVersionRef.current = rotVersion;
      clearTimeout(timerRef.current);
      setAnimPhase('flash');
      timerRef.current = setTimeout(() => {
        setAnimPhase('settle');
        timerRef.current = setTimeout(() => setAnimPhase('idle'), 500);
      }, 250);
    }
    return () => clearTimeout(timerRef.current);
  }, [rotVersion]);

  function getPlayerAtPos(pos) {
    const id = rotation[pos - 1];
    return players.find(p => p.id === id) ?? null;
  }

  const isAnimating = animPhase !== 'idle';

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/60 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            {t('rotationLabel')} {rotIdx + 1}
          </span>
          {isAnimating && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              animPhase === 'flash'
                ? 'bg-blue-500 text-white animate-pulse'
                : 'bg-blue-900 text-blue-300'
            }`}>
              ↺ {t('sideOut')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              canUndoRotation
                ? 'bg-amber-900/70 border border-amber-700 text-amber-300 hover:bg-amber-800 active:scale-95'
                : 'bg-slate-700/40 border border-slate-700 text-slate-600 cursor-not-allowed'
            }`}
            onClick={() => canUndoRotation && dispatch({ type: 'UNDO_ROTATION' })}
            disabled={!canUndoRotation}
          >
            <RotateCcw size={11} /> {t('undoRotation')}
          </button>
          <button
            className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-blue-800 active:bg-blue-900 px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-slate-600"
            onClick={() => dispatch({ type: 'MANUAL_ROTATE' })}
          >
            <RotateCw size={11} /> {t('rotateBtn')}
          </button>
        </div>
      </div>

      {/* Court */}
      <div className="p-2.5">
        {/* Net */}
        <div className="flex items-center gap-2 mb-2" dir="ltr">
          <div className="flex-1 h-0.5 bg-yellow-500/50 rounded" />
          <span className="text-[10px] font-bold text-yellow-500/70 tracking-widest uppercase">{t('netLabel')}</span>
          <div className="flex-1 h-0.5 bg-yellow-500/50 rounded" />
        </div>

        {/* 2 × 3 position grid — always LTR, court layout is physical not linguistic */}
        <div className="grid grid-rows-2 grid-cols-3 gap-2" dir="ltr">
          {LAYOUT.map(([pos]) => {
            const player = getPlayerAtPos(pos);
            const isServer = pos === 1;

            return (
              <div
                key={pos}
                className={`
                  relative rounded-xl text-center py-2 px-1 flex flex-col items-center justify-center
                  border-2 transition-all duration-300
                  ${isServer
                    ? 'bg-green-900/60 border-green-500 shadow-lg shadow-green-900/30'
                    : 'bg-slate-700/50 border-slate-600'}
                  ${isAnimating
                    ? animPhase === 'flash'
                      ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900 scale-105'
                      : 'ring-1 ring-blue-600'
                    : ''}
                `}
                style={{ minHeight: 72 }}
              >
                {/* Server badge */}
                {isServer && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight shadow-md">
                      🏐 SERVE
                    </div>
                  </div>
                )}

                <div className={`text-[9px] font-semibold mt-1 ${isServer ? 'text-green-400' : 'text-slate-500'}`}>
                  P{pos}
                </div>

                {player ? (
                  <>
                    <div className={`font-black text-xl leading-none mt-0.5 ${isServer ? 'text-green-300' : 'text-white'}`}>
                      {player.number}
                    </div>
                    <div className={`text-[10px] mt-0.5 truncate w-full text-center leading-tight ${isServer ? 'text-green-400/80' : 'text-slate-400'}`}>
                      {player.name.split(' ')[0]}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-600 text-sm mt-1">—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rotation rule reminder */}
        <div className="mt-2.5 bg-slate-900/40 rounded-lg px-3 py-1.5">
          <div className="text-[10px] text-slate-600 text-center leading-relaxed">
            {t('rotationRule')}
          </div>
        </div>
      </div>
    </div>
  );
}
