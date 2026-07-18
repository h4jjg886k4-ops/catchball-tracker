import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS, COURT_DRAW_EVENTS, VIEWS } from '../utils/constants';
import { useAuth } from './AuthContext';
import {
  saveCurrentMatchFS, loadCurrentMatchFS, clearCurrentMatchFS,
  saveMatchFS, loadMatchesFS, deleteMatchFS,
  saveTeamFS, loadTeamsFS, deleteTeamFS,
  saveSettingsFS, loadSettingsFS,
} from '../utils/firestore';

const MatchContext = createContext(null);

// ── Set / match factories ─────────────────────────────────────────────────────
function createEmptySet(setNumber, startServingTeam = 'home') {
  return {
    id: setNumber,
    homeScore: 0,
    opponentScore: 0,
    events: [],
    rotation: ['', '', '', '', '', ''],
    startingRotation: ['', '', '', '', '', ''],
    startServingTeam,
    serveConfirmed: false,
    substitutions: [],
    attackDrawings: [],
    blockingDrawings: [],
    status: 'active',
    winner: null,
    startTime: Date.now(),
    endTime: null,
  };
}

function createEmptyMatch(homeTeam, opponentTeam) {
  return {
    id: uuidv4(),
    date: Date.now(),
    homeTeam,
    opponentTeam,
    sets: [createEmptySet(1, 'home')],
    currentSetIndex: 0,
    status: 'active',
    servingTeam: 'home',
    currentRotationIndex: 0,
    rotationVersion: 0,
    rotationHistory: [],
  };
}

function applyRotation(rotation) {
  return [...rotation.slice(1), rotation[0]];
}

// Upsert match into the matches array (no localStorage)
function upsertMatch(match, matches) {
  const idx = matches.findIndex(m => m.id === match.id);
  if (idx >= 0) {
    const updated = [...matches];
    updated[idx] = match;
    return updated;
  }
  return [match, ...matches];
}

// ── Initial state ─────────────────────────────────────────────────────────────
const initialState = {
  view: VIEWS.HOME,
  matches: [],
  currentMatch: null,
  savedTeams: [],
  appMode: 'game',
  selectedPlayerId: null,
  showCourtDraw: false,
  showHeatmap: false,
  showSubstitution: false,
  needsRotationSetup: false,
  needsServeSetup: false,
  lastScoreTeam: null,
  pendingCourtDraw: null,
  lastUndoneEvent: null,
};

