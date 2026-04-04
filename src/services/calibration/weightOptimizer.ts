/**
 * Weight Optimizer — Coordinate Descent
 *
 * Minimizes rank MAE over the NormalizationWeights parameter space using
 * coordinate descent with exponential step decay.
 *
 * How it works:
 *   1. Start from `initialWeights` and compute baseline MAE.
 *   2. For each weight dimension, try ±step. Keep the direction that lowers MAE.
 *   3. If no improvement across all dimensions, halve the step size.
 *   4. Stop when step < MIN_STEP or maxPasses exhausted.
 *
 * The inner `evaluate` call uses Phase-2 logic (no API calls, pure math) so
 * each pass over 13 weights × 2 directions = 26 evaluations is fast.
 */

import { NormalizationWeights } from '@/services/modernKm/types';
import { CalibrationDataset, CalibrationEvaluation, evaluateWeights } from './historicalCalibrationService';

export interface OptimizationProgress {
  pass: number;
  maxPasses: number;
  currentMAE: number;
  bestMAE: number;
  step: number;
  message: string;
}

export interface OptimizationResult {
  optimizedWeights: NormalizationWeights;
  initialMAE: number;
  finalMAE: number;
  improvementPct: number;
  passesCompleted: number;
  initialEvaluation: CalibrationEvaluation;
  finalEvaluation: CalibrationEvaluation;
}

const MIN_STEP = 0.02;
const MAX_PASSES = 12;
const WEIGHT_BOUNDS: [number, number] = [0.0, 3.0];

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition',
  'shoeType',
  'sulkyType',
  'driverPerformance',
  'trackFamiliarity',
  'form',
  'distanceAdjustment',
  'raceDistanceAdjustment',
  'volteStartDistancePenalty',
  'startPoints',
  'placePercentage',
  'horseWinPercentage',
  'earningsPerStart',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function copyWeights(w: NormalizationWeights): NormalizationWeights {
  return { ...w };
}

/**
 * Optimize weights via coordinate descent.
 *
 * @param dataset   Pre-collected calibration data (no API calls during optimization)
 * @param initial   Starting weight configuration
 * @param onProgress  Optional progress callback
 */
export async function optimizeWeights(
  dataset: CalibrationDataset,
  initial: NormalizationWeights,
  onProgress?: (p: OptimizationProgress) => void
): Promise<OptimizationResult> {
  const initialEval = await evaluateWeights(dataset, initial);
  const initialMAE = initialEval.rankMAE;

  let best = copyWeights(initial);
  let bestMAE = initialMAE;
  let step = 0.1;
  let pass = 0;

  while (step >= MIN_STEP && pass < MAX_PASSES) {
    pass++;
    let improved = false;

    for (const key of WEIGHT_KEYS) {
      for (const dir of [+step, -step]) {
        const candidate = copyWeights(best);
        candidate[key] = clamp(best[key] + dir, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);

        // Skip if value didn't actually change (already at bound)
        if (candidate[key] === best[key]) continue;

        const eval_ = await evaluateWeights(dataset, candidate);
        if (eval_.rankMAE < bestMAE) {
          bestMAE = eval_.rankMAE;
          best = candidate;
          improved = true;
          break; // Take the first improvement for this dimension and move on
        }
      }

      onProgress?.({
        pass,
        maxPasses: MAX_PASSES,
        currentMAE: bestMAE,
        bestMAE,
        step,
        message: `Pass ${pass}/${MAX_PASSES} | step=${step.toFixed(3)} | rank MAE=${bestMAE.toFixed(4)}`,
      });
    }

    if (!improved) {
      step /= 2;
    }
  }

  const finalEval = await evaluateWeights(dataset, best);
  const improvementPct =
    initialMAE > 0 ? ((initialMAE - finalEval.rankMAE) / initialMAE) * 100 : 0;

  return {
    optimizedWeights: best,
    initialMAE,
    finalMAE: finalEval.rankMAE,
    improvementPct,
    passesCompleted: pass,
    initialEvaluation: initialEval,
    finalEvaluation: finalEval,
  };
}
