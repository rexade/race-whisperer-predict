// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../apiClient';
import { RaceAnalysisCache } from '../v75Cache/raceAnalysisCache';
import { RawTimeCandidatesCache } from '../v75Cache/rawTimeCandidatesCache';
import { RawTimesCache } from '../v75Cache/rawTimesCache';

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('persistence write failures', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips optional persistence when the build has no backend', async () => {
    vi.stubEnv('VITE_PERSISTENCE_API_ENABLED', 'false');

    await RaceAnalysisCache.storeRaceAnalysis('r1', 1, '2026-08-20', []);
    await RawTimesCache.storeRawTimes('2026-08-20', 'g1', 'r1', 1, []);
    await expect(RaceAnalysisCache.getAllMAEResults()).resolves.toEqual([]);
    await expect(RawTimesCache.getRawTimes('r1')).resolves.toBeNull();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a failed race-analysis write', async () => {
    await expect(
      RaceAnalysisCache.storeRaceAnalysis('r1', 1, '2026-08-20', []),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('rejects a failed MAE write', async () => {
    await expect(
      RaceAnalysisCache.storeMAEResult({
        raceId: 'r1',
        raceNumber: 1,
        analysisDate: '2026-08-20',
        computedAt: '2026-08-20T10:00:00Z',
        meanRankError: 1,
        horseCount: 1,
        horses: [],
      }),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('rejects a failed raw-times write', async () => {
    await expect(
      RawTimesCache.storeRawTimes('2026-08-20', 'g1', 'r1', 1, []),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('rejects a failed raw-time-candidate write', async () => {
    await expect(
      RawTimeCandidatesCache.storeCandidates('2026-08-20', 'g1', 'r1', 1, {
        raceId: 'r1',
        raceNumber: 1,
        date: '2026-08-20',
        startCount: 0,
        unfiltered: true,
        filtersApplied: [],
        notes: [],
        horses: [],
      }),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('propagates network failures', async () => {
    const networkError = new TypeError('network unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    await expect(
      RawTimesCache.storeRawTimes('2026-08-20', 'g1', 'r1', 1, []),
    ).rejects.toBe(networkError);
  });
});
