import { describe, expect, it } from 'vitest';
import { getDriverEmpiricalRate, saveDriverRatings } from '../driverRatingService';

describe('driverRatingService', () => {
  it('keeps ratings available in memory when persistent storage is unavailable', () => {
    saveDriverRatings(new Map([['test driver', 0.25]]));

    expect(getDriverEmpiricalRate('Test', 'Driver')).toBe(0.25);
  });
});
