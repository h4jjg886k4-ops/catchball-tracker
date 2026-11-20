// Player annotations on the manual "+1 opponent" court popup.
// Errors tagged here live only on the drawing — they never create events or change the score.
import { EVENT_TYPES as T } from './constants';
import { mirrorPoint } from './courtOrientation';

export const PLAYER_ERROR_TYPES = [
  { type: T.DEFENSE_ERROR,          labelKey: 'annotDefenceError' },
  { type: T.BLOCK_ERROR,            labelKey: 'annotBlockPositionError' },
  { type: T.DEFENCE_LOCATION_ERROR, labelKey: 'annotLocationError' },
];

export function playerErrorLabelKey(errorType) {
  return PLAYER_ERROR_TYPES.find(e => e.type === errorType)?.labelKey ?? null;
}

// Normalized canvas coords of P1–P6 on my half (bottom) of the court-draw canvas
const ROTATION_SPOTS = [
  { x: 0.8, y: 0.84 }, // P1 back right
  { x: 0.8, y: 0.62 }, // P2 front right
  { x: 0.5, y: 0.62 }, // P3 front middle
  { x: 0.2, y: 0.62 }, // P4 front left
  { x: 0.2, y: 0.84 }, // P5 back left
  { x: 0.5, y: 0.84 }, // P6 back middle
];

// { [playerId]: { x, y } } for everyone in the rotation, in the canvas's current orientation
export function defaultPlayerPositions(rotation, flipped) {
  const positions = {};
  (rotation || []).forEach((id, i) => {
    if (!id || !ROTATION_SPOTS[i]) return;
    positions[id] = flipped ? mirrorPoint(ROTATION_SPOTS[i]) : { ...ROTATION_SPOTS[i] };
  });
  return positions;
}

// The drawing saved for a given event (manual +1 drawings carry the event's id)
export function findDrawingForEvent(set, event) {
  if (!set || !event?.id) return null;
  return (set.attackDrawings || []).find(d => d.eventId === event.id)
    ?? (set.blockingDrawings || []).find(d => d.eventId === event.id)
    ?? null;
}
