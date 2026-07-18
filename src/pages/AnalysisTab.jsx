import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Brain, TrendingUp, AlertTriangle, Award, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  calcAdvancedPlayerStats, calcAdvancedTeamStats,
  calcMomentum, calcClutchStats, calcErrorByGameState,
  buildScoreTimeline, calcEventDistribution, fetchAIInsights,
} from '../utils/analysisStats';
import { EVENT_TYPE_I18N_KEY } from '../i18n/translations';
import { HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from '../utils/constants';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#f1f5f9',
  fontSize: 12,
  borderRadius: 8,
};

function pctStr(pct, num, den) {
  if (pct === null || !den) return '—';
  return `${pct}% (${num}/${den})`;
}

function scoreStr(s) {
  return s ? `${s.home}–${s.opp}` : '—';
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-blue-400" />}
        <span className="text-slate-200 font-semibold text-sm">{title}</span>
      </div>
      {action}
    </div>
  );
}

function MiniStat({ label, value, color = 'text-white', sub }) {
  return (
    <div className="text-center px-2 py-3">
      <div className={`font-black tabular-nums text-xl ${color}`}>{value ?? '—'}</div>
      <div className="text-slate-500 text-[10px] mt-0.5 leading-tight">{label}</div>
      {sub && <div className="text-slate-600 text-[10px]">{sub}</div>}
    </div>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────────
function SummaryCards({ currentMatch, teamStats, playerAdvancedMap, players, momentum, t }) {
  const setsWon  = currentMatch.sets.filter(s => s.winner === 'home').length;
  const setsLost = currentMatch.sets.filter(s => s.winner === 'opponent').length;

  const mvpEntry = players
    .map(p => ({ p, s: playerAdvancedMap[p.id] }))
    .filter(({ s }) => s && s.totalPoints > 0)
    .sort((a, b) => b.s.totalPoints - a.s.totalPoints)[0];

  const cards = [
    {
      label: t('finalScore'),
      value: `${setsWon}–${setsLost}`,
      sub: currentMatch.homeTeam.name,
      color: setsWon > setsLost ? 'text-green-400' : 'text-red-400',
    },
    {
      label: t('teamAttackPctLabel'),
      value: teamStats.teamAttackPct !== null ? `${teamStats.teamAttackPct}%` : '—',
      sub: `${teamStats.totalAttackWins}/${teamStats.totalAttackAttempts}`,
      color: 'text-blue-400',
    },
    {
      label: t('team2ndBallPct'),
      value: teamStats.team2ndPct !== null ? `${teamStats.team2ndPct}%` : '—',
      sub: `${teamStats.total2ndWins}/${teamStats.total2ndAttempts}`,
      color: 'text-green-400',
    },
    {
      label: t('team3rdBallPct'),
      value: teamStats.team3rdPct !== null ? `${teamStats.team3rdPct}%` : '—',
      sub: `${teamStats.total3rdWins}/${teamStats.total3rdAttempts}`,
      color: 'text-purple-400',
    },
    {
      label: t('longestRun'),
      value: momentum ? String(momentum.maxHomeRun.count) : '—',
      sub: t('consecutive'),
      color: 'text-yellow-400',
    },
    {
      label: t('mvp'),
      value: mvpEntry ? mvpEntry.p.name : '—',
      sub: mvpEntry ? `${mvpEntry.s.totalPoints} ${t('ptsLabel')}` : '',
      color: 'text-yellow-400',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c, i) => (
        <Card key={i}>
          <div className="p-3 text-center">
            <div className={`font-black text-lg leading-tight ${c.color}`}>{c.value}</div>
            <div className="text-slate-400 text-[10px] mt-0.5 leading-tight">{c.label}</div>
            {c.sub && <div className="text-slate-500 text-[10px]">{c.sub}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────────
function AIInsightsSection({ insights, loading, error, noKey, onRefresh, t }) {
  return (
    <Card>
      <SectionHeader
        title={t('aiInsights')}
        icon={Brain}
        action={
          !noKey && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t('refreshInsights')}
            </button>
          )
        }
      />

      <div className="p-4 space-y-2">
        {noKey && (
          <div className="text-slate-500 text-sm text-center py-3">{t('aiNoKey')}</div>
        )}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-blue-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t('generatingInsights')}
          </div>
        )}
        {error && !loading && (
          <div className="space-y-1 py-2">
            <div className="text-red-400 text-sm text-center">{t('aiInsightsError')}</div>
            <div className="text-red-600 text-[11px] text-center font-mono break-all px-2">{error}</div>
          </div>
        )}
        {insights && insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-slate-700/40 rounded-xl px-4 py-3 border border-slate-600/50"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white mt-0.5">
              {i + 1}
            </span>
            <p className="text-slate-200 text-sm leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Player Attack Efficiency Chart ────────────────────────────────────────────
function AttackEfficiencyChart({ playerAdvancedList, t }) {
  const data = playerAdvancedList
    .filter(({ stats }) => stats.totalAttackAttempts > 0)
    .sort((a, b) => (b.stats.overallAttackPct ?? -999) - (a.stats.overallAttackPct ?? -999))
    .map(({ player, stats }) => ({
      name: player.name,
      pct: stats.overallAttackPct ?? 0,
    }));

  if (!data.length) return null;
  const h = Math.max(data.length * 44 + 30, 120);

  return (
    <Card>
      <SectionHeader title={t('attackEfficiency')} icon={TrendingUp} />
      <div className="p-3">
        <ResponsiveContainer width="100%" height={h}>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={72} />
            <Tooltip formatter={v => [`${v}%`, t('overallAttPct')]} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="pct" fill="#3b82f6" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="pct" position="right" formatter={v => `${v}%`} style={{ fill: '#94a3b8', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Player Contribution Table ─────────────────────────────────────────────────
function PlayerContributionTable({ playerAdvancedList, t }) {
  const sorted = [...playerAdvancedList].sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);

  return (
    <Card>
      <SectionHeader title={t('playerContribution')} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs">{t('player')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('totalPtsLabel')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('secondBallPct')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('thirdBallPct')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('overallAttPct')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('totalErrLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ player, stats }, i) => (
              <tr key={player.id} className={`border-b border-slate-700/50 ${i === 0 ? 'bg-yellow-900/10' : ''}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Award size={12} className="text-yellow-400 flex-shrink-0" />}
                    <div>
                      <div className="text-white text-xs font-medium">{player.name}</div>
                      <div className="text-slate-500 text-[10px]">#{player.number}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center px-2 py-2 text-green-400 font-bold">{stats.totalPoints}</td>
                <td className="text-center px-2 py-2 text-slate-300 text-xs">{pctStr(stats.pct2nd, stats.wins2nd, stats.attempts2nd)}</td>
                <td className="text-center px-2 py-2 text-slate-300 text-xs">{pctStr(stats.pct3rd, stats.wins3rd, stats.attempts3rd)}</td>
                <td className="text-center px-2 py-2">
                  <span className={`text-xs font-semibold ${
                    stats.overallAttackPct === null ? 'text-slate-500' :
                    stats.overallAttackPct >= 50 ? 'text-green-400' :
                    stats.overallAttackPct >= 30 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {pctStr(stats.overallAttackPct, stats.totalAttackWins, stats.totalAttackAttempts)}
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-red-400">{stats.totalMistakes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Attack Distribution Chart ─────────────────────────────────────────────────
function AttackDistributionChart({ playerAdvancedList, t }) {
  const data = playerAdvancedList
    .filter(({ stats }) => stats.totalAttackWins > 0)
    .sort((a, b) => b.stats.totalAttackWins - a.stats.totalAttackWins)
    .map(({ player, stats }) => ({
      name: player.name,
      [t('secondBallLabel')]: stats.wins2nd,
      [t('thirdBallLabel')]: stats.wins3rd,
    }));

  if (!data.length) return null;
  const h = Math.max(data.length * 44 + 60, 140);

  return (
    <Card>
      <SectionHeader title={t('attackDistribution')} />
      <div className="p-3">
        <ResponsiveContainer width="100%" height={h}>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={72} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey={t('secondBallLabel')} stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey={t('thirdBallLabel')} stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Score Timeline ────────────────────────────────────────────────────────────
function ScoreTimelineChart({ sets, setIndexOffset = 0, homeTeamName, opponentName, t }) {
  const perSetData = useMemo(() => buildScoreTimeline(sets, setIndexOffset), [sets, setIndexOffset]);
  if (!perSetData.length) return null;

  return (
    <Card>
      <SectionHeader title={t('scoreTimeline')} />
      {perSetData.map(({ setNum, data }) => (
        <div key={setNum}>
          {perSetData.length > 1 && (
            <div className="px-4 pt-3 pb-0 text-slate-400 text-xs font-bold uppercase tracking-wider">
              {t('setLabel')} {setNum}
            </div>
          )}
          <div className="p-3">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="rally" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: t('rallyLabel'), position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={v => `${t('rallyLabel')} ${v}`} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Line type="monotone" dataKey="home" stroke="#3b82f6" dot={false} strokeWidth={2} name={homeTeamName} />
                <Line type="monotone" dataKey="opponent" stroke="#ef4444" dot={false} strokeWidth={2} name={opponentName} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {perSetData.length > 1 && setNum < perSetData[perSetData.length - 1].setNum && (
            <div className="border-t border-slate-700/50 mx-4" />
          )}
        </div>
      ))}
    </Card>
  );
}

// ── Momentum Cards ────────────────────────────────────────────────────────────
function MomentumSection({ momentum, homeTeamName, t }) {
  if (!momentum) return null;
  const { maxHomeRun, maxOppRun, maxLead, maxLeadScore } = momentum;

  const cards = [
    maxHomeRun.count > 0 && {
      icon: '🔥',
      text: t('teamScoredRun', {
        count: maxHomeRun.count,
        start: scoreStr(maxHomeRun.startScore),
        end: scoreStr(maxHomeRun.endScore),
      }),
      color: 'border-blue-600/40 bg-blue-900/20',
    },
    maxOppRun.count > 0 && {
      icon: '⚠️',
      text: t('oppScoredRun', {
        count: maxOppRun.count,
        start: scoreStr(maxOppRun.startScore),
        end: scoreStr(maxOppRun.endScore),
      }),
      color: 'border-red-600/40 bg-red-900/20',
    },
    maxLead > 0 && {
      icon: '📈',
      text: t('largestLead', {
        lead: maxLead,
        score: scoreStr(maxLeadScore),
      }),
      color: 'border-green-600/40 bg-green-900/20',
    },
  ].filter(Boolean);

  return (
    <Card>
      <SectionHeader title={t('momentumLabel')} icon={Zap} />
      <div className="p-4 space-y-2">
        {cards.map((c, i) => (
          <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${c.color}`}>
            <span className="text-lg">{c.icon}</span>
            <p className="text-slate-200 text-sm leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Clutch Analysis ───────────────────────────────────────────────────────────
function ClutchSection({ playerAdvancedList, clutchMap, players, t }) {
  const hasClutch = playerAdvancedList.some(({ player }) => {
    const c = clutchMap[player.id];
    return c && c.clutchTotal > 0;
  });

  const sorted = [...playerAdvancedList]
    .map(({ player, stats }) => ({ player, stats, clutch: clutchMap[player.id] }))
    .filter(({ clutch }) => clutch && clutch.clutchTotal > 0)
    .sort((a, b) => b.clutch.clutchPoints - a.clutch.clutchPoints);

  const topClutch = sorted[0];

  return (
    <Card>
      <SectionHeader title={t('clutchPerformance')} />
      {!hasClutch ? (
        <div className="p-4 text-slate-500 text-sm text-center">{t('noClutch')}</div>
      ) : (
        <>
          {topClutch && (
            <div className="px-4 py-3 bg-yellow-900/10 border-b border-yellow-800/30">
              <p className="text-yellow-300 text-sm">
                {t('clutchInsightTpl', {
                  name: topClutch.player.name,
                  x: topClutch.clutch.clutchPoints,
                  total: topClutch.stats.totalPoints,
                })}
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs">{t('player')}</th>
                  <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('clutchPts')}</th>
                  <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('clutchErr')}</th>
                  <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('clutchPct')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ player, clutch }) => (
                  <tr key={player.id} className="border-b border-slate-700/50">
                    <td className="px-3 py-2 text-white text-xs">
                      {player.name} <span className="text-slate-500">#{player.number}</span>
                    </td>
                    <td className="text-center px-2 py-2 text-green-400 font-bold">{clutch.clutchPoints}</td>
                    <td className="text-center px-2 py-2 text-red-400">{clutch.clutchErrors}</td>
                    <td className="text-center px-2 py-2">
                      <span className={`text-xs font-semibold ${
                        clutch.clutchPct === null ? 'text-slate-500' :
                        clutch.clutchPct >= 60 ? 'text-green-400' :
                        clutch.clutchPct >= 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {clutch.clutchPct !== null ? `${clutch.clutchPct}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Error Analysis Table + Chart ──────────────────────────────────────────────
function ErrorAnalysisSection({ playerAdvancedList, errorStateMap, t }) {
  const data = playerAdvancedList
    .map(({ player }) => ({ player, e: errorStateMap[player.id] }))
    .filter(({ e }) => e && e.total > 0)
    .sort((a, b) => b.e.total - a.e.total);

  const chartData = data.map(({ player, e }) => ({
    name: player.name,
    [t('whileLeading')]: e.leading,
    [t('whileTied')]:    e.tied,
    [t('whileTrailing')]: e.trailing,
  }));

  if (!data.length) return null;
  const h = Math.max(data.length * 44 + 60, 140);

  return (
    <Card>
      <SectionHeader title={t('errorAnalysis')} icon={AlertTriangle} />
      {/* Table */}
      <div className="overflow-x-auto border-b border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400 font-semibold text-xs">{t('player')}</th>
              <th className="text-center px-2 py-2 text-green-400 font-semibold text-xs">{t('whileLeading')}</th>
              <th className="text-center px-2 py-2 text-yellow-400 font-semibold text-xs">{t('whileTied')}</th>
              <th className="text-center px-2 py-2 text-red-400 font-semibold text-xs">{t('whileTrailing')}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold text-xs">{t('errorsLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ player, e }) => (
              <tr key={player.id} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-white text-xs">
                  {player.name} <span className="text-slate-500">#{player.number}</span>
                </td>
                <td className="text-center px-2 py-2 text-green-400">{e.leading}</td>
                <td className="text-center px-2 py-2 text-yellow-400">{e.tied}</td>
                <td className="text-center px-2 py-2 text-red-400">{e.trailing}</td>
                <td className="text-center px-2 py-2 text-slate-300 font-bold">{e.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Chart */}
      {chartData.length > 0 && (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={h}>
            <BarChart layout="vertical" data={chartData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={72} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey={t('whileLeading')}  stackId="e" fill="#22c55e" />
              <Bar dataKey={t('whileTied')}     stackId="e" fill="#f59e0b" />
              <Bar dataKey={t('whileTrailing')} stackId="e" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ── Team Statistics ───────────────────────────────────────────────────────────
function TeamStatistics({ teamStats, t }) {
  const items = [
    { label: t('totalPoints2'),       value: teamStats.totalPoints,        color: 'text-green-400' },
    { label: t('attAttempts'),        value: teamStats.totalAttackAttempts, color: 'text-white' },
    { label: t('killsLabel'),         value: teamStats.totalAttackWins,     color: 'text-blue-400' },
    { label: t('teamAttackPctLabel'), value: teamStats.teamAttackPct !== null ? `${teamStats.teamAttackPct}%` : '—', color: 'text-blue-400' },
    { label: t('team2ndBallPct'),     value: teamStats.team2ndPct !== null ? `${teamStats.team2ndPct}%` : '—', color: 'text-green-400' },
    { label: t('team3rdBallPct'),     value: teamStats.team3rdPct !== null ? `${teamStats.team3rdPct}%` : '—', color: 'text-purple-400' },
    { label: t('totalErrors2'),       value: teamStats.totalErrors,         color: 'text-red-400' },
    { label: t('totalBlockTouches'), value: teamStats.totalBlockTouches,   color: 'text-yellow-400' },
    { label: t('acesLabel'),          value: teamStats.totalAces,           color: 'text-yellow-400' },
  ];

  return (
    <Card>
      <SectionHeader title={t('teamStatistics')} />
      <div className="grid grid-cols-3 divide-x divide-y divide-slate-700">
        {items.map((item, i) => (
          <MiniStat key={i} label={item.label} value={item.value} color={item.color} />
        ))}
      </div>
    </Card>
  );
}

// ── Event Distribution Pie ────────────────────────────────────────────────────
function EventDistributionChart({ allEvents, t }) {
  const data = useMemo(() => calcEventDistribution(allEvents), [allEvents]);
  if (!data.length) return null;

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#94a3b8" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
        {name} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  return (
    <Card>
      <SectionHeader title={t('eventDistribution')} />
      <div className="p-2">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} labelLine={false} label={renderLabel}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Detailed Player Stats (expandable) ────────────────────────────────────────
function DetailedPlayerStats({ playerAdvancedList, players, t }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <Card>
      <SectionHeader title={t('detailedPlayerStats')} />
      <div className="divide-y divide-slate-700">
        {playerAdvancedList.map(({ player, stats }) => {
          const isOpen = expanded === player.id;
          return (
            <div key={player.id}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
                onClick={() => setExpanded(isOpen ? null : player.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                    {player.number}
                  </div>
                  <div className="text-left">
                    <div className="text-white text-sm font-medium">{player.name}</div>
                    <div className="text-slate-500 text-xs">{player.position}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-sm">{stats.totalPoints} <span className="text-slate-500 font-normal text-xs">{t('ptsLabel')}</span></div>
                    <div className="text-red-400 text-xs">{stats.totalMistakes} {t('errorsLabel')}</div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="bg-slate-900/40 border-t border-slate-700/50 px-4 py-3 space-y-3">
                  {/* Attack rows */}
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('catAttack')}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-slate-400">{t('secondBallWins')}</div>
                      <div className="text-blue-400 font-bold">{pctStr(stats.pct2nd, stats.wins2nd, stats.attempts2nd)}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-slate-400">{t('thirdBallWins')}</div>
                      <div className="text-green-400 font-bold">{pctStr(stats.pct3rd, stats.wins3rd, stats.attempts3rd)}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-slate-400">{t('overallAttPct')}</div>
                      <div className="text-white font-bold">{pctStr(stats.overallAttackPct, stats.totalAttackWins, stats.totalAttackAttempts)}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-slate-400">{t('attackErrors')}</div>
                      <div className="text-red-400 font-bold">{stats.totalAttackErrors}</div>
                      <div className="text-slate-600 text-[10px]">{t('outLabel')} {stats.attackOut} · {t('blkdLabel')} {stats.attackBlocked}</div>
                    </div>
                  </div>

                  {/* Serve + Defense */}
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mt-2 mb-1">{t('catServe')} / {t('catDefense')}</div>
                  <div className="flex gap-4">
                    <div className="flex gap-4 flex-wrap text-xs">
                      <div><span className="text-yellow-400 font-bold">{stats.aces}</span> <span className="text-slate-500">{t('acesLabel')}</span></div>
                      <div><span className="text-red-400 font-bold">{stats.serveErrors}</span> <span className="text-slate-500">{t('srvLabel')}</span></div>
                      <div><span className="text-blue-400 font-bold">{stats.blocks}</span> <span className="text-slate-500">{t('blocksLabel')}</span></div>
                      <div><span className="text-slate-300 font-bold">{stats.blockTouches}</span> <span className="text-slate-500">{t('totalBlockTouches')}</span></div>
                      <div><span className="text-red-400 font-bold">{stats.defenseError}</span> <span className="text-slate-500">{t('defLabel')}-</span></div>
                      <div><span className="text-red-400 font-bold">{stats.setError}</span> <span className="text-slate-500">{t('setStatsLabel')}-</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Full Event Log ────────────────────────────────────────────────────────────
function EventLogSection({ currentMatch, players, t }) {
  const [open, setOpen] = useState(false);
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

  const allEvents = currentMatch.sets.flatMap((set, si) =>
    (set.events || []).map(e => ({ ...e, setNum: si + 1 }))
  );

  if (!allEvents.length) return null;

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-200 font-semibold text-sm">{t('eventLog')}</span>
          <span className="text-slate-500 text-xs">({allEvents.length})</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
          {allEvents.map((ev, i) => {
            const p = ev.playerId ? playerMap[ev.playerId] : null;
            const isHomeScore = HOME_SCORE_EVENTS.has(ev.type);
            const isOppScore  = OPPONENT_SCORE_EVENTS.has(ev.type);
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                <div className="text-slate-600 w-5 text-right font-mono">{i + 1}</div>
                <div className="text-slate-600 text-[10px] w-8">S{ev.setNum}</div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isHomeScore ? 'bg-green-500' : isOppScore ? 'bg-red-500' : 'bg-slate-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-slate-300">{p ? p.name : '—'}</span>
                  <span className="text-slate-500 ml-2">
                    {EVENT_TYPE_I18N_KEY[ev.type] ? t(EVENT_TYPE_I18N_KEY[ev.type]) : ev.type}
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[10px] tabular-nums">
                  {ev.homeScore ?? '?'}–{ev.opponentScore ?? '?'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Main AnalysisTab component ────────────────────────────────────────────────
export default function AnalysisTab({ currentMatch, t }) {
  const players = currentMatch.homeTeam.players;

  // ── Set filter ──────────────────────────────────────────────────────────────
  const [selectedSetIdx, setSelectedSetIdx] = useState(null); // null = all sets

  const filteredSets = useMemo(() =>
    selectedSetIdx === null ? currentMatch.sets : [currentMatch.sets[selectedSetIdx]].filter(Boolean),
    [currentMatch.sets, selectedSetIdx]
  );

  const filteredEvents = useMemo(
    () => filteredSets.flatMap(s => s.events || []),
    [filteredSets]
  );

  // ── All computed stats use filteredEvents ───────────────────────────────────
  const playerAdvancedList = useMemo(() =>
    players.map(p => ({ player: p, stats: calcAdvancedPlayerStats(p.id, filteredEvents) })),
    [players, filteredEvents]
  );

  const playerAdvancedMap = useMemo(() => {
    const m = {};
    playerAdvancedList.forEach(({ player, stats }) => { m[player.id] = stats; });
    return m;
  }, [playerAdvancedList]);

  const teamStats     = useMemo(() => calcAdvancedTeamStats(players, filteredEvents), [players, filteredEvents]);
  const momentum      = useMemo(() => calcMomentum(filteredEvents), [filteredEvents]);

  const clutchMap = useMemo(() => {
    const m = {};
    players.forEach(p => { m[p.id] = calcClutchStats(p.id, filteredEvents); });
    return m;
  }, [players, filteredEvents]);

  const errorStateMap = useMemo(() => {
    const m = {};
    players.forEach(p => { m[p.id] = calcErrorByGameState(p.id, filteredEvents); });
    return m;
  }, [players, filteredEvents]);

  // ── AI insights ─────────────────────────────────────────────────────────────
  const [insights, setInsights]   = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState(null);   // null or error string
  const [aiNoKey, setAiNoKey]     = useState(false);

  const loadInsights = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiNoKey(false);
    setInsights(null);
    try {
      const result = await fetchAIInsights({
        homeTeam:     currentMatch.homeTeam.name,
        opponentTeam: currentMatch.opponentTeam.name,
        setLabel:     selectedSetIdx !== null ? `Set ${selectedSetIdx + 1}` : 'All Sets',
        team:         teamStats,
        playersSummary: playerAdvancedList.map(({ player, stats }) => ({
          name: player.name, number: player.number, ...stats,
        })),
        momentum,
        clutchStats: players.map(p => ({ name: p.name, ...clutchMap[p.id] })),
        errorStats:  players.map(p => ({ name: p.name, ...errorStateMap[p.id] })),
      });
      setInsights(result);
    } catch (err) {
      if (err.message === 'NO_KEY') {
        setAiNoKey(true);
      } else {
        setAiError(err.message);
      }
    } finally {
      setAiLoading(false);
    }
  }, [currentMatch, teamStats, playerAdvancedList, momentum, clutchMap, errorStateMap, players, selectedSetIdx]);

  // Auto-load on mount and whenever the filter changes
  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const multiSet = currentMatch.sets.length > 1;

  return (
    <div className="space-y-4">

      {/* 0. Set filter pills */}
      {multiSet && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              selectedSetIdx === null ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setSelectedSetIdx(null)}
          >
            {t('allSets')}
          </button>
          {currentMatch.sets.map((_, i) => (
            <button
              key={i}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedSetIdx === i ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => setSelectedSetIdx(i)}
            >
              {t('setLabel')} {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* 1. Summary Cards */}
      <SummaryCards
        currentMatch={currentMatch}
        teamStats={teamStats}
        playerAdvancedMap={playerAdvancedMap}
        players={players}
        momentum={momentum}
        t={t}
      />

      {/* 2. AI Insights */}
      <AIInsightsSection
        insights={insights}
        loading={aiLoading}
        error={aiError}
        noKey={aiNoKey}
        onRefresh={loadInsights}
        t={t}
      />

      {/* 3. Player Attack Efficiency chart */}
      <AttackEfficiencyChart playerAdvancedList={playerAdvancedList} t={t} />

      {/* 4. Player Contribution Table */}
      <PlayerContributionTable playerAdvancedList={playerAdvancedList} t={t} />

      {/* 5. Attack Distribution */}
      <AttackDistributionChart playerAdvancedList={playerAdvancedList} t={t} />

      {/* 6. Score Timeline — per-set charts */}
      <ScoreTimelineChart
        sets={filteredSets}
        setIndexOffset={selectedSetIdx ?? 0}
        homeTeamName={currentMatch.homeTeam.name}
        opponentName={currentMatch.opponentTeam.name}
        t={t}
      />

      {/* 7. Momentum */}
      <MomentumSection momentum={momentum} homeTeamName={currentMatch.homeTeam.name} t={t} />

      {/* 8. Clutch Analysis */}
      <ClutchSection
        playerAdvancedList={playerAdvancedList}
        clutchMap={clutchMap}
        players={players}
        t={t}
      />

      {/* 9. Error Analysis */}
      <ErrorAnalysisSection
        playerAdvancedList={playerAdvancedList}
        errorStateMap={errorStateMap}
        t={t}
      />

      {/* 10. Team Statistics */}
      <TeamStatistics teamStats={teamStats} t={t} />

      {/* 11. Event Distribution */}
      <EventDistributionChart allEvents={filteredEvents} t={t} />

      {/* 12. Detailed Player Stats */}
      <DetailedPlayerStats playerAdvancedList={playerAdvancedList} players={players} t={t} />

      {/* 13. Full Event Log */}
      <EventLogSection currentMatch={currentMatch} players={players} t={t} />

    </div>
  );
}
