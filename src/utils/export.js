import { calcPlayerStats, calcSetStats } from './stats';
import { EVENT_CONFIG } from './constants';

export async function exportToExcel(match) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Match summary sheet
  const summaryData = [
    ['Match Summary'],
    ['Date', new Date(match.date).toLocaleDateString()],
    ['Home Team', match.homeTeam.name],
    ['Opponent', match.opponentTeam.name],
    [],
    ['Set', 'Home Score', 'Opponent Score', 'Winner'],
    ...match.sets.map((s, i) => [
      `Set ${i + 1}`,
      s.homeScore,
      s.opponentScore,
      s.winner === 'home' ? match.homeTeam.name : match.opponentTeam.name,
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Player stats sheet
  const allEvents = match.sets.flatMap(s => s.events || []);
  const players = match.homeTeam.players;
  const statsRows = [
    ['Player', '#', 'Position', 'Points', 'Kills(2nd)', 'Kills(3rd)', 'Att%', 'Aces', 'Serve%', 'Def%', 'Blocks', 'Digs', 'Set%', 'Out', 'Blocked', 'Errors'],
    ...players.map(p => {
      const s = calcPlayerStats(p.id, allEvents);
      return [
        p.name, p.number, p.position,
        s.points, s.attackKills2nd, s.attackKills3rd,
        s.attackEfficiency !== null ? `${s.attackEfficiency}%` : '-',
        s.aces,
        s.servePct !== null ? `${s.servePct}%` : '-',
        s.defensePct !== null ? `${s.defensePct}%` : '-',
        s.blocks, s.defenseSuccess,
        s.setPct !== null ? `${s.setPct}%` : '-',
        s.attackOut, s.attackBlocked, s.errors,
      ];
    }),
  ];
  const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
  XLSX.utils.book_append_sheet(wb, statsSheet, 'Player Stats');

  // Events log sheet
  const eventRows = [
    ['Set', 'Time', 'Player', 'Event', 'Home Score', 'Opp Score'],
    ...match.sets.flatMap((set, si) =>
      (set.events || []).map(e => {
        const player = players.find(p => p.id === e.playerId);
        const eventConf = EVENT_CONFIG.find(c => c.type === e.type);
        return [
          si + 1,
          new Date(e.timestamp).toLocaleTimeString(),
          player ? `${player.name} (#${player.number})` : 'Unknown',
          eventConf ? eventConf.label : e.type,
          e.homeScore,
          e.opponentScore,
        ];
      })
    ),
  ];
  const eventsSheet = XLSX.utils.aoa_to_sheet(eventRows);
  XLSX.utils.book_append_sheet(wb, eventsSheet, 'Events Log');

  const filename = `${match.homeTeam.name}_vs_${match.opponentTeam.name}_${new Date(match.date).toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportToPDF(match) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();
  const dateStr = new Date(match.date).toLocaleDateString();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text('Catchball Match Report', 105, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text(`${match.homeTeam.name} vs ${match.opponentTeam.name}`, 105, 32, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Date: ${dateStr}`, 105, 40, { align: 'center' });

  // Set scores
  let y = 55;
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('Set Results', 14, y);
  y += 8;

  const setRows = match.sets.map((s, i) => [
    `Set ${i + 1}`,
    `${s.homeScore} - ${s.opponentScore}`,
    s.winner === 'home' ? match.homeTeam.name : match.opponentTeam.name,
  ]);

  doc.autoTable({
    startY: y,
    head: [['Set', 'Score', 'Winner']],
    body: setRows,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95] },
    margin: { left: 14 },
  });

  // Player stats
  y = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(13);
  doc.text('Player Statistics', 14, y);
  y += 8;

  const allEvents = match.sets.flatMap(s => s.events || []);
  const players = match.homeTeam.players;
  const statsRows = players.map(p => {
    const s = calcPlayerStats(p.id, allEvents);
    return [
      `${p.name} (#${p.number})`,
      p.position || '-',
      s.points,
      `${s.attackKills2nd}/${s.attackKills3rd}`,
      s.attackEfficiency !== null ? `${s.attackEfficiency}%` : '-',
      s.aces,
      s.blocks,
      s.defensePct !== null ? `${s.defensePct}%` : '-',
      s.errors,
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['Player', 'Pos', 'Pts', 'K2/K3', 'Att%', 'Aces', 'Blk', 'Def%', 'Err']],
    body: statsRows,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95] },
    margin: { left: 14 },
    styles: { fontSize: 9 },
  });

  const filename = `${match.homeTeam.name}_vs_${match.opponentTeam.name}_${new Date(match.date).toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
