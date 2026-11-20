import { EVENT_TYPES as T, HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS } from './constants';

const ATTACK_WIN_TYPES  = new Set([T.ATTACK_WIN_2ND, T.ATTACK_WIN_3RD]);
const ATTACK_CONT_TYPES = new Set([T.ATTACK_CONT_2ND, T.ATTACK_CONT_3RD]);
const ATTACK_ERR_TYPES  = new Set([T.ATTACK_OUT, T.ATTACK_BLOCKED, T.ATTACK_NET_TOUCH, T.ATTACK_STEPS]);
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
  const attackSteps  = ev.filter(e => e.type === T.ATTACK_STEPS).length;
  const attackBlocked= ev.filter(e => e.type === T.ATTACK_BLOCKED).length;
  const attackTotal  = attackAll.length;

  // Standard efficiency: (kills − out − steps − blocked) / total
  const attackEfficiency = attackTotal > 0
    ? Math.round((attackKills - attackOut - attackSteps - attackBlocked) / attackTotal * 100)
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

  const blockMistakes          = ev.filter(e => e.type === T.BLOCK_MISTAKE).length;
  const blockErrors            = ev.filter(e => e.type === T.BLOCK_ERROR).length;
  const defenceLocationErrors  = ev.filter(e => e.type === T.DEFENCE_LOCATION_ERROR).length;
  const attackNetTouch         = ev.filter(e => e.type === T.ATTACK_NET_TOUCH).length;

  const points = aces + attackKills + blocks +
    ev.filter(e => e.type === T.OPPONENT_ERROR).length;

  const errors = serveErrors + attackOut + attackSteps + attackBlocked + attackNetTouch + defenseError + setError + blockErrors + defenceLocationErrors;

  // Card display stats (live match player grid)
  const cardPoints   = aces + attackKills + blocks;
  const cardAttacks  = attackTotal;
  const cardMistakes = serveErrors + defenseError + setError + blockMistakes + blockErrors + defenceLocationErrors;

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
    attackSteps,
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
    attackErrors: attackOut + attackSteps + attackBlocked,
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
    blockTouchesTotal: allEvents.filter(e => e.type === T.BLOCK || e.type === T.BLOCK_TOUCH).length,
    serves: allEvents.filter(e => SERVE_TYPES.has(e.type)).length,
    serveErrors: allEvents.filter(e => e.type === T.SERVE_ERROR).length,
    rotationEfficiency: calcRotationEfficiency(sets),
    setsWon: sets.filter(s => s.winner === 'home').length,
    setsLost: sets.filter(s => s.winner === 'opponent').length,
    totalHomeScore: sets.reduce((s, set) => s + (set.homeScore || 0), 0),
    totalOpponentScore: sets.reduce((s, set) => s + (set.opponentScore || 0), 0),
  };
}

// Front row = P4, P3, P2 (rotation indices 3, 2, 1), listed left → right as on court.
const FRONT_ROW_IDX = [3, 2, 1];

// Which team won the rally an event ended, or null if the rally continues
function rallyWinner(event) {
  if (HOME_SCORE_EVENTS.has(event.type)) return 'home';
  if (OPPONENT_SCORE_EVENTS.has(event.type)) return 'opponent';
  if (event.type === 'manual_score') return event.scoringTeam ?? null;
  return null;
}

// One row per distinct front-row trio (exact P2/P3/P4 lineup from each event's
// rotationSnapshot) — a substitution produces a new trio, so before/after are never merged.
// efficiency = rallies won − rallies lost while the trio was front row; pct = % won.
export function calcRotationEfficiency(sets) {
  const combos = new Map();
  sets.forEach(set => {
    (set.events || []).forEach(event => {
      const winner = rallyWinner(event);
      if (!winner || !Array.isArray(event.rotationSnapshot)) return;
      const playerIds = FRONT_ROW_IDX.map(idx => event.rotationSnapshot[idx] || '');
      const rotationIndex = (event.rotationIndex || 0) % 6;
      const key = `${rotationIndex}|${playerIds.join('|')}`;
      if (!combos.has(key)) combos.set(key, { key, position: rotationIndex + 1, playerIds, won: 0, lost: 0 });
      const c = combos.get(key);
      if (winner === 'home') c.won++; else c.lost++;
    });
  });
  return [...combos.values()].map(c => {
    const rallies = c.won + c.lost;
    return {
      ...c,
      rallies,
      points: c.won,
      efficiency: c.won - c.lost,
      pct: rallies > 0 ? Math.round(c.won / rallies * 100) : null,
    };
  });
}

// Side-out % (rallies won on opponent serve) and hold % (rallies won on our serve).
// Uses the servingTeam recorded on each event, so manual +1 points count too.
export function calcServeOutcomes(sets) {
  const sideOut = { won: 0, total: 0 };
  const hold    = { won: 0, total: 0 };
  sets.forEach(set => {
    let serving = set.startServingTeam || 'home';
    (set.events || []).forEach(event => {
      const winner = rallyWinner(event);
      if (!winner) return;
      const server = event.servingTeam || serving;
      const bucket = server === 'home' ? hold : sideOut;
      bucket.total++;
      if (winner === 'home') bucket.won++;
      serving = winner;
    });
  });
  const pct = b => (b.total > 0 ? Math.round(b.won / b.total * 100) : null);
  return { sideOut: { ...sideOut, pct: pct(sideOut) }, hold: { ...hold, pct: pct(hold) } };
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
