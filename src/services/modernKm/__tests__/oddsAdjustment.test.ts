// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateOddsAdjustment } from '../performanceCalculators';

/**
 * Ranking by predicted time is a strength ordering, and strength is log-probability.
 * Implied probability is ~1/odds, so the encoding that preserves it is log(odds).
 * These tests pin the properties that follow from that, and guard the saturation
 * failure the previous tanh encoding had.
 */
describe('calculateOddsAdjustment', () => {
  it('is zero at the neutral price and monotonic in odds', () => {
    expect(calculateOddsAdjustment(8)).toBeCloseTo(0, 6);
    const prices = [1.5, 2, 3, 5, 8, 12, 20, 40, 100];
    const adjustments = prices.map(calculateOddsAdjustment);
    for (let i = 1; i < adjustments.length; i++) {
      expect(adjustments[i]).toBeGreaterThan(adjustments[i - 1]);
    }
  });

  it('gives equal separation to equal probability ratios', () => {
    // The defining property of a log encoding: each halving of implied
    // probability costs the same, whether it happens at short or long odds.
    const a = calculateOddsAdjustment(4) - calculateOddsAdjustment(2);
    const b = calculateOddsAdjustment(8) - calculateOddsAdjustment(4);
    const c = calculateOddsAdjustment(16) - calculateOddsAdjustment(8);
    expect(a).toBeCloseTo(b, 6);
    expect(b).toBeCloseTo(c, 6);
  });

  it('resolves the favourite range instead of saturating it', () => {
    // Regression guard. Under the old tanh (centred 8, scale 6, cap 0.30s) a
    // 66.7% chance and a 50% chance separated by 0.006s — less than a tenth of
    // one gate of post position, so favourites could not influence the ranking.
    const separation = Math.abs(calculateOddsAdjustment(1.5) - calculateOddsAdjustment(2));
    expect(separation).toBeGreaterThan(0.04);
  });

  it('keeps distinguishing horses out in the tail', () => {
    // The old encoding mapped odds 30, 50 and 100 to an identical +0.300s.
    expect(calculateOddsAdjustment(50)).toBeGreaterThan(calculateOddsAdjustment(30));
    expect(calculateOddsAdjustment(100)).toBeGreaterThan(calculateOddsAdjustment(50));
  });

  it('treats shorter odds as faster (negative) and longer as slower (positive)', () => {
    expect(calculateOddsAdjustment(2)).toBeLessThan(0);
    expect(calculateOddsAdjustment(30)).toBeGreaterThan(0);
  });

  it('returns 0 for missing, zero, negative or non-finite odds', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateOddsAdjustment(bad)).toBe(0);
    }
  });

  it('clamps extreme prices rather than letting one horse dominate the score', () => {
    expect(Math.abs(calculateOddsAdjustment(10_000))).toBeLessThanOrEqual(0.9);
  });
});
