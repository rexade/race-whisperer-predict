/**
 * Honest k-fold multi-start calibration.
 *
 * The protocol is lifted from scripts/kfold-multistart.ts, which is still its own
 * inline implementation — porting that CLI onto this module is worth doing so the two
 * cannot drift, but has not been done yet. Protocol:
 *
 *   1. The caller supplies an already-separated training window and holdout. The
 *      holdout is only ever read at the very end.
 *   2. Date-level k-fold over the training window. Each start is optimized on
 *      fold.train and scored on fold.test — data that optimization never saw.
 *   3. Starts are ranked by mean OUT-OF-FOLD MRR. Ranking on the training score
 *      instead would barely discriminate: the training score is the thing each run
 *      just maximised, so every candidate looks good on its own fit.
 *   4. The winning start is refit on the full training window with a larger budget.
 *   5. The refit, the raw start, and any baselines are evaluated on the holdout.
 *
 * Driver ratings are re-derived from each fold's training half before that fold is
 * optimized. Deriving them once from the whole dataset would leak fold-test winners
 * into the ratings that then predict those same races.
 */

import type { NormalizationWeights } from '@/services/modernKm/types';
import type { PostPositionCurves } from '@/services/modernKm/index';
import {
  CalibrationDataset,
  CalibrationEvaluation,
  evaluateWeights,
} from './historicalCalibrationService';
import { createDateFolds } from './datasetSplits';
import { computeDriverRatings, saveDriverRatings } from './driverRatingService';
import {
  optimizeWeights,
  OptimizationResult,
  OptimizeObjective,
} from './weightOptimizer';

export interface KFoldStart {
  name: string;
  weights: NormalizationWeights;
  curves?: PostPositionCurves;
}

export interface StartRanking {
  name: string;
  /** Mean out-of-fold MRR — the number starts are ranked on. */
  meanOofMRR: number;
  /** Spread across folds. Wide spread means the ranking is not meaningful. */
  stdOofMRR: number;
  meanOofWin: number;
}

export interface HoldoutEntry {
  label: string;
  evaluation: CalibrationEvaluation;
}

export interface KFoldProgress {
  completed: number;
  total: number;
  message: string;
}

export interface KFoldResult {
  rankings: StartRanking[];
  winnerName: string;
  refit: OptimizationResult;
  holdout: HoldoutEntry[];
  trainDates: number;
  holdoutDates: number;
  /** Null when no baseline was supplied to compare against. */
  refitBeatsBaseline: boolean | null;
}

export interface KFoldOptions {
  k?: number;
  saSteps?: number;
  maxPasses?: number;
  optimizeCurves?: boolean;
  objective?: OptimizeObjective;
}

const mean = (xs: number[]): number =>
  xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

const std = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};

function primeRatings(dataset: CalibrationDataset): void {
  saveDriverRatings(computeDriverRatings(dataset));
}

export async function runKFoldCalibration(
  trainWindow: CalibrationDataset,
  holdout: CalibrationDataset,
  starts: KFoldStart[],
  baselines: KFoldStart[] = [],
  opts: KFoldOptions = {},
  onProgress?: (p: KFoldProgress) => void
): Promise<KFoldResult> {
  const k = Math.max(2, opts.k ?? 4);
  const saSteps = opts.saSteps ?? 300;
  const maxPasses = opts.maxPasses ?? 8;
  const optimizeCurves = opts.optimizeCurves ?? false;
  const objective = opts.objective ?? 'mrr';

  if (starts.length === 0) throw new Error('No starting configurations supplied');
  if (trainWindow.length < k) {
    throw new Error(`Need at least ${k} training dates for ${k}-fold CV, have ${trainWindow.length}`);
  }

  const folds = createDateFolds(trainWindow, k, 42);
  const foldOpts = { saSteps, maxPasses, optimizeCurves, objective };
  const total = starts.length * folds.length + 1; // + refit
  let completed = 0;

  const rankings: StartRanking[] = [];

  for (let startIdx = 0; startIdx < starts.length; startIdx++) {
    const start = starts[startIdx];
    const oofMRRs: number[] = [];
    const oofWins: number[] = [];

    for (let f = 0; f < folds.length; f++) {
      onProgress?.({
        completed,
        total,
        message: `${start.name} · fold ${f + 1}/${folds.length}`,
      });

      primeRatings(folds[f].train);
      const opt = await optimizeWeights(
        folds[f].train, start.weights, undefined, start.curves, undefined,
        // Deterministic per-(start, fold) seed so a rerun reproduces exactly.
        { ...foldOpts, seed: (startIdx + 1) * 1000 + f }
      );
      const oof = await evaluateWeights(folds[f].test, opt.optimizedWeights, opt.optimizedCurves);
      oofMRRs.push(oof.winnerMRR);
      oofWins.push(oof.winAccuracy);
      completed++;
    }

    rankings.push({
      name: start.name,
      meanOofMRR: mean(oofMRRs),
      stdOofMRR: std(oofMRRs),
      meanOofWin: mean(oofWins),
    });
  }

  rankings.sort((a, b) => b.meanOofMRR - a.meanOofMRR);
  const winnerName = rankings[0].name;
  const winner = starts.find(s => s.name === winnerName)!;

  onProgress?.({ completed, total, message: `Refitting "${winnerName}" on the full training window…` });
  primeRatings(trainWindow);
  const refit = await optimizeWeights(
    trainWindow, winner.weights, undefined, winner.curves, undefined,
    { saSteps: saSteps * 2, maxPasses: Math.max(maxPasses, 12), optimizeCurves, objective, seed: 7 }
  );
  completed++;
  onProgress?.({ completed, total, message: 'Evaluating on the holdout…' });

  // Ratings stay primed from the training window: re-deriving them from the holdout
  // would encode its own winners into the predictions being scored against it.
  const holdoutEntries: HoldoutEntry[] = [];
  if (holdout.length > 0) {
    for (const baseline of baselines) {
      holdoutEntries.push({
        label: baseline.name,
        evaluation: await evaluateWeights(holdout, baseline.weights, baseline.curves),
      });
    }
    holdoutEntries.push({
      label: `start: ${winnerName}`,
      evaluation: await evaluateWeights(holdout, winner.weights, winner.curves),
    });
    holdoutEntries.push({
      label: 'Refit (new weights)',
      evaluation: await evaluateWeights(holdout, refit.optimizedWeights, refit.optimizedCurves),
    });
  }

  const refitEntry = holdoutEntries.find(e => e.label === 'Refit (new weights)');
  const baselineEntry = holdoutEntries.find(e => baselines.some(b => b.name === e.label));
  const refitBeatsBaseline = refitEntry && baselineEntry
    ? refitEntry.evaluation.winnerMRR > baselineEntry.evaluation.winnerMRR
    : null;

  return {
    rankings,
    winnerName,
    refit,
    holdout: holdoutEntries,
    trainDates: trainWindow.length,
    holdoutDates: holdout.length,
    refitBeatsBaseline,
  };
}
