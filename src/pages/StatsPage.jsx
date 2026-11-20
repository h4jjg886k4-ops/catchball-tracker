import React, { useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, FileText, BarChart2, User, Layers, RotateCcw, Info, UserCog } from 'lucide-react';
import { useMatch } from '../context/MatchContext';
import { useLanguage } from '../context/LanguageContext';
import { VIEWS } from '../utils/constants';
import { calcPlayerStats, calcTeamStats, calcSetStats } from '../utils/stats';
import { exportToExcel, exportToPDF } from '../utils/export';
import AnalysisTab from './AnalysisTab';
import ReassignPlayerModal from '../components/modals/ReassignPlayerModal';

function StatBadge({ value, label, color = 'default', size = 'md' }) {
  const colorClass = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    default: 'text-white',
  }[color];
  return (
    <div className={`text-center ${size === 'lg' ? 'px-4 py-3' : 'px-3 py-2'}`}>
      <div className={`font-black tabular-nums ${size === 'lg' ? 'text-3xl' : 'text-xl'} ${colorClass}`}>
        {value ?? '—'}
      </div>
      <div className="text-slate-500 text-xs mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function SetCard({ set, setNum, players, t }) {
  const stats = calcSetStats(set);
  const setEvents = set.events || [];

  const topPlayers = players
    .map(p => ({ player: p, stats: calcPlayerStats(p.id, setEvents) }))
    .filter(({ stats }) => stats.totalEvents > 0)
    .sort((a, b) => b.stats.points - a.stats.points)
    .slice(0, 4);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Set header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${
        set.winner === 'home' ? 'bg-green-900/30 border-b border-green-800' : 'bg-red-900/20 border-b border-red-900'
      }`}>
        <span className="text-slate-300 font-semibold text-sm">{t('setLabel')} {setNum}</span>
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-xl tabular-nums">
            {set.homeScore} – {set.opponentScore}
          </span>
          {set.winner && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              set.winner === 'home' ? 'bg-green-700 text-green-200' : 'bg-red-800 text-red-200'
            }`}>
              {set.winner === 'home' ? t('win') : t('loss')}
            </span>
          )}
        </div>
      </div>

      {/* Team totals */}
      <div className="grid grid-cols-4 divide-x divide-slate-700 border-b border-slate-700">
        <StatBadge value={stats.aces} label={t('acesLabel')} color="green" />
        <StatBadge value={stats.attackKills} label={t('killsLabel')} color="blue" />
        <StatBadge value={stats.blocks} label={t('blocksLabel')} color="yellow" />
        <StatBadge value={stats.attackErrors + stats.serveErrors} label={t('errorsLabel')} color="red" />
      </div>

      {/* Per-player rows */}
      {topPlayers.length > 0 && (
        <div className="divide-y divide-slate-700/50">
          {topPlayers.map(({ player, stats: ps }) => (
            <div key={player.id} className="flex items-center gap-3 px-4 py-2">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {player.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{player.name}</div>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-green-400 font-bold text-sm">{ps.cardPoints}</div>
                  <div className="text-slate-600 text-[10px]">{t('cardPtsLabel')}</div>
                </div>
                <div>
                  <div className="text-blue-400 font-bold text-sm">{ps.cardAttacks}</div>
                  <div className="text-slate-600 text-[10px]">{t('cardAttLabel')}</div>
                </div>
                <div>
                  <div className="text-red-400 font-bold text-sm">{ps.cardMistakes}</div>
                  <div className="text-slate-600 text-[10px]">{t('cardErrLabel')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { state, dispatch, navigate } = useMatch();
  const { t } = useLanguage();
  const { currentMatch } = state;
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [selectedSetIdx, setSelectedSetIdx] = useState(null); // global set filter, null = all sets
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showReassign, setShowReassign] = useState(false);

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <BarChart2 size={48} className="text-slate-600 mx-auto mb-4" />
          <div className="text-slate-400 mb-4">{t('noMatchData')}</div>
          <button
            className="px-6 py-3 bg-blue-700 rounded-xl text-white"
            onClick={() => navigate(VIEWS.HOME)}
          >
            {t('goHome')}
          </button>
        </div>
      </div>
    );
  }

  const players = currentMatch.homeTeam.players;
  // Every tab reads from the globally selected set(s)
  const visibleSets = currentMatch.sets
    .map((set, idx) => ({ set, idx }))
    .filter(({ idx }) => selectedSetIdx === null || idx === selectedSetIdx);
  const filteredSets   = visibleSets.map(({ set }) => set);
  const filteredEvents = filteredSets.flatMap(s => s.events || []);
  const teamStats = calcTeamStats(filteredSets);

  const playerStatsList = players.map(p => ({
    player: p,
    stats: calcPlayerStats(p.id, filteredEvents),
  })).sort((a, b) => b.stats.points - a.stats.points);

  async function handleExportExcel() {
    setExporting(true);
    try { await exportToExcel(currentMatch); }
    catch (e) { console.error(e); alert('Export failed: ' + e.message); }
    finally { setExporting(false); }
  }

  async function handleExportPDF() {
    setExporting(true);
    try { await exportToPDF(currentMatch); }
    catch (e) { console.error(e); alert('Export failed: ' + e.message); }
    finally { setExporting(false); }
  }

  const tabs = [
    { id: 'overview',  labelKey: 'overview' },
    { id: 'players',   labelKey: 'players' },
    { id: 'sets',      labelKey: 'setStatsLabel' },
    { id: 'analysis',  labelKey: 'analysis' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 relative">
          <div className="flex items-center gap-3">
            <button
              className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
              onClick={() => navigate(currentMatch.status === 'completed' ? VIEWS.HOME : VIEWS.LIVE)}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="text-white font-bold text-sm">
                {currentMatch.homeTeam.name} {t('vs')} {currentMatch.opponentTeam.name}
              </div>
              <div className="text-slate-400 text-xs">{new Date(currentMatch.date).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentMatch.status === 'completed' && !showReopenConfirm && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800/60 hover:bg-amber-700/60 text-sm text-amber-300 transition-colors"
                onClick={() => setShowReopenConfirm(true)}
              >
                <RotateCcw size={14} /> {t('reopenMatch')}
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-green-800 text-sm text-white transition-colors"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              <FileSpreadsheet size={14} /> XLS
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-900 text-sm text-white transition-colors"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              <FileText size={14} /> PDF
            </button>
          </div>
          {/* Reopen confirmation inline */}
          {showReopenConfirm && (
            <div className="absolute top-full left-0 right-0 z-20 bg-slate-800 border border-amber-700/60 shadow-2xl p-4 mx-3 mt-1 rounded-xl">
              <p className="text-slate-300 text-sm mb-3">{t('reopenConfirm')}</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
                  onClick={() => { dispatch({ type: 'REOPEN_MATCH' }); setShowReopenConfirm(false); }}
                >
                  {t('yesReopen')}
                </button>
                <button
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                  onClick={() => setShowReopenConfirm(false)}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Score summary */}
        <div className="flex items-center justify-center gap-6 pb-4 px-4">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{currentMatch.homeTeam.name}</div>
            <div className="text-4xl font-black text-green-400 tabular-nums">
              {currentMatch.sets.filter(s => s.winner === 'home').length}
            </div>
          </div>
          <div className="text-slate-600 text-xl font-light">{t('setsWon')}</div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{currentMatch.opponentTeam.name}</div>
            <div className="text-4xl font-black text-red-400 tabular-nums">
              {currentMatch.sets.filter(s => s.winner === 'opponent').length}
            </div>
          </div>
        </div>
      </div>

      {/* Global set filter — applies to every tab */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-slate-800/30 border-b border-slate-700 flex-shrink-0">
        {[null, ...currentMatch.sets.map((_, i) => i)].map(idx => (
          <button
            key={idx ?? 'all'}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              selectedSetIdx === idx ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setSelectedSetIdx(idx)}
          >
            {idx === null ? t('allSets') : `${t('setLabel')} ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Overview tab */}
        {activeTab === 'overview' && teamStats && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 text-slate-300 font-semibold text-sm">
                {t('teamPerformance')}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-700">
                <StatBadge
                  value={teamStats.serveEffPct !== null
                    ? `${teamStats.serveEffPct}% (${teamStats.serveEffWins}/${teamStats.serveEffTotal})`
                    : '—'}
                  label={t('gainPointAfterServe')}
                  color="blue"
                  size="lg"
                />
                <StatBadge
                  value={teamStats.teamAttackPct !== null
                    ? `${teamStats.teamAttackPct}% (${teamStats.allAttackSuccess}/${teamStats.allAttackTotal})`
                    : '—'}
                  label={t('attackPctLabel')}
                  color="green"
                  size="lg"
                />
                <StatBadge
                  value={`${teamStats.aces}`}
                  label={t('acesLabel')}
                  color="yellow"
                  size="lg"
                />
              </div>
              <div className="grid grid-cols-3 divide-x divide-x-slate-700 border-t border-slate-700">
                <StatBadge
                  value={t('blocksTotalFmt', { total: teamStats.blockTouchesTotal, kills: teamStats.blocks })}
                  label={t('blocksLabel')}
                />
                <StatBadge value={teamStats.allAttackSuccess} label={t('killsLabel')} color="blue" />
                <StatBadge value={teamStats.serveErrors} label={t('srvLabel')} color="red" />
              </div>
            </div>

            {/* Rotation efficiency */}
            {teamStats.rotationEfficiency && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 text-slate-300 font-semibold text-sm flex items-center gap-2">
                  <Layers size={14} /> {t('rotEfficiency')}
                  <span className="text-slate-500 text-xs font-normal">({t('frontRowLabel')})</span>
                </div>
                <div className="px-4 py-2 border-b border-slate-700/60 flex items-start gap-1.5 text-slate-400 text-[11px] leading-snug">
                  <Info size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{t('rotEfficiencyInfo')}</span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {teamStats.rotationEfficiency.length === 0 && (
                    <div className="px-4 py-3 text-slate-600 text-xs">—</div>
                  )}
                  {teamStats.rotationEfficiency.map(rot => {
                    // Exactly the 3 front-row players (P4 / P3 / P2) for this combo
                    const names = rot.playerIds
                      .map(id => (id && players.find(p => p.id === id)?.name) || '—')
                      .join(' / ');
                    return (
                      <div key={rot.key} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="text-slate-500 text-xs font-bold w-6 flex-shrink-0">R{rot.position}</div>
                        <div className="flex-1 min-w-0 text-slate-300 text-xs truncate">{names}</div>
                        <div className={`font-bold text-sm tabular-nums flex-shrink-0 ${
                          rot.efficiency > 0 ? 'text-green-400' : rot.efficiency < 0 ? 'text-red-400' : 'text-slate-400'
                        }`} dir="ltr">
                          {rot.efficiency > 0 ? `+${rot.efficiency}` : rot.efficiency}
                        </div>
                        <div className="text-slate-500 text-xs tabular-nums flex-shrink-0" dir="ltr">
                          {rot.pct !== null ? `${rot.pct}%` : '—'} ({rot.won}/{rot.rallies})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top scorers */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 text-slate-300 font-semibold text-sm flex items-center gap-2">
                <User size={14} /> {t('topContributors')}
              </div>
              {playerStatsList.slice(0, 5).map(({ player, stats }) => (
                <div key={player.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {player.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{player.name}</div>
                    <div className="text-slate-500 text-xs">{player.position}</div>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div>
                      <div className="text-green-400 font-bold">{stats.points}</div>
                      <div className="text-slate-600 text-[10px]">{t('ptsLabel')}</div>
                    </div>
                    <div>
                      <div className="text-blue-400 font-bold">{stats.attackKills}</div>
                      <div className="text-slate-600 text-[10px]">{t('killsLabel')}</div>
                    </div>
                    <div>
                      <div className="text-red-400 font-bold">{stats.errors}</div>
                      <div className="text-slate-600 text-[10px]">{t('errorsLabel')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Players tab */}
        {activeTab === 'players' && (
          <div className="animate-fade-in space-y-3">
            <div className="flex justify-end">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                onClick={() => setShowReassign(true)}
              >
                <UserCog size={13} /> {t('reassignPlayer')}
              </button>
            </div>
            {playerStatsList.map(({ player, stats }) => (
              <div key={player.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
                  <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-lg font-black text-white">
                    {player.number}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold">{player.name}</div>
                    <div className="text-slate-400 text-xs">{player.position}</div>
                  </div>
                  <div className="text-green-400 text-2xl font-black">{stats.points}</div>
                  <div className="text-slate-500 text-xs">{t('ptsLabel')}</div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-700 border-b border-slate-700">
                  <StatBadge
                    value={stats.attackEfficiency !== null ? `${stats.attackEfficiency}%` : '—'}
                    label={t('attLabel')}
                    color={stats.attackEfficiency >= 40 ? 'green' : stats.attackEfficiency !== null && stats.attackEfficiency < 20 ? 'red' : 'default'}
                  />
                  <StatBadge value={stats.aces} label={t('acesLabel')} color="yellow" />
                  <StatBadge
                    value={stats.defensePct !== null ? `${stats.defensePct}%` : '—'}
                    label={t('defLabel')}
                    color="blue"
                  />
                  <StatBadge value={stats.blocks} label={t('blocksLabel')} color="blue" />
                </div>

                <div className="grid grid-cols-5 divide-x divide-slate-700">
                  <StatBadge value={stats.attackKills} label={t('killsLabel')} color="green" />
                  <StatBadge value={stats.attackOut} label={t('outLabel')} color="red" />
                  <StatBadge value={stats.attackBlocked} label={t('blkdLabel')} color="red" />
                  <StatBadge value={stats.serveErrors} label={t('srvLabel')} color="red" />
                  <StatBadge value={stats.defenseSuccess} label={t('digsLabel')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis tab */}
        {activeTab === 'analysis' && (
          <div className="animate-fade-in">
            <AnalysisTab currentMatch={currentMatch} selectedSetIdx={selectedSetIdx} t={t} />
          </div>
        )}

        {/* Sets tab */}
        {activeTab === 'sets' && (
          <div className="animate-fade-in space-y-3">
            {visibleSets.map(({ set, idx }) => (
              <SetCard key={idx} set={set} setNum={idx + 1} players={players} t={t} />
            ))}

            {visibleSets.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 text-slate-300 font-semibold text-sm">
                  {t('scoreProgression')}
                </div>
                <div className="p-4 space-y-3">
                  {visibleSets.map(({ set, idx: i }) => {
                    const total = Math.max(set.homeScore + set.opponentScore, 1);
                    const homePct = Math.round(set.homeScore / total * 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{t('setLabel')} {i + 1}</span>
                          <span>{set.homeScore} – {set.opponentScore}</span>
                        </div>
                        <div className="h-4 rounded-full bg-slate-700 overflow-hidden flex">
                          <div
                            className="h-full bg-green-600 transition-all duration-500"
                            style={{ width: `${homePct}%` }}
                          />
                          <div className="h-full flex-1 bg-red-700/60" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showReassign && <ReassignPlayerModal onClose={() => setShowReassign(false)} />}

      {/* Continue match button */}
      {currentMatch.status !== 'completed' && (
        <div className="p-4 border-t border-slate-700 flex-shrink-0">
          <button
            className="w-full py-3.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-lg transition-colors"
            onClick={() => navigate(VIEWS.LIVE)}
          >
            {t('backToLiveMatch')} →
          </button>
        </div>
      )}
    </div>
  );
}
