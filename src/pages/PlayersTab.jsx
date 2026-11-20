import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, LabelList,
} from 'recharts';
import {
  calcAdvancedPlayerStats, calcContributionParts, rankByContribution, pickBestPlayer,
} from '../utils/analysisStats';

// Radar series colors (dark categorical slots). Validated all-pairs on the card
// surface #1e293b — overlapping polygons need every pair distinct, and no set
// larger than 4 passes, so the radar shows at most 4 players at once.
const RADAR_COLORS = ['#3987e5', '#d55181', '#c98500', '#008300'];
const RADAR_MAX = RADAR_COLORS.length;
const POS_COLOR = '#0ca30c';
const NEG_COLOR = '#d03b3b';

const TOOLTIP_STYLE = {
  background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 12, borderRadius: 8,
};

const fmtScore = s => (s > 0 ? `+${s}` : String(s));
const pct = (num, den) => (den > 0 ? Math.round(num / den * 100) : null);
const clamp10 = v => Math.max(0, Math.min(10, Math.round(v * 10) / 10));

function buildRows(players, events) {
  const ranked = rankByContribution(players.map(p => ({ player: p, stats: calcAdvancedPlayerStats(p.id, events) })));
  return ranked.map(({ player, stats, score }) => {
    const { pos, neg } = calcContributionParts(stats);
    return {
      player, stats, score, pos, neg,
      attackPct: pct(stats.totalAttackWins, stats.totalAttackAttempts),
      pct2nd: stats.pct2nd,
      pct3rd: stats.pct3rd,
      serveKey: stats.aces + stats.serveErrors > 0 ? stats.aces - stats.serveErrors : null,
      blockKey: stats.blockTouches + stats.blocks > 0 ? stats.blockTouches + stats.blocks * 2 : null,
      errors: stats.totalMistakes,
    };
  });
}

// Six axes on a 0–10 scale. Ratios are absolute; counts are relative to the
// best player in the current set filter so the shape compares teammates.
function radarScores(row, maxBlock, maxDefense, maxErrors) {
  const s = row.stats;
  const serveTotal = s.aces + s.serveErrors;
  return {
    serve:   serveTotal > 0 ? clamp10(s.aces / serveTotal * 10) : 0,
    attack2: s.pct2nd !== null ? clamp10(s.pct2nd / 10) : 0,
    attack3: s.pct3rd !== null ? clamp10(s.pct3rd / 10) : 0,
    block:   maxBlock > 0 ? clamp10((s.blockTouches + s.blocks) / maxBlock * 10) : 0,
    defense: maxDefense > 0 ? clamp10(s.defenseSuccess / maxDefense * 10) : 0,
    errors:  maxErrors > 0 ? clamp10((1 - s.totalMistakes / maxErrors) * 10) : 10,
  };
}

const COLUMNS = [
  { id: 'player',    labelKey: 'colPlayer',  sortVal: r => Number(r.player.number) || 0, align: 'start' },
  { id: 'score',     labelKey: 'colScore',   sortVal: r => r.score },
  { id: 'serve',     labelKey: 'colServe',   sortVal: r => r.serveKey },
  { id: 'attack',    labelKey: 'colAttack',  sortVal: r => r.attackPct },
  { id: 'attack2',   labelKey: 'col2nd',     sortVal: r => r.pct2nd },
  { id: 'attack3',   labelKey: 'col3rd',     sortVal: r => r.pct3rd },
  { id: 'block',     labelKey: 'colBlock',   sortVal: r => r.blockKey },
  { id: 'errors',    labelKey: 'colErrors',  sortVal: r => r.errors },
];

