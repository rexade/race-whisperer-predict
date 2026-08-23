import { describe, it, expect, vi } from 'vitest';
import { optimizeWeights, saStepSize } from '../weightOptimizer';
import { evaluateWeights } from '../historicalCalibrationService';
import { NormalizationWeights } from '@/services/modernKm/types';

vi.mock('../historicalCalibrationService', () => ({
  evaluateWeights: vi.fn(async () => ({
    winnerMRR: 0.5,
    plLogLik: -1,
    raceCount: 1,
    winnerHitRate: 0.5,
    top3HitRate: 0.5,
    meanRankError: 1,
  })),
}));

// Weights saved before driverForm/trainerPerformance/oddsLive/betDistribution
// existed lack those keys entirely — the optimizer must not turn them into NaN.
const LEGACY_WEIGHTS: NormalizationWeights = {
  postPosition: 1,
  shoeType: 1,
  sulkyType: 1,
  driverPerformance: 1,
  trackFamiliarity: 1,
  form: 1,
  distanceAdjustment: 1,
  raceDistanceAdjustment: 1,
  volteStartDistancePenalty: 1,
  startPoints: 1,
  placePercentage: 1,
  horseWinPercentage: 1,
  earningsPerStart: 1,
  gallopRisk: 1,
  layoffPenalty: 1,
  ageFactor: 1,
  genderAdjustment: 1,
  consistencyFactor: 1,
};

function nanKeys(w: NormalizationWeights): string[] {
  return Object.entries(w)
    .filter(([, v]) => typeof v === 'number' && Number.isNaN(v))
    .map(([k]) => k);
}

describe('optimizeWeights with legacy weights missing optional keys', () => {
  it('never evaluates a candidate containing NaN', async () => {
    await optimizeWeights(
      {} as any,
      LEGACY_WEIGHTS,
      undefined,
      undefined,
      undefined,
      { saSteps: 0, maxPasses: 1, optimizeCurves: false },
    );

    const evaluated = vi.mocked(evaluateWeights).mock.calls.map(([, w]) => w);
    expect(evaluated.length).toBeGreaterThan(0);
    for (const w of evaluated) {
      expect(nanKeys(w)).toEqual([]);
    }
  });

  it('reports improvement from the unregularized MRR shown to the user', async () => {
    const result = await optimizeWeights(
      {} as any,
      LEGACY_WEIGHTS,
      undefined,
      undefined,
      undefined,
      { saSteps: 0, maxPasses: 0, optimizeCurves: false },
    );

    expect(result.initialMAE).toBe(0.5);
    expect(result.finalMAE).toBe(0.5);
    expect(result.improvementPct).toBe(0);
  });
});

describe('saStepSize', () => {
  it('narrows as the temperature falls', () => {
    // Same random draw, colder temperature -> strictly smaller proposal. A fixed width
    // would leave the tail of the anneal proposing jumps the cooling test rejects.
    expect(saStepSize(0.003, 0.5)).toBeLessThan(saStepSize(0.05, 0.5));
  });

  it('scales linearly with temperature', () => {
    expect(saStepSize(0.05, 0.5)).toBeCloseTo(saStepSize(0.025, 0.5) * 2, 10);
  });
});

describe('optimizeWeights progress reporting', () => {
  it('reports the true MRR, not the L2-penalised score', async () => {
    const messages: string[] = [];
    await optimizeWeights(
      {} as any,
      LEGACY_WEIGHTS,
      p => messages.push(p.message),
      undefined,
      undefined,
      { saSteps: 50, maxPasses: 1, optimizeCurves: false, seed: 1 }
    );
    // Mocked evaluateWeights pins winnerMRR at 0.5; the penalty on these weights is
    // ~0.0144, which the old label silently subtracted.
    const mrrLines = messages.filter(m => m.includes('MRR='));
    expect(mrrLines.length).toBeGreaterThan(0);
    for (const line of mrrLines) expect(line).toContain('MRR=0.5000');
  });

  it('sizes the progress denominator from the actual pass budget', async () => {
    const seen: number[] = [];
    await optimizeWeights(
      {} as any,
      LEGACY_WEIGHTS,
      p => seen.push(p.maxPasses),
      undefined,
      undefined,
      { saSteps: 100, maxPasses: 5, optimizeCurves: false, seed: 1 }
    );
    // 100 SA steps + 5 descent passes. Reading MAX_PASSES here instead made the bar
    // jump when a caller narrowed the budget.
    expect(new Set(seen)).toEqual(new Set([105]));
  });
});
