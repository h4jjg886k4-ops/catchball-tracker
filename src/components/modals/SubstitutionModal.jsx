import React, { useState } from 'react';
import { X, ArrowLeftRight, UserPlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { POSITIONS } from '../../utils/constants';

export default function SubstitutionModal({ onClose }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  const [outPlayer, setOutPlayer] = useState(null);
  const [inPlayer, setInPlayer] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('');

  if (!currentMatch) return null;

  const players = currentMatch.homeTeam.players;
  const currentSet = currentMatch.sets[currentMatch.currentSetIndex];

  // Compute current on-court players by applying all subs to the starting rotation
  const rotationIds = currentSet.rotation.filter(id => id !== '');
  const hasRotation = rotationIds.length > 0;
  const currentOnCourt = new Set(rotationIds);
  for (const sub of currentSet.substitutions) {
    currentOnCourt.delete(sub.outPlayerId);
    currentOnCourt.add(sub.inPlayerId);
  }

  // If no rotation is set yet, fall back to showing all players in both columns
  const onCourtPlayers = hasRotation ? players.filter(p => currentOnCourt.has(p.id)) : players;
  const benchPlayers   = hasRotation ? players.filter(p => !currentOnCourt.has(p.id)) : players;
  const inList = benchPlayers.filter(p => p.id !== outPlayer?.id);

  function handleAddNewPlayer() {
    if (!newNum.trim() || !newName.trim()) return;
    dispatch({
      type: 'ADD_PLAYER_TO_MATCH',
      player: { id: uuidv4(), number: newNum.trim(), name: newName.trim(), position: newPos },
    });
    setNewNum('');
    setNewName('');
    setNewPos('');
    setShowAddForm(false);
  }

  function handleConfirm() {
    if (!outPlayer || !inPlayer) return;
    dispatch({ type: 'ADD_SUBSTITUTION', outPlayerId: outPlayer.id, inPlayerId: inPlayer.id });
    onClose();
  }

  function PlayerBtn({ p, selected, color, onClick }) {
    const colors = {
      red:   selected ? 'bg-red-900 border-red-600 text-white'   : 'bg-slate-700 border-slate-600 text-slate-200 hover:border-red-700',
      green: selected ? 'bg-green-900 border-green-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-200 hover:border-green-700',
    };
    return (
      <button
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${colors[color]}`}
        onClick={onClick}
      >
        <span className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {p.number}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{p.name}</div>
          <div className="text-xs text-slate-400">{p.position}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl w-full max-w-lg p-5 animate-slide-up border-t border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">{t('substitution')}</h3>
          <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={22} /></button>
        </div>

        <div className="flex gap-4 items-start mb-5">
          {/* OUT — on-court players only */}
          <div className="flex-1">
            <div className="text-red-400 text-xs uppercase tracking-wider mb-2 font-semibold">{t('playerOut')}</div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {onCourtPlayers.length === 0 ? (
                <div className="text-slate-500 text-xs py-3 text-center">{t('noCourtPlayers')}</div>
              ) : onCourtPlayers.map(p => (
                <PlayerBtn
                  key={p.id}
                  p={p}
                  selected={outPlayer?.id === p.id}
                  color="red"
                  onClick={() => {
                    setOutPlayer(p);
                    if (inPlayer?.id === p.id) setInPlayer(null);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pt-8">
            <ArrowLeftRight size={24} className="text-slate-500" />
          </div>

          {/* IN — bench players only */}
          <div className="flex-1">
            <div className="text-green-400 text-xs uppercase tracking-wider mb-2 font-semibold">{t('playerIn')}</div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {inList.length === 0 && (
                <div className="text-slate-500 text-xs py-3 text-center">{t('noBenchPlayers')}</div>
              )}
              {inList.map(p => (
                <PlayerBtn
                  key={p.id}
                  p={p}
                  selected={inPlayer?.id === p.id}
                  color="green"
                  onClick={() => setInPlayer(p)}
                />
              ))}
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2 text-blue-400 text-xs border border-dashed border-blue-800 rounded-lg hover:border-blue-500 hover:text-blue-300 transition-colors"
                onClick={() => setShowAddForm(v => !v)}
              >
                <UserPlus size={13} /> {t('addNewPlayer')}
              </button>
            </div>
          </div>
        </div>

        {/* Add new player inline form */}
        {showAddForm && (
          <div className="bg-slate-700/60 rounded-xl border border-slate-600 p-3 mb-4">
            <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">{t('addNewPlayer')}</div>
            <div className="flex gap-2 mb-2">
              <input
                className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center"
                type="number"
                placeholder="#"
                value={newNum}
                onChange={e => setNewNum(e.target.value)}
              />
              <input
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder={t('playerName')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-slate-300 text-sm"
                value={newPos}
                onChange={e => setNewPos(e.target.value)}
              >
                <option value="">{t('positionShort')}</option>
                {Object.values(POSITIONS).map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  newNum.trim() && newName.trim()
                    ? 'bg-blue-700 hover:bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
                onClick={handleAddNewPlayer}
                disabled={!newNum.trim() || !newName.trim()}
              >
                {t('add')}
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {(outPlayer || inPlayer) && (
          <div className="bg-slate-700 rounded-lg px-4 py-3 mb-4 text-sm text-center">
            <span className="text-red-300">{outPlayer ? `#${outPlayer.number} ${outPlayer.name}` : '?'}</span>
            {' '}→{' '}
            <span className="text-green-300">{inPlayer ? `#${inPlayer.number} ${inPlayer.name}` : '?'}</span>
          </div>
        )}

        <button
          className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all ${
            outPlayer && inPlayer
              ? 'bg-blue-700 hover:bg-blue-600 text-white active:scale-98'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
          onClick={handleConfirm}
          disabled={!outPlayer || !inPlayer}
        >
          {t('confirmSubstitution')}
        </button>

        {currentSet.substitutions.length > 0 && (
          <div className="mt-4">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-2">{t('thisSet')}</div>
            {currentSet.substitutions.map(sub => {
              const outP = players.find(p => p.id === sub.outPlayerId);
              const inP  = players.find(p => p.id === sub.inPlayerId);
              return (
                <div key={sub.id} className="text-xs text-slate-400 py-1 border-b border-slate-700">
                  #{outP?.number} {outP?.name} → #{inP?.number} {inP?.name}
                  <span className="text-slate-600 ml-2">{sub.homeScore}-{sub.opponentScore}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
