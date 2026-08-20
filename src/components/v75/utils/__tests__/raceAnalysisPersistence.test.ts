// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { V75HorseResult } from '../../types/raceResultTypes';

const storeRaceAnalysis = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/services/v75Cache/raceAnalysisCache', () => ({
  RaceAnalysisCache: { storeRaceAnalysis },
}));

import { storeRaceAnalysisData } from '../horseResultBuilder';

const horse = (
  horseId: number,
  seconds: number,
  options: { uncertain?: boolean; isEstimated?: boolean; confidence?: number } = {}
): V75HorseResult => ({
  raceNumber: 1,
  raceId: 'race-1',
  horseKey: `race-1:start:${horseId}`,
  horseId,
  horseName: `Horse ${horseId}`,
  startNumber: horseId,
  postPosition: horseId,
  driverName: 'Driver',
  track: 'Track',
  distance: 2140,
  startMethod: 'auto',
  uncertain: options.uncertain,
  confidence: options.confidence,
  modernNormalizedResult: {
    modernNormalizedTime: {
      minutes: Math.floor(seconds / 60),
      seconds: Math.floor(seconds % 60),
      tenths: Math.round((seconds % 1) * 10),
    },
    isEstimated: options.isEstimated,
  },
});

describe('storeRaceAnalysisData', () => {
  it('persists canonical scores/ranks and explicit estimate provenance', async () => {
    const uncertainLeader = horse(1, 71, { uncertain: true, confidence: 40 });
    const reliableRunner = horse(2, 71.2, { confidence: 80 });
    const estimate = horse(3, 70, { isEstimated: true });

    await storeRaceAnalysisData(
      { raceId: 'race-1', raceNumber: 1 },
      [uncertainLeader, reliableRunner, estimate],
      '2026-08-21'
    );

    const stored = storeRaceAnalysis.mock.calls[0][3];
    expect(stored.map((entry: { horseId: number; rank: number }) => [entry.horseId, entry.rank])).toEqual([
      [3, 1],
      [2, 2],
      [1, 3],
    ]);
    expect(stored.find((entry: { horseId: number }) => entry.horseId === 3)).toMatchObject({
      isEstimated: true,
      predictedTime: undefined,
    });
    expect(stored.find((entry: { horseId: number }) => entry.horseId === 2)).toMatchObject({
      finalScore: 71.2,
      isEstimated: false,
      predictedTime: { minutes: 1, seconds: 11, tenths: 2 },
    });
  });
});
