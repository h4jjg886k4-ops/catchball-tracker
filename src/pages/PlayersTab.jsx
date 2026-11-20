import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
  ScatterChart, Scatter, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  calcAdvancedPlayerStats, calcContributionParts, rankByContribution, pickBestPlayer,
  formatEff, SMALL_SAMPLE_ATTEMPTS, listPlayerErrors,
} from '../utils/analysisStats';
import { EVENT_TYPE_I18N_KEY } from '../i18n/translations';
import EffValue from '../components/ui/EffValue';

const POS_COLOR = '#0ca30c';
const NEG_COLOR = '#d03b3b';
// One color per metric panel (dark slots, validated all-pairs on the card surface #1e293b)
const METRIC_COLORS = { serve: '#199e70', attack: '#3987e5', block: '#c98500', errors: '#dc2626' };
const SCATTER_COLOR = '#3987e5';
const PANEL_ROW_H = 30;
const NAME_COL_W = 120;
// Recharts skips 0-length bars (and their labels/background); a sliver keeps empty rows visible
const EMPTY_BAR = 0.0001;

// Value label at the bar's outer end; negative bars are labelled just right of the zero line
function barEndLabel(data, valueKey, labelKey) {
  return function BarEndLabel({ x, y, width, height, index }) {
    const row = data[index];
    if (!row) return null;
    const negative = row[valueKey] < 0;
    const tx = negative ? Math.max(x, x + width) + 4 : x + Math.abs(width) + 4;
    return (
      <text x={tx} y={y + height / 2} dy="0.35em" fill="#e2e8f0" fontSize={11}>{row[labelKey]}</text>
    );
  };
}

const TOOLTIP_STYLE = {
  background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 12, borderRadius: 8,
};

const fmtScore = s => (s > 0 ? `+${s}` : String(s));
const pctText = v => `${Math.round(v * 100)}%`;

// Sets (within the current filter) in which the player logged an action or stood on court
function setsPlayed(playerId, sets) {
  return sets.filter(set =>
    (set.events || []).some(e => e.playerId === playerId) ||
    (set.startingRotation || []).includes(playerId) ||
    (set.rotation || []).includes(playerId) ||
    (set.substitutions || []).some(sub => sub.inPlayerId === playerId)
  ).length;
}

function buildRows(players, events, sets) {
  const ranked = rankByContribution(players.map(p => ({ player: p, stats: calcAdvancedPlayerStats(p.id, events) })));
  return ranked.map(({ player, stats, score }) => {
    const { pos, neg } = calcContributionParts(stats);
    const serveAttempts = stats.aces + stats.serveIn + stats.serveErrors;
    const nSets = setsPlayed(player.id, sets);
    return {
      player, stats, score, pos, neg, nSets,
      aceRate:     serveAttempts > 0 ? stats.aces / serveAttempts : null,
      blocksPerSet: nSets > 0 ? (stats.blockTouches + stats.blocks) / nSets : null,
      errorRate:   stats.totalActions > 0 ? stats.totalMistakes / stats.totalActions : null,
      serveKey: stats.aces + stats.serveErrors > 0 ? stats.aces - stats.serveErrors : null,
      blockKey: stats.blockTouches + stats.blocks > 0 ? stats.blockTouches + stats.blocks * 2 : null,
      errors: stats.totalMistakes,
    };
  });
}

