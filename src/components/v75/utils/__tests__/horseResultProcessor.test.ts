// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '@/services/modernKm/types';
import { makeHorseKey } from '@/services/horseIdentity';
import type { HorseRawKmTime } from '@/services/types/kmTimeTypes';
import type { V75RaceData } from '@/services/v75CalendarApi';
import { processHorseResults } from '../horseResultProcessor';

describe('processHorseResults', () => {
  it('treats a zero raw time as missing history and keeps the result estimated', async () => {
    const horseKey = makeHorseKey('race-1', 11, 7);
    const race: V75RaceData = {
      raceId: 'race-1',
      raceNumber: 1,
      distance: 2140,
      startMethod: 'auto',
      track: 'Solvalla',
      name: 'Test race',
      date: '2026-08-22',
      prize: 0,
      horses: [{
        horseKey,
        horseId: 11,
        name: 'No History',
        startNumber: 7,
        postPosition: 2,
        distance: 2140,
        driver: {
          firstName: 'Test', lastName: 'Driver', experience: 0,
          winPercentage: 0, winPercentage2025: 0,
        },
        statistics: {
          startPoints: 0, placePercentage: 0, winPercentage: 0, earningsPerStart: 0,
        },
        shoes: { front: true, back: true },
        sulky: { type: 'VA' },
        homeTrack: 'Solvalla',
      }],
    };
    const zero = { minutes: 0, seconds: 0, tenths: 0 };
    const rawTimes: HorseRawKmTime[] = [{
      horseKey,
      horseId: 11,
      horseName: 'No History',
      allTimes: [],
      rawBestTime: zero,
      bestTime: zero,
      bestRecordTime: zero,
      validTimesCount: 0,
    }];

    const [result] = await processHorseResults(race, rawTimes, DEFAULT_WEIGHTS);

    expect(result.startNumber).toBe(7);
    expect(result.postPosition).toBe(2);
    expect(result.rawKmTime).toBeUndefined();
    expect(result.modernNormalizedResult?.isEstimated).toBe(true);
    expect(result.predictedTime).toBeUndefined();
  });
});
