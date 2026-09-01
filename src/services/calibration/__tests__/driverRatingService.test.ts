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

  it('still reads ratings written before the pool was shared', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) =>
        key === 'driver_empirical_ratings_V85' ? JSON.stringify({ 'legacy driver': 0.4 }) : null,
      setItem: () => {},
    });
    invalidateDriverRatingCache();

    expect(getDriverEmpiricalRate('Legacy', 'Driver')).toBe(0.4);
  });

  it('persists one shared rating pool rather than one per game type', () => {
    // A driver's win rate is a property of the driver, not of the pool they are
    // driving in. Keying storage by game type left every newly-enabled type
    // (V4, dd, enloppsspel...) with an empty pool, silently zeroing the
    // driverEmpirical weight instead of reusing the ratings we already have.
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    saveDriverRatings(new Map([['shared driver', 0.25]]));
    invalidateDriverRatingCache();

    expect([...values.keys()]).toEqual(['driver_empirical_ratings']);
    expect(getDriverRatingsSnapshot()).toEqual({ 'shared driver': 0.25 });
  });
});
