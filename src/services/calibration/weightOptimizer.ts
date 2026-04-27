/**
 * Weight Optimizer — Simulated Annealing + Coordinate Descent
 *
 * Phase 0 (SA): Simulated annealing for global exploration — escapes local optima
 *   by accepting uphill moves with probability exp(−Δ/T) where T cools over time.
 * Phase A: Coordinate descent on all NormalizationWeights (refine SA result).
 * Phase B: Coordinate descent on per-position curve values for auto and volte starts
 *   (30 additional dimensions). Always runs — defaults to standard curves.
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
  /** Evaluation on the held-out test set — never seen during optimization.
   *  This is the honest win% number. Only present when testDataset was supplied. */
  testEvaluation?: CalibrationEvaluation;
}

const MIN_WEIGHT_STEP = 0.02;
const MAX_PASSES = 20;
const WEIGHT_BOUNDS: [number, number] = [0.0, 5.0];  // capped to prevent overfitting

// Simulated annealing constants
const SA_STEPS = 400;        // exploration steps before handing off to CD
const SA_T_START = 0.05;     // initial temperature in MRR units (~0.05 MRR degradation allowed)
const SA_T_END   = 0.003;    // final temperature (essentially greedy)

const MIN_CURVE_STEP = 0.01;
const CURVE_BOUNDS: [number, number] = [-1.5, 1.5];

// L2 regularization — penalizes extreme weights to prevent overfitting.
// λ is tuned so a weight of ~3.0 is "comfortable" and anything above ~5.0
// gets a noticeable penalty.  At λ=0.0008, a weight of 6.0 adds 0.029 to
// the negative score (equivalent to ~0.03 MRR loss).
const L2_LAMBDA = 0.0008;

/** L2 penalty: λ × Σ(w²) over all weight keys. */
function l2Penalty(w: NormalizationWeights): number {
  let sum = 0;
  for (const key of WEIGHT_KEYS) sum += (w[key] ?? 0) ** 2;
  return L2_LAMBDA * sum;
}

/** Regularized score: lower is better (negative MRR + L2 penalty). */
async function regScore(
  dataset: CalibrationDataset,
  weights: NormalizationWeights,
  curves: PostPositionCurves
): Promise<number> {
  const eval_ = await evaluateWeights(dataset, weights, curves);
  return -eval_.winnerMRR + l2Penalty(weights);
}

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition',
  'shoeType',
  'sulkyType',
  'driverPerformance',
  'driverForm',
  'driverEmpirical',
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
const SA_COOLING = Math.pow(SA_T_END / SA_T_START, 1 / SA_STEPS);

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
 * Phase 0: Simulated annealing — global search over the weight space.
 *
 * Accepts uphill moves with probability exp(−Δ/T) so the search can escape
 * the local optima that plain coordinate descent converges to.  Temperature
 * cools geometrically from SA_T_START to SA_T_END over SA_STEPS iterations.
 *
 * Returns the best weights found during the SA walk (not the final position).
 */
async function runSAPhase(
  dataset: CalibrationDataset,
  initial: NormalizationWeights,
  curves: PostPositionCurves,
  onProgress?: (p: OptimizationProgress) => void
): Promise<{ weights: NormalizationWeights; score: number }> {
  let curr = copyWeights(initial);
  let currScore = await regScore(dataset, curr, curves);
  let best = copyWeights(curr);
  let bestScore = currScore;
  let T = SA_T_START;

  for (let s = 0; s < SA_STEPS; s++) {
    T *= SA_COOLING;

    // Random weight key + random signed step (wider early, shrinks with T)
    const key = WEIGHT_KEYS[Math.floor(Math.random() * WEIGHT_KEYS.length)];
    const stepSize = SA_T_START * 16 * (0.1 + Math.random()); // 0.08–1.44 early, shrinks as T drops
    const delta = (Math.random() < 0.5 ? 1 : -1) * stepSize;
    const candidate = copyWeights(curr);
    candidate[key] = clamp((curr[key] ?? 0) + delta, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);

    if (Math.abs(candidate[key] - (curr[key] ?? 0)) < 0.001) continue;

    const score = await regScore(dataset, candidate, curves);
    const diff = score - currScore; // positive = worse

    // Accept if better, or probabilistically if worse
    if (diff < 0 || Math.random() < Math.exp(-diff / T)) {
      curr = candidate;
      currScore = score;
      if (currScore < bestScore) {
        bestScore = currScore;
        best = copyWeights(curr);
      }
    }

    if (s % 50 === 0) {
      onProgress?.({
        pass: s,
        maxPasses: SA_STEPS + MAX_PASSES,
        currentMAE: bestScore,
        bestMAE: bestScore,
        step: T,
        message: `SA ${s}/${SA_STEPS} · T=${T.toFixed(4)} · MRR=${(-bestScore).toFixed(4)}`,
      });
    }
  }

  return { weights: best, score: bestScore };
}

