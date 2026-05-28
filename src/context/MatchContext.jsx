import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HOME_SCORE_EVENTS, OPPONENT_SCORE_EVENTS, COURT_DRAW_EVENTS, VIEWS } from '../utils/constants';
import { saveCurrentMatch, loadCurrentMatch, clearCurrentMatch, saveMatchToHistory, loadMatches, deleteMatch as deleteMatchFromStorage } from '../utils/storage';

const MatchContext = createContext(null);

function createEmptySet(setNumber, startServingTeam = 'home') {
  return {
    id: setNumber,
    homeScore: 0,
    opponentScore: 0,
    events: [],
    rotation: ['', '', '', '', '', ''], // positions 0-5 = court positions 1-6
    startingRotation: ['', '', '', '', '', ''],
    startServingTeam,
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
    rotationVersion: 0,   // increments each time a rotation fires, triggers animation
    rotationHistory: [],  // stack of {rotation, rotationIndex} for "Undo Rotation"
  };
}

// Rotate left: P2→P1(server), P3→P2, P4→P3, P5→P4, P6→P5, P1→P6
function applyRotation(rotation) {
  return [...rotation.slice(1), rotation[0]];
}

const initialState = {
  view: VIEWS.HOME,
  matches: loadMatches(),
  currentMatch: null,
  // UI state for live match
  selectedPlayerId: null,
  showCourtDraw: false,
  showHeatmap: false,
  showSubstitution: false,
  needsRotationSetup: false, // true after START_NEW_SET until rotation is configured
  lastScoreTeam: null, // 'home' or 'opponent' - for court draw trigger
  pendingCourtDraw: null, // store the event that triggered the draw
  lastUndoneEvent: null, // cleared on next event recorded
};

