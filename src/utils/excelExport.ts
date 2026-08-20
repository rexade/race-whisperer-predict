import * as XLSX from 'xlsx';
import type { V75RaceResult } from '@/components/v75/types/raceResultTypes';
import type { GameType } from '@/config/game';

const formatTimeForExcel = (time: any): string => {
  if (!time || (time.minutes === 0 && time.seconds === 0 && time.tenths === 0)) return '—';
  return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
};

export const buildAnalysisWorkbook = (races: V75RaceResult[]): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
  // Create a sheet for each race
  races.forEach((race, index) => {
    const sheetData = race.horses.map(horse => {
      const predictedTime = horse.modernNormalizedResult?.modernNormalizedTime;
      const rawTime = horse.modernNormalizedResult?.rawTime;
      const bestTime = horse.bestRecordTime;
      
      return {
        'Start Number': horse.startNumber ?? horse.postPosition,
        'Post Position': horse.postPosition,
        'Horse Name': horse.horseName,
        'Driver': horse.driverName || '-',
        'Raw Time (Best 3)': formatTimeForExcel(rawTime),
        'Predicted Time': formatTimeForExcel(predictedTime),
        'Best Ever': formatTimeForExcel(bestTime),
        'Final Score': horse.finalScore?.toFixed(2) || '-',
        'Rank': horse.rank,
        'Status': horse.warning ? '⚠️ Warning' : horse.uncertain ? '≈ Uncertain' : 'OK',
        'Confidence': horse.confidenceMultiplier ? (horse.confidenceMultiplier * 100).toFixed(0) + '%' : '-',
        'Start Points': horse.statistics?.startPoints || '-',
        'Place %': horse.statistics?.placePercentage ? (horse.statistics.placePercentage / 100).toFixed(1) + '%' : '-',
        'Win %': horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(1) + '%' : '-',
      };
    });
    
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 },  // Start Number
      { wch: 12 },  // Post Position
      { wch: 25 },  // Horse Name
      { wch: 20 },  // Driver
      { wch: 14 },  // Raw Time
      { wch: 14 },  // Predicted Time
      { wch: 14 },  // Best Ever
      { wch: 12 },  // Final Score
      { wch: 8 },   // Rank
      { wch: 14 },  // Status
      { wch: 12 },  // Confidence
      { wch: 12 },  // Start Points
      { wch: 10 },  // Place %
      { wch: 10 },  // Win %
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, `Leg ${index + 1}`);
  });
  
  // Create summary sheet
  const summaryData = races.map((race, index) => ({
    'Leg': index + 1,
    'Track Race': race.raceNumber,
    'Track': race.track,
    'Total Horses': race.horses.length,
    'Avg Score': race.horses.length > 0
      ? (race.horses.reduce((sum, h) => sum + (h.finalScore || 0), 0) / race.horses.length).toFixed(2)
      : '-',
    'Warnings': race.horses.filter(h => h.warning).length,
    'Uncertain': race.horses.filter(h => h.uncertain).length,
  }));
  
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary', true);

  return workbook;
};

export const analysisWorkbookFilename = (gameType: GameType, analysisDate?: string): string => {
  const dateStr = analysisDate || new Date().toISOString().split('T')[0];
  return `${gameType}_Analysis_${dateStr}.xlsx`;
};

export const exportV75ToExcel = (
  races: V75RaceResult[],
  analysisDate?: string,
  gameType: GameType = 'V75'
) => {
  const workbook = buildAnalysisWorkbook(races);
  
  // Write file
  XLSX.writeFile(workbook, analysisWorkbookFilename(gameType, analysisDate));
};
