// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCalibrationCacheInfo,
  loadCalibrationDataset,
  saveCalibrationDataset,
} from '../calibrationDatasetCache';
import type { CalibrationDataset } from '../historicalCalibrationService';
import type { HorseRawKmTime } from '@/services/types/kmTimeTypes';

describe('calibration dataset cache game type isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stores the same month window independently per game type', async () => {
    const v75 = [{ date: '2026-01-01', races: [] }] as CalibrationDataset;
    const v85 = [{ date: '2026-02-02', races: [] }] as CalibrationDataset;

    await saveCalibrationDataset(6, v75, 'V75');
    await saveCalibrationDataset(6, v85, 'V85');

    expect(await loadCalibrationDataset(6, 'V75')).toEqual(v75);
    expect(await loadCalibrationDataset(6, 'V85')).toEqual(v85);
    expect(JSON.parse(localStorage.getItem('calibration_dataset_V75_6mo')!).schemaVersion).toBe(4);
  });

  it('round-trips every raw-time field without changing provenance metadata', async () => {
    const rawKmTime: HorseRawKmTime = {
      horseKey: 'race-1:start:7',
      horseId: 0,
      horseName: 'Metadata Horse',
      allTimes: [{
        originalTime: { minutes: 1, seconds: 13, tenths: 2 },
        normalizedTime: { minutes: 1, seconds: 12, tenths: 8 },
        raceDate: '2026-01-01',
        distance: 2140,
        startMethod: 'auto',
        finishOrder: 2,
        postPosition: 5,
        valid: true,
        raceId: 'historical-race',
        rawTimeWindow: 'older-fill',
      }],
      bestTime: { minutes: 1, seconds: 12, tenths: 8 },
      rawBestTime: { minutes: 1, seconds: 12, tenths: 3 },
      bestRecordTime: { minutes: 1, seconds: 11, tenths: 9 },
      validTimesCount: 0,
      isNotifiee: true,
      dataSource: 'fallback',
      oldestRecordDate: '2025-01-01',
      newestRecordDate: '2026-01-01',
      confidenceMultiplier: 0.45,
      usedStatisticsFallback: true,
      gallopRate: 0.4,
      lastRaceDate: '2026-01-01',
      consistencyScore: 3.2,
      usedExtendedFallback: true,
      usedInvalidTimeFallback: true,
      gallopCount: 4,
      gallopDates: ['2026-01-01'],
      disqualificationCount: 2,
      averageOdds: 12.3,
      lastOdds: 7.8,
      horseAge: 6,
      dataSourceChain: 'records(0)->stats(1)->used',
      warning: {
        type: 'invalid-record',
        message: 'Invalid historical record used',
        reason: 'only fallback available',
      },
    };
    const dataset = [{
      date: '2026-01-02',
      races: [{
        raceId: 'race-1', raceNumber: 1, raceData: { raceId: 'race-1' },
        rawKmTimes: [rawKmTime],
        actualResults: new Map([['race-1:start:7', { position: 1 }]]),
      }],
    }] as CalibrationDataset;

    await saveCalibrationDataset(6, dataset, 'V75');

    expect(await loadCalibrationDataset(6, 'V75')).toEqual(dataset);
  });

  it('rejects schema v3 datasets and cache metadata from the corrected pipeline', async () => {
    const stale = {
      schemaVersion: 3,
      gameType: 'V75',
      monthsBack: 6,
      cachedAt: '2026-08-20T00:00:00.000Z',
      dates: [],
    };
    localStorage.setItem('calibration_dataset_V75_6mo', JSON.stringify(stale));
    localStorage.setItem('calibration_dataset_V75_6mo_meta', JSON.stringify({
      schemaVersion: 3,
      gameType: 'V75',
      cachedAt: stale.cachedAt,
      dateCount: 99,
    }));

    await expect(loadCalibrationDataset(6, 'V75')).resolves.toBeNull();
    await expect(getCalibrationCacheInfo(6, 'V75')).resolves.toEqual({
      exists: false,
      ageHours: null,
      dateCount: 0,
      cachedAt: null,
    });
  });
});
