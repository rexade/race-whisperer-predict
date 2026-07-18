import { describe, it, expect, vi } from 'vitest';
import { optimizeWeights } from '../weightOptimizer';
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
});
