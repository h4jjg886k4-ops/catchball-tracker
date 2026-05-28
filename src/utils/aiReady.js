/**
 * AI-Ready Data Extraction Layer
 * These functions format match data for future AI feature integration.
 * Pattern detection, substitution suggestions, and match summaries
 * can be added here once an AI backend is connected.
 */

export function extractMatchContext(match) {
  return {
    matchId: match.id,
    date: match.date,
    homeTeam: match.homeTeam.name,
    opponentTeam: match.opponentTeam.name,
    sets: match.sets.map((set, i) => ({
      setNumber: i + 1,
      score: { home: set.homeScore, opponent: set.opponentScore },
      winner: set.winner,
      eventCount: (set.events || []).length,
      attackDrawingsCount: (set.attackDrawings || []).length,
    })),
    status: match.status,
  };
}

export function extractAttackPatterns(sets) {
  const allDrawings = sets.flatMap(s => s.attackDrawings || []);
  return {
    totalAttacks: allDrawings.length,
    attacksBySet: sets.map((s, i) => ({
      set: i + 1,
      count: (s.attackDrawings || []).length,
    })),
    // Attack endpoint clusters for zone analysis
    attackEndpoints: allDrawings.map(d => ({
      timestamp: d.timestamp,
      score: d.score,
      endPoint: d.endPoint,
      zone: classifyCourtZone(d.endPoint),
    })).filter(d => d.endPoint),
  };
}

export function extractPlayerTrends(playerId, sets) {
  const setStats = sets.map((set, i) => {
    const events = (set.events || []).filter(e => e.playerId === playerId);
    return {
      set: i + 1,
      events: events.map(e => ({ type: e.type, score: { home: e.homeScore, opponent: e.opponentScore } })),
    };
  });
  return { playerId, setStats };
}

export function extractRotationData(sets) {
  const rotationData = Array(6).fill(null).map((_, i) => ({
    position: i + 1,
    pointsScored: 0,
    pointsAllowed: 0,
    events: [],
  }));

  sets.forEach(set => {
    (set.events || []).forEach(event => {
      const idx = (event.rotationIndex || 0) % 6;
      rotationData[idx].events.push(event.type);
    });
  });

  return rotationData;
}

function classifyCourtZone(point) {
  if (!point) return null;
  // Divide court into 6 zones (2 rows × 3 cols)
  const col = point.x < 0.33 ? 'left' : point.x < 0.67 ? 'center' : 'right';
  const row = point.y < 0.5 ? 'deep' : 'shallow';
  return `${row}-${col}`;
}

// Placeholder for future AI API calls
export async function requestSubstitutionSuggestion(matchContext, currentRotation, score) {
  // TODO: Connect to AI backend
  return null;
}

export async function requestMatchSummary(match) {
  // TODO: Connect to AI backend (e.g., Claude API)
  return null;
}

export async function requestOpponentTendencyAnalysis(attackPatterns) {
  // TODO: Connect to AI backend
  return null;
}
