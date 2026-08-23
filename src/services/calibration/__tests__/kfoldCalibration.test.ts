// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const optimizeSpy = vi.fn();
const evaluateSpy = vi.fn();
const computeRatingsSpy = vi.fn((_dataset?: unknown) => new Map<string, number>());
const saveRatingsSpy = vi.fn();

vi.mock('../weightOptimizer', () => ({
  optimizeWeights: (...a: unknown[]) => optimizeSpy(...a),
}));
vi.mock('../historicalCalibrationService', () => ({
  evaluateWeights: (...a: unknown[]) => evaluateSpy(...a),
}));
vi.mock('../driverRatingService', () => ({
  computeDriverRatings: (...a: unknown[]) => computeRatingsSpy(...(a as [])),
  saveDriverRatings: (...a: unknown[]) => saveRatingsSpy(...a),
}));

import { runKFoldCalibration } from '../kfoldCalibration';
import type { CalibrationDataset } from '../historicalCalibrationService';

const ds = (n: number, prefix = 'T'): CalibrationDataset =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    races: [{ id: `${prefix}${i}` }],
  })) as unknown as CalibrationDataset;

const w = (v: number) => ({ postPosition: v }) as never;

beforeEach(() => {
  optimizeSpy.mockReset();
  evaluateSpy.mockReset();
  saveRatingsSpy.mockReset();
  computeRatingsSpy.mockClear();
  optimizeSpy.mockImplementation(async (_d, weights) => ({
    optimizedWeights: weights, optimizedCurves: undefined,
  }));
});

describe('runKFoldCalibration', () => {
  it('ranks starts by out-of-fold score, not by how well they fit', async () => {
    // "Overfitter" wins on training but loses out-of-fold; "Generaliser" is the reverse.
    evaluateSpy.mockImplementation(async (_dataset: unknown, weights: any) =>
      ({ winnerMRR: weights.postPosition === 1 ? 0.1 : 0.9, winAccuracy: 0.4 }));

    const result = await runKFoldCalibration(
      ds(8), [], [
        { name: 'Overfitter', weights: w(1) },
        { name: 'Generaliser', weights: w(2) },
      ], [], { k: 2 }
    );

    expect(result.winnerName).toBe('Generaliser');
    expect(result.rankings[0].meanOofMRR).toBeGreaterThan(result.rankings[1].meanOofMRR);
  });

  it('derives driver ratings from each fold\'s training half, never the fold under test', async () => {
    evaluateSpy.mockResolvedValue({ winnerMRR: 0.5, winAccuracy: 0.4 });
    await runKFoldCalibration(ds(8), [], [{ name: 'A', weights: w(1) }], [], { k: 2 });

    // Every priming call must be a strict subset of the training window — never a
    // whole dataset that includes the fold being scored.
    const primedSizes = computeRatingsSpy.mock.calls.map(c => (c[0] as unknown as unknown[]).length);
    expect(primedSizes.length).toBeGreaterThan(0);
    for (const size of primedSizes.slice(0, -1)) expect(size).toBeLessThan(8);
  });

  it('never evaluates the holdout until after the refit', async () => {
    const order: string[] = [];
    evaluateSpy.mockImplementation(async (dataset: any) => {
      order.push((dataset as unknown[]).length === 3 ? 'holdout' : 'fold');
      return { winnerMRR: 0.5, winAccuracy: 0.4 };
    });
    optimizeSpy.mockImplementation(async (_d, weights) => {
      order.push('optimize');
      return { optimizedWeights: weights, optimizedCurves: undefined };
    });

    await runKFoldCalibration(ds(8), ds(3, 'H'), [{ name: 'A', weights: w(1) }], [], { k: 2 });

    expect(order.lastIndexOf('optimize')).toBeLessThan(order.indexOf('holdout'));
  });

  it('reports when the refit fails to beat the supplied baseline', async () => {
    evaluateSpy.mockImplementation(async (_d, weights: any) =>
      ({ winnerMRR: weights.postPosition === 9 ? 0.9 : 0.2, winAccuracy: 0.4 }));

    const result = await runKFoldCalibration(
      ds(8), ds(3, 'H'), [{ name: 'A', weights: w(1) }],
      [{ name: 'Production', weights: w(9) }], { k: 2 }
    );
    expect(result.refitBeatsBaseline).toBe(false);
  });

  it('gives the refit a larger budget than the fold searches', async () => {
    evaluateSpy.mockResolvedValue({ winnerMRR: 0.5, winAccuracy: 0.4 });
    await runKFoldCalibration(ds(8), [], [{ name: 'A', weights: w(1) }], [], { k: 2, saSteps: 300 });

    const budgets = optimizeSpy.mock.calls.map(c => (c[5] as { saSteps: number }).saSteps);
    expect(budgets[budgets.length - 1]).toBe(600);
    expect(budgets.slice(0, -1).every(b => b === 300)).toBe(true);
  });

  it('refuses k-fold when there are fewer dates than folds', async () => {
    await expect(
      runKFoldCalibration(ds(3), [], [{ name: 'A', weights: w(1) }], [], { k: 4 })
    ).rejects.toThrow(/at least 4 training dates/);
  });
});
