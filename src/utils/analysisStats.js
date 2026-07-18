import { EVENT_TYPES as T, HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from './constants';

const ATTACK_ERR_TYPES = new Set([T.ATTACK_OUT, T.ATTACK_BLOCKED]);
const ERROR_TYPES = new Set([T.SERVE_ERROR, T.ATTACK_OUT, T.ATTACK_BLOCKED, T.DEFENSE_ERROR, T.SET_ERROR, T.BLOCK_MISTAKE]);
const POINT_TYPES = new Set([T.ACE, T.ATTACK_WIN_2ND, T.ATTACK_WIN_3RD, T.BLOCK]);

export function calcAdvancedPlayerStats(playerId, events) {
  const ev = events.filter(e => e.playerId === playerId);

  const wins2nd       = ev.filter(e => e.type === T.ATTACK_WIN_2ND).length;
  const wins3rd       = ev.filter(e => e.type === T.ATTACK_WIN_3RD).length;
  const cont2nd       = ev.filter(e => e.type === T.ATTACK_CONT_2ND).length;
  const cont3rd       = ev.filter(e => e.type === T.ATTACK_CONT_3RD).length;
  const attackOut     = ev.filter(e => e.type === T.ATTACK_OUT).length;

  // Blocked attacks: split by ballNumber if available; events without ballNumber default to 3rd
  const blockedEvents   = ev.filter(e => e.type === T.ATTACK_BLOCKED);
  const attackBlocked   = blockedEvents.length;
  const blocked2nd      = blockedEvents.filter(e => e.ballNumber === 2).length;
  const blocked3rd      = blockedEvents.filter(e => e.ballNumber === 3).length;
  const blockedUnknown  = blockedEvents.filter(e => !e.ballNumber).length; // legacy, treat as 3rd
  const totalAttackErrors = attackOut + attackBlocked;

  // Ball-number–aware attempt counts include corresponding blocked attacks
  const attempts2nd = wins2nd + cont2nd + blocked2nd;
  const attempts3rd = wins3rd + cont3rd + blocked3rd + blockedUnknown;
  const totalAttackWins = wins2nd + wins3rd;
  const totalAttackAttempts = attempts2nd + attempts3rd + attackOut;

  const aces         = ev.filter(e => e.type === T.ACE).length;
  const blocks       = ev.filter(e => e.type === T.BLOCK).length;
  const blockTouches = ev.filter(e => e.type === T.BLOCK_TOUCH).length;
  const serveErrors  = ev.filter(e => e.type === T.SERVE_ERROR).length;
  const defenseError = ev.filter(e => e.type === T.DEFENSE_ERROR).length;
  const setError     = ev.filter(e => e.type === T.SET_ERROR).length;
  const blockMistake = ev.filter(e => e.type === T.BLOCK_MISTAKE).length;
  const opponentErrs = ev.filter(e => e.type === T.OPPONENT_ERROR).length;

  const totalPoints   = aces + totalAttackWins + blocks + opponentErrs;
  const totalMistakes = serveErrors + attackOut + attackBlocked + defenseError + setError + blockMistake;

  return {
    playerId,
    wins2nd, wins3rd, totalAttackWins,
    cont2nd, cont3rd,
    attackOut, attackBlocked, blocked2nd, blocked3rd, totalAttackErrors,
    attempts2nd, attempts3rd, totalAttackAttempts,
    pct2nd: attempts2nd > 0 ? Math.round(wins2nd / attempts2nd * 100) : null,
    pct3rd: attempts3rd > 0 ? Math.round(wins3rd / attempts3rd * 100) : null,
    overallAttackPct: totalAttackAttempts > 0 ? Math.round(totalAttackWins / totalAttackAttempts * 100) : null,
    totalPoints, totalMistakes,
    aces, blocks, blockTouches, serveErrors,
    defenseError, setError, blockMistake,
  };
}

export function calcAdvancedTeamStats(players, allEvents) {
  const stats = players.map(p => calcAdvancedPlayerStats(p.id, allEvents));
  const sum = fn => stats.reduce((s, p) => s + fn(p), 0);

  const total2ndAttempts    = sum(p => p.attempts2nd);
  const total2ndWins        = sum(p => p.wins2nd);
  const total3rdAttempts    = sum(p => p.attempts3rd);
  const total3rdWins        = sum(p => p.wins3rd);
  const totalAttackAttempts = sum(p => p.totalAttackAttempts);
  const totalAttackWins     = sum(p => p.totalAttackWins);

  return {
    totalPoints:       sum(p => p.totalPoints),
    totalAttackAttempts,
    totalAttackWins,
    teamAttackPct: totalAttackAttempts > 0 ? Math.round(totalAttackWins / totalAttackAttempts * 100) : null,
    team2ndPct:    total2ndAttempts > 0 ? Math.round(total2ndWins / total2ndAttempts * 100) : null,
    team3rdPct:    total3rdAttempts > 0 ? Math.round(total3rdWins / total3rdAttempts * 100) : null,
    total2ndAttempts, total2ndWins, total3rdAttempts, total3rdWins,
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
      case T.ATTACK_OUT: case T.ATTACK_BLOCKED: add('Attack Error'); break;
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

export async function fetchAIInsights(analysisData) {
  const { homeTeam, opponentTeam, team, playersSummary, momentum, clutchStats, errorStats } = analysisData;

  const scoreStr = s => s ? `${s.home}-${s.opp}` : 'N/A';
  const prompt = `You are an expert catchball coach analyst. Analyze this match and provide ${homeTeam}'s coach with 3-8 specific, data-driven coaching insights.

Match: ${homeTeam} vs ${opponentTeam}

TEAM STATS: Points=${team.totalPoints}, Attack%=${team.teamAttackPct ?? 'N/A'}%, 2nd-Ball%=${team.team2ndPct ?? 'N/A'}%(${team.total2ndWins}/${team.total2ndAttempts}), 3rd-Ball%=${team.team3rdPct ?? 'N/A'}%(${team.total3rdWins}/${team.total3rdAttempts}), Errors=${team.totalErrors}, Aces=${team.totalAces}, Blocks=${team.totalBlocks}

PLAYERS:
${playersSummary.map(p => `${p.name}(#${p.number}): ${p.totalPoints}pts, Overall%=${p.overallAttackPct ?? 'N/A'}%, 2nd%=${p.pct2nd ?? 'N/A'}%(${p.wins2nd}/${p.attempts2nd}), 3rd%=${p.pct3rd ?? 'N/A'}%(${p.wins3rd}/${p.attempts3rd}), Errors=${p.totalMistakes}, Aces=${p.aces}, Blocks=${p.blocks}`).join('\n')}

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
