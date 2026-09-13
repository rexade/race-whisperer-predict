import { describe, expect, it } from 'vitest';
import { binaryLogit } from '../binaryLogit';

describe('binaryLogit', () => {
  it('recovers the analytic MLE and standard error', () => {
    // One binary covariate reduces to comparing two rates, so the maximum is
    // exact: beta = logit(p1) - logit(p0), se = sqrt(1/(n0 p0 q0) + 1/(n1 p1 q1)).
    // Group x=0 wins 25 of 100, group x=1 wins 50 of 100.
    const rows = [
      ...Array.from({ length: 25 }, () => ({ x: [0], y: 1 })),
      ...Array.from({ length: 75 }, () => ({ x: [0], y: 0 })),
      ...Array.from({ length: 50 }, () => ({ x: [1], y: 1 })),
      ...Array.from({ length: 50 }, () => ({ x: [1], y: 0 })),
    ];

    const fit = binaryLogit(rows);

    expect(fit.coefficients[0]).toBeCloseTo(Math.log(1 / 3), 6);   // intercept
    expect(fit.coefficients[1]).toBeCloseTo(Math.log(3), 6);        // slope
    expect(fit.standardErrors[1]).toBeCloseTo(
      Math.sqrt(1 / (100 * 0.25 * 0.75) + 1 / (100 * 0.5 * 0.5)), 6);
  });

  it('reports a covariate that carries no information as insignificant', () => {
    // The result that matters: a feature which does not separate outcomes must
    // come back indistinguishable from zero, or every null is unreadable.
    const rows = Array.from({ length: 400 }, (_, i) => ({ x: [i % 7], y: i % 2 }));

    const fit = binaryLogit(rows);

    expect(Math.abs(fit.z[1])).toBeLessThan(2);
  });
});
