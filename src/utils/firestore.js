/**
 * All Firestore read/write operations.
 * Data structure under users/{uid}/:
 *   currentMatch/active  — live match in progress
 *   matches/{matchId}    — completed match history
 *   teams/{teamId}       — saved rosters
 *   settings/prefs       — language + appMode
 */
import { db } from '../firebase';
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, getDocs,
} from 'firebase/firestore';

// ── Current match ─────────────────────────────────────────────────────────────
export async function saveCurrentMatchFS(uid, match) {
  if (!uid || !match) return;
  await setDoc(doc(db, 'users', uid, 'currentMatch', 'active'), match);
}

export async function loadCurrentMatchFS(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'currentMatch', 'active'));
  return snap.exists() ? snap.data() : null;
}

export async function clearCurrentMatchFS(uid) {
  await deleteDoc(doc(db, 'users', uid, 'currentMatch', 'active'));
}

// ── Match history ─────────────────────────────────────────────────────────────
export async function saveMatchFS(uid, match) {
  await setDoc(doc(db, 'users', uid, 'matches', match.id), match);
}

export async function loadMatchesFS(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'matches'));
  return snap.docs
    .map(d => d.data())
    .sort((a, b) => b.date - a.date);
}

export async function deleteMatchFS(uid, matchId) {
  await deleteDoc(doc(db, 'users', uid, 'matches', matchId));
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
