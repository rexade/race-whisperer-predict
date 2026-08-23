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
  /** Initial winner MRR. Legacy property name retained for UI compatibility. */
  initialMAE: number;
  /** Final winner MRR. Legacy property name retained for UI compatibility. */
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
const WEIGHT_BOUNDS: [number, number] = [0.0, 7.0];  // raised from 5.0 but not too wide

// Simulated annealing constants
const SA_STEPS = 600;        // more exploration for wider bounds
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

export type OptimizeObjective = 'mrr' | 'pl';

// Scale mean per-race PL log-lik into the same delta range as MRR so the SA
// temperature schedule and L2 penalty stay comparable across objectives.
const PL_SCALE = 0.2;

interface Scored {
  /** Regularized objective: lower is better (negative fit + L2 penalty). */
  score: number;
  /** Plain winner MRR, unpenalized. Reported to the user regardless of objective —
   *  the score is an internal quantity and reads ~0.03-0.05 lower than the real MRR. */
  mrr: number;
}

/** Regularized score (lower is better) plus the raw MRR behind it. */
async function regScore(
  dataset: CalibrationDataset,
  weights: NormalizationWeights,
  curves: PostPositionCurves,
  objective: OptimizeObjective = 'mrr'
): Promise<Scored> {
  const eval_ = await evaluateWeights(dataset, weights, curves);
  const fit = objective === 'pl' ? eval_.plLogLik * PL_SCALE : eval_.winnerMRR;
  return { score: -fit + l2Penalty(weights), mrr: eval_.winnerMRR };
}

/**
 * Simulated-annealing proposal width, scaled by the current temperature so late moves
 * are fine-grained. A fixed width would leave the tail of the anneal proposing coarse
 * jumps that the cooling acceptance test almost always rejects — the schedule would
 * run but do nothing.
 */
export function saStepSize(temperature: number, unitRandom: number): number {
  return temperature * 16 * (0.1 + unitRandom);
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
  'oddsHistorical',
  'oddsLive',
  'betDistribution',
  'shoeChange',
];

const CURVE_POSITIONS = Array.from({ length: 15 }, (_, i) => i + 1);

/** Budget/behavior knobs — defaults reproduce the historical browser behavior. */
export interface OptimizeOptions {
  /** Simulated-annealing steps (0 skips the SA phase entirely). Default 600. */
  saSteps?: number;
  /** Max coordinate-descent passes. Default 20. */
  maxPasses?: number;
  /** Tune per-position curves (Phase B). Default true. */
  optimizeCurves?: boolean;
  /** Seed for the SA random walk — same seed + same inputs = same result.
   *  Default undefined: unseeded Math.random (historical behavior). */
  seed?: number;
  /** Fit target: 'mrr' (winner MRR, historical default) or 'pl'
   *  (Plackett–Luce top-5 finish-order likelihood — uses every placing). */
  objective?: OptimizeObjective;
}

/** Deterministic LCG in [0,1) — for reproducible SA runs. */
function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function copyWeights(w: NormalizationWeights): NormalizationWeights {
  return { ...w };
}

