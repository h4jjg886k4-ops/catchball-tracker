import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { saveTeamFS } from '../utils/firestore';
import { POSITIONS, VIEWS } from '../utils/constants';

const POSITION_LIST = Object.values(POSITIONS);

// ── Player row for home team (has position select) ────────────────────────
function PlayerRow({ player, onUpdate, onRemove, t }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-700/50">
      <input
        type="number"
        placeholder="#"
        value={player.number}
        onChange={e => onUpdate({ ...player, number: e.target.value })}
        className="w-14 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-center text-white font-bold text-lg focus:outline-none focus:border-blue-500"
        min="1" max="99"
      />
      <input
        type="text"
        placeholder={t('playerName')}
        value={player.name}
        onChange={e => onUpdate({ ...player, name: e.target.value })}
        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
      />
      <select
        value={player.position}
        onChange={e => onUpdate({ ...player, position: e.target.value })}
        className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
      >
        <option value="">{t('positionShort')}</option>
        {POSITION_LIST.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button
        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-900 flex items-center justify-center transition-colors flex-shrink-0"
        onClick={() => onRemove(player.id)}
      >
        <Trash2 size={14} className="text-slate-400" />
      </button>
    </div>
  );
}

// ── Player row for opponent team (no position) ────────────────────────────
function OppPlayerRow({ player, onUpdate, onRemove, t }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-700/50">
      <input
        type="number"
        placeholder="#"
        value={player.number}
        onChange={e => onUpdate({ ...player, number: e.target.value })}
        className="w-14 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-center text-white font-bold text-lg focus:outline-none focus:border-blue-500"
        min="1" max="99"
      />
      <input
        type="text"
        placeholder={t('nameOptional')}
        value={player.name}
        onChange={e => onUpdate({ ...player, name: e.target.value })}
        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
      />
      <button
        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-900 flex items-center justify-center transition-colors flex-shrink-0"
        onClick={() => onRemove(player.id)}
      >
        <Trash2 size={14} className="text-slate-400" />
      </button>
    </div>
  );
}