// One metric column of the comparison chart. Every panel uses the same rows and
// row height so players line up across panels; each panel keeps its own scale.
function MetricPanel({ data, valueKey, labelKey, color, domain, title, hint, showNames }) {
  const height = data.length * PANEL_ROW_H + 8;
  return (
    <div className={showNames ? 'flex-[1.8] min-w-[240px]' : 'flex-1 min-w-[130px]'}>
      <div className="mb-1 min-h-[30px]" style={{ paddingLeft: showNames ? NAME_COL_W : 0 }}>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />{title}
        </div>
        {hint && <div className="text-[10px] text-slate-500 leading-tight">{hint}</div>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 64, bottom: 4, left: 0 }}>
          <XAxis type="number" domain={domain} hide />
          <YAxis
            type="category" dataKey="name" interval={0}
            hide={!showNames} width={showNames ? NAME_COL_W : 0}
            tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false}
          />
          {domain[0] < 0 && <ReferenceLine x={0} stroke="#64748b" />}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            formatter={(_, __, props) => [props.payload[labelKey], title]}
          />
          <Bar
            dataKey={valueKey} fill={color} barSize={12} radius={4} isAnimationActive={false}
            background={{ fill: '#273449', radius: 4 }}
          >
            <LabelList dataKey={labelKey} content={barEndLabel(data, valueKey, labelKey)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLUMNS = [
  { id: 'player',    labelKey: 'colPlayer',  sortVal: r => Number(r.player.number) || 0, align: 'start' },
  { id: 'score',     labelKey: 'colScore',   sortVal: r => r.score },
  { id: 'serve',     labelKey: 'colServe',   sortVal: r => r.serveKey },
  { id: 'attack',    labelKey: 'colAttack',  sortVal: r => r.stats.attackEff },
  { id: 'attack2',   labelKey: 'col2nd',     sortVal: r => r.stats.attackEff2nd },
  { id: 'attack3',   labelKey: 'col3rd',     sortVal: r => r.stats.attackEff3rd },
  { id: 'block',     labelKey: 'colBlock',   sortVal: r => r.blockKey },
  { id: 'errors',    labelKey: 'colErrors',  sortVal: r => r.errors },
];

export default function PlayersTab({ players, events, sets, setNumbers, t }) {
  const { isRTL } = useLanguage();
  // SVG chart text sits in an LTR box; RLM marks keep Hebrew labels like "כדור 2" in reading order
  const svgLabel = text => (isRTL ? `\u200F${text}\u200F` : text);
  const rows = useMemo(() => buildRows(players, events, sets), [players, events, sets]);
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

  // ── Comparison panels (all players, contribution order) ───────────────────
  const maxBlocksPerSet = Math.max(1, ...rows.map(r => r.blocksPerSet ?? 0));
  const panelData = rows.map(r => {
    const s = r.stats;
    const small = s.totalAttackAttempts > 0 && s.totalAttackAttempts < SMALL_SAMPLE_ATTEMPTS;
    return {
      name: `#${r.player.number} ${r.player.name}`,
      // empty categories plot as 0-length bars with a "—" label
      serve: r.aceRate || EMPTY_BAR,  serveLabel: r.aceRate === null ? '—' : pctText(r.aceRate),
      attack: s.attackEff || EMPTY_BAR, attackLabel: s.attackEff === null ? '—' : `${formatEff(s.attackEff)}${small ? ' ※' : ''}`,
      block: r.blocksPerSet || EMPTY_BAR, blockLabel: r.blocksPerSet === null ? '—' : r.blocksPerSet.toFixed(1),
      // inverted: bar length = share of clean actions, label = actual error rate
      clean: r.errorRate === null ? EMPTY_BAR : (1 - r.errorRate) || EMPTY_BAR, errorLabel: r.errorRate === null ? '—' : pctText(r.errorRate),
    };
  });

  // ── Scatter: efficiency (x) vs contribution (y), bubble = attempts ────────
  const scatterData = rows
    .filter(r => r.stats.totalAttackAttempts > 0)
    .map(r => ({
      x: Math.round(r.stats.attackEff * 1000) / 1000,
      y: r.score,
      z: r.stats.totalAttackAttempts,
      num: `#${r.player.number}`,
      name: r.player.name,
      small: r.stats.totalAttackAttempts < SMALL_SAMPLE_ATTEMPTS,
    }));
  // Played in the selected sets but never attacked (bench-only players aren't listed)
  const noAttackPlayers = rows
    .filter(r => !r.stats.totalAttackAttempts && (r.nSets > 0 || r.stats.totalActions > 0))
    .map(r => `#${r.player.number} ${r.player.name}`);
  // Symmetric y range on a 5-point grid so y = 0 sits in the middle
  const yLimit = Math.max(5, Math.ceil(Math.max(...scatterData.map(d => Math.abs(d.y)), 0) * 1.15 / 5) * 5);
  const yTicks = [-yLimit, -yLimit / 2, 0, yLimit / 2, yLimit];
  const maxAttempts = Math.max(1, ...scatterData.map(d => d.z));
  const bubbleRadius = z => 6 + 14 * Math.sqrt(z / maxAttempts);

  function renderBubble({ cx, cy, payload }) {
    const r = bubbleRadius(payload.z);
    return (
      <g>
        <circle
          cx={cx} cy={cy} r={r}
          fill={payload.small ? 'none' : SCATTER_COLOR} fillOpacity={payload.small ? 0 : 0.55}
          stroke={SCATTER_COLOR} strokeWidth={2}
        />
        <text x={cx} y={cy - r - 4} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={600}>
          {payload.num}{payload.small ? ' ※' : ''}
        </text>
      </g>
    );
  }

  function renderScatterTooltip({ active, payload }) {
    const d = active && payload?.[0]?.payload;
    if (!d) return null;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-0.5">
        <div className="font-semibold">{d.num} {d.name}</div>
        <div>{t('attackEffLabel')}: <span dir="ltr">{formatEff(d.x)}</span></div>
        <div>{t('colScore')}: <span dir="ltr">{fmtScore(d.y)}</span></div>
        <div>{t('tipAttempts')}: {d.z}{d.small ? ` ※ ${t('smallSampleTip')}` : ''}</div>
      </div>
    );
  }

  const quadLabel = (key, position) => ({ value: svgLabel(t(key)), position, fill: '#64748b', fontSize: 11 });

  // rows are already in contribution order (rankByContribution)
  const barData = useMemo(() => rows
    .map(r => ({
      name: `#${r.player.number} ${r.player.name}`,
      pos: r.pos || EMPTY_BAR,
      neg: -r.neg,
      net: fmtScore(r.score),
    })), [rows]);

  // ── Cell renderers ────────────────────────────────────────────────────────
  const dash = <span className="text-slate-600">—</span>;

  // ── Error drill-down (tap the Errors cell) ────────────────────────────────
  const [openErrorsFor, setOpenErrorsFor] = useState(null);
  const ballLabel = n => (n === 2 ? t('secondBall') : n === 3 ? t('thirdBall') : null);

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
                const errorsOpen = openErrorsFor === r.player.id;
                const errorList = errorsOpen ? listPlayerErrors(r.player.id, sets, setNumbers) : [];
                return (
                  <Fragment key={r.player.id}>
                  <tr className={`border-b border-slate-700/50 last:border-0 ${isBest ? 'bg-yellow-900/10' : ''}`}>
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
                    <td className="px-2 py-1.5 text-center text-slate-300"><EffValue eff={s.attackEff} attempts={s.totalAttackAttempts} /></td>
                    <td className="px-2 py-1.5 text-center text-slate-300"><EffValue eff={s.attackEff2nd} attempts={s.attempts2nd} /></td>
                    <td className="px-2 py-1.5 text-center text-slate-300"><EffValue eff={s.attackEff3rd} attempts={s.attempts3rd} /></td>
                    <td className="px-2 py-1.5 text-center text-slate-300 tabular-nums whitespace-nowrap" dir="ltr">
                      {s.blockTouches + s.blocks > 0 ? t('blockCellFmt', { t: s.blockTouches, k: s.blocks }) : dash}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      <button
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border transition-colors ${
                          errorsOpen ? 'bg-red-950/60 border-red-800' : 'border-transparent hover:border-slate-600'
                        } ${r.errors > 0 ? 'text-red-400' : 'text-slate-500'}`}
                        onClick={() => setOpenErrorsFor(errorsOpen ? null : r.player.id)}
                        aria-expanded={errorsOpen}
                        title={t('showErrors')}
                      >
                        {r.errors}
                        {errorsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </td>
                  </tr>
                  {errorsOpen && (
                    <tr className="border-b border-slate-700/50 bg-slate-900/40">
                      <td colSpan={COLUMNS.length} className="px-4 py-2">
                        {errorList.length === 0 ? (
                          <div className="text-slate-500 text-xs">{t('noErrors')}</div>
                        ) : (
                          <ul className="space-y-1">
                            {errorList.map(e => (
                              <li key={e.id} className="text-xs text-slate-300 flex items-center gap-1.5">
                                <span className="text-slate-500">{t('setLabel')} {e.setNumber}</span>
                                <span className="text-slate-600">·</span>
                                <bdi dir="ltr" className="tabular-nums text-slate-400">{e.home ?? '?'}-{e.opp ?? '?'}</bdi>
                                <span className="text-slate-600">—</span>
                                <span className="text-red-300">
                                  {EVENT_TYPE_I18N_KEY[e.type] ? t(EVENT_TYPE_I18N_KEY[e.type]) : e.type}
                                  {ballLabel(e.ballNumber) && <span className="text-slate-500"> ({ballLabel(e.ballNumber)})</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t border-slate-700/60 text-slate-500 text-[10px]">{t('playersTableKey')}</div>
      </div>

      {/* 2. Player comparison: four aligned metric panels */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-slate-200 font-semibold text-sm">{t('compareTitle')}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-400">
            {[
              ['serve', 'metricServe'], ['attack', 'metricAttack'], ['block', 'metricBlock'], ['errors', 'metricErrors'],
            ].map(([k, key]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: METRIC_COLORS[k] }} />{t(key)}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-3 px-3 py-3 min-w-[760px]" dir="ltr">
            <MetricPanel data={panelData} valueKey="serve"  labelKey="serveLabel"  color={METRIC_COLORS.serve}  domain={[0, 1]} title={t('metricServe')} hint={t('metricServeHint')} showNames />
            <MetricPanel data={panelData} valueKey="attack" labelKey="attackLabel" color={METRIC_COLORS.attack} domain={[-1, 1]} title={t('metricAttack')} hint={t('metricAttackHint')} />
            <MetricPanel data={panelData} valueKey="block"  labelKey="blockLabel"  color={METRIC_COLORS.block}  domain={[0, maxBlocksPerSet]} title={t('metricBlock')} hint={t('metricBlockHint')} />
            <MetricPanel data={panelData} valueKey="clean"  labelKey="errorLabel"  color={METRIC_COLORS.errors} domain={[0, 1]} title={t('metricErrors')} hint={t('metricErrorsHint')} />
          </div>
        </div>
      </div>

      {/* 3. Scatter: attack efficiency vs contribution */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-slate-200 font-semibold text-sm">{t('scatterTitle')}</div>
          <div className="text-slate-500 text-[11px]">{t('scatterNote')}</div>
        </div>
        {scatterData.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">{t('scatterEmpty')}</div>
        ) : (
          <div className="px-2 pt-3" dir="ltr">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 24, right: 24, bottom: 28, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number" dataKey="x" domain={[-1.15, 1.15]} ticks={[-1, -0.5, 0, 0.5, 1]}
                  tickFormatter={v => v.toFixed(1)} tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: svgLabel(t('attackEffLabel')), position: 'insideBottom', offset: -16, fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  type="number" dataKey="y" domain={[-yLimit, yLimit]} ticks={yTicks}
                  tick={{ fill: '#94a3b8', fontSize: 11 }} width={44}
                  label={{ value: svgLabel(t('colScore')), angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <ReferenceArea x1={0} x2={1.15} y1={0} y2={yLimit} fill="transparent" stroke="none" label={quadLabel('quadEffContrib', 'insideTopRight')} />
                <ReferenceArea x1={-1.15} x2={0} y1={0} y2={yLimit} fill="transparent" stroke="none" label={quadLabel('quadContribIneff', 'insideTopLeft')} />
                <ReferenceArea x1={0} x2={1.15} y1={-yLimit} y2={0} fill="transparent" stroke="none" label={quadLabel('quadEffNoContrib', 'insideBottomRight')} />
                <ReferenceArea x1={-1.15} x2={0} y1={-yLimit} y2={0} fill="transparent" stroke="none" label={quadLabel('quadNeedsWork', 'insideBottomLeft')} />
                <ReferenceLine x={0} stroke="#64748b" />
                <ReferenceLine y={0} stroke="#64748b" />
                <Tooltip content={renderScatterTooltip} cursor={{ strokeDasharray: '3 3', stroke: '#475569' }} />
                <Scatter data={scatterData} shape={renderBubble} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        {noAttackPlayers.length > 0 && (
          <div className="px-4 pb-3 text-slate-500 text-[11px]">
            {t('scatterNoAttacks')}{' '}
            {noAttackPlayers.map((n, i) => <span key={n}>{i > 0 && ', '}<bdi dir="ltr">{n}</bdi></span>)}
          </div>
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
          <div className="py-10 text-center text-slate-500 text-sm">—</div>
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
                  formatter={(v, key) => [Math.abs(v) < 0.01 ? 0 : Math.abs(v), key === 'pos' ? t('posLabel') : t('negLabel')]}
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
