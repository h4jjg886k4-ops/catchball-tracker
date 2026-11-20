import { EVENT_TYPES as T, HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from './constants';
import { normalizeDrawing } from './courtOrientation';

const ATTACK_ERR_TYPES = new Set([T.ATTACK_OUT, T.ATTACK_STEPS, T.ATTACK_BLOCKED]);
const ERROR_TYPES = new Set([
  T.SERVE_ERROR, T.ATTACK_OUT, T.ATTACK_STEPS, T.ATTACK_BLOCKED, T.ATTACK_NET_TOUCH,
  T.DEFENSE_ERROR, T.SET_ERROR, T.BLOCK_MISTAKE,
  T.BLOCK_ERROR, T.DEFENCE_LOCATION_ERROR,
]);
const POINT_TYPES = new Set([T.ACE, T.ATTACK_WIN_2ND, T.ATTACK_WIN_3RD, T.BLOCK]);
// Attack errors other than being blocked (they hand the opponent the point)
const ATTACK_FAULT_TYPES = new Set([T.ATTACK_OUT, T.ATTACK_STEPS, T.ATTACK_NET_TOUCH]);

// Below this many attempts an efficiency is flagged as a small sample (※)
export const SMALL_SAMPLE_ATTEMPTS = 10;

// "0.312" — volleyball notation, three decimals
export function formatEff(eff) {
  return eff === null || eff === undefined ? null : eff.toFixed(3);
}

// Standard volleyball attack efficiency: (kills − errors − blocked) ÷ total attempts,
// where attempts = kills + errors + blocked + unsuccessful (rally-continues) attacks.
export function attackEfficiency({ kills, errors, blocked, cont }) {
  const attempts = kills + errors + blocked + cont;
  return { attempts, eff: attempts > 0 ? (kills - errors - blocked) / attempts : null };
}

export function calcAdvancedPlayerStats(playerId, events) {
  const ev = events.filter(e => e.playerId === playerId);

  const wins2nd       = ev.filter(e => e.type === T.ATTACK_WIN_2ND).length;
  const wins3rd       = ev.filter(e => e.type === T.ATTACK_WIN_3RD).length;
  const cont2nd       = ev.filter(e => e.type === T.ATTACK_CONT_2ND).length;
  const cont3rd       = ev.filter(e => e.type === T.ATTACK_CONT_3RD).length;
  const attackOut     = ev.filter(e => e.type === T.ATTACK_OUT).length;
  const attackSteps   = ev.filter(e => e.type === T.ATTACK_STEPS).length;

  // Blocked attacks: split by ballNumber if available; events without ballNumber default to 3rd
  const blockedEvents   = ev.filter(e => e.type === T.ATTACK_BLOCKED);
  const attackBlocked   = blockedEvents.length;
  const blocked2nd      = blockedEvents.filter(e => e.ballNumber === 2).length;
  const blocked3rd      = blockedEvents.filter(e => e.ballNumber === 3).length;
  const blockedUnknown  = blockedEvents.filter(e => !e.ballNumber).length; // legacy, treat as 3rd
  const attackNetTouch  = ev.filter(e => e.type === T.ATTACK_NET_TOUCH).length;
  const totalAttackErrors = attackOut + attackSteps + attackBlocked + attackNetTouch;
  // Out / steps / net touch only count toward a ball number when it was recorded
  const faults2nd = ev.filter(e => ATTACK_FAULT_TYPES.has(e.type) && e.ballNumber === 2).length;
  const faults3rd = ev.filter(e => ATTACK_FAULT_TYPES.has(e.type) && e.ballNumber === 3).length;

  const totalAttackWins = wins2nd + wins3rd;
  const eff    = attackEfficiency({ kills: totalAttackWins, errors: attackOut + attackSteps + attackNetTouch, blocked: attackBlocked, cont: cont2nd + cont3rd });
  const eff2nd = attackEfficiency({ kills: wins2nd, errors: faults2nd, blocked: blocked2nd, cont: cont2nd });
  const eff3rd = attackEfficiency({ kills: wins3rd, errors: faults3rd, blocked: blocked3rd + blockedUnknown, cont: cont3rd });
  const attempts2nd = eff2nd.attempts;
  const attempts3rd = eff3rd.attempts;
  const totalAttackAttempts = eff.attempts;

  const aces         = ev.filter(e => e.type === T.ACE).length;
  const blocks       = ev.filter(e => e.type === T.BLOCK).length;
  const blockTouches = ev.filter(e => e.type === T.BLOCK_TOUCH).length;
  const serveErrors          = ev.filter(e => e.type === T.SERVE_ERROR).length;
  const defenseError         = ev.filter(e => e.type === T.DEFENSE_ERROR).length;
  const setError             = ev.filter(e => e.type === T.SET_ERROR).length;
  const blockMistake         = ev.filter(e => e.type === T.BLOCK_MISTAKE).length;
  const blockError           = ev.filter(e => e.type === T.BLOCK_ERROR).length;
  const defenceLocationError = ev.filter(e => e.type === T.DEFENCE_LOCATION_ERROR).length;
  const opponentErrs         = ev.filter(e => e.type === T.OPPONENT_ERROR).length;
  const defenseSuccess       = ev.filter(e => e.type === T.DEFENSE_SUCCESS).length;
  const serveIn              = ev.filter(e => e.type === T.SERVE_IN).length;
  const totalActions         = ev.filter(e => !e.isSubstitution).length;

  const totalPoints   = aces + totalAttackWins + blocks + opponentErrs;
  const totalMistakes = serveErrors + attackOut + attackSteps + attackBlocked + attackNetTouch + defenseError + setError + blockMistake + blockError + defenceLocationError;

  return {
    playerId,
    wins2nd, wins3rd, totalAttackWins,
    cont2nd, cont3rd,
    attackOut, attackSteps, attackBlocked, blocked2nd, blocked3rd, totalAttackErrors,
    attempts2nd, attempts3rd, totalAttackAttempts,
    attackEff: eff.eff,
    attackEff2nd: eff2nd.eff,
    attackEff3rd: eff3rd.eff,
    faults2nd, faults3rd,
    totalPoints, totalMistakes,
    aces, blocks, blockTouches, serveErrors,
    defenseError, setError, blockMistake, blockError, defenceLocationError, attackNetTouch,
    defenseSuccess, serveIn, totalActions,
  };
}

export function calcAdvancedTeamStats(players, allEvents) {
  const stats = players.map(p => calcAdvancedPlayerStats(p.id, allEvents));
  const sum = fn => stats.reduce((s, p) => s + fn(p), 0);

  const team    = attackEfficiency({ kills: sum(p => p.totalAttackWins), errors: sum(p => p.attackOut + p.attackSteps + p.attackNetTouch), blocked: sum(p => p.attackBlocked), cont: sum(p => p.cont2nd + p.cont3rd) });
  const team2nd = attackEfficiency({ kills: sum(p => p.wins2nd), errors: sum(p => p.faults2nd), blocked: sum(p => p.blocked2nd), cont: sum(p => p.cont2nd) });
  const team3rd = attackEfficiency({ kills: sum(p => p.wins3rd), errors: sum(p => p.faults3rd), blocked: sum(p => p.attackBlocked - p.blocked2nd), cont: sum(p => p.cont3rd) });

  return {
    totalPoints:       sum(p => p.totalPoints),
    totalAttackAttempts: team.attempts,
    totalAttackWins:   sum(p => p.totalAttackWins),
    teamAttackEff: team.eff,
    team2ndEff:    team2nd.eff,
    team3rdEff:    team3rd.eff,
    total2ndAttempts: team2nd.attempts, total2ndWins: sum(p => p.wins2nd),
    total3rdAttempts: team3rd.attempts, total3rdWins: sum(p => p.wins3rd),
    totalErrors:      sum(p => p.totalMistakes),
    totalBlockTouches: sum(p => p.blockTouches),
    totalAces:        sum(p => p.aces),
    totalBlocks:      sum(p => p.blocks),
  };
}

export function calcMomentum(allEvents) {
  const scoring = allEvents.filter(e => HOME_SCORE_EVENTS.has(e.type) || OPPONENT_SCORE_EVENTS.has(e.type));
  if (!scoring.length) return null;

  let curHomeRun = 0, curOppRun = 0;
  let maxHomeRun = { count: 0, startScore: null, endScore: null };
  let maxOppRun  = { count: 0, startScore: null, endScore: null };
  let maxLead = 0, maxLeadScore = null;
  let curHomeRunStart = null, curOppRunStart = null;

  for (const ev of scoring) {
    if (HOME_SCORE_EVENTS.has(ev.type)) {
      if (curHomeRun === 0) curHomeRunStart = { home: ev.homeScore - 1, opp: ev.opponentScore };
      curHomeRun++;
      const end = { home: ev.homeScore, opp: ev.opponentScore };
      if (curHomeRun > maxHomeRun.count) maxHomeRun = { count: curHomeRun, startScore: curHomeRunStart, endScore: end };
      curOppRun = 0; curOppRunStart = null;
    } else {
      if (curOppRun === 0) curOppRunStart = { home: ev.homeScore, opp: ev.opponentScore - 1 };
      curOppRun++;
      const end = { home: ev.homeScore, opp: ev.opponentScore };
      if (curOppRun > maxOppRun.count) maxOppRun = { count: curOppRun, startScore: curOppRunStart, endScore: end };
      curHomeRun = 0; curHomeRunStart = null;
    }

    const lead = ev.homeScore - ev.opponentScore;
    if (lead > maxLead) { maxLead = lead; maxLeadScore = { home: ev.homeScore, opp: ev.opponentScore }; }
  }

  return { maxHomeRun, maxOppRun, maxLead, maxLeadScore };
}

export function calcClutchStats(playerId, allEvents) {
  let clutchPoints = 0, clutchErrors = 0;

  for (const ev of allEvents) {
    if (ev.playerId !== playerId) continue;
    if (!POINT_TYPES.has(ev.type) && !ERROR_TYPES.has(ev.type)) continue;

    const homeBefore = HOME_SCORE_EVENTS.has(ev.type) ? ev.homeScore - 1 : ev.homeScore;
    const oppBefore  = OPPONENT_SCORE_EVENTS.has(ev.type) ? ev.opponentScore - 1 : ev.opponentScore;
    const maxScore   = Math.max(homeBefore, oppBefore);
    const diff       = Math.abs(homeBefore - oppBefore);
    const isClutch   = maxScore >= 18 || (homeBefore >= 15 && oppBefore >= 15 && diff <= 2);
    if (!isClutch) continue;

    if (POINT_TYPES.has(ev.type)) clutchPoints++;
    else clutchErrors++;
  }

  const clutchTotal = clutchPoints + clutchErrors;
  return {
    playerId, clutchPoints, clutchErrors, clutchTotal,
    clutchPct: clutchTotal > 0 ? Math.round(clutchPoints / clutchTotal * 100) : null,
  };
}

export function calcErrorByGameState(playerId, allEvents) {
  let leading = 0, tied = 0, trailing = 0;

  for (const ev of allEvents) {
    if (ev.playerId !== playerId || !ERROR_TYPES.has(ev.type)) continue;
    const homeBefore = ev.homeScore;
    const oppBefore  = OPPONENT_SCORE_EVENTS.has(ev.type) ? ev.opponentScore - 1 : ev.opponentScore;
    if (homeBefore > oppBefore) leading++;
    else if (homeBefore === oppBefore) tied++;
    else trailing++;
  }

  return { playerId, leading, tied, trailing, total: leading + tied + trailing };
}

// Returns [{setNum, data: [{rally, home, opponent}]}] — one entry per set.
// setIndexOffset shifts set numbers so a single-element filtered array shows the right label.
export function buildScoreTimeline(sets, setIndexOffset = 0) {
  return sets.map((set, idx) => {
    const points = [];
    for (const ev of (set.events || [])) {
      if (HOME_SCORE_EVENTS.has(ev.type) || OPPONENT_SCORE_EVENTS.has(ev.type)) {
        points.push({ rally: points.length + 1, home: ev.homeScore, opponent: ev.opponentScore });
      }
    }
    return { setNum: setIndexOffset + idx + 1, data: points };
  }).filter(s => s.data.length > 0);
}

export function calcEventDistribution(allEvents) {
  const cats = {};
  const add = name => { cats[name] = (cats[name] || 0) + 1; };

  for (const ev of allEvents) {
    switch (ev.type) {
      case T.ATTACK_WIN_2ND: case T.ATTACK_WIN_3RD: add('Attack Win'); break;
      case T.ATTACK_CONT_2ND: case T.ATTACK_CONT_3RD: add('Attack Cont.'); break;
      case T.ATTACK_OUT: case T.ATTACK_STEPS: case T.ATTACK_BLOCKED: add('Attack Error'); break;
      case T.ACE: add('Ace'); break;
      case T.SERVE_ERROR: add('Serve Error'); break;
      case T.SERVE_IN: add('Serve In'); break;
      case T.BLOCK: add('Block'); break;
      case T.DEFENSE_SUCCESS: add('Defense'); break;
      case T.DEFENSE_ERROR: add('Def. Error'); break;
      case T.OPPONENT_ERROR: add('Opp. Error'); break;
      default: add('Other'); break;
    }
  }

  return Object.entries(cats)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
}

export function calcServeEfficiency(sets) {
  let wins = 0, total = 0;
  sets.forEach(set => {
    let serving = set.startServingTeam || 'home';
    (set.events || []).forEach(ev => {
      if (HOME_SCORE_EVENTS.has(ev.type)) {
        if (serving === 'home') { wins++; total++; }
        serving = 'home';
      } else if (OPPONENT_SCORE_EVENTS.has(ev.type)) {
        if (serving === 'home') total++;
        serving = 'opponent';
      }
    });
  });
  return { wins, total, pct: total > 0 ? Math.round(wins / total * 100) : null };
}

// Positive / negative halves of the weighted contribution score
export function calcContributionParts(stats) {
  const pos =
    (stats.wins2nd + stats.wins3rd) * 2 +
    stats.aces * 2 +
    stats.blocks * 2 +
    stats.blockTouches * 1 +
    (stats.cont2nd + stats.cont3rd) * 0.5;
  const neg =
    stats.serveErrors +
    stats.attackOut +
    (stats.attackSteps || 0) +
    stats.attackBlocked +
    (stats.attackNetTouch || 0) +
    (stats.defenseError || 0) +
    (stats.setError || 0) +
    (stats.blockMistake || 0) +
    (stats.blockError || 0) +
    (stats.defenceLocationError || 0);
  const round = v => Math.round(v * 10) / 10;
  return { pos: round(pos), neg: round(neg) };
}

export function calcContributionScore(stats) {
  const { pos, neg } = calcContributionParts(stats);
  return Math.round((pos - neg) * 10) / 10;
}

// Single source of truth for "best player": the contribution table and the summary
// card both rank with this, so they can never disagree (ties keep roster order).
export function rankByContribution(playerAdvancedList) {
  return playerAdvancedList
    .map(({ player, stats }) => ({ player, stats, score: calcContributionScore(stats) }))
    .sort((a, b) => b.score - a.score);
}

// Top of the ranking, or null when nobody has a non-zero contribution yet
export function pickBestPlayer(ranked) {
  return ranked.some(r => r.score !== 0) ? ranked[0] : null;
}

export function detectMomentumShifts(sets, minRun = 3) {
  const result = [];
  sets.forEach((set, setIdx) => {
    const events = (set.events || []).filter(e =>
      HOME_SCORE_EVENTS.has(e.type) || OPPONENT_SCORE_EVENTS.has(e.type)
    );
    let curTeam = null, runStart = 0, runCount = 0, runStartEv = null, rally = 0;

    const flush = () => {
      if (runCount >= minRun) {
        result.push({ setIdx, rally: runStart, team: curTeam, count: runCount, startEventType: runStartEv?.type });
      }
    };

    events.forEach(ev => {
      rally++;
      const team = HOME_SCORE_EVENTS.has(ev.type) ? 'home' : 'opponent';
      if (team === curTeam) {
        runCount++;
      } else {
        flush();
        curTeam = team; runStart = rally; runCount = 1; runStartEv = ev;
      }
    });
    flush();
  });
  return result;
}

// ── Front row combination analysis ────────────────────────────────────────────
// Front row = positions P2/P3/P4 = indices 1,2,3 of rotationSnapshot (see RotationView.jsx).
const FRONT_ROW_INDICES = [1, 2, 3];

const ATTACK_WIN_TYPES     = new Set([T.ATTACK_WIN_2ND, T.ATTACK_WIN_3RD]);
const ATTACK_CONT_TYPES    = new Set([T.ATTACK_CONT_2ND, T.ATTACK_CONT_3RD]);
// Block-attributable outcomes vs. an opponent attack: we stopped it (BLOCK) or the opponent
// scored because of a block/defensive-position mistake (BLOCK_ERROR / DEFENCE_LOCATION_ERROR).
const BLOCK_OUTCOME_TYPES   = new Set([T.BLOCK, T.BLOCK_ERROR, T.DEFENCE_LOCATION_ERROR]);
const BLOCK_SCORED_AGAINST_TYPES = new Set([T.BLOCK_ERROR, T.DEFENCE_LOCATION_ERROR]);
const RALLY_END_TYPES = new Set([...HOME_SCORE_EVENTS, ...OPPONENT_SCORE_EVENTS]);

function frontRowIds(rotationSnapshot) {
  if (!Array.isArray(rotationSnapshot)) return null;
  const ids = FRONT_ROW_INDICES.map(i => rotationSnapshot[i]);
  return ids.every(Boolean) ? ids : null;
}

function comboKey(ids) {
  return ids.slice().sort().join('|');
}

function comboNames(ids, playerMap) {
  return ids.map(id => playerMap[id]?.name || '?').sort((a, b) => a.localeCompare(b));
}

// Returns one row per unique trio of front-row players seen in `events`, with attack
// effectiveness, block effectiveness, and total rallies played at the net.
export function calcFrontRowCombos(players, events) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const combos = {};

  for (const ev of events) {
    const ids = frontRowIds(ev.rotationSnapshot);
    if (!ids) continue;
    const key = comboKey(ids);
    if (!combos[key]) {
      combos[key] = { ids, kills: 0, faults: 0, blocked: 0, cont: 0, blockAttempts: 0, blockScoredAgainst: 0, rallies: 0 };
    }
    const c = combos[key];
    if (ATTACK_WIN_TYPES.has(ev.type)) c.kills++;
    else if (ATTACK_FAULT_TYPES.has(ev.type)) c.faults++;
    else if (ev.type === T.ATTACK_BLOCKED) c.blocked++;
    else if (ATTACK_CONT_TYPES.has(ev.type)) c.cont++;
    if (BLOCK_OUTCOME_TYPES.has(ev.type)) {
      c.blockAttempts++;
      if (BLOCK_SCORED_AGAINST_TYPES.has(ev.type)) c.blockScoredAgainst++;
    }
    if (RALLY_END_TYPES.has(ev.type)) c.rallies++;
  }

  return Object.values(combos).map(c => {
    const { eff, attempts } = attackEfficiency({ kills: c.kills, errors: c.faults, blocked: c.blocked, cont: c.cont });
    return {
    names: comboNames(c.ids, playerMap),
    attackAttempts: attempts,
    attackWins: c.kills,
    attackEff: eff,
    blockAttempts: c.blockAttempts,
    blockScoredAgainst: c.blockScoredAgainst,
    blockStopped: c.blockAttempts - c.blockScoredAgainst,
    blockStopPct: c.blockAttempts > 0 ? Math.round((c.blockAttempts - c.blockScoredAgainst) / c.blockAttempts * 100) : null,
    rallies: c.rallies,
    };
  });
}