function reducer(state, action) {
  switch (action.type) {

    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'START_NEW_MATCH_SETUP':
      return { ...state, view: VIEWS.SETUP, currentMatch: null, selectedPlayerId: null };

    case 'SETUP_COMPLETE': {
      const match = createEmptyMatch(action.homeTeam, action.opponentTeam);
      saveCurrentMatch(match);
      return { ...state, currentMatch: match, view: VIEWS.LIVE };
    }

    case 'LOAD_MATCH': {
      return { ...state, currentMatch: action.match, view: VIEWS.LIVE, selectedPlayerId: null };
    }

    case 'SELECT_PLAYER':
      return { ...state, selectedPlayerId: action.playerId };

    case 'DESELECT_PLAYER':
      return { ...state, selectedPlayerId: null };

    case 'RECORD_EVENT': {
      const { event } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];

      const isHomeScore = HOME_SCORE_EVENTS.has(event.type);
      const isOpponentScore = OPPONENT_SCORE_EVENTS.has(event.type);

      let newHomeScore = currentSet.homeScore;
      let newOpponentScore = currentSet.opponentScore;
      let newServingTeam = match.servingTeam;
      let newRotationIndex = match.currentRotationIndex;
      let newRotation = currentSet.rotation;
      let newRotationVersion = match.rotationVersion || 0;
      let newRotationHistory = [...(match.rotationHistory || [])];

      if (isHomeScore) {
        newHomeScore++;
        newServingTeam = 'home';
        // Rotation only fires when we WIN THE SERVE BACK (side-out)
        if (match.servingTeam === 'opponent') {
          newRotationHistory = [...newRotationHistory, { rotation: currentSet.rotation, rotationIndex: match.currentRotationIndex }];
          newRotationIndex = (newRotationIndex + 1) % 6;
          newRotation = applyRotation(currentSet.rotation);
          newRotationVersion++;
        }
      } else if (isOpponentScore) {
        newOpponentScore++;
        newServingTeam = 'opponent';
        // We lose serve: serve transfers to opponent, but WE do NOT rotate
      }

      const fullEvent = {
        ...event,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        rotationIndex: match.currentRotationIndex,
        servingTeam: match.servingTeam,
        rotationSnapshot: currentSet.rotation, // snapshot for undo
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

      saveCurrentMatch(updatedMatch);

      const showCourtDraw = COURT_DRAW_EVENTS.has(event.type);

      return {
        ...state,
        currentMatch: updatedMatch,
        selectedPlayerId: null,
        showCourtDraw,
        lastScoreTeam: isHomeScore ? 'home' : isOpponentScore ? 'opponent' : null,
        pendingCourtDraw: showCourtDraw ? { setIndex, score: { home: newHomeScore, opponent: newOpponentScore }, timestamp: event.timestamp, eventType: event.type } : null,
        lastUndoneEvent: null,
      };
    }

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
      const updatedMatch = { ...match, sets: updatedSets };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch, needsRotationSetup: false };
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
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        currentRotationIndex: newRotIdx,
        rotationVersion: (match.rotationVersion || 0) + 1,
        rotationHistory: newRotationHistory,
      };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch };
    }

    case 'ADD_SUBSTITUTION': {
      const { outPlayerId, inPlayerId } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const sub = {
        id: uuidv4(),
        timestamp: Date.now(),
        outPlayerId,
        inPlayerId,
        homeScore: currentSet.homeScore,
        opponentScore: currentSet.opponentScore,
      };
      const updatedSet = {
        ...currentSet,
        substitutions: [...currentSet.substitutions, sub],
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const updatedMatch = { ...match, sets: updatedSets };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch, showSubstitution: false };
    }

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
      const updatedMatch = { ...match, sets: updatedSets };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch, showCourtDraw: false, pendingCourtDraw: null };
    }

    case 'SKIP_ATTACK_DRAWING':
      return { ...state, showCourtDraw: false, pendingCourtDraw: null };

    case 'END_SET': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const winner = currentSet.homeScore > currentSet.opponentScore ? 'home' : 'opponent';
      const updatedSet = { ...currentSet, status: 'completed', winner, endTime: Date.now() };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;

      // Save to history
      const matchWithEndedSet = { ...match, sets: updatedSets };
      const updatedMatches = saveMatchToHistory(matchWithEndedSet, state.matches);

      return {
        ...state,
        currentMatch: matchWithEndedSet,
        matches: updatedMatches,
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
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch, showHeatmap: false, needsRotationSetup: true };
    }

    case 'END_MATCH': {
      const match = { ...state.currentMatch, status: 'completed', endDate: Date.now() };
      const updatedMatches = saveMatchToHistory(match, state.matches);
      return {
        ...state,
        currentMatch: match,
        matches: updatedMatches,
        view: VIEWS.STATS,
        showHeatmap: false,
      };
    }

    case 'UNDO_LAST_EVENT': {
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      if (!currentSet.events.length) return state;

      const removedEvent = currentSet.events[currentSet.events.length - 1];
      const events = currentSet.events.slice(0, -1);
      const prevEvent = events[events.length - 1];
      const newHomeScore = prevEvent ? prevEvent.homeScore : 0;
      const newOpponentScore = prevEvent ? prevEvent.opponentScore : 0;

      // If this event caused a rotation, also pop from rotationHistory
      const causedRotation = HOME_SCORE_EVENTS.has(removedEvent.type) && removedEvent.servingTeam === 'opponent';
      const rotationHistory = match.rotationHistory || [];
      const newRotationHistory = causedRotation && rotationHistory.length > 0
        ? rotationHistory.slice(0, -1)
        : rotationHistory;

      const updatedSet = {
        ...currentSet,
        events,
        homeScore: newHomeScore,
        opponentScore: newOpponentScore,
        rotation: removedEvent.rotationSnapshot || currentSet.rotation,
      };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        servingTeam: removedEvent.servingTeam,
        currentRotationIndex: removedEvent.rotationIndex,
        rotationHistory: newRotationHistory,
      };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch, lastUndoneEvent: removedEvent };
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
      const updatedMatch = {
        ...match,
        sets: updatedSets,
        currentRotationIndex: prev.rotationIndex,
        rotationHistory: rotationHistory.slice(0, -1),
        rotationVersion: (match.rotationVersion || 0) + 1,
      };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch };
    }

    case 'ADJUST_SCORE': {
      const { team, delta } = action;
      const match = state.currentMatch;
      const setIndex = match.currentSetIndex;
      const currentSet = match.sets[setIndex];
      const newHomeScore = team === 'home' ? Math.max(0, currentSet.homeScore + delta) : currentSet.homeScore;
      const newOpponentScore = team === 'opponent' ? Math.max(0, currentSet.opponentScore + delta) : currentSet.opponentScore;
      const updatedSet = { ...currentSet, homeScore: newHomeScore, opponentScore: newOpponentScore };
      const updatedSets = [...match.sets];
      updatedSets[setIndex] = updatedSet;
      const updatedMatch = { ...match, sets: updatedSets };
      saveCurrentMatch(updatedMatch);
      const showCourtDraw = team === 'opponent' && delta > 0;
      return {
        ...state,
        currentMatch: updatedMatch,
        showCourtDraw,
        pendingCourtDraw: showCourtDraw
          ? { setIndex, score: { home: newHomeScore, opponent: newOpponentScore }, timestamp: Date.now(), eventType: 'manual' }
          : state.pendingCourtDraw,
      };
    }

    case 'DISMISS_ROTATION_SETUP':
      return { ...state, needsRotationSetup: false };

    case 'SHOW_HEATMAP':
      return { ...state, showHeatmap: true };

    case 'HIDE_HEATMAP':
      return { ...state, showHeatmap: false };

    case 'SHOW_SUBSTITUTION':
      return { ...state, showSubstitution: true };

    case 'HIDE_SUBSTITUTION':
      return { ...state, showSubstitution: false };

    case 'DELETE_MATCH': {
      const updatedMatches = deleteMatchFromStorage(action.matchId, state.matches);
      // If the deleted match is the currently loaded one, clear it
      const clearedCurrent = state.currentMatch?.id === action.matchId;
      if (clearedCurrent) clearCurrentMatch();
      return {
        ...state,
        matches: updatedMatches,
        currentMatch: clearedCurrent ? null : state.currentMatch,
      };
    }

    case 'ADD_PLAYER_TO_MATCH': {
      const match = state.currentMatch;
      const updatedHomeTeam = {
        ...match.homeTeam,
        players: [...match.homeTeam.players, action.player],
      };
      const updatedMatch = { ...match, homeTeam: updatedHomeTeam };
      saveCurrentMatch(updatedMatch);
      return { ...state, currentMatch: updatedMatch };
    }

    case 'LOAD_MATCHES':
      return { ...state, matches: loadMatches() };

    default:
      return state;
  }
}

export function MatchProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const saved = loadCurrentMatch();
    return { ...init, currentMatch: saved };
  });

  const navigate = useCallback((view) => dispatch({ type: 'SET_VIEW', payload: view }), []);

  return (
    <MatchContext.Provider value={{ state, dispatch, navigate }}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within MatchProvider');
  return ctx;
}
