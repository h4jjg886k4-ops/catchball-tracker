import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Undo2, Trash2, Check } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

const COURT_COLOR = '#1a3a5c';
const LINE_COLOR = '#93c5fd';
const NET_COLOR = '#fbbf24';
const DRAW_COLOR = '#ff6b35';
const DRAW_WIDTH = 3;
const ATTACK_END_COLOR = '#ef4444';

function drawCourt(ctx, w, h, labels) {
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
  ctx.fillText(labels.opponent, w / 2, margin + 14);
  ctx.fillText(labels.home, w / 2, h - margin - 6);

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
    ctx.fillText(z, x, y);
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
  const courtLabels = { opponent: t('courtOpponent'), home: t('courtHome') };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    drawCourt(ctx, w, h, courtLabels);
    drawPaths(ctx, paths, w, h);
    if (currentPath && currentPath.points.length > 1) {
      drawPaths(ctx, [currentPath], w, h);
    }
  }, [paths, currentPath, courtLabels.opponent, courtLabels.home]);

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

  function handleSave() {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    const lastPath = paths[paths.length - 1];
    const endPoint = lastPath?.points[lastPath.points.length - 1] || null;
    // Generate ID here so syncDispatch can reference the same ID to save imageData
    // to the drawings sub-collection before the reducer stores the drawing in state.
    const id = uuidv4();
    dispatch({ type: 'SAVE_ATTACK_DRAWING', id, paths, endPoint, imageData });
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

      {/* Instruction */}
      <div className="text-center text-slate-400 text-xs py-2 flex-shrink-0">
        {isBlockingMistake ? t('drawBlockingHint') : t('drawAttackHint')}
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
          <Check size={16} /> {t('save')}
        </button>
      </div>
    </div>
  );
}
