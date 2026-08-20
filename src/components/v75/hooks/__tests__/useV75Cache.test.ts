// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HorseRawKmTime } from '../../../../services/types/kmTimeTypes';

const mocks = vi.hoisted(() => ({
  getRawTimes: vi.fn(),
  storeRawTimes: vi.fn(),
  calculateRawTimes: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/services/v75CacheService', () => ({
  V75CacheService: {
    getRawTimes: mocks.getRawTimes,
    storeRawTimes: mocks.storeRawTimes,
  },
}));

vi.mock('@/services/kmTimeProcessor', () => ({
  calculateRawKmTimesForRaceWithId: mocks.calculateRawTimes,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.warn,
    error: vi.fn(),
  },
}));

vi.mock('@/config/game', () => ({ IS_DEBUG: false }));

import { useV75Cache } from '../useV75Cache';

const calculatedRawTime: HorseRawKmTime = {
  horseKey: '1',
  horseId: 1,
  horseName: 'Fresh Horse',
  allTimes: [],
  bestTime: { minutes: 1, seconds: 12, tenths: 0 },
  bestRecordTime: { minutes: 1, seconds: 11, tenths: 8 },
  validTimesCount: 2,
  dataSource: 'recent',
  oldestRecordDate: '2026-07-01',
  newestRecordDate: '2026-08-10',
};

describe('useV75Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRawTimes.mockResolvedValue(null);
    mocks.calculateRawTimes.mockResolvedValue([calculatedRawTime]);
  });

  it('returns fresh predictions when persisting them fails', async () => {
    const cacheError = new Error('backend unavailable');
    mocks.storeRawTimes.mockRejectedValue(cacheError);

    const result = await useV75Cache().getOrCalculateRawTimes(
      {
        raceId: 'race-1',
        raceNumber: 1,
        date: '2026-08-20',
        horses: [{
          horseKey: '1',
          horseId: 1,
          name: 'Fresh Horse',
          startNumber: 7,
          postPosition: 2,
          distance: 2140,
          driver: { firstName: 'A', lastName: 'Driver', winPercentage: 10 },
        }],
      },
      { gameId: 'game-1' },
      '2026-08-20'
    );

    expect(result).toEqual({ rawKmTimes: [calculatedRawTime], wasFromCache: false });
    expect(mocks.calculateRawTimes).toHaveBeenCalledWith(
      'race-1',
      [expect.objectContaining({ number: 7, postPosition: 2 })],
      undefined,
      '2026-08-20'
    );
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('continuing with fresh data'),
      cacheError
    );
  });
});
