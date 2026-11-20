import { useState } from 'react';
import { X, Pencil, UserPlus, UserX, UserCheck, Trash2, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { POSITIONS } from '../../utils/constants';
import {
  isPlayerReferenced, isPlayerOnCourt, findDuplicateNumber,
  findSavedHomeTeam, findTeamPlayer, toTeamPlayer,
} from '../../utils/roster';

const EMPTY_FORM = { mode: 'add', playerId: null, number: '', name: '', position: '' };

export default function RosterEditModal({ onClose }) {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { currentMatch, savedTeams } = state;

  const [form, setForm]               = useState(null);   // null | EMPTY_FORM-shaped
  const [formError, setFormError]     = useState('');
  const [saveToTeam, setSaveToTeam]   = useState(false);
  const [teamConfirm, setTeamConfirm] = useState(null);   // { player } awaiting "add to team?" answer
  const [rowNotice, setRowNotice]     = useState(null);   // { id, key } inline refusal message
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  if (!currentMatch) return null;

  const players  = currentMatch.homeTeam.players;
  const active   = players.filter(p => !p.inactive);
  const inactive = players.filter(p => p.inactive);
  const savedTeam = findSavedHomeTeam(savedTeams, currentMatch.homeTeam.name);

  const dupes = form ? findDuplicateNumber(players, form.number, form.playerId) : [];

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setFormError(''); setSaveToTeam(false); setRowNotice(null); setConfirmRemoveId(null);
  }

  function openEdit(p) {
    setForm({ mode: 'edit', playerId: p.id, number: String(p.number ?? ''), name: p.name, position: p.position || '' });
    setFormError(''); setSaveToTeam(false); setRowNotice(null); setConfirmRemoveId(null);
  }

  function upsertTeamPlayers(teamPlayers) {
    dispatch({ type: 'UPSERT_TEAM', team: { ...savedTeam, players: teamPlayers } });
  }

  function handleSave() {
    const number = form.number.trim();
    const name   = form.name.trim();
    if (!number || !name) { setFormError(t('errNameNumberRequired')); return; }
    const fields = { number, name, position: form.position };
    const withTeam = saveToTeam && savedTeam;

    if (form.mode === 'add') {
      const player = { id: uuidv4(), ...fields };
      // Same number + name already in the team → link to it (keeping its position if none was picked)
      const existing = withTeam ? findTeamPlayer(savedTeam, player) : null;
      if (existing) {
        player.teamPlayerId = existing.id;
        if (player.position && player.position !== existing.position) {
          upsertTeamPlayers(savedTeam.players.map(tp => tp.id === existing.id ? toTeamPlayer(player, existing.id) : tp));
        }
      }
      dispatch({ type: 'ADD_PLAYER_TO_MATCH', player });
      // Not in the team yet — ask before adding, so near-duplicates aren't created silently
      if (withTeam && !existing) setTeamConfirm({ player });
      setForm(null);
      return;
    }

    const original = players.find(p => p.id === form.playerId);
    if (!original) { setForm(null); return; }
    dispatch({ type: 'UPDATE_MATCH_PLAYER', playerId: original.id, changes: fields });

    if (withTeam) {
      const tp = findTeamPlayer(savedTeam, original);
      if (tp) {
        upsertTeamPlayers(savedTeam.players.map(x => x.id === tp.id ? toTeamPlayer(fields, tp.id) : x));
        if (original.teamPlayerId !== tp.id) {
          dispatch({ type: 'UPDATE_MATCH_PLAYER', playerId: original.id, changes: { teamPlayerId: tp.id } });
        }
      } else {
        // No link and no number+name match — ask before creating a possible duplicate
        setTeamConfirm({ player: { ...original, ...fields } });
      }
    }
    setForm(null);
  }

  function confirmAddToTeam() {
    if (!savedTeam) { setTeamConfirm(null); return; }
    const { player } = teamConfirm;
    const teamId = uuidv4();
    upsertTeamPlayers([...savedTeam.players, toTeamPlayer(player, teamId)]);
    dispatch({ type: 'UPDATE_MATCH_PLAYER', playerId: player.id, changes: { teamPlayerId: teamId } });
    setTeamConfirm(null);
  }

  function handleDeactivate(p) {
    setConfirmRemoveId(null);
    if (isPlayerOnCourt(currentMatch, p.id)) { setRowNotice({ id: p.id, key: 'cannotDeactivateOnCourt' }); return; }
    setRowNotice(null);
    dispatch({ type: 'SET_MATCH_PLAYER_ACTIVE', playerId: p.id, active: false });
  }

  function handleRemove(p) {
    if (isPlayerReferenced(currentMatch, p.id)) {
      setConfirmRemoveId(null);
      setRowNotice({ id: p.id, key: 'removeBlockedHasHistory' });
      return;
    }
    setRowNotice(null);
    if (confirmRemoveId !== p.id) { setConfirmRemoveId(p.id); return; }
    dispatch({ type: 'REMOVE_MATCH_PLAYER', playerId: p.id });
    setConfirmRemoveId(null);
  }

  function renderPlayerRow(p) {
    const onCourt    = isPlayerOnCourt(currentMatch, p.id);
    const referenced = isPlayerReferenced(currentMatch, p.id);
    return (
      <div key={p.id} className="py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${p.inactive ? 'bg-slate-700 text-slate-500' : 'bg-slate-600 text-white'}`} dir="ltr">
            {p.number}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-medium truncate ${p.inactive ? 'text-slate-500' : 'text-white'}`}>{p.name}</div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {p.position && <span className="text-slate-400">{p.position}</span>}
              {onCourt && <span className="px-1.5 rounded bg-green-900/60 text-green-300 font-semibold">{t('onCourtLabel')}</span>}
              {p.inactive && <span className="px-1.5 rounded bg-slate-700 text-slate-400 font-semibold">{t('inactiveLabel')}</span>}
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-blue-900 flex items-center justify-center transition-colors flex-shrink-0"
            onClick={() => openEdit(p)}
            title={t('editPlayer')}
          >
            <Pencil size={14} className="text-slate-300" />
          </button>
          {p.inactive ? (
            <button
              className="h-8 px-2 rounded-lg bg-green-900/40 border border-green-800 text-green-300 text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:bg-green-900/70 transition-colors"
              onClick={() => { setRowNotice(null); dispatch({ type: 'SET_MATCH_PLAYER_ACTIVE', playerId: p.id, active: true }); }}
            >
              <UserCheck size={13} /> {t('reactivate')}
            </button>
          ) : (
            <button
              className={`h-8 px-2 rounded-lg border text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 transition-colors ${
                onCourt
                  ? 'bg-slate-800 border-slate-700 text-slate-600'
                  : 'bg-amber-900/30 border-amber-800 text-amber-300 hover:bg-amber-900/60'
              }`}
              onClick={() => handleDeactivate(p)}
            >
              <UserX size={13} /> {t('markInactive')}
            </button>
          )}
          <button
            className={`h-8 rounded-lg flex items-center justify-center gap-1 transition-colors flex-shrink-0 ${
              confirmRemoveId === p.id
                ? 'px-2 bg-red-700 text-white text-[11px] font-semibold'
                : referenced
                ? 'w-8 bg-slate-800 border border-slate-700'
                : 'w-8 bg-slate-700 hover:bg-red-900'
            }`}
            onClick={() => handleRemove(p)}
            title={t('removePlayer')}
          >
            <Trash2 size={14} className={confirmRemoveId === p.id ? 'text-white' : referenced ? 'text-slate-600' : 'text-slate-400'} />
            {confirmRemoveId === p.id && t('confirm')}
          </button>
        </div>
        {confirmRemoveId === p.id && (
          <div className="mt-1.5 text-[11px] text-red-300">{t('confirmRemovePlayer', { name: p.name })}</div>
        )}
        {rowNotice?.id === p.id && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-300">
            <AlertTriangle size={12} className="flex-shrink-0" /> {t(rowNotice.key)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl w-full max-w-lg p-5 animate-slide-up border-t border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-bold text-lg">{t('editRoster')}</h3>
          <button className="text-slate-400 hover:text-white" onClick={onClose}><X size={22} /></button>
        </div>
        <p className="text-slate-500 text-xs mb-4">{t('newPlayersStartOnBench')}</p>

        {/* "Add to team?" confirmation for players with no saved-team match */}
        {teamConfirm && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 mb-4">
            <div className="text-amber-200 text-sm mb-3">
              {t('confirmAddToTeam', { name: `#${teamConfirm.player.number} ${teamConfirm.player.name}`, team: savedTeam?.name ?? '' })}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors" onClick={confirmAddToTeam}>
                {t('addToTeamBtn')}
              </button>
              <button className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors" onClick={() => setTeamConfirm(null)}>
                {t('skipTeamBtn')}
              </button>
            </div>
          </div>
        )}

        {/* Add / edit form */}
        {form ? (
          <div className="bg-slate-700/60 rounded-xl border border-slate-600 p-3 mb-4">
            <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
              {form.mode === 'add' ? t('addNewPlayer') : t('editPlayer')}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center"
                type="number"
                dir="ltr"
                placeholder="#"
                min="1" max="99"
                value={form.number}
                onChange={e => { setForm(f => ({ ...f, number: e.target.value })); setFormError(''); }}
              />
              <input
                className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                placeholder={t('playerName')}
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(''); }}
              />
              <select
                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-slate-300 text-sm"
                value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              >
                <option value="">{t('positionShort')}</option>
                {Object.values(POSITIONS).map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>

            {dupes.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 mb-2">
                <AlertTriangle size={12} className="flex-shrink-0" />
                {t('duplicateNumberWarn', { num: form.number.trim(), names: dupes.map(p => p.name).join(', ') })}
              </div>
            )}
            {formError && <div className="text-[11px] text-red-400 mb-2">{formError}</div>}

            {savedTeam && (
              <label className="flex items-center gap-2 text-xs text-slate-300 mb-3 cursor-pointer">
                <input type="checkbox" checked={saveToTeam} onChange={e => setSaveToTeam(e.target.checked)} />
                {t('alsoSaveToTeam', { team: savedTeam.name })}
              </label>
            )}

            <div className="flex gap-2">
              <button
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  form.number.trim() && form.name.trim()
                    ? 'bg-blue-700 hover:bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
                onClick={handleSave}
                disabled={!form.number.trim() || !form.name.trim()}
              >
                {form.mode === 'add' ? t('add') : t('save')}
              </button>
              <button className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm transition-colors" onClick={() => setForm(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-4 text-blue-400 text-sm border border-dashed border-blue-800 rounded-xl hover:border-blue-500 hover:text-blue-300 transition-colors"
            onClick={openAdd}
          >
            <UserPlus size={15} /> {t('addNewPlayer')}
          </button>
        )}

        <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">
          {t('rosterActive')} ({active.length})
        </div>
        <div className="mb-4">
          {active.map(renderPlayerRow)}
        </div>

        {inactive.length > 0 && (
          <>
            <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">
              {t('rosterInactive')} ({inactive.length})
            </div>
            <div>
              {inactive.map(renderPlayerRow)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