// ── Saved teams panel ─────────────────────────────────────────────────────
function SavedTeamsPanel({ type, accentColor, onLoad, t }) {
  const { state, dispatch } = useMatch();
  const [open, setOpen] = useState(false);

  const teams = state.savedTeams.filter(s => s.type === type);

  function handleDelete(teamId) {
    dispatch({ type: 'DELETE_TEAM_FROM_STATE', teamId });
  }

  const accent = accentColor === 'red'
    ? { border: 'border-red-900', text: 'text-red-400', bg: 'bg-red-900/20', btnBorder: 'border-red-800', btnHover: 'hover:bg-red-900/40' }
    : { border: 'border-blue-900', text: 'text-blue-400', bg: 'bg-blue-900/20', btnBorder: 'border-blue-800', btnHover: 'hover:bg-blue-900/40' };

  return (
    <div className={`rounded-xl border ${accent.border} ${accent.bg} mb-4 overflow-hidden`}>
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={15} className={accent.text} />
          <span className={`text-sm font-semibold ${accent.text}`}>{t('savedTeams')}</span>
          <span className="text-xs text-slate-500">({teams.length})</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-slate-700/50 px-3 pb-3 pt-2 space-y-2">
          {teams.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-3">{t('noSavedTeams')}</div>
          ) : teams.map(team => (
            <div
              key={team.id}
              className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">{team.name}</div>
                <div className="text-slate-500 text-xs">{t('savedPlayersCount', { n: team.players.length })}</div>
              </div>
              <button
                className={`px-3 py-1.5 rounded-lg border ${accent.btnBorder} ${accent.text} text-xs font-semibold ${accent.btnHover} transition-colors`}
                onClick={() => { onLoad(team); setOpen(false); }}
              >
                {t('loadTeam')}
              </button>
              <button
                className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-900 flex items-center justify-center transition-colors flex-shrink-0"
                onClick={() => handleDelete(team.id)}
              >
                <Trash2 size={13} className="text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Save Team button ─────────────────────────────────────────────────────
function SaveTeamButton({ teamName, players, type, isHome, t }) {
  const { state, dispatch } = useMatch();
  const { user } = useAuth();
  const [flash, setFlash]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const validPlayers = players.filter(p => isHome ? (p.name?.trim() && p.number) : p.number);
  const canSave = teamName.trim() && validPlayers.length > 0;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaveErr(null);
    setSaving(true);

    const existing = state.savedTeams.find(
      s => s.type === type && s.name.toLowerCase() === teamName.trim().toLowerCase()
    );
    const teamEntry = {
      id: existing?.id || uuidv4(),
      name: teamName.trim(),
      players: validPlayers.map(p => ({ ...p })),
      type,
      savedAt: Date.now(),
    };

    try {
      if (user) await saveTeamFS(user.uid, teamEntry);
      dispatch({ type: 'UPSERT_TEAM', team: teamEntry });
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
    } catch (err) {
      setSaveErr(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const color = isHome
    ? 'border-blue-800 text-blue-400 hover:bg-blue-900/30'
    : 'border-red-800 text-red-400 hover:bg-red-900/30';

  return (
    <div className="mt-3">
      <button
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
          flash
            ? 'border-green-700 text-green-400 bg-green-900/20'
            : canSave
            ? color
            : 'border-slate-700 text-slate-600 cursor-not-allowed'
        }`}
        onClick={handleSave}
        disabled={!canSave || saving}
      >
        {saving ? (
          <><Loader2 size={15} className="animate-spin" /> {t('saving') || 'Saving…'}</>
        ) : flash ? (
          <><Check size={15} /> {t('teamSaved')}</>
        ) : (
          <><Save size={15} /> {t('saveTeam')}</>
        )}
      </button>
      {saveErr && (
        <div className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs">
          <AlertCircle size={12} /> {saveErr}
        </div>
      )}
    </div>
  );
}

// ── Main SetupPage ────────────────────────────────────────────────────────
export default function SetupPage() {
  const { dispatch, navigate } = useMatch();
  const { t } = useLanguage();

  const [homeTeamName, setHomeTeamName] = useState('');
  const [oppTeamName,  setOppTeamName]  = useState('');
  const [players,    setPlayers]    = useState([{ id: uuidv4(), name: '', number: '1', position: '' }]);
  const [oppPlayers, setOppPlayers] = useState([{ id: uuidv4(), name: '', number: '1' }]);
  const [tab,   setTab]   = useState('home');
  const [error, setError] = useState('');

  // ── Home team handlers ──────────────────────────────────────────────────
  function addPlayer()           { setPlayers(prev => [...prev, { id: uuidv4(), name: '', number: String(prev.length + 1), position: '' }]); }
  function updatePlayer(updated) { setPlayers(prev => prev.map(p => p.id === updated.id ? updated : p)); }
  function removePlayer(id)      { setPlayers(prev => prev.filter(p => p.id !== id)); }

  function loadHomeTeam(team) {
    setHomeTeamName(team.name);
    setPlayers(team.players.map(p => ({ ...p, id: uuidv4() })));
    setError('');
  }

  // ── Opponent handlers ───────────────────────────────────────────────────
  function addOppPlayer()            { setOppPlayers(prev => [...prev, { id: uuidv4(), name: '', number: String(prev.length + 1) }]); }
  function updateOppPlayer(updated)  { setOppPlayers(prev => prev.map(p => p.id === updated.id ? updated : p)); }
  function removeOppPlayer(id)       { setOppPlayers(prev => prev.filter(p => p.id !== id)); }

  function loadOppTeam(team) {
    setOppTeamName(team.name);
    setOppPlayers(team.players.map(p => ({ ...p, id: uuidv4() })));
    setError('');
  }

  // ── Start match ─────────────────────────────────────────────────────────
  function handleStart() {
    if (!homeTeamName.trim()) { setError(t('errEnterTeamName')); setTab('home'); return; }
    if (!oppTeamName.trim())  { setError(t('errEnterOppName'));  setTab('opponent'); return; }
    const validPlayers = players.filter(p => p.name.trim() && p.number);
    if (validPlayers.length === 0) { setError(t('errAddPlayer')); setTab('home'); return; }

    dispatch({
      type: 'SETUP_COMPLETE',
      homeTeam: {
        name: homeTeamName.trim(),
        players: validPlayers.map(p => ({ ...p, name: p.name.trim() })),
      },
      opponentTeam: {
        name: oppTeamName.trim(),
        players: oppPlayers.filter(p => p.number).map(p => ({ ...p, name: (p.name || '').trim() })),
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <button
          className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          onClick={() => navigate(VIEWS.HOME)}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-white font-bold text-xl">{t('matchSetup')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <button
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'home' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setTab('home')}
        >
          {t('myTeam')}
        </button>
        <button
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'opponent' ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setTab('opponent')}
        >
          {t('opponent')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ── My Team tab ──────────────────────────────────────────────── */}
        {tab === 'home' && (
          <div className="animate-fade-in">
            <SavedTeamsPanel type="home" accentColor="blue" onLoad={loadHomeTeam} t={t} />

            {/* Team name */}
            <div className="mb-5">
              <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-2">
                {t('teamName')}
              </label>
              <input
                type="text"
                placeholder={t('yourTeamName')}
                value={homeTeamName}
                onChange={e => { setHomeTeamName(e.target.value); setError(''); }}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Player list */}
            <div className="mb-1">
              <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-3">
                {t('players')} ({players.filter(p => p.name && p.number).length})
              </label>
              <div className="bg-slate-800 rounded-xl border border-slate-700 px-3 divide-y divide-slate-700/50">
                {players.map(player => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    onUpdate={updated => { updatePlayer(updated); setError(''); }}
                    onRemove={removePlayer}
                    t={t}
                  />
                ))}
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                  onClick={addPlayer}
                >
                  <Plus size={16} /> {t('addPlayer')}
                </button>
              </div>
            </div>

            <SaveTeamButton teamName={homeTeamName} players={players} type="home" isHome t={t} />

            <button
              className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold transition-colors"
              onClick={() => setTab('opponent')}
            >
              {t('nextOpponent')} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Opponent tab ─────────────────────────────────────────────── */}
        {tab === 'opponent' && (
          <div className="animate-fade-in">
            <SavedTeamsPanel type="opponent" accentColor="red" onLoad={loadOppTeam} t={t} />

            {/* Team name */}
            <div className="mb-5">
              <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-2">
                {t('teamName')}
              </label>
              <input
                type="text"
                placeholder={t('opponentTeamName')}
                value={oppTeamName}
                onChange={e => { setOppTeamName(e.target.value); setError(''); }}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Player list */}
            <div className="mb-1">
              <label className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-3">
                {t('opponentPlayersOpt')}
              </label>
              <div className="bg-slate-800 rounded-xl border border-slate-700 px-3 divide-y divide-slate-700/50">
                {oppPlayers.map(player => (
                  <OppPlayerRow
                    key={player.id}
                    player={player}
                    onUpdate={updateOppPlayer}
                    onRemove={removeOppPlayer}
                    t={t}
                  />
                ))}
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                  onClick={addOppPlayer}
                >
                  <Plus size={16} /> {t('addPlayer')}
                </button>
              </div>
            </div>

            <SaveTeamButton teamName={oppTeamName} players={oppPlayers} type="opponent" isHome={false} t={t} />

            <button
              className="w-full mt-6 py-4 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-xl transition-colors active:scale-98 shadow-lg shadow-green-900/40"
              onClick={handleStart}
            >
              {t('startMatch')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