// ── Blocking zone weakness analysis ───────────────────────────────────────────
// Opponent attacks that beat our block/defensive positioning (block_error, defence_location_error)
// are the only events that both (a) score for the opponent and (b) carry a court drawing with a
// startPoint — so they're the only ones we can attribute to a court zone.
const ZONE_IDS = ['antennaLeft', 'zone43', 'center', 'zone32', 'antennaRight'];

function zoneForX(x) {
  if (x < 0.2) return 'antennaLeft';
  if (x < 0.4) return 'zone43';
  if (x < 0.6) return 'center';
  if (x < 0.8) return 'zone32';
  return 'antennaRight';
}

// Returns { zones: [{zoneId, count, sharePct, topCombo}], totalScored }
export function calcBlockingZoneStats(sets, players) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const byZone = {};
  ZONE_IDS.forEach(id => { byZone[id] = { count: 0, comboCounts: {} }; });
  let totalScored = 0;

  for (const set of sets) {
    const drawings = set.attackDrawings || [];
    const triggerEvents = (set.events || []).filter(e => e.type === T.BLOCK_ERROR || e.type === T.DEFENCE_LOCATION_ERROR);
    for (const rawDrawing of drawings) {
      const drawing = normalizeDrawing(rawDrawing);
      const triggerEvent = triggerEvents.find(e => e.timestamp === drawing.timestamp);
      if (!triggerEvent) continue; // drawing came from a different trigger (our own attack error)
      const startPt = drawing.paths?.[0]?.points?.[0];
      if (!startPt) continue;

      const zoneId = zoneForX(startPt.x);
      byZone[zoneId].count++;
      totalScored++;

      const ids = frontRowIds(triggerEvent.rotationSnapshot);
      if (ids) {
        const key = comboKey(ids);
        byZone[zoneId].comboCounts[key] = (byZone[zoneId].comboCounts[key] || 0) + 1;
      }
    }
  }

  const zones = ZONE_IDS.map(zoneId => {
    const z = byZone[zoneId];
    const topComboEntry = Object.entries(z.comboCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      zoneId,
      count: z.count,
      sharePct: totalScored > 0 ? Math.round(z.count / totalScored * 100) : 0,
      topCombo: topComboEntry
        ? { names: comboNames(topComboEntry[0].split('|'), playerMap), count: topComboEntry[1] }
        : null,
    };
  });

  return { zones, totalScored };
}