// ── Reducer (pure — no storage side-effects) ──────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'HYDRATE':
      return {
        ...state,
        currentMatch:    action.currentMatch ?? null,
        matches:         action.matches      ?? [],
        savedTeams:      action.savedTeams   ?? [],
        appMode:         action.settings?.appMode ?? 'game',
        needsServeSetup: action.needsServeSetup ?? false,
      };

    case 'RESET':
      return { ...initialState };

    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'SET_APP_MODE':
      return { ...state, appMode: action.mode };

    // ── Saved teams ────────────────────────────────────────────────────────
    case 'UPSERT_TEAM': {
      const { team } = action;
      const idx = state.savedTeams.findIndex(
        t => t.type === team.type && t.name.toLowerCase() === team.name.toLowerCase()
      );
      const existingId = idx >= 0 ? state.savedTeams[idx].id : team.id;
      const entry = { ...team, id: existingId, savedAt: Date.now() };
      const savedTeams = idx >= 0
        ? state.savedTeams.map((t, i) => (i === idx ? entry : t))
        : [entry, ...state.savedTeams];
      return { ...state, savedTeams };
    }

    case 'DELETE_TEAM_FROM_STATE':
      return { ...state, savedTeams: state.savedTeams.filter(t => t.id !== action.teamId) };

    // ── Match setup ────────────────────────────────────────────────────────
    case 'START_NEW_MATCH_SETUP':
      return { ...state, view: VIEWS.SETUP, currentMatch: null, selectedPlayerId: null };

    case 'SETUP_COMPLETE': {
      const match = createEmptyMatch(action.homeTeam, action.opponentTeam);
      return { ...state, currentMatch: match, view: VIEWS.LIVE, needsServeSetup: true };
    }

    case 'LOAD_MATCH':
      return { ...state, currentMatch: action.match, view: VIEWS.LIVE, selectedPlayerId: null };

    // ── Player selection ───────────────────────────────────────────────────
    case 'SELECT_PLAYER':
      return { ...state, selectedPlayerId: action.playerId };

    case 'DESELECT_PLAYER':
      return { ...state, selectedPlayerId: null };

    // ── Record event ───────────────────────────────────────────────────────
    case 'RECORD_EVENT': {
      const { event } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];

      const isHomeScore     = HOME_SCORE_EVENTS.has(event.type);
      const isOpponentScore = OPPONENT_SCORE_EVENTS.has(event.type);

      let newHomeScore     = currentSet.homeScore;
      let newOpponentScore = currentSet.opponentScore;
      let newServingTeam   = match.servingTeam;
      let newRotationIndex = match.currentRotationIndex;
      let newRotation      = currentSet.rotation;
      let newRotationVersion = match.rotationVersion || 0;
      let newRotationHistory = [...(match.rotationHistory || [])];

      if (isHomeScore) {
        newHomeScore++;
        newServingTeam = 'home';
        if (match.servingTeam === 'opponent') {
          newRotationHistory = [...newRotationHistory, { rotation: currentSet.rotation, rotationIndex: match.currentRotationIndex }];
          newRotationIndex = (newRotationIndex + 1) % 6;
          newRotation = applyRotation(currentSet.rotation);
          newRotationVersion++;
        }
      } else if (isOpponentScore) {
        newOpponentScore++;
        newServingTeam = 'opponent';
      }

      const fullEvent = {
        ...event,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        rotationIndex: match.currentRotationIndex,
        servingTeam: match.servingTeam,
        rotationSnapshot: currentSet.rotation,
      };

      const updatedSet = {
        ...currentSet,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        events: [...currentSet.events, fullEvent],
        rotation: newRotation,
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        servingTeam: newServingTeam,
        currentRotationIndex: newRotationIndex,
        rotationVersion: newRotationVersion,
        rotationHistory: newRotationHistory,
      };

      const showCourtDraw = COURT_DRAW_EVENTS.has(event.type);
      return {
        ...state,
        currentMatch: updatedMatch,
        selectedPlayerId: null,
        showCourtDraw,
        lastScoreTeam: isHomeScore ? 'home' : isOpponentScore ? 'opponent' : null,
        pendingCourtDraw: showCourtDraw
          ? { setIndex, score: { home: newHomeScore, opponent: newOpponentScore }, timestamp: event.timestamp, eventType: event.type }
          : null,
        lastUndoneEvent: null,
      };
    }

    // ── Rotation ───────────────────────────────────────────────────────────
    case 'SET_ROTATION': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const updatedSet = {
        ...currentSet,
        rotation: action.rotation,
        startingRotation: currentSet.startingRotation[0] === '' ? action.rotation : currentSet.startingRotation,
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return { ...state, currentMatch: { ...match, sets: updatedSets }, needsRotationSetup: false };
    }

    case 'MANUAL_ROTATE': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const newRotationHistory = [...(match.rotationHistory || []), { rotation: currentSet.rotation, rotationIndex: match.currentRotationIndex }];
      const newRotIdx = (match.currentRotationIndex + 1) % 6;
      const newRotation = applyRotation(currentSet.rotation);
      const updatedSet = { ...currentSet, rotation: newRotation };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return {
        ...state,
        currentMatch: {
          ...match,
          sets: updatedSets,
          currentRotationIndex: newRotIdx,
          rotationVersion: (match.rotationVersion || 0) + 1,
          rotationHistory: newRotationHistory,
        },
      };
    }

    // ── Substitution ───────────────────────────────────────────────────────
    case 'ADD_SUBSTITUTION': {
      const { outPlayerId, inPlayerId } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const sub = {
        id: uuidv4(), timestamp: Date.now(), outPlayerId, inPlayerId,
        homeScore: currentSet.homeScore, opponentScore: currentSet.opponentScore,
      };
      const updatedSet = { ...currentSet, substitutions: [...currentSet.substitutions, sub] };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return { ...state, currentMatch: { ...match, sets: updatedSets }, showSubstitution: false };
    }

    // ── Court drawings ─────────────────────────────────────────────────────
    case 'SAVE_ATTACK_DRAWING': {
      const match = state.currentMatch;
      const { pendingCourtDraw } = state;
      if (!pendingCourtDraw) return { ...state, showCourtDraw: false };
      const setIndex = pendingCourtDraw.setIndex;
      const currentSet = match.sets[setIndex];
      const drawing = {
        id: uuidv4(),
        timestamp: pendingCourtDraw.timestamp,
        score: pendingCourtDraw.score,
        paths: action.paths,
        endPoint: action.endPoint,
        imageData: action.imageData,
      };
      const isBlockingMistake = pendingCourtDraw.eventType === 'block_mistake';
      const updatedSet = isBlockingMistake
        ? { ...currentSet, blockingDrawings: [...(currentSet.blockingDrawings || []), drawing] }
        : { ...currentSet, attackDrawings: [...currentSet.attackDrawings, drawing] };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return { ...state, currentMatch: { ...match, sets: updatedSets }, showCourtDraw: false, pendingCourtDraw: null };
    }

    case 'SKIP_ATTACK_DRAWING':
      return { ...state, showCourtDraw: false, pendingCourtDraw: null };

    // ── Score adjustment ───────────────────────────────────────────────────
    case 'ADJUST_SCORE': {
      const { team, delta } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];

      const newHomeScore     = team === 'home'     ? Math.max(0, currentSet.homeScore     + delta) : currentSet.homeScore;
      const newOpponentScore = team === 'opponent' ? Math.max(0, currentSet.opponentScore + delta) : currentSet.opponentScore;

      let newServingTeam     = match.servingTeam;
      let newRotationIndex   = match.currentRotationIndex;
      let newRotation        = currentSet.rotation;
      let newRotationVersion = match.rotationVersion || 0;
      let newRotationHistory = [...(match.rotationHistory || [])];
      let newEvents          = currentSet.events;

      if (delta > 0) {
        // Snapshot pre-event state so we can store it on the synthetic event for undo
        const preRotationIndex = match.currentRotationIndex;
        const preServingTeam   = match.servingTeam;
        const preRotation      = currentSet.rotation;

        if (team === 'home') {
          newServingTeam = 'home';
          if (match.servingTeam === 'opponent') {
            // Side-out: home wins serve back + rotation
            newRotationHistory = [...newRotationHistory, { rotation: preRotation, rotationIndex: preRotationIndex }];
            newRotationIndex   = (newRotationIndex + 1) % 6;
            newRotation        = applyRotation(preRotation);
            newRotationVersion++;
          }
        } else {
          newServingTeam = 'opponent';
        }

        // Synthetic event so this score adjustment appears in the log and is undoable
        newEvents = [...currentSet.events, {
          id: uuidv4(),
          type: 'manual_score',
          scoringTeam: team,
          playerId: null,
          timestamp: Date.now(),
          homeScore: newHomeScore,
          opponentScore: newOpponentScore,
          rotationIndex: preRotationIndex,
          servingTeam: preServingTeam,
          rotationSnapshot: preRotation,
        }];
      }

      const updatedSet = {
        ...currentSet,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        rotation: newRotation,
        events: newEvents,
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        servingTeam: newServingTeam,
        currentRotationIndex: newRotationIndex,
        rotationVersion: newRotationVersion,
        rotationHistory: newRotationHistory,
      };
      const showCourtDraw = team === 'opponent' && delta > 0;
      return {
        ...state,
        currentMatch: updatedMatch,
        showCourtDraw,
        lastUndoneEvent: null,
        pendingCourtDraw: showCourtDraw
          ? { setIndex, score: { home: newHomeScore, opponent: newOpponentScore }, timestamp: Date.now(), eventType: 'manual' }
          : state.pendingCourtDraw,
      };
    }

    // ── Set management ─────────────────────────────────────────────────────
    case 'END_SET': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const winner = currentSet.homeScore > currentSet.opponentScore ? 'home' : 'opponent';
      const updatedSet = { ...currentSet, status: 'completed', winner, endTime: Date.now() };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const matchWithEndedSet = { ...match, sets: updatedSets };
      return {
        ...state,
        currentMatch: matchWithEndedSet,
        matches: upsertMatch(matchWithEndedSet, state.matches),
        showHeatmap: true,
      };
    }

    case 'START_NEW_SET': {
      const match = state.currentMatch;
      const newSetIndex = match.currentSetIndex + 1;
      const prevSet = match.sets[match.currentSetIndex];
      const startServingTeam = prevSet.winner === 'home' ? 'opponent' : 'home';
      const newSet = createEmptySet(newSetIndex + 1, startServingTeam);
      const updatedSets = [...match.sets, newSet];
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        currentSetIndex: newSetIndex,
        servingTeam: startServingTeam,
        currentRotationIndex: 0,
        rotationHistory: [],
      };
      return { ...state, currentMatch: updatedMatch, showHeatmap: false, needsRotationSetup: true, needsServeSetup: true };
    }

    case 'SET_SERVE_TEAM': {
      const { servingTeam } = action;
      const match = state.currentMatch;
      const setIdx = match.currentSetIndex;
      const updatedSet = { ...match.sets[setIdx], startServingTeam: servingTeam, serveConfirmed: true };
      const updatedSets = [...match.sets];
      updatedSets[setIdx] = updatedSet;
      return {
        ...state,
        currentMatch: { ...match, sets: updatedSets, servingTeam },
        needsServeSetup: false,
      };
    }

    case 'END_MATCH': {
      // Auto-finalise the current set if it hasn't been ended yet
      const setIdx = state.currentMatch.currentSetIndex;
      const curSet = state.currentMatch.sets[setIdx];
      const autoWinner = curSet.homeScore > curSet.opponentScore ? 'home'
                       : curSet.opponentScore > curSet.homeScore ? 'opponent'
                       : null;
      const finalSet = curSet.winner
        ? curSet
        : { ...curSet, status: 'completed', winner: autoWinner, endTime: Date.now() };
      const setsWithFinal = [...state.currentMatch.sets];
      setsWithFinal[setIdx] = finalSet;
      const match = { ...state.currentMatch, sets: setsWithFinal, status: 'completed', endDate: Date.now() };
      return {
        ...state,
        currentMatch: match,
        matches: upsertMatch(match, state.matches),
        view: VIEWS.STATS,
        showHeatmap: false,
      };
    }

    case 'REOPEN_MATCH': {
      const base = action.match ?? state.currentMatch;
      const match = { ...base, status: 'active', endDate: null };
      return {
        ...state,
        currentMatch: match,
        matches: upsertMatch(match, state.matches),
        view: VIEWS.LIVE,
        needsServeSetup: false,
      };
    }

    // ── Undo ───────────────────────────────────────────────────────────────
    case 'UNDO_LAST_EVENT': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      if (!currentSet.events.length) return state;
      const removedEvent = currentSet.events[currentSet.events.length - 1];
      const events = currentSet.events.slice(0, -1);
      const prevEvent = events[events.length - 1];
      const newHomeScore     = prevEvent ? prevEvent.homeScore     : 0;
      const newOpponentScore = prevEvent ? prevEvent.opponentScore : 0;

      // Detect whether this event caused a side-out rotation so we can pop rotationHistory
      const isHomeScoringEvent = HOME_SCORE_EVENTS.has(removedEvent.type) ||
        (removedEvent.type === 'manual_score' && removedEvent.scoringTeam === 'home');
      const causedRotation = isHomeScoringEvent && removedEvent.servingTeam === 'opponent';

      const rotationHistory    = match.rotationHistory || [];
      const newRotationHistory = causedRotation && rotationHistory.length > 0
        ? rotationHistory.slice(0, -1) : rotationHistory;

      const updatedSet = {
        ...currentSet,
        events,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        rotation: removedEvent.rotationSnapshot ?? currentSet.rotation,
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return {
        ...state,
        currentMatch: {
          ...match,
          sets: updatedSets,
          servingTeam: removedEvent.servingTeam,
          currentRotationIndex: removedEvent.rotationIndex,
          rotationVersion: (match.rotationVersion || 0) + 1,
          rotationHistory: newRotationHistory,
        },
        lastUndoneEvent: removedEvent,
      };
    }

    case 'UNDO_ROTATION': {
      const match = state.currentMatch;
      const rotationHistory = match.rotationHistory || [];
      if (!rotationHistory.length) return state;
      const prev = rotationHistory[rotationHistory.length - 1];
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const updatedSet = { ...currentSet, rotation: prev.rotation };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      return {
        ...state,
        currentMatch: {
          ...match,
          sets: updatedSets,
          currentRotationIndex: prev.rotationIndex,
          rotationHistory: rotationHistory.slice(0, -1),
          rotationVersion: (match.rotationVersion || 0) + 1,
        },
      };
    }

    // ── Delete match ───────────────────────────────────────────────────────
    case 'DELETE_MATCH': {
      const clearedCurrent = state.currentMatch?.id === action.matchId;
      return {
        ...state,
        matches: state.matches.filter(m => m.id !== action.matchId),
        currentMatch: clearedCurrent ? null : state.currentMatch,
      };
    }

    // ── Add player to live match ───────────────────────────────────────────
    case 'ADD_PLAYER_TO_MATCH': {
      const match = state.currentMatch;
      const updatedMatch = {
        ...match,
        homeTeam: { ...match.homeTeam, players: [...match.homeTeam.players, action.player] },
      };
      return { ...state, currentMatch: updatedMatch };
    }

    // ── Rotation setup modal ───────────────────────────────────────────────
    case 'DISMISS_ROTATION_SETUP':
      return { ...state, needsRotationSetup: false };

    // ── UI toggles ─────────────────────────────────────────────────────────
    case 'SHOW_HEATMAP':      return { ...state, showHeatmap: true };
    case 'HIDE_HEATMAP':      return { ...state, showHeatmap: false };
    case 'SHOW_SUBSTITUTION': return { ...state, showSubstitution: true };
    case 'HIDE_SUBSTITUTION': return { ...state, showSubstitution: false };

    default:
      return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function MatchProvider({ children }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError,   setDataError]   = useState(null);

  const isHydratingRef    = useRef(false);
  const prevUserRef       = useRef(null);
  const syncMatchTimerRef = useRef(null);
  const prevMatchesRef    = useRef([]);
  const prevTeamsRef      = useRef([]);

  // ── Load from Firestore when user changes ──────────────────────────────────
  useEffect(() => {
    if (!user) {
      if (prevUserRef.current) dispatch({ type: 'RESET' });
      prevUserRef.current = null;
      return;
    }
    if (user.uid === prevUserRef.current) return;
    prevUserRef.current = user.uid;

    isHydratingRef.current = true;
    setDataLoading(true);
    setDataError(null);

    Promise.all([
      loadCurrentMatchFS(user.uid),
      loadMatchesFS(user.uid),
      loadTeamsFS(user.uid),
      loadSettingsFS(user.uid),
    ]).then(([currentMatch, matches, savedTeams, settings]) => {
      prevMatchesRef.current = matches;
      prevTeamsRef.current   = savedTeams;
      const setIdx = currentMatch?.currentSetIndex ?? 0;
      const currentSetEvents = currentMatch?.sets?.[setIdx]?.events ?? [];
      const serveAlreadyConfirmed = currentMatch?.sets?.[setIdx]?.serveConfirmed === true;
      const needsServeSetup = currentMatch?.status === 'active'
        && currentSetEvents.length === 0
        && !serveAlreadyConfirmed;
      dispatch({ type: 'HYDRATE', currentMatch, matches, savedTeams, settings, needsServeSetup });
      if (currentMatch?.status === 'completed') {
        dispatch({ type: 'SET_VIEW', payload: VIEWS.STATS });
      }
      // Set dataLoading=false BEFORE clearing isHydrating so the sync effects
      // see isHydrating=true during the render triggered by setDataLoading and
      // skip their write — preventing the just-loaded state from being saved
      // straight back to Firestore (and racing with any in-flight writes).
      setDataLoading(false);
      setTimeout(() => { isHydratingRef.current = false; }, 0);
    }).catch(err => {
      console.error('Firestore load error:', err);
      setDataError(err.message);
      isHydratingRef.current = false;
      setDataLoading(false);
    });
  }, [user]);

  // ── Sync currentMatch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || dataLoading || isHydratingRef.current) return;
    const match = state.currentMatch;
    if (!match) return;

    clearTimeout(syncMatchTimerRef.current);

    if (match.status === 'completed') {
      // Completed match: persist to history and evict the active slot immediately.
      // This runs synchronously after END_MATCH renders, so post-reducer state is correct.
      saveMatchFS(user.uid, match).catch(console.error);
      clearCurrentMatchFS(user.uid).catch(console.error);
      return;
    }

    // Active match: debounce writes to avoid excessive Firestore traffic.
    // The closure captures the current match; a safety status check inside the
    // timer prevents a race where the match completes before the 500 ms fires.
    syncMatchTimerRef.current = setTimeout(() => {
      if (state.currentMatch && state.currentMatch.status !== 'completed') {
        saveCurrentMatchFS(user.uid, state.currentMatch).catch(console.error);
      }
    }, 500);

    return () => clearTimeout(syncMatchTimerRef.current);
  }, [state.currentMatch, user, dataLoading]);

  // ── Sync match history when it changes ────────────────────────────────────
  useEffect(() => {
    if (!user || dataLoading || isHydratingRef.current) return;
    const prev = prevMatchesRef.current;
    state.matches.forEach(match => {
      const p = prev.find(m => m.id === match.id);
      if (!p || p !== match) saveMatchFS(user.uid, match).catch(console.error);
    });
    prevMatchesRef.current = state.matches;
  }, [state.matches, user, dataLoading]);

  // ── Sync saved teams when they change ─────────────────────────────────────
  useEffect(() => {
    if (!user || dataLoading || isHydratingRef.current) return;
    const prev = prevTeamsRef.current;
    state.savedTeams.forEach(team => {
      const p = prev.find(t => t.id === team.id);
      if (!p || p !== team) saveTeamFS(user.uid, team).catch(console.error);
    });
    prevTeamsRef.current = state.savedTeams;
  }, [state.savedTeams, user, dataLoading]);

  // ── Sync appMode setting ───────────────────────────────────────────────────
  const prevAppModeRef = useRef(state.appMode);
  useEffect(() => {
    if (!user || dataLoading || isHydratingRef.current) return;
    if (state.appMode !== prevAppModeRef.current) {
      saveSettingsFS(user.uid, { appMode: state.appMode }).catch(console.error);
      prevAppModeRef.current = state.appMode;
    }
  }, [state.appMode, user, dataLoading]);

  // ── Dispatch wrapper handles Firestore deletes + immediate END_MATCH save ──
  const syncDispatch = useCallback((action) => {
    if (user) {
      if (action.type === 'DELETE_MATCH') {
        deleteMatchFS(user.uid, action.matchId).catch(console.error);
        if (state.currentMatch?.id === action.matchId) {
          clearCurrentMatchFS(user.uid).catch(console.error);
        }
      }
      if (action.type === 'DELETE_TEAM_FROM_STATE') {
        deleteTeamFS(user.uid, action.teamId).catch(console.error);
      }
      // On END_MATCH: immediately evict the active slot so no stale write can
      // resurrect old state.  Also write a preliminary history entry so the
      // match survives a crash in the ~16 ms before the post-render effect fires
      // with the fully-correct post-reducer state (which will overwrite this).
      if (action.type === 'END_MATCH' && state.currentMatch) {
        clearCurrentMatchFS(user.uid).catch(console.error);
        const partialFinal = { ...state.currentMatch, status: 'completed', endDate: Date.now() };
        saveMatchFS(user.uid, partialFinal).catch(console.error);
      }
      // Save immediately on reopen so state is consistent across refreshes
      if (action.type === 'REOPEN_MATCH') {
        const base = action.match ?? state.currentMatch;
        if (base) {
          const reopened = { ...base, status: 'active', endDate: null };
          saveCurrentMatchFS(user.uid, reopened).catch(console.error);
          saveMatchFS(user.uid, reopened).catch(console.error);
        }
      }
    }
    dispatch(action);
  }, [user, state.currentMatch]);

  const navigate = useCallback((view) => dispatch({ type: 'SET_VIEW', payload: view }), []);

  return (
    <MatchContext.Provider value={{ state, dispatch: syncDispatch, navigate, dataLoading, dataError, setDataError }}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within MatchProvider');
  return ctx;
}
