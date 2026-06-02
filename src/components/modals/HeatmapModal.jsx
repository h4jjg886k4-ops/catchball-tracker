import React, { useRef, useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';
import { useLanguage } from '../../context/LanguageContext';

const COURT_COLOR = '#0f2640';
const LINE_COLOR  = '#93c5fd';
const NET_COLOR   = '#fbbf24';

function drawCourtBase(ctx, w, h, topLabel, bottomLabel) {
  ctx.fillStyle = COURT_COLOR;
  ctx.fillRect(0, 0, w, h);

  const margin = 20;
  const cw = w - margin * 2;
  const ch = h - margin * 2;

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
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

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `bold ${Math.max(10, w / 28)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(topLabel, w / 2, margin + 14);
  ctx.fillText(bottomLabel, w / 2, h - 6);

  // Zone labels (faint)
  const zonePositions = [
    { z: '4', x: margin + cw / 6,     y: h / 2 + attackOffset / 2 },
    { z: '3', x: margin + cw / 2,     y: h / 2 + attackOffset / 2 },
    { z: '2', x: margin + cw * 5 / 6, y: h / 2 + attackOffset / 2 },
    { z: '5', x: margin + cw / 6,     y: h - margin - attackOffset / 2 },
    { z: '6', x: margin + cw / 2,     y: h - margin - attackOffset / 2 },
    { z: '1', x: margin + cw * 5 / 6, y: h - margin - attackOffset / 2 },
  ];
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `bold ${Math.max(11, w / 22)}px sans-serif`;
  zonePositions.forEach(({ z, x, y }) => ctx.fillText(z, x, y));
}

// Draw a single arrow from (sx,sy) to (ex,ey) with arrowhead
function drawArrow(ctx, sx, sy, ex, ey, color, lineWidth) {
  const angle = Math.atan2(ey - sy, ex - sx);
  const headLen = Math.max(10, lineWidth * 3.5);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - headLen * Math.cos(angle - 0.42), ey - headLen * Math.sin(angle - 0.42));
  ctx.lineTo(ex - headLen * Math.cos(angle + 0.42), ey - headLen * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}

// Extract start+end from a drawing. startPt = first point of first path.
function extractArrow(drawing) {
  const firstPath = drawing.paths?.[0];
  if (!firstPath || firstPath.points.length === 0) return null;
  const startPt = firstPath.points[0];
  const endPt   = drawing.endPoint;
  if (!startPt || !endPt) return null;
  return { startPt, endPt };
}

// Group arrows that share similar direction + end position into clusters.
function clusterArrows(drawings, w, h) {
  const arrows = drawings.map(extractArrow).filter(Boolean);
  if (arrows.length === 0) return [];

  const used = new Set();
  const groups = [];
  const threshold = Math.min(w, h) * 0.15;
  const cosThresh = Math.cos(Math.PI / 9); // 20-degree cone

  for (let i = 0; i < arrows.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    used.add(i);

    const a = arrows[i];
    const dax = a.endPt.x - a.startPt.x;
    const day = a.endPt.y - a.startPt.y;
    const lenA = Math.sqrt(dax * dax + day * day);

    for (let j = i + 1; j < arrows.length; j++) {
      if (used.has(j)) continue;
      const b = arrows[j];
      const dbx = b.endPt.x - b.startPt.x;
      const dby = b.endPt.y - b.startPt.y;
      const lenB = Math.sqrt(dbx * dbx + dby * dby);

      const dotNorm = (lenA > 0 && lenB > 0)
        ? (dax * dbx + day * dby) / (lenA * lenB)
        : 1;

      const endDistPx = Math.sqrt(
        ((a.endPt.x - b.endPt.x) * w) ** 2 +
        ((a.endPt.y - b.endPt.y) * h) ** 2
      );

      if (dotNorm >= cosThresh && endDistPx < threshold) {
        group.push(j);
        used.add(j);
      }
    }

    const avgStart = {
      x: group.reduce((s, idx) => s + arrows[idx].startPt.x, 0) / group.length,
      y: group.reduce((s, idx) => s + arrows[idx].startPt.y, 0) / group.length,
    };
    const avgEnd = {
      x: group.reduce((s, idx) => s + arrows[idx].endPt.x, 0) / group.length,
      y: group.reduce((s, idx) => s + arrows[idx].endPt.y, 0) / group.length,
    };
    groups.push({ count: group.length, avgStart, avgEnd });
  }

  return groups;
}

function generateArrows(ctx, drawings, w, h) {
  if (!drawings || drawings.length === 0) return;

  const clusters = clusterArrows(drawings, w, h);

  // Draw thin orange singles first, then bold red on top
  const singles  = clusters.filter(c => c.count === 1);
  const repeated = clusters.filter(c => c.count >= 2);

  singles.forEach(c => {
    const sx = c.avgStart.x * w;
    const sy = c.avgStart.y * h;
    const ex = c.avgEnd.x * w;
    const ey = c.avgEnd.y * h;
    drawArrow(ctx, sx, sy, ex, ey, '#f97316', 2);
  });

  repeated.forEach(c => {
    const sx = c.avgStart.x * w;
    const sy = c.avgStart.y * h;
    const ex = c.avgEnd.x * w;
    const ey = c.avgEnd.y * h;
    drawArrow(ctx, sx, sy, ex, ey, '#ef4444', 5);

    // Count badge at endpoint
    ctx.fillStyle = 'rgba(239,68,68,0.95)';
    ctx.beginPath();
    ctx.arc(ex, ey, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(c.count), ex, ey);
  });
}

function drawLegend(ctx, w, h) {
  const padX = 10, padY = 10;
  const bw = 148, bh = 52;
  const bx = w - padX - bw;
  const by = h - padY - bh;

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(bx, by, bw, bh, 6);
  } else {
    ctx.rect(bx, by, bw, bh);
  }
  ctx.fill();

  // Red line sample
  const lx1 = bx + 10, lx2 = bx + 36, ly1 = by + 16;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly1); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('repeated pattern', lx2 + 6, ly1);

  // Orange line sample
  const ly2 = by + 36;
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx1, ly2); ctx.lineTo(lx2, ly2); ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.fillText('single attack', lx2 + 6, ly2);
}

export default function HeatmapModal() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { showHeatmap, currentMatch } = state;
  const canvasRef = useRef(null);
  const [activeTab, setActiveTab] = useState('attacks');

  const setIndex      = currentMatch ? currentMatch.currentSetIndex : 0;
  const currentSet    = currentMatch?.sets[setIndex];
  const attackDrawings  = currentSet?.attackDrawings  || [];
  const blockingDrawings = currentSet?.blockingDrawings || [];

  const activeDrawings = activeTab === 'attacks' ? attackDrawings : blockingDrawings;

  const attackLabels   = { top: t('courtOpponentAttacks'), bottom: t('courtHomeDefense') };
  const blockingLabels = { top: t('courtBlockingMistakes'), bottom: t('courtBlockingPosition') };
  const activeLabels   = activeTab === 'attacks' ? attackLabels : blockingLabels;

  useEffect(() => {
    if (!showHeatmap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCourtBase(ctx, canvas.width, canvas.height, activeLabels.top, activeLabels.bottom);
    if (activeDrawings.length > 0) {
      generateArrows(ctx, activeDrawings, canvas.width, canvas.height);
      drawLegend(ctx, canvas.width, canvas.height);
    }
  }, [showHeatmap, activeTab, attackDrawings.length, blockingDrawings.length]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const suffix = activeTab === 'attacks' ? 'attacks' : 'blocking';
    link.download = `heatmap_${suffix}_set${setIndex + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (!showHeatmap) return null;

  const noDataKey = activeTab === 'attacks' ? 'noAttackDrawings' : 'noBlockingDrawings';
  const countKey  = activeTab === 'attacks' ? 'attacksRecorded'  : 'blockingDrawingsCount';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div>
          <div className="text-white font-bold">{t('attackHeatmap')} — {t('setLabel')} {setIndex + 1}</div>
          <div className="text-slate-400 text-xs mt-0.5">
            {t(countKey, { n: activeDrawings.length })}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-700 text-sm text-white transition-colors"
            onClick={handleDownload}
          >
            <Download size={14} /> {t('export')}
          </button>
          <button
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
            onClick={() => dispatch({ type: 'HIDE_HEATMAP' })}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'attacks'
              ? 'bg-red-900 border border-red-700 text-red-200'
              : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('attacks')}
        >
          {t('opponentAttacksTab')}
          <span className="ml-1.5 text-xs opacity-70">({attackDrawings.length})</span>
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'blocking'
              ? 'bg-amber-900 border border-amber-700 text-amber-200'
              : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('blocking')}
        >
          {t('blockingMistakesTab')}
          <span className="ml-1.5 text-xs opacity-70">({blockingDrawings.length})</span>
        </button>
      </div>

      {activeDrawings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 px-6 text-center">
          {t(noDataKey)}
        </div>
      ) : (
        <>
          <div className="flex-1 relative mx-3 mb-2 rounded-xl overflow-hidden border border-slate-700">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          <div className="flex gap-2 px-3 pb-2 overflow-x-auto flex-shrink-0">
            {activeDrawings.map((d, i) => (
              <div key={d.id} className="flex-shrink-0">
                <div className="text-slate-500 text-[10px] text-center mb-0.5">#{i + 1}</div>
                <img
                  src={d.imageData}
                  alt={`Drawing ${i + 1}`}
                  className="w-16 h-24 object-cover rounded border border-slate-700"
                />
                <div className="text-slate-500 text-[10px] text-center mt-0.5">
                  {d.score?.home}-{d.score?.opponent}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-3 px-4 pb-4 pt-2 flex-shrink-0">
        <button
          className="flex-1 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold transition-colors"
          onClick={() => {
            dispatch({ type: 'HIDE_HEATMAP' });
            dispatch({ type: 'START_NEW_SET' });
          }}
        >
          {t('startNextSet')}
        </button>
        <button
          className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
          onClick={() => dispatch({ type: 'END_MATCH' })}
        >
          {t('endMatch')}
        </button>
      </div>
    </div>
  );
}
