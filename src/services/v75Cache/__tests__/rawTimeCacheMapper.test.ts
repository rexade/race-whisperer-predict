// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fromCachedRawTime, toCachedRawTime } from '../rawTimeCacheMapper';
import type { CachedRawTime } from '../types';

describe('raw-time cache mapping', () => {
  it('round-trips sample counts and history provenance', () => {
    const updatedAt = '2026-08-20T12:00:00.000Z';
    const cached = toCachedRawTime({
      horseKey: 'race-1:horse-9',
      horseId: 9,
      horseName: 'History Horse',
      postPosition: 4,
      allTimes: [],
      bestTime: { minutes: 1, seconds: 12, tenths: 3 },
      rawBestTime: { minutes: 1, seconds: 12, tenths: 1 },
      bestRecordTime: { minutes: 1, seconds: 11, tenths: 8 },
      validTimesCount: 0,
      isNotifiee: true,
      dataSource: 'fallback',
      oldestRecordDate: '2026-01-03',
      newestRecordDate: '2026-05-19',
      gallopCount: 3,
      gallopDates: ['2026-05-19'],
      disqualificationCount: 2,
      warning: {
        type: 'invalid-record',
        message: 'Limited history',
        reason: 'single-record',
      },
    }, updatedAt);

    const restored = fromCachedRawTime(cached);

    expect(restored).toMatchObject({
      validTimesCount: 0,
      isNotifiee: true,
      dataSource: 'fallback',
      oldestRecordDate: '2026-01-03',
      newestRecordDate: '2026-05-19',
      gallopCount: 3,
      disqualificationCount: 2,
      warning: {
        type: 'invalid-record',
        message: 'Limited history',
        reason: 'single-record',
      },
    });
    expect(cached.updatedAt).toBe(updatedAt);
  });

  it('does not substitute cache timestamps or samples for absent legacy metadata', () => {
    const legacy: CachedRawTime = {
      horseId: 5,
      horseName: 'Legacy Horse',
      postPosition: 2,
      validTimesCount: 0,
      updatedAt: '2026-08-20T12:00:00.000Z',
    };

    const restored = fromCachedRawTime(legacy);

    expect(restored.validTimesCount).toBe(0);
    expect(restored.dataSource).toBeUndefined();
    expect(restored.oldestRecordDate).toBeUndefined();
    expect(restored.newestRecordDate).toBeUndefined();
  });
});
