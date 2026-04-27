/**
 * Weight Optimizer — Coordinate Descent
 *
 * Phase A: Optimize all NormalizationWeights.
 * Phase B: Optimize per-position curve values for auto and volte starts
 *   (30 additional dimensions). Always runs — defaults to the standard
 *   curves when the caller provides none.
 * The two phases alternate until convergence.
 */

import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { DEFAULT_AUTO_CURVE, DEFAULT_VOLTE_CURVE } from '@/services/modernKm/postPositionCalculator';
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
  /** Always present — per-position curve values tuned by calibration. */
  optimizedCurves: PostPositionCurves;
  initialMAE: number;
  finalMAE: number;
  improvementPct: number;
  passesCompleted: number;
  initialEvaluation: CalibrationEvaluation;
  finalEvaluation: CalibrationEvaluation;
}

const MIN_WEIGHT_STEP = 0.02;
const MAX_PASSES = 14;
const WEIGHT_BOUNDS: [number, number] = [0.0, 3.0];

const MIN_CURVE_STEP = 0.01;
const CURVE_BOUNDS: [number, number] = [-1.5, 1.5];

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition',
  'shoeType',
  'sulkyType',
  'driverPerformance',
  'driverForm',
  'trackFamiliarity',
  'form',
  'distanceAdjustment',
  'raceDistanceAdjustment',
  'volteStartDistancePenalty',
  'startPoints',
  'placePercentage',
  'horseWinPercentage',
  'earningsPerStart',
  'gallopRisk',
  'layoffPenalty',
  'ageFactor',
  'genderAdjustment',
  'consistencyFactor',
  'trainerPerformance',
];

const CURVE_POSITIONS = Array.from({ length: 15 }, (_, i) => i + 1);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function copyWeights(w: NormalizationWeights): NormalizationWeights {
  return { ...w };
}

function copyCurves(c: PostPositionCurves): PostPositionCurves {
  return { auto: { ...c.auto }, volte: { ...c.volte } };
}

/**
 * Optimize weights (and optionally per-position curves) via coordinate descent.
 *
 * @param dataset        Pre-collected calibration data (no API calls)
 * @param initial        Starting weight configuration
 * @param onProgress     Optional progress callback
 * @param initialCurves  Starting post-position curves — if provided, curves are
 *                       optimized alongside weights
 */
export async function optimizeWeights(
  dataset: CalibrationDataset,
  initial: NormalizationWeights,
  onProgress?: (p: OptimizationProgress) => void,
  initialCurves?: PostPositionCurves
): Promise<OptimizationResult> {
  // Always optimize curves — use provided curves or fall back to the standard defaults.
  const startCurves: PostPositionCurves = initialCurves
    ? copyCurves(initialCurves)
    : { auto: { ...DEFAULT_AUTO_CURVE }, volte: { ...DEFAULT_VOLTE_CURVE } };

  const initialEval = await evaluateWeights(dataset, initial, startCurves);
  // Optimise for Mean Reciprocal Rank of the actual winner.
  // MRR = mean(1/rank_given_to_winner). Range 0–1, higher is better.
  // Rank 1 → 1.0, rank 2 → 0.5, rank 3 → 0.33 …
  // The jump from rank 2→1 (+0.5) is 10× larger than rank 5→4 (+0.05),
  // so coordinate descent is strongly pulled toward getting winners to #1.
  // Store as negative so existing "lower is better" comparisons still work.
  const initialMAE = -initialEval.winnerMRR;

  let bestWeights = copyWeights(initial);
  let bestCurves = startCurves;
  let bestMAE = initialMAE;

  let weightStep = 0.1;
  let curveStep = 0.05;
  let pass = 0;

  // Run until both weight and curve steps have converged (or MAX_PASSES)
  while (pass < MAX_PASSES && (weightStep >= MIN_WEIGHT_STEP || curveStep >= MIN_CURVE_STEP)) {
    pass++;
    let improved = false;

    // --- Phase A: optimize the 13 NormalizationWeights ---
    if (weightStep >= MIN_WEIGHT_STEP) {
      for (const key of WEIGHT_KEYS) {
        for (const dir of [+weightStep, -weightStep]) {
          const candidate = copyWeights(bestWeights);
          candidate[key] = clamp(bestWeights[key] + dir, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);
          if (candidate[key] === bestWeights[key]) continue;

          const eval_ = await evaluateWeights(dataset, candidate, bestCurves);
          if (-eval_.winnerMRR < bestMAE) {
            bestMAE = -eval_.winnerMRR;
            bestWeights = candidate;
            improved = true;
            break;
          }
        }

        onProgress?.({
          pass,
          maxPasses: MAX_PASSES,
          currentMAE: bestMAE,
          bestMAE,
          step: weightStep,
          message: `Pass ${pass}/${MAX_PASSES} · weights · step=${weightStep.toFixed(3)} · MRR=${(-bestMAE).toFixed(4)}`,
        });
      }
    }

    // --- Phase B: optimize per-position curve values (always runs) ---
    if (curveStep >= MIN_CURVE_STEP) {
      for (const startType of ['auto', 'volte'] as const) {
        for (const pos of CURVE_POSITIONS) {
          const current = bestCurves[startType][pos] ?? 0;
          for (const dir of [+curveStep, -curveStep]) {
            const candidate = copyCurves(bestCurves);
            const newVal = clamp(current + dir, CURVE_BOUNDS[0], CURVE_BOUNDS[1]);
            if (Math.abs(newVal - current) < 0.001) continue;
            candidate[startType][pos] = newVal;

            const eval_ = await evaluateWeights(dataset, bestWeights, candidate);
            if (-eval_.winnerMRR < bestMAE) {
              bestMAE = -eval_.winnerMRR;
              bestCurves = candidate;
              improved = true;
              break;
            }
          }

          onProgress?.({
            pass,
            maxPasses: MAX_PASSES,
            currentMAE: bestMAE,
            bestMAE,
            step: curveStep,
            message: `Pass ${pass}/${MAX_PASSES} · curves (${startType} pos ${pos}) · step=${curveStep.toFixed(3)} · MRR=${(-bestMAE).toFixed(4)}`,
          });
        }
      }
    }

    if (!improved) {
      weightStep /= 2;
      curveStep /= 2;
    }
  }

  const finalEval = await evaluateWeights(dataset, bestWeights, bestCurves);
  // improvementPct: positive = better MRR (higher win rate)
  const initialMRR = -initialMAE;
  const finalMRR = finalEval.winnerMRR;
  const improvementPct = initialMRR > 0 ? ((finalMRR - initialMRR) / initialMRR) * 100 : 0;

  return {
    optimizedWeights: bestWeights,
    optimizedCurves: bestCurves,
    initialMAE: initialMRR,   // expose as positive MRR for display
    finalMAE: finalMRR,
    improvementPct,
    passesCompleted: pass,
    initialEvaluation: initialEval,
    finalEvaluation: finalEval,
  };
}
