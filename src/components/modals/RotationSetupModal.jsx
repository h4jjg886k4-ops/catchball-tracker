import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { ROTATION_LAYOUT } from '../../utils/constants';

export default function RotationSetupModal({ onClose }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  if (!currentMatch) return null;

  const currentSet = currentMatch.sets[currentMatch.currentSetIndex];
  const players = currentMatch.homeTeam.players;

  const [rotation, setRotation] = useState(
    currentSet.rotation.length ? currentSet.rotation : Array(6).fill('')
  );
  const [selectedSlot, setSelectedSlot] = useState(null);

  function handleSlotClick(idx) {
    setSelectedSlot(idx);
  }

  function handlePlayerClick(playerId) {
    if (selectedSlot === null) return;
    const newRotation = [...rotation];
    const existingIdx = newRotation.indexOf(playerId);
    if (existingIdx >= 0 && existingIdx !== selectedSlot) {
      newRotation[existingIdx] = '';
    }
    newRotation[selectedSlot] = playerId;
    setRotation(newRotation);
    const nextEmpty = newRotation.findIndex((v, i) => i > selectedSlot && v === '');
    setSelectedSlot(nextEmpty >= 0 ? nextEmpty : null);
  }

  function handleSave() {
    dispatch({ type: 'SET_ROTATION', rotation });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl w-full max-w-lg pb-6 animate-slide-up border-t border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <h3 className="text-white font-bold text-lg">{t('setStartingRotation')}</h3>
          <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={22} /></button>
        </div>

        <div className="px-4 pt-4">
          <div className="text-slate-400 text-xs mb-3">
            {t('tapPosThenPlayer')}
          </div>

          {/* Court layout — always LTR, court positions are physical not linguistic */}
          <div className="bg-slate-900 rounded-xl p-3 mb-4 border border-slate-700" dir="ltr">
            <div className="text-center text-slate-500 text-xs mb-2">{t('courtNet')}</div>
            {ROTATION_LAYOUT.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-3 gap-2 mb-2">
                {row.map(pos => {
                  const idx = pos - 1;
                  const playerId = rotation[idx];
                  const player = players.find(p => p.id === playerId);
                  const isSelected = selectedSlot === idx;
                  return (
                    <button
                      key={pos}
                      className={`rounded-lg p-2 text-center border-2 transition-all min-h-[64px] ${
                        isSelected
                          ? 'border-blue-400 bg-blue-900/50'
                          : player
                          ? 'border-green-700 bg-green-900/20'
                          : 'border-slate-600 bg-slate-800 border-dashed'
                      }`}
                      onClick={() => handleSlotClick(idx)}
                    >
                      <div className="text-slate-400 text-[10px]">P{pos}{pos === 1 ? '★' : ''}</div>
                      {player ? (
                        <>
                          <div className="text-white font-bold text-sm">#{player.number}</div>
                          <div className="text-slate-300 text-[10px] truncate">{player.name.split(' ')[0]}</div>
                        </>
                      ) : (
                        <div className="text-slate-600 text-xs">{isSelected ? '← tap' : 'empty'}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Player list */}
          {selectedSlot !== null && (
            <div className="mb-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                Assign to P{selectedSlot + 1}:
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="rounded-lg p-2 border border-dashed border-slate-600 text-slate-500 text-xs hover:border-red-700 hover:text-red-400 transition-colors"
                  onClick={() => {
                    const newRotation = [...rotation];
                    newRotation[selectedSlot] = '';
                    setRotation(newRotation);
                  }}
                >
                  {t('clear')}
                </button>
                {players.map(p => {
                  const isAssigned = rotation.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      className={`rounded-lg p-2 border text-center transition-all ${
                        rotation[selectedSlot] === p.id
                          ? 'border-blue-500 bg-blue-900/40 text-white'
                          : isAssigned
                          ? 'border-green-700/50 bg-green-900/10 text-green-300 opacity-70'
                          : 'border-slate-600 bg-slate-700 text-white hover:border-blue-500'
                      }`}
                      onClick={() => handlePlayerClick(p.id)}
                    >
                      <div className="font-bold text-sm">#{p.number}</div>
                      <div className="text-xs truncate opacity-80">{p.name.split(' ')[0]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="w-full py-3.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold transition-colors"
            onClick={handleSave}
          >
            {t('saveRotation')}
          </button>
        </div>
      </div>
    </div>
  );
}
