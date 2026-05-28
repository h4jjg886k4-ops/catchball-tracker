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
}

function generateHeatmap(ctx, endpoints, w, h) {
  if (!endpoints || endpoints.length === 0) return;

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const octx = offscreen.getContext('2d');

  const radius = Math.min(w, h) / 6;

  endpoints.forEach(pt => {
    if (!pt) return;
    const px = pt.x * w;
    const py = pt.y * h;
    const gradient = octx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0,   'rgba(255,  80,   0, 0.7)');
    gradient.addColorStop(0.3, 'rgba(255, 200,   0, 0.4)');
    gradient.addColorStop(0.6, 'rgba(  0, 100, 255, 0.2)');
    gradient.addColorStop(1,   'rgba(  0,   0, 255, 0)');
    octx.fillStyle = gradient;
    octx.beginPath();
    octx.arc(px, py, radius, 0, Math.PI * 2);
    octx.fill();
  });

  ctx.globalAlpha = 0.85;
  ctx.drawImage(offscreen, 0, 0);
  ctx.globalAlpha = 1;

  endpoints.forEach(pt => {
    if (!pt) return;
    const px = pt.x * w;
    const py = pt.y * h;
    ctx.fillStyle = '#ff4500';
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function countZones(pts, w, h) {
  const margin = 20;
  const cw = w - margin * 2;
  const zones = { '4': 0, '3': 0, '2': 0, '5': 0, '6': 0, '1': 0 };
  pts.forEach(pt => {
    if (!pt || pt.y < 0.5) return;
    const relX = (pt.x * w - margin) / cw;
    const relY = (pt.y * h - h / 2) / (h / 2 - margin);
    const col = relX < 0.33 ? 0 : relX < 0.67 ? 1 : 2;
    const row = relY < 0.5 ? 0 : 1;
    const zoneMap = [[4, 3, 2], [5, 6, 1]];
    const z = zoneMap[row]?.[col];
    if (z) zones[z] = (zones[z] || 0) + 1;
  });
  return zones;
}

function drawZoneLabels(ctx, zones, w, h) {
  const margin = 20;
  const cw = w - margin * 2;
  const attackOffset = (h - margin * 2) * 0.25;
  const positions = [
    { z: '4', x: margin + cw / 6,     y: h / 2 + attackOffset / 2 },
    { z: '3', x: margin + cw / 2,     y: h / 2 + attackOffset / 2 },
    { z: '2', x: margin + cw * 5 / 6, y: h / 2 + attackOffset / 2 },
    { z: '5', x: margin + cw / 6,     y: h - margin - attackOffset / 2 },
    { z: '6', x: margin + cw / 2,     y: h - margin - attackOffset / 2 },
    { z: '1', x: margin + cw * 5 / 6, y: h - margin - attackOffset / 2 },
  ];
  positions.forEach(({ z, x, y }) => {
    const count = zones[z] || 0;
    if (count === 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(12, w / 25)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count, x, y);
  });
}

export default function HeatmapModal() {
  const { state, dispatch } = useMatch();
  const { t } = useLanguage();
  const { showHeatmap, currentMatch } = state;
  const canvasRef = useRef(null);
  const [activeTab, setActiveTab] = useState('attacks');

  const setIndex = currentMatch ? currentMatch.currentSetIndex : 0;
  const currentSet = currentMatch?.sets[setIndex];
  const attackDrawings  = currentSet?.attackDrawings  || [];
  const blockingDrawings = currentSet?.blockingDrawings || [];

  const activeDrawings  = activeTab === 'attacks' ? attackDrawings : blockingDrawings;
  const activeEndpoints = activeDrawings.map(d => d.endPoint).filter(Boolean);

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
    drawCourtBase(ctx, canvas.width, canvas.height, activeLabels.top, activeLabels.bottom);
    generateHeatmap(ctx, activeEndpoints, canvas.width, canvas.height);
    const zoneCount = countZones(activeEndpoints, canvas.width, canvas.height);
    drawZoneLabels(ctx, zoneCount, canvas.width, canvas.height);
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
  const countKey  = activeTab === 'attacks' ? 'attacksRecorded' : 'blockingDrawingsCount';

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
          <div className="text-center text-slate-500 text-xs py-1 flex-shrink-0">
            {t('heatmapLegend')}
          </div>
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
