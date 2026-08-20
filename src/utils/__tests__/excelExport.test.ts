// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { V75HorseResult, V75RaceResult } from '@/components/v75/types/raceResultTypes';
import { analysisWorkbookFilename, buildAnalysisWorkbook } from '../excelExport';

const horse: V75HorseResult = {
  raceNumber: 7,
  raceId: 'track-a-7',
  horseId: 0,
  horseKey: 'track-a-7:start:9',
  horseName: 'Export Horse',
  startNumber: 9,
  postPosition: 2,
  driverName: 'Driver',
  track: 'Track A',
  distance: 2140,
  startMethod: 'auto',
};

const race = (raceId: string, track: string): V75RaceResult => ({
  raceId,
  raceNumber: 7,
  track,
  distance: 2140,
  startMethod: 'auto',
  name: 'Race',
  prize: 0,
  horses: [{ ...horse, raceId, track, horseKey: `${raceId}:start:9` }],
  analysisComplete: true,
});

describe('Excel analysis export', () => {
  it('uses leg identity for sheets and keeps start number separate from post position', () => {
    const workbook = buildAnalysisWorkbook([
      race('track-a-7', 'Track A'),
      race('track-b-7', 'Track B'),
    ]);

    expect(workbook.SheetNames).toEqual(['Leg 1', 'Leg 2', 'Summary']);
    const firstRow = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Leg 1'])[0];
    expect(firstRow['Start Number']).toBe(9);
    expect(firstRow['Post Position']).toBe(2);

    const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Summary);
    expect(summary.map(row => [row.Leg, row['Track Race'], row.Track])).toEqual([
      [1, 7, 'Track A'],
      [2, 7, 'Track B'],
    ]);
  });

  it('uses the selected game type in the filename', () => {
    expect(analysisWorkbookFilename('V86', '2026-08-20')).toBe('V86_Analysis_2026-08-20.xlsx');
  });
});
