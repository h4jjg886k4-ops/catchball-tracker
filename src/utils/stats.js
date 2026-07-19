import { EVENT_TYPES as T, HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from './constants';

const ATTACK_WIN_TYPES  = new Set([T.ATTACK_WIN_2ND, T.ATTACK_WIN_3RD]);
const ATTACK_CONT_TYPES = new Set([T.ATTACK_CONT_2ND, T.ATTACK_CONT_3RD]);
const ATTACK_ERR_TYPES  = new Set([T.ATTACK_OUT, T.ATTACK_BLOCKED]);
const ALL_ATTACK_TYPES  = new Set([...ATTACK_WIN_TYPES, ...ATTACK_CONT_TYPES, ...ATTACK_ERR_TYPES]);
const SERVE_TYPES       = new Set([T.ACE, T.SERVE_IN, T.SERVE_ERROR]);
const DEFENSE_TYPES     = new Set([T.DEFENSE_SUCCESS, T.DEFENSE_ERROR]);
const SET_TYPES         = new Set([T.SET_SUCCESS, T.SET_ERROR]);

export function calcPlayerStats(playerId, events) {
  const ev = events.filter(e => e.playerId === playerId);

  const attackWin    = ev.filter(e => ATTACK_WIN_TYPES.has(e.type));
  const attackCont   = ev.filter(e => ATTACK_CONT_TYPES.has(e.type));
  const attackErr    = ev.filter(e => ATTACK_ERR_TYPES.has(e.type));
  const attackAll    = ev.filter(e => ALL_ATTACK_TYPES.has(e.type));

  const serveAll     = ev.filter(e => SERVE_TYPES.has(e.type));
  const defenseAll   = ev.filter(e => DEFENSE_TYPES.has(e.type));
  const settingAll   = ev.filter(e => SET_TYPES.has(e.type));

  const aces         = ev.filter(e => e.type === T.ACE).length;
  const serveErrors  = ev.filter(e => e.type === T.SERVE_ERROR).length;
  const blocks       = ev.filter(e => e.type === T.BLOCK).length;

  const attackKills  = attackWin.length;                          // wins the point
  const attackKills2 = ev.filter(e => e.type === T.ATTACK_WIN_2ND).length;
  const attackKills3 = ev.filter(e => e.type === T.ATTACK_WIN_3RD).length;
  const attackContTotal = attackCont.length;                      // rally continues
  const attackOut    = ev.filter(e => e.type === T.ATTACK_OUT).length;
  const attackBlocked= ev.filter(e => e.type === T.ATTACK_BLOCKED).length;
  const attackTotal  = attackAll.length;

  // Standard efficiency: (kills − out − blocked) / total
  const attackEfficiency = attackTotal > 0
    ? Math.round((attackKills - attackOut - attackBlocked) / attackTotal * 100)
    : null;

  const servePct = serveAll.length > 0
    ? Math.round((serveAll.length - serveErrors) / serveAll.length * 100)
    : null;

  const defenseSuccess = ev.filter(e => e.type === T.DEFENSE_SUCCESS).length;
  const defenseError   = ev.filter(e => e.type === T.DEFENSE_ERROR).length;
  const defenseTotal   = defenseAll.length;
  const defensePct     = defenseTotal > 0
    ? Math.round(defenseSuccess / defenseTotal * 100)
    : null;

  const setSuccess   = ev.filter(e => e.type === T.SET_SUCCESS).length;
  const setError     = ev.filter(e => e.type === T.SET_ERROR).length;
  const setTotal     = settingAll.length;
  const setPct       = setTotal > 0
    ? Math.round(setSuccess / setTotal * 100)
    : null;

  const blockMistakes = ev.filter(e => e.type === T.BLOCK_MISTAKE).length;

  const points = aces + attackKills + blocks +
    ev.filter(e => e.type === T.OPPONENT_ERROR).length;

  const errors = serveErrors + attackOut + attackBlocked + defenseError + setError;

  // Card display stats (live match player grid)
  const cardPoints   = aces + attackKills + blocks;                   // direct-point actions only
  const cardAttacks  = attackTotal;                                   // all attack touches
  const cardMistakes = serveErrors + defenseError + setError + blockMistakes; // non-attack errors

  return {
    playerId,
    totalEvents: ev.length,
    // Summary
    points,
    errors,
    // Serve
    aces,
    serveTotal: serveAll.length,
    serveErrors,
    servePct,
    // Attack (keep `attackKills` and `attackPct` for backward-compat with StatsPage)
    attackKills,
    attackKills2nd: attackKills2,
    attackKills3rd: attackKills3,
    attackCont: attackContTotal,
    attackOut,
    attackBlocked,
    attackTotal,
    attackPct: attackEfficiency,   // alias kept for StatsPage grid
    attackEfficiency,
    // Defense
    defenseSuccess,
    defenseError,
    defenseTotal,
    defensePct,
    // Setting
    setSuccess,
    setError,
    setTotal,
    setPct,
    // Other
    blocks,
    blockMistakes,
    // Live match player card (3-stat display)
    cardPoints,
    cardAttacks,
    cardMistakes,
    // Legacy aliases used by StatsPage (map to new equivalents)
    attackErrors: attackOut + attackBlocked,
    receptionPct: defensePct,      // StatsPage still shows this column
    digs: defenseSuccess,
    sets: setSuccess,
  };
}

export function calcTeamStats(sets) {
  if (!sets || sets.length === 0) return null;

  const allEvents = sets.flatMap(s => s.events || []);

  let serveEffWins = 0, serveEffTotal = 0;
  sets.forEach(set => {
    let servingTeam = set.startServingTeam || 'home';
    (set.events || []).forEach(event => {
      if (HOME_SCORE_EVENTS.has(event.type)) {
        if (servingTeam === 'home') { serveEffWins++; serveEffTotal++; }
        servingTeam = 'home';
      } else if (OPPONENT_SCORE_EVENTS.has(event.type)) {
        if (servingTeam === 'home') serveEffTotal++;
        servingTeam = 'opponent';
      }
    });
  });

  const allAttackWin  = allEvents.filter(e => ATTACK_WIN_TYPES.has(e.type)).length;
  const allAttackErr  = allEvents.filter(e => ATTACK_ERR_TYPES.has(e.type)).length;
  const allAttackCont = allEvents.filter(e => ATTACK_CONT_TYPES.has(e.type)).length;
  const allAttackTotal = allAttackWin + allAttackErr + allAttackCont;
  const teamAttackPct = allAttackTotal > 0
    ? Math.round((allAttackWin - allAttackErr) / allAttackTotal * 100)
    : null;

  return {
    serveEffWins,
    serveEffTotal,
    serveEffPct: serveEffTotal > 0 ? Math.round(serveEffWins / serveEffTotal * 100) : null,
    teamAttackPct,
    allAttackSuccess: allAttackWin,
    allAttackError: allAttackErr,
    allAttackTotal,
    aces: allEvents.filter(e => e.type === T.ACE).length,
    blocks: allEvents.filter(e => e.type === T.BLOCK).length,
    serves: allEvents.filter(e => SERVE_TYPES.has(e.type)).length,
    serveErrors: allEvents.filter(e => e.type === T.SERVE_ERROR).length,
    rotationEfficiency: calcRotationEfficiency(sets),
    setsWon: sets.filter(s => s.winner === 'home').length,
    setsLost: sets.filter(s => s.winner === 'opponent').length,
    totalHomeScore: sets.reduce((s, set) => s + (set.homeScore || 0), 0),
    totalOpponentScore: sets.reduce((s, set) => s + (set.opponentScore || 0), 0),
  };
}

export function calcRotationEfficiency(sets) {
  const pts      = Array(6).fill(0);
  const rallies  = Array(6).fill(0);
  const frontRow = Array(6).fill(null).map(() => new Set());
  sets.forEach(set => {
    (set.events || []).forEach(event => {
      const i = (event.rotationIndex || 0) % 6;
      rallies[i]++;
      if (HOME_SCORE_EVENTS.has(event.type)) pts[i]++;
      if (Array.isArray(event.rotationSnapshot)) {
        // Front row: positions 2, 3, 4 = indices 1, 2, 3 of the rotation array
        [1, 2, 3].forEach(idx => {
          if (event.rotationSnapshot[idx]) frontRow[i].add(event.rotationSnapshot[idx]);
        });
      }
    });
  });
  return pts.map((p, i) => ({
    position: i + 1,
    points: p,
    rallies: rallies[i],
    efficiency: rallies[i] > 0 ? Math.round(p / rallies[i] * 100) : null,
    playerIds: [...frontRow[i]],
  }));
}

export function calcSetStats(set) {
  const events = set.events || [];
  return {
    homeScore: set.homeScore,
    opponentScore: set.opponentScore,
    homePoints:   events.filter(e => HOME_SCORE_EVENTS.has(e.type)).length,
    oppPoints:    events.filter(e => OPPONENT_SCORE_EVENTS.has(e.type)).length,
    totalRallies: events.length,
    aces:         events.filter(e => e.type === T.ACE).length,
    blocks:       events.filter(e => e.type === T.BLOCK).length,
    attackKills:  events.filter(e => ATTACK_WIN_TYPES.has(e.type)).length,
    attackErrors: events.filter(e => ATTACK_ERR_TYPES.has(e.type)).length,
    serveErrors:  events.filter(e => e.type === T.SERVE_ERROR).length,
    opponentErrors: events.filter(e => e.type === T.OPPONENT_ERROR).length,
    substitutions: (set.substitutions || []).length,
  };
}