/**
 * Optimize weights (and optionally per-position curves) via SA + coordinate descent.
 *
 * Phase 0: Simulated annealing explores the weight space broadly (escapes local optima).
 * Phase A: Coordinate descent on NormalizationWeights (refines the SA result).
 * Phase B: Coordinate descent on per-position curves.
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
  initialCurves?: PostPositionCurves,
  /** Held-out test set — never touched during optimization.
   *  When provided, the final weights are evaluated on it and stored as testEvaluation. */
  testDataset?: CalibrationDataset
): Promise<OptimizationResult> {
  // Always optimize curves — use provided curves or fall back to the standard defaults.
  const startCurves: PostPositionCurves = initialCurves
    ? copyCurves(initialCurves)
    : { auto: { ...DEFAULT_AUTO_CURVE }, volte: { ...DEFAULT_VOLTE_CURVE } };

  const initialEval = await evaluateWeights(dataset, initial, startCurves);
  // Optimise for Mean Reciprocal Rank + L2 regularization penalty.
  // MRR = mean(1/rank_given_to_winner). Range 0–1, higher is better.
  // L2 penalty discourages extreme weights to prevent overfitting.
  // Score = -MRR + λΣw² (lower is better).
  const initialMAE = await regScore(dataset, initial, startCurves);

  // Phase 0: Simulated annealing — explore broadly before refining
  onProgress?.({
    pass: 0, maxPasses: SA_STEPS + MAX_PASSES, currentMAE: initialMAE,
    bestMAE: initialMAE, step: SA_T_START,
    message: `SA phase: exploring weight space (${SA_STEPS} steps)…`,
  });
  const saResult = await runSAPhase(dataset, copyWeights(initial), startCurves, onProgress);

  // Start coordinate descent from the best SA solution (or initial if SA didn't improve)
  let bestWeights = saResult.score < initialMAE ? saResult.weights : copyWeights(initial);
  let bestCurves = startCurves;
  let bestMAE = Math.min(saResult.score, initialMAE);

  let weightStep = 0.2;
  let curveStep = 0.05;
  let pass = 0;

  // Run until both weight and curve steps have converged (or MAX_PASSES)
  while (pass < MAX_PASSES && (weightStep >= MIN_WEIGHT_STEP || curveStep >= MIN_CURVE_STEP)) {
    pass++;
    let improved = false;

    // --- Phase A: optimize the 21 NormalizationWeights ---
    if (weightStep >= MIN_WEIGHT_STEP) {
      for (const key of WEIGHT_KEYS) {
        for (const dir of [+weightStep, -weightStep]) {
          const candidate = copyWeights(bestWeights);
          candidate[key] = clamp(bestWeights[key] + dir, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);
          if (candidate[key] === bestWeights[key]) continue;

          const score = await regScore(dataset, candidate, bestCurves);
          if (score < bestMAE) {
            bestMAE = score;
            bestWeights = candidate;
            improved = true;
            break;
          }
        }

        onProgress?.({
          pass: SA_STEPS + pass,
          maxPasses: SA_STEPS + MAX_PASSES,
          currentMAE: bestMAE,
          bestMAE,
          step: weightStep,
          message: `CD pass ${pass}/${MAX_PASSES} · weights · step=${weightStep.toFixed(3)} · MRR=${(-bestMAE).toFixed(4)}`,
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

            const score = await regScore(dataset, bestWeights, candidate);
            if (score < bestMAE) {
              bestMAE = score;
              bestCurves = candidate;
              improved = true;
              break;
            }
          }

          onProgress?.({
            pass: SA_STEPS + pass,
            maxPasses: SA_STEPS + MAX_PASSES,
            currentMAE: bestMAE,
            bestMAE,
            step: curveStep,
            message: `CD pass ${pass}/${MAX_PASSES} · curves (${startType} pos ${pos}) · step=${curveStep.toFixed(3)} · MRR=${(-bestMAE).toFixed(4)}`,
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

  // Evaluate on held-out test set if provided — this is the honest out-of-sample number
  const testEvaluation = testDataset && testDataset.length > 0
    ? await evaluateWeights(testDataset, bestWeights, bestCurves)
    : undefined;

  return {
    optimizedWeights: bestWeights,
    optimizedCurves: bestCurves,
    initialMAE: initialMRR,   // expose as positive MRR for display
    finalMAE: finalMRR,
    improvementPct,
    passesCompleted: pass,
    initialEvaluation: initialEval,
    finalEvaluation: finalEval,
    testEvaluation,
  };
}
