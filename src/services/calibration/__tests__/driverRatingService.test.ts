import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDriverEmpiricalRate,
  getDriverRatingsSnapshot,
  invalidateDriverRatingCache,
  primeDriverRatingCache,
  saveDriverRatings,
} from '../driverRatingService';

describe('driverRatingService', () => {
  afterEach(() => {
    invalidateDriverRatingCache();
    vi.unstubAllGlobals();
  });

  it('keeps ratings available in memory when persistent storage is unavailable', () => {
    saveDriverRatings(new Map([['test driver', 0.25]]));

    expect(getDriverEmpiricalRate('Test', 'Driver')).toBe(0.25);
  });

  it('transfers only finite probability ratings between JavaScript realms', () => {
    primeDriverRatingCache({
      'valid driver': 0.3,
      negative: -0.1,
      oversized: 1.1,
      infinite: Number.POSITIVE_INFINITY,
    });

    expect(getDriverRatingsSnapshot()).toEqual({ 'valid driver': 0.3 });
    expect(getDriverEmpiricalRate('Valid', 'Driver')).toBe(0.3);
  });

  it('keeps persisted ratings isolated by game type', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    saveDriverRatings(new Map([['v75 driver', 0.25]]), 'V75');
    saveDriverRatings(new Map([['v86 driver', 0.35]]), 'V86');
    invalidateDriverRatingCache();

    expect(getDriverRatingsSnapshot('V75')).toEqual({ 'v75 driver': 0.25 });
    expect(getDriverRatingsSnapshot('V86')).toEqual({ 'v86 driver': 0.35 });
  });
});