export default function PlayersTab({ players, events, t }) {
  const { isRTL } = useLanguage();
  // SVG chart text sits in an LTR box; RLM marks keep Hebrew labels like "כדור 2" in reading order
  const svgLabel = text => (isRTL ? `\u200F${text}\u200F` : text);
  const rows = useMemo(() => buildRows(players, events), [players, events]);
  const bestPlayer = useMemo(() => pickBestPlayer(rows), [rows]);

  // ── Table sorting ─────────────────────────────────────────────────────────
  const [sort, setSort] = useState({ col: 'score', dir: 'desc' });
  const sortedRows = useMemo(() => {
    const col = COLUMNS.find(c => c.id === sort.col);
    const sign = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = col.sortVal(a), vb = col.sortVal(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;            // empty cells always last
      if (vb === null) return -1;
      return (va - vb) * sign;
    });
  }, [rows, sort]);

  function toggleSort(colId) {
    setSort(prev => prev.col === colId
      ? { col: colId, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { col: colId, dir: colId === 'player' ? 'asc' : 'desc' });
  }

  // ── Chart player selection: playerId → color slot (stable while toggling) ──
  const [slots, setSlots] = useState(() => {
    const initial = {};
    rows.slice(0, RADAR_MAX).forEach((r, i) => { initial[r.player.id] = i; });
    return initial;
  });
  const [maxNotice, setMaxNotice] = useState(false);

  function togglePlayer(playerId) {
    if (playerId in slots) {
      const next = { ...slots };
      delete next[playerId];
      setSlots(next);
      setMaxNotice(false);
      return;
    }
    // New player takes the lowest free color; everyone else keeps theirs
    const used = new Set(Object.values(slots));
    const free = RADAR_COLORS.findIndex((_, i) => !used.has(i));
    if (free === -1) { setMaxNotice(true); return; }
    setSlots({ ...slots, [playerId]: free });
    setMaxNotice(false);
  }

  const selectedRows = rows.filter(r => r.player.id in slots);

  const radarData = useMemo(() => {
    const maxBlock   = Math.max(0, ...rows.map(r => r.stats.blockTouches + r.stats.blocks));
    const maxDefense = Math.max(0, ...rows.map(r => r.stats.defenseSuccess));
    const maxErrors  = Math.max(0, ...rows.map(r => r.stats.totalMistakes));
    const scores = Object.fromEntries(rows.map(r => [r.player.id, radarScores(r, maxBlock, maxDefense, maxErrors)]));
    const axes = [
      { key: 'serve',   labelKey: 'radarServe' },
      { key: 'attack2', labelKey: 'radarAttack2' },
      { key: 'attack3', labelKey: 'radarAttack3' },
      { key: 'block',   labelKey: 'radarBlock' },
      { key: 'defense', labelKey: 'radarDefense' },
      { key: 'errors',  labelKey: 'radarErrors' },
    ];
    return axes.map(a => ({
      axis: svgLabel(t(a.labelKey)),
      ...Object.fromEntries(rows.map(r => [r.player.id, scores[r.player.id][a.key]])),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, t, isRTL]);

  const barData = useMemo(() => [...selectedRows]
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      name: `#${r.player.number} ${r.player.name}`,
      pos: r.pos,
      neg: -r.neg,
      net: fmtScore(r.score),
    })), [selectedRows]);

  // ── Cell renderers ────────────────────────────────────────────────────────
  const dash = <span className="text-slate-600">—</span>;
  const pctCell = (p, num, den) => (p === null ? dash : (
    <span dir="ltr">{p}% <span className="text-slate-500">({num}/{den})</span></span>
  ));

  return (
    <div className="space-y-4">

      {/* 1. Compact sortable table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                {COLUMNS.map(col => (
                  <th key={col.id} className={`px-2 py-2 font-semibold whitespace-nowrap ${col.align === 'start' ? 'text-start' : 'text-center'}`}>
                    <button
                      className={`inline-flex items-center gap-0.5 transition-colors ${sort.col === col.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => toggleSort(col.id)}
                    >
                      {t(col.labelKey)}
                      {sort.col === col.id && (sort.dir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(r => {
                const s = r.stats;
                const isBest = bestPlayer?.player.id === r.player.id;
                return (
                  <tr key={r.player.id} className={`border-b border-slate-700/50 last:border-0 ${isBest ? 'bg-yellow-900/10' : ''}`}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-500 tabular-nums" dir="ltr">#{r.player.number}</span>
                        <span className="text-white font-medium">{r.player.name}</span>
                        {isBest && <span>🏆</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center font-bold tabular-nums" dir="ltr">
                      <span className={r.score > 0 ? 'text-yellow-400' : r.score < 0 ? 'text-red-400' : 'text-slate-500'}>{fmtScore(r.score)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap" dir="ltr">
                      {s.aces + s.serveErrors > 0 ? t('serveCellFmt', { a: s.aces, e: s.serveErrors }) : dash}
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap">{pctCell(r.attackPct, s.totalAttackWins, s.totalAttackAttempts)}</td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap">{pctCell(s.pct2nd, s.wins2nd, s.attempts2nd)}</td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap">{pctCell(s.pct3rd, s.wins3rd, s.attempts3rd)}</td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap" dir="ltr">
                      {s.blockTouches + s.blocks > 0 ? t('blockCellFmt', { t: s.blockTouches, k: s.blocks }) : dash}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      <span className={r.errors > 0 ? 'text-red-400' : 'text-slate-500'}>{r.errors}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t border-slate-700/60 text-slate-500 text-[10px]">{t('playersTableKey')}</div>
      </div>

      {/* Player filter pills — shared by both charts */}
      <div>
        <div className="flex flex-wrap gap-1.5">
          {rows.map(r => {
            const slot = slots[r.player.id];
            const on = slot !== undefined;
            return (
              <button
                key={r.player.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
                  on ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                onClick={() => togglePlayer(r.player.id)}
                aria-pressed={on}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 border"
                  style={on ? { background: RADAR_COLORS[slot], borderColor: RADAR_COLORS[slot] } : { borderColor: '#475569' }}
                />
                <span dir="ltr">#{r.player.number}</span> {r.player.name}
              </button>
            );
          })}
        </div>
        <div className={`text-[11px] mt-1.5 ${maxNotice ? 'text-amber-400' : 'text-slate-500'}`}>
          {t('chartPlayersHint', { n: RADAR_MAX })}
        </div>
      </div>

      {/* 2. Radar */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-slate-200 font-semibold text-sm">{t('radarTitle')}</div>
          <div className="text-slate-500 text-[11px]">{t('radarSubtitle')}</div>
        </div>
        {selectedRows.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">{t('chartNoPlayers')}</div>
        ) : (
          <>
            <div className="px-2 pt-2" dir="ltr">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => (typeof v === 'number' ? v.toFixed(1) : v)} />
                  {selectedRows.map(r => (
                    <Radar
                      key={r.player.id}
                      name={`#${r.player.number} ${r.player.name}`}
                      dataKey={r.player.id}
                      stroke={RADAR_COLORS[slots[r.player.id]]}
                      fill={RADAR_COLORS[slots[r.player.id]]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: RADAR_COLORS[slots[r.player.id]] }}
                      isAnimationActive={false}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3">
              {selectedRows.map(r => (
                <div key={r.player.id} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="w-3 h-0.5 rounded" style={{ background: RADAR_COLORS[slots[r.player.id]], height: 3 }} />
                  <span dir="ltr" className="text-slate-500">#{r.player.number}</span> {r.player.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. Positive vs negative contribution */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="text-slate-200 font-semibold text-sm">{t('posNegTitle')}</div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: POS_COLOR }} />{t('posLabel')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: NEG_COLOR }} />{t('negLabel')}</span>
          </div>
        </div>
        {barData.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">{t('chartNoPlayers')}</div>
        ) : (
          <div className="px-2 py-3" dir="ltr">
            <ResponsiveContainer width="100%" height={barData.length * 40 + 30}>
              <BarChart layout="vertical" data={barData} stackOffset="sign" margin={{ left: 4, right: 44, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <ReferenceLine x={0} stroke="#64748b" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  formatter={(v, key) => [Math.abs(v), key === 'pos' ? t('posLabel') : t('negLabel')]}
                />
                <Bar dataKey="neg" stackId="c" fill={NEG_COLOR} radius={[4, 0, 0, 4]} barSize={18} isAnimationActive={false} />
                <Bar dataKey="pos" stackId="c" fill={POS_COLOR} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                  <LabelList dataKey="net" position="right" style={{ fill: '#f1f5f9', fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
