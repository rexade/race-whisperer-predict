// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRaceDataForGame, fetchV75GameInfo } from '@/services/v75CalendarApi';
import { RaceResultProcessor } from '@/components/v75/services/raceResultProcessor';
import { V75ResultsFetcher } from '@/components/v75/services/v75ResultsFetcher';
import { V75CacheService } from '@/services/v75CacheService';
import {
  collectCalibrationData,
  evaluateWeights,
  type CalibrationDataset,
} from '../historicalCalibrationService';
import { DEFAULT_WEIGHTS } from '@/services/modernKm/types';

vi.mock('@/services/v75CalendarApi', () => ({
  fetchV75GameInfo: vi.fn(),
  fetchRaceDataForGame: vi.fn(),
}));

vi.mock('@/components/v75/services/raceResultProcessor', () => ({
  RaceResultProcessor: { processRaceResult: vi.fn() },
}));

vi.mock('@/components/v75/services/v75ResultsFetcher', () => ({
  V75ResultsFetcher: { fetchActualResults: vi.fn() },
}));

vi.mock('@/services/v75CacheService', () => ({
  V75CacheService: { getRawTimes: vi.fn(), storeRawTimes: vi.fn() },
}));

describe('historical calibration boundaries', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards the selected game type through calibration collection', async () => {
    const gameInfo = {
      gameId: 'v75-game', raceIds: [], startTime: '', jackpotAmount: 0, track: 'Solvalla',
    };
    vi.mocked(fetchV75GameInfo).mockResolvedValue(gameInfo);
    vi.mocked(fetchRaceDataForGame).mockResolvedValue([]);

    await collectCalibrationData(['2026-08-01'], undefined, undefined, true, 'V75');

    expect(fetchV75GameInfo).toHaveBeenCalledWith('2026-08-01', 'V75');
    expect(fetchRaceDataForGame).toHaveBeenCalledWith('2026-08-01', gameInfo, 'V75');
  });

  it('hydrates raw-time cache hits through the canonical lossless mapper', async () => {
    const gameInfo = {
      gameId: 'v75-game', raceIds: ['race-1'], startTime: '', jackpotAmount: 0, track: 'Solvalla',
    };
    const raceData = {
      raceId: 'race-1', raceNumber: 1, date: '2026-08-01', track: 'Solvalla',
      distance: 2140, startMethod: 'auto', name: 'Race 1', prize: 0,
      horses: [{ horseKey: '11', horseId: 11, startNumber: 7, postPosition: 2 }],
    } as any;
    const warning = {
      type: 'invalid-record' as const,
      message: 'Invalid historical record used',
      reason: 'only fallback available',
    };

    vi.mocked(fetchV75GameInfo).mockResolvedValue(gameInfo);
    vi.mocked(fetchRaceDataForGame).mockResolvedValue([raceData]);
    vi.mocked(V75ResultsFetcher.fetchActualResults).mockResolvedValue([{
      raceId: 'race-1', raceNumber: 1, distance: 2140, raceTime: '',
      finishOrder: [{ position: 1, horseKey: '11', horseId: 11, horseName: 'Cached', postPosition: 2, time: '', driver: '' }],
    }]);
    vi.mocked(V75CacheService.getRawTimes).mockResolvedValue({
      date: '2026-08-01', gameId: 'v75-game', raceId: 'race-1', raceNumber: 1,
      cachedAt: '2026-08-01T00:00:00.000Z', schemaVersion: 7,
      rawTimes: [{
        horseKey: '11', horseId: 11, horseName: 'Cached', postPosition: 2,
        allTimes: [], bestTime: { minutes: 1, seconds: 12, tenths: 3 },
        bestRecordTime: { minutes: 1, seconds: 11, tenths: 9 }, validTimesCount: 0,
        updatedAt: '2026-08-01T00:00:00.000Z', isNotifiee: true, dataSource: 'fallback',
        oldestRecordDate: '2025-01-01', newestRecordDate: '2025-06-01',
        gallopCount: 4, disqualificationCount: 2, warning,
      }],
    });

    const dataset = await collectCalibrationData(['2026-08-01'], undefined, undefined, true, 'V75');
    const cached = dataset[0].races[0].rawKmTimes[0];

    expect(cached).toMatchObject({
      validTimesCount: 0,
      isNotifiee: true,
      dataSource: 'fallback',
      oldestRecordDate: '2025-01-01',
      newestRecordDate: '2025-06-01',
      gallopCount: 4,
      disqualificationCount: 2,
      warning,
    });
  });

  it('removes estimated horses before forming predicted and actual ranks', async () => {
    vi.mocked(RaceResultProcessor.processRaceResult)
      .mockResolvedValueOnce({
        raceId: 'race-1', raceNumber: 1, track: 'T', distance: 2140,
        startMethod: 'auto', name: 'R1', prize: 0, analysisComplete: true,
        horses: [
          horse('estimated', 70, true, 1),
          horse('winner', 71, false, 2),
          horse('other', 72, false, 3),
        ],
      })
      .mockResolvedValueOnce({
        raceId: 'race-2', raceNumber: 2, track: 'T', distance: 2140,
        startMethod: 'auto', name: 'R2', prize: 0, analysisComplete: true,
        horses: [horse('estimated-winner', 70, true, 1)],
      });

    const dataset: CalibrationDataset = [{
      date: '2026-08-01',
      races: [
        calibrationRace('race-1', new Map([
          ['estimated', { position: 3 }],
          ['winner', { position: 1 }],
          ['other', { position: 2 }],
        ])),
        calibrationRace('race-2', new Map([
          ['estimated-winner', { position: 1 }],
        ])),
      ],
    }];

    const result = await evaluateWeights(dataset, DEFAULT_WEIGHTS);

    expect(result.racesEvaluated).toBe(1);
    expect(result.horsesEvaluated).toBe(2);
    expect(result.estimatedHorsesSkipped).toBe(2);
    expect(result.rankMAE).toBe(0);
    expect(result.winnerRankMAE).toBe(1);
    expect(result.winnerMRR).toBe(1);
    expect(result.winAccuracy).toBe(1);
  });
});

function horse(key: string, seconds: number, estimated: boolean, rank: number): any {
  return {
    horseKey: key,
    horseId: rank,
    horseName: key,
    postPosition: rank,
    rank,
    finalScore: seconds,
    modernNormalizedResult: {
      isEstimated: estimated,
      modernNormalizedTime: { minutes: 1, seconds: seconds - 60, tenths: 0 },
    },
  };
}

function calibrationRace(raceId: string, actualResults: Map<string, { position: number }>): any {
  return {
    raceId,
    raceNumber: 1,
    raceData: { raceId },
    rawKmTimes: [],
    actualResults,
  };
}
