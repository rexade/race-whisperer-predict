// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { plackettLuceLogLik } from '../plackettLuce';

describe('plackettLuceLogLik', () => {
  it('returns 0 for fewer than 2 horses', () => {
    expect(plackettLuceLogLik([5], 5)).toBe(0);
    expect(plackettLuceLogLik([], 5)).toBe(0);
  });

  it('is higher (less negative) when predictions match the finish order', () => {
    // strengths sorted by actual finish: index 0 = winner
    const good = plackettLuceLogLik([3, 2, 1], 5);   // winner strongest
    const bad = plackettLuceLogLik([1, 2, 3], 5);    // winner weakest
    expect(good).toBeGreaterThan(bad);
  });

  it('equals -log(n!) contributions for uniform strengths', () => {
    // All equal strengths: P = 1/3 * 1/2 = 1/6 → logLik = -log(6)
    const ll = plackettLuceLogLik([1, 1, 1], 5);
    expect(ll).toBeCloseTo(-Math.log(6), 6);
  });

  it('truncates at topK — later positions do not affect the result', () => {
    const full = plackettLuceLogLik([5, 4, 3, 2, 1], 2);
    const perturbedTail = plackettLuceLogLik([5, 4, 1, 2, 3], 2);
    expect(full).toBeCloseTo(perturbedTail, 10);
  });

  it('is invariant to adding a constant to all strengths', () => {
    const a = plackettLuceLogLik([3, 2, 1], 5);
    const b = plackettLuceLogLik([13, 12, 11], 5);
    expect(a).toBeCloseTo(b, 8);
  });

  it('handles large strength values without overflow', () => {
    const ll = plackettLuceLogLik([1000, 999, 998], 5);
    expect(Number.isFinite(ll)).toBe(true);
  });
});