const fmtEffForAI = eff => formatEff(eff) ?? 'N/A';

export async function fetchAIInsights(analysisData) {
  const { homeTeam, opponentTeam, team, playersSummary, momentum, clutchStats, errorStats } = analysisData;

  const scoreStr = s => s ? `${s.home}-${s.opp}` : 'N/A';
  const prompt = `You are an expert catchball coach analyst. Analyze this match and provide ${homeTeam}'s coach with 3-8 specific, data-driven coaching insights.

Match: ${homeTeam} vs ${opponentTeam}

TEAM STATS: Points=${team.totalPoints}, AttackEff=${fmtEffForAI(team.teamAttackEff)}(${team.totalAttackAttempts} att), 2nd-BallEff=${fmtEffForAI(team.team2ndEff)}(${team.total2ndAttempts} att), 3rd-BallEff=${fmtEffForAI(team.team3rdEff)}(${team.total3rdAttempts} att), Errors=${team.totalErrors}, Aces=${team.totalAces}, Blocks=${team.totalBlocks}

PLAYERS:
${playersSummary.map(p => `${p.name}(#${p.number}): ${p.totalPoints}pts, AttackEff=${fmtEffForAI(p.attackEff)}(${p.totalAttackAttempts} att), 2ndEff=${fmtEffForAI(p.attackEff2nd)}(${p.attempts2nd} att), 3rdEff=${fmtEffForAI(p.attackEff3rd)}(${p.attempts3rd} att), Errors=${p.totalMistakes}, Aces=${p.aces}, Blocks=${p.blocks}`).join('\n')}

MOMENTUM: Best home run=${momentum?.maxHomeRun?.count ?? 0}pts from ${scoreStr(momentum?.maxHomeRun?.startScore)} to ${scoreStr(momentum?.maxHomeRun?.endScore)}, Best opp run=${momentum?.maxOppRun?.count ?? 0}pts, Largest lead=+${momentum?.maxLead ?? 0} at ${scoreStr(momentum?.maxLeadScore)}

CLUTCH (score≥18 or both≥15 and diff≤2):
${clutchStats.map(c => `${c.name}: ${c.clutchPoints}pts, ${c.clutchErrors}errors, ${c.clutchTotal > 0 ? c.clutchPct + '%' : 'N/A'}`).join(' | ')}

ERRORS BY STATE (leading/tied/trailing):
${errorStats.map(e => `${e.name}: ${e.leading}/${e.tied}/${e.trailing} total=${e.total}`).join(' | ')}

Return ONLY a JSON array of 3-8 insight strings. Every insight must reference specific numbers and player names from this data. Be concrete and actionable for the coach.
Example format: ["Insight 1.", "Insight 2."]`;

  const response = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (response.status === 503) throw new Error('NO_KEY');
  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let errMsg = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed.error) errMsg = parsed.error;
    } catch { /* not JSON — use raw body */ }
    throw new Error(`HTTP ${response.status}: ${errMsg || '(empty response)'}`);
  }
  const data = await response.json();
  if (!data.content?.[0]?.text) throw new Error('Empty response from API');
  const text = data.content[0].text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Unexpected format: ${text.slice(0, 120)}`);
  return JSON.parse(jsonMatch[0]);
}
