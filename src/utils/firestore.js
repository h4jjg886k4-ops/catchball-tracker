/**
 * All Firestore read/write operations.
 * Data structure under users/{uid}/:
 *   currentMatch/active  — live match in progress (no imageData)
 *   matches/{matchId}    — completed match history (no imageData)
 *   drawings/{key}       — drawing imageData keyed as {matchId}_{setIndex}_{drawingId}
 *   teams/{teamId}       — saved rosters
 *   settings/prefs       — language + appMode
 *
 * attackDrawings and blockingDrawings are stored WITHOUT imageData in the match
 * document (to stay well under Firestore's 1 MB limit).  imageData is saved
 * separately in the drawings collection and merged back on load.
 */
import { db } from '../firebase';
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, getDocs, query, where,
} from 'firebase/firestore';

// ── Drawing image data helpers ────────────────────────────────────────────────

function withoutDrawingImages(match) {
  if (!match?.sets) return match;
  return {
    ...match,
    sets: match.sets.map(set => ({
      ...set,
      attackDrawings:  (set.attackDrawings  || []).map(({ imageData: _i, ...d }) => d),
      blockingDrawings:(set.blockingDrawings || []).map(({ imageData: _i, ...d }) => d),
    })),
  };
}

function withDrawingImages(match, drawingsMap) {
  if (!match?.sets || !Object.keys(drawingsMap).length) return match;
  return {
    ...match,
    sets: match.sets.map(set => ({
      ...set,
      attackDrawings:  (set.attackDrawings  || []).map(d => ({ ...d, imageData: drawingsMap[d.id] || null })),
      blockingDrawings:(set.blockingDrawings || []).map(d => ({ ...d, imageData: drawingsMap[d.id] || null })),
    })),
  };
}

// ── Drawing sub-documents ─────────────────────────────────────────────────────

export async function saveDrawingFS(uid, matchId, setIndex, drawingId, imageData) {
  if (!uid || !matchId || drawingId == null || !imageData) return;
  const key = `${matchId}_${setIndex}_${drawingId}`;
  await setDoc(doc(db, 'users', uid, 'drawings', key), {
    matchId, setIndex, drawingId, imageData, _savedAt: Date.now(),
  });
}

export async function loadDrawingsForMatchFS(uid, matchId) {
  if (!uid || !matchId) return {};
  const q = query(
    collection(db, 'users', uid, 'drawings'),
    where('matchId', '==', matchId),
  );
  const snap = await getDocs(q);
  const result = {};
  snap.docs.forEach(d => {
    const { drawingId, imageData } = d.data();
    if (drawingId && imageData) result[drawingId] = imageData;
  });
  return result; // { [drawingId]: imageData }
}

async function deleteDrawingsForMatchFS(uid, matchId) {
  if (!uid || !matchId) return;
  const q = query(
    collection(db, 'users', uid, 'drawings'),
    where('matchId', '==', matchId),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ── Current match ─────────────────────────────────────────────────────────────
export async function saveCurrentMatchFS(uid, match) {
  if (!uid || !match) return;
  // Hard guard: completed matches must never overwrite the active slot.
  if (match.status === 'completed') {
    console.warn('[firestore] saveCurrentMatchFS blocked — match is completed, use saveMatchFS instead');
    return;
  }
  await setDoc(doc(db, 'users', uid, 'currentMatch', 'active'), {
    ...withoutDrawingImages(match),
    _savedAt: Date.now(),
  });
}

export async function loadCurrentMatchFS(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'currentMatch', 'active'));
  if (!snap.exists()) return null;
  const match = snap.data();
  if (match?.id) {
    const drawingsMap = await loadDrawingsForMatchFS(uid, match.id);
    return withDrawingImages(match, drawingsMap);
  }
  return match;
}

export async function clearCurrentMatchFS(uid) {
  await deleteDoc(doc(db, 'users', uid, 'currentMatch', 'active'));
}

// ── Match history ─────────────────────────────────────────────────────────────
export async function saveMatchFS(uid, match) {
  await setDoc(doc(db, 'users', uid, 'matches', match.id), withoutDrawingImages(match));
}

export async function loadMatchesFS(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'matches'));
  return snap.docs
    .map(d => d.data())
    .sort((a, b) => b.date - a.date);
}

export async function deleteMatchFS(uid, matchId) {
  await Promise.all([
    deleteDoc(doc(db, 'users', uid, 'matches', matchId)),
    deleteDrawingsForMatchFS(uid, matchId),
  ]);
}

// ── Saved teams ───────────────────────────────────────────────────────────────
export async function saveTeamFS(uid, team) {
  await setDoc(doc(db, 'users', uid, 'teams', team.id), team);
}

export async function loadTeamsFS(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'teams'));
  return snap.docs
    .map(d => d.data())
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export async function deleteTeamFS(uid, teamId) {
  await deleteDoc(doc(db, 'users', uid, 'teams', teamId));
}

// ── User settings ─────────────────────────────────────────────────────────────
export async function saveSettingsFS(uid, partial) {
  await setDoc(doc(db, 'users', uid, 'settings', 'prefs'), partial, { merge: true });
}

export async function loadSettingsFS(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'prefs'));
  return snap.exists() ? snap.data() : { language: 'en', appMode: 'game' };
}
