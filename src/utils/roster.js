// Helpers for editing the home roster of a live match.

// True if the player ID appears anywhere in the match history. Such a player
// can only be deactivated, never removed — undo restores old rotationSnapshot /
// rotationHistory entries, so every place an ID is stored must be checked.
export function isPlayerReferenced(match, playerId) {
  if (!match || !playerId) return false;
  const inRotation = rot => Array.isArray(rot) && rot.includes(playerId);

  if ((match.rotationHistory || []).some(h => inRotation(h.rotation))) return true;

  return (match.sets || []).some(set =>
    inRotation(set.rotation) ||
    inRotation(set.startingRotation) ||
    (set.substitutions || []).some(s => s.outPlayerId === playerId || s.inPlayerId === playerId) ||
    (set.events || []).some(e =>
      e.playerId === playerId ||
      e.outPlayerId === playerId ||
      e.inPlayerId === playerId ||
      inRotation(e.rotationSnapshot)
    )
  );
}

// On court = what the court grid shows, i.e. the current set's rotation array.
export function isPlayerOnCourt(match, playerId) {
  const set = match?.sets?.[match.currentSetIndex];
  return !!set && (set.rotation || []).includes(playerId);
}

// "07" and "7" are the same jersey
function normNumber(n) {
  const s = String(n ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

// Other players (inactive included — they still appear in stats/log) wearing this number.
export function findDuplicateNumber(players, number, exceptId) {
  const num = normNumber(number);
  if (!num) return [];
  return players.filter(p => p.id !== exceptId && normNumber(p.number) === num);
}

// Saved home team whose name matches the match's home team (same key UPSERT_TEAM uses).
export function findSavedHomeTeam(savedTeams, teamName) {
  const name = (teamName || '').trim().toLowerCase();
  if (!name) return null;
  return savedTeams.find(t => t.type === 'home' && t.name.toLowerCase() === name) ?? null;
}

const norm = v => String(v ?? '').trim().toLowerCase();

// Find the saved-team player that corresponds to a match player.
// `original` is the player as it was before the edit (for the number+name fallback).
export function findTeamPlayer(team, original) {
  if (!team || !original) return null;
  const players = team.players || [];
  if (original.teamPlayerId) {
    const byLink = players.find(p => p.id === original.teamPlayerId);
    if (byLink) return byLink;
  }
  // Teams saved from the setup screen keep the setup-time IDs, which equal the match IDs
  const byId = players.find(p => p.id === original.id);
  if (byId) return byId;
  return players.find(p =>
    normNumber(p.number) === normNumber(original.number) && norm(p.name) === norm(original.name)
  ) ?? null;
}

// Plain roster entry for a saved team (drops match-only fields).
export function toTeamPlayer(player, id) {
  return { id, name: player.name, number: player.number, position: player.position || '' };
}
