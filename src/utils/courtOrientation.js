// Court drawing orientation.
// 'normal'  — my team at the bottom, opponent at the top (the canonical view)
// 'flipped' — my team at the top, opponent at the bottom
// Drawings keep the raw canvas coordinates they were drawn with plus a `flipped`
// flag; everything that reads them goes through normalizeDrawing() first.

export const COURT_ORIENTATION = { NORMAL: 'normal', FLIPPED: 'flipped' };

export function isFlipped(orientation) {
  return orientation === COURT_ORIENTATION.FLIPPED;
}

export function mirrorPoint(pt) {
  return pt ? { ...pt, y: 1 - pt.y } : pt;
}

export function mirrorPaths(paths) {
  return (paths || []).map(path => ({ ...path, points: path.points.map(mirrorPoint) }));
}

// Returns the drawing in canonical orientation (opponent on top, attacking downward)
export function normalizeDrawing(drawing) {
  if (!drawing?.flipped) return drawing;
  return {
    ...drawing,
    paths: mirrorPaths(drawing.paths),
    startPoint: mirrorPoint(drawing.startPoint),
    endPoint: mirrorPoint(drawing.endPoint),
    flipped: false,
  };
}
