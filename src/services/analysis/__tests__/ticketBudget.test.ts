import { describe, expect, it } from 'vitest';
import { allocateBudget, calibrateWinProbabilities } from '../ticketBudget';

describe('calibrateWinProbabilities', () => {
  it('never reorders the field', () => {
    // The whole contract between the two layers: the prediction model owns the
    // order, the ticket engine only decides how deep to go. A calibration that
    // could move #2 above #1 would silently corrupt a model that already works.
    const seconds = [72.1, 72.4, 73.0, 75.6, 78.2];

    const probs = calibrateWinProbabilities(seconds, 1.5);

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeLessThan(probs[i - 1]);
    }
  });

  it('produces a distribution over the field', () => {
    const probs = calibrateWinProbabilities([72.1, 72.4, 73.0], 1.5);

    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    probs.forEach(p => expect(p).toBeGreaterThan(0));
  });

  it('spreads probability as the temperature rises', () => {
    // Temperature is the one fitted parameter: it sets how much a one-second
    // gap is worth, which is exactly what separates a 62/14 leg from a 34/29.
    const seconds = [72.0, 73.0, 74.0];

    const sharp = calibrateWinProbabilities(seconds, 0.5);
    const flat = calibrateWinProbabilities(seconds, 4.0);

    expect(sharp[0]).toBeGreaterThan(flat[0]);
    expect(sharp[2]).toBeLessThan(flat[2]);
  });
});

describe('allocateBudget', () => {
  it('buys coverage where it is cheapest in probability, not evenly', () => {
    // A 62/14 leg is near-settled: the second horse adds little for double the
    // rows. A 34/29 leg is genuinely open. With room for one extra horse it
    // belongs in the open leg - this is the whole point of the ticket layer.
    const settled = [0.62, 0.14, 0.09, 0.08, 0.07];
    const open = [0.34, 0.29, 0.17, 0.12, 0.08];

    expect(allocateBudget([settled, open], 2)).toEqual([1, 2]);
  });

  it('never exceeds the row budget', () => {
    const legs = Array.from({ length: 8 }, () => [0.3, 0.25, 0.2, 0.15, 0.1]);

    const n = allocateBudget(legs, 500);

    expect(n.reduce((a, b) => a * b, 1)).toBeLessThanOrEqual(500);
    n.forEach(v => expect(v).toBeGreaterThanOrEqual(1));
  });

  it('spends the budget rather than leaving it unused', () => {
    // 500 rows over 8 legs is roughly 2.17 horses each; leaving it at 1 would
    // waste the coupon.
    const legs = Array.from({ length: 8 }, () => [0.3, 0.25, 0.2, 0.15, 0.1]);

    const rows = allocateBudget(legs, 500).reduce((a, b) => a * b, 1);

    expect(rows).toBeGreaterThan(250);
  });

  it('respects a per-leg floor so a leg can be barred from being singled', () => {
    // Spiking is decided by the top pick's PRICE, not by the model's margin:
    // measured on 603 holdout legs, a pick at odds <= 2.0 holds 56.3% while the
    // model's own margin >= 3s holds 55.5% and occurs half as often. The floor
    // is how that rule reaches the allocator without touching the ranking.
    const settled = [0.62, 0.14, 0.09, 0.08, 0.07];
    const open = [0.34, 0.29, 0.17, 0.12, 0.08];

    const free = allocateBudget([settled, open], 4);
    const barred = allocateBudget([settled, open], 4, [2, 1]);

    expect(free[0]).toBe(1);
    expect(barred[0]).toBeGreaterThanOrEqual(2);
  });
});
