import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Undo2, Trash2, Check, ArrowUpDown, X } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';
import { COURT_ORIENTATION, isFlipped, mirrorPaths, mirrorPoint } from '../../utils/courtOrientation';
import { PLAYER_ERROR_TYPES, defaultPlayerPositions } from '../../utils/courtAnnotations';

const COURT_COLOR = '#1a3a5c';
const LINE_COLOR = '#93c5fd';
const NET_COLOR = '#fbbf24';
const DRAW_COLOR = '#ff6b35';
const DRAW_WIDTH = 3;
const ATTACK_END_COLOR = '#ef4444';
const DRAG_THRESHOLD_PX = 6;

const clamp01 = v => Math.min(1, Math.max(0, v));

// Burn the player circles into the saved snapshot (they're HTML on screen, not canvas)
function drawPlayerMarkers(ctx, w, h, markers) {
  markers.forEach(({ x, y, number, tagged }) => {
    ctx.fillStyle = tagged ? '#7f1d1d' : '#1d4ed8';
    ctx.strokeStyle = tagged ? '#ef4444' : '#bfdbfe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x * w, y * h, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), x * w, y * h);
  });
}

// flipped: my team on top, opponent at the bottom — mirrors labels and zone numbers vertically
function drawCourt(ctx, w, h, labels, flipped = false) {
  ctx.fillStyle = COURT_COLOR;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  const margin = 20;
  const cw = w - margin * 2;
  const ch = h - margin * 2;

  ctx.strokeRect(margin, margin, cw, ch);

  ctx.strokeStyle = NET_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(margin, h / 2);
  ctx.lineTo(w - margin, h / 2);
  ctx.stroke();

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  const attackOffset = ch * 0.25;
  ctx.beginPath();
  ctx.moveTo(margin, h / 2 - attackOffset);
  ctx.lineTo(w - margin, h / 2 - attackOffset);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(margin, h / 2 + attackOffset);
  ctx.lineTo(w - margin, h / 2 + attackOffset);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  for (let i = 1; i < 3; i++) {
    const x = margin + (cw / 3) * i;
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, h - margin);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `bold ${Math.max(10, w / 25)}px sans-serif`;
  ctx.textAlign = 'center';
  const topLabelY = margin + 14;
  const bottomLabelY = h - margin - 6;
  ctx.fillText(labels.opponent, w / 2, flipped ? bottomLabelY : topLabelY);
  ctx.fillText(labels.home, w / 2, flipped ? topLabelY : bottomLabelY);

  const zoneLabels = [
    { z: '4', x: margin + cw / 6, y: h / 2 + attackOffset / 2 },
    { z: '3', x: margin + cw / 2, y: h / 2 + attackOffset / 2 },
    { z: '2', x: margin + cw * 5 / 6, y: h / 2 + attackOffset / 2 },
    { z: '5', x: margin + cw / 6, y: h - margin - (ch * 0.25) / 2 },
    { z: '6', x: margin + cw / 2, y: h - margin - (ch * 0.25) / 2 },
    { z: '1', x: margin + cw * 5 / 6, y: h - margin - (ch * 0.25) / 2 },
  ];
  ctx.font = `bold ${Math.max(11, w / 22)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  zoneLabels.forEach(({ z, x, y }) => {
    ctx.fillText(z, x, flipped ? h - y : y);
  });
}

function drawPaths(ctx, paths, w, h) {
  paths.forEach(path => {
    if (path.points.length < 2) return;
    ctx.strokeStyle = DRAW_COLOR;
    ctx.lineWidth = DRAW_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path.points[0].x * w, path.points[0].y * h);
    path.points.slice(1).forEach(pt => ctx.lineTo(pt.x * w, pt.y * h));
    ctx.stroke();

    if (path.points.length >= 2) {
      const last = path.points[path.points.length - 1];
      const prev = path.points[path.points.length - 2];
      const angle = Math.atan2(
        (last.y - prev.y) * h,
        (last.x - prev.x) * w
      );
      const ax = last.x * w;
      const ay = last.y * h;
      const arrowLen = 12;
      ctx.fillStyle = ATTACK_END_COLOR;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.4), ay - arrowLen * Math.sin(angle - 0.4));
      ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.4), ay - arrowLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = ATTACK_END_COLOR;
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export default function CourtDrawModal() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { showCourtDraw, currentMatch, pendingCourtDraw } = state;
  const canvasRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [isEraser, setIsEraser] = useState(false);

  const score = pendingCourtDraw?.score;
  const isBlockingMistake = pendingCourtDraw?.eventType === 'block_mistake';
  // Player annotations only on the manual "+1 opponent" popup
  const isManual = pendingCourtDraw?.eventType === 'manual';
  const courtLabels = { opponent: t('courtOpponent'), home: t('courtHome') };
  const flipped = isFlipped(currentMatch?.courtOrientation);

  // The modal mounts fresh each time it opens, so initial state = current rotation
  const players = currentMatch?.homeTeam.players ?? [];
  const drawSet = currentMatch?.sets[pendingCourtDraw?.setIndex ?? currentMatch?.currentSetIndex];
  const [playerPos, setPlayerPos]       = useState(() => defaultPlayerPositions(drawSet?.rotation, flipped));
  const [movedAny, setMovedAny]         = useState(false);
  const [playerErrors, setPlayerErrors] = useState([]); // [{ playerId, errorType }]
  const [menuFor, setMenuFor]           = useState(null);
  const dragRef = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    drawCourt(ctx, w, h, courtLabels, flipped);
    drawPaths(ctx, paths, w, h);
    if (currentPath && currentPath.points.length > 1) {
      drawPaths(ctx, [currentPath], w, h);
    }
  }, [paths, currentPath, courtLabels.opponent, courtLabels.home, flipped]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (showCourtDraw) {
      setPaths([]);
      setCurrentPath(null);
    }
  }, [showCourtDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [showCourtDraw, redraw]);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  function onStart(e) {
    e.preventDefault();
    setMenuFor(null);
    if (isEraser) {
      const pos = getPos(e);
      const canvas = canvasRef.current;
      const thresh = 20 / canvas.width;
      setPaths(prev => prev.filter(path =>
        !path.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < thresh)
      ));
      return;
    }
    setCurrentPath({ points: [getPos(e)] });
  }

  function onMove(e) {
    e.preventDefault();
    if (!currentPath && !isEraser) return;
    const pos = getPos(e);
    if (isEraser) {
      const canvas = canvasRef.current;
      const thresh = 20 / canvas.width;
      setPaths(prev => prev.filter(path =>
        !path.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < thresh)
      ));
      return;
    }
    setCurrentPath(prev => prev ? { points: [...prev.points, pos] } : null);
  }

  function onEnd(e) {
    e.preventDefault();
    if (!currentPath) return;
    if (currentPath.points.length > 1) {
      setPaths(prev => [...prev, currentPath]);
    }
    setCurrentPath(null);
  }

  // ── Player circles: drag to move, tap (no drag) to open the error menu ──
  function onPlayerPointerDown(e) {
    const { playerId } = e.currentTarget.dataset;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { playerId, sx: e.clientX, sy: e.clientY, dragging: false };
  }

  function onPlayerPointerMove(e) {
    const { playerId } = e.currentTarget.dataset;
    const drag = dragRef.current;
    if (!drag || drag.playerId !== playerId) return;
    e.preventDefault();
    if (!drag.dragging && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESHOLD_PX) return;
    drag.dragging = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
    setPlayerPos(prev => ({ ...prev, [playerId]: pos }));
    setMovedAny(true);
    setMenuFor(null);
  }

  function onPlayerPointerUp(e) {
    const { playerId } = e.currentTarget.dataset;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && drag.playerId === playerId && !drag.dragging) {
      setMenuFor(cur => (cur === playerId ? null : playerId));
    }
  }

  function onPlayerPointerCancel() {
    dragRef.current = null;
  }

  function toggleError(playerId, errorType) {
    setPlayerErrors(prev => prev.some(e => e.playerId === playerId && e.errorType === errorType)
      ? prev.filter(e => !(e.playerId === playerId && e.errorType === errorType))
      : [...prev, { playerId, errorType }]);
  }

  // Mirror any lines already drawn so they stay on the same spot of the court
  function handleFlip() {
    setPaths(prev => mirrorPaths(prev));
    setCurrentPath(null);
    setPlayerPos(prev => Object.fromEntries(Object.entries(prev).map(([id, pt]) => [id, mirrorPoint(pt)])));
    dispatch({
      type: 'SET_COURT_ORIENTATION',
      orientation: flipped ? COURT_ORIENTATION.NORMAL : COURT_ORIENTATION.FLIPPED,
    });
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (isManual) {
      drawPlayerMarkers(canvas.getContext('2d'), canvas.width, canvas.height,
        Object.entries(playerPos).map(([id, pt]) => ({
          ...pt,
          number: players.find(p => p.id === id)?.number ?? '',
          tagged: playerErrors.some(e => e.playerId === id),
        })));
    }
    const imageData = canvas.toDataURL('image/png');
    const lastPath = paths[paths.length - 1];
    const endPoint = lastPath?.points[lastPath.points.length - 1] || null;
    const startPoint = paths[0]?.points[0] || null;
    // Generate ID here so syncDispatch can reference the same ID to save imageData
    // to the drawings sub-collection before the reducer stores the drawing in state.
    const id = uuidv4();
    // Positions are saved only if the coach moved someone (all on-court players, raw canvas coords)
    const annotations = isManual ? {
      playerPositions: movedAny ? Object.entries(playerPos).map(([playerId, pt]) => ({ playerId, x: pt.x, y: pt.y })) : [],
      playerErrors,
    } : {};
    dispatch({ type: 'SAVE_ATTACK_DRAWING', id, paths, startPoint, endPoint, flipped, imageData, ...annotations });
  }

  function handleSkip() {
    dispatch({ type: 'SKIP_ATTACK_DRAWING' });
  }

  if (!showCourtDraw) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div>
          <div className={`font-bold text-sm flex items-center gap-2 ${isBlockingMistake ? 'text-amber-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isBlockingMistake ? 'bg-amber-400' : 'bg-red-400'}`}></span>
            {isBlockingMistake ? t('blockingMistakeEvent') : t('opponentScored')}
          </div>
          {score && (
            <div className="text-slate-400 text-xs mt-0.5">
              {t('score')}: {score.home} – {score.opponent}
            </div>
          )}
        </div>
        <button
          className="text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
          onClick={handleSkip}
        >
          {t('skip')}
        </button>
      </div>

      {/* Instruction + flip toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0">
        <span className="text-slate-400 text-xs min-w-0">
          {isManual ? t('annotateHint') : isBlockingMistake ? t('drawBlockingHint') : t('drawAttackHint')}
        </span>
        <button
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold flex-shrink-0 transition-colors active:scale-95 ${
            flipped
              ? 'bg-indigo-900/70 border-indigo-600 text-indigo-200'
              : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
          }`}
          onClick={handleFlip}
          title={t('flipCourt')}
          aria-label={t('flipCourt')}
        >
          <ArrowUpDown size={13} />
          {flipped ? t('myTeamTop') : t('myTeamBottom')}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden mx-2 mb-2 rounded-xl border border-slate-700">
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${isEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        />

        {/* Draggable / tappable player circles (manual +1 only) */}
        {isManual && Object.entries(playerPos).map(([playerId, pt]) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return null;
          const tagged = playerErrors.some(e => e.playerId === playerId);
          const open = menuFor === playerId;
          return (
            <button
              key={playerId}
              type="button"
              className={`absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 flex items-center justify-center text-sm font-black text-white shadow-lg select-none transition-colors ${
                tagged ? 'bg-red-900 border-red-500' : open ? 'bg-blue-600 border-white' : 'bg-blue-700 border-blue-200'
              }`}
              style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, touchAction: 'none' }}
              dir="ltr"
              data-player-id={playerId}
              onPointerDown={onPlayerPointerDown}
              onPointerMove={onPlayerPointerMove}
              onPointerUp={onPlayerPointerUp}
              onPointerCancel={onPlayerPointerCancel}
            >
              {player.number}
              {tagged && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center">
                  <X size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}

        {/* Inline error menu next to the tapped player */}
        {isManual && menuFor && playerPos[menuFor] && (() => {
          const pt = playerPos[menuFor];
          const player = players.find(p => p.id === menuFor);
          const horiz = pt.x < 0.35 ? { left: `${pt.x * 100}%` }
            : pt.x > 0.65 ? { right: `${(1 - pt.x) * 100}%` }
            : { left: `${pt.x * 100}%`, transform: 'translateX(-50%)' };
          const vert = pt.y > 0.5
            ? { bottom: `calc(${(1 - pt.y) * 100}% + 26px)` }
            : { top: `calc(${pt.y * 100}% + 26px)` };
          return (
            <div
              className="absolute z-10 w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-2"
              style={{ ...horiz, ...vert }}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-white text-xs font-bold truncate">
                  <span dir="ltr">#{player?.number}</span> {player?.name}
                </span>
                <button type="button" className="text-slate-400 hover:text-white flex-shrink-0" onClick={() => setMenuFor(null)}>
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {PLAYER_ERROR_TYPES.map(({ type, labelKey }) => {
                  const on = playerErrors.some(e => e.playerId === menuFor && e.errorType === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        on ? 'bg-red-900/70 border-red-600 text-red-100' : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                      }`}
                      onClick={() => toggleError(menuFor, type)}
                    >
                      {t(labelKey)}
                      {on && <Check size={13} className="flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-4 flex-shrink-0 gap-3">
        <div className="flex gap-2">
          <button
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isEraser ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setIsEraser(false)}
          >
            {t('drawTool')}
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isEraser ? 'bg-orange-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setIsEraser(true)}
          >
            {t('eraseTool')}
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            onClick={() => setPaths(prev => prev.slice(0, -1))}
            disabled={paths.length === 0}
          >
            <Undo2 size={15} /> {t('undo')}
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-red-900 transition-colors"
            onClick={() => { setPaths([]); setCurrentPath(null); }}
            disabled={paths.length === 0}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-colors active:scale-95"
          onClick={handleSave}
        >
          <Check size={16} /> {isManual ? t('doneBtn') : t('save')}
        </button>
      </div>
    </div>
  );
}
