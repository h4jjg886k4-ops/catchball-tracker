import { useState } from 'react';
import { X, ArrowDown, AlertTriangle } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ReassignPlayerModal({ onClose }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const [fromId, setFromId] = useState('');
  const [toId, setToId]     = useState('');

  const match = state.currentMatch;
  if (!match) return null;

  const players = match.homeTeam.players;
  const actionCount = fromId
    ? match.sets.reduce((n, set) => n + set.events.filter(e => !e.isSubstitution && e.playerId === fromId).length, 0)
    : 0;
  const canConfirm = fromId && toId && fromId !== toId;

  function handleConfirm() {
    if (!canConfirm) return;
    dispatch({ type: 'REASSIGN_PLAYER_STATS', fromId, toId });
    onClose();
  }

  const playerLabel = p => `#${p.number} ${p.name}${p.inactive ? ` (${t('inactiveLabel')})` : ''}`;
  const selectCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 animate-slide-up border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">{t('reassignPlayer')}</h3>
          <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={22} /></button>
        </div>

        <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-1.5">{t('reassignFrom')}</label>
        <select className={selectCls} value={fromId} onChange={e => setFromId(e.target.value)}>
          <option value="">—</option>
          {players.map(p => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
        </select>
        {fromId && (
          <div className="text-slate-500 text-xs mt-1">{t('reassignActionCount', { n: actionCount })}</div>
        )}

        <div className="flex justify-center my-2 text-slate-500"><ArrowDown size={18} /></div>

        <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-1.5">{t('reassignTo')}</label>
        <select className={selectCls} value={toId} onChange={e => setToId(e.target.value)}>
          <option value="">—</option>
          {players.filter(p => p.id !== fromId).map(p => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
        </select>

        <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs leading-relaxed">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{t('reassignWarning')}</span>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
              canConfirm ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {t('confirm')}
          </button>
          <button className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
