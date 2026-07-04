/**
 * K-fold cross-validation optimizer.
 *
 * ⚠ DEPRECATED — kfoldMRR() here never uses fold.train: averaging test-fold
 * scores over all K folds equals scoring on the ENTIRE dataset, so optimization
 * is in-sample and results are overfit. Use kfold-multistart.ts, which optimizes
 * on fold.train, scores on fold.test, and reports against a chronological holdout.
 *
 * Usage:
 *   npx tsx scripts/kfold-optimize.ts [dataset.json] [folds=5] [passes=8]
 */

import './node-polyfills';
import * as fs from 'fs';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { hydrateDataset } from './cli-common';

// ── K-fold scoring ──────────────────────────────────────────────────────────

interface FoldSplit { train: CalibrationDataset; test: CalibrationDataset }

function createFolds(dataset: CalibrationDataset, k: number): FoldSplit[] {
  // Shuffle dates deterministically
  const indices = dataset.map((_, i) => i);
  // Simple seeded shuffle
  let seed = 42;
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const foldSize = Math.ceil(dataset.length / k);
  const folds: FoldSplit[] = [];

  for (let f = 0; f < k; f++) {
    const testIndices = new Set(indices.slice(f * foldSize, (f + 1) * foldSize));
    const train = dataset.filter((_, i) => !testIndices.has(i));
    const test = dataset.filter((_, i) => testIndices.has(i));
    folds.push({ train, test });
  }
  return folds;
}

/** Average MRR across all folds (evaluated on held-out test fold) */
async function kfoldMRR(folds: FoldSplit[], weights: NormalizationWeights): Promise<{ mrr: number; win: number }> {
  let mrrSum = 0;
  let winSum = 0;
  for (const fold of folds) {
    const result = await evaluateWeights(fold.test, weights);
    mrrSum += result.winnerMRR;
    winSum += result.winAccuracy;
  }
  return { mrr: mrrSum / folds.length, win: winSum / folds.length };
}

/** Full-dataset evaluation for reporting */
async function fullEval(dataset: CalibrationDataset, weights: NormalizationWeights) {
  return evaluateWeights(dataset, weights);
}

// ── Coordinate descent ──────────────────────────────────────────────────────

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition', 'shoeType', 'sulkyType',
  'driverPerformance', 'driverForm', 'driverEmpirical',
  'trackFamiliarity', 'form', 'distanceAdjustment',
  'raceDistanceAdjustment', 'volteStartDistancePenalty',
  'startPoints', 'placePercentage', 'horseWinPercentage',
  'earningsPerStart', 'gallopRisk', 'layoffPenalty',
  'ageFactor', 'genderAdjustment', 'consistencyFactor',
  'trainerPerformance', 'oddsHistorical', 'oddsLive',
];

const BOUNDS: [number, number] = [0.0, 5.0];

async function coordinateDescent(
  folds: FoldSplit[],
  dataset: CalibrationDataset,
  startWeights: NormalizationWeights,
  maxPasses: number,
  stepSizes: number[] = [0.5, 0.2, 0.1, 0.05],
): Promise<NormalizationWeights> {
  let best = { ...startWeights };
  let bestScore = await kfoldMRR(folds, best);

  console.log(`  Start: CV-MRR=${bestScore.mrr.toFixed(4)}  CV-Win=${(bestScore.win * 100).toFixed(1)}%`);

  for (let pass = 0; pass < maxPasses; pass++) {
    const step = stepSizes[Math.min(pass, stepSizes.length - 1)];
    let improved = false;

    for (const key of WEIGHT_KEYS) {
      // Try +step
      const up = { ...best, [key]: Math.min(best[key] + step, BOUNDS[1]) };
      const upScore = await kfoldMRR(folds, up);

      // Try -step
      const down = { ...best, [key]: Math.max(best[key] - step, BOUNDS[0]) };
      const downScore = await kfoldMRR(folds, down);

      if (upScore.mrr > bestScore.mrr && upScore.mrr >= downScore.mrr) {
        best = up;
        bestScore = upScore;
        improved = true;
      } else if (downScore.mrr > bestScore.mrr) {
        best = down;
        bestScore = downScore;
        improved = true;
      }
    }

    // Full dataset eval for reporting
    const full = await fullEval(dataset, best);
    console.log(
      `  Pass ${pass + 1} (step=${step}): CV-MRR=${bestScore.mrr.toFixed(4)}  CV-Win=${(bestScore.win * 100).toFixed(1)}%  Full-Win=${(full.winAccuracy * 100).toFixed(1)}%  Full-MRR=${full.winnerMRR.toFixed(3)}${improved ? '' : '  (no improvement, converged)'}`
    );

    if (!improved) {
      // If we're on the smallest step already, stop
      if (step <= stepSizes[stepSizes.length - 1]) break;
      // Otherwise continue with smaller step
    }
  }

  return best;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  const K = parseInt(process.argv[3] || '5', 10);
  const passes = parseInt(process.argv[4] || '10', 10);

  console.log(`Loading ${datasetPath}…`);
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const dataset = hydrateDataset(raw);
  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
  console.log(`Dataset: ${dataset.length} dates, ${totalRaces} races`);
  console.log(`K-fold: ${K} folds, ${passes} CD passes\n`);

  const folds = createFolds(dataset, K);
  for (let i = 0; i < folds.length; i++) {
    const trainRaces = folds[i].train.reduce((s, d) => s + d.races.length, 0);
    const testRaces = folds[i].test.reduce((s, d) => s + d.races.length, 0);
    console.log(`  Fold ${i + 1}: train=${folds[i].train.length} dates (${trainRaces} races), test=${folds[i].test.length} dates (${testRaces} races)`);
  }

  // Starting point: V23 (current default weights — K-fold CV optimized, Run 49)
  const start: NormalizationWeights = {
    postPosition: 1.500, shoeType: 0.000, sulkyType: 0.500,
    driverPerformance: 2.200, driverForm: 0.000, driverEmpirical: 0.000,
    trackFamiliarity: 0.000, form: 5.000, distanceAdjustment: 1.000,
    raceDistanceAdjustment: 1.500, volteStartDistancePenalty: 2.200,
    startPoints: 2.500, placePercentage: 0.400, horseWinPercentage: 1.000,
    earningsPerStart: 1.300, gallopRisk: 0.000, layoffPenalty: 1.900,
    ageFactor: 0.000, genderAdjustment: 0.900, consistencyFactor: 2.000,
    trainerPerformance: 1.500,
  };

  console.log(`\nOptimizing with ${K}-fold cross-validation…`);
  const optimized = await coordinateDescent(folds, dataset, start, passes);

  // Final report
  const finalCV = await kfoldMRR(folds, optimized);
  const finalFull = await fullEval(dataset, optimized);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RESULT:');
  console.log(`  CV-Win=${(finalCV.win * 100).toFixed(1)}%  CV-MRR=${finalCV.mrr.toFixed(4)}`);
  console.log(`  Full-Win=${(finalFull.winAccuracy * 100).toFixed(1)}%  Full-MRR=${finalFull.winnerMRR.toFixed(3)}  Top3=${(finalFull.topPickAccuracy * 100).toFixed(1)}%`);
  console.log('\nWeights:');
  console.log(JSON.stringify(optimized, null, 2));
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
