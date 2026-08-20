// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { HorseRawKmTime } from '../../../../services/types/kmTimeTypes';
import { analyzeHistorySource } from '../confidenceCalculator';

const rawTime = (overrides: Partial<HorseRawKmTime> = {}): HorseRawKmTime => ({
  horseId: 1,
  horseName: 'Horse 1',
  allTimes: [],
  bestTime: { minutes: 1, seconds: 12, tenths: 0 },
  bestRecordTime: { minutes: 1, seconds: 11, tenths: 5 },
  validTimesCount: 4,
  ...overrides,
});

describe('analyzeHistorySource', () => {
  it('uses raw-time samples with the flattened V75 horse shape', () => {
    const result = analyzeHistorySource(
      {
        statistics: {
          startPoints: 850,
          placePercentage: 40,
          winPercentage: 15,
          earningsPerStart: 22_000,
        },
      },
      rawTime({ newestRecordDate: new Date().toISOString() })
    );

    expect(result).toEqual({
      hasLocalHistory: true,
      hasAnyHistory: true,
      confidence: 62,
      historySource: 'local',
    });
  });

  it('does not treat a zero placeholder time as history', () => {
    const result = analyzeHistorySource(
      { statistics: {} },
      rawTime({
        allTimes: [],
        bestTime: { minutes: 0, seconds: 0, tenths: 0 },
        rawBestTime: { minutes: 0, seconds: 0, tenths: 0 },
        bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: 0,
      })
    );

    expect(result.hasAnyHistory).toBe(false);
    expect(result.historySource).toBe('none');
    expect(result.confidence).toBe(5);
  });
});