function copyCurves(c: PostPositionCurves): PostPositionCurves {
  const copy: PostPositionCurves = { auto: { ...c.auto }, volte: { ...c.volte } };
  if (c.byDistance) {
    copy.byDistance = {
      auto: {
        short: { ...c.byDistance.auto.short },
        medium: { ...c.byDistance.auto.medium },
        long: { ...c.byDistance.auto.long },
      },
      volte: {
        short: { ...c.byDistance.volte.short },
        medium: { ...c.byDistance.volte.medium },
        long: { ...c.byDistance.volte.long },
      },
    };
  }
  return copy;
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
  onProgress?: (p: OptimizationProgress) => void,
  saSteps: number = SA_STEPS,
  rng: () => number = Math.random,
  objective: OptimizeObjective = 'mrr',
  maxPasses: number = MAX_PASSES
): Promise<{ weights: NormalizationWeights; score: number; mrr: number }> {
  let curr = copyWeights(initial);
  const currScored = await regScore(dataset, curr, curves, objective);
  let currScore = currScored.score;
  let best = copyWeights(curr);
  let bestScore = currScore;
  let bestMrr = currScored.mrr;
  let T = SA_T_START;
  const cooling = Math.pow(SA_T_END / SA_T_START, 1 / Math.max(saSteps, 1));

  for (let s = 0; s < saSteps; s++) {
    T *= cooling;

    // Random weight key + random signed step, narrowing as the temperature falls.
    const key = WEIGHT_KEYS[Math.floor(rng() * WEIGHT_KEYS.length)];
    const stepSize = saStepSize(T, rng());
    const delta = (rng() < 0.5 ? 1 : -1) * stepSize;
    const candidate = copyWeights(curr);
    candidate[key] = clamp((curr[key] ?? 0) + delta, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);

    if (Math.abs(candidate[key] - (curr[key] ?? 0)) < 0.001) continue;

    const scored = await regScore(dataset, candidate, curves, objective);
    const diff = scored.score - currScore; // positive = worse

    // Accept if better, or probabilistically if worse
    if (diff < 0 || rng() < Math.exp(-diff / T)) {
      curr = candidate;
      currScore = scored.score;
      if (currScore < bestScore) {
        bestScore = currScore;
        bestMrr = scored.mrr;
        best = copyWeights(curr);
      }
    }

    if (s % 50 === 0) {
      onProgress?.({
        pass: s,
        maxPasses: saSteps + maxPasses,
        currentMAE: bestScore,
        bestMAE: bestScore,
        step: T,
        message: `SA ${s}/${saSteps} · T=${T.toFixed(4)} · MRR=${bestMrr.toFixed(4)}`,
      });
    }
  }

  return { weights: best, score: bestScore, mrr: bestMrr };
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
  testDataset?: CalibrationDataset,
  /** Budget/behavior knobs — see OptimizeOptions. Defaults match browser behavior. */
  opts: OptimizeOptions = {}
): Promise<OptimizationResult> {
  const saSteps = opts.saSteps ?? SA_STEPS;
  const maxPasses = opts.maxPasses ?? MAX_PASSES;
  const optimizeCurves = opts.optimizeCurves ?? true;
  const objective = opts.objective ?? 'mrr';
  // Always optimize curves — use provided curves or fall back to the standard defaults.
  const startCurves: PostPositionCurves = initialCurves
    ? copyCurves(initialCurves)
    : { auto: { ...DEFAULT_AUTO_CURVE }, volte: { ...DEFAULT_VOLTE_CURVE } };

  const initialEval = await evaluateWeights(dataset, initial, startCurves);
  // Optimise for Mean Reciprocal Rank + L2 regularization penalty.
  // MRR = mean(1/rank_given_to_winner). Range 0–1, higher is better.
  // L2 penalty discourages extreme weights to prevent overfitting.
  // Score = -MRR + λΣw² (lower is better).
  const initialScored = await regScore(dataset, initial, startCurves, objective);
  const initialScore = initialScored.score;

  // Phase 0: Simulated annealing — explore broadly before refining (skipped when saSteps=0)
  let bestWeights = copyWeights(initial);
  let bestCurves = startCurves;
  let bestMAE = initialScore;
  let bestMrr = initialScored.mrr;

  if (saSteps > 0) {
    onProgress?.({
      pass: 0, maxPasses: saSteps + maxPasses, currentMAE: initialScore,
      bestMAE: initialScore, step: SA_T_START,
      message: `SA phase: exploring weight space (${saSteps} steps)…`,
    });
    const rng = opts.seed !== undefined ? makeSeededRng(opts.seed) : Math.random;
    const saResult = await runSAPhase(
      dataset, copyWeights(initial), startCurves, onProgress, saSteps, rng, objective, maxPasses
    );
    // Start coordinate descent from the best SA solution (or initial if SA didn't improve)
    if (saResult.score < initialScore) {
      bestWeights = saResult.weights;
      bestMAE = saResult.score;
      bestMrr = saResult.mrr;
    }
  }

  let weightStep = 0.2;
  let curveStep = 0.05;
  let pass = 0;

  // Run until both weight and curve steps have converged (or maxPasses)
  while (pass < maxPasses && (weightStep >= MIN_WEIGHT_STEP || curveStep >= MIN_CURVE_STEP)) {
    pass++;
    // Tracked separately: a shared flag lets an improving weight pass hold the curve
    // step at a size curves have already exhausted, so curves stop being refined.
    let weightsImproved = false;
    let curvesImproved = false;

    // --- Phase A: optimize the 21 NormalizationWeights ---
    if (weightStep >= MIN_WEIGHT_STEP) {
      for (const key of WEIGHT_KEYS) {
        for (const dir of [+weightStep, -weightStep]) {
          const candidate = copyWeights(bestWeights);
          candidate[key] = clamp((bestWeights[key] ?? 0) + dir, WEIGHT_BOUNDS[0], WEIGHT_BOUNDS[1]);
          if (candidate[key] === bestWeights[key]) continue;

          const scored = await regScore(dataset, candidate, bestCurves, objective);
          if (scored.score < bestMAE) {
            bestMAE = scored.score;
            bestMrr = scored.mrr;
            bestWeights = candidate;
            weightsImproved = true;
            break;
          }
        }

        onProgress?.({
          pass: saSteps + pass,
          maxPasses: saSteps + maxPasses,
          currentMAE: bestMAE,
          bestMAE,
          step: weightStep,
          message: `CD pass ${pass}/${maxPasses} · weights · step=${weightStep.toFixed(3)} · MRR=${bestMrr.toFixed(4)}`,
        });
      }
    }

    // --- Phase B: optimize per-position curve values (opt-out via optimizeCurves) ---
    if (optimizeCurves && curveStep >= MIN_CURVE_STEP) {
      // Build the list of (startType, bucket?, pos) coordinate axes to search.
      // Legacy mode: 2 startTypes × 15 positions = 30 axes.
      // Bucketed mode (byDistance present): 2 × 3 buckets × 15 = 90 axes.
      type Axis =
        | { kind: 'legacy'; startType: 'auto' | 'volte'; pos: number }
        | { kind: 'bucketed'; startType: 'auto' | 'volte'; bucket: 'short' | 'medium' | 'long'; pos: number };
      const axes: Axis[] = [];
      if (bestCurves.byDistance) {
        for (const startType of ['auto', 'volte'] as const) {
          for (const bucket of ['short', 'medium', 'long'] as const) {
            for (const pos of CURVE_POSITIONS) axes.push({ kind: 'bucketed', startType, bucket, pos });
          }
        }
      } else {
        for (const startType of ['auto', 'volte'] as const) {
          for (const pos of CURVE_POSITIONS) axes.push({ kind: 'legacy', startType, pos });
        }
      }

      for (const axis of axes) {
        const current = axis.kind === 'legacy'
          ? (bestCurves[axis.startType][axis.pos] ?? 0)
          : (bestCurves.byDistance![axis.startType][axis.bucket][axis.pos] ?? 0);

        for (const dir of [+curveStep, -curveStep]) {
          const newVal = clamp(current + dir, CURVE_BOUNDS[0], CURVE_BOUNDS[1]);
          if (Math.abs(newVal - current) < 0.001) continue;
          const candidate = copyCurves(bestCurves);
          if (axis.kind === 'legacy') {
            candidate[axis.startType][axis.pos] = newVal;
          } else {
            candidate.byDistance![axis.startType][axis.bucket][axis.pos] = newVal;
          }

          const scored = await regScore(dataset, bestWeights, candidate, objective);
          if (scored.score < bestMAE) {
            bestMAE = scored.score;
            bestMrr = scored.mrr;
            bestCurves = candidate;
            curvesImproved = true;
            break;
          }
        }

        const label = axis.kind === 'legacy'
          ? `${axis.startType} pos ${axis.pos}`
          : `${axis.startType}.${axis.bucket} pos ${axis.pos}`;
        onProgress?.({
          pass: saSteps + pass,
          maxPasses: saSteps + maxPasses,
          currentMAE: bestMAE,
          bestMAE,
          step: curveStep,
          message: `CD pass ${pass}/${maxPasses} · curves (${label}) · step=${curveStep.toFixed(3)} · MRR=${bestMrr.toFixed(4)}`,
        });
      }
    }

    if (!weightsImproved) weightStep /= 2;
    if (!curvesImproved) curveStep /= 2;
  }

  const finalEval = await evaluateWeights(dataset, bestWeights, bestCurves);
  // improvementPct: positive = better MRR (higher win rate)
  const initialMRR = initialEval.winnerMRR;
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
