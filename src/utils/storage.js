const STORAGE_KEY = 'volleyball_matches';
const CURRENT_MATCH_KEY = 'volleyball_current_match';

export function saveMatches(matches) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch (e) {
    console.warn('Could not save matches to localStorage:', e);
  }
}

export function loadMatches() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCurrentMatch(match) {
  try {
    localStorage.setItem(CURRENT_MATCH_KEY, JSON.stringify(match));
  } catch (e) {
    console.warn('Could not save current match:', e);
  }
}

export function loadCurrentMatch() {
  try {
    const data = localStorage.getItem(CURRENT_MATCH_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearCurrentMatch() {
  localStorage.removeItem(CURRENT_MATCH_KEY);
}

export function saveMatchToHistory(match, matches) {
  const existing = matches.findIndex(m => m.id === match.id);
  let updated;
  if (existing >= 0) {
    updated = [...matches];
    updated[existing] = match;
  } else {
    updated = [match, ...matches];
  }
  saveMatches(updated);
  return updated;
}

export function deleteMatch(matchId, matches) {
  const updated = matches.filter(m => m.id !== matchId);
  saveMatches(updated);
  return updated;
}

// ── Saved rosters ────────────────────────────────────────────────────────────
const SAVED_TEAMS_KEY = 'volleyball_saved_teams';

function writeSavedTeams(teams) {
  try { localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(teams)); }
  catch (e) { console.warn('Could not save teams:', e); }
}

export function loadSavedTeams() {
  try {
    const data = localStorage.getItem(SAVED_TEAMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Upsert: if a team with the same name (case-insensitive) and type already
// exists it is overwritten; otherwise a new entry is prepended.
export function upsertSavedTeam(team) {
  const teams = loadSavedTeams();
  const idx = teams.findIndex(
    t => t.type === team.type && t.name.toLowerCase() === team.name.toLowerCase()
  );
  const entry = { ...team, savedAt: Date.now() };
  const updated = idx >= 0
    ? teams.map((t, i) => (i === idx ? entry : t))
    : [entry, ...teams];
  writeSavedTeams(updated);
  return updated;
}

export function deleteSavedTeam(teamId) {
  const updated = loadSavedTeams().filter(t => t.id !== teamId);
  writeSavedTeams(updated);
  return updated;
}

// ── App mode ──────────────────────────────────────────────────────────────────
const APP_MODE_KEY = 'volleyball_app_mode';

export function loadAppMode() {
  return localStorage.getItem(APP_MODE_KEY) || 'game';
}

export function saveAppMode(mode) {
  try { localStorage.setItem(APP_MODE_KEY, mode); }
  catch (e) { console.warn('Could not save app mode:', e); }
}
