// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateVolteStartDistancePenalty } from '../adjustmentCalculators';

/**
 * What a tillägg actually costs, in km-time terms.
 *
 * Two horses cross the line together; the back-marker covered D+d while the
 * front-marker covered D. Their km-times are 1000T/(D+d) and 1000T/D, so for
 * the back-marker to dead-heat its km-time must be faster by
 *
 *     kmTime * d / (D + d)
 *
 * That is the penalty to add to a back-marker's predicted time before the two
 * are comparable. It is exact and needs no fitted constant — only the horse's
 * km-time, the race distance, and the tillägg.
 *
 * The previous implementation charged a flat 0.4s to every back-marker
 * regardless of whether it gave away 20m or 80m, which over-penalised the
 * common 20m case by more than double and under-penalised 60m and beyond.
 */
describe('calculateVolteStartDistancePenalty', () => {
  const KM = 75; // 1:15,0 — a typical trotting km-time

  it('charges the exact km-time cost of the ground given away', () => {
    // 2640m race, 20m tillägg: 75 * 20 / 2660
    expect(calculateVolteStartDistancePenalty('volte', 2660, 2640, KM)).toBeCloseTo(0.564, 3);
    // 40m: 75 * 40 / 2680
    expect(calculateVolteStartDistancePenalty('volte', 2680, 2640, KM)).toBeCloseTo(1.119, 3);
    // 80m: 75 * 80 / 2720
    expect(calculateVolteStartDistancePenalty('volte', 2720, 2640, KM)).toBeCloseTo(2.206, 3);
  });

  it('scales with the tillägg instead of charging a flat rate', () => {
    // The defect being fixed: a flat penalty made 20m and 80m cost the same.
    const short = calculateVolteStartDistancePenalty('volte', 2660, 2640, KM);
    const long = calculateVolteStartDistancePenalty('volte', 2720, 2640, KM);
    expect(long / short).toBeCloseTo(3.9, 1);
  });

  it('costs more over a shorter race, where the same ground is a bigger share', () => {
    const shortRace = calculateVolteStartDistancePenalty('volte', 1660, 1640, KM);
    const longRace = calculateVolteStartDistancePenalty('volte', 3160, 3140, KM);
    expect(shortRace).toBeGreaterThan(longRace);
  });

  it('scales with km-time — slower races lose more seconds to the same ground', () => {
    const quick = calculateVolteStartDistancePenalty('volte', 2660, 2640, 70);
    const slow = calculateVolteStartDistancePenalty('volte', 2660, 2640, 85);
    expect(slow).toBeGreaterThan(quick);
    expect(slow / quick).toBeCloseTo(85 / 70, 3);
  });

  it('is zero for a front-line runner and for autostart', () => {
    expect(calculateVolteStartDistancePenalty('volte', 2640, 2640, KM)).toBe(0);
    expect(calculateVolteStartDistancePenalty('auto', 2660, 2640, KM)).toBe(0);
  });

  it('returns 0 rather than NaN when the km-time is unusable', () => {
    expect(calculateVolteStartDistancePenalty('volte', 2660, 2640, 0)).toBe(0);
    expect(calculateVolteStartDistancePenalty('volte', 2660, 2640, Number.NaN)).toBe(0);
  });
});
